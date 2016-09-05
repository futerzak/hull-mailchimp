import MailchimpClient from "../mailchimp-client.js";
import MailchimpClientRequest from "../mailchimp-client-request.js";
import MailchimpAgent from "../mailchimp-agent";
import UsersAgent from "../users-agent";
import MembersAgent from "../members-agent";
import QueueAgent from "../queue/queue-agent";

export default function (queueAdapter) {
  return function middleware(req, res, next) {
    req.shipApp = req.shipApp || {};

    if (!req.hull.ship) {
      return next();
    }

    req.shipApp.queueAgent = new QueueAgent(queueAdapter, req);
    req.shipApp.mailchimpAgent = new MailchimpAgent(req.hull.ship, req.hull.client, req, MailchimpClient);
    req.shipApp.mailchimpClientRequest = new MailchimpClientRequest(req.shipApp.mailchimpAgent.getCredentials());

    req.shipApp.membersAgent = new MembersAgent(req.shipApp.mailchimpAgent.getCredentials());
    req.shipApp.usersAgent = new UsersAgent();

    return next();
  };
}
