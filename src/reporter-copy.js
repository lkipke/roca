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

class Reporter extends Parser {
  constructor() {
    super();
    this.reporter = new JestReporter.DefaultReporter();
    this.subscribe();
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
      console.log(commentParts);
      if (commentParts[0] === 'RUN_START') {
        console.log('file path');
        console.log(commentParts[1]);
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
    });
    parser.on('skip', function (assert) {});
    parser.on('todo', function (assert) {});
    parser.on('extra', function (extra) {
      output('Extra', extra);
    });
  }
}

module.exports.createReporterStream = createReporterStream;

fs.createReadStream(path.join(process.cwd(), 'src', 'tap.tap')).pipe(
  createReporterStream()
);
