import "dotenv/config";
import { createApp } from "./app.js";
import { readConfig } from "./utils/config.js";
import { connectToDatabase, disconnectFromDatabase } from "./db/connections.js";

async function startServer() {
  const settings = readConfig();
  await connectToDatabase(settings.mongoUrl);
  const server = createApp(settings).listen(settings.port, () => console.log("Notes API ready"));
  server.on("error", async () => {
    console.error("Notes API could not listen");
    await disconnectFromDatabase();
    process.exitCode = 1;
  });
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => process.exit(1), 10000).unref();
    server.close(async () => {
      try { await disconnectFromDatabase(); }
      catch { process.exitCode = 1; }
      finally { clearTimeout(deadline); }
    });
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

startServer().catch(() => {
  console.error("Notes API startup failed; check configuration and database availability");
  process.exitCode = 1;
});
