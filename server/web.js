import WebApp from "./util/app/web";
import ExitHandler from "./util/handler/exit";
import BatchSyncHandler from "./util/handler/batch-sync";
import StaticRouter from "./util/router/static";
import KueRouter from "./util/router/kue";

import * as bootstrap from "./bootstrap";
import AppRouter from "./router/app";
import OAuthRouter from "./router/oauth";

const { instrumentationAgent } = bootstrap;

const port = process.env.PORT || 8082;

const app = WebApp();

app
  .use(instrumentationAgent.startMiddleware())
  .use("/", AppRouter(bootstrap))
  .use("/", StaticRouter(bootstrap))
  .use("/auth", OAuthRouter(bootstrap))
  .use("/kue", KueRouter(bootstrap))
  .use(instrumentationAgent.stopMiddleware());

app.listen(port, () => {
  bootstrap.Hull.logger.info("webApp.listen", port);
});

ExitHandler(BatchSyncHandler.exit.bind(BatchSyncHandler));
