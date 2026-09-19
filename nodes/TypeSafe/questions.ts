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
		const criteria: IDataObject = {};
		if (q.whenTrue) criteria.true = q.whenTrue;
		if (q.whenFalse) criteria.false = q.whenFalse;
		questions[requireName(q.name)] = {
			type: 'noul',
			instructions: q.instructions,
			...(Object.keys(criteria).length ? { criteria } : {}),
		};
	}

	for (const q of collection.choice ?? []) {
		const criteria: Record<string, string | null> = {};
		for (const entry of splitList(q.labels)) {
			const eq = entry.indexOf('=');
			if (eq < 0) criteria[entry] = null;
			else criteria[entry.slice(0, eq).trim()] = entry.slice(eq + 1).trim() || null;
		}
		if (Object.keys(criteria).length < 2) {
			throw new Error(`Choice question "${q.name}" needs at least two labels.`);
		}
		questions[requireName(q.name)] = { type: 'choice', instructions: q.instructions, criteria };
	}

	for (const q of collection.score ?? []) {
		const criteria = splitList(q.rubric, /\r?\n/);
		if (criteria.length < 2) {
			throw new Error(`Score question "${q.name}" needs at least two rubric levels, one per line.`);
		}
		questions[requireName(q.name)] = { type: 'score', instructions: q.instructions, criteria };
	}

	if (raw) {
		for (const [name, question] of Object.entries(raw)) {
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
 */
export function flattenAnswers(answers: Record<string, IDataObject>): IDataObject {
	const results: IDataObject = {};
	for (const [name, answer] of Object.entries(answers)) {
		switch (answer.type) {
			case 'noul':
				results[name] = answer.noul;
				break;
			case 'choice':
				results[name] = answer.choice;
				break;
			case 'score':
				results[name] = answer.score;
				break;
			default:
				results[name] = answer;
		}
	}
	return results;
}

function splitList(text: string, separator: RegExp = /\r?\n|,/): string[] {
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
