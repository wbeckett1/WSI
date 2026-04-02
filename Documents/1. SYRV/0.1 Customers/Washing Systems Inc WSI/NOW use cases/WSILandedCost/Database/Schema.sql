-- ============================================================
-- WSI Landed Cost Optimizer - Database Schema & Seed Data
-- Target: SQL Server (Express or Standard)
-- ============================================================

IF DB_ID('WSILandedCost') IS NULL
    CREATE DATABASE WSILandedCost;
GO

USE WSILandedCost;
GO

-- ============================================================
-- Tables
-- ============================================================

IF OBJECT_ID('dbo.Decisions', 'U') IS NOT NULL DROP TABLE dbo.Decisions;
IF OBJECT_ID('dbo.SavingsLedger', 'U') IS NOT NULL DROP TABLE dbo.SavingsLedger;
IF OBJECT_ID('dbo.Recommendations', 'U') IS NOT NULL DROP TABLE dbo.Recommendations;
IF OBJECT_ID('dbo.OrderLines', 'U') IS NOT NULL DROP TABLE dbo.OrderLines;
IF OBJECT_ID('dbo.Orders', 'U') IS NOT NULL DROP TABLE dbo.Orders;
IF OBJECT_ID('dbo.SourceOptions', 'U') IS NOT NULL DROP TABLE dbo.SourceOptions;
IF OBJECT_ID('dbo.LaneRates', 'U') IS NOT NULL DROP TABLE dbo.LaneRates;
IF OBJECT_ID('dbo.CustomerRules', 'U') IS NOT NULL DROP TABLE dbo.CustomerRules;
IF OBJECT_ID('dbo.FxRates', 'U') IS NOT NULL DROP TABLE dbo.FxRates;
IF OBJECT_ID('dbo.Issues', 'U') IS NOT NULL DROP TABLE dbo.Issues;
GO

CREATE TABLE dbo.Orders (
    Id              NVARCHAR(50)    NOT NULL PRIMARY KEY,
    Customer        NVARCHAR(100)   NOT NULL,
    ShipTo          NVARCHAR(200)   NOT NULL,
    RequestedShipDate DATE          NOT NULL,
    OrderDate       DATE            NOT NULL,
    BaselineSource  NVARCHAR(50)    NOT NULL,
    Incoterm        NVARCHAR(20)    NOT NULL DEFAULT 'FOB',
    Status          NVARCHAR(20)    NOT NULL DEFAULT 'ready',
    CreatedAt       DATETIME        NOT NULL DEFAULT GETDATE()
);

CREATE TABLE dbo.OrderLines (
    Id              INT             IDENTITY(1,1) PRIMARY KEY,
    OrderId         NVARCHAR(50)    NOT NULL REFERENCES dbo.Orders(Id),
    Sku             NVARCHAR(50)    NOT NULL,
    Description     NVARCHAR(200)   NOT NULL,
    Quantity        DECIMAL(12,2)   NOT NULL,
    Uom             NVARCHAR(10)    NOT NULL DEFAULT 'GAL',
    PackType        NVARCHAR(20)    NOT NULL DEFAULT 'Drum',
    Hazmat          BIT             NOT NULL DEFAULT 0
);

CREATE TABLE dbo.SourceOptions (
    Id              INT             IDENTITY(1,1) PRIMARY KEY,
    SourceId        NVARCHAR(20)    NOT NULL,
    SourceName      NVARCHAR(100)   NOT NULL,
    Region          NVARCHAR(50)    NOT NULL,
    ProductionCost  DECIMAL(10,4)   NOT NULL,
    BlendingCost    DECIMAL(10,4)   NOT NULL,
    PackagingCost   DECIMAL(10,4)   NOT NULL,
    CapacityAvailable DECIMAL(12,2) NOT NULL,
    LeadTimeDays    INT             NOT NULL,
    FreshnessDate   DATE            NOT NULL,
    FreshnessStatus NVARCHAR(10)    NOT NULL DEFAULT 'green'
);

