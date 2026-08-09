import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  modules: ['@pinia/nuxt'],
  css: ['@orbitforge/ui/tokens.css'],
  devtools: { enabled: false },
  devServer: {
    host: '127.0.0.1',
  },
  nitro: {
    preset: 'node-server',
  },
  typescript: {
    strict: true,
    typeCheck: true,
  },
})
