import { prisma } from '@documenso/prisma';

import { APP_NAME } from '../../constants/brand';
import { AppError, AppErrorCode } from '../../errors/app-error';

export type ExportUserDataResult = {
  exportedAt: string;
  product: string;
  profile: Record<string, unknown>;
  organisations: Record<string, unknown>[];
  consents: Record<string, unknown>[];
  securityLogs: Record<string, unknown>[];
  /** Document envelopes owned by the user, with recipients + audit summaries. */
  documents: Record<string, unknown>[];
};

/**
 * Builds a machine-readable (JSON) export of the personal information we hold
 * about a user — PIPEDA cl. 4.9 access right and Law 25 s. 17 portability.
 *
 * Scope (grounded in COMPLIANCE.md §1): profile fields, organisation
 * memberships, consent records, security audit logs, and documents the user
 * owns (metadata + recipients; the PDF binaries themselves remain
 * downloadable from the app since they may be large and are legal records).
 */
export const exportUserData = async ({ userId }: { userId: number }): Promise<ExportUserDataResult> => {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
    },
    include: {
      organisationMember: {
        include: {
          organisation: {
            select: {
              id: true,
              name: true,
              url: true,
              type: true,
            },
          },
        },
      },
      consentRecords: true,
      securityAuditLogs: {
        select: {
          type: true,
          createdAt: true,
          ipAddress: true,
          userAgent: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 500,
      },
      envelopes: {
        where: {
          type: 'DOCUMENT',
        },
        select: {
          id: true,
          secondaryId: true,
          title: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          completedAt: true,
          deletedAt: true,
          recipients: {
            select: {
              email: true,
              name: true,
              role: true,
              signingStatus: true,
              signedAt: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  });

  if (!user) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: `User with ID ${userId} not found`,
    });
  }

  return {
    exportedAt: new Date().toISOString(),
    product: APP_NAME,
    profile: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      signature: user.signature,
      createdAt: user.createdAt,
      lastSignedIn: user.lastSignedIn,
      identityProvider: user.identityProvider,
      twoFactorEnabled: user.twoFactorEnabled,
    },
    organisations: user.organisationMember.map((member) => ({
      id: member.organisation.id,
      name: member.organisation.name,
      url: member.organisation.url,
      type: member.organisation.type,
    })),
    consents: user.consentRecords.map((consent) => ({
      type: consent.type,
      documentVersion: consent.documentVersion,
      source: consent.source,
      acceptedAt: consent.acceptedAt,
    })),
    securityLogs: user.securityAuditLogs,
    documents: user.envelopes,
  };
};
