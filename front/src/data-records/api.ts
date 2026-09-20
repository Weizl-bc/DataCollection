import { frontendConfig } from "../config";
import { requestJson } from "../shared/api-client";
import type {
  RecordCodeConfig,
  RecordExportTask,
  RecordExportTaskPage,
  RecordPage,
  RecordQuery,
  RecordSearchOptions,
} from "./types";

function buildRecordQueryParams(query: RecordQuery, includePagination: boolean) {
  const params = new URLSearchParams(
    includePagination ? { page: String(query.page), pageSize: String(query.pageSize) } : {},
  );
  if (query.status) params.set("status", query.status);
  if (query.taskRunId) params.set("taskRunId", query.taskRunId);
  if (query.requestId) params.set("requestId", query.requestId);
  if (query.businessFieldValue) params.set("businessFieldValue", query.businessFieldValue);
  if (query.businessType) params.set("businessType", query.businessType);
  if (query.businessYear !== undefined) params.set("businessYear", String(query.businessYear));
  if (query.businessNumberStart !== undefined) {
    params.set("businessNumberStart", String(query.businessNumberStart));
  }
  if (query.businessNumberEnd !== undefined) {
    params.set("businessNumberEnd", String(query.businessNumberEnd));
  }
  return params;
}

export function getRecords(query: RecordQuery) {
  const params = buildRecordQueryParams(query, true);
  return requestJson<RecordPage>(`/api/api_call_record?${params.toString()}`);
}

export function getRecordSearchOptions() {
  return requestJson<RecordSearchOptions>("/api/api_call_record/options");
}

export async function getRecordCodeConfig() {
  const result = await requestJson<{ config: RecordCodeConfig }>("/api/tasks/config");
  return result.config;
}

export async function createRecordExport(query: RecordQuery) {
  const result = await requestJson<{ task: RecordExportTask }>(
    "/api/api_call_record/exports",
    { method: "POST", body: JSON.stringify(query) },
  );
  return result.task;
}

export async function getRecordExport(id: string) {
  const result = await requestJson<{ task: RecordExportTask }>(
    `/api/api_call_record/exports/${encodeURIComponent(id)}`,
  );
  return result.task;
}

export function getRecordExports(page: number, pageSize: number) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return requestJson<RecordExportTaskPage>(
    `/api/api_call_record/exports?${params.toString()}`,
  );
}

export async function downloadRecordExport(id: string) {
  const response = await fetch(
    `${frontendConfig.apiBaseUrl}/api/api_call_record/exports/${encodeURIComponent(id)}/download`,
  );
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message || "导出未完成");
  }
  const disposition = response.headers.get("content-disposition") ?? "";
  const matchedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  return {
    blob: await response.blob(),
    fileName: matchedName ? decodeURIComponent(matchedName) : "export.xlsx",
  };
}
