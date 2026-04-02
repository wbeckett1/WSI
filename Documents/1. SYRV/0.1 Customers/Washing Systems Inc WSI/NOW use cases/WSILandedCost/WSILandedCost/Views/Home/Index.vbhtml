@Code
    ViewData("Title") = "WSI Landed Cost Optimizer"
End Code

<!-- ============================================ -->
<!-- DASHBOARD SECTION                            -->
<!-- ============================================ -->
<section id="sec-dashboard" class="section active">
    <h2 class="section-title">Pilot Dashboard</h2>
    <div id="kpiTiles" class="kpi-grid">
        <div class="kpi-tile">
            <span class="material-icons kpi-icon">inventory_2</span>
            <div class="kpi-value" id="kpiTotalOrders">--</div>
            <div class="kpi-label">Pilot Orders</div>
        </div>
        <div class="kpi-tile kpi-green">
            <span class="material-icons kpi-icon">trending_down</span>
            <div class="kpi-value" id="kpiTheoSavings">--</div>
            <div class="kpi-label">Theoretical Savings</div>
        </div>
        <div class="kpi-tile kpi-blue">
            <span class="material-icons kpi-icon">account_balance</span>
            <div class="kpi-value" id="kpiRealSavings">--</div>
            <div class="kpi-label">Realized Savings</div>
        </div>
        <div class="kpi-tile">
            <span class="material-icons kpi-icon">check_circle</span>
            <div class="kpi-value" id="kpiAcceptRate">--</div>
            <div class="kpi-label">Acceptance Rate</div>
        </div>
    </div>

    <h3 class="subsection-title">Pilot Metrics</h3>
    <div class="table-wrapper">
        <table class="data-table" id="metricsTable">
            <thead>
                <tr>
                    <th>Metric</th>
                    <th>Count</th>
                </tr>
            </thead>
            <tbody id="metricsBody"></tbody>
        </table>
    </div>

    <h3 class="subsection-title">Open Issues</h3>
    <div id="dashIssues" class="card-list"></div>
</section>

<!-- ============================================ -->
<!-- ORDERS SECTION                               -->
<!-- ============================================ -->
<section id="sec-orders" class="section">
    <h2 class="section-title">Orders</h2>
    <div id="ordersList" class="card-list">
        <div class="loading">Loading orders...</div>
    </div>
</section>

<!-- ============================================ -->
<!-- ORDER DETAIL SECTION                         -->
<!-- ============================================ -->
<section id="sec-orderDetail" class="section">
    <div id="orderDetailContent">
        <div class="empty-state">
            <span class="material-icons" style="font-size:48px;color:#94a3b8;">receipt_long</span>
            <p>Select an order to view details</p>
        </div>
    </div>
</section>

<!-- ============================================ -->
<!-- DECISIONS SECTION                            -->
<!-- ============================================ -->
<section id="sec-decisions" class="section">
    <h2 class="section-title">Decision Audit Trail</h2>
    <div id="decisionsList" class="card-list">
        <div class="loading">Loading decisions...</div>
    </div>
</section>

<!-- ============================================ -->
<!-- SAVINGS SECTION                              -->
<!-- ============================================ -->
<section id="sec-savings" class="section">
    <h2 class="section-title">Savings Ledger</h2>
    <div id="savingsList" class="card-list">
        <div class="loading">Loading savings...</div>
    </div>
</section>

<!-- ============================================ -->
<!-- MORE SECTION                                 -->
<!-- ============================================ -->
<section id="sec-more" class="section">
    <h2 class="section-title">Reference Data</h2>
    <div class="pill-tabs">
        <button class="pill-tab active" onclick="loadMoreTab('constraints')">Constraints</button>
        <button class="pill-tab" onclick="loadMoreTab('sources')">Sources</button>
        <button class="pill-tab" onclick="loadMoreTab('lanes')">Lane Rates</button>
        <button class="pill-tab" onclick="loadMoreTab('fx')">FX Rates</button>
        <button class="pill-tab" onclick="loadMoreTab('issues')">Issues</button>
    </div>
    <div id="moreContent" class="more-content">
        <div class="loading">Select a tab above</div>
    </div>
</section>
