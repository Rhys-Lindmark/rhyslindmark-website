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

function renderRoundChart(rounds) {
	const canvas = document.getElementById('round-chart');
	const ctx = canvas.getContext('2d');
	if (!ctx) return;
	const { baseline, tuned } = rounds.at(-1);
	write('chart-summary', `Expected interviews per ten-job shortlist. On the held-out round, current scoring averaged ${count.format(baseline.expectedInterviews)} and tuned scoring averaged ${count.format(tuned.expectedInterviews)}.`);

	function draw() {
		const { width, height } = canvas.getBoundingClientRect();
		if (!width || !height) return;
		const pixelRatio = window.devicePixelRatio || 1;
		canvas.width = Math.round(width * pixelRatio);
		canvas.height = Math.round(height * pixelRatio);
		ctx.scale(pixelRatio, pixelRatio);
		const styles = getComputedStyle(canvas);
		const muted = styles.getPropertyValue('--muted').trim();
		const accent = styles.getPropertyValue('--focus').trim();
		const left = 26;
		const right = width - 40;
		const top = 18;
		const bottom = height - 46;
		const step = (right - left) / (rounds.length - 1);
		const max = Math.ceil(Math.max(...rounds.flatMap(({ baseline, tuned }) => [
			baseline.expectedInterviews, tuned.expectedInterviews,
		])));
		const x = index => left + step * index;
		const y = value => bottom - value / max * (bottom - top);

		ctx.fillStyle = styles.getPropertyValue('--surface').trim();
		ctx.fillRect(right - step / 2, top, width - right + step / 2, bottom - top);
		ctx.font = `12px ${styles.fontFamily}`;
		ctx.fillStyle = muted;
		ctx.strokeStyle = styles.getPropertyValue('--line').trim();
		ctx.textAlign = 'right';
		ctx.textBaseline = 'middle';
		for (let value = 0; value <= max; value += 1) {
			ctx.beginPath();
			ctx.moveTo(left, y(value));
			ctx.lineTo(width, y(value));
			ctx.stroke();
			ctx.fillText(value, left - 8, y(value));
		}

		ctx.textAlign = 'center';
		rounds.forEach(({ round }, index) => ctx.fillText(round, x(index), bottom + 14));
		ctx.fillText('Round', (left + right) / 2, bottom + 34);
		ctx.fillText('Held out', right + 8, bottom + 34);

		for (const [key, color, dash] of [['baseline', muted, [5, 4]], ['tuned', accent, []]]) {
			ctx.beginPath();
			ctx.strokeStyle = color;
			ctx.lineWidth = 2;
			ctx.setLineDash(dash);
			rounds.forEach((round, index) => {
				const value = round[key].expectedInterviews;
				if (index === 0) ctx.moveTo(x(index), y(value));
				else ctx.lineTo(x(index), y(value));
			});
			ctx.stroke();
			const lastValue = rounds.at(-1)[key].expectedInterviews;
			ctx.beginPath();
			ctx.arc(right, y(lastValue), 3.5, 0, Math.PI * 2);
			ctx.fillStyle = color;
			ctx.fill();
			ctx.fillStyle = muted;
			ctx.textAlign = 'left';
			ctx.fillText(lastValue.toFixed(2), right + 8, y(lastValue));
		}
	}

	new ResizeObserver(draw).observe(canvas);
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
		renderRoundChart(report.rounds);
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
