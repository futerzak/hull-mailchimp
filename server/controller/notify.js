import Promise from "bluebird";
// import BatchSyncHandler from "../lib/batch-sync-handler";

export default class NotifyController {

  shipUpdateHandler(payload, { req }) {
    return Promise.resolve();
    // return req.shipApp.queueAgent.create("shipUpdateHandlerJob");
  }

  /**
   * Handles events of user
   */
  userUpdateHandler(req) {
    const { user, changes = {}, segments = [] } = req.payload;
    const { left = [] } = changes.segments || {};
    user.segment_ids = user.segment_ids || segments.map(s => s.id);
    user.remove_segment_ids = left.map(s => s.id);

    // batch grouping

    return Promise.all([
      req.shipApp.queueAgent.create("sendUsersJob", { users: [user] }),
      req.shipApp.queueAgent.create("trackEventsJob")
    ]);
  }

  /**
   * When segment is added or updated make sure its in the segments mapping,
   * and trigger an extract for that segment to update users.
   */
  segmentUpdateHandler(req) {
    const { segment } = req.payload;

    return req.shipApp.segmentsMappingAgent.updateSegment(segment)
      .then(() => {
        req.shipApp.hullAgent.requestExtract({ segment });
      });
  }

  /**
   * Removes deleted segment from Mailchimp and from ship segment
   */
  segmentDeleteHandler(req) {
    const { segment } = req.payload;
    return req.shipApp.segmentsMappingAgent.deleteSegment(segment);
  }

  /**
   * Makes sure that all existing Hull segments have mapped Mailchimp static segment
   */
  shipUpdateHandlerJob(req) {
    return req.shipApp.hullAgent.getSegments()
      .then(segments => {
        return req.shipApp.segmentsMappingAgent.syncSegments(segments);
      });
  }
}
