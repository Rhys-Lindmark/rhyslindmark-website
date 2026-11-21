"""Build the crowd-vote training set and the held-out evaluation sets, in Kev's labelled-request JSONL format.

Every training question carries two answers built from the same human votes:
  label   the majority answer (the hard-label arm trains on this)
  target  the share of votes for each option (the soft-label arm trains on this)

Sources (all public, each with per-item vote counts):
  scruples   Reddit r/AmItheAsshole posts with the community's verdict votes (Lourie et al. 2021, Apache-2.0)
  mhs        Measuring Hate Speech: comments rated by several annotators on survey items (Kennedy et al. 2020, CC-BY-4.0)
  helpsteer2 Model responses rated 0-4 by three annotators each, the 'disagreements' release (Wang et al. 2024, CC-BY-4.0)
Evaluation only, never trained on:
  chaosnli   100 annotator labels per item for SNLI, MNLI and alpha-NLI items (Nie et al. 2020, CC-BY-NC-4.0)

Writes data/train.jsonl, data/crowd_dev.jsonl, data/chaosnli.jsonl and data/targets.json (human vote shares for every
evaluation question, kept out of the request files). Deterministic: seed 0.

    .venv/bin/python build_data.py
"""
import gzip
import hashlib
import json
import random
from collections import Counter
from pathlib import Path

import pandas as pd
from huggingface_hub import hf_hub_download

ROOT = Path(__file__).parent
RAW, OUT = ROOT / "data/raw", ROOT / "data"
PINS = {  # dataset revisions read for this build
    "tasksource/scruples": "3d8d8255",
    "ucberkeley-dlab/measuring-hate-speech": "5468f6e1",
    "nvidia/HelpSteer2": "990b2711",
    "earino/chaosnli": "bf8d66a1",
}
N_TRAIN = {"scruples": 3000, "mhs": 2000, "helpsteer2": 2500}
N_DEV = {"scruples": 400, "mhs": 400, "helpsteer2": 400}
N_CHAOS = 500          # per ChaosNLI subset
MAX_CHARS = 6000       # keep states well inside Kev's trained length
rng = random.Random(0)


def shares(counts, keys):
    total = sum(counts.get(k, 0) for k in keys)
    return {k: round(counts.get(k, 0) / total, 6) for k in keys}


def majority(counts, keys, ordinal=False):
    """Most-voted option. Ties: for ordered levels, the tied level nearest the vote mean; otherwise the first in `keys`."""
    best = max(counts.get(k, 0) for k in keys)
    tied = [k for k in keys if counts.get(k, 0) == best]
    if ordinal and len(tied) > 1:
        mean = sum(int(k) * counts.get(k, 0) for k in keys) / sum(counts.get(k, 0) for k in keys)
        return min(tied, key=lambda k: abs(int(k) - mean))
    return tied[0]


def question(kind, instructions, criteria, counts, src):
    """A labelled question. Score targets and labels are keyed by level index as a string; Kev wants an int label."""
    if kind == "score":
        keys = [str(i) for i in range(len(criteria))]
        lab = majority(counts, keys, ordinal=True)
        return {"type": "score", "instructions": instructions, "criteria": criteria, "label": int(lab),
                "target": shares(counts, keys), "src": src}
    if kind == "noul":
        keys = ["false", "true"]
        return {"type": "noul", "instructions": instructions, "criteria": criteria, "label": majority(counts, keys) == "true",
                "target": shares(counts, keys), "src": src}
    keys = list(criteria)
    return {"type": "choice", "instructions": instructions, "criteria": criteria, "label": majority(counts, keys),
            "target": shares(counts, keys), "src": src}


# --- scruples ------------------------------------------------------------------------------------------------------------

WHO = {
    "author": "The person who wrote the post is in the wrong.",
    "other": "Someone else in the story is in the wrong, and the author is not.",
    "everybody": "Both the author and the other people in the story are in the wrong.",
    "nobody": "No one in the story is in the wrong.",
    "more_info_needed": "The post leaves out information a reader would need to judge.",
}
WHO_FROM = {"AUTHOR": "author", "OTHER": "other", "EVERYBODY": "everybody", "NOBODY": "nobody", "INFO": "more_info_needed"}


