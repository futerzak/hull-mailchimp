import Hull from "hull";

import PublicApp from "./app/public-app";
import { hostSecret, queueAdapter, controllers, instrumentationAgent } from "./bootstrap";

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

const PORT = process.env.PORT || 8082;
console.warn(`Starting on PORT ${PORT}`);

PublicApp({
  queueAdapter,
  hostSecret,
  hullMiddleware,
  instrumentationAgent
}).listen(PORT);
