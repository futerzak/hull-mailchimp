import Promise from "bluebird";
import moment from "moment";
import _ from "lodash";
import crypto from "crypto";
import * as helper from "./mailchimp-batch-helper";

/**
 * EventsAgent has methods to query Mailchimp for data relevant
 * for Hull Track API.
 */
export default class EventsAgent {

  constructor(mailchimpClient, hull, ship) {
    this.client = mailchimpClient;
    this.hull = hull;
    this.listId = _.get(ship, "private_settings.mailchimp_list_id");
    this.listName = _.get(ship, "private_settings.mailchimp_list_name");
  }

  /**
   * Takes prepares requestExtract elastic search query to select users
   * which should be updated with events.
   * It build an OR clause of provided email addresses with optional constraint
   * of traits_mailchimp/latest_activity_at
   * @param  {Array} emails
   * @return {Object}
   */
  buildSegmentQuery(emails) {
    const queries = emails.map(f => {
      let time = moment(f.timestamp);

      // FIXME Mailchimp - the email-activity reports sometimes returns
      // 00:00:00 for the time part. If this is the last event, we will get stuck.
      // This is a naive workaround push that time 24 hours ahead.
      if (time.seconds() === 0 && time.minutes() === 0 && time.hours() === 0) {
        time = time.add(1, "day");
      }

      // eslint-disable-next-line object-curly-spacing, quote-props, key-spacing, comma-spacing
      return {"and":{"filters":[{"terms":{"email.exact":[f.email_address]}},{"or":{"filters":[{"range":{"traits_mailchimp/latest_activity_at":{"lt":time.utc().format()}}},{"missing":{"field":"traits_mailchimp/latest_activity_at"}}]}}]}};
    });

    return {
      filtered: { query: { match_all: {} },
        filter: {
          or: {
            filters: queries
          }
        }
      }
    };
  }

  /**
   * Returns an array of campaigns which can have new events from members.
   * This are sent and being sent campaign not older than a week.
   * @return {Promise}
   */
  getTrackableCampaigns() {
    this.hull.logger.info("getTrackableCampaigns");
    const weekAgo = moment().subtract(1, "week");

    return this.client
      .get("/campaigns")
      .query({
        fields: "campaigns.id,campaigns.status,campaigns.title,campaigns.send_time",
        list_id: this.listId,
        since_send_time: weekAgo.format()
      })
      .then(response => {
        const res = response.body;
        return res.campaigns.filter(c => ["sent", "sending"].indexOf(c.status) !== -1);
      });
  }

  /**
   * Takes a list of campaigns to check, then downloads the emails activities
   * and then flattens it to return one array for all emails of all campaigns requested.
   * It also adds `campaign_send_time` parameter from campaign to the email infromation.
   * @param  {Array} campaigns
   * @return {Promise}
   */
  getEmailActivities(campaigns, jobs = []) {
    this.hull.logger.info("getEmailActivities", campaigns);
    return campaigns.map(c => {
      const operation_id = helper.getOperationId(jobs, { campaign: c });
      return {
        operation_id,
        method: "get",
        path: `/reports/${c.id}/email-activity/`,
        query: { fields: "emails.email_address,emails.activity" },
      };
    });
  }

  getEmailsToExtract(mailchimpRes) {
    const chunk = mailchimpRes.reduce((emails, mailchimpData) => {
      const { response, data } = mailchimpData;
      const campaignEmails = response.emails.map(e => {
        e.campaign_send_time = data.campaign.send_time;
        return e;
      });
      emails = _.concat(emails, campaignEmails);
      return emails;
    }, []);

    if (_.isEmpty(chunk)) {
      return null;
    }

    return chunk.reduce((emails, e) => {
      const timestamps = e.activity.sort((x, y) => moment(x.timestamp) - moment(y.timestamp));
      const timestamp = _.get(_.last(timestamps), "timestamp", e.campaign_send_time);

      // if there is already same email queued remove it if its older than
      // actual or stop if it's not
      const existingEmail = _.findIndex(emails, ["email_address", e.email_address]);
      if (existingEmail !== -1) {
        if (moment(emails[existingEmail].timestamp).isSameOrBefore(timestamp)) {
          _.pullAt(emails, [existingEmail]);
        } else {
          return emails;
        }
      }

      this.hull.logger.info("runCampaignStrategy.email", { email_address: e.email_address, timestamp });
      emails.push({
        timestamp,
        email_id: e.email_id,
        email_address: e.email_address
      });
      return emails;
    }, []);
  }


