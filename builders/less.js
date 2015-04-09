var Parser = require('less').Parser;
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

function LessBuilder (file, callback) {
    var src = file.builder.config.src;
    var config = {
        silent: true,
        verbose: false,
        ieCompat: true,
        compress: false,
        cleancss: false,
        cleancssOptions: {},
        sourceMap: false,
        paths: [src],
        filename: src + file.id,
        relativeUrls: true,
        rootpath: ''
    };
    var parser = new Parser(config);

    file.addDependences(getChildResources(file.content, src, file.id));

    parser.parse(file.content, function (err, tree) {
        if (err) {
            return callback(err);
        }

        var imports = Object.keys(parser.imports.files)
                        .map(function (file) {
                            return path.resolve(src, path.dirname(file.id), file).replace(src, '');
                        });

        file.addDependences(imports);

        try {
            file.content = tree.toCSS();
        } catch (ex) {
            file.content = '';
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
