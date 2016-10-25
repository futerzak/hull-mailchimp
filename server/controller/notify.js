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
    const { changes = {} } = payload.message;
    if (!_.isEmpty(_.get(changes, "user['traits_mailchimp/unique_email_id'][1]"))
      || !_.isEmpty(_.get(changes, "user['traits_mailchimp/import_error'][1]"))) {
      req.hull.client.logger.info("user skipped");
      return Promise.resolve();
    }

    return BatchSyncHandler.getHandler({
      hull: req.hull,
      ship: req.hull.ship,
      options: {
        maxSize: process.env.NOTIFY_BATCH_HANDLER_SIZE || 100,
        throttle: process.env.NOTIFY_BATCH_HANDLER_THROTTLE || 30000
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
    const { hullAgent, segmentsMappingAgent, queueAgent, mailchimpAgent } = req.shipApp;

    if (!mailchimpAgent.isShipConfigured()) {
      req.hull.client.logger.error("ship not configured");
      return Promise.resolve();
    }

    req.hull.client.logger.info("userUpdateHandlerJob", req.payload.messages.length);
    const users = _.filter(_.map(req.payload.messages, (message) => {
      const { user, changes = {}, segments = [] } = message;
      const { left = [] } = changes.segments || {};
      user.segment_ids = _.uniq(_.concat(user.segment_ids || [], segments.map(s => s.id)));
      // if the user is within the whitelist add it to all segments he's in
      // if the use is outside the whitelist and was already saved to mailchimp
      // remove it from all segments, if he is outside the whitelist
      // and wasn't saved remove it from the batch
      if (hullAgent.userWhitelisted(user)) {
        user.remove_segment_ids = left.map(s => s.id);
      } else {
        if (hullAgent.userAdded(user)) {
          user.segment_ids = [];
          user.remove_segment_ids = segmentsMappingAgent.getSegmentIds();
        } else {
          return false;
        }
      }
      return user;
    })).map(user => {
      return _.pickBy(user, (v, k) => {
        return _.includes(["segment_ids", "first_name", "last_name", "id", "email"], k) || k.match(/mailchimp/);
      });
    });

    const usersToTrack = users.filter(u => {
      return hullAgent.userAdded(u) && hullAgent.userWhitelisted(u);
    });

    const promises = [];
    if (users.length > 0) {
      promises.push(queueAgent.create("sendUsersJob", { users }));
    }
    if (usersToTrack.length > 0) {
      promises.push(queueAgent.create("trackUsersJob", { users: usersToTrack }));
    }
    return Promise.all(promises);
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
    const { interestsMappingAgent, segmentsMappingAgent, extractAgent, hullAgent, mailchimpAgent } = req.shipApp;

    if (!mailchimpAgent.isShipConfigured()) {
      req.hull.client.logger.error("ship not configured");
      return Promise.resolve();
    }

    const agents = [
      interestsMappingAgent,
      segmentsMappingAgent
    ];

    return Promise.mapSeries(
      agents,
      agent => agent.recreateSegment(segment)
    ).then(() => {
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
    const { segmentsMappingAgent, mailchimpAgent } = req.shipApp;
    if (!mailchimpAgent.isShipConfigured()) {
      req.hull.client.logger.error("ship not configured");
      return Promise.resolve();
    }
    return segmentsMappingAgent.deleteSegment(segment)
      .then(segmentsMappingAgent.updateMapping.bind(segmentsMappingAgent));
  }

  /**
   * Makes sure that all existing Hull segments have mapped Mailchimp static segment
   */
  shipUpdateHandlerJob(req) {
    const { segmentsMappingAgent, mailchimpAgent } = req.shipApp;
    if (!mailchimpAgent.isShipConfigured()) {
      req.hull.client.logger.error("ship not configured");
      return Promise.resolve();
    }

    mailchimpAgent.ensureWebhookSubscription(req);

    return req.shipApp.hullAgent.getSegments()
      .then(segments => {
        return segmentsMappingAgent.syncSegments(segments)
          .then(segmentsMappingAgent.updateMapping.bind(segmentsMappingAgent));
      });
  }
}
