#!/usr/bin/env node
/**
 * fr-CA PO tooling (Phase 4).
 *
 * Subcommands:
 *   node scripts/fr-ca-tools.mjs dump           - write scripts/fr-ca-missing.json
 *                                                 (exact msgids with empty translations,
 *                                                  one entry per missing string)
 *   node scripts/fr-ca-tools.mjs apply          - merge scripts/fr-ca-missing-*.json +
 *                                                 glossary normalization into
 *                                                 packages/lib/translations/fr/web.po
 *   node scripts/fr-ca-tools.mjs fix            - apply CORRECTIVE_RULES to existing
 *                                                 translations (glossary artifacts)
 *   node scripts/fr-ca-tools.mjs diag-roundtrip <file>
 *                                               - verify parse->serialize is byte-faithful
 *                                                 (regression guard for the serializer)
 *
 * The `apply` step is deterministic: it only fills/rewrites msgstr values,
 * never msgids, and fails loudly when an authored id does not match the
 * catalog (typo protection).
 *
 * Serializer contract: sections are stored DECODED (plain JS strings) after
 * parsing, and ENCODED exactly once at serialization. Never unescape an
 * already-decoded section or re-encode raw section bytes.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const catalogPath = resolve(rootDir, 'packages/lib/translations/fr/web.po');
const missingJsonPath = resolve(rootDir, 'scripts/fr-ca-missing.json');
const missingPartsDir = resolve(rootDir, 'scripts');

// ---------------------------------------------------------------------------
// gettext PO parsing (subset sufficient for Lingui-formatted catalogs)
// ---------------------------------------------------------------------------

/**
 * Decode one PO quoted-section body (no surrounding quotes) into plain
 * content. Stateful decoder: `\\\\` -> backslash, `\\n` -> newline,
 * `\\t` -> tab, `\\r` -> carriage return, `\\"` -> quote; any other
 * backslash sequence keeps the literal character (gettext behavior).
 */
const unescapePo = (value) => {
  let out = '';
  let index = 0;

  while (index < value.length) {
    const ch = value[index];

    if (ch !== '\\') {
      out += ch;
      index += 1;
      continue;
    }

    index += 1;

    if (index >= value.length) {
      out += '\\';
      break;
    }

    const next = value[index];

    if (next === 'n') {
      out += '\n';
    } else if (next === 't') {
      out += '\t';
    } else if (next === 'r') {
      out += '\r';
    } else {
      out += next;
    }

    index += 1;
  }

  return out;
};

/** Encode a plain-content string for a PO quoted body (escape once). */
const escapePo = (value) =>
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/\r/g, '\\r');

/**
 * Parse a PO catalog into entries.
 *
 * @returns {Array<{comments: string[], msgctxt: string[], msgid: string[], msgstr: string[], flags: string[]}>}
 */
const parseCatalog = (content) => {
  const entries = [];
  const blocks = content.split(/\n\n+/);

  for (const block of blocks) {
    if (!block.trim()) {
      continue;
    }

    const comments = [];
    const msgctxt = [];
    const msgid = [];
    const msgstr = [];
    const flags = [];

    let section = null;

    for (const line of block.split('\n')) {
      if (line.startsWith('#,')) {
        flags.push(...line.slice(2).trim().split(/,\s*/));
        section = null;
        continue;
      }

      if (line.startsWith('#')) {
        comments.push(line);
        section = null;
        continue;
      }

      const msgidMatch = line.match(/^msgid\s+(.*)$/);
      const msgstrMatch = line.match(/^msgstr\s+(.*)$/);
      const msgctxtMatch = line.match(/^msgctxt\s+(.*)$/);

      if (msgctxtMatch) {
        section = 'msgctxt';
        msgctxt.push(unescapePo(msgctxtMatch[1].replace(/^"(.*)"$/, '$1')));
        continue;
      }

      if (msgidMatch) {
        section = 'msgid';
        msgid.push(unescapePo(msgidMatch[1].replace(/^"(.*)"$/, '$1')));
        continue;
      }

      if (msgstrMatch) {
        section = 'msgstr';
        msgstr.push(unescapePo(msgstrMatch[1].replace(/^"(.*)"$/, '$1')));
        continue;
      }

      if (section === 'msgctxt' && line.startsWith('"')) {
        msgctxt.push(unescapePo(line.replace(/^"(.*)"$/, '$1')));
        continue;
      }

      if (section === 'msgid' && line.startsWith('"')) {
        msgid.push(unescapePo(line.replace(/^"(.*)"$/, '$1')));
        continue;
      }

      if (section === 'msgstr' && line.startsWith('"')) {
        msgstr.push(unescapePo(line.replace(/^"(.*)"$/, '$1')));
      }
    }

    if (msgid.length > 0 || msgstr.length > 0 || comments.length > 0 || flags.length > 0) {
      entries.push({ comments, msgctxt, msgid, msgstr, flags });
    }
  }

  return entries;
};

