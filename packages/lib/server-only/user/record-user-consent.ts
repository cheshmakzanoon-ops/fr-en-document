import { prisma } from '@documenso/prisma';

import { PRIVACY_VERSION, TERMS_VERSION } from '../../constants/brand';
import type { RequestMetadata } from '../../universal/extract-request-metadata';

export type ConsentRecordType = 'TERMS_AND_PRIVACY' | 'MARKETING_EMAIL';

export type RecordUserConsentOptions = {
  userId: number;
  type: ConsentRecordType;
  /**
   * For TERMS_AND_PRIVACY: the TERMS_VERSION / PRIVACY_VERSION accepted
   * (defaults to the current constants). For MARKETING_EMAIL: '1'.
   */
  documentVersion?: string;
  /** Machine-readable capture source, e.g. 'signup' or 'signup-marketing-optin'. */
  source: string;
  requestMetadata?: RequestMetadata;
};

/**
 * Appends an immutable consent record (PIPEDA cl. 4.3 / Law 25 s. 8.1).
 * Rows are never updated — a new acceptance appends a new row.
 */
export const recordUserConsent = async ({
  userId,
  type,
  documentVersion,
  source,
  requestMetadata,
}: RecordUserConsentOptions) => {
  const version = documentVersion ?? (type === 'TERMS_AND_PRIVACY' ? `${TERMS_VERSION}+${PRIVACY_VERSION}` : '1');

  return await prisma.userConsentRecord.create({
    data: {
      userId,
      type,
      documentVersion: version,
      source,
      acceptedAt: new Date(),
      ipAddress: requestMetadata?.ipAddress ?? null,
      userAgent: requestMetadata?.userAgent ?? null,
    },
  });
};
