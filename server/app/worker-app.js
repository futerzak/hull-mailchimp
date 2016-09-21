import Supply from "supply";
import Promise from "bluebird";

import AppMiddleware from "../lib/middlewares/app";
import TokenMiddleware from "../lib/middlewares/token";

export default class WorkerApp {
  constructor({ queueAdapter, hostSecret, hullMiddleware }) {
    this.hostSecret = hostSecret;
    this.queueAdapter = queueAdapter;
    this.handlers = {};
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
      this.supply
        .each(req, res, callback);
    })
    .then(() => {
      return this.handlers[jobName].call(job, req, res);
    });
  }

  use(router) {
    return router(this);
  }
}
