import { defineConfig, loadEnv } from "vite";
import { resolve } from "path";
import sendOtpHandler from "./api/otp/send.js";
import verifyOtpHandler from "./api/otp/verify.js";

function vercelApiDevPlugin() {
  return {
    name: "vercel-api-dev-server",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0];
        if (url === "/api/otp/send" || url === "/api/otp/verify") {
          let body = {};
          if (req.method === "POST") {
            const buffers = [];
            for await (const chunk of req) {
              buffers.push(chunk);
            }
            const raw = Buffer.concat(buffers).toString();
            try {
              body = JSON.parse(raw);
            } catch (e) {
              body = {};
            }
          }
          req.body = body;

          // Express/Vercel helper polyfill for local dev server
          res.status = function (code) {
            this.statusCode = code;
            return this;
          };
          res.json = function (obj) {
            this.setHeader("Content-Type", "application/json");
            this.end(JSON.stringify(obj));
            return this;
          };

          if (url === "/api/otp/send") {
            return sendOtpHandler(req, res);
          } else {
            return verifyOtpHandler(req, res);
          }
        }
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  Object.assign(process.env, env);

  return {
    plugins: [vercelApiDevPlugin()],
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, "index.html"),
          admin: resolve(__dirname, "admin.html"),
        },
      },
    },
  };
});

