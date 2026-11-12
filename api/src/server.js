import { createApp } from "./app.js";
import { createRemoteTokenValidator } from "./auth/remoteTokenValidator.js";
import { config } from "./config.js";
import { accessLogger, gameLogger } from "./logger.js";

const app = createApp({
  validateToken: createRemoteTokenValidator(config.authServerUrl, gameLogger),
  authServerUrl: config.authServerUrl,
  logger: gameLogger,
  accessLogger,
});

app.listen(config.port, () => {
  gameLogger.info(`API listening on port ${config.port}`);
});
