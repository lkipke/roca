import { Config } from "@jest/types";
import { ExecuteWithScope, types as BrsTypes } from "brs";
import { JestReporter } from "../reporter";
import { TestRunner } from "./TestRunner";

export class JestRunner extends TestRunner {
    private reporter: JestReporter;

    constructor(
        readonly reporterStream: NodeJS.WriteStream & any,
        projectConfig: Config.ProjectConfig,
        globalConfig: Config.GlobalConfig,
        reporterType: string
    ) {
        super(reporterStream);

        this.reporter = new JestReporter(
            reporterStream,
            projectConfig,
            globalConfig,
            reporterType
        );
    }

    /**
     * Executes and reports a given test file.
     * @override
     */
    protected executeFile(
        execute: ExecuteWithScope,
        executeArgs: BrsTypes.RoAssociativeArray,
        filename: string
    ) {
        this.reporter.onFileStart(filename);

        try {
            execute([filename], [executeArgs]);
        } catch (reason) {
            this.reporter.onFileExecError(reason);
        }

        this.reporter.onFileEnd();
    }
}
