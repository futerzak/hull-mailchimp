import _ from "lodash";
import Promise from "bluebird";
import ps from "promise-streams";
import BatchStream from "batch-stream";
import moment from "moment";

export default class TrackController {

  requestTrackJob(req) {
    const client = req.hull.client;
    const agent = req.shipApp.mailchimpAgent;

    client.logger.info("request.track.request", req.payload);
    return req.shipApp.eventsAgent.runCampaignStrategy();
  }

  trackJob(req) {
    const client = req.hull.client;
    const agent = req.shipApp.mailchimpAgent;

    client.logger.info("request.track.start", req.payload);
    return agent.handleExtract(req.payload, users => {
      client.logger.info("request.track.parseChunk", users.length);
      // TODO: decide if to filter users here
      // is the extract user.segment_ids update?
      // const filteredUsers = users.filter((user) => {
      //   return !_.isEmpty(user.email)
      //     && agent.shouldSyncUser(user);
      // });
      queueAgent.create("trackChunkJob", { users });
    });
  }

  trackChunkJob(req) {
    const client = req.hull.client;
    const agent = req.shipApp.mailchimpAgent;

    const users = _.get(req.payload, "users", []);
    return req.shipApp.eventsAgent.runUserStrategy(users);
  }

  handleEmailsActivitiesJob(req) {
    const chunk = req.payload.reduce((emails, batchData) => {

      const campaignEmails = batchData.response.emails.map(e => {
        e.campaign_send_time = batchData.operationData.campaign.id;
        return e;
      });
      console.log("!!!!!!", campaignEmails);
      emails = _.concat(emails, campaignEmails);
      return emails;
    }, []);
console.log("CHUNK!!", req.payload, chunk);
    if (_.isEmpty(chunk)) {
      return null;
    }

    const emailsToExtract = chunk.reduce((emails, e) => {
      // const e = batchData.response.emails;
      console.log(e);
      // const campaing = batchData.operationData.campaign;

      const timestamps = e.activity.sort((x, y) => moment(x.timestamp) - moment(y.timestamp));
      const timestamp = _.get(_.last(timestamps), "timestamp", e.campaign_send_time);

      // if there is already same email queued remove it if its older than
      // actual or stop if it's not
      const existingEmail = _.findIndex(emails, ["email_address", e.email_address]);
      if (existingEmail !== -1) {
        if (moment(emails[existingEmail].timestamp).isSameOrBefore(timestamp)) {
          _.pullAt(emails, [existingEmail]);
        } else {
          return emails;
        }
      }

      req.hull.client.logger.info("runCampaignStrategy.email", { email_address: e.email_address, timestamp });
      emails.push({
        timestamp,
        email_id: e.email_id,
        email_address: e.email_address
      });
      return emails;
    }, []);
    req.hull.client.logger.info("runCampaignStrategy.emailsChunk", emailsToExtract.length);
    const query = req.shipApp.eventsAgent.buildSegmentQuery(emailsToExtract);


    const segment = {
      query
    };
    const path = "/track";
    const format = "csv";
    const fields = [
      "id",
      "email",
      "traits_mailchimp/latest_activity_at",
      "traits_mailchimp/unique_email_id"
    ];
    req.hull.client.logger.info("Request track extract");
    return req.shipApp.mailchimpAgent.requestExtract({ segment, path, format, fields })
      .catch(err => console.error(err));
  }
}
