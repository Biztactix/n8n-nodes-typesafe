import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import { buildQuestions, flattenAnswers, type QuestionsCollection } from './questions';

/** The model sent when none is chosen; the same default the official SDKs use. The API rejects a request without one. */
const DEFAULT_MODEL = 'jev-latest';

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
		subtitle: '={{ $parameter["operation"] }}',
		description: 'Classify, score and answer yes/no questions about text or JSON with TypeSafe AI',
		defaults: { name: 'TypeSafe AI' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'typeSafeApi', required: true }],
		requestDefaults: {
			baseURL: '={{ $credentials.baseUrl }}',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		},
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
									'One label per line (commas also work). Add "= description" after a label to describe it.',
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
						displayName: 'Questions (Raw JSON)',
						name: 'questionsJson',
						type: 'json',
						default: '',
						description:
							'Advanced: a raw questions object in the API wire format. Merged over the questions above; a raw question with the same name wins.',
					},
					{
						displayName: 'Include Input Fields',
						name: 'includeInput',
						type: 'boolean',
						default: true,
						description: 'Whether to copy the incoming item fields into the output next to the answers',
					},
					{
						displayName: 'Timeout (Seconds)',
						name: 'timeout',
						type: 'number',
						default: 60,
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
					baseURL: (await this.getCredentials('typeSafeApi')).baseUrl as string,
					json: true,
				})) as { models?: Array<{ name: string }> };
				return (response.models ?? []).map((m) => ({ name: m.name, value: m.name }));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const operation = this.getNodeParameter('operation', 0) as string;
		const baseURL = (await this.getCredentials('typeSafeApi')).baseUrl as string;
		const returnData: INodeExecutionData[] = [];

		if (operation === 'listModels') {
			const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'typeSafeApi', {
				method: 'GET',
				url: '/v1/models',
				baseURL,
				json: true,
			})) as { models?: IDataObject[] };
			for (const model of response.models ?? []) returnData.push({ json: model });
			return [returnData];
		}

		for (let i = 0; i < items.length; i++) {
			try {
				const stateType = this.getNodeParameter('stateType', i) as string;
				const state =
					stateType === 'json'
						? parseJsonParameter(this.getNodeParameter('stateJson', i))
						: (this.getNodeParameter('stateText', i) as string);
				const model = (this.getNodeParameter('model', i, '') as string) || DEFAULT_MODEL;
				const collection = this.getNodeParameter('questions', i, {}) as QuestionsCollection;
				const options = this.getNodeParameter('options', i, {}) as {
					questionsJson?: string | IDataObject;
					includeInput?: boolean;
					timeout?: number;
				};

				const questions = buildQuestions(collection, parseJsonParameter(options.questionsJson));
				if (Object.keys(questions).length === 0) {
					throw new NodeOperationError(this.getNode(), 'Add at least one question.', { itemIndex: i });
				}

				const body: IDataObject = { state, model, questions };

				const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'typeSafeApi', {
					method: 'POST',
					url: '/v1/systemone',
					baseURL,
					body,
					json: true,
					timeout: ((options.timeout ?? 60) as number) * 1000,
				})) as { model: string; usage: IDataObject; answers: Record<string, IDataObject> };

				const output: IDataObject = {
					...(options.includeInput === false ? {} : items[i].json),
					typesafe: {
						model: response.model,
						usage: response.usage,
						answers: response.answers,
					},
					results: flattenAnswers(response.answers),
				};
				returnData.push({ json: output, pairedItem: { item: i } });
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				if (error instanceof NodeOperationError) throw error;
				throw new NodeApiError(this.getNode(), error as never, { itemIndex: i });
			}
		}

		return [returnData];
	}
}

/** n8n hands a `json` parameter back as a string when typed by hand and as an object when set by expression. */
function parseJsonParameter(value: unknown): IDataObject | undefined {
	if (value === undefined || value === null || value === '') return undefined;
	if (typeof value === 'string') return JSON.parse(value) as IDataObject;
	return value as IDataObject;
}
