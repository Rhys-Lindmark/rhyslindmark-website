// Reuse the live hero's stroke geometry; do not maintain a second illustration.
// Run: node scripts/build-ai2026-preview.mjs (requires the existing sharp + ffmpeg).
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const source = await fs.readFile(new URL('../public/posts/ai2026-pt1/intro/series-hero-silk.js', import.meta.url), 'utf8');
const geometry = source.slice(source.indexOf('  function curve('), source.indexOf('  class SilkHero'));
const strokes = vm.runInNewContext(`${geometry}\ncomposition();`);
const width = 1200, height = 630, fps = 24;
const output = fileURLToPath(new URL('../public/posts/ai2026-preview-v2', import.meta.url));
const points = strokes.flatMap(s => s.points);
const minX = Math.min(...points.map(p => p[0])), maxX = Math.max(...points.map(p => p[0]));
const minY = Math.min(...points.map(p => p[1])), maxY = Math.max(...points.map(p => p[1]));
const scale = Math.min((width - 64) / (maxX - minX), (height - 64) / (maxY - minY));
const artX = (width - (maxX - minX) * scale) / 2 - minX * scale;
const artY = (height - (maxY - minY) * scale) / 2 - minY * scale;

function path(stroke, progress) {
  const limit = progress * stroke.total;
  let count = 1;
  while (count < stroke.points.length && stroke.distance[count] <= limit) count++;
  const points = stroke.points.slice(0, count), edges = stroke.edges.slice(0, count);
  if (count < stroke.points.length) {
    const i = count - 1, t = (limit - stroke.distance[i]) / (stroke.distance[count] - stroke.distance[i]);
    points.push(stroke.points[i].map((v, axis) => v + (stroke.points[count][axis] - v) * t));
    edges.push(stroke.edges[i].map((v, axis) => v + (stroke.edges[count][axis] - v) * t));
  }
  const outline = points.map((p, i) => [p[0] + edges[i][0], p[1] + edges[i][1]]);
  outline.push(...points.map((p, i) => [p[0] - edges[i][0], p[1] - edges[i][1]]).reverse());
  return outline.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(3)},${p[1].toFixed(3)}`).join(' ') + ' Z';
}

function frame(time) {
  const art = strokes.filter(s => time > s.start).map(s => {
    const progress = Math.min(1, (time - s.start) / (s.end - s.start));
    return `<path d="${path(s, progress)}" opacity="${s.opacity}" fill="url(#ink)"/>`;
  }).join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><linearGradient id="ink" gradientUnits="userSpaceOnUse" x1="110" x2="1120"><stop stop-color="#eff4f5"/><stop offset=".44" stop-color="#c1dff0"/><stop offset=".73" stop-color="#9fcbee"/><stop offset="1" stop-color="#72ace3"/></linearGradient></defs>
    <rect width="1200" height="630" fill="#070b10"/>
    <g transform="translate(${artX},${artY}) scale(${scale})">${art}</g>
  </svg>`);
}

await sharp(frame(4)).png().toFile(`${output}.png`);
const encoder = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pixel_format', 'rgb24', '-video_size', `${width}x${height}`, '-framerate', String(fps), '-i', 'pipe:0', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${output}.mp4`], { stdio: ['pipe', 'inherit', 'inherit'] });
const finished = once(encoder, 'close');
for (let i = 0; i < 5 * fps; i++) {
  const data = await sharp(frame(i / fps)).removeAlpha().raw().toBuffer();
  if (!encoder.stdin.write(data)) await once(encoder.stdin, 'drain');
}
encoder.stdin.end();
const [code] = await finished;
if (code !== 0) throw new Error(`ffmpeg exited ${code}`);
console.log(`Generated ${output}.{png,mp4}`);
