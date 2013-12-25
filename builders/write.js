var fs = require('fs');
var path = require('path');

module.exports = function (fileInfo, callback) {
    var dest = this.config.dest + fileInfo.id;

    if (!fs.existsSync(path.dirname(dest))) {
        mkdir(path.dirname(dest));
    }

    fs.writeFile(dest, fileInfo.content, function (err) {
        callback(err, fileInfo);
    });
};

function mkdir(filePath) {
    filePath.split(path.sep).reduce(function (parts, part) {
        parts += part + path.sep;
        if (!fs.existsSync(parts)) {
            fs.mkdirSync(parts);
        }
        return parts;
    }, '/');
}