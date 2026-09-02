import { formatPath } from '@documenso/lib/constants/app';
import { SUPPORTED_LANGUAGES } from '@documenso/lib/constants/i18n';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { CheckIcon, LanguagesIcon } from 'lucide-react';

export type LanguageSwitcherProps = {
  className?: string;
};

/**
 * Compact language switcher for headers/footers (Phase 4, D-022).
 *
 * Persists the choice in the `lang` cookie via `/api/locale`, then reloads the
 * page so server-rendered content is re-rendered in the selected language.
 */
export const LanguageSwitcher = ({ className }: LanguageSwitcherProps) => {
  const { i18n, _ } = useLingui();

  const setLanguage = async (lang: string) => {
    const currentUrl = new URL(window.location.href);

    // The `?lang=` query param is an explicit override that would beat the
    // cookie on reload; strip it so the cookie choice wins for the session.
    currentUrl.searchParams.delete('lang');

    const formData = new FormData();

    formData.append('lang', lang);

    await fetch(formatPath('/api/locale'), {
      method: 'post',
      body: formData,
    });

    window.location.assign(currentUrl.pathname + currentUrl.search);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={cn('gap-2', className)} aria-label={_(msg`Change language`)}>
          <LanguagesIcon className="h-4 w-4" />
          <span className="font-semibold text-xs uppercase">{i18n.locale}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        {Object.values(SUPPORTED_LANGUAGES).map((language) => (
          <DropdownMenuItem key={language.short} onSelect={() => void setLanguage(language.short)}>
            <CheckIcon className={cn('mr-2 h-4 w-4', i18n.locale === language.short ? 'opacity-100' : 'opacity-0')} />
            {_(language.full)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
