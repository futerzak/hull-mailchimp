export default function (deps) {
  const {
    mailchimpBatchController,
    batchController,
    syncController,
    trackController,
    notifyController
  } = deps;

  return function QueueRouter(queueApp) {
    queueApp.attach("handleMailchimpBatchJob", mailchimpBatchController.handleMailchimpBatchJob);
    queueApp.attach("checkBatchQueueJob", mailchimpBatchController.checkBatchQueueJob);
    queueApp.attach("handleBatchJob", batchController.handleBatchJob);
    queueApp.attach("handleBatchChunkJob", batchController.handleBatchChunkJob);
    queueApp.attach("saveMembersJob", batchController.saveMembersJob);
    queueApp.attach("saveUsersJob", batchController.saveUsersJob);
    queueApp.attach("syncJob", syncController.syncJob);
    queueApp.attach("requestTrackJob", trackController.requestTrackJob);
    queueApp.attach("trackJob", trackController.trackJob);
    queueApp.attach("trackChunkJob", trackController.trackChunkJob);
    queueApp.attach("handleEmailsActivitiesJob", trackController.handleEmailsActivitiesJob);
    queueApp.attach("shipUpdateHandlerJob", notifyController.shipUpdateHandlerJob);
    return queueApp;
  };
}
