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

function createSyntheticWordBank(size = 10000) {
  return Array.from({ length: size }, (_, index) => ({
    id: index + 1,
    word: `word${index + 1}`,
    zh: `释义${index + 1}；解释${index + 1}`,
    meanings: [`释义${index + 1}`, `解释${index + 1}`],
    phrases: index % 4 === 0 ? [{ term: `phrase ${index + 1}`, meanings: [`短语${index + 1}`, `搭配${index + 1}`] }] : [],
    phonetic: "",
    pos: "n.",
    rank: index + 1
  }));
}

function createMemoryStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem(key) {
      return Object.hasOwn(store, key) ? store[key] : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
    removeItem(key) {
      delete store[key];
    },
    dump() {
      return { ...store };
    }
  };
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
    href: "",
    download: "",
    clicked: false,
    listeners: {},
    classList: {
      toggle() {}
    },
    click() {
      this.clicked = true;
    },
    remove() {
      this.removed = true;
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
    "account-email",
    "account-login",
    "account-logout",
    "account-status",
    "account-guest-status",
    "guest-account-row",
    "profile-account-row",
    "profile-select",
    "profile-name",
    "create-profile",
    "generate-passage",
    "toggle-translation",
    "play-passage",
    "play-sentence",
    "guided-reading",
    "start-speaking",
    "wpm-control",
    "wpm-value",
    "reading-feedback",
    "passage-title",
    "passage",
    "translation",
    "word-card",
    "stats-content",
    "start-test",
    "test-content",
    "export-progress",
    "import-progress",
    "reset-progress",
    "data-status"
  ]) {
    elements.set(id, createFakeElement(id));
  }

  const createdElements = [];
  const appendedElements = [];
  const document = {
    body: {
      appendChild(element) {
        appendedElements.push(element);
        element.appended = true;
        return element;
      }
    },
    domContentLoadedHandler: null,
    addEventListener(type, handler) {
      if (type === "DOMContentLoaded") this.domContentLoadedHandler = handler;
    },
    createElement(tagName) {
      const element = createFakeElement(tagName);
      createdElements.push(element);
      return element;
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
  const revokedUrls = [];
  const timeoutCallbacks = [];
  const context = {
    window: {},
    document,
    localStorage: options.localStorage || { getItem() { return null; }, setItem() {}, removeItem() {} },
    speechSynthesis: undefined,
    Blob,
    URL: options.URL || {
      createObjectURL() { return "blob:test"; },
      revokeObjectURL(url) {
        revokedUrls.push(url);
      }
    },
    setTimeout: options.setTimeout || ((callback) => {
      timeoutCallbacks.push(callback);
      return timeoutCallbacks.length;
    }),
    clearTimeout,
    fetch: options.fetch,
    navigator: options.navigator || {},
    AudioContext: options.AudioContext,
    webkitAudioContext: options.webkitAudioContext,
    requestAnimationFrame: options.requestAnimationFrame || (() => 1),
    cancelAnimationFrame: options.cancelAnimationFrame || (() => {}),
    addEventListener() {},
    console
  };
  if (options.Recognition) {
    context.SpeechRecognition = options.Recognition;
    context.webkitSpeechRecognition = options.Recognition;
  }
  context.window = context;
  vm.createContext(context);
  for (const script of scripts) vm.runInContext(script, context);
  await document.domContentLoadedHandler();
  return { app: context.window.CVT.app, elements, createdElements, appendedElements, revokedUrls, timeoutCallbacks };
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
  assert.equal(result.estimatedVocabulary, 5000);
  assert.equal(result.correctCount, 2);
  assert.equal(result.totalQuestions, 4);
  assert.equal(result.populationSize, 10000);
  assert.ok(result.confidenceLow < result.estimatedVocabulary);
  assert.ok(result.confidenceHigh > result.estimatedVocabulary);
});

