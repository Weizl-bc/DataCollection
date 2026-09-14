import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../database/pool";
import type {
  StoredTaskConfig,
  TaskSnapshot,
  TaskStatus,
} from "../types/task";

type TaskRow = RowDataPacket & {
  id: string;
  status: TaskStatus;
  started_at: Date;
  finished_at: Date | null;
  total_count: number;
  processed_count: number;
  success_count: number;
  failure_count: number;
  current_no: number | null;
  current_code: string | null;
  config_json: string;
  last_error: string | null;
};

type ProgressUpdate = {
  processedCount: number;
  successCount: number;
  failureCount: number;
  currentNo: number | null;
  currentCode: string | null;
};

function formatDate(value: Date | null) {
  return value ? value.toISOString() : null;
}

function parseConfig(value: string): StoredTaskConfig {
  return JSON.parse(value) as StoredTaskConfig;
}

function toSnapshot(row: TaskRow): TaskSnapshot {
  const progressPercent = row.total_count
    ? Math.min(100, Math.round((row.processed_count / row.total_count) * 100))
    : 100;

  return {
    id: row.id,
    status: row.status,
    startedAt: formatDate(row.started_at),
    finishedAt: formatDate(row.finished_at),
    totalCount: row.total_count,
    processedCount: row.processed_count,
    successCount: row.success_count,
    failureCount: row.failure_count,
    currentNo: row.current_no,
    currentCode: row.current_code,
    config: parseConfig(row.config_json),
    lastError: row.last_error,
    progressPercent,
  };
}

async function findOne(id: string) {
  const [rows] = await pool.query<TaskRow[]>(
    "SELECT id, status, started_at, finished_at, total_count, processed_count, success_count, failure_count, current_no, current_code, config_json, last_error FROM task_run WHERE id = ? LIMIT 1",
    [id],
  );
  return rows[0] ? toSnapshot(rows[0]) : null;
}

export class TaskRepository {
  async create(
    id: string,
    totalCount: number,
    config: StoredTaskConfig,
  ) {
    await pool.execute<ResultSetHeader>(
      "INSERT INTO task_run (id, status, started_at, total_count, config_json) VALUES (?, 'RUNNING', NOW(3), ?, ?)",
      [id, totalCount, JSON.stringify(config)],
    );
    return findOne(id);
  }

  async updateProgress(id: string, update: ProgressUpdate) {
    await pool.execute<ResultSetHeader>(
      "UPDATE task_run SET processed_count = ?, success_count = ?, failure_count = ?, current_no = ?, current_code = ?, updated_at = NOW(3) WHERE id = ?",
      [
        update.processedCount,
        update.successCount,
        update.failureCount,
        update.currentNo,
        update.currentCode,
        id,
      ],
    );
  }

  async finish(id: string, status: TaskStatus, lastError: string | null) {
    await pool.execute<ResultSetHeader>(
      "UPDATE task_run SET status = ?, finished_at = NOW(3), last_error = ?, updated_at = NOW(3) WHERE id = ?",
      [status, lastError, id],
    );
  }

  async getById(id: string) {
    return findOne(id);
  }

  async getActive() {
    const [rows] = await pool.query<TaskRow[]>(
      "SELECT id, status, started_at, finished_at, total_count, processed_count, success_count, failure_count, current_no, current_code, config_json, last_error FROM task_run WHERE status = 'RUNNING' ORDER BY started_at DESC LIMIT 1",
    );
    return rows[0] ? toSnapshot(rows[0]) : null;
  }

  async list(limit: number) {
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const [rows] = await pool.query<TaskRow[]>(
      `SELECT id, status, started_at, finished_at, total_count, processed_count, success_count, failure_count, current_no, current_code, config_json, last_error FROM task_run ORDER BY created_at DESC LIMIT ${safeLimit}`,
    );
    return rows.map(toSnapshot);
  }

  async markRunningAsFailed() {
    await pool.execute<ResultSetHeader>(
      "UPDATE task_run SET status = 'FAILED', finished_at = NOW(3), last_error = '服务已重启', updated_at = NOW(3) WHERE status = 'RUNNING'",
    );
  }
}
