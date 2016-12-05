import _ from "lodash";
import Promise from "bluebird";

import SegmentsMappingAgent from "./segments-mapping-agent";
import InterestsMappingAgent from "./interests-mapping-agent";
import UserMappingAgent from "./user-mapping-agent";
import EventsAgent from "./events-agent";

export default class SyncAgent {

  constructor(mailchimpClient, hullAgent, ship) {
    this.ship = ship;
    this.mailchimpClient = mailchimpClient;
    this.hullAgent = hullAgent;
    this.listId = _.get(ship, "private_settings.mailchimp_list_id");

    this.segmentsMappingAgent = new SegmentsMappingAgent(mailchimpClient, hullAgent, ship);
    this.interestsMappingAgent = new InterestsMappingAgent(mailchimpClient, hullAgent, ship);
    this.userMappingAgent = new UserMappingAgent(ship, hullAgent.hullClient);
    this.eventsAgent = new EventsAgent(mailchimpClient, hullAgent.hullClient, ship);
  }

  isConfigured() {
    const apiKey = _.get(this.ship, "private_settings.api_key");
    const domain = _.get(this.ship, "private_settings.domain");
    const listId = _.get(this.ship, "private_settings.mailchimp_list_id");
    return !_.isEmpty(domain) && !_.isEmpty(apiKey) && !_.isEmpty(listId);
  }

  getUsersToAddToList(users) {
    return users.filter(u => this.hullAgent.userComplete(u) && !this.userWithError(u)
      && this.hullAgent.userWhitelisted(u));
  }

  usersToAddOrRemove(users) {
    return users.filter(u => this.userAdded(u));
  }

  userAdded(user) {
    return !_.isEmpty(user["traits_mailchimp/unique_email_id"]);
  }

  userWithError(user) {
    return !_.isEmpty(user["traits_mailchimp/import_error"]);
  }

  addToList(users) {
    const members = users.map(user => {
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
      .send({ members: _.uniqBy(members, "email_address"), update_existing: true });
  }

  saveToAudiences(users, concurrency = 3) {
    const req = _.reduce(users, (ops, user) => {
      const audienceIds = _.filter(user.segment_ids.map(s => this.segmentsMappingAgent.getAudienceId(s)));
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
          .catch(err => {
            console.warn("Error modyfing static segments", err.message);
            return Promise.reject(this.mailchimpClient.handleError(err));
          });
      };
    });

    return Promise.map(promises, (p) => p(), { concurrency });
  }
}
