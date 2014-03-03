var fs = require('fs');
var async = require('async');

module.exports = function (callback) {
    var fileInfo = this.file;
    var src = this.config.src;
    var children = fileInfo.content.replace(/\r/g, '').split('\n');

    fileInfo.deps = fileInfo.deps.concat(children);
    async.map(
        children,
        function (file, next) {
            fs.readFile(src + file, next);
        },
        function (err, buffers) {
            if (err) {
                return callback(err);
            }
            fileInfo.output[fileInfo.id] = buffers.map(function (buf) {
                return buf.toString();
            }).join('\n');

            callback(null);
        }
    );
};