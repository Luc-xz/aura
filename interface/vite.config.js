/** @type {import('vite').UserConfig} */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig((config) => {
  const env = loadEnv(config.mode, process.cwd(), 'VITE_')

  return {
    plugins: [
      react(),
      tailwindcss()
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    },
    server: {
      port: 5173,
      host: '0.0.0.0',
      proxy: {
        [env.VITE_APP_BASE_API]: {
          target: 'http://localhost:3000',
          changeOrigin: true,
          rewrite: (path) => path.replace(new RegExp(`^${env.VITE_APP_BASE_API}`), '')
        }
      }
    }
  }
})