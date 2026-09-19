import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { IDataObject } from 'n8n-workflow';

import { flattenAnswers } from '../nodes/TypeSafe/questions';

// These tests pin the behaviour of flattenAnswers against the response shape in
// docs/DESIGN.md ("Wire format"). Where the behaviour is a deliberate choice it
// is marked with a BEHAVIOUR NOTE.

/**
 * The three-answer response body from docs/DESIGN.md, verbatim. A factory, not a shared constant:
 * the non-mutation tests below would pass vacuously against an object an earlier test had already
 * mutated, so every test gets its own.
 */
function designDocAnswers(): Record<string, IDataObject> {
	return {
		needsReply: { type: 'noul', noul: 0.99 },
		category: {
			type: 'choice',
			choice: 'billing',
			confidence: 1.0,
			probabilities: { billing: 1.0, support: 0.0 },
		},
		urgency: {
			type: 'score',
			score: 1.38,
			confidence: 0.43,
			legend: { '0': 'can wait', '1': 'today' },
			probabilities: { '0': 0.0, '1': 0.62, '2': 0.38 },
		},
	};
}

describe('flattenAnswers', () => {
	it('returns an empty object for an empty answers object', () => {
		assert.deepStrictEqual(flattenAnswers({}), {});
	});

	describe('noul', () => {
		it('flattens a noul answer to its probability', () => {
			assert.deepStrictEqual(flattenAnswers({ needsReply: { type: 'noul', noul: 0.99 } }), {
				needsReply: 0.99,
			});
		});

		it('keeps a zero probability rather than dropping it', () => {
			assert.deepStrictEqual(flattenAnswers({ needsReply: { type: 'noul', noul: 0 } }), {
				needsReply: 0,
			});
		});

		it('drops the other fields of a noul answer', () => {
			assert.deepStrictEqual(
				flattenAnswers({ needsReply: { type: 'noul', noul: 0.42, confidence: 0.8, extra: 'ignored' } }),
				{ needsReply: 0.42 },
			);
		});

		// BEHAVIOUR NOTE: null, not undefined — n8n serialises items to JSON, and
		// an undefined value would drop the key from the output altogether.
		it('yields null when a noul answer has no noul field', () => {
			const results = flattenAnswers({ needsReply: { type: 'noul' } });

			assert.deepStrictEqual(results, { needsReply: null });
			assert.strictEqual(JSON.parse(JSON.stringify(results)).needsReply, null);
		});
	});

	describe('choice', () => {
		it('flattens a choice answer to its label', () => {
			assert.deepStrictEqual(
				flattenAnswers({
					category: { type: 'choice', choice: 'billing', confidence: 1.0, probabilities: { billing: 1.0 } },
				}),
				{ category: 'billing' },
			);
		});

		it('keeps an empty-string label', () => {
			assert.deepStrictEqual(flattenAnswers({ category: { type: 'choice', choice: '' } }), { category: '' });
		});

		it('yields null when a choice answer has no choice field', () => {
			const results = flattenAnswers({ category: { type: 'choice', confidence: 1.0 } });

			assert.deepStrictEqual(results, { category: null });
			assert.strictEqual(JSON.parse(JSON.stringify(results)).category, null);
		});
	});

	describe('score', () => {
		it('flattens a score answer to its number', () => {
			assert.deepStrictEqual(
				flattenAnswers({
					urgency: { type: 'score', score: 1.38, confidence: 0.43, legend: { '0': 'can wait' } },
				}),
				{ urgency: 1.38 },
			);
		});

		it('keeps a zero score rather than dropping it', () => {
			assert.deepStrictEqual(flattenAnswers({ urgency: { type: 'score', score: 0 } }), { urgency: 0 });
		});

		it('yields null when a score answer has no score field', () => {
			const results = flattenAnswers({ urgency: { type: 'score' } });

			assert.deepStrictEqual(results, { urgency: null });
			assert.strictEqual(JSON.parse(JSON.stringify(results)).urgency, null);
		});

		it('keeps a null value in the JSON n8n would serialise for a whole response', () => {
			const results = flattenAnswers({
				needsReply: { type: 'noul' },
				category: { type: 'choice', choice: 'billing' },
			});

			assert.deepStrictEqual(JSON.parse(JSON.stringify(results)), { needsReply: null, category: 'billing' });
		});
	});

	describe('unknown and untyped answers', () => {
		it('passes an answer of an unknown type through whole', () => {
			assert.deepStrictEqual(
				flattenAnswers({
					sentiment: { type: 'sentiment', sentiment: 'positive', confidence: 0.77 },
				}),
				{ sentiment: { type: 'sentiment', sentiment: 'positive', confidence: 0.77 } },
			);
		});

		it('passes an answer with no type through whole', () => {
			assert.deepStrictEqual(flattenAnswers({ mystery: { value: 3, note: 'no type here' } }), {
				mystery: { value: 3, note: 'no type here' },
			});
		});

		it('passes an empty answer object through whole', () => {
			assert.deepStrictEqual(flattenAnswers({ mystery: {} }), { mystery: {} });
		});

		// BEHAVIOUR NOTE (finding): a passed-through answer is the SAME object, not
		// a copy, so the flattened results share structure with `typesafe.answers`
		// in the node's output.
		it('passes the same object reference through, not a copy', () => {
			const answers: Record<string, IDataObject> = { sentiment: { type: 'sentiment', sentiment: 'positive' } };

			const results = flattenAnswers(answers);

			assert.strictEqual(results.sentiment, answers.sentiment);
		});

		// BEHAVIOUR NOTE: the type is matched with ===, so a non-string type such
		// as a number is never a known type and falls through whole.
		it('passes an answer with a non-string type through whole', () => {
			assert.deepStrictEqual(flattenAnswers({ odd: { type: 1, noul: 0.5 } }), { odd: { type: 1, noul: 0.5 } });
		});
	});

	describe('the docs/DESIGN.md response', () => {
		it('flattens all three answers of the documented response', () => {
			assert.deepStrictEqual(flattenAnswers(designDocAnswers()), {
				needsReply: 0.99,
				category: 'billing',
				urgency: 1.38,
			});
		});

		it('keeps the answer order of the response', () => {
			assert.deepStrictEqual(Object.keys(flattenAnswers(designDocAnswers())), [
				'needsReply',
				'category',
				'urgency',
			]);
		});

		it('does not mutate the answers it is given', () => {
			const answers: Record<string, IDataObject> = designDocAnswers();
			const before = structuredClone(answers);

			flattenAnswers(answers);

			assert.deepStrictEqual(answers, before);
		});

		it('does not mutate an answers object holding an unknown type', () => {
			const answers: Record<string, IDataObject> = {
				needsReply: { type: 'noul', noul: 0.99 },
				sentiment: { type: 'sentiment', sentiment: 'positive' },
			};
			const before = structuredClone(answers);

			flattenAnswers(answers);

			assert.deepStrictEqual(answers, before);
		});
	});

	it('flattens a mixed response of known and unknown answer types', () => {
		assert.deepStrictEqual(
			flattenAnswers({
				needsReply: { type: 'noul', noul: 0.99 },
				category: { type: 'choice', choice: 'billing' },
				urgency: { type: 'score', score: 1.38 },
				sentiment: { type: 'sentiment', sentiment: 'positive' },
				mystery: { value: 3 },
			}),
			{
				needsReply: 0.99,
				category: 'billing',
				urgency: 1.38,
				sentiment: { type: 'sentiment', sentiment: 'positive' },
				mystery: { value: 3 },
			},
		);
	});
});
