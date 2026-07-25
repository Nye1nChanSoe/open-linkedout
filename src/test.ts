import { chromium } from "playwright";

const context = await chromium.launchPersistentContext("./data/browser-data", {
  headless: false,
  viewport: null,
});

const page = context.pages()[0] ?? (await context.newPage());

await page.bringToFront();

await page.goto("https://www.closetplus.co/discover", {
  waitUntil: "domcontentloaded",
});

const footer = page.locator("footer");

await footer.waitFor({
  state: "attached",
  timeout: 30_000,
});

const viewport = await page.evaluate(() => ({
  width: window.innerWidth,
  height: window.innerHeight,
}));

// Move the mouse over the main page area so wheel events affect the page.
await page.mouse.move(viewport.width / 2, viewport.height / 2);

let previousScrollY = -1;
let stuckAttempts = 0;
let scrollCount = 0;

while (true) {
  const footerInViewport = await footer.evaluate((element) => {
    const rect = element.getBoundingClientRect();

    return rect.top < window.innerHeight && rect.bottom > 0;
  });

  if (footerInViewport) {
    console.log("Reached footer!");
    break;
  }

  // Occasionally move the mouse slightly.
  if (Math.random() < 0.3) {
    const targetX =
      viewport.width / 2 + (Math.random() - 0.5) * viewport.width * 0.3;

    const targetY =
      viewport.height / 2 + (Math.random() - 0.5) * viewport.height * 0.25;

    await page.mouse.move(targetX, targetY, {
      steps: 4 + Math.floor(Math.random() * 7),
    });
  }

  // Scroll down using several small wheel ticks.
  const downwardTicks = 2 + Math.floor(Math.random() * 5);

  for (let index = 0; index < downwardTicks; index++) {
    const deltaY = 50 + Math.floor(Math.random() * 100);

    await page.mouse.wheel(0, deltaY);
    await page.waitForTimeout(20 + Math.random() * 60);
  }

  scrollCount++;

  // Normal pause between scrolling bursts.
  await page.waitForTimeout(150 + Math.random() * 450);

  // Occasionally pause longer, like someone reading.
  if (Math.random() < 0.18) {
    await page.waitForTimeout(700 + Math.random() * 1_800);
  }

  // Occasionally scroll slightly upward.
  if (Math.random() < 0.22) {
    const upwardTicks = 1 + Math.floor(Math.random() * 3);

    for (let index = 0; index < upwardTicks; index++) {
      const deltaY = -(30 + Math.floor(Math.random() * 70));

      await page.mouse.wheel(0, deltaY);
      await page.waitForTimeout(30 + Math.random() * 80);
    }

    await page.waitForTimeout(150 + Math.random() * 400);

    // Resume scrolling downward after the correction.
    const recoveryTicks = 1 + Math.floor(Math.random() * 3);

    for (let index = 0; index < recoveryTicks; index++) {
      const deltaY = 60 + Math.floor(Math.random() * 90);

      await page.mouse.wheel(0, deltaY);
      await page.waitForTimeout(25 + Math.random() * 70);
    }
  }

  const currentScrollY = await page.evaluate(() => window.scrollY);

  console.log({
    scrollCount,
    scrollY: currentScrollY,
  });

  if (currentScrollY === previousScrollY) {
    stuckAttempts++;
  } else {
    stuckAttempts = 0;
  }

  previousScrollY = currentScrollY;

  // Prevent an infinite loop if scrolling stops working.
  if (stuckAttempts >= 12) {
    console.log("Scrolling appears to be stuck.");
    break;
  }
}

console.log("Finished scrolling.");

// Keep the browser open.
// Remove this line and call context.close() when you want it to close.
await page.waitForTimeout(60_000);
