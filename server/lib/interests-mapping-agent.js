import _ from "lodash";
import Promise from "bluebird";

/**
 * Agent managing Mailchimp interests aka groups
 * and mapping stored in ships private settings
 * TODO: integrate with SyncAgent
 */

export default class InterestsMappingAgent {

  constructor(mailchimpClient, hullClient, ship) {
    this.mailchimpClient = mailchimpClient;
    this.hullClient = hullClient;
    this.ship = ship;
    this.settingKey = "interests_mapping";
    this.interestsCategoryId = _.get(ship, "private_settings.interest_category_id");
    this.listId = _.get(ship, "private_settings.mailchimp_list_id");
    this.mapping = _.get(this.ship, `private_settings[${this.settingKey}]`, {});
    this.originalMapping = _.cloneDeep(this.mapping);
  }

  /**
   * Updates internal segments mapping
   * @param {Object} mapping
   */
  updateMapping() {
    if (_.isEqual(this.originalMapping, this.mapping) && _.isEqual(this.ship.private_settings['interest_category_id'], this.interestsCategoryId)) {
      return Promise.resolve();
    }
    this.ship.private_settings['interest_category_id'] = this.interestsCategoryId;
    this.ship.private_settings[this.settingKey] = this.mapping;
    return this.hullClient.put(this.ship.id, { private_settings: this.ship.private_settings });
  }

  getInterestsForSegments(segmentIds) {
    return _.reduce(this.mapping, (ret, interestId, segmentId) => {
      return { ...ret, [interestId]: _.includes(segmentIds, segmentId) }
    }, {});
  }

  /**
   * Returns ids of segments saved in mapping
   */
  getSegmentIds() {
    return _.keys(this.mapping);
  }

  findHullCategory() {
    const { mailchimpClient, listId } = this;
    const title = "Hull Segments";
    return mailchimpClient
      .get(`/lists/${listId}/interest-categories?count=100`)
      .then(({ body = {} }) => {
        const { categories = [] } = body;
        return _.find(categories, { title });
      });
  }

  createHullCategory() {
    const title = "Hull Segments";
    const { mailchimpClient, listId } = this;
    return mailchimpClient
      .post(`/lists/${listId}/interest-categories`)
      .send({ title, type: 'hidden' })
      .then(({ body }) => body);
  }

  ensureCategory() {
    const { mailchimpClient, listId, interestsCategoryId } = this;
    if (interestsCategoryId) {
      return Promise.resolve({ id: interestsCategoryId });
    }
    return this.findHullCategory()
      .then(category =>
        category || this.createHullCategory()
      ).then(category => {
        if (category && category.id) {
          this.interestsCategoryId = category.id;
          this.updateMapping();
          return category;
        } else {
          throw new Error("Cannot createHullCategory ?");
        }
      }
    )
  }

  getMailchimpInterests() {
    if (this._interests) {
      return Promise.resolve(this._interests);
    }
    const listId = this.listId;
    this.ensureCategory().then(({ id }) => {
      return this.mailchimpClient
        .get(`/lists/${listId}/interest-categories/${id}/interests`)
        .query({ count: 100 })
        .then(({ body }) => {
          this._interests = body;
          return body;
        });
      })
  }

  recreateSegment(segment) {
    const steps = [ 'ensureCategory', 'deleteInterest', 'createInterest', 'updateMapping' ];
    return Promise.mapSeries(
      steps,
      step => this[step](segment)
    );
  }

  getInterestsPath(path = '') {
    const { listId, interestsCategoryId } = this;
    return `/lists/${listId}/interest-categories/${interestsCategoryId}/interests/${path}`;
  }

  findInterest(segment = {}) {
    const { name } = segment;
    return this.mailchimpClient
      .get(this.getInterestsPath())
      .query({ count: 100 })
      .then(({ body = {} }) => {
        const { interests = [] } = body;
        return _.find(interests, (interest) => name.toLowerCase() === interest.name.toLowerCase());
      });
  }

  createInterest(segment) {
    const { name } = segment;
    return this.mailchimpClient
      .post(this.getInterestsPath())
      .send({ name })
      .then(({ body = {} }) => {
        this.mapping[segment.id] = body.id;
        return body;
      }, ({ status, response = {} }) => {
        const { body = {} } = response;
        if (status === 400 && body.detail && body.detail.match('already exists')) {
          return this.findInterest(segment)
            .then(interest => {
              this.mapping[segment.id] = interest.id;
              return interest;
            });
        }
        throw new Error(body.detail);
      });
  }

  /**
   * Removes interest from Mailchimp and segment from mapping
   * @param {Object} segment
   * @return {Promise}
   */
  deleteInterest(segment) {
    const { listId, interestsCategoryId } = this;
    const interestId = _.get(this.mapping, segment.id);

    if (!interestId) {
      return Promise.resolve();
    }

    return this.mailchimpClient
      .delete(this.getInterestsPath(interestId))
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
   * @return {Promise}
   */
  syncInterests(segments = []) {
    const mappedSegments = _.keys(this.mapping).map(id => { return { id } });
    const newSegments = _.differenceBy(segments, mappedSegments, 'id');
    const oldSegments = _.differenceBy(mappedSegments, segments, 'id');

    return Promise.map(newSegments, segment => {
      return this.createInterest(segment);
    }, { concurrency: 1 })
    .then(() => {
      return Promise.map(oldSegments, segment => {
        return this.deleteInterest(segment);
      }, { concurrency: 3 });
    })
    .then(this.updateMapping.bind(this));
  }
}
