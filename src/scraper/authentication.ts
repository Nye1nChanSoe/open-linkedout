import pc from "picocolors";
import type { Page } from "playwright";
import { ApplicationError } from "@/app/errors/application-error.js";
import domEventConfig from "@/config/dom-event.config.js";
import scraperConfig from "@/config/scraper.config.js";

const AUTHENTICATION_PATHS = ["/login", "/checkpoint", "/authwall"];

/**
 * Waits for manual LinkedIn authentication when the active page requires it.
 * @param page - Active LinkedIn Playwright page.
 */
export async function assertAuthenticated(page: Page): Promise<void> {
  if (!isAuthenticationRequired(page.url())) {
    const redirectedToAuthentication = await page
      .waitForURL((url) => isAuthenticationRequired(url.toString()), {
        waitUntil: domEventConfig.EVENT_COMMIT_PW,
        timeout: scraperConfig.AUTH_REDIRECT_GRACE_MS,
      })
      .then(() => true)
      .catch(() => false);

    if (!redirectedToAuthentication) {
      return;
    }
  }

  if (scraperConfig.IS_HEADLESS) {
    throw new ApplicationError(
      "Manual LinkedIn authentication requires headless: false.",
      "AUTHENTICATION_ERROR",
      false,
    );
  }

  console.warn(
    pc.yellow(
      "\nLinkedIn authentication required.\n" +
        "Enter your credentials in the opened browser window.\n" +
        "Waiting for sign-in to complete...\n",
    ),
  );

  try {
    await page.waitForURL((url) => !isAuthenticationRequired(url.toString()), {
      waitUntil: domEventConfig.EVENT_DOMCONTENTLOADED,
      timeout: scraperConfig.MANUAL_AUTH_TIMEOUT_MS,
    });
  } catch (error) {
    throw new ApplicationError(
      "LinkedIn authentication did not complete in time.",
      "AUTHENTICATION_ERROR",
      false,
      error,
    );
  }

  console.info(pc.green("LinkedIn authentication completed. Continuing scraper."));
}

/**
 * Checks whether a LinkedIn URL requires the user to authenticate.
 * @param url - LinkedIn URL to inspect.
 */
function isAuthenticationRequired(url: string): boolean {
  return AUTHENTICATION_PATHS.some((path) => url.includes(path));
}
