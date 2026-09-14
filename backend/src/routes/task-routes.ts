import { Router } from "express";
import { HttpError } from "../errors";
import { TaskManager } from "../services/task-manager";

function readText(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function readLimit(value: unknown, fallback: number) {
  const parsed = Number(readText(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function writeEvent(response: { write: (value: string) => boolean }, snapshot: unknown) {
  response.write(`event: update\ndata: ${JSON.stringify(snapshot)}\n\n`);
}

export function createTaskRouter(manager: TaskManager) {
  const router = Router();

  router.get("/config", (_request, response) => {
    response.json({ config: manager.getConfig() });
  });

  router.get("/active", async (_request, response) => {
    response.json({ task: await manager.getActive() });
  });

  router.get("/", async (request, response) => {
    const limit = readLimit(request.query.limit, 20);
    response.json({ items: await manager.list(limit) });
  });

  router.post("/", async (request, response) => {
    const task = await manager.start(request.body);
    response.status(202).json({ task });
  });

  router.get("/:id/events", async (request, response) => {
    const id = readText(request.params.id);
    if (!id) {
      throw new HttpError(400, "任务编号不能为空");
    }

    const task = await manager.get(id);
    if (!task) {
      throw new HttpError(404, "任务不存在");
    }

    response.status(200).set({
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
      "X-Accel-Buffering": "no",
    });
    response.flushHeaders();
    writeEvent(response, task);

    const unsubscribe = manager.subscribe(id, (snapshot) => {
      writeEvent(response, snapshot);
    });
    const heartbeat = setInterval(() => {
      response.write(": ping\n\n");
    }, 15000);

    request.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  router.post("/:id/stop", async (request, response) => {
    const id = readText(request.params.id);
    if (!id) {
      throw new HttpError(400, "任务编号不能为空");
    }
    response.json({ task: await manager.stop(id) });
  });

  router.get("/:id", async (request, response) => {
    const id = readText(request.params.id);
    if (!id) {
      throw new HttpError(400, "任务编号不能为空");
    }
    const task = await manager.get(id);
    if (!task) {
      throw new HttpError(404, "任务不存在");
    }
    response.json({ task });
  });

  return router;
}
