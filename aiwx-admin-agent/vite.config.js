import { defineConfig } from 'vite';
import { resolve } from 'path';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: '.',
  plugins: [tailwindcss()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        deployment_hub: resolve(__dirname, 'deployment_hub.html'),
        training_hub: resolve(__dirname, 'training_hub.html'),
        smb_landing: resolve(__dirname, 'smb_landing.html'),
        solopreneur_landing: resolve(__dirname, 'solopreneur_landing.html'),
        reseller_landing: resolve(__dirname, 'reseller_landing.html'),
        test_suite: resolve(__dirname, 'test_suite.html'),
        product_documentation: resolve(__dirname, 'product_documentation.html')
      }
    }
  },
  server: {
    port: 3000
  }
});
