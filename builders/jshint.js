var minimatch = require('minimatch');
var jshint    = require('jshint').JSHINT;
var fs        = require('fs');

module.exports = function (config) {
    var jshintConfig = null;
    var ignoreErrors = config.ignoreErrors;
    config = config || {};

    if (config.configFile) {
        jshintConfig = JSON.parse(fs.readFileSync(config.configFile));
    }

    return function (file, callback) {
        var errors;
        var ignore = false;

        if (config.ignoreFiles) {
            ignore = config.ignoreFiles.some(function (pattern) {
                return minimatch(file.id, pattern);
            });

            if (ignore) {
                return callback(null);
            }
        }

        if (config.ignoreFiles && config.ignoreFiles.indexOf(file.id) !== -1) {
            return callback(null);
        }

        if (!jshint(file.content, jshintConfig ? Object.create(jshintConfig) : undefined)) {
            errors = jshint.errors;

            if (ignoreErrors) {
                errors = errors.filter(function (err) {
                    return ignoreErrors.indexOf(err.code) === -1;
                });
            }

            if (!errors.length) {
                errors = null;
            }

            callback(errors);
        } else {
            callback(null);
        }
    };
};