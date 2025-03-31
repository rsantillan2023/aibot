<template>
  <svg
    :class="[
      'w-6 h-6',
      recording ? 'text-red-500' : 'text-gray-600'
    ]"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
    />
  </svg>
</template>

<script setup lang="ts">
defineProps<{
  recording: boolean
}>()
</script> 