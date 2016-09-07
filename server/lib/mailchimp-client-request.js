import request from "superagent";
import prefixPlugin from "superagent-prefix";
import superagentPromisePlugin from "superagent-promise-plugin"
import JSONStream from "JSONStream";
import BatchStream from "batch-stream";
import tar from "tar-stream";
import zlib from "zlib";
import ps from "promise-streams";
import es from "event-stream";


// import _ from "lodash";
// import Promise from "bluebird";
//
// import Mailchimp from "mailchimp-api-v3";
// import limiter from "./limiter";

export default class MailchimpClient {

  constructor({ api_key, domain, mailchimp_list_id }) {
    this.apiKey = api_key;
    this.domain = domain;
    this.listId = mailchimp_list_id;
    this.req = request;
  }

  attach(req) {
   return req
     .use(prefixPlugin(`https://${this.domain}.api.mailchimp.com/3.0`))
     .use(superagentPromisePlugin)
     .set({ "Authorization": `OAuth ${this.apiKey}` })
     .on("request", (reqData) => {
       console.log("REQ", reqData.url);
     });
  }

  get(url) {
    const req = this.req.get(url);
    return this.attach(req);
  }

  post(url) {
    const req = this.req.post(url);
    return this.attach(req);
  }

  put(url) {
    const req = this.req.put(url);
    return this.attach(req);
  }

  delete(url) {
    const req = this.req.delete(url);
    return this.attach(req);
  }

  /**
   * Method to handle Mailchimp batch response as a JSON stream
   * @param  {String} { response_body_url }
   * @return {Stream}
   */
  handleResponse({ response_body_url }) {
    const extract = tar.extract();
    const decoder = JSONStream.parse();

    extract.on("entry", (header, stream, callback) => {
      if (header.name.match(/\.json/)) {
        stream.pipe(decoder);
      }

      stream.on("end", () => {
        callback(); // ready for next entry
      });

      stream.resume();
    });

    request(response_body_url)
      .pipe(zlib.createGunzip())
      .pipe(extract);

    return decoder
      .pipe(es.through(function write(data) {
        data.map(r => {
          return this.emit("data", r);
        });
      }));
  }

}
