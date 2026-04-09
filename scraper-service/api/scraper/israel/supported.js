/**
 * POST /api/scraper/israel/supported
 *
 * Returns the MVP set of supported Israeli banking institutions.
 * Protected by X-Internal-Secret header.
 */

"use strict";

const { verifyInternalSecret, parseBody, sendJson } = require("./_auth");
const { getSupportedInstitutions } = require("./_helper");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method Not Allowed" });
  }

  const auth = verifyInternalSecret(req);
  if (!auth.ok) {
    return sendJson(res, 403, { error: auth.error });
  }

  try {
    await parseBody(req); // consume body even if unused
    const institutions = getSupportedInstitutions();
    return sendJson(res, 200, { institutions });
  } catch (err) {
    return sendJson(res, 500, { error: String(err.message || err) });
  }
};
