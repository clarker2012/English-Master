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

test("estimateVocabularyRange returns an approximate range from test answers", async () => {
  const core = await loadCore();
  const result = core.estimateVocabularyRange([
    { level: 2, known: true },
    { level: 3, known: true },
    { level: 4, known: false },
    { level: 5, known: false }
  ]);
  assert.deepEqual({ ...result }, {
    estimatedVocabulary: 6000,
    rangeLabel: "5000-6000",
    currentGroupId: 2,
    newWordRatio: 0.15
  });
});

test("generatePassage returns sentences and target words from learner state", async () => {
  const core = await loadCore();
  const state = core.createDefaultState();
  const passage = core.generatePassage(state);
  assert.ok(passage.title.length > 0);
  assert.ok(passage.sentences.length >= 3);
  assert.ok(passage.sentences.length <= 8);
  assert.ok(passage.targetWordIds.length >= 5);
  assert.match(passage.text, /vocabulary|context|practice|review/i);
});

test("applyWordEvent updates mastery score and status", async () => {
  const core = await loadCore();
  const word = {
    id: 1,
    knownScore: 4.3,
    clickCount: 0,
    correctCount: 0,
    wrongCount: 0,
    readCount: 0,
    status: "review"
  };
  const updated = core.applyWordEvent(word, "readSmooth");
  assert.equal(updated.readCount, 1);
  assert.equal(updated.knownScore, 4.6);
  assert.equal(updated.status, "mastered");
});

test("deriveMetrics counts mastered learning and due review words", async () => {
  const core = await loadCore();
  const state = core.createDefaultState();
  state.vocabulary[0].status = "mastered";
  state.vocabulary[1].status = "learning";
  state.vocabulary[2].status = "review";
  const metrics = core.deriveMetrics(state);
  assert.equal(metrics.masteredWords, 1);
  assert.equal(metrics.learningWords, 1);
  assert.equal(metrics.dueReviewWords, 1);
});

test("escapeHtml protects rendered text", async () => {
  const core = await loadCore();
  assert.equal(core.escapeHtml("<word>"), "&lt;word&gt;");
});
