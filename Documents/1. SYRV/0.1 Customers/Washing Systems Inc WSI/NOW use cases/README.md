# WSI Wash-Eye Cloud - Demo Applications

Two production-ready demo applications built on the **WSI Wash-Eye Cloud** technology stack, showcasing real-world use cases for Washing Systems, Inc.

| Component | Technology |
|-----------|------------|
| **Language** | VB.NET |
| **Framework** | .NET Framework 4.8 |
| **Web Framework** | ASP.NET MVC 5 |
| **Client Script** | jQuery 3.7.1 |
| **Styling** | Custom CSS (no frameworks) |
| **Database** | Microsoft SQL Server |
| **Data Access** | ADO.NET (SqlConnection, SqlCommand, SqlDataReader) |
| **Third-Party Libraries** | None |
| **Authentication** | None (planned for future integration) |

---

## Repository Contents

```
WSILandedCost/                    Landed Cost Optimizer application
  Database/Schema.sql             SQL Server schema + seed data
  WSILandedCost.sln               Visual Studio solution
  WSILandedCost/                  ASP.NET MVC project
    Controllers/                  MVC controllers (VB.NET)
    Models/                       POCO model classes
    Views/                        Razor .vbhtml views
    Helpers/                      ADO.NET data access helper
    Scripts/                      jQuery application logic
    Content/                      CSS stylesheets

WSIFieldService/                  Field Service Platform application
  Database/Schema.sql             SQL Server schema + seed data
  WSIFieldService.sln             Visual Studio solution
  WSIFieldService/                ASP.NET MVC project
    Controllers/                  MVC controllers (VB.NET)
    Models/                       POCO model classes
    Views/                        Razor .vbhtml views
    Helpers/                      ADO.NET data access helper
    Scripts/                      jQuery application logic
    Content/                      CSS stylesheets
    Uploads/                      Photo attachment storage

SETUP_INSTRUCTIONS.md             Quick-reference setup guide
```

---

## Application 1: WSI Landed Cost Optimizer

An advisory sidecar system that evaluates and ranks the best source, routing, and currency options for each customer order to minimize total landed cost.

### What It Does

- Ingests customer orders with line items (SKUs, quantities, ship-to locations)
- Evaluates all source facilities against customer-specific hard constraints (approved sources, capacity, lead time)
- Calculates full landed cost per source: product cost + blending + packaging + inbound/outbound freight + accessorials + duties + FX impact
- Ranks feasible options by total landed cost and computes savings vs. the baseline source
- Supports approval and override workflows with audit trail
- Tracks theoretical vs. realized savings with finance validation status
- Provides FX and freight sensitivity scenario analysis

### Database Schema (10 Tables)

| Table | Purpose |
|-------|---------|
| **Orders** | Order headers with customer, ship-to, dates, baseline source, status lifecycle |
| **OrderLines** | Line items per order (SKU, quantity, UOM, pack type, hazmat flag) |
| **SourceOptions** | 5 blending/distribution facilities with cost structures and capacity |
| **LaneRates** | Freight rates by origin/destination/carrier/mode with accessorials |
| **CustomerRules** | Hard and soft constraints per customer (approved sources, service windows, carrier restrictions) |
| **FxRates** | Currency exchange rates (USD to CAD, MXN, EUR) |
| **Recommendations** | Ranked landed cost options per order with full cost breakdown |
| **Decisions** | Approval/override records with approver, role, reason codes, threshold class |
| **SavingsLedger** | Theoretical vs. realized savings tracking per order |
| **Issues** | Operational issues backlog (data quality, process, enhancement) |

### Controller Actions (13 Endpoints)

| Action | Method | Description |
|--------|--------|-------------|
| `GetOrders` | GET | List all orders with line summaries and quantities |
| `GetOrderDetail` | GET | Full order detail with lines, recommendations, decision, savings, rules |
| `Evaluate` | POST | Run the landed cost optimization engine for an order |
| `Approve` | POST | Record an approval or override decision, create savings ledger entry |
| `GetDashboard` | GET | KPI summary (orders, evaluation rate, savings totals, acceptance rate) |
| `GetSavings` | GET | Savings ledger with customer context |
| `GetSources` | GET | All source facility reference data |
| `GetRules` | GET | All customer constraint rules |
| `GetRates` | GET | All freight lane rates |
| `GetFx` | GET | All currency exchange rates |
| `GetIssues` | GET | All operational issues |
| `GetDecisions` | GET | Decision audit trail with order and recommendation context |
| `RunScenario` | POST | FX/freight sensitivity analysis on existing recommendations |