def scruples(split, n, min_votes):
    path = hf_hub_download("tasksource/scruples", f"{split}.scruples-anecdotes.jsonl", repo_type="dataset", local_dir=RAW / "scruples")
    rows = [json.loads(l) for l in open(path, encoding="utf-8")]
    rows = [r for r in rows if sum(r["label_scores"].values()) >= min_votes and len(r["title"]) + len(r["text"]) <= MAX_CHARS]
    rng.shuffle(rows)
    out = []
    for r in rows[:n]:
        who = {WHO_FROM[k]: v for k, v in r["label_scores"].items()}
        wrong = {"true": r["binarized_label_scores"]["WRONG"], "false": r["binarized_label_scores"]["RIGHT"]}
        out.append({"_meta": {"id": f"scruples/{r['id']}", "source": "scruples"},
                    "state": {"title": r["title"], "post": r["text"]},
                    "questions": {
                        "who_is_wrong": question("choice", "Based on this post, who is in the wrong?", WHO, who, "scruples_who"),
                        "author_wrong": question("noul", "Is the author of this post in the wrong?",
                                                 {"true": "The author did something wrong in this situation.",
                                                  "false": "The author acted reasonably in this situation."}, wrong, "scruples_author_wrong"),
                    }})
    return out


# --- measuring hate speech -----------------------------------------------------------------------------------------------

MHS_QUESTIONS = {
    "hatespeech": ("score", "Is `comment` hate speech?",
                   ["The comment is not hate speech.", "It is unclear whether the comment is hate speech.", "The comment is hate speech."]),
    "insult": ("score", "How insulting is `comment` toward the people it is about?",
               ["The comment does not insult anyone.", "The comment is slightly insulting.", "The comment is moderately insulting.",
                "The comment is very insulting.", "The comment is extremely insulting."]),
    "violence": ("score", "Does `comment` call for violence against the people it is about?",
                 ["The comment does not mention violence.", "The comment hints at violence without calling for it.",
                  "The comment is ambiguous about violence.", "The comment suggests violence would be acceptable.",
                  "The comment openly calls for violence."]),
}


def mhs(n_train, n_dev, min_annotators=3):
    path = hf_hub_download("ucberkeley-dlab/measuring-hate-speech", "measuring-hate-speech.parquet", repo_type="dataset", local_dir=RAW / "mhs")
    df = pd.read_parquet(path, columns=["comment_id", "text", *MHS_QUESTIONS])
    groups = [(cid, g) for cid, g in df.groupby("comment_id") if len(g) >= min_annotators]
    rng.shuffle(groups)
    out = []
    for cid, g in groups[:n_train + n_dev]:
        qs = {}
        for item, (kind, instr, levels) in MHS_QUESTIONS.items():
            counts = Counter(str(int(v)) for v in g[item].dropna())
            qs[item] = question(kind, instr, levels, counts, f"mhs_{item}")
        out.append({"_meta": {"id": f"mhs/{cid}", "source": "mhs"}, "state": {"comment": g["text"].iloc[0]}, "questions": qs})
    return out[:n_train], out[n_train:]


# --- helpsteer2 ----------------------------------------------------------------------------------------------------------

HS2_QUESTIONS = {
    "helpfulness": ("How helpful is `response` to the person who wrote `prompt`?",
                    ["The response is not helpful at all.", "The response is slightly helpful.", "The response is partly helpful.",
                     "The response is mostly helpful.", "The response is fully helpful."]),
    "correctness": ("How correct and complete is `response`?",
                    ["The response is wrong or misses the request.", "The response has major errors or omissions.",
                     "The response is partly correct.", "The response is mostly correct with minor issues.",
                     "The response is fully correct and complete."]),
    "coherence": ("How clear and consistent is `response`?",
                  ["The response is incoherent.", "The response is often hard to follow.", "The response is somewhat clear.",
                   "The response is mostly clear.", "The response is perfectly clear and consistent."]),
}


def helpsteer2(n_train, n_dev):
    path = hf_hub_download("nvidia/HelpSteer2", "disagreements/disagreements.jsonl.gz", repo_type="dataset", local_dir=RAW / "helpsteer2")
    with gzip.open(path, "rt", encoding="utf-8") as f:
        rows = [json.loads(l) for l in f]
    rows = [r for r in rows if len(r["prompt"]) + len(r["response"]) <= MAX_CHARS and all(len(r[k]) >= 3 for k in HS2_QUESTIONS)]
    # several responses share a prompt: split by prompt so no evaluation prompt was trained on
    by_prompt = {}
    for r in rows: by_prompt.setdefault(r["prompt"], []).append(r)
    prompts = sorted(by_prompt); rng.shuffle(prompts)
    train, dev = [], []
    for p in prompts:
        bucket = dev if len(dev) < n_dev else train
        if len(train) >= n_train: break
        for r in by_prompt[p]:
            rid = hashlib.sha256((r["prompt"] + "\x00" + r["response"]).encode()).hexdigest()[:16]
            qs = {k: question("score", instr, levels, Counter(str(int(v)) for v in r[k]), f"helpsteer2_{k}")
                  for k, (instr, levels) in HS2_QUESTIONS.items()}
            bucket.append({"_meta": {"id": f"helpsteer2/{rid}", "source": "helpsteer2"},
                           "state": {"prompt": r["prompt"], "response": r["response"]}, "questions": qs})
    return train[:n_train], dev[:n_dev]


