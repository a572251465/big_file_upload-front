import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

const pathResolve = (url: string): string => path.resolve(__dirname, url);
const port = 9222;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": pathResolve("src"),
    },
    extensions: [".vue", ".ts", ".tsx", ".js"],
  },
  server: {
    port,
  },
});
