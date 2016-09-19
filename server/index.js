import kue from "kue";
import Promise from "bluebird";

import KueAdapter from "./lib/queue/adapter/kue";
import BatchSyncHandler from "./lib/batch-sync-handler";
import controllers from "./controller";
import WorkerRouter from "./router/worker-router";
import WorkerApp from "./app/worker-app";
import PublicApp from "./app/public-app";

export function Server({ hostSecret }) {
  const queueAdapter = new KueAdapter(kue.createQueue({
    redis: process.env.REDIS_URL
  }));

  new WorkerApp({ queueAdapter, hostSecret })
    .use(WorkerRouter(controllers))
    .process();

  function exitNow() {
    console.warn("Exiting now !");
    process.exit(0);
  }

  function handleExit() {
    console.log("Exiting... waiting 30 seconds workers to flush");
    setTimeout(exitNow, 30000);
    Promise.all([
      BatchSyncHandler.exit(),
      queueAdapter.exit()
    ]).then(exitNow);
  }

  process.on("SIGINT", handleExit);
  process.on("SIGTERM", handleExit);

  return PublicApp({ queueAdapter, hostSecret });
}
