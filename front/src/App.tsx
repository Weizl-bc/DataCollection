import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Flex,
  Form,
  Input,
  InputNumber,
  Layout,
  Menu,
  Modal,
  Pagination,
  Progress,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  getActiveTask,
  getRecords,
  getTaskConfig,
  getTasks,
  startTask,
  stopTask,
  subscribeTask,
  type ApiRecord,
  type RecordPage,
  type TaskConfigInput,
  type TaskConfigView,
  type TaskSnapshot,
} from "./api";
import "./App.css";

type ViewKey = "tasks" | "records";

const statusText: Record<string, string> = {
  RUNNING: "执行中",
  COMPLETED: "已完成",
  STOPPED: "已停止",
  FAILED: "执行失败",
  SUCCESS: "成功",
  BIZ_ERROR: "返回异常",
  HTTP_ERROR: "网络异常",
  EXCEPTION: "调用异常",
};

const statusColor: Record<string, string> = {
  RUNNING: "processing",
  COMPLETED: "success",
  STOPPED: "warning",
  FAILED: "error",
  SUCCESS: "success",
  BIZ_ERROR: "warning",
  HTTP_ERROR: "error",
  EXCEPTION: "error",
};

const errorText: Record<string, string> = {
  timeout: "请求超时",
  connect_error: "连接异常",
  http_error: "网络状态异常",
  unknown_error: "未知异常",
};

const recordStatusOptions = [
  { label: "成功", value: "SUCCESS" },
  { label: "返回异常", value: "BIZ_ERROR" },
  { label: "网络异常", value: "HTTP_ERROR" },
  { label: "调用异常", value: "EXCEPTION" },
];

const initialRecordQuery = {
  page: 1,
  pageSize: 20,
  status: "",
  taskRunId: "",
  requestId: "",
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求未完成";
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatJson(value: unknown) {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value, null, 2) ?? "—";
}

function getStatusText(value: string | null | undefined) {
  return value ? statusText[value] ?? "未知状态" : "—";
}

function getStatusColor(value: string | null | undefined) {
  return value ? statusColor[value] ?? "default" : "default";
}

function getErrorText(value: string | null) {
  return value ? errorText[value] ?? value : "—";
}

function formatCode(
  config: TaskConfigView | null,
  typeCode: string | undefined,
  year: number | undefined,
  value: number | undefined,
) {
  if (!config || !typeCode || !year || value === undefined) {
    return "—";
  }

  return config.codeTemplate
    .replaceAll("{prefix}", config.codePrefix)
    .replaceAll("{type}", typeCode)
    .replaceAll("{year}", String(year))
    .replaceAll("{number}", String(value));
}

