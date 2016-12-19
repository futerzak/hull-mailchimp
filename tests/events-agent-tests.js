/* global describe, it */
import assert from "assert";
import sinon from "sinon";
import Promise from "bluebird";
import moment from "moment";
import Hull from "hull";

import EventsAgent from "../server/lib/sync-agent/events-agent";

const instrumentationAgent = {
  metricVal: function() {},
}

const mailchimpClient = {
  get: function() {},
  post: function() {},
  query: function() {},
};

const hullClient = {
  logger: {
    info: function() {}
  }
};
const hullClientMock = sinon.mock(hullClient);

describe("EventsAgent", function EventsAgentTest() {
  const private_settings = {
    mailchimp_list_id: "test"
  };

  describe("getTrackableCampaigns", () => {
    it("should return interesting campaigns", () => {
      const mailchimpClientMock = sinon.mock(mailchimpClient);
      mailchimpClientMock.expects("get")
        .once()
        .withExactArgs("/campaigns")
        .returns(mailchimpClient);

      mailchimpClientMock.expects("query")
        .once()
        .withExactArgs({
          fields: "campaigns.id,campaigns.status,campaigns.title,campaigns.send_time,campaigns.settings.title",
          list_id: private_settings.mailchimp_list_id,
          since_send_time: moment().subtract(1, "week").format()
        })
        .returns(Promise.resolve({
          body: {
            campaigns: [
              {
                id: "test1",
                status: "draft",
                title: "test1",
              },
              {
                id: "test2",
                status: "sent",
                title: "test2",
              },
            ]
          }
        }));

      const agent = new EventsAgent(mailchimpClient, hullClient, { private_settings }, instrumentationAgent);

      return agent.getTrackableCampaigns()
        .then(res => {
          mailchimpClientMock.verify();
          assert.deepEqual(res, [{
            id: "test2",
            status: "sent",
            title: "test2",
          }]);
        });
    });
  });

  describe("getMemberActivities", () => {

    it("should return all activites for specified user", () => {

      const mailchimpClientMock = sinon.mock(mailchimpClient);
      mailchimpClientMock.expects("get")
        .once()
        .withExactArgs(`/lists/${private_settings.mailchimp_list_id}/members/ffad177299613c50982e95a32c60adc7/activity`)
        .returns(mailchimpClient);

      mailchimpClientMock.expects("query")
        .withExactArgs({
          exclude_fields: "_links"
        })
        .returns(Promise.resolve({
          body: {
            activity: [ { action: 'bounce',
              timestamp: '2016-07-12T11:06:04+00:00',
              type: 'hard',
              campaign_id: 'fcd1ff3598' },
            { action: 'bounce',
              timestamp: '2016-07-12T11:02:19+00:00',
              type: 'hard',
              campaign_id: '2c4a24e9df',
              title: 'Hull bounce test' },
            { action: 'sent',
              timestamp: '2016-07-12T11:02:17+00:00',
              type: 'regular',
              campaign_id: 'fcd1ff3598' },
            { action: 'sent',
              timestamp: '2016-07-12T10:58:09+00:00',
              type: 'regular',
              campaign_id: '2c4a24e9df',
              title: 'Hull bounce test' } ],
            email_id: 'ffad177299613c50982e95a32c60adc7',
            list_id: '319f54214b',
          }
        }));

      const agent = new EventsAgent(mailchimpClient, hullClient, { private_settings }, instrumentationAgent);

      return agent.getMemberActivities([{
        id: "test",
        email: "bouncer@michaloo.net",
      }])
      .then(res => {
        mailchimpClientMock.verify();
        assert.deepEqual(res, [{
          activity: [ { action: 'bounce',
            timestamp: '2016-07-12T11:06:04+00:00',
            type: 'hard',
            campaign_id: 'fcd1ff3598' },
          { action: 'bounce',
            timestamp: '2016-07-12T11:02:19+00:00',
            type: 'hard',
            campaign_id: '2c4a24e9df',
            title: 'Hull bounce test' },
          { action: 'sent',
            timestamp: '2016-07-12T11:02:17+00:00',
            type: 'regular',
            campaign_id: 'fcd1ff3598' },
          { action: 'sent',
            timestamp: '2016-07-12T10:58:09+00:00',
            type: 'regular',
            campaign_id: '2c4a24e9df',
            title: 'Hull bounce test' } ],
          email_address: "bouncer@michaloo.net",
          email_id: 'ffad177299613c50982e95a32c60adc7',
          list_id: '319f54214b'
        }]);
      });
    });
  });
});
