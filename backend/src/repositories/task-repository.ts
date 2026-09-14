import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../database/pool";
import { HttpError } from "../errors";
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

type TaskLockRow = RowDataPacket & {
  task_id: string | null;
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
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        "INSERT IGNORE INTO task_execution_lock (id) VALUES (1)",
      );

      const [lockRows] = await connection.query<TaskLockRow[]>(
        "SELECT task_id FROM task_execution_lock WHERE id = 1 FOR UPDATE",
      );
      const currentTaskId = lockRows[0]?.task_id ?? null;

      if (currentTaskId) {
        const [currentRows] = await connection.query<RowDataPacket[]>(
          "SELECT status FROM task_run WHERE id = ? LIMIT 1",
          [currentTaskId],
        );
        if (currentRows[0]?.status === "RUNNING") {
          throw new HttpError(409, "已有任务正在执行");
        }

        await connection.execute(
          "UPDATE task_execution_lock SET task_id = NULL WHERE id = 1 AND task_id = ?",
          [currentTaskId],
        );
      }

      const [runningRows] = await connection.query<RowDataPacket[]>(
        "SELECT id FROM task_run WHERE status = 'RUNNING' LIMIT 1 FOR UPDATE",
      );
      if (runningRows[0]) {
        throw new HttpError(409, "已有任务正在执行");
      }

      await connection.execute<ResultSetHeader>(
        "INSERT INTO task_run (id, status, started_at, total_count, config_json) VALUES (?, 'RUNNING', NOW(3), ?, ?)",
        [id, totalCount, JSON.stringify(config)],
      );
      const [lockResult] = await connection.execute<ResultSetHeader>(
        "UPDATE task_execution_lock SET task_id = ?, updated_at = NOW(3) WHERE id = 1 AND task_id IS NULL",
        [id],
      );
      if (lockResult.affectedRows !== 1) {
        throw new Error("任务锁占用失败");
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

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
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute<ResultSetHeader>(
        "UPDATE task_run SET status = ?, finished_at = NOW(3), last_error = ?, updated_at = NOW(3) WHERE id = ?",
        [status, lastError, id],
      );
      const [lockResult] = await connection.execute<ResultSetHeader>(
        "UPDATE task_execution_lock SET task_id = NULL, updated_at = NOW(3) WHERE id = 1 AND task_id = ?",
        [id],
      );
      if (lockResult.affectedRows !== 1) {
        throw new Error("任务锁释放失败");
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
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
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute<ResultSetHeader>(
        "UPDATE task_run SET status = 'FAILED', finished_at = NOW(3), last_error = '服务已重启', updated_at = NOW(3) WHERE status = 'RUNNING'",
      );
      await connection.execute(
        "UPDATE task_execution_lock SET task_id = NULL, updated_at = NOW(3) WHERE id = 1",
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
