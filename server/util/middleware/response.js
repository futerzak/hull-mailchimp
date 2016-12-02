import _ from "lodash";

/**
 * @param  {Object}   req
 * @param  {Object}   res
 * @param  {Function} next
 */
export default function responseMiddleware(result, req, res, next) {
  if (_.isError(result)) {
    res.status(500);
  } else {
    res.status(200);
  }
  res.end("ok");
  next();
}
