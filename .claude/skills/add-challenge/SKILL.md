---
name: add-challenge
description: Scaffold a challenge in this git repository
argument-hint: <blog-name> <programming-language> <stack>
---

For enums strictly follow documentation.

# Add challenge

Scaffold a new challenge in this git repository. Steps are as follows

## Step 1: create folder structure

1. create a folder with name format `challenge-[id]` where id is a short `-` separated name derived from `challenge-name` arguement
2. inside the folder created preceing create `.nurburgdev` directory and a file `.nurburgdev/README.md`
3. in `.nurburgdev/README.md` add frontmatter with the following format

```md
---
title: "Your experiment title"
author: "Author Name"
authorLink: "https://github.com/your-handle"
authorTitle: "Software Engineer"
summary: "One-sentence description shown in listings"
publishedOn: 2024-06-01
tags: [redis, scalability]
intent: "challenge"
draft: true
challengeDetails:
  id: 1234
  difficulty: "medium"
  points: 100
  language: "go"
---
```
For `id` in `challengeDetails` in frontmatter - scan `challenge-*/.nurburgdev/README.md` for the max value in front matter. new id should be 1 more that.

### Rules to follow

1. Complete list of tags can be found in `docs/specification-for-experiments.md` file
2. In body of the markdown never use `h1` or `#` heading. Use `##` or `###` or `####` or `#####` or `#####`  
3. Intent should be challenge
4. challengeDetails are required.

## Step 2: Create `.nurburgdev/experiment.toml`

Read `docs/specification-for-experiments.md` the section `Format of an experiment` to understand how to format this file. Consider `<programming-language>` and `<stack>` arguements to create this file.

### Rules to follow

1. all paths in `.nurburgdev/experiment.toml` should be from the from folder created in step 1 as base. Never from the git root as base.
2. all paths in `.nurburgdev/experiment.toml` should not start with `./`. for example `.nurburgdev/traffic.js` is correct. `./.nurburgdev/traffic.js` is not correct.

## Step 3: Create `Procfile`

Read `docs/specification-for-experiments.md` the section `Procfile` to understand how to create `Procfile`.

## Step 3: Scaffold an http project in as few files as possible

Any project created should have 1 endpoint `/healthcheck` api

### For go project

1. `go.mod`
2. `go.sum`
3. `src/main.go` with a `/healthcheck` api
4. `.gitignore`

### For typescript or node project

1. `packge.json` and `package-lock.json`
2. `src/index.ts` - use express for http service
3. `.gitignore`

### For python

1. `requirements.txt`
2. `src/index.py` - use fastapi for http service 
3. `.gitignore`

### For java

1. `pom.xml`
2. `src` folder with package `dev.nurburg` with an springboot 1 file http service. The class should be named main
3. .gitignore

## Step 4: Create `.nurburgdev/traffic.js`

This is a k6 load tests. Create a 10 second loadtest on `/healthcheck` api. 

### Rules to follow

1. Assume a `HOST` env var will be provided. Use this env var for creating urls. 
2. `HOST` env var will be of the format `http://host:port` format. NOT `host:post` or `http://host:port/`. create the urls accordingly.


## Step 5: Create `.nurburgdev/apitest.tavern.yaml`

This is a tavern test file. create 1 test on `/heatlhcheck` which just expects status code 200

### Rules to follow

1. Assume a `HOST` env var will be provided. Use this env var for creating urls. 
2. `HOST` env var will be of the format `http://host:port` format. NOT `host:post` or `http://host:port/`. create the urls accordingly.

## Step 6: Setup devcontainer in the challenge folder created in step 1

Change directory to the challenge directory and run `nd devcontainer --features=<comma-separated-features>`.  Replace `<comma-separated-features>` with a list of features inferred from <programming-language> <stack> arguements. allowed list of features are 
    1. `postgresql`
	  2. `mysql`
	  3. `kafka`
	  4. `typescript`
	  5. `go`
	  6. `java`
	  7. `python`
	  8. `temporal`


## Few conventions
1. in experiment.toml env should be inline
2. in experiment.toml kafka topics should be inline
