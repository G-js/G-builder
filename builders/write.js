var fs = require('fs');

module.exports = function (fileInfo, callback) {
    fs.writeFile(this.config.dest + '/' + fileInfo.id, fileInfo.content, function (err) {
        callback(err, fileInfo);
    });
};