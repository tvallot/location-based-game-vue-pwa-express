import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { ROLES } from "../game/rules.js";

/**
 * Tokens are issued by a separate authentication server. The API decodes the
 * token to read the user, then asks the auth server whether it is still valid.
 */
export function createRemoteTokenValidator(authServerUrl, logger = console) {
  return async function validateToken(token) {
    try {
      const claims = jwtDecode(token);

      await axios.get(`${authServerUrl}/authenticate`, {
        params: { jwt: token, origin: claims.origin },
        timeout: 2000,
      });

      const role = String(claims.species ?? claims.role ?? "").toLowerCase();
      if (!claims.sub || !ROLES.includes(role)) return null;

      return { login: claims.sub, role };
    } catch (error) {
      logger.warn(`Token rejected: ${error.message}`);
      return null;
    }
  };
}
