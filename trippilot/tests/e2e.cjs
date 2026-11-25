// End-to-end smoke test of the core user flows in demo mode.
// Usage: npm run build && npm start   (in another terminal)
//        npm run test:e2e              (BASE_URL defaults to http://localhost:3000)
// Requires a Chromium for Playwright: npx playwright install chromium
const { chromium } = require('playwright');
const SHOTS = require('path').join(__dirname, 'screenshots') + '/';
require('fs').mkdirSync(SHOTS, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:3000';
let failures = 0;
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/tile|basemaps|unsplash|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  const step = async (name, fn) => { try { await fn(); console.log('PASS', name); } catch (e) { failures++; console.log('FAIL', name, e.message.split('\n')[0]); await page.screenshot({ path: SHOTS + 'fail-' + name.replace(/\W+/g,'_') + '.png' }); } };

  await step('landing', async () => {
    await page.goto(BASE + '/');
    await page.getByRole('heading', { name: /Explore freely/ }).waitFor();
    await page.getByRole('tab', { name: 'Day 2' }).click();
    await page.getByText('Colosseum guided tour').first().waitFor();
    await page.screenshot({ path: SHOTS + 'landing.png' });
  });
  await step('demo dashboard', async () => {
    await page.goto(BASE + '/demo');
    await page.waitForURL('**/app');
    await page.getByText('Roman Holiday').first().waitFor();
    await page.getByText('Demo mode.').waitFor();
    await page.getByText('Lisbon long weekend').first().waitFor();
    await page.screenshot({ path: SHOTS + 'dashboard.png' });
  });
  await step('trip overview', async () => {
    await page.getByRole('link', { name: /Roman Holiday/ }).first().click();
    await page.getByRole('tab', { name: 'Overview' }).waitFor();
    await page.getByText('Important bookings').waitFor();
    await page.screenshot({ path: SHOTS + 'overview.png' });
  });
  await step('itinerary + complete + edit', async () => {
    await page.getByRole('tab', { name: 'Itinerary' }).click();
    await page.getByRole('heading', { name: 'Ancient Rome, unhurried' }).waitFor();
    await page.getByRole('button', { name: 'Mark Colosseum guided tour as done' }).click();
    await page.getByRole('button', { name: 'Mark Colosseum guided tour as not done' }).waitFor();
    await page.getByRole('button', { name: 'Actions for Pantheon by night' }).click();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByLabel('Name').fill('Pantheon by moonlight');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.getByText('Pantheon by moonlight').waitFor();
    await page.getByText('Edited').first().waitFor();
    await page.screenshot({ path: SHOTS + 'itinerary.png' });
  });
  await step('add activity', async () => {
    await page.locator('#day-1').getByRole('button', { name: 'Add activity' }).click();
    await page.getByLabel('Name').fill('Gelato at Giolitti');
    await page.getByLabel('Time').fill('21:30');
    await page.getByRole('dialog').getByRole('button', { name: 'Add activity' }).click();
    await page.locator('#day-1').getByText('Gelato at Giolitti').waitFor();
    await page.locator('#day-1').getByText('Added by you').waitFor();
  });
  await step('regenerate day keeps edits', async () => {
    await page.locator('#day-1').getByRole('button', { name: 'Regenerate day' }).click();
    await page.getByRole('button', { name: 'Something outdoors' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Regenerate', exact: true }).click();
    await page.getByText(/Day 1 re-planned/).waitFor({ timeout: 15000 });
    await page.locator('#day-1').getByText('Gelato at Giolitti').waitFor();
    await page.locator('#day-1').getByText('Pantheon by moonlight').waitFor();
  });
  await step('regenerate activity', async () => {
    await page.getByRole('button', { name: 'Actions for Dinner at Pierluigi' }).click();
    await page.getByRole('button', { name: 'Suggest another restaurant' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Regenerate', exact: true }).click();
    await page.getByText(/Swapped in/).waitFor({ timeout: 15000 });
  });
  await step('map', async () => {
    await page.getByRole('tab', { name: 'Map' }).click();
    await page.locator('.tp-marker').first().waitFor({ timeout: 15000 });
    const n = await page.locator('.tp-marker').count();
    if (n < 10) throw new Error('only ' + n + ' markers');
    await page.getByRole('radio', { name: 'Day 3' }).click();
    await page.getByRole('button', { name: /Vatican Museums/ }).first().click();
    await page.locator('.tp-marker.is-active').waitFor();
    await page.getByRole('button', { name: 'Close details' }).waitFor();
    await page.screenshot({ path: SHOTS + 'map.png' });
  });
  await step('bookings add', async () => {
    await page.getByRole('tab', { name: 'Bookings' }).click();
    await page.getByRole('button', { name: 'Add booking' }).click();
    await page.getByLabel('Type').selectOption('car_rental');
    await page.getByLabel('Name').fill('Tuscany car hire');
    await page.getByLabel('Confirmation number').fill('CAR-123');
    await page.getByLabel('Cost (USD)').fill('240');
    await page.getByRole('button', { name: 'Save booking' }).click();
    await page.getByText('Tuscany car hire').waitFor();
    await page.screenshot({ path: SHOTS + 'bookings.png' });
  });
  await step('budget add expense', async () => {
    await page.getByRole('tab', { name: 'Budget' }).click();
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByLabel('Description').fill('Espresso & cornetti');
    await page.getByLabel('Amount').fill('18.5');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByText('Espresso & cornetti').waitFor();
    await page.screenshot({ path: SHOTS + 'budget.png' });
  });
  await step('concierge budget answer', async () => {
    await page.getByRole('tab', { name: 'Concierge' }).click();
    await page.getByLabel('Message TripPilot').fill('How much have we spent so far?');
    await page.getByRole('button', { name: 'Send' }).click();
    await page.getByText(/Spent so far/).waitFor({ timeout: 10000 });
  });
  await step('concierge proposal + apply', async () => {
    await page.getByLabel('Message TripPilot').fill('Remove the museum on day 5. I want something outdoors.');
    await page.getByRole('button', { name: 'Send' }).click();
    await page.getByRole('button', { name: 'Apply change' }).waitFor({ timeout: 10000 });
    const text = await page.locator('text=/Replace Galleria Borghese \\(Day 5\\) with/').first().textContent();
    console.log('   proposal:', text);
    await page.getByRole('button', { name: 'Apply change' }).click();
    await page.getByText('Applied to itinerary').waitFor();
    await page.screenshot({ path: SHOTS + 'concierge.png' });
    await page.getByRole('tab', { name: 'Itinerary' }).click();
    const has = await page.locator('#day-5').getByText('Galleria Borghese', { exact: true }).count();
    if (has) throw new Error('museum still in day 5');
  });
  await step('persistence after reload', async () => {
    await page.reload();
    await page.getByRole('heading', { name: 'Gardens & Bernini' }).waitFor();
    await page.getByText('Pantheon by moonlight').waitFor();
  });
  await step('create trip from prompt', async () => {
    await page.goto(BASE + '/app/trips/new');
    await page.getByLabel('Describe your trip').fill("Plan 6 days in Italy for a couple. Rome and Florence. Luxury hotels, amazing restaurants, historical places, nightlife, but no packed schedule. Budget $4,000 excluding flights.");
    await page.getByRole('button', { name: 'Fill in the details' }).click();
    await page.getByText(/Filled in/).waitFor();
    const dest = await page.getByLabel('Destination(s)').inputValue();
    const budget = await page.getByLabel('Total budget').inputValue();
    console.log('   parsed:', dest, budget, await page.getByLabel('Trip name').inputValue());
    if (!/Rome/.test(dest) || !/Florence/.test(dest) || budget !== '4000') throw new Error('parse failed');
    await page.screenshot({ path: SHOTS + 'new-trip.png', fullPage: true });
    await page.getByRole('button', { name: /Create trip/ }).click();
    await page.waitForURL(/\/app\/trips\/.+/);
    await page.getByRole('heading', { name: /Arrival in Rome/ }).waitFor({ timeout: 20000 });
    await page.getByRole('heading', { name: /Florence/ }).first().waitFor();
    const days = await page.locator('section[id^="day-"]').count();
    console.log('   days:', days);
    if (days !== 6) throw new Error('expected 6 days, got ' + days);
    await page.screenshot({ path: SHOTS + 'generated.png' });
  });
  await step('settings preferences', async () => {
    await page.goto(BASE + '/app/settings');
    await page.getByRole('button', { name: 'Travel preferences' }).click();
    await page.getByRole('checkbox', { name: 'Beaches' }).click();
    await page.getByRole('button', { name: 'Save preferences' }).click();
    await page.getByText('Preferences saved').waitFor();
  });
  await step('mobile views', async () => {
    const m = await browser.newContext({ ...require('playwright').devices['iPhone 14'] });
    await m.addCookies([{ name: 'tp_demo', value: '1', url: BASE }]);
    const mp = await m.newPage();
    mp.on('pageerror', (e) => errors.push('MOBILE ' + e.message));
    // copy local storage state
    const state = await page.evaluate(() => localStorage.getItem('trippilot:demo:v1'));
    await mp.goto(BASE + '/');
    await mp.screenshot({ path: SHOTS + 'm-landing.png' });
    await mp.evaluate((s) => localStorage.setItem('trippilot:demo:v1', s), state);
    await mp.goto(BASE + '/app');
    await mp.getByText('Roman Holiday').first().waitFor();
    await mp.screenshot({ path: SHOTS + 'm-dashboard.png' });
    await mp.getByRole('link', { name: /Roman Holiday/ }).first().click();
    await mp.getByRole('tab', { name: 'Itinerary' }).click();
    await mp.getByRole('heading', { name: 'Ancient Rome, unhurried' }).waitFor();
    await mp.screenshot({ path: SHOTS + 'm-itinerary.png' });
    await mp.locator('#day-2').scrollIntoViewIfNeeded();
    await mp.screenshot({ path: SHOTS + 'm-itinerary-day2.png' });
    await mp.getByRole('tab', { name: 'Concierge' }).click();
    await mp.waitForTimeout(500);
    await mp.screenshot({ path: SHOTS + 'm-concierge.png' });
    const overflow = await mp.evaluate(() => {
      const w = window.innerWidth;
      const bad = [...document.querySelectorAll('main section, main .card')].filter((el) => el.getBoundingClientRect().right > w + 1 && !el.closest('.no-scrollbar'));
      return document.documentElement.scrollWidth > w + 1 || bad.length > 0;
    });
    await mp.getByRole('tab', { name: 'Itinerary' }).click();
    const overflow2 = await mp.evaluate(() => [...document.querySelectorAll('section[id^=day-]')].some((el) => el.getBoundingClientRect().right > window.innerWidth + 1));
    if (overflow2) throw new Error('day cards overflow on mobile');
    if (overflow) throw new Error('horizontal overflow on mobile');
    await m.close();
  });
  console.log('CONSOLE ERRORS:', errors.length ? errors : 'none');
  await browser.close();
  if (failures || errors.length) process.exit(1);
})();
