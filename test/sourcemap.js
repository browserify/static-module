var test = require('tape');
var fs = require('fs');
var concat = require('concat-stream');
var PassThrough = require('stream').PassThrough;
var convertSourceMap = require('convert-source-map');
var SourceMapConsumer = require('source-map').SourceMapConsumer;
var staticModule = require('../');

test('source maps', function (t) {
    t.plan(6);

    var transform = staticModule({
        sheetify: function (filename) {
            var stream = PassThrough();
            stream.write('`.css{\n');
            stream.write('  color: red;\n');
            stream.end('}`');
            return stream;
        }
    }, { sourceMap: true });

    fs.createReadStream(__dirname + '/sourcemap/main.js').pipe(transform).pipe(concat({ encoding: 'string' }, function (res) {
        var consumer = new SourceMapConsumer(convertSourceMap.fromSource(res).toObject());

        var mapped = consumer.originalPositionFor({
            line: 8,
            column: 0
        });
        t.equal(mapped.line, 8);
        t.equal(mapped.column, 0);

        mapped = consumer.originalPositionFor({
            line: 10,
            column: 2
        });
        t.equal(mapped.line, 8);
        t.equal(mapped.column, 19);

        mapped = consumer.originalPositionFor({
            line: 12,
            column: 0
        });
        t.equal(mapped.line, 10);
        t.equal(mapped.column, 0);
    }));
});
