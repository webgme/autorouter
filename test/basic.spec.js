/*globals describe*/
/*jshint node:true, mocha:true*/
/**
 * @author brollb / https://github.com/brollb
 */

// Tests
var AutoRouter = require('../src/AutoRouter'),
    assert = require('assert'),
    autorouter;

describe.only('Basic', function () {
    'use strict';

    beforeEach(function() {
        autorouter = new AutoRouter();
    });

    it('should be able to create boxes', function() {
        autorouter.setBox('test', {x1: 0, y1: 0, x2: 3, y2: 3});
        assert(!!autorouter.box('test'), 'test box not created');
    });

    it('should be able to create ports', function() {
        var boxId = 'test',
            portId = 'hey';

        autorouter.setBox(boxId, {x1: 0, y1: 0, x2: 3, y2: 3});
        autorouter.setPort(boxId, portId, [[0, 1], [1, 1]]);
        assert(!!autorouter.port(boxId, portId), 'port not created');
    });

    describe('Path', function () {
        it('should be able to create paths', function() {
            autorouter.setBox('src', {x1: 0, y1: 0, x2: 8, y2: 8});
            autorouter.setPort('src', 0, [[1, 1], [7, 1]]);

            autorouter.setBox('dst', {x1: 10, y1: 10, x2: 30, y2: 30});
            autorouter.setPort('dst', 0, [[11, 11], [28, 11]]);

            autorouter.setPath('myPath', 'src', 'dst');
        });

        it('should be able to route paths', function() {
            autorouter.setBox('src', {x1: 0, y1: 0, x2: 8, y2: 8});
            autorouter.setPort('src', 0, [[1, 1], [7, 1]]);

            autorouter.setBox('dst', {x1: 10, y1: 10, x2: 30, y2: 30});
            autorouter.setPort('dst', 0, [[11, 11], [28, 11]]);

            autorouter.setPath('myPath', 'src', 'dst');
            autorouter.routeSync();
        });

        it('should route correctly', function() {
            autorouter.setBox('src', {x1: 0, y1: 0, x2: 8, y2: 8});
            autorouter.setPort('src', 0, [[1, 1], [7, 1]]);

            autorouter.setBox('dst', {x1: 20, y1: 20, x2: 30, y2: 30});
            autorouter.setPort('dst', 0, [[21, 21], [28, 21]]);

            autorouter.setPath('myPath', 'src', 'dst');
            autorouter.routeSync();

            // TODO: Check the points
            var points = autorouter.path('myPath');
            console.log('points', points);
        });
    });

});
