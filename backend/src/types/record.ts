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
