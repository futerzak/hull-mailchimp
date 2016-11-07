import Hull from "hull";

import WorkerRouter from "./router/worker-router";
import WorkerApp from "./app/worker-app";
import { controllers, hostSecret, queueAdapter, instrumentationAgent } from "./bootstrap";

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

const worker = new WorkerApp({
  queueAdapter,
  hostSecret,
  hullMiddleware,
  instrumentationAgent
});

console.warn(`Starting the worker`);

worker
  .use(WorkerRouter(controllers))
  .process();
