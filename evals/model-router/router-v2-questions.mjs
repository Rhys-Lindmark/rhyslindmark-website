// New judgments for Router v2/v3, written from what v1 showed: failures came
// from exact, letter-level work (lipograms, word counts, letter counts, long
// date counts), which none of the original five questions captured. Each is
// one judgment a person could make at a glance; decisions stay in code.
export function routerV2Questions() {
  return {
    exact_details: { type: 'noul', instructions: 'Does a correct answer to `prompt` depend on getting exact letters, words or digits right?', criteria: {
      true: 'One miscounted or misplaced letter, word or digit makes the answer wrong: counting letters, writing exactly N words, avoiding a letter, or multiplying large numbers exactly.',
      false: 'Small slips in wording would not make the answer wrong: explaining a concept, chatting, recalling a fact, or writing ordinary prose.'
    } },
    quick_recall: { type: 'noul', instructions: 'Can `prompt` be answered by recalling one well-known fact or doing one simple step?', criteria: {
      true: 'A capital city, a chemical symbol, a definition, a single small calculation or a greeting.',
      false: 'The answer needs several steps of reasoning, a piece of writing, or code.'
    } },
    writes_code: { type: 'noul', instructions: 'Does `prompt` ask for code to be written?', criteria: {
      true: 'The user wants a function, script, class or program.',
      false: 'The user wants an answer, an explanation or prose, not code.'
    } },
    long_procedure: { type: 'noul', instructions: 'Does answering `prompt` require carrying out a long procedure step by step, such as checking many cases or tracking many items?', criteria: {
      true: 'The answer comes from many repeated steps: counting dates across decades, checking every number in a large range, or tracking several people’s statements.',
      false: 'The answer takes a few steps at most.'
    } }
  };
}
export const V2_NOULS = Object.keys(routerV2Questions());
