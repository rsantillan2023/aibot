<template>
  <button 
    class="chat-button rounded-full p-4 bg-blue-600 hover:bg-blue-700 transition-all shadow-lg"
    @click="$emit('click')"
  >
    <img 
      v-if="!isOpen" 
      :src="chatIcon" 
      alt="Abrir chat"
      class="w-6 h-6"
    >
    <svg 
      v-else 
      class="w-6 h-6 text-white" 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
    >
      <path 
        stroke-linecap="round" 
        stroke-linejoin="round" 
        stroke-width="2" 
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  isOpen: boolean
}>()

defineEmits<{
  (e: 'click'): void
}>()

// Asume que tienes un ícono de chat importado
const chatIcon = '/path/to/chat-icon.svg'
</script> 