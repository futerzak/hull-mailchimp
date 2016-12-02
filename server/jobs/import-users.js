export default function importUsersJob(req) {
  const { syncAgent } = req.shipApp;
  req.hull.client.logger.info("importUsers", req.payload.members.length);
  const { members = [] } = req.payload;
  req.hull.client.logger.info("importUsers", members.length);
  return members.map(member => {
    return syncAgent.userMappingAgent.updateUser(member);
  });
}
