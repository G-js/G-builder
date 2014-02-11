var path = require('path');
var async = require('async');
var fs = require('fs');
var URL_RE = /url\(('|")?(.*?)\1\)/g;

function CssBuilder (callback) {
    var src = this.config.src;
    var fileInfo = this.file;
    var deps = fileInfo.deps || [];
    var content = fileInfo.content;
    var match = null;
    var url = '';

    URL_RE.lastIndex = 0;

    while((match = URL_RE.exec(content))) {
        url = match[2];
        if (
            url[0] !== '/' &&
            url.indexOf('http') !== 0 &&
            url.replace(/ /g, '') !== 'about:blank'
        ) {
            url = path.resolve(src, path.dirname(fileInfo.id), url).replace(src, '');
            if (deps.indexOf(url) === -1) {
                deps.push(url);
            }
        }
    }

    fileInfo.deps = deps;

    fileInfo.output[fileInfo.id] = content;

    callback(null);
}

CssBuilder.minify = function (callback) {
    var cssmin = require('cssmin');
    var fileInfo = this.file;
    fileInfo.output[fileInfo.id] = cssmin(fileInfo.content);

    callback(null);
};

CssBuilder.combine = function (callback) {
    var src = this.config.src;
    var fileInfo = this.file;

    var deps = fileInfo.content.split('\n')
                            .filter(function (dep) {
                                return !!dep;
                            })
                            .map(function (dep) {
                                dep = path.resolve(src, path.dirname(fileInfo.id), dep)
                                            .replace(src, '');

                                return dep;
                            });

    async.map(
        deps,
        function (dep, next) {
            fs.readFile(src + dep, function (err, content) {
                if (err) {
                    next(err);
                } else {
                    next(null, fixImgUrl(dep, content.toString()));
                }
            });
        },
        function (err, contents) {
            if (err) {
                callback(err);
            }

            fileInfo.output[fileInfo.id] = contents.join('\n');
            fileInfo.deps = deps;
            callback(null);
        }
    );

    function fixImgUrl (file, content) {
        var url = '';
        URL_RE.lastIndex = 0;

        content = content.replace(URL_RE, function () {
            url = arguments[2];
            if (
                url[0] !== '/' &&
                url.indexOf('http') !== 0 &&
                url.replace(/ /g, '') !== 'about:blank'
            ) {
                url = path.resolve(src, path.dirname(file), url);
                url = path.relative(path.dirname(src + fileInfo.id), url);
            }

            return 'url("' + url + '")';
        });

        return content;
    }
};


module.exports = CssBuilder;