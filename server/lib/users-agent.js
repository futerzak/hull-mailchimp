import _ from "lodash";

export default class UsersAgent {
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
}
