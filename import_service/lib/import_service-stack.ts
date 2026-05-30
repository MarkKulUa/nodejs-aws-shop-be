import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodeJs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apiGateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as path from 'path';

const UPLOAD_FOLDER = 'uploaded';
const PARSED_FOLDER = 'parsed';

export interface ImportServiceStackProps extends cdk.StackProps {
  /** Name of the existing S3 bucket (created via AWS Console). */
  bucketName?: string;
}

export class ImportServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: ImportServiceStackProps) {
    super(scope, id, props);

    const bucketName =
      props?.bucketName ??
      this.node.tryGetContext('bucketName') ??
      process.env.IMPORT_BUCKET_NAME;

    if (!bucketName) {
      throw new Error(
        'S3 bucket name is required. Pass it via props.bucketName, ' +
          'cdk context "bucketName", or env var IMPORT_BUCKET_NAME.',
      );
    }

    const bucket = s3.Bucket.fromBucketName(this, 'ImportBucket', bucketName);

    // Import the SQS queue created by Product Service
    const catalogItemsQueueArn = cdk.Fn.importValue('CatalogItemsQueueArn');
    const catalogItemsQueueUrl = cdk.Fn.importValue('CatalogItemsQueueUrl');
    const catalogItemsQueue = sqs.Queue.fromQueueArn(
      this,
      'CatalogItemsQueue',
      catalogItemsQueueArn,
    );

    const commonEnv = {
      BUCKET_NAME: bucket.bucketName,
      UPLOAD_FOLDER,
      PARSED_FOLDER,
      SQS_QUEUE_URL: catalogItemsQueueUrl,
    };

    // Lambda: GET /import?name=...
    const importProductsFile = new lambdaNodeJs.NodejsFunction(
      this,
      'ImportProductsFileFunction',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.join(__dirname, '../lambda/importProductsFile.ts'),
        handler: 'handler',
        functionName: 'importProductsFile',
        environment: commonEnv,
      },
    );

    // Lambda: triggered by S3 ObjectCreated:*
    const importFileParser = new lambdaNodeJs.NodejsFunction(
      this,
      'ImportFileParserFunction',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.join(__dirname, '../lambda/importFileParser.ts'),
        handler: 'handler',
        functionName: 'importFileParser',
        environment: commonEnv,
        bundling: {
          // csv-parser is CommonJS; exclude AWS SDK because Lambda runtime provides v3
          externalModules: ['@aws-sdk/*'],
        },
      },
    );

    // IAM grants
    bucket.grantPut(importProductsFile, `${UPLOAD_FOLDER}/*`);
    bucket.grantRead(importFileParser, `${UPLOAD_FOLDER}/*`);
    bucket.grantPut(importFileParser, `${PARSED_FOLDER}/*`);
    bucket.grantDelete(importFileParser, `${UPLOAD_FOLDER}/*`);
    catalogItemsQueue.grantSendMessages(importFileParser);

    // S3 trigger: ObjectCreated:* with prefix filter "uploaded/"
    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(importFileParser),
      { prefix: `${UPLOAD_FOLDER}/` },
    );

    const basicAuthorizerArn = cdk.Fn.importValue('BasicAuthorizerArn');
    const basicAuthorizerFn = lambda.Function.fromFunctionAttributes(
      this,
      'BasicAuthorizerFunction',
      {
        functionArn: basicAuthorizerArn,
        sameEnvironment: true,
      },
    );

    const tokenAuthorizer = new apiGateway.TokenAuthorizer(
      this,
      'BasicTokenAuthorizer',
      {
        handler: basicAuthorizerFn,
        identitySource: apiGateway.IdentitySource.header('Authorization'),
        resultsCacheTtl: cdk.Duration.seconds(0),
      },
    );

    // API Gateway
    const api = new apiGateway.RestApi(this, 'ImportServiceApi', {
      restApiName: 'Import Service',
      defaultCorsPreflightOptions: {
        allowOrigins: apiGateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    api.addGatewayResponse('Unauthorized', {
      type: apiGateway.ResponseType.UNAUTHORIZED,
      statusCode: '401',
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'Content-Type,Authorization'",
      },
    });

    api.addGatewayResponse('AccessDenied', {
      type: apiGateway.ResponseType.ACCESS_DENIED,
      statusCode: '403',
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'Content-Type,Authorization'",
      },
    });

    const validator = api.addRequestValidator('ImportRequestValidator', {
      validateRequestParameters: true,
    });

    const importResource = api.root.addResource('import');
    importResource.addMethod(
      'GET',
      new apiGateway.LambdaIntegration(importProductsFile),
      {
        authorizer: tokenAuthorizer,
        authorizationType: apiGateway.AuthorizationType.CUSTOM,
        requestValidator: validator,
        requestParameters: {
          'method.request.querystring.name': true,
        },
      },
    );

    new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
    new cdk.CfnOutput(this, 'ImportBucketName', { value: bucket.bucketName });
  }
}
