var Builder = require('../../lib/build');
var _       = require('underscore');

module.exports = function (grunt) {
    grunt.registerTask('build', function () {
        var done  = this.async();
        var config = _.extend({ input: [].slice.call(arguments) }, grunt.config());
        var builder = new Builder(config);
        var current = 1;
        var token = grunt.option('token') || Date.now();
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
                if (report) {
                    grunt.file.write('reports/' + token, JSON.stringify({
                        input: report.input,
                        files: report.files,
                        output: report.output,
                        errors: report.errors
                    }, null, 4));

                    if (Object.keys(report.errors).length) {
                        Object.keys(report.errors).forEach(function (file) {
                            grunt.log.writeln(file);
                            grunt.log.writelns(report.errors[file]);
                        });
                        done(false);
                    } else {
                        done(true);
                    }
                } else {
                    grunt.log.error(err);
                    done(false);
                }
            });
        });
    });
};