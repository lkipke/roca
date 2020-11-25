const Parser = require('tap-parser');
const { Stream } = require('stream');
const JestReporter = require('@jest/reporters');
const JestConsole = require('@jest/console');
const JestMessageUtil = require('jest-message-util');
const JestMatcherUtils = require('jest-matcher-utils');
const JestConfig = require('jest-config');
const chalk = require('chalk');
const fs = require('fs');

let testFilePath =
  '/Users/levikipke/Projects/cheese-please/__tests__/App-test.js:22:10';

async function createReport() {
  let { projectConfig, globalConfig } = await JestConfig.readConfig(
    {},
    process.cwd()
  );

  const reporter = new JestReporter.VerboseReporter(globalConfig);
  reporter.onRunStart();
  reporter.onTestStart({
    path: testFilePath,
    context: {
      path: testFilePath,
      config: projectConfig,
    },
  });
  reporter.onTestResult(
    {
      path: testFilePath,
      context: {
        path: testFilePath,
        config: projectConfig,
      },
    },
    {
      console: [
        {
          message: 'failure message',
          origin: testFilePath,
          type: 'error',
        },
      ],
      numFailingTests: 2,
      numPassingTests: 2,
      leaks: false,
      numPendingTests: 2,
      numTodoTests: 2,
      openHandles: [],
      perfStats: {
        end: 10,
        runtime: 10,
        slow: false,
        start: 0,
      },
      skipped: false,
      testFilePath: testFilePath,
      testResults: [],
      snapshot: {
        added: 0,
        fileDeleted: false,
        matched: 0,
        unchecked: 0,
        uncheckedKeys: [],
        unmatched: 0,
        updated: 0,
      },
    },
    {
      numFailedTests: 3,
      numFailedTestSuites: 1,
      numPassedTests: 4,
      numPassedTestSuites: 2,
      numPendingTests: 5,
      numTodoTests: 3,
      numPendingTestSuites: 7,
      numRuntimeErrorTestSuites: 1,
      numTotalTests: 15,
      numTotalTestSuites: 11,
      openHandles: [],
      snapshot: {
        added: 0,
        didUpdate: false,
        failure: false,
        filesAdded: 0,
        filesRemoved: 0,
        filesRemovedList: [],
        filesUnmatched: 0,
        filesUpdated: 0,
        matched: 0,
        total: 0,
        unchecked: 0,
        uncheckedKeysByFile: [],
        unmatched: 0,
        updated: 0,
      },
      startTime: 1,
      success: true,
      testResults: [],
      wasInterrupted: false,
    }
  );
  reporter.onRunComplete();
}
createReport();

function initializeTestResult() {}
