import kue from "kue";
import KueAdapter from "./lib/queue/adapter/kue";
import controllers from "./controller";

import WorkerRouter from "./router/worker-router";
import WorkerApp from "./app/worker-app";
import publicApp from "./public-app";

export function Server({ hostSecret }) {
  const queueAdapter = new KueAdapter(kue.createQueue({
    redis: process.env.REDIS_URL
  }));

  new WorkerApp({ queueAdapter, hostSecret })
    .use(WorkerRouter(controllers))
    .process();

  return publicApp({ queueAdapter, hostSecret });
}
