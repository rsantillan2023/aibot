import express, { Request, Response } from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import OpenAI from 'openai'
import { DocumentProcessor } from './services/DocumentProcessor'
import multer from 'multer'
import dotenv from 'dotenv'
import { GoogleDriveService } from './services/GoogleDriveService'
import pdfParse from 'pdf-parse'
import { AssistantService } from './services/AssistantService'

// Cargar variables de entorno
dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

// Configuración de multer para el manejo de archivos
const PORT = process.env.PORT || 3000; 


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = './uploads'
        if (!fs.existsSync(uploadDir)){
            fs.mkdirSync(uploadDir)
        }
        cb(null, uploadDir)
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname)
    }
})

const upload = multer({ storage: storage })

// Interfaces
interface ChatRequest {
    message: string
}

interface AIResponse {
    source: string
    response: string
}

interface GroupedResponses {
    [key: string]: string[]
}

interface SearchResult {
    fileName: string
    nombreHoja: string
    totalEncontrados: number
    filas: any[]
    response?: string
    _originalHoja?: string
    _chunkInfo?: string
}

// Interfaces para el tipo de datos de Hunting
interface HuntingPostulante {
    postulante: string;
    estado_postulacion: string;
    estado_contratacion: string;
    comentarios_proceso: string;
    fecha_entrevista_cliente: string;
    fecha_feedback: string;
    fecha_cierre: string;
    fecha_anulada: string;
    tiempo_presentacion: string;
    tiempo_cierre: string;
    tiempo_anulada: string;
    datos_ingreso?: {
        negocio: string;
        fecha_nacimiento: string;
        correo_electronico: string;
        correo_sooft: string;
        fecha_ingreso: string;
        preocupa: string;
        firmo: string;
        reclutador: string;
        sueldo_bruto: string;
    };
}

interface HuntingVacante {
    id_vacante: string;
    alta_vacante: string;
    reclutador: string;
    cliente: string;
    perfil_puesto: string;
    tipo_vacante: string;
    estado_vacante: string;
    log_interaccion: string;
    postulantes_presentados: string;
    postulantes_entrevistados: string;
    postulantes_rechazados: string;
    fecha_presentacion: string;
    fecha_cierre: string;
    fecha_respuesta_cliente: string;
    tiempo_primer_presentado: string;
    tiempo_cierre: string;
    tipo_respuesta_cliente: string;
    motivo_anulacion: string;
    postulantes: HuntingPostulante[];
}

// Variables globales
let globalJsons: Record<string, string> = {}

// Configuración de OpenAI (versión actualizada)
const openai = new OpenAI()

// Cargar el archivo de contexto
const contextFile = process.env.CONTEXT_FILE || './docs/context.txt'
let contextFileContent = ''
try {
    contextFileContent = fs.readFileSync(contextFile, 'utf-8')
    console.log('✅ Archivo de contexto cargado')
} catch (error) {
    console.error('❌ Error cargando archivo de contexto:', error)
    contextFileContent = 'No se pudo cargar el archivo de contexto.'
}

