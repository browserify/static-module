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
        var src = parse(body);
        if (pending === 0) finish(src);
    }), output);
    
    function containsUndefinedVariable (node) {
        if (node.type === 'Identifier') {
            if (vars.indexOf(node.name) === -1) {
                return true;
            }
        }
        else if (node.type === 'BinaryExpression') {
            return containsUndefinedVariable(node.left)
                || containsUndefinedVariable(node.right)
            ;
        }
        else {
            return false;
        }
    };
    
    function finish (src) {
        output.push(String(src));
        output.push(null);
    }
    
    function parse (body) {
        return falafel(body, function (node) {
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
    }
    
    function traverse (node) {
        if (node.parent.type === 'CallExpression') {
            var val = modules[varNames[node.name]];
            if (typeof val !== 'function') {
                output.emit('error', new Error(
                    'tried to statically call ' + inspect(val)
                    + ' as a function'
                ));
            }
            else {
                //console.log('VALUE!', node.parent.arguments);
                var xvars = copy(vars);
                xvars[node.name] = val;
                var res = evaluate(node.parent, xvars);
                if (res !== undefined) node.parent.update(res);
            }
        }
        //varNames[node.name].parent
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
