#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { SNSStack, LambdaStack } from './stacks';

const app = new cdk.App();
const appName = 'jira-clarifier'
const env = { account: process.env.AWS_ACCOUNT_ID, region: process.env.AWS_REGION }

new SNSStack(app, 'sns-stack', {
  env: env,
  stackName: `${appName}-sns-stack`
});

new LambdaStack(app, 'lambda-stack', {
  env: env,
  stackName: `${appName}-lambda-stack`
});

// lambdaStack.addDependency(snsStack) // Maybe AWS just knows
// 