var spawn = require('child_process').spawn;
var chokidar = require('chokidar');
var path = require('path');
var platform = process.platform;
var pathSplit = '/';

if (platform === 'win32') {
    pathSplit = '\\';
}

module.exports = function(grunt) {
    grunt.registerTask('watch', function() {
        var src = grunt.config('src');
        this.async();

        var watcher = chokidar.watch(src, {ignored: /[\/\\]\./, persistent: true});
        var buffer = [];
        var timer = null;
        watcher
            .on('ready', function () {
                grunt.log.subhead('Watching...');
            })
            .on('change', function(filepath) {
                filepath = filepath.replace(path.resolve(src) + pathSplit, '');

                buffer.push(filepath);
                grunt.log.writeln('CHANGED:', filepath);
                clearTimeout(timer);
                timer = setTimeout(function () {
                    build(buffer);
                    buffer = [];
                }, 300);
            });

        function build(files) {
            var cmd = 'grunt';

            if (platform === 'win32') {
                files = files.map(function (file) {
                    return file.replace(/\\/g, '/');
                });
                cmd = 'grunt.cmd';
            }

            var child = spawn(cmd, ['build:'+ files.join(':')]);
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
