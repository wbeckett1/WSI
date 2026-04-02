<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>WSI Landed Cost Optimizer</title>
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
    <link href="~/Content/Site.css" rel="stylesheet" />
</head>
<body>

    <!-- Top Nav -->
    <header class="top-nav">
        <button class="nav-icon-btn" onclick="toggleDrawer()">
            <span class="material-icons">menu</span>
        </button>
        <div class="top-nav-brand">
            <span class="material-icons brand-icon">water_drop</span>
            <span class="brand-text">WSI Landed Cost Optimizer</span>
        </div>
        <div class="top-nav-right">
            <select id="userRole" class="role-switcher" onchange="onRoleChange()">
                <option value="James Carter|Planner">James Carter - Planner</option>
                <option value="Maria Santos|Planner">Maria Santos - Planner</option>
                <option value="Robert Kim|Finance">Robert Kim - Finance</option>
                <option value="Patricia Allen|Ops Manager">Patricia Allen - Ops Manager</option>
            </select>
        </div>
    </header>

    <!-- Side Drawer -->
    <div id="drawerOverlay" class="drawer-overlay" onclick="toggleDrawer()"></div>
    <nav id="sideDrawer" class="side-drawer">
        <div class="drawer-header">
            <span class="material-icons brand-icon">water_drop</span>
            <span>WSI Landed Cost</span>
        </div>
        <a href="#" class="drawer-item active" data-sec="dashboard" onclick="switchSection('dashboard');toggleDrawer();">
            <span class="material-icons">dashboard</span> Dashboard
        </a>
        <a href="#" class="drawer-item" data-sec="orders" onclick="switchSection('orders');toggleDrawer();">
            <span class="material-icons">list_alt</span> Orders
        </a>
        <a href="#" class="drawer-item" data-sec="orderDetail" onclick="switchSection('orderDetail');toggleDrawer();">
            <span class="material-icons">receipt_long</span> Order Detail
        </a>
        <a href="#" class="drawer-item" data-sec="decisions" onclick="switchSection('decisions');toggleDrawer();">
            <span class="material-icons">gavel</span> Decisions
        </a>
        <a href="#" class="drawer-item" data-sec="savings" onclick="switchSection('savings');toggleDrawer();">
            <span class="material-icons">savings</span> Savings
        </a>
        <a href="#" class="drawer-item" data-sec="more" onclick="switchSection('more');toggleDrawer();">
            <span class="material-icons">more_horiz</span> More
        </a>
    </nav>

    <!-- Main Content -->
    <main class="main-content">
        @RenderBody()
    </main>

    <!-- Bottom Nav -->
    <nav class="bottom-nav">
        <button class="bottom-nav-btn active" data-sec="dashboard" onclick="switchSection('dashboard')">
            <span class="material-icons">dashboard</span>
            <span class="bottom-nav-label">Dashboard</span>
        </button>
        <button class="bottom-nav-btn" data-sec="orders" onclick="switchSection('orders')">
            <span class="material-icons">list_alt</span>
            <span class="bottom-nav-label">Orders</span>
        </button>
        <button class="bottom-nav-btn" data-sec="decisions" onclick="switchSection('decisions')">
            <span class="material-icons">gavel</span>
            <span class="bottom-nav-label">Decisions</span>
        </button>
        <button class="bottom-nav-btn" data-sec="savings" onclick="switchSection('savings')">
            <span class="material-icons">savings</span>
            <span class="bottom-nav-label">Savings</span>
        </button>
        <button class="bottom-nav-btn" data-sec="more" onclick="switchSection('more')">
            <span class="material-icons">more_horiz</span>
            <span class="bottom-nav-label">More</span>
        </button>
    </nav>

    <!-- Approval Modal -->
    <div id="approvalModal" class="modal-overlay" style="display:none;">
        <div class="modal-card">
            <div class="modal-header">
                <h3 id="modalTitle">Approve Recommendation</h3>
                <button class="modal-close" onclick="closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <input type="hidden" id="modalOrderId" />
                <input type="hidden" id="modalRank" />
                <input type="hidden" id="modalIsOverride" value="false" />
                <div class="form-group">
                    <label>Approver</label>
                    <input type="text" id="modalApprover" class="form-input" readonly />
                </div>
                <div class="form-group">
                    <label>Role</label>
                    <input type="text" id="modalRole" class="form-input" readonly />
                </div>
                <div class="form-group">
                    <label>Reason Code</label>
                    <select id="modalReasonCode" class="form-input">
                        <option value="COST_SAVINGS">Cost Savings</option>
                        <option value="BASELINE_OPTIMAL">Baseline Optimal</option>
                        <option value="SERVICE_LEVEL">Service Level Priority</option>
                        <option value="CAPACITY_CONSTRAINT">Capacity Constraint</option>
                        <option value="CUSTOMER_PREFERENCE">Customer Preference</option>
                    </select>
                </div>
                <div id="overrideFields" style="display:none;">
                    <div class="form-group">
                        <label>Override Comment</label>
                        <textarea id="modalOverrideComment" class="form-input" rows="3" placeholder="Explain why you are overriding the recommendation..."></textarea>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="submitApproval()">Confirm</button>
            </div>
        </div>
    </div>

    <script src="https://ajax.aspnetcdn.com/ajax/jQuery/jquery-3.7.1.min.js"></script>
    <script src="~/Scripts/app.js"></script>
</body>
</html>
