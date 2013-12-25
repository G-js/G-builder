var fs = require('fs');
var path = require('path');

module.exports = function (fileInfo, callback) {
    fs.readFile(this.config.src + fileInfo.id, function (err, buffer) {
        if (err) {
            return callback(err);
        }
        fileInfo.content = buffer.toString();

        callback(null, fileInfo);
    });
};