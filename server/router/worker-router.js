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

    queueApp.attach("handleBatchExtractJob", batchController.handleBatchExtractJob);
    queueApp.attach("sendUsersJob", batchController.sendUsersJob);
    queueApp.attach("addToAudiencesJob", batchController.addToAudiencesJob);
    queueApp.attach("updateUsersJob", batchController.updateUsersJob);

    queueApp.attach("syncJob", syncController.syncJob);

    queueApp.attach("requestTrackJob", trackController.requestTrackJob);
    queueApp.attach("trackJob", trackController.trackJob);
    queueApp.attach("trackChunkJob", trackController.trackChunkJob);
    queueApp.attach("handleEmailsActivitiesJob", trackController.handleEmailsActivitiesJob);

    queueApp.attach("shipUpdateHandlerJob", notifyController.shipUpdateHandlerJob);
    queueApp.attach("segmentUpdateHandlerJob", notifyController.segmentUpdateHandlerJob);
    queueApp.attach("segmentDeleteHandlerJob", notifyController.segmentDeleteHandlerJob);
    queueApp.attach("userUpdateHandlerJob", notifyController.userUpdateHandlerJob);

    return queueApp;
  };
}
