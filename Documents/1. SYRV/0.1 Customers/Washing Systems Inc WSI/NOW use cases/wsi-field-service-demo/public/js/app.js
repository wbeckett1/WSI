/* ══════════════════════════════════════════════════════════════
   WSI Field Service Reporting Platform — App Controller
   ══════════════════════════════════════════════════════════════ */

let currentUser = { user_id: 'USR-001', name: 'James Carter', role: 'technician' };
let sitesCache = [];
let usersCache = [];
let visitsCache = [];
let currentVisitId = null;

// ── Boot ──
document.addEventListener('DOMContentLoaded', async () => {
  // Date
  document.getElementById('dash-date').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  document.getElementById('nv-date').value = new Date().toISOString().split('T')[0];

  // Menu toggle
  document.getElementById('menu-toggle').addEventListener('click', toggleDrawer);
  document.getElementById('drawer-close').addEventListener('click', toggleDrawer);
  document.getElementById('drawer-overlay').addEventListener('click', toggleDrawer);

  // Brand link → dashboard
  document.getElementById('brand-home').addEventListener('click', e => { e.preventDefault(); showPage('dashboard'); });

  // Drawer nav
  document.querySelectorAll('.drawer-nav li').forEach(li =>
    li.addEventListener('click', () => { showPage(li.dataset.page); toggleDrawer(); })
  );

  // Bottom nav
  document.querySelectorAll('.bnav-item').forEach(btn =>
    btn.addEventListener('click', () => showPage(btn.dataset.page))
  );

  // User dropdown
  document.getElementById('user-pill').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('user-dropdown').classList.toggle('hidden');
  });
  document.addEventListener('click', () => document.getElementById('user-dropdown').classList.add('hidden'));

  document.querySelectorAll('.dropdown-item').forEach(el => {
    el.addEventListener('click', async () => {
      const uid = el.dataset.uid;
      const u = usersCache.find(u => u.user_id === uid);
      if (u) {
        currentUser = u;
        document.getElementById('current-user-name').textContent = u.name;
        document.getElementById('user-avatar').textContent = u.name.split(' ').map(n => n[0]).join('');
        document.getElementById('user-dropdown').classList.add('hidden');
        toast(`Switched to ${u.name}`);
        if (currentVisitId) openVisit(currentVisitId);
      }
    });
  });

  // Form
  document.getElementById('new-visit-form').addEventListener('submit', handleNewVisit);

  // Load data
  [sitesCache, usersCache] = await Promise.all([api('/api/sites'), api('/api/users')]);

  const siteSel = document.getElementById('nv-site');
  sitesCache.forEach(s => siteSel.innerHTML += `<option value="${s.site_id}">${s.account_name} — ${s.site_name}</option>`);
  const conSel = document.getElementById('nv-consultant');
  usersCache.filter(u => u.role === 'technician').forEach(u => conSel.innerHTML += `<option value="${u.user_id}">${u.name}</option>`);

  loadDashboard();
});

// ── Navigation ──
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.drawer-nav li').forEach(l => l.classList.remove('active'));
  document.querySelectorAll('.bnav-item').forEach(b => b.classList.remove('active'));

  const el = document.getElementById(`page-${page}`);
  if (el) el.classList.add('active');
  const nav = document.querySelector(`.drawer-nav li[data-page="${page}"]`);
  if (nav) nav.classList.add('active');
  const bnav = document.querySelector(`.bnav-item[data-page="${page}"]`);
  if (bnav) bnav.classList.add('active');

  window.scrollTo({ top: 0, behavior: 'instant' });

  if (page === 'dashboard') loadDashboard();
  else if (page === 'visits') loadVisits();
  else if (page === 'action-items') loadAllActions();
}

function toggleDrawer() {
  document.getElementById('side-drawer').classList.toggle('open');
  document.getElementById('drawer-overlay').classList.toggle('hidden');
}

// ── Helpers ──
async function api(url, opts) { return (await fetch(url, opts)).json(); }

function statusLabel(s) {
  return { planned:'Planned', in_progress:'In Progress', draft_complete:'Draft Complete', in_review:'In Review', approved:'Approved', published:'Published' }[s] || s;
}
function packLabel(p) {
  return { WF:'Wash Floor Review', WW:'Wastewater Review', 'WF+WW':'WF + WW Combined' }[p] || p;
}
function packIcon(p) { return p === 'WF' ? 'wf' : p === 'WW' ? 'ww' : 'combined'; }
function packIconFA(p) { return p.includes('WW') && p.includes('WF') ? 'fa-layer-group' : p === 'WW' ? 'fa-flask' : 'fa-tshirt'; }
function isEditable(s) { return ['planned','in_progress','draft_complete'].includes(s); }
function groupBy(arr, key) { return arr.reduce((a, i) => { (a[i[key]] = a[i[key]] || []).push(i); return a; }, {}); }
function initials(name) { return name.split(' ').map(n => n[0]).join(''); }
function escHtml(s) { return s ? s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : ''; }

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, 2500);
}

