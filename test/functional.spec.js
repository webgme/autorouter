/*globals describe*/
/*jshint node:true, mocha:true*/
/**
 * @author brollb / https://github.com/brollb
 */

// Tests
var AutoRouter = require('../src/AutoRouter'),
    assert = require('assert'),
    autorouter;

describe('functional', function () {
    'use strict';

    // Connect two boxes and remove some ports then connect
    describe('routing and port deletion', function () {
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
            autorouter.setPort('dst', 'goodbye', {
                x1: 410,
                y1: 790,
                x2: 790,
                y2: 790
            });
            autorouter.setPath('myPath', 'src', 'dst');
        });

        it('should route after deleting port', function () {
            autorouter.setPort('dst', 'goodbye', null);
            autorouter.routeSync();
        });

        it('should route after deleting port (& routing)', function () {
            autorouter.routeSync();
            autorouter.setPort('dst', 'goodbye', null);
            autorouter.routeSync();
        });
    });

    describe('routing and port change', function () {
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
            autorouter.setPort('dst', 'goodbye', {
                x1: 410,
                y1: 790,
                x2: 790,
                y2: 790
            });
            autorouter.setPath('myPath', 'src', 'dst');
        });

        it('should route after complete port change', function () {
            autorouter.setPort('dst', 'ex', {
                x1: 410,
                y1: 410,
                x2: 790,
                y2: 410
            });
            autorouter.setPort('dst', 'goodbye', null);
            autorouter.routeSync();
        });

        it('should route after complete port change - hard', function () {
            autorouter.setPort('dst', 'goodbye', null);
            autorouter.setPort('dst', 'ex', {
                x1: 410,
                y1: 410,
                x2: 790,
                y2: 410
            });
            autorouter.routeSync();
        });
    });
});
