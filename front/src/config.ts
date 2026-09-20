const storageKey = "agDataCollection.backendApiBaseUrl";
const defaultApiBaseUrl = "http://localhost:3002";

export type FrontendRuntimeConfig = {
  record: {
    exportButtonLabel: string;
    exportPollIntervalMs: number;
    exportRetentionNotice: string;
    exportPageLabels: Record<string, string>;
    exportListPollIntervalMs: number;
    exportTaskPageSize: number;
    responseSectionLabels: Record<string, string>;
    detailSectionLabels: Record<string, string>;
  };
  taskDetail: { fieldLabels: Record<string, string> };
  task: { activePollIntervalMs: number; historyLimit: number };
  pagination: { recordDefaultPageSize: number };
};

function normalizeApiBaseUrl(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) throw new Error("后端接口地址不能为空");

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

export const frontendConfig: FrontendRuntimeConfig & {
  readonly apiBaseUrl: string;
  setApiBaseUrl(value: string): string;
} = {
  record: {
    exportButtonLabel: "",
    exportPollIntervalMs: 1,
    exportRetentionNotice: "",
    exportPageLabels: {},
    exportListPollIntervalMs: 1,
    exportTaskPageSize: 1,
    responseSectionLabels: {},
    detailSectionLabels: {},
  },
  taskDetail: { fieldLabels: {} },
  task: { activePollIntervalMs: 1, historyLimit: 1 },
  pagination: { recordDefaultPageSize: 1 },
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

export async function loadFrontendConfig() {
  const response = await fetch(`${frontendConfig.apiBaseUrl}/api/config`);
  if (!response.ok) throw new Error("前端展示配置加载失败");

  const config = (await response.json()) as FrontendRuntimeConfig;
  Object.assign(frontendConfig.record, config.record);
  Object.assign(frontendConfig.taskDetail, config.taskDetail);
  Object.assign(frontendConfig.task, config.task);
  Object.assign(frontendConfig.pagination, config.pagination);
  return config;
}
