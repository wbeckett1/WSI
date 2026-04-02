Namespace WSILandedCost.Models
    Public Class SavingsLedger
        Public Property Id As Integer
        Public Property OrderId As String
        Public Property BaselineCost As Decimal
        Public Property SelectedCost As Decimal
        Public Property TheoreticalSavings As Decimal
        Public Property RealizedSavings As Decimal
        Public Property FinanceStatus As String
        Public Property Period As String
        ' Joined fields
        Public Property Customer As String
        Public Property ShipTo As String
    End Class
End Namespace
