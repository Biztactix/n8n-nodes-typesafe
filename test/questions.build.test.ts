import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { buildQuestions, type QuestionsCollection } from '../nodes/TypeSafe/questions';

// These tests pin the behaviour of buildQuestions against the wire format in
// docs/DESIGN.md. Where the behaviour is a deliberate choice rather than an
// obvious consequence of the format it is marked with a BEHAVIOUR NOTE.

describe('buildQuestions', () => {
	it('returns an empty object for an empty collection', () => {
		assert.deepStrictEqual(buildQuestions({}), {});
	});

	it('returns an empty object for an empty collection and an empty raw overlay', () => {
		assert.deepStrictEqual(buildQuestions({}, {}), {});
	});

	describe('noul', () => {
		it('omits the criteria key entirely when neither side is given', () => {
			assert.deepStrictEqual(
				buildQuestions({ noul: [{ name: 'needsReply', instructions: 'Does this need a human reply?' }] }),
				{ needsReply: { type: 'noul', instructions: 'Does this need a human reply?' } },
			);
		});

		it('omits the criteria key when both sides are empty strings', () => {
			const questions = buildQuestions({
				noul: [{ name: 'needsReply', instructions: 'Reply?', whenTrue: '', whenFalse: '' }],
			});

			assert.deepStrictEqual(questions, { needsReply: { type: 'noul', instructions: 'Reply?' } });
			assert.ok(!('criteria' in questions.needsReply));
		});

		it('includes only the true side when only whenTrue is given', () => {
			assert.deepStrictEqual(
				buildQuestions({ noul: [{ name: 'needsReply', instructions: 'Reply?', whenTrue: 'a question is asked' }] }),
				{
					needsReply: {
						type: 'noul',
						instructions: 'Reply?',
						criteria: { true: 'a question is asked' },
					},
				},
			);
		});

		it('includes only the false side when only whenFalse is given', () => {
			assert.deepStrictEqual(
				buildQuestions({ noul: [{ name: 'needsReply', instructions: 'Reply?', whenFalse: 'a newsletter' }] }),
				{
					needsReply: {
						type: 'noul',
						instructions: 'Reply?',
						criteria: { false: 'a newsletter' },
					},
				},
			);
		});

		it('includes both sides when both are given', () => {
			assert.deepStrictEqual(
				buildQuestions({
					noul: [
						{
							name: 'needsReply',
							instructions: 'Reply?',
							whenTrue: 'a question is asked',
							whenFalse: 'a newsletter',
						},
					],
				}),
				{
					needsReply: {
						type: 'noul',
						instructions: 'Reply?',
						criteria: { true: 'a question is asked', false: 'a newsletter' },
					},
				},
			);
		});

		it('trims criteria text and omits a whitespace-only side', () => {
			assert.deepStrictEqual(
				buildQuestions({ noul: [{ name: 'needsReply', instructions: 'Reply?', whenTrue: '  a question  ', whenFalse: '   ' }] }),
				{
					needsReply: {
						type: 'noul',
						instructions: 'Reply?',
						criteria: { true: 'a question' },
					},
				},
			);
		});

		it('omits the criteria key when both sides are whitespace only', () => {
			const questions = buildQuestions({
				noul: [{ name: 'needsReply', instructions: 'Reply?', whenTrue: ' ', whenFalse: '\t\n' }],
			});

			assert.deepStrictEqual(questions, { needsReply: { type: 'noul', instructions: 'Reply?' } });
			assert.ok(!('criteria' in questions.needsReply));
		});

		it('builds several noul questions in one call', () => {
			assert.deepStrictEqual(
				buildQuestions({
					noul: [
						{ name: 'needsReply', instructions: 'Reply?' },
						{ name: 'isSpam', instructions: 'Spam?', whenTrue: 'unsolicited' },
					],
				}),
				{
					needsReply: { type: 'noul', instructions: 'Reply?' },
					isSpam: { type: 'noul', instructions: 'Spam?', criteria: { true: 'unsolicited' } },
				},
			);
		});
	});

	describe('choice', () => {
		it('splits labels by newline', () => {
			assert.deepStrictEqual(
				buildQuestions({
					choice: [{ name: 'category', instructions: 'Which team?', labels: 'billing\nsupport\nsales' }],
				}),
				{
					category: {
						type: 'choice',
						instructions: 'Which team?',
						criteria: { billing: null, support: null, sales: null },
					},
				},
			);
		});

		it('splits labels by comma', () => {
			assert.deepStrictEqual(
				buildQuestions({
					choice: [{ name: 'category', instructions: 'Which team?', labels: 'billing, support, sales' }],
				}),
				{
					category: {
						type: 'choice',
						instructions: 'Which team?',
						criteria: { billing: null, support: null, sales: null },
					},
				},
			);
		});

		it('splits labels by CRLF newlines', () => {
			assert.deepStrictEqual(
				buildQuestions({
					choice: [{ name: 'category', instructions: 'Which team?', labels: 'billing\r\nsupport' }],
				}),
				{
					category: { type: 'choice', instructions: 'Which team?', criteria: { billing: null, support: null } },
				},
			);
		});

		it('parses "label = description"', () => {
			assert.deepStrictEqual(
				buildQuestions({
					choice: [
						{
							name: 'category',
							instructions: 'Which team?',
							labels: 'billing = invoices and refunds\nsupport = technical problems',
						},
					],
				}),
				{
					category: {
						type: 'choice',
						instructions: 'Which team?',
						criteria: { billing: 'invoices and refunds', support: 'technical problems' },
					},
				},
			);
		});

		it('turns an empty description ("label =") into null', () => {
			assert.deepStrictEqual(
				buildQuestions({
					choice: [{ name: 'category', instructions: 'Which team?', labels: 'billing =\nsupport = technical problems' }],
				}),
				{
					category: {
						type: 'choice',
						instructions: 'Which team?',
						criteria: { billing: null, support: 'technical problems' },
					},
				},
			);
		});

		it('turns a whitespace-only description into null', () => {
			assert.deepStrictEqual(
				buildQuestions({
					choice: [{ name: 'category', instructions: 'Which team?', labels: 'billing =    \nsupport' }],
				}),
				{
					category: { type: 'choice', instructions: 'Which team?', criteria: { billing: null, support: null } },
				},
			);
		});

		it('trims whitespace around labels, descriptions and blank lines', () => {
			assert.deepStrictEqual(
				buildQuestions({
					choice: [
						{
							name: 'category',
							instructions: 'Which team?',
							labels: '\n  billing   =   invoices  \n\n\t support \n\n',
						},
					],
				}),
				{
					category: {
						type: 'choice',
						instructions: 'Which team?',
						criteria: { billing: 'invoices', support: null },
					},
				},
			);
		});

		// BEHAVIOUR NOTE: the separator is chosen per field, not per line. As soon
		// as the field has a line break, ONLY line breaks separate labels, so a
		// comma on one of those lines is ordinary text.
		it('treats a comma as text once the field has a line break', () => {
			assert.deepStrictEqual(
				buildQuestions({
					choice: [{ name: 'category', instructions: 'Which team?', labels: 'billing, support\nsales' }],
				}),
				{
					category: {
						type: 'choice',
						instructions: 'Which team?',
						criteria: { 'billing, support': null, sales: null },
					},
				},
			);
		});

		// BEHAVIOUR NOTE: only the FIRST '=' separates label from description, so
		// a description may contain '=' but a label may not.
		it('splits on the first "=" only, so a description may contain "="', () => {
			assert.deepStrictEqual(
				buildQuestions({
					choice: [{ name: 'category', instructions: 'Which?', labels: 'math = a = b is an equation\nprose' }],
				}),
				{
					category: {
						type: 'choice',
						instructions: 'Which?',
						criteria: { math: 'a = b is an equation', prose: null },
					},
				},
			);
		});

		// The docs/DESIGN.md wire example, `"billing": "invoices, refunds"`, which
		// the form syntax has to be able to produce.
		it('keeps a comma inside a description when the labels are on separate lines', () => {
			assert.deepStrictEqual(
				buildQuestions({
					choice: [{ name: 'category', instructions: 'Which team?', labels: 'billing = invoices, refunds\nsupport' }],
				}),
				{
					category: {
						type: 'choice',
						instructions: 'Which team?',
						criteria: { billing: 'invoices, refunds', support: null },
					},
				},
			);
		});

		it('keeps commas inside every description of a multi-line field', () => {
			assert.deepStrictEqual(
				buildQuestions({
					choice: [
						{
							name: 'category',
							instructions: 'Which team?',
							labels: 'billing = invoices, payments and refunds\nsupport = outages, bugs and how-to questions',
						},
					],
				}),
				{
					category: {
						type: 'choice',
						instructions: 'Which team?',
						criteria: {
							billing: 'invoices, payments and refunds',
							support: 'outages, bugs and how-to questions',
						},
					},
				},
			);
		});

		it('throws when a label is empty because the line starts with "="', () => {
			assert.throws(
				() => buildQuestions({ choice: [{ name: 'category', instructions: 'Which?', labels: '= no label\nsupport' }] }),
				/Choice question "category" has a label with nothing before the "=" \("= no label"\)\./,
			);
		});

		it('throws when a label is only whitespace before the "="', () => {
			assert.throws(
				() => buildQuestions({ choice: [{ name: 'category', instructions: 'Which?', labels: 'a\n  = nothing' }] }),
				/Choice question "category" has a label with nothing before the "="/,
			);
		});

		it('throws on a duplicate label, naming the label', () => {
			assert.throws(
				() =>
					buildQuestions({
						choice: [{ name: 'category', instructions: 'Which?', labels: 'billing = first\nsupport\nbilling = second' }],
					}),
				/Choice question "category" lists the label "billing" twice\./,
			);
		});

		it('throws when fewer than two labels are given', () => {
			assert.throws(
				() => buildQuestions({ choice: [{ name: 'category', instructions: 'Which?', labels: 'billing' }] }),
				/Choice question "category" needs at least two labels\./,
			);
		});

		it('throws when the labels field is empty', () => {
			assert.throws(
				() => buildQuestions({ choice: [{ name: 'category', instructions: 'Which?', labels: '' }] }),
				/Choice question "category" needs at least two labels\./,
			);
		});

		it('throws a duplicate-label error, not a count error, when the only two labels are the same', () => {
			assert.throws(
				() => buildQuestions({ choice: [{ name: 'category', instructions: 'Which?', labels: 'billing, billing' }] }),
				/Choice question "category" lists the label "billing" twice\./,
			);
		});
	});

	describe('score', () => {
		it('splits the rubric by line, lowest level first', () => {
			assert.deepStrictEqual(
				buildQuestions({
					score: [{ name: 'urgency', instructions: 'How urgent?', rubric: 'can wait\ntoday\nright now' }],
				}),
				{
					urgency: {
						type: 'score',
						instructions: 'How urgent?',
						criteria: ['can wait', 'today', 'right now'],
					},
				},
			);
		});

		it('keeps commas inside a rubric level', () => {
			assert.deepStrictEqual(
				buildQuestions({
					score: [{ name: 'urgency', instructions: 'How urgent?', rubric: 'can wait, no rush\ntoday, before close' }],
				}),
				{
					urgency: {
						type: 'score',
						instructions: 'How urgent?',
						criteria: ['can wait, no rush', 'today, before close'],
					},
				},
			);
		});

		it('handles CRLF line endings', () => {
			assert.deepStrictEqual(
				buildQuestions({
					score: [{ name: 'urgency', instructions: 'How urgent?', rubric: 'can wait\r\ntoday\r\nright now' }],
				}),
				{
					urgency: {
						type: 'score',
						instructions: 'How urgent?',
						criteria: ['can wait', 'today', 'right now'],
					},
				},
			);
		});

		it('trims each level and drops blank lines', () => {
			assert.deepStrictEqual(
				buildQuestions({
					score: [{ name: 'urgency', instructions: 'How urgent?', rubric: '\n  can wait  \n\n\ttoday\t\n\n' }],
				}),
				{
					urgency: { type: 'score', instructions: 'How urgent?', criteria: ['can wait', 'today'] },
				},
			);
		});

		it('throws when fewer than two rubric levels are given', () => {
			assert.throws(
				() => buildQuestions({ score: [{ name: 'urgency', instructions: 'How urgent?', rubric: 'can wait' }] }),
				/Score question "urgency" needs at least two rubric levels, one per line\./,
			);
		});

		it('throws when the rubric is empty', () => {
			assert.throws(
				() => buildQuestions({ score: [{ name: 'urgency', instructions: 'How urgent?', rubric: '' }] }),
				/Score question "urgency" needs at least two rubric levels, one per line\./,
			);
		});

		// BEHAVIOUR NOTE: comma-separated levels are a single level, so a rubric
		// written with commas trips the "two levels" check.
		it('throws when the rubric levels are comma-separated on one line', () => {
			assert.throws(
				() => buildQuestions({ score: [{ name: 'urgency', instructions: 'How urgent?', rubric: 'can wait, today, now' }] }),
				/Score question "urgency" needs at least two rubric levels, one per line\./,
			);
		});
	});

	describe('question names', () => {
		it('trims the name of a noul question', () => {
			assert.deepStrictEqual(buildQuestions({ noul: [{ name: '  needsReply\t', instructions: 'Reply?' }] }), {
				needsReply: { type: 'noul', instructions: 'Reply?' },
			});
		});

		it('trims the name of a choice question', () => {
			assert.deepStrictEqual(
				buildQuestions({ choice: [{ name: '  category  ', instructions: 'Which?', labels: 'a, b' }] }),
				{ category: { type: 'choice', instructions: 'Which?', criteria: { a: null, b: null } } },
			);
		});

		it('trims the name of a score question', () => {
			assert.deepStrictEqual(
				buildQuestions({ score: [{ name: '\nurgency ', instructions: 'How urgent?', rubric: 'low\nhigh' }] }),
				{ urgency: { type: 'score', instructions: 'How urgent?', criteria: ['low', 'high'] } },
			);
		});

		it('throws when a noul question has an empty name', () => {
			assert.throws(
				() => buildQuestions({ noul: [{ name: '', instructions: 'Reply?' }] }),
				/Every question needs a name\./,
			);
		});

		it('throws when a noul question has a whitespace-only name', () => {
			assert.throws(
				() => buildQuestions({ noul: [{ name: '   ', instructions: 'Reply?' }] }),
				/Every question needs a name\./,
			);
		});

		it('throws when a noul question has no name at all', () => {
			const collection = { noul: [{ instructions: 'Reply?' }] } as unknown as QuestionsCollection;
			assert.throws(() => buildQuestions(collection), /Every question needs a name\./);
		});

		it('throws when a choice question has a blank name', () => {
			assert.throws(
				() => buildQuestions({ choice: [{ name: '  ', instructions: 'Which?', labels: 'a, b' }] }),
				/Every question needs a name\./,
			);
		});

		it('throws when a choice question has no name at all', () => {
			const collection = { choice: [{ instructions: 'Which?', labels: 'a, b' }] } as unknown as QuestionsCollection;
			assert.throws(() => buildQuestions(collection), /Every question needs a name\./);
		});

		it('throws when a score question has a blank name', () => {
			assert.throws(
				() => buildQuestions({ score: [{ name: '\t', instructions: 'How urgent?', rubric: 'low\nhigh' }] }),
				/Every question needs a name\./,
			);
		});

		it('throws when a score question has no name at all', () => {
			const collection = { score: [{ instructions: 'How urgent?', rubric: 'low\nhigh' }] } as unknown as QuestionsCollection;
			assert.throws(() => buildQuestions(collection), /Every question needs a name\./);
		});

		it('reports the name error before the label error for a nameless choice question', () => {
			assert.throws(
				() => buildQuestions({ choice: [{ name: ' ', instructions: 'Which?', labels: 'billing' }] }),
				/Every question needs a name\./,
			);
		});

		it('reports the name error before the rubric error for a nameless score question', () => {
			assert.throws(
				() => buildQuestions({ score: [{ name: ' ', instructions: 'How urgent?', rubric: 'low' }] }),
				/Every question needs a name\./,
			);
		});

		it('uses the trimmed name in a choice error message', () => {
			assert.throws(
				() => buildQuestions({ choice: [{ name: '  category\n', instructions: 'Which?', labels: 'billing' }] }),
				/Choice question "category" needs at least two labels\./,
			);
		});

		it('uses the trimmed name in a score error message', () => {
			assert.throws(
				() => buildQuestions({ score: [{ name: ' urgency ', instructions: 'How urgent?', rubric: 'low' }] }),
				/Score question "urgency" needs at least two rubric levels, one per line\./,
			);
		});
	});

	describe('raw JSON overlay', () => {
		it('adds questions that are not in the collection', () => {
			assert.deepStrictEqual(
				buildQuestions(
					{ noul: [{ name: 'needsReply', instructions: 'Reply?' }] },
					{ language: { type: 'choice', instructions: 'Which language?', criteria: { en: null, de: null } } },
				),
				{
					needsReply: { type: 'noul', instructions: 'Reply?' },
					language: { type: 'choice', instructions: 'Which language?', criteria: { en: null, de: null } },
				},
			);
		});

		it('adds questions when the collection is empty', () => {
			assert.deepStrictEqual(buildQuestions({}, { isSpam: { type: 'noul', instructions: 'Spam?' } }), {
				isSpam: { type: 'noul', instructions: 'Spam?' },
			});
		});

		it('wins on a name clash with a collection question', () => {
			assert.deepStrictEqual(
				buildQuestions(
					{
						noul: [{ name: 'category', instructions: 'from the form', whenTrue: 'ignored' }],
						choice: [{ name: 'urgency', instructions: 'from the form', labels: 'a, b' }],
					},
					{ category: { type: 'score', instructions: 'from raw JSON', criteria: ['low', 'high'] } },
				),
				{
					category: { type: 'score', instructions: 'from raw JSON', criteria: ['low', 'high'] },
					urgency: { type: 'choice', instructions: 'from the form', criteria: { a: null, b: null } },
				},
			);
		});

		it('passes the raw question object through unchanged', () => {
			const raw = { odd: { type: 'noul', instructions: 'Odd?', extra: 42, nested: { deep: true } } };

			assert.deepStrictEqual(buildQuestions({}, raw), {
				odd: { type: 'noul', instructions: 'Odd?', extra: 42, nested: { deep: true } },
			});
		});

		it('trims raw question names, as the form does', () => {
			assert.deepStrictEqual(buildQuestions({}, { '  spaced  ': { type: 'noul', instructions: 'Spam?' } }), {
				spaced: { type: 'noul', instructions: 'Spam?' },
			});
		});

		it('throws when a raw question name is blank', () => {
			assert.throws(
				() => buildQuestions({}, { '   ': { type: 'noul', instructions: 'Spam?' } }),
				/Every question needs a name\./,
			);
		});

		it('wins on a clash with a form question even when the raw name needs trimming', () => {
			assert.deepStrictEqual(
				buildQuestions(
					{ noul: [{ name: 'category', instructions: 'from the form' }] },
					{ ' category ': { type: 'score', instructions: 'from raw JSON', criteria: ['low', 'high'] } },
				),
				{ category: { type: 'score', instructions: 'from raw JSON', criteria: ['low', 'high'] } },
			);
		});

		it('throws when a raw entry is not an object', () => {
			assert.throws(
				() => buildQuestions({}, { bad: 'noul' }),
				/Raw question "bad" must be an object with a string "type"\./,
			);
		});

		it('throws when a raw entry is null', () => {
			assert.throws(
				() => buildQuestions({}, { bad: null }),
				/Raw question "bad" must be an object with a string "type"\./,
			);
		});

		it('throws when a raw entry has no type', () => {
			assert.throws(
				() => buildQuestions({}, { bad: { instructions: 'no type here' } }),
				/Raw question "bad" must be an object with a string "type"\./,
			);
		});

		it('throws when a raw entry has a non-string type', () => {
			assert.throws(
				() => buildQuestions({}, { bad: { type: 1, instructions: 'numeric type' } }),
				/Raw question "bad" must be an object with a string "type"\./,
			);
		});

		it('throws when a raw entry is an array', () => {
			assert.throws(
				() => buildQuestions({}, { bad: ['noul'] }),
				/Raw question "bad" must be an object with a string "type"\./,
			);
		});
	});

	it('builds all three question types together', () => {
		assert.deepStrictEqual(
			buildQuestions({
				noul: [{ name: 'needsReply', instructions: 'Does this need a human reply?', whenTrue: 'a question is asked' }],
				choice: [{ name: 'category', instructions: 'Which team?', labels: 'billing = invoices\nsupport' }],
				score: [{ name: 'urgency', instructions: 'How urgent?', rubric: 'can wait\ntoday\nright now' }],
			}),
			{
				needsReply: {
					type: 'noul',
					instructions: 'Does this need a human reply?',
					criteria: { true: 'a question is asked' },
				},
				category: { type: 'choice', instructions: 'Which team?', criteria: { billing: 'invoices', support: null } },
				urgency: { type: 'score', instructions: 'How urgent?', criteria: ['can wait', 'today', 'right now'] },
			},
		);
	});
});
