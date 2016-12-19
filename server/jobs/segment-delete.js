/**
 * Removes deleted segment from Mailchimp and from ship segment
 */
export default function segmentDeleteHandlerJob(req) {
  const { segment } = req.payload;
  const { syncAgent } = req.shipApp;
  if (!syncAgent.isConfigured()) {
    req.hull.client.logger.error("ship not configured");
    return Promise.resolve();
  }
  return syncAgent.segmentsMappingAgent.deleteSegment(segment)
    .then(() => syncAgent.segmentsMappingAgent.updateMapping());
}