// Cargar el contexto al iniciar el servidor
async function loadContext() {
  try {
    const docsDir = path.resolve(process.env.PDF_PATHS || './docs')
    const contextPath = path.resolve(process.env.CONTEXT_FILE || './docs/context.txt')
    const driveUrls = process.env.DRIVE_URLS?.split(',') || []
    
    console.log('Iniciando carga de contexto...')
    let allJsons: Record<string, string> = {}

    // 1. Cargar archivo de contexto
    try {
      const contextContent = fs.readFileSync(contextPath, 'utf-8')
      allJsons['context.txt'] = JSON.stringify({
        type: 'text',
        content: contextContent
      })
      console.log('✅ Archivo de contexto cargado')
    } catch (error) {
      console.error('❌ Error cargando archivo de contexto:', error)
    }

    // 2. Cargar PDFs del directorio
    if (fs.existsSync(docsDir)) {
      const files = fs.readdirSync(docsDir)
      for (const file of files) {
        if (file.endsWith('.pdf')) {
          try {
            console.log(`📄 Procesando PDF: ${file}`)
            const pdfBuffer = fs.readFileSync(path.join(docsDir, file))
            const pdfData = await pdfParse(pdfBuffer)
            
            allJsons[file] = JSON.stringify({
              type: 'text',
              content: pdfData.text,
              info: {
                pages: pdfData.numpages,
                metadata: pdfData.metadata
              }
            })
            console.log(`✅ PDF procesado: ${file} (${pdfData.numpages} páginas)`)
          } catch (error) {
            console.error(`❌ Error procesando PDF ${file}:`, error)
          }
        }
      }
    }

    // 3. Luego procesamos archivos de Google Drive
    if (driveUrls.length > 0) {
      try {
        await GoogleDriveService.authenticate()
        
        for (const url of driveUrls) {
          const folderId = url.split('/').pop()
          if (!folderId) continue

          const driveFiles = await GoogleDriveService.downloadFolder(folderId)
          
          for (const file of driveFiles) {
            console.log(`\n🔍 Procesando archivo de Drive: ${file.name}`)
            try {
              // El contenido ya viene como JSON string desde GoogleDriveService
              console.log('\n📋 JSON recibido:')
             // console.log(file.content)
              
              // Lo guardamos directamente
              allJsons[file.name] = file.content
              
              console.log(`✅ Archivo ${file.name} procesado correctamente`)
            } catch (error) {
              console.error(`❌ Error procesando ${file.name}:`, error)
            }
          }
        }
      } catch (error) {
        console.error('❌ Error procesando archivos de Google Drive:', error)
      }
    }
    
    globalJsons = allJsons
    
    // Guardar log de auditoría
    await DocumentProcessor.saveAuditLog(globalJsons)
    
    console.log('\n📚 CONTENIDO DE GLOBALJSONS')
    console.log('============================')
    Object.entries(globalJsons).forEach(([key, value]) => {
      try {
        const parsed = JSON.parse(value)
        console.log(`\n📑 Archivo: ${key}`)
        console.log(`📝 Tipo: ${parsed.type}`)
        if (parsed.type === 'text') {
          console.log(`📄 Primeros 150 caracteres: ${parsed.content.substring(0, 150)}...`)
          if (parsed.info) {
            console.log(`ℹ️ Info adicional:`, parsed.info)
          }
        } else if (parsed.hojas) {
          console.log(`📊 Hojas encontradas: ${parsed.hojas.length}`)
          parsed.hojas.forEach((hoja: any) => {
            console.log(`   - ${hoja.nombreHoja}: ${hoja.filas.length} filas`)
          })
        }
      } catch (error) {
        console.log(`❌ Error al procesar ${key}:`, error)
      }
    })
    console.log('\n============================')

  } catch (error) {
    console.error('❌ Error al cargar el contexto:', error)
  }
}

// Función auxiliar para buscar en un JSON específico
async function searchInJson(jsonString: any, query: string): Promise<SearchResult | null> {
    try {
        console.log('\n🔍 Iniciando búsqueda...');
        
        // Asegurarnos de que jsonString sea un objeto
        const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
        console.log('📋 Datos recibidos:', {
            esString: typeof jsonString === 'string',
            tipo: data.type,
            tieneContent: Boolean(data.content),
            longitudContent: data.content?.length
        });

        if (data.type === 'hunting') {
            console.log('🎯 Detectado archivo Hunting');
            
            // Usar el asistente para procesar la consulta
            const assistant = AssistantService.getInstance();
            
            // Mejorar la consulta con contexto específico
            const enhancedQuery = `Consulta específica a responder : ${query}`;
            
            // Subir datos y consultar
            await assistant.uploadHuntingData(JSON.stringify(data));
            const response = await assistant.queryHuntingData(enhancedQuery);
            
            return {
                fileName: 'Hunting.xlsx',
                nombreHoja: 'Vacantes y Postulantes',
                totalEncontrados: data.content.length,
                filas: data.content,
                response: response
            };
        }
        
        console.log('❌ Tipo de archivo no reconocido')
        return null
        
    } catch (error) {
        console.error('❌ Error procesando JSON:', error)
        throw error;
    }
}

async function searchWithOpenAI(jsonResult: SearchResult, query: string, contextContent: string) {
    try {
        const systemPrompt = `Eres un asistente experto en análisis de datos de recursos humanos y reclutamiento.

CONTEXTO GENERAL:
${contextContent}

INSTRUCCIONES:
1. Analiza los datos proporcionados de la hoja "${jsonResult.nombreHoja}"
2. Usa el contexto anterior para entender el dominio y las reglas del negocio
3. Si encuentras fechas o datos numéricos, preséntalos de manera ordenada
4. Menciona específicamente que estás analizando la hoja "${jsonResult.nombreHoja}"
5. Si no hay datos relevantes para la consulta, indícalo claramente`

        const userPrompt = `CONSULTA: ${query}

DATOS DE LA HOJA ${jsonResult.nombreHoja}:
${JSON.stringify(jsonResult, null, 2)}

Por favor, proporciona una respuesta detallada basada en el contexto general y los datos encontrados.`

        console.log('\n🤖 PROMPT ENVIADO A OPENAI (searchWithOpenAI):')
        console.log('============================================')
        console.log('SYSTEM:', {
            role: 'system',
            content: systemPrompt
        })
        console.log('\nUSER:', {
            role: 'user',
            content: userPrompt
        })
        console.log('============================================')

        const completion = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo-16k',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.1,
            max_tokens: 800
        })

        return {
            success: true,
            response: completion.choices[0]?.message?.content || '',
            source: jsonResult.nombreHoja
        }
    } catch (error) {
        console.error(`Error consultando OpenAI para ${jsonResult.nombreHoja}:`, error)
        return { success: false, source: jsonResult.nombreHoja }
    }
}

