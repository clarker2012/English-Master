# Context Vocabulary Trainer MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build the local-first Context Vocabulary Trainer MVP as a directly runnable single-page `index.html` app with tests for the core learning logic.

**Architecture:** Keep the shipped app in one self-contained `index.html` file, as required by the product spec. Put pure learning logic on `window.CVT.core` so it can be tested without browser UI, while UI state and DOM rendering stay in `window.CVT.app`.

**Tech Stack:** Native HTML, CSS, JavaScript, browser `localStorage`, Web Speech API, optional SpeechRecognition, and Node's built-in test runner for implementation verification.

---

## File Structure

- Create `index.html`: Complete runnable app with HTML, CSS, mock vocabulary, pure core functions, DOM rendering, TTS, SpeechRecognition fallback, localStorage, and import/export.
- Create `package.json`: Minimal npm scripts for `node --test`; no runtime dependencies.
- Create `tests/core.test.mjs`: Node tests for vocabulary estimation, passage generation, mastery updates, persistence payload shape, and import validation.
- Create `tests/index-contract.test.mjs`: Static contract tests that read `index.html` and verify required UI sections and global API markers exist.
- Modify `docs/superpowers/plans/2026-05-26-context-vocabulary-trainer-mvp.md`: Check off tasks during execution.

The MVP stays dependency-free at runtime. The tests intentionally exercise pure functions and static app contracts instead of trying to automate every browser interaction.

---

### Task 1: Add Test Harness and Static App Contract Tests

**Files:**
- Create: `package.json`
- Create: `tests/index-contract.test.mjs`
- Create: `index.html`

- [x] **Step 1: Write the failing static contract test**

Create `tests/index-contract.test.mjs`:

```javascript
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
```

- [x] **Step 2: Add npm test script**

Create `package.json`:

```json
{
  "name": "context-vocabulary-trainer",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
```

- [x] **Step 3: Run test to verify it fails**

Run:

```powershell
npm test
```

Expected: FAIL because `index.html` does not exist yet.

- [x] **Step 4: Create minimal app shell**

Create `index.html` with this minimal shell:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Context Vocabulary Trainer</title>
</head>
<body>
  <main>
    <section id="dashboard"></section>
    <section id="study-view">
      <article id="passage"></article>
      <aside id="word-card"></aside>
    </section>
    <section id="test-view"></section>
    <section id="stats-view"></section>
    <section id="data-view">
      <button id="export-progress" type="button">Export progress</button>
      <input id="import-progress" type="file" accept="application/json">
    </section>
  </main>
  <script>
    window.CVT = {
      core: {},
      app: {}
    };
  </script>
</body>
</html>
```

- [x] **Step 5: Run test to verify it passes**

Run:

```powershell
npm test
```

Expected: PASS for `tests/index-contract.test.mjs`.

- [x] **Step 6: Commit**

Run:

```powershell
git add package.json tests/index-contract.test.mjs index.html
git commit -m "test: add app contract harness"
```

---

### Task 2: Add Core Data Model and Vocabulary Fixtures

**Files:**
- Modify: `index.html`
- Create: `tests/core.test.mjs`

- [x] **Step 1: Write failing tests for initial state and vocabulary shape**

Create `tests/core.test.mjs`:

```javascript
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
```

- [x] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test
```

Expected: FAIL because `createDefaultState` is missing.

- [x] **Step 3: Add core defaults and 30+ vocabulary items**

Replace the script body in `index.html` with:

