import { Router } from "express";
import bodyParser from "body-parser";
import { NotifHandler } from "hull";

import responseMiddleware from "../util/middleware/response";
import requireConfiguration from "../util/middleware/require-configuration";
import tokenMiddleware from "../util/middleware/token";

export default function AppRouter(deps) {
  const router = new Router();
  const { hullMiddleware, appMiddleware, shipCache, shipConfig,
    actions, notifHandlers } = deps;

  const wrapWithMiddleware = (fn) => {
    return (payload, context) => {
      appMiddleware(context.req, {}, () => {});
      return fn(payload, context);
    };
  };

  // FIXME: since we have two routers on the same mountpoint: "/"
  // all middleware applied here also is applied to the static router,
  // which is a bad things, that's why we add the middleware on per route basis
  // router.use(deps.hullMiddleware);
  // router.use(AppMiddleware(deps));
  const middlewareSet = [tokenMiddleware, hullMiddleware, appMiddleware, requireConfiguration, bodyParser.json()];

  router.post("/batch", ...middlewareSet, actions.handleBatchExtract, responseMiddleware);
  router.post("/notify", NotifHandler({
    hostSecret: shipConfig.hostSecret,
    groupTraits: false,
    handlers: {
      "segment:update": wrapWithMiddleware(notifHandlers.segmentUpdate),
      "segment:delete": wrapWithMiddleware(notifHandlers.segmentDelete),
      "user:update": wrapWithMiddleware(notifHandlers.userUpdate),
      "ship:update": wrapWithMiddleware(notifHandlers.shipUpdate)
    },
    shipCache
  }));
  router.post("/sync", ...middlewareSet, actions.sync, responseMiddleware);
  router.post("/track", ...middlewareSet, actions.track, responseMiddleware);

  router.use("/mailchimp", hullMiddleware, appMiddleware, requireConfiguration, bodyParser.urlencoded({ extended: true }), actions.webhook);

  return router;
}
