<template>
  <div class="h-screen flex flex-col bg-white">
    <!-- Header -->
    <div class="p-4 bg-gray-100 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="bg-[#D16C46] rounded-lg p-1 w-10 h-10 flex items-center justify-center">
          <img src="@/assets/logo.png" alt="Logo" class="w-8 h-8 object-contain">
        </div>
        <div>
          <h3 class="font-semibold text-gray-800">Soy Soofia,</h3>
          <p class="text-sm text-gray-600">tu asistente virtual</p>
        </div>
      </div>
    </div>

    <!-- Chat Container -->
    <div class="flex-1 flex flex-col">
      <!-- Preguntas Sugeridas -->
      <div class="px-4 py-2 border-b flex flex-wrap gap-1.5">
        <button
          v-for="question in suggestedQuestions"
          :key="question"
          @click="handleSuggestedQuestion(question)"
          class="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-[10px] rounded-full 
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
            <p v-if="message.type === 'user'" class="text-[16px]">{{ message.content }}</p>
            <div v-else class="space-y-2">
              <div v-if="message.content === 'Analizando ... (puede tardar varios minutos)'" 
                   class="flex items-center space-x-2">
                <span class="text-xs italic text-gray-600">{{ message.content }}</span>
                <span class="flex space-x-1">
                  <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0s"></span>
                  <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></span>
                  <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.4s"></span>
                </span>
              </div>
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
            class="flex-1 border-none focus:outline-none px-2 text-[12px]"
            @keyup.enter="handleSend"
          >
          <button 
            @click="toggleVoiceInput"
            :class="[
              'relative',
              isListening ? 'text-red-500' : 'text-gray-400'
            ]"
          >
            <div v-if="isListening" class="absolute inset-0 animate-ping rounded-full bg-red-100"></div>
            <svg class="w-5 h-5 relative" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path v-if="!isListening" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M15.536 8.464a5 5 0 010 7.072M12 18h.01M8.464 8.464a5 5 0 007.072 0" />
            </svg>
          </button>
          <button 
            @click="handleSend"
            :disabled="!inputMessage.trim()"
            class="text-gray-400"
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
import { ref, onMounted, watch, nextTick } from 'vue'
//const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = 'https://aibot11-kp7q.onrender.com'
import DOMPurify from 'dompurify'
import { marked } from 'marked'

// Reutilizamos toda la lógica del ChatWidget
interface ChatMessage {
  type: 'user' | 'bot'
  content: string
  timestamp: number
}

const inputMessage = ref('')
const messages = ref<ChatMessage[]>([])
const messagesContainer = ref<HTMLElement | null>(null)
const suggestedQuestions = ref<string[]>([])
const isListening = ref(false)
let recognition: SpeechRecognition | null = null

// Función para formatear mensajes
const formatMessage = (content: string) => {
  const cleanContent = DOMPurify.sanitize(content)
  return marked(cleanContent)
}

// Scroll automático
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

// Manejar envío de mensajes
const handleSend = async () => {
  if (!inputMessage.value.trim()) return

  const message = inputMessage.value
  inputMessage.value = ''

  messages.value.push({
    type: 'user',
    content: message,
    timestamp: Date.now()
  })

  scrollToBottom()

  messages.value.push({
    type: 'bot',
    content: 'Analizando su consulta...',
    timestamp: Date.now()
  })

  try {
    //const response = await fetch('http://localhost:3001/api/chat', {
      const response = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message })
    })

    const data = await response.json()
    
    // Reemplazar el mensaje de "analizando" con la respuesta
    messages.value[messages.value.length - 1] = {
      type: 'bot',
      content: data.response,
      timestamp: Date.now()
    }
  } catch (error) {
    console.error('Error:', error)
    messages.value[messages.value.length - 1] = {
      type: 'bot',
      content: 'Lo siento, hubo un error al procesar tu mensaje.',
      timestamp: Date.now()
    }
  }
}

// Manejar preguntas sugeridas
const handleSuggestedQuestion = (question: string) => {
  inputMessage.value = question
  handleSend()
}

// Cargar preguntas sugeridas
onMounted(async () => {
  try {
    //const response = await fetch('http://localhost:3001/api/suggested-questions')
    const response = await fetch(`${API_URL}/api/suggested-questions`)
    const data = await response.json()
    suggestedQuestions.value = data.questions
  } catch (error) {
    console.error('Error cargando preguntas sugeridas:', error)
  }
})

// Reconocimiento de voz
const toggleVoiceInput = () => {
  if (!recognition) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      recognition = new SpeechRecognition()
      recognition.lang = 'es-ES'
      recognition.continuous = false
      recognition.interimResults = false

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        inputMessage.value = transcript
        handleSend()
      }

      recognition.onend = () => {
        isListening.value = false
      }

      recognition.onerror = (event) => {
        console.error('Error en reconocimiento de voz:', event.error)
        isListening.value = false
        messages.value.push({
          type: 'bot',
          content: 'No se pudo iniciar el reconocimiento de voz. Por favor, intenta de nuevo.',
          timestamp: Date.now()
        })
      }
    }
  }

  if (recognition) {
    if (!isListening.value) {
      recognition.start()
      isListening.value = true
      messages.value.push({
        type: 'bot',
        content: 'Escuchando... Habla ahora.',
        timestamp: Date.now()
      })
    } else {
      recognition.stop()
      isListening.value = false
      const lastMessage = messages.value[messages.value.length - 1]
      if (lastMessage && lastMessage.content === 'Escuchando... Habla ahora.') {
        messages.value.pop()
      }
    }
  }
}
</script>

<style scoped>
/* Aumentamos el tamaño de letra en todos los elementos */
.assistant-response {
  @apply text-[12px] italic text-gray-700 leading-relaxed;
}

.assistant-response p {
  @apply my-1.5;
}

/* Aumentamos el tamaño en los botones de preguntas sugeridas */
button {
  @apply text-[10px];
}

/* Aumentamos el tamaño en el input */
input {
  @apply text-[12px];
}

/* Aumentamos el tamaño en los mensajes del usuario */
p {
  @apply text-[10px];
}

/* El resto de los estilos se mantienen igual */
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

.assistant-response a,
.assistant-response code,
.assistant-response pre {
  font-style: normal;
}
</style> 
