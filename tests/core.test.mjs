import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import assert from "node:assert/strict";

async function loadCore() {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  const context = {
    window: {},
    document: { addEventListener() {} },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    speechSynthesis: undefined,
    Blob,
    URL: { createObjectURL() { return "blob:test"; }, revokeObjectURL() {} },
    setTimeout,
    clearTimeout,
    console
  };
  context.window = context;
  vm.createContext(context);
  for (const script of scripts) vm.runInContext(script, context);
  return context.window.CVT.core;
}

test("default state matches MVP learning defaults", async () => {
  const core = await loadCore();
  const state = core.createDefaultState();
  assert.equal(state.user.estimatedVocabulary, 5000);
  assert.equal(state.user.currentGroupId, 1);
  assert.equal(state.user.newWordRatio, 0.1);
  assert.equal(state.user.targetWpm, 140);
  assert.ok(state.vocabulary.length >= 30);
});

test("mock vocabulary has required future-compatible fields", async () => {
  const core = await loadCore();
  const state = core.createDefaultState();
  for (const word of state.vocabulary) {
    for (const key of [
      "id",
      "word",
      "phonetic",
      "pos",
      "zh",
      "level",
      "frequencyRank",
      "groupId",
      "example",
      "knownScore",
      "clickCount",
      "correctCount",
      "wrongCount",
      "readCount",
      "lastReviewedAt",
      "nextReviewAt",
      "status"
    ]) {
      assert.ok(Object.hasOwn(word, key), `${word.word} missing ${key}`);
    }
  }
});
