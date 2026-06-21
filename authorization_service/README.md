# Authorization Service

AWS CDK stack with the `basicAuthorizer` Lambda used as a Lambda Token Authorizer
for the Import Service `/import` endpoint (Task 7).

## How it works

`basicAuthorizer` receives a `Basic` authorization token, decodes the base64
`login:password` pair and checks it against the lambda environment variables:

- No `Authorization` header → API Gateway responds with **401**
- Invalid credentials → `Deny` IAM policy → API Gateway responds with **403**
- Valid credentials → `Allow` IAM policy → request is forwarded

## Credentials (.env)

Credentials are stored in a local `.env` file (git-ignored) in the form
`{github_login}=PASSWORD` and loaded via `dotenv`:

```
MarkKulUa=TEST_PASSWORD
```

Copy `.env.example` to `.env` before deploying.

## Commands

```bash
npm install
npm run build      # tsc
npm test           # unit tests for basicAuthorizer
npm run cdk deploy # deploy AuthorizationServiceStack
```

## Deploy order

The Import Service references this stack's `BasicAuthorizerArn` export, so deploy
this stack **before** the Import Service:

1. `product_service` (exports the SQS queue)
2. `authorization_service` (exports `BasicAuthorizerArn`)
3. `import_service` (imports both)
