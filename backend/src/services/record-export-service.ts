import { randomUUID } from "node:crypto";
import { mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { settings } from "../config/settings";
import { HttpError } from "../errors";
import { RecordExportTaskRepository } from "../repositories/record-export-task-repository";
import { RecordRepository } from "../repositories/record-repository";
import type {
  ApiRecord,
  RecordExportTask,
  RecordExportTaskView,
  RecordQuery,
} from "../types/record";

type ExportCellValue = string | number | boolean;

function flattenResponseData(
  value: unknown,
  target: Record<string, ExportCellValue>,
  currentPath = "",
) {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    for (const [key, nestedValue] of Object.entries(value)) {
      const label = settings.record.jsonFieldLabels[key] ?? key;
      if (/^[\x00-\x7F]+$/.test(label) && /[A-Za-z]/.test(label)) {
        throw new Error(`返回数据字段 ${key} 缺少中文名称配置`);
      }
      flattenResponseData(
        nestedValue,
        target,
        currentPath ? `${currentPath} / ${label}` : label,
      );
    }
    return;
  }

  if (!currentPath) return;
  target[currentPath] = Array.isArray(value)
    ? JSON.stringify(value)
    : value === null || value === undefined
      ? settings.record.export.emptyValue
      : typeof value === "string" || typeof value === "number" || typeof value === "boolean"
        ? value
        : JSON.stringify(value);
}

function formatExportDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: settings.record.export.timeZone,
  }).format(new Date(value));
}

function resolveManagedFilePath(filePath: string) {
  const resolvedPath = path.resolve(filePath);
  const exportRoot = `${path.resolve(settings.record.export.directory)}${path.sep}`;
  return resolvedPath.startsWith(exportRoot) ? resolvedPath : null;
}

function toView(task: RecordExportTask): RecordExportTaskView {
  return {
    id: task.id,
    status: task.status,
    fileName: task.fileName,
    totalCount: task.totalCount,
    processedCount: task.processedCount,
    errorMessage: task.errorMessage,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
    expiresAt: task.expiresAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    progressPercent:
      task.totalCount > 0
        ? Math.min(100, Math.round((task.processedCount / task.totalCount) * 100))
        : task.status === "COMPLETED"
          ? 100
          : 0,
    downloadReady: task.status === "COMPLETED" && Boolean(task.filePath),
  };
}

