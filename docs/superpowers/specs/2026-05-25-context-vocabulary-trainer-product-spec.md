# Context Vocabulary Trainer MVP Product Spec

## Purpose

Context Vocabulary Trainer is a local-first English vocabulary learning tool for native Chinese speakers who already know roughly 4,000-6,000 English words and want to grow practical listening and reading vocabulary through short passages, pronunciation practice, review, and lightweight testing.

The MVP focuses on proving the learning loop:

1. Estimate the learner's vocabulary range.
2. Generate a short contextual passage from mock vocabulary data.
3. Let the learner inspect target words in context.
4. Provide US English text-to-speech reading.
5. Capture read-aloud feedback through SpeechRecognition when available, or manual feedback when not.
6. Update word mastery and study statistics.
7. Persist progress locally and support JSON import/export.

## Scope

### In Scope

- Single-page local web app.
- Native HTML, CSS, and JavaScript.
- One runnable `index.html` in the implementation phase, containing CSS, JavaScript, and mock data.
- 30-50 mock vocabulary entries with the future-compatible data structure.
- Vocabulary range estimation through sample questions.
- Template-based passage generation without AI calls.
- Clickable target words with phonetic, part of speech, Chinese meaning, and example sentence.
- Chinese translation visibility toggle.
- Web Speech API `speechSynthesis` for US English reading.
- SpeechRecognition or `webkitSpeechRecognition` support when available.
- Manual read-aloud feedback fallback.
- Local progress persistence with `localStorage`.
- Progress JSON import/export.
- Statistics view for learning progress.

### Out of Scope

- Full 20,000-word vocabulary database.
- AI-generated passages.
- Professional pronunciation scoring.
- User accounts.
- Cloud sync.
- Multi-device state sharing.
- Backend services.
- Payment, subscription, or content marketplace features.

## Target User

The target user is a Chinese-speaking English learner with an estimated vocabulary of 4,000-6,000 words. They want to improve usable vocabulary for reading and listening, not merely memorize isolated word lists. The product should help them progress toward 10,000, 15,000, and eventually 20,000 words over a longer learning period.

## Product Structure

The MVP has four main sections inside one app shell.

### Dashboard

The top dashboard shows the learner's current state:

- Estimated vocabulary range or representative number.
- Mastered word count.
- Today's studied word count.
- Current target WPM.
- New word ratio.
- Due review count, if space allows.

The dashboard also provides navigation tabs:

- Study.
- Test.
- Stats.
- Data.

### Study

The Study section is the core learning surface.

It includes:

- Current passage title.
- English passage generated from selected vocabulary.
- Optional Chinese translation.
- Clickable target words.
- Visual status markers for target words:
  - `new`: clear underline or light highlight.
  - `learning` / `review`: secondary highlight or border style.
  - `mastered`: low-emphasis marker.
- Word detail card showing:
  - word.
  - phonetic transcription.
  - part of speech.
  - Chinese meaning.
  - example sentence.
  - known score and status.
- Controls:
  - Generate passage.
  - Toggle Chinese translation.
  - Play full passage.
  - Play current sentence.
  - Guided sentence-by-sentence reading.
  - WPM control.
  - Read-aloud feedback controls.

Desktop layout should use a two-column structure: passage on the left, word card and controls on the right. Mobile layout should collapse into a single column with passage first and controls below.

### Test

The Test section estimates vocabulary range through sampling.

It includes:

- One question at a time.
- Current test word.
- Multiple-choice Chinese meaning options where possible.
- Quick "know" / "do not know" actions.
- Progress indicator.
- Result summary after completion.

The result should be shown as a range, such as:

- 4,000-5,000.
- 5,000-6,000.
- 6,000-8,000.
- 8,000-10,000.

The result updates the learner state, including estimated vocabulary and initial study level.

### Stats

The Stats section summarizes progress.

It includes:

- Study days.
- Total read-aloud count.
- Mastered word count.
- Learning word count.
- Due review count.
- Estimated vocabulary trend.
- Last 7 days study activity.
- Group completion summary.

The MVP can render lightweight charts with HTML and CSS. It should not depend on a chart library.

### Data

The Data section handles local state management.

It includes:

- Export progress JSON.
- Import progress JSON.
- Reset local progress with confirmation.
- Future vocabulary JSON import entry point shown as disabled or "coming later".

Reset must require explicit confirmation because it deletes local progress.

## Learning Flow

### First Run

On first open, the learner can either start the vocabulary test or begin study immediately. The recommended call to action should be the vocabulary test because it improves the starting level.

### Vocabulary Test

The app samples mock words from different difficulty levels. The learner answers whether they know a word or chooses the correct Chinese meaning. At the end, the app estimates a vocabulary range and sets:

- `estimatedVocabulary`.
- `currentGroupId`.
- `newWordRatio`.

