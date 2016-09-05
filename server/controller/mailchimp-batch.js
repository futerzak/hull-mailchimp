import _ from "lodash";
import Promise from "bluebird";
import ps from "promise-streams";
import BatchStream from "batch-stream";

export default class MailchimpBatchController {
  /**
   * Parses the extract results and queues chunks for export operations
   * @param  {String} body
   * @param  {Number} chunkSize
   * @return {Promise}
   */
  handleMailchimpBatchJob(req) {
    const { batchId } = req.payload;

    return req.shipApp.mailchimpClientRequest.get(`/batches/${batchId}`)
      .then((response) => {
        const batchInfo = response.body;
        // console.log(_.omit(batchInfo, "_links"));
        if (batchInfo.status !== "finished") {
          return req.shipApp.queueAgent.create("handleMailchimpBatchJob", { batchId }, { delay: 10000});
        }


        return req.shipApp.mailchimpClientRequest.handleResponse(batchInfo)
          .pipe(new BatchStream({ size: 100 }))
          .pipe(ps.map((ops) => {
            console.log(ops);
            try {
              const jobsToQueue = _.reduce(ops, (jobs, op) => {
                const operationId = op.operation_id;
                // console.log("OP!!!", op);
                if (operationId) {
                  const operationData = JSON.parse(operationId);
                  const jobNames = operationData.nextOperations;
                  jobNames.map((jobName) => {
                    const jobsArray = jobs[jobName] = jobs[jobName] || [];
                    const response = _.omit(JSON.parse(op.response), "_links");
                    jobsArray.push({
                      response,
                      operationData: _.omit(operationData, "nextOperations")
                    });
                  });
                }
                return jobs;
              }, {});
              console.log(jobsToQueue);
              return Promise.all(_.map(jobsToQueue, (value, key) => {
                return req.shipApp.queueAgent.create(key, value);
              }));
            } catch (e) {
              console.error(e);
              throw e;
            }
          }))
          .wait();
      });
  }
}
