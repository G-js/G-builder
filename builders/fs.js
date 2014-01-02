var fs = require('fs');
var path = require('path');

exports.read = function (fileInfo, callback) {
    fs.readFile(this.config.src + fileInfo.id, function (err, buffer) {
        if (err) {
            return callback(err);
        }
        fileInfo.content = buffer.toString();

        callback(null, fileInfo);
    });
};

exports.copy = function (fileInfo, callback) {
    var src = this.config.src + fileInfo.id;
    var dest = this.config.dest + fileInfo.id;

    fs.readFile(src, function (err, buffer) {
        if (err) {
            return callback(err);
        }

        if (!fs.existsSync(path.dirname(dest))) {
            mkdir(path.dirname(dest));
        }

        fs.writeFile(dest, buffer, function (err) {
            fileInfo.output[fileInfo.id] = buffer;
            callback(err, fileInfo);
        });
    });
};

exports.write = function (fileInfo, callback) {
    var config = this.config;
    if (!fileInfo.output || !Object.keys(fileInfo.output).length) {
        fileInfo.output = {};
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