var fs = require('fs');
var path = require('path');

var through = require('through2');
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
    
    var output = through();
    return duplexer(concat(function (body) {
        /*
        try { var src = parse() }
        catch (err) {
            output.emit('error', new Error(err.message + ' (' + file + ')'));
        }
        */
        var src = parse(body.toString('utf8'));
        if (pending === 0) finish(src);
    }), output);
    
    function finish (src) {
        output.push(String(src));
        output.push(null);
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
                }
                else {
                    node.parent.update('');
                }
            }
            if (isRequire(node) && has(modules, node.arguments[0].value)
            && node.parent.type === 'AssignmentExpression'
            && node.parent.left.type === 'Identifier') {
                varNames[node.parent.left.name] = node.arguments[0].value;
                node.update('{}');
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
                var res = evaluate(node.parent, xvars);
                if (res !== undefined) node.parent.update(res);
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

function has (obj, key) { return {}.hasOwnProperty.call(obj, key) }

function errorWithFile (file, err) {
    var e = new Error(err.message + '\n  while running brfs on ' + file);
    e.file = file;
    return e;
}
