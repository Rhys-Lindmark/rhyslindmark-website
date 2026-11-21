"""Ask hosted Jev the held-out crowd and ChaosNLI questions, exactly as Kev is asked them (state, type, instructions,
criteria; never labels or targets). Saves Jev's probability for every option to runs/jev/<file>.jsonl. Resumable.

    .venv/bin/python read_jev.py        # reads TYPESAFE_KEY_JEV_EVAL from evals/.env
"""
import asyncio
import json
import os
from pathlib import Path

import httpx

ROOT = Path(__file__).parent
for _line in (ROOT.resolve().parent / ".env").read_text().splitlines() if (ROOT.resolve().parent / ".env").exists() else []:
    _k, _sep, _v = _line.partition("=")
    if _sep and not _k.strip().startswith("#"):
        os.environ.setdefault(_k.strip(), _v.strip())
MODEL = "jev-1.14.0"
FILES = ["crowd_dev.jsonl", "chaosnli.jsonl"]


def request(record):
    return {"model": MODEL, "state": record["state"],
            "questions": {qid: {k: v for k, v in q.items() if k in ("type", "instructions", "criteria")} for qid, q in record["questions"].items()}}


def probabilities(q, answer):
    """Jev's answer as {option key: probability} in Kev's key order (choice: option names; noul: false/true; score: level index)."""
    if q["type"] == "noul":
        p = float(answer["noul"]); return {"false": 1 - p, "true": p}
    probs = answer["probabilities"]
    if q["type"] == "score":
        return {str(i): float(probs[str(i)]) for i in range(len(q["criteria"]))}
    return {k: float(probs[k]) for k in q["criteria"]}


async def one(client, record, key, sem):
    async with sem:
        for attempt in range(5):
            try:
                r = await client.post("https://api.typesafe.ai/v1/systemone", json=request(record),
                                      headers={"Authorization": f"Bearer {key}"}, timeout=120)
                if r.status_code in (429, 500, 502, 503, 504, 520): await asyncio.sleep(2 ** attempt * 2); continue
                r.raise_for_status()
                d = r.json()
                return {"id": record["_meta"]["id"], "model": d.get("model"), "usage": d.get("usage"),
                        "p": {qid: probabilities(q, d["answers"][qid]) for qid, q in record["questions"].items()}}
            except (httpx.HTTPError, KeyError) as e:
                err = repr(e); await asyncio.sleep(2 ** attempt * 2)
        return {"id": record["_meta"]["id"], "error": err}


async def main():
    key = os.environ["TYPESAFE_KEY_JEV_EVAL"]
    out_dir = ROOT / "runs/jev"; out_dir.mkdir(parents=True, exist_ok=True)
    sem = asyncio.Semaphore(16)
    async with httpx.AsyncClient() as client:
        for name in FILES:
            records = [json.loads(l) for l in open(ROOT / "data" / name, encoding="utf-8")]
            path = out_dir / name
            done = {json.loads(l)["id"] for l in open(path) if "error" not in json.loads(l)} if path.exists() else set()
            todo = [r for r in records if r["_meta"]["id"] not in done]
            print(f"{name}: {len(todo)} to ask", flush=True)
            with open(path, "a", encoding="utf-8") as f:
                for coro in asyncio.as_completed([one(client, r, key, sem) for r in todo]):
                    f.write(json.dumps(await coro) + "\n")
            rows = [json.loads(l) for l in open(path)]
            print(f"  errors: {sum('error' in r for r in rows)}; input tokens: {sum((r.get('usage') or {}).get('input_tokens', 0) for r in rows)}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
