var fs = require('fs');

module.exports = function (fileInfo, callback) {
    var src = this.config.src;
    var dest = this.config.dest;

    fs.readFile(src + fileInfo.id, function (err, buffer) {
        if (err) {
            return callback(err);
        }

        fs.writeFile(dest + fileInfo.id, buffer, function (err) {
            callback(err, fileInfo);
        });
    });
};