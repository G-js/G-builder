var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var async = require('async');

exports.read = function (callback) {
    var fileInfo = this.file;
    fs.readFile(this.config.src + fileInfo.id, function (err, buffer) {
        if (err) {
            return callback(err);
        }
        fileInfo.content = buffer.toString();

        callback(null);
    });
};

exports.copy = function (callback) {
    var fileInfo = this.file;
    var src = this.config.src + fileInfo.id;
    var dest = this.config.dest + fileInfo.id;

    fs.readFile(src, function (err, buffer) {
        if (err) {
            return callback(err);
        }

        mkdirp(path.dirname(dest), function (err) {
            if (err) {
                return callback(err);
            }

            fs.writeFile(dest, buffer, function (err) {
                fileInfo.output[fileInfo.id] = buffer;
                callback(err);
            });
        });
    });
};

exports.write = function (callback) {
    var fileInfo = this.file;
    var config = this.config;
    var db = this.db;
    if (!fileInfo.output || !Object.keys(fileInfo.output).length) {
        fileInfo.output = {};
    }

    async.each(
        Object.keys(fileInfo.output),
        function (file, next) {
            var dest = config.dest + file;

            mkdirp(path.dirname(dest), function (err) {
                if (err) {
                    return next(err);
                }
                fs.writeFile(dest, fileInfo.output[file], function (err) {
                    if (err) {
                        return next(err);
                    }
                    db.update({filename: file}, {filename: file, last_update: Date.now()}, {upsert: true}, next);
                });
            });
        },
        function (err) {
            callback(err);
        }
    );
};