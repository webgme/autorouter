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
        autorouter.setPort(boxId, portId, {x1: 0, y1: 1, x2: 1, y2: 1});
        assert(!!autorouter.port(boxId, portId), 'port not created');
    });

    describe('Box', function () {
        var box;

        before(function() {
            autorouter = new AutoRouter();
            autorouter.setBox('src', {x1: 1, y1: 1, x2: 8, y2: 8});

            box = autorouter.box('src', 'ex');
        });

        it('should return object with "id"', function() {
            assert(box.id);
        });

        it('should return object with "x"', function() {
            assert(box.x);
        });

        it('should return object with "width"', function() {
            assert(box.width);
        });

        it('should return object with "y"', function() {
            assert(box.y);
        });

        it('should return object with "height"', function() {
            assert(box.height);
        });

        it('should set correct width', function() {
            assert.equal(box.width, 7);
        });
    });

    describe('Port', function () {
        var port;

        before(function() {
            autorouter = new AutoRouter();
            autorouter.setBox('src', {x1: 0, y1: 0, x2: 8, y2: 8});
            autorouter.setPort('src', 'ex', {x1: 1, y1: 1, x2: 7, y2: 1});

            port = autorouter.port('src', 'ex');
        });

        it('should return object with "id"', function() {
            assert(port.id);
        });

        it('should return object with "x"', function() {
            assert(port.x);
        });

        it('should return object with "width"', function() {
            assert(port.width);
        });

        it('should return object with "y"', function() {
            assert(port.y);
        });

        it('should return object with "height"', function() {
            assert(port.height);
        });

        it('should set correct width', function() {
            assert.equal(port.width, 6);
        });
    });

    describe('Path', function () {
        beforeEach(function() {
            autorouter = new AutoRouter();

            autorouter.setBox('src', {
                x1: 100,
                y1: 100,
                x2: 200,
                y2: 200
            });
            autorouter.setPort('src', 'ex', {
                x1: 110,
                y1: 110,
                x2: 190,
                y2: 110
            });

            autorouter.setBox('dst', {
                x1: 400,
                y1: 400,
                x2: 800,
                y2: 800
            });
            autorouter.setPort('dst', 'ex', {
                x1: 410,
                y1: 410,
                x2: 790,
                y2: 410
            });
        });

        it('should be able to create paths', function() {
            autorouter.setPath('myPath', 'src', 'dst');
        });

        it('should be able to route paths', function() {
            autorouter.setPath('myPath', 'src', 'dst');
            autorouter.routeSync();
        });

        it('should start in \'src\'', function() {
            autorouter.setPath('myPath', 'src', 'dst');
            autorouter.routeSync();

            var src = autorouter.box('src'),
                startpoint = autorouter.path('myPath').points.shift();

            assert(startpoint[0] > 110 && startpoint[0] < 190, 'Incorrect x value ' + 
                'for startpoint: ' + startpoint[0]);
            assert(startpoint[1] > 107 && startpoint[1] < 110, 'Incorrect y value ' +
                ' for startpoint: ' + startpoint[1]);
        });

        it('should end in \'dst\'', function() {
            autorouter.setPath('myPath', 'src', 'dst');
            autorouter.routeSync();

            var src = autorouter.box('src'),
                endpoint = autorouter.path('myPath').points.pop();

            assert(endpoint[0] > 410 && endpoint[0] < 790, 'Incorrect x value ' + 
                'for endpoint: ' + endpoint[0]);
            assert(endpoint[1] > 407 && endpoint[1] < 410, 'Incorrect y value ' +
                ' for endpoint: ' + endpoint[1]);
        });
    });

});