```html
<script>
  const mockVocabulary = [
    ["analyze", "/AN-uh-lyze/", "v.", "fen xi", 4, 1200, "We need to analyze the results carefully."],
    ["approach", "/uh-PROHCH/", "n./v.", "fang fa; jie jin", 3, 900, "Her approach made the problem easier."],
    ["benefit", "/BEN-uh-fit/", "n./v.", "hao chu; shou yi", 3, 850, "Daily reading can benefit your vocabulary."],
    ["context", "/KON-tekst/", "n.", "yu jing", 4, 1500, "The context helps explain the meaning."],
    ["define", "/di-FYNE/", "v.", "ding yi", 3, 1300, "Can you define this word in English?"],
    ["estimate", "/ES-tuh-mayt/", "v./n.", "gu suan", 4, 1700, "The test can estimate your vocabulary range."],
    ["evidence", "/EV-uh-dens/", "n.", "zheng ju", 4, 1100, "The evidence supports the idea."],
    ["focus", "/FOH-kus/", "n./v.", "zhuan zhu", 2, 700, "Focus on words you meet often."],
    ["generate", "/JEN-uh-rayt/", "v.", "sheng cheng", 4, 1800, "The app can generate a short passage."],
    ["identify", "/eye-DEN-tuh-fye/", "v.", "shi bie", 4, 1400, "Try to identify the key word."],
    ["improve", "/im-PROOV/", "v.", "ti gao", 2, 650, "Speaking practice can improve fluency."],
    ["include", "/in-KLOOD/", "v.", "bao kuo", 2, 500, "Each card should include an example."],
    ["increase", "/in-KREES/", "v.", "zeng jia", 2, 600, "Review can increase your known score."],
    ["method", "/METH-ud/", "n.", "fang fa", 3, 1000, "This method mixes review and new words."],
    ["native", "/NAY-tiv/", "adj.", "mu yu de", 3, 1600, "The tool is for native Chinese speakers."],
    ["option", "/OP-shun/", "n.", "xuan xiang", 3, 1250, "Choose the best option."],
    ["passage", "/PAS-ij/", "n.", "duan wen", 4, 1900, "Read the passage aloud."],
    ["practice", "/PRAK-tis/", "n./v.", "lian xi", 2, 750, "Regular practice builds confidence."],
    ["progress", "/PROG-res/", "n.", "jin bu", 3, 950, "Your progress is saved locally."],
    ["recognize", "/REK-ug-nyze/", "v.", "ren chu", 4, 1450, "Do you recognize this word?"],
    ["review", "/ri-VYOO/", "n./v.", "fu xi", 2, 800, "Review difficult words more often."],
    ["schedule", "/SKEJ-ool/", "n./v.", "ji hua; an pai", 4, 2100, "The review schedule changes over time."],
    ["sentence", "/SEN-tens/", "n.", "ju zi", 2, 550, "Listen to one sentence at a time."],
    ["similarity", "/sim-uh-LAR-uh-tee/", "n.", "xiang si du", 5, 2600, "Speech recognition can estimate similarity."],
    ["smooth", "/SMOOTH/", "adj.", "liu chang", 3, 1550, "Mark the reading as smooth if it felt easy."],
    ["source", "/SORS/", "n.", "lai yuan", 3, 1350, "Compare your speech with the source text."],
    ["status", "/STAY-tus/", "n.", "zhuang tai", 4, 1750, "Each word has a learning status."],
    ["structure", "/STRUK-cher/", "n.", "jie gou", 4, 1650, "A clear structure helps learning."],
    ["support", "/suh-PORT/", "v./n.", "zhi chi", 2, 680, "The browser may support speech recognition."],
    ["target", "/TAR-get/", "n./v.", "mu biao", 3, 1050, "Target words are highlighted."],
    ["translate", "/trans-LAYT/", "v.", "fan yi", 3, 1150, "You can translate the passage."],
    ["update", "/up-DAYT/", "v.", "geng xin", 3, 1180, "The app will update your score."],
    ["visual", "/VIZH-oo-ul/", "adj.", "shi jue de", 4, 2200, "Visual markers show word status."],
    ["vocabulary", "/voh-KAB-yuh-lair-ee/", "n.", "ci hui", 2, 400, "Vocabulary grows through repeated use."],
    ["available", "/uh-VAY-luh-bul/", "adj.", "ke yong de", 3, 980, "Manual feedback is available in every browser."],
    ["accurate", "/AK-yur-it/", "adj.", "zhun que de", 4, 2000, "The estimate is useful but not perfectly accurate."]
  ].map((item, index) => ({
    id: index + 1,
    word: item[0],
    phonetic: item[1],
    pos: item[2],
    zh: item[3],
    level: item[4],
    frequencyRank: item[5],
    groupId: Math.floor(index / 10) + 1,
    example: item[6],
    knownScore: 0,
    clickCount: 0,
    correctCount: 0,
    wrongCount: 0,
    readCount: 0,
    lastReviewedAt: "",
    nextReviewAt: "",
    status: "new"
  }));

  const core = {
    createDefaultState() {
      return {
        user: {
          estimatedVocabulary: 5000,
          currentGroupId: 1,
          masteredWords: 0,
          learningWords: 0,
          newWordRatio: 0.1,
          targetWpm: 140,
          totalStudyMinutes: 0,
          streakDays: 0
        },
        vocabulary: mockVocabulary.map((word) => ({ ...word })),
        activity: {},
        tests: [],
        reading: { totalReadCount: 0, lastAccuracy: null }
      };
    }
  };

  window.CVT = { core, app: {} };
</script>
```

- [x] **Step 4: Run tests to verify they pass**

Run:

```powershell
npm test
```

Expected: PASS.

- [x] **Step 5: Commit**

Run:

```powershell
git add index.html tests/core.test.mjs
git commit -m "feat: add vocabulary data model"
```

---

### Task 3: Implement Core Learning Logic

**Files:**
- Modify: `index.html`
- Modify: `tests/core.test.mjs`

- [x] **Step 1: Add failing tests for vocabulary estimation, passage generation, and mastery updates**

Append to `tests/core.test.mjs`:

```javascript
test("estimateVocabularyRange returns an approximate range from test answers", async () => {
  const core = await loadCore();
  const result = core.estimateVocabularyRange([
    { level: 2, known: true },
    { level: 3, known: true },
    { level: 4, known: false },
    { level: 5, known: false }
  ]);
  assert.deepEqual(result, {
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
```

