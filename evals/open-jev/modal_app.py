"""Train and score open-Jev arms on Modal with Kev's own training and scoring code (github.com/jaredpalmer/kev, pinned).

    modal run modal_app.py::build_breadth                       # rebuild breadth-v1 from its public sources; checks the sha256
    modal run modal_app.py::train --arm soft  --data data/train.jsonl
    modal run modal_app.py::train --arm hard  --data data/train.jsonl --hard
    modal run modal_app.py::train --arm synth --data data/train_synth.jsonl
    modal run modal_app.py::evaluate --arm parent               # Kev-4B as released
    modal run modal_app.py::evaluate --arm soft
    modal run modal_app.py::pull --arm soft                     # rows -> runs/<arm>/

Every arm is a one-epoch delta from jaredpalmer/kev-4b (LoRA + pointer head, Kev's --init_from path) on the same 7,500
crowd records plus 2,000 replayed decision-v7 records, lr 2e-5, seed 0. The arms differ only in each question's target.

Every arm, the parent included, is scored the same way: one temperature fitted (min NLL, micro) on transfer-r3's
calibration partition (held-out datasets, as Kev's rules require), then transfer-v4 development, breadth-v1 development,
the held-out crowd items and ChaosNLI are read at that temperature. Rows keep raw logits, so analyze.py can rescore them.
"""
import hashlib
import json
import os
import subprocess
import sys
import time
from pathlib import Path

import modal

KEV_REF = "65b1e763943ace53fd3a4aae00d8d08dbd849772"
KEV_ROOT, RUNS, HF = "/kev", "/runs", "/hf"
INIT = "jaredpalmer/kev-4b"
SUITE = f"{KEV_ROOT}/evals/v7/decision-v7"
TRANSFER = f"{KEV_ROOT}/evals/v4/transfer-v4"
CALIBRATION = f"{KEV_ROOT}/evals/round3/transfer-r3"   # its calibration partition (580 questions, held-out sources) is Kev's registered T pool; transfer-v4's is empty
BREADTH = f"{RUNS}/suites/breadth-v1"
BREADTH_DEV_SHA = "9aad8f4a7374988b2768d31135d5690137df3a3d6cbc1e771db4ee95ca515a94"   # evals/breadth-v1/manifest.json at KEV_REF
GPU = os.environ.get("OPEN_JEV_GPU", "H100")              # training
EVAL_GPU = os.environ.get("OPEN_JEV_EVAL_GPU", "L40S")    # scoring: 4B in fp32 fits a 48 GB card at half an H100's price

