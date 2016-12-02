/**
 * Sync all operation handler. It drops all Mailchimp Segments aka Audiences
 * then creates them according to `segment_mapping` settings and triggers
 * sync for all users
 */
export default function syncOutJob(req) {
  const { syncAgent, hullAgent } = req.shipApp;
  const client = req.hull.client;

  client.logger.info("request.sync.start");

  return syncAgent.segmentsMappingAgent.syncSegments()
    .then(() => syncAgent.interestsMappingAgent.syncInterests())
    .then(() => hullAgent.getSegments())
    .then(segments => {
      return syncAgent.interestsMappingAgent.syncInterests(segments)
        .then(() => syncAgent.segmentsMappingAgent.syncSegments(segments));
    })
    .then(() => {
      const fields = syncAgent.userMappingAgent.getExtractFields();
      return hullAgent.extractAgent.requestExtract({ fields });
    });
}
