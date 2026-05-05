# @m234/config

[![npm version](https://img.shields.io/npm/v/@m234/config.svg?style=flat)](https://www.npmjs.com/package/@m234/config)
[![npm downloads](https://img.shields.io/npm/dm/@m234/config.svg?style=flat)](https://www.npmjs.com/package/@m234/config)
[![github](https://img.shields.io/github/stars/Mopsgamer/config.svg?style=flat)](https://github.com/Mopsgamer/config)
[![github issues](https://img.shields.io/github/issues/Mopsgamer/config.svg?style=flat)](https://github.com/Mopsgamer/config/issues)

Node.js config library for command-line tools with strict [Zod](https://zod.dev/) validation.

## Features

- Uses Zod schemas for robust type validation and default values.
- Built-in integrations for popular CLI frameworks: **Commander**, **Yargs**, and **CAC**.
- Syntax-highlighted output for CLI inspection.
- Supports custom parsers (JSON, YAML, etc.).

## Install

```bash
npm i @m234/config zod
```

## Usage

```ts
import {join} from "node:path"
import {homedir} from "node:os"
import {Config, Types} from "@m234/config"

const schema = Types.object({
    id: Types.number().min(0).default(0),
    password: Types.string().min(8),
    records: Types.array(Types.enum(['a', 'b'])).default([])
})

const cfg = new Config({
    path: join(homedir(), 'app.json'),
    schema
})

const error = cfg.failLoad()
if (error) {
    console.error(error)
    process.exit(1)
}

console.log(cfg.get('id'))
console.log(cfg.getPrintable())
```

## CLI Integrations

### Commander

```ts
import { program } from 'commander'
import { initCommand } from '@m234/config/integration/commander'

initCommand(cfg, program)
program.parse()
```

### Yargs

```ts
import yargs from 'yargs'
import { initYargs } from '@m234/config/integration/yargs'

initYargs(yargs(process.argv.slice(2)), cfg).parse()
```

### CAC

```ts
import cac from 'cac'
import { initCAC } from '@m234/config/integration/cac'

const cli = cac()
initCAC(cli, cfg)
cli.parse()
```
