var path = require('path');
var cssmin = require('cssmin');

var File = require('../lib/file.js');

var URL_RE = /url\(('|")?(.*?)\1\)/g;

function CssBuilder (file, callback) {
    var deps = file.deps;
    var content = file.content;
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
            url = path.resolve('/', path.dirname(file.id), url).replace(/^\//, '');
            if (deps.indexOf(url) === -1) {
                deps.push(url);
            }
        }
    }

    file.deps = file.deps.concat(deps);
    file.content = content;

    callback(null, file);
}

CssBuilder.minify = function (file, callback) {
    try {
        file.content = cssmin(file.content || '');
    } catch (ex) {
        return callback(ex);
    }

    callback(null, file);
};

CssBuilder.combine = function (file, callback) {
    var id = file.id;
    var deps = file.content.split('\n')
        .filter(function (dep) {
            return !!dep;
        })
        .map(function (dep) {
            return path.resolve('/', path.dirname(file.id), dep)
                    .replace(/^\//, '');
        });

    Promise.map(
        deps,
        function (dep) {
            dep = new File(dep);

            return dep.read()
                .then(function (content) {
                    return fixImgUrl(dep.id, content);
                });
        }
    )
        .then(function (contents) {
            file.content = contents.join('\n');
            file.deps = file.deps.concat(deps);

            callback(null, file);
        })
        .caught(callback);

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
                url = path.resolve('/', path.dirname(file), url);
                url = path.relative(path.dirname('/' + id), url);
            }

            return 'url("' + url + '")';
        });

        return content;
    }
};


module.exports = CssBuilder;