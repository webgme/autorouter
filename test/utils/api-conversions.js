//jshint esnext: true
'use strict';

var CONVERSION_MAP = {},
    utils = require('../../src/AutoRouter.Utils'),
    PORT_SEP = '_x_';

var createNop = function(action) {
    return function(args) {
        return [{
            action,
            args: args
        }];
    };
};

// Add the api calls with no changes
['clear', 'routeSync', 'routeAsync']
    .forEach(action => CONVERSION_MAP[action] = createNop(action));

// Update
var RECT_KEYS = ['x1', 'x2', 'y1', 'y2'],
    getSetPortActions = function(boxId, ports) {
        return ports.map(port => {
            let area = {
                x1: port.area[0][0],
                x2: port.area[0][1],
                y1: port.area[1][0],
                y2: port.area[1][1]
            };
            return {
                action: 'setPort',
                args: [boxId, port.id, area]
            };
        });
    };

CONVERSION_MAP.addBox = function(args) {
    var actions = [],
        action,
        ports = args[0].ports,
        boxId;

    // Create the box
    boxId = args[1];
    action = {
        action: 'setBox',
        args: [boxId, utils.pick(RECT_KEYS, args[0])]
    };
    actions.push(action);

    this.boxes[boxId] = true;

    // Add the ports
    return actions.concat(
        getSetPortActions(boxId, ports)
    );
};

CONVERSION_MAP.setComponent = function(args) {
    return [
        {
            action: 'setDependentBox',
            args
        }
    ];
};

var values = function(obj) {
    return Object.keys(obj).map(key => obj[key]);
};

CONVERSION_MAP.setPathCustomPoints = function(args) {
    var points = args[0].points.map(point => point.slice(0, 2))
    return [
        {
            action: 'setCustomRouting',
            args: [
                args[0].path,
                points
            ]
        }
    ];
};

CONVERSION_MAP.addPath = function(args) {
    var pathId = args[1],
        srcId = values(args[0].src)[0],
        dstId = values(args[0].dst)[0];

    if (!this.boxes[srcId]) {
        srcId = srcId.split(PORT_SEP)[0];
    }
    if (!this.boxes[dstId]) {
        dstId = dstId.split(PORT_SEP)[0];
    }

    if (pathId instanceof Array) {
        pathId = pathId[0];
    }

    this.paths[pathId] = true;
    return [
        {
            action: 'setPath',
            args: [
                pathId,
                srcId,
                dstId
            ]
        }
    ];
};

CONVERSION_MAP.setBoxRect = function(args) {
    var boxId = args[0],
        ports = args[1].ports,
        actions;

    actions = [
        {
            action: 'setBox',
            args: [boxId, null]
        },
        {
            action: 'setBox',
            args: [boxId, utils.pick(RECT_KEYS, args[1])]
        }
    ];

    // Add ports
    return actions.concat(getSetPortActions(boxId, ports));
};

// TODO: Add move!!!
CONVERSION_MAP.remove = function(args) {
    var id = args[0],
        action;

    if (this.boxes[id]) {
        action = 'setBox';
    } else if (this.paths[id]) {
        action = 'setPath';
    } else {
        throw 'Item not found! ' + id;
    }

    args.push(null);
    return [
        {action, args}
    ];
};

CONVERSION_MAP.updatePort = function(args) {
    var boxId = args[0],
        portId = args[1].id;

    return getSetPortActions(boxId, [args[1]]);
};

CONVERSION_MAP.getPathPoints = function(args) {
    return [{ action: 'path', args }];
};

var Converter = function() {
    this.boxes = {};
    this.paths = {};
};

Converter.prototype.convert = function(command) {
    var name = command.action;
    if (!CONVERSION_MAP[name]) {
        console.error('No support for command:', command);
    }

    return CONVERSION_MAP[name].call(this, command.args);
};

module.exports = Converter;
