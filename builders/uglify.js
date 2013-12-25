var UglifyJS = require('uglify-js');

module.exports = function (fileInfo, callback) {
    var content = fileInfo.content;

    try {
        content = UglifyJS.minify(content, {fromString: true}).code;
    } catch (ex) {
        return callback(new Error(ex.message + '[line:' + ex.line + ', column:' + ex.col + ']'));
    }

    callback(null, fileInfo);
};