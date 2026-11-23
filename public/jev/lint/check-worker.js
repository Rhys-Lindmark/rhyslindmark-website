// Runs the pasted decide() off the page, so a slow or looping function can be stopped.
// Everything after Jev's answers is plain computation in check-core.js.
import { check } from './check-core.js?v=check-2';

self.onmessage = e => {
  try { self.postMessage({ report: check(e.data) }); }
  catch (err) { self.postMessage({ error: String(err?.message || err) }); }
};
