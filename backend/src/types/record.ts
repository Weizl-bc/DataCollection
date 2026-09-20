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
  businessFieldValue: string | null;
  costMs: number | null;
  retryCount: number;
  createdAt: string;
};

export type RecordSearchOptions = {
  types: string[];
  years: number[];
  businessFieldLabel: string;
  defaultStatus: string;
};

export type RecordPage = {
  items: ApiRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export type RecordQuery = {
  page: number;
  pageSize: number;
  status?: string;
  taskRunId?: string;
  requestId?: string;
  businessFieldValue?: string;
  businessType?: string;
  businessYear?: number;
  businessNumberStart?: number;
  businessNumberEnd?: number;
};

export const recordExportStatuses = [
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "EXPIRED",
] as const;

export type RecordExportStatus = (typeof recordExportStatuses)[number];

export type RecordExportTask = {
  id: string;
  status: RecordExportStatus;
  query: RecordQuery;
  fileName: string;
  filePath: string | null;
  totalCount: number;
  processedCount: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RecordExportTaskView = Omit<RecordExportTask, "query" | "filePath"> & {
  progressPercent: number;
  downloadReady: boolean;
};
