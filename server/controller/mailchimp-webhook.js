import _ from "lodash";
import flatten from "flat";

export default class MailchimpWebhookController {

  handleAction(req, res) {
    const listId = _.get(req, "hull.ship.private_settings.mailchimp_list_id");

    if (!listId) {
      res.status(404);
      return res.end("Not found");
    }

    const { type, data } = req.body || {};

    if (false && type === "profile" || type === "subscribe" && data && data.email) {
      const { email, id } = data;
      const anonymous_id = ["mailchimp", listId, id].join("-");

      const hull = req.hull.client.as({ email, anonymous_id });

      const traits = _.reduce({
        updated_at: new Date().toISOString(),
        unique_email_id: id,
        ...flatten(data.merges, { delimiter: "_" })
      }, (tt, v, k) => {
        return { ...tt, [`mailchimp/${k.toLowerCase()}`]: v };
      }, {});

      hull.traits(traits);
    }

    return res.json({ listId, ok: true });
  }

}
