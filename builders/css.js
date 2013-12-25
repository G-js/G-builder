var path = require('path');
var async = require('async');
var fs = require('fs');
var URL_RE = /url\(('|")?(.*?)\1\)/g;

function CssBuilder (fileInfo, callback) {
    var src = this.config.src;
    var children = fileInfo.children || [];
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
            if (children.indexOf(url) === -1) {
                children.push(url);
            }
        }
    }

    fileInfo.children = children;
    callback(null, fileInfo);
}

CssBuilder.minify = function (fileInfo, callback) {
    var cssmin = require('cssmin');

    fileInfo.content = cssmin(fileInfo.content);
    callback(null, fileInfo);
};

CssBuilder.combine = function (fileInfo, callback) {
    var src = this.config.src;

    var children = fileInfo.content.split('\n')
                            .filter(function (child) {
                                return !!child;
                            })
                            .map(function (child) {
                                child = path.resolve(src, path.dirname(fileInfo.id), child)
                                            .replace(src, '');

                                return child;
                            });

    async.map(
        children,
        function (child, next) {
            fs.readFile(src + child, function (err, content) {
                if (err) {
                    next(err);
                } else {
                    next(null, fixImgUrl(child, content.toString()));
                }
            });
        },
        function (err, contents) {
            if (err) {
                callback(err, fileInfo);
            }

            fileInfo.content = contents.join('\n');
            fileInfo.children = children;
            callback(null, fileInfo);
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