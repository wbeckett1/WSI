@Code
    ViewData("Title") = "WSI Field Service"
End Code

<!-- ============================================================ -->
<!-- PAGE: Dashboard                                               -->
<!-- ============================================================ -->
<section class="page active" id="pageDashboard">
    <div class="page-header">
        <h1>Dashboard</h1>
        <p class="subtitle">Field Service Overview</p>
    </div>

    <div class="kpi-grid" id="dashKpis">
        <div class="kpi-card">
            <div class="kpi-icon"><i class="material-icons">assignment</i></div>
            <div class="kpi-value" id="kpiTotal">--</div>
            <div class="kpi-label">Total Visits</div>
        </div>
        <div class="kpi-card kpi-warning">
            <div class="kpi-icon"><i class="material-icons">rate_review</i></div>
            <div class="kpi-value" id="kpiReview">--</div>
            <div class="kpi-label">Awaiting Review</div>
        </div>
        <div class="kpi-card kpi-danger">
            <div class="kpi-icon"><i class="material-icons">priority_high</i></div>
            <div class="kpi-value" id="kpiActions">--</div>
            <div class="kpi-label">Open Actions</div>
        </div>
        <div class="kpi-card kpi-success">
            <div class="kpi-icon"><i class="material-icons">published_with_changes</i></div>
            <div class="kpi-value" id="kpiPublished">--</div>
            <div class="kpi-label">Published</div>
        </div>
    </div>

    <div class="two-col">
        <div class="card">
            <div class="card-header">
                <h3>Recent Visits</h3>
            </div>
            <div class="card-body" id="dashRecentVisits">
                <div class="loading-spinner"></div>
            </div>
        </div>
        <div class="card">
            <div class="card-header">
                <h3>Priority Actions</h3>
            </div>
            <div class="card-body" id="dashPriorityActions">
                <div class="loading-spinner"></div>
            </div>
        </div>
    </div>
</section>

<!-- ============================================================ -->
<!-- PAGE: Visits List                                             -->
<!-- ============================================================ -->
<section class="page" id="pageVisits">
    <div class="page-header">
        <h1>Visits</h1>
        <p class="subtitle">All field service visits</p>
    </div>

    <div class="filter-chips" id="visitFilters">
        <button class="chip active" data-filter="all">All</button>
        <button class="chip" data-filter="planned">Planned</button>
        <button class="chip" data-filter="in_progress">In Progress</button>
        <button class="chip" data-filter="draft_complete">Draft Complete</button>
        <button class="chip" data-filter="in_review">In Review</button>
        <button class="chip" data-filter="approved">Approved</button>
        <button class="chip" data-filter="published">Published</button>
    </div>

    <div class="visits-list" id="visitsList">
        <div class="loading-spinner"></div>
    </div>
</section>

<!-- ============================================================ -->
<!-- PAGE: New Visit                                               -->
<!-- ============================================================ -->
<section class="page" id="pageNewVisit">
    <div class="page-header">
        <h1>New Visit</h1>
        <p class="subtitle">Schedule a new field service visit</p>
    </div>

    <div class="card">
        <div class="card-body">
            <form id="newVisitForm">
                <div class="form-group">
                    <label for="nvSite">Site</label>
                    <select id="nvSite" class="form-control" required>
                        <option value="">Select a site...</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="nvConsultant">Consultant</label>
                    <select id="nvConsultant" class="form-control" required>
                        <option value="">Select a consultant...</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="nvDate">Visit Date</label>
                    <input type="date" id="nvDate" class="form-control" required />
                </div>
                <div class="form-group">
                    <label for="nvPack">Report Pack</label>
                    <select id="nvPack" class="form-control" required>
                        <option value="">Select report type...</option>
                        <option value="WF">Wash Floor (WF)</option>
                        <option value="WW">Wastewater (WW)</option>
                        <option value="WF+WW">Wash Floor + Wastewater (WF+WW)</option>
                    </select>
                </div>
                <button type="submit" class="btn btn-primary btn-lg">
                    <i class="material-icons">add_circle</i> Create Visit
                </button>
            </form>
        </div>
    </div>
</section>

<!-- ============================================================ -->
<!-- PAGE: All Action Items                                        -->
<!-- ============================================================ -->
<section class="page" id="pageActions">
    <div class="page-header">
        <h1>Action Items</h1>
        <p class="subtitle">All action items across visits</p>
    </div>

    <div class="actions-list" id="allActionsList">
        <div class="loading-spinner"></div>
    </div>
</section>

