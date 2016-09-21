import { Middleware } from "hull";

export default function ({ hostSecret }) {
  return function fetchShip(req, res, next) {
    req.hull = req.hull || { timings: {} };
    if (req.body && req.body.ship && req.body.ship.private_settings) {
      req.hull.ship = req.body.ship;
    }

    return Middleware({
      hostSecret,
      useCache: true,
      fetchShip: !req.hull.ship
    })(req, res, next);
  };
}
