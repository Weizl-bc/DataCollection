import { Alert, Descriptions, Modal } from "antd";
import { frontendConfig } from "../../config";
import { formatDate, getErrorText, getStatusText } from "../../shared/formatters";
import type { ApiRecord } from "../types";
import { parseJsonText } from "../utils";
import { RecordDataView } from "./record-data-view";

function getSummary(value: unknown) {
  const parsed = parseJsonText(value);
  if (Array.isArray(parsed)) return `${parsed.length} 项`;
  if (typeof parsed === "object" && parsed !== null) return `${Object.keys(parsed).length} 个字段`;
  return parsed === null || parsed === undefined || parsed === "" ? "暂无内容" : "单项内容";
}

function PayloadSection({ title, variant, value }: { title: string; variant: "request" | "response"; value: unknown }) {
  return (
    <section className={`record-payload-section record-payload-section-${variant}`}>
      <header className="record-payload-header">
        <span className="record-payload-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d={variant === "request" ? "M7 17 17 7M9 7h8v8" : "m7 7 10 10M15 17h-8V9"} /></svg></span>
        <div className="record-payload-heading"><h3>{title}</h3><span>{getSummary(value)}</span></div>
      </header>
      <div className="record-payload-body"><RecordDataView value={value} mode={variant} /></div>
    </section>
  );
}

export function RecordDetailModal({ record, darkMode, onClose }: { record: ApiRecord | null; darkMode: boolean; onClose: () => void }) {
  return (
    <Modal title="记录详情" open={Boolean(record)} onCancel={onClose} footer={null} width={920} className="record-detail-modal" rootClassName={`record-detail-modal-root ${darkMode ? "theme-dark" : "theme-light"}`}>
      {record && <div className="record-detail-content">
        <div className="record-detail-summary"><Descriptions size="small" column={{ xs: 1, sm: 2 }} items={[
          { key: "id", label: "编号", children: record.id },
          { key: "taskRunId", label: "任务编号", children: record.taskRunId ?? "—" },
          { key: "sequenceNo", label: "序号", children: record.sequenceNo ?? "—" },
          { key: "requestId", label: "请求编号", children: record.requestId ?? "—" },
          { key: "httpStatus", label: "状态码", children: record.httpStatus ?? "—" },
          { key: "bizCode", label: "返回码", children: record.bizCode ?? "—" },
          { key: "callStatus", label: "调用状态", children: getStatusText(record.callStatus) },
          { key: "errorType", label: "异常类型", children: getErrorText(record.errorType) },
          { key: "costMs", label: "耗时（毫秒）", children: record.costMs ?? "—" },
          { key: "createdAt", label: "记录时间", children: formatDate(record.createdAt) },
        ]} /></div>
        {record.errorMessage && <Alert type="error" showIcon message={record.errorMessage} />}
        <PayloadSection title={frontendConfig.record.detailSectionLabels.request} variant="request" value={record.requestParams} />
        <PayloadSection title={frontendConfig.record.detailSectionLabels.response} variant="response" value={record.responseData} />
      </div>}
    </Modal>
  );
}
