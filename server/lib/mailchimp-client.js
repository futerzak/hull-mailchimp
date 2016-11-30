import request from "superagent";
import prefixPlugin from "superagent-prefix";
import superagentPromisePlugin from "superagent-promise-plugin";
import JSONStream from "JSONStream";
import tar from "tar-stream";
import zlib from "zlib";
import es from "event-stream";
import _ from "lodash";

export default class MailchimpClient {

  constructor(ship) {
    this.apiKey = _.get(ship, "private_settings.api_key");
    this.domain = _.get(ship, "private_settings.domain");
    this.listId = _.get(ship, "private_settings.mailchimp_list_id");
    this.req = request;
  }

  attach(req) {
    if (_.isEmpty(this.domain) || _.isEmpty(this.apiKey) || _.isEmpty(this.listId)) {
      throw new Error("Mailchimp access data not set!");
    }

    return req
      .use(prefixPlugin(`https://${this.domain}.api.mailchimp.com/3.0`))
      .use(superagentPromisePlugin)
      .set({ Authorization: `OAuth ${this.apiKey}` })
      .on("request", (reqData) => {
        console.log("REQ", reqData.method, reqData.url);
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
        stream.pipe(decoder, { end: false });
      }

      stream.on("end", () => callback()); // ready for next entry
      stream.on("error", () => callback()); // ready for next entry

      stream.resume();
    });

    extract.on("finish", () => decoder.end());
    extract.on("error", () => decoder.end());

    request(response_body_url)
      .pipe(zlib.createGunzip())
      .pipe(extract);

    return decoder
      .pipe(es.map(function write(data, callback) {
        return data.map(r => {
          return callback(null, r);
        });
      }));
  }

  handleError(err) {
    const filteredError = new Error(err.message, err.fileName, err.lineNumber);
    filteredError.extra = {
      reqUrl: _.get(err, "response.request.url"),
      reqMethod: _.get(err, "response.request.method"),
      reqData: _.get(err, "response.request._data"),
      body: _.get(err, "response.body"),
      statusCode: _.get(err, "response.statusCode"),
    };
    return filteredError;
  }

}