- [x] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test
```

Expected: FAIL because the new core functions are missing.

- [x] **Step 3: Add core functions**

Inside `const core = { ... }` in `index.html`, add these methods after `createDefaultState()`:

```javascript
    estimateVocabularyRange(answers) {
      const knownLevels = answers.filter((answer) => answer.known).map((answer) => answer.level);
      const averageKnownLevel = knownLevels.length
        ? knownLevels.reduce((sum, level) => sum + level, 0) / knownLevels.length
        : 1;
      const hardestKnown = Math.max(1, ...knownLevels);
      const score = Math.round((averageKnownLevel + hardestKnown) / 2);
      const bands = {
        1: { estimatedVocabulary: 4000, rangeLabel: "4000-5000", currentGroupId: 1, newWordRatio: 0.1 },
        2: { estimatedVocabulary: 5000, rangeLabel: "4000-5000", currentGroupId: 1, newWordRatio: 0.1 },
        3: { estimatedVocabulary: 6000, rangeLabel: "5000-6000", currentGroupId: 2, newWordRatio: 0.15 },
        4: { estimatedVocabulary: 8000, rangeLabel: "6000-8000", currentGroupId: 3, newWordRatio: 0.2 },
        5: { estimatedVocabulary: 10000, rangeLabel: "8000-10000", currentGroupId: 4, newWordRatio: 0.25 }
      };
      return bands[Math.min(5, Math.max(1, score))];
    },

    chooseTargetWords(state) {
      const dueWords = state.vocabulary.filter((word) => word.status === "review");
      const newWords = state.vocabulary.filter((word) => word.status === "new" && word.groupId <= state.user.currentGroupId + 1);
      const familiarWords = state.vocabulary.filter((word) => word.status === "learning" || word.status === "mastered");
      return [...dueWords.slice(0, 3), ...newWords.slice(0, 6), ...familiarWords.slice(0, 3)].slice(0, 10);
    },

    generatePassage(state) {
      const targets = this.chooseTargetWords(state);
      const fallback = state.vocabulary.slice(0, 8);
      const words = targets.length >= 5 ? targets : fallback;
      const [first, second, third, fourth, fifth, sixth, seventh, eighth] = words;
      const sentences = [
        `A clear ${first.word} helps you notice useful English in context.`,
        `When you ${second.word} a short passage, the meaning becomes easier to remember.`,
        `Daily ${third.word} can improve listening, speaking, and reading confidence.`,
        `Use each ${fourth.word} with an example instead of memorizing it alone.`,
        `After review, the app can ${fifth.word} your progress and choose the next words.`
      ];
      if (sixth && seventh && eighth) {
        sentences.push(`This simple ${sixth.word} gives visual feedback while you ${seventh.word} and ${eighth.word} new vocabulary.`);
      }
      return {
        title: "Context Practice Session",
        sentences,
        text: sentences.join(" "),
        zh: "閫氳繃鐭枃銆佸涔犲拰鏈楄锛屾妸鐩爣璇嶆斁杩涚湡瀹炶澧冧腑瀛︿範銆?,
        targetWordIds: words.map((word) => word.id)
      };
    },

    clampScore(score) {
      return Math.max(0, Math.min(5, Math.round(score * 10) / 10));
    },

    applyWordEvent(word, eventName) {
      const updated = { ...word };
      if (eventName === "click") {
        updated.clickCount += 1;
      }
      if (eventName === "testCorrect") {
        updated.correctCount += 1;
        updated.knownScore = this.clampScore(updated.knownScore + 0.5);
      }
      if (eventName === "testWrong") {
        updated.wrongCount += 1;
        updated.knownScore = this.clampScore(updated.knownScore - 0.5);
      }
      if (eventName === "readSmooth") {
        updated.readCount += 1;
        updated.knownScore = this.clampScore(updated.knownScore + 0.3);
      }
      if (eventName === "readOkay") {
        updated.readCount += 1;
        updated.knownScore = this.clampScore(updated.knownScore + 0.1);
      }
      if (eventName === "readDifficult") {
        updated.readCount += 1;
      }
      if (updated.knownScore >= 4.5) updated.status = "mastered";
      else if (updated.knownScore >= 2) updated.status = "learning";
      else if (updated.wrongCount > 0 || updated.readCount > 0) updated.status = "review";
      return updated;
    }
```

- [x] **Step 4: Run tests to verify they pass**

Run:

```powershell
npm test
```

Expected: PASS.

- [x] **Step 5: Commit**

Run:

```powershell
git add index.html tests/core.test.mjs
git commit -m "feat: add learning core logic"
```

---

### Task 4: Build App Layout and Navigation

**Files:**
- Modify: `index.html`
- Modify: `tests/index-contract.test.mjs`

- [x] **Step 1: Add failing static tests for navigation labels and controls**

Append to `tests/index-contract.test.mjs`:

```javascript
test("index.html includes main navigation and study controls", () => {
  for (const text of [
    "Study",
    "Test",
    "Stats",
    "Data",
    "Generate passage",
    "Show Chinese",
    "Play passage",
    "Guided reading"
  ]) {
    assert.match(html, new RegExp(text));
  }
});
```

- [x] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test
```

Expected: FAIL because the app shell lacks real controls.

- [x] **Step 3: Replace body with complete layout**

Replace the `<body>...</body>` content in `index.html` with a complete app shell:

```html
<body>
  <div class="app-shell">
    <header class="app-header">
      <div>
        <p class="eyebrow">Local learning tool</p>
        <h1>Context Vocabulary Trainer</h1>
      </div>
      <nav class="tabs" aria-label="Main sections">
        <button class="tab is-active" data-view="study-view" type="button">Study</button>
        <button class="tab" data-view="test-view" type="button">Test</button>
        <button class="tab" data-view="stats-view" type="button">Stats</button>
        <button class="tab" data-view="data-view" type="button">Data</button>
      </nav>
    </header>

    <section id="dashboard" class="dashboard" aria-label="Learning dashboard"></section>

    <main>
      <section id="study-view" class="view is-active">
        <section class="study-layout">
          <article class="panel passage-panel">
            <div class="panel-header">
              <div>
                <p class="eyebrow">Current passage</p>
                <h2 id="passage-title">Context Practice Session</h2>
              </div>
              <button id="generate-passage" type="button">Generate passage</button>
            </div>
            <article id="passage" class="passage"></article>
            <p id="translation" class="translation" hidden></p>
          </article>

          <aside class="side-column">
            <section id="word-card" class="panel word-card" aria-live="polite"></section>
            <section class="panel controls">
              <h2>Reading controls</h2>
              <label class="range-label" for="wpm-control">WPM <span id="wpm-value">140</span></label>
              <input id="wpm-control" type="range" min="120" max="200" value="140" step="5">
              <div class="button-grid">
                <button id="toggle-translation" type="button">Show Chinese</button>
                <button id="play-passage" type="button">Play passage</button>
                <button id="play-sentence" type="button">Play sentence</button>
                <button id="guided-reading" type="button">Guided reading</button>
              </div>
              <div id="reading-feedback" class="feedback"></div>
            </section>
          </aside>
        </section>
      </section>

      <section id="test-view" class="view" hidden>
        <div class="panel test-panel">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Vocabulary estimate</p>
              <h2>Quick range test</h2>
            </div>
            <button id="start-test" type="button">Start test</button>
          </div>
          <div id="test-content"></div>
        </div>
      </section>

      <section id="stats-view" class="view" hidden>
        <div id="stats-content" class="stats-grid"></div>
      </section>

      <section id="data-view" class="view" hidden>
        <div class="panel data-panel">
          <h2>Progress data</h2>
          <div class="button-grid">
            <button id="export-progress" type="button">Export progress</button>
            <label class="file-button" for="import-progress">Import progress</label>
            <input id="import-progress" type="file" accept="application/json">
            <button id="reset-progress" class="danger" type="button">Reset progress</button>
          </div>
          <p class="muted">Vocabulary JSON import is reserved for the full 20,000-word version.</p>
          <pre id="data-status" aria-live="polite"></pre>
        </div>
      </section>
    </main>
  </div>
  <script>
```

