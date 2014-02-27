var fs = require('fs');
var async = require('async');
var util = require('util');
var path = require('path');
var Database = require('nedb');
var minimatch = require('minimatch');
var EventEmitter = require('events').EventEmitter;
var _ = require('underscore');

var BuilderStream = require('./build_stream.js');
var BuilderUtil = require('../util');
var cwd = process.cwd();

function Builder(config) {
    this.config = config || {};
    this.extraConfig = {};
    this.db = new Database({filename: this.config.db || cwd + '/.gbuild.db', autoload: true});
    this.builderMap = {};
    this.builderQueue = [];
    this.defaultBuilderStream = new BuilderStream(this);
    this.defaultBuilderStream.pipe(this.builder.ignore);
}

util.inherits(Builder, EventEmitter);

Builder.prototype.builder = {
    amd:    require('../builders/amd'),
    config: require('../builders/config'),
    css:    require('../builders/css'),
    fs:     require('../builders/fs'),
    ignore: require('../builders/ignore'),
    jshint: require('../builders/jshint'),
    less:   require('../builders/less'),
    uglify: require('../builders/uglify'),
    concat: require('../builders/concat')
};

Builder.prototype.registerBuilder = function () {
    var patterns = [].slice.call(arguments);
    var stream = new BuilderStream(this);
    var self = this;

    this.builderQueue = this.builderQueue.concat(patterns);
    patterns.forEach(function (pattern) {
        self.builderMap[pattern] = stream;
    });

    return stream;
};

Builder.prototype.registerDefaultBuilder = function (fn) {
    var stream = new BuilderStream(this);
    if (fn) {
        stream.pipe(fn);
    }

    this.defaultBuilderStream = stream;
    return stream;
};

Builder.prototype.getBuildStream = function (url) {
    var i = 0;
    var pattern;
    while (i < this.builderQueue.length) {
        pattern = this.builderQueue[i];
        if (minimatch(url, pattern)) {
            return this.builderMap[pattern];
        }
        i++;
    }
    return this.defaultBuilderStream;
};

Builder.prototype.processConfig = function (input, callback) {
    var self = this;
    var config = this.config;
    var src = config.src = path.resolve(cwd, config.src) + path.sep;

    if (!Array.isArray(input)) {
        callback = input;
        input = [];
    }

    async.waterfall([
        // get file list
        function (next) {
            next(null, input);
        },
        // get config files
        function (files, next) {
            var checkedDirs = [];

            var dirs = _.unique(files.map(path.dirname).sort(), true);

            var configFiles = dirs.reduce(function (list, dir) {
                if (checkedDirs.indexOf(dir) !== -1) {
                    return list;
                }

                dir.split(path.sep)
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
                            if (p === './') {
                                p = '';
                            }
                            p = src + p + 'g-config.json';
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
                    var config = configs[configFile] || {};
                    var dir = path.dirname(configFile);
                    var matchFiles = minimatch.match(files, dir + path.sep + '**/*', {});

                    files.push(configFile.replace(src, ''));

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

                    if (config.match) {
                        Object.keys(config.match).forEach(function (pattern) {
                            self.extraConfig[path.normalize(dir + path.sep + pattern)] = config.match[pattern];
                        });
                    }

                });

            files = files.filter(function (file) {
                return ignoreFiles.indexOf(path.resolve(src, file)) === -1;
            });

            files = _.unique(files.sort(), true);

            next(null, files);
        }
    ], callback);
};

Builder.prototype.build = function (input, options, callback) {
    var self = this;
    var workers = [];
    var src = path.normalize(self.config.src + path.sep);

    if (arguments.length === 2) {
        callback = options;

        if (!Array.isArray(input)) { // fn({}, cb);
            options = input;
            input = [];
        } else {                     // fn([], cb);
            options = {};
        }
    } else if (arguments.length === 1) { // fn(cb);
        callback = input;
        input = [];
        options = {};
    }

    if (options.buildAllFiles) {
        workers.push(function (done) {

            BuilderUtil.file.getAllFiles(src, function (err, files) {
                if (files) {
                    files = files.map(function (file) {
                        return file.replace(src, '');
                    });
                }
                done(err, files);
            });
        });
    } else if (options.buildRelatedFiles && input.length) {
        workers.push(function (done) {
            getRelatedFiles(input, self.db, function (err, files) {
                if (files) {
                    files = input.concat(files);
                }
                done(err, files);
            });
        });
    } else {
        workers.push(function (done) {
            done(null, input);
        });
    }

    workers.push(function (files, next) {
        self.processConfig(files, next);
    });

    workers.push(function (files, done) {
        self.emit('start', files);
        async.reduce(
            files,
            {
                files: [].slice.call(files),
                input: input,
                output: [],
                errors: {}
            },
            function (report, file, next) {
                var stream  = self.getBuildStream(file);
                var context = {
                    file: {
                        id: file,
                        output: [],
                        deps: [],
                        warns: []
                    },
                    db: self.db,
                    config: _.extend({}, self.config, self.extraConfig[file])
                };

                var extraConfig = Object.keys(self.extraConfig)
                    .filter(function (pattern) {
                        return minimatch(path.resolve(src, file), pattern);
                    })
                    .reduce(function (config, pattern) {
                        return _.extend(config, self.extraConfig[pattern]);
                    }, {});

                context.config = _.extend({}, self.config, extraConfig);

                self.emit('build', file);

                stream.run(context, function (err, fileInfo) {
                    if (fileInfo && fileInfo.output) {
                        report.output = report.output.concat(Object.keys(fileInfo.output));
                    }

                    if (err) {
                        report.errors[file] = err;
                        self.emit('fail', file, fileInfo);
                        return next(new Error('Error in building: ' + file), report);
                    }
                    self.updateFileInfo({
                        filename: fileInfo.id,
                        deps: _.unique(fileInfo.deps),
                        output: Object.keys(fileInfo.output)
                    }, function (err) {
                        if (!err) {
                            self.emit('success', file, fileInfo);
                        }

                        next(err, report);
                    });
                });
            },
            function (err, report) {
                self.emit('finish', err, report);
                done(err, report);
            }
        );
    });

    async.waterfall(
        workers,
        callback
    );
};

Builder.prototype.getIndex = function (callback) {
    this.db.find({}, function (err, docs) {
        if (err) {
            return callback(err);
        }


        var index = docs.reduce(function (index, doc) {
            index.files[doc.filename] = {
                last_update: doc.last_update
            };

            return index;
        }, {
            files: {},
            file_count: docs.length
        });

        return callback(null, index);
    });
};

Builder.prototype.updateFileInfo = function (fileInfo, callback) {
    this.db.update({filename: fileInfo.filename}, fileInfo, {upsert: true}, callback);
};

Builder.prototype.watch = function (onReady) {
    var self = this;
    var Gaze = require('gaze').Gaze;
    var src = this.config.src;
    var gaze = new Gaze(src + '/**/*');

    gaze.on('all', function (event, filepath) {
        filepath = filepath.replace(path.resolve(src) + '/', '');

        if (event !== 'deleted') {
            self.build([filepath], function (err) {
                self.emit('fail', err);
            });
        }
    });

    if (onReady) {
        gaze.on('ready', onReady);
    }

    return gaze;
};

function getRelatedFiles (searchList, db, callback) {
    var ret = [];
    searchList = searchList.slice();

    async.whilst(
        function () {
            return !!searchList.length;
        },
        function (cb) {
            var filename = searchList.shift();

            db.find({deps: filename}, function (err, docs) {
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