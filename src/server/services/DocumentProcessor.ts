import fs from 'fs'
import path from 'path'

interface ProcessedDocument {
  fileName: string;
  type: 'json' | 'text';
  content: any;
}

interface HuntingVacante {
    id_vacante: string;
    cliente: string;
    estado_vacante: string;
    postulantes?: Array<any>;
}

export class DocumentProcessor {
  // Método principal que espera index.ts
  static async loadContext({ docsDir, contextPath = '' }: { docsDir?: string, contextPath?: string }) {
    console.log('\n📚 Iniciando carga de contexto...')
    
    try {
      // Simplemente devolvemos lo que recibimos en el formato esperado
      const jsonContexts: Record<string, string> = {}
      
      // Si hay archivos en el directorio, los procesamos
      if (docsDir && fs.existsSync(docsDir)) {
        const files = fs.readdirSync(docsDir)
        for (const file of files) {
          const content = fs.readFileSync(path.join(docsDir, file), 'utf-8')
          jsonContexts[file] = content
        }
      }

      return JSON.stringify(jsonContexts)

    } catch (error) {
      console.error('❌ Error procesando documentos:', error)
      return '{}'
    }
  }

  // Método para procesar documentos individuales
  static async processDocument(file: { name: string; content: string }): Promise<ProcessedDocument> {
    console.log(`\n📄 Procesando: ${file.name}`)
    
    // Simplemente devolvemos el documento en el formato esperado
    return {
      fileName: file.name,
      type: file.name.endsWith('.json') ? 'json' : 'text',
      content: file.content
    }
  }

  // Método para procesar archivos Excel
  static async processExcelFile(filePath: string): Promise<Record<string, string>> {
    console.log(`\n📊 Procesando Excel: ${filePath}`)
    
    // Devolvemos un objeto vacío o el contenido como está
    return {}
  }

  static async saveAuditLog(globalJsons: Record<string, string>) {
    try {
      console.log('\n📝 Guardando log de auditoría...')
      const logPath = path.join(process.cwd(), 'audit_log.txt')
      const timestamp = new Date().toISOString()
      
      let logContent = `\n=== Log de Auditoría ${timestamp} ===\n\n`
      
      Object.entries(globalJsons).forEach(([key, value]) => {
        try {
          const parsed = JSON.parse(value)
          logContent += `\n📑 Archivo: ${key}\n`
          
          // Para archivos Excel y Hunting
          if (typeof parsed === 'object') {
            if (parsed.type === 'hunting') {
                logContent += `📊 Tipo: Hunting\n`
                logContent += `📊 Total vacantes: ${parsed.content.length}\n`
                
                // Mostrar JSON raw
                logContent += `\n📋 JSON RAW:\n`
                logContent += `${JSON.stringify(parsed, null, 2)}\n\n`
                
            /*     // Formato legible
                logContent += `📋 FORMATO LEGIBLE:\n`
                parsed.content.forEach((vacante: HuntingVacante) => {
                    logContent += `   - Vacante ${vacante.id_vacante}:\n`
                    logContent += `     Cliente: ${vacante.cliente}\n`
                    logContent += `     Estado: ${vacante.estado_vacante}\n`
                    logContent += `     Postulantes: ${vacante.postulantes?.length || 0}\n`
                }) */
            } else if (!parsed.type) {
                // Código existente para Excel normal
                logContent += `📊 Tipo: excel\n`
                const hojas = Object.keys(parsed)
                logContent += `📊 Hojas encontradas: ${hojas.length}\n`
                
                // Primero mostramos el JSON raw
                logContent += `\n📋 JSON RAW:\n`
                logContent += `${JSON.stringify(parsed, null, 2)}\n\n`
                
                // Luego mostramos el formato legible
                logContent += `📋 FORMATO LEGIBLE:\n`
                hojas.forEach(nombreHoja => {
                  const filas = parsed[nombreHoja]
                  logContent += `   - ${nombreHoja}: ${filas.length} filas\n`
                  
                  // Mostrar muestra de la primera fila si existe
                  if (filas.length > 0) {
                    logContent += `     Muestra de datos:\n`
                    Object.entries(filas[0]).forEach(([campo, valor]) => {
                      logContent += `     ${campo}: ${valor}\n`
                    })
                    logContent += `     ...\n`
                  }
                })
            }
          } else if (typeof parsed === 'string') {
            // Para archivos de texto
            logContent += `📝 Tipo: texto\n`
            logContent += `📄 Primeros 150 caracteres: ${parsed.substring(0, 150)}...\n`
          }
          
          logContent += `\n----------------------------\n`
          
        } catch (error) {
          logContent += `❌ Error al procesar ${key}: ${error}\n`
        }
      })
      
      fs.appendFileSync(logPath, logContent)
      console.log(`✅ Log de auditoría guardado en: ${logPath}`)
      
    } catch (error) {
      console.error('❌ Error guardando log de auditoría:', error)
    }
  }
}