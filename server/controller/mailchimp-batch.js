import _ from "lodash";
import Promise from "bluebird";

export default class MailchimpBatchController {
  /**
   * Parses the extract results and queues chunks for export operations
   * @param  {String} body
   * @param  {Number} chunkSize
   * @return {Promise}
   */
  handleMailchimpBatchJob(req) {
    const { batchId } = req.payload;

    return req.shipApp.batchAgent.handleBatch(batchId);
  }

  checkBatchQueueJob(req) {
    return req.shipApp.mailchimpAgent.checkBatchQueue();
  }
}
