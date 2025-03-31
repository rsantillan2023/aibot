import { ref } from 'vue'

export function useVoiceInput() {
  const isRecording = ref(false)
  const transcript = ref('')
  let recognition: SpeechRecognition | null = null

  const initializeSpeechRecognition = () => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = 'es-ES'

      recognition.onresult = (event) => {
        const current = event.resultIndex
        const result = event.results[current]
        transcript.value = result[0].transcript
      }

      recognition.onend = () => {
        isRecording.value = false
      }
    }
  }

  const startRecording = async () => {
    try {
      if (!recognition) {
        initializeSpeechRecognition()
      }
      
      if (recognition) {
        transcript.value = ''
        isRecording.value = true
        recognition.start()
      }
    } catch (error) {
      console.error('Error al iniciar grabación:', error)
    }
  }

  const stopRecording = async () => {
    if (recognition) {
      recognition.stop()
      isRecording.value = false
    }
  }

  return {
    isRecording,
    transcript,
    startRecording,
    stopRecording
  }
} 