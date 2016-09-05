export default function handle(req, res, next) {
  if (req.query.token) {
    req.hull = req.hull || {};
    req.hull.token = req.query.token;
  }
  next();
}
