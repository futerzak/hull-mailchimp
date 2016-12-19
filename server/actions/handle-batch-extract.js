export default function handleBatchExtractAction(req, res, next) {
  const segmentId = req.query.segment_id || null;
  req.shipApp.queueAgent.create("handleBatchExtract", {
    body: req.body,
    chunkSize: process.env.MAILCHIMP_BATCH_HANDLER_SIZE || 500,
    segmentId
  })
  .then(next, next);
}
