import express from "express";
import { createAuthMiddleware, requireRole } from "./auth/authMiddleware.js";
import { createGameState, GameError } from "./game/game.js";
import { createAdminRouter } from "./routes/admin.js";
import { createAuthRouter } from "./routes/auth.js";
import { createGameRouter } from "./routes/game.js";

/**
 * Builds the Express app. Dependencies are injected so that tests can run
 * without an auth server and with a fresh game state.
 */
export function createApp({
  validateToken,
  authServerUrl,
  state = createGameState(),
  logger,
  accessLogger = logger,
}) {
  const app = express();
  const authenticate = createAuthMiddleware(validateToken);

  app.disable("x-powered-by");
  app.use(express.json());

  app.use((req, res, next) => {
    const ip =
      req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.socket.remoteAddress;
    accessLogger.info(`${req.method} ${req.originalUrl} ip=${ip}`);
    next();
  });

  app.get("/health", (req, res) => res.json({ status: "ok" }));
  app.use("/auth", createAuthRouter(authServerUrl));
  app.use("/game", authenticate, createGameRouter(state, logger));
  app.use("/admin", authenticate, requireRole("admin"), createAdminRouter(state, logger));

  app.use((req, res) => res.status(404).json({ error: "Not found" }));

  // Express recognises error handlers by their four parameters.
  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, next) => {
    if (error instanceof GameError) {
      return res.status(error.status).json({ error: error.message, ...error.details });
    }
    if (error.type === "entity.parse.failed") {
      return res.status(400).json({ error: "Invalid JSON body" });
    }
    logger.error(error.stack ?? String(error));
    return res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
