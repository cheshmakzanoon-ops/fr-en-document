import path from 'node:path';
import type { APIRequestContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';

const FIXTURE_PDF = path.join(__dirname, 'fixtures/tiny.pdf');

export const TEST_PASSWORD = 'Test-Passw0rd-Long-Enough!';

/**
 * Sign up a brand-new user through the real /signup UI (no seed script).
 *
 * Returns the email used, so tests can assert against Inbucket mailboxes.
 * The account is deliberately left email-unverified: the Phase 5.5 gates
 * assert behaviour for a fresh signup exactly as a new user experiences it
 * (unverified accounts can still use the app — there is only a banner).
 */
export const signup = async ({ page }: { page: Page }): Promise<string> => {
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 10_000)}@northsign.test`;

  await page.goto('/signup');

  await page.getByLabel('Full Name').fill('NorthSign E2E');
  await page.getByLabel('Email Address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD);

  // Signature pad: draw via the "type" tab and save.
  await page.getByTestId('signature-pad-dialog-button').click();
  await page.getByRole('tab', { name: 'Type' }).click();
  await page.getByTestId('signature-pad-type-input').fill('NorthSign E2E');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await page.getByRole('checkbox').first().check(); // acceptTerms (ToS/Privacy)
  // marketingOptIn intentionally left unchecked — asserted in the consent test.

  await page.getByRole('button', { name: 'Create account' }).click();

  // Successful signup lands on /unverified-account (email-confirmation page).
  await expect(page).toHaveURL(/\/unverified-account/);

  return email;
};

/**
 * Sign in as an existing (verified or unverified) user through the API +
 * session cookie, matching the upstream app-tests fixture approach.
 */
export const signin = async ({ page, email }: { page: Page; email: string }): Promise<void> => {
  // The auth stack is better-auth-based in this fork; sign in through the UI
  // so the session cookie is minted exactly like a real browser session.
  await page.goto('/signin');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/dashboard|\/t\//, { timeout: 30_000 });
};

/**
 * Create (upload) a new document from the tiny 1-page PDF fixture and land on
 * the envelope editor. Assumes the caller is signed in and on any page.
 */
export const createDocument = async ({ page }: { page: Page }): Promise<string> => {
  await page.goto('/dashboard');

  // Trigger the file input behind the upload dropzone.
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page
      .locator('input[type=file]')
      .first()
      .evaluate((element) => {
        if (element instanceof HTMLInputElement) {
          element.click();
        }
      }),
  ]);

  await fileChooser.setFiles(FIXTURE_PDF);

  // Redirect to the envelope editor: /t/{teamUrl}/documents/envelope_*
  await page.waitForURL(/\/documents\/envelope_/, { timeout: 30_000 });

  const url = page.url();
  const envelopeId = url.split('/').pop() ?? '';

  return envelopeId;
};

export type AddRecipientOptions = {
  page: Page;
  email: string;
  name?: string;
};

/**
 * In the envelope editor, add a signer through Step 2 (Add Signers) of the
 * envelope flow. Leaves the editor on the recipients step.
 */
export const addRecipient = async ({ page, email, name = 'Recipient' }: AddRecipientOptions): Promise<void> => {
  // Step 1 (General) → Continue
  const continueButton = page.getByRole('button', { name: 'Continue' });

  await expect(continueButton).toBeVisible();

  await continueButton.click();

  // Step 2 (Add Signers): fill the first recipient row.
  await page.getByPlaceholder('Email').first().fill(email);
  await page.getByPlaceholder('Name').first().fill(name);

  // Do NOT press Continue here: the recipient-locale test needs to set the
  // language picker first. Callers proceed with `continueEditor`.
};

/**
 * Press "Continue" in the envelope editor (from recipients to fields step).
 */
export const continueEditor = async ({ page }: { page: Page }): Promise<void> => {
  await page.getByRole('button', { name: 'Continue' }).click();
};

/**
 * Place a signature field near the top-left of the first PDF page (fields
 * step). The active recipient is whichever the editor currently targets.
 */
export const addSignatureField = async ({ page }: { page: Page }): Promise<void> => {
  await page.getByRole('button', { name: 'Signature' }).click();
  await page
    .locator('[data-testid="pdf-editor-page-1"], .pdf-editor-page')
    .first()
    .click({
      position: { x: 100, y: 100 },
    });
};

/**
 * Send the envelope (Distribute step) and wait for the redirect back to the
 * documents list.
 */
export const sendEnvelope = async ({ page }: { page: Page }): Promise<void> => {
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.waitForTimeout(2500); // Distribution step mounts async.

  await page.getByRole('button', { name: 'Send', exact: true }).click();

  await page.waitForURL(/\/documents/, { timeout: 30_000 });
};

/**
 * Inbucket REST client — the mail-catcher container's HTTP API.
 *
 * CI runs Inbucket on localhost:9000 (SMTP on :2500). Nothing leaves the
 * machine; this is how tests "receive" email without any real mail provider.
 */
export class InbucketClient {
  private readonly baseUrl: string;
  private readonly request: APIRequestContext;

  constructor(request: APIRequestContext, baseUrl = 'http://localhost:9000') {
    this.request = request;
    this.baseUrl = baseUrl;
  }

  /** List messages for a mailbox (the local-part of the email address). */
  async listMessages(localPart: string): Promise<Array<{ id: string; subject: string; from: string; to: string[] }>> {
    const response = await this.request.get(`${this.baseUrl}/api/v1/mailbox/${localPart}`);

    if (response.status() === 404) {
      return [];
    }

    expect(response.ok()).toBeTruthy();

    return (await response.json()) as Array<{ id: string; subject: string; from: string; to: string[] }>;
  }

  /** Fetch a single message and return its text body. */
  async getMessageBody(localPart: string, messageId: string): Promise<string> {
    const response = await this.request.get(`${this.baseUrl}/api/v1/mailbox/${localPart}/${messageId}`);

    expect(response.ok()).toBeTruthy();

    const message = (await response.json()) as { body?: { text?: string }; text?: string };

    return message.body?.text ?? message.text ?? '';
  }

  /** Wait until a message matching `predicate` arrives (or timeout). */
  async waitForMessage(
    localPart: string,
    predicate: (message: { id: string; subject: string; from: string; to: string[] }) => boolean,
    timeoutMs = 30_000,
  ): Promise<{ id: string; subject: string; from: string; to: string[] }> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const messages = await this.listMessages(localPart);
      const match = messages.find(predicate);

      if (match) {
        return match;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const messages = await this.listMessages(localPart);

    throw new Error(
      `No matching message in mailbox "${localPart}" within ${timeoutMs}ms. ` +
        `Mailbox contents: ${JSON.stringify(messages.map((m) => m.subject))}`,
    );
  }

  /** Extract the first /sign/{token} link from a message body. */
  async extractSigningLink(localPart: string, messageId: string): Promise<string> {
    const body = await this.getMessageBody(localPart, messageId);

    const match = /https?:\/\/[^\s"'<>]+\/sign\/[A-Za-z0-9_-]+/.exec(body);

    if (!match) {
      throw new Error(`No signing link found in message ${messageId} for ${localPart}`);
    }

    return match[0];
  }
}
