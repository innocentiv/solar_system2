import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset paths so the production build works under any
  // sub-path, in particular GitHub Pages (https://user.github.io/repo/).
  base: "./",
  server: { port: 47823, strictPort: true },
  preview: { port: 47823, strictPort: true },
});
