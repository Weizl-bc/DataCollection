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
