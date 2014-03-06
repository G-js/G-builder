var fs = require('fs');

var cwd = process.cwd();
var builder;

if (fs.existsSync(cwd + '/Gbuilder.js')) {
    builder = require(cwd + '/Gbuilder.js');
} else {
    throw new Error('Gbuilder.js not found');
}

module.exports = function (grunt) {
    grunt.registerTask('build', function () {
        var done  = this.async();
        var input = [].slice.call(arguments);
        var current = 1;
        var token = grunt.option('token') || Date.now();
        var total;

        builder.on('build', function (file) {
            grunt.log.write('Build:[%d/%d]: %s', current, total, file);
        });

        builder.on('fail', function () {
            grunt.log.writeln(' ERR'.red);
        });

        builder.on('success', function () {
            current++;
            grunt.log.writeln(' √'.green);
        });

        builder.on('start', function (files) {
            total = files.length;
            grunt.log.writeln('Start Build: [%d] files...', total);
        });

        builder.build(input, {buildAllFiles: !input.length, buildRelatedFiles: !!input.length}, function (err, report) {
            if (report) {
                if (Object.keys(report.errors).length) {
                    Object.keys(report.errors).forEach(function (file) {
                        grunt.log.writelns(report.errors[file]);
                    });
                }

                grunt.file.write('reports/' + token, JSON.stringify({
                    input: report.input,
                    files: report.files,
                    output: report.output,
                    errors: report.errors
                }, null, 4));

                done(true);
            } else {
                grunt.log.error(err);
                done(false);
            }
        });

    });
};