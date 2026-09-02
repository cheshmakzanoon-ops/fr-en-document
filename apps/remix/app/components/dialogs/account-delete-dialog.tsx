import { authClient } from '@documenso/auth/client';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { APP_NAME } from '@documenso/lib/constants/brand';
import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useState } from 'react';

export type AccountDeleteDialogProps = {
  className?: string;
};

export const AccountDeleteDialog = ({ className }: AccountDeleteDialogProps) => {
  const { user } = useSession();

  const { _ } = useLingui();
  const { toast } = useToast();

  const hasTwoFactorAuthentication = user.twoFactorEnabled;

  const [enteredEmail, setEnteredEmail] = useState<string>('');

  const { mutateAsync: deleteAccount, isPending: isDeletingAccount } = trpc.profile.deleteAccount.useMutation();

  const onDeleteAccount = async () => {
    try {
      await deleteAccount();

      toast({
        title: _(msg`Account deleted`),
        description: _(msg`Your account has been deleted successfully.`),
        duration: 5000,
      });

      return await authClient.signOut();
    } catch (err) {
      toast({
        title: _(msg`An unknown error occurred`),
        variant: 'destructive',
        description: _(
          msg`We encountered an unknown error while attempting to delete your account. Please try again later.`,
        ),
      });
    }
  };

  return (
    <div className={className}>
      <Alert className="flex flex-col items-center justify-between gap-4 p-6 md:flex-row" variant="neutral">
        <div>
          <AlertTitle>
            <Trans>Delete Account</Trans>
          </AlertTitle>
          <AlertDescription className="mr-2">
            <Trans>
              Delete your account. Documents you own that other parties rely on are kept as legal records (moved to a
              restricted service account); drafts and templates are removed. This action is irreversible and will cancel
              your subscription, so proceed with caution.
            </Trans>
          </AlertDescription>
        </div>

        <div className="flex-shrink-0">
          <Dialog onOpenChange={() => setEnteredEmail('')}>
            <DialogTrigger asChild>
              <Button variant="destructive">
                <Trans>Delete Account</Trans>
              </Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader className="space-y-4">
                <DialogTitle>
                  <Trans>Delete Account</Trans>
                </DialogTitle>

                <Alert variant="destructive">
                  <AlertDescription className="selection:bg-red-100">
                    <Trans>This action is not reversible. Please be certain.</Trans>
                  </AlertDescription>
                </Alert>

                {hasTwoFactorAuthentication && (
                  <Alert variant="destructive">
                    <AlertDescription className="selection:bg-red-100">
                      <Trans>Disable Two Factor Authentication before deleting your account.</Trans>
                    </AlertDescription>
                  </Alert>
                )}

                <DialogDescription>
                  <Trans>
                    {APP_NAME} will permanently delete your{' '}
                    <span className="font-semibold">draft documents and templates</span>, along with your sessions, API
                    tokens, and other account resources. Documents you sent for signature — including completed ones —
                    are <span className="font-semibold">not destroyed</span>: they are transferred to a restricted
                    service account and retained as legal records that co-signers may rely on. Consider downloading your
                    data export first.
                  </Trans>
                </DialogDescription>
              </DialogHeader>

              {!hasTwoFactorAuthentication && (
                <div>
                  <Label>
                    <Trans>
                      Please type <span className="font-semibold text-muted-foreground">{user.email}</span> to confirm.
                    </Trans>
                  </Label>

                  <Input
                    type="text"
                    className="mt-2"
                    aria-label={_(msg`Confirm Email`)}
                    value={enteredEmail}
                    onChange={(e) => setEnteredEmail(e.target.value)}
                  />
                </div>
              )}
              <DialogFooter>
                <Button
                  onClick={onDeleteAccount}
                  loading={isDeletingAccount}
                  variant="destructive"
                  disabled={hasTwoFactorAuthentication || enteredEmail !== user.email}
                >
                  {isDeletingAccount ? _(msg`Deleting account...`) : _(msg`Confirm Deletion`)}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </Alert>
    </div>
  );
};