Keep the existing JavaScript content after the opening `<script>` tag, then close with:

```html
  </script>
</body>
```

- [x] **Step 4: Add responsive CSS**

Add inside `<head>` after `<title>`:

```html
<style>
  :root {
    color-scheme: light;
    --bg: #f6f7f4;
    --surface: #ffffff;
    --ink: #1e2528;
    --muted: #64706f;
    --line: #dbe1dc;
    --accent: #216b5b;
    --accent-2: #b85c38;
    --review: #7b5ea7;
    --new: #d99422;
    --mastered: #477a54;
    --danger: #b43b3b;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--ink);
    font-family: Arial, "Microsoft YaHei", sans-serif;
    line-height: 1.5;
  }
  button, input { font: inherit; }
  button, .file-button {
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--ink);
    border-radius: 8px;
    padding: 10px 12px;
    cursor: pointer;
  }
  button:hover, .file-button:hover { border-color: var(--accent); }
  .app-shell { max-width: 1180px; margin: 0 auto; padding: 24px; }
  .app-header {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: end;
    margin-bottom: 18px;
  }
  h1, h2, h3, p { margin-top: 0; }
  h1 { font-size: 28px; margin-bottom: 0; }
  h2 { font-size: 20px; }
  .eyebrow {
    color: var(--accent);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .tabs { display: flex; flex-wrap: wrap; gap: 8px; }
  .tab.is-active { background: var(--accent); color: white; border-color: var(--accent); }
  .dashboard {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 18px;
  }
  .metric, .panel {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 16px;
  }
  .metric strong { display: block; font-size: 22px; }
  .metric span, .muted { color: var(--muted); }
  .view[hidden] { display: none; }
  .study-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 340px;
    gap: 16px;
    align-items: start;
  }
  .panel-header {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: start;
    margin-bottom: 12px;
  }
  .passage {
    font-size: 18px;
    line-height: 1.9;
  }
  .word-token {
    border: 0;
    border-bottom: 2px solid transparent;
    background: transparent;
    padding: 1px 2px;
    border-radius: 4px;
  }
  .word-token.status-new { border-bottom-color: var(--new); background: #fff3d9; }
  .word-token.status-learning, .word-token.status-review { border-bottom-color: var(--review); background: #f1ebfb; }
  .word-token.status-mastered { border-bottom-color: var(--mastered); color: var(--mastered); }
  .sentence-active { background: #edf7f3; border-radius: 6px; }
  .translation {
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid var(--line);
    color: var(--muted);
  }
  .side-column { display: grid; gap: 16px; }
  .button-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .range-label { display: flex; justify-content: space-between; margin-bottom: 6px; }
  input[type="range"] { width: 100%; margin-bottom: 12px; }
  input[type="file"] { max-width: 100%; }
  .file-button { display: inline-block; text-align: center; }
  .danger { color: var(--danger); border-color: #e7b7b7; }
  .stats-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  pre { white-space: pre-wrap; overflow: auto; }
  @media (max-width: 820px) {
    .app-shell { padding: 14px; }
    .app-header { align-items: stretch; flex-direction: column; }
    .dashboard { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .study-layout { grid-template-columns: 1fr; }
    .stats-grid { grid-template-columns: 1fr; }
    .button-grid { grid-template-columns: 1fr; }
  }
</style>
```

- [x] **Step 5: Run tests to verify they pass**

Run:

```powershell
npm test
```

Expected: PASS.

- [x] **Step 6: Commit**

Run:

```powershell
git add index.html tests/index-contract.test.mjs
git commit -m "feat: add app layout"
```

---

### Task 5: Render Dashboard, Passage, Word Card, and Navigation

**Files:**
- Modify: `index.html`
- Modify: `tests/core.test.mjs`

- [x] **Step 1: Add failing tests for metric derivation and passage token markup**

Append to `tests/core.test.mjs`:

```javascript
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
```

- [x] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test
```

Expected: FAIL because `deriveMetrics` and `escapeHtml` are missing.

- [x] **Step 3: Add core helpers**

Add these methods to `core`:

```javascript
    deriveMetrics(state) {
      const masteredWords = state.vocabulary.filter((word) => word.status === "mastered").length;
      const learningWords = state.vocabulary.filter((word) => word.status === "learning").length;
      const dueReviewWords = state.vocabulary.filter((word) => word.status === "review").length;
      const todayKey = new Date().toISOString().slice(0, 10);
      const today = state.activity[todayKey] || { studiedWords: 0, readCount: 0 };
      return {
        masteredWords,
        learningWords,
        dueReviewWords,
        todayStudiedWords: today.studiedWords || 0,
        todayReadCount: today.readCount || 0
      };
    },

    escapeHtml(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    },

    findWordByText(state, text) {
      const normalized = text.toLowerCase().replace(/[^a-z]/g, "");
      return state.vocabulary.find((word) => word.word.toLowerCase() === normalized);
    }
