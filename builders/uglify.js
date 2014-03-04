var UglifyJS = require('uglify-js');

module.exports = function (callback) {
    var fileInfo = this.file;

    try {
        fileInfo.content = UglifyJS.minify(fileInfo.content, {fromString: true}).code;
    } catch (ex) {
        return callback(new Error('[Uglifyjs]: ' + ex.message + '[line:' + ex.line + ', column:' + ex.col + ']'));
    }

    callback(null);
};