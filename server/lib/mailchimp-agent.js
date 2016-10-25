import crypto from "crypto";
import _ from "lodash";
import * as helper from "./mailchimp-batch-helper";
import uri from "urijs";

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

  getAddToListOps(users, jobs = []) {
    return users.map(user => {
      const hash = this.getEmailHash(user.email);
      const operation_id = helper.getOperationId(jobs, {
        user: _.pick(user, ["id", "email", "segment_ids"]),
        path: `/lists/${this.listId}/members/${hash}`
      });

      // TODO: investigate on custom merge fields strategies
      // type check, empty fields, fields that doesn't exist?
      // change the check if the users was already synced (update the traits)
      // sync from hull -> mailchimp
      return {
        operation_id,
        method: "PUT",
        path: `/lists/${this.listId}/members/${hash}`,
        body: JSON.stringify({
          email_type: "html",
          merge_fields: {
            FNAME: user.first_name || "",
            LNAME: user.last_name || ""
          },
          interests: this.interestsMappingAgent.getInterestsForSegments(user.segment_ids),
          email_address: user.email,
          status_if_new: "subscribed"
        })
      };
    });
  }

  getAddToAudiencesOps(users) {
    const ret = _.reduce(users, (ops, user) => {
      const listId = this.listId;
      // const subscriberHash = this.getEmailHash(user.email);
      const audienceIds = user.segment_ids.map(s => this.segmentsMappingAgent.getAudienceId(s));

      const hash = this.getEmailHash(user.email);
      const interests = this.interestsMappingAgent.getInterestsForSegments(user.segment_ids);

      // update user interests
      ops.push({
        method: "PUT",
        path: `/lists/${this.listId}/members/${hash}`,
        body: JSON.stringify({
          interests,
          email_address: user.email,
          status_if_new: "subscribed"
        })
      });

      _.map(audienceIds, audienceId => {
        const op = {
          method: "POST",
          path: `/lists/${listId}/segments/${audienceId}/members`,
          body: JSON.stringify({
            email_address: user.email,
            status: "subscribed"
          })
        };
        ops.push(op);
      });

      return ops;
    }, []);

    return ret;
  }

  getRemoveFromAudiencesOp(users) {
    return _.reduce(users, (ops, user) => {
      const listId = this.listId;
      const subscriberHash = this.getEmailHash(user.email);
      const audienceIds = _.get(user, "remove_segment_ids", []).map(s => this.segmentsMappingAgent.getAudienceId(s));


      const segment_ids = _.difference((user.segment_ids || []), (user.remove_segment_ids || []));

      const hash = this.getEmailHash(user.email);
      const interests = this.interestsMappingAgent.getInterestsForSegments(segment_ids);

      // update user interests
      ops.push({
        method: "PUT",
        path: `/lists/${this.listId}/members/${hash}`,
        body: JSON.stringify({
          interests,
          email_address: user.email,
          status_if_new: "subscribed"
        })
      });


      _.map(audienceIds, audienceId => {
        const op = {
          method: "DELETE",
          path: `/lists/${listId}/segments/${audienceId}/members/${subscriberHash}`,
        };
        ops.push(op);
      });
      return ops;
    }, []);
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
