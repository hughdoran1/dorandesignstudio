---
type: journal
status: published
---

## Chunk-pinned media
<!-- media: gallery 2.png, 3.png, 4.png, IconGenerator.png -->

In a traditional article the image is inline: you scroll, it leaves. Here the **panel is pinned for the whole chunk** — a diagram, a photo, or a gallery like this one — and swaps with an animated transition when you cross into the next chunk. A chunk without media keeps the previous panel.

For product and technical documentation — wiring diagrams, part callouts, spec tables — the reader should never lose the picture the text is talking about. That is the point of the pattern, and why it lives here.

## Entries, chunks, versioned refs
<!-- media: image IconGenerator.png -->

The gallery on the landing lists **entries**. Articles are stored as **chunks** — the same shape as the studio's databases — and the dotted spine beside the text tracks them: one dot per chunk (a one-chunk article shows none), click a dot to jump.

Entry → chunks → media refs, and now those refs are **versioned files on S3, served through the CDN**. This very page is fetched from `content/`, its images resolved from the bucket. One vocabulary, end to end — authored in Obsidian, published as markdown, rendered by the module system.
