import { prisma } from '@documenso/prisma';
import { expect, test } from '@playwright/test';

import {
  addRecipient,
  addSignatureField,
  continueEditor,
  createDocument,
  sendEnvelope,
  signup,
  TEST_PASSWORD,
} from './helpers';

/**
 * Phase 6 Step 6 — billing E2E on the MOCK provider (BILLING_PROVIDER=mock,
 * the CI default; zero secrets, zero network).
 *
 * Covers the three standing billing gates:
 *   1. Free Starter user hits the 3-doc/month limit → blocked send + limit
 *      toast/banner + upgrade CTA to /pricing.
 *   2. Mock-Pro user (checkout through the mock route) sends without limits.
 *   3. /pricing renders the three tiers in EN and fr-CA.
 */

const FREE_DOCS_PER_PERIOD = 3;

const upgradeOrganisationViaMockCheckout = async (
  page: import('@playwright/test').Page,
  ownerEmail: string,
): Promise<void> => {
  // Look the org up by owner — this session's user owns exactly one.
  const organisation = await prisma.organisation.findFirstOrThrow({
    where: { owner: { email: ownerEmail } },
    select: { id: true },
  });

  // Drive the real mock-checkout round-trip (same grant path the checkout
  // mutation uses under BILLING_PROVIDER=mock): the route validates the
  // session, writes the subscription row and redirects back.
  await page.goto(
    `/api/billing/mock/checkout?org=${organisation.id}&plan=PRO&interval=monthly&return=${encodeURIComponent('/settings/billing')}`,
  );

  await expect(page).toHaveURL(/\/settings\/billing/, { timeout: 30_000 });
};

