const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const Parser = require('tap-parser');
const { DefaultReporter, VerboseReporter, SummaryReporter } = require('@jest/reporters');
const {
    addResult,
    createEmptyTestResult,
    makeEmptyAggregatedTestResult,
    formatTestResults
} = require('@jest/test-result');
const { readConfig } = require('jest-config');
const { printDiffOrStringify } = require('jest-matcher-utils');
const { formatResultsErrors } = require('jest-message-util');

async function createReporter(type) {
    let { projectConfig, globalConfig } = await readConfig(
        {},
        process.cwd()
    );
    let reporters = [new DefaultReporter(globalConfig), new SummaryReporter(globalConfig)];
    return new Reporter(projectConfig, globalConfig, new Parser(), reporters, true);
}

function createTestContext(testFilePath, config) {
    return {
        path: testFilePath,
        context: {
            config,
            path: testFilePath
        }
    };
}

class Reporter {
    constructor(projectConfig, globalConfig, parser, reporters) {
        this.rootParser = parser;
        this.subscribeParser(this.rootParser);

        this.jestConfigs = {
            project: projectConfig,
            global: globalConfig,
        };
        this.aggregatedResults = makeEmptyAggregatedTestResult();
        this.reporters = reporters;
        this.reporters.forEach((reporter) => {
            reporter.onRunStart(
                this.aggregatedResults,
                {
                    estimatedTime: 0,
                    showStatus: true
                }
            );
        });

        this.children = [];
        this.currentResults = null;
    }

    subscribeParser(parser) {
        parser.on('comment', function (comment) {
            let [maybeDirective, maybeFileName] = comment.slice(2).trim().split(' ');
            if (maybeDirective === 'FILE_START') {
                this.currentResults = createEmptyTestResult();
                this.currentResults.testFilePath = maybeFileName;
            } else if (maybeDirective === "FILE_END") {
                addResult(this.aggregatedResults, this.currentResults);
                this.currentResults.failureMessage = formatResultsErrors(
                    this.currentResults.testResults,
                    this.jestConfigs.project,
                    {
                        noStackTrace: false,
                        noCodeFrame: false
                    },
                    this.currentResults.testFilePath
                );

                this.reporters.forEach((reporter) => {
                    reporter.onTestResult(
                        createTestContext(this.currentResults.testFilePath, this.jestConfigs.project),
                        this.currentResults,
                        this.aggregatedResults
                    );
                });
            }
        }.bind(this));

        parser.on('child', function (childParser) {
            this.subscribeParser(childParser);
        }.bind(this));

        parser.on('pass', function (assert) {
            console.log('Pass', assert);
        }.bind(this));

        parser.on('fail', function (assert) {
            let { stack, error, numPassingAsserts } = assert.diag;
            let diff = printDiffOrStringify(error.expected, error.actual, "Expected", "Received");

            // jest expects a specific format for the error message
            let failureMessage = chalk.red(error.message)
                + "\n\n"
                + diff
                + "\n at "
                + error.funcName
                + " "
                + stack.map(line => "(" + line + ")").join("\n");

            let assertionError =
            {
                numPassingAsserts,
                ancestorTitles: [assert.fullname],
                failureDetails: [],
                failureMessages: [failureMessage],
                fullName: assert.name,
                status: "failed",
                title: assert.name,
            };

            this.currentResults.numFailingTests++;
            this.currentResults.testResults.push(assertionError);
        }.bind(this));

        parser.on('extra', function (extra) {
            console.log('Extra', extra);
        }.bind(this));

        parser.on('complete', function (results) {
            console.log("COMPLETE")
            // If the root parser is complete, then we're done.
            if (parser == this.rootParser) {
                // console.log(this.aggregatedResults);
                this.reporters.forEach((reporter) => reporter.onRunComplete(
                    new Set([{ config: this.jestConfigs.project }]),
                    this.aggregatedResults
                ));
                console.log(formatTestResults(this.aggregatedResults));
            }
        }.bind(this));
        parser.on('plan', function (plan) { });
        parser.on('bailout', function (reason) { });
        parser.on('result', function (result) { });
        parser.on('skip', function (assert) { });
        parser.on('todo', function (assert) { });
        parser.on('line', function (line) { });
        parser.on('assert', function (failure) { });
    }
}

let readStrm = fs.createReadStream(path.join(process.cwd(), 'src', 'tap.tap'));

createReporter("default").then(reporter => {
    readStrm.pipe(reporter.rootParser);
});
