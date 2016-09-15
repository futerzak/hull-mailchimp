import Promise from "bluebird";

/**
 * Kue Adapter for queue
 */
export default class KueAdapter {

  /**
   * @param {Object} queue Kue instance
   */
  constructor(queue) {
    this.queue = queue;
    this.queue.watchStuckJobs();
    process.once("SIGTERM", () => {
      this.queue.shutdown(5000, (err) => {
        console.log(`Kue shutdown: ${err}`);
        process.exit(0);
      });
    });
  }

  /**
   * @param {String} jobName queue name
   * @param {Object} jobPayload
   * @return {Promise}
   */
  create(jobName, jobPayload, { ttl = 0, delay = null } = {}) {
    return Promise.fromCallback((callback) => {
      const job = this.queue.create(jobName, jobPayload)
        .attempts(3)
        .removeOnComplete(true);

      if (ttl) {
        job.ttl(ttl);
      }

      if (delay) {
        job.delay(delay);
      }

      return job.save((err) => {
        callback(err, job.id);
      });
    });
  }

  /**
   * @param {String} jobName
   * @param {Function -> Promise} jobCallback
   * @return {Object} this
   */
  process(jobName, jobCallback) {
    this.queue.process(jobName, (job, done) => {
      jobCallback(job)
        .then((res) => {
          done(null, res);
        }, (err) => {
          done(err);
        })
        .catch((err) => {
          done(err);
        });
    });
    return this;
  }
}
