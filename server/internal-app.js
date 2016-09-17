import express from "express";
import { NotifHandler } from "hull";

import MailchimpAgent from "./lib/mailchimp-agent";
import MailchimpClient from "./lib/mailchimp-client";

export default function Server({ hostSecret, queueAgent }) {
  const app = express();

  queueAgent.processRequest(app);

  app.post("/notify", NotifHandler({
    hostSecret,
    groupTraits: false,
    handlers: {
      "segment:update": MailchimpAgent.handle("handleSegmentUpdate", MailchimpClient),
      "segment:delete": MailchimpAgent.handle("handleSegmentDelete", MailchimpClient),
      "user:update": MailchimpAgent.handle("handleUserUpdate", MailchimpClient),
      "ship:update": MailchimpAgent.handle("handleShipUpdate", MailchimpClient),
    }
  }));

  return app;
}
