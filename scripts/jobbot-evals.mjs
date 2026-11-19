import process from 'node:process';
import { compareJobbotMatches, jobbotScore } from '../functions/_lib/jobbot-ranking.js';

const CANDIDATES = 1000;
const POSTINGS = 10_000;
const BATCH = 100;
const TOP_K = 10;
const DEFAULT_SEED = 20261118;
const WORK_MODES = ['Remote', 'Hybrid', 'On-site'];
const EMPLOYERS = 600;
const REGIONS = 8;
const INDUSTRIES = 6;
const PROFILE_SKILLS = [
	[0, 1, 2, 3, 4],    // Developer relations
	[0, 2, 4, 5, 6],    // Technical education
	[0, 1, 4, 5, 7],    // Technical writing
	[0, 3, 8, 9, 10],   // Applied AI
	[0, 3, 8, 11, 12],  // Software engineering
	[0, 8, 10, 13, 14], // Analytics
	[1, 3, 11, 12, 15], // Security engineering
	[1, 2, 16, 17, 18], // Partnerships
	[2, 13, 16, 18, 19],// Product management
	[5, 6, 17, 20, 21], // Education programs
	[13, 17, 20, 22, 23],// Social impact
	[13, 16, 17, 22, 24],// Investing and strategy
];
const FAMILY = [0, 0, 0, 1, 1, 1, 1, 2, 2, 3, 3, 3];
const FEATURE_COUNT = 11;

