# DDS content publish (the local "Graffold" step)

Syncs journal markdown from the Obsidian vault → S3 (behind the CloudFront CDN) and regenerates the manifest the site reads. **Text only** — images are uploaded separately (paste their CDN URLs into the markdown chunk markers).

## One-time
```bash
npm i @aws-sdk/client-s3           # only needed for the real S3 upload
aws configure                      # or set AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in env
```
Edit `publish.config.json` — one entry per journal article: its `vaultPath` (the .md in your vault) plus the display metadata (`slug · title · kicker · dek · date · order`). Those manifest fields override the file's own front matter.

## Publish
```bash
node publish/publish.mjs --dry-run   # preview what would upload to S3
node publish/publish.mjs             # upload the .md files + content/manifest.json to s3://ddspreviewimages/content/
node publish/publish.mjs --local     # instead, sync into ./content for LOCAL testing (no AWS)
```

## How it fits
- The site (`grid-system.html`) fetches `ASSET_BASE + content/manifest.json`, then each entry's `.md`, and parses front matter + `## heading` chunks. `ASSET_BASE` is `''` (local) today; set it to `https://cdn.dorandesign.studio/` once the CDN is live (see *Runbook — S3 + CloudFront CDN* in the vault).
- Chunk media markers (standalone line, right after the heading):
  - `<!--illus:tokens-->` — a live renderer (tokens · type · grid · modules · buffer · graph)
  - `<!--media: image graffold:A_CartonTemplate_Bat-ProLaunch.ai -->` — **a Graffold ref** (recommended)
  - `<!--media: image https://cdn.dorandesign.studio/diagram.png -->` — a raw URL
  - `<!--media: gallery graffold:A_x.ai, https://cdn…/y.png -->` — mix refs and URLs
  - `<!--skip-->` — keep a `##` section in the file but off the site
- The manifest is the **publish layer** (what shows, in what order) — the Graffold "current asset" pointer, done as a file for now.

## Graffold refs (the real source of image URLs)

Rather than paste image URLs, reference the **Graffold DB item** and let publish resolve its current preview link:
- `graffold:A_<name>.ai` → the **Asset**'s `preview` (the S3 URL of the *current* committed iteration's PNG — auto-updates when you promote a new `currentAsset`).
- `graffold:I_<name>_v3.1.ai` → a specific **Iteration**'s `preview` (pinned/immutable — use for a case study that shouldn't move).

At publish, `publish.mjs` queries Neo4j (`Asset.assetFileName` / `Iteration.iterationFileName` → `.preview`), rewrites the S3 host to `cdnBase`, and bakes the resolved URL into the published markdown/manifest. The site never touches the database. Needs:
```bash
npm i neo4j-driver
export NEO4J_URI=…  NEO4J_USER=neo4j  NEO4J_PASSWORD=…   # or `source` Graffold's .env
```
Schema reference: `/Users/dorandesignstudio/Graffold/SCHEMA.md`.
