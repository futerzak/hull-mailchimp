import _ from "lodash";

export default class TrackController {

  /**
   * Gets information from campaigns about email activies and prepares
   * query to create hull extracts for users who have activities in mailchimp.
   * As a param it takes a callback which is called for every 10000 emails chunkes
   * with prepared elastic search query.
   * It decides about the timestamp for `traits_mailchimp/latest_activity_at`.
   * The query is build by `buildSegmentQuery` method.
   * @api
   * @see buildSegmentQuery
   * @param  {Function} callback
   * @return {Promise}
   */
  requestTrackJob(req) {
    const client = req.hull.client;
    const { eventsAgent, mailchimpBatchAgent, mailchimpAgent } = req.shipApp;

    if (!mailchimpAgent.isShipConfigured()) {
      req.hull.client.logger.error("ship not configured");
      return Promise.resolve();
    }

    client.logger.info("request.track.request", req.payload);

    return eventsAgent.getTrackableCampaigns()
      .then(campaigns => {
        return eventsAgent.getEmailActivities(campaigns);
      })
      .then(operations => {
        return mailchimpBatchAgent.create(operations, ["handleEmailsActivitiesJob"]);
      });
  }

  handleEmailsActivitiesJob(req) {
    const data = req.payload;
    const { extractAgent, eventsAgent } = req.shipApp;

    const emailsToExtract = eventsAgent.getEmailsToExtract(data);
    req.hull.client.logger.info("runCampaignStrategy.emailsChunk", emailsToExtract.length);
    const query = eventsAgent.buildSegmentQuery(emailsToExtract);

    const options = {
      segment: {
        query
      },
      path: "/track",
      format: "csv",
      fields: [
        "id",
        "email",
        "traits_mailchimp/latest_activity_at",
        "traits_mailchimp/unique_email_id"
      ]
    };
    req.hull.client.logger.info("Request track extract");
    return extractAgent.requestExtract(options)
      .catch(err => console.error(err));
  }

  trackJob(req) {
    const client = req.hull.client;
    const { queueAgent, extractAgent } = req.shipApp;

    client.logger.info("request.track.start", req.payload);
    return extractAgent.handleExtract(req.payload.body, req.payload.chunkSize, users => {
      client.logger.info("request.track.parseChunk", users.length);
      // TODO: decide if to filter users here
      // is the extract user.segment_ids update?
      // const filteredUsers = users.filter((user) => {
      //   return !_.isEmpty(user.email)
      //     && agent.shouldSyncUser(user);
      // });
      queueAgent.create("trackUsersJob", { users });
    });
  }

  /**
   * Gets information from Mailchimp about member activities for provided e-mail addresses
   * and triggers Hull.track api endpoint.
   * @api
   * @see getMemberActivities
   * @see trackEvents
   * @param  {Array} hullUsers
   * @return {Promise}
   */
  trackUsersJob(req) {
    const { eventsAgent, mailchimpBatchAgent } = req.shipApp;

    const users = _.get(req.payload, "users", []);
    const ops = eventsAgent.getMemberActivitiesOperations(users, ["handleMembersActivitiesJob"]);
    return mailchimpBatchAgent.create(ops);
  }

  handleMembersActivitiesJob(req) {
    const { eventsAgent } = req.shipApp;
    const activities = eventsAgent.parseMemberActivities(req.payload);
    return eventsAgent.trackEvents(activities);
  }
}
