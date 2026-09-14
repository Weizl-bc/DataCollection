import { Router } from "express";
import { settings } from "../config/settings";
import { HttpError } from "../errors";
import { RecordRepository } from "../repositories/record-repository";

function readText(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function readNumber(value: unknown, fallback: number) {
  const parsed = Number(readText(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readOptionalNumber(value: unknown) {
  const text = readText(value);
  if (!text) {
    return undefined;
  }

  const parsed = Number(text);
  if (!Number.isFinite(parsed)) {
    throw new HttpError(400, "查询参数不合法");
  }

  return parsed;
}

export function createRecordRouter(repository: RecordRepository) {
  const router = Router();

  router.get("/options", (_request, response) => {
    response.json({
      types: settings.record.searchTypeOptions,
      years: settings.record.searchYearOptions,
    });
  });

  router.get("/", async (request, response) => {
    const result = await repository.list({
      page: readNumber(request.query.page, 1),
      pageSize: readNumber(request.query.pageSize, 20),
      status: readText(request.query.status),
      taskRunId: readText(request.query.taskRunId),
      requestId: readText(request.query.requestId),
      businessFieldValue: readText(request.query.businessFieldValue),
      businessType: readText(request.query.businessType),
      businessYear: readOptionalNumber(request.query.businessYear),
      businessNumberStart: readOptionalNumber(request.query.businessNumberStart),
      businessNumberEnd: readOptionalNumber(request.query.businessNumberEnd),
    });
    response.json(result);
  });

  return router;
}