// Función para dividir un SearchResult en chunks más pequeños
function splitSearchResult(result: SearchResult, maxRows: number = 8): SearchResult[] {
    const chunks: SearchResult[] = []
    const totalChunks = Math.ceil(result.filas.length / maxRows)
    
    for (let i = 0; i < result.filas.length; i += maxRows) {
        const chunkFilas = result.filas.slice(i, i + maxRows)
        chunks.push({
            fileName: result.fileName,
            nombreHoja: `${result.nombreHoja} (Parte ${Math.floor(i/maxRows) + 1}/${totalChunks})`,
            totalEncontrados: chunkFilas.length,
            filas: chunkFilas,
            _originalHoja: result.nombreHoja,
            _chunkInfo: `Parte ${Math.floor(i/maxRows) + 1} de ${totalChunks}`
        })
    }
    
    console.log(`📑 Dividiendo ${result.nombreHoja} en ${chunks.length} partes de ${maxRows} filas máximo`)
    return chunks
}

// Función para estimar tokens (aproximada)
function estimateTokens(text: string): number {
    return text.length / 4 // Estimación aproximada
}

// Función para refinar la respuesta final
async function refineResponse(rawResponse: string, originalQuery: string): Promise<string> {
    try {
        console.log('\n🎯 Refinando respuesta final...')
        console.log('\n🤖 PROMPT ENVIADO A OPENAI (refineResponse):')
        console.log('==========================================')
        console.log('SYSTEM:', {
            role: 'system',
            content: ` ver`
        })
        console.log('\nUSER:', {
            role: 'user',
            content: `CONSULTA ORIGINAL: ${originalQuery}\n\nRESPUESTA A REFINAR:\n${rawResponse}`
        })
        console.log('==========================================')

        const completion = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo-16k',
            messages: [
                {
                    role: 'system',
                    content: `Eres un asistente encargado de consolidar respuestas parciales de archivos de hunting.
        
        OBJETIVO:
        Unificar respuestas en una única respuesta final, clara y centrada en la consulta original.
        
        INSTRUCCIONES:
Presenta SIEMPRE la información en este formato:

### 📊 Vacantes de {Cliente}

| ID | Estado | Fecha Alta | Perfil | Reclutador |
|----|--------|------------|---------|------------|
| 913 | ✅ Activa | 10/12/2024 | IT Delivery Manager Jr/SSr | Marcos |

### 📈 Resumen
- Total vacantes encontradas: X
- Activas: X
- En proceso: X
- Cerradas: X

### 📋 Detalles Adicionales
- Reclutadores asignados: X
- Vacantes más recientes: X
- Perfiles más solicitados: X

NOTAS:
1. NUNCA muestres el JSON crudo
2. SIEMPRE usa emojis para estados:
   ✅ Activa
   🔄 En Proceso
   ❌ Cerrada
   ⏸️ Pausada
3. Ordena por fecha de alta (más reciente primero)
4. Si no hay datos, indica "No se encontraron vacantes"`
                },
                {
                    role: 'user',
                    content: `CONSULTA ORIGINAL: ${originalQuery}\n\nRESPUESTA A REFINAR:\n${rawResponse}`
                }
            ],
            temperature: 0.1,
            max_tokens: 8000,
            presence_penalty: 0.1,
            frequency_penalty: 0.3
        })

        const refinedResponse = completion.choices[0]?.message?.content || rawResponse
        
        // Verificamos si la respuesta parece estar cortada
        if (refinedResponse.length > 5000 && 
            !refinedResponse.endsWith('.') && 
            !refinedResponse.endsWith('!') && 
            !refinedResponse.endsWith('?')) {
            console.log('⚠️ La respuesta parece estar cortada, usando respuesta sin refinar')
            return rawResponse
        }

        return refinedResponse
    } catch (error) {
        console.error('Error refinando respuesta:', error)
        return rawResponse
    }
}

