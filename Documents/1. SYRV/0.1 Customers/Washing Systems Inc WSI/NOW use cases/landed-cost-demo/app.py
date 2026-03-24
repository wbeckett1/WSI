"""
WSI Order-Level Landed Cost Optimization — MVP Demo
Advisory sidecar that ranks best feasible source/routing/currency options per order.
"""

import sqlite3
import json
import os
import random
from datetime import datetime, timedelta
from flask import Flask, render_template, jsonify, request, g

app = Flask(__name__)
DB_PATH = os.path.join(os.path.dirname(__file__), "demo.db")

# ── Database helpers ──────────────────────────────────────────────────────────

def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA journal_mode=WAL")
        g.db.execute("PRAGMA foreign_keys=ON")
    return g.db


@app.teardown_appcontext
def close_db(exc):
    db = g.pop("db", None)
    if db:
        db.close()


# ── Schema ────────────────────────────────────────────────────────────────────

SCHEMA = """
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    customer TEXT NOT NULL,
    ship_to TEXT NOT NULL,
    requested_ship_date TEXT NOT NULL,
    order_date TEXT NOT NULL,
    baseline_source TEXT NOT NULL,
    incoterm TEXT DEFAULT 'FOB',
    status TEXT DEFAULT 'ready',          -- ready | enriched | evaluated | approved | overridden | shipped | closed
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT REFERENCES orders(id),
    sku TEXT NOT NULL,
    description TEXT,
    quantity REAL NOT NULL,
    uom TEXT DEFAULT 'GAL',
    pack_type TEXT DEFAULT 'Drum',
    hazmat INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS source_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id TEXT NOT NULL,
    source_name TEXT NOT NULL,
    region TEXT,
    production_cost REAL,
    blending_cost REAL,
    packaging_cost REAL,
    capacity_available REAL,
    lead_time_days INTEGER,
    freshness_date TEXT,
    freshness_status TEXT DEFAULT 'green'   -- green | amber | red
);

CREATE TABLE IF NOT EXISTS lane_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    origin TEXT NOT NULL,
    destination_zone TEXT NOT NULL,
    carrier TEXT,
    mode TEXT DEFAULT 'TL',
    base_rate REAL,
    accessorial REAL DEFAULT 0,
    effective_date TEXT,
    expiry_date TEXT
);

CREATE TABLE IF NOT EXISTS customer_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer TEXT NOT NULL,
    rule_type TEXT NOT NULL,   -- approved_source | service_window | carrier_restriction | split_policy
    rule_value TEXT NOT NULL,
    hard_constraint INTEGER DEFAULT 1,
    effective_date TEXT
);

CREATE TABLE IF NOT EXISTS fx_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_currency TEXT NOT NULL,
    to_currency TEXT NOT NULL,
    rate REAL NOT NULL,
    rate_date TEXT NOT NULL,
    source TEXT DEFAULT 'finance_feed',
    freshness_status TEXT DEFAULT 'green'
);

CREATE TABLE IF NOT EXISTS recommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT REFERENCES orders(id),
    option_rank INTEGER,
    source_id TEXT,
    source_name TEXT,
    lane_description TEXT,
    mode TEXT,
    ship_promise_date TEXT,
    product_cost REAL,
    blending_cost REAL,
    packaging_cost REAL,
    inbound_cost REAL,
    outbound_freight REAL,
    accessorials REAL,
    duties REAL DEFAULT 0,
    fx_impact REAL DEFAULT 0,
    expedite_premium REAL DEFAULT 0,
    rebates REAL DEFAULT 0,
    landed_cost REAL,
    delta_vs_baseline REAL,
    delta_pct REAL,
    risk_flag TEXT DEFAULT 'green',       -- green | amber | red
    reason_codes TEXT,                     -- JSON array
    rationale TEXT,
    is_baseline INTEGER DEFAULT 0,
    assumptions_version TEXT DEFAULT 'v1.0',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT REFERENCES orders(id),
    selected_option_rank INTEGER,
    approver TEXT,
    approver_role TEXT,
    approval_timestamp TEXT DEFAULT (datetime('now')),
    threshold_class TEXT DEFAULT 'standard',
    reason_code TEXT,
    override_flag INTEGER DEFAULT 0,
    override_comment TEXT,
    assumptions_version TEXT DEFAULT 'v1.0'
);

CREATE TABLE IF NOT EXISTS savings_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT REFERENCES orders(id),
    baseline_cost REAL,
    selected_cost REAL,
    theoretical_savings REAL,
    realized_savings REAL,
    finance_status TEXT DEFAULT 'pending',   -- pending | validated | disputed
    period TEXT
);

CREATE TABLE IF NOT EXISTS issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    opened_date TEXT DEFAULT (date('now')),
    category TEXT,
    issue TEXT,
    owner TEXT,
    target_date TEXT,
    status TEXT DEFAULT 'open',
    comments TEXT
);

CREATE TABLE IF NOT EXISTS constraint_catalog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    constraint_type TEXT,
    description TEXT,
    value TEXT,
    effective_date TEXT,
    approved_by TEXT,
    version TEXT DEFAULT 'v1.0'
);
"""


