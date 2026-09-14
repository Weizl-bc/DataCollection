import app, { taskManager } from "./app";
import { settings } from "./config/settings";
import { initializeDatabase } from "./database/init";

async function bootstrap() {
  await initializeDatabase();
  await taskManager.recover();

  app.listen(settings.server.port, () => {
    console.log(`服务已启动：http://localhost:${settings.server.port}`);
  });
}

void bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
