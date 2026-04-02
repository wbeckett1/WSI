Namespace WSILandedCost.Models
    Public Class OrderLine
        Public Property Id As Integer
        Public Property OrderId As String
        Public Property Sku As String
        Public Property Description As String
        Public Property Quantity As Decimal
        Public Property Uom As String
        Public Property PackType As String
        Public Property Hazmat As Boolean
    End Class
End Namespace
