import _ from "lodash";
import flatten from "flat";

const MailchimpFields = [
  "email_client",
  "language",
  "last_changed",
  "location.country_code",
  "location.latitude",
  "location.longitude",
  "location.timezone",
  "member_rating",
  "stats.avg_click_rate",
  "stats.avg_open_rate",
  "status",
  "subscribed",
  "unique_email_id",
  "vip",
];

/**
 * Agent managing Mailchimp static segments aka audiences
 * and mapping stored in ships private settings
 * TODO: integrate with SyncAgent
 */
export default class UserMappingAgent {

  constructor(ship, hullClient) {
    this.ship = ship;
    this.hullClient = hullClient;
    this.mailchimpFields = MailchimpFields;
  }

  getExtractFields() {
    const traits = this.mailchimpFields.map(path => {
      const trait = _.last(path.split("."));
      return `traits_mailchimp/${trait}`;
    });
    const props = [
      "traits_mailchimp/import_error",
      "traits_mailchimp/last_activity_at",
      "id",
      "email",
      "first_name",
      "last_name"
    ];
    return props.concat(traits);
  }

  getUserTraitsForMember(member) {
    const merges = _.omit(member.merges || member.merge_fields, "GROUPINGS", "INTERESTS");
    const email = (member.email_address || member.email || "").toLowerCase();
    const unique_email_id = member.unique_email_id || member.id;
    const attrs = {
      ...flatten(merges, { delimiter: "_", safe: true }),
      unique_email_id,
      email
    };

    if (member.status) {
      attrs.status = member.status;
    }

    MailchimpFields.map(path => {
      const key = _.last(path.split("."));
      const value = _.get(member, path);
      if (!_.isNil(value)) {
        attrs[key] = value;
      }
      return value;
    });

    const traits = _.reduce(attrs, (tt, v, k) => {
      return { ...tt, [k.toLowerCase()]: v };
    }, {});

    if (_.isNil(traits.subscribed)) {
      if (traits.status === "subscribed") {
        traits.subscribed = true;
      } else if (traits.status === "unsubscribed") {
        traits.subscribed = false;
      }
    }

    return traits;
  }

  updateUser(member) {
    const mailchimp = this.getUserTraitsForMember(member);
    const { email, unique_email_id } = mailchimp;
    const ident = { email };
    if (unique_email_id) {
      ident.anonymous_id = `mailchimp:${unique_email_id}`;
    }

    const traits = flatten({ mailchimp }, { delimiter: "/", safe: true });

    if (!_.isEmpty(mailchimp.fname)) {
      traits.first_name = { operation: "setIfNull", value: mailchimp.fname };
    }

    if (!_.isEmpty(mailchimp.lname)) {
      traits.last_name = { operation: "setIfNull", value: mailchimp.lname };
    }

    return this.hullClient
      .as(ident)
      .traits(traits);
  }

}
