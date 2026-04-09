/**
 * POST /api/scraper/israel/transactions
 *
 * Re-authenticates with the bank and returns transactions for the given
 * date range.  Stateless – re-runs a full login on each call.
 *
 * Request body:
 *   {
 *     company_id: string,
 *     credentials: { ...loginFields, otp?: string },
 *     start_date?: string,   // ISO date, defaults to 30 days ago
 *     end_date?: string      // ISO date, defaults to today (unused by lib – kept for API consistency)
 *   }
 *
 * Response:
 *   {
 *     accounts: [
 *       {
 *         accountNumber: string,
 *         balance?: number,
 *         txns: [
 *           {
 *             identifier?: string|number,
 *             date: string,
 *             processedDate: string,
 *             originalAmount: number,
 *             originalCurrency: string,
 *             chargedAmount: number,
 *             description: string,
 *             memo?: string,
 *             status: string,
 *             type: string,
 *             category?: string
 *           }
 *         ]
 *       }
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

  const { company_id, credentials, start_date } = body || {};

  if (!company_id || typeof company_id !== "string") {
    return sendJson(res, 400, { error: "company_id is required" });
  }
  if (!MVP_COMPANY_IDS.includes(company_id)) {
    return sendJson(res, 400, { error: `Unsupported company_id: ${company_id}` });
  }
  if (!credentials || !credentials.password) {
    return sendJson(res, 400, { error: "credentials with password are required" });
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

    if (!result.success) {
      return sendJson(res, 502, {
        error: `Scraping failed: ${result.errorMessage || result.errorType}`,
      });
    }

    return sendJson(res, 200, { accounts: result.accounts || [] });
  } catch (err) {
    return sendJson(res, 500, { error: String(err.message || err) });
  }
};
