# Skeleton project for Swagger

## Installing and runing with cluster
If you are using linux or mac you should install redis.

To enable redis edit `.env` and set `REDIS_ENABLED` to `1`

To install redis follow this instructions

### In UBUNTU:
https://www.digitalocean.com/community/tutorials/how-to-install-and-configure-redis-on-ubuntu-16-04

### In OSX:
https://medium.com/@petehouston/install-and-config-redis-on-mac-os-x-via-homebrew-eb8df9a4f298

### In Windows
Unfortunately redis doesn`t works in windows yet.
But you will be fine if you let disabled REDIS and dont use cluster.

# QUICK START GUIDE

## Setup enviroment

First create a .env file based on .env-dist.

Execute npm install to download node packages

```
$ npm install
```

Execute server with 

```
$ npm start
```

And enjoy!

## Edit Swagger file

```
$ swagger project edit
```

## About Arquitecture

This server was created to work like an REST API and Socket server.

The API server is created using [swagger-node](https://github.com/swagger-api/swagger-node) server and the routes are mapped using swagger yaml file.

The basic structure of endpoints depends of Models, Controllers and Business files. Each one can be found in the correspondent folder.

* MODELS - Database table represented as an object.
* CONTROLLERS - The endpoint first call.
* BUSINESS - Object responsible to care all the server logic.

All the service's main logic must be maintained inside the BUSINESS.

CONTROLLERS must be created only if you need to handle requests or responses properties (HEADERS, BODY, MESSAGES, HTML ERROR CODES ). Otherwise you can create only the BUSINESS and the BaseErrorHandler will try to find one BUSINESS that the name matches the requested controller.

MODELS are a representation of the data in our database

## How to create MODELS

Well we have a shortcut for that :D! 

You can use our scaffold generator (It could be better, but its what we have for now).

To use this scaffolder you must be shure that the entity that you wanna map is not in the Models folder, if so, you have to remove or rename.

The scaffolder also generates a file that maps all the models called ModelsList.js. You must remove this guy too because is going to be regenerated (Or you can add manually the new model that you are adding).

So Lets Generate:

1. Create the table on the database
2. Remove files models/modelList.js and models/index.js
3. Go to the scaffold folder
4. Create the .env file in scalfold
5. Execute the file index.js
```index
$ node .
```

That's all!

# Get me to the WISDOM

Well if you have read this problably you need clearer instructions.

So here are some links to follow:

1. Understanding [MODELS](doc/MODELS.md)!

2. [CONTROLLERS](doc/CONTROLLERS.md) for ALL?

3. Let's talk about [BUSINESS](doc/BUSINESS.md)!

4. Important Modules

    4.1 Input [RETRIEVER](doc/RETRIEVER.md). The man's best friend!

    4.2 Input [VALIDATOR](doc/VALIDATOR.md). Check this out!

    4.3 [MODEL MANAGER (ORM)](doc/MODELMANAGER.md)

5. Execute test for one file with mocha 
 find .node_modules -> ex: /node_modules/.bin/mocha RegisterTest.js --timeout 15000 --exit

6. Execute test for one IT in any test
Importat  
ex: node_modules/.bin/mocha test/NewRegister.js --grep="Exact text from it("Should have....")" --timeout 20000 --exit
If you want to skip a test you can use it :
ex it('Should....') => it.skip('Should...')