// ══════════════════ DASHBOARD ══════════════════
async function loadDashboard() {
  const data = await api('/api/dashboard');
  const sm = {};
  data.visitsByStatus.forEach(s => sm[s.status] = s.count);

  const inProg = sm['in_progress'] || 0;
  const planned = sm['planned'] || 0;
  document.getElementById('stats-grid').innerHTML = `
    <div class="kpi-card kpi-blue"><div class="kpi-label">Total Visits</div><div class="kpi-value">${data.totalVisits}</div><div class="kpi-sub">${inProg} in progress</div></div>
    <div class="kpi-card kpi-orange"><div class="kpi-label">Awaiting Review</div><div class="kpi-value">${sm['in_review'] || 0}</div><div class="kpi-sub">${planned} planned</div></div>
    <div class="kpi-card kpi-red"><div class="kpi-label">Priority Actions</div><div class="kpi-value">${data.criticalActions}</div><div class="kpi-sub">Open items</div></div>
    <div class="kpi-card kpi-green"><div class="kpi-label">Published</div><div class="kpi-value">${sm['published'] || 0}</div><div class="kpi-sub">${sm['approved'] || 0} approved</div></div>
  `;

  document.getElementById('recent-visits-list').innerHTML = data.recentVisits.length
    ? data.recentVisits.map(v => visitCard(v)).join('')
    : '<div class="empty"><i class="fas fa-inbox"></i><p>No visits yet</p></div>';

  // Action items
  visitsCache = await api('/api/visits');
  let allAct = [];
  for (const v of visitsCache) {
    const d = await api(`/api/visits/${v.visit_id}`);
    allAct.push(...d.actionItems.map(a => ({ ...a, site_name: v.site_name })));
  }
  const open = allAct.filter(a => a.status !== 'closed').sort((a,b) => severityWeight(b.severity) - severityWeight(a.severity)).slice(0, 6);

  document.getElementById('dashboard-actions-list').innerHTML = open.length
    ? open.map(a => actionCard(a)).join('')
    : '<div class="empty"><i class="fas fa-circle-check"></i><p>No priority actions</p></div>';
}

function severityWeight(s) { return { critical:4, high:3, medium:2, low:1 }[s] || 0; }

function visitCard(v) {
  return `<div class="visit-card" onclick="openVisit('${v.visit_id}')">
    <div class="vc-icon ${packIcon(v.report_pack)}"><i class="fas ${packIconFA(v.report_pack)}"></i></div>
    <div class="vc-info">
      <div class="vc-title">${escHtml(v.site_name)}</div>
      <div class="vc-meta">
        <span><i class="fas fa-calendar"></i> ${v.visit_date}</span>
        <span><i class="fas fa-user"></i> ${escHtml(v.consultant_name)}</span>
      </div>
    </div>
    <div class="vc-right">
      <span class="badge badge-${v.status}">${statusLabel(v.status)}</span>
      <i class="fas fa-chevron-right vc-chevron"></i>
    </div>
  </div>`;
}

function actionCard(a, clickVisit) {
  const click = clickVisit ? `onclick="openVisit('${a.visit_id}')"` : '';
  return `<div class="action-card" ${click}>
    <div class="ac-stripe ${a.severity}"></div>
    <div class="ac-body">
      <div class="ac-title">${escHtml(a.description)}</div>
      ${a.comments ? `<div class="ac-comment">${escHtml(a.comments)}</div>` : ''}
      <div class="ac-meta">
        ${a.site_name ? `<span><i class="fas fa-building"></i> ${escHtml(a.site_name)}</span>` : ''}
        <span><i class="fas fa-user"></i> ${escHtml(a.owner || 'Unassigned')}</span>
        <span><i class="fas fa-calendar"></i> ${a.due_date || 'No date'}</span>
      </div>
    </div>
    <div class="ac-right">
      <span class="badge badge-${a.severity}">${a.severity}</span>
      <span class="badge badge-${a.status === 'in_progress' ? 'in_progress_a' : a.status}">${a.status}</span>
    </div>
  </div>`;
}

// ══════════════════ VISITS LIST ══════════════════
let activeStatusFilter = '';

async function loadVisits() {
  visitsCache = await api('/api/visits');
  renderVisitsList();
}

