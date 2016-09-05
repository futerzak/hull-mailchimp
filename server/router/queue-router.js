export default function (deps) {
  const {
    mailchimpBatchController,
    batchController
  } = deps;

  return function QueueRouter(queueApp) {
    queueApp.attach("handleMailchimpBatchJob", mailchimpBatchController.handleMailchimpBatchJob.bind(mailchimpBatchController));
    queueApp.attach("handleBatchJob", batchController.handleBatchJob.bind(batchController));
    queueApp.attach("saveMembersJob", batchController.saveMembersJob.bind(batchController));
    queueApp.attach("saveUsersJob", batchController.saveUsersJob.bind(batchController));
    // queueApp.attach("sendUsersJob", usersController.sendUsersJob.bind(usersController));
    // queueApp.attach("syncJob", syncController.syncJob.bind(syncController));
    return queueApp;
  };
}
