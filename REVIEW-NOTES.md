# REVIEW-NOTES — fr-CA translation review log (Phase 4)

> Phase 4, Steps 4–7. Machine-translation provenance, corrections applied,
> and the **human polish-pass backlog**. Per the phase plan, **nothing ships
> to marketing before the Phase 9 polish pass** on every id logged below.

---

## 1. How the fr-CA catalog was produced

`packages/lib/translations/fr/web.po` already existed upstream as Crowdin
community French (**fr-FR-flavoured**, ~94 % complete at Phase 4 start:
189 empty msgstrs out of 3,038 entries). Phase 4 work:

1. `lingui extract --clean` after the Phase 4 string changes — the catalog
   grew to **3,227 msgids** (en and fr have identical id sets).
2. `node scripts/fr-ca-tools.mjs dump` → `scripts/fr-ca-missing.json` (exact
   msgids with empty msgstrs).
3. Translated in 5 AI-authored batches, reviewed while writing, stored in
   `scripts/fr-ca-missing-1.json … fr-ca-missing-5.json` (kept in-repo as the
   machine-readable provenance of every id).
4. `node scripts/fr-ca-tools.mjs apply` merged the batches into the catalog
   deterministically (only msgstr values are ever written) + applied the
   glossary normalization rules (`CORRECTIVE_RULES` in the tool: the naive
   `email → courriel` replacement artifacts, elisions).
5. Post-pass glossary enforcement this session (see §3).

**Counts:** 374 unique msgids were machine-translated (189 upstream empties
that survived extraction + new Phase 4 ids). All 3,227 fr msgstrs are now
non-empty (`msgid ""` header aside). `lingui compile` passes for every
locale.

## 2. Machine-translated string ids (human polish required)

> Every id below was produced by machine translation (batched in
> `scripts/fr-ca-missing-*.json`) and has **not** received a human fr-CA
> editorial pass. Check register (formal « vous »), terminology per the
> glossary in `I18N.md` §7, naturalness, and length/width impact.