function filterVisits(btn) {
  document.querySelectorAll('.filter-chips .chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  activeStatusFilter = btn.dataset.filterStatus;
  renderVisitsList();
}

function renderVisitsList() {
  const filtered = visitsCache.filter(v => !activeStatusFilter || v.status === activeStatusFilter);
  document.getElementById('visits-list-container').innerHTML = filtered.length
    ? `<div class="panel"><div class="panel-body">${filtered.map(v => visitCard(v)).join('')}</div></div>`
    : '<div class="empty"><i class="fas fa-search"></i><p>No visits match</p></div>';
}

// ══════════════════ VISIT DETAIL ══════════════════
async function openVisit(visitId) {
  currentVisitId = visitId;
  const v = await api(`/api/visits/${visitId}`);

  document.getElementById('visit-detail-title').textContent = v.site_name;
  document.getElementById('visit-detail-sub').textContent = `${v.visit_date} · ${packLabel(v.report_pack)} · ${v.consultant_name}`;

  // Header actions
  const acts = workflowActions(v.status);
  document.getElementById('visit-header-actions').innerHTML =
    acts.map(a => `<button class="btn btn-${a.cls} btn-sm" onclick="doWorkflow('${visitId}','${a.action}')"><i class="fas fa-${a.icon}"></i> ${a.label}</button>`).join('') +
    `<button class="btn btn-ghost btn-sm" onclick="showPDF('${visitId}')"><i class="fas fa-file-pdf"></i> PDF</button>`;

  // Workflow steps
  const states = ['planned','in_progress','draft_complete','in_review','approved','published'];
  const ci = states.indexOf(v.status);

  const haswf = v.report_pack.includes('WF');
  const hasww = v.report_pack.includes('WW');
  let tabs = ['Summary'];
  if (haswf) tabs.push('Wash Floor');
  if (hasww) tabs.push('Wastewater');
  tabs.push('Actions', 'Photos', 'Signatures', 'Audit');

  let html = '';

  // Workflow bar
  html += `<div class="workflow-steps">${states.map((s,i) =>
    `${i > 0 ? '<span class="wf-arrow"><i class="fas fa-chevron-right"></i></span>' : ''}
     <div class="wf-step ${i < ci ? 'done' : ''} ${i === ci ? 'active' : ''}">
       <span class="wf-dot">${i < ci ? '<i class="fas fa-check"></i>' : i+1}</span>
       ${statusLabel(s)}
     </div>`
  ).join('')}</div>`;

  // Tabs
  html += `<div class="seg-tabs">${tabs.map((t,i) =>
    `<button class="seg-tab ${i===0?'active':''}" onclick="switchTab(this,'${tabId(t)}')">${t}</button>`
  ).join('')}</div>`;

  // Summary
  html += `<div class="tab-pane active" id="tab-summary">
    <div class="panel" style="margin-bottom:16px">
      <div class="panel-header"><h2><i class="fas fa-building"></i> Site Details</h2></div>
      <div class="panel-body" style="padding:16px 20px">
        <div class="field-row">
          <div class="field"><label>Account</label><input value="${escHtml(v.account_name)}" readonly></div>
          <div class="field"><label>Site</label><input value="${escHtml(v.site_name)}" readonly></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Consultant</label><input value="${escHtml(v.consultant_name)}" readonly></div>
          <div class="field"><label>Visit Date</label><input value="${v.visit_date}" readonly></div>
        </div>
        <div class="field"><label>Address</label><input value="${escHtml(v.address || '')}" readonly></div>
        <div class="field"><label>Contacts</label><input value="${escHtml(v.contacts || '')}" readonly></div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-header"><h2><i class="fas fa-pen-to-square"></i> Visit Notes</h2></div>
      <div class="panel-body" style="padding:16px 20px">
        <div class="field"><label>Entrance / Follow-up</label><textarea id="ed-entrance" ${isEditable(v.status)?'':'readonly'}>${escHtml(v.entrance_notes || '')}</textarea></div>
        <div class="field"><label>General Observations</label><textarea id="ed-obs" ${isEditable(v.status)?'':'readonly'}>${escHtml(v.general_observations || '')}</textarea></div>
        <div class="field"><label>Exit Notes</label><textarea id="ed-exit" ${isEditable(v.status)?'':'readonly'}>${escHtml(v.exit_notes || '')}</textarea></div>
        <div class="field"><label>Distribution List</label><textarea id="ed-dist" ${isEditable(v.status)?'':'readonly'}>${escHtml(v.distribution_list || '')}</textarea></div>
        ${isEditable(v.status) ? `<button class="btn btn-accent" onclick="saveNotes('${visitId}','${v.status}')"><i class="fas fa-floppy-disk"></i> Save Notes</button>` : ''}
      </div>
    </div>
  </div>`;

  // WF Tab
  if (haswf) {
    const gr = groupBy(v.wfObservations, 'section');
    html += `<div class="tab-pane" id="tab-wash-floor">${renderWF(gr, v.status, visitId)}</div>`;
  }

  // WW Tab
  if (hasww) {
    const gr = groupBy(v.wwObservations, 'section');
    html += `<div class="tab-pane" id="tab-wastewater">${renderWW(gr, v.status, visitId)}</div>`;
  }

  // Actions Tab
  html += `<div class="tab-pane" id="tab-actions">
    <div class="panel">
      <div class="panel-header">
        <h2><i class="fas fa-list-check"></i> Action Items (${v.actionItems.length})</h2>
        ${isEditable(v.status) ? `<button class="btn btn-accent btn-sm" onclick="showAddAction('${visitId}')"><i class="fas fa-plus"></i> Add</button>` : ''}
      </div>
      <div class="panel-body">
        ${v.actionItems.length ? v.actionItems.map(a => `
          <div class="action-card">
            <div class="ac-stripe ${a.severity}"></div>
            <div class="ac-body">
              <div class="ac-title">${escHtml(a.description)}</div>
              ${a.comments ? `<div class="ac-comment">${escHtml(a.comments)}</div>` : ''}
              <div class="ac-meta">
                <span><i class="fas fa-tag"></i> ${a.section_ref || 'General'}</span>
                <span><i class="fas fa-user"></i> ${escHtml(a.owner || 'Unassigned')}</span>
                <span><i class="fas fa-calendar"></i> ${a.due_date || 'No date'}</span>
              </div>
            </div>
            <div class="ac-right">
              <span class="badge badge-${a.severity}">${a.severity}</span>
              <span class="badge badge-${a.status === 'in_progress' ? 'in_progress_a' : a.status}">${a.status}</span>
              ${a.status !== 'closed' ? `<button class="btn btn-success btn-sm" onclick="closeAction('${a.action_item_id}','${visitId}')"><i class="fas fa-check"></i></button>` : ''}
            </div>
          </div>`).join('')
        : '<div class="empty"><i class="fas fa-circle-check"></i><p>No action items</p></div>'}
      </div>
    </div>
  </div>`;

  // Photos Tab
  html += `<div class="tab-pane" id="tab-photos">
    <div class="panel">
      <div class="panel-header">
        <h2><i class="fas fa-camera"></i> Photos &amp; Evidence</h2>
        ${isEditable(v.status) ? `<button class="btn btn-accent btn-sm" onclick="showPhotoUpload('${visitId}')"><i class="fas fa-upload"></i> Upload</button>` : ''}
      </div>
      ${v.photos.length
        ? `<div class="photo-grid">${v.photos.map(p => `
            <div class="photo-card">
              <img src="${p.file_path}" alt="${escHtml(p.caption || '')}">
              <div class="caption">${escHtml(p.caption || 'No caption')}</div>
            </div>`).join('')}</div>`
        : '<div class="panel-body"><div class="empty"><i class="fas fa-image"></i><p>No photos yet</p></div></div>'}
    </div>
  </div>`;

  // Signatures Tab
  html += `<div class="tab-pane" id="tab-signatures">
    <div class="panel">
      <div class="panel-header"><h2><i class="fas fa-signature"></i> Signatures</h2></div>
      <div class="panel-body">
        ${v.signatures.map(s => `
          <div class="sig-item">
            <div class="sig-icon"><i class="fas fa-pen-nib"></i></div>
            <div><strong>${escHtml(s.signer_name)}</strong> <span style="color:var(--n400);font-size:13px">(${escHtml(s.signer_role)})</span><br><small style="color:var(--n400)">${s.signed_at}</small></div>
          </div>`).join('')}
        ${isEditable(v.status) || v.status === 'draft_complete' ? `
          <div class="sig-pad">
            <p><i class="fas fa-pen"></i> Sign below</p>
            <canvas id="sig-canvas" width="400" height="120"></canvas>
            <div class="sig-controls">
              <input type="text" id="sig-name" placeholder="Signer name">
              <select id="sig-role">
                <option value="Technician">Technician</option>
                <option value="Plant Manager">Plant Manager</option>
                <option value="Operator">Operator</option>
              </select>
              <button class="btn btn-accent btn-sm" onclick="saveSig('${visitId}')"><i class="fas fa-save"></i> Save</button>
              <button class="btn btn-ghost btn-sm" onclick="clearSig()">Clear</button>
            </div>
          </div>` : ''}
      </div>
    </div>
  </div>`;

  // Audit Tab
  html += `<div class="tab-pane" id="tab-audit">
    <div class="panel">
      <div class="panel-header"><h2><i class="fas fa-clock-rotate-left"></i> Audit Trail</h2></div>
      <div class="audit-timeline">
        ${v.approvals.length ? v.approvals.map(a => `
          <div class="audit-entry">
            <div class="audit-marker"><i class="fas fa-${a.decision === 'approve' ? 'check' : a.decision === 'reject' ? 'rotate-left' : a.decision === 'publish' ? 'globe' : 'paper-plane'}"></i></div>
            <div class="audit-content">
              <strong>${escHtml(a.actor_name)}</strong>
              <span class="badge badge-${a.decision === 'approve' ? 'approved' : a.decision === 'reject' ? 'high' : 'in_progress'}" style="margin-left:6px">${a.decision}</span>
              ${a.comment ? `<div style="color:var(--n600);font-size:13px;margin-top:2px">${escHtml(a.comment)}</div>` : ''}
              <div class="audit-time">${a.timestamp}</div>
            </div>
          </div>`).join('')
        : '<div class="empty"><p>No events yet</p></div>'}
      </div>
    </div>
  </div>`;

  document.getElementById('visit-detail-content').innerHTML = html;
  showPage('visit-detail');
  setTimeout(initSigCanvas, 100);
}

function tabId(t) { return t.toLowerCase().replace(/\s+/g, '-'); }

function switchTab(el, id) {
  el.parentElement.querySelectorAll('.seg-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  el.closest('.page').querySelectorAll('.tab-pane').forEach(t => t.classList.remove('active'));
  const pane = document.getElementById(`tab-${id}`);
  if (pane) pane.classList.add('active');
}

// ══════════════════ WF RENDERING ══════════════════
function renderWF(grouped, status, visitId) {
  const labels = { plant_ops:'Plant Operations', kpi:'Key Performance Indicators', wash_practices:'Wash Practices' };
  const icons = { plant_ops:'fa-temperature-half', kpi:'fa-chart-column', wash_practices:'fa-clipboard-check' };
  let html = '';
  for (const [sec, obs] of Object.entries(grouped)) {
    html += `<div class="panel obs-panel" style="margin-bottom:16px">
      <div class="panel-header"><h2><i class="fas ${icons[sec] || 'fa-cogs'}"></i> ${labels[sec] || sec}</h2></div>
      <table class="obs-table"><thead><tr><th>Measurement</th><th>Value</th><th>Unit</th><th>Range</th><th>Status</th><th>Notes</th></tr></thead><tbody>
      ${obs.map(o => {
        const val = parseFloat(o.value);
        let dot = 'ok', text = 'OK';
        if (o.flag) { dot = 'alert'; text = o.flag; }
        else if (!isNaN(val) && o.threshold_high && val > o.threshold_high) { dot = 'alert'; text = 'Above'; }
        else if (!isNaN(val) && o.threshold_low && val < o.threshold_low) { dot = 'warn'; text = 'Below'; }
        else if (o.value === 'No') { dot = 'alert'; text = 'Non-compliant'; }
        return `<tr>
          <td><strong>${escHtml(o.field_label)}</strong></td>
          <td>${isEditable(status) ? `<input value="${escHtml(o.value || '')}">` : (o.value || '—')}</td>
          <td class="range-text">${o.unit || ''}</td>
          <td class="range-text">${o.threshold_low != null || o.threshold_high != null ? `${o.threshold_low ?? ''} – ${o.threshold_high ?? ''}` : ''}</td>
          <td><span class="status-dot ${dot}">${text}</span></td>
          <td>${o.notes ? `<span class="obs-note">${escHtml(o.notes)}</span>` : ''}</td>
        </tr>`;
      }).join('')}
      </tbody></table></div>`;
  }
  if (!Object.keys(grouped).length && isEditable(status)) {
    html += `<div class="info-banner"><i class="fas fa-info-circle"></i> No wash floor data yet.</div>
      <button class="btn btn-accent" onclick="initWF('${visitId}')"><i class="fas fa-plus"></i> Initialize Wash Floor Template</button>`;
  }
  return html;
}

// ══════════════════ WW RENDERING ══════════════════
function renderWW(grouped, status, visitId) {
  const labels = { treatment:'Treatment System Audit', compliance:'Compliance & Cost', training:'Operations & Training' };
  const icons = { treatment:'fa-flask-vial', compliance:'fa-shield-halved', training:'fa-graduation-cap' };
  let html = '';
  for (const [sec, obs] of Object.entries(grouped)) {
    html += `<div class="panel obs-panel" style="margin-bottom:16px">
      <div class="panel-header"><h2><i class="fas ${icons[sec] || 'fa-cogs'}"></i> ${labels[sec] || sec}</h2></div>
      <table class="obs-table"><thead><tr><th>Item</th><th>Value</th><th>Unit</th><th>Range</th><th>Status</th><th>Notes</th></tr></thead><tbody>
      ${obs.map(o => {
        let dot = o.status === 'OK' ? 'ok' : o.status === 'Not OK' ? 'alert' : 'ok';
        return `<tr>
          <td><strong>${escHtml(o.field_label)}</strong></td>
          <td>${isEditable(status) ? `<input value="${escHtml(o.value || '')}">` : (o.value || '—')}</td>
          <td class="range-text">${o.unit || ''}</td>
          <td class="range-text">${o.threshold_low != null || o.threshold_high != null ? `${o.threshold_low ?? ''} – ${o.threshold_high ?? ''}` : ''}</td>
          <td><span class="status-dot ${dot}">${o.status || ''}</span></td>
          <td>${o.notes ? `<span class="obs-note">${escHtml(o.notes)}</span>` : ''}</td>
        </tr>`;
      }).join('')}
      </tbody></table></div>`;
  }
  if (!Object.keys(grouped).length && isEditable(status)) {
    html += `<div class="info-banner"><i class="fas fa-info-circle"></i> No wastewater data yet.</div>
      <button class="btn btn-accent" onclick="initWW('${visitId}')"><i class="fas fa-plus"></i> Initialize Wastewater Template</button>`;
  }
  return html;
}

// ══════════════════ TEMPLATES ══════════════════
async function initWF(visitId) {
  const t = [
    { section:'plant_ops', field_code:'hot_water_temp', field_label:'Hot Water Temperature', value:'', unit:'°F', threshold_low:140, threshold_high:160 },
    { section:'plant_ops', field_code:'hardness', field_label:'Water Hardness', value:'', unit:'gpg', threshold_high:5 },
    { section:'plant_ops', field_code:'iron', field_label:'Iron Level', value:'', unit:'ppm', threshold_high:1.0 },
    { section:'plant_ops', field_code:'alkalinity', field_label:'Alkalinity', value:'', unit:'ppm', threshold_low:80, threshold_high:120 },
    { section:'plant_ops', field_code:'ph', field_label:'pH Level', value:'', unit:'', threshold_low:6.5, threshold_high:8.5 },
    { section:'plant_ops', field_code:'bleach_strength', field_label:'Bleach Concentration', value:'', unit:'%', threshold_low:10, threshold_high:12.5 },
    { section:'kpi', field_code:'daily_cwt', field_label:'Daily CWT', value:'', unit:'lbs' },
    { section:'kpi', field_code:'gallons_per_lb', field_label:'Gallons/Lb', value:'', unit:'gal/lb', threshold_high:2.5 },
    { section:'kpi', field_code:'therms_per_cwt', field_label:'Therms/CWT', value:'', unit:'therms', threshold_high:0.5 },
    { section:'kpi', field_code:'chem_cost_cwt', field_label:'Chemical $/CWT', value:'', unit:'$/cwt', threshold_high:2.5 },
    { section:'wash_practices', field_code:'weighing', field_label:'Proper Weighing', value:'', unit:'' },
    { section:'wash_practices', field_code:'sorting', field_label:'Proper Sorting', value:'', unit:'' },
    { section:'wash_practices', field_code:'formula_select', field_label:'Formula Selection', value:'', unit:'' },
    { section:'wash_practices', field_code:'steam_leaks', field_label:'Steam Leaks Present', value:'', unit:'' },
    { section:'wash_practices', field_code:'load_accuracy', field_label:'Load Accuracy', value:'', unit:'' },
  ];
  await api(`/api/visits/${visitId}/wf`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({observations:t}) });
  openVisit(visitId);
}

async function initWW(visitId) {
  const t = [
    { section:'treatment', field_code:'ph_treatment', field_label:'Treatment pH', value:'', unit:'', threshold_low:7.0, threshold_high:9.0, status:'' },
    { section:'treatment', field_code:'ph_discharge', field_label:'Discharge pH', value:'', unit:'', threshold_low:6.0, threshold_high:9.0, status:'' },
    { section:'treatment', field_code:'coagulant_dose', field_label:'Coagulant Dosage', value:'', unit:'ppm', threshold_low:30, threshold_high:60, status:'' },
    { section:'treatment', field_code:'flocculant_dose', field_label:'Flocculant Dosage', value:'', unit:'ppm', threshold_low:8, threshold_high:20, status:'' },
    { section:'treatment', field_code:'daf_status', field_label:'DAF Status', value:'', unit:'', status:'' },
    { section:'treatment', field_code:'filter_press', field_label:'Filter Press', value:'', unit:'', status:'' },
    { section:'compliance', field_code:'target_cost', field_label:'Target $/1000 gal', value:'', unit:'$/1000gal' },
    { section:'compliance', field_code:'actual_cost', field_label:'Actual $/1000 gal (90-day)', value:'', unit:'$/1000gal' },
    { section:'compliance', field_code:'treatment_pct', field_label:'Treatment Percentage', value:'', unit:'%', threshold_low:90, threshold_high:100, status:'' },
    { section:'training', field_code:'log_discipline', field_label:'Log Sheet Discipline', value:'', unit:'', status:'' },
    { section:'training', field_code:'operator_training', field_label:'Operator Training Current', value:'', unit:'', status:'' },
  ];
  await api(`/api/visits/${visitId}/ww`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({observations:t}) });
  openVisit(visitId);
}

