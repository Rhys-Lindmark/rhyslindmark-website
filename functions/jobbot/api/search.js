import { JobbotProblem, searchJobbot } from '../../_lib/jobbot.js';

const MAX_BODY_BYTES = 8 * 1024 * 1024;
const CLIENT_RUNS_PER_DAY = 3;
const TOTAL_RUNS_PER_DAY = 24;

function json(body, status = 200, headers = {}) {
	return Response.json(body, {
		status,
		headers: {
			'Cache-Control': 'no-store',
			'X-Content-Type-Options': 'nosniff',
			...headers,
		},
	});
}

async function readInput(request) {
	if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
		throw new JobbotProblem('Send search details as JSON.', 415);
	}
	if (!request.body) throw new JobbotProblem('Enter search details.', 400);
	if (Number(request.headers.get('Content-Length')) > MAX_BODY_BYTES) {
		throw new JobbotProblem('The search details are too long.', 413);
	}
	const reader = request.body.getReader();
	const decoder = new TextDecoder();
	let size = 0;
	let input = '';
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.byteLength;
		if (size > MAX_BODY_BYTES) {
			await reader.cancel();
			throw new JobbotProblem('The search details are too long.', 413);
		}
		input += decoder.decode(value, { stream: true });
	}
	try {
		return JSON.parse(input + decoder.decode());
	} catch {
		throw new JobbotProblem('The search details could not be read.', 400);
	}
}

async function reserveRun(env, ip) {
	const day = new Date().toISOString().slice(0, 10);
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey('raw', encoder.encode(env.JOBBOT_OPENAI_API_KEY),
		{ name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`jobbot/run/${day}/${ip}`));
	const client = Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('');
	const [, reservation] = await env.JOBBOT_DB.batch([
		env.JOBBOT_DB.prepare('DELETE FROM run_slots WHERE day < ?').bind(day),
		env.JOBBOT_DB.prepare(`
			INSERT INTO run_slots (day, client_key)
			SELECT ?, ?
			WHERE (SELECT COUNT(*) FROM run_slots WHERE day = ?) < ?
			  AND (SELECT COUNT(*) FROM run_slots WHERE day = ? AND client_key = ?) < ?
			RETURNING id
		`).bind(day, client, day, TOTAL_RUNS_PER_DAY, day, client, CLIENT_RUNS_PER_DAY),
	]);
	return reservation.results.length > 0;
}

export async function onRequest(context) {
	const { request, env } = context;
	if (request.method !== 'POST') return json({ error: 'Use POST to run a search.' }, 405, { Allow: 'POST' });
	const origin = request.headers.get('Origin');
	if ((origin && origin !== new URL(request.url).origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
		return json({ error: 'Run the search from JobBot.' }, 403);
	}
	try {
		const input = await readInput(request);
		return json(await searchJobbot(input, {
			apiKey: env.JOBBOT_OPENAI_API_KEY,
			reserve: () => reserveRun(env, request.headers.get('CF-Connecting-IP') || 'unknown'),
			signal: AbortSignal.any([request.signal, AbortSignal.timeout(90_000)]),
		}));
	} catch (error) {
		if (error instanceof JobbotProblem) return json({ error: error.message }, error.status);
		console.warn('jobbot_search_failed');
		return json({ error: 'Live search is temporarily unavailable. Try again later.' }, 503);
	}
}
