module.exports = function (grunt) {
    var src = grunt.config('src');
    var dest = grunt.config('dest');

    return function (file, callback) {
        grunt.file.copy(src + file, dest + file);
        callback(null, {
            output: [file]
        });
    }
}