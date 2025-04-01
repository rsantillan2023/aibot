import { google } from 'googleapis'
import fs from 'fs'
import path from 'path'
import * as XLSX from 'xlsx'

interface SheetRow {
  [key: string]: any;
}

interface ProcessedSheet {
  nombreHoja: string;
  filas: SheetRow[];
}

interface ProcessedData {
  hojas: ProcessedSheet[];
}

// Interfaces para el Excel de Hunting
interface ExcelVacante {
  id_vacante: string;
  'Alta de Vacante': string;
  Reclutador: string;
  'Cliente que solicito la vacante': string;
  'Perfil o Puesto buscado': string;
  'Tipo de Vacante': string;
  'Estado de Vacante': string;
  'Log de Interaccion con el cliente': string;
  'Cantidad de Postulantes presentados': string;
  'Cantidad de Postulantes entrevistados': string;
  'Cantidad de Postulantes rechazados': string;
  'Fecha Presentación': string;
  'Fecha de Cierre': string;
  'Fecha respuesta cliente': string;
  'T° primer Presentado': string;
  'T° Cierre': string;
  'Tipo de  Respuesta del cliente': string;
  'Motivo Anulación de vacante': string;
}

interface ExcelPostulante {
  'Fecha Alta  Vacante': string;
  Reclutador: string;
  id_vacante: string;
  'Cliente que solicito la vacante': string;
  'Perfil o Puesto buscado': string;
  'Fecha Presentación': string;
  Postulante: string;
  'Estado Postulacion': string;
  'Estado Contratacion en cliente': string;
  'Comentarios proceso de selección': string;
  'Fecha Entrevista Cliente': string;
  'Fecha Feedback': string;
  'Fecha Cierre': string;
  'Fecha Anulada': string;
  'Tiempo Presentación': string;
  'Tiempo de Cierre': string;
  'Tiempo de Anulada': string;
}

interface ExcelIngresante {
  Mes: string;
  Año: string;
  'ID vacante': string;
  'Tipo de Vacante': string;
  Negocio: string;
  Cliente: string;
  'Perfil o Puesto': string;
  Apellido: string;
  Nombre: string;
  Cel: string;
  CUIL: string;
  'Fecha Nacimiento': string;
  'Correo Electrónico': string;
  'Correo Sooft': string;
  'Fecha Ingreso': string;
  Preocupa: string;
  Firmó: string;
  Reclutador: string;
  'Sueldo Bruto': string;
  Enero: string;
  Febrero: string;
  Marzo: string;
  Abril: string;
  Mayo: string;
  Junio: string;
  Julio: string;
  Agosto: string;
  Septiembre: string;
  Octubre: string;
  Noviembre: string;
  Diciembre: string;
}

export class GoogleDriveService {
  private static drive = google.drive('v3')
  private static SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/spreadsheets.readonly'
  ]