// ══════════════════ WORKFLOW ══════════════════
function workflowActions(status) {
  return {
    'planned': [{ action:'start', label:'Start Visit', cls:'accent', icon:'play' }],
    'in_progress': [{ action:'complete', label:'Complete Draft', cls:'warning', icon:'check' }],
    'draft_complete': [{ action:'submit', label:'Submit for Review', cls:'accent', icon:'paper-plane' }],
    'in_review': [
      { action:'approve', label:'Approve', cls:'success', icon:'thumbs-up' },
      { action:'reject', label:'Return', cls:'danger', icon:'rotate-left' }
    ],
    'approved': [{ action:'publish', label:'Publish', cls:'success', icon:'globe' }],
    'published': []
  }[status] || [];
}

async function doWorkflow(visitId, action) {
  let comment = '';
  if (action === 'reject') {
    comment = prompt('Reason for returning this report:');
    if (comment === null) return;
  }
  await api(`/api/visits/${visitId}/workflow`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ action, actor_id: currentUser.user_id, comment })
  });
  toast(action === 'publish' ? 'Report published!' : `Visit ${action}ed`);
  openVisit(visitId);
}

async function saveNotes(visitId, status) {
  await api(`/api/visits/${visitId}`, {
    method:'PUT', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      entrance_notes: document.getElementById('ed-entrance').value,
      general_observations: document.getElementById('ed-obs').value,
      exit_notes: document.getElementById('ed-exit').value,
      distribution_list: document.getElementById('ed-dist').value,
      status
    })
  });
  toast('Notes saved');
}

