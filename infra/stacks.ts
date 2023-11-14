import { join } from 'path';

import * as cdk from 'aws-cdk-lib';
import { AccountPrincipal, PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { Function, Runtime, Code } from 'aws-cdk-lib/aws-lambda';
import { SnsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Topic, TopicPolicy } from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

const jiraSecretArn = 'arn:aws:secretsmanager:us-west-2:688509701270:secret:jira-snooze/jira/api-token-LAinH9';
const stLlmsArn = 'arn:aws:iam::477873552632:role/dai-platform-catalog-slack-llm-orchestrator'
export class SNSStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const topic = new Topic(this, 'jira-to-sns-topic', {
      displayName: "jira-snooze-topic",
      topicName: "jira-snooze-topic"
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

    new cdk.CfnOutput(this, 'snooze-topic-arn-output', { exportName: 'jira-snooze-topic-arn-output', value: topic.topicArn })
  }
}

// TODO: write handling for this lambda as the Topic's destination  
export class LambdaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Function
    const snoozeFunction = new Function(this, 'snooze-function', {
      runtime: Runtime.NODEJS_18_X,
      handler: 'dist/index.handler',
      code: Code.fromAsset(join(__dirname, '../deploy.zip')),
      functionName: 'jira-snooze',
      environment: {
        JIRA_SECRET_ARN: jiraSecretArn,
        REGION: 'us-west-2',
        STS_LLM_ARN: stLlmsArn
      },
      timeout: cdk.Duration.minutes(1)
    });

    // Event Source
    const topicArn = cdk.Fn.importValue('jira-snooze-topic-arn-output')
    const snoozeTopic = Topic.fromTopicArn(this, 'jira-snooze-topic', topicArn);
    snoozeFunction.addEventSource(new SnsEventSource(snoozeTopic))

    // IAM Policy
    snoozeFunction.addToRolePolicy(new PolicyStatement({
      actions: ["secretsmanager:GetSecretValue"],
      effect: Effect.ALLOW,
      resources: [jiraSecretArn]
    }))
    snoozeFunction.addToRolePolicy(new PolicyStatement({
      actions: ["sts:AssumeRole"],
      effect: Effect.ALLOW,
      resources: [stLlmsArn]
    }))
  }
}
