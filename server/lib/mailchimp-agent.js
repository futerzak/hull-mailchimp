import crypto from "crypto";
import _ from "lodash";
import uri from "urijs";
import Promise from "bluebird";

import * as helper from "./mailchimp-batch-helper";

/**
 * Class responsible for working on data in Mailchimp
 */
export default class MailchimpAgent {

  constructor(mailchimpClient, ship, segmentsMappingAgent, interestsMappingAgent, hullClient) {
    this.mailchimpClient = mailchimpClient;
    this.segmentsMappingAgent = segmentsMappingAgent;
    this.interestsMappingAgent = interestsMappingAgent;
    this.hullClient = hullClient;
    this.ship = ship;
    this.listId = _.get(ship, "private_settings.mailchimp_list_id");
  }

  isShipConfigured() {
    const apiKey = _.get(this.ship, "private_settings.api_key");
    const domain = _.get(this.ship, "private_settings.domain");
    const listId = _.get(this.ship, "private_settings.mailchimp_list_id");
    return !_.isEmpty(domain) && !_.isEmpty(apiKey) && !_.isEmpty(listId);
  }

  getEmailHash(email) {
    return !_.isEmpty(email) && crypto.createHash("md5")
      .update(email.toLowerCase())
      .digest("hex");
  }

  addToList(users) {
    const members = users.map(user => {
      const hash = this.getEmailHash(user.email);
      const segment_ids = _.difference((user.segment_ids || []), (user.remove_segment_ids || []));

      // TODO: investigate on custom merge fields strategies
      // type check, empty fields, fields that doesn't exist?
      // change the check if the users was already synced (update the traits)
      // sync from hull -> mailchimp
      return {
        email_type: "html",
        merge_fields: {
          FNAME: user.first_name || "",
          LNAME: user.last_name || ""
        },
        interests: this.interestsMappingAgent.getInterestsForSegments(segment_ids),
        email_address: user.email,
        status_if_new: "subscribed"
      };
    });

    return this.mailchimpClient
      .post(`/lists/${this.listId}`)
      .send({ members, update_existing: true });
  }

  saveToAudiences(users, concurrency = 3) {
    const req = _.reduce(users, (ops, user) => {
      const listId = this.listId;
      const audienceIds = user.segment_ids.map(s => this.segmentsMappingAgent.getAudienceId(s));
      const removedAudienceIds = _.get(user, "remove_segment_ids", []).map(s => this.segmentsMappingAgent.getAudienceId(s));

      _.map(audienceIds, audienceId => {
        ops[audienceId] = ops[audienceId] || {
          members_to_add: [],
          members_to_remove: []
        };
        ops[audienceId].members_to_add.push(user.email);
      });

      _.map(removedAudienceIds, audienceId => {
        ops[audienceId] = ops[audienceId] || {
          members_to_add: [],
          members_to_remove: []
        };
        ops[audienceId].members_to_remove.push(user.email);
      });

      return ops;
    }, {});

    const promises = _.map(req, (operation, audienceId) => {
      return () => {
        return this.mailchimpClient
          .post(`/lists/${this.listId}/segments/${audienceId}`)
          .send(operation)
          .catch((err) => {
            console.log("ERROR", err);
          });
      };
    });

    return Promise.map(promises, (p) => p(), { concurrency });
  }

  getUsersFromOperations(operations) {
    const users = operations.map(op => op.data.user);
    return users;
  }

  getWebhook({ hostname, query }) {
    const { ship } = query;
    return this.mailchimpClient
      .get(`/lists/${this.listId}/webhooks`)
      .then(({ body = {} }) => {
        const { webhooks = [] } = body;
        return _.find(webhooks, ({ url = "" }) => {
          return url && url.includes(ship) && url.includes(hostname);
        });
      });
  }

  createWebhook({ hostname, query }) {
    const search = _.pick(query, ["organization", "ship", "secret"]);
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

  ensureWebhookSubscription({ hostname, query }) {
    if (!this.listId) {
      return Promise.reject(new Error("Missing listId"));
    }
    return this.getWebhook({ hostname, query }).then(
      hook => {
        return hook || this.createWebhook({ hostname, query });
      }
    ).catch(err => console.warn("Error creating webhook ", { err }));
  }

}