```

- [x] **Step 4: Add app state and render functions**

After `window.CVT = { core, app: {} };`, add:

```javascript
  const app = {
    state: core.createDefaultState(),
    passage: null,
    currentSentenceIndex: 0,
    showTranslation: false,

    init() {
      this.passage = core.generatePassage(this.state);
      this.bindEvents();
      this.render();
    },

    bindEvents() {
      document.querySelectorAll(".tab").forEach((button) => {
        button.addEventListener("click", () => this.showView(button.dataset.view));
      });
      document.getElementById("generate-passage").addEventListener("click", () => {
        this.passage = core.generatePassage(this.state);
        this.currentSentenceIndex = 0;
        this.render();
      });
      document.getElementById("toggle-translation").addEventListener("click", () => {
        this.showTranslation = !this.showTranslation;
        this.render();
      });
      document.getElementById("wpm-control").addEventListener("input", (event) => {
        this.state.user.targetWpm = Number(event.target.value);
        this.render();
      });
    },

    showView(viewId) {
      document.querySelectorAll(".view").forEach((view) => {
        const active = view.id === viewId;
        view.hidden = !active;
        view.classList.toggle("is-active", active);
      });
      document.querySelectorAll(".tab").forEach((tab) => {
        tab.classList.toggle("is-active", tab.dataset.view === viewId);
      });
      this.render();
    },

    render() {
      this.renderDashboard();
      this.renderPassage();
      this.renderWordCard(null);
      this.renderStats();
      document.getElementById("wpm-control").value = this.state.user.targetWpm;
      document.getElementById("wpm-value").textContent = this.state.user.targetWpm;
      document.getElementById("toggle-translation").textContent = this.showTranslation ? "Hide Chinese" : "Show Chinese";
    },

    renderDashboard() {
      const metrics = core.deriveMetrics(this.state);
      document.getElementById("dashboard").innerHTML = [
        ["Vocabulary", `${this.state.user.estimatedVocabulary}`],
        ["Mastered", metrics.masteredWords],
        ["Today", metrics.todayStudiedWords],
        ["WPM", this.state.user.targetWpm],
        ["New words", `${Math.round(this.state.user.newWordRatio * 100)}%`]
      ].map(([label, value]) => `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`).join("");
    },

    renderPassage() {
      document.getElementById("passage-title").textContent = this.passage.title;
      const targetIds = new Set(this.passage.targetWordIds);
      document.getElementById("passage").innerHTML = this.passage.sentences.map((sentence, sentenceIndex) => {
        const words = sentence.split(/(\s+)/).map((part) => {
          const word = core.findWordByText(this.state, part);
          if (!word || !targetIds.has(word.id)) return core.escapeHtml(part);
          return `<button class="word-token status-${word.status}" data-word-id="${word.id}" type="button">${core.escapeHtml(part)}</button>`;
        }).join("");
        return `<span class="sentence ${sentenceIndex === this.currentSentenceIndex ? "sentence-active" : ""}" data-sentence-index="${sentenceIndex}">${words}</span>`;
      }).join(" ");
      document.getElementById("translation").hidden = !this.showTranslation;
      document.getElementById("translation").textContent = this.passage.zh;
      document.querySelectorAll(".word-token").forEach((button) => {
        button.addEventListener("click", () => this.selectWord(Number(button.dataset.wordId)));
      });
    },

    selectWord(wordId) {
      const index = this.state.vocabulary.findIndex((word) => word.id === wordId);
      this.state.vocabulary[index] = core.applyWordEvent(this.state.vocabulary[index], "click");
      this.renderWordCard(this.state.vocabulary[index]);
      this.renderDashboard();
      this.renderPassage();
    },

    renderWordCard(word) {
      const card = document.getElementById("word-card");
      if (!word) {
        card.innerHTML = `<p class="eyebrow">Word details</p><h2>Select a highlighted word</h2><p class="muted">Click a target word in the passage to inspect pronunciation, meaning, and example usage.</p>`;
        return;
      }
      card.innerHTML = `<p class="eyebrow">${word.status}</p><h2>${core.escapeHtml(word.word)}</h2><p>${core.escapeHtml(word.phonetic)} 路 ${core.escapeHtml(word.pos)}</p><p><strong>${core.escapeHtml(word.zh)}</strong></p><p>${core.escapeHtml(word.example)}</p><p class="muted">Known score: ${word.knownScore}/5 路 Clicks: ${word.clickCount}</p>`;
    },

    renderStats() {
      const metrics = core.deriveMetrics(this.state);
      document.getElementById("stats-content").innerHTML = [
        ["Study days", this.state.user.streakDays],
        ["Total reads", this.state.reading.totalReadCount],
        ["Mastered", metrics.masteredWords],
        ["Learning", metrics.learningWords],
        ["Due review", metrics.dueReviewWords],
        ["Estimate", this.state.user.estimatedVocabulary]
      ].map(([label, value]) => `<div class="panel"><p class="eyebrow">${label}</p><h2>${value}</h2></div>`).join("");
    }
  };

  window.CVT.app = app;
  document.addEventListener("DOMContentLoaded", () => app.init());