app = modal.App("open-jev")
image = (
    modal.Image.debian_slim(python_version="3.13")
    .apt_install("git", "curl")   # curl: build_breadth_v1.py downloads its non-Hub sources with it
    .run_commands(f"git clone https://github.com/jaredpalmer/kev.git {KEV_ROOT} && git -C {KEV_ROOT} checkout --quiet {KEV_REF}")
    .uv_pip_install(f"kev[serve] @ file://{KEV_ROOT}")
    .uv_pip_install("flash-linear-attention==0.5.2", "triton>=3.7.1", "rank_bm25", "pyarrow")
    .env({"HF_HOME": HF, "HF_HUB_DISABLE_PROGRESS_BARS": "1", "TOKENIZERS_PARALLELISM": "false", "PYTHONUNBUFFERED": "1",
          "TRITON_CACHE_DIR": f"{HF}/triton-cache"})
)
runs = modal.Volume.from_name("open-jev-runs", create_if_missing=True)
hf_cache = modal.Volume.from_name("open-jev-hf-cache", create_if_missing=True)
VOLUMES = {RUNS: runs, HF: hf_cache}


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def stage(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


@app.function(image=image, cpu=8, memory=32768, timeout=3 * 3600, volumes=VOLUMES)
def run_build_breadth():
    """breadth-v1 from its pinned public sources with Kev's deterministic builder. Kept on the private volume only: some
    source licences forbid redistributing the records."""
    out = Path(BREADTH)
    if (out / "development.jsonl").exists() and sha256(out / "development.jsonl") == BREADTH_DEV_SHA:
        return {"status": "already built", "sha256": BREADTH_DEV_SHA}
    tmp = Path(f"{RUNS}/suites/breadth-v1-build")
    subprocess.run(["rm", "-rf", str(tmp)], check=True)
    subprocess.run([sys.executable, "scripts/build_breadth_v1.py", "--out", str(tmp), "--raw", f"{HF}/breadth-raw"], check=True, cwd=KEV_ROOT)
    got = sha256(tmp / "development.jsonl")
    if got != BREADTH_DEV_SHA:
        runs.commit()
        raise ValueError(f"rebuilt breadth-v1 development.jsonl does not match the frozen suite: {got} != {BREADTH_DEV_SHA}")
    subprocess.run(["rm", "-rf", str(out)], check=True); tmp.rename(out)
    # the frozen manifest (from the repo) is the one load_split checks against
    subprocess.run(["cp", f"{KEV_ROOT}/evals/breadth-v1/manifest.json", str(out / "manifest.json")], check=True)
    runs.commit(); hf_cache.commit()
    return {"status": "built", "sha256": got}


@app.function(image=image, gpu=GPU, cpu=4, memory=(32768, 131072), timeout=5 * 3600, volumes=VOLUMES)
def run_train(arm, data, hard=False, epochs=1, lr=2e-5, replay=2000, seed=0, max_state=2048, max_steps=0):
    from kev.checkpoint import Checkpoint
    runs.reload()
    out = Path(RUNS) / arm
    subprocess.run(["rm", "-rf", str(out / "eval")], check=True)
    if (out / "checkpoint/head.pt").exists():
        raise FileExistsError(f"/runs/{arm} already holds a checkpoint")
    subprocess.run(["rm", "-rf", str(out / "checkpoint")], check=True)   # an unfinished (stopped) run's partial directory
    out.mkdir(parents=True, exist_ok=True)
    records = [json.loads(l) for l in data.splitlines() if l.strip()]
    if hard:   # the hard-label arm: same records, majority labels only
        records = [{**r, "questions": {q: {k: v for k, v in d.items() if k != "target"} for q, d in r["questions"].items()}} for r in records]
    with open(out / "train.jsonl", "w", encoding="utf-8") as f:
        for r in records: f.write(json.dumps(r, ensure_ascii=False) + "\n")
    meta = Checkpoint(INIT).meta
    args = meta.extra["args"]
    cmd = [sys.executable, "-m", "kev.train", "--data", str(out / "train.jsonl"), "--init_from", INIT, "--out", str(out / "checkpoint"),
           "--suite", SUITE, "--replay", replay, "--device", "cuda", "--dtype", "bf16",
           "--base", meta.base, "--lora", meta.lora, "--head_dim", meta.head_dim, "--lora_targets", args["lora_targets"],
           "--option_isolation", int(meta.option_isolation), "--special_embeddings", int(meta.special_embeddings), "--weights_dtype", meta.weights_dtype,
           "--epochs", epochs, "--lr", lr, "--batch", args["batch"], "--accum", args["accum"], "--checkpointing", args["checkpointing"],
           "--seed", seed, "--p_none_pair", 0, "--max_state", max_state, "--max_steps", max_steps]
    if meta.base_revision: cmd += ["--base_revision", meta.base_revision]
    cmd = [str(c) for c in cmd]
    config = {"arm": arm, "hard": hard, "max_steps": max_steps, "records": len(records), "cmd": cmd[2:], "kev_ref": KEV_REF, "data_sha256": hashlib.sha256(data.encode()).hexdigest()}
    (out / "config.json").write_text(json.dumps(config, indent=2))
    stage("training: " + " ".join(cmd[2:]))
    started = time.time()
    with open(out / "train.log", "w") as log, subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, cwd=KEV_ROOT) as p:
        for line in p.stdout:
            log.write(line); log.flush()
            if line.startswith(("ep", "saved", "device", "delta", "replay", "dropped")) or "Error" in line or "Traceback" in line: print(line.rstrip(), flush=True)
    runs.commit(); hf_cache.commit()
    if p.returncode: raise RuntimeError(f"kev.train failed ({p.returncode}); see /runs/{arm}/train.log")
    config["train_seconds"] = round(time.time() - started)
    (out / "config.json").write_text(json.dumps(config, indent=2)); runs.commit()
    return config


