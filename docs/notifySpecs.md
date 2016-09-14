# Send a batch of users to mailchimp

```javascript

/**
 * Handles events of user
 */
userUpdateHandler(req) {
  const { user, changes = {}, segments = [] } = req.payload;
  const { entered = [], left = [] } = changes.segments || {};
  user.segment_ids = user.segment_ids || segments.map(s => s.id);
  user.remove_segment_ids = left.map(s => s.id);

  // batch grouping

  return req.shipApp.queueAgent.create("sendUsersJob", { users: [ user ] });
}

/**
 * When segment is added or updated make sure its in the segments mapping
 */
segmentUpdateHandler(req) {
  const { segment } = req.payload;

  return req.shipApp.segmentsMapping.updateSegment(segment)
    .then(() => {
      req.shipApp.hullAgent.requestExtract({ segment });
    });
}

segmentDeleteHandler(req) {
  return req.shipApp.segmentsMapping.deleteSegment(segment);
}

shipUpdateHandler(req) {

}
```
