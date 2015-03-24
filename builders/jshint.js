var jshint = require('jshint').JSHINT;
var fs = require('fs');

module.exports = function (config) {
    var content = fs.readFileSync(config.configFile);
    config = JSON.parse(content);

    return function (file, callback) {
        if (!jshint(file.content, Object.create(config))) {
            callback(jshint.errors);
        } else {
            callback(null);
        }
    };
};