# --- chaosnli (evaluation only) ------------------------------------------------------------------------------------------

NLI = {"entailment": "The hypothesis must be true if the premise is true.",
       "neutral": "The hypothesis might or might not be true given the premise.",
       "contradiction": "The hypothesis cannot be true if the premise is true."}


def chaosnli(n):
    out = []
    for subset in ("snli", "mnli_m", "alphanli"):
        path = hf_hub_download("earino/chaosnli", f"raw/chaosNLI_{subset}.jsonl", repo_type="dataset", local_dir=RAW / "chaosnli")
        rows = [json.loads(l) for l in open(path, encoding="utf-8")]
        rng.shuffle(rows)
        for r in rows[:n]:
            ex, counts = r["example"], r["label_count"]
            if subset == "alphanli":
                state = {"beginning": ex["obs1"], "ending": ex["obs2"]}
                crit = {"first": ex["hyp1"], "second": ex["hyp2"]}
                q = question("choice", "Which middle of the story better explains how the beginning led to the ending?", crit,
                             {"first": counts[0], "second": counts[1]}, "chaosnli_alphanli")
            else:
                state = {"premise": ex["premise"], "hypothesis": ex["hypothesis"]}
                q = question("choice", "How does `hypothesis` relate to `premise`?", NLI,
                             {"entailment": counts[0], "neutral": counts[1], "contradiction": counts[2]}, f"chaosnli_{subset}")
            out.append({"_meta": {"id": f"chaosnli_{subset}/{r['uid']}", "source": f"chaosnli_{subset}"}, "state": state, "questions": {"relation": q}})
    return out


def write(path, records):
    with open(path, "w", encoding="utf-8") as f:
        for r in records: f.write(json.dumps(r, ensure_ascii=False) + "\n")


def strip_targets(records):
    """Evaluation requests carry the majority label only; vote shares go to targets.json."""
    return [{**r, "questions": {q: {k: v for k, v in d.items() if k != "target"} for q, d in r["questions"].items()}} for r in records]


def main():
    sc_train = scruples("train", N_TRAIN["scruples"], min_votes=5)
    sc_dev = scruples("dev", N_DEV["scruples"], min_votes=5)
    mhs_train, mhs_dev = mhs(N_TRAIN["mhs"], N_DEV["mhs"])
    hs_train, hs_dev = helpsteer2(N_TRAIN["helpsteer2"], N_DEV["helpsteer2"])
    train = sc_train + mhs_train + hs_train
    rng.shuffle(train)
    dev = sc_dev + mhs_dev + hs_dev
    chaos = chaosnli(N_CHAOS)
    ids = [r["_meta"]["id"] for r in train + dev + chaos]
    assert len(ids) == len(set(ids)), "duplicate record ids"
    train_text = {json.dumps(r["state"], sort_keys=True) for r in train}
    assert not any(json.dumps(r["state"], sort_keys=True) in train_text for r in dev), "evaluation state also in training"

    write(OUT / "train.jsonl", train)
    write(OUT / "crowd_dev.jsonl", strip_targets(dev))
    write(OUT / "chaosnli.jsonl", strip_targets(chaos))
    targets = {f"{r['_meta']['id']}|{q}": d["target"] for r in dev + chaos for q, d in r["questions"].items()}
    (OUT / "targets.json").write_text(json.dumps(targets, sort_keys=True))
    summary = {"pins": PINS, "seed": 0,
               "train": {"records": len(train), "questions": sum(len(r["questions"]) for r in train),
                         "by_source": Counter(r["_meta"]["source"] for r in train)},
               "crowd_dev": {"records": len(dev), "by_source": Counter(r["_meta"]["source"] for r in dev)},
               "chaosnli": {"records": len(chaos), "by_source": Counter(r["_meta"]["source"] for r in chaos)},
               "sha256": {p: hashlib.sha256((OUT / p).read_bytes()).hexdigest() for p in ("train.jsonl", "crowd_dev.jsonl", "chaosnli.jsonl", "targets.json")}}
    (OUT / "manifest.json").write_text(json.dumps(summary, indent=2, default=dict))
    print(json.dumps(summary, indent=2, default=dict))


if __name__ == "__main__":
    main()
