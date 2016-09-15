export default class MailchimpBatchController {
  /**
   * Parses the extract results and queues chunks for export operations
   * @param  {String} body
   * @param  {Number} chunkSize
   * @return {Promise}
   */
  handleMailchimpBatchJob(req) {
    const { batchId } = req.payload;

    return req.shipApp.mailchimpBatchAgent.handleBatch(batchId);
  }

  checkBatchQueueJob(req) {
    console.log("!!!!");
    return req.shipApp.mailchimpAgent.checkBatchQueue();
  }
}
