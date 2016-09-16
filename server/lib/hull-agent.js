import _ from "lodash";

/**
 * Class responsible for actions and operations on Hull side data - users
 */
export default class HullAgent {

  constructor(ship, hullClient) {
    this.ship = ship;
    this.hullClient = hullClient;

    this.mailchimpFields = [
      "stats.avg_open_rate",
      "stats.avg_click_rate",
      "unique_email_id",
      "status",
      "member_rating",
      "language",
      "vip",
      "email_client"
    ];
  }

  getUsersToAddToList(users) {
    return users.filter(u => this.userComplete(u) && !this.userAdded(u)
      && this.userWhitelisted(u));
  }

  usersToAddOrRemove(users) {
    return users.filter(u => this.userAdded(u));
  }

  userComplete(user) {
    return !_.isEmpty(user.email)/* && _.isEmpty(user.first_name)
      && _.isEmpty(user.last_name)*/;
  }

  userAdded(user) {
    return !_.isEmpty(user["traits_mailchimp/unique_email_id"])
      || !_.isEmpty(user["traits_mailchimp/import_error"]);
  }

  userWhitelisted(user) {
    const segmentIds = _.get(this.ship, "private_settings.synchronized_segments", []);
    if (segmentIds.length === 0) {
      return true;
    }
    return _.intersection(segmentIds, user.segment_ids).length > 0;
  }

  getSegments() {
    return this.hullClient.get("/segments");
  }

  getExtractFields() {
    const traits = this.mailchimpFields.map(path => {
      const trait = _.last(path.split("."));
      return `traits_mailchimp/${trait}`;
    });
    const props = [
      "traits_mailchimp/import_error",
      "traits_mailchimp/last_activity_at",
      "id",
      "email",
      "first_name",
      "last_name"
    ];
    return props.concat(traits);
  }
}