static async authenticate() {
  try {
    let credentials

    if (process.env.GOOGLE_SERVICE_ACCOUNT) {
      // ✅ PRODUCCIÓN - desde variable codificada en base64
      credentials = JSON.parse(
        Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT, 'base64').toString('utf-8')
      )
      console.log('🔐 Autenticando con GOOGLE_SERVICE_ACCOUNT desde variable codificada')
    } else {
      // 🧪 DESARROLLO - usar archivo local
      console.log('🔐 Autenticando con archivo credentials.json')
      credentials = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), 'credentials.json'), 'utf-8')
      )
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: this.SCOPES
    })

    const client = await auth.getClient()
    google.options({ auth: client as any })
    console.log('✅ Autenticación con Google Drive completada')
    return client

  } catch (error) {
    console.error('❌ Error en la autenticación de Google Drive:', error)
    throw error
  }
}

  
  static async downloadFile(fileId: string, mimeType: string, fileName: string): Promise<string> {
    try {
      console.log(`   🔄 Obteniendo archivo de Google Drive: ${fileId} (${mimeType})`)

      // Para archivos Excel
      if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
        try {
          const response = await this.drive.files.get({
            fileId: fileId,
            alt: 'media'
          }, {
            responseType: 'arraybuffer'
          })

          const workbook = XLSX.read(response.data, { type: 'buffer' })
          
          // Tratamiento especial para Hunting.xlsx
          if (fileName.includes('Hunting')) {
            console.log('   📊 Procesando archivo Hunting.xlsx...')
            
            // 1. Leer las tres hojas
            const vacantes = XLSX.utils.sheet_to_json<ExcelVacante>(workbook.Sheets['vacantes'], { raw: false, defval: '' })
            const postulantes = XLSX.utils.sheet_to_json<ExcelPostulante>(workbook.Sheets['postulantes'], { raw: false, defval: '' })
            const ingresantes = XLSX.utils.sheet_to_json<ExcelIngresante>(workbook.Sheets['ingresantes'], { raw: false, defval: '' })

            // 2. Procesar cada vacante
            const vacantesProcessed = vacantes.map((vacante: any) => {
              // Encontrar todos los postulantes para esta vacante
              const postulantesVacante = postulantes
                .filter((p: any) => p.id_vacante === vacante.id_vacante)
                .map((postulante: any) => {
                  // Buscar si el postulante está en ingresantes
                  const datosIngreso = ingresantes.find((i: any) => 
                    (i.Apellido + ' ' + i.Nombre).toLowerCase() === postulante.Postulante.toLowerCase() ||
                    (i.Nombre + ' ' + i.Apellido).toLowerCase() === postulante.Postulante.toLowerCase()
                  )

                  // Crear objeto postulante
                  const postulanteObj: any = {
                    postulante: postulante.Postulante || '',
                    estado_postulacion: postulante['Estado Postulacion'] || '',
                    estado_contratacion: postulante['Estado Contratacion en cliente'] || '',
                    comentarios_proceso: postulante['Comentarios proceso de selección'] || '',
                    fecha_entrevista_cliente: postulante['Fecha Entrevista Cliente'] || '',
                    fecha_feedback: postulante['Fecha Feedback'] || '',
                    fecha_cierre: postulante['Fecha Cierre'] || '',
                    fecha_anulada: postulante['Fecha Anulada'] || '',
                    tiempo_presentacion: postulante['Tiempo Presentación'] || '',
                    tiempo_cierre: postulante['Tiempo de Cierre'] || '',
                    tiempo_anulada: postulante['Tiempo de Anulada'] || ''
                  }

                  // Si hay datos de ingreso, agregarlos
                  if (datosIngreso) {
                    postulanteObj.datos_ingreso = {
                      negocio: datosIngreso.Negocio || '',
                      fecha_nacimiento: datosIngreso['Fecha Nacimiento'] || '',
                      correo_electronico: datosIngreso['Correo Electrónico'] || '',
                      correo_sooft: datosIngreso['Correo Sooft'] || '',
                      fecha_ingreso: datosIngreso['Fecha Ingreso'] || '',
                      preocupa: datosIngreso.Preocupa || '',
                      firmo: datosIngreso.Firmó || '',
                      reclutador: datosIngreso.Reclutador || '',
                      sueldo_bruto: datosIngreso['Sueldo Bruto'] || ''
                    }
                  }

                  return postulanteObj
                })

              // Crear objeto vacante con sus postulantes
              return {
                id_vacante: vacante.id_vacante || '',
                alta_vacante: vacante['Alta de Vacante'] || '',
                reclutador: vacante.Reclutador || '',
                cliente: vacante['Cliente que solicito la vacante'] || '',
                perfil_puesto: vacante['Perfil o Puesto buscado'] || '',
                tipo_vacante: vacante['Tipo de Vacante'] || '',
                estado_vacante: vacante['Estado de Vacante'] || '',
                log_interaccion: vacante['Log de Interaccion con el cliente'] || '',
                postulantes_presentados: vacante['Cantidad de Postulantes presentados'] || '',
                postulantes_entrevistados: vacante['Cantidad de Postulantes entrevistados'] || '',
                postulantes_rechazados: vacante['Cantidad de Postulantes rechazados'] || '',
                fecha_presentacion: vacante['Fecha Presentación'] || '',
                fecha_cierre: vacante['Fecha de Cierre'] || '',
                fecha_respuesta_cliente: vacante['Fecha respuesta cliente'] || '',
                tiempo_primer_presentado: vacante['T° primer Presentado'] || '',
                tiempo_cierre: vacante['T° Cierre'] || '',
                tipo_respuesta_cliente: vacante['Tipo de  Respuesta del cliente'] || '',
                motivo_anulacion: vacante['Motivo Anulación de vacante'] || '',
                postulantes: postulantesVacante
              }
            })

            console.log('\n📋 JSON generado para Hunting.xlsx:')
            //console.log(JSON.stringify(vacantesProcessed, null, 2))

            return JSON.stringify({
              type: 'hunting',
              content: vacantesProcessed
            })
          }

          // Para otros archivos Excel, continuar con el procesamiento normal...
          // Debug: ver qué hojas tenemos
          console.log('\n📊 Hojas encontradas:', workbook.SheetNames)
          
          // Convertir directamente a JSON plano
          const jsonData: Record<string, any[]> = {}
          
          workbook.SheetNames.forEach(sheetName => {
            console.log(`\n📑 Procesando hoja: ${sheetName}`)
            const sheet = workbook.Sheets[sheetName]
            
            // Debug: ver contenido de la hoja
           // console.log('📄 Contenido de la hoja:', sheet)
            
            const data = XLSX.utils.sheet_to_json(sheet, {
              raw: false,  // Convertir valores a strings
              defval: ''   // Valor por defecto para celdas vacías
            })
            
            console.log(`✅ Filas procesadas: ${data.length}`)
            jsonData[sheetName] = data
          })

          // Debug: ver JSON final
         // console.log('\n🔍 JSON generado:', JSON.stringify(jsonData, null, 2))

          return JSON.stringify(jsonData)

        } catch (error) {
          console.error('   ❌ Error al procesar Excel:', error)
          console.error('   📝 Detalles del error:', error)
          return JSON.stringify({})
        }
      }

      // Google Docs
      if (mimeType === 'application/vnd.google-apps.document') {
        const docs = google.docs({ version: 'v1' })
        const response = await docs.documents.get({ documentId: fileId })
        return this.processGoogleDoc(response.data)
      }

      // Google Sheets
      if (mimeType === 'application/vnd.google-apps.spreadsheet') {
        const sheets = google.sheets({ version: 'v4' })
        const response = await sheets.spreadsheets.get({
          spreadsheetId: fileId,
          includeGridData: true
        })
        return this.processGoogleSheet(response.data)
      }

      // Para otros tipos de archivos
      const response = await this.drive.files.get({
        fileId: fileId,
        alt: 'media'
      })
      return typeof response.data === 'string' ? response.data : JSON.stringify(response.data)

    } catch (error) {
      console.error(`❌ Error al descargar archivo ${fileId}:`, error)
      return ''
    }
  }

  private static processGoogleDoc(doc: any): string {
    let text = ''
    if (doc.body?.content) {
      for (const element of doc.body.content) {
        if (element.paragraph) {
          const paragraphText = element.paragraph.elements
            ?.map((e: any) => e.textRun?.content || '')
            .join('')
          if (paragraphText) {
            text += paragraphText + '\n'
          }
        }
      }
    }
    return text
  }

  private static processGoogleSheet(sheet: any): string {
    let text = ''
    if (sheet.sheets) {
      for (const s of sheet.sheets) {
        if (s.properties?.title) {
          text += `\n=== ${s.properties.title} ===\n`
        }
        if (s.data?.[0]?.rowData) {
          for (const row of s.data[0].rowData) {
            if (row.values) {
              const rowText = row.values
                .map((cell: any) => cell.formattedValue || '')
                .filter((value: string) => value !== '')
                .join('\t')
              if (rowText) {
                text += rowText + '\n'
              }
            }
          }
        }
      }
    }
    return text
  }

  static async listFiles(folderId: string) {
    try {
      console.log('   📂 Listando archivos del folder:', folderId)
      const response = await this.drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType)',
      })
      console.log(`   ✅ Encontrados ${response.data.files?.length || 0} archivos`)
      return response.data.files || []
    } catch (error) {
      console.error('❌ Error al listar archivos:', error)
      throw error
    }
  }

  static async downloadFolder(folderId: string): Promise<Array<{name: string, content: string}>> {
    console.log('\n📂 Descargando archivos de Google Drive...')
    const files = await this.listFiles(folderId)
    const downloads = []

    for (const file of files) {
      if (!file.id || !file.name || !file.mimeType) continue
      
      console.log(`\n   📄 Leyendo archivo de google drive: ${file.name} (${file.mimeType})`)
      try {
        const content = await this.downloadFile(file.id, file.mimeType, file.name)
        if (content) {
          downloads.push({ 
            name: file.name, 
            content: content.trim() 
          })
          console.log(`   ✅ ${file.name} obtenido exitosamente del google drive`)
          
        }
      } catch (error) {
        console.error(`   ❌ Error al procesar ${file.name}:`, error)
      }
    }

    return downloads
  }
} 
