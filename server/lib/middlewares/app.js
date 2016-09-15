import MailchimpClient from "../mailchimp-client";
import MailchimpAgent from "../mailchimp-agent";
import HullAgent from "../hull-agent";
// import QueueAgent from "../queue/queue-agent";
// import EventsAgent from "../events-agent";
// import MailchimpBatchAgent from "../mailchimp-batch-agent";
import SegmentsMappingAgent from "../segments-mapping-agent";

export default function ({ queueAdapter }) {
  return function middleware(req, res, next) {
    req.shipApp = req.shipApp || {};

    if (!req.hull.ship) {
      return next();
    }

    const mailchimpClient = new MailchimpClient(req.hull.ship);

    // req.shipApp.queueAgent = new QueueAgent(queueAdapter, req);

    const segmentsMappingAgent = new SegmentsMappingAgent(mailchimpClient, req.hull.client, req.hull.ship);
    const mailchimpAgent = new MailchimpAgent(mailchimpClient, segmentsMappingAgent, req.hull.ship, req.hull.client);
    const hullAgent = new HullAgent(req.hull.ship, req.hull.client);
    // req.shipApp.mailchumpBatchAgent = new MailchimpBatchAgent(req.hull.client, req.shipApp.mailchimpClient, req.shipApp.queueAgent);
    // req.shipApp.eventsAgent = new EventsAgent(req.shipApp.mailchimpClient, req.hull.client, req.hull.ship, req.shipApp.queueAgent, req.shipApp.batchAgent);

    req.shipApp = {
      mailchimpClient,
      segmentsMappingAgent,
      mailchimpAgent,
      hullAgent
    };

    return next();
  };
}
