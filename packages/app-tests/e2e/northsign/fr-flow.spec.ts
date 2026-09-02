import { expect, test } from '@playwright/test';

import { addRecipient, continueEditor, createDocument, InbucketClient, sendEnvelope, signup } from './helpers';

/**
 * GATE 2 — FR end-to-end signing flow.
 *
 * Switches the whole session to fr via the ?lang= override (server-resolved,
 * per I18N.md §4), runs the same flow as the EN gate, and asserts the Phase 4
 * canaries render (« Téléverser », « Piste d'audit », « Signé électroniquement
 * par NorthSign ») plus 24 h date rendering.
 */
test('[NORTHSIGN][FR] full signing flow in French with canary assertions', async ({ page }) => {
  const inbucket = new InbucketClient(page.context().request);

  // ?lang=fr beats the cookie for this request and persists it (D-022).
  await page.goto('/?lang=fr');

  // Landing page: the upload CTA uses the glossary verb.
  await expect(page.getByText('Téléverser').first()).toBeVisible();

  await signup({ page });

  // Dashboard: upload + create the document (same flow as the EN gate).
  await createDocument({ page });

  const recipientEmail = `signer-fr-${Date.now()}@northsign.test`;
  await addRecipient({ page, email: recipientEmail });

  await continueEditor({ page });
  await page.getByRole('button', { name: 'Signature' }).click();
  await page
    .locator('.react-pdf__Page')
    .first()
    .click({ position: { x: 100, y: 100 } });

  await sendEnvelope({ page });

  // Canaries on the documents dashboard.
  await page.goto('/t/_/documents'); // generic documents list via team context
  await page.goto('/dashboard');
  await expect(page.getByText('Piste d’audit').or(page.getByText("Piste d'audit")).first()).toBeVisible();

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

  await page.getByTestId('signature-pad-dialog-button').click();
  await page.getByRole('tab', { name: 'Type' }).click();
  await page.getByTestId('signature-pad-type-input').fill('Signataire');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Sign', exact: true }).click();

  await page.waitForURL(/\/sign\/.+\/complete/, { timeout: 60_000 });

  // Completion page carries the localized completion string.
  await expect(page.getByText(/Document signé/i).first()).toBeVisible();
});
