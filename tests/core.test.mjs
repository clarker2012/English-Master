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

function createFakeElement(id, className = "") {
  return {
    id,
    className,
    dataset: {},
    hidden: false,
    innerHTML: "",
    textContent: "",
    value: "",
    listeners: {},
    classList: {
      toggle() {}
    },
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    querySelectorAll(selector) {
      if (selector !== "[data-reading-event]" || !this.innerHTML.includes("data-reading-event")) return [];
      this.readingButtons = ["readSmooth", "readOkay", "readDifficult"].map((eventName) => ({
        dataset: { readingEvent: eventName },
        listeners: {},
        addEventListener(type, handler) {
          this.listeners[type] = handler;
        }
      }));
      return this.readingButtons;
    }
  };
}

async function loadAppWithFakeDocument(options = {}) {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  const elements = new Map();
  const tabs = ["study-view", "test-view", "stats-view", "data-view"].map((viewId) => {
    const tab = createFakeElement(`tab-${viewId}`, "tab");
    tab.dataset.view = viewId;
    return tab;
  });
  const views = ["study-view", "test-view", "stats-view", "data-view"].map((id) => createFakeElement(id, "view"));
  for (const element of views) elements.set(element.id, element);
  for (const id of [
    "dashboard",
    "generate-passage",
    "toggle-translation",
    "play-passage",
    "play-sentence",
    "guided-reading",
    "wpm-control",
    "wpm-value",
    "reading-feedback",
    "passage-title",
    "passage",
    "translation",
    "word-card",
    "stats-content",
    "start-test",
    "test-content"
  ]) {
    elements.set(id, createFakeElement(id));
  }

  const document = {
    domContentLoadedHandler: null,
    addEventListener(type, handler) {
      if (type === "DOMContentLoaded") this.domContentLoadedHandler = handler;
    },
    getElementById(id) {
      return elements.get(id) || null;
    },
    querySelectorAll(selector) {
      if (selector === ".tab") return tabs;
      if (selector === ".view") return views;
      if (selector === ".word-token") return [];
      if (selector === ".test-option") return [];
      return [];
    }
  };
  const context = {
    window: {},
    document,
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    speechSynthesis: undefined,
    Blob,
    URL: { createObjectURL() { return "blob:test"; }, revokeObjectURL() {} },
    setTimeout,
    clearTimeout,
    console
  };
  if (options.Recognition) {
    context.SpeechRecognition = options.Recognition;
    context.webkitSpeechRecognition = options.Recognition;
  }
  context.window = context;
  vm.createContext(context);
  for (const script of scripts) vm.runInContext(script, context);
  document.domContentLoadedHandler();
  return { app: context.window.CVT.app, elements };
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

test("createVocabularyTest returns deterministic questions across levels", async () => {
  const core = await loadCore();
  const state = core.createDefaultState();
  const questions = core.createVocabularyTest(state, 8);
  const sampledLevels = new Set(questions.map((question) => question.word.level));

  assert.equal(questions.length, 8);
  assert.ok(sampledLevels.size >= 3);
  assert.equal(questions[0].options.length, 4);
});

test("createVocabularyTest keeps option labels unique when meanings repeat", async () => {
  const core = await loadCore();
  const state = core.createDefaultState();
  const include = state.vocabulary.find((word) => word.word === "include");
  const sentence = state.vocabulary.find((word) => word.word === "sentence");
  include.zh = "shared repeated label";
  sentence.zh = "shared repeated label";

  const uniqueMeanings = new Set(state.vocabulary.map((word) => word.zh));
  const questions = core.createVocabularyTest(state, 8);

  assert.ok(uniqueMeanings.size >= 4);
  for (const question of questions) {
    assert.equal(question.options.length, 4, `${question.word.word} should have 4 options`);
    assert.equal(new Set(question.options).size, question.options.length, `${question.word.word} has duplicate options`);
    assert.ok(question.options.includes(question.word.zh), `${question.word.word} is missing the correct answer`);
  }
});

test("createVocabularyTest varies distractors across early questions", async () => {
  const core = await loadCore();
  const state = core.createDefaultState();
  const questions = core.createVocabularyTest(state, 8);
  const distractorSignatures = questions.slice(0, 6).map((question) => (
    question.options.filter((option) => option !== question.word.zh).sort().join("|")
  ));

  assert.ok(state.vocabulary.length >= 8);
  assert.ok(new Set(distractorSignatures).size >= 4);
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

test("localDateKey formats a local calendar day without UTC conversion", async () => {
  const core = await loadCore();
  assert.equal(core.localDateKey(new Date(2026, 0, 2)), "2026-01-02");
});

test("deriveMetrics reads today's activity using localDateKey", async () => {
  const core = await loadCore();
  const state = core.createDefaultState();
  core.localDateKey = () => "2099-12-31";
  state.activity["2099-12-31"] = { studiedWords: 7, readCount: 3 };
  const metrics = core.deriveMetrics(state);
  assert.equal(metrics.todayStudiedWords, 7);
  assert.equal(metrics.todayReadCount, 3);
});

test("mapWpmToRate maps reading speed to speech synthesis rate", async () => {
  const core = await loadCore();
  assert.equal(core.mapWpmToRate(120), 0.8);
  assert.equal(core.mapWpmToRate(160), 1.1);
  assert.equal(core.mapWpmToRate(200), 1.4);
});

test("textSimilarity scores near readings above unrelated text", async () => {
  const core = await loadCore();
  assert.ok(core.textSimilarity("read the passage aloud", "read passage aloud") > 0.7);
  assert.ok(core.textSimilarity("read the passage aloud", "different words") < 0.5);
});

test("getSentenceTargetWordIds returns only target words present in that sentence", async () => {
  const core = await loadCore();
  const state = core.createDefaultState();
  const passage = {
    sentences: [
      "Analyze this sentence carefully.",
      "The benefit arrives later."
    ],
    targetWordIds: [1, 3, 23]
  };

  assert.deepEqual([...core.getSentenceTargetWordIds(state, passage, 0)], [1, 23]);
  assert.deepEqual([...core.getSentenceTargetWordIds(state, passage, 1)], [3]);
});

test("app init renders dashboard passage and word card through DOMContentLoaded", async () => {
  const { elements } = await loadAppWithFakeDocument();
  assert.match(elements.get("dashboard").innerHTML, /Vocabulary/);
  assert.match(elements.get("passage").innerHTML, /word-token/);
  assert.match(elements.get("word-card").innerHTML, /Select a highlighted word/);
});

test("reading controls bind playback and guided feedback", async () => {
  const { app, elements } = await loadAppWithFakeDocument();
  assert.equal(typeof elements.get("play-passage").listeners.click, "function");
  assert.equal(typeof elements.get("play-sentence").listeners.click, "function");
  assert.equal(typeof elements.get("guided-reading").listeners.click, "function");

  app.guidedReading();
  assert.match(elements.get("reading-feedback").innerHTML, /Smooth/);
  assert.match(elements.get("reading-feedback").innerHTML, /Okay/);
  assert.match(elements.get("reading-feedback").innerHTML, /Difficult/);
});

test("guided reading resumes active sentence and feedback advances with scoped word updates", async () => {
  const { app, elements } = await loadAppWithFakeDocument();
  app.passage = {
    title: "Scoped practice",
    sentences: [
      "Analyze this sentence.",
      "Benefit comes next."
    ],
    text: "Analyze this sentence. Benefit comes next.",
    zh: "",
    targetWordIds: [1, 3]
  };
  app.currentSentenceIndex = 1;
  app.guidedActive = true;

  app.guidedReading();
  assert.equal(app.currentSentenceIndex, 1);

  app.currentSentenceIndex = 0;
  app.promptReadFeedback(app.passage.sentences[0]);
  const smoothButton = elements.get("reading-feedback").readingButtons.find((button) => (
    button.dataset.readingEvent === "readSmooth"
  ));
  smoothButton.listeners.click();

  assert.equal(app.state.vocabulary.find((word) => word.id === 1).readCount, 1);
  assert.equal(app.state.vocabulary.find((word) => word.id === 3).readCount, 0);
  assert.equal(app.currentSentenceIndex, 1);
  assert.match(elements.get("reading-feedback").innerHTML, /Continue|Next/);
});

test("reading activity counts unique studied target words without repeat accumulation", async () => {
  const { app } = await loadAppWithFakeDocument();
  app.passage = {
    title: "Activity practice",
    sentences: [
      "Analyze this sentence.",
      "Analyze this sentence again.",
      "Benefit comes next."
    ],
    text: "Analyze this sentence. Analyze this sentence again. Benefit comes next.",
    zh: "",
    targetWordIds: [1, 3]
  };
  app.recordReadingActivity([1]);
  app.recordReadingActivity([1]);
  app.recordReadingActivity([3]);

  const todayEntry = app.state.activity[Object.keys(app.state.activity)[0]];
  assert.equal(todayEntry.studiedWords, 2);
  assert.equal(todayEntry.readCount, 3);
});

test("speech recognition start errors show fallback text without throwing", async () => {
  class ThrowingRecognition {
    start() {
      throw new Error("permission denied");
    }
  }
  const { app, elements } = await loadAppWithFakeDocument({ Recognition: ThrowingRecognition });
  const speechFeedback = createFakeElement("speech-feedback");
  elements.set("speech-feedback", speechFeedback);

  assert.doesNotThrow(() => app.trySpeechRecognition("Analyze this sentence."));
  assert.match(speechFeedback.textContent, /Could not start speech recognition|Speech recognition unavailable/);
});

test("full render preserves the selected word card", async () => {
  const { app, elements } = await loadAppWithFakeDocument();
  app.selectWord(1);
  assert.match(elements.get("word-card").innerHTML, /analyze/);
  app.showTranslation = true;
  app.render();
  assert.match(elements.get("word-card").innerHTML, /analyze/);
});

test("escapeHtml protects rendered text", async () => {
  const core = await loadCore();
  assert.equal(core.escapeHtml("<word>"), "&lt;word&gt;");
});
