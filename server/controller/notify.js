import Promise from "bluebird";
import _ from "lodash";

import BatchSyncHandler from "../lib/batch-sync-handler";

export default class NotifyController {

  //
  // "user:update": ({ changes = {} }, { req }) => {
  //   if (
  //     !_.isEmpty(_.get(changes, "user['traits_mailchimp/unique_email_id'][1]"))
  //     || (
  //       _.isEmpty(_.get(changes.segments.left, []))
  //       && _.isEmpty(_.get(changes.segments.entered, []))
  //     )
  //   ) {
  //     console.log("handleUserUpdate.skippingUser", _.get(changes, "user['traits_mailchimp/unique_email_id'][1]"));
  //   } else {
  //     queueAgent.queueRequest(req);
  //   }
  // },

  userUpdateHandler(payload, { req }) {
    const message = payload.message;

    const { user, changes = {} } = message;

    if (_.get(changes, "user['traits_hubspot/fetched_at'][1]", false)) {
      return Promise.resolve();
    }

    return BatchSyncHandler.getHandler({
      hull: req.hull,
      ship: req.hull.ship,
      options: {
        maxSize: 100,
        throttle: 30000
      }
    }).setCallback((messages) => {

      return req.shipApp.mailchimpAgent.getAudiencesBySegmentId()
        .then(audiences => {
          console.log("TEST", audiences);
          const res = req.shipApp.usersAgent.getUsersFromMessages(messages, audiences);
          console.log(res);
        });
      // return req.shipApp.queueAgent.create("handleBatchJob", { messages });
    })
    .add(message);
  }

  shipUpdateHandler(payload, { req }) {
    const message = payload.message; // eslint-disable-line no-unused-vars
    return req.shipApp.mailchimpAgent.handleShipUpdate();
  }

  segmentUpdateHandler(payload, { req }) {
    const message = payload.message; // eslint-disable-line no-unused-vars
    return req.shipApp.mailchimpAgent.handleSegmentUpdate();
  }

  segmentDeleteHandler(payload, { req }) {
    const message = payload.message; // eslint-disable-line no-unused-vars
    return req.shipApp.mailchimpAgent.handleSegmentDelete();
  }
}
