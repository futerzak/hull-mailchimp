import moment from "moment";
import _ from "lodash";

/**
 * Track: check all "trackable" campaigns and automation emails,
 * then download events for them.
 */
export default function trackJob(req) {
  const { syncAgent, mailchimpAgent, hullAgent, instrumentationAgent } = req.shipApp;
  const last_track_at = _.get(req.hull.ship, "private_settings.last_track_at");

  return syncAgent.eventsAgent.getCampaignsAndAutomationsToTrack()
    .then(campaigns => {
      const operations = syncAgent.eventsAgent.getEmailActivitiesOps(campaigns);
      instrumentationAgent.metricInc("track.operations", operations.length);
      return mailchimpAgent.batchAgent.create({
        operations,
        jobs: ["trackEmailActivites"],
        chunkSize: 200,
        extractField: "emails",
        additionalData: {
          last_track_at,
          campaigns
        }
      });
    })
    .then(() => {
      return hullAgent.updateShipSettings({
        last_track_at: moment.utc().format()
      });
    });
}
