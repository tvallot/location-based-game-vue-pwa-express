import express from "express";
import { isLatLon } from "../game/geo.js";
import { captureExplorer, getVisibleResources, treatObject, updatePosition } from "../game/game.js";

export function createGameRouter(state, logger) {
  const router = express.Router();

  router.post("/position", (req, res) => {
    const { position } = req.body ?? {};
    if (!isLatLon(position)) {
      return res.status(400).json({ error: "position must be [lat, lon]" });
    }

    const { player, eliminatedBy } = updatePosition(state, req.user, position);
    logger.info(`MOVE user=${player.id} role=${player.role} pos=${JSON.stringify(position)}`);

    if (eliminatedBy) {
      logger.info(`EATEN user=${player.id} creature=${eliminatedBy}`);
      return res.json({ ok: false, eliminatedBy: "creature" });
    }
    return res.json({ ok: true });
  });

  router.get("/resources", (req, res) => {
    res.json(getVisibleResources(state, req.user));
  });

  router.post("/objects/:id/treat", (req, res) => {
    const outcome = treatObject(state, req.user, req.params.id);
    logger.info(`OBJECT_${outcome.result.toUpperCase()} user=${req.user.login} object=${req.params.id}`);
    res.json({ ok: true, ...outcome });
  });

  router.post("/explorers/:id/capture", (req, res) => {
    const outcome = captureExplorer(state, req.user, req.params.id);
    logger.info(`CAPTURE rival=${req.user.login} explorer=${req.params.id}`);
    res.json({ ok: true, ...outcome });
  });

  router.get("/zrr", (req, res) => {
    if (!state.zrr) return res.status(404).json({ error: "Game area not defined" });
    return res.json(state.zrr);
  });

  return router;
}
