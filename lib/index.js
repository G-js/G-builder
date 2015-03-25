var async = require('async');
var util = require('util');
var path = require('path');
var Database = require('nedb');
var minimatch = require('minimatch');
var EventEmitter = require('events').EventEmitter;
var _ = require('underscore');
var Promise =require('bluebird');
var glob = require('glob');

var File = require('./file');
var Builder = require('./builder.js');
var cwd = process.cwd();

function GBuilder(config) {
    this.config = config || {};
    this.db = new Database({filename: this.config.db || cwd + '/.gbuild.db', autoload: true});
    this.builderMap = {};
    this.builderQueue = [];
    this.defaultBuilder = new Builder(this);
    this.defaultBuilder.pipe(GBuilder.builder.ignore);

    this.config.src = path.resolve(cwd, config.src) + path.sep;
    this.config.dest = path.resolve(cwd, config.dest) + path.sep;
}

util.inherits(GBuilder, EventEmitter);

GBuilder.builder = {
    amd:    require('../builders/amd'),
    css:    require('../builders/css'),
    fs:     require('../builders/fs'),
    ignore: require('../builders/ignore'),
    jshint: require('../builders/jshint'),
    less:   require('../builders/less'),
    uglify: require('../builders/uglify'),
    concat: require('../builders/concat'),
    sass:   require('../builders/sass')
};

GBuilder.prototype.clean = function (callback) {
    var dest = this.config.dest;
    this.db.remove({}, function (err) {
        if (err) {
            return callback(err);
        }

        require('child_process').exec('rm -rf ' + dest, callback);
    });
};

GBuilder.prototype.registerBuilder = function () {
    var patterns = [].slice.call(arguments);
    var stream = new Builder(this);
    var self = this;

    this.builderQueue = this.builderQueue.concat(patterns);
    patterns.forEach(function (pattern) {
        self.builderMap[pattern] = stream;
    });

    return stream;
};

GBuilder.prototype.registerDefaultBuilder = function (fn) {
    var stream = new Builder(this);
    if (fn) {
        stream.pipe(fn);
    }

    this.defaultBuilder = stream;
    return stream;
};

GBuilder.prototype.getBuilder = function (url) {
    var i = 0;
    var pattern;
    while (i < this.builderQueue.length) {
        pattern = this.builderQueue[i];
        if (minimatch(url, pattern)) {
            return this.builderMap[pattern];
        }
        i++;
    }
    return this.defaultBuilder;
};

GBuilder.prototype.build = function (files, callback) {
    var self = this;
    var src = path.normalize(self.config.src + path.sep);
    var buildAllFiles = false;
    if (typeof files === 'function') {
        callback = files;
        files = [];
    }

    if (!files.length) {
        files = ['**/*'];
        buildAllFiles = true;
    }

    async.auto({
        files: function (next) {
            Promise.reduce(
                files,
                function (ret, file) {
                    return new Promise(function (resolve, reject) {
                        glob(file, {cwd: src, nodir: true}, function (err, list) {
                            if (err) {
                                reject(err);
                            } else {
                                ret = ret.concat(list);
                                resolve(ret);
                            }
                        });
                    });
                },
                []
            )
                .then(function (files) {
                    if (buildAllFiles) {
                        return next(null, files);
                    }

                    getRelatedFiles(files, self.db, function (err, relates) {
                        if (err) {
                            next(err);
                        } else {
                            next(null, files.concat(relates));
                        }
                    });
                })
                .caught(next);
        },
        output: ['files', function (next, results) {
            var files = results.files;

            async.reduce(
                files,
                [],
                function (output, file, next) {
                    var builder  = self.getBuilder(file);
                    file = new File(file, self);
                    self.emit('build', file);

                    builder.run(file, function (err) {
                        self.emit('buildFinish', err);

                        if (err) {
                            return next(err);
                        }

                        next(null, _.unique(output.concat(file.output)));
                    });
                },
                next
            );
        }]
    }, callback);
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

            db.find({}, function (err, docs) {
                if (err) {
                    return cb(err);
                }
                docs
                    .filter(function (doc) {
                        var match;
                        if (!doc.deps) {
                            return false;
                        }
                        if (doc.deps.indexOf(filename) !== -1) {
                            return true;
                        }

                        match = doc.deps.some(function (pattern) {
                            return minimatch(filename, pattern);
                        });

                        if (match) {
                            return true;
                        }

                        return false;
                    })
                    .forEach(function (doc) {
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

module.exports = GBuilder;