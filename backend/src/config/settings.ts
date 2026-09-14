import "dotenv/config";

function readText(name: string, fallback = "") {
  return process.env[name] ?? fallback;
}

function readNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
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
  task: {
    startNo: readNumber("TASK_START_NO", 1),
    endNo: readNumber("TASK_END_NO", 10000),
    year: readNumber("TASK_YEAR", new Date().getFullYear()),
    publicKey: readText("TASK_PUBLIC_KEY"),
    privateKey: readText("TASK_PRIVATE_KEY"),
    accessToken: readText("TASK_ACCESS_TOKEN"),
    itemCode: readText("TASK_ITEM_CODE"),
    typeCode: readText("TASK_TYPE_CODE"),
    stopHour: readNumber("TASK_STOP_HOUR", 8),
    codePrefix: readText("TASK_CODE_PREFIX"),
    codeTemplate: readText("TASK_CODE_TEMPLATE", "{prefix}{type}({year}){number}"),
    valueField: readText("TASK_VALUE_FIELD", "value"),
    itemField: readText("TASK_ITEM_FIELD", "itemCode"),
    proxyUrl: readText("TASK_PROXY_URL"),
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
