import { frontendConfig } from "../config";

export async function requestJson<T>(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(`${frontendConfig.apiBaseUrl}${path}`, {
    ...init,
    headers,
  });
  const payload = (await response.json().catch(() => null)) as
    | { message?: string }
    | T
    | null;

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? payload.message
        : undefined;
    throw new Error(message || "请求未完成");
  }

  return payload as T;
}
