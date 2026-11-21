"""A synthetic crowd: five open-weight models from different families each answer every training question once, at
temperature 1, like five annotators. Their votes become a soft target on the same items the human crowd voted on, so the
synthetic-crowd arm differs from the soft-label arm only in who voted.

Open-weight models only (Kev's rule for training labels; no Jev output is ever used). Calls go through OpenRouter with
OPENROUTER_KEY_JEV_EVAL and stop before the spend cap. Resumable: answers are appended to data/synth/<model>.jsonl.

    .venv/bin/python synth_crowd.py --limit 20     # probe (reads OPENROUTER_KEY_JEV_EVAL from evals/.env)
    .venv/bin/python synth_crowd.py                # all records
    .venv/bin/python synth_crowd.py --build                                                     # -> data/train_synth.jsonl
"""
import argparse
import asyncio
import json
import os
from collections import Counter
from pathlib import Path

import httpx

ROOT = Path(__file__).parent
for _line in (ROOT.resolve().parent / ".env").read_text().splitlines() if (ROOT.resolve().parent / ".env").exists() else []:
    _k, _sep, _v = _line.partition("=")
    if _sep and not _k.strip().startswith("#"):
        os.environ.setdefault(_k.strip(), _v.strip())
SYN = ROOT / "data/synth"
MODELS = [
    "qwen/qwen3.7-flash",
    "meta-llama/llama-4-scout",
    "deepseek/deepseek-v4.1-flash",
    "google/gemma-3-12b-it",
    "mistralai/mistral-small-24b-instruct-2501",
]
SPEND_CAP = float(os.environ.get("SYNTH_SPEND_CAP_USD", "4.50"))


def prompt(record):
    lines = ["You are one of several annotators. Read the material and answer each question with the option you think is right.",
             "", "MATERIAL:", json.dumps(record["state"], ensure_ascii=False, indent=1), "", "QUESTIONS:"]
    for qid, q in record["questions"].items():
        lines.append(f"\n[{qid}] {q['instructions']}")
        if q["type"] == "noul":
            crit = q.get("criteria") or {}
            lines.append(f"  - true: {crit.get('true', 'yes')}")
            lines.append(f"  - false: {crit.get('false', 'no')}")
        elif q["type"] == "score":
            for i, level in enumerate(q["criteria"]): lines.append(f"  - {i}: {level}")
        else:
            for k, v in q["criteria"].items(): lines.append(f"  - {k}: {v or k}")
    keys = ", ".join(f'"{qid}": <option>' for qid in record["questions"])
    lines += ["", f"Reply with only a JSON object: {{{keys}}}. Use the option names exactly as listed (true/false, a level number, or the option name)."]
    return "\n".join(lines)


def parse(text, record):
    text = text.strip()
    if "```" in text: text = text.split("```")[1].removeprefix("json")
    start, end = text.find("{"), text.rfind("}")
    obj = json.loads(text[start:end + 1])
    out = {}
    for qid, q in record["questions"].items():
        v = str(obj.get(qid, "")).strip().strip('"').lower()
        keys = ["false", "true"] if q["type"] == "noul" else [str(i) for i in range(len(q["criteria"]))] if q["type"] == "score" else list(q["criteria"])
        if v in keys: out[qid] = v
    return out


async def ask(client, model, record, key):
    body = {"model": model, "temperature": 1.0, "max_tokens": 200, "messages": [{"role": "user", "content": prompt(record)}],
            "reasoning": {"enabled": False}, "usage": {"include": True}}
    for attempt in range(4):
        try:
            r = await client.post("https://openrouter.ai/api/v1/chat/completions", json=body, headers={"Authorization": f"Bearer {key}"}, timeout=90)
            if r.status_code in (429, 500, 502, 503, 504, 402): await asyncio.sleep(2 ** attempt * 3); continue
            r.raise_for_status()
            d = r.json()
            text = d["choices"][0]["message"].get("content") or ""
            cost = (d.get("usage") or {}).get("cost", 0) or 0
            try: votes = parse(text, record)
            except Exception: votes = {}
            return {"id": record["_meta"]["id"], "votes": votes, "cost": cost}
        except (httpx.HTTPError, KeyError, ValueError):
            await asyncio.sleep(2 ** attempt * 3)
    return {"id": record["_meta"]["id"], "votes": {}, "cost": 0, "failed": True}


