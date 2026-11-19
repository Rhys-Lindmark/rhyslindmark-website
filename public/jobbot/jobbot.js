const form = document.querySelector('#search-form');
const searchButton = document.querySelector('#search-button');
const exampleButton = document.querySelector('#example-button');
const status = document.querySelector('#search-status');
const results = document.querySelector('#results');
const heading = document.querySelector('#results-heading');
const note = document.querySelector('#results-note');
const matches = document.querySelector('#matches');
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const exampleJobs = [
	{
		company: 'Example AI Lab',
		title: 'Developer Education Lead',
		location: 'San Francisco, in person',
		compensation: 280_000,
		baseOnly: true,
		payEvidence: '$260,000–$300,000 base. Equity value undisclosed.',
		score: 84,
		parts: { location: 10, pay: 1, fit: 39, resume: 34 },
		why: 'You’ve built hands-on AI courses and led community workshops.',
		gap: 'The role asks for experience running a certification program.',
		contact: 'Jordan Lee, former workshop co-host',
	},
	{
		company: 'Example Developer Tools',
		title: 'Developer Experience Engineer',
		location: 'Remote, United States',
		compensation: null,
		score: 61,
		parts: { location: 0, pay: 0, fit: 35, resume: 26 },
		why: 'Your public sample apps show you can explain an API through working code.',
		gap: 'The team wants someone who has owned production SDK releases.',
		contact: null,
	},
];

function element(tag, text, className) {
	const node = document.createElement(tag);
	if (text) node.textContent = text;
	if (className) node.className = className;
	return node;
}

function fact(label, value) {
	const row = element('p', '', 'job-fact');
	row.append(element('strong', label), document.createTextNode(` ${value}`));
	return row;
}

function postingLink(value, title) {
	try {
		const url = new URL(value);
		if (url.protocol !== 'https:' || url.username || url.password) return null;
		const link = element('a', title);
		link.href = url.href;
		link.target = '_blank';
		link.rel = 'noopener noreferrer';
		link.setAttribute('aria-label', `${title}, open source posting in a new tab`);
		return link;
	} catch {
		return null;
	}
}

function jobRow(job) {
	const row = element('li');
	const title = element('h3');
	title.append(postingLink(job.url, job.title) ?? document.createTextNode(job.title));
	const pay = job.compensation === null ? 'Pay undisclosed' : `${usd.format(job.compensation)} midpoint${job.baseOnly ? ' base' : ' base + equity'}`;
	row.append(element('p', job.company, 'job-company'), title,
		element('p', `${job.location} | ${pay}`, 'job-meta'));
	if (job.why) row.append(fact('Fit', job.why));
	if (job.gap) row.append(fact('Gap', job.gap));
	row.append(fact('Contact', job.contact ?? 'No contact provided at this company.'));
	const details = element('details', '', 'job-detail');
	const { location, pay: payPoints, fit, resume } = job.parts;
	details.append(element('summary', `Match score ${job.score}/100`),
		element('p', `Location ${location}/10, pay ${payPoints}/10, role fit ${fit}/40, résumé fit ${resume}/40.`));
	if (job.payEvidence) details.append(element('p', job.payEvidence));
	row.append(details);
	return row;
}

function setStatus(message, state) {
	status.hidden = !message;
	status.dataset.state = state;
	status.textContent = message;
}

function showJobs(jobs, example = false) {
	heading.textContent = example ? 'Example shortlist' : 'Your shortlist';
	note.textContent = example
		? 'Fictional postings scored for an example candidate seeking in-person work in San Francisco.'
		: `${jobs.length} ranked ${jobs.length === 1 ? 'match' : 'matches'}. Each title opens the source posting.`;
	matches.replaceChildren(...jobs.map(jobRow));
	results.hidden = false;
	heading.focus();
}

exampleButton.addEventListener('click', () => {
	setStatus('', '');
	showJobs(exampleJobs, true);
});

form.addEventListener('submit', async event => {
	event.preventDefault();
	const data = Object.fromEntries(new FormData(form));
	results.hidden = true;
	searchButton.disabled = true;
	exampleButton.disabled = true;
	searchButton.textContent = 'Searching…';
	setStatus('Finding public postings and scoring the matches. This can take up to 90 seconds.', 'loading');
	try {
		const response = await fetch(form.action, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data),
			signal: AbortSignal.timeout(95_000),
		});
		const payload = await response.json();
		if (!response.ok) {
			setStatus(payload.error || 'Search is temporarily unavailable. Try again later.', 'error');
		} else if (!payload.jobs.length) {
			setStatus('No open matches with verified posting links. Try a related title or add a public job link.', 'empty');
		} else {
			setStatus('', '');
			showJobs(payload.jobs);
		}
	} catch {
		setStatus('The search could not finish. Try again in a moment.', 'error');
	} finally {
		searchButton.textContent = 'Find jobs';
		searchButton.disabled = false;
		exampleButton.disabled = false;
	}
});