  /**
   * This method downloads from Mailchimp information for members.
   * If the latest activity infromation is provided for an user the returned
   * array will be filtered to include only events which happened after the time.
   * The array provided as param needs two required parameters:
   * - `email_address` (user email address)
   * - `id` (Hull user ID)
   * It also can take optional params:
   * - `email_id` the MD5 of the `email_address`
   * - `traits_mailchimp/latest_activity_at` if provided it will be used to filter
   * the returned array
   * @param  {Array} emails
   * [{ email_address, id, [[email_id,] "traits_mailchimp/latest_activity_at"] }]
   * @return {Promise}
   */
  getMemberActivitiesOperations(emails, jobs = []) {
    this.hull.logger.info("getMemberActivities", emails.length);
    const emailIds = emails.map(e => {
      e.email_id = e.email_id || this.getEmailId(e.email);
      return e;
    });
    const queries = _.uniqWith(emailIds.map(e => {
      const operation_id = helper.getOperationId(jobs, { email: e });
      return {
        operation_id,
        method: "get",
        path: `/lists/${this.listId}/members/${e.email_id}/activity`,
      };
    }), _.isEqual);

    return queries;
  }

  parseMemberActivities(mailchimpResponse) {
    return mailchimpResponse.map(({ response, data }) => {
      response.email_address = data.email.email;
      response.id = data.email.id;

      if (data.email.id["traits_mailchimp/latest_activity_at"]) {
        response.activity = response.activity.filter(a => {
          return moment(a.timestamp).utc().isAfter(data.email["traits_mailchimp/latest_activity_at"]);
        });
      }
      return response;
    }).filter(e => (e.activity || []).length > 0);
  }

  getEmailId(email) {
    return !_.isEmpty(email) && crypto.createHash("md5")
      .update(email.toLowerCase())
      .digest("hex");
  }

  /**
   * For every provided email and its activity call Hull Track endpoint.
   * After calling the track endpoint it saves the latest event timestamp
   * as `traits_mailchimp/latest_activity_at`.
   * @param  {Array} emails
   * [{
   *   activity: [{
   *     action: "bounce",
   *     type: "hard",
   *     title: "Campaign Title",
   *     timestamp: "",
   *     campaign_id: "123",
   *     ip: "123.123.123.123"
   *   }],
   *   id: "578fc6e644d74b10070043be",
   *   email_id: "039817b3448c634bfb35f33577e8b2b3",
   *   list_id: "319f54214b",
   *   email_address: "michaloo+4@gmail.com"
   * }]
   * @return {Promise}
   */
  trackEvents(emails) {
    this.hull.logger.info("trackEvents", emails.length);
    const emailTracks = emails.map(email => {
      const user = this.hull.as(email.id);
      return Promise.all(email.activity.map(a => {
        const uniqId = this.getUniqId({ email, activity: a });
        this.hull.logger.info("trackEvents.track", email.email_address, a.action);
        const eventName = this.getEventName(a);
        const props = this.getEventProperties(a, email);

        return user.track(eventName, props, {
          source: "mailchimp",
          event_id: uniqId,
          created_at: a.timestamp
        }).then(() => a.timestamp);
      }))
      .then((timestamps) => {
        if (timestamps.length === 0) {
          return true;
        }
        const latest = timestamps.sort((x, y) => moment(x) - moment(y)).pop();
        this.hull.logger.info("trackEvents.latest_activity_at", email.email_address, latest);

        return user.traits({
          latest_activity_at: moment(latest).utc()
        }, { source: "mailchimp" });
      });
    });

    return Promise.all(emailTracks);
  }

  /**
   * Generate unique id for an event
   * @param  {Object} email
   * @param  {Object} activity
   * @return {String}
   */
  getUniqId({ email, activity }) {
    const uniqString = [email.email_address, activity.type, activity.timestamp].join();
    return Buffer.from(uniqString, "utf8").toString("base64");
  }

  /**
   * Implements events nameing from Segment documentation.
   * Mailchimp doesn't provide information for `Email Marked as Spam`
   * and `Email Delivered` events.
   * @see https://segment.com/docs/spec/email/#email-delivered
   * @param  {Object} activity
   * @return {String}
   */
  getEventName(activity) {
    const map = {
      open: "Email Opened",
      sent: "Email Sent",
      bounce: "Email Bounced",
      click: "Email Link Clicked",
      unsub: "Unsubscribed"
    };

    return _.get(map, activity.action, activity.action);
  }

  /**
   * Implements data structure from Segment documentation.
   *
   * @param  {Object} activity
   * @return {Object}
   */
  getEventProperties(activity, email) {
    const defaultProps = {
      timestamp: activity.timestamp,
      campaign_name: activity.title || "",
      campaign_id: activity.campaign_id,
      list_id: email.list_id,
      list_name: this.listName,
      // TODO add ip, available here:
      // http://developer.mailchimp.com/documentation/mailchimp/reference/reports/email-activity
      // TODO add email_subject, available here:
      // http://developer.mailchimp.com/documentation/mailchimp/reference/campaigns/#read-get_campaigns
      // campaings.settings.subject_line
    };
    const props = {};

    switch (activity.action) {
      case "click":
        _.defaults(props, defaultProps, {
          link_url: activity.url
        });
        break;
      case "bounce":
        _.defaults(props, defaultProps, {
          type: activity.type
        });
        break;
      default:
        _.defaults(props, defaultProps);
    }

    return props;
  }
}