<!-- ============================================================ -->
<!-- PAGE: Visit Detail                                            -->
<!-- ============================================================ -->
<section class="page" id="pageDetail">
    <div class="detail-header">
        <button class="btn btn-back" id="btnBack">
            <i class="material-icons">arrow_back</i> Back
        </button>
        <div class="detail-title">
            <h1 id="detailTitle">Visit Detail</h1>
            <span class="status-badge" id="detailStatus"></span>
        </div>
        <div class="detail-actions" id="detailWorkflowBtns"></div>
    </div>

    <!-- Workflow Stepper -->
    <div class="stepper" id="workflowStepper">
        <div class="step" data-step="planned"><span class="step-dot"></span><span class="step-label">Planned</span></div>
        <div class="step-line"></div>
        <div class="step" data-step="in_progress"><span class="step-dot"></span><span class="step-label">In Progress</span></div>
        <div class="step-line"></div>
        <div class="step" data-step="draft_complete"><span class="step-dot"></span><span class="step-label">Draft Complete</span></div>
        <div class="step-line"></div>
        <div class="step" data-step="in_review"><span class="step-dot"></span><span class="step-label">In Review</span></div>
        <div class="step-line"></div>
        <div class="step" data-step="approved"><span class="step-dot"></span><span class="step-label">Approved</span></div>
        <div class="step-line"></div>
        <div class="step" data-step="published"><span class="step-dot"></span><span class="step-label">Published</span></div>
    </div>

    <!-- Tabs -->
    <div class="detail-tabs" id="detailTabs">
        <button class="detail-tab active" data-tab="summary"><i class="material-icons">info</i> Summary</button>
        <button class="detail-tab" data-tab="wf"><i class="material-icons">local_laundry_service</i> Wash Floor</button>
        <button class="detail-tab" data-tab="ww"><i class="material-icons">water</i> Wastewater</button>
        <button class="detail-tab" data-tab="actionsTab"><i class="material-icons">flag</i> Actions</button>
        <button class="detail-tab" data-tab="photos"><i class="material-icons">photo_camera</i> Photos</button>
        <button class="detail-tab" data-tab="signatures"><i class="material-icons">draw</i> Signatures</button>
        <button class="detail-tab" data-tab="audit"><i class="material-icons">history</i> Audit</button>
    </div>

    <!-- Tab Content: Summary -->
    <div class="tab-pane active" id="tabSummary">
        <div class="card">
            <div class="card-header"><h3>Site Details</h3></div>
            <div class="card-body">
                <div class="readonly-grid" id="siteDetails"></div>
            </div>
        </div>
        <div class="card">
            <div class="card-header"><h3>Visit Notes</h3></div>
            <div class="card-body" id="visitNotesContainer"></div>
        </div>
    </div>

    <!-- Tab Content: Wash Floor -->
    <div class="tab-pane" id="tabWf">
        <div id="wfContent">
            <div class="loading-spinner"></div>
        </div>
    </div>

    <!-- Tab Content: Wastewater -->
    <div class="tab-pane" id="tabWw">
        <div id="wwContent">
            <div class="loading-spinner"></div>
        </div>
    </div>

    <!-- Tab Content: Actions -->
    <div class="tab-pane" id="tabActionsTab">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;padding:0 0 12px 0;">
            <h3>Action Items</h3>
            <button class="btn btn-primary btn-sm" id="btnAddAction">
                <i class="material-icons">add</i> Add Action
            </button>
        </div>
        <div id="visitActionsList"></div>
    </div>

    <!-- Tab Content: Photos -->
    <div class="tab-pane" id="tabPhotos">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;padding:0 0 12px 0;">
            <h3>Photos</h3>
            <button class="btn btn-primary btn-sm" id="btnUploadPhoto">
                <i class="material-icons">add_a_photo</i> Upload Photo
            </button>
        </div>
        <div class="photo-grid" id="photoGrid"></div>
    </div>

    <!-- Tab Content: Signatures -->
    <div class="tab-pane" id="tabSignatures">
        <div class="card">
            <div class="card-header"><h3>Signatures</h3></div>
            <div class="card-body">
                <div id="signaturesList"></div>
                <div class="sig-capture" id="sigCapture">
                    <h4>Add Signature</h4>
                    <div class="form-group">
                        <label for="sigName">Name</label>
                        <input type="text" id="sigName" class="form-control" placeholder="Signer name" />
                    </div>
                    <div class="form-group">
                        <label for="sigRole">Role</label>
                        <input type="text" id="sigRole" class="form-control" placeholder="e.g. Plant Manager" />
                    </div>
                    <div class="sig-canvas-wrap">
                        <canvas id="sigCanvas" width="400" height="150"></canvas>
                    </div>
                    <div class="sig-buttons">
                        <button class="btn btn-secondary btn-sm" id="btnClearSig">Clear</button>
                        <button class="btn btn-primary btn-sm" id="btnSaveSig">Save Signature</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Tab Content: Audit -->
    <div class="tab-pane" id="tabAudit">
        <div class="card">
            <div class="card-header"><h3>Approval Timeline</h3></div>
            <div class="card-body">
                <div class="audit-timeline" id="auditTimeline"></div>
            </div>
        </div>
    </div>
</section>