// ══════════════════ CREATE VISIT ══════════════════
async function handleNewVisit(e) {
  e.preventDefault();
  const result = await api('/api/visits', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      site_id: document.getElementById('nv-site').value,
      consultant_id: document.getElementById('nv-consultant').value,
      visit_date: document.getElementById('nv-date').value,
      report_pack: document.getElementById('nv-pack').value,
    })
  });
  toast('Visit created!');
  openVisit(result.visit_id);
}

// ══════════════════ ACTION ITEMS ══════════════════
function showAddAction(visitId) {
  openModal(`
    <h2><i class="fas fa-plus-circle"></i> New Action Item</h2>
    <form id="ai-form">
      <div class="field"><label>Description</label><textarea id="ai-desc" required placeholder="Describe what needs to be done..."></textarea></div>
      <div class="field-row">
        <div class="field"><label>Severity</label>
          <select id="ai-sev"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option><option value="critical">Critical</option></select>
        </div>
        <div class="field"><label>Section</label>
          <select id="ai-sec"><option value="">General</option><option value="plant_ops">Plant Operations</option><option value="wash_practices">Wash Practices</option><option value="treatment">Treatment</option><option value="compliance">Compliance</option><option value="training">Training</option></select>
        </div>
      </div>
      <div class="field-row">
        <div class="field"><label>Owner</label><input id="ai-owner" placeholder="Responsible party"></div>
        <div class="field"><label>Due Date</label><input type="date" id="ai-due"></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button type="submit" class="btn btn-accent"><i class="fas fa-save"></i> Save</button>
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      </div>
    </form>
  `);
  document.getElementById('ai-form').onsubmit = async (e) => {
    e.preventDefault();
    await api('/api/action-items', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        visit_id: visitId,
        section_ref: document.getElementById('ai-sec').value,
        description: document.getElementById('ai-desc').value,
        severity: document.getElementById('ai-sev').value,
        owner: document.getElementById('ai-owner').value,
        due_date: document.getElementById('ai-due').value,
      })
    });
    closeModal();
    toast('Action item added');
    openVisit(visitId);
  };
}

