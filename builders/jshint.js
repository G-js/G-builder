var jshint = require('jshint').JSHINT;
var _ = require('underscore');

module.exports = function (fileInfo, callback) {
    var err = null, config = this.config.jshint;
    if (config === 'ignore') {
        return callback(err, fileInfo);
    }
    config = _.extend({}, config);

    if (!jshint(fileInfo.content, config)) {
        err = 'JSHINT: \n' + jshint.errors
                .map(function (err, i) {
                    if (!err) {
                        return '';
                    }
                    return i + '. ' + err.reason + '[' + err.line + ':' + err.character + '][' + err.code + ']';
                })
                .join('\n');
    }

    callback(err, fileInfo);
};