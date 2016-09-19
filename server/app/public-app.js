import express from "express";
import path from "path";
import { renderFile } from "ejs";
import bodyParser from "body-parser";
import { NotifHandler } from "hull";

import oauth from "../lib/oauth-client";
import QueueAgentMiddleware from "../lib/middlewares/queue-agent";
import controller from "../controller";
const { notifyController } = controller;

export default function Server({ queueAdapter, hostSecret }) {
  const app = express();

  app.use(express.static(path.resolve(__dirname, "..", "..", "dist")));
  app.use(express.static(path.resolve(__dirname, "..", "..", "assets")));
  app.set("views", `${__dirname}/../views`);
  app.engine("html", renderFile);

  app.post("/notify", QueueAgentMiddleware({ queueAdapter }), NotifHandler({
    hostSecret,
    groupTraits: false,
    handlers: {
      "segment:update": notifyController.segmentUpdateHandler,
      "segment:delete": notifyController.segmentDeleteHandler,
      "user:update": notifyController.userUpdateHandler,
      "ship:update": notifyController.shipUpdateHandler,
    }
  }));

  app.post("/batch", bodyParser.json(), QueueAgentMiddleware({ queueAdapter }), (req, res) => {
    const segmentId = req.query.segment_id || null;
    return req.shipApp.queueAgent.create("handleBatchExtractJob", {
      body: req.body,
      chunkSize: 100,
      segmentId
    })
    .then(jobId => res.end(`ok: ${jobId}`));
  });

  app.post("/track", bodyParser.json(), QueueAgentMiddleware({ queueAdapter }), (req, res) => {
    return req.shipApp.queueAgent.create("trackJob", {
      body: req.body,
      chunkSize: 100
    })
    .then(jobId => res.end(`ok: ${jobId}`));
  });

  app.post("/sync", QueueAgentMiddleware({ queueAdapter }), (req, res) => {
    return req.shipApp.queueAgent.create("syncJob")
      .then(jobId => res.end(`ok: ${jobId}`));
  });

  app.use("/auth", oauth({
    name: "Mailchimp",
    clientID: process.env.MAILCHIMP_CLIENT_ID,
    clientSecret: process.env.MAILCHIMP_CLIENT_SECRET,
    callbackUrl: "/callback",
    homeUrl: "/",
    selectUrl: "/select",
    syncUrl: "/sync",
    site: "https://login.mailchimp.com",
    tokenPath: "/oauth2/token",
    authorizationPath: "/oauth2/authorize",
    hostSecret
  }));

  app.post("/requestTrack", QueueAgentMiddleware({ queueAdapter }), (req, res) => {
    return req.shipApp.queueAgent.create("requestTrackJob")
      .then(jobId => res.end(`ok: ${jobId}`));
  });

  app.get("/manifest.json", (req, res) => {
    res.sendFile(path.resolve(__dirname, "..", "..", "manifest.json"));
  });

  return app;
}
