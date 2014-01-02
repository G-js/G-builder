var config = require('./config');
module.exports = function (grunt) {
    grunt.initConfig(config);

    // load npm tasks

    require('../grunt/tasks/build')(grunt);
    grunt.registerTask('default', ['build']);
};