```text
- "Team Name" has invited you to sign "example document".
- "{0}" is not a valid email address.
- "{0}" will appear on the document as it has a timezone of "{1}".
- "{documentName}" has been deleted by an admin.
- "{placeholderEmail}" on behalf of "Team Name" has invited you to sign "example document".
- "{title}" has been successfully cancelled
- "{title}" has been successfully deleted
- "{title}" has been successfully hidden
- +{extraCount} more
- <0>"{0}"</0> is no longer available to sign
- <0>Inherit authentication method</0> - Use the global action signing authentication method configured in the "General Settings" step
- <0>{organisationName}</0> does not have an active subscription. Please contact the organisation administrator to renew their plan before accepting this invitation.
- <0>{organisationName}</0> has reached its member limit. Please contact the organisation administrator to upgrade their plan before accepting this invitation.
- <0>{organisationName}</0> has requested to link your current NorthSign account to their organisation.
- <0>{senderName} {senderEmail}</0> on behalf of "{0}" has invited you to approve this document
- <0>{senderName} {senderEmail}</0> on behalf of "{0}" has invited you to assist this document
- <0>{senderName} {senderEmail}</0> on behalf of "{0}" has invited you to sign this document
- <0>{senderName} {senderEmail}</0> on behalf of "{0}" has invited you to view this document
- <0>{teamName}</0> has requested to use your email address for their team on NorthSign.
- <0>{teamName}</0> would like to use <1>{email}</1> as their team email.
- A field was added
- A field was removed
- A field was updated
- A member has joined your organisation on NorthSign
- A member has left your organisation on NorthSign
- A name to help you identify this token later.
- A recipient was added
- A recipient was removed
- A recipient was updated
- A request has been made to link your NorthSign account
- A request to use your email has been initiated by {0} on NorthSign
- A secret that will be sent to your URL so you can verify that the request has been sent by {APP_NAME}.
- Accept invitation to join an organisation on NorthSign
- Accept team email request for {teamName} on NorthSign
- Account Settings
- Accounts are automatically added to your organisation on sign-in
- Active
- Add rate limit window
- An admin has deleted your document "{documentName}".
- An administrator has created a NorthSign account for you.
- An error occurred while downloading the documents.
- Approve
- Approved
- Approver
- Approvers
- Approving
- Assist
- Assistant
- Assistants
- Assisted
- Assisting
- Block signups from additional email domains on top of the bundled disposable email list. Subdomains are matched automatically (e.g. blocking "bad.com" also blocks "foo.bad.com").
- Border radius
- Brand accent
- Brand colours, including background, foreground, primary, and border colours
- Brand website and brand details
- Bulk send operation complete for template "{templateName}"
- By proceeding to use the electronic signature service provided by {APP_NAME}, you affirm that you have read and understood this disclosure. You agree to all terms and conditions related to the use of electronic signatures and electronic transactions as outlined herein.
- CC
- CC'd
- Canadian-hosted e-signatures
- Capabilities enabled for this organisation.
- Cc
- Ccers
- Certificate preferences updated
- Certificates
- Clear
- Clear all
- Company details
- Company details and website in email footers
- Confirm Email
- Contact Sales
- Contact your organisation owner to upgrade plans.
- Continue with SSO
- Copy direct link
- Copy license key
- Copy your token now. For security reasons you will not be able to see it again.
- Create API token
- Create and manage API tokens. See our <0>documentation</0> for more information.
- Custom CSS
- Custom Plan
- Custom branding enabled setting
- DOCUMENT REJECTED
- Default date format
- Default document language
- Default document visibility
- Default recipients
- Default signature settings
- Default time zone
- Delete token
- Do not proceed if you are unsure about this request.
- Document "{0}" - Rejected by {1}
- Document "{0}" - Rejection Confirmed
- Document "{0}" Cancelled
- Document access auth updated
- Document already completed
- Document already signed
- Document cancelled
- Document completed
- Document created
- Document deleted
- Document expired
- Document external ID updated
- Document moved to team
- Document no longer available
- Document not ready
- Document opened
- Document sent
- Document signing auth updated
- Document title updated
- Document updated
- Document viewed
- Document visibility updated
- Documents downloaded
- Documents partially downloaded
- Done
- Download Documents
- Download version for {0}
- Downloading {progress} / {0}...
- Draw
- Easy DNS setup with auto-generated DKIM and SPF records
- Email already in use
- Email resent
- Email sent
- Empty quota means unlimited, 0 blocks the resource. Rate limit windows accept values like 5m, 1h or 24h.
- Enter a max request count greater than 0
- Enter a window, e.g. 5m
- Envelope item PDF replaced
- Envelope item created
- Envelope item deleted
- Envelope item updated
- Exceeded
- Expired
- Expires in
- Field prefilled by assistant
- Field signed
- Field unsigned
- For example, if the claim has a new flag "FLAG_1" set to true, then this organisation will get that flag added.
- Free
- Free (Pending)
- General settings
- Give your members a dedicated single sign-on portal. The SSO portal is available on the Enterprise plan.
- Global
- Go to your settings
- Here you can edit your team's details.
- Here you can set certificate and audit log preferences for your organisation. Teams will inherit these settings by default.
- Here you can set certificate and audit log preferences for your team.
- Here you can set expiration and signing reminder preferences for your organisation. Teams will inherit these settings by default.
- Here you can set expiration and signing reminder preferences for your team.
- Hi {userName}, you need to enter a verification code to complete the document "{documentTitle}".
- Hide field
- Inactive
- Invalid direct link template
- Invitation already accepted
- It's not your turn to sign yet
- Join {organisationName} on NorthSign
- Jump to
- Last Used
- Limit reached
- Link template
- Link your NorthSign account
- Logo
- Logo preview
- Max requests
- Microsoft Logo
- Missing signature fields
- Monthly quota
- Monthly usage
- Move the subscription from "{sourceOrganisationName}" to another organisation owned by this user.
- Named senders with defaults per team, template or document
- Navigate
- Near limit
- No expired documents
- No folders found matching "{searchTerm}"
- No inherited claim
- No rejected documents
- No results for “{trimmedSearch}”
- Once confirmed, the following will be reset:
- Once you update your DNS records, it may take up to 48 hours for it to be propogated. Once the DNS propagation is complete you will need to come back and press the "Sync" domains button.
- One or more of your required fields have not been saved. Please refresh the page, complete any empty required fields, and try again.
- Open
- Organisation "{organisationName}" has been deleted
- Original
- Overlapping fields detected
- Override
- Paid
- Partial
- Past Due
- People with access to this organisation.
- Plan select
- Please sign: Example.pdf
- Please upload a valid image file.
- Please {0} your document<0/>"{documentName}"
- Privacy Policy
- Profile badge
- Put your own brand on every document you send. Branding is available on the Teams plan and above.
- Read our documentation to get started with {APP_NAME}.
- Recipient signing window expired
- Recipients cannot use this direct link template because the following signers are missing a signature field
- Redirecting to your identity provider
- Redirecting to {0}...
- Reminder preferences updated
- Reminder: Please {0} your document<0/>"{documentName}"
- Reminder: Please {recipientActionVerb} the document "{0}"
- Remove rate limit
- Reset branding preferences
- Reset document preferences
- Reset to defaults
- Resource blocked
- Restrict sign-ins by email domain and choose the default role
- Return to {APP_NAME} sign in page here
- Search by document title, recipient:123, team:123 or user:123
- Search documents, users, organisations…
- Search languages…
- Search members...
- Search organisations…
- Search teams…
- Search themes…
- Select a section
- Send documents from your own domain. Email domains are available on the Enterprise plan.
- Send emails to recipients from your domain
- Sending from app.northsign.ca
- Sending from your domain
- Sent this period
- Separate branding per team
- Set your password for NorthSign
- Sign
- Sign Document - {APP_NAME}
- Signed
- Signed by {APP_NAME}
- Signed in
- Signer
- Signers
- Signers that Signed Up
- Signing
- Signing link expired
- Signing window expired for "{0}" on "{1}"
- Signing window expired for "{displayName}" on "{documentName}"
- Single sign-on
- Some fields are placed on top of each other. This may complicate the signing process or cause fields to not work as expected.
- Some fields were not saved
- Some searches failed — results may be incomplete.
- Step {0}/{1}
- Stop
- Subscriptions
- System auto inserted fields
- Team "{0}" has been deleted on NorthSign
- Team email removed for {teamName} on NorthSign
- Teams that belong to this organisation.
- Terms of Service
- Thank you for using {APP_NAME} to perform your electronic document signing. The purpose of this disclosure is to inform you about the process, legality, and your rights regarding the use of electronic signatures on our platform. By opting to use an electronic signature, you are agreeing to the terms and conditions outlined below.
- The URL for {APP_NAME} to send webhook events to.
- The document could not be sent because some signers do not have a signature field. Please edit the template and add a signature field for each signer.
- The document ownership was delegated to {0} on behalf of {1}
- The email address which will show up in the "Reply To" field in emails
- The image could not be loaded. Please try again.
- The image must be smaller than 5MB.
- The license key has been copied to your clipboard
- The part before the @ symbol (e.g., "support" for support@{0})
- The signing window for "{recipientName}" on document "{documentName}" has expired.
- The signing window for {displayName} on document "{documentName}" has expired. You can resend the document to extend their deadline or cancel the document.
- Theme
- There are no documents with expired signing links. You can redistribute a document to renew its expiration.
- There are no rejected documents. Documents that a recipient declines to sign will appear here.
- They will be able to view documents associated with this email.
- This direct link template cannot be used because one or more signers do not have a signature field assigned.
- This direct link template cannot be used because one or more signers do not have a signature field assigned. Please contact the sender to update the template.
- This document can no longer be signed. It may have been removed by the sender, or your signing access may have been revoked. Please contact the sender for a new signing link.
- This document has already been completed and no further signatures can be added.
- This document has been cancelled by the sender and can no longer be signed. Please contact the sender if you believe this is a mistake.
- This document has been rejected by a recipient and can no longer be signed.
- This document has not been sent for signing yet. Please wait for the sender to send it before signing.
- This document is available in your {APP_NAME} account. You can view more details, recipients, and audit logs there.
- This document is signed in a set order and other recipients must sign before you. You will receive an email when it is your turn.
- This document was already signed and no further action was taken.
- This email confirms that you have rejected the document <0>"{documentName}"</0> sent by {documentOwnerName}.
- This email is already being used as a team email. Please contact your team for assistance.
- This image is invalid, please upload a valid image file.
- This will move the subscription from "{sourceOrganisationName}" to "{0}". The source organisation will be reset to the free plan.
- This will reset all branding preferences to their default values and save the changes immediately.
- This will reset all document preferences to their default values and save the changes immediately.
- Try a different search or switch category.
- Type
- Unable to upload image
- Unlock Branding Preferences
- Unlock Email Domains
- Unlock the Organisation SSO Portal
- Unsaved changes
- Update organisation member role
- Update team group role
- Update team member role
- Upgrade Plan
- Upload
- Upload New Image
- Use API tokens to authenticate with the {APP_NAME} API.
- Use a duration with a unit, e.g. 5m, 1h, or 24h
- Use a unique window for each rate limit
- Verify email
- Verify team email
- View
- View all results
- Viewed
- Viewer
- Viewers
- Viewing
- Waiting for others to complete signing
- Want to send slick signing links like this one? <0>Check out {APP_NAME}</0>.
- We couldn’t complete the search. Try again.
- We were unable to add you to <0>{organisationName}</0> at this time. Please try again later, or contact the organisation administrator.
- We were unable to update your certificate preferences at this time, please try again later
- We were unable to update your reminder preferences at this time, please try again later
- We were unable to verify this email at this time. Please try again later.
- Welcome to NorthSign
- Welcome to NorthSign!
- Welcome to {0}
- While waiting for them to do so you can create your own {APP_NAME} account and get started with document signing right away.
- Window
- Within limit
- Works with any OIDC provider — Okta, Entra ID, Google and more
- You are about to cancel <0>"{title}"</0>
- You are about to delete <0>"{title}"</0>
- You are about to hide <0>"{title}"</0>
- You are about to remove the following group from <0>{0}</0>.
- You are already a member of <0>{0}</0>.
- You can revoke access at any time in your team settings on NorthSign <0>here</0>.
- You can view the created documents in your dashboard under the "Documents created from template" section.
- You don't have permission to manage this organisation. Switch to another one above, or continue in your team settings below.
- You have accepted an invitation from <0>{organisationName}</0> to join their organisation.
- You have been invited by <0>{organisationName}</0> to join their organisation.
- You have been invited to join <0>{organisationName}</0> on {APP_NAME}.
- You have been invited to join {0} on NorthSign
- You have declined the invitation from <0>{organisationName}</0> to join their organisation.
- You have no API tokens yet. Your tokens will be shown here once you create them.
- You have unsaved changes
- You have verified your email address for <0>{teamName}</0>.
- Your bulk send operation for template "{templateName}" has completed.
- Your certificate preferences have been updated
- Your email has already been confirmed. You can now use all features of {APP_NAME}.
- Your email has been successfully confirmed! You can now use all features of {APP_NAME}.
- Your logo on signing pages and emails
- Your new API token
- Your plan is no longer valid. Please subscribe to a new plan to continue using {APP_NAME}.
- Your reminder preferences have been updated
- Your signing link has expired. Please contact the sender to request a new one.
- Zoom in
- Zoom out
- esc
- selected
- {0, plural, one {# document downloaded.} other {# documents downloaded.}} {failedDownloads, plural, one {# document could not be downloaded.} other {# documents could not be downloaded.}}
- {0, plural, one {# document has been downloaded.} other {# documents have been downloaded.}}
- {0, plural, one {Select the version to download for the selected document.} other {Select the version to download for each of the # selected documents.}}
- {0} Plan
- {0} has invited you to sign this document.
- {0} has invited you to {recipientActionVerb} the document "{1}".
- {0} on behalf of "{1}" has invited you to {recipientActionVerb} the document "{2}".
- {0} results
- {0}/{1}
- {APP_DESCRIPTION} {APP_TAGLINE}. Built on {0}.
- {APP_NAME} will delete <0>all of your documents</0>, along with all of your completed documents, signatures, and all other resources belonging to your Account.
- {APP_NAME}, Canadian-hosted e-signatures, DocuSign alternative, document signing, PIPEDA, Law 25, bilingual EN/FR, data residency Canada, open source
- {MAX_BULK_DOWNLOAD_ENVELOPES, plural, one {You can download up to # document at a time. Deselect some documents to continue.} other {You can download up to # documents at a time. Deselect some documents to continue.}}
- {inviterName} has cancelled the document<0/>"{documentName}"
- {inviterName} has invited you to {0}<0/>"{documentName}"
- {inviterName} has invited you to {action} the document "{documentName}".
- {inviterName} has removed you from the document<0/>"{documentName}"
- {inviterName} on behalf of "{0}" has invited you to {recipientActionVerb} the document "{1}".
- {inviterName} on behalf of "{teamName}" has invited you to {0}<0/>"{documentName}"
- {inviterName} on behalf of "{teamName}" has invited you to {action} {documentName}
- {recipientReference} has signed "{0}"
- {recipientReference} has signed "{documentName}"
- {signerName} has rejected the document "{documentName}".
- {teamName} has invited you to {0}<0/>"{documentName}"
- {totalVisibleCount, plural, one {# item} other {# items}}
- {totalVisibleCount, plural, one {# result} other {# results}}
```

