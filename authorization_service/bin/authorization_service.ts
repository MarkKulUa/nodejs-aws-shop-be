#!/usr/bin/env node
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib/core';
import { AuthorizationServiceStack } from '../lib/authorization_service-stack';

const { parsed } = dotenv.config({ path: path.join(__dirname, '../.env') });
const credentials = parsed ?? {};

const app = new cdk.App();
new AuthorizationServiceStack(app, 'AuthorizationServiceStack', {
  credentials,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
