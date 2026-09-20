export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求未完成";
}

export function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
}

const statusText: Record<string, string> = {
  RUNNING: "执行中",
  COMPLETED: "已完成",
  STOPPED: "已停止",
  FAILED: "执行失败",
  SUCCESS: "成功",
  BIZ_ERROR: "返回异常",
  HTTP_ERROR: "网络异常",
  EXCEPTION: "调用异常",
};

const statusColor: Record<string, string> = {
  RUNNING: "processing",
  COMPLETED: "success",
  STOPPED: "warning",
  FAILED: "error",
  SUCCESS: "success",
  BIZ_ERROR: "warning",
  HTTP_ERROR: "error",
  EXCEPTION: "error",
};

const errorText: Record<string, string> = {
  timeout: "请求超时",
  connect_error: "连接异常",
  http_error: "网络状态异常",
  unknown_error: "未知异常",
};

export function getStatusText(value: string | null | undefined) {
  return value ? statusText[value] ?? "未知状态" : "—";
}

export function getStatusColor(value: string | null | undefined) {
  return value ? statusColor[value] ?? "default" : "default";
}

export function getErrorText(value: string | null) {
  return value ? errorText[value] ?? value : "—";
}
