export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss'],
  
  routeRules: {
    // 1. 針對一般頁面與 API
    '/**': {
      headers: {
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Resource-Policy': 'cross-origin' // 補上這行
      }
    },
    // 2. 【關鍵修復】強制 Vercel 對 _nuxt 底下的所有 JS/CSS 檔案也加上通行證
    '/_nuxt/**': {
      headers: {
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Resource-Policy': 'cross-origin'
      }
    }
  }
})