CREATE TABLE dbo.LaneRates (
    Id              INT             IDENTITY(1,1) PRIMARY KEY,
    Origin          NVARCHAR(100)   NOT NULL,
    DestinationZone NVARCHAR(100)   NOT NULL,
    Carrier         NVARCHAR(100)   NOT NULL,
    Mode            NVARCHAR(10)    NOT NULL DEFAULT 'TL',
    BaseRate        DECIMAL(10,2)   NOT NULL,
    Accessorial     DECIMAL(10,2)   NOT NULL DEFAULT 0,
    EffectiveDate   DATE            NOT NULL,
    ExpiryDate      DATE            NOT NULL
);

CREATE TABLE dbo.CustomerRules (
    Id              INT             IDENTITY(1,1) PRIMARY KEY,
    Customer        NVARCHAR(100)   NOT NULL,
    RuleType        NVARCHAR(50)    NOT NULL,
    RuleValue       NVARCHAR(500)   NOT NULL,
    HardConstraint  BIT             NOT NULL DEFAULT 1,
    EffectiveDate   DATE            NOT NULL
);

CREATE TABLE dbo.FxRates (
    Id              INT             IDENTITY(1,1) PRIMARY KEY,
    FromCurrency    NVARCHAR(10)    NOT NULL,
    ToCurrency      NVARCHAR(10)    NOT NULL,
    Rate            DECIMAL(10,4)   NOT NULL,
    RateDate        DATE            NOT NULL,
    Source          NVARCHAR(50)    NOT NULL DEFAULT 'finance_feed',
    FreshnessStatus NVARCHAR(10)    NOT NULL DEFAULT 'green'
);

CREATE TABLE dbo.Recommendations (
    Id              INT             IDENTITY(1,1) PRIMARY KEY,
    OrderId         NVARCHAR(50)    NOT NULL REFERENCES dbo.Orders(Id),
    OptionRank      INT             NOT NULL,
    SourceId        NVARCHAR(20)    NOT NULL,
    SourceName      NVARCHAR(100)   NOT NULL,
    LaneDescription NVARCHAR(200)   NOT NULL,
    Mode            NVARCHAR(10)    NOT NULL,
    ShipPromiseDate DATE            NULL,
    ProductCost     DECIMAL(12,2)   NOT NULL,
    BlendingCost    DECIMAL(12,2)   NOT NULL,
    PackagingCost   DECIMAL(12,2)   NOT NULL,
    InboundCost     DECIMAL(12,2)   NOT NULL DEFAULT 0,
    OutboundFreight DECIMAL(12,2)   NOT NULL,
    Accessorials    DECIMAL(12,2)   NOT NULL DEFAULT 0,
    Duties          DECIMAL(12,2)   NOT NULL DEFAULT 0,
    FxImpact        DECIMAL(12,2)   NOT NULL DEFAULT 0,
    ExpeditePremium DECIMAL(12,2)   NOT NULL DEFAULT 0,
    Rebates         DECIMAL(12,2)   NOT NULL DEFAULT 0,
    LandedCost      DECIMAL(12,2)   NOT NULL,
    DeltaVsBaseline DECIMAL(12,2)   NOT NULL,
    DeltaPct        DECIMAL(8,2)    NOT NULL,
    RiskFlag        NVARCHAR(10)    NOT NULL DEFAULT 'green',
    ReasonCodes     NVARCHAR(MAX)   NULL,
    Rationale       NVARCHAR(MAX)   NULL,
    IsBaseline      BIT             NOT NULL DEFAULT 0,
    AssumptionsVersion NVARCHAR(20) NOT NULL DEFAULT 'v1.0',
    CreatedAt       DATETIME        NOT NULL DEFAULT GETDATE()
);

