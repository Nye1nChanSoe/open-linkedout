import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseFragment, type DefaultTreeAdapterTypes } from "parse5";

import { parseJobStructure } from "./job-detail-structure-parser.js";

type Fixture = { name: string; jobId: number; html: string; title?: string };

// Excerpts from linkedout.db, with presentation attributes removed. Tests do
// not require the local database or depend on its contents staying unchanged.
const fixtures: Fixture[] = JSON.parse(
  readFileSync(new URL("./fixtures/job-descriptions.json", import.meta.url), "utf8"),
);

function fixture(name: string): Fixture {
  const found = fixtures.find((item) => item.name === name);
  assert.ok(found, `Missing fixture ${name}`);
  return found;
}

type Node = DefaultTreeAdapterTypes.Node;

function sourceText(node: Node): string {
  if (node.nodeName === "#text") {
    return (node as DefaultTreeAdapterTypes.TextNode).value;
  }
  return "childNodes" in node ? node.childNodes.map(sourceText).join("") : "";
}

function countListItems(node: Node): number {
  return ("tagName" in node && node.tagName === "li" ? 1 : 0) +
    ("childNodes" in node
      ? node.childNodes.reduce((count, child) => count + countListItems(child), 0)
      : 0);
}

function compact(text: string): string {
  return text.replace(/\s+/g, "");
}

for (const item of fixtures) {
  test(`preserves content and order from job ${item.jobId}: ${item.name}`, () => {
    const { sections } = parseJobStructure(item.html, item.title);
    const actual = sections.flatMap((section) => [
      section.heading ?? "",
      ...section.blocks.map((block) => block.text),
    ]).join("");
    const expected = sourceText(parseFragment(item.html)).replace(/About the job/gi, "");
    assert.equal(compact(actual), compact(expected));

    if (item.name.startsWith("nested-") || item.name.startsWith("orphan-")) {
      assert.equal(
        sections.flatMap((section) => section.blocks).filter((block) => block.kind === "bullet").length,
        countListItems(parseFragment(item.html)),
        "Every list item should become a separate bullet",
      );
    }

    if (item.name.startsWith("poster-")) {
      assert.equal(sections.length, 1);
      assert.equal(sections[0].sectionType, "requirements");
      assert.equal(sections[0].heading, "Requirements added by the job poster");
      assert.ok(sections[0].blocks.every((block) => block.text.startsWith("•")));
    }
  });
}

test("body keywords do not split responsibilities into requirements (job 48)", () => {
  const { sections } = parseJobStructure(fixture("layout-48").html);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].sectionType, "responsibilities");
  assert.equal(sections[0].blocks.length, 16);
  assert.equal(sections[0].blocks[1].text, "performance, cost, and latency requirements");
});

test("retains a parent heading before a subsection (job 63)", () => {
  const { sections } = parseJobStructure(fixture("layout-63").html);
  assert.equal(sections[0].heading, "Key Responsibilities");
  assert.equal(sections[0].sectionType, "responsibilities");
  assert.equal(sections[1].heading, "Architecture & Solution Design");
  assert.equal(sections[1].blocks.length, 5);
});

test("keeps single-br section boundaries (TikTok jobs 13 and 38)", () => {
  const { sections } = parseJobStructure(fixture("layout-38").html);
  assert.deepEqual(sections.map((section) => section.heading), [
    "Responsibilities", "Responsibilities:", "Qualifications",
    "Preferred Qualifications", "About TikTok", "Why Join Us",
  ]);
  const selection = parseJobStructure(fixture("layout-13").html).sections;
  assert.ok(selection.some((section) => section.heading === "Selection Process" && section.sectionType === "process"));
});

test("specific aliases take precedence over company prefixes", () => {
  for (const [heading, expected] of [
    ["About You", "requirements"],
    ["✨ About You", "requirements"],
    ["About This Role", "overview"],
    ["Must Have:", "requirements"],
  ]) {
    const { sections } = parseJobStructure(`<p>${heading}</p><ul><li>Content</li></ul>`);
    assert.equal(sections[0].sectionType, expected, heading);
  }
});

test("keywords still classify headings supported by markup or lists", () => {
  const { sections } = parseJobStructure(
    "<p><strong>Core Qualifications (Must-Haves):</strong></p><p>Content</p>" +
    "<p>Knowledge &amp; Expertise</p><ul><li>Content</li></ul>",
  );
  assert.deepEqual(sections.map((section) => section.sectionType), ["requirements", "requirements"]);
});
