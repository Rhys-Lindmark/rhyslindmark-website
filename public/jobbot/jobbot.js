const form = document.querySelector('#search-form');
const searchButton = document.querySelector('#search-button');
const exampleButton = document.querySelector('#example-button');
const status = document.querySelector('#search-status');
const results = document.querySelector('#results');
const heading = document.querySelector('#results-heading');
const note = document.querySelector('#results-note');
const matches = document.querySelector('#matches');
const resumeFile = document.querySelector('#resume-file');
const connectionsFile = document.querySelector('#connections-file');
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const MB = 1024 * 1024;

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
	row.append(fact('Possible contact', job.contact ?? 'No contact found in the connections you provided.'));
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

function csvRows(csv) {
	const rows = [];
	let row = [];
	let cell = '';
	let quoted = false;
	for (let i = 0; i < csv.length; i += 1) {
		const char = csv[i];
		if (quoted) {
			if (char !== '"') cell += char;
			else if (csv[i + 1] === '"') {
				cell += '"';
				i += 1;
			} else quoted = false;
		} else if (char === '"' && !cell) {
			quoted = true;
		} else if (char === ',' || char === '\n' || char === '\r') {
			row.push(cell);
			cell = '';
			if (char !== ',') {
				rows.push(row);
				row = [];
				if (char === '\r' && csv[i + 1] === '\n') i += 1;
			}
		} else {
			cell += char;
		}
	}
	if (quoted) throw new Error('The connections CSV has an unfinished quoted field.');
	if (cell || row.length) rows.push([...row, cell]);
	return rows;
}

async function readConnections(file) {
	if (!file) return [];
	if (file.size > 2 * MB) throw new Error('Choose a connections CSV up to 2 MB.');
	if (/\bfollowing\b/i.test(file.name)) throw new Error('Upload a connections list with companies.');
	const rows = csvRows((await file.text()).replace(/^\uFEFF/, ''));
	for (const [index, row] of rows.entries()) {
		const headers = row.map(value => value.trim().toLowerCase());
		const companyIndex = headers.indexOf('company');
		const nameIndex = headers.indexOf('name');
		const firstIndex = headers.indexOf('first name');
		const lastIndex = headers.indexOf('last name');
		if (companyIndex < 0 || (nameIndex < 0 && (firstIndex < 0 || lastIndex < 0))) continue;
		const connections = rows.slice(index + 1).map(values => ({
			company: values[companyIndex]?.trim().slice(0, 100),
			name: (nameIndex < 0 ? [values[firstIndex], values[lastIndex]].join(' ') : values[nameIndex])
				?.trim().slice(0, 150),
		})).filter(({ company, name }) => company && name).slice(0, 8_000);
		if (connections.length) return connections;
		break;
	}
	throw new Error('Use LinkedIn’s Connections.csv or a CSV with names and companies.');
}

function fileAsBase64(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.addEventListener('load', () => resolve(String(reader.result).split(',')[1]));
		reader.addEventListener('error', () => reject(new Error('The résumé file could not be read.')));
		reader.readAsDataURL(file);
	});
}

async function readSearchInputs() {
	const data = Object.fromEntries(new FormData(form));
	delete data['resume-file'];
	delete data['connections-file'];
	const file = resumeFile.files[0];
	if (file) {
		const extension = file.name.split('.').at(-1).toLowerCase();
		if (!['pdf', 'docx', 'txt'].includes(extension) || file.size > 3 * MB) {
			throw new Error('Choose a PDF, DOCX, or TXT résumé up to 3 MB.');
		}
		if (extension === 'txt') data.resume = (await file.text()).trim().slice(0, 12_000);
		else data.resumeFile = { extension, data: await fileAsBase64(file) };
	}
	if (!data.resumeFile && data.resume.trim().length < 20) {
		throw new Error('Upload your résumé or paste at least 20 characters of experience.');
	}
	data.connections = await readConnections(connectionsFile.files[0]);
	return data;
}

exampleButton.addEventListener('click', () => {
	setStatus('', '');
	showJobs(exampleJobs, true);
});

form.addEventListener('submit', async event => {
	event.preventDefault();
	results.hidden = true;
	searchButton.disabled = true;
	exampleButton.disabled = true;
	searchButton.textContent = 'Searching…';
	setStatus('Reading your search details…', 'loading');
	try {
		let data;
		try {
			data = await readSearchInputs();
		} catch (error) {
			setStatus(error.message, 'error');
			return;
		}
		setStatus('Finding public postings and scoring the matches. This can take up to 90 seconds.', 'loading');
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
