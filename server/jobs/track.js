import moment from "moment";
import _ from "lodash";

/**
 * SyncIn : import all the list members as hull users
 */
export default function trackJob(req) {
  const { syncAgent, mailchimpAgent, hullAgent } = req.shipApp;
  const last_track_at = _.get(req.hull.ship, "private_settings.last_track_at");

  return syncAgent.eventsAgent.getTrackableCampaigns()
    .then(c => syncAgent.eventsAgent.getEmailActivitiesOps(c))
    .then(operations => {
      return mailchimpAgent.batchAgent.create({
        operations,
        jobs: ["trackEmailActivites"],
        chunkSize: 200,
        extractField: "emails",
        additionalData: {
          last_track_at
        }
      });
    })
    .then(() => {
      return hullAgent.updateShipSettings({
        last_track_at: moment.utc().format()
      });
    });
}
