import { HttpError } from "../errors";
import { settings } from "./settings";
import type {
  StoredTaskConfig,
  TaskConfig,
  TaskConfigInput,
  TaskConfigView,
} from "../types/task";

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function readNumber(value: unknown, fallback: number) {
  const result = typeof value === "number" ? value : Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function readText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function assertInteger(name: string, value: number, minimum: number, maximum: number) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new HttpError(400, `${name} 参数不合法`);
  }
}

export function resolveTaskConfig(input: unknown): TaskConfig {
  const source = asRecord(input);
  const config: TaskConfig = {
    startNo: readNumber(source.startNo, settings.task.startNo),
    endNo: readNumber(source.endNo, settings.task.endNo),
    year: readNumber(source.year, settings.task.year),
    publicKey: readText(source.publicKey, settings.task.publicKey),
    privateKey: readText(source.privateKey, settings.task.privateKey),
    accessToken: readText(source.accessToken, settings.task.accessToken),
    itemCode: readText(source.itemCode, settings.task.itemCode),
    typeCode: readText(source.typeCode, settings.task.typeCode),
    stopHour: readNumber(source.stopHour, settings.task.stopHour),
    codePrefix: readText(source.codePrefix, settings.task.codePrefix),
    codeTemplate: readText(source.codeTemplate, settings.task.codeTemplate),
    valueField: readText(source.valueField, settings.task.valueField),
    itemField: readText(source.itemField, settings.task.itemField),
    endpoint: readText(source.endpoint, settings.task.endpoint),
    referer: readText(source.referer, settings.task.referer),
    environment: readText(source.environment, settings.task.environment),
    caller: readText(source.caller, settings.task.caller),
    timeoutMs: readNumber(source.timeoutMs, settings.task.timeoutMs),
    minDelayMs: readNumber(source.minDelayMs, settings.task.minDelayMs),
    maxDelayMs: readNumber(source.maxDelayMs, settings.task.maxDelayMs),
  };

  assertInteger("起始序号", config.startNo, 0, 100000000);
  assertInteger("结束序号", config.endNo, 0, 100000000);
  assertInteger("年份", config.year, 1970, 2200);
  assertInteger("截止小时", config.stopHour, 0, 23);
  assertInteger("超时时间", config.timeoutMs, 100, 600000);
  assertInteger("最小间隔", config.minDelayMs, 0, 3600000);
  assertInteger("最大间隔", config.maxDelayMs, 0, 3600000);

  if (config.endNo <= config.startNo) {
    throw new HttpError(400, "结束序号必须大于起始序号");
  }
  if (config.maxDelayMs < config.minDelayMs) {
    throw new HttpError(400, "最大间隔不能小于最小间隔");
  }
  if (!config.publicKey || !config.privateKey || !config.accessToken) {
    throw new HttpError(400, "凭据配置不完整");
  }
  if (!config.itemCode || !config.typeCode || !config.endpoint) {
    throw new HttpError(400, "任务配置不完整");
  }

  return config;
}

export function toConfigView(config: TaskConfig): TaskConfigView {
  const { publicKey, privateKey, accessToken, ...plainConfig } = config;
  return {
    ...plainConfig,
    publicKeyConfigured: Boolean(publicKey),
    privateKeyConfigured: Boolean(privateKey),
    accessTokenConfigured: Boolean(accessToken),
  };
}

export function toStoredConfig(config: TaskConfig): StoredTaskConfig {
  return toConfigView(config);
}

export function getDefaultConfigView() {
  return toConfigView(resolveTaskConfig({}));
}

export function buildCode(config: TaskConfig, value: number) {
  const numberValue = String(value).padStart(7, "0");
  return config.codeTemplate
    .replaceAll("{prefix}", config.codePrefix)
    .replaceAll("{type}", config.typeCode)
    .replaceAll("{year}", String(config.year))
    .replaceAll("{number}", numberValue);
}
