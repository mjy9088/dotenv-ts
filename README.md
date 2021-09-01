# dotenv-ts

> load environment variables from .env file, into process.env

[![NPM Version][npm-image]][npm-url]

## Install

in production mode, use real environment variables instead

```bash
npm i -D dotenv-ts
```

## Usage

```javascript
require('dotenv-ts').config()
```

or with options

```javascript
require('dotenv-ts').config(options)
```

## Options

|Key|required|Type|Default|Description|
|-:|:-:|-|-|:-|
|dirname|no|string|`process.cwd()`|path to find `.env` file|
|mode|no|string|`process.env.NODE_ENV` or `"dev"`|mode to determine additional `.env` file's name. one of `prod`, `dev`, `test`, `debug`|
|canOverwrite|no|boolean|false|specify whether `.env` variables can overwrite `process.env`. if not, conflicting key will logged and not applied.|
|priority|**yes**|`"local"` or `"mode"` or undefined|`"local"`|determines which file's value will be used when `.env.${mode}` and `.env.local` has same key. if unspecified(undefined) and has conflicting key, error will thrown|
|variables|no|Object|`process.env`|key-value store for variables - used to resolve variables|
|shareVariables|**yes**|boolean|true|share variables cross file (can reference variable in another file)|

Required options' default value is used if no option provided.

**WARN**: If option object is passed but required option is not set, _the value will be `undefined`_ which can lead to unexpected behavior

## Feature

load environment variable from [`.env` file](https://hexdocs.pm/dotenvy/dotenv-file-format.html) into `process.env`

supports multiline and variable resolution also

## Notice

There may be any breaking changes before the first stable version.

## License

[MIT](./LICENSE)

[npm-image]: https://img.shields.io/npm/v/dotenv-ts.svg
[npm-url]: https://npmjs.org/package/dotenv-ts
