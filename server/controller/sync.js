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
      .then(() => interestsMappingAgent.syncInterests())
      .then(() => hullAgent.getSegments())
      .then(segments => {
        return interestsMappingAgent.syncInterests(segments)
          .then(() => segmentsMappingAgent.syncSegments(segments));
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
    const exclude = [
      "_links",
      "members._links",
    ];
    const op = {
      method: "GET",
      path: `/lists/${mailchimpAgent.listId}/members`,
      params: {
        exclude_fields: exclude.join(",")
      }
    };
    return mailchimpBatchAgent.create([op], ["importUsersJob"], 1);
  }

}
