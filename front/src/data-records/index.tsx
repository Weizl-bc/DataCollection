import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Flex, Input, InputNumber, Pagination, Select, Space, Table, Tag, Typography, message } from "antd";
import type { TableColumnsType } from "antd";
import { frontendConfig } from "../config";
import { formatDate, getErrorMessage, getErrorText, getStatusColor, getStatusText } from "../shared/formatters";
import { createRecordExport, downloadRecordExport, getRecordCodeConfig, getRecordExport, getRecords, getRecordSearchOptions } from "./api";
import { RecordDetailModal } from "./components/record-detail-modal";
import type { ApiRecord, RecordCodeConfig, RecordPage, RecordQuery, RecordSearchOptions } from "./types";
import { parseJsonText } from "./utils";

type RecordFilters = Omit<RecordQuery, "page" | "pageSize">;
type DataRecordsPageProps = {
  apiRevision: number;
  darkMode: boolean;
  initialTaskRunId: string;
  onConnectionChange: (connected: boolean) => void;
};

const emptyFilters: RecordFilters = {
  status: frontendConfig.record.defaultStatus,
  taskRunId: "",
  requestId: "",
  businessFieldValue: "",
  businessType: "",
  businessYear: undefined,
  businessNumberStart: undefined,
  businessNumberEnd: undefined,
};

const statusOptions = [
  { label: "成功", value: "SUCCESS" },
  { label: "返回异常", value: "BIZ_ERROR" },
  { label: "网络异常", value: "HTTP_ERROR" },
  { label: "调用异常", value: "EXCEPTION" },
];

function getCertificateNumber(responseData: unknown) {
  const parsed = parseJsonText(responseData);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return "—";
  const record = parsed as Record<string, unknown>;
  const value = record[frontendConfig.record.certificateFieldLabel] ?? record[frontendConfig.record.certificateFieldKey];
  if (value === null || value === undefined || value === "") return "—";
  return typeof value === "string" || typeof value === "number" ? String(value) : JSON.stringify(value) ?? "—";
}

function formatCodePrefix(config: RecordCodeConfig | null, typeCode: string | undefined, year: number | undefined) {
  if (!config || !typeCode || year === undefined) return "—";
  return config.codeTemplate.replaceAll("{prefix}", config.codePrefix).replaceAll("{type}", typeCode).replaceAll("{year}", String(year)).replaceAll("{number}", "");
}

