import { randomUUID } from "node:crypto";
import { distanceMeters, randomPointNear } from "./geo.js";
import { RULES } from "./rules.js";

export class GameError extends Error {
  constructor(status, message, details = {}) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/**
 * In-memory game state. A game session is short-lived, so there is no database.
 *
 * players: login -> { id, role, position, active, eliminatedBy, objectsDone, captures }
 * objects: id -> { id, type, position, fuzzyCenter, createdAt, ttlMs, securedBy }
 */
export function createGameState() {
  return {
    players: new Map(),
    objects: new Map(),
    zrr: null,
    defaultTtlMs: RULES.defaultTtlMs,
  };
}

export function getOrCreatePlayer(state, user) {
  let player = state.players.get(user.login);
  if (!player) {
    player = {
      id: user.login,
      role: user.role,
      position: null,
      active: true,
      eliminatedBy: null,
      objectsDone: 0,
      captures: 0,
    };
    state.players.set(user.login, player);
  }
  // The auth server is the source of truth for roles.
  player.role = user.role;
  return player;
}

function remainingTtl(object, now) {
  return Math.max(0, object.ttlMs - (now - object.createdAt));
}

export function purgeExpiredObjects(state, now = Date.now()) {
  for (const [id, object] of state.objects) {
    if (remainingTtl(object, now) === 0) state.objects.delete(id);
  }
}

function eliminate(player, reason) {
  player.active = false;
  player.position = null;
  player.eliminatedBy = reason;
}

function requireActivePlayer(state, user) {
  if (user.role === "admin") throw new GameError(403, "Admins do not play");
  const player = getOrCreatePlayer(state, user);
  if (!player.active) throw new GameError(403, "Player has been eliminated");
  return player;
}

function requirePosition(player) {
  if (!player.position) throw new GameError(400, "Send your position first");
  return player.position;
}

/** Moves the player. Walking within range of a creature eliminates them. */
export function updatePosition(state, user, position) {
  const player = requireActivePlayer(state, user);
  player.position = position;

  purgeExpiredObjects(state);
  for (const object of state.objects.values()) {
    if (object.type !== "creature") continue;
    if (distanceMeters(position, object.position) <= RULES.creatureKillRadius) {
      eliminate(player, "creature");
      return { player, eliminatedBy: object.id };
    }
  }

  return { player, eliminatedBy: null };
}

export function spawnObject(state, { id, type, position }) {
  const object = {
    id: id || `obj-${randomUUID().slice(0, 8)}`,
    type,
    position,
    // Explorers only get an approximate area. The offset is drawn once so that
    // averaging several requests does not reveal the real position.
    fuzzyCenter: randomPointNear(position, RULES.explorerUncertaintyRadius),
    createdAt: Date.now(),
    ttlMs: state.defaultTtlMs,
    securedBy: null,
  };
  state.objects.set(object.id, object);
  return object;
}

function publicPlayer(player) {
  return {
    id: player.id,
    role: player.role,
    position: player.position,
    objectsDone: player.objectsDone,
    captures: player.captures,
  };
}

function isRivalNearby(state, object) {
  for (const player of state.players.values()) {
    if (player.role !== "rival" || !player.active || !player.position) continue;
    if (distanceMeters(player.position, object.position) <= RULES.rivalAlertRadius) return true;
  }
  return false;
}

/**
 * What a user is allowed to see:
 * - explorers see other explorers and approximate object areas, and get warned
 *   when a rival is close to an object. They never see rivals.
 * - rivals see every player and the exact position of objects.
 * - admins see everything, including object types.
 * Players never learn whether an object is an artifact or a creature until they reach it.
 */
export function getVisibleResources(state, user, now = Date.now()) {
  purgeExpiredObjects(state, now);
  const me = user.role === "admin" ? null : getOrCreatePlayer(state, user);

  const players = [];
  for (const player of state.players.values()) {
    if (player.role === "admin" || !player.active || !player.position) continue;
    if (player.id === user.login) continue;
    if (user.role === "explorer" && player.role === "rival") continue;
    players.push(publicPlayer(player));
  }

  const objects = [];
  for (const object of state.objects.values()) {
    const base = {
      id: object.id,
      role: "object",
      ttlMs: remainingTtl(object, now),
      secured: object.securedBy !== null,
    };

    if (user.role === "admin") {
      objects.push({ ...base, type: object.type, position: object.position, securedBy: object.securedBy });
    } else if (user.role === "rival") {
      objects.push({ ...base, position: object.position });
    } else {
      objects.push({
        ...base,
        position: object.fuzzyCenter,
        approxRadius: RULES.explorerUncertaintyRadius,
        rivalNearby: isRivalNearby(state, object),
      });
    }
  }

  return {
    me: me && { ...publicPlayer(me), active: me.active, eliminatedBy: me.eliminatedBy },
    resources: [...players, ...objects],
  };
}

/**
 * Explorers secure artifacts (within 10 m), which protects them from rivals.
 * Rivals collect unsecured artifacts (within 5 m), which removes them from the map.
 * Reaching a creature only reveals what it is.
 */
export function treatObject(state, user, objectId) {
  const player = requireActivePlayer(state, user);
  const position = requirePosition(player);

  purgeExpiredObjects(state);
  const object = state.objects.get(objectId);
  if (!object) throw new GameError(404, "Object not found");

  const distance = distanceMeters(position, object.position);
  const range = player.role === "explorer" ? RULES.explorerSecureRadius : RULES.rivalCollectRadius;
  if (distance > range) {
    throw new GameError(403, "Too far from object", { distanceMeters: distance });
  }

  if (object.type === "creature") {
    return { result: "creature", distanceMeters: distance };
  }

  if (object.securedBy) {
    throw new GameError(409, "Object already secured by an explorer");
  }

  player.objectsDone += 1;

  if (player.role === "explorer") {
    object.securedBy = player.id;
    return { result: "secured", distanceMeters: distance };
  }

  state.objects.delete(object.id);
  return { result: "collected", distanceMeters: distance };
}

/** Rivals can see explorers, so they are the ones who can capture them (within 5 m). */
export function captureExplorer(state, user, targetId) {
  if (user.role !== "rival") throw new GameError(403, "Only rivals can capture explorers");

  const player = requireActivePlayer(state, user);
  const position = requirePosition(player);

  const target = state.players.get(targetId);
  if (!target || !target.active || !target.position) {
    throw new GameError(404, "Explorer not found");
  }
  if (target.role !== "explorer") throw new GameError(400, "Target is not an explorer");

  const distance = distanceMeters(position, target.position);
  if (distance > RULES.captureRadius) {
    throw new GameError(403, "Too far from explorer", { distanceMeters: distance });
  }

  eliminate(target, "capture");
  player.captures += 1;
  return { distanceMeters: distance };
}

/** Scoreboard for the admin dashboard. */
export function getStats(state) {
  const players = [...state.players.values()]
    .filter((player) => player.role !== "admin")
    .map((player) => ({
      ...publicPlayer(player),
      active: player.active,
      eliminatedBy: player.eliminatedBy,
    }));

  const byRole = (role) => players.filter((player) => player.role === role);
  const sum = (list, key) => list.reduce((total, player) => total + player[key], 0);

  return {
    players,
    totals: {
      artifactsSecured: sum(byRole("explorer"), "objectsDone"),
      artifactsCollected: sum(byRole("rival"), "objectsDone"),
      explorersCaptured: players.filter((player) => player.eliminatedBy === "capture").length,
      eatenByCreatures: players.filter((player) => player.eliminatedBy === "creature").length,
    },
  };
}
