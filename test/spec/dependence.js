var assert = require('assert');

var builder = require('../Gbuilder.js');
var File = require('../../lib/file.js');

describe('dependence', function () {
    it('build.clean', function (done) {
        builder.clean(done);
    });

    it('build files', function (done) {
        builder.build(['spec/dependence'])
            .then(function () {
                done();
            })
            .catch(done);
    });

    it('check dependence', function (done) {
        var file = new File('spec/dependence/index.cmb.js', builder);

        file.getDependences()
            .then(function (deps) {
                assert.deepEqual([
                    'spec/dependence/a.js',
                    'spec/dependence/b.js'
                ], deps.map(function (dep) {
                    return dep.id;
                }));
                done();
            })
            .caught(done);
    });

    it('check minimatch dependence', function (done) {
        var file = new File('spec/dependence/version.json', builder);

        file.getDependences()
            .then(function (deps) {
                deps = deps.map(function (dep) {
                    return dep.id;
                }).sort();

                assert.deepEqual(deps, [
                    'spec/dependence/a.js',
                    'spec/dependence/b.js',
                    'spec/dependence/index.cmb.js']);
            })
            .nodeify(done);
    });
});