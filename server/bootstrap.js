/**
 * Main project dependencies
 */
import CacheManager from "cache-manager";
import kue from "kue";
import Hull from "hull";

import AppMiddleware from "./lib/middlewares/app";
import KueAdapter from "./util/queue/adapter/kue";
import InstrumentationAgent from "./util/instrumentation-agent";

export * as jobs from "./jobs";
export * as actions from "./actions";
export * as notifHandlers from "./notif-handlers";

export const shipConfig = {
  hostSecret: process.env.SECRET || "1234",
  clientID: process.env.MAILCHIMP_CLIENT_ID,
  clientSecret: process.env.MAILCHIMP_CLIENT_SECRET
};

export const instrumentationAgent = new InstrumentationAgent("mailchimp");

export const queueAdapter = new KueAdapter(kue.createQueue({
  prefix: process.env.KUE_PREFIX || "hull-mailchimp",
  redis: process.env.REDIS_URL
}));

export Hull from "hull";
export const cacheManager = CacheManager.caching({
  store: "memory",
  max: process.env.SHIP_CACHE_MAX || 100,
  ttl: process.env.SHIP_CACHE_TTL || 60
});

export const shipCache = new Hull.ShipCache(cacheManager, process.env.SHIP_CACHE_PREFIX || "hull-mailchimp-cache");
export const hullMiddleware = new Hull.Middleware({ hostSecret: shipConfig.hostSecret, shipCache });
export const appMiddleware = new AppMiddleware({ queueAdapter, shipCache, instrumentationAgent });
