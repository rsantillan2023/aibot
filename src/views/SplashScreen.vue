<template>
  <div class="fixed inset-0 flex items-center justify-center bg-white">
    <div class="flex flex-col items-center space-y-4">
      <img 
        src="@/assets/soofia-logo.png" 
        alt="SOOFIA" 
        class="w-48 animate-fade-in"
      >
      <p class="text-gray-600 mt-4 animate-fade-in delay-300">
        Sabiduría Artificial
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

onMounted(() => {
  setTimeout(() => {
    router.push('/chat')
  }, 2000) // 2 segundos de splash
})
</script>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.8s ease-in forwards;
}

.delay-300 {
  animation-delay: 300ms;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style> 