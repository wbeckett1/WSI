Namespace WSILandedCost.Models
    Public Class Order
        Public Property Id As String
        Public Property Customer As String
        Public Property ShipTo As String
        Public Property RequestedShipDate As DateTime
        Public Property OrderDate As DateTime
        Public Property BaselineSource As String
        Public Property Incoterm As String
        Public Property Status As String
        Public Property CreatedAt As DateTime
        ' Computed fields for list display
        Public Property TotalQty As Decimal
        Public Property LineSummary As String
        Public Property LineCount As Integer
    End Class
End Namespace
