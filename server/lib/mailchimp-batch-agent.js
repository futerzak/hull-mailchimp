import Promise from "bluebird";
import _ from "lodash";
import ps from "promise-streams";
import BatchStream from "batch-stream";

/**
 * Class responsible for working with Mailchimp batches
 * @see http://developer.mailchimp.com/documentation/mailchimp/reference/batches/
 */
export default class MailchimpBatchAgent {

  constructor(hullClient, mailchimpClient, queueAgent) {
    this.hullClient = hullClient;
    this.mailchimpClient = mailchimpClient;
    this.queueAgent = queueAgent;
  }

  /**
   * creates new batch with provided operations and then creates a job
   * to handle the results
   * @api
   */
  create(operations, jobs = []) {
    if (_.isEmpty(operations)) {
      return Promise.resolve([]);
    }

    return this.mailchimpClient
      .post("/batches")
      .send({ operations })
      .then(response => {
        const { id } = response.body;
        this.hullClient.logger.info("handleMailchimpBatchJob.create", id);
        // if jobs argument is empty, we don't perform next tasks on
        // returned data, so we don't need to queue a handler here
        if (_.isEmpty(jobs)) {
          return Promise.resolve();
        }

        return this.queueAgent.create("handleMailchimpBatchJob", { batchId: id, jobs }, { delay: process.env.MAILCHIMP_BATCH_HANDLER_INTERVAL || 10000 });
      })
      .catch(err => {
        return this.hullClient.logger.error("mailchimpBatchAgent.create.error", err);
      });
  }

  /**
   * checks if the batch is finished
   * @api
   */
  handle(batchId, attempt, jobs = []) {
    return this.mailchimpClient
      .get(`/batches/${batchId}`)
      .then((response) => {
        const batchInfo = response.body;
        this.hullClient.logger.info("mailchimpBatchAgent.handleBatch", _.omit(batchInfo, "_links"));
        if (batchInfo.status !== "finished") {
          attempt++;
          return this.queueAgent.create("handleMailchimpBatchJob", {
            batchId, attempt
          }, {
            delay: process.env.MAILCHIMP_BATCH_HANDLER_INTERVAL || 10000
          });
        }

        if (batchInfo.total_operations === 0
          || _.isEmpty(batchInfo.response_body_url)) {
          return Promise.resolve([]);
        }

        return this.mailchimpClient.handleResponse(batchInfo)
          .pipe(new BatchStream({ size: process.env.MAILCHIMP_BATCH_HANDLER_SIZE || 100 }))
          .pipe(ps.map((ops) => {
            try {
              return Promise.all(_.map(jobs, (job) => {
                return this.queueAgent.create(job, ops);
              }));
            } catch (e) {
              console.error(e);
              return Promise.reject(e);
            }
          }))
          .wait();
      });
  }
}
