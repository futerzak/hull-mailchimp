/**
 * Project dependencies tree
 */
import kue from "kue";

import KueAdapter from "./lib/queue/adapter/kue";
import InstrumentationAgent from "./lib/instrumentation-agent";
import BatchSyncHandler from "./lib/batch-sync-handler";
export controllers from "./controller";

export const hostSecret = process.env.SECRET || "shhuuut";

export const instrumentationAgent = new InstrumentationAgent();

export const queueAdapter = new KueAdapter(kue.createQueue({
  prefix: process.env.KUE_PREFIX || "hull-mailchimp",
  redis: process.env.REDIS_URL
}));

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
