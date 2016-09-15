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
  }

  getMapping() {
    return _.get(this.ship, `private_settings[${this.settingKey}]`, {});
  }

  /**
   * Updates internal segments mapping
   * @param {Object} mapping
   */
  updateMapping(mapping = {}) {
    this.ship.private_settings[this.settingKey] = mapping;
    return this.hullClient.put(this.ship.id, { private_settings: this.ship.private_settings });
  }

  /**
   * Returns ids of segments saved in mapping
   */
  getSegmentIds() {
    return _.keys(this.getMapping());
  }

  /**
   * If provided segment is not saved to mapping, it is created in Mailchimp
   * and saved to the mapping.
   * @param {Object} segment
   * @return {Promise}
   */
  createSegment(segment) {
    const mapping = this.getMapping();
    const listId = this.listId;
    if (_.get(mapping, segment.id)) {
      return Promise.resolve();
    }

    return this.mailchimpClient
      .post(`/lists/${listId}/segments`)
      .send({
        name: segment.name,
        static_segment: []
      })
      .then((res) => {
        mapping[segment.id] = res.body.id;
        return this.updateMapping(mapping);
      });
  }

  /**
   * Removes audience from Mailchimp and segment from mapping
   * @param {Object} segment
   * @return {Promise}
   */
  deleteSegment(segment) {
    const mapping = this.getMapping();
    const listId = this.listId;
    if (!_.get(mapping, segment.id)) {
      return Promise.resolve();
    }

    const audienceId = _.get(mapping, segment.id);
    return this.mailchimpClient
      .delete(`/lists/${listId}/segments/${audienceId}`)
      .then(() => {
        _.unset(mapping, segment.id);
        return this.updateMapping(mapping);
      });
  }

  /**
   * Returns Mailchimp static segment aka Audience for corresponding segment
   * @param {String} segmentId
   * @return {String}
   */
  getAudienceId(segmentId) {
    const mapping = this.getMapping();
    return _.get(mapping, segmentId);
  }

  /**
   * @return {Promise}
   */
  syncSegments(segments = []) {
    const mappedSegments = this.getSegmentIds().map(id => { return { id }; });

    const newSegments = _.differenceBy(segments, mappedSegments, "id");
    const oldSegments = _.difference(mappedSegments, segments, "id");

    console.log("MAPPING", segments, newSegments, oldSegments);

    return Promise.all(newSegments.map(segment => {
      return this.createSegment(segment);
    }))
    .then(() => {
      return Promise.all(oldSegments.map(segment => {
        return this.deleteSegment(segment);
      }));
    });
  }
}
