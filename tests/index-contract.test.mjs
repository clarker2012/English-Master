import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("index.html contains the required app sections", () => {
  for (const id of [
    "dashboard",
    "study-view",
    "test-view",
    "stats-view",
    "data-view",
    "passage",
    "word-card",
    "export-progress",
    "import-progress",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `missing #${id}`);
  }
});

test("index.html exposes the CVT app namespace", () => {
  assert.match(html, /window\.CVT/);
  assert.match(html, /core:/);
  assert.match(html, /app:/);
});