export default function DataRecordsPage({ apiRevision, darkMode, initialTaskRunId, onConnectionChange }: DataRecordsPageProps) {
  const pageSize = frontendConfig.pagination.recordDefaultPageSize;
  const initialFilters = { ...emptyFilters, taskRunId: initialTaskRunId };
  const [config, setConfig] = useState<RecordCodeConfig | null>(null);
  const [options, setOptions] = useState<RecordSearchOptions>({ types: [], years: [] });
  const [filters, setFilters] = useState<RecordFilters>(initialFilters);
  const [query, setQuery] = useState<RecordQuery>({ ...initialFilters, page: 1, pageSize });
  const [recordPage, setRecordPage] = useState<RecordPage>({ items: [], total: 0, page: 1, pageSize });
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<ApiRecord | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getRecordCodeConfig(), getRecordSearchOptions()]).then(([nextConfig, nextOptions]) => {
      if (cancelled) return;
      setConfig(nextConfig);
      setOptions(nextOptions);
      setFilters((current) => ({
        ...current,
        businessType: current.businessType || (nextOptions.types.includes(nextConfig.typeCode) ? nextConfig.typeCode : nextOptions.types[0] ?? ""),
        businessYear: current.businessYear ?? (nextOptions.years.includes(nextConfig.year) ? nextConfig.year : nextOptions.years[0]),
      }));
      onConnectionChange(true);
    }).catch(() => onConnectionChange(false));
    return () => { cancelled = true; };
  }, [apiRevision, onConnectionChange]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void getRecords(query).then((result) => {
        if (!cancelled) { setRecordPage(result); onConnectionChange(true); }
      }).catch((nextError: unknown) => {
        if (!cancelled) { setError(getErrorMessage(nextError)); onConnectionChange(false); }
      }).finally(() => { if (!cancelled) setLoading(false); });
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [apiRevision, onConnectionChange, query]);

  const selectedType = filters.businessType || (config && options.types.includes(config.typeCode) ? config.typeCode : options.types[0]);
  const selectedYear = filters.businessYear ?? (config && options.years.includes(config.year) ? config.year : options.years[0]);
  const codePrefix = useMemo(() => formatCodePrefix(config, selectedType, selectedYear), [config, selectedType, selectedYear]);

  const handleSearch = () => {
    const exactValue = filters.businessFieldValue?.trim() ?? "";
    const hasStart = filters.businessNumberStart !== undefined;
    const hasEnd = filters.businessNumberEnd !== undefined;
    if (hasStart !== hasEnd) return void messageApi.warning("请输入完整的业务编号范围");
    if (hasStart && hasEnd && (filters.businessNumberStart as number) > (filters.businessNumberEnd as number)) return void messageApi.warning("业务编号起始值不能大于结束值");
    if (hasStart && hasEnd && (!selectedType || selectedYear === undefined)) return void messageApi.warning("请选择业务类型和年份");
    if (exactValue && (hasStart || hasEnd)) return void messageApi.warning("精确搜索和范围搜索只能选择一种");
    setQuery({ ...filters, businessFieldValue: exactValue, businessType: selectedType, businessYear: selectedYear, page: 1, pageSize });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      let task = await createRecordExport(query);
      setExportProgress(task.progressPercent);
      messageApi.info(frontendConfig.record.exportRetentionNotice);
      while (task.status === "QUEUED" || task.status === "RUNNING") {
        await new Promise((resolve) => window.setTimeout(resolve, frontendConfig.record.exportPollIntervalMs));
        task = await getRecordExport(task.id);
        setExportProgress(task.progressPercent);
      }
      if (task.status === "FAILED") throw new Error(task.errorMessage || "导出任务执行失败");
      if (task.status === "EXPIRED") throw new Error("导出文件已过期，请重新导出");
      const { blob, fileName } = await downloadRecordExport(task.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      messageApi.success("导出已完成");
    } catch (nextError) {
      messageApi.error(getErrorMessage(nextError));
    } finally {
      setExporting(false);
      setExportProgress(null);
    }
  };

  const columns: TableColumnsType<ApiRecord> = useMemo(() => [
    { title: "任务编号", dataIndex: "taskRunId", key: "taskRunId", width: 280, ellipsis: true },
    { title: frontendConfig.record.certificateFieldLabel, key: "certificate", width: 180, ellipsis: true, render: (_: unknown, record) => getCertificateNumber(record.responseData) },
    { title: "数据是否有效", dataIndex: "callStatus", key: "callStatus", width: 110, render: (value: string) => <Tag color={getStatusColor(value)}>{getStatusText(value)}</Tag> },
    { title: "异常类型", dataIndex: "errorType", key: "errorType", width: 120, render: getErrorText },
    { title: "记录时间", dataIndex: "createdAt", key: "createdAt", width: 180, render: formatDate },
    { title: "操作", key: "action", fixed: "right", width: 90, render: (_: unknown, record) => <Button type="link" onClick={() => setSelectedRecord(record)}>详情</Button> },
  ], []);

  return <>
    {contextHolder}
    <Flex vertical gap={24}>
      <Flex align="center" justify="space-between" wrap gap={16}>
        <Typography.Title level={2} className="page-title">数据记录</Typography.Title>
        <Space><Button onClick={() => void handleExport()} loading={exporting}>{exporting && exportProgress !== null ? `${frontendConfig.record.exportButtonLabel} ${exportProgress}%` : frontendConfig.record.exportButtonLabel}</Button><Button onClick={() => setQuery((current) => ({ ...current }))} loading={loading}>刷新</Button></Space>
      </Flex>
      <Card className="panel-card record-filter-card"><Flex vertical gap={12}>
        <Flex wrap gap={12}>
          <Input value={filters.taskRunId} onChange={(event) => setFilters((current) => ({ ...current, taskRunId: event.target.value }))} onPressEnter={handleSearch} placeholder="任务编号" allowClear className="filter-input filter-id" />
          <Input value={filters.requestId} onChange={(event) => setFilters((current) => ({ ...current, requestId: event.target.value }))} onPressEnter={handleSearch} placeholder="请求编号" allowClear className="filter-input filter-id" />
          <Select value={filters.status || undefined} onChange={(value) => setFilters((current) => ({ ...current, status: value ?? "" }))} options={statusOptions} placeholder="调用状态" allowClear className="filter-select" />
        </Flex>
        <Flex align="center" wrap gap={12} className="business-filter-row">
          <Input value={filters.businessFieldValue} onChange={(event) => setFilters((current) => ({ ...current, businessFieldValue: event.target.value, businessNumberStart: undefined, businessNumberEnd: undefined }))} onPressEnter={handleSearch} placeholder="业务字段精确搜索" allowClear className="filter-input business-exact-input" />
          <Typography.Text className="business-range-label">或按编号范围：</Typography.Text>
          <Select value={selectedType || undefined} onChange={(value) => setFilters((current) => ({ ...current, businessType: value ?? "" }))} options={options.types.map((value) => ({ label: value, value }))} placeholder="类型" disabled={!options.types.length} className="business-select" />
          <Select value={selectedYear} onChange={(value) => setFilters((current) => ({ ...current, businessYear: value }))} options={options.years.map((value) => ({ label: String(value), value }))} placeholder="年份" disabled={!options.years.length} className="business-select" />
          <Typography.Text className="business-search-prefix">{codePrefix}</Typography.Text>
          <InputNumber min={0} precision={0} value={filters.businessNumberStart} onChange={(value) => setFilters((current) => ({ ...current, businessFieldValue: "", businessNumberStart: value ?? undefined }))} placeholder="起始编号" className="business-range-input" />
          <Typography.Text className="business-range-separator">至</Typography.Text>
          <InputNumber min={0} precision={0} value={filters.businessNumberEnd} onChange={(value) => setFilters((current) => ({ ...current, businessFieldValue: "", businessNumberEnd: value ?? undefined }))} placeholder="结束编号" className="business-range-input" />
          <Button type="primary" onClick={handleSearch}>查询</Button>
        </Flex>
      </Flex></Card>
      {error && <Alert type="error" showIcon message={error} />}
      <Card className="panel-card"><Table rowKey="id" size="middle" loading={loading} columns={columns} dataSource={recordPage.items} pagination={false} scroll={{ x: 1460 }} /><Flex justify="flex-end" className="table-pagination"><Pagination current={recordPage.page} pageSize={recordPage.pageSize} total={recordPage.total} showSizeChanger onChange={(page, nextPageSize) => setQuery((current) => ({ ...current, page, pageSize: nextPageSize }))} showTotal={(total) => `共 ${total} 条`} /></Flex></Card>
    </Flex>
    <RecordDetailModal record={selectedRecord} darkMode={darkMode} onClose={() => setSelectedRecord(null)} />
  </>;
}
