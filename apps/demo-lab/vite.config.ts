import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/rhj": { target: "https://api.robinhood.com", changeOrigin: true },
      "/rpc": {
        target: "https://rpc.mainnet.chain.robinhood.com",
        changeOrigin: true,
        rewrite: () => "/",
      },
    },
  },
  build: { outDir: "../../dist/demo-lab", emptyOutDir: true },
});
