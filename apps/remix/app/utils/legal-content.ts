/**
 * Legal page content for /terms and /privacy — Phase 5, Step 2.
 *
 * Grounded in COMPLIANCE.md (Step 1 inventory): every factual claim here
 * matches actual product behavior. The residency sentence is DATA_RESIDENCY_CLAIM
 * verbatim from DEPLOYMENT.md §1.
 *
 * RULE: these are draft compliance materials, not legal advice. Every page
 * renders a visible DRAFT / lawyer-review banner (see routes/privacy.tsx and
 * routes/terms.tsx). The banner is a launch gate recorded in PHASES.md.
 *
 * EN and fr-CA content are maintained side by side here so both locales can
 * never drift structurally. New fr-CA legal strings are authored here directly
 * (not via Lingui msgids) — logged in REVIEW-NOTES.md (Phase 5).
 */

import {
  APP_NAME,
  DATA_RESIDENCY_CLAIM,
  EMAIL_FROM_ADDRESS,
  PRIVACY_EMAIL_ADDRESS,
  SUPPORT_EMAIL_ADDRESS,
  TERMS_VERSION,
} from '@documenso/lib/constants/brand';

export type LegalSection = {
  heading: string;
  /** Paragraphs; blank entries render an implicit spacer. */
  body: string[];
};

export type LegalContent = {
  title: string;
  version: string;
  lastUpdated: string;
  sections: LegalSection[];
};

const DRAFT_BANNER_EN = 'DRAFT — requires review by a Canadian lawyer before public launch.';

const DRAFT_BANNER_FR = 'ÉBAUCHE — doit être révisée par un(e) avocat(e) canadien(ne) avant le lancement public.';

export { DRAFT_BANNER_EN, DRAFT_BANNER_FR };

const effectiveDate = '2026-09-02';

// ---------------------------------------------------------------------------
// PRIVACY POLICY
// ---------------------------------------------------------------------------

