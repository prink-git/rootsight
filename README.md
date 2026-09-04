# RootSight AI
### Root-cause intelligence for customer support teams

Most support bots answer tickets one at a time. **RootSight AI analyzes the
entire resolved-ticket backlog, finds the small number of recurring root
causes generating most of the volume, and hands you a prioritized action
plan. A live chat widget uses that same analysis to recognize known issues
in real time.**

Runs through a configurable OpenAI-compatible model provider. Use **Groq**
for hosted inference with an API key, or **LM Studio** for local inference.

The included synthetic dataset currently produces **5 root causes explaining
about 72% of the ticket backlog.** Fixing those issues prevents much of that
volume from arriving.

---

## What's inside

- **Diagnostics** — a signal-readout view of every recurring root cause,
  clustered from real ticket text, with a full root-cause / fix report per
  cluster.
- **AI Action Center** — every root cause ranked by priority (P0-P3), with
  a recommended fix, expected ticket reduction, and an owning team already
  assigned. Check/uncheck fixes to control what counts toward the simulator.
- **Support Health Score** — a single 0-100 number blending backlog
  severity concentration and customer satisfaction, computed deterministically
  (no model variance) so it's stable and explainable.
- **Impact Simulator** — a live before-vs-after dashboard: toggle which
  fixes are "planned" in the Action Center and watch projected ticket
  volume, health score, and CSAT update instantly.
- **Support chat widget** — grounded in the same cluster analysis, so it
  recognizes known issues and answers with real context instead of guessing.

## Architecture

```
rootsight-ai/
├── backend/                 FastAPI + local-model engine
│   ├── app/
│   │   ├── main.py          API endpoints
│   │   ├── engine.py        TF-IDF clustering + LM Studio root-cause analysis
│   │   │                    + Support Health Score / priority / Action Center fields
│   │   └── chat.py          Chat widget, grounded in the cluster analysis
│   ├── data_gen.py          Synthetic ticket dataset generator
│   ├── data/tickets.csv     Generated dataset (260 tickets, 8 seeded root causes)
│   └── requirements.txt
└── frontend/                 React + Vite console
    └── src/
        ├── App.jsx                    tab navigation, shared "planned fixes" state
        ├── utils/health.js            before/after projection math (mirrors backend formula)
        └── components/
            ├── HealthStrip.jsx        Support Health Score + key metrics
            ├── SignalChart.jsx        signature "signal readout" diagnostics view
            ├── ClusterDetail.jsx      full root-cause / fix report panel
            ├── ActionCenter.jsx       prioritized fix table
            ├── ImpactSimulator.jsx    before-vs-after dashboard
            └── ChatWidget.jsx         customer-facing chat
```

**Pipeline:** load resolved tickets → TF-IDF vectorize → KMeans cluster
(k auto-selected via silhouette score) → for each cluster, sample
representative tickets and ask the local model for a root-cause label,
plain-English explanation, concrete fix, severity, owning team, and
estimated deflection % → compute deterministic metrics on top (Support
Health Score, P0-P3 priority, expected ticket reduction) → rank by impact
(size × deflection) so the dashboard leads with the highest-leverage fix,
not just the biggest cluster.

The chat widget reads the same cluster analysis, so if a customer's message
matches a known recurring issue, it says so plainly and reassures them it's
already being tracked — instead of guessing blind.

## Model providers

The backend supports both providers through the same OpenAI-compatible client.

