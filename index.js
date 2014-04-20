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
    
    function pushUpdate (node, s) {
        var rep = String(s);
        var prev = node.range[1] - node.range[0];
        updates.push({ offset: prev - rep.length });
        node.update(rep);
    }
    
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
                offset += s.offset;
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
                var ix = decs.indexOf(node.parent);
                if (ix >= 0) decs.splice(ix, 1);
                
                if (decs.length === 0) {
                    pushUpdate(node.parent.parent, '');
                }
                else {
                    pushUpdate(
                        node.parent.parent,
                        unparse(node.parent.parent)
                    );
                }
            }
            else if (isRequire(node) && has(modules, node.arguments[0].value)
            && node.parent.type === 'AssignmentExpression'
            && node.parent.left.type === 'Identifier') {
                varNames[node.parent.left.name] = node.arguments[0].value;
                pushUpdate(node, '{}');
            }
            else if (isRequire(node) && has(modules, node.arguments[0].value)
            && node.parent.type === 'MemberExpression'
            && node.parent.property.type === 'Identifier'
            && node.parent.parent.type === 'VariableDeclarator'
            && node.parent.parent.id.type === 'Identifier') {
                varNames[node.parent.parent.id.name] = [
                    node.arguments[0].value, node.parent.property.name
                ];
                var decs = node.parent.parent.parent.declarations;
                var ix = decs.indexOf(node.parent.parent);
                if (ix >= 0) decs.splice(ix, 1);
                
                if (decs.length === 0) {
                    pushUpdate(node.parent.parent.parent, '');
                }
                else {
                    pushUpdate(
                        node.parent.parent.parent,
                        unparse(node.parent.parent.parent)
                    );
                }
            }
            
            if (node.type === 'Identifier' && varNames[node.name]) {
                traverse(node);
            }
        });
        return output;
    }
    
    function traverse (node) {
        var vn = varNames[node.name];
        var val;
        if (Array.isArray(vn)) {
            val = modules[vn[0]][vn[1]];
        }
        else {
            val = modules[vn];
        }
        
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
            
            if (isStream(res)) {
                updates.push({
                    range: node.parent.range,
                    stream: wrapStream(res)
                });
                node.parent.update('');
            }
            else if (res !== undefined) pushUpdate(node.parent, res);
        }
        else if (node.parent.type === 'MemberExpression') {
            if (node.parent.property.type !== 'Identifier') {
                return error(
                    'dynamic property in member expression: '
                    + node.parent.source()
                );
            }
            
            var cur = node.parent.parent;
            
            if (cur.type === 'MemberExpression') {
                cur = cur.parent;
                if (cur.type !== 'CallExpression'
                && cur.parent.type === 'CallExpression') {
                    cur = cur.parent;
                }
            }
            if (node.parent.type === 'MemberExpression'
            && (cur.type !== 'CallExpression'
            && cur.type !== 'MemberExpression')) {
                cur = node.parent;
            }
            
            var xvars = copy(vars);
            xvars[node.name] = val;
            
            var res = evaluate(cur, xvars);
            if (isStream(res)) {
                updates.push({
                    range: cur.range,
                    stream: wrapStream(res)
                });
                cur.update('');
            }
            else if (res !== undefined) {
                pushUpdate(cur, res);
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
