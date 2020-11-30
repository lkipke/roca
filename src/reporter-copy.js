const Parser = require('tap-parser');
const { Stream } = require('stream');
const JestReporter = require('@jest/reporters');
const JestConsole = require('@jest/console');
const JestMessageUtil = require('jest-message-util');
const JestMatcherUtils = require('jest-matcher-utils');
const JestConfig = require('jest-config');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

let INDENT_STR = '  ';

function getIndent(indent) {
  let childIndent = '';
  for (let i = 0; i < indent; i++) {
    childIndent += INDENT_STR;
  }

  return childIndent;
}

function createReporterStream() {
  const parser = new Parser();
  subscribeParser(parser, 0);
  return parser;
}

async function createReporter() {
  let { projectConfig, globalConfig } = await JestConfig.readConfig(
    {},
    process.cwd()
  );
  return new Reporter(projectConfig, globalConfig);
}

class Reporter extends Parser {
  constructor(projectConfig, globalConfig) {
    super();
    this.subscribe();

    this.jestConfigs = {
      project: projectConfig,
      global: globalConfig,
    };
    this.reporter = new JestReporter.DefaultReporter(globalConfig);

    this.testResults = [];
    this.currentRun = {};
    this.initializeAggregatedResults();
  }

  subscribe() {
    parser.on('complete', function (results) {
      indent--;
      console.log('complete');
      console.log(results);
    });
    parser.on('line', function (line) {});
    parser.on('assert', function (failure) {});
    parser.on('comment', function (comment) {
      let commentParts = comment.slice(2).split(' ');
      if (commentParts[0] === 'RUN_START') {
        this.currentRun = {
          path: commentParts[1],
          context: {
            path: commentParts[1],
            config: this.jestConfigs.project,
          },
        };

        this.reporter.onRunStart();
      }
    });
    parser.on('plan', function (plan) {});
    parser.on('bailout', function (reason) {});
    parser.on('child', function (childParser) {
      console.log('Child');
      subscribeParser(childParser, indent + 1);
    });
    parser.on('result', function (result) {
      // output("Result", result)
    });
    parser.on('pass', function (assert) {
      output('Pass', assert);
    });
    parser.on('fail', function (assert) {
      output('Fail', assert.diag.stack);
      this.reporter.onTestResult(this.currentRun);
    });
    parser.on('skip', function (assert) {});
    parser.on('todo', function (assert) {});
    parser.on('extra', function (extra) {
      output('Extra', extra);
    });
  }

  initializeAggregatedResults() {
    this.aggregatedResults = {
      numFailedTests: 0,
      numFailedTestSuites: 0,
      numPassedTests: 0,
      numPassedTestSuites: 0,
      numPendingTests: 0,
      numTodoTests: 0,
      numPendingTestSuites: 0,
      numRuntimeErrorTestSuites: 0,
      numTotalTests: 0,
      numTotalTestSuites: 0,
      openHandles: [],
      startTime: 0,
      success: true,
      testResults: [],
      wasInterrupted: false,
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
    };
  }
}

module.exports.createReporterStream = createReporterStream;

fs.createReadStream(path.join(process.cwd(), 'src', 'tap.tap')).pipe(
  createReporterStream()
);