```

- [x] **Step 5: Run tests to verify they pass**

Run:

```powershell
npm test
```

Expected: PASS.

- [x] **Step 6: Commit**

Run:

```powershell
git add index.html tests/core.test.mjs
git commit -m "feat: render study dashboard"
```

---

### Task 6: Implement Vocabulary Test Flow

**Files:**
- Modify: `index.html`
- Modify: `tests/core.test.mjs`

- [x] **Step 1: Add failing tests for test question creation**

Append to `tests/core.test.mjs`:

```javascript
test("createVocabularyTest samples questions across levels", async () => {
  const core = await loadCore();
  const state = core.createDefaultState();
  const questions = core.createVocabularyTest(state, 8);
  assert.equal(questions.length, 8);
  assert.ok(new Set(questions.map((question) => question.word.level)).size >= 3);
  assert.equal(questions[0].options.length, 4);
});
```

- [x] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test
```

Expected: FAIL because `createVocabularyTest` is missing.

- [x] **Step 3: Add test creation helper**

Add to `core`:

```javascript
    createVocabularyTest(state, size = 10) {
      const sorted = [...state.vocabulary].sort((a, b) => a.level - b.level || a.frequencyRank - b.frequencyRank);
      const buckets = [1, 2, 3, 4, 5].flatMap((level) => sorted.filter((word) => word.level === level).slice(0, 3));
      return buckets.slice(0, size).map((word) => {
        const distractors = sorted
          .filter((candidate) => candidate.id !== word.id)
          .slice(0, 3)
          .map((candidate) => candidate.zh);
        return {
          word,
          options: [word.zh, ...distractors].slice(0, 4)
        };
      });
    }
```

- [x] **Step 4: Add app test flow**

Add these properties to `app`:

```javascript
    testSession: { questions: [], index: 0, answers: [], result: null },
```

Add these event bindings inside `bindEvents()`:

```javascript
      document.getElementById("start-test").addEventListener("click", () => this.startTest());
```

Add these app methods:

```javascript
    startTest() {
      this.testSession = {
        questions: core.createVocabularyTest(this.state, 10),
        index: 0,
        answers: [],
        result: null
      };
      this.renderTest();
    },

    answerTest(known, selectedZh = "") {
      const question = this.testSession.questions[this.testSession.index];
      const isCorrect = selectedZh ? selectedZh === question.word.zh : known;
      this.testSession.answers.push({ level: question.word.level, known: Boolean(isCorrect) });
      const wordIndex = this.state.vocabulary.findIndex((word) => word.id === question.word.id);
      this.state.vocabulary[wordIndex] = core.applyWordEvent(this.state.vocabulary[wordIndex], isCorrect ? "testCorrect" : "testWrong");
      this.testSession.index += 1;
      if (this.testSession.index >= this.testSession.questions.length) {
        this.testSession.result = core.estimateVocabularyRange(this.testSession.answers);
        Object.assign(this.state.user, this.testSession.result);
        this.state.tests.push({ ...this.testSession.result, completedAt: new Date().toISOString() });
      }
      this.render();
      this.renderTest();
    },

    renderTest() {
      const container = document.getElementById("test-content");
      if (!this.testSession.questions.length) {
        container.innerHTML = `<p class="muted">Start a quick test to estimate a vocabulary range.</p>`;
        return;
      }
      if (this.testSession.result) {
        container.innerHTML = `<h3>Estimated range: ${this.testSession.result.rangeLabel}</h3><p>Recommended group: ${this.testSession.result.currentGroupId}</p><button type="button" data-view="study-view" class="go-study">Go to study</button>`;
        container.querySelector(".go-study").addEventListener("click", () => this.showView("study-view"));
        return;
      }
      const question = this.testSession.questions[this.testSession.index];
      container.innerHTML = `<p class="muted">Question ${this.testSession.index + 1} of ${this.testSession.questions.length}</p><h3>${core.escapeHtml(question.word.word)}</h3><div class="button-grid">${question.options.map((option) => `<button type="button" class="answer-option" data-option="${core.escapeHtml(option)}">${core.escapeHtml(option)}</button>`).join("")}</div><div class="button-grid"><button type="button" id="know-word">I know this word</button><button type="button" id="unknown-word">I do not know it</button></div>`;
      container.querySelectorAll(".answer-option").forEach((button) => {
        button.addEventListener("click", () => this.answerTest(false, button.dataset.option));
      });
      document.getElementById("know-word").addEventListener("click", () => this.answerTest(true));
      document.getElementById("unknown-word").addEventListener("click", () => this.answerTest(false));
    }
```

Call `this.renderTest();` inside `render()`.

- [x] **Step 5: Run tests to verify they pass**

Run:

```powershell
npm test
```

Expected: PASS.

- [x] **Step 6: Commit**

Run:

```powershell
git add index.html tests/core.test.mjs
git commit -m "feat: add vocabulary test flow"
```

---

### Task 7: Add TTS, Guided Reading, and Feedback Fallback

**Files:**
- Modify: `index.html`
- Modify: `tests/core.test.mjs`

- [x] **Step 1: Add failing tests for WPM rate and similarity**

Append to `tests/core.test.mjs`:

```javascript
test("mapWpmToRate maps supported WPM range to speech rate", async () => {
  const core = await loadCore();
  assert.equal(core.mapWpmToRate(120), 0.8);
  assert.equal(core.mapWpmToRate(160), 1.1);
  assert.equal(core.mapWpmToRate(200), 1.4);
});

test("textSimilarity rewards matching words", async () => {
  const core = await loadCore();
  assert.ok(core.textSimilarity("read the passage aloud", "read passage aloud") > 0.7);
  assert.ok(core.textSimilarity("read the passage aloud", "different words") < 0.5);
});
```

