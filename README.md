# @m234/config

[![npm version](https://img.shields.io/npm/v/@m234/config.svg?style=flat)](https://www.npmjs.com/package/@m234/config)
[![npm downloads](https://img.shields.io/npm/dm/@m234/config.svg?style=flat)](https://www.npmjs.com/package/@m234/config)
[![github](https://img.shields.io/github/stars/Mopsgamer/config.svg?style=flat)](https://github.com/Mopsgamer/config)
[![github issues](https://img.shields.io/github/issues/Mopsgamer/config.svg?style=flat)](https://github.com/Mopsgamer/config/issues)

Node.js config library for command-line tools with strict type check. Uses yaml format.

## Features

- Validates the config types when loading: any, string, record, struct, integer, number, boolean.
- Each type has options. For examlple there is the 'pattern' option for strings and numbers.
- Struct type has dynamic properties validation ability.

## Install

```bash
npm i @m234/config
```

## Usage

```ts
import {homedir} from "node:os"
import {exit} from "node:process"
import {join} from "node:path"
import {Config, Types} from "@m234/config"

function exitFail(message: string | undefined) {
    console.error(message)
    process.exit(1)
}

const cfg = new Config({
    path: join(homedir(), 'app.yaml'), // or use `find-config` package
    type: {
        id: Types.integer({min: 0})
        // min 8 chars password
        password: Types.string({pattern: /.{8,}/})
        records: Types.array({elementType: Types.struct({
            label: Types.string()
            // ...
        })})
    }
})

exitFail(cfg.failLoad())
console.log(cfg.get('name'))
```
