import BatchController from "./batch";
import MailchimpBatchController from "./mailchimp-batch";
import MailchimpWebhookController from "./mailchimp-webhook";
import SyncController from "./sync";
import TrackController from "./track";
import NotifyController from "./notify";

export default {
  batchController: new BatchController(),
  mailchimpBatchController: new MailchimpBatchController(),
  syncController: new SyncController(),
  trackController: new TrackController(),
  notifyController: new NotifyController(),
  mailchimpWebhookController: new MailchimpWebhookController()
};