CREATE TABLE dbo.Decisions (
    Id              INT             IDENTITY(1,1) PRIMARY KEY,
    OrderId         NVARCHAR(50)    NOT NULL REFERENCES dbo.Orders(Id),
    SelectedOptionRank INT          NOT NULL,
    Approver        NVARCHAR(100)   NOT NULL,
    ApproverRole    NVARCHAR(50)    NOT NULL,
    ApprovalTimestamp DATETIME      NOT NULL DEFAULT GETDATE(),
    ThresholdClass  NVARCHAR(20)    NOT NULL DEFAULT 'standard',
    ReasonCode      NVARCHAR(100)   NULL,
    OverrideFlag    BIT             NOT NULL DEFAULT 0,
    OverrideComment NVARCHAR(500)   NULL,
    AssumptionsVersion NVARCHAR(20) NOT NULL DEFAULT 'v1.0'
);

CREATE TABLE dbo.SavingsLedger (
    Id              INT             IDENTITY(1,1) PRIMARY KEY,
    OrderId         NVARCHAR(50)    NOT NULL REFERENCES dbo.Orders(Id),
    BaselineCost    DECIMAL(12,2)   NOT NULL,
    SelectedCost    DECIMAL(12,2)   NOT NULL,
    TheoreticalSavings DECIMAL(12,2) NOT NULL,
    RealizedSavings DECIMAL(12,2)   NOT NULL DEFAULT 0,
    FinanceStatus   NVARCHAR(20)    NOT NULL DEFAULT 'pending',
    Period          NVARCHAR(10)    NOT NULL
);

CREATE TABLE dbo.Issues (
    Id              INT             IDENTITY(1,1) PRIMARY KEY,
    OpenedDate      DATE            NOT NULL,
    Category        NVARCHAR(50)    NOT NULL,
    Issue           NVARCHAR(500)   NOT NULL,
    Owner           NVARCHAR(100)   NOT NULL,
    TargetDate      DATE            NULL,
    Status          NVARCHAR(20)    NOT NULL DEFAULT 'open',
    Comments        NVARCHAR(MAX)   NULL
);
GO

-- ============================================================
-- Seed Data
-- ============================================================

-- Source Options
INSERT INTO dbo.SourceOptions (SourceId, SourceName, Region, ProductionCost, BlendingCost, PackagingCost, CapacityAvailable, LeadTimeDays, FreshnessDate, FreshnessStatus)
VALUES
('SRC-OH', 'Dayton OH Plant',       'Midwest',   2.10, 0.45, 0.30, 5000, 3, '2026-04-01', 'green'),
('SRC-TX', 'Houston TX Plant',      'South',     1.85, 0.50, 0.35, 8000, 5, '2026-04-01', 'green'),
('SRC-PA', 'Philadelphia PA Plant', 'Northeast', 2.25, 0.40, 0.28, 3000, 2, '2026-04-01', 'green'),
('SRC-GA', 'Atlanta GA Plant',      'Southeast', 1.95, 0.48, 0.32, 6000, 4, '2026-04-01', 'green'),
('SRC-IL', 'Chicago IL Plant',      'Midwest',   2.00, 0.42, 0.29, 7000, 3, '2026-03-28', 'green');

