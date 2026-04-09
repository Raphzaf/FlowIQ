/**
 * POST /api/scraper/israel/login
 *
 * Initiates a bank scraping session.
 *
 * Request body:
 *   {
 *     company_id: string,          // e.g. "hapoalim"
 *     credentials: {               // fields vary by institution (see /supported)
 *       username?: string,
 *       userCode?: string,
 *       id?: string,
 *       password: string,
 *       otp?: string               // pre-provided OTP (optional)
 *     },
 *     start_date?: string          // ISO date, defaults to 30 days ago
 *   }
 *
 * Response:
 *   { status: "connected", accounts: [...] }
 *   { status: "otp_required" }   – when OTP is needed but not provided
 *   { status: "error", errorType: string, errorMessage: string }
 *
 * Protected by X-Internal-Secret header.
 *
 * Serverless limitations:
 *   - Requires Vercel Pro/Enterprise (≥60 s timeout) for browser-based scraping.
 *   - For OTP-requiring banks, provide the OTP upfront in credentials.otp.
 */

"use strict";

const { verifyInternalSecret, parseBody, sendJson } = require("./_auth");
const { runScraper, getSupportedInstitutions, MVP_COMPANY_IDS } = require("./_helper");

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
  } catch (err) {
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
  if (!credentials.password) {
    return sendJson(res, 400, { error: "credentials.password is required" });
  }

  // If OTP is required by this bank but not supplied, let the caller know
  // so they can collect the OTP from the user and retry via /otp.
  // Note: we cannot trigger the actual OTP SMS without starting a browser session.
  // For the MVP the caller should provide OTP upfront.
  // We detect "needs OTP" heuristically from known institutions.
  const OTP_BANKS = ["hapoalim"];
  const needsOtp = OTP_BANKS.includes(company_id);
  if (needsOtp && !credentials.otp) {
    return sendJson(res, 200, {
      status: "otp_required",
      company_id,
      message:
        "This bank requires an OTP. Please provide it in credentials.otp and retry via POST /api/scraper/israel/otp.",
    });
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

    // Scraper-level error
    if (result.errorType === "CHANGE_PASSWORD_NEEDED") {
      return sendJson(res, 200, {
        status: "error",
        errorType: result.errorType,
        errorMessage: "Bank requires a password change. Please log in to the bank website first.",
      });
    }

    return sendJson(res, 200, {
      status: "error",
      errorType: result.errorType || "UNKNOWN",
      errorMessage: result.errorMessage || "Scraping failed",
    });
  } catch (err) {
    return sendJson(res, 500, {
      status: "error",
      errorType: "INTERNAL",
      errorMessage: String(err.message || err),
    });
  }
};