- [x] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test
```

Expected: FAIL because speech helpers are missing.

- [x] **Step 3: Add speech helper functions**

Add to `core`:

```javascript
    mapWpmToRate(wpm) {
      if (wpm <= 120) return 0.8;
      if (wpm >= 200) return 1.4;
      return Math.round((0.8 + ((wpm - 120) / 80) * 0.6) * 10) / 10;
    },

    normalizeWords(text) {
      return String(text).toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
    },

    textSimilarity(source, spoken) {
      const sourceWords = new Set(this.normalizeWords(source));
      const spokenWords = new Set(this.normalizeWords(spoken));
      if (!sourceWords.size) return 0;
      const matches = [...sourceWords].filter((word) => spokenWords.has(word)).length;
      return Math.round((matches / sourceWords.size) * 100) / 100;
    }
```

- [x] **Step 4: Add speech app methods and controls**

Add these event bindings inside `bindEvents()`:

```javascript
      document.getElementById("play-passage").addEventListener("click", () => this.speak(this.passage.text));
      document.getElementById("play-sentence").addEventListener("click", () => this.speak(this.passage.sentences[this.currentSentenceIndex]));
      document.getElementById("guided-reading").addEventListener("click", () => this.guidedReading());
```

Add these app methods:

```javascript
    getEnglishVoice() {
      if (!("speechSynthesis" in window)) return null;
      const voices = window.speechSynthesis.getVoices();
      return voices.find((voice) => voice.lang === "en-US") || voices.find((voice) => voice.lang.startsWith("en")) || null;
    },

    speak(text, onEnd) {
      if (!("speechSynthesis" in window)) {
        document.getElementById("reading-feedback").textContent = "Text-to-speech is not available in this browser.";
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = core.mapWpmToRate(this.state.user.targetWpm);
      const voice = this.getEnglishVoice();
      if (voice) utterance.voice = voice;
      utterance.onend = () => {
        this.recordReadingActivity();
        if (onEnd) onEnd();
      };
      window.speechSynthesis.speak(utterance);
    },

    guidedReading() {
      this.currentSentenceIndex = 0;
      this.renderPassage();
      this.speak(this.passage.sentences[this.currentSentenceIndex], () => this.promptReadFeedback());
    },

    promptReadFeedback() {
      const feedback = document.getElementById("reading-feedback");
      feedback.innerHTML = `<p>Repeat the sentence, then record feedback.</p><div class="button-grid"><button type="button" data-feedback="readSmooth">Smooth</button><button type="button" data-feedback="readOkay">Okay</button><button type="button" data-feedback="readDifficult">Difficult</button></div>`;
      feedback.querySelectorAll("[data-feedback]").forEach((button) => {
        button.addEventListener("click", () => this.applyReadingFeedback(button.dataset.feedback));
      });
      this.trySpeechRecognition();
    },

    trySpeechRecognition() {
      const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Recognition) return;
      const recognition = new Recognition();
      recognition.lang = "en-US";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        const spoken = event.results[0][0].transcript;
        const source = this.passage.sentences[this.currentSentenceIndex];
        const score = core.textSimilarity(source, spoken);
        this.state.reading.lastAccuracy = score;
        document.getElementById("reading-feedback").insertAdjacentHTML("beforeend", `<p class="muted">Recognition similarity: ${Math.round(score * 100)}%</p>`);
      };
      recognition.start();
    },

    applyReadingFeedback(eventName) {
      for (const id of this.passage.targetWordIds) {
        const index = this.state.vocabulary.findIndex((word) => word.id === id);
        this.state.vocabulary[index] = core.applyWordEvent(this.state.vocabulary[index], eventName);
      }
      this.recordReadingActivity();
      this.currentSentenceIndex = Math.min(this.currentSentenceIndex + 1, this.passage.sentences.length - 1);
      this.render();
    },

    recordReadingActivity() {
      const todayKey = new Date().toISOString().slice(0, 10);
      this.state.activity[todayKey] ||= { studiedWords: 0, readCount: 0 };
      this.state.activity[todayKey].studiedWords = new Set(this.passage.targetWordIds).size;
      this.state.activity[todayKey].readCount += 1;
      this.state.reading.totalReadCount += 1;
    }
```

- [x] **Step 5: Run tests to verify they pass**

Run:

```powershell
npm test
```

Expected: PASS.

- [x] **Step 6: Commit**

Run:

```powershell
git add index.html tests/core.test.mjs
git commit -m "feat: add reading practice"
```

---

### Task 8: Add Local Persistence, Import, Export, and Reset

**Files:**
- Modify: `index.html`
- Modify: `tests/core.test.mjs`

- [x] **Step 1: Add failing tests for export payload and import validation**

Append to `tests/core.test.mjs`:

```javascript
test("serializeProgress creates importable JSON payload", async () => {
  const core = await loadCore();
  const state = core.createDefaultState();
  const json = core.serializeProgress(state);
  const parsed = JSON.parse(json);
  assert.equal(parsed.version, 1);
  assert.ok(parsed.state.user);
  assert.ok(Array.isArray(parsed.state.vocabulary));
});

test("parseProgress rejects invalid payloads", async () => {
  const core = await loadCore();
  assert.throws(() => core.parseProgress("{}"), /Invalid progress file/);
});
```

- [x] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test
```

Expected: FAIL because persistence helpers are missing.

- [x] **Step 3: Add core persistence helpers**

Add to `core`:

```javascript
    serializeProgress(state) {
      return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), state }, null, 2);
    },

    parseProgress(jsonText) {
      const parsed = JSON.parse(jsonText);
      if (!parsed || parsed.version !== 1 || !parsed.state || !parsed.state.user || !Array.isArray(parsed.state.vocabulary)) {
        throw new Error("Invalid progress file");
      }
      return parsed.state;
    }
```

