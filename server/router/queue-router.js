export default function (deps) {
  const {
    mailchimpBatchController,
    batchController,
    syncController,
    trackController
  } = deps;

  return function QueueRouter(queueApp) {
    queueApp.attach("handleMailchimpBatchJob", mailchimpBatchController.handleMailchimpBatchJob.bind(mailchimpBatchController));
    queueApp.attach("checkBatchQueueJob", mailchimpBatchController.checkBatchQueueJob.bind(mailchimpBatchController));
    queueApp.attach("handleBatchJob", batchController.handleBatchJob.bind(batchController));
    queueApp.attach("handleBatchChunkJob", batchController.handleBatchChunkJob.bind(batchController));
    queueApp.attach("saveMembersJob", batchController.saveMembersJob.bind(batchController));
    queueApp.attach("saveUsersJob", batchController.saveUsersJob.bind(batchController));
    queueApp.attach("syncJob", syncController.syncJob.bind(syncController));
    queueApp.attach("requestTrackJob", trackController.requestTrackJob.bind(trackController));
    queueApp.attach("trackJob", trackController.trackJob.bind(trackController));
    queueApp.attach("trackChunkJob", trackController.trackChunkJob.bind(trackController));
    queueApp.attach("handleEmailsActivitiesJob", trackController.handleEmailsActivitiesJob.bind(trackController));
    return queueApp;
  };
}
