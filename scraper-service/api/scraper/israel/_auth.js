/**
 * Shared authentication middleware for the Israel bank scraper microservice.
 *
 * Every endpoint validates the `X-Internal-Secret` header against the
 * `INTERNAL_API_SECRET` environment variable using a constant-time comparison
 * to prevent timing attacks.
 */

"use strict";

const crypto = require("crypto");

/**
 * Verify the X-Internal-Secret header.
 *
 * @param {import('http').IncomingMessage} req
 * @returns {{ ok: boolean, error?: string }}
 */
function verifyInternalSecret(req) {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    return { ok: false, error: "INTERNAL_API_SECRET is not configured on the server" };
  }

  const provided = req.headers["x-internal-secret"];
  if (!provided || typeof provided !== "string") {
    return { ok: false, error: "Missing X-Internal-Secret header" };
  }

  // Constant-time comparison to avoid timing attacks
  const expectedBuf = Buffer.from(secret, "utf8");
  const providedBuf = Buffer.from(provided, "utf8");

  if (expectedBuf.length !== providedBuf.length) {
    // Use timingSafeEqual on same-length buffers to avoid length leaking
    // Still compare to prevent short-circuit — but lengths differ so it's always false
    crypto.timingSafeEqual(expectedBuf, Buffer.alloc(expectedBuf.length));
    return { ok: false, error: "Forbidden" };
  }

  if (!crypto.timingSafeEqual(expectedBuf, providedBuf)) {
    return { ok: false, error: "Forbidden" };
  }

  return { ok: true };
}

/**
 * Parse and return the JSON request body.
 *
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<unknown>}
 */
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

/**
 * Send a JSON response.
 *
 * @param {import('http').ServerResponse} res
 * @param {number} status
 * @param {unknown} body
 */
function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

module.exports = { verifyInternalSecret, parseBody, sendJson };
