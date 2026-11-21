// Checks every grader without calling any model: a known-good reply must pass
// and a known-bad reply must fail. Run: node evals/model-router/selftest.mjs
import { TASKS } from './tasks.mjs';
import { grade } from './graders.mjs';

const py = s => '```python\n' + s.trim() + '\n```';
const GOOD_CODE = {
  'code-01': `import re\ndef is_palindrome(s):\n    t = re.sub(r'[^a-z0-9]', '', s.lower())\n    return t == t[::-1]`,
  'code-02': `def add(a, b):\n    return a + b`,
  'code-03': `def fizzbuzz(n):\n    return ['FizzBuzz' if i%15==0 else 'Fizz' if i%3==0 else 'Buzz' if i%5==0 else str(i) for i in range(1,n+1)]`,
  'code-04': `def to_roman(n):\n    vals=[(1000,'M'),(900,'CM'),(500,'D'),(400,'CD'),(100,'C'),(90,'XC'),(50,'L'),(40,'XL'),(10,'X'),(9,'IX'),(5,'V'),(4,'IV'),(1,'I')]\n    out=''\n    for v,s in vals:\n        while n>=v:\n            out+=s; n-=v\n    return out`,
  'code-05': `def merge_intervals(iv):\n    out=[]\n    for s,e in sorted(iv):\n        if out and s<=out[-1][1]:\n            out[-1][1]=max(out[-1][1],e)\n        else:\n            out.append([s,e])\n    return out`,
  'code-06': `import re\nfrom collections import Counter\ndef top_k_words(text,k):\n    c=Counter(re.findall(r'[a-z]+', text.lower()))\n    return [w for w,_ in sorted(c.items(), key=lambda x:(-x[1],x[0]))[:k]]`,
  'code-07': `def longest_palindrome(s):\n    best=''\n    for i in range(len(s)):\n        for j in range(i,len(s)):\n            t=s[i:j+1]\n            if t==t[::-1] and len(t)>len(best):\n                best=t\n    return best`,
  'code-08': `def osa_distance(a,b):\n    d=[[0]*(len(b)+1) for _ in range(len(a)+1)]\n    for i in range(len(a)+1): d[i][0]=i\n    for j in range(len(b)+1): d[0][j]=j\n    for i in range(1,len(a)+1):\n        for j in range(1,len(b)+1):\n            c=0 if a[i-1]==b[j-1] else 1\n            d[i][j]=min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+c)\n            if i>1 and j>1 and a[i-1]==b[j-2] and a[i-2]==b[j-1]:\n                d[i][j]=min(d[i][j],d[i-2][j-2]+1)\n    return d[len(a)][len(b)]`,
  'code-09': `def evaluate(expr):\n    toks=[]; i=0\n    while i<len(expr):\n        ch=expr[i]\n        if ch.isspace(): i+=1; continue\n        if ch.isdigit():\n            j=i\n            while j<len(expr) and expr[j].isdigit(): j+=1\n            toks.append(int(expr[i:j])); i=j; continue\n        toks.append(ch); i+=1\n    pos=[0]\n    def peek(): return toks[pos[0]] if pos[0]<len(toks) else None\n    def take(): t=toks[pos[0]]; pos[0]+=1; return t\n    def expr_():\n        v=term()\n        while peek() in ('+','-'):\n            v = v+term() if take()=='+' else v-term()\n        return v\n    def term():\n        v=factor()\n        while peek() in ('*','/'):\n            v = v*factor() if take()=='*' else v/factor()\n        return v\n    def factor():\n        t=take()\n        if t=='-': return -factor()\n        if t=='(':\n            v=expr_(); take(); return v\n        return float(t)\n    return expr_()`,
  'code-10': `import heapq\ndef topo_order(n,edges):\n    indeg=[0]*n; adj=[[] for _ in range(n)]\n    for u,v in edges: adj[u].append(v); indeg[v]+=1\n    h=[i for i in range(n) if indeg[i]==0]; heapq.heapify(h); out=[]\n    while h:\n        u=heapq.heappop(h); out.append(u)\n        for v in adj[u]:\n            indeg[v]-=1\n            if indeg[v]==0: heapq.heappush(h,v)\n    return out if len(out)==n else None`,
  'code-11': `from functools import lru_cache\ndef is_match(s,p):\n    @lru_cache(None)\n    def m(i,j):\n        if j==len(p): return i==len(s)\n        first = i<len(s) and p[j] in (s[i],'.')\n        if j+1<len(p) and p[j+1]=='*':\n            return m(i,j+2) or (first and m(i+1,j))\n        return first and m(i+1,j+1)\n    return m(0,0)`,
  'code-12': `from collections import OrderedDict\nclass LRUCache:\n    def __init__(self,capacity):\n        self.c=capacity; self.d=OrderedDict()\n    def get(self,k):\n        if k not in self.d: return -1\n        self.d.move_to_end(k); return self.d[k]\n    def put(self,k,v):\n        self.d[k]=v; self.d.move_to_end(k)\n        if len(self.d)>self.c: self.d.popitem(last=False)`
};
const GOOD_WRITING = {
  'write-01': 'The ocean holds secrets older than every mountain on earth.',
  'write-02': 'Apple\nBanana\nCherry\nGrape\nMango',
  'write-03': 'The alarm rings and I reach for coffee\nThe bus is late so I sip my coffee\nThe meeting starts and I need more coffee',
  'write-04': 'Rolling past the willows\nInto the valley deep\nVast and cold and patient\nEvery stone it touches\nRests a little smoother',
  'write-05': 'Seven silly sailors sang softly so sleepy seals sat still, sometimes sighing sweetly since summer sunsets seemed special.',
  'write-06': 'Hot days stay long. Kids run to cool pools, shouting with joy. A soft wind blows across farms of corn and grass. Picnics bring fruit, chips and cold drinks. At dusk, warm light glows on lawns as birds sing and frogs croak. Our town is calm, slow and bright, full of laughing kids.',
  'write-07': 'Will humans ever walk on Mars? How long would the trip take? What would astronauts eat on the way? Could we build a home there?',
  'write-08': 'I am the best table tennis players anywhere.',
  'write-09': 'Light spills over the cold sea tonight\nIn the tower a keeper waits alone\nGulls circle high above the rocky shore\nHis lamp turns slowly through misty air\nThe ships below follow its steady glow\nHarbor bells ring out across the water\nOld boards creak beneath his heavy boots\nUntil the dawn he guards the passage\nSalt and wind have shaped his face\nEvery night he lights the way home',
  'write-10': 'Bright signs glow on roofs. Motors hum, cyclists roll by, folks stroll to bistros. Light spills from tiny shops. Old songs drift from rooftop clubs. Buskins thump. Dogs howl, but most folks sit outdoors, sipping drinks, looking up to stormy clouds. Sky glows pink; city lights blink, buzzing; night owls stroll, joking, until morning.',
  'write-11': 'Sam made eleven new words slowly.',
  'write-12': 'Morning light spilled across the quiet harbor while fishermen untangled heavy nets. Gulls circled above, crying loudly for scraps. A small boy watched from wooden steps, clutching bread his grandmother baked before dawn. Somewhere distant, church bells rang. Salt air carried laughter, engine noise, and promises of warmer weather tomorrow.'
};

let failures = 0;
for (const t of TASKS) {
  let good, bad;
  if (t.grader.type === 'answer') { good = `Working...\nANSWER: ${t.grader.answer}`; bad = 'Working...\nANSWER: 31337'; }
  else if (t.grader.type === 'python') { good = 'Here you go:\n' + py(GOOD_CODE[t.id]); bad = py('def nothing():\n    return None'); }
  else { good = GOOD_WRITING[t.id]; bad = 'Sorry, I cannot do that.'; }
  const g = grade(t, good), b = grade(t, bad);
  if (!g.pass || b.pass) { failures++; console.log(`FAIL ${t.id}: good=${g.pass} (${g.detail}) bad=${b.pass} (${b.detail})`); }
}
console.log(failures ? `${failures} grader problems` : `all ${TASKS.length} graders pass good replies and reject bad ones`);
console.log(TASKS.filter(t => t.grader.type === 'answer').map(t => `${t.id}=${t.grader.answer}`).join('  '));
process.exit(failures ? 1 : 0);
