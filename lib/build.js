var fs = require('fs');
var async = require('async');
var path = require('path');
var Database = require('nedb');
var Domain = require('domain');
var minimatch = require('minimatch');
var EventEmitter = require('events').EventEmitter;
var _ = require('underscore');

var FileInfoDB = new Database({filename: './data/fileinfo.db', autoload: true});
var cwd = process.cwd();

function Builder(config) {
    var self = this;
    config.src = path.resolve(cwd, config.src) + path.sep;
    config.dest = path.resolve(cwd, config.dest) + path.sep;

    this.config = config;
    this.files = [];
    this.fileConfig = {};

    async.waterfall([
        function (next) {
            if (config.input && config.input.length) {
                getRelatedFiles(config.input, function (err, files) {
                    if (files) {
                        files = config.input.concat(files);
                    }
                    next(err, files);
                });
            } else {
                getAllFiles(config.src, function (err, files) {
                    if (files) {
                        files = files.map(function (file) {
                            return file.replace(config.src, '');
                        });
                    }

                    next(err, files);
                });
            }
        }
    ], function (err, files) {
        if (err) {
            throw err;
        }

        var customConfigDirs = getAllParentDirs(files)
                                .filter(function (dir) {
                                    return fs.existsSync(self.config.src + dir + path.sep + '.gbuild.json');
                                });

        var customConfig = customConfigDirs
                            .reduce(function (map, dir) {
                                map[dir] = require(self.config.src + dir + path.sep + '.gbuild.json');
                                return map;
                            }, {});

        customConfigDirs = Object.keys(customConfig);

        customConfigDirs.forEach(function (dir) {
            var config = customConfig[dir];
            var matchFiles = minimatch.match(files, dir + path.sep + '**/*', {});
            var ignoreFiles = [];

            if (config.only) {
                config.only = config.only
                                .map(function (file) {
                                    return path.normalize(dir + path.sep + file);
                                });

                ignoreFiles = matchFiles
                                .filter(function (file) {
                                    return config.only.indexOf(file) === -1;
                                });
            } else {
                ignoreFiles = config.ignore || [];
                ignoreFiles = ignoreFiles
                                .map(function (file) {
                                    return path.normalize(dir + path.sep + file);
                                });
            }

            if (ignoreFiles.length) {
                files = _.without.apply(_, [files].concat(ignoreFiles));
            }

            if (config.files) {
                Object.keys(config.files).forEach(function (file) {
                    self.fileConfig[path.normalize(dir + path.sep + file)] = config.files[file];
                });
            }
        });
        self.files = files;

        self.emit('ready', files);
    });
}

Builder.prototype = new EventEmitter();
Builder.prototype.constructor = Builder;

Builder.prototype.build = function (callback) {
    var self = this;
    async.reduce(
        this.files,
        {
            files: [].slice.call(this.files),
            output: [],
            error: {}
        },
        function (report, file, next) {
            var domain = Domain.create();
            var stack =  self.getWorkerStack(file) || [];

            domain.add(file);
            domain.add(next);

            domain.on('error', function (ex) {
                next(ex);
            });

            self.emit('start', file);

            domain.run(function () {
                async.waterfall(
                    stack,
                    function (err, fileInfo) {
                        if (fileInfo && fileInfo.output) {
                            report.output = report.output.concat(fileInfo.output);
                        }

                        if (err) {
                            report.error[file] = err;
                            self.emit('error', file, fileInfo);
                            return next(err, fileInfo);
                        }

                        self.updateFileInfo({
                            filename: fileInfo.id,
                            children: fileInfo.children || []
                        }, function (err) {
                            if (err) {
                                return next(err, report);
                            }

                            self.emit('success', file, fileInfo);
                            next(err, report);
                        });
                    }
                );
            });
        },
        function (err, report) {
            callback(err, report);
        }
    );
};

Builder.prototype.updateFileInfo = function (fileInfo, callback) {
    FileInfoDB.update({filename: fileInfo.filename}, fileInfo, {upsert: true}, callback);
};

Builder.prototype.getWorkerStack = function (filename) {
    var self = this;
    var patternIndex = -1;
    var stack = [];
    var patterns = this.config.builder
                    .map(function (builder) {
                        return builder[0];
                    });

    var config = _.extend({}, this.config);

    Object.keys(this.fileConfig).forEach(function (pattern) {
        if (minimatch(filename, pattern)) {
            _.extend(config, self.fileConfig[pattern]);
        }
    });

    patterns.some(function (p, i) {
        if (minimatch(filename, p)) {
            patternIndex = i;
            return true;
        }
        return false;
    });

    if (patternIndex === -1) {
        throw new Error('[' + filename + '] could not match any builder');
    }

    stack = this.config.builder[patternIndex][1];

    stack = stack.map(function (worker, i, s) {
        var prevWorker = s[i - 1];
        var fn;

        worker = worker.split('#');
        fn = require('../builders/' + worker[0]);

        if (worker[1]) {
            fn = fn[worker[1]];
        }

        if (typeof fn !== 'function') {
            throw new Error('Worder [' + (worker.length === 2 ? worker.join('#') : worker) + ']not found');
        }

        return function () {
            if (arguments.length !== 2) {
                throw new Error('Worker [' + prevWorker + '] must call callback with 2 arguments;');
            }
            fn.apply({
                config: config
            }, arguments);
        };
    });

    stack.unshift(function (callback) {
        callback(null, {
            id: filename,
            children: [],
            output: {},
            warn: []
        });
    });

    return stack;
};

function getAllFiles (dir, callback) {
    fs.readdir(dir, function (err, files) {
        async.reduce(
            files,
            [],
            function (list, file, cb) {
                if (file[0] === '.') {
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
}

function getRelatedFiles (searchList, callback) {
    var ret = [];
    searchList = searchList.slice();

    async.whilst(
        function () {
            return !!searchList.length;
        },
        function (cb) {
            var filename = searchList.shift();

            FileInfoDB.find({children: filename}, function (err, docs) {
                if (err) {
                    return cb(err);
                }
                docs.forEach(function (doc) {
                    if (searchList.indexOf(doc.filename) === -1 &&
                        ret.indexOf(doc.filename) === -1
                    ) {
                        ret.push(doc.filename);
                        searchList.push(doc.filename);
                    }
                });
                cb(null);
            });
        },
        function (err) {
            callback(err, ret);
        }
    );
}
function getAllParentDirs (files) {
    var map = files
        .map(function (file) {
            return path.dirname(file).split(path.sep);
        })
        .reduce(function (map, arr) {
            arr.reduce(function (p, c) {
                p = p + path.sep + c;
                map[p] = 1;
                return p;
            });
            return map;
        }, {});

    return Object.keys(map);
}

module.exports = Builder;