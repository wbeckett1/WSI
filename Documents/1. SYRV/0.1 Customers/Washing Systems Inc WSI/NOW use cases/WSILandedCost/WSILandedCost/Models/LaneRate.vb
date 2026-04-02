Namespace WSILandedCost.Models
    Public Class LaneRate
        Public Property Id As Integer
        Public Property Origin As String
        Public Property DestinationZone As String
        Public Property Carrier As String
        Public Property Mode As String
        Public Property BaseRate As Decimal
        Public Property Accessorial As Decimal
        Public Property EffectiveDate As DateTime
        Public Property ExpiryDate As DateTime
    End Class
End Namespace
