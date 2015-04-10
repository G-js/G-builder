var builder = require('../Gbuilder.js');
var assert = require('assert');
describe('spec. file', function () {
    it('clean', function (done) {
        builder.clean(done);
    });

    it('build', function (done) {
        builder.build(['spec/file'])
            .then(function (result) {
                assert.deepEqual(result.files, ['spec/file/amd.js', 'spec/file/copy.txt'], 'there is only one file to build');
                assert.deepEqual(result.output, ['spec/file/amd.js', 'spec/file/copy.txt'], 'output should be rewrite to `css`');
                done();
            })
            .catch(done);
    });
});