import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../database/pool";
import type {
  RecordExportStatus,
  RecordExportTask,
  RecordQuery,
} from "../types/record";

type ExportTaskRow = RowDataPacket & {
  id: string;
  status: RecordExportStatus;
  query_json: string;
  file_name: string;
  file_path: string | null;
  total_count: number;
  processed_count: number;
  error_message: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

function toTask(row: ExportTaskRow): RecordExportTask {
  return {
    id: row.id,
    status: row.status,
    query: JSON.parse(row.query_json) as RecordQuery,
    fileName: row.file_name,
    filePath: row.file_path,
    totalCount: Number(row.total_count),
    processedCount: Number(row.processed_count),
    errorMessage: row.error_message,
    startedAt: row.started_at?.toISOString() ?? null,
    completedAt: row.completed_at?.toISOString() ?? null,
    expiresAt: row.expires_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const selectColumns =
  "id, status, query_json, file_name, file_path, total_count, processed_count, error_message, started_at, completed_at, expires_at, created_at, updated_at";

export class RecordExportTaskRepository {
  async create(id: string, query: RecordQuery, fileName: string) {
    await pool.execute<ResultSetHeader>(
      "INSERT INTO record_export_task (id, status, query_json, file_name) VALUES (?, 'QUEUED', ?, ?)",
      [id, JSON.stringify(query), fileName],
    );
    return this.get(id);
  }

  async get(id: string) {
    const [rows] = await pool.query<ExportTaskRow[]>(
      `SELECT ${selectColumns} FROM record_export_task WHERE id = ? LIMIT 1`,
      [id],
    );
    return rows[0] ? toTask(rows[0]) : null;
  }

  async list(page: number, pageSize: number) {
    const offset = (page - 1) * pageSize;
    const [countRows] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM record_export_task",
    );
    const [rows] = await pool.query<ExportTaskRow[]>(
      `SELECT ${selectColumns} FROM record_export_task ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`,
    );
    return {
      items: rows.map(toTask),
      total: Number(countRows[0]?.total ?? 0),
      page,
      pageSize,
    };
  }

  async listRecoverable() {
    const [rows] = await pool.query<ExportTaskRow[]>(
      `SELECT ${selectColumns} FROM record_export_task WHERE status IN ('QUEUED', 'RUNNING') ORDER BY created_at ASC`,
    );
    return rows.map(toTask);
  }

  async markQueued(id: string) {
    await pool.execute(
      "UPDATE record_export_task SET status = 'QUEUED', file_path = NULL, error_message = NULL, started_at = NULL, completed_at = NULL, expires_at = NULL, processed_count = 0 WHERE id = ?",
      [id],
    );
  }

  async markRunning(id: string, totalCount: number, filePath: string) {
    await pool.execute(
      "UPDATE record_export_task SET status = 'RUNNING', total_count = ?, processed_count = 0, file_path = ?, error_message = NULL, started_at = CURRENT_TIMESTAMP(3), completed_at = NULL, expires_at = NULL WHERE id = ?",
      [totalCount, filePath, id],
    );
  }

  async updateProgress(id: string, processedCount: number) {
    await pool.execute(
      "UPDATE record_export_task SET processed_count = ? WHERE id = ? AND status = 'RUNNING'",
      [processedCount, id],
    );
  }

  async markCompleted(id: string, expiresAt: Date) {
    await pool.execute(
      "UPDATE record_export_task SET status = 'COMPLETED', processed_count = total_count, completed_at = CURRENT_TIMESTAMP(3), expires_at = ? WHERE id = ?",
      [expiresAt, id],
    );
  }

  async markFailed(id: string, message: string) {
    await pool.execute(
      "UPDATE record_export_task SET status = 'FAILED', error_message = ?, completed_at = CURRENT_TIMESTAMP(3) WHERE id = ?",
      [message, id],
    );
  }

  async listExpired(now: Date) {
    const [rows] = await pool.query<ExportTaskRow[]>(
      `SELECT ${selectColumns} FROM record_export_task WHERE status = 'COMPLETED' AND expires_at <= ?`,
      [now],
    );
    return rows.map(toTask);
  }

  async markExpired(id: string) {
    await pool.execute(
      "UPDATE record_export_task SET status = 'EXPIRED', file_path = NULL WHERE id = ?",
      [id],
    );
  }
}
