import _ from "lodash";

export default class UsersAgent {

  constructor(mailchimpAgent, hull) {
    this.mailchimpAgent = mailchimpAgent;
    this.hull = hull;
  }

  /**
   *
   */
  getUsersToSubscribe(users) {
    return users.filter(user => {
      return !_.isEmpty(user.email)
          && _.isEmpty(user["traits_mailchimp/unique_email_id"])
          && _.isEmpty(user["traits_mailchimp/import_error"]);
    });
  }

  getUsersToSave(users) {
    return users.filter(
      user => !_.isEmpty(user["traits_mailchimp/unique_email_id"])
    );
  }

  getUsersFromMessages(messages, audiences) {

    return messages.reduce((ops, m) => {
      const { user, changes = {}, segments = [] } = m;
      user.segment_ids = user.segment_ids || m.segments.map(s => s.id);

      if (!this.mailchimpAgent.shouldSyncUser(user)) {
        ops.usersToRemoveFromAll.push(user);
        return ops;
      }

      if (_.isEmpty(user["traits_mailchimp/unique_email_id"])) {
        this.hull.logger.info("User has empty unique_email_id trait");

        ops.usersToAdd.push(user);
        ops.segmentsToAdd = ops.segmentsToAdd.concat(segments);
      } else {
        this.hull.logger.info("User has unique_email_id trait", changes.segments);

        const { entered = [], left = [] } = changes.segments || {};
        if (entered.length > 0) {
          ops.usersToAdd.push(user);
        }
        ops.segmentsToAdd = ops.segmentsToAdd.concat(entered);

        user.left_audiences = user.left_audiences || [];
        user.left_audiences.push(left.map((segment) => audiences[segment.id].id));
        if (left.length > 0) {
          ops.usersToRemove.push(user);
        }
      }
      return ops;
    }, {
      usersToAdd: [],
      segmentsToAdd: [],
      usersToRemove: [],
      usersToRemoveFromAll: []
    });
  }
}
