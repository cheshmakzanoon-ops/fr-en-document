import { prisma } from '@documenso/prisma';
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
 * GATE 1 — EN end-to-end signing flow.
 *
 * signup → email verification → upload → recipient → fields → send →
 * signing link extracted from Inbucket → sign → complete; asserts completed
 * status + completion email.
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
  await addSignatureField({ page });

  // Distribute step: send through the distribute dialog.
  await sendEnvelope({ page });

  // The recipient receives the signing invitation.
  const recipientLocalPart = recipientEmail.split('@')[0];
  const invite = await inbucket.waitForMessage(recipientLocalPart, (message) =>
    message.subject.toLowerCase().includes('sign'),
  );

  const signingUrl = await inbucket.extractSigningLink(recipientLocalPart, invite.id);

  // Recipient opens the signing link and signs.
  await page.goto(signingUrl);

  await completeSigning({ page });

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
