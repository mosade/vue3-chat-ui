import { copyFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const copyPresetCss = () => ({
  name: 'copy-preset-css',
  closeBundle() {
    mkdirSync(resolve(__dirname, 'dist'), { recursive: true })
    copyFileSync(
      resolve(__dirname, 'src/style.css'),
      resolve(__dirname, 'dist/style.css')
    )
    copyFileSync(
      resolve(__dirname, 'src/presets/shadcn.css'),
      resolve(__dirname, 'dist/shadcn.css')
    )
  }
})

export default defineConfig({
  plugins: [vue(), copyPresetCss()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Vue3AiChat',
      fileName: (format) =>
        format === 'es' ? 'vue3-ai-chat.js' : 'vue3-ai-chat.umd.cjs'
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        exports: 'named',
        globals: {
          vue: 'Vue'
        }
      }
    }
  }
})
