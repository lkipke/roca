const Parser = require("tap-parser");
const { Stream } = require("stream");

let INDENT_STR = "  ";

function getIndent(indent) {
    let childIndent = "";
    for (let i = 0; i < indent; i++) {
        childIndent += INDENT_STR;
    }

    return childIndent;
}

function createReporterStream(indent = 0) {
    const parser = new Parser();

    parser.on("complete", function(results) {
        indent--;
    });
    parser.on("line", function(line) {});
    parser.on("assert", function(failure) {
    });
    parser.on("comment", function(comment) {});
    parser.on('plan', function (plan) {})
    parser.on('bailout', function (reason) {})
    parser.on('child', function (childParser) {
        indent++;
        createReporterStream(indent);
    })
    parser.on('result', function (assert) {})
    parser.on('pass', function (assert) {
        parser.(getIndent(indent) + "PASS", assert);
    });
    parser.on('fail', function (assert) {
        console.log(getIndent(indent) + "FAIL", assert);
    });
    parser.on('skip', function (assert) {})
    parser.on('todo', function (assert) {})
    parser.on('extra', function (extra) {})

    return parser;
}


module.exports.createReporterStream = createReporterStream;
