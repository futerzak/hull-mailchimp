import Promise from "bluebird";
import _ from "lodash";
import ps from "promise-streams";
import BatchStream from "batch-stream";

export default class BatchAgent {

  constructor(mailchimpClientRequest, queueAgent) {
    this.mailchimpClientRequest = mailchimpClientRequest;
    this.queueAgent = queueAgent;
  }

  create(operations) {
    if (_.isEmpty(operations)) {
      return Promise.resolve([]);
    }

    return this.mailchimpClientRequest
      .post("/batches")
      .send({ operations })
      .then(response => {
        const { id } = response.body;
        return this.queueAgent.create("handleMailchimpBatchJob", { batchId: id }, { delay: 10000 }, req);
      }, err => {
        console.log("ERR", err);
      });
  }

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
          return Promise.resolve([])
        }

        return this.mailchimpClientRequest.handleResponse(batchInfo)
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

}
