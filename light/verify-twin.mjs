/* ==========================================================================
   verify-twin.mjs — the twin's corpus, checked without a browser.

   The brain is pure data plus a scorer, so it can be tested as data. Every
   case below is a question a real visitor would type, and the failure mode
   this guards against is an intent stealing another intent's question: the
   scorer once answered "tell me about the pulsar work at ncra" with the
   biography, because the opener "tell me about" was longer than "pulsar".

       node light/verify-twin.mjs
   ========================================================================== */
import { LocalBrain, CORPUS, CORPUS_FALLBACK, FAIRY } from './twin.js';

const CASES = [
  ['who is this?', 'traveller you'],
  ['who am i playing as', 'traveller you'],
  ['who are you', 'digital twin'],
  ['tell me about saptarshi', 'AI/ML engineer'],
  ['what figures is he proudest of', '97.93'],
  ['what numbers is he proud of', '97.93'],
  ['where did he study', 'Academy of Technology'],
  ['what is he doing now at c-dac', '97.93'],
  ['tell me about the pulsar work at ncra', '99.8'],
  ['the f1 tyre project', '4.1x'],
  ['what about omniscience', '50 ms'],
  ['how do i contact him', 'saptarshinag18@gmail.com'],
  ['any publications', 'IoTaIS 2025'],
  ['how did you make this island', 'procedural'],
  ['what is his favourite colour', CORPUS_FALLBACK.slice(0, 24)],
];

let bad = 0;
const ok = (cond, msg, extra) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + msg + (cond || !extra ? '' : '\n          ' + extra));
  if (!cond) bad++;
};

for (const [q, want] of CASES) {
  const a = await LocalBrain.answer(q);
  ok(a.includes(want), JSON.stringify(q), 'got: ' + a.slice(0, 120));
}

/* The house rules, enforced rather than trusted. */
const answers = CORPUS.map((c) => c.a).join(' ') + ' ' + FAIRY.wake + ' ' + FAIRY.greeting;

// the phone number lives on the CV PDF and nowhere on this site
ok(!/\+?\d[\d\s\-]{9,}/.test(answers.replace(/\b(19|20)\d\d\b/g, '')),
   'no phone number anywhere in the twin');

// every headline metric names the project it came from
for (const [metric, source] of [['97.93', 'C-DAC'], ['99.8', 'NCRA'], ['4.1x', 'CUDA'], ['50%', 'GMRT']]) {
  const carriers = CORPUS.filter((c) => c.a.includes(metric));
  ok(carriers.length > 0 && carriers.every((c) => c.a.includes(source)),
     `${metric} always names its source (${source})`);
}

// nothing corrected earlier in the project may creep back
ok(!answers.includes('96.97'), 'the superseded 96.97 figure is gone');

console.log(bad ? `\n${bad} FAILED` : '\nall twin checks pass');
process.exit(bad ? 1 : 0);