## 3. Corrections applied on top of the machine batches

Applied deterministically (see `fr-ca-tools.mjs` + this session's fixes):

- **email → courriel** everywhere in msgstrs (incl. "adresse courriel",
  "liste de courriels", elisions fixed: *Le courriel / le courriel / de
  courriel / des courriels / les courriels*). Verified: **0** occurrences
  of `e-mail`/`email` remain in any fr msgstr (msgid occurrences are
  English source strings and are exempt).
- **upload → téléverser / téléversement**: all 12 `Upload*` msgids now use
  « Téléverser » (was « Importer » from Crowdin).
- **audit trail → piste d'audit**: msgid "Audit Log" → « Piste d'audit »
  (was « Journal d'audit »; glossary bans it in UI copy).
- **document status "Completed" → « Signé »** (msgid "Completed" feeding
  status labels in tables/emails). « Terminé » remains for "Done" buttons
  and "Completed At" timestamps.
- **PDF/signature strings**: "DOCUMENT REJECTED" → « DOCUMENT REFUSÉ »;
  "Signed by {APP_NAME}" → « Signé électroniquement par {APP_NAME} »
  (signature dictionary reason; matches the mandated stamp wording).
- **Meta copy** (`meta.ts`): description/keywords/tagline are now ICU
  msgids with fr-CA translations (« Signature électronique hébergée au
  Canada », LPRPDE/Loi 25 wording).
- **Typographic NBSP** before « : » in « Événements : » / « Comprend : ».
- **Incident fixed this session:** 3 msgstrs written by the earlier
  serializer contained corrupted NUL-byte escape artifacts
  (`Événements\0a0:`, `Comprend\0a0:`, `Jeton de pr\0esignature d\0b9int…`).
  Rebuilt byte-exact; whole catalog re-scanned — 0 NUL bytes, valid UTF-8,
  `lingui compile` green for all locales.

## 4. Known residual items for the polish pass (Phase 9)

> These are deliberately NOT mass-fixed now — each needs human judgment by
> context. All are tracked here so the pass is exhaustive.

1. **Register & terminology sweep of the ~2,850 pre-existing Crowdin
   entries** (everything not in §2's list). Spot-checks found correct
   glossary usage (Destinataires/Signataires/Adresse courriel/En attente),
   but the batch provenance is unknown; fr-FR spelling/register drift must
   be assumed until reviewed (e.g. « Conseiller » vs « Consultant »).
2. **"Terminé le"** time stamps ("Completed At"/"Completed on") — fine
   fr-CA, but confirm 24 h formatting renders via `i18n.date` in all views.
3. **Per-document `DocumentMeta.dateFormat`** (luxon string, user-chosen)
   is intentionally NOT locale-switched (user preference wins; D-025).
4. **Email locale chain** = `DocumentMeta.language → org settings
   documentLanguage → en`. No per-recipient / per-user locale column exists
   (schema untouched); the spec's "recipient → owner → en" intent is
   deferred to Phase 5 (compliance) — D-024.
5. **Text-expansion QA**: French runs 15–20 % longer; the new header/footer
   LanguageSwitcher, buttons, table headers and modals must be visually
   re-checked in fr-CA (QA sweep Step 7 is on the operator machine —
   sandbox has no Postgres/Docker; see PHASES.md handoff).
6. **Currency**: Phase 6 adds Intl.NumberFormat CAD via `i18n.number`
   (infrastructure already locale-aware; no code needed now).
7. **hreflang** is best-effort under the cookie strategy (D-023): the
   `?lang=` alternates are the only crawlable fr surface until a `/fr/*`
   decision (D-022 falls back to cookie-based switching as permitted).

## 5. Gate

- [ ] Human polish pass over §2's 374 ids (register, terminology, length)
- [ ] Re-run `npm run translate:compile` after any msgstr edit
- [ ] Re-run glossary greps: `e-mail|email` in fr msgstrs = 0;
      `Journal d'audit` = 0; `Importer` (upload context) = 0
- [ ] Marketing/landing copy ships ONLY after this pass (Phase 9)

---

## 6. Phase 6 — billing & monetization msgids (Steps 5, logged 2026-09-04)

All 96 new msgids introduced by the billing surfaces were translated to fr-CA
this session and verified: catalog missing = 0 after extraction, `lingui
compile` green. Provenance: machine-translated by the session agent using the
I18N.md §7 glossary (courriel, téléverser, formal « vous », NBSP elisions with
typographic apostrophes « ' »), following the established fr-CA conventions
above. They carry the SAME "human polish required" flag as §2 — add them to
the Phase 9 polish-pass backlog (especially: « Forfait » vs « Plan » usage,
« Le plus populaire » badge width in the pricing cards, and the long
payment-failed banner copy).

New surfaces (msgid sources):
- `apps/remix/app/routes/pricing.tsx` (public /pricing page)
- `apps/remix/app/components/general/northsign-billing-dashboard.tsx`
  (/settings/billing cards: plan, usage, portal, upgrade CTAs)
- `apps/remix/app/components/general/organisations/northsign-billing-banner.tsx`
  (limit + payment-failed banners)
- `apps/remix/app/utils/toast-error-messages.ts` (limit-reached toasts)
- `apps/remix/app/routes/_authenticated+/settings+/billing.tsx` (subtitle)

Full msgid list (en source, as extracted):

```text
- "{0} documents sent per month"
- "{0} recipients per document"
- "{sentCount} of {periodLimit} documents sent"
- "/month" · "/year" · "$0" · "2" · "3"
- "Annual" · "Monthly" (pre-existing)
- "API access"
- "Billed monthly." · "Billed yearly."
- "Billing is managed per organisation. Create an organisation to get started, or contact support if you believe this is a mistake."
- "Billing portal is simulated"
- "Business" · "Pro" · "Starter" (brand tier names — kept untranslated in msgstrs)
- "Business includes team features, which ship in a later release. Business accounts keep today's price until then."
- "Cancels at period end" · "Active" (pre-existing)
- "Checkout cancelled" · "Checkout complete"
- "Choose Business" · "Choose Pro"
- "Community" · "Standard" · "Priority"
- "Community support" · "Standard email support" · "Priority email support"
- "Compare plans" · "Compare plans and annual pricing" · "Feature"
- "Current period ends {periodEndDate}." · "Renews {periodEndDate}." · "Subscription ends {periodEndDate}."
- "Current plan" · "Free" · "Free plan" · "Test mode"
- "Documents sent per month" · "Recipients per document" · "Team features"
- "For occasional signing and trying NorthSign."
- "For professionals who send documents every day."
- "For teams that need priority support and shared workflows."
- "Free forever. No credit card required."
- "Full API access" · "Templates to send in one click" · "Team features with shared workflows"
- "Get started free" · "Start for free" · "Sign in" · "Open app" · "Talk to us"
- "Included" · "Not included" · "Unlimited"
- "Invoices and payment methods live in the billing portal."
- "Manage the plan, usage, payment method and invoices for the organisations you own. Prices are in CAD and exclude GST/HST/QST, which are calculated at checkout."
- "Monthly sending limit reached" · "Upgrade required" · "Upgrade to send more"
- "Most popular" · "Current plan"
- "No billing organisations found"
- "No changes were made to your plan. You can upgrade whenever you are ready."
- "No free trials, no hidden fees. Documents are stored in Canada (AWS ca-central-1)."
- "NorthSign home"
- "NorthSign is running with the test billing provider, so there is no real Stripe portal. In production this button opens your payment method, invoices, and plan changes."
- "Payment failed" · "Payment failed — update your payment method to keep your plan active." · "Update payment method"
- "Per-recipient English and French signing" · "Per-recipient locale (EN / fr-CA signing emails)"
- "Prices in CAD, exclusive of GST/HST/QST. Taxes are calculated at checkout."
- "Pricing"
- "Ready to send your first bilingual document?"
- "Resets at the start of each calendar month."
- "Sign up free and send 3 documents a month, with up to 2 recipients each — per-recipient English and French signing included on every plan."
- "Simple, transparent pricing for signing in Canada"
- "Start free — no credit card, no trial clock. Upgrade when your team needs unlimited sends, templates, or the API."
- "This feature is included with Pro and above. Upgrade from Settings → Billing to unlock it."
- "Unlimited documents sent" · "Unlimited documents sent." · "Unlimited recipients per document"
- "Upgrade to Pro — {proMonthlyPrice}/month"
- "Usage this period"
- "We could not charge your payment method. Your access continues until the end of the billing period, then the plan is paused. Update your payment method to avoid an interruption."
- "We were unable to open the billing portal. Please try again, or contact support."
- "We were unable to start the checkout. Please try again, or contact support."
- "Welcome to your new plan"
- "You have 1 document left this period."
- "You have reached the {periodLimit} documents per month limit."
- "You have sent all the documents included in the free Starter plan this month. Upgrade to Pro for unlimited sending — your recipients are never blocked."
- "You have used {used} of {limit} free documents this month."
- "You have used all {limit} free documents this month."
- "Your plan has been updated. You can start sending without limits right away."
- "Your subscription is being activated — this usually takes a few seconds."
```

Glossary compliance verified on the new msgstrs:
- **email → courriel** (0 `email`/`e-mail` in new msgstrs; "courriels de
  signature" for signing emails).
- **template → modèle**, **recipient → destinataire**, **sender →
  expéditeur**, formal « vous », fr-CA punctuation (NBSP before « : », « … »,
  typographic apostrophes), prices as « 0 $ » / « dollars canadiens » per
  fr-CA convention (unit before, space included).
- Tier names Starter/Pro/Business are brand proper nouns and stay
  untranslated (same rule as NorthSign; REVIEW-NOTES §4 exemption list).
