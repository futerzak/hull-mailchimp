

export default function requestTrack(req, res, next) {
  return next();
  // eslint-disable-next-line no-unreachable
  return req.shipApp.queueAgent.create("requestTrack")
    .then(next, next);
}
