---
type: journal
status: published
---

## The problem with a PDF archive
<!-- media: graph -->

Rain Bird, the irrigation manufacturer, came to us with 233 product PDFs — 1,331 pages of tech specs, user guides and installation manuals. The content was sound; the PDF format was the problem.

A PDF is a fixed page layout. It is designed for print, not for search, updating, or being read aloud by a machine. Ask a search engine a setup question and an AI summary answers at the top of the results page. It often cites a competitor whose content is structured and web-native. Rain Bird's own answer is better, but it sits inside a heavily formatted PDF that the engine cannot read or quote cleanly.

The useful unit of content has changed. Readers rarely read a whole document; they want one to five specific facts from it. Search engines and AI work at that scale too: they retrieve the *chunk* rather than the *manual*.

## A product range is a graph

A printed manual assumes a straight line: one box, one product, one guide, follow it top to bottom. Real product ranges do not work that way. A typical range behaves like this:

- A controller works with only some sensors.
- One of those sensors is the right pairing.
- That pairing needs an accessory.
- The accessory differs by region.
- A calibration value depends on a setting three pages away.

That is a graph: things, and the relationships between them. It is easier to draw on a whiteboard than to flatten into a list. (Lego generates its step-by-step booklets from this kind of graph.) A linear PDF cannot hold those relationships. To fit them in, the writer generalises the content until every real configuration is *almost* covered and none is covered exactly. The reader then assembles the answer from four documents, or an AI guesses from fragments.

## How we built the graph
<!-- media: graph -->

Phase one is extraction. We split each document into self-contained **chunks** along its table of contents. Where a document had no table of contents, we generated one. We keep lists, tables and images verbatim, and caption them. We classify every chunk against a **DITA taxonomy**, the documentation standard IBM has been running for over twenty years. We then run entity recognition over each chunk to tag the products and features it names.

The output is a queryable **semantic graph**. The 233 documents and 1,331 pages became roughly **1,500 reusable chunks**. Each chunk links to the products it mentions and the topics it belongs to. The original PDFs stay in the graph as source nodes, so every fact traces back to its source document. The graph sits in a graph database on an open schema, so Rain Bird can export it or load it into a content management system later.

## What the graph makes possible

The graph does two things a set of PDFs cannot.

**Documents become views.** The graph assembles chunks from separate sources into one document on request: a setup guide for *this* sensor with *that* controller, built from the relevant chunks even when no legacy PDF covered that pairing.

**Single-source updates.** We found one calibration table copied by hand into five documents and referenced by fifteen more. In the graph it becomes a single canonical chunk that the others link to. Edit that chunk once and every output that carries it updates. Nobody searches for the other copies, and nobody repeats the same edit and the same translation fifteen times. Time-to-publish for that kind of fix drops from weeks to minutes, and the translation cost falls with the duplicate count.

## Archive → system

A library of fixed documents becomes a graph of connected chunks. Each document is then an output the system generates on request. The graph renders to HTML for any web platform, and to a print-ready PDF when someone needs paper.

The remaining work is routine:

- Add the outstanding product-to-feature relationships to the graph.
- Fold in the rest of the duplicates.
- Hand Rain Bird's own team a CMS, so they can publish a corrected procedure without commissioning a designer or restarting a translation cycle.

The schema is theirs, and portable at every step. Three numbers measure the change: AI citation rate, time-to-publish and duplicate count. We baseline each one before the work and count it again after.

Product communication then runs as a system: the content sits in one graph, and every document is generated from it.
