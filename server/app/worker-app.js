import Supply from "supply";
import Promise from "bluebird";

import AppMiddleware from "../lib/middlewares/app";
import TokenMiddleware from "../lib/middlewares/token";

export default class WorkerApp {
  constructor({ queueAdapter, hostSecret, hullMiddleware, instrumentationAgent }) {
    this.hostSecret = hostSecret;
    this.queueAdapter = queueAdapter;
    this.handlers = {};
    this.instrumentationAgent = instrumentationAgent;
    this.supply = new Supply()
      .use(TokenMiddleware)
      .use(hullMiddleware)
      .use(AppMiddleware({ queueAdapter: this.queueAdapter }));
  }

  attach(jobName, worker) {
    this.handlers[jobName] = worker;
  }

  process() {
    this.queueAdapter.process("queueApp", (job) => {
      return this.dispatch(job);
    });
  }

  dispatch(job) {
    const jobName = job.data.name;
    const req = job.data.context;
    const jobData = job.data.payload;
    console.log("dispatch", jobName);
    req.payload = jobData;
    const res = {};

    if (!this.handlers[jobName]) {
      return Promise.reject(new Error(`No such job registered ${jobName}`));
    }
    return Promise.fromCallback((callback) => {
      this.instrumentationAgent.startTransaction(jobName, () => {
        this.runMiddleware(req, res)
          .then(() => {
            return this.handlers[jobName].call(job, req, res);
          })
          .then((jobRes) => {
            callback(null, jobRes);
          }, (err) => {
            this.instrumentationAgent.catchError(err, { job_id: job.id });
            callback(err);
          })
          .finally(() => {
            this.instrumentationAgent.endTransaction();
          });
      });
    });
  }

  runMiddleware(req, res) {
    return Promise.fromCallback((callback) => {
      this.supply
        .each(req, res, callback);
    });
  }

  use(router) {
    return router(this);
  }
}
