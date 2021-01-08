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
} from "@jest/test-result";
import { Assert, createContext } from "./utils";
import type { Config } from "@jest/types";

export class JestReporter {
    /** Aggregated results from all test files. */
    private aggregatedResults: AggregatedResult;
    /** The results from the test file that is currently being run. */
    private currentResults: TestResult = createEmptyTestResult();
    /** The hierarchy of suite names for the current test. */
    private suiteNames: string[] = [];
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

        // Create a summary reporter and either a default or verbose reporter.
        this.reporters = [];
        if (reporterType === "jest-verbose") {
            this.reporters.push(new VerboseReporter(globalConfig));
        } else {
            this.reporters.push(new DefaultReporter(globalConfig));
        }
        this.reporters.push(new SummaryReporter(globalConfig));
    }

    /**
     * Subscribe to a TAP Parser's events.
     * @param parser Parser instance to subscribe
     */
    protected subscribeToParser(parser: Parser) {
        parser.on("fail", (assert: Assert) => {});
        parser.on("child", (childParser: Parser) => {});
        parser.on("comment", (comment: string) => {});
        parser.on("complete", () => {});
        parser.on("pass", (assert: Assert) => {});
        parser.on("skip", (assert: Assert) => {});
        parser.on("todo", (assert: Assert) => {});
        parser.on("extra", (extra: string) => {});
    }

    /**
     * Callback for when a test run is starting.
     * @param numSuites The number of suites in the run
     */
    public onRunStart(numSuites: number) {
        this.aggregatedResults.startTime = Date.now();
        this.aggregatedResults.numTotalTestSuites = numSuites;

        // Tell the reporters we're starting our test run.
        this.reporters.forEach((reporter) => {
            reporter.onRunStart(this.aggregatedResults, {
                estimatedTime: 0,
                showStatus: false,
            });
        });
    }

    /**
     * Callback for when all test files have been executed.
     */
    public onRunComplete() {
        let contextSet = new Set([createContext(this.projectConfig)]);
        this.reporters.forEach((reporter) => {
            reporter.onRunComplete(contextSet, this.aggregatedResults);
        });
    }

    /**
     * Callback for when brs encounters an execution error.
     * @param filename The name of the file that failed
     * @param index The TAP index of the file
     * @param reason The error that was thrown to cause the execution error
     */
    public onFileExecError(filename: string, index: number, reason: any) {
        // TODO: implement
    }

    /**
     * Callback for when a file starts test execution. Creates empty results
     * for the new file and sets it as the current results for this parser.
     * @param filePath The path to the file that is starting its run.
     */
    public onFileStart(filePath: string) {
        this.suiteNames = [];
        this.currentResults = createEmptyTestResult();
        this.currentResults.testFilePath = path.join(process.cwd(), filePath);
        this.currentResults.perfStats.start = Date.now();
    }

    /**
     * Callback for when a file ends execution. Adds the results from the current
     * file to the aggregated results, and tells each Jest reporter that this file has completed.
     */
    public onFileComplete() {
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
}
