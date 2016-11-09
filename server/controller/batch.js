import _ from "lodash";

export default class BatchController {
  handleBatchExtractAction(req, res) {
    res.end("ok");
    const segmentId = req.query.segment_id || null;
    req.shipApp.queueAgent.create("handleBatchExtractJob", {
      body: req.body,
      chunkSize: process.env.MAILCHIMP_BATCH_HANDLER_SIZE || 500,
      segmentId
    });
  }

  /**
   * Handles extract sent from Hull with optional setting selected segment_id
   */
  handleBatchExtractJob(req) {
    const { extractAgent, segmentsMappingAgent, queueAgent, hullAgent, mailchimpAgent } = req.shipApp;
    if (!mailchimpAgent.isShipConfigured()) {
      req.hull.client.logger.error("ship not configured");
      return Promise.resolve();
    }

    req.hull.client.logger.info("batch.handleBatchExtractJob", req.payload.body);

    return extractAgent.handleExtract(req.payload.body, req.payload.chunkSize, (users) => {
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
          if (hullAgent.userAdded(u)) {
            u.segment_ids = [];
            u.remove_segment_ids = segmentsMappingAgent.getSegmentIds();
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

      return queueAgent.create("sendUsersJob", { users });
    });
  }

  /**
   * Takes prepared list of users (with segment_ids and remove_segment_ids set properly).
   * Adds users to the list, adds users to selected Mailchimp static segments,
   * and removes them from selected segments.
   *
   * @param req Object
   */
  sendUsersJob(req) {
    const { users } = req.payload;
    const { hullAgent, mailchimpAgent, queueAgent, segmentsMappingAgent, interestsMappingAgent } = req.shipApp;

    const usersToAddToList = hullAgent.getUsersToAddToList(users);
    const usersToAddOrRemove = hullAgent.usersToAddOrRemove(users);

    req.hull.client.logger.info("sendUsersJob.ops", {
      usersToAddToList: usersToAddToList.length
    });

    return mailchimpAgent.ensureWebhookSubscription(req)
      .then(() => {
        return hullAgent.getSegments();
      })
      .then(segments => {
        return segmentsMappingAgent.syncSegments(segments)
          .then(() => segmentsMappingAgent.updateMapping())
          .then(() => interestsMappingAgent.ensureCategory())
          .then(() => interestsMappingAgent.syncInterests(segments));
      })
      .then(() => {
        return mailchimpAgent.addToList(usersToAddToList);
      })
      .then(res => {
        if (!_.isEmpty(res.body.errors)) {
          return queueAgent.create("updateUsersJob", res.body.errors);
        }
        return true;
      })
      .then(() => {
        return mailchimpAgent.saveToAudiences(usersToAddOrRemove);
      })
      .catch((err = {}) => {
        console.log("sendUsersJob.error", err.message);
        return Promise.reject(err);
      });
  }

  updateUsersJob({ payload = [], shipApp = {}, hull }) {
    const { hullAgent } = shipApp;
    hull.client.logger.info("updateUsersJob", payload.length);
    return Promise.all(payload.map((member) => {
      if (_.get(member, "error")) {
        return hull.client.as({ email: member.email_address }).traits({
          import_error: member.error
        }, { source: "mailchimp" });
      }
      return hullAgent.updateUser(member);
    }));
  }

  importUsersJob(req) {
    const { hullAgent } = req.shipApp;
    req.hull.client.logger.info("importUsersJob", req.payload.members.length);
    const { members = [] } = req.payload;
    req.hull.client.logger.info("importUsersJob", members.length);
    return members.map(member => {
      return hullAgent.updateUser(member);
    });
  }
}
