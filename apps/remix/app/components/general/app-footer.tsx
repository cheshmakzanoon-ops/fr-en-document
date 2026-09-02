import { APP_NAME } from '@documenso/lib/constants/brand';
import { LanguageSwitcher } from '@documenso/ui/components/common/language-switcher';
import { cn } from '@documenso/ui/lib/utils';
import { Trans } from '@lingui/react/macro';

export type AppFooterProps = {
  className?: string;
};

export const AppFooter = ({ className }: AppFooterProps) => {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className={cn(
        'flex w-full flex-col items-center justify-between gap-4 border-border/60 border-t px-4 py-6 md:flex-row md:px-8',
        className,
      )}
    >
      <p className="order-2 text-muted-foreground text-sm md:order-1">
        © {currentYear} {APP_NAME}. <Trans>All rights reserved.</Trans>
      </p>

      <div className="order-1 md:order-2">
        <LanguageSwitcher />
      </div>
    </footer>
  );
};
