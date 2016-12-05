export default function importUsersJob(req) {
  const { syncAgent } = req.shipApp;
  const members = req.payload.response || [];
  req.hull.client.logger.info("importUsers", members.length);
  return members.map(member => {
    return syncAgent.userMappingAgent.updateUser(member);
  });
}
