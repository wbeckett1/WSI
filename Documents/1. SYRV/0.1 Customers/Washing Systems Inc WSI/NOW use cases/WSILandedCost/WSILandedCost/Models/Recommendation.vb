Namespace WSILandedCost.Models
    Public Class Recommendation
        Public Property Id As Integer
        Public Property OrderId As String
        Public Property OptionRank As Integer
        Public Property SourceId As String
        Public Property SourceName As String
        Public Property LaneDescription As String
        Public Property Mode As String
        Public Property ShipPromiseDate As DateTime?
        Public Property ProductCost As Decimal
        Public Property BlendingCost As Decimal
        Public Property PackagingCost As Decimal
        Public Property InboundCost As Decimal
        Public Property OutboundFreight As Decimal
        Public Property Accessorials As Decimal
        Public Property Duties As Decimal
        Public Property FxImpact As Decimal
        Public Property ExpeditePremium As Decimal
        Public Property Rebates As Decimal
        Public Property LandedCost As Decimal
        Public Property DeltaVsBaseline As Decimal
        Public Property DeltaPct As Decimal
        Public Property RiskFlag As String
        Public Property ReasonCodes As String
        Public Property Rationale As String
        Public Property IsBaseline As Boolean
        Public Property AssumptionsVersion As String
        Public Property CreatedAt As DateTime
    End Class
End Namespace
