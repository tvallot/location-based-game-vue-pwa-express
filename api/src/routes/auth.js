import express from "express";
import axios from "axios";

/** Forwards login requests to the auth server so that clients only talk to the API. */
export function createAuthRouter(authServerUrl) {
  const router = express.Router();

  router.post("/login", async (req, res) => {
    try {
      const response = await axios.post(`${authServerUrl}/login`, req.body, { timeout: 3000 });
      const header = response.headers.authorization ?? "";
      const token = response.data?.token ?? header.replace(/^Bearer /, "");

      if (!token) return res.status(502).json({ error: "Auth server returned no token" });
      return res.json({ token });
    } catch (error) {
      if (error.response) {
        return res.status(error.response.status).json({ error: "Invalid login or password" });
      }
      return res.status(502).json({ error: "Auth server unreachable" });
    }
  });

  return router;
}
