import _ from "lodash";

import ExtractAgent from "./extract-agent";

export default class HullAgent {

  constructor(ship, hullClient, shipCache, req) {
    this.hullClient = hullClient;
    this.ship = ship;
    this.shipCache = shipCache;

    this.extractAgent = new ExtractAgent(req, hullClient);
  }

  updateShipSettings(newSettings) {
    return this.hullClient.get(this.ship.id)
      .then(ship => {
        this.ship = ship;
        const private_settings = { ...this.ship.private_settings, ...newSettings };
        this.ship.private_settings = private_settings;
        return this.hullClient.put(this.ship.id, { private_settings });
      })
      .then((ship) => {
        return this.shipCache.del(this.ship.id)
          .then(() => {
            return ship;
          });
      });
  }

  /**
   *
   */
  userComplete(user) {
    return !_.isEmpty(user.email);
  }

  /**
   *
   */
  userWhitelisted(user) {
    const segmentIds = _.get(this.ship, "private_settings.synchronized_segments", []);
    if (segmentIds.length === 0) {
      return true;
    }
    return _.intersection(segmentIds, user.segment_ids).length > 0;
  }

  getSegments() {
    return this.hullClient.get("/segments");
  }
}
