var Parser = require('less').Parser;
var _      = require('underscore');
var path   = require('path');

module.exports = function (callback) {
    var fileInfo = this.file;
    var src = this.config.src;
    var config = _.extend({
        silent: true,
        verbose: false,
        ieCompat: true,
        compress: false,
        cleancss: false,
        cleancssOptions: {},
        sourceMap: false,
        paths: [src, path.dirname(path.resolve(src + fileInfo.id))]
    }, this.config.less);
    var parser = new Parser(config);

    parser.parse(fileInfo.content, function (err, tree) {
        if (err) {
            return callback(err);
        }

        var imports = Object.keys(parser.imports.files)
                        .map(function (file) {
                            return path.resolve(src, path.dirname(fileInfo.id), file).replace(src, '');
                        });

        fileInfo.deps = fileInfo.deps.concat(imports);

        try {
            fileInfo.output[fileInfo.id.replace(/\.less$/, '.css')] = tree.toCSS();
        } catch (ex) {
            fileInfo.warns.push(ex);
            return callback(null);
        }

        callback(null);
    });
};