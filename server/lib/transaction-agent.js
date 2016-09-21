if (process.env.NEW_RELIC_LICENSE_KEY) {
  const nr = require("newrelic");
}

export default class TransactionAgent {

  startTransaction(jobName, callback) {
    if (process.env.NEW_RELIC_LICENSE_KEY) {
      return nr.createBackgroundTransaction(jobName, () => {
        callback();
      });
    }
    return callback();
  }

  endTransaction() {
    if (process.env.NEW_RELIC_LICENSE_KEY) {
      return nr.endTransaction();
    }
  }
}