async function closeAction(actionId, visitId) {
  await api(`/api/action-items/${actionId}`, {
    method:'PUT', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ status:'closed', comments: `Closed by ${currentUser.name}` })
  });
  toast('Closed');
  openVisit(visitId);
}

async function loadAllActions() {
  const visits = await api('/api/visits');
  let all = [];
  for (const v of visits) {
    const d = await api(`/api/visits/${v.visit_id}`);
    all.push(...d.actionItems.map(a => ({ ...a, site_name: v.site_name })));
  }
  all.sort((a,b) => severityWeight(b.severity) - severityWeight(a.severity));

  document.getElementById('all-actions-list').innerHTML = all.length
    ? `<div class="panel"><div class="panel-body">${all.map(a => actionCard(a, true)).join('')}</div></div>`
    : '<div class="empty"><i class="fas fa-circle-check"></i><p>No action items</p></div>';
}

// ══════════════════ PHOTOS ══════════════════
function showPhotoUpload(visitId) {
  openModal(`
    <h2><i class="fas fa-camera"></i> Upload Photo</h2>
    <form id="ph-form" enctype="multipart/form-data">
      <div class="field"><label>Photo</label><input type="file" id="ph-file" accept="image/*" required style="padding:10px"></div>
      <div class="field"><label>Caption</label><input id="ph-cap" placeholder="What does this show?"></div>
      <div class="field"><label>Section</label>
        <select id="ph-sec"><option value="">General</option><option value="plant_ops">Plant Ops</option><option value="wash_practices">Wash Practices</option><option value="treatment">Treatment</option><option value="equipment">Equipment</option></select>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button type="submit" class="btn btn-accent"><i class="fas fa-upload"></i> Upload</button>
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      </div>
    </form>
  `);
  document.getElementById('ph-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('photo', document.getElementById('ph-file').files[0]);
    fd.append('caption', document.getElementById('ph-cap').value);
    fd.append('section_ref', document.getElementById('ph-sec').value);
    await fetch(`/api/visits/${visitId}/photos`, { method:'POST', body: fd });
    closeModal();
    toast('Photo uploaded');
    openVisit(visitId);
  };
}

