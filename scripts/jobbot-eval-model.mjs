import { searchJobbot } from '../functions/_lib/jobbot.js';

const cases = [
	{
		expected: 'Developer Education Lead',
		roles: 'Developer education for an AI developer platform',
		resume: 'Designed an AI application development course, taught API workshops, and maintained TypeScript code samples.',
	},
	{
		expected: 'Applied AI Engineer',
		roles: 'Applied AI engineering building and evaluating production AI systems',
		resume: 'Deployed Python retrieval systems, built model evaluation pipelines and measured latency and retrieval quality.',
	},
	{
		expected: 'Ecosystem Partnerships Lead',
		roles: 'Developer ecosystem partnerships and go-to-market for an AI company',
		resume: 'Ran a startup partner program, worked with founders on co-selling, led integrations and built a partner pipeline.',
	},
	{
		expected: 'AI Policy Researcher',
		roles: 'Research on societal impacts of AI and public policy',
		resume: 'Published research on algorithmic accountability, performed social impact assessments, and briefed policymakers.',
	},
];
const catalog = [
	['Developer Education Lead', 'Build technical AI courses, run developer workshops, and maintain API and SDK sample projects.'],
	['Applied AI Engineer', 'Deploy Python retrieval systems and build test pipelines for model quality and production latency.'],
	['Ecosystem Partnerships Lead', 'Recruit and support developer partners, lead joint launches, and own an ecosystem sales pipeline.'],
	['AI Policy Researcher', 'Research AI governance, conduct impact assessments, and brief public officials.'],
	['Product Accountant', 'Prepare financial reports, run monthly close, and maintain accounting controls.'],
	['Visual Designer', 'Build brand campaigns and marketing illustrations using vector design tools.'],
];
const jobs = catalog.map(([title, requirements], index) => ({
	title, requirements,
	company: 'Synthetic Tech Co.',
	url: `https://careers.example.org/job/${index}`,
	location: 'Remote',
	confirmed_location_match: false,
	base_low_usd: null,
	base_high_usd: null,
	annual_equity_low_usd: null,
	annual_equity_high_usd: null,
	pay_evidence: '',
}));

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error('Set OPENAI_API_KEY to run the four hosted scoring checks.');

const results = [];
for (const { expected, roles, resume } of cases) {
	const { jobs: ranked } = await searchJobbot({ roles, resume }, {
		apiKey,
		reserve: async () => true,
		signal: AbortSignal.timeout(25_000),
		fetchResponse: (url, request) => {
			const call = JSON.parse(request.body);
			if (call.text.format.name === 'jobbot_scores' && !call.tools) return fetch(url, request);
			if (call.text.format.name !== 'jobbot_postings') throw new Error('Unexpected model call');
			return Response.json({ output: [
				{ type: 'web_search_call', action: { sources: jobs.map(job => ({ url: job.url })) } },
				{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ jobs }) }] },
			] });
		},
	});
	const rank = ranked.findIndex(job => job.title === expected) + 1;
	results.push({ expected, top: ranked[0]?.title ?? null, rank: rank || null });
}
console.log(JSON.stringify({ cases: results, passed: results.filter(({ rank }) => rank === 1).length }, null, 2));
