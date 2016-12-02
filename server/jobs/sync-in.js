/**
 * SyncIn : import all the list members as hull users
 */
export default function syncInJob(req) {
  const { mailchimpAgent } = req.shipApp;
  const exclude = [
    "_links",
    "members._links",
  ];
  const op = {
    method: "GET",
    path: `/lists/${mailchimpAgent.listId}/members`,
    params: {
      exclude_fields: exclude.join(",")
    }
  };
  return mailchimpAgent.batchAgent.create([op], ["importUsers"], 1, "members");
}