The estimate is intentionally approximate and must be presented as a range, not as a precise measurement.

### Passage Generation

The app creates a passage from a blend of:

- New words from the current group.
- Review words whose `nextReviewAt` is due.
- Mastered or familiar words to make the passage readable.

The MVP uses templates to generate 3-8 sentences. It does not call an AI service. The passage should stay short enough for a focused learning session.

### Context Study

The learner reads the passage, optionally displays Chinese translation, and clicks words to inspect meaning and usage. Clicking a target word increases `clickCount` and should not increase mastery.

### Reading and Shadowing

The learner can play:

- The full passage.
- The current sentence.
- Guided sentence-by-sentence reading.

The app uses `window.speechSynthesis` and prefers an `en-US` voice. The `targetWpm` maps to `SpeechSynthesisUtterance.rate`.

After each sentence in guided reading, the app prompts the learner to shadow or repeat.

If SpeechRecognition is available, the app tries to recognize the learner's spoken text and estimate similarity to the source sentence. If it is unavailable, the app shows manual buttons:

- Smooth.
- Okay.
- Difficult.

### Mastery Updates

Each word has a `knownScore` from 0 to 5.

Rules:

- Clicking a definition increases `clickCount` and does not increase `knownScore`.
- Correct test answer increases `correctCount` and `knownScore`.
- Wrong test answer increases `wrongCount` and decreases `knownScore`.
- Smooth reading increases `readCount` and `knownScore`.
- Difficult reading does not increase mastery and may keep the word in review.
- `knownScore >= 4.5` can move a word to `mastered`.
- A mastered word can return to `review` after later errors.

The app should keep the algorithm understandable and avoid claiming professional-level pronunciation or vocabulary precision.

## Data Model

### Vocabulary Item

```json
{
  "id": 1,
  "word": "analyze",
  "phonetic": "/AN-uh-lyze/",
  "pos": "v.",
  "zh": "fen xi",
  "level": 4,
  "frequencyRank": 1200,
  "groupId": 12,
  "example": "We need to analyze the results carefully.",
  "knownScore": 0,
  "clickCount": 0,
  "correctCount": 0,
  "wrongCount": 0,
  "readCount": 0,
  "lastReviewedAt": "",
  "nextReviewAt": "",
  "status": "new"
}
```

### User State

```json
{
  "estimatedVocabulary": 5000,
  "currentGroupId": 1,
  "masteredWords": 0,
  "learningWords": 0,
  "newWordRatio": 0.1,
  "targetWpm": 140,
  "totalStudyMinutes": 0,
  "streakDays": 0
}
```

### Persisted Progress

The local saved state should include:

- User state.
- Updated vocabulary records.
- Daily study activity.
- Recent test results.
- Reading session counters.

## UX Requirements

- The app should feel like a practical study tool, not a landing page.
- The first screen should show the usable product UI immediately.
- The visual system should use a neutral base plus 2-3 functional colors.
- Avoid large decorative gradients and marketing-style hero sections.
- Cards are allowed for metrics, word details, test questions, and stats blocks.
- Do not nest cards inside cards.
- Buttons should use clear action labels.
- Text must not overlap or overflow on mobile.
- Mobile layout must be single-column and usable without horizontal scrolling.

## Acceptance Criteria

- A user can complete one vocabulary test and see an estimated range.
- A user can generate a learning passage.
- A user can click a target word and see phonetic, part of speech, Chinese meaning, and example sentence.
- A user can show or hide the Chinese translation.
- A user can play the passage with TTS.
- A user can adjust WPM and hear a speed change.
- Guided sentence reading highlights the current sentence.
- If SpeechRecognition is unsupported, the app shows manual feedback controls.
- Manual feedback updates read counts and mastery scores.
- Test answers update correct and wrong counts.
- Dashboard metrics change after learning actions.
- Progress survives page refresh through localStorage.
- Progress can be exported as JSON.
- Exported progress can be imported back into the app.
- Reset requires confirmation before clearing local progress.

## Risks and Constraints

- Browser SpeechRecognition support varies significantly. The manual feedback path is required.
- Browser voices differ by device and OS. The app should prefer `en-US` but gracefully use any available English voice.
- Vocabulary size in MVP is intentionally small. UI and data structures must avoid assumptions that would block future 20,000-word import.
- Vocabulary estimates are approximate. The UI must present them as ranges.
- Template-generated passages can sound mechanical. The MVP accepts this limitation to keep the first version local-only and dependency-free.

## Future Extensions

- Import a full 20,000-word JSON vocabulary file.
- Replace template passages with AI-generated passages.
- Add richer spaced repetition scheduling.
- Add professional speech scoring through a speech service.
- Add custom word lists.
- Add multi-session learning plans.
- Add cloud sync after account support exists.
