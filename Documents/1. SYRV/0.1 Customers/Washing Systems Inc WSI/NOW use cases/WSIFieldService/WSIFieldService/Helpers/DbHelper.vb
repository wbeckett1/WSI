Imports System.Data.SqlClient
Imports System.Configuration

Namespace WSIFieldService.Helpers
    Public Class DbHelper

        Private Shared ReadOnly Property ConnectionString As String
            Get
                Return ConfigurationManager.ConnectionStrings("WSIFieldServiceDb").ConnectionString
            End Get
        End Property

        ''' <summary>
        ''' Executes a query and returns a list of results via a mapping function.
        ''' </summary>
        Public Shared Function ExecuteReader(Of T)(sql As String, mapper As Func(Of SqlDataReader, T), Optional params As SqlParameter() = Nothing) As List(Of T)
            Dim results As New List(Of T)()
            Using conn As New SqlConnection(ConnectionString)
                Using cmd As New SqlCommand(sql, conn)
                    If params IsNot Nothing Then
                        cmd.Parameters.AddRange(params)
                    End If
                    conn.Open()
                    Using reader As SqlDataReader = cmd.ExecuteReader()
                        While reader.Read()
                            results.Add(mapper(reader))
                        End While
                    End Using
                End Using
            End Using
            Return results
        End Function

        ''' <summary>
        ''' Executes a non-query command (INSERT, UPDATE, DELETE) and returns rows affected.
        ''' </summary>
        Public Shared Function ExecuteNonQuery(sql As String, Optional params As SqlParameter() = Nothing) As Integer
            Using conn As New SqlConnection(ConnectionString)
                Using cmd As New SqlCommand(sql, conn)
                    If params IsNot Nothing Then
                        cmd.Parameters.AddRange(params)
                    End If
                    conn.Open()
                    Return cmd.ExecuteNonQuery()
                End Using
            End Using
        End Function

        ''' <summary>
        ''' Executes a scalar query and returns the first column of the first row.
        ''' </summary>
        Public Shared Function ExecuteScalar(sql As String, Optional params As SqlParameter() = Nothing) As Object
            Using conn As New SqlConnection(ConnectionString)
                Using cmd As New SqlCommand(sql, conn)
                    If params IsNot Nothing Then
                        cmd.Parameters.AddRange(params)
                    End If
                    conn.Open()
                    Return cmd.ExecuteScalar()
                End Using
            End Using
        End Function

        ''' <summary>
        ''' Safe string reader helper - returns empty string if DBNull.
        ''' </summary>
        Public Shared Function SafeStr(reader As SqlDataReader, column As String) As String
            Dim ordinal As Integer = reader.GetOrdinal(column)
            If reader.IsDBNull(ordinal) Then Return ""
            Return reader.GetString(ordinal)
        End Function

        ''' <summary>
        ''' Safe nullable decimal reader helper.
        ''' </summary>
        Public Shared Function SafeDec(reader As SqlDataReader, column As String) As Decimal?
            Dim ordinal As Integer = reader.GetOrdinal(column)
            If reader.IsDBNull(ordinal) Then Return Nothing
            Return reader.GetDecimal(ordinal)
        End Function

        ''' <summary>
        ''' Safe integer reader helper.
        ''' </summary>
        Public Shared Function SafeInt(reader As SqlDataReader, column As String) As Integer
            Dim ordinal As Integer = reader.GetOrdinal(column)
            If reader.IsDBNull(ordinal) Then Return 0
            Return reader.GetInt32(ordinal)
        End Function

        ''' <summary>
        ''' Safe nullable date reader helper.
        ''' </summary>
        Public Shared Function SafeDate(reader As SqlDataReader, column As String) As DateTime?
            Dim ordinal As Integer = reader.GetOrdinal(column)
            If reader.IsDBNull(ordinal) Then Return Nothing
            Return reader.GetDateTime(ordinal)
        End Function

    End Class
End Namespace
