import {
  constants,
  createCipheriv,
  createDecipheriv,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
} from "node:crypto";
import { settings } from "../config/settings";

export type RemoteResponseData = {
  code?: unknown;
  msg?: unknown;
  data?: unknown;
  [key: string]: unknown;
};

export type RemoteCrypto = {
  createSessionKey(): Buffer;
  encryptKey(sessionKey: Buffer, publicKey: string): string;
  encryptPayload(payload: Record<string, string>, sessionKey: Buffer): string;
  decryptPayload(
    encryptedKey: string,
    encryptedPayload: string,
    privateKey: string,
  ): RemoteResponseData;
};

type CryptoConfig = {
  sessionKeyLength: number;
  sessionKeyAlphabet: string;
  sessionKeyTextEncoding: BufferEncoding;
  sessionKeyEncoding: BufferEncoding;
  encryptedKeyEncoding: BufferEncoding;
  rsaPadding: number;
  payloadAlgorithm: string;
  payloadIv: Buffer | null;
  payloadEncoding: BufferEncoding;
  payloadTextEncoding: BufferEncoding;
};

function requiredText(value: string | undefined, environmentName: string) {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    throw new Error(`缺少环境变量 ${environmentName}`);
  }
  return normalized;
}

function readPositiveInteger(value: string | undefined, environmentName: string) {
  const result = Number(requiredText(value, environmentName));
  if (!Number.isSafeInteger(result) || result <= 0) {
    throw new Error(`环境变量 ${environmentName} 必须是正整数`);
  }
  return result;
}

function readEncoding(value: string | undefined, environmentName: string) {
  const encoding = requiredText(value, environmentName);
  if (!Buffer.isEncoding(encoding)) {
    throw new Error(`环境变量 ${environmentName} 不是有效的文本编码`);
  }
  return encoding;
}

function readPadding(value: string | undefined, environmentName: string) {
  const constantName = requiredText(value, environmentName) as keyof typeof constants;
  const padding = constants[constantName];
  if (typeof padding !== "number") {
    throw new Error(`环境变量 ${environmentName} 不是有效的 RSA 填充常量`);
  }
  return padding;
}

function readPayloadIv(
  value: string | undefined,
  encodingValue: string | undefined,
  encodingEnvironmentName: string,
) {
  if (value === undefined) {
    throw new Error("缺少环境变量 TASK_CRYPTO_PAYLOAD_IV");
  }
  const iv = value.trim();
  if (!iv || iv.toLowerCase() === "none") {
    return null;
  }
  return Buffer.from(iv, readEncoding(encodingValue, encodingEnvironmentName));
}

function readCryptoConfig(): CryptoConfig {
  const configured = settings.task.crypto;
  const sessionKeyAlphabet = requiredText(
    configured.sessionKeyAlphabet,
    "TASK_CRYPTO_SESSION_KEY_ALPHABET",
  );

  return {
    sessionKeyLength: readPositiveInteger(
      configured.sessionKeyLength,
      "TASK_CRYPTO_SESSION_KEY_LENGTH",
    ),
    sessionKeyAlphabet,
    sessionKeyTextEncoding: readEncoding(
      configured.sessionKeyTextEncoding,
      "TASK_CRYPTO_SESSION_KEY_TEXT_ENCODING",
    ),
    sessionKeyEncoding: readEncoding(
      configured.sessionKeyEncoding,
      "TASK_CRYPTO_SESSION_KEY_ENCODING",
    ),
    encryptedKeyEncoding: readEncoding(
      configured.encryptedKeyEncoding,
      "TASK_CRYPTO_ENCRYPTED_KEY_ENCODING",
    ),
    rsaPadding: readPadding(
      configured.rsaPadding,
      "TASK_CRYPTO_RSA_PADDING",
    ),
    payloadAlgorithm: requiredText(
      configured.payloadAlgorithm,
      "TASK_CRYPTO_PAYLOAD_ALGORITHM",
    ),
    payloadIv: readPayloadIv(
      configured.payloadIv,
      configured.payloadIvEncoding,
      "TASK_CRYPTO_PAYLOAD_IV_ENCODING",
    ),
    payloadEncoding: readEncoding(
      configured.payloadEncoding,
      "TASK_CRYPTO_PAYLOAD_ENCODING",
    ),
    payloadTextEncoding: readEncoding(
      configured.payloadTextEncoding,
      "TASK_CRYPTO_PAYLOAD_TEXT_ENCODING",
    ),
  };
}

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

export function createRemoteCrypto(): RemoteCrypto {
  const config = readCryptoConfig();

  return {
    createSessionKey() {
      const random = randomBytes(config.sessionKeyLength);
      const value = Array.from(
        random,
        (byte) => config.sessionKeyAlphabet[byte % config.sessionKeyAlphabet.length],
      ).join("");
      return Buffer.from(value, config.sessionKeyTextEncoding);
    },

    encryptKey(sessionKey, publicKey) {
      const encodedKey = sessionKey.toString(config.sessionKeyEncoding);
      return publicEncrypt(
        {
          key: toPublicKey(publicKey),
          padding: config.rsaPadding,
        },
        Buffer.from(encodedKey, config.sessionKeyTextEncoding),
      ).toString(config.encryptedKeyEncoding);
    },

    encryptPayload(payload, sessionKey) {
      const cipher = createCipheriv(
        config.payloadAlgorithm,
        sessionKey,
        config.payloadIv,
      );
      const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(payload), config.payloadTextEncoding),
        cipher.final(),
      ]);
      return encrypted.toString(config.payloadEncoding);
    },

    decryptPayload(encryptedKey, encryptedPayload, privateKey) {
      const encodedKey = privateDecrypt(
        {
          key: toPrivateKey(privateKey),
          padding: config.rsaPadding,
        },
        Buffer.from(encryptedKey, config.encryptedKeyEncoding),
      ).toString(config.sessionKeyTextEncoding);
      const sessionKey = Buffer.from(encodedKey, config.sessionKeyEncoding);
      const decipher = createDecipheriv(
        config.payloadAlgorithm,
        sessionKey,
        config.payloadIv,
      );
      const decrypted = Buffer.concat([
        decipher.update(
          Buffer.from(encryptedPayload, config.payloadEncoding),
        ),
        decipher.final(),
      ]);
      return JSON.parse(
        decrypted.toString(config.payloadTextEncoding),
      ) as RemoteResponseData;
    },
  };
}
