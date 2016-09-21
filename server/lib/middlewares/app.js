import MailchimpClient from "../mailchimp-client";
import MailchimpAgent from "../mailchimp-agent";
import HullAgent from "../hull-agent";
import ExtractAgent from "../extract-agent";
import QueueAgent from "../queue/queue-agent";
import EventsAgent from "../events-agent";
import MailchimpBatchAgent from "../mailchimp-batch-agent";
import SegmentsMappingAgent from "../segments-mapping-agent";

export default function ({ queueAdapter }) {
  return function middleware(req, res, next) {
    req.shipApp = req.shipApp || {};

    if (!req.hull.ship) {
      return next();
    }

    const mailchimpClient = new MailchimpClient(req.hull.ship);

    const extractAgent = new ExtractAgent(req, req.hull.client);
    const queueAgent = new QueueAgent(queueAdapter, req);
    const segmentsMappingAgent = new SegmentsMappingAgent(mailchimpClient, req.hull.client, req.hull.ship);
    const mailchimpAgent = new MailchimpAgent(mailchimpClient, req.hull.ship, segmentsMappingAgent, req.hull.client);
    const hullAgent = new HullAgent(req.hull.ship, req.hull.client);
    const mailchimpBatchAgent = new MailchimpBatchAgent(req.hull.client, mailchimpClient, queueAgent);
    const eventsAgent = new EventsAgent(mailchimpClient, req.hull.client, req.hull.ship);

    req.shipApp = {
      mailchimpClient,
      segmentsMappingAgent,
      mailchimpAgent,
      hullAgent,
      queueAgent,
      extractAgent,
      mailchimpBatchAgent,
      eventsAgent
    };

    return next();
  };
}
