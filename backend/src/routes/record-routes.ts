import { Router } from "express";
import { settings } from "../config/settings";
import { HttpError } from "../errors";
import { RecordRepository } from "../repositories/record-repository";
import { RecordExportService } from "../services/record-export-service";

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

function readRecordQuery(query: Record<string, unknown>) {
  return {
    page: readNumber(query.page, 1),
    pageSize: readNumber(query.pageSize, 20),
    status: readText(query.status),
    taskRunId: readText(query.taskRunId),
    requestId: readText(query.requestId),
    businessFieldValue: readText(query.businessFieldValue),
    businessType: readText(query.businessType),
    businessYear: readOptionalNumber(query.businessYear),
    businessNumberStart: readOptionalNumber(query.businessNumberStart),
    businessNumberEnd: readOptionalNumber(query.businessNumberEnd),
  };
}

export function createRecordRouter(
  repository: RecordRepository,
  exportService: RecordExportService,
) {
  const router = Router();

  router.get("/options", (_request, response) => {
    response.json({
      types: settings.record.searchTypeOptions,
      years: settings.record.searchYearOptions,
    });
  });

  router.get("/", async (request, response) => {
    const result = await repository.list(readRecordQuery(request.query));
    response.json(result);
  });

  router.post("/exports", async (request, response) => {
    const task = await exportService.create(readRecordQuery(request.body ?? {}));
    response.status(202).json({ task });
  });

  router.get("/exports", async (request, response) => {
    response.json(
      await exportService.list(
        readNumber(request.query.page, 1),
        readNumber(
          request.query.pageSize,
          settings.record.export.taskDefaultPageSize,
        ),
      ),
    );
  });

  router.get("/exports/:id", async (request, response) => {
    response.json({ task: await exportService.get(request.params.id) });
  });

  router.get("/exports/:id/download", async (request, response) => {
    const file = await exportService.getDownload(request.params.id);
    const encodedFileName = encodeURIComponent(file.fileName);
    response.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodedFileName}`,
    );
    response.download(file.filePath, file.fileName);
  });

  return router;
}
