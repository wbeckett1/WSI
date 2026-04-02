/* ============================================
   WSI Landed Cost Optimizer - SPA Controller
   ============================================ */

$(function () {
    loadDashboard();
});

// ---- Helpers ----
function fmt(n) {
    if (n === null || n === undefined) return '--';
    return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(n) {
    if (n === null || n === undefined) return '--';
    return Number(n).toFixed(1) + '%';
}

function dateStr(d) {
    if (!d) return '--';
    var dt = new Date(d);
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function badge(status) {
    if (!status) return '';
    var cls = 'badge-' + status.toLowerCase().replace(/\s/g, '');
    return '<span class="badge ' + cls + '">' + status + '</span>';
}

function riskIcon(flag) {
    var colors = { green: '#16a34a', amber: '#f59e0b', red: '#ef4444' };
    var color = colors[flag] || '#94a3b8';
    return '<span class="material-icons" style="color:' + color + ';font-size:18px;">circle</span>';
}

function icon(name) {
    return '<span class="material-icons" style="font-size:18px;vertical-align:middle;">' + name + '</span>';
}

function getUser() {
    var parts = $('#userRole').val().split('|');
    return { name: parts[0], role: parts[1] };
}

// ---- Navigation ----
function switchSection(sec) {
    $('.section').removeClass('active');
    $('#sec-' + sec).addClass('active');

    // Update bottom nav
    $('.bottom-nav-btn').removeClass('active');
    $('.bottom-nav-btn[data-sec="' + sec + '"]').addClass('active');

    // Update drawer
    $('.drawer-item').removeClass('active');
    $('.drawer-item[data-sec="' + sec + '"]').addClass('active');

    // Load data
    if (sec === 'dashboard') loadDashboard();
    else if (sec === 'orders') loadOrders();
    else if (sec === 'decisions') loadDecisions();
    else if (sec === 'savings') loadSavings();
    else if (sec === 'more') loadMoreTab('constraints');
}

function toggleDrawer() {
    $('#sideDrawer').toggleClass('open');
    $('#drawerOverlay').toggleClass('open');
}

function onRoleChange() {
    // Role switch is cosmetic for demo - user name flows into approvals
}

// ---- Dashboard ----
function loadDashboard() {
    $.getJSON('/Orders/GetDashboard', function (d) {
        $('#kpiTotalOrders').text(d.TotalOrders);
        $('#kpiTheoSavings').text(fmt(d.TheoreticalSavings));
        $('#kpiRealSavings').text(fmt(d.RealizedSavings));
        $('#kpiAcceptRate').text(pct(d.AcceptanceRate));

        var rows = [
            ['Ready', d.ReadyCount],
            ['Evaluated', d.EvaluatedCount],
            ['Approved', d.ApprovedCount],
            ['Overridden', d.OverriddenCount],
            ['Shipped', d.ShippedCount],
            ['Closed', d.ClosedCount],
            ['Override Rate', pct(d.OverrideRate)]
        ];
        var html = '';
        for (var i = 0; i < rows.length; i++) {
            html += '<tr><td>' + rows[i][0] + '</td><td>' + rows[i][1] + '</td></tr>';
        }
        $('#metricsBody').html(html);
    });

    $.getJSON('/Orders/GetIssues', function (issues) {
        var html = '';
        for (var i = 0; i < issues.length; i++) {
            var iss = issues[i];
            if (iss.Status === 'resolved') continue;
            html += '<div class="card">' +
                '<div class="card-header">' +
                    '<div><span class="card-title">' + iss.Category + '</span> ' + badge(iss.Status) + '</div>' +
                    '<span class="card-meta">' + dateStr(iss.OpenedDate) + '</span>' +
                '</div>' +
                '<div class="card-body">' + iss.Issue + '</div>' +
                '<div class="card-footer">' +
                    '<span class="card-meta">' + icon('person') + ' ' + iss.Owner + '</span>' +
                    '<span class="card-meta">Target: ' + dateStr(iss.TargetDate) + '</span>' +
                '</div></div>';
        }
        if (!html) html = '<div class="empty-state">No open issues</div>';
        $('#dashIssues').html(html);
    });
}

// ---- Orders List ----
function loadOrders() {
    $.getJSON('/Orders/GetOrders', function (orders) {
        var html = '';
        for (var i = 0; i < orders.length; i++) {
            var o = orders[i];
            var actionBtn = '';
            if (o.Status === 'ready') {
                actionBtn = '<button class="btn btn-primary btn-sm" onclick="evaluateAndOpen(\'' + o.Id + '\')"><span class="material-icons" style="font-size:16px;">play_arrow</span> Evaluate</button>';
            } else {
                actionBtn = '<button class="btn btn-outline btn-sm" onclick="openOrder(\'' + o.Id + '\')"><span class="material-icons" style="font-size:16px;">visibility</span> View</button>';
            }
            html += '<div class="card">' +
                '<div class="card-header">' +
                    '<div>' +
                        '<div class="card-title">' + o.Id + '</div>' +
                        '<div class="card-subtitle">' + o.Customer + ' ' + icon('arrow_forward') + ' ' + o.ShipTo + '</div>' +
                    '</div>' +
                    badge(o.Status) +
                '</div>' +
                '<div class="card-body">' +
                    '<div class="info-grid">' +
                        '<div class="info-item"><label>Ship Date</label><span>' + dateStr(o.RequestedShipDate) + '</span></div>' +
                        '<div class="info-item"><label>Baseline</label><span>' + o.BaselineSource + '</span></div>' +
                        '<div class="info-item"><label>Total Qty</label><span>' + Number(o.TotalQty).toLocaleString() + ' GAL</span></div>' +
                    '</div>' +
                    '<div class="card-meta">' + o.LineSummary + '</div>' +
                '</div>' +
                '<div class="card-footer">' +
                    '<span class="card-meta">' + o.LineCount + ' line(s) | ' + o.Incoterm + '</span>' +
                    actionBtn +
                '</div></div>';
        }
        if (!html) html = '<div class="empty-state">No orders found</div>';
        $('#ordersList').html(html);
    });
}

// ---- Evaluate and Open ----
function evaluateAndOpen(orderId) {
    $.post('/Orders/Evaluate', { orderId: orderId }, function (res) {
        if (res.success) {
            openOrder(orderId);
        } else {
            alert(res.message || 'Evaluation failed');
        }
    });
}

// ---- Order Detail ----
function openOrder(orderId) {
    switchSection('orderDetail');
    $('#orderDetailContent').html('<div class="loading">Loading order detail...</div>');

    $.getJSON('/Orders/GetOrderDetail', { orderId: orderId }, function (d) {
        if (d.error) {
            $('#orderDetailContent').html('<div class="empty-state">' + d.error + '</div>');
            return;
        }

        var o = d.order;
        var lines = d.lines;
        var recs = d.recommendations;
        var dec = d.decision;
        var sav = d.savings;
        var rules = d.rules;

        var html = '';

        // Stepper
        var steps = ['Intake', 'Enrich', 'Filter', 'Rank', 'Approve', 'Execute', 'Outcome'];
        var statusStep = { ready: 0, evaluated: 3, approved: 4, overridden: 4, shipped: 5, closed: 6 };
        var currentStep = statusStep[o.Status] !== undefined ? statusStep[o.Status] : 0;
        html += '<div class="stepper">';
        for (var s = 0; s < steps.length; s++) {
            var cls = s < currentStep ? 'complete' : (s === currentStep ? 'current' : '');
            var ico = s < currentStep ? 'check_circle' : (s === currentStep ? 'radio_button_checked' : 'radio_button_unchecked');
            html += '<div class="step ' + cls + '"><span class="material-icons">' + ico + '</span>' + steps[s] + '</div>';
        }
        html += '</div>';

        // Order info
        html += '<div class="card mb-8"><div class="card-header"><div class="card-title">' + o.Id + ' ' + badge(o.Status) + '</div></div>';
        html += '<div class="info-grid">' +
            '<div class="info-item"><label>Customer</label><span>' + o.Customer + '</span></div>' +
            '<div class="info-item"><label>Ship To</label><span>' + o.ShipTo + '</span></div>' +
            '<div class="info-item"><label>Requested Ship</label><span>' + dateStr(o.RequestedShipDate) + '</span></div>' +
            '<div class="info-item"><label>Order Date</label><span>' + dateStr(o.OrderDate) + '</span></div>' +
            '<div class="info-item"><label>Baseline Source</label><span>' + o.BaselineSource + '</span></div>' +
            '<div class="info-item"><label>Incoterm</label><span>' + o.Incoterm + '</span></div>' +
            '</div></div>';

        // Customer rules
        if (rules && rules.length > 0) {
            html += '<div class="card mb-8"><div class="card-title mb-8">' + icon('rule') + ' Customer Rules (' + o.Customer + ')</div>';
            for (var r = 0; r < rules.length; r++) {
                var rule = rules[r];
                var constraintBadge = rule.HardConstraint ? '<span class="badge badge-hard">Hard</span>' : '<span class="badge badge-soft">Soft</span>';
                html += '<div style="margin-bottom:6px;">' +
                    '<span class="rule-tag">' + rule.RuleType + '</span>' +
                    constraintBadge + ' ' +
                    '<span style="font-size:.88rem;color:#334155;">' + rule.RuleValue + '</span>' +
                    '</div>';
            }
            html += '</div>';
        }

        // Order lines table
        html += '<h3 class="subsection-title">Order Lines</h3>';
        html += '<div class="table-wrapper"><table class="data-table"><thead><tr>' +
            '<th>SKU</th><th>Description</th><th>Qty</th><th>UOM</th><th>Pack</th><th>Hazmat</th>' +
            '</tr></thead><tbody>';
        for (var l = 0; l < lines.length; l++) {
            var ln = lines[l];
            html += '<tr><td>' + ln.Sku + '</td><td>' + ln.Description + '</td>' +
                '<td class="text-right">' + Number(ln.Quantity).toLocaleString() + '</td>' +
                '<td>' + ln.Uom + '</td><td>' + ln.PackType + '</td>' +
                '<td>' + (ln.Hazmat ? '<span class="material-icons" style="color:#ef4444;font-size:18px;">warning</span> Yes' : 'No') + '</td></tr>';
        }
        html += '</tbody></table></div>';

        // Recommendations
        if (recs && recs.length > 0) {
            html += '<h3 class="subsection-title">Ranked Options (' + recs.length + ' feasible)</h3>';
            html += '<div class="card-list">';
            for (var ri = 0; ri < recs.length; ri++) {
                var rec = recs[ri];
                var rankCls = rec.OptionRank === 1 ? 'rank-1' : '';
                var baselineCls = rec.IsBaseline ? ' baseline' : '';
                var deltaCls = rec.DeltaVsBaseline < 0 ? 'delta-negative' : (rec.DeltaVsBaseline > 0 ? 'delta-positive' : 'delta-zero');

                html += '<div class="card rec-card ' + rankCls + baselineCls + '">';
                html += '<div class="card-header">' +
                    '<div class="inline-flex">' +
                        '<span class="rec-rank ' + rankCls + '">' + rec.OptionRank + '</span>' +
                        '<div><div class="card-title">' + rec.SourceName + '</div>' +
                        '<div class="card-subtitle">' + rec.LaneDescription + ' | ' + rec.Mode +
                        (rec.IsBaseline ? ' | ' + badge('baseline') : '') + '</div></div>' +
                    '</div>' +
                    '<div style="text-align:right;">' +
                        '<div class="landed-total">' + fmt(rec.LandedCost) + '</div>' +
                        '<span class="delta-badge ' + deltaCls + '">' +
                        (rec.DeltaVsBaseline < 0 ? '' : (rec.DeltaVsBaseline > 0 ? '+' : '')) +
                        fmt(rec.DeltaVsBaseline) + ' (' + rec.DeltaPct + '%)</span>' +
                    '</div></div>';

                // Cost breakdown
                html += '<div class="cost-breakdown">' +
                    '<div class="cost-item"><span class="cost-label">Product</span><span class="cost-value">' + fmt(rec.ProductCost) + '</span></div>' +
                    '<div class="cost-item"><span class="cost-label">Blending</span><span class="cost-value">' + fmt(rec.BlendingCost) + '</span></div>' +
                    '<div class="cost-item"><span class="cost-label">Packaging</span><span class="cost-value">' + fmt(rec.PackagingCost) + '</span></div>' +
                    '<div class="cost-item"><span class="cost-label">Freight</span><span class="cost-value">' + fmt(rec.OutboundFreight) + '</span></div>' +
                    '<div class="cost-item"><span class="cost-label">Accessorials</span><span class="cost-value">' + fmt(rec.Accessorials) + '</span></div>' +
                    '<div class="cost-item"><span class="cost-label">Risk</span><span class="cost-value">' + riskIcon(rec.RiskFlag) + ' ' + rec.RiskFlag + '</span></div>' +
                    '</div>';

                // Rationale & reason codes
                html += '<div style="font-size:.85rem;color:#475569;margin:8px 0;">' +
                    '<strong>Rationale:</strong> ' + (rec.Rationale || '--') + '</div>';
                if (rec.ReasonCodes) {
                    var codes = rec.ReasonCodes.split(',');
                    html += '<div style="margin-bottom:8px;">';
                    for (var c = 0; c < codes.length; c++) {
                        html += '<span class="rule-tag">' + codes[c] + '</span>';
                    }
                    html += '</div>';
                }
                html += '<div class="card-meta">Ship promise: ' + dateStr(rec.ShipPromiseDate) + ' | Version: ' + rec.AssumptionsVersion + '</div>';

                // Action buttons (only for evaluated orders)
                if (o.Status === 'evaluated') {
                    html += '<div class="card-footer"><div class="btn-group">';
                    if (rec.OptionRank === 1) {
                        html += '<button class="btn btn-success btn-sm" onclick="openApproval(\'' + o.Id + '\',' + rec.OptionRank + ',false)">' + icon('check') + ' Accept</button>';
                    }
                    html += '<button class="btn btn-warning btn-sm" onclick="openApproval(\'' + o.Id + '\',' + rec.OptionRank + ',true)">' + icon('swap_horiz') + ' Override to This</button>';
                    html += '</div></div>';
                }

                html += '</div>';
            }
            html += '</div>';

            // Scenario analysis panel
            html += '<div class="scenario-panel">' +
                '<h4>' + icon('tune') + ' Sensitivity / Scenario Analysis</h4>' +
                '<div class="scenario-controls">' +
                    '<div class="form-group"><label>Freight Shift %</label>' +
                        '<input type="number" id="freightShift" class="form-input" value="0" step="5" /></div>' +
                    '<div class="form-group"><label>FX Shift %</label>' +
                        '<input type="number" id="fxShift" class="form-input" value="0" step="1" /></div>' +
                    '<button class="btn btn-primary btn-sm" onclick="runScenario(\'' + o.Id + '\')" style="margin-bottom:0;">' + icon('play_arrow') + ' Run</button>' +
                '</div>' +
                '<div id="scenarioResults" class="scenario-results"></div>' +
                '</div>';
        }

        // Decision info
        if (dec) {
            html += '<h3 class="subsection-title">Decision</h3>';
            html += '<div class="card">' +
                '<div class="info-grid">' +
                    '<div class="info-item"><label>Approver</label><span>' + dec.Approver + ' (' + dec.ApproverRole + ')</span></div>' +
                    '<div class="info-item"><label>Selected Rank</label><span>#' + dec.SelectedOptionRank + '</span></div>' +
                    '<div class="info-item"><label>Override</label><span>' + (dec.OverrideFlag ? 'Yes' : 'No') + '</span></div>' +
                    '<div class="info-item"><label>Reason</label><span>' + (dec.ReasonCode || '--') + '</span></div>' +
                    '<div class="info-item"><label>Timestamp</label><span>' + dateStr(dec.ApprovalTimestamp) + '</span></div>' +
                    (dec.OverrideComment ? '<div class="info-item"><label>Comment</label><span>' + dec.OverrideComment + '</span></div>' : '') +
                '</div></div>';
        }

        // Savings
        if (sav) {
            html += '<h3 class="subsection-title">Savings</h3>';
            html += '<div class="card">' +
                '<div class="info-grid">' +
                    '<div class="info-item"><label>Baseline Cost</label><span>' + fmt(sav.BaselineCost) + '</span></div>' +
                    '<div class="info-item"><label>Selected Cost</label><span>' + fmt(sav.SelectedCost) + '</span></div>' +
                    '<div class="info-item"><label>Theoretical Savings</label><span style="color:#16a34a;font-weight:700;">' + fmt(sav.TheoreticalSavings) + '</span></div>' +
                    '<div class="info-item"><label>Realized Savings</label><span>' + fmt(sav.RealizedSavings) + '</span></div>' +
                    '<div class="info-item"><label>Finance Status</label><span>' + badge(sav.FinanceStatus) + '</span></div>' +
                    '<div class="info-item"><label>Period</label><span>' + sav.Period + '</span></div>' +
                '</div></div>';
        }

        $('#orderDetailContent').html(html);
    });
}

// ---- Approval Modal ----
function openApproval(orderId, rank, isOverride) {
    var user = getUser();
    $('#modalOrderId').val(orderId);
    $('#modalRank').val(rank);
    $('#modalIsOverride').val(isOverride ? 'true' : 'false');
    $('#modalApprover').val(user.name);
    $('#modalRole').val(user.role);
    $('#modalTitle').text(isOverride ? 'Override to Option #' + rank : 'Accept Recommendation #' + rank);
    $('#overrideFields').toggle(isOverride);
    $('#modalOverrideComment').val('');
    $('#approvalModal').show();
}

function closeModal() {
    $('#approvalModal').hide();
}

function submitApproval() {
    var data = {
        orderId: $('#modalOrderId').val(),
        selectedRank: parseInt($('#modalRank').val()),
        approver: $('#modalApprover').val(),
        approverRole: $('#modalRole').val(),
        reasonCode: $('#modalReasonCode').val(),
        isOverride: $('#modalIsOverride').val() === 'true',
        overrideComment: $('#modalOverrideComment').val() || null
    };

    $.post('/Orders/Approve', data, function (res) {
        closeModal();
        if (res.success) {
            openOrder(data.orderId);
        } else {
            alert('Approval failed');
        }
    });
}

// ---- Scenario Analysis ----
function runScenario(orderId) {
    var freightPct = parseFloat($('#freightShift').val()) || 0;
    var fxPct = parseFloat($('#fxShift').val()) || 0;

    $.post('/Orders/RunScenario', { orderId: orderId, freightShiftPct: freightPct, fxShiftPct: fxPct }, function (res) {
        if (!res.success) {
            $('#scenarioResults').html('<div class="card-meta">' + (res.message || 'Scenario failed') + '</div>');
            return;
        }

        var html = '<div class="table-wrapper"><table class="data-table"><thead><tr>' +
            '<th>Rank</th><th>Source</th><th>Original</th><th>Adjusted</th><th>Delta</th><th>%</th>' +
            '</tr></thead><tbody>';
        var scenarios = res.scenarios;
        for (var i = 0; i < scenarios.length; i++) {
            var sc = scenarios[i];
            var deltaCls = sc.CostDelta > 0 ? 'color:#ef4444' : (sc.CostDelta < 0 ? 'color:#16a34a' : '');
            html += '<tr>' +
                '<td>' + sc.OptionRank + '</td>' +
                '<td>' + sc.SourceName + '</td>' +
                '<td class="text-right">' + fmt(sc.OriginalLandedCost) + '</td>' +
                '<td class="text-right" style="font-weight:600;">' + fmt(sc.AdjustedLandedCost) + '</td>' +
                '<td class="text-right" style="' + deltaCls + ';">' + fmt(sc.CostDelta) + '</td>' +
                '<td class="text-right" style="' + deltaCls + ';">' + sc.DeltaPct + '%</td>' +
                '</tr>';
        }
        html += '</tbody></table></div>';
        html += '<div class="card-meta mt-12">Freight shift: ' + freightPct + '% | FX shift: ' + fxPct + '%</div>';
        $('#scenarioResults').html(html);
    });
}

// ---- Decisions ----
function loadDecisions() {
    $.getJSON('/Orders/GetDecisions', function (decisions) {
        var html = '';
        for (var i = 0; i < decisions.length; i++) {
            var d = decisions[i];
            html += '<div class="card">' +
                '<div class="card-header">' +
                    '<div>' +
                        '<div class="card-title">' + d.OrderId + '</div>' +
                        '<div class="card-subtitle">' + d.Customer + ' ' + icon('arrow_forward') + ' ' + d.ShipTo + '</div>' +
                    '</div>' +
                    (d.OverrideFlag ? badge('overridden') : badge('approved')) +
                '</div>' +
                '<div class="card-body">' +
                    '<div class="info-grid">' +
                        '<div class="info-item"><label>Selected Rank</label><span>#' + d.SelectedOptionRank + '</span></div>' +
                        '<div class="info-item"><label>Source</label><span>' + (d.SourceName || '--') + '</span></div>' +
                        '<div class="info-item"><label>Landed Cost</label><span>' + fmt(d.LandedCost) + '</span></div>' +
                        '<div class="info-item"><label>Approver</label><span>' + d.Approver + '</span></div>' +
                        '<div class="info-item"><label>Role</label><span>' + d.ApproverRole + '</span></div>' +
                        '<div class="info-item"><label>Reason</label><span>' + (d.ReasonCode || '--') + '</span></div>' +
                    '</div>' +
                    (d.OverrideComment ? '<div style="margin-top:8px;font-size:.85rem;color:#be185d;"><strong>Override:</strong> ' + d.OverrideComment + '</div>' : '') +
                '</div>' +
                '<div class="card-footer">' +
                    '<span class="card-meta">' + dateStr(d.ApprovalTimestamp) + '</span>' +
                    '<button class="btn btn-outline btn-sm" onclick="openOrder(\'' + d.OrderId + '\')">' + icon('visibility') + ' View</button>' +
                '</div></div>';
        }
        if (!html) html = '<div class="empty-state">No decisions yet</div>';
        $('#decisionsList').html(html);
    });
}

// ---- Savings ----
function loadSavings() {
    $.getJSON('/Orders/GetSavings', function (savings) {
        var html = '';
        for (var i = 0; i < savings.length; i++) {
            var s = savings[i];
            html += '<div class="card">' +
                '<div class="card-header">' +
                    '<div>' +
                        '<div class="card-title">' + s.OrderId + '</div>' +
                        '<div class="card-subtitle">' + s.Customer + ' ' + icon('arrow_forward') + ' ' + s.ShipTo + '</div>' +
                    '</div>' +
                    badge(s.FinanceStatus) +
                '</div>' +
                '<div class="card-body">' +
                    '<div class="info-grid">' +
                        '<div class="info-item"><label>Baseline Cost</label><span>' + fmt(s.BaselineCost) + '</span></div>' +
                        '<div class="info-item"><label>Selected Cost</label><span>' + fmt(s.SelectedCost) + '</span></div>' +
                        '<div class="info-item"><label>Theoretical</label><span style="color:#16a34a;font-weight:700;">' + fmt(s.TheoreticalSavings) + '</span></div>' +
                        '<div class="info-item"><label>Realized</label><span style="font-weight:700;">' + fmt(s.RealizedSavings) + '</span></div>' +
                        '<div class="info-item"><label>Period</label><span>' + s.Period + '</span></div>' +
                    '</div>' +
                '</div>' +
                '<div class="card-footer">' +
                    '<span class="card-meta">' + s.Period + '</span>' +
                    '<button class="btn btn-outline btn-sm" onclick="openOrder(\'' + s.OrderId + '\')">' + icon('visibility') + ' View</button>' +
                '</div></div>';
        }
        if (!html) html = '<div class="empty-state">No savings data yet</div>';
        $('#savingsList').html(html);
    });
}

// ---- More Tab ----
function loadMoreTab(tab) {
    // Update pill active state
    $('.pill-tab').removeClass('active');
    $('.pill-tab').each(function () {
        if ($(this).text().toLowerCase().replace(/\s/g, '') === tab.toLowerCase().replace(/\s/g, '')) {
            $(this).addClass('active');
        }
    });

    var $mc = $('#moreContent');
    $mc.html('<div class="loading">Loading...</div>');

    if (tab === 'constraints') {
        $.getJSON('/Orders/GetRules', function (rules) {
            var html = '<div class="table-wrapper"><table class="data-table"><thead><tr>' +
                '<th>Customer</th><th>Rule Type</th><th>Value</th><th>Constraint</th><th>Effective</th>' +
                '</tr></thead><tbody>';
            for (var i = 0; i < rules.length; i++) {
                var r = rules[i];
                html += '<tr><td>' + r.Customer + '</td><td><span class="rule-tag">' + r.RuleType + '</span></td>' +
                    '<td>' + r.RuleValue + '</td>' +
                    '<td>' + (r.HardConstraint ? '<span class="badge badge-hard">Hard</span>' : '<span class="badge badge-soft">Soft</span>') + '</td>' +
                    '<td>' + dateStr(r.EffectiveDate) + '</td></tr>';
            }
            html += '</tbody></table></div>';
            $mc.html(html);
        });
    } else if (tab === 'sources') {
        $.getJSON('/Orders/GetSources', function (sources) {
            var html = '<div class="table-wrapper"><table class="data-table"><thead><tr>' +
                '<th>ID</th><th>Name</th><th>Region</th><th>Prod Cost</th><th>Blend</th><th>Pack</th><th>Capacity</th><th>Lead</th><th>Fresh</th>' +
                '</tr></thead><tbody>';
            for (var i = 0; i < sources.length; i++) {
                var s = sources[i];
                html += '<tr><td>' + s.SourceId + '</td><td>' + s.SourceName + '</td><td>' + s.Region + '</td>' +
                    '<td class="text-right">' + fmt(s.ProductionCost) + '</td>' +
                    '<td class="text-right">' + fmt(s.BlendingCost) + '</td>' +
                    '<td class="text-right">' + fmt(s.PackagingCost) + '</td>' +
                    '<td class="text-right">' + Number(s.CapacityAvailable).toLocaleString() + '</td>' +
                    '<td class="text-center">' + s.LeadTimeDays + 'd</td>' +
                    '<td>' + riskIcon(s.FreshnessStatus) + ' ' + dateStr(s.FreshnessDate) + '</td></tr>';
            }
            html += '</tbody></table></div>';
            $mc.html(html);
        });
    } else if (tab === 'lanes') {
        $.getJSON('/Orders/GetRates', function (rates) {
            var html = '<div class="table-wrapper"><table class="data-table"><thead><tr>' +
                '<th>Origin</th><th>Destination</th><th>Carrier</th><th>Mode</th><th>Base Rate</th><th>Accessorial</th><th>Effective</th><th>Expiry</th>' +
                '</tr></thead><tbody>';
            for (var i = 0; i < rates.length; i++) {
                var r = rates[i];
                html += '<tr><td>' + r.Origin + '</td><td>' + r.DestinationZone + '</td><td>' + r.Carrier + '</td><td>' + r.Mode + '</td>' +
                    '<td class="text-right">' + fmt(r.BaseRate) + '</td>' +
                    '<td class="text-right">' + fmt(r.Accessorial) + '</td>' +
                    '<td>' + dateStr(r.EffectiveDate) + '</td><td>' + dateStr(r.ExpiryDate) + '</td></tr>';
            }
            html += '</tbody></table></div>';
            $mc.html(html);
        });
    } else if (tab === 'fx') {
        $.getJSON('/Orders/GetFx', function (fx) {
            var html = '<div class="card-list">';
            for (var i = 0; i < fx.length; i++) {
                var f = fx[i];
                html += '<div class="card">' +
                    '<div class="card-header">' +
                        '<div class="card-title">' + f.FromCurrency + ' ' + icon('arrow_forward') + ' ' + f.ToCurrency + '</div>' +
                        riskIcon(f.FreshnessStatus) +
                    '</div>' +
                    '<div class="card-body">' +
                        '<div class="info-grid">' +
                            '<div class="info-item"><label>Rate</label><span style="font-size:1.2rem;font-weight:700;">' + Number(f.Rate).toFixed(4) + '</span></div>' +
                            '<div class="info-item"><label>Date</label><span>' + dateStr(f.RateDate) + '</span></div>' +
                            '<div class="info-item"><label>Source</label><span>' + f.Source + '</span></div>' +
                        '</div>' +
                    '</div></div>';
            }
            html += '</div>';
            $mc.html(html);
        });
    } else if (tab === 'issues') {
        $.getJSON('/Orders/GetIssues', function (issues) {
            var html = '<div class="card-list">';
            for (var i = 0; i < issues.length; i++) {
                var iss = issues[i];
                html += '<div class="card">' +
                    '<div class="card-header">' +
                        '<div><span class="card-title">#' + iss.Id + ' ' + iss.Category + '</span> ' + badge(iss.Status) + '</div>' +
                        '<span class="card-meta">' + dateStr(iss.OpenedDate) + '</span>' +
                    '</div>' +
                    '<div class="card-body">' + iss.Issue + '</div>' +
                    '<div class="card-footer">' +
                        '<span class="card-meta">' + icon('person') + ' ' + iss.Owner + '</span>' +
                        '<span class="card-meta">Target: ' + dateStr(iss.TargetDate) + '</span>' +
                    '</div>' +
                    (iss.Comments ? '<div style="padding:0 16px 12px;font-size:.82rem;color:#64748b;"><em>' + iss.Comments + '</em></div>' : '') +
                    '</div>';
            }
            if (!html || html === '<div class="card-list">') html += '<div class="empty-state">No issues</div>';
            html += '</div>';
            $mc.html(html);
        });
    }
}
