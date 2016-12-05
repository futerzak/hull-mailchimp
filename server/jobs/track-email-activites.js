import _ from "lodash";
import moment from "moment";

export default function trackEmailActivites(req) {
  const { syncAgent } = req.shipApp;
  let emails = _.get(req.payload, "response", []);
  const { last_track_at } = req.payload.additionalData;

  if (last_track_at) {
    emails = emails.map(e => {
      e.activity = e.activity.filter(a => {
        return moment(a.timestamp).utc().isAfter(last_track_at);
      });
      return e;
    });
  }

  return syncAgent.eventsAgent.trackEvents(emails);
}
