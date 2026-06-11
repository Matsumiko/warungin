import { defineConfig, type Plugin } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { randomBytes } from "node:crypto";
import tsconfigPaths from "vite-tsconfig-paths";

function csrfDevPlugin(): Plugin {
  return {
    name: "csrf-dev",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const cookie = req.headers.cookie ?? "";
        if (!cookie.includes("warungin_csrf=")) {
          const token = randomBytes(32).toString("hex");
          const existing = res.getHeader("set-cookie");
          const newCookie = `warungin_csrf=${token}; Path=/; SameSite=Strict; Max-Age=86400`;
          res.setHeader(
            "set-cookie",
            existing
              ? [...(Array.isArray(existing) ? existing : [existing]), newCookie]
              : newCookie,
          );
        }
        next();
      });
    },
  };
}

export default defineConfig({
  environments: {
    client: {
      build: {
        rollupOptions: {
          external: ["@tanstack/start-server-core"],
        },
      },
      optimizeDeps: {
        exclude: ["@tanstack/start-server-core"],
      },
    },
  },
  plugins: [tailwindcss(), csrfDevPlugin(), tanstackStart(), react(), tsconfigPaths()],
});
