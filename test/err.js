var staticModule = require('../');
var test = require('tape');
var through = require('through2');
var fs = require('fs');
var path = require('path');

test('forward custom errors to the result stream', function (t) {
    t.plan(1);
    var sm = staticModule({
        foo: { bar: function(){
            var stream = through();
            process.nextTick(function(){
                stream.emit('error', new Error('beep boop'));
            });
            return stream;
        } }
    });

    var stream = fs.createReadStream(path.join(__dirname, 'err', 'err.js')).pipe(sm);
    stream.on('error', function(err){
        t.equal(err.message, 'beep boop');
    });
});

