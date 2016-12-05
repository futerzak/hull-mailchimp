import _ from "lodash";
import moment from "moment";

export default function trackUsers(req) {
  const { syncAgent } = req.shipApp;
  const users = _.get(req.payload, "users", []);
  const { last_track_at } = req.hull.ship.private_settings;

  return syncAgent.eventsAgent.getMemberActivities(users)
    .then(emails => {
      if (last_track_at) {
        emails = emails.map(e => {
          e.activity = e.activity.filter(a => {
            return moment(a.timestamp).utc().isAfter(last_track_at);
          });
          return e;
        });
      }

      return syncAgent.eventsAgent.trackEvents(emails);
    });
}
