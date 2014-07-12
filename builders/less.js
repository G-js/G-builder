var Parser = require('less').Parser;
var _      = require('underscore');
var path   = require('path');

var URL_RE = /url\(('|")?(.*?)\1\)/g;

function getChildResources (content, src, id) {
    var deps = [];
    var match;
    var url;
    URL_RE.lastIndex = 0;

    while((match = URL_RE.exec(content))) {
        url = match[2];
        if (
            url[0] !== '/' &&
            url.indexOf('http') !== 0 &&
            url.replace(/ /g, '') !== 'about:blank'
        ) {
            url = path.resolve(src, path.dirname(id), url);

            if (url.indexOf(src) !== 0) {
                break;
            } else {
                url = url.replace(src, '');
            }

            if (deps.indexOf(url) === -1) {
                deps.push(url);
            }
        }
    }

    return deps;
}

function LessBuilder (callback) {
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
        paths: [src],
        filename: src + fileInfo.id,
        relativeUrls: true,
        rootpath: this.config.server
    }, this.config.less);

    var parser = new Parser(config);

    fileInfo.deps = fileInfo.deps.concat(getChildResources(fileInfo.content, src, fileInfo.id));

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
            fileInfo.content = tree.toCSS();
        } catch (ex) {
            fileInfo.warns.push(ex);
            fileInfo.content = '';
        }

        callback(null);
    });
}

LessBuilder.writeAsCss = function (callback) {
    if (this.file.content) {
        this.file.output[this.file.id.replace(/\.less$/, '.css')] = this.file.content;
    }

    callback();
};


module.exports = LessBuilder;
