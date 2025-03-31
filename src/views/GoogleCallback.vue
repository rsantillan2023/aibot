<template>
  <div class="fixed inset-0 flex items-center justify-center">
    <div class="text-center">
      <p class="text-gray-600">Procesando autenticación...</p>
      <!-- Puedes agregar un spinner o animación de carga aquí -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

onMounted(async () => {
  try {
    // Aquí irá la lógica de autenticación con Google
    // Por ahora solo redirigimos al chat
    await router.push('/chat')
  } catch (error) {
    console.error('Error en la autenticación:', error)
    // Manejar el error según sea necesario
  }
})
</script> 