import _ from "lodash";

/**
 * Handles events of user
 */
export default function userUpdateHandlerJob(req) {
  const { hullAgent, segmentsMappingAgent, queueAgent, syncAgent } = req.shipApp;

  if (!syncAgent.isConfigured()) {
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
      if (syncAgent.userAdded(user)) {
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

  // eslint-disable-next-line no-unused-vars
  const usersToTrack = users.filter(u => {
    return syncAgent.userAdded(u) && hullAgent.userWhitelisted(u);
  });

  const promises = [];
  if (users.length > 0) {
    promises.push(queueAgent.create("sendUsers", { users }));
  }

  if (usersToTrack.length > 0) {
    promises.push(queueAgent.create("trackUsers", { users: usersToTrack }));
  }

  return Promise.all(promises);
}
