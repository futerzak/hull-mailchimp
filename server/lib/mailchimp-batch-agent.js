import Promise from "bluebird";
import _ from "lodash";
import ps from "promise-streams";
import BatchStream from "batch-stream";

import * as helper from "./mailchimp-batch-helper";

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
  create(operations) {
    if (_.isEmpty(operations)) {
      return Promise.resolve([]);
    }

    return this.mailchimpClient
      .post("/batches")
      .send({ operations })
      .then(response => {
        const { id } = response.body;
        this.hullClient.logger.info("handleMailchimpBatchJob.create", id);
        // if there is no `operation_id` property set in this batch,
        // we don't perform next tasks on these data, so we don't queue a handler
        // here
        if (_.filter(operations, "operation_id").length === 0) {
          return Promise.resolve();
        }

        return this.queueAgent.create("handleMailchimpBatchJob", { batchId: id }, { delay: 10000 });
      })
      .catch(err => {
        return this.hullClient.logger.error("mailchimpBatchAgent.create.error", err);
      });
  }

  /**
   * checks if the batch is finished
   * @api
   */
  handleBatch(batchId, attempt) {
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
              const jobsToQueue = helper.groupByJobs(ops);

              return Promise.all(_.map(jobsToQueue, (value, key) => {
                return this.queueAgent.create(key, value);
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
