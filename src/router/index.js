import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/home',
    },
    {
      path: '/home',
      name: 'home',
      component: () => import('../pages/HomePage.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/home',
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

export default router
