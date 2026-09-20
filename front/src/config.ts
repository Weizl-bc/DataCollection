const storageKey = "agDataCollection.backendApiBaseUrl";
const defaultApiBaseUrl = "http://localhost:3002";

function readRequiredText(name: string) {
  const value = import.meta.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} 未配置`);
  }
  return value;
}

function readJsonObject(name: string): Record<string, string> {
  const rawValue = import.meta.env[name]?.trim();
  if (!rawValue) {
    return {};
  }

  try {
    const value = JSON.parse(rawValue) as unknown;
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(value).filter(([, label]) => typeof label === "string"),
    ) as Record<string, string>;
  } catch {
    return {};
  }
}

function readRequiredJsonObject(name: string, requiredKeys: string[]) {
  const value = readJsonObject(name);
  if (requiredKeys.some((key) => !value[key]?.trim())) {
    throw new Error(`${name} 配置不完整`);
  }
  return value;
}

const recordCertificateFieldKey = readRequiredText("VITE_RECORD_CERTIFICATE_FIELD_KEY");
const recordCertificateFieldLabel = readRequiredText("VITE_RECORD_CERTIFICATE_FIELD_LABEL");
const recordDefaultStatus = readRequiredText("VITE_RECORD_DEFAULT_STATUS");
const recordExportButtonLabel = readRequiredText("VITE_RECORD_EXPORT_BUTTON_LABEL");
const recordExportPollIntervalMs = Number(
  readRequiredText("VITE_RECORD_EXPORT_POLL_INTERVAL_MS"),
);
if (!Number.isInteger(recordExportPollIntervalMs) || recordExportPollIntervalMs < 1) {
  throw new Error("VITE_RECORD_EXPORT_POLL_INTERVAL_MS 必须是正整数");
}
const recordExportRetentionNotice = readRequiredText(
  "VITE_RECORD_EXPORT_RETENTION_NOTICE",
);
const recordExportPageLabels = readRequiredJsonObject(
  "VITE_RECORD_EXPORT_PAGE_LABELS",
  [
    "menu", "title", "refresh", "taskId", "fileName", "status", "progress",
    "totalCount", "createdAt", "completedAt", "expiresAt", "errorMessage",
    "action", "download", "downloadSuccess", "retentionAlert", "totalTemplate",
    "statusQueued", "statusRunning", "statusCompleted", "statusFailed", "statusExpired",
  ],
);
const recordExportListPollIntervalMs = Number(
  readRequiredText("VITE_RECORD_EXPORT_LIST_POLL_INTERVAL_MS"),
);
const recordExportTaskPageSize = Number(
  readRequiredText("VITE_RECORD_EXPORT_TASK_PAGE_SIZE"),
);
const recordResponseSectionLabels = readRequiredJsonObject(
  "VITE_RECORD_RESPONSE_SECTION_LABELS",
  ["summary", "details"],
);
const recordDetailSectionLabels = readRequiredJsonObject(
  "VITE_RECORD_DETAIL_SECTION_LABELS",
  ["request", "response"],
);
const taskDetailFieldLabels = readJsonObject("VITE_TASK_DETAIL_FIELD_LABELS");
const taskActivePollIntervalMs = Number(
  readRequiredText("VITE_TASK_ACTIVE_POLL_INTERVAL_MS"),
);
const taskHistoryLimit = Number(readRequiredText("VITE_TASK_HISTORY_LIMIT"));
const recordDefaultPageSize = Number(
  readRequiredText("VITE_RECORD_DEFAULT_PAGE_SIZE"),
);
for (const [name, value] of [
  ["VITE_TASK_ACTIVE_POLL_INTERVAL_MS", taskActivePollIntervalMs],
  ["VITE_TASK_HISTORY_LIMIT", taskHistoryLimit],
  ["VITE_RECORD_DEFAULT_PAGE_SIZE", recordDefaultPageSize],
  ["VITE_RECORD_EXPORT_LIST_POLL_INTERVAL_MS", recordExportListPollIntervalMs],
  ["VITE_RECORD_EXPORT_TASK_PAGE_SIZE", recordExportTaskPageSize],
] as const) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} 必须是正整数`);
  }
}

function normalizeApiBaseUrl(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    throw new Error("后端接口地址不能为空");
  }

  const withProtocol = /^https?:\/\//i.test(trimmedValue)
    ? trimmedValue
    : `http://${trimmedValue}`;
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(withProtocol);
  } catch {
    throw new Error("后端接口地址格式不正确");
  }

  if (!parsedUrl.hostname || !["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("后端接口地址格式不正确");
  }

  return withProtocol.replace(/\/+$/, "");
}

function getInitialApiBaseUrl() {
  const configuredApiUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  const storedApiUrl = window.localStorage.getItem(storageKey)?.trim();

  try {
    return normalizeApiBaseUrl(storedApiUrl || configuredApiUrl || defaultApiBaseUrl);
  } catch {
    return defaultApiBaseUrl;
  }
}

let currentApiBaseUrl = getInitialApiBaseUrl();

export const frontendConfig = {
  record: {
    certificateFieldKey: recordCertificateFieldKey,
    certificateFieldLabel: recordCertificateFieldLabel,
    defaultStatus: recordDefaultStatus,
    exportButtonLabel: recordExportButtonLabel,
    exportPollIntervalMs: recordExportPollIntervalMs,
    exportRetentionNotice: recordExportRetentionNotice,
    exportPageLabels: recordExportPageLabels,
    exportListPollIntervalMs: recordExportListPollIntervalMs,
    exportTaskPageSize: recordExportTaskPageSize,
    responseSectionLabels: recordResponseSectionLabels,
    detailSectionLabels: recordDetailSectionLabels,
  },
  taskDetail: {
    fieldLabels: taskDetailFieldLabels,
  },
  task: {
    activePollIntervalMs: taskActivePollIntervalMs,
    historyLimit: taskHistoryLimit,
  },
  pagination: {
    recordDefaultPageSize,
  },
  get apiBaseUrl() {
    return currentApiBaseUrl;
  },
  setApiBaseUrl(value: string) {
    const nextApiBaseUrl = normalizeApiBaseUrl(value);
    currentApiBaseUrl = nextApiBaseUrl;
    window.localStorage.setItem(storageKey, nextApiBaseUrl);
    return nextApiBaseUrl;
  },
};
