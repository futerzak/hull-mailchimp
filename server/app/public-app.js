import express from "express";
import path from "path";
import { renderFile } from "ejs";
import bodyParser from "body-parser";
import { NotifHandler, Routes } from "hull";

import oauth from "../lib/oauth-client";
import QueueAgentMiddleware from "../lib/middlewares/queue-agent";

import WebKueRouter from "../router/web-kue-router";

export default function Server({ queueAdapter, hostSecret, hullMiddleware, controllers }) {
  const app = express();

  const { notifyController, batchController, mailchimpWebhookController } = controllers;

  app.use(express.static(path.resolve(__dirname, "..", "..", "dist")));
  app.use(express.static(path.resolve(__dirname, "..", "..", "assets")));
  app.set("views", `${__dirname}/../../views`);
  app.engine("html", renderFile);

  app.use("/kue", WebKueRouter({ hostSecret, queueAdapter }));

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
    req.shipApp.queueAgent.create("syncOutJob");
    req.shipApp.queueAgent.create("syncInJob");
  });

  app.use("/mailchimp", hullMiddleware, bodyParser.urlencoded({ extended: true }), mailchimpWebhookController.handleAction);

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

  app.get("/", Routes.Readme);
  app.get("/readme", Routes.Readme);

  return app;
}
