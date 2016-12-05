/**
 * Parses the extract results and queues chunks for export operations
 * @param  {String} body
 * @param  {Number} chunkSize
 * @return {Promise}
 */
export default function handleMailchimpBatch(req) {
  return req.shipApp.mailchimpAgent.batchAgent.handle(req.payload);
}
