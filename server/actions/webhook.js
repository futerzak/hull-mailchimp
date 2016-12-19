
export default function handleAction(req, res) {
  const { body = {}, method = "" } = req;
  const { syncAgent } = req.shipApp;

  if (method.toLowerCase() === "get") {
    return res.json({ ok: true });
  }

  const { type, data } = body;

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

  return res.json({ ok: true });
}
