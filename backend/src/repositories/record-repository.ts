import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../database/pool";
import { settings } from "../config/settings";
import { HttpError } from "../errors";
import type { ApiRecord, RecordPage, RecordQuery } from "../types/record";
import type { CallResult } from "../types/task";

type RecordRow = RowDataPacket & {
  id: number;
  task_run_id: string | null;
  sequence_no: number | null;
  api_name: string;
  request_id: string | null;
  http_method: string | null;
  http_status: number | null;
  biz_code: number | null;
  biz_msg: string | null;
  call_status: string;
  error_type: string | null;
  error_message: string | null;
  request_params: string | null;
  response_data: string | null;
  cost_ms: number | null;
  retry_count: number;
  created_at: Date;
};

function parseJson(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function localizeJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => localizeJson(item));
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        settings.record.jsonFieldLabels[key] ?? key,
        localizeJson(nestedValue),
      ]),
    );
  }

  return value;
}

function getBusinessSearchSettings() {
  const jsonPath = settings.record.searchJsonPath.trim();
  const numberWidth = settings.record.searchNumberWidth;

  if (!jsonPath || !Number.isInteger(numberWidth) || numberWidth < 1) {
    throw new HttpError(500, "业务字段搜索配置不完整");
  }

  return { jsonPath, numberWidth };
}

function formatBusinessSearchValue(
  value: number,
  typeCode: string | undefined,
  year: number | undefined,
) {
  const { numberWidth } = getBusinessSearchSettings();
  const maxValue = 10 ** numberWidth - 1;

  if (!Number.isInteger(value) || value < 0 || value > maxValue) {
    throw new HttpError(400, "业务编号范围不合法");
  }

  const numberValue = String(value).padStart(numberWidth, "0");
  return settings.task.codeTemplate
    .replaceAll("{prefix}", settings.task.codePrefix)
    .replaceAll("{type}", typeCode ?? settings.task.typeCode)
    .replaceAll("{year}", String(year ?? settings.task.year))
    .replaceAll("{number}", numberValue);
}

function normalizeBusinessSearchValue(
  value: string,
  typeCode: string | undefined,
  year: number | undefined,
) {
  const { numberWidth } = getBusinessSearchSettings();
  const fixedPrefix = settings.task.codeTemplate
    .replaceAll("{prefix}", settings.task.codePrefix)
    .replaceAll("{type}", typeCode ?? settings.task.typeCode)
    .replaceAll("{year}", String(year ?? settings.task.year))
    .replaceAll("{number}", "");
  const numberValue = value.startsWith(fixedPrefix)
    ? value.slice(fixedPrefix.length)
    : "";

  if (!/^\d+$/.test(numberValue)) {
    return value;
  }

  const parsedNumber = Number(numberValue);
  if (!Number.isSafeInteger(parsedNumber) || numberValue.length > numberWidth) {
    return value;
  }

  return formatBusinessSearchValue(parsedNumber, typeCode, year);
}

function validateBusinessSearchSelection(
  typeCode: string | undefined,
  year: number | undefined,
) {
  const resolvedTypeCode = typeCode?.trim() || settings.task.typeCode;
  const resolvedYear = year ?? settings.task.year;

  if (!settings.record.searchTypeOptions.includes(resolvedTypeCode)) {
    throw new HttpError(400, "业务类型不合法");
  }
  if (!settings.record.searchYearOptions.includes(resolvedYear)) {
    throw new HttpError(400, "业务年份不合法");
  }

  return { typeCode: resolvedTypeCode, year: resolvedYear };
}

function toRecord(row: RecordRow): ApiRecord {
  return {
    id: row.id,
    taskRunId: row.task_run_id,
    sequenceNo: row.sequence_no,
    apiName: row.api_name,
    requestId: row.request_id,
    httpMethod: row.http_method,
    httpStatus: row.http_status,
    bizCode: row.biz_code,
    bizMsg: row.biz_msg,
    callStatus: row.call_status,
    errorType: row.error_type,
    errorMessage: row.error_message,
    requestParams: localizeJson(parseJson(row.request_params)),
    responseData: localizeJson(parseJson(row.response_data)),
    costMs: row.cost_ms,
    retryCount: row.retry_count,
    createdAt: row.created_at.toISOString(),
  };
}

