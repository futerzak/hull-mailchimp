import _ from "lodash";
import Promise from "bluebird";

/**
 * Agent managing Mailchimp static segments aka audiences
 * and mapping stored in ships private settings
 */
export default class SegmentsAgent {

  constructor(mailchimpClient, hullClient, ship) {
    this.mailchimpClient = mailchimpClient;
    this.hullClient = hullClient;
    this.ship = ship;
    this.settingKey = "segment_mapping";
    this.listId = _.get(ship, "private_settings.mailchimp_list_id");
    this.mapping = _.get(this.ship, `private_settings[${this.settingKey}]`, {});
    this.originalMapping = _.cloneDeep(this.mapping);
  }

  /**
   * Updates internal segments mapping
   * @param {Object} mapping
   */
  updateMapping() {
    if (_.isEqual(this.originalMapping, this.mapping)) {
      return Promise.resolve();
    }
    this.ship.private_settings[this.settingKey] = this.mapping;
    return this.hullClient.put(this.ship.id, { private_settings: this.ship.private_settings });
  }

  /**
   * Returns ids of segments saved in mapping
   */
  getSegmentIds() {
    return _.keys(this.mapping);
  }

  /**
   * If provided segment is not saved to mapping, it is created in Mailchimp
   * and saved to the mapping.
   * @param {Object} segment
   * @return {Promise}
   */
  createSegment(segment) {
    const listId = this.listId;
    if (_.get(this.mapping, segment.id)) {
      return Promise.resolve();
    }

    return this.mailchimpClient
      .post(`/lists/${listId}/segments`)
      .send({
        name: segment.name,
        static_segment: []
      })
      .then((res) => {
        this.mapping[segment.id] = res.body.id;
        return Promise.resolve();
      });
  }

  /**
   * Removes audience from Mailchimp and segment from mapping
   * @param {Object} segment
   * @return {Promise}
   */
  deleteSegment(segment) {
    const listId = this.listId;
    if (!_.get(this.mapping, segment.id)) {
      return Promise.resolve();
    }

    const audienceId = _.get(this.mapping, segment.id);
    return this.mailchimpClient
      .delete(`/lists/${listId}/segments/${audienceId}`)
      .then(() => {
        _.unset(this.mapping, segment.id);
        return Promise.resolve();
      }, (err) => {
        if (err.response.statusCode === 404) {
          _.unset(this.mapping, segment.id);
          return Promise.resolve();
        }
        return Promise.reject(err);
      });
  }

  /**
   * Returns Mailchimp static segment aka Audience for corresponding segment
   * @param {String} segmentId
   * @return {String}
   */
  getAudienceId(segmentId) {
    return _.get(this.mapping, segmentId);
  }

  /**
   * @return {Promise}
   */
  syncSegments(segments = []) {
    const mappedSegments = this.getSegmentIds().map(id => { return { id }; });

    const newSegments = _.differenceBy(segments, mappedSegments, "id");
    const oldSegments = _.differenceBy(mappedSegments, segments, "id");

    return Promise.map(newSegments, segment => {
      return this.createSegment(segment);
    }, { concurrency: 5 })
    .then(() => {
      return Promise.map(oldSegments, segment => {
        return this.deleteSegment(segment);
      }, { concurrency: 5 });
    })
    .then(this.updateMapping.bind(this));
  }
}
