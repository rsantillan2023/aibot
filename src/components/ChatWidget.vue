<template>
  <div class="fixed bottom-4 right-4 z-50">
    <!-- Botón flotante -->
    <button 
      v-if="!isOpen"
      @click="toggleChat"
      class="bg-[#D16C46] rounded-full p-4 shadow-lg hover:shadow-xl transition-all w-16 h-16 flex items-center justify-center"
    >
      <img src="@/assets/logo.png" alt="Chat" class="w-10 h-10 object-contain">
    </button>

    <!-- Ventana del chat -->
    <div 
      v-else
      class="bg-white rounded-2xl shadow-xl w-[380px] h-[600px] flex flex-col"
    >
      <!-- Header -->
      <div class="p-4 bg-gray-100 rounded-t-2xl flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="bg-[#D16C46] rounded-lg p-1 w-10 h-10 flex items-center justify-center">
            <img src="@/assets/logo.png" alt="Logo" class="w-8 h-8 object-contain">
          </div>
          <div>
            <h3 class="font-semibold text-gray-800">Soy Soofia,</h3>
            <p class="text-sm text-gray-600">tu asistente virtual</p>
          </div>
        </div>
        <button @click="toggleChat" class="text-gray-500 hover:text-gray-700">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Preguntas Sugeridas Fijas -->
      <div class="px-4 py-2 border-b flex flex-wrap gap-1.5">
        <button
          v-for="question in suggestedQuestions"
          :key="question"
          @click="handleSuggestedQuestion(question)"
          class="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-[8px] rounded-full 
                 text-gray-600 transition-colors duration-200 flex-shrink-0
                 border border-gray-200 w-[32%] font-bold"
        >
          {{ question }}
        </button>
      </div>

      <!-- Mensajes -->
      <div class="flex-1 overflow-y-auto p-4 space-y-4" ref="messagesContainer">
        <div 
          v-for="message in messages" 
          :key="message.timestamp"
          :class="[
            message.type === 'user' 
              ? 'ml-auto max-w-[85%]' 
              : 'flex gap-2 max-w-[80%]'
          ]"
        >
          <!-- Avatar para mensajes del bot -->
          <div v-if="message.type === 'bot'" 
               class="bg-[#D16C46] rounded-lg p-1 w-8 h-8 flex-shrink-0 flex items-center justify-center">
            <img src="@/assets/logo.png" alt="Logo" class="w-6 h-6 object-contain">
          </div>
          
          <div :class="[
            'py-3 px-6',
            message.type === 'user' 
              ? 'bg-[#9747FF] text-white rounded-[4px_30px_30px_30px]' 
              : 'bg-[#F8F8F8] text-gray-800 rounded-2xl'
          ]">
            <!-- Mensaje del usuario -->
            <p v-if="message.type === 'user'" class="text-[10px]">
              {{ message.content }}
            </p>

            <!-- Mensaje del bot -->
            <div v-else class="space-y-2">
              <!-- Indicador de escritura -->
              <div v-if="message.content === 'Analizando ... (puede tardar varios minutos)'" 
                   class="flex items-center space-x-2">
                <span class="text-xs italic text-gray-600">{{ message.content }}</span>
                <span class="flex space-x-1">
                  <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0s"></span>
                  <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></span>
                  <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.4s"></span>
                </span>
              </div>

              <!-- Respuesta formateada -->
              <div v-else class="prose prose-sm max-w-none markdown-body assistant-response" 
                   v-html="formatMessage(message.content)">
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Input -->
      <div class="p-4 border-t">
        <div class="flex gap-2 border rounded-full p-2">
          <input
            v-model="inputMessage"
            type="text"
            placeholder="Escribir o presionar micrófono para hablar..."
            class="flex-1 border-none focus:outline-none px-2 text-[10px]"
            @keyup.enter="handleSend"
          >
          <!-- Botón de micrófono -->
          <button 
            @click="toggleVoiceInput"
            :class="[
              'p-2 transition-colors duration-200 relative',
              isListening ? 'text-red-500' : 'text-gray-500 hover:text-gray-700'
            ]"
            title="Presiona para hablar"
          >
            <!-- Animación de onda cuando está escuchando -->
            <div v-if="isListening" class="absolute inset-0 animate-ping rounded-full bg-red-100"></div>
            <svg class="w-5 h-5 relative" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path v-if="!isListening" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M15.536 8.464a5 5 0 010 7.072M12 18h.01M8.464 8.464a5 5 0 007.072 0" />
            </svg>
          </button>
          <!-- Botón de enviar -->
          <button 
            @click="handleSend"
            :disabled="!inputMessage.trim()"
            :class="[
              'p-2 transition-colors duration-200',
              inputMessage.trim() 
                ? 'text-teal-600 hover:text-teal-700' 
                : 'text-gray-400'
            ]"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick, onUnmounted } from 'vue'