# ── Seed data ─────────────────────────────────────────────────────────────────

CUSTOMERS = [
    ("Cintas", "Aston, PA"),
    ("Cintas", "Louisville, KY"),
    ("Alsco", "Alexandria, VA"),
    ("UniFirst", "Owensboro, KY"),
    ("Alsco", "Nashville, TN"),
]

SOURCES = [
    ("SRC-OH", "Dayton Blending Facility", "Midwest", 2.10, 0.45, 0.30, 5000, 3),
    ("SRC-TX", "Houston Chemical Plant", "South", 1.85, 0.50, 0.35, 8000, 5),
    ("SRC-PA", "Philadelphia Facility", "Northeast", 2.25, 0.40, 0.28, 3000, 2),
    ("SRC-GA", "Atlanta Distribution", "Southeast", 1.95, 0.48, 0.32, 6000, 4),
    ("SRC-IL", "Chicago Blending Hub", "Midwest", 2.00, 0.42, 0.29, 7000, 3),
]

SKUS = [
    ("WC-100", "Industrial Wash Chemical - Standard", 55),
    ("WC-200", "Heavy Duty Degreaser Concentrate", 30),
    ("WC-300", "Fabric Softener Blend", 110),
    ("WC-150", "Tunnel Washer Detergent", 75),
    ("WC-400", "Stain Treatment Solution", 20),
]


