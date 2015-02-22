var test = require('tape');
var concat = require('concat-stream');
var staticModule = require('../');
var fs = require('fs');
var path = require('path');

test('variable property function', function (t) {
    t.plan(2);
    var abc = {
        xyz: function (n) {
            t.equal(n, 5);
            return 111;
        }
    };
    var sm = staticModule({}, { vars: { abc: abc } });
    readStream('source.js').pipe(sm).pipe(concat(function (body) {
        Function(['console'],body)({ log: log });
        function log (msg) { t.equal(msg, 555) }
    }));
});

function readStream (file) {
    return fs.createReadStream(path.join(__dirname, 'var_prop_fn', file));
}
