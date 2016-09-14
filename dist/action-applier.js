(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.AutoRouterActionApplier = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

/**
 * This is the web browser implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = require('./debug');
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.storage = 'undefined' != typeof chrome
               && 'undefined' != typeof chrome.storage
                  ? chrome.storage.local
                  : localstorage();

/**
 * Colors.
 */

exports.colors = [
  'lightseagreen',
  'forestgreen',
  'goldenrod',
  'dodgerblue',
  'darkorchid',
  'crimson'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

function useColors() {
  // is webkit? http://stackoverflow.com/a/16459606/376773
  return ('WebkitAppearance' in document.documentElement.style) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (window.console && (console.firebug || (console.exception && console.table))) ||
    // is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31);
}

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

exports.formatters.j = function(v) {
  return JSON.stringify(v);
};


/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs() {
  var args = arguments;
  var useColors = this.useColors;

  args[0] = (useColors ? '%c' : '')
    + this.namespace
    + (useColors ? ' %c' : ' ')
    + args[0]
    + (useColors ? '%c ' : ' ')
    + '+' + exports.humanize(this.diff);

  if (!useColors) return args;

  var c = 'color: ' + this.color;
  args = [args[0], c, 'color: inherit'].concat(Array.prototype.slice.call(args, 1));

  // the final "%c" is somewhat tricky, because there could be other
  // arguments passed either before or after the %c, so we need to
  // figure out the correct index to insert the CSS into
  var index = 0;
  var lastC = 0;
  args[0].replace(/%[a-z%]/g, function(match) {
    if ('%%' === match) return;
    index++;
    if ('%c' === match) {
      // we only are interested in the *last* %c
      // (the user may have provided their own)
      lastC = index;
    }
  });

  args.splice(lastC, 0, c);
  return args;
}

/**
 * Invokes `console.log()` when available.
 * No-op when `console.log` is not a "function".
 *
 * @api public
 */

function log() {
  // this hackery is required for IE8/9, where
  // the `console.log` function doesn't have 'apply'
  return 'object' === typeof console
    && console.log
    && Function.prototype.apply.call(console.log, console, arguments);
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  try {
    if (null == namespaces) {
      exports.storage.removeItem('debug');
    } else {
      exports.storage.debug = namespaces;
    }
  } catch(e) {}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  var r;
  try {
    r = exports.storage.debug;
  } catch(e) {}
  return r;
}

/**
 * Enable namespaces listed in `localStorage.debug` initially.
 */

exports.enable(load());

/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */

function localstorage(){
  try {
    return window.localStorage;
  } catch (e) {}
}

},{"./debug":2}],2:[function(require,module,exports){

/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = debug;
exports.coerce = coerce;
exports.disable = disable;
exports.enable = enable;
exports.enabled = enabled;
exports.humanize = require('ms');

/**
 * The currently active debug mode names, and names to skip.
 */

exports.names = [];
exports.skips = [];

/**
 * Map of special "%n" handling functions, for the debug "format" argument.
 *
 * Valid key names are a single, lowercased letter, i.e. "n".
 */

exports.formatters = {};

/**
 * Previously assigned color.
 */

var prevColor = 0;

/**
 * Previous log timestamp.
 */

var prevTime;

/**
 * Select a color.
 *
 * @return {Number}
 * @api private
 */

function selectColor() {
  return exports.colors[prevColor++ % exports.colors.length];
}

/**
 * Create a debugger with the given `namespace`.
 *
 * @param {String} namespace
 * @return {Function}
 * @api public
 */

function debug(namespace) {

  // define the `disabled` version
  function disabled() {
  }
  disabled.enabled = false;

  // define the `enabled` version
  function enabled() {

    var self = enabled;

    // set `diff` timestamp
    var curr = +new Date();
    var ms = curr - (prevTime || curr);
    self.diff = ms;
    self.prev = prevTime;
    self.curr = curr;
    prevTime = curr;

    // add the `color` if not set
    if (null == self.useColors) self.useColors = exports.useColors();
    if (null == self.color && self.useColors) self.color = selectColor();

    var args = Array.prototype.slice.call(arguments);

    args[0] = exports.coerce(args[0]);

    if ('string' !== typeof args[0]) {
      // anything else let's inspect with %o
      args = ['%o'].concat(args);
    }

    // apply any `formatters` transformations
    var index = 0;
    args[0] = args[0].replace(/%([a-z%])/g, function(match, format) {
      // if we encounter an escaped % then don't increase the array index
      if (match === '%%') return match;
      index++;
      var formatter = exports.formatters[format];
      if ('function' === typeof formatter) {
        var val = args[index];
        match = formatter.call(self, val);

        // now we need to remove `args[index]` since it's inlined in the `format`
        args.splice(index, 1);
        index--;
      }
      return match;
    });

    if ('function' === typeof exports.formatArgs) {
      args = exports.formatArgs.apply(self, args);
    }
    var logFn = enabled.log || exports.log || console.log.bind(console);
    logFn.apply(self, args);
  }
  enabled.enabled = true;

  var fn = exports.enabled(namespace) ? enabled : disabled;

  fn.namespace = namespace;

  return fn;
}

/**
 * Enables a debug mode by namespaces. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} namespaces
 * @api public
 */

function enable(namespaces) {
  exports.save(namespaces);

  var split = (namespaces || '').split(/[\s,]+/);
  var len = split.length;

  for (var i = 0; i < len; i++) {
    if (!split[i]) continue; // ignore empty strings
    namespaces = split[i].replace(/\*/g, '.*?');
    if (namespaces[0] === '-') {
      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      exports.names.push(new RegExp('^' + namespaces + '$'));
    }
  }
}

/**
 * Disable debug output.
 *
 * @api public
 */

function disable() {
  exports.enable('');
}

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

function enabled(name) {
  var i, len;
  for (i = 0, len = exports.skips.length; i < len; i++) {
    if (exports.skips[i].test(name)) {
      return false;
    }
  }
  for (i = 0, len = exports.names.length; i < len; i++) {
    if (exports.names[i].test(name)) {
      return true;
    }
  }
  return false;
}

/**
 * Coerce `val`.
 *
 * @param {Mixed} val
 * @return {Mixed}
 * @api private
 */

function coerce(val) {
  if (val instanceof Error) return val.stack || val.message;
  return val;
}

},{"ms":3}],3:[function(require,module,exports){
/**
 * Helpers.
 */

var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var y = d * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} options
 * @return {String|Number}
 * @api public
 */

module.exports = function(val, options){
  options = options || {};
  if ('string' == typeof val) return parse(val);
  return options.long
    ? long(val)
    : short(val);
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse(str) {
  str = '' + str;
  if (str.length > 10000) return;
  var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(str);
  if (!match) return;
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'yrs':
    case 'yr':
    case 'y':
      return n * y;
    case 'days':
    case 'day':
    case 'd':
      return n * d;
    case 'hours':
    case 'hour':
    case 'hrs':
    case 'hr':
    case 'h':
      return n * h;
    case 'minutes':
    case 'minute':
    case 'mins':
    case 'min':
    case 'm':
      return n * m;
    case 'seconds':
    case 'second':
    case 'secs':
    case 'sec':
    case 's':
      return n * s;
    case 'milliseconds':
    case 'millisecond':
    case 'msecs':
    case 'msec':
    case 'ms':
      return n;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function short(ms) {
  if (ms >= d) return Math.round(ms / d) + 'd';
  if (ms >= h) return Math.round(ms / h) + 'h';
  if (ms >= m) return Math.round(ms / m) + 'm';
  if (ms >= s) return Math.round(ms / s) + 's';
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function long(ms) {
  return plural(ms, d, 'day')
    || plural(ms, h, 'hour')
    || plural(ms, m, 'minute')
    || plural(ms, s, 'second')
    || ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, n, name) {
  if (ms < n) return;
  if (ms < n * 1.5) return Math.floor(ms / n) + ' ' + name;
  return Math.ceil(ms / n) + ' ' + name + 's';
}

},{}],4:[function(require,module,exports){
/*jshint node: true*/

/**
 * @author brollb / https://github/brollb
 */
'use strict';

var AutoRouter = require('./AutoRouter'),
    assert = require('./AutoRouter.Utils').assert;

var AutoRouterActionApplier = function () {
};

AutoRouterActionApplier.AutoRouter = AutoRouter;

AutoRouterActionApplier.prototype.init = function () {
    this._portSeparator = this._portSeparator || '_x_';
    this.autorouter = new AutoRouter();
    this.debugActionSequence = '[';
    this._clearRecords();
};

AutoRouterActionApplier.prototype._clearRecords = function () {
    this._autorouterBoxes = {};  // Define container that will map obj+subID -> box
    this._autorouterPorts = {};  // Maps boxIds to an array of port ids that have been mapped
    this._autorouterPaths = {};
    this._arPathId2Original = {};
};

/**
 * Replace id stored at the given indices of the array with the item from the dictionary.
 *
 * @param {Dictionary} dictionary
 * @param {Array} array
 * @param {Array<Number>} indices
 * @return {undefined}
 */
AutoRouterActionApplier.prototype._lookupItem = function (dictionary, array, indices) {  // jshint ignore:line
    var index,
        id;

    for (var i = 2; i < arguments.length; i++) {
        index = arguments[i];
        id = array[index];
        array[index] = dictionary[id];
    }
};

// FIXME: Update this method for new api
AutoRouterActionApplier.prototype._fixArgs = function (command, args) {
    var id;
    // Fix args, if needed
    switch (command) {
        case 'move':  // args[0] is id should be the box
            this._lookupItem(this._autorouterBoxes, args, 0);
            args[0] = args[0].box;
            break;

        case 'getPathPoints':
            this._lookupItem(this._autorouterPaths, args, 0);
            break;

        case 'setPathCustomPoints':
            id = args[0].path;
            args[0].path = this._autorouterPaths[id];
            break;

        case 'setBoxRect':
            this._lookupItem(this._autorouterBoxes, args, 0);
            break;

        case 'getBoxRect':
            this._lookupItem(this._autorouterBoxes, args, 0);
            args[0] = args[0].box.id;
            break;

        case 'updatePort':
            this._lookupItem(this._autorouterBoxes, args, 0);
            break;

        case 'setComponent':
            this._lookupItem(this._autorouterBoxes, args, 0, 1);
            break;

        case 'addPath':
            this._fixPortArgs(args[0].src, args[0].dst);
            args.pop();  // Remove the connection id
            break;

        case 'remove':
            var item;

            id = args[0];
            if (this._autorouterBoxes[id]) {
                item = this._autorouterBoxes[id];
            } else if (this._autorouterPaths[id]) {
                item = this._autorouterPaths[id];  // If objId is a connection
            }

            args[0] = item;
            break;

        case 'addBox':
            args.pop();
            break;

        default:
            break;
    }

};

AutoRouterActionApplier.prototype._fixPortArgs = function (port1, port2) { // jshint ignore:line
    var portId,
        portIds,
        arPortId,
        boxId,
        ports;

    for (var i = arguments.length; i--;) {
        ports = arguments[i];
        portIds = Object.keys(ports);
        for (var j = portIds.length; j--;) {
            portId = portIds[j];
            boxId = ports[portId];

            arPortId = this.autorouter.getPortId(portId, this._autorouterBoxes[boxId]);
            ports[portId] = this._autorouterBoxes[boxId].ports[arPortId];
            assert(this._autorouterBoxes[boxId].ports[arPortId], 'AR Port not found!');
        }
    }
};

/**
 * Invoke an AutoRouter method. This allows the action to be logged and bugs replicated.
 *
 * @param {String} command
 * @param {Array} args
 * @return {undefined}
 */
AutoRouterActionApplier.prototype._invokeAutoRouterMethod = function (command, args) {
    try {
        return this._invokeAutoRouterMethodUnsafe(command, args);

    } catch (e) {
        this.logger.error('AutoRouter.' + command + ' failed with error: ' + e);
    }
};

AutoRouterActionApplier.prototype._invokeAutoRouterMethodUnsafe = function (command, args) {
    var result,
        oldArgs = args.slice();

    if (this._recordActions) {
        this._recordAction(command, args.slice());
    }

    // Some arguments are simply ids for easier recording
    this._fixArgs(command, args);

    result = this.autorouter[command].apply(this.autorouter, args);
    this._updateRecords(command, oldArgs, result);
    return result;
};

AutoRouterActionApplier.prototype._updateRecords = function (command, input, result) {
    assert (input instanceof Array);
    var id,
        args = input.slice(),
        i;

    switch (command) {
        case 'addPath':
            id = args.pop();
            this._autorouterPaths[id] = result;
            this._arPathId2Original[result] = id;
            break;

        case 'addBox':
            id = args.pop();
            this._autorouterBoxes[id] = result;

            // Add ports
            this._autorouterPorts[id] = [];
            var ids = Object.keys(result.ports);
            for (i = ids.length; i--;) {
                this._autorouterPorts[id].push(result.ports[ids[i]]);
            }
            break;

        case 'remove':
            id = args[0];
            if (this._autorouterBoxes[id]) {
                i = this._autorouterPorts[id] ? this._autorouterPorts[id].length : 0;
                while (i--) {
                    var portId = id + this._portSeparator + this._autorouterPorts[id][i]; //ID of child port
                    delete this._autorouterBoxes[portId];
                }

                delete this._autorouterBoxes[id];
                delete this._autorouterPorts[id];

            } else if (this._autorouterPaths[id]) {
                var arId = this._autorouterPaths[id];
                delete this._autorouterPaths[id];
                delete this._arPathId2Original[arId];
            }
            break;

        case 'setComponent':
            var len,
                subCompId;

            id = args[0];
            len = id.length + this._portSeparator.length;
            subCompId = args[1].substring(len);

            if (this._autorouterPorts[id].indexOf(subCompId) === -1) {
                this._autorouterPorts[id].push(subCompId);
            }
            break;

        case 'updatePort':
            id = args[1].id;
            break;
    }
};

/**
 * Add the given action to the current sequence of autorouter commands.
 *
 * @param objId
 * @param subCompId
 * @return {undefined}
 */
AutoRouterActionApplier.prototype._recordAction = function (command, args) {

    var action = {action: command, args: args},
        circularFixer = function (key, value) {
            if (value && value.owner) {
                return value.id;
            }

            return value;
        };

    this.debugActionSequence += JSON.stringify(action, circularFixer) + ',';
};

AutoRouterActionApplier.prototype._getActionSequence = function () {
    var index = this.debugActionSequence.lastIndexOf(','),
        result = this.debugActionSequence.substring(0, index) + ']';

    return result;
};

module.exports = AutoRouterActionApplier;

},{"./AutoRouter":18,"./AutoRouter.Utils":17}],5:[function(require,module,exports){
/*jshint node: true*/

/**
 * @author brollb / https://github/brollb
 */

'use strict';

var CONSTANTS = require('./AutoRouter.Constants'),
    Utils = require('./AutoRouter.Utils'),
    assert = Utils.assert,
    ArPoint = require('./AutoRouter.Point'),
    ArRect = require('./AutoRouter.Rect'),
    AutoRouterPort = require('./AutoRouter.Port');


var AutoRouterBox = function () {
    this.owner = null;
    this.rect = new ArRect();
    this.atomic = false;
    this.selfPoints = [];
    this.ports = [];
    this.childBoxes = [];//dependent boxes
    this.parent = null;
    this.id = null;

    this.calculateSelfPoints(); //Part of initialization
};

AutoRouterBox.prototype.calculateSelfPoints = function () {
    this.selfPoints = [];
    this.selfPoints.push(new ArPoint(this.rect.getTopLeft()));

    this.selfPoints.push(new ArPoint(this.rect.right, this.rect.ceil));
    this.selfPoints.push(new ArPoint(this.rect.right, this.rect.floor));
    this.selfPoints.push(new ArPoint(this.rect.left, this.rect.floor));
};

AutoRouterBox.prototype.deleteAllPorts = function () {
    for (var i = 0; i < this.ports.length; i++) {
        this.ports[i].destroy();
    }

    this.ports = [];

    this.atomic = false;
};

AutoRouterBox.prototype.hasOwner = function () {
    return this.owner !== null;
};

// TODO: Remove this function
AutoRouterBox.prototype.createPort = function () {
    var port = new AutoRouterPort();
    assert(port !== null, 'ARBox.createPort: port !== null FAILED');

    return port;
};

AutoRouterBox.prototype.hasNoPort = function () {
    return this.ports.length === 0;
};

AutoRouterBox.prototype.isAtomic = function () {
    return this.atomic;
};

AutoRouterBox.prototype.addPort = function (port) {
    assert(port !== null, 'ARBox.addPort: port !== null FAILED');

    port.owner = this;
    this.ports.push(port);

    if (this.owner) {  // Not pointing to the ARGraph
        this.owner._addPortEdges(port);
    }
};

AutoRouterBox.prototype.deletePort = function (port) {
    assert(port !== null, 'ARBox.deletePort: port !== null FAILED');
    if (port === null) {
        return;
    }

    var index = this.ports.indexOf(port),
        graph = this.owner;

    assert(index !== -1, 'ARBox.deletePort: index !== -1 FAILED');

    graph.deleteEdges(port);
    this.ports.splice(index, 1);

    this.atomic = false;

};

AutoRouterBox.prototype.isRectEmpty = function () {
    return this.rect.isRectEmpty();
};

AutoRouterBox.prototype.setRect = function (r) {
    assert(r instanceof ArRect, 'Invalthis.id arg in ARBox.setRect. Requires ArRect');

    assert(r.getWidth() >= 3 && r.getHeight() >= 3,
        'ARBox.setRect: r.getWidth() >= 3 && r.getHeight() >= 3 FAILED!');

    assert(r.getTopLeft().x >= CONSTANTS.ED_MINCOORD && r.getTopLeft().y >= CONSTANTS.ED_MINCOORD,
        'ARBox.setRect: r.getTopLeft().x >= CONSTANTS.ED_MINCOORD && r.getTopLeft().y >= ' +
        'CONSTANTS.ED_MAXCOORD FAILED!');

    assert(r.getBottomRight().x <= CONSTANTS.ED_MAXCOORD && r.getBottomRight().y <= CONSTANTS.ED_MAXCOORD,
        'ARBox.setRect:  r.getBottomRight().x <= CONSTANTS.ED_MAXCOORD && r.getBottomRight().y <= ' +
        'CONSTANTS.ED_MAXCOORD FAILED!');

    this.rect.assign(r);
    this.calculateSelfPoints();

    if (this.atomic) {
        assert(this.ports.length === 1, 'ARBox.setRect: this.ports.length === 1 FAILED!');
        this.ports[0].setRect(r);
    }
};

AutoRouterBox.prototype.shiftBy = function (offset) {
    this.rect.add(offset);

    var i = this.ports.length;
    while (i--) {
        this.ports[i].shiftBy(offset);
    }

    /*
     This is not necessary; the ARGraph will shift all children
     i = this.childBoxes.length;
     while(i--){
     this.childBoxes[i].shiftBy(offset);
     }
     */
    this.calculateSelfPoints();
};

AutoRouterBox.prototype.resetPortAvailability = function () {
    for (var i = this.ports.length; i--;) {
        this.ports[i].resetAvailableArea();
    }
};

AutoRouterBox.prototype.adjustPortAvailability = function (box) {
    if (!box.hasAncestorWithId(this.id) &&   // Boxes are not dependent on one another
        !this.hasAncestorWithId(box.id)) {

        for (var i = this.ports.length; i--;) {
            this.ports[i].adjustAvailableArea(box.rect);
        }
    }
};

AutoRouterBox.prototype.addChild = function (box) {
    assert(this.childBoxes.indexOf(box) === -1,
        'ARBox.addChild: box already is child of ' + this.id);
    assert(box instanceof AutoRouterBox,
        'Child box must be of type AutoRouterBox');

    this.childBoxes.push(box);
    box.parent = this;
};

AutoRouterBox.prototype.removeChild = function (box) {
    var i = this.childBoxes.indexOf(box);
    assert(i !== -1, 'ARBox.removeChild: box isn\'t child of ' + this.id);
    this.childBoxes.splice(i, 1);
    box.parent = null;
};

AutoRouterBox.prototype.hasAncestorWithId = function (id) {
    var box = this;
    while (box) {
        if (box.id === id) {
            return true;
        }
        box = box.parent;
    }
    return false;
};

AutoRouterBox.prototype.getRootBox = function () {
    var box = this;
    while (box.parent) {
        box = box.parent;
    }
    return box;
};

AutoRouterBox.prototype.isBoxAt = function (point, nearness) {
    return Utils.isPointIn(point, this.rect, nearness);
};

AutoRouterBox.prototype.isBoxClip = function (r) {
    return Utils.isRectClip(this.rect, r);
};

AutoRouterBox.prototype.isBoxIn = function (r) {
    return Utils.isRectIn(this.rect, r);
};

AutoRouterBox.prototype.destroy = function () {
    var i = this.childBoxes.length;

    //notify this.parent of destruction
    //if there is a this.parent, of course
    if (this.parent) {
        this.parent.removeChild(this);
    }

    this.owner = null;
    this.deleteAllPorts();

    while (i--) {
        this.childBoxes[i].destroy();
    }
};

AutoRouterBox.prototype.assertValid = function () {
    for (var p = this.ports.length; p--;) {
        this.ports[p].assertValid();
    }
};

module.exports = AutoRouterBox;

},{"./AutoRouter.Constants":6,"./AutoRouter.Point":12,"./AutoRouter.Port":14,"./AutoRouter.Rect":15,"./AutoRouter.Utils":17}],6:[function(require,module,exports){
/*jshint node: true, bitwise: false*/

/**
 * @author brollb / https://github/brollb
 */

'use strict';
var ArPoint = require('./AutoRouter.Point');

module.exports = {
    EMPTY_POINT: new ArPoint(-100000, -100000),
    ED_MAXCOORD: 100000,
    ED_MINCOORD: -2,//This allows connections to be still be draw when box is pressed against the edge
    ED_SMALLGAP: 15,
    CONNECTIONCUSTOMIZATIONDATAVERSION: 0,
    EMPTYCONNECTIONCUSTOMIZATIONDATAMAGIC: -1,
    DEBUG: false,
    BUFFER: 10,

    EDLS_S: 15,//ED_SMALLGAP
    EDLS_R: 15 + 1, //ED_SMALLGAP+1
    EDLS_D: 100000 + 2,//ED_MAXCOORD - ED_MINCOORD,

    PathEndOnDefault: 0x0000,
    PathEndOnTop: 0x0010,
    PathEndOnRight: 0x0020,
    PathEndOnBottom: 0x0040,
    PathEndOnLeft: 0x0080,
    PathEndMask: (0x0010 | 0x0020 | 0x0040 | 0x0080),
    // (PathEndOnTop | PathEndOnRight | PathEndOnBottom | PathEndOnLeft),

    PathStartOnDefault: 0x0000,
    PathStartOnTop: 0x0100,
    PathStartOnRight: 0x0200,
    PathStartOnBottom: 0x0400,
    PathStartOnLeft: 0x0800,
    PathStartMask: (0x0100 | 0x0200 | 0x0400 | 0x0800),
    // (PathStartOnTop | PathStartOnRight | PathStartOnBottom | PathStartOnLeft),

    PathHighLighted: 0x0002,		// attributes,
    PathFixed: 0x0001,
    PathDefault: 0x0000,

    PathStateConnected: 0x0001,		// states,
    PathStateDefault: 0x0000,

    // Port Connection Variables
    PortEndOnTop: 0x0001,
    PortEndOnRight: 0x0002,
    PortEndOnBottom: 0x0004,
    PortEndOnLeft: 0x0008,
    PortEndOnAll: 0x000F,

    PortStartOnTop: 0x0010,
    PortStartOnRight: 0x0020,
    PortStartOnBottom: 0x0040,
    PortStartOnLeft: 0x0080,
    PortStartOnAll: 0x00F0,

    PortConnectOnAll: 0x00FF,
    PortConnectToCenter: 0x0100,

    PortStartEndHorizontal: 0x00AA,
    PortStartEndVertical: 0x0055,

    PortDefault: 0x00FF,

    // RoutingDirection vars 
    DirNone: -1,
    DirTop: 0,
    DirRight: 1,
    DirBottom: 2,
    DirLeft: 3,
    DirSkew: 4,

    //Path Custom Data
    SimpleEdgeDisplacement: 'EdgeDisplacement',
    CustomPointCustomization: 'PointCustomization'
    //CONNECTIONCUSTOMIZATIONDATAVERSION : null
};

},{"./AutoRouter.Point":12}],7:[function(require,module,exports){
/*globals define*/
/*jshint node: true*/

/**
 * @author brollb / https://github/brollb
 */

'use strict';

var CONSTANTS = require('./AutoRouter.Constants'),
    Utils = require('./AutoRouter.Utils'),
    assert = Utils.assert,
    ArPoint = require('./AutoRouter.Point');

var AutoRouterEdge = function () {
    /*
     In this section every comment refer to the horizontal case, that is, each	edge is
     horizontal.
     */

    /*
     * TODO Update this comment
     *
     Every CAutoRouterEdge belongs to an edge of a CAutoRouterPath, CAutoRouterBox or CAutoRouterPort. This edge is
     Represented by a CAutoRouterPoint with its next point. The variable 'point' will refer
     to this CAutoRouterPoint.

     The coordinates of an edge are 'x1', 'x2' and 'y' where x1/x2 is the x-coordinate
     of the left/right point, and y is the common y-coordinate of the points.

     The edges are ordered according to their y-coordinates. The first edge has
     the least y-coordinate (topmost), and its pointer is in 'orderFirst'.
     We use the 'order' prefix in the variable names to refer to this order.

     We will walk from top to bottom (from the 'orderFirst' along the 'this.orderNext').
     We keep track a 'section' of some edges. If we have an infinite horizontal line,
     then the section consists of those edges that are above the line and not blocked
     by another edge which is closer to the line. Each edge in the section has
     a viewable portion from the line (the not blocked portion). The coordinates
     of this portion are 'this.sectionX1' and 'this.sectionX2'. We have an order of the edges
     belonging to the current section. The 'section_first' refers to the leftmost
     edge in the section, while the 'this.sectionNext' to the next from left to right.

     We say that the CAutoRouterEdge E1 'precede' the CAutoRouterEdge E2 if there is no other CAutoRouterEdge which
     totally	blocks S1 from S2. So a section consists of the preceding edges of an
     infinite edge. We say that E1 is 'adjacent' to E2, if E1 is the nearest edge
     to E2 which precede it. Clearly, every edge has at most one adjacent precedence.

     The edges of any CAutoRouterBox or CAutoRouterPort are fixed. We will continually fix the edges
     of the CAutoRouterPaths. But first we need some definition.

     We call a set of edges as a 'block' if the topmost (first) and bottommost (last)
     edges of it are fixed while the edges between them are not. Furthermore, every
     edge is adjacent to	the next one in the order. Every edge in the block has an
     'index'. The index of the first one (topmost) is 0, of the second is 1, and so on.
     We call the index of the last edge (# of edges - 1) as the index of the entire box.
     The 'depth' of a block is the difference of the y-coordinates of the first and last
     edges of it. The 'goal gap' of the block is the quotient of the depth and index
     of the block. If the difference of the y-coordinates of the adjacent edges in
     the block are all equal to the goal gap, then we say that the block is evenly
     distributed.

     So we search the block which has minimal goal gap. Then if it is not evenly
     distributed, then we shift the not fixed edges to the desired position. It is
     not hard to see	that if the block has minimal goal gap (among the all
     possibilities of blocks), then in this way we do not move any edges into boxes.
     Finally, we set the (inner) edges of the block to be fixed (except the topmost and
     bottommost edges, since they are already fixed). And we again begin the search.
     If every edge is fixed, then we have finished. This is the basic idea. We will
     refine this algorithm.

     The variables related to the blocks are prefixed by 'block'. Note that the
     variables of an edge are refer to that block in which this edge is inner! The
     'block_oldgap' is the goal gap of the block when it was last evenly distributed.

     The variables 'canstart' and 'canend' means that this egde can start and/or end
     a block. The top edge of a box only canend, while a fixed edge of a path can both
     start and end of a block.

     */

    this.owner = null;
    this.startpointPrev = null;
    this.startpoint = null;
    this.endpoint = null;
    this.endpointNext = null;

    this.positionY = 0;
    this.positionX1 = 0;
    this.positionX2 = 0;
    this.bracketClosing = false;
    this.bracketOpening = false;

    this.orderPrev = null;
    this.orderNext = null;

    this.sectionX1 = null;
    this.sectionX2 = null;
    this.sectionNext = null;
    this.sectionDown = null;

    this.edgeFixed = false;
    this.edgeCustomFixed = false;
    this.edgeCanPassed = false;
    this.edgeDirection = null;

    this.blockPrev = null;
    this.blockNext = null;
    this.blockTrace = null;

    this.closestPrev = null;
    this.closestNext = null;

};


AutoRouterEdge.prototype.assign = function (otherEdge) {

    if (otherEdge !== null) {
        this.owner = otherEdge.owner;
        this.setStartPoint(otherEdge.startpoint, false);

        //Only calculateDirection if this.endpoint is not null
        this.setEndPoint(otherEdge.endpoint, otherEdge.endpoint !== null);

        this.startpointPrev = otherEdge.startpointPrev;
        this.endpointNext = otherEdge.endpointNext;

        this.positionY = otherEdge.positionY;
        this.positionX1 = otherEdge.positionX1;
        this.positionX2 = otherEdge.positionX2;
        this.bracketClosing = otherEdge.bracketClosing;
        this.bracketOpening = otherEdge.bracketOpening;

        this.orderNext = otherEdge.orderNext;
        this.orderPrev = otherEdge.orderPrev;

        this.sectionX1 = otherEdge.sectionX1;
        this.sectionX2 = otherEdge.sectionX2;
        this.setSectionNext(otherEdge.getSectionNext(true));
        this.setSectionDown(otherEdge.getSectionDown(true));

        this.edgeFixed = otherEdge.edgeFixed;
        this.edgeCustomFixed = otherEdge.edgeCustomFixed;
        this.setEdgeCanpassed(otherEdge.getEdgeCanpassed());
        this.setDirection(otherEdge.getDirection());

        this.setBlockPrev(otherEdge.getBlockPrev());
        this.setBlockNext(otherEdge.getBlockNext());
        this.setBlockTrace(otherEdge.getBlockTrace());

        this.setClosestPrev(otherEdge.getClosestPrev());
        this.setClosestNext(otherEdge.getClosestNext());

        return this;
    }

    return null;
};

AutoRouterEdge.prototype.equals = function (otherEdge) {
    return this === otherEdge; // This checks if they reference the same object
};

AutoRouterEdge.prototype.getStartPointPrev = function () {
    return this.startpointPrev !== null ? this.startpointPrev || this.startpointPrev : null;
};

AutoRouterEdge.prototype.isStartPointPrevNull = function () {
    return !this.startpointPrev;
};

AutoRouterEdge.prototype.getStartPoint = function () {
    return this.startpoint !== null ?
        (this.startpoint instanceof Array ? new ArPoint(this.startpoint) : new ArPoint(this.startpoint)) :
        CONSTANTS.EMPTY_POINT;  // returning copy of this.startpoint
};

AutoRouterEdge.prototype.isSameStartPoint = function (point) {
    return this.startpoint === point;
};

AutoRouterEdge.prototype.isStartPointNull = function () {
    return this.startpoint === null;
};

AutoRouterEdge.prototype.setStartPoint = function (point, b) {
    this.startpoint = point;

    if (b !== false) {
        this.recalculateDirection();
    }
};

AutoRouterEdge.prototype.setStartPointX = function (_x) {
    this.startpoint.x = _x;
};

AutoRouterEdge.prototype.setStartPointY = function (_y) {
    this.startpoint.y = _y;
};

AutoRouterEdge.prototype.getEndPoint = function () {
    return this.endpoint !== null ?
        (this.endpoint instanceof Array ?
            new ArPoint(this.endpoint) :
            new ArPoint(this.endpoint)) :
        CONSTANTS.EMPTY_POINT;
};

AutoRouterEdge.prototype.isEndPointNull = function () {
    return this.endpoint === null;
};

AutoRouterEdge.prototype.setEndPoint = function (point, b) {
    this.endpoint = point;

    if (b !== false) {
        this.recalculateDirection();
    }
};

AutoRouterEdge.prototype.setStartAndEndPoint = function (startPoint, endPoint) {
    this.setStartPoint(startPoint, false); //wait until setting the this.endpoint to recalculateDirection
    this.setEndPoint(endPoint);
};

AutoRouterEdge.prototype.setEndPointX = function (_x) {
    this.endpoint.x = _x;
};

AutoRouterEdge.prototype.setEndPointY = function (_y) {
    this.endpoint.y = _y;
};

AutoRouterEdge.prototype.isEndPointNextNull = function () {
    return !this.endpointNext;
};

AutoRouterEdge.prototype.getSectionNext = function () {

    return this.sectionNext !== undefined ? this.sectionNext[0] : null;
};

AutoRouterEdge.prototype.getSectionNextPtr = function () {
    if (!this.sectionNext || !this.sectionNext[0]) {
        this.sectionNext = [new AutoRouterEdge()];
    }
    return this.sectionNext;
};

AutoRouterEdge.prototype.setSectionNext = function (nextSection) {
    nextSection = nextSection instanceof Array ? nextSection[0] : nextSection;
    if (this.sectionNext instanceof Array) {
        this.sectionNext[0] = nextSection;
    } else {
        this.sectionNext = [nextSection];
    }
};

AutoRouterEdge.prototype.getSectionDown = function () { //Returns pointer - if not null

    return this.sectionDown !== undefined ? this.sectionDown[0] : null;

};

AutoRouterEdge.prototype.getSectionDownPtr = function () {
    if (!this.sectionDown || !this.sectionDown[0]) {
        this.sectionDown = [new AutoRouterEdge()];
    }
    return this.sectionDown;
};

AutoRouterEdge.prototype.setSectionDown = function (downSection) {
    downSection = downSection instanceof Array ? downSection[0] : downSection;
    if (this.sectionDown instanceof Array) {
        this.sectionDown[0] = downSection;
    } else {
        this.sectionDown = [downSection];
    }
};

AutoRouterEdge.prototype.getEdgeCanpassed = function () {
    return this.edgeCanPassed;
};

AutoRouterEdge.prototype.setEdgeCanpassed = function (ecp) {
    this.edgeCanPassed = ecp;
};

AutoRouterEdge.prototype.getDirection = function () {
    return this.edgeDirection;
};

AutoRouterEdge.prototype.setDirection = function (dir) {
    this.edgeDirection = dir;
};

AutoRouterEdge.prototype.recalculateDirection = function () {
    assert(this.startpoint !== null && this.endpoint !== null,
        'AREdge.recalculateDirection: this.startpoint !== null && this.endpoint !== null FAILED!');
    this.edgeDirection = Utils.getDir(this.endpoint.minus(this.startpoint));
};

AutoRouterEdge.prototype.getBlockPrev = function () {
    return this.blockPrev;
};

AutoRouterEdge.prototype.setBlockPrev = function (prevBlock) {
    this.blockPrev = prevBlock;
};

AutoRouterEdge.prototype.getBlockNext = function () {
    return this.blockNext;
};

AutoRouterEdge.prototype.setBlockNext = function (nextBlock) {
    this.blockNext = nextBlock;
};

AutoRouterEdge.prototype.getBlockTrace = function () {
    return this.blockTrace;
};

AutoRouterEdge.prototype.setBlockTrace = function (traceBlock) {
    this.blockTrace = traceBlock;
};

AutoRouterEdge.prototype.getClosestPrev = function () {
    return this.closestPrev;
};

AutoRouterEdge.prototype.setClosestPrev = function (cp) {
    this.closestPrev = cp;
};

AutoRouterEdge.prototype.getClosestNext = function () {
    return this.closestNext;
};

AutoRouterEdge.prototype.setClosestNext = function (cp) {
    this.closestNext = cp;
};

module.exports = AutoRouterEdge;

},{"./AutoRouter.Constants":6,"./AutoRouter.Point":12,"./AutoRouter.Utils":17}],8:[function(require,module,exports){
/*globals define, WebGMEGlobal*/
/*jshint browser: true*/

/**
 * @author brollb / https://github/brollb
 */

'use strict';

var Logger = require('./AutoRouter.Logger'),
    CONSTANTS = require('./AutoRouter.Constants'),
    Utils = require('./AutoRouter.Utils'),
    assert = Utils.assert,
    AutoRouterPath = require('./AutoRouter.Path'),
    AutoRouterPort = require('./AutoRouter.Port'),
    AutoRouterBox = require('./AutoRouter.Box'),
    AutoRouterEdge = require('./AutoRouter.Edge');


    //----------------------AutoRouterEdgeList

var _logger = new Logger('AutoRouter.EdgeList');
var AutoRouterEdgeList = function (b) {
    this.owner = null;

    //--Edges
    this.ishorizontal = b;

    //--Order
    this.orderFirst = null;
    this.orderLast = null;

    //--Section
    this.sectionFirst = null;
    this.sectionBlocker = null;
    this.sectionPtr2Blocked = []; // This is an array to emulate the pointer to a pointer functionality in CPP. 
    // That is, this.sectionPtr2Blocked[0] = this.sectionPtr2Blocked*

    this._initOrder();
    this._initSection();
};

// Public Functions
AutoRouterEdgeList.prototype.contains = function (start, end) {
    var currentEdge = this.orderFirst,
        startpoint,
        endpoint;

    while (currentEdge) {
        startpoint = currentEdge.startpoint;
        endpoint = currentEdge.endpoint;
        if (start.equals(startpoint) && end.equals(endpoint)) {
            return true;
        }
        currentEdge = currentEdge.orderNext;
    }

    return false;
};

AutoRouterEdgeList.prototype.destroy = function () {
    this.checkOrder();
    this.checkSection();
};

AutoRouterEdgeList.prototype.addPathEdges = function (path) {
    assert(path.owner === this.owner,
        'AREdgeList.addEdges: path.owner === owner FAILED!');

    var isPathAutoRouted = path.isAutoRouted(),
        hasCustomEdge = false,
        customizedIndexes = {},
        indexes = [],
        startpoint,
        endpoint,
        dir,
        edge,
        i;

    if (isPathAutoRouted) {
        i = -1;
        while (++i < indexes.length) {
            hasCustomEdge = true;
            customizedIndexes[indexes[i]] = 0;
        }
    } else {
        hasCustomEdge = true;
    }

    var pointList = path.getPointList(),
        ptrsObject = pointList.getTailEdgePtrs(),
        indItr,
        currEdgeIndex = pointList.length - 2,
        goodAngle,
        pos = ptrsObject.pos,
        skipEdge,
        isMoveable,
        isEdgeCustomFixed,
        startPort,
        endPort,
        isStartPortConnectToCenter,
        isEndPortConnectToCenter,
        isPathFixed;

    startpoint = ptrsObject.start;
    endpoint = ptrsObject.end;

    while (pointList.length && pos >= 0) {

        dir = Utils.getDir(endpoint.minus(startpoint));

        skipEdge = dir === CONSTANTS.DirNone ? true : false;
        isMoveable = path.isMoveable();

        if (!isMoveable && dir !== CONSTANTS.DirSkew) {
            goodAngle = Utils.isRightAngle(dir);
            assert(goodAngle,
                'AREdgeList.addEdges: Utils.isRightAngle (dir) FAILED!');

            if (!goodAngle) {
                skipEdge = true;
            }

        }

        if (!skipEdge &&
            (Utils.isRightAngle(dir) && Utils.isHorizontal(dir) === this.ishorizontal)) {
            edge = new AutoRouterEdge();
            edge.owner = path;

            edge.setStartAndEndPoint(startpoint, endpoint);
            edge.startpointPrev = pointList.getPointBeforeEdge(pos);
            edge.endpointNext = pointList.getPointAfterEdge(pos);

            if (hasCustomEdge) {
                isEdgeCustomFixed = false;
                if (isPathAutoRouted) {
                    indItr = customizedIndexes.indexOf(currEdgeIndex);
                    isEdgeCustomFixed = (indItr !== customizedIndexes.length - 1);
                } else {
                    isEdgeCustomFixed = true;
                }

                edge.edgeCustomFixed = isEdgeCustomFixed;

            } else {

                edge.edgeCustomFixed = dir === CONSTANTS.DirSkew;
            }

            startPort = path.getStartPort();

            assert(startPort !== null,
                'AREdgeList.addEdges: startPort !== null FAILED!');

            isStartPortConnectToCenter = startPort.isConnectToCenter();
            endPort = path.getEndPort();

            assert(endPort !== null,
                'AREdgeList.addEdges: endPort !== null FAILED!');

            isEndPortConnectToCenter = endPort.isConnectToCenter();
            isPathFixed = path.isFixed() || !path.isAutoRouted();

            edge.edgeFixed = edge.edgeCustomFixed || isPathFixed ||
            (edge.isStartPointPrevNull() && isStartPortConnectToCenter) ||
            (edge.isEndPointNextNull() && isEndPortConnectToCenter);

            if (dir !== CONSTANTS.DirSkew) {
                this._positionLoadY(edge);
                this._positionLoadB(edge);
            } else {
                edge.positionY = 0;
                edge.bracketOpening = false;
                edge.bracketClosing = false;
            }

            this.insert(edge);

        }

        ptrsObject = pointList.getPrevEdgePtrs(pos);
        pos = ptrsObject.pos;
        startpoint = ptrsObject.start;
        endpoint = ptrsObject.end;
        currEdgeIndex--;
    }

    return true;
};

AutoRouterEdgeList.prototype.addPortEdges = function (port) {
    var startpoint,
        endpoint,
        edge,
        selfPoints,
        startpointPrev,
        endpointNext,
        dir,
        i,
        canHaveStartEndPointHorizontal;

    assert(port.owner.owner === this.owner,
        'AREdgeList.addEdges: port.owner === (owner) FAILED!');

    if (port.isConnectToCenter() || port.owner.isAtomic()) {
        return;
    }

    selfPoints = port.selfPoints;

    for (i = 0; i < 4; i++) {

        startpointPrev = selfPoints[(i + 3) % 4];
        startpoint = selfPoints[i];
        endpoint = selfPoints[(i + 1) % 4];
        endpointNext = selfPoints[(i + 2) % 4];
        dir = Utils.getDir(endpoint.minus(startpoint));

        assert(Utils.isRightAngle(dir),
            'AREdgeList.addEdges: Utils.isRightAngle (dir) FAILED!');

        canHaveStartEndPointHorizontal = port.canHaveStartEndPointHorizontal(this.ishorizontal);
        if (Utils.isHorizontal(dir) === this.ishorizontal && canHaveStartEndPointHorizontal) {
            edge = new AutoRouterEdge();

            edge.owner = port;
            edge.setStartAndEndPoint(startpoint, endpoint);
            edge.startpointPrev = startpointPrev;
            edge.endpointNext = endpointNext;

            edge.edgeFixed = true;

            this._positionLoadY(edge);
            this._positionLoadB(edge);

            if (edge.bracketClosing) {
                edge.addToPosition(0.999);
            }

            this.insert(edge);
        }
    }
};

AutoRouterEdgeList.prototype.addBoxEdges = function (box) {
    var selfPoints = box.selfPoints,
        startpoint,
        startpointPrev,
        endpoint,
        endpointNext,
        edge,
        dir;

    assert(box.owner === this.owner,
        'AREdgeList.addEdges: box.owner === (owner) FAILED!');

    for (var i = 0; i < 4; i++) {
        startpointPrev = selfPoints[(i + 3) % 4];
        startpoint = selfPoints[i];
        endpoint = selfPoints[(i + 1) % 4];
        endpointNext = selfPoints[(i + 2) % 4];
        dir = Utils.getDir(endpoint.minus(startpoint));

        assert(Utils.isRightAngle(dir),
            'AREdgeList.addEdges: Utils.isRightAngle (dir) FAILED!');

        if (Utils.isHorizontal(dir) === this.ishorizontal) {
            edge = new AutoRouterEdge();

            edge.owner = box;
            edge.setStartAndEndPoint(startpoint, endpoint);
            edge.startpointPrev = startpointPrev;
            edge.endpointNext = endpointNext;

            edge.edgeFixed = true;

            this._positionLoadY(edge);
            this._positionLoadB(edge);

            if (edge.bracketClosing) {
                edge.addToPosition(0.999);
            }

            this.insert(edge);
        }
    }
};

AutoRouterEdgeList.prototype.addGraphEdges = function (graph) {
    var selfPoints,
        startpoint,
        startpointPrev,
        endpointNext,
        endpoint,
        edge,
        dir,
        i;

    assert(graph === this.owner,
        'AREdgeList.addEdges: graph === this.owner FAILED!');

    selfPoints = graph.selfPoints;

    for (i = 0; i < 4; i++) {

        startpointPrev = selfPoints[(i + 3) % 4];
        startpoint = selfPoints[i];
        endpoint = selfPoints[(i + 1) % 4];
        endpointNext = selfPoints[(i + 2) % 4];
        dir = Utils.getDir(endpoint.minus(startpoint));

        assert(Utils.isRightAngle(dir),
            'AREdgeList.addEdges: Utils.isRightAngle (dir) FAILED!');

        if (Utils.isHorizontal(dir) === this.ishorizontal) {
            edge = new AutoRouterEdge();

            edge.owner = graph;
            edge.setStartAndEndPoint(startpoint, endpoint);
            edge.startpointPrev = startpointPrev;
            edge.endpointNext = endpointNext;

            edge.edgeFixed = true;

            this._positionLoadY(edge);
            this.insert(edge);
        }
    }
};

AutoRouterEdgeList.prototype.deleteEdges = function (object) {
    var edge = this.orderFirst,
        next;

    while (edge !== null) {
        if (edge.owner === object) {
            next = edge.orderNext;
            this.remove(edge);
            edge = next;
        } else {
            edge = edge.orderNext;
        }
    }

};

AutoRouterEdgeList.prototype.deleteAllEdges = function () {
    while (this.orderFirst) {
        this.remove(this.orderFirst);
    }
};

AutoRouterEdgeList.prototype.getEdge = function (path, startpoint) {
    var edge = this.orderFirst;
    while (edge !== null) {

        if (edge.isSameStartPoint(startpoint)) {
            break;
        }

        edge = edge.orderNext;
    }

    assert(edge !== null,
        'AREdgeList.getEdge: edge !== null FAILED!');
    return edge;
};

AutoRouterEdgeList.prototype.getEdgeByPointer = function (startpoint) {
    var edge = this.orderFirst;
    while (edge !== null) {
        if (edge.isSameStartPoint(startpoint)) {
            break;
        }

        edge = edge.orderNext;
    }

    assert(edge !== null,
        'AREdgeList.getEdgeByPointer: edge !== null FAILED!');
    return edge;
};

AutoRouterEdgeList.prototype.setEdgeByPointer = function (pEdge, newEdge) {
    assert(newEdge instanceof AutoRouterEdge,
        'AREdgeList.setEdgeByPointer: newEdge instanceof AutoRouterEdge FAILED!');
    var edge = this.sectionFirst;
    while (edge !== null) {
        if (pEdge === edge) {
            break;
        }

        edge = edge.getSectionDown();
    }

    assert(edge !== null,
        'AREdgeList.setEdgeByPointer: edge !== null FAILED!');
    edge = newEdge;
};

AutoRouterEdgeList.prototype.getEdgeAt = function (point, nearness) {
    var edge = this.orderFirst;
    while (edge) {

        if (Utils.isPointNearLine(point, edge.startpoint, edge.endpoint, nearness)) {
            return edge;
        }

        edge = edge.orderNext;
    }

    return null;
};

AutoRouterEdgeList.prototype.dumpEdges = function (msg, logger) {
    var edge = this.orderFirst,
        log = logger || _logger.debug,
        total = 1;

    log(msg);

    while (edge !== null) {
        log('\t' + edge.startpoint.x + ', ' + edge.startpoint.y + '\t\t' + edge.endpoint.x + ', ' +
        edge.endpoint.y + '\t\t\t(' + (edge.edgeFixed ? 'FIXED' : 'MOVEABLE' ) + ')\t\t' +
        (edge.bracketClosing ? 'Bracket Closing' : (edge.bracketOpening ? 'Bracket Opening' : '')));

        edge = edge.orderNext;
        total++;
    }

    log('Total Edges: ' + total);
};

AutoRouterEdgeList.prototype.getEdgeCount = function () {
    var edge = this.orderFirst,
        total = 1;
    while (edge !== null) {
        edge = edge.orderNext;
        total++;
    }
    return total;
};

//--Private Functions
AutoRouterEdgeList.prototype._positionGetRealY = function (edge, y) {
    if (y === undefined) {
        if (this.ishorizontal) {
            assert(edge.startpoint.y === edge.endpoint.y,
                'AREdgeList.position_GetRealY: edge.startpoint.y === edge.endpoint.y FAILED!');
            return edge.startpoint.y;
        }

        assert(edge.startpoint.x === edge.endpoint.x,
            'AREdgeList.position_GetRealY: edge.startpoint.x === edge.endpoint.x FAILED!');
        return edge.startpoint.x;
    } else {

        assert(edge !== null && !edge.isStartPointNull() && !edge.isEndPointNull(),
            'AREdgeList.position_GetRealY: edge !== null && !edge.isStartPointNull() && ' +
            '!edge.isEndPointNull() FAILED!');

        if (this.ishorizontal) {
            assert(edge.startpoint.y === edge.endpoint.y,
                'AREdgeList.position_GetRealY: edge.startpoint.y === edge.endpoint.y FAILED!');
            edge.setStartPointY(y);
            edge.setEndPointY(y);
        } else {
            assert(edge.startpoint.x === edge.endpoint.x,
                'AREdgeList.position_GetRealY: edge.startpoint.x === edge.endpoint.x FAILED');

            edge.setStartPointX(y);
            edge.setEndPointX(y);
        }
    }
};

AutoRouterEdgeList.prototype._positionSetRealY = function (edge, y) {
    if (edge instanceof Array) {
        edge = edge[0];
    }

    assert(edge !== null && !edge.isStartPointNull() && !edge.isEndPointNull(),
        'AREdgeList.position_SetRealY: edge != null && !edge.isStartPointNull() && !edge.isEndPointNull() FAILED');

    if (this.ishorizontal) {
        assert(edge.startpoint.y === edge.endpoint.y,
            'AREdgeList.position_SetRealY: edge.startpoint.y === edge.endpoint.y FAILED');
        edge.setStartPointY(y);
        edge.setEndPointY(y);
    } else {
        assert(edge.startpoint.x === edge.endpoint.x,
            'AREdgeList.position_SetRealY: edge.startpoint.x === edge.endpoint.x FAILED');
        edge.setStartPointX(y);
        edge.setEndPointX(y);
    }
};

/**
 * Normalize the edge endpoints so x1 < x2
 */
AutoRouterEdgeList.prototype._positionGetRealX = function (edge) {
    assert(edge !== null && !edge.isStartPointNull() && !edge.isEndPointNull(),
        'AREdgeList.position_GetRealX: edge !== null && !edge.isStartPointNull() && !edge.isEndPointNull() FAILED');
    var x1, x2;

    if (this.ishorizontal) {
        assert(edge.startpoint.y === edge.endpoint.y,
            'AREdgeList.position_GetRealX: edge.startpoint.y === edge.endpoint.y FAILED');

        if (edge.startpoint.x < edge.endpoint.x) {

            x1 = edge.startpoint.x;
            x2 = edge.endpoint.x;
        } else {

            x1 = edge.endpoint.x;
            x2 = edge.startpoint.x;
        }
    } else {
        assert(edge.startpoint.x === edge.endpoint.x,
            'AREdgeList.position_GetRealX: edge.startpoint.x === edge.endpoint.x FAILED');
        if (edge.startpoint.y < edge.endpoint.y) {

            x1 = edge.startpoint.y;
            x2 = edge.endpoint.y;
        } else {

            x1 = edge.endpoint.y;
            x2 = edge.startpoint.y;
        }
    }

    return [x1, x2];
};

AutoRouterEdgeList.prototype._positionGetRealO = function (edge) {
    assert(edge !== null && !edge.isStartPointNull() && !edge.isEndPointNull(),
        'AREdgeList.position_GetRealO: edge !== null && !edge.isStartPointNull() && !edge.isEndPointNull() FAILED');
    var o1, o2;

    if (this.ishorizontal) {
        assert(edge.startpoint.y === edge.endpoint.y,
            'AREdgeList.position_GetRealO: edge.startpoint.y === edge.endpoint.y FAILED');
        if (edge.startpoint.x < edge.endpoint.x) {

            o1 = edge.isStartPointPrevNull() ? 0 : edge.startpointPrev.y - edge.startpoint.y;
            o2 = edge.isEndPointNextNull() ? 0 : edge.endpointNext.y - edge.endpoint.y;
        } else {

            o1 = edge.isEndPointNextNull() ? 0 : edge.endpointNext.y - edge.endpoint.y;
            o2 = edge.isStartPointPrevNull() ? 0 : edge.startpointPrev.y - edge.startpoint.y;
        }
    } else {
        assert(edge.startpoint.x === edge.endpoint.x,
            'AREdgeList.position_GetRealO: edge.startpoint.x === edge.endpoint.x FAILED');
        if (edge.startpoint.y < edge.endpoint.y) {

            o1 = edge.isStartPointPrevNull() ? 0 : edge.startpointPrev.x - edge.startpoint.x;
            o2 = edge.isEndPointNextNull() ? 0 : edge.endpointNext.x - edge.endpoint.x;
        } else {

            o1 = edge.isEndPointNextNull() ? 0 : edge.endpointNext.x - edge.endpoint.x;
            o2 = edge.isStartPointPrevNull() ? 0 : edge.startpointPrev.x - edge.startpoint.x;
        }
    }

    return [o1, o2];
};

AutoRouterEdgeList.prototype._positionLoadY = function (edge) {
    assert(edge !== null && edge.orderNext === null && edge.orderPrev === null,
        'AREdgeList.position_LoadY: edge !== null && edge.orderNext === null && edge.orderPrev === null FAILED');

    edge.positionY = this._positionGetRealY(edge);
};

AutoRouterEdgeList.prototype._positionLoadB = function (edge) {
    assert(edge !== null,
        'AREdgeList.position_LoadB: edge !== null FAILED');

    edge.bracketOpening = !edge.edgeFixed && this._bracketIsOpening(edge);
    edge.bracketClosing = !edge.edgeFixed && this._bracketIsClosing(edge);
};

AutoRouterEdgeList.prototype._positionAllStoreY = function () {
    var edge = this.orderFirst;
    while (edge) {
        this._positionSetRealY(edge, edge.positionY);
        edge = edge.orderNext;
    }

};

AutoRouterEdgeList.prototype._positionAllLoadX = function () {
    var edge = this.orderFirst,
        pts;
    while (edge) {
        pts = this._positionGetRealX(edge);
        edge.positionX1 = pts[0];
        edge.positionX2 = pts[1];

        edge = edge.orderNext;
    }
};

AutoRouterEdgeList.prototype._initOrder = function () {
    this.orderFirst = null;
    this.orderLast = null;
};

AutoRouterEdgeList.prototype._checkOrder = function () {
    assert(this.orderFirst === null && this.orderLast === null,
        'AREdgeList.checkOrder: this.orderFirst === null && this.orderLast === null FAILED');
};

//---Order

AutoRouterEdgeList.prototype.insertBefore = function (edge, before) {
    assert(edge !== null && before !== null && edge !== before,
        'AREdgeList.insertBefore: edge !== null && before !== null && edge !== before FAILED');
    assert(edge.orderNext === null && edge.orderPrev === null,
        'AREdgeList.insertBefore: edge.orderNext === null && edge.orderPrev === null FAILED');

    edge.orderPrev = before.orderPrev;
    edge.orderNext = before;

    if (before.orderPrev) {
        assert(before.orderPrev.orderNext === before,
            'AREdgeList.insertBefore: before.orderPrev.orderNext === before FAILED\nbefore.orderPrev.orderNext ' +
            'is ' + before.orderPrev.orderNext + ' and before is ' + before);

        before.orderPrev.orderNext = edge;

        assert(this.orderFirst !== before,
            'AREdgeList.insertBefore: this.orderFirst !== before FAILED');
    } else {

        assert(this.orderFirst === before,
            'AREdgeList.insertBefore: this.orderFirst === before FAILED');
        this.orderFirst = edge;
    }

    before.orderPrev = edge;
};

AutoRouterEdgeList.prototype.insertAfter = function (edge, after) {
    assert(edge !== null && after !== null && !edge.equals(after),
        'AREdgeList.insertAfter:  edge !== null && after !== null && !edge.equals(after) FAILED');
    assert(edge.orderNext === null && edge.orderPrev === null,
        'AREdgeList.insertAfter: edge.orderNext === null && edge.orderPrev === null FAILED ');

    edge.orderNext = after.orderNext;
    edge.orderPrev = after;

    if (after.orderNext) {
        assert(after.orderNext.orderPrev.equals(after),
            'AREdgeList.insertAfter:  after.orderNext.orderPrev.equals(after) FAILED');
        after.orderNext.orderPrev = edge;

        assert(!this.orderLast.equals(after), 'AREdgeList.insertAfter: !orderLast.equals(after) FAILED');
    } else {
        assert(this.orderLast.equals(after), 'AREdgeList.insertAfter: this.orderLast.equals(after) FAILED');
        this.orderLast = edge;
    }

    after.orderNext = edge;
};

AutoRouterEdgeList.prototype.insertLast = function (edge) {
    assert(edge !== null,
        'AREdgeList.insertLast: edge !== null FAILED');
    assert(edge.orderPrev === null && edge.orderNext === null,
        'AREdgeList.insertLast: edge.orderPrev === null && edge.orderNext === null FAILED');

    edge.orderPrev = this.orderLast;

    if (this.orderLast) {
        assert(this.orderLast.orderNext === null,
            'AREdgeList.insertLast: this.orderLast.orderNext === null FAILED');
        assert(this.orderFirst !== null,
            'AREdgeList.insertLast: this.orderFirst != null FAILED');

        this.orderLast.orderNext = edge;
        this.orderLast = edge;
    } else {
        assert(this.orderFirst === null,
            'AREdgeList.insertLast:  this.orderFirst === null FAILED');

        this.orderFirst = edge;
        this.orderLast = edge;
    }
};

AutoRouterEdgeList.prototype.insert = function (edge) {
    assert(edge !== null,
        'AREdgeList.insert:  edge !== null FAILED');
    assert(edge.orderPrev === null && edge.orderNext === null,
        'AREdgeList.insert: edge.orderPrev === null && edge.orderNext === null FAILED');

    var y = edge.positionY;

    assert(CONSTANTS.ED_MINCOORD <= y && y <= CONSTANTS.ED_MAXCOORD,
        'AREdgeList.insert: CONSTANTS.ED_MINCOORD <= y && y <= CONSTANTS.ED_MAXCOORD FAILED (y is ' + y + ')');

    var insert = this.orderFirst;

    while (insert && insert.positionY < y) {
        insert = insert.orderNext;
    }

    if (insert) {
        this.insertBefore(edge, insert);
    } else {
        this.insertLast(edge);
    }
};

AutoRouterEdgeList.prototype.remove = function (edge) {
    assert(edge !== null,
        'AREdgeList.remove:  edge !== null FAILED');

    if (this.orderFirst === edge) {
        this.orderFirst = edge.orderNext;
    }

    if (edge.orderNext) {
        edge.orderNext.orderPrev = edge.orderPrev;
    }

    if (this.orderLast === edge) {
        this.orderLast = edge.orderPrev;
    }

    if (edge.orderPrev) {
        edge.orderPrev.orderNext = edge.orderNext;
    }

    edge.orderNext = null;
    edge.orderPrev = null;
};

//-- Private

AutoRouterEdgeList.prototype._slideButNotPassEdges = function (edge, y) {
    assert(edge !== null, 'AREdgeList.slideButNotPassEdges: edge != null FAILED');
    assert(CONSTANTS.ED_MINCOORD < y && y < CONSTANTS.ED_MAXCOORD,
        'AREdgeList.slideButNotPassEdges: CONSTANTS.ED_MINCOORD < y && y < CONSTANTS.ED_MAXCOORD FAILED');

    var oldy = edge.positionY;
    assert(CONSTANTS.ED_MINCOORD < oldy && oldy < CONSTANTS.ED_MAXCOORD,
        'AREdgeList.slideButNotPassEdges: CONSTANTS.ED_MINCOORD < oldy && oldy < CONSTANTS.ED_MAXCOORD FAILED');

    if (oldy === y) {
        return null;
    }

    var x1 = edge.positionX1,
        x2 = edge.positionX2,
        ret = null,
        insert = edge;

    //If we are trying to slide down

    if (oldy < y) {
        while (insert.orderNext) {
            insert = insert.orderNext;

            if (y < insert.positionY) {
                //Then we won't be shifting past the new edge (insert)
                break;
            }

            //If you can't pass the edge (but want to) and the lines will overlap x values...
            if (!insert.getEdgeCanpassed() && Utils.intersect(x1, x2, insert.positionX1, insert.positionX2)) {
                ret = insert;
                y = insert.positionY;
                break;
            }
        }

        if (edge !== insert && insert.orderPrev !== edge) {
            this.remove(edge);
            this.insertBefore(edge, insert);
        }

    } else { // If we are trying to slide up
        while (insert.orderPrev) {
            insert = insert.orderPrev;

            if (y > insert.positionY) {
                break;
            }

            //If insert cannot be passed and it is in the way of the edge (if the edge were to slide up).
            if (!insert.getEdgeCanpassed() && Utils.intersect(x1, x2, insert.positionX1, insert.positionX2)) {
                ret = insert;
                y = insert.positionY;
                break;
            }
        }

        if (edge !== insert && insert.orderNext !== edge) {
            this.remove(edge);//This is where I believe the error could lie!
            this.insertAfter(edge, insert);
        }

    }

    edge.positionY = y;

    return ret;
};

//------Section

// private

AutoRouterEdgeList.prototype._initSection = function () {
    this.sectionFirst = null;
    this.sectionBlocker = null;
    this.sectionPtr2Blocked = null;
};

AutoRouterEdgeList.prototype.checkSection = function () {
    if (!(this.sectionBlocker === null && this.sectionPtr2Blocked === null)) {
        // This used to be contained in an assert.
        // Generally this fails when the router does not have a clean exit then is asked to reroute.
        this._logger.warn('sectionBlocker and this.sectionPtr2Blocked are not null. ' +
        'Assuming last run did not exit cleanly. Fixing...');
        this.sectionBlocker = null;
        this.sectionPtr2Blocked = null;
    }
};

AutoRouterEdgeList.prototype.sectionReset = function () {
    this.checkSection();

    this.sectionFirst = null;
};

/**
 * Initialize the section data structure.
 *
 * @param blocker
 * @return {undefined}
 */
AutoRouterEdgeList.prototype._sectionBeginScan = function (blocker) {
    this.checkSection();

    this.sectionBlocker = blocker;

    this.sectionBlocker.sectionX1 = this.sectionBlocker.positionX1;
    this.sectionBlocker.sectionX2 = this.sectionBlocker.positionX2;

    this.sectionBlocker.setSectionNext(null);
    this.sectionBlocker.setSectionDown(null);
};

AutoRouterEdgeList.prototype._sectionIsImmediate = function () {
    assert(this.sectionBlocker !== null && this.sectionPtr2Blocked !== null && this.sectionPtr2Blocked !== null,
        'AREdgeList._sectionIsImmediate: this.sectionBlocker != null && this.sectionPtr2Blocked != null ' +
        '&& *sectionPtr2Blocked != null FAILED');

    var sectionBlocked = this.sectionPtr2Blocked[0],
        e = sectionBlocked.getSectionDown(),
        a1 = sectionBlocked.sectionX1,
        a2 = sectionBlocked.sectionX2,
        p1 = sectionBlocked.positionX1,
        p2 = sectionBlocked.positionX2,
        b1 = this.sectionBlocker.sectionX1,
        b2 = this.sectionBlocker.sectionX2;

    if (e !== null) {
        e = (e.startpoint === null || e.sectionX1 === undefined ? null : e);
    }

    assert(b1 <= a2 && a1 <= b2,
        'AREdgeList._sectionIsImmediate: b1 <= a2 && a1 <= b2 FAILED');                     // not case 1 or 6

    // NOTE WE CHANGED THE CONDITIONS (A1<=B1 AND B2<=A2)
    // BECAUSE HERE WE NEED THIS!

    if (a1 <= b1) {
        while (!(e === null || e.startpoint === null) && e.sectionX2 < b1) {
            e = e.getSectionNext();
        }

        if (b2 <= a2) {
            return (e === null || e.startpoint === null) || b2 < e.sectionX1;               // case 3
        }

        return (e === null || e.startpoint === null) && a2 === p2;                          // case 2
    }

    if (b2 <= a2) {
        return a1 === p1 && ((e === null || e.startpoint === null) || b2 < e.sectionX1);    // case 5
    }

    return (e === null || e.startpoint === null) && a1 === p1 && a2 === p2;                 // case 4
};


// The following methods are convenience methods for adjusting the 'section' 
// of an edge.
/**
 * Get either min+1 or a value between min and max. Technically,
 * we are looking for [min, max).
 *
 * @param {Number} min
 * @param {Number} max
 * @return {Number} result
 */
var getLargerEndpoint = function (min, max) {
    var result;
    assert(min < max);

    result = Math.min(min + 1, (min + max) / 2);
    if (result === max) {
        result = min;
    }
    assert(result < max);
    return result;
};

/**
 * Get either max-1 or a value between min and max. Technically,
 * we are looking for (min, max].
 *
 * @param {Number} min
 * @param {Number} max
 * @return {Number} result
 */
var getSmallerEndpoint = function (min, max) {
    var result;
    assert(min < max);

    // If min is so small that 
    // 
    //      (min+max)/2 === min
    //
    // then we will simply use max value for the result
    result = Math.max(max - 1, (min + max) / 2);
    if (result === min) {
        result = max;
    }

    assert(result > min);
    return result;
};

AutoRouterEdgeList.prototype._sectionHasBlockedEdge = function () {
    assert(this.sectionBlocker !== null,
        'AREdgeList._sectionHasBlockedEdge: this.sectionBlocker != null FAILED');

    var newSectionX1,
        newSectionX2,
        e,
        blockerX1 = this.sectionBlocker.sectionX1,
        blockerX2 = this.sectionBlocker.sectionX2;

    assert(blockerX1 <= blockerX2,
        'AREdgeList._sectionHasBlockedEdge: blockerX1 <= blockerX2 FAILED');

    // Setting this.sectionPtr2Blocked
    if (this.sectionPtr2Blocked === null) {  // initialize sectionPtr2Blocked

        this.sectionFirst = this.sectionFirst === null ? [new AutoRouterEdge()] : this.sectionFirst;
        this.sectionPtr2Blocked = this.sectionFirst;
    } else {   // get next sectionPtr2Blocked
        var currentEdge = this.sectionPtr2Blocked[0];

        assert(currentEdge.startpoint !== null,
            'AREdgeList._sectionHasBlockedEdge: currentEdge.startpoint === null');

        var o = null;

        e = currentEdge.getSectionDownPtr()[0];
        newSectionX1 = currentEdge.sectionX1;
        newSectionX2 = currentEdge.sectionX2;

        assert(newSectionX1 <= newSectionX2,
            'AREdgeList._sectionHasBlockedEdge: newSectionX1 <= newSectionX2 FAILED (' + newSectionX1 +
            ' <= ' + newSectionX2 + ')' + '\nedge is ');

        assert(blockerX1 <= newSectionX2 && newSectionX1 <= blockerX2,
            'AREdgeList._sectionHasBlockedEdge: blockerX1 <= newSectionX2 &&  newSectionX1 <= blockerX2 FAILED');
        // not case 1 or 6
        if (newSectionX1 < blockerX1 && blockerX2 < newSectionX2) {                                 // case 3
            this.sectionPtr2Blocked = currentEdge.getSectionDownPtr();

        } else if (blockerX1 <= newSectionX1 && newSectionX2 <= blockerX2) {                        // case 4

            if (e && e.startpoint !== null) {
                while (e.getSectionNext() && e.getSectionNext().startpoint !== null) {
                    e = e.getSectionNext();
                }

                e.setSectionNext(currentEdge.getSectionNext());
                this.sectionPtr2Blocked[0] = currentEdge.getSectionDown();
            } else {

                this.sectionPtr2Blocked[0] = (currentEdge.getSectionNext());

            }
        } else if (blockerX1 <= newSectionX1 && blockerX2 < newSectionX2) {                         // case 5

            assert(newSectionX1 <= blockerX2,
                'AREdgeList._sectionHasBlockedEdge: newSectionX1 <= blockerX2 FAILED');

            // Move newSectionX1 such that blockerX2 < newSectionX1 < newSectionX2
            newSectionX1 = getLargerEndpoint(blockerX2, newSectionX2);

            while ((e && e.startpoint !== null) && e.sectionX1 <= newSectionX1) {
                assert(e.sectionX1 <= e.sectionX2,
                    'AREdgeList._sectionHasBlockedEdge: e.sectionX1 <= e.sectionX2 FAILED');

                if (newSectionX1 <= e.sectionX2) {
                    newSectionX1 = getLargerEndpoint(e.sectionX2, newSectionX2);
                }

                o = e;
                e = e.getSectionNext();
            }

            if (o) {
                // Insert currentEdge to be sectionNext of the given edge in the list 
                // of sectionDown (basically, collapsing currentEdge into the sectionDown 
                // list. The values in the list following currentEdge will then be set to 
                // be sectionDown of the currentEdge.)
                this.sectionPtr2Blocked[0] = currentEdge.getSectionDownPtr()[0];
                o.setSectionNext(currentEdge);
                currentEdge.setSectionDown(e);
            }

            assert(blockerX2 < newSectionX1,
                'AREdgeList._sectionHasBlockedEdge: blockerX2 < newSectionX1 FAILED (' +
                blockerX2 + ' < ' + newSectionX1 + ') ' +
                currentEdge.sectionX2 + ' is ' + newSectionX2 + ')');
            // Shifting the front of the p2b so it no longer overlaps this.sectionBlocker

            currentEdge.sectionX1 = newSectionX1;

            assert(currentEdge.sectionX1 < currentEdge.sectionX2,
                'currentEdge.sectionX1 < currentEdge.sectionX2 (' +
                currentEdge.sectionX1 + ' < ' + currentEdge.sectionX2 + ')');
        } else {                                                                                        // case 2
            assert(newSectionX1 < blockerX1 && blockerX1 <= newSectionX2 && newSectionX2 <= blockerX2,
                'AREdgeList._sectionHasBlockedEdge:  newSectionX1 < blockerX1 && blockerX1 <= newSectionX2 && ' +
                'newSectionX2 <= blockerX2 FAILED');

            this.sectionPtr2Blocked = currentEdge.getSectionDownPtr();

            while (e && e.startpoint !== null) {
                o = e;
                e = e.getSectionNext();

                if (o.sectionX2 + 1 < blockerX1 && (e === null || e.startpoint === null ||
                    o.sectionX2 + 1 < e.sectionX1)) {

                    this.sectionPtr2Blocked = o.getSectionNextPtr();
                }
            }

            if (this.sectionPtr2Blocked[0].startpoint !== null) {
                assert(o !== null,
                    'AREdgeList._sectionHasBlockedEdge: o != null FAILED');
                o.setSectionNext(currentEdge.getSectionNext());

                var larger = blockerX1;

                if (this.sectionPtr2Blocked[0].sectionX1 < blockerX1) {
                    larger = this.sectionPtr2Blocked[0].sectionX1;
                }

                currentEdge.sectionX2 = getSmallerEndpoint(newSectionX1, larger);

                currentEdge.setSectionNext(this.sectionPtr2Blocked[0]);
                this.sectionPtr2Blocked[0] = new AutoRouterEdge(); //This seems odd
                this.sectionPtr2Blocked = null;

            } else {
                currentEdge.sectionX2 = getSmallerEndpoint(newSectionX1, blockerX1);
            }

            assert(currentEdge.sectionX1 < currentEdge.sectionX2,
                'Expected sectionX1 < sectionX2 but ' + currentEdge.sectionX1 +
                ' is not < ' + currentEdge.sectionX2);

            this.sectionPtr2Blocked = currentEdge.getSectionNextPtr();
        }
    }

    assert(this.sectionPtr2Blocked !== null,
        'AREdgeList._sectionHasBlockedEdge: this.sectionPtr2Blocked != null FAILED');
    while (this.sectionPtr2Blocked[0] !== null && this.sectionPtr2Blocked[0].startpoint !== null) {
        newSectionX1 = this.sectionPtr2Blocked[0].sectionX1;
        newSectionX2 = this.sectionPtr2Blocked[0].sectionX2;

        if (newSectionX2 < blockerX1) {                                                 // case 1
            //If this.sectionPtr2Blocked is completely to the left (or above) this.sectionBlocker
            this.sectionPtr2Blocked = this.sectionPtr2Blocked[0].getSectionNextPtr();

            assert(this.sectionPtr2Blocked !== null,
                'AREdgeList._sectionHasBlockedEdge: this.sectionPtr2Blocked != null FAILED');
            continue;
        } else if (blockerX2 < newSectionX1) {                                        // case 6
            //If this.sectionBlocker is completely to the right (or below) this.sectionPtr2Blocked
            break;
        }

        if (newSectionX1 < blockerX1 && blockerX2 < newSectionX2) {                     // case 3
            //If this.sectionPtr2Blocked starts before and ends after this.sectionBlocker
            var x = blockerX1;
            e = this.sectionPtr2Blocked[0].getSectionDown();

            for (; ;) {

                if (e === null || e.startpoint === null || x < e.sectionX1) {
                    return true;
                } else if (x <= e.sectionX2) {
                    x = e.sectionX2 + 1;
                    if (blockerX2 < x) {
                        break;
                    }
                }

                e = e.getSectionNext();
            }

            this.sectionPtr2Blocked = this.sectionPtr2Blocked[0].getSectionDownPtr();
            continue;
        }
        // This leaves the regular partial overlap possibility.
        // They also include this.sectionBlocker starting before and ending after this.sectionPtr2Blocked.

        return true;
    }

    assert(this.sectionBlocker.getSectionNext() === null &&
        (this.sectionBlocker.getSectionDown() === null ||
        this.sectionBlocker.getSectionDown().startpoint === null),
        'AREdgeList._sectionHasBlockedEdge: this.sectionBlocker.getSectionNext() === null &&' +
        'this.sectionBlocker.getSectionDown() === null FAILED');

    this.sectionBlocker.setSectionNext(this.sectionPtr2Blocked[0]);

    // Set anything pointing to this.sectionPtr2Blocked to point to this.sectionBlocker (eg, sectionDown)
    this.sectionPtr2Blocked[0] = this.sectionBlocker;

    this.sectionBlocker = null;
    this.sectionPtr2Blocked = null;

    return false;
};

AutoRouterEdgeList.prototype._sectionGetBlockedEdge = function () {
    assert(this.sectionBlocker !== null && this.sectionPtr2Blocked !== null,
        'AREdgeList.sectionGetBlockedEdge: this.sectionBlocker !== null && ' +
        'this.sectionPtr2Blocked !== null FAILED');

    return this.sectionPtr2Blocked[0];
};

//----Bracket

AutoRouterEdgeList.prototype._bracketIsClosing = function (edge) {
    assert(edge !== null, 'AREdgeList._bracketIsClosing: edge !== null FAILED');
    assert(!edge.isStartPointNull() && !edge.isEndPointNull(),
        'AREdgeList._bracketIsClosing: !edge.isStartPointNull() && !edge.isEndPointNull() FAILED');

    var start = edge.startpoint,
        end = edge.endpoint;

    if (edge.isStartPointPrevNull() || edge.isEndPointNextNull()) {
        return false;
    }

    return this.ishorizontal ?
        (edge.startpointPrev.y < start.y && edge.endpointNext.y < end.y ) :
        (edge.startpointPrev.x < start.x && edge.endpointNext.x < end.x );
};

AutoRouterEdgeList.prototype._bracketIsOpening = function (edge) {
    assert(edge !== null, 'AREdgeList._bracketIsOpening: edge !== null FAILED');
    assert(!edge.isStartPointNull() && !edge.isEndPointNull(),
        'AREdgeList._bracketIsOpening: !edge.isStartPointNull() && !edge.isEndPointNull() FAILED');

    var start = edge.startpoint || edge.startpoint,
        end = edge.endpoint || edge.endpoint,
        prev,
        next;

    if (edge.isStartPointPrevNull() || edge.isEndPointNextNull()) {
        return false;
    }

    next = edge.endpointNext || edge.endpointNext;
    prev = edge.startpointPrev || edge.startpointPrev;

    return this.ishorizontal ?
        (prev.y > start.y && next.y > end.y ) :
        (prev.x > start.x && next.x > end.x );
};

AutoRouterEdgeList.prototype._bracketShouldBeSwitched = function (edge, next) {
    assert(edge !== null && next !== null,
        'AREdgeList._bracketShouldBeSwitched: edge !== null && next !== null FAILED');

    var ex = this._positionGetRealX(edge),
        ex1 = ex[0],
        ex2 = ex[1],
        eo = this._positionGetRealO(edge),
        eo1 = eo[0],
        eo2 = eo[1],
        nx = this._positionGetRealX(next),
        nx1 = nx[0],
        nx2 = nx[1],
        no = this._positionGetRealO(next),
        no1 = no[0],
        no2 = no[1];

    var c1, c2;

    if ((nx1 < ex1 && ex1 < nx2 && eo1 > 0 ) || (ex1 < nx1 && nx1 < ex2 && no1 < 0)) {
        c1 = +1;
    } else if (ex1 === nx1 && eo1 === 0 && no1 === 0) {
        c1 = 0;
    } else {
        c1 = -9;
    }

    if ((nx1 < ex2 && ex2 < nx2 && eo2 > 0 ) || (ex1 < nx2 && nx2 < ex2 && no2 < 0)) {
        c2 = +1;
    } else if (ex2 === nx2 && eo2 === 0 && no2 === 0) {
        c2 = 0;
    } else {
        c2 = -9;
    }

    return (c1 + c2) > 0;
};

//---Block

AutoRouterEdgeList.prototype._blockGetF = function (d, b, s) {
    var f = d / (b + s), //f is the total distance between edges divided by the total number of edges
        S = CONSTANTS.EDLS_S, //This is 'SMALLGAP'
        R = CONSTANTS.EDLS_R,//This is 'SMALLGAP + 1'
        D = CONSTANTS.EDLS_D; //This is the total distance of the graph

    //If f is greater than the SMALLGAP, then make some checks/edits
    if (b === 0 && R <= f) {
        // If every comparison resulted in an overlap AND SMALLGAP + 1 is less than
        // the distance between each edge (in the given range).
        f += (D - R);
    } else if (S < f && s > 0) {
        f = ((D - S) * d - S * (D - R) * s) / ((D - S) * b + (R - S) * s);
    }

    return f;
};

AutoRouterEdgeList.prototype._blockGetG = function (d, b, s) {
    var g = d / (b + s),
        S = CONSTANTS.EDLS_S,
        R = CONSTANTS.EDLS_R,
        D = CONSTANTS.EDLS_D;

    if (S < g && b > 0) {
        g = ((R - S) * d + S * (D - R) * b) / ((D - S) * b + (R - S) * s);
    }

    return g;
};

AutoRouterEdgeList.prototype._blockPushBackward = function (blocked, blocker) {
    var modified = false;

    assert(blocked !== null && blocker !== null,
        'AREdgeList._blockPushBackward: blocked !== null && blocker !== null FAILED');
    assert(blocked.positionY <= blocker.positionY,
        'AREdgeList._blockPushBackward: blocked.positionY <= blocker.positionY FAILED');
    assert(blocked.getBlockPrev() !== null,
        'AREdgeList._blockPushBackward: blocked.getBlockPrev() !== null FAILED');

    var f = 0,
        g = 0,
        edge = blocked,
        trace = blocker,
        d = trace.positionY - edge.positionY;

    assert(d >= 0,
        'AREdgeList._blockPushBackward: d >= 0 FAILED');

    var s = (edge.bracketOpening || trace.bracketClosing),
        b = 1 - s,
        d2;

    for (; ;) {
        edge.setBlockTrace(trace);
        trace = edge;
        edge = edge.getBlockPrev();

        if (edge === null) {
            break;
        }

        d2 = trace.positionY - edge.positionY;
        assert(d2 >= 0,
            'AREdgeList._blockPushBackward:  d2 >= 0 FAILED');

        if (edge.bracketOpening || trace.bracketClosing) {
            g = this._blockGetG(d, b, s);
            if (d2 <= g) {
                f = this._blockGetF(d, b, s);
                break;
            }
            s++;
        } else {
            f = this._blockGetF(d, b, s);
            if (d2 <= f) {
                g = this._blockGetG(d, b, s);
                break;
            }
            b++;
        }

        d += d2;
    }

    if (b + s > 1) {
        if (edge === null) {
            f = this._blockGetF(d, b, s);
            g = this._blockGetG(d, b, s);
        }

        assert(Utils.floatEquals(d, f * b + g * s),
            'AREdgeList._blockPushBackward: floatEquals(d, f*b + g*s) FAILED');

        edge = trace;
        assert(edge !== null && edge !== blocked,
            'AREdgeList._blockPushBackward: edge !== null && edge !== blocked FAILED');

        var y = edge.positionY;

        do {
            assert(edge !== null && edge.getBlockTrace() !== null,
                'AREdgeList._blockPushBackward: edge !== null && edge.getBlockTrace() !== null FAILED');

            trace = edge.getBlockTrace();

            y += (edge.bracketOpening || trace.bracketClosing) ? g : f;
            y = Utils.roundTrunc(y, 10);  // Fix any floating point errors

            if (y + 0.001 < trace.positionY) {
                modified = true;
                if (this._slideButNotPassEdges(trace, y)) {
                    trace.setBlockPrev(null);
                }
            }

            edge = trace;
        } while (edge !== blocked);

        if (CONSTANTS.DEBUG) {
            //y += (edge.bracketOpening || blocker.bracketClosing) ? g : f;
            assert(Utils.floatEquals(y, blocker.positionY),
                'AREdgeList._blockPushBackward: floatEquals(y, blocker.positionY) FAILED');
        }
    }

    return modified;
};

AutoRouterEdgeList.prototype._blockPushForward = function (blocked, blocker) {
    var modified = false;

    assert(blocked !== null && blocker !== null,
        'AREdgeList._blockPushForward: blocked !== null && blocker !== null FAILED');
    assert(blocked.positionY >= blocker.positionY,
        'AREdgeList._blockPushForward: blocked.positionY >= blocker.positionY FAILED');
    assert(blocked.getBlockNext() !== null,
        'AREdgeList._blockPushForward: blocked.getBlockNext() !== null FAILED');

    var f = 0,
        g = 0,
        edge = blocked,
        trace = blocker,
        d = edge.positionY - trace.positionY;

    assert(d >= 0,
        'AREdgeList._blockPushForward:  d >= 0 FAILED');

    var s = (trace.bracketOpening || edge.bracketClosing),
        b = 1 - s,
        d2;

    for (; ;) {
        edge.setBlockTrace(trace);
        trace = edge;
        edge = edge.getBlockNext();

        if (edge === null) {
            break;
        }

        d2 = edge.positionY - trace.positionY;
        assert(d2 >= 0,
            'AREdgeList._blockPushForward: d2 >= 0 FAILED');

        if (trace.bracketOpening || edge.bracketClosing) {
            g = this._blockGetG(d, b, s);
            if (d2 <= g) {
                f = this._blockGetF(d, b, s);
                break;
            }
            s++;
        } else {
            f = this._blockGetF(d, b, s);
            if (d2 <= f) {
                g = this._blockGetG(d, b, s);
                break;
            }
            b++;
        }

        d += d2;
    }

    if (b + s > 1) { //Looking at more than one edge (or edge/trace comparison) {
        if (edge === null) {
            f = this._blockGetF(d, b, s);
            g = this._blockGetG(d, b, s);
        }

        assert(Utils.floatEquals(d, f * b + g * s),
            'AREdgeList._blockPushForward: floatEquals(d, f*b + g*s) FAILED');

        edge = trace;
        assert(edge !== null && !edge.equals(blocked),
            'AREdgeList._blockPushForward: edge != null && !edge.equals(blocked) FAILED');

        var y = edge.positionY;

        do {
            assert(edge !== null && edge.getBlockTrace() !== null,
                'AREdgeList._blockPushForward: edge !== null && edge.getBlockTrace() !== null FAILED');
            trace = edge.getBlockTrace();

            y -= (trace.bracketOpening || edge.bracketClosing) ? g : f;

            if (trace.positionY < y - 0.001) {
                modified = true;

                if (this._slideButNotPassEdges(trace, y)) {
                    trace.setBlockNext(null);
                }
            }

            edge = trace;
        } while (edge !== blocked);
    }


    return modified;
};

AutoRouterEdgeList.prototype.blockScanForward = function () {
    this._positionAllLoadX();

    var modified = false;

    this.sectionReset();

    var blocker = this.orderFirst,
        blocked,
        bmin,
        smin,
        bMinF,
        sMinF;

    while (blocker) {
        bmin = null; //block min?
        smin = null; //section min?
        bMinF = CONSTANTS.ED_MINCOORD - 1;
        sMinF = CONSTANTS.ED_MINCOORD - 1;

        this._sectionBeginScan(blocker);
        while (this._sectionHasBlockedEdge()) {
            if (this._sectionIsImmediate()) {
                blocked = this._sectionGetBlockedEdge();
                assert(blocked !== null,
                    'AREdgeList._blockPushForward: blocked !== null FAILED');

                if (blocked.getBlockPrev() !== null) {
                    modified = this._blockPushBackward(blocked, blocker) || modified;
                }

                if (!blocker.edgeFixed) {
                    if (blocked.bracketOpening || blocker.bracketClosing) {
                        if (sMinF < blocked.positionY) {
                            sMinF = blocked.positionY;
                            smin = blocked;
                        }
                    } else {
                        if (bMinF < blocked.positionY) {
                            bMinF = blocked.positionY;
                            bmin = blocked;
                        }
                    }
                }
            }

        }

        if (bmin) {
            if (smin) {
                blocker.setClosestPrev(sMinF > bMinF ? smin : bmin);

                bMinF = blocker.positionY - bMinF;
                sMinF = this._blockGetF(blocker.positionY - sMinF, 0, 1);

                blocker.setBlockPrev(sMinF < bMinF ? smin : bmin);
            } else {
                blocker.setBlockPrev(bmin);
                blocker.setClosestPrev(bmin);
            }
        } else {
            blocker.setBlockPrev(smin);
            blocker.setClosestPrev(smin);
        }


        blocker = blocker.orderNext;
    }

    this._positionAllStoreY();

    return modified;
};

AutoRouterEdgeList.prototype.blockScanBackward = function () {
    this._positionAllLoadX();

    var modified = false;

    this.sectionReset();
    var blocker = this.orderLast,
        blocked,
        bmin,
        smin,
        bMinF,
        sMinF;

    while (blocker) {
        bmin = null;
        smin = null;
        bMinF = CONSTANTS.ED_MAXCOORD + 1;
        sMinF = CONSTANTS.ED_MAXCOORD + 1;

        this._sectionBeginScan(blocker);

        while (this._sectionHasBlockedEdge()) {
            if (this._sectionIsImmediate()) {
                blocked = this._sectionGetBlockedEdge();

                assert(blocked !== null,
                    'AREdgeList.blockScanBackward: blocked !== null FAILED');

                if (blocked.getBlockNext() !== null) {
                    modified = this._blockPushForward(blocked, blocker) || modified;
                }

                if (!blocker.edgeFixed) {
                    if (blocker.bracketOpening || blocked.bracketClosing) {
                        if (sMinF > blocked.positionY) {
                            sMinF = blocked.positionY;
                            smin = blocked;
                        }
                    } else {
                        if (bMinF > blocked.positionY) {
                            bMinF = blocked.positionY;
                            bmin = blocked;
                        }
                    }
                }
            }
        }

        if (bmin) {
            if (smin) {
                blocker.setClosestNext(sMinF < bMinF ? smin : bmin);

                bMinF = bMinF - blocker.positionY;
                sMinF = this._blockGetF(sMinF - blocker.positionY, 0, 1);

                blocker.setBlockNext(sMinF < bMinF ? smin : bmin);
            } else {
                blocker.setBlockNext(bmin);
                blocker.setClosestNext(bmin);
            }
        } else {
            blocker.setBlockNext(smin);
            blocker.setClosestNext(smin);
        }

        blocker = blocker.orderPrev;
    }

    this._positionAllStoreY();

    return modified;
};

AutoRouterEdgeList.prototype.blockSwitchWrongs = function () {
    var was = false;

    this._positionAllLoadX();
    var second = this.orderFirst,
        edge,
        next,
        ey,
        ny,
        a;

    while (second !== null) {
        //Check if it references itself
        if (second.getClosestPrev() !== null && second.getClosestPrev().getClosestNext() !== (second) &&
            second.getClosestNext() !== null && second.getClosestNext().getClosestPrev() === (second)) {

            assert(!second.edgeFixed,
                'AREdgeList.blockSwitchWrongs: !second.edgeFixed FAILED');

            edge = second;
            next = edge.getClosestNext();

            while (next !== null && edge === next.getClosestPrev()) {
                assert(edge !== null && !edge.edgeFixed,
                    'AREdgeList.blockSwitchWrongs: edge != null && !edge.edgeFixed FAILED');
                assert(next !== null && !next.edgeFixed,
                    'AREdgeList.blockSwitchWrongs: next != null && !next.edgeFixed FAILED');

                ey = edge.positionY;
                ny = next.positionY;

                assert(ey <= ny,
                    'AREdgeList.blockSwitchWrongs: ey <= ny FAILED');

                if (ey + 1 <= ny && this._bracketShouldBeSwitched(edge, next)) {
                    was = true;

                    assert(!edge.getEdgeCanpassed() && !next.getEdgeCanpassed(),
                        'AREdgeList.blockSwitchWrongs: !edge.getEdgeCanpassed() && ' +
                        '!next.getEdgeCanpassed() FAILED');
                    edge.setEdgeCanpassed(true);
                    next.setEdgeCanpassed(true);

                    a = this._slideButNotPassEdges(edge, (ny + ey) / 2 + 0.001) !== null;
                    a = this._slideButNotPassEdges(next, (ny + ey) / 2 - 0.001) !== null || a;

                    if (a) {
                        edge.setClosestPrev(null);
                        edge.setClosestNext(null);
                        next.setClosestPrev(null);
                        next.setClosestNext(null);

                        edge.setEdgeCanpassed(false);
                        next.setEdgeCanpassed(false);
                        break;
                    }

                    if (edge.getClosestPrev() !== null && edge.getClosestPrev().getClosestNext() === edge) {
                        edge.getClosestPrev().setClosestNext(next);
                    }

                    if (next.getClosestNext() !== null && next.getClosestNext().getClosestPrev() === next) {
                        next.getClosestNext().setClosestPrev(edge);
                    }

                    edge.setClosestNext(next.getClosestNext());
                    next.setClosestNext(edge);
                    next.setClosestPrev(edge.getClosestPrev());
                    edge.setClosestPrev(next);

                    edge.setEdgeCanpassed(false);
                    next.setEdgeCanpassed(false);

                    assert(!this._bracketShouldBeSwitched(next, edge),
                        'AREdgeList.blockSwitchWrongs: !bracketShouldBeSwitched(next, edge) FAILED');

                    if (next.getClosestPrev() !== null && next.getClosestPrev().getClosestNext() === next) {
                        edge = next.getClosestPrev();
                    } else {
                        next = edge.getClosestNext();
                    }
                } else {
                    edge = next;
                    next = next.getClosestNext();
                }
            }
        }

        second = second.orderNext;
    }

    if (was) {
        this._positionAllStoreY();
    }

    return was;
};

AutoRouterEdgeList.prototype.assertValid = function () {
    // Check that all edges have start/end points
    var edge = this.orderFirst;
    while (edge) {
        assert(edge.startpoint.x !== undefined, 'Edge has unrecognized startpoint: ' + edge.startpoint);
        assert(edge.endpoint.x !== undefined, 'Edge has unrecognized endpoint: ' + edge.endpoint);
        edge = edge.orderNext;
    }
};

module.exports = AutoRouterEdgeList;

},{"./AutoRouter.Box":5,"./AutoRouter.Constants":6,"./AutoRouter.Edge":7,"./AutoRouter.Logger":10,"./AutoRouter.Path":11,"./AutoRouter.Port":14,"./AutoRouter.Utils":17}],9:[function(require,module,exports){
/*globals define, WebGMEGlobal*/
/*jshint node: true*/

/**
 * @author brollb / https://github/brollb
 */

'use strict';

var Logger = require('./AutoRouter.Logger'),  // FIXME
    CONSTANTS = require('./AutoRouter.Constants'),
    Utils = require('./AutoRouter.Utils'),
    assert = Utils.assert,
    ArPoint = require('./AutoRouter.Point'),
    ArPointListPath = require('./AutoRouter.PointList'),
    ArRect = require('./AutoRouter.Rect'),
    AutoRouterPath = require('./AutoRouter.Path'),
    AutoRouterPort = require('./AutoRouter.Port'),
    AutoRouterBox = require('./AutoRouter.Box'),
    AutoRouterEdge = require('./AutoRouter.Edge'),
    AutoRouterEdgeList = require('./AutoRouter.EdgeList');

var _logger = new Logger('AutoRouter.Graph'),
    COUNTER = 1;  // Used for unique ids

var AutoRouterGraph = function () {
    this.completelyConnected = true;  // true if all paths are connected
    this.horizontal = new AutoRouterEdgeList(true);
    this.vertical = new AutoRouterEdgeList(false);
    this.boxes = {};
    this.paths = [];
    this.bufferBoxes = [];
    this.box2bufferBox = {}; // maps boxId to corresponding bufferbox object

    this.horizontal.owner = this;
    this.vertical.owner = this;

    //Initializing selfPoints
    this.selfPoints = [
        new ArPoint(CONSTANTS.ED_MINCOORD, CONSTANTS.ED_MINCOORD),
        new ArPoint(CONSTANTS.ED_MAXCOORD, CONSTANTS.ED_MINCOORD),
        new ArPoint(CONSTANTS.ED_MAXCOORD, CONSTANTS.ED_MAXCOORD),
        new ArPoint(CONSTANTS.ED_MINCOORD, CONSTANTS.ED_MAXCOORD)
    ];

    this._addSelfEdges();
};

//Functions
AutoRouterGraph.prototype._deleteAllBoxes = function () {
    var ids = Object.keys(this.boxes);
    for (var i = ids.length; i--;) {
        this.boxes[ids[i]].destroy();
        delete this.boxes[ids[i]];
    }
    // Clean up the bufferBoxes
    this.bufferBoxes = [];
    this.box2bufferBox = {};
};

AutoRouterGraph.prototype._getBoxAt = function (point, nearness) {
    var ids = Object.keys(this.boxes);
    for (var i = ids.length; i--;) {
        if (this.boxes[ids[i]].isBoxAt(point, nearness)) {
            return this.boxes[ids[i]];
        }
    }

    return null;
};

AutoRouterGraph.prototype._setPortAttr = function (port, attr) {
    this._disconnectPathsFrom(port);
    port.attributes = attr;
};

AutoRouterGraph.prototype._isRectClipBoxes = function (rect) {
    var boxRect;
    var ids = Object.keys(this.boxes);
    for (var i = ids.length; i--;) {
        boxRect = this.boxes[ids[i]].rect;
        if (Utils.isRectClip(rect, boxRect)) {
            return true;
        }
    }
    return false;
};

AutoRouterGraph.prototype._isRectClipBufferBoxes = function (rect) {
    var i = this.bufferBoxes.length,
        c;

    while (i--) {
        c = this.bufferBoxes[i].children.length;

        while (c--) {
            if (Utils.isRectClip(rect, this.bufferBoxes[i].children[c])) {
                return true;
            }
        }
    }

    return false;
};

AutoRouterGraph.prototype._isLineClipBufferBoxes = function (p1, p2) {
    var rect = new ArRect(p1, p2);
    rect.normalizeRect();
    assert(rect.left === rect.right || rect.ceil === rect.floor,
        'ARGraph.this._isLineClipBoxes: rect.left === rect.right || rect.ceil === rect.floor FAILED');

    if (rect.left === rect.right) {
        rect.right++;
    }
    if (rect.ceil === rect.floor) {
        rect.floor++;
    }

    return this._isRectClipBufferBoxes(rect);
};

AutoRouterGraph.prototype._isLineClipBoxes = function (p1, p2) {
    var rect = new ArRect(p1, p2);
    rect.normalizeRect();
    assert(rect.left === rect.right || rect.ceil === rect.floor,
        'ARGraph.isLineClipBoxes: rect.left === rect.right || rect.ceil === rect.floor FAILED');

    if (rect.left === rect.right) {
        rect.right++;
    }
    if (rect.ceil === rect.floor) {
        rect.floor++;
    }

    return this._isRectClipBoxes(rect);
};

AutoRouterGraph.prototype._canBoxAt = function (rect) {
    return !this._isRectClipBoxes.inflatedRect(rect, 1);
};

AutoRouterGraph.prototype._add = function (path) {
    assert(path !== null, 'ARGraph.add: path !== null FAILED');
    assert(!path.hasOwner(), 'ARGraph.add: !path.hasOwner() FAILED');

    path.owner = this;

    this.paths.push(path);

    this.horizontal.addPathEdges(path);
    this.vertical.addPathEdges(path);

    if (CONSTANTS.DEBUG) {
        this._assertValidPath(path);
    }

};

AutoRouterGraph.prototype._deleteAllPaths = function () {
    for (var i = this.paths.length; i--;) {
        this.paths[i].destroy();  // Remove point from start/end port
    }

    this.paths = [];
};

AutoRouterGraph.prototype._hasNoPath = function () {
    return this.paths.length === 0;
};

AutoRouterGraph.prototype._getPathCount = function () {
    return this.paths.length;
};

AutoRouterGraph.prototype._getListEdgeAt = function (point, nearness) {

    var edge = this.horizontal.getEdgeAt(point, nearness);
    if (edge) {
        return edge;
    }

    return this.vertical.getEdgeAt(point, nearness);
};

AutoRouterGraph.prototype._getSurroundRect = function () {
    var rect = new ArRect(0, 0, 0, 0),
        i;

    var ids = Object.keys(this.boxes);
    for (i = ids.length; i--;) {
        rect.unionAssign(this.boxes[ids[i]].rect);
    }

    for (i = this.paths.length; i--;) {
        rect.unionAssign(this.paths[i].getSurroundRect());
    }

    return rect;
};

AutoRouterGraph.prototype._getOutOfBox = function (details) {
    var bufferObject = this.box2bufferBox[details.box.id],
        children = bufferObject.children,
        i = bufferObject.children.length,
        point = details.point,
        dir = details.dir,
        boxRect = new ArRect(details.box.rect);

    boxRect.inflateRect(CONSTANTS.BUFFER); //Create a copy of the buffer box

    assert(Utils.isRightAngle(dir), 'ARGraph.getOutOfBox: Utils.isRightAngle (dir) FAILED');

    while (boxRect.ptInRect(point)) {
        if (Utils.isHorizontal(dir)) {
            point.x = Utils.getRectOuterCoord(boxRect, dir);
        } else {
            point.y = Utils.getRectOuterCoord(boxRect, dir);
        }

        while (i--) {
            if (children[i].ptInRect(point)) {
                boxRect = children[i];
                break;
            }
        }
        i = bufferObject.children.length;
    }

    assert(!boxRect.ptInRect(point), 'ARGraph.getOutOfBox: !boxRect.ptInRect( point) FAILED');
};

AutoRouterGraph.prototype._goToNextBufferBox = function (args) {
    var point = args.point,
        end = args.end,
        dir = args.dir,
        dir2 = args.dir2 === undefined || !Utils.isRightAngle(args.dir2) ? (end instanceof ArPoint ?
            Utils.exGetMajorDir(end.minus(point)) : CONSTANTS.DirNone) : args.dir2,
        stophere = args.end !== undefined ? args.end :
            (dir === 1 || dir === 2 ? CONSTANTS.ED_MAXCOORD : CONSTANTS.ED_MINCOORD );

    if (dir2 === dir) {
        dir2 = Utils.isRightAngle(Utils.exGetMinorDir(end.minus(point))) ?
            Utils.exGetMinorDir(end.minus(point)) : (dir + 1) % 4;
    }

    if (end instanceof ArPoint) {
        stophere = Utils.getPointCoord(stophere, dir);
    }

    assert(Utils.isRightAngle(dir), 'ArGraph.goToNextBufferBox: Utils.isRightAngle (dir) FAILED');
    assert(Utils.getPointCoord(point, dir) !== stophere,
        'ArGraph.goToNextBufferBox: Utils.getPointCoord (point, dir) !== stophere FAILED');

    var boxby = null,
        i = -1,
        boxRect;
    //jscs:disable maximumLineLength
    while (++i < this.bufferBoxes.length) {
        boxRect = this.bufferBoxes[i].box;

        if (!Utils.isPointInDirFrom(point, boxRect, dir) && //Add support for entering the parent box
            Utils.isPointBetweenSides(point, boxRect, dir) &&  // if it will not put the point in a corner (relative to dir2)
            Utils.isCoordInDirFrom(stophere,
                Utils.getChildRectOuterCoordFrom(this.bufferBoxes[i], dir, point).coord, dir)) {
            //Return extreme (parent box) for this comparison
            stophere = Utils.getChildRectOuterCoordFrom(this.bufferBoxes[i], dir, point).coord;
            boxby = this.bufferBoxes[i];
        }
    }
    //jscs:enable maximumLineLength

    if (Utils.isHorizontal(dir)) {
        point.x = stophere;
    } else {
        point.y = stophere;
    }

    return boxby;
};

AutoRouterGraph.prototype._hugChildren = function (bufferObject, point, dir1, dir2, exitCondition) {
    // This method creates a path that enters the parent box and 'hugs' the children boxes
    // (remains within one pixel of them) and follows them out.
    assert((dir1 + dir2) % 2 === 1, 'ARGraph.hugChildren: One and only one direction must be horizontal');
    var children = bufferObject.children,
        parentBox = bufferObject.box,
        initPoint = new ArPoint(point),
        child = this._goToNextBox(point, dir1, (dir1 === 1 || dir1 === 2 ?
            CONSTANTS.ED_MAXCOORD : CONSTANTS.ED_MINCOORD ), children),
        finalPoint,
        dir = dir2,
        nextDir = Utils.nextClockwiseDir(dir1) === dir2 ? Utils.nextClockwiseDir : Utils.prevClockwiseDir,
        points = [new ArPoint(point)],
        hasExit = true,
        nextChild,
        old;

    assert(child !== null, 'ARGraph.hugChildren: child !== null FAILED');
    exitCondition = exitCondition === undefined ? function (pt) {
        return !parentBox.ptInRect(pt);
    } : exitCondition;

    _logger.info('About to hug child boxes to find a path');
    while (hasExit && !exitCondition(point, bufferObject)) {
        old = new ArPoint(point);
        nextChild = this._goToNextBox(point, dir, Utils.getRectOuterCoord(child, dir), children);

        if (!points[points.length - 1].equals(old)) {
            points.push(new ArPoint(old)); //The points array should not contain the most recent point.
        }

        if (nextChild === null) {
            dir = Utils.reverseDir(nextDir(dir));
        } else if (Utils.isCoordInDirFrom(Utils.getRectOuterCoord(nextChild, Utils.reverseDir(nextDir(dir))),
                Utils.getPointCoord(point, Utils.reverseDir(nextDir(dir))), Utils.reverseDir(nextDir(dir)))) {
            dir = nextDir(dir);
            child = nextChild;
        }

        if (finalPoint === undefined) {
            finalPoint = new ArPoint(point);
        } else if (!finalPoint.equals(old)) {
            hasExit = !point.equals(finalPoint);
        }
    }

    if (points[0].equals(initPoint)) {
        points.splice(0, 1);
    }

    if (!hasExit) {
        points = null;
        point.assign(initPoint);
    }

    return points;

};

AutoRouterGraph.prototype._goToNextBox = function (point, dir, stop1, boxList) {
    var stophere = stop1;

    /*
     if (stop2 !== undefined) {
     if (stop2 instanceof Array) {
     boxList = stop2;
     } else {
     stophere = stop1 instanceof ArPoint ?
     chooseInDir.getPointCoord (stop1, dir), Utils.getPointCoord (stop2, dir), Utils.reverseDir (dir)) :
     chooseInDir(stop1, stop2, Utils.reverseDir (dir));
     }

     }else */
    if (stop1 instanceof ArPoint) {
        stophere = Utils.getPointCoord(stophere, dir);
    }

    assert(Utils.isRightAngle(dir), 'ArGraph.goToNextBox: Utils.isRightAngle (dir) FAILED');
    assert(Utils.getPointCoord(point, dir) !== stophere,
        'ArGraph.goToNextBox: Utils.getPointCoord (point, dir) !== stophere FAILED');

    var boxby = null,
        iter = boxList.length,
        boxRect;

    while (iter--) {
        boxRect = boxList[iter];

        if (Utils.isPointInDirFrom(point, boxRect, Utils.reverseDir(dir)) &&
            Utils.isPointBetweenSides(point, boxRect, dir) &&
            Utils.isCoordInDirFrom(stophere, Utils.getRectOuterCoord(boxRect, Utils.reverseDir(dir)), dir)) {
            stophere = Utils.getRectOuterCoord(boxRect, Utils.reverseDir(dir));
            boxby = boxList[iter];
        }
    }

    if (Utils.isHorizontal(dir)) {
        point.x = stophere;
    } else {
        point.y = stophere;
    }

    return boxby;
};

AutoRouterGraph.prototype._getLimitsOfEdge = function (startPt, endPt, min, max) {
    var t,
        start = (new ArPoint(startPt)),
        end = (new ArPoint(endPt)),
        ids = Object.keys(this.boxes),
        i,
        rect;

    if (start.y === end.y) {
        if (start.x > end.x) {
            t = start.x;
            start.x = end.x;
            end.x = t;
        }

        for (i = ids.length; i--;) {
            rect = this.boxes[ids[i]].rect;

            if (start.x < rect.right && rect.left <= end.x) {
                if (rect.floor <= start.y && rect.floor > min) {
                    min = rect.floor;
                }
                if (rect.ceil > start.y && rect.ceil < max) {
                    max = rect.ceil;
                }
            }
        }
    } else {
        assert(start.x === end.x, 'ARGraph.this.getLimitsOfEdge: start.x === end.x FAILED');

        if (start.y > end.y) {
            t = start.y;
            start.y = end.y;
            end.y = t;
        }

        for (i = ids.length; i--;) {
            rect = this.boxes[ids[i]].rect;

            if (start.y < rect.floor && rect.ceil <= end.y) {
                if (rect.right <= start.x && rect.right > min) {
                    min = rect.right;
                }
                if (rect.left > start.x && rect.left < max) {
                    max = rect.left;
                }
            }
        }
    }

    max--;

    return {min: min, max: max};
};

AutoRouterGraph.prototype._connect = function (path) {
    var startport = path.getStartPort(),
        endport = path.getEndPort(),
        startpoint = path.startpoint,
        endpoint = path.endpoint;

    assert(startport.hasPoint(startpoint), 'ARGraph.connect: startport.hasPoint(startpoint) FAILED');
    assert(endport.hasPoint(endpoint), 'ARGraph.connect: endport.hasPoint(endpoint) FAILED');

    var startRoot = startport.owner.getRootBox(),
        endRoot = endport.owner.getRootBox(),
        startId = startRoot.id,
        endId = endRoot.id,
        startdir = startport.portOnWhichEdge(startpoint),
        enddir = endport.portOnWhichEdge(endpoint);

    if (startpoint.equals(endpoint)) {
        Utils.stepOneInDir(startpoint, Utils.nextClockwiseDir(startdir));
    }

    if (!path.isAutoRouted()) {
        path.createCustomPath();
        return this.horizontal.addPathEdges(path) && this.vertical.addPathEdges(path);
    } else if (this.box2bufferBox[startId] === this.box2bufferBox[endId] &&
        startdir === Utils.reverseDir(enddir) && startRoot !== endRoot) {

        return this._connectPointsSharingParentBox(path, startpoint, endpoint, startdir);
    } else {

        return this._connectPathWithPoints(path, startpoint, endpoint);
    }

};

AutoRouterGraph.prototype._connectPathWithPoints = function (path, startpoint, endpoint) {
    assert(startpoint instanceof ArPoint, 'ARGraph.connect: startpoint instanceof ArPoint FAILED');
    assert(path !== null && path.owner === this, 'ARGraph.connect: path !== null && path.owner === self FAILED');
    assert(!path.isConnected(), 'ARGraph.connect: !path.isConnected() FAILED');
    assert(!startpoint.equals(endpoint), 'ARGraph.connect: !startpoint.equals(endpoint) FAILED');

    var startPort = path.getStartPort();
    assert(startPort !== null, 'ARGraph.connect: startPort !== null FAILED');

    var startdir = startPort.portOnWhichEdge(startpoint),
        endPort = path.getEndPort();

    assert(endPort !== null, 'ARGraph.connect: endPort !== null FAILED');
    var enddir = endPort.portOnWhichEdge(endpoint);
    assert(Utils.isRightAngle(startdir) && Utils.isRightAngle(enddir),
        'ARGraph.connect: Utils.isRightAngle (startdir) && Utils.isRightAngle (enddir) FAILED');

    //Find the bufferbox containing startpoint, endpoint
    var start = new ArPoint(startpoint);
    this._getOutOfBox({
        point: start,
        dir: startdir,
        end: endpoint,
        box: startPort.owner
    });
    assert(!start.equals(startpoint), 'ARGraph.connect: !start.equals(startpoint) FAILED');

    var end = new ArPoint(endpoint);
    this._getOutOfBox({
        point: end,
        dir: enddir,
        end: start,
        box: endPort.owner
    });
    assert(!end.equals(endpoint), 'ARGraph.connect: !end.equals(endpoint) FAILED');

    var points,
        isAutoRouted = path.isAutoRouted();
    if (isAutoRouted) {
        points = this._connectPoints(start, end, startdir, enddir);
    }

    path.points = points;
    path.points.unshift(startpoint);
    path.points.push(endpoint);

    if (isAutoRouted) {
        this._simplifyPathCurves(path);
        path.simplifyTrivially();
        this._simplifyPathPoints(path);
        this._centerStairsInPathPoints(path, startdir, enddir);
    }
    path.setState(CONSTANTS.PathStateConnected);

    return this.horizontal.addPathEdges(path) && this.vertical.addPathEdges(path);
};

AutoRouterGraph.prototype._connectPointsSharingParentBox = function (path, startpoint, endpoint, startdir) {
    // Connect points that share a parent box and face each other
    // These will not need the simplification and complicated path finding
    var start = new ArPoint(startpoint),
        dx = endpoint.x - start.x,
        dy = endpoint.y - start.y;

    path.deleteAll();

    path.addTail(startpoint);
    if (dx !== 0 && dy !== 0) {
        if (Utils.isHorizontal(startdir)) {
            start.x += dx / 2;
            path.addTail(new ArPoint(start));
            start.y += dy;
            path.addTail(new ArPoint(start));
        } else {
            start.y += dy / 2;
            path.addTail(new ArPoint(start));
            start.x += dx;
            path.addTail(new ArPoint(start));
        }
    }
    path.addTail(endpoint);

    path.setState(CONSTANTS.PathStateConnected);

    return this.horizontal.addPathEdges(path) && this.vertical.addPathEdges(path);

};

AutoRouterGraph.prototype._connectPoints = function (start, end, hintstartdir, hintenddir, flipped) {
    var ret = new ArPointListPath(),
        thestart = new ArPoint(start),
        bufferObject,
        box,
        rect,
        dir1,
        dir2,
        old,
        oldEnd,
        ret2,
        pts,
        rev,
        i,

    //Exit conditions
    //if there is a straight line to the end point
        findExitToEndpoint = function (pt, bo) {
            return (pt.x === end.x || pt.y === end.y) && !Utils.isLineClipRects(pt, end, bo.children);
        },  //If you pass the endpoint, you need to have a way out.

    //exitCondition is when you get to the dir1 side of the box or when you pass end
        getToDir1Side = function (pt, bo) {
            return Utils.getPointCoord(pt, dir1) === Utils.getRectOuterCoord(bo.box, dir1) ||
                ( Utils.isPointInDirFrom(pt, end, dir1));
        };


    //This is where we create the original path that we will later adjust
    while (!start.equals(end)) {

        dir1 = Utils.exGetMajorDir(end.minus(start));
        dir2 = Utils.exGetMinorDir(end.minus(start));

        assert(dir1 !== CONSTANTS.DirNone, 'ARGraph.connectPoints: dir1 !== CONSTANTS.DirNone FAILED');
        assert(dir1 === Utils.getMajorDir(end.minus(start)),
            'ARGraph.connectPoints: dir1 === Utils.getMajorDir(end.minus(start)) FAILED');
        assert(dir2 === CONSTANTS.DirNone || dir2 === Utils.getMinorDir(end.minus(start)),
            'ARGraph.connectPoints: dir2 === CONSTANTS.DirNone || ' +
            'dir2 === Utils.getMinorDir(end.minus(start)) FAILED');

        if (dir2 === hintstartdir && dir2 !== CONSTANTS.DirNone) {
            // i.e. std::swap(dir1, dir2);
            dir2 = dir1;
            dir1 = hintstartdir;
        }

        ret.push(new ArPoint(start));

        old = new ArPoint(start);

        bufferObject = this._goToNextBufferBox({
            point: start,
            dir: dir1,
            dir2: dir2,
            end: end
        });  // Modified goToNextBox (that allows entering parent buffer boxes here
        box = bufferObject === null ? null : bufferObject.box;

        //If goToNextBox does not modify start
        if (start.equals(old)) {

            assert(box !== null, 'ARGraph.connectPoints: box !== null FAILED');
            rect = box instanceof ArRect ? box : box.rect;

            if (dir2 === CONSTANTS.DirNone) {
                dir2 = Utils.nextClockwiseDir(dir1);
            }

            assert(dir1 !== dir2 && dir1 !== CONSTANTS.DirNone && dir2 !== CONSTANTS.DirNone,
                'ARGraph.connectPoints: dir1 !== dir2 && dir1 !== CONSTANTS.DirNone && dir2 !== ' +
                'CONSTANTS.DirNone FAILED');
            if (bufferObject.box.ptInRect(end) && !bufferObject.box.ptInRect(start) && flipped) {
                //Unfortunately, if parentboxes are a pixel apart, start/end can get stuck and not cross the border
                //separating them.... This is a nudge to get them to cross it.
                if (Utils.isHorizontal(dir1)) {
                    start.x = end.x;
                } else {
                    start.y = end.y;
                }
            } else if (bufferObject.box.ptInRect(end)) {
                if (!flipped) {
                    _logger.info('Could not find path from',start,'to', end,'. Flipping start and end points');
                    oldEnd = new ArPoint(end);

                    ret2 = this._connectPoints(end, start, hintenddir, dir1, true);
                    i = ret2.length - 1;

                    while (i-- > 1) {
                        ret.push(ret2[i]);
                    }

                    assert(start.equals(end), 'ArGraph.connectPoints: start.equals(end) FAILED');
                    old = CONSTANTS.EMPTY_POINT;
                    start = end = oldEnd;
                } else {  //If we have flipped and both points are in the same bufferbox
                    // We will hugchildren until we can connect both points.
                    // If we can't, force it
                    pts = this._hugChildren(bufferObject, start, dir1, dir2, findExitToEndpoint);
                    if (pts !== null) {  // There is a path from start -> end
                        if (pts.length) {  // Add new points to the current list 
                            ret = ret.concat(pts);
                        }
                        ret.push(new ArPoint(start));
                        start.assign(end);  // These should not be skew! FIXME

                    } else { //Force to the endpoint
                        assert(Utils.isRightAngle(dir1), 'ARGraph.connectPoints: Utils.isRightAngle (dir1) FAILED');

                        if (Utils.isHorizontal(dir1)) {
                            start.x = end.x;
                        } else {
                            start.y = end.y;
                        }

                        ret.push(new ArPoint(start));

                        if (!Utils.isHorizontal(dir1)) {
                            start.x = end.x;
                        } else {
                            start.y = end.y;
                        }

                        ret.push(new ArPoint(start));

                        assert(start.equals(end));  // We are forcing out so these should be the same now

                    }
                    assert(!start.equals(old));
                }
            } else if (Utils.isPointInDirFrom(end, rect, dir2)) {

                assert(!Utils.isPointInDirFrom(start, rect, dir2),
                    'ARGraph.connectPoints: !Utils.isPointInDirFrom(start, rect, dir2) FAILED');
                box = this._goToNextBufferBox({
                    point: start,
                    dir: dir2,
                    dir2: dir1,
                    end: end
                });

                // this assert fails if two boxes are adjacent, and a connection wants to go between
                //assert(Utils.isPointInDirFrom(start, rect, dir2),
                // 'ARGraph.connectPoints: Utils.isPointInDirFrom(start, rect, dir2) FAILED');
                // This is not the best check with parent boxes
                if (start.equals(old)) { //Then we are in a corner
                    if (box.children.length > 1) {
                        pts = this._hugChildren(box, start, dir2, dir1, getToDir1Side);
                    } else {
                        pts = this._hugChildren(bufferObject, start, dir1, dir2);
                    }
                    if (pts !== null) {

                        //Add new points to the current list 
                        ret = ret.concat(pts);

                    } else { //Go through the blocking box
                        assert(Utils.isRightAngle(dir1), 'ARGraph.getOutOfBox: Utils.isRightAngle (dir1) FAILED');

                        if (Utils.isHorizontal(dir1)) {
                            start.x = Utils.getRectOuterCoord(bufferObject.box, dir1);
                        } else {
                            start.y = Utils.getRectOuterCoord(bufferObject.box, dir1);
                        }
                    }
                }
            } else {
                assert(Utils.isPointBetweenSides(end, rect, dir1),
                    'ARGraph.connectPoints: Utils.isPointBetweenSides(end, rect, dir1) FAILED');
                assert(!Utils.isPointIn(end, rect), 'ARGraph.connectPoints: !Utils.isPointIn(end, rect) FAILED');

                rev = 0;

                if (Utils.reverseDir(dir2) === hintenddir &&
                    Utils.getChildRectOuterCoordFrom(bufferObject, Utils.reverseDir(dir2), start) ===
                    Utils.getRectOuterCoord(rect, Utils.reverseDir(dir2))) { //And if point can exit that way
                    rev = 1;
                } else if (dir2 !== hintenddir) {
                    if (Utils.isPointBetweenSides(thestart, rect, dir1)) {
                        if (Utils.isPointInDirFrom(rect.getTopLeft().plus(rect.getBottomRight()),
                                start.plus(end), dir2)) {
                            rev = 1;
                        }
                    } else if (Utils.isPointInDirFrom(start, thestart, dir2)) {
                        rev = 1;
                    }
                }

                if (rev) {
                    dir2 = Utils.reverseDir(dir2);
                }

                //If the box in the way has one child
                if (bufferObject.children.length === 1) {
                    if (Utils.isHorizontal(dir2)) {
                        start.x = Utils.getRectOuterCoord(rect, dir2);
                    } else {
                        start.y = Utils.getRectOuterCoord(rect, dir2);
                    }

                    assert(!start.equals(old), 'ARGraph.connectPoints: !start.equals(old) FAILED');
                    ret.push(new ArPoint(start));
                    old.assign(start);

                    if (Utils.isHorizontal(dir1)) {
                        start.x = Utils.getRectOuterCoord(rect, dir1);
                    } else {
                        start.y = Utils.getRectOuterCoord(rect, dir1);
                    }

                    assert(Utils.isPointInDirFrom(end, start, dir1),
                        'ARGraph.connectPoints: Utils.isPointInDirFrom(end, start, dir1) FAILED');
                    if (Utils.getPointCoord(start, dir1) !== Utils.getPointCoord(end, dir1)) {
                        this._goToNextBufferBox({
                            point: start,
                            dir: dir1,
                            end: end
                        });
                    }

                } else { //If the box has multiple children
                    pts = this._hugChildren(bufferObject, start, dir1, dir2, getToDir1Side);
                    if (pts !== null) {

                        //Add new points to the current list 
                        ret = ret.concat(pts);

                    } else { //Go through the blocking box
                        assert(Utils.isRightAngle(dir1), 'ARGraph.getOutOfBox: Utils.isRightAngle (dir1) FAILED');

                        if (Utils.isHorizontal(dir1)) {
                            start.x = Utils.getRectOuterCoord(bufferObject.box, dir1);
                        } else {
                            start.y = Utils.getRectOuterCoord(bufferObject.box, dir1);
                        }
                    }
                }
            }

            assert(!start.equals(old), 'ARGraph.connectPoints: !start.equals(old) FAILED');
        }

    }

    ret.push(end);

    if (CONSTANTS.DEBUG) {
        ret.assertValid();  // Check that all edges are horizontal are vertical
    }

    return ret;
};

AutoRouterGraph.prototype._disconnectAll = function () {
    for (var i = this.paths.length; i--;) {
        this.disconnect(this.paths[i]);
    }
};

AutoRouterGraph.prototype.disconnect = function (path) {
    if (path.isConnected()) {
        this.deleteEdges(path);
    }

    path.deleteAll();
    this.completelyConnected = false;
};

AutoRouterGraph.prototype._disconnectPathsClipping = function (rect) {
    for (var i = this.paths.length; i--;) {
        if (this.paths[i].isPathClip(rect)) {
            this.disconnect(this.paths[i]);
        }
    }
};

AutoRouterGraph.prototype._disconnectPathsFrom = function (obj) {
    var iter = this.paths.length,
        path,
        startport,
        endport;

    if (obj instanceof AutoRouterBox) {
        var box = obj,
            startbox,
            endbox;
        while (iter--) {
            path = this.paths[iter];

            assert(path.startports !== null, 'ARGraph.disconnectPathsFrom: startport !== null FAILED');
            assert(path.startports.length > 0, 'ARGraph.disconnectPathsFrom: Path has no startports');
            assert(path.endports !== null, 'ARGraph.disconnectPathsFrom: endport !== null FAILED');
            assert(path.endports.length > 0, 'ARGraph.disconnectPathsFrom: Path has no endports');

            // Can simply select any start/end port to check the owner
            startbox = path.startports[0].owner;
            endbox = path.endports[0].owner;

            assert(startbox !== null, 'ARGraph.disconnectPathsFrom: startbox !== null FAILED');
            assert(endbox !== null, 'ARGraph.disconnectPathsFrom: endbox !== null FAILED');

            if ((startbox === box || endbox === box)) {
                this.disconnect(path);
            }

        }
    } else {  // Assuming 'box' is a port

        var port = obj;
        while (iter--) {
            path = this.paths[iter];
            startport = path.getStartPort();
            endport = path.getEndPort();

            if ((startport === port || endport === port)) {
                this.disconnect(path);
            }

        }
    }
};

AutoRouterGraph.prototype._addSelfEdges = function () {
    this.horizontal.addGraphEdges(this);
    this.vertical.addGraphEdges(this);
};

AutoRouterGraph.prototype._addBoxEdges = function (box) {
    assert(box instanceof AutoRouterBox);
    this.horizontal.addBoxEdges(box);
    this.vertical.addBoxEdges(box);
};

AutoRouterGraph.prototype._addPortEdges = function (port) {
    assert(port instanceof AutoRouterPort);
    this.horizontal.addPortEdges(port);
    this.vertical.addPortEdges(port);
};

AutoRouterGraph.prototype.deleteEdges = function (object) {
    this.horizontal.deleteEdges(object);
    this.vertical.deleteEdges(object);
};

AutoRouterGraph.prototype._addAllEdges = function () {
    assert(this.horizontal.isEmpty() && this.vertical.isEmpty(),
        'ARGraph.addAllEdges: horizontal.isEmpty() && vertical.isEmpty() FAILED');

    var ids = Object.keys(this.boxes),
        i;

    for (i = ids.length; i--;) {
        this._addBoxAndPortEdges(this.boxes[ids[i]]);
    }

    for (i = this.paths.length; i--;) {
        this.horizontal.addPathEdges(this.paths[i]);
        this.vertical.addPathEdges(this.paths[i]);
    }
};

AutoRouterGraph.prototype._deleteAllEdges = function () {
    this.horizontal.deleteAllEdges();
    this.vertical.deleteAllEdges();
};

AutoRouterGraph.prototype._addBoxAndPortEdges = function (box) {
    assert(box !== null, 'ARGraph.addBoxAndPortEdges: box !== null FAILED');

    this._addBoxEdges(box);

    for (var i = box.ports.length; i--;) {
        this._addPortEdges(box.ports[i]);
    }

    // Add to bufferboxes
    this._addToBufferBoxes(box);
    this._updateBoxPortAvailability(box);
};

AutoRouterGraph.prototype._deleteBoxAndPortEdges = function (box) {
    assert(box !== null, 'ARGraph.deleteBoxAndPortEdges: box !== null FAILED');

    this.deleteEdges(box);

    for (var i = box.ports.length; i--;) {
        this.deleteEdges(box.ports[i]);
    }

    this._removeFromBufferBoxes(box);
};

AutoRouterGraph.prototype._getEdgeList = function (ishorizontal) {
    return ishorizontal ? this.horizontal : this.vertical;
};

AutoRouterGraph.prototype._candeleteTwoEdgesAt = function (path, points, pos) {
    if (CONSTANTS.DEBUG) {
        assert(path.owner === this, 'ARGraph.candeleteTwoEdgesAt: path.owner === this FAILED');
        path.assertValid();
        assert(path.isConnected(), 'ARGraph.candeleteTwoEdgesAt: path.isConnected() FAILED');
        points.AssertValidPos(pos);
    }

    if (pos + 2 >= points.length || pos < 1) {
        return false;
    }

    var pointpos = pos,
        point = points[pos++],
        npointpos = pos,
        npoint = points[pos++],
        nnpointpos = pos;

    pos = pointpos;
    pos--;
    var ppointpos = pos;

    var ppoint = points[pos--],
        pppointpos = pos;

    if (npoint.equals(point)) {
        return false; // direction of zero-length edges can't be determined, so don't delete them
    }

    assert(pppointpos < points.length && ppointpos < points.length && pointpos < points.length &&
        npointpos < points.length && nnpointpos < points.length,
        'ARGraph.candeleteTwoEdgesAt: pppointpos < points.length && ppointpos < points.length &&' +
        'pointpos < points.length && npointpos < points.length && nnpointpos < points.length FAILED');

    var dir = Utils.getDir(npoint.minus(point));

    assert(Utils.isRightAngle(dir), 'ARGraph.candeleteTwoEdgesAt: Utils.isRightAngle (dir) FAILED');
    var ishorizontal = Utils.isHorizontal(dir);

    var newpoint = new ArPoint();

    if (ishorizontal) {
        newpoint.x = Utils.getPointCoord(npoint, ishorizontal);
        newpoint.y = Utils.getPointCoord(ppoint, !ishorizontal);
    } else {
        newpoint.y = Utils.getPointCoord(npoint, ishorizontal);
        newpoint.x = Utils.getPointCoord(ppoint, !ishorizontal);
    }

    assert(Utils.getDir(newpoint.minus(ppoint)) === dir,
        'ARGraph.candeleteTwoEdgesAt: Utils.getDir (newpoint.minus(ppoint)) === dir FAILED');

    if (this._isLineClipBoxes(newpoint, npoint)) {
        return false;
    }
    if (this._isLineClipBoxes(newpoint, ppoint)) {
        return false;
    }

    return true;
};

AutoRouterGraph.prototype._deleteTwoEdgesAt = function (path, points, pos) {
    if (CONSTANTS.DEBUG) {
        assert(path.owner === this, 'ARGraph.deleteTwoEdgesAt: path.owner === this FAILED');
        path.assertValid();
        assert(path.isConnected(), 'ARGraph.deleteTwoEdgesAt: path.isConnected() FAILED');
        points.AssertValidPos(pos);
    }

    var pointpos = pos, //Getting the next, and next-next, points
        point = points[pos++],
        npointpos = pos,
        npoint = points[pos++],
        nnpointpos = pos,
        nnpoint = points[pos++],
        nnnpointpos = pos;

    pos = pointpos;
    pos--;

    var ppointpos = pos, //Getting the prev, prev-prev points
        ppoint = points[pos--],
        pppointpos = pos,
        pppoint = points[pos--];

    assert(pppointpos < points.length && ppointpos < points.length && pointpos < points.length &&
    npointpos < points.length && nnpointpos < points.length,
        'ARGraph.deleteTwoEdgesAt: pppointpos < points.length && ppointpos < points.length && pointpos < ' +
        'points.length && npointpos < points.length && nnpointpos < points.length FAILED');
    assert(pppoint !== null && ppoint !== null && point !== null && npoint !== null && nnpoint !== null,
        'ARGraph.deleteTwoEdgesAt: pppoint !== null && ppoint !== null && point !== null && npoint !== null &&' +
        ' nnpoint !== null FAILED');

    var dir = Utils.getDir(npoint.minus(point));

    assert(Utils.isRightAngle(dir), 'ARGraph.deleteTwoEdgesAt: Utils.isRightAngle (dir) FAILED');
    var ishorizontal = Utils.isHorizontal(dir);

    var newpoint = new ArPoint();
    if (ishorizontal) {
        newpoint.x = Utils.getPointCoord(npoint, ishorizontal);
        newpoint.y = Utils.getPointCoord(ppoint, !ishorizontal);
    } else {
        newpoint.x = Utils.getPointCoord(ppoint, !ishorizontal);
        newpoint.y = Utils.getPointCoord(npoint, ishorizontal);
    }

    assert(Utils.getDir(newpoint.minus(ppoint)) === dir,
        'ARGraph.deleteTwoEdgesAt: Utils.getDir (newpoint.minus(ppoint)) === dir FAILED');

    assert(!this._isLineClipBoxes(newpoint, npoint),
        'ARGraph.deleteTwoEdgesAt: !isLineClipBoxes(newpoint, npoint) FAILED');
    assert(!this._isLineClipBoxes(newpoint, ppoint),
        'ARGraph.deleteTwoEdgesAt: !isLineClipBoxes(newpoint, ppoint) FAILED');

    var hlist = this._getEdgeList(ishorizontal),
        vlist = this._getEdgeList(!ishorizontal);

    var ppedge = hlist.getEdgeByPointer(pppoint),
        pedge = vlist.getEdgeByPointer(ppoint),
        nedge = hlist.getEdgeByPointer(point),
        nnedge = vlist.getEdgeByPointer(npoint);

    assert(ppedge !== null && pedge !== null && nedge !== null && nnedge !== null,
        'ARGraph.deleteTwoEdgesAt:  ppedge !== null && pedge !== null && nedge !== null && nnedge !== null FAILED');

    vlist.remove(pedge);
    hlist.remove(nedge);

    points.splice(ppointpos, 3, newpoint);
    ppedge.endpointNext = nnpoint;
    ppedge.endpoint = newpoint;

    nnedge.startpoint = newpoint;
    nnedge.startpointPrev = pppoint;

    if (nnnpointpos < points.length) {
        var nnnedge = hlist.getEdgeByPointer(nnpoint, (nnnpointpos));
        assert(nnnedge !== null,
            'ARGraph.deleteTwoEdgesAt: nnnedge !== null FAILED');
        assert(nnnedge.startpointPrev.equals(npoint) && nnnedge.startpoint.equals(nnpoint),
            'ARGraph.deleteTwoEdgesAt: nnnedge.startpointPrev.equals(npoint)' +
            '&& nnnedge.startpoint.equals(nnpoint) FAILED');
        nnnedge.startpointPrev = ppoint;
    }

    if (nnpoint.equals(newpoint)) {
        this._deleteSamePointsAt(path, points, ppointpos);
    }

};

AutoRouterGraph.prototype._deleteSamePointsAt = function (path, points, pos) {
    if (CONSTANTS.DEBUG) {
        assert(path.owner === this, 'ARGraph.deleteSamePointsAt: path.owner === this FAILED');
        path.assertValid();
        assert(path.isConnected(), 'ARGraph.deleteSamePointsAt: path.isConnected() FAILED');
        points.AssertValidPos(pos);
    }

    var pointpos = pos,
        point = points[pos++],
        npointpos = pos,
        npoint = points[pos++],
        nnpointpos = pos,
        nnpoint = points[pos++],
        nnnpointpos = pos;

    pos = pointpos;
    pos--;

    var ppointpos = pos,
        ppoint = points[pos--],
        pppointpos = pos,
        pppoint = pos === points.length ? null : points[pos--];

    assert(ppointpos < points.length && pointpos < points.length && npointpos < points.length &&
    nnpointpos < points.length);
    assert(ppoint !== null && point !== null && npoint !== null && nnpoint !== null,
        'ARGraph.deleteSamePointsAt: ppoint !== null && point !== null && npoint !== null && ' +
        'nnpoint !== null FAILED');
    assert(point.equals(npoint) && !point.equals(ppoint),
        'ARGraph.deleteSamePointsAt: point.equals(npoint) && !point.equals(ppoint) FAILED');

    var dir = Utils.getDir(point.minus(ppoint));
    assert(Utils.isRightAngle(dir), 'ARGraph.deleteSamePointsAt: Utils.isRightAngle (dir) FAILED');

    var ishorizontal = Utils.isHorizontal(dir),
        hlist = this._getEdgeList(ishorizontal),
        vlist = this._getEdgeList(!ishorizontal),

        pedge = hlist.getEdgeByPointer(ppoint, point),
        nedge = vlist.getEdgeByPointer(point, npoint),
        nnedge = hlist.getEdgeByPointer(npoint, nnpoint);

    assert(pedge !== null && nedge !== null && nnedge !== null, 'ARGraph.deleteSamePointsAt: pedge !== null ' +
    '&& nedge !== null && nnedge !== null FAILED');

    vlist.remove(pedge);
    hlist.remove(nedge);

    points.splice(pointpos, 2);

    if (pppointpos < points.length) {
        var ppedge = vlist.getEdgeByPointer(pppoint, ppoint);
        assert(ppedge !== null && ppedge.endpoint.equals(ppoint) && ppedge.endpointNext.equals(point),
            'ARGraph.deleteSamePointsAt: ppedge !== null && ppedge.endpoint.equals(ppoint) && ' +
            'ppedge.endpointNext.equals(point) FAILED');
        ppedge.endpointNext = nnpoint;
    }

    assert(nnedge.startpoint.equals(npoint) && nnedge.startpointPrev.equals(point),
        'ARGraph.deleteSamePointsAt: nnedge.startpoint.equals(npoint) && nnedge.startpointPrev.equals(point)' +
        ' FAILED');
    nnedge.setStartPoint(ppoint);
    nnedge.startpointPrev = pppoint;

    if (nnnpointpos < points.length) {
        var nnnedge = vlist.getEdgeByPointer(nnpoint, (nnnpointpos)); //&*
        assert(nnnedge !== null && nnnedge.startpointPrev.equals(npoint) && nnnedge.startpoint.equals(nnpoint),
            'ARGraph.deleteSamePointsAt: nnnedge !== null && nnnedge.startpointPrev.equals(npoint) && ' +
            'nnnedge.startpoint.equals(nnpoint) FAILED');
        nnnedge.startpointPrev = ppoint;
    }

    if (CONSTANTS.DEBUG_DEEP) {
        path.assertValid();
    }
};

AutoRouterGraph.prototype._simplifyPaths = function () {
    var modified = false,
        path,
        pointList,
        pointpos;

    for (var i = this.paths.length; i--;) {
        path = this.paths[i];

        if (path.isAutoRouted()) {
            pointList = path.getPointList();
            pointpos = 0;

            modified = this._fixShortPaths(path) || modified;

            while (pointpos < pointList.length) {
                if (this._candeleteTwoEdgesAt(path, pointList, pointpos)) {
                    this._deleteTwoEdgesAt(path, pointList, pointpos);
                    modified = true;
                    break;
                }
                pointpos++;
            }
        }
    }

    return modified;
};

AutoRouterGraph.prototype._centerStairsInPathPoints = function (path, hintstartdir, hintenddir) {
    assert(path !== null, 'ARGraph.centerStairsInPathPoints: path !== null FAILED');
    assert(!path.isConnected(), 'ARGraph.centerStairsInPathPoints: !path.isConnected() FAILED');

    var pointList = path.getPointList();
    assert(pointList.length >= 2, 'ARGraph.centerStairsInPathPoints: pointList.length >= 2 FAILED');

    if (CONSTANTS.DEBUG) {
        path.assertValidPoints();
    }

    var p1,
        p2,
        p3,
        p4,

        p1p = pointList.length,
        p2p = pointList.length,
        p3p = pointList.length,
        p4p = pointList.length,

        d12 = CONSTANTS.DirNone,
        d23 = CONSTANTS.DirNone,
        d34 = CONSTANTS.DirNone,

        outOfBoxStartPoint = path.getOutOfBoxStartPoint(hintstartdir),
        outOfBoxEndPoint = path.getOutOfBoxEndPoint(hintenddir),

        pos = 0;
    assert(pos < pointList.length, 'ARGraph.centerStairsInPathPoints pos < pointList.length FAILED');

    p1p = pos;
    p1 = (pointList[pos++]);

    var np2,
        np3,
        h,
        p4x,
        p3x,
        p1x,
        tmp,
        t,
        m;


    while (pos < pointList.length) {
        p4p = p3p;
        p3p = p2p;
        p2p = p1p;
        p1p = pos;

        p4 = p3;
        p3 = p2;
        p2 = p1;
        p1 = (pointList[pos++]);

        d34 = d23;
        d23 = d12;

        if (p2p < pointList.length) {
            d12 = Utils.getDir(p2.minus(p1));
            if (CONSTANTS.DEBUG) {
                assert(Utils.isRightAngle(d12), 'ARGraph.centerStairsInPathPoints: ' +
                'Utils.isRightAngle (d12) FAILED');
                if (p3p !== pointList.end()) {
                    assert(Utils.areInRightAngle(d12, d23), 'ARGraph.centerStairsInPathPoints: ' +
                    'Utils.areInRightAngle (d12, d23) FAILED');
                }
            }
        }

        if (p4p < pointList.length && d12 === d34) {
            assert(p1p < pointList.length && p2p < pointList.length && p3p < pointList.length &&
            p4p < pointList.length, 'ARGraph.centerStairsInPathPoints: p1p < pointList.length && ' +
            'p2p < pointList.length && p3p < pointList.length && p4p < pointList.length FAILED');

            np2 = new ArPoint(p2);
            np3 = new ArPoint(p3);
            h = Utils.isHorizontal(d12);

            p4x = Utils.getPointCoord(p4, h);
            p3x = Utils.getPointCoord(p3, h);
            p1x = Utils.getPointCoord(p1, h);

            // p1x will represent the larger x value in this 'step' situation
            if (p1x < p4x) {
                t = p1x;
                p1x = p4x;
                p4x = t;
            }

            if (p4x < p3x && p3x < p1x) {
                m = Math.round((p4x + p1x) / 2);
                if (h) {
                    np2.x = m;
                    np3.x = m;
                } else {
                    np2.y = m;
                    np3.y = m;
                }

                tmp = this._getLimitsOfEdge(np2, np3, p4x, p1x);
                p4x = tmp.min;
                p1x = tmp.max;

                m = Math.round((p4x + p1x) / 2);

                if (h) {
                    np2.x = m;
                    np3.x = m;
                } else {
                    np2.y = m;
                    np3.y = m;
                }

                if (!this._isLineClipBoxes(np2, np3) && !this._isLineClipBoxes(p1p === pointList.length ?
                        outOfBoxEndPoint : p1, np2) && !this._isLineClipBoxes(p4p === 0 ?
                        outOfBoxStartPoint : p4, np3)) {
                    p2 = np2;
                    p3 = np3;
                    pointList.splice(p2p, 1, p2);
                    pointList.splice(p3p, 1, p3);
                }
            }
        }
    }

    if (CONSTANTS.DEBUG) {
        path.assertValidPoints();
    }
};

/**
 * Make sure if a straight line is possible, create a straight line for
 * the path.
 *
 * @param {AutoRouterPath} path
 */
AutoRouterGraph.prototype._fixShortPaths = function (path) {

    var modified = false,
        startport = path.getStartPort(),
        endport = path.getEndPort(),
        len = path.getPointList().length;

    if (len === 4) {
        var points = path.getPointList(),
            startpoint = points[0],
            endpoint = points[len - 1],
            startDir = startport.portOnWhichEdge(startpoint),
            endDir = endport.portOnWhichEdge(endpoint),
            tstStart,
            tstEnd;

        if (startDir === Utils.reverseDir(endDir)) {
            var isHorizontal = Utils.isHorizontal(startDir),
                newStart = new ArPoint(startpoint),
                newEnd = new ArPoint(endpoint),
                startRect = startport.rect,
                endRect = endport.rect,
                minOverlap,
                maxOverlap;

            if (isHorizontal) {
                minOverlap = Math.min(startRect.floor, endRect.floor);
                maxOverlap = Math.max(startRect.ceil, endRect.ceil);

                var newY = (minOverlap + maxOverlap) / 2;
                newStart.y = newY;
                newEnd.y = newY;

                tstStart = new ArPoint(Utils.getRectOuterCoord(startport.owner.rect, startDir), newStart.y);
                tstEnd = new ArPoint(Utils.getRectOuterCoord(endport.owner.rect, endDir), newEnd.y);

            } else {
                minOverlap = Math.min(startRect.right, endRect.right);
                maxOverlap = Math.max(startRect.left, endRect.left);

                var newX = (minOverlap + maxOverlap) / 2;
                newStart.x = newX;
                newEnd.x = newX;

                tstStart = new ArPoint(newStart.x, Utils.getRectOuterCoord(startport.owner.rect, startDir));
                tstEnd = new ArPoint(newEnd.x, Utils.getRectOuterCoord(endport.owner.rect, endDir));
            }

            var validPointLocation = startRect.ptInRect(newStart) && !startRect.onCorner(newStart) &&
                endRect.ptInRect(newEnd) && !endRect.onCorner(newEnd);

            if (validPointLocation && !this._isLineClipBoxes(tstStart, tstEnd)) {
                var hlist = this._getEdgeList(isHorizontal),
                    vlist = this._getEdgeList(!isHorizontal),
                    edge = hlist.getEdgeByPointer(startpoint),
                    edge2 = vlist.getEdgeByPointer(points[1]),
                    edge3 = hlist.getEdgeByPointer(points[2]);

                vlist.remove(edge2);
                hlist.remove(edge3);
                hlist.remove(edge);

                // The values of startpoint is changed but we don't change the startpoint of the edge
                startpoint.assign(newStart);
                // to maintain the reference that the port has to the startpoint
                endpoint.assign(newEnd);
                edge.setEndPoint(endpoint);

                edge.startpointPrev = null;
                edge.endpointNext = null;

                edge.positionY = Utils.getPointCoord(newStart, Utils.nextClockwiseDir(startDir));
                hlist.insert(edge);

                points.splice(1, 2);
                modified = true;
            }
        }
    }

    return modified;
};

/**
 * Remove unnecessary curves inserted into the path from the
 * tracing the edges of overlapping boxes. (hug children)
 *
 * @param {AutoRouterPath} path
 */
AutoRouterGraph.prototype._simplifyPathCurves = function (path) {
    // Incidently, this will also contain the functionality of simplifyTrivially
    var pointList = path.getPointList(),
        p1,
        p2,
        i = 0,
        j;

    // I will be taking the first point and checking to see if it can create a straight line
    // that does not Utils.intersect  any other boxes on the graph from the test point to the other point.
    // The 'other point' will be the end of the path iterating back til the two points before the 
    // current.
    while (i < pointList.length - 3) {
        p1 = pointList[i];
        j = pointList.length;

        while (j-- > 0) {
            p2 = pointList[j];
            if (Utils.isRightAngle(Utils.getDir(p1.minus(p2))) && !this._isLineClipBoxes(p1, p2) ||
                p1.equals(p2)) {
                pointList.splice(i + 1, j - i - 1); // Remove all points between i, j
                break;
            }
        }
        ++i;
    }
};

/* The following shape in a path
 * _______
 *       |       ___
 *       |      |
 *       |______|
 *
 * will be replaced with 
 * _______
 *       |______
 *
 * if possible.
 */
/**
 * Replace 5 points for 3 where possible. This will replace 'u'-like shapes
 * with 'z' like shapes.
 *
 * @param path
 * @return {undefined}
 */
AutoRouterGraph.prototype._simplifyPathPoints = function (path) {
    assert(path !== null, 'ARGraph.simplifyPathPoints: path !== null FAILED');
    assert(!path.isConnected(), 'ARGraph.simplifyPathPoints: !path.isConnected() FAILED');

    var pointList = path.getPointList();
    assert(pointList.length >= 2, 'ARGraph.simplifyPathPoints: pointList.length >= 2 FAILED');

    if (CONSTANTS.DEBUG) {
        path.assertValidPoints();
    }

    var p1,
        p2,
        p3,
        p4,
        p5,

        p1p = pointList.length,
        p2p = pointList.length,
        p3p = pointList.length,
        p4p = pointList.length,
        p5p = pointList.length,

        pos = 0,

        np3,
        d,
        h;

    assert(pos < pointList.length, 'ARGraph.simplifyPathPoints: pos < pointList.length FAILED');

    p1p = pos;
    p1 = pointList[pos++];

    while (pos < pointList.length) {
        p5p = p4p;
        p4p = p3p;
        p3p = p2p;
        p2p = p1p;
        p1p = pos;

        p5 = p4;
        p4 = p3;
        p3 = p2;
        p2 = p1;
        p1 = pointList[pos++];

        if (p5p < pointList.length) {
            assert(p1p < pointList.length && p2p < pointList.length && p3p < pointList.length &&
                p4p < pointList.length && p5p < pointList.length,
                'ARGraph.simplifyPathPoints: p1p < pointList.length && p2p < pointList.length && ' +
                'p3p < pointList.length && p4p < pointList.length && p5p < pointList.length FAILED');

            assert(!p1.equals(p2) && !p2.equals(p3) && !p3.equals(p4) && !p4.equals(p5),
                'ARGraph.simplifyPathPoints: !p1.equals(p2) && !p2.equals(p3) && !p3.equals(p4) && ' +
                '!p4.equals(p5) FAILED');

            d = Utils.getDir(p2.minus(p1));
            assert(Utils.isRightAngle(d), 'ARGraph.simplifyPathPoints: Utils.isRightAngle (d) FAILED');
            h = Utils.isHorizontal(d);

            np3 = new ArPoint();
            if (h) {
                np3.x = Utils.getPointCoord(p5, h);
                np3.y = Utils.getPointCoord(p1, !h);
            } else {
                np3.x = Utils.getPointCoord(p1, !h);
                np3.y = Utils.getPointCoord(p5, h);
            }

            if (!this._isLineClipBoxes(p2, np3) && !this._isLineClipBoxes(np3, p4)) {
                pointList.splice(p2p, 1);
                pointList.splice(p3p, 1);
                pointList.splice(p4p, 1);

                if (!np3.equals(p1) && !np3.equals(p5)) {
                    pointList.splice(p4p, 0, np3);
                }

                p1p = pointList.length;
                p2p = pointList.length;
                p3p = pointList.length;
                p4p = pointList.length;

                pos = 0;
            }
        }
    }

    if (CONSTANTS.DEBUG) {
        path.assertValidPoints();
    }
};

AutoRouterGraph.prototype._connectAllDisconnectedPaths = function () {
    var i,
        len = this.paths.length,
        success = false,
        giveup = false,
        path;

    while (!success && !giveup) {
        success = true;
        i = len;
        while (i-- && success) {
            path = this.paths[i];

            if (!path.isConnected()) {
                success = this._connect(path);

                if (!success) {
                    // Something is messed up, probably an existing edge customization results in a zero length edge
                    // In that case we try to delete any customization for this path to recover from the problem
                    if (path.areTherePathCustomizations()) {
                        path.removePathCustomizations();
                    } else {
                        giveup = true;
                    }
                }
            }
        }
        if (!success && !giveup) {
            this._disconnectAll();	// There was an error, delete halfway results to be able to start a new pass
        }
    }
    this.completelyConnected = true;
};

AutoRouterGraph.prototype._updateBoxPortAvailability = function (inputBox) {
    var bufferbox,
        siblings,
        skipBoxes = {},
        box,
        id;

    bufferbox = this.box2bufferBox[inputBox.id];
    assert(bufferbox, 'Bufferbox not found for ' + inputBox.id);
    siblings = bufferbox.children;
    // Ignore overlap from ancestor boxes in the box trees
    box = inputBox;
    do {
        skipBoxes[box.id] = true;
        box = box.parent;
    } while (box);

    for (var i = siblings.length; i--;) {
        id = siblings[i].id;
        if (skipBoxes[id]) {  // Skip boxes on the box tree
            continue;
        }

        if (inputBox.rect.touching(siblings[i])) {
            inputBox.adjustPortAvailability(this.boxes[siblings[i].id]);
            this.boxes[siblings[i].id].adjustPortAvailability(inputBox);
        }
    }
};

AutoRouterGraph.prototype._addToBufferBoxes = function (inputBox) {
    var box = {rect: new ArRect(inputBox.rect), id: inputBox.id},
        overlapBoxesIndices = [],
        bufferBox,
        children = [],
        parentBox,
        ids = [inputBox.id],
        child,
        i,
        j;

    box.rect.inflateRect(CONSTANTS.BUFFER);
    assert(!this.box2bufferBox[inputBox.id],
        'Can\'t add box to 2 bufferboxes');

    // For every buffer box touching the input box
    // Record the buffer boxes with children touching 
    // the input box
    for (i = this.bufferBoxes.length; i--;) {
        if (!box.rect.touching(this.bufferBoxes[i].box)) {
            continue;
        }

        j = this.bufferBoxes[i].children.length;
        while (j--) {
            child = this.bufferBoxes[i].children[j];
            if (box.rect.touching(child)) {
                inputBox.adjustPortAvailability(this.boxes[child.id]);
                this.boxes[child.id].adjustPortAvailability(inputBox);

                if (overlapBoxesIndices.indexOf(i) === -1) {
                    overlapBoxesIndices.push(i);
                }
            }

        }
    }

    parentBox = new ArRect(box.rect);
    // If overlapped other boxes, create the new bufferbox parent rect
    if (overlapBoxesIndices.length !== 0) {

        for (i = 0; i < overlapBoxesIndices.length; i++) {
            assert(overlapBoxesIndices[i] < this.bufferBoxes.length,
                'ArGraph.addToBufferBoxes: overlapBoxes index out of bounds. (' +
                overlapBoxesIndices[i] + ' < ' + this.bufferBoxes.length + ')');

            bufferBox = this.bufferBoxes.splice(overlapBoxesIndices[i], 1)[0];

            for (j = bufferBox.children.length; j--;) {
                children.push(bufferBox.children[j]);
                ids.push(bufferBox.children[j].id);  // Store the ids of the children that need to be adjusted
            }

            parentBox.unionAssign(bufferBox.box);
        }
    }

    box.rect.id = inputBox.id;
    children.push(box.rect);

    this.bufferBoxes.push({box: parentBox, children: children});

    for (i = ids.length; i--;) {
        this.box2bufferBox[ids[i]] = this.bufferBoxes[this.bufferBoxes.length - 1];
    }
};

AutoRouterGraph.prototype._removeFromBufferBoxes = function (box) {
    // Get the children of the parentBox (not including the box to remove)
    // Create bufferboxes from these children
    var bufferBox = this.box2bufferBox[box.id],
        i = this.bufferBoxes.indexOf(bufferBox),
        children = bufferBox.children,
        groups = [],
        add = false,
        parentBox,
        child,
        group,
        ids,
        id,
        j,
        g;

    assert(i !== -1, 'ARGraph.removeFromBufferBoxes: Can\'t find the correct bufferbox.');

    // Remove record of removed box
    this.bufferBoxes.splice(i, 1);
    this.box2bufferBox[box.id] = undefined;

    //Create groups of overlap from children
    i = children.length;
    while (i--) {
        g = groups.length;
        child = children[i];
        group = [child];
        add = false;

        this.boxes[child.id].resetPortAvailability();  // Reset box's ports availableAreas

        if (child.id === box.id) {
            continue;
        }

        while (g--) {
            j = groups[g].length;

            while (j--) {
                if (groups[g][j].touching(child)) {
                    id = groups[g][j].id;
                    this.boxes[child.id].adjustPortAvailability(this.boxes[id]);
                    this.boxes[id].adjustPortAvailability(this.boxes[child.id]);
                    add = true;
                }
            }

            if (add) {
                // group will accumulate all things overlapping the child
                group = group.concat(groups.splice(g, 1)[0]);
            }
        }

        groups.push(group);  // Add group to groups
    }

    i = groups.length;
    while (i--) {
        j = groups[i].length;
        parentBox = new ArRect(groups[i][0]);
        ids = [];

        while (j--) {
            parentBox.unionAssign(groups[i][j]);
            ids.push(groups[i][j].id);
        }

        this.bufferBoxes.push({box: parentBox, children: groups[i]});

        j = ids.length;
        while (j--) {
            this.box2bufferBox[ids[j]] = this.bufferBoxes[this.bufferBoxes.length - 1];
        }
    }

};

//Public Functions

AutoRouterGraph.prototype.setBuffer = function (newBuffer) {
    CONSTANTS.BUFFER = newBuffer;
};

AutoRouterGraph.prototype.calculateSelfPoints = function () {
    this.selfPoints = [];
    this.selfPoints.push(new ArPoint(CONSTANTS.ED_MINCOORD, CONSTANTS.ED_MINCOORD));
    this.selfPoints.push(new ArPoint(CONSTANTS.ED_MAXCOORD, CONSTANTS.ED_MINCOORD));
    this.selfPoints.push(new ArPoint(CONSTANTS.ED_MAXCOORD, CONSTANTS.ED_MAXCOORD));
    this.selfPoints.push(new ArPoint(CONSTANTS.ED_MINCOORD, CONSTANTS.ED_MAXCOORD));
};

AutoRouterGraph.prototype.createBox = function () {
    var box = new AutoRouterBox();
    assert(box !== null, 'ARGraph.createBox: box !== null FAILED');

    return box;
};

AutoRouterGraph.prototype.addBox = function (box) {
    assert(box !== null,
        'ARGraph.addBox: box !== null FAILED');
    assert(box instanceof AutoRouterBox,
        'ARGraph.addBox: box instanceof AutoRouterBox FAILED');

    var rect = box.rect;

    this._disconnectPathsClipping(rect);

    box.owner = this;
    var boxId = (COUNTER++).toString();
    while (boxId.length < 6) {
        boxId = '0' + boxId;
    }
    boxId = 'BOX_' + boxId;
    box.id = boxId;

    this.boxes[boxId] = box;

    this._addBoxAndPortEdges(box);

    // add children of the box
    var children = box.childBoxes,
        i = children.length;
    while (i--) {
        this.addBox(children[i]);
    }
};

AutoRouterGraph.prototype.deleteBox = function (box) {
    assert(box !== null, 'ARGraph.deleteBox: box !== null FAILED');

    if (box.hasOwner()) {
        var parent = box.parent,
            children = box.childBoxes,
            i = children.length;

        // notify the parent of the deletion
        if (parent) {
            parent.removeChild(box);
        }

        // remove children
        while (i--) {
            this.deleteBox(children[i]);
        }

        this._deleteBoxAndPortEdges(box);
        box.owner = null;
        assert(this.boxes[box.id] !== undefined, 'ARGraph.remove: Box does not exist');

        delete this.boxes[box.id];
    }

    box.destroy();
    box = null;
};

AutoRouterGraph.prototype.shiftBoxBy = function (box, offset) {
    assert(box !== null, 'ARGraph.shiftBoxBy: box !== null FAILED');
    assert(!!this.boxes[box.id], 'ARGraph.shiftBoxBy: Box does not exist!');

    var rect = this.box2bufferBox[box.id].box,
        children = box.childBoxes;

    this._disconnectPathsClipping(rect); // redraw all paths clipping parent box.
    this._disconnectPathsFrom(box);

    this._deleteBoxAndPortEdges(box);

    box.shiftBy(offset);
    this._addBoxAndPortEdges(box);

    rect = box.rect;
    this._disconnectPathsClipping(rect);

    for (var i = children.length; i--;) {
        this.shiftBoxBy(children[i], offset);
    }
};

AutoRouterGraph.prototype.setBoxRect = function (box, rect) {
    if (box === null) {
        return;
    }

    this._deleteBoxAndPortEdges(box);
    box.setRect(rect);
    this._addBoxAndPortEdges(box);

    this._disconnectPathsClipping(rect);
};

AutoRouterGraph.prototype.routeSync = function () {
    var state = {finished: false};

    this._connectAllDisconnectedPaths();

    while (!state.finished) {
        state = this._optimize(state);
    }

};

AutoRouterGraph.prototype.routeAsync = function (options) {
    var self = this,
        updateFn = options.update || Utils.nop,
        firstFn = options.first || Utils.nop,
        callbackFn = options.callback || Utils.nop,
        time = options.time || 5,
        optimizeFn = function (state) {
            _logger.info('Async optimization cycle started');

            // If a path has been disconnected, start the routing over
            if (!self.completelyConnected) {
                _logger.info('Async optimization interrupted');
                return setTimeout(startRouting, time);
            }

            updateFn(self.paths);
            if (state.finished) {
                _logger.info('Async routing finished');
                return callbackFn(self.paths);
            } else {
                state = self._optimize(state);
                return setTimeout(optimizeFn, time, state);
            }
        },
        startRouting = function () {
            _logger.info('Async routing started');
            var state = {finished: false};
            self._connectAllDisconnectedPaths();

            // Start the optimization
            setTimeout(optimizeFn, time, state);
        };

    _logger.info('Async routing triggered');
    // Connect all disconnected paths with a straight line
    var disconnected = this._quickConnectDisconnectedPaths();
    firstFn(disconnected);

    this._disconnectTempPaths(disconnected);

    setTimeout(startRouting, time);
};

/**
 * Connect all disconnected paths in a quick way while a better layout is
 * being calculated.
 *
 * @return {Array<Path>} disconnected paths
 */
AutoRouterGraph.prototype._quickConnectDisconnectedPaths = function () {
    var path,
        disconnected = [];
    for (var i = this.paths.length; i--;) {
        path = this.paths[i];
        if (!path.isConnected()) {
            path.calculateStartEndPorts();
            path.points = new ArPointListPath(path.startpoint, path.endpoint);
            disconnected.push(path);
        }
    }
    return disconnected;
};

AutoRouterGraph.prototype._disconnectTempPaths = function (paths) {
    for (var i = paths.length; i--;) {
        paths[i].points = new ArPointListPath();
    }
};

/**
 * Performs one set of optimizations.
 *
 * @param {Number} count This stores the max number of optimizations allowed
 * @param {Number} last This stores the last optimization type made
 *
 * @return {Object} Current count, last values
 */
AutoRouterGraph.prototype._optimize = function (options) {
    var maxOperations = options.maxOperations || 100,
        last = options.last || 0,
        dm = options.dm || 10,		// max # of distribution op
        d = options.d || 0,
        getState = function (finished) {
            return {
                finished: finished || !maxOperations,
                maxOperations: maxOperations,
                last: last,
                dm: dm,
                d: d
            };
        };

    if (maxOperations > 0) {

        if (last === 1) {
            return getState(true);
        }

        maxOperations--;
        if (this._simplifyPaths()) {
            last = 1;
        }
    }

    if (maxOperations > 0) {
        if (last === 2) {
            return getState(true);
        }

        maxOperations--;
        if (this.horizontal.blockScanBackward()) {

            do {
                maxOperations--;
            } while (maxOperations > 0 && this.horizontal.blockScanBackward());

            if (last < 2 || last > 5) {
                d = 0;
            } else if (++d >= dm) {
                return getState(true);
            }

            last = 2;
        }
    }

    if (maxOperations > 0) {
        if (last === 3) {
            return getState(true);
        }

        maxOperations--;
        if (this.horizontal.blockScanForward()) {

            do {
                maxOperations--;
            } while (maxOperations > 0 && this.horizontal.blockScanForward());

            if (last < 2 || last > 5) {
                d = 0;
            } else if (++d >= dm) {
                return getState(true);
            }

            last = 3;
        }
    }

    if (maxOperations > 0) {
        if (last === 4) {
            return getState(true);
        }

        maxOperations--;
        if (this.vertical.blockScanBackward()) {
            do {
                maxOperations--;
            } while (maxOperations > 0 && this.vertical.blockScanBackward());

            if (last < 2 || last > 5) {
                d = 0;
            } else if (++d >= dm) {
                return getState(true);
            }

            last = 4;
        }
    }

    if (maxOperations > 0) {
        if (last === 5) {
            return getState(true);
        }

        maxOperations--;
        if (this.vertical.blockScanForward()) {

            do {
                maxOperations--;
            } while (maxOperations > 0 && this.vertical.blockScanForward());

            if (last < 2 || last > 5) {
                d = 0;
            } else if (++d >= dm) {
                return getState(true);
            }

            last = 5;
        }
    }

    if (maxOperations > 0) {
        if (last === 6) {
            return getState(true);
        }

        maxOperations--;
        if (this.horizontal.blockSwitchWrongs()) {
            last = 6;
        }
    }

    if (maxOperations > 0) {
        if (last === 7) {
            return getState(true);
        }

        maxOperations--;
        if (this.vertical.blockSwitchWrongs()) {
            last = 7;
        }
    }

    if (last === 0) {
        return getState(true);
    }

    return getState(false);
};

AutoRouterGraph.prototype.deletePath = function (path) {
    assert(path !== null, 'ARGraph.deletePath: path !== null FAILED');

    if (path.hasOwner()) {
        assert(path.owner === this, 'ARGraph.deletePath: path.owner === this FAILED');

        this.deleteEdges(path);
        path.owner = null;
        var index = this.paths.indexOf(path);

        assert(index > -1, 'ARGraph.remove: Path does not exist');
        this.paths.splice(index, 1);
    }

    path.destroy();
};

AutoRouterGraph.prototype.clear = function (addBackSelfEdges) {
    this._deleteAllPaths();
    this._deleteAllBoxes();
    this._deleteAllEdges();
    if (addBackSelfEdges) {
        this._addSelfEdges();
    }
};

AutoRouterGraph.prototype.addPath = function (isAutoRouted, startports, endports) {
    var path = new AutoRouterPath();

    path.setAutoRouting(isAutoRouted);
    path.setStartEndPorts(startports, endports);
    this._add(path);

    return path;
};

AutoRouterGraph.prototype.isEdgeFixed = function (path, startpoint, endpoint) {
    var d = Utils.getDir(endpoint.minus(startpoint)),
        h = Utils.isHorizontal(d),

        elist = this._getEdgeList(h),

        edge = elist.getEdge(path, startpoint, endpoint);
    if (edge !== null) {
        return edge.getEdgeFixed() && !edge.getEdgeCustomFixed();
    }

    assert(false, 'ARGraph.isEdgeFixed: FAILED');
    return true;
};

AutoRouterGraph.prototype.destroy = function () {
    this.deleteAll(false);

    this.horizontal.SetOwner(null);
    this.vertical.SetOwner(null);
};

AutoRouterGraph.prototype.assertValid = function () {
    var ids = Object.keys(this.boxes),
        i;

    for (i = this.boxes.length; i--;) {
        this.assertValidBox(this.boxes[ids[i]]);
    }

    for (i = this.paths.length; i--;) {
        this._assertValidPath(this.paths[i]);
    }

    this.horizontal.assertValid();
    this.vertical.assertValid();
};

AutoRouterGraph.prototype.assertValidBox = function (box) {
    box.assertValid();
    assert(box.owner === this,
        'ARGraph.assertValidBox: box.owner === this FAILED');
    assert(this.boxes[box.id] !== undefined,
        'ARGraph.assertValidBox: this.boxes[box.id] !== undefined FAILED');

    // Verify that the box (and port) edges are on the graph
    assert(this._containsRectEdges(box.rect),
        'Graph does not contain edges for box ' + box.id);

};

AutoRouterGraph.prototype._containsRectEdges = function (rect) {
    var topLeft = rect.getTopLeft(),
        bottomRight = rect.getBottomRight(),
        points = [],
        result = true,
        len,
        start,
        end;

    points.push(topLeft);
    points.push(new ArPoint(bottomRight.x, topLeft.y));  // top right
    points.push(bottomRight);
    points.push(new ArPoint(topLeft.x, bottomRight.y));  // bottom left

    len = points.length;
    for (var i = 0; i < len; i++) {
        start = points[i];
        end = points[(i + 1) % len];
        result = result && this._containsEdge(start, end);
    }

    return result;
};

/**
 * This checks for an edge with the given start/end points. This will only
 * work for fixed edges such as boxes or ports.
 *
 * @param start
 * @param end
 * @return {undefined}
 */
AutoRouterGraph.prototype._containsEdge = function (start, end) {
    var dir;

    dir = Utils.getDir(start.minus(end));
    assert(Utils.isRightAngle(dir),
        'Edge is invalid: ' + Utils.stringify(start) + ' and ' + Utils.stringify(end));

    if (Utils.isHorizontal(dir)) {
        return this.horizontal.contains(start, end) || this.horizontal.contains(end, start);
    } else {
        return this.vertical.contains(start, end) || this.vertical.contains(end, start);
    }
};

AutoRouterGraph.prototype._assertValidPath = function (path) {
    assert(path.owner === this,
        'ARGraph.assertValidBox: box.owner === this FAILED');
    path.assertValid();
};

AutoRouterGraph.prototype.dumpPaths = function (pos, c) {
    _logger.debug('Paths dump pos ' + pos + ', c ' + c);

    for (var i = 0; i < this.paths.length; i++) {
        _logger.debug(i + '. Path: ');
        this.paths[i].getPointList().dumpPoints('DumpPaths');
    }

};

AutoRouterGraph.prototype.dumpEdgeLists = function () {
    this.horizontal.dumpEdges('Horizontal edges:');
    this.vertical.dumpEdges('Vertical edges:');
};

module.exports = AutoRouterGraph;

},{"./AutoRouter.Box":5,"./AutoRouter.Constants":6,"./AutoRouter.Edge":7,"./AutoRouter.EdgeList":8,"./AutoRouter.Logger":10,"./AutoRouter.Path":11,"./AutoRouter.Point":12,"./AutoRouter.PointList":13,"./AutoRouter.Port":14,"./AutoRouter.Rect":15,"./AutoRouter.Utils":17}],10:[function(require,module,exports){
'use strict';
var debug = require('debug'),
    LEVELS = ['warn', 'debug', 'info'];

var Logger = function(name){
    for (var i = LEVELS.length; i--;) {
        this[LEVELS[i]] = debug(name + ':' + LEVELS[i]);
    }
};

module.exports = Logger;

},{"debug":1}],11:[function(require,module,exports){
/*globals define*/
/*jshint browser: true, bitwise: false*/

/**
 * @author brollb / https://github/brollb
 */

'use strict';

var CONSTANTS = require('./AutoRouter.Constants'),
    Utils = require('./AutoRouter.Utils'),
    assert = Utils.assert,
    ArPoint = require('./AutoRouter.Point'),
    ArRect = require('./AutoRouter.Rect'),
    ArPointListPath = require('./AutoRouter.PointList');

// AutoRouterPath
var AutoRouterPath = function () {
    this.id = 'None';
    this.owner = null;
    this.startpoint = null;
    this.endpoint = null;
    this.startports = null;
    this.endports = null;
    this.startport = null;
    this.endport = null;
    this.attributes = CONSTANTS.PathDefault;
    this.state = CONSTANTS.PathStateDefault;
    this.isAutoRoutingOn = true;
    this.customPathData = [];
    this.customizationType = 'Points';
    this.pathDataToDelete = [];
    this.points = new ArPointListPath();
};


//----Points

AutoRouterPath.prototype.hasOwner = function () {
    return this.owner !== null;
};

AutoRouterPath.prototype.setStartEndPorts = function (start, end) {
    this.startports = start;
    this.endports = end;
    this.calculateStartEndPorts();
};

AutoRouterPath.prototype.clearPorts = function () {
    // remove the start/endpoints from the given ports
    if (this.startpoint) {
        this.startport.removePoint(this.startpoint);
        this.startpoint = null;
    }
    if (this.endpoint) {
        this.endport.removePoint(this.endpoint);
        this.endpoint = null;
    }
    this.startport = null;
    this.endport = null;
};

AutoRouterPath.prototype.getStartPort = function () {
    assert(this.startports.length, 
        `ARPath.getStartPort: Can\'t retrieve start port from ${this.id}`);

    if (!this.startport) {
        this.calculateStartPorts();
    }
    return this.startport;
};

AutoRouterPath.prototype.getEndPort = function () {
    assert(this.endports.length, 
        'ARPort.getEndPort: Can\'t retrieve end port from '+this.id);
    if (!this.endport) {
        this.calculateEndPorts();
    }
    return this.endport;
};

/**
 * Remove port from start/end port lists.
 *
 * @param port
 * @return {undefined}
 */
AutoRouterPath.prototype.removePort = function (port) {
    var removed = Utils.removeFromArrays(port, this.startports, this.endports);
    assert(removed, 'Port was not removed from path start/end ports');

    // If no more start/end ports, remove the path
    // assert(this.startports.length && this.endports.length, 'Removed all start/endports of path ' + this.id);
    this.owner.disconnect(this);
};

AutoRouterPath.prototype.calculateStartEndPorts = function () {
    return {src: this.calculateStartPorts(), dst: this.calculateEndPorts()};
};

AutoRouterPath.prototype.calculateStartPorts = function () {
    var srcPorts = [],
        tgt,
        i;

    assert(this.startports.length > 0, 'ArPath.calculateStartEndPorts: this.startports cannot be empty!');

    //Remove this.startpoint
    if (this.startport && this.startport.hasPoint(this.startpoint)) {
        this.startport.removePoint(this.startpoint);
    }

    //Get available ports
    for (i = this.startports.length; i--;) {
        assert(this.startports[i].owner,
            'ARPath.calculateStartEndPorts: port ' + this.startports[i].id + ' has invalid this.owner!');
        if (this.startports[i].isAvailable()) {
            srcPorts.push(this.startports[i]);
        }
    }

    if (srcPorts.length === 0) {
        srcPorts = this.startports;
    }

    //Preventing same start/endport
    if (this.endport && srcPorts.length > 1) {
        i = srcPorts.length;
        while (i--) {
            if (srcPorts[i] === this.endport) {
                srcPorts.splice(i, 1);
            }
        }
    }


    // Getting target
    if (this.isAutoRouted()) {
        var accumulatePortCenters = function (prev, current) {
            var center = current.rect.getCenter();
            prev.x += center.x;
            prev.y += center.y;
            return prev;
        };
        tgt = this.endports.reduce(accumulatePortCenters, new ArPoint(0, 0));

        tgt.x /= this.endports.length;
        tgt.y /= this.endports.length;
    } else {
        tgt = this.customPathData[0];
    }
    // Get the optimal port to the target
    this.startport = Utils.getOptimalPorts(srcPorts, tgt);

    // Create a this.startpoint at the port
    var startdir = this.getStartDir(),
        startportHasLimited = false,
        startportCanHave = true;

    if (startdir !== CONSTANTS.DirNone) {
        startportHasLimited = this.startport.hasLimitedDirs();
        startportCanHave = this.startport.canHaveStartEndPointOn(startdir, true);
    }
    if (startdir === CONSTANTS.DirNone ||							// recalc startdir if empty
        startportHasLimited && !startportCanHave) {		// or is limited and userpref is invalid
        startdir = this.startport.getStartEndDirTo(tgt, true);
    }

    this.startpoint = this.startport.createStartEndPointTo(tgt, startdir);
    this.startpoint.owner = this;
    return this.startport;
};

AutoRouterPath.prototype.calculateEndPorts = function () {
    var dstPorts = [],
        tgt,
        i = this.endports.length;

    assert(this.endports.length > 0, 'ArPath.calculateStartEndPorts: this.endports cannot be empty!');

    //Remove old this.endpoint
    if (this.endport && this.endport.hasPoint(this.endpoint)) {
        this.endport.removePoint(this.endpoint);
    }

    //Get available ports
    while (i--) {
        assert(this.endports[i].owner, 'ARPath.calculateStartEndPorts: this.endport has invalid this.owner!');
        if (this.endports[i].isAvailable()) {
            dstPorts.push(this.endports[i]);
        }
    }

    if (dstPorts.length === 0) {
        dstPorts = this.endports;
    }

    //Preventing same start/this.endport
    if (this.startport && dstPorts.length > 1) {
        i = dstPorts.length;
        while (i--) {
            if (dstPorts[i] === this.startport) {
                dstPorts.splice(i, 1);
            }
        }
    }

    //Getting target
    if (this.isAutoRouted()) {

        var accumulatePortCenters = function (prev, current) {
            var center = current.rect.getCenter();
            prev.x += center.x;
            prev.y += center.y;
            return prev;
        };
        tgt = this.startports.reduce(accumulatePortCenters, new ArPoint(0, 0));

        tgt.x /= this.startports.length;
        tgt.y /= this.startports.length;

    } else {
        tgt = this.customPathData[this.customPathData.length - 1];
    }

    //Get the optimal port to the target
    this.endport = Utils.getOptimalPorts(dstPorts, tgt);

    //Create this.endpoint at the port
    var enddir = this.getEndDir(),
        startdir = this.getStartDir(),
        endportHasLimited = false,
        endportCanHave = true;

    if (enddir !== CONSTANTS.DirNone) {
        endportHasLimited = this.endport.hasLimitedDirs();
        endportCanHave = this.endport.canHaveStartEndPointOn(enddir, false);
    }
    if (enddir === CONSTANTS.DirNone ||                         // like above
        endportHasLimited && !endportCanHave) {
        enddir = this.endport.getStartEndDirTo(tgt, false, this.startport === this.endport ?
            startdir : CONSTANTS.DirNone);
    }

    this.endpoint = this.endport.createStartEndPointTo(tgt, enddir);
    this.endpoint.owner = this;
    return this.endport;
};

AutoRouterPath.prototype.isConnected = function () {
    return (this.state & CONSTANTS.PathStateConnected) !== 0;
};

AutoRouterPath.prototype.addTail = function (pt) {
    assert(!this.isConnected(),
        'ARPath.addTail: !this.isConnected() FAILED');
    this.points.push(pt);
};

AutoRouterPath.prototype.deleteAll = function () {
    this.points = new ArPointListPath();
    this.state = CONSTANTS.PathStateDefault;
    this.clearPorts();
};

AutoRouterPath.prototype.getStartBox = function () {
    var port = this.startport || this.startports[0];
    return port.owner.getRootBox();
};

AutoRouterPath.prototype.getEndBox = function () {
    var port = this.endport || this.endports[0];
    return port.owner.getRootBox();
};

AutoRouterPath.prototype.getOutOfBoxStartPoint = function (hintDir) {
    var startBoxRect = this.getStartBox();

    assert(hintDir !== CONSTANTS.DirSkew, 'ARPath.getOutOfBoxStartPoint: hintDir !== CONSTANTS.DirSkew FAILED');
    assert(this.points.length >= 2, 'ARPath.getOutOfBoxStartPoint: this.points.length >= 2 FAILED');

    var pos = 0,
        p = new ArPoint(this.points[pos++]),
        d = Utils.getDir(this.points[pos].minus(p));

    if (d === CONSTANTS.DirSkew) {
        d = hintDir;
    }
    assert(Utils.isRightAngle(d), 'ARPath.getOutOfBoxStartPoint: Utils.isRightAngle (d) FAILED');

    if (Utils.isHorizontal(d)) {
        p.x = Utils.getRectOuterCoord(startBoxRect, d);
    } else {
        p.y = Utils.getRectOuterCoord(startBoxRect, d);
    }

    //assert(Utils.getDir (this.points[pos].minus(p)) === Utils.reverseDir ( d ) ||
    // Utils.getDir (this.points[pos].minus(p)) === d, 'Utils.getDir (this.points[pos].minus(p)) ===
    // Utils.reverseDir ( d ) || Utils.getDir (this.points[pos].minus(p)) === d FAILED');

    return p;
};

AutoRouterPath.prototype.getOutOfBoxEndPoint = function (hintDir) {
    var endBoxRect = this.getEndBox();

    assert(hintDir !== CONSTANTS.DirSkew, 'ARPath.getOutOfBoxEndPoint: hintDir !== CONSTANTS.DirSkew FAILED');
    assert(this.points.length >= 2, 'ARPath.getOutOfBoxEndPoint: this.points.length >= 2 FAILED');

    var pos = this.points.length - 1,
        p = new ArPoint(this.points[pos--]),
        d = Utils.getDir(this.points[pos].minus(p));

    if (d === CONSTANTS.DirSkew) {
        d = hintDir;
    }
    assert(Utils.isRightAngle(d), 'ARPath.getOutOfBoxEndPoint: Utils.isRightAngle (d) FAILED');

    if (Utils.isHorizontal(d)) {
        p.x = Utils.getRectOuterCoord(endBoxRect, d);
    } else {
        p.y = Utils.getRectOuterCoord(endBoxRect, d);
    }

    //assert(Utils.getDir (this.points[pos].minus(p)) === Utils.reverseDir ( d ) ||
    // Utils.getDir (this.points[pos].minus(p)) === d, 'ARPath.getOutOfBoxEndPoint: Utils.getDir
    // (this.points[pos].minus(p)) === d || Utils.getDir (this.points[pos].minus(p)) === d FAILED');

    return p;
};

AutoRouterPath.prototype.simplifyTrivially = function () {
    assert(!this.isConnected(), 'ARPath.simplifyTrivially: !isConnected() FAILED');

    if (this.points.length <= 2) {
        return;
    }

    var pos = 0,
        pos1 = pos;

    assert(pos1 !== this.points.length, 'ARPath.simplifyTrivially: pos1 !== this.points.length FAILED');
    var p1 = this.points[pos++],
        pos2 = pos;

    assert(pos2 !== this.points.length, 'ARPath.simplifyTrivially: pos2 !== this.points.length FAILED');
    var p2 = this.points[pos++],
        dir12 = Utils.getDir(p2.minus(p1)),
        pos3 = pos;

    assert(pos3 !== this.points.length, 'ARPath.simplifyTrivially: pos3 !== this.points.length FAILED');
    var p3 = this.points[pos++],
        dir23 = Utils.getDir(p3.minus(p2));

    for (; ;) {
        if (dir12 === CONSTANTS.DirNone || dir23 === CONSTANTS.DirNone ||
            (dir12 !== CONSTANTS.DirSkew && dir23 !== CONSTANTS.DirSkew &&
            (dir12 === dir23 || dir12 === Utils.reverseDir(dir23)) )) {
            this.points.splice(pos2, 1);
            pos--;
            pos3--;
            dir12 = Utils.getDir(p3.minus(p1));
        } else {
            pos1 = pos2;
            p1 = p2;
            dir12 = dir23;
        }

        if (pos === this.points.length) {
            return;
        }

        pos2 = pos3;
        p2 = p3;

        pos3 = pos;
        p3 = this.points[pos++];

        dir23 = Utils.getDir(p3.minus(p2));
    }

    if (CONSTANTS.DEBUG) {
        this.assertValidPoints();
    }
};

AutoRouterPath.prototype.getPointList = function () {
    return this.points;
};

AutoRouterPath.prototype.isPathClip = function (r, isStartOrEndRect) {
    var tmp = this.points.getTailEdge(),
        a = tmp.start,
        b = tmp.end,
        pos = tmp.pos,
        i = 0,
        numEdges = this.points.length - 1;

    while (pos >= 0) {
        if (isStartOrEndRect && ( i === 0 || i === numEdges - 1 )) {
            if (Utils.isPointIn(a, r, 1) &&
                Utils.isPointIn(b, r, 1)) {
                return true;
            }
        } else if (Utils.isLineClipRect(a, b, r)) {
            return true;
        }

        tmp = this.points.getPrevEdge(pos, a, b);
        a = tmp.start;
        b = tmp.end;
        pos = tmp.pos;
        i++;
    }

    return false;
};

AutoRouterPath.prototype.isFixed = function () {
    return ((this.attributes & CONSTANTS.PathFixed) !== 0);
};

AutoRouterPath.prototype.isMoveable = function () {
    return ((this.attributes & CONSTANTS.PathFixed) === 0);
};

AutoRouterPath.prototype.setState = function (s) {
    assert(this.owner !== null, 'ARPath.setState: this.owner !== null FAILED');

    this.state = s;
    if (CONSTANTS.DEBUG) {
        this.assertValid();
    }
};

AutoRouterPath.prototype.getEndDir = function () {
    var a = this.attributes & CONSTANTS.PathEndMask;
    return a & CONSTANTS.PathEndOnTop ? CONSTANTS.DirTop :
        a & CONSTANTS.PathEndOnRight ? CONSTANTS.DirRight :
            a & CONSTANTS.PathEndOnBottom ? CONSTANTS.DirBottom :
                a & CONSTANTS.PathEndOnLeft ? CONSTANTS.DirLeft : CONSTANTS.DirNone;
};

AutoRouterPath.prototype.getStartDir = function () {
    var a = this.attributes & CONSTANTS.PathStartMask;
    return a & CONSTANTS.PathStartOnTop ? CONSTANTS.DirTop :
        a & CONSTANTS.PathStartOnRight ? CONSTANTS.DirRight :
            a & CONSTANTS.PathStartOnBottom ? CONSTANTS.DirBottom :
                a & CONSTANTS.PathStartOnLeft ? CONSTANTS.DirLeft : CONSTANTS.DirNone;
};

AutoRouterPath.prototype.setEndDir = function (pathEnd) {
    this.attributes = (this.attributes & ~CONSTANTS.PathEndMask) + pathEnd;
};

AutoRouterPath.prototype.setStartDir = function (pathStart) {
    this.attributes = (this.attributes & ~CONSTANTS.PathStartMask) + pathStart;
};

/**
 * Set the custom points of the path and determine start/end points/ports.
 *
 * @param {Array<ArPoint>} points
 * @return {undefined}
 */
AutoRouterPath.prototype.setCustomPathPoints = function (points) {
    this.customPathData = points;

    // Find the start/endports
    this.calculateStartEndPorts();

    this.points = new ArPointListPath().concat(points);

    // Add the start/end points to the list
    this.points.unshift(this.startpoint);
    this.points.push(this.endpoint);

    // Set as connected
    this.setState(CONSTANTS.PathStateConnected);
};

AutoRouterPath.prototype.createCustomPath = function () {
    this.points.shift();
    this.points.pop();

    this.points.unshift(this.startpoint);
    this.points.push(this.endpoint);

    this.setState(CONSTANTS.PathStateConnected);
};

AutoRouterPath.prototype.removePathCustomizations = function () {
    this.customPathData = [];
};

AutoRouterPath.prototype.areTherePathCustomizations = function () {
    return this.customPathData.length !== 0;
};

AutoRouterPath.prototype.isAutoRouted = function () {
    return this.isAutoRoutingOn;
};

AutoRouterPath.prototype.setAutoRouting = function (arState) {
    this.isAutoRoutingOn = arState;
};

AutoRouterPath.prototype.destroy = function () {
    if (this.startpoint) {
        this.startport.removePoint(this.startpoint);
    }
    if (this.endpoint) {
        this.endport.removePoint(this.endpoint);
    }
};

AutoRouterPath.prototype.assertValid = function () {
    var i;

    assert(this.startports.length > 0, 'Path has no startports!');
    assert(this.endports.length > 0, 'Path has no endports!');

    for (i = this.startports.length; i--;) {
        this.startports[i].assertValid();
    }

    for (i = this.endports.length; i--;) {
        this.endports[i].assertValid();
    }

    if (this.isAutoRouted()) {
        if (this.isConnected()) {
            assert(this.points.length !== 0,
                'ARPath.assertValid: this.points.length !== 0 FAILED');
            var points = this.getPointList();
            points.assertValid();
        }
    }

    // If it has a startpoint, must also have a startport
    if (this.startpoint) {
        assert(this.startport, 'Path has a startpoint without a startport');
    }
    if (this.endpoint) {
        assert(this.endport, 'Path has a endpoint without a endport');
    }

    assert(this.owner, 'Path does not have owner!');
};

AutoRouterPath.prototype.assertValidPoints = function () {
};

module.exports = AutoRouterPath;

},{"./AutoRouter.Constants":6,"./AutoRouter.Point":12,"./AutoRouter.PointList":13,"./AutoRouter.Rect":15,"./AutoRouter.Utils":17}],12:[function(require,module,exports){
/*globals define*/
/*jshint browser: true, bitwise: false*/

/**
 * @author brollb / https://github/brollb
 */

'use strict';

var ArSize = require('./AutoRouter.Size');

var ArPoint = function (x, y) {
    // Multiple Constructors
    if (x === undefined) {
        x = 0;
        y = 0;
    } else if (y === undefined) {
        y = x.y;
        x = x.x;
    }

    this.x = x;
    this.y = y;
};

/**
 * Check if the points have the same coordinates.
 *
 * @param {ArPoint} otherPoint
 * @return {Boolean}
 */
ArPoint.prototype.equals = function (otherPoint) {
    return this.x === otherPoint.x && this.y === otherPoint.y;
};

ArPoint.prototype.shift = function (otherObject) { //equivalent to +=
    this.x += otherObject.dx;
    this.y += otherObject.dy;

    return this;
};

ArPoint.prototype.add = function (otherObject) { //equivalent to +=
    if (otherObject instanceof ArSize) {
        this.x += otherObject.cx;
        this.y += otherObject.cy;
    } else if (otherObject instanceof ArPoint) {
        this.x += otherObject.x;
        this.y += otherObject.y;
    }
};

ArPoint.prototype.subtract = function (otherObject) { //equivalent to +=
    if (otherObject instanceof ArSize) {
        this.x -= otherObject.cx;
        this.y -= otherObject.cy;
    } else if (otherObject instanceof ArPoint) {
        this.x -= otherObject.x;
        this.y -= otherObject.y;
    }
};

ArPoint.prototype.plus = function (otherObject) { //equivalent to +
    var objectCopy = null;

    if (otherObject instanceof ArSize) {
        objectCopy = new ArPoint(this);
        objectCopy.add(otherObject);

    } else if (otherObject instanceof ArPoint) {
        objectCopy = new ArPoint(otherObject);
        objectCopy.x += this.x;
        objectCopy.y += this.y;
    }
    return objectCopy || undefined;
};

ArPoint.prototype.minus = function (otherObject) {
    var objectCopy = new ArPoint(otherObject);

    if (otherObject.cx !== undefined && otherObject.cy !== undefined) {
        objectCopy.subtract(this);

    } else if (otherObject.x !== undefined && otherObject.y !== undefined) {
        objectCopy = new ArSize();
        objectCopy.cx = this.x - otherObject.x;
        objectCopy.cy = this.y - otherObject.y;

    }
    return objectCopy;
};

ArPoint.prototype.assign = function (otherPoint) {
    this.x = otherPoint.x;
    this.y = otherPoint.y;

    return this;
};

ArPoint.prototype.toString = function () {
    return '(' + this.x + ', ' + this.y + ')';
};

module.exports = ArPoint;

},{"./AutoRouter.Size":16}],13:[function(require,module,exports){
/*jshint node: true, bitwise: false*/

/**
 * @author brollb / https://github/brollb
 */

'use strict';

var Logger = require('./AutoRouter.Logger'),  // FIXME
    CONSTANTS = require('./AutoRouter.Constants'),
    Utils = require('./AutoRouter.Utils'),
    assert = Utils.assert,
    _logger = new Logger('AutoRouter.PointList');

var ArPointListPath = function () {
    for (var i = arguments.length; i--;) {
        this.unshift(arguments[i]);
    }
};

ArPointListPath.prototype = [];

// Wrapper Functions
ArPointListPath.prototype.concat = function (list) {
    var newPoints = new ArPointListPath(),
        i;

    for (i = 0; i < this.length; i++) {
        newPoints.push(this[i]);
    }

    for (i = 0; i < list.length; i++) {
        newPoints.push(list[i]);
    }
    return newPoints;
};

// Functions

ArPointListPath.prototype.end = function () {
    return this[this.length - 1];
};

ArPointListPath.prototype.getTailEdge = function () {
    if (this.length < 2) {
        return this.length;
    }

    var pos = this.length - 1,
        end = this[pos--],
        start = this[pos];

    return {'pos': pos, 'start': start, 'end': end};
};

ArPointListPath.prototype.getPrevEdge = function (pos, start, end) {
    if (CONSTANTS.DEBUG) {
        this.AssertValidPos(pos);
    }

    end = this[pos--];
    if (pos !== this.length) {
        start = this[pos];
    }

    return {'pos': pos, 'start': start, 'end': end};
};

ArPointListPath.prototype.getEdge = function (pos, start, end) {
    if (CONSTANTS.DEBUG) {
        this.AssertValidPos(pos);
    }

    start = this[pos++];
    assert(pos < this.length, 'ArPointListPath.getEdge: pos < this.length FAILED');

    end = this[pos];
};

ArPointListPath.prototype.getTailEdgePtrs = function () {
    var pos = this.length,
        start,
        end;

    if (this.length < 2) {
        return {'pos': pos};
    }

    assert(--pos < this.length, 'ArPointListPath.getTailEdgePtrs: --pos < this.length FAILED');

    end = this[pos--];
    assert(pos < this.length, 'ArPointListPath.getTailEdgePtrs: pos < this.length FAILED');

    start = this[pos];

    return {'pos': pos, 'start': start, 'end': end};
};

ArPointListPath.prototype.getPrevEdgePtrs = function (pos) {
    var start,
        end;

    if (CONSTANTS.DEBUG) {
        this.AssertValidPos(pos);
    }

    end = this[pos];

    if (pos-- > 0) {
        start = this[pos];
    }

    return {pos: pos, start: start, end: end};
};

ArPointListPath.prototype.getStartPoint = function (pos) {
    if (CONSTANTS.DEBUG) {
        this.AssertValidPos(pos);
    }

    return this[pos];
};

ArPointListPath.prototype.getEndPoint = function (pos) {
    if (CONSTANTS.DEBUG) {
        this.AssertValidPos(pos);
    }

    pos++;
    assert(pos < this.length,
        'ArPointListPath.getEndPoint: pos < this.length FAILED');

    return this[pos];
};

ArPointListPath.prototype.getPointBeforeEdge = function (pos) {
    if (CONSTANTS.DEBUG) {
        this.AssertValidPos(pos);
    }

    pos--;
    if (pos === this.length) {
        return null;
    }

    return this[pos];
};

ArPointListPath.prototype.getPointAfterEdge = function (pos) {
    if (CONSTANTS.DEBUG) {
        this.AssertValidPos(pos);
    }

    pos++;
    assert(pos < this.length,
        'ArPointListPath.getPointAfterEdge: pos < this.length FAILED');

    pos++;
    if (pos === this.length) {
        return null;
    }

    return this[pos];
};

ArPointListPath.prototype.assertValid = function (msg) {
    // Check to make sure each point makes a horizontal/vertical line with it's neighbors
    msg = msg || '';
    for (var i = this.length - 1; i > 0; i--) {
        assert(!!this[i].minus, 'Bad value at position ' + i + ' (' + Utils.stringify(this[i]) + ')');
        assert(!!this[i - 1].minus, 'Bad value at position ' + (i - 1) + ' (' + Utils.stringify(this[i - 1]) + ')');

        assert(Utils.isRightAngle(Utils.getDir(this[i - 1].minus(this[i]))),
            msg + '\n\tArPointListPath contains skew edge:\n' + Utils.stringify(this));
    }
};

ArPointListPath.prototype.assertValidPos = function (pos) {
    assert(pos < this.length, 'ArPointListPath.assertValidPos: pos < this.length FAILED');
};

ArPointListPath.prototype.dumpPoints = function (msg) {
    msg += ', points dump begin:\n';
    var pos = 0,
        i = 0,
        p;
    while (pos < this.length) {
        p = this[pos++];
        msg += i + '.: (' + p.x + ', ' + p.y + ')\n';
        i++;
    }
    msg += 'points dump end.';
    _logger.debug(msg);
    return msg;
};

module.exports = ArPointListPath;


},{"./AutoRouter.Constants":6,"./AutoRouter.Logger":10,"./AutoRouter.Utils":17}],14:[function(require,module,exports){
/*jshint node: true, bitwise: false*/

/**
 * @author brollb / https://github/brollb
 */

'use strict';

var CONSTANTS = require('./AutoRouter.Constants'),
    Utils = require('./AutoRouter.Utils'),
    assert = Utils.assert,
    ArPoint = require('./AutoRouter.Point'),
    ArSize = require('./AutoRouter.Size'),
    ArRect = require('./AutoRouter.Rect');

var AutoRouterPort = function () {
    this.id = null;
    this.owner = null;
    this.limitedDirections = true;
    this.rect = new ArRect();
    this.attributes = CONSTANTS.PortDefault;

    // For this.points on CONSTANTS.DirTop, CONSTANTS.DirLeft, CONSTANTS.DirRight, etc
    this.points = [[], [], [], []];
    this.selfPoints = [];
    this.availableArea = [];  // availableAreas keeps track of visible (not overlapped) portions of the port

    this.calculateSelfPoints();
};

AutoRouterPort.prototype.calculateSelfPoints = function () {
    this.selfPoints = [];
    this.selfPoints.push(new ArPoint(this.rect.getTopLeft()));

    this.selfPoints.push(new ArPoint(this.rect.right, this.rect.ceil));
    this.selfPoints.push(new ArPoint(this.rect.right, this.rect.floor));
    this.selfPoints.push(new ArPoint(this.rect.left, this.rect.floor));
    this.resetAvailableArea();
};

AutoRouterPort.prototype.hasOwner = function () {
    return this.owner !== null;
};

AutoRouterPort.prototype.isRectEmpty = function () {
    return this.rect.isRectEmpty();
};

AutoRouterPort.prototype.getCenter = function () {
    return this.rect.getCenterPoint();
};

AutoRouterPort.prototype.setRect = function (r) {
    assert(r.getWidth() >= 3 && r.getHeight() >= 3,
        'ARPort.setRect: r.getWidth() >= 3 && r.getHeight() >= 3 FAILED!');

    this.rect.assign(r);
    this.calculateSelfPoints();
    this.resetAvailableArea();
};

AutoRouterPort.prototype.shiftBy = function (offset) {
    assert(!this.rect.isRectEmpty(), 'ARPort.shiftBy: !this.rect.isRectEmpty() FAILED!');

    this.rect.add(offset);

    this.calculateSelfPoints();
    // Shift points
    this.shiftPoints(offset);
};

AutoRouterPort.prototype.isConnectToCenter = function () {
    return (this.attributes & CONSTANTS.PortConnectToCenter) !== 0;
};

AutoRouterPort.prototype.hasLimitedDirs = function () {
    return this.limitedDirections;
};

AutoRouterPort.prototype.setLimitedDirs = function (ltd) {
    this.limitedDirections = ltd;
};

AutoRouterPort.prototype.portOnWhichEdge = function (point) {
    return Utils.onWhichEdge(this.rect, point);
};

AutoRouterPort.prototype.canHaveStartEndPointOn = function (dir, isStart) {
    assert(0 <= dir && dir <= 3, 'ARPort.canHaveStartEndPointOn: 0 <= dir && dir <= 3 FAILED!');

    if (isStart) {
        dir += 4;
    }

    return ((this.attributes & (1 << dir)) !== 0);
};

AutoRouterPort.prototype.canHaveStartEndPoint = function (isStart) {
    return ((this.attributes & (isStart ? CONSTANTS.PortStartOnAll : CONSTANTS.PortEndOnAll)) !== 0);
};

AutoRouterPort.prototype.canHaveStartEndPointHorizontal = function (isHorizontal) {
    return ((this.attributes &
    (isHorizontal ? CONSTANTS.PortStartEndHorizontal : CONSTANTS.PortStartEndVertical)) !== 0);
};

AutoRouterPort.prototype.getStartEndDirTo = function (point, isStart, notthis) {
    assert(!this.rect.isRectEmpty(), 'ARPort.getStartEndDirTo: !this.rect.isRectEmpty() FAILED!');

    notthis = notthis ? notthis : CONSTANTS.DirNone; // if notthis is undefined, set it to CONSTANTS.DirNone (-1)

    var offset = point.minus(this.rect.getCenterPoint()),
        dir1 = Utils.getMajorDir(offset);

    if (dir1 !== notthis && this.canHaveStartEndPointOn(dir1, isStart)) {
        return dir1;
    }

    var dir2 = Utils.getMinorDir(offset);

    if (dir2 !== notthis && this.canHaveStartEndPointOn(dir2, isStart)) {
        return dir2;
    }

    var dir3 = Utils.reverseDir(dir2);

    if (dir3 !== notthis && this.canHaveStartEndPointOn(dir3, isStart)) {
        return dir3;
    }

    var dir4 = Utils.reverseDir(dir1);

    if (dir4 !== notthis && this.canHaveStartEndPointOn(dir4, isStart)) {
        return dir4;
    }

    if (this.canHaveStartEndPointOn(dir1, isStart)) {
        return dir1;
    }

    if (this.canHaveStartEndPointOn(dir2, isStart)) {
        return dir2;
    }

    if (this.canHaveStartEndPointOn(dir3, isStart)) {
        return dir3;
    }

    if (this.canHaveStartEndPointOn(dir4, isStart)) {
        return dir4;
    }

    return CONSTANTS.DirTop;
};

AutoRouterPort.prototype.roundToHalfGrid = function (left, right) {
    var btwn = (left + right) / 2;
    assert(btwn < Math.max(left, right) && btwn > Math.min(left, right),
        'roundToHalfGrid: btwn variable not between left, right values. Perhaps box/connectionArea is too small?');
    return btwn;
};

AutoRouterPort.prototype.createStartEndPointTo = function (point, dir) {
    // calculate pathAngle
    var dx = point.x - this.getCenter().x,
        dy = point.y - this.getCenter().y,
        pathAngle = Math.atan2(-dy, dx),
        k = 0,
        maxX = this.rect.right,
        maxY = this.rect.floor,
        minX = this.rect.left,
        minY = this.rect.ceil,
        resultPoint,
        smallerPt = new ArPoint(minX, minY),  // The this.points that the resultPoint is centered between
        largerPt = new ArPoint(maxX, maxY);

    // Find the smaller and larger points
    // As the points cannot be on the corner of an edge (ambiguous direction), 
    // we will shift the min, max in one pixel
    if (Utils.isHorizontal(dir)) {  // shift x coordinates
        minX++;
        maxX--;
    } else { // shift y coordinates
        minY++;
        maxY--;
    }

    // Adjust angle based on part of port to which it is connecting
    switch (dir) {

        case CONSTANTS.DirTop:
            pathAngle = 2 * Math.PI - (pathAngle + Math.PI / 2);
            largerPt.y = this.rect.ceil;
            break;

        case CONSTANTS.DirRight:
            pathAngle = 2 * Math.PI - pathAngle;
            smallerPt.x = this.rect.right;
            break;

        case CONSTANTS.DirBottom:
            pathAngle -= Math.PI / 2;
            smallerPt.y = this.rect.floor;
            break;

        case CONSTANTS.DirLeft:
            largerPt.x = this.rect.left;
            break;
    }

    if (pathAngle < 0) {
        pathAngle += 2 * Math.PI;
    }

    pathAngle *= 180 / Math.PI;  // Using degrees for easier debugging

    // Finding this.points ordering
    while (k < this.points[dir].length && pathAngle > this.points[dir][k].pathAngle) {
        k++;
    }

    if (this.points[dir].length) {
        if (k === 0) {
            largerPt = new ArPoint(this.points[dir][k]);

        } else if (k !== this.points[dir].length) {
            smallerPt = new ArPoint(this.points[dir][k - 1]);
            largerPt = new ArPoint(this.points[dir][k]);

        } else {
            smallerPt = new ArPoint(this.points[dir][k - 1]);

        }
    }

    resultPoint = new ArPoint((largerPt.x + smallerPt.x) / 2, (largerPt.y + smallerPt.y) / 2);
    resultPoint.pathAngle = pathAngle;

    // Move the point over to an 'this.availableArea' if appropriate
    var i = this.availableArea.length,
        closestArea = 0,
        distance = Infinity,
        start,
        end;

    // Find distance from each this.availableArea and store closest index
    while (i--) {
        start = this.availableArea[i][0];
        end = this.availableArea[i][1];

        if (Utils.isOnEdge(start, end, resultPoint)) {
            closestArea = -1;
            break;
        } else if (Utils.distanceFromLine(resultPoint, start, end) < distance) {
            closestArea = i;
            distance = Utils.distanceFromLine(resultPoint, start, end);
        }
    }

    if (closestArea !== -1 && this.isAvailable()) { // resultPoint needs to be moved to the closest available area
        var dir2 = Utils.getDir(this.availableArea[closestArea][0].minus(resultPoint));

        assert(Utils.isRightAngle(dir2),
            'AutoRouterPort.createStartEndPointTo: Utils.isRightAngle(dir2) FAILED');

        if (dir2 === CONSTANTS.DirLeft || dir2 === CONSTANTS.DirTop) { // Then resultPoint must be moved up
            largerPt = this.availableArea[closestArea][1];
        } else { // Then resultPoint must be moved down
            smallerPt = this.availableArea[closestArea][0];
        }

        resultPoint = new ArPoint((largerPt.x + smallerPt.x) / 2, (largerPt.y + smallerPt.y) / 2);
    }

    this.points[dir].splice(k, 0, resultPoint);

    assert(Utils.isRightAngle(this.portOnWhichEdge(resultPoint)),
        'AutoRouterPort.createStartEndPointTo: Utils.isRightAngle(this.portOnWhichEdge(resultPoint)) FAILED');

    return resultPoint;
};

AutoRouterPort.prototype.removePoint = function (pt) {
    var removed;

    removed = Utils.removeFromArrays.apply(null, [pt].concat(this.points));
};

AutoRouterPort.prototype.hasPoint = function (pt) {
    var i = 0,
        k;

    while (i < 4) { //Check all sides for the point
        k = this.points[i].indexOf(pt);

        if (k > -1) { //If the point is on this side of the port
            return true;
        }
        i++;
    }

    return false;
};

AutoRouterPort.prototype.shiftPoints = function (shift) {
    for (var s = this.points.length; s--;) {
        for (var i = this.points[s].length; i--;) {
            // Shift this point
            this.points[s][i].add(shift);
        }
    }
};

AutoRouterPort.prototype.getPointCount = function () {
    var i = 0,
        count = 0;

    while (i < 4) { // Check all sides for the point
        count += this.points[i++].length;
    }

    return count;
};

AutoRouterPort.prototype.resetAvailableArea = function () {
    this.availableArea = [];

    if (this.canHaveStartEndPointOn(CONSTANTS.DirTop)) {
        this.availableArea.push([this.rect.getTopLeft(), new ArPoint(this.rect.right, this.rect.ceil)]);
    }

    if (this.canHaveStartEndPointOn(CONSTANTS.DirRight)) {
        this.availableArea.push([new ArPoint(this.rect.right, this.rect.ceil), this.rect.getBottomRight()]);
    }

    if (this.canHaveStartEndPointOn(CONSTANTS.DirBottom)) {
        this.availableArea.push([new ArPoint(this.rect.left, this.rect.floor), this.rect.getBottomRight()]);
    }

    if (this.canHaveStartEndPointOn(CONSTANTS.DirLeft)) {
        this.availableArea.push([this.rect.getTopLeft(), new ArPoint(this.rect.left, this.rect.floor)]);
    }

};

AutoRouterPort.prototype.adjustAvailableArea = function (r) {
    //For all lines specified in availableAreas, check if the line Utils.intersect s the rectangle
    //If it does, remove the part of the line that Utils.intersect s the rectangle
    if (!this.rect.touching(r)) {
        return;
    }

    var i = this.availableArea.length,
        intersection,
        line;

    while (i--) {

        if (Utils.isLineClipRect(this.availableArea[i][0], this.availableArea[i][1], r)) {
            line = this.availableArea.splice(i, 1)[0];
            intersection = Utils.getLineClipRectIntersect(line[0], line[1], r);

            if (!intersection[0].equals(line[0])) {
                this.availableArea.push([line[0], intersection[0]]);
            }

            if (!intersection[1].equals(line[1])) {
                this.availableArea.push([intersection[1], line[1]]);
            }
        }
    }
};

AutoRouterPort.prototype.getTotalAvailableArea = function () {
    var i = this.availableArea.length,
        length = new ArSize();

    while (i--) {
        length.add(this.availableArea[i][1].minus(this.availableArea[i][0]));
    }

    assert(length.cx === 0 || length.cy === 0,
        'ARPort.getTotalAvailableArea: length[0] === 0 || length[1] === 0 FAILED');
    return length.cx || length.cy;
};

AutoRouterPort.prototype.isAvailable = function () {
    return this.availableArea.length > 0;
};

AutoRouterPort.prototype.assertValid = function () {
    // Check that all points are on a side of the port
    var point;

    assert(this.owner, 'Port ' + this.id + ' does not have valid owner!');
    for (var s = this.points.length; s--;) {
        for (var i = this.points[s].length; i--;) {
            point = this.points[s][i];
            assert(Utils.isRightAngle(this.portOnWhichEdge(point)),
                'AutoRouterPort.createStartEndPointTo: Utils.isRightAngle(this.portOnWhichEdge(resultPoint))' +
                ' FAILED');
        }
    }
};

AutoRouterPort.prototype.destroy = function () {
    // Remove all points and self from all paths
    var point,
        path;

    this.owner = null;
    for (var i = this.points.length; i--;) {
        for (var j = this.points[i].length; j--;) {
            point = this.points[i][j];
            path = point.owner;
            assert(path, 'start/end point does not have an owner!');
            path.removePort(this);
        }
    }

    this.points = [[], [], [], []];

};

module.exports = AutoRouterPort;

},{"./AutoRouter.Constants":6,"./AutoRouter.Point":12,"./AutoRouter.Rect":15,"./AutoRouter.Size":16,"./AutoRouter.Utils":17}],15:[function(require,module,exports){
/*jshint node: true*/

/**
 * @author brollb / https://github/brollb
 */

'use strict';

var debug = require('debug'),
    ArPoint = require('./AutoRouter.Point'),
    ArSize = require('./AutoRouter.Size'),
    Logger = require('./AutoRouter.Logger'),
    _logger = new Logger('AutoRouter.Rect');

var ArRect = function (Left, Ceil, Right, Floor) {
    if (Left === undefined) { //No arguments
        Left = 0;
        Ceil = 0;
        Right = 0;
        Floor = 0;

    } else if (Ceil === undefined && Left instanceof ArRect) { // One argument
        // Left is an ArRect
        Ceil = Left.ceil;
        Right = Left.right;
        Floor = Left.floor;
        Left = Left.left;

    } else if (Right === undefined && Left instanceof ArPoint) { // Two arguments
        // Creating ArRect with ArPoint and either another ArPoint or ArSize
        if (Ceil instanceof ArSize) {
            Right = Left.x + Ceil.cx;
            Floor = Left.y + Ceil.cy;
            Ceil = Left.y;
            Left = Left.x;

        } else if (Left instanceof ArPoint && Ceil instanceof ArPoint) {
            Right = Math.round(Ceil.x);
            Floor = Math.round(Ceil.y);
            Ceil = Math.round(Left.y);
            Left = Math.round(Left.x);
        } else {
            throw new Error('Invalid ArRect Constructor');
        }

    } else if (Floor === undefined) { // Invalid
        throw new Error('Invalid ArRect Constructor');
    }

    this.left = Math.round(Left);
    this.ceil = Math.round(Ceil);
    this.floor = Math.round(Floor);
    this.right = Math.round(Right);
};

ArRect.prototype.getCenter = function () {
    return {'x': (this.left + this.right) / 2, 'y': (this.ceil + this.floor) / 2};
};

ArRect.prototype.getWidth = function () {
    return (this.right - this.left);
};

ArRect.prototype.getHeight = function () {
    return (this.floor - this.ceil);
};

ArRect.prototype.getSize = function () {
    return new ArSize(this.getWidth(), this.getHeight());
};

ArRect.prototype.getTopLeft = function () {
    return new ArPoint(this.left, this.ceil);
};

ArRect.prototype.getBottomRight = function () {
    return new ArPoint(this.right, this.floor);
};

ArRect.prototype.getCenterPoint = function () {
    return new ArPoint(this.left + this.getWidth() / 2, this.ceil + this.getHeight() / 2);
};

ArRect.prototype.isRectEmpty = function () {
    if ((this.left >= this.right) && (this.ceil >= this.floor)) {
        return true;
    }

    return false;
};


ArRect.prototype.isRectNull = function () {
    if (this.left === 0 &&
        this.right === 0 &&
        this.ceil === 0 &&
        this.floor === 0) {
        return true;
    }

    return false;
};

ArRect.prototype.ptInRect = function (pt) {
    if (pt instanceof Array) {
        pt = pt[0];
    }

    if (pt.x >= this.left &&
        pt.x <= this.right &&
        pt.y >= this.ceil &&
        pt.y <= this.floor) {
        return true;
    }

    return false;
};

ArRect.prototype.setRect = function (nLeft, nCeil, nRight, nFloor) {
    if (nCeil === undefined && nLeft instanceof ArRect) { //
        this.assign(nLeft);

    } else if (nRight === undefined || nFloor === undefined) { //invalid
        _logger.debug('Invalid args for [ArRect].setRect');

    } else {
        this.left = nLeft;
        this.ceil = nCeil;
        this.right = nRight;
        this.floor = nFloor;
    }

};

ArRect.prototype.setRectEmpty = function () {

    this.ceil = 0;
    this.right = 0;
    this.floor = 0;
    this.left = 0;
};

ArRect.prototype.inflateRect = function (x, y) {
    if (x !== undefined && x.cx !== undefined && x.cy !== undefined) {
        y = x.cy;
        x = x.cx;
    } else if (y === undefined) {
        y = x;
    }

    this.left -= x;
    this.right += x;
    this.ceil -= y;
    this.floor += y;
};

ArRect.prototype.deflateRect = function (x, y) {
    if (x !== undefined && x.cx !== undefined && x.cy !== undefined) {
        y = x.cy;
        x = x.cx;
    }

    this.left += x;
    this.right -= x;
    this.ceil += y;
    this.floor -= y;
};

ArRect.prototype.normalizeRect = function () {
    var temp;

    if (this.left > this.right) {
        temp = this.left;
        this.left = this.right;
        this.right = temp;
    }

    if (this.ceil > this.floor) {
        temp = this.ceil;
        this.ceil = this.floor;
        this.floor = temp;
    }
};

ArRect.prototype.assign = function (rect) {

    this.ceil = rect.ceil;
    this.right = rect.right;
    this.floor = rect.floor;
    this.left = rect.left;
};

ArRect.prototype.equals = function (rect) {
    if (this.left === rect.left &&
        this.right === rect.right &&
        this.ceil === rect.ceil &&
        this.floor === rect.floor) {
        return true;
    }

    return false;

};

ArRect.prototype.add = function (ArObject) {
    var dx,
        dy;
    if (ArObject instanceof ArPoint) {
        dx = ArObject.x;
        dy = ArObject.y;

    } else if (ArObject.cx !== undefined && ArObject.cy !== undefined) {
        dx = ArObject.cx;
        dy = ArObject.cy;

    } else {
        _logger.debug('Invalid arg for [ArRect].add method');
    }

    this.left += dx;
    this.right += dx;
    this.ceil += dy;
    this.floor += dy;
};

ArRect.prototype.subtract = function (ArObject) {
    if (ArObject instanceof ArPoint) {
        this.deflateRect(ArObject.x, ArObject.y);

    } else if (ArObject instanceof ArSize) {
        this.deflateRect(ArObject);

    } else if (ArObject instanceof ArRect) {
        this.left += ArObject.left;
        this.right -= ArObject.right;
        this.ceil += ArObject.ceil;
        this.floor -= ArObject.floor;

    } else {
        _logger.debug('Invalid arg for [ArRect].subtract method');
    }
};

ArRect.prototype.plus = function (ArObject) {
    var resObject = new ArRect(this);
    resObject.add(ArObject);

    return resObject;
};

ArRect.prototype.minus = function (ArObject) {
    var resObject = new ArRect(this);
    resObject.subtract(ArObject);

    return resObject;
};

ArRect.prototype.unionAssign = function (rect) {
    if (rect.isRectEmpty()) {
        return;
    }
    if (this.isRectEmpty()) {
        this.assign(rect);
        return;
    }

    //Take the outermost dimension
    this.left = Math.min(this.left, rect.left);
    this.right = Math.max(this.right, rect.right);
    this.ceil = Math.min(this.ceil, rect.ceil);
    this.floor = Math.max(this.floor, rect.floor);

};

ArRect.prototype.union = function (rect) {
    var resRect = new ArRect(this);
    resRect.unionAssign(rect);

    return resRect;
};

ArRect.prototype.intersectAssign = function (rect1, rect2) {
    rect2 = rect2 ? rect2 : this;
    //Sets this rect to the intersection rect
    this.left = Math.max(rect1.left, rect2.left);
    this.right = Math.min(rect1.right, rect2.right);
    this.ceil = Math.max(rect1.ceil, rect2.ceil);
    this.floor = Math.min(rect1.floor, rect2.floor);

    if (this.left >= this.right || this.ceil >= this.floor) {
        this.setRectEmpty();
        return false;
    }

    return true;
};

ArRect.prototype.intersect = function (rect) {
    var resRect = new ArRect(this);

    resRect.intersectAssign(rect);
    return resRect;
};

ArRect.prototype.touching = function (rect) {
    //One pixel is added to the minimums so, if they are not deemed to be touching
    //there is guaranteed to be at lease a one pixel path between them
    return Math.max(rect.left, this.left) <= Math.min(rect.right, this.right) + 1 &&
        Math.max(rect.ceil, this.ceil) <= Math.min(rect.floor, this.floor) + 1;
};

/**
 * Returns true if the given point is on one of the corners of the rectangle.
 *
 * @param point
 * @return {undefined}
 */
ArRect.prototype.onCorner = function (point) {
    var onHorizontalSide,
        onVerticalSide;

    onHorizontalSide = point.x === this.left || point.x === this.right;
    onVerticalSide = point.y === this.ceil || point.y === this.floor;

    return onHorizontalSide && onVerticalSide;
};

ArRect.prototype.toString = function () {
    return this.getTopLeft().toString() + ' ' + this.getBottomRight().toString();
};

module.exports = ArRect;

},{"./AutoRouter.Logger":10,"./AutoRouter.Point":12,"./AutoRouter.Size":16,"debug":1}],16:[function(require,module,exports){
/*jshint node: true*/

/**
 * @author brollb / https://github/brollb
 */

'use strict';

var ArSize = function (x, y) {
    //Multiple Constructors
    if (x === undefined) { //No arguments were passed to constructor
        x = 0;
        y = 0;
    } else if (y === undefined) { //One argument passed to constructor
        y = x.cy;
        x = x.cx;
    }

    this.cx = x;
    this.cy = y;
};

ArSize.prototype.equals = function (otherSize) {
    if (this.cx === otherSize.cx && this.cy === otherSize.cy) {
        return true;
    }

    return false;
};

ArSize.prototype.add = function (otherSize) { //equivalent to +=
    if (otherSize.cx || otherSize.cy) {
        this.cx += otherSize.cx;
        this.cy += otherSize.cy;
    }
    if (otherSize.x || otherSize.y) {
        this.cx += otherSize.x;
        this.cy += otherSize.y;
    }
};

ArSize.prototype.getArray = function () {
    var res = [];
    res.push(this.cx);
    res.push(this.cy);
    return res;
};

module.exports = ArSize;

},{}],17:[function(require,module,exports){
/*jshint node: true*/

/**
 * @author brollb / https://github/brollb
 */


'use strict';

var CONSTANTS = require('./AutoRouter.Constants'),
    assert = require('./AutoRouter.Utils').assert,
    ArRect = require('./AutoRouter.Rect'),
    ArPoint = require('./AutoRouter.Point');

var _getOptimalPorts = function (ports, tgt) {
    //I will get the dx, dy that to the src/dst target and then I will calculate
    // a priority value that will rate the ports as candidates for the 
    //given path
    var srcC = new ArPoint(), //src center
        vector,
        port, //result
        maxP = -Infinity,
        maxArea = 0,
        sPoint,
        i;

    //Get the center points of the src,dst ports
    for (i = 0; i < ports.length; i++) {
        sPoint = ports[i].rect.getCenter();
        srcC.x += sPoint.x;
        srcC.y += sPoint.y;

        //adjust maxArea
        if (maxArea < ports[i].getTotalAvailableArea()) {
            maxArea = ports[i].getTotalAvailableArea();
        }

    }

    //Get the average center point of src
    srcC.x = srcC.x / ports.length;
    srcC.y = srcC.y / ports.length;

    //Get the directions
    vector = (tgt.minus(srcC).getArray());

    //Create priority function
    function createPriority(port, center) {
        var priority = 0,
        //point = [  center.x - port.rect.getCenter().x, center.y - port.rect.getCenter().y],
            point = [port.rect.getCenter().x - center.x, port.rect.getCenter().y - center.y],
            lineCount = (port.getPointCount() || 1),
            //If there is a problem with maxArea, just ignore density
            density = (port.getTotalAvailableArea() / lineCount) / maxArea || 1,
            major = Math.abs(vector[0]) > Math.abs(vector[1]) ? 0 : 1,
            minor = (major + 1) % 2;

        if (point[major] > 0 === vector[major] > 0 && (point[major] === 0) === (vector[major] === 0)) {
            //handling the === 0 error
            //If they have the same parity, assign the priority to maximize that is > 1
            priority = (Math.abs(vector[major]) / Math.abs(vector[major] - point[major])) * 25;
        }

        if (point[minor] > 0 === vector[minor] > 0 && (point[minor] === 0) === (vector[minor] === 0)) {
            //handling the === 0 error
            //If they have the same parity, assign the priority to maximize that is < 1
            priority += vector[minor] !== point[minor] ?
            (Math.abs(vector[minor]) / Math.abs(vector[minor] - point[minor])) * 1 : 0;
        }

        //Adjust priority based on the density of the lines...
        priority *= density;

        return priority;
    }

    //Create priority values for each port.
    var priority;
    for (i = 0; i < ports.length; i++) {
        priority = createPriority(ports[i], srcC) || 0;
        if (priority >= maxP) {
            port = ports[i];
            maxP = priority;
        }
    }

    assert(port.owner, 'ARGraph.getOptimalPorts: port has invalid owner');

    return port;
};

var _getPointCoord = function (point, horDir) {
    if (horDir === true || _isHorizontal(horDir)) {
        return point.x;
    } else {
        return point.y;
    }
};

var _inflatedRect = function (rect, a) {
    var r = rect;
    r.inflateRect(a, a);
    return r;
};

var _isPointNear = function (p1, p2, nearness) {
    return p2.x - nearness <= p1.x && p1.x <= p2.x + nearness &&
        p2.y - nearness <= p1.y && p1.y <= p2.y + nearness;
};

var _isPointIn = function (point, rect, nearness) {
    var tmpR = new ArRect(rect);
    tmpR.inflateRect(nearness, nearness);
    return tmpR.ptInRect(point) === true;
};

var _isRectIn = function (r1, r2) {
    return r2.left <= r1.left && r1.right <= r2.right &&
        r2.ceil <= r1.ceil && r1.floor <= r2.floor;
};

var _isRectClip = function (r1, r2) {
    var rect = new ArRect();
    return rect.intersectAssign(r1, r2) === true;
};

var _distanceFromHLine = function (p, x1, x2, y) {
    assert(x1 <= x2, 'ArHelper.distanceFromHLine: x1 <= x2 FAILED');

    return Math.max(Math.abs(p.y - y), Math.max(x1 - p.x, p.x - x2));
};

var _distanceFromVLine = function (p, y1, y2, x) {
    assert(y1 <= y2, 'ArHelper.distanceFromVLine: y1 <= y2 FAILED');

    return Math.max(Math.abs(p.x - x), Math.max(y1 - p.y, p.y - y2));
};

var _distanceFromLine = function (pt, start, end) {
    var dir = _getDir(end.minus(start));

    if (_isHorizontal(dir)) {
        return _distanceFromVLine(pt, start.y, end.y, start.x);
    } else {
        return _distanceFromHLine(pt, start.x, end.x, start.y);
    }
};

var _isOnEdge = function (start, end, pt) {
    if (start.x === end.x) {			// vertical edge, horizontal move
        if (end.x === pt.x && pt.y <= Math.max(end.y, start.y) && pt.y >= Math.min(end.y, start.y)) {
            return true;
        }
    } else if (start.y === end.y) {	// horizontal line, vertical move
        if (start.y === pt.y && pt.x <= Math.max(end.x, start.x) && pt.x >= Math.min(end.x, start.x)) {
            return true;
        }
    }

    return false;
};

var _isPointNearLine = function (point, start, end, nearness) {
    assert(0 <= nearness, 'ArHelper.isPointNearLine: 0 <= nearness FAILED');

    // begin Zolmol
    // the routing may create edges that have start==end
    // thus confusing this algorithm
    if (end.x === start.x && end.y === start.y) {
        return false;
    }
    // end Zolmol

    var point2 = point;

    point2.subtract(start);

    var end2 = end;
    end2.subtract(start);

    var x = end2.x,
        y = end2.y,
        u = point2.x,
        v = point2.y,
        xuyv = x * u + y * v,
        x2y2 = x * x + y * y;

    if (xuyv < 0 || xuyv > x2y2) {
        return false;
    }

    var expr1 = (x * v - y * u);
    expr1 *= expr1;
    var expr2 = nearness * nearness * x2y2;

    return expr1 <= expr2;
};

var _isLineMeetHLine = function (start, end, x1, x2, y) {
    assert(x1 <= x2, 'ArHelper.isLineMeetHLine: x1 <= x2 FAILED');
    if (start instanceof Array) {//Converting from 'pointer'
        start = start[0];
    }
    if (end instanceof Array) {
        end = end[0];
    }

    if (!((start.y <= y && y <= end.y) || (end.y <= y && y <= start.y ))) {
        return false;
    }

    var end2 = new ArPoint(end);
    end2.subtract(start);
    x1 -= start.x;
    x2 -= start.x;
    y -= start.y;

    if (end2.y === 0) {
        return y === 0 && (( x1 <= 0 && 0 <= x2 ) || (x1 <= end2.x && end2.x <= x2));
    }

    var x = ((end2.x) / end2.y) * y;
    return x1 <= x && x <= x2;
};

var _isLineMeetVLine = function (start, end, y1, y2, x) {
    assert(y1 <= y2, 'ArHelper.isLineMeetVLine: y1 <= y2  FAILED');
    if (start instanceof Array) {//Converting from 'pointer'
        start = start[0];
    }
    if (end instanceof Array) {
        end = end[0];
    }

    if (!((start.x <= x && x <= end.x) || (end.x <= x && x <= start.x ))) {
        return false;
    }

    var end2 = new ArPoint(end);
    end2.subtract(start);
    y1 -= start.y;
    y2 -= start.y;
    x -= start.x;

    if (end2.x === 0) {
        return x === 0 && (( y1 <= 0 && 0 <= y2 ) || (y1 <= end2.y && end2.y <= y2));
    }

    var y = ((end2.y) / end2.x) * x;
    return y1 <= y && y <= y2;
};

var _isLineClipRects = function (start, end, rects) {
    var i = rects.length;
    while (i--) {
        if (_isLineClipRect(start, end, rects[i])) {
            return true;
        }
    }
    return false;
};

var _isLineClipRect = function (start, end, rect) {
    if (rect.ptInRect(start) || rect.ptInRect(end)) {
        return true;
    }

    return _isLineMeetHLine(start, end, rect.left, rect.right, rect.ceil) ||
        _isLineMeetHLine(start, end, rect.left, rect.right, rect.floor) ||
        _isLineMeetVLine(start, end, rect.ceil, rect.floor, rect.left) ||
        _isLineMeetVLine(start, end, rect.ceil, rect.floor, rect.right);
};

var _getLineClipRectIntersect = function (start, end, rect) {
    //return the endpoints of the intersection line
    var dir = _getDir(end.minus(start)),
        endpoints = [new ArPoint(start), new ArPoint(end)];

    if (!_isLineClipRect(start, end, rect)) {
        return null;
    }

    assert(_isRightAngle(dir), 'ArHelper.getLineClipRectIntersect: _isRightAngle(dir) FAILED');

    //Make sure we are working left to right or top down
    if (dir === CONSTANTS.DirLeft || dir === CONSTANTS.DirTop) {
        dir = _reverseDir(dir);
        endpoints.push(endpoints.splice(0, 1)[0]); //Swap point 0 and point 1
    }

    if (_isPointInDirFrom(endpoints[0], rect.getTopLeft(), _reverseDir(dir))) {
        endpoints[0].assign(rect.getTopLeft());
    }

    if (_isPointInDirFrom(endpoints[1], rect.getBottomRight(), dir)) {
        endpoints[1].assign(rect.getBottomRight());
    }

    if (_isHorizontal(dir)) {
        endpoints[0].y = start.y;
        endpoints[1].y = end.y;
    } else {
        endpoints[0].x = start.x;
        endpoints[1].x = end.x;
    }

    return endpoints;

};

var _intersect = function (a1, a2, b1, b2) {
    return Math.min(a1, a2) <= Math.max(b1, b2) && Math.min(b1, b2) <= Math.max(a1, a2);
};

// --------------------------- RoutingDirection

var _isHorizontal = function (dir) {
    return dir === CONSTANTS.DirRight || dir === CONSTANTS.DirLeft;
};

var _isVertical = function (dir) {
    return dir === CONSTANTS.DirTop || dir === CONSTANTS.DirBottom;
};

var _isRightAngle = function (dir) {
    return CONSTANTS.DirTop <= dir && dir <= CONSTANTS.DirLeft;
};

var _areInRightAngle = function (dir1, dir2) {
    assert(_isRightAngle(dir1) && _isRightAngle(dir2),
        'ArHelper.areInRightAngle: _isRightAngle(dir1) && _isRightAngle(dir2) FAILED');
    return _isHorizontal(dir1) === _isVertical(dir2);
};

var _nextClockwiseDir = function (dir) {
    if (_isRightAngle(dir)) {
        return ((dir + 1) % 4);
    }

    return dir;
};

var _prevClockwiseDir = function (dir) {
    if (_isRightAngle(dir)) {
        return ((dir + 3) % 4);
    }

    return dir;
};

var _reverseDir = function (dir) {
    if (_isRightAngle(dir)) {
        return ((dir + 2) % 4);
    }

    return dir;
};

var _stepOneInDir = function (point, dir) {
    assert(_isRightAngle(dir), 'ArHelper.stepOnInDir: _isRightAngle(dir) FAILED');

    switch (dir) {
        case CONSTANTS.DirTop:
            point.y--;
            break;

        case CONSTANTS.DirRight:
            point.x++;
            break;

        case CONSTANTS.DirBottom:
            point.y++;
            break;

        case CONSTANTS.DirLeft:
            point.x--;
            break;
    }

};

var _getChildRectOuterCoordFrom = function (bufferObject, inDir, point) { //Point travels inDir until hits child box
    var children = bufferObject.children,
        i = -1,
        box = null,
        res = _getRectOuterCoord(bufferObject.box, inDir);

    assert(_isRightAngle(inDir), 'getChildRectOuterCoordFrom: _isRightAngle(inDir) FAILED');
    //The next assert fails if the point is in the opposite direction of the rectangle that it is checking.
    // e.g. The point is checking when it will hit the box from the right but the point is on the left
    assert(!_isPointInDirFrom(point, bufferObject.box, inDir),
        'getChildRectOuterCoordFrom: !isPointInDirFrom(point, bufferObject.box.rect, (inDir)) FAILED');

    while (++i < children.length) {

        if (_isPointInDirFrom(point, children[i], _reverseDir(inDir)) &&
            _isPointBetweenSides(point, children[i], inDir) &&
            _isCoordInDirFrom(res, _getRectOuterCoord(children[i], _reverseDir(inDir)), (inDir))) {

            res = _getRectOuterCoord(children[i], _reverseDir(inDir));
            box = children[i];
        }
    }

    return {'box': box, 'coord': res};
};

var _getRectOuterCoord = function (rect, dir) {
    assert(_isRightAngle(dir), 'Utils.getRectOuterCoord: isRightAngle(dir) FAILED');
    var t = rect.ceil - 1,
        r = rect.right + 1,
        b = rect.floor + 1,
        l = rect.left - 1;

    switch (dir) {
        case CONSTANTS.DirTop:
            return t;

        case CONSTANTS.DirRight:
            return r;

        case CONSTANTS.DirBottom:
            return b;
    }

    return l;
};

//	Indexes:
//				 04
//				1  5
//				3  7
//				 26

var getDirTableIndex = function (offset) {
    return (offset.cx >= 0) * 4 + (offset.cy >= 0) * 2 + (Math.abs(offset.cx) >= Math.abs(offset.cy));
};

var majorDirTable =
    [
        CONSTANTS.DirTop,
        CONSTANTS.DirLeft,
        CONSTANTS.DirBottom,
        CONSTANTS.DirLeft,
        CONSTANTS.DirTop,
        CONSTANTS.DirRight,
        CONSTANTS.DirBottom,
        CONSTANTS.DirRight
    ];

var _getMajorDir = function (offset) {
    return majorDirTable[getDirTableIndex(offset)];
};

var minorDirTable =
    [
        CONSTANTS.DirLeft,
        CONSTANTS.DirTop,
        CONSTANTS.DirLeft,
        CONSTANTS.DirBottom,
        CONSTANTS.DirRight,
        CONSTANTS.DirTop,
        CONSTANTS.DirRight,
        CONSTANTS.DirBottom
    ];

var _getMinorDir = function (offset) {
    return minorDirTable[getDirTableIndex(offset)];
};

//	FG123
//	E   4
//	D 0 5
//	C   6
//  BA987


var _exGetDirTableIndex = function (offset) {
    //This required a variable assignment; otherwise this function
    //returned undefined...
    var res =
        offset.cx > 0 ?
            (
                offset.cy > 0 ?
                    (
                        offset.cx > offset.cy ?
                            (
                                6
                            ) :
                            (offset.cx < offset.cy ?
                                (
                                    8
                                ) :
                                (
                                    7
                                ))
                    ) :
                    (offset.cy < 0 ?
                        (
                            offset.cx > -offset.cy ?
                                (
                                    4
                                ) :
                                (offset.cx < -offset.cy ?
                                    (
                                        2
                                    ) :
                                    (
                                        3
                                    ))
                        ) :
                        (
                            5
                        ))
            ) :
            (offset.cx < 0 ?
                (
                    offset.cy > 0 ?
                        (
                            -offset.cx > offset.cy ?
                                (
                                    12
                                ) :
                                (-offset.cx < offset.cy ?
                                    (
                                        10
                                    ) :
                                    (
                                        11
                                    ))
                        ) :
                        (offset.cy < 0 ?
                            (
                                offset.cx < offset.cy ?
                                    (
                                        14
                                    ) :
                                    (offset.cx > offset.cy ?
                                        (
                                            16
                                        ) :
                                        (
                                            15
                                        ))
                            ) :
                            (
                                13
                            ))
                ) :
                (
                    offset.cy > 0 ?
                        (
                            9
                        ) :
                        (offset.cy < 0 ?
                            (
                                1
                            ) :
                            (
                                0
                            ))
                ));

    return res;
};
var exMajorDirTable =
    [
        CONSTANTS.DirNone,
        CONSTANTS.DirTop,
        CONSTANTS.DirTop,
        CONSTANTS.DirRight,
        CONSTANTS.DirRight,
        CONSTANTS.DirRight,
        CONSTANTS.DirRight,
        CONSTANTS.DirRight,
        CONSTANTS.DirBottom,
        CONSTANTS.DirBottom,
        CONSTANTS.DirBottom,
        CONSTANTS.DirLeft,
        CONSTANTS.DirLeft,
        CONSTANTS.DirLeft,
        CONSTANTS.DirLeft,
        CONSTANTS.DirLeft,
        CONSTANTS.DirTop
    ];

var _exGetMajorDir = function (offset) {
    return exMajorDirTable[_exGetDirTableIndex(offset)];
};

var exMinorDirTable =
    [
        CONSTANTS.DirNone,
        CONSTANTS.DirNone,
        CONSTANTS.DirRight,
        CONSTANTS.DirTop,
        CONSTANTS.DirTop,
        CONSTANTS.DirNone,
        CONSTANTS.DirBottom,
        CONSTANTS.DirBottom,
        CONSTANTS.DirRight,
        CONSTANTS.DirNone,
        CONSTANTS.DirLeft,
        CONSTANTS.DirBottom,
        CONSTANTS.DirBottom,
        CONSTANTS.DirNone,
        CONSTANTS.DirTop,
        CONSTANTS.DirTop,
        CONSTANTS.DirLeft
    ];

var _exGetMinorDir = function (offset) {
    return exMinorDirTable[_exGetDirTableIndex(offset)];
};

var _getDir = function (offset, nodir) {
    if (offset.cx === 0) {
        if (offset.cy === 0) {
            return nodir;
        }

        if (offset.cy < 0) {
            return CONSTANTS.DirTop;
        }

        return CONSTANTS.DirBottom;
    }

    if (offset.cy === 0) {
        if (offset.cx > 0) {
            return CONSTANTS.DirRight;
        }

        return CONSTANTS.DirLeft;
    }

    return CONSTANTS.DirSkew;
};

var _isPointInDirFromChildren = function (point, fromParent, dir) {
    var children = fromParent.children,
        i = 0;

    assert(_isRightAngle(dir), 'isPointInDirFromChildren: _isRightAngle(dir) FAILED');

    while (i < children.length) {
        if (_isPointInDirFrom(point, children[i].rect, dir)) {
            return true;
        }
        ++i;
    }

    return false;
};

var _isPointInDirFrom = function (point, from, dir) {
    if (from instanceof ArRect) {
        var rect = from;
        assert(_isRightAngle(dir), 'ArHelper.isPointInDirFrom: _isRightAngle(dir) FAILED');

        switch (dir) {
            case CONSTANTS.DirTop:
                return point.y < rect.ceil;

            case CONSTANTS.DirRight:
                return point.x >= rect.right;

            case CONSTANTS.DirBottom:
                return point.y >= rect.floor;

            case CONSTANTS.DirLeft:
                return point.x < rect.left;
        }

        return false;

    } else {
        assert(_isRightAngle(dir), 'ArHelper.isPointInDirFrom: _isRightAngle(dir) FAILED');

        switch (dir) {
            case CONSTANTS.DirTop:
                return point.y <= from.y;

            case CONSTANTS.DirRight:
                return point.x >= from.x;

            case CONSTANTS.DirBottom:
                return point.y >= from.y;

            case CONSTANTS.DirLeft:
                return point.x <= from.x;
        }

        return false;

    }
};

var _isPointBetweenSides = function (point, rect, ishorizontal) {
    if (ishorizontal === true || _isHorizontal(ishorizontal)) {
        return rect.ceil <= point.y && point.y < rect.floor;
    }

    return rect.left <= point.x && point.x < rect.right;
};

var _isCoordInDirFrom = function (coord, from, dir) {
    assert(_isRightAngle(dir), 'ArHelper.isCoordInDirFrom: _isRightAngle(dir) FAILED');
    if (from instanceof ArPoint) {
        from = _getPointCoord(from, dir);
    }

    if (dir === CONSTANTS.DirTop || dir === CONSTANTS.DirLeft) {
        return coord <= from;
    }

    return coord >= from;
};

// This next method only supports unambiguous orientations. That is, the point
// cannot be in a corner of the rectangle.
// NOTE: the right and floor used to be - 1. 
var _onWhichEdge = function (rect, point) {
    if (point.y === rect.ceil && rect.left < point.x && point.x < rect.right) {
        return CONSTANTS.DirTop;
    }

    if (point.y === rect.floor && rect.left < point.x && point.x < rect.right) {
        return CONSTANTS.DirBottom;
    }

    if (point.x === rect.left && rect.ceil < point.y && point.y < rect.floor) {
        return CONSTANTS.DirLeft;
    }

    if (point.x === rect.right && rect.ceil < point.y && point.y < rect.floor) {
        return CONSTANTS.DirRight;
    }

    return CONSTANTS.DirNone;
};
// --------------------------- CArFindNearestLine

var ArFindNearestLine = function (pt) {
    this.point = pt;
    this.dist1 = Infinity;
    this.dist2 = Infinity;
};

ArFindNearestLine.prototype.hLine = function (x1, x2, y) {
    assert(x1 <= x2, 'ArFindNearestLine.hLine: x1 <= x2  FAILED');

    var d1 = _distanceFromHLine(this.point, x1, x2, y),
        d2 = Math.abs(this.point.y - y);

    if (d1 < this.dist1 || (d1 === this.dist1 && d2 < this.dist2)) {
        this.dist1 = d1;
        this.dist2 = d2;
        return true;
    }

    return false;
};

ArFindNearestLine.prototype.vLine = function (y1, y2, x) {
    assert(y1 <= y2, 'ArFindNearestLine.hLine: y1 <= y2 FAILED');

    var d1 = _distanceFromVLine(this.point, y1, y2, x),
        d2 = Math.abs(this.point.x - x);

    if (d1 < this.dist1 || (d1 === this.dist1 && d2 < this.dist2)) {
        this.dist1 = d1;
        this.dist2 = d2;
        return true;
    }

    return false;
};

ArFindNearestLine.prototype.was = function () {
    return this.dist1 < Infinity && this.dist2 < Infinity;
};

// Convenience Functions
var removeFromArrays = function (value) {
    var index,
        removed = false,
        array;

    for (var i = arguments.length - 1; i > 0; i--) {
        array = arguments[i];
        index = array.indexOf(value);
        if (index !== -1) {
            array.splice(index, 1);
            removed = true;
        }
    }

    return removed;
};

var stringify = function (value) {
    return JSON.stringify(value, function (key, value) {
        if (key === 'owner' && value) {
            return value.id || typeof value;
        }
        return value;
    });
};

/**
 * Round the number to the given decimal places. Truncate following digits.
 *
 * @param {Number} value
 * @param {Number} places
 * @return {Number} result
 */
var roundTrunc = function (value, places) {
    value = +value;
    var scale = Math.pow(10, +places),
        fn = 'floor';

    if (value < 0) {
        fn = 'ceil';
    }

    return Math[fn](value * scale) / scale;
};

//Float equals
var floatEquals = function (a, b) {
    return ((a - 0.1) < b) && (b < (a + 0.1));
};

/**
 * Convert an object with increasing integer keys to an array.
 * Using method from http://jsperf.com/arguments-performance/6
 *
 * @param {Object} obj
 * @return {Array}
 */
var toArray = function (obj) {
    var result = new Array(obj.length||0),
        i = 0;
    while (obj[i] !== undefined) {
        result[i] = obj[i++];
    }
    return result;
};

var pick = function(keys, obj) {
    var res = {};
    for (var i = keys.length; i--;) {
        res[keys[i]] = obj[keys[i]];
    }
    return res;
};

var nop = function() {
    // nop
};

var assert = function(cond, msg) {
    if (!cond) {
        throw new Error(msg || 'Assert failed');
    }
};

module.exports = {
    onWhichEdge: _onWhichEdge,
    isCoordInDirFrom: _isCoordInDirFrom,
    isPointBetweenSides: _isPointBetweenSides,
    isPointInDirFrom: _isPointInDirFrom,
    isPointInDirFromChildren: _isPointInDirFromChildren,
    isPointIn: _isPointIn,
    isPointNear: _isPointNear,
    getDir: _getDir,
    exGetMinorDir: _exGetMinorDir,
    exGetMajorDir: _exGetMajorDir,
    exGetDirTableIndex: _exGetDirTableIndex,
    getMinorDir: _getMinorDir,
    getMajorDir: _getMajorDir,
    getRectOuterCoord: _getRectOuterCoord,
    getChildRectOuterCoordFrom: _getChildRectOuterCoordFrom,
    stepOneInDir: _stepOneInDir,
    reverseDir: _reverseDir,
    prevClockwiseDir: _prevClockwiseDir,
    nextClockwiseDir: _nextClockwiseDir,
    areInRightAngle: _areInRightAngle,
    isRightAngle: _isRightAngle,
    isHorizontal: _isHorizontal,
    intersect: _intersect,
    getLineClipRectIntersect: _getLineClipRectIntersect,
    isLineClipRect: _isLineClipRect,
    isLineClipRects: _isLineClipRects,
    isPointNearLine: _isPointNearLine,
    isOnEdge: _isOnEdge,
    distanceFromLine: _distanceFromLine,
    isRectClip: _isRectClip,
    isRectIn: _isRectIn,
    inflatedRect: _inflatedRect,
    getPointCoord: _getPointCoord,
    getOptimalPorts: _getOptimalPorts,
    ArFindNearestLine: ArFindNearestLine,

    removeFromArrays: removeFromArrays,
    stringify: stringify,
    floatEquals: floatEquals,
    roundTrunc: roundTrunc,
    toArray: toArray,
    nop: nop,
    assert: assert,
    pick: pick 
};

},{"./AutoRouter.Constants":6,"./AutoRouter.Point":12,"./AutoRouter.Rect":15,"./AutoRouter.Utils":17}],18:[function(require,module,exports){
/*globals define*/
/*jshint browser: true*/

/**
 * @author brollb / https://github/brollb
 */

'use strict';

var CONSTANTS = require('./AutoRouter.Constants'),
    utils = require('./AutoRouter.Utils'),
    assert = utils.assert,
    ArPoint = require('./AutoRouter.Point'),
    ArRect = require('./AutoRouter.Rect'),
    AutoRouterGraph = require('./AutoRouter.Graph'),
    AutoRouterPort = require('./AutoRouter.Port');

var AutoRouter = function () {
    // internal to external ids
    this._boxIds = {};
    this._portIds = {};
    this._pathIds = {};

    this._pathsToUpdateOnDeletion = {};  // portIds => paths
    this._pathsToUpdateOnAddition = {};  // boxIds => paths
    this._pathSrc = {};
    this._pathDst = {};

    this._graph = new AutoRouterGraph();
};

/* * * * * * * Public API * * * * * * */

AutoRouter.prototype.clear = function () {
    this._graph.clear(true);
    this._boxIds = {};
    this._portIds = {};
    this._pathIds = {};

    this._pathsToUpdateOnDeletion = {};  // portIds => paths
    this._pathsToUpdateOnAddition = {};  // boxIds => paths
    this._pathSrc = {};
    this._pathDst = {};
};

AutoRouter.prototype.setBox = function(id, rect) {
    var box;
    if (rect === null) {  // Remove the box
        return this._removeBox(id);
    }

    if (!this._boxIds[id]) {
        box = this._createBox(rect);
        // Update records
        this._boxIds[id] = box.id;
        this._portIds[id] = {};
        if (this._pathsToUpdateOnAddition[id]) {
            this._updatePathsForBox(id);
        }
    } else {
        this._updateBox(id, rect);
    }

    return this.box(id);
};

AutoRouter.prototype.setDependentBox = function(parentId, childId) {
    var parent = this._box(parentId),
        child = this._box(childId);

    assert(parent && child, 'Could not find parent or child');
    parent.addChild(child);
};

AutoRouter.prototype.moveBox = function(id, x, y) {
    var box = this._box(id),
        rect,
        dx,
        dy;

    if (box) {
        rect = box.rect;
        dx = x - rect.left;
        dy = y - rect.ceil;
        this._graph.shiftBoxBy(box, {cx: dx, cy: dy});
    } else {
        throw Error(`AutoRouter: Cannot find box ${id}" to move!`);
    }
};

AutoRouter.prototype.setPort = function(boxId, portId, area) {
    if (area === null) {
        return this._removePort(boxId, portId);
    }

    assert(this._box(boxId), 'Box "' + boxId + '" does not exist');
    if (!this._portIds[boxId] || !this._portIds[boxId][portId]) {
        this._createPort(boxId, portId, area);
        assert(this._port(boxId, portId), 'Port not added!');
    } else {
        this._updatePort(boxId, portId, area);
    }
};

AutoRouter.prototype.setPath = function(id, srcId, dstId) {
    if (srcId === null) {
        return this._removePath(id);
    }

    if (!this._pathIds[id]) {
        this._createPath(id, srcId, dstId);
    } else {
        this._updatePath(id, srcId, dstId);
    }
};

AutoRouter.prototype.setCustomRouting = function(id, points) {
    var path = this._path(id);

    if (!path) {
        throw Error('AutoRouter: Need to have an AutoRouterPath type to set custom path points');
    }

    if (points === null) {
        path.setAutoRouting(true);
    } else {
        this._setCustomPath(path, points);
    }
};

AutoRouter.prototype.routeSync = function () {
    this._graph.routeSync();
};

AutoRouter.prototype.routeAsync = function (options) {
    this._graph.routeAsync(options);
};

AutoRouter.prototype.box = function (id) {
    var pBox = this._box(id),  // private box
        rect;

    if (!pBox) {
        return null;
    }

    rect = pBox.rect;
    return {
        id: id,
        x: rect.left,
        width: rect.right - rect.left,
        y: rect.ceil,
        height: rect.floor - rect.ceil
    };
};

AutoRouter.prototype.port = function (boxId, id) {
    var container = this._port(boxId, id),
        rect;

    if (!container) {
        return null;
    }

    rect = container.ports[0].rect;

    return {
        id: id,
        x: rect.left,
        width: rect.right - rect.left,
        y: rect.ceil,
        height: rect.floor - rect.ceil
    };
};

AutoRouter.prototype.path = function (id) {
    var path = this._path(id);
    return {  // TODO: Consider adding src, dst
        id: id,
        points: path.points.map(function(pt) {
            return [pt.x, pt.y];
        })
    };
};

AutoRouter.prototype.boxes = function () {
    return Object.keys(this._boxIds);
};

AutoRouter.prototype.ports = function (boxId) {
    return Object.keys(this._portIds[boxId]);
};

AutoRouter.prototype.paths = function () {
    return Object.keys(this._pathIds);
};

/* * * * * * * Private API * * * * * * */

// Getters

AutoRouter.prototype._box = function (id) {
    var pId = this._boxIds[id];
    return this._graph.boxes[pId] || null;
};

AutoRouter.prototype._port = function (boxId, id) {
    assert(boxId !== undefined && id !== undefined, 'Missing ' + (!boxId ? 'boxId' : 'id'));
    return this._portIds[boxId][id];
};

AutoRouter.prototype._path = function (id) {
    var pId = this._pathIds[id];
    for (var i = this._graph.paths.length; i--;) {
        if (this._graph.paths[i].id === pId) {
            return this._graph.paths[i];
        }
    }
    return null;
};

// Boxes

AutoRouter.prototype._createBox = function (params) {
    var x1 = params.x1,
        x2 = params.x2,
        y1 = params.y1,
        y2 = params.y2,
        box = this._graph.createBox(),
        rect = new ArRect(x1, y1, x2, y2);

    assert(!isNaN(x1 + x2 + y1 + y2), 'Missing size info for box');

    this._setValidRectSize(rect);
    box.setRect(rect);

    // Add the box to the graph
    this._graph.addBox(box);
    // Record keeping is not done in this function bc this function
    // is reused for the port containers
    return box;
};

AutoRouter.prototype._updateBox = function (id, params) {  // public id
    var box = this._box(id),
        rect = box.rect,
        newWidth = params.x2 - params.x1,
        newHeight = params.y2 - params.y1,
        dx,
        dy,
        newRect;

    // Shift
    if (newHeight === rect.getHeight() && newWidth === rect.getWidth()) {
        dx = params.x1 - rect.left;
        dy = params.y1 - rect.ceil;
        this._graph.shiftBoxBy(box, {cx: dx, cy: dy});
    } else {
        newRect = new ArRect(params.x1, params.y1, params.x2, params.y2);
        this._graph.setBoxRect(box, newRect);
    }

};

AutoRouter.prototype._removeBox = function (id) {  // public id
    var box = this._box(id),
        ports = Object.keys(this._portIds[id]);

    // Remove all ports
    for (var i = ports.length; i--;) {
        this._removePort(id, ports[i]);
    }

    this._graph.deleteBox(box);
    delete this._boxIds[id];
    delete this._portIds[id];

    if (this._pathsToUpdateOnAddition[id] && this._pathsToUpdateOnAddition[id].length === 0) {
        delete this._pathsToUpdateOnAddition[id];
    }
};

// Paths

AutoRouter.prototype._createPath = function (id, srcId, dstId) {  // public id
    var srcPorts = this._getPortsFor(srcId),  // FIXME: should be able to specify ports
        dstPorts = this._getPortsFor(dstId),
        ports = srcPorts.concat(dstPorts),
        path;

    assert(srcPorts, 'Missing srcPorts (' + srcPorts + ')');
    assert(dstPorts, 'Missing dstPorts (' + dstPorts + ')');

    path = this._graph.addPath(true, srcPorts, dstPorts);
    path.id = id;
    this._pathIds[id] = path.id;

    // Update the updates dictionaries
    for (var i = ports.length; i--;) {
        if (!this._pathsToUpdateOnDeletion[ports[i].id]) {
            this._pathsToUpdateOnDeletion[ports[i].id] = [];
        }
        this._pathsToUpdateOnDeletion[ports[i].id].push(path);
    }

    if (typeof srcId === 'string') {
        if (!this._pathsToUpdateOnAddition[srcId]) {
            this._pathsToUpdateOnAddition[srcId] = [];
        }
        this._pathsToUpdateOnAddition[srcId].push(path);
    }
    if (typeof dstId === 'string') {
        if (!this._pathsToUpdateOnAddition[dstId]) {
            this._pathsToUpdateOnAddition[dstId] = [];
        }
        this._pathsToUpdateOnAddition[dstId].push(path);
    }
    this._pathSrc[id] = srcId;
    this._pathDst[id] = dstId;
};

AutoRouter.prototype._getPortsFor = function (boxId) {
    if (boxId instanceof Array) {  // list of ports -> not a boxId
        // FIXME: These ports would also need to be resolved!
        return boxId;
    } else {  // boxId is a box id -> get the ports
        var portIds = Object.keys(this._portIds[boxId]),
            ports = [];

        for (var i = portIds.length; i--;) {
            assert(this._portIds[boxId][portIds[i]].ports.length === 1);
            ports.push(this._portIds[boxId][portIds[i]].ports[0]);
        }
        assert(ports, 'no ports found (' + ports + ')');
        for (var i = ports.length; i--;) {
            assert (ports[i].owner, 'Invalid owner');
        }
        return ports;
    }
};

AutoRouter.prototype._updatePath = function (id, srcId, dstId) {  // public id
    this._removePath(id, true);
    this._createPath(id, srcId, dstId);
};

AutoRouter.prototype._removePath = function (id, silent) {  // public id
    var path = this._path(id),
        src = this._pathSrc[id],
        dst = this._pathDst[id];

    this._graph.deletePath(path);
    delete this._pathIds[id];
    delete this._pathSrc[id];
    delete this._pathDst[id];

    if (!silent) {
        this._clearOldBoxRecords(src, id);
        this._clearOldBoxRecords(dst, id);
    }
};

AutoRouter.prototype._clearOldBoxRecords = function (id, pathId) {  // public id
    var boxIsDeleted = !this._boxIds[id],
        hasRecord = this._pathsToUpdateOnAddition.hasOwnProperty(id);

    if (hasRecord) {
        for (var i = this._pathsToUpdateOnAddition[id].length; i--;) {
            if (this._pathsToUpdateOnAddition[id][i].id === pathId) {
                this._pathsToUpdateOnAddition[id].splice(i, 1);
            }
        }
        if (boxIsDeleted && this._pathsToUpdateOnAddition[id].length === 0) {
            delete this._pathsToUpdateOnAddition[id];
        }
    }
};

AutoRouter.prototype._setCustomPath = function (path, points) {  // public id
    // Convert points to array of ArPoints
    points = points.map(function (point) {
        return new ArPoint(point[0], point[1]);
    });

    path.setCustomPathPoints(points);
    path.setAutoRouting(false);
};

// Ports

AutoRouter.prototype._createPort = function (boxId, portId, area) {  // area: [[x1, y1], [x2, y2]]
    var box = this._box(boxId),
        container,
        cRect = new ArRect(),
        port = new AutoRouterPort(),
        rect = this._createRectFromArea(area),
        attr;

    // Create the port
    attr = this._getPortAttributes(box.rect, area);
    port.id = boxId + '/|\\' + portId;
    port.setLimitedDirs(false);
    port.attributes = attr;
    this._setValidRectSize(rect);
    port.setRect(rect);

    // Create a container rect
    cRect.assign(rect);
    cRect.inflateRect(1);
    container = this._createBox({
        x1: cRect.left,
        y1: cRect.ceil,
        x2: cRect.right,
        y2: cRect.floor
    });

    box.addChild(container);
    container.addPort(port);
    this._portIds[boxId][portId] = container;

    // Update paths as needed
    this._updatePathsForBox(boxId);
};

AutoRouter.prototype._updatePathsForBox = function (boxId) {
    var paths = this._pathsToUpdateOnAddition[boxId] || [],
        start,
        end;

    for (var i = paths.length; i--;) {
        // Get the new ports
        start = this._getPortsFor(this._pathSrc[paths[i].id]);
        end = this._getPortsFor(this._pathDst[paths[i].id]);

        // Disconnect and update path
        this._graph.disconnect(paths[i]);
        if (start.length && end.length) {
            paths[i].setStartEndPorts(start, end);
        }
    }
};

AutoRouter.prototype._createRectFromArea = function (area) {
    var rect = new ArRect(area.x1, area.y1, area.x2, area.y2);
    this._setValidRectSize(rect);
    return rect;
};

AutoRouter.prototype._getPortAttributes = function (rect, area) {
    var attr = 0,
        x1 = area.x1,
        x2 = area.x2,
        y1 = area.y1,
        y2 = area.y2,
        horizontal = y1 === y2;

    if (horizontal) {
        if (Math.abs(y1 - rect.ceil) < Math.abs(y1 - rect.floor)) {  // Closer to the top
            attr = CONSTANTS.PortStartOnTop + CONSTANTS.PortEndOnTop;
        } else {  // Closer to the top (horizontal)
            attr = CONSTANTS.PortStartOnBottom + CONSTANTS.PortEndOnBottom;
        }

    } else {
        if (Math.abs(x1 - rect.left) < Math.abs(x1 - rect.right)) {  // Closer to the left
            attr = CONSTANTS.PortStartOnLeft + CONSTANTS.PortEndOnLeft;
        } else {  // Closer to the right (vertical)
            attr = CONSTANTS.PortStartOnRight + CONSTANTS.PortEndOnRight;
        }
    }

    return attr;
};

AutoRouter.prototype._updatePort = function (boxId, portId, area) {
    var box = this._box(boxId),
        container = this._port(boxId, portId),
        cRect = container.rect,
        port = container.ports[0],
        rect = this._createRectFromArea(area),
        attr;

    // Update the port's rect
    attr = this._getPortAttributes(box.rect, area);
    port.setLimitedDirs(false);
    port.attributes = attr;
    this._setValidRectSize(rect);
    port.setRect(rect);

    cRect.assign(port.rect);
    cRect.inflateRect(1);
    container.setRect(cRect);
};

AutoRouter.prototype._removePort = function (boxId, portId) {
    var container = this._port(boxId, portId),
        port = container.ports[0],
        paths = this._pathsToUpdateOnDeletion[port.id] || [],
        start,
        end;

    this._graph.deleteBox(container);

    // Update paths
    delete this._pathsToUpdateOnDeletion[port.id];
    for (var i = paths.length; i--;) {
        start = paths[i].startports;
        end = paths[i].endports;
        utils.removeFromArrays(port, start, end);
        if (start.length && end.length) {
            paths[i].setStartEndPorts(start, end);
        }
    }
    delete this._portIds[boxId][portId];
};

// Shared utilities

AutoRouter.prototype._setValidRectSize = function (rect) {
    // Make sure the rect is at least 3x3
    var height = rect.getHeight(),
        width = rect.getWidth(),
        dx = Math.max((3 - width) / 2, 0),
        dy = Math.max((3 - height) / 2, 0);

    rect.inflateRect(dx, dy);
    return rect;
};

module.exports = AutoRouter;

},{"./AutoRouter.Constants":6,"./AutoRouter.Graph":9,"./AutoRouter.Point":12,"./AutoRouter.Port":14,"./AutoRouter.Rect":15,"./AutoRouter.Utils":17}]},{},[4])(4)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvZGVidWcvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy9kZWJ1Zy9kZWJ1Zy5qcyIsIm5vZGVfbW9kdWxlcy9kZWJ1Zy9ub2RlX21vZHVsZXMvbXMvaW5kZXguanMiLCJzcmMvQXV0b1JvdXRlci5BY3Rpb25BcHBsaWVyLmpzIiwic3JjL0F1dG9Sb3V0ZXIuQm94LmpzIiwic3JjL0F1dG9Sb3V0ZXIuQ29uc3RhbnRzLmpzIiwic3JjL0F1dG9Sb3V0ZXIuRWRnZS5qcyIsInNyYy9BdXRvUm91dGVyLkVkZ2VMaXN0LmpzIiwic3JjL0F1dG9Sb3V0ZXIuR3JhcGguanMiLCJzcmMvQXV0b1JvdXRlci5Mb2dnZXIuanMiLCJzcmMvQXV0b1JvdXRlci5QYXRoLmpzIiwic3JjL0F1dG9Sb3V0ZXIuUG9pbnQuanMiLCJzcmMvQXV0b1JvdXRlci5Qb2ludExpc3QuanMiLCJzcmMvQXV0b1JvdXRlci5Qb3J0LmpzIiwic3JjL0F1dG9Sb3V0ZXIuUmVjdC5qcyIsInNyYy9BdXRvUm91dGVyLlNpemUuanMiLCJzcmMvQXV0b1JvdXRlci5VdGlscy5qcyIsInNyYy9BdXRvUm91dGVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDalFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0T0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6VkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVyREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3p2RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxaUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdE1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6YUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVVQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbDVCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXG4vKipcbiAqIFRoaXMgaXMgdGhlIHdlYiBicm93c2VyIGltcGxlbWVudGF0aW9uIG9mIGBkZWJ1ZygpYC5cbiAqXG4gKiBFeHBvc2UgYGRlYnVnKClgIGFzIHRoZSBtb2R1bGUuXG4gKi9cblxuZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9kZWJ1ZycpO1xuZXhwb3J0cy5sb2cgPSBsb2c7XG5leHBvcnRzLmZvcm1hdEFyZ3MgPSBmb3JtYXRBcmdzO1xuZXhwb3J0cy5zYXZlID0gc2F2ZTtcbmV4cG9ydHMubG9hZCA9IGxvYWQ7XG5leHBvcnRzLnVzZUNvbG9ycyA9IHVzZUNvbG9ycztcbmV4cG9ydHMuc3RvcmFnZSA9ICd1bmRlZmluZWQnICE9IHR5cGVvZiBjaHJvbWVcbiAgICAgICAgICAgICAgICYmICd1bmRlZmluZWQnICE9IHR5cGVvZiBjaHJvbWUuc3RvcmFnZVxuICAgICAgICAgICAgICAgICAgPyBjaHJvbWUuc3RvcmFnZS5sb2NhbFxuICAgICAgICAgICAgICAgICAgOiBsb2NhbHN0b3JhZ2UoKTtcblxuLyoqXG4gKiBDb2xvcnMuXG4gKi9cblxuZXhwb3J0cy5jb2xvcnMgPSBbXG4gICdsaWdodHNlYWdyZWVuJyxcbiAgJ2ZvcmVzdGdyZWVuJyxcbiAgJ2dvbGRlbnJvZCcsXG4gICdkb2RnZXJibHVlJyxcbiAgJ2RhcmtvcmNoaWQnLFxuICAnY3JpbXNvbidcbl07XG5cbi8qKlxuICogQ3VycmVudGx5IG9ubHkgV2ViS2l0LWJhc2VkIFdlYiBJbnNwZWN0b3JzLCBGaXJlZm94ID49IHYzMSxcbiAqIGFuZCB0aGUgRmlyZWJ1ZyBleHRlbnNpb24gKGFueSBGaXJlZm94IHZlcnNpb24pIGFyZSBrbm93blxuICogdG8gc3VwcG9ydCBcIiVjXCIgQ1NTIGN1c3RvbWl6YXRpb25zLlxuICpcbiAqIFRPRE86IGFkZCBhIGBsb2NhbFN0b3JhZ2VgIHZhcmlhYmxlIHRvIGV4cGxpY2l0bHkgZW5hYmxlL2Rpc2FibGUgY29sb3JzXG4gKi9cblxuZnVuY3Rpb24gdXNlQ29sb3JzKCkge1xuICAvLyBpcyB3ZWJraXQ/IGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzE2NDU5NjA2LzM3Njc3M1xuICByZXR1cm4gKCdXZWJraXRBcHBlYXJhbmNlJyBpbiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc3R5bGUpIHx8XG4gICAgLy8gaXMgZmlyZWJ1Zz8gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMzk4MTIwLzM3Njc3M1xuICAgICh3aW5kb3cuY29uc29sZSAmJiAoY29uc29sZS5maXJlYnVnIHx8IChjb25zb2xlLmV4Y2VwdGlvbiAmJiBjb25zb2xlLnRhYmxlKSkpIHx8XG4gICAgLy8gaXMgZmlyZWZveCA+PSB2MzE/XG4gICAgLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9Ub29scy9XZWJfQ29uc29sZSNTdHlsaW5nX21lc3NhZ2VzXG4gICAgKG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5tYXRjaCgvZmlyZWZveFxcLyhcXGQrKS8pICYmIHBhcnNlSW50KFJlZ0V4cC4kMSwgMTApID49IDMxKTtcbn1cblxuLyoqXG4gKiBNYXAgJWogdG8gYEpTT04uc3RyaW5naWZ5KClgLCBzaW5jZSBubyBXZWIgSW5zcGVjdG9ycyBkbyB0aGF0IGJ5IGRlZmF1bHQuXG4gKi9cblxuZXhwb3J0cy5mb3JtYXR0ZXJzLmogPSBmdW5jdGlvbih2KSB7XG4gIHJldHVybiBKU09OLnN0cmluZ2lmeSh2KTtcbn07XG5cblxuLyoqXG4gKiBDb2xvcml6ZSBsb2cgYXJndW1lbnRzIGlmIGVuYWJsZWQuXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBmb3JtYXRBcmdzKCkge1xuICB2YXIgYXJncyA9IGFyZ3VtZW50cztcbiAgdmFyIHVzZUNvbG9ycyA9IHRoaXMudXNlQ29sb3JzO1xuXG4gIGFyZ3NbMF0gPSAodXNlQ29sb3JzID8gJyVjJyA6ICcnKVxuICAgICsgdGhpcy5uYW1lc3BhY2VcbiAgICArICh1c2VDb2xvcnMgPyAnICVjJyA6ICcgJylcbiAgICArIGFyZ3NbMF1cbiAgICArICh1c2VDb2xvcnMgPyAnJWMgJyA6ICcgJylcbiAgICArICcrJyArIGV4cG9ydHMuaHVtYW5pemUodGhpcy5kaWZmKTtcblxuICBpZiAoIXVzZUNvbG9ycykgcmV0dXJuIGFyZ3M7XG5cbiAgdmFyIGMgPSAnY29sb3I6ICcgKyB0aGlzLmNvbG9yO1xuICBhcmdzID0gW2FyZ3NbMF0sIGMsICdjb2xvcjogaW5oZXJpdCddLmNvbmNhdChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmdzLCAxKSk7XG5cbiAgLy8gdGhlIGZpbmFsIFwiJWNcIiBpcyBzb21ld2hhdCB0cmlja3ksIGJlY2F1c2UgdGhlcmUgY291bGQgYmUgb3RoZXJcbiAgLy8gYXJndW1lbnRzIHBhc3NlZCBlaXRoZXIgYmVmb3JlIG9yIGFmdGVyIHRoZSAlYywgc28gd2UgbmVlZCB0b1xuICAvLyBmaWd1cmUgb3V0IHRoZSBjb3JyZWN0IGluZGV4IHRvIGluc2VydCB0aGUgQ1NTIGludG9cbiAgdmFyIGluZGV4ID0gMDtcbiAgdmFyIGxhc3RDID0gMDtcbiAgYXJnc1swXS5yZXBsYWNlKC8lW2EteiVdL2csIGZ1bmN0aW9uKG1hdGNoKSB7XG4gICAgaWYgKCclJScgPT09IG1hdGNoKSByZXR1cm47XG4gICAgaW5kZXgrKztcbiAgICBpZiAoJyVjJyA9PT0gbWF0Y2gpIHtcbiAgICAgIC8vIHdlIG9ubHkgYXJlIGludGVyZXN0ZWQgaW4gdGhlICpsYXN0KiAlY1xuICAgICAgLy8gKHRoZSB1c2VyIG1heSBoYXZlIHByb3ZpZGVkIHRoZWlyIG93bilcbiAgICAgIGxhc3RDID0gaW5kZXg7XG4gICAgfVxuICB9KTtcblxuICBhcmdzLnNwbGljZShsYXN0QywgMCwgYyk7XG4gIHJldHVybiBhcmdzO1xufVxuXG4vKipcbiAqIEludm9rZXMgYGNvbnNvbGUubG9nKClgIHdoZW4gYXZhaWxhYmxlLlxuICogTm8tb3Agd2hlbiBgY29uc29sZS5sb2dgIGlzIG5vdCBhIFwiZnVuY3Rpb25cIi5cbiAqXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGxvZygpIHtcbiAgLy8gdGhpcyBoYWNrZXJ5IGlzIHJlcXVpcmVkIGZvciBJRTgvOSwgd2hlcmVcbiAgLy8gdGhlIGBjb25zb2xlLmxvZ2AgZnVuY3Rpb24gZG9lc24ndCBoYXZlICdhcHBseSdcbiAgcmV0dXJuICdvYmplY3QnID09PSB0eXBlb2YgY29uc29sZVxuICAgICYmIGNvbnNvbGUubG9nXG4gICAgJiYgRnVuY3Rpb24ucHJvdG90eXBlLmFwcGx5LmNhbGwoY29uc29sZS5sb2csIGNvbnNvbGUsIGFyZ3VtZW50cyk7XG59XG5cbi8qKlxuICogU2F2ZSBgbmFtZXNwYWNlc2AuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVzcGFjZXNcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHNhdmUobmFtZXNwYWNlcykge1xuICB0cnkge1xuICAgIGlmIChudWxsID09IG5hbWVzcGFjZXMpIHtcbiAgICAgIGV4cG9ydHMuc3RvcmFnZS5yZW1vdmVJdGVtKCdkZWJ1ZycpO1xuICAgIH0gZWxzZSB7XG4gICAgICBleHBvcnRzLnN0b3JhZ2UuZGVidWcgPSBuYW1lc3BhY2VzO1xuICAgIH1cbiAgfSBjYXRjaChlKSB7fVxufVxuXG4vKipcbiAqIExvYWQgYG5hbWVzcGFjZXNgLlxuICpcbiAqIEByZXR1cm4ge1N0cmluZ30gcmV0dXJucyB0aGUgcHJldmlvdXNseSBwZXJzaXN0ZWQgZGVidWcgbW9kZXNcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGxvYWQoKSB7XG4gIHZhciByO1xuICB0cnkge1xuICAgIHIgPSBleHBvcnRzLnN0b3JhZ2UuZGVidWc7XG4gIH0gY2F0Y2goZSkge31cbiAgcmV0dXJuIHI7XG59XG5cbi8qKlxuICogRW5hYmxlIG5hbWVzcGFjZXMgbGlzdGVkIGluIGBsb2NhbFN0b3JhZ2UuZGVidWdgIGluaXRpYWxseS5cbiAqL1xuXG5leHBvcnRzLmVuYWJsZShsb2FkKCkpO1xuXG4vKipcbiAqIExvY2Fsc3RvcmFnZSBhdHRlbXB0cyB0byByZXR1cm4gdGhlIGxvY2Fsc3RvcmFnZS5cbiAqXG4gKiBUaGlzIGlzIG5lY2Vzc2FyeSBiZWNhdXNlIHNhZmFyaSB0aHJvd3NcbiAqIHdoZW4gYSB1c2VyIGRpc2FibGVzIGNvb2tpZXMvbG9jYWxzdG9yYWdlXG4gKiBhbmQgeW91IGF0dGVtcHQgdG8gYWNjZXNzIGl0LlxuICpcbiAqIEByZXR1cm4ge0xvY2FsU3RvcmFnZX1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGxvY2Fsc3RvcmFnZSgpe1xuICB0cnkge1xuICAgIHJldHVybiB3aW5kb3cubG9jYWxTdG9yYWdlO1xuICB9IGNhdGNoIChlKSB7fVxufVxuIiwiXG4vKipcbiAqIFRoaXMgaXMgdGhlIGNvbW1vbiBsb2dpYyBmb3IgYm90aCB0aGUgTm9kZS5qcyBhbmQgd2ViIGJyb3dzZXJcbiAqIGltcGxlbWVudGF0aW9ucyBvZiBgZGVidWcoKWAuXG4gKlxuICogRXhwb3NlIGBkZWJ1ZygpYCBhcyB0aGUgbW9kdWxlLlxuICovXG5cbmV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IGRlYnVnO1xuZXhwb3J0cy5jb2VyY2UgPSBjb2VyY2U7XG5leHBvcnRzLmRpc2FibGUgPSBkaXNhYmxlO1xuZXhwb3J0cy5lbmFibGUgPSBlbmFibGU7XG5leHBvcnRzLmVuYWJsZWQgPSBlbmFibGVkO1xuZXhwb3J0cy5odW1hbml6ZSA9IHJlcXVpcmUoJ21zJyk7XG5cbi8qKlxuICogVGhlIGN1cnJlbnRseSBhY3RpdmUgZGVidWcgbW9kZSBuYW1lcywgYW5kIG5hbWVzIHRvIHNraXAuXG4gKi9cblxuZXhwb3J0cy5uYW1lcyA9IFtdO1xuZXhwb3J0cy5za2lwcyA9IFtdO1xuXG4vKipcbiAqIE1hcCBvZiBzcGVjaWFsIFwiJW5cIiBoYW5kbGluZyBmdW5jdGlvbnMsIGZvciB0aGUgZGVidWcgXCJmb3JtYXRcIiBhcmd1bWVudC5cbiAqXG4gKiBWYWxpZCBrZXkgbmFtZXMgYXJlIGEgc2luZ2xlLCBsb3dlcmNhc2VkIGxldHRlciwgaS5lLiBcIm5cIi5cbiAqL1xuXG5leHBvcnRzLmZvcm1hdHRlcnMgPSB7fTtcblxuLyoqXG4gKiBQcmV2aW91c2x5IGFzc2lnbmVkIGNvbG9yLlxuICovXG5cbnZhciBwcmV2Q29sb3IgPSAwO1xuXG4vKipcbiAqIFByZXZpb3VzIGxvZyB0aW1lc3RhbXAuXG4gKi9cblxudmFyIHByZXZUaW1lO1xuXG4vKipcbiAqIFNlbGVjdCBhIGNvbG9yLlxuICpcbiAqIEByZXR1cm4ge051bWJlcn1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHNlbGVjdENvbG9yKCkge1xuICByZXR1cm4gZXhwb3J0cy5jb2xvcnNbcHJldkNvbG9yKysgJSBleHBvcnRzLmNvbG9ycy5sZW5ndGhdO1xufVxuXG4vKipcbiAqIENyZWF0ZSBhIGRlYnVnZ2VyIHdpdGggdGhlIGdpdmVuIGBuYW1lc3BhY2VgLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lc3BhY2VcbiAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBkZWJ1ZyhuYW1lc3BhY2UpIHtcblxuICAvLyBkZWZpbmUgdGhlIGBkaXNhYmxlZGAgdmVyc2lvblxuICBmdW5jdGlvbiBkaXNhYmxlZCgpIHtcbiAgfVxuICBkaXNhYmxlZC5lbmFibGVkID0gZmFsc2U7XG5cbiAgLy8gZGVmaW5lIHRoZSBgZW5hYmxlZGAgdmVyc2lvblxuICBmdW5jdGlvbiBlbmFibGVkKCkge1xuXG4gICAgdmFyIHNlbGYgPSBlbmFibGVkO1xuXG4gICAgLy8gc2V0IGBkaWZmYCB0aW1lc3RhbXBcbiAgICB2YXIgY3VyciA9ICtuZXcgRGF0ZSgpO1xuICAgIHZhciBtcyA9IGN1cnIgLSAocHJldlRpbWUgfHwgY3Vycik7XG4gICAgc2VsZi5kaWZmID0gbXM7XG4gICAgc2VsZi5wcmV2ID0gcHJldlRpbWU7XG4gICAgc2VsZi5jdXJyID0gY3VycjtcbiAgICBwcmV2VGltZSA9IGN1cnI7XG5cbiAgICAvLyBhZGQgdGhlIGBjb2xvcmAgaWYgbm90IHNldFxuICAgIGlmIChudWxsID09IHNlbGYudXNlQ29sb3JzKSBzZWxmLnVzZUNvbG9ycyA9IGV4cG9ydHMudXNlQ29sb3JzKCk7XG4gICAgaWYgKG51bGwgPT0gc2VsZi5jb2xvciAmJiBzZWxmLnVzZUNvbG9ycykgc2VsZi5jb2xvciA9IHNlbGVjdENvbG9yKCk7XG5cbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG5cbiAgICBhcmdzWzBdID0gZXhwb3J0cy5jb2VyY2UoYXJnc1swXSk7XG5cbiAgICBpZiAoJ3N0cmluZycgIT09IHR5cGVvZiBhcmdzWzBdKSB7XG4gICAgICAvLyBhbnl0aGluZyBlbHNlIGxldCdzIGluc3BlY3Qgd2l0aCAlb1xuICAgICAgYXJncyA9IFsnJW8nXS5jb25jYXQoYXJncyk7XG4gICAgfVxuXG4gICAgLy8gYXBwbHkgYW55IGBmb3JtYXR0ZXJzYCB0cmFuc2Zvcm1hdGlvbnNcbiAgICB2YXIgaW5kZXggPSAwO1xuICAgIGFyZ3NbMF0gPSBhcmdzWzBdLnJlcGxhY2UoLyUoW2EteiVdKS9nLCBmdW5jdGlvbihtYXRjaCwgZm9ybWF0KSB7XG4gICAgICAvLyBpZiB3ZSBlbmNvdW50ZXIgYW4gZXNjYXBlZCAlIHRoZW4gZG9uJ3QgaW5jcmVhc2UgdGhlIGFycmF5IGluZGV4XG4gICAgICBpZiAobWF0Y2ggPT09ICclJScpIHJldHVybiBtYXRjaDtcbiAgICAgIGluZGV4Kys7XG4gICAgICB2YXIgZm9ybWF0dGVyID0gZXhwb3J0cy5mb3JtYXR0ZXJzW2Zvcm1hdF07XG4gICAgICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGZvcm1hdHRlcikge1xuICAgICAgICB2YXIgdmFsID0gYXJnc1tpbmRleF07XG4gICAgICAgIG1hdGNoID0gZm9ybWF0dGVyLmNhbGwoc2VsZiwgdmFsKTtcblxuICAgICAgICAvLyBub3cgd2UgbmVlZCB0byByZW1vdmUgYGFyZ3NbaW5kZXhdYCBzaW5jZSBpdCdzIGlubGluZWQgaW4gdGhlIGBmb3JtYXRgXG4gICAgICAgIGFyZ3Muc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgaW5kZXgtLTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtYXRjaDtcbiAgICB9KTtcblxuICAgIGlmICgnZnVuY3Rpb24nID09PSB0eXBlb2YgZXhwb3J0cy5mb3JtYXRBcmdzKSB7XG4gICAgICBhcmdzID0gZXhwb3J0cy5mb3JtYXRBcmdzLmFwcGx5KHNlbGYsIGFyZ3MpO1xuICAgIH1cbiAgICB2YXIgbG9nRm4gPSBlbmFibGVkLmxvZyB8fCBleHBvcnRzLmxvZyB8fCBjb25zb2xlLmxvZy5iaW5kKGNvbnNvbGUpO1xuICAgIGxvZ0ZuLmFwcGx5KHNlbGYsIGFyZ3MpO1xuICB9XG4gIGVuYWJsZWQuZW5hYmxlZCA9IHRydWU7XG5cbiAgdmFyIGZuID0gZXhwb3J0cy5lbmFibGVkKG5hbWVzcGFjZSkgPyBlbmFibGVkIDogZGlzYWJsZWQ7XG5cbiAgZm4ubmFtZXNwYWNlID0gbmFtZXNwYWNlO1xuXG4gIHJldHVybiBmbjtcbn1cblxuLyoqXG4gKiBFbmFibGVzIGEgZGVidWcgbW9kZSBieSBuYW1lc3BhY2VzLiBUaGlzIGNhbiBpbmNsdWRlIG1vZGVzXG4gKiBzZXBhcmF0ZWQgYnkgYSBjb2xvbiBhbmQgd2lsZGNhcmRzLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lc3BhY2VzXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGVuYWJsZShuYW1lc3BhY2VzKSB7XG4gIGV4cG9ydHMuc2F2ZShuYW1lc3BhY2VzKTtcblxuICB2YXIgc3BsaXQgPSAobmFtZXNwYWNlcyB8fCAnJykuc3BsaXQoL1tcXHMsXSsvKTtcbiAgdmFyIGxlbiA9IHNwbGl0Lmxlbmd0aDtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgaWYgKCFzcGxpdFtpXSkgY29udGludWU7IC8vIGlnbm9yZSBlbXB0eSBzdHJpbmdzXG4gICAgbmFtZXNwYWNlcyA9IHNwbGl0W2ldLnJlcGxhY2UoL1xcKi9nLCAnLio/Jyk7XG4gICAgaWYgKG5hbWVzcGFjZXNbMF0gPT09ICctJykge1xuICAgICAgZXhwb3J0cy5za2lwcy5wdXNoKG5ldyBSZWdFeHAoJ14nICsgbmFtZXNwYWNlcy5zdWJzdHIoMSkgKyAnJCcpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZXhwb3J0cy5uYW1lcy5wdXNoKG5ldyBSZWdFeHAoJ14nICsgbmFtZXNwYWNlcyArICckJykpO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIERpc2FibGUgZGVidWcgb3V0cHV0LlxuICpcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZGlzYWJsZSgpIHtcbiAgZXhwb3J0cy5lbmFibGUoJycpO1xufVxuXG4vKipcbiAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgZ2l2ZW4gbW9kZSBuYW1lIGlzIGVuYWJsZWQsIGZhbHNlIG90aGVyd2lzZS5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZVxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZW5hYmxlZChuYW1lKSB7XG4gIHZhciBpLCBsZW47XG4gIGZvciAoaSA9IDAsIGxlbiA9IGV4cG9ydHMuc2tpcHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBpZiAoZXhwb3J0cy5za2lwc1tpXS50ZXN0KG5hbWUpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIGZvciAoaSA9IDAsIGxlbiA9IGV4cG9ydHMubmFtZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBpZiAoZXhwb3J0cy5uYW1lc1tpXS50ZXN0KG5hbWUpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG4vKipcbiAqIENvZXJjZSBgdmFsYC5cbiAqXG4gKiBAcGFyYW0ge01peGVkfSB2YWxcbiAqIEByZXR1cm4ge01peGVkfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gY29lcmNlKHZhbCkge1xuICBpZiAodmFsIGluc3RhbmNlb2YgRXJyb3IpIHJldHVybiB2YWwuc3RhY2sgfHwgdmFsLm1lc3NhZ2U7XG4gIHJldHVybiB2YWw7XG59XG4iLCIvKipcbiAqIEhlbHBlcnMuXG4gKi9cblxudmFyIHMgPSAxMDAwO1xudmFyIG0gPSBzICogNjA7XG52YXIgaCA9IG0gKiA2MDtcbnZhciBkID0gaCAqIDI0O1xudmFyIHkgPSBkICogMzY1LjI1O1xuXG4vKipcbiAqIFBhcnNlIG9yIGZvcm1hdCB0aGUgZ2l2ZW4gYHZhbGAuXG4gKlxuICogT3B0aW9uczpcbiAqXG4gKiAgLSBgbG9uZ2AgdmVyYm9zZSBmb3JtYXR0aW5nIFtmYWxzZV1cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ3xOdW1iZXJ9IHZhbFxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqIEByZXR1cm4ge1N0cmluZ3xOdW1iZXJ9XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odmFsLCBvcHRpb25zKXtcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gIGlmICgnc3RyaW5nJyA9PSB0eXBlb2YgdmFsKSByZXR1cm4gcGFyc2UodmFsKTtcbiAgcmV0dXJuIG9wdGlvbnMubG9uZ1xuICAgID8gbG9uZyh2YWwpXG4gICAgOiBzaG9ydCh2YWwpO1xufTtcblxuLyoqXG4gKiBQYXJzZSB0aGUgZ2l2ZW4gYHN0cmAgYW5kIHJldHVybiBtaWxsaXNlY29uZHMuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxuICogQHJldHVybiB7TnVtYmVyfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gcGFyc2Uoc3RyKSB7XG4gIHN0ciA9ICcnICsgc3RyO1xuICBpZiAoc3RyLmxlbmd0aCA+IDEwMDAwKSByZXR1cm47XG4gIHZhciBtYXRjaCA9IC9eKCg/OlxcZCspP1xcLj9cXGQrKSAqKG1pbGxpc2Vjb25kcz98bXNlY3M/fG1zfHNlY29uZHM/fHNlY3M/fHN8bWludXRlcz98bWlucz98bXxob3Vycz98aHJzP3xofGRheXM/fGR8eWVhcnM/fHlycz98eSk/JC9pLmV4ZWMoc3RyKTtcbiAgaWYgKCFtYXRjaCkgcmV0dXJuO1xuICB2YXIgbiA9IHBhcnNlRmxvYXQobWF0Y2hbMV0pO1xuICB2YXIgdHlwZSA9IChtYXRjaFsyXSB8fCAnbXMnKS50b0xvd2VyQ2FzZSgpO1xuICBzd2l0Y2ggKHR5cGUpIHtcbiAgICBjYXNlICd5ZWFycyc6XG4gICAgY2FzZSAneWVhcic6XG4gICAgY2FzZSAneXJzJzpcbiAgICBjYXNlICd5cic6XG4gICAgY2FzZSAneSc6XG4gICAgICByZXR1cm4gbiAqIHk7XG4gICAgY2FzZSAnZGF5cyc6XG4gICAgY2FzZSAnZGF5JzpcbiAgICBjYXNlICdkJzpcbiAgICAgIHJldHVybiBuICogZDtcbiAgICBjYXNlICdob3Vycyc6XG4gICAgY2FzZSAnaG91cic6XG4gICAgY2FzZSAnaHJzJzpcbiAgICBjYXNlICdocic6XG4gICAgY2FzZSAnaCc6XG4gICAgICByZXR1cm4gbiAqIGg7XG4gICAgY2FzZSAnbWludXRlcyc6XG4gICAgY2FzZSAnbWludXRlJzpcbiAgICBjYXNlICdtaW5zJzpcbiAgICBjYXNlICdtaW4nOlxuICAgIGNhc2UgJ20nOlxuICAgICAgcmV0dXJuIG4gKiBtO1xuICAgIGNhc2UgJ3NlY29uZHMnOlxuICAgIGNhc2UgJ3NlY29uZCc6XG4gICAgY2FzZSAnc2Vjcyc6XG4gICAgY2FzZSAnc2VjJzpcbiAgICBjYXNlICdzJzpcbiAgICAgIHJldHVybiBuICogcztcbiAgICBjYXNlICdtaWxsaXNlY29uZHMnOlxuICAgIGNhc2UgJ21pbGxpc2Vjb25kJzpcbiAgICBjYXNlICdtc2Vjcyc6XG4gICAgY2FzZSAnbXNlYyc6XG4gICAgY2FzZSAnbXMnOlxuICAgICAgcmV0dXJuIG47XG4gIH1cbn1cblxuLyoqXG4gKiBTaG9ydCBmb3JtYXQgZm9yIGBtc2AuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IG1zXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBzaG9ydChtcykge1xuICBpZiAobXMgPj0gZCkgcmV0dXJuIE1hdGgucm91bmQobXMgLyBkKSArICdkJztcbiAgaWYgKG1zID49IGgpIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gaCkgKyAnaCc7XG4gIGlmIChtcyA+PSBtKSByZXR1cm4gTWF0aC5yb3VuZChtcyAvIG0pICsgJ20nO1xuICBpZiAobXMgPj0gcykgcmV0dXJuIE1hdGgucm91bmQobXMgLyBzKSArICdzJztcbiAgcmV0dXJuIG1zICsgJ21zJztcbn1cblxuLyoqXG4gKiBMb25nIGZvcm1hdCBmb3IgYG1zYC5cbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gbXNcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGxvbmcobXMpIHtcbiAgcmV0dXJuIHBsdXJhbChtcywgZCwgJ2RheScpXG4gICAgfHwgcGx1cmFsKG1zLCBoLCAnaG91cicpXG4gICAgfHwgcGx1cmFsKG1zLCBtLCAnbWludXRlJylcbiAgICB8fCBwbHVyYWwobXMsIHMsICdzZWNvbmQnKVxuICAgIHx8IG1zICsgJyBtcyc7XG59XG5cbi8qKlxuICogUGx1cmFsaXphdGlvbiBoZWxwZXIuXG4gKi9cblxuZnVuY3Rpb24gcGx1cmFsKG1zLCBuLCBuYW1lKSB7XG4gIGlmIChtcyA8IG4pIHJldHVybjtcbiAgaWYgKG1zIDwgbiAqIDEuNSkgcmV0dXJuIE1hdGguZmxvb3IobXMgLyBuKSArICcgJyArIG5hbWU7XG4gIHJldHVybiBNYXRoLmNlaWwobXMgLyBuKSArICcgJyArIG5hbWUgKyAncyc7XG59XG4iLCIvKmpzaGludCBub2RlOiB0cnVlKi9cblxuLyoqXG4gKiBAYXV0aG9yIGJyb2xsYiAvIGh0dHBzOi8vZ2l0aHViL2Jyb2xsYlxuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBBdXRvUm91dGVyID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyJyksXG4gICAgYXNzZXJ0ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlV0aWxzJykuYXNzZXJ0O1xuXG52YXIgQXV0b1JvdXRlckFjdGlvbkFwcGxpZXIgPSBmdW5jdGlvbiAoKSB7XG59O1xuXG5BdXRvUm91dGVyQWN0aW9uQXBwbGllci5BdXRvUm91dGVyID0gQXV0b1JvdXRlcjtcblxuQXV0b1JvdXRlckFjdGlvbkFwcGxpZXIucHJvdG90eXBlLmluaXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5fcG9ydFNlcGFyYXRvciA9IHRoaXMuX3BvcnRTZXBhcmF0b3IgfHwgJ194Xyc7XG4gICAgdGhpcy5hdXRvcm91dGVyID0gbmV3IEF1dG9Sb3V0ZXIoKTtcbiAgICB0aGlzLmRlYnVnQWN0aW9uU2VxdWVuY2UgPSAnWyc7XG4gICAgdGhpcy5fY2xlYXJSZWNvcmRzKCk7XG59O1xuXG5BdXRvUm91dGVyQWN0aW9uQXBwbGllci5wcm90b3R5cGUuX2NsZWFyUmVjb3JkcyA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLl9hdXRvcm91dGVyQm94ZXMgPSB7fTsgIC8vIERlZmluZSBjb250YWluZXIgdGhhdCB3aWxsIG1hcCBvYmorc3ViSUQgLT4gYm94XG4gICAgdGhpcy5fYXV0b3JvdXRlclBvcnRzID0ge307ICAvLyBNYXBzIGJveElkcyB0byBhbiBhcnJheSBvZiBwb3J0IGlkcyB0aGF0IGhhdmUgYmVlbiBtYXBwZWRcbiAgICB0aGlzLl9hdXRvcm91dGVyUGF0aHMgPSB7fTtcbiAgICB0aGlzLl9hclBhdGhJZDJPcmlnaW5hbCA9IHt9O1xufTtcblxuLyoqXG4gKiBSZXBsYWNlIGlkIHN0b3JlZCBhdCB0aGUgZ2l2ZW4gaW5kaWNlcyBvZiB0aGUgYXJyYXkgd2l0aCB0aGUgaXRlbSBmcm9tIHRoZSBkaWN0aW9uYXJ5LlxuICpcbiAqIEBwYXJhbSB7RGljdGlvbmFyeX0gZGljdGlvbmFyeVxuICogQHBhcmFtIHtBcnJheX0gYXJyYXlcbiAqIEBwYXJhbSB7QXJyYXk8TnVtYmVyPn0gaW5kaWNlc1xuICogQHJldHVybiB7dW5kZWZpbmVkfVxuICovXG5BdXRvUm91dGVyQWN0aW9uQXBwbGllci5wcm90b3R5cGUuX2xvb2t1cEl0ZW0gPSBmdW5jdGlvbiAoZGljdGlvbmFyeSwgYXJyYXksIGluZGljZXMpIHsgIC8vIGpzaGludCBpZ25vcmU6bGluZVxuICAgIHZhciBpbmRleCxcbiAgICAgICAgaWQ7XG5cbiAgICBmb3IgKHZhciBpID0gMjsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpbmRleCA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgaWQgPSBhcnJheVtpbmRleF07XG4gICAgICAgIGFycmF5W2luZGV4XSA9IGRpY3Rpb25hcnlbaWRdO1xuICAgIH1cbn07XG5cbi8vIEZJWE1FOiBVcGRhdGUgdGhpcyBtZXRob2QgZm9yIG5ldyBhcGlcbkF1dG9Sb3V0ZXJBY3Rpb25BcHBsaWVyLnByb3RvdHlwZS5fZml4QXJncyA9IGZ1bmN0aW9uIChjb21tYW5kLCBhcmdzKSB7XG4gICAgdmFyIGlkO1xuICAgIC8vIEZpeCBhcmdzLCBpZiBuZWVkZWRcbiAgICBzd2l0Y2ggKGNvbW1hbmQpIHtcbiAgICAgICAgY2FzZSAnbW92ZSc6ICAvLyBhcmdzWzBdIGlzIGlkIHNob3VsZCBiZSB0aGUgYm94XG4gICAgICAgICAgICB0aGlzLl9sb29rdXBJdGVtKHRoaXMuX2F1dG9yb3V0ZXJCb3hlcywgYXJncywgMCk7XG4gICAgICAgICAgICBhcmdzWzBdID0gYXJnc1swXS5ib3g7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICdnZXRQYXRoUG9pbnRzJzpcbiAgICAgICAgICAgIHRoaXMuX2xvb2t1cEl0ZW0odGhpcy5fYXV0b3JvdXRlclBhdGhzLCBhcmdzLCAwKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ3NldFBhdGhDdXN0b21Qb2ludHMnOlxuICAgICAgICAgICAgaWQgPSBhcmdzWzBdLnBhdGg7XG4gICAgICAgICAgICBhcmdzWzBdLnBhdGggPSB0aGlzLl9hdXRvcm91dGVyUGF0aHNbaWRdO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAnc2V0Qm94UmVjdCc6XG4gICAgICAgICAgICB0aGlzLl9sb29rdXBJdGVtKHRoaXMuX2F1dG9yb3V0ZXJCb3hlcywgYXJncywgMCk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICdnZXRCb3hSZWN0JzpcbiAgICAgICAgICAgIHRoaXMuX2xvb2t1cEl0ZW0odGhpcy5fYXV0b3JvdXRlckJveGVzLCBhcmdzLCAwKTtcbiAgICAgICAgICAgIGFyZ3NbMF0gPSBhcmdzWzBdLmJveC5pZDtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ3VwZGF0ZVBvcnQnOlxuICAgICAgICAgICAgdGhpcy5fbG9va3VwSXRlbSh0aGlzLl9hdXRvcm91dGVyQm94ZXMsIGFyZ3MsIDApO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAnc2V0Q29tcG9uZW50JzpcbiAgICAgICAgICAgIHRoaXMuX2xvb2t1cEl0ZW0odGhpcy5fYXV0b3JvdXRlckJveGVzLCBhcmdzLCAwLCAxKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ2FkZFBhdGgnOlxuICAgICAgICAgICAgdGhpcy5fZml4UG9ydEFyZ3MoYXJnc1swXS5zcmMsIGFyZ3NbMF0uZHN0KTtcbiAgICAgICAgICAgIGFyZ3MucG9wKCk7ICAvLyBSZW1vdmUgdGhlIGNvbm5lY3Rpb24gaWRcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ3JlbW92ZSc6XG4gICAgICAgICAgICB2YXIgaXRlbTtcblxuICAgICAgICAgICAgaWQgPSBhcmdzWzBdO1xuICAgICAgICAgICAgaWYgKHRoaXMuX2F1dG9yb3V0ZXJCb3hlc1tpZF0pIHtcbiAgICAgICAgICAgICAgICBpdGVtID0gdGhpcy5fYXV0b3JvdXRlckJveGVzW2lkXTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5fYXV0b3JvdXRlclBhdGhzW2lkXSkge1xuICAgICAgICAgICAgICAgIGl0ZW0gPSB0aGlzLl9hdXRvcm91dGVyUGF0aHNbaWRdOyAgLy8gSWYgb2JqSWQgaXMgYSBjb25uZWN0aW9uXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGFyZ3NbMF0gPSBpdGVtO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAnYWRkQm94JzpcbiAgICAgICAgICAgIGFyZ3MucG9wKCk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgYnJlYWs7XG4gICAgfVxuXG59O1xuXG5BdXRvUm91dGVyQWN0aW9uQXBwbGllci5wcm90b3R5cGUuX2ZpeFBvcnRBcmdzID0gZnVuY3Rpb24gKHBvcnQxLCBwb3J0MikgeyAvLyBqc2hpbnQgaWdub3JlOmxpbmVcbiAgICB2YXIgcG9ydElkLFxuICAgICAgICBwb3J0SWRzLFxuICAgICAgICBhclBvcnRJZCxcbiAgICAgICAgYm94SWQsXG4gICAgICAgIHBvcnRzO1xuXG4gICAgZm9yICh2YXIgaSA9IGFyZ3VtZW50cy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgcG9ydHMgPSBhcmd1bWVudHNbaV07XG4gICAgICAgIHBvcnRJZHMgPSBPYmplY3Qua2V5cyhwb3J0cyk7XG4gICAgICAgIGZvciAodmFyIGogPSBwb3J0SWRzLmxlbmd0aDsgai0tOykge1xuICAgICAgICAgICAgcG9ydElkID0gcG9ydElkc1tqXTtcbiAgICAgICAgICAgIGJveElkID0gcG9ydHNbcG9ydElkXTtcblxuICAgICAgICAgICAgYXJQb3J0SWQgPSB0aGlzLmF1dG9yb3V0ZXIuZ2V0UG9ydElkKHBvcnRJZCwgdGhpcy5fYXV0b3JvdXRlckJveGVzW2JveElkXSk7XG4gICAgICAgICAgICBwb3J0c1twb3J0SWRdID0gdGhpcy5fYXV0b3JvdXRlckJveGVzW2JveElkXS5wb3J0c1thclBvcnRJZF07XG4gICAgICAgICAgICBhc3NlcnQodGhpcy5fYXV0b3JvdXRlckJveGVzW2JveElkXS5wb3J0c1thclBvcnRJZF0sICdBUiBQb3J0IG5vdCBmb3VuZCEnKTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbi8qKlxuICogSW52b2tlIGFuIEF1dG9Sb3V0ZXIgbWV0aG9kLiBUaGlzIGFsbG93cyB0aGUgYWN0aW9uIHRvIGJlIGxvZ2dlZCBhbmQgYnVncyByZXBsaWNhdGVkLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBjb21tYW5kXG4gKiBAcGFyYW0ge0FycmF5fSBhcmdzXG4gKiBAcmV0dXJuIHt1bmRlZmluZWR9XG4gKi9cbkF1dG9Sb3V0ZXJBY3Rpb25BcHBsaWVyLnByb3RvdHlwZS5faW52b2tlQXV0b1JvdXRlck1ldGhvZCA9IGZ1bmN0aW9uIChjb21tYW5kLCBhcmdzKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ludm9rZUF1dG9Sb3V0ZXJNZXRob2RVbnNhZmUoY29tbWFuZCwgYXJncyk7XG5cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHRoaXMubG9nZ2VyLmVycm9yKCdBdXRvUm91dGVyLicgKyBjb21tYW5kICsgJyBmYWlsZWQgd2l0aCBlcnJvcjogJyArIGUpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJBY3Rpb25BcHBsaWVyLnByb3RvdHlwZS5faW52b2tlQXV0b1JvdXRlck1ldGhvZFVuc2FmZSA9IGZ1bmN0aW9uIChjb21tYW5kLCBhcmdzKSB7XG4gICAgdmFyIHJlc3VsdCxcbiAgICAgICAgb2xkQXJncyA9IGFyZ3Muc2xpY2UoKTtcblxuICAgIGlmICh0aGlzLl9yZWNvcmRBY3Rpb25zKSB7XG4gICAgICAgIHRoaXMuX3JlY29yZEFjdGlvbihjb21tYW5kLCBhcmdzLnNsaWNlKCkpO1xuICAgIH1cblxuICAgIC8vIFNvbWUgYXJndW1lbnRzIGFyZSBzaW1wbHkgaWRzIGZvciBlYXNpZXIgcmVjb3JkaW5nXG4gICAgdGhpcy5fZml4QXJncyhjb21tYW5kLCBhcmdzKTtcblxuICAgIHJlc3VsdCA9IHRoaXMuYXV0b3JvdXRlcltjb21tYW5kXS5hcHBseSh0aGlzLmF1dG9yb3V0ZXIsIGFyZ3MpO1xuICAgIHRoaXMuX3VwZGF0ZVJlY29yZHMoY29tbWFuZCwgb2xkQXJncywgcmVzdWx0KTtcbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxuQXV0b1JvdXRlckFjdGlvbkFwcGxpZXIucHJvdG90eXBlLl91cGRhdGVSZWNvcmRzID0gZnVuY3Rpb24gKGNvbW1hbmQsIGlucHV0LCByZXN1bHQpIHtcbiAgICBhc3NlcnQgKGlucHV0IGluc3RhbmNlb2YgQXJyYXkpO1xuICAgIHZhciBpZCxcbiAgICAgICAgYXJncyA9IGlucHV0LnNsaWNlKCksXG4gICAgICAgIGk7XG5cbiAgICBzd2l0Y2ggKGNvbW1hbmQpIHtcbiAgICAgICAgY2FzZSAnYWRkUGF0aCc6XG4gICAgICAgICAgICBpZCA9IGFyZ3MucG9wKCk7XG4gICAgICAgICAgICB0aGlzLl9hdXRvcm91dGVyUGF0aHNbaWRdID0gcmVzdWx0O1xuICAgICAgICAgICAgdGhpcy5fYXJQYXRoSWQyT3JpZ2luYWxbcmVzdWx0XSA9IGlkO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAnYWRkQm94JzpcbiAgICAgICAgICAgIGlkID0gYXJncy5wb3AoKTtcbiAgICAgICAgICAgIHRoaXMuX2F1dG9yb3V0ZXJCb3hlc1tpZF0gPSByZXN1bHQ7XG5cbiAgICAgICAgICAgIC8vIEFkZCBwb3J0c1xuICAgICAgICAgICAgdGhpcy5fYXV0b3JvdXRlclBvcnRzW2lkXSA9IFtdO1xuICAgICAgICAgICAgdmFyIGlkcyA9IE9iamVjdC5rZXlzKHJlc3VsdC5wb3J0cyk7XG4gICAgICAgICAgICBmb3IgKGkgPSBpZHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYXV0b3JvdXRlclBvcnRzW2lkXS5wdXNoKHJlc3VsdC5wb3J0c1tpZHNbaV1dKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ3JlbW92ZSc6XG4gICAgICAgICAgICBpZCA9IGFyZ3NbMF07XG4gICAgICAgICAgICBpZiAodGhpcy5fYXV0b3JvdXRlckJveGVzW2lkXSkge1xuICAgICAgICAgICAgICAgIGkgPSB0aGlzLl9hdXRvcm91dGVyUG9ydHNbaWRdID8gdGhpcy5fYXV0b3JvdXRlclBvcnRzW2lkXS5sZW5ndGggOiAwO1xuICAgICAgICAgICAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHBvcnRJZCA9IGlkICsgdGhpcy5fcG9ydFNlcGFyYXRvciArIHRoaXMuX2F1dG9yb3V0ZXJQb3J0c1tpZF1baV07IC8vSUQgb2YgY2hpbGQgcG9ydFxuICAgICAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5fYXV0b3JvdXRlckJveGVzW3BvcnRJZF07XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2F1dG9yb3V0ZXJCb3hlc1tpZF07XG4gICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2F1dG9yb3V0ZXJQb3J0c1tpZF07XG5cbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5fYXV0b3JvdXRlclBhdGhzW2lkXSkge1xuICAgICAgICAgICAgICAgIHZhciBhcklkID0gdGhpcy5fYXV0b3JvdXRlclBhdGhzW2lkXTtcbiAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5fYXV0b3JvdXRlclBhdGhzW2lkXTtcbiAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5fYXJQYXRoSWQyT3JpZ2luYWxbYXJJZF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICdzZXRDb21wb25lbnQnOlxuICAgICAgICAgICAgdmFyIGxlbixcbiAgICAgICAgICAgICAgICBzdWJDb21wSWQ7XG5cbiAgICAgICAgICAgIGlkID0gYXJnc1swXTtcbiAgICAgICAgICAgIGxlbiA9IGlkLmxlbmd0aCArIHRoaXMuX3BvcnRTZXBhcmF0b3IubGVuZ3RoO1xuICAgICAgICAgICAgc3ViQ29tcElkID0gYXJnc1sxXS5zdWJzdHJpbmcobGVuKTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuX2F1dG9yb3V0ZXJQb3J0c1tpZF0uaW5kZXhPZihzdWJDb21wSWQpID09PSAtMSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2F1dG9yb3V0ZXJQb3J0c1tpZF0ucHVzaChzdWJDb21wSWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAndXBkYXRlUG9ydCc6XG4gICAgICAgICAgICBpZCA9IGFyZ3NbMV0uaWQ7XG4gICAgICAgICAgICBicmVhaztcbiAgICB9XG59O1xuXG4vKipcbiAqIEFkZCB0aGUgZ2l2ZW4gYWN0aW9uIHRvIHRoZSBjdXJyZW50IHNlcXVlbmNlIG9mIGF1dG9yb3V0ZXIgY29tbWFuZHMuXG4gKlxuICogQHBhcmFtIG9iaklkXG4gKiBAcGFyYW0gc3ViQ29tcElkXG4gKiBAcmV0dXJuIHt1bmRlZmluZWR9XG4gKi9cbkF1dG9Sb3V0ZXJBY3Rpb25BcHBsaWVyLnByb3RvdHlwZS5fcmVjb3JkQWN0aW9uID0gZnVuY3Rpb24gKGNvbW1hbmQsIGFyZ3MpIHtcblxuICAgIHZhciBhY3Rpb24gPSB7YWN0aW9uOiBjb21tYW5kLCBhcmdzOiBhcmdzfSxcbiAgICAgICAgY2lyY3VsYXJGaXhlciA9IGZ1bmN0aW9uIChrZXksIHZhbHVlKSB7XG4gICAgICAgICAgICBpZiAodmFsdWUgJiYgdmFsdWUub3duZXIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWUuaWQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICAgICAgfTtcblxuICAgIHRoaXMuZGVidWdBY3Rpb25TZXF1ZW5jZSArPSBKU09OLnN0cmluZ2lmeShhY3Rpb24sIGNpcmN1bGFyRml4ZXIpICsgJywnO1xufTtcblxuQXV0b1JvdXRlckFjdGlvbkFwcGxpZXIucHJvdG90eXBlLl9nZXRBY3Rpb25TZXF1ZW5jZSA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgaW5kZXggPSB0aGlzLmRlYnVnQWN0aW9uU2VxdWVuY2UubGFzdEluZGV4T2YoJywnKSxcbiAgICAgICAgcmVzdWx0ID0gdGhpcy5kZWJ1Z0FjdGlvblNlcXVlbmNlLnN1YnN0cmluZygwLCBpbmRleCkgKyAnXSc7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBdXRvUm91dGVyQWN0aW9uQXBwbGllcjtcbiIsIi8qanNoaW50IG5vZGU6IHRydWUqL1xuXG4vKipcbiAqIEBhdXRob3IgYnJvbGxiIC8gaHR0cHM6Ly9naXRodWIvYnJvbGxiXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgQ09OU1RBTlRTID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLkNvbnN0YW50cycpLFxuICAgIFV0aWxzID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlV0aWxzJyksXG4gICAgYXNzZXJ0ID0gVXRpbHMuYXNzZXJ0LFxuICAgIEFyUG9pbnQgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUG9pbnQnKSxcbiAgICBBclJlY3QgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUmVjdCcpLFxuICAgIEF1dG9Sb3V0ZXJQb3J0ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlBvcnQnKTtcblxuXG52YXIgQXV0b1JvdXRlckJveCA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLm93bmVyID0gbnVsbDtcbiAgICB0aGlzLnJlY3QgPSBuZXcgQXJSZWN0KCk7XG4gICAgdGhpcy5hdG9taWMgPSBmYWxzZTtcbiAgICB0aGlzLnNlbGZQb2ludHMgPSBbXTtcbiAgICB0aGlzLnBvcnRzID0gW107XG4gICAgdGhpcy5jaGlsZEJveGVzID0gW107Ly9kZXBlbmRlbnQgYm94ZXNcbiAgICB0aGlzLnBhcmVudCA9IG51bGw7XG4gICAgdGhpcy5pZCA9IG51bGw7XG5cbiAgICB0aGlzLmNhbGN1bGF0ZVNlbGZQb2ludHMoKTsgLy9QYXJ0IG9mIGluaXRpYWxpemF0aW9uXG59O1xuXG5BdXRvUm91dGVyQm94LnByb3RvdHlwZS5jYWxjdWxhdGVTZWxmUG9pbnRzID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuc2VsZlBvaW50cyA9IFtdO1xuICAgIHRoaXMuc2VsZlBvaW50cy5wdXNoKG5ldyBBclBvaW50KHRoaXMucmVjdC5nZXRUb3BMZWZ0KCkpKTtcblxuICAgIHRoaXMuc2VsZlBvaW50cy5wdXNoKG5ldyBBclBvaW50KHRoaXMucmVjdC5yaWdodCwgdGhpcy5yZWN0LmNlaWwpKTtcbiAgICB0aGlzLnNlbGZQb2ludHMucHVzaChuZXcgQXJQb2ludCh0aGlzLnJlY3QucmlnaHQsIHRoaXMucmVjdC5mbG9vcikpO1xuICAgIHRoaXMuc2VsZlBvaW50cy5wdXNoKG5ldyBBclBvaW50KHRoaXMucmVjdC5sZWZ0LCB0aGlzLnJlY3QuZmxvb3IpKTtcbn07XG5cbkF1dG9Sb3V0ZXJCb3gucHJvdG90eXBlLmRlbGV0ZUFsbFBvcnRzID0gZnVuY3Rpb24gKCkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5wb3J0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICB0aGlzLnBvcnRzW2ldLmRlc3Ryb3koKTtcbiAgICB9XG5cbiAgICB0aGlzLnBvcnRzID0gW107XG5cbiAgICB0aGlzLmF0b21pYyA9IGZhbHNlO1xufTtcblxuQXV0b1JvdXRlckJveC5wcm90b3R5cGUuaGFzT3duZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMub3duZXIgIT09IG51bGw7XG59O1xuXG4vLyBUT0RPOiBSZW1vdmUgdGhpcyBmdW5jdGlvblxuQXV0b1JvdXRlckJveC5wcm90b3R5cGUuY3JlYXRlUG9ydCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgcG9ydCA9IG5ldyBBdXRvUm91dGVyUG9ydCgpO1xuICAgIGFzc2VydChwb3J0ICE9PSBudWxsLCAnQVJCb3guY3JlYXRlUG9ydDogcG9ydCAhPT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIHJldHVybiBwb3J0O1xufTtcblxuQXV0b1JvdXRlckJveC5wcm90b3R5cGUuaGFzTm9Qb3J0ID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLnBvcnRzLmxlbmd0aCA9PT0gMDtcbn07XG5cbkF1dG9Sb3V0ZXJCb3gucHJvdG90eXBlLmlzQXRvbWljID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmF0b21pYztcbn07XG5cbkF1dG9Sb3V0ZXJCb3gucHJvdG90eXBlLmFkZFBvcnQgPSBmdW5jdGlvbiAocG9ydCkge1xuICAgIGFzc2VydChwb3J0ICE9PSBudWxsLCAnQVJCb3guYWRkUG9ydDogcG9ydCAhPT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIHBvcnQub3duZXIgPSB0aGlzO1xuICAgIHRoaXMucG9ydHMucHVzaChwb3J0KTtcblxuICAgIGlmICh0aGlzLm93bmVyKSB7ICAvLyBOb3QgcG9pbnRpbmcgdG8gdGhlIEFSR3JhcGhcbiAgICAgICAgdGhpcy5vd25lci5fYWRkUG9ydEVkZ2VzKHBvcnQpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJCb3gucHJvdG90eXBlLmRlbGV0ZVBvcnQgPSBmdW5jdGlvbiAocG9ydCkge1xuICAgIGFzc2VydChwb3J0ICE9PSBudWxsLCAnQVJCb3guZGVsZXRlUG9ydDogcG9ydCAhPT0gbnVsbCBGQUlMRUQnKTtcbiAgICBpZiAocG9ydCA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGluZGV4ID0gdGhpcy5wb3J0cy5pbmRleE9mKHBvcnQpLFxuICAgICAgICBncmFwaCA9IHRoaXMub3duZXI7XG5cbiAgICBhc3NlcnQoaW5kZXggIT09IC0xLCAnQVJCb3guZGVsZXRlUG9ydDogaW5kZXggIT09IC0xIEZBSUxFRCcpO1xuXG4gICAgZ3JhcGguZGVsZXRlRWRnZXMocG9ydCk7XG4gICAgdGhpcy5wb3J0cy5zcGxpY2UoaW5kZXgsIDEpO1xuXG4gICAgdGhpcy5hdG9taWMgPSBmYWxzZTtcblxufTtcblxuQXV0b1JvdXRlckJveC5wcm90b3R5cGUuaXNSZWN0RW1wdHkgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMucmVjdC5pc1JlY3RFbXB0eSgpO1xufTtcblxuQXV0b1JvdXRlckJveC5wcm90b3R5cGUuc2V0UmVjdCA9IGZ1bmN0aW9uIChyKSB7XG4gICAgYXNzZXJ0KHIgaW5zdGFuY2VvZiBBclJlY3QsICdJbnZhbHRoaXMuaWQgYXJnIGluIEFSQm94LnNldFJlY3QuIFJlcXVpcmVzIEFyUmVjdCcpO1xuXG4gICAgYXNzZXJ0KHIuZ2V0V2lkdGgoKSA+PSAzICYmIHIuZ2V0SGVpZ2h0KCkgPj0gMyxcbiAgICAgICAgJ0FSQm94LnNldFJlY3Q6IHIuZ2V0V2lkdGgoKSA+PSAzICYmIHIuZ2V0SGVpZ2h0KCkgPj0gMyBGQUlMRUQhJyk7XG5cbiAgICBhc3NlcnQoci5nZXRUb3BMZWZ0KCkueCA+PSBDT05TVEFOVFMuRURfTUlOQ09PUkQgJiYgci5nZXRUb3BMZWZ0KCkueSA+PSBDT05TVEFOVFMuRURfTUlOQ09PUkQsXG4gICAgICAgICdBUkJveC5zZXRSZWN0OiByLmdldFRvcExlZnQoKS54ID49IENPTlNUQU5UUy5FRF9NSU5DT09SRCAmJiByLmdldFRvcExlZnQoKS55ID49ICcgK1xuICAgICAgICAnQ09OU1RBTlRTLkVEX01BWENPT1JEIEZBSUxFRCEnKTtcblxuICAgIGFzc2VydChyLmdldEJvdHRvbVJpZ2h0KCkueCA8PSBDT05TVEFOVFMuRURfTUFYQ09PUkQgJiYgci5nZXRCb3R0b21SaWdodCgpLnkgPD0gQ09OU1RBTlRTLkVEX01BWENPT1JELFxuICAgICAgICAnQVJCb3guc2V0UmVjdDogIHIuZ2V0Qm90dG9tUmlnaHQoKS54IDw9IENPTlNUQU5UUy5FRF9NQVhDT09SRCAmJiByLmdldEJvdHRvbVJpZ2h0KCkueSA8PSAnICtcbiAgICAgICAgJ0NPTlNUQU5UUy5FRF9NQVhDT09SRCBGQUlMRUQhJyk7XG5cbiAgICB0aGlzLnJlY3QuYXNzaWduKHIpO1xuICAgIHRoaXMuY2FsY3VsYXRlU2VsZlBvaW50cygpO1xuXG4gICAgaWYgKHRoaXMuYXRvbWljKSB7XG4gICAgICAgIGFzc2VydCh0aGlzLnBvcnRzLmxlbmd0aCA9PT0gMSwgJ0FSQm94LnNldFJlY3Q6IHRoaXMucG9ydHMubGVuZ3RoID09PSAxIEZBSUxFRCEnKTtcbiAgICAgICAgdGhpcy5wb3J0c1swXS5zZXRSZWN0KHIpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJCb3gucHJvdG90eXBlLnNoaWZ0QnkgPSBmdW5jdGlvbiAob2Zmc2V0KSB7XG4gICAgdGhpcy5yZWN0LmFkZChvZmZzZXQpO1xuXG4gICAgdmFyIGkgPSB0aGlzLnBvcnRzLmxlbmd0aDtcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgIHRoaXMucG9ydHNbaV0uc2hpZnRCeShvZmZzZXQpO1xuICAgIH1cblxuICAgIC8qXG4gICAgIFRoaXMgaXMgbm90IG5lY2Vzc2FyeTsgdGhlIEFSR3JhcGggd2lsbCBzaGlmdCBhbGwgY2hpbGRyZW5cbiAgICAgaSA9IHRoaXMuY2hpbGRCb3hlcy5sZW5ndGg7XG4gICAgIHdoaWxlKGktLSl7XG4gICAgIHRoaXMuY2hpbGRCb3hlc1tpXS5zaGlmdEJ5KG9mZnNldCk7XG4gICAgIH1cbiAgICAgKi9cbiAgICB0aGlzLmNhbGN1bGF0ZVNlbGZQb2ludHMoKTtcbn07XG5cbkF1dG9Sb3V0ZXJCb3gucHJvdG90eXBlLnJlc2V0UG9ydEF2YWlsYWJpbGl0eSA9IGZ1bmN0aW9uICgpIHtcbiAgICBmb3IgKHZhciBpID0gdGhpcy5wb3J0cy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgdGhpcy5wb3J0c1tpXS5yZXNldEF2YWlsYWJsZUFyZWEoKTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyQm94LnByb3RvdHlwZS5hZGp1c3RQb3J0QXZhaWxhYmlsaXR5ID0gZnVuY3Rpb24gKGJveCkge1xuICAgIGlmICghYm94Lmhhc0FuY2VzdG9yV2l0aElkKHRoaXMuaWQpICYmICAgLy8gQm94ZXMgYXJlIG5vdCBkZXBlbmRlbnQgb24gb25lIGFub3RoZXJcbiAgICAgICAgIXRoaXMuaGFzQW5jZXN0b3JXaXRoSWQoYm94LmlkKSkge1xuXG4gICAgICAgIGZvciAodmFyIGkgPSB0aGlzLnBvcnRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICAgICAgdGhpcy5wb3J0c1tpXS5hZGp1c3RBdmFpbGFibGVBcmVhKGJveC5yZWN0KTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJCb3gucHJvdG90eXBlLmFkZENoaWxkID0gZnVuY3Rpb24gKGJveCkge1xuICAgIGFzc2VydCh0aGlzLmNoaWxkQm94ZXMuaW5kZXhPZihib3gpID09PSAtMSxcbiAgICAgICAgJ0FSQm94LmFkZENoaWxkOiBib3ggYWxyZWFkeSBpcyBjaGlsZCBvZiAnICsgdGhpcy5pZCk7XG4gICAgYXNzZXJ0KGJveCBpbnN0YW5jZW9mIEF1dG9Sb3V0ZXJCb3gsXG4gICAgICAgICdDaGlsZCBib3ggbXVzdCBiZSBvZiB0eXBlIEF1dG9Sb3V0ZXJCb3gnKTtcblxuICAgIHRoaXMuY2hpbGRCb3hlcy5wdXNoKGJveCk7XG4gICAgYm94LnBhcmVudCA9IHRoaXM7XG59O1xuXG5BdXRvUm91dGVyQm94LnByb3RvdHlwZS5yZW1vdmVDaGlsZCA9IGZ1bmN0aW9uIChib3gpIHtcbiAgICB2YXIgaSA9IHRoaXMuY2hpbGRCb3hlcy5pbmRleE9mKGJveCk7XG4gICAgYXNzZXJ0KGkgIT09IC0xLCAnQVJCb3gucmVtb3ZlQ2hpbGQ6IGJveCBpc25cXCd0IGNoaWxkIG9mICcgKyB0aGlzLmlkKTtcbiAgICB0aGlzLmNoaWxkQm94ZXMuc3BsaWNlKGksIDEpO1xuICAgIGJveC5wYXJlbnQgPSBudWxsO1xufTtcblxuQXV0b1JvdXRlckJveC5wcm90b3R5cGUuaGFzQW5jZXN0b3JXaXRoSWQgPSBmdW5jdGlvbiAoaWQpIHtcbiAgICB2YXIgYm94ID0gdGhpcztcbiAgICB3aGlsZSAoYm94KSB7XG4gICAgICAgIGlmIChib3guaWQgPT09IGlkKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBib3ggPSBib3gucGFyZW50O1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG59O1xuXG5BdXRvUm91dGVyQm94LnByb3RvdHlwZS5nZXRSb290Qm94ID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBib3ggPSB0aGlzO1xuICAgIHdoaWxlIChib3gucGFyZW50KSB7XG4gICAgICAgIGJveCA9IGJveC5wYXJlbnQ7XG4gICAgfVxuICAgIHJldHVybiBib3g7XG59O1xuXG5BdXRvUm91dGVyQm94LnByb3RvdHlwZS5pc0JveEF0ID0gZnVuY3Rpb24gKHBvaW50LCBuZWFybmVzcykge1xuICAgIHJldHVybiBVdGlscy5pc1BvaW50SW4ocG9pbnQsIHRoaXMucmVjdCwgbmVhcm5lc3MpO1xufTtcblxuQXV0b1JvdXRlckJveC5wcm90b3R5cGUuaXNCb3hDbGlwID0gZnVuY3Rpb24gKHIpIHtcbiAgICByZXR1cm4gVXRpbHMuaXNSZWN0Q2xpcCh0aGlzLnJlY3QsIHIpO1xufTtcblxuQXV0b1JvdXRlckJveC5wcm90b3R5cGUuaXNCb3hJbiA9IGZ1bmN0aW9uIChyKSB7XG4gICAgcmV0dXJuIFV0aWxzLmlzUmVjdEluKHRoaXMucmVjdCwgcik7XG59O1xuXG5BdXRvUm91dGVyQm94LnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBpID0gdGhpcy5jaGlsZEJveGVzLmxlbmd0aDtcblxuICAgIC8vbm90aWZ5IHRoaXMucGFyZW50IG9mIGRlc3RydWN0aW9uXG4gICAgLy9pZiB0aGVyZSBpcyBhIHRoaXMucGFyZW50LCBvZiBjb3Vyc2VcbiAgICBpZiAodGhpcy5wYXJlbnQpIHtcbiAgICAgICAgdGhpcy5wYXJlbnQucmVtb3ZlQ2hpbGQodGhpcyk7XG4gICAgfVxuXG4gICAgdGhpcy5vd25lciA9IG51bGw7XG4gICAgdGhpcy5kZWxldGVBbGxQb3J0cygpO1xuXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgICB0aGlzLmNoaWxkQm94ZXNbaV0uZGVzdHJveSgpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJCb3gucHJvdG90eXBlLmFzc2VydFZhbGlkID0gZnVuY3Rpb24gKCkge1xuICAgIGZvciAodmFyIHAgPSB0aGlzLnBvcnRzLmxlbmd0aDsgcC0tOykge1xuICAgICAgICB0aGlzLnBvcnRzW3BdLmFzc2VydFZhbGlkKCk7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBdXRvUm91dGVyQm94O1xuIiwiLypqc2hpbnQgbm9kZTogdHJ1ZSwgYml0d2lzZTogZmFsc2UqL1xuXG4vKipcbiAqIEBhdXRob3IgYnJvbGxiIC8gaHR0cHM6Ly9naXRodWIvYnJvbGxiXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xudmFyIEFyUG9pbnQgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUG9pbnQnKTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgRU1QVFlfUE9JTlQ6IG5ldyBBclBvaW50KC0xMDAwMDAsIC0xMDAwMDApLFxuICAgIEVEX01BWENPT1JEOiAxMDAwMDAsXG4gICAgRURfTUlOQ09PUkQ6IC0yLC8vVGhpcyBhbGxvd3MgY29ubmVjdGlvbnMgdG8gYmUgc3RpbGwgYmUgZHJhdyB3aGVuIGJveCBpcyBwcmVzc2VkIGFnYWluc3QgdGhlIGVkZ2VcbiAgICBFRF9TTUFMTEdBUDogMTUsXG4gICAgQ09OTkVDVElPTkNVU1RPTUlaQVRJT05EQVRBVkVSU0lPTjogMCxcbiAgICBFTVBUWUNPTk5FQ1RJT05DVVNUT01JWkFUSU9OREFUQU1BR0lDOiAtMSxcbiAgICBERUJVRzogZmFsc2UsXG4gICAgQlVGRkVSOiAxMCxcblxuICAgIEVETFNfUzogMTUsLy9FRF9TTUFMTEdBUFxuICAgIEVETFNfUjogMTUgKyAxLCAvL0VEX1NNQUxMR0FQKzFcbiAgICBFRExTX0Q6IDEwMDAwMCArIDIsLy9FRF9NQVhDT09SRCAtIEVEX01JTkNPT1JELFxuXG4gICAgUGF0aEVuZE9uRGVmYXVsdDogMHgwMDAwLFxuICAgIFBhdGhFbmRPblRvcDogMHgwMDEwLFxuICAgIFBhdGhFbmRPblJpZ2h0OiAweDAwMjAsXG4gICAgUGF0aEVuZE9uQm90dG9tOiAweDAwNDAsXG4gICAgUGF0aEVuZE9uTGVmdDogMHgwMDgwLFxuICAgIFBhdGhFbmRNYXNrOiAoMHgwMDEwIHwgMHgwMDIwIHwgMHgwMDQwIHwgMHgwMDgwKSxcbiAgICAvLyAoUGF0aEVuZE9uVG9wIHwgUGF0aEVuZE9uUmlnaHQgfCBQYXRoRW5kT25Cb3R0b20gfCBQYXRoRW5kT25MZWZ0KSxcblxuICAgIFBhdGhTdGFydE9uRGVmYXVsdDogMHgwMDAwLFxuICAgIFBhdGhTdGFydE9uVG9wOiAweDAxMDAsXG4gICAgUGF0aFN0YXJ0T25SaWdodDogMHgwMjAwLFxuICAgIFBhdGhTdGFydE9uQm90dG9tOiAweDA0MDAsXG4gICAgUGF0aFN0YXJ0T25MZWZ0OiAweDA4MDAsXG4gICAgUGF0aFN0YXJ0TWFzazogKDB4MDEwMCB8IDB4MDIwMCB8IDB4MDQwMCB8IDB4MDgwMCksXG4gICAgLy8gKFBhdGhTdGFydE9uVG9wIHwgUGF0aFN0YXJ0T25SaWdodCB8IFBhdGhTdGFydE9uQm90dG9tIHwgUGF0aFN0YXJ0T25MZWZ0KSxcblxuICAgIFBhdGhIaWdoTGlnaHRlZDogMHgwMDAyLFx0XHQvLyBhdHRyaWJ1dGVzLFxuICAgIFBhdGhGaXhlZDogMHgwMDAxLFxuICAgIFBhdGhEZWZhdWx0OiAweDAwMDAsXG5cbiAgICBQYXRoU3RhdGVDb25uZWN0ZWQ6IDB4MDAwMSxcdFx0Ly8gc3RhdGVzLFxuICAgIFBhdGhTdGF0ZURlZmF1bHQ6IDB4MDAwMCxcblxuICAgIC8vIFBvcnQgQ29ubmVjdGlvbiBWYXJpYWJsZXNcbiAgICBQb3J0RW5kT25Ub3A6IDB4MDAwMSxcbiAgICBQb3J0RW5kT25SaWdodDogMHgwMDAyLFxuICAgIFBvcnRFbmRPbkJvdHRvbTogMHgwMDA0LFxuICAgIFBvcnRFbmRPbkxlZnQ6IDB4MDAwOCxcbiAgICBQb3J0RW5kT25BbGw6IDB4MDAwRixcblxuICAgIFBvcnRTdGFydE9uVG9wOiAweDAwMTAsXG4gICAgUG9ydFN0YXJ0T25SaWdodDogMHgwMDIwLFxuICAgIFBvcnRTdGFydE9uQm90dG9tOiAweDAwNDAsXG4gICAgUG9ydFN0YXJ0T25MZWZ0OiAweDAwODAsXG4gICAgUG9ydFN0YXJ0T25BbGw6IDB4MDBGMCxcblxuICAgIFBvcnRDb25uZWN0T25BbGw6IDB4MDBGRixcbiAgICBQb3J0Q29ubmVjdFRvQ2VudGVyOiAweDAxMDAsXG5cbiAgICBQb3J0U3RhcnRFbmRIb3Jpem9udGFsOiAweDAwQUEsXG4gICAgUG9ydFN0YXJ0RW5kVmVydGljYWw6IDB4MDA1NSxcblxuICAgIFBvcnREZWZhdWx0OiAweDAwRkYsXG5cbiAgICAvLyBSb3V0aW5nRGlyZWN0aW9uIHZhcnMgXG4gICAgRGlyTm9uZTogLTEsXG4gICAgRGlyVG9wOiAwLFxuICAgIERpclJpZ2h0OiAxLFxuICAgIERpckJvdHRvbTogMixcbiAgICBEaXJMZWZ0OiAzLFxuICAgIERpclNrZXc6IDQsXG5cbiAgICAvL1BhdGggQ3VzdG9tIERhdGFcbiAgICBTaW1wbGVFZGdlRGlzcGxhY2VtZW50OiAnRWRnZURpc3BsYWNlbWVudCcsXG4gICAgQ3VzdG9tUG9pbnRDdXN0b21pemF0aW9uOiAnUG9pbnRDdXN0b21pemF0aW9uJ1xuICAgIC8vQ09OTkVDVElPTkNVU1RPTUlaQVRJT05EQVRBVkVSU0lPTiA6IG51bGxcbn07XG4iLCIvKmdsb2JhbHMgZGVmaW5lKi9cbi8qanNoaW50IG5vZGU6IHRydWUqL1xuXG4vKipcbiAqIEBhdXRob3IgYnJvbGxiIC8gaHR0cHM6Ly9naXRodWIvYnJvbGxiXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgQ09OU1RBTlRTID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLkNvbnN0YW50cycpLFxuICAgIFV0aWxzID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlV0aWxzJyksXG4gICAgYXNzZXJ0ID0gVXRpbHMuYXNzZXJ0LFxuICAgIEFyUG9pbnQgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUG9pbnQnKTtcblxudmFyIEF1dG9Sb3V0ZXJFZGdlID0gZnVuY3Rpb24gKCkge1xuICAgIC8qXG4gICAgIEluIHRoaXMgc2VjdGlvbiBldmVyeSBjb21tZW50IHJlZmVyIHRvIHRoZSBob3Jpem9udGFsIGNhc2UsIHRoYXQgaXMsIGVhY2hcdGVkZ2UgaXNcbiAgICAgaG9yaXpvbnRhbC5cbiAgICAgKi9cblxuICAgIC8qXG4gICAgICogVE9ETyBVcGRhdGUgdGhpcyBjb21tZW50XG4gICAgICpcbiAgICAgRXZlcnkgQ0F1dG9Sb3V0ZXJFZGdlIGJlbG9uZ3MgdG8gYW4gZWRnZSBvZiBhIENBdXRvUm91dGVyUGF0aCwgQ0F1dG9Sb3V0ZXJCb3ggb3IgQ0F1dG9Sb3V0ZXJQb3J0LiBUaGlzIGVkZ2UgaXNcbiAgICAgUmVwcmVzZW50ZWQgYnkgYSBDQXV0b1JvdXRlclBvaW50IHdpdGggaXRzIG5leHQgcG9pbnQuIFRoZSB2YXJpYWJsZSAncG9pbnQnIHdpbGwgcmVmZXJcbiAgICAgdG8gdGhpcyBDQXV0b1JvdXRlclBvaW50LlxuXG4gICAgIFRoZSBjb29yZGluYXRlcyBvZiBhbiBlZGdlIGFyZSAneDEnLCAneDInIGFuZCAneScgd2hlcmUgeDEveDIgaXMgdGhlIHgtY29vcmRpbmF0ZVxuICAgICBvZiB0aGUgbGVmdC9yaWdodCBwb2ludCwgYW5kIHkgaXMgdGhlIGNvbW1vbiB5LWNvb3JkaW5hdGUgb2YgdGhlIHBvaW50cy5cblxuICAgICBUaGUgZWRnZXMgYXJlIG9yZGVyZWQgYWNjb3JkaW5nIHRvIHRoZWlyIHktY29vcmRpbmF0ZXMuIFRoZSBmaXJzdCBlZGdlIGhhc1xuICAgICB0aGUgbGVhc3QgeS1jb29yZGluYXRlICh0b3Btb3N0KSwgYW5kIGl0cyBwb2ludGVyIGlzIGluICdvcmRlckZpcnN0Jy5cbiAgICAgV2UgdXNlIHRoZSAnb3JkZXInIHByZWZpeCBpbiB0aGUgdmFyaWFibGUgbmFtZXMgdG8gcmVmZXIgdG8gdGhpcyBvcmRlci5cblxuICAgICBXZSB3aWxsIHdhbGsgZnJvbSB0b3AgdG8gYm90dG9tIChmcm9tIHRoZSAnb3JkZXJGaXJzdCcgYWxvbmcgdGhlICd0aGlzLm9yZGVyTmV4dCcpLlxuICAgICBXZSBrZWVwIHRyYWNrIGEgJ3NlY3Rpb24nIG9mIHNvbWUgZWRnZXMuIElmIHdlIGhhdmUgYW4gaW5maW5pdGUgaG9yaXpvbnRhbCBsaW5lLFxuICAgICB0aGVuIHRoZSBzZWN0aW9uIGNvbnNpc3RzIG9mIHRob3NlIGVkZ2VzIHRoYXQgYXJlIGFib3ZlIHRoZSBsaW5lIGFuZCBub3QgYmxvY2tlZFxuICAgICBieSBhbm90aGVyIGVkZ2Ugd2hpY2ggaXMgY2xvc2VyIHRvIHRoZSBsaW5lLiBFYWNoIGVkZ2UgaW4gdGhlIHNlY3Rpb24gaGFzXG4gICAgIGEgdmlld2FibGUgcG9ydGlvbiBmcm9tIHRoZSBsaW5lICh0aGUgbm90IGJsb2NrZWQgcG9ydGlvbikuIFRoZSBjb29yZGluYXRlc1xuICAgICBvZiB0aGlzIHBvcnRpb24gYXJlICd0aGlzLnNlY3Rpb25YMScgYW5kICd0aGlzLnNlY3Rpb25YMicuIFdlIGhhdmUgYW4gb3JkZXIgb2YgdGhlIGVkZ2VzXG4gICAgIGJlbG9uZ2luZyB0byB0aGUgY3VycmVudCBzZWN0aW9uLiBUaGUgJ3NlY3Rpb25fZmlyc3QnIHJlZmVycyB0byB0aGUgbGVmdG1vc3RcbiAgICAgZWRnZSBpbiB0aGUgc2VjdGlvbiwgd2hpbGUgdGhlICd0aGlzLnNlY3Rpb25OZXh0JyB0byB0aGUgbmV4dCBmcm9tIGxlZnQgdG8gcmlnaHQuXG5cbiAgICAgV2Ugc2F5IHRoYXQgdGhlIENBdXRvUm91dGVyRWRnZSBFMSAncHJlY2VkZScgdGhlIENBdXRvUm91dGVyRWRnZSBFMiBpZiB0aGVyZSBpcyBubyBvdGhlciBDQXV0b1JvdXRlckVkZ2Ugd2hpY2hcbiAgICAgdG90YWxseVx0YmxvY2tzIFMxIGZyb20gUzIuIFNvIGEgc2VjdGlvbiBjb25zaXN0cyBvZiB0aGUgcHJlY2VkaW5nIGVkZ2VzIG9mIGFuXG4gICAgIGluZmluaXRlIGVkZ2UuIFdlIHNheSB0aGF0IEUxIGlzICdhZGphY2VudCcgdG8gRTIsIGlmIEUxIGlzIHRoZSBuZWFyZXN0IGVkZ2VcbiAgICAgdG8gRTIgd2hpY2ggcHJlY2VkZSBpdC4gQ2xlYXJseSwgZXZlcnkgZWRnZSBoYXMgYXQgbW9zdCBvbmUgYWRqYWNlbnQgcHJlY2VkZW5jZS5cblxuICAgICBUaGUgZWRnZXMgb2YgYW55IENBdXRvUm91dGVyQm94IG9yIENBdXRvUm91dGVyUG9ydCBhcmUgZml4ZWQuIFdlIHdpbGwgY29udGludWFsbHkgZml4IHRoZSBlZGdlc1xuICAgICBvZiB0aGUgQ0F1dG9Sb3V0ZXJQYXRocy4gQnV0IGZpcnN0IHdlIG5lZWQgc29tZSBkZWZpbml0aW9uLlxuXG4gICAgIFdlIGNhbGwgYSBzZXQgb2YgZWRnZXMgYXMgYSAnYmxvY2snIGlmIHRoZSB0b3Btb3N0IChmaXJzdCkgYW5kIGJvdHRvbW1vc3QgKGxhc3QpXG4gICAgIGVkZ2VzIG9mIGl0IGFyZSBmaXhlZCB3aGlsZSB0aGUgZWRnZXMgYmV0d2VlbiB0aGVtIGFyZSBub3QuIEZ1cnRoZXJtb3JlLCBldmVyeVxuICAgICBlZGdlIGlzIGFkamFjZW50IHRvXHR0aGUgbmV4dCBvbmUgaW4gdGhlIG9yZGVyLiBFdmVyeSBlZGdlIGluIHRoZSBibG9jayBoYXMgYW5cbiAgICAgJ2luZGV4Jy4gVGhlIGluZGV4IG9mIHRoZSBmaXJzdCBvbmUgKHRvcG1vc3QpIGlzIDAsIG9mIHRoZSBzZWNvbmQgaXMgMSwgYW5kIHNvIG9uLlxuICAgICBXZSBjYWxsIHRoZSBpbmRleCBvZiB0aGUgbGFzdCBlZGdlICgjIG9mIGVkZ2VzIC0gMSkgYXMgdGhlIGluZGV4IG9mIHRoZSBlbnRpcmUgYm94LlxuICAgICBUaGUgJ2RlcHRoJyBvZiBhIGJsb2NrIGlzIHRoZSBkaWZmZXJlbmNlIG9mIHRoZSB5LWNvb3JkaW5hdGVzIG9mIHRoZSBmaXJzdCBhbmQgbGFzdFxuICAgICBlZGdlcyBvZiBpdC4gVGhlICdnb2FsIGdhcCcgb2YgdGhlIGJsb2NrIGlzIHRoZSBxdW90aWVudCBvZiB0aGUgZGVwdGggYW5kIGluZGV4XG4gICAgIG9mIHRoZSBibG9jay4gSWYgdGhlIGRpZmZlcmVuY2Ugb2YgdGhlIHktY29vcmRpbmF0ZXMgb2YgdGhlIGFkamFjZW50IGVkZ2VzIGluXG4gICAgIHRoZSBibG9jayBhcmUgYWxsIGVxdWFsIHRvIHRoZSBnb2FsIGdhcCwgdGhlbiB3ZSBzYXkgdGhhdCB0aGUgYmxvY2sgaXMgZXZlbmx5XG4gICAgIGRpc3RyaWJ1dGVkLlxuXG4gICAgIFNvIHdlIHNlYXJjaCB0aGUgYmxvY2sgd2hpY2ggaGFzIG1pbmltYWwgZ29hbCBnYXAuIFRoZW4gaWYgaXQgaXMgbm90IGV2ZW5seVxuICAgICBkaXN0cmlidXRlZCwgdGhlbiB3ZSBzaGlmdCB0aGUgbm90IGZpeGVkIGVkZ2VzIHRvIHRoZSBkZXNpcmVkIHBvc2l0aW9uLiBJdCBpc1xuICAgICBub3QgaGFyZCB0byBzZWVcdHRoYXQgaWYgdGhlIGJsb2NrIGhhcyBtaW5pbWFsIGdvYWwgZ2FwIChhbW9uZyB0aGUgYWxsXG4gICAgIHBvc3NpYmlsaXRpZXMgb2YgYmxvY2tzKSwgdGhlbiBpbiB0aGlzIHdheSB3ZSBkbyBub3QgbW92ZSBhbnkgZWRnZXMgaW50byBib3hlcy5cbiAgICAgRmluYWxseSwgd2Ugc2V0IHRoZSAoaW5uZXIpIGVkZ2VzIG9mIHRoZSBibG9jayB0byBiZSBmaXhlZCAoZXhjZXB0IHRoZSB0b3Btb3N0IGFuZFxuICAgICBib3R0b21tb3N0IGVkZ2VzLCBzaW5jZSB0aGV5IGFyZSBhbHJlYWR5IGZpeGVkKS4gQW5kIHdlIGFnYWluIGJlZ2luIHRoZSBzZWFyY2guXG4gICAgIElmIGV2ZXJ5IGVkZ2UgaXMgZml4ZWQsIHRoZW4gd2UgaGF2ZSBmaW5pc2hlZC4gVGhpcyBpcyB0aGUgYmFzaWMgaWRlYS4gV2Ugd2lsbFxuICAgICByZWZpbmUgdGhpcyBhbGdvcml0aG0uXG5cbiAgICAgVGhlIHZhcmlhYmxlcyByZWxhdGVkIHRvIHRoZSBibG9ja3MgYXJlIHByZWZpeGVkIGJ5ICdibG9jaycuIE5vdGUgdGhhdCB0aGVcbiAgICAgdmFyaWFibGVzIG9mIGFuIGVkZ2UgYXJlIHJlZmVyIHRvIHRoYXQgYmxvY2sgaW4gd2hpY2ggdGhpcyBlZGdlIGlzIGlubmVyISBUaGVcbiAgICAgJ2Jsb2NrX29sZGdhcCcgaXMgdGhlIGdvYWwgZ2FwIG9mIHRoZSBibG9jayB3aGVuIGl0IHdhcyBsYXN0IGV2ZW5seSBkaXN0cmlidXRlZC5cblxuICAgICBUaGUgdmFyaWFibGVzICdjYW5zdGFydCcgYW5kICdjYW5lbmQnIG1lYW5zIHRoYXQgdGhpcyBlZ2RlIGNhbiBzdGFydCBhbmQvb3IgZW5kXG4gICAgIGEgYmxvY2suIFRoZSB0b3AgZWRnZSBvZiBhIGJveCBvbmx5IGNhbmVuZCwgd2hpbGUgYSBmaXhlZCBlZGdlIG9mIGEgcGF0aCBjYW4gYm90aFxuICAgICBzdGFydCBhbmQgZW5kIG9mIGEgYmxvY2suXG5cbiAgICAgKi9cblxuICAgIHRoaXMub3duZXIgPSBudWxsO1xuICAgIHRoaXMuc3RhcnRwb2ludFByZXYgPSBudWxsO1xuICAgIHRoaXMuc3RhcnRwb2ludCA9IG51bGw7XG4gICAgdGhpcy5lbmRwb2ludCA9IG51bGw7XG4gICAgdGhpcy5lbmRwb2ludE5leHQgPSBudWxsO1xuXG4gICAgdGhpcy5wb3NpdGlvblkgPSAwO1xuICAgIHRoaXMucG9zaXRpb25YMSA9IDA7XG4gICAgdGhpcy5wb3NpdGlvblgyID0gMDtcbiAgICB0aGlzLmJyYWNrZXRDbG9zaW5nID0gZmFsc2U7XG4gICAgdGhpcy5icmFja2V0T3BlbmluZyA9IGZhbHNlO1xuXG4gICAgdGhpcy5vcmRlclByZXYgPSBudWxsO1xuICAgIHRoaXMub3JkZXJOZXh0ID0gbnVsbDtcblxuICAgIHRoaXMuc2VjdGlvblgxID0gbnVsbDtcbiAgICB0aGlzLnNlY3Rpb25YMiA9IG51bGw7XG4gICAgdGhpcy5zZWN0aW9uTmV4dCA9IG51bGw7XG4gICAgdGhpcy5zZWN0aW9uRG93biA9IG51bGw7XG5cbiAgICB0aGlzLmVkZ2VGaXhlZCA9IGZhbHNlO1xuICAgIHRoaXMuZWRnZUN1c3RvbUZpeGVkID0gZmFsc2U7XG4gICAgdGhpcy5lZGdlQ2FuUGFzc2VkID0gZmFsc2U7XG4gICAgdGhpcy5lZGdlRGlyZWN0aW9uID0gbnVsbDtcblxuICAgIHRoaXMuYmxvY2tQcmV2ID0gbnVsbDtcbiAgICB0aGlzLmJsb2NrTmV4dCA9IG51bGw7XG4gICAgdGhpcy5ibG9ja1RyYWNlID0gbnVsbDtcblxuICAgIHRoaXMuY2xvc2VzdFByZXYgPSBudWxsO1xuICAgIHRoaXMuY2xvc2VzdE5leHQgPSBudWxsO1xuXG59O1xuXG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5hc3NpZ24gPSBmdW5jdGlvbiAob3RoZXJFZGdlKSB7XG5cbiAgICBpZiAob3RoZXJFZGdlICE9PSBudWxsKSB7XG4gICAgICAgIHRoaXMub3duZXIgPSBvdGhlckVkZ2Uub3duZXI7XG4gICAgICAgIHRoaXMuc2V0U3RhcnRQb2ludChvdGhlckVkZ2Uuc3RhcnRwb2ludCwgZmFsc2UpO1xuXG4gICAgICAgIC8vT25seSBjYWxjdWxhdGVEaXJlY3Rpb24gaWYgdGhpcy5lbmRwb2ludCBpcyBub3QgbnVsbFxuICAgICAgICB0aGlzLnNldEVuZFBvaW50KG90aGVyRWRnZS5lbmRwb2ludCwgb3RoZXJFZGdlLmVuZHBvaW50ICE9PSBudWxsKTtcblxuICAgICAgICB0aGlzLnN0YXJ0cG9pbnRQcmV2ID0gb3RoZXJFZGdlLnN0YXJ0cG9pbnRQcmV2O1xuICAgICAgICB0aGlzLmVuZHBvaW50TmV4dCA9IG90aGVyRWRnZS5lbmRwb2ludE5leHQ7XG5cbiAgICAgICAgdGhpcy5wb3NpdGlvblkgPSBvdGhlckVkZ2UucG9zaXRpb25ZO1xuICAgICAgICB0aGlzLnBvc2l0aW9uWDEgPSBvdGhlckVkZ2UucG9zaXRpb25YMTtcbiAgICAgICAgdGhpcy5wb3NpdGlvblgyID0gb3RoZXJFZGdlLnBvc2l0aW9uWDI7XG4gICAgICAgIHRoaXMuYnJhY2tldENsb3NpbmcgPSBvdGhlckVkZ2UuYnJhY2tldENsb3Npbmc7XG4gICAgICAgIHRoaXMuYnJhY2tldE9wZW5pbmcgPSBvdGhlckVkZ2UuYnJhY2tldE9wZW5pbmc7XG5cbiAgICAgICAgdGhpcy5vcmRlck5leHQgPSBvdGhlckVkZ2Uub3JkZXJOZXh0O1xuICAgICAgICB0aGlzLm9yZGVyUHJldiA9IG90aGVyRWRnZS5vcmRlclByZXY7XG5cbiAgICAgICAgdGhpcy5zZWN0aW9uWDEgPSBvdGhlckVkZ2Uuc2VjdGlvblgxO1xuICAgICAgICB0aGlzLnNlY3Rpb25YMiA9IG90aGVyRWRnZS5zZWN0aW9uWDI7XG4gICAgICAgIHRoaXMuc2V0U2VjdGlvbk5leHQob3RoZXJFZGdlLmdldFNlY3Rpb25OZXh0KHRydWUpKTtcbiAgICAgICAgdGhpcy5zZXRTZWN0aW9uRG93bihvdGhlckVkZ2UuZ2V0U2VjdGlvbkRvd24odHJ1ZSkpO1xuXG4gICAgICAgIHRoaXMuZWRnZUZpeGVkID0gb3RoZXJFZGdlLmVkZ2VGaXhlZDtcbiAgICAgICAgdGhpcy5lZGdlQ3VzdG9tRml4ZWQgPSBvdGhlckVkZ2UuZWRnZUN1c3RvbUZpeGVkO1xuICAgICAgICB0aGlzLnNldEVkZ2VDYW5wYXNzZWQob3RoZXJFZGdlLmdldEVkZ2VDYW5wYXNzZWQoKSk7XG4gICAgICAgIHRoaXMuc2V0RGlyZWN0aW9uKG90aGVyRWRnZS5nZXREaXJlY3Rpb24oKSk7XG5cbiAgICAgICAgdGhpcy5zZXRCbG9ja1ByZXYob3RoZXJFZGdlLmdldEJsb2NrUHJldigpKTtcbiAgICAgICAgdGhpcy5zZXRCbG9ja05leHQob3RoZXJFZGdlLmdldEJsb2NrTmV4dCgpKTtcbiAgICAgICAgdGhpcy5zZXRCbG9ja1RyYWNlKG90aGVyRWRnZS5nZXRCbG9ja1RyYWNlKCkpO1xuXG4gICAgICAgIHRoaXMuc2V0Q2xvc2VzdFByZXYob3RoZXJFZGdlLmdldENsb3Nlc3RQcmV2KCkpO1xuICAgICAgICB0aGlzLnNldENsb3Nlc3ROZXh0KG90aGVyRWRnZS5nZXRDbG9zZXN0TmV4dCgpKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5lcXVhbHMgPSBmdW5jdGlvbiAob3RoZXJFZGdlKSB7XG4gICAgcmV0dXJuIHRoaXMgPT09IG90aGVyRWRnZTsgLy8gVGhpcyBjaGVja3MgaWYgdGhleSByZWZlcmVuY2UgdGhlIHNhbWUgb2JqZWN0XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuZ2V0U3RhcnRQb2ludFByZXYgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RhcnRwb2ludFByZXYgIT09IG51bGwgPyB0aGlzLnN0YXJ0cG9pbnRQcmV2IHx8IHRoaXMuc3RhcnRwb2ludFByZXYgOiBudWxsO1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLmlzU3RhcnRQb2ludFByZXZOdWxsID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiAhdGhpcy5zdGFydHBvaW50UHJldjtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5nZXRTdGFydFBvaW50ID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLnN0YXJ0cG9pbnQgIT09IG51bGwgP1xuICAgICAgICAodGhpcy5zdGFydHBvaW50IGluc3RhbmNlb2YgQXJyYXkgPyBuZXcgQXJQb2ludCh0aGlzLnN0YXJ0cG9pbnQpIDogbmV3IEFyUG9pbnQodGhpcy5zdGFydHBvaW50KSkgOlxuICAgICAgICBDT05TVEFOVFMuRU1QVFlfUE9JTlQ7ICAvLyByZXR1cm5pbmcgY29weSBvZiB0aGlzLnN0YXJ0cG9pbnRcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5pc1NhbWVTdGFydFBvaW50ID0gZnVuY3Rpb24gKHBvaW50KSB7XG4gICAgcmV0dXJuIHRoaXMuc3RhcnRwb2ludCA9PT0gcG9pbnQ7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuaXNTdGFydFBvaW50TnVsbCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5zdGFydHBvaW50ID09PSBudWxsO1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLnNldFN0YXJ0UG9pbnQgPSBmdW5jdGlvbiAocG9pbnQsIGIpIHtcbiAgICB0aGlzLnN0YXJ0cG9pbnQgPSBwb2ludDtcblxuICAgIGlmIChiICE9PSBmYWxzZSkge1xuICAgICAgICB0aGlzLnJlY2FsY3VsYXRlRGlyZWN0aW9uKCk7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLnNldFN0YXJ0UG9pbnRYID0gZnVuY3Rpb24gKF94KSB7XG4gICAgdGhpcy5zdGFydHBvaW50LnggPSBfeDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5zZXRTdGFydFBvaW50WSA9IGZ1bmN0aW9uIChfeSkge1xuICAgIHRoaXMuc3RhcnRwb2ludC55ID0gX3k7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuZ2V0RW5kUG9pbnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuZW5kcG9pbnQgIT09IG51bGwgP1xuICAgICAgICAodGhpcy5lbmRwb2ludCBpbnN0YW5jZW9mIEFycmF5ID9cbiAgICAgICAgICAgIG5ldyBBclBvaW50KHRoaXMuZW5kcG9pbnQpIDpcbiAgICAgICAgICAgIG5ldyBBclBvaW50KHRoaXMuZW5kcG9pbnQpKSA6XG4gICAgICAgIENPTlNUQU5UUy5FTVBUWV9QT0lOVDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5pc0VuZFBvaW50TnVsbCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5lbmRwb2ludCA9PT0gbnVsbDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5zZXRFbmRQb2ludCA9IGZ1bmN0aW9uIChwb2ludCwgYikge1xuICAgIHRoaXMuZW5kcG9pbnQgPSBwb2ludDtcblxuICAgIGlmIChiICE9PSBmYWxzZSkge1xuICAgICAgICB0aGlzLnJlY2FsY3VsYXRlRGlyZWN0aW9uKCk7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLnNldFN0YXJ0QW5kRW5kUG9pbnQgPSBmdW5jdGlvbiAoc3RhcnRQb2ludCwgZW5kUG9pbnQpIHtcbiAgICB0aGlzLnNldFN0YXJ0UG9pbnQoc3RhcnRQb2ludCwgZmFsc2UpOyAvL3dhaXQgdW50aWwgc2V0dGluZyB0aGUgdGhpcy5lbmRwb2ludCB0byByZWNhbGN1bGF0ZURpcmVjdGlvblxuICAgIHRoaXMuc2V0RW5kUG9pbnQoZW5kUG9pbnQpO1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLnNldEVuZFBvaW50WCA9IGZ1bmN0aW9uIChfeCkge1xuICAgIHRoaXMuZW5kcG9pbnQueCA9IF94O1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLnNldEVuZFBvaW50WSA9IGZ1bmN0aW9uIChfeSkge1xuICAgIHRoaXMuZW5kcG9pbnQueSA9IF95O1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLmlzRW5kUG9pbnROZXh0TnVsbCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gIXRoaXMuZW5kcG9pbnROZXh0O1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLmdldFNlY3Rpb25OZXh0ID0gZnVuY3Rpb24gKCkge1xuXG4gICAgcmV0dXJuIHRoaXMuc2VjdGlvbk5leHQgIT09IHVuZGVmaW5lZCA/IHRoaXMuc2VjdGlvbk5leHRbMF0gOiBudWxsO1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLmdldFNlY3Rpb25OZXh0UHRyID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICghdGhpcy5zZWN0aW9uTmV4dCB8fCAhdGhpcy5zZWN0aW9uTmV4dFswXSkge1xuICAgICAgICB0aGlzLnNlY3Rpb25OZXh0ID0gW25ldyBBdXRvUm91dGVyRWRnZSgpXTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuc2VjdGlvbk5leHQ7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuc2V0U2VjdGlvbk5leHQgPSBmdW5jdGlvbiAobmV4dFNlY3Rpb24pIHtcbiAgICBuZXh0U2VjdGlvbiA9IG5leHRTZWN0aW9uIGluc3RhbmNlb2YgQXJyYXkgPyBuZXh0U2VjdGlvblswXSA6IG5leHRTZWN0aW9uO1xuICAgIGlmICh0aGlzLnNlY3Rpb25OZXh0IGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgICAgdGhpcy5zZWN0aW9uTmV4dFswXSA9IG5leHRTZWN0aW9uO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuc2VjdGlvbk5leHQgPSBbbmV4dFNlY3Rpb25dO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5nZXRTZWN0aW9uRG93biA9IGZ1bmN0aW9uICgpIHsgLy9SZXR1cm5zIHBvaW50ZXIgLSBpZiBub3QgbnVsbFxuXG4gICAgcmV0dXJuIHRoaXMuc2VjdGlvbkRvd24gIT09IHVuZGVmaW5lZCA/IHRoaXMuc2VjdGlvbkRvd25bMF0gOiBudWxsO1xuXG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuZ2V0U2VjdGlvbkRvd25QdHIgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKCF0aGlzLnNlY3Rpb25Eb3duIHx8ICF0aGlzLnNlY3Rpb25Eb3duWzBdKSB7XG4gICAgICAgIHRoaXMuc2VjdGlvbkRvd24gPSBbbmV3IEF1dG9Sb3V0ZXJFZGdlKCldO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5zZWN0aW9uRG93bjtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5zZXRTZWN0aW9uRG93biA9IGZ1bmN0aW9uIChkb3duU2VjdGlvbikge1xuICAgIGRvd25TZWN0aW9uID0gZG93blNlY3Rpb24gaW5zdGFuY2VvZiBBcnJheSA/IGRvd25TZWN0aW9uWzBdIDogZG93blNlY3Rpb247XG4gICAgaWYgKHRoaXMuc2VjdGlvbkRvd24gaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgICB0aGlzLnNlY3Rpb25Eb3duWzBdID0gZG93blNlY3Rpb247XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5zZWN0aW9uRG93biA9IFtkb3duU2VjdGlvbl07XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLmdldEVkZ2VDYW5wYXNzZWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuZWRnZUNhblBhc3NlZDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5zZXRFZGdlQ2FucGFzc2VkID0gZnVuY3Rpb24gKGVjcCkge1xuICAgIHRoaXMuZWRnZUNhblBhc3NlZCA9IGVjcDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5nZXREaXJlY3Rpb24gPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuZWRnZURpcmVjdGlvbjtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5zZXREaXJlY3Rpb24gPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhpcy5lZGdlRGlyZWN0aW9uID0gZGlyO1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLnJlY2FsY3VsYXRlRGlyZWN0aW9uID0gZnVuY3Rpb24gKCkge1xuICAgIGFzc2VydCh0aGlzLnN0YXJ0cG9pbnQgIT09IG51bGwgJiYgdGhpcy5lbmRwb2ludCAhPT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZS5yZWNhbGN1bGF0ZURpcmVjdGlvbjogdGhpcy5zdGFydHBvaW50ICE9PSBudWxsICYmIHRoaXMuZW5kcG9pbnQgIT09IG51bGwgRkFJTEVEIScpO1xuICAgIHRoaXMuZWRnZURpcmVjdGlvbiA9IFV0aWxzLmdldERpcih0aGlzLmVuZHBvaW50Lm1pbnVzKHRoaXMuc3RhcnRwb2ludCkpO1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLmdldEJsb2NrUHJldiA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5ibG9ja1ByZXY7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuc2V0QmxvY2tQcmV2ID0gZnVuY3Rpb24gKHByZXZCbG9jaykge1xuICAgIHRoaXMuYmxvY2tQcmV2ID0gcHJldkJsb2NrO1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLmdldEJsb2NrTmV4dCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5ibG9ja05leHQ7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuc2V0QmxvY2tOZXh0ID0gZnVuY3Rpb24gKG5leHRCbG9jaykge1xuICAgIHRoaXMuYmxvY2tOZXh0ID0gbmV4dEJsb2NrO1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLmdldEJsb2NrVHJhY2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuYmxvY2tUcmFjZTtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5zZXRCbG9ja1RyYWNlID0gZnVuY3Rpb24gKHRyYWNlQmxvY2spIHtcbiAgICB0aGlzLmJsb2NrVHJhY2UgPSB0cmFjZUJsb2NrO1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLmdldENsb3Nlc3RQcmV2ID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmNsb3Nlc3RQcmV2O1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLnNldENsb3Nlc3RQcmV2ID0gZnVuY3Rpb24gKGNwKSB7XG4gICAgdGhpcy5jbG9zZXN0UHJldiA9IGNwO1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLmdldENsb3Nlc3ROZXh0ID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmNsb3Nlc3ROZXh0O1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLnNldENsb3Nlc3ROZXh0ID0gZnVuY3Rpb24gKGNwKSB7XG4gICAgdGhpcy5jbG9zZXN0TmV4dCA9IGNwO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBdXRvUm91dGVyRWRnZTtcbiIsIi8qZ2xvYmFscyBkZWZpbmUsIFdlYkdNRUdsb2JhbCovXG4vKmpzaGludCBicm93c2VyOiB0cnVlKi9cblxuLyoqXG4gKiBAYXV0aG9yIGJyb2xsYiAvIGh0dHBzOi8vZ2l0aHViL2Jyb2xsYlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIExvZ2dlciA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Mb2dnZXInKSxcbiAgICBDT05TVEFOVFMgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuQ29uc3RhbnRzJyksXG4gICAgVXRpbHMgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuVXRpbHMnKSxcbiAgICBhc3NlcnQgPSBVdGlscy5hc3NlcnQsXG4gICAgQXV0b1JvdXRlclBhdGggPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUGF0aCcpLFxuICAgIEF1dG9Sb3V0ZXJQb3J0ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlBvcnQnKSxcbiAgICBBdXRvUm91dGVyQm94ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLkJveCcpLFxuICAgIEF1dG9Sb3V0ZXJFZGdlID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLkVkZ2UnKTtcblxuXG4gICAgLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tQXV0b1JvdXRlckVkZ2VMaXN0XG5cbnZhciBfbG9nZ2VyID0gbmV3IExvZ2dlcignQXV0b1JvdXRlci5FZGdlTGlzdCcpO1xudmFyIEF1dG9Sb3V0ZXJFZGdlTGlzdCA9IGZ1bmN0aW9uIChiKSB7XG4gICAgdGhpcy5vd25lciA9IG51bGw7XG5cbiAgICAvLy0tRWRnZXNcbiAgICB0aGlzLmlzaG9yaXpvbnRhbCA9IGI7XG5cbiAgICAvLy0tT3JkZXJcbiAgICB0aGlzLm9yZGVyRmlyc3QgPSBudWxsO1xuICAgIHRoaXMub3JkZXJMYXN0ID0gbnVsbDtcblxuICAgIC8vLS1TZWN0aW9uXG4gICAgdGhpcy5zZWN0aW9uRmlyc3QgPSBudWxsO1xuICAgIHRoaXMuc2VjdGlvbkJsb2NrZXIgPSBudWxsO1xuICAgIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkID0gW107IC8vIFRoaXMgaXMgYW4gYXJyYXkgdG8gZW11bGF0ZSB0aGUgcG9pbnRlciB0byBhIHBvaW50ZXIgZnVuY3Rpb25hbGl0eSBpbiBDUFAuIFxuICAgIC8vIFRoYXQgaXMsIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkWzBdID0gdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQqXG5cbiAgICB0aGlzLl9pbml0T3JkZXIoKTtcbiAgICB0aGlzLl9pbml0U2VjdGlvbigpO1xufTtcblxuLy8gUHVibGljIEZ1bmN0aW9uc1xuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5jb250YWlucyA9IGZ1bmN0aW9uIChzdGFydCwgZW5kKSB7XG4gICAgdmFyIGN1cnJlbnRFZGdlID0gdGhpcy5vcmRlckZpcnN0LFxuICAgICAgICBzdGFydHBvaW50LFxuICAgICAgICBlbmRwb2ludDtcblxuICAgIHdoaWxlIChjdXJyZW50RWRnZSkge1xuICAgICAgICBzdGFydHBvaW50ID0gY3VycmVudEVkZ2Uuc3RhcnRwb2ludDtcbiAgICAgICAgZW5kcG9pbnQgPSBjdXJyZW50RWRnZS5lbmRwb2ludDtcbiAgICAgICAgaWYgKHN0YXJ0LmVxdWFscyhzdGFydHBvaW50KSAmJiBlbmQuZXF1YWxzKGVuZHBvaW50KSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgY3VycmVudEVkZ2UgPSBjdXJyZW50RWRnZS5vcmRlck5leHQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuY2hlY2tPcmRlcigpO1xuICAgIHRoaXMuY2hlY2tTZWN0aW9uKCk7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLmFkZFBhdGhFZGdlcyA9IGZ1bmN0aW9uIChwYXRoKSB7XG4gICAgYXNzZXJ0KHBhdGgub3duZXIgPT09IHRoaXMub3duZXIsXG4gICAgICAgICdBUkVkZ2VMaXN0LmFkZEVkZ2VzOiBwYXRoLm93bmVyID09PSBvd25lciBGQUlMRUQhJyk7XG5cbiAgICB2YXIgaXNQYXRoQXV0b1JvdXRlZCA9IHBhdGguaXNBdXRvUm91dGVkKCksXG4gICAgICAgIGhhc0N1c3RvbUVkZ2UgPSBmYWxzZSxcbiAgICAgICAgY3VzdG9taXplZEluZGV4ZXMgPSB7fSxcbiAgICAgICAgaW5kZXhlcyA9IFtdLFxuICAgICAgICBzdGFydHBvaW50LFxuICAgICAgICBlbmRwb2ludCxcbiAgICAgICAgZGlyLFxuICAgICAgICBlZGdlLFxuICAgICAgICBpO1xuXG4gICAgaWYgKGlzUGF0aEF1dG9Sb3V0ZWQpIHtcbiAgICAgICAgaSA9IC0xO1xuICAgICAgICB3aGlsZSAoKytpIDwgaW5kZXhlcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGhhc0N1c3RvbUVkZ2UgPSB0cnVlO1xuICAgICAgICAgICAgY3VzdG9taXplZEluZGV4ZXNbaW5kZXhlc1tpXV0gPSAwO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaGFzQ3VzdG9tRWRnZSA9IHRydWU7XG4gICAgfVxuXG4gICAgdmFyIHBvaW50TGlzdCA9IHBhdGguZ2V0UG9pbnRMaXN0KCksXG4gICAgICAgIHB0cnNPYmplY3QgPSBwb2ludExpc3QuZ2V0VGFpbEVkZ2VQdHJzKCksXG4gICAgICAgIGluZEl0cixcbiAgICAgICAgY3VyckVkZ2VJbmRleCA9IHBvaW50TGlzdC5sZW5ndGggLSAyLFxuICAgICAgICBnb29kQW5nbGUsXG4gICAgICAgIHBvcyA9IHB0cnNPYmplY3QucG9zLFxuICAgICAgICBza2lwRWRnZSxcbiAgICAgICAgaXNNb3ZlYWJsZSxcbiAgICAgICAgaXNFZGdlQ3VzdG9tRml4ZWQsXG4gICAgICAgIHN0YXJ0UG9ydCxcbiAgICAgICAgZW5kUG9ydCxcbiAgICAgICAgaXNTdGFydFBvcnRDb25uZWN0VG9DZW50ZXIsXG4gICAgICAgIGlzRW5kUG9ydENvbm5lY3RUb0NlbnRlcixcbiAgICAgICAgaXNQYXRoRml4ZWQ7XG5cbiAgICBzdGFydHBvaW50ID0gcHRyc09iamVjdC5zdGFydDtcbiAgICBlbmRwb2ludCA9IHB0cnNPYmplY3QuZW5kO1xuXG4gICAgd2hpbGUgKHBvaW50TGlzdC5sZW5ndGggJiYgcG9zID49IDApIHtcblxuICAgICAgICBkaXIgPSBVdGlscy5nZXREaXIoZW5kcG9pbnQubWludXMoc3RhcnRwb2ludCkpO1xuXG4gICAgICAgIHNraXBFZGdlID0gZGlyID09PSBDT05TVEFOVFMuRGlyTm9uZSA/IHRydWUgOiBmYWxzZTtcbiAgICAgICAgaXNNb3ZlYWJsZSA9IHBhdGguaXNNb3ZlYWJsZSgpO1xuXG4gICAgICAgIGlmICghaXNNb3ZlYWJsZSAmJiBkaXIgIT09IENPTlNUQU5UUy5EaXJTa2V3KSB7XG4gICAgICAgICAgICBnb29kQW5nbGUgPSBVdGlscy5pc1JpZ2h0QW5nbGUoZGlyKTtcbiAgICAgICAgICAgIGFzc2VydChnb29kQW5nbGUsXG4gICAgICAgICAgICAgICAgJ0FSRWRnZUxpc3QuYWRkRWRnZXM6IFV0aWxzLmlzUmlnaHRBbmdsZSAoZGlyKSBGQUlMRUQhJyk7XG5cbiAgICAgICAgICAgIGlmICghZ29vZEFuZ2xlKSB7XG4gICAgICAgICAgICAgICAgc2tpcEVkZ2UgPSB0cnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXNraXBFZGdlICYmXG4gICAgICAgICAgICAoVXRpbHMuaXNSaWdodEFuZ2xlKGRpcikgJiYgVXRpbHMuaXNIb3Jpem9udGFsKGRpcikgPT09IHRoaXMuaXNob3Jpem9udGFsKSkge1xuICAgICAgICAgICAgZWRnZSA9IG5ldyBBdXRvUm91dGVyRWRnZSgpO1xuICAgICAgICAgICAgZWRnZS5vd25lciA9IHBhdGg7XG5cbiAgICAgICAgICAgIGVkZ2Uuc2V0U3RhcnRBbmRFbmRQb2ludChzdGFydHBvaW50LCBlbmRwb2ludCk7XG4gICAgICAgICAgICBlZGdlLnN0YXJ0cG9pbnRQcmV2ID0gcG9pbnRMaXN0LmdldFBvaW50QmVmb3JlRWRnZShwb3MpO1xuICAgICAgICAgICAgZWRnZS5lbmRwb2ludE5leHQgPSBwb2ludExpc3QuZ2V0UG9pbnRBZnRlckVkZ2UocG9zKTtcblxuICAgICAgICAgICAgaWYgKGhhc0N1c3RvbUVkZ2UpIHtcbiAgICAgICAgICAgICAgICBpc0VkZ2VDdXN0b21GaXhlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGlmIChpc1BhdGhBdXRvUm91dGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGluZEl0ciA9IGN1c3RvbWl6ZWRJbmRleGVzLmluZGV4T2YoY3VyckVkZ2VJbmRleCk7XG4gICAgICAgICAgICAgICAgICAgIGlzRWRnZUN1c3RvbUZpeGVkID0gKGluZEl0ciAhPT0gY3VzdG9taXplZEluZGV4ZXMubGVuZ3RoIC0gMSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaXNFZGdlQ3VzdG9tRml4ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGVkZ2UuZWRnZUN1c3RvbUZpeGVkID0gaXNFZGdlQ3VzdG9tRml4ZWQ7XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICBlZGdlLmVkZ2VDdXN0b21GaXhlZCA9IGRpciA9PT0gQ09OU1RBTlRTLkRpclNrZXc7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHN0YXJ0UG9ydCA9IHBhdGguZ2V0U3RhcnRQb3J0KCk7XG5cbiAgICAgICAgICAgIGFzc2VydChzdGFydFBvcnQgIT09IG51bGwsXG4gICAgICAgICAgICAgICAgJ0FSRWRnZUxpc3QuYWRkRWRnZXM6IHN0YXJ0UG9ydCAhPT0gbnVsbCBGQUlMRUQhJyk7XG5cbiAgICAgICAgICAgIGlzU3RhcnRQb3J0Q29ubmVjdFRvQ2VudGVyID0gc3RhcnRQb3J0LmlzQ29ubmVjdFRvQ2VudGVyKCk7XG4gICAgICAgICAgICBlbmRQb3J0ID0gcGF0aC5nZXRFbmRQb3J0KCk7XG5cbiAgICAgICAgICAgIGFzc2VydChlbmRQb3J0ICE9PSBudWxsLFxuICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0LmFkZEVkZ2VzOiBlbmRQb3J0ICE9PSBudWxsIEZBSUxFRCEnKTtcblxuICAgICAgICAgICAgaXNFbmRQb3J0Q29ubmVjdFRvQ2VudGVyID0gZW5kUG9ydC5pc0Nvbm5lY3RUb0NlbnRlcigpO1xuICAgICAgICAgICAgaXNQYXRoRml4ZWQgPSBwYXRoLmlzRml4ZWQoKSB8fCAhcGF0aC5pc0F1dG9Sb3V0ZWQoKTtcblxuICAgICAgICAgICAgZWRnZS5lZGdlRml4ZWQgPSBlZGdlLmVkZ2VDdXN0b21GaXhlZCB8fCBpc1BhdGhGaXhlZCB8fFxuICAgICAgICAgICAgKGVkZ2UuaXNTdGFydFBvaW50UHJldk51bGwoKSAmJiBpc1N0YXJ0UG9ydENvbm5lY3RUb0NlbnRlcikgfHxcbiAgICAgICAgICAgIChlZGdlLmlzRW5kUG9pbnROZXh0TnVsbCgpICYmIGlzRW5kUG9ydENvbm5lY3RUb0NlbnRlcik7XG5cbiAgICAgICAgICAgIGlmIChkaXIgIT09IENPTlNUQU5UUy5EaXJTa2V3KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcG9zaXRpb25Mb2FkWShlZGdlKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9wb3NpdGlvbkxvYWRCKGVkZ2UpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBlZGdlLnBvc2l0aW9uWSA9IDA7XG4gICAgICAgICAgICAgICAgZWRnZS5icmFja2V0T3BlbmluZyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGVkZ2UuYnJhY2tldENsb3NpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5pbnNlcnQoZWRnZSk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIHB0cnNPYmplY3QgPSBwb2ludExpc3QuZ2V0UHJldkVkZ2VQdHJzKHBvcyk7XG4gICAgICAgIHBvcyA9IHB0cnNPYmplY3QucG9zO1xuICAgICAgICBzdGFydHBvaW50ID0gcHRyc09iamVjdC5zdGFydDtcbiAgICAgICAgZW5kcG9pbnQgPSBwdHJzT2JqZWN0LmVuZDtcbiAgICAgICAgY3VyckVkZ2VJbmRleC0tO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5hZGRQb3J0RWRnZXMgPSBmdW5jdGlvbiAocG9ydCkge1xuICAgIHZhciBzdGFydHBvaW50LFxuICAgICAgICBlbmRwb2ludCxcbiAgICAgICAgZWRnZSxcbiAgICAgICAgc2VsZlBvaW50cyxcbiAgICAgICAgc3RhcnRwb2ludFByZXYsXG4gICAgICAgIGVuZHBvaW50TmV4dCxcbiAgICAgICAgZGlyLFxuICAgICAgICBpLFxuICAgICAgICBjYW5IYXZlU3RhcnRFbmRQb2ludEhvcml6b250YWw7XG5cbiAgICBhc3NlcnQocG9ydC5vd25lci5vd25lciA9PT0gdGhpcy5vd25lcixcbiAgICAgICAgJ0FSRWRnZUxpc3QuYWRkRWRnZXM6IHBvcnQub3duZXIgPT09IChvd25lcikgRkFJTEVEIScpO1xuXG4gICAgaWYgKHBvcnQuaXNDb25uZWN0VG9DZW50ZXIoKSB8fCBwb3J0Lm93bmVyLmlzQXRvbWljKCkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHNlbGZQb2ludHMgPSBwb3J0LnNlbGZQb2ludHM7XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgNDsgaSsrKSB7XG5cbiAgICAgICAgc3RhcnRwb2ludFByZXYgPSBzZWxmUG9pbnRzWyhpICsgMykgJSA0XTtcbiAgICAgICAgc3RhcnRwb2ludCA9IHNlbGZQb2ludHNbaV07XG4gICAgICAgIGVuZHBvaW50ID0gc2VsZlBvaW50c1soaSArIDEpICUgNF07XG4gICAgICAgIGVuZHBvaW50TmV4dCA9IHNlbGZQb2ludHNbKGkgKyAyKSAlIDRdO1xuICAgICAgICBkaXIgPSBVdGlscy5nZXREaXIoZW5kcG9pbnQubWludXMoc3RhcnRwb2ludCkpO1xuXG4gICAgICAgIGFzc2VydChVdGlscy5pc1JpZ2h0QW5nbGUoZGlyKSxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0LmFkZEVkZ2VzOiBVdGlscy5pc1JpZ2h0QW5nbGUgKGRpcikgRkFJTEVEIScpO1xuXG4gICAgICAgIGNhbkhhdmVTdGFydEVuZFBvaW50SG9yaXpvbnRhbCA9IHBvcnQuY2FuSGF2ZVN0YXJ0RW5kUG9pbnRIb3Jpem9udGFsKHRoaXMuaXNob3Jpem9udGFsKTtcbiAgICAgICAgaWYgKFV0aWxzLmlzSG9yaXpvbnRhbChkaXIpID09PSB0aGlzLmlzaG9yaXpvbnRhbCAmJiBjYW5IYXZlU3RhcnRFbmRQb2ludEhvcml6b250YWwpIHtcbiAgICAgICAgICAgIGVkZ2UgPSBuZXcgQXV0b1JvdXRlckVkZ2UoKTtcblxuICAgICAgICAgICAgZWRnZS5vd25lciA9IHBvcnQ7XG4gICAgICAgICAgICBlZGdlLnNldFN0YXJ0QW5kRW5kUG9pbnQoc3RhcnRwb2ludCwgZW5kcG9pbnQpO1xuICAgICAgICAgICAgZWRnZS5zdGFydHBvaW50UHJldiA9IHN0YXJ0cG9pbnRQcmV2O1xuICAgICAgICAgICAgZWRnZS5lbmRwb2ludE5leHQgPSBlbmRwb2ludE5leHQ7XG5cbiAgICAgICAgICAgIGVkZ2UuZWRnZUZpeGVkID0gdHJ1ZTtcblxuICAgICAgICAgICAgdGhpcy5fcG9zaXRpb25Mb2FkWShlZGdlKTtcbiAgICAgICAgICAgIHRoaXMuX3Bvc2l0aW9uTG9hZEIoZWRnZSk7XG5cbiAgICAgICAgICAgIGlmIChlZGdlLmJyYWNrZXRDbG9zaW5nKSB7XG4gICAgICAgICAgICAgICAgZWRnZS5hZGRUb1Bvc2l0aW9uKDAuOTk5KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5pbnNlcnQoZWRnZSk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLmFkZEJveEVkZ2VzID0gZnVuY3Rpb24gKGJveCkge1xuICAgIHZhciBzZWxmUG9pbnRzID0gYm94LnNlbGZQb2ludHMsXG4gICAgICAgIHN0YXJ0cG9pbnQsXG4gICAgICAgIHN0YXJ0cG9pbnRQcmV2LFxuICAgICAgICBlbmRwb2ludCxcbiAgICAgICAgZW5kcG9pbnROZXh0LFxuICAgICAgICBlZGdlLFxuICAgICAgICBkaXI7XG5cbiAgICBhc3NlcnQoYm94Lm93bmVyID09PSB0aGlzLm93bmVyLFxuICAgICAgICAnQVJFZGdlTGlzdC5hZGRFZGdlczogYm94Lm93bmVyID09PSAob3duZXIpIEZBSUxFRCEnKTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgNDsgaSsrKSB7XG4gICAgICAgIHN0YXJ0cG9pbnRQcmV2ID0gc2VsZlBvaW50c1soaSArIDMpICUgNF07XG4gICAgICAgIHN0YXJ0cG9pbnQgPSBzZWxmUG9pbnRzW2ldO1xuICAgICAgICBlbmRwb2ludCA9IHNlbGZQb2ludHNbKGkgKyAxKSAlIDRdO1xuICAgICAgICBlbmRwb2ludE5leHQgPSBzZWxmUG9pbnRzWyhpICsgMikgJSA0XTtcbiAgICAgICAgZGlyID0gVXRpbHMuZ2V0RGlyKGVuZHBvaW50Lm1pbnVzKHN0YXJ0cG9pbnQpKTtcblxuICAgICAgICBhc3NlcnQoVXRpbHMuaXNSaWdodEFuZ2xlKGRpciksXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5hZGRFZGdlczogVXRpbHMuaXNSaWdodEFuZ2xlIChkaXIpIEZBSUxFRCEnKTtcblxuICAgICAgICBpZiAoVXRpbHMuaXNIb3Jpem9udGFsKGRpcikgPT09IHRoaXMuaXNob3Jpem9udGFsKSB7XG4gICAgICAgICAgICBlZGdlID0gbmV3IEF1dG9Sb3V0ZXJFZGdlKCk7XG5cbiAgICAgICAgICAgIGVkZ2Uub3duZXIgPSBib3g7XG4gICAgICAgICAgICBlZGdlLnNldFN0YXJ0QW5kRW5kUG9pbnQoc3RhcnRwb2ludCwgZW5kcG9pbnQpO1xuICAgICAgICAgICAgZWRnZS5zdGFydHBvaW50UHJldiA9IHN0YXJ0cG9pbnRQcmV2O1xuICAgICAgICAgICAgZWRnZS5lbmRwb2ludE5leHQgPSBlbmRwb2ludE5leHQ7XG5cbiAgICAgICAgICAgIGVkZ2UuZWRnZUZpeGVkID0gdHJ1ZTtcblxuICAgICAgICAgICAgdGhpcy5fcG9zaXRpb25Mb2FkWShlZGdlKTtcbiAgICAgICAgICAgIHRoaXMuX3Bvc2l0aW9uTG9hZEIoZWRnZSk7XG5cbiAgICAgICAgICAgIGlmIChlZGdlLmJyYWNrZXRDbG9zaW5nKSB7XG4gICAgICAgICAgICAgICAgZWRnZS5hZGRUb1Bvc2l0aW9uKDAuOTk5KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5pbnNlcnQoZWRnZSk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLmFkZEdyYXBoRWRnZXMgPSBmdW5jdGlvbiAoZ3JhcGgpIHtcbiAgICB2YXIgc2VsZlBvaW50cyxcbiAgICAgICAgc3RhcnRwb2ludCxcbiAgICAgICAgc3RhcnRwb2ludFByZXYsXG4gICAgICAgIGVuZHBvaW50TmV4dCxcbiAgICAgICAgZW5kcG9pbnQsXG4gICAgICAgIGVkZ2UsXG4gICAgICAgIGRpcixcbiAgICAgICAgaTtcblxuICAgIGFzc2VydChncmFwaCA9PT0gdGhpcy5vd25lcixcbiAgICAgICAgJ0FSRWRnZUxpc3QuYWRkRWRnZXM6IGdyYXBoID09PSB0aGlzLm93bmVyIEZBSUxFRCEnKTtcblxuICAgIHNlbGZQb2ludHMgPSBncmFwaC5zZWxmUG9pbnRzO1xuXG4gICAgZm9yIChpID0gMDsgaSA8IDQ7IGkrKykge1xuXG4gICAgICAgIHN0YXJ0cG9pbnRQcmV2ID0gc2VsZlBvaW50c1soaSArIDMpICUgNF07XG4gICAgICAgIHN0YXJ0cG9pbnQgPSBzZWxmUG9pbnRzW2ldO1xuICAgICAgICBlbmRwb2ludCA9IHNlbGZQb2ludHNbKGkgKyAxKSAlIDRdO1xuICAgICAgICBlbmRwb2ludE5leHQgPSBzZWxmUG9pbnRzWyhpICsgMikgJSA0XTtcbiAgICAgICAgZGlyID0gVXRpbHMuZ2V0RGlyKGVuZHBvaW50Lm1pbnVzKHN0YXJ0cG9pbnQpKTtcblxuICAgICAgICBhc3NlcnQoVXRpbHMuaXNSaWdodEFuZ2xlKGRpciksXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5hZGRFZGdlczogVXRpbHMuaXNSaWdodEFuZ2xlIChkaXIpIEZBSUxFRCEnKTtcblxuICAgICAgICBpZiAoVXRpbHMuaXNIb3Jpem9udGFsKGRpcikgPT09IHRoaXMuaXNob3Jpem9udGFsKSB7XG4gICAgICAgICAgICBlZGdlID0gbmV3IEF1dG9Sb3V0ZXJFZGdlKCk7XG5cbiAgICAgICAgICAgIGVkZ2Uub3duZXIgPSBncmFwaDtcbiAgICAgICAgICAgIGVkZ2Uuc2V0U3RhcnRBbmRFbmRQb2ludChzdGFydHBvaW50LCBlbmRwb2ludCk7XG4gICAgICAgICAgICBlZGdlLnN0YXJ0cG9pbnRQcmV2ID0gc3RhcnRwb2ludFByZXY7XG4gICAgICAgICAgICBlZGdlLmVuZHBvaW50TmV4dCA9IGVuZHBvaW50TmV4dDtcblxuICAgICAgICAgICAgZWRnZS5lZGdlRml4ZWQgPSB0cnVlO1xuXG4gICAgICAgICAgICB0aGlzLl9wb3NpdGlvbkxvYWRZKGVkZ2UpO1xuICAgICAgICAgICAgdGhpcy5pbnNlcnQoZWRnZSk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLmRlbGV0ZUVkZ2VzID0gZnVuY3Rpb24gKG9iamVjdCkge1xuICAgIHZhciBlZGdlID0gdGhpcy5vcmRlckZpcnN0LFxuICAgICAgICBuZXh0O1xuXG4gICAgd2hpbGUgKGVkZ2UgIT09IG51bGwpIHtcbiAgICAgICAgaWYgKGVkZ2Uub3duZXIgPT09IG9iamVjdCkge1xuICAgICAgICAgICAgbmV4dCA9IGVkZ2Uub3JkZXJOZXh0O1xuICAgICAgICAgICAgdGhpcy5yZW1vdmUoZWRnZSk7XG4gICAgICAgICAgICBlZGdlID0gbmV4dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGVkZ2UgPSBlZGdlLm9yZGVyTmV4dDtcbiAgICAgICAgfVxuICAgIH1cblxufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5kZWxldGVBbGxFZGdlcyA9IGZ1bmN0aW9uICgpIHtcbiAgICB3aGlsZSAodGhpcy5vcmRlckZpcnN0KSB7XG4gICAgICAgIHRoaXMucmVtb3ZlKHRoaXMub3JkZXJGaXJzdCk7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5nZXRFZGdlID0gZnVuY3Rpb24gKHBhdGgsIHN0YXJ0cG9pbnQpIHtcbiAgICB2YXIgZWRnZSA9IHRoaXMub3JkZXJGaXJzdDtcbiAgICB3aGlsZSAoZWRnZSAhPT0gbnVsbCkge1xuXG4gICAgICAgIGlmIChlZGdlLmlzU2FtZVN0YXJ0UG9pbnQoc3RhcnRwb2ludCkpIHtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgZWRnZSA9IGVkZ2Uub3JkZXJOZXh0O1xuICAgIH1cblxuICAgIGFzc2VydChlZGdlICE9PSBudWxsLFxuICAgICAgICAnQVJFZGdlTGlzdC5nZXRFZGdlOiBlZGdlICE9PSBudWxsIEZBSUxFRCEnKTtcbiAgICByZXR1cm4gZWRnZTtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuZ2V0RWRnZUJ5UG9pbnRlciA9IGZ1bmN0aW9uIChzdGFydHBvaW50KSB7XG4gICAgdmFyIGVkZ2UgPSB0aGlzLm9yZGVyRmlyc3Q7XG4gICAgd2hpbGUgKGVkZ2UgIT09IG51bGwpIHtcbiAgICAgICAgaWYgKGVkZ2UuaXNTYW1lU3RhcnRQb2ludChzdGFydHBvaW50KSkge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICBlZGdlID0gZWRnZS5vcmRlck5leHQ7XG4gICAgfVxuXG4gICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwsXG4gICAgICAgICdBUkVkZ2VMaXN0LmdldEVkZ2VCeVBvaW50ZXI6IGVkZ2UgIT09IG51bGwgRkFJTEVEIScpO1xuICAgIHJldHVybiBlZGdlO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5zZXRFZGdlQnlQb2ludGVyID0gZnVuY3Rpb24gKHBFZGdlLCBuZXdFZGdlKSB7XG4gICAgYXNzZXJ0KG5ld0VkZ2UgaW5zdGFuY2VvZiBBdXRvUm91dGVyRWRnZSxcbiAgICAgICAgJ0FSRWRnZUxpc3Quc2V0RWRnZUJ5UG9pbnRlcjogbmV3RWRnZSBpbnN0YW5jZW9mIEF1dG9Sb3V0ZXJFZGdlIEZBSUxFRCEnKTtcbiAgICB2YXIgZWRnZSA9IHRoaXMuc2VjdGlvbkZpcnN0O1xuICAgIHdoaWxlIChlZGdlICE9PSBudWxsKSB7XG4gICAgICAgIGlmIChwRWRnZSA9PT0gZWRnZSkge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICBlZGdlID0gZWRnZS5nZXRTZWN0aW9uRG93bigpO1xuICAgIH1cblxuICAgIGFzc2VydChlZGdlICE9PSBudWxsLFxuICAgICAgICAnQVJFZGdlTGlzdC5zZXRFZGdlQnlQb2ludGVyOiBlZGdlICE9PSBudWxsIEZBSUxFRCEnKTtcbiAgICBlZGdlID0gbmV3RWRnZTtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuZ2V0RWRnZUF0ID0gZnVuY3Rpb24gKHBvaW50LCBuZWFybmVzcykge1xuICAgIHZhciBlZGdlID0gdGhpcy5vcmRlckZpcnN0O1xuICAgIHdoaWxlIChlZGdlKSB7XG5cbiAgICAgICAgaWYgKFV0aWxzLmlzUG9pbnROZWFyTGluZShwb2ludCwgZWRnZS5zdGFydHBvaW50LCBlZGdlLmVuZHBvaW50LCBuZWFybmVzcykpIHtcbiAgICAgICAgICAgIHJldHVybiBlZGdlO1xuICAgICAgICB9XG5cbiAgICAgICAgZWRnZSA9IGVkZ2Uub3JkZXJOZXh0O1xuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5kdW1wRWRnZXMgPSBmdW5jdGlvbiAobXNnLCBsb2dnZXIpIHtcbiAgICB2YXIgZWRnZSA9IHRoaXMub3JkZXJGaXJzdCxcbiAgICAgICAgbG9nID0gbG9nZ2VyIHx8IF9sb2dnZXIuZGVidWcsXG4gICAgICAgIHRvdGFsID0gMTtcblxuICAgIGxvZyhtc2cpO1xuXG4gICAgd2hpbGUgKGVkZ2UgIT09IG51bGwpIHtcbiAgICAgICAgbG9nKCdcXHQnICsgZWRnZS5zdGFydHBvaW50LnggKyAnLCAnICsgZWRnZS5zdGFydHBvaW50LnkgKyAnXFx0XFx0JyArIGVkZ2UuZW5kcG9pbnQueCArICcsICcgK1xuICAgICAgICBlZGdlLmVuZHBvaW50LnkgKyAnXFx0XFx0XFx0KCcgKyAoZWRnZS5lZGdlRml4ZWQgPyAnRklYRUQnIDogJ01PVkVBQkxFJyApICsgJylcXHRcXHQnICtcbiAgICAgICAgKGVkZ2UuYnJhY2tldENsb3NpbmcgPyAnQnJhY2tldCBDbG9zaW5nJyA6IChlZGdlLmJyYWNrZXRPcGVuaW5nID8gJ0JyYWNrZXQgT3BlbmluZycgOiAnJykpKTtcblxuICAgICAgICBlZGdlID0gZWRnZS5vcmRlck5leHQ7XG4gICAgICAgIHRvdGFsKys7XG4gICAgfVxuXG4gICAgbG9nKCdUb3RhbCBFZGdlczogJyArIHRvdGFsKTtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuZ2V0RWRnZUNvdW50ID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBlZGdlID0gdGhpcy5vcmRlckZpcnN0LFxuICAgICAgICB0b3RhbCA9IDE7XG4gICAgd2hpbGUgKGVkZ2UgIT09IG51bGwpIHtcbiAgICAgICAgZWRnZSA9IGVkZ2Uub3JkZXJOZXh0O1xuICAgICAgICB0b3RhbCsrO1xuICAgIH1cbiAgICByZXR1cm4gdG90YWw7XG59O1xuXG4vLy0tUHJpdmF0ZSBGdW5jdGlvbnNcbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuX3Bvc2l0aW9uR2V0UmVhbFkgPSBmdW5jdGlvbiAoZWRnZSwgeSkge1xuICAgIGlmICh5ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKHRoaXMuaXNob3Jpem9udGFsKSB7XG4gICAgICAgICAgICBhc3NlcnQoZWRnZS5zdGFydHBvaW50LnkgPT09IGVkZ2UuZW5kcG9pbnQueSxcbiAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5wb3NpdGlvbl9HZXRSZWFsWTogZWRnZS5zdGFydHBvaW50LnkgPT09IGVkZ2UuZW5kcG9pbnQueSBGQUlMRUQhJyk7XG4gICAgICAgICAgICByZXR1cm4gZWRnZS5zdGFydHBvaW50Lnk7XG4gICAgICAgIH1cblxuICAgICAgICBhc3NlcnQoZWRnZS5zdGFydHBvaW50LnggPT09IGVkZ2UuZW5kcG9pbnQueCxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0LnBvc2l0aW9uX0dldFJlYWxZOiBlZGdlLnN0YXJ0cG9pbnQueCA9PT0gZWRnZS5lbmRwb2ludC54IEZBSUxFRCEnKTtcbiAgICAgICAgcmV0dXJuIGVkZ2Uuc3RhcnRwb2ludC54O1xuICAgIH0gZWxzZSB7XG5cbiAgICAgICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwgJiYgIWVkZ2UuaXNTdGFydFBvaW50TnVsbCgpICYmICFlZGdlLmlzRW5kUG9pbnROdWxsKCksXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5wb3NpdGlvbl9HZXRSZWFsWTogZWRnZSAhPT0gbnVsbCAmJiAhZWRnZS5pc1N0YXJ0UG9pbnROdWxsKCkgJiYgJyArXG4gICAgICAgICAgICAnIWVkZ2UuaXNFbmRQb2ludE51bGwoKSBGQUlMRUQhJyk7XG5cbiAgICAgICAgaWYgKHRoaXMuaXNob3Jpem9udGFsKSB7XG4gICAgICAgICAgICBhc3NlcnQoZWRnZS5zdGFydHBvaW50LnkgPT09IGVkZ2UuZW5kcG9pbnQueSxcbiAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5wb3NpdGlvbl9HZXRSZWFsWTogZWRnZS5zdGFydHBvaW50LnkgPT09IGVkZ2UuZW5kcG9pbnQueSBGQUlMRUQhJyk7XG4gICAgICAgICAgICBlZGdlLnNldFN0YXJ0UG9pbnRZKHkpO1xuICAgICAgICAgICAgZWRnZS5zZXRFbmRQb2ludFkoeSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhc3NlcnQoZWRnZS5zdGFydHBvaW50LnggPT09IGVkZ2UuZW5kcG9pbnQueCxcbiAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5wb3NpdGlvbl9HZXRSZWFsWTogZWRnZS5zdGFydHBvaW50LnggPT09IGVkZ2UuZW5kcG9pbnQueCBGQUlMRUQnKTtcblxuICAgICAgICAgICAgZWRnZS5zZXRTdGFydFBvaW50WCh5KTtcbiAgICAgICAgICAgIGVkZ2Uuc2V0RW5kUG9pbnRYKHkpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5fcG9zaXRpb25TZXRSZWFsWSA9IGZ1bmN0aW9uIChlZGdlLCB5KSB7XG4gICAgaWYgKGVkZ2UgaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgICBlZGdlID0gZWRnZVswXTtcbiAgICB9XG5cbiAgICBhc3NlcnQoZWRnZSAhPT0gbnVsbCAmJiAhZWRnZS5pc1N0YXJ0UG9pbnROdWxsKCkgJiYgIWVkZ2UuaXNFbmRQb2ludE51bGwoKSxcbiAgICAgICAgJ0FSRWRnZUxpc3QucG9zaXRpb25fU2V0UmVhbFk6IGVkZ2UgIT0gbnVsbCAmJiAhZWRnZS5pc1N0YXJ0UG9pbnROdWxsKCkgJiYgIWVkZ2UuaXNFbmRQb2ludE51bGwoKSBGQUlMRUQnKTtcblxuICAgIGlmICh0aGlzLmlzaG9yaXpvbnRhbCkge1xuICAgICAgICBhc3NlcnQoZWRnZS5zdGFydHBvaW50LnkgPT09IGVkZ2UuZW5kcG9pbnQueSxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0LnBvc2l0aW9uX1NldFJlYWxZOiBlZGdlLnN0YXJ0cG9pbnQueSA9PT0gZWRnZS5lbmRwb2ludC55IEZBSUxFRCcpO1xuICAgICAgICBlZGdlLnNldFN0YXJ0UG9pbnRZKHkpO1xuICAgICAgICBlZGdlLnNldEVuZFBvaW50WSh5KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBhc3NlcnQoZWRnZS5zdGFydHBvaW50LnggPT09IGVkZ2UuZW5kcG9pbnQueCxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0LnBvc2l0aW9uX1NldFJlYWxZOiBlZGdlLnN0YXJ0cG9pbnQueCA9PT0gZWRnZS5lbmRwb2ludC54IEZBSUxFRCcpO1xuICAgICAgICBlZGdlLnNldFN0YXJ0UG9pbnRYKHkpO1xuICAgICAgICBlZGdlLnNldEVuZFBvaW50WCh5KTtcbiAgICB9XG59O1xuXG4vKipcbiAqIE5vcm1hbGl6ZSB0aGUgZWRnZSBlbmRwb2ludHMgc28geDEgPCB4MlxuICovXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLl9wb3NpdGlvbkdldFJlYWxYID0gZnVuY3Rpb24gKGVkZ2UpIHtcbiAgICBhc3NlcnQoZWRnZSAhPT0gbnVsbCAmJiAhZWRnZS5pc1N0YXJ0UG9pbnROdWxsKCkgJiYgIWVkZ2UuaXNFbmRQb2ludE51bGwoKSxcbiAgICAgICAgJ0FSRWRnZUxpc3QucG9zaXRpb25fR2V0UmVhbFg6IGVkZ2UgIT09IG51bGwgJiYgIWVkZ2UuaXNTdGFydFBvaW50TnVsbCgpICYmICFlZGdlLmlzRW5kUG9pbnROdWxsKCkgRkFJTEVEJyk7XG4gICAgdmFyIHgxLCB4MjtcblxuICAgIGlmICh0aGlzLmlzaG9yaXpvbnRhbCkge1xuICAgICAgICBhc3NlcnQoZWRnZS5zdGFydHBvaW50LnkgPT09IGVkZ2UuZW5kcG9pbnQueSxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0LnBvc2l0aW9uX0dldFJlYWxYOiBlZGdlLnN0YXJ0cG9pbnQueSA9PT0gZWRnZS5lbmRwb2ludC55IEZBSUxFRCcpO1xuXG4gICAgICAgIGlmIChlZGdlLnN0YXJ0cG9pbnQueCA8IGVkZ2UuZW5kcG9pbnQueCkge1xuXG4gICAgICAgICAgICB4MSA9IGVkZ2Uuc3RhcnRwb2ludC54O1xuICAgICAgICAgICAgeDIgPSBlZGdlLmVuZHBvaW50Lng7XG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgIHgxID0gZWRnZS5lbmRwb2ludC54O1xuICAgICAgICAgICAgeDIgPSBlZGdlLnN0YXJ0cG9pbnQueDtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGFzc2VydChlZGdlLnN0YXJ0cG9pbnQueCA9PT0gZWRnZS5lbmRwb2ludC54LFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QucG9zaXRpb25fR2V0UmVhbFg6IGVkZ2Uuc3RhcnRwb2ludC54ID09PSBlZGdlLmVuZHBvaW50LnggRkFJTEVEJyk7XG4gICAgICAgIGlmIChlZGdlLnN0YXJ0cG9pbnQueSA8IGVkZ2UuZW5kcG9pbnQueSkge1xuXG4gICAgICAgICAgICB4MSA9IGVkZ2Uuc3RhcnRwb2ludC55O1xuICAgICAgICAgICAgeDIgPSBlZGdlLmVuZHBvaW50Lnk7XG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgIHgxID0gZWRnZS5lbmRwb2ludC55O1xuICAgICAgICAgICAgeDIgPSBlZGdlLnN0YXJ0cG9pbnQueTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBbeDEsIHgyXTtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuX3Bvc2l0aW9uR2V0UmVhbE8gPSBmdW5jdGlvbiAoZWRnZSkge1xuICAgIGFzc2VydChlZGdlICE9PSBudWxsICYmICFlZGdlLmlzU3RhcnRQb2ludE51bGwoKSAmJiAhZWRnZS5pc0VuZFBvaW50TnVsbCgpLFxuICAgICAgICAnQVJFZGdlTGlzdC5wb3NpdGlvbl9HZXRSZWFsTzogZWRnZSAhPT0gbnVsbCAmJiAhZWRnZS5pc1N0YXJ0UG9pbnROdWxsKCkgJiYgIWVkZ2UuaXNFbmRQb2ludE51bGwoKSBGQUlMRUQnKTtcbiAgICB2YXIgbzEsIG8yO1xuXG4gICAgaWYgKHRoaXMuaXNob3Jpem9udGFsKSB7XG4gICAgICAgIGFzc2VydChlZGdlLnN0YXJ0cG9pbnQueSA9PT0gZWRnZS5lbmRwb2ludC55LFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QucG9zaXRpb25fR2V0UmVhbE86IGVkZ2Uuc3RhcnRwb2ludC55ID09PSBlZGdlLmVuZHBvaW50LnkgRkFJTEVEJyk7XG4gICAgICAgIGlmIChlZGdlLnN0YXJ0cG9pbnQueCA8IGVkZ2UuZW5kcG9pbnQueCkge1xuXG4gICAgICAgICAgICBvMSA9IGVkZ2UuaXNTdGFydFBvaW50UHJldk51bGwoKSA/IDAgOiBlZGdlLnN0YXJ0cG9pbnRQcmV2LnkgLSBlZGdlLnN0YXJ0cG9pbnQueTtcbiAgICAgICAgICAgIG8yID0gZWRnZS5pc0VuZFBvaW50TmV4dE51bGwoKSA/IDAgOiBlZGdlLmVuZHBvaW50TmV4dC55IC0gZWRnZS5lbmRwb2ludC55O1xuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICBvMSA9IGVkZ2UuaXNFbmRQb2ludE5leHROdWxsKCkgPyAwIDogZWRnZS5lbmRwb2ludE5leHQueSAtIGVkZ2UuZW5kcG9pbnQueTtcbiAgICAgICAgICAgIG8yID0gZWRnZS5pc1N0YXJ0UG9pbnRQcmV2TnVsbCgpID8gMCA6IGVkZ2Uuc3RhcnRwb2ludFByZXYueSAtIGVkZ2Uuc3RhcnRwb2ludC55O1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgYXNzZXJ0KGVkZ2Uuc3RhcnRwb2ludC54ID09PSBlZGdlLmVuZHBvaW50LngsXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5wb3NpdGlvbl9HZXRSZWFsTzogZWRnZS5zdGFydHBvaW50LnggPT09IGVkZ2UuZW5kcG9pbnQueCBGQUlMRUQnKTtcbiAgICAgICAgaWYgKGVkZ2Uuc3RhcnRwb2ludC55IDwgZWRnZS5lbmRwb2ludC55KSB7XG5cbiAgICAgICAgICAgIG8xID0gZWRnZS5pc1N0YXJ0UG9pbnRQcmV2TnVsbCgpID8gMCA6IGVkZ2Uuc3RhcnRwb2ludFByZXYueCAtIGVkZ2Uuc3RhcnRwb2ludC54O1xuICAgICAgICAgICAgbzIgPSBlZGdlLmlzRW5kUG9pbnROZXh0TnVsbCgpID8gMCA6IGVkZ2UuZW5kcG9pbnROZXh0LnggLSBlZGdlLmVuZHBvaW50Lng7XG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgIG8xID0gZWRnZS5pc0VuZFBvaW50TmV4dE51bGwoKSA/IDAgOiBlZGdlLmVuZHBvaW50TmV4dC54IC0gZWRnZS5lbmRwb2ludC54O1xuICAgICAgICAgICAgbzIgPSBlZGdlLmlzU3RhcnRQb2ludFByZXZOdWxsKCkgPyAwIDogZWRnZS5zdGFydHBvaW50UHJldi54IC0gZWRnZS5zdGFydHBvaW50Lng7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gW28xLCBvMl07XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLl9wb3NpdGlvbkxvYWRZID0gZnVuY3Rpb24gKGVkZ2UpIHtcbiAgICBhc3NlcnQoZWRnZSAhPT0gbnVsbCAmJiBlZGdlLm9yZGVyTmV4dCA9PT0gbnVsbCAmJiBlZGdlLm9yZGVyUHJldiA9PT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZUxpc3QucG9zaXRpb25fTG9hZFk6IGVkZ2UgIT09IG51bGwgJiYgZWRnZS5vcmRlck5leHQgPT09IG51bGwgJiYgZWRnZS5vcmRlclByZXYgPT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICBlZGdlLnBvc2l0aW9uWSA9IHRoaXMuX3Bvc2l0aW9uR2V0UmVhbFkoZWRnZSk7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLl9wb3NpdGlvbkxvYWRCID0gZnVuY3Rpb24gKGVkZ2UpIHtcbiAgICBhc3NlcnQoZWRnZSAhPT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZUxpc3QucG9zaXRpb25fTG9hZEI6IGVkZ2UgIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICBlZGdlLmJyYWNrZXRPcGVuaW5nID0gIWVkZ2UuZWRnZUZpeGVkICYmIHRoaXMuX2JyYWNrZXRJc09wZW5pbmcoZWRnZSk7XG4gICAgZWRnZS5icmFja2V0Q2xvc2luZyA9ICFlZGdlLmVkZ2VGaXhlZCAmJiB0aGlzLl9icmFja2V0SXNDbG9zaW5nKGVkZ2UpO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5fcG9zaXRpb25BbGxTdG9yZVkgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGVkZ2UgPSB0aGlzLm9yZGVyRmlyc3Q7XG4gICAgd2hpbGUgKGVkZ2UpIHtcbiAgICAgICAgdGhpcy5fcG9zaXRpb25TZXRSZWFsWShlZGdlLCBlZGdlLnBvc2l0aW9uWSk7XG4gICAgICAgIGVkZ2UgPSBlZGdlLm9yZGVyTmV4dDtcbiAgICB9XG5cbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuX3Bvc2l0aW9uQWxsTG9hZFggPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGVkZ2UgPSB0aGlzLm9yZGVyRmlyc3QsXG4gICAgICAgIHB0cztcbiAgICB3aGlsZSAoZWRnZSkge1xuICAgICAgICBwdHMgPSB0aGlzLl9wb3NpdGlvbkdldFJlYWxYKGVkZ2UpO1xuICAgICAgICBlZGdlLnBvc2l0aW9uWDEgPSBwdHNbMF07XG4gICAgICAgIGVkZ2UucG9zaXRpb25YMiA9IHB0c1sxXTtcblxuICAgICAgICBlZGdlID0gZWRnZS5vcmRlck5leHQ7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5faW5pdE9yZGVyID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMub3JkZXJGaXJzdCA9IG51bGw7XG4gICAgdGhpcy5vcmRlckxhc3QgPSBudWxsO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5fY2hlY2tPcmRlciA9IGZ1bmN0aW9uICgpIHtcbiAgICBhc3NlcnQodGhpcy5vcmRlckZpcnN0ID09PSBudWxsICYmIHRoaXMub3JkZXJMYXN0ID09PSBudWxsLFxuICAgICAgICAnQVJFZGdlTGlzdC5jaGVja09yZGVyOiB0aGlzLm9yZGVyRmlyc3QgPT09IG51bGwgJiYgdGhpcy5vcmRlckxhc3QgPT09IG51bGwgRkFJTEVEJyk7XG59O1xuXG4vLy0tLU9yZGVyXG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuaW5zZXJ0QmVmb3JlID0gZnVuY3Rpb24gKGVkZ2UsIGJlZm9yZSkge1xuICAgIGFzc2VydChlZGdlICE9PSBudWxsICYmIGJlZm9yZSAhPT0gbnVsbCAmJiBlZGdlICE9PSBiZWZvcmUsXG4gICAgICAgICdBUkVkZ2VMaXN0Lmluc2VydEJlZm9yZTogZWRnZSAhPT0gbnVsbCAmJiBiZWZvcmUgIT09IG51bGwgJiYgZWRnZSAhPT0gYmVmb3JlIEZBSUxFRCcpO1xuICAgIGFzc2VydChlZGdlLm9yZGVyTmV4dCA9PT0gbnVsbCAmJiBlZGdlLm9yZGVyUHJldiA9PT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZUxpc3QuaW5zZXJ0QmVmb3JlOiBlZGdlLm9yZGVyTmV4dCA9PT0gbnVsbCAmJiBlZGdlLm9yZGVyUHJldiA9PT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIGVkZ2Uub3JkZXJQcmV2ID0gYmVmb3JlLm9yZGVyUHJldjtcbiAgICBlZGdlLm9yZGVyTmV4dCA9IGJlZm9yZTtcblxuICAgIGlmIChiZWZvcmUub3JkZXJQcmV2KSB7XG4gICAgICAgIGFzc2VydChiZWZvcmUub3JkZXJQcmV2Lm9yZGVyTmV4dCA9PT0gYmVmb3JlLFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QuaW5zZXJ0QmVmb3JlOiBiZWZvcmUub3JkZXJQcmV2Lm9yZGVyTmV4dCA9PT0gYmVmb3JlIEZBSUxFRFxcbmJlZm9yZS5vcmRlclByZXYub3JkZXJOZXh0ICcgK1xuICAgICAgICAgICAgJ2lzICcgKyBiZWZvcmUub3JkZXJQcmV2Lm9yZGVyTmV4dCArICcgYW5kIGJlZm9yZSBpcyAnICsgYmVmb3JlKTtcblxuICAgICAgICBiZWZvcmUub3JkZXJQcmV2Lm9yZGVyTmV4dCA9IGVkZ2U7XG5cbiAgICAgICAgYXNzZXJ0KHRoaXMub3JkZXJGaXJzdCAhPT0gYmVmb3JlLFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QuaW5zZXJ0QmVmb3JlOiB0aGlzLm9yZGVyRmlyc3QgIT09IGJlZm9yZSBGQUlMRUQnKTtcbiAgICB9IGVsc2Uge1xuXG4gICAgICAgIGFzc2VydCh0aGlzLm9yZGVyRmlyc3QgPT09IGJlZm9yZSxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0Lmluc2VydEJlZm9yZTogdGhpcy5vcmRlckZpcnN0ID09PSBiZWZvcmUgRkFJTEVEJyk7XG4gICAgICAgIHRoaXMub3JkZXJGaXJzdCA9IGVkZ2U7XG4gICAgfVxuXG4gICAgYmVmb3JlLm9yZGVyUHJldiA9IGVkZ2U7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLmluc2VydEFmdGVyID0gZnVuY3Rpb24gKGVkZ2UsIGFmdGVyKSB7XG4gICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwgJiYgYWZ0ZXIgIT09IG51bGwgJiYgIWVkZ2UuZXF1YWxzKGFmdGVyKSxcbiAgICAgICAgJ0FSRWRnZUxpc3QuaW5zZXJ0QWZ0ZXI6ICBlZGdlICE9PSBudWxsICYmIGFmdGVyICE9PSBudWxsICYmICFlZGdlLmVxdWFscyhhZnRlcikgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KGVkZ2Uub3JkZXJOZXh0ID09PSBudWxsICYmIGVkZ2Uub3JkZXJQcmV2ID09PSBudWxsLFxuICAgICAgICAnQVJFZGdlTGlzdC5pbnNlcnRBZnRlcjogZWRnZS5vcmRlck5leHQgPT09IG51bGwgJiYgZWRnZS5vcmRlclByZXYgPT09IG51bGwgRkFJTEVEICcpO1xuXG4gICAgZWRnZS5vcmRlck5leHQgPSBhZnRlci5vcmRlck5leHQ7XG4gICAgZWRnZS5vcmRlclByZXYgPSBhZnRlcjtcblxuICAgIGlmIChhZnRlci5vcmRlck5leHQpIHtcbiAgICAgICAgYXNzZXJ0KGFmdGVyLm9yZGVyTmV4dC5vcmRlclByZXYuZXF1YWxzKGFmdGVyKSxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0Lmluc2VydEFmdGVyOiAgYWZ0ZXIub3JkZXJOZXh0Lm9yZGVyUHJldi5lcXVhbHMoYWZ0ZXIpIEZBSUxFRCcpO1xuICAgICAgICBhZnRlci5vcmRlck5leHQub3JkZXJQcmV2ID0gZWRnZTtcblxuICAgICAgICBhc3NlcnQoIXRoaXMub3JkZXJMYXN0LmVxdWFscyhhZnRlciksICdBUkVkZ2VMaXN0Lmluc2VydEFmdGVyOiAhb3JkZXJMYXN0LmVxdWFscyhhZnRlcikgRkFJTEVEJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgYXNzZXJ0KHRoaXMub3JkZXJMYXN0LmVxdWFscyhhZnRlciksICdBUkVkZ2VMaXN0Lmluc2VydEFmdGVyOiB0aGlzLm9yZGVyTGFzdC5lcXVhbHMoYWZ0ZXIpIEZBSUxFRCcpO1xuICAgICAgICB0aGlzLm9yZGVyTGFzdCA9IGVkZ2U7XG4gICAgfVxuXG4gICAgYWZ0ZXIub3JkZXJOZXh0ID0gZWRnZTtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuaW5zZXJ0TGFzdCA9IGZ1bmN0aW9uIChlZGdlKSB7XG4gICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwsXG4gICAgICAgICdBUkVkZ2VMaXN0Lmluc2VydExhc3Q6IGVkZ2UgIT09IG51bGwgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KGVkZ2Uub3JkZXJQcmV2ID09PSBudWxsICYmIGVkZ2Uub3JkZXJOZXh0ID09PSBudWxsLFxuICAgICAgICAnQVJFZGdlTGlzdC5pbnNlcnRMYXN0OiBlZGdlLm9yZGVyUHJldiA9PT0gbnVsbCAmJiBlZGdlLm9yZGVyTmV4dCA9PT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIGVkZ2Uub3JkZXJQcmV2ID0gdGhpcy5vcmRlckxhc3Q7XG5cbiAgICBpZiAodGhpcy5vcmRlckxhc3QpIHtcbiAgICAgICAgYXNzZXJ0KHRoaXMub3JkZXJMYXN0Lm9yZGVyTmV4dCA9PT0gbnVsbCxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0Lmluc2VydExhc3Q6IHRoaXMub3JkZXJMYXN0Lm9yZGVyTmV4dCA9PT0gbnVsbCBGQUlMRUQnKTtcbiAgICAgICAgYXNzZXJ0KHRoaXMub3JkZXJGaXJzdCAhPT0gbnVsbCxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0Lmluc2VydExhc3Q6IHRoaXMub3JkZXJGaXJzdCAhPSBudWxsIEZBSUxFRCcpO1xuXG4gICAgICAgIHRoaXMub3JkZXJMYXN0Lm9yZGVyTmV4dCA9IGVkZ2U7XG4gICAgICAgIHRoaXMub3JkZXJMYXN0ID0gZWRnZTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBhc3NlcnQodGhpcy5vcmRlckZpcnN0ID09PSBudWxsLFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QuaW5zZXJ0TGFzdDogIHRoaXMub3JkZXJGaXJzdCA9PT0gbnVsbCBGQUlMRUQnKTtcblxuICAgICAgICB0aGlzLm9yZGVyRmlyc3QgPSBlZGdlO1xuICAgICAgICB0aGlzLm9yZGVyTGFzdCA9IGVkZ2U7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5pbnNlcnQgPSBmdW5jdGlvbiAoZWRnZSkge1xuICAgIGFzc2VydChlZGdlICE9PSBudWxsLFxuICAgICAgICAnQVJFZGdlTGlzdC5pbnNlcnQ6ICBlZGdlICE9PSBudWxsIEZBSUxFRCcpO1xuICAgIGFzc2VydChlZGdlLm9yZGVyUHJldiA9PT0gbnVsbCAmJiBlZGdlLm9yZGVyTmV4dCA9PT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZUxpc3QuaW5zZXJ0OiBlZGdlLm9yZGVyUHJldiA9PT0gbnVsbCAmJiBlZGdlLm9yZGVyTmV4dCA9PT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIHZhciB5ID0gZWRnZS5wb3NpdGlvblk7XG5cbiAgICBhc3NlcnQoQ09OU1RBTlRTLkVEX01JTkNPT1JEIDw9IHkgJiYgeSA8PSBDT05TVEFOVFMuRURfTUFYQ09PUkQsXG4gICAgICAgICdBUkVkZ2VMaXN0Lmluc2VydDogQ09OU1RBTlRTLkVEX01JTkNPT1JEIDw9IHkgJiYgeSA8PSBDT05TVEFOVFMuRURfTUFYQ09PUkQgRkFJTEVEICh5IGlzICcgKyB5ICsgJyknKTtcblxuICAgIHZhciBpbnNlcnQgPSB0aGlzLm9yZGVyRmlyc3Q7XG5cbiAgICB3aGlsZSAoaW5zZXJ0ICYmIGluc2VydC5wb3NpdGlvblkgPCB5KSB7XG4gICAgICAgIGluc2VydCA9IGluc2VydC5vcmRlck5leHQ7XG4gICAgfVxuXG4gICAgaWYgKGluc2VydCkge1xuICAgICAgICB0aGlzLmluc2VydEJlZm9yZShlZGdlLCBpbnNlcnQpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuaW5zZXJ0TGFzdChlZGdlKTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLnJlbW92ZSA9IGZ1bmN0aW9uIChlZGdlKSB7XG4gICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwsXG4gICAgICAgICdBUkVkZ2VMaXN0LnJlbW92ZTogIGVkZ2UgIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICBpZiAodGhpcy5vcmRlckZpcnN0ID09PSBlZGdlKSB7XG4gICAgICAgIHRoaXMub3JkZXJGaXJzdCA9IGVkZ2Uub3JkZXJOZXh0O1xuICAgIH1cblxuICAgIGlmIChlZGdlLm9yZGVyTmV4dCkge1xuICAgICAgICBlZGdlLm9yZGVyTmV4dC5vcmRlclByZXYgPSBlZGdlLm9yZGVyUHJldjtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5vcmRlckxhc3QgPT09IGVkZ2UpIHtcbiAgICAgICAgdGhpcy5vcmRlckxhc3QgPSBlZGdlLm9yZGVyUHJldjtcbiAgICB9XG5cbiAgICBpZiAoZWRnZS5vcmRlclByZXYpIHtcbiAgICAgICAgZWRnZS5vcmRlclByZXYub3JkZXJOZXh0ID0gZWRnZS5vcmRlck5leHQ7XG4gICAgfVxuXG4gICAgZWRnZS5vcmRlck5leHQgPSBudWxsO1xuICAgIGVkZ2Uub3JkZXJQcmV2ID0gbnVsbDtcbn07XG5cbi8vLS0gUHJpdmF0ZVxuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLl9zbGlkZUJ1dE5vdFBhc3NFZGdlcyA9IGZ1bmN0aW9uIChlZGdlLCB5KSB7XG4gICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwsICdBUkVkZ2VMaXN0LnNsaWRlQnV0Tm90UGFzc0VkZ2VzOiBlZGdlICE9IG51bGwgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KENPTlNUQU5UUy5FRF9NSU5DT09SRCA8IHkgJiYgeSA8IENPTlNUQU5UUy5FRF9NQVhDT09SRCxcbiAgICAgICAgJ0FSRWRnZUxpc3Quc2xpZGVCdXROb3RQYXNzRWRnZXM6IENPTlNUQU5UUy5FRF9NSU5DT09SRCA8IHkgJiYgeSA8IENPTlNUQU5UUy5FRF9NQVhDT09SRCBGQUlMRUQnKTtcblxuICAgIHZhciBvbGR5ID0gZWRnZS5wb3NpdGlvblk7XG4gICAgYXNzZXJ0KENPTlNUQU5UUy5FRF9NSU5DT09SRCA8IG9sZHkgJiYgb2xkeSA8IENPTlNUQU5UUy5FRF9NQVhDT09SRCxcbiAgICAgICAgJ0FSRWRnZUxpc3Quc2xpZGVCdXROb3RQYXNzRWRnZXM6IENPTlNUQU5UUy5FRF9NSU5DT09SRCA8IG9sZHkgJiYgb2xkeSA8IENPTlNUQU5UUy5FRF9NQVhDT09SRCBGQUlMRUQnKTtcblxuICAgIGlmIChvbGR5ID09PSB5KSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHZhciB4MSA9IGVkZ2UucG9zaXRpb25YMSxcbiAgICAgICAgeDIgPSBlZGdlLnBvc2l0aW9uWDIsXG4gICAgICAgIHJldCA9IG51bGwsXG4gICAgICAgIGluc2VydCA9IGVkZ2U7XG5cbiAgICAvL0lmIHdlIGFyZSB0cnlpbmcgdG8gc2xpZGUgZG93blxuXG4gICAgaWYgKG9sZHkgPCB5KSB7XG4gICAgICAgIHdoaWxlIChpbnNlcnQub3JkZXJOZXh0KSB7XG4gICAgICAgICAgICBpbnNlcnQgPSBpbnNlcnQub3JkZXJOZXh0O1xuXG4gICAgICAgICAgICBpZiAoeSA8IGluc2VydC5wb3NpdGlvblkpIHtcbiAgICAgICAgICAgICAgICAvL1RoZW4gd2Ugd29uJ3QgYmUgc2hpZnRpbmcgcGFzdCB0aGUgbmV3IGVkZ2UgKGluc2VydClcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy9JZiB5b3UgY2FuJ3QgcGFzcyB0aGUgZWRnZSAoYnV0IHdhbnQgdG8pIGFuZCB0aGUgbGluZXMgd2lsbCBvdmVybGFwIHggdmFsdWVzLi4uXG4gICAgICAgICAgICBpZiAoIWluc2VydC5nZXRFZGdlQ2FucGFzc2VkKCkgJiYgVXRpbHMuaW50ZXJzZWN0KHgxLCB4MiwgaW5zZXJ0LnBvc2l0aW9uWDEsIGluc2VydC5wb3NpdGlvblgyKSkge1xuICAgICAgICAgICAgICAgIHJldCA9IGluc2VydDtcbiAgICAgICAgICAgICAgICB5ID0gaW5zZXJ0LnBvc2l0aW9uWTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChlZGdlICE9PSBpbnNlcnQgJiYgaW5zZXJ0Lm9yZGVyUHJldiAhPT0gZWRnZSkge1xuICAgICAgICAgICAgdGhpcy5yZW1vdmUoZWRnZSk7XG4gICAgICAgICAgICB0aGlzLmluc2VydEJlZm9yZShlZGdlLCBpbnNlcnQpO1xuICAgICAgICB9XG5cbiAgICB9IGVsc2UgeyAvLyBJZiB3ZSBhcmUgdHJ5aW5nIHRvIHNsaWRlIHVwXG4gICAgICAgIHdoaWxlIChpbnNlcnQub3JkZXJQcmV2KSB7XG4gICAgICAgICAgICBpbnNlcnQgPSBpbnNlcnQub3JkZXJQcmV2O1xuXG4gICAgICAgICAgICBpZiAoeSA+IGluc2VydC5wb3NpdGlvblkpIHtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy9JZiBpbnNlcnQgY2Fubm90IGJlIHBhc3NlZCBhbmQgaXQgaXMgaW4gdGhlIHdheSBvZiB0aGUgZWRnZSAoaWYgdGhlIGVkZ2Ugd2VyZSB0byBzbGlkZSB1cCkuXG4gICAgICAgICAgICBpZiAoIWluc2VydC5nZXRFZGdlQ2FucGFzc2VkKCkgJiYgVXRpbHMuaW50ZXJzZWN0KHgxLCB4MiwgaW5zZXJ0LnBvc2l0aW9uWDEsIGluc2VydC5wb3NpdGlvblgyKSkge1xuICAgICAgICAgICAgICAgIHJldCA9IGluc2VydDtcbiAgICAgICAgICAgICAgICB5ID0gaW5zZXJ0LnBvc2l0aW9uWTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChlZGdlICE9PSBpbnNlcnQgJiYgaW5zZXJ0Lm9yZGVyTmV4dCAhPT0gZWRnZSkge1xuICAgICAgICAgICAgdGhpcy5yZW1vdmUoZWRnZSk7Ly9UaGlzIGlzIHdoZXJlIEkgYmVsaWV2ZSB0aGUgZXJyb3IgY291bGQgbGllIVxuICAgICAgICAgICAgdGhpcy5pbnNlcnRBZnRlcihlZGdlLCBpbnNlcnQpO1xuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICBlZGdlLnBvc2l0aW9uWSA9IHk7XG5cbiAgICByZXR1cm4gcmV0O1xufTtcblxuLy8tLS0tLS1TZWN0aW9uXG5cbi8vIHByaXZhdGVcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5faW5pdFNlY3Rpb24gPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5zZWN0aW9uRmlyc3QgPSBudWxsO1xuICAgIHRoaXMuc2VjdGlvbkJsb2NrZXIgPSBudWxsO1xuICAgIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkID0gbnVsbDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuY2hlY2tTZWN0aW9uID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICghKHRoaXMuc2VjdGlvbkJsb2NrZXIgPT09IG51bGwgJiYgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgPT09IG51bGwpKSB7XG4gICAgICAgIC8vIFRoaXMgdXNlZCB0byBiZSBjb250YWluZWQgaW4gYW4gYXNzZXJ0LlxuICAgICAgICAvLyBHZW5lcmFsbHkgdGhpcyBmYWlscyB3aGVuIHRoZSByb3V0ZXIgZG9lcyBub3QgaGF2ZSBhIGNsZWFuIGV4aXQgdGhlbiBpcyBhc2tlZCB0byByZXJvdXRlLlxuICAgICAgICB0aGlzLl9sb2dnZXIud2Fybignc2VjdGlvbkJsb2NrZXIgYW5kIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkIGFyZSBub3QgbnVsbC4gJyArXG4gICAgICAgICdBc3N1bWluZyBsYXN0IHJ1biBkaWQgbm90IGV4aXQgY2xlYW5seS4gRml4aW5nLi4uJyk7XG4gICAgICAgIHRoaXMuc2VjdGlvbkJsb2NrZXIgPSBudWxsO1xuICAgICAgICB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCA9IG51bGw7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5zZWN0aW9uUmVzZXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5jaGVja1NlY3Rpb24oKTtcblxuICAgIHRoaXMuc2VjdGlvbkZpcnN0ID0gbnVsbDtcbn07XG5cbi8qKlxuICogSW5pdGlhbGl6ZSB0aGUgc2VjdGlvbiBkYXRhIHN0cnVjdHVyZS5cbiAqXG4gKiBAcGFyYW0gYmxvY2tlclxuICogQHJldHVybiB7dW5kZWZpbmVkfVxuICovXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLl9zZWN0aW9uQmVnaW5TY2FuID0gZnVuY3Rpb24gKGJsb2NrZXIpIHtcbiAgICB0aGlzLmNoZWNrU2VjdGlvbigpO1xuXG4gICAgdGhpcy5zZWN0aW9uQmxvY2tlciA9IGJsb2NrZXI7XG5cbiAgICB0aGlzLnNlY3Rpb25CbG9ja2VyLnNlY3Rpb25YMSA9IHRoaXMuc2VjdGlvbkJsb2NrZXIucG9zaXRpb25YMTtcbiAgICB0aGlzLnNlY3Rpb25CbG9ja2VyLnNlY3Rpb25YMiA9IHRoaXMuc2VjdGlvbkJsb2NrZXIucG9zaXRpb25YMjtcblxuICAgIHRoaXMuc2VjdGlvbkJsb2NrZXIuc2V0U2VjdGlvbk5leHQobnVsbCk7XG4gICAgdGhpcy5zZWN0aW9uQmxvY2tlci5zZXRTZWN0aW9uRG93bihudWxsKTtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuX3NlY3Rpb25Jc0ltbWVkaWF0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICBhc3NlcnQodGhpcy5zZWN0aW9uQmxvY2tlciAhPT0gbnVsbCAmJiB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCAhPT0gbnVsbCAmJiB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCAhPT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZUxpc3QuX3NlY3Rpb25Jc0ltbWVkaWF0ZTogdGhpcy5zZWN0aW9uQmxvY2tlciAhPSBudWxsICYmIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkICE9IG51bGwgJyArXG4gICAgICAgICcmJiAqc2VjdGlvblB0cjJCbG9ja2VkICE9IG51bGwgRkFJTEVEJyk7XG5cbiAgICB2YXIgc2VjdGlvbkJsb2NrZWQgPSB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZFswXSxcbiAgICAgICAgZSA9IHNlY3Rpb25CbG9ja2VkLmdldFNlY3Rpb25Eb3duKCksXG4gICAgICAgIGExID0gc2VjdGlvbkJsb2NrZWQuc2VjdGlvblgxLFxuICAgICAgICBhMiA9IHNlY3Rpb25CbG9ja2VkLnNlY3Rpb25YMixcbiAgICAgICAgcDEgPSBzZWN0aW9uQmxvY2tlZC5wb3NpdGlvblgxLFxuICAgICAgICBwMiA9IHNlY3Rpb25CbG9ja2VkLnBvc2l0aW9uWDIsXG4gICAgICAgIGIxID0gdGhpcy5zZWN0aW9uQmxvY2tlci5zZWN0aW9uWDEsXG4gICAgICAgIGIyID0gdGhpcy5zZWN0aW9uQmxvY2tlci5zZWN0aW9uWDI7XG5cbiAgICBpZiAoZSAhPT0gbnVsbCkge1xuICAgICAgICBlID0gKGUuc3RhcnRwb2ludCA9PT0gbnVsbCB8fCBlLnNlY3Rpb25YMSA9PT0gdW5kZWZpbmVkID8gbnVsbCA6IGUpO1xuICAgIH1cblxuICAgIGFzc2VydChiMSA8PSBhMiAmJiBhMSA8PSBiMixcbiAgICAgICAgJ0FSRWRnZUxpc3QuX3NlY3Rpb25Jc0ltbWVkaWF0ZTogYjEgPD0gYTIgJiYgYTEgPD0gYjIgRkFJTEVEJyk7ICAgICAgICAgICAgICAgICAgICAgLy8gbm90IGNhc2UgMSBvciA2XG5cbiAgICAvLyBOT1RFIFdFIENIQU5HRUQgVEhFIENPTkRJVElPTlMgKEExPD1CMSBBTkQgQjI8PUEyKVxuICAgIC8vIEJFQ0FVU0UgSEVSRSBXRSBORUVEIFRISVMhXG5cbiAgICBpZiAoYTEgPD0gYjEpIHtcbiAgICAgICAgd2hpbGUgKCEoZSA9PT0gbnVsbCB8fCBlLnN0YXJ0cG9pbnQgPT09IG51bGwpICYmIGUuc2VjdGlvblgyIDwgYjEpIHtcbiAgICAgICAgICAgIGUgPSBlLmdldFNlY3Rpb25OZXh0KCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYjIgPD0gYTIpIHtcbiAgICAgICAgICAgIHJldHVybiAoZSA9PT0gbnVsbCB8fCBlLnN0YXJ0cG9pbnQgPT09IG51bGwpIHx8IGIyIDwgZS5zZWN0aW9uWDE7ICAgICAgICAgICAgICAgLy8gY2FzZSAzXG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gKGUgPT09IG51bGwgfHwgZS5zdGFydHBvaW50ID09PSBudWxsKSAmJiBhMiA9PT0gcDI7ICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjYXNlIDJcbiAgICB9XG5cbiAgICBpZiAoYjIgPD0gYTIpIHtcbiAgICAgICAgcmV0dXJuIGExID09PSBwMSAmJiAoKGUgPT09IG51bGwgfHwgZS5zdGFydHBvaW50ID09PSBudWxsKSB8fCBiMiA8IGUuc2VjdGlvblgxKTsgICAgLy8gY2FzZSA1XG4gICAgfVxuXG4gICAgcmV0dXJuIChlID09PSBudWxsIHx8IGUuc3RhcnRwb2ludCA9PT0gbnVsbCkgJiYgYTEgPT09IHAxICYmIGEyID09PSBwMjsgICAgICAgICAgICAgICAgIC8vIGNhc2UgNFxufTtcblxuXG4vLyBUaGUgZm9sbG93aW5nIG1ldGhvZHMgYXJlIGNvbnZlbmllbmNlIG1ldGhvZHMgZm9yIGFkanVzdGluZyB0aGUgJ3NlY3Rpb24nIFxuLy8gb2YgYW4gZWRnZS5cbi8qKlxuICogR2V0IGVpdGhlciBtaW4rMSBvciBhIHZhbHVlIGJldHdlZW4gbWluIGFuZCBtYXguIFRlY2huaWNhbGx5LFxuICogd2UgYXJlIGxvb2tpbmcgZm9yIFttaW4sIG1heCkuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IG1pblxuICogQHBhcmFtIHtOdW1iZXJ9IG1heFxuICogQHJldHVybiB7TnVtYmVyfSByZXN1bHRcbiAqL1xudmFyIGdldExhcmdlckVuZHBvaW50ID0gZnVuY3Rpb24gKG1pbiwgbWF4KSB7XG4gICAgdmFyIHJlc3VsdDtcbiAgICBhc3NlcnQobWluIDwgbWF4KTtcblxuICAgIHJlc3VsdCA9IE1hdGgubWluKG1pbiArIDEsIChtaW4gKyBtYXgpIC8gMik7XG4gICAgaWYgKHJlc3VsdCA9PT0gbWF4KSB7XG4gICAgICAgIHJlc3VsdCA9IG1pbjtcbiAgICB9XG4gICAgYXNzZXJ0KHJlc3VsdCA8IG1heCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbi8qKlxuICogR2V0IGVpdGhlciBtYXgtMSBvciBhIHZhbHVlIGJldHdlZW4gbWluIGFuZCBtYXguIFRlY2huaWNhbGx5LFxuICogd2UgYXJlIGxvb2tpbmcgZm9yIChtaW4sIG1heF0uXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IG1pblxuICogQHBhcmFtIHtOdW1iZXJ9IG1heFxuICogQHJldHVybiB7TnVtYmVyfSByZXN1bHRcbiAqL1xudmFyIGdldFNtYWxsZXJFbmRwb2ludCA9IGZ1bmN0aW9uIChtaW4sIG1heCkge1xuICAgIHZhciByZXN1bHQ7XG4gICAgYXNzZXJ0KG1pbiA8IG1heCk7XG5cbiAgICAvLyBJZiBtaW4gaXMgc28gc21hbGwgdGhhdCBcbiAgICAvLyBcbiAgICAvLyAgICAgIChtaW4rbWF4KS8yID09PSBtaW5cbiAgICAvL1xuICAgIC8vIHRoZW4gd2Ugd2lsbCBzaW1wbHkgdXNlIG1heCB2YWx1ZSBmb3IgdGhlIHJlc3VsdFxuICAgIHJlc3VsdCA9IE1hdGgubWF4KG1heCAtIDEsIChtaW4gKyBtYXgpIC8gMik7XG4gICAgaWYgKHJlc3VsdCA9PT0gbWluKSB7XG4gICAgICAgIHJlc3VsdCA9IG1heDtcbiAgICB9XG5cbiAgICBhc3NlcnQocmVzdWx0ID4gbWluKTtcbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5fc2VjdGlvbkhhc0Jsb2NrZWRFZGdlID0gZnVuY3Rpb24gKCkge1xuICAgIGFzc2VydCh0aGlzLnNlY3Rpb25CbG9ja2VyICE9PSBudWxsLFxuICAgICAgICAnQVJFZGdlTGlzdC5fc2VjdGlvbkhhc0Jsb2NrZWRFZGdlOiB0aGlzLnNlY3Rpb25CbG9ja2VyICE9IG51bGwgRkFJTEVEJyk7XG5cbiAgICB2YXIgbmV3U2VjdGlvblgxLFxuICAgICAgICBuZXdTZWN0aW9uWDIsXG4gICAgICAgIGUsXG4gICAgICAgIGJsb2NrZXJYMSA9IHRoaXMuc2VjdGlvbkJsb2NrZXIuc2VjdGlvblgxLFxuICAgICAgICBibG9ja2VyWDIgPSB0aGlzLnNlY3Rpb25CbG9ja2VyLnNlY3Rpb25YMjtcblxuICAgIGFzc2VydChibG9ja2VyWDEgPD0gYmxvY2tlclgyLFxuICAgICAgICAnQVJFZGdlTGlzdC5fc2VjdGlvbkhhc0Jsb2NrZWRFZGdlOiBibG9ja2VyWDEgPD0gYmxvY2tlclgyIEZBSUxFRCcpO1xuXG4gICAgLy8gU2V0dGluZyB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZFxuICAgIGlmICh0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCA9PT0gbnVsbCkgeyAgLy8gaW5pdGlhbGl6ZSBzZWN0aW9uUHRyMkJsb2NrZWRcblxuICAgICAgICB0aGlzLnNlY3Rpb25GaXJzdCA9IHRoaXMuc2VjdGlvbkZpcnN0ID09PSBudWxsID8gW25ldyBBdXRvUm91dGVyRWRnZSgpXSA6IHRoaXMuc2VjdGlvbkZpcnN0O1xuICAgICAgICB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCA9IHRoaXMuc2VjdGlvbkZpcnN0O1xuICAgIH0gZWxzZSB7ICAgLy8gZ2V0IG5leHQgc2VjdGlvblB0cjJCbG9ja2VkXG4gICAgICAgIHZhciBjdXJyZW50RWRnZSA9IHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkWzBdO1xuXG4gICAgICAgIGFzc2VydChjdXJyZW50RWRnZS5zdGFydHBvaW50ICE9PSBudWxsLFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QuX3NlY3Rpb25IYXNCbG9ja2VkRWRnZTogY3VycmVudEVkZ2Uuc3RhcnRwb2ludCA9PT0gbnVsbCcpO1xuXG4gICAgICAgIHZhciBvID0gbnVsbDtcblxuICAgICAgICBlID0gY3VycmVudEVkZ2UuZ2V0U2VjdGlvbkRvd25QdHIoKVswXTtcbiAgICAgICAgbmV3U2VjdGlvblgxID0gY3VycmVudEVkZ2Uuc2VjdGlvblgxO1xuICAgICAgICBuZXdTZWN0aW9uWDIgPSBjdXJyZW50RWRnZS5zZWN0aW9uWDI7XG5cbiAgICAgICAgYXNzZXJ0KG5ld1NlY3Rpb25YMSA8PSBuZXdTZWN0aW9uWDIsXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5fc2VjdGlvbkhhc0Jsb2NrZWRFZGdlOiBuZXdTZWN0aW9uWDEgPD0gbmV3U2VjdGlvblgyIEZBSUxFRCAoJyArIG5ld1NlY3Rpb25YMSArXG4gICAgICAgICAgICAnIDw9ICcgKyBuZXdTZWN0aW9uWDIgKyAnKScgKyAnXFxuZWRnZSBpcyAnKTtcblxuICAgICAgICBhc3NlcnQoYmxvY2tlclgxIDw9IG5ld1NlY3Rpb25YMiAmJiBuZXdTZWN0aW9uWDEgPD0gYmxvY2tlclgyLFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QuX3NlY3Rpb25IYXNCbG9ja2VkRWRnZTogYmxvY2tlclgxIDw9IG5ld1NlY3Rpb25YMiAmJiAgbmV3U2VjdGlvblgxIDw9IGJsb2NrZXJYMiBGQUlMRUQnKTtcbiAgICAgICAgLy8gbm90IGNhc2UgMSBvciA2XG4gICAgICAgIGlmIChuZXdTZWN0aW9uWDEgPCBibG9ja2VyWDEgJiYgYmxvY2tlclgyIDwgbmV3U2VjdGlvblgyKSB7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY2FzZSAzXG4gICAgICAgICAgICB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCA9IGN1cnJlbnRFZGdlLmdldFNlY3Rpb25Eb3duUHRyKCk7XG5cbiAgICAgICAgfSBlbHNlIGlmIChibG9ja2VyWDEgPD0gbmV3U2VjdGlvblgxICYmIG5ld1NlY3Rpb25YMiA8PSBibG9ja2VyWDIpIHsgICAgICAgICAgICAgICAgICAgICAgICAvLyBjYXNlIDRcblxuICAgICAgICAgICAgaWYgKGUgJiYgZS5zdGFydHBvaW50ICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgd2hpbGUgKGUuZ2V0U2VjdGlvbk5leHQoKSAmJiBlLmdldFNlY3Rpb25OZXh0KCkuc3RhcnRwb2ludCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICBlID0gZS5nZXRTZWN0aW9uTmV4dCgpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGUuc2V0U2VjdGlvbk5leHQoY3VycmVudEVkZ2UuZ2V0U2VjdGlvbk5leHQoKSk7XG4gICAgICAgICAgICAgICAgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRbMF0gPSBjdXJyZW50RWRnZS5nZXRTZWN0aW9uRG93bigpO1xuICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkWzBdID0gKGN1cnJlbnRFZGdlLmdldFNlY3Rpb25OZXh0KCkpO1xuXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoYmxvY2tlclgxIDw9IG5ld1NlY3Rpb25YMSAmJiBibG9ja2VyWDIgPCBuZXdTZWN0aW9uWDIpIHsgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY2FzZSA1XG5cbiAgICAgICAgICAgIGFzc2VydChuZXdTZWN0aW9uWDEgPD0gYmxvY2tlclgyLFxuICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0Ll9zZWN0aW9uSGFzQmxvY2tlZEVkZ2U6IG5ld1NlY3Rpb25YMSA8PSBibG9ja2VyWDIgRkFJTEVEJyk7XG5cbiAgICAgICAgICAgIC8vIE1vdmUgbmV3U2VjdGlvblgxIHN1Y2ggdGhhdCBibG9ja2VyWDIgPCBuZXdTZWN0aW9uWDEgPCBuZXdTZWN0aW9uWDJcbiAgICAgICAgICAgIG5ld1NlY3Rpb25YMSA9IGdldExhcmdlckVuZHBvaW50KGJsb2NrZXJYMiwgbmV3U2VjdGlvblgyKTtcblxuICAgICAgICAgICAgd2hpbGUgKChlICYmIGUuc3RhcnRwb2ludCAhPT0gbnVsbCkgJiYgZS5zZWN0aW9uWDEgPD0gbmV3U2VjdGlvblgxKSB7XG4gICAgICAgICAgICAgICAgYXNzZXJ0KGUuc2VjdGlvblgxIDw9IGUuc2VjdGlvblgyLFxuICAgICAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5fc2VjdGlvbkhhc0Jsb2NrZWRFZGdlOiBlLnNlY3Rpb25YMSA8PSBlLnNlY3Rpb25YMiBGQUlMRUQnKTtcblxuICAgICAgICAgICAgICAgIGlmIChuZXdTZWN0aW9uWDEgPD0gZS5zZWN0aW9uWDIpIHtcbiAgICAgICAgICAgICAgICAgICAgbmV3U2VjdGlvblgxID0gZ2V0TGFyZ2VyRW5kcG9pbnQoZS5zZWN0aW9uWDIsIG5ld1NlY3Rpb25YMik7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbyA9IGU7XG4gICAgICAgICAgICAgICAgZSA9IGUuZ2V0U2VjdGlvbk5leHQoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG8pIHtcbiAgICAgICAgICAgICAgICAvLyBJbnNlcnQgY3VycmVudEVkZ2UgdG8gYmUgc2VjdGlvbk5leHQgb2YgdGhlIGdpdmVuIGVkZ2UgaW4gdGhlIGxpc3QgXG4gICAgICAgICAgICAgICAgLy8gb2Ygc2VjdGlvbkRvd24gKGJhc2ljYWxseSwgY29sbGFwc2luZyBjdXJyZW50RWRnZSBpbnRvIHRoZSBzZWN0aW9uRG93biBcbiAgICAgICAgICAgICAgICAvLyBsaXN0LiBUaGUgdmFsdWVzIGluIHRoZSBsaXN0IGZvbGxvd2luZyBjdXJyZW50RWRnZSB3aWxsIHRoZW4gYmUgc2V0IHRvIFxuICAgICAgICAgICAgICAgIC8vIGJlIHNlY3Rpb25Eb3duIG9mIHRoZSBjdXJyZW50RWRnZS4pXG4gICAgICAgICAgICAgICAgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRbMF0gPSBjdXJyZW50RWRnZS5nZXRTZWN0aW9uRG93blB0cigpWzBdO1xuICAgICAgICAgICAgICAgIG8uc2V0U2VjdGlvbk5leHQoY3VycmVudEVkZ2UpO1xuICAgICAgICAgICAgICAgIGN1cnJlbnRFZGdlLnNldFNlY3Rpb25Eb3duKGUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBhc3NlcnQoYmxvY2tlclgyIDwgbmV3U2VjdGlvblgxLFxuICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0Ll9zZWN0aW9uSGFzQmxvY2tlZEVkZ2U6IGJsb2NrZXJYMiA8IG5ld1NlY3Rpb25YMSBGQUlMRUQgKCcgK1xuICAgICAgICAgICAgICAgIGJsb2NrZXJYMiArICcgPCAnICsgbmV3U2VjdGlvblgxICsgJykgJyArXG4gICAgICAgICAgICAgICAgY3VycmVudEVkZ2Uuc2VjdGlvblgyICsgJyBpcyAnICsgbmV3U2VjdGlvblgyICsgJyknKTtcbiAgICAgICAgICAgIC8vIFNoaWZ0aW5nIHRoZSBmcm9udCBvZiB0aGUgcDJiIHNvIGl0IG5vIGxvbmdlciBvdmVybGFwcyB0aGlzLnNlY3Rpb25CbG9ja2VyXG5cbiAgICAgICAgICAgIGN1cnJlbnRFZGdlLnNlY3Rpb25YMSA9IG5ld1NlY3Rpb25YMTtcblxuICAgICAgICAgICAgYXNzZXJ0KGN1cnJlbnRFZGdlLnNlY3Rpb25YMSA8IGN1cnJlbnRFZGdlLnNlY3Rpb25YMixcbiAgICAgICAgICAgICAgICAnY3VycmVudEVkZ2Uuc2VjdGlvblgxIDwgY3VycmVudEVkZ2Uuc2VjdGlvblgyICgnICtcbiAgICAgICAgICAgICAgICBjdXJyZW50RWRnZS5zZWN0aW9uWDEgKyAnIDwgJyArIGN1cnJlbnRFZGdlLnNlY3Rpb25YMiArICcpJyk7XG4gICAgICAgIH0gZWxzZSB7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNhc2UgMlxuICAgICAgICAgICAgYXNzZXJ0KG5ld1NlY3Rpb25YMSA8IGJsb2NrZXJYMSAmJiBibG9ja2VyWDEgPD0gbmV3U2VjdGlvblgyICYmIG5ld1NlY3Rpb25YMiA8PSBibG9ja2VyWDIsXG4gICAgICAgICAgICAgICAgJ0FSRWRnZUxpc3QuX3NlY3Rpb25IYXNCbG9ja2VkRWRnZTogIG5ld1NlY3Rpb25YMSA8IGJsb2NrZXJYMSAmJiBibG9ja2VyWDEgPD0gbmV3U2VjdGlvblgyICYmICcgK1xuICAgICAgICAgICAgICAgICduZXdTZWN0aW9uWDIgPD0gYmxvY2tlclgyIEZBSUxFRCcpO1xuXG4gICAgICAgICAgICB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCA9IGN1cnJlbnRFZGdlLmdldFNlY3Rpb25Eb3duUHRyKCk7XG5cbiAgICAgICAgICAgIHdoaWxlIChlICYmIGUuc3RhcnRwb2ludCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIG8gPSBlO1xuICAgICAgICAgICAgICAgIGUgPSBlLmdldFNlY3Rpb25OZXh0KCk7XG5cbiAgICAgICAgICAgICAgICBpZiAoby5zZWN0aW9uWDIgKyAxIDwgYmxvY2tlclgxICYmIChlID09PSBudWxsIHx8IGUuc3RhcnRwb2ludCA9PT0gbnVsbCB8fFxuICAgICAgICAgICAgICAgICAgICBvLnNlY3Rpb25YMiArIDEgPCBlLnNlY3Rpb25YMSkpIHtcblxuICAgICAgICAgICAgICAgICAgICB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCA9IG8uZ2V0U2VjdGlvbk5leHRQdHIoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZFswXS5zdGFydHBvaW50ICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgYXNzZXJ0KG8gIT09IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0Ll9zZWN0aW9uSGFzQmxvY2tlZEVkZ2U6IG8gIT0gbnVsbCBGQUlMRUQnKTtcbiAgICAgICAgICAgICAgICBvLnNldFNlY3Rpb25OZXh0KGN1cnJlbnRFZGdlLmdldFNlY3Rpb25OZXh0KCkpO1xuXG4gICAgICAgICAgICAgICAgdmFyIGxhcmdlciA9IGJsb2NrZXJYMTtcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZFswXS5zZWN0aW9uWDEgPCBibG9ja2VyWDEpIHtcbiAgICAgICAgICAgICAgICAgICAgbGFyZ2VyID0gdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRbMF0uc2VjdGlvblgxO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGN1cnJlbnRFZGdlLnNlY3Rpb25YMiA9IGdldFNtYWxsZXJFbmRwb2ludChuZXdTZWN0aW9uWDEsIGxhcmdlcik7XG5cbiAgICAgICAgICAgICAgICBjdXJyZW50RWRnZS5zZXRTZWN0aW9uTmV4dCh0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZFswXSk7XG4gICAgICAgICAgICAgICAgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRbMF0gPSBuZXcgQXV0b1JvdXRlckVkZ2UoKTsgLy9UaGlzIHNlZW1zIG9kZFxuICAgICAgICAgICAgICAgIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkID0gbnVsbDtcblxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50RWRnZS5zZWN0aW9uWDIgPSBnZXRTbWFsbGVyRW5kcG9pbnQobmV3U2VjdGlvblgxLCBibG9ja2VyWDEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBhc3NlcnQoY3VycmVudEVkZ2Uuc2VjdGlvblgxIDwgY3VycmVudEVkZ2Uuc2VjdGlvblgyLFxuICAgICAgICAgICAgICAgICdFeHBlY3RlZCBzZWN0aW9uWDEgPCBzZWN0aW9uWDIgYnV0ICcgKyBjdXJyZW50RWRnZS5zZWN0aW9uWDEgK1xuICAgICAgICAgICAgICAgICcgaXMgbm90IDwgJyArIGN1cnJlbnRFZGdlLnNlY3Rpb25YMik7XG5cbiAgICAgICAgICAgIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkID0gY3VycmVudEVkZ2UuZ2V0U2VjdGlvbk5leHRQdHIoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzc2VydCh0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCAhPT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZUxpc3QuX3NlY3Rpb25IYXNCbG9ja2VkRWRnZTogdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgIT0gbnVsbCBGQUlMRUQnKTtcbiAgICB3aGlsZSAodGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRbMF0gIT09IG51bGwgJiYgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRbMF0uc3RhcnRwb2ludCAhPT0gbnVsbCkge1xuICAgICAgICBuZXdTZWN0aW9uWDEgPSB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZFswXS5zZWN0aW9uWDE7XG4gICAgICAgIG5ld1NlY3Rpb25YMiA9IHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkWzBdLnNlY3Rpb25YMjtcblxuICAgICAgICBpZiAobmV3U2VjdGlvblgyIDwgYmxvY2tlclgxKSB7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNhc2UgMVxuICAgICAgICAgICAgLy9JZiB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCBpcyBjb21wbGV0ZWx5IHRvIHRoZSBsZWZ0IChvciBhYm92ZSkgdGhpcy5zZWN0aW9uQmxvY2tlclxuICAgICAgICAgICAgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgPSB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZFswXS5nZXRTZWN0aW9uTmV4dFB0cigpO1xuXG4gICAgICAgICAgICBhc3NlcnQodGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgIT09IG51bGwsXG4gICAgICAgICAgICAgICAgJ0FSRWRnZUxpc3QuX3NlY3Rpb25IYXNCbG9ja2VkRWRnZTogdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgIT0gbnVsbCBGQUlMRUQnKTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9IGVsc2UgaWYgKGJsb2NrZXJYMiA8IG5ld1NlY3Rpb25YMSkgeyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjYXNlIDZcbiAgICAgICAgICAgIC8vSWYgdGhpcy5zZWN0aW9uQmxvY2tlciBpcyBjb21wbGV0ZWx5IHRvIHRoZSByaWdodCAob3IgYmVsb3cpIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkXG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChuZXdTZWN0aW9uWDEgPCBibG9ja2VyWDEgJiYgYmxvY2tlclgyIDwgbmV3U2VjdGlvblgyKSB7ICAgICAgICAgICAgICAgICAgICAgLy8gY2FzZSAzXG4gICAgICAgICAgICAvL0lmIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkIHN0YXJ0cyBiZWZvcmUgYW5kIGVuZHMgYWZ0ZXIgdGhpcy5zZWN0aW9uQmxvY2tlclxuICAgICAgICAgICAgdmFyIHggPSBibG9ja2VyWDE7XG4gICAgICAgICAgICBlID0gdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRbMF0uZ2V0U2VjdGlvbkRvd24oKTtcblxuICAgICAgICAgICAgZm9yICg7IDspIHtcblxuICAgICAgICAgICAgICAgIGlmIChlID09PSBudWxsIHx8IGUuc3RhcnRwb2ludCA9PT0gbnVsbCB8fCB4IDwgZS5zZWN0aW9uWDEpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh4IDw9IGUuc2VjdGlvblgyKSB7XG4gICAgICAgICAgICAgICAgICAgIHggPSBlLnNlY3Rpb25YMiArIDE7XG4gICAgICAgICAgICAgICAgICAgIGlmIChibG9ja2VyWDIgPCB4KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGUgPSBlLmdldFNlY3Rpb25OZXh0KCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkID0gdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRbMF0uZ2V0U2VjdGlvbkRvd25QdHIoKTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIC8vIFRoaXMgbGVhdmVzIHRoZSByZWd1bGFyIHBhcnRpYWwgb3ZlcmxhcCBwb3NzaWJpbGl0eS5cbiAgICAgICAgLy8gVGhleSBhbHNvIGluY2x1ZGUgdGhpcy5zZWN0aW9uQmxvY2tlciBzdGFydGluZyBiZWZvcmUgYW5kIGVuZGluZyBhZnRlciB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZC5cblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBhc3NlcnQodGhpcy5zZWN0aW9uQmxvY2tlci5nZXRTZWN0aW9uTmV4dCgpID09PSBudWxsICYmXG4gICAgICAgICh0aGlzLnNlY3Rpb25CbG9ja2VyLmdldFNlY3Rpb25Eb3duKCkgPT09IG51bGwgfHxcbiAgICAgICAgdGhpcy5zZWN0aW9uQmxvY2tlci5nZXRTZWN0aW9uRG93bigpLnN0YXJ0cG9pbnQgPT09IG51bGwpLFxuICAgICAgICAnQVJFZGdlTGlzdC5fc2VjdGlvbkhhc0Jsb2NrZWRFZGdlOiB0aGlzLnNlY3Rpb25CbG9ja2VyLmdldFNlY3Rpb25OZXh0KCkgPT09IG51bGwgJiYnICtcbiAgICAgICAgJ3RoaXMuc2VjdGlvbkJsb2NrZXIuZ2V0U2VjdGlvbkRvd24oKSA9PT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIHRoaXMuc2VjdGlvbkJsb2NrZXIuc2V0U2VjdGlvbk5leHQodGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRbMF0pO1xuXG4gICAgLy8gU2V0IGFueXRoaW5nIHBvaW50aW5nIHRvIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkIHRvIHBvaW50IHRvIHRoaXMuc2VjdGlvbkJsb2NrZXIgKGVnLCBzZWN0aW9uRG93bilcbiAgICB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZFswXSA9IHRoaXMuc2VjdGlvbkJsb2NrZXI7XG5cbiAgICB0aGlzLnNlY3Rpb25CbG9ja2VyID0gbnVsbDtcbiAgICB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCA9IG51bGw7XG5cbiAgICByZXR1cm4gZmFsc2U7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLl9zZWN0aW9uR2V0QmxvY2tlZEVkZ2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgYXNzZXJ0KHRoaXMuc2VjdGlvbkJsb2NrZXIgIT09IG51bGwgJiYgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgIT09IG51bGwsXG4gICAgICAgICdBUkVkZ2VMaXN0LnNlY3Rpb25HZXRCbG9ja2VkRWRnZTogdGhpcy5zZWN0aW9uQmxvY2tlciAhPT0gbnVsbCAmJiAnICtcbiAgICAgICAgJ3RoaXMuc2VjdGlvblB0cjJCbG9ja2VkICE9PSBudWxsIEZBSUxFRCcpO1xuXG4gICAgcmV0dXJuIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkWzBdO1xufTtcblxuLy8tLS0tQnJhY2tldFxuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLl9icmFja2V0SXNDbG9zaW5nID0gZnVuY3Rpb24gKGVkZ2UpIHtcbiAgICBhc3NlcnQoZWRnZSAhPT0gbnVsbCwgJ0FSRWRnZUxpc3QuX2JyYWNrZXRJc0Nsb3Npbmc6IGVkZ2UgIT09IG51bGwgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KCFlZGdlLmlzU3RhcnRQb2ludE51bGwoKSAmJiAhZWRnZS5pc0VuZFBvaW50TnVsbCgpLFxuICAgICAgICAnQVJFZGdlTGlzdC5fYnJhY2tldElzQ2xvc2luZzogIWVkZ2UuaXNTdGFydFBvaW50TnVsbCgpICYmICFlZGdlLmlzRW5kUG9pbnROdWxsKCkgRkFJTEVEJyk7XG5cbiAgICB2YXIgc3RhcnQgPSBlZGdlLnN0YXJ0cG9pbnQsXG4gICAgICAgIGVuZCA9IGVkZ2UuZW5kcG9pbnQ7XG5cbiAgICBpZiAoZWRnZS5pc1N0YXJ0UG9pbnRQcmV2TnVsbCgpIHx8IGVkZ2UuaXNFbmRQb2ludE5leHROdWxsKCkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmlzaG9yaXpvbnRhbCA/XG4gICAgICAgIChlZGdlLnN0YXJ0cG9pbnRQcmV2LnkgPCBzdGFydC55ICYmIGVkZ2UuZW5kcG9pbnROZXh0LnkgPCBlbmQueSApIDpcbiAgICAgICAgKGVkZ2Uuc3RhcnRwb2ludFByZXYueCA8IHN0YXJ0LnggJiYgZWRnZS5lbmRwb2ludE5leHQueCA8IGVuZC54ICk7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLl9icmFja2V0SXNPcGVuaW5nID0gZnVuY3Rpb24gKGVkZ2UpIHtcbiAgICBhc3NlcnQoZWRnZSAhPT0gbnVsbCwgJ0FSRWRnZUxpc3QuX2JyYWNrZXRJc09wZW5pbmc6IGVkZ2UgIT09IG51bGwgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KCFlZGdlLmlzU3RhcnRQb2ludE51bGwoKSAmJiAhZWRnZS5pc0VuZFBvaW50TnVsbCgpLFxuICAgICAgICAnQVJFZGdlTGlzdC5fYnJhY2tldElzT3BlbmluZzogIWVkZ2UuaXNTdGFydFBvaW50TnVsbCgpICYmICFlZGdlLmlzRW5kUG9pbnROdWxsKCkgRkFJTEVEJyk7XG5cbiAgICB2YXIgc3RhcnQgPSBlZGdlLnN0YXJ0cG9pbnQgfHwgZWRnZS5zdGFydHBvaW50LFxuICAgICAgICBlbmQgPSBlZGdlLmVuZHBvaW50IHx8IGVkZ2UuZW5kcG9pbnQsXG4gICAgICAgIHByZXYsXG4gICAgICAgIG5leHQ7XG5cbiAgICBpZiAoZWRnZS5pc1N0YXJ0UG9pbnRQcmV2TnVsbCgpIHx8IGVkZ2UuaXNFbmRQb2ludE5leHROdWxsKCkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIG5leHQgPSBlZGdlLmVuZHBvaW50TmV4dCB8fCBlZGdlLmVuZHBvaW50TmV4dDtcbiAgICBwcmV2ID0gZWRnZS5zdGFydHBvaW50UHJldiB8fCBlZGdlLnN0YXJ0cG9pbnRQcmV2O1xuXG4gICAgcmV0dXJuIHRoaXMuaXNob3Jpem9udGFsID9cbiAgICAgICAgKHByZXYueSA+IHN0YXJ0LnkgJiYgbmV4dC55ID4gZW5kLnkgKSA6XG4gICAgICAgIChwcmV2LnggPiBzdGFydC54ICYmIG5leHQueCA+IGVuZC54ICk7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLl9icmFja2V0U2hvdWxkQmVTd2l0Y2hlZCA9IGZ1bmN0aW9uIChlZGdlLCBuZXh0KSB7XG4gICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwgJiYgbmV4dCAhPT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZUxpc3QuX2JyYWNrZXRTaG91bGRCZVN3aXRjaGVkOiBlZGdlICE9PSBudWxsICYmIG5leHQgIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICB2YXIgZXggPSB0aGlzLl9wb3NpdGlvbkdldFJlYWxYKGVkZ2UpLFxuICAgICAgICBleDEgPSBleFswXSxcbiAgICAgICAgZXgyID0gZXhbMV0sXG4gICAgICAgIGVvID0gdGhpcy5fcG9zaXRpb25HZXRSZWFsTyhlZGdlKSxcbiAgICAgICAgZW8xID0gZW9bMF0sXG4gICAgICAgIGVvMiA9IGVvWzFdLFxuICAgICAgICBueCA9IHRoaXMuX3Bvc2l0aW9uR2V0UmVhbFgobmV4dCksXG4gICAgICAgIG54MSA9IG54WzBdLFxuICAgICAgICBueDIgPSBueFsxXSxcbiAgICAgICAgbm8gPSB0aGlzLl9wb3NpdGlvbkdldFJlYWxPKG5leHQpLFxuICAgICAgICBubzEgPSBub1swXSxcbiAgICAgICAgbm8yID0gbm9bMV07XG5cbiAgICB2YXIgYzEsIGMyO1xuXG4gICAgaWYgKChueDEgPCBleDEgJiYgZXgxIDwgbngyICYmIGVvMSA+IDAgKSB8fCAoZXgxIDwgbngxICYmIG54MSA8IGV4MiAmJiBubzEgPCAwKSkge1xuICAgICAgICBjMSA9ICsxO1xuICAgIH0gZWxzZSBpZiAoZXgxID09PSBueDEgJiYgZW8xID09PSAwICYmIG5vMSA9PT0gMCkge1xuICAgICAgICBjMSA9IDA7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgYzEgPSAtOTtcbiAgICB9XG5cbiAgICBpZiAoKG54MSA8IGV4MiAmJiBleDIgPCBueDIgJiYgZW8yID4gMCApIHx8IChleDEgPCBueDIgJiYgbngyIDwgZXgyICYmIG5vMiA8IDApKSB7XG4gICAgICAgIGMyID0gKzE7XG4gICAgfSBlbHNlIGlmIChleDIgPT09IG54MiAmJiBlbzIgPT09IDAgJiYgbm8yID09PSAwKSB7XG4gICAgICAgIGMyID0gMDtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjMiA9IC05O1xuICAgIH1cblxuICAgIHJldHVybiAoYzEgKyBjMikgPiAwO1xufTtcblxuLy8tLS1CbG9ja1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLl9ibG9ja0dldEYgPSBmdW5jdGlvbiAoZCwgYiwgcykge1xuICAgIHZhciBmID0gZCAvIChiICsgcyksIC8vZiBpcyB0aGUgdG90YWwgZGlzdGFuY2UgYmV0d2VlbiBlZGdlcyBkaXZpZGVkIGJ5IHRoZSB0b3RhbCBudW1iZXIgb2YgZWRnZXNcbiAgICAgICAgUyA9IENPTlNUQU5UUy5FRExTX1MsIC8vVGhpcyBpcyAnU01BTExHQVAnXG4gICAgICAgIFIgPSBDT05TVEFOVFMuRURMU19SLC8vVGhpcyBpcyAnU01BTExHQVAgKyAxJ1xuICAgICAgICBEID0gQ09OU1RBTlRTLkVETFNfRDsgLy9UaGlzIGlzIHRoZSB0b3RhbCBkaXN0YW5jZSBvZiB0aGUgZ3JhcGhcblxuICAgIC8vSWYgZiBpcyBncmVhdGVyIHRoYW4gdGhlIFNNQUxMR0FQLCB0aGVuIG1ha2Ugc29tZSBjaGVja3MvZWRpdHNcbiAgICBpZiAoYiA9PT0gMCAmJiBSIDw9IGYpIHtcbiAgICAgICAgLy8gSWYgZXZlcnkgY29tcGFyaXNvbiByZXN1bHRlZCBpbiBhbiBvdmVybGFwIEFORCBTTUFMTEdBUCArIDEgaXMgbGVzcyB0aGFuXG4gICAgICAgIC8vIHRoZSBkaXN0YW5jZSBiZXR3ZWVuIGVhY2ggZWRnZSAoaW4gdGhlIGdpdmVuIHJhbmdlKS5cbiAgICAgICAgZiArPSAoRCAtIFIpO1xuICAgIH0gZWxzZSBpZiAoUyA8IGYgJiYgcyA+IDApIHtcbiAgICAgICAgZiA9ICgoRCAtIFMpICogZCAtIFMgKiAoRCAtIFIpICogcykgLyAoKEQgLSBTKSAqIGIgKyAoUiAtIFMpICogcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGY7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLl9ibG9ja0dldEcgPSBmdW5jdGlvbiAoZCwgYiwgcykge1xuICAgIHZhciBnID0gZCAvIChiICsgcyksXG4gICAgICAgIFMgPSBDT05TVEFOVFMuRURMU19TLFxuICAgICAgICBSID0gQ09OU1RBTlRTLkVETFNfUixcbiAgICAgICAgRCA9IENPTlNUQU5UUy5FRExTX0Q7XG5cbiAgICBpZiAoUyA8IGcgJiYgYiA+IDApIHtcbiAgICAgICAgZyA9ICgoUiAtIFMpICogZCArIFMgKiAoRCAtIFIpICogYikgLyAoKEQgLSBTKSAqIGIgKyAoUiAtIFMpICogcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGc7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLl9ibG9ja1B1c2hCYWNrd2FyZCA9IGZ1bmN0aW9uIChibG9ja2VkLCBibG9ja2VyKSB7XG4gICAgdmFyIG1vZGlmaWVkID0gZmFsc2U7XG5cbiAgICBhc3NlcnQoYmxvY2tlZCAhPT0gbnVsbCAmJiBibG9ja2VyICE9PSBudWxsLFxuICAgICAgICAnQVJFZGdlTGlzdC5fYmxvY2tQdXNoQmFja3dhcmQ6IGJsb2NrZWQgIT09IG51bGwgJiYgYmxvY2tlciAhPT0gbnVsbCBGQUlMRUQnKTtcbiAgICBhc3NlcnQoYmxvY2tlZC5wb3NpdGlvblkgPD0gYmxvY2tlci5wb3NpdGlvblksXG4gICAgICAgICdBUkVkZ2VMaXN0Ll9ibG9ja1B1c2hCYWNrd2FyZDogYmxvY2tlZC5wb3NpdGlvblkgPD0gYmxvY2tlci5wb3NpdGlvblkgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KGJsb2NrZWQuZ2V0QmxvY2tQcmV2KCkgIT09IG51bGwsXG4gICAgICAgICdBUkVkZ2VMaXN0Ll9ibG9ja1B1c2hCYWNrd2FyZDogYmxvY2tlZC5nZXRCbG9ja1ByZXYoKSAhPT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIHZhciBmID0gMCxcbiAgICAgICAgZyA9IDAsXG4gICAgICAgIGVkZ2UgPSBibG9ja2VkLFxuICAgICAgICB0cmFjZSA9IGJsb2NrZXIsXG4gICAgICAgIGQgPSB0cmFjZS5wb3NpdGlvblkgLSBlZGdlLnBvc2l0aW9uWTtcblxuICAgIGFzc2VydChkID49IDAsXG4gICAgICAgICdBUkVkZ2VMaXN0Ll9ibG9ja1B1c2hCYWNrd2FyZDogZCA+PSAwIEZBSUxFRCcpO1xuXG4gICAgdmFyIHMgPSAoZWRnZS5icmFja2V0T3BlbmluZyB8fCB0cmFjZS5icmFja2V0Q2xvc2luZyksXG4gICAgICAgIGIgPSAxIC0gcyxcbiAgICAgICAgZDI7XG5cbiAgICBmb3IgKDsgOykge1xuICAgICAgICBlZGdlLnNldEJsb2NrVHJhY2UodHJhY2UpO1xuICAgICAgICB0cmFjZSA9IGVkZ2U7XG4gICAgICAgIGVkZ2UgPSBlZGdlLmdldEJsb2NrUHJldigpO1xuXG4gICAgICAgIGlmIChlZGdlID09PSBudWxsKSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIGQyID0gdHJhY2UucG9zaXRpb25ZIC0gZWRnZS5wb3NpdGlvblk7XG4gICAgICAgIGFzc2VydChkMiA+PSAwLFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QuX2Jsb2NrUHVzaEJhY2t3YXJkOiAgZDIgPj0gMCBGQUlMRUQnKTtcblxuICAgICAgICBpZiAoZWRnZS5icmFja2V0T3BlbmluZyB8fCB0cmFjZS5icmFja2V0Q2xvc2luZykge1xuICAgICAgICAgICAgZyA9IHRoaXMuX2Jsb2NrR2V0RyhkLCBiLCBzKTtcbiAgICAgICAgICAgIGlmIChkMiA8PSBnKSB7XG4gICAgICAgICAgICAgICAgZiA9IHRoaXMuX2Jsb2NrR2V0RihkLCBiLCBzKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHMrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGYgPSB0aGlzLl9ibG9ja0dldEYoZCwgYiwgcyk7XG4gICAgICAgICAgICBpZiAoZDIgPD0gZikge1xuICAgICAgICAgICAgICAgIGcgPSB0aGlzLl9ibG9ja0dldEcoZCwgYiwgcyk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBiKys7XG4gICAgICAgIH1cblxuICAgICAgICBkICs9IGQyO1xuICAgIH1cblxuICAgIGlmIChiICsgcyA+IDEpIHtcbiAgICAgICAgaWYgKGVkZ2UgPT09IG51bGwpIHtcbiAgICAgICAgICAgIGYgPSB0aGlzLl9ibG9ja0dldEYoZCwgYiwgcyk7XG4gICAgICAgICAgICBnID0gdGhpcy5fYmxvY2tHZXRHKGQsIGIsIHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgYXNzZXJ0KFV0aWxzLmZsb2F0RXF1YWxzKGQsIGYgKiBiICsgZyAqIHMpLFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QuX2Jsb2NrUHVzaEJhY2t3YXJkOiBmbG9hdEVxdWFscyhkLCBmKmIgKyBnKnMpIEZBSUxFRCcpO1xuXG4gICAgICAgIGVkZ2UgPSB0cmFjZTtcbiAgICAgICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwgJiYgZWRnZSAhPT0gYmxvY2tlZCxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0Ll9ibG9ja1B1c2hCYWNrd2FyZDogZWRnZSAhPT0gbnVsbCAmJiBlZGdlICE9PSBibG9ja2VkIEZBSUxFRCcpO1xuXG4gICAgICAgIHZhciB5ID0gZWRnZS5wb3NpdGlvblk7XG5cbiAgICAgICAgZG8ge1xuICAgICAgICAgICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwgJiYgZWRnZS5nZXRCbG9ja1RyYWNlKCkgIT09IG51bGwsXG4gICAgICAgICAgICAgICAgJ0FSRWRnZUxpc3QuX2Jsb2NrUHVzaEJhY2t3YXJkOiBlZGdlICE9PSBudWxsICYmIGVkZ2UuZ2V0QmxvY2tUcmFjZSgpICE9PSBudWxsIEZBSUxFRCcpO1xuXG4gICAgICAgICAgICB0cmFjZSA9IGVkZ2UuZ2V0QmxvY2tUcmFjZSgpO1xuXG4gICAgICAgICAgICB5ICs9IChlZGdlLmJyYWNrZXRPcGVuaW5nIHx8IHRyYWNlLmJyYWNrZXRDbG9zaW5nKSA/IGcgOiBmO1xuICAgICAgICAgICAgeSA9IFV0aWxzLnJvdW5kVHJ1bmMoeSwgMTApOyAgLy8gRml4IGFueSBmbG9hdGluZyBwb2ludCBlcnJvcnNcblxuICAgICAgICAgICAgaWYgKHkgKyAwLjAwMSA8IHRyYWNlLnBvc2l0aW9uWSkge1xuICAgICAgICAgICAgICAgIG1vZGlmaWVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fc2xpZGVCdXROb3RQYXNzRWRnZXModHJhY2UsIHkpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRyYWNlLnNldEJsb2NrUHJldihudWxsKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGVkZ2UgPSB0cmFjZTtcbiAgICAgICAgfSB3aGlsZSAoZWRnZSAhPT0gYmxvY2tlZCk7XG5cbiAgICAgICAgaWYgKENPTlNUQU5UUy5ERUJVRykge1xuICAgICAgICAgICAgLy95ICs9IChlZGdlLmJyYWNrZXRPcGVuaW5nIHx8IGJsb2NrZXIuYnJhY2tldENsb3NpbmcpID8gZyA6IGY7XG4gICAgICAgICAgICBhc3NlcnQoVXRpbHMuZmxvYXRFcXVhbHMoeSwgYmxvY2tlci5wb3NpdGlvblkpLFxuICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0Ll9ibG9ja1B1c2hCYWNrd2FyZDogZmxvYXRFcXVhbHMoeSwgYmxvY2tlci5wb3NpdGlvblkpIEZBSUxFRCcpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG1vZGlmaWVkO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5fYmxvY2tQdXNoRm9yd2FyZCA9IGZ1bmN0aW9uIChibG9ja2VkLCBibG9ja2VyKSB7XG4gICAgdmFyIG1vZGlmaWVkID0gZmFsc2U7XG5cbiAgICBhc3NlcnQoYmxvY2tlZCAhPT0gbnVsbCAmJiBibG9ja2VyICE9PSBudWxsLFxuICAgICAgICAnQVJFZGdlTGlzdC5fYmxvY2tQdXNoRm9yd2FyZDogYmxvY2tlZCAhPT0gbnVsbCAmJiBibG9ja2VyICE9PSBudWxsIEZBSUxFRCcpO1xuICAgIGFzc2VydChibG9ja2VkLnBvc2l0aW9uWSA+PSBibG9ja2VyLnBvc2l0aW9uWSxcbiAgICAgICAgJ0FSRWRnZUxpc3QuX2Jsb2NrUHVzaEZvcndhcmQ6IGJsb2NrZWQucG9zaXRpb25ZID49IGJsb2NrZXIucG9zaXRpb25ZIEZBSUxFRCcpO1xuICAgIGFzc2VydChibG9ja2VkLmdldEJsb2NrTmV4dCgpICE9PSBudWxsLFxuICAgICAgICAnQVJFZGdlTGlzdC5fYmxvY2tQdXNoRm9yd2FyZDogYmxvY2tlZC5nZXRCbG9ja05leHQoKSAhPT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIHZhciBmID0gMCxcbiAgICAgICAgZyA9IDAsXG4gICAgICAgIGVkZ2UgPSBibG9ja2VkLFxuICAgICAgICB0cmFjZSA9IGJsb2NrZXIsXG4gICAgICAgIGQgPSBlZGdlLnBvc2l0aW9uWSAtIHRyYWNlLnBvc2l0aW9uWTtcblxuICAgIGFzc2VydChkID49IDAsXG4gICAgICAgICdBUkVkZ2VMaXN0Ll9ibG9ja1B1c2hGb3J3YXJkOiAgZCA+PSAwIEZBSUxFRCcpO1xuXG4gICAgdmFyIHMgPSAodHJhY2UuYnJhY2tldE9wZW5pbmcgfHwgZWRnZS5icmFja2V0Q2xvc2luZyksXG4gICAgICAgIGIgPSAxIC0gcyxcbiAgICAgICAgZDI7XG5cbiAgICBmb3IgKDsgOykge1xuICAgICAgICBlZGdlLnNldEJsb2NrVHJhY2UodHJhY2UpO1xuICAgICAgICB0cmFjZSA9IGVkZ2U7XG4gICAgICAgIGVkZ2UgPSBlZGdlLmdldEJsb2NrTmV4dCgpO1xuXG4gICAgICAgIGlmIChlZGdlID09PSBudWxsKSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIGQyID0gZWRnZS5wb3NpdGlvblkgLSB0cmFjZS5wb3NpdGlvblk7XG4gICAgICAgIGFzc2VydChkMiA+PSAwLFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QuX2Jsb2NrUHVzaEZvcndhcmQ6IGQyID49IDAgRkFJTEVEJyk7XG5cbiAgICAgICAgaWYgKHRyYWNlLmJyYWNrZXRPcGVuaW5nIHx8IGVkZ2UuYnJhY2tldENsb3NpbmcpIHtcbiAgICAgICAgICAgIGcgPSB0aGlzLl9ibG9ja0dldEcoZCwgYiwgcyk7XG4gICAgICAgICAgICBpZiAoZDIgPD0gZykge1xuICAgICAgICAgICAgICAgIGYgPSB0aGlzLl9ibG9ja0dldEYoZCwgYiwgcyk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmID0gdGhpcy5fYmxvY2tHZXRGKGQsIGIsIHMpO1xuICAgICAgICAgICAgaWYgKGQyIDw9IGYpIHtcbiAgICAgICAgICAgICAgICBnID0gdGhpcy5fYmxvY2tHZXRHKGQsIGIsIHMpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYisrO1xuICAgICAgICB9XG5cbiAgICAgICAgZCArPSBkMjtcbiAgICB9XG5cbiAgICBpZiAoYiArIHMgPiAxKSB7IC8vTG9va2luZyBhdCBtb3JlIHRoYW4gb25lIGVkZ2UgKG9yIGVkZ2UvdHJhY2UgY29tcGFyaXNvbikge1xuICAgICAgICBpZiAoZWRnZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgZiA9IHRoaXMuX2Jsb2NrR2V0RihkLCBiLCBzKTtcbiAgICAgICAgICAgIGcgPSB0aGlzLl9ibG9ja0dldEcoZCwgYiwgcyk7XG4gICAgICAgIH1cblxuICAgICAgICBhc3NlcnQoVXRpbHMuZmxvYXRFcXVhbHMoZCwgZiAqIGIgKyBnICogcyksXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5fYmxvY2tQdXNoRm9yd2FyZDogZmxvYXRFcXVhbHMoZCwgZipiICsgZypzKSBGQUlMRUQnKTtcblxuICAgICAgICBlZGdlID0gdHJhY2U7XG4gICAgICAgIGFzc2VydChlZGdlICE9PSBudWxsICYmICFlZGdlLmVxdWFscyhibG9ja2VkKSxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0Ll9ibG9ja1B1c2hGb3J3YXJkOiBlZGdlICE9IG51bGwgJiYgIWVkZ2UuZXF1YWxzKGJsb2NrZWQpIEZBSUxFRCcpO1xuXG4gICAgICAgIHZhciB5ID0gZWRnZS5wb3NpdGlvblk7XG5cbiAgICAgICAgZG8ge1xuICAgICAgICAgICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwgJiYgZWRnZS5nZXRCbG9ja1RyYWNlKCkgIT09IG51bGwsXG4gICAgICAgICAgICAgICAgJ0FSRWRnZUxpc3QuX2Jsb2NrUHVzaEZvcndhcmQ6IGVkZ2UgIT09IG51bGwgJiYgZWRnZS5nZXRCbG9ja1RyYWNlKCkgIT09IG51bGwgRkFJTEVEJyk7XG4gICAgICAgICAgICB0cmFjZSA9IGVkZ2UuZ2V0QmxvY2tUcmFjZSgpO1xuXG4gICAgICAgICAgICB5IC09ICh0cmFjZS5icmFja2V0T3BlbmluZyB8fCBlZGdlLmJyYWNrZXRDbG9zaW5nKSA/IGcgOiBmO1xuXG4gICAgICAgICAgICBpZiAodHJhY2UucG9zaXRpb25ZIDwgeSAtIDAuMDAxKSB7XG4gICAgICAgICAgICAgICAgbW9kaWZpZWQgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX3NsaWRlQnV0Tm90UGFzc0VkZ2VzKHRyYWNlLCB5KSkge1xuICAgICAgICAgICAgICAgICAgICB0cmFjZS5zZXRCbG9ja05leHQobnVsbCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBlZGdlID0gdHJhY2U7XG4gICAgICAgIH0gd2hpbGUgKGVkZ2UgIT09IGJsb2NrZWQpO1xuICAgIH1cblxuXG4gICAgcmV0dXJuIG1vZGlmaWVkO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5ibG9ja1NjYW5Gb3J3YXJkID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuX3Bvc2l0aW9uQWxsTG9hZFgoKTtcblxuICAgIHZhciBtb2RpZmllZCA9IGZhbHNlO1xuXG4gICAgdGhpcy5zZWN0aW9uUmVzZXQoKTtcblxuICAgIHZhciBibG9ja2VyID0gdGhpcy5vcmRlckZpcnN0LFxuICAgICAgICBibG9ja2VkLFxuICAgICAgICBibWluLFxuICAgICAgICBzbWluLFxuICAgICAgICBiTWluRixcbiAgICAgICAgc01pbkY7XG5cbiAgICB3aGlsZSAoYmxvY2tlcikge1xuICAgICAgICBibWluID0gbnVsbDsgLy9ibG9jayBtaW4/XG4gICAgICAgIHNtaW4gPSBudWxsOyAvL3NlY3Rpb24gbWluP1xuICAgICAgICBiTWluRiA9IENPTlNUQU5UUy5FRF9NSU5DT09SRCAtIDE7XG4gICAgICAgIHNNaW5GID0gQ09OU1RBTlRTLkVEX01JTkNPT1JEIC0gMTtcblxuICAgICAgICB0aGlzLl9zZWN0aW9uQmVnaW5TY2FuKGJsb2NrZXIpO1xuICAgICAgICB3aGlsZSAodGhpcy5fc2VjdGlvbkhhc0Jsb2NrZWRFZGdlKCkpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9zZWN0aW9uSXNJbW1lZGlhdGUoKSkge1xuICAgICAgICAgICAgICAgIGJsb2NrZWQgPSB0aGlzLl9zZWN0aW9uR2V0QmxvY2tlZEVkZ2UoKTtcbiAgICAgICAgICAgICAgICBhc3NlcnQoYmxvY2tlZCAhPT0gbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgJ0FSRWRnZUxpc3QuX2Jsb2NrUHVzaEZvcndhcmQ6IGJsb2NrZWQgIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICAgICAgICAgICAgICBpZiAoYmxvY2tlZC5nZXRCbG9ja1ByZXYoKSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICBtb2RpZmllZCA9IHRoaXMuX2Jsb2NrUHVzaEJhY2t3YXJkKGJsb2NrZWQsIGJsb2NrZXIpIHx8IG1vZGlmaWVkO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICghYmxvY2tlci5lZGdlRml4ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGJsb2NrZWQuYnJhY2tldE9wZW5pbmcgfHwgYmxvY2tlci5icmFja2V0Q2xvc2luZykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNNaW5GIDwgYmxvY2tlZC5wb3NpdGlvblkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzTWluRiA9IGJsb2NrZWQucG9zaXRpb25ZO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNtaW4gPSBibG9ja2VkO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGJNaW5GIDwgYmxvY2tlZC5wb3NpdGlvblkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBiTWluRiA9IGJsb2NrZWQucG9zaXRpb25ZO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJtaW4gPSBibG9ja2VkO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYm1pbikge1xuICAgICAgICAgICAgaWYgKHNtaW4pIHtcbiAgICAgICAgICAgICAgICBibG9ja2VyLnNldENsb3Nlc3RQcmV2KHNNaW5GID4gYk1pbkYgPyBzbWluIDogYm1pbik7XG5cbiAgICAgICAgICAgICAgICBiTWluRiA9IGJsb2NrZXIucG9zaXRpb25ZIC0gYk1pbkY7XG4gICAgICAgICAgICAgICAgc01pbkYgPSB0aGlzLl9ibG9ja0dldEYoYmxvY2tlci5wb3NpdGlvblkgLSBzTWluRiwgMCwgMSk7XG5cbiAgICAgICAgICAgICAgICBibG9ja2VyLnNldEJsb2NrUHJldihzTWluRiA8IGJNaW5GID8gc21pbiA6IGJtaW4pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBibG9ja2VyLnNldEJsb2NrUHJldihibWluKTtcbiAgICAgICAgICAgICAgICBibG9ja2VyLnNldENsb3Nlc3RQcmV2KGJtaW4pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYmxvY2tlci5zZXRCbG9ja1ByZXYoc21pbik7XG4gICAgICAgICAgICBibG9ja2VyLnNldENsb3Nlc3RQcmV2KHNtaW4pO1xuICAgICAgICB9XG5cblxuICAgICAgICBibG9ja2VyID0gYmxvY2tlci5vcmRlck5leHQ7XG4gICAgfVxuXG4gICAgdGhpcy5fcG9zaXRpb25BbGxTdG9yZVkoKTtcblxuICAgIHJldHVybiBtb2RpZmllZDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuYmxvY2tTY2FuQmFja3dhcmQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5fcG9zaXRpb25BbGxMb2FkWCgpO1xuXG4gICAgdmFyIG1vZGlmaWVkID0gZmFsc2U7XG5cbiAgICB0aGlzLnNlY3Rpb25SZXNldCgpO1xuICAgIHZhciBibG9ja2VyID0gdGhpcy5vcmRlckxhc3QsXG4gICAgICAgIGJsb2NrZWQsXG4gICAgICAgIGJtaW4sXG4gICAgICAgIHNtaW4sXG4gICAgICAgIGJNaW5GLFxuICAgICAgICBzTWluRjtcblxuICAgIHdoaWxlIChibG9ja2VyKSB7XG4gICAgICAgIGJtaW4gPSBudWxsO1xuICAgICAgICBzbWluID0gbnVsbDtcbiAgICAgICAgYk1pbkYgPSBDT05TVEFOVFMuRURfTUFYQ09PUkQgKyAxO1xuICAgICAgICBzTWluRiA9IENPTlNUQU5UUy5FRF9NQVhDT09SRCArIDE7XG5cbiAgICAgICAgdGhpcy5fc2VjdGlvbkJlZ2luU2NhbihibG9ja2VyKTtcblxuICAgICAgICB3aGlsZSAodGhpcy5fc2VjdGlvbkhhc0Jsb2NrZWRFZGdlKCkpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9zZWN0aW9uSXNJbW1lZGlhdGUoKSkge1xuICAgICAgICAgICAgICAgIGJsb2NrZWQgPSB0aGlzLl9zZWN0aW9uR2V0QmxvY2tlZEVkZ2UoKTtcblxuICAgICAgICAgICAgICAgIGFzc2VydChibG9ja2VkICE9PSBudWxsLFxuICAgICAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5ibG9ja1NjYW5CYWNrd2FyZDogYmxvY2tlZCAhPT0gbnVsbCBGQUlMRUQnKTtcblxuICAgICAgICAgICAgICAgIGlmIChibG9ja2VkLmdldEJsb2NrTmV4dCgpICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIG1vZGlmaWVkID0gdGhpcy5fYmxvY2tQdXNoRm9yd2FyZChibG9ja2VkLCBibG9ja2VyKSB8fCBtb2RpZmllZDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoIWJsb2NrZXIuZWRnZUZpeGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChibG9ja2VyLmJyYWNrZXRPcGVuaW5nIHx8IGJsb2NrZWQuYnJhY2tldENsb3NpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzTWluRiA+IGJsb2NrZWQucG9zaXRpb25ZKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc01pbkYgPSBibG9ja2VkLnBvc2l0aW9uWTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzbWluID0gYmxvY2tlZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChiTWluRiA+IGJsb2NrZWQucG9zaXRpb25ZKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYk1pbkYgPSBibG9ja2VkLnBvc2l0aW9uWTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBibWluID0gYmxvY2tlZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChibWluKSB7XG4gICAgICAgICAgICBpZiAoc21pbikge1xuICAgICAgICAgICAgICAgIGJsb2NrZXIuc2V0Q2xvc2VzdE5leHQoc01pbkYgPCBiTWluRiA/IHNtaW4gOiBibWluKTtcblxuICAgICAgICAgICAgICAgIGJNaW5GID0gYk1pbkYgLSBibG9ja2VyLnBvc2l0aW9uWTtcbiAgICAgICAgICAgICAgICBzTWluRiA9IHRoaXMuX2Jsb2NrR2V0RihzTWluRiAtIGJsb2NrZXIucG9zaXRpb25ZLCAwLCAxKTtcblxuICAgICAgICAgICAgICAgIGJsb2NrZXIuc2V0QmxvY2tOZXh0KHNNaW5GIDwgYk1pbkYgPyBzbWluIDogYm1pbik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGJsb2NrZXIuc2V0QmxvY2tOZXh0KGJtaW4pO1xuICAgICAgICAgICAgICAgIGJsb2NrZXIuc2V0Q2xvc2VzdE5leHQoYm1pbik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBibG9ja2VyLnNldEJsb2NrTmV4dChzbWluKTtcbiAgICAgICAgICAgIGJsb2NrZXIuc2V0Q2xvc2VzdE5leHQoc21pbik7XG4gICAgICAgIH1cblxuICAgICAgICBibG9ja2VyID0gYmxvY2tlci5vcmRlclByZXY7XG4gICAgfVxuXG4gICAgdGhpcy5fcG9zaXRpb25BbGxTdG9yZVkoKTtcblxuICAgIHJldHVybiBtb2RpZmllZDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuYmxvY2tTd2l0Y2hXcm9uZ3MgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHdhcyA9IGZhbHNlO1xuXG4gICAgdGhpcy5fcG9zaXRpb25BbGxMb2FkWCgpO1xuICAgIHZhciBzZWNvbmQgPSB0aGlzLm9yZGVyRmlyc3QsXG4gICAgICAgIGVkZ2UsXG4gICAgICAgIG5leHQsXG4gICAgICAgIGV5LFxuICAgICAgICBueSxcbiAgICAgICAgYTtcblxuICAgIHdoaWxlIChzZWNvbmQgIT09IG51bGwpIHtcbiAgICAgICAgLy9DaGVjayBpZiBpdCByZWZlcmVuY2VzIGl0c2VsZlxuICAgICAgICBpZiAoc2Vjb25kLmdldENsb3Nlc3RQcmV2KCkgIT09IG51bGwgJiYgc2Vjb25kLmdldENsb3Nlc3RQcmV2KCkuZ2V0Q2xvc2VzdE5leHQoKSAhPT0gKHNlY29uZCkgJiZcbiAgICAgICAgICAgIHNlY29uZC5nZXRDbG9zZXN0TmV4dCgpICE9PSBudWxsICYmIHNlY29uZC5nZXRDbG9zZXN0TmV4dCgpLmdldENsb3Nlc3RQcmV2KCkgPT09IChzZWNvbmQpKSB7XG5cbiAgICAgICAgICAgIGFzc2VydCghc2Vjb25kLmVkZ2VGaXhlZCxcbiAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5ibG9ja1N3aXRjaFdyb25nczogIXNlY29uZC5lZGdlRml4ZWQgRkFJTEVEJyk7XG5cbiAgICAgICAgICAgIGVkZ2UgPSBzZWNvbmQ7XG4gICAgICAgICAgICBuZXh0ID0gZWRnZS5nZXRDbG9zZXN0TmV4dCgpO1xuXG4gICAgICAgICAgICB3aGlsZSAobmV4dCAhPT0gbnVsbCAmJiBlZGdlID09PSBuZXh0LmdldENsb3Nlc3RQcmV2KCkpIHtcbiAgICAgICAgICAgICAgICBhc3NlcnQoZWRnZSAhPT0gbnVsbCAmJiAhZWRnZS5lZGdlRml4ZWQsXG4gICAgICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0LmJsb2NrU3dpdGNoV3JvbmdzOiBlZGdlICE9IG51bGwgJiYgIWVkZ2UuZWRnZUZpeGVkIEZBSUxFRCcpO1xuICAgICAgICAgICAgICAgIGFzc2VydChuZXh0ICE9PSBudWxsICYmICFuZXh0LmVkZ2VGaXhlZCxcbiAgICAgICAgICAgICAgICAgICAgJ0FSRWRnZUxpc3QuYmxvY2tTd2l0Y2hXcm9uZ3M6IG5leHQgIT0gbnVsbCAmJiAhbmV4dC5lZGdlRml4ZWQgRkFJTEVEJyk7XG5cbiAgICAgICAgICAgICAgICBleSA9IGVkZ2UucG9zaXRpb25ZO1xuICAgICAgICAgICAgICAgIG55ID0gbmV4dC5wb3NpdGlvblk7XG5cbiAgICAgICAgICAgICAgICBhc3NlcnQoZXkgPD0gbnksXG4gICAgICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0LmJsb2NrU3dpdGNoV3JvbmdzOiBleSA8PSBueSBGQUlMRUQnKTtcblxuICAgICAgICAgICAgICAgIGlmIChleSArIDEgPD0gbnkgJiYgdGhpcy5fYnJhY2tldFNob3VsZEJlU3dpdGNoZWQoZWRnZSwgbmV4dCkpIHtcbiAgICAgICAgICAgICAgICAgICAgd2FzID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgICAgICBhc3NlcnQoIWVkZ2UuZ2V0RWRnZUNhbnBhc3NlZCgpICYmICFuZXh0LmdldEVkZ2VDYW5wYXNzZWQoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0LmJsb2NrU3dpdGNoV3JvbmdzOiAhZWRnZS5nZXRFZGdlQ2FucGFzc2VkKCkgJiYgJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAnIW5leHQuZ2V0RWRnZUNhbnBhc3NlZCgpIEZBSUxFRCcpO1xuICAgICAgICAgICAgICAgICAgICBlZGdlLnNldEVkZ2VDYW5wYXNzZWQodHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgIG5leHQuc2V0RWRnZUNhbnBhc3NlZCh0cnVlKTtcblxuICAgICAgICAgICAgICAgICAgICBhID0gdGhpcy5fc2xpZGVCdXROb3RQYXNzRWRnZXMoZWRnZSwgKG55ICsgZXkpIC8gMiArIDAuMDAxKSAhPT0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgYSA9IHRoaXMuX3NsaWRlQnV0Tm90UGFzc0VkZ2VzKG5leHQsIChueSArIGV5KSAvIDIgLSAwLjAwMSkgIT09IG51bGwgfHwgYTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoYSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZWRnZS5zZXRDbG9zZXN0UHJldihudWxsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVkZ2Uuc2V0Q2xvc2VzdE5leHQobnVsbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBuZXh0LnNldENsb3Nlc3RQcmV2KG51bGwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbmV4dC5zZXRDbG9zZXN0TmV4dChudWxsKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgZWRnZS5zZXRFZGdlQ2FucGFzc2VkKGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5leHQuc2V0RWRnZUNhbnBhc3NlZChmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChlZGdlLmdldENsb3Nlc3RQcmV2KCkgIT09IG51bGwgJiYgZWRnZS5nZXRDbG9zZXN0UHJldigpLmdldENsb3Nlc3ROZXh0KCkgPT09IGVkZ2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVkZ2UuZ2V0Q2xvc2VzdFByZXYoKS5zZXRDbG9zZXN0TmV4dChuZXh0KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChuZXh0LmdldENsb3Nlc3ROZXh0KCkgIT09IG51bGwgJiYgbmV4dC5nZXRDbG9zZXN0TmV4dCgpLmdldENsb3Nlc3RQcmV2KCkgPT09IG5leHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5leHQuZ2V0Q2xvc2VzdE5leHQoKS5zZXRDbG9zZXN0UHJldihlZGdlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGVkZ2Uuc2V0Q2xvc2VzdE5leHQobmV4dC5nZXRDbG9zZXN0TmV4dCgpKTtcbiAgICAgICAgICAgICAgICAgICAgbmV4dC5zZXRDbG9zZXN0TmV4dChlZGdlKTtcbiAgICAgICAgICAgICAgICAgICAgbmV4dC5zZXRDbG9zZXN0UHJldihlZGdlLmdldENsb3Nlc3RQcmV2KCkpO1xuICAgICAgICAgICAgICAgICAgICBlZGdlLnNldENsb3Nlc3RQcmV2KG5leHQpO1xuXG4gICAgICAgICAgICAgICAgICAgIGVkZ2Uuc2V0RWRnZUNhbnBhc3NlZChmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgIG5leHQuc2V0RWRnZUNhbnBhc3NlZChmYWxzZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KCF0aGlzLl9icmFja2V0U2hvdWxkQmVTd2l0Y2hlZChuZXh0LCBlZGdlKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0LmJsb2NrU3dpdGNoV3JvbmdzOiAhYnJhY2tldFNob3VsZEJlU3dpdGNoZWQobmV4dCwgZWRnZSkgRkFJTEVEJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKG5leHQuZ2V0Q2xvc2VzdFByZXYoKSAhPT0gbnVsbCAmJiBuZXh0LmdldENsb3Nlc3RQcmV2KCkuZ2V0Q2xvc2VzdE5leHQoKSA9PT0gbmV4dCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZWRnZSA9IG5leHQuZ2V0Q2xvc2VzdFByZXYoKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5leHQgPSBlZGdlLmdldENsb3Nlc3ROZXh0KCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBlZGdlID0gbmV4dDtcbiAgICAgICAgICAgICAgICAgICAgbmV4dCA9IG5leHQuZ2V0Q2xvc2VzdE5leHQoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBzZWNvbmQgPSBzZWNvbmQub3JkZXJOZXh0O1xuICAgIH1cblxuICAgIGlmICh3YXMpIHtcbiAgICAgICAgdGhpcy5fcG9zaXRpb25BbGxTdG9yZVkoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gd2FzO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5hc3NlcnRWYWxpZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAvLyBDaGVjayB0aGF0IGFsbCBlZGdlcyBoYXZlIHN0YXJ0L2VuZCBwb2ludHNcbiAgICB2YXIgZWRnZSA9IHRoaXMub3JkZXJGaXJzdDtcbiAgICB3aGlsZSAoZWRnZSkge1xuICAgICAgICBhc3NlcnQoZWRnZS5zdGFydHBvaW50LnggIT09IHVuZGVmaW5lZCwgJ0VkZ2UgaGFzIHVucmVjb2duaXplZCBzdGFydHBvaW50OiAnICsgZWRnZS5zdGFydHBvaW50KTtcbiAgICAgICAgYXNzZXJ0KGVkZ2UuZW5kcG9pbnQueCAhPT0gdW5kZWZpbmVkLCAnRWRnZSBoYXMgdW5yZWNvZ25pemVkIGVuZHBvaW50OiAnICsgZWRnZS5lbmRwb2ludCk7XG4gICAgICAgIGVkZ2UgPSBlZGdlLm9yZGVyTmV4dDtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEF1dG9Sb3V0ZXJFZGdlTGlzdDtcbiIsIi8qZ2xvYmFscyBkZWZpbmUsIFdlYkdNRUdsb2JhbCovXG4vKmpzaGludCBub2RlOiB0cnVlKi9cblxuLyoqXG4gKiBAYXV0aG9yIGJyb2xsYiAvIGh0dHBzOi8vZ2l0aHViL2Jyb2xsYlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIExvZ2dlciA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Mb2dnZXInKSwgIC8vIEZJWE1FXG4gICAgQ09OU1RBTlRTID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLkNvbnN0YW50cycpLFxuICAgIFV0aWxzID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlV0aWxzJyksXG4gICAgYXNzZXJ0ID0gVXRpbHMuYXNzZXJ0LFxuICAgIEFyUG9pbnQgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUG9pbnQnKSxcbiAgICBBclBvaW50TGlzdFBhdGggPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUG9pbnRMaXN0JyksXG4gICAgQXJSZWN0ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlJlY3QnKSxcbiAgICBBdXRvUm91dGVyUGF0aCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5QYXRoJyksXG4gICAgQXV0b1JvdXRlclBvcnQgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUG9ydCcpLFxuICAgIEF1dG9Sb3V0ZXJCb3ggPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuQm94JyksXG4gICAgQXV0b1JvdXRlckVkZ2UgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuRWRnZScpLFxuICAgIEF1dG9Sb3V0ZXJFZGdlTGlzdCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5FZGdlTGlzdCcpO1xuXG52YXIgX2xvZ2dlciA9IG5ldyBMb2dnZXIoJ0F1dG9Sb3V0ZXIuR3JhcGgnKSxcbiAgICBDT1VOVEVSID0gMTsgIC8vIFVzZWQgZm9yIHVuaXF1ZSBpZHNcblxudmFyIEF1dG9Sb3V0ZXJHcmFwaCA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmNvbXBsZXRlbHlDb25uZWN0ZWQgPSB0cnVlOyAgLy8gdHJ1ZSBpZiBhbGwgcGF0aHMgYXJlIGNvbm5lY3RlZFxuICAgIHRoaXMuaG9yaXpvbnRhbCA9IG5ldyBBdXRvUm91dGVyRWRnZUxpc3QodHJ1ZSk7XG4gICAgdGhpcy52ZXJ0aWNhbCA9IG5ldyBBdXRvUm91dGVyRWRnZUxpc3QoZmFsc2UpO1xuICAgIHRoaXMuYm94ZXMgPSB7fTtcbiAgICB0aGlzLnBhdGhzID0gW107XG4gICAgdGhpcy5idWZmZXJCb3hlcyA9IFtdO1xuICAgIHRoaXMuYm94MmJ1ZmZlckJveCA9IHt9OyAvLyBtYXBzIGJveElkIHRvIGNvcnJlc3BvbmRpbmcgYnVmZmVyYm94IG9iamVjdFxuXG4gICAgdGhpcy5ob3Jpem9udGFsLm93bmVyID0gdGhpcztcbiAgICB0aGlzLnZlcnRpY2FsLm93bmVyID0gdGhpcztcblxuICAgIC8vSW5pdGlhbGl6aW5nIHNlbGZQb2ludHNcbiAgICB0aGlzLnNlbGZQb2ludHMgPSBbXG4gICAgICAgIG5ldyBBclBvaW50KENPTlNUQU5UUy5FRF9NSU5DT09SRCwgQ09OU1RBTlRTLkVEX01JTkNPT1JEKSxcbiAgICAgICAgbmV3IEFyUG9pbnQoQ09OU1RBTlRTLkVEX01BWENPT1JELCBDT05TVEFOVFMuRURfTUlOQ09PUkQpLFxuICAgICAgICBuZXcgQXJQb2ludChDT05TVEFOVFMuRURfTUFYQ09PUkQsIENPTlNUQU5UUy5FRF9NQVhDT09SRCksXG4gICAgICAgIG5ldyBBclBvaW50KENPTlNUQU5UUy5FRF9NSU5DT09SRCwgQ09OU1RBTlRTLkVEX01BWENPT1JEKVxuICAgIF07XG5cbiAgICB0aGlzLl9hZGRTZWxmRWRnZXMoKTtcbn07XG5cbi8vRnVuY3Rpb25zXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9kZWxldGVBbGxCb3hlcyA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgaWRzID0gT2JqZWN0LmtleXModGhpcy5ib3hlcyk7XG4gICAgZm9yICh2YXIgaSA9IGlkcy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgdGhpcy5ib3hlc1tpZHNbaV1dLmRlc3Ryb3koKTtcbiAgICAgICAgZGVsZXRlIHRoaXMuYm94ZXNbaWRzW2ldXTtcbiAgICB9XG4gICAgLy8gQ2xlYW4gdXAgdGhlIGJ1ZmZlckJveGVzXG4gICAgdGhpcy5idWZmZXJCb3hlcyA9IFtdO1xuICAgIHRoaXMuYm94MmJ1ZmZlckJveCA9IHt9O1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fZ2V0Qm94QXQgPSBmdW5jdGlvbiAocG9pbnQsIG5lYXJuZXNzKSB7XG4gICAgdmFyIGlkcyA9IE9iamVjdC5rZXlzKHRoaXMuYm94ZXMpO1xuICAgIGZvciAodmFyIGkgPSBpZHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIGlmICh0aGlzLmJveGVzW2lkc1tpXV0uaXNCb3hBdChwb2ludCwgbmVhcm5lc3MpKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5ib3hlc1tpZHNbaV1dO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9zZXRQb3J0QXR0ciA9IGZ1bmN0aW9uIChwb3J0LCBhdHRyKSB7XG4gICAgdGhpcy5fZGlzY29ubmVjdFBhdGhzRnJvbShwb3J0KTtcbiAgICBwb3J0LmF0dHJpYnV0ZXMgPSBhdHRyO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5faXNSZWN0Q2xpcEJveGVzID0gZnVuY3Rpb24gKHJlY3QpIHtcbiAgICB2YXIgYm94UmVjdDtcbiAgICB2YXIgaWRzID0gT2JqZWN0LmtleXModGhpcy5ib3hlcyk7XG4gICAgZm9yICh2YXIgaSA9IGlkcy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgYm94UmVjdCA9IHRoaXMuYm94ZXNbaWRzW2ldXS5yZWN0O1xuICAgICAgICBpZiAoVXRpbHMuaXNSZWN0Q2xpcChyZWN0LCBib3hSZWN0KSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5faXNSZWN0Q2xpcEJ1ZmZlckJveGVzID0gZnVuY3Rpb24gKHJlY3QpIHtcbiAgICB2YXIgaSA9IHRoaXMuYnVmZmVyQm94ZXMubGVuZ3RoLFxuICAgICAgICBjO1xuXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgICBjID0gdGhpcy5idWZmZXJCb3hlc1tpXS5jaGlsZHJlbi5sZW5ndGg7XG5cbiAgICAgICAgd2hpbGUgKGMtLSkge1xuICAgICAgICAgICAgaWYgKFV0aWxzLmlzUmVjdENsaXAocmVjdCwgdGhpcy5idWZmZXJCb3hlc1tpXS5jaGlsZHJlbltjXSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2lzTGluZUNsaXBCdWZmZXJCb3hlcyA9IGZ1bmN0aW9uIChwMSwgcDIpIHtcbiAgICB2YXIgcmVjdCA9IG5ldyBBclJlY3QocDEsIHAyKTtcbiAgICByZWN0Lm5vcm1hbGl6ZVJlY3QoKTtcbiAgICBhc3NlcnQocmVjdC5sZWZ0ID09PSByZWN0LnJpZ2h0IHx8IHJlY3QuY2VpbCA9PT0gcmVjdC5mbG9vcixcbiAgICAgICAgJ0FSR3JhcGgudGhpcy5faXNMaW5lQ2xpcEJveGVzOiByZWN0LmxlZnQgPT09IHJlY3QucmlnaHQgfHwgcmVjdC5jZWlsID09PSByZWN0LmZsb29yIEZBSUxFRCcpO1xuXG4gICAgaWYgKHJlY3QubGVmdCA9PT0gcmVjdC5yaWdodCkge1xuICAgICAgICByZWN0LnJpZ2h0Kys7XG4gICAgfVxuICAgIGlmIChyZWN0LmNlaWwgPT09IHJlY3QuZmxvb3IpIHtcbiAgICAgICAgcmVjdC5mbG9vcisrO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLl9pc1JlY3RDbGlwQnVmZmVyQm94ZXMocmVjdCk7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9pc0xpbmVDbGlwQm94ZXMgPSBmdW5jdGlvbiAocDEsIHAyKSB7XG4gICAgdmFyIHJlY3QgPSBuZXcgQXJSZWN0KHAxLCBwMik7XG4gICAgcmVjdC5ub3JtYWxpemVSZWN0KCk7XG4gICAgYXNzZXJ0KHJlY3QubGVmdCA9PT0gcmVjdC5yaWdodCB8fCByZWN0LmNlaWwgPT09IHJlY3QuZmxvb3IsXG4gICAgICAgICdBUkdyYXBoLmlzTGluZUNsaXBCb3hlczogcmVjdC5sZWZ0ID09PSByZWN0LnJpZ2h0IHx8IHJlY3QuY2VpbCA9PT0gcmVjdC5mbG9vciBGQUlMRUQnKTtcblxuICAgIGlmIChyZWN0LmxlZnQgPT09IHJlY3QucmlnaHQpIHtcbiAgICAgICAgcmVjdC5yaWdodCsrO1xuICAgIH1cbiAgICBpZiAocmVjdC5jZWlsID09PSByZWN0LmZsb29yKSB7XG4gICAgICAgIHJlY3QuZmxvb3IrKztcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5faXNSZWN0Q2xpcEJveGVzKHJlY3QpO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fY2FuQm94QXQgPSBmdW5jdGlvbiAocmVjdCkge1xuICAgIHJldHVybiAhdGhpcy5faXNSZWN0Q2xpcEJveGVzLmluZmxhdGVkUmVjdChyZWN0LCAxKTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2FkZCA9IGZ1bmN0aW9uIChwYXRoKSB7XG4gICAgYXNzZXJ0KHBhdGggIT09IG51bGwsICdBUkdyYXBoLmFkZDogcGF0aCAhPT0gbnVsbCBGQUlMRUQnKTtcbiAgICBhc3NlcnQoIXBhdGguaGFzT3duZXIoKSwgJ0FSR3JhcGguYWRkOiAhcGF0aC5oYXNPd25lcigpIEZBSUxFRCcpO1xuXG4gICAgcGF0aC5vd25lciA9IHRoaXM7XG5cbiAgICB0aGlzLnBhdGhzLnB1c2gocGF0aCk7XG5cbiAgICB0aGlzLmhvcml6b250YWwuYWRkUGF0aEVkZ2VzKHBhdGgpO1xuICAgIHRoaXMudmVydGljYWwuYWRkUGF0aEVkZ2VzKHBhdGgpO1xuXG4gICAgaWYgKENPTlNUQU5UUy5ERUJVRykge1xuICAgICAgICB0aGlzLl9hc3NlcnRWYWxpZFBhdGgocGF0aCk7XG4gICAgfVxuXG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9kZWxldGVBbGxQYXRocyA9IGZ1bmN0aW9uICgpIHtcbiAgICBmb3IgKHZhciBpID0gdGhpcy5wYXRocy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgdGhpcy5wYXRoc1tpXS5kZXN0cm95KCk7ICAvLyBSZW1vdmUgcG9pbnQgZnJvbSBzdGFydC9lbmQgcG9ydFxuICAgIH1cblxuICAgIHRoaXMucGF0aHMgPSBbXTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2hhc05vUGF0aCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXRocy5sZW5ndGggPT09IDA7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9nZXRQYXRoQ291bnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMucGF0aHMubGVuZ3RoO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fZ2V0TGlzdEVkZ2VBdCA9IGZ1bmN0aW9uIChwb2ludCwgbmVhcm5lc3MpIHtcblxuICAgIHZhciBlZGdlID0gdGhpcy5ob3Jpem9udGFsLmdldEVkZ2VBdChwb2ludCwgbmVhcm5lc3MpO1xuICAgIGlmIChlZGdlKSB7XG4gICAgICAgIHJldHVybiBlZGdlO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLnZlcnRpY2FsLmdldEVkZ2VBdChwb2ludCwgbmVhcm5lc3MpO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fZ2V0U3Vycm91bmRSZWN0ID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciByZWN0ID0gbmV3IEFyUmVjdCgwLCAwLCAwLCAwKSxcbiAgICAgICAgaTtcblxuICAgIHZhciBpZHMgPSBPYmplY3Qua2V5cyh0aGlzLmJveGVzKTtcbiAgICBmb3IgKGkgPSBpZHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHJlY3QudW5pb25Bc3NpZ24odGhpcy5ib3hlc1tpZHNbaV1dLnJlY3QpO1xuICAgIH1cblxuICAgIGZvciAoaSA9IHRoaXMucGF0aHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHJlY3QudW5pb25Bc3NpZ24odGhpcy5wYXRoc1tpXS5nZXRTdXJyb3VuZFJlY3QoKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlY3Q7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9nZXRPdXRPZkJveCA9IGZ1bmN0aW9uIChkZXRhaWxzKSB7XG4gICAgdmFyIGJ1ZmZlck9iamVjdCA9IHRoaXMuYm94MmJ1ZmZlckJveFtkZXRhaWxzLmJveC5pZF0sXG4gICAgICAgIGNoaWxkcmVuID0gYnVmZmVyT2JqZWN0LmNoaWxkcmVuLFxuICAgICAgICBpID0gYnVmZmVyT2JqZWN0LmNoaWxkcmVuLmxlbmd0aCxcbiAgICAgICAgcG9pbnQgPSBkZXRhaWxzLnBvaW50LFxuICAgICAgICBkaXIgPSBkZXRhaWxzLmRpcixcbiAgICAgICAgYm94UmVjdCA9IG5ldyBBclJlY3QoZGV0YWlscy5ib3gucmVjdCk7XG5cbiAgICBib3hSZWN0LmluZmxhdGVSZWN0KENPTlNUQU5UUy5CVUZGRVIpOyAvL0NyZWF0ZSBhIGNvcHkgb2YgdGhlIGJ1ZmZlciBib3hcblxuICAgIGFzc2VydChVdGlscy5pc1JpZ2h0QW5nbGUoZGlyKSwgJ0FSR3JhcGguZ2V0T3V0T2ZCb3g6IFV0aWxzLmlzUmlnaHRBbmdsZSAoZGlyKSBGQUlMRUQnKTtcblxuICAgIHdoaWxlIChib3hSZWN0LnB0SW5SZWN0KHBvaW50KSkge1xuICAgICAgICBpZiAoVXRpbHMuaXNIb3Jpem9udGFsKGRpcikpIHtcbiAgICAgICAgICAgIHBvaW50LnggPSBVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChib3hSZWN0LCBkaXIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcG9pbnQueSA9IFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKGJveFJlY3QsIGRpcik7XG4gICAgICAgIH1cblxuICAgICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgICAgICBpZiAoY2hpbGRyZW5baV0ucHRJblJlY3QocG9pbnQpKSB7XG4gICAgICAgICAgICAgICAgYm94UmVjdCA9IGNoaWxkcmVuW2ldO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGkgPSBidWZmZXJPYmplY3QuY2hpbGRyZW4ubGVuZ3RoO1xuICAgIH1cblxuICAgIGFzc2VydCghYm94UmVjdC5wdEluUmVjdChwb2ludCksICdBUkdyYXBoLmdldE91dE9mQm94OiAhYm94UmVjdC5wdEluUmVjdCggcG9pbnQpIEZBSUxFRCcpO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fZ29Ub05leHRCdWZmZXJCb3ggPSBmdW5jdGlvbiAoYXJncykge1xuICAgIHZhciBwb2ludCA9IGFyZ3MucG9pbnQsXG4gICAgICAgIGVuZCA9IGFyZ3MuZW5kLFxuICAgICAgICBkaXIgPSBhcmdzLmRpcixcbiAgICAgICAgZGlyMiA9IGFyZ3MuZGlyMiA9PT0gdW5kZWZpbmVkIHx8ICFVdGlscy5pc1JpZ2h0QW5nbGUoYXJncy5kaXIyKSA/IChlbmQgaW5zdGFuY2VvZiBBclBvaW50ID9cbiAgICAgICAgICAgIFV0aWxzLmV4R2V0TWFqb3JEaXIoZW5kLm1pbnVzKHBvaW50KSkgOiBDT05TVEFOVFMuRGlyTm9uZSkgOiBhcmdzLmRpcjIsXG4gICAgICAgIHN0b3BoZXJlID0gYXJncy5lbmQgIT09IHVuZGVmaW5lZCA/IGFyZ3MuZW5kIDpcbiAgICAgICAgICAgIChkaXIgPT09IDEgfHwgZGlyID09PSAyID8gQ09OU1RBTlRTLkVEX01BWENPT1JEIDogQ09OU1RBTlRTLkVEX01JTkNPT1JEICk7XG5cbiAgICBpZiAoZGlyMiA9PT0gZGlyKSB7XG4gICAgICAgIGRpcjIgPSBVdGlscy5pc1JpZ2h0QW5nbGUoVXRpbHMuZXhHZXRNaW5vckRpcihlbmQubWludXMocG9pbnQpKSkgP1xuICAgICAgICAgICAgVXRpbHMuZXhHZXRNaW5vckRpcihlbmQubWludXMocG9pbnQpKSA6IChkaXIgKyAxKSAlIDQ7XG4gICAgfVxuXG4gICAgaWYgKGVuZCBpbnN0YW5jZW9mIEFyUG9pbnQpIHtcbiAgICAgICAgc3RvcGhlcmUgPSBVdGlscy5nZXRQb2ludENvb3JkKHN0b3BoZXJlLCBkaXIpO1xuICAgIH1cblxuICAgIGFzc2VydChVdGlscy5pc1JpZ2h0QW5nbGUoZGlyKSwgJ0FyR3JhcGguZ29Ub05leHRCdWZmZXJCb3g6IFV0aWxzLmlzUmlnaHRBbmdsZSAoZGlyKSBGQUlMRUQnKTtcbiAgICBhc3NlcnQoVXRpbHMuZ2V0UG9pbnRDb29yZChwb2ludCwgZGlyKSAhPT0gc3RvcGhlcmUsXG4gICAgICAgICdBckdyYXBoLmdvVG9OZXh0QnVmZmVyQm94OiBVdGlscy5nZXRQb2ludENvb3JkIChwb2ludCwgZGlyKSAhPT0gc3RvcGhlcmUgRkFJTEVEJyk7XG5cbiAgICB2YXIgYm94YnkgPSBudWxsLFxuICAgICAgICBpID0gLTEsXG4gICAgICAgIGJveFJlY3Q7XG4gICAgLy9qc2NzOmRpc2FibGUgbWF4aW11bUxpbmVMZW5ndGhcbiAgICB3aGlsZSAoKytpIDwgdGhpcy5idWZmZXJCb3hlcy5sZW5ndGgpIHtcbiAgICAgICAgYm94UmVjdCA9IHRoaXMuYnVmZmVyQm94ZXNbaV0uYm94O1xuXG4gICAgICAgIGlmICghVXRpbHMuaXNQb2ludEluRGlyRnJvbShwb2ludCwgYm94UmVjdCwgZGlyKSAmJiAvL0FkZCBzdXBwb3J0IGZvciBlbnRlcmluZyB0aGUgcGFyZW50IGJveFxuICAgICAgICAgICAgVXRpbHMuaXNQb2ludEJldHdlZW5TaWRlcyhwb2ludCwgYm94UmVjdCwgZGlyKSAmJiAgLy8gaWYgaXQgd2lsbCBub3QgcHV0IHRoZSBwb2ludCBpbiBhIGNvcm5lciAocmVsYXRpdmUgdG8gZGlyMilcbiAgICAgICAgICAgIFV0aWxzLmlzQ29vcmRJbkRpckZyb20oc3RvcGhlcmUsXG4gICAgICAgICAgICAgICAgVXRpbHMuZ2V0Q2hpbGRSZWN0T3V0ZXJDb29yZEZyb20odGhpcy5idWZmZXJCb3hlc1tpXSwgZGlyLCBwb2ludCkuY29vcmQsIGRpcikpIHtcbiAgICAgICAgICAgIC8vUmV0dXJuIGV4dHJlbWUgKHBhcmVudCBib3gpIGZvciB0aGlzIGNvbXBhcmlzb25cbiAgICAgICAgICAgIHN0b3BoZXJlID0gVXRpbHMuZ2V0Q2hpbGRSZWN0T3V0ZXJDb29yZEZyb20odGhpcy5idWZmZXJCb3hlc1tpXSwgZGlyLCBwb2ludCkuY29vcmQ7XG4gICAgICAgICAgICBib3hieSA9IHRoaXMuYnVmZmVyQm94ZXNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgLy9qc2NzOmVuYWJsZSBtYXhpbXVtTGluZUxlbmd0aFxuXG4gICAgaWYgKFV0aWxzLmlzSG9yaXpvbnRhbChkaXIpKSB7XG4gICAgICAgIHBvaW50LnggPSBzdG9waGVyZTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBwb2ludC55ID0gc3RvcGhlcmU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGJveGJ5O1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5faHVnQ2hpbGRyZW4gPSBmdW5jdGlvbiAoYnVmZmVyT2JqZWN0LCBwb2ludCwgZGlyMSwgZGlyMiwgZXhpdENvbmRpdGlvbikge1xuICAgIC8vIFRoaXMgbWV0aG9kIGNyZWF0ZXMgYSBwYXRoIHRoYXQgZW50ZXJzIHRoZSBwYXJlbnQgYm94IGFuZCAnaHVncycgdGhlIGNoaWxkcmVuIGJveGVzXG4gICAgLy8gKHJlbWFpbnMgd2l0aGluIG9uZSBwaXhlbCBvZiB0aGVtKSBhbmQgZm9sbG93cyB0aGVtIG91dC5cbiAgICBhc3NlcnQoKGRpcjEgKyBkaXIyKSAlIDIgPT09IDEsICdBUkdyYXBoLmh1Z0NoaWxkcmVuOiBPbmUgYW5kIG9ubHkgb25lIGRpcmVjdGlvbiBtdXN0IGJlIGhvcml6b250YWwnKTtcbiAgICB2YXIgY2hpbGRyZW4gPSBidWZmZXJPYmplY3QuY2hpbGRyZW4sXG4gICAgICAgIHBhcmVudEJveCA9IGJ1ZmZlck9iamVjdC5ib3gsXG4gICAgICAgIGluaXRQb2ludCA9IG5ldyBBclBvaW50KHBvaW50KSxcbiAgICAgICAgY2hpbGQgPSB0aGlzLl9nb1RvTmV4dEJveChwb2ludCwgZGlyMSwgKGRpcjEgPT09IDEgfHwgZGlyMSA9PT0gMiA/XG4gICAgICAgICAgICBDT05TVEFOVFMuRURfTUFYQ09PUkQgOiBDT05TVEFOVFMuRURfTUlOQ09PUkQgKSwgY2hpbGRyZW4pLFxuICAgICAgICBmaW5hbFBvaW50LFxuICAgICAgICBkaXIgPSBkaXIyLFxuICAgICAgICBuZXh0RGlyID0gVXRpbHMubmV4dENsb2Nrd2lzZURpcihkaXIxKSA9PT0gZGlyMiA/IFV0aWxzLm5leHRDbG9ja3dpc2VEaXIgOiBVdGlscy5wcmV2Q2xvY2t3aXNlRGlyLFxuICAgICAgICBwb2ludHMgPSBbbmV3IEFyUG9pbnQocG9pbnQpXSxcbiAgICAgICAgaGFzRXhpdCA9IHRydWUsXG4gICAgICAgIG5leHRDaGlsZCxcbiAgICAgICAgb2xkO1xuXG4gICAgYXNzZXJ0KGNoaWxkICE9PSBudWxsLCAnQVJHcmFwaC5odWdDaGlsZHJlbjogY2hpbGQgIT09IG51bGwgRkFJTEVEJyk7XG4gICAgZXhpdENvbmRpdGlvbiA9IGV4aXRDb25kaXRpb24gPT09IHVuZGVmaW5lZCA/IGZ1bmN0aW9uIChwdCkge1xuICAgICAgICByZXR1cm4gIXBhcmVudEJveC5wdEluUmVjdChwdCk7XG4gICAgfSA6IGV4aXRDb25kaXRpb247XG5cbiAgICBfbG9nZ2VyLmluZm8oJ0Fib3V0IHRvIGh1ZyBjaGlsZCBib3hlcyB0byBmaW5kIGEgcGF0aCcpO1xuICAgIHdoaWxlIChoYXNFeGl0ICYmICFleGl0Q29uZGl0aW9uKHBvaW50LCBidWZmZXJPYmplY3QpKSB7XG4gICAgICAgIG9sZCA9IG5ldyBBclBvaW50KHBvaW50KTtcbiAgICAgICAgbmV4dENoaWxkID0gdGhpcy5fZ29Ub05leHRCb3gocG9pbnQsIGRpciwgVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQoY2hpbGQsIGRpciksIGNoaWxkcmVuKTtcblxuICAgICAgICBpZiAoIXBvaW50c1twb2ludHMubGVuZ3RoIC0gMV0uZXF1YWxzKG9sZCkpIHtcbiAgICAgICAgICAgIHBvaW50cy5wdXNoKG5ldyBBclBvaW50KG9sZCkpOyAvL1RoZSBwb2ludHMgYXJyYXkgc2hvdWxkIG5vdCBjb250YWluIHRoZSBtb3N0IHJlY2VudCBwb2ludC5cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChuZXh0Q2hpbGQgPT09IG51bGwpIHtcbiAgICAgICAgICAgIGRpciA9IFV0aWxzLnJldmVyc2VEaXIobmV4dERpcihkaXIpKTtcbiAgICAgICAgfSBlbHNlIGlmIChVdGlscy5pc0Nvb3JkSW5EaXJGcm9tKFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKG5leHRDaGlsZCwgVXRpbHMucmV2ZXJzZURpcihuZXh0RGlyKGRpcikpKSxcbiAgICAgICAgICAgICAgICBVdGlscy5nZXRQb2ludENvb3JkKHBvaW50LCBVdGlscy5yZXZlcnNlRGlyKG5leHREaXIoZGlyKSkpLCBVdGlscy5yZXZlcnNlRGlyKG5leHREaXIoZGlyKSkpKSB7XG4gICAgICAgICAgICBkaXIgPSBuZXh0RGlyKGRpcik7XG4gICAgICAgICAgICBjaGlsZCA9IG5leHRDaGlsZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChmaW5hbFBvaW50ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGZpbmFsUG9pbnQgPSBuZXcgQXJQb2ludChwb2ludCk7XG4gICAgICAgIH0gZWxzZSBpZiAoIWZpbmFsUG9pbnQuZXF1YWxzKG9sZCkpIHtcbiAgICAgICAgICAgIGhhc0V4aXQgPSAhcG9pbnQuZXF1YWxzKGZpbmFsUG9pbnQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvaW50c1swXS5lcXVhbHMoaW5pdFBvaW50KSkge1xuICAgICAgICBwb2ludHMuc3BsaWNlKDAsIDEpO1xuICAgIH1cblxuICAgIGlmICghaGFzRXhpdCkge1xuICAgICAgICBwb2ludHMgPSBudWxsO1xuICAgICAgICBwb2ludC5hc3NpZ24oaW5pdFBvaW50KTtcbiAgICB9XG5cbiAgICByZXR1cm4gcG9pbnRzO1xuXG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9nb1RvTmV4dEJveCA9IGZ1bmN0aW9uIChwb2ludCwgZGlyLCBzdG9wMSwgYm94TGlzdCkge1xuICAgIHZhciBzdG9waGVyZSA9IHN0b3AxO1xuXG4gICAgLypcbiAgICAgaWYgKHN0b3AyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgaWYgKHN0b3AyIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgYm94TGlzdCA9IHN0b3AyO1xuICAgICB9IGVsc2Uge1xuICAgICBzdG9waGVyZSA9IHN0b3AxIGluc3RhbmNlb2YgQXJQb2ludCA/XG4gICAgIGNob29zZUluRGlyLmdldFBvaW50Q29vcmQgKHN0b3AxLCBkaXIpLCBVdGlscy5nZXRQb2ludENvb3JkIChzdG9wMiwgZGlyKSwgVXRpbHMucmV2ZXJzZURpciAoZGlyKSkgOlxuICAgICBjaG9vc2VJbkRpcihzdG9wMSwgc3RvcDIsIFV0aWxzLnJldmVyc2VEaXIgKGRpcikpO1xuICAgICB9XG5cbiAgICAgfWVsc2UgKi9cbiAgICBpZiAoc3RvcDEgaW5zdGFuY2VvZiBBclBvaW50KSB7XG4gICAgICAgIHN0b3BoZXJlID0gVXRpbHMuZ2V0UG9pbnRDb29yZChzdG9waGVyZSwgZGlyKTtcbiAgICB9XG5cbiAgICBhc3NlcnQoVXRpbHMuaXNSaWdodEFuZ2xlKGRpciksICdBckdyYXBoLmdvVG9OZXh0Qm94OiBVdGlscy5pc1JpZ2h0QW5nbGUgKGRpcikgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KFV0aWxzLmdldFBvaW50Q29vcmQocG9pbnQsIGRpcikgIT09IHN0b3BoZXJlLFxuICAgICAgICAnQXJHcmFwaC5nb1RvTmV4dEJveDogVXRpbHMuZ2V0UG9pbnRDb29yZCAocG9pbnQsIGRpcikgIT09IHN0b3BoZXJlIEZBSUxFRCcpO1xuXG4gICAgdmFyIGJveGJ5ID0gbnVsbCxcbiAgICAgICAgaXRlciA9IGJveExpc3QubGVuZ3RoLFxuICAgICAgICBib3hSZWN0O1xuXG4gICAgd2hpbGUgKGl0ZXItLSkge1xuICAgICAgICBib3hSZWN0ID0gYm94TGlzdFtpdGVyXTtcblxuICAgICAgICBpZiAoVXRpbHMuaXNQb2ludEluRGlyRnJvbShwb2ludCwgYm94UmVjdCwgVXRpbHMucmV2ZXJzZURpcihkaXIpKSAmJlxuICAgICAgICAgICAgVXRpbHMuaXNQb2ludEJldHdlZW5TaWRlcyhwb2ludCwgYm94UmVjdCwgZGlyKSAmJlxuICAgICAgICAgICAgVXRpbHMuaXNDb29yZEluRGlyRnJvbShzdG9waGVyZSwgVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQoYm94UmVjdCwgVXRpbHMucmV2ZXJzZURpcihkaXIpKSwgZGlyKSkge1xuICAgICAgICAgICAgc3RvcGhlcmUgPSBVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChib3hSZWN0LCBVdGlscy5yZXZlcnNlRGlyKGRpcikpO1xuICAgICAgICAgICAgYm94YnkgPSBib3hMaXN0W2l0ZXJdO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKFV0aWxzLmlzSG9yaXpvbnRhbChkaXIpKSB7XG4gICAgICAgIHBvaW50LnggPSBzdG9waGVyZTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBwb2ludC55ID0gc3RvcGhlcmU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGJveGJ5O1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fZ2V0TGltaXRzT2ZFZGdlID0gZnVuY3Rpb24gKHN0YXJ0UHQsIGVuZFB0LCBtaW4sIG1heCkge1xuICAgIHZhciB0LFxuICAgICAgICBzdGFydCA9IChuZXcgQXJQb2ludChzdGFydFB0KSksXG4gICAgICAgIGVuZCA9IChuZXcgQXJQb2ludChlbmRQdCkpLFxuICAgICAgICBpZHMgPSBPYmplY3Qua2V5cyh0aGlzLmJveGVzKSxcbiAgICAgICAgaSxcbiAgICAgICAgcmVjdDtcblxuICAgIGlmIChzdGFydC55ID09PSBlbmQueSkge1xuICAgICAgICBpZiAoc3RhcnQueCA+IGVuZC54KSB7XG4gICAgICAgICAgICB0ID0gc3RhcnQueDtcbiAgICAgICAgICAgIHN0YXJ0LnggPSBlbmQueDtcbiAgICAgICAgICAgIGVuZC54ID0gdDtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAoaSA9IGlkcy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgICAgIHJlY3QgPSB0aGlzLmJveGVzW2lkc1tpXV0ucmVjdDtcblxuICAgICAgICAgICAgaWYgKHN0YXJ0LnggPCByZWN0LnJpZ2h0ICYmIHJlY3QubGVmdCA8PSBlbmQueCkge1xuICAgICAgICAgICAgICAgIGlmIChyZWN0LmZsb29yIDw9IHN0YXJ0LnkgJiYgcmVjdC5mbG9vciA+IG1pbikge1xuICAgICAgICAgICAgICAgICAgICBtaW4gPSByZWN0LmZsb29yO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAocmVjdC5jZWlsID4gc3RhcnQueSAmJiByZWN0LmNlaWwgPCBtYXgpIHtcbiAgICAgICAgICAgICAgICAgICAgbWF4ID0gcmVjdC5jZWlsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGFzc2VydChzdGFydC54ID09PSBlbmQueCwgJ0FSR3JhcGgudGhpcy5nZXRMaW1pdHNPZkVkZ2U6IHN0YXJ0LnggPT09IGVuZC54IEZBSUxFRCcpO1xuXG4gICAgICAgIGlmIChzdGFydC55ID4gZW5kLnkpIHtcbiAgICAgICAgICAgIHQgPSBzdGFydC55O1xuICAgICAgICAgICAgc3RhcnQueSA9IGVuZC55O1xuICAgICAgICAgICAgZW5kLnkgPSB0O1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChpID0gaWRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICAgICAgcmVjdCA9IHRoaXMuYm94ZXNbaWRzW2ldXS5yZWN0O1xuXG4gICAgICAgICAgICBpZiAoc3RhcnQueSA8IHJlY3QuZmxvb3IgJiYgcmVjdC5jZWlsIDw9IGVuZC55KSB7XG4gICAgICAgICAgICAgICAgaWYgKHJlY3QucmlnaHQgPD0gc3RhcnQueCAmJiByZWN0LnJpZ2h0ID4gbWluKSB7XG4gICAgICAgICAgICAgICAgICAgIG1pbiA9IHJlY3QucmlnaHQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChyZWN0LmxlZnQgPiBzdGFydC54ICYmIHJlY3QubGVmdCA8IG1heCkge1xuICAgICAgICAgICAgICAgICAgICBtYXggPSByZWN0LmxlZnQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgbWF4LS07XG5cbiAgICByZXR1cm4ge21pbjogbWluLCBtYXg6IG1heH07XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9jb25uZWN0ID0gZnVuY3Rpb24gKHBhdGgpIHtcbiAgICB2YXIgc3RhcnRwb3J0ID0gcGF0aC5nZXRTdGFydFBvcnQoKSxcbiAgICAgICAgZW5kcG9ydCA9IHBhdGguZ2V0RW5kUG9ydCgpLFxuICAgICAgICBzdGFydHBvaW50ID0gcGF0aC5zdGFydHBvaW50LFxuICAgICAgICBlbmRwb2ludCA9IHBhdGguZW5kcG9pbnQ7XG5cbiAgICBhc3NlcnQoc3RhcnRwb3J0Lmhhc1BvaW50KHN0YXJ0cG9pbnQpLCAnQVJHcmFwaC5jb25uZWN0OiBzdGFydHBvcnQuaGFzUG9pbnQoc3RhcnRwb2ludCkgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KGVuZHBvcnQuaGFzUG9pbnQoZW5kcG9pbnQpLCAnQVJHcmFwaC5jb25uZWN0OiBlbmRwb3J0Lmhhc1BvaW50KGVuZHBvaW50KSBGQUlMRUQnKTtcblxuICAgIHZhciBzdGFydFJvb3QgPSBzdGFydHBvcnQub3duZXIuZ2V0Um9vdEJveCgpLFxuICAgICAgICBlbmRSb290ID0gZW5kcG9ydC5vd25lci5nZXRSb290Qm94KCksXG4gICAgICAgIHN0YXJ0SWQgPSBzdGFydFJvb3QuaWQsXG4gICAgICAgIGVuZElkID0gZW5kUm9vdC5pZCxcbiAgICAgICAgc3RhcnRkaXIgPSBzdGFydHBvcnQucG9ydE9uV2hpY2hFZGdlKHN0YXJ0cG9pbnQpLFxuICAgICAgICBlbmRkaXIgPSBlbmRwb3J0LnBvcnRPbldoaWNoRWRnZShlbmRwb2ludCk7XG5cbiAgICBpZiAoc3RhcnRwb2ludC5lcXVhbHMoZW5kcG9pbnQpKSB7XG4gICAgICAgIFV0aWxzLnN0ZXBPbmVJbkRpcihzdGFydHBvaW50LCBVdGlscy5uZXh0Q2xvY2t3aXNlRGlyKHN0YXJ0ZGlyKSk7XG4gICAgfVxuXG4gICAgaWYgKCFwYXRoLmlzQXV0b1JvdXRlZCgpKSB7XG4gICAgICAgIHBhdGguY3JlYXRlQ3VzdG9tUGF0aCgpO1xuICAgICAgICByZXR1cm4gdGhpcy5ob3Jpem9udGFsLmFkZFBhdGhFZGdlcyhwYXRoKSAmJiB0aGlzLnZlcnRpY2FsLmFkZFBhdGhFZGdlcyhwYXRoKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuYm94MmJ1ZmZlckJveFtzdGFydElkXSA9PT0gdGhpcy5ib3gyYnVmZmVyQm94W2VuZElkXSAmJlxuICAgICAgICBzdGFydGRpciA9PT0gVXRpbHMucmV2ZXJzZURpcihlbmRkaXIpICYmIHN0YXJ0Um9vdCAhPT0gZW5kUm9vdCkge1xuXG4gICAgICAgIHJldHVybiB0aGlzLl9jb25uZWN0UG9pbnRzU2hhcmluZ1BhcmVudEJveChwYXRoLCBzdGFydHBvaW50LCBlbmRwb2ludCwgc3RhcnRkaXIpO1xuICAgIH0gZWxzZSB7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuX2Nvbm5lY3RQYXRoV2l0aFBvaW50cyhwYXRoLCBzdGFydHBvaW50LCBlbmRwb2ludCk7XG4gICAgfVxuXG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9jb25uZWN0UGF0aFdpdGhQb2ludHMgPSBmdW5jdGlvbiAocGF0aCwgc3RhcnRwb2ludCwgZW5kcG9pbnQpIHtcbiAgICBhc3NlcnQoc3RhcnRwb2ludCBpbnN0YW5jZW9mIEFyUG9pbnQsICdBUkdyYXBoLmNvbm5lY3Q6IHN0YXJ0cG9pbnQgaW5zdGFuY2VvZiBBclBvaW50IEZBSUxFRCcpO1xuICAgIGFzc2VydChwYXRoICE9PSBudWxsICYmIHBhdGgub3duZXIgPT09IHRoaXMsICdBUkdyYXBoLmNvbm5lY3Q6IHBhdGggIT09IG51bGwgJiYgcGF0aC5vd25lciA9PT0gc2VsZiBGQUlMRUQnKTtcbiAgICBhc3NlcnQoIXBhdGguaXNDb25uZWN0ZWQoKSwgJ0FSR3JhcGguY29ubmVjdDogIXBhdGguaXNDb25uZWN0ZWQoKSBGQUlMRUQnKTtcbiAgICBhc3NlcnQoIXN0YXJ0cG9pbnQuZXF1YWxzKGVuZHBvaW50KSwgJ0FSR3JhcGguY29ubmVjdDogIXN0YXJ0cG9pbnQuZXF1YWxzKGVuZHBvaW50KSBGQUlMRUQnKTtcblxuICAgIHZhciBzdGFydFBvcnQgPSBwYXRoLmdldFN0YXJ0UG9ydCgpO1xuICAgIGFzc2VydChzdGFydFBvcnQgIT09IG51bGwsICdBUkdyYXBoLmNvbm5lY3Q6IHN0YXJ0UG9ydCAhPT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIHZhciBzdGFydGRpciA9IHN0YXJ0UG9ydC5wb3J0T25XaGljaEVkZ2Uoc3RhcnRwb2ludCksXG4gICAgICAgIGVuZFBvcnQgPSBwYXRoLmdldEVuZFBvcnQoKTtcblxuICAgIGFzc2VydChlbmRQb3J0ICE9PSBudWxsLCAnQVJHcmFwaC5jb25uZWN0OiBlbmRQb3J0ICE9PSBudWxsIEZBSUxFRCcpO1xuICAgIHZhciBlbmRkaXIgPSBlbmRQb3J0LnBvcnRPbldoaWNoRWRnZShlbmRwb2ludCk7XG4gICAgYXNzZXJ0KFV0aWxzLmlzUmlnaHRBbmdsZShzdGFydGRpcikgJiYgVXRpbHMuaXNSaWdodEFuZ2xlKGVuZGRpciksXG4gICAgICAgICdBUkdyYXBoLmNvbm5lY3Q6IFV0aWxzLmlzUmlnaHRBbmdsZSAoc3RhcnRkaXIpICYmIFV0aWxzLmlzUmlnaHRBbmdsZSAoZW5kZGlyKSBGQUlMRUQnKTtcblxuICAgIC8vRmluZCB0aGUgYnVmZmVyYm94IGNvbnRhaW5pbmcgc3RhcnRwb2ludCwgZW5kcG9pbnRcbiAgICB2YXIgc3RhcnQgPSBuZXcgQXJQb2ludChzdGFydHBvaW50KTtcbiAgICB0aGlzLl9nZXRPdXRPZkJveCh7XG4gICAgICAgIHBvaW50OiBzdGFydCxcbiAgICAgICAgZGlyOiBzdGFydGRpcixcbiAgICAgICAgZW5kOiBlbmRwb2ludCxcbiAgICAgICAgYm94OiBzdGFydFBvcnQub3duZXJcbiAgICB9KTtcbiAgICBhc3NlcnQoIXN0YXJ0LmVxdWFscyhzdGFydHBvaW50KSwgJ0FSR3JhcGguY29ubmVjdDogIXN0YXJ0LmVxdWFscyhzdGFydHBvaW50KSBGQUlMRUQnKTtcblxuICAgIHZhciBlbmQgPSBuZXcgQXJQb2ludChlbmRwb2ludCk7XG4gICAgdGhpcy5fZ2V0T3V0T2ZCb3goe1xuICAgICAgICBwb2ludDogZW5kLFxuICAgICAgICBkaXI6IGVuZGRpcixcbiAgICAgICAgZW5kOiBzdGFydCxcbiAgICAgICAgYm94OiBlbmRQb3J0Lm93bmVyXG4gICAgfSk7XG4gICAgYXNzZXJ0KCFlbmQuZXF1YWxzKGVuZHBvaW50KSwgJ0FSR3JhcGguY29ubmVjdDogIWVuZC5lcXVhbHMoZW5kcG9pbnQpIEZBSUxFRCcpO1xuXG4gICAgdmFyIHBvaW50cyxcbiAgICAgICAgaXNBdXRvUm91dGVkID0gcGF0aC5pc0F1dG9Sb3V0ZWQoKTtcbiAgICBpZiAoaXNBdXRvUm91dGVkKSB7XG4gICAgICAgIHBvaW50cyA9IHRoaXMuX2Nvbm5lY3RQb2ludHMoc3RhcnQsIGVuZCwgc3RhcnRkaXIsIGVuZGRpcik7XG4gICAgfVxuXG4gICAgcGF0aC5wb2ludHMgPSBwb2ludHM7XG4gICAgcGF0aC5wb2ludHMudW5zaGlmdChzdGFydHBvaW50KTtcbiAgICBwYXRoLnBvaW50cy5wdXNoKGVuZHBvaW50KTtcblxuICAgIGlmIChpc0F1dG9Sb3V0ZWQpIHtcbiAgICAgICAgdGhpcy5fc2ltcGxpZnlQYXRoQ3VydmVzKHBhdGgpO1xuICAgICAgICBwYXRoLnNpbXBsaWZ5VHJpdmlhbGx5KCk7XG4gICAgICAgIHRoaXMuX3NpbXBsaWZ5UGF0aFBvaW50cyhwYXRoKTtcbiAgICAgICAgdGhpcy5fY2VudGVyU3RhaXJzSW5QYXRoUG9pbnRzKHBhdGgsIHN0YXJ0ZGlyLCBlbmRkaXIpO1xuICAgIH1cbiAgICBwYXRoLnNldFN0YXRlKENPTlNUQU5UUy5QYXRoU3RhdGVDb25uZWN0ZWQpO1xuXG4gICAgcmV0dXJuIHRoaXMuaG9yaXpvbnRhbC5hZGRQYXRoRWRnZXMocGF0aCkgJiYgdGhpcy52ZXJ0aWNhbC5hZGRQYXRoRWRnZXMocGF0aCk7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9jb25uZWN0UG9pbnRzU2hhcmluZ1BhcmVudEJveCA9IGZ1bmN0aW9uIChwYXRoLCBzdGFydHBvaW50LCBlbmRwb2ludCwgc3RhcnRkaXIpIHtcbiAgICAvLyBDb25uZWN0IHBvaW50cyB0aGF0IHNoYXJlIGEgcGFyZW50IGJveCBhbmQgZmFjZSBlYWNoIG90aGVyXG4gICAgLy8gVGhlc2Ugd2lsbCBub3QgbmVlZCB0aGUgc2ltcGxpZmljYXRpb24gYW5kIGNvbXBsaWNhdGVkIHBhdGggZmluZGluZ1xuICAgIHZhciBzdGFydCA9IG5ldyBBclBvaW50KHN0YXJ0cG9pbnQpLFxuICAgICAgICBkeCA9IGVuZHBvaW50LnggLSBzdGFydC54LFxuICAgICAgICBkeSA9IGVuZHBvaW50LnkgLSBzdGFydC55O1xuXG4gICAgcGF0aC5kZWxldGVBbGwoKTtcblxuICAgIHBhdGguYWRkVGFpbChzdGFydHBvaW50KTtcbiAgICBpZiAoZHggIT09IDAgJiYgZHkgIT09IDApIHtcbiAgICAgICAgaWYgKFV0aWxzLmlzSG9yaXpvbnRhbChzdGFydGRpcikpIHtcbiAgICAgICAgICAgIHN0YXJ0LnggKz0gZHggLyAyO1xuICAgICAgICAgICAgcGF0aC5hZGRUYWlsKG5ldyBBclBvaW50KHN0YXJ0KSk7XG4gICAgICAgICAgICBzdGFydC55ICs9IGR5O1xuICAgICAgICAgICAgcGF0aC5hZGRUYWlsKG5ldyBBclBvaW50KHN0YXJ0KSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzdGFydC55ICs9IGR5IC8gMjtcbiAgICAgICAgICAgIHBhdGguYWRkVGFpbChuZXcgQXJQb2ludChzdGFydCkpO1xuICAgICAgICAgICAgc3RhcnQueCArPSBkeDtcbiAgICAgICAgICAgIHBhdGguYWRkVGFpbChuZXcgQXJQb2ludChzdGFydCkpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHBhdGguYWRkVGFpbChlbmRwb2ludCk7XG5cbiAgICBwYXRoLnNldFN0YXRlKENPTlNUQU5UUy5QYXRoU3RhdGVDb25uZWN0ZWQpO1xuXG4gICAgcmV0dXJuIHRoaXMuaG9yaXpvbnRhbC5hZGRQYXRoRWRnZXMocGF0aCkgJiYgdGhpcy52ZXJ0aWNhbC5hZGRQYXRoRWRnZXMocGF0aCk7XG5cbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2Nvbm5lY3RQb2ludHMgPSBmdW5jdGlvbiAoc3RhcnQsIGVuZCwgaGludHN0YXJ0ZGlyLCBoaW50ZW5kZGlyLCBmbGlwcGVkKSB7XG4gICAgdmFyIHJldCA9IG5ldyBBclBvaW50TGlzdFBhdGgoKSxcbiAgICAgICAgdGhlc3RhcnQgPSBuZXcgQXJQb2ludChzdGFydCksXG4gICAgICAgIGJ1ZmZlck9iamVjdCxcbiAgICAgICAgYm94LFxuICAgICAgICByZWN0LFxuICAgICAgICBkaXIxLFxuICAgICAgICBkaXIyLFxuICAgICAgICBvbGQsXG4gICAgICAgIG9sZEVuZCxcbiAgICAgICAgcmV0MixcbiAgICAgICAgcHRzLFxuICAgICAgICByZXYsXG4gICAgICAgIGksXG5cbiAgICAvL0V4aXQgY29uZGl0aW9uc1xuICAgIC8vaWYgdGhlcmUgaXMgYSBzdHJhaWdodCBsaW5lIHRvIHRoZSBlbmQgcG9pbnRcbiAgICAgICAgZmluZEV4aXRUb0VuZHBvaW50ID0gZnVuY3Rpb24gKHB0LCBibykge1xuICAgICAgICAgICAgcmV0dXJuIChwdC54ID09PSBlbmQueCB8fCBwdC55ID09PSBlbmQueSkgJiYgIVV0aWxzLmlzTGluZUNsaXBSZWN0cyhwdCwgZW5kLCBiby5jaGlsZHJlbik7XG4gICAgICAgIH0sICAvL0lmIHlvdSBwYXNzIHRoZSBlbmRwb2ludCwgeW91IG5lZWQgdG8gaGF2ZSBhIHdheSBvdXQuXG5cbiAgICAvL2V4aXRDb25kaXRpb24gaXMgd2hlbiB5b3UgZ2V0IHRvIHRoZSBkaXIxIHNpZGUgb2YgdGhlIGJveCBvciB3aGVuIHlvdSBwYXNzIGVuZFxuICAgICAgICBnZXRUb0RpcjFTaWRlID0gZnVuY3Rpb24gKHB0LCBibykge1xuICAgICAgICAgICAgcmV0dXJuIFV0aWxzLmdldFBvaW50Q29vcmQocHQsIGRpcjEpID09PSBVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChiby5ib3gsIGRpcjEpIHx8XG4gICAgICAgICAgICAgICAgKCBVdGlscy5pc1BvaW50SW5EaXJGcm9tKHB0LCBlbmQsIGRpcjEpKTtcbiAgICAgICAgfTtcblxuXG4gICAgLy9UaGlzIGlzIHdoZXJlIHdlIGNyZWF0ZSB0aGUgb3JpZ2luYWwgcGF0aCB0aGF0IHdlIHdpbGwgbGF0ZXIgYWRqdXN0XG4gICAgd2hpbGUgKCFzdGFydC5lcXVhbHMoZW5kKSkge1xuXG4gICAgICAgIGRpcjEgPSBVdGlscy5leEdldE1ham9yRGlyKGVuZC5taW51cyhzdGFydCkpO1xuICAgICAgICBkaXIyID0gVXRpbHMuZXhHZXRNaW5vckRpcihlbmQubWludXMoc3RhcnQpKTtcblxuICAgICAgICBhc3NlcnQoZGlyMSAhPT0gQ09OU1RBTlRTLkRpck5vbmUsICdBUkdyYXBoLmNvbm5lY3RQb2ludHM6IGRpcjEgIT09IENPTlNUQU5UUy5EaXJOb25lIEZBSUxFRCcpO1xuICAgICAgICBhc3NlcnQoZGlyMSA9PT0gVXRpbHMuZ2V0TWFqb3JEaXIoZW5kLm1pbnVzKHN0YXJ0KSksXG4gICAgICAgICAgICAnQVJHcmFwaC5jb25uZWN0UG9pbnRzOiBkaXIxID09PSBVdGlscy5nZXRNYWpvckRpcihlbmQubWludXMoc3RhcnQpKSBGQUlMRUQnKTtcbiAgICAgICAgYXNzZXJ0KGRpcjIgPT09IENPTlNUQU5UUy5EaXJOb25lIHx8IGRpcjIgPT09IFV0aWxzLmdldE1pbm9yRGlyKGVuZC5taW51cyhzdGFydCkpLFxuICAgICAgICAgICAgJ0FSR3JhcGguY29ubmVjdFBvaW50czogZGlyMiA9PT0gQ09OU1RBTlRTLkRpck5vbmUgfHwgJyArXG4gICAgICAgICAgICAnZGlyMiA9PT0gVXRpbHMuZ2V0TWlub3JEaXIoZW5kLm1pbnVzKHN0YXJ0KSkgRkFJTEVEJyk7XG5cbiAgICAgICAgaWYgKGRpcjIgPT09IGhpbnRzdGFydGRpciAmJiBkaXIyICE9PSBDT05TVEFOVFMuRGlyTm9uZSkge1xuICAgICAgICAgICAgLy8gaS5lLiBzdGQ6OnN3YXAoZGlyMSwgZGlyMik7XG4gICAgICAgICAgICBkaXIyID0gZGlyMTtcbiAgICAgICAgICAgIGRpcjEgPSBoaW50c3RhcnRkaXI7XG4gICAgICAgIH1cblxuICAgICAgICByZXQucHVzaChuZXcgQXJQb2ludChzdGFydCkpO1xuXG4gICAgICAgIG9sZCA9IG5ldyBBclBvaW50KHN0YXJ0KTtcblxuICAgICAgICBidWZmZXJPYmplY3QgPSB0aGlzLl9nb1RvTmV4dEJ1ZmZlckJveCh7XG4gICAgICAgICAgICBwb2ludDogc3RhcnQsXG4gICAgICAgICAgICBkaXI6IGRpcjEsXG4gICAgICAgICAgICBkaXIyOiBkaXIyLFxuICAgICAgICAgICAgZW5kOiBlbmRcbiAgICAgICAgfSk7ICAvLyBNb2RpZmllZCBnb1RvTmV4dEJveCAodGhhdCBhbGxvd3MgZW50ZXJpbmcgcGFyZW50IGJ1ZmZlciBib3hlcyBoZXJlXG4gICAgICAgIGJveCA9IGJ1ZmZlck9iamVjdCA9PT0gbnVsbCA/IG51bGwgOiBidWZmZXJPYmplY3QuYm94O1xuXG4gICAgICAgIC8vSWYgZ29Ub05leHRCb3ggZG9lcyBub3QgbW9kaWZ5IHN0YXJ0XG4gICAgICAgIGlmIChzdGFydC5lcXVhbHMob2xkKSkge1xuXG4gICAgICAgICAgICBhc3NlcnQoYm94ICE9PSBudWxsLCAnQVJHcmFwaC5jb25uZWN0UG9pbnRzOiBib3ggIT09IG51bGwgRkFJTEVEJyk7XG4gICAgICAgICAgICByZWN0ID0gYm94IGluc3RhbmNlb2YgQXJSZWN0ID8gYm94IDogYm94LnJlY3Q7XG5cbiAgICAgICAgICAgIGlmIChkaXIyID09PSBDT05TVEFOVFMuRGlyTm9uZSkge1xuICAgICAgICAgICAgICAgIGRpcjIgPSBVdGlscy5uZXh0Q2xvY2t3aXNlRGlyKGRpcjEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBhc3NlcnQoZGlyMSAhPT0gZGlyMiAmJiBkaXIxICE9PSBDT05TVEFOVFMuRGlyTm9uZSAmJiBkaXIyICE9PSBDT05TVEFOVFMuRGlyTm9uZSxcbiAgICAgICAgICAgICAgICAnQVJHcmFwaC5jb25uZWN0UG9pbnRzOiBkaXIxICE9PSBkaXIyICYmIGRpcjEgIT09IENPTlNUQU5UUy5EaXJOb25lICYmIGRpcjIgIT09ICcgK1xuICAgICAgICAgICAgICAgICdDT05TVEFOVFMuRGlyTm9uZSBGQUlMRUQnKTtcbiAgICAgICAgICAgIGlmIChidWZmZXJPYmplY3QuYm94LnB0SW5SZWN0KGVuZCkgJiYgIWJ1ZmZlck9iamVjdC5ib3gucHRJblJlY3Qoc3RhcnQpICYmIGZsaXBwZWQpIHtcbiAgICAgICAgICAgICAgICAvL1VuZm9ydHVuYXRlbHksIGlmIHBhcmVudGJveGVzIGFyZSBhIHBpeGVsIGFwYXJ0LCBzdGFydC9lbmQgY2FuIGdldCBzdHVjayBhbmQgbm90IGNyb3NzIHRoZSBib3JkZXJcbiAgICAgICAgICAgICAgICAvL3NlcGFyYXRpbmcgdGhlbS4uLi4gVGhpcyBpcyBhIG51ZGdlIHRvIGdldCB0aGVtIHRvIGNyb3NzIGl0LlxuICAgICAgICAgICAgICAgIGlmIChVdGlscy5pc0hvcml6b250YWwoZGlyMSkpIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhcnQueCA9IGVuZC54O1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXJ0LnkgPSBlbmQueTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGJ1ZmZlck9iamVjdC5ib3gucHRJblJlY3QoZW5kKSkge1xuICAgICAgICAgICAgICAgIGlmICghZmxpcHBlZCkge1xuICAgICAgICAgICAgICAgICAgICBfbG9nZ2VyLmluZm8oJ0NvdWxkIG5vdCBmaW5kIHBhdGggZnJvbScsc3RhcnQsJ3RvJywgZW5kLCcuIEZsaXBwaW5nIHN0YXJ0IGFuZCBlbmQgcG9pbnRzJyk7XG4gICAgICAgICAgICAgICAgICAgIG9sZEVuZCA9IG5ldyBBclBvaW50KGVuZCk7XG5cbiAgICAgICAgICAgICAgICAgICAgcmV0MiA9IHRoaXMuX2Nvbm5lY3RQb2ludHMoZW5kLCBzdGFydCwgaGludGVuZGRpciwgZGlyMSwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgIGkgPSByZXQyLmxlbmd0aCAtIDE7XG5cbiAgICAgICAgICAgICAgICAgICAgd2hpbGUgKGktLSA+IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldC5wdXNoKHJldDJbaV0pO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KHN0YXJ0LmVxdWFscyhlbmQpLCAnQXJHcmFwaC5jb25uZWN0UG9pbnRzOiBzdGFydC5lcXVhbHMoZW5kKSBGQUlMRUQnKTtcbiAgICAgICAgICAgICAgICAgICAgb2xkID0gQ09OU1RBTlRTLkVNUFRZX1BPSU5UO1xuICAgICAgICAgICAgICAgICAgICBzdGFydCA9IGVuZCA9IG9sZEVuZDtcbiAgICAgICAgICAgICAgICB9IGVsc2UgeyAgLy9JZiB3ZSBoYXZlIGZsaXBwZWQgYW5kIGJvdGggcG9pbnRzIGFyZSBpbiB0aGUgc2FtZSBidWZmZXJib3hcbiAgICAgICAgICAgICAgICAgICAgLy8gV2Ugd2lsbCBodWdjaGlsZHJlbiB1bnRpbCB3ZSBjYW4gY29ubmVjdCBib3RoIHBvaW50cy5cbiAgICAgICAgICAgICAgICAgICAgLy8gSWYgd2UgY2FuJ3QsIGZvcmNlIGl0XG4gICAgICAgICAgICAgICAgICAgIHB0cyA9IHRoaXMuX2h1Z0NoaWxkcmVuKGJ1ZmZlck9iamVjdCwgc3RhcnQsIGRpcjEsIGRpcjIsIGZpbmRFeGl0VG9FbmRwb2ludCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwdHMgIT09IG51bGwpIHsgIC8vIFRoZXJlIGlzIGEgcGF0aCBmcm9tIHN0YXJ0IC0+IGVuZFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHB0cy5sZW5ndGgpIHsgIC8vIEFkZCBuZXcgcG9pbnRzIHRvIHRoZSBjdXJyZW50IGxpc3QgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0ID0gcmV0LmNvbmNhdChwdHMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0LnB1c2gobmV3IEFyUG9pbnQoc3RhcnQpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0LmFzc2lnbihlbmQpOyAgLy8gVGhlc2Ugc2hvdWxkIG5vdCBiZSBza2V3ISBGSVhNRVxuXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7IC8vRm9yY2UgdG8gdGhlIGVuZHBvaW50XG4gICAgICAgICAgICAgICAgICAgICAgICBhc3NlcnQoVXRpbHMuaXNSaWdodEFuZ2xlKGRpcjEpLCAnQVJHcmFwaC5jb25uZWN0UG9pbnRzOiBVdGlscy5pc1JpZ2h0QW5nbGUgKGRpcjEpIEZBSUxFRCcpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoVXRpbHMuaXNIb3Jpem9udGFsKGRpcjEpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnQueCA9IGVuZC54O1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGFydC55ID0gZW5kLnk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHJldC5wdXNoKG5ldyBBclBvaW50KHN0YXJ0KSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghVXRpbHMuaXNIb3Jpem9udGFsKGRpcjEpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnQueCA9IGVuZC54O1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGFydC55ID0gZW5kLnk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHJldC5wdXNoKG5ldyBBclBvaW50KHN0YXJ0KSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGFzc2VydChzdGFydC5lcXVhbHMoZW5kKSk7ICAvLyBXZSBhcmUgZm9yY2luZyBvdXQgc28gdGhlc2Ugc2hvdWxkIGJlIHRoZSBzYW1lIG5vd1xuXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KCFzdGFydC5lcXVhbHMob2xkKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChVdGlscy5pc1BvaW50SW5EaXJGcm9tKGVuZCwgcmVjdCwgZGlyMikpIHtcblxuICAgICAgICAgICAgICAgIGFzc2VydCghVXRpbHMuaXNQb2ludEluRGlyRnJvbShzdGFydCwgcmVjdCwgZGlyMiksXG4gICAgICAgICAgICAgICAgICAgICdBUkdyYXBoLmNvbm5lY3RQb2ludHM6ICFVdGlscy5pc1BvaW50SW5EaXJGcm9tKHN0YXJ0LCByZWN0LCBkaXIyKSBGQUlMRUQnKTtcbiAgICAgICAgICAgICAgICBib3ggPSB0aGlzLl9nb1RvTmV4dEJ1ZmZlckJveCh7XG4gICAgICAgICAgICAgICAgICAgIHBvaW50OiBzdGFydCxcbiAgICAgICAgICAgICAgICAgICAgZGlyOiBkaXIyLFxuICAgICAgICAgICAgICAgICAgICBkaXIyOiBkaXIxLFxuICAgICAgICAgICAgICAgICAgICBlbmQ6IGVuZFxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgLy8gdGhpcyBhc3NlcnQgZmFpbHMgaWYgdHdvIGJveGVzIGFyZSBhZGphY2VudCwgYW5kIGEgY29ubmVjdGlvbiB3YW50cyB0byBnbyBiZXR3ZWVuXG4gICAgICAgICAgICAgICAgLy9hc3NlcnQoVXRpbHMuaXNQb2ludEluRGlyRnJvbShzdGFydCwgcmVjdCwgZGlyMiksXG4gICAgICAgICAgICAgICAgLy8gJ0FSR3JhcGguY29ubmVjdFBvaW50czogVXRpbHMuaXNQb2ludEluRGlyRnJvbShzdGFydCwgcmVjdCwgZGlyMikgRkFJTEVEJyk7XG4gICAgICAgICAgICAgICAgLy8gVGhpcyBpcyBub3QgdGhlIGJlc3QgY2hlY2sgd2l0aCBwYXJlbnQgYm94ZXNcbiAgICAgICAgICAgICAgICBpZiAoc3RhcnQuZXF1YWxzKG9sZCkpIHsgLy9UaGVuIHdlIGFyZSBpbiBhIGNvcm5lclxuICAgICAgICAgICAgICAgICAgICBpZiAoYm94LmNoaWxkcmVuLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHB0cyA9IHRoaXMuX2h1Z0NoaWxkcmVuKGJveCwgc3RhcnQsIGRpcjIsIGRpcjEsIGdldFRvRGlyMVNpZGUpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcHRzID0gdGhpcy5faHVnQ2hpbGRyZW4oYnVmZmVyT2JqZWN0LCBzdGFydCwgZGlyMSwgZGlyMik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHB0cyAhPT0gbnVsbCkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvL0FkZCBuZXcgcG9pbnRzIHRvIHRoZSBjdXJyZW50IGxpc3QgXG4gICAgICAgICAgICAgICAgICAgICAgICByZXQgPSByZXQuY29uY2F0KHB0cyk7XG5cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHsgLy9HbyB0aHJvdWdoIHRoZSBibG9ja2luZyBib3hcbiAgICAgICAgICAgICAgICAgICAgICAgIGFzc2VydChVdGlscy5pc1JpZ2h0QW5nbGUoZGlyMSksICdBUkdyYXBoLmdldE91dE9mQm94OiBVdGlscy5pc1JpZ2h0QW5nbGUgKGRpcjEpIEZBSUxFRCcpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoVXRpbHMuaXNIb3Jpem9udGFsKGRpcjEpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnQueCA9IFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKGJ1ZmZlck9iamVjdC5ib3gsIGRpcjEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGFydC55ID0gVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQoYnVmZmVyT2JqZWN0LmJveCwgZGlyMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGFzc2VydChVdGlscy5pc1BvaW50QmV0d2VlblNpZGVzKGVuZCwgcmVjdCwgZGlyMSksXG4gICAgICAgICAgICAgICAgICAgICdBUkdyYXBoLmNvbm5lY3RQb2ludHM6IFV0aWxzLmlzUG9pbnRCZXR3ZWVuU2lkZXMoZW5kLCByZWN0LCBkaXIxKSBGQUlMRUQnKTtcbiAgICAgICAgICAgICAgICBhc3NlcnQoIVV0aWxzLmlzUG9pbnRJbihlbmQsIHJlY3QpLCAnQVJHcmFwaC5jb25uZWN0UG9pbnRzOiAhVXRpbHMuaXNQb2ludEluKGVuZCwgcmVjdCkgRkFJTEVEJyk7XG5cbiAgICAgICAgICAgICAgICByZXYgPSAwO1xuXG4gICAgICAgICAgICAgICAgaWYgKFV0aWxzLnJldmVyc2VEaXIoZGlyMikgPT09IGhpbnRlbmRkaXIgJiZcbiAgICAgICAgICAgICAgICAgICAgVXRpbHMuZ2V0Q2hpbGRSZWN0T3V0ZXJDb29yZEZyb20oYnVmZmVyT2JqZWN0LCBVdGlscy5yZXZlcnNlRGlyKGRpcjIpLCBzdGFydCkgPT09XG4gICAgICAgICAgICAgICAgICAgIFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKHJlY3QsIFV0aWxzLnJldmVyc2VEaXIoZGlyMikpKSB7IC8vQW5kIGlmIHBvaW50IGNhbiBleGl0IHRoYXQgd2F5XG4gICAgICAgICAgICAgICAgICAgIHJldiA9IDE7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChkaXIyICE9PSBoaW50ZW5kZGlyKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChVdGlscy5pc1BvaW50QmV0d2VlblNpZGVzKHRoZXN0YXJ0LCByZWN0LCBkaXIxKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKFV0aWxzLmlzUG9pbnRJbkRpckZyb20ocmVjdC5nZXRUb3BMZWZ0KCkucGx1cyhyZWN0LmdldEJvdHRvbVJpZ2h0KCkpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGFydC5wbHVzKGVuZCksIGRpcjIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV2ID0gMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChVdGlscy5pc1BvaW50SW5EaXJGcm9tKHN0YXJ0LCB0aGVzdGFydCwgZGlyMikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldiA9IDE7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAocmV2KSB7XG4gICAgICAgICAgICAgICAgICAgIGRpcjIgPSBVdGlscy5yZXZlcnNlRGlyKGRpcjIpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vSWYgdGhlIGJveCBpbiB0aGUgd2F5IGhhcyBvbmUgY2hpbGRcbiAgICAgICAgICAgICAgICBpZiAoYnVmZmVyT2JqZWN0LmNoaWxkcmVuLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoVXRpbHMuaXNIb3Jpem9udGFsKGRpcjIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdGFydC54ID0gVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQocmVjdCwgZGlyMik7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdGFydC55ID0gVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQocmVjdCwgZGlyMik7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBhc3NlcnQoIXN0YXJ0LmVxdWFscyhvbGQpLCAnQVJHcmFwaC5jb25uZWN0UG9pbnRzOiAhc3RhcnQuZXF1YWxzKG9sZCkgRkFJTEVEJyk7XG4gICAgICAgICAgICAgICAgICAgIHJldC5wdXNoKG5ldyBBclBvaW50KHN0YXJ0KSk7XG4gICAgICAgICAgICAgICAgICAgIG9sZC5hc3NpZ24oc3RhcnQpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChVdGlscy5pc0hvcml6b250YWwoZGlyMSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0LnggPSBVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChyZWN0LCBkaXIxKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0LnkgPSBVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChyZWN0LCBkaXIxKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGFzc2VydChVdGlscy5pc1BvaW50SW5EaXJGcm9tKGVuZCwgc3RhcnQsIGRpcjEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ0FSR3JhcGguY29ubmVjdFBvaW50czogVXRpbHMuaXNQb2ludEluRGlyRnJvbShlbmQsIHN0YXJ0LCBkaXIxKSBGQUlMRUQnKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKFV0aWxzLmdldFBvaW50Q29vcmQoc3RhcnQsIGRpcjEpICE9PSBVdGlscy5nZXRQb2ludENvb3JkKGVuZCwgZGlyMSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dvVG9OZXh0QnVmZmVyQm94KHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwb2ludDogc3RhcnQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGlyOiBkaXIxLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVuZDogZW5kXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgfSBlbHNlIHsgLy9JZiB0aGUgYm94IGhhcyBtdWx0aXBsZSBjaGlsZHJlblxuICAgICAgICAgICAgICAgICAgICBwdHMgPSB0aGlzLl9odWdDaGlsZHJlbihidWZmZXJPYmplY3QsIHN0YXJ0LCBkaXIxLCBkaXIyLCBnZXRUb0RpcjFTaWRlKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHB0cyAhPT0gbnVsbCkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvL0FkZCBuZXcgcG9pbnRzIHRvIHRoZSBjdXJyZW50IGxpc3QgXG4gICAgICAgICAgICAgICAgICAgICAgICByZXQgPSByZXQuY29uY2F0KHB0cyk7XG5cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHsgLy9HbyB0aHJvdWdoIHRoZSBibG9ja2luZyBib3hcbiAgICAgICAgICAgICAgICAgICAgICAgIGFzc2VydChVdGlscy5pc1JpZ2h0QW5nbGUoZGlyMSksICdBUkdyYXBoLmdldE91dE9mQm94OiBVdGlscy5pc1JpZ2h0QW5nbGUgKGRpcjEpIEZBSUxFRCcpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoVXRpbHMuaXNIb3Jpem9udGFsKGRpcjEpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnQueCA9IFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKGJ1ZmZlck9iamVjdC5ib3gsIGRpcjEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGFydC55ID0gVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQoYnVmZmVyT2JqZWN0LmJveCwgZGlyMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGFzc2VydCghc3RhcnQuZXF1YWxzKG9sZCksICdBUkdyYXBoLmNvbm5lY3RQb2ludHM6ICFzdGFydC5lcXVhbHMob2xkKSBGQUlMRUQnKTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgcmV0LnB1c2goZW5kKTtcblxuICAgIGlmIChDT05TVEFOVFMuREVCVUcpIHtcbiAgICAgICAgcmV0LmFzc2VydFZhbGlkKCk7ICAvLyBDaGVjayB0aGF0IGFsbCBlZGdlcyBhcmUgaG9yaXpvbnRhbCBhcmUgdmVydGljYWxcbiAgICB9XG5cbiAgICByZXR1cm4gcmV0O1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fZGlzY29ubmVjdEFsbCA9IGZ1bmN0aW9uICgpIHtcbiAgICBmb3IgKHZhciBpID0gdGhpcy5wYXRocy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgdGhpcy5kaXNjb25uZWN0KHRoaXMucGF0aHNbaV0pO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuZGlzY29ubmVjdCA9IGZ1bmN0aW9uIChwYXRoKSB7XG4gICAgaWYgKHBhdGguaXNDb25uZWN0ZWQoKSkge1xuICAgICAgICB0aGlzLmRlbGV0ZUVkZ2VzKHBhdGgpO1xuICAgIH1cblxuICAgIHBhdGguZGVsZXRlQWxsKCk7XG4gICAgdGhpcy5jb21wbGV0ZWx5Q29ubmVjdGVkID0gZmFsc2U7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9kaXNjb25uZWN0UGF0aHNDbGlwcGluZyA9IGZ1bmN0aW9uIChyZWN0KSB7XG4gICAgZm9yICh2YXIgaSA9IHRoaXMucGF0aHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIGlmICh0aGlzLnBhdGhzW2ldLmlzUGF0aENsaXAocmVjdCkpIHtcbiAgICAgICAgICAgIHRoaXMuZGlzY29ubmVjdCh0aGlzLnBhdGhzW2ldKTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2Rpc2Nvbm5lY3RQYXRoc0Zyb20gPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgdmFyIGl0ZXIgPSB0aGlzLnBhdGhzLmxlbmd0aCxcbiAgICAgICAgcGF0aCxcbiAgICAgICAgc3RhcnRwb3J0LFxuICAgICAgICBlbmRwb3J0O1xuXG4gICAgaWYgKG9iaiBpbnN0YW5jZW9mIEF1dG9Sb3V0ZXJCb3gpIHtcbiAgICAgICAgdmFyIGJveCA9IG9iaixcbiAgICAgICAgICAgIHN0YXJ0Ym94LFxuICAgICAgICAgICAgZW5kYm94O1xuICAgICAgICB3aGlsZSAoaXRlci0tKSB7XG4gICAgICAgICAgICBwYXRoID0gdGhpcy5wYXRoc1tpdGVyXTtcblxuICAgICAgICAgICAgYXNzZXJ0KHBhdGguc3RhcnRwb3J0cyAhPT0gbnVsbCwgJ0FSR3JhcGguZGlzY29ubmVjdFBhdGhzRnJvbTogc3RhcnRwb3J0ICE9PSBudWxsIEZBSUxFRCcpO1xuICAgICAgICAgICAgYXNzZXJ0KHBhdGguc3RhcnRwb3J0cy5sZW5ndGggPiAwLCAnQVJHcmFwaC5kaXNjb25uZWN0UGF0aHNGcm9tOiBQYXRoIGhhcyBubyBzdGFydHBvcnRzJyk7XG4gICAgICAgICAgICBhc3NlcnQocGF0aC5lbmRwb3J0cyAhPT0gbnVsbCwgJ0FSR3JhcGguZGlzY29ubmVjdFBhdGhzRnJvbTogZW5kcG9ydCAhPT0gbnVsbCBGQUlMRUQnKTtcbiAgICAgICAgICAgIGFzc2VydChwYXRoLmVuZHBvcnRzLmxlbmd0aCA+IDAsICdBUkdyYXBoLmRpc2Nvbm5lY3RQYXRoc0Zyb206IFBhdGggaGFzIG5vIGVuZHBvcnRzJyk7XG5cbiAgICAgICAgICAgIC8vIENhbiBzaW1wbHkgc2VsZWN0IGFueSBzdGFydC9lbmQgcG9ydCB0byBjaGVjayB0aGUgb3duZXJcbiAgICAgICAgICAgIHN0YXJ0Ym94ID0gcGF0aC5zdGFydHBvcnRzWzBdLm93bmVyO1xuICAgICAgICAgICAgZW5kYm94ID0gcGF0aC5lbmRwb3J0c1swXS5vd25lcjtcblxuICAgICAgICAgICAgYXNzZXJ0KHN0YXJ0Ym94ICE9PSBudWxsLCAnQVJHcmFwaC5kaXNjb25uZWN0UGF0aHNGcm9tOiBzdGFydGJveCAhPT0gbnVsbCBGQUlMRUQnKTtcbiAgICAgICAgICAgIGFzc2VydChlbmRib3ggIT09IG51bGwsICdBUkdyYXBoLmRpc2Nvbm5lY3RQYXRoc0Zyb206IGVuZGJveCAhPT0gbnVsbCBGQUlMRUQnKTtcblxuICAgICAgICAgICAgaWYgKChzdGFydGJveCA9PT0gYm94IHx8IGVuZGJveCA9PT0gYm94KSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGlzY29ubmVjdChwYXRoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG4gICAgfSBlbHNlIHsgIC8vIEFzc3VtaW5nICdib3gnIGlzIGEgcG9ydFxuXG4gICAgICAgIHZhciBwb3J0ID0gb2JqO1xuICAgICAgICB3aGlsZSAoaXRlci0tKSB7XG4gICAgICAgICAgICBwYXRoID0gdGhpcy5wYXRoc1tpdGVyXTtcbiAgICAgICAgICAgIHN0YXJ0cG9ydCA9IHBhdGguZ2V0U3RhcnRQb3J0KCk7XG4gICAgICAgICAgICBlbmRwb3J0ID0gcGF0aC5nZXRFbmRQb3J0KCk7XG5cbiAgICAgICAgICAgIGlmICgoc3RhcnRwb3J0ID09PSBwb3J0IHx8IGVuZHBvcnQgPT09IHBvcnQpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kaXNjb25uZWN0KHBhdGgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9hZGRTZWxmRWRnZXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5ob3Jpem9udGFsLmFkZEdyYXBoRWRnZXModGhpcyk7XG4gICAgdGhpcy52ZXJ0aWNhbC5hZGRHcmFwaEVkZ2VzKHRoaXMpO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fYWRkQm94RWRnZXMgPSBmdW5jdGlvbiAoYm94KSB7XG4gICAgYXNzZXJ0KGJveCBpbnN0YW5jZW9mIEF1dG9Sb3V0ZXJCb3gpO1xuICAgIHRoaXMuaG9yaXpvbnRhbC5hZGRCb3hFZGdlcyhib3gpO1xuICAgIHRoaXMudmVydGljYWwuYWRkQm94RWRnZXMoYm94KTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2FkZFBvcnRFZGdlcyA9IGZ1bmN0aW9uIChwb3J0KSB7XG4gICAgYXNzZXJ0KHBvcnQgaW5zdGFuY2VvZiBBdXRvUm91dGVyUG9ydCk7XG4gICAgdGhpcy5ob3Jpem9udGFsLmFkZFBvcnRFZGdlcyhwb3J0KTtcbiAgICB0aGlzLnZlcnRpY2FsLmFkZFBvcnRFZGdlcyhwb3J0KTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuZGVsZXRlRWRnZXMgPSBmdW5jdGlvbiAob2JqZWN0KSB7XG4gICAgdGhpcy5ob3Jpem9udGFsLmRlbGV0ZUVkZ2VzKG9iamVjdCk7XG4gICAgdGhpcy52ZXJ0aWNhbC5kZWxldGVFZGdlcyhvYmplY3QpO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fYWRkQWxsRWRnZXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgYXNzZXJ0KHRoaXMuaG9yaXpvbnRhbC5pc0VtcHR5KCkgJiYgdGhpcy52ZXJ0aWNhbC5pc0VtcHR5KCksXG4gICAgICAgICdBUkdyYXBoLmFkZEFsbEVkZ2VzOiBob3Jpem9udGFsLmlzRW1wdHkoKSAmJiB2ZXJ0aWNhbC5pc0VtcHR5KCkgRkFJTEVEJyk7XG5cbiAgICB2YXIgaWRzID0gT2JqZWN0LmtleXModGhpcy5ib3hlcyksXG4gICAgICAgIGk7XG5cbiAgICBmb3IgKGkgPSBpZHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHRoaXMuX2FkZEJveEFuZFBvcnRFZGdlcyh0aGlzLmJveGVzW2lkc1tpXV0pO1xuICAgIH1cblxuICAgIGZvciAoaSA9IHRoaXMucGF0aHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHRoaXMuaG9yaXpvbnRhbC5hZGRQYXRoRWRnZXModGhpcy5wYXRoc1tpXSk7XG4gICAgICAgIHRoaXMudmVydGljYWwuYWRkUGF0aEVkZ2VzKHRoaXMucGF0aHNbaV0pO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2RlbGV0ZUFsbEVkZ2VzID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuaG9yaXpvbnRhbC5kZWxldGVBbGxFZGdlcygpO1xuICAgIHRoaXMudmVydGljYWwuZGVsZXRlQWxsRWRnZXMoKTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2FkZEJveEFuZFBvcnRFZGdlcyA9IGZ1bmN0aW9uIChib3gpIHtcbiAgICBhc3NlcnQoYm94ICE9PSBudWxsLCAnQVJHcmFwaC5hZGRCb3hBbmRQb3J0RWRnZXM6IGJveCAhPT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIHRoaXMuX2FkZEJveEVkZ2VzKGJveCk7XG5cbiAgICBmb3IgKHZhciBpID0gYm94LnBvcnRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICB0aGlzLl9hZGRQb3J0RWRnZXMoYm94LnBvcnRzW2ldKTtcbiAgICB9XG5cbiAgICAvLyBBZGQgdG8gYnVmZmVyYm94ZXNcbiAgICB0aGlzLl9hZGRUb0J1ZmZlckJveGVzKGJveCk7XG4gICAgdGhpcy5fdXBkYXRlQm94UG9ydEF2YWlsYWJpbGl0eShib3gpO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fZGVsZXRlQm94QW5kUG9ydEVkZ2VzID0gZnVuY3Rpb24gKGJveCkge1xuICAgIGFzc2VydChib3ggIT09IG51bGwsICdBUkdyYXBoLmRlbGV0ZUJveEFuZFBvcnRFZGdlczogYm94ICE9PSBudWxsIEZBSUxFRCcpO1xuXG4gICAgdGhpcy5kZWxldGVFZGdlcyhib3gpO1xuXG4gICAgZm9yICh2YXIgaSA9IGJveC5wb3J0cy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgdGhpcy5kZWxldGVFZGdlcyhib3gucG9ydHNbaV0pO1xuICAgIH1cblxuICAgIHRoaXMuX3JlbW92ZUZyb21CdWZmZXJCb3hlcyhib3gpO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fZ2V0RWRnZUxpc3QgPSBmdW5jdGlvbiAoaXNob3Jpem9udGFsKSB7XG4gICAgcmV0dXJuIGlzaG9yaXpvbnRhbCA/IHRoaXMuaG9yaXpvbnRhbCA6IHRoaXMudmVydGljYWw7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9jYW5kZWxldGVUd29FZGdlc0F0ID0gZnVuY3Rpb24gKHBhdGgsIHBvaW50cywgcG9zKSB7XG4gICAgaWYgKENPTlNUQU5UUy5ERUJVRykge1xuICAgICAgICBhc3NlcnQocGF0aC5vd25lciA9PT0gdGhpcywgJ0FSR3JhcGguY2FuZGVsZXRlVHdvRWRnZXNBdDogcGF0aC5vd25lciA9PT0gdGhpcyBGQUlMRUQnKTtcbiAgICAgICAgcGF0aC5hc3NlcnRWYWxpZCgpO1xuICAgICAgICBhc3NlcnQocGF0aC5pc0Nvbm5lY3RlZCgpLCAnQVJHcmFwaC5jYW5kZWxldGVUd29FZGdlc0F0OiBwYXRoLmlzQ29ubmVjdGVkKCkgRkFJTEVEJyk7XG4gICAgICAgIHBvaW50cy5Bc3NlcnRWYWxpZFBvcyhwb3MpO1xuICAgIH1cblxuICAgIGlmIChwb3MgKyAyID49IHBvaW50cy5sZW5ndGggfHwgcG9zIDwgMSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgdmFyIHBvaW50cG9zID0gcG9zLFxuICAgICAgICBwb2ludCA9IHBvaW50c1twb3MrK10sXG4gICAgICAgIG5wb2ludHBvcyA9IHBvcyxcbiAgICAgICAgbnBvaW50ID0gcG9pbnRzW3BvcysrXSxcbiAgICAgICAgbm5wb2ludHBvcyA9IHBvcztcblxuICAgIHBvcyA9IHBvaW50cG9zO1xuICAgIHBvcy0tO1xuICAgIHZhciBwcG9pbnRwb3MgPSBwb3M7XG5cbiAgICB2YXIgcHBvaW50ID0gcG9pbnRzW3Bvcy0tXSxcbiAgICAgICAgcHBwb2ludHBvcyA9IHBvcztcblxuICAgIGlmIChucG9pbnQuZXF1YWxzKHBvaW50KSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7IC8vIGRpcmVjdGlvbiBvZiB6ZXJvLWxlbmd0aCBlZGdlcyBjYW4ndCBiZSBkZXRlcm1pbmVkLCBzbyBkb24ndCBkZWxldGUgdGhlbVxuICAgIH1cblxuICAgIGFzc2VydChwcHBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCAmJiBwcG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoICYmIHBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCAmJlxuICAgICAgICBucG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoICYmIG5ucG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoLFxuICAgICAgICAnQVJHcmFwaC5jYW5kZWxldGVUd29FZGdlc0F0OiBwcHBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCAmJiBwcG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoICYmJyArXG4gICAgICAgICdwb2ludHBvcyA8IHBvaW50cy5sZW5ndGggJiYgbnBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCAmJiBubnBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCBGQUlMRUQnKTtcblxuICAgIHZhciBkaXIgPSBVdGlscy5nZXREaXIobnBvaW50Lm1pbnVzKHBvaW50KSk7XG5cbiAgICBhc3NlcnQoVXRpbHMuaXNSaWdodEFuZ2xlKGRpciksICdBUkdyYXBoLmNhbmRlbGV0ZVR3b0VkZ2VzQXQ6IFV0aWxzLmlzUmlnaHRBbmdsZSAoZGlyKSBGQUlMRUQnKTtcbiAgICB2YXIgaXNob3Jpem9udGFsID0gVXRpbHMuaXNIb3Jpem9udGFsKGRpcik7XG5cbiAgICB2YXIgbmV3cG9pbnQgPSBuZXcgQXJQb2ludCgpO1xuXG4gICAgaWYgKGlzaG9yaXpvbnRhbCkge1xuICAgICAgICBuZXdwb2ludC54ID0gVXRpbHMuZ2V0UG9pbnRDb29yZChucG9pbnQsIGlzaG9yaXpvbnRhbCk7XG4gICAgICAgIG5ld3BvaW50LnkgPSBVdGlscy5nZXRQb2ludENvb3JkKHBwb2ludCwgIWlzaG9yaXpvbnRhbCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbmV3cG9pbnQueSA9IFV0aWxzLmdldFBvaW50Q29vcmQobnBvaW50LCBpc2hvcml6b250YWwpO1xuICAgICAgICBuZXdwb2ludC54ID0gVXRpbHMuZ2V0UG9pbnRDb29yZChwcG9pbnQsICFpc2hvcml6b250YWwpO1xuICAgIH1cblxuICAgIGFzc2VydChVdGlscy5nZXREaXIobmV3cG9pbnQubWludXMocHBvaW50KSkgPT09IGRpcixcbiAgICAgICAgJ0FSR3JhcGguY2FuZGVsZXRlVHdvRWRnZXNBdDogVXRpbHMuZ2V0RGlyIChuZXdwb2ludC5taW51cyhwcG9pbnQpKSA9PT0gZGlyIEZBSUxFRCcpO1xuXG4gICAgaWYgKHRoaXMuX2lzTGluZUNsaXBCb3hlcyhuZXdwb2ludCwgbnBvaW50KSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGlmICh0aGlzLl9pc0xpbmVDbGlwQm94ZXMobmV3cG9pbnQsIHBwb2ludCkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fZGVsZXRlVHdvRWRnZXNBdCA9IGZ1bmN0aW9uIChwYXRoLCBwb2ludHMsIHBvcykge1xuICAgIGlmIChDT05TVEFOVFMuREVCVUcpIHtcbiAgICAgICAgYXNzZXJ0KHBhdGgub3duZXIgPT09IHRoaXMsICdBUkdyYXBoLmRlbGV0ZVR3b0VkZ2VzQXQ6IHBhdGgub3duZXIgPT09IHRoaXMgRkFJTEVEJyk7XG4gICAgICAgIHBhdGguYXNzZXJ0VmFsaWQoKTtcbiAgICAgICAgYXNzZXJ0KHBhdGguaXNDb25uZWN0ZWQoKSwgJ0FSR3JhcGguZGVsZXRlVHdvRWRnZXNBdDogcGF0aC5pc0Nvbm5lY3RlZCgpIEZBSUxFRCcpO1xuICAgICAgICBwb2ludHMuQXNzZXJ0VmFsaWRQb3MocG9zKTtcbiAgICB9XG5cbiAgICB2YXIgcG9pbnRwb3MgPSBwb3MsIC8vR2V0dGluZyB0aGUgbmV4dCwgYW5kIG5leHQtbmV4dCwgcG9pbnRzXG4gICAgICAgIHBvaW50ID0gcG9pbnRzW3BvcysrXSxcbiAgICAgICAgbnBvaW50cG9zID0gcG9zLFxuICAgICAgICBucG9pbnQgPSBwb2ludHNbcG9zKytdLFxuICAgICAgICBubnBvaW50cG9zID0gcG9zLFxuICAgICAgICBubnBvaW50ID0gcG9pbnRzW3BvcysrXSxcbiAgICAgICAgbm5ucG9pbnRwb3MgPSBwb3M7XG5cbiAgICBwb3MgPSBwb2ludHBvcztcbiAgICBwb3MtLTtcblxuICAgIHZhciBwcG9pbnRwb3MgPSBwb3MsIC8vR2V0dGluZyB0aGUgcHJldiwgcHJldi1wcmV2IHBvaW50c1xuICAgICAgICBwcG9pbnQgPSBwb2ludHNbcG9zLS1dLFxuICAgICAgICBwcHBvaW50cG9zID0gcG9zLFxuICAgICAgICBwcHBvaW50ID0gcG9pbnRzW3Bvcy0tXTtcblxuICAgIGFzc2VydChwcHBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCAmJiBwcG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoICYmIHBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCAmJlxuICAgIG5wb2ludHBvcyA8IHBvaW50cy5sZW5ndGggJiYgbm5wb2ludHBvcyA8IHBvaW50cy5sZW5ndGgsXG4gICAgICAgICdBUkdyYXBoLmRlbGV0ZVR3b0VkZ2VzQXQ6IHBwcG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoICYmIHBwb2ludHBvcyA8IHBvaW50cy5sZW5ndGggJiYgcG9pbnRwb3MgPCAnICtcbiAgICAgICAgJ3BvaW50cy5sZW5ndGggJiYgbnBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCAmJiBubnBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCBGQUlMRUQnKTtcbiAgICBhc3NlcnQocHBwb2ludCAhPT0gbnVsbCAmJiBwcG9pbnQgIT09IG51bGwgJiYgcG9pbnQgIT09IG51bGwgJiYgbnBvaW50ICE9PSBudWxsICYmIG5ucG9pbnQgIT09IG51bGwsXG4gICAgICAgICdBUkdyYXBoLmRlbGV0ZVR3b0VkZ2VzQXQ6IHBwcG9pbnQgIT09IG51bGwgJiYgcHBvaW50ICE9PSBudWxsICYmIHBvaW50ICE9PSBudWxsICYmIG5wb2ludCAhPT0gbnVsbCAmJicgK1xuICAgICAgICAnIG5ucG9pbnQgIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICB2YXIgZGlyID0gVXRpbHMuZ2V0RGlyKG5wb2ludC5taW51cyhwb2ludCkpO1xuXG4gICAgYXNzZXJ0KFV0aWxzLmlzUmlnaHRBbmdsZShkaXIpLCAnQVJHcmFwaC5kZWxldGVUd29FZGdlc0F0OiBVdGlscy5pc1JpZ2h0QW5nbGUgKGRpcikgRkFJTEVEJyk7XG4gICAgdmFyIGlzaG9yaXpvbnRhbCA9IFV0aWxzLmlzSG9yaXpvbnRhbChkaXIpO1xuXG4gICAgdmFyIG5ld3BvaW50ID0gbmV3IEFyUG9pbnQoKTtcbiAgICBpZiAoaXNob3Jpem9udGFsKSB7XG4gICAgICAgIG5ld3BvaW50LnggPSBVdGlscy5nZXRQb2ludENvb3JkKG5wb2ludCwgaXNob3Jpem9udGFsKTtcbiAgICAgICAgbmV3cG9pbnQueSA9IFV0aWxzLmdldFBvaW50Q29vcmQocHBvaW50LCAhaXNob3Jpem9udGFsKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBuZXdwb2ludC54ID0gVXRpbHMuZ2V0UG9pbnRDb29yZChwcG9pbnQsICFpc2hvcml6b250YWwpO1xuICAgICAgICBuZXdwb2ludC55ID0gVXRpbHMuZ2V0UG9pbnRDb29yZChucG9pbnQsIGlzaG9yaXpvbnRhbCk7XG4gICAgfVxuXG4gICAgYXNzZXJ0KFV0aWxzLmdldERpcihuZXdwb2ludC5taW51cyhwcG9pbnQpKSA9PT0gZGlyLFxuICAgICAgICAnQVJHcmFwaC5kZWxldGVUd29FZGdlc0F0OiBVdGlscy5nZXREaXIgKG5ld3BvaW50Lm1pbnVzKHBwb2ludCkpID09PSBkaXIgRkFJTEVEJyk7XG5cbiAgICBhc3NlcnQoIXRoaXMuX2lzTGluZUNsaXBCb3hlcyhuZXdwb2ludCwgbnBvaW50KSxcbiAgICAgICAgJ0FSR3JhcGguZGVsZXRlVHdvRWRnZXNBdDogIWlzTGluZUNsaXBCb3hlcyhuZXdwb2ludCwgbnBvaW50KSBGQUlMRUQnKTtcbiAgICBhc3NlcnQoIXRoaXMuX2lzTGluZUNsaXBCb3hlcyhuZXdwb2ludCwgcHBvaW50KSxcbiAgICAgICAgJ0FSR3JhcGguZGVsZXRlVHdvRWRnZXNBdDogIWlzTGluZUNsaXBCb3hlcyhuZXdwb2ludCwgcHBvaW50KSBGQUlMRUQnKTtcblxuICAgIHZhciBobGlzdCA9IHRoaXMuX2dldEVkZ2VMaXN0KGlzaG9yaXpvbnRhbCksXG4gICAgICAgIHZsaXN0ID0gdGhpcy5fZ2V0RWRnZUxpc3QoIWlzaG9yaXpvbnRhbCk7XG5cbiAgICB2YXIgcHBlZGdlID0gaGxpc3QuZ2V0RWRnZUJ5UG9pbnRlcihwcHBvaW50KSxcbiAgICAgICAgcGVkZ2UgPSB2bGlzdC5nZXRFZGdlQnlQb2ludGVyKHBwb2ludCksXG4gICAgICAgIG5lZGdlID0gaGxpc3QuZ2V0RWRnZUJ5UG9pbnRlcihwb2ludCksXG4gICAgICAgIG5uZWRnZSA9IHZsaXN0LmdldEVkZ2VCeVBvaW50ZXIobnBvaW50KTtcblxuICAgIGFzc2VydChwcGVkZ2UgIT09IG51bGwgJiYgcGVkZ2UgIT09IG51bGwgJiYgbmVkZ2UgIT09IG51bGwgJiYgbm5lZGdlICE9PSBudWxsLFxuICAgICAgICAnQVJHcmFwaC5kZWxldGVUd29FZGdlc0F0OiAgcHBlZGdlICE9PSBudWxsICYmIHBlZGdlICE9PSBudWxsICYmIG5lZGdlICE9PSBudWxsICYmIG5uZWRnZSAhPT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIHZsaXN0LnJlbW92ZShwZWRnZSk7XG4gICAgaGxpc3QucmVtb3ZlKG5lZGdlKTtcblxuICAgIHBvaW50cy5zcGxpY2UocHBvaW50cG9zLCAzLCBuZXdwb2ludCk7XG4gICAgcHBlZGdlLmVuZHBvaW50TmV4dCA9IG5ucG9pbnQ7XG4gICAgcHBlZGdlLmVuZHBvaW50ID0gbmV3cG9pbnQ7XG5cbiAgICBubmVkZ2Uuc3RhcnRwb2ludCA9IG5ld3BvaW50O1xuICAgIG5uZWRnZS5zdGFydHBvaW50UHJldiA9IHBwcG9pbnQ7XG5cbiAgICBpZiAobm5ucG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoKSB7XG4gICAgICAgIHZhciBubm5lZGdlID0gaGxpc3QuZ2V0RWRnZUJ5UG9pbnRlcihubnBvaW50LCAobm5ucG9pbnRwb3MpKTtcbiAgICAgICAgYXNzZXJ0KG5ubmVkZ2UgIT09IG51bGwsXG4gICAgICAgICAgICAnQVJHcmFwaC5kZWxldGVUd29FZGdlc0F0OiBubm5lZGdlICE9PSBudWxsIEZBSUxFRCcpO1xuICAgICAgICBhc3NlcnQobm5uZWRnZS5zdGFydHBvaW50UHJldi5lcXVhbHMobnBvaW50KSAmJiBubm5lZGdlLnN0YXJ0cG9pbnQuZXF1YWxzKG5ucG9pbnQpLFxuICAgICAgICAgICAgJ0FSR3JhcGguZGVsZXRlVHdvRWRnZXNBdDogbm5uZWRnZS5zdGFydHBvaW50UHJldi5lcXVhbHMobnBvaW50KScgK1xuICAgICAgICAgICAgJyYmIG5ubmVkZ2Uuc3RhcnRwb2ludC5lcXVhbHMobm5wb2ludCkgRkFJTEVEJyk7XG4gICAgICAgIG5ubmVkZ2Uuc3RhcnRwb2ludFByZXYgPSBwcG9pbnQ7XG4gICAgfVxuXG4gICAgaWYgKG5ucG9pbnQuZXF1YWxzKG5ld3BvaW50KSkge1xuICAgICAgICB0aGlzLl9kZWxldGVTYW1lUG9pbnRzQXQocGF0aCwgcG9pbnRzLCBwcG9pbnRwb3MpO1xuICAgIH1cblxufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fZGVsZXRlU2FtZVBvaW50c0F0ID0gZnVuY3Rpb24gKHBhdGgsIHBvaW50cywgcG9zKSB7XG4gICAgaWYgKENPTlNUQU5UUy5ERUJVRykge1xuICAgICAgICBhc3NlcnQocGF0aC5vd25lciA9PT0gdGhpcywgJ0FSR3JhcGguZGVsZXRlU2FtZVBvaW50c0F0OiBwYXRoLm93bmVyID09PSB0aGlzIEZBSUxFRCcpO1xuICAgICAgICBwYXRoLmFzc2VydFZhbGlkKCk7XG4gICAgICAgIGFzc2VydChwYXRoLmlzQ29ubmVjdGVkKCksICdBUkdyYXBoLmRlbGV0ZVNhbWVQb2ludHNBdDogcGF0aC5pc0Nvbm5lY3RlZCgpIEZBSUxFRCcpO1xuICAgICAgICBwb2ludHMuQXNzZXJ0VmFsaWRQb3MocG9zKTtcbiAgICB9XG5cbiAgICB2YXIgcG9pbnRwb3MgPSBwb3MsXG4gICAgICAgIHBvaW50ID0gcG9pbnRzW3BvcysrXSxcbiAgICAgICAgbnBvaW50cG9zID0gcG9zLFxuICAgICAgICBucG9pbnQgPSBwb2ludHNbcG9zKytdLFxuICAgICAgICBubnBvaW50cG9zID0gcG9zLFxuICAgICAgICBubnBvaW50ID0gcG9pbnRzW3BvcysrXSxcbiAgICAgICAgbm5ucG9pbnRwb3MgPSBwb3M7XG5cbiAgICBwb3MgPSBwb2ludHBvcztcbiAgICBwb3MtLTtcblxuICAgIHZhciBwcG9pbnRwb3MgPSBwb3MsXG4gICAgICAgIHBwb2ludCA9IHBvaW50c1twb3MtLV0sXG4gICAgICAgIHBwcG9pbnRwb3MgPSBwb3MsXG4gICAgICAgIHBwcG9pbnQgPSBwb3MgPT09IHBvaW50cy5sZW5ndGggPyBudWxsIDogcG9pbnRzW3Bvcy0tXTtcblxuICAgIGFzc2VydChwcG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoICYmIHBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCAmJiBucG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoICYmXG4gICAgbm5wb2ludHBvcyA8IHBvaW50cy5sZW5ndGgpO1xuICAgIGFzc2VydChwcG9pbnQgIT09IG51bGwgJiYgcG9pbnQgIT09IG51bGwgJiYgbnBvaW50ICE9PSBudWxsICYmIG5ucG9pbnQgIT09IG51bGwsXG4gICAgICAgICdBUkdyYXBoLmRlbGV0ZVNhbWVQb2ludHNBdDogcHBvaW50ICE9PSBudWxsICYmIHBvaW50ICE9PSBudWxsICYmIG5wb2ludCAhPT0gbnVsbCAmJiAnICtcbiAgICAgICAgJ25ucG9pbnQgIT09IG51bGwgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KHBvaW50LmVxdWFscyhucG9pbnQpICYmICFwb2ludC5lcXVhbHMocHBvaW50KSxcbiAgICAgICAgJ0FSR3JhcGguZGVsZXRlU2FtZVBvaW50c0F0OiBwb2ludC5lcXVhbHMobnBvaW50KSAmJiAhcG9pbnQuZXF1YWxzKHBwb2ludCkgRkFJTEVEJyk7XG5cbiAgICB2YXIgZGlyID0gVXRpbHMuZ2V0RGlyKHBvaW50Lm1pbnVzKHBwb2ludCkpO1xuICAgIGFzc2VydChVdGlscy5pc1JpZ2h0QW5nbGUoZGlyKSwgJ0FSR3JhcGguZGVsZXRlU2FtZVBvaW50c0F0OiBVdGlscy5pc1JpZ2h0QW5nbGUgKGRpcikgRkFJTEVEJyk7XG5cbiAgICB2YXIgaXNob3Jpem9udGFsID0gVXRpbHMuaXNIb3Jpem9udGFsKGRpciksXG4gICAgICAgIGhsaXN0ID0gdGhpcy5fZ2V0RWRnZUxpc3QoaXNob3Jpem9udGFsKSxcbiAgICAgICAgdmxpc3QgPSB0aGlzLl9nZXRFZGdlTGlzdCghaXNob3Jpem9udGFsKSxcblxuICAgICAgICBwZWRnZSA9IGhsaXN0LmdldEVkZ2VCeVBvaW50ZXIocHBvaW50LCBwb2ludCksXG4gICAgICAgIG5lZGdlID0gdmxpc3QuZ2V0RWRnZUJ5UG9pbnRlcihwb2ludCwgbnBvaW50KSxcbiAgICAgICAgbm5lZGdlID0gaGxpc3QuZ2V0RWRnZUJ5UG9pbnRlcihucG9pbnQsIG5ucG9pbnQpO1xuXG4gICAgYXNzZXJ0KHBlZGdlICE9PSBudWxsICYmIG5lZGdlICE9PSBudWxsICYmIG5uZWRnZSAhPT0gbnVsbCwgJ0FSR3JhcGguZGVsZXRlU2FtZVBvaW50c0F0OiBwZWRnZSAhPT0gbnVsbCAnICtcbiAgICAnJiYgbmVkZ2UgIT09IG51bGwgJiYgbm5lZGdlICE9PSBudWxsIEZBSUxFRCcpO1xuXG4gICAgdmxpc3QucmVtb3ZlKHBlZGdlKTtcbiAgICBobGlzdC5yZW1vdmUobmVkZ2UpO1xuXG4gICAgcG9pbnRzLnNwbGljZShwb2ludHBvcywgMik7XG5cbiAgICBpZiAocHBwb2ludHBvcyA8IHBvaW50cy5sZW5ndGgpIHtcbiAgICAgICAgdmFyIHBwZWRnZSA9IHZsaXN0LmdldEVkZ2VCeVBvaW50ZXIocHBwb2ludCwgcHBvaW50KTtcbiAgICAgICAgYXNzZXJ0KHBwZWRnZSAhPT0gbnVsbCAmJiBwcGVkZ2UuZW5kcG9pbnQuZXF1YWxzKHBwb2ludCkgJiYgcHBlZGdlLmVuZHBvaW50TmV4dC5lcXVhbHMocG9pbnQpLFxuICAgICAgICAgICAgJ0FSR3JhcGguZGVsZXRlU2FtZVBvaW50c0F0OiBwcGVkZ2UgIT09IG51bGwgJiYgcHBlZGdlLmVuZHBvaW50LmVxdWFscyhwcG9pbnQpICYmICcgK1xuICAgICAgICAgICAgJ3BwZWRnZS5lbmRwb2ludE5leHQuZXF1YWxzKHBvaW50KSBGQUlMRUQnKTtcbiAgICAgICAgcHBlZGdlLmVuZHBvaW50TmV4dCA9IG5ucG9pbnQ7XG4gICAgfVxuXG4gICAgYXNzZXJ0KG5uZWRnZS5zdGFydHBvaW50LmVxdWFscyhucG9pbnQpICYmIG5uZWRnZS5zdGFydHBvaW50UHJldi5lcXVhbHMocG9pbnQpLFxuICAgICAgICAnQVJHcmFwaC5kZWxldGVTYW1lUG9pbnRzQXQ6IG5uZWRnZS5zdGFydHBvaW50LmVxdWFscyhucG9pbnQpICYmIG5uZWRnZS5zdGFydHBvaW50UHJldi5lcXVhbHMocG9pbnQpJyArXG4gICAgICAgICcgRkFJTEVEJyk7XG4gICAgbm5lZGdlLnNldFN0YXJ0UG9pbnQocHBvaW50KTtcbiAgICBubmVkZ2Uuc3RhcnRwb2ludFByZXYgPSBwcHBvaW50O1xuXG4gICAgaWYgKG5ubnBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCkge1xuICAgICAgICB2YXIgbm5uZWRnZSA9IHZsaXN0LmdldEVkZ2VCeVBvaW50ZXIobm5wb2ludCwgKG5ubnBvaW50cG9zKSk7IC8vJipcbiAgICAgICAgYXNzZXJ0KG5ubmVkZ2UgIT09IG51bGwgJiYgbm5uZWRnZS5zdGFydHBvaW50UHJldi5lcXVhbHMobnBvaW50KSAmJiBubm5lZGdlLnN0YXJ0cG9pbnQuZXF1YWxzKG5ucG9pbnQpLFxuICAgICAgICAgICAgJ0FSR3JhcGguZGVsZXRlU2FtZVBvaW50c0F0OiBubm5lZGdlICE9PSBudWxsICYmIG5ubmVkZ2Uuc3RhcnRwb2ludFByZXYuZXF1YWxzKG5wb2ludCkgJiYgJyArXG4gICAgICAgICAgICAnbm5uZWRnZS5zdGFydHBvaW50LmVxdWFscyhubnBvaW50KSBGQUlMRUQnKTtcbiAgICAgICAgbm5uZWRnZS5zdGFydHBvaW50UHJldiA9IHBwb2ludDtcbiAgICB9XG5cbiAgICBpZiAoQ09OU1RBTlRTLkRFQlVHX0RFRVApIHtcbiAgICAgICAgcGF0aC5hc3NlcnRWYWxpZCgpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX3NpbXBsaWZ5UGF0aHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIG1vZGlmaWVkID0gZmFsc2UsXG4gICAgICAgIHBhdGgsXG4gICAgICAgIHBvaW50TGlzdCxcbiAgICAgICAgcG9pbnRwb3M7XG5cbiAgICBmb3IgKHZhciBpID0gdGhpcy5wYXRocy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgcGF0aCA9IHRoaXMucGF0aHNbaV07XG5cbiAgICAgICAgaWYgKHBhdGguaXNBdXRvUm91dGVkKCkpIHtcbiAgICAgICAgICAgIHBvaW50TGlzdCA9IHBhdGguZ2V0UG9pbnRMaXN0KCk7XG4gICAgICAgICAgICBwb2ludHBvcyA9IDA7XG5cbiAgICAgICAgICAgIG1vZGlmaWVkID0gdGhpcy5fZml4U2hvcnRQYXRocyhwYXRoKSB8fCBtb2RpZmllZDtcblxuICAgICAgICAgICAgd2hpbGUgKHBvaW50cG9zIDwgcG9pbnRMaXN0Lmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9jYW5kZWxldGVUd29FZGdlc0F0KHBhdGgsIHBvaW50TGlzdCwgcG9pbnRwb3MpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2RlbGV0ZVR3b0VkZ2VzQXQocGF0aCwgcG9pbnRMaXN0LCBwb2ludHBvcyk7XG4gICAgICAgICAgICAgICAgICAgIG1vZGlmaWVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHBvaW50cG9zKys7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbW9kaWZpZWQ7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9jZW50ZXJTdGFpcnNJblBhdGhQb2ludHMgPSBmdW5jdGlvbiAocGF0aCwgaGludHN0YXJ0ZGlyLCBoaW50ZW5kZGlyKSB7XG4gICAgYXNzZXJ0KHBhdGggIT09IG51bGwsICdBUkdyYXBoLmNlbnRlclN0YWlyc0luUGF0aFBvaW50czogcGF0aCAhPT0gbnVsbCBGQUlMRUQnKTtcbiAgICBhc3NlcnQoIXBhdGguaXNDb25uZWN0ZWQoKSwgJ0FSR3JhcGguY2VudGVyU3RhaXJzSW5QYXRoUG9pbnRzOiAhcGF0aC5pc0Nvbm5lY3RlZCgpIEZBSUxFRCcpO1xuXG4gICAgdmFyIHBvaW50TGlzdCA9IHBhdGguZ2V0UG9pbnRMaXN0KCk7XG4gICAgYXNzZXJ0KHBvaW50TGlzdC5sZW5ndGggPj0gMiwgJ0FSR3JhcGguY2VudGVyU3RhaXJzSW5QYXRoUG9pbnRzOiBwb2ludExpc3QubGVuZ3RoID49IDIgRkFJTEVEJyk7XG5cbiAgICBpZiAoQ09OU1RBTlRTLkRFQlVHKSB7XG4gICAgICAgIHBhdGguYXNzZXJ0VmFsaWRQb2ludHMoKTtcbiAgICB9XG5cbiAgICB2YXIgcDEsXG4gICAgICAgIHAyLFxuICAgICAgICBwMyxcbiAgICAgICAgcDQsXG5cbiAgICAgICAgcDFwID0gcG9pbnRMaXN0Lmxlbmd0aCxcbiAgICAgICAgcDJwID0gcG9pbnRMaXN0Lmxlbmd0aCxcbiAgICAgICAgcDNwID0gcG9pbnRMaXN0Lmxlbmd0aCxcbiAgICAgICAgcDRwID0gcG9pbnRMaXN0Lmxlbmd0aCxcblxuICAgICAgICBkMTIgPSBDT05TVEFOVFMuRGlyTm9uZSxcbiAgICAgICAgZDIzID0gQ09OU1RBTlRTLkRpck5vbmUsXG4gICAgICAgIGQzNCA9IENPTlNUQU5UUy5EaXJOb25lLFxuXG4gICAgICAgIG91dE9mQm94U3RhcnRQb2ludCA9IHBhdGguZ2V0T3V0T2ZCb3hTdGFydFBvaW50KGhpbnRzdGFydGRpciksXG4gICAgICAgIG91dE9mQm94RW5kUG9pbnQgPSBwYXRoLmdldE91dE9mQm94RW5kUG9pbnQoaGludGVuZGRpciksXG5cbiAgICAgICAgcG9zID0gMDtcbiAgICBhc3NlcnQocG9zIDwgcG9pbnRMaXN0Lmxlbmd0aCwgJ0FSR3JhcGguY2VudGVyU3RhaXJzSW5QYXRoUG9pbnRzIHBvcyA8IHBvaW50TGlzdC5sZW5ndGggRkFJTEVEJyk7XG5cbiAgICBwMXAgPSBwb3M7XG4gICAgcDEgPSAocG9pbnRMaXN0W3BvcysrXSk7XG5cbiAgICB2YXIgbnAyLFxuICAgICAgICBucDMsXG4gICAgICAgIGgsXG4gICAgICAgIHA0eCxcbiAgICAgICAgcDN4LFxuICAgICAgICBwMXgsXG4gICAgICAgIHRtcCxcbiAgICAgICAgdCxcbiAgICAgICAgbTtcblxuXG4gICAgd2hpbGUgKHBvcyA8IHBvaW50TGlzdC5sZW5ndGgpIHtcbiAgICAgICAgcDRwID0gcDNwO1xuICAgICAgICBwM3AgPSBwMnA7XG4gICAgICAgIHAycCA9IHAxcDtcbiAgICAgICAgcDFwID0gcG9zO1xuXG4gICAgICAgIHA0ID0gcDM7XG4gICAgICAgIHAzID0gcDI7XG4gICAgICAgIHAyID0gcDE7XG4gICAgICAgIHAxID0gKHBvaW50TGlzdFtwb3MrK10pO1xuXG4gICAgICAgIGQzNCA9IGQyMztcbiAgICAgICAgZDIzID0gZDEyO1xuXG4gICAgICAgIGlmIChwMnAgPCBwb2ludExpc3QubGVuZ3RoKSB7XG4gICAgICAgICAgICBkMTIgPSBVdGlscy5nZXREaXIocDIubWludXMocDEpKTtcbiAgICAgICAgICAgIGlmIChDT05TVEFOVFMuREVCVUcpIHtcbiAgICAgICAgICAgICAgICBhc3NlcnQoVXRpbHMuaXNSaWdodEFuZ2xlKGQxMiksICdBUkdyYXBoLmNlbnRlclN0YWlyc0luUGF0aFBvaW50czogJyArXG4gICAgICAgICAgICAgICAgJ1V0aWxzLmlzUmlnaHRBbmdsZSAoZDEyKSBGQUlMRUQnKTtcbiAgICAgICAgICAgICAgICBpZiAocDNwICE9PSBwb2ludExpc3QuZW5kKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KFV0aWxzLmFyZUluUmlnaHRBbmdsZShkMTIsIGQyMyksICdBUkdyYXBoLmNlbnRlclN0YWlyc0luUGF0aFBvaW50czogJyArXG4gICAgICAgICAgICAgICAgICAgICdVdGlscy5hcmVJblJpZ2h0QW5nbGUgKGQxMiwgZDIzKSBGQUlMRUQnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocDRwIDwgcG9pbnRMaXN0Lmxlbmd0aCAmJiBkMTIgPT09IGQzNCkge1xuICAgICAgICAgICAgYXNzZXJ0KHAxcCA8IHBvaW50TGlzdC5sZW5ndGggJiYgcDJwIDwgcG9pbnRMaXN0Lmxlbmd0aCAmJiBwM3AgPCBwb2ludExpc3QubGVuZ3RoICYmXG4gICAgICAgICAgICBwNHAgPCBwb2ludExpc3QubGVuZ3RoLCAnQVJHcmFwaC5jZW50ZXJTdGFpcnNJblBhdGhQb2ludHM6IHAxcCA8IHBvaW50TGlzdC5sZW5ndGggJiYgJyArXG4gICAgICAgICAgICAncDJwIDwgcG9pbnRMaXN0Lmxlbmd0aCAmJiBwM3AgPCBwb2ludExpc3QubGVuZ3RoICYmIHA0cCA8IHBvaW50TGlzdC5sZW5ndGggRkFJTEVEJyk7XG5cbiAgICAgICAgICAgIG5wMiA9IG5ldyBBclBvaW50KHAyKTtcbiAgICAgICAgICAgIG5wMyA9IG5ldyBBclBvaW50KHAzKTtcbiAgICAgICAgICAgIGggPSBVdGlscy5pc0hvcml6b250YWwoZDEyKTtcblxuICAgICAgICAgICAgcDR4ID0gVXRpbHMuZ2V0UG9pbnRDb29yZChwNCwgaCk7XG4gICAgICAgICAgICBwM3ggPSBVdGlscy5nZXRQb2ludENvb3JkKHAzLCBoKTtcbiAgICAgICAgICAgIHAxeCA9IFV0aWxzLmdldFBvaW50Q29vcmQocDEsIGgpO1xuXG4gICAgICAgICAgICAvLyBwMXggd2lsbCByZXByZXNlbnQgdGhlIGxhcmdlciB4IHZhbHVlIGluIHRoaXMgJ3N0ZXAnIHNpdHVhdGlvblxuICAgICAgICAgICAgaWYgKHAxeCA8IHA0eCkge1xuICAgICAgICAgICAgICAgIHQgPSBwMXg7XG4gICAgICAgICAgICAgICAgcDF4ID0gcDR4O1xuICAgICAgICAgICAgICAgIHA0eCA9IHQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChwNHggPCBwM3ggJiYgcDN4IDwgcDF4KSB7XG4gICAgICAgICAgICAgICAgbSA9IE1hdGgucm91bmQoKHA0eCArIHAxeCkgLyAyKTtcbiAgICAgICAgICAgICAgICBpZiAoaCkge1xuICAgICAgICAgICAgICAgICAgICBucDIueCA9IG07XG4gICAgICAgICAgICAgICAgICAgIG5wMy54ID0gbTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBucDIueSA9IG07XG4gICAgICAgICAgICAgICAgICAgIG5wMy55ID0gbTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0bXAgPSB0aGlzLl9nZXRMaW1pdHNPZkVkZ2UobnAyLCBucDMsIHA0eCwgcDF4KTtcbiAgICAgICAgICAgICAgICBwNHggPSB0bXAubWluO1xuICAgICAgICAgICAgICAgIHAxeCA9IHRtcC5tYXg7XG5cbiAgICAgICAgICAgICAgICBtID0gTWF0aC5yb3VuZCgocDR4ICsgcDF4KSAvIDIpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGgpIHtcbiAgICAgICAgICAgICAgICAgICAgbnAyLnggPSBtO1xuICAgICAgICAgICAgICAgICAgICBucDMueCA9IG07XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbnAyLnkgPSBtO1xuICAgICAgICAgICAgICAgICAgICBucDMueSA9IG07XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLl9pc0xpbmVDbGlwQm94ZXMobnAyLCBucDMpICYmICF0aGlzLl9pc0xpbmVDbGlwQm94ZXMocDFwID09PSBwb2ludExpc3QubGVuZ3RoID9cbiAgICAgICAgICAgICAgICAgICAgICAgIG91dE9mQm94RW5kUG9pbnQgOiBwMSwgbnAyKSAmJiAhdGhpcy5faXNMaW5lQ2xpcEJveGVzKHA0cCA9PT0gMCA/XG4gICAgICAgICAgICAgICAgICAgICAgICBvdXRPZkJveFN0YXJ0UG9pbnQgOiBwNCwgbnAzKSkge1xuICAgICAgICAgICAgICAgICAgICBwMiA9IG5wMjtcbiAgICAgICAgICAgICAgICAgICAgcDMgPSBucDM7XG4gICAgICAgICAgICAgICAgICAgIHBvaW50TGlzdC5zcGxpY2UocDJwLCAxLCBwMik7XG4gICAgICAgICAgICAgICAgICAgIHBvaW50TGlzdC5zcGxpY2UocDNwLCAxLCBwMyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKENPTlNUQU5UUy5ERUJVRykge1xuICAgICAgICBwYXRoLmFzc2VydFZhbGlkUG9pbnRzKCk7XG4gICAgfVxufTtcblxuLyoqXG4gKiBNYWtlIHN1cmUgaWYgYSBzdHJhaWdodCBsaW5lIGlzIHBvc3NpYmxlLCBjcmVhdGUgYSBzdHJhaWdodCBsaW5lIGZvclxuICogdGhlIHBhdGguXG4gKlxuICogQHBhcmFtIHtBdXRvUm91dGVyUGF0aH0gcGF0aFxuICovXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9maXhTaG9ydFBhdGhzID0gZnVuY3Rpb24gKHBhdGgpIHtcblxuICAgIHZhciBtb2RpZmllZCA9IGZhbHNlLFxuICAgICAgICBzdGFydHBvcnQgPSBwYXRoLmdldFN0YXJ0UG9ydCgpLFxuICAgICAgICBlbmRwb3J0ID0gcGF0aC5nZXRFbmRQb3J0KCksXG4gICAgICAgIGxlbiA9IHBhdGguZ2V0UG9pbnRMaXN0KCkubGVuZ3RoO1xuXG4gICAgaWYgKGxlbiA9PT0gNCkge1xuICAgICAgICB2YXIgcG9pbnRzID0gcGF0aC5nZXRQb2ludExpc3QoKSxcbiAgICAgICAgICAgIHN0YXJ0cG9pbnQgPSBwb2ludHNbMF0sXG4gICAgICAgICAgICBlbmRwb2ludCA9IHBvaW50c1tsZW4gLSAxXSxcbiAgICAgICAgICAgIHN0YXJ0RGlyID0gc3RhcnRwb3J0LnBvcnRPbldoaWNoRWRnZShzdGFydHBvaW50KSxcbiAgICAgICAgICAgIGVuZERpciA9IGVuZHBvcnQucG9ydE9uV2hpY2hFZGdlKGVuZHBvaW50KSxcbiAgICAgICAgICAgIHRzdFN0YXJ0LFxuICAgICAgICAgICAgdHN0RW5kO1xuXG4gICAgICAgIGlmIChzdGFydERpciA9PT0gVXRpbHMucmV2ZXJzZURpcihlbmREaXIpKSB7XG4gICAgICAgICAgICB2YXIgaXNIb3Jpem9udGFsID0gVXRpbHMuaXNIb3Jpem9udGFsKHN0YXJ0RGlyKSxcbiAgICAgICAgICAgICAgICBuZXdTdGFydCA9IG5ldyBBclBvaW50KHN0YXJ0cG9pbnQpLFxuICAgICAgICAgICAgICAgIG5ld0VuZCA9IG5ldyBBclBvaW50KGVuZHBvaW50KSxcbiAgICAgICAgICAgICAgICBzdGFydFJlY3QgPSBzdGFydHBvcnQucmVjdCxcbiAgICAgICAgICAgICAgICBlbmRSZWN0ID0gZW5kcG9ydC5yZWN0LFxuICAgICAgICAgICAgICAgIG1pbk92ZXJsYXAsXG4gICAgICAgICAgICAgICAgbWF4T3ZlcmxhcDtcblxuICAgICAgICAgICAgaWYgKGlzSG9yaXpvbnRhbCkge1xuICAgICAgICAgICAgICAgIG1pbk92ZXJsYXAgPSBNYXRoLm1pbihzdGFydFJlY3QuZmxvb3IsIGVuZFJlY3QuZmxvb3IpO1xuICAgICAgICAgICAgICAgIG1heE92ZXJsYXAgPSBNYXRoLm1heChzdGFydFJlY3QuY2VpbCwgZW5kUmVjdC5jZWlsKTtcblxuICAgICAgICAgICAgICAgIHZhciBuZXdZID0gKG1pbk92ZXJsYXAgKyBtYXhPdmVybGFwKSAvIDI7XG4gICAgICAgICAgICAgICAgbmV3U3RhcnQueSA9IG5ld1k7XG4gICAgICAgICAgICAgICAgbmV3RW5kLnkgPSBuZXdZO1xuXG4gICAgICAgICAgICAgICAgdHN0U3RhcnQgPSBuZXcgQXJQb2ludChVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChzdGFydHBvcnQub3duZXIucmVjdCwgc3RhcnREaXIpLCBuZXdTdGFydC55KTtcbiAgICAgICAgICAgICAgICB0c3RFbmQgPSBuZXcgQXJQb2ludChVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChlbmRwb3J0Lm93bmVyLnJlY3QsIGVuZERpciksIG5ld0VuZC55KTtcblxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBtaW5PdmVybGFwID0gTWF0aC5taW4oc3RhcnRSZWN0LnJpZ2h0LCBlbmRSZWN0LnJpZ2h0KTtcbiAgICAgICAgICAgICAgICBtYXhPdmVybGFwID0gTWF0aC5tYXgoc3RhcnRSZWN0LmxlZnQsIGVuZFJlY3QubGVmdCk7XG5cbiAgICAgICAgICAgICAgICB2YXIgbmV3WCA9IChtaW5PdmVybGFwICsgbWF4T3ZlcmxhcCkgLyAyO1xuICAgICAgICAgICAgICAgIG5ld1N0YXJ0LnggPSBuZXdYO1xuICAgICAgICAgICAgICAgIG5ld0VuZC54ID0gbmV3WDtcblxuICAgICAgICAgICAgICAgIHRzdFN0YXJ0ID0gbmV3IEFyUG9pbnQobmV3U3RhcnQueCwgVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQoc3RhcnRwb3J0Lm93bmVyLnJlY3QsIHN0YXJ0RGlyKSk7XG4gICAgICAgICAgICAgICAgdHN0RW5kID0gbmV3IEFyUG9pbnQobmV3RW5kLngsIFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKGVuZHBvcnQub3duZXIucmVjdCwgZW5kRGlyKSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciB2YWxpZFBvaW50TG9jYXRpb24gPSBzdGFydFJlY3QucHRJblJlY3QobmV3U3RhcnQpICYmICFzdGFydFJlY3Qub25Db3JuZXIobmV3U3RhcnQpICYmXG4gICAgICAgICAgICAgICAgZW5kUmVjdC5wdEluUmVjdChuZXdFbmQpICYmICFlbmRSZWN0Lm9uQ29ybmVyKG5ld0VuZCk7XG5cbiAgICAgICAgICAgIGlmICh2YWxpZFBvaW50TG9jYXRpb24gJiYgIXRoaXMuX2lzTGluZUNsaXBCb3hlcyh0c3RTdGFydCwgdHN0RW5kKSkge1xuICAgICAgICAgICAgICAgIHZhciBobGlzdCA9IHRoaXMuX2dldEVkZ2VMaXN0KGlzSG9yaXpvbnRhbCksXG4gICAgICAgICAgICAgICAgICAgIHZsaXN0ID0gdGhpcy5fZ2V0RWRnZUxpc3QoIWlzSG9yaXpvbnRhbCksXG4gICAgICAgICAgICAgICAgICAgIGVkZ2UgPSBobGlzdC5nZXRFZGdlQnlQb2ludGVyKHN0YXJ0cG9pbnQpLFxuICAgICAgICAgICAgICAgICAgICBlZGdlMiA9IHZsaXN0LmdldEVkZ2VCeVBvaW50ZXIocG9pbnRzWzFdKSxcbiAgICAgICAgICAgICAgICAgICAgZWRnZTMgPSBobGlzdC5nZXRFZGdlQnlQb2ludGVyKHBvaW50c1syXSk7XG5cbiAgICAgICAgICAgICAgICB2bGlzdC5yZW1vdmUoZWRnZTIpO1xuICAgICAgICAgICAgICAgIGhsaXN0LnJlbW92ZShlZGdlMyk7XG4gICAgICAgICAgICAgICAgaGxpc3QucmVtb3ZlKGVkZ2UpO1xuXG4gICAgICAgICAgICAgICAgLy8gVGhlIHZhbHVlcyBvZiBzdGFydHBvaW50IGlzIGNoYW5nZWQgYnV0IHdlIGRvbid0IGNoYW5nZSB0aGUgc3RhcnRwb2ludCBvZiB0aGUgZWRnZVxuICAgICAgICAgICAgICAgIHN0YXJ0cG9pbnQuYXNzaWduKG5ld1N0YXJ0KTtcbiAgICAgICAgICAgICAgICAvLyB0byBtYWludGFpbiB0aGUgcmVmZXJlbmNlIHRoYXQgdGhlIHBvcnQgaGFzIHRvIHRoZSBzdGFydHBvaW50XG4gICAgICAgICAgICAgICAgZW5kcG9pbnQuYXNzaWduKG5ld0VuZCk7XG4gICAgICAgICAgICAgICAgZWRnZS5zZXRFbmRQb2ludChlbmRwb2ludCk7XG5cbiAgICAgICAgICAgICAgICBlZGdlLnN0YXJ0cG9pbnRQcmV2ID0gbnVsbDtcbiAgICAgICAgICAgICAgICBlZGdlLmVuZHBvaW50TmV4dCA9IG51bGw7XG5cbiAgICAgICAgICAgICAgICBlZGdlLnBvc2l0aW9uWSA9IFV0aWxzLmdldFBvaW50Q29vcmQobmV3U3RhcnQsIFV0aWxzLm5leHRDbG9ja3dpc2VEaXIoc3RhcnREaXIpKTtcbiAgICAgICAgICAgICAgICBobGlzdC5pbnNlcnQoZWRnZSk7XG5cbiAgICAgICAgICAgICAgICBwb2ludHMuc3BsaWNlKDEsIDIpO1xuICAgICAgICAgICAgICAgIG1vZGlmaWVkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBtb2RpZmllZDtcbn07XG5cbi8qKlxuICogUmVtb3ZlIHVubmVjZXNzYXJ5IGN1cnZlcyBpbnNlcnRlZCBpbnRvIHRoZSBwYXRoIGZyb20gdGhlXG4gKiB0cmFjaW5nIHRoZSBlZGdlcyBvZiBvdmVybGFwcGluZyBib3hlcy4gKGh1ZyBjaGlsZHJlbilcbiAqXG4gKiBAcGFyYW0ge0F1dG9Sb3V0ZXJQYXRofSBwYXRoXG4gKi9cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX3NpbXBsaWZ5UGF0aEN1cnZlcyA9IGZ1bmN0aW9uIChwYXRoKSB7XG4gICAgLy8gSW5jaWRlbnRseSwgdGhpcyB3aWxsIGFsc28gY29udGFpbiB0aGUgZnVuY3Rpb25hbGl0eSBvZiBzaW1wbGlmeVRyaXZpYWxseVxuICAgIHZhciBwb2ludExpc3QgPSBwYXRoLmdldFBvaW50TGlzdCgpLFxuICAgICAgICBwMSxcbiAgICAgICAgcDIsXG4gICAgICAgIGkgPSAwLFxuICAgICAgICBqO1xuXG4gICAgLy8gSSB3aWxsIGJlIHRha2luZyB0aGUgZmlyc3QgcG9pbnQgYW5kIGNoZWNraW5nIHRvIHNlZSBpZiBpdCBjYW4gY3JlYXRlIGEgc3RyYWlnaHQgbGluZVxuICAgIC8vIHRoYXQgZG9lcyBub3QgVXRpbHMuaW50ZXJzZWN0ICBhbnkgb3RoZXIgYm94ZXMgb24gdGhlIGdyYXBoIGZyb20gdGhlIHRlc3QgcG9pbnQgdG8gdGhlIG90aGVyIHBvaW50LlxuICAgIC8vIFRoZSAnb3RoZXIgcG9pbnQnIHdpbGwgYmUgdGhlIGVuZCBvZiB0aGUgcGF0aCBpdGVyYXRpbmcgYmFjayB0aWwgdGhlIHR3byBwb2ludHMgYmVmb3JlIHRoZSBcbiAgICAvLyBjdXJyZW50LlxuICAgIHdoaWxlIChpIDwgcG9pbnRMaXN0Lmxlbmd0aCAtIDMpIHtcbiAgICAgICAgcDEgPSBwb2ludExpc3RbaV07XG4gICAgICAgIGogPSBwb2ludExpc3QubGVuZ3RoO1xuXG4gICAgICAgIHdoaWxlIChqLS0gPiAwKSB7XG4gICAgICAgICAgICBwMiA9IHBvaW50TGlzdFtqXTtcbiAgICAgICAgICAgIGlmIChVdGlscy5pc1JpZ2h0QW5nbGUoVXRpbHMuZ2V0RGlyKHAxLm1pbnVzKHAyKSkpICYmICF0aGlzLl9pc0xpbmVDbGlwQm94ZXMocDEsIHAyKSB8fFxuICAgICAgICAgICAgICAgIHAxLmVxdWFscyhwMikpIHtcbiAgICAgICAgICAgICAgICBwb2ludExpc3Quc3BsaWNlKGkgKyAxLCBqIC0gaSAtIDEpOyAvLyBSZW1vdmUgYWxsIHBvaW50cyBiZXR3ZWVuIGksIGpcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICArK2k7XG4gICAgfVxufTtcblxuLyogVGhlIGZvbGxvd2luZyBzaGFwZSBpbiBhIHBhdGhcbiAqIF9fX19fX19cbiAqICAgICAgIHwgICAgICAgX19fXG4gKiAgICAgICB8ICAgICAgfFxuICogICAgICAgfF9fX19fX3xcbiAqXG4gKiB3aWxsIGJlIHJlcGxhY2VkIHdpdGggXG4gKiBfX19fX19fXG4gKiAgICAgICB8X19fX19fXG4gKlxuICogaWYgcG9zc2libGUuXG4gKi9cbi8qKlxuICogUmVwbGFjZSA1IHBvaW50cyBmb3IgMyB3aGVyZSBwb3NzaWJsZS4gVGhpcyB3aWxsIHJlcGxhY2UgJ3UnLWxpa2Ugc2hhcGVzXG4gKiB3aXRoICd6JyBsaWtlIHNoYXBlcy5cbiAqXG4gKiBAcGFyYW0gcGF0aFxuICogQHJldHVybiB7dW5kZWZpbmVkfVxuICovXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9zaW1wbGlmeVBhdGhQb2ludHMgPSBmdW5jdGlvbiAocGF0aCkge1xuICAgIGFzc2VydChwYXRoICE9PSBudWxsLCAnQVJHcmFwaC5zaW1wbGlmeVBhdGhQb2ludHM6IHBhdGggIT09IG51bGwgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KCFwYXRoLmlzQ29ubmVjdGVkKCksICdBUkdyYXBoLnNpbXBsaWZ5UGF0aFBvaW50czogIXBhdGguaXNDb25uZWN0ZWQoKSBGQUlMRUQnKTtcblxuICAgIHZhciBwb2ludExpc3QgPSBwYXRoLmdldFBvaW50TGlzdCgpO1xuICAgIGFzc2VydChwb2ludExpc3QubGVuZ3RoID49IDIsICdBUkdyYXBoLnNpbXBsaWZ5UGF0aFBvaW50czogcG9pbnRMaXN0Lmxlbmd0aCA+PSAyIEZBSUxFRCcpO1xuXG4gICAgaWYgKENPTlNUQU5UUy5ERUJVRykge1xuICAgICAgICBwYXRoLmFzc2VydFZhbGlkUG9pbnRzKCk7XG4gICAgfVxuXG4gICAgdmFyIHAxLFxuICAgICAgICBwMixcbiAgICAgICAgcDMsXG4gICAgICAgIHA0LFxuICAgICAgICBwNSxcblxuICAgICAgICBwMXAgPSBwb2ludExpc3QubGVuZ3RoLFxuICAgICAgICBwMnAgPSBwb2ludExpc3QubGVuZ3RoLFxuICAgICAgICBwM3AgPSBwb2ludExpc3QubGVuZ3RoLFxuICAgICAgICBwNHAgPSBwb2ludExpc3QubGVuZ3RoLFxuICAgICAgICBwNXAgPSBwb2ludExpc3QubGVuZ3RoLFxuXG4gICAgICAgIHBvcyA9IDAsXG5cbiAgICAgICAgbnAzLFxuICAgICAgICBkLFxuICAgICAgICBoO1xuXG4gICAgYXNzZXJ0KHBvcyA8IHBvaW50TGlzdC5sZW5ndGgsICdBUkdyYXBoLnNpbXBsaWZ5UGF0aFBvaW50czogcG9zIDwgcG9pbnRMaXN0Lmxlbmd0aCBGQUlMRUQnKTtcblxuICAgIHAxcCA9IHBvcztcbiAgICBwMSA9IHBvaW50TGlzdFtwb3MrK107XG5cbiAgICB3aGlsZSAocG9zIDwgcG9pbnRMaXN0Lmxlbmd0aCkge1xuICAgICAgICBwNXAgPSBwNHA7XG4gICAgICAgIHA0cCA9IHAzcDtcbiAgICAgICAgcDNwID0gcDJwO1xuICAgICAgICBwMnAgPSBwMXA7XG4gICAgICAgIHAxcCA9IHBvcztcblxuICAgICAgICBwNSA9IHA0O1xuICAgICAgICBwNCA9IHAzO1xuICAgICAgICBwMyA9IHAyO1xuICAgICAgICBwMiA9IHAxO1xuICAgICAgICBwMSA9IHBvaW50TGlzdFtwb3MrK107XG5cbiAgICAgICAgaWYgKHA1cCA8IHBvaW50TGlzdC5sZW5ndGgpIHtcbiAgICAgICAgICAgIGFzc2VydChwMXAgPCBwb2ludExpc3QubGVuZ3RoICYmIHAycCA8IHBvaW50TGlzdC5sZW5ndGggJiYgcDNwIDwgcG9pbnRMaXN0Lmxlbmd0aCAmJlxuICAgICAgICAgICAgICAgIHA0cCA8IHBvaW50TGlzdC5sZW5ndGggJiYgcDVwIDwgcG9pbnRMaXN0Lmxlbmd0aCxcbiAgICAgICAgICAgICAgICAnQVJHcmFwaC5zaW1wbGlmeVBhdGhQb2ludHM6IHAxcCA8IHBvaW50TGlzdC5sZW5ndGggJiYgcDJwIDwgcG9pbnRMaXN0Lmxlbmd0aCAmJiAnICtcbiAgICAgICAgICAgICAgICAncDNwIDwgcG9pbnRMaXN0Lmxlbmd0aCAmJiBwNHAgPCBwb2ludExpc3QubGVuZ3RoICYmIHA1cCA8IHBvaW50TGlzdC5sZW5ndGggRkFJTEVEJyk7XG5cbiAgICAgICAgICAgIGFzc2VydCghcDEuZXF1YWxzKHAyKSAmJiAhcDIuZXF1YWxzKHAzKSAmJiAhcDMuZXF1YWxzKHA0KSAmJiAhcDQuZXF1YWxzKHA1KSxcbiAgICAgICAgICAgICAgICAnQVJHcmFwaC5zaW1wbGlmeVBhdGhQb2ludHM6ICFwMS5lcXVhbHMocDIpICYmICFwMi5lcXVhbHMocDMpICYmICFwMy5lcXVhbHMocDQpICYmICcgK1xuICAgICAgICAgICAgICAgICchcDQuZXF1YWxzKHA1KSBGQUlMRUQnKTtcblxuICAgICAgICAgICAgZCA9IFV0aWxzLmdldERpcihwMi5taW51cyhwMSkpO1xuICAgICAgICAgICAgYXNzZXJ0KFV0aWxzLmlzUmlnaHRBbmdsZShkKSwgJ0FSR3JhcGguc2ltcGxpZnlQYXRoUG9pbnRzOiBVdGlscy5pc1JpZ2h0QW5nbGUgKGQpIEZBSUxFRCcpO1xuICAgICAgICAgICAgaCA9IFV0aWxzLmlzSG9yaXpvbnRhbChkKTtcblxuICAgICAgICAgICAgbnAzID0gbmV3IEFyUG9pbnQoKTtcbiAgICAgICAgICAgIGlmIChoKSB7XG4gICAgICAgICAgICAgICAgbnAzLnggPSBVdGlscy5nZXRQb2ludENvb3JkKHA1LCBoKTtcbiAgICAgICAgICAgICAgICBucDMueSA9IFV0aWxzLmdldFBvaW50Q29vcmQocDEsICFoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbnAzLnggPSBVdGlscy5nZXRQb2ludENvb3JkKHAxLCAhaCk7XG4gICAgICAgICAgICAgICAgbnAzLnkgPSBVdGlscy5nZXRQb2ludENvb3JkKHA1LCBoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCF0aGlzLl9pc0xpbmVDbGlwQm94ZXMocDIsIG5wMykgJiYgIXRoaXMuX2lzTGluZUNsaXBCb3hlcyhucDMsIHA0KSkge1xuICAgICAgICAgICAgICAgIHBvaW50TGlzdC5zcGxpY2UocDJwLCAxKTtcbiAgICAgICAgICAgICAgICBwb2ludExpc3Quc3BsaWNlKHAzcCwgMSk7XG4gICAgICAgICAgICAgICAgcG9pbnRMaXN0LnNwbGljZShwNHAsIDEpO1xuXG4gICAgICAgICAgICAgICAgaWYgKCFucDMuZXF1YWxzKHAxKSAmJiAhbnAzLmVxdWFscyhwNSkpIHtcbiAgICAgICAgICAgICAgICAgICAgcG9pbnRMaXN0LnNwbGljZShwNHAsIDAsIG5wMyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcDFwID0gcG9pbnRMaXN0Lmxlbmd0aDtcbiAgICAgICAgICAgICAgICBwMnAgPSBwb2ludExpc3QubGVuZ3RoO1xuICAgICAgICAgICAgICAgIHAzcCA9IHBvaW50TGlzdC5sZW5ndGg7XG4gICAgICAgICAgICAgICAgcDRwID0gcG9pbnRMaXN0Lmxlbmd0aDtcblxuICAgICAgICAgICAgICAgIHBvcyA9IDA7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoQ09OU1RBTlRTLkRFQlVHKSB7XG4gICAgICAgIHBhdGguYXNzZXJ0VmFsaWRQb2ludHMoKTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9jb25uZWN0QWxsRGlzY29ubmVjdGVkUGF0aHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGksXG4gICAgICAgIGxlbiA9IHRoaXMucGF0aHMubGVuZ3RoLFxuICAgICAgICBzdWNjZXNzID0gZmFsc2UsXG4gICAgICAgIGdpdmV1cCA9IGZhbHNlLFxuICAgICAgICBwYXRoO1xuXG4gICAgd2hpbGUgKCFzdWNjZXNzICYmICFnaXZldXApIHtcbiAgICAgICAgc3VjY2VzcyA9IHRydWU7XG4gICAgICAgIGkgPSBsZW47XG4gICAgICAgIHdoaWxlIChpLS0gJiYgc3VjY2Vzcykge1xuICAgICAgICAgICAgcGF0aCA9IHRoaXMucGF0aHNbaV07XG5cbiAgICAgICAgICAgIGlmICghcGF0aC5pc0Nvbm5lY3RlZCgpKSB7XG4gICAgICAgICAgICAgICAgc3VjY2VzcyA9IHRoaXMuX2Nvbm5lY3QocGF0aCk7XG5cbiAgICAgICAgICAgICAgICBpZiAoIXN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gU29tZXRoaW5nIGlzIG1lc3NlZCB1cCwgcHJvYmFibHkgYW4gZXhpc3RpbmcgZWRnZSBjdXN0b21pemF0aW9uIHJlc3VsdHMgaW4gYSB6ZXJvIGxlbmd0aCBlZGdlXG4gICAgICAgICAgICAgICAgICAgIC8vIEluIHRoYXQgY2FzZSB3ZSB0cnkgdG8gZGVsZXRlIGFueSBjdXN0b21pemF0aW9uIGZvciB0aGlzIHBhdGggdG8gcmVjb3ZlciBmcm9tIHRoZSBwcm9ibGVtXG4gICAgICAgICAgICAgICAgICAgIGlmIChwYXRoLmFyZVRoZXJlUGF0aEN1c3RvbWl6YXRpb25zKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhdGgucmVtb3ZlUGF0aEN1c3RvbWl6YXRpb25zKCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBnaXZldXAgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICghc3VjY2VzcyAmJiAhZ2l2ZXVwKSB7XG4gICAgICAgICAgICB0aGlzLl9kaXNjb25uZWN0QWxsKCk7XHQvLyBUaGVyZSB3YXMgYW4gZXJyb3IsIGRlbGV0ZSBoYWxmd2F5IHJlc3VsdHMgdG8gYmUgYWJsZSB0byBzdGFydCBhIG5ldyBwYXNzXG4gICAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5jb21wbGV0ZWx5Q29ubmVjdGVkID0gdHJ1ZTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX3VwZGF0ZUJveFBvcnRBdmFpbGFiaWxpdHkgPSBmdW5jdGlvbiAoaW5wdXRCb3gpIHtcbiAgICB2YXIgYnVmZmVyYm94LFxuICAgICAgICBzaWJsaW5ncyxcbiAgICAgICAgc2tpcEJveGVzID0ge30sXG4gICAgICAgIGJveCxcbiAgICAgICAgaWQ7XG5cbiAgICBidWZmZXJib3ggPSB0aGlzLmJveDJidWZmZXJCb3hbaW5wdXRCb3guaWRdO1xuICAgIGFzc2VydChidWZmZXJib3gsICdCdWZmZXJib3ggbm90IGZvdW5kIGZvciAnICsgaW5wdXRCb3guaWQpO1xuICAgIHNpYmxpbmdzID0gYnVmZmVyYm94LmNoaWxkcmVuO1xuICAgIC8vIElnbm9yZSBvdmVybGFwIGZyb20gYW5jZXN0b3IgYm94ZXMgaW4gdGhlIGJveCB0cmVlc1xuICAgIGJveCA9IGlucHV0Qm94O1xuICAgIGRvIHtcbiAgICAgICAgc2tpcEJveGVzW2JveC5pZF0gPSB0cnVlO1xuICAgICAgICBib3ggPSBib3gucGFyZW50O1xuICAgIH0gd2hpbGUgKGJveCk7XG5cbiAgICBmb3IgKHZhciBpID0gc2libGluZ3MubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIGlkID0gc2libGluZ3NbaV0uaWQ7XG4gICAgICAgIGlmIChza2lwQm94ZXNbaWRdKSB7ICAvLyBTa2lwIGJveGVzIG9uIHRoZSBib3ggdHJlZVxuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaW5wdXRCb3gucmVjdC50b3VjaGluZyhzaWJsaW5nc1tpXSkpIHtcbiAgICAgICAgICAgIGlucHV0Qm94LmFkanVzdFBvcnRBdmFpbGFiaWxpdHkodGhpcy5ib3hlc1tzaWJsaW5nc1tpXS5pZF0pO1xuICAgICAgICAgICAgdGhpcy5ib3hlc1tzaWJsaW5nc1tpXS5pZF0uYWRqdXN0UG9ydEF2YWlsYWJpbGl0eShpbnB1dEJveCk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9hZGRUb0J1ZmZlckJveGVzID0gZnVuY3Rpb24gKGlucHV0Qm94KSB7XG4gICAgdmFyIGJveCA9IHtyZWN0OiBuZXcgQXJSZWN0KGlucHV0Qm94LnJlY3QpLCBpZDogaW5wdXRCb3guaWR9LFxuICAgICAgICBvdmVybGFwQm94ZXNJbmRpY2VzID0gW10sXG4gICAgICAgIGJ1ZmZlckJveCxcbiAgICAgICAgY2hpbGRyZW4gPSBbXSxcbiAgICAgICAgcGFyZW50Qm94LFxuICAgICAgICBpZHMgPSBbaW5wdXRCb3guaWRdLFxuICAgICAgICBjaGlsZCxcbiAgICAgICAgaSxcbiAgICAgICAgajtcblxuICAgIGJveC5yZWN0LmluZmxhdGVSZWN0KENPTlNUQU5UUy5CVUZGRVIpO1xuICAgIGFzc2VydCghdGhpcy5ib3gyYnVmZmVyQm94W2lucHV0Qm94LmlkXSxcbiAgICAgICAgJ0NhblxcJ3QgYWRkIGJveCB0byAyIGJ1ZmZlcmJveGVzJyk7XG5cbiAgICAvLyBGb3IgZXZlcnkgYnVmZmVyIGJveCB0b3VjaGluZyB0aGUgaW5wdXQgYm94XG4gICAgLy8gUmVjb3JkIHRoZSBidWZmZXIgYm94ZXMgd2l0aCBjaGlsZHJlbiB0b3VjaGluZyBcbiAgICAvLyB0aGUgaW5wdXQgYm94XG4gICAgZm9yIChpID0gdGhpcy5idWZmZXJCb3hlcy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgaWYgKCFib3gucmVjdC50b3VjaGluZyh0aGlzLmJ1ZmZlckJveGVzW2ldLmJveCkpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaiA9IHRoaXMuYnVmZmVyQm94ZXNbaV0uY2hpbGRyZW4ubGVuZ3RoO1xuICAgICAgICB3aGlsZSAoai0tKSB7XG4gICAgICAgICAgICBjaGlsZCA9IHRoaXMuYnVmZmVyQm94ZXNbaV0uY2hpbGRyZW5bal07XG4gICAgICAgICAgICBpZiAoYm94LnJlY3QudG91Y2hpbmcoY2hpbGQpKSB7XG4gICAgICAgICAgICAgICAgaW5wdXRCb3guYWRqdXN0UG9ydEF2YWlsYWJpbGl0eSh0aGlzLmJveGVzW2NoaWxkLmlkXSk7XG4gICAgICAgICAgICAgICAgdGhpcy5ib3hlc1tjaGlsZC5pZF0uYWRqdXN0UG9ydEF2YWlsYWJpbGl0eShpbnB1dEJveCk7XG5cbiAgICAgICAgICAgICAgICBpZiAob3ZlcmxhcEJveGVzSW5kaWNlcy5pbmRleE9mKGkpID09PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICBvdmVybGFwQm94ZXNJbmRpY2VzLnB1c2goaSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwYXJlbnRCb3ggPSBuZXcgQXJSZWN0KGJveC5yZWN0KTtcbiAgICAvLyBJZiBvdmVybGFwcGVkIG90aGVyIGJveGVzLCBjcmVhdGUgdGhlIG5ldyBidWZmZXJib3ggcGFyZW50IHJlY3RcbiAgICBpZiAob3ZlcmxhcEJveGVzSW5kaWNlcy5sZW5ndGggIT09IDApIHtcblxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgb3ZlcmxhcEJveGVzSW5kaWNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXNzZXJ0KG92ZXJsYXBCb3hlc0luZGljZXNbaV0gPCB0aGlzLmJ1ZmZlckJveGVzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAnQXJHcmFwaC5hZGRUb0J1ZmZlckJveGVzOiBvdmVybGFwQm94ZXMgaW5kZXggb3V0IG9mIGJvdW5kcy4gKCcgK1xuICAgICAgICAgICAgICAgIG92ZXJsYXBCb3hlc0luZGljZXNbaV0gKyAnIDwgJyArIHRoaXMuYnVmZmVyQm94ZXMubGVuZ3RoICsgJyknKTtcblxuICAgICAgICAgICAgYnVmZmVyQm94ID0gdGhpcy5idWZmZXJCb3hlcy5zcGxpY2Uob3ZlcmxhcEJveGVzSW5kaWNlc1tpXSwgMSlbMF07XG5cbiAgICAgICAgICAgIGZvciAoaiA9IGJ1ZmZlckJveC5jaGlsZHJlbi5sZW5ndGg7IGotLTspIHtcbiAgICAgICAgICAgICAgICBjaGlsZHJlbi5wdXNoKGJ1ZmZlckJveC5jaGlsZHJlbltqXSk7XG4gICAgICAgICAgICAgICAgaWRzLnB1c2goYnVmZmVyQm94LmNoaWxkcmVuW2pdLmlkKTsgIC8vIFN0b3JlIHRoZSBpZHMgb2YgdGhlIGNoaWxkcmVuIHRoYXQgbmVlZCB0byBiZSBhZGp1c3RlZFxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBwYXJlbnRCb3gudW5pb25Bc3NpZ24oYnVmZmVyQm94LmJveCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBib3gucmVjdC5pZCA9IGlucHV0Qm94LmlkO1xuICAgIGNoaWxkcmVuLnB1c2goYm94LnJlY3QpO1xuXG4gICAgdGhpcy5idWZmZXJCb3hlcy5wdXNoKHtib3g6IHBhcmVudEJveCwgY2hpbGRyZW46IGNoaWxkcmVufSk7XG5cbiAgICBmb3IgKGkgPSBpZHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHRoaXMuYm94MmJ1ZmZlckJveFtpZHNbaV1dID0gdGhpcy5idWZmZXJCb3hlc1t0aGlzLmJ1ZmZlckJveGVzLmxlbmd0aCAtIDFdO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX3JlbW92ZUZyb21CdWZmZXJCb3hlcyA9IGZ1bmN0aW9uIChib3gpIHtcbiAgICAvLyBHZXQgdGhlIGNoaWxkcmVuIG9mIHRoZSBwYXJlbnRCb3ggKG5vdCBpbmNsdWRpbmcgdGhlIGJveCB0byByZW1vdmUpXG4gICAgLy8gQ3JlYXRlIGJ1ZmZlcmJveGVzIGZyb20gdGhlc2UgY2hpbGRyZW5cbiAgICB2YXIgYnVmZmVyQm94ID0gdGhpcy5ib3gyYnVmZmVyQm94W2JveC5pZF0sXG4gICAgICAgIGkgPSB0aGlzLmJ1ZmZlckJveGVzLmluZGV4T2YoYnVmZmVyQm94KSxcbiAgICAgICAgY2hpbGRyZW4gPSBidWZmZXJCb3guY2hpbGRyZW4sXG4gICAgICAgIGdyb3VwcyA9IFtdLFxuICAgICAgICBhZGQgPSBmYWxzZSxcbiAgICAgICAgcGFyZW50Qm94LFxuICAgICAgICBjaGlsZCxcbiAgICAgICAgZ3JvdXAsXG4gICAgICAgIGlkcyxcbiAgICAgICAgaWQsXG4gICAgICAgIGosXG4gICAgICAgIGc7XG5cbiAgICBhc3NlcnQoaSAhPT0gLTEsICdBUkdyYXBoLnJlbW92ZUZyb21CdWZmZXJCb3hlczogQ2FuXFwndCBmaW5kIHRoZSBjb3JyZWN0IGJ1ZmZlcmJveC4nKTtcblxuICAgIC8vIFJlbW92ZSByZWNvcmQgb2YgcmVtb3ZlZCBib3hcbiAgICB0aGlzLmJ1ZmZlckJveGVzLnNwbGljZShpLCAxKTtcbiAgICB0aGlzLmJveDJidWZmZXJCb3hbYm94LmlkXSA9IHVuZGVmaW5lZDtcblxuICAgIC8vQ3JlYXRlIGdyb3VwcyBvZiBvdmVybGFwIGZyb20gY2hpbGRyZW5cbiAgICBpID0gY2hpbGRyZW4ubGVuZ3RoO1xuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgZyA9IGdyb3Vwcy5sZW5ndGg7XG4gICAgICAgIGNoaWxkID0gY2hpbGRyZW5baV07XG4gICAgICAgIGdyb3VwID0gW2NoaWxkXTtcbiAgICAgICAgYWRkID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5ib3hlc1tjaGlsZC5pZF0ucmVzZXRQb3J0QXZhaWxhYmlsaXR5KCk7ICAvLyBSZXNldCBib3gncyBwb3J0cyBhdmFpbGFibGVBcmVhc1xuXG4gICAgICAgIGlmIChjaGlsZC5pZCA9PT0gYm94LmlkKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHdoaWxlIChnLS0pIHtcbiAgICAgICAgICAgIGogPSBncm91cHNbZ10ubGVuZ3RoO1xuXG4gICAgICAgICAgICB3aGlsZSAoai0tKSB7XG4gICAgICAgICAgICAgICAgaWYgKGdyb3Vwc1tnXVtqXS50b3VjaGluZyhjaGlsZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgaWQgPSBncm91cHNbZ11bal0uaWQ7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYm94ZXNbY2hpbGQuaWRdLmFkanVzdFBvcnRBdmFpbGFiaWxpdHkodGhpcy5ib3hlc1tpZF0pO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmJveGVzW2lkXS5hZGp1c3RQb3J0QXZhaWxhYmlsaXR5KHRoaXMuYm94ZXNbY2hpbGQuaWRdKTtcbiAgICAgICAgICAgICAgICAgICAgYWRkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChhZGQpIHtcbiAgICAgICAgICAgICAgICAvLyBncm91cCB3aWxsIGFjY3VtdWxhdGUgYWxsIHRoaW5ncyBvdmVybGFwcGluZyB0aGUgY2hpbGRcbiAgICAgICAgICAgICAgICBncm91cCA9IGdyb3VwLmNvbmNhdChncm91cHMuc3BsaWNlKGcsIDEpWzBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGdyb3Vwcy5wdXNoKGdyb3VwKTsgIC8vIEFkZCBncm91cCB0byBncm91cHNcbiAgICB9XG5cbiAgICBpID0gZ3JvdXBzLmxlbmd0aDtcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgIGogPSBncm91cHNbaV0ubGVuZ3RoO1xuICAgICAgICBwYXJlbnRCb3ggPSBuZXcgQXJSZWN0KGdyb3Vwc1tpXVswXSk7XG4gICAgICAgIGlkcyA9IFtdO1xuXG4gICAgICAgIHdoaWxlIChqLS0pIHtcbiAgICAgICAgICAgIHBhcmVudEJveC51bmlvbkFzc2lnbihncm91cHNbaV1bal0pO1xuICAgICAgICAgICAgaWRzLnB1c2goZ3JvdXBzW2ldW2pdLmlkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuYnVmZmVyQm94ZXMucHVzaCh7Ym94OiBwYXJlbnRCb3gsIGNoaWxkcmVuOiBncm91cHNbaV19KTtcblxuICAgICAgICBqID0gaWRzLmxlbmd0aDtcbiAgICAgICAgd2hpbGUgKGotLSkge1xuICAgICAgICAgICAgdGhpcy5ib3gyYnVmZmVyQm94W2lkc1tqXV0gPSB0aGlzLmJ1ZmZlckJveGVzW3RoaXMuYnVmZmVyQm94ZXMubGVuZ3RoIC0gMV07XG4gICAgICAgIH1cbiAgICB9XG5cbn07XG5cbi8vUHVibGljIEZ1bmN0aW9uc1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLnNldEJ1ZmZlciA9IGZ1bmN0aW9uIChuZXdCdWZmZXIpIHtcbiAgICBDT05TVEFOVFMuQlVGRkVSID0gbmV3QnVmZmVyO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5jYWxjdWxhdGVTZWxmUG9pbnRzID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuc2VsZlBvaW50cyA9IFtdO1xuICAgIHRoaXMuc2VsZlBvaW50cy5wdXNoKG5ldyBBclBvaW50KENPTlNUQU5UUy5FRF9NSU5DT09SRCwgQ09OU1RBTlRTLkVEX01JTkNPT1JEKSk7XG4gICAgdGhpcy5zZWxmUG9pbnRzLnB1c2gobmV3IEFyUG9pbnQoQ09OU1RBTlRTLkVEX01BWENPT1JELCBDT05TVEFOVFMuRURfTUlOQ09PUkQpKTtcbiAgICB0aGlzLnNlbGZQb2ludHMucHVzaChuZXcgQXJQb2ludChDT05TVEFOVFMuRURfTUFYQ09PUkQsIENPTlNUQU5UUy5FRF9NQVhDT09SRCkpO1xuICAgIHRoaXMuc2VsZlBvaW50cy5wdXNoKG5ldyBBclBvaW50KENPTlNUQU5UUy5FRF9NSU5DT09SRCwgQ09OU1RBTlRTLkVEX01BWENPT1JEKSk7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLmNyZWF0ZUJveCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgYm94ID0gbmV3IEF1dG9Sb3V0ZXJCb3goKTtcbiAgICBhc3NlcnQoYm94ICE9PSBudWxsLCAnQVJHcmFwaC5jcmVhdGVCb3g6IGJveCAhPT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIHJldHVybiBib3g7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLmFkZEJveCA9IGZ1bmN0aW9uIChib3gpIHtcbiAgICBhc3NlcnQoYm94ICE9PSBudWxsLFxuICAgICAgICAnQVJHcmFwaC5hZGRCb3g6IGJveCAhPT0gbnVsbCBGQUlMRUQnKTtcbiAgICBhc3NlcnQoYm94IGluc3RhbmNlb2YgQXV0b1JvdXRlckJveCxcbiAgICAgICAgJ0FSR3JhcGguYWRkQm94OiBib3ggaW5zdGFuY2VvZiBBdXRvUm91dGVyQm94IEZBSUxFRCcpO1xuXG4gICAgdmFyIHJlY3QgPSBib3gucmVjdDtcblxuICAgIHRoaXMuX2Rpc2Nvbm5lY3RQYXRoc0NsaXBwaW5nKHJlY3QpO1xuXG4gICAgYm94Lm93bmVyID0gdGhpcztcbiAgICB2YXIgYm94SWQgPSAoQ09VTlRFUisrKS50b1N0cmluZygpO1xuICAgIHdoaWxlIChib3hJZC5sZW5ndGggPCA2KSB7XG4gICAgICAgIGJveElkID0gJzAnICsgYm94SWQ7XG4gICAgfVxuICAgIGJveElkID0gJ0JPWF8nICsgYm94SWQ7XG4gICAgYm94LmlkID0gYm94SWQ7XG5cbiAgICB0aGlzLmJveGVzW2JveElkXSA9IGJveDtcblxuICAgIHRoaXMuX2FkZEJveEFuZFBvcnRFZGdlcyhib3gpO1xuXG4gICAgLy8gYWRkIGNoaWxkcmVuIG9mIHRoZSBib3hcbiAgICB2YXIgY2hpbGRyZW4gPSBib3guY2hpbGRCb3hlcyxcbiAgICAgICAgaSA9IGNoaWxkcmVuLmxlbmd0aDtcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgIHRoaXMuYWRkQm94KGNoaWxkcmVuW2ldKTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLmRlbGV0ZUJveCA9IGZ1bmN0aW9uIChib3gpIHtcbiAgICBhc3NlcnQoYm94ICE9PSBudWxsLCAnQVJHcmFwaC5kZWxldGVCb3g6IGJveCAhPT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIGlmIChib3guaGFzT3duZXIoKSkge1xuICAgICAgICB2YXIgcGFyZW50ID0gYm94LnBhcmVudCxcbiAgICAgICAgICAgIGNoaWxkcmVuID0gYm94LmNoaWxkQm94ZXMsXG4gICAgICAgICAgICBpID0gY2hpbGRyZW4ubGVuZ3RoO1xuXG4gICAgICAgIC8vIG5vdGlmeSB0aGUgcGFyZW50IG9mIHRoZSBkZWxldGlvblxuICAgICAgICBpZiAocGFyZW50KSB7XG4gICAgICAgICAgICBwYXJlbnQucmVtb3ZlQ2hpbGQoYm94KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHJlbW92ZSBjaGlsZHJlblxuICAgICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgICAgICB0aGlzLmRlbGV0ZUJveChjaGlsZHJlbltpXSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9kZWxldGVCb3hBbmRQb3J0RWRnZXMoYm94KTtcbiAgICAgICAgYm94Lm93bmVyID0gbnVsbDtcbiAgICAgICAgYXNzZXJ0KHRoaXMuYm94ZXNbYm94LmlkXSAhPT0gdW5kZWZpbmVkLCAnQVJHcmFwaC5yZW1vdmU6IEJveCBkb2VzIG5vdCBleGlzdCcpO1xuXG4gICAgICAgIGRlbGV0ZSB0aGlzLmJveGVzW2JveC5pZF07XG4gICAgfVxuXG4gICAgYm94LmRlc3Ryb3koKTtcbiAgICBib3ggPSBudWxsO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5zaGlmdEJveEJ5ID0gZnVuY3Rpb24gKGJveCwgb2Zmc2V0KSB7XG4gICAgYXNzZXJ0KGJveCAhPT0gbnVsbCwgJ0FSR3JhcGguc2hpZnRCb3hCeTogYm94ICE9PSBudWxsIEZBSUxFRCcpO1xuICAgIGFzc2VydCghIXRoaXMuYm94ZXNbYm94LmlkXSwgJ0FSR3JhcGguc2hpZnRCb3hCeTogQm94IGRvZXMgbm90IGV4aXN0IScpO1xuXG4gICAgdmFyIHJlY3QgPSB0aGlzLmJveDJidWZmZXJCb3hbYm94LmlkXS5ib3gsXG4gICAgICAgIGNoaWxkcmVuID0gYm94LmNoaWxkQm94ZXM7XG5cbiAgICB0aGlzLl9kaXNjb25uZWN0UGF0aHNDbGlwcGluZyhyZWN0KTsgLy8gcmVkcmF3IGFsbCBwYXRocyBjbGlwcGluZyBwYXJlbnQgYm94LlxuICAgIHRoaXMuX2Rpc2Nvbm5lY3RQYXRoc0Zyb20oYm94KTtcblxuICAgIHRoaXMuX2RlbGV0ZUJveEFuZFBvcnRFZGdlcyhib3gpO1xuXG4gICAgYm94LnNoaWZ0Qnkob2Zmc2V0KTtcbiAgICB0aGlzLl9hZGRCb3hBbmRQb3J0RWRnZXMoYm94KTtcblxuICAgIHJlY3QgPSBib3gucmVjdDtcbiAgICB0aGlzLl9kaXNjb25uZWN0UGF0aHNDbGlwcGluZyhyZWN0KTtcblxuICAgIGZvciAodmFyIGkgPSBjaGlsZHJlbi5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgdGhpcy5zaGlmdEJveEJ5KGNoaWxkcmVuW2ldLCBvZmZzZXQpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuc2V0Qm94UmVjdCA9IGZ1bmN0aW9uIChib3gsIHJlY3QpIHtcbiAgICBpZiAoYm94ID09PSBudWxsKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLl9kZWxldGVCb3hBbmRQb3J0RWRnZXMoYm94KTtcbiAgICBib3guc2V0UmVjdChyZWN0KTtcbiAgICB0aGlzLl9hZGRCb3hBbmRQb3J0RWRnZXMoYm94KTtcblxuICAgIHRoaXMuX2Rpc2Nvbm5lY3RQYXRoc0NsaXBwaW5nKHJlY3QpO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5yb3V0ZVN5bmMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHN0YXRlID0ge2ZpbmlzaGVkOiBmYWxzZX07XG5cbiAgICB0aGlzLl9jb25uZWN0QWxsRGlzY29ubmVjdGVkUGF0aHMoKTtcblxuICAgIHdoaWxlICghc3RhdGUuZmluaXNoZWQpIHtcbiAgICAgICAgc3RhdGUgPSB0aGlzLl9vcHRpbWl6ZShzdGF0ZSk7XG4gICAgfVxuXG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLnJvdXRlQXN5bmMgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgIHZhciBzZWxmID0gdGhpcyxcbiAgICAgICAgdXBkYXRlRm4gPSBvcHRpb25zLnVwZGF0ZSB8fCBVdGlscy5ub3AsXG4gICAgICAgIGZpcnN0Rm4gPSBvcHRpb25zLmZpcnN0IHx8IFV0aWxzLm5vcCxcbiAgICAgICAgY2FsbGJhY2tGbiA9IG9wdGlvbnMuY2FsbGJhY2sgfHwgVXRpbHMubm9wLFxuICAgICAgICB0aW1lID0gb3B0aW9ucy50aW1lIHx8IDUsXG4gICAgICAgIG9wdGltaXplRm4gPSBmdW5jdGlvbiAoc3RhdGUpIHtcbiAgICAgICAgICAgIF9sb2dnZXIuaW5mbygnQXN5bmMgb3B0aW1pemF0aW9uIGN5Y2xlIHN0YXJ0ZWQnKTtcblxuICAgICAgICAgICAgLy8gSWYgYSBwYXRoIGhhcyBiZWVuIGRpc2Nvbm5lY3RlZCwgc3RhcnQgdGhlIHJvdXRpbmcgb3ZlclxuICAgICAgICAgICAgaWYgKCFzZWxmLmNvbXBsZXRlbHlDb25uZWN0ZWQpIHtcbiAgICAgICAgICAgICAgICBfbG9nZ2VyLmluZm8oJ0FzeW5jIG9wdGltaXphdGlvbiBpbnRlcnJ1cHRlZCcpO1xuICAgICAgICAgICAgICAgIHJldHVybiBzZXRUaW1lb3V0KHN0YXJ0Um91dGluZywgdGltZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHVwZGF0ZUZuKHNlbGYucGF0aHMpO1xuICAgICAgICAgICAgaWYgKHN0YXRlLmZpbmlzaGVkKSB7XG4gICAgICAgICAgICAgICAgX2xvZ2dlci5pbmZvKCdBc3luYyByb3V0aW5nIGZpbmlzaGVkJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrRm4oc2VsZi5wYXRocyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHN0YXRlID0gc2VsZi5fb3B0aW1pemUoc3RhdGUpO1xuICAgICAgICAgICAgICAgIHJldHVybiBzZXRUaW1lb3V0KG9wdGltaXplRm4sIHRpbWUsIHN0YXRlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgc3RhcnRSb3V0aW5nID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgX2xvZ2dlci5pbmZvKCdBc3luYyByb3V0aW5nIHN0YXJ0ZWQnKTtcbiAgICAgICAgICAgIHZhciBzdGF0ZSA9IHtmaW5pc2hlZDogZmFsc2V9O1xuICAgICAgICAgICAgc2VsZi5fY29ubmVjdEFsbERpc2Nvbm5lY3RlZFBhdGhzKCk7XG5cbiAgICAgICAgICAgIC8vIFN0YXJ0IHRoZSBvcHRpbWl6YXRpb25cbiAgICAgICAgICAgIHNldFRpbWVvdXQob3B0aW1pemVGbiwgdGltZSwgc3RhdGUpO1xuICAgICAgICB9O1xuXG4gICAgX2xvZ2dlci5pbmZvKCdBc3luYyByb3V0aW5nIHRyaWdnZXJlZCcpO1xuICAgIC8vIENvbm5lY3QgYWxsIGRpc2Nvbm5lY3RlZCBwYXRocyB3aXRoIGEgc3RyYWlnaHQgbGluZVxuICAgIHZhciBkaXNjb25uZWN0ZWQgPSB0aGlzLl9xdWlja0Nvbm5lY3REaXNjb25uZWN0ZWRQYXRocygpO1xuICAgIGZpcnN0Rm4oZGlzY29ubmVjdGVkKTtcblxuICAgIHRoaXMuX2Rpc2Nvbm5lY3RUZW1wUGF0aHMoZGlzY29ubmVjdGVkKTtcblxuICAgIHNldFRpbWVvdXQoc3RhcnRSb3V0aW5nLCB0aW1lKTtcbn07XG5cbi8qKlxuICogQ29ubmVjdCBhbGwgZGlzY29ubmVjdGVkIHBhdGhzIGluIGEgcXVpY2sgd2F5IHdoaWxlIGEgYmV0dGVyIGxheW91dCBpc1xuICogYmVpbmcgY2FsY3VsYXRlZC5cbiAqXG4gKiBAcmV0dXJuIHtBcnJheTxQYXRoPn0gZGlzY29ubmVjdGVkIHBhdGhzXG4gKi9cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX3F1aWNrQ29ubmVjdERpc2Nvbm5lY3RlZFBhdGhzID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBwYXRoLFxuICAgICAgICBkaXNjb25uZWN0ZWQgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gdGhpcy5wYXRocy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgcGF0aCA9IHRoaXMucGF0aHNbaV07XG4gICAgICAgIGlmICghcGF0aC5pc0Nvbm5lY3RlZCgpKSB7XG4gICAgICAgICAgICBwYXRoLmNhbGN1bGF0ZVN0YXJ0RW5kUG9ydHMoKTtcbiAgICAgICAgICAgIHBhdGgucG9pbnRzID0gbmV3IEFyUG9pbnRMaXN0UGF0aChwYXRoLnN0YXJ0cG9pbnQsIHBhdGguZW5kcG9pbnQpO1xuICAgICAgICAgICAgZGlzY29ubmVjdGVkLnB1c2gocGF0aCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGRpc2Nvbm5lY3RlZDtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2Rpc2Nvbm5lY3RUZW1wUGF0aHMgPSBmdW5jdGlvbiAocGF0aHMpIHtcbiAgICBmb3IgKHZhciBpID0gcGF0aHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHBhdGhzW2ldLnBvaW50cyA9IG5ldyBBclBvaW50TGlzdFBhdGgoKTtcbiAgICB9XG59O1xuXG4vKipcbiAqIFBlcmZvcm1zIG9uZSBzZXQgb2Ygb3B0aW1pemF0aW9ucy5cbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gY291bnQgVGhpcyBzdG9yZXMgdGhlIG1heCBudW1iZXIgb2Ygb3B0aW1pemF0aW9ucyBhbGxvd2VkXG4gKiBAcGFyYW0ge051bWJlcn0gbGFzdCBUaGlzIHN0b3JlcyB0aGUgbGFzdCBvcHRpbWl6YXRpb24gdHlwZSBtYWRlXG4gKlxuICogQHJldHVybiB7T2JqZWN0fSBDdXJyZW50IGNvdW50LCBsYXN0IHZhbHVlc1xuICovXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9vcHRpbWl6ZSA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgdmFyIG1heE9wZXJhdGlvbnMgPSBvcHRpb25zLm1heE9wZXJhdGlvbnMgfHwgMTAwLFxuICAgICAgICBsYXN0ID0gb3B0aW9ucy5sYXN0IHx8IDAsXG4gICAgICAgIGRtID0gb3B0aW9ucy5kbSB8fCAxMCxcdFx0Ly8gbWF4ICMgb2YgZGlzdHJpYnV0aW9uIG9wXG4gICAgICAgIGQgPSBvcHRpb25zLmQgfHwgMCxcbiAgICAgICAgZ2V0U3RhdGUgPSBmdW5jdGlvbiAoZmluaXNoZWQpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgZmluaXNoZWQ6IGZpbmlzaGVkIHx8ICFtYXhPcGVyYXRpb25zLFxuICAgICAgICAgICAgICAgIG1heE9wZXJhdGlvbnM6IG1heE9wZXJhdGlvbnMsXG4gICAgICAgICAgICAgICAgbGFzdDogbGFzdCxcbiAgICAgICAgICAgICAgICBkbTogZG0sXG4gICAgICAgICAgICAgICAgZDogZFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfTtcblxuICAgIGlmIChtYXhPcGVyYXRpb25zID4gMCkge1xuXG4gICAgICAgIGlmIChsYXN0ID09PSAxKSB7XG4gICAgICAgICAgICByZXR1cm4gZ2V0U3RhdGUodHJ1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICBtYXhPcGVyYXRpb25zLS07XG4gICAgICAgIGlmICh0aGlzLl9zaW1wbGlmeVBhdGhzKCkpIHtcbiAgICAgICAgICAgIGxhc3QgPSAxO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKG1heE9wZXJhdGlvbnMgPiAwKSB7XG4gICAgICAgIGlmIChsYXN0ID09PSAyKSB7XG4gICAgICAgICAgICByZXR1cm4gZ2V0U3RhdGUodHJ1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICBtYXhPcGVyYXRpb25zLS07XG4gICAgICAgIGlmICh0aGlzLmhvcml6b250YWwuYmxvY2tTY2FuQmFja3dhcmQoKSkge1xuXG4gICAgICAgICAgICBkbyB7XG4gICAgICAgICAgICAgICAgbWF4T3BlcmF0aW9ucy0tO1xuICAgICAgICAgICAgfSB3aGlsZSAobWF4T3BlcmF0aW9ucyA+IDAgJiYgdGhpcy5ob3Jpem9udGFsLmJsb2NrU2NhbkJhY2t3YXJkKCkpO1xuXG4gICAgICAgICAgICBpZiAobGFzdCA8IDIgfHwgbGFzdCA+IDUpIHtcbiAgICAgICAgICAgICAgICBkID0gMDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoKytkID49IGRtKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGdldFN0YXRlKHRydWUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsYXN0ID0gMjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChtYXhPcGVyYXRpb25zID4gMCkge1xuICAgICAgICBpZiAobGFzdCA9PT0gMykge1xuICAgICAgICAgICAgcmV0dXJuIGdldFN0YXRlKHRydWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgbWF4T3BlcmF0aW9ucy0tO1xuICAgICAgICBpZiAodGhpcy5ob3Jpem9udGFsLmJsb2NrU2NhbkZvcndhcmQoKSkge1xuXG4gICAgICAgICAgICBkbyB7XG4gICAgICAgICAgICAgICAgbWF4T3BlcmF0aW9ucy0tO1xuICAgICAgICAgICAgfSB3aGlsZSAobWF4T3BlcmF0aW9ucyA+IDAgJiYgdGhpcy5ob3Jpem9udGFsLmJsb2NrU2NhbkZvcndhcmQoKSk7XG5cbiAgICAgICAgICAgIGlmIChsYXN0IDwgMiB8fCBsYXN0ID4gNSkge1xuICAgICAgICAgICAgICAgIGQgPSAwO1xuICAgICAgICAgICAgfSBlbHNlIGlmICgrK2QgPj0gZG0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZ2V0U3RhdGUodHJ1ZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxhc3QgPSAzO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKG1heE9wZXJhdGlvbnMgPiAwKSB7XG4gICAgICAgIGlmIChsYXN0ID09PSA0KSB7XG4gICAgICAgICAgICByZXR1cm4gZ2V0U3RhdGUodHJ1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICBtYXhPcGVyYXRpb25zLS07XG4gICAgICAgIGlmICh0aGlzLnZlcnRpY2FsLmJsb2NrU2NhbkJhY2t3YXJkKCkpIHtcbiAgICAgICAgICAgIGRvIHtcbiAgICAgICAgICAgICAgICBtYXhPcGVyYXRpb25zLS07XG4gICAgICAgICAgICB9IHdoaWxlIChtYXhPcGVyYXRpb25zID4gMCAmJiB0aGlzLnZlcnRpY2FsLmJsb2NrU2NhbkJhY2t3YXJkKCkpO1xuXG4gICAgICAgICAgICBpZiAobGFzdCA8IDIgfHwgbGFzdCA+IDUpIHtcbiAgICAgICAgICAgICAgICBkID0gMDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoKytkID49IGRtKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGdldFN0YXRlKHRydWUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsYXN0ID0gNDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChtYXhPcGVyYXRpb25zID4gMCkge1xuICAgICAgICBpZiAobGFzdCA9PT0gNSkge1xuICAgICAgICAgICAgcmV0dXJuIGdldFN0YXRlKHRydWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgbWF4T3BlcmF0aW9ucy0tO1xuICAgICAgICBpZiAodGhpcy52ZXJ0aWNhbC5ibG9ja1NjYW5Gb3J3YXJkKCkpIHtcblxuICAgICAgICAgICAgZG8ge1xuICAgICAgICAgICAgICAgIG1heE9wZXJhdGlvbnMtLTtcbiAgICAgICAgICAgIH0gd2hpbGUgKG1heE9wZXJhdGlvbnMgPiAwICYmIHRoaXMudmVydGljYWwuYmxvY2tTY2FuRm9yd2FyZCgpKTtcblxuICAgICAgICAgICAgaWYgKGxhc3QgPCAyIHx8IGxhc3QgPiA1KSB7XG4gICAgICAgICAgICAgICAgZCA9IDA7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCsrZCA+PSBkbSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBnZXRTdGF0ZSh0cnVlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGFzdCA9IDU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAobWF4T3BlcmF0aW9ucyA+IDApIHtcbiAgICAgICAgaWYgKGxhc3QgPT09IDYpIHtcbiAgICAgICAgICAgIHJldHVybiBnZXRTdGF0ZSh0cnVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIG1heE9wZXJhdGlvbnMtLTtcbiAgICAgICAgaWYgKHRoaXMuaG9yaXpvbnRhbC5ibG9ja1N3aXRjaFdyb25ncygpKSB7XG4gICAgICAgICAgICBsYXN0ID0gNjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChtYXhPcGVyYXRpb25zID4gMCkge1xuICAgICAgICBpZiAobGFzdCA9PT0gNykge1xuICAgICAgICAgICAgcmV0dXJuIGdldFN0YXRlKHRydWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgbWF4T3BlcmF0aW9ucy0tO1xuICAgICAgICBpZiAodGhpcy52ZXJ0aWNhbC5ibG9ja1N3aXRjaFdyb25ncygpKSB7XG4gICAgICAgICAgICBsYXN0ID0gNztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChsYXN0ID09PSAwKSB7XG4gICAgICAgIHJldHVybiBnZXRTdGF0ZSh0cnVlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZ2V0U3RhdGUoZmFsc2UpO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5kZWxldGVQYXRoID0gZnVuY3Rpb24gKHBhdGgpIHtcbiAgICBhc3NlcnQocGF0aCAhPT0gbnVsbCwgJ0FSR3JhcGguZGVsZXRlUGF0aDogcGF0aCAhPT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIGlmIChwYXRoLmhhc093bmVyKCkpIHtcbiAgICAgICAgYXNzZXJ0KHBhdGgub3duZXIgPT09IHRoaXMsICdBUkdyYXBoLmRlbGV0ZVBhdGg6IHBhdGgub3duZXIgPT09IHRoaXMgRkFJTEVEJyk7XG5cbiAgICAgICAgdGhpcy5kZWxldGVFZGdlcyhwYXRoKTtcbiAgICAgICAgcGF0aC5vd25lciA9IG51bGw7XG4gICAgICAgIHZhciBpbmRleCA9IHRoaXMucGF0aHMuaW5kZXhPZihwYXRoKTtcblxuICAgICAgICBhc3NlcnQoaW5kZXggPiAtMSwgJ0FSR3JhcGgucmVtb3ZlOiBQYXRoIGRvZXMgbm90IGV4aXN0Jyk7XG4gICAgICAgIHRoaXMucGF0aHMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICB9XG5cbiAgICBwYXRoLmRlc3Ryb3koKTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuY2xlYXIgPSBmdW5jdGlvbiAoYWRkQmFja1NlbGZFZGdlcykge1xuICAgIHRoaXMuX2RlbGV0ZUFsbFBhdGhzKCk7XG4gICAgdGhpcy5fZGVsZXRlQWxsQm94ZXMoKTtcbiAgICB0aGlzLl9kZWxldGVBbGxFZGdlcygpO1xuICAgIGlmIChhZGRCYWNrU2VsZkVkZ2VzKSB7XG4gICAgICAgIHRoaXMuX2FkZFNlbGZFZGdlcygpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuYWRkUGF0aCA9IGZ1bmN0aW9uIChpc0F1dG9Sb3V0ZWQsIHN0YXJ0cG9ydHMsIGVuZHBvcnRzKSB7XG4gICAgdmFyIHBhdGggPSBuZXcgQXV0b1JvdXRlclBhdGgoKTtcblxuICAgIHBhdGguc2V0QXV0b1JvdXRpbmcoaXNBdXRvUm91dGVkKTtcbiAgICBwYXRoLnNldFN0YXJ0RW5kUG9ydHMoc3RhcnRwb3J0cywgZW5kcG9ydHMpO1xuICAgIHRoaXMuX2FkZChwYXRoKTtcblxuICAgIHJldHVybiBwYXRoO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5pc0VkZ2VGaXhlZCA9IGZ1bmN0aW9uIChwYXRoLCBzdGFydHBvaW50LCBlbmRwb2ludCkge1xuICAgIHZhciBkID0gVXRpbHMuZ2V0RGlyKGVuZHBvaW50Lm1pbnVzKHN0YXJ0cG9pbnQpKSxcbiAgICAgICAgaCA9IFV0aWxzLmlzSG9yaXpvbnRhbChkKSxcblxuICAgICAgICBlbGlzdCA9IHRoaXMuX2dldEVkZ2VMaXN0KGgpLFxuXG4gICAgICAgIGVkZ2UgPSBlbGlzdC5nZXRFZGdlKHBhdGgsIHN0YXJ0cG9pbnQsIGVuZHBvaW50KTtcbiAgICBpZiAoZWRnZSAhPT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gZWRnZS5nZXRFZGdlRml4ZWQoKSAmJiAhZWRnZS5nZXRFZGdlQ3VzdG9tRml4ZWQoKTtcbiAgICB9XG5cbiAgICBhc3NlcnQoZmFsc2UsICdBUkdyYXBoLmlzRWRnZUZpeGVkOiBGQUlMRUQnKTtcbiAgICByZXR1cm4gdHJ1ZTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmRlbGV0ZUFsbChmYWxzZSk7XG5cbiAgICB0aGlzLmhvcml6b250YWwuU2V0T3duZXIobnVsbCk7XG4gICAgdGhpcy52ZXJ0aWNhbC5TZXRPd25lcihudWxsKTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuYXNzZXJ0VmFsaWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGlkcyA9IE9iamVjdC5rZXlzKHRoaXMuYm94ZXMpLFxuICAgICAgICBpO1xuXG4gICAgZm9yIChpID0gdGhpcy5ib3hlcy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgdGhpcy5hc3NlcnRWYWxpZEJveCh0aGlzLmJveGVzW2lkc1tpXV0pO1xuICAgIH1cblxuICAgIGZvciAoaSA9IHRoaXMucGF0aHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHRoaXMuX2Fzc2VydFZhbGlkUGF0aCh0aGlzLnBhdGhzW2ldKTtcbiAgICB9XG5cbiAgICB0aGlzLmhvcml6b250YWwuYXNzZXJ0VmFsaWQoKTtcbiAgICB0aGlzLnZlcnRpY2FsLmFzc2VydFZhbGlkKCk7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLmFzc2VydFZhbGlkQm94ID0gZnVuY3Rpb24gKGJveCkge1xuICAgIGJveC5hc3NlcnRWYWxpZCgpO1xuICAgIGFzc2VydChib3gub3duZXIgPT09IHRoaXMsXG4gICAgICAgICdBUkdyYXBoLmFzc2VydFZhbGlkQm94OiBib3gub3duZXIgPT09IHRoaXMgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KHRoaXMuYm94ZXNbYm94LmlkXSAhPT0gdW5kZWZpbmVkLFxuICAgICAgICAnQVJHcmFwaC5hc3NlcnRWYWxpZEJveDogdGhpcy5ib3hlc1tib3guaWRdICE9PSB1bmRlZmluZWQgRkFJTEVEJyk7XG5cbiAgICAvLyBWZXJpZnkgdGhhdCB0aGUgYm94IChhbmQgcG9ydCkgZWRnZXMgYXJlIG9uIHRoZSBncmFwaFxuICAgIGFzc2VydCh0aGlzLl9jb250YWluc1JlY3RFZGdlcyhib3gucmVjdCksXG4gICAgICAgICdHcmFwaCBkb2VzIG5vdCBjb250YWluIGVkZ2VzIGZvciBib3ggJyArIGJveC5pZCk7XG5cbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2NvbnRhaW5zUmVjdEVkZ2VzID0gZnVuY3Rpb24gKHJlY3QpIHtcbiAgICB2YXIgdG9wTGVmdCA9IHJlY3QuZ2V0VG9wTGVmdCgpLFxuICAgICAgICBib3R0b21SaWdodCA9IHJlY3QuZ2V0Qm90dG9tUmlnaHQoKSxcbiAgICAgICAgcG9pbnRzID0gW10sXG4gICAgICAgIHJlc3VsdCA9IHRydWUsXG4gICAgICAgIGxlbixcbiAgICAgICAgc3RhcnQsXG4gICAgICAgIGVuZDtcblxuICAgIHBvaW50cy5wdXNoKHRvcExlZnQpO1xuICAgIHBvaW50cy5wdXNoKG5ldyBBclBvaW50KGJvdHRvbVJpZ2h0LngsIHRvcExlZnQueSkpOyAgLy8gdG9wIHJpZ2h0XG4gICAgcG9pbnRzLnB1c2goYm90dG9tUmlnaHQpO1xuICAgIHBvaW50cy5wdXNoKG5ldyBBclBvaW50KHRvcExlZnQueCwgYm90dG9tUmlnaHQueSkpOyAgLy8gYm90dG9tIGxlZnRcblxuICAgIGxlbiA9IHBvaW50cy5sZW5ndGg7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICBzdGFydCA9IHBvaW50c1tpXTtcbiAgICAgICAgZW5kID0gcG9pbnRzWyhpICsgMSkgJSBsZW5dO1xuICAgICAgICByZXN1bHQgPSByZXN1bHQgJiYgdGhpcy5fY29udGFpbnNFZGdlKHN0YXJ0LCBlbmQpO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG59O1xuXG4vKipcbiAqIFRoaXMgY2hlY2tzIGZvciBhbiBlZGdlIHdpdGggdGhlIGdpdmVuIHN0YXJ0L2VuZCBwb2ludHMuIFRoaXMgd2lsbCBvbmx5XG4gKiB3b3JrIGZvciBmaXhlZCBlZGdlcyBzdWNoIGFzIGJveGVzIG9yIHBvcnRzLlxuICpcbiAqIEBwYXJhbSBzdGFydFxuICogQHBhcmFtIGVuZFxuICogQHJldHVybiB7dW5kZWZpbmVkfVxuICovXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9jb250YWluc0VkZ2UgPSBmdW5jdGlvbiAoc3RhcnQsIGVuZCkge1xuICAgIHZhciBkaXI7XG5cbiAgICBkaXIgPSBVdGlscy5nZXREaXIoc3RhcnQubWludXMoZW5kKSk7XG4gICAgYXNzZXJ0KFV0aWxzLmlzUmlnaHRBbmdsZShkaXIpLFxuICAgICAgICAnRWRnZSBpcyBpbnZhbGlkOiAnICsgVXRpbHMuc3RyaW5naWZ5KHN0YXJ0KSArICcgYW5kICcgKyBVdGlscy5zdHJpbmdpZnkoZW5kKSk7XG5cbiAgICBpZiAoVXRpbHMuaXNIb3Jpem9udGFsKGRpcikpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaG9yaXpvbnRhbC5jb250YWlucyhzdGFydCwgZW5kKSB8fCB0aGlzLmhvcml6b250YWwuY29udGFpbnMoZW5kLCBzdGFydCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudmVydGljYWwuY29udGFpbnMoc3RhcnQsIGVuZCkgfHwgdGhpcy52ZXJ0aWNhbC5jb250YWlucyhlbmQsIHN0YXJ0KTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9hc3NlcnRWYWxpZFBhdGggPSBmdW5jdGlvbiAocGF0aCkge1xuICAgIGFzc2VydChwYXRoLm93bmVyID09PSB0aGlzLFxuICAgICAgICAnQVJHcmFwaC5hc3NlcnRWYWxpZEJveDogYm94Lm93bmVyID09PSB0aGlzIEZBSUxFRCcpO1xuICAgIHBhdGguYXNzZXJ0VmFsaWQoKTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuZHVtcFBhdGhzID0gZnVuY3Rpb24gKHBvcywgYykge1xuICAgIF9sb2dnZXIuZGVidWcoJ1BhdGhzIGR1bXAgcG9zICcgKyBwb3MgKyAnLCBjICcgKyBjKTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5wYXRocy5sZW5ndGg7IGkrKykge1xuICAgICAgICBfbG9nZ2VyLmRlYnVnKGkgKyAnLiBQYXRoOiAnKTtcbiAgICAgICAgdGhpcy5wYXRoc1tpXS5nZXRQb2ludExpc3QoKS5kdW1wUG9pbnRzKCdEdW1wUGF0aHMnKTtcbiAgICB9XG5cbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuZHVtcEVkZ2VMaXN0cyA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmhvcml6b250YWwuZHVtcEVkZ2VzKCdIb3Jpem9udGFsIGVkZ2VzOicpO1xuICAgIHRoaXMudmVydGljYWwuZHVtcEVkZ2VzKCdWZXJ0aWNhbCBlZGdlczonKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQXV0b1JvdXRlckdyYXBoO1xuIiwiJ3VzZSBzdHJpY3QnO1xudmFyIGRlYnVnID0gcmVxdWlyZSgnZGVidWcnKSxcbiAgICBMRVZFTFMgPSBbJ3dhcm4nLCAnZGVidWcnLCAnaW5mbyddO1xuXG52YXIgTG9nZ2VyID0gZnVuY3Rpb24obmFtZSl7XG4gICAgZm9yICh2YXIgaSA9IExFVkVMUy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgdGhpc1tMRVZFTFNbaV1dID0gZGVidWcobmFtZSArICc6JyArIExFVkVMU1tpXSk7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBMb2dnZXI7XG4iLCIvKmdsb2JhbHMgZGVmaW5lKi9cbi8qanNoaW50IGJyb3dzZXI6IHRydWUsIGJpdHdpc2U6IGZhbHNlKi9cblxuLyoqXG4gKiBAYXV0aG9yIGJyb2xsYiAvIGh0dHBzOi8vZ2l0aHViL2Jyb2xsYlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIENPTlNUQU5UUyA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Db25zdGFudHMnKSxcbiAgICBVdGlscyA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5VdGlscycpLFxuICAgIGFzc2VydCA9IFV0aWxzLmFzc2VydCxcbiAgICBBclBvaW50ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlBvaW50JyksXG4gICAgQXJSZWN0ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlJlY3QnKSxcbiAgICBBclBvaW50TGlzdFBhdGggPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUG9pbnRMaXN0Jyk7XG5cbi8vIEF1dG9Sb3V0ZXJQYXRoXG52YXIgQXV0b1JvdXRlclBhdGggPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5pZCA9ICdOb25lJztcbiAgICB0aGlzLm93bmVyID0gbnVsbDtcbiAgICB0aGlzLnN0YXJ0cG9pbnQgPSBudWxsO1xuICAgIHRoaXMuZW5kcG9pbnQgPSBudWxsO1xuICAgIHRoaXMuc3RhcnRwb3J0cyA9IG51bGw7XG4gICAgdGhpcy5lbmRwb3J0cyA9IG51bGw7XG4gICAgdGhpcy5zdGFydHBvcnQgPSBudWxsO1xuICAgIHRoaXMuZW5kcG9ydCA9IG51bGw7XG4gICAgdGhpcy5hdHRyaWJ1dGVzID0gQ09OU1RBTlRTLlBhdGhEZWZhdWx0O1xuICAgIHRoaXMuc3RhdGUgPSBDT05TVEFOVFMuUGF0aFN0YXRlRGVmYXVsdDtcbiAgICB0aGlzLmlzQXV0b1JvdXRpbmdPbiA9IHRydWU7XG4gICAgdGhpcy5jdXN0b21QYXRoRGF0YSA9IFtdO1xuICAgIHRoaXMuY3VzdG9taXphdGlvblR5cGUgPSAnUG9pbnRzJztcbiAgICB0aGlzLnBhdGhEYXRhVG9EZWxldGUgPSBbXTtcbiAgICB0aGlzLnBvaW50cyA9IG5ldyBBclBvaW50TGlzdFBhdGgoKTtcbn07XG5cblxuLy8tLS0tUG9pbnRzXG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5oYXNPd25lciA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5vd25lciAhPT0gbnVsbDtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5zZXRTdGFydEVuZFBvcnRzID0gZnVuY3Rpb24gKHN0YXJ0LCBlbmQpIHtcbiAgICB0aGlzLnN0YXJ0cG9ydHMgPSBzdGFydDtcbiAgICB0aGlzLmVuZHBvcnRzID0gZW5kO1xuICAgIHRoaXMuY2FsY3VsYXRlU3RhcnRFbmRQb3J0cygpO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmNsZWFyUG9ydHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgLy8gcmVtb3ZlIHRoZSBzdGFydC9lbmRwb2ludHMgZnJvbSB0aGUgZ2l2ZW4gcG9ydHNcbiAgICBpZiAodGhpcy5zdGFydHBvaW50KSB7XG4gICAgICAgIHRoaXMuc3RhcnRwb3J0LnJlbW92ZVBvaW50KHRoaXMuc3RhcnRwb2ludCk7XG4gICAgICAgIHRoaXMuc3RhcnRwb2ludCA9IG51bGw7XG4gICAgfVxuICAgIGlmICh0aGlzLmVuZHBvaW50KSB7XG4gICAgICAgIHRoaXMuZW5kcG9ydC5yZW1vdmVQb2ludCh0aGlzLmVuZHBvaW50KTtcbiAgICAgICAgdGhpcy5lbmRwb2ludCA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMuc3RhcnRwb3J0ID0gbnVsbDtcbiAgICB0aGlzLmVuZHBvcnQgPSBudWxsO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmdldFN0YXJ0UG9ydCA9IGZ1bmN0aW9uICgpIHtcbiAgICBhc3NlcnQodGhpcy5zdGFydHBvcnRzLmxlbmd0aCwgXG4gICAgICAgIGBBUlBhdGguZ2V0U3RhcnRQb3J0OiBDYW5cXCd0IHJldHJpZXZlIHN0YXJ0IHBvcnQgZnJvbSAke3RoaXMuaWR9YCk7XG5cbiAgICBpZiAoIXRoaXMuc3RhcnRwb3J0KSB7XG4gICAgICAgIHRoaXMuY2FsY3VsYXRlU3RhcnRQb3J0cygpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5zdGFydHBvcnQ7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuZ2V0RW5kUG9ydCA9IGZ1bmN0aW9uICgpIHtcbiAgICBhc3NlcnQodGhpcy5lbmRwb3J0cy5sZW5ndGgsIFxuICAgICAgICAnQVJQb3J0LmdldEVuZFBvcnQ6IENhblxcJ3QgcmV0cmlldmUgZW5kIHBvcnQgZnJvbSAnK3RoaXMuaWQpO1xuICAgIGlmICghdGhpcy5lbmRwb3J0KSB7XG4gICAgICAgIHRoaXMuY2FsY3VsYXRlRW5kUG9ydHMoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZW5kcG9ydDtcbn07XG5cbi8qKlxuICogUmVtb3ZlIHBvcnQgZnJvbSBzdGFydC9lbmQgcG9ydCBsaXN0cy5cbiAqXG4gKiBAcGFyYW0gcG9ydFxuICogQHJldHVybiB7dW5kZWZpbmVkfVxuICovXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUucmVtb3ZlUG9ydCA9IGZ1bmN0aW9uIChwb3J0KSB7XG4gICAgdmFyIHJlbW92ZWQgPSBVdGlscy5yZW1vdmVGcm9tQXJyYXlzKHBvcnQsIHRoaXMuc3RhcnRwb3J0cywgdGhpcy5lbmRwb3J0cyk7XG4gICAgYXNzZXJ0KHJlbW92ZWQsICdQb3J0IHdhcyBub3QgcmVtb3ZlZCBmcm9tIHBhdGggc3RhcnQvZW5kIHBvcnRzJyk7XG5cbiAgICAvLyBJZiBubyBtb3JlIHN0YXJ0L2VuZCBwb3J0cywgcmVtb3ZlIHRoZSBwYXRoXG4gICAgLy8gYXNzZXJ0KHRoaXMuc3RhcnRwb3J0cy5sZW5ndGggJiYgdGhpcy5lbmRwb3J0cy5sZW5ndGgsICdSZW1vdmVkIGFsbCBzdGFydC9lbmRwb3J0cyBvZiBwYXRoICcgKyB0aGlzLmlkKTtcbiAgICB0aGlzLm93bmVyLmRpc2Nvbm5lY3QodGhpcyk7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuY2FsY3VsYXRlU3RhcnRFbmRQb3J0cyA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4ge3NyYzogdGhpcy5jYWxjdWxhdGVTdGFydFBvcnRzKCksIGRzdDogdGhpcy5jYWxjdWxhdGVFbmRQb3J0cygpfTtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5jYWxjdWxhdGVTdGFydFBvcnRzID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBzcmNQb3J0cyA9IFtdLFxuICAgICAgICB0Z3QsXG4gICAgICAgIGk7XG5cbiAgICBhc3NlcnQodGhpcy5zdGFydHBvcnRzLmxlbmd0aCA+IDAsICdBclBhdGguY2FsY3VsYXRlU3RhcnRFbmRQb3J0czogdGhpcy5zdGFydHBvcnRzIGNhbm5vdCBiZSBlbXB0eSEnKTtcblxuICAgIC8vUmVtb3ZlIHRoaXMuc3RhcnRwb2ludFxuICAgIGlmICh0aGlzLnN0YXJ0cG9ydCAmJiB0aGlzLnN0YXJ0cG9ydC5oYXNQb2ludCh0aGlzLnN0YXJ0cG9pbnQpKSB7XG4gICAgICAgIHRoaXMuc3RhcnRwb3J0LnJlbW92ZVBvaW50KHRoaXMuc3RhcnRwb2ludCk7XG4gICAgfVxuXG4gICAgLy9HZXQgYXZhaWxhYmxlIHBvcnRzXG4gICAgZm9yIChpID0gdGhpcy5zdGFydHBvcnRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICBhc3NlcnQodGhpcy5zdGFydHBvcnRzW2ldLm93bmVyLFxuICAgICAgICAgICAgJ0FSUGF0aC5jYWxjdWxhdGVTdGFydEVuZFBvcnRzOiBwb3J0ICcgKyB0aGlzLnN0YXJ0cG9ydHNbaV0uaWQgKyAnIGhhcyBpbnZhbGlkIHRoaXMub3duZXIhJyk7XG4gICAgICAgIGlmICh0aGlzLnN0YXJ0cG9ydHNbaV0uaXNBdmFpbGFibGUoKSkge1xuICAgICAgICAgICAgc3JjUG9ydHMucHVzaCh0aGlzLnN0YXJ0cG9ydHNbaV0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHNyY1BvcnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBzcmNQb3J0cyA9IHRoaXMuc3RhcnRwb3J0cztcbiAgICB9XG5cbiAgICAvL1ByZXZlbnRpbmcgc2FtZSBzdGFydC9lbmRwb3J0XG4gICAgaWYgKHRoaXMuZW5kcG9ydCAmJiBzcmNQb3J0cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGkgPSBzcmNQb3J0cy5sZW5ndGg7XG4gICAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgICAgIGlmIChzcmNQb3J0c1tpXSA9PT0gdGhpcy5lbmRwb3J0KSB7XG4gICAgICAgICAgICAgICAgc3JjUG9ydHMuc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG5cbiAgICAvLyBHZXR0aW5nIHRhcmdldFxuICAgIGlmICh0aGlzLmlzQXV0b1JvdXRlZCgpKSB7XG4gICAgICAgIHZhciBhY2N1bXVsYXRlUG9ydENlbnRlcnMgPSBmdW5jdGlvbiAocHJldiwgY3VycmVudCkge1xuICAgICAgICAgICAgdmFyIGNlbnRlciA9IGN1cnJlbnQucmVjdC5nZXRDZW50ZXIoKTtcbiAgICAgICAgICAgIHByZXYueCArPSBjZW50ZXIueDtcbiAgICAgICAgICAgIHByZXYueSArPSBjZW50ZXIueTtcbiAgICAgICAgICAgIHJldHVybiBwcmV2O1xuICAgICAgICB9O1xuICAgICAgICB0Z3QgPSB0aGlzLmVuZHBvcnRzLnJlZHVjZShhY2N1bXVsYXRlUG9ydENlbnRlcnMsIG5ldyBBclBvaW50KDAsIDApKTtcblxuICAgICAgICB0Z3QueCAvPSB0aGlzLmVuZHBvcnRzLmxlbmd0aDtcbiAgICAgICAgdGd0LnkgLz0gdGhpcy5lbmRwb3J0cy5sZW5ndGg7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGd0ID0gdGhpcy5jdXN0b21QYXRoRGF0YVswXTtcbiAgICB9XG4gICAgLy8gR2V0IHRoZSBvcHRpbWFsIHBvcnQgdG8gdGhlIHRhcmdldFxuICAgIHRoaXMuc3RhcnRwb3J0ID0gVXRpbHMuZ2V0T3B0aW1hbFBvcnRzKHNyY1BvcnRzLCB0Z3QpO1xuXG4gICAgLy8gQ3JlYXRlIGEgdGhpcy5zdGFydHBvaW50IGF0IHRoZSBwb3J0XG4gICAgdmFyIHN0YXJ0ZGlyID0gdGhpcy5nZXRTdGFydERpcigpLFxuICAgICAgICBzdGFydHBvcnRIYXNMaW1pdGVkID0gZmFsc2UsXG4gICAgICAgIHN0YXJ0cG9ydENhbkhhdmUgPSB0cnVlO1xuXG4gICAgaWYgKHN0YXJ0ZGlyICE9PSBDT05TVEFOVFMuRGlyTm9uZSkge1xuICAgICAgICBzdGFydHBvcnRIYXNMaW1pdGVkID0gdGhpcy5zdGFydHBvcnQuaGFzTGltaXRlZERpcnMoKTtcbiAgICAgICAgc3RhcnRwb3J0Q2FuSGF2ZSA9IHRoaXMuc3RhcnRwb3J0LmNhbkhhdmVTdGFydEVuZFBvaW50T24oc3RhcnRkaXIsIHRydWUpO1xuICAgIH1cbiAgICBpZiAoc3RhcnRkaXIgPT09IENPTlNUQU5UUy5EaXJOb25lIHx8XHRcdFx0XHRcdFx0XHQvLyByZWNhbGMgc3RhcnRkaXIgaWYgZW1wdHlcbiAgICAgICAgc3RhcnRwb3J0SGFzTGltaXRlZCAmJiAhc3RhcnRwb3J0Q2FuSGF2ZSkge1x0XHQvLyBvciBpcyBsaW1pdGVkIGFuZCB1c2VycHJlZiBpcyBpbnZhbGlkXG4gICAgICAgIHN0YXJ0ZGlyID0gdGhpcy5zdGFydHBvcnQuZ2V0U3RhcnRFbmREaXJUbyh0Z3QsIHRydWUpO1xuICAgIH1cblxuICAgIHRoaXMuc3RhcnRwb2ludCA9IHRoaXMuc3RhcnRwb3J0LmNyZWF0ZVN0YXJ0RW5kUG9pbnRUbyh0Z3QsIHN0YXJ0ZGlyKTtcbiAgICB0aGlzLnN0YXJ0cG9pbnQub3duZXIgPSB0aGlzO1xuICAgIHJldHVybiB0aGlzLnN0YXJ0cG9ydDtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5jYWxjdWxhdGVFbmRQb3J0cyA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgZHN0UG9ydHMgPSBbXSxcbiAgICAgICAgdGd0LFxuICAgICAgICBpID0gdGhpcy5lbmRwb3J0cy5sZW5ndGg7XG5cbiAgICBhc3NlcnQodGhpcy5lbmRwb3J0cy5sZW5ndGggPiAwLCAnQXJQYXRoLmNhbGN1bGF0ZVN0YXJ0RW5kUG9ydHM6IHRoaXMuZW5kcG9ydHMgY2Fubm90IGJlIGVtcHR5IScpO1xuXG4gICAgLy9SZW1vdmUgb2xkIHRoaXMuZW5kcG9pbnRcbiAgICBpZiAodGhpcy5lbmRwb3J0ICYmIHRoaXMuZW5kcG9ydC5oYXNQb2ludCh0aGlzLmVuZHBvaW50KSkge1xuICAgICAgICB0aGlzLmVuZHBvcnQucmVtb3ZlUG9pbnQodGhpcy5lbmRwb2ludCk7XG4gICAgfVxuXG4gICAgLy9HZXQgYXZhaWxhYmxlIHBvcnRzXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgICBhc3NlcnQodGhpcy5lbmRwb3J0c1tpXS5vd25lciwgJ0FSUGF0aC5jYWxjdWxhdGVTdGFydEVuZFBvcnRzOiB0aGlzLmVuZHBvcnQgaGFzIGludmFsaWQgdGhpcy5vd25lciEnKTtcbiAgICAgICAgaWYgKHRoaXMuZW5kcG9ydHNbaV0uaXNBdmFpbGFibGUoKSkge1xuICAgICAgICAgICAgZHN0UG9ydHMucHVzaCh0aGlzLmVuZHBvcnRzW2ldKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChkc3RQb3J0cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgZHN0UG9ydHMgPSB0aGlzLmVuZHBvcnRzO1xuICAgIH1cblxuICAgIC8vUHJldmVudGluZyBzYW1lIHN0YXJ0L3RoaXMuZW5kcG9ydFxuICAgIGlmICh0aGlzLnN0YXJ0cG9ydCAmJiBkc3RQb3J0cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGkgPSBkc3RQb3J0cy5sZW5ndGg7XG4gICAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgICAgIGlmIChkc3RQb3J0c1tpXSA9PT0gdGhpcy5zdGFydHBvcnQpIHtcbiAgICAgICAgICAgICAgICBkc3RQb3J0cy5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvL0dldHRpbmcgdGFyZ2V0XG4gICAgaWYgKHRoaXMuaXNBdXRvUm91dGVkKCkpIHtcblxuICAgICAgICB2YXIgYWNjdW11bGF0ZVBvcnRDZW50ZXJzID0gZnVuY3Rpb24gKHByZXYsIGN1cnJlbnQpIHtcbiAgICAgICAgICAgIHZhciBjZW50ZXIgPSBjdXJyZW50LnJlY3QuZ2V0Q2VudGVyKCk7XG4gICAgICAgICAgICBwcmV2LnggKz0gY2VudGVyLng7XG4gICAgICAgICAgICBwcmV2LnkgKz0gY2VudGVyLnk7XG4gICAgICAgICAgICByZXR1cm4gcHJldjtcbiAgICAgICAgfTtcbiAgICAgICAgdGd0ID0gdGhpcy5zdGFydHBvcnRzLnJlZHVjZShhY2N1bXVsYXRlUG9ydENlbnRlcnMsIG5ldyBBclBvaW50KDAsIDApKTtcblxuICAgICAgICB0Z3QueCAvPSB0aGlzLnN0YXJ0cG9ydHMubGVuZ3RoO1xuICAgICAgICB0Z3QueSAvPSB0aGlzLnN0YXJ0cG9ydHMubGVuZ3RoO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGd0ID0gdGhpcy5jdXN0b21QYXRoRGF0YVt0aGlzLmN1c3RvbVBhdGhEYXRhLmxlbmd0aCAtIDFdO1xuICAgIH1cblxuICAgIC8vR2V0IHRoZSBvcHRpbWFsIHBvcnQgdG8gdGhlIHRhcmdldFxuICAgIHRoaXMuZW5kcG9ydCA9IFV0aWxzLmdldE9wdGltYWxQb3J0cyhkc3RQb3J0cywgdGd0KTtcblxuICAgIC8vQ3JlYXRlIHRoaXMuZW5kcG9pbnQgYXQgdGhlIHBvcnRcbiAgICB2YXIgZW5kZGlyID0gdGhpcy5nZXRFbmREaXIoKSxcbiAgICAgICAgc3RhcnRkaXIgPSB0aGlzLmdldFN0YXJ0RGlyKCksXG4gICAgICAgIGVuZHBvcnRIYXNMaW1pdGVkID0gZmFsc2UsXG4gICAgICAgIGVuZHBvcnRDYW5IYXZlID0gdHJ1ZTtcblxuICAgIGlmIChlbmRkaXIgIT09IENPTlNUQU5UUy5EaXJOb25lKSB7XG4gICAgICAgIGVuZHBvcnRIYXNMaW1pdGVkID0gdGhpcy5lbmRwb3J0Lmhhc0xpbWl0ZWREaXJzKCk7XG4gICAgICAgIGVuZHBvcnRDYW5IYXZlID0gdGhpcy5lbmRwb3J0LmNhbkhhdmVTdGFydEVuZFBvaW50T24oZW5kZGlyLCBmYWxzZSk7XG4gICAgfVxuICAgIGlmIChlbmRkaXIgPT09IENPTlNUQU5UUy5EaXJOb25lIHx8ICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGxpa2UgYWJvdmVcbiAgICAgICAgZW5kcG9ydEhhc0xpbWl0ZWQgJiYgIWVuZHBvcnRDYW5IYXZlKSB7XG4gICAgICAgIGVuZGRpciA9IHRoaXMuZW5kcG9ydC5nZXRTdGFydEVuZERpclRvKHRndCwgZmFsc2UsIHRoaXMuc3RhcnRwb3J0ID09PSB0aGlzLmVuZHBvcnQgP1xuICAgICAgICAgICAgc3RhcnRkaXIgOiBDT05TVEFOVFMuRGlyTm9uZSk7XG4gICAgfVxuXG4gICAgdGhpcy5lbmRwb2ludCA9IHRoaXMuZW5kcG9ydC5jcmVhdGVTdGFydEVuZFBvaW50VG8odGd0LCBlbmRkaXIpO1xuICAgIHRoaXMuZW5kcG9pbnQub3duZXIgPSB0aGlzO1xuICAgIHJldHVybiB0aGlzLmVuZHBvcnQ7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuaXNDb25uZWN0ZWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuICh0aGlzLnN0YXRlICYgQ09OU1RBTlRTLlBhdGhTdGF0ZUNvbm5lY3RlZCkgIT09IDA7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuYWRkVGFpbCA9IGZ1bmN0aW9uIChwdCkge1xuICAgIGFzc2VydCghdGhpcy5pc0Nvbm5lY3RlZCgpLFxuICAgICAgICAnQVJQYXRoLmFkZFRhaWw6ICF0aGlzLmlzQ29ubmVjdGVkKCkgRkFJTEVEJyk7XG4gICAgdGhpcy5wb2ludHMucHVzaChwdCk7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuZGVsZXRlQWxsID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMucG9pbnRzID0gbmV3IEFyUG9pbnRMaXN0UGF0aCgpO1xuICAgIHRoaXMuc3RhdGUgPSBDT05TVEFOVFMuUGF0aFN0YXRlRGVmYXVsdDtcbiAgICB0aGlzLmNsZWFyUG9ydHMoKTtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5nZXRTdGFydEJveCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgcG9ydCA9IHRoaXMuc3RhcnRwb3J0IHx8IHRoaXMuc3RhcnRwb3J0c1swXTtcbiAgICByZXR1cm4gcG9ydC5vd25lci5nZXRSb290Qm94KCk7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuZ2V0RW5kQm94ID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBwb3J0ID0gdGhpcy5lbmRwb3J0IHx8IHRoaXMuZW5kcG9ydHNbMF07XG4gICAgcmV0dXJuIHBvcnQub3duZXIuZ2V0Um9vdEJveCgpO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmdldE91dE9mQm94U3RhcnRQb2ludCA9IGZ1bmN0aW9uIChoaW50RGlyKSB7XG4gICAgdmFyIHN0YXJ0Qm94UmVjdCA9IHRoaXMuZ2V0U3RhcnRCb3goKTtcblxuICAgIGFzc2VydChoaW50RGlyICE9PSBDT05TVEFOVFMuRGlyU2tldywgJ0FSUGF0aC5nZXRPdXRPZkJveFN0YXJ0UG9pbnQ6IGhpbnREaXIgIT09IENPTlNUQU5UUy5EaXJTa2V3IEZBSUxFRCcpO1xuICAgIGFzc2VydCh0aGlzLnBvaW50cy5sZW5ndGggPj0gMiwgJ0FSUGF0aC5nZXRPdXRPZkJveFN0YXJ0UG9pbnQ6IHRoaXMucG9pbnRzLmxlbmd0aCA+PSAyIEZBSUxFRCcpO1xuXG4gICAgdmFyIHBvcyA9IDAsXG4gICAgICAgIHAgPSBuZXcgQXJQb2ludCh0aGlzLnBvaW50c1twb3MrK10pLFxuICAgICAgICBkID0gVXRpbHMuZ2V0RGlyKHRoaXMucG9pbnRzW3Bvc10ubWludXMocCkpO1xuXG4gICAgaWYgKGQgPT09IENPTlNUQU5UUy5EaXJTa2V3KSB7XG4gICAgICAgIGQgPSBoaW50RGlyO1xuICAgIH1cbiAgICBhc3NlcnQoVXRpbHMuaXNSaWdodEFuZ2xlKGQpLCAnQVJQYXRoLmdldE91dE9mQm94U3RhcnRQb2ludDogVXRpbHMuaXNSaWdodEFuZ2xlIChkKSBGQUlMRUQnKTtcblxuICAgIGlmIChVdGlscy5pc0hvcml6b250YWwoZCkpIHtcbiAgICAgICAgcC54ID0gVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQoc3RhcnRCb3hSZWN0LCBkKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBwLnkgPSBVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChzdGFydEJveFJlY3QsIGQpO1xuICAgIH1cblxuICAgIC8vYXNzZXJ0KFV0aWxzLmdldERpciAodGhpcy5wb2ludHNbcG9zXS5taW51cyhwKSkgPT09IFV0aWxzLnJldmVyc2VEaXIgKCBkICkgfHxcbiAgICAvLyBVdGlscy5nZXREaXIgKHRoaXMucG9pbnRzW3Bvc10ubWludXMocCkpID09PSBkLCAnVXRpbHMuZ2V0RGlyICh0aGlzLnBvaW50c1twb3NdLm1pbnVzKHApKSA9PT1cbiAgICAvLyBVdGlscy5yZXZlcnNlRGlyICggZCApIHx8IFV0aWxzLmdldERpciAodGhpcy5wb2ludHNbcG9zXS5taW51cyhwKSkgPT09IGQgRkFJTEVEJyk7XG5cbiAgICByZXR1cm4gcDtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5nZXRPdXRPZkJveEVuZFBvaW50ID0gZnVuY3Rpb24gKGhpbnREaXIpIHtcbiAgICB2YXIgZW5kQm94UmVjdCA9IHRoaXMuZ2V0RW5kQm94KCk7XG5cbiAgICBhc3NlcnQoaGludERpciAhPT0gQ09OU1RBTlRTLkRpclNrZXcsICdBUlBhdGguZ2V0T3V0T2ZCb3hFbmRQb2ludDogaGludERpciAhPT0gQ09OU1RBTlRTLkRpclNrZXcgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KHRoaXMucG9pbnRzLmxlbmd0aCA+PSAyLCAnQVJQYXRoLmdldE91dE9mQm94RW5kUG9pbnQ6IHRoaXMucG9pbnRzLmxlbmd0aCA+PSAyIEZBSUxFRCcpO1xuXG4gICAgdmFyIHBvcyA9IHRoaXMucG9pbnRzLmxlbmd0aCAtIDEsXG4gICAgICAgIHAgPSBuZXcgQXJQb2ludCh0aGlzLnBvaW50c1twb3MtLV0pLFxuICAgICAgICBkID0gVXRpbHMuZ2V0RGlyKHRoaXMucG9pbnRzW3Bvc10ubWludXMocCkpO1xuXG4gICAgaWYgKGQgPT09IENPTlNUQU5UUy5EaXJTa2V3KSB7XG4gICAgICAgIGQgPSBoaW50RGlyO1xuICAgIH1cbiAgICBhc3NlcnQoVXRpbHMuaXNSaWdodEFuZ2xlKGQpLCAnQVJQYXRoLmdldE91dE9mQm94RW5kUG9pbnQ6IFV0aWxzLmlzUmlnaHRBbmdsZSAoZCkgRkFJTEVEJyk7XG5cbiAgICBpZiAoVXRpbHMuaXNIb3Jpem9udGFsKGQpKSB7XG4gICAgICAgIHAueCA9IFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKGVuZEJveFJlY3QsIGQpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHAueSA9IFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKGVuZEJveFJlY3QsIGQpO1xuICAgIH1cblxuICAgIC8vYXNzZXJ0KFV0aWxzLmdldERpciAodGhpcy5wb2ludHNbcG9zXS5taW51cyhwKSkgPT09IFV0aWxzLnJldmVyc2VEaXIgKCBkICkgfHxcbiAgICAvLyBVdGlscy5nZXREaXIgKHRoaXMucG9pbnRzW3Bvc10ubWludXMocCkpID09PSBkLCAnQVJQYXRoLmdldE91dE9mQm94RW5kUG9pbnQ6IFV0aWxzLmdldERpclxuICAgIC8vICh0aGlzLnBvaW50c1twb3NdLm1pbnVzKHApKSA9PT0gZCB8fCBVdGlscy5nZXREaXIgKHRoaXMucG9pbnRzW3Bvc10ubWludXMocCkpID09PSBkIEZBSUxFRCcpO1xuXG4gICAgcmV0dXJuIHA7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuc2ltcGxpZnlUcml2aWFsbHkgPSBmdW5jdGlvbiAoKSB7XG4gICAgYXNzZXJ0KCF0aGlzLmlzQ29ubmVjdGVkKCksICdBUlBhdGguc2ltcGxpZnlUcml2aWFsbHk6ICFpc0Nvbm5lY3RlZCgpIEZBSUxFRCcpO1xuXG4gICAgaWYgKHRoaXMucG9pbnRzLmxlbmd0aCA8PSAyKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgcG9zID0gMCxcbiAgICAgICAgcG9zMSA9IHBvcztcblxuICAgIGFzc2VydChwb3MxICE9PSB0aGlzLnBvaW50cy5sZW5ndGgsICdBUlBhdGguc2ltcGxpZnlUcml2aWFsbHk6IHBvczEgIT09IHRoaXMucG9pbnRzLmxlbmd0aCBGQUlMRUQnKTtcbiAgICB2YXIgcDEgPSB0aGlzLnBvaW50c1twb3MrK10sXG4gICAgICAgIHBvczIgPSBwb3M7XG5cbiAgICBhc3NlcnQocG9zMiAhPT0gdGhpcy5wb2ludHMubGVuZ3RoLCAnQVJQYXRoLnNpbXBsaWZ5VHJpdmlhbGx5OiBwb3MyICE9PSB0aGlzLnBvaW50cy5sZW5ndGggRkFJTEVEJyk7XG4gICAgdmFyIHAyID0gdGhpcy5wb2ludHNbcG9zKytdLFxuICAgICAgICBkaXIxMiA9IFV0aWxzLmdldERpcihwMi5taW51cyhwMSkpLFxuICAgICAgICBwb3MzID0gcG9zO1xuXG4gICAgYXNzZXJ0KHBvczMgIT09IHRoaXMucG9pbnRzLmxlbmd0aCwgJ0FSUGF0aC5zaW1wbGlmeVRyaXZpYWxseTogcG9zMyAhPT0gdGhpcy5wb2ludHMubGVuZ3RoIEZBSUxFRCcpO1xuICAgIHZhciBwMyA9IHRoaXMucG9pbnRzW3BvcysrXSxcbiAgICAgICAgZGlyMjMgPSBVdGlscy5nZXREaXIocDMubWludXMocDIpKTtcblxuICAgIGZvciAoOyA7KSB7XG4gICAgICAgIGlmIChkaXIxMiA9PT0gQ09OU1RBTlRTLkRpck5vbmUgfHwgZGlyMjMgPT09IENPTlNUQU5UUy5EaXJOb25lIHx8XG4gICAgICAgICAgICAoZGlyMTIgIT09IENPTlNUQU5UUy5EaXJTa2V3ICYmIGRpcjIzICE9PSBDT05TVEFOVFMuRGlyU2tldyAmJlxuICAgICAgICAgICAgKGRpcjEyID09PSBkaXIyMyB8fCBkaXIxMiA9PT0gVXRpbHMucmV2ZXJzZURpcihkaXIyMykpICkpIHtcbiAgICAgICAgICAgIHRoaXMucG9pbnRzLnNwbGljZShwb3MyLCAxKTtcbiAgICAgICAgICAgIHBvcy0tO1xuICAgICAgICAgICAgcG9zMy0tO1xuICAgICAgICAgICAgZGlyMTIgPSBVdGlscy5nZXREaXIocDMubWludXMocDEpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBvczEgPSBwb3MyO1xuICAgICAgICAgICAgcDEgPSBwMjtcbiAgICAgICAgICAgIGRpcjEyID0gZGlyMjM7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocG9zID09PSB0aGlzLnBvaW50cy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHBvczIgPSBwb3MzO1xuICAgICAgICBwMiA9IHAzO1xuXG4gICAgICAgIHBvczMgPSBwb3M7XG4gICAgICAgIHAzID0gdGhpcy5wb2ludHNbcG9zKytdO1xuXG4gICAgICAgIGRpcjIzID0gVXRpbHMuZ2V0RGlyKHAzLm1pbnVzKHAyKSk7XG4gICAgfVxuXG4gICAgaWYgKENPTlNUQU5UUy5ERUJVRykge1xuICAgICAgICB0aGlzLmFzc2VydFZhbGlkUG9pbnRzKCk7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmdldFBvaW50TGlzdCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5wb2ludHM7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuaXNQYXRoQ2xpcCA9IGZ1bmN0aW9uIChyLCBpc1N0YXJ0T3JFbmRSZWN0KSB7XG4gICAgdmFyIHRtcCA9IHRoaXMucG9pbnRzLmdldFRhaWxFZGdlKCksXG4gICAgICAgIGEgPSB0bXAuc3RhcnQsXG4gICAgICAgIGIgPSB0bXAuZW5kLFxuICAgICAgICBwb3MgPSB0bXAucG9zLFxuICAgICAgICBpID0gMCxcbiAgICAgICAgbnVtRWRnZXMgPSB0aGlzLnBvaW50cy5sZW5ndGggLSAxO1xuXG4gICAgd2hpbGUgKHBvcyA+PSAwKSB7XG4gICAgICAgIGlmIChpc1N0YXJ0T3JFbmRSZWN0ICYmICggaSA9PT0gMCB8fCBpID09PSBudW1FZGdlcyAtIDEgKSkge1xuICAgICAgICAgICAgaWYgKFV0aWxzLmlzUG9pbnRJbihhLCByLCAxKSAmJlxuICAgICAgICAgICAgICAgIFV0aWxzLmlzUG9pbnRJbihiLCByLCAxKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKFV0aWxzLmlzTGluZUNsaXBSZWN0KGEsIGIsIHIpKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRtcCA9IHRoaXMucG9pbnRzLmdldFByZXZFZGdlKHBvcywgYSwgYik7XG4gICAgICAgIGEgPSB0bXAuc3RhcnQ7XG4gICAgICAgIGIgPSB0bXAuZW5kO1xuICAgICAgICBwb3MgPSB0bXAucG9zO1xuICAgICAgICBpKys7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmlzRml4ZWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuICgodGhpcy5hdHRyaWJ1dGVzICYgQ09OU1RBTlRTLlBhdGhGaXhlZCkgIT09IDApO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmlzTW92ZWFibGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuICgodGhpcy5hdHRyaWJ1dGVzICYgQ09OU1RBTlRTLlBhdGhGaXhlZCkgPT09IDApO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLnNldFN0YXRlID0gZnVuY3Rpb24gKHMpIHtcbiAgICBhc3NlcnQodGhpcy5vd25lciAhPT0gbnVsbCwgJ0FSUGF0aC5zZXRTdGF0ZTogdGhpcy5vd25lciAhPT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIHRoaXMuc3RhdGUgPSBzO1xuICAgIGlmIChDT05TVEFOVFMuREVCVUcpIHtcbiAgICAgICAgdGhpcy5hc3NlcnRWYWxpZCgpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5nZXRFbmREaXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGEgPSB0aGlzLmF0dHJpYnV0ZXMgJiBDT05TVEFOVFMuUGF0aEVuZE1hc2s7XG4gICAgcmV0dXJuIGEgJiBDT05TVEFOVFMuUGF0aEVuZE9uVG9wID8gQ09OU1RBTlRTLkRpclRvcCA6XG4gICAgICAgIGEgJiBDT05TVEFOVFMuUGF0aEVuZE9uUmlnaHQgPyBDT05TVEFOVFMuRGlyUmlnaHQgOlxuICAgICAgICAgICAgYSAmIENPTlNUQU5UUy5QYXRoRW5kT25Cb3R0b20gPyBDT05TVEFOVFMuRGlyQm90dG9tIDpcbiAgICAgICAgICAgICAgICBhICYgQ09OU1RBTlRTLlBhdGhFbmRPbkxlZnQgPyBDT05TVEFOVFMuRGlyTGVmdCA6IENPTlNUQU5UUy5EaXJOb25lO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmdldFN0YXJ0RGlyID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBhID0gdGhpcy5hdHRyaWJ1dGVzICYgQ09OU1RBTlRTLlBhdGhTdGFydE1hc2s7XG4gICAgcmV0dXJuIGEgJiBDT05TVEFOVFMuUGF0aFN0YXJ0T25Ub3AgPyBDT05TVEFOVFMuRGlyVG9wIDpcbiAgICAgICAgYSAmIENPTlNUQU5UUy5QYXRoU3RhcnRPblJpZ2h0ID8gQ09OU1RBTlRTLkRpclJpZ2h0IDpcbiAgICAgICAgICAgIGEgJiBDT05TVEFOVFMuUGF0aFN0YXJ0T25Cb3R0b20gPyBDT05TVEFOVFMuRGlyQm90dG9tIDpcbiAgICAgICAgICAgICAgICBhICYgQ09OU1RBTlRTLlBhdGhTdGFydE9uTGVmdCA/IENPTlNUQU5UUy5EaXJMZWZ0IDogQ09OU1RBTlRTLkRpck5vbmU7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuc2V0RW5kRGlyID0gZnVuY3Rpb24gKHBhdGhFbmQpIHtcbiAgICB0aGlzLmF0dHJpYnV0ZXMgPSAodGhpcy5hdHRyaWJ1dGVzICYgfkNPTlNUQU5UUy5QYXRoRW5kTWFzaykgKyBwYXRoRW5kO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLnNldFN0YXJ0RGlyID0gZnVuY3Rpb24gKHBhdGhTdGFydCkge1xuICAgIHRoaXMuYXR0cmlidXRlcyA9ICh0aGlzLmF0dHJpYnV0ZXMgJiB+Q09OU1RBTlRTLlBhdGhTdGFydE1hc2spICsgcGF0aFN0YXJ0O1xufTtcblxuLyoqXG4gKiBTZXQgdGhlIGN1c3RvbSBwb2ludHMgb2YgdGhlIHBhdGggYW5kIGRldGVybWluZSBzdGFydC9lbmQgcG9pbnRzL3BvcnRzLlxuICpcbiAqIEBwYXJhbSB7QXJyYXk8QXJQb2ludD59IHBvaW50c1xuICogQHJldHVybiB7dW5kZWZpbmVkfVxuICovXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuc2V0Q3VzdG9tUGF0aFBvaW50cyA9IGZ1bmN0aW9uIChwb2ludHMpIHtcbiAgICB0aGlzLmN1c3RvbVBhdGhEYXRhID0gcG9pbnRzO1xuXG4gICAgLy8gRmluZCB0aGUgc3RhcnQvZW5kcG9ydHNcbiAgICB0aGlzLmNhbGN1bGF0ZVN0YXJ0RW5kUG9ydHMoKTtcblxuICAgIHRoaXMucG9pbnRzID0gbmV3IEFyUG9pbnRMaXN0UGF0aCgpLmNvbmNhdChwb2ludHMpO1xuXG4gICAgLy8gQWRkIHRoZSBzdGFydC9lbmQgcG9pbnRzIHRvIHRoZSBsaXN0XG4gICAgdGhpcy5wb2ludHMudW5zaGlmdCh0aGlzLnN0YXJ0cG9pbnQpO1xuICAgIHRoaXMucG9pbnRzLnB1c2godGhpcy5lbmRwb2ludCk7XG5cbiAgICAvLyBTZXQgYXMgY29ubmVjdGVkXG4gICAgdGhpcy5zZXRTdGF0ZShDT05TVEFOVFMuUGF0aFN0YXRlQ29ubmVjdGVkKTtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5jcmVhdGVDdXN0b21QYXRoID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMucG9pbnRzLnNoaWZ0KCk7XG4gICAgdGhpcy5wb2ludHMucG9wKCk7XG5cbiAgICB0aGlzLnBvaW50cy51bnNoaWZ0KHRoaXMuc3RhcnRwb2ludCk7XG4gICAgdGhpcy5wb2ludHMucHVzaCh0aGlzLmVuZHBvaW50KTtcblxuICAgIHRoaXMuc2V0U3RhdGUoQ09OU1RBTlRTLlBhdGhTdGF0ZUNvbm5lY3RlZCk7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUucmVtb3ZlUGF0aEN1c3RvbWl6YXRpb25zID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuY3VzdG9tUGF0aERhdGEgPSBbXTtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5hcmVUaGVyZVBhdGhDdXN0b21pemF0aW9ucyA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5jdXN0b21QYXRoRGF0YS5sZW5ndGggIT09IDA7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuaXNBdXRvUm91dGVkID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmlzQXV0b1JvdXRpbmdPbjtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5zZXRBdXRvUm91dGluZyA9IGZ1bmN0aW9uIChhclN0YXRlKSB7XG4gICAgdGhpcy5pc0F1dG9Sb3V0aW5nT24gPSBhclN0YXRlO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMuc3RhcnRwb2ludCkge1xuICAgICAgICB0aGlzLnN0YXJ0cG9ydC5yZW1vdmVQb2ludCh0aGlzLnN0YXJ0cG9pbnQpO1xuICAgIH1cbiAgICBpZiAodGhpcy5lbmRwb2ludCkge1xuICAgICAgICB0aGlzLmVuZHBvcnQucmVtb3ZlUG9pbnQodGhpcy5lbmRwb2ludCk7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmFzc2VydFZhbGlkID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBpO1xuXG4gICAgYXNzZXJ0KHRoaXMuc3RhcnRwb3J0cy5sZW5ndGggPiAwLCAnUGF0aCBoYXMgbm8gc3RhcnRwb3J0cyEnKTtcbiAgICBhc3NlcnQodGhpcy5lbmRwb3J0cy5sZW5ndGggPiAwLCAnUGF0aCBoYXMgbm8gZW5kcG9ydHMhJyk7XG5cbiAgICBmb3IgKGkgPSB0aGlzLnN0YXJ0cG9ydHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHRoaXMuc3RhcnRwb3J0c1tpXS5hc3NlcnRWYWxpZCgpO1xuICAgIH1cblxuICAgIGZvciAoaSA9IHRoaXMuZW5kcG9ydHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHRoaXMuZW5kcG9ydHNbaV0uYXNzZXJ0VmFsaWQoKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5pc0F1dG9Sb3V0ZWQoKSkge1xuICAgICAgICBpZiAodGhpcy5pc0Nvbm5lY3RlZCgpKSB7XG4gICAgICAgICAgICBhc3NlcnQodGhpcy5wb2ludHMubGVuZ3RoICE9PSAwLFxuICAgICAgICAgICAgICAgICdBUlBhdGguYXNzZXJ0VmFsaWQ6IHRoaXMucG9pbnRzLmxlbmd0aCAhPT0gMCBGQUlMRUQnKTtcbiAgICAgICAgICAgIHZhciBwb2ludHMgPSB0aGlzLmdldFBvaW50TGlzdCgpO1xuICAgICAgICAgICAgcG9pbnRzLmFzc2VydFZhbGlkKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBJZiBpdCBoYXMgYSBzdGFydHBvaW50LCBtdXN0IGFsc28gaGF2ZSBhIHN0YXJ0cG9ydFxuICAgIGlmICh0aGlzLnN0YXJ0cG9pbnQpIHtcbiAgICAgICAgYXNzZXJ0KHRoaXMuc3RhcnRwb3J0LCAnUGF0aCBoYXMgYSBzdGFydHBvaW50IHdpdGhvdXQgYSBzdGFydHBvcnQnKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuZW5kcG9pbnQpIHtcbiAgICAgICAgYXNzZXJ0KHRoaXMuZW5kcG9ydCwgJ1BhdGggaGFzIGEgZW5kcG9pbnQgd2l0aG91dCBhIGVuZHBvcnQnKTtcbiAgICB9XG5cbiAgICBhc3NlcnQodGhpcy5vd25lciwgJ1BhdGggZG9lcyBub3QgaGF2ZSBvd25lciEnKTtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5hc3NlcnRWYWxpZFBvaW50cyA9IGZ1bmN0aW9uICgpIHtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQXV0b1JvdXRlclBhdGg7XG4iLCIvKmdsb2JhbHMgZGVmaW5lKi9cbi8qanNoaW50IGJyb3dzZXI6IHRydWUsIGJpdHdpc2U6IGZhbHNlKi9cblxuLyoqXG4gKiBAYXV0aG9yIGJyb2xsYiAvIGh0dHBzOi8vZ2l0aHViL2Jyb2xsYlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIEFyU2l6ZSA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5TaXplJyk7XG5cbnZhciBBclBvaW50ID0gZnVuY3Rpb24gKHgsIHkpIHtcbiAgICAvLyBNdWx0aXBsZSBDb25zdHJ1Y3RvcnNcbiAgICBpZiAoeCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHggPSAwO1xuICAgICAgICB5ID0gMDtcbiAgICB9IGVsc2UgaWYgKHkgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICB5ID0geC55O1xuICAgICAgICB4ID0geC54O1xuICAgIH1cblxuICAgIHRoaXMueCA9IHg7XG4gICAgdGhpcy55ID0geTtcbn07XG5cbi8qKlxuICogQ2hlY2sgaWYgdGhlIHBvaW50cyBoYXZlIHRoZSBzYW1lIGNvb3JkaW5hdGVzLlxuICpcbiAqIEBwYXJhbSB7QXJQb2ludH0gb3RoZXJQb2ludFxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqL1xuQXJQb2ludC5wcm90b3R5cGUuZXF1YWxzID0gZnVuY3Rpb24gKG90aGVyUG9pbnQpIHtcbiAgICByZXR1cm4gdGhpcy54ID09PSBvdGhlclBvaW50LnggJiYgdGhpcy55ID09PSBvdGhlclBvaW50Lnk7XG59O1xuXG5BclBvaW50LnByb3RvdHlwZS5zaGlmdCA9IGZ1bmN0aW9uIChvdGhlck9iamVjdCkgeyAvL2VxdWl2YWxlbnQgdG8gKz1cbiAgICB0aGlzLnggKz0gb3RoZXJPYmplY3QuZHg7XG4gICAgdGhpcy55ICs9IG90aGVyT2JqZWN0LmR5O1xuXG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG5BclBvaW50LnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiAob3RoZXJPYmplY3QpIHsgLy9lcXVpdmFsZW50IHRvICs9XG4gICAgaWYgKG90aGVyT2JqZWN0IGluc3RhbmNlb2YgQXJTaXplKSB7XG4gICAgICAgIHRoaXMueCArPSBvdGhlck9iamVjdC5jeDtcbiAgICAgICAgdGhpcy55ICs9IG90aGVyT2JqZWN0LmN5O1xuICAgIH0gZWxzZSBpZiAob3RoZXJPYmplY3QgaW5zdGFuY2VvZiBBclBvaW50KSB7XG4gICAgICAgIHRoaXMueCArPSBvdGhlck9iamVjdC54O1xuICAgICAgICB0aGlzLnkgKz0gb3RoZXJPYmplY3QueTtcbiAgICB9XG59O1xuXG5BclBvaW50LnByb3RvdHlwZS5zdWJ0cmFjdCA9IGZ1bmN0aW9uIChvdGhlck9iamVjdCkgeyAvL2VxdWl2YWxlbnQgdG8gKz1cbiAgICBpZiAob3RoZXJPYmplY3QgaW5zdGFuY2VvZiBBclNpemUpIHtcbiAgICAgICAgdGhpcy54IC09IG90aGVyT2JqZWN0LmN4O1xuICAgICAgICB0aGlzLnkgLT0gb3RoZXJPYmplY3QuY3k7XG4gICAgfSBlbHNlIGlmIChvdGhlck9iamVjdCBpbnN0YW5jZW9mIEFyUG9pbnQpIHtcbiAgICAgICAgdGhpcy54IC09IG90aGVyT2JqZWN0Lng7XG4gICAgICAgIHRoaXMueSAtPSBvdGhlck9iamVjdC55O1xuICAgIH1cbn07XG5cbkFyUG9pbnQucHJvdG90eXBlLnBsdXMgPSBmdW5jdGlvbiAob3RoZXJPYmplY3QpIHsgLy9lcXVpdmFsZW50IHRvICtcbiAgICB2YXIgb2JqZWN0Q29weSA9IG51bGw7XG5cbiAgICBpZiAob3RoZXJPYmplY3QgaW5zdGFuY2VvZiBBclNpemUpIHtcbiAgICAgICAgb2JqZWN0Q29weSA9IG5ldyBBclBvaW50KHRoaXMpO1xuICAgICAgICBvYmplY3RDb3B5LmFkZChvdGhlck9iamVjdCk7XG5cbiAgICB9IGVsc2UgaWYgKG90aGVyT2JqZWN0IGluc3RhbmNlb2YgQXJQb2ludCkge1xuICAgICAgICBvYmplY3RDb3B5ID0gbmV3IEFyUG9pbnQob3RoZXJPYmplY3QpO1xuICAgICAgICBvYmplY3RDb3B5LnggKz0gdGhpcy54O1xuICAgICAgICBvYmplY3RDb3B5LnkgKz0gdGhpcy55O1xuICAgIH1cbiAgICByZXR1cm4gb2JqZWN0Q29weSB8fCB1bmRlZmluZWQ7XG59O1xuXG5BclBvaW50LnByb3RvdHlwZS5taW51cyA9IGZ1bmN0aW9uIChvdGhlck9iamVjdCkge1xuICAgIHZhciBvYmplY3RDb3B5ID0gbmV3IEFyUG9pbnQob3RoZXJPYmplY3QpO1xuXG4gICAgaWYgKG90aGVyT2JqZWN0LmN4ICE9PSB1bmRlZmluZWQgJiYgb3RoZXJPYmplY3QuY3kgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBvYmplY3RDb3B5LnN1YnRyYWN0KHRoaXMpO1xuXG4gICAgfSBlbHNlIGlmIChvdGhlck9iamVjdC54ICE9PSB1bmRlZmluZWQgJiYgb3RoZXJPYmplY3QueSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIG9iamVjdENvcHkgPSBuZXcgQXJTaXplKCk7XG4gICAgICAgIG9iamVjdENvcHkuY3ggPSB0aGlzLnggLSBvdGhlck9iamVjdC54O1xuICAgICAgICBvYmplY3RDb3B5LmN5ID0gdGhpcy55IC0gb3RoZXJPYmplY3QueTtcblxuICAgIH1cbiAgICByZXR1cm4gb2JqZWN0Q29weTtcbn07XG5cbkFyUG9pbnQucHJvdG90eXBlLmFzc2lnbiA9IGZ1bmN0aW9uIChvdGhlclBvaW50KSB7XG4gICAgdGhpcy54ID0gb3RoZXJQb2ludC54O1xuICAgIHRoaXMueSA9IG90aGVyUG9pbnQueTtcblxuICAgIHJldHVybiB0aGlzO1xufTtcblxuQXJQb2ludC5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuICcoJyArIHRoaXMueCArICcsICcgKyB0aGlzLnkgKyAnKSc7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEFyUG9pbnQ7XG4iLCIvKmpzaGludCBub2RlOiB0cnVlLCBiaXR3aXNlOiBmYWxzZSovXG5cbi8qKlxuICogQGF1dGhvciBicm9sbGIgLyBodHRwczovL2dpdGh1Yi9icm9sbGJcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBMb2dnZXIgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuTG9nZ2VyJyksICAvLyBGSVhNRVxuICAgIENPTlNUQU5UUyA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Db25zdGFudHMnKSxcbiAgICBVdGlscyA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5VdGlscycpLFxuICAgIGFzc2VydCA9IFV0aWxzLmFzc2VydCxcbiAgICBfbG9nZ2VyID0gbmV3IExvZ2dlcignQXV0b1JvdXRlci5Qb2ludExpc3QnKTtcblxudmFyIEFyUG9pbnRMaXN0UGF0aCA9IGZ1bmN0aW9uICgpIHtcbiAgICBmb3IgKHZhciBpID0gYXJndW1lbnRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICB0aGlzLnVuc2hpZnQoYXJndW1lbnRzW2ldKTtcbiAgICB9XG59O1xuXG5BclBvaW50TGlzdFBhdGgucHJvdG90eXBlID0gW107XG5cbi8vIFdyYXBwZXIgRnVuY3Rpb25zXG5BclBvaW50TGlzdFBhdGgucHJvdG90eXBlLmNvbmNhdCA9IGZ1bmN0aW9uIChsaXN0KSB7XG4gICAgdmFyIG5ld1BvaW50cyA9IG5ldyBBclBvaW50TGlzdFBhdGgoKSxcbiAgICAgICAgaTtcblxuICAgIGZvciAoaSA9IDA7IGkgPCB0aGlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIG5ld1BvaW50cy5wdXNoKHRoaXNbaV0pO1xuICAgIH1cblxuICAgIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIG5ld1BvaW50cy5wdXNoKGxpc3RbaV0pO1xuICAgIH1cbiAgICByZXR1cm4gbmV3UG9pbnRzO1xufTtcblxuLy8gRnVuY3Rpb25zXG5cbkFyUG9pbnRMaXN0UGF0aC5wcm90b3R5cGUuZW5kID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzW3RoaXMubGVuZ3RoIC0gMV07XG59O1xuXG5BclBvaW50TGlzdFBhdGgucHJvdG90eXBlLmdldFRhaWxFZGdlID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLmxlbmd0aCA8IDIpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubGVuZ3RoO1xuICAgIH1cblxuICAgIHZhciBwb3MgPSB0aGlzLmxlbmd0aCAtIDEsXG4gICAgICAgIGVuZCA9IHRoaXNbcG9zLS1dLFxuICAgICAgICBzdGFydCA9IHRoaXNbcG9zXTtcblxuICAgIHJldHVybiB7J3Bvcyc6IHBvcywgJ3N0YXJ0Jzogc3RhcnQsICdlbmQnOiBlbmR9O1xufTtcblxuQXJQb2ludExpc3RQYXRoLnByb3RvdHlwZS5nZXRQcmV2RWRnZSA9IGZ1bmN0aW9uIChwb3MsIHN0YXJ0LCBlbmQpIHtcbiAgICBpZiAoQ09OU1RBTlRTLkRFQlVHKSB7XG4gICAgICAgIHRoaXMuQXNzZXJ0VmFsaWRQb3MocG9zKTtcbiAgICB9XG5cbiAgICBlbmQgPSB0aGlzW3Bvcy0tXTtcbiAgICBpZiAocG9zICE9PSB0aGlzLmxlbmd0aCkge1xuICAgICAgICBzdGFydCA9IHRoaXNbcG9zXTtcbiAgICB9XG5cbiAgICByZXR1cm4geydwb3MnOiBwb3MsICdzdGFydCc6IHN0YXJ0LCAnZW5kJzogZW5kfTtcbn07XG5cbkFyUG9pbnRMaXN0UGF0aC5wcm90b3R5cGUuZ2V0RWRnZSA9IGZ1bmN0aW9uIChwb3MsIHN0YXJ0LCBlbmQpIHtcbiAgICBpZiAoQ09OU1RBTlRTLkRFQlVHKSB7XG4gICAgICAgIHRoaXMuQXNzZXJ0VmFsaWRQb3MocG9zKTtcbiAgICB9XG5cbiAgICBzdGFydCA9IHRoaXNbcG9zKytdO1xuICAgIGFzc2VydChwb3MgPCB0aGlzLmxlbmd0aCwgJ0FyUG9pbnRMaXN0UGF0aC5nZXRFZGdlOiBwb3MgPCB0aGlzLmxlbmd0aCBGQUlMRUQnKTtcblxuICAgIGVuZCA9IHRoaXNbcG9zXTtcbn07XG5cbkFyUG9pbnRMaXN0UGF0aC5wcm90b3R5cGUuZ2V0VGFpbEVkZ2VQdHJzID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBwb3MgPSB0aGlzLmxlbmd0aCxcbiAgICAgICAgc3RhcnQsXG4gICAgICAgIGVuZDtcblxuICAgIGlmICh0aGlzLmxlbmd0aCA8IDIpIHtcbiAgICAgICAgcmV0dXJuIHsncG9zJzogcG9zfTtcbiAgICB9XG5cbiAgICBhc3NlcnQoLS1wb3MgPCB0aGlzLmxlbmd0aCwgJ0FyUG9pbnRMaXN0UGF0aC5nZXRUYWlsRWRnZVB0cnM6IC0tcG9zIDwgdGhpcy5sZW5ndGggRkFJTEVEJyk7XG5cbiAgICBlbmQgPSB0aGlzW3Bvcy0tXTtcbiAgICBhc3NlcnQocG9zIDwgdGhpcy5sZW5ndGgsICdBclBvaW50TGlzdFBhdGguZ2V0VGFpbEVkZ2VQdHJzOiBwb3MgPCB0aGlzLmxlbmd0aCBGQUlMRUQnKTtcblxuICAgIHN0YXJ0ID0gdGhpc1twb3NdO1xuXG4gICAgcmV0dXJuIHsncG9zJzogcG9zLCAnc3RhcnQnOiBzdGFydCwgJ2VuZCc6IGVuZH07XG59O1xuXG5BclBvaW50TGlzdFBhdGgucHJvdG90eXBlLmdldFByZXZFZGdlUHRycyA9IGZ1bmN0aW9uIChwb3MpIHtcbiAgICB2YXIgc3RhcnQsXG4gICAgICAgIGVuZDtcblxuICAgIGlmIChDT05TVEFOVFMuREVCVUcpIHtcbiAgICAgICAgdGhpcy5Bc3NlcnRWYWxpZFBvcyhwb3MpO1xuICAgIH1cblxuICAgIGVuZCA9IHRoaXNbcG9zXTtcblxuICAgIGlmIChwb3MtLSA+IDApIHtcbiAgICAgICAgc3RhcnQgPSB0aGlzW3Bvc107XG4gICAgfVxuXG4gICAgcmV0dXJuIHtwb3M6IHBvcywgc3RhcnQ6IHN0YXJ0LCBlbmQ6IGVuZH07XG59O1xuXG5BclBvaW50TGlzdFBhdGgucHJvdG90eXBlLmdldFN0YXJ0UG9pbnQgPSBmdW5jdGlvbiAocG9zKSB7XG4gICAgaWYgKENPTlNUQU5UUy5ERUJVRykge1xuICAgICAgICB0aGlzLkFzc2VydFZhbGlkUG9zKHBvcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXNbcG9zXTtcbn07XG5cbkFyUG9pbnRMaXN0UGF0aC5wcm90b3R5cGUuZ2V0RW5kUG9pbnQgPSBmdW5jdGlvbiAocG9zKSB7XG4gICAgaWYgKENPTlNUQU5UUy5ERUJVRykge1xuICAgICAgICB0aGlzLkFzc2VydFZhbGlkUG9zKHBvcyk7XG4gICAgfVxuXG4gICAgcG9zKys7XG4gICAgYXNzZXJ0KHBvcyA8IHRoaXMubGVuZ3RoLFxuICAgICAgICAnQXJQb2ludExpc3RQYXRoLmdldEVuZFBvaW50OiBwb3MgPCB0aGlzLmxlbmd0aCBGQUlMRUQnKTtcblxuICAgIHJldHVybiB0aGlzW3Bvc107XG59O1xuXG5BclBvaW50TGlzdFBhdGgucHJvdG90eXBlLmdldFBvaW50QmVmb3JlRWRnZSA9IGZ1bmN0aW9uIChwb3MpIHtcbiAgICBpZiAoQ09OU1RBTlRTLkRFQlVHKSB7XG4gICAgICAgIHRoaXMuQXNzZXJ0VmFsaWRQb3MocG9zKTtcbiAgICB9XG5cbiAgICBwb3MtLTtcbiAgICBpZiAocG9zID09PSB0aGlzLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpc1twb3NdO1xufTtcblxuQXJQb2ludExpc3RQYXRoLnByb3RvdHlwZS5nZXRQb2ludEFmdGVyRWRnZSA9IGZ1bmN0aW9uIChwb3MpIHtcbiAgICBpZiAoQ09OU1RBTlRTLkRFQlVHKSB7XG4gICAgICAgIHRoaXMuQXNzZXJ0VmFsaWRQb3MocG9zKTtcbiAgICB9XG5cbiAgICBwb3MrKztcbiAgICBhc3NlcnQocG9zIDwgdGhpcy5sZW5ndGgsXG4gICAgICAgICdBclBvaW50TGlzdFBhdGguZ2V0UG9pbnRBZnRlckVkZ2U6IHBvcyA8IHRoaXMubGVuZ3RoIEZBSUxFRCcpO1xuXG4gICAgcG9zKys7XG4gICAgaWYgKHBvcyA9PT0gdGhpcy5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXNbcG9zXTtcbn07XG5cbkFyUG9pbnRMaXN0UGF0aC5wcm90b3R5cGUuYXNzZXJ0VmFsaWQgPSBmdW5jdGlvbiAobXNnKSB7XG4gICAgLy8gQ2hlY2sgdG8gbWFrZSBzdXJlIGVhY2ggcG9pbnQgbWFrZXMgYSBob3Jpem9udGFsL3ZlcnRpY2FsIGxpbmUgd2l0aCBpdCdzIG5laWdoYm9yc1xuICAgIG1zZyA9IG1zZyB8fCAnJztcbiAgICBmb3IgKHZhciBpID0gdGhpcy5sZW5ndGggLSAxOyBpID4gMDsgaS0tKSB7XG4gICAgICAgIGFzc2VydCghIXRoaXNbaV0ubWludXMsICdCYWQgdmFsdWUgYXQgcG9zaXRpb24gJyArIGkgKyAnICgnICsgVXRpbHMuc3RyaW5naWZ5KHRoaXNbaV0pICsgJyknKTtcbiAgICAgICAgYXNzZXJ0KCEhdGhpc1tpIC0gMV0ubWludXMsICdCYWQgdmFsdWUgYXQgcG9zaXRpb24gJyArIChpIC0gMSkgKyAnICgnICsgVXRpbHMuc3RyaW5naWZ5KHRoaXNbaSAtIDFdKSArICcpJyk7XG5cbiAgICAgICAgYXNzZXJ0KFV0aWxzLmlzUmlnaHRBbmdsZShVdGlscy5nZXREaXIodGhpc1tpIC0gMV0ubWludXModGhpc1tpXSkpKSxcbiAgICAgICAgICAgIG1zZyArICdcXG5cXHRBclBvaW50TGlzdFBhdGggY29udGFpbnMgc2tldyBlZGdlOlxcbicgKyBVdGlscy5zdHJpbmdpZnkodGhpcykpO1xuICAgIH1cbn07XG5cbkFyUG9pbnRMaXN0UGF0aC5wcm90b3R5cGUuYXNzZXJ0VmFsaWRQb3MgPSBmdW5jdGlvbiAocG9zKSB7XG4gICAgYXNzZXJ0KHBvcyA8IHRoaXMubGVuZ3RoLCAnQXJQb2ludExpc3RQYXRoLmFzc2VydFZhbGlkUG9zOiBwb3MgPCB0aGlzLmxlbmd0aCBGQUlMRUQnKTtcbn07XG5cbkFyUG9pbnRMaXN0UGF0aC5wcm90b3R5cGUuZHVtcFBvaW50cyA9IGZ1bmN0aW9uIChtc2cpIHtcbiAgICBtc2cgKz0gJywgcG9pbnRzIGR1bXAgYmVnaW46XFxuJztcbiAgICB2YXIgcG9zID0gMCxcbiAgICAgICAgaSA9IDAsXG4gICAgICAgIHA7XG4gICAgd2hpbGUgKHBvcyA8IHRoaXMubGVuZ3RoKSB7XG4gICAgICAgIHAgPSB0aGlzW3BvcysrXTtcbiAgICAgICAgbXNnICs9IGkgKyAnLjogKCcgKyBwLnggKyAnLCAnICsgcC55ICsgJylcXG4nO1xuICAgICAgICBpKys7XG4gICAgfVxuICAgIG1zZyArPSAncG9pbnRzIGR1bXAgZW5kLic7XG4gICAgX2xvZ2dlci5kZWJ1Zyhtc2cpO1xuICAgIHJldHVybiBtc2c7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEFyUG9pbnRMaXN0UGF0aDtcblxuIiwiLypqc2hpbnQgbm9kZTogdHJ1ZSwgYml0d2lzZTogZmFsc2UqL1xuXG4vKipcbiAqIEBhdXRob3IgYnJvbGxiIC8gaHR0cHM6Ly9naXRodWIvYnJvbGxiXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgQ09OU1RBTlRTID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLkNvbnN0YW50cycpLFxuICAgIFV0aWxzID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlV0aWxzJyksXG4gICAgYXNzZXJ0ID0gVXRpbHMuYXNzZXJ0LFxuICAgIEFyUG9pbnQgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUG9pbnQnKSxcbiAgICBBclNpemUgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuU2l6ZScpLFxuICAgIEFyUmVjdCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5SZWN0Jyk7XG5cbnZhciBBdXRvUm91dGVyUG9ydCA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmlkID0gbnVsbDtcbiAgICB0aGlzLm93bmVyID0gbnVsbDtcbiAgICB0aGlzLmxpbWl0ZWREaXJlY3Rpb25zID0gdHJ1ZTtcbiAgICB0aGlzLnJlY3QgPSBuZXcgQXJSZWN0KCk7XG4gICAgdGhpcy5hdHRyaWJ1dGVzID0gQ09OU1RBTlRTLlBvcnREZWZhdWx0O1xuXG4gICAgLy8gRm9yIHRoaXMucG9pbnRzIG9uIENPTlNUQU5UUy5EaXJUb3AsIENPTlNUQU5UUy5EaXJMZWZ0LCBDT05TVEFOVFMuRGlyUmlnaHQsIGV0Y1xuICAgIHRoaXMucG9pbnRzID0gW1tdLCBbXSwgW10sIFtdXTtcbiAgICB0aGlzLnNlbGZQb2ludHMgPSBbXTtcbiAgICB0aGlzLmF2YWlsYWJsZUFyZWEgPSBbXTsgIC8vIGF2YWlsYWJsZUFyZWFzIGtlZXBzIHRyYWNrIG9mIHZpc2libGUgKG5vdCBvdmVybGFwcGVkKSBwb3J0aW9ucyBvZiB0aGUgcG9ydFxuXG4gICAgdGhpcy5jYWxjdWxhdGVTZWxmUG9pbnRzKCk7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuY2FsY3VsYXRlU2VsZlBvaW50cyA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLnNlbGZQb2ludHMgPSBbXTtcbiAgICB0aGlzLnNlbGZQb2ludHMucHVzaChuZXcgQXJQb2ludCh0aGlzLnJlY3QuZ2V0VG9wTGVmdCgpKSk7XG5cbiAgICB0aGlzLnNlbGZQb2ludHMucHVzaChuZXcgQXJQb2ludCh0aGlzLnJlY3QucmlnaHQsIHRoaXMucmVjdC5jZWlsKSk7XG4gICAgdGhpcy5zZWxmUG9pbnRzLnB1c2gobmV3IEFyUG9pbnQodGhpcy5yZWN0LnJpZ2h0LCB0aGlzLnJlY3QuZmxvb3IpKTtcbiAgICB0aGlzLnNlbGZQb2ludHMucHVzaChuZXcgQXJQb2ludCh0aGlzLnJlY3QubGVmdCwgdGhpcy5yZWN0LmZsb29yKSk7XG4gICAgdGhpcy5yZXNldEF2YWlsYWJsZUFyZWEoKTtcbn07XG5cbkF1dG9Sb3V0ZXJQb3J0LnByb3RvdHlwZS5oYXNPd25lciA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5vd25lciAhPT0gbnVsbDtcbn07XG5cbkF1dG9Sb3V0ZXJQb3J0LnByb3RvdHlwZS5pc1JlY3RFbXB0eSA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5yZWN0LmlzUmVjdEVtcHR5KCk7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuZ2V0Q2VudGVyID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLnJlY3QuZ2V0Q2VudGVyUG9pbnQoKTtcbn07XG5cbkF1dG9Sb3V0ZXJQb3J0LnByb3RvdHlwZS5zZXRSZWN0ID0gZnVuY3Rpb24gKHIpIHtcbiAgICBhc3NlcnQoci5nZXRXaWR0aCgpID49IDMgJiYgci5nZXRIZWlnaHQoKSA+PSAzLFxuICAgICAgICAnQVJQb3J0LnNldFJlY3Q6IHIuZ2V0V2lkdGgoKSA+PSAzICYmIHIuZ2V0SGVpZ2h0KCkgPj0gMyBGQUlMRUQhJyk7XG5cbiAgICB0aGlzLnJlY3QuYXNzaWduKHIpO1xuICAgIHRoaXMuY2FsY3VsYXRlU2VsZlBvaW50cygpO1xuICAgIHRoaXMucmVzZXRBdmFpbGFibGVBcmVhKCk7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuc2hpZnRCeSA9IGZ1bmN0aW9uIChvZmZzZXQpIHtcbiAgICBhc3NlcnQoIXRoaXMucmVjdC5pc1JlY3RFbXB0eSgpLCAnQVJQb3J0LnNoaWZ0Qnk6ICF0aGlzLnJlY3QuaXNSZWN0RW1wdHkoKSBGQUlMRUQhJyk7XG5cbiAgICB0aGlzLnJlY3QuYWRkKG9mZnNldCk7XG5cbiAgICB0aGlzLmNhbGN1bGF0ZVNlbGZQb2ludHMoKTtcbiAgICAvLyBTaGlmdCBwb2ludHNcbiAgICB0aGlzLnNoaWZ0UG9pbnRzKG9mZnNldCk7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuaXNDb25uZWN0VG9DZW50ZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuICh0aGlzLmF0dHJpYnV0ZXMgJiBDT05TVEFOVFMuUG9ydENvbm5lY3RUb0NlbnRlcikgIT09IDA7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuaGFzTGltaXRlZERpcnMgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMubGltaXRlZERpcmVjdGlvbnM7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuc2V0TGltaXRlZERpcnMgPSBmdW5jdGlvbiAobHRkKSB7XG4gICAgdGhpcy5saW1pdGVkRGlyZWN0aW9ucyA9IGx0ZDtcbn07XG5cbkF1dG9Sb3V0ZXJQb3J0LnByb3RvdHlwZS5wb3J0T25XaGljaEVkZ2UgPSBmdW5jdGlvbiAocG9pbnQpIHtcbiAgICByZXR1cm4gVXRpbHMub25XaGljaEVkZ2UodGhpcy5yZWN0LCBwb2ludCk7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuY2FuSGF2ZVN0YXJ0RW5kUG9pbnRPbiA9IGZ1bmN0aW9uIChkaXIsIGlzU3RhcnQpIHtcbiAgICBhc3NlcnQoMCA8PSBkaXIgJiYgZGlyIDw9IDMsICdBUlBvcnQuY2FuSGF2ZVN0YXJ0RW5kUG9pbnRPbjogMCA8PSBkaXIgJiYgZGlyIDw9IDMgRkFJTEVEIScpO1xuXG4gICAgaWYgKGlzU3RhcnQpIHtcbiAgICAgICAgZGlyICs9IDQ7XG4gICAgfVxuXG4gICAgcmV0dXJuICgodGhpcy5hdHRyaWJ1dGVzICYgKDEgPDwgZGlyKSkgIT09IDApO1xufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLmNhbkhhdmVTdGFydEVuZFBvaW50ID0gZnVuY3Rpb24gKGlzU3RhcnQpIHtcbiAgICByZXR1cm4gKCh0aGlzLmF0dHJpYnV0ZXMgJiAoaXNTdGFydCA/IENPTlNUQU5UUy5Qb3J0U3RhcnRPbkFsbCA6IENPTlNUQU5UUy5Qb3J0RW5kT25BbGwpKSAhPT0gMCk7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuY2FuSGF2ZVN0YXJ0RW5kUG9pbnRIb3Jpem9udGFsID0gZnVuY3Rpb24gKGlzSG9yaXpvbnRhbCkge1xuICAgIHJldHVybiAoKHRoaXMuYXR0cmlidXRlcyAmXG4gICAgKGlzSG9yaXpvbnRhbCA/IENPTlNUQU5UUy5Qb3J0U3RhcnRFbmRIb3Jpem9udGFsIDogQ09OU1RBTlRTLlBvcnRTdGFydEVuZFZlcnRpY2FsKSkgIT09IDApO1xufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLmdldFN0YXJ0RW5kRGlyVG8gPSBmdW5jdGlvbiAocG9pbnQsIGlzU3RhcnQsIG5vdHRoaXMpIHtcbiAgICBhc3NlcnQoIXRoaXMucmVjdC5pc1JlY3RFbXB0eSgpLCAnQVJQb3J0LmdldFN0YXJ0RW5kRGlyVG86ICF0aGlzLnJlY3QuaXNSZWN0RW1wdHkoKSBGQUlMRUQhJyk7XG5cbiAgICBub3R0aGlzID0gbm90dGhpcyA/IG5vdHRoaXMgOiBDT05TVEFOVFMuRGlyTm9uZTsgLy8gaWYgbm90dGhpcyBpcyB1bmRlZmluZWQsIHNldCBpdCB0byBDT05TVEFOVFMuRGlyTm9uZSAoLTEpXG5cbiAgICB2YXIgb2Zmc2V0ID0gcG9pbnQubWludXModGhpcy5yZWN0LmdldENlbnRlclBvaW50KCkpLFxuICAgICAgICBkaXIxID0gVXRpbHMuZ2V0TWFqb3JEaXIob2Zmc2V0KTtcblxuICAgIGlmIChkaXIxICE9PSBub3R0aGlzICYmIHRoaXMuY2FuSGF2ZVN0YXJ0RW5kUG9pbnRPbihkaXIxLCBpc1N0YXJ0KSkge1xuICAgICAgICByZXR1cm4gZGlyMTtcbiAgICB9XG5cbiAgICB2YXIgZGlyMiA9IFV0aWxzLmdldE1pbm9yRGlyKG9mZnNldCk7XG5cbiAgICBpZiAoZGlyMiAhPT0gbm90dGhpcyAmJiB0aGlzLmNhbkhhdmVTdGFydEVuZFBvaW50T24oZGlyMiwgaXNTdGFydCkpIHtcbiAgICAgICAgcmV0dXJuIGRpcjI7XG4gICAgfVxuXG4gICAgdmFyIGRpcjMgPSBVdGlscy5yZXZlcnNlRGlyKGRpcjIpO1xuXG4gICAgaWYgKGRpcjMgIT09IG5vdHRoaXMgJiYgdGhpcy5jYW5IYXZlU3RhcnRFbmRQb2ludE9uKGRpcjMsIGlzU3RhcnQpKSB7XG4gICAgICAgIHJldHVybiBkaXIzO1xuICAgIH1cblxuICAgIHZhciBkaXI0ID0gVXRpbHMucmV2ZXJzZURpcihkaXIxKTtcblxuICAgIGlmIChkaXI0ICE9PSBub3R0aGlzICYmIHRoaXMuY2FuSGF2ZVN0YXJ0RW5kUG9pbnRPbihkaXI0LCBpc1N0YXJ0KSkge1xuICAgICAgICByZXR1cm4gZGlyNDtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5jYW5IYXZlU3RhcnRFbmRQb2ludE9uKGRpcjEsIGlzU3RhcnQpKSB7XG4gICAgICAgIHJldHVybiBkaXIxO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmNhbkhhdmVTdGFydEVuZFBvaW50T24oZGlyMiwgaXNTdGFydCkpIHtcbiAgICAgICAgcmV0dXJuIGRpcjI7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuY2FuSGF2ZVN0YXJ0RW5kUG9pbnRPbihkaXIzLCBpc1N0YXJ0KSkge1xuICAgICAgICByZXR1cm4gZGlyMztcbiAgICB9XG5cbiAgICBpZiAodGhpcy5jYW5IYXZlU3RhcnRFbmRQb2ludE9uKGRpcjQsIGlzU3RhcnQpKSB7XG4gICAgICAgIHJldHVybiBkaXI0O1xuICAgIH1cblxuICAgIHJldHVybiBDT05TVEFOVFMuRGlyVG9wO1xufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLnJvdW5kVG9IYWxmR3JpZCA9IGZ1bmN0aW9uIChsZWZ0LCByaWdodCkge1xuICAgIHZhciBidHduID0gKGxlZnQgKyByaWdodCkgLyAyO1xuICAgIGFzc2VydChidHduIDwgTWF0aC5tYXgobGVmdCwgcmlnaHQpICYmIGJ0d24gPiBNYXRoLm1pbihsZWZ0LCByaWdodCksXG4gICAgICAgICdyb3VuZFRvSGFsZkdyaWQ6IGJ0d24gdmFyaWFibGUgbm90IGJldHdlZW4gbGVmdCwgcmlnaHQgdmFsdWVzLiBQZXJoYXBzIGJveC9jb25uZWN0aW9uQXJlYSBpcyB0b28gc21hbGw/Jyk7XG4gICAgcmV0dXJuIGJ0d247XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuY3JlYXRlU3RhcnRFbmRQb2ludFRvID0gZnVuY3Rpb24gKHBvaW50LCBkaXIpIHtcbiAgICAvLyBjYWxjdWxhdGUgcGF0aEFuZ2xlXG4gICAgdmFyIGR4ID0gcG9pbnQueCAtIHRoaXMuZ2V0Q2VudGVyKCkueCxcbiAgICAgICAgZHkgPSBwb2ludC55IC0gdGhpcy5nZXRDZW50ZXIoKS55LFxuICAgICAgICBwYXRoQW5nbGUgPSBNYXRoLmF0YW4yKC1keSwgZHgpLFxuICAgICAgICBrID0gMCxcbiAgICAgICAgbWF4WCA9IHRoaXMucmVjdC5yaWdodCxcbiAgICAgICAgbWF4WSA9IHRoaXMucmVjdC5mbG9vcixcbiAgICAgICAgbWluWCA9IHRoaXMucmVjdC5sZWZ0LFxuICAgICAgICBtaW5ZID0gdGhpcy5yZWN0LmNlaWwsXG4gICAgICAgIHJlc3VsdFBvaW50LFxuICAgICAgICBzbWFsbGVyUHQgPSBuZXcgQXJQb2ludChtaW5YLCBtaW5ZKSwgIC8vIFRoZSB0aGlzLnBvaW50cyB0aGF0IHRoZSByZXN1bHRQb2ludCBpcyBjZW50ZXJlZCBiZXR3ZWVuXG4gICAgICAgIGxhcmdlclB0ID0gbmV3IEFyUG9pbnQobWF4WCwgbWF4WSk7XG5cbiAgICAvLyBGaW5kIHRoZSBzbWFsbGVyIGFuZCBsYXJnZXIgcG9pbnRzXG4gICAgLy8gQXMgdGhlIHBvaW50cyBjYW5ub3QgYmUgb24gdGhlIGNvcm5lciBvZiBhbiBlZGdlIChhbWJpZ3VvdXMgZGlyZWN0aW9uKSwgXG4gICAgLy8gd2Ugd2lsbCBzaGlmdCB0aGUgbWluLCBtYXggaW4gb25lIHBpeGVsXG4gICAgaWYgKFV0aWxzLmlzSG9yaXpvbnRhbChkaXIpKSB7ICAvLyBzaGlmdCB4IGNvb3JkaW5hdGVzXG4gICAgICAgIG1pblgrKztcbiAgICAgICAgbWF4WC0tO1xuICAgIH0gZWxzZSB7IC8vIHNoaWZ0IHkgY29vcmRpbmF0ZXNcbiAgICAgICAgbWluWSsrO1xuICAgICAgICBtYXhZLS07XG4gICAgfVxuXG4gICAgLy8gQWRqdXN0IGFuZ2xlIGJhc2VkIG9uIHBhcnQgb2YgcG9ydCB0byB3aGljaCBpdCBpcyBjb25uZWN0aW5nXG4gICAgc3dpdGNoIChkaXIpIHtcblxuICAgICAgICBjYXNlIENPTlNUQU5UUy5EaXJUb3A6XG4gICAgICAgICAgICBwYXRoQW5nbGUgPSAyICogTWF0aC5QSSAtIChwYXRoQW5nbGUgKyBNYXRoLlBJIC8gMik7XG4gICAgICAgICAgICBsYXJnZXJQdC55ID0gdGhpcy5yZWN0LmNlaWw7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlIENPTlNUQU5UUy5EaXJSaWdodDpcbiAgICAgICAgICAgIHBhdGhBbmdsZSA9IDIgKiBNYXRoLlBJIC0gcGF0aEFuZ2xlO1xuICAgICAgICAgICAgc21hbGxlclB0LnggPSB0aGlzLnJlY3QucmlnaHQ7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlIENPTlNUQU5UUy5EaXJCb3R0b206XG4gICAgICAgICAgICBwYXRoQW5nbGUgLT0gTWF0aC5QSSAvIDI7XG4gICAgICAgICAgICBzbWFsbGVyUHQueSA9IHRoaXMucmVjdC5mbG9vcjtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgQ09OU1RBTlRTLkRpckxlZnQ6XG4gICAgICAgICAgICBsYXJnZXJQdC54ID0gdGhpcy5yZWN0LmxlZnQ7XG4gICAgICAgICAgICBicmVhaztcbiAgICB9XG5cbiAgICBpZiAocGF0aEFuZ2xlIDwgMCkge1xuICAgICAgICBwYXRoQW5nbGUgKz0gMiAqIE1hdGguUEk7XG4gICAgfVxuXG4gICAgcGF0aEFuZ2xlICo9IDE4MCAvIE1hdGguUEk7ICAvLyBVc2luZyBkZWdyZWVzIGZvciBlYXNpZXIgZGVidWdnaW5nXG5cbiAgICAvLyBGaW5kaW5nIHRoaXMucG9pbnRzIG9yZGVyaW5nXG4gICAgd2hpbGUgKGsgPCB0aGlzLnBvaW50c1tkaXJdLmxlbmd0aCAmJiBwYXRoQW5nbGUgPiB0aGlzLnBvaW50c1tkaXJdW2tdLnBhdGhBbmdsZSkge1xuICAgICAgICBrKys7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMucG9pbnRzW2Rpcl0ubGVuZ3RoKSB7XG4gICAgICAgIGlmIChrID09PSAwKSB7XG4gICAgICAgICAgICBsYXJnZXJQdCA9IG5ldyBBclBvaW50KHRoaXMucG9pbnRzW2Rpcl1ba10pO1xuXG4gICAgICAgIH0gZWxzZSBpZiAoayAhPT0gdGhpcy5wb2ludHNbZGlyXS5sZW5ndGgpIHtcbiAgICAgICAgICAgIHNtYWxsZXJQdCA9IG5ldyBBclBvaW50KHRoaXMucG9pbnRzW2Rpcl1bayAtIDFdKTtcbiAgICAgICAgICAgIGxhcmdlclB0ID0gbmV3IEFyUG9pbnQodGhpcy5wb2ludHNbZGlyXVtrXSk7XG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNtYWxsZXJQdCA9IG5ldyBBclBvaW50KHRoaXMucG9pbnRzW2Rpcl1bayAtIDFdKTtcblxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVzdWx0UG9pbnQgPSBuZXcgQXJQb2ludCgobGFyZ2VyUHQueCArIHNtYWxsZXJQdC54KSAvIDIsIChsYXJnZXJQdC55ICsgc21hbGxlclB0LnkpIC8gMik7XG4gICAgcmVzdWx0UG9pbnQucGF0aEFuZ2xlID0gcGF0aEFuZ2xlO1xuXG4gICAgLy8gTW92ZSB0aGUgcG9pbnQgb3ZlciB0byBhbiAndGhpcy5hdmFpbGFibGVBcmVhJyBpZiBhcHByb3ByaWF0ZVxuICAgIHZhciBpID0gdGhpcy5hdmFpbGFibGVBcmVhLmxlbmd0aCxcbiAgICAgICAgY2xvc2VzdEFyZWEgPSAwLFxuICAgICAgICBkaXN0YW5jZSA9IEluZmluaXR5LFxuICAgICAgICBzdGFydCxcbiAgICAgICAgZW5kO1xuXG4gICAgLy8gRmluZCBkaXN0YW5jZSBmcm9tIGVhY2ggdGhpcy5hdmFpbGFibGVBcmVhIGFuZCBzdG9yZSBjbG9zZXN0IGluZGV4XG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgICBzdGFydCA9IHRoaXMuYXZhaWxhYmxlQXJlYVtpXVswXTtcbiAgICAgICAgZW5kID0gdGhpcy5hdmFpbGFibGVBcmVhW2ldWzFdO1xuXG4gICAgICAgIGlmIChVdGlscy5pc09uRWRnZShzdGFydCwgZW5kLCByZXN1bHRQb2ludCkpIHtcbiAgICAgICAgICAgIGNsb3Nlc3RBcmVhID0gLTE7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfSBlbHNlIGlmIChVdGlscy5kaXN0YW5jZUZyb21MaW5lKHJlc3VsdFBvaW50LCBzdGFydCwgZW5kKSA8IGRpc3RhbmNlKSB7XG4gICAgICAgICAgICBjbG9zZXN0QXJlYSA9IGk7XG4gICAgICAgICAgICBkaXN0YW5jZSA9IFV0aWxzLmRpc3RhbmNlRnJvbUxpbmUocmVzdWx0UG9pbnQsIHN0YXJ0LCBlbmQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGNsb3Nlc3RBcmVhICE9PSAtMSAmJiB0aGlzLmlzQXZhaWxhYmxlKCkpIHsgLy8gcmVzdWx0UG9pbnQgbmVlZHMgdG8gYmUgbW92ZWQgdG8gdGhlIGNsb3Nlc3QgYXZhaWxhYmxlIGFyZWFcbiAgICAgICAgdmFyIGRpcjIgPSBVdGlscy5nZXREaXIodGhpcy5hdmFpbGFibGVBcmVhW2Nsb3Nlc3RBcmVhXVswXS5taW51cyhyZXN1bHRQb2ludCkpO1xuXG4gICAgICAgIGFzc2VydChVdGlscy5pc1JpZ2h0QW5nbGUoZGlyMiksXG4gICAgICAgICAgICAnQXV0b1JvdXRlclBvcnQuY3JlYXRlU3RhcnRFbmRQb2ludFRvOiBVdGlscy5pc1JpZ2h0QW5nbGUoZGlyMikgRkFJTEVEJyk7XG5cbiAgICAgICAgaWYgKGRpcjIgPT09IENPTlNUQU5UUy5EaXJMZWZ0IHx8IGRpcjIgPT09IENPTlNUQU5UUy5EaXJUb3ApIHsgLy8gVGhlbiByZXN1bHRQb2ludCBtdXN0IGJlIG1vdmVkIHVwXG4gICAgICAgICAgICBsYXJnZXJQdCA9IHRoaXMuYXZhaWxhYmxlQXJlYVtjbG9zZXN0QXJlYV1bMV07XG4gICAgICAgIH0gZWxzZSB7IC8vIFRoZW4gcmVzdWx0UG9pbnQgbXVzdCBiZSBtb3ZlZCBkb3duXG4gICAgICAgICAgICBzbWFsbGVyUHQgPSB0aGlzLmF2YWlsYWJsZUFyZWFbY2xvc2VzdEFyZWFdWzBdO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVzdWx0UG9pbnQgPSBuZXcgQXJQb2ludCgobGFyZ2VyUHQueCArIHNtYWxsZXJQdC54KSAvIDIsIChsYXJnZXJQdC55ICsgc21hbGxlclB0LnkpIC8gMik7XG4gICAgfVxuXG4gICAgdGhpcy5wb2ludHNbZGlyXS5zcGxpY2UoaywgMCwgcmVzdWx0UG9pbnQpO1xuXG4gICAgYXNzZXJ0KFV0aWxzLmlzUmlnaHRBbmdsZSh0aGlzLnBvcnRPbldoaWNoRWRnZShyZXN1bHRQb2ludCkpLFxuICAgICAgICAnQXV0b1JvdXRlclBvcnQuY3JlYXRlU3RhcnRFbmRQb2ludFRvOiBVdGlscy5pc1JpZ2h0QW5nbGUodGhpcy5wb3J0T25XaGljaEVkZ2UocmVzdWx0UG9pbnQpKSBGQUlMRUQnKTtcblxuICAgIHJldHVybiByZXN1bHRQb2ludDtcbn07XG5cbkF1dG9Sb3V0ZXJQb3J0LnByb3RvdHlwZS5yZW1vdmVQb2ludCA9IGZ1bmN0aW9uIChwdCkge1xuICAgIHZhciByZW1vdmVkO1xuXG4gICAgcmVtb3ZlZCA9IFV0aWxzLnJlbW92ZUZyb21BcnJheXMuYXBwbHkobnVsbCwgW3B0XS5jb25jYXQodGhpcy5wb2ludHMpKTtcbn07XG5cbkF1dG9Sb3V0ZXJQb3J0LnByb3RvdHlwZS5oYXNQb2ludCA9IGZ1bmN0aW9uIChwdCkge1xuICAgIHZhciBpID0gMCxcbiAgICAgICAgaztcblxuICAgIHdoaWxlIChpIDwgNCkgeyAvL0NoZWNrIGFsbCBzaWRlcyBmb3IgdGhlIHBvaW50XG4gICAgICAgIGsgPSB0aGlzLnBvaW50c1tpXS5pbmRleE9mKHB0KTtcblxuICAgICAgICBpZiAoayA+IC0xKSB7IC8vSWYgdGhlIHBvaW50IGlzIG9uIHRoaXMgc2lkZSBvZiB0aGUgcG9ydFxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaSsrO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbn07XG5cbkF1dG9Sb3V0ZXJQb3J0LnByb3RvdHlwZS5zaGlmdFBvaW50cyA9IGZ1bmN0aW9uIChzaGlmdCkge1xuICAgIGZvciAodmFyIHMgPSB0aGlzLnBvaW50cy5sZW5ndGg7IHMtLTspIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IHRoaXMucG9pbnRzW3NdLmxlbmd0aDsgaS0tOykge1xuICAgICAgICAgICAgLy8gU2hpZnQgdGhpcyBwb2ludFxuICAgICAgICAgICAgdGhpcy5wb2ludHNbc11baV0uYWRkKHNoaWZ0KTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJQb3J0LnByb3RvdHlwZS5nZXRQb2ludENvdW50ID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBpID0gMCxcbiAgICAgICAgY291bnQgPSAwO1xuXG4gICAgd2hpbGUgKGkgPCA0KSB7IC8vIENoZWNrIGFsbCBzaWRlcyBmb3IgdGhlIHBvaW50XG4gICAgICAgIGNvdW50ICs9IHRoaXMucG9pbnRzW2krK10ubGVuZ3RoO1xuICAgIH1cblxuICAgIHJldHVybiBjb3VudDtcbn07XG5cbkF1dG9Sb3V0ZXJQb3J0LnByb3RvdHlwZS5yZXNldEF2YWlsYWJsZUFyZWEgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5hdmFpbGFibGVBcmVhID0gW107XG5cbiAgICBpZiAodGhpcy5jYW5IYXZlU3RhcnRFbmRQb2ludE9uKENPTlNUQU5UUy5EaXJUb3ApKSB7XG4gICAgICAgIHRoaXMuYXZhaWxhYmxlQXJlYS5wdXNoKFt0aGlzLnJlY3QuZ2V0VG9wTGVmdCgpLCBuZXcgQXJQb2ludCh0aGlzLnJlY3QucmlnaHQsIHRoaXMucmVjdC5jZWlsKV0pO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmNhbkhhdmVTdGFydEVuZFBvaW50T24oQ09OU1RBTlRTLkRpclJpZ2h0KSkge1xuICAgICAgICB0aGlzLmF2YWlsYWJsZUFyZWEucHVzaChbbmV3IEFyUG9pbnQodGhpcy5yZWN0LnJpZ2h0LCB0aGlzLnJlY3QuY2VpbCksIHRoaXMucmVjdC5nZXRCb3R0b21SaWdodCgpXSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuY2FuSGF2ZVN0YXJ0RW5kUG9pbnRPbihDT05TVEFOVFMuRGlyQm90dG9tKSkge1xuICAgICAgICB0aGlzLmF2YWlsYWJsZUFyZWEucHVzaChbbmV3IEFyUG9pbnQodGhpcy5yZWN0LmxlZnQsIHRoaXMucmVjdC5mbG9vciksIHRoaXMucmVjdC5nZXRCb3R0b21SaWdodCgpXSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuY2FuSGF2ZVN0YXJ0RW5kUG9pbnRPbihDT05TVEFOVFMuRGlyTGVmdCkpIHtcbiAgICAgICAgdGhpcy5hdmFpbGFibGVBcmVhLnB1c2goW3RoaXMucmVjdC5nZXRUb3BMZWZ0KCksIG5ldyBBclBvaW50KHRoaXMucmVjdC5sZWZ0LCB0aGlzLnJlY3QuZmxvb3IpXSk7XG4gICAgfVxuXG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuYWRqdXN0QXZhaWxhYmxlQXJlYSA9IGZ1bmN0aW9uIChyKSB7XG4gICAgLy9Gb3IgYWxsIGxpbmVzIHNwZWNpZmllZCBpbiBhdmFpbGFibGVBcmVhcywgY2hlY2sgaWYgdGhlIGxpbmUgVXRpbHMuaW50ZXJzZWN0IHMgdGhlIHJlY3RhbmdsZVxuICAgIC8vSWYgaXQgZG9lcywgcmVtb3ZlIHRoZSBwYXJ0IG9mIHRoZSBsaW5lIHRoYXQgVXRpbHMuaW50ZXJzZWN0IHMgdGhlIHJlY3RhbmdsZVxuICAgIGlmICghdGhpcy5yZWN0LnRvdWNoaW5nKHIpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgaSA9IHRoaXMuYXZhaWxhYmxlQXJlYS5sZW5ndGgsXG4gICAgICAgIGludGVyc2VjdGlvbixcbiAgICAgICAgbGluZTtcblxuICAgIHdoaWxlIChpLS0pIHtcblxuICAgICAgICBpZiAoVXRpbHMuaXNMaW5lQ2xpcFJlY3QodGhpcy5hdmFpbGFibGVBcmVhW2ldWzBdLCB0aGlzLmF2YWlsYWJsZUFyZWFbaV1bMV0sIHIpKSB7XG4gICAgICAgICAgICBsaW5lID0gdGhpcy5hdmFpbGFibGVBcmVhLnNwbGljZShpLCAxKVswXTtcbiAgICAgICAgICAgIGludGVyc2VjdGlvbiA9IFV0aWxzLmdldExpbmVDbGlwUmVjdEludGVyc2VjdChsaW5lWzBdLCBsaW5lWzFdLCByKTtcblxuICAgICAgICAgICAgaWYgKCFpbnRlcnNlY3Rpb25bMF0uZXF1YWxzKGxpbmVbMF0pKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hdmFpbGFibGVBcmVhLnB1c2goW2xpbmVbMF0sIGludGVyc2VjdGlvblswXV0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIWludGVyc2VjdGlvblsxXS5lcXVhbHMobGluZVsxXSkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmF2YWlsYWJsZUFyZWEucHVzaChbaW50ZXJzZWN0aW9uWzFdLCBsaW5lWzFdXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuZ2V0VG90YWxBdmFpbGFibGVBcmVhID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBpID0gdGhpcy5hdmFpbGFibGVBcmVhLmxlbmd0aCxcbiAgICAgICAgbGVuZ3RoID0gbmV3IEFyU2l6ZSgpO1xuXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgICBsZW5ndGguYWRkKHRoaXMuYXZhaWxhYmxlQXJlYVtpXVsxXS5taW51cyh0aGlzLmF2YWlsYWJsZUFyZWFbaV1bMF0pKTtcbiAgICB9XG5cbiAgICBhc3NlcnQobGVuZ3RoLmN4ID09PSAwIHx8IGxlbmd0aC5jeSA9PT0gMCxcbiAgICAgICAgJ0FSUG9ydC5nZXRUb3RhbEF2YWlsYWJsZUFyZWE6IGxlbmd0aFswXSA9PT0gMCB8fCBsZW5ndGhbMV0gPT09IDAgRkFJTEVEJyk7XG4gICAgcmV0dXJuIGxlbmd0aC5jeCB8fCBsZW5ndGguY3k7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuaXNBdmFpbGFibGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuYXZhaWxhYmxlQXJlYS5sZW5ndGggPiAwO1xufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLmFzc2VydFZhbGlkID0gZnVuY3Rpb24gKCkge1xuICAgIC8vIENoZWNrIHRoYXQgYWxsIHBvaW50cyBhcmUgb24gYSBzaWRlIG9mIHRoZSBwb3J0XG4gICAgdmFyIHBvaW50O1xuXG4gICAgYXNzZXJ0KHRoaXMub3duZXIsICdQb3J0ICcgKyB0aGlzLmlkICsgJyBkb2VzIG5vdCBoYXZlIHZhbGlkIG93bmVyIScpO1xuICAgIGZvciAodmFyIHMgPSB0aGlzLnBvaW50cy5sZW5ndGg7IHMtLTspIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IHRoaXMucG9pbnRzW3NdLmxlbmd0aDsgaS0tOykge1xuICAgICAgICAgICAgcG9pbnQgPSB0aGlzLnBvaW50c1tzXVtpXTtcbiAgICAgICAgICAgIGFzc2VydChVdGlscy5pc1JpZ2h0QW5nbGUodGhpcy5wb3J0T25XaGljaEVkZ2UocG9pbnQpKSxcbiAgICAgICAgICAgICAgICAnQXV0b1JvdXRlclBvcnQuY3JlYXRlU3RhcnRFbmRQb2ludFRvOiBVdGlscy5pc1JpZ2h0QW5nbGUodGhpcy5wb3J0T25XaGljaEVkZ2UocmVzdWx0UG9pbnQpKScgK1xuICAgICAgICAgICAgICAgICcgRkFJTEVEJyk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcbiAgICAvLyBSZW1vdmUgYWxsIHBvaW50cyBhbmQgc2VsZiBmcm9tIGFsbCBwYXRoc1xuICAgIHZhciBwb2ludCxcbiAgICAgICAgcGF0aDtcblxuICAgIHRoaXMub3duZXIgPSBudWxsO1xuICAgIGZvciAodmFyIGkgPSB0aGlzLnBvaW50cy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgZm9yICh2YXIgaiA9IHRoaXMucG9pbnRzW2ldLmxlbmd0aDsgai0tOykge1xuICAgICAgICAgICAgcG9pbnQgPSB0aGlzLnBvaW50c1tpXVtqXTtcbiAgICAgICAgICAgIHBhdGggPSBwb2ludC5vd25lcjtcbiAgICAgICAgICAgIGFzc2VydChwYXRoLCAnc3RhcnQvZW5kIHBvaW50IGRvZXMgbm90IGhhdmUgYW4gb3duZXIhJyk7XG4gICAgICAgICAgICBwYXRoLnJlbW92ZVBvcnQodGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLnBvaW50cyA9IFtbXSwgW10sIFtdLCBbXV07XG5cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQXV0b1JvdXRlclBvcnQ7XG4iLCIvKmpzaGludCBub2RlOiB0cnVlKi9cblxuLyoqXG4gKiBAYXV0aG9yIGJyb2xsYiAvIGh0dHBzOi8vZ2l0aHViL2Jyb2xsYlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIGRlYnVnID0gcmVxdWlyZSgnZGVidWcnKSxcbiAgICBBclBvaW50ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlBvaW50JyksXG4gICAgQXJTaXplID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlNpemUnKSxcbiAgICBMb2dnZXIgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuTG9nZ2VyJyksXG4gICAgX2xvZ2dlciA9IG5ldyBMb2dnZXIoJ0F1dG9Sb3V0ZXIuUmVjdCcpO1xuXG52YXIgQXJSZWN0ID0gZnVuY3Rpb24gKExlZnQsIENlaWwsIFJpZ2h0LCBGbG9vcikge1xuICAgIGlmIChMZWZ0ID09PSB1bmRlZmluZWQpIHsgLy9ObyBhcmd1bWVudHNcbiAgICAgICAgTGVmdCA9IDA7XG4gICAgICAgIENlaWwgPSAwO1xuICAgICAgICBSaWdodCA9IDA7XG4gICAgICAgIEZsb29yID0gMDtcblxuICAgIH0gZWxzZSBpZiAoQ2VpbCA9PT0gdW5kZWZpbmVkICYmIExlZnQgaW5zdGFuY2VvZiBBclJlY3QpIHsgLy8gT25lIGFyZ3VtZW50XG4gICAgICAgIC8vIExlZnQgaXMgYW4gQXJSZWN0XG4gICAgICAgIENlaWwgPSBMZWZ0LmNlaWw7XG4gICAgICAgIFJpZ2h0ID0gTGVmdC5yaWdodDtcbiAgICAgICAgRmxvb3IgPSBMZWZ0LmZsb29yO1xuICAgICAgICBMZWZ0ID0gTGVmdC5sZWZ0O1xuXG4gICAgfSBlbHNlIGlmIChSaWdodCA9PT0gdW5kZWZpbmVkICYmIExlZnQgaW5zdGFuY2VvZiBBclBvaW50KSB7IC8vIFR3byBhcmd1bWVudHNcbiAgICAgICAgLy8gQ3JlYXRpbmcgQXJSZWN0IHdpdGggQXJQb2ludCBhbmQgZWl0aGVyIGFub3RoZXIgQXJQb2ludCBvciBBclNpemVcbiAgICAgICAgaWYgKENlaWwgaW5zdGFuY2VvZiBBclNpemUpIHtcbiAgICAgICAgICAgIFJpZ2h0ID0gTGVmdC54ICsgQ2VpbC5jeDtcbiAgICAgICAgICAgIEZsb29yID0gTGVmdC55ICsgQ2VpbC5jeTtcbiAgICAgICAgICAgIENlaWwgPSBMZWZ0Lnk7XG4gICAgICAgICAgICBMZWZ0ID0gTGVmdC54O1xuXG4gICAgICAgIH0gZWxzZSBpZiAoTGVmdCBpbnN0YW5jZW9mIEFyUG9pbnQgJiYgQ2VpbCBpbnN0YW5jZW9mIEFyUG9pbnQpIHtcbiAgICAgICAgICAgIFJpZ2h0ID0gTWF0aC5yb3VuZChDZWlsLngpO1xuICAgICAgICAgICAgRmxvb3IgPSBNYXRoLnJvdW5kKENlaWwueSk7XG4gICAgICAgICAgICBDZWlsID0gTWF0aC5yb3VuZChMZWZ0LnkpO1xuICAgICAgICAgICAgTGVmdCA9IE1hdGgucm91bmQoTGVmdC54KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBBclJlY3QgQ29uc3RydWN0b3InKTtcbiAgICAgICAgfVxuXG4gICAgfSBlbHNlIGlmIChGbG9vciA9PT0gdW5kZWZpbmVkKSB7IC8vIEludmFsaWRcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIEFyUmVjdCBDb25zdHJ1Y3RvcicpO1xuICAgIH1cblxuICAgIHRoaXMubGVmdCA9IE1hdGgucm91bmQoTGVmdCk7XG4gICAgdGhpcy5jZWlsID0gTWF0aC5yb3VuZChDZWlsKTtcbiAgICB0aGlzLmZsb29yID0gTWF0aC5yb3VuZChGbG9vcik7XG4gICAgdGhpcy5yaWdodCA9IE1hdGgucm91bmQoUmlnaHQpO1xufTtcblxuQXJSZWN0LnByb3RvdHlwZS5nZXRDZW50ZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHsneCc6ICh0aGlzLmxlZnQgKyB0aGlzLnJpZ2h0KSAvIDIsICd5JzogKHRoaXMuY2VpbCArIHRoaXMuZmxvb3IpIC8gMn07XG59O1xuXG5BclJlY3QucHJvdG90eXBlLmdldFdpZHRoID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiAodGhpcy5yaWdodCAtIHRoaXMubGVmdCk7XG59O1xuXG5BclJlY3QucHJvdG90eXBlLmdldEhlaWdodCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gKHRoaXMuZmxvb3IgLSB0aGlzLmNlaWwpO1xufTtcblxuQXJSZWN0LnByb3RvdHlwZS5nZXRTaXplID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBuZXcgQXJTaXplKHRoaXMuZ2V0V2lkdGgoKSwgdGhpcy5nZXRIZWlnaHQoKSk7XG59O1xuXG5BclJlY3QucHJvdG90eXBlLmdldFRvcExlZnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIG5ldyBBclBvaW50KHRoaXMubGVmdCwgdGhpcy5jZWlsKTtcbn07XG5cbkFyUmVjdC5wcm90b3R5cGUuZ2V0Qm90dG9tUmlnaHQgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIG5ldyBBclBvaW50KHRoaXMucmlnaHQsIHRoaXMuZmxvb3IpO1xufTtcblxuQXJSZWN0LnByb3RvdHlwZS5nZXRDZW50ZXJQb2ludCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gbmV3IEFyUG9pbnQodGhpcy5sZWZ0ICsgdGhpcy5nZXRXaWR0aCgpIC8gMiwgdGhpcy5jZWlsICsgdGhpcy5nZXRIZWlnaHQoKSAvIDIpO1xufTtcblxuQXJSZWN0LnByb3RvdHlwZS5pc1JlY3RFbXB0eSA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoKHRoaXMubGVmdCA+PSB0aGlzLnJpZ2h0KSAmJiAodGhpcy5jZWlsID49IHRoaXMuZmxvb3IpKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbn07XG5cblxuQXJSZWN0LnByb3RvdHlwZS5pc1JlY3ROdWxsID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLmxlZnQgPT09IDAgJiZcbiAgICAgICAgdGhpcy5yaWdodCA9PT0gMCAmJlxuICAgICAgICB0aGlzLmNlaWwgPT09IDAgJiZcbiAgICAgICAgdGhpcy5mbG9vciA9PT0gMCkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG59O1xuXG5BclJlY3QucHJvdG90eXBlLnB0SW5SZWN0ID0gZnVuY3Rpb24gKHB0KSB7XG4gICAgaWYgKHB0IGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgICAgcHQgPSBwdFswXTtcbiAgICB9XG5cbiAgICBpZiAocHQueCA+PSB0aGlzLmxlZnQgJiZcbiAgICAgICAgcHQueCA8PSB0aGlzLnJpZ2h0ICYmXG4gICAgICAgIHB0LnkgPj0gdGhpcy5jZWlsICYmXG4gICAgICAgIHB0LnkgPD0gdGhpcy5mbG9vcikge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG59O1xuXG5BclJlY3QucHJvdG90eXBlLnNldFJlY3QgPSBmdW5jdGlvbiAobkxlZnQsIG5DZWlsLCBuUmlnaHQsIG5GbG9vcikge1xuICAgIGlmIChuQ2VpbCA9PT0gdW5kZWZpbmVkICYmIG5MZWZ0IGluc3RhbmNlb2YgQXJSZWN0KSB7IC8vXG4gICAgICAgIHRoaXMuYXNzaWduKG5MZWZ0KTtcblxuICAgIH0gZWxzZSBpZiAoblJpZ2h0ID09PSB1bmRlZmluZWQgfHwgbkZsb29yID09PSB1bmRlZmluZWQpIHsgLy9pbnZhbGlkXG4gICAgICAgIF9sb2dnZXIuZGVidWcoJ0ludmFsaWQgYXJncyBmb3IgW0FyUmVjdF0uc2V0UmVjdCcpO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5sZWZ0ID0gbkxlZnQ7XG4gICAgICAgIHRoaXMuY2VpbCA9IG5DZWlsO1xuICAgICAgICB0aGlzLnJpZ2h0ID0gblJpZ2h0O1xuICAgICAgICB0aGlzLmZsb29yID0gbkZsb29yO1xuICAgIH1cblxufTtcblxuQXJSZWN0LnByb3RvdHlwZS5zZXRSZWN0RW1wdHkgPSBmdW5jdGlvbiAoKSB7XG5cbiAgICB0aGlzLmNlaWwgPSAwO1xuICAgIHRoaXMucmlnaHQgPSAwO1xuICAgIHRoaXMuZmxvb3IgPSAwO1xuICAgIHRoaXMubGVmdCA9IDA7XG59O1xuXG5BclJlY3QucHJvdG90eXBlLmluZmxhdGVSZWN0ID0gZnVuY3Rpb24gKHgsIHkpIHtcbiAgICBpZiAoeCAhPT0gdW5kZWZpbmVkICYmIHguY3ggIT09IHVuZGVmaW5lZCAmJiB4LmN5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgeSA9IHguY3k7XG4gICAgICAgIHggPSB4LmN4O1xuICAgIH0gZWxzZSBpZiAoeSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHkgPSB4O1xuICAgIH1cblxuICAgIHRoaXMubGVmdCAtPSB4O1xuICAgIHRoaXMucmlnaHQgKz0geDtcbiAgICB0aGlzLmNlaWwgLT0geTtcbiAgICB0aGlzLmZsb29yICs9IHk7XG59O1xuXG5BclJlY3QucHJvdG90eXBlLmRlZmxhdGVSZWN0ID0gZnVuY3Rpb24gKHgsIHkpIHtcbiAgICBpZiAoeCAhPT0gdW5kZWZpbmVkICYmIHguY3ggIT09IHVuZGVmaW5lZCAmJiB4LmN5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgeSA9IHguY3k7XG4gICAgICAgIHggPSB4LmN4O1xuICAgIH1cblxuICAgIHRoaXMubGVmdCArPSB4O1xuICAgIHRoaXMucmlnaHQgLT0geDtcbiAgICB0aGlzLmNlaWwgKz0geTtcbiAgICB0aGlzLmZsb29yIC09IHk7XG59O1xuXG5BclJlY3QucHJvdG90eXBlLm5vcm1hbGl6ZVJlY3QgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHRlbXA7XG5cbiAgICBpZiAodGhpcy5sZWZ0ID4gdGhpcy5yaWdodCkge1xuICAgICAgICB0ZW1wID0gdGhpcy5sZWZ0O1xuICAgICAgICB0aGlzLmxlZnQgPSB0aGlzLnJpZ2h0O1xuICAgICAgICB0aGlzLnJpZ2h0ID0gdGVtcDtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5jZWlsID4gdGhpcy5mbG9vcikge1xuICAgICAgICB0ZW1wID0gdGhpcy5jZWlsO1xuICAgICAgICB0aGlzLmNlaWwgPSB0aGlzLmZsb29yO1xuICAgICAgICB0aGlzLmZsb29yID0gdGVtcDtcbiAgICB9XG59O1xuXG5BclJlY3QucHJvdG90eXBlLmFzc2lnbiA9IGZ1bmN0aW9uIChyZWN0KSB7XG5cbiAgICB0aGlzLmNlaWwgPSByZWN0LmNlaWw7XG4gICAgdGhpcy5yaWdodCA9IHJlY3QucmlnaHQ7XG4gICAgdGhpcy5mbG9vciA9IHJlY3QuZmxvb3I7XG4gICAgdGhpcy5sZWZ0ID0gcmVjdC5sZWZ0O1xufTtcblxuQXJSZWN0LnByb3RvdHlwZS5lcXVhbHMgPSBmdW5jdGlvbiAocmVjdCkge1xuICAgIGlmICh0aGlzLmxlZnQgPT09IHJlY3QubGVmdCAmJlxuICAgICAgICB0aGlzLnJpZ2h0ID09PSByZWN0LnJpZ2h0ICYmXG4gICAgICAgIHRoaXMuY2VpbCA9PT0gcmVjdC5jZWlsICYmXG4gICAgICAgIHRoaXMuZmxvb3IgPT09IHJlY3QuZmxvb3IpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuXG59O1xuXG5BclJlY3QucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uIChBck9iamVjdCkge1xuICAgIHZhciBkeCxcbiAgICAgICAgZHk7XG4gICAgaWYgKEFyT2JqZWN0IGluc3RhbmNlb2YgQXJQb2ludCkge1xuICAgICAgICBkeCA9IEFyT2JqZWN0Lng7XG4gICAgICAgIGR5ID0gQXJPYmplY3QueTtcblxuICAgIH0gZWxzZSBpZiAoQXJPYmplY3QuY3ggIT09IHVuZGVmaW5lZCAmJiBBck9iamVjdC5jeSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGR4ID0gQXJPYmplY3QuY3g7XG4gICAgICAgIGR5ID0gQXJPYmplY3QuY3k7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgICBfbG9nZ2VyLmRlYnVnKCdJbnZhbGlkIGFyZyBmb3IgW0FyUmVjdF0uYWRkIG1ldGhvZCcpO1xuICAgIH1cblxuICAgIHRoaXMubGVmdCArPSBkeDtcbiAgICB0aGlzLnJpZ2h0ICs9IGR4O1xuICAgIHRoaXMuY2VpbCArPSBkeTtcbiAgICB0aGlzLmZsb29yICs9IGR5O1xufTtcblxuQXJSZWN0LnByb3RvdHlwZS5zdWJ0cmFjdCA9IGZ1bmN0aW9uIChBck9iamVjdCkge1xuICAgIGlmIChBck9iamVjdCBpbnN0YW5jZW9mIEFyUG9pbnQpIHtcbiAgICAgICAgdGhpcy5kZWZsYXRlUmVjdChBck9iamVjdC54LCBBck9iamVjdC55KTtcblxuICAgIH0gZWxzZSBpZiAoQXJPYmplY3QgaW5zdGFuY2VvZiBBclNpemUpIHtcbiAgICAgICAgdGhpcy5kZWZsYXRlUmVjdChBck9iamVjdCk7XG5cbiAgICB9IGVsc2UgaWYgKEFyT2JqZWN0IGluc3RhbmNlb2YgQXJSZWN0KSB7XG4gICAgICAgIHRoaXMubGVmdCArPSBBck9iamVjdC5sZWZ0O1xuICAgICAgICB0aGlzLnJpZ2h0IC09IEFyT2JqZWN0LnJpZ2h0O1xuICAgICAgICB0aGlzLmNlaWwgKz0gQXJPYmplY3QuY2VpbDtcbiAgICAgICAgdGhpcy5mbG9vciAtPSBBck9iamVjdC5mbG9vcjtcblxuICAgIH0gZWxzZSB7XG4gICAgICAgIF9sb2dnZXIuZGVidWcoJ0ludmFsaWQgYXJnIGZvciBbQXJSZWN0XS5zdWJ0cmFjdCBtZXRob2QnKTtcbiAgICB9XG59O1xuXG5BclJlY3QucHJvdG90eXBlLnBsdXMgPSBmdW5jdGlvbiAoQXJPYmplY3QpIHtcbiAgICB2YXIgcmVzT2JqZWN0ID0gbmV3IEFyUmVjdCh0aGlzKTtcbiAgICByZXNPYmplY3QuYWRkKEFyT2JqZWN0KTtcblxuICAgIHJldHVybiByZXNPYmplY3Q7XG59O1xuXG5BclJlY3QucHJvdG90eXBlLm1pbnVzID0gZnVuY3Rpb24gKEFyT2JqZWN0KSB7XG4gICAgdmFyIHJlc09iamVjdCA9IG5ldyBBclJlY3QodGhpcyk7XG4gICAgcmVzT2JqZWN0LnN1YnRyYWN0KEFyT2JqZWN0KTtcblxuICAgIHJldHVybiByZXNPYmplY3Q7XG59O1xuXG5BclJlY3QucHJvdG90eXBlLnVuaW9uQXNzaWduID0gZnVuY3Rpb24gKHJlY3QpIHtcbiAgICBpZiAocmVjdC5pc1JlY3RFbXB0eSgpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKHRoaXMuaXNSZWN0RW1wdHkoKSkge1xuICAgICAgICB0aGlzLmFzc2lnbihyZWN0KTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vVGFrZSB0aGUgb3V0ZXJtb3N0IGRpbWVuc2lvblxuICAgIHRoaXMubGVmdCA9IE1hdGgubWluKHRoaXMubGVmdCwgcmVjdC5sZWZ0KTtcbiAgICB0aGlzLnJpZ2h0ID0gTWF0aC5tYXgodGhpcy5yaWdodCwgcmVjdC5yaWdodCk7XG4gICAgdGhpcy5jZWlsID0gTWF0aC5taW4odGhpcy5jZWlsLCByZWN0LmNlaWwpO1xuICAgIHRoaXMuZmxvb3IgPSBNYXRoLm1heCh0aGlzLmZsb29yLCByZWN0LmZsb29yKTtcblxufTtcblxuQXJSZWN0LnByb3RvdHlwZS51bmlvbiA9IGZ1bmN0aW9uIChyZWN0KSB7XG4gICAgdmFyIHJlc1JlY3QgPSBuZXcgQXJSZWN0KHRoaXMpO1xuICAgIHJlc1JlY3QudW5pb25Bc3NpZ24ocmVjdCk7XG5cbiAgICByZXR1cm4gcmVzUmVjdDtcbn07XG5cbkFyUmVjdC5wcm90b3R5cGUuaW50ZXJzZWN0QXNzaWduID0gZnVuY3Rpb24gKHJlY3QxLCByZWN0Mikge1xuICAgIHJlY3QyID0gcmVjdDIgPyByZWN0MiA6IHRoaXM7XG4gICAgLy9TZXRzIHRoaXMgcmVjdCB0byB0aGUgaW50ZXJzZWN0aW9uIHJlY3RcbiAgICB0aGlzLmxlZnQgPSBNYXRoLm1heChyZWN0MS5sZWZ0LCByZWN0Mi5sZWZ0KTtcbiAgICB0aGlzLnJpZ2h0ID0gTWF0aC5taW4ocmVjdDEucmlnaHQsIHJlY3QyLnJpZ2h0KTtcbiAgICB0aGlzLmNlaWwgPSBNYXRoLm1heChyZWN0MS5jZWlsLCByZWN0Mi5jZWlsKTtcbiAgICB0aGlzLmZsb29yID0gTWF0aC5taW4ocmVjdDEuZmxvb3IsIHJlY3QyLmZsb29yKTtcblxuICAgIGlmICh0aGlzLmxlZnQgPj0gdGhpcy5yaWdodCB8fCB0aGlzLmNlaWwgPj0gdGhpcy5mbG9vcikge1xuICAgICAgICB0aGlzLnNldFJlY3RFbXB0eSgpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG59O1xuXG5BclJlY3QucHJvdG90eXBlLmludGVyc2VjdCA9IGZ1bmN0aW9uIChyZWN0KSB7XG4gICAgdmFyIHJlc1JlY3QgPSBuZXcgQXJSZWN0KHRoaXMpO1xuXG4gICAgcmVzUmVjdC5pbnRlcnNlY3RBc3NpZ24ocmVjdCk7XG4gICAgcmV0dXJuIHJlc1JlY3Q7XG59O1xuXG5BclJlY3QucHJvdG90eXBlLnRvdWNoaW5nID0gZnVuY3Rpb24gKHJlY3QpIHtcbiAgICAvL09uZSBwaXhlbCBpcyBhZGRlZCB0byB0aGUgbWluaW11bXMgc28sIGlmIHRoZXkgYXJlIG5vdCBkZWVtZWQgdG8gYmUgdG91Y2hpbmdcbiAgICAvL3RoZXJlIGlzIGd1YXJhbnRlZWQgdG8gYmUgYXQgbGVhc2UgYSBvbmUgcGl4ZWwgcGF0aCBiZXR3ZWVuIHRoZW1cbiAgICByZXR1cm4gTWF0aC5tYXgocmVjdC5sZWZ0LCB0aGlzLmxlZnQpIDw9IE1hdGgubWluKHJlY3QucmlnaHQsIHRoaXMucmlnaHQpICsgMSAmJlxuICAgICAgICBNYXRoLm1heChyZWN0LmNlaWwsIHRoaXMuY2VpbCkgPD0gTWF0aC5taW4ocmVjdC5mbG9vciwgdGhpcy5mbG9vcikgKyAxO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgdGhlIGdpdmVuIHBvaW50IGlzIG9uIG9uZSBvZiB0aGUgY29ybmVycyBvZiB0aGUgcmVjdGFuZ2xlLlxuICpcbiAqIEBwYXJhbSBwb2ludFxuICogQHJldHVybiB7dW5kZWZpbmVkfVxuICovXG5BclJlY3QucHJvdG90eXBlLm9uQ29ybmVyID0gZnVuY3Rpb24gKHBvaW50KSB7XG4gICAgdmFyIG9uSG9yaXpvbnRhbFNpZGUsXG4gICAgICAgIG9uVmVydGljYWxTaWRlO1xuXG4gICAgb25Ib3Jpem9udGFsU2lkZSA9IHBvaW50LnggPT09IHRoaXMubGVmdCB8fCBwb2ludC54ID09PSB0aGlzLnJpZ2h0O1xuICAgIG9uVmVydGljYWxTaWRlID0gcG9pbnQueSA9PT0gdGhpcy5jZWlsIHx8IHBvaW50LnkgPT09IHRoaXMuZmxvb3I7XG5cbiAgICByZXR1cm4gb25Ib3Jpem9udGFsU2lkZSAmJiBvblZlcnRpY2FsU2lkZTtcbn07XG5cbkFyUmVjdC5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0VG9wTGVmdCgpLnRvU3RyaW5nKCkgKyAnICcgKyB0aGlzLmdldEJvdHRvbVJpZ2h0KCkudG9TdHJpbmcoKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQXJSZWN0O1xuIiwiLypqc2hpbnQgbm9kZTogdHJ1ZSovXG5cbi8qKlxuICogQGF1dGhvciBicm9sbGIgLyBodHRwczovL2dpdGh1Yi9icm9sbGJcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBBclNpemUgPSBmdW5jdGlvbiAoeCwgeSkge1xuICAgIC8vTXVsdGlwbGUgQ29uc3RydWN0b3JzXG4gICAgaWYgKHggPT09IHVuZGVmaW5lZCkgeyAvL05vIGFyZ3VtZW50cyB3ZXJlIHBhc3NlZCB0byBjb25zdHJ1Y3RvclxuICAgICAgICB4ID0gMDtcbiAgICAgICAgeSA9IDA7XG4gICAgfSBlbHNlIGlmICh5ID09PSB1bmRlZmluZWQpIHsgLy9PbmUgYXJndW1lbnQgcGFzc2VkIHRvIGNvbnN0cnVjdG9yXG4gICAgICAgIHkgPSB4LmN5O1xuICAgICAgICB4ID0geC5jeDtcbiAgICB9XG5cbiAgICB0aGlzLmN4ID0geDtcbiAgICB0aGlzLmN5ID0geTtcbn07XG5cbkFyU2l6ZS5wcm90b3R5cGUuZXF1YWxzID0gZnVuY3Rpb24gKG90aGVyU2l6ZSkge1xuICAgIGlmICh0aGlzLmN4ID09PSBvdGhlclNpemUuY3ggJiYgdGhpcy5jeSA9PT0gb3RoZXJTaXplLmN5KSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbn07XG5cbkFyU2l6ZS5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24gKG90aGVyU2l6ZSkgeyAvL2VxdWl2YWxlbnQgdG8gKz1cbiAgICBpZiAob3RoZXJTaXplLmN4IHx8IG90aGVyU2l6ZS5jeSkge1xuICAgICAgICB0aGlzLmN4ICs9IG90aGVyU2l6ZS5jeDtcbiAgICAgICAgdGhpcy5jeSArPSBvdGhlclNpemUuY3k7XG4gICAgfVxuICAgIGlmIChvdGhlclNpemUueCB8fCBvdGhlclNpemUueSkge1xuICAgICAgICB0aGlzLmN4ICs9IG90aGVyU2l6ZS54O1xuICAgICAgICB0aGlzLmN5ICs9IG90aGVyU2l6ZS55O1xuICAgIH1cbn07XG5cbkFyU2l6ZS5wcm90b3R5cGUuZ2V0QXJyYXkgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHJlcyA9IFtdO1xuICAgIHJlcy5wdXNoKHRoaXMuY3gpO1xuICAgIHJlcy5wdXNoKHRoaXMuY3kpO1xuICAgIHJldHVybiByZXM7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEFyU2l6ZTtcbiIsIi8qanNoaW50IG5vZGU6IHRydWUqL1xuXG4vKipcbiAqIEBhdXRob3IgYnJvbGxiIC8gaHR0cHM6Ly9naXRodWIvYnJvbGxiXG4gKi9cblxuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBDT05TVEFOVFMgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuQ29uc3RhbnRzJyksXG4gICAgYXNzZXJ0ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlV0aWxzJykuYXNzZXJ0LFxuICAgIEFyUmVjdCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5SZWN0JyksXG4gICAgQXJQb2ludCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Qb2ludCcpO1xuXG52YXIgX2dldE9wdGltYWxQb3J0cyA9IGZ1bmN0aW9uIChwb3J0cywgdGd0KSB7XG4gICAgLy9JIHdpbGwgZ2V0IHRoZSBkeCwgZHkgdGhhdCB0byB0aGUgc3JjL2RzdCB0YXJnZXQgYW5kIHRoZW4gSSB3aWxsIGNhbGN1bGF0ZVxuICAgIC8vIGEgcHJpb3JpdHkgdmFsdWUgdGhhdCB3aWxsIHJhdGUgdGhlIHBvcnRzIGFzIGNhbmRpZGF0ZXMgZm9yIHRoZSBcbiAgICAvL2dpdmVuIHBhdGhcbiAgICB2YXIgc3JjQyA9IG5ldyBBclBvaW50KCksIC8vc3JjIGNlbnRlclxuICAgICAgICB2ZWN0b3IsXG4gICAgICAgIHBvcnQsIC8vcmVzdWx0XG4gICAgICAgIG1heFAgPSAtSW5maW5pdHksXG4gICAgICAgIG1heEFyZWEgPSAwLFxuICAgICAgICBzUG9pbnQsXG4gICAgICAgIGk7XG5cbiAgICAvL0dldCB0aGUgY2VudGVyIHBvaW50cyBvZiB0aGUgc3JjLGRzdCBwb3J0c1xuICAgIGZvciAoaSA9IDA7IGkgPCBwb3J0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBzUG9pbnQgPSBwb3J0c1tpXS5yZWN0LmdldENlbnRlcigpO1xuICAgICAgICBzcmNDLnggKz0gc1BvaW50Lng7XG4gICAgICAgIHNyY0MueSArPSBzUG9pbnQueTtcblxuICAgICAgICAvL2FkanVzdCBtYXhBcmVhXG4gICAgICAgIGlmIChtYXhBcmVhIDwgcG9ydHNbaV0uZ2V0VG90YWxBdmFpbGFibGVBcmVhKCkpIHtcbiAgICAgICAgICAgIG1heEFyZWEgPSBwb3J0c1tpXS5nZXRUb3RhbEF2YWlsYWJsZUFyZWEoKTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgLy9HZXQgdGhlIGF2ZXJhZ2UgY2VudGVyIHBvaW50IG9mIHNyY1xuICAgIHNyY0MueCA9IHNyY0MueCAvIHBvcnRzLmxlbmd0aDtcbiAgICBzcmNDLnkgPSBzcmNDLnkgLyBwb3J0cy5sZW5ndGg7XG5cbiAgICAvL0dldCB0aGUgZGlyZWN0aW9uc1xuICAgIHZlY3RvciA9ICh0Z3QubWludXMoc3JjQykuZ2V0QXJyYXkoKSk7XG5cbiAgICAvL0NyZWF0ZSBwcmlvcml0eSBmdW5jdGlvblxuICAgIGZ1bmN0aW9uIGNyZWF0ZVByaW9yaXR5KHBvcnQsIGNlbnRlcikge1xuICAgICAgICB2YXIgcHJpb3JpdHkgPSAwLFxuICAgICAgICAvL3BvaW50ID0gWyAgY2VudGVyLnggLSBwb3J0LnJlY3QuZ2V0Q2VudGVyKCkueCwgY2VudGVyLnkgLSBwb3J0LnJlY3QuZ2V0Q2VudGVyKCkueV0sXG4gICAgICAgICAgICBwb2ludCA9IFtwb3J0LnJlY3QuZ2V0Q2VudGVyKCkueCAtIGNlbnRlci54LCBwb3J0LnJlY3QuZ2V0Q2VudGVyKCkueSAtIGNlbnRlci55XSxcbiAgICAgICAgICAgIGxpbmVDb3VudCA9IChwb3J0LmdldFBvaW50Q291bnQoKSB8fCAxKSxcbiAgICAgICAgICAgIC8vSWYgdGhlcmUgaXMgYSBwcm9ibGVtIHdpdGggbWF4QXJlYSwganVzdCBpZ25vcmUgZGVuc2l0eVxuICAgICAgICAgICAgZGVuc2l0eSA9IChwb3J0LmdldFRvdGFsQXZhaWxhYmxlQXJlYSgpIC8gbGluZUNvdW50KSAvIG1heEFyZWEgfHwgMSxcbiAgICAgICAgICAgIG1ham9yID0gTWF0aC5hYnModmVjdG9yWzBdKSA+IE1hdGguYWJzKHZlY3RvclsxXSkgPyAwIDogMSxcbiAgICAgICAgICAgIG1pbm9yID0gKG1ham9yICsgMSkgJSAyO1xuXG4gICAgICAgIGlmIChwb2ludFttYWpvcl0gPiAwID09PSB2ZWN0b3JbbWFqb3JdID4gMCAmJiAocG9pbnRbbWFqb3JdID09PSAwKSA9PT0gKHZlY3RvclttYWpvcl0gPT09IDApKSB7XG4gICAgICAgICAgICAvL2hhbmRsaW5nIHRoZSA9PT0gMCBlcnJvclxuICAgICAgICAgICAgLy9JZiB0aGV5IGhhdmUgdGhlIHNhbWUgcGFyaXR5LCBhc3NpZ24gdGhlIHByaW9yaXR5IHRvIG1heGltaXplIHRoYXQgaXMgPiAxXG4gICAgICAgICAgICBwcmlvcml0eSA9IChNYXRoLmFicyh2ZWN0b3JbbWFqb3JdKSAvIE1hdGguYWJzKHZlY3RvclttYWpvcl0gLSBwb2ludFttYWpvcl0pKSAqIDI1O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHBvaW50W21pbm9yXSA+IDAgPT09IHZlY3RvclttaW5vcl0gPiAwICYmIChwb2ludFttaW5vcl0gPT09IDApID09PSAodmVjdG9yW21pbm9yXSA9PT0gMCkpIHtcbiAgICAgICAgICAgIC8vaGFuZGxpbmcgdGhlID09PSAwIGVycm9yXG4gICAgICAgICAgICAvL0lmIHRoZXkgaGF2ZSB0aGUgc2FtZSBwYXJpdHksIGFzc2lnbiB0aGUgcHJpb3JpdHkgdG8gbWF4aW1pemUgdGhhdCBpcyA8IDFcbiAgICAgICAgICAgIHByaW9yaXR5ICs9IHZlY3RvclttaW5vcl0gIT09IHBvaW50W21pbm9yXSA/XG4gICAgICAgICAgICAoTWF0aC5hYnModmVjdG9yW21pbm9yXSkgLyBNYXRoLmFicyh2ZWN0b3JbbWlub3JdIC0gcG9pbnRbbWlub3JdKSkgKiAxIDogMDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vQWRqdXN0IHByaW9yaXR5IGJhc2VkIG9uIHRoZSBkZW5zaXR5IG9mIHRoZSBsaW5lcy4uLlxuICAgICAgICBwcmlvcml0eSAqPSBkZW5zaXR5O1xuXG4gICAgICAgIHJldHVybiBwcmlvcml0eTtcbiAgICB9XG5cbiAgICAvL0NyZWF0ZSBwcmlvcml0eSB2YWx1ZXMgZm9yIGVhY2ggcG9ydC5cbiAgICB2YXIgcHJpb3JpdHk7XG4gICAgZm9yIChpID0gMDsgaSA8IHBvcnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHByaW9yaXR5ID0gY3JlYXRlUHJpb3JpdHkocG9ydHNbaV0sIHNyY0MpIHx8IDA7XG4gICAgICAgIGlmIChwcmlvcml0eSA+PSBtYXhQKSB7XG4gICAgICAgICAgICBwb3J0ID0gcG9ydHNbaV07XG4gICAgICAgICAgICBtYXhQID0gcHJpb3JpdHk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3NlcnQocG9ydC5vd25lciwgJ0FSR3JhcGguZ2V0T3B0aW1hbFBvcnRzOiBwb3J0IGhhcyBpbnZhbGlkIG93bmVyJyk7XG5cbiAgICByZXR1cm4gcG9ydDtcbn07XG5cbnZhciBfZ2V0UG9pbnRDb29yZCA9IGZ1bmN0aW9uIChwb2ludCwgaG9yRGlyKSB7XG4gICAgaWYgKGhvckRpciA9PT0gdHJ1ZSB8fCBfaXNIb3Jpem9udGFsKGhvckRpcikpIHtcbiAgICAgICAgcmV0dXJuIHBvaW50Lng7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHBvaW50Lnk7XG4gICAgfVxufTtcblxudmFyIF9pbmZsYXRlZFJlY3QgPSBmdW5jdGlvbiAocmVjdCwgYSkge1xuICAgIHZhciByID0gcmVjdDtcbiAgICByLmluZmxhdGVSZWN0KGEsIGEpO1xuICAgIHJldHVybiByO1xufTtcblxudmFyIF9pc1BvaW50TmVhciA9IGZ1bmN0aW9uIChwMSwgcDIsIG5lYXJuZXNzKSB7XG4gICAgcmV0dXJuIHAyLnggLSBuZWFybmVzcyA8PSBwMS54ICYmIHAxLnggPD0gcDIueCArIG5lYXJuZXNzICYmXG4gICAgICAgIHAyLnkgLSBuZWFybmVzcyA8PSBwMS55ICYmIHAxLnkgPD0gcDIueSArIG5lYXJuZXNzO1xufTtcblxudmFyIF9pc1BvaW50SW4gPSBmdW5jdGlvbiAocG9pbnQsIHJlY3QsIG5lYXJuZXNzKSB7XG4gICAgdmFyIHRtcFIgPSBuZXcgQXJSZWN0KHJlY3QpO1xuICAgIHRtcFIuaW5mbGF0ZVJlY3QobmVhcm5lc3MsIG5lYXJuZXNzKTtcbiAgICByZXR1cm4gdG1wUi5wdEluUmVjdChwb2ludCkgPT09IHRydWU7XG59O1xuXG52YXIgX2lzUmVjdEluID0gZnVuY3Rpb24gKHIxLCByMikge1xuICAgIHJldHVybiByMi5sZWZ0IDw9IHIxLmxlZnQgJiYgcjEucmlnaHQgPD0gcjIucmlnaHQgJiZcbiAgICAgICAgcjIuY2VpbCA8PSByMS5jZWlsICYmIHIxLmZsb29yIDw9IHIyLmZsb29yO1xufTtcblxudmFyIF9pc1JlY3RDbGlwID0gZnVuY3Rpb24gKHIxLCByMikge1xuICAgIHZhciByZWN0ID0gbmV3IEFyUmVjdCgpO1xuICAgIHJldHVybiByZWN0LmludGVyc2VjdEFzc2lnbihyMSwgcjIpID09PSB0cnVlO1xufTtcblxudmFyIF9kaXN0YW5jZUZyb21ITGluZSA9IGZ1bmN0aW9uIChwLCB4MSwgeDIsIHkpIHtcbiAgICBhc3NlcnQoeDEgPD0geDIsICdBckhlbHBlci5kaXN0YW5jZUZyb21ITGluZTogeDEgPD0geDIgRkFJTEVEJyk7XG5cbiAgICByZXR1cm4gTWF0aC5tYXgoTWF0aC5hYnMocC55IC0geSksIE1hdGgubWF4KHgxIC0gcC54LCBwLnggLSB4MikpO1xufTtcblxudmFyIF9kaXN0YW5jZUZyb21WTGluZSA9IGZ1bmN0aW9uIChwLCB5MSwgeTIsIHgpIHtcbiAgICBhc3NlcnQoeTEgPD0geTIsICdBckhlbHBlci5kaXN0YW5jZUZyb21WTGluZTogeTEgPD0geTIgRkFJTEVEJyk7XG5cbiAgICByZXR1cm4gTWF0aC5tYXgoTWF0aC5hYnMocC54IC0geCksIE1hdGgubWF4KHkxIC0gcC55LCBwLnkgLSB5MikpO1xufTtcblxudmFyIF9kaXN0YW5jZUZyb21MaW5lID0gZnVuY3Rpb24gKHB0LCBzdGFydCwgZW5kKSB7XG4gICAgdmFyIGRpciA9IF9nZXREaXIoZW5kLm1pbnVzKHN0YXJ0KSk7XG5cbiAgICBpZiAoX2lzSG9yaXpvbnRhbChkaXIpKSB7XG4gICAgICAgIHJldHVybiBfZGlzdGFuY2VGcm9tVkxpbmUocHQsIHN0YXJ0LnksIGVuZC55LCBzdGFydC54KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gX2Rpc3RhbmNlRnJvbUhMaW5lKHB0LCBzdGFydC54LCBlbmQueCwgc3RhcnQueSk7XG4gICAgfVxufTtcblxudmFyIF9pc09uRWRnZSA9IGZ1bmN0aW9uIChzdGFydCwgZW5kLCBwdCkge1xuICAgIGlmIChzdGFydC54ID09PSBlbmQueCkge1x0XHRcdC8vIHZlcnRpY2FsIGVkZ2UsIGhvcml6b250YWwgbW92ZVxuICAgICAgICBpZiAoZW5kLnggPT09IHB0LnggJiYgcHQueSA8PSBNYXRoLm1heChlbmQueSwgc3RhcnQueSkgJiYgcHQueSA+PSBNYXRoLm1pbihlbmQueSwgc3RhcnQueSkpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChzdGFydC55ID09PSBlbmQueSkge1x0Ly8gaG9yaXpvbnRhbCBsaW5lLCB2ZXJ0aWNhbCBtb3ZlXG4gICAgICAgIGlmIChzdGFydC55ID09PSBwdC55ICYmIHB0LnggPD0gTWF0aC5tYXgoZW5kLngsIHN0YXJ0LngpICYmIHB0LnggPj0gTWF0aC5taW4oZW5kLngsIHN0YXJ0LngpKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbn07XG5cbnZhciBfaXNQb2ludE5lYXJMaW5lID0gZnVuY3Rpb24gKHBvaW50LCBzdGFydCwgZW5kLCBuZWFybmVzcykge1xuICAgIGFzc2VydCgwIDw9IG5lYXJuZXNzLCAnQXJIZWxwZXIuaXNQb2ludE5lYXJMaW5lOiAwIDw9IG5lYXJuZXNzIEZBSUxFRCcpO1xuXG4gICAgLy8gYmVnaW4gWm9sbW9sXG4gICAgLy8gdGhlIHJvdXRpbmcgbWF5IGNyZWF0ZSBlZGdlcyB0aGF0IGhhdmUgc3RhcnQ9PWVuZFxuICAgIC8vIHRodXMgY29uZnVzaW5nIHRoaXMgYWxnb3JpdGhtXG4gICAgaWYgKGVuZC54ID09PSBzdGFydC54ICYmIGVuZC55ID09PSBzdGFydC55KSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgLy8gZW5kIFpvbG1vbFxuXG4gICAgdmFyIHBvaW50MiA9IHBvaW50O1xuXG4gICAgcG9pbnQyLnN1YnRyYWN0KHN0YXJ0KTtcblxuICAgIHZhciBlbmQyID0gZW5kO1xuICAgIGVuZDIuc3VidHJhY3Qoc3RhcnQpO1xuXG4gICAgdmFyIHggPSBlbmQyLngsXG4gICAgICAgIHkgPSBlbmQyLnksXG4gICAgICAgIHUgPSBwb2ludDIueCxcbiAgICAgICAgdiA9IHBvaW50Mi55LFxuICAgICAgICB4dXl2ID0geCAqIHUgKyB5ICogdixcbiAgICAgICAgeDJ5MiA9IHggKiB4ICsgeSAqIHk7XG5cbiAgICBpZiAoeHV5diA8IDAgfHwgeHV5diA+IHgyeTIpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHZhciBleHByMSA9ICh4ICogdiAtIHkgKiB1KTtcbiAgICBleHByMSAqPSBleHByMTtcbiAgICB2YXIgZXhwcjIgPSBuZWFybmVzcyAqIG5lYXJuZXNzICogeDJ5MjtcblxuICAgIHJldHVybiBleHByMSA8PSBleHByMjtcbn07XG5cbnZhciBfaXNMaW5lTWVldEhMaW5lID0gZnVuY3Rpb24gKHN0YXJ0LCBlbmQsIHgxLCB4MiwgeSkge1xuICAgIGFzc2VydCh4MSA8PSB4MiwgJ0FySGVscGVyLmlzTGluZU1lZXRITGluZTogeDEgPD0geDIgRkFJTEVEJyk7XG4gICAgaWYgKHN0YXJ0IGluc3RhbmNlb2YgQXJyYXkpIHsvL0NvbnZlcnRpbmcgZnJvbSAncG9pbnRlcidcbiAgICAgICAgc3RhcnQgPSBzdGFydFswXTtcbiAgICB9XG4gICAgaWYgKGVuZCBpbnN0YW5jZW9mIEFycmF5KSB7XG4gICAgICAgIGVuZCA9IGVuZFswXTtcbiAgICB9XG5cbiAgICBpZiAoISgoc3RhcnQueSA8PSB5ICYmIHkgPD0gZW5kLnkpIHx8IChlbmQueSA8PSB5ICYmIHkgPD0gc3RhcnQueSApKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgdmFyIGVuZDIgPSBuZXcgQXJQb2ludChlbmQpO1xuICAgIGVuZDIuc3VidHJhY3Qoc3RhcnQpO1xuICAgIHgxIC09IHN0YXJ0Lng7XG4gICAgeDIgLT0gc3RhcnQueDtcbiAgICB5IC09IHN0YXJ0Lnk7XG5cbiAgICBpZiAoZW5kMi55ID09PSAwKSB7XG4gICAgICAgIHJldHVybiB5ID09PSAwICYmICgoIHgxIDw9IDAgJiYgMCA8PSB4MiApIHx8ICh4MSA8PSBlbmQyLnggJiYgZW5kMi54IDw9IHgyKSk7XG4gICAgfVxuXG4gICAgdmFyIHggPSAoKGVuZDIueCkgLyBlbmQyLnkpICogeTtcbiAgICByZXR1cm4geDEgPD0geCAmJiB4IDw9IHgyO1xufTtcblxudmFyIF9pc0xpbmVNZWV0VkxpbmUgPSBmdW5jdGlvbiAoc3RhcnQsIGVuZCwgeTEsIHkyLCB4KSB7XG4gICAgYXNzZXJ0KHkxIDw9IHkyLCAnQXJIZWxwZXIuaXNMaW5lTWVldFZMaW5lOiB5MSA8PSB5MiAgRkFJTEVEJyk7XG4gICAgaWYgKHN0YXJ0IGluc3RhbmNlb2YgQXJyYXkpIHsvL0NvbnZlcnRpbmcgZnJvbSAncG9pbnRlcidcbiAgICAgICAgc3RhcnQgPSBzdGFydFswXTtcbiAgICB9XG4gICAgaWYgKGVuZCBpbnN0YW5jZW9mIEFycmF5KSB7XG4gICAgICAgIGVuZCA9IGVuZFswXTtcbiAgICB9XG5cbiAgICBpZiAoISgoc3RhcnQueCA8PSB4ICYmIHggPD0gZW5kLngpIHx8IChlbmQueCA8PSB4ICYmIHggPD0gc3RhcnQueCApKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgdmFyIGVuZDIgPSBuZXcgQXJQb2ludChlbmQpO1xuICAgIGVuZDIuc3VidHJhY3Qoc3RhcnQpO1xuICAgIHkxIC09IHN0YXJ0Lnk7XG4gICAgeTIgLT0gc3RhcnQueTtcbiAgICB4IC09IHN0YXJ0Lng7XG5cbiAgICBpZiAoZW5kMi54ID09PSAwKSB7XG4gICAgICAgIHJldHVybiB4ID09PSAwICYmICgoIHkxIDw9IDAgJiYgMCA8PSB5MiApIHx8ICh5MSA8PSBlbmQyLnkgJiYgZW5kMi55IDw9IHkyKSk7XG4gICAgfVxuXG4gICAgdmFyIHkgPSAoKGVuZDIueSkgLyBlbmQyLngpICogeDtcbiAgICByZXR1cm4geTEgPD0geSAmJiB5IDw9IHkyO1xufTtcblxudmFyIF9pc0xpbmVDbGlwUmVjdHMgPSBmdW5jdGlvbiAoc3RhcnQsIGVuZCwgcmVjdHMpIHtcbiAgICB2YXIgaSA9IHJlY3RzLmxlbmd0aDtcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgIGlmIChfaXNMaW5lQ2xpcFJlY3Qoc3RhcnQsIGVuZCwgcmVjdHNbaV0pKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG59O1xuXG52YXIgX2lzTGluZUNsaXBSZWN0ID0gZnVuY3Rpb24gKHN0YXJ0LCBlbmQsIHJlY3QpIHtcbiAgICBpZiAocmVjdC5wdEluUmVjdChzdGFydCkgfHwgcmVjdC5wdEluUmVjdChlbmQpKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBfaXNMaW5lTWVldEhMaW5lKHN0YXJ0LCBlbmQsIHJlY3QubGVmdCwgcmVjdC5yaWdodCwgcmVjdC5jZWlsKSB8fFxuICAgICAgICBfaXNMaW5lTWVldEhMaW5lKHN0YXJ0LCBlbmQsIHJlY3QubGVmdCwgcmVjdC5yaWdodCwgcmVjdC5mbG9vcikgfHxcbiAgICAgICAgX2lzTGluZU1lZXRWTGluZShzdGFydCwgZW5kLCByZWN0LmNlaWwsIHJlY3QuZmxvb3IsIHJlY3QubGVmdCkgfHxcbiAgICAgICAgX2lzTGluZU1lZXRWTGluZShzdGFydCwgZW5kLCByZWN0LmNlaWwsIHJlY3QuZmxvb3IsIHJlY3QucmlnaHQpO1xufTtcblxudmFyIF9nZXRMaW5lQ2xpcFJlY3RJbnRlcnNlY3QgPSBmdW5jdGlvbiAoc3RhcnQsIGVuZCwgcmVjdCkge1xuICAgIC8vcmV0dXJuIHRoZSBlbmRwb2ludHMgb2YgdGhlIGludGVyc2VjdGlvbiBsaW5lXG4gICAgdmFyIGRpciA9IF9nZXREaXIoZW5kLm1pbnVzKHN0YXJ0KSksXG4gICAgICAgIGVuZHBvaW50cyA9IFtuZXcgQXJQb2ludChzdGFydCksIG5ldyBBclBvaW50KGVuZCldO1xuXG4gICAgaWYgKCFfaXNMaW5lQ2xpcFJlY3Qoc3RhcnQsIGVuZCwgcmVjdCkpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgYXNzZXJ0KF9pc1JpZ2h0QW5nbGUoZGlyKSwgJ0FySGVscGVyLmdldExpbmVDbGlwUmVjdEludGVyc2VjdDogX2lzUmlnaHRBbmdsZShkaXIpIEZBSUxFRCcpO1xuXG4gICAgLy9NYWtlIHN1cmUgd2UgYXJlIHdvcmtpbmcgbGVmdCB0byByaWdodCBvciB0b3AgZG93blxuICAgIGlmIChkaXIgPT09IENPTlNUQU5UUy5EaXJMZWZ0IHx8IGRpciA9PT0gQ09OU1RBTlRTLkRpclRvcCkge1xuICAgICAgICBkaXIgPSBfcmV2ZXJzZURpcihkaXIpO1xuICAgICAgICBlbmRwb2ludHMucHVzaChlbmRwb2ludHMuc3BsaWNlKDAsIDEpWzBdKTsgLy9Td2FwIHBvaW50IDAgYW5kIHBvaW50IDFcbiAgICB9XG5cbiAgICBpZiAoX2lzUG9pbnRJbkRpckZyb20oZW5kcG9pbnRzWzBdLCByZWN0LmdldFRvcExlZnQoKSwgX3JldmVyc2VEaXIoZGlyKSkpIHtcbiAgICAgICAgZW5kcG9pbnRzWzBdLmFzc2lnbihyZWN0LmdldFRvcExlZnQoKSk7XG4gICAgfVxuXG4gICAgaWYgKF9pc1BvaW50SW5EaXJGcm9tKGVuZHBvaW50c1sxXSwgcmVjdC5nZXRCb3R0b21SaWdodCgpLCBkaXIpKSB7XG4gICAgICAgIGVuZHBvaW50c1sxXS5hc3NpZ24ocmVjdC5nZXRCb3R0b21SaWdodCgpKTtcbiAgICB9XG5cbiAgICBpZiAoX2lzSG9yaXpvbnRhbChkaXIpKSB7XG4gICAgICAgIGVuZHBvaW50c1swXS55ID0gc3RhcnQueTtcbiAgICAgICAgZW5kcG9pbnRzWzFdLnkgPSBlbmQueTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBlbmRwb2ludHNbMF0ueCA9IHN0YXJ0Lng7XG4gICAgICAgIGVuZHBvaW50c1sxXS54ID0gZW5kLng7XG4gICAgfVxuXG4gICAgcmV0dXJuIGVuZHBvaW50cztcblxufTtcblxudmFyIF9pbnRlcnNlY3QgPSBmdW5jdGlvbiAoYTEsIGEyLCBiMSwgYjIpIHtcbiAgICByZXR1cm4gTWF0aC5taW4oYTEsIGEyKSA8PSBNYXRoLm1heChiMSwgYjIpICYmIE1hdGgubWluKGIxLCBiMikgPD0gTWF0aC5tYXgoYTEsIGEyKTtcbn07XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSBSb3V0aW5nRGlyZWN0aW9uXG5cbnZhciBfaXNIb3Jpem9udGFsID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHJldHVybiBkaXIgPT09IENPTlNUQU5UUy5EaXJSaWdodCB8fCBkaXIgPT09IENPTlNUQU5UUy5EaXJMZWZ0O1xufTtcblxudmFyIF9pc1ZlcnRpY2FsID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHJldHVybiBkaXIgPT09IENPTlNUQU5UUy5EaXJUb3AgfHwgZGlyID09PSBDT05TVEFOVFMuRGlyQm90dG9tO1xufTtcblxudmFyIF9pc1JpZ2h0QW5nbGUgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgcmV0dXJuIENPTlNUQU5UUy5EaXJUb3AgPD0gZGlyICYmIGRpciA8PSBDT05TVEFOVFMuRGlyTGVmdDtcbn07XG5cbnZhciBfYXJlSW5SaWdodEFuZ2xlID0gZnVuY3Rpb24gKGRpcjEsIGRpcjIpIHtcbiAgICBhc3NlcnQoX2lzUmlnaHRBbmdsZShkaXIxKSAmJiBfaXNSaWdodEFuZ2xlKGRpcjIpLFxuICAgICAgICAnQXJIZWxwZXIuYXJlSW5SaWdodEFuZ2xlOiBfaXNSaWdodEFuZ2xlKGRpcjEpICYmIF9pc1JpZ2h0QW5nbGUoZGlyMikgRkFJTEVEJyk7XG4gICAgcmV0dXJuIF9pc0hvcml6b250YWwoZGlyMSkgPT09IF9pc1ZlcnRpY2FsKGRpcjIpO1xufTtcblxudmFyIF9uZXh0Q2xvY2t3aXNlRGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIGlmIChfaXNSaWdodEFuZ2xlKGRpcikpIHtcbiAgICAgICAgcmV0dXJuICgoZGlyICsgMSkgJSA0KTtcbiAgICB9XG5cbiAgICByZXR1cm4gZGlyO1xufTtcblxudmFyIF9wcmV2Q2xvY2t3aXNlRGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIGlmIChfaXNSaWdodEFuZ2xlKGRpcikpIHtcbiAgICAgICAgcmV0dXJuICgoZGlyICsgMykgJSA0KTtcbiAgICB9XG5cbiAgICByZXR1cm4gZGlyO1xufTtcblxudmFyIF9yZXZlcnNlRGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIGlmIChfaXNSaWdodEFuZ2xlKGRpcikpIHtcbiAgICAgICAgcmV0dXJuICgoZGlyICsgMikgJSA0KTtcbiAgICB9XG5cbiAgICByZXR1cm4gZGlyO1xufTtcblxudmFyIF9zdGVwT25lSW5EaXIgPSBmdW5jdGlvbiAocG9pbnQsIGRpcikge1xuICAgIGFzc2VydChfaXNSaWdodEFuZ2xlKGRpciksICdBckhlbHBlci5zdGVwT25JbkRpcjogX2lzUmlnaHRBbmdsZShkaXIpIEZBSUxFRCcpO1xuXG4gICAgc3dpdGNoIChkaXIpIHtcbiAgICAgICAgY2FzZSBDT05TVEFOVFMuRGlyVG9wOlxuICAgICAgICAgICAgcG9pbnQueS0tO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSBDT05TVEFOVFMuRGlyUmlnaHQ6XG4gICAgICAgICAgICBwb2ludC54Kys7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlIENPTlNUQU5UUy5EaXJCb3R0b206XG4gICAgICAgICAgICBwb2ludC55Kys7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlIENPTlNUQU5UUy5EaXJMZWZ0OlxuICAgICAgICAgICAgcG9pbnQueC0tO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgfVxuXG59O1xuXG52YXIgX2dldENoaWxkUmVjdE91dGVyQ29vcmRGcm9tID0gZnVuY3Rpb24gKGJ1ZmZlck9iamVjdCwgaW5EaXIsIHBvaW50KSB7IC8vUG9pbnQgdHJhdmVscyBpbkRpciB1bnRpbCBoaXRzIGNoaWxkIGJveFxuICAgIHZhciBjaGlsZHJlbiA9IGJ1ZmZlck9iamVjdC5jaGlsZHJlbixcbiAgICAgICAgaSA9IC0xLFxuICAgICAgICBib3ggPSBudWxsLFxuICAgICAgICByZXMgPSBfZ2V0UmVjdE91dGVyQ29vcmQoYnVmZmVyT2JqZWN0LmJveCwgaW5EaXIpO1xuXG4gICAgYXNzZXJ0KF9pc1JpZ2h0QW5nbGUoaW5EaXIpLCAnZ2V0Q2hpbGRSZWN0T3V0ZXJDb29yZEZyb206IF9pc1JpZ2h0QW5nbGUoaW5EaXIpIEZBSUxFRCcpO1xuICAgIC8vVGhlIG5leHQgYXNzZXJ0IGZhaWxzIGlmIHRoZSBwb2ludCBpcyBpbiB0aGUgb3Bwb3NpdGUgZGlyZWN0aW9uIG9mIHRoZSByZWN0YW5nbGUgdGhhdCBpdCBpcyBjaGVja2luZy5cbiAgICAvLyBlLmcuIFRoZSBwb2ludCBpcyBjaGVja2luZyB3aGVuIGl0IHdpbGwgaGl0IHRoZSBib3ggZnJvbSB0aGUgcmlnaHQgYnV0IHRoZSBwb2ludCBpcyBvbiB0aGUgbGVmdFxuICAgIGFzc2VydCghX2lzUG9pbnRJbkRpckZyb20ocG9pbnQsIGJ1ZmZlck9iamVjdC5ib3gsIGluRGlyKSxcbiAgICAgICAgJ2dldENoaWxkUmVjdE91dGVyQ29vcmRGcm9tOiAhaXNQb2ludEluRGlyRnJvbShwb2ludCwgYnVmZmVyT2JqZWN0LmJveC5yZWN0LCAoaW5EaXIpKSBGQUlMRUQnKTtcblxuICAgIHdoaWxlICgrK2kgPCBjaGlsZHJlbi5sZW5ndGgpIHtcblxuICAgICAgICBpZiAoX2lzUG9pbnRJbkRpckZyb20ocG9pbnQsIGNoaWxkcmVuW2ldLCBfcmV2ZXJzZURpcihpbkRpcikpICYmXG4gICAgICAgICAgICBfaXNQb2ludEJldHdlZW5TaWRlcyhwb2ludCwgY2hpbGRyZW5baV0sIGluRGlyKSAmJlxuICAgICAgICAgICAgX2lzQ29vcmRJbkRpckZyb20ocmVzLCBfZ2V0UmVjdE91dGVyQ29vcmQoY2hpbGRyZW5baV0sIF9yZXZlcnNlRGlyKGluRGlyKSksIChpbkRpcikpKSB7XG5cbiAgICAgICAgICAgIHJlcyA9IF9nZXRSZWN0T3V0ZXJDb29yZChjaGlsZHJlbltpXSwgX3JldmVyc2VEaXIoaW5EaXIpKTtcbiAgICAgICAgICAgIGJveCA9IGNoaWxkcmVuW2ldO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHsnYm94JzogYm94LCAnY29vcmQnOiByZXN9O1xufTtcblxudmFyIF9nZXRSZWN0T3V0ZXJDb29yZCA9IGZ1bmN0aW9uIChyZWN0LCBkaXIpIHtcbiAgICBhc3NlcnQoX2lzUmlnaHRBbmdsZShkaXIpLCAnVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQ6IGlzUmlnaHRBbmdsZShkaXIpIEZBSUxFRCcpO1xuICAgIHZhciB0ID0gcmVjdC5jZWlsIC0gMSxcbiAgICAgICAgciA9IHJlY3QucmlnaHQgKyAxLFxuICAgICAgICBiID0gcmVjdC5mbG9vciArIDEsXG4gICAgICAgIGwgPSByZWN0LmxlZnQgLSAxO1xuXG4gICAgc3dpdGNoIChkaXIpIHtcbiAgICAgICAgY2FzZSBDT05TVEFOVFMuRGlyVG9wOlxuICAgICAgICAgICAgcmV0dXJuIHQ7XG5cbiAgICAgICAgY2FzZSBDT05TVEFOVFMuRGlyUmlnaHQ6XG4gICAgICAgICAgICByZXR1cm4gcjtcblxuICAgICAgICBjYXNlIENPTlNUQU5UUy5EaXJCb3R0b206XG4gICAgICAgICAgICByZXR1cm4gYjtcbiAgICB9XG5cbiAgICByZXR1cm4gbDtcbn07XG5cbi8vXHRJbmRleGVzOlxuLy9cdFx0XHRcdCAwNFxuLy9cdFx0XHRcdDEgIDVcbi8vXHRcdFx0XHQzICA3XG4vL1x0XHRcdFx0IDI2XG5cbnZhciBnZXREaXJUYWJsZUluZGV4ID0gZnVuY3Rpb24gKG9mZnNldCkge1xuICAgIHJldHVybiAob2Zmc2V0LmN4ID49IDApICogNCArIChvZmZzZXQuY3kgPj0gMCkgKiAyICsgKE1hdGguYWJzKG9mZnNldC5jeCkgPj0gTWF0aC5hYnMob2Zmc2V0LmN5KSk7XG59O1xuXG52YXIgbWFqb3JEaXJUYWJsZSA9XG4gICAgW1xuICAgICAgICBDT05TVEFOVFMuRGlyVG9wLFxuICAgICAgICBDT05TVEFOVFMuRGlyTGVmdCxcbiAgICAgICAgQ09OU1RBTlRTLkRpckJvdHRvbSxcbiAgICAgICAgQ09OU1RBTlRTLkRpckxlZnQsXG4gICAgICAgIENPTlNUQU5UUy5EaXJUb3AsXG4gICAgICAgIENPTlNUQU5UUy5EaXJSaWdodCxcbiAgICAgICAgQ09OU1RBTlRTLkRpckJvdHRvbSxcbiAgICAgICAgQ09OU1RBTlRTLkRpclJpZ2h0XG4gICAgXTtcblxudmFyIF9nZXRNYWpvckRpciA9IGZ1bmN0aW9uIChvZmZzZXQpIHtcbiAgICByZXR1cm4gbWFqb3JEaXJUYWJsZVtnZXREaXJUYWJsZUluZGV4KG9mZnNldCldO1xufTtcblxudmFyIG1pbm9yRGlyVGFibGUgPVxuICAgIFtcbiAgICAgICAgQ09OU1RBTlRTLkRpckxlZnQsXG4gICAgICAgIENPTlNUQU5UUy5EaXJUb3AsXG4gICAgICAgIENPTlNUQU5UUy5EaXJMZWZ0LFxuICAgICAgICBDT05TVEFOVFMuRGlyQm90dG9tLFxuICAgICAgICBDT05TVEFOVFMuRGlyUmlnaHQsXG4gICAgICAgIENPTlNUQU5UUy5EaXJUb3AsXG4gICAgICAgIENPTlNUQU5UUy5EaXJSaWdodCxcbiAgICAgICAgQ09OU1RBTlRTLkRpckJvdHRvbVxuICAgIF07XG5cbnZhciBfZ2V0TWlub3JEaXIgPSBmdW5jdGlvbiAob2Zmc2V0KSB7XG4gICAgcmV0dXJuIG1pbm9yRGlyVGFibGVbZ2V0RGlyVGFibGVJbmRleChvZmZzZXQpXTtcbn07XG5cbi8vXHRGRzEyM1xuLy9cdEUgICA0XG4vL1x0RCAwIDVcbi8vXHRDICAgNlxuLy8gIEJBOTg3XG5cblxudmFyIF9leEdldERpclRhYmxlSW5kZXggPSBmdW5jdGlvbiAob2Zmc2V0KSB7XG4gICAgLy9UaGlzIHJlcXVpcmVkIGEgdmFyaWFibGUgYXNzaWdubWVudDsgb3RoZXJ3aXNlIHRoaXMgZnVuY3Rpb25cbiAgICAvL3JldHVybmVkIHVuZGVmaW5lZC4uLlxuICAgIHZhciByZXMgPVxuICAgICAgICBvZmZzZXQuY3ggPiAwID9cbiAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICBvZmZzZXQuY3kgPiAwID9cbiAgICAgICAgICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgICAgICAgICAgb2Zmc2V0LmN4ID4gb2Zmc2V0LmN5ID9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAob2Zmc2V0LmN4IDwgb2Zmc2V0LmN5ID9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgOFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgN1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApKVxuICAgICAgICAgICAgICAgICAgICApIDpcbiAgICAgICAgICAgICAgICAgICAgKG9mZnNldC5jeSA8IDAgP1xuICAgICAgICAgICAgICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9mZnNldC5jeCA+IC1vZmZzZXQuY3kgP1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAob2Zmc2V0LmN4IDwgLW9mZnNldC5jeSA/XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgM1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDVcbiAgICAgICAgICAgICAgICAgICAgICAgICkpXG4gICAgICAgICAgICApIDpcbiAgICAgICAgICAgIChvZmZzZXQuY3ggPCAwID9cbiAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgIG9mZnNldC5jeSA+IDAgP1xuICAgICAgICAgICAgICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC1vZmZzZXQuY3ggPiBvZmZzZXQuY3kgP1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAxMlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKC1vZmZzZXQuY3ggPCBvZmZzZXQuY3kgP1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDEwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAxMVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgKG9mZnNldC5jeSA8IDAgP1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2Zmc2V0LmN4IDwgb2Zmc2V0LmN5ID9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAxNFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAob2Zmc2V0LmN4ID4gb2Zmc2V0LmN5ID9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDE2XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAxNVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICkpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAxM1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICkpXG4gICAgICAgICAgICAgICAgKSA6XG4gICAgICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgICAgICBvZmZzZXQuY3kgPiAwID9cbiAgICAgICAgICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA5XG4gICAgICAgICAgICAgICAgICAgICAgICApIDpcbiAgICAgICAgICAgICAgICAgICAgICAgIChvZmZzZXQuY3kgPCAwID9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDFcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApKVxuICAgICAgICAgICAgICAgICkpO1xuXG4gICAgcmV0dXJuIHJlcztcbn07XG52YXIgZXhNYWpvckRpclRhYmxlID1cbiAgICBbXG4gICAgICAgIENPTlNUQU5UUy5EaXJOb25lLFxuICAgICAgICBDT05TVEFOVFMuRGlyVG9wLFxuICAgICAgICBDT05TVEFOVFMuRGlyVG9wLFxuICAgICAgICBDT05TVEFOVFMuRGlyUmlnaHQsXG4gICAgICAgIENPTlNUQU5UUy5EaXJSaWdodCxcbiAgICAgICAgQ09OU1RBTlRTLkRpclJpZ2h0LFxuICAgICAgICBDT05TVEFOVFMuRGlyUmlnaHQsXG4gICAgICAgIENPTlNUQU5UUy5EaXJSaWdodCxcbiAgICAgICAgQ09OU1RBTlRTLkRpckJvdHRvbSxcbiAgICAgICAgQ09OU1RBTlRTLkRpckJvdHRvbSxcbiAgICAgICAgQ09OU1RBTlRTLkRpckJvdHRvbSxcbiAgICAgICAgQ09OU1RBTlRTLkRpckxlZnQsXG4gICAgICAgIENPTlNUQU5UUy5EaXJMZWZ0LFxuICAgICAgICBDT05TVEFOVFMuRGlyTGVmdCxcbiAgICAgICAgQ09OU1RBTlRTLkRpckxlZnQsXG4gICAgICAgIENPTlNUQU5UUy5EaXJMZWZ0LFxuICAgICAgICBDT05TVEFOVFMuRGlyVG9wXG4gICAgXTtcblxudmFyIF9leEdldE1ham9yRGlyID0gZnVuY3Rpb24gKG9mZnNldCkge1xuICAgIHJldHVybiBleE1ham9yRGlyVGFibGVbX2V4R2V0RGlyVGFibGVJbmRleChvZmZzZXQpXTtcbn07XG5cbnZhciBleE1pbm9yRGlyVGFibGUgPVxuICAgIFtcbiAgICAgICAgQ09OU1RBTlRTLkRpck5vbmUsXG4gICAgICAgIENPTlNUQU5UUy5EaXJOb25lLFxuICAgICAgICBDT05TVEFOVFMuRGlyUmlnaHQsXG4gICAgICAgIENPTlNUQU5UUy5EaXJUb3AsXG4gICAgICAgIENPTlNUQU5UUy5EaXJUb3AsXG4gICAgICAgIENPTlNUQU5UUy5EaXJOb25lLFxuICAgICAgICBDT05TVEFOVFMuRGlyQm90dG9tLFxuICAgICAgICBDT05TVEFOVFMuRGlyQm90dG9tLFxuICAgICAgICBDT05TVEFOVFMuRGlyUmlnaHQsXG4gICAgICAgIENPTlNUQU5UUy5EaXJOb25lLFxuICAgICAgICBDT05TVEFOVFMuRGlyTGVmdCxcbiAgICAgICAgQ09OU1RBTlRTLkRpckJvdHRvbSxcbiAgICAgICAgQ09OU1RBTlRTLkRpckJvdHRvbSxcbiAgICAgICAgQ09OU1RBTlRTLkRpck5vbmUsXG4gICAgICAgIENPTlNUQU5UUy5EaXJUb3AsXG4gICAgICAgIENPTlNUQU5UUy5EaXJUb3AsXG4gICAgICAgIENPTlNUQU5UUy5EaXJMZWZ0XG4gICAgXTtcblxudmFyIF9leEdldE1pbm9yRGlyID0gZnVuY3Rpb24gKG9mZnNldCkge1xuICAgIHJldHVybiBleE1pbm9yRGlyVGFibGVbX2V4R2V0RGlyVGFibGVJbmRleChvZmZzZXQpXTtcbn07XG5cbnZhciBfZ2V0RGlyID0gZnVuY3Rpb24gKG9mZnNldCwgbm9kaXIpIHtcbiAgICBpZiAob2Zmc2V0LmN4ID09PSAwKSB7XG4gICAgICAgIGlmIChvZmZzZXQuY3kgPT09IDApIHtcbiAgICAgICAgICAgIHJldHVybiBub2RpcjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvZmZzZXQuY3kgPCAwKSB7XG4gICAgICAgICAgICByZXR1cm4gQ09OU1RBTlRTLkRpclRvcDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBDT05TVEFOVFMuRGlyQm90dG9tO1xuICAgIH1cblxuICAgIGlmIChvZmZzZXQuY3kgPT09IDApIHtcbiAgICAgICAgaWYgKG9mZnNldC5jeCA+IDApIHtcbiAgICAgICAgICAgIHJldHVybiBDT05TVEFOVFMuRGlyUmlnaHQ7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gQ09OU1RBTlRTLkRpckxlZnQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIENPTlNUQU5UUy5EaXJTa2V3O1xufTtcblxudmFyIF9pc1BvaW50SW5EaXJGcm9tQ2hpbGRyZW4gPSBmdW5jdGlvbiAocG9pbnQsIGZyb21QYXJlbnQsIGRpcikge1xuICAgIHZhciBjaGlsZHJlbiA9IGZyb21QYXJlbnQuY2hpbGRyZW4sXG4gICAgICAgIGkgPSAwO1xuXG4gICAgYXNzZXJ0KF9pc1JpZ2h0QW5nbGUoZGlyKSwgJ2lzUG9pbnRJbkRpckZyb21DaGlsZHJlbjogX2lzUmlnaHRBbmdsZShkaXIpIEZBSUxFRCcpO1xuXG4gICAgd2hpbGUgKGkgPCBjaGlsZHJlbi5sZW5ndGgpIHtcbiAgICAgICAgaWYgKF9pc1BvaW50SW5EaXJGcm9tKHBvaW50LCBjaGlsZHJlbltpXS5yZWN0LCBkaXIpKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICArK2k7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xufTtcblxudmFyIF9pc1BvaW50SW5EaXJGcm9tID0gZnVuY3Rpb24gKHBvaW50LCBmcm9tLCBkaXIpIHtcbiAgICBpZiAoZnJvbSBpbnN0YW5jZW9mIEFyUmVjdCkge1xuICAgICAgICB2YXIgcmVjdCA9IGZyb207XG4gICAgICAgIGFzc2VydChfaXNSaWdodEFuZ2xlKGRpciksICdBckhlbHBlci5pc1BvaW50SW5EaXJGcm9tOiBfaXNSaWdodEFuZ2xlKGRpcikgRkFJTEVEJyk7XG5cbiAgICAgICAgc3dpdGNoIChkaXIpIHtcbiAgICAgICAgICAgIGNhc2UgQ09OU1RBTlRTLkRpclRvcDpcbiAgICAgICAgICAgICAgICByZXR1cm4gcG9pbnQueSA8IHJlY3QuY2VpbDtcblxuICAgICAgICAgICAgY2FzZSBDT05TVEFOVFMuRGlyUmlnaHQ6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBvaW50LnggPj0gcmVjdC5yaWdodDtcblxuICAgICAgICAgICAgY2FzZSBDT05TVEFOVFMuRGlyQm90dG9tOlxuICAgICAgICAgICAgICAgIHJldHVybiBwb2ludC55ID49IHJlY3QuZmxvb3I7XG5cbiAgICAgICAgICAgIGNhc2UgQ09OU1RBTlRTLkRpckxlZnQ6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBvaW50LnggPCByZWN0LmxlZnQ7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgICBhc3NlcnQoX2lzUmlnaHRBbmdsZShkaXIpLCAnQXJIZWxwZXIuaXNQb2ludEluRGlyRnJvbTogX2lzUmlnaHRBbmdsZShkaXIpIEZBSUxFRCcpO1xuXG4gICAgICAgIHN3aXRjaCAoZGlyKSB7XG4gICAgICAgICAgICBjYXNlIENPTlNUQU5UUy5EaXJUb3A6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBvaW50LnkgPD0gZnJvbS55O1xuXG4gICAgICAgICAgICBjYXNlIENPTlNUQU5UUy5EaXJSaWdodDpcbiAgICAgICAgICAgICAgICByZXR1cm4gcG9pbnQueCA+PSBmcm9tLng7XG5cbiAgICAgICAgICAgIGNhc2UgQ09OU1RBTlRTLkRpckJvdHRvbTpcbiAgICAgICAgICAgICAgICByZXR1cm4gcG9pbnQueSA+PSBmcm9tLnk7XG5cbiAgICAgICAgICAgIGNhc2UgQ09OU1RBTlRTLkRpckxlZnQ6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBvaW50LnggPD0gZnJvbS54O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgfVxufTtcblxudmFyIF9pc1BvaW50QmV0d2VlblNpZGVzID0gZnVuY3Rpb24gKHBvaW50LCByZWN0LCBpc2hvcml6b250YWwpIHtcbiAgICBpZiAoaXNob3Jpem9udGFsID09PSB0cnVlIHx8IF9pc0hvcml6b250YWwoaXNob3Jpem9udGFsKSkge1xuICAgICAgICByZXR1cm4gcmVjdC5jZWlsIDw9IHBvaW50LnkgJiYgcG9pbnQueSA8IHJlY3QuZmxvb3I7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlY3QubGVmdCA8PSBwb2ludC54ICYmIHBvaW50LnggPCByZWN0LnJpZ2h0O1xufTtcblxudmFyIF9pc0Nvb3JkSW5EaXJGcm9tID0gZnVuY3Rpb24gKGNvb3JkLCBmcm9tLCBkaXIpIHtcbiAgICBhc3NlcnQoX2lzUmlnaHRBbmdsZShkaXIpLCAnQXJIZWxwZXIuaXNDb29yZEluRGlyRnJvbTogX2lzUmlnaHRBbmdsZShkaXIpIEZBSUxFRCcpO1xuICAgIGlmIChmcm9tIGluc3RhbmNlb2YgQXJQb2ludCkge1xuICAgICAgICBmcm9tID0gX2dldFBvaW50Q29vcmQoZnJvbSwgZGlyKTtcbiAgICB9XG5cbiAgICBpZiAoZGlyID09PSBDT05TVEFOVFMuRGlyVG9wIHx8IGRpciA9PT0gQ09OU1RBTlRTLkRpckxlZnQpIHtcbiAgICAgICAgcmV0dXJuIGNvb3JkIDw9IGZyb207XG4gICAgfVxuXG4gICAgcmV0dXJuIGNvb3JkID49IGZyb207XG59O1xuXG4vLyBUaGlzIG5leHQgbWV0aG9kIG9ubHkgc3VwcG9ydHMgdW5hbWJpZ3VvdXMgb3JpZW50YXRpb25zLiBUaGF0IGlzLCB0aGUgcG9pbnRcbi8vIGNhbm5vdCBiZSBpbiBhIGNvcm5lciBvZiB0aGUgcmVjdGFuZ2xlLlxuLy8gTk9URTogdGhlIHJpZ2h0IGFuZCBmbG9vciB1c2VkIHRvIGJlIC0gMS4gXG52YXIgX29uV2hpY2hFZGdlID0gZnVuY3Rpb24gKHJlY3QsIHBvaW50KSB7XG4gICAgaWYgKHBvaW50LnkgPT09IHJlY3QuY2VpbCAmJiByZWN0LmxlZnQgPCBwb2ludC54ICYmIHBvaW50LnggPCByZWN0LnJpZ2h0KSB7XG4gICAgICAgIHJldHVybiBDT05TVEFOVFMuRGlyVG9wO1xuICAgIH1cblxuICAgIGlmIChwb2ludC55ID09PSByZWN0LmZsb29yICYmIHJlY3QubGVmdCA8IHBvaW50LnggJiYgcG9pbnQueCA8IHJlY3QucmlnaHQpIHtcbiAgICAgICAgcmV0dXJuIENPTlNUQU5UUy5EaXJCb3R0b207XG4gICAgfVxuXG4gICAgaWYgKHBvaW50LnggPT09IHJlY3QubGVmdCAmJiByZWN0LmNlaWwgPCBwb2ludC55ICYmIHBvaW50LnkgPCByZWN0LmZsb29yKSB7XG4gICAgICAgIHJldHVybiBDT05TVEFOVFMuRGlyTGVmdDtcbiAgICB9XG5cbiAgICBpZiAocG9pbnQueCA9PT0gcmVjdC5yaWdodCAmJiByZWN0LmNlaWwgPCBwb2ludC55ICYmIHBvaW50LnkgPCByZWN0LmZsb29yKSB7XG4gICAgICAgIHJldHVybiBDT05TVEFOVFMuRGlyUmlnaHQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIENPTlNUQU5UUy5EaXJOb25lO1xufTtcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSBDQXJGaW5kTmVhcmVzdExpbmVcblxudmFyIEFyRmluZE5lYXJlc3RMaW5lID0gZnVuY3Rpb24gKHB0KSB7XG4gICAgdGhpcy5wb2ludCA9IHB0O1xuICAgIHRoaXMuZGlzdDEgPSBJbmZpbml0eTtcbiAgICB0aGlzLmRpc3QyID0gSW5maW5pdHk7XG59O1xuXG5BckZpbmROZWFyZXN0TGluZS5wcm90b3R5cGUuaExpbmUgPSBmdW5jdGlvbiAoeDEsIHgyLCB5KSB7XG4gICAgYXNzZXJ0KHgxIDw9IHgyLCAnQXJGaW5kTmVhcmVzdExpbmUuaExpbmU6IHgxIDw9IHgyICBGQUlMRUQnKTtcblxuICAgIHZhciBkMSA9IF9kaXN0YW5jZUZyb21ITGluZSh0aGlzLnBvaW50LCB4MSwgeDIsIHkpLFxuICAgICAgICBkMiA9IE1hdGguYWJzKHRoaXMucG9pbnQueSAtIHkpO1xuXG4gICAgaWYgKGQxIDwgdGhpcy5kaXN0MSB8fCAoZDEgPT09IHRoaXMuZGlzdDEgJiYgZDIgPCB0aGlzLmRpc3QyKSkge1xuICAgICAgICB0aGlzLmRpc3QxID0gZDE7XG4gICAgICAgIHRoaXMuZGlzdDIgPSBkMjtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xufTtcblxuQXJGaW5kTmVhcmVzdExpbmUucHJvdG90eXBlLnZMaW5lID0gZnVuY3Rpb24gKHkxLCB5MiwgeCkge1xuICAgIGFzc2VydCh5MSA8PSB5MiwgJ0FyRmluZE5lYXJlc3RMaW5lLmhMaW5lOiB5MSA8PSB5MiBGQUlMRUQnKTtcblxuICAgIHZhciBkMSA9IF9kaXN0YW5jZUZyb21WTGluZSh0aGlzLnBvaW50LCB5MSwgeTIsIHgpLFxuICAgICAgICBkMiA9IE1hdGguYWJzKHRoaXMucG9pbnQueCAtIHgpO1xuXG4gICAgaWYgKGQxIDwgdGhpcy5kaXN0MSB8fCAoZDEgPT09IHRoaXMuZGlzdDEgJiYgZDIgPCB0aGlzLmRpc3QyKSkge1xuICAgICAgICB0aGlzLmRpc3QxID0gZDE7XG4gICAgICAgIHRoaXMuZGlzdDIgPSBkMjtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xufTtcblxuQXJGaW5kTmVhcmVzdExpbmUucHJvdG90eXBlLndhcyA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5kaXN0MSA8IEluZmluaXR5ICYmIHRoaXMuZGlzdDIgPCBJbmZpbml0eTtcbn07XG5cbi8vIENvbnZlbmllbmNlIEZ1bmN0aW9uc1xudmFyIHJlbW92ZUZyb21BcnJheXMgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICB2YXIgaW5kZXgsXG4gICAgICAgIHJlbW92ZWQgPSBmYWxzZSxcbiAgICAgICAgYXJyYXk7XG5cbiAgICBmb3IgKHZhciBpID0gYXJndW1lbnRzLmxlbmd0aCAtIDE7IGkgPiAwOyBpLS0pIHtcbiAgICAgICAgYXJyYXkgPSBhcmd1bWVudHNbaV07XG4gICAgICAgIGluZGV4ID0gYXJyYXkuaW5kZXhPZih2YWx1ZSk7XG4gICAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICAgIGFycmF5LnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgICByZW1vdmVkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiByZW1vdmVkO1xufTtcblxudmFyIHN0cmluZ2lmeSA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh2YWx1ZSwgZnVuY3Rpb24gKGtleSwgdmFsdWUpIHtcbiAgICAgICAgaWYgKGtleSA9PT0gJ293bmVyJyAmJiB2YWx1ZSkge1xuICAgICAgICAgICAgcmV0dXJuIHZhbHVlLmlkIHx8IHR5cGVvZiB2YWx1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfSk7XG59O1xuXG4vKipcbiAqIFJvdW5kIHRoZSBudW1iZXIgdG8gdGhlIGdpdmVuIGRlY2ltYWwgcGxhY2VzLiBUcnVuY2F0ZSBmb2xsb3dpbmcgZGlnaXRzLlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSB2YWx1ZVxuICogQHBhcmFtIHtOdW1iZXJ9IHBsYWNlc1xuICogQHJldHVybiB7TnVtYmVyfSByZXN1bHRcbiAqL1xudmFyIHJvdW5kVHJ1bmMgPSBmdW5jdGlvbiAodmFsdWUsIHBsYWNlcykge1xuICAgIHZhbHVlID0gK3ZhbHVlO1xuICAgIHZhciBzY2FsZSA9IE1hdGgucG93KDEwLCArcGxhY2VzKSxcbiAgICAgICAgZm4gPSAnZmxvb3InO1xuXG4gICAgaWYgKHZhbHVlIDwgMCkge1xuICAgICAgICBmbiA9ICdjZWlsJztcbiAgICB9XG5cbiAgICByZXR1cm4gTWF0aFtmbl0odmFsdWUgKiBzY2FsZSkgLyBzY2FsZTtcbn07XG5cbi8vRmxvYXQgZXF1YWxzXG52YXIgZmxvYXRFcXVhbHMgPSBmdW5jdGlvbiAoYSwgYikge1xuICAgIHJldHVybiAoKGEgLSAwLjEpIDwgYikgJiYgKGIgPCAoYSArIDAuMSkpO1xufTtcblxuLyoqXG4gKiBDb252ZXJ0IGFuIG9iamVjdCB3aXRoIGluY3JlYXNpbmcgaW50ZWdlciBrZXlzIHRvIGFuIGFycmF5LlxuICogVXNpbmcgbWV0aG9kIGZyb20gaHR0cDovL2pzcGVyZi5jb20vYXJndW1lbnRzLXBlcmZvcm1hbmNlLzZcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqXG4gKiBAcmV0dXJuIHtBcnJheX1cbiAqL1xudmFyIHRvQXJyYXkgPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgdmFyIHJlc3VsdCA9IG5ldyBBcnJheShvYmoubGVuZ3RofHwwKSxcbiAgICAgICAgaSA9IDA7XG4gICAgd2hpbGUgKG9ialtpXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJlc3VsdFtpXSA9IG9ialtpKytdO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxudmFyIHBpY2sgPSBmdW5jdGlvbihrZXlzLCBvYmopIHtcbiAgICB2YXIgcmVzID0ge307XG4gICAgZm9yICh2YXIgaSA9IGtleXMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHJlc1trZXlzW2ldXSA9IG9ialtrZXlzW2ldXTtcbiAgICB9XG4gICAgcmV0dXJuIHJlcztcbn07XG5cbnZhciBub3AgPSBmdW5jdGlvbigpIHtcbiAgICAvLyBub3Bcbn07XG5cbnZhciBhc3NlcnQgPSBmdW5jdGlvbihjb25kLCBtc2cpIHtcbiAgICBpZiAoIWNvbmQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKG1zZyB8fCAnQXNzZXJ0IGZhaWxlZCcpO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIG9uV2hpY2hFZGdlOiBfb25XaGljaEVkZ2UsXG4gICAgaXNDb29yZEluRGlyRnJvbTogX2lzQ29vcmRJbkRpckZyb20sXG4gICAgaXNQb2ludEJldHdlZW5TaWRlczogX2lzUG9pbnRCZXR3ZWVuU2lkZXMsXG4gICAgaXNQb2ludEluRGlyRnJvbTogX2lzUG9pbnRJbkRpckZyb20sXG4gICAgaXNQb2ludEluRGlyRnJvbUNoaWxkcmVuOiBfaXNQb2ludEluRGlyRnJvbUNoaWxkcmVuLFxuICAgIGlzUG9pbnRJbjogX2lzUG9pbnRJbixcbiAgICBpc1BvaW50TmVhcjogX2lzUG9pbnROZWFyLFxuICAgIGdldERpcjogX2dldERpcixcbiAgICBleEdldE1pbm9yRGlyOiBfZXhHZXRNaW5vckRpcixcbiAgICBleEdldE1ham9yRGlyOiBfZXhHZXRNYWpvckRpcixcbiAgICBleEdldERpclRhYmxlSW5kZXg6IF9leEdldERpclRhYmxlSW5kZXgsXG4gICAgZ2V0TWlub3JEaXI6IF9nZXRNaW5vckRpcixcbiAgICBnZXRNYWpvckRpcjogX2dldE1ham9yRGlyLFxuICAgIGdldFJlY3RPdXRlckNvb3JkOiBfZ2V0UmVjdE91dGVyQ29vcmQsXG4gICAgZ2V0Q2hpbGRSZWN0T3V0ZXJDb29yZEZyb206IF9nZXRDaGlsZFJlY3RPdXRlckNvb3JkRnJvbSxcbiAgICBzdGVwT25lSW5EaXI6IF9zdGVwT25lSW5EaXIsXG4gICAgcmV2ZXJzZURpcjogX3JldmVyc2VEaXIsXG4gICAgcHJldkNsb2Nrd2lzZURpcjogX3ByZXZDbG9ja3dpc2VEaXIsXG4gICAgbmV4dENsb2Nrd2lzZURpcjogX25leHRDbG9ja3dpc2VEaXIsXG4gICAgYXJlSW5SaWdodEFuZ2xlOiBfYXJlSW5SaWdodEFuZ2xlLFxuICAgIGlzUmlnaHRBbmdsZTogX2lzUmlnaHRBbmdsZSxcbiAgICBpc0hvcml6b250YWw6IF9pc0hvcml6b250YWwsXG4gICAgaW50ZXJzZWN0OiBfaW50ZXJzZWN0LFxuICAgIGdldExpbmVDbGlwUmVjdEludGVyc2VjdDogX2dldExpbmVDbGlwUmVjdEludGVyc2VjdCxcbiAgICBpc0xpbmVDbGlwUmVjdDogX2lzTGluZUNsaXBSZWN0LFxuICAgIGlzTGluZUNsaXBSZWN0czogX2lzTGluZUNsaXBSZWN0cyxcbiAgICBpc1BvaW50TmVhckxpbmU6IF9pc1BvaW50TmVhckxpbmUsXG4gICAgaXNPbkVkZ2U6IF9pc09uRWRnZSxcbiAgICBkaXN0YW5jZUZyb21MaW5lOiBfZGlzdGFuY2VGcm9tTGluZSxcbiAgICBpc1JlY3RDbGlwOiBfaXNSZWN0Q2xpcCxcbiAgICBpc1JlY3RJbjogX2lzUmVjdEluLFxuICAgIGluZmxhdGVkUmVjdDogX2luZmxhdGVkUmVjdCxcbiAgICBnZXRQb2ludENvb3JkOiBfZ2V0UG9pbnRDb29yZCxcbiAgICBnZXRPcHRpbWFsUG9ydHM6IF9nZXRPcHRpbWFsUG9ydHMsXG4gICAgQXJGaW5kTmVhcmVzdExpbmU6IEFyRmluZE5lYXJlc3RMaW5lLFxuXG4gICAgcmVtb3ZlRnJvbUFycmF5czogcmVtb3ZlRnJvbUFycmF5cyxcbiAgICBzdHJpbmdpZnk6IHN0cmluZ2lmeSxcbiAgICBmbG9hdEVxdWFsczogZmxvYXRFcXVhbHMsXG4gICAgcm91bmRUcnVuYzogcm91bmRUcnVuYyxcbiAgICB0b0FycmF5OiB0b0FycmF5LFxuICAgIG5vcDogbm9wLFxuICAgIGFzc2VydDogYXNzZXJ0LFxuICAgIHBpY2s6IHBpY2sgXG59O1xuIiwiLypnbG9iYWxzIGRlZmluZSovXG4vKmpzaGludCBicm93c2VyOiB0cnVlKi9cblxuLyoqXG4gKiBAYXV0aG9yIGJyb2xsYiAvIGh0dHBzOi8vZ2l0aHViL2Jyb2xsYlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIENPTlNUQU5UUyA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Db25zdGFudHMnKSxcbiAgICB1dGlscyA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5VdGlscycpLFxuICAgIGFzc2VydCA9IHV0aWxzLmFzc2VydCxcbiAgICBBclBvaW50ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlBvaW50JyksXG4gICAgQXJSZWN0ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlJlY3QnKSxcbiAgICBBdXRvUm91dGVyR3JhcGggPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuR3JhcGgnKSxcbiAgICBBdXRvUm91dGVyUG9ydCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Qb3J0Jyk7XG5cbnZhciBBdXRvUm91dGVyID0gZnVuY3Rpb24gKCkge1xuICAgIC8vIGludGVybmFsIHRvIGV4dGVybmFsIGlkc1xuICAgIHRoaXMuX2JveElkcyA9IHt9O1xuICAgIHRoaXMuX3BvcnRJZHMgPSB7fTtcbiAgICB0aGlzLl9wYXRoSWRzID0ge307XG5cbiAgICB0aGlzLl9wYXRoc1RvVXBkYXRlT25EZWxldGlvbiA9IHt9OyAgLy8gcG9ydElkcyA9PiBwYXRoc1xuICAgIHRoaXMuX3BhdGhzVG9VcGRhdGVPbkFkZGl0aW9uID0ge307ICAvLyBib3hJZHMgPT4gcGF0aHNcbiAgICB0aGlzLl9wYXRoU3JjID0ge307XG4gICAgdGhpcy5fcGF0aERzdCA9IHt9O1xuXG4gICAgdGhpcy5fZ3JhcGggPSBuZXcgQXV0b1JvdXRlckdyYXBoKCk7XG59O1xuXG4vKiAqICogKiAqICogKiBQdWJsaWMgQVBJICogKiAqICogKiAqICovXG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuX2dyYXBoLmNsZWFyKHRydWUpO1xuICAgIHRoaXMuX2JveElkcyA9IHt9O1xuICAgIHRoaXMuX3BvcnRJZHMgPSB7fTtcbiAgICB0aGlzLl9wYXRoSWRzID0ge307XG5cbiAgICB0aGlzLl9wYXRoc1RvVXBkYXRlT25EZWxldGlvbiA9IHt9OyAgLy8gcG9ydElkcyA9PiBwYXRoc1xuICAgIHRoaXMuX3BhdGhzVG9VcGRhdGVPbkFkZGl0aW9uID0ge307ICAvLyBib3hJZHMgPT4gcGF0aHNcbiAgICB0aGlzLl9wYXRoU3JjID0ge307XG4gICAgdGhpcy5fcGF0aERzdCA9IHt9O1xufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuc2V0Qm94ID0gZnVuY3Rpb24oaWQsIHJlY3QpIHtcbiAgICB2YXIgYm94O1xuICAgIGlmIChyZWN0ID09PSBudWxsKSB7ICAvLyBSZW1vdmUgdGhlIGJveFxuICAgICAgICByZXR1cm4gdGhpcy5fcmVtb3ZlQm94KGlkKTtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuX2JveElkc1tpZF0pIHtcbiAgICAgICAgYm94ID0gdGhpcy5fY3JlYXRlQm94KHJlY3QpO1xuICAgICAgICAvLyBVcGRhdGUgcmVjb3Jkc1xuICAgICAgICB0aGlzLl9ib3hJZHNbaWRdID0gYm94LmlkO1xuICAgICAgICB0aGlzLl9wb3J0SWRzW2lkXSA9IHt9O1xuICAgICAgICBpZiAodGhpcy5fcGF0aHNUb1VwZGF0ZU9uQWRkaXRpb25baWRdKSB7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVQYXRoc0ZvckJveChpZCk7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl91cGRhdGVCb3goaWQsIHJlY3QpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmJveChpZCk7XG59O1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5zZXREZXBlbmRlbnRCb3ggPSBmdW5jdGlvbihwYXJlbnRJZCwgY2hpbGRJZCkge1xuICAgIHZhciBwYXJlbnQgPSB0aGlzLl9ib3gocGFyZW50SWQpLFxuICAgICAgICBjaGlsZCA9IHRoaXMuX2JveChjaGlsZElkKTtcblxuICAgIGFzc2VydChwYXJlbnQgJiYgY2hpbGQsICdDb3VsZCBub3QgZmluZCBwYXJlbnQgb3IgY2hpbGQnKTtcbiAgICBwYXJlbnQuYWRkQ2hpbGQoY2hpbGQpO1xufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUubW92ZUJveCA9IGZ1bmN0aW9uKGlkLCB4LCB5KSB7XG4gICAgdmFyIGJveCA9IHRoaXMuX2JveChpZCksXG4gICAgICAgIHJlY3QsXG4gICAgICAgIGR4LFxuICAgICAgICBkeTtcblxuICAgIGlmIChib3gpIHtcbiAgICAgICAgcmVjdCA9IGJveC5yZWN0O1xuICAgICAgICBkeCA9IHggLSByZWN0LmxlZnQ7XG4gICAgICAgIGR5ID0geSAtIHJlY3QuY2VpbDtcbiAgICAgICAgdGhpcy5fZ3JhcGguc2hpZnRCb3hCeShib3gsIHtjeDogZHgsIGN5OiBkeX0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IEVycm9yKGBBdXRvUm91dGVyOiBDYW5ub3QgZmluZCBib3ggJHtpZH1cIiB0byBtb3ZlIWApO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLnNldFBvcnQgPSBmdW5jdGlvbihib3hJZCwgcG9ydElkLCBhcmVhKSB7XG4gICAgaWYgKGFyZWEgPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JlbW92ZVBvcnQoYm94SWQsIHBvcnRJZCk7XG4gICAgfVxuXG4gICAgYXNzZXJ0KHRoaXMuX2JveChib3hJZCksICdCb3ggXCInICsgYm94SWQgKyAnXCIgZG9lcyBub3QgZXhpc3QnKTtcbiAgICBpZiAoIXRoaXMuX3BvcnRJZHNbYm94SWRdIHx8ICF0aGlzLl9wb3J0SWRzW2JveElkXVtwb3J0SWRdKSB7XG4gICAgICAgIHRoaXMuX2NyZWF0ZVBvcnQoYm94SWQsIHBvcnRJZCwgYXJlYSk7XG4gICAgICAgIGFzc2VydCh0aGlzLl9wb3J0KGJveElkLCBwb3J0SWQpLCAnUG9ydCBub3QgYWRkZWQhJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fdXBkYXRlUG9ydChib3hJZCwgcG9ydElkLCBhcmVhKTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5zZXRQYXRoID0gZnVuY3Rpb24oaWQsIHNyY0lkLCBkc3RJZCkge1xuICAgIGlmIChzcmNJZCA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcmVtb3ZlUGF0aChpZCk7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLl9wYXRoSWRzW2lkXSkge1xuICAgICAgICB0aGlzLl9jcmVhdGVQYXRoKGlkLCBzcmNJZCwgZHN0SWQpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX3VwZGF0ZVBhdGgoaWQsIHNyY0lkLCBkc3RJZCk7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuc2V0Q3VzdG9tUm91dGluZyA9IGZ1bmN0aW9uKGlkLCBwb2ludHMpIHtcbiAgICB2YXIgcGF0aCA9IHRoaXMuX3BhdGgoaWQpO1xuXG4gICAgaWYgKCFwYXRoKSB7XG4gICAgICAgIHRocm93IEVycm9yKCdBdXRvUm91dGVyOiBOZWVkIHRvIGhhdmUgYW4gQXV0b1JvdXRlclBhdGggdHlwZSB0byBzZXQgY3VzdG9tIHBhdGggcG9pbnRzJyk7XG4gICAgfVxuXG4gICAgaWYgKHBvaW50cyA9PT0gbnVsbCkge1xuICAgICAgICBwYXRoLnNldEF1dG9Sb3V0aW5nKHRydWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX3NldEN1c3RvbVBhdGgocGF0aCwgcG9pbnRzKTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5yb3V0ZVN5bmMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5fZ3JhcGgucm91dGVTeW5jKCk7XG59O1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5yb3V0ZUFzeW5jID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICB0aGlzLl9ncmFwaC5yb3V0ZUFzeW5jKG9wdGlvbnMpO1xufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuYm94ID0gZnVuY3Rpb24gKGlkKSB7XG4gICAgdmFyIHBCb3ggPSB0aGlzLl9ib3goaWQpLCAgLy8gcHJpdmF0ZSBib3hcbiAgICAgICAgcmVjdDtcblxuICAgIGlmICghcEJveCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICByZWN0ID0gcEJveC5yZWN0O1xuICAgIHJldHVybiB7XG4gICAgICAgIGlkOiBpZCxcbiAgICAgICAgeDogcmVjdC5sZWZ0LFxuICAgICAgICB3aWR0aDogcmVjdC5yaWdodCAtIHJlY3QubGVmdCxcbiAgICAgICAgeTogcmVjdC5jZWlsLFxuICAgICAgICBoZWlnaHQ6IHJlY3QuZmxvb3IgLSByZWN0LmNlaWxcbiAgICB9O1xufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUucG9ydCA9IGZ1bmN0aW9uIChib3hJZCwgaWQpIHtcbiAgICB2YXIgY29udGFpbmVyID0gdGhpcy5fcG9ydChib3hJZCwgaWQpLFxuICAgICAgICByZWN0O1xuXG4gICAgaWYgKCFjb250YWluZXIpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmVjdCA9IGNvbnRhaW5lci5wb3J0c1swXS5yZWN0O1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgaWQ6IGlkLFxuICAgICAgICB4OiByZWN0LmxlZnQsXG4gICAgICAgIHdpZHRoOiByZWN0LnJpZ2h0IC0gcmVjdC5sZWZ0LFxuICAgICAgICB5OiByZWN0LmNlaWwsXG4gICAgICAgIGhlaWdodDogcmVjdC5mbG9vciAtIHJlY3QuY2VpbFxuICAgIH07XG59O1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5wYXRoID0gZnVuY3Rpb24gKGlkKSB7XG4gICAgdmFyIHBhdGggPSB0aGlzLl9wYXRoKGlkKTtcbiAgICByZXR1cm4geyAgLy8gVE9ETzogQ29uc2lkZXIgYWRkaW5nIHNyYywgZHN0XG4gICAgICAgIGlkOiBpZCxcbiAgICAgICAgcG9pbnRzOiBwYXRoLnBvaW50cy5tYXAoZnVuY3Rpb24ocHQpIHtcbiAgICAgICAgICAgIHJldHVybiBbcHQueCwgcHQueV07XG4gICAgICAgIH0pXG4gICAgfTtcbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLmJveGVzID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLl9ib3hJZHMpO1xufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUucG9ydHMgPSBmdW5jdGlvbiAoYm94SWQpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fcG9ydElkc1tib3hJZF0pO1xufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUucGF0aHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX3BhdGhJZHMpO1xufTtcblxuLyogKiAqICogKiAqICogUHJpdmF0ZSBBUEkgKiAqICogKiAqICogKi9cblxuLy8gR2V0dGVyc1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5fYm94ID0gZnVuY3Rpb24gKGlkKSB7XG4gICAgdmFyIHBJZCA9IHRoaXMuX2JveElkc1tpZF07XG4gICAgcmV0dXJuIHRoaXMuX2dyYXBoLmJveGVzW3BJZF0gfHwgbnVsbDtcbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLl9wb3J0ID0gZnVuY3Rpb24gKGJveElkLCBpZCkge1xuICAgIGFzc2VydChib3hJZCAhPT0gdW5kZWZpbmVkICYmIGlkICE9PSB1bmRlZmluZWQsICdNaXNzaW5nICcgKyAoIWJveElkID8gJ2JveElkJyA6ICdpZCcpKTtcbiAgICByZXR1cm4gdGhpcy5fcG9ydElkc1tib3hJZF1baWRdO1xufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuX3BhdGggPSBmdW5jdGlvbiAoaWQpIHtcbiAgICB2YXIgcElkID0gdGhpcy5fcGF0aElkc1tpZF07XG4gICAgZm9yICh2YXIgaSA9IHRoaXMuX2dyYXBoLnBhdGhzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICBpZiAodGhpcy5fZ3JhcGgucGF0aHNbaV0uaWQgPT09IHBJZCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2dyYXBoLnBhdGhzW2ldO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xufTtcblxuLy8gQm94ZXNcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuX2NyZWF0ZUJveCA9IGZ1bmN0aW9uIChwYXJhbXMpIHtcbiAgICB2YXIgeDEgPSBwYXJhbXMueDEsXG4gICAgICAgIHgyID0gcGFyYW1zLngyLFxuICAgICAgICB5MSA9IHBhcmFtcy55MSxcbiAgICAgICAgeTIgPSBwYXJhbXMueTIsXG4gICAgICAgIGJveCA9IHRoaXMuX2dyYXBoLmNyZWF0ZUJveCgpLFxuICAgICAgICByZWN0ID0gbmV3IEFyUmVjdCh4MSwgeTEsIHgyLCB5Mik7XG5cbiAgICBhc3NlcnQoIWlzTmFOKHgxICsgeDIgKyB5MSArIHkyKSwgJ01pc3Npbmcgc2l6ZSBpbmZvIGZvciBib3gnKTtcblxuICAgIHRoaXMuX3NldFZhbGlkUmVjdFNpemUocmVjdCk7XG4gICAgYm94LnNldFJlY3QocmVjdCk7XG5cbiAgICAvLyBBZGQgdGhlIGJveCB0byB0aGUgZ3JhcGhcbiAgICB0aGlzLl9ncmFwaC5hZGRCb3goYm94KTtcbiAgICAvLyBSZWNvcmQga2VlcGluZyBpcyBub3QgZG9uZSBpbiB0aGlzIGZ1bmN0aW9uIGJjIHRoaXMgZnVuY3Rpb25cbiAgICAvLyBpcyByZXVzZWQgZm9yIHRoZSBwb3J0IGNvbnRhaW5lcnNcbiAgICByZXR1cm4gYm94O1xufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuX3VwZGF0ZUJveCA9IGZ1bmN0aW9uIChpZCwgcGFyYW1zKSB7ICAvLyBwdWJsaWMgaWRcbiAgICB2YXIgYm94ID0gdGhpcy5fYm94KGlkKSxcbiAgICAgICAgcmVjdCA9IGJveC5yZWN0LFxuICAgICAgICBuZXdXaWR0aCA9IHBhcmFtcy54MiAtIHBhcmFtcy54MSxcbiAgICAgICAgbmV3SGVpZ2h0ID0gcGFyYW1zLnkyIC0gcGFyYW1zLnkxLFxuICAgICAgICBkeCxcbiAgICAgICAgZHksXG4gICAgICAgIG5ld1JlY3Q7XG5cbiAgICAvLyBTaGlmdFxuICAgIGlmIChuZXdIZWlnaHQgPT09IHJlY3QuZ2V0SGVpZ2h0KCkgJiYgbmV3V2lkdGggPT09IHJlY3QuZ2V0V2lkdGgoKSkge1xuICAgICAgICBkeCA9IHBhcmFtcy54MSAtIHJlY3QubGVmdDtcbiAgICAgICAgZHkgPSBwYXJhbXMueTEgLSByZWN0LmNlaWw7XG4gICAgICAgIHRoaXMuX2dyYXBoLnNoaWZ0Qm94QnkoYm94LCB7Y3g6IGR4LCBjeTogZHl9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBuZXdSZWN0ID0gbmV3IEFyUmVjdChwYXJhbXMueDEsIHBhcmFtcy55MSwgcGFyYW1zLngyLCBwYXJhbXMueTIpO1xuICAgICAgICB0aGlzLl9ncmFwaC5zZXRCb3hSZWN0KGJveCwgbmV3UmVjdCk7XG4gICAgfVxuXG59O1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5fcmVtb3ZlQm94ID0gZnVuY3Rpb24gKGlkKSB7ICAvLyBwdWJsaWMgaWRcbiAgICB2YXIgYm94ID0gdGhpcy5fYm94KGlkKSxcbiAgICAgICAgcG9ydHMgPSBPYmplY3Qua2V5cyh0aGlzLl9wb3J0SWRzW2lkXSk7XG5cbiAgICAvLyBSZW1vdmUgYWxsIHBvcnRzXG4gICAgZm9yICh2YXIgaSA9IHBvcnRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICB0aGlzLl9yZW1vdmVQb3J0KGlkLCBwb3J0c1tpXSk7XG4gICAgfVxuXG4gICAgdGhpcy5fZ3JhcGguZGVsZXRlQm94KGJveCk7XG4gICAgZGVsZXRlIHRoaXMuX2JveElkc1tpZF07XG4gICAgZGVsZXRlIHRoaXMuX3BvcnRJZHNbaWRdO1xuXG4gICAgaWYgKHRoaXMuX3BhdGhzVG9VcGRhdGVPbkFkZGl0aW9uW2lkXSAmJiB0aGlzLl9wYXRoc1RvVXBkYXRlT25BZGRpdGlvbltpZF0ubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLl9wYXRoc1RvVXBkYXRlT25BZGRpdGlvbltpZF07XG4gICAgfVxufTtcblxuLy8gUGF0aHNcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuX2NyZWF0ZVBhdGggPSBmdW5jdGlvbiAoaWQsIHNyY0lkLCBkc3RJZCkgeyAgLy8gcHVibGljIGlkXG4gICAgdmFyIHNyY1BvcnRzID0gdGhpcy5fZ2V0UG9ydHNGb3Ioc3JjSWQpLCAgLy8gRklYTUU6IHNob3VsZCBiZSBhYmxlIHRvIHNwZWNpZnkgcG9ydHNcbiAgICAgICAgZHN0UG9ydHMgPSB0aGlzLl9nZXRQb3J0c0Zvcihkc3RJZCksXG4gICAgICAgIHBvcnRzID0gc3JjUG9ydHMuY29uY2F0KGRzdFBvcnRzKSxcbiAgICAgICAgcGF0aDtcblxuICAgIGFzc2VydChzcmNQb3J0cywgJ01pc3Npbmcgc3JjUG9ydHMgKCcgKyBzcmNQb3J0cyArICcpJyk7XG4gICAgYXNzZXJ0KGRzdFBvcnRzLCAnTWlzc2luZyBkc3RQb3J0cyAoJyArIGRzdFBvcnRzICsgJyknKTtcblxuICAgIHBhdGggPSB0aGlzLl9ncmFwaC5hZGRQYXRoKHRydWUsIHNyY1BvcnRzLCBkc3RQb3J0cyk7XG4gICAgcGF0aC5pZCA9IGlkO1xuICAgIHRoaXMuX3BhdGhJZHNbaWRdID0gcGF0aC5pZDtcblxuICAgIC8vIFVwZGF0ZSB0aGUgdXBkYXRlcyBkaWN0aW9uYXJpZXNcbiAgICBmb3IgKHZhciBpID0gcG9ydHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIGlmICghdGhpcy5fcGF0aHNUb1VwZGF0ZU9uRGVsZXRpb25bcG9ydHNbaV0uaWRdKSB7XG4gICAgICAgICAgICB0aGlzLl9wYXRoc1RvVXBkYXRlT25EZWxldGlvbltwb3J0c1tpXS5pZF0gPSBbXTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9wYXRoc1RvVXBkYXRlT25EZWxldGlvbltwb3J0c1tpXS5pZF0ucHVzaChwYXRoKTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIHNyY0lkID09PSAnc3RyaW5nJykge1xuICAgICAgICBpZiAoIXRoaXMuX3BhdGhzVG9VcGRhdGVPbkFkZGl0aW9uW3NyY0lkXSkge1xuICAgICAgICAgICAgdGhpcy5fcGF0aHNUb1VwZGF0ZU9uQWRkaXRpb25bc3JjSWRdID0gW107XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fcGF0aHNUb1VwZGF0ZU9uQWRkaXRpb25bc3JjSWRdLnB1c2gocGF0aCk7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgZHN0SWQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGlmICghdGhpcy5fcGF0aHNUb1VwZGF0ZU9uQWRkaXRpb25bZHN0SWRdKSB7XG4gICAgICAgICAgICB0aGlzLl9wYXRoc1RvVXBkYXRlT25BZGRpdGlvbltkc3RJZF0gPSBbXTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9wYXRoc1RvVXBkYXRlT25BZGRpdGlvbltkc3RJZF0ucHVzaChwYXRoKTtcbiAgICB9XG4gICAgdGhpcy5fcGF0aFNyY1tpZF0gPSBzcmNJZDtcbiAgICB0aGlzLl9wYXRoRHN0W2lkXSA9IGRzdElkO1xufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuX2dldFBvcnRzRm9yID0gZnVuY3Rpb24gKGJveElkKSB7XG4gICAgaWYgKGJveElkIGluc3RhbmNlb2YgQXJyYXkpIHsgIC8vIGxpc3Qgb2YgcG9ydHMgLT4gbm90IGEgYm94SWRcbiAgICAgICAgLy8gRklYTUU6IFRoZXNlIHBvcnRzIHdvdWxkIGFsc28gbmVlZCB0byBiZSByZXNvbHZlZCFcbiAgICAgICAgcmV0dXJuIGJveElkO1xuICAgIH0gZWxzZSB7ICAvLyBib3hJZCBpcyBhIGJveCBpZCAtPiBnZXQgdGhlIHBvcnRzXG4gICAgICAgIHZhciBwb3J0SWRzID0gT2JqZWN0LmtleXModGhpcy5fcG9ydElkc1tib3hJZF0pLFxuICAgICAgICAgICAgcG9ydHMgPSBbXTtcblxuICAgICAgICBmb3IgKHZhciBpID0gcG9ydElkcy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgICAgIGFzc2VydCh0aGlzLl9wb3J0SWRzW2JveElkXVtwb3J0SWRzW2ldXS5wb3J0cy5sZW5ndGggPT09IDEpO1xuICAgICAgICAgICAgcG9ydHMucHVzaCh0aGlzLl9wb3J0SWRzW2JveElkXVtwb3J0SWRzW2ldXS5wb3J0c1swXSk7XG4gICAgICAgIH1cbiAgICAgICAgYXNzZXJ0KHBvcnRzLCAnbm8gcG9ydHMgZm91bmQgKCcgKyBwb3J0cyArICcpJyk7XG4gICAgICAgIGZvciAodmFyIGkgPSBwb3J0cy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgICAgIGFzc2VydCAocG9ydHNbaV0ub3duZXIsICdJbnZhbGlkIG93bmVyJyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHBvcnRzO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLl91cGRhdGVQYXRoID0gZnVuY3Rpb24gKGlkLCBzcmNJZCwgZHN0SWQpIHsgIC8vIHB1YmxpYyBpZFxuICAgIHRoaXMuX3JlbW92ZVBhdGgoaWQsIHRydWUpO1xuICAgIHRoaXMuX2NyZWF0ZVBhdGgoaWQsIHNyY0lkLCBkc3RJZCk7XG59O1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5fcmVtb3ZlUGF0aCA9IGZ1bmN0aW9uIChpZCwgc2lsZW50KSB7ICAvLyBwdWJsaWMgaWRcbiAgICB2YXIgcGF0aCA9IHRoaXMuX3BhdGgoaWQpLFxuICAgICAgICBzcmMgPSB0aGlzLl9wYXRoU3JjW2lkXSxcbiAgICAgICAgZHN0ID0gdGhpcy5fcGF0aERzdFtpZF07XG5cbiAgICB0aGlzLl9ncmFwaC5kZWxldGVQYXRoKHBhdGgpO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXRoSWRzW2lkXTtcbiAgICBkZWxldGUgdGhpcy5fcGF0aFNyY1tpZF07XG4gICAgZGVsZXRlIHRoaXMuX3BhdGhEc3RbaWRdO1xuXG4gICAgaWYgKCFzaWxlbnQpIHtcbiAgICAgICAgdGhpcy5fY2xlYXJPbGRCb3hSZWNvcmRzKHNyYywgaWQpO1xuICAgICAgICB0aGlzLl9jbGVhck9sZEJveFJlY29yZHMoZHN0LCBpZCk7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuX2NsZWFyT2xkQm94UmVjb3JkcyA9IGZ1bmN0aW9uIChpZCwgcGF0aElkKSB7ICAvLyBwdWJsaWMgaWRcbiAgICB2YXIgYm94SXNEZWxldGVkID0gIXRoaXMuX2JveElkc1tpZF0sXG4gICAgICAgIGhhc1JlY29yZCA9IHRoaXMuX3BhdGhzVG9VcGRhdGVPbkFkZGl0aW9uLmhhc093blByb3BlcnR5KGlkKTtcblxuICAgIGlmIChoYXNSZWNvcmQpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IHRoaXMuX3BhdGhzVG9VcGRhdGVPbkFkZGl0aW9uW2lkXS5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9wYXRoc1RvVXBkYXRlT25BZGRpdGlvbltpZF1baV0uaWQgPT09IHBhdGhJZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3BhdGhzVG9VcGRhdGVPbkFkZGl0aW9uW2lkXS5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGJveElzRGVsZXRlZCAmJiB0aGlzLl9wYXRoc1RvVXBkYXRlT25BZGRpdGlvbltpZF0ubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fcGF0aHNUb1VwZGF0ZU9uQWRkaXRpb25baWRdO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuX3NldEN1c3RvbVBhdGggPSBmdW5jdGlvbiAocGF0aCwgcG9pbnRzKSB7ICAvLyBwdWJsaWMgaWRcbiAgICAvLyBDb252ZXJ0IHBvaW50cyB0byBhcnJheSBvZiBBclBvaW50c1xuICAgIHBvaW50cyA9IHBvaW50cy5tYXAoZnVuY3Rpb24gKHBvaW50KSB7XG4gICAgICAgIHJldHVybiBuZXcgQXJQb2ludChwb2ludFswXSwgcG9pbnRbMV0pO1xuICAgIH0pO1xuXG4gICAgcGF0aC5zZXRDdXN0b21QYXRoUG9pbnRzKHBvaW50cyk7XG4gICAgcGF0aC5zZXRBdXRvUm91dGluZyhmYWxzZSk7XG59O1xuXG4vLyBQb3J0c1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5fY3JlYXRlUG9ydCA9IGZ1bmN0aW9uIChib3hJZCwgcG9ydElkLCBhcmVhKSB7ICAvLyBhcmVhOiBbW3gxLCB5MV0sIFt4MiwgeTJdXVxuICAgIHZhciBib3ggPSB0aGlzLl9ib3goYm94SWQpLFxuICAgICAgICBjb250YWluZXIsXG4gICAgICAgIGNSZWN0ID0gbmV3IEFyUmVjdCgpLFxuICAgICAgICBwb3J0ID0gbmV3IEF1dG9Sb3V0ZXJQb3J0KCksXG4gICAgICAgIHJlY3QgPSB0aGlzLl9jcmVhdGVSZWN0RnJvbUFyZWEoYXJlYSksXG4gICAgICAgIGF0dHI7XG5cbiAgICAvLyBDcmVhdGUgdGhlIHBvcnRcbiAgICBhdHRyID0gdGhpcy5fZ2V0UG9ydEF0dHJpYnV0ZXMoYm94LnJlY3QsIGFyZWEpO1xuICAgIHBvcnQuaWQgPSBib3hJZCArICcvfFxcXFwnICsgcG9ydElkO1xuICAgIHBvcnQuc2V0TGltaXRlZERpcnMoZmFsc2UpO1xuICAgIHBvcnQuYXR0cmlidXRlcyA9IGF0dHI7XG4gICAgdGhpcy5fc2V0VmFsaWRSZWN0U2l6ZShyZWN0KTtcbiAgICBwb3J0LnNldFJlY3QocmVjdCk7XG5cbiAgICAvLyBDcmVhdGUgYSBjb250YWluZXIgcmVjdFxuICAgIGNSZWN0LmFzc2lnbihyZWN0KTtcbiAgICBjUmVjdC5pbmZsYXRlUmVjdCgxKTtcbiAgICBjb250YWluZXIgPSB0aGlzLl9jcmVhdGVCb3goe1xuICAgICAgICB4MTogY1JlY3QubGVmdCxcbiAgICAgICAgeTE6IGNSZWN0LmNlaWwsXG4gICAgICAgIHgyOiBjUmVjdC5yaWdodCxcbiAgICAgICAgeTI6IGNSZWN0LmZsb29yXG4gICAgfSk7XG5cbiAgICBib3guYWRkQ2hpbGQoY29udGFpbmVyKTtcbiAgICBjb250YWluZXIuYWRkUG9ydChwb3J0KTtcbiAgICB0aGlzLl9wb3J0SWRzW2JveElkXVtwb3J0SWRdID0gY29udGFpbmVyO1xuXG4gICAgLy8gVXBkYXRlIHBhdGhzIGFzIG5lZWRlZFxuICAgIHRoaXMuX3VwZGF0ZVBhdGhzRm9yQm94KGJveElkKTtcbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLl91cGRhdGVQYXRoc0ZvckJveCA9IGZ1bmN0aW9uIChib3hJZCkge1xuICAgIHZhciBwYXRocyA9IHRoaXMuX3BhdGhzVG9VcGRhdGVPbkFkZGl0aW9uW2JveElkXSB8fCBbXSxcbiAgICAgICAgc3RhcnQsXG4gICAgICAgIGVuZDtcblxuICAgIGZvciAodmFyIGkgPSBwYXRocy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgLy8gR2V0IHRoZSBuZXcgcG9ydHNcbiAgICAgICAgc3RhcnQgPSB0aGlzLl9nZXRQb3J0c0Zvcih0aGlzLl9wYXRoU3JjW3BhdGhzW2ldLmlkXSk7XG4gICAgICAgIGVuZCA9IHRoaXMuX2dldFBvcnRzRm9yKHRoaXMuX3BhdGhEc3RbcGF0aHNbaV0uaWRdKTtcblxuICAgICAgICAvLyBEaXNjb25uZWN0IGFuZCB1cGRhdGUgcGF0aFxuICAgICAgICB0aGlzLl9ncmFwaC5kaXNjb25uZWN0KHBhdGhzW2ldKTtcbiAgICAgICAgaWYgKHN0YXJ0Lmxlbmd0aCAmJiBlbmQubGVuZ3RoKSB7XG4gICAgICAgICAgICBwYXRoc1tpXS5zZXRTdGFydEVuZFBvcnRzKHN0YXJ0LCBlbmQpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuX2NyZWF0ZVJlY3RGcm9tQXJlYSA9IGZ1bmN0aW9uIChhcmVhKSB7XG4gICAgdmFyIHJlY3QgPSBuZXcgQXJSZWN0KGFyZWEueDEsIGFyZWEueTEsIGFyZWEueDIsIGFyZWEueTIpO1xuICAgIHRoaXMuX3NldFZhbGlkUmVjdFNpemUocmVjdCk7XG4gICAgcmV0dXJuIHJlY3Q7XG59O1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5fZ2V0UG9ydEF0dHJpYnV0ZXMgPSBmdW5jdGlvbiAocmVjdCwgYXJlYSkge1xuICAgIHZhciBhdHRyID0gMCxcbiAgICAgICAgeDEgPSBhcmVhLngxLFxuICAgICAgICB4MiA9IGFyZWEueDIsXG4gICAgICAgIHkxID0gYXJlYS55MSxcbiAgICAgICAgeTIgPSBhcmVhLnkyLFxuICAgICAgICBob3Jpem9udGFsID0geTEgPT09IHkyO1xuXG4gICAgaWYgKGhvcml6b250YWwpIHtcbiAgICAgICAgaWYgKE1hdGguYWJzKHkxIC0gcmVjdC5jZWlsKSA8IE1hdGguYWJzKHkxIC0gcmVjdC5mbG9vcikpIHsgIC8vIENsb3NlciB0byB0aGUgdG9wXG4gICAgICAgICAgICBhdHRyID0gQ09OU1RBTlRTLlBvcnRTdGFydE9uVG9wICsgQ09OU1RBTlRTLlBvcnRFbmRPblRvcDtcbiAgICAgICAgfSBlbHNlIHsgIC8vIENsb3NlciB0byB0aGUgdG9wIChob3Jpem9udGFsKVxuICAgICAgICAgICAgYXR0ciA9IENPTlNUQU5UUy5Qb3J0U3RhcnRPbkJvdHRvbSArIENPTlNUQU5UUy5Qb3J0RW5kT25Cb3R0b207XG4gICAgICAgIH1cblxuICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChNYXRoLmFicyh4MSAtIHJlY3QubGVmdCkgPCBNYXRoLmFicyh4MSAtIHJlY3QucmlnaHQpKSB7ICAvLyBDbG9zZXIgdG8gdGhlIGxlZnRcbiAgICAgICAgICAgIGF0dHIgPSBDT05TVEFOVFMuUG9ydFN0YXJ0T25MZWZ0ICsgQ09OU1RBTlRTLlBvcnRFbmRPbkxlZnQ7XG4gICAgICAgIH0gZWxzZSB7ICAvLyBDbG9zZXIgdG8gdGhlIHJpZ2h0ICh2ZXJ0aWNhbClcbiAgICAgICAgICAgIGF0dHIgPSBDT05TVEFOVFMuUG9ydFN0YXJ0T25SaWdodCArIENPTlNUQU5UUy5Qb3J0RW5kT25SaWdodDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBhdHRyO1xufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuX3VwZGF0ZVBvcnQgPSBmdW5jdGlvbiAoYm94SWQsIHBvcnRJZCwgYXJlYSkge1xuICAgIHZhciBib3ggPSB0aGlzLl9ib3goYm94SWQpLFxuICAgICAgICBjb250YWluZXIgPSB0aGlzLl9wb3J0KGJveElkLCBwb3J0SWQpLFxuICAgICAgICBjUmVjdCA9IGNvbnRhaW5lci5yZWN0LFxuICAgICAgICBwb3J0ID0gY29udGFpbmVyLnBvcnRzWzBdLFxuICAgICAgICByZWN0ID0gdGhpcy5fY3JlYXRlUmVjdEZyb21BcmVhKGFyZWEpLFxuICAgICAgICBhdHRyO1xuXG4gICAgLy8gVXBkYXRlIHRoZSBwb3J0J3MgcmVjdFxuICAgIGF0dHIgPSB0aGlzLl9nZXRQb3J0QXR0cmlidXRlcyhib3gucmVjdCwgYXJlYSk7XG4gICAgcG9ydC5zZXRMaW1pdGVkRGlycyhmYWxzZSk7XG4gICAgcG9ydC5hdHRyaWJ1dGVzID0gYXR0cjtcbiAgICB0aGlzLl9zZXRWYWxpZFJlY3RTaXplKHJlY3QpO1xuICAgIHBvcnQuc2V0UmVjdChyZWN0KTtcblxuICAgIGNSZWN0LmFzc2lnbihwb3J0LnJlY3QpO1xuICAgIGNSZWN0LmluZmxhdGVSZWN0KDEpO1xuICAgIGNvbnRhaW5lci5zZXRSZWN0KGNSZWN0KTtcbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLl9yZW1vdmVQb3J0ID0gZnVuY3Rpb24gKGJveElkLCBwb3J0SWQpIHtcbiAgICB2YXIgY29udGFpbmVyID0gdGhpcy5fcG9ydChib3hJZCwgcG9ydElkKSxcbiAgICAgICAgcG9ydCA9IGNvbnRhaW5lci5wb3J0c1swXSxcbiAgICAgICAgcGF0aHMgPSB0aGlzLl9wYXRoc1RvVXBkYXRlT25EZWxldGlvbltwb3J0LmlkXSB8fCBbXSxcbiAgICAgICAgc3RhcnQsXG4gICAgICAgIGVuZDtcblxuICAgIHRoaXMuX2dyYXBoLmRlbGV0ZUJveChjb250YWluZXIpO1xuXG4gICAgLy8gVXBkYXRlIHBhdGhzXG4gICAgZGVsZXRlIHRoaXMuX3BhdGhzVG9VcGRhdGVPbkRlbGV0aW9uW3BvcnQuaWRdO1xuICAgIGZvciAodmFyIGkgPSBwYXRocy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgc3RhcnQgPSBwYXRoc1tpXS5zdGFydHBvcnRzO1xuICAgICAgICBlbmQgPSBwYXRoc1tpXS5lbmRwb3J0cztcbiAgICAgICAgdXRpbHMucmVtb3ZlRnJvbUFycmF5cyhwb3J0LCBzdGFydCwgZW5kKTtcbiAgICAgICAgaWYgKHN0YXJ0Lmxlbmd0aCAmJiBlbmQubGVuZ3RoKSB7XG4gICAgICAgICAgICBwYXRoc1tpXS5zZXRTdGFydEVuZFBvcnRzKHN0YXJ0LCBlbmQpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9wb3J0SWRzW2JveElkXVtwb3J0SWRdO1xufTtcblxuLy8gU2hhcmVkIHV0aWxpdGllc1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5fc2V0VmFsaWRSZWN0U2l6ZSA9IGZ1bmN0aW9uIChyZWN0KSB7XG4gICAgLy8gTWFrZSBzdXJlIHRoZSByZWN0IGlzIGF0IGxlYXN0IDN4M1xuICAgIHZhciBoZWlnaHQgPSByZWN0LmdldEhlaWdodCgpLFxuICAgICAgICB3aWR0aCA9IHJlY3QuZ2V0V2lkdGgoKSxcbiAgICAgICAgZHggPSBNYXRoLm1heCgoMyAtIHdpZHRoKSAvIDIsIDApLFxuICAgICAgICBkeSA9IE1hdGgubWF4KCgzIC0gaGVpZ2h0KSAvIDIsIDApO1xuXG4gICAgcmVjdC5pbmZsYXRlUmVjdChkeCwgZHkpO1xuICAgIHJldHVybiByZWN0O1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBdXRvUm91dGVyO1xuIl19
