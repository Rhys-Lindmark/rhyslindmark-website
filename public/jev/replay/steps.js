// Recorded output of the A1 demo (takehome/demos/a1-wrong-question, jev-1.14.0, answers replayed from the recorded cache).
export const STEPS = [
 {
  "cmd": "node run.mjs",
  "say": "Three ways to ask the same 40 tickets.",
  "out": "\u001b[1m\n  Same 40 tickets, same model, three ways to ask\n\u001b[0m\n  1. \"Should this be escalated?\"          73%   11 false alarms    0 missed\n  2. ...plus the policy pasted in        100%    0 false alarms    0 missed\n  3. Four judgments + policy in code     100%    0 false alarms    0 missed\n\u001b[2m\n  Each judgment on its own:\u001b[0m data_loss 100% · security_incident 100% · prod_outage 98% · cancel_threat 98%\n\u001b[1m\n  Where \"Should this be escalated?\" goes wrong:\u001b[0m\n  #2   v1=0.61  truth=normal    I lost my password and the reset email never arrives.…\n  #3   v1=0.70  truth=normal    Do you have a SOC 2 report? Our security team is asking before we rene…\n  #5   v1=0.89  truth=normal    Production webhook deliveries are failing since 9am and our order sync…\n  #17  v1=0.58  truth=normal    Still waiting on a reply about the invoice. It's been almost a week.…\n  #19  v1=0.91  truth=normal    The login page has returned 500 for our team for the last 10 minutes. …\n\u001b[2m\n  40 requests, 0 input tokens, $0.0000, ~105 ms per request (40 replayed from cache)\n\u001b[0m\n"
 },
 {
  "cmd": "node run.mjs explain 19",
  "say": "Why ticket #19 isn't escalated: Jev saw the outage; the policy in code says pro-plan outages don't escalate.",
  "out": "\n#19 [pro, waiting 0d] The login page has returned 500 for our team for the last 10 minutes. We're blocked.\n\n  data_loss          0.02  \u001b[2mno\u001b[0m\n  security_incident  0.03  \u001b[2mno\u001b[0m\n  prod_outage        0.94  \u001b[32myes\u001b[0m\n  cancel_threat      0.03  \u001b[2mno\u001b[0m\n  plan = pro, days_waiting = 0   (code knows these; no need to ask)\n\n  policy() -> normal queue  (no rule fired)   truth: normal\n  v1 \"Should this be escalated?\" said 0.91; v2 policy-in-prompt said 0.04\n\n"
 },
 {
  "cmd": "node policy-change.mjs",
  "say": "Next quarter the policy changes. Same judgments, new function, zero new API calls.",
  "out": "\n  New policy (5 rules, per-plan waits), 18 of 40 should escalate\n  policy pasted into the question   38/40   (new prompt, new API calls)\n  same judgments, new policy() code 40/40   (0 new API calls)\n   #11 [free, 0d] pasted=0.50 truth=false  I accidentally deleted a project myself. Is there a trash fo…\n   #33 [pro, 3d] pasted=0.65 truth=false  The mobile app crashes when I open settings. Annoying, but I…\n\n  80 requests, 0 input tokens, $0.0000 (80 replayed from cache)\n\n"
 }
];
