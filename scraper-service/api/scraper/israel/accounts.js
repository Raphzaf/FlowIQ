/**
 * POST /api/scraper/israel/accounts
 *
 * Re-authenticates with the bank and returns the current list of accounts
 * with their balances.  Stateless – re-runs a full login on each call.
 *
 * Request body:
 *   {
 *     company_id: string,
 *     credentials: { ...loginFields, otp?: string }
 *   }
 *
 * Response:
 *   {
 *     accounts: [
 *       { accountNumber: string, balance?: number, currency?: string }
 *     ]
 *   }
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

  const { company_id, credentials } = body || {};

  if (!company_id || typeof company_id !== "string") {
    return sendJson(res, 400, { error: "company_id is required" });
  }
  if (!MVP_COMPANY_IDS.includes(company_id)) {
    return sendJson(res, 400, { error: `Unsupported company_id: ${company_id}` });
  }
  if (!credentials || !credentials.password) {
    return sendJson(res, 400, { error: "credentials with password are required" });
  }

  // Use today as start date to minimize scraping scope (we only need account list)
  const today = new Date();
  today.setDate(today.getDate() - 1);

  try {
    const result = await runScraper(company_id, credentials, today);

    if (!result.success) {
      return sendJson(res, 502, {
        error: `Scraping failed: ${result.errorMessage || result.errorType}`,
      });
    }

    const accounts = (result.accounts || []).map((acc) => ({
      accountNumber: acc.accountNumber,
      balance: acc.balance,
    }));

    return sendJson(res, 200, { accounts });
  } catch (err) {
    return sendJson(res, 500, { error: String(err.message || err) });
  }
};
