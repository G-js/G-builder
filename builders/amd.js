var REQUIRE_RE = /[^.]\s*require\s*\(\s*(["'])([^'"\s\)]+)\1\s*\)/g;

module.exports = function (fileInfo, callback) {
    var content = fileInfo.content;
    var match = [];
    var deps = [];
    REQUIRE_RE.lastIndex = 0;

    while((match = REQUIRE_RE.exec(content))) {
        deps.push(match[2]);
    }

    deps = JSON.stringify(deps);
    fileInfo.content = 'define("' + fileInfo.id + '", ' + deps + ', function (require, exports, module) {\n' + content + '\n})';

    callback(null, fileInfo);
};