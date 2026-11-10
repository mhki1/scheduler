import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Change this to the folder URL where you deploy the app.
  // Example: '/wp-content/uploads/my-app/'
  base: '/',
})
