var util = require('util');
var Promise = require('bluebird');
var EventEmitter = require('events').EventEmitter;

function Builder () {
    this.queue = [];
}
util.inherits(Builder, EventEmitter);

Builder.prototype.pipe = function (fn) {
    if (typeof fn !== 'function') {
        throw new Error('piper must be a function');
    }

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

Builder.prototype.run = function (file) {
    var self = this;
    var promise = file.read();

    self.queue.forEach(function (fn) {
        promise = promise.then(function () {
            return new Promise(function (resolve, reject) {
                fn(file, function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        });
    });

    return promise
        .then(function () {
            return file.save();
        });
};

module.exports = Builder;