"""WSI Tablet/Web Field Service Reporting Platform - Demo Server"""
import sqlite3
import os
import uuid
from datetime import datetime
from flask import Flask, jsonify, request, send_from_directory, send_file

app = Flask(__name__, static_folder='public', static_url_path='')
DB_PATH = os.path.join(os.path.dirname(__file__), 'wsi_demo.db')
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), 'public', 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def dict_rows(rows):
    return [dict(r) for r in rows]


def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS sites (
            site_id TEXT PRIMARY KEY,
            account_name TEXT NOT NULL,
            site_name TEXT NOT NULL,
            address TEXT,
            service_lines TEXT DEFAULT 'WF,WW',
            contacts TEXT
        );
        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            email TEXT
        );
        CREATE TABLE IF NOT EXISTS visits (
            visit_id TEXT PRIMARY KEY,
            site_id TEXT NOT NULL REFERENCES sites(site_id),
            consultant_id TEXT NOT NULL REFERENCES users(user_id),
            visit_date TEXT NOT NULL,
            report_pack TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'planned',
            entrance_notes TEXT,
            general_observations TEXT,
            exit_notes TEXT,
            distribution_list TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS wf_observations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            visit_id TEXT NOT NULL REFERENCES visits(visit_id),
            section TEXT NOT NULL,
            field_code TEXT NOT NULL,
            field_label TEXT NOT NULL,
            value TEXT,
            unit TEXT,
            threshold_low REAL,
            threshold_high REAL,
            flag TEXT,
            notes TEXT
        );
        CREATE TABLE IF NOT EXISTS ww_observations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            visit_id TEXT NOT NULL REFERENCES visits(visit_id),
            section TEXT NOT NULL,
            field_code TEXT NOT NULL,
            field_label TEXT NOT NULL,
            value TEXT,
            unit TEXT,
            threshold_low REAL,
            threshold_high REAL,
            status TEXT,
            notes TEXT
        );
        CREATE TABLE IF NOT EXISTS action_items (
            action_item_id TEXT PRIMARY KEY,
            visit_id TEXT NOT NULL REFERENCES visits(visit_id),
            section_ref TEXT,
            description TEXT NOT NULL,
            severity TEXT NOT NULL DEFAULT 'medium',
            owner TEXT,
            due_date TEXT,
            status TEXT NOT NULL DEFAULT 'open',
            comments TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS attachments (
            attachment_id TEXT PRIMARY KEY,
            visit_id TEXT NOT NULL REFERENCES visits(visit_id),
            section_ref TEXT,
            file_path TEXT NOT NULL,
            caption TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS approval_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            visit_id TEXT NOT NULL REFERENCES visits(visit_id),
            stage TEXT NOT NULL,
            actor_id TEXT NOT NULL,
            decision TEXT NOT NULL,
            comment TEXT,
            timestamp TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS signatures (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            visit_id TEXT NOT NULL REFERENCES visits(visit_id),
            signer_name TEXT NOT NULL,
            signer_role TEXT NOT NULL,
            signature_data TEXT,
            signed_at TEXT DEFAULT (datetime('now'))
        );
    """)

    # Seed data if empty
    count = conn.execute("SELECT COUNT(*) FROM sites").fetchone()[0]
    if count == 0:
        conn.executemany("INSERT INTO sites VALUES (?,?,?,?,?,?)", [
            ('SITE-001', 'Alsco', 'Alsco Alexandria', '1234 Industrial Blvd, Alexandria, VA', 'WF,WW', 'Mike Johnson (Plant Mgr), Sarah Lee (Ops)'),
            ('SITE-002', 'Cintas', 'Cintas Aston', '5678 Commerce Dr, Aston, PA', 'WF,WW', 'Tom Brown (Plant Mgr), Lisa Chen (WW Ops)'),
            ('SITE-003', 'UniFirst', 'UniFirst Region 9', '910 Service Way, Newark, NJ', 'WF', 'Dave Wilson (Regional Mgr)'),
            ('SITE-004', 'Alsco', 'Alsco Portland', '2200 River Rd, Portland, OR', 'WW', 'Amy Park (Plant Mgr)'),
        ])
        conn.executemany("INSERT INTO users VALUES (?,?,?,?)", [
            ('USR-001', 'James Carter', 'technician', 'jcarter@wsi.com'),
            ('USR-002', 'Maria Santos', 'technician', 'msantos@wsi.com'),
            ('USR-003', 'Robert Kim', 'reviewer', 'rkim@wsi.com'),
            ('USR-004', 'Patricia Allen', 'admin', 'pallen@wsi.com'),
        ])
        conn.executemany("INSERT INTO visits (visit_id,site_id,consultant_id,visit_date,report_pack,status,entrance_notes,general_observations) VALUES (?,?,?,?,?,?,?,?)", [
            ('VIS-001','SITE-001','USR-001','2026-03-07','WF+WW','in_review',
             'Discussed open action items from last visit. Plant manager noted increased water usage.',
             'Overall plant in good condition. Hot water system running well. Some bleach concentration issues noted.'),
            ('VIS-002','SITE-002','USR-002','2026-03-05','WF','approved',
             'Reviewed wash quality complaints from last month.',
             'Steam tunnel needs attention. Load accuracy has improved since last visit.'),
            ('VIS-003','SITE-003','USR-001','2026-03-09','WF','planned', None, None),
            ('VIS-004','SITE-004','USR-002','2026-03-08','WW','in_progress',
             'Met with Amy Park to review treatment system.',
             'DAF system performing well. Filter press needs maintenance.'),
        ])

        # WF observations for VIS-001
        wf_data = [
            ('VIS-001','plant_ops','hot_water_temp','Hot Water Temperature','148','°F',140,160,None,None),
            ('VIS-001','plant_ops','hardness','Water Hardness','3.2','gpg',None,5,None,None),
            ('VIS-001','plant_ops','iron','Iron Level','0.8','ppm',None,1.0,None,None),
            ('VIS-001','plant_ops','alkalinity','Alkalinity','95','ppm',80,120,None,None),
            ('VIS-001','plant_ops','ph','pH Level','7.2','',6.5,8.5,None,None),
            ('VIS-001','plant_ops','bleach_strength','Bleach Concentration','8.5','%',10,12.5,'low','Below target range - recommend fresh supply'),
            ('VIS-001','kpi','daily_cwt','Daily CWT','2850','lbs',None,None,None,None),
            ('VIS-001','kpi','gallons_per_lb','Gallons/Lb','2.1','gal/lb',None,2.5,None,None),
            ('VIS-001','kpi','therms_per_cwt','Therms/CWT','0.42','therms',None,0.5,None,None),
            ('VIS-001','kpi','chem_cost_cwt','Chemical $/CWT','1.85','$/cwt',None,2.5,None,None),
            ('VIS-001','wash_practices','weighing','Proper Weighing','Yes','',None,None,None,None),
            ('VIS-001','wash_practices','sorting','Proper Sorting','Yes','',None,None,None,None),
            ('VIS-001','wash_practices','formula_select','Formula Selection','Yes','',None,None,None,None),
            ('VIS-001','wash_practices','steam_leaks','Steam Leaks Present','Yes','',None,None,'issue','Minor leak at tunnel junction 3'),
            ('VIS-001','wash_practices','load_accuracy','Load Accuracy','No','',None,None,'issue','Overloading observed on 2 of 5 lines'),
        ]
        conn.executemany("INSERT INTO wf_observations (visit_id,section,field_code,field_label,value,unit,threshold_low,threshold_high,flag,notes) VALUES (?,?,?,?,?,?,?,?,?,?)", wf_data)

        # WW observations for VIS-001
        ww_data = [
            ('VIS-001','treatment','ph_treatment','Treatment pH','8.1','',7.0,9.0,'OK',None),
            ('VIS-001','treatment','ph_discharge','Discharge pH','7.4','',6.0,9.0,'OK','Within permit limits'),
            ('VIS-001','treatment','coagulant_dose','Coagulant Dosage','45','ppm',30,60,'OK',None),
            ('VIS-001','treatment','flocculant_dose','Flocculant Dosage','12','ppm',8,20,'OK',None),
            ('VIS-001','treatment','daf_status','DAF Status',None,None,None,None,'OK','Running within parameters'),
            ('VIS-001','treatment','filter_press','Filter Press',None,None,None,None,'OK','Cakes dry and consistent'),
            ('VIS-001','compliance','target_cost','Target $/1000 gal','4.50','$/1000gal',None,None,None,None),
            ('VIS-001','compliance','actual_cost','Actual $/1000 gal (90-day)','4.85','$/1000gal',None,None,None,'Slightly above target'),
            ('VIS-001','compliance','treatment_pct','Treatment Percentage','94','%',90,100,'OK',None),
            ('VIS-001','training','log_discipline','Log Sheet Discipline',None,None,None,None,'OK','Logs up to date'),
            ('VIS-001','training','operator_training','Operator Training Current',None,None,None,None,'Not OK','New hire needs pH calibration training'),
        ]
        conn.executemany("INSERT INTO ww_observations (visit_id,section,field_code,field_label,value,unit,threshold_low,threshold_high,status,notes) VALUES (?,?,?,?,?,?,?,?,?,?)", ww_data)

        # Action items
        actions = [
            ('ACT-001','VIS-001','plant_ops','Replace bleach supply - concentration below minimum','high','Plant Manager','2026-03-14','open','Current stock at 8.5%, target is 10-12.5%'),
            ('ACT-002','VIS-001','wash_practices','Repair steam leak at tunnel junction 3','medium','Maintenance','2026-03-21','open',None),
            ('ACT-003','VIS-001','wash_practices','Retrain operators on proper load weights - overloading on lines 2 and 4','high','Shift Supervisor','2026-03-14','open',None),
            ('ACT-004','VIS-001','training','Schedule pH calibration training for new operator','medium','Plant Manager','2026-03-21','open',None),
            ('ACT-005','VIS-002','wash_practices','Steam tunnel inspection and maintenance','high','Maintenance','2026-03-12','in_progress','Parts ordered'),
        ]
        conn.executemany("INSERT INTO action_items (action_item_id,visit_id,section_ref,description,severity,owner,due_date,status,comments) VALUES (?,?,?,?,?,?,?,?,?)", actions)

        # Approval events
        conn.executemany("INSERT INTO approval_events (visit_id,stage,actor_id,decision,comment,timestamp) VALUES (?,?,?,?,?,?)", [
            ('VIS-001','submission','USR-001','submit','Ready for review','2026-03-07 16:30:00'),
            ('VIS-002','submission','USR-002','submit',None,'2026-03-05 17:00:00'),
            ('VIS-002','review','USR-003','approve','Good report, ready for customer','2026-03-06 09:15:00'),
        ])
        conn.commit()
    conn.close()


# ── Routes ──────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return send_file(os.path.join(app.static_folder, 'index.html'))


@app.route('/api/dashboard')
def dashboard():
    conn = get_db()
    visits_by_status = dict_rows(conn.execute("SELECT status, COUNT(*) as count FROM visits GROUP BY status").fetchall())
    total = conn.execute("SELECT COUNT(*) FROM visits").fetchone()[0]
    open_actions = conn.execute("SELECT COUNT(*) FROM action_items WHERE status != 'closed'").fetchone()[0]
    critical = conn.execute("SELECT COUNT(*) FROM action_items WHERE severity IN ('high','critical') AND status != 'closed'").fetchone()[0]
    recent = dict_rows(conn.execute("""
        SELECT v.*, s.account_name, s.site_name, u.name as consultant_name
        FROM visits v JOIN sites s ON v.site_id = s.site_id JOIN users u ON v.consultant_id = u.user_id
        ORDER BY v.visit_date DESC LIMIT 10
    """).fetchall())
    conn.close()
    return jsonify(visitsByStatus=visits_by_status, totalVisits=total, openActions=open_actions, criticalActions=critical, recentVisits=recent)


@app.route('/api/sites')
def sites():
    conn = get_db()
    rows = dict_rows(conn.execute("SELECT * FROM sites ORDER BY account_name").fetchall())
    conn.close()
    return jsonify(rows)


@app.route('/api/users')
def users():
    conn = get_db()
    rows = dict_rows(conn.execute("SELECT * FROM users ORDER BY name").fetchall())
    conn.close()
    return jsonify(rows)


@app.route('/api/visits')
def visits_list():
    conn = get_db()
    rows = dict_rows(conn.execute("""
        SELECT v.*, s.account_name, s.site_name, u.name as consultant_name
        FROM visits v JOIN sites s ON v.site_id = s.site_id JOIN users u ON v.consultant_id = u.user_id
        ORDER BY v.visit_date DESC
    """).fetchall())
    conn.close()
    return jsonify(rows)


@app.route('/api/visits/<visit_id>')
def visit_detail(visit_id):
    conn = get_db()
    visit = conn.execute("""
        SELECT v.*, s.account_name, s.site_name, s.address, s.contacts, s.service_lines,
               u.name as consultant_name, u.email as consultant_email
        FROM visits v JOIN sites s ON v.site_id = s.site_id JOIN users u ON v.consultant_id = u.user_id
        WHERE v.visit_id = ?
    """, (visit_id,)).fetchone()
    if not visit:
        conn.close()
        return jsonify(error='Visit not found'), 404

    result = dict(visit)
    result['wfObservations'] = dict_rows(conn.execute("SELECT * FROM wf_observations WHERE visit_id=? ORDER BY section, id", (visit_id,)).fetchall())
    result['wwObservations'] = dict_rows(conn.execute("SELECT * FROM ww_observations WHERE visit_id=? ORDER BY section, id", (visit_id,)).fetchall())
    result['actionItems'] = dict_rows(conn.execute("SELECT * FROM action_items WHERE visit_id=? ORDER BY severity DESC, created_at", (visit_id,)).fetchall())
    result['photos'] = dict_rows(conn.execute("SELECT * FROM attachments WHERE visit_id=? ORDER BY created_at", (visit_id,)).fetchall())
    result['approvals'] = dict_rows(conn.execute("""
        SELECT ae.*, u.name as actor_name FROM approval_events ae JOIN users u ON ae.actor_id = u.user_id
        WHERE ae.visit_id=? ORDER BY ae.timestamp
    """, (visit_id,)).fetchall())
    result['signatures'] = dict_rows(conn.execute("SELECT * FROM signatures WHERE visit_id=? ORDER BY signed_at", (visit_id,)).fetchall())
    conn.close()
    return jsonify(result)


@app.route('/api/visits', methods=['POST'])
def create_visit():
    data = request.json
    vid = f"VIS-{uuid.uuid4().hex[:8].upper()}"
    conn = get_db()
    conn.execute("INSERT INTO visits (visit_id,site_id,consultant_id,visit_date,report_pack) VALUES (?,?,?,?,?)",
                 (vid, data['site_id'], data['consultant_id'], data['visit_date'], data['report_pack']))
    conn.commit()
    conn.close()
    return jsonify(visit_id=vid)


@app.route('/api/visits/<visit_id>', methods=['PUT'])
def update_visit(visit_id):
    data = request.json
    conn = get_db()
    conn.execute("""UPDATE visits SET entrance_notes=?, general_observations=?, exit_notes=?, distribution_list=?, status=?, updated_at=datetime('now') WHERE visit_id=?""",
                 (data.get('entrance_notes'), data.get('general_observations'), data.get('exit_notes'), data.get('distribution_list'), data.get('status'), visit_id))
    conn.commit()
    conn.close()
    return jsonify(success=True)


@app.route('/api/visits/<visit_id>/wf', methods=['POST'])
def save_wf(visit_id):
    data = request.json
    conn = get_db()
    conn.execute("DELETE FROM wf_observations WHERE visit_id=?", (visit_id,))
    for o in data['observations']:
        conn.execute("INSERT INTO wf_observations (visit_id,section,field_code,field_label,value,unit,threshold_low,threshold_high,flag,notes) VALUES (?,?,?,?,?,?,?,?,?,?)",
                     (visit_id, o['section'], o['field_code'], o['field_label'], o.get('value'), o.get('unit'), o.get('threshold_low'), o.get('threshold_high'), o.get('flag'), o.get('notes')))
    conn.commit()
    conn.close()
    return jsonify(success=True)


@app.route('/api/visits/<visit_id>/ww', methods=['POST'])
def save_ww(visit_id):
    data = request.json
    conn = get_db()
    conn.execute("DELETE FROM ww_observations WHERE visit_id=?", (visit_id,))
    for o in data['observations']:
        conn.execute("INSERT INTO ww_observations (visit_id,section,field_code,field_label,value,unit,threshold_low,threshold_high,status,notes) VALUES (?,?,?,?,?,?,?,?,?,?)",
                     (visit_id, o['section'], o['field_code'], o['field_label'], o.get('value'), o.get('unit'), o.get('threshold_low'), o.get('threshold_high'), o.get('status'), o.get('notes')))
    conn.commit()
    conn.close()
    return jsonify(success=True)


@app.route('/api/action-items', methods=['POST'])
def create_action():
    data = request.json
    aid = f"ACT-{uuid.uuid4().hex[:8].upper()}"
    conn = get_db()
    conn.execute("INSERT INTO action_items (action_item_id,visit_id,section_ref,description,severity,owner,due_date) VALUES (?,?,?,?,?,?,?)",
                 (aid, data['visit_id'], data.get('section_ref'), data['description'], data.get('severity','medium'), data.get('owner'), data.get('due_date')))
    conn.commit()
    conn.close()
    return jsonify(action_item_id=aid)


@app.route('/api/action-items/<action_id>', methods=['PUT'])
def update_action(action_id):
    data = request.json
    conn = get_db()
    conn.execute("UPDATE action_items SET status=?, comments=? WHERE action_item_id=?",
                 (data.get('status'), data.get('comments'), action_id))
    conn.commit()
    conn.close()
    return jsonify(success=True)


@app.route('/api/visits/<visit_id>/photos', methods=['POST'])
def upload_photo(visit_id):
    f = request.files.get('photo')
    if not f:
        return jsonify(error='No file'), 400
    fname = f"{int(datetime.now().timestamp())}-{f.filename}"
    fpath = os.path.join(UPLOAD_DIR, fname)
    f.save(fpath)
    att_id = f"ATT-{uuid.uuid4().hex[:8].upper()}"
    conn = get_db()
    conn.execute("INSERT INTO attachments (attachment_id,visit_id,section_ref,file_path,caption) VALUES (?,?,?,?,?)",
                 (att_id, visit_id, request.form.get('section_ref'), f"/uploads/{fname}", request.form.get('caption')))
    conn.commit()
    conn.close()
    return jsonify(attachment_id=att_id, file_path=f"/uploads/{fname}")


@app.route('/api/visits/<visit_id>/workflow', methods=['POST'])
def workflow(visit_id):
    data = request.json
    action = data.get('action')
    conn = get_db()
    visit = conn.execute("SELECT status FROM visits WHERE visit_id=?", (visit_id,)).fetchone()
    if not visit:
        conn.close()
        return jsonify(error='Visit not found'), 404

    current = visit['status']
    transitions = {
        'planned': ('in_progress', 'submit'),
        'in_progress': ('draft_complete', 'submit'),
        'draft_complete': ('in_review', 'submit'),
        'in_review_approve': ('approved', 'approve'),
        'in_review_reject': ('in_progress', 'reject'),
        'approved': ('published', 'publish'),
    }

    key = current
    if current == 'in_review' and action == 'reject':
        key = 'in_review_reject'
    elif current == 'in_review':
        key = 'in_review_approve'

    t = transitions.get(key)
    if not t:
        conn.close()
        return jsonify(error=f'Cannot transition from {current}'), 400

    new_status, decision = t
    conn.execute("UPDATE visits SET status=?, updated_at=datetime('now') WHERE visit_id=?", (new_status, visit_id))
    conn.execute("INSERT INTO approval_events (visit_id,stage,actor_id,decision,comment) VALUES (?,?,?,?,?)",
                 (visit_id, current, data.get('actor_id'), decision, data.get('comment')))
    conn.commit()
    conn.close()
    return jsonify(new_status=new_status)


@app.route('/api/visits/<visit_id>/signatures', methods=['POST'])
def add_signature(visit_id):
    data = request.json
    conn = get_db()
    conn.execute("INSERT INTO signatures (visit_id,signer_name,signer_role,signature_data) VALUES (?,?,?,?)",
                 (visit_id, data['signer_name'], data['signer_role'], data.get('signature_data')))
    conn.commit()
    conn.close()
    return jsonify(success=True)


if __name__ == '__main__':
    init_db()
    print("\n  WSI Field Service Reporting Platform Demo")
    print("  " + "-" * 43)
    print("  Running at http://localhost:3000\n")
    app.run(host='0.0.0.0', port=3000, debug=False)
