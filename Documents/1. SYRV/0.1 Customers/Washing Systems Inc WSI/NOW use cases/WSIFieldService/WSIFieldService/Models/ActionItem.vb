Namespace WSIFieldService.Models
    Public Class ActionItem
        Public Property ActionItemId As String
        Public Property VisitId As String
        Public Property SectionRef As String
        Public Property Description As String
        Public Property Severity As String
        Public Property Owner As String
        Public Property DueDate As DateTime?
        Public Property Status As String
        Public Property Comments As String
        Public Property CreatedAt As DateTime

        ' Joined fields
        Public Property SiteName As String
    End Class
End Namespace
