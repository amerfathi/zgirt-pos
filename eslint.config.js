import globals from 'globals';
export default [{ ignores: ['node_modules/**','dist/**','android/**','work/**'] },{
  files: ['src/**/*.{js,jsx}', 'functions/**/*.js', 'electron/**/*.cjs', 'tests/*.{mjs,cjs,js}'],
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module', parserOptions: {ecmaFeatures:{jsx:true}},
    globals: {...globals.browser,...globals.node} },
  rules: {'no-unreachable':'error','no-constant-condition':'off','no-dupe-args':'error','no-dupe-keys':'error','valid-typeof':'error'}
}];
