# @m234/config

[![npm version](https://img.shields.io/npm/v/@m234/config.svg?style=flat)](https://www.npmjs.com/package/@m234/config)
[![npm downloads](https://img.shields.io/npm/dm/@m234/config.svg?style=flat)](https://www.npmjs.com/package/@m234/config)
[![github](https://img.shields.io/github/stars/Mopsgamer/config.svg?style=flat)](https://github.com/Mopsgamer/config)
[![github issues](https://img.shields.io/github/issues/Mopsgamer/config.svg?style=flat)](https://github.com/Mopsgamer/config/issues)

Node.js config library for command-line tools with strict type check.

## Features

- Type checks while loading the config: any, string, record, struct, integer, number, boolean.

## Install

```bash
npm i @m234/config
```

## Usage

```ts
import {homedir} from "node:os"
import {exit} from "node:process"
import {join} from "node:path"
import {Config, Types as ConfigTypes} from "@m234/config"

function exitFail(message: string | undefined) {
    console.error(message)
    process.exit(1)
}

const cfg = new Config(join(homedir(), 'app.yaml'))
cfg.setValidator('name', Types.string())
exitFail(cfg.failLoad())

console.log(cfg.get('name'))
```