function buildFilters(query: RecordQuery) {
  const filters = ["1 = 1"];
  const values: Array<string | number> = [];

  if (query.status) {
    filters.push("call_status = ?");
    values.push(query.status);
  }
  if (query.taskRunId) {
    filters.push("task_run_id = ?");
    values.push(query.taskRunId);
  }
  if (query.requestId) {
    filters.push("request_id = ?");
    values.push(query.requestId);
  }

  const rawExactValue = query.businessFieldValue?.trim() ?? "";
  const exactValue = rawExactValue
    ? normalizeBusinessSearchValue(rawExactValue, query.businessType, query.businessYear)
    : "";
  const hasRangeStart = query.businessNumberStart !== undefined;
  const hasRangeEnd = query.businessNumberEnd !== undefined;

  if (exactValue && (hasRangeStart || hasRangeEnd)) {
    throw new HttpError(400, "精确搜索和范围搜索只能选择一种");
  }

  if (hasRangeStart !== hasRangeEnd) {
    throw new HttpError(400, "业务编号范围必须同时提供起始值和结束值");
  }

  if (exactValue || (hasRangeStart && hasRangeEnd)) {
    const { jsonPath } = getBusinessSearchSettings();
    const jsonValue = "JSON_UNQUOTE(JSON_EXTRACT(response_data, ?))";

    if (exactValue) {
      filters.push(`${jsonValue} = ?`);
      values.push(jsonPath, exactValue);
    } else {
      const selection = validateBusinessSearchSelection(
        query.businessType,
        query.businessYear,
      );
      const startValue = query.businessNumberStart as number;
      const endValue = query.businessNumberEnd as number;
      if (startValue > endValue) {
        throw new HttpError(400, "业务编号起始值不能大于结束值");
      }

      filters.push(`${jsonValue} BETWEEN ? AND ?`);
      values.push(
        jsonPath,
        formatBusinessSearchValue(startValue, selection.typeCode, selection.year),
        formatBusinessSearchValue(endValue, selection.typeCode, selection.year),
      );
    }
  }

  return { where: filters.join(" AND "), values };
}

export class RecordRepository {
  async insert(taskRunId: string, sequenceNo: number, result: CallResult) {
    await pool.execute<ResultSetHeader>(
      "INSERT INTO api_call_record (task_run_id, sequence_no, api_name, api_url, http_method, request_id, caller, env, request_params, request_body, request_headers, http_status, biz_code, biz_msg, call_status, error_type, error_message, response_body, response_data, cost_ms, retry_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        taskRunId,
        sequenceNo,
        result.apiName,
        result.apiUrl,
        result.httpMethod,
        result.requestId,
        result.caller,
        result.environment,
        JSON.stringify(result.requestParams),
        result.requestBody ? JSON.stringify(result.requestBody) : null,
        result.requestHeaders ? JSON.stringify(result.requestHeaders) : null,
        result.httpStatus,
        result.bizCode,
        result.bizMsg,
        result.callStatus,
        result.errorType,
        result.errorMessage,
        result.responseBody ? JSON.stringify(result.responseBody) : null,
        result.responseData ? JSON.stringify(result.responseData) : null,
        result.costMs,
        result.retryCount,
      ],
    );
  }

  async list(query: RecordQuery): Promise<RecordPage> {
    const page = Math.max(1, Math.floor(query.page));
    const pageSize = Math.max(1, Math.min(100, Math.floor(query.pageSize)));
    const offset = (page - 1) * pageSize;
    const filters = buildFilters(query);
    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM api_call_record WHERE ${filters.where}`,
      filters.values,
    );
    const [rows] = await pool.query<RecordRow[]>(
      `SELECT id, task_run_id, sequence_no, api_name, request_id, http_method, http_status, biz_code, biz_msg, call_status, error_type, error_message, request_params, response_data, cost_ms, retry_count, created_at FROM api_call_record WHERE ${filters.where} ORDER BY id DESC LIMIT ${pageSize} OFFSET ${offset}`,
      filters.values,
    );

    return {
      items: rows.map(toRecord),
      total: Number(countRows[0]?.total ?? 0),
      page,
      pageSize,
    };
  }
}
