import { spawnObject } from "../src/game/game.js";
import { distanceMeters } from "../src/game/geo.js";
import { createTestApp, north, ORIGIN } from "./support/testApp.js";

describe("Game API", () => {
  let state, explorer, rival;

  beforeEach(async () => {
    let as;
    ({ state, as } = createTestApp());
    explorer = as("explorer:alice");
    rival = as("rival:bob");
  });

  const findResource = (response, id) => response.body.resources.find((resource) => resource.id === id);

  describe("GET /game/zrr", () => {
    it("returns 404 when no game area is defined", async () => {
      expect((await explorer.get("/game/zrr")).status).toBe(404);
    });

    it("returns the game area", async () => {
      state.zrr = { nw: [1, 1], ne: [1, 2], se: [0, 2], sw: [0, 1] };
      const response = await explorer.get("/game/zrr");
      expect(response.body).toEqual(state.zrr);
    });
  });

  describe("POST /game/position", () => {
    it("rejects malformed positions", async () => {
      expect((await explorer.post("/game/position", { position: "here" })).status).toBe(400);
    });

    it("eliminates a player who walks into a creature", async () => {
      spawnObject(state, { id: "shark", type: "creature", position: north(3) });

      const response = await explorer.post("/game/position", { position: ORIGIN });

      expect(response.body).toEqual({ ok: false, eliminatedBy: "creature" });
      expect(state.players.get("alice").active).toBeFalse();
      expect((await explorer.post("/game/position", { position: ORIGIN })).status).toBe(403);
    });
  });

  describe("GET /game/resources", () => {
    beforeEach(async () => {
      await explorer.post("/game/position", { position: ORIGIN });
      await rival.post("/game/position", { position: north(20) });
      spawnObject(state, { id: "chest", type: "artifact", position: north(15) });
    });

    it("hides rivals from explorers and blurs object positions", async () => {
      const response = await explorer.get("/game/resources");
      const chest = findResource(response, "chest");

      expect(findResource(response, "bob")).toBeUndefined();
      expect(chest.type).toBeUndefined();
      expect(chest.approxRadius).toBe(10);
      expect(distanceMeters(chest.position, north(15))).toBeLessThanOrEqual(10);
    });

    it("warns explorers when a rival is close to an object", async () => {
      const response = await explorer.get("/game/resources");
      expect(findResource(response, "chest").rivalNearby).toBeTrue();
    });

    it("shows explorers and exact object positions to rivals", async () => {
      const response = await rival.get("/game/resources");

      expect(findResource(response, "alice").position).toEqual(ORIGIN);
      expect(findResource(response, "chest").position).toEqual(north(15));
      expect(findResource(response, "chest").type).toBeUndefined();
    });

    it("drops expired objects", async () => {
      state.objects.get("chest").createdAt -= state.defaultTtlMs;
      const response = await rival.get("/game/resources");
      expect(findResource(response, "chest")).toBeUndefined();
    });
  });

  describe("POST /game/objects/:id/treat", () => {
    beforeEach(() => {
      spawnObject(state, { id: "chest", type: "artifact", position: ORIGIN });
    });

    it("lets an explorer secure an artifact within 10 m", async () => {
      await explorer.post("/game/position", { position: north(8) });
      const response = await explorer.post("/game/objects/chest/treat");

      expect(response.body.result).toBe("secured");
      expect(state.objects.get("chest").securedBy).toBe("alice");
      expect(state.players.get("alice").objectsDone).toBe(1);
    });

    it("lets a rival collect an unsecured artifact within 5 m", async () => {
      await rival.post("/game/position", { position: north(4) });
      const response = await rival.post("/game/objects/chest/treat");

      expect(response.body.result).toBe("collected");
      expect(state.objects.has("chest")).toBeFalse();
    });

    it("prevents rivals from collecting a secured artifact", async () => {
      await explorer.post("/game/position", { position: north(8) });
      await explorer.post("/game/objects/chest/treat");
      await rival.post("/game/position", { position: north(1) });

      expect((await rival.post("/game/objects/chest/treat")).status).toBe(409);
    });

    it("refuses when the player is too far", async () => {
      await rival.post("/game/position", { position: north(8) });
      const response = await rival.post("/game/objects/chest/treat");

      expect(response.status).toBe(403);
      expect(response.body.distanceMeters).toBeCloseTo(8, 0);
    });

    it("only reveals creatures", async () => {
      spawnObject(state, { id: "shark", type: "creature", position: north(30) });
      await explorer.post("/game/position", { position: north(22) });

      const response = await explorer.post("/game/objects/shark/treat");

      expect(response.body.result).toBe("creature");
      expect(state.players.get("alice").objectsDone).toBe(0);
    });
  });

  describe("POST /game/explorers/:id/capture", () => {
    beforeEach(async () => {
      await explorer.post("/game/position", { position: ORIGIN });
    });

    it("is reserved to rivals", async () => {
      expect((await explorer.post("/game/explorers/alice/capture")).status).toBe(403);
    });

    it("lets a rival capture a nearby explorer", async () => {
      await rival.post("/game/position", { position: north(3) });
      const response = await rival.post("/game/explorers/alice/capture");

      expect(response.status).toBe(200);
      expect(state.players.get("alice")).toEqual(
        jasmine.objectContaining({ active: false, eliminatedBy: "capture" }),
      );
      expect(state.players.get("bob").captures).toBe(1);
    });

    it("refuses when the explorer is too far", async () => {
      await rival.post("/game/position", { position: north(12) });
      expect((await rival.post("/game/explorers/alice/capture")).status).toBe(403);
    });
  });
});
