-- WSI Field Service Reporting Platform
-- Database Schema and Seed Data
-- SQL Server / SQL Express

USE master;
GO

IF DB_ID('WSIFieldService') IS NOT NULL
BEGIN
    ALTER DATABASE WSIFieldService SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE WSIFieldService;
END
GO

CREATE DATABASE WSIFieldService;
GO

USE WSIFieldService;
GO

-- =============================================================
-- TABLES
-- =============================================================

CREATE TABLE Sites (
    SiteId          NVARCHAR(50)   NOT NULL PRIMARY KEY,
    AccountName     NVARCHAR(200)  NOT NULL,
    SiteName        NVARCHAR(200)  NOT NULL,
    Address         NVARCHAR(500)  NULL,
    ServiceLines    NVARCHAR(50)   NOT NULL DEFAULT 'WF,WW',
    Contacts        NVARCHAR(MAX)  NULL
);

CREATE TABLE Users (
    UserId  NVARCHAR(50)   NOT NULL PRIMARY KEY,
    Name    NVARCHAR(200)  NOT NULL,
    Role    NVARCHAR(20)   NOT NULL CHECK (Role IN ('technician','reviewer','admin')),
    Email   NVARCHAR(200)  NULL
);

CREATE TABLE Visits (
    VisitId             NVARCHAR(50)   NOT NULL PRIMARY KEY,
    SiteId              NVARCHAR(50)   NOT NULL REFERENCES Sites(SiteId),
    ConsultantId        NVARCHAR(50)   NOT NULL REFERENCES Users(UserId),
    VisitDate           DATE           NOT NULL,
    ReportPack          NVARCHAR(10)   NOT NULL CHECK (ReportPack IN ('WF','WW','WF+WW')),
    Status              NVARCHAR(20)   NOT NULL DEFAULT 'planned'
                        CHECK (Status IN ('planned','in_progress','draft_complete','in_review','approved','published')),
    EntranceNotes       NVARCHAR(MAX)  NULL,
    GeneralObservations NVARCHAR(MAX)  NULL,
    ExitNotes           NVARCHAR(MAX)  NULL,
    DistributionList    NVARCHAR(MAX)  NULL,
    CreatedAt           DATETIME       NOT NULL DEFAULT GETDATE(),
    UpdatedAt           DATETIME       NOT NULL DEFAULT GETDATE()
);

CREATE TABLE WfObservations (
    Id            INT            IDENTITY(1,1) PRIMARY KEY,
    VisitId       NVARCHAR(50)   NOT NULL REFERENCES Visits(VisitId),
    Section       NVARCHAR(100)  NOT NULL,
    FieldCode     NVARCHAR(100)  NOT NULL,
    FieldLabel    NVARCHAR(200)  NOT NULL,
    Value         NVARCHAR(200)  NULL,
    Unit          NVARCHAR(50)   NULL,
    ThresholdLow  DECIMAL(18,4)  NULL,
    ThresholdHigh DECIMAL(18,4)  NULL,
    Flag          NVARCHAR(200)  NULL,
    Notes         NVARCHAR(MAX)  NULL
);

CREATE TABLE WwObservations (
    Id            INT            IDENTITY(1,1) PRIMARY KEY,
    VisitId       NVARCHAR(50)   NOT NULL REFERENCES Visits(VisitId),
    Section       NVARCHAR(100)  NOT NULL,
    FieldCode     NVARCHAR(100)  NOT NULL,
    FieldLabel    NVARCHAR(200)  NOT NULL,
    Value         NVARCHAR(200)  NULL,
    Unit          NVARCHAR(50)   NULL,
    ThresholdLow  DECIMAL(18,4)  NULL,
    ThresholdHigh DECIMAL(18,4)  NULL,
    Status        NVARCHAR(20)   NULL CHECK (Status IN ('OK','Not OK','N/A','')),
    Notes         NVARCHAR(MAX)  NULL
);

