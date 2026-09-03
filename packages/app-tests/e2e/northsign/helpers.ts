import path from 'node:path';

import type { APIRequestContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';

const FIXTURE_PDF = path.join(__dirname, 'fixtures/tiny.pdf');

export const TEST_PASSWORD = 'Test-Passw0rd-Long-Enough!';

export type TestLocale = 'en' | 'fr';

/**
 * UI labels per locale, verified against the Lingui catalogs
 * (packages/lib/translations/{en,fr}/web.po). The suite signs up and drives
 * the editor in whichever locale the session cookie carries, so the helpers
 * must know both label sets.
 */
const LABELS: Record<
  TestLocale,
  {
    fullName: string;
    emailAddress: string;
    /** Sign-in form email label ("Email" / "courriel") — differs from signup. */
    signinEmail: RegExp;
    password: string;
    typeTab: string;
    next: string;
    createAccount: string;
    signIn: string;
    emailConfirmed: RegExp;
    recipientPlaceholder: RegExp;
    sendDocument: string;
    send: string;
    uploadDocument: string;
    signature: string;
    emailConfirmedShort: string;
    /** Trigger button of the signing complete-dialog when all fields are done. */
    complete: string;
    /** Submit button inside the signing complete-dialog. */
    sign: string;
    /** Completion page heading for a signer. */
    documentSigned: string;
    /** Next Field — trigger when fields remain. */
    nextField: string;
    /** Per-recipient language picker labels — rendered in the SESSION locale
     * (SUPPORTED_LANGUAGES full names go through Lingui), not the target
     * language. An English session shows "French"; a French one "Français". */
    languageEn: RegExp;
    languageFr: RegExp;
  }
> = {
  en: {
    fullName: 'Full Name',
    emailAddress: 'Email Address',
    signinEmail: /^Email$/i,
    password: 'Password',
    typeTab: 'Type',
    next: 'Next',
    createAccount: 'Create account',
    signIn: 'Sign In',
    emailConfirmed: /Email Confirmed!/i,
    recipientPlaceholder: /Recipient 1/,
    sendDocument: 'Send Document',
    send: 'Send',
    uploadDocument: 'Upload Document',
    signature: 'Signature',
    emailConfirmedShort: 'Email Confirmed!',
    complete: 'Complete',
    sign: 'Sign',
    documentSigned: 'Document Signed',
    nextField: 'Next Field',
    languageEn: /^English$/i,
    languageFr: /^French$/i,
  },
  fr: {
    fullName: 'Nom complet',
    emailAddress: 'Adresse courriel',
    signinEmail: /^courriel$/i,
    password: 'Mot de passe',
    typeTab: 'Saisir',
    next: 'Suivant',
    createAccount: 'Créer un compte',
    signIn: 'Se connecter',
    emailConfirmed: /courriel confirmé/i,
    recipientPlaceholder: /Destinataire 1/,
    sendDocument: 'Envoyer le document',
    send: 'Envoyer',
    uploadDocument: 'Téléverser le document',
    signature: 'Signature',
    emailConfirmedShort: 'courriel confirmé',
    complete: 'Compléter',
    sign: 'Signer',
    documentSigned: 'Document signé',
    nextField: 'Champ suivant',
    languageEn: /^Anglais$/i,
    languageFr: /^Français$/i,
  },
};

/**
 * Sign up a brand-new user through the real /signup UI (no seed script),
 * confirm the email address through the real verification email, and sign in.
 *
 * Returns the email used, so tests can assert against Inbucket mailboxes.
 *
 * Why the full verification: signup does NOT mint a session, and the server
 * rejects sign-in for unverified accounts (UNVERIFIED_EMAIL) — a brand-new
 * account cannot reach the dashboard until its email is confirmed. The only
 * real path in is the emailed /verify-email/{token} link, which also
 * auto-authenticates the user on success.
 */
export const signup = async ({ page, locale = 'en' }: { page: Page; locale?: TestLocale }): Promise<string> => {
  const L = LABELS[locale];
  const inbucket = new InbucketClient(page.context().request);
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 10_000)}@northsign.test`;

  await page.goto('/signup');

  await page.getByLabel(L.fullName).fill('NorthSign E2E');
  await page.getByLabel(L.emailAddress).fill(email);
  await page.getByLabel(L.password, { exact: true }).fill(TEST_PASSWORD);

  // Signature pad: draw via the "type" tab.
  // The dialog's confirm button ("Next") applies the typed signature and
  // closes the dialog in one step — there is no separate Save step.
  await page.getByTestId('signature-pad-dialog-button').click();
  await page.getByRole('tab', { name: L.typeTab }).click();
  await page.getByTestId('signature-pad-type-input').fill('NorthSign E2E');
  await page.getByRole('button', { name: L.next }).click();

  await page.getByRole('checkbox').first().check(); // acceptTerms (ToS/Privacy)
  // marketingOptIn intentionally left unchecked — asserted in the consent test.

  await page.getByRole('button', { name: L.createAccount }).click();

  // Successful signup lands on /unverified-account (email-confirmation page).
  await expect(page).toHaveURL(/\/unverified-account/, { timeout: 30_000 });

  // Confirm the address through the emailed verification link.
  const localPart = email.split('@')[0];
  const confirmation = await inbucket.waitForMessage(localPart, () => true);
  const confirmationUrl = await inbucket.extractVerificationLink(localPart, confirmation.id);

  await page.goto(confirmationUrl);

  // The token page verifies asynchronously on mount; wait for the confirmed
  // state (this endpoint also auto-authenticates the user).
  await expect(page.getByText(L.emailConfirmedShort).first()).toBeVisible({ timeout: 30_000 });

  // Email confirmed → sign in (skipped when verification already logged us in).
  await signin({ page, email, locale });

  return email;
};

/**
 * Sign in as an existing user through the UI so the session cookie is minted
 * exactly like a real browser session.
 *
 * Skips the form when the current session is already authenticated: the app
 * bounces /signin into the authenticated area, and there is no form to fill.
 */
export const signin = async ({
  page,
  email,
  locale = 'en',
}: {
  page: Page;
  email: string;
  locale?: TestLocale;
}): Promise<void> => {
  const L = LABELS[locale];

  await page.goto('/signin');

  // Already authenticated? The app redirects /signin to the dashboard/documents.
  const emailField = page.getByLabel(L.signinEmail);
  const isOnSigninForm = await emailField
    .first()
    .waitFor({ state: 'visible', timeout: 5_000 })
    .then(() => true)
    .catch(() => false);

  if (!isOnSigninForm) {
    return;
  }

  await emailField.first().fill(email);
  await page.getByLabel(L.password, { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: L.signIn }).click();

  await expect(page).toHaveURL(/\/t\/|\/documents/, { timeout: 30_000 });
};

/**
 * Create (upload) a new document from the tiny 1-page PDF fixture and land on
 * the envelope editor. Assumes the caller is signed in and on any page.
 */
export const createDocument = async ({ page, locale = 'en' }: { page: Page; locale?: TestLocale }): Promise<string> => {
  const L = LABELS[locale];

  await page.goto('/dashboard');

  // The documents page renders the dropzone with the localized upload label.
  await expect(page.getByText(L.uploadDocument).first()).toBeVisible();

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
  locale?: TestLocale;
  /** Set the per-recipient email language (Phase 5 Step 6 picker). */
  language?: 'en' | 'fr';
};

/**
 * In the envelope editor (upload step), fill the first recipient row through
 * the real "Add Signer" form. When `language` is set, also picks that locale
 * in the per-recipient language picker (Phase 5 Step 6). Recipients are
 * auto-saved by the editor (debounced sync) — no explicit submit exists.
 */
export const addRecipient = async ({
  page,
  email,
  name,
  locale = 'en',
  language,
}: AddRecipientOptions): Promise<void> => {
  const L = LABELS[locale];

  // The editor starts with one empty signer row.
  const emailInput = page.getByTestId('signer-email-input');
  await expect(emailInput.first()).toBeVisible();

  await emailInput.first().fill(email);

  if (name) {
    await page.getByPlaceholder(L.recipientPlaceholder).first().fill(name);
  }

  if (language) {
    await page.getByTestId('recipient-language-trigger').first().click();

    // Options render in the session's language (Lingui-translated full names),
    // NOT in the selected language — pick by session-localized label.
    await page.getByRole('option', { name: language === 'fr' ? L.languageFr : L.languageEn }).click();
  }
};

/**
 * Move from the upload/recipients step to the fields step ("Add Fields").
 */
export const continueEditor = async ({ page }: { page: Page }): Promise<void> => {
  // The step selector exposes a stable testid (locale-independent).
  await page.getByTestId('envelope-editor-step-addFields').click();
};

/**
 * Place a signature field near the top-left of the first PDF page (fields
 * step): select the Signature field type, then click the page.
 *
 * The click target is the Konva stage canvas layered over the PDF page, not
 * the `.react-pdf__Page` element beneath it — the canvas sits at z-10 and
 * intercepts pointer events (same gesture as the upstream suite's
 * placeFieldOnPdf). The helper then waits until the field actually exists on
 * the stage, so callers can send immediately after.
 */
export const addSignatureField = async ({
  page,
  locale = 'en',
}: {
  page: Page;
  locale?: TestLocale;
}): Promise<void> => {
  const L = LABELS[locale];

  await page.getByRole('button', { name: L.signature, exact: true }).first().click();

  const canvas = page.locator('.konva-container canvas').first();

  await expect(canvas).toBeVisible();
  await canvas.click({
    position: { x: 150, y: 150 },
  });

  // The field is created through editorFields.addField() once the click lands
  // on the page; poll the Konva stage instead of guessing a fixed delay.
  await expect(async () => {
    const fieldCount = await page.evaluate(() => {
      const konva = (
        window as unknown as {
          Konva?: { stages: Array<{ attrs: { id?: string }; find: (selector: string) => unknown[] }> };
        }
      ).Konva;

      const pageOne = konva?.stages.find((stage) => stage.attrs.id === 'page-1');

      return pageOne?.find('.field-group').length ?? 0;
    });

    expect(fieldCount).toBeGreaterThan(0);
  }).toPass({ timeout: 15_000 });
};

/**
 * Send the envelope through the real "Send Document" → distribute dialog and
 * wait for the redirect back to the documents list.
 */
export const sendEnvelope = async ({ page, locale = 'en' }: { page: Page; locale?: TestLocale }): Promise<void> => {
  const L = LABELS[locale];

  await page.getByRole('button', { name: L.sendDocument, exact: true }).first().click();

  // Distribute dialog mounts async; the submit button carries the same label
  // in both locales ("Send" / "Envoyer").
  const sendButton = page.getByRole('button', { name: L.send, exact: true });

  await expect(sendButton).toBeVisible({ timeout: 15_000 });
  await sendButton.click();

  await page.waitForURL(/\/documents/, { timeout: 30_000 });
};

/**
 * Complete the signing page as the recipient: draw a typed signature through
 * the signature-pad dialog, then finish through the completion dialog.
 *
 * Dialog flow (document-signing-complete-dialog.tsx): the trigger button is
 * "Complete" once all fields are done (or "Next Field" while fields remain);
 * it opens a confirmation dialog whose submit button is "Sign".
 */
export const completeSigning = async ({ page, locale = 'en' }: { page: Page; locale?: TestLocale }): Promise<void> => {
  const L = LABELS[locale];

  await page.getByTestId('signature-pad-dialog-button').click();
  await page.getByRole('tab', { name: L.typeTab }).click();
  await page.getByTestId('signature-pad-type-input').fill(locale === 'fr' ? 'Signataire' : 'Recipient Signature');
  await page.getByRole('button', { name: L.next }).click();

  // Trigger of the completion dialog (opens "Are you sure?" confirmation).
  const completeTrigger = page.getByRole('button', { name: L.complete, exact: true });

  await expect(completeTrigger).toBeVisible({ timeout: 15_000 });
  await completeTrigger.click();

  // Submit inside the confirmation dialog.
  const signSubmit = page.getByRole('button', { name: L.sign, exact: true });

  await expect(signSubmit).toBeVisible({ timeout: 15_000 });
  await signSubmit.click();

  await page.waitForURL(/\/sign\/.+\/complete/, { timeout: 60_000 });
  await expect(page.getByText(L.documentSigned).first()).toBeVisible({ timeout: 30_000 });
};

/**
 * Delete the currently signed-in user's account through Settings → Profile.
 *
 * The confirmation dialog requires typing the ACCOUNT EMAIL (not "DELETE")
 * and clicking "Confirm Deletion".
 */
export const deleteAccount = async ({ page, email }: { page: Page; email: string }): Promise<void> => {
  await page.goto('/settings/profile');

  await page
    .getByRole('button', { name: /delete account/i })
    .first()
    .click();

  // aria-label "Confirm Email" input; type the account email to enable the button.
  const confirmEmailInput = page.getByLabel(/Confirm Email/i);

  await expect(confirmEmailInput).toBeVisible({ timeout: 15_000 });

  // The dialog's label embeds the account email; extract it (falls back to
  // the email passed by the caller when the parse fails).
  const labelText = await confirmEmailInput.evaluate((element) => {
    const dialog = element.closest('[role="dialog"]');

    if (!dialog) {
      return '';
    }

    const label = dialog.querySelector('label');

    return label?.textContent?.trim() ?? '';
  });

  const emailMatch = /[\w.+-]+@[\w-]+\.[\w.-]+/.exec(labelText);
  const emailToType = emailMatch ? emailMatch[0] : email;

  await confirmEmailInput.fill(emailToType);
  await page.getByRole('button', { name: /confirm deletion/i }).click();
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

  /** Fetch a single message including its HTML part. */
  private async getMessageParts(localPart: string, messageId: string): Promise<{ text: string; html: string }> {
    const response = await this.request.get(`${this.baseUrl}/api/v1/mailbox/${localPart}/${messageId}`);

    expect(response.ok()).toBeTruthy();

    const message = (await response.json()) as { body?: { text?: string; html?: string } };

    return { text: message.body?.text ?? '', html: message.body?.html ?? '' };
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

  /** Extract the first /verify-email/{token} link from a message body. */
  async extractVerificationLink(localPart: string, messageId: string): Promise<string> {
    const { text, html } = await this.getMessageParts(localPart, messageId);

    const match = /https?:\/\/[^\s"'<>]+\/verify-email\/[A-Za-z0-9]+/.exec(`${html}\n${text}`);

    if (!match) {
      throw new Error(`No verification link found in message ${messageId} for ${localPart}`);
    }

    return match[0];
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
