import type { IDataObject } from 'n8n-workflow';

/** The shape n8n returns for the Questions fixedCollection. */
export interface QuestionsCollection {
	noul?: Array<{ name: string; instructions: string; whenTrue?: string; whenFalse?: string }>;
	choice?: Array<{ name: string; instructions: string; labels: string }>;
	score?: Array<{ name: string; instructions: string; rubric: string }>;
}

/**
 * Build the API's `questions` object from the UI collection, then overlay any raw JSON questions.
 * The wire shapes match the official SDKs:
 *   noul   { type: "noul",   instructions, criteria?: { true?: text, false?: text } }
 *   choice { type: "choice", instructions, criteria: { label: description | null } }
 *   score  { type: "score",  instructions, criteria: [ level0, level1, ... ] }
 */
export function buildQuestions(collection: QuestionsCollection, raw?: IDataObject): Record<string, IDataObject> {
	const questions: Record<string, IDataObject> = {};

	for (const q of collection.noul ?? []) {
		const name = requireName(q.name);
		const criteria: IDataObject = {};
		const whenTrue = (q.whenTrue ?? '').trim();
		const whenFalse = (q.whenFalse ?? '').trim();
		if (whenTrue) criteria.true = whenTrue;
		if (whenFalse) criteria.false = whenFalse;
		questions[name] = {
			type: 'noul',
			instructions: q.instructions,
			...(Object.keys(criteria).length ? { criteria } : {}),
		};
	}

	for (const q of collection.choice ?? []) {
		const name = requireName(q.name);
		const criteria: Record<string, string | null> = {};
		for (const entry of splitLabels(q.labels)) {
			const eq = entry.indexOf('=');
			const label = (eq < 0 ? entry : entry.slice(0, eq)).trim();
			if (!label) {
				throw new Error(`Choice question "${name}" has a label with nothing before the "=" ("${entry}").`);
			}
			if (Object.prototype.hasOwnProperty.call(criteria, label)) {
				throw new Error(`Choice question "${name}" lists the label "${label}" twice.`);
			}
			criteria[label] = eq < 0 ? null : entry.slice(eq + 1).trim() || null;
		}
		if (Object.keys(criteria).length < 2) {
			throw new Error(`Choice question "${name}" needs at least two labels.`);
		}
		questions[name] = { type: 'choice', instructions: q.instructions, criteria };
	}

	for (const q of collection.score ?? []) {
		const name = requireName(q.name);
		const criteria = splitList(q.rubric, /\r?\n/);
		if (criteria.length < 2) {
			throw new Error(`Score question "${name}" needs at least two rubric levels, one per line.`);
		}
		questions[name] = { type: 'score', instructions: q.instructions, criteria };
	}

	if (raw) {
		for (const [rawName, question] of Object.entries(raw)) {
			const name = requireName(rawName);
			if (typeof question !== 'object' || question === null || typeof (question as IDataObject).type !== 'string') {
				throw new Error(`Raw question "${name}" must be an object with a string "type".`);
			}
			questions[name] = question as IDataObject;
		}
	}

	return questions;
}

/**
 * One easy value per question, for Switch and IF nodes downstream:
 *   noul -> probability of yes (0..1), choice -> the chosen label, score -> the expected score.
 * The full typed answers stay under `typesafe.answers`.
 *
 * A known answer type whose value field is missing flattens to `null`, never `undefined`:
 * n8n serialises items to JSON, and an `undefined` value would drop the key altogether, so a
 * downstream Switch or IF would see no field at all instead of an empty one.
 */
export function flattenAnswers(answers: Record<string, IDataObject>): IDataObject {
	const results: IDataObject = {};
	for (const [name, answer] of Object.entries(answers)) {
		switch (answer.type) {
			case 'noul':
				results[name] = answer.noul ?? null;
				break;
			case 'choice':
				results[name] = answer.choice ?? null;
				break;
			case 'score':
				results[name] = answer.score ?? null;
				break;
			default:
				results[name] = answer;
		}
	}
	return results;
}

/**
 * Choice labels: one per line when the field has any line break, comma-separated when it is a
 * single line. Splitting on line breaks only (when there are any) is what lets a description hold
 * a comma — `billing = invoices, payments and refunds` on its own line is one label, not two.
 */
function splitLabels(text: string): string[] {
	const value = text ?? '';
	return splitList(value, /\r?\n/.test(value) ? /\r?\n/ : /,/);
}

function splitList(text: string, separator: RegExp): string[] {
	return (text ?? '')
		.split(separator)
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

function requireName(name: string): string {
	const trimmed = (name ?? '').trim();
	if (!trimmed) throw new Error('Every question needs a name.');
	return trimmed;
}
