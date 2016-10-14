import _ from "lodash";
import flatten from "flat";

export default class MailchimpWebhookController {

  handleAction(req, res) {
    const { type, data } = req.body || {};
    const listId = _.get(req, "hull.ship.private_settings.mailchimp_list_id");

    if (!listId) {
      res.status(404);
      return res.end("Not found");
    }

    if (!data || !data.email) {
      res.status(404);
      return res.end("Email not found");
    }

    const { email, id } = data;
    const anonymous_id = `mailchimp:${id}`;
    const hull = req.hull.client.as({ email, anonymous_id });

    if (type === "profile" || type === "subscribe") {
      const merges = _.omit(data.merges, "GROUPINGS");
      if (merges.INTERESTS) {
        merges.INTERESTS = merges.INTERESTS.split(",").map(_.trim);
      }

      const traits = _.reduce({
        updated_at: new Date().toISOString(),
        unique_email_id: id,
        subscribed: true,
        status: "subscribed",
        ...flatten(merges, { delimiter: "_", safe: true })
      }, (tt, v, k) => {
        return { ...tt, [`mailchimp/${k.toLowerCase()}`]: v };
      }, {});

      hull.traits(traits);
    } else if (type === "unsubscribe") {
      hull.traits({
        status: "unsubscribed",
        subscribed: false
      }, { source: "mailchimp" });
    }

    return res.json({ listId, ok: true });
  }

}
