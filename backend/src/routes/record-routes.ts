import { Router } from "express";
import { RecordRepository } from "../repositories/record-repository";

function readText(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function readNumber(value: unknown, fallback: number) {
  const parsed = Number(readText(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function createRecordRouter(repository: RecordRepository) {
  const router = Router();

  router.get("/", async (request, response) => {
    const result = await repository.list({
      page: readNumber(request.query.page, 1),
      pageSize: readNumber(request.query.pageSize, 20),
      status: readText(request.query.status),
      taskRunId: readText(request.query.taskRunId),
      requestId: readText(request.query.requestId),
    });
    response.json(result);
  });

  return router;
}