### Demo Seed Data

- **5 Source Facilities**: Dayton OH, Houston TX, Philadelphia PA, Atlanta GA, Chicago IL
- **5 Customer Locations**: Cintas (Aston PA, Louisville KY), Alsco (Alexandria VA, Nashville TN), UniFirst (Owensboro KY)
- **25 Lane Rates**: Full origin-to-destination freight matrix
- **8 Orders**: 5 in "ready" status awaiting evaluation, 3 in later lifecycle stages with savings data
- **6 Customer Rules**: Approved source lists, service windows, carrier restrictions, split policies
- **3 FX Rates**: USD to CAD, MXN, EUR
- **4 Issues**: Data quality, process, and enhancement backlog items

---

## Application 2: WSI Field Service Reporting Platform

A tablet-first web platform for field service technicians to document wash floor and wastewater observations during site visits, flag issues, track action items, and route reports through a multi-stage approval workflow.

### What It Does

- Manages the full visit lifecycle: Planned > In Progress > Draft Complete > In Review > Approved > Published
- Captures wash floor (WF) observations: plant operations (temperature, hardness, pH, bleach concentration), KPIs (daily CWT, gallons/lb, chemical cost), wash practices (weighing, sorting, steam leaks, load accuracy)
- Captures wastewater (WW) observations: treatment system (pH, coagulant/flocculant dosage, DAF/filter press status), compliance (cost metrics, treatment percentage), training (log discipline, operator certification)
- Flags out-of-range values against configurable thresholds
- Manages action items with severity levels (low/medium/high/critical) and owner tracking
- Supports photo evidence upload with captions
- Canvas-based signature capture for visit sign-off
- Complete audit trail of all workflow transitions
- PDF-style report preview for customer distribution
- Multi-role demo: switch between Technician, Reviewer, and Admin perspectives

### Database Schema (9 Tables)

| Table | Purpose |
|-------|---------|
| **Sites** | Service locations with account name, address, service lines, contacts |
| **Users** | Team members with role assignments (technician, reviewer, admin) |
| **Visits** | Visit records with lifecycle status, notes, and report pack type |
| **WfObservations** | Wash floor measurements with thresholds, flags, and notes |
| **WwObservations** | Wastewater measurements with status indicators and notes |
| **ActionItems** | Follow-up tasks with severity, owner, due date, and status |
| **Attachments** | Photo/document files with captions and section references |
| **ApprovalEvents** | Workflow audit trail (submit, approve, reject, publish) |
| **Signatures** | Electronic signature records with signer name, role, and canvas data |

### Controller Actions (16 Endpoints)

| Action | Method | Description |
|--------|--------|-------------|
| `GetDashboard` | GET | Visit status counts, open/critical actions, recent visits |
| `GetSites` | GET | All service sites |
| `GetUsers` | GET | All team members |
| `GetVisits` | GET | All visits with site and consultant details |
| `GetVisitDetail` | GET | Full visit with observations, actions, photos, approvals, signatures |
| `CreateVisit` | POST | Create a new service visit |
| `UpdateVisit` | POST | Update visit notes and status |
| `SaveWfObservations` | POST | Bulk save wash floor observations |
| `SaveWwObservations` | POST | Bulk save wastewater observations |
| `CreateActionItem` | POST | Create a new action item |
| `UpdateActionItem` | POST | Update action item status and comments |
| `UploadPhoto` | POST | Upload photo attachment with caption |
| `DoWorkflow` | POST | Transition visit through approval workflow |
| `SaveSignature` | POST | Record an electronic signature |
| `GetAudit` | GET | Approval event timeline for a visit |
| `GetAllActionItems` | GET | All action items across all visits |

### Workflow State Machine

```
planned --> in_progress --> draft_complete --> in_review --> approved --> published
                                                  |
                                                  +--> in_progress (rejected)
```

### Demo Seed Data

- **4 Sites**: Alsco Alexandria VA, Cintas Aston PA, UniFirst Region 9 NJ, Alsco Portland OR
- **4 Users**: 2 Technicians (James Carter, Maria Santos), 1 Reviewer (Robert Kim), 1 Admin (Patricia Allen)
- **4 Visits**: In Review (WF+WW), Approved (WF), Planned (WF), In Progress (WW)
- **15 WF Observations**: Plant operations, KPIs, wash practices for visit VIS-001
- **11 WW Observations**: Treatment, compliance, training for visit VIS-001
- **5 Action Items**: Bleach replacement, steam leak repair, operator training, pH calibration, tunnel inspection
- **3 Approval Events**: Two submissions, one reviewer approval

