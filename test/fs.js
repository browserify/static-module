var staticModule = require('../');
var test = require('tape');
var concat = require('concat-stream');
var quote = require('quote-stream');
var through = require('through2');
var fs = require('fs');
var path = require('path');

test('fs.readFile', function (t) {
    t.plan(1);
    var sm = staticModule({
        fs: {
            readFile: function (file, cb) {
                var stream = through(write, end);
                stream.push('process.nextTick(function(){(' + cb + ')(null,');
                return fs.createReadStream(file).pipe(quote()).pipe(stream);
                
                function write (buf, enc, next) { this.push(buf); next() }
                function end (next) { this.push(')})'); this.push(null); next() }
            }
        }
    }, { vars: { __dirname: __dirname + '/fs' } });
    readStream('readfile.js').pipe(sm).pipe(concat(function (body) {
        Function(['console'],body)({ log: log });
        function log (msg) { t.equal(msg, 'beep boop\n') }
    }));
});

function readStream (file) {
    return fs.createReadStream(path.join(__dirname, 'fs', file));
}
