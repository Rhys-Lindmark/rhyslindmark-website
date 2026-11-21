// EVAL_SET picks the prompt set and its results folder: v1 (60 prompts, results/) or v2 (results-v2/).
export const EVAL_SET = process.env.EVAL_SET || 'v1';
export const TASKS = EVAL_SET === 'v2' ? (await import('./tasks-v2-final.mjs').catch(() => import('./tasks-v2.mjs'))).TASKS_OR_POOL : (await import('./tasks.mjs')).TASKS;
export const RESULTS = new URL(EVAL_SET === 'v2' ? './results-v2/' : './results/', import.meta.url);
