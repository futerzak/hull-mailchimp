import express from "express";
import path from "path";
import { renderFile } from "ejs";
import bodyParser from "body-parser";
import _ from "lodash";
import { NotifHandler, Middleware } from "hull";

import fetchShip from "./lib/middlewares/fetch-ship";
import oauth from "./lib/oauth-client";
import AppMiddleware from "./lib/middlewares/app";
import snsMessage from "./lib/middlewares/sns-message";
import controller from "./controller";
const { notifyController } = controller;

export default function Server({ queueAgent, hostSecret }) {
  const app = express();

  app.use(express.static(path.resolve(__dirname, "..", "dist")));
  app.use(express.static(path.resolve(__dirname, "..", "assets")));
  app.set("views", `${__dirname}/views`);
  app.engine("html", renderFile);

  app.post("/notify", Middleware({ hostSecret }), AppMiddleware({ hostSecret }), NotifHandler({
    hostSecret,
    groupTraits: false,
    handlers: {
      "segment:update": notifyController.segmentUpdateHandler.bind(notifyController),
      "segment:delete": notifyController.segmentDeleteHandler.bind(notifyController),
      "user:update": notifyController.userUpdateHandler.bind(notifyController),
      "ship:update": notifyController.shipUpdateHandler.bind(notifyController),
    }
  }));

  // app.post("/notify", snsMessage, bodyParser.json(), (req, res) => {
  //   if (_.get(req.body, "Subject") === "user_report:update") {
  //     // exclude users being recently synced from mailchimp
  //     const message = JSON.parse(req.body.Message);
  //     if (!_.isEmpty(_.get(message.changes, "user['traits_mailchimp/unique_email_id'][1]"))) {
  //       console.log("handleUserUpdate.skippingUser", _.get(message.changes, "user['traits_mailchimp/unique_email_id'][1]"));
  //       return res.end("ok");
  //     }
  //   }
  //
  //   req.body = JSON.stringify(req.body);
  //   queueAgent.queueRequest(req);
  //   res.end("ok");
  // });

  app.post("/batch", snsMessage, bodyParser.json(), (req, res) => {
    queueAgent.create("handleBatchJob", req.body, {}, req);
    res.end("ok");
  });

  app.post("/track", snsMessage, bodyParser.json(), (req, res) => {
    queueAgent.create("trackJob", req.body, {}, req);
    res.end("ok");
  });

  app.post("/sync", snsMessage, bodyParser.json(), (req, res) => {
    queueAgent.create("syncJob", req.body, {}, req);
    res.end("ok");
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

  app.post("/requestTrack", bodyParser.json(), fetchShip, (req, res) => {
    queueAgent.create("requestTrackJob", {}, {}, req);
    res.end("ok");
  });

  app.post("/checkBatchQueue", bodyParser.json(), fetchShip, (req, res) => {
    queueAgent.create("checkBatchQueueJob", {}, {}, req);
    res.end("ok");
  });

  app.get("/manifest.json", (req, res) => {
    res.sendFile(path.resolve(__dirname, "..", "manifest.json"));
  });

  return app;
}
