// Minimal stand-in for the authentication server used in production.
// It exposes the same two endpoints the API relies on:
//   POST /login          -> returns a JWT (body and Authorization header)
//   GET  /authenticate   -> 204 if the token is valid, 401 otherwise
// Users live in memory. This is for local development only.

import express from "express";
import jwt from "jsonwebtoken";

const PORT = Number(process.env.PORT) || 8080;
const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const TOKEN_TTL = process.env.TOKEN_TTL || "4h";

const users = new Map([
  ["admin", { password: "admin", species: "admin" }],
  ["explorer1", { password: "explorer1", species: "explorer" }],
  ["explorer2", { password: "explorer2", species: "explorer" }],
  ["rival1", { password: "rival1", species: "rival" }],
  ["rival2", { password: "rival2", species: "rival" }],
]);

const app = express();
app.use(express.json());

app.post("/login", (req, res) => {
  const { login, password } = req.body ?? {};
  const user = users.get(login);

  if (!user || user.password !== password) {
    return res.status(401).json({ error: "Invalid login or password" });
  }

  const token = jwt.sign({ species: user.species }, SECRET, { subject: login, expiresIn: TOKEN_TTL });
  res.set("Authorization", `Bearer ${token}`);
  return res.json({ token });
});

app.get("/authenticate", (req, res) => {
  try {
    jwt.verify(String(req.query.jwt ?? ""), SECRET);
    return res.sendStatus(204);
  } catch {
    return res.sendStatus(401);
  }
});

app.listen(PORT, () => {
  console.log(`Mock auth server listening on port ${PORT}`);
});
