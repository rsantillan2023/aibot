import OpenAI from 'openai';
import { MessageCreateParams } from "openai/resources/beta/threads/messages";
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { file } from 'googleapis/build/src/apis/file';

dotenv.config(); // Asegura que cargue el archivo .env

// Definimos los tipos correctamente
type AssistantUpdateParams = {
    model?: string;
    name?: string;
    description?: string;
    instructions?: string;
    tools?: Array<{ type: string }>;
    file_ids?: string[];
    metadata?: Record<string, unknown>;
};

type AssistantResponse = {
    id: string;
    object: string;
    created_at: number;
    name: string;
    description: string | null;
    model: string;
    instructions: string | null;
    tools: Array<{ type: string }>;
    file_ids: string[];
    metadata: Record<string, unknown>;
};

// Definir la interfaz extendida para Assistant
interface AssistantWithFiles extends OpenAI.Beta.Assistants.Assistant {
    file_ids?: string[];
}

// Definir la interfaz para los parámetros de actualización
interface CustomAssistantUpdateParams extends OpenAI.Beta.Assistants.AssistantUpdateParams {
    file_ids?: string[];
}

type AssistantCreateParamsWithFiles = OpenAI.Beta.Assistants.AssistantCreateParams & {
    file_ids?: string[];
};

export class AssistantService {
    private static instance: AssistantService;
    private openai: OpenAI;
    private assistantId: string | null = null;
    private currentFileId: string | null = null;
    private currentJsonData: string | null = null;
    private currentJsonChunks: string[] = []; // ✅ ESTA ES LA LÍNEA QUE FALTABA
    
    private constructor() {
        this.openai = new OpenAI();
    }

    public static getInstance(): AssistantService {
        if (!AssistantService.instance) {
            AssistantService.instance = new AssistantService();
        }
        return AssistantService.instance;
    }

    async queryViaCodeInterpreter(jsonData: string, question: string): Promise<string> {
        try {
          console.log('🤖 Iniciando consulta con code_interpreter');
    
          const thread = await this.openai.beta.threads.create();
          console.log('🧵 Thread creado:', thread.id);
    
          const systemMessage = `Eres un asistente especializado en análisis de procesos de selección.
    
                        Recibirás un archivo JSON con datos de hunting en la siguiente estructura:
                        
                        {
                        "type": "hunting",
                        "content": [ ... ]
                        }
                        
                        Analiza únicamente el array "content" y responde la consulta con base en esos datos. Usa código si es necesario. Nunca inventes ni simules datos.`;
                        
                            // 1. Enviar mensaje de sistema con instrucciones y JSON
                            const userMessage = `JSON:
                        \n\n${jsonData}
                        \n\nPREGUNTA:
                        ${question}`;
    
          await this.openai.beta.threads.messages.create(thread.id, {
            role: "user",
            content: userMessage
          });
    
          const run = await this.openai.beta.threads.runs.create(thread.id, {
            assistant_id: process.env.ASSISTANT_ID || '', // O usa un assistant básico sin herramientas
            tools: [{ type: 'code_interpreter' }],
            instructions: systemMessage
          });
    
          const response = await this.waitForResponse(thread.id, run.id);
    
          await this.openai.beta.threads.del(thread.id);
          return response;
    
        } catch (error) {
          console.error('❌ Error usando code_interpreter:', error);
          throw error;
        }
      }
    
      async initializeAssistant() {
        try {
            const envPath = path.resolve(process.cwd(), '.env');

            if (process.env.ASSISTANT_ID) {
                const existing = await this.openai.beta.assistants.retrieve(process.env.ASSISTANT_ID);
                this.assistantId = existing.id;
                return;
            }

            const assistant = await this.openai.beta.assistants.create({
                name: "Hunting Data Analyst",
                description: "Especialista en análisis de datos de hunting y RRHH",
                model: "gpt-4-turbo-preview",
                tools: [
                    { type: "code_interpreter" }
                ],
                instructions: "Eres un asistente especializado en procesos de selección y análisis de datos de hunting. Recibirás archivos JSON preformateados como texto plano. Nunca inventes datos."
            });

            this.assistantId = assistant.id;

            let envContent = fs.readFileSync(envPath, 'utf8');
            if (envContent.includes('ASSISTANT_ID=')) {
                envContent = envContent.replace(/ASSISTANT_ID=.*/g, `ASSISTANT_ID=${this.assistantId}`);
            } else {
                envContent += `\nASSISTANT_ID=${this.assistantId}`;
            }

            fs.writeFileSync(envPath, envContent, 'utf8');
        } catch (error) {
            console.error('❌ Error inicializando asistente:', error);
            throw error;
        }
    }

