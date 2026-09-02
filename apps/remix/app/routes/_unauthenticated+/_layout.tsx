import backgroundPattern from '@documenso/assets/images/background-pattern.png';
import { LanguageSwitcher } from '@documenso/ui/components/common/language-switcher';
import { Outlet } from 'react-router';

import { AppFooter } from '~/components/general/app-footer';
import { BrandingLogo } from '~/components/general/branding-logo';

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-screen-xl items-center justify-between px-4 py-4 md:px-8">
        <BrandingLogo className="h-6 w-auto" />

        <LanguageSwitcher />
      </header>

      <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-12 md:p-12 lg:p-24">
        <div>
          <div className="absolute -inset-[min(600px,max(400px,60vw))] -z-[1] flex items-center justify-center opacity-70">
            <img
              src={backgroundPattern}
              alt="background pattern"
              className="dark:brightness-95 dark:contrast-[70%] dark:invert dark:sepia"
              style={{
                mask: 'radial-gradient(rgba(255, 255, 255, 1) 0%, transparent 80%)',
                WebkitMask: 'radial-gradient(rgba(255, 255, 255, 1) 0%, transparent 80%)',
              }}
            />
          </div>

          <div className="relative w-full">
            <Outlet />
          </div>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
