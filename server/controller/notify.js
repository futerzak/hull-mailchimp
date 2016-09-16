import Promise from "bluebird";
import _ from "lodash";
import BatchSyncHandler from "../lib/batch-sync-handler";

export default class NotifyController {

  shipUpdateHandler(payload, { req }) {
    return req.shipApp.queueAgent.create("shipUpdateHandlerJob");
  }

  /**
   * Handles events of user
   */
  userUpdateHandler(payload, { req }) {
    return BatchSyncHandler.getHandler({
      hull: req.hull,
      ship: req.hull.ship,
      options: {
        maxSize: 100,
        throttle: 30000
      }
    }).setCallback(messages => {
      return req.shipApp.queueAgent.create("userUpdateHandlerJob", { messages });
    })
    .add(payload.message);
  }

  /**
   * Handles events of user
   */
  userUpdateHandlerJob(req) {
    const { hullAgent, segmentsMappingAgent, queueAgent } = req.shipApp;

    const users = _.map(req.payload.messages, (message) => {
      const { user, changes = {}, segments = [] } = message;
      const { left = [] } = changes.segments || {};

      if (hullAgent.userWhitelisted(user)) {
        user.segment_ids = user.segment_ids || segments.map(s => s.id);
        user.remove_segment_ids = left.map(s => s.id);
      } else {
        user.segment_ids = [];
        user.remove_segment_ids = segmentsMappingAgent.getSegmentIds();
      }

      return user;
    });

    return Promise.all([
      queueAgent.create("sendUsersJob", { users }),
      // req.shipApp.queueAgent.create("trackEventsJob")
    ]);
  }

  /**
   * When segment is added or updated make sure its in the segments mapping,
   * and trigger an extract for that segment to update users.
   */
  segmentUpdateHandler(payload, { req }) {
    return req.shipApp.queueAgent.create("segmentUpdateHandlerJob", { segment: payload.message });
  }

  segmentUpdateHandlerJob(req) {
    const { segment } = req.payload;
    const { segmentsMappingAgent, extractAgent, hullAgent } = req.shipApp;

    return segmentsMappingAgent.createSegment(segment)
      .then(segmentsMappingAgent.updateMapping.bind(segmentsMappingAgent))
      .then(() => {
        return extractAgent.requestExtract({ segment, fields: hullAgent.getExtractFields() });
      });
  }

  segmentDeleteHandler(payload, { req }) {
    return req.shipApp.queueAgent.create("segmentDeleteHandlerJob", { segment: payload.message });
  }

  /**
   * Removes deleted segment from Mailchimp and from ship segment
   */
  segmentDeleteHandlerJob(req) {
    const { segment } = req.payload;
    const { segmentsMappingAgent } = req.shipApp;
    return segmentsMappingAgent.deleteSegment(segment)
      .then(segmentsMappingAgent.updateMapping.bind(segmentsMappingAgent));
  }

  /**
   * Makes sure that all existing Hull segments have mapped Mailchimp static segment
   */
  shipUpdateHandlerJob(req) {
    const { segmentsMappingAgent } = req.shipApp;
    return req.shipApp.hullAgent.getSegments()
      .then(segments => {
        return segmentsMappingAgent.syncSegments(segments)
          .then(segmentsMappingAgent.updateMapping.bind(segmentsMappingAgent));
      });
  }
}
