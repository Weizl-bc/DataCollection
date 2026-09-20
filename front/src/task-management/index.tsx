import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Card, Col, Descriptions, Empty, Flex, Form, Input, InputNumber, Progress, Row, Space, Spin, Statistic, Table, Tag, Typography, message } from "antd";
import type { TableColumnsType } from "antd";
import { frontendConfig } from "../config";
import { formatDate, getErrorMessage, getStatusColor, getStatusText } from "../shared/formatters";
import { getActiveTask, getTaskConfig, getTasks, startTask, stopTask, subscribeTask } from "./api";
import { TaskDetailModal } from "./components/task-detail-modal";
import { getTaskDetailLabel } from "./labels";
import type { TaskConfigInput, TaskConfigView, TaskSnapshot } from "./types";

type TaskManagementPageProps = {
  apiRevision: number;
  darkMode: boolean;
  onConnectionChange: (connected: boolean) => void;
  onViewRecords: (taskRunId: string) => void;
};

function formatCode(config: TaskConfigView | null, typeCode: string | undefined, year: number | undefined, value: number | undefined) {
  if (!config || !typeCode || !year || value === undefined) return "—";
  return config.codeTemplate.replaceAll("{prefix}", config.codePrefix).replaceAll("{type}", typeCode).replaceAll("{year}", String(year)).replaceAll("{number}", String(value));
}