-- Lane Rates  (5 origins x 5 destinations = 25 lanes)
INSERT INTO dbo.LaneRates (Origin, DestinationZone, Carrier, Mode, BaseRate, Accessorial, EffectiveDate, ExpiryDate) VALUES
-- Dayton OH
('Dayton OH',       'Aston PA',      'XPO Logistics',   'TL', 850.00,  75.00,  '2026-01-01','2026-12-31'),
('Dayton OH',       'Louisville KY', 'Estes Express',    'TL', 520.00,  45.00,  '2026-01-01','2026-12-31'),
('Dayton OH',       'Alexandria VA',  'Old Dominion',    'TL', 980.00,  85.00,  '2026-01-01','2026-12-31'),
('Dayton OH',       'Owensboro KY',  'FedEx Freight',   'TL', 610.00,  50.00,  '2026-01-01','2026-12-31'),
('Dayton OH',       'Nashville TN',  'Saia Inc',        'TL', 720.00,  60.00,  '2026-01-01','2026-12-31'),
-- Houston TX
('Houston TX',      'Aston PA',      'XPO Logistics',   'TL', 1650.00, 125.00, '2026-01-01','2026-12-31'),
('Houston TX',      'Louisville KY', 'Estes Express',    'TL', 1100.00, 95.00,  '2026-01-01','2026-12-31'),
('Houston TX',      'Alexandria VA',  'Old Dominion',    'TL', 1550.00, 120.00, '2026-01-01','2026-12-31'),
('Houston TX',      'Owensboro KY',  'FedEx Freight',   'TL', 1200.00, 100.00, '2026-01-01','2026-12-31'),
('Houston TX',      'Nashville TN',  'Saia Inc',        'TL', 950.00,  80.00,  '2026-01-01','2026-12-31'),
-- Philadelphia PA
('Philadelphia PA', 'Aston PA',      'XPO Logistics',   'TL', 450.00,  25.00,  '2026-01-01','2026-12-31'),
('Philadelphia PA', 'Louisville KY', 'Estes Express',    'TL', 1050.00, 90.00,  '2026-01-01','2026-12-31'),
('Philadelphia PA', 'Alexandria VA',  'Old Dominion',    'TL', 680.00,  55.00,  '2026-01-01','2026-12-31'),
('Philadelphia PA', 'Owensboro KY',  'FedEx Freight',   'TL', 1150.00, 95.00,  '2026-01-01','2026-12-31'),
('Philadelphia PA', 'Nashville TN',  'Saia Inc',        'TL', 1250.00, 100.00, '2026-01-01','2026-12-31'),
-- Atlanta GA
('Atlanta GA',      'Aston PA',      'XPO Logistics',   'TL', 1200.00, 100.00, '2026-01-01','2026-12-31'),
('Atlanta GA',      'Louisville KY', 'Estes Express',    'TL', 680.00,  55.00,  '2026-01-01','2026-12-31'),
('Atlanta GA',      'Alexandria VA',  'Old Dominion',    'TL', 950.00,  80.00,  '2026-01-01','2026-12-31'),
('Atlanta GA',      'Owensboro KY',  'FedEx Freight',   'TL', 780.00,  65.00,  '2026-01-01','2026-12-31'),
('Atlanta GA',      'Nashville TN',  'Saia Inc',        'TL', 550.00,  40.00,  '2026-01-01','2026-12-31'),
-- Chicago IL
('Chicago IL',      'Aston PA',      'XPO Logistics',   'TL', 1100.00, 90.00,  '2026-01-01','2026-12-31'),
('Chicago IL',      'Louisville KY', 'Estes Express',    'TL', 580.00,  50.00,  '2026-01-01','2026-12-31'),
('Chicago IL',      'Alexandria VA',  'Old Dominion',    'TL', 1050.00, 85.00,  '2026-01-01','2026-12-31'),
('Chicago IL',      'Owensboro KY',  'FedEx Freight',   'TL', 650.00,  55.00,  '2026-01-01','2026-12-31'),
('Chicago IL',      'Nashville TN',  'Saia Inc',        'TL', 680.00,  55.00,  '2026-01-01','2026-12-31');

-- Customer Rules
INSERT INTO dbo.CustomerRules (Customer, RuleType, RuleValue, HardConstraint, EffectiveDate) VALUES
('Cintas',    'approved_source',     'SRC-OH,SRC-PA,SRC-IL',          1, '2026-01-01'),
('Cintas',    'service_window',      '2-5 business days',             1, '2026-01-01'),
('Alsco',     'approved_source',     'SRC-OH,SRC-TX,SRC-GA,SRC-IL',  1, '2026-01-01'),
('Alsco',     'carrier_restriction', 'No LTL for hazmat',            1, '2026-01-01'),
('UniFirst',  'approved_source',     'all',                           1, '2026-01-01'),
('UniFirst',  'split_policy',        'No split shipments',            0, '2026-01-01');

