import crypto from "crypto";
import _ from "lodash";

export default class MembersAgent {

  constructor({ mailchimp_list_id }) {
    this.listId = mailchimp_list_id;
  }

  getEmailHash(email) {
    return !_.isEmpty(email) && crypto.createHash("md5")
      .update(email.toLowerCase())
      .digest("hex");
  }

  /**
   *
   */
  subscribeMembers(users, nextOperations = []) {
    return users.map(user => {
      const hash = this.getEmailHash(user.email);
      const operation_id = JSON.stringify({
        nextOperations,
        user: _.pick(user, ["id", "segment_ids"]),
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

  /**
   *
   */
  saveMembers(users, audiences, segmentIds, nextOperations = []) {
    return users.reduce((ops, user) => {
      const segment_ids = _.compact(_.uniq((user.segment_ids || []).concat(segmentIds)));
      const segments = _.pick(audiences, segment_ids);
      console.log("WWWW", segments, user, audiences);
      _.each(segments, ({ audience }) => {
        if (audience) {
          const operation_id = JSON.stringify({
            nextOperations
          });
          ops.push({
            operation_id,
            body: JSON.stringify({ email_address: user.email, status: "subscribed" }),
            method: "POST",
            path: `lists/${this.listId}/segments/${audience.id}/members`
          });
        }
      });
      return ops;
    }, []);
  }

  getMembersToSave(mailchimpResponse) {
    console.log("!!!!!!", mailchimpResponse);
    return _.map(mailchimpResponse, ({ response, operationData }) => {
      return {
        email: response.email_address,
        segment_ids: operationData.user.segment_ids
      };
    });
  }

}
