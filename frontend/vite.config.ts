import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Em Docker Compose, VITE_API_PROXY_TARGET aponta para o nome do serviço do backend
// (ex: http://backend:3000) em vez de localhost, já que os containers se enxergam pela rede interna.
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? "http://localhost:3000";

// Necessário quando a porta publicada no host (5174) difere da porta interna do Vite (5173),
// para que o cliente de HMR conecte de volta na porta que o navegador realmente usou.
const hmrClientPort = process.env.VITE_HMR_CLIENT_PORT
  ? Number(process.env.VITE_HMR_CLIENT_PORT)
  : undefined;

// Bind mounts do Docker Desktop (Windows/macOS) não propagam eventos nativos de
// filesystem de forma confiável, então o watcher precisa cair para polling.
const usePolling = process.env.VITE_WATCH_USE_POLLING === "true";

// Dentro do container, o Vite precisa escutar em todas as interfaces (0.0.0.0)
// para que o port mapping do Docker consiga alcançá-lo. Fora do Docker, isso não
// deve ser usado — o padrão do Vite (escutar só em localhost) evita expor a porta
// para a rede local.
const isDocker = process.env.VITE_DOCKER === "true";

export default defineConfig({
  plugins: [react()],
  server: {
    host: isDocker ? true : undefined,
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
    hmr: hmrClientPort ? { clientPort: hmrClientPort } : undefined,
    watch: usePolling ? { usePolling: true } : undefined,
  },
});
