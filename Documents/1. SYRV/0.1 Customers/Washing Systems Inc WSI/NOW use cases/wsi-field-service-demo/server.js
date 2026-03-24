const express = require('express');
const Database = require('better-sqlite3');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Multer for photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

// ── Database Setup ──────────────────────────────────────────────────────
const db = new Database(path.join(__dirname, 'wsi_demo.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
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
    role TEXT NOT NULL CHECK(role IN ('technician','reviewer','admin')),
    email TEXT
  );

  CREATE TABLE IF NOT EXISTS visits (
    visit_id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL REFERENCES sites(site_id),
    consultant_id TEXT NOT NULL REFERENCES users(user_id),
    visit_date TEXT NOT NULL,
    report_pack TEXT NOT NULL CHECK(report_pack IN ('WF','WW','WF+WW')),
    status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','in_progress','draft_complete','in_review','approved','published')),
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
    status TEXT CHECK(status IN ('OK','Not OK','N/A','')),
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS action_items (
    action_item_id TEXT PRIMARY KEY,
    visit_id TEXT NOT NULL REFERENCES visits(visit_id),
    section_ref TEXT,
    description TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium' CHECK(severity IN ('low','medium','high','critical')),
    owner TEXT,
    due_date TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','closed')),
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
    decision TEXT NOT NULL CHECK(decision IN ('submit','approve','reject','publish')),
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
`);

// ── Seed Demo Data ──────────────────────────────────────────────────────
const siteCount = db.prepare('SELECT COUNT(*) as c FROM sites').get().c;
if (siteCount === 0) {
  const insertSite = db.prepare('INSERT INTO sites VALUES (?,?,?,?,?,?)');
  insertSite.run('SITE-001', 'Alsco', 'Alsco Alexandria', '1234 Industrial Blvd, Alexandria, VA', 'WF,WW', 'Mike Johnson (Plant Mgr), Sarah Lee (Ops)');
  insertSite.run('SITE-002', 'Cintas', 'Cintas Aston', '5678 Commerce Dr, Aston, PA', 'WF,WW', 'Tom Brown (Plant Mgr), Lisa Chen (WW Ops)');
  insertSite.run('SITE-003', 'UniFirst', 'UniFirst Region 9', '910 Service Way, Newark, NJ', 'WF', 'Dave Wilson (Regional Mgr)');
  insertSite.run('SITE-004', 'Alsco', 'Alsco Portland', '2200 River Rd, Portland, OR', 'WW', 'Amy Park (Plant Mgr)');

  const insertUser = db.prepare('INSERT INTO users VALUES (?,?,?,?)');
  insertUser.run('USR-001', 'James Carter', 'technician', 'jcarter@wsi.com');
  insertUser.run('USR-002', 'Maria Santos', 'technician', 'msantos@wsi.com');
  insertUser.run('USR-003', 'Robert Kim', 'reviewer', 'rkim@wsi.com');
  insertUser.run('USR-004', 'Patricia Allen', 'admin', 'pallen@wsi.com');

  // Seed some demo visits
  const insertVisit = db.prepare(`INSERT INTO visits (visit_id,site_id,consultant_id,visit_date,report_pack,status,entrance_notes,general_observations) VALUES (?,?,?,?,?,?,?,?)`);
  insertVisit.run('VIS-001','SITE-001','USR-001','2026-03-07','WF+WW','in_review','Discussed open action items from last visit. Plant manager noted increased water usage.','Overall plant in good condition. Hot water system running well. Some bleach concentration issues noted.');
  insertVisit.run('VIS-002','SITE-002','USR-002','2026-03-05','WF','approved','Reviewed wash quality complaints from last month.','Steam tunnel needs attention. Load accuracy has improved since last visit.');
  insertVisit.run('VIS-003','SITE-003','USR-001','2026-03-09','WF','planned',null,null);
  insertVisit.run('VIS-004','SITE-004','USR-002','2026-03-08','WW','in_progress','Met with Amy Park to review treatment system.','DAF system performing well. Filter press needs maintenance.');

  // Seed WF observations for VIS-001
  const insertWF = db.prepare('INSERT INTO wf_observations (visit_id,section,field_code,field_label,value,unit,threshold_low,threshold_high,flag,notes) VALUES (?,?,?,?,?,?,?,?,?,?)');
  insertWF.run('VIS-001','plant_ops','hot_water_temp','Hot Water Temperature','148','°F',140,160,null,null);
  insertWF.run('VIS-001','plant_ops','hardness','Water Hardness','3.2','gpg',null,5,null,null);
  insertWF.run('VIS-001','plant_ops','iron','Iron Level','0.8','ppm',null,1.0,null,null);
  insertWF.run('VIS-001','plant_ops','alkalinity','Alkalinity','95','ppm',80,120,null,null);
  insertWF.run('VIS-001','plant_ops','ph','pH Level','7.2','',6.5,8.5,null,null);
  insertWF.run('VIS-001','plant_ops','bleach_strength','Bleach Concentration','8.5','%',10,12.5,'low','Below target range - recommend fresh supply');
  insertWF.run('VIS-001','kpi','daily_cwt','Daily CWT','2850','lbs',null,null,null,null);
  insertWF.run('VIS-001','kpi','gallons_per_lb','Gallons/Lb','2.1','gal/lb',null,2.5,null,null);
  insertWF.run('VIS-001','kpi','therms_per_cwt','Therms/CWT','0.42','therms',null,0.5,null,null);
  insertWF.run('VIS-001','kpi','chem_cost_cwt','Chemical $/CWT','1.85','$/cwt',null,2.5,null,null);
  insertWF.run('VIS-001','wash_practices','weighing','Proper Weighing','Yes','',null,null,null,null);
  insertWF.run('VIS-001','wash_practices','sorting','Proper Sorting','Yes','',null,null,null,null);
  insertWF.run('VIS-001','wash_practices','formula_select','Formula Selection','Yes','',null,null,null,null);
  insertWF.run('VIS-001','wash_practices','steam_leaks','Steam Leaks Present','Yes','',null,null,'issue','Minor leak at tunnel junction 3');
  insertWF.run('VIS-001','wash_practices','load_accuracy','Load Accuracy','No','',null,null,'issue','Overloading observed on 2 of 5 lines');

  // Seed WW observations for VIS-001
  const insertWW = db.prepare('INSERT INTO ww_observations (visit_id,section,field_code,field_label,value,unit,threshold_low,threshold_high,status,notes) VALUES (?,?,?,?,?,?,?,?,?,?)');
  insertWW.run('VIS-001','treatment','ph_treatment','Treatment pH','8.1','',7.0,9.0,'OK',null);
  insertWW.run('VIS-001','treatment','ph_discharge','Discharge pH','7.4','',6.0,9.0,'OK','Within permit limits');
  insertWW.run('VIS-001','treatment','coagulant_dose','Coagulant Dosage','45','ppm',30,60,'OK',null);
  insertWW.run('VIS-001','treatment','flocculant_dose','Flocculant Dosage','12','ppm',8,20,'OK',null);
  insertWW.run('VIS-001','treatment','daf_status','DAF Status',null,null,null,null,'OK','Running within parameters');
  insertWW.run('VIS-001','treatment','filter_press','Filter Press',null,null,null,null,'OK','Cakes dry and consistent');
  insertWW.run('VIS-001','compliance','target_cost','Target $/1000 gal','4.50','$/1000gal',null,null,null,null);
  insertWW.run('VIS-001','compliance','actual_cost','Actual $/1000 gal (90-day)','4.85','$/1000gal',null,null,null,'Slightly above target');
  insertWW.run('VIS-001','compliance','treatment_pct','Treatment Percentage','94','%',90,100,'OK',null);
  insertWW.run('VIS-001','training','log_discipline','Log Sheet Discipline',null,null,null,null,'OK','Logs up to date');
  insertWW.run('VIS-001','training','operator_training','Operator Training Current',null,null,null,null,'Not OK','New hire needs pH calibration training');

  // Seed action items
  const insertAction = db.prepare('INSERT INTO action_items (action_item_id,visit_id,section_ref,description,severity,owner,due_date,status,comments) VALUES (?,?,?,?,?,?,?,?,?)');
  insertAction.run('ACT-001','VIS-001','plant_ops','Replace bleach supply - concentration below minimum','high','Plant Manager','2026-03-14','open','Current stock at 8.5%, target is 10-12.5%');
  insertAction.run('ACT-002','VIS-001','wash_practices','Repair steam leak at tunnel junction 3','medium','Maintenance','2026-03-21','open',null);
  insertAction.run('ACT-003','VIS-001','wash_practices','Retrain operators on proper load weights - overloading on lines 2 and 4','high','Shift Supervisor','2026-03-14','open',null);
  insertAction.run('ACT-004','VIS-001','training','Schedule pH calibration training for new operator','medium','Plant Manager','2026-03-21','open',null);
  insertAction.run('ACT-005','VIS-002','wash_practices','Steam tunnel inspection and maintenance','high','Maintenance','2026-03-12','in_progress','Parts ordered');

  // Seed approval events
  const insertApproval = db.prepare('INSERT INTO approval_events (visit_id,stage,actor_id,decision,comment,timestamp) VALUES (?,?,?,?,?,?)');
  insertApproval.run('VIS-001','submission','USR-001','submit','Ready for review','2026-03-07 16:30:00');
  insertApproval.run('VIS-002','submission','USR-002','submit',null,'2026-03-05 17:00:00');
  insertApproval.run('VIS-002','review','USR-003','approve','Good report, ready for customer','2026-03-06 09:15:00');
}

// ── API Routes ──────────────────────────────────────────────────────────

// Dashboard stats
app.get('/api/dashboard', (req, res) => {
  const visitsByStatus = db.prepare(`
    SELECT status, COUNT(*) as count FROM visits GROUP BY status
  `).all();
  const totalVisits = db.prepare('SELECT COUNT(*) as c FROM visits').get().c;
  const openActions = db.prepare("SELECT COUNT(*) as c FROM action_items WHERE status != 'closed'").get().c;
  const criticalActions = db.prepare("SELECT COUNT(*) as c FROM action_items WHERE severity IN ('high','critical') AND status != 'closed'").get().c;
  const recentVisits = db.prepare(`
    SELECT v.*, s.account_name, s.site_name, u.name as consultant_name
    FROM visits v
    JOIN sites s ON v.site_id = s.site_id
    JOIN users u ON v.consultant_id = u.user_id
    ORDER BY v.visit_date DESC LIMIT 10
  `).all();

  res.json({ visitsByStatus, totalVisits, openActions, criticalActions, recentVisits });
});

// Sites
app.get('/api/sites', (req, res) => {
  res.json(db.prepare('SELECT * FROM sites ORDER BY account_name').all());
});

// Users
app.get('/api/users', (req, res) => {
  res.json(db.prepare('SELECT * FROM users ORDER BY name').all());
});

// Visits CRUD
app.get('/api/visits', (req, res) => {
  const visits = db.prepare(`
    SELECT v.*, s.account_name, s.site_name, u.name as consultant_name
    FROM visits v
    JOIN sites s ON v.site_id = s.site_id
    JOIN users u ON v.consultant_id = u.user_id
    ORDER BY v.visit_date DESC
  `).all();
  res.json(visits);
});

app.get('/api/visits/:id', (req, res) => {
  const visit = db.prepare(`
    SELECT v.*, s.account_name, s.site_name, s.address, s.contacts, s.service_lines,
           u.name as consultant_name, u.email as consultant_email
    FROM visits v
    JOIN sites s ON v.site_id = s.site_id
    JOIN users u ON v.consultant_id = u.user_id
    WHERE v.visit_id = ?
  `).get(req.params.id);
  if (!visit) return res.status(404).json({ error: 'Visit not found' });

  const wfObs = db.prepare('SELECT * FROM wf_observations WHERE visit_id = ? ORDER BY section, id').all(req.params.id);
  const wwObs = db.prepare('SELECT * FROM ww_observations WHERE visit_id = ? ORDER BY section, id').all(req.params.id);
  const actions = db.prepare('SELECT * FROM action_items WHERE visit_id = ? ORDER BY severity DESC, created_at').all(req.params.id);
  const photos = db.prepare('SELECT * FROM attachments WHERE visit_id = ? ORDER BY created_at').all(req.params.id);
  const approvals = db.prepare('SELECT ae.*, u.name as actor_name FROM approval_events ae JOIN users u ON ae.actor_id = u.user_id WHERE ae.visit_id = ? ORDER BY ae.timestamp').all(req.params.id);
  const sigs = db.prepare('SELECT * FROM signatures WHERE visit_id = ? ORDER BY signed_at').all(req.params.id);

  res.json({ ...visit, wfObservations: wfObs, wwObservations: wwObs, actionItems: actions, photos, approvals, signatures: sigs });
});

app.post('/api/visits', (req, res) => {
  const id = `VIS-${uuidv4().slice(0,8).toUpperCase()}`;
  const { site_id, consultant_id, visit_date, report_pack } = req.body;
  db.prepare('INSERT INTO visits (visit_id,site_id,consultant_id,visit_date,report_pack) VALUES (?,?,?,?,?)').run(id, site_id, consultant_id, visit_date, report_pack);
  res.json({ visit_id: id });
});

app.put('/api/visits/:id', (req, res) => {
  const { entrance_notes, general_observations, exit_notes, distribution_list, status } = req.body;
  db.prepare(`UPDATE visits SET entrance_notes=?, general_observations=?, exit_notes=?, distribution_list=?, status=?, updated_at=datetime('now') WHERE visit_id=?`)
    .run(entrance_notes, general_observations, exit_notes, distribution_list, status, req.params.id);
  res.json({ success: true });
});

// WF Observations
app.post('/api/visits/:id/wf', (req, res) => {
  const { observations } = req.body;
  db.prepare('DELETE FROM wf_observations WHERE visit_id = ?').run(req.params.id);
  const insert = db.prepare('INSERT INTO wf_observations (visit_id,section,field_code,field_label,value,unit,threshold_low,threshold_high,flag,notes) VALUES (?,?,?,?,?,?,?,?,?,?)');
  const tx = db.transaction((obs) => {
    for (const o of obs) {
      insert.run(req.params.id, o.section, o.field_code, o.field_label, o.value, o.unit, o.threshold_low||null, o.threshold_high||null, o.flag||null, o.notes||null);
    }
  });
  tx(observations);
  res.json({ success: true });
});

// WW Observations
app.post('/api/visits/:id/ww', (req, res) => {
  const { observations } = req.body;
  db.prepare('DELETE FROM ww_observations WHERE visit_id = ?').run(req.params.id);
  const insert = db.prepare('INSERT INTO ww_observations (visit_id,section,field_code,field_label,value,unit,threshold_low,threshold_high,status,notes) VALUES (?,?,?,?,?,?,?,?,?,?)');
  const tx = db.transaction((obs) => {
    for (const o of obs) {
      insert.run(req.params.id, o.section, o.field_code, o.field_label, o.value, o.unit, o.threshold_low||null, o.threshold_high||null, o.status||null, o.notes||null);
    }
  });
  tx(observations);
  res.json({ success: true });
});

// Action Items
app.post('/api/action-items', (req, res) => {
  const id = `ACT-${uuidv4().slice(0,8).toUpperCase()}`;
  const { visit_id, section_ref, description, severity, owner, due_date } = req.body;
  db.prepare('INSERT INTO action_items (action_item_id,visit_id,section_ref,description,severity,owner,due_date) VALUES (?,?,?,?,?,?,?)')
    .run(id, visit_id, section_ref, description, severity, owner, due_date);
  res.json({ action_item_id: id });
});

app.put('/api/action-items/:id', (req, res) => {
  const { status, comments } = req.body;
  db.prepare('UPDATE action_items SET status=?, comments=? WHERE action_item_id=?').run(status, comments, req.params.id);
  res.json({ success: true });
});

// Photo Upload
app.post('/api/visits/:id/photos', upload.single('photo'), (req, res) => {
  const attId = `ATT-${uuidv4().slice(0,8).toUpperCase()}`;
  const filePath = `/uploads/${req.file.filename}`;
  db.prepare('INSERT INTO attachments (attachment_id,visit_id,section_ref,file_path,caption) VALUES (?,?,?,?,?)')
    .run(attId, req.params.id, req.body.section_ref || null, filePath, req.body.caption || null);
  res.json({ attachment_id: attId, file_path: filePath });
});

// Workflow actions
app.post('/api/visits/:id/workflow', (req, res) => {
  const { action, actor_id, comment } = req.body;
  const visit = db.prepare('SELECT status FROM visits WHERE visit_id = ?').get(req.params.id);
  if (!visit) return res.status(404).json({ error: 'Visit not found' });

  const transitions = {
    'planned': { next: 'in_progress', decision: 'submit' },
    'in_progress': { next: 'draft_complete', decision: 'submit' },
    'draft_complete': { next: 'in_review', decision: 'submit' },
    'in_review_approve': { next: 'approved', decision: 'approve' },
    'in_review_reject': { next: 'in_progress', decision: 'reject' },
    'approved': { next: 'published', decision: 'publish' }
  };

  let key = visit.status;
  if (visit.status === 'in_review' && action === 'reject') key = 'in_review_reject';
  else if (visit.status === 'in_review') key = 'in_review_approve';

  const t = transitions[key];
  if (!t) return res.status(400).json({ error: `Cannot transition from ${visit.status}` });

  db.prepare("UPDATE visits SET status=?, updated_at=datetime('now') WHERE visit_id=?").run(t.next, req.params.id);
  db.prepare('INSERT INTO approval_events (visit_id,stage,actor_id,decision,comment) VALUES (?,?,?,?,?)')
    .run(req.params.id, visit.status, actor_id, t.decision, comment || null);

  res.json({ new_status: t.next });
});

// Signatures
app.post('/api/visits/:id/signatures', (req, res) => {
  const { signer_name, signer_role, signature_data } = req.body;
  db.prepare('INSERT INTO signatures (visit_id,signer_name,signer_role,signature_data) VALUES (?,?,?,?)')
    .run(req.params.id, signer_name, signer_role, signature_data);
  res.json({ success: true });
});

// Audit trail
app.get('/api/visits/:id/audit', (req, res) => {
  const events = db.prepare(`
    SELECT ae.*, u.name as actor_name
    FROM approval_events ae
    JOIN users u ON ae.actor_id = u.user_id
    WHERE ae.visit_id = ?
    ORDER BY ae.timestamp
  `).all(req.params.id);
  res.json(events);
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  WSI Field Service Reporting Platform Demo`);
  console.log(`  ─────────────────────────────────────────`);
  console.log(`  Running at http://localhost:${PORT}\n`);
});