    private convertirVacantesAResumen(content: any[]): string {
        return content.map((v: any) => {
            const postulantes = (v.postulantes || []).map((p: any) =>
                `- ${p.postulante} (${p.estado_postulacion}${p.estado_contratacion ? ', ' + p.estado_contratacion : ''})`
            ).join('\n');

            return `Vacante ${v.id_vacante || 'sin ID'} para ${v.cliente}.
Estado: ${v.estado_vacante}.
Perfil: ${v.perfil_puesto || 'no especificado'}.
Postulantes:\n${postulantes || 'Ninguno'}`;
        }).join('\n\n');
    }
    

//     async initializeAssistant() {
//         try {
//             const envPath = path.resolve(process.cwd(), '.env');
//             /* if (process.env.ASSISTANT_ID) {
//                 this.assistantId = process.env.ASSISTANT_ID;
//                 console.log('✅ Asistente existente encontrado:', this.assistantId);
//                 return;
//             } */
//                 if (process.env.ASSISTANT_ID) {
//                     const existing = await this.openai.beta.assistants.retrieve(process.env.ASSISTANT_ID);
//                     const hasFileSearch = existing.tools.some(t => t.type === 'file_search');
//                     console.log('🔍 Assistant existente:', existing.name, '| file_search habilitado:', hasFileSearch);
//                     this.assistantId = existing.id;
//                     console.log('✅ Asistente existente encontrado:', this.assistantId);
//                     return;
//                 }
//             const assistant = await this.openai.beta.assistants.create({
//                 name: "Hunting Data Analyst",
//                 description: "Especialista en análisis de datos de hunting y recursos humanos",
//                 model: "gpt-4-turbo-preview",
//                 tools: [
//                     { type: "code_interpreter" },
//                     { type: "file_search" } // ✅ Necesario para que pueda leer archivos
//                 ],
//                        instructions: `Eres un asistente especializado en análisis de datos de hunting y RRHH.


// Recibiras un archivo JSON con la siguiente estructura:
// {
//   "type": "hunting",
//   "content": [
//     {
//       "id_vacante": string,
//       "alta_vacante": string,
//       "reclutador": string,
//       "cliente": string,
//       "perfil_puesto": string,
//       "tipo_vacante": string,
//       "estado_vacante": string,
//       "log_interaccion": string,
//       "postulantes_presentados": string,
//       "postulantes_entrevistados": string,
//       "postulantes_rechazados": string,
//       "fecha_presentacion": string,
//       "fecha_cierre": string,
//       "fecha_respuesta_cliente": string,
//       "tiempo_primer_presentado": string,
//       "tiempo_cierre": string,
//       "tipo_respuesta_cliente": string,
//       "motivo_anulacion": string,
//       "postulantes": [
//         {
//           "postulante": string,
//           "estado_postulacion": string,
//           "estado_contratacion": string,
//           "comentarios_proceso": string,
//           "fecha_entrevista_cliente": string,
//           "fecha_feedback": string,
//           "fecha_cierre": string,
//           "fecha_anulada": string,
//           "tiempo_presentacion": string,
//           "tiempo_cierre": string,
//           "tiempo_anulada": string,
//           "datos_ingreso": {  // opcional, solo si el postulante fue contratado
//             "negocio": string,
//             "fecha_nacimiento": string,
//             "correo_electronico": string,
//             "correo_sooft": string,
//             "fecha_ingreso": string,
//             "preocupa": string,
//             "firmo": string,
//             "reclutador": string,
//             "sueldo_bruto": string
//           }
//         }
//       ]
//     }
//   ]
// }

// INSTRUCCIONES:
// 1. Para responder por favor, recoré todo el array "content" y analiza SOLO el array "content"
// 2. Analiza la consulta y obtiene la respuesta mas acorde de acuerdo a tus capacidades
// 3. Presenta la información en formato tabla con los campos que correspondan:
// 4. NUNCA inventes o simules datos
// Cuando se consulte por un cliente (por ejemplo, "Naranja X"), debes:
// 1. Buscar todas las vacantes dentro del array "content" donde el campo "cliente" sea EXACTAMENTE igual (case-insensitive).
// 2. No limitar la búsqueda a vacantes activas o recientes, a menos que se indique explícitamente.
// 3. Mostrar todas las coincidencias incluso si están cerradas, anuladas o duplicadas, a menos que se indique explícitamente.
// ESTADOS DE VACANTES:
// - "Activa"
// - "Activa - Hiring"
// - "Anulada"
// - "Cerrada"
// - "En Proceso"
// - "Pausada"

// Por favor, analiza los datos y responde las consultas basándote ÚNICAMENTE en la información real del archivo.
// `
//             }); 
//             console.log('🤖 Asistente creado:', assistant);
//             this.assistantId = assistant.id;
//             console.log('✅ Nuevo asistente creado:', this.assistantId);

//             let envContent = fs.readFileSync(envPath, 'utf8');

// // Reemplazar si ya existe la línea, o agregarla si no está
// if (envContent.includes('ASSISTANT_ID=')) {
//   envContent = envContent.replace(/ASSISTANT_ID=.*/g, `ASSISTANT_ID=${this.assistantId}`);
// } else {
//   envContent += `\nASSISTANT_ID=${this.assistantId}`;
// }

// fs.writeFileSync(envPath, envContent, 'utf8');
// console.log('📝 ID del assistant guardado en .env:', this.assistantId);
            
//         } catch (error) {
//             console.error('❌ Error inicializando asistente:', error);
//             throw error;
//         }
//     }