import DOMPurify from 'dompurify'
import { marked } from 'marked'

interface ChatMessage {
  type: 'user' | 'bot'
  content: string
  timestamp: number
}

const isOpen = ref(false)
const inputMessage = ref('')
const messages = ref<ChatMessage[]>([])
const messagesContainer = ref<HTMLElement | null>(null)
const suggestedQuestions = ref<string[]>([])
const isListening = ref(false)
let recognition: SpeechRecognition | null = null

// Función mejorada para scroll
const scrollToBottom = (smooth = true) => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTo({
        top: messagesContainer.value.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      })
    }
  })
}

// Observar cambios en los mensajes
watch(messages, () => {
  scrollToBottom()
}, { deep: true })

// Observar cuando se abre el chat
watch(isOpen, (newValue) => {
  if (newValue) {
    nextTick(() => {
      scrollToBottom(false) // Sin animación al abrir
    })
  }
})

const handleSend = async () => {
  if (!inputMessage.value.trim()) return

  const message = inputMessage.value
  inputMessage.value = ''

  // Agregar mensaje del usuario
  messages.value.push({
    type: 'user',
    content: message,
    timestamp: Date.now()
  })

  // Scroll después del mensaje del usuario
  scrollToBottom()

  // Agregar mensaje temporal del bot
  const botMessageIndex = messages.value.length
  messages.value.push({
    type: 'bot',
    content: 'Analizando su consulta...',
    timestamp: Date.now()
  })

  // Scroll después del mensaje temporal
  scrollToBottom()

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        message,
        history: messages.value.slice(0, -1)
      })
    })

    const data = await response.json()
    
    // Actualizar el mensaje del bot con la respuesta
    messages.value[botMessageIndex] = {
      type: 'bot',
      content: data.response,
      timestamp: Date.now()
    }

    // Scroll después de la respuesta
    scrollToBottom()
  } catch (error) {
    console.error('Error:', error)
    messages.value[botMessageIndex] = {
      type: 'bot',
      content: 'Lo siento, hubo un error al procesar tu consulta.',
      timestamp: Date.now()
    }
    scrollToBottom()
  }
}

const handleSuggestedQuestion = (question: string) => {
  inputMessage.value = question
  handleSend()
}

// Cargar preguntas sugeridas
const loadSuggestedQuestions = async () => {
  try {
    const response = await fetch('/api/suggested-questions')
    const data = await response.json()
    suggestedQuestions.value = data.questions
  } catch (error) {
    console.error('Error al cargar preguntas sugeridas:', error)
    suggestedQuestions.value = [
      'Vacantes Disponibles',
      'Nombre de Reclutadores',
      'Que funciones tiene Aitalent'
    ]
  }
}

onMounted(() => {
  loadSuggestedQuestions()
  nextTick(() => {
    scrollToBottom(false)
  })
})

const toggleChat = () => {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    nextTick(() => {
      scrollToBottom(false)
    })
  }
}

const toggleVoice = () => {
  // Implementar funcionalidad de voz
}

// Función para formatear el mensaje con Markdown
const formatMessage = (content: string) => {
  // Convertir Markdown a HTML
  const rawHtml = marked(content)
  // Sanitizar el HTML para prevenir XSS
  const cleanHtml = DOMPurify.sanitize(rawHtml)
  return cleanHtml
}

// Inicializar reconocimiento de voz
const initSpeechRecognition = () => {
  try {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      recognition = new SpeechRecognition()
      recognition.lang = 'es-ES'
      recognition.continuous = false
      recognition.interimResults = false

      recognition.onresult = async (event) => {
        const transcript = event.results[0][0].transcript
        inputMessage.value = transcript
        stopVoiceInput()
        // Enviar automáticamente después de transcribir
        await handleSend()
      }

      recognition.onerror = (event) => {
        console.error('Error de reconocimiento de voz:', event.error)
        stopVoiceInput()
        // Mostrar mensaje de error en el chat
        messages.value.push({
          type: 'bot',
          content: 'Lo siento, hubo un error al reconocer tu voz. Por favor, intenta de nuevo o escribe tu pregunta.',
          timestamp: Date.now()
        })
      }

      recognition.onend = () => {
        stopVoiceInput()
      }
    }
  } catch (error) {
    console.error('El navegador no soporta reconocimiento de voz')
  }
}

