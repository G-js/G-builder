var minimatch = require('minimatch');
var Promise   = require('bluebird');
var mkdirp    = require('mkdirp');
var path      = require('path');
var _         = require('underscore');
var fs        = require('fs');

var readFile  = Promise.promisify(fs.readFile);

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
                deps: self.deps,
                output: self.output
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
    return find({ filename: this.id })
        .then(function (docs) {
            if (docs && docs.length && docs[0].deps && docs[0].deps.length) {
                deps = _.unique(deps.concat(docs[0].deps));
            }

            return deps;
        })
        .reduce(function (ret, dep) {
            return find({
                filename: {
                    $regex: minimatch.makeRe(dep)
                }
            })
                .then(function (docs) {
                    if (!docs.length) {
                        ret.push(dep);
                        return ret;
                    }

                    return ret.concat(docs.map(function (doc) {
                        return doc.filename;
                    }));
                });
        }, [])
        .then(_.unique)
        .map(function (file) {
            return new File(file, builder);
        });
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