---

## Deployment Guide

### Prerequisites

| Requirement | Details |
|-------------|---------|
| **Visual Studio** | 2019 or 2022 (Community edition works) with "ASP.NET and web development" workload |
| **.NET Framework** | 4.8 targeting pack (install via Visual Studio Installer > Individual Components) |
| **SQL Server** | Express, Developer, Standard, or Enterprise edition |
| **SSMS** | SQL Server Management Studio (or any SQL client like Azure Data Studio) |

### Step 1: Clone the Repository

```
git clone https://github.com/wbeckett1/WSI.git
cd WSI
```

### Step 2: Create the Databases

**Landed Cost Optimizer:**

1. Open SQL Server Management Studio
2. Connect to your SQL Server instance
3. Open `WSILandedCost/Database/Schema.sql`
4. Execute the script (F5)
   - Creates the `WSILandedCost` database
   - Creates 10 tables
   - Inserts all demo seed data

**Field Service Platform:**

1. Open `WSIFieldService/Database/Schema.sql`
2. Execute the script (F5)
   - Creates the `WSIFieldService` database
   - Creates 9 tables
   - Inserts all demo seed data

### Step 3: Configure Connection Strings

Each application's `Web.config` contains a connection string that defaults to SQL Server Express with Windows Authentication:

**WSILandedCost/WSILandedCost/Web.config:**
```xml
<add name="WSILandedCostDb"
     connectionString="Server=.\SQLEXPRESS;Database=WSILandedCost;Trusted_Connection=True;"
     providerName="System.Data.SqlClient" />
```

**WSIFieldService/WSIFieldService/Web.config:**
```xml
<add name="WSIFieldServiceDb"
     connectionString="Server=.\SQLEXPRESS;Database=WSIFieldService;Trusted_Connection=True;"
     providerName="System.Data.SqlClient" />
```

Update the `Server=` value if your SQL Server instance name differs:

| Scenario | Server Value |
|----------|-------------|
| SQL Express (default) | `.\SQLEXPRESS` |
| Default instance | `.` or `localhost` |
| Named instance | `SERVERNAME\INSTANCENAME` |
| LocalDB | `(localdb)\MSSQLLocalDB` |
| Remote server | `192.168.1.100` or `sql.company.com` |
| SQL Authentication | Add `User Id=myuser;Password=mypass;` and remove `Trusted_Connection=True;` |

### Step 4: Restore NuGet Packages

Each solution requires these standard ASP.NET MVC packages (no third-party libraries):

- `Microsoft.AspNet.Mvc` 5.2.9
- `Microsoft.AspNet.Razor` 3.2.9
- `Microsoft.AspNet.WebPages` 3.2.9

In Visual Studio: right-click the solution in Solution Explorer > **Restore NuGet Packages**.

Alternatively, from the Package Manager Console:
```
Install-Package Microsoft.AspNet.Mvc -Version 5.2.9
```

### Step 5: Build and Run

1. Open the `.sln` file in Visual Studio
2. Set the web project as the startup project (right-click > **Set as Startup Project**)
3. Build the solution: **Build > Build Solution** (Ctrl+Shift+B)
4. Run: **Debug > Start Debugging** (F5)
5. The application will launch in your default browser via IIS Express

### Deploying to IIS (Production)

1. **Publish** from Visual Studio: right-click the project > **Publish** > choose **Folder** or **IIS** target
2. In IIS Manager:
   - Create a new Application Pool targeting **.NET CLR v4.0** in **Integrated** pipeline mode
   - Create a new Site or Application pointing to the published folder
   - Ensure the App Pool identity has `db_datareader` and `db_datawriter` permissions on the SQL Server database
3. For the Field Service Platform, grant the App Pool identity **write permission** on the `Uploads` folder

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **Build error: Cannot find System.Web.Mvc** | Restore NuGet packages (right-click solution > Restore NuGet Packages) |
| **SQL connection refused** | Verify SQL Server service is running, check instance name in connection string, ensure Windows Firewall allows SQL Server port (1433) |
| **Login failed for user** | If using Windows Auth, ensure the IIS App Pool identity or your Windows account has database access. If using SQL Auth, verify credentials. |
| **STRING_AGG not recognized** | STRING_AGG requires SQL Server 2017+. If running an older version, the Landed Cost schema script will need the query modified to use `FOR XML PATH` instead. |
| **Photo upload fails** | Ensure the `Uploads` folder exists under the Field Service project root and the application has write permissions |
| **Blank page on load** | Check browser console (F12) for JavaScript errors. Verify the jQuery CDN is accessible from your network. |
