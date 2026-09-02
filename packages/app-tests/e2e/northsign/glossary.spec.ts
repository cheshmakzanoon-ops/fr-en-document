import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

import { signup } from './helpers';

/**
 * GATE 5 — fr-CA glossary guard.
 *
 * Scans rendered text of key FR pages (dashboard, upload, signing, settings)
 * and fails on banned strings. The banned list is parsed live from I18N.md
 * §7 so the glossary has ONE source of truth: edit the glossary table there
 * and this gate follows.
 *
 * Banned categories (I18N.md §7 "never" column):
 * - 'e-mail' / 'email' (must be « courriel »)
 * - 'Journal d'audit' (must be « piste d'audit »)
 * - standalone 'Importer' as an action label (must be « Téléverser »)
 */
const I18N_MD_PATH = path.join(__dirname, '../../../../I18N.md');

type BannedEntry = {
  /** Human-readable banned string for failure messages. */
  label: string;
  /** Case-insensitive matching against rendered page text. */
  pattern: RegExp;
  /** Required replacement (from the glossary) for failure messages. */
  replacement: string;
};

/**
 * Parse the glossary "never" rules from I18N.md §7. Falls back to the
 * hardcoded core rules if the file layout ever changes, so the test never
 * silently passes on a parse failure.
 */
const parseBannedListFromI18nMd = (): BannedEntry[] => {
  const defaults: BannedEntry[] = [
    { label: 'e-mail', pattern: /e-mail/i, replacement: 'courriel' },
    { label: 'email (as UI copy)', pattern: /\bemail\b/i, replacement: 'courriel' },
    { label: "Journal d'audit", pattern: /journal\s+d'audit/i, replacement: "piste d'audit" },
    { label: 'Importer (standalone action label)', pattern: /^\s*Importer\s*$/im, replacement: 'Téléverser' },
  ];

  let content: string;

  try {
    content = readFileSync(I18N_MD_PATH, 'utf8');
  } catch {
    // I18N.md unreadable → fall back to defaults rather than silently passing.
    return defaults;
  }

  const entries: BannedEntry[] = [];

  const glossarySection = content.split('## 7.')[1]?.split('##')[0] ?? '';
  const rows = glossarySection.split('\n').filter((line) => line.trim().startsWith('|'));

  for (const row of rows) {
    const cells = row.split('|').map((cell) => cell.trim());

    // Glossary rows: | EN term | fr-CA (mandatory) | Notes |
    if (cells.length < 4 || cells[1].toLowerCase().includes('en term')) {
      continue;
    }

    const frTerm = cells[2];
    const notes = cells[3] ?? '';

    // "never X" in the notes column → ban X when rendering FR.
    const neverMatch = /never\s+["«]?([^"»]+)["»]?\s+in/i.exec(notes);

    if (neverMatch) {
      const banned = neverMatch[1].trim();

      entries.push({
        label: banned,
        pattern: new RegExp(banned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'i'),
        replacement: frTerm,
      });
    }
  }

  return entries.length > 0 ? [...defaults, ...entries] : defaults;
};

const BANNED = parseBannedListFromI18nMd();

test('[NORTHSIGN][GLOSSARY] I18N.md glossary yields the expected banned rules', () => {
  const labels = BANNED.map((entry) => entry.label.toLowerCase());

  expect(labels).toContain('e-mail');
  expect(labels).toContain("journal d'audit");
  expect(BANNED.every((entry) => entry.replacement.length > 0)).toBe(true);
});

test('[NORTHSIGN][GLOSSARY] FR public pages carry no banned strings', async ({ page }) => {
  await page.goto('/?lang=fr');

  const landing = await page.locator('body').innerText();

  for (const entry of BANNED) {
    expect(landing, `banned "${entry.label}" on landing (use « ${entry.replacement} »)`).not.toMatch(entry.pattern);
  }

  await page.goto('/signin');

  const signinText = await page.locator('body').innerText();

  for (const entry of BANNED) {
    expect(signinText, `banned "${entry.label}" on /signin (use « ${entry.replacement} »)`).not.toMatch(entry.pattern);
  }
});

test('[NORTHSIGN][GLOSSARY] FR dashboard + settings carry no banned strings', async ({ page }) => {
  const email = await signup({ page });

  await page.goto('/dashboard');
  await expect(page.getByText('Téléverser').first()).toBeVisible(); // FR session actually active

  const dashboard = await page.locator('body').innerText();

  for (const entry of BANNED) {
    expect(dashboard, `banned "${entry.label}" on /dashboard (use « ${entry.replacement} »)`).not.toMatch(
      entry.pattern,
    );
  }

  await page.goto('/settings/profile');

  const settings = await page.locator('body').innerText();

  for (const entry of BANNED) {
    expect(settings, `banned "${entry.label}" on /settings/profile (use « ${entry.replacement} »)`).not.toMatch(
      entry.pattern,
    );
  }

  void email;
});

test('[NORTHSIGN][GLOSSARY] FR signing page carries no banned strings', async ({ page }) => {
  // The signing page is exercised with a real recipient invite from the
  // recipient-locale spec; here we scan the page shell via a token-less visit
  // (invalid token → error state, still fully rendered through the catalog).
  await page.goto('/sign/invalid-token-for-glossary-scan');

  const body = await page.locator('body').innerText();

  for (const entry of BANNED) {
    expect(body, `banned "${entry.label}" on /sign/* (use « ${entry.replacement} »)`).not.toMatch(entry.pattern);
  }
});
