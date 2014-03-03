var fs = require('fs');

var REQUIRE_RE = /[^.]\s*require\s*\(\s*(["'])([^'"\s\)]+)\1\s*\)/g;

function AMDBuilder (callback) {
    var fileInfo = this.file;
    fileInfo.output[fileInfo.id] = transport(fileInfo.id, fileInfo.content);

    callback(null);
}

AMDBuilder.combine = function (callback) {
    var config = this.config;
    var fileInfo = this.file;
    fileInfo.deps = fileInfo.content.replace(/\r/g, '').split('\n')
                        .filter(function (file) {
                            return !!file;
                        });

    fileInfo.output[fileInfo.id] = fileInfo.deps
                        .map(function (child) {
                            return transport(child, fs.readFileSync(config.src + child));
                        })
                        .join('\n');

    callback(null);
};

function transport (filename, content) {
    var match = [];
    var deps = [];
    REQUIRE_RE.lastIndex = 0;

    while((match = REQUIRE_RE.exec(content))) {
        deps.push(match[2]);
    }

    deps = JSON.stringify(deps);
    return 'define("' + filename + '", ' + deps + ', function (require, exports, module) {\n' + content + '\n})';
}

module.exports = AMDBuilder;