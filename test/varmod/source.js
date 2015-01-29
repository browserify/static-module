var fs = require('fs'),
  path = require('path'),
  html = fs.readFileSync(path.join(__dirname, 'vars.html'), 'utf8'),
  x = '!'
;
console.log(html + x);
