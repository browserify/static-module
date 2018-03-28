var test = require('tape');
var concat = require('concat-stream');
var staticModule = require('../');
var fs = require('fs');
var path = require('path');

test('scope tracking', function (t) {
    t.plan(4);
    
    var sm = staticModule({
        fs: {
            readFileSync: function () { return '"read the file!"' }
        }
    });
    readStream('source.js').pipe(sm).pipe(concat(function (body) {
        Function(['T'],body)(t);
    }));
});

function readStream (file) {
    return fs.createReadStream(path.join(__dirname, 'scope', file));
}
