#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Export ONE asset (by uuid) + everything transitively linked to it (the CONTAINS_ASSET
// closure) from the Graffold Neo4j DB (READ-only) into the site snapshot. Each asset carries
// its full iteration tree + links, so the website graph is fully navigable from that node.
//
//   node publish/export-asset.mjs <asset-uuid> [--depth 3] [--out content/graffold-snapshot.json]
//
// Start the Graffold DB first; creds auto-load from ../Graffold/.env. LOCAL/showcase use — the
// COMMITTED content/graffold-snapshot.json should stay the empty gated export unless the asset's
// project is public (see the printed project/public flags before deciding to commit/deploy).
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const argv = process.argv.slice(2);
const UUID = argv.find(a => !a.startsWith('--'));
if (!UUID) { console.error('usage: node publish/export-asset.mjs <asset-uuid> [--depth N] [--out path]'); process.exit(1); }
const di = argv.indexOf('--depth'); const MAXDEPTH = di >= 0 ? (+argv[di + 1] || 3) : 3;
const oi = argv.indexOf('--out'); const OUT = oi >= 0 ? resolve(REPO, argv[oi + 1]) : join(REPO, 'content', 'graffold-snapshot.json');

let cdnBase = '';
const cfgPath = join(HERE, 'publish.config.json');
if (existsSync(cfgPath)) { try { cdnBase = JSON.parse(readFileSync(cfgPath, 'utf8')).cdnBase || ''; } catch {} }
const S3_HOST_RE = /^https?:\/\/ddspreviewimages\.s3[.-][a-z0-9-]*\.amazonaws\.com\//i;
const cdn = url => (cdnBase && typeof url === 'string' && S3_HOST_RE.test(url)) ? url.replace(S3_HOST_RE, cdnBase) : url;

if (!process.env.NEO4J_URI) {
  const envPath = process.env.GRAFFOLD_ENV || resolve(REPO, '..', 'Graffold', '.env');
  if (existsSync(envPath)) for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) { const m = /^\s*(NEO4J_[A-Z_]+)\s*=\s*(.*)\s*$/.exec(line); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
}
const uri = process.env.NEO4J_URI, pass = process.env.NEO4J_PASSWORD, user = process.env.NEO4J_USER || 'neo4j';
if (!uri || !pass) { console.error("✗ NEO4J_URI/PASSWORD not set — start the Graffold DB and source ../Graffold/.env"); process.exit(1); }
let neo4j; try { neo4j = (await import('neo4j-driver')).default; } catch { console.error('✗ neo4j-driver not installed. Run:  npm i neo4j-driver'); process.exit(1); }
const driver = neo4j.driver(uri, neo4j.auth.basic(user, pass));
const session = driver.session({ defaultAccessMode: 'READ' });
const num = v => (v && typeof v === 'object' && typeof v.toNumber === 'function') ? v.toNumber() : v;

const assetByUuid = async uuid => (await session.run(
  `MATCH (a:Asset {uuid: $uuid})
   OPTIONAL MATCH (a)<-[:ITERATION_OF]-(i:Iteration)
   OPTIONAL MATCH (a)-[:CREATED_FOR]->(p:Project)
   WITH a, p, count(i) AS ic, max(i.timeStamp) AS lit
   RETURN a.uuid AS id, a.label AS name, a.assetFileName AS fileName, a.preview AS preview, a.notes AS notes,
          a.contentType AS contentType, a.authoringSoftware AS authoringSoftware, p.label AS project, p.public AS projectPublic, ic AS iterationCount, lit AS latestIterationTime`,
  { uuid })).records[0] || null;

const treeOf = async uuid => {
  const iRes = await session.run(
    `MATCH (a:Asset {uuid: $uuid})<-[:ITERATION_OF]-(i:Iteration)
     OPTIONAL MATCH (i)-[:CHILD_OF]->(parent:Iteration)
     RETURN i.uuid AS uuid, i.label AS label, i.generation AS generation, i.timeStamp AS timeStamp, i.status AS status, i.preview AS preview, parent.uuid AS parentUuid`,
    { uuid });
  const byUuid = new Map();
  for (const r of iRes.records) byUuid.set(r.get('uuid'), { uuid: r.get('uuid'), label: r.get('label') || '', generation: String(r.get('generation') ?? ''), timeStamp: num(r.get('timeStamp')), status: r.get('status') || [], preview: cdn(r.get('preview')), _parent: r.get('parentUuid'), children: [] });
  let root = null;
  for (const n of byUuid.values()) { const p = n._parent && byUuid.get(n._parent); if (p) p.children.push(n); else if (!root || n.generation === '1') root = n; }
  byUuid.forEach(n => { delete n._parent; n.children.sort((x, y) => (num(x.timeStamp) || 0) - (num(y.timeStamp) || 0)); });
  return root;
};

const linksOf = async uuid => (await session.run(
  `MATCH (a:Asset {uuid: $uuid})<-[:ITERATION_OF]-(:Iteration)-[:CONTAINS_ASSET]->(linked:Asset)
   RETURN DISTINCT linked.uuid AS id, linked.label AS name, linked.assetFileName AS fileName, linked.preview AS preview`,
  { uuid })).records.map(r => ({ id: r.get('id'), name: r.get('name') || '', fileName: r.get('fileName') || '', preview: cdn(r.get('preview')), relation: 'CONTAINS_ASSET' }));

try {
  const start = await assetByUuid(UUID);
  if (!start) { console.error('✗ no Asset with uuid', UUID); process.exit(1); }
  const visited = new Set(), queue = [{ uuid: UUID, depth: 0 }], collected = new Map();
  while (queue.length) {
    const { uuid, depth } = queue.shift();
    if (visited.has(uuid)) continue; visited.add(uuid);
    const rec = await assetByUuid(uuid); if (!rec || !rec.get('fileName')) continue;
    const tree = await treeOf(uuid), links = await linksOf(uuid);
    collected.set(uuid, { rec, tree, links });
    if (depth < MAXDEPTH) for (const l of links) if (l.id && !visited.has(l.id)) queue.push({ uuid: l.id, depth: depth + 1 });
  }
  const assets = [];
  for (const { rec, tree, links } of collected.values()) {
    if (!tree) continue;
    assets.push({ id: rec.get('id'), name: rec.get('name') || rec.get('fileName'), fileName: rec.get('fileName'), preview: cdn(rec.get('preview')), project: rec.get('project') || '', contentType: rec.get('contentType') || '', authoringSoftware: rec.get('authoringSoftware') || '', notes: rec.get('notes') || '', iterationCount: num(rec.get('iterationCount')), latestIterationTime: num(rec.get('latestIterationTime')), tree, linkedAssets: links });
  }
  writeFileSync(OUT, JSON.stringify({ company: { label: 'Doran Design Studio', generatedNote: `Subgraph of asset ${UUID} (depth ${MAXDEPTH}) — local/showcase, not the gated export.` }, assets }, null, 2) + '\n');
  console.log(`✓ ${assets.length} asset(s) in the subgraph of ${UUID} → ${OUT}`);
  console.log(`  START: "${start.get('name')}"  project="${start.get('project')}"  project.public=${start.get('projectPublic')}  authoring=${start.get('authoringSoftware')}`);
  assets.forEach(a => console.log(`   - ${a.name}  [${a.authoringSoftware}]  links:${a.linkedAssets.length}  iters:${a.iterationCount}  project:${a.project || '—'}`));
} catch (e) { console.error('✗ export failed:', e.message); process.exitCode = 1; }
finally { await session.close(); await driver.close(); }
