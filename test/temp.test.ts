import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as Stack from '../infra/stacks';

// example test.To run these tests, uncomment this file along with the
// example resource in lib / temp - stack.ts
test('SNS Topic Created', () => {
    const app = new cdk.App();
    const stack = new Stack.SNSStack(app, 'MyTestStack');
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::SNS::Topic', {
        TopicName: "jira-clarifier-topic"
    });
});
// 