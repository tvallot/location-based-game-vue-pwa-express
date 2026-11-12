// Distances are in meters.
export const RULES = {
  creatureKillRadius: 5,
  explorerSecureRadius: 10,
  rivalCollectRadius: 5,
  captureRadius: 5,
  rivalAlertRadius: 25,
  explorerUncertaintyRadius: 10,
  defaultTtlMs: 60_000,
  maxTtlMs: 24 * 60 * 60 * 1000,
};

export const ROLES = ["explorer", "rival", "admin"];
export const OBJECT_TYPES = ["artifact", "creature"];
