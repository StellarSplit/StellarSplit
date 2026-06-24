/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  // Mirror the tsconfig `@/*` -> `./src/*` path alias so jest can resolve
  // modules that import via `@/...` (baseUrl: ./src, paths: { "@/*": ["./*"] }).
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};
