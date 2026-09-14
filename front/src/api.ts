export type TaskConfigInput = {
  startNo?: number;
  endNo?: number;
  year?: number;
  publicKey?: string;
  privateKey?: string;
  accessToken?: string;
  itemCode?: string;
  typeCode?: string;
  stopHour?: number;
  codePrefix?: string;
  codeTemplate?: string;
  valueField?: string;
  itemField?: string;
  endpoint?: string;
  referer?: string;
  environment?: string;
  caller?: string;
  timeoutMs?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
};

export type TaskConfigView = Omit<
  Required<TaskConfigInput>,
  "publicKey" | "privateKey" | "accessToken"
> & {
  publicKeyConfigured: boolean;
  privateKeyConfigured: boolean;
  accessTokenConfigured: boolean;
};

export type TaskSnapshot = {
  id: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  totalCount: number;
  processedCount: number;
  successCount: number;
  failureCount: number;
  currentNo: number | null;
  currentCode: string | null;
  config: TaskConfigView;
  lastError: string | null;
  progressPercent: number;
};

export type ApiRecord = {
  id: number;
  taskRunId: string | null;
  sequenceNo: number | null;
  apiName: string;
  requestId: string | null;
  httpMethod: string | null;
  httpStatus: number | null;
  bizCode: number | null;
  bizMsg: string | null;
  callStatus: string;
  errorType: string | null;
  errorMessage: string | null;
  requestParams: unknown;
  responseData: unknown;
  costMs: number | null;
  retryCount: number;
  createdAt: string;
};

export type RecordPage = {
  items: ApiRecord[];
  total: number;
  page: number;
  pageSize: number;
};

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001").replace(/\/$/, "");

async function requestJson<T>(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
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

export async function getTaskConfig() {
  const result = await requestJson<{ config: TaskConfigView }>("/api/tasks/config");
  return result.config;
}

export async function getActiveTask() {
  const result = await requestJson<{ task: TaskSnapshot | null }>(
    "/api/tasks/active",
  );
  return result.task;
}

export async function getTasks(limit = 20) {
  const result = await requestJson<{ items: TaskSnapshot[] }>(
    `/api/tasks/?limit=${limit}`,
  );
  return result.items;
}

export async function startTask(input: TaskConfigInput) {
  const result = await requestJson<{ task: TaskSnapshot }>("/api/tasks/", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return result.task;
}

export async function stopTask(id: string) {
  const result = await requestJson<{ task: TaskSnapshot | null }>(
    `/api/tasks/${encodeURIComponent(id)}/stop`,
    { method: "POST" },
  );
  return result.task;
}

export async function getRecords(query: {
  page: number;
  pageSize: number;
  status?: string;
  taskRunId?: string;
  requestId?: string;
}) {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  });
  if (query.status) params.set("status", query.status);
  if (query.taskRunId) params.set("taskRunId", query.taskRunId);
  if (query.requestId) params.set("requestId", query.requestId);
  return requestJson<RecordPage>(`/api/api_call_record?${params.toString()}`);
}

export function subscribeTask(
  id: string,
  onUpdate: (task: TaskSnapshot) => void,
  onError?: (error: Error) => void,
) {
  const source = new EventSource(
    `${apiBaseUrl}/api/tasks/${encodeURIComponent(id)}/events`,
  );
  const handleUpdate = (event: Event) => {
    try {
      const payload = JSON.parse((event as MessageEvent<string>).data) as TaskSnapshot;
      onUpdate(payload);
      if (payload.status !== "RUNNING") {
        source.close();
      }
    } catch {
      onError?.(new Error("实时数据格式错误"));
    }
  };

  source.addEventListener("update", handleUpdate);
  source.onerror = () => {
    if (source.readyState === EventSource.CLOSED) {
      return;
    }
    onError?.(new Error("实时连接已断开"));
  };

  return () => {
    source.removeEventListener("update", handleUpdate);
    source.close();
  };
}
