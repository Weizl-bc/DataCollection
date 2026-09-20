import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Flex, Input, Layout, Menu, Spin, message } from "antd";
import { frontendConfig, loadFrontendConfig } from "../config";
import DataRecordsPage from "../data-records";
import RecordExportsPage from "../record-exports";
import { getErrorMessage } from "../shared/formatters";
import TaskManagementPage from "../task-management";
import "../App.css";

type ViewKey = "tasks" | "records" | "exports";

type AppProps = {
  darkMode: boolean;
  onToggleDarkMode: () => void;
};

export default function AppShell({ darkMode, onToggleDarkMode }: AppProps) {
  const [view, setView] = useState<ViewKey>("tasks");
  const [backendApiUrl, setBackendApiUrl] = useState(frontendConfig.apiBaseUrl);
  const [apiRevision, setApiRevision] = useState(0);
  const [connected, setConnected] = useState(true);
  const [recordTaskRunId, setRecordTaskRunId] = useState("");
  const [configReady, setConfigReady] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => { document.title = "数据任务台"; }, []);
  useEffect(() => {
    let cancelled = false;
    void loadFrontendConfig()
      .then(() => { if (!cancelled) setConfigReady(true); })
      .catch((error: unknown) => {
        if (!cancelled) setConfigError(getErrorMessage(error));
      });
    return () => { cancelled = true; };
  }, [apiRevision]);
  const handleConnectionChange = useCallback((nextConnected: boolean) => setConnected(nextConnected), []);
  const handleViewRecords = useCallback((taskRunId: string) => {
    setRecordTaskRunId(taskRunId);
    setView("records");
  }, []);
  const handleBackendApiUrlApply = (value: string) => {
    try {
      const nextUrl = frontendConfig.setApiBaseUrl(value);
      setBackendApiUrl(nextUrl);
      setConfigReady(false);
      setConfigError(null);
      setApiRevision((current) => current + 1);
      messageApi.success("后端接口地址已应用");
    } catch (error) {
      messageApi.error(getErrorMessage(error));
    }
  };

  return <Layout className={`app-layout ${darkMode ? "theme-dark" : "theme-light"}`}>
    {contextHolder}
    <Layout.Header className="app-header">
      <Flex align="center" className="header-inner" gap={24}>
        <span className="brand">数据任务台</span>
        <Menu className="main-menu" mode="horizontal" selectedKeys={[view]} items={[{ key: "tasks", label: "任务管理" }, { key: "records", label: "数据记录" }, { key: "exports", label: frontendConfig.record.exportPageLabels.menu }]} onClick={({ key }) => setView(key as ViewKey)} />
        <Badge className="connection-state" status={connected ? "success" : "error"} text={connected ? "连接正常" : "连接异常"} />
        <Button className="theme-toggle" onClick={onToggleDarkMode}>{darkMode ? "☀ 白天模式" : "☾ 黑夜模式"}</Button>
        <Input.Search value={backendApiUrl} onChange={(event) => setBackendApiUrl(event.target.value)} onSearch={handleBackendApiUrlApply} enterButton="应用" addonBefore="后端接口" className="backend-url-search" aria-label="后端接口地址" />
      </Flex>
    </Layout.Header>
    <Layout.Content className="app-content">
      <div className="page-shell">
        {configError ? <Alert type="error" showIcon message={configError} /> : !configReady ? <Flex justify="center"><Spin /></Flex> : view === "tasks" ? (
          <TaskManagementPage apiRevision={apiRevision} darkMode={darkMode} onConnectionChange={handleConnectionChange} onViewRecords={handleViewRecords} />
        ) : view === "records" ? (
          <DataRecordsPage key={recordTaskRunId} apiRevision={apiRevision} darkMode={darkMode} initialTaskRunId={recordTaskRunId} onConnectionChange={handleConnectionChange} />
        ) : (
          <RecordExportsPage apiRevision={apiRevision} onConnectionChange={handleConnectionChange} />
        )}
      </div>
    </Layout.Content>
  </Layout>;
}
