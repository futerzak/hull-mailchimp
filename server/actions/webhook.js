import _ from "lodash";

export default function handleAction(req, res) {
  const { body = {}, method = "" } = req;
  const { syncAgent } = req.shipApp;

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

  if (type === "profile" || type === "subscribe") {
    syncAgent.userMappingAgent.updateUser({
      ...data,
      subscribed: true
    });
  } else if (type === "unsubscribe") {
    syncAgent.userMappingAgent.updateUser({
      ...data,
      status: "unsubscribed",
      subscribed: false
    });
  }

  return res.json({ listId, ok: true });
}
