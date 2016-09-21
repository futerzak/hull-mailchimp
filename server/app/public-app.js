import express from "express";
import path from "path";
import { renderFile } from "ejs";
import bodyParser from "body-parser";
import { NotifHandler } from "hull";

import oauth from "../lib/oauth-client";
import QueueAgentMiddleware from "../lib/middlewares/queue-agent";
import controller from "../controller";
const { notifyController, batchController } = controller;

export default function Server({ queueAdapter, hostSecret, hullMiddleware }) {
  const app = express();

  app.use(express.static(path.resolve(__dirname, "..", "..", "dist")));
  app.use(express.static(path.resolve(__dirname, "..", "..", "assets")));
  app.set("views", `${__dirname}/../../views`);
  app.engine("html", renderFile);

  // FIXME: to minimize the amount of ship settings calls we need to
  // share the ship cache in hull client middleware.
  // Right now we share the middleware between WorkerApp and admin dashboard router,
  // which is enough right now since every change in settings is done via admin dashboard.
  // The segment mapping settings is modified in local cache.
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

  app.post("/batch", bodyParser.json(), QueueAgentMiddleware({ queueAdapter }), batchController.handleBatchExtractAction);

  app.post("/track", bodyParser.json(), QueueAgentMiddleware({ queueAdapter }), (req, res) => {
    res.end("ok");
    return req.shipApp.queueAgent.create("trackJob", {
      body: req.body,
      chunkSize: 100
    });
  });

  app.post("/sync", QueueAgentMiddleware({ queueAdapter }), (req, res) => {
    res.end("ok");
    return req.shipApp.queueAgent.create("syncJob");
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
    hostSecret,
    hullMiddleware
  }));

  app.post("/requestTrack", QueueAgentMiddleware({ queueAdapter }), (req, res) => {
    res.end("ok");
    return req.shipApp.queueAgent.create("requestTrackJob");
  });

  app.get("/manifest.json", (req, res) => {
    res.sendFile(path.resolve(__dirname, "..", "..", "manifest.json"));
  });

  return app;
}
