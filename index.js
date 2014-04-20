var fs = require('fs');
var path = require('path');

var through = require('through2');
var Readable = require('readable-stream').Readable;

var concat = require('concat-stream');
var duplexer = require('duplexer2');
var falafel = require('falafel');
var unparse = require('escodegen').generate;
var inspect = require('object-inspect');
var evaluate = require('static-eval');
var copy = require('shallow-copy');

module.exports = function (modules, opts) {
    var varNames = {};
    if (!opts) opts = {};
    var vars = opts.vars || {};
    var pending = 0;
    var updates = [];
    
    var output = through();
    return duplexer(concat(function (body) {
        try { var src = parse(body.toString('utf8')) }
        catch (err) { return error(err) }
        if (pending === 0) finish(src);
    }), output);
    
    function finish (src) {
        var offset = 0, pos = 0;
        src = String(src);
        
        (function next () {
            if (updates.length === 0) return done();
            
            var s = updates.shift();
            if (!s.stream) {
                offset += s.range[1] - s.range[0];
                return next();
            }
            
            output.push(src.slice(pos, s.range[0] - offset));
            pos = s.range[0] - offset;
            offset += s.range[1] - s.range[0];
            
            s.stream.on('end', next);
            s.stream.pipe(output, { end: false });
        })();
        
        function done () {
            output.push(src.slice(pos));
            output.push(null);
        }
    }
    
    function error (msg) {
        output.emit('error', new Error(msg));
    }
    
    function parse (body) {
        var output = falafel(body, function (node) {
            if (isRequire(node) && has(modules, node.arguments[0].value)
            && node.parent.type === 'VariableDeclarator'
            && node.parent.id.type === 'Identifier') {
                varNames[node.parent.id.name] = node.arguments[0].value;
                var decs = node.parent.parent.declarations;
                if (decs.length === 1) {
                    node.parent.parent.update('');
                    updates.push({ range: node.parent.parent.range });
                }
                else {
                    node.parent.update('');
                    updates.push({ range: node.parent.range });
                }
            }
            if (isRequire(node) && has(modules, node.arguments[0].value)
            && node.parent.type === 'AssignmentExpression'
            && node.parent.left.type === 'Identifier') {
                varNames[node.parent.left.name] = node.arguments[0].value;
                node.update('{}');
                updates.push({ range: [ node.range[0], node.range[1] - 2 ] });
            }
            
            if (node.type === 'Identifier' && varNames[node.name]) {
                traverse(node);
            }
        });
        return output;
    }
    
    function traverse (node) {
        var val = modules[varNames[node.name]];
        if (node.parent.type === 'CallExpression') {
            if (typeof val !== 'function') {
                return error(
                    'tried to statically call ' + inspect(val)
                    + ' as a function'
                );
            }
            var xvars = copy(vars);
            xvars[node.name] = val;
            var res = evaluate(node.parent, xvars);
            if (res !== undefined) node.parent.update(res);
        }
        else if (node.parent.type === 'MemberExpression') {
            if (node.parent.property.type !== 'Identifier') {
                return error(
                    'dynamic property in member expression: '
                    + node.parent.source()
                );
            }
            var id = node.parent.property.name;
            if (!has(val, id)) {
                return error(
                    inspect(val) + ' does not have static property ' + id
                );
            }
            if (typeof val[id] === 'function') {
                var xvars = copy(vars);
                xvars[node.name] = val;
                var res = evaluate(node.parent.parent, xvars);
                if (isStream(res)) {
                    updates.push({
                        range: node.parent.parent.range,
                        stream: wrapStream(res)
                    });
                    node.parent.parent.update('');
                }
                else if (res !== undefined) node.parent.update(res);
            }
            else {
                node.update(inspect(val));
            }
        }
        else {
            output.emit('error', new Error(
                'unsupported type for static module: ' + node.parent.type
            ));
        }
    }
};

function isRequire (node) {
    var c = node.callee;
    return c
        && node.type === 'CallExpression'
        && c.type === 'Identifier'
        && c.name === 'require'
    ;
}

function has (obj, key) {
    return {}.hasOwnProperty.call(obj, key);
}

function isStream (s) {
    return s && typeof s === 'object' && typeof s.pipe === 'function';
}

function wrapStream (s) {
    if (typeof s.read === 'function') return s
    else return (new Readable).wrap(s)
}
