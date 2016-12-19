/* global describe, it */
import assert from "assert";
import sinon from "sinon";
import Promise from "bluebird";
import moment from "moment";

import { hullAgent, queueAgent, hullClient } from "./support";

import handleBatchExtract from "../server/jobs/handle-batch-extract";


describe("handleBatchExtractJob", function EventsAgentTest() {
  it("should run extract data from json file", () => {
    const extractAgentMock = sinon.mock(hullAgent.extractAgent);
    extractAgentMock.expects("handleExtract")
      .once()
      .returns(Promise.resolve());

    return handleBatchExtract({
      shipApp: {
        syncAgent: {},
        queueAgent: {},
        hullAgent
      },
      hull: {
        client: hullClient
      },
      payload: {
        body: {
          url: "http://link-to-file.localhost/test.json",
          format: "json"
        }
      }
    })
    .then((res) => {
      extractAgentMock.verify();
    });
  });

  it("should parse user list adding segment id from payload", () => {
    hullAgent.userWhitelisted = () => true;
    hullAgent.extractAgent.handleExtract = function(body, chunkSize, cb) {
      return new Promise.resolve([cb([
        {id: "test", name: "test", segment_ids: [1, 123]}
      ])]);
    };
    const queueAgentMock = sinon.mock(queueAgent);
    queueAgentMock.expects("create")
      .once()
      .withExactArgs(
        "sendUsers",
        { users: [{ id: "test", segment_ids: [1, 123, "abc"] }] }
      )
      .returns(Promise.resolve());

    return handleBatchExtract({
      shipApp: {
        syncAgent: {},
        queueAgent,
        hullAgent
      },
      hull: {
        client: hullClient
      },
      payload: {
        body: {
          url: "http://link-to-file.localhost/test.json",
          format: "json"
        },
        segmentId: "abc"
      }
    })
    .then((res) => {
      queueAgentMock.verify();
    });
  });
});
