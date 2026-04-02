Namespace WSILandedCost.Models
    Public Class Decision
        Public Property Id As Integer
        Public Property OrderId As String
        Public Property SelectedOptionRank As Integer
        Public Property Approver As String
        Public Property ApproverRole As String
        Public Property ApprovalTimestamp As DateTime
        Public Property ThresholdClass As String
        Public Property ReasonCode As String
        Public Property OverrideFlag As Boolean
        Public Property OverrideComment As String
        Public Property AssumptionsVersion As String
        ' Joined fields
        Public Property Customer As String
        Public Property ShipTo As String
        Public Property SourceName As String
        Public Property LandedCost As Decimal
    End Class
End Namespace
