import { Alert, Modal, Progress, Tag, Typography } from "antd";
import { formatDate, getStatusColor, getStatusText } from "../../shared/formatters";
import { getTaskDetailLabel as getLabel } from "../labels";
import type { TaskSnapshot } from "../types";

function renderValue(key: string, value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (key.endsWith("Configured") && typeof value === "boolean") {
    return <Tag color={value ? "success" : "default"}>{value ? "已配置" : "未配置"}</Tag>;
  }
  const displayValue = String(value);
  const isLongText = typeof value === "string" && displayValue.length > 20;
  return <Typography.Text className={`task-detail-value ${isLongText ? "task-detail-value-ellipsis" : ""}`} ellipsis={isLongText ? { tooltip: displayValue } : undefined} copyable={isLongText}>{displayValue}</Typography.Text>;
}

function SectionIcon({ variant }: { variant: "overview" | "parameters" }) {
  return variant === "overview" ? (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9M10 19V5M16 19v-7M3 19h18" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 12h3M11 12h9M4 17h8M16 17h4" /><circle cx="16" cy="7" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="14" cy="17" r="2" /></svg>
  );
}

function TaskDetailContent({ task }: { task: TaskSnapshot }) {
  const progressStatus = task.status === "FAILED" ? "exception" : task.status === "COMPLETED" ? "success" : undefined;
  const parameterItems = Object.entries(task.config).map(([key, value]) => ({ key, label: getLabel(key), value: renderValue(key, value), wide: typeof value === "string" && value.length > 32 }));
  const summaryItems = [
    { key: "status", label: getLabel("status"), value: <Tag color={getStatusColor(task.status)}>{getStatusText(task.status)}</Tag> },
    { key: "startedAt", label: getLabel("startedAt"), value: formatDate(task.startedAt) },
    { key: "finishedAt", label: getLabel("finishedAt"), value: formatDate(task.finishedAt) },
    { key: "currentNo", label: getLabel("currentNo"), value: task.currentNo ?? "—" },
    { key: "currentCode", label: getLabel("currentCode"), value: task.currentCode ?? "—" },
  ];
  return <div className="task-detail-content">
    <section className="task-detail-overview">
      <header className="task-detail-card-header"><span className="task-detail-section-icon"><SectionIcon variant="overview" /></span><div className="task-detail-heading"><h3>{getLabel("sectionProgress")}</h3><div className="task-detail-id-line"><span>{getLabel("id")}</span><Typography.Text copyable={{ text: task.id }} className="task-detail-id">{task.id}</Typography.Text></div></div><Tag className="task-detail-status" color={getStatusColor(task.status)}>{getStatusText(task.status)}</Tag></header>
      <div className="task-detail-card-body">
        <div className="task-detail-progress"><div className="task-detail-progress-heading"><Typography.Text strong>{getLabel("progress")}</Typography.Text><Typography.Text className="task-detail-progress-value">{task.progressPercent}%</Typography.Text></div><Progress percent={task.progressPercent} status={progressStatus} showInfo={false} /></div>
        <div className="task-detail-metrics">
          <div className="task-detail-metric"><span className="task-detail-metric-label">{getLabel("totalCount")}</span><strong className="task-detail-metric-value">{task.totalCount}</strong></div>
          <div className="task-detail-metric"><span className="task-detail-metric-label">{getLabel("processedCount")}</span><strong className="task-detail-metric-value">{task.processedCount}</strong></div>
          <div className="task-detail-metric"><span className="task-detail-metric-label">{getLabel("successCount")}</span><strong className="task-detail-metric-value task-detail-metric-success">{task.successCount}</strong></div>
          <div className="task-detail-metric"><span className="task-detail-metric-label">{getLabel("failureCount")}</span><strong className="task-detail-metric-value task-detail-metric-failure">{task.failureCount}</strong></div>
        </div>
        <div className="task-detail-meta-grid">{summaryItems.map((item) => <div className="task-detail-meta-item" key={item.key}><span className="task-detail-meta-label">{item.label}</span><span className="task-detail-meta-value">{item.value}</span></div>)}</div>
      </div>
    </section>
    <section className="task-detail-parameters">
      <header className="task-detail-card-header"><span className="task-detail-section-icon"><SectionIcon variant="parameters" /></span><div className="task-detail-heading"><h3>{getLabel("sectionParameters")}</h3><span className="task-detail-section-summary">{parameterItems.length} 个字段</span></div></header>
      <div className="task-detail-card-body"><div className="task-detail-parameter-grid">{parameterItems.map((item) => <div className={`task-detail-parameter-item ${item.wide ? "task-detail-parameter-item-wide" : ""}`} key={item.key}><span className="task-detail-parameter-label">{item.label}</span><div className="task-detail-parameter-value">{item.value}</div></div>)}</div></div>
    </section>
    {task.lastError && <Alert className="task-detail-error" type="error" showIcon message={`${getLabel("lastError")}：${task.lastError}`} />}
    <Typography.Text type="secondary" className="task-detail-sensitive-note">{getLabel("sensitiveHint")}</Typography.Text>
  </div>;
}

export function TaskDetailModal({ task, darkMode, onClose }: { task: TaskSnapshot | null; darkMode: boolean; onClose: () => void }) {
  return <Modal title={getLabel("modalTitle")} open={Boolean(task)} onCancel={onClose} footer={null} width={880} className="task-detail-modal" rootClassName={`task-detail-modal-root ${darkMode ? "theme-dark" : "theme-light"}`}>
    {task && <TaskDetailContent task={task} />}
  </Modal>;
}