// ══════════════════ SIGNATURES ══════════════════
let sigDrawing = false;
function initSigCanvas() {
  const c = document.getElementById('sig-canvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  ctx.strokeStyle = '#0047AB'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';

  c.addEventListener('pointerdown', e => { sigDrawing = true; ctx.beginPath(); const r = c.getBoundingClientRect(); ctx.moveTo(e.clientX-r.left, e.clientY-r.top); });
  c.addEventListener('pointermove', e => { if (!sigDrawing) return; const r = c.getBoundingClientRect(); ctx.lineTo(e.clientX-r.left, e.clientY-r.top); ctx.stroke(); });
  c.addEventListener('pointerup', () => sigDrawing = false);
  c.addEventListener('pointerleave', () => sigDrawing = false);
}
function clearSig() { const c = document.getElementById('sig-canvas'); if (c) c.getContext('2d').clearRect(0,0,c.width,c.height); }

async function saveSig(visitId) {
  const name = document.getElementById('sig-name').value;
  if (!name) { toast('Enter signer name'); return; }
  const c = document.getElementById('sig-canvas');
  await api(`/api/visits/${visitId}/signatures`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ signer_name: name, signer_role: document.getElementById('sig-role').value, signature_data: c ? c.toDataURL() : '' })
  });
  toast('Signature saved');
  openVisit(visitId);
}

