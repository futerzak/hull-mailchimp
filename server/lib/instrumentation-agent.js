import raven from "raven";

export default class InstrumentationAgent {

  constructor() {
    this.nr = null;
    this.raven = null;

    if (process.env.NEW_RELIC_LICENSE_KEY) {
      this.nr = require("newrelic"); // eslint-disable-line global-require
    }

    if (process.env.SENTRY_URL) {
      console.log("starting raven");
      this.raven = new raven.Client(process.env.SENTRY_URL);
      this.raven.patchGlobal();
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

  catchError(err, extra = {}) {
    if (this.raven && err) {
      this.raven.captureException(err, { extra });
    }
  }
}
