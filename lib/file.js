var minimatch = require('minimatch');
var Promise   = require('bluebird');
var path      = require('path');
var _         = require('underscore');
var fs        = require('fs');
var mkdirp    = require('mkdirp');

var readFile  = Promise.promisify(fs.readFile);
var writeFile = Promise.promisify(fs.writeFile);

var ensureDir = function (dir) {
    return new Promise(function (res, rej) {
        fs.exists(dir, function (exists) {
            if (exists) {
                return res();
            }

            mkdirp(dir, function (err) {
                if (err) {
                    rej(err);
                } else {
                    res();
                }
            });
        });
    });
};

function File (id, builder) {
    this.id = id;

    this.rawContent = '';
    this.content = '';
    this.rawBuffer = null;
    this.builder = builder;
    this.deps = [];
    this.output = [];
}

module.exports = File;

File.prototype.copy = Promise.method(function () {
    var src = path.resolve(this.builder.config.src, this.id);
    var dest = path.normalize(this.builder.config.dest + '/' + this.id);

    this.output.push(dest.replace(this.builder.config.dest, ''));

    return ensureDir(path.dirname(dest))
        .then(function () {
            return readFile(src);
        })
        .then(function (buffer) {
            return writeFile(dest, buffer);
        });
});

File.prototype.read = Promise.method(function (file) {
    var self = this;
    var src = this.builder.config.src;
    var reset = false;
    if (file) {
        if (file.indexOf('.') === 0) {
            file = path.resolve(src, this.id, file);
        } else {
            file = path.resolve(src, file);
        }
    } else {
        file = path.resolve(src, this.id);
        reset = true;
    }

    return readFile(file).then(function (buffer) {
        if (reset) {
            self.rawBuffer = buffer;
            self.rawContent = buffer.toString();
            self.content = self.rawContent;
        }

        return buffer.toString();
    });
});

File.prototype.write = Promise.method(function (config) {
    var dest = path.normalize(this.builder.config.dest + '/' + this.id);
    var self = this;
    config = config || {};
    if (config.rewrite) {
        dest = dest.replace(config.rewrite[0], config.rewrite[1]);
    }

    this.output.push(dest.replace(this.builder.config.dest, ''));
    return ensureDir(path.dirname(dest))
        .then(function () {
            return writeFile(dest, self.content);
        });
});

File.prototype.save = Promise.method(function () {
    var self = this;
    var hasMinimatchDeps = this.deps.some(function (dep) {
        return dep.indexOf('*') !== -1;
    });

    return new Promise(function (resolve, reject) {
        self.builder.db.update(
            {filename: self.id},
            {
                filename: self.id,
                version: Date.now(),
                deps: self.deps,
                output: self.output,
                hasMinimatchDeps: hasMinimatchDeps
            },
            {upsert: true},
            function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            }
        );
    });
});

File.prototype.getDependences = Promise.method(function () {
    var builder = this.builder;
    var find = Promise.promisify(builder.db.find).bind(builder.db);
    var deps = this.deps;
    var id = this.id;

    return Promise.resolve(deps)
        .then(function (deps) {
            if (deps && deps.length) {
                return deps;
            }

            return find({ filename: id })
                .then(function (docs) {
                    var doc;
                    if (!docs || !docs.length) {
                        return [];
                    }

                    doc = docs[0];

                    if (!doc.deps || !doc.deps.length) {
                        return [];
                    } else {
                        return doc.deps;
                    }
                });
        })
        .then(function (deps) {
            var hasMinimatchDeps = deps.some(function (dep) {
                return dep.indexOf('*') !== -1;
            });

            if (!hasMinimatchDeps) {
                return deps;
            }

            return Promise.reduce(
                deps,
                function (ret, dep) {
                    if (dep.indexOf('*') === -1) {
                        ret.push(dep);
                        return ret;
                    } else {
                        return find({
                            filename: {
                                $regex: minimatch.makeRe(dep)
                            }
                        })
                            .then(function (docs) {
                                docs = docs || [];

                                return ret.concat((docs || []).map(function (doc) {
                                    return doc.filename;
                                }));
                            });
                    }
                },
                []
            );
        })
        .then(_.unique)
        .filter(function (file) {
            return file !== id;
        })
        .map(function (file) {
            return new File(file, builder);
        });
});

File.prototype.addDependences = function (deps) {
    this.deps = _.unique(this.deps.concat(deps));
    this.hasMinimatchDeps = this.deps.some(function (dep) {
        return dep.indexOf('*') !== -1;
    });
};

File.prototype.getVersion = Promise.method(function () {
    return Promise.promisify(this.builder.db.findOne).bind(this.builder.db)({filename: this.id})
        .then(function (doc) {
            return doc ? doc.version : null;
        });
});

File.prototype.getAbsolutePath = function () {
    return path.normalize(this.builder.config.src + '/' + this.id);
};