import express from "express";
import { isLatLon } from "../game/geo.js";
import { getStats, spawnObject } from "../game/game.js";
import { OBJECT_TYPES, RULES } from "../game/rules.js";

export function createAdminRouter(state, logger) {
  const router = express.Router();

  /** Game area (ZRR), given as its four corners. */
  router.post("/zrr", (req, res) => {
    const { nw, ne, se, sw } = req.body ?? {};
    if (![nw, ne, se, sw].every(isLatLon)) {
      return res.status(400).json({ error: "nw, ne, se and sw must be [lat, lon]" });
    }

    state.zrr = { nw, ne, se, sw };
    logger.info(`ZRR_SET admin=${req.user.login} zrr=${JSON.stringify(state.zrr)}`);
    return res.json({ ok: true });
  });

  /** Lifetime of the objects spawned from now on. */
  router.post("/ttl", (req, res) => {
    const { ttlMs } = req.body ?? {};
    if (!Number.isInteger(ttlMs) || ttlMs <= 0 || ttlMs > RULES.maxTtlMs) {
      return res.status(400).json({ error: `ttlMs must be an integer between 1 and ${RULES.maxTtlMs}` });
    }

    state.defaultTtlMs = ttlMs;
    logger.info(`TTL_SET admin=${req.user.login} ttl_ms=${ttlMs}`);
    return res.json({ ok: true });
  });

  router.post("/objects", (req, res) => {
    const { id, position, type = "artifact" } = req.body ?? {};
    if (!isLatLon(position)) {
      return res.status(400).json({ error: "position must be [lat, lon]" });
    }
    if (!OBJECT_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${OBJECT_TYPES.join(", ")}` });
    }
    if (id && state.objects.has(id)) {
      return res.status(409).json({ error: "An object with this id already exists" });
    }

    const object = spawnObject(state, { id, type, position });
    logger.info(`OBJECT_SPAWN admin=${req.user.login} object=${object.id} type=${type}`);
    return res.status(201).json({ ok: true, id: object.id });
  });

  router.get("/stats", (req, res) => {
    res.json(getStats(state));
  });

  return router;
}
