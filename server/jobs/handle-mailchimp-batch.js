/**
 * Parses the extract results and queues chunks for export operations
 * @param  {String} body
 * @param  {Number} chunkSize
 * @return {Promise}
 */
export default function handleMailchimpBatch(req) {
  const { batchId, attempt = 1, jobs = [], chunkSize } = req.payload;

  return req.shipApp.mailchimpAgent.batchAgent.handle(batchId, attempt, jobs, chunkSize);
}