function rng(seed) {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let value = Math.imul(state ^ (state >>> 15), state | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
}

function pick(next, count) {
	return Math.floor(next() * count);
}

function clip(value, lower, upper) {
	return Math.min(upper, Math.max(lower, value));
}

function sigmoid(value) {
	return 1 / (1 + Math.exp(-value));
}

function population(mask) {
	mask -= (mask >>> 1) & 0x55555555;
	mask = (mask & 0x33333333) + ((mask >>> 2) & 0x33333333);
	return Math.imul((mask + (mask >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24;
}

function skillMask(next, role, keep, extras) {
	let mask = 1 << PROFILE_SKILLS[role][0];
	for (const skill of PROFILE_SKILLS[role].slice(1)) {
		if (next() < keep) mask |= 1 << skill;
	}
	for (let extra = 0; extra < extras; extra += 1) mask |= 1 << pick(next, 25);
	return mask;
}

function generateCatalog(seed) {
	const next = rng(seed ^ 0x1781fc65);
	const employers = Array.from({ length: EMPLOYERS }, () => ({
		region: pick(next, REGIONS),
		industry: pick(next, INDUSTRIES),
		salaryFactor: 0.77 + next() * 0.65,
		competition: next(),
	}));
	return Array.from({ length: POSTINGS }, (_, id) => {
		const employerId = pick(next, EMPLOYERS);
		const employer = employers[employerId];
		const role = pick(next, FAMILY.length);
		const years = 1 + pick(next, 11);
		const salary = Math.round((73_000 + years * 14_000 + next() * 78_000) * employer.salaryFactor / 5000) * 5000;
		const mask = skillMask(next, role, 0.68 + years * 0.019, pick(next, 4));
		return {
			id, employerId, role, years, salary, mask,
			requiredCount: population(mask),
			mode: pick(next, WORK_MODES.length),
			postedPay: next() > 0.24,
			region: employer.region,
			industry: employer.industry,
			competition: employer.competition,
			hiringNoise: (next() - 0.5) * 1.22,
			interestNoise: (next() - 0.5) * 1.05,
		};
	});
}

function generateCandidate(next, id) {
	const role = pick(next, FAMILY.length);
	const related = FAMILY.map((group, other) => group === FAMILY[role] && other !== role ? other : -1).filter(other => other >= 0);
	const secondary = related[pick(next, related.length)];
	const background = next() < 0.7 ? role : secondary;
	const years = 1 + pick(next, 14);
	const contacts = new Uint8Array(EMPLOYERS);
	for (let contact = 0; contact < 3 + years * 2; contact += 1) contacts[pick(next, EMPLOYERS)] = 1;
	return {
		id, role, secondary, years, contacts,
		mask: skillMask(next, background, 0.48 + years * 0.031, 1 + pick(next, 7)),
		region: pick(next, REGIONS),
		mode: pick(next, WORK_MODES.length),
		industry: next() < 0.28 ? -1 : pick(next, INDUSTRIES),
		payFloor: 80_000 + years * 10_000 + pick(next, 15) * 5000,
		strictWork: next() < 0.58,
		applyEffort: (next() - 0.5) * 1.4,
		hiringReadiness: (next() - 0.5) * 0.9,
	};
}

function workMatch(candidate, job) {
	if (job.mode === 0) return candidate.mode === 0 ? 1 : 0.55;
	if (job.region !== candidate.region) return 0;
	if (candidate.mode === job.mode) return 1;
	return candidate.mode === 0 ? 0.15 : 0.68;
}

function pairFeatures(candidate, job, x, parts) {
	const career = candidate.role === job.role ? 1 : candidate.secondary === job.role ? 0.7
		: FAMILY[candidate.role] === FAMILY[job.role] ? 0.46 : 0;
	const skill = population(candidate.mask & job.mask) / job.requiredCount;
	const years = clip((candidate.years - job.years) / 6, -1, 1);
	const work = workMatch(candidate, job);
	const conflict = Number(candidate.strictWork && work < 0.7);
	const pay = job.postedPay ? clip((job.salary - candidate.payFloor) / 100_000, -1, 1) : 0;
	const industry = candidate.industry >= 0 && candidate.industry === job.industry ? 1 : 0;
	const contact = candidate.contacts[job.employerId];

	x[0] = 1;
	x[1] = career;
	x[2] = skill;
	x[3] = years;
	x[4] = work;
	x[5] = conflict;
	x[6] = pay;
	x[7] = Number(job.postedPay);
	x[8] = industry;
	x[9] = contact;
	x[10] = job.competition;

	parts.location = work === 1 ? 10 : 0;
	parts.pay = job.postedPay ? clip((job.salary - candidate.payFloor) / 30_000, 0, 10) : 0;
	parts.fit = 40 * clip(0.88 * career + 0.12 * industry, 0, 1);
	parts.resume = 40 * clip(0.88 * skill + 0.12 * (years + 1) / 2, 0, 1);
}

function labelRandom(seed, candidate, job) {
	return rng(seed ^ Math.imul(candidate.id + 1, 0x9e3779b1) ^ Math.imul(job.id + 1, 0x7f4a7c15));
}

function simulateOutcome(seed, candidate, job, x) {
	const [, career, skill, years, work, conflict, postedGap, disclosed, industry, contact] = x;
	const aboveBand = clip((job.salary - candidate.payFloor) / 90_000, -1, 1);
	const underqualified = Math.max(0, -years);
	const greatSkillFit = Number(skill >= 0.8 && years >= -0.17);
	const interest = sigmoid(-2.75 + 2.45 * career + 1.05 * skill + 0.94 * work
		- 2.65 * conflict + 1.7 * aboveBand - 0.35 * (1 - disclosed) + 0.62 * industry
		+ 0.24 * contact - 0.57 * underqualified + job.interestNoise);
	const followThrough = sigmoid(0.62 + 0.64 * postedGap + 0.75 * contact + 0.33 * work + candidate.applyEffort);
	const interviewGivenApplication = sigmoid(-3.75 + 1.07 * career + 2.3 * skill - 1.6 * underqualified
		+ 0.64 * greatSkillFit - 0.35 * Math.max(0, years - 0.67) - 1.36 * conflict
		+ 1.17 * contact - 1.68 * job.competition + job.hiringNoise + candidate.hiringReadiness);
	const next = labelRandom(seed, candidate, job);
	const interested = next() < interest;
	const applied = next() < followThrough && interested;
	const interview = next() < interviewGivenApplication && applied;
	return { interested, applied, interview, probability: interest * followThrough * interviewGivenApplication };
}

function probability(weights, x) {
	let score = 0;
	for (let i = 0; i < x.length; i += 1) score += weights[i] * x[i];
	return sigmoid(score);
}

function trainModel(samples, type) {
	const weights = new Float64Array(FEATURE_COUNT);
	const gradient = new Float64Array(FEATURE_COUNT);
	const rows = type === 'interview' ? samples.filter(sample => sample.applied) : samples;
	if (rows.length === 0) return weights;

	for (let step = 0; step < 180; step += 1) {
		gradient.fill(0);
		for (const row of rows) {
			const error = probability(weights, row.x) - Number(row[type]);
			for (let i = 0; i < weights.length; i += 1) gradient[i] += error * row.x[i];
		}
		for (let i = 0; i < weights.length; i += 1) {
			const regularization = i === 0 ? 0 : 0.007 * weights[i];
			weights[i] -= 0.7 * (gradient[i] / rows.length + regularization);
		}
	}
	return weights;
}

function shortlistCandidate(catalog, candidate, model, x, parts) {
	const baseline = [];
	const tuned = [];
	for (const job of catalog) {
		pairFeatures(candidate, job, x, parts);
		const score = jobbotScore(parts);
		const contact = x[9];
		keepBest(baseline, job.id, score, contact);
		if (model) {
			const estimatedInterview = probability(model.apply, x) * probability(model.interview, x);
			keepBest(tuned, job.id, estimatedInterview, contact);
		}
	}
	return { baseline, tuned: model ? tuned : baseline };
}

function keepBest(slate, job, score, contact) {
	const last = slate.at(-1);
	if (slate.length === TOP_K && (score < last.score || (score === last.score && contact <= last.contact))) return;
	const item = { job, score, contact };
	const index = slate.findIndex(existing => compareJobbotMatches(item, existing) < 0);
	if (index === -1) slate.push(item);
	else slate.splice(index, 0, item);
	if (slate.length > TOP_K) slate.pop();
}

function measure(slate, seed, candidate, catalog, x, parts) {
	const result = { fit: 0, applied: 0, interviewed: 0, expected: 0, noneProbability: 1 };
	for (const { job: id } of slate) {
		const job = catalog[id];
		pairFeatures(candidate, job, x, parts);
		const outcome = simulateOutcome(seed, candidate, job, x);
		result.fit += Number(outcome.interested);
		result.applied += Number(outcome.applied);
		result.interviewed += Number(outcome.interview);
		result.expected += outcome.probability;
		result.noneProbability *= 1 - outcome.probability;
	}
	return result;
}

function trainingJobs(slates, candidate, byRole, next) {
	const ids = new Set([...slates.baseline, ...slates.tuned].map(({ job }) => job));
	for (let explore = 0; explore < 10; explore += 1) {
		ids.add(pick(next, POSTINGS));
		const pool = byRole[explore < 7 ? candidate.role : candidate.secondary];
		ids.add(pool[pick(next, pool.length)]);
	}
	return ids;
}

function summarize(rows, variant) {
	let interested = 0;
	let applied = 0;
	let interviews = 0;
	let any = 0;
	let expected = 0;
	let expectedAny = 0;
	const shown = TOP_K * rows.length;
	for (const row of rows) {
		const outcome = row[variant];
		interested += outcome.fit;
		applied += outcome.applied;
		interviews += outcome.interviewed;
		any += Number(outcome.interviewed > 0);
		expected += outcome.expected;
		expectedAny += 1 - outcome.noneProbability;
	}
	return {
		fitRate: interested / shown,
		applicationRate: applied / shown,
		actualInterviewRate: interviews / shown,
		conditionalInterviewRate: applied ? interviews / applied : null,
		anyInterviewRate: any / rows.length,
		expectedInterviews: expected / rows.length,
		expectedInterviewRate: expected / shown,
		expectedAnyInterviewRate: expectedAny / rows.length,
	};
}

function pairedInterval(rows, seed) {
	const differences = rows.map(row => row.tuned.expected - row.baseline.expected);
	const next = rng(seed ^ 0x54d62498);
	const trials = Array.from({ length: 2000 }, () => {
		let total = 0;
		for (let candidate = 0; candidate < differences.length; candidate += 1) {
			total += differences[pick(next, differences.length)];
		}
		return total / differences.length;
	}).sort((a, b) => a - b);
	return {
		mean: differences.reduce((sum, value) => sum + value, 0) / differences.length,
		lower95: trials[50],
		upper95: trials[1949],
	};
}

function comparison(rows) {
	return { baseline: summarize(rows, 'baseline'), tuned: summarize(rows, 'tuned') };
}

function run(seed) {
	const catalog = generateCatalog(seed);
	const byRole = Array.from({ length: FAMILY.length }, () => []);
	for (const job of catalog) byRole[job.role].push(job.id);
	const profiles = rng(seed ^ 0x68a22cc3);
	const holdoutProfiles = rng(seed ^ 0x1b14052a);
	const explore = rng(seed ^ 0x0d743670);
	const x = new Float64Array(FEATURE_COUNT);
	const parts = { location: 0, pay: 0, fit: 0, resume: 0 };
	const samples = [];
	const rounds = [];
	let holdout;
	let model = null;

	for (let start = 0; start < CANDIDATES; start += BATCH) {
		const round = start / BATCH + 1;
		const final = start + BATCH === CANDIDATES;
		const priorLabels = samples.length;
		const rows = [];
		for (let offset = 0; offset < BATCH; offset += 1) {
			const candidate = generateCandidate(final ? holdoutProfiles : profiles, start + offset);
			const slates = shortlistCandidate(catalog, candidate, model, x, parts);
			rows.push({
				mode: candidate.mode,
				baseline: measure(slates.baseline, seed, candidate, catalog, x, parts),
				tuned: measure(slates.tuned, seed, candidate, catalog, x, parts),
			});
			if (final) continue;
			for (const id of trainingJobs(slates, candidate, byRole, explore)) {
				const job = catalog[id];
				pairFeatures(candidate, job, x, parts);
				const { applied, interview } = simulateOutcome(seed, candidate, job, x);
				samples.push({ x: x.slice(), applied, interview });
			}
		}
		const metrics = comparison(rows);
		rounds.push({ round, phase: final ? 'holdout' : 'tune', candidates: BATCH, priorLabels,
			newLabels: samples.length - priorLabels, ...metrics });
		if (final) {
			holdout = {
				candidates: BATCH,
				...metrics,
				deltaExpectedInterviews: pairedInterval(rows, seed),
				cohorts: WORK_MODES.map((group, mode) => {
					const subset = rows.filter(row => row.mode === mode);
					return { group, candidates: subset.length, ...comparison(subset) };
				}),
			};
		} else {
			model = { apply: trainModel(samples, 'applied'), interview: trainModel(samples, 'interview') };
		}
	}

	return {
		version: 1, seed, candidates: CANDIDATES, postings: POSTINGS, pairs: CANDIDATES * POSTINGS,
		topK: TOP_K, trainingCandidates: CANDIDATES - BATCH, trainingLabels: samples.length, rounds, holdout,
		definitions: {
			fitRate: 'Fraction of shown jobs that received a simulated would-pursue vote.',
			applicationRate: 'Fraction of shown jobs that received a simulated application.',
			actualInterviewRate: 'Fraction of shown jobs with a simulated first interview, counting unapplied jobs as zero.',
			conditionalInterviewRate: 'Fraction of simulated applications that resulted in a simulated first interview.',
			anyInterviewRate: 'Fraction of candidate shortlists with at least one simulated first interview.',
			expectedInterviews: 'Average total of the simulator’s joint application and interview probabilities across each ten-job shortlist.',
			expectedInterviewRate: 'Average joint application and first-interview probability per shown job.',
			expectedAnyInterviewRate: 'Average probability of at least one first interview assuming independent outcomes within a shortlist.',
			deltaExpectedInterviews: 'Paired tuned-minus-baseline difference in expected interviews per candidate and its 95% candidate bootstrap interval.',
		},
		method: [
			'Every candidate was scored against the same catalog of generated postings. Both rankers returned ten results per candidate.',
			'The baseline uses the live JobBot point formula with simulated location, compensation, role fit and résumé fit inputs.',
			'The tuned ranker combines the estimated chance of applying with the estimated chance of a first interview after applying. It uses simulated role, skill, experience, location, work mode, pay disclosure, industry, connection and competition features.',
			'Each tuning batch was scored before training on its labels. Training used that batch’s shortlists plus samples from uniform and role-specific exploration.',
			'The last 100 candidates came from a separate seeded stream. Both rankers were frozen before evaluating those candidates on the same job catalog.',
		],
		limitations: [
			'The interview probabilities and interval quantify outcomes in one simulated market. Real interview rates require observed outcomes.',
			'The simulator encodes assumptions about preferences, candidate experience, compensation, connections and employer competition. Different assumptions can reverse or shrink the result.',
			'The benchmark covers numerical ranking. Web retrieval, résumé parsing and language-model fit judgments require their own evaluations.',
		],
	};
}

const args = process.argv.slice(2);
const seed = args.length === 0 ? DEFAULT_SEED : Number(args[1]);
if ((args.length && (args.length !== 2 || args[0] !== '--seed')) ||
	!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
	process.stderr.write('Usage: node scripts/jobbot-evals.mjs [--seed UINT32]\n');
	process.exitCode = 1;
} else {
	const report = run(seed);
	const json = JSON.stringify(report, (_key, value) => typeof value === 'number' && !Number.isInteger(value)
		? Number(value.toFixed(6)) : value, 2);
	process.stdout.write(json + '\n');
}
