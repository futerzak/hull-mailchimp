```javascript

class segmentsMapping() {

  constructor(mailchimpClient, hullClient, ship) {
    this.mailchimpClient = mailchimpClient;
    this.hullClient = hullClient;
    this.ship = ship;
    this.settingKey = "segment_mapping";
  }

  getMapping() {
    return this.ship.private_settings[this.settingKey];
  }

  updateMapping(mapping) {
    const toSave = {
      private_settings: {};
    };
    toSave[this.settingKey] = mapping;
    this.ship.private_settings[this.settingKey] = mapping;
    return this.hullClient.put(this.ship.id, toSave);
  }

  getSegmentIds() {
    return _.keys(this.getMapping());
  }

  updateSegment(segment) {
    const mapping = this.getMapping();
    if (_.get(mapping, segment.id)) {
      return Promise.resolve();
    }

    return this.mailchimpClient
      .post(`/lists/{list_id}/segments`)
      .send({
        name: segment.name,
        static_segment: []
      })
      .then((res) => {
        mapping[segment.id] = res.body.id
        return this.updateMapping(mapping);
      });
  }

  deleteSegment(segment) {
    const mapping = this.getMapping();
    if (!_.get(mapping, segment.id)) {
      return Promise.resolve();
    }

    const audienceId = _.get(mapping, segment.id);
    return this.mailchimpClient
      .delete(`/lists/{list_id}/segments/{segment_id}`)
      .then(() => {
        _.unset(mapping, segment.id);
        return this.updateMapping(mapping);
      });
  }

  getAudienceId(segmentId) {
    const mapping = this.getMapping();
    return _.get(mapping, segmentId);
  }
}
```