export class RecordExportService {
  private readonly queue: string[] = [];
  private readonly queuedIds = new Set<string>();
  private activeCount = 0;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly records: RecordRepository,
    private readonly tasks: RecordExportTaskRepository,
  ) {}

  async start() {
    await mkdir(settings.record.export.directory, { recursive: true });
    await this.cleanupExpiredFiles();
    const recoverableTasks = await this.tasks.listRecoverable();
    for (const task of recoverableTasks) {
      await this.tasks.markQueued(task.id);
      this.enqueue(task.id);
    }
    this.cleanupTimer = setInterval(
      () => void this.cleanupExpiredFiles(),
      settings.record.export.cleanupIntervalMs,
    );
    this.cleanupTimer.unref();
  }

  async create(query: RecordQuery) {
    const id = randomUUID();
    const task = await this.tasks.create(id, query, settings.record.export.fileName);
    if (!task) throw new Error("导出任务创建失败");
    this.enqueue(id);
    return toView(task);
  }

  async get(id: string) {
    const task = await this.tasks.get(id);
    if (!task) throw new HttpError(404, "导出任务不存在");
    return toView(task);
  }

  async list(page: number, pageSize: number) {
    const safePage = Math.max(1, Math.floor(page));
    const safePageSize = Math.max(
      1,
      Math.min(settings.record.export.taskMaxPageSize, Math.floor(pageSize)),
    );
    const result = await this.tasks.list(safePage, safePageSize);
    return { ...result, items: result.items.map(toView) };
  }

  async getDownload(id: string) {
    const task = await this.tasks.get(id);
    if (!task) throw new HttpError(404, "导出任务不存在");
    if (task.status === "EXPIRED" || (task.expiresAt && new Date(task.expiresAt) <= new Date())) {
      throw new HttpError(410, "导出文件已过期");
    }
    if (task.status !== "COMPLETED" || !task.filePath) {
      throw new HttpError(409, "导出文件尚未生成完成");
    }
    const resolvedPath = resolveManagedFilePath(task.filePath);
    if (!resolvedPath) {
      throw new HttpError(500, "导出文件路径不合法");
    }
    await stat(resolvedPath).catch(() => {
      throw new HttpError(410, "导出文件不存在或已清理");
    });
    return { filePath: resolvedPath, fileName: task.fileName };
  }

  private enqueue(id: string) {
    if (this.queuedIds.has(id)) return;
    this.queuedIds.add(id);
    this.queue.push(id);
    queueMicrotask(() => this.pump());
  }

  private pump() {
    while (
      this.activeCount < settings.record.export.concurrency &&
      this.queue.length > 0
    ) {
      const id = this.queue.shift();
      if (!id) return;
      this.queuedIds.delete(id);
      this.activeCount += 1;
      void this.run(id).finally(() => {
        this.activeCount -= 1;
        this.pump();
      });
    }
  }

  private async forEachBatch(
    query: RecordQuery,
    maxId: number,
    handler: (records: ApiRecord[]) => Promise<void> | void,
  ) {
    let afterId = 0;
    while (true) {
      const records = await this.records.listExportBatch(
        query,
        afterId,
        maxId,
        settings.record.export.batchSize,
      );
      if (records.length === 0) return;
      await handler(records);
      afterId = records[records.length - 1].id;
    }
  }

  private async run(id: string) {
    const task = await this.tasks.get(id);
    if (!task) return;
    const filePath = path.join(settings.record.export.directory, `${id}.xlsx`);
    try {
      await rm(filePath, { force: true });
      const { totalCount, maxId } = await this.records.getExportSummary(task.query);
      await this.tasks.markRunning(id, totalCount, filePath);

      const responseColumnSet = new Set<string>();
      await this.forEachBatch(task.query, maxId, (records) => {
        for (const record of records) {
          const flattened: Record<string, ExportCellValue> = {};
          flattenResponseData(record.responseData, flattened);
          Object.keys(flattened).forEach((label) => responseColumnSet.add(label));
        }
      });
      const certificateDataLabel =
        settings.record.jsonFieldLabels[settings.record.export.certificateFieldKey] ??
        settings.record.export.certificateLabel;
      const responseColumns = [...responseColumnSet].filter(
        (label) => label !== certificateDataLabel,
      );

      const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
        filename: filePath,
        useStyles: true,
      });
      const worksheet = workbook.addWorksheet(settings.record.export.sheetName, {
        views: [{ state: "frozen", ySplit: 1 }],
      });
      const columns = [
        { header: settings.record.export.taskIdLabel, key: "taskRunId", width: 30 },
        { header: settings.record.export.createdAtLabel, key: "createdAt", width: 22 },
        { header: settings.record.export.certificateLabel, key: "certificate", width: 24 },
        ...responseColumns.map((label, index) => ({
          header: label,
          key: `response_${index}`,
          width: 22,
        })),
      ];
      worksheet.columns = columns;
      const headerRow = worksheet.getRow(1);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true };
      });
      worksheet.autoFilter = {
        from: "A1",
        to: { row: 1, column: columns.length },
      };
      headerRow.commit();

      let processedCount = 0;
      await this.forEachBatch(task.query, maxId, async (records) => {
        for (const record of records) {
          const flattened: Record<string, ExportCellValue> = {};
          flattenResponseData(record.responseData, flattened);
          worksheet
            .addRow({
              taskRunId: record.taskRunId ?? settings.record.export.emptyValue,
              createdAt: formatExportDate(record.createdAt),
              certificate:
                flattened[certificateDataLabel] ?? settings.record.export.emptyValue,
              ...Object.fromEntries(
                responseColumns.map((label, index) => [
                  `response_${index}`,
                  flattened[label],
                ]),
              ),
            })
            .commit();
        }
        processedCount += records.length;
        await this.tasks.updateProgress(id, processedCount);
      });
      worksheet.commit();
      await workbook.commit();
      await this.tasks.markCompleted(
        id,
        new Date(Date.now() + settings.record.export.retentionMs),
      );
      const expiryTimer = setTimeout(
        () => void this.cleanupExpiredFiles(),
        settings.record.export.retentionMs,
      );
      expiryTimer.unref();
    } catch (error) {
      console.error("Record export task failed", {
        taskId: id,
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
      await rm(filePath, { force: true }).catch(() => undefined);
      await this.tasks.markFailed(
        id,
        error instanceof Error && error.message.startsWith("返回数据字段")
          ? error.message
          : settings.record.export.failureMessage,
      );
    }
  }

  private async cleanupExpiredFiles() {
    const expiredTasks = await this.tasks.listExpired(new Date());
    for (const task of expiredTasks) {
      if (task.filePath) {
        const managedPath = resolveManagedFilePath(task.filePath);
        if (managedPath) {
          await rm(managedPath, { force: true }).catch(() => undefined);
        }
      }
      await this.tasks.markExpired(task.id);
    }
  }
}
