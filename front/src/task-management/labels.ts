import { frontendConfig } from "../config";

export function getTaskDetailLabel(key: string) {
  return frontendConfig.taskDetail.fieldLabels[key] ?? key;
}
