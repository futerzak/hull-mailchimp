export default function shipUpdateHandler(payload, { req }) {
  return req.shipApp.queueAgent.create("shipUpdate");
}
