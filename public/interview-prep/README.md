# Interview Prep
20-minute conversational interviews at `/interview-prep`.

Six ordered sections: Background (2m), Current work (3m), Results & evidence (4m), Judgment & learning (4m), Direction & trade-offs (4m), Closing (3m).

Static UI with no new dependencies. Public URL extraction and Workers AI generation: `functions/interview-prep/api/plan.js`; bounded extraction: `functions/_lib/interview-source.js`. Uses the website's existing AI binding. AI failures return a clearly labeled curated plan. Context is not persisted on the server; drafts and notes use browser localStorage. Questions are escaped before HTML insertion.

Sources and adapted methods are linked in the UI. Practice advances manually, records notes, and uses wall-clock elapsed time. Copy/export includes all notes and sources.
