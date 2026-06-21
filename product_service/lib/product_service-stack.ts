import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as lambdaNodeJs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apiGateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as path from 'path';

const PRODUCTS_TABLE_NAME = 'products';
const STOCKS_TABLE_NAME = 'stocks';

export class ProductServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Reference existing DynamoDB tables created via AWS Console
    const productsTable = dynamodb.Table.fromTableName(
      this,
      'ProductsTable',
      PRODUCTS_TABLE_NAME,
    );
    const stocksTable = dynamodb.Table.fromTableName(
      this,
      'StocksTable',
      STOCKS_TABLE_NAME,
    );

    // ─── SQS Queue ───────────────────────────────────────────────────────
    const catalogItemsQueue = new sqs.Queue(this, 'CatalogItemsQueue', {
      queueName: 'catalogItemsQueue',
    });

    // ─── SNS Topic ───────────────────────────────────────────────────────
    const createProductTopic = new sns.Topic(this, 'CreateProductTopic', {
      topicName: 'createProductTopic',
    });

    // Email subscription (main)
    createProductTopic.addSubscription(
      new snsSubscriptions.EmailSubscription('mark.kulishenko@gmail.com'),
    );

    // Additional subscription with filter policy (for large batches, 5+ products)
    createProductTopic.addSubscription(
      new snsSubscriptions.EmailSubscription('mark.kulishenko+bulk@gmail.com', {
        filterPolicy: {
          count: sns.SubscriptionFilter.numericFilter({ greaterThanOrEqualTo: 5 }),
        },
      }),
    );

    // ─── Common Lambda Environment ───────────────────────────────────────
    const commonLambdaEnv = {
      PRODUCTS_TABLE: PRODUCTS_TABLE_NAME,
      STOCKS_TABLE: STOCKS_TABLE_NAME,
    };

    // Lambda: GET /products
    const getProductsList = new lambdaNodeJs.NodejsFunction(this, 'GetProductsListFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/getProductsList.ts'),
      handler: 'handler',
      functionName: 'getProductsList',
      environment: commonLambdaEnv,
    });

    // Lambda: GET /products/{productId}
    const getProductsById = new lambdaNodeJs.NodejsFunction(this, 'GetProductsByIdFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/getProductsById.ts'),
      handler: 'handler',
      functionName: 'getProductsById',
      environment: commonLambdaEnv,
    });

    // Lambda: POST /products
    const createProduct = new lambdaNodeJs.NodejsFunction(this, 'CreateProductFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/createProduct.ts'),
      handler: 'handler',
      functionName: 'createProduct',
      environment: commonLambdaEnv,
    });

    // Lambda: SQS trigger — catalogBatchProcess
    const catalogBatchProcess = new lambdaNodeJs.NodejsFunction(this, 'CatalogBatchProcessFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/catalogBatchProcess.ts'),
      handler: 'handler',
      functionName: 'catalogBatchProcess',
      environment: {
        ...commonLambdaEnv,
        SNS_TOPIC_ARN: createProductTopic.topicArn,
      },
    });

    // SQS event source with batchSize = 5
    catalogBatchProcess.addEventSource(
      new lambdaEventSources.SqsEventSource(catalogItemsQueue, {
        batchSize: 5,
      }),
    );

    // ─── IAM Grants ──────────────────────────────────────────────────────
    productsTable.grantReadData(getProductsList);
    stocksTable.grantReadData(getProductsList);

    productsTable.grantReadData(getProductsById);
    stocksTable.grantReadData(getProductsById);

    productsTable.grantWriteData(createProduct);
    stocksTable.grantWriteData(createProduct);

    productsTable.grantWriteData(catalogBatchProcess);
    stocksTable.grantWriteData(catalogBatchProcess);

    createProductTopic.grantPublish(catalogBatchProcess);

    // ─── API Gateway ─────────────────────────────────────────────────────
    const api = new apiGateway.RestApi(this, 'ProductServiceApi', {
      restApiName: 'Product Service',
      defaultCorsPreflightOptions: {
        allowOrigins: apiGateway.Cors.ALL_ORIGINS,
        allowMethods: apiGateway.Cors.ALL_METHODS,
      },
    });

    const productsResource = api.root.addResource('products');
    productsResource.addMethod('GET', new apiGateway.LambdaIntegration(getProductsList));
    productsResource.addMethod('POST', new apiGateway.LambdaIntegration(createProduct));

    const productByIdResource = productsResource.addResource('{productId}');
    productByIdResource.addMethod('GET', new apiGateway.LambdaIntegration(getProductsById));

    // ─── Outputs ─────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
    });

    new cdk.CfnOutput(this, 'CatalogItemsQueueUrl', {
      value: catalogItemsQueue.queueUrl,
      exportName: 'CatalogItemsQueueUrl',
    });

    new cdk.CfnOutput(this, 'CatalogItemsQueueArn', {
      value: catalogItemsQueue.queueArn,
      exportName: 'CatalogItemsQueueArn',
    });

    new cdk.CfnOutput(this, 'CreateProductTopicArn', {
      value: createProductTopic.topicArn,
    });
  }
}
