
export default class SyncController {

  /**
   * Sync all operation handler. It drops all Mailchimp Segments aka Audiences
   * then creates them according to `segment_mapping` settings and triggers
   * sync for all users
   */
  syncJob(req) {
    const { segmentsMappingAgent, hullAgent } = req.shipApp;
    const client = req.hull.client;

    client.logger.info("request.sync.start");

    return segmentsMappingAgent.syncSegments()
      .then(hullAgent.getSegments.bind(hullAgent))
      .then(segments => {
        return segmentsMappingAgent.syncSegments(segments);
      })
      .then(() => {
        const fields = req.shipApp.hullAgent.getExtractFields();
        return req.shipApp.extractAgent.requestExtract({ fields });
      });
  }
}
