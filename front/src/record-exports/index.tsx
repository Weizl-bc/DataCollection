import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Flex,
  Pagination,
  Progress,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { TableColumnsType } from "antd";
import { frontendConfig } from "../config";
import { downloadRecordExport, getRecordExports } from "../data-records/api";
import type {
  RecordExportTask,
  RecordExportTaskPage,
} from "../data-records/types";
import { formatDate, getErrorMessage } from "../shared/formatters";

type RecordExportsPageProps = {
  apiRevision: number;
  onConnectionChange: (connected: boolean) => void;
};

const labels = frontendConfig.record.exportPageLabels;

const exportStatusColors: Record<RecordExportTask["status"], string> = {
  QUEUED: "default",
  RUNNING: "processing",
  COMPLETED: "success",
  FAILED: "error",
  EXPIRED: "warning",
};

const exportStatusLabels: Record<RecordExportTask["status"], string> = {
  QUEUED: labels.statusQueued,
  RUNNING: labels.statusRunning,
  COMPLETED: labels.statusCompleted,
  FAILED: labels.statusFailed,
  EXPIRED: labels.statusExpired,
};

function saveFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export default function RecordExportsPage({
  apiRevision,
  onConnectionChange,
}: RecordExportsPageProps) {
  const pageSize = frontendConfig.record.exportTaskPageSize;
  const [query, setQuery] = useState({ page: 1, pageSize });
  const [taskPage, setTaskPage] = useState<RecordExportTaskPage>({
    items: [],
    total: 0,
    page: 1,
    pageSize,
  });
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshRevision, setRefreshRevision] = useState(0);
  const [messageApi, contextHolder] = message.useMessage();

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getRecordExports(query.page, query.pageSize);
      setTaskPage(result);
      onConnectionChange(true);
    } catch (nextError) {
      setError(getErrorMessage(nextError));
      onConnectionChange(false);
    } finally {
      setLoading(false);
    }
  }, [onConnectionChange, query.page, query.pageSize]);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void loadTasks(), 0);
    const timer = window.setInterval(
      () => void loadTasks(),
      frontendConfig.record.exportListPollIntervalMs,
    );
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [apiRevision, loadTasks, refreshRevision]);

  const handleDownload = useCallback(
    async (task: RecordExportTask) => {
      setDownloadingId(task.id);
      try {
        const file = await downloadRecordExport(task.id);
        saveFile(file.blob, file.fileName);
        messageApi.success(labels.downloadSuccess);
        onConnectionChange(true);
      } catch (nextError) {
        messageApi.error(getErrorMessage(nextError));
        onConnectionChange(false);
        void loadTasks();
      } finally {
        setDownloadingId(null);
      }
    },
    [loadTasks, messageApi, onConnectionChange],
  );

  const columns: TableColumnsType<RecordExportTask> = useMemo(
    () => [
      {
        title: labels.taskId,
        dataIndex: "id",
        key: "id",
        width: 285,
        ellipsis: true,
      },
      {
        title: labels.fileName,
        dataIndex: "fileName",
        key: "fileName",
        width: 180,
        ellipsis: true,
      },
      {
        title: labels.status,
        dataIndex: "status",
        key: "status",
        width: 100,
        render: (status: RecordExportTask["status"]) => (
          <Tag color={exportStatusColors[status]}>{exportStatusLabels[status]}</Tag>
        ),
      },
      {
        title: labels.progress,
        dataIndex: "progressPercent",
        key: "progressPercent",
        width: 150,
        render: (value: number, task) => (
          <Progress
            percent={value}
            size="small"
            status={task.status === "FAILED" ? "exception" : undefined}
          />
        ),
      },
      {
        title: labels.totalCount,
        dataIndex: "totalCount",
        key: "totalCount",
        width: 110,
      },
      {
        title: labels.createdAt,
        dataIndex: "createdAt",
        key: "createdAt",
        width: 180,
        render: formatDate,
      },
      {
        title: labels.completedAt,
        dataIndex: "completedAt",
        key: "completedAt",
        width: 180,
        render: formatDate,
      },
      {
        title: labels.expiresAt,
        dataIndex: "expiresAt",
        key: "expiresAt",
        width: 180,
        render: formatDate,
      },
      {
        title: labels.errorMessage,
        dataIndex: "errorMessage",
        key: "errorMessage",
        width: 220,
        ellipsis: true,
        render: (value: string | null) => value || "—",
      },
      {
        title: labels.action,
        key: "action",
        fixed: "right",
        width: 100,
        render: (_value, task) => (
          <Button
            type="link"
            disabled={!task.downloadReady}
            loading={downloadingId === task.id}
            onClick={() => void handleDownload(task)}
          >
            {labels.download}
          </Button>
        ),
      },
    ],
    [downloadingId, handleDownload],
  );

  return (
    <>
      {contextHolder}
      <Flex vertical gap={24}>
        <Flex align="center" justify="space-between" wrap gap={16}>
          <Typography.Title level={2} className="page-title">
            {labels.title}
          </Typography.Title>
          <Space>
            <Button
              onClick={() => setRefreshRevision((current) => current + 1)}
              loading={loading}
            >
              {labels.refresh}
            </Button>
          </Space>
        </Flex>
        <Alert type="warning" showIcon message={labels.retentionAlert} />
        {error && <Alert type="error" showIcon message={error} />}
        <Card className="panel-card">
          <Table
            rowKey="id"
            size="middle"
            loading={loading}
            columns={columns}
            dataSource={taskPage.items}
            pagination={false}
            scroll={{ x: 1685 }}
          />
          <Flex justify="flex-end" className="table-pagination">
            <Pagination
              current={taskPage.page}
              pageSize={taskPage.pageSize}
              total={taskPage.total}
              showSizeChanger
              onChange={(page, nextPageSize) => setQuery({ page, pageSize: nextPageSize })}
              showTotal={(total) => labels.totalTemplate.replace("{total}", String(total))}
            />
          </Flex>
        </Card>
      </Flex>
    </>
  );
}