test("formatDjPhonetic normalizes mixed source phonetics to British DJ display", async () => {
  const core = await loadCore();

  assert.equal(core.formatDjPhonetic("mjuːˈnɪsɪp(ə)l"), "DJ /mjuːˈnɪsɪpəl/");
  assert.equal(core.formatDjPhonetic("ˈbroʊkən"), "DJ /ˈbrəʊkən/");
  assert.equal(core.formatDjPhonetic("fɔːr; fər"), "DJ /fɔː; fə/");
  assert.equal(core.formatDjPhonetic("NULL"), "");
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

test("default vocabulary meanings use Chinese characters", async () => {
  const core = await loadCore();
  const state = core.createDefaultState();

  for (const word of state.vocabulary) {
    assert.match(word.zh, /[\u4e00-\u9fff]/, `${word.word} meaning should include Chinese characters`);
  }
});

test("default study vocabulary uses IPA phonetics instead of respelling", async () => {
  const core = await loadCore();
  const state = core.createDefaultState();

  assert.equal(state.vocabulary.some((word) => /[A-Z]{2,}|-/.test(word.phonetic)), false);
  assert.ok(state.vocabulary.every((word) => core.formatDjPhonetic(word.phonetic).startsWith("DJ /")));
});

test("generatePassage returns a Chinese translation", async () => {
  const core = await loadCore();
  const state = core.createDefaultState();
  const passage = core.generatePassage(state);

  assert.match(passage.zh, /[\u4e00-\u9fff]/);
  assert.ok(passage.zh.length > 100);
  assert.equal((passage.zh.match(/。/g) || []).length, passage.sentences.length);
});

test("createVocabularyTest returns deterministic questions across levels", async () => {
  const core = await loadCore();
  const state = core.createDefaultState();
  const wordBank = createSyntheticWordBank();
  const questions = core.createVocabularyTest(state, 500, wordBank, () => 0.42);
  const sampledLevels = new Set(questions.map((question) => question.word.level));

  assert.equal(questions.length, 500);
  assert.ok(sampledLevels.size >= 3);
  assert.equal(questions[0].options.length, 4);
  assert.equal(new Set(questions.map((question) => question.word.id)).size, 500);
  assert.ok(questions.some((question) => question.word.word.includes(" ")), "some questions should test phrases");
  assert.ok(questions.every((question) => question.word.zh.includes("；")), "answers should expose multiple meanings when available");
});

test("createVocabularyTest skips entries and options without Chinese meanings", async () => {
  const core = await loadCore();
  const state = core.createDefaultState();
  const wordBank = [
    { id: 1, word: "null-only", zh: "NULL", meanings: [], phrases: [], rank: 1 },
    { id: 2, word: "phrase-only", zh: "NULL", meanings: [], phrases: [{ term: "phrase only", meanings: ["\u77ed\u8bed\u91ca\u4e49", "\u642d\u914d\u91ca\u4e49"] }], rank: 2 },
    ...createSyntheticWordBank(20).map((word, index) => ({ ...word, id: index + 3, rank: index + 3 }))
  ];

  const questions = core.createVocabularyTest(state, 12, wordBank, () => 0.12);
  const allOptions = questions.flatMap((question) => question.options);

  assert.equal(questions.some((question) => question.word.word === "null-only"), false);
  assert.ok(questions.some((question) => question.word.word === "phrase only"));
  assert.equal(allOptions.includes("NULL"), false);
  assert.ok(allOptions.every((option) => /[\u4e00-\u9fff]/.test(option)));
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

test("serializeProgress creates versioned progress JSON with learner state", async () => {
  const core = await loadCore();
  const state = core.createDefaultState();
  const progress = JSON.parse(core.serializeProgress(state));

  assert.equal(progress.version, 1);
  assert.match(progress.exportedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(progress.state.user, JSON.parse(JSON.stringify(state.user)));
  assert.deepEqual(progress.state.vocabulary, JSON.parse(JSON.stringify(state.vocabulary)));
});

test("parseProgress rejects invalid progress payloads", async () => {
  const core = await loadCore();
  assert.throws(() => core.parseProgress("{}"), /Invalid progress file/);
});

test("parseProgress normalizes incomplete progress payloads with safe defaults", async () => {
  const core = await loadCore();
  const defaults = core.createDefaultState();
  const importedWord = {
    id: defaults.vocabulary[0].id,
    word: defaults.vocabulary[0].word,
    phonetic: defaults.vocabulary[0].phonetic,
    pos: defaults.vocabulary[0].pos,
    zh: defaults.vocabulary[0].zh,
    level: defaults.vocabulary[0].level,
    frequencyRank: defaults.vocabulary[0].frequencyRank,
    groupId: defaults.vocabulary[0].groupId,
    example: defaults.vocabulary[0].example,
    knownScore: 3,
    clickCount: 2,
    correctCount: 1,
    wrongCount: 4,
    readCount: 5,
    lastReviewedAt: "2026-05-26",
    nextReviewAt: "2026-05-27",
    status: "review"
  };

  const state = core.parseProgress(JSON.stringify({
    version: 1,
    state: {
      user: { targetWpm: 180 },
      vocabulary: [importedWord]
    }
  }));

  assert.equal(state.user.estimatedVocabulary, defaults.user.estimatedVocabulary);
  assert.equal(state.user.targetWpm, 180);
  assert.deepEqual(Object.keys(state.activity), []);
  assert.equal(state.tests.length, 0);
  assert.equal(state.reading.totalReadCount, defaults.reading.totalReadCount);
  assert.equal(state.reading.lastAccuracy, defaults.reading.lastAccuracy);
  assert.deepEqual(Object.keys(state.reading.studiedWordIdsByDay), []);
  assert.equal(state.vocabulary.length, defaults.vocabulary.length);
  assert.equal(state.vocabulary[0].knownScore, 3);
  assert.equal(state.vocabulary[0].status, "review");
  assert.doesNotThrow(() => core.generatePassage(state));
  assert.doesNotThrow(() => core.deriveMetrics(state));
});

test("parseProgress rejects non-array vocabulary and falls back for unusable vocabulary records", async () => {
  const core = await loadCore();
  const defaults = core.createDefaultState();

  assert.throws(() => core.parseProgress(JSON.stringify({
    version: 1,
    state: { user: {}, vocabulary: {} }
  })), /Invalid progress file/);

  const state = core.parseProgress(JSON.stringify({
    version: 1,
    state: { user: {}, vocabulary: [{ id: defaults.vocabulary[0].id, word: "" }] }
  }));

  assert.equal(state.vocabulary.length, defaults.vocabulary.length);
  assert.deepEqual(state.vocabulary, defaults.vocabulary);
});

test("parseProgress upgrades saved default vocabulary respellings to DJ IPA", async () => {
  const core = await loadCore();
  const defaults = core.createDefaultState();
  const state = core.parseProgress(JSON.stringify({
    version: 1,
    state: {
      user: {},
      vocabulary: [{
        ...defaults.vocabulary[0],
        phonetic: "/AN-uh-lyze/",
        knownScore: 2
      }]
    }
  }));

  assert.equal(state.vocabulary[0].phonetic, defaults.vocabulary[0].phonetic);
  assert.equal(core.formatDjPhonetic(state.vocabulary[0].phonetic), "DJ /əˈnælaɪz/");
  assert.equal(state.vocabulary[0].knownScore, 2);
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
  assert.equal(elements.get("profile-account-row").hidden, true);
});

test("email login creates a local account with a learning role", async () => {
  const storage = createMemoryStorage();
  const { app, elements } = await loadAppWithFakeDocument({ localStorage: storage });

  elements.get("account-email").value = "Learner@Example.com";
  app.loginWithEmail();

  const saved = JSON.parse(storage.getItem("context-vocabulary-trainer-accounts"));
  assert.equal(saved.accounts.length, 1);
  assert.equal(saved.accounts[0].email, "learner@example.com");
  assert.equal(saved.accounts[0].profiles.length, 1);
  assert.equal(elements.get("guest-account-row").hidden, true);
  assert.equal(elements.get("profile-account-row").hidden, false);
  assert.match(elements.get("account-status").textContent, /learner@example.com/);
});

test("one account can switch between independent learning roles", async () => {
  const storage = createMemoryStorage();
  const { app, elements } = await loadAppWithFakeDocument({ localStorage: storage });

  elements.get("account-email").value = "role@example.com";
  app.loginWithEmail();
  const firstProfileId = app.getCurrentAccount().currentProfileId;
  app.state.user.estimatedVocabulary = 7200;
  elements.get("profile-name").value = "Fresh start";
  app.createLearningProfile();

  assert.equal(app.state.user.estimatedVocabulary, 5000);
  assert.equal(app.getCurrentProfile().name, "Fresh start");

  app.switchLearningProfile(firstProfileId);
  assert.equal(app.state.user.estimatedVocabulary, 7200);
  assert.equal(app.getCurrentAccount().profiles.length, 2);
});

test("importProgress leaves current state intact when saving imported progress fails", async () => {
  const storedValues = [];
  const localStorage = {
    getItem() { return null; },
    setItem(_key, value) {
      storedValues.push(value);
      throw new Error("quota exceeded");
    },
    removeItem() {}
  };
  const { app, elements } = await loadAppWithFakeDocument({ localStorage });
  const originalState = app.state;
  const nextState = JSON.parse(JSON.stringify(app.state));
  nextState.user.targetWpm = 190;

  await app.importProgress({
    target: {
      files: [{ text: async () => JSON.stringify({ version: 1, state: nextState }) }],
      value: "progress.json"
    }
  });

  assert.equal(app.state, originalState);
  assert.notEqual(app.state.user.targetWpm, 190);
  assert.match(elements.get("data-status").textContent, /Could not save imported progress/);
  assert.equal(storedValues.length, 1);
});

test("exportProgress appends the download link and revokes the object URL asynchronously", async () => {
  const { app, appendedElements, revokedUrls, timeoutCallbacks } = await loadAppWithFakeDocument();

  app.exportProgress();

  assert.equal(appendedElements.length, 1);
  assert.equal(appendedElements[0].download, "progress.json");
  assert.equal(appendedElements[0].clicked, true);
  assert.equal(appendedElements[0].removed, true);
  assert.deepEqual(revokedUrls, []);

  timeoutCallbacks[0]();
  assert.deepEqual(revokedUrls, ["blob:test"]);
});

test("reading controls bind playback and guided feedback", async () => {
  const { app, elements } = await loadAppWithFakeDocument();
  assert.equal(typeof elements.get("play-passage").listeners.click, "function");
  assert.equal(typeof elements.get("play-sentence").listeners.click, "function");
  assert.equal(typeof elements.get("guided-reading").listeners.click, "function");
  assert.equal(typeof elements.get("start-speaking").listeners.click, "function");

  app.guidedReading();
  assert.match(elements.get("reading-feedback").innerHTML, /AI pronunciation assessment/);
  assert.doesNotMatch(elements.get("reading-feedback").innerHTML, /Smooth|Okay|Difficult/);
});

test("start speaking listens to learner reading and records accuracy feedback", async () => {
  let recognition;
  class SuccessfulRecognition {
    constructor() {
      recognition = this;
    }
    start() {
      this.onresult({
        results: [[{ transcript: "analyze this sentence" }]]
      });
    }
  }
  const { app, elements } = await loadAppWithFakeDocument({ Recognition: SuccessfulRecognition });
  app.passage = {
    title: "Speaking practice",
    sentences: ["Analyze this sentence.", "Practice another line."],
    text: "Analyze this sentence. Practice another line.",
    zh: "朗读练习。",
    targetWordIds: [1, 18]
  };
  app.currentSentenceIndex = 0;
  const beforeFirst = app.state.vocabulary.find((word) => word.id === 1).readCount;
  const beforeSecond = app.state.vocabulary.find((word) => word.id === 18).readCount;

  elements.get("start-speaking").listeners.click();

  assert.ok(recognition, "speech recognition should start");
  assert.equal(app.state.reading.lastAccuracy, 1);
  assert.equal(app.state.vocabulary.find((word) => word.id === 1).readCount, beforeFirst + 1);
  assert.equal(app.state.vocabulary.find((word) => word.id === 18).readCount, beforeSecond);
  assert.match(elements.get("reading-feedback").innerHTML, /Recognized/);
  assert.match(elements.get("reading-feedback").innerHTML, /100%/);
});

test("start speaking requests microphone and renders a voice wave", async () => {
  let recognition;
  class WaitingRecognition {
    constructor() {
      recognition = this;
    }
    start() {}
  }
  const stream = {
    getTracks() {
      return [{ stop() { this.stopped = true; } }];
    }
  };
  class FakeAudioContext {
    createAnalyser() {
      return {
        fftSize: 0,
        getByteTimeDomainData(samples) {
          samples.fill(150);
        }
      };
    }
    createMediaStreamSource() {
      return { connect() {} };
    }
    close() {
      this.closed = true;
    }
  }
  const { app, elements } = await loadAppWithFakeDocument({
    Recognition: WaitingRecognition,
    navigator: {
      mediaDevices: {
        getUserMedia: async (constraints) => {
          assert.deepEqual(constraints, { audio: true });
          return stream;
        }
      }
    }
  });
  app.startMicrophoneMonitor = async () => ({ stream });

  elements.get("start-speaking").listeners.click();

  assert.ok(recognition, "speech recognition should start");
  assert.match(elements.get("reading-feedback").innerHTML, /voice-wave/);
  assert.match(elements.get("reading-feedback").innerHTML, /Listening to your reading/);
  assert.equal(FakeAudioContext.name, "FakeAudioContext");
});

test("microphone monitor reuses an already authorized stream during the page session", async () => {
  let requestCount = 0;
  const track = {
    readyState: "live",
    stopped: false,
    stop() {
      this.stopped = true;
      this.readyState = "ended";
    }
  };
  const stream = {
    getTracks() {
      return [track];
    }
  };
  class FakeAudioContext {
    createAnalyser() {
      return {
        fftSize: 0,
        getByteTimeDomainData(samples) {
          samples.fill(128);
        }
      };
    }
    createMediaStreamSource() {
      return { connect() {} };
    }
    close() {}
  }
  const { app } = await loadAppWithFakeDocument({
    AudioContext: FakeAudioContext,
    navigator: {
      mediaDevices: {
        getUserMedia: async () => {
          requestCount += 1;
          return stream;
        }
      }
    }
  });

  await app.startMicrophoneMonitor();
  app.stopMicrophoneMonitor();
  await app.startMicrophoneMonitor();

  assert.equal(requestCount, 1);
  assert.equal(track.stopped, false);
  app.releaseMicrophone();
  assert.equal(track.stopped, true);
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
  app.applyAutomaticReadingAssessment(app.passage.sentences[0], "analyze this sentence", 1);

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

test("vocabulary test renders 500 objective choice questions without self-assessment", async () => {
  const { app, elements } = await loadAppWithFakeDocument({
    fetch: async () => ({
      ok: true,
      async json() {
        return createSyntheticWordBank();
      }
    })
  });

  await app.startTest();

  assert.equal(app.testSession.questions.length, 500);
  assert.equal(app.testSession.populationSize, 10000);
  assert.doesNotMatch(elements.get("test-content").innerHTML, /id="know-word"|id="unknown-word"/);
  assert.match(elements.get("test-content").innerHTML, /Play pronunciation/);
  assert.match(elements.get("test-content").innerHTML, /Phrase pronunciation|word/);

  const firstQuestion = app.testSession.questions[0];
  const secondQuestion = app.testSession.questions[1];
  app.answerTest(firstQuestion.word.zh);
  app.answerTest("not the answer");

  assert.equal(app.testSession.answers[0].wordId, firstQuestion.word.id);
  assert.equal(app.testSession.answers[0].known, true);
  assert.equal(app.testSession.answers[1].wordId, secondQuestion.word.id);
  assert.equal(app.testSession.answers[1].known, false);
});

test("vocabulary test can return to previous question and overwrite the answer", async () => {
  const { app, elements } = await loadAppWithFakeDocument({
    fetch: async () => ({
      ok: true,
      async json() {
        return createSyntheticWordBank();
      }
    })
  });

  await app.startTest();
  const firstQuestion = app.testSession.questions[0];
  const secondQuestion = app.testSession.questions[1];
  app.answerTest(firstQuestion.word.zh);
  const wrongOption = secondQuestion.options.find((option) => option !== secondQuestion.word.zh);
  app.answerTest(wrongOption);

  app.previousTestQuestion();
  assert.equal(app.testSession.index, 1);
  assert.match(elements.get("test-content").innerHTML, /Previous/);
  assert.match(elements.get("test-content").innerHTML, new RegExp(`Selected: ${wrongOption}`));

  app.answerTest(secondQuestion.word.zh);
  assert.equal(app.testSession.answers.length, 2);
  assert.equal(app.testSession.answers[1].wordId, secondQuestion.word.id);
  assert.equal(app.testSession.answers[1].known, true);
});

test("vocabulary test can be saved and restored after returning", async () => {
  const storage = createMemoryStorage();
  const fetch = async () => ({
    ok: true,
    async json() {
      return createSyntheticWordBank();
    }
  });
  const firstLoad = await loadAppWithFakeDocument({ fetch, localStorage: storage });
  await firstLoad.app.startTest();
  firstLoad.app.answerTest(firstLoad.app.testSession.questions[0].word.zh);
  firstLoad.app.saveTestSession();

  assert.ok(storage.getItem("context-vocabulary-trainer-test-session"));
  assert.match(firstLoad.elements.get("test-content").innerHTML, /Saved/);

  const secondLoad = await loadAppWithFakeDocument({ fetch, localStorage: storage });
  assert.equal(secondLoad.app.testSession.index, 1);
  assert.equal(secondLoad.app.testSession.questions.length, 500);
  assert.equal(secondLoad.app.testSession.answers[0].known, true);
  assert.match(secondLoad.elements.get("test-content").innerHTML, /Question 2 of 500/);
});

test("stale 36-question saved tests are discarded", async () => {
  const storage = createMemoryStorage({
    "context-vocabulary-trainer-test-session": JSON.stringify({
      version: 1,
      savedAt: "2026-05-29T00:00:00.000Z",
      session: {
        questions: createSyntheticWordBank(36).map((word) => ({ word, options: [word.zh] })),
        index: 1,
        answers: [],
        result: null,
        populationSize: 36
      }
    })
  });

  const { app, elements } = await loadAppWithFakeDocument({
    localStorage: storage,
    fetch: async () => ({
      ok: true,
      async json() {
        return createSyntheticWordBank();
      }
    })
  });

  assert.equal(app.testSession.questions.length, 0);
  assert.equal(storage.getItem("context-vocabulary-trainer-test-session"), null);
  await app.startTest();
  assert.equal(app.testSession.questions.length, 500);
  assert.match(elements.get("test-content").innerHTML, /Question 1 of 500/);
});

test("vocabulary test does not fall back to the small local study vocabulary", async () => {
  const { app, elements } = await loadAppWithFakeDocument({
    fetch: async () => ({
      ok: false,
      async json() {
        return [];
      }
    })
  });

  await app.startTest();

  assert.equal(app.testSession.questions.length, 0);
  assert.match(elements.get("test-content").innerHTML, /10,000-word assessment bank did not load/);
});

test("vocabulary test pronunciation button speaks the current term", async () => {
  const { app, elements } = await loadAppWithFakeDocument({
    fetch: async () => ({
      ok: true,
      async json() {
        return createSyntheticWordBank();
      }
    })
  });
  let spoken = "";
  app.speak = (text) => {
    spoken = text;
  };

  await app.startTest();
  const question = app.testSession.questions[0];

  assert.match(elements.get("test-content").innerHTML, /Play pronunciation/);
  app.playTestPronunciation();
  assert.equal(spoken, question.word.word);
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
  assert.match(elements.get("word-card").innerHTML, /DJ \//);
  app.showTranslation = true;
  app.render();
  assert.match(elements.get("word-card").innerHTML, /analyze/);
  assert.match(elements.get("word-card").innerHTML, /DJ \//);
});

test("escapeHtml protects rendered text", async () => {
  const core = await loadCore();
  assert.equal(core.escapeHtml("<word>"), "&lt;word&gt;");
});
