var fs = require('fs');
var path = require('path');

module.exports = function (fileInfo, callback) {
    var config = this.config;
    if (!fileInfo.output || !Object.keys(fileInfo.output).length) {
        fileInfo.output = {};
        fileInfo.output[fileInfo.id] = fileInfo.content;
    }

    try {
        Object.keys(fileInfo.output).forEach(function (file) {
            var dest = config.dest + file;

            if (!fs.existsSync(path.dirname(dest))) {
                mkdir(path.dirname(dest));
            }

            fs.writeFileSync(dest, fileInfo.output[file]);
        });
        callback(null, fileInfo);
    } catch (ex) {
        callback(ex, fileInfo);
    }
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