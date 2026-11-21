"""Score every arm and Jev on every panel; write results/summary.json (read by public/jev/model/).

Panels
  breadth   breadth-v1 development: 14 held-out public datasets, 3,075 questions (Kev's frozen suite; Jev's, Kev-27B's
            and AutoJev's rows are committed in Kev's repo, copied to reference/)
  transfer  transfer-v4 development: 656 questions from six never-trained datasets plus held-out policies
  crowd     held-out crowd items: 1,200 records from the three training sources, scored against the human vote shares
  chaosnli  ChaosNLI, never trained: 100 annotators per item, 1,500 records

Crowd metrics (per question, then averaged within each task and macro-averaged over tasks):
  acc        top answer matches the crowd's majority
  agreement  sum_k p_k t_k: the chance a random annotator agrees with an answer drawn from the model
  soft_nll   cross-entropy against the vote shares (lower is better)
  jsd        Jensen-Shannon divergence from the vote shares, base 2 (lower is better)
  ent_corr   Spearman correlation between the model's entropy and the crowd's: does it know which items people split on?

    .venv/bin/python analyze.py
"""
import json
import math
from collections import defaultdict
from pathlib import Path

import numpy as np

from vendor import kev_metrics as km

ROOT = Path(__file__).parent
ARMS = ["parent", "hard", "soft", "synth"]
LABELS = {"jev": "Jev 1.14 (hosted)", "parent": "Kev-4B (released)", "hard": "+ crowd, majority labels",
          "soft": "+ crowd, human vote shares", "synth": "+ crowd, synthetic votes", "kev-27b": "Kev-27B (released)", "autojev": "AutoJev-27B"}
SELECTIVE = ("acc", "brier", "nll", "ece", "aurc", "coverage_at_5pct_error", "confident_error_rate")


def softmax_t(row, T):
    """Probabilities at temperature T. Kev records logits already divided by the temperature it served at
    (softmax(logits) == p), so undo that first."""
    if "logits" not in row: return np.asarray(row["p"], dtype=float)
    z = np.asarray(row["logits"], dtype=float) * row.get("inference_temperature", 1.0) / T
    z = np.exp(z - z.max()); return z / z.sum()


def arm_rows(arm, read):
    path = ROOT / "runs" / arm / "eval" / read / "rows.json"
    if not path.exists(): return None
    T = json.loads((ROOT / "runs" / arm / "eval/summary.json").read_text())["temperature"]
    rows = json.loads(path.read_text())
    return [{**r, "p": softmax_t(r, T).tolist()} for r in rows if r.get("variant", "clean") == "clean"]


def reference_rows(name):
    """Committed breadth-v1 rows, at the temperature each system was served at (Kev rows: their recorded inference T)."""
    rows = json.loads((ROOT / f"reference/breadth-v1-{name}.json").read_text())["rows"]
    return [{**r, "p": softmax_t(r, r.get("inference_temperature", 1.0)).tolist()} for r in rows if r.get("variant", "clean") == "clean"]


def records(name):
    return {json.loads(l)["_meta"]["id"]: json.loads(l) for l in open(ROOT / "data" / f"{name}.jsonl", encoding="utf-8")}


def keys_of(q):
    return ["false", "true"] if q["type"] == "noul" else [str(i) for i in range(len(q["criteria"]))] if q["type"] == "score" else list(q["criteria"])


def label_index(q):
    return int(q["label"]) if q["type"] in ("noul", "score") else keys_of(q).index(q["label"])


def jev_rows(name):
    recs = records(name)
    out = []
    for l in open(ROOT / "runs/jev" / f"{name}.jsonl"):
        d = json.loads(l)
        if "error" in d: continue
        r = recs[d["id"]]
        for qid, q in r["questions"].items():
            ks = keys_of(q)
            out.append({"id": d["id"], "group": d["id"], "parent": d["id"], "variant": "clean", "question": qid, "task": q["src"],
                        "source": r["_meta"]["source"], "type": q["type"], "keys": ks, "label": label_index(q), "p": [d["p"][qid][k] for k in ks]})
    return out


def spearman(a, b):
    ra, rb = np.argsort(np.argsort(a)), np.argsort(np.argsort(b))
    return float(np.corrcoef(ra, rb)[0, 1]) if len(a) > 2 else float("nan")


def entropy(p):
    p = np.asarray(p, dtype=float); p = p[p > 0]; return float(-(p * np.log(p)).sum())


def crowd_metrics(rows, targets):
    by_task = defaultdict(list)
    for r in rows:
        t = targets.get(f"{r['id']}|{r['question']}")
        if t is None: continue
        tv = np.array([t[k] for k in (r["keys"] if r["type"] != "score" else [str(i) for i in range(len(r["keys"]))])], dtype=float)
        p = np.clip(np.asarray(r["p"], dtype=float), 1e-9, 1); p = p / p.sum()
        m = 0.5 * (p + tv)
        jsd = 0.5 * sum(x * math.log2(x / y) for x, y in zip(p, m) if x > 0) + 0.5 * sum(x * math.log2(x / y) for x, y in zip(tv, m) if x > 0)
        by_task[r["task"]].append({"acc": float(p.argmax() == r["label"]), "agreement": float((p * tv).sum()),
                                   "soft_nll": float(-(tv * np.log(p)).sum()), "jsd": jsd, "h_model": entropy(p), "h_crowd": entropy(tv)})
    tasks = {}
    for task, xs in sorted(by_task.items()):
        tasks[task] = {k: float(np.mean([x[k] for x in xs])) for k in ("acc", "agreement", "soft_nll", "jsd")}
        tasks[task]["ent_corr"] = spearman([x["h_model"] for x in xs], [x["h_crowd"] for x in xs])
        tasks[task]["n"] = len(xs)
    macro = {k: float(np.mean([v[k] for v in tasks.values()])) for k in ("acc", "agreement", "soft_nll", "jsd", "ent_corr")} if tasks else {}
    return {"macro": macro, "tasks": tasks}