/** Serialize a catalog entry back to PO text. */
const serializeEntry = (entry) => {
  const lines = [...entry.comments];

  for (const flag of entry.flags) {
    lines.push(`#, ${flag}`);
  }

  if (entry.msgctxt.length > 0) {
    lines.push(`msgctxt ${quoteSections(entry.msgctxt)}`);
  }

  // Obsolete stubs (entries whose previous values live in `#~` comments)
  // have no leading msgid/msgstr keywords after Lingui's merge — they are
  // comment-only blocks. Emit them comment-only for byte-faithful
  // round-trips.
  if (entry.msgid.length === 0 && entry.msgstr.length === 0) {
    return lines.join('\n');
  }

  lines.push(`msgid ${quoteSections(entry.msgid)}`);

  if (entry.msgstr.length === 1 && entry.msgstr[0] === '') {
    lines.push('msgstr ""');
  } else {
    lines.push(`msgstr ${quoteSections(entry.msgstr)}`);
  }

  return lines.join('\n');
};

const quoteSections = (sections) => {
  if (sections.length === 1) {
    return `"${escapePo(sections[0])}"`;
  }

  return sections.map((section) => `"${escapePo(section)}"`).join('\n');
};

const entryMsgid = (entry) => entry.msgid.join('');

const serializeCatalog = (entries) => `${entries.map(serializeEntry).join('\n\n')}\n`;

export { entryMsgid, parseCatalog, serializeCatalog, serializeEntry, unescapePo };

// ---------------------------------------------------------------------------
// fr-CA glossary normalization rules (msgstr only)
// ---------------------------------------------------------------------------

const GLOSSARY_RULES = [
  { pattern: /\bE-?mails?\b/gi, replacement: 'courriel' },
  { pattern: /\bEmails?\b/g, replacement: 'Courriel' },
  { pattern: /\bemails?\b/g, replacement: 'courriel' },
  { pattern: /\bmél\b/gi, replacement: 'courriel' },
  { pattern: /\bMél\b/g, replacement: 'Courriel' },
];

const applyGlossary = (value) => {
  let next = value;

  for (const rule of GLOSSARY_RULES) {
    next = next.replace(rule.pattern, rule.replacement);
  }

  return next;
};

/**
 * Post-fixes for artifacts of the naive email→courriel replacement
 * (elision/plural corruption). Exact, safe substring rules only.
 */