export const PRIVACY_EN: LegalContent = {
  title: 'Privacy Policy',
  version: '1.0-draft',
  lastUpdated: effectiveDate,
  sections: [
    {
      heading: '1. Who we are and how to reach us',
      body: [
        `${APP_NAME} is a Canadian-hosted electronic signature service operated from Canada. This policy explains what personal information we collect, why, where it is kept, and the rights you can exercise.`,
        `You are the privacy officer of record unless otherwise designated: requests, complaints, and questions go to ${PRIVACY_EMAIL_ADDRESS}. General support is at ${SUPPORT_EMAIL_ADDRESS}.`,
      ],
    },
    {
      heading: '2. What we collect and why',
      body: [
        'Account holders: name, email address, password (stored only as a bcrypt hash), optional signature image and avatar, two-factor secret and backup codes, and — if you use single sign-on — identity-provider account tokens. We use these to create and secure your account, show your identity on documents, and send service notifications.',
        'Document participants (recipients, who usually do not have an account): email address and name, provided by the document sender so we can deliver the signing invitation; your signature (typed, drawn, or uploaded) and any field values (dates, text, choices) you enter; and the technical evidence of your interaction — timestamps, open/signed status, and, for document events, your IP address and browser user-agent. This evidence forms the audit trail (piste d’audit) that makes an electronic signature verifiable; it is disclosed to you on the signing certificate and it is the core purpose of the service. If you do not want your interaction recorded, do not sign electronically.',
        'Service data: security audit logs for account events (sign-ins, password changes, session revocations) with IP address and user-agent; rate-limiting counters; and background-job records needed to deliver emails reliably.',
        'Marketing: we send no marketing email today. The only marketing consent we hold is what you give us (see the signup opt-in), stored with its source and timestamp. Transactional and signing emails — invitations, reminders, completion notices, security alerts — are not marketing and are not gated on that consent; they are sent on the basis of legitimate operational need and, for recipients, at the instruction of the document sender.',
      ],
    },
    {
      heading: '3. Data residency',
      body: [
        DATA_RESIDENCY_CLAIM,
        'That claim covers data at rest (database, document files, backups) and document processing (signing, certificates, audit logs, conversions). It does not cover data in transit or the third-party processors in section 4 — where a processor operates outside Canada, we say so below.',
      ],
    },
    {
      heading: '4. Processors and sub-processors',
      body: [
        'We disclose every processor the product touches. Today:',
        '• Amazon Web Services — EC2 (application), S3 (documents and backups), and SES (outbound transactional email), all in ca-central-1 (Montreal).',
        '• Support helpdesk (Plain) and product analytics (PostHog) and CAPTCHA (Cloudflare Turnstile) — activated only if and when configured for production; each processes the minimum described in section 2 and any of them operating outside Canada will be disclosed here before use.',
        '• Customer-configured SMTP relays — if a sender connects their own email transport, message delivery is governed by their configuration.',
        '• Planned at Phase 6 (billing): Stripe. We will update this section before any payment processing goes live.',
        'Transactional emails are sent from ' +
          EMAIL_FROM_ADDRESS +
          '. Webhooks you configure receive document events and recipient details at URLs you control — that transfer is your instruction, not ours.',
      ],
    },
    {
      heading: '5. Retention',
      body: [
        'Signed documents and their audit trails are legal records and are retained while needed for evidentiary purposes, even if the sender’s account is deleted — in that case they are moved to a restricted service account rather than destroyed. Drafts of deleted accounts are removed. Account security logs, rate-limit records, and backups follow the retention schedule published in RETENTION.md, which is the authoritative cross-referenced schedule for this section.',
      ],
    },
    {
      heading: '6. Your rights',
      body: [
        'Under PIPEDA and, if you are in Québec, under Law 25, you may: request access to the personal information we hold about you; request rectification of inaccurate information; request portability — a structured, machine-readable export of information you provided to us; request de-indexing or de-referencing of information that is publicly available through our service, where such an index exists; and withdraw consent to optional processing (such as marketing email) at any time.',
        'Recipients of documents can exercise these rights over their signature, field values, and audit-trail entries even without an account.',
      ],
    },
    {
      heading: '7. Confidentiality incidents',
      body: [
        'We maintain a confidentiality-incident register. Any incident involving personal information is logged, assessed, and — where there is a risk of serious harm — reported to the Commission d’accès à l’information (Québec) and, where required, to the Office of the Privacy Commissioner of Canada, and to affected individuals. Clocks, thresholds, and roles are defined in INCIDENT-RESPONSE.md.',
      ],
    },
    {
      heading: '8. How to make a request',
      body: [
        `Email ${PRIVACY_EMAIL_ADDRESS} from the address concerned (or include enough information for us to verify your identity). We respond within 30 days. We may ask for additional verification before releasing information. If you are not satisfied with our response, you may contact the Office of the Privacy Commissioner of Canada or, in Québec, the Commission d’accès à l’information.`,
      ],
    },
    {
      heading: '9. Cookies',
      body: [
        'We use strictly necessary cookies only: session/authentication, your language choice, theme preference, and current workspace. No advertising or cross-site tracking cookies are set, so no cookie-consent banner is shown. Details are in section 5 of COMPLIANCE.md.',
      ],
    },
    {
      heading: '10. Changes to this policy',
      body: [
        'Material changes are announced in the app and by email to account holders. The version and date appear at the bottom of this page. Continuing to use the service after a change takes effect means you accept the updated policy.',
      ],
    },
  ],
};

