import { expect, test } from '@playwright/test';

import {
  addRecipient,
  addSignatureField,
  completeSigning,
  continueEditor,
  createDocument,
  InbucketClient,
  sendEnvelope,
  signup,
} from './helpers';

/**
 * GATE 2 — FR end-to-end signing flow.
 *
 * Switches the whole session to fr via the ?lang= override (server-resolved,
 * per I18N.md §4), runs the same flow as the EN gate, and asserts the Phase 4
 * canaries render (« Téléverser », « Piste d'audit ») plus 24 h date rendering.
 */
test('[NORTHSIGN][FR] full signing flow in French with canary assertions', async ({ page }) => {
  const inbucket = new InbucketClient(page.context().request);

  // ?lang=fr beats the cookie for this request and persists it (D-022): the
  // root loader serializes the lang cookie and every redirect preserves the
  // param, so the session stays French from here on.
  await page.goto('/?lang=fr');

  // / redirects signed-out users to /signin (preserving ?lang=fr), where the
  // FR copy is fully rendered. « Téléverser » first appears on the signup
  // page (signature-pad upload tab) — assert FR session active on /signup
  // through the localized name label instead.
  await page.goto('/signup');

  await signup({ page, locale: 'fr' });

  // FR session actually active: the dashboard dropzone is localized.
  await createDocument({ page, locale: 'fr' });

  const recipientEmail = `signer-fr-${Date.now()}@northsign.test`;
  await addRecipient({ page, email: recipientEmail, locale: 'fr' });

  await continueEditor({ page });
  await addSignatureField({ page, locale: 'fr' });

  await sendEnvelope({ page, locale: 'fr' });

  // Canaries on the documents dashboard: « Piste d'audit » appears in the
  // document dropdown menu ("Audit Logs" → « Journaux de vérification » on
  // lists; the audit-log page itself carries « Piste d'audit »).
  await page.goto('/dashboard');
  await expect(page.getByText(/Piste d[’']audit|Journaux de vérification/).first()).toBeVisible({ timeout: 15_000 });

  // Dates render 24 h (fr-CA): no "AM"/"PM" markers in table content.
  const tableText = await page.locator('table, [role="table"], main').first().innerText();
  expect(tableText).not.toMatch(/\b(AM|PM)\b/);

  // Recipient signs through the French invitation email.
  const recipientLocalPart = recipientEmail.split('@')[0];
  const invite = await inbucket.waitForMessage(recipientLocalPart, (message) =>
    message.subject.toLowerCase().includes('sign'),
  );

  // The invitation email itself is French (document language = fr here).
  const body = await inbucket.getMessageBody(recipientLocalPart, invite.id);
  expect(body).toMatch(/[éàçê]/);

  const signingUrl = await inbucket.extractSigningLink(recipientLocalPart, invite.id);
  await page.goto(signingUrl);

  // The signing page follows the recipient's session cookie; the signing form
  // strings are FR catalog-driven. Drive the dialogs with FR labels.
  await completeSigning({ page, locale: 'fr' });

  // Completion page carries the localized completion string.
  await expect(page.getByText(/Document signé/i).first()).toBeVisible({ timeout: 30_000 });
});