    /* async uploadHuntingData(jsonData: string) {
        try {
            // Primero subimos el archivo
            const dataDir = path.join(process.cwd(), 'data');
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir);
            }

            const filePath = path.join(dataDir, 'hunting_data.json');
            fs.writeFileSync(filePath, jsonData);
            console.log('📝 Datos guardados en:', filePath);

            const file = await this.openai.files.create({
                file: fs.createReadStream(filePath),
                purpose: 'assistants'
            });

                // 👇 Esperar a que se procese correctamente
                let retries = 5;
                let status = '';
                while (retries > 0) {
                const retrieved = await this.openai.files.retrieve(file.id);
                status = (retrieved as any).status || '';
                console.log(`⏳ Esperando indexación... Status: ${status}`);
                
                if (status === 'processed') break;

                await new Promise(resolve => setTimeout(resolve, 2000));
                retries--;
                }

                if (status !== 'processed') {
                throw new Error(`El archivo no pudo procesarse correctamente (último estado: ${status})`);
                }

                this.currentFileId = file.id;


            const retrieved = await this.openai.files.retrieve(file.id);
            console.log('📁 Archivo subido:', retrieved.filename, 'status:', retrieved.status);

            console.log('📤 Archivo subido con ID:', file.id);
            this.currentFileId = file.id;

            // Crear o actualizar el asistente con file_search
            if (!this.assistantId) {
                console.log('🤖 Creando nuevo asistente...');
                console.log('📎 Verificación: usando archivo con ID:', this.currentFileId);
                const assistant = await this.openai.beta.assistants.create({
                    name: "Hunting Data Analyst",
                    description: "Especialista en análisis de datos de hunting y recursos humanos",
                    model: "gpt-4-turbo-preview",
                    tools: [
                        { type: "code_interpreter" },
                        { type: "file_search" }
                    ],
                    instructions: `Eres un asistente especializado en análisis de datos de hunting y RRHH.`
                });
                this.assistantId = assistant.id;
                console.log('✅ Nuevo asistente creado:', this.assistantId);
            }

            // Crear thread
            const thread = await this.openai.beta.threads.create();
            console.log('📝 Thread creado:', thread.id);
            console.log('📎 Esperando 2 segundos...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            // Mensaje inicial
            console.log('📎 Verificación: usando archivo con ID:', this.currentFileId);
            await this.openai.beta.threads.messages.create(thread.id, {
                role: "user",
                content: "Por favor, recorre el array 'content' y confirma el total de vacantes que existen en el archivo y la cantidad de vacantes por cliente considerando el atributo 'cliente'",
                attachments: [
                    {
                      file_id: file.id,
                      tools: [{ type: "file_search" }]
                    }
                  ]
              });

            // Crear run con file_search y el archivo
            const runParams: any = {
                assistant_id: this.assistantId,
                        };
            
            const run = await this.openai.beta.threads.runs.create(thread.id, runParams);

            console.log('🚀 Run creado:', run.id);
            
            // Esperar respuesta para verificar
            let response = await this.waitForResponse(thread.id, run.id);
            console.log('🔍 Verificación de acceso:', response);

            return file.id;

        } catch (error) {
            console.error('❌ Error en el proceso:', error);
            throw error;
        }
    }

    async queryHuntingData(query: string): Promise<string> {
        try {
            if (!this.assistantId || !this.currentFileId) {
                throw new Error('Asistente o archivo no inicializado');
            }

            console.log('\n🤖 INICIANDO CONSULTA:');
            console.log('Query:', query);
            console.log('📁 Usando archivo:', this.currentFileId);

            const thread = await this.openai.beta.threads.create();
            console.log('📝 Nuevo thread creado:', thread.id);

    // ✅ NUEVO: Enviamos un mensaje "echo" para fijar el archivo en el contexto
    await this.openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: "Este archivo contiene vacantes de hunting para análisis posterior.",
      attachments: [
        {
          file_id: this.currentFileId!,
          tools: [{ type: "file_search" }]
        }
      ]
    });

    // ✅ VERIFICACIÓN: También con attachment (antes no siempre estaba)

            // Primero hagamos una consulta de verificación
            console.log('📎 Verificación: usando archivo con ID:', this.currentFileId);
            await this.openai.beta.threads.messages.create(thread.id, {
                role: "user",
                content: "Por favor, confirma el total de vacantes que existen en el archivo recorriendo todo el array 'content'",
                attachments: [
                    {
                      file_id: this.currentFileId!,
                      tools: [{ type: "file_search" }]
                    }
                  ]
              });
            const runVerificationParams: any = {
                assistant_id: this.assistantId,
                              };
              
              
               // const runVerification = await this.openai.beta.threads.runs.create(thread.id, runVerificationParams);
                const runVerification = await this.openai.beta.threads.runs.create(thread.id, {
                    assistant_id: this.assistantId,
                  });

            const verificationResponse = await this.waitForResponse(thread.id, runVerification.id);
            console.log('\n🔍 Verificación de acceso a datos:', verificationResponse);

            // Ahora sí, hacemos la consulta real
            console.log('Ahora si, hacemos la consulta real');
            await this.openai.beta.threads.messages.create(thread.id, {
                role: "user",
                content: query,
                attachments: [
                    {
                      file_id: this.currentFileId!,
                      tools: [{ type: "file_search" }]
                    }
                  ]
            });
           /*  const runParams: any = {
                assistant_id: this.assistantId,
                              }; */
              
