import crypto from "crypto";
import _ from "lodash";
import uri from "urijs";
import Promise from "bluebird";

import MailchimpBatchAgent from "./batch-agent";

/**
 * Class responsible for working on data in Mailchimp
 */
export default class MailchimpAgent {

  constructor(mailchimpClient, ship, hullClient, queueAgent) {
    this.mailchimpClient = mailchimpClient;
    this.hullClient = hullClient;
    this.ship = ship;
    this.listId = _.get(ship, "private_settings.mailchimp_list_id");

    this.batchAgent = new MailchimpBatchAgent(hullClient, mailchimpClient, queueAgent);
  }

  getEmailHash(email) {
    return !_.isEmpty(email) && crypto.createHash("md5")
      .update(email.toLowerCase())
      .digest("hex");
  }

  getWebhook({ hostname, hull }) {
    const ship = _.get(hull.client.configuration(), "id");
    return this.mailchimpClient
      .get(`/lists/${this.listId}/webhooks`)
      .then(({ body = {} }) => {
        const { webhooks = [] } = body;
        return _.find(webhooks, ({ url = "" }) => {
          return url && url.includes(ship) && url.includes(hostname);
        });
      });
  }

  createWebhook(req) {
    const { hostname } = req;
    const { organization, id, secret } = req.hull.client.configuration();
    const search = {
      organization,
      secret,
      ship: id
    };
    const url = uri(`https://${hostname}/mailchimp`).search(search).toString();

    const hook = {
      url,
      sources: { user: true, admin: true, api: true },
      events: { subscribe: true, unsubscribe: true, profile: true, campaign: true }
    };

    return this.mailchimpClient
      .post(`/lists/${this.listId}/webhooks`)
      .send(hook)
      .then(({ body }) => body);
  }

  ensureWebhookSubscription(req) {
    if (!this.listId) {
      return Promise.reject(new Error("Missing listId"));
    }
    return this.getWebhook(req)
      .then(hook => hook || this.createWebhook(req))
      .catch(err => {
        console.warn("Error creating webhook ", err.message);
        return Promise.reject(this.mailchimpClient.handleError(err));
      });
  }

}
