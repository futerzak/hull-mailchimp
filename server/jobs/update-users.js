import _ from "lodash";

export default function updateUsersJob({ payload = [], shipApp = {}, hull }) {
  const { syncAgent } = shipApp;
  hull.client.logger.info("updateUsers", payload.length);
  return Promise.all(payload.map((member) => {
    if (_.get(member, "error")) {
      return hull.client.as({ email: member.email_address }).traits({
        import_error: member.error
      }, { source: "mailchimp" });
    }
    return syncAgent.userMappingAgent.updateUser(member);
  }));
}
