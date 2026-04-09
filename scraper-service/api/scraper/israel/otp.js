/**
 * POST /api/scraper/israel/otp
 *
 * Complete a bank login that requires OTP.
 * The caller must include the OTP code (received via SMS/app) in the body.
 *
 * Request body:
 *   {
 *     company_id: string,
 *     credentials: {
 *       username?: string,
 *       userCode?: string,
 *       id?: string,
 *       password: string,
 *       otp: string          // REQUIRED – the OTP code
 *     },
 *     start_date?: string    // ISO date, defaults to 30 days ago
 *   }
 *
 * Response:
 *   { status: "connected", accounts: [...] }
 *   { status: "error", errorType: string, errorMessage: string }
 *
 * Protected by X-Internal-Secret header.
 */

"use strict";

const { verifyInternalSecret, parseBody, sendJson } = require("./_auth");
const { runScraper, MVP_COMPANY_IDS } = require("./_helper");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method Not Allowed" });
  }

  const auth = verifyInternalSecret(req);
  if (!auth.ok) {
    return sendJson(res, 403, { error: auth.error });
  }

  let body;
  try {
    body = await parseBody(req);
  } catch {
    return sendJson(res, 400, { error: "Invalid JSON body" });
  }

  const { company_id, credentials, start_date } = body || {};

  if (!company_id || typeof company_id !== "string") {
    return sendJson(res, 400, { error: "company_id is required" });
  }
  if (!MVP_COMPANY_IDS.includes(company_id)) {
    return sendJson(res, 400, { error: `Unsupported company_id: ${company_id}` });
  }
  if (!credentials || typeof credentials !== "object") {
    return sendJson(res, 400, { error: "credentials object is required" });
  }
  if (!credentials.otp) {
    return sendJson(res, 400, { error: "credentials.otp is required for OTP completion" });
  }
  if (!credentials.password) {
    return sendJson(res, 400, { error: "credentials.password is required" });
  }

  const startDate = start_date
    ? new Date(start_date)
    : (() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d;
      })();

  try {
    const result = await runScraper(company_id, credentials, startDate);

    if (result.success) {
      return sendJson(res, 200, {
        status: "connected",
        accounts: result.accounts || [],
      });
    }

    return sendJson(res, 200, {
      status: "error",
      errorType: result.errorType || "UNKNOWN",
      errorMessage: result.errorMessage || "Scraping failed after OTP",
    });
  } catch (err) {
    return sendJson(res, 500, {
      status: "error",
      errorType: "INTERNAL",
      errorMessage: String(err.message || err),
    });
  }
};
