/**
 * Makes sure that all existing Hull segments have mapped Mailchimp static segment
 */
export default function shipUpdateHandlerJob(req) {
  const { syncAgent, mailchimpAgent } = req.shipApp;
  if (!syncAgent.isConfigured()) {
    req.hull.client.logger.error("ship not configured");
    return Promise.resolve();
  }

  mailchimpAgent.ensureWebhookSubscription(req);
  return req.shipApp.hullAgent.getSegments()
    .then(segments => {
      return syncAgent.segmentsMappingAgent.syncSegments(segments)
        .then(() => syncAgent.segmentsMappingAgent.updateMapping())
        .then(() => syncAgent.interestsMappingAgent.ensureCategory())
        .then(() => syncAgent.interestsMappingAgent.syncInterests(segments));
    });
}
