var staticModule = require('../');
var test = require('tape');
var concat = require('concat-stream');
var quote = require('quote-stream');
var through = require('through2');
var fs = require('fs');
var path = require('path');

test('fs.readFileSync twice', function (t) {
    t.plan(2);
    var sm = staticModule({
        fs: { readFileSync: readFileSync }
    }, { vars: { __dirname: __dirname + '/fs_twice' } });
    var expected = [ 'EXTERMINATE\n', 'beep boop\n' ];
    readStream('html.js').pipe(sm).pipe(concat(function (body) {
        t.equal(body.toString('utf8'),
            'var a = "EXTERMINATE\\n";\n'
            + 'var b = "beep boop\\n";\n'
            + 'console.log(a);\n'
            + 'console.log(b);\n'
        );
        Function(['console'],body)({ log: log });
        function log (msg) { t.equal(msg, expected.shift()) }
    }));
});

function readStream (file) {
    return fs.createReadStream(path.join(__dirname, 'fs_twice', file));
}

function readFile (file, cb) {
    var stream = through(write, end);
    stream.push('process.nextTick(function(){(' + cb + ')(null,');
    return fs.createReadStream(file).pipe(quote()).pipe(stream);
    
    function write (buf, enc, next) { this.push(buf); next() }
    function end (next) { this.push(')})'); this.push(null); next() }
}

function readFileSync (file, opts) {
    return fs.createReadStream(file).pipe(quote());
}
