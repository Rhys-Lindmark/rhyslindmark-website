// The racers and how a move request is built, with no Node or browser APIs, so the local
// server (players.mjs), the browser and the /jev/races/move Pages function all build the
// exact same requests. The same request means the same recording key, so a race recorded on
// one replays on the others.

export const JEV_MODEL = 'jev-1.14.0';            // pinned, like the rest of takehome/
export const JEV_PRICE_PER_MTOK = 0.042;          // input only; output is free (docs.typesafe.ai/go/models)

// The LLM lanes. DeepSeek v4.1 Flash is the cheap open-weight pick used across Rhys's
// projects (picked 2026-11-22; reads images, so it can play GeoGuesser). Claude Sonnet 5.5 is
// the frontier comparison the demo is about, so it's a deliberate exception to "cheap model by
// default": the whole point is to show Jev's time and cost next to a frontier model.
export const LANES = {
  jev:      { label: 'Jev 1.14',             kind: 'jev',  price: '$0.042 / M in' },
  // params: reasoning off where the model allows it, so each move is one quick reply.
  // Sonnet 5.5 on OpenRouter requires reasoning, so it gets the lowest effort (and no
  // temperature, which thinking doesn't accept).
  deepseek: { label: 'DeepSeek v4.1 Flash',  kind: 'llm',  model: 'deepseek/deepseek-v4.1-flash-1017', price: '$0.03 / $0.20 per M',
              params: { max_tokens: 400, temperature: 0, reasoning: { enabled: false } } },
  sonnet:   { label: 'Claude Sonnet 5.5',    kind: 'llm',  model: 'anthropic/claude-sonnet-5.5',       price: '$2 / $10 per M',
              params: { max_tokens: 3000, reasoning: { effort: 'low' } } },
};

export const JEV_URL = 'https://api.typesafe.ai/v1/systemone';
export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const SYSTEM = 'You are racing in a game. Each turn you see the game state and a numbered list of legal moves. Reply with the number of your move and nothing else.';

// A turn's default Jev request: one Choice over the legal moves. A game can supply its own
// questions plus a decide() that turns the answers into a move (20 Questions does).
export function jevQuestions(turn) {
  if (turn.jev) return turn.jev;
  return {
    state: turn.state,
    questions: { move: { type: 'choice', instructions: turn.question, criteria: Object.fromEntries(turn.options.map(o => [o.name, o.about ?? null])) } },
    decide: a => ({ move: a.move.choice, probs: a.move.probabilities }),
  };
}

export function llmText(turn) {
  return [JSON.stringify(turn.state, null, 1), '', turn.question, '', ...turn.options.map((o, i) => `${i + 1}. ${o.name}${o.about ? ` (${o.about})` : ''}`)].join('\n');
}

// The request for one move, minus the image bytes (the caller attaches them with
// withImage), plus the key its recording is filed under.
export function moveRequest(laneId, turn) {
  const lane = LANES[laneId];
  if (lane.kind === 'jev') {
    const { state, questions } = jevQuestions(turn);
    const body = { model: JEV_MODEL, state, questions };
    return { url: JEV_URL, body, key: { ...body, assets: turn.image ? turn.image.path : undefined } };
  }
  const text = llmText(turn);
  const body = { model: lane.model, ...lane.params, usage: { include: true }, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: text }] };
  return { url: OPENROUTER_URL, body, key: { ...body, messages: [SYSTEM, text, turn.image?.path] } };
}

// Attach the photo (base64 JPEG) to a request built by moveRequest. Returns extra headers.
export function withImage(laneId, turn, body, b64) {
  if (!turn.image) return {};
  if (LANES[laneId].kind === 'jev') {
    body.assets = { [turn.image.ref]: { type: 'image', format: 'jpg', data_base64: b64 } }; // the state names it by its ref
    return { 'TypeSafe-Danger-Zone-Images': 'true' };
  }
  body.messages[1].content = [{ type: 'text', text: body.messages[1].content }, { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } }];
  return {};
}

// What a recording keeps from an API response.
export const keep = (laneId, data, ms) => LANES[laneId].kind === 'jev'
  ? { answers: data.answers, input_tokens: data.usage?.input_tokens ?? 0, ms }
  : { reply: data.choices?.[0]?.message?.content ?? '', cost: data.usage?.cost ?? 0, ms };

const top = (p, n = 3) => p && Object.entries(p).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => [k, +v.toFixed(3)]);

// A recorded (or fresh) response -> the move.
export function readMove(laneId, turn, out) {
  if (LANES[laneId].kind === 'jev') {
    const d = jevQuestions(turn).decide(out.answers);
    return { move: d.move, why: d.why, probs: top(d.probs), ms: out.ms, cost: out.input_tokens * JEV_PRICE_PER_MTOK / 1e6, replayed: !!out.replayed };
  }
  const n = parseInt((out.reply.match(/\d+/g) || []).pop(), 10); // the last number: a model that explains itself ends on its move
  const opt = turn.options[n - 1];
  return { move: opt?.name ?? null, why: opt ? undefined : `couldn't read a move from "${out.reply.slice(0, 60)}"`, ms: out.ms, cost: out.cost, replayed: !!out.replayed };
}

export async function recordingName(key) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(key)));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 24) + '.json';
}
