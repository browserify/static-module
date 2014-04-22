var staticModule = require('../');
var test = require('tape');
var concat = require('concat-stream');
var quote = require('quote-stream');
var fs = require('fs');
var path = require('path');

test('stream into a console.log', function (t) {
    t.plan(1);
    var sm = staticModule({
        beep: function () {
            var q = quote();
            q.end('eek');
            return q;
        }
    }, { vars: { __dirname: path.join(__dirname, 'brfs') } });
    readStream('source.js').pipe(sm).pipe(concat(function (body) {
        t.equal(body.toString('utf8'), 'console.log("eek");\n');
    }));
});

function readStream (file) {
    return fs.createReadStream(path.join(__dirname, 'log', file));
}
