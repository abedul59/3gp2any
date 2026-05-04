// nuxt.config.ts
export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss']
  // ⛔ 把這裡原本的 routeRules 整個刪除！不需要跨域隔離了！
})