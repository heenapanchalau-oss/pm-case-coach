# Case Coach

Practise product management case interviews, and turn real problems into one-slide decision pagers. Answer by typing or speaking.

**Two modes**

1. **Practise a case** (aspiring PMs): pick a company and case type (Onboarding, Retention, Revenue, Growth, Engagement). A strict interviewer answers only from the case data, scores every question out of 10, and coaches you from discovery through to problem statement, hypothesis, recommendation, success metrics and guardrails. Finish with an auto-built one-slide summary and your scores.
2. **Build a one-pager** (working PMs): answer guided questions about a real problem and get one slide with a problem statement, three options compared, a boxed recommendation, final decision, hypothesis, metrics and guardrails.

Export the slide to PowerPoint or PDF.

## Guardrails: no invented data

| When | What happens |
|---|---|
| **Case creation** (once, offline from users) | `tools/generate_case.py` researches the company on the web and writes one complete, consistent case file: brief, all facts, model answer. `tools/validate_case.py` checks it, including that the model answer uses only numbers found in the case data. You review it, then commit it. |
| **During a case** | Zero network calls and zero generation. The interviewer matches the question to facts in the frozen file and returns that text word for word. Anything not in the file gets: *"We don't have that data."* |
| **One-pager mode** | Uses only what the user typed or said. Blank fields show as *(missing)*, never filled in. |

Scenario metrics are hypothetical and labelled as such on screen and on the slide. Company context comes from cited sources.

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` directly won't load cases (browsers block local file fetches). Use a local server.

## Publish on GitHub Pages

1. Push this folder to a public GitHub repo.
2. **Settings → Pages → Deploy from a branch → `main` / root**.
3. Your site goes live at `https://<username>.github.io/<repo>/`.

No build step, no server, no API key needed to run the site.

## Add a new case

```bash
pip install anthropic
export ANTHROPIC_API_KEY=sk-...
python tools/generate_case.py --company "Atlassian" --type Engagement
python tools/validate_case.py cases/*.json
```

Review the new file in `cases/`, then commit it. The script also adds it to `cases/index.json`.

You can also write cases by hand: copy `cases/paynest-onboarding.json` and keep the same structure.

### Case file structure

- `brief`: problem, objective and baseline shown at the start
- `facts[]`: what the interviewer can reveal. Each has a `phase` (frame, find, prove, pick), `keywords` used to match questions, the exact `answer`, a `coach_tip` and a `model_question`. `essential: true` marks facts a strong candidate must uncover.
- `unavailable[]`: topics that return "We don't have that data"
- `rubric`: words used to check the problem statement and hypothesis
- `model_answer`: problem statement, three options (with customer impact, business impact, severity, effort, why), recommended option, decision, hypothesis, test, success metrics, guardrails

## Voice

- **Speaking answers** uses the browser's built-in speech recognition: Chrome, Edge and Safari. Where it isn't supported, the mic button hides and typing still works.
- **Read replies aloud** uses the browser's built-in speech.

## Scoring

Discovery questions are scored on: matching a real case fact, asking it in the right phase (when the timer runs: Frame 0–5 min, Find 5–10, Prove 10–13, Pick 13–15, Pilot 15–20), not repeating, interpreting before asking, and not skipping essential facts. Synthesis answers are checked against the case rubric and can be compared with the model answer.

## Project layout

```
index.html          app shell
css/style.css       styles (light and dark)
js/engine.js        interviewer and scoring (pure logic, no network)
js/voice.js         speech input and read-aloud
js/slide.js         one-slide render and PowerPoint export
js/app.js           screens and flow
js/vendor/          PptxGenJS (MIT), bundled so the site needs no CDN
cases/              frozen case files and index.json
tools/              case generator and validator
```

## Licence

MIT. See `LICENSE`. PptxGenJS is MIT-licensed by its authors.

*Practice scenarios are fictional and use hypothetical data. Company names are used for context only; this project is not affiliated with any company featured in a case.*
