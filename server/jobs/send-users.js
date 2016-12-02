import _ from "lodash";

/**
 * Takes prepared list of users (with segment_ids and remove_segment_ids set properly).
 * Adds users to the list, adds users to selected Mailchimp static segments,
 * and removes them from selected segments.
 *
 * @param req Object
 */
export default function sendUsersJob(req) {
  const { users } = req.payload;
  const { hullAgent, mailchimpAgent, queueAgent, syncAgent } = req.shipApp;

  const usersToAddToList = syncAgent.getUsersToAddToList(users);
  const usersToAddOrRemove = syncAgent.usersToAddOrRemove(users);

  req.hull.client.logger.info("sendUsersJob.ops", {
    usersToAddToList: usersToAddToList.length
  });

  return mailchimpAgent.ensureWebhookSubscription(req)
    .then(() => {
      return hullAgent.getSegments();
    })
    .then(segments => {
      return syncAgent.segmentsMappingAgent.syncSegments(segments)
        .then(() => syncAgent.segmentsMappingAgent.updateMapping())
        .then(() => syncAgent.interestsMappingAgent.ensureCategory())
        .then(() => syncAgent.interestsMappingAgent.syncInterests(segments));
    })
    .then(() => {
      return syncAgent.addToList(usersToAddToList);
    })
    .then(res => {
      if (!_.isEmpty(res.body.errors)) {
        return queueAgent.create("updateUsers", res.body.errors);
      }
      return true;
    })
    .then(() => {
      return syncAgent.saveToAudiences(usersToAddOrRemove);
    })
    .catch((err = {}) => {
      console.log("sendUsersJob.error", err.message);
      return Promise.reject(err);
    });
}