             // const run = await this.openai.beta.threads.runs.create(thread.id, runParams);
           /*   const run = await this.openai.beta.threads.runs.create(thread.id, {
                assistant_id: this.assistantId,
              });

            let response = await this.waitForResponse(thread.id, run.id);
            console.log('✅ Respuesta recibida');
            await this.openai.beta.threads.del(thread.id);

            return response;

        } catch (error) {
            console.error('❌ Error consultando datos:', error);
            throw error;
        }
    } */ 

       /*  async uploadHuntingData(jsonData: string) {
            try {
              const dataDir = path.join(process.cwd(), 'data');
              if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir);
              }
        
              const filePath = path.join(dataDir, 'hunting_data.json');
              fs.writeFileSync(filePath, jsonData);
              console.log('📝 Datos guardados en:', filePath);
        
              const fullJson = JSON.parse(jsonData);
              const CHUNK_SIZE = 8; // cantidad de vacantes por chunk
              const chunks = [];
              for (let i = 0; i < fullJson.content.length; i += CHUNK_SIZE) {
                const part = fullJson.content.slice(i, i + CHUNK_SIZE);
                chunks.push(JSON.stringify({ type: 'hunting', content: part }, null, 2));
              }
              this.currentJsonChunks = chunks;
              console.log('📦 JSON dividido en', chunks.length, 'partes');
            } catch (error) {
              console.error('❌ Error guardando archivo JSON:', error);
              throw error;
            }
          }
        





          async queryHuntingData(question: string): Promise<string> {
            if (!this.currentJsonChunks.length) throw new Error('No hay datos cargados');
            const allAnswers: string[] = [];
        
            for (let i = 0; i < this.currentJsonChunks.length; i++) {
              console.log(`🔍 Procesando parte ${i + 1} de ${this.currentJsonChunks.length}`);
              const chunk = this.currentJsonChunks[i];
        
              const thread = await this.openai.beta.threads.create();
              await this.openai.beta.threads.messages.create(thread.id, {
                role: 'user',
                content: `JSON:
        ${chunk}
        
        PREGUNTA:
        ${question}`
              });
        
              const run = await this.openai.beta.threads.runs.create(thread.id, {
                assistant_id: process.env.ASSISTANT_ID || '',
                tools: [{ type: 'code_interpreter' }],
                instructions: `Eres un asistente especializado en procesos de seleccion. Analiza solo el array content del JSON.`
              });
        
              const response = await this.waitForResponse(thread.id, run.id);
              await this.openai.beta.threads.del(thread.id);
        
              allAnswers.push(`Parte ${i + 1}/${this.currentJsonChunks.length}:
        ${response}`);
            }
        
            // Consolidar respuestas en una sola
            return this.consolidateResponses(allAnswers, question);
          }
         */