CREATE TABLE ActionItems (
    ActionItemId NVARCHAR(50)   NOT NULL PRIMARY KEY,
    VisitId      NVARCHAR(50)   NOT NULL REFERENCES Visits(VisitId),
    SectionRef   NVARCHAR(100)  NULL,
    Description  NVARCHAR(MAX)  NOT NULL,
    Severity     NVARCHAR(20)   NOT NULL DEFAULT 'medium'
                 CHECK (Severity IN ('low','medium','high','critical')),
    Owner        NVARCHAR(200)  NULL,
    DueDate      DATE           NULL,
    Status       NVARCHAR(20)   NOT NULL DEFAULT 'open'
                 CHECK (Status IN ('open','in_progress','closed')),
    Comments     NVARCHAR(MAX)  NULL,
    CreatedAt    DATETIME       NOT NULL DEFAULT GETDATE()
);

CREATE TABLE Attachments (
    AttachmentId NVARCHAR(50)   NOT NULL PRIMARY KEY,
    VisitId      NVARCHAR(50)   NOT NULL REFERENCES Visits(VisitId),
    SectionRef   NVARCHAR(100)  NULL,
    FilePath     NVARCHAR(500)  NOT NULL,
    Caption      NVARCHAR(500)  NULL,
    CreatedAt    DATETIME       NOT NULL DEFAULT GETDATE()
);

CREATE TABLE ApprovalEvents (
    Id        INT            IDENTITY(1,1) PRIMARY KEY,
    VisitId   NVARCHAR(50)   NOT NULL REFERENCES Visits(VisitId),
    Stage     NVARCHAR(50)   NULL,
    ActorId   NVARCHAR(50)   NOT NULL REFERENCES Users(UserId),
    Decision  NVARCHAR(20)   NOT NULL CHECK (Decision IN ('submit','approve','reject','publish')),
    Comment   NVARCHAR(MAX)  NULL,
    Timestamp DATETIME       NOT NULL DEFAULT GETDATE()
);

CREATE TABLE Signatures (
    Id            INT            IDENTITY(1,1) PRIMARY KEY,
    VisitId       NVARCHAR(50)   NOT NULL REFERENCES Visits(VisitId),
    SignerName    NVARCHAR(200)  NOT NULL,
    SignerRole    NVARCHAR(100)  NULL,
    SignatureData NVARCHAR(MAX)  NULL,
    SignedAt      DATETIME       NOT NULL DEFAULT GETDATE()
);

-- =============================================================
-- SEED DATA
-- =============================================================

-- Sites
INSERT INTO Sites (SiteId, AccountName, SiteName, Address, ServiceLines, Contacts) VALUES
('SITE-001', 'Alsco', 'Alsco - Alexandria', '1200 Duke St, Alexandria, VA 22314', 'WF,WW', 'Tom Bradley (Plant Mgr) tom.bradley@alsco.com, Sue Chen (Env Compliance) sue.chen@alsco.com'),
('SITE-002', 'Cintas', 'Cintas - Aston', '4900 Pennell Rd, Aston, PA 19014', 'WF,WW', 'Dave Miller (Ops Dir) dave.miller@cintas.com'),
('SITE-003', 'UniFirst', 'UniFirst - Region 9 Newark', '88 Industrial Ave, Newark, NJ 07114', 'WF', 'Linda Park (Plant Mgr) linda.park@unifirst.com'),
('SITE-004', 'Alsco', 'Alsco - Portland', '2300 NW Industrial Way, Portland, OR 97210', 'WW', 'Mark Johnson (Env Mgr) mark.johnson@alsco.com');

-- Users
INSERT INTO Users (UserId, Name, Role, Email) VALUES
('USR-001', 'James Carter', 'technician', 'james.carter@washingsystems.com'),
('USR-002', 'Maria Santos', 'technician', 'maria.santos@washingsystems.com'),
('USR-003', 'Robert Kim', 'reviewer', 'robert.kim@washingsystems.com'),
('USR-004', 'Patricia Allen', 'admin', 'patricia.allen@washingsystems.com');

-- Visits
INSERT INTO Visits (VisitId, SiteId, ConsultantId, VisitDate, ReportPack, Status, EntranceNotes, GeneralObservations, ExitNotes, DistributionList, CreatedAt, UpdatedAt) VALUES
('VIS-001', 'SITE-001', 'USR-001', '2026-03-07', 'WF+WW', 'in_review',
 'Arrived 08:15. Met with Tom Bradley at front office. PPE donned. Plant running full capacity on all 5 tunnel lines.',
 'Overall plant condition is good. Chemical room well-organized. Minor steam leak noted at tunnel junction 3. Wastewater treatment system operating within parameters with one training gap identified.',
 'Exit meeting with Tom Bradley and Sue Chen. Reviewed key findings and action items. Next visit scheduled for April.',
 'tom.bradley@alsco.com;sue.chen@alsco.com;robert.kim@washingsystems.com',
 '2026-03-07 08:30:00', '2026-03-07 16:45:00'),
