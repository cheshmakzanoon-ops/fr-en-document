import { prisma } from '@documenso/prisma';
import { expect, test } from '@playwright/test';

import { addRecipient, continueEditor, createDocument, InbucketClient, sendEnvelope, signin, signup } from './helpers';

/**
 * GATE 3 — Recipient-locale email regression.
 *
 * Regression test for the getEmailContext bug fixed in Phase 5 Step 6
 * (D-024/D-027): document language = en, recipient.language = fr → the
 * RECIPIENT's invitation email must be French while the OWNER-facing emails
 * stay English. This must never come back.
 */
test('[NORTHSIGN][I18N] recipient email follows recipient.language, owner email follows document language', async ({
  page,
}) => {
  const inbucket = new InbucketClient(page.context().request);

  const ownerEmail = await signup({ page });

  await createDocument({ page });

  const recipientEmail = `signer-frpref-${Date.now()}@northsign.test`;

  await addRecipient({ page, email: recipientEmail });

  // Set the recipient's language to Français via the per-recipient picker
  // added in Phase 5 Step 6, while the document language stays English.
  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: /Français/i }).click();

  await continueEditor({ page });
  await page.getByRole('button', { name: 'Signature' }).click();
  await page
    .locator('.react-pdf__Page')
    .first()
    .click({ position: { x: 100, y: 100 } });

  await sendEnvelope({ page });

  // DB-level precondition: the recipient row really carries language='fr'
  // and the document meta carries language='en'.
  const recipient = await prisma.recipient.findFirstOrThrow({
    where: { email: recipientEmail },
  });

  expect(recipient.language).toBe('fr');

  const envelope = await prisma.envelope.findFirstOrThrow({
    where: { id: recipient.envelopeId },
    include: { documentMeta: true },
  });

  expect(envelope.documentMeta.language).toBe('en');

  // The recipient's invitation email is FRENCH.
  const recipientLocalPart = recipientEmail.split('@')[0];
  const invite = await inbucket.waitForMessage(recipientLocalPart, () => true);

  const recipientBody = await inbucket.getMessageBody(recipientLocalPart, invite.id);

  expect(recipientBody).toMatch(/[éèêàç]/);
  expect(recipientBody).toMatch(/signer|document/i);

  // The owner's copy (sent to the owner's own mailbox) is ENGLISH.
  const ownerLocalPart = ownerEmail.split('@')[0];
  const ownerInvite = await inbucket.waitForMessage(ownerLocalPart, () => true);

  const ownerBody = await inbucket.getMessageBody(ownerLocalPart, ownerInvite.id);

  // No accented French body text in the English owner email.
  expect(ownerBody).not.toMatch(/[éèêàç]/);
});

/**
 * GATE 4a — Consent capture: signup records ToS/Privacy version + timestamp
 * with the marketing checkbox unchecked by default (asserted via direct DB
 * query where the UI cannot show it).
 */
test('[NORTHSIGN][CONSENT] signup records consent rows; marketing opt-in unchecked by default', async ({ page }) => {
  const email = await signup({ page });

  const user = await prisma.user.findFirstOrThrow({
    where: { email },
  });

  const consents = await prisma.userConsentRecord.findMany({
    where: { userId: user.id },
  });

  const terms = consents.find((consent) => consent.type === 'TERMS_AND_PRIVACY');
  const marketing = consents.find((consent) => consent.type === 'MARKETING_EMAIL');

  // ToS/Privacy acceptance captured with version + timestamp.
  expect(terms).toBeDefined();
  expect(terms?.documentVersion).toBeTruthy();
  expect(terms?.acceptedAt).toBeInstanceOf(Date);
  expect(terms?.source).toBe('signup');

  // Marketing opt-in unchecked → NO marketing consent row.
  expect(marketing).toBeUndefined();
});

/**
 * GATE 4b — Data export produces a downloadable JSON archive.
 */
test('[NORTHSIGN][PRIVACY] data export downloads a JSON archive', async ({ page }) => {
  const email = await signup({ page });

  await signin({ page, email });

  await page.goto('/settings/profile');

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    page
      .getByRole('button', { name: /export/i })
      .first()
      .click(),
  ]);

  const path = await download.path();

  expect(path).toBeTruthy();

  const suggested = download.suggestedFilename();

  expect(suggested).toMatch(/northsign-data-export/);
  expect(suggested).toMatch(/\.json$/);
});

/**
 * GATE 4c — Deleting an account with a co-signed document orphans the
 * document (still accessible to the co-signer) rather than destroying it
 * (D-026).
 */
test('[NORTHSIGN][PRIVACY] account deletion orphans completed documents instead of destroying them', async ({
  page,
}) => {
  const inbucket = new InbucketClient(page.context().request);

  // Owner signs up, sends a document to a co-signer, co-signer signs it.
  const ownerEmail = await signup({ page });

  await createDocument({ page });

  const recipientEmail = `cosigner-${Date.now()}@northsign.test`;

  await addRecipient({ page, email: recipientEmail });

  await continueEditor({ page });
  await page.getByRole('button', { name: 'Signature' }).click();
  await page
    .locator('.react-pdf__Page')
    .first()
    .click({ position: { x: 100, y: 100 } });

  await sendEnvelope({ page });

  const recipientLocalPart = recipientEmail.split('@')[0];
  const invite = await inbucket.waitForMessage(recipientLocalPart, () => true);
  const signingUrl = await inbucket.extractSigningLink(recipientLocalPart, invite.id);

  await page.goto(signingUrl);

  await page.getByTestId('signature-pad-dialog-button').click();
  await page.getByRole('tab', { name: 'Type' }).click();
  await page.getByTestId('signature-pad-type-input').fill('Co-Signer');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Sign', exact: true }).click();

  await page.waitForURL(/\/sign\/.+\/complete/, { timeout: 60_000 });

  const envelopeBefore = await prisma.envelope.findFirstOrThrow({
    where: { recipients: { some: { email: recipientEmail } } },
  });

  expect(envelopeBefore.status).toBe('COMPLETED');

  // Owner deletes their account (Settings → Profile → Delete account).
  await signin({ page, email: ownerEmail });

  await page.goto('/settings/profile');

  await page
    .getByRole('button', { name: /delete/i })
    .first()
    .click();

  // Confirmation dialog requires the word DELETE.
  await page.getByPlaceholder(/DELETE/i).fill('DELETE');
  await page
    .getByRole('button', { name: /delete/i })
    .last()
    .click();

  await page.waitForURL(/signin|dashboard/, { timeout: 60_000 });

  // The user row is gone...
  const deletedUser = await prisma.user.findFirst({
    where: { email: ownerEmail },
  });

  expect(deletedUser).toBeNull();

  // ...but the completed envelope SURVIVES (orphaned to the service account),
  // still linked to the co-signer's email.
  const envelopeAfter = await prisma.envelope.findFirst({
    where: { id: envelopeBefore.id },
    include: { recipients: true },
  });

  expect(envelopeAfter).not.toBeNull();
  expect(envelopeAfter?.status).toBe('COMPLETED');
  expect(envelopeAfter?.recipients.some((recipient) => recipient.email === recipientEmail)).toBe(true);
});
