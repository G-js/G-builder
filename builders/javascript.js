var REQUIRE_RE = /[^.]\s*require\s*\(\s*(["'])([^'"\s\)]+)\1\s*\)/g;
var UglifyJS = require('uglify-js');
module.exports = function (grunt) {
    var src  = grunt.config('src');
    var dest = grunt.config('dest');
    var minify = grunt.option('compress');

    function JavaScriptBuilder (file, callback) {
        var content = grunt.file.read(src + file);
        var isCmbFile = /cmb\.js$/.test(file);
        var children = [];

        if (isCmbFile) {
            children = content.split(/\r?\n/).filter(function (file) {
                return !!file;
            });

            content = children.map(function (child) {
                return transport(child, grunt.file.read(src + child));
            }).join('\n');
        } else {
            content = transport(file, grunt.file.read(src + file));
        }

        if (minify) {
            try {
                content = UglifyJS.minify(content, {fromString: true}).code;
            } catch (ex) {
                return callback(ex.message + '[line:' + ex.line + ', column:' + ex.col + ']');
            }
        }

        grunt.file.write(dest + file, content);

        callback(null, {
            output: [file],
            children: children
        });
    }


    function transport (file, content) {
        var match = [];
        var deps = [];
        REQUIRE_RE.lastIndex = 0;

        while((match = REQUIRE_RE.exec(content))) {
            deps.push(match[2]);
        }

        deps = JSON.stringify(deps);

        content = 'define("' + file + '", ' + deps + ', function (require, exports, module) {\n' + content + '\n})';

        return content;
    }

    return JavaScriptBuilder;
};