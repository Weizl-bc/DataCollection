import cors from "cors";
import "dotenv/config";
import express, { type ErrorRequestHandler } from "express";

const app = express();
const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
  }),
);
app.use(express.json());

app.get("/api", (_request, response) => {
  response.json({
    name: "agDataCollection API",
    message: "API is running",
  });
});

app.get("/api/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "backend",
    timestamp: new Date().toISOString(),
  });
});

app.use((_request, response) => {
  response.status(404).json({
    message: "Resource not found",
  });
});

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({
    message: "Internal server error",
  });
};

app.use(errorHandler);

export default app;
