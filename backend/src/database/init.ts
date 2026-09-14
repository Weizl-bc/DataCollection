import { pool } from "./pool";
import type { RowDataPacket } from "mysql2";

async function hasTable(tableName: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
    [tableName],
  );
  return Number(rows[0]?.total ?? 0) > 0;
}

async function hasColumn(tableName: string, columnName: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?",
    [tableName, columnName],
  );
  return Number(rows[0]?.total ?? 0) > 0;
}

async function hasIndex(tableName: string, indexName: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?",
    [tableName, indexName],
  );
  return Number(rows[0]?.total ?? 0) > 0;
}

async function createTaskTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS task_run (
      id CHAR(36) NOT NULL,
      status VARCHAR(20) NOT NULL,
      started_at DATETIME(3) NOT NULL,
      finished_at DATETIME(3) NULL,
      total_count INT UNSIGNED NOT NULL DEFAULT 0,
      processed_count INT UNSIGNED NOT NULL DEFAULT 0,
      success_count INT UNSIGNED NOT NULL DEFAULT 0,
      failure_count INT UNSIGNED NOT NULL DEFAULT 0,
      current_no INT NULL,
      current_code VARCHAR(255) NULL,
      config_json LONGTEXT NOT NULL,
      last_error TEXT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY idx_task_run_status_started_at (status, started_at),
      KEY idx_task_run_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function createTaskExecutionLockTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS task_execution_lock (
      id TINYINT UNSIGNED NOT NULL,
      task_id CHAR(36) NULL,
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(
    "INSERT IGNORE INTO task_execution_lock (id) VALUES (1)",
  );
}

async function createRecordTable() {
  if (await hasTable("api_call_record")) {
    return;
  }

  await pool.query(`
    CREATE TABLE api_call_record (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      task_run_id CHAR(36) NULL,
      sequence_no INT NULL,
      api_name VARCHAR(100) NOT NULL,
      api_url VARCHAR(500) NULL,
      http_method VARCHAR(10) NULL,
      request_id VARCHAR(64) NULL,
      caller VARCHAR(100) NULL,
      env VARCHAR(20) NULL,
      request_params JSON NULL,
      request_body JSON NULL,
      request_headers JSON NULL,
      http_status INT NULL,
      biz_code INT NULL,
      biz_msg VARCHAR(500) NULL,
      call_status VARCHAR(30) NOT NULL,
      error_type VARCHAR(100) NULL,
      error_message TEXT NULL,
      response_body JSON NULL,
      response_data JSON NULL,
      cost_ms INT NULL,
      retry_count INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_record_task_run_id (task_run_id),
      KEY idx_record_created_at (created_at),
      KEY idx_record_call_status_created_at (call_status, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function extendRecordTable() {
  if (!(await hasColumn("api_call_record", "task_run_id"))) {
    await pool.query(
      "ALTER TABLE api_call_record ADD COLUMN task_run_id CHAR(36) NULL AFTER id",
    );
  }

  if (!(await hasColumn("api_call_record", "sequence_no"))) {
    await pool.query(
      "ALTER TABLE api_call_record ADD COLUMN sequence_no INT NULL AFTER task_run_id",
    );
  }

  if (!(await hasIndex("api_call_record", "idx_record_task_run_id"))) {
    await pool.query(
      "ALTER TABLE api_call_record ADD INDEX idx_record_task_run_id (task_run_id)",
    );
  }
}

export async function initializeDatabase() {
  await pool.query("SELECT 1");
  await createTaskTable();
  await createTaskExecutionLockTable();
  await createRecordTable();
  await extendRecordTable();
}
