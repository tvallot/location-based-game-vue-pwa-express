import request from "supertest";
import { createApp } from "../../src/app.js";
import { createGameState } from "../../src/game/game.js";
import { destination } from "../../src/game/geo.js";

export const ORIGIN = [45.782, 4.8656];

/** Point `meters` north of ORIGIN. */
export const north = (meters) => destination(ORIGIN, meters, 0);

const silentLogger = { info() {}, warn() {}, error() {} };

/** In tests a token is simply "<role>:<login>", e.g. "rival:bob". */
async function fakeValidateToken(token) {
  const [role, login] = token.split(":");
  return role && login ? { role, login } : null;
}

export function createTestApp() {
  const state = createGameState();
  const app = createApp({
    validateToken: fakeValidateToken,
    authServerUrl: "http://auth.invalid",
    state,
    logger: silentLogger,
  });

  const as = (token) => ({
    get: (url) => request(app).get(url).set("Authorization", `Bearer ${token}`),
    post: (url, body) => request(app).post(url).set("Authorization", `Bearer ${token}`).send(body),
  });

  return { app, state, as };
}
