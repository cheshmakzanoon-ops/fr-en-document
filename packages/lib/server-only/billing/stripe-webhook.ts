import { AppError, AppErrorCode } from '../../errors/app-error';

/**
 * Stripe webhook request handler — signature verification + event dispatch.
 *
 * Full implementation lands in Phase 6 Step 3 (checkout.session.completed,
 * customer.subscription.updated, customer.subscription.deleted,
 * invoice.payment_failed, invoice.paid). This stub exists so the billing
 * seam compiles from Step 2 onward and is replaced before the branch ships.
 */
export const handleStripeWebhookRequest = (_request: Request): Promise<Response> => {
  return Promise.reject(
    new AppError(AppErrorCode.NOT_IMPLEMENTED, {
      message: 'Stripe webhook handling is implemented in Phase 6 Step 3',
    }),
  );
};
