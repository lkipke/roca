const Parser = require("tap-parser");
const { Stream } = require("stream");
const JestReporter = require("@jest/reporters");
const JestConsole = require("@jest/console");
const JestMessageUtil = require("jest-message-util");
const JestMatcherUtils = require("jest-matcher-utils");
const JestConfig = require("jest-config");
const chalk = require("chalk");

let INDENT_STR = "  ";

function getIndent(indent) {
    let childIndent = "";
    for (let i = 0; i < indent; i++) {
        childIndent += INDENT_STR;
    }

    return childIndent;
}
let testFilePath = "/foo/bar"

function createReporterStream() {
    let globalConfig = JestConfig.defaults;
    const reporter = new JestReporter.DefaultReporter(globalConfig);
    // reporter.onRunStart()
    // reporter.onRunComplete()
    console.log("HERE")
    reporter.onTestResult({
        path: testFilePath,
        context: {
            config: globalConfig,
            path: testFilePath,
        }
    }, {
        console: console.log,
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
            start:0,
        },
        skipped: false,
        testFilePath: testFilePath,
        testResults: []
    },
    {});
    // console.log("---------------");
    // console.log(
    //     JestMatcherUtils.printDiffOrStringify({ abcdefg: "foo"}, { abbdefg: "fob" }, "Expected", "Received", false)
    // )
    // console.log(JestConsole.getConsoleOutput(
    //     "",
    //     false,
    //     [{
    //         message: "this is a fake error",
    //         origin: testFilePath,
    //         type: "error"
    //     }],
    //     "rootDir"
    // ));

    // console.log(
    // chalk.dim(JestMessageUtil.formatStackTrace(
    //     testFilePath,
    //     "rootDir",
    //     {
    //         noStackTrace: false,
    //         noCodeFrame: false
    //     }
    // ).trimRight())
    // )

    const parser = new Parser();
    subscribeParser(parser, 0);
    return parser;
}

function subscribeParser(parser, indent) {
    let output = (...args) => console.log(getIndent(indent), ...args);


    // JestReporter.BaseReporter

    parser.on("complete", function (results) {
        indent--;
    });
    parser.on("line", function (line) { });
    parser.on("assert", function (failure) {
        // output("Assert", failure)
    });
    parser.on("comment", function (comment) { });
    parser.on('plan', function (plan) { });
    parser.on('bailout', function (reason) { });
    parser.on('child', function (childParser) {
        console.log("Child");
        subscribeParser(childParser, indent + 1);
    });
    parser.on('result', function (result) {
        // output("Result", result)
    });
    parser.on('pass', function (assert) {
        output("Pass", assert);
    });
    parser.on('fail', function (assert) {
        output("Fail", assert.diag.stack);
    });
    parser.on('skip', function (assert) { });
    parser.on('todo', function (assert) { });
    parser.on('extra', function (extra) {
        output("Extra", extra);
    });
}


module.exports.createReporterStream = createReporterStream;
