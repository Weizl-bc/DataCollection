export const taskStatusValues = [
  "RUNNING",
  "COMPLETED",
  "STOPPED",
  "FAILED",
] as const;

export type TaskStatus = (typeof taskStatusValues)[number];

export type TaskConfig = {
  startNo: number;
  endNo: number;
  year: number;
  publicKey: string;
  privateKey: string;
  accessToken: string;
  itemCode: string;
  typeCode: string;
  stopHour: number;
  codePrefix: string;
  codeTemplate: string;
  valueField: string;
  itemField: string;
  endpoint: string;
  referer: string;
  environment: string;
  caller: string;
  timeoutMs: number;
  minDelayMs: number;
  maxDelayMs: number;
};

export type TaskConfigInput = Partial<
  Pick<
    TaskConfig,
    | "startNo"
    | "endNo"
    | "year"
    | "publicKey"
    | "privateKey"
    | "accessToken"
    | "itemCode"
    | "typeCode"
    | "stopHour"
    | "codePrefix"
    | "codeTemplate"
    | "valueField"
    | "itemField"
    | "endpoint"
    | "referer"
    | "environment"
    | "caller"
    | "timeoutMs"
    | "minDelayMs"
    | "maxDelayMs"
  >
>;

export type TaskConfigView = Omit<
  TaskConfig,
  "publicKey" | "privateKey" | "accessToken"
> & {
  publicKeyConfigured: boolean;
  privateKeyConfigured: boolean;
  accessTokenConfigured: boolean;
};

export type StoredTaskConfig = TaskConfigView;

export type TaskSnapshot = {
  id: string;
  status: TaskStatus;
  startedAt: string | null;
  finishedAt: string | null;
  totalCount: number;
  processedCount: number;
  successCount: number;
  failureCount: number;
  currentNo: number | null;
  currentCode: string | null;
  config: StoredTaskConfig;
  lastError: string | null;
  progressPercent: number;
};

export type WorkItem = {
  sequenceNo: number;
  code: string;
  itemCode: string;
};

export type CallResult = {
  apiName: string;
  apiUrl: string;
  httpMethod: string;
  requestId: string;
  caller: string;
  environment: string;
  requestParams: Record<string, string>;
  requestBody: unknown;
  requestHeaders: unknown;
  httpStatus: number | null;
  bizCode: number | null;
  bizMsg: string | null;
  callStatus: string;
  errorType: string | null;
  errorMessage: string | null;
  responseBody: unknown;
  responseData: unknown;
  costMs: number;
  retryCount: number;
};
