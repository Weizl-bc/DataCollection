import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import { settings } from "./config/settings";
import { HttpError } from "./errors";
import { createRecordRouter } from "./routes/record-routes";
import { createTaskRouter } from "./routes/task-routes";
import { RecordRepository } from "./repositories/record-repository";
import { RecordExportTaskRepository } from "./repositories/record-export-task-repository";
import { RecordExportService } from "./services/record-export-service";
import { TaskRepository } from "./repositories/task-repository";
import { NoticeService } from "./services/notice-service";
import { TaskManager } from "./services/task-manager";

const app = express();
const taskRepository = new TaskRepository();
const recordRepository = new RecordRepository();
const recordExportService = new RecordExportService(
  recordRepository,
  new RecordExportTaskRepository(),
);
const taskManager = new TaskManager(
  taskRepository,
  recordRepository,
  new NoticeService(),
);

app.use(
  cors({
    origin: settings.server.origins,
    exposedHeaders: ["Content-Disposition"],
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get("/api", (_request, response) => {
  response.json({ status: "ok" });
});

app.get("/api/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "backend",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/tasks", createTaskRouter(taskManager));
app.use(
  "/api/api_call_record",
  createRecordRouter(recordRepository, recordExportService),
);

app.use((_request, response) => {
  response.status(404).json({ message: "资源不存在" });
});

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  console.error(error);
  const statusCode = error instanceof HttpError ? error.statusCode : 500;
  const message = error instanceof HttpError ? error.message : "服务暂不可用";
  response.status(statusCode).json({ message });
};

app.use(errorHandler);

export { recordExportService, taskManager };
export default app;
