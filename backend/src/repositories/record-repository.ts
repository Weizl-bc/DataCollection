import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../database/pool";
import type { ApiRecord, RecordPage } from "../types/record";
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

type RecordQuery = {
  page: number;
  pageSize: number;
  status?: string;
  taskRunId?: string;
  requestId?: string;
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
    requestParams: parseJson(row.request_params),
    responseData: parseJson(row.response_data),
    costMs: row.cost_ms,
    retryCount: row.retry_count,
    createdAt: row.created_at.toISOString(),
  };
}

function buildFilters(query: RecordQuery) {
  const filters = ["1 = 1"];
  const values: string[] = [];

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
