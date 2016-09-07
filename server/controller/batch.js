import _ from "lodash";

export default class BatchController {


  handleBatchJob(req) {
    const agent = req.shipApp.mailchimpAgent;
    const client = req.hull.client;

    client.logger.info("request.batch.start", req.payload);

    return agent.handleExtract(req.payload, users => {
      return req.shipApp.queueAgent.create("handleBatchChunkJob", { users }, {}, req);
    }).then(() => {
      client.logger.info("request.batch.end");
    });
  }

  /**
   * Parses the extract results and queues chunks for export operations
   * @param  {String} body
   * @param  {Number} chunkSize
   * @return {Promise}
   */
  handleBatchChunkJob(req) {
    const { users, segmentIds = [] } = req.payload;
    const usersToAdd = users.filter(u => !_.isEmpty(u.email) && !_.isEmpty(u.first_name) && !_.isEmpty(u.last_name));
    req.hull.client.logger.info("addUsersToAudiences.usersToAdd", { usersToAdd: usersToAdd.length, users: users.length, segmentIds });

    return req.shipApp.mailchimpAgent.getAudiencesBySegmentId()
      .then(audiences => {
        const usersToSubscribe = users; //req.shipApp.usersAgent.getUsersToSubscribe(users);
        const usersToSave = []; //req.shipApp.usersAgent.getUsersToSave(users);

        const opsToSubscribe = req.shipApp.membersAgent.subscribeMembers(usersToSubscribe, ["saveMembersJob", "saveUsersJob"]);
        const opsToSave = req.shipApp.membersAgent.saveMembers(usersToSave, audiences, segmentIds);

        const operations = _.concat(opsToSubscribe, opsToSave);

        return req.shipApp.batchAgent.create(operations);
      });

  }

  saveUsersJob(req) {
    const res = req.payload;

    return res.map(({ response, operationData }) => {
      console.log("TRAITS", operationData.user.id, {
        unique_email_id: response.unique_email_id
      });
      return req.hull.client.as(operationData.user.id).traits({
        unique_email_id: response.unique_email_id
      }, { source: "mailchimp" });
    })
  }

  saveMembersJob(req) {
    const res = req.payload;
    const usersToSave = req.shipApp.membersAgent.getMembersToSave(res);

    return req.shipApp.mailchimpAgent.getAudiencesBySegmentId()
      .then(audiences => {
        const operations = req.shipApp.membersAgent.saveMembers(usersToSave, audiences);
        console.log("ZZZ", {operations});
        return req.shipApp.batchAgent.create(operations);
      });
  }


}
