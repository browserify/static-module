var staticModule = require('../');

module.exports = function () {
    return staticModule({ beep: function (n) { return n * 111 } });
};
