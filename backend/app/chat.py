"""
Support chat widget logic.

The chat is grounded in the same cluster analysis as the dashboard: when a
customer's message matches a known recurring root cause, the bot can say so
plainly ("this is a known issue, here's the workaround, engineering is
already tracking it") instead of guessing blind. Runs on the same configured
model as the analysis engine.
"""
from typing import List, Dict, Any
from openai import OpenAI

from .engine import _cache, _strip_think, MODEL_BASE_URL, MODEL_API_KEY, MODEL

client = OpenAI(base_url=MODEL_BASE_URL, api_key=MODEL_API_KEY or "not-configured", timeout=45.0, max_retries=1)


def _known_issues_context() -> str:
    clusters = (_cache.get("clusters") or {}).get("clusters", [])
    if not clusters:
        return "No cluster analysis has been run yet."
    lines = []
    for c in clusters:
        ai = c.get("ai", {})
        if not ai:
            continue
        lines.append(
            f"- [{ai.get('severity','?').upper()}] {ai.get('root_cause_label','?')} "
            f"({c['size']} tickets, {c['pct_of_total']}% of backlog): "
            f"{ai.get('root_cause_explanation','')} "
            f"Owner: {ai.get('owner_team','?')}."
        )
    return "\n".join(lines) if lines else "No cluster analysis has been run yet."


def chat_reply(history: List[Dict[str, str]], user_message: str) -> Dict[str, Any]:
    known_issues = _known_issues_context()

    system = f"""You are the support chat assistant for a SaaS product. Be warm, concise, \
and genuinely helpful, like a sharp human support agent - not scripted. Respond with plain \
text only, no reasoning, no <think> tags, no markdown headers.

You have access to a live list of KNOWN RECURRING ISSUES, discovered by an AI root-cause \
analysis engine that clusters the support backlog:

{known_issues}

Rules:
- If the customer's message clearly matches one of the known issues above, say plainly that \
this is a known issue, briefly explain what's going on in plain language (not internal jargon), \
give any workaround you can, and reassure them it's already being tracked by the owning team. \
Do not invent details beyond what's listed above.
- If it does NOT match a known issue, help normally and don't force-fit it into one of the \
categories above.
- If the issue sounds urgent/blocking or the customer seems frustrated after back-and-forth, \
offer to escalate to a human agent.
- Keep responses tight: 2-5 sentences unless genuinely more is needed.
- Never expose internal fields like cluster IDs, percentages, or "owner_team" verbatim - translate \
them into natural customer-facing language.
"""

    messages = [{"role": "system", "content": system}]
    # Keep only the last few turns - plenty of context for a support chat,
    # and shorter prompts mean faster local-model responses.
    for turn in history[-6:]:
        messages.append({"role": turn["role"], "content": turn["content"]})
    messages.append({"role": "user", "content": user_message})

    resp = client.chat.completions.create(
        model=MODEL,
        max_tokens=350,
        temperature=0.5,
        messages=messages,
    )
    text = resp.choices[0].message.content or ""
    text = _strip_think(text)
    if not text:
        text = "Sorry, I didn't quite catch that — could you rephrase?"
    return {"reply": text}
