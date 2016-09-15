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

    return this.mailchimpClientRequest
      .post("/batches")
      .send({ operations })
      .then(response => {
        const { id } = response.body;
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
  handleBatch(batchId) {
    return this.mailchimpClientRequest.get(`/batches/${batchId}`)
      .then((response) => {
        const batchInfo = response.body;
        console.log(_.omit(batchInfo, "_links"));
        if (batchInfo.status !== "finished") {
          return this.queueAgent.create("handleMailchimpBatchJob", { batchId }, { delay: 10000 });
        }

        if (batchInfo.total_operations === 0
          || _.isEmpty(batchInfo.response_body_url)) {
          return Promise.resolve([]);
        }

        return this.mailchimpClient.handleResponse(batchInfo)
          .pipe(new BatchStream({ size: 100 }))
          .pipe(ps.map((ops) => {
            try {
              const jobsToQueue = helper.groupByJobs(ops);

              return Promise.all(_.map(jobsToQueue, (value, key) => {
                return this.queueAgent.create(key, value);
              }));
            } catch (e) {
              console.error(e);
              throw e;
            }
          }))
          .wait();
      });
  }

  // /**
  //  * Method groups returned operations by `nextOperations` property
  //  * and then queues it for further processing with additional data
  //  */
  // handleOperations(ops) {
  //   const jobsToQueue = _.reduce(ops, (jobs, op) => {
  //     const operationId = op.operation_id;
  //     if (operationId) {
  //       const operationData = JSON.parse(operationId);
  //       const jobNames = operationData.nextOperations;
  //       jobNames.map((jobName) => {
  //         const jobsArray = jobs[jobName] = jobs[jobName] || [];
  //         const response = _.omit(JSON.parse(op.response), "_links");
  //         jobsArray.push({
  //           response,
  //           operationData: _.omit(operationData, "nextOperations")
  //         });
  //       });
  //     }
  //     return jobs;
  //   }, {});
  //   return Promise.all(_.map(jobsToQueue, (value, key) => {
  //     return this.queueAgent.create(key, value);
  //   }));
  // }
  //
  // getOperationId(jobs = [], data = {}) {
  //   return JSON.stringify({
  //     jobs,
  //     data
  //   });
  // }
}