          async uploadHuntingData(jsonData: string) {
            try {
                const dataDir = path.join(process.cwd(), 'data');
                if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
    
                const filePath = path.join(dataDir, 'hunting_data.json');
                fs.writeFileSync(filePath, jsonData);
    
                const fullJson = JSON.parse(jsonData);
                const CHUNK_SIZE = 8;
                const chunks: string[] = [];
    
                for (let i = 0; i < fullJson.content.length; i += CHUNK_SIZE) {
                    const part = fullJson.content.slice(i, i + CHUNK_SIZE);
                    const textoPlano = this.convertirVacantesAResumen(part);
                    chunks.push(textoPlano);
                }
    
                this.currentJsonChunks = chunks;
                console.log('📦 Datos preformateados en', chunks.length, 'partes');
            } catch (error) {
                console.error('❌ Error al procesar el archivo JSON:', error);
                throw error;
            }
        }
    
        async queryHuntingData(question: string): Promise<string> {
            if (!this.currentJsonChunks.length) throw new Error('No hay datos cargados');
    
            const allAnswers: string[] = [];
    
            for (let i = 0; i < this.currentJsonChunks.length; i++) {
                console.log(`🔍 Parte ${i + 1} de ${this.currentJsonChunks.length}`);
                const chunk = this.currentJsonChunks[i];
    
                const thread = await this.openai.beta.threads.create();
                await this.openai.beta.threads.messages.create(thread.id, {
                    role: 'user',
                    content: `Datos:
    ${chunk}
    
    PREGUNTA:
    ${question}`
                });
    
                const run = await this.openai.beta.threads.runs.create(thread.id, {
                    assistant_id: process.env.ASSISTANT_ID || '',
                    tools: [{ type: 'code_interpreter' }],
                    instructions: `Analiza los datos del texto plano. Nunca inventes ni simules información.`
                });
    
                const response = await this.waitForResponse(thread.id, run.id);
                await this.openai.beta.threads.del(thread.id);
    
                allAnswers.push(`Parte ${i + 1}:
    ${response}`);
            }
    
            return this.consolidateResponses(allAnswers, question);
        }
    /* 
        private async consolidateResponses(responses: string[], originalQuery: string): Promise<string> {
            const thread = await this.openai.beta.threads.create();
            const allText = responses.join('\n\n');
    
            await this.openai.beta.threads.messages.create(thread.id, {
                role: 'user',
                content: `Estas son respuestas parciales a la pregunta: ${originalQuery}
    
    ${allText}
    
    Por favor, unifica y resume esta información en una sola respuesta final.`
            });
    
            const run = await this.openai.beta.threads.runs.create(thread.id, {
                assistant_id: process.env.ASSISTANT_ID || '',
                tools: [{ type: 'code_interpreter' }],
                instructions: `Unifica múltiples respuestas parciales del análisis de datos de hunting.`
            });
    
            const final = await this.waitForResponse(thread.id, run.id);
            await this.openai.beta.threads.del(thread.id);
            return final;
        } */
    