### Groq
1. Create an API key at [Groq Console](https://console.groq.com/keys).
2. Copy `backend/.env.example` to `backend/.env`.
3. Set `GROQ_API_KEY` and keep `MODEL_PROVIDER=groq`.

```env
MODEL_PROVIDER=groq
GROQ_API_KEY=your_key_here
GROQ_MODEL=llama-3.3-70b-versatile
```

### LM Studio
1. Install [LM Studio](https://lmstudio.ai) and download a compatible model.
2. Start the local server on `http://localhost:1234`.
3. Set `MODEL_PROVIDER=lmstudio` and configure `LMSTUDIO_MODEL`.

Local reasoning models (Qwen3 with "thinking" enabled) sometimes prepend
`<think>...</think>` blocks before their actual answer — the engine strips
these automatically before parsing JSON or showing chat replies, so this
works whether thinking mode is enabled or disabled by the provider.

## About the dataset

Kaggle isn't reachable from the environment this was built in, so `data_gen.py`
generates a synthetic dataset **matching the schema of standard public
customer-support ticket datasets** (ticket_id, subject, body, category,
priority, channel, timestamps, resolution notes, CSAT), seeded with 8
realistic recurring root causes (password reset failures, promo code bugs,
mobile upload crashes, billing sync issues, etc.) plus ~8% genuine one-off
noise tickets — so the clustering engine has to actually separate signal
from noise, the way it would on a real backlog. If you have real ticket
export data, drop a CSV with the same columns into `backend/data/tickets.csv`
and it'll just work.

## Running it

### 1. Configure a model provider
Choose Groq or LM Studio using the instructions above, then create the local
environment file:

### 2. Backend
```bash
cd backend
python3 -m venv venv && source venv/bin/activate   # optional but recommended
pip install -r requirements.txt
cp .env.example .env
# edit .env and set the provider credentials/model
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```
Open the printed local URL (default `http://localhost:5173`). The Vite dev
server proxies `/api/*` to the backend on port 8000.

First load triggers the full analysis (clustering + one local-model call per
cluster, ~8-9 calls) — expect anywhere from a few seconds to ~1 minute
depending on your machine and model size. Subsequent loads are served from
cache until you hit "Re-run analysis."

## Local development checklist

- [ ] Configured model provider is available
- [ ] Backend running (`uvicorn app.main:app --reload --port 8000`)
- [ ] Frontend running (`npm run dev`)
- [ ] Header shows the configured provider as **connected**. If it says
  offline, cached results can still load, but a fresh analysis will fail
- [ ] Load the dashboard once so the first (slowest) analysis pass is cached;
  subsequent loads are instant
- [ ] Try the chat widget once with a message matching a seeded issue
      (e.g. "my password reset link keeps expiring") to confirm it recognizes it
- [ ] In the Action Center, uncheck a fix and confirm the Impact Simulator
      numbers move when you switch tabs - this is the moment to rehearse

## Typical workflow

1. Open **Diagnostics** and inspect recurring issues, sample tickets, and
  recommended fixes.
2. Use **Action Center** to prioritize fixes and assign ownership.
3. Toggle planned fixes and review the projected changes in **Impact
  Simulator**.
4. Use the **chat widget** with a message matching a known issue to get a
  grounded response from the same cluster analysis.

## Reliability notes (final polish pass)

- **JSON-mode with fallback:** the engine asks the configured provider for constrained
  JSON output first (faster + far more reliable on small local models),
  and transparently falls back to a plain prompt if the loaded
  model/server doesn't support `response_format`.
- **Output sanitization:** every AI response is clamped to safe values
  (valid severity enum, 0-100 deflection %, capped string lengths) so one
  odd generation from an 8B model can't break the dashboard.
- **Timeouts everywhere:** both the backend's calls to the model provider and the
  frontend's calls to the backend have explicit timeouts, so a stalled
  local model fails fast with a clear, actionable error instead of hanging
  during a live demo.
- **Live connectivity indicator:** the header polls `/api/health` (which
  itself pings the provider with a 3s timeout) so you can see at a glance
  whether the local model is reachable.
- Verified end-to-end with mocked provider responses covering: normal
  JSON, JSON-mode-unsupported fallback, `<think>` reasoning tags, markdown
  code fences, stray prose around the JSON, malformed/out-of-range values,
  and full connection failure. A real pass against your actual loaded
  model is still worth doing before presenting, since output *quality*
  (not just parseability) depends on the specific model.


## Future improvements

- Swap the in-memory cache in `engine.py` for a real DB (Postgres + a
  scheduled re-cluster job) for production use.
- Add a real feedback loop: when engineering ships a fix, mark the root
  cause "resolved" and track whether that cluster's ticket volume actually
  drops in subsequent weeks — replacing the projected Impact Simulator with
  measured impact.
- Swap TF-IDF for sentence embeddings if you want better semantic
  clustering on messier real-world ticket text.
- Different compatible providers and models can be tested by changing the
  provider and model environment variables.
