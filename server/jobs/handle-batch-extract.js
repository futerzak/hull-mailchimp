import _ from "lodash";

/**
 * Handles extract sent from Hull with optional setting selected segment_id
 */
export default function handleBatchExtract(req) {
  const { syncAgent, queueAgent, hullAgent } = req.shipApp;

  req.hull.client.logger.info("batch.handleBatchExtract", req.payload.body);

  return hullAgent.extractAgent.handleExtract(req.payload.body, req.payload.chunkSize, (users) => {
    // if the extract contains segmentId information apply it to all users
    if (req.payload.segmentId) {
      users = users.map(u => {
        u.segment_ids = _.uniq(_.concat(u.segment_ids || [], [req.payload.segmentId]));
        return u;
      });
    }
    // apply whitelist filtering
    users = _.filter(users.map(u => {
      // if the user is outside the whitelist, remove it from all segments
      // and don't add to any new segment
      if (!hullAgent.userWhitelisted(u)) {
        if (syncAgent.userAdded(u)) {
          u.segment_ids = [];
          u.remove_segment_ids = syncAgent.segmentsMappingAgent.getSegmentIds();
        } else {
          return null;
        }
      }
      return u;
    }));

    users = users.map(user => {
      return _.pickBy(user, (v, k) => {
        return _.includes(["first_name", "last_name", "id", "email", "segment_ids"], k) || k.match(/mailchimp/);
      });
    });

    return queueAgent.create("sendUsers", { users });
  });
}