            private async consolidateResponses(responses: string[], originalQuery: string): Promise<string> {
                console.log('\n🧠 Consolidando respuestas...');
                const thread = await this.openai.beta.threads.create();
              
                const allText = responses
                  .map((r) => r.replace(/Parte \d+\/\d+:\n/, '').trim()) // ✅ Quitar encabezado "Parte X/X"
                  .join('\n\n');
              
                const systemInstructions = `
              Tu tarea es unificar múltiples respuestas parciales de un análisis de hunting en una sola respuesta final organizada.
              
              Requisitos:
              - No menciones que los datos provienen de "partes".
              - Agrupa la información usando viñetas claras (•), títulos (por ejemplo: **Cliente:**, **Vacantes:**) y listas si corresponde.
              - No repitas textos o frases comunes innecesarias.
              - Mantené el lenguaje claro y directo, solo responde la pregunta original.
              `;
              
                await this.openai.beta.threads.messages.create(thread.id, {
                  role: 'user',
                  content: `Estas son respuestas parciales a la pregunta: ${originalQuery}
              
              ${allText}
              
              Por favor, unifica y resume toda esta información en una sola respuesta clara.`
                });
              
                const run = await this.openai.beta.threads.runs.create(thread.id, {
                  assistant_id: process.env.ASSISTANT_ID || '',
                  tools: [{ type: 'code_interpreter' }],
                  instructions: systemInstructions
                });
              
                const final = await this.waitForResponse(thread.id, run.id);
                await this.openai.beta.threads.del(thread.id);
                return final;
              }


          /* private async consolidateResponses(responses: string[], originalQuery: string): Promise<string> {
            console.log('\n🧠 Consolidando respuestas...');
            const thread = await this.openai.beta.threads.create();
        
            const allText = responses.join('\n\n');
        
            await this.openai.beta.threads.messages.create(thread.id, {
              role: 'user',
              content: `Estas son respuestas parciales a la pregunta: ${originalQuery}
        
        ${allText}
        
        Por favor, unifica y resume toda esta información en una sola respuesta clara.`
            });
        
            const run = await this.openai.beta.threads.runs.create(thread.id, {
              assistant_id: process.env.ASSISTANT_ID || '',
              tools: [{ type: 'code_interpreter' }],
              instructions: `Tu tarea es unificar múltiples respuestas parciales de un análisis de hunting en una sola respuesta final organizada.`
            });
        
            const final = await this.waitForResponse(thread.id, run.id);
            await this.openai.beta.threads.del(thread.id);
            return final;
          }
    
 */
    
    private async waitForResponse(threadId: string, runId: string): Promise<string> {
        while (true) {
            const run = await this.openai.beta.threads.runs.retrieve(threadId, runId);
            
            if (run.status === 'completed') {
                const messages = await this.openai.beta.threads.messages.list(threadId);
                const message = messages.data[0];
                if (message.content[0].type === 'text') {
                    return message.content[0].text.value;
                }
                return 'No se pudo obtener una respuesta en formato texto';
            }
            
            if (run.status === 'failed') {
                throw new Error('La consulta falló');
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
} 