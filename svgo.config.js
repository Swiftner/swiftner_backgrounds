module.exports = {
  multipass: true,
  floatPrecision: 1,
  js2svg: { pretty: false },
  plugins: [
    { name: 'preset-default', params: { overrides: { cleanupIds: false } } },
    'reusePaths',
  ],
};
