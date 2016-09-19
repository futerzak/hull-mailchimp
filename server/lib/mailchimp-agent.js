import crypto from "crypto";
import _ from "lodash";
import * as helper from "./mailchimp-batch-helper";

/**
 * Class responsible for working on data in Mailchimp
 */
export default class MembersAgent {

  constructor(mailchimpClient, ship, segmentsMappingAgent, hullClient) {
    this.mailchimpClient = mailchimpClient;
    this.segmentsMappingAgent = segmentsMappingAgent;
    this.hullClient = hullClient;
    this.ship = ship;
    this.listId = _.get(ship, "private_settings.mailchimp_list_id");
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
          email_address: user.email,
          status_if_new: "subscribed"
        })
      };
    });
  }

  getAddToAudiencesOps(users) {
    return _.reduce(users, (ops, user) => {
      const listId = this.listId;
      // const subscriberHash = this.getEmailHash(user.email);
      const audienceIds = user.segment_ids.map(s => this.segmentsMappingAgent.getAudienceId(s));

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
  }

  getRemoveFromAudiencesOp(users) {
    return _.reduce(users, (ops, user) => {
      const listId = this.listId;
      const subscriberHash = this.getEmailHash(user.email);
      const audienceIds = _.get(user, "remove_segment_ids", []).map(s => this.segmentsMappingAgent.getAudienceId(s));

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

}
