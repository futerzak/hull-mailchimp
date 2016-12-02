import util from "util";
import raven from "raven";

export default class InstrumentationAgent {

  constructor(name) {
    this.nr = null;
    this.raven = null;
    this.name = name;

    if (process.env.NEW_RELIC_LICENSE_KEY) {
      this.nr = require("newrelic"); // eslint-disable-line global-require
    }

    if (process.env.SENTRY_URL) {
      console.log("starting raven");
      this.raven = new raven.Client(process.env.SENTRY_URL);
      this.raven.patchGlobal();
    }

    if (process.env.LIBRATO_TOKEN && process.env.LIBRATO_USER) {
      console.log("starting librato");
      this.librato = require("librato-node"); // eslint-disable-line global-require

      this.librato.configure({
        email: process.env.LIBRATO_USER,
        token: process.env.LIBRATO_TOKEN
      });
      this.librato.start();
      this.librato.on("error", function onError(err) {
        console.error("librato", err);
      });
    }
  }

  startTransaction(jobName, callback) {
    if (this.nr) {
      return this.nr.createBackgroundTransaction(jobName, callback)();
    }
    return callback();
  }

  endTransaction() {
    if (this.nr) {
      this.nr.endTransaction();
    }
  }

  catchError(err, extra = {}, tags = {}) {
    if (this.raven && err) {
      return this.raven.captureException(err, {
        extra,
        tags,
        fingerprint: [
          "{{ default }}",
          err.message
        ]
      });
    }
    return console.error(util.inspect(err, { depth: 10 }));
  }

  metricVal(metric = "", value = 1, ship = {}) {
    try {
      if (this.librato) {
        this.librato.measure(`${this.name}.${metric}`, parseFloat(value), Object.assign({}, { source: ship.id }));
      }
    } catch (err) {
      console.warn("error in librato.measure", err);
    }
  }

  metricInc(metric = "", value = 1, ship = {}) {
    try {
      if (this.librato) {
        this.librato.increment(`${this.name}.${metric}`, parseFloat(value), Object.assign({}, { source: ship.id }));
      }
    } catch (err) {
      console.warn("error in librato.measure", err);
    }
  }

  startMiddleware() {
    if (this.raven) {
      return raven.middleware.express.requestHandler(this.raven);
    }
    return (req, res, next) => {
      next();
    };
  }

  stopMiddleware() {
    if (this.raven) {
      return raven.middleware.express.errorHandler(this.raven);
    }
    return (req, res, next) => {
      next();
    };
  }
}
