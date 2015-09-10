var async = require('async');
var util = require('util');
var path = require('path');
var fs = require('fs');
var Database = require('nedb');
var minimatch = require('minimatch');
var EventEmitter = require('events').EventEmitter;
var _ = require('underscore');
var Promise =require('bluebird');
var glob = Promise.promisify(require('glob'));

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

    this.config.src = path.normalize(config.src + path.sep);
    this.config.dest = path.normalize(config.dest + path.sep);

    this.db.ensureIndex({
        fieldName: 'filename',
        unique: true
    }, function ignore () {});
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
    version:require('../builders/version')
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

GBuilder.prototype.remove = function (file) {
    var remove = Promise.promisify(this.db.remove).bind(this.db);

    return remove({
        filename: file
    });
};

GBuilder.prototype.build = function (files) {
    var self = this;
    var db = this.db;
    var src = self.config.src;
    var buildAllFiles = false;

    if (!Array.isArray(files)) {
        files = [];
    }

    if (!files.length) {
        buildAllFiles = true;
    }

    return Promise.resolve(files)
        .then(function () {
            var globs = [];
            if (buildAllFiles) {
                return glob('**/*', {cwd: src, nodir: true});
            }

            files = files.reduce(function (ret, file) {
                if (file.indexOf('*') !== -1) {
                    globs.push(glob(file, {cwd: src, nodir: true}));
                    return ret;
                }
                if (fs.statSync(src + file).isDirectory()) {
                    globs.push(
                        glob(
                            path.resolve('/', file, '**/*').replace(/^\//, ''),
                            {cwd: src, nodir: true}
                        )
                    );
                    return ret;
                }

                ret.push(file);

                return ret;
            }, []);

            return Promise.all(globs)
                .then(function (founds) {
                    founds.forEach(function (found) {
                        files = files.concat(found);
                    });
                    return getRelatedFiles(files, db)
                        .then(function (relates) {
                            return files.concat(relates);
                        });
                });
        })
        .then(_.unique)
        .reduce(function (report, file) {
            var builder  = self.getBuilder(file);
            file = new File(file, self);
            report.files.push(file.id);

            self.emit('build', file);

            return builder.run(file)
                .then(function () {
                    report.output = _.unique(report.output.concat(file.output));
                    return report;
                });
        }, {files: [], output: []});
};

function getRelatedFiles (searchList, db) {
    var ret = [];
    var find = Promise.promisify(db.find).bind(db);
    var hasMinimatchDeps = find({hasMinimatchDeps: true});
    searchList = searchList.slice();

    function quicksearch(file) {
        return hasMinimatchDeps
            .then(function (docs) {
                return docs.some(function (doc) {
                    return doc.deps.some(function (dep) {
                        if (dep.indexOf('*') === -1) {
                            return false;
                        }

                        if (file.indexOf(dep.split('*')[0]) === -1) {
                            return false;
                        }

                        return true;
                    });
                });
            });
    }

    function resolveDeps (file) {
        return quicksearch(file)
            .then(function (detect) {
                if (!detect) {
                    return [];
                }

                return hasMinimatchDeps
                    .then(function (docs) {
                        return docs.filter(function (doc) {
                            return doc.deps.some(function (dep) {
                                if (dep.indexOf('*') === -1) {
                                    return false;
                                }

                                return minimatch(file, dep);
                            });
                        });
                    });
            })
            .then(function (found) {
                return find({deps: file})
                    .then(function (docs) {
                        return found.concat(docs);
                    });
            })
            .then(function (found) {
                found.forEach(function (doc) {
                    if (searchList.indexOf(doc.filename) === -1 &&
                        ret.indexOf(doc.filename) === -1
                    ) {
                        ret.push(doc.filename);
                        searchList.push(doc.filename);
                    }
                });
            });
    }

    return new Promise(function (resolve, reject) {
        async.whilst(
            function () {
                return !!searchList.length;
            },
            function (next) {
                var file = searchList.shift();
                resolveDeps(file)
                    .nodeify(next);
            },
            function (err) {
                if (err) {
                    return reject(err);
                } else {
                    return resolve(ret);
                }
            }
        );
    });
}

module.exports = GBuilder;