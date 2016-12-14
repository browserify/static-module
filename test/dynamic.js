var test = require('tape');
var concat = require('concat-stream');
var quote = require('quote-stream');
var staticModule = require('../');
var fs = require('fs');
var path = require('path');

test('dynamic modules', function (t) {
    t.plan(1);
    
    var dirname = path.join(__dirname, 'dynamic');
    var expected = [ 'beep boop!' ];
    var sm = staticModule({
        fs: {
            readFileSync: function (file, enc) {
                return fs.createReadStream(file).pipe(quote());
            }
        }
    }, {
        vars: { __dirname: dirname },
        varModules: { path: require('path') }
    });
    
    readStream('source.js').pipe(sm).pipe(concat(function (body) {
        t.equal(
            body.toString('utf8'),
            'var fs = require(\'fs\');'
            + '\nvar path = require(\'path\');'
            + '\nvar file = path.join(__dirname, \'source.js\');'
            + '\nvar source = fs.readFileSync(file, \'utf8\');\n'
        );
        Function(['console','require', '__dirname'],body)({ log: log },require,dirname);
        function log (msg) { t.equal(msg, expected.shift()) }
    }));
});

function readStream (file) {
    return fs.createReadStream(path.join(__dirname, 'dynamic', file));
}
