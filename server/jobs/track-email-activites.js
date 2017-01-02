import _ from "lodash";

export default function trackEmailActivites(req) {
  const { syncAgent, instrumentationAgent } = req.shipApp;
  let emailActivites = _.get(req.payload, "response", []);
  const { last_track_at, campaigns } = req.payload.additionalData;

  emailActivites = syncAgent.eventsAgent.filterEvents(emailActivites, last_track_at);

  emailActivites = emailActivites.map(emailActivity => {
    const campaign = _.find(campaigns, { id: emailActivity.campaign_id });
    emailActivity.title = _.get(campaign, "settings.title");
    return emailActivity;
  });

  instrumentationAgent.metricInc("track.email_activites_for_campaign", emailActivites.length);
  return syncAgent.eventsAgent.trackEvents(emailActivites);
}