def selective_metrics(rows):
    m = km.metrics(rows)
    out = {k: m[k] for k in SELECTIVE if k in m}
    out["n"] = len(rows)
    out["tasks"] = {t: {"acc": v["acc"], "n": v["n"]} for t, v in km.grouped_metrics(rows, "task").items()}
    return out


def paired(a, b, metric):
    """a minus b on the same questions, record-clustered bootstrap (Kev's), micro; returns delta and 95% interval."""
    keyed = {(r["id"], r["question"]) for r in b}
    a2 = [r for r in a if (r["id"], r["question"]) in keyed]
    keyed = {(r["id"], r["question"]) for r in a2}
    b2 = [r for r in b if (r["id"], r["question"]) in keyed]
    boot = km.paired_bootstrap(a2, b2, samples=2000, seed=0, metric=metric, aggregation="micro")
    delta = next(v for k, v in boot.items() if k.endswith("_delta"))
    return {"delta": delta, "ci95": boot["ci95"], "n": len(a2)}


def main():
    targets = json.loads((ROOT / "data/targets.json").read_text())
    out = {"panels": {}, "temperatures": {}, "labels": LABELS}
    # crowd panels
    for read in ("crowd_dev", "chaosnli"):
        panel = {}
        if (ROOT / "runs/jev" / f"{read}.jsonl").exists(): panel["jev"] = crowd_metrics(jev_rows(read), targets)
        for arm in ARMS:
            rows = arm_rows(arm, read)
            if rows: panel[arm] = crowd_metrics(rows, targets)
        out["panels"][read] = panel
    # selective-prediction panels
    for read in ("breadth", "transfer"):
        panel, rows_by = {}, {}
        if read == "breadth":
            for name in ("jev", "kev-27b", "autojev", "kev-4b"):
                rows_by[name if name != "kev-4b" else "kev-4b-committed"] = reference_rows(name)
        for arm in ARMS:
            rows = arm_rows(arm, read)
            if rows: rows_by[arm] = rows
        for name, rows in rows_by.items(): panel[name] = selective_metrics(rows)
        if "parent" in rows_by:
            for arm in ("hard", "soft", "synth", "jev"):
                if arm in rows_by:
                    panel[arm]["vs_parent"] = {m: paired(rows_by[arm], rows_by["parent"], m) for m in ("acc", "brier", "aurc", "coverage_at_5pct_error")}
        out["panels"][read] = panel
    for arm in ARMS:
        p = ROOT / "runs" / arm / "eval/summary.json"
        if p.exists(): out["temperatures"][arm] = json.loads(p.read_text())["temperature"]
    (ROOT / "results").mkdir(exist_ok=True)
    (ROOT / "results/summary.json").write_text(json.dumps(out, indent=1))
    report(out)


def report(out):
    for read in ("breadth", "transfer"):
        panel = out["panels"].get(read, {})
        if not panel: continue
        print(f"\n== {read}")
        print(f"{'model':22s} " + " ".join(f"{k[:10]:>10s}" for k in SELECTIVE) + "      n")
        for name, m in panel.items():
            print(f"{name:22s} " + " ".join(f"{m.get(k, float('nan')):10.3f}" for k in SELECTIVE) + f" {m['n']:6d}")
        for name, m in panel.items():
            for metric, d in (m.get("vs_parent") or {}).items():
                print(f"  {name} - parent {metric:24s} {d['delta']:+.4f} [{d['ci95'][0]:+.4f}, {d['ci95'][1]:+.4f}]")
    for read in ("crowd_dev", "chaosnli"):
        panel = out["panels"].get(read, {})
        if not panel: continue
        print(f"\n== {read} (macro over tasks)")
        print(f"{'model':10s} " + " ".join(f"{k:>10s}" for k in ("acc", "agreement", "soft_nll", "jsd", "ent_corr")))
        for name, m in panel.items():
            print(f"{name:10s} " + " ".join(f"{m['macro'][k]:10.3f}" for k in ("acc", "agreement", "soft_nll", "jsd", "ent_corr")))
        tasks = sorted({t for m in panel.values() for t in m["tasks"]})
        print("  per task: " + " | ".join(panel.keys()))
        for t in tasks:
            print(f"  {t:28s} " + " | ".join(
                f"acc {panel[n]['tasks'][t]['acc']:.3f} jsd {panel[n]['tasks'][t]['jsd']:.3f} r {panel[n]['tasks'][t]['ent_corr']:+.2f}" if t in panel[n]['tasks'] else "-" for n in panel))


if __name__ == "__main__":
    main()
