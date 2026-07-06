#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// DDS content publish — the local "Graffold" step. Syncs journal markdown from the
// Obsidian vault to S3 (behind the CloudFront CDN), REGENERATES the manifest the
// site reads, and RESOLVES graffold: media refs → the Graffold DB item's current
// preview URL (rewritten to the CDN host) so the site never touches Neo4j.
//
//   node publish/publish.mjs --local     # resolve refs + copy .md + write manifest into ./content (local test)
//   node publish/publish.mjs --dry-run   # resolve refs, print the S3 plan, upload nothing
//   node publish/publish.mjs             # resolve refs, upload .md + manifest to S3 (needs AWS creds)
//
// graffold: refs in markdown/cover fields, e.g.
//   <!-- media: image graffold:A_CartonTemplate_Bat-ProLaunch.ai -->   → Asset.preview (CURRENT, auto-updates)
//   <!-- media: image graffold:I_CartonTemplate_Bat-ProLaunch_v3.1.ai -->  → Iteration.preview (PINNED)
// resolve to that node's `preview` (S3 URL of the preview PNG) via Neo4j, then the S3 host is rewritten to
// cfg.cdnBase. Needs NEO4J_URI / NEO4J_PASSWORD in the env (source Graffold's .env) + `npm i neo4j-driver`.
// Config: publish/publish.config.json → { bucket, region, prefix, cdnBase, entries[] }.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const args = new Set(process.argv.slice(2));
const LOCAL = args.has('--local');
const DRY = args.has('--dry-run');

const cfgPath = join(HERE, 'publish.config.json');
if (!existsSync(cfgPath)) { console.error(`✗ missing ${cfgPath}`); process.exit(1); }
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const prefix = cfg.prefix || 'content/';
const cdnBase = cfg.cdnBase || '';                       // '' → leave raw S3 URLs (works while the bucket is public)
const S3_HOST_RE = /^https?:\/\/ddspreviewimages\.s3[.-][a-z0-9-]*\.amazonaws\.com\//i;
const CACHE_TEXT = 'public, max-age=60, stale-while-revalidate=86400';

// Read entry markdown from the vault up front (fail before uploading anything).
const docs = cfg.entries.map(e => {
  if (!existsSync(e.vaultPath)) { console.error(`✗ vault file not found: ${e.vaultPath}`); process.exit(1); }
  return { file: e.file, body: readFileSync(e.vaultPath, 'utf8'), from: e.vaultPath };
});
const manifest = { entries: cfg.entries.map(({ vaultPath, ...m }) => m) };

// ── Resolve graffold:<filename> refs → the DB item's current preview URL ─────────────────────────────
const REF_RE = /graffold:([\w.+-]+)/g;
const collect = str => { const s = new Set(); let m; REF_RE.lastIndex = 0; while ((m = REF_RE.exec(str || ''))) s.add(m[1]); return [...s]; };
const allRefs = new Set();
for (const d of docs) collect(d.body).forEach(r => allRefs.add(r));
for (const e of manifest.entries) collect(e.cover).forEach(r => allRefs.add(r));

if (allRefs.size) {
  const uri = process.env.NEO4J_URI, pass = process.env.NEO4J_PASSWORD, user = process.env.NEO4J_USER || 'neo4j';
  if (!uri || !pass) { console.error(`✗ ${allRefs.size} graffold: ref(s) found but NEO4J_URI / NEO4J_PASSWORD not set. Source Graffold's .env (or export them) and retry.`); process.exit(1); }
  let neo4j; try { neo4j = (await import('neo4j-driver')).default; }
  catch { console.error('✗ neo4j-driver not installed. Run:  npm i neo4j-driver'); process.exit(1); }
  const driver = neo4j.driver(uri, neo4j.auth.basic(user, pass));
  const session = driver.session({ defaultAccessMode: 'READ' });
  const map = {};
  try {
    // A_ → Asset.assetFileName (current preview); I_ → Iteration.iterationFileName (pinned preview). Try both.
    const res = await session.run(
      `UNWIND $names AS name
       OPTIONAL MATCH (a:Asset {assetFileName: name})
       OPTIONAL MATCH (i:Iteration {iterationFileName: name})
       RETURN name AS name, coalesce(a.preview, i.preview) AS preview`,
      { names: [...allRefs] });
    for (const rec of res.records) map[rec.get('name')] = rec.get('preview');
  } catch (err) { console.error('✗ Neo4j query failed:', err.message); process.exit(1); }
  finally { await session.close(); await driver.close(); }

  const missing = [...allRefs].filter(r => !map[r]);
  if (missing.length) { console.error('✗ no preview found in Graffold for: ' + missing.join(', ')); process.exit(1); }

  const rewrite = url => (cdnBase && S3_HOST_RE.test(url)) ? url.replace(S3_HOST_RE, cdnBase) : url;
  const sub = str => (str || '').replace(REF_RE, (_, name) => rewrite(map[name]));
  for (const d of docs) d.body = sub(d.body);
  for (const e of manifest.entries) if (e.cover) e.cover = sub(e.cover);
  console.log(`  resolved ${allRefs.size} graffold ref(s) → preview link(s)${cdnBase ? ' → CDN host' : ' (raw S3 host — set cdnBase to rewrite)'}`);
}

const manifestJson = JSON.stringify(manifest, null, 2) + '\n';   // after resolution (covers may have changed)

// ── Emit ─────────────────────────────────────────────────────────────────────────────────────────────
if (LOCAL) {
  const outDir = join(REPO, 'content'); mkdirSync(outDir, { recursive: true });
  for (const d of docs) { if (!DRY) writeFileSync(join(outDir, d.file), d.body); console.log(`  ${DRY ? '[dry] ' : ''}content/${d.file}  ← ${d.from}`); }
  if (!DRY) writeFileSync(join(outDir, 'manifest.json'), manifestJson);
  console.log(`  ${DRY ? '[dry] ' : ''}content/manifest.json  (${manifest.entries.length} entries)`);
  console.log(`✓ local sync ${DRY ? '(dry run) ' : ''}done → ${outDir}`);
  process.exit(0);
}
if (DRY) {
  console.log(`[dry] would upload to s3://${cfg.bucket}/${prefix} (region ${cfg.region}):`);
  for (const d of docs) console.log(`  ${prefix}${d.file}   (${d.body.length} bytes, text/markdown)`);
  console.log(`  ${prefix}manifest.json   (${manifestJson.length} bytes, application/json)`);
  process.exit(0);
}
let S3, PutObjectCommand;
try { ({ S3Client: S3, PutObjectCommand } = await import('@aws-sdk/client-s3')); }
catch { console.error('✗ @aws-sdk/client-s3 not installed. Run:  npm i @aws-sdk/client-s3'); process.exit(1); }
const s3 = new S3({ region: cfg.region });
const put = (key, body, type) => s3.send(new PutObjectCommand({ Bucket: cfg.bucket, Key: key, Body: body, ContentType: type, CacheControl: CACHE_TEXT }));
try {
  for (const d of docs) { await put(prefix + d.file, d.body, 'text/markdown; charset=utf-8'); console.log(`  ↑ ${prefix}${d.file}`); }
  await put(prefix + 'manifest.json', manifestJson, 'application/json'); console.log(`  ↑ ${prefix}manifest.json`);
  console.log(`✓ published ${docs.length} entries + manifest to s3://${cfg.bucket}/${prefix}`);
} catch (err) { console.error('✗ upload failed:', err.message); process.exit(1); }
