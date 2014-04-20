var staticModule = require('../');
var quote = require('quote-stream');
var through = require('through2');
var fs = require('fs');

var sm = staticModule({
    fs: {
        readFileSync: function (file) {
            return fs.createReadStream(file).pipe(quote());
        },
        readFile: function (file, cb) {
            var stream = through(null, function () {
                this.push(')})');
                this.push(null);
            });
            stream.push('process.nextTick(function () {' + cb + '(null,');
            return fs.createReadStream(file).pipe(quote()).pipe(stream);
        }
    }
}, { vars: { __dirname: __dirname + '/fs' } });
process.stdin.pipe(sm).pipe(process.stdout);
