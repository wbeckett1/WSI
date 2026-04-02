Namespace WSIFieldService.Models
    Public Class Visit
        Public Property VisitId As String
        Public Property SiteId As String
        Public Property ConsultantId As String
        Public Property VisitDate As DateTime
        Public Property ReportPack As String
        Public Property Status As String
        Public Property EntranceNotes As String
        Public Property GeneralObservations As String
        Public Property ExitNotes As String
        Public Property DistributionList As String
        Public Property CreatedAt As DateTime
        Public Property UpdatedAt As DateTime

        ' Joined fields
        Public Property SiteName As String
        Public Property AccountName As String
        Public Property ConsultantName As String
        Public Property Address As String
        Public Property ServiceLines As String
        Public Property Contacts As String
    End Class
End Namespace
