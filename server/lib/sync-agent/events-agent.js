import Promise from "bluebird";
import moment from "moment";
import _ from "lodash";
import crypto from "crypto";

/**
 * EventsAgent has methods to query Mailchimp for data relevant
 * for Hull Track API.
 * TODO: integrate with MailchmpAgent and SyncAgent
 */
export default class EventsAgent {

  constructor(mailchimpClient, hull, ship, instrumentationAgent) {
    this.client = mailchimpClient;
    this.mailchimpClient = mailchimpClient;
    this.instrumentationAgent = instrumentationAgent;
    this.hull = hull;
    this.listId = _.get(ship, "private_settings.mailchimp_list_id");
    this.listName = _.get(ship, "private_settings.mailchimp_list_name");
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
        const trackableCampaigns = res.campaigns.filter(c => ["sent", "sending"].indexOf(c.status) !== -1);
        this.instrumentationAgent.metricVal("trackable_campaigns", trackableCampaigns);
        return trackableCampaigns;
      });
  }

  /**
   * Takes a list of campaigns to check, then prepares operation to download
   * the email activites for these campaigns.
   * @param  {Array} campaigns
   * @return {Array}
   */
  getEmailActivitiesOps(campaigns) {
    this.hull.logger.info("getEmailActivities", campaigns);
    return campaigns.map(c => {
      return {
        method: "GET",
        path: `/reports/${c.id}/email-activity/`,
        params: {
          exclude_fields: "_links"
        }
      };
    });
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
  getMemberActivities(users) {
    this.hull.logger.info("getMemberActivities", users.length);
    return Promise.map(users, e => {
      e.email_id = e.email_id || this.getEmailId(e.email);
      return this.mailchimpClient
        .get(`/lists/${this.listId}/members/${e.email_id}/activity`)
        .query({
          exclude_fields: "_links"
        })
        .then(res => {
          return _.merge(res.body, { email_address: e.email });
        });
    }, { concurrency: 3 });
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
      const user = this.hull.as({
        email: email.email_address
      });
      return Promise.all(email.activity.map(a => {
        const uniqId = this.getUniqId({ email, activity: a });
        this.hull.logger.info("trackEvents.track", {
          email: email.email_address,
          action: a.action,
          timestamp: a.timestamp,
          uniqId
        });
        const eventName = this.getEventName(a);
        const props = this.getEventProperties(a, email);

        return user.track(eventName, props, {
          source: "mailchimp",
          event_id: uniqId,
          created_at: a.timestamp
        });
      }));
    });

    return Promise.all(emailTracks);
  }

  /**
   * @param {Array}
   * @param {}
   * @type {Array}
   */
  filterEvents(emailActivites, last_track_at = null) {
    if (last_track_at) {
      emailActivites = emailActivites.map(e => {
        e.activity = e.activity.filter(a => {
          return moment(a.timestamp).utc().isAfter(last_track_at);
        });
        return e;
      });
    }

    emailActivites = emailActivites.filter(e => !_.isEmpty(e.activity));

    return emailActivites;
  }

  /**
   * Generate unique id for an event
   * @param  {Object} email
   * @param  {Object} activity
   * @return {String}
   */
  getUniqId({ email, activity }) {
    return [email.email_id, activity.action, activity.timestamp].join("-");
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