-- FX Rates
INSERT INTO dbo.FxRates (FromCurrency, ToCurrency, Rate, RateDate, Source, FreshnessStatus) VALUES
('USD', 'CAD', 1.3600, '2026-04-01', 'finance_feed', 'green'),
('USD', 'MXN', 17.1200, '2026-04-01', 'finance_feed', 'green'),
('USD', 'EUR', 0.9200, '2026-04-01', 'finance_feed', 'green');

-- Orders (5 ready + 3 in later states)
INSERT INTO dbo.Orders (Id, Customer, ShipTo, RequestedShipDate, OrderDate, BaselineSource, Incoterm, Status) VALUES
('WSI-2026-1001', 'Cintas',    'Aston PA',      '2026-04-10', '2026-04-01', 'SRC-OH', 'FOB', 'ready'),
('WSI-2026-1002', 'Cintas',    'Louisville KY', '2026-04-12', '2026-04-01', 'SRC-OH', 'FOB', 'ready'),
('WSI-2026-1003', 'Alsco',     'Alexandria VA', '2026-04-11', '2026-04-02', 'SRC-TX', 'FOB', 'ready'),
('WSI-2026-1004', 'UniFirst',  'Owensboro KY',  '2026-04-14', '2026-04-02', 'SRC-OH', 'FOB', 'ready'),
('WSI-2026-1005', 'Alsco',     'Nashville TN',  '2026-04-13', '2026-04-02', 'SRC-GA', 'FOB', 'ready'),
('WSI-2026-2001', 'Cintas',    'Louisville KY', '2026-03-20', '2026-03-10', 'SRC-OH', 'FOB', 'approved'),
('WSI-2026-2002', 'Alsco',     'Nashville TN',  '2026-03-18', '2026-03-08', 'SRC-GA', 'FOB', 'shipped'),
('WSI-2026-2003', 'UniFirst',  'Aston PA',      '2026-03-15', '2026-03-05', 'SRC-PA', 'FOB', 'closed');

-- Order Lines
INSERT INTO dbo.OrderLines (OrderId, Sku, Description, Quantity, Uom, PackType, Hazmat) VALUES
('WSI-2026-1001', 'WC-100', 'Industrial Wash Chemical Standard', 1200.00, 'GAL', 'Drum',  0),
('WSI-2026-1001', 'WC-200', 'Heavy Duty Degreaser',              400.00,  'GAL', 'Drum',  1),
('WSI-2026-1002', 'WC-150', 'Tunnel Washer Detergent',           2000.00, 'GAL', 'Tote',  0),
('WSI-2026-1003', 'WC-100', 'Industrial Wash Chemical Standard', 800.00,  'GAL', 'Drum',  0),
('WSI-2026-1003', 'WC-300', 'Fabric Softener Blend',             600.00,  'GAL', 'Drum',  0),
('WSI-2026-1004', 'WC-400', 'Stain Treatment Solution',          1500.00, 'GAL', 'Tote',  0),
('WSI-2026-1004', 'WC-200', 'Heavy Duty Degreaser',              500.00,  'GAL', 'Drum',  1),
('WSI-2026-1005', 'WC-100', 'Industrial Wash Chemical Standard', 3000.00, 'GAL', 'Tote',  0),
('WSI-2026-2001', 'WC-150', 'Tunnel Washer Detergent',           1800.00, 'GAL', 'Tote',  0),
('WSI-2026-2002', 'WC-100', 'Industrial Wash Chemical Standard', 2500.00, 'GAL', 'Drum',  0),
('WSI-2026-2003', 'WC-300', 'Fabric Softener Blend',             1000.00, 'GAL', 'Drum',  0);

