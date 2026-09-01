import type { SVGAttributes } from 'react';

export type LogoProps = SVGAttributes<SVGSVGElement>;

/**
 * NorthSign wordmark (SVG-first, per Phase 2 decision D-013).
 *
 * A clean geometric wordmark drawn as text-like vector strokes so it renders
 * identically at any size and inherits `currentColor` for light/dark theming —
 * same behaviour as the upstream logo it replaces.
 */
export const BrandingLogo = ({ ...props }: LogoProps) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 64" {...props}>
      {/* Icon: north-star arrow inside a rounded square */}
      <g fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="4" width="56" height="56" rx="14" />
        <path d="M16 46V20l16 18V20" />
        <path d="M40 20v26" />
        <path d="M40 20l8 10" />
      </g>
      {/* Wordmark: N O R T H S I G N */}
      <g fill="currentColor">
        {/* N */}
        <path d="M84 46V18h7.6l13.2 17.4V18H112v28h-7.6L91.2 28.6V46H84Z" />
        {/* O */}
        <path d="M133.5 46.7c-8.9 0-15.5-6.2-15.5-15s6.6-15 15.5-15 15.5 6.2 15.5 15-6.6 15-15.5 15Zm0-6.7c4.6 0 8-3.4 8-8.3s-3.4-8.3-8-8.3-8 3.4-8 8.3 3.4 8.3 8 8.3Z" />
        {/* R */}
        <path d="M156 46V18h14.6c7.5 0 12.4 4.2 12.4 10.6 0 4.4-2.4 7.8-6.4 9.4l7.4 8h-9.2l-6.4-7.2h-5.2V46H156Zm7.2-13.4h6.6c3.2 0 5.2-1.6 5.2-4s-2-4-5.2-4h-6.6v8Z" />
        {/* T */}
        <path d="M188 24.6V18h25.4v6.6h-8.9V46h-7.6V24.6H188Z" />
        {/* H */}
        <path d="M220 46V18h7.4v10.5h10.2V18H245v28h-7.4V35h-10.2v11H220Z" />
        {/* S */}
        <path d="M261.6 46.6c-6.7 0-11.6-3.6-12.4-9.2h7.6c.6 2.1 2.4 3.3 4.9 3.3 2.4 0 4-1 4-2.7 0-1.5-1.2-2.3-4.4-3l-2.9-.6c-5.7-1.2-8.8-4-8.8-8.5 0-5.4 4.7-9.2 11.5-9.2 6.5 0 11.1 3.5 11.8 9h-7.4c-.5-2-2.1-3.1-4.5-3.1-2.2 0-3.7 1-3.7 2.5 0 1.4 1.1 2.2 3.9 2.8l3 .6c6 1.3 9.2 4 9.2 8.7 0 5.6-4.8 9.4-11.8 9.4Z" />
        {/* I */}
        <path d="M280 18h7.4v28H280V18Z" />
        {/* G */}
        <path d="M311.4 33.5v-4.4h14.8v3c0 8.8-6 14.6-15 14.6-9.2 0-15.6-6.3-15.6-15.4S302.1 16.7 311.2 16.7c7.5 0 13.2 4.4 14.5 11h-7.8c-1-2.7-3.5-4.3-6.7-4.3-4.8 0-8 3.5-8 8.9s3.2 8.8 8.1 8.8c3.9 0 6.8-1.9 7.6-5h-7.5v-2.6Z" />
        {/* N */}
        <path d="M334 46V18h7.6l13.2 17.4V18H362v28h-7.6l-13.2-17.4V46H334Z" transform="translate(-16 0)" />
      </g>
    </svg>
  );
};