app.post('/api/chat', async (req: Request<{}, {}, ChatRequest>, res: Response) => {
    try {
        const { message } = req.body;
        console.log('\n📩 Mensaje recibido:', message);

        // Buscamos en todos los JSONs
        const searchResults: SearchResult[] = [];
        for (const [key, jsonString] of Object.entries(globalJsons)) {
            const result = await searchInJson(jsonString, message);
            if (result) {
                // Si es un resultado de Hunting, lo procesamos directamente
                if (result.fileName === 'Hunting.xlsx') {
                    return res.status(200).json({
                        response: result.response,
                        sources: ['Hunting.xlsx']
                    });
                }
                searchResults.push(result);
            }
        }

        // Solo procesar con chunks si no es Hunting
        // ... resto del código existente para otros tipos de archivos ...
    } catch (error) {
        console.error('Error:', error);
        return res.status(200).json({
            response: 'Error interno. Por favor, intenta nuevamente.'
        });
    }
});

function splitIntoChunks(text: string, maxChunkSize: number): string[] {
  if (text.length <= maxChunkSize) {
    return [text]
  }

  const chunks: string[] = []
  let currentChunk = ''
  const lines = text.split('\n')

  for (const line of lines) {
    if ((currentChunk + line + '\n').length > maxChunkSize && currentChunk) {
      chunks.push(currentChunk.trim())
      currentChunk = ''
    }
    currentChunk += line + '\n'
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim())
  }

  return chunks
}

// Endpoint para preguntas sugeridas
app.get('/api/suggested-questions', (req: Request, res: Response) => {
  const questions = process.env.SUGGESTED_QUESTIONS?.split(',') || [
    'Vacantes Disponibles',
    'Nombre de Reclutadores',
    'Que funciones tiene Aitalent'
  ]
  res.json({ questions })
})

app.post('/api/upload', upload.single('file'), async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            throw new Error('No file uploaded')
        }

        const filePath = req.file.path
        console.log('📁 Archivo recibido:', filePath)

        // Actualizamos globalJsons con el resultado del procesamiento
        globalJsons = await DocumentProcessor.processExcelFile(filePath)

        // Limpiamos el archivo temporal
        fs.unlinkSync(filePath)
        console.log('🗑️ Archivo temporal eliminado')

        res.status(200).json({ message: 'File processed successfully' })
    } catch (error) {
        console.error('Error processing file:', error)
        res.status(500).json({ error: 'Error processing file' })
    }
})

async function startServer() {
  try {
    await loadContext()
    
    // Inicializar el asistente
    const assistant = AssistantService.getInstance()
    await assistant.initializeAssistant()
    
    const PORT = process.env.PORT || 3001
    //const server = app.listen(PORT, () => {
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`)
    })
  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error)
  }
}

startServer()

export default app

// Función actualizada con tipos
function searchInHuntingData(huntingData: HuntingVacante[], query: string): SearchResult | null {
    try {
        console.log('\n🔍 Buscando en datos de Hunting...')
        console.log('📝 Término de búsqueda:', query)
        
        const matchingVacantes = huntingData.filter(vacante => {
            //console.log(`\n👀 Revisando vacante ${vacante.id_vacante} - ${vacante.cliente}`)
            
            const vacanteMatch = Object.entries(vacante).some(([key, value]) => {
                if (key === 'postulantes') return false;
                const match = String(value).toLowerCase().includes(query.toLowerCase())
                if (match) console.log(`✅ Coincidencia encontrada en ${key}: ${value}`)
                return match
            });

            if (vacanteMatch) {
                console.log('✨ Vacante coincide con la búsqueda')
                return true
            }

            const postulanteMatch = vacante.postulantes?.some((postulante: HuntingPostulante) =>
                Object.entries(postulante).some(([key, value]) => {
                    if (key === 'datos_ingreso') return false;
                    return String(value).toLowerCase().includes(query.toLowerCase());
                })
            );

            if (postulanteMatch) {
                console.log('👥 Coincidencia encontrada en postulantes')
                return true
            }

            return false
        });

        console.log(`\n📊 Total de vacantes encontradas sera 0: ${matchingVacantes.length}`)

        if (matchingVacantes.length > 0) {
            return {
                fileName: 'Hunting.xlsx',
                nombreHoja: 'Vacantes y Postulantes',
                totalEncontrados: matchingVacantes.length,
                filas: matchingVacantes
            };
        }
    } catch (error) {
        console.error('❌ Error buscando en datos de Hunting:', error);
    }
    return null;
}
