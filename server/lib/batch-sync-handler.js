import _ from "lodash";
import Promise from "bluebird";

const HANDLERS = {};

export default class BatchSyncHandler {

  static exit() {
    console.log("BatchSyncHandler.exit");
    if (!BatchSyncHandler.exiting) {
      const exiting = Promise.all(_.map(HANDLERS, (h) => h.flush()));
      BatchSyncHandler.exiting = exiting;
      return exiting;
    }
    return Promise.resolve([]);
  }

  static getHandler(args) {
    return HANDLERS[args.ship.id] = HANDLERS[args.ship.id] || new BatchSyncHandler(args); // eslint-disable-line no-return-assign
  }

  constructor({ ship, hull, options = {} }) {
    this.ship = ship;
    this.hull = hull;
    this.messages = [];
    this.options = options;

    this.status = "idle";
    this.flushLater = _.throttle(this.flush.bind(this), this.options.throttle);
    this.stats = { flush: 0, add: 0, flushing: 0, success: 0, error: 0, pending: 0 };
    setInterval(this.debugStats.bind(this), 10000);
    return this;
  }

  debugStats() {
    this.hull.client.logger.info("batch.stats", this.stats);
  }

  setCallback(callback) {
    this.callback = callback;
    return this;
  }

  metric(metric, value = 1) {
    this.hull.client.logger.info("metric", `bulk.${metric}`, value);
  }

  add(message) {
    this.stats.add += 1;
    this.stats.pending += 1;
    this.messages.push(message);

    const { maxSize } = this.options;
    if (this.messages.length >= maxSize) {
      this.flush();
    } else {
      this.flushLater();
    }
    return Promise.resolve();
  }

  flush() {
    this.metric("flush");
    this.stats.flush += 1;
    this.stats.flushing += 1;
    const messages = this.messages;
    this.messages = [];
    this.stats.pending -= messages.length;
    return this.callback(messages)
      .then(() => {
        this.metric("flush.success");
        this.stats.success += 1;
        this.stats.flushing -= 1;
      }, (err) => {
        console.error(err);
        this.hull.client.logger.error("flush.error", err);
        this.metric("flush.error");
        this.stats.error += 1;
        this.stats.flushing -= 1;
      });
  }
}
