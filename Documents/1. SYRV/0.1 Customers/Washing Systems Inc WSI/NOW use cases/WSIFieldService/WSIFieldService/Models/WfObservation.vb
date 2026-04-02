Namespace WSIFieldService.Models
    Public Class WfObservation
        Public Property Id As Integer
        Public Property VisitId As String
        Public Property Section As String
        Public Property FieldCode As String
        Public Property FieldLabel As String
        Public Property Value As String
        Public Property Unit As String
        Public Property ThresholdLow As Decimal?
        Public Property ThresholdHigh As Decimal?
        Public Property Flag As String
        Public Property Notes As String
    End Class
End Namespace