-- Pre-existing recommendations for completed orders
INSERT INTO dbo.Recommendations (OrderId, OptionRank, SourceId, SourceName, LaneDescription, Mode, ShipPromiseDate, ProductCost, BlendingCost, PackagingCost, InboundCost, OutboundFreight, Accessorials, LandedCost, DeltaVsBaseline, DeltaPct, RiskFlag, ReasonCodes, Rationale, IsBaseline) VALUES
('WSI-2026-2001', 1, 'SRC-IL', 'Chicago IL Plant', 'Chicago IL -> Louisville KY', 'TL', '2026-03-18', 3600.00, 756.00, 522.00, 0, 580.00, 50.00, 5508.00, -384.00, -6.52, 'green', 'LOWEST_COST,SIGNIFICANT_SAVINGS', 'Best cost option with 3-day lead time, meets service window.', 0),
('WSI-2026-2001', 2, 'SRC-OH', 'Dayton OH Plant', 'Dayton OH -> Louisville KY', 'TL', '2026-03-17', 3780.00, 810.00, 540.00, 0, 520.00, 45.00, 5695.00, 0, 0, 'green', 'BASELINE', 'Baseline source. Reliable lead time.', 1),
('WSI-2026-2002', 1, 'SRC-GA', 'Atlanta GA Plant', 'Atlanta GA -> Nashville TN', 'TL', '2026-03-16', 4875.00, 1200.00, 800.00, 0, 550.00, 40.00, 7465.00, 0, 0, 'green', 'BASELINE,LOWEST_COST', 'Baseline source is also lowest cost for this lane.', 1),
('WSI-2026-2003', 1, 'SRC-PA', 'Philadelphia PA Plant', 'Philadelphia PA -> Aston PA', 'TL', '2026-03-13', 2250.00, 400.00, 280.00, 0, 450.00, 25.00, 3405.00, 0, 0, 'green', 'BASELINE,LOWEST_COST', 'Local source, minimal freight. Best option.', 1);

-- Decisions for completed orders
INSERT INTO dbo.Decisions (OrderId, SelectedOptionRank, Approver, ApproverRole, ApprovalTimestamp, ThresholdClass, ReasonCode, OverrideFlag) VALUES
('WSI-2026-2001', 1, 'James Carter', 'Planner', '2026-03-12 14:30:00', 'standard', 'COST_SAVINGS', 0),
('WSI-2026-2002', 1, 'Maria Santos', 'Planner', '2026-03-10 09:15:00', 'standard', 'BASELINE_OPTIMAL', 0),
('WSI-2026-2003', 1, 'Robert Kim',   'Finance', '2026-03-07 16:45:00', 'standard', 'BASELINE_OPTIMAL', 0);

-- Savings Ledger
INSERT INTO dbo.SavingsLedger (OrderId, BaselineCost, SelectedCost, TheoreticalSavings, RealizedSavings, FinanceStatus, Period) VALUES
('WSI-2026-2001', 5695.00, 5508.00, 187.00, 187.00, 'verified',  '2026-Q1'),
('WSI-2026-2002', 7465.00, 7465.00, 0.00,   0.00,   'verified',  '2026-Q1'),
('WSI-2026-2003', 3405.00, 3405.00, 0.00,   0.00,   'verified',  '2026-Q1');

-- Issues
INSERT INTO dbo.Issues (OpenedDate, Category, Issue, Owner, TargetDate, Status, Comments) VALUES
('2026-03-15', 'Data Quality', 'Houston TX lane rates missing accessorial detail for hazmat surcharge', 'Maria Santos', '2026-04-15', 'open', 'Need carrier confirmation on hazmat accessorial schedule'),
('2026-03-20', 'Data Quality', 'Chicago IL source freshness date not updated since March 28', 'James Carter', '2026-04-05', 'open', 'Awaiting plant confirmation on current capacity and cost'),
('2026-03-10', 'Data Quality', 'Philadelphia PA lane to Louisville KY had incorrect base rate', 'Maria Santos', '2026-03-25', 'resolved', 'Corrected from $950 to $1050 after carrier audit'),
('2026-03-25', 'Enhancement',  'Add multi-currency landed cost display for Canadian customers', 'Robert Kim', '2026-05-01', 'backlog', 'Phase 2 feature request from finance team');
GO

PRINT 'WSILandedCost database schema and seed data created successfully.';
GO
