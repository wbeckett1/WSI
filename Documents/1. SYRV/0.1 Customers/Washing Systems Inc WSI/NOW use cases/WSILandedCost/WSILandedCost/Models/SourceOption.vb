Namespace WSILandedCost.Models
    Public Class SourceOption
        Public Property Id As Integer
        Public Property SourceId As String
        Public Property SourceName As String
        Public Property Region As String
        Public Property ProductionCost As Decimal
        Public Property BlendingCost As Decimal
        Public Property PackagingCost As Decimal
        Public Property CapacityAvailable As Decimal
        Public Property LeadTimeDays As Integer
        Public Property FreshnessDate As DateTime
        Public Property FreshnessStatus As String
    End Class
End Namespace
