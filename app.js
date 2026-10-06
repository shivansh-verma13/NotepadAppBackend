import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import router from "./routes/index.js";
import mongoose from "mongoose";
import { requestBoundary, WRITE_HEADER } from "./utils/request-boundary.js";
import { createAuthLimiter } from "./utils/auth-limiter.js";

export function createApp(settings) {
  const app = express();
  app.disable("x-powered-by");
  app.locals.cookieOptions = settings.cookieOptions;
  app.use(requestBoundary(settings.origins));
  app.use(cors({
    origin: settings.origins, credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", WRITE_HEADER],
    exposedHeaders: ["Retry-After"],
  }));
  const authLimiter = createAuthLimiter(settings.authLimit);
  app.post(["/notepad/user/login", "/notepad/user/register"], authLimiter);
  app.use(express.json({ limit: "128kb" }));
  app.use(cookieParser(settings.cookieSecret));
  app.get("/health", (_req, res) => {
    const ready = mongoose.connection.readyState === 1;
    res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "unavailable" });
  });
  app.use("/notepad", router);
  app.use((error, _req, res, _next) => {
    const status = error.type === "entity.too.large" ? 413 : error.type === "entity.parse.failed" ? 400 : 500;
    res.status(status).json({ message: status === 500 ? "Request failed" : "Invalid request body" });
  });
  return app;
}
