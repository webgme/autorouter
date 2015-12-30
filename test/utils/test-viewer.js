/*globals AutoRouterReplayer, Raphael*/
(function(global) {
    'use strict';

    var TestViewer = function(container) {
        this.container = container;
        this.paper = Raphael(container, 100000, 100000);  // jshint ignore: line
    };

    TestViewer.prototype.render = function(actions) {
        var replayer = new AutoRouterReplayer(),
            isAsync = !!actions.find(action => action.action === 'routeAsync'),
            timeout = isAsync ? 500 : 10;

        replayer.useWebWorker(false);
        try {
            replayer.test(actions);
        } catch (e) {
            console.error('Action replay failed:', e);
        }
        
        this._graph = replayer.autorouter.graph;
        setTimeout(this._render.bind(this), timeout);
    };

    TestViewer.prototype._render = function() {
        var graph = this._graph,
            boxIds = Object.keys(graph.boxes);

        this.paper.clear();
        for (let i = boxIds.length; i--;) {
            this._renderRect(graph.boxes[boxIds[i]].rect);
        }

        // Render ports
        // TODO

        // FIXME: routeAsync is not finishing...
        // Render paths
        for (let i = graph.paths.length; i--;) {
            if (graph.paths[i].isConnected()) {
                this._renderPath(graph.paths[i].points);
            } else {
                console.warn(graph.paths[i].id + ' is not connected');
            }
        }
    };

    TestViewer.prototype._renderRect = function(rect) {
        var width = rect.right - rect.left,
            height = rect.floor - rect.ceil,
            svg;

        svg = this.paper.rect(rect.left, rect.ceil, width, height);
    };

    TestViewer.prototype._renderPath = function(points) {
        var init = points.shift(),
            path = `M ${init.x} ${init.y} ` + points.map(pt => `L ${pt.x} ${pt.y}`).join(' ');
        this.paper.path(path);
    };

    global.TestViewer = TestViewer;

    // Extra utilities
    var getTestCases = function(callback) {
        var req = new XMLHttpRequest();
        req.open('get', '/test-cases/all', false);
        req.onreadystatechange = function() {
            if (req.readyState === 4) {
                var testcases = JSON.parse(req.responseText);
                callback(testcases);
            }
        };
        req.send();
    };

    var getTestCase = function(name, callback) {
        console.log('getting test case:', name);
        var req = new XMLHttpRequest();
        req.open('get', '/test-cases/' + name, false);
        req.onreadystatechange = function() {
            if (req.readyState === 4) {
                var testcases = JSON.parse(req.responseText);
                callback(testcases);
            }
        };
        req.send();
    };

    global.getTestCases = getTestCases;
    global.getTestCase = getTestCase;

})(this);
