
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",

  transform: {
    "^.+\\.[tj]sx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.test.json"
      }
    ]
  },

  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],

  reporters: [
    "default",
    [
      "jest-html-reporter",
      {
        pageTitle: "Rapport de Tests - LoomFiction",
        outputPath: "./rapport-tests.html",
        includeFailureMsg: true,
        includeConsoleLog: false
      }
    ]
  ]
};
