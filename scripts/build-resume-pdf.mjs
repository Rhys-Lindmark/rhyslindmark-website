// Print the built /resume page to public/resume.pdf, so the PDF always matches resume.md.
// Run: npm run resume:pdf (builds first). Needs Google Chrome; set CHROME to use another binary.
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 4398;
const url = `http://localhost:${port}/resume/`;
const output = fileURLToPath(new URL('../public/resume.pdf', import.meta.url));

const preview = spawn('npx', ['astro', 'preview', '--port', String(port)], { stdio: 'ignore' });
const profile = await mkdtemp(join(tmpdir(), 'resume-pdf-'));
try {
	for (let tries = 0; ; tries++) {
		try {
			if ((await fetch(url)).ok) break;
		} catch {}
		if (tries > 50) throw new Error(`astro preview never served ${url}`);
		await new Promise((r) => setTimeout(r, 200));
	}
	await promisify(execFile)(chrome, [
		'--headless=new',
		'--disable-gpu',
		'--no-pdf-header-footer',
		`--user-data-dir=${profile}`,
		`--print-to-pdf=${output}`,
		url,
	]);
	console.log(`Wrote ${output}`);
} finally {
	preview.kill();
	await rm(profile, { recursive: true, force: true });
}
