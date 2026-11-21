# Open Jev: can internet crowd votes make an open-source Jev better?

The model-level part of the Jev take-home (Linear project "Jev: Model"). The write-up is at
`public/jev/model/` (https://ai.rhyslindmark.com/jev/model/).

**Question.** Jev is trained with RLCD (reinforcement learning for calibrated decisions): its outputs are probabilities
that should match how often an answer is right. If you were a data maximalist, what data would you add to an open-source
Jev, and does it move the benchmarks?

**Bet.** The internet already holds millions of probability-shaped labels: the vote distributions of crowds. Train on
the distribution, not on its majority answer.

## The experiment

Base: [Kev-4B](https://huggingface.co/jaredpalmer/kev-4b) (Apache-2.0; LoRA and a pointer head on Qwen3.5-4B-Base), the
open Jev with the widest measured gap to hosted Jev on held-out data. Every arm is a one-epoch delta from the released
checkpoint through Kev's own `kev.train --init_from` path, on the same 7,500 records (19,500 questions) plus 2,000
replayed `decision-v7` records, lr 2e-5, seed 0. The arms differ only in each question's training target:

| arm | target |
|---|---|
| `parent` | none: Kev-4B as released |
| `hard` | the crowd's majority answer |
| `soft` | the crowd's vote shares |
| `synth` | vote shares from a synthetic crowd: five open-weight LLMs (Qwen 3.7 Flash, Llama 4 Scout, DeepSeek V4.1 Flash, Gemma 3 12B, Mistral Small 24B), one vote each at temperature 1 |

Training sources (all with per-item votes): Scruples AITA anecdotes (Apache-2.0), Measuring Hate Speech (CC-BY-4.0),
HelpSteer2 disagreements (CC-BY-4.0). None is a source of any evaluation panel below.

Panels, every arm scored the same way (one temperature fitted on transfer-r3's calibration partition: 580 questions from
held-out datasets, Kev's registered temperature pool):

- `breadth`: Kev's breadth-v1 development, 14 held-out public datasets, 3,075 questions. Jev's, Kev-27B's and AutoJev's
  rows are committed in Kev's repo (copied to `reference/`). The partition itself is not redistributable, so
  `modal_app.py::build_breadth` rebuilds it from its public sources and checks the sha256 against the frozen manifest.
- `transfer`: Kev's transfer-v4 development, 764 questions from never-trained datasets and held-out policies (656 clean; the rest are permuted variants, which the metrics leave out).
- `crowd_dev`: 1,200 held-out records from the three training sources, scored against the human vote shares.
- `chaosnli`: ChaosNLI (100 annotators per item; SNLI, MNLI, alpha-NLI), never trained: does learning to disagree transfer?

Hosted Jev (`jev-1.14.0`) answers the crowd and ChaosNLI panels through the API (`read_jev.py`). No Jev output is used
for training.

## Run

```bash
python3 -m venv .venv  # or: uv venv --python 3.12 .venv
.venv/bin/pip install modal==1.5.5 datasets pandas pyarrow huggingface_hub httpx
.venv/bin/python build_data.py                     # data/train.jsonl, crowd_dev.jsonl, chaosnli.jsonl, targets.json
.venv/bin/python synth_crowd.py                    # needs OPENROUTER_KEY_JEV_EVAL; ~$2.10
.venv/bin/python synth_crowd.py --build            # data/train_synth.jsonl
.venv/bin/python read_jev.py                       # needs TYPESAFE_KEY_JEV_EVAL; ~$0.07
modal run modal_app.py::build_breadth
modal run --detach modal_app.py::train --arm hard  --data data/train.jsonl --hard
modal run --detach modal_app.py::train --arm soft  --data data/train.jsonl
modal run --detach modal_app.py::train --arm synth --data data/train_synth.jsonl
for a in parent hard soft synth; do modal run --detach modal_app.py::evaluate --arm $a; done
for a in parent hard soft synth; do modal run modal_app.py::pull --arm $a; done
.venv/bin/python analyze.py                        # results/summary.json
```

Keys are read from the environment, or from `evals/.env` (gitignored). Generated data (`data/*.jsonl`, `data/synth/`) and
logs are gitignored; `data/manifest.json` records every file's sha256 and the dataset revisions.

`vendor/kev_metrics.py` is Kev's `kev/metrics.py` at commit `65b1e763` (Apache-2.0), unchanged, so local rescoring
matches `kev.benchmark` exactly.