def seed_database():
    db = sqlite3.connect(DB_PATH)
    db.execute("PRAGMA journal_mode=WAL")
    cur = db.cursor()

    # Run schema
    cur.executescript(SCHEMA)

    # Check if already seeded
    if cur.execute("SELECT count(*) FROM orders").fetchone()[0] > 0:
        db.close()
        return

    today = datetime.now()

    # Source options
    for s in SOURCES:
        fresh = (today - timedelta(days=random.randint(0, 2))).strftime("%Y-%m-%d")
        cur.execute(
            "INSERT INTO source_options (source_id, source_name, region, production_cost, blending_cost, packaging_cost, capacity_available, lead_time_days, freshness_date, freshness_status) VALUES (?,?,?,?,?,?,?,?,?,?)",
            (*s, fresh, "green"),
        )

    # Lane rates
    origins = ["Dayton, OH", "Houston, TX", "Philadelphia, PA", "Atlanta, GA", "Chicago, IL"]
    dests = ["Aston, PA", "Louisville, KY", "Alexandria, VA", "Owensboro, KY", "Nashville, TN"]
    carriers = ["XPO Logistics", "Old Dominion", "FedEx Freight", "Estes Express"]
    for orig in origins:
        for dest in dests:
            rate = round(random.uniform(450, 2200), 2)
            acc = round(random.uniform(25, 150), 2)
            eff = (today - timedelta(days=random.randint(1, 30))).strftime("%Y-%m-%d")
            exp = (today + timedelta(days=random.randint(30, 90))).strftime("%Y-%m-%d")
            cur.execute(
                "INSERT INTO lane_rates (origin, destination_zone, carrier, mode, base_rate, accessorial, effective_date, expiry_date) VALUES (?,?,?,?,?,?,?,?)",
                (orig, dest, random.choice(carriers), random.choice(["TL", "LTL"]), rate, acc, eff, exp),
            )

    # Customer rules
    rules = [
        ("Cintas", "approved_source", "SRC-OH,SRC-PA,SRC-IL", 1),
        ("Cintas", "service_window", "2-5 business days", 1),
        ("Alsco", "approved_source", "SRC-OH,SRC-TX,SRC-GA,SRC-IL", 1),
        ("Alsco", "carrier_restriction", "No LTL for hazmat", 1),
        ("UniFirst", "approved_source", "SRC-OH,SRC-TX,SRC-PA,SRC-GA,SRC-IL", 1),
        ("UniFirst", "split_policy", "No split shipments", 0),
    ]
    for r in rules:
        cur.execute(
            "INSERT INTO customer_rules (customer, rule_type, rule_value, hard_constraint, effective_date) VALUES (?,?,?,?,?)",
            (*r, today.strftime("%Y-%m-%d")),
        )

    # FX rates
    for pair in [("USD", "CAD", 1.36), ("USD", "MXN", 17.12), ("USD", "EUR", 0.92)]:
        cur.execute(
            "INSERT INTO fx_rates (from_currency, to_currency, rate, rate_date) VALUES (?,?,?,?)",
            (*pair, today.strftime("%Y-%m-%d")),
        )

    # Orders with lines
    for i, (cust, ship_to) in enumerate(CUSTOMERS):
        oid = f"WSI-2026-{1001 + i}"
        odate = (today - timedelta(days=random.randint(0, 3))).strftime("%Y-%m-%d")
        rdate = (today + timedelta(days=random.randint(3, 10))).strftime("%Y-%m-%d")
        baseline = random.choice(["SRC-OH", "SRC-PA", "SRC-IL"])
        cur.execute(
            "INSERT INTO orders (id, customer, ship_to, requested_ship_date, order_date, baseline_source, status) VALUES (?,?,?,?,?,?,?)",
            (oid, cust, ship_to, rdate, odate, baseline, "ready"),
        )
        # 1-3 lines per order
        for _ in range(random.randint(1, 3)):
            sku, desc, qty_base = random.choice(SKUS)
            qty = qty_base * random.randint(1, 4)
            cur.execute(
                "INSERT INTO order_lines (order_id, sku, description, quantity, uom) VALUES (?,?,?,?,?)",
                (oid, sku, desc, qty, "GAL"),
            )

    # Also add some orders in later states for demo variety
    for i in range(3):
        oid = f"WSI-2026-{2001 + i}"
        cust, ship_to = random.choice(CUSTOMERS)
        odate = (today - timedelta(days=random.randint(5, 15))).strftime("%Y-%m-%d")
        rdate = (today - timedelta(days=random.randint(0, 5))).strftime("%Y-%m-%d")
        baseline = random.choice(["SRC-OH", "SRC-PA", "SRC-TX"])
        status = ["approved", "shipped", "closed"][i]
        cur.execute(
            "INSERT INTO orders (id, customer, ship_to, requested_ship_date, order_date, baseline_source, status) VALUES (?,?,?,?,?,?,?)",
            (oid, cust, ship_to, rdate, odate, baseline, status),
        )
        cur.execute(
            "INSERT INTO order_lines (order_id, sku, description, quantity) VALUES (?,?,?,?)",
            (oid, "WC-100", "Industrial Wash Chemical - Standard", 110),
        )
        # Add savings for these
        bl_cost = round(random.uniform(3500, 6000), 2)
        sel_cost = round(bl_cost * random.uniform(0.85, 0.97), 2)
        theo = round(bl_cost - sel_cost, 2)
        real = round(theo * random.uniform(0.7, 1.05), 2) if status == "closed" else None
        fin_status = "validated" if status == "closed" else "pending"
        cur.execute(
            "INSERT INTO savings_ledger (order_id, baseline_cost, selected_cost, theoretical_savings, realized_savings, finance_status, period) VALUES (?,?,?,?,?,?,?)",
            (oid, bl_cost, sel_cost, theo, real, fin_status, today.strftime("%Y-%m")),
        )

    # Issues
    issues_data = [
        ("Data Quality", "Houston rate table missing accessorial for Aston, PA lane", "J. Martinez", "open"),
        ("Process", "Cintas carrier restriction not yet verified with account team", "S. Chen", "open"),
        ("Data Quality", "FX feed delayed by 2 days last week", "IT Team", "resolved"),
        ("Enhancement", "Add PDF export for monthly decision packet", "Product", "backlog"),
    ]
    for cat, iss, owner, status in issues_data:
        tgt = (today + timedelta(days=random.randint(5, 20))).strftime("%Y-%m-%d")
        cur.execute(
            "INSERT INTO issues (category, issue, owner, target_date, status) VALUES (?,?,?,?,?)",
            (cat, iss, owner, tgt, status),
        )

    db.commit()
    db.close()


