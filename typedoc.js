module.exports = {
  out: './docs',

  readme: 'README.md',
  exclude: ['**/private/**/*'],
  theme: 'minimal',
  target: 'es6',

  mode: 'file',
  excludeExternals: true,
  excludeNotExported: true,
  excludePrivate: true
}
