module.exports = {
  out: './docs',

  readme: 'README.md',
  exclude: ['**/private/**/*'],
  theme: 'minimal',
  target: 'es6',

  mode: 'modules',
  entrypoint: 'iternal',
  excludeExternals: true,
  excludeNotExported: true,
  excludePrivate: true
}
