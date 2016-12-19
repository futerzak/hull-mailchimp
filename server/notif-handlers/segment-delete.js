export default function segmentDeleteHandler(payload, { req }) {
  return req.shipApp.queueAgent.create("segmentDelete", { segment: payload.message });
}
