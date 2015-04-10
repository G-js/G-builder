var UglifyJS = require('uglify-js');

module.exports = function (file, callback) {
    try {
        file.content = UglifyJS.minify(file.content, {fromString: true}).code;
    } catch (ex) {
        return callback(ex);
    }

    callback(null, file);
};