import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INode,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import { buildQuestions, flattenAnswers, type QuestionsCollection } from './questions';

/** The model sent when none is chosen; the same default the official SDKs use. The API rejects a request without one. */
const DEFAULT_MODEL = 'jev-latest';

/** Used when the credential's Base URL has been cleared, so a blank field cannot produce "Invalid URL". */
const DEFAULT_BASE_URL = 'https://api.typesafe.ai';

/**
 * TypeSafe AI node. "System One" sends a state (text or JSON) plus named questions and returns a
 * typed answer per question; "List Models" enumerates the models the key can use.
 *
 * Wire format (shared with the official SDKs):
 *   POST {baseUrl}/v1/systemone  { state, model, questions: { name: { type, instructions, criteria } } }
 *   -> { model, usage: { input_tokens, output_tokens }, answers: { name: { ...typed answer } } }
 */
export class TypeSafe implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'TypeSafe AI',
		name: 'typeSafe',
		icon: 'file:typesafe.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter["operation"] === "listModels" ? "list models" : "ask questions" }}',
		description: 'Classify, score and answer yes/no questions about text or JSON with TypeSafe AI',
		defaults: { name: 'TypeSafe AI' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'typeSafeApi', required: true }],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Ask Questions (System One)',
						value: 'systemOne',
						action: 'Ask questions about a state',
						description: 'Send text or JSON with named questions and get typed answers back',
					},
					{
						name: 'List Models',
						value: 'listModels',
						action: 'List the available models',
						description: 'Return one item per model the API key can use',
					},
				],
				default: 'systemOne',
			},

			// ---- System One -------------------------------------------------------------------
			{
				displayName: 'State Type',
				name: 'stateType',
				type: 'options',
				displayOptions: { show: { operation: ['systemOne'] } },
				options: [
					{ name: 'Text', value: 'text' },
					{ name: 'JSON', value: 'json' },
				],
				default: 'text',
				description: 'Whether the state is plain text or a JSON object/array',
			},
			{
				displayName: 'State',
				name: 'stateText',
				type: 'string',
				typeOptions: { rows: 4 },
				displayOptions: { show: { operation: ['systemOne'], stateType: ['text'] } },
				default: '',
				required: true,
				placeholder: 'e.g. {{ $json.subject }}\n\n{{ $json.text }}',
				description: 'The text the questions are about, for example an email body',
			},
			{
				displayName: 'State (JSON)',
				name: 'stateJson',
				type: 'json',
				displayOptions: { show: { operation: ['systemOne'], stateType: ['json'] } },
				default: '={{ $json }}',
				required: true,
				description: 'A JSON object or array the questions are about',
			},
			{
				displayName: 'Model Name or ID',
				name: 'model',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getModels' },
				displayOptions: { show: { operation: ['systemOne'] } },
				default: '',
				description:
					'Leave empty to use jev-latest. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Questions',
				name: 'questions',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true, sortable: true },
				displayOptions: { show: { operation: ['systemOne'] } },
				default: {},
				placeholder: 'Add Question',
				options: [
					{
						name: 'noul',
						displayName: 'Yes/No (Noul)',
						values: [
							{
								displayName: 'Name',
								name: 'name',
								type: 'string',
								default: '',
								required: true,
								placeholder: 'e.g. needsReply',
								description: 'Key the answer is returned under',
							},
							{
								displayName: 'Question',
								name: 'instructions',
								type: 'string',
								default: '',
								required: true,
								placeholder: 'e.g. Does this email need a human reply?',
								description: 'What to decide about the state. The answer is a probability between 0 and 1.',
							},
							{
								displayName: 'When True',
								name: 'whenTrue',
								type: 'string',
								default: '',
								description: 'Optional description of the yes outcome',
							},
							{
								displayName: 'When False',
								name: 'whenFalse',
								type: 'string',
								default: '',
								description: 'Optional description of the no outcome',
							},
						],
					},
					{
						name: 'choice',
						displayName: 'Choice',
						values: [
							{
								displayName: 'Name',
								name: 'name',
								type: 'string',
								default: '',
								required: true,
								placeholder: 'e.g. category',
								description: 'Key the answer is returned under',
							},
							{
								displayName: 'Question',
								name: 'instructions',
								type: 'string',
								default: '',
								required: true,
								placeholder: 'e.g. Which team should handle this email?',
								description: 'What to choose between. The answer is one of the labels below.',
							},
							{
								displayName: 'Labels',
								name: 'labels',
								type: 'string',
								typeOptions: { rows: 3 },
								default: '',
								required: true,
								placeholder: 'billing = invoices, payments and refunds\nsupport = technical problems\nsales',
								description:
									'One label per line, or comma-separated on a single line. Add "= description" after a label to describe it; a description may contain commas as long as each label is on its own line.',
							},
						],
					},
					{
						name: 'score',
						displayName: 'Score',
						values: [
							{
								displayName: 'Name',
								name: 'name',
								type: 'string',
								default: '',
								required: true,
								placeholder: 'e.g. urgency',
								description: 'Key the answer is returned under',
							},
							{
								displayName: 'Question',
								name: 'instructions',
								type: 'string',
								default: '',
								required: true,
								placeholder: 'e.g. How urgent is this email?',
								description: 'What to rate. The answer is a number between 0 and the last rubric level.',
							},
							{
								displayName: 'Rubric',
								name: 'rubric',
								type: 'string',
								typeOptions: { rows: 3 },
								default: '',
								required: true,
								placeholder: 'can wait a week\nthis week\ntoday\nright now',
								description: 'One level per line, lowest first. Level 0 is the first line.',
							},
						],
					},
				],
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				displayOptions: { show: { operation: ['systemOne'] } },
				default: {},
				placeholder: 'Add Option',
				options: [
					{
						displayName: 'Include Input Fields',
						name: 'includeInput',
						type: 'boolean',
						default: true,
						description: 'Whether to copy the incoming item fields into the output next to the answers',
					},
					{
						displayName: 'Questions (Raw JSON)',
						name: 'questionsJson',
						type: 'json',
						default: '',
						description:
							'Advanced: a raw questions object in the API wire format. Merged over the questions above; a raw question with the same name wins.',
					},
					{
						displayName: 'Timeout (Seconds)',
						name: 'timeout',
						type: 'number',
						default: 60,
						typeOptions: { minValue: 1 },
						description: 'Per-request timeout; a hung call fails the item instead of the workflow',
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			async getModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'typeSafeApi', {
					method: 'GET',
					url: '/v1/models',
					baseURL: resolveBaseUrl(await this.getCredentials('typeSafeApi')),
					json: true,
				})) as { models?: Array<{ name: string }> };
				return (response.models ?? []).map((m) => ({ name: m.name, value: m.name }));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const operation = this.getNodeParameter('operation', 0) as string;
		const baseURL = resolveBaseUrl(await this.getCredentials('typeSafeApi'));
		const returnData: INodeExecutionData[] = [];

		if (operation === 'listModels') {
			// One request for the whole node, so every output item is paired with every input item.
			const pairedItem = items.map((_, item) => ({ item }));
			try {
				const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'typeSafeApi', {
					method: 'GET',
					url: '/v1/models',
					baseURL,
					json: true,
				})) as { models?: IDataObject[] };
				for (const model of response.models ?? []) returnData.push({ json: model, pairedItem });
			} catch (error) {
				const failure = asNodeError(this.getNode(), error, 0);
				if (!this.continueOnFail()) throw failure;
				returnData.push({ json: errorItem(failure), pairedItem });
			}
			return [returnData];
		}

		const node = this.getNode();

		for (let i = 0; i < items.length; i++) {
			try {
				const stateType = this.getNodeParameter('stateType', i) as string;
				const state =
					stateType === 'json'
						? parseJsonParameter(node, this.getNodeParameter('stateJson', i), 'State (JSON)', i, true)
						: (this.getNodeParameter('stateText', i) as string);
				const model = (this.getNodeParameter('model', i, '') as string) || DEFAULT_MODEL;
				const collection = this.getNodeParameter('questions', i, {}) as QuestionsCollection;
				const options = this.getNodeParameter('options', i, {}) as {
					questionsJson?: string | IDataObject;
					includeInput?: boolean;
					timeout?: number;
				};

				const rawQuestions = parseJsonParameter(node, options.questionsJson, 'Questions (Raw JSON)', i, false);
				let questions: Record<string, IDataObject>;
				try {
					questions = buildQuestions(collection, rawQuestions);
				} catch (error) {
					throw new NodeOperationError(node, (error as Error).message, {
						itemIndex: i,
						description: 'Check the Questions fields on this node.',
					});
				}
				if (Object.keys(questions).length === 0) {
					throw new NodeOperationError(node, 'Add at least one question.', {
						itemIndex: i,
						description: 'Use "Add Question" to add a Yes/No, Choice or Score question.',
					});
				}

				const body: IDataObject = { state, model, questions };

				const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'typeSafeApi', {
					method: 'POST',
					url: '/v1/systemone',
					baseURL,
					body,
					json: true,
					returnFullResponse: true,
					timeout: resolveTimeout(options.timeout),
				})) as {
					body: { model: string; usage: IDataObject; answers: Record<string, IDataObject> };
					headers: Record<string, string | undefined>;
				};

				const payload = response.body;
				const requestId = response.headers?.['x-typesafe-request-id'];
				const output: IDataObject = {
					...(options.includeInput === false ? {} : items[i].json),
					typesafe: {
						model: payload.model,
						usage: payload.usage,
						answers: payload.answers,
						...(requestId ? { requestId } : {}),
					},
					results: flattenAnswers(payload.answers),
				};
				returnData.push({ json: output, pairedItem: { item: i } });
			} catch (error) {
				const failure = asNodeError(node, error, i);
				if (!this.continueOnFail()) throw failure;
				returnData.push({ json: errorItem(failure), pairedItem: { item: i } });
			}
		}

		return [returnData];
	}
}

