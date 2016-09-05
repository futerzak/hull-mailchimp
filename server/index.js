import kue from "kue";
import QueueAgent from "./lib/queue/queue-agent";
import KueAdapter from "./lib/queue/adapter/kue";
import controllers from "./controller";

import QueueRouter from "./router/queue-router";
import QueueApp from "./app/queue-app";
import internalApp from "./internal-app";
import publicApp from "./public-app";

export function Server({ hostSecret }) {
  const queueAdapter = new KueAdapter(kue.createQueue({
    redis: process.env.REDIS_URL
  }));

  const queueAgent = new QueueAgent(queueAdapter);

  new QueueApp({ queueAdapter, hostSecret })
    .use(QueueRouter(controllers))
    .process();

  internalApp({
    hostSecret,
    queueAgent
  });

  return publicApp({ queueAgent });
}
