import _ from "lodash";

export default function trackUsers(req) {
  const { syncAgent, instrumentationAgent } = req.shipApp;
  const users = _.get(req.payload, "users", []);
  const { last_track_at } = req.hull.ship.private_settings;

  return syncAgent.eventsAgent.getMemberActivities(users)
    .then(emailActivites => {
      emailActivites = syncAgent.eventsAgent.filterEvents(emailActivites, last_track_at);
      instrumentationAgent.metricInc("email_activites_for_campaign", emailActivites.length);
      return syncAgent.eventsAgent.trackEvents(emailActivites);
    });
}