/**
 * n8n hands a `json` parameter back as a string when typed by hand and as an object when set by an
 * expression. A parse failure is the user's typo, not an API failure, so it becomes a
 * NodeOperationError naming the field rather than a bare SyntaxError wrapped as an API error.
 */
function parseJsonParameter(
	node: INode,
	value: unknown,
	fieldName: string,
	itemIndex: number,
	required: boolean,
): IDataObject | undefined {
	if (value === undefined || value === null || value === '') {
		if (!required) return undefined;
		throw new NodeOperationError(node, `"${fieldName}" is empty.`, {
			itemIndex,
			description: 'Give the field a JSON object or array, or switch State Type to Text.',
		});
	}
	if (typeof value !== 'string') return value as IDataObject;
	try {
		return JSON.parse(value) as IDataObject;
	} catch (error) {
		throw new NodeOperationError(node, `"${fieldName}" is not valid JSON: ${(error as Error).message}`, {
			itemIndex,
			description: 'Fix the JSON in this field, or set it from an expression that returns an object.',
		});
	}
}

/** Fall back to the public API when the credential's Base URL is blank, and drop a trailing slash. */
function resolveBaseUrl(credentials: IDataObject): string {
	const baseUrl = ((credentials.baseUrl as string) ?? '').trim();
	return (baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

/** Milliseconds for the request. 0, a negative number or a blank field all mean "use the default". */
function resolveTimeout(seconds: number | undefined): number {
	const value = Number(seconds);
	return (Number.isFinite(value) && value > 0 ? value : 60) * 1000;
}

/**
 * Keep the error n8n already produced (it carries the HTTP status and the API's own body under
 * `context.data`) and only tag it with the item it came from; wrap anything else as an API error.
 *
 * `instanceof` alone is not enough: a node loaded from a custom-extensions directory can resolve
 * its own copy of `n8n-workflow`, so the error n8n threw is an instance of a different class
 * object with the same name. Re-wrapping it would throw away the API's response body.
 */
function asNodeError(node: INode, error: unknown, itemIndex: number) {
	if (isNodeError(error)) {
		if (error.context) error.context.itemIndex = itemIndex;
		else error.context = { itemIndex };
		return error;
	}
	return new NodeApiError(node, error as JsonObject, { itemIndex });
}

function isNodeError(error: unknown): error is NodeOperationError | NodeApiError {
	if (error instanceof NodeOperationError || error instanceof NodeApiError) return true;
	const name = (error as { name?: unknown } | undefined)?.name;
	return name === 'NodeApiError' || name === 'NodeOperationError';
}

/** The item pushed when "Continue On Fail" is on: the message plus whatever the API said about it. */
function errorItem(error: NodeOperationError | NodeApiError): IDataObject {
	const description = apiDetail(error) ?? error.description ?? transportDetail(error) ?? undefined;
	const httpCode = (error as NodeApiError).httpCode ?? undefined;
	return {
		error: error.message,
		...(description ? { errorDescription: description } : {}),
		...(httpCode ? { errorHttpCode: httpCode } : {}),
	};
}

/**
 * What actually went wrong on the wire when there is no HTTP response to explain it. n8n replaces the
 * underlying message with a generic one ("The connection was aborted, perhaps the server is offline")
 * and keeps the original ("timeout of 2000ms exceeded", "getaddrinfo ENOTFOUND …") in `messages`, which
 * a "Continue On Fail" item would otherwise lose.
 */
function transportDetail(error: unknown): string | undefined {
	const messages = (error as { messages?: unknown }).messages;
	if (!Array.isArray(messages)) return undefined;
	const first = messages.find((message) => typeof message === 'string' && message.trim() !== '');
	return typeof first === 'string' ? first.trim() : undefined;
}

/**
 * The API's own explanation, when it sent one: `{ "detail": { "message": ... } }` for auth errors
 * and a FastAPI-style `{ "detail": [{ "msg": ..., "loc": [...] }] }` for 422 validation errors.
 */
function apiDetail(error: unknown): string | undefined {
	const detail = ((error as NodeApiError)?.context?.data as IDataObject | undefined)?.detail;
	if (typeof detail === 'string') return detail;
	if (Array.isArray(detail)) {
		const parts = detail
			.map((entry) => {
				const item = entry as IDataObject;
				const where = Array.isArray(item.loc) ? ` (${(item.loc as unknown[]).join('.')})` : '';
				return typeof item.msg === 'string' ? `${item.msg}${where}` : undefined;
			})
			.filter((part): part is string => part !== undefined);
		return parts.length ? parts.join('; ') : undefined;
	}
	const message = (detail as IDataObject | undefined)?.message;
	return typeof message === 'string' ? message : undefined;
}