- [x] **Step 4: Add app persistence methods and event bindings**

Add this storage key near the app:

```javascript
  const storageKey = "context-vocabulary-trainer-progress";
```

In `init()`, load state before generating the passage:

```javascript
      this.state = this.loadState();
```

Add event bindings inside `bindEvents()`:

```javascript
      document.getElementById("export-progress").addEventListener("click", () => this.exportProgress());
      document.getElementById("import-progress").addEventListener("change", (event) => this.importProgress(event));
      document.getElementById("reset-progress").addEventListener("click", () => this.resetProgress());
```

Add `this.saveState();` after state-changing operations: passage generation, WPM input, `selectWord`, `answerTest`, and `applyReadingFeedback`.

Add these app methods:

```javascript
    loadState() {
      try {
        const saved = localStorage.getItem(storageKey);
        return saved ? core.parseProgress(saved) : core.createDefaultState();
      } catch {
        return core.createDefaultState();
      }
    },

    saveState() {
      localStorage.setItem(storageKey, core.serializeProgress(this.state));
    },

    exportProgress() {
      const blob = new Blob([core.serializeProgress(this.state)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "progress.json";
      link.click();
      URL.revokeObjectURL(url);
      document.getElementById("data-status").textContent = "Progress exported.";
    },

    async importProgress(event) {
      const file = event.target.files[0];
      if (!file) return;
      try {
        this.state = core.parseProgress(await file.text());
        this.passage = core.generatePassage(this.state);
        this.saveState();
        this.render();
        document.getElementById("data-status").textContent = "Progress imported.";
      } catch (error) {
        document.getElementById("data-status").textContent = error.message;
      }
    },

    resetProgress() {
      if (!confirm("Reset all local progress?")) return;
      localStorage.removeItem(storageKey);
      this.state = core.createDefaultState();
      this.passage = core.generatePassage(this.state);
      this.render();
      document.getElementById("data-status").textContent = "Local progress reset.";
    }
```

- [x] **Step 5: Run tests to verify they pass**

Run:

```powershell
npm test
```

Expected: PASS.

- [x] **Step 6: Commit**

Run:

```powershell
git add index.html tests/core.test.mjs
git commit -m "feat: persist progress locally"
```

---

### Task 9: Final UI Polish and Browser Verification

**Files:**
- Modify: `index.html`
- Modify: `tests/index-contract.test.mjs`

- [x] **Step 1: Add static checks for UX contract**

Append to `tests/index-contract.test.mjs`:

```javascript
test("index.html includes responsive and status styling", () => {
  for (const token of [
    "@media",
    "status-new",
    "status-learning",
    "status-review",
    "status-mastered",
    "sentence-active"
  ]) {
    assert.match(html, new RegExp(token));
  }
});
```

- [x] **Step 2: Run test to verify it passes or fails for real omissions**

Run:

```powershell
npm test
```

Expected: PASS if previous CSS is complete. If it fails, add the missing class from the test to `index.html`.

- [x] **Step 3: Open the file in a browser for manual verification**

Open this file directly:

```text
C:\Users\rudyc\Documents\01_Codex project\鑻辫鍗曡瘝瀛︿範\index.html
```

Manual checks:

- Dashboard appears immediately.
- Study, Test, Stats, and Data tabs switch views.
- Generate passage changes the passage without layout shifts.
- Clicking a highlighted word updates the word card.
- Chinese toggle shows and hides the translation.
- WPM slider updates the dashboard.
- TTS buttons do not crash when the browser supports `speechSynthesis`.
- Guided reading shows manual feedback buttons.
- Test flow reaches an estimated range.
- Export downloads `progress.json`.
- Import accepts a previously exported JSON.
- Reset asks for confirmation.
- At a narrow mobile width, content stays single-column with no horizontal scrolling.

- [x] **Step 4: Commit**

Run:

```powershell
git add index.html tests/index-contract.test.mjs
git commit -m "style: polish MVP interface"
```

---

### Task 10: Final Verification and Delivery

**Files:**
- Modify: `docs/superpowers/plans/2026-05-26-context-vocabulary-trainer-mvp.md`

- [x] **Step 1: Run full automated test suite**

Run:

```powershell
npm test
```

Expected: all tests PASS.

- [x] **Step 2: Check git status**

Run:

```powershell
git status --short
```

Expected: only the plan file may be modified if checkboxes were updated.

- [x] **Step 3: Commit plan checkbox updates if present**

Run:

```powershell
git add docs/superpowers/plans/2026-05-26-context-vocabulary-trainer-mvp.md
git commit -m "docs: update implementation plan progress"
```

If the plan file has no changes, skip this commit.

- [x] **Step 4: Final status report**

Report:

- `index.html` absolute path.
- Latest commit hash.
- Test command and PASS result.
- Manual browser checks completed or skipped.
- Any known limitations, especially browser-dependent speech recognition.

---

## Spec Coverage Self-Review

- Vocabulary range test: covered by Task 6.
- Short passage generation: covered by Task 3 and rendered in Task 5.
- Click-to-inspect target words: covered by Task 5.
- Chinese toggle: covered by Task 4 and Task 5.
- TTS and WPM: covered by Task 7.
- SpeechRecognition with manual fallback: covered by Task 7.
- Mastery and statistics updates: covered by Task 3, Task 5, and Task 7.
- localStorage persistence: covered by Task 8.
- Import/export/reset: covered by Task 8.
- Responsive practical UI: covered by Task 4 and Task 9.
- No backend, no dependencies, no AI calls: preserved throughout the file structure and task constraints.

