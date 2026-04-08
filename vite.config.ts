import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'
import tailwindcssPostCSS from '@tailwindcss/postcss'
import autoprefixer from 'autoprefixer'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    react(),
    // Bundle analyzer - only include in build mode
    process.env.ANALYZE && visualizer({
      filename: 'dist/react/bundle-analysis.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
    }),
  ].filter(Boolean),
  css: {
    postcss: {
      plugins: [
        tailwindcssPostCSS,
        autoprefixer,
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/react'),
      '@components': path.resolve(__dirname, './src/react/components'),
      '@hooks': path.resolve(__dirname, './src/react/hooks'),
      '@store': path.resolve(__dirname, './src/react/store'),
      '@utils': path.resolve(__dirname, './src/react/utils'),
      '@types': path.resolve(__dirname, './src/react/types'),
      '@api': path.resolve(__dirname, './src/react/api'),
      '@assets': path.resolve(__dirname, './src/react/assets'),
    },
  },
  root: './src/react',
  build: {
    outDir: '../../dist/react',
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV === 'development',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunks for large libraries
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor'
            }
            if (id.includes('react-router')) {
              return 'react-router'
            }
            if (id.includes('@tanstack/react-query')) {
              return 'query-vendor'
            }
            if (id.includes('@heroicons/react')) {
              return 'icons-vendor'
            }
            if (id.includes('react-error-boundary')) {
              return 'ui-vendor'
            }
            // Other vendor libraries go into a general vendor chunk
            return 'vendor'
          }
          
          // Split React pages for better caching
          if (id.includes('src/react/pages/')) {
            const match = id.match(/pages\/(.+?)\//)
            if (match) {
              return `page-${match[1].toLowerCase()}`
            }
            return 'pages'
          }
          
          // Split components
          if (id.includes('src/react/components/')) {
            return 'components'
          }
          
          // Split stores/hooks
          if (id.includes('src/react/store/') || id.includes('src/react/hooks/')) {
            return 'stores-hooks'
          }
        },
        // Optimize chunk naming
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId
          if (facadeModuleId) {
            const name = path.basename(facadeModuleId, path.extname(facadeModuleId))
            return `chunks/${name}-[hash].js`
          }
          return 'chunks/[name]-[hash].js'
        },
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || ''
          if (name.endsWith('.css')) {
            return 'assets/css/[name]-[hash][extname]'
          }
          return 'assets/[name]-[hash][extname]'
        },
      },
    },
    // Performance optimizations
    chunkSizeWarningLimit: 1000,
    target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
  },
  server: {
    port: 3000,
    proxy: {
      '/api': process.env.BACKEND_URL || 'http://localhost:3001',
      '/mcp': process.env.BACKEND_URL || 'http://localhost:3001',
      '/workflow-editor.html': process.env.BACKEND_URL || 'http://localhost:3001',
      '/agent-studio.html': process.env.BACKEND_URL || 'http://localhost:3001',
    },
    hmr: {
      port: 3000,
    },
  },
  preview: {
    proxy: {
      '/api': process.env.BACKEND_URL || 'http://localhost:3001',
      '/mcp': process.env.BACKEND_URL || 'http://localhost:3001',
    },
  },
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
  },
})