var jshint = require('jshint').JSHINT;
var _ = require('underscore');

module.exports = function (callback) {
    var fileInfo = this.file;
    var config = this.config.jshint;
    var err = null;

    if (config === 'ignore') {
        return callback(err);
    }
    config = _.extend({}, config);

    if (!jshint(fileInfo.content, config)) {
        err = 'JSHINT: \n' + jshint.errors
                .map(function (err, i) {
                    if (!err) {
                        return '';
                    }
                    return i + '. ' + err.reason + '[line: ' + err.line + ', char:' + err.character + '][ECODE: ' + err.code + ']';
                })
                .join('\n');
    }

    callback(err);
};