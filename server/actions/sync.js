import Promise from "bluebird";

/**
 * Queue SyncOut and SyncIn jobs here. We cannot guarantee the order
 * of these operations to be finished since both of them include
 * requesting userbase extract from Hull API and Mailchimp API.
 */
export default function sync(req, res, next) {
  return Promise.all([
    req.shipApp.queueAgent.create("syncOut"),
    req.shipApp.queueAgent.create("syncIn")
  ]).then(next, next);
}
