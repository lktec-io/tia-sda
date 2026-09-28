import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // Long-lived vendor chunks: they only change when dependencies are upgraded,
        // so returning visitors keep them cached across app deploys.
        codeSplitting: {
          groups: [
            { name: 'firebase-firestore', test: /node_modules[\\/]@firebase[\\/]firestore/ },
            { name: 'firebase-auth', test: /node_modules[\\/]@firebase[\\/]auth/ },
            { name: 'firebase-core', test: /node_modules[\\/](@firebase|firebase)[\\/]/ },
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ }
          ]
        }
      }
    }
  }
})