export const PRIVACY_FR: LegalContent = {
  title: 'Politique de confidentialité',
  version: '1.0-draft',
  lastUpdated: effectiveDate,
  sections: [
    {
      heading: '1. Qui nous sommes et comment nous joindre',
      body: [
        `${APP_NAME} est un service canadien de signature électronique hébergé au Canada. La présente politique explique les renseignements personnels que nous recueillons, à quelles fins, où ils sont conservés et les droits que vous pouvez exercer.`,
        `Vous êtes la personne responsable de la protection des renseignements personnels, à moins d’une désignation contraire : les demandes, plaintes et questions se font à ${PRIVACY_EMAIL_ADDRESS}. Le soutien général est à ${SUPPORT_EMAIL_ADDRESS}.`,
      ],
    },
    {
      heading: '2. Ce que nous recueillons et pourquoi',
      body: [
        'Titulaires de compte : nom, adresse courriel, mot de passe (conservé uniquement sous forme de hachage bcrypt), image de signature et avatar facultatifs, secret d’authentification à deux facteurs et codes de secours, et — si vous utilisez la connexion unique — les jetons de votre fournisseur d’identité. Ces données servent à créer et sécuriser votre compte, à afficher votre identité sur les documents et à envoyer les avis de service.',
        'Participants à un document (destinataires, qui n’ont généralement pas de compte) : adresse courriel et nom, fournis par l’expéditeur du document pour livrer l’invitation à signer; votre signature (tapée, tracée ou téléversée) et les valeurs de champs que vous saisissez (dates, textes, choix); ainsi que les preuves techniques de votre interaction — horodatages, statut d’ouverture et de signature et, pour les événements liés au document, votre adresse IP et votre agent utilisateur. Ces preuves forment la piste d’audit qui rend une signature électronique vérifiable; elles vous sont divulguées sur le certificat de signature et constituent la finalité même du service. Si vous ne souhaitez pas que votre interaction soit consignée, ne signez pas électroniquement.',
        'Données de service : journaux de sécurité des événements de compte (connexions, changements de mot de passe, révocations de session) avec adresse IP et agent utilisateur; compteurs de limitation de débit; et enregistrements des tâches d’arrière-plan nécessaires à la livraison fiable des courriels.',
        'Marketing : nous n’envoyons aucun courriel marketing à l’heure actuelle. Le seul consentement marketing que nous détenons est celui que vous nous accordez (voir la case d’adhésion à l’inscription), conservé avec sa source et son horodatage. Les courriels transactionnels et de signature — invitations, rappels, avis de complétion, alertes de sécurité — ne sont pas du marketing et ne dépendent pas de ce consentement; ils sont envoyés sur la base d’un besoin opérationnel légitime et, pour les destinataires, sur instruction de l’expéditeur du document.',
      ],
    },
    {
      heading: '3. Résidence des données',
      body: [
        DATA_RESIDENCY_CLAIM.replace(
          'NorthSign keeps data at rest and document processing in AWS ca-central-1, Montreal.',
          'NorthSign conserve les données au repos et le traitement des documents dans AWS ca-central-1, Montréal.',
        ),
        'Cette affirmation couvre les données au repos (base de données, fichiers de documents, sauvegardes) et le traitement des documents (signature, certificats, pistes d’audit, conversions). Elle ne couvre pas les données en transit ni les processeurs tiers de la section 4 — lorsqu’un processeur opère à l’extérieur du Canada, nous l’indiquons ci-dessous.',
      ],
    },
    {
      heading: '4. Processeurs et sous-traitants',
      body: [
        'Nous divulguons chaque processeur utilisé par le produit. À ce jour :',
        '• Amazon Web Services — EC2 (application), S3 (documents et sauvegardes) et SES (courriels transactionnels sortants), tous en ca-central-1 (Montréal).',
        '• Aide au soutien (Plain), analyses de produit (PostHog) et CAPTCHA (Cloudflare Turnstile) — activés seulement si et lorsqu’ils sont configurés pour la production; chacun traite le minimum décrit à la section 2 et tout usage à l’extérieur du Canada sera divulgué ici avant utilisation.',
        '• Relais SMTP configurés par le client — si un expéditeur connecte son propre transport de courriel, la livraison est régie par sa configuration.',
        '• Prévu à la phase 6 (facturation) : Stripe. Cette section sera mise à jour avant tout traitement de paiement.',
        'Les courriels transactionnels sont envoyés depuis ' +
          EMAIL_FROM_ADDRESS +
          '. Les webhooks que vous configurez reçoivent des événements de document et des détails de destinataires à des URL que vous contrôlez — ce transfert découle de votre instruction, non de la nôtre.',
      ],
    },
    {
      heading: '5. Conservation',
      body: [
        'Les documents signés et leurs pistes d’audit sont des documents juridiques et sont conservés aussi longtemps que nécessaire à des fins probatoires, même si le compte de l’expéditeur est supprimé — dans ce cas ils sont transférés à un compte de service restreint plutôt que détruits. Les brouillons des comptes supprimés sont retirés. Les journaux de sécurité, compteurs de limitation de débit et sauvegardes suivent l’échéancier de conservation publié dans RETENTION.md, qui est l’échéancier faisant foi pour cette section.',
      ],
    },
    {
      heading: '6. Vos droits',
      body: [
        'En vertu de la LPRPDE et, si vous êtes au Québec, de la Loi 25, vous pouvez : demander l’accès aux renseignements personnels que nous détenons à votre sujet; demander la rectification de renseignements inexacts; demander la portabilité — un export structuré, lisible par machine, des renseignements que vous nous avez fournis; demander la désindexation ou la déréférencation de renseignements accessibles publiquement par notre service, lorsqu’un tel index existe; et retirer votre consentement à tout traitement facultatif (comme les courriels marketing) en tout temps.',
        'Les destinataires de documents peuvent exercer ces droits sur leur signature, les valeurs de champs et les entrées de la piste d’audit, même sans compte.',
      ],
    },
    {
      heading: '7. Incidents de confidentialité',
      body: [
        'Nous tenons un registre des incidents de confidentialité. Tout incident impliquant des renseignements personnels est consigné, évalué et — lorsqu’il existe un risque de préjudice sérieux — déclaré à la Commission d’accès à l’information (Québec) et, au besoin, au Commissariat à la protection de la vie privée du Canada, ainsi qu’aux personnes touchées. Les délais, seuils et rôles sont définis dans INCIDENT-RESPONSE.md.',
      ],
    },
    {
      heading: '8. Comment présenter une demande',
      body: [
        `Écrivez à ${PRIVACY_EMAIL_ADDRESS} depuis l’adresse concernée (ou incluez suffisamment d’informations pour que nous puissions vérifier votre identité). Nous répondons dans les 30 jours. Nous pouvons exiger une vérification supplémentaire avant de communiquer des renseignements. Si vous n’êtes pas satisfait de notre réponse, vous pouvez communiquer avec le Commissariat à la protection de la vie privée du Canada ou, au Québec, avec la Commission d’accès à l’information.`,
      ],
    },
    {
      heading: '9. Témoins (cookies)',
      body: [
        'Nous utilisons uniquement des témoins strictement nécessaires : session/authentification, choix de langue, préférence de thème et espace de travail courant. Aucun témoin publicitaire ou de pistage intersites n’est déposé; aucune bannière de consentement aux témoins n’est donc affichée. Les détails figurent à la section 5 de COMPLIANCE.md.',
      ],
    },
    {
      heading: '10. Modifications de cette politique',
      body: [
        'Les modifications importantes sont annoncées dans l’application et par courriel aux titulaires de compte. La version et la date figurent au bas de cette page. Le fait de continuer à utiliser le service après l’entrée en vigeur d’une modification vaut acceptation de la politique mise à jour.',
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// TERMS OF SERVICE
// ---------------------------------------------------------------------------

export const TERMS_EN: LegalContent = {
  title: 'Terms of Service',
  version: TERMS_VERSION,
  lastUpdated: effectiveDate,
  sections: [
    {
      heading: '1. Agreement',
      body: [
        `These Terms govern your use of ${APP_NAME}, a Canadian-hosted electronic signature service. By creating an account or using the service, you agree to these Terms and to the Privacy Policy. If you use the service on behalf of an organisation, you confirm you are authorized to bind that organisation.`,
      ],
    },
    {
      heading: '2. Accounts',
      body: [
        'You are responsible for your account credentials, for keeping your email address current, and for activity under your account. Accounts created by an organisation administrator for you remain subject to that organisation’s administration. We may suspend accounts that breach these Terms or that we are legally required to suspend.',
        'You may delete your account at any time from your account settings. Deleting your account does not destroy documents that other parties rely on — see section 9.',
      ],
    },
    {
      heading: '3. Electronic signatures',
      body: [
        'The service produces electronic signatures and an audit trail (certificate) for each document. Electronic signature law varies by jurisdiction and by document type (for example, wills and certain government forms may require wet-ink signatures). We do not provide legal advice and make no guarantee that any particular signature satisfies the law of your situation; you are responsible for determining that an electronic signature is valid for your document.',
      ],
    },
    {
      heading: '4. Acceptable use',
      body: [
        'Do not use the service to send unlawful content, to mislead signers about what they are signing, to impersonate others, to probe or disrupt the service, or to resell access without a written agreement. We may remove content and suspend accounts for violations.',
      ],
    },
    {
      heading: '5. Your documents',
      body: [
        'You keep all rights to the documents and content you upload or create. You grant us only the limited right to store, process, and transmit them to provide the service (rendering, signing, certificates, email delivery). Recipients retain rights over the signatures and information they contribute.',
      ],
    },
    {
      heading: '6. Service availability and changes',
      body: [
        'We aim for high availability but the service is provided without an uptime warranty. We may modify or discontinue features; material adverse changes to paid plans will be announced in advance. Scheduled maintenance is announced in the app where practical.',
      ],
    },
    {
      heading: '7. Fees',
      body: [
        'The service currently has no paid plans. When billing is introduced (Phase 6), paid features, prices, and renewal and cancellation terms will be stated at the point of sale and in these Terms before any charge occurs.',
      ],
    },
    {
      heading: '8. Security and data residency',
      body: [
        DATA_RESIDENCY_CLAIM,
        'We apply administrative and technical safeguards described in the Privacy Policy, including encryption in transit, hashed passwords, optional two-factor authentication, and versioned document storage with backups. No method of storage or transmission is perfectly secure; report suspected vulnerabilities to ' +
          SUPPORT_EMAIL_ADDRESS +
          '.',
      ],
    },
    {
      heading: '9. Termination and what happens to documents',
      body: [
        'When you delete your account: documents you own that are pending or completed — and that other parties rely on — are transferred to a restricted internal service account and retained as legal records; they are hidden from the interface but remain verifiable. Draft documents and templates are deleted. Documents in teams owned by others are transferred to the owner of that team. Details are defined in DECISIONS.md (D-026) and RETENTION.md.',
      ],
    },
    {
      heading: '10. Disclaimers and limitation of liability',
      body: [
        'The service is provided “as is” and “as available” without warranties of any kind, except those that cannot be excluded by law. To the maximum extent permitted by applicable law, our aggregate liability arising from the service is limited to the greater of CAD 100 or the fees you paid us in the 12 months before the claim. Nothing in these Terms limits liability for our gross negligence or intentional misconduct, or for personal-information handling obligations that cannot be contractually limited.',
      ],
    },
    {
      heading: '11. Governing law',
      body: [
        'These Terms are governed by the laws applicable in the Province of Québec and the federal laws of Canada applicable therein, without regard to conflict-of-law rules. The courts of Québec have exclusive jurisdiction over disputes arising from these Terms.',
      ],
    },
    {
      heading: '12. Language',
      body: [
        'The parties confirm their express wish that these Terms be drawn up in English. Les parties confirment leur volonté expresse que les présentes conditions soient rédigées en langue anglaise. A French version is provided for convenience; in case of conflict between versions, the English version governs unless a French-language agreement with you states otherwise.',
      ],
    },
    {
      heading: '13. Contact and changes',
      body: [
        `Questions about these Terms: ${SUPPORT_EMAIL_ADDRESS}. We may update these Terms; material changes are announced in the app and by email to account holders before taking effect.`,
      ],
    },
  ],
};

export const TERMS_FR: LegalContent = {
  title: 'Conditions d’utilisation',
  version: TERMS_VERSION,
  lastUpdated: effectiveDate,
  sections: [
    {
      heading: '1. Entente',
      body: [
        `Les présentes conditions régissent votre utilisation de ${APP_NAME}, un service canadien de signature électronique hébergé au Canada. En créant un compte ou en utilisant le service, vous acceptez les présentes conditions et la Politique de confidentialité. Si vous utilisez le service pour le compte d’une organisation, vous confirmez être autorisé à engager cette organisation.`,
      ],
    },
    {
      heading: '2. Comptes',
      body: [
        'Vous êtes responsable de vos identifiants, du maintien de votre adresse courriel à jour et de l’activité réalisée sous votre compte. Les comptes créés pour vous par un administrateur d’organisation demeurent soumis à l’administration de cette organisation. Nous pouvons suspendre les comptes qui enfreignent les présentes conditions ou lorsque la loi nous l’exige.',
        'Vous pouvez supprimer votre compte en tout temps dans les paramètres de votre compte. La suppression de votre compte ne détruit pas les documents dont d’autres parties dépendent — voir la section 9.',
      ],
    },
    {
      heading: '3. Signatures électroniques',
      body: [
        'Le service produit des signatures électroniques et une piste d’audit (certificat) pour chaque document. Le droit de la signature électronique varie selon la juridiction et le type de document (par exemple, les testaments et certains formulaires gouvernementaux peuvent exiger une signature manuscrite). Nous ne fournissons pas de conseil juridique et ne garantissons pas qu’une signature donnée satisfasse au droit applicable à votre situation; il vous appartient de déterminer si une signature électronique est valable pour votre document.',
      ],
    },
    {
      heading: '4. Utilisation acceptable',
      body: [
        'N’utilisez pas le service pour transmettre du contenu illicite, induire les signataires en erreur sur ce qu’ils signent, usurper l’identité d’autrui, sonder ou perturber le service, ou revendre l’accès sans entente écrite. Nous pouvons retirer du contenu et suspendre des comptes en cas de violation.',
      ],
    },
    {
      heading: '5. Vos documents',
      body: [
        'Vous conservez tous les droits sur les documents et contenus que vous téléversez ou créez. Vous ne nous accordez que le droit limité de les stocker, traiter et transmettre afin de fournir le service (rendu, signature, certificats, livraison des courriels). Les destinataires conservent les droits sur les signatures et renseignements qu’ils apportent.',
      ],
    },
    {
      heading: '6. Disponibilité et modifications du service',
      body: [
        'Nous visons une haute disponibilité, mais le service est fourni sans garantie de temps de fonctionnement. Nous pouvons modifier ou cesser des fonctions; les changements défavorables importants aux forfaits payants seront annoncés à l’avance. La maintenance planifiée est annoncée dans l’application lorsque c’est possible.',
      ],
    },
    {
      heading: '7. Frais',
      body: [
        'Le service n’a actuellement aucun forfait payant. Lorsque la facturation sera introduite (phase 6), les fonctions payantes, les prix ainsi que les conditions de renouvellement et d’annulation seront indiqués au point de vente et dans les présentes conditions avant toute facturation.',
      ],
    },
    {
      heading: '8. Sécurité et résidence des données',
      body: [
        'NorthSign conserve les données au repos et le traitement des documents dans AWS ca-central-1, Montréal.',
        'Nous appliquons des mesures de sauvegarde administratives et techniques décrites dans la Politique de confidentialité, notamment le chiffrement en transit, les mots de passe hachés, l’authentification à deux facteurs facultative et le stockage des documents avec versions et sauvegardes. Aucune méthode de stockage ou de transmission n’est parfaitement sûre; signalez toute vulnérabilité suspectée à ' +
          SUPPORT_EMAIL_ADDRESS +
          '.',
      ],
    },
    {
      heading: '9. Résiliation et sort des documents',
      body: [
        'Lorsque vous supprimez votre compte : les documents dont vous êtes propriétaire — en attente ou signés — et dont d’autres parties dépendent sont transférés à un compte de service interne restreint et conservés comme documents juridiques; ils sont masqués de l’interface mais demeurent vérifiables. Les brouillons et modèles sont supprimés. Les documents dans des équipes appartenant à d’autres sont transférés au propriétaire de cette équipe. Les détails sont définis dans DECISIONS.md (D-026) et RETENTION.md.',
      ],
    },
    {
      heading: '10. Exclusions et limite de responsabilité',
      body: [
        'Le service est fourni « tel quel » et « selon la disponibilité », sans garantie d’aucune sorte, sauf celles que la loi ne permet pas d’exclure. Dans la mesure maximale permise par la loi applicable, notre responsabilité totale découlant du service est limitée au plus élevé de 100 $ CA ou des frais que vous nous avez payés au cours des 12 mois précédant la réclamation. Rien dans les présentes conditions ne limite la responsabilité en cas de négligence grave ou de faute intentionnelle de notre part, ni les obligations en matière de renseignements personnels qui ne peuvent être limitées contractuellement.',
      ],
    },
    {
      heading: '11. Droit applicable',
      body: [
        'Les présentes conditions sont régies par les lois applicables dans la province de Québec et les lois fédérales du Canada qui s’y appliquent, sans égard aux règles de conflit de lois. Les tribunaux du Québec ont juridiction exclusive sur tout litige découlant des présentes conditions.',
      ],
    },
    {
      heading: '12. Langue',
      body: [
        'Les parties confirment leur volonté expresse que les présentes conditions soient rédigées en langue française. Une version anglaise est fournie à titre de commodité; en cas de conflit, la version française prévaut, à moins qu’une entente écrite en anglais conclue avec vous n’en décide autrement.',
      ],
    },
    {
      heading: '13. Contact et modifications',
      body: [
        `Questions sur les présentes conditions : ${SUPPORT_EMAIL_ADDRESS}. Nous pouvons mettre à jour les présentes conditions; les modifications importantes sont annoncées dans l’application et par courriel aux titulaires de compte avant leur entrée en vigueur.`,
      ],
    },
  ],
};
