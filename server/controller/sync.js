import Promise from "bluebird";

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
        const segmentIds = req.hull.ship.private_settings.synchronized_segments || [];
        const fields = req.shipApp.hullAgent.getExtractFields();
        if (segmentIds.length === 0) {
          return req.shipApp.extractAgent.requestExtract({ fields });
        }
        return Promise.map(segmentIds, segmentId => {
          return req.shipApp.extractAgent.requestExtract({ segment: { id: segmentId }, fields });
        });
      });
  }
}
