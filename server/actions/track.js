

export default function track(req, res, next) {
  return req.shipApp.queueAgent.create("track")
    .then(next, next);
}
