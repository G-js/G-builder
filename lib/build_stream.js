var async = require('async');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

function BuilderStream () {
    this.queue = [];
}
util.inherits(BuilderStream, EventEmitter);

BuilderStream.prototype.pipe = function (fn) {
    if (typeof fn !== 'function') {
        throw new TypeError('pipe must be a function');
    }

    this.queue.push(function (context) {
        return function (callback) {
            fn.call(context, callback);
        };
    });

    return this;
};

BuilderStream.prototype.src = function () {
    return this.pipe(require('../builders/fs').read);
};

BuilderStream.prototype.dest = function () {
    return this.pipe(require('../builders/fs').write);
};

BuilderStream.prototype.conditionPipe = function (bool, fn) {
    if (bool) {
        this.pipe(fn);
    }

    return this;
};

BuilderStream.prototype.run = function (context, callback) {
    async.series(
        this.queue.map(function (fn) {
            return fn(context);
        }),
        function (err) {
            callback(err, context.file);
        }
    );
};

module.exports = BuilderStream;