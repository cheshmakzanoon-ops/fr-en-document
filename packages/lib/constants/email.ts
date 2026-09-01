import { env } from '../utils/env';
import { EMAIL_FROM_ADDRESS, EMAIL_FROM_NAME } from './brand';

export const FROM_ADDRESS = env('NEXT_PRIVATE_SMTP_FROM_ADDRESS') || EMAIL_FROM_ADDRESS;
export const FROM_NAME = env('NEXT_PRIVATE_SMTP_FROM_NAME') || EMAIL_FROM_NAME;

export const DOCUMENSO_INTERNAL_EMAIL = {
  name: FROM_NAME,
  address: FROM_ADDRESS,
};

export const EMAIL_VERIFICATION_STATE = {
  NOT_FOUND: 'NOT_FOUND',
  VERIFIED: 'VERIFIED',
  EXPIRED: 'EXPIRED',
  ALREADY_VERIFIED: 'ALREADY_VERIFIED',
} as const;

export const USER_SIGNUP_VERIFICATION_TOKEN_IDENTIFIER = 'confirmation-email';
