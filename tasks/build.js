var Builder = require('../lib/build');
var _       = require('underscore');

module.exports = function (grunt) {
    grunt.registerTask('build', function () {
        var done  = this.async();
        var config = _.extend({ input: [].slice.call(arguments) }, grunt.config());
        var builder = new Builder(config);
        var current = 1;
        var total;

        builder.on('start', function (file) {
            grunt.log.write('Build:[%d/%d]: %s', current, total, file);
        });

        builder.on('error', function () {
            grunt.log.writeln(' ERR'.red);
        });

        builder.on('success', function () {
            current++;
            grunt.log.writeln(' √'.green);
        });

        builder.on('ready', function (files) {
            total = files.length;

            builder.build(function (err, report) {
                var failCount = Object.keys(report.error).length;

                grunt.file.write('reports/' + report.token, JSON.stringify({
                    taskName: report.taskName,
                    input: report.input,
                    files: report.files,
                    output: report.output,
                    error: report.error
                }, null, 4));

                if (failCount) {
                    grunt.log.writeln('Finish with %d Errors'.red, failCount);
                    Object.keys(report.error).forEach(function (key) {
                        grunt.log.writeln(key);
                        grunt.log.writelns(report.error[key]);
                    });
                    grunt.log.writeln('');
                    done(false);
                } else {
                    done(true);
                }
            });
        });
    });
};