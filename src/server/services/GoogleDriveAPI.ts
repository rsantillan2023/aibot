import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'

export class GoogleDriveAPI {
  private static oauth2Client: OAuth2Client

  static initialize() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )
  }

  static async getDocumentContent(url: string): Promise<string> {
    try {
      // Extraer ID del documento de la URL
      const fileId = this.extractFileId(url)
      
      const drive = google.drive({ 
        version: 'v3', 
        auth: this.oauth2Client 
      })

      // Obtener metadata del archivo
      const file = await drive.files.get({
        fileId,
        fields: 'mimeType'
      })

      // Descargar contenido según el tipo de archivo
      const response = await drive.files.export({
        fileId,
        mimeType: 'text/plain'
      })

      return response.data as string
    } catch (error) {
      console.error('Error al obtener documento de Drive:', error)
      throw error
    }
  }

  private static extractFileId(url: string): string {
    const match = url.match(/[-\w]{25,}/)
    if (!match) {
      throw new Error('URL de Google Drive inválida')
    }
    return match[0]
  }
} 