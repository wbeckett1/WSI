Imports System.Web.Mvc
Imports System.Data.SqlClient
Imports WSILandedCost.Helpers
Imports WSILandedCost.Models

Namespace WSILandedCost.Controllers
    Public Class OrdersController
        Inherits Controller

        ' ========================================================
        ' Source city mapping for lane lookups
        ' ========================================================
        Private Shared ReadOnly SourceCityMap As New Dictionary(Of String, String) From {
            {"SRC-OH", "Dayton OH"},
            {"SRC-TX", "Houston TX"},
            {"SRC-PA", "Philadelphia PA"},
            {"SRC-GA", "Atlanta GA"},
            {"SRC-IL", "Chicago IL"}
        }

        ' ========================================================
        ' GET /Orders/GetOrders
        ' ========================================================
        Function GetOrders() As JsonResult
            Dim sql As String = "
                SELECT o.Id, o.Customer, o.ShipTo, o.RequestedShipDate, o.OrderDate,
                       o.BaselineSource, o.Incoterm, o.Status, o.CreatedAt,
                       ISNULL(SUM(ol.Quantity), 0) AS TotalQty,
                       COUNT(ol.Id) AS LineCount,
                       ISNULL(STRING_AGG(ol.Sku + ' (' + CAST(CAST(ol.Quantity AS INT) AS NVARCHAR) + ' ' + ol.Uom + ')', ', '), '') AS LineSummary
                FROM Orders o
                LEFT JOIN OrderLines ol ON ol.OrderId = o.Id
                GROUP BY o.Id, o.Customer, o.ShipTo, o.RequestedShipDate, o.OrderDate,
                         o.BaselineSource, o.Incoterm, o.Status, o.CreatedAt
                ORDER BY o.OrderDate DESC, o.Id"

            Dim orders = DbHelper.ExecuteReader(sql,
                Function(r) New Order With {
                    .Id = DbHelper.SafeString(r, "Id"),
                    .Customer = DbHelper.SafeString(r, "Customer"),
                    .ShipTo = DbHelper.SafeString(r, "ShipTo"),
                    .RequestedShipDate = r.GetDateTime(r.GetOrdinal("RequestedShipDate")),
                    .OrderDate = r.GetDateTime(r.GetOrdinal("OrderDate")),
                    .BaselineSource = DbHelper.SafeString(r, "BaselineSource"),
                    .Incoterm = DbHelper.SafeString(r, "Incoterm"),
                    .Status = DbHelper.SafeString(r, "Status"),
                    .TotalQty = DbHelper.SafeDecimal(r, "TotalQty"),
                    .LineCount = DbHelper.SafeInt(r, "LineCount"),
                    .LineSummary = DbHelper.SafeString(r, "LineSummary")
                })

            Return Json(orders, JsonRequestBehavior.AllowGet)
        End Function

        ' ========================================================
        ' GET /Orders/GetOrderDetail?orderId=xxx
        ' ========================================================
        Function GetOrderDetail(orderId As String) As JsonResult
            ' Order header
            Dim orderSql As String = "SELECT * FROM Orders WHERE Id = @id"
            Dim orderList = DbHelper.ExecuteReader(orderSql,
                Function(r) New Order With {
                    .Id = DbHelper.SafeString(r, "Id"),
                    .Customer = DbHelper.SafeString(r, "Customer"),
                    .ShipTo = DbHelper.SafeString(r, "ShipTo"),
                    .RequestedShipDate = r.GetDateTime(r.GetOrdinal("RequestedShipDate")),
                    .OrderDate = r.GetDateTime(r.GetOrdinal("OrderDate")),
                    .BaselineSource = DbHelper.SafeString(r, "BaselineSource"),
                    .Incoterm = DbHelper.SafeString(r, "Incoterm"),
                    .Status = DbHelper.SafeString(r, "Status"),
                    .CreatedAt = r.GetDateTime(r.GetOrdinal("CreatedAt"))
                }, New SqlParameter() {New SqlParameter("@id", orderId)})

            If orderList.Count = 0 Then
                Return Json(New With {.error = "Order not found"}, JsonRequestBehavior.AllowGet)
            End If

            Dim ord = orderList(0)

            ' Order lines
            Dim linesSql As String = "SELECT * FROM OrderLines WHERE OrderId = @id ORDER BY Id"
            Dim lines = DbHelper.ExecuteReader(linesSql,
                Function(r) New OrderLine With {
                    .Id = DbHelper.SafeInt(r, "Id"),
                    .OrderId = DbHelper.SafeString(r, "OrderId"),
                    .Sku = DbHelper.SafeString(r, "Sku"),
                    .Description = DbHelper.SafeString(r, "Description"),
                    .Quantity = DbHelper.SafeDecimal(r, "Quantity"),
                    .Uom = DbHelper.SafeString(r, "Uom"),
                    .PackType = DbHelper.SafeString(r, "PackType"),
                    .Hazmat = DbHelper.SafeBool(r, "Hazmat")
                }, New SqlParameter() {New SqlParameter("@id", orderId)})

            ' Recommendations
            Dim recSql As String = "SELECT * FROM Recommendations WHERE OrderId = @id ORDER BY OptionRank"
            Dim recs = DbHelper.ExecuteReader(recSql,
                Function(r) ReadRecommendation(r),
                New SqlParameter() {New SqlParameter("@id", orderId)})

            ' Latest decision
            Dim decSql As String = "SELECT TOP 1 * FROM Decisions WHERE OrderId = @id ORDER BY ApprovalTimestamp DESC"
            Dim decisions = DbHelper.ExecuteReader(decSql,
                Function(r) New Decision With {
                    .Id = DbHelper.SafeInt(r, "Id"),
                    .OrderId = DbHelper.SafeString(r, "OrderId"),
                    .SelectedOptionRank = DbHelper.SafeInt(r, "SelectedOptionRank"),
                    .Approver = DbHelper.SafeString(r, "Approver"),
                    .ApproverRole = DbHelper.SafeString(r, "ApproverRole"),
                    .ApprovalTimestamp = r.GetDateTime(r.GetOrdinal("ApprovalTimestamp")),
                    .ThresholdClass = DbHelper.SafeString(r, "ThresholdClass"),
                    .ReasonCode = DbHelper.SafeString(r, "ReasonCode"),
                    .OverrideFlag = DbHelper.SafeBool(r, "OverrideFlag"),
                    .OverrideComment = DbHelper.SafeString(r, "OverrideComment")
                }, New SqlParameter() {New SqlParameter("@id", orderId)})

            ' Savings
            Dim savSql As String = "SELECT s.*, o.Customer, o.ShipTo FROM SavingsLedger s JOIN Orders o ON o.Id = s.OrderId WHERE s.OrderId = @id"
            Dim savings = DbHelper.ExecuteReader(savSql,
                Function(r) New SavingsLedger With {
                    .Id = DbHelper.SafeInt(r, "Id"),
                    .OrderId = DbHelper.SafeString(r, "OrderId"),
                    .BaselineCost = DbHelper.SafeDecimal(r, "BaselineCost"),
                    .SelectedCost = DbHelper.SafeDecimal(r, "SelectedCost"),
                    .TheoreticalSavings = DbHelper.SafeDecimal(r, "TheoreticalSavings"),
                    .RealizedSavings = DbHelper.SafeDecimal(r, "RealizedSavings"),
                    .FinanceStatus = DbHelper.SafeString(r, "FinanceStatus"),
                    .Period = DbHelper.SafeString(r, "Period"),
                    .Customer = DbHelper.SafeString(r, "Customer"),
                    .ShipTo = DbHelper.SafeString(r, "ShipTo")
                }, New SqlParameter() {New SqlParameter("@id", orderId)})

            ' Customer rules
            Dim rulesSql As String = "SELECT * FROM CustomerRules WHERE Customer = @cust ORDER BY RuleType"
            Dim rules = DbHelper.ExecuteReader(rulesSql,
                Function(r) New CustomerRule With {
                    .Id = DbHelper.SafeInt(r, "Id"),
                    .Customer = DbHelper.SafeString(r, "Customer"),
                    .RuleType = DbHelper.SafeString(r, "RuleType"),
                    .RuleValue = DbHelper.SafeString(r, "RuleValue"),
                    .HardConstraint = DbHelper.SafeBool(r, "HardConstraint"),
                    .EffectiveDate = r.GetDateTime(r.GetOrdinal("EffectiveDate"))
                }, New SqlParameter() {New SqlParameter("@cust", ord.Customer)})

            Dim result = New With {
                .order = ord,
                .lines = lines,
                .recommendations = recs,
                .decision = If(decisions.Count > 0, decisions(0), Nothing),
                .savings = If(savings.Count > 0, savings(0), Nothing),
                .rules = rules
            }

            Return Json(result, JsonRequestBehavior.AllowGet)
        End Function

        ' ========================================================
        ' POST /Orders/Evaluate
        ' ========================================================
        <HttpPost>
        Function Evaluate(orderId As String) As JsonResult
            ' Get order
            Dim orderList = DbHelper.ExecuteReader(
                "SELECT * FROM Orders WHERE Id = @id",
                Function(r) New Order With {
                    .Id = DbHelper.SafeString(r, "Id"),
                    .Customer = DbHelper.SafeString(r, "Customer"),
                    .ShipTo = DbHelper.SafeString(r, "ShipTo"),
                    .RequestedShipDate = r.GetDateTime(r.GetOrdinal("RequestedShipDate")),
                    .OrderDate = r.GetDateTime(r.GetOrdinal("OrderDate")),
                    .BaselineSource = DbHelper.SafeString(r, "BaselineSource"),
                    .Status = DbHelper.SafeString(r, "Status")
                }, New SqlParameter() {New SqlParameter("@id", orderId)})

            If orderList.Count = 0 Then
                Return Json(New With {.success = False, .message = "Order not found"})
            End If

            Dim ord = orderList(0)

            ' Get total quantity for this order
            Dim totalQty As Decimal = CDec(DbHelper.ExecuteScalar(
                "SELECT ISNULL(SUM(Quantity), 0) FROM OrderLines WHERE OrderId = @id",
                New SqlParameter() {New SqlParameter("@id", orderId)}))

            ' Get approved source list for this customer
            Dim approvedSources As New List(Of String)()
            Dim sourceRules = DbHelper.ExecuteReader(
                "SELECT RuleValue FROM CustomerRules WHERE Customer = @cust AND RuleType = 'approved_source' AND HardConstraint = 1",
                Function(r) DbHelper.SafeString(r, "RuleValue"),
                New SqlParameter() {New SqlParameter("@cust", ord.Customer)})

            If sourceRules.Count > 0 AndAlso sourceRules(0) <> "all" Then
                approvedSources.AddRange(sourceRules(0).Split(","c).Select(Function(s) s.Trim()))
            End If

            ' Calculate available days until requested ship date
            Dim availableDays As Integer = CInt(Math.Max(0, (ord.RequestedShipDate - DateTime.Today).TotalDays))

            ' Get all source options
            Dim sources = DbHelper.ExecuteReader(
                "SELECT * FROM SourceOptions",
                Function(r) New SourceOption With {
                    .SourceId = DbHelper.SafeString(r, "SourceId"),
                    .SourceName = DbHelper.SafeString(r, "SourceName"),
                    .ProductionCost = DbHelper.SafeDecimal(r, "ProductionCost"),
                    .BlendingCost = DbHelper.SafeDecimal(r, "BlendingCost"),
                    .PackagingCost = DbHelper.SafeDecimal(r, "PackagingCost"),
                    .CapacityAvailable = DbHelper.SafeDecimal(r, "CapacityAvailable"),
                    .LeadTimeDays = DbHelper.SafeInt(r, "LeadTimeDays"),
                    .FreshnessDate = r.GetDateTime(r.GetOrdinal("FreshnessDate")),
                    .FreshnessStatus = DbHelper.SafeString(r, "FreshnessStatus")
                })

            ' Delete any previous recommendations for this order
            DbHelper.ExecuteNonQuery(
                "DELETE FROM Recommendations WHERE OrderId = @id",
                New SqlParameter() {New SqlParameter("@id", orderId)})

            ' Evaluate each source
            Dim feasibleOptions As New List(Of Recommendation)()
            Dim baselineCost As Decimal = 0

            For Each src In sources
                ' Check hard constraint: approved source
                If approvedSources.Count > 0 AndAlso Not approvedSources.Contains(src.SourceId) Then
                    Continue For
                End If

                ' Check capacity
                If src.CapacityAvailable < totalQty Then
                    Continue For
                End If

                ' Check lead time
                If src.LeadTimeDays > availableDays AndAlso availableDays > 0 Then
                    Continue For
                End If

                ' Get cheapest freight for this origin to destination
                Dim originCity As String = ""
                If SourceCityMap.ContainsKey(src.SourceId) Then
                    originCity = SourceCityMap(src.SourceId)
                Else
                    Continue For
                End If

                Dim laneRates = DbHelper.ExecuteReader(
                    "SELECT TOP 1 * FROM LaneRates WHERE Origin = @origin AND DestinationZone = @dest AND EffectiveDate <= GETDATE() AND ExpiryDate >= GETDATE() ORDER BY BaseRate ASC",
                    Function(r) New LaneRate With {
                        .Origin = DbHelper.SafeString(r, "Origin"),
                        .DestinationZone = DbHelper.SafeString(r, "DestinationZone"),
                        .Carrier = DbHelper.SafeString(r, "Carrier"),
                        .Mode = DbHelper.SafeString(r, "Mode"),
                        .BaseRate = DbHelper.SafeDecimal(r, "BaseRate"),
                        .Accessorial = DbHelper.SafeDecimal(r, "Accessorial")
                    },
                    New SqlParameter() {
                        New SqlParameter("@origin", originCity),
                        New SqlParameter("@dest", ord.ShipTo)
                    })

                If laneRates.Count = 0 Then Continue For

                Dim lane = laneRates(0)

                ' Calculate costs
                Dim productCost As Decimal = src.ProductionCost * totalQty
                Dim blendingCost As Decimal = src.BlendingCost * totalQty
                Dim packagingCost As Decimal = src.PackagingCost * totalQty
                Dim freight As Decimal = lane.BaseRate
                Dim accessorials As Decimal = lane.Accessorial
                Dim landedCost As Decimal = productCost + blendingCost + packagingCost + freight + accessorials

                Dim isBaseline As Boolean = (src.SourceId = ord.BaselineSource)
                If isBaseline Then baselineCost = landedCost

                ' Determine ship promise date
                Dim shipPromise As DateTime = DateTime.Today.AddDays(src.LeadTimeDays)

                ' Determine freshness risk
                Dim riskFlag As String = "green"
                If (DateTime.Today - src.FreshnessDate).TotalDays > 7 Then
                    riskFlag = "amber"
                End If

                Dim rec As New Recommendation With {
                    .OrderId = orderId,
                    .SourceId = src.SourceId,
                    .SourceName = src.SourceName,
                    .LaneDescription = originCity & " -> " & ord.ShipTo,
                    .Mode = lane.Mode,
                    .ShipPromiseDate = shipPromise,
                    .ProductCost = productCost,
                    .BlendingCost = blendingCost,
                    .PackagingCost = packagingCost,
                    .OutboundFreight = freight,
                    .Accessorials = accessorials,
                    .LandedCost = landedCost,
                    .IsBaseline = isBaseline,
                    .RiskFlag = riskFlag
                }

                feasibleOptions.Add(rec)
            Next

            ' Sort by landed cost
            feasibleOptions = feasibleOptions.OrderBy(Function(r) r.LandedCost).ToList()

            ' Calculate deltas vs baseline and assign ranks/reason codes
            If baselineCost = 0 AndAlso feasibleOptions.Count > 0 Then
                ' If baseline source was filtered out, use highest cost as baseline reference
                baselineCost = feasibleOptions.Max(Function(r) r.LandedCost)
            End If

            For i = 0 To feasibleOptions.Count - 1
                Dim rec = feasibleOptions(i)
                rec.OptionRank = i + 1
                rec.DeltaVsBaseline = rec.LandedCost - baselineCost
                If baselineCost > 0 Then
                    rec.DeltaPct = Math.Round((rec.DeltaVsBaseline / baselineCost) * 100, 2)
                End If

                ' Reason codes
                Dim reasons As New List(Of String)()
                If i = 0 Then reasons.Add("LOWEST_COST")
                If rec.IsBaseline Then reasons.Add("BASELINE")
                If rec.DeltaVsBaseline < -100 Then reasons.Add("SIGNIFICANT_SAVINGS")
                If rec.RiskFlag = "green" Then
                    reasons.Add("FRESH_DATA")
                Else
                    reasons.Add("STALE_WARNING")
                End If
                rec.ReasonCodes = String.Join(",", reasons)

                ' Rationale
                Dim rationale As String = ""
                If i = 0 AndAlso rec.IsBaseline Then
                    rationale = "Baseline source is also the lowest cost option for this lane."
                ElseIf i = 0 Then
                    rationale = String.Format("Lowest landed cost at {0:C}, saving {1:C} ({2}%) vs baseline.", rec.LandedCost, Math.Abs(rec.DeltaVsBaseline), Math.Abs(rec.DeltaPct))
                ElseIf rec.IsBaseline Then
                    rationale = "Current baseline source. Reliable and pre-approved."
                Else
                    rationale = String.Format("Alternative option at {0:C}. Delta vs baseline: {1:C} ({2}%).", rec.LandedCost, rec.DeltaVsBaseline, rec.DeltaPct)
                End If
                rec.Rationale = rationale

                ' Insert recommendation
                Dim insertSql As String = "
                    INSERT INTO Recommendations (OrderId, OptionRank, SourceId, SourceName, LaneDescription, Mode,
                        ShipPromiseDate, ProductCost, BlendingCost, PackagingCost, InboundCost, OutboundFreight,
                        Accessorials, Duties, FxImpact, ExpeditePremium, Rebates, LandedCost, DeltaVsBaseline,
                        DeltaPct, RiskFlag, ReasonCodes, Rationale, IsBaseline, AssumptionsVersion)
                    VALUES (@orderId, @rank, @srcId, @srcName, @lane, @mode,
                        @shipDate, @prodCost, @blendCost, @packCost, 0, @freight,
                        @acc, 0, 0, 0, 0, @landed, @delta,
                        @deltaPct, @risk, @reasons, @rationale, @isBase, 'v1.0')"

                DbHelper.ExecuteNonQuery(insertSql, New SqlParameter() {
                    New SqlParameter("@orderId", orderId),
                    New SqlParameter("@rank", rec.OptionRank),
                    New SqlParameter("@srcId", rec.SourceId),
                    New SqlParameter("@srcName", rec.SourceName),
                    New SqlParameter("@lane", rec.LaneDescription),
                    New SqlParameter("@mode", rec.Mode),
                    New SqlParameter("@shipDate", If(rec.ShipPromiseDate, CObj(DBNull.Value))),
                    New SqlParameter("@prodCost", rec.ProductCost),
                    New SqlParameter("@blendCost", rec.BlendingCost),
                    New SqlParameter("@packCost", rec.PackagingCost),
                    New SqlParameter("@freight", rec.OutboundFreight),
                    New SqlParameter("@acc", rec.Accessorials),
                    New SqlParameter("@landed", rec.LandedCost),
                    New SqlParameter("@delta", rec.DeltaVsBaseline),
                    New SqlParameter("@deltaPct", rec.DeltaPct),
                    New SqlParameter("@risk", rec.RiskFlag),
                    New SqlParameter("@reasons", rec.ReasonCodes),
                    New SqlParameter("@rationale", rec.Rationale),
                    New SqlParameter("@isBase", rec.IsBaseline)
                })
            Next

            ' Update order status
            DbHelper.ExecuteNonQuery(
                "UPDATE Orders SET Status = 'evaluated' WHERE Id = @id",
                New SqlParameter() {New SqlParameter("@id", orderId)})

            Return Json(New With {.success = True, .optionCount = feasibleOptions.Count})
        End Function

        ' ========================================================
        ' POST /Orders/Approve
        ' ========================================================
        <HttpPost>
        Function Approve(orderId As String, selectedRank As Integer, approver As String,
                         approverRole As String, reasonCode As String,
                         isOverride As Boolean, overrideComment As String) As JsonResult

            ' Insert decision
            Dim decSql As String = "
                INSERT INTO Decisions (OrderId, SelectedOptionRank, Approver, ApproverRole,
                    ThresholdClass, ReasonCode, OverrideFlag, OverrideComment)
                VALUES (@orderId, @rank, @approver, @role, 'standard', @reason, @override, @comment)"

            DbHelper.ExecuteNonQuery(decSql, New SqlParameter() {
                New SqlParameter("@orderId", orderId),
                New SqlParameter("@rank", selectedRank),
                New SqlParameter("@approver", approver),
                New SqlParameter("@role", approverRole),
                New SqlParameter("@reason", If(reasonCode, "")),
                New SqlParameter("@override", isOverride),
                New SqlParameter("@comment", If(overrideComment, CObj(DBNull.Value)))
            })

            ' Update order status
            Dim newStatus As String = If(isOverride, "overridden", "approved")
            DbHelper.ExecuteNonQuery(
                "UPDATE Orders SET Status = @status WHERE Id = @id",
                New SqlParameter() {
                    New SqlParameter("@status", newStatus),
                    New SqlParameter("@id", orderId)
                })

            ' Get selected and baseline recommendation costs for savings ledger
            Dim selectedCost As Decimal = CDec(DbHelper.ExecuteScalar(
                "SELECT ISNULL(LandedCost, 0) FROM Recommendations WHERE OrderId = @id AND OptionRank = @rank",
                New SqlParameter() {
                    New SqlParameter("@id", orderId),
                    New SqlParameter("@rank", selectedRank)
                }))

            Dim baselineCostObj = DbHelper.ExecuteScalar(
                "SELECT LandedCost FROM Recommendations WHERE OrderId = @id AND IsBaseline = 1",
                New SqlParameter() {New SqlParameter("@id", orderId)})

            Dim baselineCost As Decimal = If(baselineCostObj IsNot Nothing AndAlso Not IsDBNull(baselineCostObj),
                                              CDec(baselineCostObj), selectedCost)

            Dim theoretical As Decimal = baselineCost - selectedCost
            Dim period As String = DateTime.Now.Year.ToString() & "-Q" & Math.Ceiling(DateTime.Now.Month / 3.0).ToString()

            ' Delete existing savings entry and insert new
            DbHelper.ExecuteNonQuery(
                "DELETE FROM SavingsLedger WHERE OrderId = @id",
                New SqlParameter() {New SqlParameter("@id", orderId)})

            DbHelper.ExecuteNonQuery(
                "INSERT INTO SavingsLedger (OrderId, BaselineCost, SelectedCost, TheoreticalSavings, RealizedSavings, FinanceStatus, Period) VALUES (@id, @base, @sel, @theo, 0, 'pending', @period)",
                New SqlParameter() {
                    New SqlParameter("@id", orderId),
                    New SqlParameter("@base", baselineCost),
                    New SqlParameter("@sel", selectedCost),
                    New SqlParameter("@theo", theoretical),
                    New SqlParameter("@period", period)
                })

            Return Json(New With {.success = True, .status = newStatus, .savings = theoretical})
        End Function

        ' ========================================================
        ' GET /Orders/GetDashboard
        ' ========================================================
        Function GetDashboard() As JsonResult
            Dim totalOrders = CInt(DbHelper.ExecuteScalar("SELECT COUNT(*) FROM Orders"))
            Dim readyCount = CInt(DbHelper.ExecuteScalar("SELECT COUNT(*) FROM Orders WHERE Status = 'ready'"))
            Dim evalCount = CInt(DbHelper.ExecuteScalar("SELECT COUNT(*) FROM Orders WHERE Status = 'evaluated'"))
            Dim approvedCount = CInt(DbHelper.ExecuteScalar("SELECT COUNT(*) FROM Orders WHERE Status IN ('approved','shipped','closed')"))
            Dim overriddenCount = CInt(DbHelper.ExecuteScalar("SELECT COUNT(*) FROM Orders WHERE Status = 'overridden'"))
            Dim shippedCount = CInt(DbHelper.ExecuteScalar("SELECT COUNT(*) FROM Orders WHERE Status = 'shipped'"))
            Dim closedCount = CInt(DbHelper.ExecuteScalar("SELECT COUNT(*) FROM Orders WHERE Status = 'closed'"))

            Dim theoSavings As Object = DbHelper.ExecuteScalar("SELECT ISNULL(SUM(TheoreticalSavings), 0) FROM SavingsLedger")
            Dim realSavings As Object = DbHelper.ExecuteScalar("SELECT ISNULL(SUM(RealizedSavings), 0) FROM SavingsLedger")

            Dim totalDecisions = CInt(DbHelper.ExecuteScalar("SELECT COUNT(*) FROM Decisions"))
            Dim overrideDecisions = CInt(DbHelper.ExecuteScalar("SELECT COUNT(*) FROM Decisions WHERE OverrideFlag = 1"))

            Dim acceptRate As Decimal = 0
            Dim overrideRate As Decimal = 0
            If totalDecisions > 0 Then
                acceptRate = Math.Round(CDec(totalDecisions - overrideDecisions) / totalDecisions * 100, 1)
                overrideRate = Math.Round(CDec(overrideDecisions) / totalDecisions * 100, 1)
            End If

            Dim vm As New DashboardViewModel With {
                .TotalOrders = totalOrders,
                .ReadyCount = readyCount,
                .EvaluatedCount = evalCount,
                .ApprovedCount = approvedCount,
                .OverriddenCount = overriddenCount,
                .ShippedCount = shippedCount,
                .ClosedCount = closedCount,
                .TheoreticalSavings = CDec(theoSavings),
                .RealizedSavings = CDec(realSavings),
                .AcceptanceRate = acceptRate,
                .OverrideRate = overrideRate
            }

            Return Json(vm, JsonRequestBehavior.AllowGet)
        End Function

        ' ========================================================
        ' GET /Orders/GetSavings
        ' ========================================================
        Function GetSavings() As JsonResult
            Dim sql As String = "
                SELECT s.*, o.Customer, o.ShipTo
                FROM SavingsLedger s
                JOIN Orders o ON o.Id = s.OrderId
                ORDER BY s.Id DESC"

            Dim savings = DbHelper.ExecuteReader(sql,
                Function(r) New SavingsLedger With {
                    .Id = DbHelper.SafeInt(r, "Id"),
                    .OrderId = DbHelper.SafeString(r, "OrderId"),
                    .BaselineCost = DbHelper.SafeDecimal(r, "BaselineCost"),
                    .SelectedCost = DbHelper.SafeDecimal(r, "SelectedCost"),
                    .TheoreticalSavings = DbHelper.SafeDecimal(r, "TheoreticalSavings"),
                    .RealizedSavings = DbHelper.SafeDecimal(r, "RealizedSavings"),
                    .FinanceStatus = DbHelper.SafeString(r, "FinanceStatus"),
                    .Period = DbHelper.SafeString(r, "Period"),
                    .Customer = DbHelper.SafeString(r, "Customer"),
                    .ShipTo = DbHelper.SafeString(r, "ShipTo")
                })

            Return Json(savings, JsonRequestBehavior.AllowGet)
        End Function

        ' ========================================================
        ' GET /Orders/GetSources
        ' ========================================================
        Function GetSources() As JsonResult
            Dim sources = DbHelper.ExecuteReader(
                "SELECT * FROM SourceOptions ORDER BY SourceId",
                Function(r) New SourceOption With {
                    .Id = DbHelper.SafeInt(r, "Id"),
                    .SourceId = DbHelper.SafeString(r, "SourceId"),
                    .SourceName = DbHelper.SafeString(r, "SourceName"),
                    .Region = DbHelper.SafeString(r, "Region"),
                    .ProductionCost = DbHelper.SafeDecimal(r, "ProductionCost"),
                    .BlendingCost = DbHelper.SafeDecimal(r, "BlendingCost"),
                    .PackagingCost = DbHelper.SafeDecimal(r, "PackagingCost"),
                    .CapacityAvailable = DbHelper.SafeDecimal(r, "CapacityAvailable"),
                    .LeadTimeDays = DbHelper.SafeInt(r, "LeadTimeDays"),
                    .FreshnessDate = r.GetDateTime(r.GetOrdinal("FreshnessDate")),
                    .FreshnessStatus = DbHelper.SafeString(r, "FreshnessStatus")
                })
            Return Json(sources, JsonRequestBehavior.AllowGet)
        End Function

        ' ========================================================
        ' GET /Orders/GetRules
        ' ========================================================
        Function GetRules() As JsonResult
            Dim rules = DbHelper.ExecuteReader(
                "SELECT * FROM CustomerRules ORDER BY Customer, RuleType",
                Function(r) New CustomerRule With {
                    .Id = DbHelper.SafeInt(r, "Id"),
                    .Customer = DbHelper.SafeString(r, "Customer"),
                    .RuleType = DbHelper.SafeString(r, "RuleType"),
                    .RuleValue = DbHelper.SafeString(r, "RuleValue"),
                    .HardConstraint = DbHelper.SafeBool(r, "HardConstraint"),
                    .EffectiveDate = r.GetDateTime(r.GetOrdinal("EffectiveDate"))
                })
            Return Json(rules, JsonRequestBehavior.AllowGet)
        End Function

        ' ========================================================
        ' GET /Orders/GetRates
        ' ========================================================
        Function GetRates() As JsonResult
            Dim rates = DbHelper.ExecuteReader(
                "SELECT * FROM LaneRates ORDER BY Origin, DestinationZone",
                Function(r) New LaneRate With {
                    .Id = DbHelper.SafeInt(r, "Id"),
                    .Origin = DbHelper.SafeString(r, "Origin"),
                    .DestinationZone = DbHelper.SafeString(r, "DestinationZone"),
                    .Carrier = DbHelper.SafeString(r, "Carrier"),
                    .Mode = DbHelper.SafeString(r, "Mode"),
                    .BaseRate = DbHelper.SafeDecimal(r, "BaseRate"),
                    .Accessorial = DbHelper.SafeDecimal(r, "Accessorial"),
                    .EffectiveDate = r.GetDateTime(r.GetOrdinal("EffectiveDate")),
                    .ExpiryDate = r.GetDateTime(r.GetOrdinal("ExpiryDate"))
                })
            Return Json(rates, JsonRequestBehavior.AllowGet)
        End Function

        ' ========================================================
        ' GET /Orders/GetFx
        ' ========================================================
        Function GetFx() As JsonResult
            Dim fx = DbHelper.ExecuteReader(
                "SELECT * FROM FxRates ORDER BY FromCurrency, ToCurrency",
                Function(r) New FxRate With {
                    .Id = DbHelper.SafeInt(r, "Id"),
                    .FromCurrency = DbHelper.SafeString(r, "FromCurrency"),
                    .ToCurrency = DbHelper.SafeString(r, "ToCurrency"),
                    .Rate = DbHelper.SafeDecimal(r, "Rate"),
                    .RateDate = r.GetDateTime(r.GetOrdinal("RateDate")),
                    .Source = DbHelper.SafeString(r, "Source"),
                    .FreshnessStatus = DbHelper.SafeString(r, "FreshnessStatus")
                })
            Return Json(fx, JsonRequestBehavior.AllowGet)
        End Function

        ' ========================================================
        ' GET /Orders/GetIssues
        ' ========================================================
        Function GetIssues() As JsonResult
            Dim issues = DbHelper.ExecuteReader(
                "SELECT * FROM Issues ORDER BY CASE Status WHEN 'open' THEN 0 WHEN 'backlog' THEN 1 ELSE 2 END, OpenedDate DESC",
                Function(r) New Issue With {
                    .Id = DbHelper.SafeInt(r, "Id"),
                    .OpenedDate = r.GetDateTime(r.GetOrdinal("OpenedDate")),
                    .Category = DbHelper.SafeString(r, "Category"),
                    .Issue = DbHelper.SafeString(r, "Issue"),
                    .Owner = DbHelper.SafeString(r, "Owner"),
                    .TargetDate = DbHelper.SafeDate(r, "TargetDate"),
                    .Status = DbHelper.SafeString(r, "Status"),
                    .Comments = DbHelper.SafeString(r, "Comments")
                })
            Return Json(issues, JsonRequestBehavior.AllowGet)
        End Function

        ' ========================================================
        ' GET /Orders/GetDecisions
        ' ========================================================
        Function GetDecisions() As JsonResult
            Dim sql As String = "
                SELECT d.*, o.Customer, o.ShipTo,
                       r.SourceName, r.LandedCost
                FROM Decisions d
                JOIN Orders o ON o.Id = d.OrderId
                LEFT JOIN Recommendations r ON r.OrderId = d.OrderId AND r.OptionRank = d.SelectedOptionRank
                ORDER BY d.ApprovalTimestamp DESC"

            Dim decisions = DbHelper.ExecuteReader(sql,
                Function(r) New Decision With {
                    .Id = DbHelper.SafeInt(r, "Id"),
                    .OrderId = DbHelper.SafeString(r, "OrderId"),
                    .SelectedOptionRank = DbHelper.SafeInt(r, "SelectedOptionRank"),
                    .Approver = DbHelper.SafeString(r, "Approver"),
                    .ApproverRole = DbHelper.SafeString(r, "ApproverRole"),
                    .ApprovalTimestamp = r.GetDateTime(r.GetOrdinal("ApprovalTimestamp")),
                    .ThresholdClass = DbHelper.SafeString(r, "ThresholdClass"),
                    .ReasonCode = DbHelper.SafeString(r, "ReasonCode"),
                    .OverrideFlag = DbHelper.SafeBool(r, "OverrideFlag"),
                    .OverrideComment = DbHelper.SafeString(r, "OverrideComment"),
                    .Customer = DbHelper.SafeString(r, "Customer"),
                    .ShipTo = DbHelper.SafeString(r, "ShipTo"),
                    .SourceName = DbHelper.SafeString(r, "SourceName"),
                    .LandedCost = DbHelper.SafeDecimal(r, "LandedCost")
                })

            Return Json(decisions, JsonRequestBehavior.AllowGet)
        End Function

        ' ========================================================
        ' POST /Orders/RunScenario
        ' ========================================================
        <HttpPost>
        Function RunScenario(orderId As String, freightShiftPct As Decimal, fxShiftPct As Decimal) As JsonResult
            ' Get current recommendations for this order
            Dim recs = DbHelper.ExecuteReader(
                "SELECT * FROM Recommendations WHERE OrderId = @id ORDER BY OptionRank",
                Function(r) ReadRecommendation(r),
                New SqlParameter() {New SqlParameter("@id", orderId)})

            If recs.Count = 0 Then
                Return Json(New With {.success = False, .message = "No recommendations found. Evaluate order first."})
            End If

            ' Apply scenario shifts
            Dim scenarioResults As New List(Of Object)()
            For Each rec In recs
                Dim freightMultiplier As Decimal = 1 + (freightShiftPct / 100)
                Dim fxMultiplier As Decimal = 1 + (fxShiftPct / 100)

                Dim adjFreight As Decimal = rec.OutboundFreight * freightMultiplier
                Dim adjAccessorials As Decimal = rec.Accessorials * freightMultiplier
                Dim adjFxImpact As Decimal = (rec.ProductCost + rec.BlendingCost + rec.PackagingCost) * (fxMultiplier - 1)
                Dim adjLanded As Decimal = rec.ProductCost + rec.BlendingCost + rec.PackagingCost + adjFreight + adjAccessorials + adjFxImpact

                scenarioResults.Add(New With {
                    .OptionRank = rec.OptionRank,
                    .SourceId = rec.SourceId,
                    .SourceName = rec.SourceName,
                    .OriginalLandedCost = rec.LandedCost,
                    .AdjustedFreight = adjFreight,
                    .AdjustedAccessorials = adjAccessorials,
                    .FxImpact = adjFxImpact,
                    .AdjustedLandedCost = adjLanded,
                    .CostDelta = adjLanded - rec.LandedCost,
                    .DeltaPct = If(rec.LandedCost > 0, Math.Round((adjLanded - rec.LandedCost) / rec.LandedCost * 100, 2), 0)
                })
            Next

            ' Re-rank by adjusted landed cost
            scenarioResults = scenarioResults.OrderBy(Function(s) CDec(CallByName(s, "AdjustedLandedCost", CallType.Get))).ToList()

            Return Json(New With {.success = True, .scenarios = scenarioResults, .freightShiftPct = freightShiftPct, .fxShiftPct = fxShiftPct})
        End Function

        ' ========================================================
        ' Helper: Read a Recommendation from SqlDataReader
        ' ========================================================
        Private Function ReadRecommendation(r As SqlDataReader) As Recommendation
            Return New Recommendation With {
                .Id = DbHelper.SafeInt(r, "Id"),
                .OrderId = DbHelper.SafeString(r, "OrderId"),
                .OptionRank = DbHelper.SafeInt(r, "OptionRank"),
                .SourceId = DbHelper.SafeString(r, "SourceId"),
                .SourceName = DbHelper.SafeString(r, "SourceName"),
                .LaneDescription = DbHelper.SafeString(r, "LaneDescription"),
                .Mode = DbHelper.SafeString(r, "Mode"),
                .ShipPromiseDate = DbHelper.SafeDate(r, "ShipPromiseDate"),
                .ProductCost = DbHelper.SafeDecimal(r, "ProductCost"),
                .BlendingCost = DbHelper.SafeDecimal(r, "BlendingCost"),
                .PackagingCost = DbHelper.SafeDecimal(r, "PackagingCost"),
                .InboundCost = DbHelper.SafeDecimal(r, "InboundCost"),
                .OutboundFreight = DbHelper.SafeDecimal(r, "OutboundFreight"),
                .Accessorials = DbHelper.SafeDecimal(r, "Accessorials"),
                .Duties = DbHelper.SafeDecimal(r, "Duties"),
                .FxImpact = DbHelper.SafeDecimal(r, "FxImpact"),
                .ExpeditePremium = DbHelper.SafeDecimal(r, "ExpeditePremium"),
                .Rebates = DbHelper.SafeDecimal(r, "Rebates"),
                .LandedCost = DbHelper.SafeDecimal(r, "LandedCost"),
                .DeltaVsBaseline = DbHelper.SafeDecimal(r, "DeltaVsBaseline"),
                .DeltaPct = DbHelper.SafeDecimal(r, "DeltaPct"),
                .RiskFlag = DbHelper.SafeString(r, "RiskFlag"),
                .ReasonCodes = DbHelper.SafeString(r, "ReasonCodes"),
                .Rationale = DbHelper.SafeString(r, "Rationale"),
                .IsBaseline = DbHelper.SafeBool(r, "IsBaseline"),
                .AssumptionsVersion = DbHelper.SafeString(r, "AssumptionsVersion"),
                .CreatedAt = r.GetDateTime(r.GetOrdinal("CreatedAt"))
            }
        End Function

    End Class
End Namespace
