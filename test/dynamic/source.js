var fs = require('fs');
var path = require('path');
var file = path.join(__dirname, 'source.js');
var source = fs.readFileSync(file, 'utf8');
