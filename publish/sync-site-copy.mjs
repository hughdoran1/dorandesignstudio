#!/usr/bin/env node
// Sync SITE COPY from the Obsidian vault → content/site-copy.json.
//
// The vault is the master for the site's editorial copy (the same rule as the journal, the spec
// and the Work descriptions). This script reads DDSWebsite/Site/**/*.md — each file carries
// frontmatter (`topic:` key + `title:`) and a markdown body — and writes them to one JSON the
// site fetches at boot. A panel with no master (or when the JSON is missing) falls back to the
// copy built into grid-system.html, so this can never blank the site.
//
//   node publish/sync-site-copy.mjs
//
// Currently synced: Site/About/*.md → the five About topic panels (what · ontology · graffold ·
// pipeline · founder). Designed elements (the ontology animation, the Graffold schema image, the
// founder photo, panel chrome) stay in the template — the vault owns the words.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const OUT = join(REPO, 'content', 'site-copy.json');

const cfg = JSON.parse(readFileSync(join(HERE, 'publish.config.json'), 'utf8'));
// Site/ lives beside the Work/ descriptions dir in the vault
const workDir = cfg.workDescriptionsDir || '';
const siteDir = workDir ? join(dirname(workDir), 'Site') : '';
if (!siteDir || !existsSync(siteDir)) { console.error('✗ vault Site/ folder not found (expected beside workDescriptionsDir):', siteDir); process.exit(1); }

const copy = { about: {} };
const aboutDir = join(siteDir, 'About');
if (existsSync(aboutDir)) {
  for (const f of readdirSync(aboutDir)) {
    if (!/\.md$/i.test(f)) continue;
    const raw = readFileSync(join(aboutDir, f), 'utf8');
    const fm = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/.exec(raw);
    const front = fm ? fm[1] : '';
    const body = (fm ? fm[2] : raw).replace(/<!--[\s\S]*?-->/g, '').trim();
    const key = (/(?:^|\n)\s*topic\s*:\s*(.+?)\s*$/m.exec(front) || [])[1];
    const title = (/(?:^|\n)\s*title\s*:\s*(.+?)\s*$/m.exec(front) || [])[1];
    if (key && body) copy.about[key.trim()] = { title: (title || '').trim(), body };
  }
}
writeFileSync(OUT, JSON.stringify(copy, null, 2) + '\n');
console.log(`✓ wrote content/site-copy.json — About panels: [${Object.keys(copy.about).join(', ')}]`);
