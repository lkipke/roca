import * as path from "path";
import * as fs from "fs";
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
import { readConfig } from "jest-config";
import type { Config } from "@jest/types";

export async function createReporter(
    type: JestReporterType
): Promise<Reporter> {
    // Let Jest generate the global and project that it'll use for reporting.
    let { projectConfig, globalConfig } = await readConfig(
        {} as Config.Argv,
        process.cwd()
    );

    // Create a summary reporter and either a default or verbose reporter.
    let reporters: BaseReporter[] = [new SummaryReporter(globalConfig)];
    if (type === "jest-verbose") {
        reporters.push(new VerboseReporter(globalConfig));
    } else {
        reporters.push(new DefaultReporter(globalConfig));
    }

    return new Reporter(new Parser(), projectConfig, reporters);
}

class Reporter {
    private aggregatedResults: AggregatedResult;
    private currentResults: TestResult = createEmptyTestResult();
    private extraOutput: string[] = [];

    constructor(
        public rootParser: Parser,
        private projectConfig: Config.ProjectConfig,
        private reporters: BaseReporter[]
    ) {
        this.subscribeToParser(rootParser);

        this.aggregatedResults = makeEmptyAggregatedTestResult();
        this.aggregatedResults.startTime = Date.now();

        // Tell the reporters we're starting our test run.
        reporters.forEach((reporter) => {
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
        parser.on("comment", this.onComment.bind(this));
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
            this.extraOutput.push(extra);
        });

        parser.on("bailout", (reason: string) => {
            console.log("BAIL " + reason);
            // this.currentResults.testExecError = {
            //     // code?: unknown;
            //     message: reason,
            //     stack: null
            //     // stack: string | null | undefined;
            //     // type?: string;
            // }
            // throw new Error("Error" + reason);
            // this.extraOutput.push(extra);
        });

        /*
         * In the future, we could subscribe to any of these if we need the information.
         */
        // parser.on('plan', function (plan) { });
        // parser.on('bailout', function (reason) { });
        // parser.on('result', function (result) { });
        // parser.on('line', function (line) { });
        // parser.on('assert', function (failure) { });
    }

    /**
     * Callback when the TAP Parser encounters a comment.
     * @param comment The comment in the TAP output
     */
    protected onComment(comment: string) {
        // Grab the filename, if it exists, from the comment string.
        // Jest reports file-by-file, so this is a custom method of identifying files from output.
        let [maybeDirectiveName, maybeDirectiveInfo] = comment
            .slice(2) // remove the `# ` from the beginning of the comment
            .trim()
            .split(" ");

        switch (maybeDirectiveName) {
            case "FILE_START":
                this.onFileStart(maybeDirectiveInfo);
                break;
            case "FILE_END":
                this.onFileEnd();
                break;
            case "EXEC_ERROR":
                // When we encounter an execution error, then the last message on our extra output stack
                // will be the error that `brs` printed. So pop it off, and use it here instead.
                let errorMessage =
                    this.extraOutput.pop() || "Runtime exception occurred";

                // Jest expects a
                let jestCompatibleStack = errorMessage.replace(
                    /(.*)\((\d),(\d*).*\):/,
                    "$1:$2:$3"
                );
                this.currentResults.testExecError = {
                    stack: jestCompatibleStack,
                    message: errorMessage,
                };
                break;

            default:
                break;
        }
    }

    /**
     * Creates empty results for the new file and sets it as the current results for this parser.
     * @param filePath The path to the file that is starting its run.
     */
    protected onFileStart(filePath: string) {
        this.currentResults = createEmptyTestResult();
        this.currentResults.testFilePath = path.join(process.cwd(), filePath);
    }

    /**
     * Adds the results from the current file to the aggregated results,
     * and tells each Jest reporter that this file has completed.
     */
    protected onFileEnd() {
        // If we encountered any extra (non-TAP) output, put it in the console
        // field so that jest prints it out.
        if (this.extraOutput.length) {
            this.currentResults.console = [
                {
                    message: this.extraOutput.join(""),
                    origin: "",
                    type: "info",
                },
            ];
            this.extraOutput = [];
        }

        if (this.currentResults.testExecError) {
            this.currentResults.failureMessage = formatExecError(
                this.currentResults.testExecError,
                this.projectConfig,
                { noStackTrace: true, noCodeFrame: true }
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
        if (parser === this.rootParser) {
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
//     readStrm.pipe(reporter.rootParser);
// });
