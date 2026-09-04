"""
RootSight AI — root-cause analysis engine.

Pipeline:
  1. Load resolved tickets.
  2. Vectorize subject+body with TF-IDF.
  3. Cluster with KMeans (k chosen via silhouette sweep).
  4. For each cluster, sample representative tickets and ask a configured
      OpenAI-compatible LLM to produce: a human-readable
     root-cause label, an explanation of the underlying defect, a concrete
     fix recommendation, severity, owning team, and estimated deflection.
  5. Compute deterministic, non-AI metrics on top: Support Health Score,
     per-cluster priority (P0-P3), expected ticket reduction, and headline
     backlog stats. These are pure math so they're instant and 100%
     reproducible for the demo, no model variance involved.
  6. Cache results in-memory (appropriate for local development; swap for a
      persistent store when deploying the service).

The model provider is configurable through environment variables. LM Studio
works locally, and Groq works through its OpenAI-compatible API.
"""
import os
import json
import re
from collections import Counter
from typing import List, Dict, Any

import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from openai import OpenAI

# --- OpenAI-compatible model provider ----------------------------------------
MODEL_PROVIDER = os.getenv("MODEL_PROVIDER", "lmstudio").lower()
if MODEL_PROVIDER == "groq":
    MODEL_BASE_URL = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
    MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    MODEL_API_KEY = os.getenv("GROQ_API_KEY", "")
else:
    MODEL_BASE_URL = os.getenv("LMSTUDIO_BASE_URL", "http://localhost:1234/v1")
    MODEL = os.getenv("LMSTUDIO_MODEL", "qwen3-8b")
    MODEL_API_KEY = os.getenv("LMSTUDIO_API_KEY", "lm-studio")

# Local inference can be slow on modest hardware, but a live demo needs a
# hard ceiling so a stalled call fails fast with a clear error instead of
# hanging silently on stage. 90s comfortably covers an 8B model on CPU/GPU;
# lower this if you're on a fast GPU and want snappier failure detection.
client = OpenAI(base_url=MODEL_BASE_URL, api_key=MODEL_API_KEY or "not-configured", timeout=90.0, max_retries=1)

_cache: Dict[str, Any] = {"clusters": None}

SEVERITY_WEIGHT = {"critical": 1.0, "high": 0.65, "medium": 0.35, "low": 0.12}
SEVERITY_PRIORITY = {"critical": "P0", "high": "P1", "medium": "P2", "low": "P3"}


