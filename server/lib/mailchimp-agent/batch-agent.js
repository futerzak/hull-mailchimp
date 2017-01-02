import Promise from "bluebird";
import _ from "lodash";
import ps from "promise-streams";
import BatchStream from "batch-stream";
import es from "event-stream";
import moment from "moment";


/**
 * Class responsible for working with Mailchimp batches
 * @see http://developer.mailchimp.com/documentation/mailchimp/reference/batches/
 * TODO: integrate with MailchimpAgent
 */
export default class MailchimpBatchAgent {

  constructor(hullClient, mailchimpClient, queueAgent, instrumentationAgent) {
    this.hullClient = hullClient;
    this.mailchimpClient = mailchimpClient;
    this.queueAgent = queueAgent;
    this.instrumentationAgent = instrumentationAgent;
  }

  /**
   * creates new batch with provided operations and then creates a job
   * to handle the results
   * @api
   */
  create(options) {
    _.defaults(options, {
      chunkSize: process.env.MAILCHIMP_BATCH_HANDLER_SIZE || 100,
      additionalData: {},
      extractField: null
    });

    const { operations, jobs = [] } = options;

    if (_.isEmpty(operations)) {
      return Promise.resolve([]);
    }
    this.instrumentationAgent.metricInc("batch_job.count");
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
        options.batchId = id;
        return this.queueAgent.create("handleMailchimpBatch", options, { delay: process.env.MAILCHIMP_BATCH_HANDLER_INTERVAL || 10000 });
      })
      .catch(err => {
        const filteredError = this.mailchimpClient.handleError(err);
        this.hullClient.logger.error("mailchimpBatchAgent.create.error", filteredError.message);
        return Promise.reject(filteredError);
      });
  }

  /**
   * checks if the batch is finished
   * @api
   */
  handle(options) {
    const { batchId, attempt = 1, jobs = [], chunkSize, extractField, additionalData } = options;
    return this.mailchimpClient
      .get(`/batches/${batchId}`)
      .then((response) => {
        const batchInfo = response.body;
        this.hullClient.logger.info("mailchimpBatchAgent.handleBatch", _.omit(batchInfo, "_links"));
        if (batchInfo.status !== "finished") {
          if (attempt < 6000) {
            options.attempt++;
            return this.queueAgent.create("handleMailchimpBatch", options, {
              delay: process.env.MAILCHIMP_BATCH_HANDLER_INTERVAL || 10000
            });
          }
          this.instrumentationAgent.metricInc("batch_job.hanged");
          this.hullClient.logger.error("mailchimpBatchAgent.batch_job_hanged", _.omit(batchInfo, "_links"));
          return this.mailchimpClient.delete(`/batches/${batchId}`);
        }

        this.instrumentationAgent.metricVal("batch_job.attempts", attempt);
        this.instrumentationAgent.metricVal(
          "batch_job.completion_time",
          moment(batchInfo.completed_at).diff(batchInfo.submitted_at, "seconds")
        );

        if (batchInfo.total_operations === 0
          || _.isEmpty(batchInfo.response_body_url)) {
          return Promise.resolve([]);
        }

        /**
         * data is {"status_code":200,"operation_id":"id","response":"encoded_json"}
         */
        return this.mailchimpClient.handleResponse(batchInfo)
          .pipe(es.through(function write(data) {
            let responseObj = {};
            try {
              responseObj = JSON.parse(data.response);
            } catch (e) {} // eslint-disable-line no-empty
            if (_.get(responseObj, extractField)) {
              return _.get(responseObj, extractField, []).map(r => {
                return this.emit("data", r);
              });
            }
            return this.emit("data", responseObj);
          }))
          .pipe(new BatchStream({ size: chunkSize }))
          .pipe(ps.map((ops) => {
            try {
              return Promise.all(_.map(jobs, (job) => {
                console.log("JOB", job, ops.length);
                return this.queueAgent.create(job, {
                  response: ops,
                  additionalData
                });
              }));
            } catch (e) {
              console.error(e);
              return Promise.reject(e);
            }
          }))
          .wait()
          .then(() => this.mailchimpClient.delete(`/batches/${batchId}`));
      });
  }
}