const CORRECTIVE_RULES = [
  { pattern: /L'courriel/g, replacement: 'Le courriel' },
  { pattern: /l'courriel/g, replacement: 'le courriel' },
  { pattern: /d’courriel/g, replacement: 'de courriel' },
  { pattern: /d'courriel/g, replacement: 'de courriel' },
  { pattern: / des courriel/g, replacement: ' des courriels' },
  { pattern: / les courriel/g, replacement: ' les courriels' },
  { pattern: / de messagerie/g, replacement: ' de courriel' },
  { pattern: / de la messagerie/g, replacement: ' de courriel' },
];

const applyCorrections = (value) => {
  let next = value;

  for (const rule of CORRECTIVE_RULES) {
    next = next.replace(rule.pattern, rule.replacement);
  }

  return next;
};

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

const subcommand = process.argv[2];

if (!subcommand) {
  process.stdout.write('Usage: node scripts/fr-ca-tools.mjs <dump|apply|fix|diag-roundtrip>\n');
  process.exit(1);
}

const catalog = readFileSync(catalogPath, 'utf8');

if (subcommand === 'diag-roundtrip') {
  // Verify parse -> serialize round-trips byte-identically for the given file
  // (used to confirm the serializer is faithful to Lingui's own output).
  const fileArg = process.argv[3];
  const content = readFileSync(resolve(rootDir, fileArg), 'utf8');
  const entries = parseCatalog(content);
  const written = serializeCatalog(entries);
  const identical = written === content;
  const sourceBlocks = content.split(/\n\n+/).map((block) => block.trim());
  const writtenBlocks = written.split(/\n\n+/).map((block) => block.trim());
  const diffs = [];

  for (let index = 0; index < Math.max(sourceBlocks.length, writtenBlocks.length); index += 1) {
    const sourceBlock = sourceBlocks[index] ?? '';
    const mineBlock = writtenBlocks[index] ?? '';

    if (sourceBlock !== mineBlock) {
      diffs.push({ index, source: sourceBlock.slice(0, 400), mine: mineBlock.slice(0, 400) });
    }
  }

  process.stdout.write(`${fileArg}: whole-file identical=${identical}; differing blocks = ${diffs.length}\n`);

  for (const diff of diffs.slice(0, 3)) {
    process.stdout.write(`\n--- BLOCK ${diff.index}\nSOURCE:\n${diff.source}\nMINE:\n${diff.mine}\n`);
  }

  process.exit(0);
}

const entries = parseCatalog(catalog);

if (subcommand === 'dump') {
  const missing = entries
    .filter((entry) => entry.msgid.length > 0 && entry.msgstr.length === 1 && entry.msgstr[0] === '')
    .map((entry) => entryMsgid(entry));

  writeFileSync(missingJsonPath, `${JSON.stringify(missing, null, 2)}\n`, 'utf8');

  process.stdout.write(`wrote ${missing.length} missing msgids to scripts/fr-ca-missing.json\n`);
  process.exit(0);
}

if (subcommand === 'fix') {
  let fixed = 0;

  for (const entry of entries) {
    if (entry.msgid.length === 0 || entry.msgstr.length === 0 || entry.msgstr[0] === '') {
      continue;
    }

    if (entry.flags.includes('fuzzy')) {
      continue;
    }

    const current = entry.msgstr.join('');
    const next = applyCorrections(current);

    if (next !== current) {
      entry.msgstr = next.split('\n');
      fixed += 1;
    }
  }

  writeFileSync(catalogPath, serializeCatalog(entries), 'utf8');

  process.stdout.write(`corrected ${fixed} msgstrs\n`);
  process.exit(0);
}

if (subcommand === 'apply') {
  if (!existsSync(missingJsonPath)) {
    process.stdout.write('scripts/fr-ca-missing.json missing: run `dump` first.\n');
    process.exit(1);
  }

  const missing = JSON.parse(readFileSync(missingJsonPath, 'utf8'));

  const authored = {};
  const partFiles = readdirSync(missingPartsDir)
    .filter((file) => /^fr-ca-missing-\d+\.json$/.test(file))
    .sort();

  for (const partFile of partFiles) {
    const part = JSON.parse(readFileSync(resolve(missingPartsDir, partFile), 'utf8'));

    for (const [msgid, translation] of Object.entries(part)) {
      if (typeof translation !== 'string' || translation.trim() === '') {
        process.stdout.write(`empty authored translation for: ${msgid}\n`);
        process.exit(1);
      }

      authored[msgid] = translation;
    }
  }

  const missingSet = new Set(missing.map((msgid) => JSON.stringify(msgid)));
  const authoredSet = new Set(Object.keys(authored).map((msgid) => JSON.stringify(msgid)));

  // Every catalog-missing id must be present in the authored parts.
  for (const msgid of missingSet) {
    if (!authoredSet.has(msgid)) {
      process.stdout.write(`missing authored translation for: ${JSON.parse(msgid)}\n`);
      process.exit(1);
    }
  }

  // Authored ids that are no longer missing (already filled by a previous
  // apply run, or never missing) — warn only, they may be intentional
  // (previous extraction fill) or typos of never-missing ids.
  let staleAuthored = 0;

  for (const msgid of authoredSet) {
    if (!missingSet.has(msgid)) {
      staleAuthored += 1;
    }
  }

  if (staleAuthored > 0) {
    process.stdout.write(`note: ${staleAuthored} authored ids are already translated in the catalog (skipped)\n`);
  }

  let filled = 0;
  let normalized = 0;
  let skipped = 0;

  for (const entry of entries) {
    if (entry.msgid.length === 0) {
      continue;
    }

    const msgid = entryMsgid(entry);
    const isMissing = entry.msgstr.length === 1 && entry.msgstr[0] === '';

    if (isMissing && !Object.hasOwn(authored, msgid)) {
      // Presently untranslated and no authored value: keep as-is (allows
      // partial authoring passes without failing the whole run).
      skipped += 1;
      continue;
    }

    let next;

    if (isMissing) {
      next = authored[msgid];
      filled += 1;
    } else {
      if (entry.flags.includes('fuzzy')) {
        continue;
      }

      const current = entry.msgstr.join('');
      next = applyGlossary(current);

      if (next === current) {
        continue;
      }

      normalized += 1;
    }

    const sections = next.split('\n');
    const hasChanged =
      sections.length !== entry.msgstr.length || sections.some((section, index) => section !== entry.msgstr[index]);

    if (hasChanged) {
      entry.msgstr = sections;
    }
  }

  if (skipped > 0) {
    process.stdout.write(`left ${skipped} untranslated ids (no authored value)\n`);
  }

  writeFileSync(catalogPath, serializeCatalog(entries), 'utf8');

  process.stdout.write(`filled ${filled} missing translations; glossary-normalized ${normalized} msgstrs\n`);
  process.exit(0);
}

process.stdout.write(`unknown subcommand: ${subcommand}\n`);
process.exit(1);
