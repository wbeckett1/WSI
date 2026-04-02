Namespace WSIFieldService.Models
    Public Class ApprovalEvent
        Public Property Id As Integer
        Public Property VisitId As String
        Public Property Stage As String
        Public Property ActorId As String
        Public Property Decision As String
        Public Property Comment As String
        Public Property Timestamp As DateTime

        ' Joined field
        Public Property ActorName As String
    End Class
End Namespace
