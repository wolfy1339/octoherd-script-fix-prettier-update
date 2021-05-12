module.exports = {
  env: {
    node: true,
    es2021: true
  },
  extends: [
    '@hellomouse/wolfy1339'
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module'
  },
  rules: {
    'no-unused-vars': 1,
    'valid-jsdoc': 0
  }
};
