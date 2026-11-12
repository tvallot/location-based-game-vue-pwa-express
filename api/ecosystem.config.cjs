// PM2 configuration used on the production VM.
module.exports = {
  apps: [
    {
      name: "game-api",
      script: "src/server.js",
      env: {
        NODE_ENV: "production",
        PORT: 3376,
        AUTH_SERVER_URL: "http://127.0.0.1:8080",
      },
    },
  ],
};
