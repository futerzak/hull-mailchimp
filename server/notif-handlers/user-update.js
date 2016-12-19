import _ from "lodash";

import BatchSyncHandler from "../util/handler/batch-sync";

/**
 * Handles events of user
 */
export default function userUpdateHandler(payload, { req }) {
  const { changes = {} } = payload.message;
  if (!_.isEmpty(_.get(changes, "user['traits_mailchimp/unique_email_id'][1]"))
    || !_.isEmpty(_.get(changes, "user['traits_mailchimp/import_error'][1]"))
    || !_.isEmpty(_.get(changes, "user['traits_mailchimp/last_changed'][1]"))) {
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
    return req.shipApp.queueAgent.create("userUpdate", { messages });
  })
  .add(payload.message);
}
