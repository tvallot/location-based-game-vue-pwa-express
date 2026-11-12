import request from "supertest";
import { createTestApp, ORIGIN } from "./support/testApp.js";

describe("Admin API", () => {
  let app, state, admin;

  beforeEach(() => {
    let as;
    ({ app, state, as } = createTestApp());
    admin = as("admin:root");
  });

  describe("access control", () => {
    it("rejects requests without a token", async () => {
      const response = await request(app).post("/admin/ttl").send({ ttlMs: 1000 });
      expect(response.status).toBe(401);
    });

    it("rejects players", async () => {
      const { as } = createTestApp();
      const response = await as("explorer:alice").post("/admin/ttl", { ttlMs: 1000 });
      expect(response.status).toBe(403);
    });
  });

  describe("POST /admin/zrr", () => {
    const zrr = { nw: [45.79, 4.86], ne: [45.79, 4.87], se: [45.78, 4.87], sw: [45.78, 4.86] };

    it("stores the game area", async () => {
      const response = await admin.post("/admin/zrr", zrr);
      expect(response.status).toBe(200);
      expect(state.zrr).toEqual(zrr);
    });

    it("rejects invalid corners", async () => {
      const response = await admin.post("/admin/zrr", { ...zrr, sw: [200, 0] });
      expect(response.status).toBe(400);
      expect(state.zrr).toBeNull();
    });
  });

  describe("POST /admin/ttl", () => {
    it("updates the default TTL", async () => {
      const response = await admin.post("/admin/ttl", { ttlMs: 120000 });
      expect(response.status).toBe(200);
      expect(state.defaultTtlMs).toBe(120000);
    });

    it("rejects a negative TTL", async () => {
      const response = await admin.post("/admin/ttl", { ttlMs: -5 });
      expect(response.status).toBe(400);
    });
  });

  describe("POST /admin/objects", () => {
    it("spawns an object with the current default TTL", async () => {
      state.defaultTtlMs = 90000;
      const response = await admin.post("/admin/objects", { id: "obj-1", position: ORIGIN });

      expect(response.status).toBe(201);
      expect(state.objects.get("obj-1")).toEqual(
        jasmine.objectContaining({ type: "artifact", ttlMs: 90000, securedBy: null }),
      );
    });

    it("generates an id when none is given", async () => {
      const response = await admin.post("/admin/objects", { position: ORIGIN, type: "creature" });
      expect(response.status).toBe(201);
      expect(state.objects.has(response.body.id)).toBeTrue();
    });

    it("rejects duplicate ids and unknown types", async () => {
      await admin.post("/admin/objects", { id: "obj-1", position: ORIGIN });

      expect((await admin.post("/admin/objects", { id: "obj-1", position: ORIGIN })).status).toBe(409);
      expect((await admin.post("/admin/objects", { position: ORIGIN, type: "dragon" })).status).toBe(400);
    });
  });

  it("GET /admin/stats returns the scoreboard", async () => {
    state.players.set("alice", {
      id: "alice",
      role: "explorer",
      position: null,
      active: false,
      eliminatedBy: "capture",
      objectsDone: 2,
      captures: 0,
    });

    const response = await admin.get("/admin/stats");

    expect(response.status).toBe(200);
    expect(response.body.totals).toEqual({
      artifactsSecured: 2,
      artifactsCollected: 0,
      explorersCaptured: 1,
      eatenByCreatures: 0,
    });
  });
});
