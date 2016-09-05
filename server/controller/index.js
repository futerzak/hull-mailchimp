import BatchController from "./batch";
import MailchimpBatchController from "./mailchimp-batch";

export default {
  batchController: new BatchController(),
  mailchimpBatchController: new MailchimpBatchController()
};
