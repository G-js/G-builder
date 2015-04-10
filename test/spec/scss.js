var builder = require('../Gbuilder.js');
var assert = require('assert');
describe('scss builder', function () {
    it('build.clean', function (done) {
        builder.clean(done);
    });

    it('build susy.scss', function (done) {
        builder.build(['spec/scss/susy.scss'])
            .then(function (result) {
                assert.deepEqual(result.files, ['spec/scss/susy.scss'], 'there is only one file to build');
                assert.deepEqual(result.output, ['spec/scss/susy.css'], 'output should be rewrite to `css`');
                done();
            })
            .catch(done);
    });
});