async def run(limit, concurrency):
    key = os.environ["OPENROUTER_KEY_JEV_EVAL"]
    records = [json.loads(l) for l in open(ROOT / "data/train.jsonl", encoding="utf-8")][:limit or None]
    SYN.mkdir(parents=True, exist_ok=True)
    spent = sum(json.loads(l).get("cost", 0) for p in SYN.glob("*.jsonl") for l in open(p))
    sem = asyncio.Semaphore(concurrency)
    async with httpx.AsyncClient() as client:
        for model in MODELS:
            path = SYN / (model.replace("/", "__") + ".jsonl")
            done = {json.loads(l)["id"] for l in open(path)} if path.exists() else set()
            todo = [r for r in records if r["_meta"]["id"] not in done]
            print(f"{model}: {len(done)} done, {len(todo)} to go; spent so far ${spent:.3f}", flush=True)

            async def one(r):
                nonlocal spent
                async with sem:
                    if spent >= SPEND_CAP: return None
                    res = await ask(client, model, r, key)
                    spent += res["cost"]
                    return res
            with open(path, "a", encoding="utf-8") as f:
                for i, coro in enumerate(asyncio.as_completed([one(r) for r in todo])):
                    res = await coro
                    if res is None: continue
                    f.write(json.dumps(res) + "\n")
                    if i % 500 == 0: f.flush(); print(f"  {i}/{len(todo)} ${spent:.3f}", flush=True)
            if spent >= SPEND_CAP: print(f"spend cap ${SPEND_CAP} reached; stopping", flush=True); break
    report()


def load_votes():
    votes = {}
    for model in MODELS:
        path = SYN / (model.replace("/", "__") + ".jsonl")
        if not path.exists(): continue
        for l in open(path):
            d = json.loads(l)
            votes.setdefault(d["id"], {})[model] = d["votes"]
    return votes


def report():
    votes = load_votes()
    records = {json.loads(l)["_meta"]["id"]: json.loads(l) for l in open(ROOT / "data/train.jsonl", encoding="utf-8")}
    cost = sum(json.loads(l).get("cost", 0) for p in SYN.glob("*.jsonl") for l in open(p))
    print(f"spent ${cost:.3f}")
    for model in MODELS:
        n = parsed = agree = 0
        for rid, by_model in votes.items():
            if model not in by_model: continue
            for qid, q in records[rid]["questions"].items():
                n += 1
                v = by_model[model].get(qid)
                if v is None: continue
                parsed += 1
                maj = str(q["label"]).lower() if q["type"] != "score" else str(q["label"])
                agree += v == maj
        if n: print(f"{model:45s} questions {n:6d} parsed {parsed / n:.3f} agrees with human majority {agree / max(parsed, 1):.3f}")


def build(min_votes=3):
    """data/train_synth.jsonl: the same records, each question's target replaced by the synthetic crowd's vote shares and
    its label by the synthetic majority. Questions with fewer than `min_votes` parsed votes are dropped (records with none left too)."""
    votes = load_votes()
    out, kept, dropped = [], 0, 0
    for l in open(ROOT / "data/train.jsonl", encoding="utf-8"):
        r = json.loads(l)
        qs = {}
        for qid, q in r["questions"].items():
            vs = [m.get(qid) for m in votes.get(r["_meta"]["id"], {}).values() if m.get(qid) is not None]
            if len(vs) < min_votes: dropped += 1; continue
            c = Counter(vs)
            keys = list(q["target"])
            target = {k: c.get(k, 0) / len(vs) for k in keys}
            top = max(keys, key=lambda k: (c.get(k, 0), -keys.index(k)))
            label = int(top) if q["type"] == "score" else (top == "true") if q["type"] == "noul" else top
            qs[qid] = {**q, "target": target, "label": label}; kept += 1
        if qs: out.append({**r, "questions": qs})
    with open(ROOT / "data/train_synth.jsonl", "w", encoding="utf-8") as f:
        for r in out: f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"train_synth.jsonl: {len(out)} records, {kept} questions kept, {dropped} dropped (< {min_votes} votes)")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--concurrency", type=int, default=32)
    ap.add_argument("--build", action="store_true")
    ap.add_argument("--report", action="store_true")
    a = ap.parse_args()
    if a.build: build()
    elif a.report: report()
    else: asyncio.run(run(a.limit, a.concurrency))
