var minimatch = require('minimatch');
var Promise   = require('bluebird');
var mkdirp    = require('mkdirp');
var path      = require('path');
var _         = require('underscore');
var fs        = require('fs');

var readFile  = Promise.promisify(fs.readFile);
var readDir   = Promise.promisify(fs.readdir);
var stat      = Promise.promisify(fs.stat);

var writeFile = Promise.promisify(function (file, content, callback) {
    Promise.promisify(mkdirp)(path.dirname(file))
        .then(function () {
            fs.writeFile(file, content, callback);
        })
        .caught(callback);
});

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

File.prototype.readDir = Promise.method(function (dir) {
    var src = this.builder.config.src;

    if (dir.indexOf('.') === 0) {
        dir = path.resolve(src, this.id, dir);
    } else {
        dir = path.resolve(src, dir);
    }

    return readDir(dir).then(function (list) {
        return Promise.reduce(
            list,
            function (ret, item) {
                return stat(dir + '/' + item)
                    .then(function (stat) {
                        ret[item] = stat;
                        return ret;
                    });
            },
            {}
        );
    });
});

File.prototype.write = Promise.method(function (config) {
    var dest = path.normalize(this.builder.config.dest + '/' + this.id);

    config = config || {};
    if (config.rewrite) {
        dest = dest.replace(config.rewrite[0], config.rewrite[1]);
    }

    this.output.push(dest.replace(this.builder.config.dest, ''));
    return writeFile(dest, this.content);
});

File.prototype.save = Promise.method(function () {
    var self = this;
    return new Promise(function (resolve, reject) {
        self.builder.db.update(
            {filename: self.id},
            {
                filename: self.id,
                version: Date.now(),
                deps: self.deps
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
    var deps = this.deps;
    var builder = this.builder;

    return Promise.promisify(builder.db.find)({})
        .then(function (docs) {
            var keys = docs.map(function (doc) {
                return doc.filename;
            });

            return deps.reduce(function (deps, dep) {
                if (dep.indexOf('*') === -1) {
                    deps.push(new File(dep, builder));
                } else {
                    deps = deps.concat(minimatch.match(keys, dep).map(function (file) {
                        return new File(file, builder);
                    }));
                }

                return deps;
            }, []);
        });
});

File.prototype.getDependence = Promise.method(function (file) {
    // TODO: check file is in dependence list
    return new File(file, this.builder);
});

File.prototype.addDependences = function (deps) {
    this.deps = _.unique(this.deps.concat(deps));
};

File.prototype.getVersion = Promise.method(function () {
    return Promise.promisify(this.builder.db.findOne)({id: this.id})
        .then(function (doc) {
            return doc ? doc.version : null;
        });
});

File.prototype.getAbsolutePath = function () {
    return path.normalize(this.builder.config.src + '/' + this.id);
};