import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

/**
 * TypeSafe AI API key. Stored encrypted by n8n and sent as a Bearer token on every request,
 * matching the official SDKs. The package never contains a key.
 */
export class TypeSafeApi implements ICredentialType {
	name = 'typeSafeApi';

	displayName = 'TypeSafe AI API';

	// eslint-disable-next-line n8n-nodes-base/cred-class-field-documentation-url-miscased -- a full URL is what community nodes use
	documentationUrl = 'https://docs.typesafe.ai';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Your TypeSafe AI API key (starts with apikey_)',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.typesafe.ai',
			description: 'Override only for a proxy or a non-production environment',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			// The same fallback the node's execute path uses: a cleared Base URL means the public API and
			// a trailing slash is trimmed. Sending the raw field made a blank one fail with "ERR_INVALID_URL"
			// while the node itself still worked.
			baseURL: '={{ (($credentials.baseUrl || "").trim() || "https://api.typesafe.ai").replace(/\\/+$/, "") }}',
			url: '/v1/models',
		},
		// n8n's own message for a failed test is only the HTTP status text ("Unauthorized"), which does not
		// say what to do about it.
		rules: [
			{
				type: 'responseCode',
				properties: {
					value: 401,
					message: 'Check your TypeSafe API key: the API rejected it (401 Unauthorized).',
				},
			},
			{
				type: 'responseCode',
				properties: {
					value: 403,
					message: 'Check your TypeSafe API key: it is not allowed to list models (403 Forbidden).',
				},
			},
		],
	};
}
