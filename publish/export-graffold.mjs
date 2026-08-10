#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Graffold snapshot export — the companion to publish.mjs. Reads the Graffold Neo4j
// DB (READ-only) and writes ONE company's assets — each asset's iteration TREE + the
// LINKED files it contains — to content/graffold-snapshot.json, which the website's
// `graffoldgallery` / `graffoldtree` media kinds render. The site never touches Neo4j.
//
//   1. Start the Graffold database in Neo4j Desktop (bolt://…:7687 must be listening).
//   2. Source Graffold's .env so NEO4J_URI / NEO4J_PASSWORD are set, then:
//        node publish/export-graffold.mjs                       # → Doran Design Studio
//        node publish/export-graffold.mjs --company "Acme Co"   # any company label
//        node publish/export-graffold.mjs --dry-run             # print counts, write nothing
//
// Needs `npm i neo4j-driver`. cdnBase (publish.config.json) rewrites S3 preview hosts, same as publish.mjs.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const ALL = argv.includes('--all');   // DEV/local only: ignore the publish gate + privacy so the gallery can be populated with all real assets while developing. Never use for a public deploy.
const ALL_CO = argv.includes('--all-companies');   // portfolio mode: export EVERY company's published work (not just one), tagging each asset with its own company label
const companyIdx = argv.indexOf('--company');
const COMPANY = companyIdx >= 0 ? argv[companyIdx + 1] : 'Doran Design Studio';
const minIdx = argv.indexOf('--min-iterations');
const MIN_ITER = minIdx >= 0 ? (+argv[minIdx + 1] || 0) : 4;   // keep assets with MORE than 3 iterations (>3) — drops trivial 1-3 version files, cuts file size
const OUT = join(REPO, 'content', 'graffold-snapshot.json');

// cdnBase: rewrite raw S3 preview hosts to the CDN (parity with publish.mjs); '' leaves them raw.
let cdnBase = '';
const cfgPath = join(HERE, 'publish.config.json');
let ALIASES = [];   // [[find, replace], …] — client-agnostic scrub (see publish.config.json graffoldAliases)
let WORK_DESC_DIR = '';   // Obsidian vault folder of per-deliverable markdown descriptions (publish.config.json → workDescriptionsDir)
const NO_SCRUB = argv.includes('--no-scrub');   // show REAL client/product names (portfolio mode); CLI overrides the config flag
if (existsSync(cfgPath)) { try { const cfg = JSON.parse(readFileSync(cfgPath, 'utf8')); cdnBase = cfg.cdnBase || ''; const scrubOn = !NO_SCRUB && cfg.graffoldScrub !== false; ALIASES = (scrubOn && Array.isArray(cfg.graffoldAliases)) ? cfg.graffoldAliases : []; WORK_DESC_DIR = cfg.workDescriptionsDir || ''; } catch {} }

