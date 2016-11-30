export default class MailchimpBatchController {
  /**
   * Parses the extract results and queues chunks for export operations
   * @param  {String} body
   * @param  {Number} chunkSize
   * @return {Promise}
   */
  handleMailchimpBatchJob(req) {
    const { batchId, attempt = 1, jobs = [], chunkSize } = req.payload;

    return req.shipApp.mailchimpBatchAgent.handle(batchId, attempt, jobs, chunkSize);
  }
}
