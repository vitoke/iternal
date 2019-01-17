module.exports = {
  out: './docs',

  readme: 'README.md',
  exclude: ['**/private/**/*'],
  target: 'es6',

  mode: 'modules',
  entrypoint: 'iternal',
  excludeExternals: true,
  excludeNotExported: true,
  excludePrivate: true
}