# ── Landed Cost Engine ────────────────────────────────────────────────────────

SOURCE_CITY = {
    "SRC-OH": "Dayton, OH",
    "SRC-TX": "Houston, TX",
    "SRC-PA": "Philadelphia, PA",
    "SRC-GA": "Atlanta, GA",
    "SRC-IL": "Chicago, IL",
}


def evaluate_order(order_id):
    """Run the landed-cost optimization for an order. Returns list of ranked options."""
    db = get_db()
    order = db.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    if not order:
        return []

    lines = db.execute("SELECT * FROM order_lines WHERE order_id = ?", (order_id,)).fetchall()
    total_qty = sum(l["quantity"] for l in lines)

    # Get customer rules
    cust_rules = db.execute(
        "SELECT * FROM customer_rules WHERE customer = ?", (order["customer"],)
    ).fetchall()

    approved_sources = None
    for r in cust_rules:
        if r["rule_type"] == "approved_source":
            approved_sources = set(r["rule_value"].split(","))

    sources = db.execute("SELECT * FROM source_options").fetchall()
    results = []

    for src in sources:
        # ── Hard constraint filtering ──
        feasible = True
        filter_reasons = []

        # Approved source check
        if approved_sources and src["source_id"] not in approved_sources:
            feasible = False
            filter_reasons.append(f"Not on {order['customer']} approved source list")

        # Capacity check
        if src["capacity_available"] < total_qty:
            feasible = False
            filter_reasons.append(f"Insufficient capacity ({src['capacity_available']} < {total_qty})")

        # Lead time check
        req_date = datetime.strptime(order["requested_ship_date"], "%Y-%m-%d")
        order_date = datetime.strptime(order["order_date"], "%Y-%m-%d")
        available_days = (req_date - order_date).days
        if src["lead_time_days"] > available_days:
            feasible = False
            filter_reasons.append(f"Lead time {src['lead_time_days']}d exceeds available {available_days}d")

        # Get freight rate
        origin_city = SOURCE_CITY.get(src["source_id"], "Unknown")
        lane = db.execute(
            "SELECT * FROM lane_rates WHERE origin = ? AND destination_zone = ? ORDER BY base_rate ASC LIMIT 1",
            (origin_city, order["ship_to"]),
        ).fetchone()

        freight = lane["base_rate"] if lane else 800.0  # fallback
        accessorials = lane["accessorial"] if lane else 50.0
        carrier = lane["carrier"] if lane else "Default Carrier"
        mode = lane["mode"] if lane else "TL"

        # ── Landed cost calculation ──
        product_cost = round(src["production_cost"] * total_qty, 2)
        blending = round(src["blending_cost"] * total_qty, 2)
        packaging = round(src["packaging_cost"] * total_qty, 2)
        inbound = 0  # simplified for MVP
        outbound = freight
        duties = 0
        fx_impact = 0
        expedite = 0
        rebates = 0

        landed = round(
            product_cost + blending + packaging + inbound + outbound + accessorials + duties + fx_impact + expedite - rebates,
            2,
        )

        is_baseline = 1 if src["source_id"] == order["baseline_source"] else 0

        ship_promise = (order_date + timedelta(days=src["lead_time_days"])).strftime("%Y-%m-%d")

        results.append({
            "source_id": src["source_id"],
            "source_name": src["source_name"],
            "lane_description": f"{origin_city} → {order['ship_to']} via {carrier}",
            "mode": mode,
            "ship_promise_date": ship_promise,
            "product_cost": product_cost,
            "blending_cost": blending,
            "packaging_cost": packaging,
            "inbound_cost": inbound,
            "outbound_freight": outbound,
            "accessorials": accessorials,
            "duties": duties,
            "fx_impact": fx_impact,
            "expedite_premium": expedite,
            "rebates": rebates,
            "landed_cost": landed,
            "is_baseline": is_baseline,
            "feasible": feasible,
            "filter_reasons": filter_reasons,
            "risk_flag": src["freshness_status"],
        })

    # Calculate baseline cost
    baseline_cost = None
    for r in results:
        if r["is_baseline"]:
            baseline_cost = r["landed_cost"]
            break
    if baseline_cost is None and results:
        baseline_cost = results[0]["landed_cost"]

    # Filter to feasible, rank by cost
    feasible_options = [r for r in results if r["feasible"]]
    infeasible_options = [r for r in results if not r["feasible"]]
    feasible_options.sort(key=lambda x: x["landed_cost"])

    # Clear old recommendations
    db.execute("DELETE FROM recommendations WHERE order_id = ?", (order_id,))

    all_ranked = []
    for rank, opt in enumerate(feasible_options, 1):
        delta = round(opt["landed_cost"] - baseline_cost, 2)
        delta_pct = round((delta / baseline_cost) * 100, 2) if baseline_cost else 0

        # Generate reason codes and rationale
        reason_codes = []
        rationale_parts = []

        if rank == 1 and delta < 0:
            reason_codes.append("LOWEST_COST")
            rationale_parts.append(f"Lowest landed cost at ${opt['landed_cost']:,.2f}")
        if opt["is_baseline"]:
            reason_codes.append("BASELINE")
            rationale_parts.append("Current default source")
        if delta < -100:
            reason_codes.append("SIGNIFICANT_SAVINGS")
            rationale_parts.append(f"Saves ${abs(delta):,.2f} ({abs(delta_pct):.1f}%) vs baseline")
        if opt["risk_flag"] == "green":
            reason_codes.append("FRESH_DATA")
        elif opt["risk_flag"] == "amber":
            reason_codes.append("STALE_WARNING")
            rationale_parts.append("Rate data approaching expiration")

        rationale = ". ".join(rationale_parts) if rationale_parts else "Standard option within tolerance"

        db.execute(
            """INSERT INTO recommendations
               (order_id, option_rank, source_id, source_name, lane_description, mode,
                ship_promise_date, product_cost, blending_cost, packaging_cost, inbound_cost,
                outbound_freight, accessorials, duties, fx_impact, expedite_premium, rebates,
                landed_cost, delta_vs_baseline, delta_pct, risk_flag, reason_codes, rationale, is_baseline)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                order_id, rank, opt["source_id"], opt["source_name"], opt["lane_description"],
                opt["mode"], opt["ship_promise_date"], opt["product_cost"], opt["blending_cost"],
                opt["packaging_cost"], opt["inbound_cost"], opt["outbound_freight"],
                opt["accessorials"], opt["duties"], opt["fx_impact"], opt["expedite_premium"],
                opt["rebates"], opt["landed_cost"], delta, delta_pct, opt["risk_flag"],
                json.dumps(reason_codes), rationale, opt["is_baseline"],
            ),
        )
        all_ranked.append({**opt, "option_rank": rank, "delta_vs_baseline": delta, "delta_pct": delta_pct, "reason_codes": reason_codes, "rationale": rationale})

    # Update order status
    db.execute("UPDATE orders SET status = 'evaluated' WHERE id = ?", (order_id,))
    db.commit()

    return {"feasible": all_ranked, "infeasible": infeasible_options, "baseline_cost": baseline_cost}


# ── API Routes ────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/orders")
def api_orders():
    db = get_db()
    orders = db.execute("""
        SELECT o.*, GROUP_CONCAT(ol.sku || ' x' || CAST(ol.quantity AS INT), ', ') as line_summary,
               SUM(ol.quantity) as total_qty
        FROM orders o LEFT JOIN order_lines ol ON o.id = ol.order_id
        GROUP BY o.id ORDER BY o.created_at DESC
    """).fetchall()
    return jsonify([dict(o) for o in orders])


@app.route("/api/orders/<order_id>")
def api_order_detail(order_id):
    db = get_db()
    order = db.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    if not order:
        return jsonify({"error": "Not found"}), 404
    lines = db.execute("SELECT * FROM order_lines WHERE order_id = ?", (order_id,)).fetchall()
    recs = db.execute("SELECT * FROM recommendations WHERE order_id = ? ORDER BY option_rank", (order_id,)).fetchall()
    decision = db.execute("SELECT * FROM decisions WHERE order_id = ? ORDER BY id DESC LIMIT 1", (order_id,)).fetchone()
    savings = db.execute("SELECT * FROM savings_ledger WHERE order_id = ?", (order_id,)).fetchone()
    rules = db.execute("SELECT * FROM customer_rules WHERE customer = ?", (order["customer"],)).fetchall()
    return jsonify({
        "order": dict(order),
        "lines": [dict(l) for l in lines],
        "recommendations": [dict(r) for r in recs],
        "decision": dict(decision) if decision else None,
        "savings": dict(savings) if savings else None,
        "customer_rules": [dict(r) for r in rules],
    })


@app.route("/api/orders/<order_id>/evaluate", methods=["POST"])
def api_evaluate(order_id):
    result = evaluate_order(order_id)
    return jsonify(result)


@app.route("/api/orders/<order_id>/approve", methods=["POST"])
def api_approve(order_id):
    db = get_db()
    data = request.json
    rank = data.get("selected_rank", 1)
    approver = data.get("approver", "Demo User")
    role = data.get("role", "Ops / Logistics Planner")
    override = data.get("override", False)
    override_comment = data.get("override_comment", "")
    reason_code = data.get("reason_code", "cost_optimized")

    threshold_class = "standard"
    rec = db.execute(
        "SELECT * FROM recommendations WHERE order_id = ? AND option_rank = ?",
        (order_id, rank),
    ).fetchone()
    if rec and abs(rec["delta_vs_baseline"]) > 500:
        threshold_class = "finance_review"

    db.execute(
        """INSERT INTO decisions (order_id, selected_option_rank, approver, approver_role,
           threshold_class, reason_code, override_flag, override_comment)
           VALUES (?,?,?,?,?,?,?,?)""",
        (order_id, rank, approver, role, threshold_class, reason_code, 1 if override else 0, override_comment),
    )

    new_status = "overridden" if override else "approved"
    db.execute("UPDATE orders SET status = ? WHERE id = ?", (new_status, order_id))

    # Create savings ledger entry
    baseline_rec = db.execute(
        "SELECT * FROM recommendations WHERE order_id = ? AND is_baseline = 1", (order_id,)
    ).fetchone()
    if baseline_rec and rec:
        theo = round(baseline_rec["landed_cost"] - rec["landed_cost"], 2)
        db.execute(
            """INSERT INTO savings_ledger (order_id, baseline_cost, selected_cost, theoretical_savings, period)
               VALUES (?,?,?,?,?)""",
            (order_id, baseline_rec["landed_cost"], rec["landed_cost"], theo, datetime.now().strftime("%Y-%m")),
        )

    db.commit()
    return jsonify({"status": "ok", "new_status": new_status})


@app.route("/api/savings")
def api_savings():
    db = get_db()
    rows = db.execute("""
        SELECT s.*, o.customer, o.ship_to
        FROM savings_ledger s JOIN orders o ON s.order_id = o.id
        ORDER BY s.id DESC
    """).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/dashboard")
def api_dashboard():
    db = get_db()
    total_orders = db.execute("SELECT count(*) as c FROM orders").fetchone()["c"]
    evaluated = db.execute("SELECT count(*) as c FROM orders WHERE status IN ('evaluated','approved','overridden','shipped','closed')").fetchone()["c"]
    approved = db.execute("SELECT count(*) as c FROM orders WHERE status IN ('approved','shipped','closed')").fetchone()["c"]
    overridden = db.execute("SELECT count(*) as c FROM orders WHERE status = 'overridden'").fetchone()["c"]

    theo_total = db.execute("SELECT COALESCE(SUM(theoretical_savings),0) as s FROM savings_ledger").fetchone()["s"]
    real_total = db.execute("SELECT COALESCE(SUM(realized_savings),0) as s FROM savings_ledger WHERE realized_savings IS NOT NULL").fetchone()["s"]
    validated = db.execute("SELECT count(*) as c FROM savings_ledger WHERE finance_status = 'validated'").fetchone()["c"]

    acceptance_rate = round((approved / evaluated * 100), 1) if evaluated > 0 else 0
    override_rate = round((overridden / (approved + overridden) * 100), 1) if (approved + overridden) > 0 else 0

    return jsonify({
        "total_orders": total_orders,
        "evaluated": evaluated,
        "approved": approved,
        "overridden": overridden,
        "acceptance_rate": acceptance_rate,
        "override_rate": override_rate,
        "theoretical_savings": round(theo_total, 2),
        "realized_savings": round(real_total, 2),
        "validated_count": validated,
        "freshness_compliance": 87.5,  # demo value
        "weekly_active_users": 4,
    })


@app.route("/api/sources")
def api_sources():
    db = get_db()
    rows = db.execute("SELECT * FROM source_options").fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/rules")
def api_rules():
    db = get_db()
    rows = db.execute("SELECT * FROM customer_rules ORDER BY customer").fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/rates")
def api_rates():
    db = get_db()
    rows = db.execute("SELECT * FROM lane_rates ORDER BY origin, destination_zone").fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/fx")
def api_fx():
    db = get_db()
    rows = db.execute("SELECT * FROM fx_rates").fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/issues")
def api_issues():
    db = get_db()
    rows = db.execute("SELECT * FROM issues ORDER BY status, opened_date DESC").fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/decisions")
def api_decisions():
    db = get_db()
    rows = db.execute("""
        SELECT d.*, o.customer, o.ship_to, r.source_name, r.landed_cost, r.delta_vs_baseline
        FROM decisions d
        JOIN orders o ON d.order_id = o.id
        LEFT JOIN recommendations r ON d.order_id = r.order_id AND d.selected_option_rank = r.option_rank
        ORDER BY d.approval_timestamp DESC
    """).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/scenario", methods=["POST"])
def api_scenario():
    """FX / freight sensitivity scenario."""
    data = request.json
    order_id = data.get("order_id")
    fx_shift = data.get("fx_shift_pct", 0)  # e.g. +5 or -5
    freight_shift = data.get("freight_shift_pct", 0)

    db = get_db()
    recs = db.execute(
        "SELECT * FROM recommendations WHERE order_id = ? ORDER BY option_rank", (order_id,)
    ).fetchall()

    scenarios = []
    for r in recs:
        new_freight = round(r["outbound_freight"] * (1 + freight_shift / 100), 2)
        new_fx = round(r["fx_impact"] * (1 + fx_shift / 100), 2) if r["fx_impact"] else 0
        new_landed = round(
            r["product_cost"] + r["blending_cost"] + r["packaging_cost"] +
            r["inbound_cost"] + new_freight + r["accessorials"] +
            r["duties"] + new_fx + r["expedite_premium"] - r["rebates"], 2
        )
        scenarios.append({
            "option_rank": r["option_rank"],
            "source_name": r["source_name"],
            "original_landed": r["landed_cost"],
            "scenario_landed": new_landed,
            "change": round(new_landed - r["landed_cost"], 2),
        })

    scenarios.sort(key=lambda x: x["scenario_landed"])
    return jsonify(scenarios)


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    seed_database()
    print("\n  WSI Landed Cost Optimization MVP Demo")
    print("  =====================================")
    print("  Open http://localhost:5000 in your browser\n")
    app.run(debug=True, port=5000)
