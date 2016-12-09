import MailchimpClient from "../mailchimp-client";
import MailchimpAgent from "../mailchimp-agent";
import HullAgent from "../../util/hull-agent";
import QueueAgent from "../../util/queue/queue-agent";
// import EventsAgent from "../events-agent";

import SyncAgent from "../sync-agent";

export default function ({ queueAdapter, shipCache, instrumentationAgent }) {
  return function middleware(req, res, next) {
    req.shipApp = req.shipApp || {};

    if (!req.hull.ship) {
      return next();
    }
    shipCache.setClient(req.hull.client);
    instrumentationAgent.setShip(req.hull.ship);

    const mailchimpClient = new MailchimpClient(req.hull.ship);

    const queueAgent = new QueueAgent(queueAdapter, req);
    const mailchimpAgent = new MailchimpAgent(mailchimpClient, req.hull.ship, req.hull.client, queueAgent);
    const hullAgent = new HullAgent(req.hull.ship, req.hull.client, shipCache, req);

    const syncAgent = new SyncAgent(mailchimpClient, hullAgent, req.hull.ship, instrumentationAgent);

    req.shipApp = {
      mailchimpClient,
      mailchimpAgent,
      hullAgent,
      queueAgent,
      syncAgent,
      instrumentationAgent
    };

    return next();
  };
}
