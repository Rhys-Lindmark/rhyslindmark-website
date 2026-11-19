const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat('en-US');
const count = new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const signedCount = new Intl.NumberFormat('en-US', { signDisplay: 'always', minimumFractionDigits: 3, maximumFractionDigits: 3 });

function write(id, text) {
	document.getElementById(id).textContent = text;
}

function fillRows(id, rows) {
	const elements = rows.map(([label, ...values]) => {
		const row = document.createElement('tr');
		const title = document.createElement('th');
		title.scope = 'row';
		title.textContent = label;
		row.append(title);
		for (const value of values) {
			const cell = document.createElement('td');
			cell.textContent = value;
			row.append(cell);
		}
		return row;
	});
	document.getElementById(id).replaceChildren(...elements);
}

async function loadData(file) {
	const response = await fetch(`/jobbot/evals/${file}`);
	if (!response.ok) throw new Error('Report data is unavailable');
	return response.json();
}

async function renderBenchmark() {
	try {
		const report = await loadData('report.json');
		const { baseline, tuned, deltaExpectedInterviews } = report.holdout;
		const finalRound = report.rounds.at(-1);
		write('holdout-summary', `Both rankers returned ${report.topK} jobs for each of the final ${finalRound.candidates} candidates. The draft uses current scoring.`);
		fillRows('holdout-metrics', [
			['Jobs candidates would pursue', percent.format(baseline.fitRate), percent.format(tuned.fitRate)],
			['Expected interviews per shortlist', count.format(baseline.expectedInterviews), count.format(tuned.expectedInterviews)],
			['Modeled chance of a first interview', percent.format(baseline.expectedAnyInterviewRate), percent.format(tuned.expectedAnyInterviewRate)],
			['Candidates with an interview in the simulation', percent.format(baseline.anyInterviewRate), percent.format(tuned.anyInterviewRate)],
			['Shown jobs yielding a simulated interview', percent.format(baseline.actualInterviewRate), percent.format(tuned.actualInterviewRate)],
		]);
		if (deltaExpectedInterviews) {
			const { mean, lower95, upper95 } = deltaExpectedInterviews;
			write('uncertainty', `Tuned minus current scoring: ${signedCount.format(mean)} expected interviews per shortlist (paired 95% interval ${signedCount.format(lower95)} to ${signedCount.format(upper95)}).`);
		}
		fillRows('cohort-metrics', report.holdout.cohorts.map(cohort => [
			`${cohort.group} (${cohort.candidates})`,
			percent.format(cohort.baseline.fitRate),
			percent.format(cohort.tuned.fitRate),
		]));
		write('scale', `${integer.format(report.candidates)} fictional candidates, ${integer.format(report.postings)} fictional jobs, and ${integer.format(report.pairs)} candidate–job pairs.`);
		fillRows('round-metrics', report.rounds.map((round, index) => [
			`${index + 1}${round.phase === 'holdout' ? ' (held out)' : ''}`,
			count.format(round.baseline.expectedInterviews),
			count.format(round.tuned.expectedInterviews),
		]));
		document.getElementById('benchmark').hidden = false;
		document.getElementById('report-status').hidden = true;
	} catch {
		write('report-status', 'The benchmark data could not load. Refresh the page to try again.');
	}
}

async function renderModelCheck() {
	try {
		const { cases, passed } = await loadData('model-check.json');
		write('model-summary', `JobBot’s hosted scoring model ranked the expected role first for ${passed} of ${cases.length} fictional profiles. This check used a fixed set of synthetic postings.`);
		fillRows('model-cases', cases.map(({ expected, rank }) => [expected, rank ?? 'Outside shortlist']));
		document.getElementById('model-check').hidden = false;
	} catch {
		// The offline benchmark can render without the independent model check.
	}
}

await Promise.all([renderBenchmark(), renderModelCheck()]);