def score_reads(arm, run, files):
    """Fit T on transfer-v4 calibration, then read every panel at that T. Writes /runs/<arm>/eval/<read>/{rows,report}.json."""
    from kev.benchmark import evaluate_records
    from kev.checkpoint import LoadOptions
    from kev.data import load_records
    from kev.metrics import fit_temperature
    from kev.predictors import LocalPredictor
    from kev.suite import SERVING_CONTEXT_8K, load_split, read_manifest, write_json
    out = Path(RUNS) / arm / "eval"
    subprocess.run(["rm", "-rf", str(out)], check=True)
    # breadth-v1 is admitted at the 8k serving context (its manifest's `context`); the default training context would
    # reject a third of it, and of the crowd panel, as overlong. Records that fit a smaller context score the same.
    assert read_manifest(BREADTH)["context"]["max_state"] == SERVING_CONTEXT_8K["max_state"]
    predictor = LocalPredictor(run, "cuda", LoadOptions(temperature=1.0), context=SERVING_CONTEXT_8K)
    stage(f"{arm}: fitting T on transfer-r3 calibration")
    _, cal_rows = evaluate_records(load_split(CALIBRATION, "calibration"), predictor, out / "calibration")
    T = fit_temperature(cal_rows, aggregation="micro")
    stage(f"{arm}: T = {T:.3f}")
    reads = {"transfer": (load_split(TRANSFER, "development"), tuple(read_manifest(TRANSFER)["holdout_sources"]), False),
             "breadth": (load_split(BREADTH, "development"), (), True)}
    tmp = Path(f"/tmp/{arm}"); tmp.mkdir(exist_ok=True)
    for name, text in files.items():
        (tmp / f"{name}.jsonl").write_text(text, encoding="utf-8")
        reads[name] = (load_records(tmp / f"{name}.jsonl", source=name), (), True)
    summary = {"arm": arm, "run": run, "temperature": T, "reads": {}}
    for name, (records, heldout, skip) in reads.items():
        stage(f"{arm}: reading {name} ({len(records)} records)")
        report, rows = evaluate_records(records, predictor, out / name, T, heldout_sources=heldout, skip_overlong=skip)
        write_json(out / name / "rows.json", rows); write_json(out / name / "report.json", report)
        summary["reads"][name] = {"clean": report["calibrated_clean"] if "calibrated_clean" in report else report["clean"], "coverage": report.get("coverage")}
        runs.commit()
    write_json(out / "summary.json", summary); runs.commit()
    return summary


@app.function(image=image, gpu=EVAL_GPU, cpu=4, memory=(32768, 65536), timeout=4 * 3600, volumes=VOLUMES)
def run_evaluate(arm, files):
    runs.reload()
    run = INIT if arm == "parent" else str(Path(RUNS) / arm / "checkpoint")
    return score_reads(arm, run, files)


@app.function(image=image, cpu=2, memory=4096, timeout=900, volumes=VOLUMES)
def run_pull(arm):
    runs.reload()
    base = Path(RUNS) / arm
    out = {}
    for p in [base / "config.json", base / "train.log", *sorted((base / "eval").glob("*/*.json")), base / "eval/summary.json"]:
        if p.exists() and p.name != "predictions.jsonl":
            out[str(p.relative_to(base))] = p.read_bytes()
    return out


@app.function(image=image, cpu=1, memory=2048, timeout=6 * 3600, volumes=VOLUMES)
def run_pipeline(arm, data, hard, max_steps, files):
    """Server-side train-then-evaluate, so a dropped laptop connection cannot stop it halfway."""
    out = {}
    if arm != "parent":
        out["train"] = run_train.remote(arm, data, hard, max_steps=max_steps)
    out["eval"] = run_evaluate.remote(arm, files)
    return out


# --- local entrypoints --------------------------------------------------------------------------------------------------

EVAL_FILES = {"crowd_dev": "data/crowd_dev.jsonl", "chaosnli": "data/chaosnli.jsonl"}


@app.local_entrypoint()
def build_breadth():
    print(run_build_breadth.remote())


@app.local_entrypoint()
def train(arm: str, data: str, hard: bool = False, epochs: int = 1, lr: float = 2e-5, replay: int = 2000, seed: int = 0):
    print(json.dumps(run_train.remote(arm, Path(data).read_text(encoding="utf-8"), hard, epochs, lr, replay, seed), indent=2))


@app.local_entrypoint()
def evaluate(arm: str):
    files = {k: Path(v).read_text(encoding="utf-8") for k, v in EVAL_FILES.items()}
    print(json.dumps(run_evaluate.remote(arm, files), indent=2))


@app.local_entrypoint()
def pipeline(arm: str, data: str = "", hard: bool = False, max_steps: int = 0):
    """Train (unless arm == parent) then evaluate. Run with `modal run --detach`: the orchestration lives on Modal."""
    files = {k: Path(v).read_text(encoding="utf-8") for k, v in EVAL_FILES.items()}
    text = Path(data).read_text(encoding="utf-8") if arm != "parent" else ""
    print(json.dumps(run_pipeline.remote(arm, text, hard, max_steps, files), indent=2))


@app.local_entrypoint()
def pull(arm: str):
    for rel, blob in run_pull.remote(arm).items():
        dest = Path("runs") / arm / rel
        dest.parent.mkdir(parents=True, exist_ok=True); dest.write_bytes(blob)
    print(f"pulled runs/{arm}")
