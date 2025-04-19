// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  runtimeConfig: {
    public: {
      OPENAI_API_KEY: process.env.NUXT_PUBLIC_OPENAI_API_KEY
    }
  }
})
