<template>
  <div class="chat-window fixed bottom-20 right-4 w-96 h-[500px] bg-white rounded-lg shadow-xl flex flex-col">
    <!-- Header -->
    <div class="p-4 bg-blue-600 text-white rounded-t-lg">
      <h3 class="font-semibold">Asistente Virtual</h3>
    </div>

    <!-- Mensajes -->
    <div class="flex-1 overflow-y-auto p-4 space-y-4" ref="messagesContainer">
      <div 
        v-for="(message, index) in messages" 
        :key="index"
        :class="[
          'max-w-[80%] rounded-lg p-3',
          message.type === 'user' 
            ? 'bg-blue-100 ml-auto' 
            : 'bg-gray-100'
        ]"
      >
        <p>{{ message.content }}</p>
        <div 
          v-if="message.loading" 
          class="loading-dots"
        >...</div>
      </div>
    </div>

    <!-- Input -->
    <div class="p-4 border-t">
      <form @submit.prevent="handleSubmit" class="flex gap-2">
        <input
          v-model="inputMessage"
          type="text"
          placeholder="Escribe tu mensaje..."
          class="flex-1 p-2 border rounded-lg focus:outline-none focus:border-blue-500"
        >
        <button 
          type="button"
          @click="toggleVoiceInput"
          class="p-2 text-gray-600 hover:text-blue-600"
        >
          <mic-icon :recording="isRecording" />
        </button>
        <button 
          type="submit"
          class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Enviar
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import MicIcon from './MicIcon.vue'
import { useVoiceInput } from '../composables/useVoiceInput'

const props = defineProps<{
  messages: Array<{
    type: 'user' | 'bot'
    content: string
    loading?: boolean
  }>
}>()

const emit = defineEmits<{
  (e: 'send', message: string): void
}>()

const inputMessage = ref('')
const messagesContainer = ref<HTMLElement | null>(null)
const { isRecording, startRecording, stopRecording, transcript } = useVoiceInput()

// Scroll al último mensaje
watch(() => props.messages, () => {
  setTimeout(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  }, 100)
}, { deep: true })

// Manejar entrada de voz
watch(transcript, (value) => {
  if (value) {
    inputMessage.value = value
  }
})

const toggleVoiceInput = async () => {
  if (isRecording.value) {
    await stopRecording()
  } else {
    await startRecording()
  }
}

const handleSubmit = () => {
  if (inputMessage.value.trim()) {
    emit('send', inputMessage.value)
    inputMessage.value = ''
  }
}
</script>

<style scoped>
.loading-dots {
  animation: loading 1s infinite;
}

@keyframes loading {
  0%, 100% { opacity: 0.2; }
  50% { opacity: 1; }
}

.chat-window {
  max-height: 80vh;
}

@media (max-width: 640px) {
  .chat-window {
    width: 90vw;
    right: 5vw;
    left: 5vw;
  }
}
</style> 