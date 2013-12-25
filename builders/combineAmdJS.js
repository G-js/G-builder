var async = require('async');
var amdBuilder = require('./amd');
var fs = require('fs');

module.exports = function (fileInfo, callback) {
    var config = this.config;
    fileInfo.children = fileInfo.content.split('\n').filter(function (file) {return !!file; });

    async.map(
        fileInfo.children,
        function (child, next) {
            amdBuilder(
                {
                    id: child,
                    content: fs.readFileSync(config.src + child)
                },
                function (err, childFile) {
                    childFile = childFile || {};
                    next(err, childFile.content);
                }
            );
        },
        function (err, children) {
            children = Array.isArray(children) ? children : [];
            fileInfo.content = children.join('\n');
            callback(err, fileInfo);
        }
    );
};