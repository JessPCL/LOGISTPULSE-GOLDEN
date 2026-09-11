import express, { type ErrorRequestHandler } from "express";
import path from "node:path";
import { ZodError } from "zod";
import { config } from "./config.js";
import { query } from "./db.js";
import { DomainError } from "./domain/order-state.js";
import { apiRouter } from "./routes/index.js";

const publicDirectory = path.resolve(process.cwd(), "public");

export const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "256kb" }));
app.use((request, response, next) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "same-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; connect-src 'self'",
  );
  if (config.APP_ENV === "development") {
    response.setHeader("Access-Control-Allow-Origin", config.ALLOWED_ORIGIN);
    response.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Actor");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  }
  if (request.method === "OPTIONS") return response.sendStatus(204);
  next();
});

app.get("/api/health", async (_request, response) => {
  try {
    const result = await query<{ now: string }>("SELECT CURRENT_TIMESTAMP::text AS now");
    response.json({ status: "UP", service: "erp-pulse", database: "UP", timestamp: result[0]?.now });
  } catch {
    response.status(503).json({ status: "DOWN", service: "erp-pulse", database: "DOWN" });
  }
});

app.use("/api", apiRouter);
app.use(express.static(publicDirectory, { extensions: ["html"], maxAge: config.APP_ENV === "production" ? "1h" : 0 }));
app.use((request, response, next) => {
  if (request.method === "GET" && request.accepts("html")) {
    response.sendFile(path.join(publicDirectory, "index.html"));
    return;
  }
  next();
});

app.use((_request, response) => {
  response.status(404).json({ error: { code: "NOT_FOUND", message: "Recurso no encontrado." } });
});

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof DomainError) {
    response.status(error.statusCode).json({
      error: { code: error.code, message: error.message, details: error.details },
    });
    return;
  }
  if (error instanceof ZodError) {
    response.status(422).json({ error: { code: "VALIDATION_ERROR", message: "Datos inválidos.", details: error.flatten() } });
    return;
  }
  console.error(error);
  response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "No se pudo completar la operación." } });
};

app.use(errorHandler);
