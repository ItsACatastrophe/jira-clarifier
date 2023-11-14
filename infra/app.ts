#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { SNSStack, LambdaStack } from './stacks';

const app = new cdk.App();
const appName = 'jira-snooze'
const env = { account: '688509701270', region: 'us-west-2' }

const snsStack = new SNSStack(app, 'sns-stack', {
  env: env,
  stackName: `${appName}-sns-stack`
});

const lambdaStack = new LambdaStack(app, 'lambda-stack', {
  env: env,
  stackName: `${appName}-lambda-stack`
});

// lambdaStack.addDependency(snsStack) // Maybe AWS just knows