import { requestJson } from "../shared/api-client";
import { frontendConfig } from "../config";
import type { TaskConfigInput, TaskConfigView, TaskSnapshot } from "./types";

export async function getTaskConfig() {
  const result = await requestJson<{ config: TaskConfigView }>("/api/tasks/config");
  return result.config;
}

export async function getActiveTask() {
  const result = await requestJson<{ task: TaskSnapshot | null }>("/api/tasks/active");
  return result.task;
}

export async function getTasks(limit: number) {
  const result = await requestJson<{ items: TaskSnapshot[] }>(`/api/tasks/?limit=${limit}`);
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

export function subscribeTask(
  id: string,
  onUpdate: (task: TaskSnapshot) => void,
  onError?: (error: Error) => void,
) {
  const eventSource = new EventSource(
    `${frontendConfig.apiBaseUrl}/api/tasks/${encodeURIComponent(id)}/events`,
  );
  const handleUpdate = (event: Event) => {
    try {
      const task = JSON.parse((event as MessageEvent<string>).data) as TaskSnapshot;
      onUpdate(task);
      if (task.status !== "RUNNING") eventSource.close();
    } catch {
      onError?.(new Error("实时数据格式错误"));
    }
  };

  eventSource.addEventListener("update", handleUpdate);
  eventSource.onerror = () => {
    if (eventSource.readyState !== EventSource.CLOSED) {
      onError?.(new Error("实时连接已断开"));
    }
  };
  return () => {
    eventSource.removeEventListener("update", handleUpdate);
    eventSource.close();
  };
}
