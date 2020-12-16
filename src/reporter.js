const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const Parser = require('tap-parser');
const { DefaultReporter, VerboseReporter, SummaryReporter } = require('@jest/reporters');
const {
    addResult,
    createEmptyTestResult,
    makeEmptyAggregatedTestResult
} = require('@jest/test-result');
const { readConfig } = require('jest-config');
const { printDiffOrStringify } = require('jest-matcher-utils');
const { formatResultsErrors } = require('jest-message-util');

module.exports.createReporter = async function(type) {
    console.log("HERE")
    // Generate the necessary configs for Jest
    let { projectConfig, globalConfig } = await readConfig({}, process.cwd());

    let reporters = [new SummaryReporter(globalConfig)];
    if (type === "jest-verbose") {
        reporters.push(new VerboseReporter(globalConfig))
    } else {
        reporters.push(new DefaultReporter(globalConfig))
    }

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
        this.aggregatedResults.startTime = Date.now();

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
        parser.on('comment', this.onComment.bind(this));
        parser.on('fail', this.onTestFailure.bind(this));
        parser.on('complete', this.onParseComplete.bind(this, parser));

        parser.on('child', function (childParser) {
            this.subscribeParser(childParser);
        }.bind(this));

        parser.on('pass', function (assert) {
            console.log(this)
            this.currentResults.numPassingTests++;
            this.addNonFailureTestResult(assert, "pass").bind(this);
        }.bind(this));

        parser.on('skip', function (assert) {
            this.currentResults.numTodoTests++;
            this.addNonFailureTestResult(assert, "skipped");
        }.bind(this));

        parser.on('todo', function (assert) {
            this.currentResults.numTodoTests++;
            this.addNonFailureTestResult(assert, "todo");
        }.bind(this));

        /*
         * In the future, we could subscribe to any of these if we need the information.
         */
        // parser.on('extra', function (extra) { });
        // parser.on('plan', function (plan) { });
        // parser.on('bailout', function (reason) { });
        // parser.on('result', function (result) { });
        // parser.on('line', function (line) { });
        // parser.on('assert', function (failure) { });
    }

    onComment(comment) {
        // Grab the filename, if it exists, from the comment string.
        let [maybeDirective, maybeFileName] = comment.slice(2).trim().split(' ');

        switch (maybeDirective) {
            case "FILE_START":
                this.currentResults = createEmptyTestResult();
                this.currentResults.testFilePath = maybeFileName;
                break;

            case "FILE_END":
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
                break;
            default:
        }
    }

    addNonFailureTestResult(assert, status) {
        let assertion = {
            status,
            title: assert.name,
            fullName: assert.name,
            ancestorTitles: [assert.fullname],
            failureMessages: [],
        };

        this.currentResults.numPassingTests++;
        this.currentResults.testResults.push(assertion);
    }

    onTestFailure(assert) {
        let { stack, error } = assert.diag;
        let diff = printDiffOrStringify(error.expected, error.actual, "Expected", "Received");

        // jest expects a specific format for the error message
        let failureMessage = chalk.red(error.message)
            + "\n\n"
            + diff
            + "\n"
            + stack.map((line, index) => {
                if (index === 0) {
                    return "at " + error.funcName + " (" + line + ")";
                } else {
                    return "at " + line;
                }
            }).join("\n");

        let assertion = {
            status: "failed",
            title: assert.name,
            fullName: assert.name,
            ancestorTitles: [assert.fullname],
            failureMessages: [failureMessage],
        };

        this.currentResults.numFailingTests++;
        this.currentResults.testResults.push(assertion);
    }

    onParseComplete(parser, results) {
        // If the root parser is complete, then we're done.
        if (parser == this.rootParser) {
            this.reporters.forEach((reporter) => {
                reporter.onRunComplete(
                    new Set([{ config: this.jestConfigs.project }]),
                    {
                        ...this.aggregatedResults,
                        numTotalTestSuites: 25
                    }
                );
            });
        }
    }
}

// let readStrm = fs.createReadStream(path.join(process.cwd(), 'src', 'tap.tap'));

// createReporter("default").then(reporter => {
//     readStrm.pipe(reporter.rootParser);
// });