def load_tickets(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    df["text"] = df["subject"].fillna("") + ". " + df["body"].fillna("")
    return df


def choose_k(X, k_min=5, k_max=9) -> int:
    n_samples = X.shape[0]
    # Clamp to what's actually possible for this dataset size - KMeans
    # requires n_clusters <= n_samples, and silhouette_score requires >= 2
    # clusters. Matters if someone swaps in a smaller real ticket export.
    k_max = max(2, min(k_max, n_samples - 1))
    k_min = max(2, min(k_min, k_max))
    best_k, best_score = k_min, -1
    for k in range(k_min, k_max + 1):
        try:
            km = KMeans(n_clusters=k, random_state=42, n_init=10).fit(X)
            if len(set(km.labels_)) < 2:
                continue
            score = silhouette_score(X, km.labels_)
            if score > best_score:
                best_score, best_k = score, k
        except Exception:
            continue
    return best_k


def cluster_tickets(df: pd.DataFrame) -> Dict[str, Any]:
    vectorizer = TfidfVectorizer(
        max_df=0.5, min_df=3, stop_words="english", ngram_range=(1, 2), sublinear_tf=True
    )
    X = vectorizer.fit_transform(df["text"])

    k = choose_k(X)
    km = KMeans(n_clusters=k, random_state=42, n_init=10).fit(X)
    df = df.copy()
    df["cluster"] = km.labels_

    terms = vectorizer.get_feature_names_out()
    order_centroids = km.cluster_centers_.argsort()[:, ::-1]

    clusters = []
    for c in sorted(df["cluster"].unique()):
        sub = df[df["cluster"] == c]
        top_terms = [terms[i] for i in order_centroids[c, :8]]
        sample_tickets = sub.sample(min(6, len(sub)), random_state=1)[
            ["ticket_id", "subject", "body", "priority", "csat_score"]
        ].to_dict(orient="records")
        clusters.append({
            "cluster_id": int(c),
            "size": int(len(sub)),
            "pct_of_total": round(len(sub) / len(df) * 100, 1),
            "avg_csat": round(float(sub["csat_score"].mean()), 2),
            "top_terms": top_terms,
            "sample_tickets": sample_tickets,
            "categories": Counter(sub["category"]).most_common(3),
        })

    clusters.sort(key=lambda c: c["size"], reverse=True)
    return {"k": k, "total_tickets": int(len(df)), "clusters": clusters}


def _strip_think(text: str) -> str:
    """Reasoning models may prepend
    <think>...</think> blocks before the actual answer. Strip those out
    before we try to parse JSON or show text to a user."""
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()


def _extract_json(text: str) -> dict:
    text = _strip_think(text)
    text = re.sub(r"^```(json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    # local models sometimes add stray text around the JSON object; grab the
    # outermost {...} block defensively.
    match = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if match:
        text = match.group(0)
    return json.loads(text)


ANALYSIS_SYSTEM_PROMPT = """You are a support-operations analyst API. You only output a single \
valid JSON object matching the requested schema - no reasoning, no <think> blocks, no markdown \
fences, no commentary before or after. Just the JSON object."""


def _chat_json(messages: List[Dict[str, str]], max_tokens: int, temperature: float):
    """Call the configured model asking for JSON output. Tries the provider's
    OpenAI-compatible JSON mode first (constrains sampling to valid JSON,
    which is both faster and far more reliable on small local models) and
    falls back to a plain call if the loaded model/server doesn't support
    response_format - keeps this working across whatever's loaded in
    configured endpoint without extra config."""
    try:
        return client.chat.completions.create(
            model=MODEL,
            max_tokens=max_tokens,
            temperature=temperature,
            messages=messages,
            response_format={"type": "json_object"},
        )
    except Exception:
        return client.chat.completions.create(
            model=MODEL,
            max_tokens=max_tokens,
            temperature=temperature,
            messages=messages,
        )


def _truncate(text: str, n: int = 140) -> str:
    text = text or ""
    return text if len(text) <= n else text[: n - 1].rstrip() + "…"


def analyze_cluster_with_ai(cluster: Dict[str, Any]) -> Dict[str, Any]:
    # Keep the sample small and each ticket body short: fewer input tokens
    # means faster generation on an 8B local model without losing the
    # signal needed for a good root-cause read.
    samples_text = "\n".join(
        f'- "{t["subject"]}" (csat={t["csat_score"]}): {_truncate(t["body"])}'
        for t in cluster["sample_tickets"][:5]
    )
    user_prompt = f"""Cluster of {cluster['size']} support tickets ({cluster['pct_of_total']}% of backlog). \
Key terms: {', '.join(cluster['top_terms'][:6])}.

Samples:
{samples_text}

Return ONLY this JSON shape, values filled in for this cluster:
{{"root_cause_label": "max 6 words", "root_cause_explanation": "2-3 sentences on the likely underlying defect", "recommended_fix": "1-3 concrete actions, semicolon-separated", "estimated_deflection_pct": "0-100", "severity": "low|medium|high|critical", "owner_team": "e.g. Backend / Auth, Billing Engineering, Mobile iOS"}}
/no_think"""

    resp = _chat_json(
        messages=[
            {"role": "system", "content": ANALYSIS_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=450,
        temperature=0.25,
    )
    text = resp.choices[0].message.content or ""
    try:
        data = _extract_json(text)
    except Exception:
        data = {
            "root_cause_label": "Analysis unavailable",
            "root_cause_explanation": _strip_think(text)[:300] or "The local model returned an unparseable response. Try re-running the analysis.",
            "recommended_fix": "Re-run analysis, or check LM Studio is loaded with a model that supports JSON output.",
            "estimated_deflection_pct": "0",
            "severity": "medium",
            "owner_team": "Unassigned",
        }
    return _sanitize_ai_result(data)


_VALID_SEVERITIES = {"low", "medium", "high", "critical"}


def _sanitize_ai_result(data: Dict[str, Any]) -> Dict[str, Any]:
    """Local models occasionally drift from the schema (wrong casing, a
    stray '%' sign, an invented severity level). Clamp everything to safe,
    renderable values so one odd generation can't break the dashboard."""
    data = dict(data)
    data["root_cause_label"] = str(data.get("root_cause_label") or "Unlabeled issue").strip()[:80]
    data["root_cause_explanation"] = str(data.get("root_cause_explanation") or "No explanation returned.").strip()
    data["recommended_fix"] = str(data.get("recommended_fix") or "No fix returned.").strip()
    data["owner_team"] = str(data.get("owner_team") or "Unassigned").strip()[:40]

    sev = str(data.get("severity") or "medium").strip().lower()
    data["severity"] = sev if sev in _VALID_SEVERITIES else "medium"

    try:
        pct = float(str(data.get("estimated_deflection_pct", 0)).rstrip("%").strip() or 0)
    except ValueError:
        pct = 0
    data["estimated_deflection_pct"] = str(max(0, min(100, round(pct))))

    return data


def _compute_health_and_metrics(df: pd.DataFrame, clusters: List[Dict[str, Any]]) -> Dict[str, Any]:
    total = len(df)

    # Friction: how much of the backlog is concentrated in higher-severity
    # recurring issues. 0 = no friction, ~100 = backlog dominated by
    # critical recurring issues.
    friction_score = sum(
        c["pct_of_total"] * SEVERITY_WEIGHT.get(c["ai"]["severity"], 0.35)
        for c in clusters
    )
    friction_score = min(friction_score, 100)

    avg_csat = float(df["csat_score"].mean())
    csat_normalized = max(0.0, min(1.0, (avg_csat - 1) / 4)) * 100  # 1-5 scale -> 0-100

    health_score = round(0.65 * (100 - friction_score) + 0.35 * csat_normalized)
    health_score = max(0, min(100, health_score))

    deflectable_tickets = sum(
        c["size"] * float(c["ai"]["estimated_deflection_pct"]) / 100
        for c in clusters
    )
    pct_deflectable = round(deflectable_tickets / total * 100, 1) if total else 0

    high_critical = [c for c in clusters if c["ai"]["severity"] in ("high", "critical")]

    return {
        "health_score": health_score,
        "avg_csat": round(avg_csat, 2),
        "total_tickets": total,
        "root_causes_found": len(clusters),
        "deflectable_tickets": round(deflectable_tickets),
        "pct_deflectable": pct_deflectable,
        "high_critical_count": len(high_critical),
        "friction_score": round(friction_score, 1),
    }


def run_full_analysis(csv_path: str, force: bool = False) -> Dict[str, Any]:
    if _cache["clusters"] is not None and not force:
        return _cache["clusters"]

    df = load_tickets(csv_path)
    result = cluster_tickets(df)

    for cluster in result["clusters"]:
        ai = analyze_cluster_with_ai(cluster)
        cluster["ai"] = ai
        deflection_pct = float(ai["estimated_deflection_pct"])
        cluster["expected_reduction_tickets"] = round(cluster["size"] * deflection_pct / 100)
        cluster["priority"] = SEVERITY_PRIORITY.get(ai["severity"], "P2")
        cluster["impact_score"] = round(cluster["size"] * deflection_pct / 100, 1)

    result["clusters"].sort(key=lambda c: c["impact_score"], reverse=True)

    total = result["total_tickets"]
    top_n = result["clusters"][:5]
    covered = sum(c["size"] for c in top_n)
    result["headline_stat"] = {
        "top_n": len(top_n),
        "pct_of_backlog": round(covered / total * 100, 1),
    }

    result["health"] = _compute_health_and_metrics(df, result["clusters"])

    _cache["clusters"] = result
    return result
