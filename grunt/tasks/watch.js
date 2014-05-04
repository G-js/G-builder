var spawn = require('child_process').spawn;
var gaze = require('gaze');
var fs = require('fs');

module.exports = function(grunt) {
    grunt.registerTask('watch', function() {
        var src = grunt.config('src');

        this.async();

        gaze(src + '/**/*', {mode: 'poll'}, function (err) {
            if (err) {
                console.error(err);
                return;
            }
            grunt.log.subhead('Watching...');

            // On file changed
            this.on('changed', function(filepath) {
                filepath = filepath.replace(src, '');

                build(filepath);
            });

            // On file added
            this.on('added', function(filepath) {
                fs.stat(filepath, function (err, stat) {
                    if (stat.isFile) {
                        build(filepath.replace(src, ''));
                    }
                });
            });

            this.on('all', function (event, filepath) {
                console.log(event, filepath.replace(src, ''));
            });
        });

        function build(file) {
            var child = spawn('grunt', ['build:' + file]);
            var output = '', errorMsg = '';

            child.stdout.on('data', function (data) {
                output += data;
            });

            child.stderr.on('data', function (data) {
                errorMsg += data;
            });

            child.on('exit', function (code) {
                if (code !== 0) {
                    grunt.log.error(errorMsg || output);
                    return;
                }
                grunt.log.writelns(output);
            });
        }
    });
};
