import { join } from 'path';

import * as cdk from 'aws-cdk-lib';
import { AccountPrincipal, PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { Function, Runtime, Code } from 'aws-cdk-lib/aws-lambda';
import { SnsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Topic, TopicPolicy } from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

const jiraSecretArn = `arn:aws:secretsmanager:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID}:secret:${process.env.JIRA_API_TOKEN_SECRET_KEY}`;
const stLlmsArn = process.env.STLMSARN!

export class SNSStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const topic = new Topic(this, 'jira-to-sns-topic', {
      displayName: "jira-clarifier-topic",
      topicName: "jira-clarifier-topic"
    });

    const topicPolicy = new TopicPolicy(this, 'TopicPolicy', {
      topics: [topic],
    });

    // Allows Jira's AWS automation to publish to the topic
    // https://support.atlassian.com/cloud-automation/docs/configure-aws-sns-for-jira-automation/
    topicPolicy.document.addStatements(new PolicyStatement({
      actions: ["sns:Publish"],
      principals: [new AccountPrincipal('815843069303')], // Atlassian Automation AWS account ID
      resources: [topic.topicArn],
    }));

    new cdk.CfnOutput(this, 'clarifier-topic-arn-output', { exportName: 'jira-clarifier-topic-arn-output', value: topic.topicArn })
  }
}

export class LambdaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Function
    const clarifierFunction = new Function(this, 'clarifier-function', {
      runtime: Runtime.NODEJS_18_X,
      handler: 'dist/index.handler',
      code: Code.fromAsset(join(__dirname, '../deploy.zip')),
      functionName: 'jira-clarifier',
      environment: {
        JIRA_SECRET_ARN: jiraSecretArn,
        REGION: process.env.AWS_REGION!,
        STS_LLM_ARN: stLlmsArn
      },
      timeout: cdk.Duration.minutes(1)
    });

    // Event Source
    const topicArn = cdk.Fn.importValue('jira-clarifier-topic-arn-output')
    const clarifierTopic = Topic.fromTopicArn(this, 'jira-clarifier-topic', topicArn);
    clarifierFunction.addEventSource(new SnsEventSource(clarifierTopic))

    // IAM Policy
    clarifierFunction.addToRolePolicy(new PolicyStatement({
      actions: ["secretsmanager:GetSecretValue"],
      effect: Effect.ALLOW,
      resources: [jiraSecretArn]
    }))
    clarifierFunction.addToRolePolicy(new PolicyStatement({
      actions: ["sts:AssumeRole"],
      effect: Effect.ALLOW,
      resources: [stLlmsArn]
    }))
  }
}
// 