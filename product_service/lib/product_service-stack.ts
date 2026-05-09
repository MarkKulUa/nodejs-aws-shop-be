import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as lambdaNodeJs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apiGateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
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

    // IAM grants
    productsTable.grantReadData(getProductsList);
    stocksTable.grantReadData(getProductsList);

    productsTable.grantReadData(getProductsById);
    stocksTable.grantReadData(getProductsById);

    productsTable.grantWriteData(createProduct);
    stocksTable.grantWriteData(createProduct);

    // API Gateway
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

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
    });
  }
}
