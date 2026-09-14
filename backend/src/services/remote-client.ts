import { randomUUID } from "node:crypto";
import { fetch as request } from "undici";
import { createRemoteCrypto } from "./remote-crypto";
import type { CallResult, TaskConfig, WorkItem } from "../types/task";

function getErrorType(error: unknown) {
  if (!(error instanceof Error)) {
    return "unknown_error";
  }
  if (error.name === "TimeoutError" || error.name === "AbortError") {
    return "timeout";
  }
  if (/ECONNREFUSED|ENOTFOUND|fetch failed/i.test(error.message)) {
    return "connect_error";
  }
  return "unknown_error";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求执行失败";
}

export class RemoteClient {
  private readonly crypto = createRemoteCrypto();

  constructor(private readonly config: TaskConfig) {}

  async execute(item: WorkItem): Promise<CallResult> {
    const startedAt = Date.now();
    const requestId = randomUUID();
    const requestParams = {
      [this.config.valueField]: item.code,
      [this.config.itemField]: item.itemCode,
    };
    const result: CallResult = {
      apiName: "remote_api",
      apiUrl: this.config.endpoint,
      httpMethod: "GET",
      requestId,
      caller: this.config.caller,
      environment: this.config.environment,
      requestParams,
      requestBody: null,
      requestHeaders: null,
      httpStatus: null,
      bizCode: null,
      bizMsg: null,
      callStatus: "EXCEPTION",
      errorType: null,
      errorMessage: null,
      responseBody: null,
      responseData: null,
      costMs: 0,
      retryCount: 0,
    };

    try {
      const sessionKey = this.crypto.createSessionKey();
      const body = this.crypto.encryptPayload(requestParams, sessionKey);
      const encryptedKey = this.crypto.encryptKey(
        sessionKey,
        this.config.publicKey,
      );
      const separator = this.config.endpoint.includes("?") ? "&" : "?";
      const response = await request(
        `${this.config.endpoint}${separator}strData=${encodeURIComponent(body)}`,
        {
          method: "GET",
          headers: {
            accept: "application/json, text/plain, */*",
            authorization: this.config.accessToken,
            "encrypt-key": encryptedKey,
            isencrypt: "true",
            Referer: this.config.referer,
          },
          signal: AbortSignal.timeout(this.config.timeoutMs),
        },
      );
      result.httpStatus = response.status;

      if (response.status !== 200) {
        result.callStatus = "HTTP_ERROR";
        result.errorType = "http_error";
        result.errorMessage = `网络状态：${response.status}`;
        result.costMs = Date.now() - startedAt;
        return result;
      }

      const responseKey = response.headers.get("encrypt-key");
      const responseText = await response.text();
      if (!responseKey) {
        throw new Error("响应密钥缺失");
      }

      const payload = this.crypto.decryptPayload(
        responseKey,
        responseText,
        this.config.privateKey,
      );
      result.responseBody = payload;
      result.bizCode = typeof payload.code === "number" ? payload.code : null;
      result.bizMsg = typeof payload.msg === "string" ? payload.msg : null;
      result.responseData = payload.data ?? null;
      result.callStatus = result.bizCode === 200 ? "SUCCESS" : "BIZ_ERROR";
    } catch (error) {
      result.callStatus = "EXCEPTION";
      result.errorType = getErrorType(error);
      result.errorMessage = getErrorMessage(error);
    }

    result.costMs = Date.now() - startedAt;
    return result;
  }
}
