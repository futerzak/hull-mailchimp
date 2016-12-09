import _ from "lodash";

export default function trackEmailActivites(req) {
  const { syncAgent, instrumentationAgent } = req.shipApp;
  let emailActivites = _.get(req.payload, "response", []);
  const { last_track_at } = req.payload.additionalData;

  emailActivites = syncAgent.eventsAgent.filterEvents(emailActivites, last_track_at);

  instrumentationAgent.metricInc("email_activites_for_user", emailActivites.length);
  return syncAgent.eventsAgent.trackEvents(emailActivites);
}