function App() {
  const [form] = Form.useForm<TaskConfigInput>();
  const [view, setView] = useState<ViewKey>("tasks");
  const [config, setConfig] = useState<TaskConfigView | null>(null);
  const [tasks, setTasks] = useState<TaskSnapshot[]>([]);
  const [activeTask, setActiveTask] = useState<TaskSnapshot | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const [recordFilters, setRecordFilters] = useState({
    status: "",
    taskRunId: "",
    requestId: "",
  });
  const [recordQuery, setRecordQuery] = useState(initialRecordQuery);
  const [recordPage, setRecordPage] = useState<RecordPage>({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
  });
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<ApiRecord | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const watchedStartNo = Form.useWatch("startNo", form);
  const watchedEndNo = Form.useWatch("endNo", form);
  const watchedYear = Form.useWatch("year", form);
  const watchedTypeCode = Form.useWatch("typeCode", form);

  const codeRange = useMemo(() => {
    const start = watchedStartNo ?? config?.startNo;
    const end = watchedEndNo ?? config?.endNo;
    const year = watchedYear ?? config?.year;
    const typeCode = watchedTypeCode ?? config?.typeCode;
    const first = formatCode(config, typeCode, year, start);
    const last = formatCode(config, typeCode, year, end);
    return first === "—" || last === "—" ? "—" : `${first} ~ ${last}`;
  }, [config, watchedEndNo, watchedStartNo, watchedTypeCode, watchedYear]);

  const refreshHistory = useCallback(async () => {
    const items = await getTasks();
    setTasks(items);
  }, []);

  const loadInitial = useCallback(async () => {
    setPageLoading(true);
    setLoadError(null);
    try {
      const [nextConfig, nextTasks, nextActive] = await Promise.all([
        getTaskConfig(),
        getTasks(),
        getActiveTask(),
      ]);
      setConfig(nextConfig);
      form.setFieldsValue(nextConfig);
      setTasks(nextTasks);
      setActiveTask(nextActive);
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setPageLoading(false);
    }
  }, [form]);

  useEffect(() => {
    document.title = "数据任务台";
    const timer = window.setTimeout(() => void loadInitial(), 0);
    return () => window.clearTimeout(timer);
  }, [loadInitial]);

  const activeTaskId = activeTask?.id;
  const activeTaskStatus = activeTask?.status;

  useEffect(() => {
    if (!activeTaskId || activeTaskStatus !== "RUNNING") {
      return;
    }

    return subscribeTask(
      activeTaskId,
      (nextTask) => {
        setActiveTask(nextTask);
        setTasks((current) => {
          const exists = current.some((item) => item.id === nextTask.id);
          return exists
            ? current.map((item) => (item.id === nextTask.id ? nextTask : item))
            : [nextTask, ...current];
        });
        if (nextTask.status !== "RUNNING") {
          void refreshHistory();
        }
      },
      (error) => setRealtimeError(error.message),
    );
  }, [activeTaskId, activeTaskStatus, refreshHistory]);

  useEffect(() => {
    if (view !== "records") {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setRecordLoading(true);
      setRecordError(null);
      void getRecords(recordQuery)
        .then((result) => {
          if (!cancelled) {
            setRecordPage(result);
          }
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setRecordError(getErrorMessage(error));
          }
        })
        .finally(() => {
          if (!cancelled) {
            setRecordLoading(false);
          }
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [recordQuery, view]);

  const handleStart = async (values: TaskConfigInput) => {
    setStarting(true);
    setLoadError(null);
    setRealtimeError(null);
    try {
      const task = await startTask(values);
      setActiveTask(task);
      setTasks((current) => [task, ...current.filter((item) => item.id !== task.id)]);
      messageApi.success("任务已启动");
    } catch (error) {
      messageApi.error(getErrorMessage(error));
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async () => {
    if (!activeTask) {
      return;
    }

    setStopping(true);
    try {
      const task = await stopTask(activeTask.id);
      if (task) {
        setActiveTask(task);
      }
      messageApi.success("已发送停止请求");
    } catch (error) {
      messageApi.error(getErrorMessage(error));
    } finally {
      setStopping(false);
    }
  };

  const handleRecordSearch = () => {
    setRecordQuery({ ...recordFilters, page: 1, pageSize: 20 });
  };

  const handleRecordPageChange = (page: number, pageSize: number) => {
    setRecordQuery((current) => ({ ...current, page, pageSize }));
  };

  const handleViewRecords = (taskRunId: string) => {
    const nextFilters = { status: "", taskRunId, requestId: "" };
    setRecordFilters(nextFilters);
    setRecordQuery({ ...nextFilters, page: 1, pageSize: 20 });
    setView("records");
  };

  const taskColumns: TableColumnsType<TaskSnapshot> = useMemo(
    () => [
      {
        title: "任务编号",
        dataIndex: "id",
        key: "id",
        width: 280,
        ellipsis: true,
      },
      {
        title: "状态",
        dataIndex: "status",
        key: "status",
        width: 100,
        render: (value: string) => (
          <Tag color={getStatusColor(value)}>{getStatusText(value)}</Tag>
        ),
      },
      {
        title: "开始时间",
        dataIndex: "startedAt",
        key: "startedAt",
        width: 180,
        render: (value: string | null) => formatDate(value),
      },
      {
        title: "结束时间",
        dataIndex: "finishedAt",
        key: "finishedAt",
        width: 180,
        render: (value: string | null) => formatDate(value),
      },
      {
        title: "总数",
        dataIndex: "totalCount",
        key: "totalCount",
        width: 90,
      },
      {
        title: "已处理",
        dataIndex: "processedCount",
        key: "processedCount",
        width: 90,
      },
      {
        title: "成功",
        dataIndex: "successCount",
        key: "successCount",
        width: 80,
      },
      {
        title: "失败",
        dataIndex: "failureCount",
        key: "failureCount",
        width: 80,
      },
      {
        title: "进度",
        dataIndex: "progressPercent",
        key: "progressPercent",
        width: 130,
        render: (value: number) => <Progress percent={value} size="small" />,
      },
      {
        title: "操作",
        key: "action",
        fixed: "right",
        width: 90,
        render: (_value: unknown, record: TaskSnapshot) => (
          <Button type="link" onClick={() => handleViewRecords(record.id)}>
            查看
          </Button>
        ),
      },
    ],
    [],
  );

  const recordColumns: TableColumnsType<ApiRecord> = useMemo(
    () => [
      { title: "编号", dataIndex: "id", key: "id", width: 90 },
      {
        title: "任务编号",
        dataIndex: "taskRunId",
        key: "taskRunId",
        width: 280,
        ellipsis: true,
      },
      { title: "序号", dataIndex: "sequenceNo", key: "sequenceNo", width: 90 },
      {
        title: "请求编号",
        dataIndex: "requestId",
        key: "requestId",
        width: 280,
        ellipsis: true,
      },
      { title: "状态码", dataIndex: "httpStatus", key: "httpStatus", width: 90 },
      { title: "返回码", dataIndex: "bizCode", key: "bizCode", width: 90 },
      {
        title: "调用状态",
        dataIndex: "callStatus",
        key: "callStatus",
        width: 110,
        render: (value: string) => (
          <Tag color={getStatusColor(value)}>{getStatusText(value)}</Tag>
        ),
      },
      {
        title: "异常类型",
        dataIndex: "errorType",
        key: "errorType",
        width: 120,
        render: (value: string | null) => getErrorText(value),
      },
      { title: "耗时（毫秒）", dataIndex: "costMs", key: "costMs", width: 120 },
      {
        title: "记录时间",
        dataIndex: "createdAt",
        key: "createdAt",
        width: 180,
        render: (value: string) => formatDate(value),
      },
      {
        title: "操作",
        key: "action",
        fixed: "right",
        width: 90,
        render: (_value: unknown, record: ApiRecord) => (
          <Button type="link" onClick={() => setSelectedRecord(record)}>
            详情
          </Button>
        ),
      },
    ],
    [],
  );

  const running = activeTask?.status === "RUNNING";

  return (
    <Layout className="app-layout">
      {contextHolder}
      <Layout.Header className="app-header">
        <Flex align="center" className="header-inner" gap={24}>
          <Typography.Text className="brand">数据任务台</Typography.Text>
          <Menu
            className="main-menu"
            mode="horizontal"
            selectedKeys={[view]}
            items={[
              { key: "tasks", label: "任务管理" },
              { key: "records", label: "数据记录" },
            ]}
            onClick={({ key }) => setView(key as ViewKey)}
          />
          <Badge
            className="connection-state"
            status={loadError ? "error" : "success"}
            text={loadError ? "连接异常" : "连接正常"}
          />
        </Flex>
      </Layout.Header>

      <Layout.Content className="app-content">
        <div className="page-shell">
          {loadError && (
            <Alert
              type="error"
              showIcon
              closable
              message={loadError}
              action={<Button onClick={() => void loadInitial()}>重试</Button>}
            />
          )}

          {view === "tasks" ? (
            <Flex vertical gap={24}>
              <Flex align="center" justify="space-between" wrap gap={16}>
                <Typography.Title level={2} className="page-title">
                  任务管理
                </Typography.Title>
                <Space>
                  <Button onClick={() => void loadInitial()} loading={pageLoading}>
                    刷新
                  </Button>
                  <Button
                    type="primary"
                    onClick={() => void form.submit()}
                    loading={starting}
                    disabled={running || pageLoading}
                  >
                    启动任务
                  </Button>
                </Space>
              </Flex>

              <Row gutter={[24, 24]}>
                <Col xs={24} xl={14}>
                  <Card title="任务参数" className="panel-card">
                    <Spin spinning={pageLoading && !config}>
                      <Form
                        form={form}
                        layout="vertical"
                        onFinish={(values) => void handleStart(values)}
                        className="task-form"
                      >
                        <Row gutter={16}>
                          <Col xs={24} sm={12}>
                            <Form.Item
                              label="起始序号"
                              name="startNo"
                              rules={[{ required: true, message: "请输入起始序号" }]}
                            >
                              <InputNumber min={0} precision={0} className="full-width" />
                            </Form.Item>
                          </Col>
                          <Col xs={24} sm={12}>
                            <Form.Item
                              label="结束序号"
                              name="endNo"
                              rules={[{ required: true, message: "请输入结束序号" }]}
                            >
                              <InputNumber min={0} precision={0} className="full-width" />
                            </Form.Item>
                          </Col>
                          <Col xs={24} sm={12}>
                            <Form.Item
                              label="年份"
                              name="year"
                              rules={[{ required: true, message: "请输入年份" }]}
                            >
                              <InputNumber min={1970} max={2200} precision={0} className="full-width" />
                            </Form.Item>
                          </Col>
                          <Col xs={24} sm={12}>
                            <Form.Item
                              label="截止时间"
                              name="stopHour"
                              rules={[{ required: true, message: "请输入截止时间" }]}
                            >
                              <InputNumber min={0} max={23} precision={0} className="full-width" />
                            </Form.Item>
                          </Col>
                          <Col xs={24} sm={12}>
                            <Form.Item
                              label="类型编号"
                              name="typeCode"
                              rules={[{ required: true, message: "请输入类型编号" }]}
                            >
                              <Input />
                            </Form.Item>
                          </Col>
                        </Row>

                        <Card size="small" className="code-preview-card" title="编码范围">
                          <Typography.Text className="code-preview-value">
                            {codeRange}
                          </Typography.Text>
                        </Card>

                        <Form.Item
                          label="访问凭据"
                          name="accessToken"
                          extra={config?.accessTokenConfigured ? "已配置" : "未配置"}
                        >
                          <Input.Password placeholder="留空使用服务端配置" />
                        </Form.Item>

                        <Form.Item name="valueField" hidden>
                          <Input />
                        </Form.Item>
                        <Form.Item name="itemField" hidden>
                          <Input />
                        </Form.Item>
                        <Form.Item name="environment" hidden>
                          <Input />
                        </Form.Item>
                        <Form.Item name="caller" hidden>
                          <Input />
                        </Form.Item>
                      </Form>
                    </Spin>
                  </Card>
                </Col>

                <Col xs={24} xl={10}>
                  <Card
                    title="当前任务"
                    className="panel-card current-card"
                    extra={
                      activeTask ? (
                        <Tag color={getStatusColor(activeTask.status)}>
                          {getStatusText(activeTask.status)}
                        </Tag>
                      ) : null
                    }
                  >
                    {activeTask ? (
                      <Flex vertical gap={24}>
                        <Row gutter={[16, 16]}>
                          <Col span={12}>
                            <Statistic title="总数" value={activeTask.totalCount} />
                          </Col>
                          <Col span={12}>
                            <Statistic title="已处理" value={activeTask.processedCount} />
                          </Col>
                          <Col span={12}>
                            <Statistic title="成功" value={activeTask.successCount} valueStyle={{ color: "#6ee7b7" }} />
                          </Col>
                          <Col span={12}>
                            <Statistic title="失败" value={activeTask.failureCount} valueStyle={{ color: "#ff9b9b" }} />
                          </Col>
                        </Row>
                        <Progress
                          percent={activeTask.progressPercent}
                          status={activeTask.status === "FAILED" ? "exception" : undefined}
                        />
                        <Descriptions
                          size="small"
                          column={1}
                          items={[
                            { key: "id", label: "任务编号", children: activeTask.id },
                            { key: "startedAt", label: "开启时间", children: formatDate(activeTask.startedAt) },
                            { key: "currentNo", label: "当前序号", children: activeTask.currentNo ?? "—" },
                            { key: "currentCode", label: "当前编码", children: activeTask.currentCode ?? "—" },
                          ]}
                        />
                        {activeTask.lastError && (
                          <Alert type="error" showIcon message={activeTask.lastError} />
                        )}
                        {realtimeError && running && (
                          <Alert type="warning" showIcon message={realtimeError} />
                        )}
                        {running && (
                          <Button danger onClick={() => void handleStop()} loading={stopping}>
                            停止任务
                          </Button>
                        )}
                      </Flex>
                    ) : (
                      <Empty description="暂无任务" />
                    )}
                  </Card>
                </Col>
              </Row>

              <Card
                title="任务记录"
                className="panel-card"
                extra={<Button onClick={() => void refreshHistory()}>刷新</Button>}
              >
                <Table
                  rowKey="id"
                  size="middle"
                  loading={pageLoading}
                  columns={taskColumns}
                  dataSource={tasks}
                  pagination={false}
                  scroll={{ x: 1360 }}
                />
              </Card>
            </Flex>
          ) : (
            <Flex vertical gap={24}>
              <Flex align="center" justify="space-between" wrap gap={16}>
                <Typography.Title level={2} className="page-title">
                  数据记录
                </Typography.Title>
                <Button onClick={() => setRecordQuery((current) => ({ ...current }))} loading={recordLoading}>
                  刷新
                </Button>
              </Flex>

              <Card className="panel-card record-filter-card">
                <Flex wrap gap={12}>
                  <Input
                    value={recordFilters.taskRunId}
                    onChange={(event) => setRecordFilters((current) => ({ ...current, taskRunId: event.target.value }))}
                    onPressEnter={handleRecordSearch}
                    placeholder="任务编号"
                    allowClear
                    className="filter-input filter-id"
                  />
                  <Input
                    value={recordFilters.requestId}
                    onChange={(event) => setRecordFilters((current) => ({ ...current, requestId: event.target.value }))}
                    onPressEnter={handleRecordSearch}
                    placeholder="请求编号"
                    allowClear
                    className="filter-input filter-id"
                  />
                  <Select
                    value={recordFilters.status || undefined}
                    onChange={(value) => setRecordFilters((current) => ({ ...current, status: value ?? "" }))}
                    options={recordStatusOptions}
                    placeholder="调用状态"
                    allowClear
                    className="filter-select"
                  />
                  <Button type="primary" onClick={handleRecordSearch}>
                    查询
                  </Button>
                </Flex>
              </Card>

              {recordError && <Alert type="error" showIcon message={recordError} />}

              <Card className="panel-card">
                <Table
                  rowKey="id"
                  size="middle"
                  loading={recordLoading}
                  columns={recordColumns}
                  dataSource={recordPage.items}
                  pagination={false}
                  scroll={{ x: 1460 }}
                />
                <Flex justify="flex-end" className="table-pagination">
                  <Pagination
                    current={recordPage.page}
                    pageSize={recordPage.pageSize}
                    total={recordPage.total}
                    showSizeChanger
                    onChange={handleRecordPageChange}
                    showTotal={(total) => `共 ${total} 条`}
                  />
                </Flex>
              </Card>
            </Flex>
          )}
        </div>
      </Layout.Content>

      <Modal
        title="记录详情"
        open={Boolean(selectedRecord)}
        onCancel={() => setSelectedRecord(null)}
        footer={null}
        width={760}
      >
        {selectedRecord && (
          <Flex vertical gap={20}>
            <Descriptions
              size="small"
              column={{ xs: 1, sm: 2 }}
              items={[
                { key: "id", label: "编号", children: selectedRecord.id },
                { key: "taskRunId", label: "任务编号", children: selectedRecord.taskRunId ?? "—" },
                { key: "sequenceNo", label: "序号", children: selectedRecord.sequenceNo ?? "—" },
                { key: "requestId", label: "请求编号", children: selectedRecord.requestId ?? "—" },
                { key: "httpStatus", label: "状态码", children: selectedRecord.httpStatus ?? "—" },
                { key: "bizCode", label: "返回码", children: selectedRecord.bizCode ?? "—" },
                { key: "callStatus", label: "调用状态", children: getStatusText(selectedRecord.callStatus) },
                { key: "errorType", label: "异常类型", children: getErrorText(selectedRecord.errorType) },
                { key: "costMs", label: "耗时（毫秒）", children: selectedRecord.costMs ?? "—" },
                { key: "createdAt", label: "记录时间", children: formatDate(selectedRecord.createdAt) },
              ]}
            />
            {selectedRecord.errorMessage && (
              <Alert type="error" message={selectedRecord.errorMessage} />
            )}
            <Flex vertical gap={8}>
              <Typography.Text strong>请求参数</Typography.Text>
              <pre className="json-view">{formatJson(selectedRecord.requestParams)}</pre>
            </Flex>
            <Flex vertical gap={8}>
              <Typography.Text strong>返回数据</Typography.Text>
              <pre className="json-view">{formatJson(selectedRecord.responseData)}</pre>
            </Flex>
          </Flex>
        )}
      </Modal>
    </Layout>
  );
}

export default App;
