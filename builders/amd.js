var fs = require('fs');
var REQUIRE_RE = /"(?:\\"|[^"])*"|'(?:\\'|[^'])*'|\/\*[\S\s]*?\*\/|\/(?:\\\/|[^\/\r\n])+\/(?=[^\/])|\/\/.*|\.\s*require|(?:^|[^$])\brequire\s*\(\s*(["'])(.+?)\1\s*\)/g;
var SLASH_RE = /\\\\/g;
var _ = require('underscore');

function AMDBuilder (callback) {
    var fileInfo = this.file;
    fileInfo.content = transport(fileInfo.id, fileInfo.content);

    callback(null);
}

AMDBuilder.combine = function (callback) {
    var config = this.config;
    var fileInfo = this.file;
    fileInfo.deps = fileInfo.content.replace(/\r/g, '').split('\n')
                        .filter(function (file) {
                            return !!file;
                        });

    fileInfo.content = fileInfo.deps
                        .map(function (child) {
                            return transport(child, fs.readFileSync(config.src + child).toString());
                        })
                        .join('\n');

    callback(null);
};

function parseDependencies(code) {
    var ret = [];

    code.replace(SLASH_RE, '')
        .replace(REQUIRE_RE, function(m, m1, m2) {
            if (m2) {
                ret.push(m2);
            }
        });

    return _.unique(ret.sort(), true);
}

function transport (filename, content) {
    var deps = JSON.stringify(parseDependencies(content));

    return 'define("' + filename.replace(/\\/g, '/') + '", ' + deps + ', function (require, exports, module) {' + content + '});';
}

module.exports = AMDBuilder;