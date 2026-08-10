import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages 部署：CI 里从仓库名推 base，本地为 '/'
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_REPOSITORY
    ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/`
    : '/',
})
