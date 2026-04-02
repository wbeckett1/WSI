Imports System.Web.Mvc
Imports System.Data.SqlClient
Imports System.IO
Imports WSIFieldService.Helpers
Imports WSIFieldService.Models

Namespace WSIFieldService.Controllers
    Public Class VisitsController
        Inherits Controller

        ' ──────────────────────────────────────────────
        '  GET  /Visits/GetDashboard
        ' ──────────────────────────────────────────────
        Function GetDashboard() As JsonResult
            Dim vm As New DashboardViewModel()

            ' Status counts
            Dim counts = DbHelper.ExecuteReader(
                "SELECT Status, COUNT(*) AS Cnt FROM Visits GROUP BY Status",
                Function(r)
                    Return New With {
                        .Status = DbHelper.SafeStr(r, "Status"),
                        .Cnt = r.GetInt32(r.GetOrdinal("Cnt"))
                    }
                End Function)

            vm.TotalVisits = counts.Sum(Function(c) c.Cnt)
            For Each c In counts
                Select Case c.Status
                    Case "planned" : vm.PlannedCount = c.Cnt
                    Case "in_progress" : vm.InProgressCount = c.Cnt
                    Case "draft_complete" : vm.DraftCompleteCount = c.Cnt
                    Case "in_review" : vm.InReviewCount = c.Cnt
                    Case "approved" : vm.ApprovedCount = c.Cnt
                    Case "published" : vm.PublishedCount = c.Cnt
                End Select
            Next

            ' Action counts
            Dim actionCounts = DbHelper.ExecuteReader(
                "SELECT
                    SUM(CASE WHEN Status IN ('open','in_progress') THEN 1 ELSE 0 END) AS OpenCnt,
                    SUM(CASE WHEN Severity = 'critical' AND Status IN ('open','in_progress') THEN 1 ELSE 0 END) AS CritCnt
                 FROM ActionItems",
                Function(r)
                    Return New With {
                        .OpenCnt = If(r.IsDBNull(0), 0, r.GetInt32(0)),
                        .CritCnt = If(r.IsDBNull(1), 0, r.GetInt32(1))
                    }
                End Function)
            If actionCounts.Count > 0 Then
                vm.OpenActions = actionCounts(0).OpenCnt
                vm.CriticalActions = actionCounts(0).CritCnt
            End If

            ' Recent visits
            vm.RecentVisits = DbHelper.ExecuteReader(
                "SELECT TOP 10 v.*, s.SiteName, s.AccountName, u.Name AS ConsultantName
                 FROM Visits v
                 INNER JOIN Sites s ON v.SiteId = s.SiteId
                 INNER JOIN Users u ON v.ConsultantId = u.UserId
                 ORDER BY v.VisitDate DESC",
                Function(r) MapVisit(r))

            ' Priority actions
            vm.PriorityActions = DbHelper.ExecuteReader(
                "SELECT TOP 10 a.*, s.SiteName
                 FROM ActionItems a
                 INNER JOIN Visits v ON a.VisitId = v.VisitId
                 INNER JOIN Sites s ON v.SiteId = s.SiteId
                 WHERE a.Status IN ('open','in_progress')
                 ORDER BY CASE a.Severity
                    WHEN 'critical' THEN 1 WHEN 'high' THEN 2
                    WHEN 'medium' THEN 3 ELSE 4 END, a.DueDate",
                Function(r) MapActionItem(r))

            Return Json(vm, JsonRequestBehavior.AllowGet)
        End Function

        ' ──────────────────────────────────────────────
        '  GET  /Visits/GetSites
        ' ──────────────────────────────────────────────
        Function GetSites() As JsonResult
            Dim sites = DbHelper.ExecuteReader(
                "SELECT * FROM Sites ORDER BY AccountName, SiteName",
                Function(r) New Site() With {
                    .SiteId = DbHelper.SafeStr(r, "SiteId"),
                    .AccountName = DbHelper.SafeStr(r, "AccountName"),
                    .SiteName = DbHelper.SafeStr(r, "SiteName"),
                    .Address = DbHelper.SafeStr(r, "Address"),
                    .ServiceLines = DbHelper.SafeStr(r, "ServiceLines"),
                    .Contacts = DbHelper.SafeStr(r, "Contacts")
                })
            Return Json(sites, JsonRequestBehavior.AllowGet)
        End Function

        ' ──────────────────────────────────────────────
        '  GET  /Visits/GetUsers
        ' ──────────────────────────────────────────────
        Function GetUsers() As JsonResult
            Dim users = DbHelper.ExecuteReader(
                "SELECT * FROM Users ORDER BY Name",
                Function(r) New User() With {
                    .UserId = DbHelper.SafeStr(r, "UserId"),
                    .Name = DbHelper.SafeStr(r, "Name"),
                    .Role = DbHelper.SafeStr(r, "Role"),
                    .Email = DbHelper.SafeStr(r, "Email")
                })
            Return Json(users, JsonRequestBehavior.AllowGet)
        End Function

        ' ──────────────────────────────────────────────
        '  GET  /Visits/GetVisits
        ' ──────────────────────────────────────────────
        Function GetVisits() As JsonResult
            Dim visits = DbHelper.ExecuteReader(
                "SELECT v.*, s.SiteName, s.AccountName, u.Name AS ConsultantName
                 FROM Visits v
                 INNER JOIN Sites s ON v.SiteId = s.SiteId
                 INNER JOIN Users u ON v.ConsultantId = u.UserId
                 ORDER BY v.VisitDate DESC",
                Function(r) MapVisit(r))
            Return Json(visits, JsonRequestBehavior.AllowGet)
        End Function

        ' ──────────────────────────────────────────────
        '  GET  /Visits/GetVisitDetail?visitId=...
        ' ──────────────────────────────────────────────
        Function GetVisitDetail(visitId As String) As JsonResult
            ' Visit with joins
            Dim visits = DbHelper.ExecuteReader(
                "SELECT v.*, s.SiteName, s.AccountName, s.Address, s.ServiceLines, s.Contacts,
                        u.Name AS ConsultantName
                 FROM Visits v
                 INNER JOIN Sites s ON v.SiteId = s.SiteId
                 INNER JOIN Users u ON v.ConsultantId = u.UserId
                 WHERE v.VisitId = @vid",
                Function(r) MapVisit(r),
                {New SqlParameter("@vid", visitId)})

            If visits.Count = 0 Then
                Return Json(New With {.error = "Visit not found"}, JsonRequestBehavior.AllowGet)
            End If

            Dim visit = visits(0)

            ' WF observations
            Dim wfObs = DbHelper.ExecuteReader(
                "SELECT * FROM WfObservations WHERE VisitId = @vid ORDER BY Id",
                Function(r) MapWfObs(r),
                {New SqlParameter("@vid", visitId)})

            ' WW observations
            Dim wwObs = DbHelper.ExecuteReader(
                "SELECT * FROM WwObservations WHERE VisitId = @vid ORDER BY Id",
                Function(r) MapWwObs(r),
                {New SqlParameter("@vid", visitId)})

            ' Action items
            Dim actions = DbHelper.ExecuteReader(
                "SELECT a.*, s.SiteName FROM ActionItems a
                 INNER JOIN Visits v ON a.VisitId = v.VisitId
                 INNER JOIN Sites s ON v.SiteId = s.SiteId
                 WHERE a.VisitId = @vid ORDER BY a.CreatedAt",
                Function(r) MapActionItem(r),
                {New SqlParameter("@vid", visitId)})

            ' Attachments
            Dim attachments = DbHelper.ExecuteReader(
                "SELECT * FROM Attachments WHERE VisitId = @vid ORDER BY CreatedAt",
                Function(r) New Attachment() With {
                    .AttachmentId = DbHelper.SafeStr(r, "AttachmentId"),
                    .VisitId = DbHelper.SafeStr(r, "VisitId"),
                    .SectionRef = DbHelper.SafeStr(r, "SectionRef"),
                    .FilePath = DbHelper.SafeStr(r, "FilePath"),
                    .Caption = DbHelper.SafeStr(r, "Caption"),
                    .CreatedAt = r.GetDateTime(r.GetOrdinal("CreatedAt"))
                },
                {New SqlParameter("@vid", visitId)})

            ' Approvals
            Dim approvals = DbHelper.ExecuteReader(
                "SELECT ae.*, u.Name AS ActorName FROM ApprovalEvents ae
                 INNER JOIN Users u ON ae.ActorId = u.UserId
                 WHERE ae.VisitId = @vid ORDER BY ae.Timestamp",
                Function(r) New ApprovalEvent() With {
                    .Id = r.GetInt32(r.GetOrdinal("Id")),
                    .VisitId = DbHelper.SafeStr(r, "VisitId"),
                    .Stage = DbHelper.SafeStr(r, "Stage"),
                    .ActorId = DbHelper.SafeStr(r, "ActorId"),
                    .Decision = DbHelper.SafeStr(r, "Decision"),
                    .Comment = DbHelper.SafeStr(r, "Comment"),
                    .Timestamp = r.GetDateTime(r.GetOrdinal("Timestamp")),
                    .ActorName = DbHelper.SafeStr(r, "ActorName")
                },
                {New SqlParameter("@vid", visitId)})

            ' Signatures
            Dim sigs = DbHelper.ExecuteReader(
                "SELECT * FROM Signatures WHERE VisitId = @vid ORDER BY SignedAt",
                Function(r) New Signature() With {
                    .Id = r.GetInt32(r.GetOrdinal("Id")),
                    .VisitId = DbHelper.SafeStr(r, "VisitId"),
                    .SignerName = DbHelper.SafeStr(r, "SignerName"),
                    .SignerRole = DbHelper.SafeStr(r, "SignerRole"),
                    .SignatureData = DbHelper.SafeStr(r, "SignatureData"),
                    .SignedAt = r.GetDateTime(r.GetOrdinal("SignedAt"))
                },
                {New SqlParameter("@vid", visitId)})

            Return Json(New With {
                .visit = visit,
                .wfObservations = wfObs,
                .wwObservations = wwObs,
                .actionItems = actions,
                .attachments = attachments,
                .approvals = approvals,
                .signatures = sigs
            }, JsonRequestBehavior.AllowGet)
        End Function

        ' ──────────────────────────────────────────────
        '  POST /Visits/CreateVisit
        ' ──────────────────────────────────────────────
        <HttpPost>
        Function CreateVisit(siteId As String, consultantId As String, visitDate As String, reportPack As String) As JsonResult
            Dim newId = "VIS-" & Guid.NewGuid().ToString("N").Substring(0, 8).ToUpper()
            Dim vDate As DateTime = DateTime.Parse(visitDate)

            DbHelper.ExecuteNonQuery(
                "INSERT INTO Visits (VisitId, SiteId, ConsultantId, VisitDate, ReportPack, Status, CreatedAt, UpdatedAt)
                 VALUES (@id, @sid, @cid, @vd, @rp, 'planned', GETDATE(), GETDATE())",
                {
                    New SqlParameter("@id", newId),
                    New SqlParameter("@sid", siteId),
                    New SqlParameter("@cid", consultantId),
                    New SqlParameter("@vd", vDate),
                    New SqlParameter("@rp", reportPack)
                })

            Return Json(New With {.success = True, .visitId = newId})
        End Function

        ' ──────────────────────────────────────────────
        '  POST /Visits/UpdateVisit
        ' ──────────────────────────────────────────────
        <HttpPost>
        Function UpdateVisit(visitId As String, entranceNotes As String, generalObservations As String,
                             exitNotes As String, distributionList As String, status As String) As JsonResult
            DbHelper.ExecuteNonQuery(
                "UPDATE Visits SET EntranceNotes = @en, GeneralObservations = @go, ExitNotes = @ex,
                 DistributionList = @dl, Status = COALESCE(NULLIF(@st,''), Status), UpdatedAt = GETDATE()
                 WHERE VisitId = @vid",
                {
                    New SqlParameter("@vid", visitId),
                    New SqlParameter("@en", If(entranceNotes, CObj(DBNull.Value))),
                    New SqlParameter("@go", If(generalObservations, CObj(DBNull.Value))),
                    New SqlParameter("@ex", If(exitNotes, CObj(DBNull.Value))),
                    New SqlParameter("@dl", If(distributionList, CObj(DBNull.Value))),
                    New SqlParameter("@st", If(status, ""))
                })

            Return Json(New With {.success = True})
        End Function

        ' ──────────────────────────────────────────────
        '  POST /Visits/SaveWfObservations
        ' ──────────────────────────────────────────────
        <HttpPost>
        Function SaveWfObservations(visitId As String, observations As String) As JsonResult
            Dim obsList = System.Web.Helpers.Json.Decode(observations)

            ' Delete existing
            DbHelper.ExecuteNonQuery("DELETE FROM WfObservations WHERE VisitId = @vid",
                {New SqlParameter("@vid", visitId)})

            ' Bulk insert
            For Each obs In obsList
                Dim pLow As Object = DBNull.Value
                Dim pHigh As Object = DBNull.Value

                If obs("thresholdLow") IsNot Nothing AndAlso obs("thresholdLow").ToString() <> "" Then
                    pLow = CDec(obs("thresholdLow"))
                End If
                If obs("thresholdHigh") IsNot Nothing AndAlso obs("thresholdHigh").ToString() <> "" Then
                    pHigh = CDec(obs("thresholdHigh"))
                End If

                DbHelper.ExecuteNonQuery(
                    "INSERT INTO WfObservations (VisitId, Section, FieldCode, FieldLabel, Value, Unit, ThresholdLow, ThresholdHigh, Flag, Notes)
                     VALUES (@vid, @sec, @fc, @fl, @val, @unit, @tl, @th, @flag, @notes)",
                    {
                        New SqlParameter("@vid", visitId),
                        New SqlParameter("@sec", If(CStr(obs("section")), "")),
                        New SqlParameter("@fc", If(CStr(obs("fieldCode")), "")),
                        New SqlParameter("@fl", If(CStr(obs("fieldLabel")), "")),
                        New SqlParameter("@val", If(CStr(obs("value")), CObj(DBNull.Value))),
                        New SqlParameter("@unit", If(CStr(obs("unit")), "")),
                        New SqlParameter("@tl", pLow),
                        New SqlParameter("@th", pHigh),
                        New SqlParameter("@flag", If(CStr(obs("flag")), CObj(DBNull.Value))),
                        New SqlParameter("@notes", If(CStr(obs("notes")), CObj(DBNull.Value)))
                    })
            Next

            Return Json(New With {.success = True})
        End Function

        ' ──────────────────────────────────────────────
        '  POST /Visits/SaveWwObservations
        ' ──────────────────────────────────────────────
        <HttpPost>
        Function SaveWwObservations(visitId As String, observations As String) As JsonResult
            Dim obsList = System.Web.Helpers.Json.Decode(observations)

            DbHelper.ExecuteNonQuery("DELETE FROM WwObservations WHERE VisitId = @vid",
                {New SqlParameter("@vid", visitId)})

            For Each obs In obsList
                Dim pLow As Object = DBNull.Value
                Dim pHigh As Object = DBNull.Value

                If obs("thresholdLow") IsNot Nothing AndAlso obs("thresholdLow").ToString() <> "" Then
                    pLow = CDec(obs("thresholdLow"))
                End If
                If obs("thresholdHigh") IsNot Nothing AndAlso obs("thresholdHigh").ToString() <> "" Then
                    pHigh = CDec(obs("thresholdHigh"))
                End If

                DbHelper.ExecuteNonQuery(
                    "INSERT INTO WwObservations (VisitId, Section, FieldCode, FieldLabel, Value, Unit, ThresholdLow, ThresholdHigh, Status, Notes)
                     VALUES (@vid, @sec, @fc, @fl, @val, @unit, @tl, @th, @st, @notes)",
                    {
                        New SqlParameter("@vid", visitId),
                        New SqlParameter("@sec", If(CStr(obs("section")), "")),
                        New SqlParameter("@fc", If(CStr(obs("fieldCode")), "")),
                        New SqlParameter("@fl", If(CStr(obs("fieldLabel")), "")),
                        New SqlParameter("@val", If(CStr(obs("value")), CObj(DBNull.Value))),
                        New SqlParameter("@unit", If(CStr(obs("unit")), "")),
                        New SqlParameter("@tl", pLow),
                        New SqlParameter("@th", pHigh),
                        New SqlParameter("@st", If(CStr(obs("status")), CObj(DBNull.Value))),
                        New SqlParameter("@notes", If(CStr(obs("notes")), CObj(DBNull.Value)))
                    })
            Next

            Return Json(New With {.success = True})
        End Function

        ' ──────────────────────────────────────────────
        '  POST /Visits/CreateActionItem
        ' ──────────────────────────────────────────────
        <HttpPost>
        Function CreateActionItem(visitId As String, sectionRef As String, description As String,
                                  severity As String, owner As String, dueDate As String) As JsonResult
            Dim newId = "ACT-" & Guid.NewGuid().ToString("N").Substring(0, 8).ToUpper()
            Dim dd As Object = DBNull.Value
            If Not String.IsNullOrEmpty(dueDate) Then dd = DateTime.Parse(dueDate)

            DbHelper.ExecuteNonQuery(
                "INSERT INTO ActionItems (ActionItemId, VisitId, SectionRef, Description, Severity, Owner, DueDate, Status, CreatedAt)
                 VALUES (@id, @vid, @sec, @desc, @sev, @own, @dd, 'open', GETDATE())",
                {
                    New SqlParameter("@id", newId),
                    New SqlParameter("@vid", visitId),
                    New SqlParameter("@sec", If(sectionRef, "")),
                    New SqlParameter("@desc", description),
                    New SqlParameter("@sev", If(severity, "medium")),
                    New SqlParameter("@own", If(owner, CObj(DBNull.Value))),
                    New SqlParameter("@dd", dd)
                })

            Return Json(New With {.success = True, .actionItemId = newId})
        End Function

        ' ──────────────────────────────────────────────
        '  POST /Visits/UpdateActionItem
        ' ──────────────────────────────────────────────
        <HttpPost>
        Function UpdateActionItem(actionItemId As String, status As String, comments As String) As JsonResult
            DbHelper.ExecuteNonQuery(
                "UPDATE ActionItems SET Status = @st, Comments = @cmt WHERE ActionItemId = @aid",
                {
                    New SqlParameter("@aid", actionItemId),
                    New SqlParameter("@st", If(status, "open")),
                    New SqlParameter("@cmt", If(comments, CObj(DBNull.Value)))
                })

            Return Json(New With {.success = True})
        End Function

        ' ──────────────────────────────────────────────
        '  POST /Visits/UploadPhoto
        ' ──────────────────────────────────────────────
        <HttpPost>
        Function UploadPhoto(visitId As String) As JsonResult
            If Request.Files.Count = 0 Then
                Return Json(New With {.success = False, .error = "No file uploaded"})
            End If

            Dim file As HttpPostedFileBase = Request.Files(0)
            If file Is Nothing OrElse file.ContentLength = 0 Then
                Return Json(New With {.success = False, .error = "Empty file"})
            End If

            Dim uploadsDir = Server.MapPath("~/Uploads/")
            If Not Directory.Exists(uploadsDir) Then Directory.CreateDirectory(uploadsDir)

            Dim ext = Path.GetExtension(file.FileName)
            Dim fileName = Guid.NewGuid().ToString("N") & ext
            Dim filePath = Path.Combine(uploadsDir, fileName)
            file.SaveAs(filePath)

            Dim attachId = "ATT-" & Guid.NewGuid().ToString("N").Substring(0, 8).ToUpper()
            Dim caption = If(Request.Form("caption"), "")
            Dim sectionRef = If(Request.Form("sectionRef"), "")

            DbHelper.ExecuteNonQuery(
                "INSERT INTO Attachments (AttachmentId, VisitId, SectionRef, FilePath, Caption, CreatedAt)
                 VALUES (@id, @vid, @sec, @fp, @cap, GETDATE())",
                {
                    New SqlParameter("@id", attachId),
                    New SqlParameter("@vid", visitId),
                    New SqlParameter("@sec", sectionRef),
                    New SqlParameter("@fp", "/Uploads/" & fileName),
                    New SqlParameter("@cap", caption)
                })

            Return Json(New With {.success = True, .attachmentId = attachId, .filePath = "/Uploads/" & fileName})
        End Function

        ' ──────────────────────────────────────────────
        '  POST /Visits/DoWorkflow
        ' ──────────────────────────────────────────────
        <HttpPost>
        Function DoWorkflow(visitId As String, action As String, actorId As String, comment As String) As JsonResult
            ' Get current status
            Dim currentStatus = CStr(DbHelper.ExecuteScalar(
                "SELECT Status FROM Visits WHERE VisitId = @vid",
                {New SqlParameter("@vid", visitId)}))

            Dim newStatus As String = Nothing
            Dim stage As String = ""

            Select Case currentStatus
                Case "planned"
                    If action = "submit" Then
                        newStatus = "in_progress"
                        stage = "planned_to_in_progress"
                    End If
                Case "in_progress"
                    If action = "submit" Then
                        newStatus = "draft_complete"
                        stage = "in_progress_to_draft_complete"
                    End If
                Case "draft_complete"
                    If action = "submit" Then
                        newStatus = "in_review"
                        stage = "draft_complete_to_in_review"
                    End If
                Case "in_review"
                    If action = "approve" Then
                        newStatus = "approved"
                        stage = "in_review_to_approved"
                    ElseIf action = "reject" Then
                        newStatus = "in_progress"
                        stage = "in_review_to_in_progress"
                    End If
                Case "approved"
                    If action = "publish" Then
                        newStatus = "published"
                        stage = "approved_to_published"
                    End If
            End Select

            If newStatus Is Nothing Then
                Return Json(New With {.success = False, .error = "Invalid transition from " & currentStatus & " with action " & action})
            End If

            ' Update visit status
            DbHelper.ExecuteNonQuery(
                "UPDATE Visits SET Status = @st, UpdatedAt = GETDATE() WHERE VisitId = @vid",
                {
                    New SqlParameter("@vid", visitId),
                    New SqlParameter("@st", newStatus)
                })

            ' Insert approval event
            DbHelper.ExecuteNonQuery(
                "INSERT INTO ApprovalEvents (VisitId, Stage, ActorId, Decision, Comment, Timestamp)
                 VALUES (@vid, @stg, @act, @dec, @cmt, GETDATE())",
                {
                    New SqlParameter("@vid", visitId),
                    New SqlParameter("@stg", stage),
                    New SqlParameter("@act", actorId),
                    New SqlParameter("@dec", action),
                    New SqlParameter("@cmt", If(comment, CObj(DBNull.Value)))
                })

            Return Json(New With {.success = True, .newStatus = newStatus})
        End Function

        ' ──────────────────────────────────────────────
        '  POST /Visits/SaveSignature
        ' ──────────────────────────────────────────────
        <HttpPost>
        Function SaveSignature(visitId As String, signerName As String, signerRole As String, signatureData As String) As JsonResult
            DbHelper.ExecuteNonQuery(
                "INSERT INTO Signatures (VisitId, SignerName, SignerRole, SignatureData, SignedAt)
                 VALUES (@vid, @sn, @sr, @sd, GETDATE())",
                {
                    New SqlParameter("@vid", visitId),
                    New SqlParameter("@sn", signerName),
                    New SqlParameter("@sr", If(signerRole, "")),
                    New SqlParameter("@sd", If(signatureData, ""))
                })

            Return Json(New With {.success = True})
        End Function

        ' ──────────────────────────────────────────────
        '  GET  /Visits/GetAudit?visitId=...
        ' ──────────────────────────────────────────────
        Function GetAudit(visitId As String) As JsonResult
            Dim events = DbHelper.ExecuteReader(
                "SELECT ae.*, u.Name AS ActorName FROM ApprovalEvents ae
                 INNER JOIN Users u ON ae.ActorId = u.UserId
                 WHERE ae.VisitId = @vid ORDER BY ae.Timestamp",
                Function(r) New ApprovalEvent() With {
                    .Id = r.GetInt32(r.GetOrdinal("Id")),
                    .VisitId = DbHelper.SafeStr(r, "VisitId"),
                    .Stage = DbHelper.SafeStr(r, "Stage"),
                    .ActorId = DbHelper.SafeStr(r, "ActorId"),
                    .Decision = DbHelper.SafeStr(r, "Decision"),
                    .Comment = DbHelper.SafeStr(r, "Comment"),
                    .Timestamp = r.GetDateTime(r.GetOrdinal("Timestamp")),
                    .ActorName = DbHelper.SafeStr(r, "ActorName")
                },
                {New SqlParameter("@vid", visitId)})

            Return Json(events, JsonRequestBehavior.AllowGet)
        End Function

        ' ──────────────────────────────────────────────
        '  GET  /Visits/GetAllActionItems
        ' ──────────────────────────────────────────────
        Function GetAllActionItems() As JsonResult
            Dim items = DbHelper.ExecuteReader(
                "SELECT a.*, s.SiteName FROM ActionItems a
                 INNER JOIN Visits v ON a.VisitId = v.VisitId
                 INNER JOIN Sites s ON v.SiteId = s.SiteId
                 ORDER BY CASE a.Severity
                    WHEN 'critical' THEN 1 WHEN 'high' THEN 2
                    WHEN 'medium' THEN 3 ELSE 4 END, a.DueDate",
                Function(r) MapActionItem(r))

            Return Json(items, JsonRequestBehavior.AllowGet)
        End Function

        ' ──────────────────────────────────────────────
        '  Private mapper helpers
        ' ──────────────────────────────────────────────
        Private Function MapVisit(r As SqlDataReader) As Visit
            Dim v As New Visit()
            v.VisitId = DbHelper.SafeStr(r, "VisitId")
            v.SiteId = DbHelper.SafeStr(r, "SiteId")
            v.ConsultantId = DbHelper.SafeStr(r, "ConsultantId")
            v.VisitDate = r.GetDateTime(r.GetOrdinal("VisitDate"))
            v.ReportPack = DbHelper.SafeStr(r, "ReportPack")
            v.Status = DbHelper.SafeStr(r, "Status")
            v.EntranceNotes = DbHelper.SafeStr(r, "EntranceNotes")
            v.GeneralObservations = DbHelper.SafeStr(r, "GeneralObservations")
            v.ExitNotes = DbHelper.SafeStr(r, "ExitNotes")
            v.DistributionList = DbHelper.SafeStr(r, "DistributionList")
            v.CreatedAt = r.GetDateTime(r.GetOrdinal("CreatedAt"))
            v.UpdatedAt = r.GetDateTime(r.GetOrdinal("UpdatedAt"))
            ' Joined fields
            Try : v.SiteName = DbHelper.SafeStr(r, "SiteName") : Catch : End Try
            Try : v.AccountName = DbHelper.SafeStr(r, "AccountName") : Catch : End Try
            Try : v.ConsultantName = DbHelper.SafeStr(r, "ConsultantName") : Catch : End Try
            Try : v.Address = DbHelper.SafeStr(r, "Address") : Catch : End Try
            Try : v.ServiceLines = DbHelper.SafeStr(r, "ServiceLines") : Catch : End Try
            Try : v.Contacts = DbHelper.SafeStr(r, "Contacts") : Catch : End Try
            Return v
        End Function

        Private Function MapWfObs(r As SqlDataReader) As WfObservation
            Return New WfObservation() With {
                .Id = r.GetInt32(r.GetOrdinal("Id")),
                .VisitId = DbHelper.SafeStr(r, "VisitId"),
                .Section = DbHelper.SafeStr(r, "Section"),
                .FieldCode = DbHelper.SafeStr(r, "FieldCode"),
                .FieldLabel = DbHelper.SafeStr(r, "FieldLabel"),
                .Value = DbHelper.SafeStr(r, "Value"),
                .Unit = DbHelper.SafeStr(r, "Unit"),
                .ThresholdLow = DbHelper.SafeDec(r, "ThresholdLow"),
                .ThresholdHigh = DbHelper.SafeDec(r, "ThresholdHigh"),
                .Flag = DbHelper.SafeStr(r, "Flag"),
                .Notes = DbHelper.SafeStr(r, "Notes")
            }
        End Function

        Private Function MapWwObs(r As SqlDataReader) As WwObservation
            Return New WwObservation() With {
                .Id = r.GetInt32(r.GetOrdinal("Id")),
                .VisitId = DbHelper.SafeStr(r, "VisitId"),
                .Section = DbHelper.SafeStr(r, "Section"),
                .FieldCode = DbHelper.SafeStr(r, "FieldCode"),
                .FieldLabel = DbHelper.SafeStr(r, "FieldLabel"),
                .Value = DbHelper.SafeStr(r, "Value"),
                .Unit = DbHelper.SafeStr(r, "Unit"),
                .ThresholdLow = DbHelper.SafeDec(r, "ThresholdLow"),
                .ThresholdHigh = DbHelper.SafeDec(r, "ThresholdHigh"),
                .Status = DbHelper.SafeStr(r, "Status"),
                .Notes = DbHelper.SafeStr(r, "Notes")
            }
        End Function

        Private Function MapActionItem(r As SqlDataReader) As ActionItem
            Dim ai As New ActionItem()
            ai.ActionItemId = DbHelper.SafeStr(r, "ActionItemId")
            ai.VisitId = DbHelper.SafeStr(r, "VisitId")
            ai.SectionRef = DbHelper.SafeStr(r, "SectionRef")
            ai.Description = DbHelper.SafeStr(r, "Description")
            ai.Severity = DbHelper.SafeStr(r, "Severity")
            ai.Owner = DbHelper.SafeStr(r, "Owner")
            ai.DueDate = DbHelper.SafeDate(r, "DueDate")
            ai.Status = DbHelper.SafeStr(r, "Status")
            ai.Comments = DbHelper.SafeStr(r, "Comments")
            ai.CreatedAt = r.GetDateTime(r.GetOrdinal("CreatedAt"))
            Try : ai.SiteName = DbHelper.SafeStr(r, "SiteName") : Catch : End Try
            Return ai
        End Function

    End Class
End Namespace