test.describe('[NORTHSIGN][BILLING] mock provider', () => {
  test('pricing page renders the three tiers in EN and fr-CA', async ({ page }) => {
    // EN.
    await page.goto('/pricing');

    await expect(page.getByRole('heading', { name: /simple, transparent pricing/i })).toBeVisible();

    for (const tier of ['Starter', 'Pro', 'Business']) {
      await expect(page.getByRole('heading', { name: tier, exact: true })).toBeVisible();
    }

    // CAD prices + tax-at-checkout note (en-CA formatting: "$19"). The page
    // defaults to MONTHLY billing, so the annual price only appears on the
    // Pro/Business cards' comparison table — assert it after the toggle.
    await expect(page.getByText('$19', { exact: false }).first()).toBeVisible();
    await expect(page.getByText(/taxes are calculated at checkout/i)).toBeVisible();

    // Comparison table exists with the per-recipient-locale row (always free).
    await expect(page.getByText(/per-recipient locale/i)).toBeVisible();

    // Annual toggle switches the displayed price to the yearly CAD amount.
    await page.getByRole('button', { name: /annual/i }).click();
    await expect(page.getByText('$190', { exact: false }).first()).toBeVisible();

    // fr-CA.
    await page.goto('/pricing?lang=fr');

    await expect(page.getByRole('heading', { name: /tarification simple et transparente/i })).toBeVisible();

    // fr-CA currency formatting: "19 $CA" — Intl uses a NO-BREAK space
    // between number and symbol, so match any whitespace there.
    await expect(page.getByText(/19\s\$|190\s\$/).first()).toBeVisible();
    await expect(page.getByText(/calculées au moment du paiement/i)).toBeVisible();
  });

  test('free Starter user sends 3 documents, then hits the limit with an upgrade CTA', async ({ page }) => {
    const email = await signup({ page });

    let documentsUrl = '';

    // Send the free allowance: 3 documents with 1 recipient each.
    for (let index = 0; index < FREE_DOCS_PER_PERIOD; index += 1) {
      await createDocument({ page });

      await addRecipient({ page, email: `free-recipient-${index}-${Date.now()}@northsign.test` });

      await continueEditor({ page });
      await addSignatureField({ page });

      await sendEnvelope({ page });

      documentsUrl = page.url();
    }

    // The 4th send must be blocked by the plan gate.
    await createDocument({ page });

    await addRecipient({ page, email: `blocked-recipient-${Date.now()}@northsign.test` });

    await continueEditor({ page });
    await addSignatureField({ page });

    await page
      .getByRole('button', { name: /send document/i })
      .first()
      .click();

    const sendButton = page.getByRole('button', { name: /^send$/i });

    await expect(sendButton).toBeVisible({ timeout: 15_000 });
    await sendButton.click();

    // Limit toast (EN copy from toast-error-messages.ts) — the DRAFT stays
    // and the user is pointed at the upgrade path.
    await expect(page.getByText(/monthly sending limit reached/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/upgrade to pro/i).first()).toBeVisible();

    // The usage banner shows on team-scoped pages (the current organisation
    // comes from the URL); / redirects to /inbox, which has no org context.
    await page.goto(documentsUrl);

    await expect(page.getByText(/used all 3 free documents/i)).toBeVisible({ timeout: 15_000 });

    // The banner's upgrade CTA leads to /pricing.
    await expect(page.getByRole('link', { name: /upgrade to send more/i })).toBeVisible();

    // Sanity: the server-side usage journal recorded exactly the allowance.
    const sentCount = await prisma.billingUsageEvent.count({
      where: { organisation: { owner: { email } } },
    });

    expect(sentCount).toBe(FREE_DOCS_PER_PERIOD);
  });

  test('mock-Pro user upgrades through checkout and sends beyond the free limit', async ({ page }) => {
    const email = await signup({ page });

    // Upgrade before sending anything.
    await upgradeOrganisationViaMockCheckout(page, email);

    // The billing page reflects the granted plan (Pro plan badge + Active
    // status on the organisation card).
    await expect(page.getByText('Pro', { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Active', { exact: true })).toBeVisible();

    let documentsUrl = '';

    // Send more documents than the free allowance allows.
    for (let index = 0; index < FREE_DOCS_PER_PERIOD + 1; index += 1) {
      await createDocument({ page });

      await addRecipient({ page, email: `pro-recipient-${index}-${Date.now()}@northsign.test` });

      await continueEditor({ page });
      await addSignatureField({ page });

      await sendEnvelope({ page });

      documentsUrl = page.url();
    }

    // No limit toast, no usage banner on a paid plan (team-scoped page).
    await page.goto(documentsUrl);

    await expect(page.getByText(/free documents/i)).toHaveCount(0);

    const sentCount = await prisma.billingUsageEvent.count({
      where: { organisation: { owner: { email } } },
    });

    expect(sentCount).toBe(FREE_DOCS_PER_PERIOD + 1);
  });

  test('signing back in on a fresh session keeps the granted plan (row persisted)', async ({ page }) => {
    const email = await signup({ page });

    await upgradeOrganisationViaMockCheckout(page, email);

    // Same dashboard surface as test 2: the Pro badge + Active status prove
    // the grant landed ("Unlimited documents" only renders on paid plans
    // with no set period, which the mock monthly grant does not produce).
    await expect(page.getByText('Pro', { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Active', { exact: true })).toBeVisible();

    // Sign back in on a fresh browser context to prove the subscription row
    // persists beyond any one session.
    const browser = page.context().browser();

    if (!browser) {
      test.skip();
      return;
    }

    const newContext = await browser.newContext({ viewport: { width: 1920, height: 1200 } });
    const newPage = await newContext.newPage();

    await newPage.goto('/signin');
    await newPage
      .getByLabel(/^email$/i)
      .first()
      .fill(email);
    await newPage.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD);
    await newPage.getByRole('button', { name: /sign in/i }).click();

    await expect(newPage).toHaveURL(/\/t\/|\/documents/, { timeout: 30_000 });

    await newPage.goto('/settings/billing');

    await expect(newPage.getByText('Pro', { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(newPage.getByText('Active', { exact: true })).toBeVisible();

    await newContext.close();
  });
});
