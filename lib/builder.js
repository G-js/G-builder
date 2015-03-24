var async = require('async');
var util = require('util');
var domain = require('domain');

var EventEmitter = require('events').EventEmitter;

function Builder () {
    this.queue = [];
}
util.inherits(Builder, EventEmitter);

Builder.prototype.pipe = function (fn) {
    this.queue.push(fn);

    return this;
};

Builder.prototype.read = function () {
    return this.pipe(require('../builders/fs').read);
};

Builder.prototype.write = function (config) {
    return this.pipe(require('../builders/fs').write(config));
};

Builder.prototype.copy = function () {
    return this.pipe(require('../builders/fs').copy);
};

Builder.prototype.uglify = function () {
    return this.pipe(require('../builders/uglify'));
};

Builder.prototype.jshint = function () {
    return this.pipe(require('../builders/jshint'));
};

Builder.prototype.concat = function () {
    return this.pipe(require('../builders/concat'));
};

Builder.prototype.ignore = function () {
    return this.pipe(require('../builders/ignore'));
};

Builder.prototype.run = function (file, callback) {
    var dom = domain.create();
    var self = this;

    dom.add(file);
    dom.add(callback);
    dom.add(async);
    dom.add(this);

    dom.on('error', callback);

    dom.run(function () {
        file.read()
            .then(function () {
                async.series(
                    self.queue.map(function (fn) {
                        return function (next) {
                            fn(file, next);
                        };
                    }),
                    function (err) {
                        if (err) {
                            return callback(err);
                        }

                        file.save().nodeify(callback);
                    }
                );
            })
            .caught(callback);
    });
};

module.exports = Builder;