// ══════════════════ PDF PREVIEW ══════════════════
async function showPDF(visitId) {
  const v = await api(`/api/visits/${visitId}`);
  const wfG = groupBy(v.wfObservations, 'section');
  const wwG = groupBy(v.wwObservations, 'section');

  let wfHtml = '';
  for (const [s, obs] of Object.entries(wfG)) {
    wfHtml += `<h2>Wash Floor — ${s.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())}</h2>
    <table><thead><tr><th>Measurement</th><th>Value</th><th>Unit</th><th>Status</th></tr></thead><tbody>
    ${obs.map(o => `<tr><td>${o.field_label}</td><td>${o.value||'—'}</td><td>${o.unit||''}</td><td>${o.flag||(o.value==='No'?'Non-compliant':'OK')}</td></tr>`).join('')}
    </tbody></table>`;
  }
  let wwHtml = '';
  for (const [s, obs] of Object.entries(wwG)) {
    wwHtml += `<h2>Wastewater — ${s.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())}</h2>
    <table><thead><tr><th>Item</th><th>Value</th><th>Unit</th><th>Status</th></tr></thead><tbody>
    ${obs.map(o => `<tr><td>${o.field_label}</td><td>${o.value||'—'}</td><td>${o.unit||''}</td><td>${o.status||''}</td></tr>`).join('')}
    </tbody></table>`;
  }

  openModal(`<div class="pdf-preview">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <h1>WSI Five Star Service Report</h1>
      <button class="btn btn-ghost btn-sm" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <table>
      <tr><th>Account</th><td>${v.account_name}</td><th>Site</th><td>${v.site_name}</td></tr>
      <tr><th>Date</th><td>${v.visit_date}</td><th>Consultant</th><td>${v.consultant_name}</td></tr>
      <tr><th>Pack</th><td>${packLabel(v.report_pack)}</td><th>Status</th><td>${statusLabel(v.status)}</td></tr>
    </table>
    ${v.entrance_notes ? `<h2>Entrance Notes</h2><p>${escHtml(v.entrance_notes)}</p>` : ''}
    ${v.general_observations ? `<h2>Observations</h2><p>${escHtml(v.general_observations)}</p>` : ''}
    ${wfHtml}${wwHtml}
    ${v.actionItems.length ? `<h2>Action Items</h2><table><thead><tr><th>Item</th><th>Severity</th><th>Owner</th><th>Due</th><th>Status</th></tr></thead><tbody>
    ${v.actionItems.map(a=>`<tr><td>${a.description}</td><td>${a.severity}</td><td>${a.owner||''}</td><td>${a.due_date||''}</td><td>${a.status}</td></tr>`).join('')}</tbody></table>` : ''}
    ${v.signatures.length ? `<h2>Signatures</h2>${v.signatures.map(s=>`<p><strong>${s.signer_name}</strong> (${s.signer_role}) — ${s.signed_at}</p>`).join('')}` : ''}
    <div class="pdf-footer"><p>Generated by WSI Field Service Platform · ${new Date().toLocaleString()}</p></div>
  </div>`, true);
}

// ══════════════════ MODAL ══════════════════
function openModal(html, wide) {
  const mc = document.getElementById('modal-content');
  mc.innerHTML = html;
  mc.style.maxWidth = wide ? '800px' : '560px';
  document.getElementById('modal-overlay').classList.remove('hidden');
}
function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}
document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
