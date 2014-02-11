var fs = require('fs');
var path = require('path');
var async = require('async');

exports.getAllFiles = function getAllFiles (dir, options, callback) {
    if (!callback && typeof options === 'function') {
        callback = options;
        options = {};
    }

    fs.readdir(dir, function (err, files) {
        async.reduce(
            files,
            [],
            function (list, file, cb) {
                if (file[0] === '.' && options.ignoreHidden !== false) {
                    return cb(null, list);
                }

                fs.stat(dir + '/' + file, function (err, stat) {
                    if (err) {
                        return cb(err);
                    }

                    if (stat.isDirectory()) {
                        getAllFiles(dir + '/' + file, function (err, files) {
                            cb(err, list.concat(files));
                        });
                    } else {
                        list.push(path.normalize(dir + '/' + file));
                        cb(null, list);
                    }
                });
            },
            callback
        );
    });
};