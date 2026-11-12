export const config = {
  port: Number(process.env.PORT) || 3376,
  authServerUrl: process.env.AUTH_SERVER_URL || "http://localhost:8080",
  logDir: process.env.LOG_DIR || "log",
  isTest: process.env.NODE_ENV === "test",
};
