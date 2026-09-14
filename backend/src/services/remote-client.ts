import {
  constants,
  createCipheriv,
  createDecipheriv,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { fetch as request, ProxyAgent } from "undici";
import type { CallResult, TaskConfig, WorkItem } from "../types/task";

type ResponseData = {
  code?: unknown;
  msg?: unknown;
  data?: unknown;
  [key: string]: unknown;
};

function toPublicKey(value: string) {
  return value.includes("BEGIN")
    ? value
    : `-----BEGIN PUBLIC KEY-----\n${value}\n-----END PUBLIC KEY-----`;
}

function toPrivateKey(value: string) {
  return value.includes("BEGIN")
    ? value
    : `-----BEGIN PRIVATE KEY-----\n${value}\n-----END PRIVATE KEY-----`;
}

function createSessionKey() {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const random = randomBytes(32);
  return Buffer.from(
    Array.from(random, (value) => alphabet[value % alphabet.length]).join(""),
    "utf8",
  );
}

function encryptKey(sessionKey: Buffer, publicKey: string) {
  const encodedKey = sessionKey.toString("base64");
  return publicEncrypt(
    {
      key: toPublicKey(publicKey),
      padding: constants.RSA_PKCS1_PADDING,
    },
    Buffer.from(encodedKey, "utf8"),
  ).toString("base64");
}

function encryptPayload(payload: Record<string, string>, sessionKey: Buffer) {
  const cipher = createCipheriv("aes-256-ecb", sessionKey, null);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  return encrypted.toString("base64");
}

function decryptPayload(
  encryptedKey: string,
  encryptedPayload: string,
  privateKey: string,
) {
  const encodedKey = privateDecrypt(
    {
      key: toPrivateKey(privateKey),
      padding: constants.RSA_PKCS1_PADDING,
    },
    Buffer.from(encryptedKey, "base64"),
  ).toString("utf8");
  const sessionKey = Buffer.from(encodedKey, "base64");
  const decipher = createDecipheriv("aes-256-ecb", sessionKey, null);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPayload, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString("utf8")) as ResponseData;
}

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
  private readonly dispatcher: ProxyAgent | undefined;

  constructor(private readonly config: TaskConfig) {
    this.dispatcher = config.proxyUrl ? new ProxyAgent(config.proxyUrl) : undefined;
  }

  async close() {
    await this.dispatcher?.close();
  }

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
      const sessionKey = createSessionKey();
      const body = encryptPayload(requestParams, sessionKey);
      const encryptedKey = encryptKey(sessionKey, this.config.publicKey);
      const separator = this.config.endpoint.includes("?") ? "&" : "?";
      const response = await request(
        `${this.config.endpoint}${separator}strData=${encodeURIComponent(body)}`,
        {
          method: "GET",
          dispatcher: this.dispatcher,
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

      const payload = decryptPayload(
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
