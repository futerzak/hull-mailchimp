import _ from "lodash";
import HullAgent from "../lib/hull-agent";


export default class MailchimpWebhookController {

  handleAction(req, res) {
    const { body = {}, method = "" } = req;

    if (method.toLowerCase() === "get") {
      return res.json({ ok: true });
    }

    const { type, data } = body;
    const listId = _.get(req, "hull.ship.private_settings.mailchimp_list_id");

    if (!listId) {
      res.status(404);
      return res.json({ ok: false, message: "Not found" });
    }

    if (!data || !data.email) {
      res.status(404);
      return res.json({ ok: false, message: "Email not found" });
    }

    const hullAgent = new HullAgent(req.hull.ship, req.hull.client);

    if (type === "profile" || type === "subscribe") {
      hullAgent.updateUser({
        ...data,
        subscribed: true
      });
    } else if (type === "unsubscribe") {
      hullAgent.updateUser({
        ...data,
        status: "unsubscribed",
        subscribed: false
      });
    }

    return res.json({ listId, ok: true });
  }

}
