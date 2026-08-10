---
type: journal
status: published
---

## Chunk-pinned media
<!-- media: gallery 2.png, 3.png, 4.png, IconGenerator.png -->

You follow an instruction and scroll to the next line. The diagram that line refers to moves off the top of the screen. You scroll back up to check it, then down again to keep reading. Product documentation has worked this way for twenty years.

Here the **panel stays in place for the whole chunk** — a diagram, a photo, a gallery like this one. It swaps only when you scroll into the next chunk, and the swap uses a soft transition. A chunk with nothing new to show keeps the last panel. The image a passage depends on stays on screen for as long as you are reading that passage.

In technical content, the picture carries the instruction: wiring diagrams, part callouts, spec tables. When the reader loses sight of the picture, the instruction fails. We use this pattern in our own journal first, so you can see it working before we build it into your documentation.

## Entries, chunks, versioned refs
<!-- media: image IconGenerator.png -->

The gallery on the landing page lists **entries**. We store each entry as **chunks** rather than one block of text, in the same shape as the databases we build for clients. The dotted spine beside the article shows one dot per chunk. Click a dot to jump to that chunk. An entry with one chunk shows no dots, because there is nowhere to jump to.

Entry → chunks → media refs. Those refs are **versioned files on S3, served through a CDN**. This page is fetched from `content/` as markdown, and its images resolve from the bucket. The same vocabulary runs end to end. We write in Obsidian, publish as markdown, and lay the page out with the same module system that renders the rest of the site. The journal is a working instance of how we work.
