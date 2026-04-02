<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>WSI Field Service</title>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" />
    <link rel="stylesheet" href="~/Content/Site.css" />
</head>
<body>
    <!-- Top Bar -->
    <header class="top-bar">
        <div class="top-bar-left">
            <button class="menu-btn" id="menuBtn" aria-label="Menu">
                <i class="material-icons">menu</i>
            </button>
            <div class="brand">
                <i class="material-icons brand-icon">water_drop</i>
                <span class="brand-text">WSI Field Service</span>
            </div>
        </div>
        <div class="top-bar-right">
            <div class="user-switcher" id="userSwitcher">
                <span class="user-avatar" id="userAvatar">JC</span>
                <span class="user-name" id="userName">James Carter</span>
                <i class="material-icons">expand_more</i>
            </div>
            <div class="user-dropdown" id="userDropdown">
                <div class="user-option" data-user-id="USR-001" data-user-name="James Carter" data-user-role="technician">
                    <span class="user-avatar-sm">JC</span>
                    <div><strong>James Carter</strong><br /><small>Technician</small></div>
                </div>
                <div class="user-option" data-user-id="USR-002" data-user-name="Maria Santos" data-user-role="technician">
                    <span class="user-avatar-sm">MS</span>
                    <div><strong>Maria Santos</strong><br /><small>Technician</small></div>
                </div>
                <div class="user-option" data-user-id="USR-003" data-user-name="Robert Kim" data-user-role="reviewer">
                    <span class="user-avatar-sm">RK</span>
                    <div><strong>Robert Kim</strong><br /><small>Reviewer</small></div>
                </div>
                <div class="user-option" data-user-id="USR-004" data-user-name="Patricia Allen" data-user-role="admin">
                    <span class="user-avatar-sm">PA</span>
                    <div><strong>Patricia Allen</strong><br /><small>Admin</small></div>
                </div>
            </div>
        </div>
    </header>

    <!-- Side Drawer -->
    <div class="drawer-overlay" id="drawerOverlay"></div>
    <nav class="side-drawer" id="sideDrawer">
        <div class="drawer-header">
            <i class="material-icons brand-icon">water_drop</i>
            <span>WSI Field Service</span>
        </div>
        <a class="drawer-item active" data-page="dashboard"><i class="material-icons">dashboard</i> Dashboard</a>
        <a class="drawer-item" data-page="visits"><i class="material-icons">assignment</i> Visits</a>
        <a class="drawer-item" data-page="newVisit"><i class="material-icons">add_circle</i> New Visit</a>
        <a class="drawer-item" data-page="actions"><i class="material-icons">flag</i> Action Items</a>
        <div class="drawer-divider"></div>
        <div class="drawer-footer">
            <small>Washing Systems Inc.</small><br />
            <small class="text-muted">Field Service Platform v1.0</small>
        </div>
    </nav>

    <!-- Main Content -->
    <main class="main-content">
        @RenderBody()
    </main>

    <!-- Bottom Tab Navigation -->
    <nav class="bottom-tabs">
        <button class="tab-btn active" data-page="dashboard">
            <i class="material-icons">dashboard</i>
            <span>Dashboard</span>
        </button>
        <button class="tab-btn" data-page="visits">
            <i class="material-icons">assignment</i>
            <span>Visits</span>
        </button>
        <button class="tab-btn" data-page="newVisit">
            <i class="material-icons">add_circle</i>
            <span>New</span>
        </button>
        <button class="tab-btn" data-page="actions">
            <i class="material-icons">flag</i>
            <span>Actions</span>
        </button>
    </nav>

    <!-- Toast container -->
    <div id="toastContainer"></div>

    <!-- Modals -->
    <div class="modal-overlay" id="modalOverlay">
        <div class="modal-content" id="modalContent"></div>
    </div>

    <script src="https://ajax.aspnetcdn.com/ajax/jQuery/jquery-3.7.1.min.js"></script>
    <script src="~/Scripts/app.js"></script>
</body>
</html>
