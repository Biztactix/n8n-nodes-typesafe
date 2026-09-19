// Calls the API directly with the same wire format the node builds, so the shapes in questions.ts
// can be checked without an n8n instance. Needs TYPESAFE_API_KEY in the environment. Never prints the key.
const key = process.env.TYPESAFE_API_KEY;
if (!key) { console.error('TYPESAFE_API_KEY is not set'); process.exit(1); }
const baseUrl = (process.env.TYPESAFE_BASE_URL ?? 'https://api.typesafe.ai').replace(/\/$/, '');

const body = {
  model: process.env.TYPESAFE_DEFAULT_MODEL ?? 'jev-latest', // required by the API
  state: 'Subject: Invoice 4471 charged twice\n\nHi, my card shows two $49 charges this month for one licence. Please refund the duplicate today.',
  questions: {
    category: { type: 'choice', instructions: 'Which team should handle this email?', criteria: { billing: 'invoices, payments, refunds', support: 'technical problems', sales: null, spam: null } },
    urgency: { type: 'score', instructions: 'How urgent is this email?', criteria: ['can wait a week', 'this week', 'today', 'right now'] },
    needsReply: { type: 'noul', instructions: 'Does this email need a human reply?', criteria: { true: 'A person must respond.', false: 'No response needed.' } },
  },
};

const res = await fetch(`${baseUrl}/v1/systemone`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify(body),
});
console.log(`HTTP ${res.status}  request-id: ${res.headers.get('x-typesafe-request-id') ?? '(none)'}`);
console.log(JSON.stringify(await res.json(), null, 2));
process.exit(res.ok ? 0 : 1);
