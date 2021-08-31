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
require('dotenv-ts').default()
```

## Feature

load environment variable from [`.env` file](https://hexdocs.pm/dotenvy/dotenv-file-format.html) into `process.env`

supports multiline and variable resolution also

## Notice

There may be any breaking changes before the first stable version.

## License

[MIT](http://vjpr.mit-license.org)

[npm-image]: https://img.shields.io/npm/v/dotenv-ts.svg
[npm-url]: https://npmjs.org/package/dotenv-ts
