import WorkerApp from "./util/app/worker";
import ExitHandler from "./util/handler/exit";
import tokenMiddleware from "./util/middleware/token";

import * as bootstrap from "./bootstrap";


const { hullMiddleware, queueAdapter, appMiddleware } = bootstrap;

const workerApp = new WorkerApp(bootstrap);

workerApp
  .use(tokenMiddleware)
  .use(hullMiddleware)
  .use(appMiddleware);

workerApp.process();

bootstrap.Hull.logger.info("workerApp.process");

ExitHandler(queueAdapter.exit.bind(queueAdapter));
