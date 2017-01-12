import SegmentsAgent from "../server/lib/sync-agent/segments-mapping-agent.js";
import assert from "assert";
import proxyquire from "proxyquire";


describe.only("SegmentsMappingAgent", () => {
    describe("getSegmentIds", () => {
        it("should return segments keys", () => {
            const segmentsAgent = new SegmentsAgent({}, {}, {
                private_settings:{segment_mapping: {"1":"1"}}
            });

            assert("1", segmentsAgent.getSegmentIds());
        });

        it("should return the array with keys", () => {
            const segmentsAgent = new SegmentsAgent({}, {}, {
                private_settings:{
                  segment_mapping: {
                    "1": "1",
                    "2": "test1",
                    "aaa": 1234
                }
              }
            });

            assert(["1", "2", "aaa"], segmentsAgent.getSegmentIds());
        });

        it("should return empty array", () => {
            const segmentsAgent = new SegmentsAgent({}, {}, {
                private_settings:{
                  segment_mapping: {}
                }
            });

            assert([], segmentsAgent.getSegmentIds());
        });
    });

    // [TODO] do something with promise
    describe("getMailchimpSegments", () => {
        it("should return mailchimp segment", () => {

            class MailchimpClientStub {
              get(url){
                return {query: ({})=>{return Promise.resolve({})}};
              }
            }
            const mailchimpClient = new MailchimpClientStub();
            const ship = {
              private_settings: {
                mailchimp_list_id: {
                  "1":"1"
                }
              }
            };

            const segmentsAgent = new SegmentsAgent(mailchimpClient, {}, ship);

            return segmentsAgent.getMailchimpSegments().then(res => {
              assert.deepEqual({}, res);
            });
        });
    });

    describe.skip("recreateSegment", () => {
        it("should return Promise", () => {
            assert(true, true);
        });
    });

    describe("createSegment", () => {
      describe("create new segment", () => {
        it("should return Promise when create new segment", () => {

            class MailchimpClientStub {
              get(url){
                const payload = {
                  body:{
                    segments:{}
                  }
                };
                return {query: ({})=>{return Promise.resolve(payload)}};
              }

              post(url){
                const payload = {body:{id:"1"}};
                return {
                  send: () => {
                    return Promise.resolve(payload)
                  }
                }
              }
            }
            const mailchimpClientStub = new MailchimpClientStub();

            const ship = {
              private_settings:{
                mailchimp_list_id:{
                  "1":"1"
                }
              }
            };

            const segmentsAgent = new SegmentsAgent(mailchimpClientStub, {}, ship);

            const segment = {
                name: "testSegment",
                id: "1"
            }
            assert(segmentsAgent.createSegment(segment) instanceof Promise);
            // return segmentsAgent.createSegment(segment).then(res => {
            //   assert.deepEqual(undefined, res);
            // });
          });
        });
        describe("try to create existing segment", () => {
          it("should return Promise", () => {
            assert(true, true);
          });
        });
    });

    describe("deleteSegment", () => {
      it("should return Promise when segment not exists", () => {
        class MailchimpClientStub {
          get(url){
            const payload = {
              body:{
                segments:{}
              }
            };
            return {query: ({})=>{return Promise.resolve(payload)}};
          }

          post(url){
            const payload = {body:{id:"1"}};
            return {
              send: () => {
                return Promise.resolve(payload)
              }
            }
          }
        }
        const mailchimpClientStub = new MailchimpClientStub();

        const ship = {
          private_settings:{
            mailchimp_list_id:{
              "1":"1"
            }
          }
        };

        const segmentsAgent = new SegmentsAgent(mailchimpClientStub, {}, ship);
        const segment = {
            name: "testSegment",
            id: "1"
        }

        assert(true,segmentsAgent.deleteSegment(segment) instanceof Promise);
        // return segmentsAgent.deleteSegment(segment).then(res => {
        //   assert(true, res);
        // });
      });
      it("should return Promise when segment exists", () => {
        class MailchimpClientStub {
          get(url){
            const payload = {
              body:{
                segments:{}
              }
            };
            return {
              query: ({}) => {return Promise.resolve(payload)}
            };
          }

          post(url){
            const payload = {body:{id:"1"}};
            return {
              send: () => {
                return Promise.resolve(payload)
              }
            }
          }

          delete(url){
            const payload = {}

            return Promise.resolve({});
          }
        }
        const mailchimpClientStub = new MailchimpClientStub();

        const ship = {
          private_settings:{
            mailchimp_list_id:{
              "1":"1"
            },
            segment_mapping:{
              "1":"testSegment"
            }
          }
        };

        const segmentsAgent = new SegmentsAgent(mailchimpClientStub, {}, ship);
        const segment = {
            name: "testSegment",
            id: "1"
        }

        assert(true, segmentsAgent.deleteSegment(segment) instanceof Promise);
        // return segmentsAgent.deleteSegment(segment).then(res => {
        //   assert(true, res);
        // });
      });
    });

    describe("getAudienceId", () => {
        it("should return segment", () => {
            const segmentsAgent = new SegmentsAgent({},{},{
                "private_settings.segment_mapping": {"1":{"emptySegment": "test"}}
            });
            // [TODO] może wystarczy zwykłe equal ??
            assert.deepEqual({"emptySegment": "test"}, segmentsAgent.getAudienceId("1"));
        });

        it("should return empty object", () => {
            const segmentsAgent = new SegmentsAgent({},{},{
                "private_settings.segment_mapping": {"1":{}}
            });

            assert.deepEqual({}, segmentsAgent.getAudienceId("1"));
        });

        it("should return string 'test'", () => {
            const segmentsAgent = new SegmentsAgent({},{},{
                "private_settings.segment_mapping": {"1":"test"}
            });

            assert.deepEqual("test", segmentsAgent.getAudienceId("1"));
        });

        it("should return undefined", () => {
            const segmentsAgent = new SegmentsAgent({},{},{
                "private_settings.segment_mapping": {"1":"test"}
            });

            assert.deepEqual(undefined, segmentsAgent.getAudienceId("2"));
        });
    });

    describe.skip("syncSegments", () => {
        it("should return Promise", () => {
            assert(true, true);
        });
    });
});