// Mejorar el manejo de errores de voz
const toggleVoiceInput = async () => {
  if (!recognition) {
    initSpeechRecognition()
  }

  if (recognition) {
    if (!isListening.value) {
      try {
        // Limpiar mensaje anterior si existe
        inputMessage.value = ''
        // Mostrar mensaje de escucha
        messages.value.push({
          type: 'bot',
          content: 'Escuchando... Habla ahora.',
          timestamp: Date.now()
        })
        await recognition.start()
        isListening.value = true
      } catch (error) {
        console.error('Error al iniciar reconocimiento de voz:', error)
        messages.value.push({
          type: 'bot',
          content: 'No se pudo iniciar el reconocimiento de voz. Por favor, intenta de nuevo.',
          timestamp: Date.now()
        })
      }
    } else {
      stopVoiceInput()
    }
  } else {
    messages.value.push({
      type: 'bot',
      content: 'Tu navegador no soporta reconocimiento de voz. Por favor, escribe tu pregunta.',
      timestamp: Date.now()
    })
  }
}

// Mejorar el stop de la entrada de voz
const stopVoiceInput = () => {
  if (recognition && isListening.value) {
    recognition.stop()
    isListening.value = false
    // Eliminar el mensaje de "Escuchando..." si existe
    const lastMessage = messages.value[messages.value.length - 1]
    if (lastMessage && lastMessage.content === 'Escuchando... Habla ahora.') {
      messages.value.pop()
    }
  }
}

// Limpiar reconocimiento al cerrar
onUnmounted(() => {
  stopVoiceInput()
})

// Declarar tipos para TypeScript
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition
    webkitSpeechRecognition: typeof SpeechRecognition
  }
}
</script>

<style scoped>
/* Estilizar la barra de scroll */
.overflow-y-auto {
  scrollbar-width: thin;
  scrollbar-color: #CBD5E0 transparent;
}

.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: #CBD5E0;
  border-radius: 3px;
}

/* Nuevos estilos para el contenido formateado */
:deep(.prose) {
  @apply text-sm text-gray-800;
}

:deep(.prose p) {
  @apply my-2;
}

:deep(.prose ul) {
  @apply list-disc pl-4 my-2;
}

:deep(.prose ol) {
  @apply list-decimal pl-4 my-2;
}

:deep(.prose li) {
  @apply my-1;
}

:deep(.prose code) {
  @apply bg-gray-100 px-1 rounded text-sm font-mono;
}

:deep(.prose pre) {
  @apply bg-gray-100 p-2 rounded my-2 overflow-x-auto;
}

:deep(.prose blockquote) {
  @apply border-l-4 border-gray-300 pl-4 my-2 italic;
}

:deep(.prose strong) {
  @apply font-semibold;
}

:deep(.prose em) {
  @apply italic;
}

/* Animación de escritura */
@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

.animate-bounce {
  animation: bounce 1s infinite;
}

/* Nuevos estilos para las sugerencias */
button {
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

button:hover {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* Animación suave para los botones */
button {
  transform: translateY(0);
  transition: all 0.2s ease;
}

button:hover {
  transform: translateY(-1px);
}

button:active {
  transform: translateY(0);
}

/* Estilos para las sugerencias fijas */
.suggested-questions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid #e5e7eb;
  background-color: #ffffff;
}

/* Ajuste para el contenedor de mensajes */
.overflow-y-auto {
  height: calc(100% - 180px); /* Ajustar según el alto del header y sugerencias */
}

/* Estilo para los botones de sugerencia */
button {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px; /* Ajustar según necesidad */
}

/* Estilos para las respuestas del asistente */
.assistant-response {
  @apply text-[10px] italic text-gray-700 leading-relaxed;
}

.assistant-response p {
  @apply my-1.5;
}

.assistant-response ul,
.assistant-response ol {
  @apply my-1.5 pl-4;
}

.assistant-response li {
  @apply my-0.5;
}

.assistant-response strong {
  @apply font-semibold text-gray-800 not-italic;
}

.assistant-response code {
  @apply text-xs bg-gray-200 px-1 py-0.5 rounded not-italic font-normal;
}

.assistant-response pre {
  @apply my-2 p-2 bg-gray-200 rounded-md overflow-x-auto;
}

.assistant-response blockquote {
  @apply pl-3 border-l-2 border-gray-300 my-2 text-gray-600;
}

.assistant-response h3 {
  @apply text-sm font-semibold text-gray-800 my-2 not-italic;
}

/* Ajustes para mantener algunos elementos sin cursiva */
.assistant-response a,
.assistant-response code,
.assistant-response pre {
  font-style: normal;
}

/* Animación de onda para el micrófono */
@keyframes ping {
  75%, 100% {
    transform: scale(2);
    opacity: 0;
  }
}

.animate-ping {
  animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
}
</style> 