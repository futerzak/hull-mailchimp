import _ from "lodash";

/**
 * Method groups returned operations by `jobs` property
 * and then queues it for further processing with additional data
 * @return Object {
 *   jobName: [{
 *     response: [mailchimp response],
 *     data: [additional data]
 *   }, {
 *     response: [mailchimp response],
 *     data: [additional data]
 *   }]
 * }
 */
export function groupByJobs(ops) {
  const jobsToQueue = _.reduce(ops, (jobs, op) => {
    const operationId = op.operation_id;
    if (operationId) {
      const operationData = JSON.parse(operationId);
      const jobNames = _.get(operationData, "jobs", []);
      jobNames.map((jobName) => {
        const jobsArray = jobs[jobName] = jobs[jobName] || [];
        const response = _.omit(JSON.parse(op.response), "_links");
        return jobsArray.push({
          response,
          data: _.get(operationData, "data", {})
        });
      });
    }
    return jobs;
  }, {});
  return jobsToQueue;
}

export function getOperationId(jobs = [], data = {}) {
  return JSON.stringify({
    jobs,
    data
  });
}
