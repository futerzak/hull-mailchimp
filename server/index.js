import kue from "kue";
import Promise from "bluebird";
import Hull from "hull";

import KueAdapter from "./lib/queue/adapter/kue";
import BatchSyncHandler from "./lib/batch-sync-handler";
import controllers from "./controller";
import WorkerRouter from "./router/worker-router";
import WorkerApp from "./app/worker-app";
import PublicApp from "./app/public-app";
import InstrumentationAgent from "./lib/instrumentation-agent";

export function Server({ hostSecret }) {
  /**
   * We need shared instance of Hull client middleware
   * because in its factory there is a caching object
   * which we need to share between PublicApp and WorkerApp.
   * Right now the refresh of ship settings is done in oauth client.
   * Not on the ship_update event, since the notifHandler has got separate
   * instance.
   * @type {Object}
   */
  const hullMiddleware = Hull.Middleware({
    hostSecret,
    useCache: true,
    fetchShip: true
  });

  const queueAdapter = new KueAdapter(kue.createQueue({
    prefix: process.env.KUE_PREFIX || "hull-mailchimp",
    redis: process.env.REDIS_URL
  }));

  const instrumentationAgent = new InstrumentationAgent();

  const worker = new WorkerApp({
    queueAdapter,
    hostSecret,
    hullMiddleware,
    instrumentationAgent
  });

  worker
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

  return PublicApp({
    queueAdapter,
    hostSecret,
    hullMiddleware,
    instrumentationAgent
  });
}
