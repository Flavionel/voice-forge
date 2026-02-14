import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import { quasar, transformAssetUrls } from '@quasar/vite-plugin'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/main/index.js')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/preload/index.js')
        }
      }
    }
  },
  renderer: {
    root: 'src',
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/index.html')
        }
      }
    },
    optimizeDeps: {
      include: ['marked']
    },
    plugins: [
      vue({
        template: { transformAssetUrls }
      }),
      quasar({
        sassVariables: resolve(__dirname, 'src/styles/quasar-variables.scss')
      })
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    }
  }
})
