import Promise from "bluebird";

export default function segmentUpdateHandlerJob(req) {
  const { segment } = req.payload;
  console.warn("[segmentUpdateHandler] start", JSON.stringify({ segment }));

  const { syncAgent, hullAgent } = req.shipApp;

  if (!syncAgent.isConfigured()) {
    req.hull.client.logger.error("ship not configured");

    console.warn("[segmentUpdateHandler] ship not configured");
    return Promise.resolve();
  }

  const agents = [
    syncAgent.interestsMappingAgent,
    syncAgent.segmentsMappingAgent
  ];

  /**
   * FIXME: when we recreate segments on it's update we break mailchimp
   * automation because of changing segments and interests ids
   */
  return Promise.mapSeries(
    agents,
    agent => agent.recreateSegment(segment)
  ).then(() => {
    console.warn("[segmentUpdateHandler] requestExtract for ", segment.name);
    return hullAgent.extractAgent.requestExtract({ segment, fields: syncAgent.userMappingAgent.getExtractFields() });
  }).catch(err => {
    console.warn("[segmentUpdateHandler] Error ", err);
  });
}
