/* ============================================================
   WSI Field Service - app.js
   jQuery SPA Controller
   ============================================================ */

(function ($) {
    'use strict';

    // ── Current user (demo role switching) ──────────────────
    var currentUser = { id: 'USR-001', name: 'James Carter', role: 'technician' };

    // ── Cached data ─────────────────────────────────────────
    var cachedVisits = [];
    var currentVisitId = null;
    var currentVisitData = null;

    // ── Signature canvas state ──────────────────────────────
    var sigDrawing = false;
    var sigCtx = null;
    var sigLastX = 0, sigLastY = 0;

    // ============================================================
    //  INITIALIZATION
    // ============================================================
    $(function () {
        loadDashboard();
        bindNavigation();
        bindUserSwitcher();
        bindNewVisitForm();
    });

    // ============================================================
    //  NAVIGATION
    // ============================================================
    function showPage(page) {
        $('.page').removeClass('active');
        $('.tab-btn').removeClass('active');
        $('.drawer-item').removeClass('active');

        if (page === 'dashboard') {
            $('#pageDashboard').addClass('active');
            loadDashboard();
        } else if (page === 'visits') {
            $('#pageVisits').addClass('active');
            loadVisits();
        } else if (page === 'newVisit') {
            $('#pageNewVisit').addClass('active');
            loadNewVisitForm();
        } else if (page === 'actions') {
            $('#pageActions').addClass('active');
            loadAllActions();
        } else if (page === 'detail') {
            $('#pageDetail').addClass('active');
        }

        $('.tab-btn[data-page="' + page + '"]').addClass('active');
        $('.drawer-item[data-page="' + page + '"]').addClass('active');

        // Close drawer on mobile
        $('#sideDrawer').removeClass('open');
        $('#drawerOverlay').removeClass('open');
    }

    function bindNavigation() {
        $('.tab-btn').on('click', function () { showPage($(this).data('page')); });
        $('.drawer-item').on('click', function (e) { e.preventDefault(); showPage($(this).data('page')); });

        // Menu button
        $('#menuBtn').on('click', function () {
            $('#sideDrawer').toggleClass('open');
            $('#drawerOverlay').toggleClass('open');
        });
        $('#drawerOverlay').on('click', function () {
            $('#sideDrawer').removeClass('open');
            $('#drawerOverlay').removeClass('open');
        });

        // Back button
        $('#btnBack').on('click', function () { showPage('visits'); });

        // Detail tabs
        $(document).on('click', '.detail-tab', function () {
            var tab = $(this).data('tab');
            $('.detail-tab').removeClass('active');
            $(this).addClass('active');
            $('.tab-pane').removeClass('active');
            $('#tab' + capitalize(tab)).addClass('active');
        });

        // Visit filter chips
        $(document).on('click', '#visitFilters .chip', function () {
            $('#visitFilters .chip').removeClass('active');
            $(this).addClass('active');
            filterVisits($(this).data('filter'));
        });
    }

    // ============================================================
    //  USER SWITCHER
    // ============================================================
    function bindUserSwitcher() {
        $('#userSwitcher').on('click', function (e) {
            e.stopPropagation();
            $('#userDropdown').toggleClass('open');
        });
        $(document).on('click', function () { $('#userDropdown').removeClass('open'); });

        $(document).on('click', '.user-option', function () {
            currentUser.id = $(this).data('user-id');
            currentUser.name = $(this).data('user-name');
            currentUser.role = $(this).data('user-role');
            var initials = currentUser.name.split(' ').map(function (n) { return n[0]; }).join('');
            $('#userAvatar').text(initials);
            $('#userName').text(currentUser.name);
            $('#userDropdown').removeClass('open');
            toast('Switched to ' + currentUser.name + ' (' + currentUser.role + ')', 'info');

            // Refresh detail if open
            if (currentVisitId && $('#pageDetail').hasClass('active')) {
                openVisit(currentVisitId);
            }
        });
    }

    // ============================================================
    //  DASHBOARD
    // ============================================================
    function loadDashboard() {
        $.getJSON('/Visits/GetDashboard', function (d) {
            $('#kpiTotal').text(d.TotalVisits);
            $('#kpiReview').text(d.InReviewCount + d.DraftCompleteCount);
            $('#kpiActions').text(d.OpenActions);
            $('#kpiPublished').text(d.PublishedCount);

            // Recent visits
            var html = '';
            if (d.RecentVisits && d.RecentVisits.length) {
                $.each(d.RecentVisits, function (_, v) {
                    html += visitCardHtml(v);
                });
            } else {
                html = emptyState('assignment', 'No visits yet');
            }
            $('#dashRecentVisits').html(html);

            // Priority actions
            html = '';
            if (d.PriorityActions && d.PriorityActions.length) {
                $.each(d.PriorityActions, function (_, a) {
                    html += actionCardHtml(a, true);
                });
            } else {
                html = emptyState('flag', 'No priority actions');
            }
            $('#dashPriorityActions').html(html);
        });
    }

    // ============================================================
    //  VISITS LIST
    // ============================================================
    function loadVisits() {
        $('#visitsList').html('<div class="loading-spinner"></div>');
        $.getJSON('/Visits/GetVisits', function (data) {
            cachedVisits = data;
            renderVisits(data);
        });
    }

    function renderVisits(visits) {
        if (!visits.length) {
            $('#visitsList').html(emptyState('assignment', 'No visits found'));
            return;
        }
        var html = '';
        $.each(visits, function (_, v) { html += visitCardHtml(v); });
        $('#visitsList').html(html);
    }

    function filterVisits(status) {
        if (status === 'all') {
            renderVisits(cachedVisits);
        } else {
            var filtered = cachedVisits.filter(function (v) { return v.Status === status; });
            renderVisits(filtered);
        }
    }

    function visitCardHtml(v) {
        var dateStr = formatDate(v.VisitDate);
        return '<div class="visit-card" data-visit-id="' + escHtml(v.VisitId) + '" onclick="window.FSApp.openVisit(\'' + escHtml(v.VisitId) + '\')">' +
            '<div class="visit-card-top">' +
                '<span class="visit-card-site">' + escHtml(v.SiteName || v.AccountName || v.SiteId) + '</span>' +
                statusLabel(v.Status) +
            '</div>' +
            '<div class="visit-card-meta">' +
                '<span><i class="material-icons">calendar_today</i> ' + dateStr + '</span>' +
                '<span><i class="material-icons">person</i> ' + escHtml(v.ConsultantName || '') + '</span>' +
                '<span>' + packLabel(v.ReportPack) + '</span>' +
            '</div>' +
        '</div>';
    }

    // ============================================================
    //  NEW VISIT FORM
    // ============================================================
    function loadNewVisitForm() {
        $.getJSON('/Visits/GetSites', function (sites) {
            var opts = '<option value="">Select a site...</option>';
            $.each(sites, function (_, s) {
                opts += '<option value="' + escHtml(s.SiteId) + '">' + escHtml(s.AccountName + ' - ' + s.SiteName) + '</option>';
            });
            $('#nvSite').html(opts);
        });
        $.getJSON('/Visits/GetUsers', function (users) {
            var opts = '<option value="">Select a consultant...</option>';
            $.each(users, function (_, u) {
                if (u.Role === 'technician') {
                    opts += '<option value="' + escHtml(u.UserId) + '">' + escHtml(u.Name) + '</option>';
                }
            });
            $('#nvConsultant').html(opts);
        });
    }

    function bindNewVisitForm() {
        $('#newVisitForm').on('submit', function (e) {
            e.preventDefault();
            handleNewVisit();
        });
    }

    function handleNewVisit() {
        var siteId = $('#nvSite').val();
        var consultantId = $('#nvConsultant').val();
        var visitDate = $('#nvDate').val();
        var reportPack = $('#nvPack').val();

        if (!siteId || !consultantId || !visitDate || !reportPack) {
            toast('Please fill in all fields', 'error');
            return;
        }

        $.post('/Visits/CreateVisit', {
            siteId: siteId,
            consultantId: consultantId,
            visitDate: visitDate,
            reportPack: reportPack
        }, function (res) {
            if (res.success) {
                toast('Visit created: ' + res.visitId, 'success');
                $('#newVisitForm')[0].reset();
                openVisit(res.visitId);
            } else {
                toast('Failed to create visit', 'error');
            }
        });
    }

    // ============================================================
    //  ALL ACTION ITEMS
    // ============================================================
    function loadAllActions() {
        $('#allActionsList').html('<div class="loading-spinner"></div>');
        $.getJSON('/Visits/GetAllActionItems', function (data) {
            if (!data.length) {
                $('#allActionsList').html(emptyState('flag', 'No action items'));
                return;
            }
            var html = '';
            $.each(data, function (_, a) { html += actionCardHtml(a, true); });
            $('#allActionsList').html(html);
        });
    }

    function actionCardHtml(a, showSite) {
        var border = 'sev-border-' + (a.Severity || 'medium');
        var statusCls = a.Status === 'closed' ? ' style="opacity:.6"' : '';
        var html = '<div class="action-card ' + border + '"' + statusCls + '>' +
            '<div class="action-card-top">' +
                '<span class="action-card-desc">' + escHtml(a.Description) + '</span>' +
                '<span class="sev-badge sev-' + escHtml(a.Severity || 'medium') + '">' + escHtml(a.Severity || 'medium') + '</span>' +
            '</div>' +
            '<div class="action-card-meta">';

        if (showSite && a.SiteName) {
            html += '<span><i class="material-icons">location_on</i> ' + escHtml(a.SiteName) + '</span>';
        }
        if (a.Owner) {
            html += '<span><i class="material-icons">person</i> ' + escHtml(a.Owner) + '</span>';
        }
        if (a.DueDate) {
            html += '<span><i class="material-icons">event</i> ' + formatDate(a.DueDate) + '</span>';
        }
        html += '<span class="status-badge status-' + (a.Status === 'open' ? 'in_progress' : a.Status === 'in_progress' ? 'in_review' : 'approved') + '">' + escHtml(a.Status) + '</span>';

        if (a.Status !== 'closed' && currentVisitId) {
            html += ' <button class="btn btn-sm btn-success" onclick="event.stopPropagation();window.FSApp.closeAction(\'' + escHtml(a.ActionItemId) + '\',\'' + escHtml(a.VisitId) + '\')">Close</button>';
        }

        html += '</div>';
        if (a.Comments) {
            html += '<div class="obs-notes mt-8">' + escHtml(a.Comments) + '</div>';
        }
        html += '</div>';
        return html;
    }

    // ============================================================
    //  VISIT DETAIL
    // ============================================================
    function openVisit(visitId) {
        currentVisitId = visitId;
        showPage('detail');
        $('#detailTitle').text('Loading...');

        // Reset to summary tab
        $('.detail-tab').removeClass('active').first().addClass('active');
        $('.tab-pane').removeClass('active');
        $('#tabSummary').addClass('active');

        $.getJSON('/Visits/GetVisitDetail', { visitId: visitId }, function (d) {
            if (d.error) { toast(d.error, 'error'); return; }
            currentVisitData = d;
            var v = d.visit;

            // Title & status
            $('#detailTitle').text((v.AccountName || '') + ' - ' + (v.SiteName || v.SiteId));
            $('#detailStatus').attr('class', 'status-badge status-' + v.Status).text(statusText(v.Status));

            // Stepper
            updateStepper(v.Status);

            // Workflow buttons
            renderWorkflowButtons(v);

            // Summary tab - site details
            renderSiteDetails(v);

            // Summary tab - notes
            renderVisitNotes(v);

            // WF tab
            renderWfTab(d.wfObservations, v.Status, v.ReportPack, visitId);

            // WW tab
            renderWwTab(d.wwObservations, v.Status, v.ReportPack, visitId);

            // Actions tab
            renderVisitActions(d.actionItems, visitId, v.Status);

            // Photos tab
            renderPhotos(d.attachments, visitId, v.Status);

            // Signatures tab
            renderSignatures(d.signatures, visitId);

            // Audit tab
            renderAudit(d.approvals);

            // Show/hide WF/WW tabs based on pack
            if (v.ReportPack === 'WF') {
                $('[data-tab="ww"]').hide();
            } else if (v.ReportPack === 'WW') {
                $('[data-tab="wf"]').hide();
            } else {
                $('[data-tab="wf"]').show();
                $('[data-tab="ww"]').show();
            }
        });
    }

    function updateStepper(status) {
        var steps = ['planned', 'in_progress', 'draft_complete', 'in_review', 'approved', 'published'];
        var idx = steps.indexOf(status);
        $('#workflowStepper .step').each(function (i) {
            var $s = $(this);
            $s.removeClass('completed active-step');
            if (i < idx) $s.addClass('completed');
            else if (i === idx) $s.addClass('active-step completed');
        });
        // Color step lines
        $('#workflowStepper .step-line').each(function (i) {
            if (i < idx) $(this).css('background', 'var(--wsi-primary)');
            else $(this).css('background', 'var(--border)');
        });
    }

    function renderWorkflowButtons(v) {
        var html = '';
        var s = v.Status;
        var role = currentUser.role;

        if (s === 'planned' && (role === 'technician' || role === 'admin')) {
            html += '<button class="btn btn-primary btn-sm" onclick="window.FSApp.doWorkflow(\'' + v.VisitId + '\',\'submit\')"><i class="material-icons">play_arrow</i> Start Visit</button>';
        } else if (s === 'in_progress' && (role === 'technician' || role === 'admin')) {
            html += '<button class="btn btn-primary btn-sm" onclick="window.FSApp.doWorkflow(\'' + v.VisitId + '\',\'submit\')"><i class="material-icons">check</i> Complete Draft</button>';
            html += '<button class="btn btn-secondary btn-sm" onclick="window.FSApp.saveNotes(\'' + v.VisitId + '\')"><i class="material-icons">save</i> Save Notes</button>';
        } else if (s === 'draft_complete' && (role === 'technician' || role === 'admin')) {
            html += '<button class="btn btn-primary btn-sm" onclick="window.FSApp.doWorkflow(\'' + v.VisitId + '\',\'submit\')"><i class="material-icons">send</i> Submit for Review</button>';
            html += '<button class="btn btn-secondary btn-sm" onclick="window.FSApp.saveNotes(\'' + v.VisitId + '\')"><i class="material-icons">save</i> Save Notes</button>';
        } else if (s === 'in_review' && (role === 'reviewer' || role === 'admin')) {
            html += '<button class="btn btn-success btn-sm" onclick="window.FSApp.doWorkflow(\'' + v.VisitId + '\',\'approve\')"><i class="material-icons">thumb_up</i> Approve</button>';
            html += '<button class="btn btn-danger btn-sm" onclick="window.FSApp.doWorkflow(\'' + v.VisitId + '\',\'reject\')"><i class="material-icons">thumb_down</i> Return</button>';
        } else if (s === 'approved' && (role === 'admin')) {
            html += '<button class="btn btn-primary btn-sm" onclick="window.FSApp.doWorkflow(\'' + v.VisitId + '\',\'publish\')"><i class="material-icons">publish</i> Publish</button>';
        }

        $('#detailWorkflowBtns').html(html);
    }

    function renderSiteDetails(v) {
        var html =
            roField('Account', v.AccountName) +
            roField('Site', v.SiteName) +
            roField('Address', v.Address) +
            roField('Service Lines', v.ServiceLines) +
            roField('Consultant', v.ConsultantName) +
            roField('Visit Date', formatDate(v.VisitDate)) +
            roField('Report Pack', v.ReportPack) +
            roField('Status', statusText(v.Status)) +
            roField('Contacts', v.Contacts || 'N/A') +
            roField('Distribution List', v.DistributionList || 'N/A');
        $('#siteDetails').html(html);
    }

    function roField(label, value) {
        return '<div class="ro-field"><label>' + escHtml(label) + '</label><div class="ro-value">' + escHtml(value || '') + '</div></div>';
    }

    function renderVisitNotes(v) {
        var editable = (v.Status === 'in_progress' || v.Status === 'draft_complete') &&
                       (currentUser.role === 'technician' || currentUser.role === 'admin');
        var html = '';
        if (editable) {
            html += '<div class="form-group"><label>Entrance Notes</label><textarea class="form-control" id="noteEntrance">' + escHtml(v.EntranceNotes || '') + '</textarea></div>';
            html += '<div class="form-group"><label>General Observations</label><textarea class="form-control" id="noteGeneral">' + escHtml(v.GeneralObservations || '') + '</textarea></div>';
            html += '<div class="form-group"><label>Exit Notes</label><textarea class="form-control" id="noteExit">' + escHtml(v.ExitNotes || '') + '</textarea></div>';
            html += '<div class="form-group"><label>Distribution List</label><input type="text" class="form-control" id="noteDist" value="' + escHtml(v.DistributionList || '') + '" /></div>';
        } else {
            html += roField('Entrance Notes', v.EntranceNotes || 'N/A');
            html += roField('General Observations', v.GeneralObservations || 'N/A');
            html += roField('Exit Notes', v.ExitNotes || 'N/A');
            html += roField('Distribution List', v.DistributionList || 'N/A');
        }
        $('#visitNotesContainer').html(html);
    }

    // ── Wash Floor Tab ──────────────────────────────────────
    function renderWfTab(wfObs, status, pack, visitId) {
        if (pack === 'WW') { $('#wfContent').html(emptyState('local_laundry_service', 'WW-only visit')); return; }
        if (!wfObs || !wfObs.length) {
            var canInit = (status === 'in_progress' || status === 'draft_complete') &&
                          (currentUser.role === 'technician' || currentUser.role === 'admin');
            if (canInit) {
                $('#wfContent').html('<button class="init-obs-btn" onclick="window.FSApp.initWF(\'' + visitId + '\')"><i class="material-icons">add_circle</i> Initialize Wash Floor Observations</button>');
            } else {
                $('#wfContent').html(emptyState('local_laundry_service', 'No wash floor observations recorded'));
            }
            return;
        }
        var grouped = groupBy(wfObs, 'Section');
        $('#wfContent').html(renderWF(grouped, status, visitId));
    }

    function renderWF(grouped, status, visitId) {
        var sectionNames = { plant_ops: 'Plant Operations', kpi: 'KPIs', wash_practices: 'Wash Practices' };
        var sectionIcons = { plant_ops: 'settings', kpi: 'trending_up', wash_practices: 'local_laundry_service' };
        var html = '';

        for (var sec in grouped) {
            html += '<div class="obs-section"><div class="obs-section-title"><i class="material-icons">' +
                (sectionIcons[sec] || 'list') + '</i> ' + (sectionNames[sec] || sec) + '</div>';
            html += '<div class="card"><table class="obs-table"><thead><tr><th>Field</th><th>Value</th><th>Range</th><th>Status</th><th>Notes</th></tr></thead><tbody>';

            $.each(grouped[sec], function (_, o) {
                var dotColor = getWfDotColor(o);
                var flagHtml = '';
                if (o.Flag && o.Flag !== '') {
                    flagHtml = '<span class="obs-flag flagged">' + escHtml(o.Flag) + '</span>';
                } else if (o.ThresholdLow !== null && o.ThresholdHigh !== null) {
                    var numVal = parseFloat(o.Value);
                    if (!isNaN(numVal) && numVal >= o.ThresholdLow && numVal <= o.ThresholdHigh) {
                        flagHtml = '<span class="obs-flag ok">OK</span>';
                    }
                }
                var rangeStr = '';
                if (o.ThresholdLow !== null && o.ThresholdHigh !== null) {
                    rangeStr = o.ThresholdLow + ' - ' + o.ThresholdHigh;
                }
                html += '<tr>';
                html += '<td>' + escHtml(o.FieldLabel) + '</td>';
                html += '<td><strong>' + escHtml(o.Value || '') + '</strong> ' + escHtml(o.Unit || '') + '</td>';
                html += '<td class="obs-range">' + rangeStr + '</td>';
                html += '<td><span class="obs-dot ' + dotColor + '"></span>' + flagHtml + '</td>';
                html += '<td>' + (o.Notes ? '<div class="obs-notes">' + escHtml(o.Notes) + '</div>' : '') + '</td>';
                html += '</tr>';
            });

            html += '</tbody></table></div></div>';
        }
        return html;
    }

    function getWfDotColor(o) {
        if (o.Flag && o.Flag !== '') return 'red';
        if (o.ThresholdLow === null || o.ThresholdHigh === null) return 'gray';
        var numVal = parseFloat(o.Value);
        if (isNaN(numVal)) {
            if (o.Value === 'Yes') return 'green';
            if (o.Value === 'No') return 'red';
            return 'gray';
        }
        if (numVal >= o.ThresholdLow && numVal <= o.ThresholdHigh) return 'green';
        return 'red';
    }

    // ── Wastewater Tab ──────────────────────────────────────
    function renderWwTab(wwObs, status, pack, visitId) {
        if (pack === 'WF') { $('#wwContent').html(emptyState('water', 'WF-only visit')); return; }
        if (!wwObs || !wwObs.length) {
            var canInit = (status === 'in_progress' || status === 'draft_complete') &&
                          (currentUser.role === 'technician' || currentUser.role === 'admin');
            if (canInit) {
                $('#wwContent').html('<button class="init-obs-btn" onclick="window.FSApp.initWW(\'' + visitId + '\')"><i class="material-icons">add_circle</i> Initialize Wastewater Observations</button>');
            } else {
                $('#wwContent').html(emptyState('water', 'No wastewater observations recorded'));
            }
            return;
        }
        var grouped = groupBy(wwObs, 'Section');
        $('#wwContent').html(renderWW(grouped, status, visitId));
    }

    function renderWW(grouped, status, visitId) {
        var sectionNames = { treatment: 'Treatment', compliance: 'Compliance', training: 'Training' };
        var sectionIcons = { treatment: 'science', compliance: 'verified', training: 'school' };
        var html = '';

        for (var sec in grouped) {
            html += '<div class="obs-section"><div class="obs-section-title"><i class="material-icons">' +
                (sectionIcons[sec] || 'list') + '</i> ' + (sectionNames[sec] || sec) + '</div>';
            html += '<div class="card"><table class="obs-table"><thead><tr><th>Field</th><th>Value</th><th>Range</th><th>Status</th><th>Notes</th></tr></thead><tbody>';

            $.each(grouped[sec], function (_, o) {
                var dotColor = 'gray';
                if (o.Status === 'OK') dotColor = 'green';
                else if (o.Status === 'Not OK') dotColor = 'red';

                var rangeStr = '';
                if (o.ThresholdLow !== null && o.ThresholdHigh !== null) {
                    rangeStr = o.ThresholdLow + ' - ' + o.ThresholdHigh;
                }
                var statusHtml = o.Status ? '<span class="obs-flag ' + (o.Status === 'OK' ? 'ok' : o.Status === 'Not OK' ? 'flagged' : '') + '">' + escHtml(o.Status) + '</span>' : '';

                html += '<tr>';
                html += '<td>' + escHtml(o.FieldLabel) + '</td>';
                html += '<td><strong>' + escHtml(o.Value || '') + '</strong> ' + escHtml(o.Unit || '') + '</td>';
                html += '<td class="obs-range">' + rangeStr + '</td>';
                html += '<td><span class="obs-dot ' + dotColor + '"></span>' + statusHtml + '</td>';
                html += '<td>' + (o.Notes ? '<div class="obs-notes">' + escHtml(o.Notes) + '</div>' : '') + '</td>';
                html += '</tr>';
            });

            html += '</tbody></table></div></div>';
        }
        return html;
    }

    // ── Init default observation templates ──────────────────
    function initWF(visitId) {
        var template = [
            { section:'plant_ops', fieldCode:'hot_water_temp', fieldLabel:'Hot Water Temperature', value:'', unit:'\u00b0F', thresholdLow:140, thresholdHigh:160, flag:'', notes:'' },
            { section:'plant_ops', fieldCode:'hardness', fieldLabel:'Water Hardness', value:'', unit:'gpg', thresholdLow:0, thresholdHigh:5, flag:'', notes:'' },
            { section:'plant_ops', fieldCode:'iron', fieldLabel:'Iron Content', value:'', unit:'ppm', thresholdLow:0, thresholdHigh:1.0, flag:'', notes:'' },
            { section:'plant_ops', fieldCode:'alkalinity', fieldLabel:'Alkalinity', value:'', unit:'ppm', thresholdLow:80, thresholdHigh:120, flag:'', notes:'' },
            { section:'plant_ops', fieldCode:'ph', fieldLabel:'pH Level', value:'', unit:'', thresholdLow:6.5, thresholdHigh:8.5, flag:'', notes:'' },
            { section:'plant_ops', fieldCode:'bleach_strength', fieldLabel:'Bleach Strength', value:'', unit:'%', thresholdLow:10, thresholdHigh:12.5, flag:'', notes:'' },
            { section:'kpi', fieldCode:'daily_cwt', fieldLabel:'Daily Production', value:'', unit:'lbs', thresholdLow:null, thresholdHigh:null, flag:'', notes:'' },
            { section:'kpi', fieldCode:'gallons_per_lb', fieldLabel:'Water Usage per Pound', value:'', unit:'gal/lb', thresholdLow:0, thresholdHigh:2.5, flag:'', notes:'' },
            { section:'kpi', fieldCode:'therms_per_cwt', fieldLabel:'Energy per CWT', value:'', unit:'therms', thresholdLow:0, thresholdHigh:0.5, flag:'', notes:'' },
            { section:'kpi', fieldCode:'chem_cost_cwt', fieldLabel:'Chemical Cost per CWT', value:'', unit:'$/cwt', thresholdLow:0, thresholdHigh:2.5, flag:'', notes:'' },
            { section:'wash_practices', fieldCode:'weighing', fieldLabel:'Weighing Compliance', value:'', unit:'', thresholdLow:null, thresholdHigh:null, flag:'', notes:'' },
            { section:'wash_practices', fieldCode:'sorting', fieldLabel:'Sorting Compliance', value:'', unit:'', thresholdLow:null, thresholdHigh:null, flag:'', notes:'' },
            { section:'wash_practices', fieldCode:'formula_select', fieldLabel:'Formula Selection', value:'', unit:'', thresholdLow:null, thresholdHigh:null, flag:'', notes:'' },
            { section:'wash_practices', fieldCode:'steam_leaks', fieldLabel:'Steam Leak Check', value:'', unit:'', thresholdLow:null, thresholdHigh:null, flag:'', notes:'' },
            { section:'wash_practices', fieldCode:'load_accuracy', fieldLabel:'Load Accuracy', value:'', unit:'', thresholdLow:null, thresholdHigh:null, flag:'', notes:'' }
        ];
        $.post('/Visits/SaveWfObservations', { visitId: visitId, observations: JSON.stringify(template) }, function (res) {
            if (res.success) {
                toast('WF observations initialized', 'success');
                openVisit(visitId);
            }
        });
    }

    function initWW(visitId) {
        var template = [
            { section:'treatment', fieldCode:'ph_treatment', fieldLabel:'Treatment pH', value:'', unit:'', thresholdLow:7, thresholdHigh:9, status:'', notes:'' },
            { section:'treatment', fieldCode:'ph_discharge', fieldLabel:'Discharge pH', value:'', unit:'', thresholdLow:6, thresholdHigh:9, status:'', notes:'' },
            { section:'treatment', fieldCode:'coagulant_dose', fieldLabel:'Coagulant Dose', value:'', unit:'ppm', thresholdLow:30, thresholdHigh:60, status:'', notes:'' },
            { section:'treatment', fieldCode:'flocculant_dose', fieldLabel:'Flocculant Dose', value:'', unit:'ppm', thresholdLow:8, thresholdHigh:20, status:'', notes:'' },
            { section:'treatment', fieldCode:'daf_status', fieldLabel:'DAF System Status', value:'', unit:'', thresholdLow:null, thresholdHigh:null, status:'', notes:'' },
            { section:'treatment', fieldCode:'filter_press', fieldLabel:'Filter Press Status', value:'', unit:'', thresholdLow:null, thresholdHigh:null, status:'', notes:'' },
            { section:'compliance', fieldCode:'target_cost', fieldLabel:'Target Cost', value:'', unit:'$/1000gal', thresholdLow:null, thresholdHigh:null, status:'', notes:'' },
            { section:'compliance', fieldCode:'actual_cost', fieldLabel:'Actual Cost', value:'', unit:'$/1000gal', thresholdLow:null, thresholdHigh:null, status:'', notes:'' },
            { section:'compliance', fieldCode:'treatment_pct', fieldLabel:'Treatment Efficiency', value:'', unit:'%', thresholdLow:90, thresholdHigh:100, status:'', notes:'' },
            { section:'training', fieldCode:'log_discipline', fieldLabel:'Log Discipline', value:'', unit:'', thresholdLow:null, thresholdHigh:null, status:'', notes:'' },
            { section:'training', fieldCode:'operator_training', fieldLabel:'Operator Training', value:'', unit:'', thresholdLow:null, thresholdHigh:null, status:'', notes:'' }
        ];
        $.post('/Visits/SaveWwObservations', { visitId: visitId, observations: JSON.stringify(template) }, function (res) {
            if (res.success) {
                toast('WW observations initialized', 'success');
                openVisit(visitId);
            }
        });
    }

    // ── Actions Tab ─────────────────────────────────────────
    function renderVisitActions(actions, visitId, status) {
        // Show/hide add button based on status
        var canEdit = (status === 'in_progress' || status === 'draft_complete') &&
                      (currentUser.role === 'technician' || currentUser.role === 'admin');
        if (canEdit) {
            $('#btnAddAction').show().off('click').on('click', function () { showAddAction(visitId); });
        } else {
            $('#btnAddAction').hide();
        }

        if (!actions || !actions.length) {
            $('#visitActionsList').html(emptyState('flag', 'No action items for this visit'));
            return;
        }
        var html = '';
        $.each(actions, function (_, a) { html += actionCardHtml(a, false); });
        $('#visitActionsList').html(html);
    }

    function showAddAction(visitId) {
        var html = '<div class="modal-header"><h3>Add Action Item</h3><button class="modal-close" onclick="window.FSApp.closeModal()"><i class="material-icons">close</i></button></div>';
        html += '<form id="addActionForm">';
        html += '<div class="form-group"><label>Section</label><select class="form-control" id="actSection"><option value="plant_ops">Plant Operations</option><option value="kpi">KPIs</option><option value="wash_practices">Wash Practices</option><option value="treatment">Treatment</option><option value="compliance">Compliance</option><option value="training">Training</option></select></div>';
        html += '<div class="form-group"><label>Description</label><textarea class="form-control" id="actDesc" required placeholder="Describe the action item..."></textarea></div>';
        html += '<div class="form-group"><label>Severity</label><select class="form-control" id="actSev"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div>';
        html += '<div class="form-group"><label>Owner</label><input type="text" class="form-control" id="actOwner" placeholder="Responsible person" /></div>';
        html += '<div class="form-group"><label>Due Date</label><input type="date" class="form-control" id="actDue" /></div>';
        html += '<button type="submit" class="btn btn-primary btn-lg">Create Action Item</button>';
        html += '</form>';

        openModal(html);

        $('#addActionForm').on('submit', function (e) {
            e.preventDefault();
            $.post('/Visits/CreateActionItem', {
                visitId: visitId,
                sectionRef: $('#actSection').val(),
                description: $('#actDesc').val(),
                severity: $('#actSev').val(),
                owner: $('#actOwner').val(),
                dueDate: $('#actDue').val()
            }, function (res) {
                if (res.success) {
                    toast('Action item created', 'success');
                    closeModal();
                    openVisit(visitId);
                }
            });
        });
    }

    function closeAction(actionItemId, visitId) {
        if (!confirm('Close this action item?')) return;
        $.post('/Visits/UpdateActionItem', {
            actionItemId: actionItemId,
            status: 'closed',
            comments: 'Closed by ' + currentUser.name + ' on ' + new Date().toLocaleDateString()
        }, function (res) {
            if (res.success) {
                toast('Action item closed', 'success');
                if (visitId && currentVisitId) openVisit(currentVisitId);
                else loadAllActions();
            }
        });
    }

    // ── Photos Tab ──────────────────────────────────────────
    function renderPhotos(attachments, visitId, status) {
        var canUpload = (status === 'in_progress' || status === 'draft_complete') &&
                        (currentUser.role === 'technician' || currentUser.role === 'admin');
        if (canUpload) {
            $('#btnUploadPhoto').show().off('click').on('click', function () { showPhotoUpload(visitId); });
        } else {
            $('#btnUploadPhoto').hide();
        }

        if (!attachments || !attachments.length) {
            $('#photoGrid').html(emptyState('photo_camera', 'No photos uploaded'));
            return;
        }
        var html = '';
        $.each(attachments, function (_, a) {
            html += '<div class="photo-card">' +
                '<img src="' + escHtml(a.FilePath) + '" alt="' + escHtml(a.Caption || 'Photo') + '" onerror="this.style.display=\'none\'" />' +
                '<div class="photo-caption">' + escHtml(a.Caption || 'No caption') + '</div>' +
            '</div>';
        });
        $('#photoGrid').html(html);
    }

    function showPhotoUpload(visitId) {
        var html = '<div class="modal-header"><h3>Upload Photo</h3><button class="modal-close" onclick="window.FSApp.closeModal()"><i class="material-icons">close</i></button></div>';
        html += '<form id="uploadPhotoForm" enctype="multipart/form-data">';
        html += '<div class="form-group"><label>Photo</label><input type="file" class="form-control" id="photoFile" accept="image/*" capture="environment" required /></div>';
        html += '<div class="form-group"><label>Caption</label><input type="text" class="form-control" id="photoCaption" placeholder="Optional caption" /></div>';
        html += '<div class="form-group"><label>Section</label><select class="form-control" id="photoSection"><option value="">General</option><option value="plant_ops">Plant Operations</option><option value="wash_practices">Wash Practices</option><option value="treatment">Treatment</option></select></div>';
        html += '<button type="submit" class="btn btn-primary btn-lg"><i class="material-icons">cloud_upload</i> Upload</button>';
        html += '</form>';

        openModal(html);

        $('#uploadPhotoForm').on('submit', function (e) {
            e.preventDefault();
            var fd = new FormData();
            fd.append('visitId', visitId);
            fd.append('file', $('#photoFile')[0].files[0]);
            fd.append('caption', $('#photoCaption').val());
            fd.append('sectionRef', $('#photoSection').val());

            $.ajax({
                url: '/Visits/UploadPhoto?visitId=' + visitId,
                type: 'POST',
                data: fd,
                processData: false,
                contentType: false,
                success: function (res) {
                    if (res.success) {
                        toast('Photo uploaded', 'success');
                        closeModal();
                        openVisit(visitId);
                    } else {
                        toast(res.error || 'Upload failed', 'error');
                    }
                }
            });
        });
    }

    // ── Signatures Tab ──────────────────────────────────────
    function renderSignatures(sigs, visitId) {
        var html = '';
        if (sigs && sigs.length) {
            $.each(sigs, function (_, s) {
                html += '<div class="sig-item">';
                if (s.SignatureData) {
                    html += '<img src="' + s.SignatureData + '" alt="Signature" />';
                }
                html += '<div><strong>' + escHtml(s.SignerName) + '</strong><br/><small>' + escHtml(s.SignerRole || '') + '</small><br/><small class="text-muted">' + formatDateTime(s.SignedAt) + '</small></div>';
                html += '</div>';
            });
        } else {
            html = '<p class="text-muted" style="padding:8px 0;">No signatures recorded.</p>';
        }
        $('#signaturesList').html(html);
        initSigCanvas(visitId);
    }

    function initSigCanvas(visitId) {
        var canvas = document.getElementById('sigCanvas');
        if (!canvas) return;
        sigCtx = canvas.getContext('2d');
        sigCtx.strokeStyle = '#1e293b';
        sigCtx.lineWidth = 2;
        sigCtx.lineCap = 'round';
        sigDrawing = false;

        // Clear
        sigCtx.clearRect(0, 0, canvas.width, canvas.height);

        var getPos = function (e) {
            var rect = canvas.getBoundingClientRect();
            if (e.touches) {
                return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
            }
            return { x: e.clientX - rect.left, y: e.clientY - rect.top };
        };

        $(canvas).off();
        $(canvas).on('mousedown touchstart', function (e) {
            e.preventDefault();
            sigDrawing = true;
            var p = getPos(e.originalEvent);
            sigLastX = p.x; sigLastY = p.y;
        });
        $(canvas).on('mousemove touchmove', function (e) {
            if (!sigDrawing) return;
            e.preventDefault();
            var p = getPos(e.originalEvent);
            sigCtx.beginPath();
            sigCtx.moveTo(sigLastX, sigLastY);
            sigCtx.lineTo(p.x, p.y);
            sigCtx.stroke();
            sigLastX = p.x; sigLastY = p.y;
        });
        $(canvas).on('mouseup touchend mouseleave', function () { sigDrawing = false; });

        $('#btnClearSig').off('click').on('click', function () {
            sigCtx.clearRect(0, 0, canvas.width, canvas.height);
        });

        $('#btnSaveSig').off('click').on('click', function () {
            saveSig(visitId);
        });
    }

    function saveSig(visitId) {
        var name = $('#sigName').val();
        var role = $('#sigRole').val();
        if (!name) { toast('Please enter signer name', 'error'); return; }
        var canvas = document.getElementById('sigCanvas');
        var data = canvas.toDataURL('image/png');

        $.post('/Visits/SaveSignature', {
            visitId: visitId,
            signerName: name,
            signerRole: role,
            signatureData: data
        }, function (res) {
            if (res.success) {
                toast('Signature saved', 'success');
                openVisit(visitId);
            }
        });
    }

    // ── Audit Tab ───────────────────────────────────────────
    function renderAudit(approvals) {
        if (!approvals || !approvals.length) {
            $('#auditTimeline').html(emptyState('history', 'No approval events'));
            return;
        }
        var html = '';
        $.each(approvals, function (_, a) {
            html += '<div class="audit-event decision-' + escHtml(a.Decision) + '">';
            html += '<div class="audit-event-header">' + escHtml(a.ActorName) + ' - ' + capitalize(a.Decision) + '</div>';
            html += '<div class="audit-event-time">' + formatDateTime(a.Timestamp) + ' | Stage: ' + escHtml(a.Stage || 'N/A') + '</div>';
            if (a.Comment) html += '<div class="audit-event-comment">"' + escHtml(a.Comment) + '"</div>';
            html += '</div>';
        });
        $('#auditTimeline').html(html);
    }

    // ============================================================
    //  WORKFLOW
    // ============================================================
    function doWorkflow(visitId, action) {
        var comment = '';
        if (action === 'reject') {
            comment = prompt('Reason for returning the report:');
            if (comment === null) return;
        }
        $.post('/Visits/DoWorkflow', {
            visitId: visitId,
            action: action,
            actorId: currentUser.id,
            comment: comment
        }, function (res) {
            if (res.success) {
                toast('Status updated to ' + statusText(res.newStatus), 'success');
                openVisit(visitId);
            } else {
                toast(res.error || 'Workflow action failed', 'error');
            }
        });
    }

    // ============================================================
    //  SAVE NOTES
    // ============================================================
    function saveNotes(visitId) {
        $.post('/Visits/UpdateVisit', {
            visitId: visitId,
            entranceNotes: $('#noteEntrance').val() || '',
            generalObservations: $('#noteGeneral').val() || '',
            exitNotes: $('#noteExit').val() || '',
            distributionList: $('#noteDist').val() || '',
            status: ''
        }, function (res) {
            if (res.success) {
                toast('Notes saved', 'success');
            }
        });
    }

    // ============================================================
    //  MODAL HELPERS
    // ============================================================
    function openModal(html) {
        $('#modalContent').html(html);
        $('#modalOverlay').addClass('open');
    }

    function closeModal() {
        $('#modalOverlay').removeClass('open');
        $('#modalContent').html('');
    }

    $('#modalOverlay').on('click', function (e) {
        if (e.target === this) closeModal();
    });

    // ============================================================
    //  UTILITY HELPERS
    // ============================================================
    function statusLabel(status) {
        return '<span class="status-badge status-' + escHtml(status) + '">' + statusText(status) + '</span>';
    }

    function statusText(status) {
        var map = {
            planned: 'Planned', in_progress: 'In Progress', draft_complete: 'Draft Complete',
            in_review: 'In Review', approved: 'Approved', published: 'Published'
        };
        return map[status] || status;
    }

    function packLabel(pack) {
        return '<span class="pack-badge">' + escHtml(pack) + '</span>';
    }

    function escHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function formatDate(d) {
        if (!d) return '';
        var dt = new Date(d);
        if (isNaN(dt)) return d;
        return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    function formatDateTime(d) {
        if (!d) return '';
        var dt = new Date(d);
        if (isNaN(dt)) return d;
        return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function capitalize(s) {
        if (!s) return '';
        return s.charAt(0).toUpperCase() + s.slice(1);
    }

    function groupBy(arr, key) {
        var result = {};
        $.each(arr, function (_, item) {
            var k = item[key] || 'other';
            if (!result[k]) result[k] = [];
            result[k].push(item);
        });
        return result;
    }

    function emptyState(icon, msg) {
        return '<div class="empty-state"><i class="material-icons">' + icon + '</i><p>' + msg + '</p></div>';
    }

    function toast(msg, type) {
        type = type || 'info';
        var $t = $('<div class="toast ' + type + '">' + escHtml(msg) + '</div>');
        $('#toastContainer').append($t);
        setTimeout(function () { $t.fadeOut(300, function () { $t.remove(); }); }, 3500);
    }

    // ============================================================
    //  EXPOSE PUBLIC API (for onclick handlers in rendered HTML)
    // ============================================================
    window.FSApp = {
        openVisit: openVisit,
        doWorkflow: doWorkflow,
        saveNotes: saveNotes,
        closeAction: closeAction,
        closeModal: closeModal,
        initWF: initWF,
        initWW: initWW
    };

})(jQuery);
