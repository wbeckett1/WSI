Namespace WSIFieldService.Models
    Public Class DashboardViewModel
        Public Property TotalVisits As Integer
        Public Property PlannedCount As Integer
        Public Property InProgressCount As Integer
        Public Property DraftCompleteCount As Integer
        Public Property InReviewCount As Integer
        Public Property ApprovedCount As Integer
        Public Property PublishedCount As Integer
        Public Property OpenActions As Integer
        Public Property CriticalActions As Integer
        Public Property RecentVisits As List(Of Visit)
        Public Property PriorityActions As List(Of ActionItem)
    End Class
End Namespace