('VIS-002', 'SITE-002', 'USR-002', '2026-03-05', 'WF', 'approved',
 'Arrived 09:00. Met with Dave Miller. Plant running 3 of 4 tunnels.',
 'Good overall plant hygiene. Steam tunnel seals showing wear on line 2.',
 'Discussed steam tunnel maintenance schedule with Dave. Report to follow.',
 'dave.miller@cintas.com;robert.kim@washingsystems.com',
 '2026-03-05 09:00:00', '2026-03-06 14:00:00'),
('VIS-003', 'SITE-003', 'USR-001', '2026-03-09', 'WF', 'planned',
 NULL, NULL, NULL, NULL,
 '2026-03-01 10:00:00', '2026-03-01 10:00:00'),
('VIS-004', 'SITE-004', 'USR-002', '2026-03-08', 'WW', 'in_progress',
 'Arrived 10:30. Met with Mark Johnson. Wastewater treatment plant tour began immediately.',
 NULL, NULL, NULL,
 '2026-03-08 10:30:00', '2026-03-08 12:00:00');

-- WF Observations for VIS-001
-- Section: plant_ops
INSERT INTO WfObservations (VisitId, Section, FieldCode, FieldLabel, Value, Unit, ThresholdLow, ThresholdHigh, Flag, Notes) VALUES
('VIS-001', 'plant_ops', 'hot_water_temp',  'Hot Water Temperature',  '148',  '°F',     140, 160, NULL, NULL),
('VIS-001', 'plant_ops', 'hardness',        'Water Hardness',         '3.2',  'gpg',     0,   5,   NULL, NULL),
('VIS-001', 'plant_ops', 'iron',            'Iron Content',           '0.8',  'ppm',     0,   1.0, NULL, NULL),
('VIS-001', 'plant_ops', 'alkalinity',      'Alkalinity',             '95',   'ppm',     80,  120, NULL, NULL),
('VIS-001', 'plant_ops', 'ph',              'pH Level',               '7.2',  '',        6.5, 8.5, NULL, NULL),
('VIS-001', 'plant_ops', 'bleach_strength', 'Bleach Strength',        '8.5',  '%',       10,  12.5,'low','Bleach concentration below acceptable range. Recommend replacement of bleach supply.');

-- Section: kpi
INSERT INTO WfObservations (VisitId, Section, FieldCode, FieldLabel, Value, Unit, ThresholdLow, ThresholdHigh, Flag, Notes) VALUES
('VIS-001', 'kpi', 'daily_cwt',      'Daily Production',         '2850', 'lbs',       NULL, NULL, NULL, NULL),
('VIS-001', 'kpi', 'gallons_per_lb', 'Water Usage per Pound',    '2.1',  'gal/lb',    0,    2.5,  NULL, NULL),
('VIS-001', 'kpi', 'therms_per_cwt', 'Energy per CWT',           '0.42', 'therms',    0,    0.5,  NULL, NULL),
('VIS-001', 'kpi', 'chem_cost_cwt',  'Chemical Cost per CWT',    '1.85', '$/cwt',     0,    2.5,  NULL, NULL);

-- Section: wash_practices
INSERT INTO WfObservations (VisitId, Section, FieldCode, FieldLabel, Value, Unit, ThresholdLow, ThresholdHigh, Flag, Notes) VALUES
('VIS-001', 'wash_practices', 'weighing',       'Weighing Compliance',    'Yes', '', NULL, NULL, NULL, NULL),
('VIS-001', 'wash_practices', 'sorting',        'Sorting Compliance',     'Yes', '', NULL, NULL, NULL, NULL),
('VIS-001', 'wash_practices', 'formula_select', 'Formula Selection',      'Yes', '', NULL, NULL, NULL, NULL),
('VIS-001', 'wash_practices', 'steam_leaks',    'Steam Leak Check',       'Yes', '', NULL, NULL, 'issue', 'Minor leak at tunnel junction 3'),
('VIS-001', 'wash_practices', 'load_accuracy',  'Load Accuracy',          'No',  '', NULL, NULL, 'issue', 'Overloading observed on 2 of 5 lines');

