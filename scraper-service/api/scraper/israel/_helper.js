/**
 * Shared helper that wraps israeli-bank-scrapers.
 *
 * Key design decisions for Vercel serverless:
 * - Chromium is provided via @sparticuz/chromium (serverless-compatible binary).
 * - Each request runs a full scrape in one shot (stateless).
 * - OTP is passed as part of credentials; for OTP-requiring banks the caller
 *   must obtain the OTP from the user before calling the endpoint.
 *
 * Limitations (documented):
 * - Requires Vercel Pro or higher (≥60 s function timeout).
 * - Chromium runs headless; some banks may detect and block automated access.
 * - The OTP flow is "pre-provided": the user must supply the OTP code before
 *   the scraping session starts (not mid-session).
 */

"use strict";

const { createScraper, SCRAPERS, CompanyTypes } = require("israeli-bank-scrapers");

/**
 * MVP set of supported institution IDs.
 * Extend this list as additional scrapers are validated in production.
 */
const MVP_COMPANY_IDS = [
  "hapoalim",
  "leumi",
  "discount",
  "mizrahi",
  "max",
  "visaCal",
  "isracard",
  "amex",
  "beinleumi",
  "mercantile",
];

/**
 * Return Puppeteer launch options appropriate for the current environment.
 * In production (Vercel) we use @sparticuz/chromium; locally we rely on the
 * bundled Chromium from puppeteer.
 *
 * @returns {Promise<{executablePath?: string, args: string[], headless: boolean}>}
 */
async function getPuppeteerLaunchOptions() {
  if (process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL) {
    // Serverless environment – use sparticuz chromium
    const chromium = require("@sparticuz/chromium");
    return {
      executablePath: await chromium.executablePath(),
      args: [
        ...chromium.args,
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
      headless: chromium.headless,
    };
  }
  // Local development – let puppeteer use its bundled Chromium
  return {
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true,
  };
}

/**
 * Run a full scraping session for the given company and credentials.
 *
 * @param {string} companyId - One of CompanyTypes
 * @param {Record<string, string>} credentials - Login fields (vary by company)
 * @param {Date} startDate - Earliest transaction date to fetch
 * @returns {Promise<import('israeli-bank-scrapers').ScraperScrapingResult>}
 */
async function runScraper(companyId, credentials, startDate) {
  const launchOptions = await getPuppeteerLaunchOptions();

  // If the caller pre-provided an OTP, wire it into the otpCodeRetriever
  // callback so the scraper can answer the OTP challenge immediately.
  const { otp, ...coreCredentials } = credentials;
  const scraperCredentials = {
    ...coreCredentials,
    ...(otp
      ? {
          otpCodeRetriever: async () => otp,
          otpLongTermToken: undefined, // clear any stale token
        }
      : {}),
  };

  const scraper = createScraper({
    companyId,
    startDate,
    ...launchOptions,
    verbose: false,
  });

  return scraper.scrape(scraperCredentials);
}

/**
 * Get metadata for the MVP-supported institutions.
 *
 * @returns {Array<{id: string, name: string, loginFields: string[], type: string}>}
 */
function getSupportedInstitutions() {
  return MVP_COMPANY_IDS.filter((id) => SCRAPERS[id]).map((id) => {
    const meta = SCRAPERS[id];
    const isCreditCard = ["visaCal", "isracard", "amex", "max"].includes(id);
    return {
      id,
      name: meta.name,
      loginFields: meta.loginFields,
      type: isCreditCard ? "creditcard" : "bank",
    };
  });
}

module.exports = { runScraper, getSupportedInstitutions, MVP_COMPANY_IDS };
