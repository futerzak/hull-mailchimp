import _ from "lodash";

export default class BatchController {
  handleBatchExtractAction(req, res) {
    const segmentId = req.query.segment_id || null;
    return req.shipApp.queueAgent.create("handleBatchExtractJob", {
      body: req.body,
      chunkSize: 100,
      segmentId
    })
    .then(() => res.end("ok"));
  }

  /**
   * Handles extract sent from Hull with optional setting selected segment_id
   */
  handleBatchExtractJob(req) {
    return req.shipApp.hullAgent.handleExtract(req.payload.body, req.payload.chunkSize, (users) => {
      if (req.payload.segmentId) {
        users = users.map(u => {
          u.segment_ids = _.uniq(_.concat(u.segment_ids || [], [req.payload.segmentId]));
          return u;
        });
      }
      return req.shipApp.queueAgent.create("sendUsersJob", { users });
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
    const usersToAddToAudiences = hullAgent.getUsersToAddToAudiences(users);
    const usersToRemoveFromAudiences = hullAgent.getUsersToRemoveFromAudiences(users);

    const addToListOps = mailchimpAgent.getAddToListOps(usersToAddToList, ["addToAudiencesJob"]);
    const addToAudiencesOps = mailchimpAgent.getAddToAudiencesOps(usersToAddToAudiences);
    const removeFromAudiencesOps = mailchimpAgent.getRemoveFromAudiencesOp(usersToRemoveFromAudiences);

    const ops = _.concat(addToListOps, addToAudiencesOps, removeFromAudiencesOps);

    return mailchimpBatchAgent.create(ops);
  }


  /**
   * this is a job triggered after successfull `sendUsersJob` with users who needed
   * to be saved to mailchimp list before anything else
   */
  addToAudiencesJob(req) {
    const operations = req.payload;
    const { mailchimpAgent, mailchimpBatchAgent } = req.shipApp;

    const usersToAddToAudiences = mailchimpAgent.getUsersFromOperations(operations);

    const addToAudiencesOps = mailchimpAgent.getAddToAudiencesOps(usersToAddToAudiences);

    const ops = _.concat(addToAudiencesOps);

    return mailchimpBatchAgent.create(ops);
  }
}