-- WW Observations for VIS-001
-- Section: treatment
INSERT INTO WwObservations (VisitId, Section, FieldCode, FieldLabel, Value, Unit, ThresholdLow, ThresholdHigh, Status, Notes) VALUES
('VIS-001', 'treatment', 'ph_treatment',   'Treatment pH',       '8.1', '',         7,  9,  'OK', NULL),
('VIS-001', 'treatment', 'ph_discharge',   'Discharge pH',       '7.4', '',         6,  9,  'OK', NULL),
('VIS-001', 'treatment', 'coagulant_dose', 'Coagulant Dose',     '45',  'ppm',      30, 60, 'OK', NULL),
('VIS-001', 'treatment', 'flocculant_dose','Flocculant Dose',    '12',  'ppm',      8,  20, 'OK', NULL),
('VIS-001', 'treatment', 'daf_status',     'DAF System Status',  'OK',  '',         NULL, NULL, 'OK', NULL),
('VIS-001', 'treatment', 'filter_press',   'Filter Press Status','OK',  '',         NULL, NULL, 'OK', NULL);

-- Section: compliance
INSERT INTO WwObservations (VisitId, Section, FieldCode, FieldLabel, Value, Unit, ThresholdLow, ThresholdHigh, Status, Notes) VALUES
('VIS-001', 'compliance', 'target_cost',   'Target Cost',        '4.50','$/1000gal', NULL, NULL, '', NULL),
('VIS-001', 'compliance', 'actual_cost',   'Actual Cost',        '4.85','$/1000gal', NULL, NULL, '', NULL),
('VIS-001', 'compliance', 'treatment_pct', 'Treatment Efficiency','94', '%',         90,  100,  'OK', NULL);

-- Section: training
INSERT INTO WwObservations (VisitId, Section, FieldCode, FieldLabel, Value, Unit, ThresholdLow, ThresholdHigh, Status, Notes) VALUES
('VIS-001', 'training', 'log_discipline',    'Log Discipline',     'OK',     '', NULL, NULL, 'OK', NULL),
('VIS-001', 'training', 'operator_training', 'Operator Training',  'Not OK', '', NULL, NULL, 'Not OK', 'New hire needs pH calibration training');

-- Action Items
INSERT INTO ActionItems (ActionItemId, VisitId, SectionRef, Description, Severity, Owner, DueDate, Status, Comments, CreatedAt) VALUES
('ACT-001', 'VIS-001', 'plant_ops',      'Replace bleach supply - concentration below acceptable range (8.5% vs 10-12.5% target)', 'high',     'Tom Bradley',  '2026-03-14', 'open', NULL, '2026-03-07 15:00:00'),
('ACT-002', 'VIS-001', 'wash_practices', 'Repair steam leak at tunnel junction 3',                                                  'medium',   'Tom Bradley',  '2026-03-21', 'open', NULL, '2026-03-07 15:05:00'),
('ACT-003', 'VIS-001', 'wash_practices', 'Retrain operators on proper load sizing - overloading observed on 2 of 5 lines',          'high',     'Tom Bradley',  '2026-03-14', 'open', NULL, '2026-03-07 15:10:00'),
('ACT-004', 'VIS-001', 'training',       'Schedule pH calibration training for new wastewater operator',                             'medium',   'Sue Chen',     '2026-03-21', 'open', NULL, '2026-03-07 15:15:00'),
('ACT-005', 'VIS-002', 'wash_practices', 'Inspect and replace steam tunnel seals on line 2',                                        'high',     'Dave Miller',  '2026-03-15', 'in_progress', 'Parts ordered 3/6. Scheduled for next maintenance window.', '2026-03-05 14:00:00');

-- Approval Events
INSERT INTO ApprovalEvents (VisitId, Stage, ActorId, Decision, Comment, Timestamp) VALUES
('VIS-001', 'draft_complete_to_in_review', 'USR-001', 'submit',  'Report complete. Submitting for review.', '2026-03-07 16:45:00'),
('VIS-002', 'draft_complete_to_in_review', 'USR-002', 'submit',  'WF report ready for review.',             '2026-03-05 16:00:00'),
('VIS-002', 'in_review_to_approved',       'USR-003', 'approve', 'Looks good. Approved.',                   '2026-03-06 14:00:00');

GO
