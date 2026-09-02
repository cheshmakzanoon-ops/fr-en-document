import { prisma } from '@documenso/prisma';
import { expect, test } from '@playwright/test';

import { addRecipient, continueEditor, createDocument, InbucketClient, sendEnvelope, signup } from './helpers';

/**
 * GATE 1 — EN end-to-end signing flow.
 *
 * signup → upload → recipient → send → open signing link from Inbucket →
 * sign → download; asserts completed status + completion email.
 */
test('[NORTHSIGN][EN] full signing flow: signup → send → sign → complete', async ({ page }) => {
  const inbucket = new InbucketClient(page.context().request);

  const ownerEmail = await signup({ page });

  // Upload a document and land in the envelope editor.
  await createDocument({ page });

  // Recipient: a fresh address so we can read its Inbucket mailbox.
  const recipientEmail = `signer-${Date.now()}@northsign.test`;
  await addRecipient({ page, email: recipientEmail });

  // Fields step: place a signature field for the recipient.
  await continueEditor({ page });
  await page.getByRole('button', { name: 'Signature' }).click();
  await page
    .locator('.react-pdf__Page')
    .first()
    .click({ position: { x: 100, y: 100 } });

  // Distribute step: send.
  await sendEnvelope({ page });

  // The recipient receives the signing invitation.
  const recipientLocalPart = recipientEmail.split('@')[0];
  const invite = await inbucket.waitForMessage(recipientLocalPart, (message) =>
    message.subject.toLowerCase().includes('sign'),
  );

  const signingUrl = await inbucket.extractSigningLink(recipientLocalPart, invite.id);

  // Recipient opens the signing link and signs.
  await page.goto(signingUrl);

  await page.getByTestId('signature-pad-dialog-button').click();
  await page.getByRole('tab', { name: 'Type' }).click();
  await page.getByTestId('signature-pad-type-input').fill('Recipient Signature');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Sign', exact: true }).click();

  // Signing completes and the recipient lands on the completion page.
  await page.waitForURL(/\/sign\/.+\/complete/, { timeout: 60_000 });
  await expect(page.getByText('Document Signed')).toBeVisible();

  // The envelope reaches COMPLETED status (sealed async → poll).
  await expect(async () => {
    const envelope = await prisma.envelope.findFirstOrThrow({
      where: { recipients: { some: { email: recipientEmail } } },
    });

    expect(envelope.status).toBe('COMPLETED');
  }).toPass({ timeout: 30_000 });

  // Owner receives the completion notification.
  const ownerLocalPart = ownerEmail.split('@')[0];
  const completion = await inbucket.waitForMessage(
    ownerLocalPart,
    (message) =>
      message.subject.toLowerCase().includes('completed') || message.subject.toLowerCase().includes('signed'),
    45_000,
  );

  expect(completion.subject.length).toBeGreaterThan(0);
});
