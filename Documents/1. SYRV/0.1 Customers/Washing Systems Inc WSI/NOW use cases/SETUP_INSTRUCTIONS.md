# WSI Wash-Eye Cloud Demo Applications - Setup Instructions

Both demo applications are built on the WSI Wash-Eye Cloud technology stack:
**VB.NET 4.8 + ASP.NET MVC 5 + jQuery + CSS + SQL Server + ADO.NET**

---

## Prerequisites

1. **Visual Studio 2019 or 2022** (Community, Professional, or Enterprise)
   - Workload: "ASP.NET and web development"
   - Individual Component: ".NET Framework 4.8 targeting pack"
2. **SQL Server Express** (or any SQL Server edition)
   - Default instance `.\SQLEXPRESS` is configured in Web.config
   - If your instance name differs, update the connection string in `Web.config`
3. **SQL Server Management Studio (SSMS)** or equivalent SQL client

---

## Project 1: WSI Landed Cost Optimizer

**Location:** `WSILandedCost/`

### Database Setup

1. Open SSMS and connect to your SQL Server instance
2. Open and execute `WSILandedCost/Database/Schema.sql`
   - This creates the `WSILandedCost` database
   - Creates 10 tables (Orders, OrderLines, SourceOptions, LaneRates, CustomerRules, FxRates, Recommendations, Decisions, SavingsLedger, Issues)
   - Seeds demo data: 5 source facilities, 25 lane rates, 8 orders, customer rules, FX rates, and issues

### Application Setup

1. Open `WSILandedCost/WSILandedCost.sln` in Visual Studio
2. If prompted, restore NuGet packages:
   - `Microsoft.AspNet.Mvc` 5.2.9
   - `Microsoft.AspNet.Razor` 3.2.9
   - `Microsoft.AspNet.WebPages` 3.2.9
3. Verify the connection string in `WSILandedCost/WSILandedCost/Web.config`:
   ```xml
   <add name="WSILandedCostDb"
        connectionString="Server=.\SQLEXPRESS;Database=WSILandedCost;Trusted_Connection=True;"
        providerName="System.Data.SqlClient" />
   ```
   Update `Server=` if your SQL Server instance name differs.
4. Build the solution (Ctrl+Shift+B)
5. Press F5 to run in IIS Express
6. The application opens at `http://localhost:xxxxx/`

### Features to Demo

- **Dashboard** - KPI tiles showing pilot performance metrics
- **Orders** - Click "Evaluate" on any "Ready" order to run the landed cost optimization
- **Order Detail** - View ranked source recommendations with cost breakdowns
- **Approve/Override** - Accept the optimal recommendation or override with justification
- **Scenario Analysis** - Adjust freight/FX shift percentages to see cost sensitivity
- **Decisions** - Audit trail of all approvals and overrides
- **Savings Ledger** - Track theoretical vs realized savings
- **More** - Browse reference data (constraints, sources, lanes, FX, issues)

---

## Project 2: WSI Field Service Reporting Platform

**Location:** `WSIFieldService/`

### Database Setup

1. Open SSMS and connect to your SQL Server instance
2. Open and execute `WSIFieldService/Database/Schema.sql`
   - This creates the `WSIFieldService` database
   - Creates 9 tables (Sites, Users, Visits, WfObservations, WwObservations, ActionItems, Attachments, ApprovalEvents, Signatures)
   - Seeds demo data: 4 sites, 4 users, 4 visits with observations, action items, and approval events

### Application Setup

1. Open `WSIFieldService/WSIFieldService.sln` in Visual Studio
2. If prompted, restore NuGet packages (same as above)
3. Verify the connection string in `WSIFieldService/WSIFieldService/Web.config`:
   ```xml
   <add name="WSIFieldServiceDb"
        connectionString="Server=.\SQLEXPRESS;Database=WSIFieldService;Trusted_Connection=True;"
        providerName="System.Data.SqlClient" />
   ```
4. Build the solution (Ctrl+Shift+B)
5. Press F5 to run in IIS Express
6. The application opens at `http://localhost:xxxxx/`

### Features to Demo

- **Dashboard** - Visit status overview, priority action items
- **Visits** - Filter by status, click to view details
- **New Visit** - Create a new service visit for any site
- **Visit Detail** - Full tabbed interface:
  - **Summary** - Site details and editable visit notes
  - **Wash Floor** - Plant operations, KPIs, wash practices with threshold monitoring
  - **Wastewater** - Treatment system audit, compliance, training status
  - **Actions** - Create and manage follow-up action items with severity levels
  - **Photos** - Upload evidence photos with captions
  - **Signatures** - Canvas-based signature capture
  - **Audit** - Complete workflow event timeline
- **Workflow** - Progress visits through: Planned > In Progress > Draft Complete > In Review > Approved > Published
- **Role Switching** - Click the user pill in the top bar to switch between Technician, Reviewer, and Admin perspectives

---

## Connection String Configuration

Both applications default to `.\SQLEXPRESS` with Windows Authentication. Common alternatives:

| Scenario | Connection String |
|----------|-------------------|
| Default SQL Express | `Server=.\SQLEXPRESS;Database=WSILandedCost;Trusted_Connection=True;` |
| Named instance | `Server=MYSERVER\MYINSTANCE;Database=WSILandedCost;Trusted_Connection=True;` |
| SQL Authentication | `Server=.\SQLEXPRESS;Database=WSILandedCost;User Id=sa;Password=YourPassword;` |
| LocalDB | `Server=(localdb)\MSSQLLocalDB;Database=WSILandedCost;Trusted_Connection=True;` |

---

## Technology Stack Reference

| Component | Technology |
|-----------|------------|
| Language | VB.NET |
| Framework | .NET Framework 4.8 |
| Web Framework | ASP.NET MVC 5 |
| Client Script | jQuery 3.7.1 |
| Styling | Custom CSS |
| Database | Microsoft SQL Server |
| Data Access | ADO.NET (SqlConnection, SqlCommand, SqlDataReader) |
| Third-Party | None |
| Authentication | None (to be integrated later) |
