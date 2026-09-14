import { randomUUID } from "node:crypto";
import { HttpError } from "../errors";
import {
  buildCode,
  getDefaultConfigView,
  resolveTaskConfig,
  toStoredConfig,
} from "../config/task-config";
import { RecordRepository } from "../repositories/record-repository";
import { TaskRepository } from "../repositories/task-repository";
import { NoticeService } from "./notice-service";
import { RemoteClient } from "./remote-client";
import type {
  TaskConfigInput,
  TaskSnapshot,
  TaskStatus,
  WorkItem,
} from "../types/task";

type Listener = (snapshot: TaskSnapshot) => void;

type RunningTask = {
  id: string;
  config: ReturnType<typeof resolveTaskConfig>;
  stopRequested: boolean;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "任务执行失败";
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function getDelay(minimum: number, maximum: number) {
  if (maximum <= minimum) {
    return minimum;
  }
  return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
}

function isStopTime(hour: number) {
  return new Date().getHours() === hour;
}

export class TaskManager {
  private active: RunningTask | null = null;

  private starting = false;

  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly recordRepository: RecordRepository,
    private readonly noticeService: NoticeService,
  ) {}

  getConfig() {
    return getDefaultConfigView();
  }

  async start(input: TaskConfigInput) {
    if (this.active || this.starting) {
      throw new HttpError(409, "已有任务正在执行");
    }

    this.starting = true;
    try {
      const config = resolveTaskConfig(input);
      const totalCount = config.endNo - config.startNo;
      const id = randomUUID();
      const snapshot = await this.taskRepository.create(
        id,
        totalCount,
        toStoredConfig(config),
      );

      if (!snapshot) {
        throw new Error("任务创建失败");
      }

      this.active = {
        id,
        config,
        stopRequested: false,
      };
      this.publish(snapshot);
      void this.execute(this.active);
      return snapshot;
    } finally {
      this.starting = false;
    }
  }

  async getActive() {
    return this.taskRepository.getActive();
  }

  async get(id: string) {
    return this.taskRepository.getById(id);
  }

  async list(limit: number) {
    return this.taskRepository.list(limit);
  }

  async recover() {
    await this.taskRepository.markRunningAsFailed();
  }

  async stop(id: string) {
    if (this.active?.id !== id) {
      const snapshot = await this.taskRepository.getById(id);
      if (!snapshot) {
        throw new HttpError(404, "任务不存在");
      }
      if (snapshot.status !== "RUNNING") {
        throw new HttpError(409, "任务已结束");
      }
      throw new HttpError(409, "任务当前不可停止");
    }

    this.active.stopRequested = true;
    const snapshot = await this.taskRepository.getById(id);
    if (snapshot) {
      this.publish(snapshot);
    }
    return snapshot;
  }

  subscribe(id: string, listener: Listener) {
    const current = this.listeners.get(id) ?? new Set<Listener>();
    current.add(listener);
    this.listeners.set(id, current);

    return () => {
      current.delete(listener);
      if (!current.size) {
        this.listeners.delete(id);
      }
    };
  }

  private publish(snapshot: TaskSnapshot) {
    const current = this.listeners.get(snapshot.id);
    if (!current) {
      return;
    }

    for (const listener of current) {
      try {
        listener(snapshot);
      } catch {
        current.delete(listener);
      }
    }
  }

  private async execute(running: RunningTask) {
    let client: RemoteClient | undefined;
    let processedCount = 0;
    let successCount = 0;
    let failureCount = 0;
    let status: TaskStatus = "COMPLETED";
    let lastError: string | null = null;

    try {
      client = new RemoteClient(running.config);

      for (
        let value = running.config.startNo;
        value < running.config.endNo;
        value += 1
      ) {
        if (running.stopRequested || isStopTime(running.config.stopHour)) {
          status = "STOPPED";
          break;
        }

        const item: WorkItem = {
          sequenceNo: value,
          code: buildCode(running.config, value),
          itemCode: running.config.itemCode,
        };
        const result = await client.execute(item);
        processedCount += 1;

        if (result.callStatus === "SUCCESS") {
          successCount += 1;
        } else {
          failureCount += 1;
        }

        await this.recordRepository.insert(running.id, item.sequenceNo, result);
        await this.taskRepository.updateProgress(running.id, {
          processedCount,
          successCount,
          failureCount,
          currentNo: item.sequenceNo,
          currentCode: item.code,
        });
        const snapshot = await this.taskRepository.getById(running.id);
        if (snapshot) {
          this.publish(snapshot);
        }

        if (result.callStatus === "EXCEPTION") {
          status = "FAILED";
          lastError = result.errorMessage;
          try {
            await this.noticeService.send(
              `任务 ${running.id} 已停止，已处理 ${processedCount} 条，原因：${lastError ?? "未知异常"}`,
            );
          } catch {
            lastError = `${lastError ?? "未知异常"}; 通知发送失败`;
          }
          break;
        }

        if (value < running.config.endNo - 1) {
          await wait(
            getDelay(running.config.minDelayMs, running.config.maxDelayMs),
          );
        }
      }
    } catch (error) {
      status = "FAILED";
      lastError = getErrorMessage(error);
    } finally {
      try {
        await this.taskRepository.finish(running.id, status, lastError);
        const snapshot = await this.taskRepository.getById(running.id);
        if (snapshot) {
          this.publish(snapshot);
        }
      } catch (error) {
        console.error(error);
      }
      if (this.active?.id === running.id) {
        this.active = null;
      }
    }
  }
}
