Imports System.Configuration
Imports System.Data.SqlClient

Namespace WSILandedCost.Helpers
    Public Class DbHelper

        Private Shared ReadOnly _connectionString As String =
            ConfigurationManager.ConnectionStrings("WSILandedCostDb").ConnectionString

        ''' <summary>
        ''' Executes a query and returns a list of results via a reader function.
        ''' </summary>
        Public Shared Function ExecuteReader(Of T)(sql As String, readerFunc As Func(Of SqlDataReader, T), Optional params As SqlParameter() = Nothing) As List(Of T)
            Dim results As New List(Of T)()
            Using conn As New SqlConnection(_connectionString)
                Using cmd As New SqlCommand(sql, conn)
                    If params IsNot Nothing Then
                        cmd.Parameters.AddRange(params)
                    End If
                    conn.Open()
                    Using rdr As SqlDataReader = cmd.ExecuteReader()
                        While rdr.Read()
                            results.Add(readerFunc(rdr))
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
            Using conn As New SqlConnection(_connectionString)
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
            Using conn As New SqlConnection(_connectionString)
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
        ''' Safe helper to read a nullable string column.
        ''' </summary>
        Public Shared Function SafeString(rdr As SqlDataReader, column As String) As String
            Dim ordinal As Integer = rdr.GetOrdinal(column)
            If rdr.IsDBNull(ordinal) Then Return Nothing
            Return rdr.GetString(ordinal)
        End Function

        ''' <summary>
        ''' Safe helper to read a nullable integer column.
        ''' </summary>
        Public Shared Function SafeInt(rdr As SqlDataReader, column As String) As Integer
            Dim ordinal As Integer = rdr.GetOrdinal(column)
            If rdr.IsDBNull(ordinal) Then Return 0
            Return rdr.GetInt32(ordinal)
        End Function

        ''' <summary>
        ''' Safe helper to read a nullable decimal column.
        ''' </summary>
        Public Shared Function SafeDecimal(rdr As SqlDataReader, column As String) As Decimal
            Dim ordinal As Integer = rdr.GetOrdinal(column)
            If rdr.IsDBNull(ordinal) Then Return 0D
            Return rdr.GetDecimal(ordinal)
        End Function

        ''' <summary>
        ''' Safe helper to read a nullable DateTime column.
        ''' </summary>
        Public Shared Function SafeDate(rdr As SqlDataReader, column As String) As DateTime?
            Dim ordinal As Integer = rdr.GetOrdinal(column)
            If rdr.IsDBNull(ordinal) Then Return Nothing
            Return rdr.GetDateTime(ordinal)
        End Function

        ''' <summary>
        ''' Safe helper to read a nullable bit/boolean column.
        ''' </summary>
        Public Shared Function SafeBool(rdr As SqlDataReader, column As String) As Boolean
            Dim ordinal As Integer = rdr.GetOrdinal(column)
            If rdr.IsDBNull(ordinal) Then Return False
            Return rdr.GetBoolean(ordinal)
        End Function

    End Class
End Namespace
