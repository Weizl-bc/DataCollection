const storageKey = "agDataCollection.backendApiBaseUrl";
const defaultApiBaseUrl = "http://localhost:3001";

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
