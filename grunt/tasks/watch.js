var path = require('path');
var spawn = require('child_process').spawn;
var Gaze = require('gaze').Gaze;
var platform = process.platform;

module.exports = function(grunt) {
    grunt.registerTask('watch', function() {
        var src = grunt.config('src');

        this.async();

        var gaze = new Gaze(src + '/**/*');

        grunt.log.subhead('Watching...');

        gaze.on('all', function (event, filepath) {
			var pathSplit = '/';
			if(platform === 'win32') {
				pathSplit = '\\';
			}
            filepath = filepath.replace(path.resolve(src) + pathSplit, '');
            grunt.log.writeln('%s: %s', event.toUpperCase(), filepath);
			
            if (event !== 'deleted') {
                build(filepath);
            }
        });

        function build(file) {
			var cmd = 'grunt';
			
			if(platform === 'win32') {
				file = file.replace(/\\/g, '/');
				cmd = 'grunt.cmd';
			}
			
            var child = spawn(cmd, ['build:'+file]);
            var output = '', errorMsg = '';
			
            child.stdout.on('data', function (data) {
                output += data;
            });

            child.stderr.on('data', function (data) {
				console.log(1, data);
                errorMsg += data;
            });

            child.on('exit', function (code) {
                if (code !== 0) {
					console.log("error");
                    grunt.log.error(errorMsg || output);
                    return;
                }
                grunt.log.writelns(output);
            });
        }
    });
};
