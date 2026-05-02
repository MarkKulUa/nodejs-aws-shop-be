import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as lambdaNodeJs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apiGateway from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';

export class ProductServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

      // Lambda for getProductsList
      const getProductsList = new lambdaNodeJs.NodejsFunction(this, 'GetProductsListFunction', {
          runtime: lambda.Runtime.NODEJS_24_X,
          entry: path.join(__dirname, '../lambda/getProductsList.ts'),
          handler: 'handler',
          functionName: 'getProductsList',
      });

      // Lambda for getProductsById
      const getProductsById = new lambdaNodeJs.NodejsFunction(this, 'GetProductsByIdFunction', {
          runtime: lambda.Runtime.NODEJS_24_X,
          entry: path.join(__dirname, '../lambda/getProductsById.ts'),
          handler: 'handler',
          functionName: 'getProductsById',
      });

      // API Gateway
      const api = new apiGateway.RestApi(this, 'ProductServiceApi', {
          restApiName: 'Product Service',
          defaultCorsPreflightOptions: {
              allowOrigins: apiGateway.Cors.ALL_ORIGINS,
              allowMethods: apiGateway.Cors.ALL_METHODS,
          },
      });

      // Routes
      const productsResource = api.root.addResource('products');
      productsResource.addMethod('GET', new apiGateway.LambdaIntegration(getProductsList));

      const productByIdResource = productsResource.addResource('{productId}');
      productByIdResource.addMethod('GET', new apiGateway.LambdaIntegration(getProductsById));

      // Output URL
      new cdk.CfnOutput(this, 'ApiUrl', {
          value: api.url,
      });
  }
}
