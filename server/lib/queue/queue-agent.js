import request from "supertest";
import Promise from "bluebird";
import _ from "lodash";

/**
 * Queue Agent which handle queueing and processing http requests to the ship
 */
export default class QueueAgent {

  /**
   * Adapter on top of the queue system.
   * Should expose create and process methods;
   */
  constructor(adapter, req = null) {
    this.adapter = adapter;
    this.req = req;
  }

  /**
   * @param {String} jobName
   * @param {Object} jobPayload
   * @return {Promise}
   */
  create(jobName, jobPayload, options = {}, req = {}) {
    const context = _.pick(this.req || req, ["query", "hostname"]);
    return this.adapter.create("queueApp", {
      name: jobName,
      payload: jobPayload,
      context
    }, options);
  }
}
