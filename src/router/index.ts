import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('../views/SplashScreen.vue')
  },
  {
    path: '/chat',
    component: () => import('../views/ChatView.vue')
  },
  {
    path: '/auth/google/callback',
    component: () => import('../views/GoogleCallback.vue')
  },
  {
    path: '/widget',
    component: () => import('../components/ChatWidget.vue')
  }
]

export const router = createRouter({
  history: createWebHistory(),
  routes
}) 