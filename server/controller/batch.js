import _ from "lodash";

export default class BatchController {
  handleBatchExtractAction(req, res) {
    res.end("ok");
    const segmentId = req.query.segment_id || null;
    req.shipApp.queueAgent.create("handleBatchExtractJob", {
      body: req.body,
      chunkSize: process.env.MAILCHIMP_BATCH_HANDLER_SIZE || 100,
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
    const { hullAgent, mailchimpAgent, mailchimpBatchAgent } = req.shipApp;

    const usersToAddToList = hullAgent.getUsersToAddToList(users);
    const usersToAddOrRemove = hullAgent.usersToAddOrRemove(users);

    const addToListOps = mailchimpAgent.getAddToListOps(usersToAddToList, ["addToAudiencesJob", "updateUsersJob"]);
    const addToAudiencesOps = mailchimpAgent.getAddToAudiencesOps(usersToAddOrRemove);
    const removeFromAudiencesOps = mailchimpAgent.getRemoveFromAudiencesOp(usersToAddOrRemove);

    req.hull.client.logger.info("sendUsersJob.ops", {
      addToListOps: addToListOps.length,
      addToAudiencesOps: addToAudiencesOps.length,
      removeFromAudiencesOps: removeFromAudiencesOps.length
    });

    const ops = _.concat(addToListOps, addToAudiencesOps, removeFromAudiencesOps);

    return mailchimpBatchAgent.create(ops);
  }


  /**
   * this is a job triggered after successfull `sendUsersJob` with users who needed
   * to be saved to mailchimp list before anything else
   */
  addToAudiencesJob(req) {
    const operations = req.payload;
    req.hull.client.logger.info("addToAudiencesJob", operations.length);
    const { mailchimpAgent, mailchimpBatchAgent } = req.shipApp;
    // TODO: check if mailchimp operation was successful
    const usersToAddToAudiences = mailchimpAgent.getUsersFromOperations(operations);

    const addToAudiencesOps = mailchimpAgent.getAddToAudiencesOps(usersToAddToAudiences);

    const ops = _.concat(addToAudiencesOps);

    return mailchimpBatchAgent.create(ops);
  }

  updateUsersJob(req) {
    const operations = req.payload;
    req.hull.client.logger.info("updateUsersJob", operations.length);
    return Promise.all(operations.map(({ response, data }) => {
      const traits = req.shipApp.hullAgent.mailchimpFields.reduce((t, path) => {
        const key = _.last(path.split("."));
        const value = _.get(response, path);
        if (!_.isNil(value)) {
          t[key] = value;
        }
        return t;
      }, {});

      if (response.status === 200) {
        traits.unique_email_id = response.unique_email_id;
      } else {
        traits.import_error = response.detail;
      }

      return req.hull.client.as(data.user.id).traits(traits, {
        source: "mailchimp"
      });
    }));
  }
}
