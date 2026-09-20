import { useState, type ReactNode } from "react";
import { Button, Flex, Image, Tag, Typography } from "antd";
import { frontendConfig } from "../../config";
import { parseJsonText } from "../utils";

function formatJson(value: unknown) {
  return JSON.stringify(parseJsonText(value), null, 2) ?? "—";
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getStructuredDataSummary(value: unknown) {
  if (Array.isArray(value)) return `${value.length} 项`;
  if (isJsonObject(value)) return `${Object.keys(value).length} 个字段`;
  return "单项内容";
}

function isOssImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const parsedUrl = new URL(value.trim());
    return parsedUrl.protocol === "https:" && /\.(?:png|jpe?g)$/i.test(parsedUrl.pathname);
  } catch {
    return false;
  }
}

function isDetailedResponseValue(value: unknown) {
  return Array.isArray(value) || isJsonObject(value) || isOssImageUrl(value);
}

function OssImageValue({ value, alt }: { value: string; alt: string }) {
  return (
    <div className="oss-image-value">
      <div className="oss-image-frame">
        <Image className="oss-image-preview" src={value} alt={alt} preview={{ mask: "查看大图" }} />
      </div>
      <Typography.Text className="oss-image-url" ellipsis={{ tooltip: value }} copyable={{ text: value }}>
        {value}
      </Typography.Text>
    </div>
  );
}

function StructuredDataValue({ value, depth = 0, label }: { value: unknown; depth?: number; label?: string }) {
  if (isOssImageUrl(value)) return <OssImageValue value={value.trim()} alt={label ?? "返回图片"} />;
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="structured-empty-value">暂无内容</span>;
    return (
      <div className="structured-array">
        {value.map((item, index) => (
          <div className="structured-array-item" key={`${depth}-${index}`}>
            <div className="structured-array-index">第 {index + 1} 项</div>
            <StructuredDataValue value={item} depth={depth + 1} label={label} />
          </div>
        ))}
      </div>
    );
  }
  if (isJsonObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) return <span className="structured-empty-value">暂无字段</span>;
    return (
      <div className={`structured-object ${depth === 0 ? "structured-object-root" : ""}`}>
        {entries.map(([key, nestedValue]) => {
          const complex = Array.isArray(nestedValue) || isJsonObject(nestedValue);
          return (
            <div className={`structured-field ${complex ? "structured-field-complex" : ""}`} key={key}>
              <div className="structured-field-label">
                <span className="structured-field-name">{key}</span>
                {complex && <span className="structured-field-summary">{getStructuredDataSummary(nestedValue)}</span>}
              </div>
              <div className="structured-field-value">
                <StructuredDataValue value={nestedValue} depth={depth + 1} label={key} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  if (value === null || value === undefined) return <span className="structured-value structured-value-null">未返回</span>;
  if (typeof value === "boolean") return <Tag color={value ? "success" : "default"} className="structured-boolean-value">{value ? "是" : "否"}</Tag>;
  if (typeof value === "string" && value.length === 0) return <span className="structured-value structured-value-null">空文本</span>;
  return <span className={`structured-value structured-value-${typeof value}`}>{String(value)}</span>;
}

type ResponseEntry = [string, unknown];

function ResponseDataSection({ label, summary, children }: { label: string; summary: string; children: ReactNode }) {
  return (
    <section className="response-data-group">
      <div className="response-data-group-header">
        <div className="response-data-group-heading">
          <span className="response-data-group-title">{label}</span>
          <span className="response-data-group-summary">{summary}</span>
        </div>
        <span className="response-data-group-rule" />
      </div>
      {children}
    </section>
  );
}

function ResponseDataField({ entry, detailed }: { entry: ResponseEntry; detailed: boolean }) {
  const [key, value] = entry;
  const wide = isDetailedResponseValue(value);
  const showSummary = Array.isArray(value) || isJsonObject(value);
  return (
    <div className={`response-data-field ${wide ? "response-data-field-wide" : ""}`}>
      <div className="response-data-field-label">
        <span className="structured-field-name">{key}</span>
        {detailed && showSummary && <span className="structured-field-summary">{getStructuredDataSummary(value)}</span>}
      </div>
      <div className="response-data-field-value"><StructuredDataValue value={value} depth={1} label={key} /></div>
    </div>
  );
}

export function RecordDataView({ value, mode = "response" }: { value: unknown; mode?: "request" | "response" }) {
  const [showRaw, setShowRaw] = useState(false);
  const parsedValue = parseJsonText(value);
  const hasContent = parsedValue !== null && parsedValue !== undefined && parsedValue !== "";
  const entries = isJsonObject(parsedValue) ? Object.entries(parsedValue) : [];
  const summaryEntries = entries.filter((entry) => !isDetailedResponseValue(entry[1]));
  const detailEntries = entries.filter((entry) => isDetailedResponseValue(entry[1]));
  const labels = frontendConfig.record.responseSectionLabels;

  return (
    <div className="response-data-view">
      <Flex align="center" justify="space-between" gap={12} wrap>
        <Typography.Text type="secondary">{hasContent ? `已整理为字段视图 · ${getStructuredDataSummary(parsedValue)}` : "当前没有可展示的内容"}</Typography.Text>
        <Button type="link" size="small" aria-expanded={showRaw} onClick={() => setShowRaw((current) => !current)}>
          {showRaw ? "返回字段视图" : "查看原始 JSON"}
        </Button>
      </Flex>
      {showRaw ? <pre className="json-view response-raw-json">{formatJson(parsedValue)}</pre> : hasContent ? mode === "request" ? (
        <div className="request-data-structured"><StructuredDataValue value={parsedValue} /></div>
      ) : (
        <div className="response-data-groups">
          <ResponseDataSection label={labels.summary} summary={`${summaryEntries.length} 个字段`}>
            {summaryEntries.length ? <div className="response-data-basic-grid">{summaryEntries.map((entry) => <ResponseDataField key={entry[0]} entry={entry} detailed={false} />)}</div> : <div className="structured-empty-state">暂无基础字段</div>}
          </ResponseDataSection>
          <ResponseDataSection label={labels.details} summary={`${detailEntries.length} 个字段`}>
            {isJsonObject(parsedValue) ? detailEntries.length ? <div className="response-data-detail-grid">{detailEntries.map((entry) => <ResponseDataField key={entry[0]} entry={entry} detailed />)}</div> : <div className="structured-empty-state">暂无详细内容</div> : <StructuredDataValue value={parsedValue} />}
          </ResponseDataSection>
        </div>
      ) : <div className="structured-empty-state">暂无内容</div>}
    </div>
  );
}
