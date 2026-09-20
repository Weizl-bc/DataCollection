import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(__dirname, "../../.env") });

function readText(name: string, fallback = "") {
  return process.env[name] ?? fallback;
}

function readRequiredText(name: string) {
  const value = readText(name).trim();
  if (!value) throw new Error(`${name} 未配置`);
  return value;
}

function readEnv(name: string) {
  return process.env[name];
}

function readNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function readPositiveInteger(name: string, fallback: number) {
  const value = readNumber(name, fallback);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} 必须是正整数`);
  }
  return value;
}

function readList(name: string) {
  return readText(name)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function readNumberList(name: string) {
  return readList(name)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
}

function readJsonObject(name: string): Record<string, string> {
  const rawValue = readText(name).trim();
  if (!rawValue) {
    return {};
  }

  try {
    const value = JSON.parse(rawValue) as unknown;
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(value).filter(([, label]) => typeof label === "string"),
    ) as Record<string, string>;
  } catch {
    return {};
  }
}

export const settings = {
  server: {
    port: readNumber("PORT", 3001),
    origins: readText("FRONTEND_ORIGIN", "http://localhost:5173")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  },
  database: {
    host: readText("DB_HOST"),
    port: readNumber("DB_PORT", 3306),
    user: readText("DB_USER"),
    password: readText("DB_PASSWORD"),
    database: readText("DB_NAME"),
    charset: readText("DB_CHARSET", "utf8mb4"),
  },
  record: {
    jsonFieldLabels: readJsonObject("RECORD_JSON_FIELD_LABELS"),
    defaultStatus: readText("RECORD_DEFAULT_STATUS"),
    searchJsonPath: readText("RECORD_SEARCH_JSON_PATH"),
    searchNumberWidth: readNumber("RECORD_SEARCH_NUMBER_WIDTH", 0),
    searchTypeOptions: readList("RECORD_SEARCH_TYPE_OPTIONS"),
    searchYearOptions: readNumberList("RECORD_SEARCH_YEAR_OPTIONS"),
    export: {
      fileName: readText("RECORD_EXPORT_FILE_NAME"),
      sheetName: readText("RECORD_EXPORT_SHEET_NAME"),
      taskIdLabel: readText("RECORD_EXPORT_TASK_ID_LABEL"),
      createdAtLabel: readText("RECORD_EXPORT_CREATED_AT_LABEL"),
      certificateFieldKey: readText("RECORD_EXPORT_CERTIFICATE_FIELD_KEY"),
      certificateLabel: readText("RECORD_EXPORT_CERTIFICATE_LABEL"),
      emptyValue: readText("RECORD_EXPORT_EMPTY_VALUE"),
      timeZone: readText("RECORD_EXPORT_TIME_ZONE"),
      directory: path.resolve(readRequiredText("RECORD_EXPORT_DIRECTORY")),
      failureMessage: readRequiredText("RECORD_EXPORT_FAILURE_MESSAGE"),
      retentionMs: readPositiveInteger("RECORD_EXPORT_RETENTION_HOURS", 3) * 60 * 60 * 1000,
      cleanupIntervalMs:
        readPositiveInteger("RECORD_EXPORT_CLEANUP_INTERVAL_MINUTES", 10) * 60 * 1000,
      batchSize: readPositiveInteger("RECORD_EXPORT_BATCH_SIZE", 1000),
      concurrency: readPositiveInteger("RECORD_EXPORT_CONCURRENCY", 1),
      taskDefaultPageSize: readPositiveInteger(
        "RECORD_EXPORT_TASK_DEFAULT_PAGE_SIZE",
        20,
      ),
      taskMaxPageSize: readPositiveInteger("RECORD_EXPORT_TASK_MAX_PAGE_SIZE", 100),
    },
  },
  task: {
    startNo: readNumber("TASK_START_NO", 1),
    endNo: readNumber("TASK_END_NO", 10000),
    year: readNumber("TASK_YEAR", new Date().getFullYear()),
    publicKey: readText("TASK_PUBLIC_KEY"),
    privateKey: readText("TASK_PRIVATE_KEY"),
    accessToken: readText("TASK_ACCESS_TOKEN"),
    crypto: {
      sessionKeyLength: readEnv("TASK_CRYPTO_SESSION_KEY_LENGTH"),
      sessionKeyAlphabet: readEnv("TASK_CRYPTO_SESSION_KEY_ALPHABET"),
      sessionKeyTextEncoding: readEnv("TASK_CRYPTO_SESSION_KEY_TEXT_ENCODING"),
      sessionKeyEncoding: readEnv("TASK_CRYPTO_SESSION_KEY_ENCODING"),
      encryptedKeyEncoding: readEnv("TASK_CRYPTO_ENCRYPTED_KEY_ENCODING"),
      rsaPadding: readEnv("TASK_CRYPTO_RSA_PADDING"),
      payloadAlgorithm: readEnv("TASK_CRYPTO_PAYLOAD_ALGORITHM"),
      payloadIv: readEnv("TASK_CRYPTO_PAYLOAD_IV"),
      payloadIvEncoding: readEnv("TASK_CRYPTO_PAYLOAD_IV_ENCODING"),
      payloadEncoding: readEnv("TASK_CRYPTO_PAYLOAD_ENCODING"),
      payloadTextEncoding: readEnv("TASK_CRYPTO_PAYLOAD_TEXT_ENCODING"),
    },
    itemCode: readText("TASK_ITEM_CODE"),
    typeCode: readText("TASK_TYPE_CODE"),
    stopHour: readNumber("TASK_STOP_HOUR", 8),
    codePrefix: readText("TASK_CODE_PREFIX"),
    codeTemplate: readText("TASK_CODE_TEMPLATE", "{prefix}{type}({year}){number}"),
    valueField: readText("TASK_VALUE_FIELD", "value"),
    itemField: readText("TASK_ITEM_FIELD", "itemCode"),
    endpoint: readText("TASK_API_URL"),
    referer: readText("TASK_REFERER"),
    environment: readText("TASK_ENV", "prod"),
    caller: readText("TASK_CALLER", "task_runner"),
    timeoutMs: readNumber("TASK_TIMEOUT_MS", 30000),
    minDelayMs: readNumber("TASK_MIN_DELAY_MS", 1000),
    maxDelayMs: readNumber("TASK_MAX_DELAY_MS", 3000),
  },
  notice: {
    enabled: readText("NOTICE_ENABLED", "false") === "true",
    clientId: readText("NOTICE_CLIENT_ID"),
    clientSecret: readText("NOTICE_CLIENT_SECRET"),
    conversationId: readText("NOTICE_CONVERSATION_ID"),
  },
} as const;
