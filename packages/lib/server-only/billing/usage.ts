import { prisma } from '@documenso/prisma';
import type { Prisma } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { getEntitlement } from './entitlements';
import { findSubscriptionByOrganisationId } from './subscription-store';

/**
 * Entitlement enforcement for sender actions (Phase 6, D-032/BILLING.md §5).
 *
 * Only sender actions are ever gated here — recipient signing is never
 * blocked. The send path calls `assertAndRecordEnvelopeSend` inside the same
 * transaction that flips DRAFT → PENDING, after taking a row lock on the
 * organisation, so concurrent sends cannot overshoot the Starter cap. The
 * `BillingUsageEvent` insert is exactly-once per envelope (`envelopeId`
 * unique), which makes retries idempotent.
 */

export const RECIPIENT_LIMIT_MAX_MESSAGE = 'You cannot send a document with more recipients than your plan allows.';

const isUniqueConstraintError = (err: unknown): boolean => {
  if (err instanceof Error && 'code' in err) {
    return (err as { code?: string }).code === 'P2002';
  }

  return false;
};

/**
 * Fail-fast recipient gate (no lock, no writes) used before the heavy send
 * work. The authoritative check runs again inside the send transaction.
 */
export const assertRecipientLimitForOrganisation = async ({
  organisationId,
  recipientCount,
}: {
  organisationId: string;
  recipientCount: number;
}): Promise<void> => {
  const subscription = await findSubscriptionByOrganisationId(organisationId);

  const entitlement = getEntitlement(subscription);

  if (entitlement.recipientsPerDocument !== null && recipientCount > entitlement.recipientsPerDocument) {
    throw new AppError(AppErrorCode.RECIPIENT_LIMIT_EXCEEDED, {
      message: `You cannot send a document with more than ${entitlement.recipientsPerDocument} recipients`,
      statusCode: 400,
    });
  }
};

/**
 * Insert the exactly-once usage journal entry for a first-sent envelope.
 * `envelopeId` unique makes replays/concurrent retries converge to one row.
 */
const insertUsageEvent = async (
  txOrClient: Prisma.TransactionClient | typeof prisma,
  {
    organisationId,
    envelopeId,
    sentAt,
  }: {
    organisationId: string;
    envelopeId: string;
    sentAt: Date;
  },
): Promise<void> => {
  try {
    await txOrClient.billingUsageEvent.create({
      data: {
        organisationId,
        envelopeId,
        sentAt,
      },
    });
  } catch (err) {
    // Same envelope re-counted (concurrent/retried send): the journal's
    // envelopeId uniqueness already counted it once — that is the correct
    // outcome, so this is not an error.
    if (!isUniqueConstraintError(err)) {
      throw err;
    }
  }
};

/**
 * Authoritative send gate + exactly-once accounting. Runs inside the send
 * transaction on the `tx` client — a blocked send aborts the whole
 * transaction (status stays DRAFT, no emails, no count).
 */
export const assertAndRecordEnvelopeSend = async (
  tx: Prisma.TransactionClient,
  {
    organisationId,
    envelopeId,
    recipientCount,
    sentAt = new Date(),
  }: {
    organisationId: string;
    envelopeId: string;
    recipientCount: number;
    sentAt?: Date;
  },
): Promise<void> => {
  // Serialize concurrent sends per organisation so the count check and the
  // event insert cannot race past the plan allowance.
  await tx.$queryRaw`SELECT id FROM "Organisation" WHERE id = ${organisationId} FOR UPDATE`;

  const subscription = await tx.subscription.findUnique({
    where: {
      organisationId,
    },
  });

  const entitlement = getEntitlement(subscription, sentAt);

  if (entitlement.recipientsPerDocument !== null && recipientCount > entitlement.recipientsPerDocument) {
    throw new AppError(AppErrorCode.RECIPIENT_LIMIT_EXCEEDED, {
      message: `You cannot send a document with more than ${entitlement.recipientsPerDocument} recipients`,
      statusCode: 400,
    });
  }

  if (entitlement.documentsPerPeriod !== null) {
    const sentThisPeriod = await tx.billingUsageEvent.count({
      where: {
        organisationId,
        sentAt: {
          gte: entitlement.periodStart,
        },
      },
    });

    if (sentThisPeriod >= entitlement.documentsPerPeriod) {
      throw new AppError(AppErrorCode.DOCUMENT_SEND_LIMIT_REACHED, {
        message: `You have reached your plan's limit of ${entitlement.documentsPerPeriod} documents sent per billing period`,
        statusCode: 402,
      });
    }
  }

  await insertUsageEvent(tx, { organisationId, envelopeId, sentAt });
};

/**
 * Record a send without enforcing the plan cap. Used by recipient-initiated
 * sends (direct-link templates create the document directly in PENDING):
 * those are never blocked by the sender's allowance, but they still count
 * toward the usage display (BILLING.md §5, "never block a recipient").
 */
export const recordEnvelopeSendEvent = async (
  txOrClient: Prisma.TransactionClient | typeof prisma,
  {
    organisationId,
    envelopeId,
    sentAt = new Date(),
  }: {
    organisationId: string;
    envelopeId: string;
    sentAt?: Date;
  },
): Promise<void> => {
  await insertUsageEvent(txOrClient, { organisationId, envelopeId, sentAt });
};

/**
 * Gate a sender action that requires a paid plan feature (templates, API).
 */
export const assertOrganisationAllowsFeature = async ({
  organisationId,
  feature,
}: {
  organisationId: string;
  feature: 'templates' | 'api';
}): Promise<void> => {
  const subscription = await findSubscriptionByOrganisationId(organisationId);

  const entitlement = getEntitlement(subscription);

  const allowed = feature === 'templates' ? entitlement.allowsTemplates : entitlement.allowsApi;

  if (!allowed) {
    throw new AppError(AppErrorCode.PLAN_FEATURE_REQUIRED, {
      message: `Your plan does not include ${feature} access. Upgrade to Pro to unlock it.`,
      statusCode: 403,
    });
  }
};

/**
 * Count documents sent by an organisation since a given instant (usage
 * display on the billing page; read-only, no locking).
 */
export const countDocumentsSentByOrganisationSince = async ({
  organisationId,
  since,
}: {
  organisationId: string;
  since: Date;
}): Promise<number> => {
  return await prisma.billingUsageEvent.count({
    where: {
      organisationId,
      sentAt: {
        gte: since,
      },
    },
  });
};
