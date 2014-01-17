var fs = require('fs');
var async = require('async');
var util = require('util');
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
    var src = config.src = path.resolve(cwd, config.src) + path.sep;
    config.dest = path.resolve(cwd, config.dest) + path.sep;

    this.config = config;
    this.files = [];
    this.extraConfig = {};

    async.waterfall([
        // get file list
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
        },
        // get config files
        function (files, next) {
            var checkedDirs = [];
            var configFiles = files.reduce(function (list, file) {
                path.dirname(file)
                    .split(path.sep)
                    .reduce(function (paths, part) {
                        if (!paths.length) {
                            part = part + path.sep;
                        } else {
                            part = paths[paths.length - 1] + part + path.sep;
                        }

                        paths.push(part);

                        return paths;
                    }, [])
                    .forEach(function (p) {
                        if (checkedDirs.indexOf(p) === -1) {
                            checkedDirs.push(p);
                            p = src + p + 'g-build-config.json';
                            if (fs.existsSync(p)) {
                                list.push(p);
                            }
                        }
                    });
                return list;
            }, []);

            next(null, files, configFiles);
        },
        // map config files
        function (files, configFiles, next) {
            var map = configFiles.reduce(function (map, file) {
                map[file] = require(file);
                return map;
            }, {});

            next(null, files, map);
        },
        // handle config
        function (files, configs, next) {
            var ignoreFiles = [];
            Object.keys(configs)
                .forEach(function (configFile) {
                    var config = configs[configFile];
                    var dir = path.dirname(configFile).replace(src, '');
                    var matchFiles = minimatch.match(files, dir + path.sep + '**/*', {});

                    ignoreFiles.push(configFile.replace(src, ''));

                    if (config.only) {
                        config.only = config.only
                                        .map(function (file) {
                                            return path.normalize(dir + path.sep + file);
                                        });

                        matchFiles
                            .forEach(function (file) {
                                if (config.only.indexOf(file) === -1) {
                                    ignoreFiles.push(file);
                                }
                            });
                    }

                    if (config.ignore) {
                        config.ignore
                            .forEach(function (file) {
                                file = path.normalize(dir + path.sep + file);
                                ignoreFiles.push(file);
                            });
                    }

                    if (config.extra) {
                        Object.keys(config.extra).forEach(function (pattern) {
                            self.extraConfig[path.normalize(dir + path.sep + pattern)] = config.extra[pattern];
                        });
                    }
                });

            files = files.filter(function (file) {
                return ignoreFiles.indexOf(file) === -1;
            });

            next(null, files);
        }
    ], function (err, files) {
        if (err) {
            throw err;
        }

        self.files = files;

        self.emit('ready', self.files);
    });
}

util.inherits(Builder, EventEmitter);

Builder.prototype.build = function (callback) {
    var self = this;
    async.reduce(
        this.files,
        {
            files: [].slice.call(this.files),
            output: [],
            errors: {}
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
                            report.output = report.output.concat(Object.keys(fileInfo.output));
                        }

                        if (err) {
                            report.errors[file] = err;
                            self.emit('error', file, fileInfo);
                            return next(err, report);
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

    Object.keys(this.extraConfig).forEach(function (pattern) {
        if (minimatch(filename, pattern)) {
            _.extend(config, self.extraConfig[pattern]);
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
        try {
            fn = require('../builders/' + worker[0]);
        } catch (ex) {
            throw new Error('cannot find worker:' + worker[0]);
        }


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

module.exports = Builder;