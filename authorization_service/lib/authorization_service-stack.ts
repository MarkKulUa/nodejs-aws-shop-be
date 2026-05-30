import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodeJs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';

export interface AuthorizationServiceStackProps extends cdk.StackProps {
  /**
   * User credentials forwarded to the basicAuthorizer lambda as environment
   * variables. Each entry is `{github_login}: password`. Loaded from the .env
   * file by the CDK app entry point (bin).
   */
  credentials: Record<string, string>;
}

export class AuthorizationServiceStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: AuthorizationServiceStackProps,
  ) {
    super(scope, id, props);

    const { credentials } = props;

    if (Object.keys(credentials).length === 0) {
      throw new Error(
        'No credentials found. Create a ".env" file with ' +
          '"{github_login}=TEST_PASSWORD" (see .env.example).',
      );
    }

    const basicAuthorizer = new lambdaNodeJs.NodejsFunction(
      this,
      'BasicAuthorizerFunction',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.join(__dirname, '../lambda/basicAuthorizer.ts'),
        handler: 'handler',
        functionName: 'basicAuthorizer',
        environment: credentials,
      },
    );

    new cdk.CfnOutput(this, 'BasicAuthorizerArn', {
      value: basicAuthorizer.functionArn,
      exportName: 'BasicAuthorizerArn',
    });

    new cdk.CfnOutput(this, 'BasicAuthorizerName', {
      value: basicAuthorizer.functionName,
    });
  }
}
