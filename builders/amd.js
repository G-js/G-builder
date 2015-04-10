var Promise = require('bluebird');
var _ = require('underscore');

var REQUIRE_RE = /"(?:\\"|[^"])*"|'(?:\\'|[^'])*'|\/\*[\S\s]*?\*\/|\/(?:\\\/|[^\/\r\n])+\/(?=[^\/])|\/\/.*|\.\s*require|(?:^|[^$])\brequire\s*\(\s*(["'])(.+?)\1\s*\)/g;
var SLASH_RE = /\\\\/g;

function AMDBuilder (file, callback) {
    file.content = transport(file.id, file.content);

    callback(null, file);
}

AMDBuilder.combine = function (file, callback) {
    var deps = file.content.replace(/\r/g, '').split('\n')
        .filter(function (file) {
            return !!file;
        });

    file.addDependences(deps);

    Promise.map(
        file.getDependences(),
        function (file) {
            return file.read()
                .then(function (content) {
                    return transport(file.id, content);
                });
        }
    )
        .then(function (contents) {
            file.content = contents.join('\n');
            callback(null, file);
        })
        .caught(callback);
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

    return 'define("' + filename.replace(/\\/g, '/') + '", ' + deps + ', function (require, exports, module) {\n' + content + '\n});';
}

module.exports = AMDBuilder;