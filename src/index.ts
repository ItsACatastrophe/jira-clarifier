import { Context, SNSEvent } from 'aws-lambda';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import fetch from 'node-fetch';

let jiraApiToken: string;

export async function handler(event: SNSEvent, context: Context): Promise<string> {
  console.log(`The lambda was invoked!: \n${JSON.stringify(event)}`)

  let output = ''
  for (let record of event.Records) {
    if (jiraApiToken === undefined) {
      await getJiraApiToken()
    }
    const jiraClient = new JiraClient();

    const snsMessage = JSON.parse(record.Sns.Message)
    const jiraIssueId = snsMessage['automationData']['issue-key']

    const issue = await jiraClient.getIssue(jiraIssueId);
    const issueDescription = issue.fields.description.content[0].content[0].text

    const payloadBody = {
      user_id: "hackathon_user",
      channel_id: "",
      query: `Write a short question about this issue: "${issueDescription}"`,
      namespace: "AZURE_OPENAI"
    }
    const llmPayload = {
      Records: [
        {
          body: JSON.stringify(payloadBody),
          messageAttributes: {}
        }
      ]
    }
    const llmResponse = await invokeLlmLambda(llmPayload)

    await jiraClient.sendComment(jiraIssueId, llmResponse.slice(1, -1));

    output += `${JSON.stringify(llmResponse)}\n`
  }

  console.log(`Comments succesfully posted:\n${output}`)
  return output
}

async function getJiraApiToken(): Promise<void> {
  const client = new SecretsManagerClient({ region: process.env.REGION });
  const command = new GetSecretValueCommand({ SecretId: process.env.JIRA_SECRET_ARN })
  const response = await client.send(command);

  if (response.SecretString) {
    jiraApiToken = JSON.parse(response.SecretString).api_token
  }
}

async function invokeLlmLambda(payload: any) {
  const stsClient = new STSClient({ region: process.env.REGION });
  const stsCommand = new AssumeRoleCommand({
    RoleArn: process.env.STS_LLM_ARN,
    RoleSessionName: 'name=hackathon'
  })
  const stsResponse = await stsClient.send(stsCommand);
  const credentials = stsResponse.Credentials!;

  const lambdaCreds = {
    accessKeyId: credentials['AccessKeyId']!,
    secretAccessKey: credentials['SecretAccessKey']!,
    sessionToken: credentials['SessionToken']!
  }

  const lambdaClient = new LambdaClient({
    region: process.env.REGION,
    credentials: lambdaCreds
  });
  const lambdaCommand = new InvokeCommand({
    FunctionName: 'dai-platform-catalog-slack-llm-orchestrator-pr-15',
    Payload: JSON.stringify(payload)
  })
  const lambdaResponse = await lambdaClient.send(lambdaCommand);
  const responsePayload = lambdaResponse.Payload!.transformToString('utf-8')

  return responsePayload;
}

class JiraClient {
  jiraDomain: string
  auth: string

  constructor() {
    this.jiraDomain = 'https://guild-education.atlassian.net/'
    this.auth = `Basic ${Buffer.from(
      `catherine.sanchez@guildeducation.com:${jiraApiToken}`
    ).toString('base64')}`
  }

  async _request(args: { endpoint: string, method: string, body?: string }) {
    console.log(`Making a request to Jira resource at: ${this.jiraDomain}${args.endpoint}`)

    let requestOptions: any = {
      method: args.method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': this.auth
      }
    }
    if (args.body !== undefined || args.method != 'GET') {
      requestOptions.body = args.body === undefined ? '{}' : args.body
    }

    const response = await fetch(`${this.jiraDomain}${args.endpoint}`, requestOptions);
    const responseJson = await response.json()

    if (response < 200 || response >= 300) {
      console.log(`Request to Jira failed with status code: ${response.status}\nResponse: ${responseJson}`)
    }

    return responseJson;
  }

  async getIssue(issueId: string) {
    const queryParams = 'fields=description'
    return await this._request({ endpoint: `/rest/api/3/issue/${issueId}?${queryParams}`, method: 'GET' })
  }

  async getComments(issueId: string) {
    return await this._request({ endpoint: `rest/api/3/issue/${issueId}/comment`, method: 'GET' })
  }

  async sendComment(issueId: string, commentText: string) {
    const body = JSON.stringify({
      "body": {
        "content": [
          {
            "content": [
              {
                "text": commentText,
                "type": "text"
              }
            ],
            "type": "paragraph"
          }
        ],
        "type": "doc",
        "version": 1
      },
    })
    return await this._request({ endpoint: `rest/api/3/issue/${issueId}/comment`, method: 'POST', body: body })
  }
}
// 