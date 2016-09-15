import _ from "lodash";

/**
 * Class responsible for actions and operations on Hull side data - users
 */
export default class HullAgent {

  constructor(ship, hullClient) {
    this.ship = ship;
    this.hullClient = hullClient;
  }

  getUsersToAddToList(users) {
    return users.filter(u => this.userComplete(u) && !this.userAdded(u)
      && this.userWhitelisted(u));
  }

  getUsersToAddToAudiences(users) {
    return users.filter(u => this.userAdded(u) && this.userWhitelisted(u));
  }

  getUsersToRemoveFromAudiences(users) {
    return users.filter(u => this.userAdded(u) && !this.userWhitelisted(u));
  }

  userComplete(user) {
    return !_.isEmpty(user.email) && _.isEmpty(user.first_name)
      && _.isEmpty(user.last_name);
  }

  userAdded(user) {
    return !_.isEmpty(user["traits_mailchimp/unique_email_id"]);
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

}