// Work descriptions — authored in the Obsidian vault as markdown (one .md per deliverable, `fileName:` in YAML
// frontmatter = the Graffold assetFileName). Read here and attached to the matching asset as `description`, so the
// copy lives in Obsidian and syncs on every export — the same one-command flow as the Graffold DB itself.
const WORK_DESC = {};
const WORK_TITLE = {};   // frontmatter `title:` — the PRESENTATION title (the asset label is a working filename like "Contractors", one version of many; not fit to present)
const WORK_PROJECTS = {};   // per-PROJECT vault masters (2026-07 Work redesign): frontmatter project:/title:/lead:/services:, body = project description
if (WORK_DESC_DIR && existsSync(WORK_DESC_DIR)) {
  for (const f of readdirSync(WORK_DESC_DIR)) {
    if (!/\.md$/i.test(f)) continue;
    try {
      const raw = readFileSync(join(WORK_DESC_DIR, f), 'utf8');
      const fm = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/.exec(raw);
      const front = fm ? fm[1] : '';
      const body = (fm ? fm[2] : raw).replace(/<!--[\s\S]*?-->/g, '').trim();   // strip HTML comments so a scaffold's `<!-- hint -->` never renders as the description
      const fmv = k => { const m = new RegExp('(?:^|\\n)\\s*' + k + '\\s*:\\s*(.+?)\\s*$', 'm').exec(front); return m ? m[1].replace(/^["']|["']$/g, '').trim() : ''; };
      const proj = fmv('project');
      if (proj) {   // per-PROJECT master (the Work redesign): title/lead/services + description body
        WORK_PROJECTS[proj] = {
          title: fmv('title') || undefined,
          lead: fmv('lead') || undefined,   // fileName of the manually-picked lead mockup
          services: fmv('services') ? fmv('services').split(',').map(s => s.trim()).filter(Boolean) : [],
          description: body || undefined,
        };
      } else {   // legacy per-document master (fileName-keyed) — still honoured
        const key = fmv('fileName');
        if (key && body) WORK_DESC[key] = body;
        if (key && fmv('title')) WORK_TITLE[key] = fmv('title');
      }
    } catch {}
  }
  const n = Object.keys(WORK_DESC).length, t = Object.keys(WORK_TITLE).length, p = Object.keys(WORK_PROJECTS).length;
  if (n || t || p) console.log(`• vault: ${p} project master(s), ${n} doc description(s), ${t} doc title(s) (${WORK_DESC_DIR})`);
}
// Alias scrub — client-agnostic. Applied to DISPLAY strings (project labels, asset names, fileName keys,
// notes, linkedAssets) but NOT to http(s) URLs: the preview PNGs are real S3 object keys that still carry
// the client token, so rewriting the URL would 404 the image. (Fully scrubbing those needs the previews
// re-uploaded to S3 under generic keys — a Graffold-side job, out of scope here.) Ordered specific→general.
const scrubStr = str => ALIASES.reduce((s, [f, r]) => (f ? s.split(f).join(r) : s), str);
const deepScrub = v => Array.isArray(v) ? v.map(deepScrub)
  : (v && typeof v === 'object') ? Object.fromEntries(Object.entries(v).map(([k, val]) => [k, deepScrub(val)]))
  : (typeof v === 'string' && !/^https?:\/\//i.test(v)) ? scrubStr(v)
  : v;
const S3_HOST_RE = /^https?:\/\/ddspreviewimages\.s3[.-][a-z0-9-]*\.amazonaws\.com\//i;
const cdn = url => (cdnBase && typeof url === 'string' && S3_HOST_RE.test(url)) ? url.replace(S3_HOST_RE, cdnBase) : url;

// Load Graffold's .env (NEO4J_* only) if the vars aren't already in the environment — avoids shell-sourcing a
// password with special chars. Path: --env <file>, or $GRAFFOLD_ENV, or the sibling ../Graffold/.env.
if (!process.env.NEO4J_URI) {
  const envIdx = argv.indexOf('--env');
  const envPath = envIdx >= 0 ? argv[envIdx + 1] : (process.env.GRAFFOLD_ENV || resolve(REPO, '..', 'Graffold', '.env'));
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = /^\s*(NEO4J_[A-Z_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

const uri = process.env.NEO4J_URI, pass = process.env.NEO4J_PASSWORD, user = process.env.NEO4J_USER || 'neo4j';
if (!uri || !pass) { console.error(`✗ NEO4J_URI / NEO4J_PASSWORD not set. Start the Graffold DB, source Graffold's .env, and retry.`); process.exit(1); }
let neo4j; try { neo4j = (await import('neo4j-driver')).default; }
catch { console.error('✗ neo4j-driver not installed. Run:  npm i neo4j-driver'); process.exit(1); }

const driver = neo4j.driver(uri, neo4j.auth.basic(user, pass));
const session = driver.session({ defaultAccessMode: 'READ' });
const num = v => (v && typeof v === 'object' && typeof v.toNumber === 'function') ? v.toNumber() : v;   // Neo4j Integer → JS number

try {
  // (a) every asset for the company, with current preview + project + publish flags + content type
  const aRes = await session.run(
    `MATCH (a:Asset)-[:CREATED_FOR]->(p:Project)-[:COMMISSIONED_BY]->(c:Company)
     WHERE $company IS NULL OR c.label = $company
     OPTIONAL MATCH (a)<-[:ITERATION_OF]-(i:Iteration)
     OPTIONAL MATCH (a)-[:MOCKUP_FOR]->(mk:Asset)        // convention: (document)-[:MOCKUP_FOR]->(its mockups); split by mk.mockupType ('cover'/'spread', picker-editable), legacy untyped fall back to the filename
     OPTIONAL MATCH (mkDoc:Asset)-[:MOCKUP_FOR]->(a)     // a mockup pointed to BY a document → it represents that document (any type → hide it as a standalone item)
     WITH a, p, c, count(i) AS iterationCount, max(i.timeStamp) AS latestIterationTime, collect(DISTINCT mk) AS mks, head(collect(DISTINCT mkDoc)) AS mkDoc
     WITH a, p, c, iterationCount, latestIterationTime, mkDoc,
          head([x IN mks WHERE x IS NOT NULL AND (toLower(coalesce(x.mockupType,'')) = 'spread' OR (coalesce(x.mockupType,'') = '' AND toLower(x.assetFileName) CONTAINS 'spread'))]) AS spreadMk,
          head([x IN mks WHERE x IS NOT NULL AND NOT (toLower(coalesce(x.mockupType,'')) = 'spread' OR (coalesce(x.mockupType,'') = '' AND toLower(x.assetFileName) CONTAINS 'spread'))]) AS coverMk
     RETURN a.uuid AS id, a.label AS name, a.assetFileName AS fileName, a.preview AS preview,
            a.thumb AS thumb, a.full AS full, a.previewW AS previewW, a.previewH AS previewH,
            coalesce(a.mockup, coverMk.full, coverMk.thumb, coverMk.preview) AS mockup, mkDoc.assetFileName AS mockupOf, a.pdfDownloadPath AS pdf,
            coalesce(a.spread, spreadMk.full, spreadMk.thumb, spreadMk.preview) AS spread, a.downloadPath AS videoDl,
            a.notes AS notes, a.published AS published, a.contentType AS contentType, a.authoringSoftware AS authoringSoftware,
            p.label AS project, c.label AS company, p.public AS projectPublic, iterationCount, latestIterationTime
     ORDER BY latestIterationTime DESC`,
    { company: ALL_CO ? null : COMPANY });

  // Publish gate is OPT-IN: enforced only once the `published` flag is in use. Asset.published is the single gate —
  // making a project public cascades published=true onto its assets (Graffold setProjectPublic), and an asset can be
  // published individually even inside a PRIVATE project (e.g. a nice graphic that isn't project-specific). In that
  // private-project case we still publish the asset but DROP its project data, since the project may be secret.
  const rows0 = aRes.records;
  const publishedUsed = rows0.some(r => r.get('published') !== null && r.get('published') !== undefined);
  if (ALL) console.log('⚠ --all: DEV MODE — publish gate + privacy BYPASSED, exporting every asset with full data. Do NOT deploy this snapshot.');
  else if (publishedUsed) console.log('• publish flag in use — exporting published assets only (private-project assets keep no project label)');

  const assets = [];
  for (const rec of aRes.records) {
    const fileName = rec.get('fileName');
    if (!fileName) continue;
    if (!ALL && publishedUsed && rec.get('published') !== true) continue;   // the one gate: asset must be published (--all bypasses for local dev)

    // (b) all iterations of the asset + their CHILD_OF parent → reconstruct the tree in JS
    const iRes = await session.run(
      `MATCH (a:Asset {assetFileName: $fileName})<-[:ITERATION_OF]-(i:Iteration)
       OPTIONAL MATCH (i)-[:CHILD_OF]->(parent:Iteration)
       RETURN i.uuid AS uuid, i.label AS label, i.generation AS generation,
              i.timeStamp AS timeStamp, i.status AS status, i.preview AS preview,
              i.thumb AS thumb, i.full AS full, i.previewW AS previewW, i.previewH AS previewH, parent.uuid AS parentUuid`,
      { fileName });

    // Iteration node — the fields the site renders: label · generation · time · status · preview + thumb/full (hover
    // to see that in-development form) · children. (downloadPath/iterationFileName/linkedFiles dropped to stay small.)
    const byUuid = new Map();
    for (const r of iRes.records) {
      byUuid.set(r.get('uuid'), {
        uuid: r.get('uuid'), label: r.get('label') || '', generation: String(r.get('generation') ?? ''),
        timeStamp: num(r.get('timeStamp')), status: r.get('status') || [], preview: cdn(r.get('preview')),
        thumb: cdn(r.get('thumb')) || undefined, full: cdn(r.get('full')) || undefined, pw: num(r.get('previewW')) || undefined, ph: num(r.get('previewH')) || undefined,
        _parent: r.get('parentUuid'), children: [],
      });
    }
    let root = null;
    for (const node of byUuid.values()) {
      const parent = node._parent && byUuid.get(node._parent);
      if (parent) parent.children.push(node);
      else if (!root || node.generation === '1') root = node;
    }
    byUuid.forEach(n => { delete n._parent; n.children.sort((x, y) => (num(x.timeStamp) || 0) - (num(y.timeStamp) || 0)); });
    if (!root) continue;
    const countTree = n => 1 + (n.children || []).reduce((s, c) => s + countTree(c), 0);
    const treeSize = countTree(root);
    if (treeSize < MIN_ITER) continue;   // filter on the CONNECTED tree the site renders (some iterations are orphaned from the CHILD_OF chain), not the raw count — only assets with a real history (> 3 versions) reach the site

    // (c) linked/contained assets across the asset's iterations
    const lRes = await session.run(
      `MATCH (a:Asset {assetFileName: $fileName})<-[:ITERATION_OF]-(:Iteration)-[:CONTAINS_ASSET]->(linked:Asset)
       RETURN DISTINCT linked.uuid AS id, linked.label AS name, linked.assetFileName AS fileName, linked.preview AS preview, linked.thumb AS thumb`,
      { fileName });
    const linkedAssets = lRes.records.map(r => ({
      id: r.get('id'), name: r.get('name') || '', fileName: r.get('fileName') || '', preview: cdn(r.get('preview')), thumb: cdn(r.get('thumb')) || undefined, relation: 'CONTAINS_ASSET',
    }));

    // Privacy: if the asset is published but its project is PRIVATE, publish the asset with NO project-identifying
    // data — the graphic may be shareable while the client/project stays secret. We withhold: the project label,
    // the notes, the CONTAINS_ASSET links, AND the assetFileName (Graffold names encode the project, e.g.
    // A_Label_ProjectName.ai) — the public key falls back to the opaque uuid. The asset's own name/preview/tree stay,
    // so name published-from-private assets generically.
    const projPublic = ALL || rec.get('projectPublic') === true;   // --all shows full data locally; otherwise private projects are anonymised
    // thumb/full/dims: prefer the Asset's own (mirrored from the current iteration), else fall back to the iteration
    // whose preview the asset mirrors (or the root). Keeps working whether Graffold mirrors these onto the Asset or
    // only onto Iterations. thumb → gallery grid, full → detail modal, pw/ph → aspect-aware sizing.
    const cur = [...byUuid.values()].find(n => n.preview && n.preview === cdn(rec.get('preview'))) || root;
    const aThumb = cdn(rec.get('thumb')) || (cur && cur.thumb) || undefined;
    const aFull = cdn(rec.get('full')) || (cur && cur.full) || undefined;
    const aPW = num(rec.get('previewW')) || (cur && cur.pw) || undefined;
    const aPH = num(rec.get('previewH')) || (cur && cur.ph) || undefined;
    assets.push({
      id: rec.get('id'),
      name: rec.get('name') || (projPublic ? fileName : 'Untitled'),
      fileName: projPublic ? fileName : rec.get('id'),          // private project → opaque uuid key, not the project-encoded filename
      preview: cdn(rec.get('preview')),
      thumb: aThumb, full: aFull, pw: aPW, ph: aPH, mockup: cdn(rec.get('mockup')) || undefined,   // a document's cover mockup (Graffold `mockup` field / MOCKUP_FOR edge / contained PSD), if set
      mockupOf: rec.get('mockupOf') || undefined,   // set on a mockup asset that REPRESENTS a document (MOCKUP_FOR) → the site hides it as a standalone item
      pdf: cdn(rec.get('pdf')) || undefined,   // InDesign companion PDF (S3) — the doc's "View PDF" link (we control this, unlike a manufacturer URL)
      description: WORK_DESC[fileName] || undefined,   // project description authored in the Obsidian vault (workDescriptionsDir → markdown, keyed by fileName); rendered in the Work modal
      displayTitle: WORK_TITLE[fileName] || undefined,   // presentation title from the vault frontmatter — overrides the working asset label ("Contractors" is one version of a document, not its public name)
      spread: cdn(rec.get('spread')) || undefined,   // optional open-spread mockup (interior pages) shown beside the cover; Graffold `spread` field if present, else a GRAFFOLD_MEDIA site override on the site
      video: (/\.(mp4|mov|webm)$/i.test(fileName) ? cdn(rec.get('videoDl')) : undefined) || undefined,   // the real video file (S3) for a video asset → the modal <video> source; loads only on play (preload=none)
      project: projPublic ? (rec.get('project') || '') : '',
      company: projPublic ? (rec.get('company') || '') : '',   // the client this work was for (portfolio grouping); dropped for published-from-private assets
      contentType: rec.get('contentType') || '',
      authoringSoftware: rec.get('authoringSoftware') || '',
      notes: projPublic ? (rec.get('notes') || '') : '',
      iterationCount: treeSize,
      latestIterationTime: num(rec.get('latestIterationTime')),
      tree: root,
      linkedAssets: projPublic ? linkedAssets : [],             // private project → drop links (they can reveal the project)
    });
  }

  const snapLabel = ALL_CO ? 'Doran Design Studio' : COMPANY;
  const snapshot = { company: { label: snapLabel, generatedAt: new Date().toISOString(), generatedNote: 'Exported from the Graffold DB by publish/export-graffold.mjs.' }, projects: WORK_PROJECTS, assets };
  const companies = [...new Set(assets.map(a => a.company).filter(Boolean))];
  console.log(`✓ ${assets.length} asset(s)${ALL_CO ? ` across ${companies.length} client(s) [${companies.join(', ')}]` : ` for "${COMPANY}"`} — ${assets.reduce((s, a) => s + (a.iterationCount || 0), 0)} iteration(s) total`);
  if (DRY) { console.log('(dry-run — nothing written)'); }
  else { writeFileSync(OUT, JSON.stringify(deepScrub(snapshot), null, 2) + '\n'); console.log(`✓ wrote ${OUT}${ALIASES.length ? ` (client-agnostic scrub: ${ALIASES.length} aliases, URLs preserved)` : ''}`); }
} catch (err) {
  console.error('✗ export failed:', err.message); process.exitCode = 1;
} finally { await session.close(); await driver.close(); }
