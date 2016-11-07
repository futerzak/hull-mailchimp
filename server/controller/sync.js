import Promise from "bluebird";

export default class SyncController {

  /**
   * Sync all operation handler. It drops all Mailchimp Segments aka Audiences
   * then creates them according to `segment_mapping` settings and triggers
   * sync for all users
   */
  syncOutJob(req) {
    const { segmentsMappingAgent, interestsMappingAgent, hullAgent } = req.shipApp;
    const client = req.hull.client;

    client.logger.info("request.sync.start");

    return segmentsMappingAgent.syncSegments()
      .then(hullAgent.getSegments.bind(hullAgent))
      .then(segments => {
        return Promise.all(segments.map(segment => interestsMappingAgent.recreateSegment(segment)))
          .then(() => {
            return segmentsMappingAgent.syncSegments(segments);
          });
      })
      .then(() => {
        const fields = req.shipApp.hullAgent.getExtractFields();
        return req.shipApp.extractAgent.requestExtract({ fields });
      });
  }


  /**
   * SyncIn : import all the list members as hull users
   */
  syncInJob(req) {
    const { mailchimpBatchAgent, mailchimpAgent } = req.shipApp;
    const op = {
      method: "GET",
      path: `/lists/${mailchimpAgent.listId}/members`,
    };
    return mailchimpBatchAgent.create([op], ["importUsersJob"]);
  }

}
