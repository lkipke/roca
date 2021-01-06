import * as path from "path";
import Parser = require("tap-parser");
import {
    DefaultReporter,
    VerboseReporter,
    SummaryReporter,
    BaseReporter,
    AggregatedResult,
    TestResult,
} from "@jest/reporters";
import {
    addResult,
    createEmptyTestResult,
    makeEmptyAggregatedTestResult,
    Status,
} from "@jest/test-result";
import { formatExecError, formatResultsErrors } from "jest-message-util";
import {
    Assert,
    createAssertionResult,
    createContext,
    createFailureMessage,
} from "./utils";
import type { Config } from "@jest/types";

export class JestReporter {
    /** Aggregated results from all test files. */
    private aggregatedResults: AggregatedResult;
    /** The results from the test file that is currently being run. */
    private currentResults: TestResult = createEmptyTestResult();
    /** List of Jest reporters to use. */
    private reporters: BaseReporter[];

    constructor(
        readonly reporterStream: NodeJS.WriteStream & any,
        private projectConfig: Config.ProjectConfig,
        globalConfig: Config.GlobalConfig,
        reporterType: string
    ) {
        this.subscribeToParser(reporterStream);

        // Create aggregated results for reporting
        this.aggregatedResults = makeEmptyAggregatedTestResult();
        this.aggregatedResults.startTime = Date.now();

        // Create a summary reporter and either a default or verbose reporter.
        this.reporters = [new SummaryReporter(globalConfig)];
        if (reporterType === "jest-verbose") {
            this.reporters.push(new VerboseReporter(globalConfig));
        } else {
            this.reporters.push(new DefaultReporter(globalConfig));
        }

        // Tell the reporters we're starting our test run.
        this.reporters.forEach((reporter) => {
            reporter.onRunStart(this.aggregatedResults, {
                estimatedTime: 0,
                showStatus: true,
            });
        });
    }

    /**
     * Subscribe to a TAP Parser's events.
     * @param parser Parser instance to subscribe
     */
    protected subscribeToParser(parser: Parser) {
        parser.on("fail", this.onTestFailure.bind(this));
        parser.on("complete", this.onParseComplete.bind(this, parser));
        parser.on("child", this.subscribeToParser.bind(this));

        parser.on("pass", (assert: Assert) => {
            this.currentResults.numPassingTests++;
            this.addNonFailureTestResult(assert, "passed");
        });

        parser.on("skip", (assert: Assert) => {
            this.currentResults.numTodoTests++;
            this.addNonFailureTestResult(assert, "skipped");
        });

        parser.on("todo", (assert: Assert) => {
            this.currentResults.numTodoTests++;
            this.addNonFailureTestResult(assert, "todo");
        });

        parser.on("extra", (extra: string) => {
            if (!this.currentResults.console) {
                this.currentResults.console = [];
            }
            this.currentResults.console.push({
                message: extra,
                origin: "",
                type: "info",
            });
        });

        /*
         * In the future, we could subscribe to any of these if we need the information.
         */
        // parser.on("comment", this.onComment.bind(this));
        // parser.on('plan', function (plan) { });
        // parser.on('bailout', function (reason) { });
        // parser.on('result', function (result) { });
        // parser.on('line', function (line) { });
        // parser.on('assert', function (failure) { });
    }

    /**
     * Callback for when brs encounters an execution error.
     * @param reason The error that was thrown to cause the execution error
     */
    public onFileExecError(reason: any) {
        // If we get an array of errors, report the first one.
        reason = Array.isArray(reason) ? reason[0] : reason;

        // If it's a BrsError, use those fields.
        if (reason.location && reason.message) {
            this.currentResults.testExecError = {
                stack: `at null:0:0\nat ${reason.location.file}:${reason.location.start.line}:${reason.location.start.column}`,
                message: `${reason.message}`,
            };
        } else {
            this.currentResults.testExecError = {
                stack: null,
                message: `${reason}`,
            };
        }
    }

    /**
     * Callback for when a file starts test execution. Creates empty results
     * for the new file and sets it as the current results for this parser.
     * @param filePath The path to the file that is starting its run.
     */
    public onFileStart(filePath: string) {
        this.currentResults = createEmptyTestResult();
        this.currentResults.testFilePath = path.join(process.cwd(), filePath);
    }

    /**
     * Callback for when a file ends execution. Adds the results from the current
     * file to the aggregated results, and tells each Jest reporter that this file has completed.
     */
    public onFileEnd() {
        // Flatten console output because tap-parser splits output by newline,
        // so we don't know which lines are supposed to go together.
        if (this.currentResults.console) {
            this.currentResults.console = [
                {
                    message: this.currentResults.console
                        .map((entry) => entry.message)
                        .join(""),
                    origin: "",
                    type: "info",
                },
            ];
        }

        if (this.currentResults.testExecError) {
            this.currentResults.failureMessage = formatExecError(
                this.currentResults.testExecError,
                this.projectConfig,
                { noStackTrace: false, noCodeFrame: false }
            );
        } else {
            // Generate the failure message if there is one.
            this.currentResults.failureMessage = formatResultsErrors(
                this.currentResults.testResults,
                this.projectConfig,
                {
                    noStackTrace: false,
                    noCodeFrame: false,
                },
                this.currentResults.testFilePath
            );
        }

        // Add our file results to the overall aggregated results
        addResult(this.aggregatedResults, this.currentResults);

        // Tell our reporters that this file is complete.
        this.reporters.forEach((reporter) => {
            reporter.onTestResult(
                {
                    path: this.currentResults.testFilePath,
                    context: createContext(this.projectConfig),
                },
                this.currentResults,
                this.aggregatedResults
            );
        });
    }

    /**
     * Utility function for non-failed test results.
     * @param assert Metadata object about the failed test.
     * @param status The test result status
     */
    protected addNonFailureTestResult(assert: Assert, status: Status) {
        this.currentResults.numPassingTests++;
        this.currentResults.testResults.push(
            createAssertionResult(status, assert.name, assert.fullname)
        );
    }

    /**
     * Callback when a test case fails.
     * @param assert Metadata object about the failed test.
     */
    protected onTestFailure(assert: Assert) {
        let failureMessage = assert.diag
            ? createFailureMessage(assert.diag)
            : "Test case failed";

        // Add the failed test case to our ongoing results.
        this.currentResults.numFailingTests++;
        this.currentResults.testResults.push(
            createAssertionResult(
                "failed",
                assert.name,
                assert.fullname,
                failureMessage
            )
        );
    }

    /**
     * Callback for when a Parser finishes parsing its segment of TAP output.
     * @param parser The Parser instance that completed.
     */
    protected onParseComplete(parser: Parser, results: any) {
        // If the root parser is complete, then tell the reporters that we're done.
        if (parser === this.reporterStream) {
            this.reporters.forEach((reporter) => {
                reporter.onRunComplete(
                    new Set([createContext(this.projectConfig)]),
                    this.aggregatedResults
                );
            });
        }
    }
}

// let readStrm = fs.createReadStream(path.join(process.cwd(), 'src', 'tap.tap'));

// createReporter("jest-verbose").then(reporter => {
//     readStrm.pipe(reporter.reporterStream);
// });
