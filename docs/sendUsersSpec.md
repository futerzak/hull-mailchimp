```javascript
/**
 * Takes prepared list of users (with segment_ids and remove_segment_ids set properly).
 * Adds users to the list, adds users to selected Mailchimp static segments,
 * and removes them from selected segments.
 *
 * @param req Object
 */
sendUsersJob(req) {
  const { users } = req.payload;

  const { hullAgent, mailchimpAgent } = req.shipApp;

  const usersToAddToList = hullAgent.getUsersToAddToList(users);
  const usersToAddToAudiences = hullAgent.getUsersToAddToAudiences(users);
  const usersToRemoveFromAudiences = hullAgent.getUsersToRemoveFromAudiences(users);

  const addToListOps = mailchimpAgent.getAddToListOps(usersToAddToList, ["addToAudiencesJob"]);
  const addToAudiencesOps = mailchimpAgent.getAddToAudiencesOps(usersToAddToAudiences);
  const removeFromAudiencesOps = mailchimpAgent.getRemoveFromAudiencesOp(usersToRemoveFromAudiences);

  const ops = _.concat(addToListOps, addToAudiencesOps, removeFromAudiencesOps);

  return req.shipApp.mailchimpBatchAgent.create(ops);
}

addToAudiencesJob(req) {
  const operations = req.payload;


}

```
