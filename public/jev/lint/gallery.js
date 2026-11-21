// Recorded jev-lint results (jev-1.14.0, Nov 21 2026), from takehome/demos/a1-wrong-question/lint.mjs --json.
export const GALLERY = [
 {
  "id": "escalate",
  "title": "“Should this ticket be escalated?”",
  "lesson": "A decision, and it depends on your policy. A smart new hire couldn’t answer it either.",
  "steps": [
   {
    "label": "First draft",
    "q": {
     "type": "noul",
     "instructions": "Should `ticket` be escalated?"
    },
    "j": {
     "decision": 0.98,
     "compound": 0.05,
     "hidden_rules": 0.96,
     "needs_math": 0.17
    },
    "code": []
   },
   {
    "label": "One of four judgments",
    "q": {
     "type": "noul",
     "instructions": "Does `ticket.message` report that our product lost or corrupted the customer's data?",
     "criteria": {
      "true": "Records, edits or files are missing or overwritten because of something our product did.",
      "false": "A forgotten password, or a project the customer deleted themselves."
     }
    },
    "j": {
     "decision": 0.03,
     "compound": 0.65,
     "hidden_rules": 0.25,
     "needs_math": 0.04
    },
    "code": []
   }
  ],
  "code": "if (j.data_loss || j.security_incident) return escalate()\nif (j.prod_outage && plan === 'enterprise') return escalate()\nreturn normalQueue()",
  "aside": "“Lost or corrupted” is one condition said two ways. Jev is unsure (0.65), just under the 0.7 flag. Fine to ship; worth a criteria line."
 },
 {
  "id": "model",
  "title": "“Which model should I use for this prompt?”",
  "lesson": "My own first draft for the Model Router. The routing policy was hidden inside the model.",
  "steps": [
   {
    "label": "First draft",
    "q": {
     "type": "choice",
     "instructions": "Which model should I use for this prompt?",
     "criteria": {
      "Haiku": "Claude Haiku",
      "Sonnet": "Claude Sonnet",
      "Opus": "Claude Opus"
     }
    },
    "j": {
     "decision": 0.98,
     "compound": 0.05,
     "hidden_rules": 0.93,
     "needs_math": 0.05
    },
    "code": []
   },
   {
    "label": "A judgment about the prompt",
    "q": {
     "type": "noul",
     "instructions": "Does answering `prompt` take several steps of careful reasoning?",
     "criteria": {
      "true": "A proof, a multi-step plan, debugging, or weighing trade-offs.",
      "false": "A lookup, a rewrite, a short answer or a quick summary."
     }
    },
    "j": {
     "decision": 0.08,
     "compound": 0.1,
     "hidden_rules": 0.27,
     "needs_math": 0.12
    },
    "code": []
   }
  ],
  "code": "if (j.reasoning >= 0.5 && j.high_stakes >= 0.5) return 'opus'\nif (j.reasoning >= 0.5) return 'sonnet'\nreturn 'haiku'"
 },
 {
  "id": "rude",
  "title": "“Is the guest rude or drunk?”",
  "lesson": "Two conditions in one question. Jev has to guess how you combine them.",
  "steps": [
   {
    "label": "First draft",
    "q": {
     "type": "noul",
     "instructions": "Is the guest rude or drunk?"
    },
    "j": {
     "decision": 0.04,
     "compound": 0.97,
     "hidden_rules": 0.77,
     "needs_math": 0.05
    },
    "code": []
   },
   {
    "label": "Two Nouls…",
    "q": {
     "type": "noul",
     "instructions": "Is the guest rude to staff in `message`?"
    },
    "j": {
     "decision": 0.03,
     "compound": 0.05,
     "hidden_rules": 0.63,
     "needs_math": 0.04
    },
    "code": []
   },
   {
    "label": "…combined in code",
    "q": {
     "type": "noul",
     "instructions": "Does the guest in `message` seem drunk?"
    },
    "j": {
     "decision": 0.03,
     "compound": 0.04,
     "hidden_rules": 0.45,
     "needs_math": 0.05
    },
    "code": []
   }
  ],
  "code": "if (j.rude >= 0.7 || j.drunk >= 0.7) return callManager()"
 },
 {
  "id": "pr",
  "title": "“Should we approve this pull request?”",
  "lesson": "A decision that depends on rules nobody wrote down.",
  "steps": [
   {
    "label": "First draft",
    "q": {
     "type": "noul",
     "instructions": "Should we approve this pull request?"
    },
    "j": {
     "decision": 0.99,
     "compound": 0.05,
     "hidden_rules": 0.94,
     "needs_math": 0.11
    },
    "code": []
   },
   {
    "label": "A rewrite Jev caught",
    "q": {
     "type": "noul",
     "instructions": "Does `diff` change authentication, payments or permissions code?"
    },
    "j": {
     "decision": 0.05,
     "compound": 0.9,
     "hidden_rules": 0.45,
     "needs_math": 0.07
    },
    "code": []
   },
   {
    "label": "One condition",
    "q": {
     "type": "noul",
     "instructions": "Does `diff` change code that checks who is allowed to do what?"
    },
    "j": {
     "decision": 0.06,
     "compound": 0.12,
     "hidden_rules": 0.47,
     "needs_math": 0.07
    },
    "code": []
   }
  ],
  "code": "if (j.changes_access_control >= 0.7) return requireSecurityReview()",
  "aside": "My first rewrite listed “authentication, payments or permissions”. Jev flagged it as compound (0.90). A list of unrelated areas is several questions."
 },
 {
  "id": "lead",
  "title": "“Is this lead high priority?”",
  "lesson": "“Priority” is your sales policy, not something in the message.",
  "steps": [
   {
    "label": "First draft",
    "q": {
     "type": "noul",
     "instructions": "Is this lead high priority?"
    },
    "j": {
     "decision": 0.18,
     "compound": 0.05,
     "hidden_rules": 0.96,
     "needs_math": 0.22
    },
    "code": []
   },
   {
    "label": "A rewrite Jev caught",
    "q": {
     "type": "noul",
     "instructions": "Does `lead.message` mention a budget or a deadline?"
    },
    "j": {
     "decision": 0.03,
     "compound": 0.88,
     "hidden_rules": 0.12,
     "needs_math": 0.09
    },
    "code": []
   },
   {
    "label": "One observable fact",
    "q": {
     "type": "noul",
     "instructions": "Does `lead.message` mention a budget?"
    },
    "j": {
     "decision": 0.03,
     "compound": 0.04,
     "hidden_rules": 0.09,
     "needs_math": 0.08
    },
    "code": []
   }
  ],
  "code": "const priority = j.mentions_budget + j.mentions_deadline + (companySize > 200)\nif (priority >= 2) return routeToAE()",
  "aside": "“A budget or a deadline” is two facts. Ask each, and let code weigh them."
 },
 {
  "id": "refund",
  "title": "“Is the refund amount more than $500?”",
  "lesson": "Comparing numbers is code’s job. Jev isn’t a calculator.",
  "steps": [
   {
    "label": "First draft",
    "q": {
     "type": "noul",
     "instructions": "Is the refund amount in `email` more than $500?"
    },
    "j": {
     "decision": 0.03,
     "compound": 0.05,
     "hidden_rules": 0.12,
     "needs_math": 0.96
    },
    "code": []
   },
   {
    "label": "The judgment",
    "q": {
     "type": "noul",
     "instructions": "Is the sender of `email` asking for money back?"
    },
    "j": {
     "decision": 0.04,
     "compound": 0.05,
     "hidden_rules": 0.17,
     "needs_math": 0.06
    },
    "code": []
   }
  ],
  "code": "if (j.wants_refund >= 0.7 && order.amount > 500) return humanReview()"
 },
 {
  "id": "invoice",
  "title": "“Was the invoice sent more than 30 days ago?”",
  "lesson": "Date math. Read the date from the record; compare it in code.",
  "steps": [
   {
    "label": "First draft",
    "q": {
     "type": "noul",
     "instructions": "Was the invoice sent more than 30 days before today?"
    },
    "j": {
     "decision": 0.03,
     "compound": 0.06,
     "hidden_rules": 0.17,
     "needs_math": 0.98
    },
    "code": []
   }
  ],
  "code": "const overdue = daysSince(invoice.sent_at) > 30   // no Jev call needed"
 },
 {
  "id": "agent",
  "title": "“You are an expert agent… what should the agent do next?”",
  "lesson": "A prompt, not a question. And still a decision.",
  "steps": [
   {
    "label": "First draft",
    "q": {
     "type": "choice",
     "instructions": "You are an expert agent. Consider the conversation carefully. What should the agent do next?",
     "criteria": {
      "search": "Search the web",
      "answer": "Answer the user",
      "ask": "Ask a clarifying question"
     }
    },
    "j": {
     "decision": 0.99,
     "compound": 0.15,
     "hidden_rules": 0.65,
     "needs_math": 0.08
    },
    "code": [
     "Preambles and instructions-to-an-LLM are noise. A question is not a prompt."
    ]
   },
   {
    "label": "Something you can observe",
    "q": {
     "type": "noul",
     "instructions": "Does `conversation` end with a question from the user that hasn't been answered?"
    },
    "j": {
     "decision": 0.04,
     "compound": 0.44,
     "hidden_rules": 0.12,
     "needs_math": 0.06
    },
    "code": []
   }
  ],
  "code": "if (j.unanswered_question >= 0.7) return answer()\nif (j.needs_fresh_facts >= 0.7) return search()"
 },
 {
  "id": "spam",
  "title": "“Classify this message.” (option_1 / option_2)",
  "lesson": "Option names are sent to the model. “option_1” tells it nothing.",
  "steps": [
   {
    "label": "First draft",
    "q": {
     "type": "choice",
     "instructions": "Classify this message.",
     "criteria": {
      "option_1": "spam",
      "option_2": "not spam"
     }
    },
    "j": {
     "decision": 0.56,
     "compound": 0.06,
     "hidden_rules": 0.82,
     "needs_math": 0.05
    },
    "code": [
     "Option names are sent to the model. Positional names like A/B or option_1 give it nothing to go on."
    ]
   },
   {
    "label": "A Noul with concrete criteria",
    "q": {
     "type": "noul",
     "instructions": "Is `message` unsolicited advertising?",
     "criteria": {
      "true": "It promotes a product, service, link or offer the reader didn't ask about.",
      "false": "A personal message, a reply in an ongoing thread, or a requested newsletter."
     }
    },
    "j": {
     "decision": 0.04,
     "compound": 0.08,
     "hidden_rules": 0.44,
     "needs_math": 0.05
    },
    "code": []
   }
  ],
  "code": "if (j.unsolicited_ad >= 0.9) return moveToSpam()"
 },
 {
  "id": "review",
  "title": "“Does the review complain about shipping or price?”",
  "lesson": "Two complaints, two questions. Your dashboard wants them apart anyway.",
  "steps": [
   {
    "label": "First draft",
    "q": {
     "type": "noul",
     "instructions": "Does `review` complain about shipping or price?"
    },
    "j": {
     "decision": 0.03,
     "compound": 0.91,
     "hidden_rules": 0.3,
     "needs_math": 0.06
    },
    "code": []
   },
   {
    "label": "One complaint per Noul",
    "q": {
     "type": "noul",
     "instructions": "Does `review` complain about shipping?"
    },
    "j": {
     "decision": 0.04,
     "compound": 0.06,
     "hidden_rules": 0.54,
     "needs_math": 0.07
    },
    "code": []
   }
  ],
  "code": "tags = ['shipping','price'].filter(k => j[k] >= 0.7)"
 },
 {
  "id": "clean",
  "title": "Clean questions",
  "lesson": "What good looks like: one observable thing, answerable at a glance.",
  "steps": [
   {
    "label": "With criteria",
    "q": {
     "type": "noul",
     "instructions": "Does `ticket.message` report that our product lost or corrupted the customer's data?",
     "criteria": {
      "true": "Records, edits or files are missing or overwritten because of something our product did.",
      "false": "A forgotten password, or a project the customer deleted themselves."
     }
    },
    "j": {
     "decision": 0.03,
     "compound": 0.65,
     "hidden_rules": 0.25,
     "needs_math": 0.04
    },
    "code": []
   },
   {
    "label": "Short is fine",
    "q": {
     "type": "noul",
     "instructions": "Does the customer sound frustrated?"
    },
    "j": {
     "decision": 0.03,
     "compound": 0.04,
     "hidden_rules": 0.21,
     "needs_math": 0.04
    },
    "code": []
   }
  ]
 }
];