export default function TaskManagementPage({ apiRevision, darkMode, onConnectionChange, onViewRecords }: TaskManagementPageProps) {
  const [form] = Form.useForm<TaskConfigInput>();
  const [config, setConfig] = useState<TaskConfigView | null>(null);
  const [tasks, setTasks] = useState<TaskSnapshot[]>([]);
  const [activeTask, setActiveTask] = useState<TaskSnapshot | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const startRequestRef = useRef(false);
  const [stopping, setStopping] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const watchedStartNo = Form.useWatch("startNo", form);
  const watchedEndNo = Form.useWatch("endNo", form);
  const watchedYear = Form.useWatch("year", form);
  const watchedTypeCode = Form.useWatch("typeCode", form);

  const selectedTask = useMemo(() => selectedTaskId ? tasks.find((item) => item.id === selectedTaskId) ?? null : null, [selectedTaskId, tasks]);
  const codeRange = useMemo(() => {
    const first = formatCode(config, watchedTypeCode ?? config?.typeCode, watchedYear ?? config?.year, watchedStartNo ?? config?.startNo);
    const last = formatCode(config, watchedTypeCode ?? config?.typeCode, watchedYear ?? config?.year, watchedEndNo ?? config?.endNo);
    return first === "—" || last === "—" ? "—" : `${first} ~ ${last}`;
  }, [config, watchedEndNo, watchedStartNo, watchedTypeCode, watchedYear]);

  const refreshHistory = useCallback(async () => {
    setTasks(await getTasks(frontendConfig.task.historyLimit));
  }, []);

  const loadInitial = useCallback(async () => {
    setPageLoading(true);
    setLoadError(null);
    try {
      const [nextConfig, nextTasks, nextActive] = await Promise.all([
        getTaskConfig(),
        getTasks(frontendConfig.task.historyLimit),
        getActiveTask(),
      ]);
      setConfig(nextConfig);
      form.setFieldsValue(nextConfig);
      setTasks(nextTasks);
      setActiveTask(nextActive);
      onConnectionChange(true);
    } catch (error) {
      setLoadError(getErrorMessage(error));
      onConnectionChange(false);
    } finally {
      setPageLoading(false);
    }
  }, [form, onConnectionChange]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadInitial(), 0);
    return () => window.clearTimeout(timer);
  }, [apiRevision, loadInitial]);

  useEffect(() => {
    if (!activeTask?.id || activeTask.status !== "RUNNING") return;
    return subscribeTask(activeTask.id, (nextTask) => {
      setActiveTask(nextTask);
      setTasks((current) => current.some((item) => item.id === nextTask.id) ? current.map((item) => item.id === nextTask.id ? nextTask : item) : [nextTask, ...current]);
      if (nextTask.status !== "RUNNING") void refreshHistory();
    }, (error) => setRealtimeError(error.message));
  }, [activeTask?.id, activeTask?.status, refreshHistory]);

  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      try {
        const nextActive = await getActiveTask();
        if (cancelled) return;
        setActiveTask(nextActive);
        if (nextActive) setTasks((current) => current.some((item) => item.id === nextActive.id) ? current.map((item) => item.id === nextActive.id ? nextActive : item) : [nextActive, ...current]);
      } catch { /* 初始加载与实时连接负责展示错误。 */ }
    };
    const timer = window.setInterval(() => void sync(), frontendConfig.task.activePollIntervalMs);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [apiRevision]);

  const handleStart = async (values: TaskConfigInput) => {
    if (startRequestRef.current || starting) return;
    startRequestRef.current = true;
    setStarting(true);
    setLoadError(null);
    setRealtimeError(null);
    try {
      const existingTask = await getActiveTask();
      if (existingTask) {
        setActiveTask(existingTask);
        setTasks((current) => [existingTask, ...current.filter((item) => item.id !== existingTask.id)]);
        messageApi.warning("已有任务正在执行，请等待当前任务完成");
        return;
      }
      const task = await startTask(values);
      setActiveTask(task);
      setTasks((current) => [task, ...current.filter((item) => item.id !== task.id)]);
      messageApi.success("任务已启动");
    } catch (error) {
      const existingTask = await getActiveTask().catch(() => null);
      if (existingTask) {
        setActiveTask(existingTask);
        setTasks((current) => [existingTask, ...current.filter((item) => item.id !== existingTask.id)]);
      }
      messageApi.error(getErrorMessage(error));
    } finally {
      startRequestRef.current = false;
      setStarting(false);
    }
  };

  const handleStop = async () => {
    if (!activeTask) return;
    setStopping(true);
    try {
      const task = await stopTask(activeTask.id);
      if (task) setActiveTask(task);
      messageApi.success("已发送停止请求");
    } catch (error) {
      messageApi.error(getErrorMessage(error));
    } finally {
      setStopping(false);
    }
  };

  const columns: TableColumnsType<TaskSnapshot> = useMemo(() => [
    { title: "任务编号", dataIndex: "id", key: "id", width: 280, ellipsis: true },
    { title: "状态", dataIndex: "status", key: "status", width: 100, render: (value: string) => <Tag color={getStatusColor(value)}>{getStatusText(value)}</Tag> },
    { title: "开始时间", dataIndex: "startedAt", key: "startedAt", width: 180, render: formatDate },
    { title: "结束时间", dataIndex: "finishedAt", key: "finishedAt", width: 180, render: formatDate },
    { title: "总数", dataIndex: "totalCount", key: "totalCount", width: 90 },
    { title: "已处理", dataIndex: "processedCount", key: "processedCount", width: 90 },
    { title: "成功", dataIndex: "successCount", key: "successCount", width: 80 },
    { title: "失败", dataIndex: "failureCount", key: "failureCount", width: 80 },
    { title: "进度", dataIndex: "progressPercent", key: "progressPercent", width: 130, render: (value: number) => <Progress percent={value} size="small" /> },
    { title: "操作", key: "action", fixed: "right", width: 160, render: (_: unknown, record) => <Space size={0}><Button type="link" onClick={() => setSelectedTaskId(record.id)}>{getTaskDetailLabel("actionViewDetail")}</Button><Button type="link" onClick={() => onViewRecords(record.id)}>查看记录</Button></Space> },
  ], [onViewRecords]);
  const running = activeTask?.status === "RUNNING";

  return <>
    {contextHolder}
    <Flex vertical gap={24}>
      {loadError && <Alert type="error" showIcon closable message={loadError} action={<Button onClick={() => void loadInitial()}>重试</Button>} />}
      <Flex align="center" justify="space-between" wrap gap={16}>
        <Typography.Title level={2} className="page-title">任务管理</Typography.Title>
        <Space><Button onClick={() => void loadInitial()} loading={pageLoading}>刷新</Button><Button type="primary" onClick={() => void form.submit()} loading={starting} disabled={running || starting || pageLoading}>启动任务</Button></Space>
      </Flex>
      <Row gutter={[24, 24]}>
        <Col xs={24} xl={14}>
          <Card title={getTaskDetailLabel("sectionParameters")} className="panel-card"><Spin spinning={pageLoading && !config}>
            <Form form={form} layout="vertical" onFinish={(values) => void handleStart(values)} className="task-form">
              <Row gutter={16}>
                <Col xs={24} sm={12}><Form.Item label="起始序号" name="startNo" rules={[{ required: true, message: "请输入起始序号" }]}><InputNumber min={0} precision={0} className="full-width" /></Form.Item></Col>
                <Col xs={24} sm={12}><Form.Item label="结束序号" name="endNo" rules={[{ required: true, message: "请输入结束序号" }]}><InputNumber min={0} precision={0} className="full-width" /></Form.Item></Col>
                <Col xs={24} sm={12}><Form.Item label="年份" name="year" rules={[{ required: true, message: "请输入年份" }]}><InputNumber min={1970} max={2200} precision={0} className="full-width" /></Form.Item></Col>
                <Col xs={24} sm={12}><Form.Item label="截止时间" name="stopHour" rules={[{ required: true, message: "请输入截止时间" }]}><InputNumber min={0} max={23} precision={0} className="full-width" /></Form.Item></Col>
                <Col xs={24} sm={12}><Form.Item label="类型编号" name="typeCode" rules={[{ required: true, message: "请输入类型编号" }]}><Input /></Form.Item></Col>
              </Row>
              <Card size="small" className="code-preview-card" title="编码范围"><Typography.Text className="code-preview-value">{codeRange}</Typography.Text></Card>
              <Form.Item label="访问凭据" name="accessToken" extra={config?.accessTokenConfigured ? "已配置" : "未配置"}><Input.Password placeholder="留空使用服务端配置" /></Form.Item>
              {(["valueField", "itemField", "environment", "caller"] as const).map((name) => <Form.Item name={name} hidden key={name}><Input /></Form.Item>)}
            </Form>
          </Spin></Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card title="当前任务" className="panel-card current-card" extra={activeTask ? <Tag color={getStatusColor(activeTask.status)}>{getStatusText(activeTask.status)}</Tag> : null}>
            {activeTask ? <Flex vertical gap={24}>
              <Row gutter={[16, 16]}><Col span={12}><Statistic title="总数" value={activeTask.totalCount} /></Col><Col span={12}><Statistic title="已处理" value={activeTask.processedCount} /></Col><Col span={12}><Statistic title="成功" value={activeTask.successCount} valueStyle={{ color: "#6ee7b7" }} /></Col><Col span={12}><Statistic title="失败" value={activeTask.failureCount} valueStyle={{ color: "#ff9b9b" }} /></Col></Row>
              <Progress percent={activeTask.progressPercent} status={activeTask.status === "FAILED" ? "exception" : undefined} />
              <Descriptions size="small" column={1} items={[{ key: "id", label: "任务编号", children: activeTask.id }, { key: "startedAt", label: "开启时间", children: formatDate(activeTask.startedAt) }, { key: "currentNo", label: "当前序号", children: activeTask.currentNo ?? "—" }, { key: "currentCode", label: "当前编码", children: activeTask.currentCode ?? "—" }]} />
              {activeTask.lastError && <Alert type="error" showIcon message={activeTask.lastError} />}
              {realtimeError && running && <Alert type="warning" showIcon message={realtimeError} />}
              {running && <Button danger onClick={() => void handleStop()} loading={stopping}>停止任务</Button>}
            </Flex> : <Empty description="暂无任务" />}
          </Card>
        </Col>
      </Row>
      <Card title="任务记录" className="panel-card" extra={<Button onClick={() => void refreshHistory()}>刷新</Button>}><Table rowKey="id" size="middle" loading={pageLoading} columns={columns} dataSource={tasks} pagination={false} scroll={{ x: 1430 }} /></Card>
    </Flex>
    <TaskDetailModal task={selectedTask} darkMode={darkMode} onClose={() => setSelectedTaskId(null)} />
  </>;
}
