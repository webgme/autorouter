(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.AutoRouterReplayer = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// http://wiki.commonjs.org/wiki/Unit_Testing/1.0
//
// THIS IS NOT TESTED NOR LIKELY TO WORK OUTSIDE V8!
//
// Originally from narwhal.js (http://narwhaljs.org)
// Copyright (c) 2009 Thomas Robinson <280north.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the 'Software'), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
// ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

// when used in node, this will actually load the util module we depend on
// versus loading the builtin util module as happens otherwise
// this is a bug in node module loading as far as I am concerned
var util = require('util/');

var pSlice = Array.prototype.slice;
var hasOwn = Object.prototype.hasOwnProperty;

// 1. The assert module provides functions that throw
// AssertionError's when particular conditions are not met. The
// assert module must conform to the following interface.

var assert = module.exports = ok;

// 2. The AssertionError is defined in assert.
// new assert.AssertionError({ message: message,
//                             actual: actual,
//                             expected: expected })

assert.AssertionError = function AssertionError(options) {
  this.name = 'AssertionError';
  this.actual = options.actual;
  this.expected = options.expected;
  this.operator = options.operator;
  if (options.message) {
    this.message = options.message;
    this.generatedMessage = false;
  } else {
    this.message = getMessage(this);
    this.generatedMessage = true;
  }
  var stackStartFunction = options.stackStartFunction || fail;

  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, stackStartFunction);
  }
  else {
    // non v8 browsers so we can have a stacktrace
    var err = new Error();
    if (err.stack) {
      var out = err.stack;

      // try to strip useless frames
      var fn_name = stackStartFunction.name;
      var idx = out.indexOf('\n' + fn_name);
      if (idx >= 0) {
        // once we have located the function frame
        // we need to strip out everything before it (and its line)
        var next_line = out.indexOf('\n', idx + 1);
        out = out.substring(next_line + 1);
      }

      this.stack = out;
    }
  }
};

// assert.AssertionError instanceof Error
util.inherits(assert.AssertionError, Error);

function replacer(key, value) {
  if (util.isUndefined(value)) {
    return '' + value;
  }
  if (util.isNumber(value) && !isFinite(value)) {
    return value.toString();
  }
  if (util.isFunction(value) || util.isRegExp(value)) {
    return value.toString();
  }
  return value;
}

function truncate(s, n) {
  if (util.isString(s)) {
    return s.length < n ? s : s.slice(0, n);
  } else {
    return s;
  }
}

function getMessage(self) {
  return truncate(JSON.stringify(self.actual, replacer), 128) + ' ' +
         self.operator + ' ' +
         truncate(JSON.stringify(self.expected, replacer), 128);
}

// At present only the three keys mentioned above are used and
// understood by the spec. Implementations or sub modules can pass
// other keys to the AssertionError's constructor - they will be
// ignored.

// 3. All of the following functions must throw an AssertionError
// when a corresponding condition is not met, with a message that
// may be undefined if not provided.  All assertion methods provide
// both the actual and expected values to the assertion error for
// display purposes.

function fail(actual, expected, message, operator, stackStartFunction) {
  throw new assert.AssertionError({
    message: message,
    actual: actual,
    expected: expected,
    operator: operator,
    stackStartFunction: stackStartFunction
  });
}

// EXTENSION! allows for well behaved errors defined elsewhere.
assert.fail = fail;

// 4. Pure assertion tests whether a value is truthy, as determined
// by !!guard.
// assert.ok(guard, message_opt);
// This statement is equivalent to assert.equal(true, !!guard,
// message_opt);. To test strictly for the value true, use
// assert.strictEqual(true, guard, message_opt);.

function ok(value, message) {
  if (!value) fail(value, true, message, '==', assert.ok);
}
assert.ok = ok;

// 5. The equality assertion tests shallow, coercive equality with
// ==.
// assert.equal(actual, expected, message_opt);

assert.equal = function equal(actual, expected, message) {
  if (actual != expected) fail(actual, expected, message, '==', assert.equal);
};

// 6. The non-equality assertion tests for whether two objects are not equal
// with != assert.notEqual(actual, expected, message_opt);

assert.notEqual = function notEqual(actual, expected, message) {
  if (actual == expected) {
    fail(actual, expected, message, '!=', assert.notEqual);
  }
};

// 7. The equivalence assertion tests a deep equality relation.
// assert.deepEqual(actual, expected, message_opt);

assert.deepEqual = function deepEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected)) {
    fail(actual, expected, message, 'deepEqual', assert.deepEqual);
  }
};

function _deepEqual(actual, expected) {
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;

  } else if (util.isBuffer(actual) && util.isBuffer(expected)) {
    if (actual.length != expected.length) return false;

    for (var i = 0; i < actual.length; i++) {
      if (actual[i] !== expected[i]) return false;
    }

    return true;

  // 7.2. If the expected value is a Date object, the actual value is
  // equivalent if it is also a Date object that refers to the same time.
  } else if (util.isDate(actual) && util.isDate(expected)) {
    return actual.getTime() === expected.getTime();

  // 7.3 If the expected value is a RegExp object, the actual value is
  // equivalent if it is also a RegExp object with the same source and
  // properties (`global`, `multiline`, `lastIndex`, `ignoreCase`).
  } else if (util.isRegExp(actual) && util.isRegExp(expected)) {
    return actual.source === expected.source &&
           actual.global === expected.global &&
           actual.multiline === expected.multiline &&
           actual.lastIndex === expected.lastIndex &&
           actual.ignoreCase === expected.ignoreCase;

  // 7.4. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if (!util.isObject(actual) && !util.isObject(expected)) {
    return actual == expected;

  // 7.5 For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else {
    return objEquiv(actual, expected);
  }
}

function isArguments(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
}

function objEquiv(a, b) {
  if (util.isNullOrUndefined(a) || util.isNullOrUndefined(b))
    return false;
  // an identical 'prototype' property.
  if (a.prototype !== b.prototype) return false;
  // if one is a primitive, the other must be same
  if (util.isPrimitive(a) || util.isPrimitive(b)) {
    return a === b;
  }
  var aIsArgs = isArguments(a),
      bIsArgs = isArguments(b);
  if ((aIsArgs && !bIsArgs) || (!aIsArgs && bIsArgs))
    return false;
  if (aIsArgs) {
    a = pSlice.call(a);
    b = pSlice.call(b);
    return _deepEqual(a, b);
  }
  var ka = objectKeys(a),
      kb = objectKeys(b),
      key, i;
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length != kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] != kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!_deepEqual(a[key], b[key])) return false;
  }
  return true;
}

// 8. The non-equivalence assertion tests for any deep inequality.
// assert.notDeepEqual(actual, expected, message_opt);

assert.notDeepEqual = function notDeepEqual(actual, expected, message) {
  if (_deepEqual(actual, expected)) {
    fail(actual, expected, message, 'notDeepEqual', assert.notDeepEqual);
  }
};

// 9. The strict equality assertion tests strict equality, as determined by ===.
// assert.strictEqual(actual, expected, message_opt);

assert.strictEqual = function strictEqual(actual, expected, message) {
  if (actual !== expected) {
    fail(actual, expected, message, '===', assert.strictEqual);
  }
};

// 10. The strict non-equality assertion tests for strict inequality, as
// determined by !==.  assert.notStrictEqual(actual, expected, message_opt);

assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
  if (actual === expected) {
    fail(actual, expected, message, '!==', assert.notStrictEqual);
  }
};

function expectedException(actual, expected) {
  if (!actual || !expected) {
    return false;
  }

  if (Object.prototype.toString.call(expected) == '[object RegExp]') {
    return expected.test(actual);
  } else if (actual instanceof expected) {
    return true;
  } else if (expected.call({}, actual) === true) {
    return true;
  }

  return false;
}

function _throws(shouldThrow, block, expected, message) {
  var actual;

  if (util.isString(expected)) {
    message = expected;
    expected = null;
  }

  try {
    block();
  } catch (e) {
    actual = e;
  }

  message = (expected && expected.name ? ' (' + expected.name + ').' : '.') +
            (message ? ' ' + message : '.');

  if (shouldThrow && !actual) {
    fail(actual, expected, 'Missing expected exception' + message);
  }

  if (!shouldThrow && expectedException(actual, expected)) {
    fail(actual, expected, 'Got unwanted exception' + message);
  }

  if ((shouldThrow && actual && expected &&
      !expectedException(actual, expected)) || (!shouldThrow && actual)) {
    throw actual;
  }
}

// 11. Expected to throw an error:
// assert.throws(block, Error_opt, message_opt);

assert.throws = function(block, /*optional*/error, /*optional*/message) {
  _throws.apply(this, [true].concat(pSlice.call(arguments)));
};

// EXTENSION! This is annoying to write outside this module.
assert.doesNotThrow = function(block, /*optional*/message) {
  _throws.apply(this, [false].concat(pSlice.call(arguments)));
};

assert.ifError = function(err) { if (err) {throw err;}};

var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    if (hasOwn.call(obj, key)) keys.push(key);
  }
  return keys;
};

},{"util/":5}],2:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],3:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],4:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],5:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./support/isBuffer":4,"_process":3,"inherits":2}],6:[function(require,module,exports){

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

},{"./debug":7}],7:[function(require,module,exports){

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

},{"ms":8}],8:[function(require,module,exports){
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

},{}],9:[function(require,module,exports){
/**
 * lodash 3.2.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var baseAssign = require('lodash._baseassign'),
    createAssigner = require('lodash._createassigner'),
    keys = require('lodash.keys');

/**
 * A specialized version of `_.assign` for customizing assigned values without
 * support for argument juggling, multiple sources, and `this` binding `customizer`
 * functions.
 *
 * @private
 * @param {Object} object The destination object.
 * @param {Object} source The source object.
 * @param {Function} customizer The function to customize assigned values.
 * @returns {Object} Returns `object`.
 */
function assignWith(object, source, customizer) {
  var index = -1,
      props = keys(source),
      length = props.length;

  while (++index < length) {
    var key = props[index],
        value = object[key],
        result = customizer(value, source[key], key, object, source);

    if ((result === result ? (result !== value) : (value === value)) ||
        (value === undefined && !(key in object))) {
      object[key] = result;
    }
  }
  return object;
}

/**
 * Assigns own enumerable properties of source object(s) to the destination
 * object. Subsequent sources overwrite property assignments of previous sources.
 * If `customizer` is provided it is invoked to produce the assigned values.
 * The `customizer` is bound to `thisArg` and invoked with five arguments:
 * (objectValue, sourceValue, key, object, source).
 *
 * **Note:** This method mutates `object` and is based on
 * [`Object.assign`](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-object.assign).
 *
 * @static
 * @memberOf _
 * @alias extend
 * @category Object
 * @param {Object} object The destination object.
 * @param {...Object} [sources] The source objects.
 * @param {Function} [customizer] The function to customize assigned values.
 * @param {*} [thisArg] The `this` binding of `customizer`.
 * @returns {Object} Returns `object`.
 * @example
 *
 * _.assign({ 'user': 'barney' }, { 'age': 40 }, { 'user': 'fred' });
 * // => { 'user': 'fred', 'age': 40 }
 *
 * // using a customizer callback
 * var defaults = _.partialRight(_.assign, function(value, other) {
 *   return _.isUndefined(value) ? other : value;
 * });
 *
 * defaults({ 'user': 'barney' }, { 'age': 36 }, { 'user': 'fred' });
 * // => { 'user': 'barney', 'age': 36 }
 */
var assign = createAssigner(function(object, source, customizer) {
  return customizer
    ? assignWith(object, source, customizer)
    : baseAssign(object, source);
});

module.exports = assign;

},{"lodash._baseassign":10,"lodash._createassigner":12,"lodash.keys":16}],10:[function(require,module,exports){
/**
 * lodash 3.2.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var baseCopy = require('lodash._basecopy'),
    keys = require('lodash.keys');

/**
 * The base implementation of `_.assign` without support for argument juggling,
 * multiple sources, and `customizer` functions.
 *
 * @private
 * @param {Object} object The destination object.
 * @param {Object} source The source object.
 * @returns {Object} Returns `object`.
 */
function baseAssign(object, source) {
  return source == null
    ? object
    : baseCopy(source, keys(source), object);
}

module.exports = baseAssign;

},{"lodash._basecopy":11,"lodash.keys":16}],11:[function(require,module,exports){
/**
 * lodash 3.0.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/**
 * Copies properties of `source` to `object`.
 *
 * @private
 * @param {Object} source The object to copy properties from.
 * @param {Array} props The property names to copy.
 * @param {Object} [object={}] The object to copy properties to.
 * @returns {Object} Returns `object`.
 */
function baseCopy(source, props, object) {
  object || (object = {});

  var index = -1,
      length = props.length;

  while (++index < length) {
    var key = props[index];
    object[key] = source[key];
  }
  return object;
}

module.exports = baseCopy;

},{}],12:[function(require,module,exports){
/**
 * lodash 3.1.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var bindCallback = require('lodash._bindcallback'),
    isIterateeCall = require('lodash._isiterateecall'),
    restParam = require('lodash.restparam');

/**
 * Creates a function that assigns properties of source object(s) to a given
 * destination object.
 *
 * **Note:** This function is used to create `_.assign`, `_.defaults`, and `_.merge`.
 *
 * @private
 * @param {Function} assigner The function to assign values.
 * @returns {Function} Returns the new assigner function.
 */
function createAssigner(assigner) {
  return restParam(function(object, sources) {
    var index = -1,
        length = object == null ? 0 : sources.length,
        customizer = length > 2 ? sources[length - 2] : undefined,
        guard = length > 2 ? sources[2] : undefined,
        thisArg = length > 1 ? sources[length - 1] : undefined;

    if (typeof customizer == 'function') {
      customizer = bindCallback(customizer, thisArg, 5);
      length -= 2;
    } else {
      customizer = typeof thisArg == 'function' ? thisArg : undefined;
      length -= (customizer ? 1 : 0);
    }
    if (guard && isIterateeCall(sources[0], sources[1], guard)) {
      customizer = length < 3 ? undefined : customizer;
      length = 1;
    }
    while (++index < length) {
      var source = sources[index];
      if (source) {
        assigner(object, source, customizer);
      }
    }
    return object;
  });
}

module.exports = createAssigner;

},{"lodash._bindcallback":13,"lodash._isiterateecall":14,"lodash.restparam":15}],13:[function(require,module,exports){
/**
 * lodash 3.0.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/**
 * A specialized version of `baseCallback` which only supports `this` binding
 * and specifying the number of arguments to provide to `func`.
 *
 * @private
 * @param {Function} func The function to bind.
 * @param {*} thisArg The `this` binding of `func`.
 * @param {number} [argCount] The number of arguments to provide to `func`.
 * @returns {Function} Returns the callback.
 */
function bindCallback(func, thisArg, argCount) {
  if (typeof func != 'function') {
    return identity;
  }
  if (thisArg === undefined) {
    return func;
  }
  switch (argCount) {
    case 1: return function(value) {
      return func.call(thisArg, value);
    };
    case 3: return function(value, index, collection) {
      return func.call(thisArg, value, index, collection);
    };
    case 4: return function(accumulator, value, index, collection) {
      return func.call(thisArg, accumulator, value, index, collection);
    };
    case 5: return function(value, other, key, object, source) {
      return func.call(thisArg, value, other, key, object, source);
    };
  }
  return function() {
    return func.apply(thisArg, arguments);
  };
}

/**
 * This method returns the first argument provided to it.
 *
 * @static
 * @memberOf _
 * @category Utility
 * @param {*} value Any value.
 * @returns {*} Returns `value`.
 * @example
 *
 * var object = { 'user': 'fred' };
 *
 * _.identity(object) === object;
 * // => true
 */
function identity(value) {
  return value;
}

module.exports = bindCallback;

},{}],14:[function(require,module,exports){
/**
 * lodash 3.0.9 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used to detect unsigned integer values. */
var reIsUint = /^\d+$/;

/**
 * Used as the [maximum length](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-number.max_safe_integer)
 * of an array-like value.
 */
var MAX_SAFE_INTEGER = 9007199254740991;

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Checks if `value` is array-like.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 */
function isArrayLike(value) {
  return value != null && isLength(getLength(value));
}

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
  length = length == null ? MAX_SAFE_INTEGER : length;
  return value > -1 && value % 1 == 0 && value < length;
}

/**
 * Checks if the provided arguments are from an iteratee call.
 *
 * @private
 * @param {*} value The potential iteratee value argument.
 * @param {*} index The potential iteratee index or key argument.
 * @param {*} object The potential iteratee object argument.
 * @returns {boolean} Returns `true` if the arguments are from an iteratee call, else `false`.
 */
function isIterateeCall(value, index, object) {
  if (!isObject(object)) {
    return false;
  }
  var type = typeof index;
  if (type == 'number'
      ? (isArrayLike(object) && isIndex(index, object.length))
      : (type == 'string' && index in object)) {
    var other = object[index];
    return value === value ? (value === other) : (other !== other);
  }
  return false;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is based on [`ToLength`](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength).
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 */
function isLength(value) {
  return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(1);
 * // => false
 */
function isObject(value) {
  // Avoid a V8 JIT bug in Chrome 19-20.
  // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

module.exports = isIterateeCall;

},{}],15:[function(require,module,exports){
/**
 * lodash 3.6.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used as the `TypeError` message for "Functions" methods. */
var FUNC_ERROR_TEXT = 'Expected a function';

/* Native method references for those with the same name as other `lodash` methods. */
var nativeMax = Math.max;

/**
 * Creates a function that invokes `func` with the `this` binding of the
 * created function and arguments from `start` and beyond provided as an array.
 *
 * **Note:** This method is based on the [rest parameter](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/rest_parameters).
 *
 * @static
 * @memberOf _
 * @category Function
 * @param {Function} func The function to apply a rest parameter to.
 * @param {number} [start=func.length-1] The start position of the rest parameter.
 * @returns {Function} Returns the new function.
 * @example
 *
 * var say = _.restParam(function(what, names) {
 *   return what + ' ' + _.initial(names).join(', ') +
 *     (_.size(names) > 1 ? ', & ' : '') + _.last(names);
 * });
 *
 * say('hello', 'fred', 'barney', 'pebbles');
 * // => 'hello fred, barney, & pebbles'
 */
function restParam(func, start) {
  if (typeof func != 'function') {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  start = nativeMax(start === undefined ? (func.length - 1) : (+start || 0), 0);
  return function() {
    var args = arguments,
        index = -1,
        length = nativeMax(args.length - start, 0),
        rest = Array(length);

    while (++index < length) {
      rest[index] = args[start + index];
    }
    switch (start) {
      case 0: return func.call(this, rest);
      case 1: return func.call(this, args[0], rest);
      case 2: return func.call(this, args[0], args[1], rest);
    }
    var otherArgs = Array(start + 1);
    index = -1;
    while (++index < start) {
      otherArgs[index] = args[index];
    }
    otherArgs[start] = rest;
    return func.apply(this, otherArgs);
  };
}

module.exports = restParam;

},{}],16:[function(require,module,exports){
/**
 * lodash 3.1.2 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var getNative = require('lodash._getnative'),
    isArguments = require('lodash.isarguments'),
    isArray = require('lodash.isarray');

/** Used to detect unsigned integer values. */
var reIsUint = /^\d+$/;

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/* Native method references for those with the same name as other `lodash` methods. */
var nativeKeys = getNative(Object, 'keys');

/**
 * Used as the [maximum length](http://ecma-international.org/ecma-262/6.0/#sec-number.max_safe_integer)
 * of an array-like value.
 */
var MAX_SAFE_INTEGER = 9007199254740991;

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Checks if `value` is array-like.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 */
function isArrayLike(value) {
  return value != null && isLength(getLength(value));
}

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
  length = length == null ? MAX_SAFE_INTEGER : length;
  return value > -1 && value % 1 == 0 && value < length;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 */
function isLength(value) {
  return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * A fallback implementation of `Object.keys` which creates an array of the
 * own enumerable property names of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function shimKeys(object) {
  var props = keysIn(object),
      propsLength = props.length,
      length = propsLength && object.length;

  var allowIndexes = !!length && isLength(length) &&
    (isArray(object) || isArguments(object));

  var index = -1,
      result = [];

  while (++index < propsLength) {
    var key = props[index];
    if ((allowIndexes && isIndex(key, length)) || hasOwnProperty.call(object, key)) {
      result.push(key);
    }
  }
  return result;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(1);
 * // => false
 */
function isObject(value) {
  // Avoid a V8 JIT bug in Chrome 19-20.
  // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Creates an array of the own enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects. See the
 * [ES spec](http://ecma-international.org/ecma-262/6.0/#sec-object.keys)
 * for more details.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keys(new Foo);
 * // => ['a', 'b'] (iteration order is not guaranteed)
 *
 * _.keys('hi');
 * // => ['0', '1']
 */
var keys = !nativeKeys ? shimKeys : function(object) {
  var Ctor = object == null ? undefined : object.constructor;
  if ((typeof Ctor == 'function' && Ctor.prototype === object) ||
      (typeof object != 'function' && isArrayLike(object))) {
    return shimKeys(object);
  }
  return isObject(object) ? nativeKeys(object) : [];
};

/**
 * Creates an array of the own and inherited enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keysIn(new Foo);
 * // => ['a', 'b', 'c'] (iteration order is not guaranteed)
 */
function keysIn(object) {
  if (object == null) {
    return [];
  }
  if (!isObject(object)) {
    object = Object(object);
  }
  var length = object.length;
  length = (length && isLength(length) &&
    (isArray(object) || isArguments(object)) && length) || 0;

  var Ctor = object.constructor,
      index = -1,
      isProto = typeof Ctor == 'function' && Ctor.prototype === object,
      result = Array(length),
      skipIndexes = length > 0;

  while (++index < length) {
    result[index] = (index + '');
  }
  for (var key in object) {
    if (!(skipIndexes && isIndex(key, length)) &&
        !(key == 'constructor' && (isProto || !hasOwnProperty.call(object, key)))) {
      result.push(key);
    }
  }
  return result;
}

module.exports = keys;

},{"lodash._getnative":17,"lodash.isarguments":18,"lodash.isarray":19}],17:[function(require,module,exports){
/**
 * lodash 3.9.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** `Object#toString` result references. */
var funcTag = '[object Function]';

/** Used to detect host constructors (Safari > 5). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/**
 * Checks if `value` is object-like.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var fnToString = Function.prototype.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objToString = objectProto.toString;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  fnToString.call(hasOwnProperty).replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = object == null ? undefined : object[key];
  return isNative(value) ? value : undefined;
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in older versions of Chrome and Safari which return 'function' for regexes
  // and Safari 8 equivalents which return 'object' for typed array constructors.
  return isObject(value) && objToString.call(value) == funcTag;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(1);
 * // => false
 */
function isObject(value) {
  // Avoid a V8 JIT bug in Chrome 19-20.
  // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is a native function.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function, else `false`.
 * @example
 *
 * _.isNative(Array.prototype.push);
 * // => true
 *
 * _.isNative(_);
 * // => false
 */
function isNative(value) {
  if (value == null) {
    return false;
  }
  if (isFunction(value)) {
    return reIsNative.test(fnToString.call(value));
  }
  return isObjectLike(value) && reIsHostCtor.test(value);
}

module.exports = getNative;

},{}],18:[function(require,module,exports){
/**
 * lodash 3.0.4 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/**
 * Checks if `value` is object-like.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/** Native method references. */
var propertyIsEnumerable = objectProto.propertyIsEnumerable;

/**
 * Used as the [maximum length](http://ecma-international.org/ecma-262/6.0/#sec-number.max_safe_integer)
 * of an array-like value.
 */
var MAX_SAFE_INTEGER = 9007199254740991;

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Checks if `value` is array-like.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 */
function isArrayLike(value) {
  return value != null && isLength(getLength(value));
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 */
function isLength(value) {
  return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is classified as an `arguments` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
function isArguments(value) {
  return isObjectLike(value) && isArrayLike(value) &&
    hasOwnProperty.call(value, 'callee') && !propertyIsEnumerable.call(value, 'callee');
}

module.exports = isArguments;

},{}],19:[function(require,module,exports){
/**
 * lodash 3.0.4 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** `Object#toString` result references. */
var arrayTag = '[object Array]',
    funcTag = '[object Function]';

/** Used to detect host constructors (Safari > 5). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/**
 * Checks if `value` is object-like.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var fnToString = Function.prototype.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objToString = objectProto.toString;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  fnToString.call(hasOwnProperty).replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/* Native method references for those with the same name as other `lodash` methods. */
var nativeIsArray = getNative(Array, 'isArray');

/**
 * Used as the [maximum length](http://ecma-international.org/ecma-262/6.0/#sec-number.max_safe_integer)
 * of an array-like value.
 */
var MAX_SAFE_INTEGER = 9007199254740991;

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = object == null ? undefined : object[key];
  return isNative(value) ? value : undefined;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 */
function isLength(value) {
  return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(function() { return arguments; }());
 * // => false
 */
var isArray = nativeIsArray || function(value) {
  return isObjectLike(value) && isLength(value.length) && objToString.call(value) == arrayTag;
};

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in older versions of Chrome and Safari which return 'function' for regexes
  // and Safari 8 equivalents which return 'object' for typed array constructors.
  return isObject(value) && objToString.call(value) == funcTag;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(1);
 * // => false
 */
function isObject(value) {
  // Avoid a V8 JIT bug in Chrome 19-20.
  // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is a native function.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function, else `false`.
 * @example
 *
 * _.isNative(Array.prototype.push);
 * // => true
 *
 * _.isNative(_);
 * // => false
 */
function isNative(value) {
  if (value == null) {
    return false;
  }
  if (isFunction(value)) {
    return reIsNative.test(fnToString.call(value));
  }
  return isObjectLike(value) && reIsHostCtor.test(value);
}

module.exports = isArray;

},{}],20:[function(require,module,exports){
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

},{"./AutoRouter":34,"./AutoRouter.Utils":33}],21:[function(require,module,exports){
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

},{"./AutoRouter.Constants":22,"./AutoRouter.Point":28,"./AutoRouter.Port":30,"./AutoRouter.Rect":31,"./AutoRouter.Utils":33}],22:[function(require,module,exports){
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

},{"./AutoRouter.Point":28}],23:[function(require,module,exports){
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

},{"./AutoRouter.Constants":22,"./AutoRouter.Point":28,"./AutoRouter.Utils":33}],24:[function(require,module,exports){
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

},{"./AutoRouter.Box":21,"./AutoRouter.Constants":22,"./AutoRouter.Edge":23,"./AutoRouter.Logger":26,"./AutoRouter.Path":27,"./AutoRouter.Port":30,"./AutoRouter.Utils":33}],25:[function(require,module,exports){
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

},{"./AutoRouter.Box":21,"./AutoRouter.Constants":22,"./AutoRouter.Edge":23,"./AutoRouter.EdgeList":24,"./AutoRouter.Logger":26,"./AutoRouter.Path":27,"./AutoRouter.Point":28,"./AutoRouter.PointList":29,"./AutoRouter.Port":30,"./AutoRouter.Rect":31,"./AutoRouter.Utils":33}],26:[function(require,module,exports){
'use strict';
var debug = require('debug'),
    LEVELS = ['warn', 'debug', 'info'];

var Logger = function(name){
    for (var i = LEVELS.length; i--;) {
        this[LEVELS[i]] = debug(name + ':' + LEVELS[i]);
    }
};

module.exports = Logger;

},{"debug":6}],27:[function(require,module,exports){
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

},{"./AutoRouter.Constants":22,"./AutoRouter.Point":28,"./AutoRouter.PointList":29,"./AutoRouter.Rect":31,"./AutoRouter.Utils":33}],28:[function(require,module,exports){
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

},{"./AutoRouter.Size":32}],29:[function(require,module,exports){
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


},{"./AutoRouter.Constants":22,"./AutoRouter.Logger":26,"./AutoRouter.Utils":33}],30:[function(require,module,exports){
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

},{"./AutoRouter.Constants":22,"./AutoRouter.Point":28,"./AutoRouter.Rect":31,"./AutoRouter.Size":32,"./AutoRouter.Utils":33}],31:[function(require,module,exports){
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

},{"./AutoRouter.Logger":26,"./AutoRouter.Point":28,"./AutoRouter.Size":32,"debug":6}],32:[function(require,module,exports){
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

},{}],33:[function(require,module,exports){
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

},{"./AutoRouter.Constants":22,"./AutoRouter.Point":28,"./AutoRouter.Rect":31,"./AutoRouter.Utils":33}],34:[function(require,module,exports){
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

},{"./AutoRouter.Constants":22,"./AutoRouter.Graph":25,"./AutoRouter.Point":28,"./AutoRouter.Port":30,"./AutoRouter.Rect":31,"./AutoRouter.Utils":33}],35:[function(require,module,exports){
/*jshint node:true, mocha:true*/
/**
 * @author brollb / https://github.com/brollb
 */

'use strict';

var srcPath = './../../src/',
    ActionApplier = require('./../../src/AutoRouter.ActionApplier'),
    nop = function(){},
    extend = require('lodash.assign'),
    assert = require('assert'),
    verbose,
    HEADER = 'AUTOROUTER REPLAYER:\t',
    Worker /*= require('webworker-threads').Worker*/;

var AutoRouterReplayer = function () {
    this.logger = {error: console.log};

    // Web worker support
    this.usingWebWorker = false;
    this.onFinished = false;
    this.useWebWorker();
    this.expectedErrors = [];
    this._queue = null;
    this._count = null;
};

AutoRouterReplayer.prototype.log = function () {
    var msg,
        i;

    if (verbose) {
        msg = [HEADER];
        for (i = 0; i < arguments.length; i += 1) {
            msg.push(arguments[i]);
        }
        console.log.apply(null, msg);
    }
};

AutoRouterReplayer.prototype.testLocal = function (actions, options, callback) {
    var before,
        after,
        last,

        i;

    if (arguments.length < 3) {
        callback = options;
    }

    // Unpack the options
    this.init();
    options = options || {};
    verbose = options.verbose || false;
    before = options.before || nop;
    after = options.after || nop;
    callback = callback || nop;
    last = options.actionCount || actions.length;

    // Run the tests
    for (i = 0; i < last; i += 1) {
        this.log(`Calling Action #${i}/${last}: ${actions[i].action} with`, actions[i].args);
        before(this.autorouter, i);
        try {
            this._invokeAutoRouterMethodUnsafe(actions[i].action, actions[i].args);
        } catch (e) {
            if (!this._isExpectedError(e.message)) {
                throw e;
            }
        }
        after(this.autorouter, i);
    }

    callback();
};

// Web worker functionality
/**
 * Set the AutoRouterReplayer to use a web worker or not.
 *
 * @param {Boolean} [usingWebWorker]
 * @return {undefined}
 */
AutoRouterReplayer.prototype.useWebWorker = function (usingWebWorker) {
    if (usingWebWorker) {  // Enable web worker
        this.test = AutoRouterReplayer.prototype.testWithWebWorker;
    } else {
        this.test = AutoRouterReplayer.prototype.testLocal;
    }
    this.usingWebWorker = usingWebWorker;
};

// FIXME: Test the web worker
AutoRouterReplayer.prototype._createWebWorker = function (callback) {
    var workerFile = srcPath + 'AutoRouter.Worker.js';
    assert(!!Worker, 'Web Workers are not supported in your environment');

    this.log('Creating web worker');
    if (this._worker) {
        this._worker.terminate();
    }
    this._worker = new Worker(workerFile);
    this.log('Sending:',{});
    this._worker.postMessage([{}, true]);

    this._worker.onmessage = function(response) {
        this.log('Created web worker');
        assert(response.data === 'READY');
        this._worker.onmessage = this._onWorkerMessage.bind(this);
        callback();
    }.bind(this);
};

/**
 * Clean up resources used for testing (namely the web worker).
 *
 * @return {undefined}
 */
AutoRouterReplayer.prototype.teardown = function () {
    if (this._worker) {
        this._worker.terminate();
        this._worker = null;
    }
};

AutoRouterReplayer.prototype.testWithWebWorker = function (actions, options, callback) {
    var last;

    options = options || {};
    verbose = options.verbose || false;
    last = options.actionCount || actions.length;

    this._count = 0;
    this._queue = actions.slice(0,last);

    assert(this._queue.length, 'Received an empty list of actions');
    this._createWebWorker(this._callNext.bind(this));
    this.onFinished = callback;
};

AutoRouterReplayer.prototype._onWorkerMessage = function (data) {
    var response = data.data;
    this.log('Web worker responded:'+response);
    if (typeof response[2] === 'string' && response[2].indexOf('Error') === 0) {
        assert(this._isExpectedError(response[2]), 'Unexpected error: '+response[2]);
    }

    if (this._queue.length) {
        this._callNext();
    } else {
        if (this.onFinished) {
            this.onFinished();
            this.onFinished = null;
        }
        assert(this.expectedErrors.length === 0);
    }
};

AutoRouterReplayer.prototype._isExpectedError = function (error) {
    for (var i = this.expectedErrors.length; i--;) {
        if (this.expectedErrors[i].test(error)) {
            this.expectedErrors.splice(i,1);
            return true;
        }
    }
    return false;
};

AutoRouterReplayer.prototype._callNext = function () {
    var task = this._queue.shift();
    this.log('Calling Action #' + this._count + ':', task.action, 'with', task.args);
    this._worker.postMessage([task.action, task.args]);
};

/* * * * * * * * Querying the AutoRouter * * * * * * * */
AutoRouterReplayer.prototype.getPathPoints = function (pathId, callback) {
    if (this.usingWebWorker) {  // Enable web worker
        this._worker.onmessage = function(data) {
            console.log('received data:', data);
            if (data.data[0] === 'path' && pathId === data.data[1].id) {
                callback(data.data[2]);
            }
        };
        this._worker.postMessage(['path', [pathId]]);
    } else {
        callback(this.autorouter.path(pathId).points);
    }
};

AutoRouterReplayer.prototype.getBoxRect = function (boxId, callback) {
    if (this.usingWebWorker) {  // Enable web worker
        this._worker.onmessage = function(data) {
            if (data.data[0] === 'getBoxRect' && boxId === data.data[1][0]) {
                callback(data.data[2]);
            }
        };
        this._worker.postMessage(['getBoxRect', [boxId]]);
    } else {
        var rect = this.autorouter.box(boxId);
        callback(rect);
    }
};

extend(AutoRouterReplayer.prototype, ActionApplier.prototype);

module.exports = AutoRouterReplayer;

},{"./../../src/AutoRouter.ActionApplier":20,"assert":1,"lodash.assign":9}]},{},[35])(35)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYXNzZXJ0L2Fzc2VydC5qcyIsIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9pbmhlcml0cy9pbmhlcml0c19icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy91dGlsL3N1cHBvcnQvaXNCdWZmZXJCcm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3V0aWwvdXRpbC5qcyIsIm5vZGVfbW9kdWxlcy9kZWJ1Zy9icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL2RlYnVnL2RlYnVnLmpzIiwibm9kZV9tb2R1bGVzL2RlYnVnL25vZGVfbW9kdWxlcy9tcy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2guYXNzaWduL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC5hc3NpZ24vbm9kZV9tb2R1bGVzL2xvZGFzaC5fYmFzZWFzc2lnbi9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2guYXNzaWduL25vZGVfbW9kdWxlcy9sb2Rhc2guX2Jhc2Vhc3NpZ24vbm9kZV9tb2R1bGVzL2xvZGFzaC5fYmFzZWNvcHkvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbG9kYXNoLmFzc2lnbi9ub2RlX21vZHVsZXMvbG9kYXNoLl9jcmVhdGVhc3NpZ25lci9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2guYXNzaWduL25vZGVfbW9kdWxlcy9sb2Rhc2guX2NyZWF0ZWFzc2lnbmVyL25vZGVfbW9kdWxlcy9sb2Rhc2guX2JpbmRjYWxsYmFjay9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2guYXNzaWduL25vZGVfbW9kdWxlcy9sb2Rhc2guX2NyZWF0ZWFzc2lnbmVyL25vZGVfbW9kdWxlcy9sb2Rhc2guX2lzaXRlcmF0ZWVjYWxsL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC5hc3NpZ24vbm9kZV9tb2R1bGVzL2xvZGFzaC5fY3JlYXRlYXNzaWduZXIvbm9kZV9tb2R1bGVzL2xvZGFzaC5yZXN0cGFyYW0vaW5kZXguanMiLCJub2RlX21vZHVsZXMvbG9kYXNoLmFzc2lnbi9ub2RlX21vZHVsZXMvbG9kYXNoLmtleXMvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbG9kYXNoLmFzc2lnbi9ub2RlX21vZHVsZXMvbG9kYXNoLmtleXMvbm9kZV9tb2R1bGVzL2xvZGFzaC5fZ2V0bmF0aXZlL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC5hc3NpZ24vbm9kZV9tb2R1bGVzL2xvZGFzaC5rZXlzL25vZGVfbW9kdWxlcy9sb2Rhc2guaXNhcmd1bWVudHMvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbG9kYXNoLmFzc2lnbi9ub2RlX21vZHVsZXMvbG9kYXNoLmtleXMvbm9kZV9tb2R1bGVzL2xvZGFzaC5pc2FycmF5L2luZGV4LmpzIiwic3JjL0F1dG9Sb3V0ZXIuQWN0aW9uQXBwbGllci5qcyIsInNyYy9BdXRvUm91dGVyLkJveC5qcyIsInNyYy9BdXRvUm91dGVyLkNvbnN0YW50cy5qcyIsInNyYy9BdXRvUm91dGVyLkVkZ2UuanMiLCJzcmMvQXV0b1JvdXRlci5FZGdlTGlzdC5qcyIsInNyYy9BdXRvUm91dGVyLkdyYXBoLmpzIiwic3JjL0F1dG9Sb3V0ZXIuTG9nZ2VyLmpzIiwic3JjL0F1dG9Sb3V0ZXIuUGF0aC5qcyIsInNyYy9BdXRvUm91dGVyLlBvaW50LmpzIiwic3JjL0F1dG9Sb3V0ZXIuUG9pbnRMaXN0LmpzIiwic3JjL0F1dG9Sb3V0ZXIuUG9ydC5qcyIsInNyYy9BdXRvUm91dGVyLlJlY3QuanMiLCJzcmMvQXV0b1JvdXRlci5TaXplLmpzIiwic3JjL0F1dG9Sb3V0ZXIuVXRpbHMuanMiLCJzcmMvQXV0b1JvdXRlci5qcyIsInRlc3QvdXRpbHMvYXV0b3JvdXRlci5yZXBsYXkuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdldBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDMWtCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeklBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDalFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0T0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6VkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVyREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3p2RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxaUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdE1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6YUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVVQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbDVCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbGhCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vIGh0dHA6Ly93aWtpLmNvbW1vbmpzLm9yZy93aWtpL1VuaXRfVGVzdGluZy8xLjBcbi8vXG4vLyBUSElTIElTIE5PVCBURVNURUQgTk9SIExJS0VMWSBUTyBXT1JLIE9VVFNJREUgVjghXG4vL1xuLy8gT3JpZ2luYWxseSBmcm9tIG5hcndoYWwuanMgKGh0dHA6Ly9uYXJ3aGFsanMub3JnKVxuLy8gQ29weXJpZ2h0IChjKSAyMDA5IFRob21hcyBSb2JpbnNvbiA8Mjgwbm9ydGguY29tPlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhIGNvcHlcbi8vIG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlICdTb2Z0d2FyZScpLCB0b1xuLy8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nIHdpdGhvdXQgbGltaXRhdGlvbiB0aGVcbi8vIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vclxuLy8gc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXNcbi8vIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW5cbi8vIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCAnQVMgSVMnLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTIE9SXG4vLyBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSxcbi8vIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOIE5PIEVWRU5UIFNIQUxMIFRIRVxuLy8gQVVUSE9SUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSwgREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU5cbi8vIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUiBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT05cbi8vIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRSBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG4vLyB3aGVuIHVzZWQgaW4gbm9kZSwgdGhpcyB3aWxsIGFjdHVhbGx5IGxvYWQgdGhlIHV0aWwgbW9kdWxlIHdlIGRlcGVuZCBvblxuLy8gdmVyc3VzIGxvYWRpbmcgdGhlIGJ1aWx0aW4gdXRpbCBtb2R1bGUgYXMgaGFwcGVucyBvdGhlcndpc2Vcbi8vIHRoaXMgaXMgYSBidWcgaW4gbm9kZSBtb2R1bGUgbG9hZGluZyBhcyBmYXIgYXMgSSBhbSBjb25jZXJuZWRcbnZhciB1dGlsID0gcmVxdWlyZSgndXRpbC8nKTtcblxudmFyIHBTbGljZSA9IEFycmF5LnByb3RvdHlwZS5zbGljZTtcbnZhciBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuXG4vLyAxLiBUaGUgYXNzZXJ0IG1vZHVsZSBwcm92aWRlcyBmdW5jdGlvbnMgdGhhdCB0aHJvd1xuLy8gQXNzZXJ0aW9uRXJyb3IncyB3aGVuIHBhcnRpY3VsYXIgY29uZGl0aW9ucyBhcmUgbm90IG1ldC4gVGhlXG4vLyBhc3NlcnQgbW9kdWxlIG11c3QgY29uZm9ybSB0byB0aGUgZm9sbG93aW5nIGludGVyZmFjZS5cblxudmFyIGFzc2VydCA9IG1vZHVsZS5leHBvcnRzID0gb2s7XG5cbi8vIDIuIFRoZSBBc3NlcnRpb25FcnJvciBpcyBkZWZpbmVkIGluIGFzc2VydC5cbi8vIG5ldyBhc3NlcnQuQXNzZXJ0aW9uRXJyb3IoeyBtZXNzYWdlOiBtZXNzYWdlLFxuLy8gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFjdHVhbDogYWN0dWFsLFxuLy8gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV4cGVjdGVkOiBleHBlY3RlZCB9KVxuXG5hc3NlcnQuQXNzZXJ0aW9uRXJyb3IgPSBmdW5jdGlvbiBBc3NlcnRpb25FcnJvcihvcHRpb25zKSB7XG4gIHRoaXMubmFtZSA9ICdBc3NlcnRpb25FcnJvcic7XG4gIHRoaXMuYWN0dWFsID0gb3B0aW9ucy5hY3R1YWw7XG4gIHRoaXMuZXhwZWN0ZWQgPSBvcHRpb25zLmV4cGVjdGVkO1xuICB0aGlzLm9wZXJhdG9yID0gb3B0aW9ucy5vcGVyYXRvcjtcbiAgaWYgKG9wdGlvbnMubWVzc2FnZSkge1xuICAgIHRoaXMubWVzc2FnZSA9IG9wdGlvbnMubWVzc2FnZTtcbiAgICB0aGlzLmdlbmVyYXRlZE1lc3NhZ2UgPSBmYWxzZTtcbiAgfSBlbHNlIHtcbiAgICB0aGlzLm1lc3NhZ2UgPSBnZXRNZXNzYWdlKHRoaXMpO1xuICAgIHRoaXMuZ2VuZXJhdGVkTWVzc2FnZSA9IHRydWU7XG4gIH1cbiAgdmFyIHN0YWNrU3RhcnRGdW5jdGlvbiA9IG9wdGlvbnMuc3RhY2tTdGFydEZ1bmN0aW9uIHx8IGZhaWw7XG5cbiAgaWYgKEVycm9yLmNhcHR1cmVTdGFja1RyYWNlKSB7XG4gICAgRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2UodGhpcywgc3RhY2tTdGFydEZ1bmN0aW9uKTtcbiAgfVxuICBlbHNlIHtcbiAgICAvLyBub24gdjggYnJvd3NlcnMgc28gd2UgY2FuIGhhdmUgYSBzdGFja3RyYWNlXG4gICAgdmFyIGVyciA9IG5ldyBFcnJvcigpO1xuICAgIGlmIChlcnIuc3RhY2spIHtcbiAgICAgIHZhciBvdXQgPSBlcnIuc3RhY2s7XG5cbiAgICAgIC8vIHRyeSB0byBzdHJpcCB1c2VsZXNzIGZyYW1lc1xuICAgICAgdmFyIGZuX25hbWUgPSBzdGFja1N0YXJ0RnVuY3Rpb24ubmFtZTtcbiAgICAgIHZhciBpZHggPSBvdXQuaW5kZXhPZignXFxuJyArIGZuX25hbWUpO1xuICAgICAgaWYgKGlkeCA+PSAwKSB7XG4gICAgICAgIC8vIG9uY2Ugd2UgaGF2ZSBsb2NhdGVkIHRoZSBmdW5jdGlvbiBmcmFtZVxuICAgICAgICAvLyB3ZSBuZWVkIHRvIHN0cmlwIG91dCBldmVyeXRoaW5nIGJlZm9yZSBpdCAoYW5kIGl0cyBsaW5lKVxuICAgICAgICB2YXIgbmV4dF9saW5lID0gb3V0LmluZGV4T2YoJ1xcbicsIGlkeCArIDEpO1xuICAgICAgICBvdXQgPSBvdXQuc3Vic3RyaW5nKG5leHRfbGluZSArIDEpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLnN0YWNrID0gb3V0O1xuICAgIH1cbiAgfVxufTtcblxuLy8gYXNzZXJ0LkFzc2VydGlvbkVycm9yIGluc3RhbmNlb2YgRXJyb3JcbnV0aWwuaW5oZXJpdHMoYXNzZXJ0LkFzc2VydGlvbkVycm9yLCBFcnJvcik7XG5cbmZ1bmN0aW9uIHJlcGxhY2VyKGtleSwgdmFsdWUpIHtcbiAgaWYgKHV0aWwuaXNVbmRlZmluZWQodmFsdWUpKSB7XG4gICAgcmV0dXJuICcnICsgdmFsdWU7XG4gIH1cbiAgaWYgKHV0aWwuaXNOdW1iZXIodmFsdWUpICYmICFpc0Zpbml0ZSh2YWx1ZSkpIHtcbiAgICByZXR1cm4gdmFsdWUudG9TdHJpbmcoKTtcbiAgfVxuICBpZiAodXRpbC5pc0Z1bmN0aW9uKHZhbHVlKSB8fCB1dGlsLmlzUmVnRXhwKHZhbHVlKSkge1xuICAgIHJldHVybiB2YWx1ZS50b1N0cmluZygpO1xuICB9XG4gIHJldHVybiB2YWx1ZTtcbn1cblxuZnVuY3Rpb24gdHJ1bmNhdGUocywgbikge1xuICBpZiAodXRpbC5pc1N0cmluZyhzKSkge1xuICAgIHJldHVybiBzLmxlbmd0aCA8IG4gPyBzIDogcy5zbGljZSgwLCBuKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gcztcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRNZXNzYWdlKHNlbGYpIHtcbiAgcmV0dXJuIHRydW5jYXRlKEpTT04uc3RyaW5naWZ5KHNlbGYuYWN0dWFsLCByZXBsYWNlciksIDEyOCkgKyAnICcgK1xuICAgICAgICAgc2VsZi5vcGVyYXRvciArICcgJyArXG4gICAgICAgICB0cnVuY2F0ZShKU09OLnN0cmluZ2lmeShzZWxmLmV4cGVjdGVkLCByZXBsYWNlciksIDEyOCk7XG59XG5cbi8vIEF0IHByZXNlbnQgb25seSB0aGUgdGhyZWUga2V5cyBtZW50aW9uZWQgYWJvdmUgYXJlIHVzZWQgYW5kXG4vLyB1bmRlcnN0b29kIGJ5IHRoZSBzcGVjLiBJbXBsZW1lbnRhdGlvbnMgb3Igc3ViIG1vZHVsZXMgY2FuIHBhc3Ncbi8vIG90aGVyIGtleXMgdG8gdGhlIEFzc2VydGlvbkVycm9yJ3MgY29uc3RydWN0b3IgLSB0aGV5IHdpbGwgYmVcbi8vIGlnbm9yZWQuXG5cbi8vIDMuIEFsbCBvZiB0aGUgZm9sbG93aW5nIGZ1bmN0aW9ucyBtdXN0IHRocm93IGFuIEFzc2VydGlvbkVycm9yXG4vLyB3aGVuIGEgY29ycmVzcG9uZGluZyBjb25kaXRpb24gaXMgbm90IG1ldCwgd2l0aCBhIG1lc3NhZ2UgdGhhdFxuLy8gbWF5IGJlIHVuZGVmaW5lZCBpZiBub3QgcHJvdmlkZWQuICBBbGwgYXNzZXJ0aW9uIG1ldGhvZHMgcHJvdmlkZVxuLy8gYm90aCB0aGUgYWN0dWFsIGFuZCBleHBlY3RlZCB2YWx1ZXMgdG8gdGhlIGFzc2VydGlvbiBlcnJvciBmb3Jcbi8vIGRpc3BsYXkgcHVycG9zZXMuXG5cbmZ1bmN0aW9uIGZhaWwoYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZSwgb3BlcmF0b3IsIHN0YWNrU3RhcnRGdW5jdGlvbikge1xuICB0aHJvdyBuZXcgYXNzZXJ0LkFzc2VydGlvbkVycm9yKHtcbiAgICBtZXNzYWdlOiBtZXNzYWdlLFxuICAgIGFjdHVhbDogYWN0dWFsLFxuICAgIGV4cGVjdGVkOiBleHBlY3RlZCxcbiAgICBvcGVyYXRvcjogb3BlcmF0b3IsXG4gICAgc3RhY2tTdGFydEZ1bmN0aW9uOiBzdGFja1N0YXJ0RnVuY3Rpb25cbiAgfSk7XG59XG5cbi8vIEVYVEVOU0lPTiEgYWxsb3dzIGZvciB3ZWxsIGJlaGF2ZWQgZXJyb3JzIGRlZmluZWQgZWxzZXdoZXJlLlxuYXNzZXJ0LmZhaWwgPSBmYWlsO1xuXG4vLyA0LiBQdXJlIGFzc2VydGlvbiB0ZXN0cyB3aGV0aGVyIGEgdmFsdWUgaXMgdHJ1dGh5LCBhcyBkZXRlcm1pbmVkXG4vLyBieSAhIWd1YXJkLlxuLy8gYXNzZXJ0Lm9rKGd1YXJkLCBtZXNzYWdlX29wdCk7XG4vLyBUaGlzIHN0YXRlbWVudCBpcyBlcXVpdmFsZW50IHRvIGFzc2VydC5lcXVhbCh0cnVlLCAhIWd1YXJkLFxuLy8gbWVzc2FnZV9vcHQpOy4gVG8gdGVzdCBzdHJpY3RseSBmb3IgdGhlIHZhbHVlIHRydWUsIHVzZVxuLy8gYXNzZXJ0LnN0cmljdEVxdWFsKHRydWUsIGd1YXJkLCBtZXNzYWdlX29wdCk7LlxuXG5mdW5jdGlvbiBvayh2YWx1ZSwgbWVzc2FnZSkge1xuICBpZiAoIXZhbHVlKSBmYWlsKHZhbHVlLCB0cnVlLCBtZXNzYWdlLCAnPT0nLCBhc3NlcnQub2spO1xufVxuYXNzZXJ0Lm9rID0gb2s7XG5cbi8vIDUuIFRoZSBlcXVhbGl0eSBhc3NlcnRpb24gdGVzdHMgc2hhbGxvdywgY29lcmNpdmUgZXF1YWxpdHkgd2l0aFxuLy8gPT0uXG4vLyBhc3NlcnQuZXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZV9vcHQpO1xuXG5hc3NlcnQuZXF1YWwgPSBmdW5jdGlvbiBlcXVhbChhY3R1YWwsIGV4cGVjdGVkLCBtZXNzYWdlKSB7XG4gIGlmIChhY3R1YWwgIT0gZXhwZWN0ZWQpIGZhaWwoYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZSwgJz09JywgYXNzZXJ0LmVxdWFsKTtcbn07XG5cbi8vIDYuIFRoZSBub24tZXF1YWxpdHkgYXNzZXJ0aW9uIHRlc3RzIGZvciB3aGV0aGVyIHR3byBvYmplY3RzIGFyZSBub3QgZXF1YWxcbi8vIHdpdGggIT0gYXNzZXJ0Lm5vdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQsIG1lc3NhZ2Vfb3B0KTtcblxuYXNzZXJ0Lm5vdEVxdWFsID0gZnVuY3Rpb24gbm90RXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZSkge1xuICBpZiAoYWN0dWFsID09IGV4cGVjdGVkKSB7XG4gICAgZmFpbChhY3R1YWwsIGV4cGVjdGVkLCBtZXNzYWdlLCAnIT0nLCBhc3NlcnQubm90RXF1YWwpO1xuICB9XG59O1xuXG4vLyA3LiBUaGUgZXF1aXZhbGVuY2UgYXNzZXJ0aW9uIHRlc3RzIGEgZGVlcCBlcXVhbGl0eSByZWxhdGlvbi5cbi8vIGFzc2VydC5kZWVwRXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZV9vcHQpO1xuXG5hc3NlcnQuZGVlcEVxdWFsID0gZnVuY3Rpb24gZGVlcEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQsIG1lc3NhZ2UpIHtcbiAgaWYgKCFfZGVlcEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQpKSB7XG4gICAgZmFpbChhY3R1YWwsIGV4cGVjdGVkLCBtZXNzYWdlLCAnZGVlcEVxdWFsJywgYXNzZXJ0LmRlZXBFcXVhbCk7XG4gIH1cbn07XG5cbmZ1bmN0aW9uIF9kZWVwRXF1YWwoYWN0dWFsLCBleHBlY3RlZCkge1xuICAvLyA3LjEuIEFsbCBpZGVudGljYWwgdmFsdWVzIGFyZSBlcXVpdmFsZW50LCBhcyBkZXRlcm1pbmVkIGJ5ID09PS5cbiAgaWYgKGFjdHVhbCA9PT0gZXhwZWN0ZWQpIHtcbiAgICByZXR1cm4gdHJ1ZTtcblxuICB9IGVsc2UgaWYgKHV0aWwuaXNCdWZmZXIoYWN0dWFsKSAmJiB1dGlsLmlzQnVmZmVyKGV4cGVjdGVkKSkge1xuICAgIGlmIChhY3R1YWwubGVuZ3RoICE9IGV4cGVjdGVkLmxlbmd0aCkgcmV0dXJuIGZhbHNlO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhY3R1YWwubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChhY3R1YWxbaV0gIT09IGV4cGVjdGVkW2ldKSByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG5cbiAgLy8gNy4yLiBJZiB0aGUgZXhwZWN0ZWQgdmFsdWUgaXMgYSBEYXRlIG9iamVjdCwgdGhlIGFjdHVhbCB2YWx1ZSBpc1xuICAvLyBlcXVpdmFsZW50IGlmIGl0IGlzIGFsc28gYSBEYXRlIG9iamVjdCB0aGF0IHJlZmVycyB0byB0aGUgc2FtZSB0aW1lLlxuICB9IGVsc2UgaWYgKHV0aWwuaXNEYXRlKGFjdHVhbCkgJiYgdXRpbC5pc0RhdGUoZXhwZWN0ZWQpKSB7XG4gICAgcmV0dXJuIGFjdHVhbC5nZXRUaW1lKCkgPT09IGV4cGVjdGVkLmdldFRpbWUoKTtcblxuICAvLyA3LjMgSWYgdGhlIGV4cGVjdGVkIHZhbHVlIGlzIGEgUmVnRXhwIG9iamVjdCwgdGhlIGFjdHVhbCB2YWx1ZSBpc1xuICAvLyBlcXVpdmFsZW50IGlmIGl0IGlzIGFsc28gYSBSZWdFeHAgb2JqZWN0IHdpdGggdGhlIHNhbWUgc291cmNlIGFuZFxuICAvLyBwcm9wZXJ0aWVzIChgZ2xvYmFsYCwgYG11bHRpbGluZWAsIGBsYXN0SW5kZXhgLCBgaWdub3JlQ2FzZWApLlxuICB9IGVsc2UgaWYgKHV0aWwuaXNSZWdFeHAoYWN0dWFsKSAmJiB1dGlsLmlzUmVnRXhwKGV4cGVjdGVkKSkge1xuICAgIHJldHVybiBhY3R1YWwuc291cmNlID09PSBleHBlY3RlZC5zb3VyY2UgJiZcbiAgICAgICAgICAgYWN0dWFsLmdsb2JhbCA9PT0gZXhwZWN0ZWQuZ2xvYmFsICYmXG4gICAgICAgICAgIGFjdHVhbC5tdWx0aWxpbmUgPT09IGV4cGVjdGVkLm11bHRpbGluZSAmJlxuICAgICAgICAgICBhY3R1YWwubGFzdEluZGV4ID09PSBleHBlY3RlZC5sYXN0SW5kZXggJiZcbiAgICAgICAgICAgYWN0dWFsLmlnbm9yZUNhc2UgPT09IGV4cGVjdGVkLmlnbm9yZUNhc2U7XG5cbiAgLy8gNy40LiBPdGhlciBwYWlycyB0aGF0IGRvIG5vdCBib3RoIHBhc3MgdHlwZW9mIHZhbHVlID09ICdvYmplY3QnLFxuICAvLyBlcXVpdmFsZW5jZSBpcyBkZXRlcm1pbmVkIGJ5ID09LlxuICB9IGVsc2UgaWYgKCF1dGlsLmlzT2JqZWN0KGFjdHVhbCkgJiYgIXV0aWwuaXNPYmplY3QoZXhwZWN0ZWQpKSB7XG4gICAgcmV0dXJuIGFjdHVhbCA9PSBleHBlY3RlZDtcblxuICAvLyA3LjUgRm9yIGFsbCBvdGhlciBPYmplY3QgcGFpcnMsIGluY2x1ZGluZyBBcnJheSBvYmplY3RzLCBlcXVpdmFsZW5jZSBpc1xuICAvLyBkZXRlcm1pbmVkIGJ5IGhhdmluZyB0aGUgc2FtZSBudW1iZXIgb2Ygb3duZWQgcHJvcGVydGllcyAoYXMgdmVyaWZpZWRcbiAgLy8gd2l0aCBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwpLCB0aGUgc2FtZSBzZXQgb2Yga2V5c1xuICAvLyAoYWx0aG91Z2ggbm90IG5lY2Vzc2FyaWx5IHRoZSBzYW1lIG9yZGVyKSwgZXF1aXZhbGVudCB2YWx1ZXMgZm9yIGV2ZXJ5XG4gIC8vIGNvcnJlc3BvbmRpbmcga2V5LCBhbmQgYW4gaWRlbnRpY2FsICdwcm90b3R5cGUnIHByb3BlcnR5LiBOb3RlOiB0aGlzXG4gIC8vIGFjY291bnRzIGZvciBib3RoIG5hbWVkIGFuZCBpbmRleGVkIHByb3BlcnRpZXMgb24gQXJyYXlzLlxuICB9IGVsc2Uge1xuICAgIHJldHVybiBvYmpFcXVpdihhY3R1YWwsIGV4cGVjdGVkKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBpc0FyZ3VtZW50cyhvYmplY3QpIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmplY3QpID09ICdbb2JqZWN0IEFyZ3VtZW50c10nO1xufVxuXG5mdW5jdGlvbiBvYmpFcXVpdihhLCBiKSB7XG4gIGlmICh1dGlsLmlzTnVsbE9yVW5kZWZpbmVkKGEpIHx8IHV0aWwuaXNOdWxsT3JVbmRlZmluZWQoYikpXG4gICAgcmV0dXJuIGZhbHNlO1xuICAvLyBhbiBpZGVudGljYWwgJ3Byb3RvdHlwZScgcHJvcGVydHkuXG4gIGlmIChhLnByb3RvdHlwZSAhPT0gYi5wcm90b3R5cGUpIHJldHVybiBmYWxzZTtcbiAgLy8gaWYgb25lIGlzIGEgcHJpbWl0aXZlLCB0aGUgb3RoZXIgbXVzdCBiZSBzYW1lXG4gIGlmICh1dGlsLmlzUHJpbWl0aXZlKGEpIHx8IHV0aWwuaXNQcmltaXRpdmUoYikpIHtcbiAgICByZXR1cm4gYSA9PT0gYjtcbiAgfVxuICB2YXIgYUlzQXJncyA9IGlzQXJndW1lbnRzKGEpLFxuICAgICAgYklzQXJncyA9IGlzQXJndW1lbnRzKGIpO1xuICBpZiAoKGFJc0FyZ3MgJiYgIWJJc0FyZ3MpIHx8ICghYUlzQXJncyAmJiBiSXNBcmdzKSlcbiAgICByZXR1cm4gZmFsc2U7XG4gIGlmIChhSXNBcmdzKSB7XG4gICAgYSA9IHBTbGljZS5jYWxsKGEpO1xuICAgIGIgPSBwU2xpY2UuY2FsbChiKTtcbiAgICByZXR1cm4gX2RlZXBFcXVhbChhLCBiKTtcbiAgfVxuICB2YXIga2EgPSBvYmplY3RLZXlzKGEpLFxuICAgICAga2IgPSBvYmplY3RLZXlzKGIpLFxuICAgICAga2V5LCBpO1xuICAvLyBoYXZpbmcgdGhlIHNhbWUgbnVtYmVyIG9mIG93bmVkIHByb3BlcnRpZXMgKGtleXMgaW5jb3Jwb3JhdGVzXG4gIC8vIGhhc093blByb3BlcnR5KVxuICBpZiAoa2EubGVuZ3RoICE9IGtiLmxlbmd0aClcbiAgICByZXR1cm4gZmFsc2U7XG4gIC8vdGhlIHNhbWUgc2V0IG9mIGtleXMgKGFsdGhvdWdoIG5vdCBuZWNlc3NhcmlseSB0aGUgc2FtZSBvcmRlciksXG4gIGthLnNvcnQoKTtcbiAga2Iuc29ydCgpO1xuICAvL35+fmNoZWFwIGtleSB0ZXN0XG4gIGZvciAoaSA9IGthLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgaWYgKGthW2ldICE9IGtiW2ldKVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIC8vZXF1aXZhbGVudCB2YWx1ZXMgZm9yIGV2ZXJ5IGNvcnJlc3BvbmRpbmcga2V5LCBhbmRcbiAgLy9+fn5wb3NzaWJseSBleHBlbnNpdmUgZGVlcCB0ZXN0XG4gIGZvciAoaSA9IGthLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAga2V5ID0ga2FbaV07XG4gICAgaWYgKCFfZGVlcEVxdWFsKGFba2V5XSwgYltrZXldKSkgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG4vLyA4LiBUaGUgbm9uLWVxdWl2YWxlbmNlIGFzc2VydGlvbiB0ZXN0cyBmb3IgYW55IGRlZXAgaW5lcXVhbGl0eS5cbi8vIGFzc2VydC5ub3REZWVwRXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZV9vcHQpO1xuXG5hc3NlcnQubm90RGVlcEVxdWFsID0gZnVuY3Rpb24gbm90RGVlcEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQsIG1lc3NhZ2UpIHtcbiAgaWYgKF9kZWVwRXF1YWwoYWN0dWFsLCBleHBlY3RlZCkpIHtcbiAgICBmYWlsKGFjdHVhbCwgZXhwZWN0ZWQsIG1lc3NhZ2UsICdub3REZWVwRXF1YWwnLCBhc3NlcnQubm90RGVlcEVxdWFsKTtcbiAgfVxufTtcblxuLy8gOS4gVGhlIHN0cmljdCBlcXVhbGl0eSBhc3NlcnRpb24gdGVzdHMgc3RyaWN0IGVxdWFsaXR5LCBhcyBkZXRlcm1pbmVkIGJ5ID09PS5cbi8vIGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkLCBtZXNzYWdlX29wdCk7XG5cbmFzc2VydC5zdHJpY3RFcXVhbCA9IGZ1bmN0aW9uIHN0cmljdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQsIG1lc3NhZ2UpIHtcbiAgaWYgKGFjdHVhbCAhPT0gZXhwZWN0ZWQpIHtcbiAgICBmYWlsKGFjdHVhbCwgZXhwZWN0ZWQsIG1lc3NhZ2UsICc9PT0nLCBhc3NlcnQuc3RyaWN0RXF1YWwpO1xuICB9XG59O1xuXG4vLyAxMC4gVGhlIHN0cmljdCBub24tZXF1YWxpdHkgYXNzZXJ0aW9uIHRlc3RzIGZvciBzdHJpY3QgaW5lcXVhbGl0eSwgYXNcbi8vIGRldGVybWluZWQgYnkgIT09LiAgYXNzZXJ0Lm5vdFN0cmljdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQsIG1lc3NhZ2Vfb3B0KTtcblxuYXNzZXJ0Lm5vdFN0cmljdEVxdWFsID0gZnVuY3Rpb24gbm90U3RyaWN0RXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZSkge1xuICBpZiAoYWN0dWFsID09PSBleHBlY3RlZCkge1xuICAgIGZhaWwoYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZSwgJyE9PScsIGFzc2VydC5ub3RTdHJpY3RFcXVhbCk7XG4gIH1cbn07XG5cbmZ1bmN0aW9uIGV4cGVjdGVkRXhjZXB0aW9uKGFjdHVhbCwgZXhwZWN0ZWQpIHtcbiAgaWYgKCFhY3R1YWwgfHwgIWV4cGVjdGVkKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChleHBlY3RlZCkgPT0gJ1tvYmplY3QgUmVnRXhwXScpIHtcbiAgICByZXR1cm4gZXhwZWN0ZWQudGVzdChhY3R1YWwpO1xuICB9IGVsc2UgaWYgKGFjdHVhbCBpbnN0YW5jZW9mIGV4cGVjdGVkKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH0gZWxzZSBpZiAoZXhwZWN0ZWQuY2FsbCh7fSwgYWN0dWFsKSA9PT0gdHJ1ZSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiBfdGhyb3dzKHNob3VsZFRocm93LCBibG9jaywgZXhwZWN0ZWQsIG1lc3NhZ2UpIHtcbiAgdmFyIGFjdHVhbDtcblxuICBpZiAodXRpbC5pc1N0cmluZyhleHBlY3RlZCkpIHtcbiAgICBtZXNzYWdlID0gZXhwZWN0ZWQ7XG4gICAgZXhwZWN0ZWQgPSBudWxsO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBibG9jaygpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgYWN0dWFsID0gZTtcbiAgfVxuXG4gIG1lc3NhZ2UgPSAoZXhwZWN0ZWQgJiYgZXhwZWN0ZWQubmFtZSA/ICcgKCcgKyBleHBlY3RlZC5uYW1lICsgJykuJyA6ICcuJykgK1xuICAgICAgICAgICAgKG1lc3NhZ2UgPyAnICcgKyBtZXNzYWdlIDogJy4nKTtcblxuICBpZiAoc2hvdWxkVGhyb3cgJiYgIWFjdHVhbCkge1xuICAgIGZhaWwoYWN0dWFsLCBleHBlY3RlZCwgJ01pc3NpbmcgZXhwZWN0ZWQgZXhjZXB0aW9uJyArIG1lc3NhZ2UpO1xuICB9XG5cbiAgaWYgKCFzaG91bGRUaHJvdyAmJiBleHBlY3RlZEV4Y2VwdGlvbihhY3R1YWwsIGV4cGVjdGVkKSkge1xuICAgIGZhaWwoYWN0dWFsLCBleHBlY3RlZCwgJ0dvdCB1bndhbnRlZCBleGNlcHRpb24nICsgbWVzc2FnZSk7XG4gIH1cblxuICBpZiAoKHNob3VsZFRocm93ICYmIGFjdHVhbCAmJiBleHBlY3RlZCAmJlxuICAgICAgIWV4cGVjdGVkRXhjZXB0aW9uKGFjdHVhbCwgZXhwZWN0ZWQpKSB8fCAoIXNob3VsZFRocm93ICYmIGFjdHVhbCkpIHtcbiAgICB0aHJvdyBhY3R1YWw7XG4gIH1cbn1cblxuLy8gMTEuIEV4cGVjdGVkIHRvIHRocm93IGFuIGVycm9yOlxuLy8gYXNzZXJ0LnRocm93cyhibG9jaywgRXJyb3Jfb3B0LCBtZXNzYWdlX29wdCk7XG5cbmFzc2VydC50aHJvd3MgPSBmdW5jdGlvbihibG9jaywgLypvcHRpb25hbCovZXJyb3IsIC8qb3B0aW9uYWwqL21lc3NhZ2UpIHtcbiAgX3Rocm93cy5hcHBseSh0aGlzLCBbdHJ1ZV0uY29uY2F0KHBTbGljZS5jYWxsKGFyZ3VtZW50cykpKTtcbn07XG5cbi8vIEVYVEVOU0lPTiEgVGhpcyBpcyBhbm5veWluZyB0byB3cml0ZSBvdXRzaWRlIHRoaXMgbW9kdWxlLlxuYXNzZXJ0LmRvZXNOb3RUaHJvdyA9IGZ1bmN0aW9uKGJsb2NrLCAvKm9wdGlvbmFsKi9tZXNzYWdlKSB7XG4gIF90aHJvd3MuYXBwbHkodGhpcywgW2ZhbHNlXS5jb25jYXQocFNsaWNlLmNhbGwoYXJndW1lbnRzKSkpO1xufTtcblxuYXNzZXJ0LmlmRXJyb3IgPSBmdW5jdGlvbihlcnIpIHsgaWYgKGVycikge3Rocm93IGVycjt9fTtcblxudmFyIG9iamVjdEtleXMgPSBPYmplY3Qua2V5cyB8fCBmdW5jdGlvbiAob2JqKSB7XG4gIHZhciBrZXlzID0gW107XG4gIGZvciAodmFyIGtleSBpbiBvYmopIHtcbiAgICBpZiAoaGFzT3duLmNhbGwob2JqLCBrZXkpKSBrZXlzLnB1c2goa2V5KTtcbiAgfVxuICByZXR1cm4ga2V5cztcbn07XG4iLCJpZiAodHlwZW9mIE9iamVjdC5jcmVhdGUgPT09ICdmdW5jdGlvbicpIHtcbiAgLy8gaW1wbGVtZW50YXRpb24gZnJvbSBzdGFuZGFyZCBub2RlLmpzICd1dGlsJyBtb2R1bGVcbiAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpbmhlcml0cyhjdG9yLCBzdXBlckN0b3IpIHtcbiAgICBjdG9yLnN1cGVyXyA9IHN1cGVyQ3RvclxuICAgIGN0b3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShzdXBlckN0b3IucHJvdG90eXBlLCB7XG4gICAgICBjb25zdHJ1Y3Rvcjoge1xuICAgICAgICB2YWx1ZTogY3RvcixcbiAgICAgICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgIH1cbiAgICB9KTtcbiAgfTtcbn0gZWxzZSB7XG4gIC8vIG9sZCBzY2hvb2wgc2hpbSBmb3Igb2xkIGJyb3dzZXJzXG4gIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaW5oZXJpdHMoY3Rvciwgc3VwZXJDdG9yKSB7XG4gICAgY3Rvci5zdXBlcl8gPSBzdXBlckN0b3JcbiAgICB2YXIgVGVtcEN0b3IgPSBmdW5jdGlvbiAoKSB7fVxuICAgIFRlbXBDdG9yLnByb3RvdHlwZSA9IHN1cGVyQ3Rvci5wcm90b3R5cGVcbiAgICBjdG9yLnByb3RvdHlwZSA9IG5ldyBUZW1wQ3RvcigpXG4gICAgY3Rvci5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBjdG9yXG4gIH1cbn1cbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UXVldWUpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxICYmICFkcmFpbmluZykge1xuICAgICAgICBzZXRUaW1lb3V0KGRyYWluUXVldWUsIDApO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpc0J1ZmZlcihhcmcpIHtcbiAgcmV0dXJuIGFyZyAmJiB0eXBlb2YgYXJnID09PSAnb2JqZWN0J1xuICAgICYmIHR5cGVvZiBhcmcuY29weSA9PT0gJ2Z1bmN0aW9uJ1xuICAgICYmIHR5cGVvZiBhcmcuZmlsbCA9PT0gJ2Z1bmN0aW9uJ1xuICAgICYmIHR5cGVvZiBhcmcucmVhZFVJbnQ4ID09PSAnZnVuY3Rpb24nO1xufSIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG52YXIgZm9ybWF0UmVnRXhwID0gLyVbc2RqJV0vZztcbmV4cG9ydHMuZm9ybWF0ID0gZnVuY3Rpb24oZikge1xuICBpZiAoIWlzU3RyaW5nKGYpKSB7XG4gICAgdmFyIG9iamVjdHMgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgb2JqZWN0cy5wdXNoKGluc3BlY3QoYXJndW1lbnRzW2ldKSk7XG4gICAgfVxuICAgIHJldHVybiBvYmplY3RzLmpvaW4oJyAnKTtcbiAgfVxuXG4gIHZhciBpID0gMTtcbiAgdmFyIGFyZ3MgPSBhcmd1bWVudHM7XG4gIHZhciBsZW4gPSBhcmdzLmxlbmd0aDtcbiAgdmFyIHN0ciA9IFN0cmluZyhmKS5yZXBsYWNlKGZvcm1hdFJlZ0V4cCwgZnVuY3Rpb24oeCkge1xuICAgIGlmICh4ID09PSAnJSUnKSByZXR1cm4gJyUnO1xuICAgIGlmIChpID49IGxlbikgcmV0dXJuIHg7XG4gICAgc3dpdGNoICh4KSB7XG4gICAgICBjYXNlICclcyc6IHJldHVybiBTdHJpbmcoYXJnc1tpKytdKTtcbiAgICAgIGNhc2UgJyVkJzogcmV0dXJuIE51bWJlcihhcmdzW2krK10pO1xuICAgICAgY2FzZSAnJWonOlxuICAgICAgICB0cnkge1xuICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShhcmdzW2krK10pO1xuICAgICAgICB9IGNhdGNoIChfKSB7XG4gICAgICAgICAgcmV0dXJuICdbQ2lyY3VsYXJdJztcbiAgICAgICAgfVxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIHg7XG4gICAgfVxuICB9KTtcbiAgZm9yICh2YXIgeCA9IGFyZ3NbaV07IGkgPCBsZW47IHggPSBhcmdzWysraV0pIHtcbiAgICBpZiAoaXNOdWxsKHgpIHx8ICFpc09iamVjdCh4KSkge1xuICAgICAgc3RyICs9ICcgJyArIHg7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0ciArPSAnICcgKyBpbnNwZWN0KHgpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gc3RyO1xufTtcblxuXG4vLyBNYXJrIHRoYXQgYSBtZXRob2Qgc2hvdWxkIG5vdCBiZSB1c2VkLlxuLy8gUmV0dXJucyBhIG1vZGlmaWVkIGZ1bmN0aW9uIHdoaWNoIHdhcm5zIG9uY2UgYnkgZGVmYXVsdC5cbi8vIElmIC0tbm8tZGVwcmVjYXRpb24gaXMgc2V0LCB0aGVuIGl0IGlzIGEgbm8tb3AuXG5leHBvcnRzLmRlcHJlY2F0ZSA9IGZ1bmN0aW9uKGZuLCBtc2cpIHtcbiAgLy8gQWxsb3cgZm9yIGRlcHJlY2F0aW5nIHRoaW5ncyBpbiB0aGUgcHJvY2VzcyBvZiBzdGFydGluZyB1cC5cbiAgaWYgKGlzVW5kZWZpbmVkKGdsb2JhbC5wcm9jZXNzKSkge1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBleHBvcnRzLmRlcHJlY2F0ZShmbiwgbXNnKS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH07XG4gIH1cblxuICBpZiAocHJvY2Vzcy5ub0RlcHJlY2F0aW9uID09PSB0cnVlKSB7XG4gICAgcmV0dXJuIGZuO1xuICB9XG5cbiAgdmFyIHdhcm5lZCA9IGZhbHNlO1xuICBmdW5jdGlvbiBkZXByZWNhdGVkKCkge1xuICAgIGlmICghd2FybmVkKSB7XG4gICAgICBpZiAocHJvY2Vzcy50aHJvd0RlcHJlY2F0aW9uKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihtc2cpO1xuICAgICAgfSBlbHNlIGlmIChwcm9jZXNzLnRyYWNlRGVwcmVjYXRpb24pIHtcbiAgICAgICAgY29uc29sZS50cmFjZShtc2cpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihtc2cpO1xuICAgICAgfVxuICAgICAgd2FybmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gIH1cblxuICByZXR1cm4gZGVwcmVjYXRlZDtcbn07XG5cblxudmFyIGRlYnVncyA9IHt9O1xudmFyIGRlYnVnRW52aXJvbjtcbmV4cG9ydHMuZGVidWdsb2cgPSBmdW5jdGlvbihzZXQpIHtcbiAgaWYgKGlzVW5kZWZpbmVkKGRlYnVnRW52aXJvbikpXG4gICAgZGVidWdFbnZpcm9uID0gcHJvY2Vzcy5lbnYuTk9ERV9ERUJVRyB8fCAnJztcbiAgc2V0ID0gc2V0LnRvVXBwZXJDYXNlKCk7XG4gIGlmICghZGVidWdzW3NldF0pIHtcbiAgICBpZiAobmV3IFJlZ0V4cCgnXFxcXGInICsgc2V0ICsgJ1xcXFxiJywgJ2knKS50ZXN0KGRlYnVnRW52aXJvbikpIHtcbiAgICAgIHZhciBwaWQgPSBwcm9jZXNzLnBpZDtcbiAgICAgIGRlYnVnc1tzZXRdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBtc2cgPSBleHBvcnRzLmZvcm1hdC5hcHBseShleHBvcnRzLCBhcmd1bWVudHMpO1xuICAgICAgICBjb25zb2xlLmVycm9yKCclcyAlZDogJXMnLCBzZXQsIHBpZCwgbXNnKTtcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIGRlYnVnc1tzZXRdID0gZnVuY3Rpb24oKSB7fTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGRlYnVnc1tzZXRdO1xufTtcblxuXG4vKipcbiAqIEVjaG9zIHRoZSB2YWx1ZSBvZiBhIHZhbHVlLiBUcnlzIHRvIHByaW50IHRoZSB2YWx1ZSBvdXRcbiAqIGluIHRoZSBiZXN0IHdheSBwb3NzaWJsZSBnaXZlbiB0aGUgZGlmZmVyZW50IHR5cGVzLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmogVGhlIG9iamVjdCB0byBwcmludCBvdXQuXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0cyBPcHRpb25hbCBvcHRpb25zIG9iamVjdCB0aGF0IGFsdGVycyB0aGUgb3V0cHV0LlxuICovXG4vKiBsZWdhY3k6IG9iaiwgc2hvd0hpZGRlbiwgZGVwdGgsIGNvbG9ycyovXG5mdW5jdGlvbiBpbnNwZWN0KG9iaiwgb3B0cykge1xuICAvLyBkZWZhdWx0IG9wdGlvbnNcbiAgdmFyIGN0eCA9IHtcbiAgICBzZWVuOiBbXSxcbiAgICBzdHlsaXplOiBzdHlsaXplTm9Db2xvclxuICB9O1xuICAvLyBsZWdhY3kuLi5cbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPj0gMykgY3R4LmRlcHRoID0gYXJndW1lbnRzWzJdO1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+PSA0KSBjdHguY29sb3JzID0gYXJndW1lbnRzWzNdO1xuICBpZiAoaXNCb29sZWFuKG9wdHMpKSB7XG4gICAgLy8gbGVnYWN5Li4uXG4gICAgY3R4LnNob3dIaWRkZW4gPSBvcHRzO1xuICB9IGVsc2UgaWYgKG9wdHMpIHtcbiAgICAvLyBnb3QgYW4gXCJvcHRpb25zXCIgb2JqZWN0XG4gICAgZXhwb3J0cy5fZXh0ZW5kKGN0eCwgb3B0cyk7XG4gIH1cbiAgLy8gc2V0IGRlZmF1bHQgb3B0aW9uc1xuICBpZiAoaXNVbmRlZmluZWQoY3R4LnNob3dIaWRkZW4pKSBjdHguc2hvd0hpZGRlbiA9IGZhbHNlO1xuICBpZiAoaXNVbmRlZmluZWQoY3R4LmRlcHRoKSkgY3R4LmRlcHRoID0gMjtcbiAgaWYgKGlzVW5kZWZpbmVkKGN0eC5jb2xvcnMpKSBjdHguY29sb3JzID0gZmFsc2U7XG4gIGlmIChpc1VuZGVmaW5lZChjdHguY3VzdG9tSW5zcGVjdCkpIGN0eC5jdXN0b21JbnNwZWN0ID0gdHJ1ZTtcbiAgaWYgKGN0eC5jb2xvcnMpIGN0eC5zdHlsaXplID0gc3R5bGl6ZVdpdGhDb2xvcjtcbiAgcmV0dXJuIGZvcm1hdFZhbHVlKGN0eCwgb2JqLCBjdHguZGVwdGgpO1xufVxuZXhwb3J0cy5pbnNwZWN0ID0gaW5zcGVjdDtcblxuXG4vLyBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0FOU0lfZXNjYXBlX2NvZGUjZ3JhcGhpY3Ncbmluc3BlY3QuY29sb3JzID0ge1xuICAnYm9sZCcgOiBbMSwgMjJdLFxuICAnaXRhbGljJyA6IFszLCAyM10sXG4gICd1bmRlcmxpbmUnIDogWzQsIDI0XSxcbiAgJ2ludmVyc2UnIDogWzcsIDI3XSxcbiAgJ3doaXRlJyA6IFszNywgMzldLFxuICAnZ3JleScgOiBbOTAsIDM5XSxcbiAgJ2JsYWNrJyA6IFszMCwgMzldLFxuICAnYmx1ZScgOiBbMzQsIDM5XSxcbiAgJ2N5YW4nIDogWzM2LCAzOV0sXG4gICdncmVlbicgOiBbMzIsIDM5XSxcbiAgJ21hZ2VudGEnIDogWzM1LCAzOV0sXG4gICdyZWQnIDogWzMxLCAzOV0sXG4gICd5ZWxsb3cnIDogWzMzLCAzOV1cbn07XG5cbi8vIERvbid0IHVzZSAnYmx1ZScgbm90IHZpc2libGUgb24gY21kLmV4ZVxuaW5zcGVjdC5zdHlsZXMgPSB7XG4gICdzcGVjaWFsJzogJ2N5YW4nLFxuICAnbnVtYmVyJzogJ3llbGxvdycsXG4gICdib29sZWFuJzogJ3llbGxvdycsXG4gICd1bmRlZmluZWQnOiAnZ3JleScsXG4gICdudWxsJzogJ2JvbGQnLFxuICAnc3RyaW5nJzogJ2dyZWVuJyxcbiAgJ2RhdGUnOiAnbWFnZW50YScsXG4gIC8vIFwibmFtZVwiOiBpbnRlbnRpb25hbGx5IG5vdCBzdHlsaW5nXG4gICdyZWdleHAnOiAncmVkJ1xufTtcblxuXG5mdW5jdGlvbiBzdHlsaXplV2l0aENvbG9yKHN0ciwgc3R5bGVUeXBlKSB7XG4gIHZhciBzdHlsZSA9IGluc3BlY3Quc3R5bGVzW3N0eWxlVHlwZV07XG5cbiAgaWYgKHN0eWxlKSB7XG4gICAgcmV0dXJuICdcXHUwMDFiWycgKyBpbnNwZWN0LmNvbG9yc1tzdHlsZV1bMF0gKyAnbScgKyBzdHIgK1xuICAgICAgICAgICAnXFx1MDAxYlsnICsgaW5zcGVjdC5jb2xvcnNbc3R5bGVdWzFdICsgJ20nO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBzdHI7XG4gIH1cbn1cblxuXG5mdW5jdGlvbiBzdHlsaXplTm9Db2xvcihzdHIsIHN0eWxlVHlwZSkge1xuICByZXR1cm4gc3RyO1xufVxuXG5cbmZ1bmN0aW9uIGFycmF5VG9IYXNoKGFycmF5KSB7XG4gIHZhciBoYXNoID0ge307XG5cbiAgYXJyYXkuZm9yRWFjaChmdW5jdGlvbih2YWwsIGlkeCkge1xuICAgIGhhc2hbdmFsXSA9IHRydWU7XG4gIH0pO1xuXG4gIHJldHVybiBoYXNoO1xufVxuXG5cbmZ1bmN0aW9uIGZvcm1hdFZhbHVlKGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcykge1xuICAvLyBQcm92aWRlIGEgaG9vayBmb3IgdXNlci1zcGVjaWZpZWQgaW5zcGVjdCBmdW5jdGlvbnMuXG4gIC8vIENoZWNrIHRoYXQgdmFsdWUgaXMgYW4gb2JqZWN0IHdpdGggYW4gaW5zcGVjdCBmdW5jdGlvbiBvbiBpdFxuICBpZiAoY3R4LmN1c3RvbUluc3BlY3QgJiZcbiAgICAgIHZhbHVlICYmXG4gICAgICBpc0Z1bmN0aW9uKHZhbHVlLmluc3BlY3QpICYmXG4gICAgICAvLyBGaWx0ZXIgb3V0IHRoZSB1dGlsIG1vZHVsZSwgaXQncyBpbnNwZWN0IGZ1bmN0aW9uIGlzIHNwZWNpYWxcbiAgICAgIHZhbHVlLmluc3BlY3QgIT09IGV4cG9ydHMuaW5zcGVjdCAmJlxuICAgICAgLy8gQWxzbyBmaWx0ZXIgb3V0IGFueSBwcm90b3R5cGUgb2JqZWN0cyB1c2luZyB0aGUgY2lyY3VsYXIgY2hlY2suXG4gICAgICAhKHZhbHVlLmNvbnN0cnVjdG9yICYmIHZhbHVlLmNvbnN0cnVjdG9yLnByb3RvdHlwZSA9PT0gdmFsdWUpKSB7XG4gICAgdmFyIHJldCA9IHZhbHVlLmluc3BlY3QocmVjdXJzZVRpbWVzLCBjdHgpO1xuICAgIGlmICghaXNTdHJpbmcocmV0KSkge1xuICAgICAgcmV0ID0gZm9ybWF0VmFsdWUoY3R4LCByZXQsIHJlY3Vyc2VUaW1lcyk7XG4gICAgfVxuICAgIHJldHVybiByZXQ7XG4gIH1cblxuICAvLyBQcmltaXRpdmUgdHlwZXMgY2Fubm90IGhhdmUgcHJvcGVydGllc1xuICB2YXIgcHJpbWl0aXZlID0gZm9ybWF0UHJpbWl0aXZlKGN0eCwgdmFsdWUpO1xuICBpZiAocHJpbWl0aXZlKSB7XG4gICAgcmV0dXJuIHByaW1pdGl2ZTtcbiAgfVxuXG4gIC8vIExvb2sgdXAgdGhlIGtleXMgb2YgdGhlIG9iamVjdC5cbiAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyh2YWx1ZSk7XG4gIHZhciB2aXNpYmxlS2V5cyA9IGFycmF5VG9IYXNoKGtleXMpO1xuXG4gIGlmIChjdHguc2hvd0hpZGRlbikge1xuICAgIGtleXMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyh2YWx1ZSk7XG4gIH1cblxuICAvLyBJRSBkb2Vzbid0IG1ha2UgZXJyb3IgZmllbGRzIG5vbi1lbnVtZXJhYmxlXG4gIC8vIGh0dHA6Ly9tc2RuLm1pY3Jvc29mdC5jb20vZW4tdXMvbGlicmFyeS9pZS9kd3c1MnNidCh2PXZzLjk0KS5hc3B4XG4gIGlmIChpc0Vycm9yKHZhbHVlKVxuICAgICAgJiYgKGtleXMuaW5kZXhPZignbWVzc2FnZScpID49IDAgfHwga2V5cy5pbmRleE9mKCdkZXNjcmlwdGlvbicpID49IDApKSB7XG4gICAgcmV0dXJuIGZvcm1hdEVycm9yKHZhbHVlKTtcbiAgfVxuXG4gIC8vIFNvbWUgdHlwZSBvZiBvYmplY3Qgd2l0aG91dCBwcm9wZXJ0aWVzIGNhbiBiZSBzaG9ydGN1dHRlZC5cbiAgaWYgKGtleXMubGVuZ3RoID09PSAwKSB7XG4gICAgaWYgKGlzRnVuY3Rpb24odmFsdWUpKSB7XG4gICAgICB2YXIgbmFtZSA9IHZhbHVlLm5hbWUgPyAnOiAnICsgdmFsdWUubmFtZSA6ICcnO1xuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKCdbRnVuY3Rpb24nICsgbmFtZSArICddJywgJ3NwZWNpYWwnKTtcbiAgICB9XG4gICAgaWYgKGlzUmVnRXhwKHZhbHVlKSkge1xuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKFJlZ0V4cC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSksICdyZWdleHAnKTtcbiAgICB9XG4gICAgaWYgKGlzRGF0ZSh2YWx1ZSkpIHtcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZShEYXRlLnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSwgJ2RhdGUnKTtcbiAgICB9XG4gICAgaWYgKGlzRXJyb3IodmFsdWUpKSB7XG4gICAgICByZXR1cm4gZm9ybWF0RXJyb3IodmFsdWUpO1xuICAgIH1cbiAgfVxuXG4gIHZhciBiYXNlID0gJycsIGFycmF5ID0gZmFsc2UsIGJyYWNlcyA9IFsneycsICd9J107XG5cbiAgLy8gTWFrZSBBcnJheSBzYXkgdGhhdCB0aGV5IGFyZSBBcnJheVxuICBpZiAoaXNBcnJheSh2YWx1ZSkpIHtcbiAgICBhcnJheSA9IHRydWU7XG4gICAgYnJhY2VzID0gWydbJywgJ10nXTtcbiAgfVxuXG4gIC8vIE1ha2UgZnVuY3Rpb25zIHNheSB0aGF0IHRoZXkgYXJlIGZ1bmN0aW9uc1xuICBpZiAoaXNGdW5jdGlvbih2YWx1ZSkpIHtcbiAgICB2YXIgbiA9IHZhbHVlLm5hbWUgPyAnOiAnICsgdmFsdWUubmFtZSA6ICcnO1xuICAgIGJhc2UgPSAnIFtGdW5jdGlvbicgKyBuICsgJ10nO1xuICB9XG5cbiAgLy8gTWFrZSBSZWdFeHBzIHNheSB0aGF0IHRoZXkgYXJlIFJlZ0V4cHNcbiAgaWYgKGlzUmVnRXhwKHZhbHVlKSkge1xuICAgIGJhc2UgPSAnICcgKyBSZWdFeHAucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpO1xuICB9XG5cbiAgLy8gTWFrZSBkYXRlcyB3aXRoIHByb3BlcnRpZXMgZmlyc3Qgc2F5IHRoZSBkYXRlXG4gIGlmIChpc0RhdGUodmFsdWUpKSB7XG4gICAgYmFzZSA9ICcgJyArIERhdGUucHJvdG90eXBlLnRvVVRDU3RyaW5nLmNhbGwodmFsdWUpO1xuICB9XG5cbiAgLy8gTWFrZSBlcnJvciB3aXRoIG1lc3NhZ2UgZmlyc3Qgc2F5IHRoZSBlcnJvclxuICBpZiAoaXNFcnJvcih2YWx1ZSkpIHtcbiAgICBiYXNlID0gJyAnICsgZm9ybWF0RXJyb3IodmFsdWUpO1xuICB9XG5cbiAgaWYgKGtleXMubGVuZ3RoID09PSAwICYmICghYXJyYXkgfHwgdmFsdWUubGVuZ3RoID09IDApKSB7XG4gICAgcmV0dXJuIGJyYWNlc1swXSArIGJhc2UgKyBicmFjZXNbMV07XG4gIH1cblxuICBpZiAocmVjdXJzZVRpbWVzIDwgMCkge1xuICAgIGlmIChpc1JlZ0V4cCh2YWx1ZSkpIHtcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZShSZWdFeHAucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpLCAncmVnZXhwJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZSgnW09iamVjdF0nLCAnc3BlY2lhbCcpO1xuICAgIH1cbiAgfVxuXG4gIGN0eC5zZWVuLnB1c2godmFsdWUpO1xuXG4gIHZhciBvdXRwdXQ7XG4gIGlmIChhcnJheSkge1xuICAgIG91dHB1dCA9IGZvcm1hdEFycmF5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsIGtleXMpO1xuICB9IGVsc2Uge1xuICAgIG91dHB1dCA9IGtleXMubWFwKGZ1bmN0aW9uKGtleSkge1xuICAgICAgcmV0dXJuIGZvcm1hdFByb3BlcnR5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsIGtleSwgYXJyYXkpO1xuICAgIH0pO1xuICB9XG5cbiAgY3R4LnNlZW4ucG9wKCk7XG5cbiAgcmV0dXJuIHJlZHVjZVRvU2luZ2xlU3RyaW5nKG91dHB1dCwgYmFzZSwgYnJhY2VzKTtcbn1cblxuXG5mdW5jdGlvbiBmb3JtYXRQcmltaXRpdmUoY3R4LCB2YWx1ZSkge1xuICBpZiAoaXNVbmRlZmluZWQodmFsdWUpKVxuICAgIHJldHVybiBjdHguc3R5bGl6ZSgndW5kZWZpbmVkJywgJ3VuZGVmaW5lZCcpO1xuICBpZiAoaXNTdHJpbmcodmFsdWUpKSB7XG4gICAgdmFyIHNpbXBsZSA9ICdcXCcnICsgSlNPTi5zdHJpbmdpZnkodmFsdWUpLnJlcGxhY2UoL15cInxcIiQvZywgJycpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvJy9nLCBcIlxcXFwnXCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvXFxcXFwiL2csICdcIicpICsgJ1xcJyc7XG4gICAgcmV0dXJuIGN0eC5zdHlsaXplKHNpbXBsZSwgJ3N0cmluZycpO1xuICB9XG4gIGlmIChpc051bWJlcih2YWx1ZSkpXG4gICAgcmV0dXJuIGN0eC5zdHlsaXplKCcnICsgdmFsdWUsICdudW1iZXInKTtcbiAgaWYgKGlzQm9vbGVhbih2YWx1ZSkpXG4gICAgcmV0dXJuIGN0eC5zdHlsaXplKCcnICsgdmFsdWUsICdib29sZWFuJyk7XG4gIC8vIEZvciBzb21lIHJlYXNvbiB0eXBlb2YgbnVsbCBpcyBcIm9iamVjdFwiLCBzbyBzcGVjaWFsIGNhc2UgaGVyZS5cbiAgaWYgKGlzTnVsbCh2YWx1ZSkpXG4gICAgcmV0dXJuIGN0eC5zdHlsaXplKCdudWxsJywgJ251bGwnKTtcbn1cblxuXG5mdW5jdGlvbiBmb3JtYXRFcnJvcih2YWx1ZSkge1xuICByZXR1cm4gJ1snICsgRXJyb3IucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpICsgJ10nO1xufVxuXG5cbmZ1bmN0aW9uIGZvcm1hdEFycmF5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsIGtleXMpIHtcbiAgdmFyIG91dHB1dCA9IFtdO1xuICBmb3IgKHZhciBpID0gMCwgbCA9IHZhbHVlLmxlbmd0aDsgaSA8IGw7ICsraSkge1xuICAgIGlmIChoYXNPd25Qcm9wZXJ0eSh2YWx1ZSwgU3RyaW5nKGkpKSkge1xuICAgICAgb3V0cHV0LnB1c2goZm9ybWF0UHJvcGVydHkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cyxcbiAgICAgICAgICBTdHJpbmcoaSksIHRydWUpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3V0cHV0LnB1c2goJycpO1xuICAgIH1cbiAgfVxuICBrZXlzLmZvckVhY2goZnVuY3Rpb24oa2V5KSB7XG4gICAgaWYgKCFrZXkubWF0Y2goL15cXGQrJC8pKSB7XG4gICAgICBvdXRwdXQucHVzaChmb3JtYXRQcm9wZXJ0eShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLFxuICAgICAgICAgIGtleSwgdHJ1ZSkpO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiBvdXRwdXQ7XG59XG5cblxuZnVuY3Rpb24gZm9ybWF0UHJvcGVydHkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cywga2V5LCBhcnJheSkge1xuICB2YXIgbmFtZSwgc3RyLCBkZXNjO1xuICBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih2YWx1ZSwga2V5KSB8fCB7IHZhbHVlOiB2YWx1ZVtrZXldIH07XG4gIGlmIChkZXNjLmdldCkge1xuICAgIGlmIChkZXNjLnNldCkge1xuICAgICAgc3RyID0gY3R4LnN0eWxpemUoJ1tHZXR0ZXIvU2V0dGVyXScsICdzcGVjaWFsJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0ciA9IGN0eC5zdHlsaXplKCdbR2V0dGVyXScsICdzcGVjaWFsJyk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGlmIChkZXNjLnNldCkge1xuICAgICAgc3RyID0gY3R4LnN0eWxpemUoJ1tTZXR0ZXJdJywgJ3NwZWNpYWwnKTtcbiAgICB9XG4gIH1cbiAgaWYgKCFoYXNPd25Qcm9wZXJ0eSh2aXNpYmxlS2V5cywga2V5KSkge1xuICAgIG5hbWUgPSAnWycgKyBrZXkgKyAnXSc7XG4gIH1cbiAgaWYgKCFzdHIpIHtcbiAgICBpZiAoY3R4LnNlZW4uaW5kZXhPZihkZXNjLnZhbHVlKSA8IDApIHtcbiAgICAgIGlmIChpc051bGwocmVjdXJzZVRpbWVzKSkge1xuICAgICAgICBzdHIgPSBmb3JtYXRWYWx1ZShjdHgsIGRlc2MudmFsdWUsIG51bGwpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RyID0gZm9ybWF0VmFsdWUoY3R4LCBkZXNjLnZhbHVlLCByZWN1cnNlVGltZXMgLSAxKTtcbiAgICAgIH1cbiAgICAgIGlmIChzdHIuaW5kZXhPZignXFxuJykgPiAtMSkge1xuICAgICAgICBpZiAoYXJyYXkpIHtcbiAgICAgICAgICBzdHIgPSBzdHIuc3BsaXQoJ1xcbicpLm1hcChmdW5jdGlvbihsaW5lKSB7XG4gICAgICAgICAgICByZXR1cm4gJyAgJyArIGxpbmU7XG4gICAgICAgICAgfSkuam9pbignXFxuJykuc3Vic3RyKDIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHN0ciA9ICdcXG4nICsgc3RyLnNwbGl0KCdcXG4nKS5tYXAoZnVuY3Rpb24obGluZSkge1xuICAgICAgICAgICAgcmV0dXJuICcgICAnICsgbGluZTtcbiAgICAgICAgICB9KS5qb2luKCdcXG4nKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBzdHIgPSBjdHguc3R5bGl6ZSgnW0NpcmN1bGFyXScsICdzcGVjaWFsJyk7XG4gICAgfVxuICB9XG4gIGlmIChpc1VuZGVmaW5lZChuYW1lKSkge1xuICAgIGlmIChhcnJheSAmJiBrZXkubWF0Y2goL15cXGQrJC8pKSB7XG4gICAgICByZXR1cm4gc3RyO1xuICAgIH1cbiAgICBuYW1lID0gSlNPTi5zdHJpbmdpZnkoJycgKyBrZXkpO1xuICAgIGlmIChuYW1lLm1hdGNoKC9eXCIoW2EtekEtWl9dW2EtekEtWl8wLTldKilcIiQvKSkge1xuICAgICAgbmFtZSA9IG5hbWUuc3Vic3RyKDEsIG5hbWUubGVuZ3RoIC0gMik7XG4gICAgICBuYW1lID0gY3R4LnN0eWxpemUobmFtZSwgJ25hbWUnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbmFtZSA9IG5hbWUucmVwbGFjZSgvJy9nLCBcIlxcXFwnXCIpXG4gICAgICAgICAgICAgICAgIC5yZXBsYWNlKC9cXFxcXCIvZywgJ1wiJylcbiAgICAgICAgICAgICAgICAgLnJlcGxhY2UoLyheXCJ8XCIkKS9nLCBcIidcIik7XG4gICAgICBuYW1lID0gY3R4LnN0eWxpemUobmFtZSwgJ3N0cmluZycpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBuYW1lICsgJzogJyArIHN0cjtcbn1cblxuXG5mdW5jdGlvbiByZWR1Y2VUb1NpbmdsZVN0cmluZyhvdXRwdXQsIGJhc2UsIGJyYWNlcykge1xuICB2YXIgbnVtTGluZXNFc3QgPSAwO1xuICB2YXIgbGVuZ3RoID0gb3V0cHV0LnJlZHVjZShmdW5jdGlvbihwcmV2LCBjdXIpIHtcbiAgICBudW1MaW5lc0VzdCsrO1xuICAgIGlmIChjdXIuaW5kZXhPZignXFxuJykgPj0gMCkgbnVtTGluZXNFc3QrKztcbiAgICByZXR1cm4gcHJldiArIGN1ci5yZXBsYWNlKC9cXHUwMDFiXFxbXFxkXFxkP20vZywgJycpLmxlbmd0aCArIDE7XG4gIH0sIDApO1xuXG4gIGlmIChsZW5ndGggPiA2MCkge1xuICAgIHJldHVybiBicmFjZXNbMF0gK1xuICAgICAgICAgICAoYmFzZSA9PT0gJycgPyAnJyA6IGJhc2UgKyAnXFxuICcpICtcbiAgICAgICAgICAgJyAnICtcbiAgICAgICAgICAgb3V0cHV0LmpvaW4oJyxcXG4gICcpICtcbiAgICAgICAgICAgJyAnICtcbiAgICAgICAgICAgYnJhY2VzWzFdO1xuICB9XG5cbiAgcmV0dXJuIGJyYWNlc1swXSArIGJhc2UgKyAnICcgKyBvdXRwdXQuam9pbignLCAnKSArICcgJyArIGJyYWNlc1sxXTtcbn1cblxuXG4vLyBOT1RFOiBUaGVzZSB0eXBlIGNoZWNraW5nIGZ1bmN0aW9ucyBpbnRlbnRpb25hbGx5IGRvbid0IHVzZSBgaW5zdGFuY2VvZmBcbi8vIGJlY2F1c2UgaXQgaXMgZnJhZ2lsZSBhbmQgY2FuIGJlIGVhc2lseSBmYWtlZCB3aXRoIGBPYmplY3QuY3JlYXRlKClgLlxuZnVuY3Rpb24gaXNBcnJheShhcikge1xuICByZXR1cm4gQXJyYXkuaXNBcnJheShhcik7XG59XG5leHBvcnRzLmlzQXJyYXkgPSBpc0FycmF5O1xuXG5mdW5jdGlvbiBpc0Jvb2xlYW4oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnYm9vbGVhbic7XG59XG5leHBvcnRzLmlzQm9vbGVhbiA9IGlzQm9vbGVhbjtcblxuZnVuY3Rpb24gaXNOdWxsKGFyZykge1xuICByZXR1cm4gYXJnID09PSBudWxsO1xufVxuZXhwb3J0cy5pc051bGwgPSBpc051bGw7XG5cbmZ1bmN0aW9uIGlzTnVsbE9yVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09IG51bGw7XG59XG5leHBvcnRzLmlzTnVsbE9yVW5kZWZpbmVkID0gaXNOdWxsT3JVbmRlZmluZWQ7XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5leHBvcnRzLmlzTnVtYmVyID0gaXNOdW1iZXI7XG5cbmZ1bmN0aW9uIGlzU3RyaW5nKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ3N0cmluZyc7XG59XG5leHBvcnRzLmlzU3RyaW5nID0gaXNTdHJpbmc7XG5cbmZ1bmN0aW9uIGlzU3ltYm9sKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ3N5bWJvbCc7XG59XG5leHBvcnRzLmlzU3ltYm9sID0gaXNTeW1ib2w7XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG5leHBvcnRzLmlzVW5kZWZpbmVkID0gaXNVbmRlZmluZWQ7XG5cbmZ1bmN0aW9uIGlzUmVnRXhwKHJlKSB7XG4gIHJldHVybiBpc09iamVjdChyZSkgJiYgb2JqZWN0VG9TdHJpbmcocmUpID09PSAnW29iamVjdCBSZWdFeHBdJztcbn1cbmV4cG9ydHMuaXNSZWdFeHAgPSBpc1JlZ0V4cDtcblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5leHBvcnRzLmlzT2JqZWN0ID0gaXNPYmplY3Q7XG5cbmZ1bmN0aW9uIGlzRGF0ZShkKSB7XG4gIHJldHVybiBpc09iamVjdChkKSAmJiBvYmplY3RUb1N0cmluZyhkKSA9PT0gJ1tvYmplY3QgRGF0ZV0nO1xufVxuZXhwb3J0cy5pc0RhdGUgPSBpc0RhdGU7XG5cbmZ1bmN0aW9uIGlzRXJyb3IoZSkge1xuICByZXR1cm4gaXNPYmplY3QoZSkgJiZcbiAgICAgIChvYmplY3RUb1N0cmluZyhlKSA9PT0gJ1tvYmplY3QgRXJyb3JdJyB8fCBlIGluc3RhbmNlb2YgRXJyb3IpO1xufVxuZXhwb3J0cy5pc0Vycm9yID0gaXNFcnJvcjtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5leHBvcnRzLmlzRnVuY3Rpb24gPSBpc0Z1bmN0aW9uO1xuXG5mdW5jdGlvbiBpc1ByaW1pdGl2ZShhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gbnVsbCB8fFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ2Jvb2xlYW4nIHx8XG4gICAgICAgICB0eXBlb2YgYXJnID09PSAnbnVtYmVyJyB8fFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ3N0cmluZycgfHxcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICdzeW1ib2wnIHx8ICAvLyBFUzYgc3ltYm9sXG4gICAgICAgICB0eXBlb2YgYXJnID09PSAndW5kZWZpbmVkJztcbn1cbmV4cG9ydHMuaXNQcmltaXRpdmUgPSBpc1ByaW1pdGl2ZTtcblxuZXhwb3J0cy5pc0J1ZmZlciA9IHJlcXVpcmUoJy4vc3VwcG9ydC9pc0J1ZmZlcicpO1xuXG5mdW5jdGlvbiBvYmplY3RUb1N0cmluZyhvKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwobyk7XG59XG5cblxuZnVuY3Rpb24gcGFkKG4pIHtcbiAgcmV0dXJuIG4gPCAxMCA/ICcwJyArIG4udG9TdHJpbmcoMTApIDogbi50b1N0cmluZygxMCk7XG59XG5cblxudmFyIG1vbnRocyA9IFsnSmFuJywgJ0ZlYicsICdNYXInLCAnQXByJywgJ01heScsICdKdW4nLCAnSnVsJywgJ0F1ZycsICdTZXAnLFxuICAgICAgICAgICAgICAnT2N0JywgJ05vdicsICdEZWMnXTtcblxuLy8gMjYgRmViIDE2OjE5OjM0XG5mdW5jdGlvbiB0aW1lc3RhbXAoKSB7XG4gIHZhciBkID0gbmV3IERhdGUoKTtcbiAgdmFyIHRpbWUgPSBbcGFkKGQuZ2V0SG91cnMoKSksXG4gICAgICAgICAgICAgIHBhZChkLmdldE1pbnV0ZXMoKSksXG4gICAgICAgICAgICAgIHBhZChkLmdldFNlY29uZHMoKSldLmpvaW4oJzonKTtcbiAgcmV0dXJuIFtkLmdldERhdGUoKSwgbW9udGhzW2QuZ2V0TW9udGgoKV0sIHRpbWVdLmpvaW4oJyAnKTtcbn1cblxuXG4vLyBsb2cgaXMganVzdCBhIHRoaW4gd3JhcHBlciB0byBjb25zb2xlLmxvZyB0aGF0IHByZXBlbmRzIGEgdGltZXN0YW1wXG5leHBvcnRzLmxvZyA9IGZ1bmN0aW9uKCkge1xuICBjb25zb2xlLmxvZygnJXMgLSAlcycsIHRpbWVzdGFtcCgpLCBleHBvcnRzLmZvcm1hdC5hcHBseShleHBvcnRzLCBhcmd1bWVudHMpKTtcbn07XG5cblxuLyoqXG4gKiBJbmhlcml0IHRoZSBwcm90b3R5cGUgbWV0aG9kcyBmcm9tIG9uZSBjb25zdHJ1Y3RvciBpbnRvIGFub3RoZXIuXG4gKlxuICogVGhlIEZ1bmN0aW9uLnByb3RvdHlwZS5pbmhlcml0cyBmcm9tIGxhbmcuanMgcmV3cml0dGVuIGFzIGEgc3RhbmRhbG9uZVxuICogZnVuY3Rpb24gKG5vdCBvbiBGdW5jdGlvbi5wcm90b3R5cGUpLiBOT1RFOiBJZiB0aGlzIGZpbGUgaXMgdG8gYmUgbG9hZGVkXG4gKiBkdXJpbmcgYm9vdHN0cmFwcGluZyB0aGlzIGZ1bmN0aW9uIG5lZWRzIHRvIGJlIHJld3JpdHRlbiB1c2luZyBzb21lIG5hdGl2ZVxuICogZnVuY3Rpb25zIGFzIHByb3RvdHlwZSBzZXR1cCB1c2luZyBub3JtYWwgSmF2YVNjcmlwdCBkb2VzIG5vdCB3b3JrIGFzXG4gKiBleHBlY3RlZCBkdXJpbmcgYm9vdHN0cmFwcGluZyAoc2VlIG1pcnJvci5qcyBpbiByMTE0OTAzKS5cbiAqXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBjdG9yIENvbnN0cnVjdG9yIGZ1bmN0aW9uIHdoaWNoIG5lZWRzIHRvIGluaGVyaXQgdGhlXG4gKiAgICAgcHJvdG90eXBlLlxuICogQHBhcmFtIHtmdW5jdGlvbn0gc3VwZXJDdG9yIENvbnN0cnVjdG9yIGZ1bmN0aW9uIHRvIGluaGVyaXQgcHJvdG90eXBlIGZyb20uXG4gKi9cbmV4cG9ydHMuaW5oZXJpdHMgPSByZXF1aXJlKCdpbmhlcml0cycpO1xuXG5leHBvcnRzLl9leHRlbmQgPSBmdW5jdGlvbihvcmlnaW4sIGFkZCkge1xuICAvLyBEb24ndCBkbyBhbnl0aGluZyBpZiBhZGQgaXNuJ3QgYW4gb2JqZWN0XG4gIGlmICghYWRkIHx8ICFpc09iamVjdChhZGQpKSByZXR1cm4gb3JpZ2luO1xuXG4gIHZhciBrZXlzID0gT2JqZWN0LmtleXMoYWRkKTtcbiAgdmFyIGkgPSBrZXlzLmxlbmd0aDtcbiAgd2hpbGUgKGktLSkge1xuICAgIG9yaWdpbltrZXlzW2ldXSA9IGFkZFtrZXlzW2ldXTtcbiAgfVxuICByZXR1cm4gb3JpZ2luO1xufTtcblxuZnVuY3Rpb24gaGFzT3duUHJvcGVydHkob2JqLCBwcm9wKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBwcm9wKTtcbn1cbiIsIlxuLyoqXG4gKiBUaGlzIGlzIHRoZSB3ZWIgYnJvd3NlciBpbXBsZW1lbnRhdGlvbiBvZiBgZGVidWcoKWAuXG4gKlxuICogRXhwb3NlIGBkZWJ1ZygpYCBhcyB0aGUgbW9kdWxlLlxuICovXG5cbmV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vZGVidWcnKTtcbmV4cG9ydHMubG9nID0gbG9nO1xuZXhwb3J0cy5mb3JtYXRBcmdzID0gZm9ybWF0QXJncztcbmV4cG9ydHMuc2F2ZSA9IHNhdmU7XG5leHBvcnRzLmxvYWQgPSBsb2FkO1xuZXhwb3J0cy51c2VDb2xvcnMgPSB1c2VDb2xvcnM7XG5leHBvcnRzLnN0b3JhZ2UgPSAndW5kZWZpbmVkJyAhPSB0eXBlb2YgY2hyb21lXG4gICAgICAgICAgICAgICAmJiAndW5kZWZpbmVkJyAhPSB0eXBlb2YgY2hyb21lLnN0b3JhZ2VcbiAgICAgICAgICAgICAgICAgID8gY2hyb21lLnN0b3JhZ2UubG9jYWxcbiAgICAgICAgICAgICAgICAgIDogbG9jYWxzdG9yYWdlKCk7XG5cbi8qKlxuICogQ29sb3JzLlxuICovXG5cbmV4cG9ydHMuY29sb3JzID0gW1xuICAnbGlnaHRzZWFncmVlbicsXG4gICdmb3Jlc3RncmVlbicsXG4gICdnb2xkZW5yb2QnLFxuICAnZG9kZ2VyYmx1ZScsXG4gICdkYXJrb3JjaGlkJyxcbiAgJ2NyaW1zb24nXG5dO1xuXG4vKipcbiAqIEN1cnJlbnRseSBvbmx5IFdlYktpdC1iYXNlZCBXZWIgSW5zcGVjdG9ycywgRmlyZWZveCA+PSB2MzEsXG4gKiBhbmQgdGhlIEZpcmVidWcgZXh0ZW5zaW9uIChhbnkgRmlyZWZveCB2ZXJzaW9uKSBhcmUga25vd25cbiAqIHRvIHN1cHBvcnQgXCIlY1wiIENTUyBjdXN0b21pemF0aW9ucy5cbiAqXG4gKiBUT0RPOiBhZGQgYSBgbG9jYWxTdG9yYWdlYCB2YXJpYWJsZSB0byBleHBsaWNpdGx5IGVuYWJsZS9kaXNhYmxlIGNvbG9yc1xuICovXG5cbmZ1bmN0aW9uIHVzZUNvbG9ycygpIHtcbiAgLy8gaXMgd2Via2l0PyBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8xNjQ1OTYwNi8zNzY3NzNcbiAgcmV0dXJuICgnV2Via2l0QXBwZWFyYW5jZScgaW4gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnN0eWxlKSB8fFxuICAgIC8vIGlzIGZpcmVidWc/IGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzM5ODEyMC8zNzY3NzNcbiAgICAod2luZG93LmNvbnNvbGUgJiYgKGNvbnNvbGUuZmlyZWJ1ZyB8fCAoY29uc29sZS5leGNlcHRpb24gJiYgY29uc29sZS50YWJsZSkpKSB8fFxuICAgIC8vIGlzIGZpcmVmb3ggPj0gdjMxP1xuICAgIC8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvVG9vbHMvV2ViX0NvbnNvbGUjU3R5bGluZ19tZXNzYWdlc1xuICAgIChuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkubWF0Y2goL2ZpcmVmb3hcXC8oXFxkKykvKSAmJiBwYXJzZUludChSZWdFeHAuJDEsIDEwKSA+PSAzMSk7XG59XG5cbi8qKlxuICogTWFwICVqIHRvIGBKU09OLnN0cmluZ2lmeSgpYCwgc2luY2Ugbm8gV2ViIEluc3BlY3RvcnMgZG8gdGhhdCBieSBkZWZhdWx0LlxuICovXG5cbmV4cG9ydHMuZm9ybWF0dGVycy5qID0gZnVuY3Rpb24odikge1xuICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodik7XG59O1xuXG5cbi8qKlxuICogQ29sb3JpemUgbG9nIGFyZ3VtZW50cyBpZiBlbmFibGVkLlxuICpcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZm9ybWF0QXJncygpIHtcbiAgdmFyIGFyZ3MgPSBhcmd1bWVudHM7XG4gIHZhciB1c2VDb2xvcnMgPSB0aGlzLnVzZUNvbG9ycztcblxuICBhcmdzWzBdID0gKHVzZUNvbG9ycyA/ICclYycgOiAnJylcbiAgICArIHRoaXMubmFtZXNwYWNlXG4gICAgKyAodXNlQ29sb3JzID8gJyAlYycgOiAnICcpXG4gICAgKyBhcmdzWzBdXG4gICAgKyAodXNlQ29sb3JzID8gJyVjICcgOiAnICcpXG4gICAgKyAnKycgKyBleHBvcnRzLmh1bWFuaXplKHRoaXMuZGlmZik7XG5cbiAgaWYgKCF1c2VDb2xvcnMpIHJldHVybiBhcmdzO1xuXG4gIHZhciBjID0gJ2NvbG9yOiAnICsgdGhpcy5jb2xvcjtcbiAgYXJncyA9IFthcmdzWzBdLCBjLCAnY29sb3I6IGluaGVyaXQnXS5jb25jYXQoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJncywgMSkpO1xuXG4gIC8vIHRoZSBmaW5hbCBcIiVjXCIgaXMgc29tZXdoYXQgdHJpY2t5LCBiZWNhdXNlIHRoZXJlIGNvdWxkIGJlIG90aGVyXG4gIC8vIGFyZ3VtZW50cyBwYXNzZWQgZWl0aGVyIGJlZm9yZSBvciBhZnRlciB0aGUgJWMsIHNvIHdlIG5lZWQgdG9cbiAgLy8gZmlndXJlIG91dCB0aGUgY29ycmVjdCBpbmRleCB0byBpbnNlcnQgdGhlIENTUyBpbnRvXG4gIHZhciBpbmRleCA9IDA7XG4gIHZhciBsYXN0QyA9IDA7XG4gIGFyZ3NbMF0ucmVwbGFjZSgvJVthLXolXS9nLCBmdW5jdGlvbihtYXRjaCkge1xuICAgIGlmICgnJSUnID09PSBtYXRjaCkgcmV0dXJuO1xuICAgIGluZGV4Kys7XG4gICAgaWYgKCclYycgPT09IG1hdGNoKSB7XG4gICAgICAvLyB3ZSBvbmx5IGFyZSBpbnRlcmVzdGVkIGluIHRoZSAqbGFzdCogJWNcbiAgICAgIC8vICh0aGUgdXNlciBtYXkgaGF2ZSBwcm92aWRlZCB0aGVpciBvd24pXG4gICAgICBsYXN0QyA9IGluZGV4O1xuICAgIH1cbiAgfSk7XG5cbiAgYXJncy5zcGxpY2UobGFzdEMsIDAsIGMpO1xuICByZXR1cm4gYXJncztcbn1cblxuLyoqXG4gKiBJbnZva2VzIGBjb25zb2xlLmxvZygpYCB3aGVuIGF2YWlsYWJsZS5cbiAqIE5vLW9wIHdoZW4gYGNvbnNvbGUubG9nYCBpcyBub3QgYSBcImZ1bmN0aW9uXCIuXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBsb2coKSB7XG4gIC8vIHRoaXMgaGFja2VyeSBpcyByZXF1aXJlZCBmb3IgSUU4LzksIHdoZXJlXG4gIC8vIHRoZSBgY29uc29sZS5sb2dgIGZ1bmN0aW9uIGRvZXNuJ3QgaGF2ZSAnYXBwbHknXG4gIHJldHVybiAnb2JqZWN0JyA9PT0gdHlwZW9mIGNvbnNvbGVcbiAgICAmJiBjb25zb2xlLmxvZ1xuICAgICYmIEZ1bmN0aW9uLnByb3RvdHlwZS5hcHBseS5jYWxsKGNvbnNvbGUubG9nLCBjb25zb2xlLCBhcmd1bWVudHMpO1xufVxuXG4vKipcbiAqIFNhdmUgYG5hbWVzcGFjZXNgLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lc3BhY2VzXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBzYXZlKG5hbWVzcGFjZXMpIHtcbiAgdHJ5IHtcbiAgICBpZiAobnVsbCA9PSBuYW1lc3BhY2VzKSB7XG4gICAgICBleHBvcnRzLnN0b3JhZ2UucmVtb3ZlSXRlbSgnZGVidWcnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZXhwb3J0cy5zdG9yYWdlLmRlYnVnID0gbmFtZXNwYWNlcztcbiAgICB9XG4gIH0gY2F0Y2goZSkge31cbn1cblxuLyoqXG4gKiBMb2FkIGBuYW1lc3BhY2VzYC5cbiAqXG4gKiBAcmV0dXJuIHtTdHJpbmd9IHJldHVybnMgdGhlIHByZXZpb3VzbHkgcGVyc2lzdGVkIGRlYnVnIG1vZGVzXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBsb2FkKCkge1xuICB2YXIgcjtcbiAgdHJ5IHtcbiAgICByID0gZXhwb3J0cy5zdG9yYWdlLmRlYnVnO1xuICB9IGNhdGNoKGUpIHt9XG4gIHJldHVybiByO1xufVxuXG4vKipcbiAqIEVuYWJsZSBuYW1lc3BhY2VzIGxpc3RlZCBpbiBgbG9jYWxTdG9yYWdlLmRlYnVnYCBpbml0aWFsbHkuXG4gKi9cblxuZXhwb3J0cy5lbmFibGUobG9hZCgpKTtcblxuLyoqXG4gKiBMb2NhbHN0b3JhZ2UgYXR0ZW1wdHMgdG8gcmV0dXJuIHRoZSBsb2NhbHN0b3JhZ2UuXG4gKlxuICogVGhpcyBpcyBuZWNlc3NhcnkgYmVjYXVzZSBzYWZhcmkgdGhyb3dzXG4gKiB3aGVuIGEgdXNlciBkaXNhYmxlcyBjb29raWVzL2xvY2Fsc3RvcmFnZVxuICogYW5kIHlvdSBhdHRlbXB0IHRvIGFjY2VzcyBpdC5cbiAqXG4gKiBAcmV0dXJuIHtMb2NhbFN0b3JhZ2V9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBsb2NhbHN0b3JhZ2UoKXtcbiAgdHJ5IHtcbiAgICByZXR1cm4gd2luZG93LmxvY2FsU3RvcmFnZTtcbiAgfSBjYXRjaCAoZSkge31cbn1cbiIsIlxuLyoqXG4gKiBUaGlzIGlzIHRoZSBjb21tb24gbG9naWMgZm9yIGJvdGggdGhlIE5vZGUuanMgYW5kIHdlYiBicm93c2VyXG4gKiBpbXBsZW1lbnRhdGlvbnMgb2YgYGRlYnVnKClgLlxuICpcbiAqIEV4cG9zZSBgZGVidWcoKWAgYXMgdGhlIG1vZHVsZS5cbiAqL1xuXG5leHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSBkZWJ1ZztcbmV4cG9ydHMuY29lcmNlID0gY29lcmNlO1xuZXhwb3J0cy5kaXNhYmxlID0gZGlzYWJsZTtcbmV4cG9ydHMuZW5hYmxlID0gZW5hYmxlO1xuZXhwb3J0cy5lbmFibGVkID0gZW5hYmxlZDtcbmV4cG9ydHMuaHVtYW5pemUgPSByZXF1aXJlKCdtcycpO1xuXG4vKipcbiAqIFRoZSBjdXJyZW50bHkgYWN0aXZlIGRlYnVnIG1vZGUgbmFtZXMsIGFuZCBuYW1lcyB0byBza2lwLlxuICovXG5cbmV4cG9ydHMubmFtZXMgPSBbXTtcbmV4cG9ydHMuc2tpcHMgPSBbXTtcblxuLyoqXG4gKiBNYXAgb2Ygc3BlY2lhbCBcIiVuXCIgaGFuZGxpbmcgZnVuY3Rpb25zLCBmb3IgdGhlIGRlYnVnIFwiZm9ybWF0XCIgYXJndW1lbnQuXG4gKlxuICogVmFsaWQga2V5IG5hbWVzIGFyZSBhIHNpbmdsZSwgbG93ZXJjYXNlZCBsZXR0ZXIsIGkuZS4gXCJuXCIuXG4gKi9cblxuZXhwb3J0cy5mb3JtYXR0ZXJzID0ge307XG5cbi8qKlxuICogUHJldmlvdXNseSBhc3NpZ25lZCBjb2xvci5cbiAqL1xuXG52YXIgcHJldkNvbG9yID0gMDtcblxuLyoqXG4gKiBQcmV2aW91cyBsb2cgdGltZXN0YW1wLlxuICovXG5cbnZhciBwcmV2VGltZTtcblxuLyoqXG4gKiBTZWxlY3QgYSBjb2xvci5cbiAqXG4gKiBAcmV0dXJuIHtOdW1iZXJ9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBzZWxlY3RDb2xvcigpIHtcbiAgcmV0dXJuIGV4cG9ydHMuY29sb3JzW3ByZXZDb2xvcisrICUgZXhwb3J0cy5jb2xvcnMubGVuZ3RoXTtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBkZWJ1Z2dlciB3aXRoIHRoZSBnaXZlbiBgbmFtZXNwYWNlYC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlXG4gKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZGVidWcobmFtZXNwYWNlKSB7XG5cbiAgLy8gZGVmaW5lIHRoZSBgZGlzYWJsZWRgIHZlcnNpb25cbiAgZnVuY3Rpb24gZGlzYWJsZWQoKSB7XG4gIH1cbiAgZGlzYWJsZWQuZW5hYmxlZCA9IGZhbHNlO1xuXG4gIC8vIGRlZmluZSB0aGUgYGVuYWJsZWRgIHZlcnNpb25cbiAgZnVuY3Rpb24gZW5hYmxlZCgpIHtcblxuICAgIHZhciBzZWxmID0gZW5hYmxlZDtcblxuICAgIC8vIHNldCBgZGlmZmAgdGltZXN0YW1wXG4gICAgdmFyIGN1cnIgPSArbmV3IERhdGUoKTtcbiAgICB2YXIgbXMgPSBjdXJyIC0gKHByZXZUaW1lIHx8IGN1cnIpO1xuICAgIHNlbGYuZGlmZiA9IG1zO1xuICAgIHNlbGYucHJldiA9IHByZXZUaW1lO1xuICAgIHNlbGYuY3VyciA9IGN1cnI7XG4gICAgcHJldlRpbWUgPSBjdXJyO1xuXG4gICAgLy8gYWRkIHRoZSBgY29sb3JgIGlmIG5vdCBzZXRcbiAgICBpZiAobnVsbCA9PSBzZWxmLnVzZUNvbG9ycykgc2VsZi51c2VDb2xvcnMgPSBleHBvcnRzLnVzZUNvbG9ycygpO1xuICAgIGlmIChudWxsID09IHNlbGYuY29sb3IgJiYgc2VsZi51c2VDb2xvcnMpIHNlbGYuY29sb3IgPSBzZWxlY3RDb2xvcigpO1xuXG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuXG4gICAgYXJnc1swXSA9IGV4cG9ydHMuY29lcmNlKGFyZ3NbMF0pO1xuXG4gICAgaWYgKCdzdHJpbmcnICE9PSB0eXBlb2YgYXJnc1swXSkge1xuICAgICAgLy8gYW55dGhpbmcgZWxzZSBsZXQncyBpbnNwZWN0IHdpdGggJW9cbiAgICAgIGFyZ3MgPSBbJyVvJ10uY29uY2F0KGFyZ3MpO1xuICAgIH1cblxuICAgIC8vIGFwcGx5IGFueSBgZm9ybWF0dGVyc2AgdHJhbnNmb3JtYXRpb25zXG4gICAgdmFyIGluZGV4ID0gMDtcbiAgICBhcmdzWzBdID0gYXJnc1swXS5yZXBsYWNlKC8lKFthLXolXSkvZywgZnVuY3Rpb24obWF0Y2gsIGZvcm1hdCkge1xuICAgICAgLy8gaWYgd2UgZW5jb3VudGVyIGFuIGVzY2FwZWQgJSB0aGVuIGRvbid0IGluY3JlYXNlIHRoZSBhcnJheSBpbmRleFxuICAgICAgaWYgKG1hdGNoID09PSAnJSUnKSByZXR1cm4gbWF0Y2g7XG4gICAgICBpbmRleCsrO1xuICAgICAgdmFyIGZvcm1hdHRlciA9IGV4cG9ydHMuZm9ybWF0dGVyc1tmb3JtYXRdO1xuICAgICAgaWYgKCdmdW5jdGlvbicgPT09IHR5cGVvZiBmb3JtYXR0ZXIpIHtcbiAgICAgICAgdmFyIHZhbCA9IGFyZ3NbaW5kZXhdO1xuICAgICAgICBtYXRjaCA9IGZvcm1hdHRlci5jYWxsKHNlbGYsIHZhbCk7XG5cbiAgICAgICAgLy8gbm93IHdlIG5lZWQgdG8gcmVtb3ZlIGBhcmdzW2luZGV4XWAgc2luY2UgaXQncyBpbmxpbmVkIGluIHRoZSBgZm9ybWF0YFxuICAgICAgICBhcmdzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIGluZGV4LS07XG4gICAgICB9XG4gICAgICByZXR1cm4gbWF0Y2g7XG4gICAgfSk7XG5cbiAgICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGV4cG9ydHMuZm9ybWF0QXJncykge1xuICAgICAgYXJncyA9IGV4cG9ydHMuZm9ybWF0QXJncy5hcHBseShzZWxmLCBhcmdzKTtcbiAgICB9XG4gICAgdmFyIGxvZ0ZuID0gZW5hYmxlZC5sb2cgfHwgZXhwb3J0cy5sb2cgfHwgY29uc29sZS5sb2cuYmluZChjb25zb2xlKTtcbiAgICBsb2dGbi5hcHBseShzZWxmLCBhcmdzKTtcbiAgfVxuICBlbmFibGVkLmVuYWJsZWQgPSB0cnVlO1xuXG4gIHZhciBmbiA9IGV4cG9ydHMuZW5hYmxlZChuYW1lc3BhY2UpID8gZW5hYmxlZCA6IGRpc2FibGVkO1xuXG4gIGZuLm5hbWVzcGFjZSA9IG5hbWVzcGFjZTtcblxuICByZXR1cm4gZm47XG59XG5cbi8qKlxuICogRW5hYmxlcyBhIGRlYnVnIG1vZGUgYnkgbmFtZXNwYWNlcy4gVGhpcyBjYW4gaW5jbHVkZSBtb2Rlc1xuICogc2VwYXJhdGVkIGJ5IGEgY29sb24gYW5kIHdpbGRjYXJkcy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlc1xuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBlbmFibGUobmFtZXNwYWNlcykge1xuICBleHBvcnRzLnNhdmUobmFtZXNwYWNlcyk7XG5cbiAgdmFyIHNwbGl0ID0gKG5hbWVzcGFjZXMgfHwgJycpLnNwbGl0KC9bXFxzLF0rLyk7XG4gIHZhciBsZW4gPSBzcGxpdC5sZW5ndGg7XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgIGlmICghc3BsaXRbaV0pIGNvbnRpbnVlOyAvLyBpZ25vcmUgZW1wdHkgc3RyaW5nc1xuICAgIG5hbWVzcGFjZXMgPSBzcGxpdFtpXS5yZXBsYWNlKC9cXCovZywgJy4qPycpO1xuICAgIGlmIChuYW1lc3BhY2VzWzBdID09PSAnLScpIHtcbiAgICAgIGV4cG9ydHMuc2tpcHMucHVzaChuZXcgUmVnRXhwKCdeJyArIG5hbWVzcGFjZXMuc3Vic3RyKDEpICsgJyQnKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGV4cG9ydHMubmFtZXMucHVzaChuZXcgUmVnRXhwKCdeJyArIG5hbWVzcGFjZXMgKyAnJCcpKTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBEaXNhYmxlIGRlYnVnIG91dHB1dC5cbiAqXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGRpc2FibGUoKSB7XG4gIGV4cG9ydHMuZW5hYmxlKCcnKTtcbn1cblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgdGhlIGdpdmVuIG1vZGUgbmFtZSBpcyBlbmFibGVkLCBmYWxzZSBvdGhlcndpc2UuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGVuYWJsZWQobmFtZSkge1xuICB2YXIgaSwgbGVuO1xuICBmb3IgKGkgPSAwLCBsZW4gPSBleHBvcnRzLnNraXBzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgaWYgKGV4cG9ydHMuc2tpcHNbaV0udGVzdChuYW1lKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuICBmb3IgKGkgPSAwLCBsZW4gPSBleHBvcnRzLm5hbWVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgaWYgKGV4cG9ydHMubmFtZXNbaV0udGVzdChuYW1lKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuLyoqXG4gKiBDb2VyY2UgYHZhbGAuXG4gKlxuICogQHBhcmFtIHtNaXhlZH0gdmFsXG4gKiBAcmV0dXJuIHtNaXhlZH1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGNvZXJjZSh2YWwpIHtcbiAgaWYgKHZhbCBpbnN0YW5jZW9mIEVycm9yKSByZXR1cm4gdmFsLnN0YWNrIHx8IHZhbC5tZXNzYWdlO1xuICByZXR1cm4gdmFsO1xufVxuIiwiLyoqXG4gKiBIZWxwZXJzLlxuICovXG5cbnZhciBzID0gMTAwMDtcbnZhciBtID0gcyAqIDYwO1xudmFyIGggPSBtICogNjA7XG52YXIgZCA9IGggKiAyNDtcbnZhciB5ID0gZCAqIDM2NS4yNTtcblxuLyoqXG4gKiBQYXJzZSBvciBmb3JtYXQgdGhlIGdpdmVuIGB2YWxgLlxuICpcbiAqIE9wdGlvbnM6XG4gKlxuICogIC0gYGxvbmdgIHZlcmJvc2UgZm9ybWF0dGluZyBbZmFsc2VdXG4gKlxuICogQHBhcmFtIHtTdHJpbmd8TnVtYmVyfSB2YWxcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcmV0dXJuIHtTdHJpbmd8TnVtYmVyfVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHZhbCwgb3B0aW9ucyl7XG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICBpZiAoJ3N0cmluZycgPT0gdHlwZW9mIHZhbCkgcmV0dXJuIHBhcnNlKHZhbCk7XG4gIHJldHVybiBvcHRpb25zLmxvbmdcbiAgICA/IGxvbmcodmFsKVxuICAgIDogc2hvcnQodmFsKTtcbn07XG5cbi8qKlxuICogUGFyc2UgdGhlIGdpdmVuIGBzdHJgIGFuZCByZXR1cm4gbWlsbGlzZWNvbmRzLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHJcbiAqIEByZXR1cm4ge051bWJlcn1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHBhcnNlKHN0cikge1xuICBzdHIgPSAnJyArIHN0cjtcbiAgaWYgKHN0ci5sZW5ndGggPiAxMDAwMCkgcmV0dXJuO1xuICB2YXIgbWF0Y2ggPSAvXigoPzpcXGQrKT9cXC4/XFxkKykgKihtaWxsaXNlY29uZHM/fG1zZWNzP3xtc3xzZWNvbmRzP3xzZWNzP3xzfG1pbnV0ZXM/fG1pbnM/fG18aG91cnM/fGhycz98aHxkYXlzP3xkfHllYXJzP3x5cnM/fHkpPyQvaS5leGVjKHN0cik7XG4gIGlmICghbWF0Y2gpIHJldHVybjtcbiAgdmFyIG4gPSBwYXJzZUZsb2F0KG1hdGNoWzFdKTtcbiAgdmFyIHR5cGUgPSAobWF0Y2hbMl0gfHwgJ21zJykudG9Mb3dlckNhc2UoKTtcbiAgc3dpdGNoICh0eXBlKSB7XG4gICAgY2FzZSAneWVhcnMnOlxuICAgIGNhc2UgJ3llYXInOlxuICAgIGNhc2UgJ3lycyc6XG4gICAgY2FzZSAneXInOlxuICAgIGNhc2UgJ3knOlxuICAgICAgcmV0dXJuIG4gKiB5O1xuICAgIGNhc2UgJ2RheXMnOlxuICAgIGNhc2UgJ2RheSc6XG4gICAgY2FzZSAnZCc6XG4gICAgICByZXR1cm4gbiAqIGQ7XG4gICAgY2FzZSAnaG91cnMnOlxuICAgIGNhc2UgJ2hvdXInOlxuICAgIGNhc2UgJ2hycyc6XG4gICAgY2FzZSAnaHInOlxuICAgIGNhc2UgJ2gnOlxuICAgICAgcmV0dXJuIG4gKiBoO1xuICAgIGNhc2UgJ21pbnV0ZXMnOlxuICAgIGNhc2UgJ21pbnV0ZSc6XG4gICAgY2FzZSAnbWlucyc6XG4gICAgY2FzZSAnbWluJzpcbiAgICBjYXNlICdtJzpcbiAgICAgIHJldHVybiBuICogbTtcbiAgICBjYXNlICdzZWNvbmRzJzpcbiAgICBjYXNlICdzZWNvbmQnOlxuICAgIGNhc2UgJ3NlY3MnOlxuICAgIGNhc2UgJ3NlYyc6XG4gICAgY2FzZSAncyc6XG4gICAgICByZXR1cm4gbiAqIHM7XG4gICAgY2FzZSAnbWlsbGlzZWNvbmRzJzpcbiAgICBjYXNlICdtaWxsaXNlY29uZCc6XG4gICAgY2FzZSAnbXNlY3MnOlxuICAgIGNhc2UgJ21zZWMnOlxuICAgIGNhc2UgJ21zJzpcbiAgICAgIHJldHVybiBuO1xuICB9XG59XG5cbi8qKlxuICogU2hvcnQgZm9ybWF0IGZvciBgbXNgLlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBtc1xuICogQHJldHVybiB7U3RyaW5nfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gc2hvcnQobXMpIHtcbiAgaWYgKG1zID49IGQpIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gZCkgKyAnZCc7XG4gIGlmIChtcyA+PSBoKSByZXR1cm4gTWF0aC5yb3VuZChtcyAvIGgpICsgJ2gnO1xuICBpZiAobXMgPj0gbSkgcmV0dXJuIE1hdGgucm91bmQobXMgLyBtKSArICdtJztcbiAgaWYgKG1zID49IHMpIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gcykgKyAncyc7XG4gIHJldHVybiBtcyArICdtcyc7XG59XG5cbi8qKlxuICogTG9uZyBmb3JtYXQgZm9yIGBtc2AuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IG1zXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBsb25nKG1zKSB7XG4gIHJldHVybiBwbHVyYWwobXMsIGQsICdkYXknKVxuICAgIHx8IHBsdXJhbChtcywgaCwgJ2hvdXInKVxuICAgIHx8IHBsdXJhbChtcywgbSwgJ21pbnV0ZScpXG4gICAgfHwgcGx1cmFsKG1zLCBzLCAnc2Vjb25kJylcbiAgICB8fCBtcyArICcgbXMnO1xufVxuXG4vKipcbiAqIFBsdXJhbGl6YXRpb24gaGVscGVyLlxuICovXG5cbmZ1bmN0aW9uIHBsdXJhbChtcywgbiwgbmFtZSkge1xuICBpZiAobXMgPCBuKSByZXR1cm47XG4gIGlmIChtcyA8IG4gKiAxLjUpIHJldHVybiBNYXRoLmZsb29yKG1zIC8gbikgKyAnICcgKyBuYW1lO1xuICByZXR1cm4gTWF0aC5jZWlsKG1zIC8gbikgKyAnICcgKyBuYW1lICsgJ3MnO1xufVxuIiwiLyoqXG4gKiBsb2Rhc2ggMy4yLjAgKEN1c3RvbSBCdWlsZCkgPGh0dHBzOi8vbG9kYXNoLmNvbS8+XG4gKiBCdWlsZDogYGxvZGFzaCBtb2Rlcm4gbW9kdWxhcml6ZSBleHBvcnRzPVwibnBtXCIgLW8gLi9gXG4gKiBDb3B5cmlnaHQgMjAxMi0yMDE1IFRoZSBEb2pvIEZvdW5kYXRpb24gPGh0dHA6Ly9kb2pvZm91bmRhdGlvbi5vcmcvPlxuICogQmFzZWQgb24gVW5kZXJzY29yZS5qcyAxLjguMyA8aHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvTElDRU5TRT5cbiAqIENvcHlyaWdodCAyMDA5LTIwMTUgSmVyZW15IEFzaGtlbmFzLCBEb2N1bWVudENsb3VkIGFuZCBJbnZlc3RpZ2F0aXZlIFJlcG9ydGVycyAmIEVkaXRvcnNcbiAqIEF2YWlsYWJsZSB1bmRlciBNSVQgbGljZW5zZSA8aHR0cHM6Ly9sb2Rhc2guY29tL2xpY2Vuc2U+XG4gKi9cbnZhciBiYXNlQXNzaWduID0gcmVxdWlyZSgnbG9kYXNoLl9iYXNlYXNzaWduJyksXG4gICAgY3JlYXRlQXNzaWduZXIgPSByZXF1aXJlKCdsb2Rhc2guX2NyZWF0ZWFzc2lnbmVyJyksXG4gICAga2V5cyA9IHJlcXVpcmUoJ2xvZGFzaC5rZXlzJyk7XG5cbi8qKlxuICogQSBzcGVjaWFsaXplZCB2ZXJzaW9uIG9mIGBfLmFzc2lnbmAgZm9yIGN1c3RvbWl6aW5nIGFzc2lnbmVkIHZhbHVlcyB3aXRob3V0XG4gKiBzdXBwb3J0IGZvciBhcmd1bWVudCBqdWdnbGluZywgbXVsdGlwbGUgc291cmNlcywgYW5kIGB0aGlzYCBiaW5kaW5nIGBjdXN0b21pemVyYFxuICogZnVuY3Rpb25zLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBkZXN0aW5hdGlvbiBvYmplY3QuXG4gKiBAcGFyYW0ge09iamVjdH0gc291cmNlIFRoZSBzb3VyY2Ugb2JqZWN0LlxuICogQHBhcmFtIHtGdW5jdGlvbn0gY3VzdG9taXplciBUaGUgZnVuY3Rpb24gdG8gY3VzdG9taXplIGFzc2lnbmVkIHZhbHVlcy5cbiAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgYG9iamVjdGAuXG4gKi9cbmZ1bmN0aW9uIGFzc2lnbldpdGgob2JqZWN0LCBzb3VyY2UsIGN1c3RvbWl6ZXIpIHtcbiAgdmFyIGluZGV4ID0gLTEsXG4gICAgICBwcm9wcyA9IGtleXMoc291cmNlKSxcbiAgICAgIGxlbmd0aCA9IHByb3BzLmxlbmd0aDtcblxuICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgIHZhciBrZXkgPSBwcm9wc1tpbmRleF0sXG4gICAgICAgIHZhbHVlID0gb2JqZWN0W2tleV0sXG4gICAgICAgIHJlc3VsdCA9IGN1c3RvbWl6ZXIodmFsdWUsIHNvdXJjZVtrZXldLCBrZXksIG9iamVjdCwgc291cmNlKTtcblxuICAgIGlmICgocmVzdWx0ID09PSByZXN1bHQgPyAocmVzdWx0ICE9PSB2YWx1ZSkgOiAodmFsdWUgPT09IHZhbHVlKSkgfHxcbiAgICAgICAgKHZhbHVlID09PSB1bmRlZmluZWQgJiYgIShrZXkgaW4gb2JqZWN0KSkpIHtcbiAgICAgIG9iamVjdFtrZXldID0gcmVzdWx0O1xuICAgIH1cbiAgfVxuICByZXR1cm4gb2JqZWN0O1xufVxuXG4vKipcbiAqIEFzc2lnbnMgb3duIGVudW1lcmFibGUgcHJvcGVydGllcyBvZiBzb3VyY2Ugb2JqZWN0KHMpIHRvIHRoZSBkZXN0aW5hdGlvblxuICogb2JqZWN0LiBTdWJzZXF1ZW50IHNvdXJjZXMgb3ZlcndyaXRlIHByb3BlcnR5IGFzc2lnbm1lbnRzIG9mIHByZXZpb3VzIHNvdXJjZXMuXG4gKiBJZiBgY3VzdG9taXplcmAgaXMgcHJvdmlkZWQgaXQgaXMgaW52b2tlZCB0byBwcm9kdWNlIHRoZSBhc3NpZ25lZCB2YWx1ZXMuXG4gKiBUaGUgYGN1c3RvbWl6ZXJgIGlzIGJvdW5kIHRvIGB0aGlzQXJnYCBhbmQgaW52b2tlZCB3aXRoIGZpdmUgYXJndW1lbnRzOlxuICogKG9iamVjdFZhbHVlLCBzb3VyY2VWYWx1ZSwga2V5LCBvYmplY3QsIHNvdXJjZSkuXG4gKlxuICogKipOb3RlOioqIFRoaXMgbWV0aG9kIG11dGF0ZXMgYG9iamVjdGAgYW5kIGlzIGJhc2VkIG9uXG4gKiBbYE9iamVjdC5hc3NpZ25gXShodHRwczovL3Blb3BsZS5tb3ppbGxhLm9yZy9+am9yZW5kb3JmZi9lczYtZHJhZnQuaHRtbCNzZWMtb2JqZWN0LmFzc2lnbikuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBhbGlhcyBleHRlbmRcbiAqIEBjYXRlZ29yeSBPYmplY3RcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIGRlc3RpbmF0aW9uIG9iamVjdC5cbiAqIEBwYXJhbSB7Li4uT2JqZWN0fSBbc291cmNlc10gVGhlIHNvdXJjZSBvYmplY3RzLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gW2N1c3RvbWl6ZXJdIFRoZSBmdW5jdGlvbiB0byBjdXN0b21pemUgYXNzaWduZWQgdmFsdWVzLlxuICogQHBhcmFtIHsqfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjdXN0b21pemVyYC5cbiAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgYG9iamVjdGAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uYXNzaWduKHsgJ3VzZXInOiAnYmFybmV5JyB9LCB7ICdhZ2UnOiA0MCB9LCB7ICd1c2VyJzogJ2ZyZWQnIH0pO1xuICogLy8gPT4geyAndXNlcic6ICdmcmVkJywgJ2FnZSc6IDQwIH1cbiAqXG4gKiAvLyB1c2luZyBhIGN1c3RvbWl6ZXIgY2FsbGJhY2tcbiAqIHZhciBkZWZhdWx0cyA9IF8ucGFydGlhbFJpZ2h0KF8uYXNzaWduLCBmdW5jdGlvbih2YWx1ZSwgb3RoZXIpIHtcbiAqICAgcmV0dXJuIF8uaXNVbmRlZmluZWQodmFsdWUpID8gb3RoZXIgOiB2YWx1ZTtcbiAqIH0pO1xuICpcbiAqIGRlZmF1bHRzKHsgJ3VzZXInOiAnYmFybmV5JyB9LCB7ICdhZ2UnOiAzNiB9LCB7ICd1c2VyJzogJ2ZyZWQnIH0pO1xuICogLy8gPT4geyAndXNlcic6ICdiYXJuZXknLCAnYWdlJzogMzYgfVxuICovXG52YXIgYXNzaWduID0gY3JlYXRlQXNzaWduZXIoZnVuY3Rpb24ob2JqZWN0LCBzb3VyY2UsIGN1c3RvbWl6ZXIpIHtcbiAgcmV0dXJuIGN1c3RvbWl6ZXJcbiAgICA/IGFzc2lnbldpdGgob2JqZWN0LCBzb3VyY2UsIGN1c3RvbWl6ZXIpXG4gICAgOiBiYXNlQXNzaWduKG9iamVjdCwgc291cmNlKTtcbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGFzc2lnbjtcbiIsIi8qKlxuICogbG9kYXNoIDMuMi4wIChDdXN0b20gQnVpbGQpIDxodHRwczovL2xvZGFzaC5jb20vPlxuICogQnVpbGQ6IGBsb2Rhc2ggbW9kZXJuIG1vZHVsYXJpemUgZXhwb3J0cz1cIm5wbVwiIC1vIC4vYFxuICogQ29weXJpZ2h0IDIwMTItMjAxNSBUaGUgRG9qbyBGb3VuZGF0aW9uIDxodHRwOi8vZG9qb2ZvdW5kYXRpb24ub3JnLz5cbiAqIEJhc2VkIG9uIFVuZGVyc2NvcmUuanMgMS44LjMgPGh0dHA6Ly91bmRlcnNjb3JlanMub3JnL0xJQ0VOU0U+XG4gKiBDb3B5cmlnaHQgMjAwOS0yMDE1IEplcmVteSBBc2hrZW5hcywgRG9jdW1lbnRDbG91ZCBhbmQgSW52ZXN0aWdhdGl2ZSBSZXBvcnRlcnMgJiBFZGl0b3JzXG4gKiBBdmFpbGFibGUgdW5kZXIgTUlUIGxpY2Vuc2UgPGh0dHBzOi8vbG9kYXNoLmNvbS9saWNlbnNlPlxuICovXG52YXIgYmFzZUNvcHkgPSByZXF1aXJlKCdsb2Rhc2guX2Jhc2Vjb3B5JyksXG4gICAga2V5cyA9IHJlcXVpcmUoJ2xvZGFzaC5rZXlzJyk7XG5cbi8qKlxuICogVGhlIGJhc2UgaW1wbGVtZW50YXRpb24gb2YgYF8uYXNzaWduYCB3aXRob3V0IHN1cHBvcnQgZm9yIGFyZ3VtZW50IGp1Z2dsaW5nLFxuICogbXVsdGlwbGUgc291cmNlcywgYW5kIGBjdXN0b21pemVyYCBmdW5jdGlvbnMuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIGRlc3RpbmF0aW9uIG9iamVjdC5cbiAqIEBwYXJhbSB7T2JqZWN0fSBzb3VyY2UgVGhlIHNvdXJjZSBvYmplY3QuXG4gKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIGBvYmplY3RgLlxuICovXG5mdW5jdGlvbiBiYXNlQXNzaWduKG9iamVjdCwgc291cmNlKSB7XG4gIHJldHVybiBzb3VyY2UgPT0gbnVsbFxuICAgID8gb2JqZWN0XG4gICAgOiBiYXNlQ29weShzb3VyY2UsIGtleXMoc291cmNlKSwgb2JqZWN0KTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBiYXNlQXNzaWduO1xuIiwiLyoqXG4gKiBsb2Rhc2ggMy4wLjEgKEN1c3RvbSBCdWlsZCkgPGh0dHBzOi8vbG9kYXNoLmNvbS8+XG4gKiBCdWlsZDogYGxvZGFzaCBtb2Rlcm4gbW9kdWxhcml6ZSBleHBvcnRzPVwibnBtXCIgLW8gLi9gXG4gKiBDb3B5cmlnaHQgMjAxMi0yMDE1IFRoZSBEb2pvIEZvdW5kYXRpb24gPGh0dHA6Ly9kb2pvZm91bmRhdGlvbi5vcmcvPlxuICogQmFzZWQgb24gVW5kZXJzY29yZS5qcyAxLjguMyA8aHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvTElDRU5TRT5cbiAqIENvcHlyaWdodCAyMDA5LTIwMTUgSmVyZW15IEFzaGtlbmFzLCBEb2N1bWVudENsb3VkIGFuZCBJbnZlc3RpZ2F0aXZlIFJlcG9ydGVycyAmIEVkaXRvcnNcbiAqIEF2YWlsYWJsZSB1bmRlciBNSVQgbGljZW5zZSA8aHR0cHM6Ly9sb2Rhc2guY29tL2xpY2Vuc2U+XG4gKi9cblxuLyoqXG4gKiBDb3BpZXMgcHJvcGVydGllcyBvZiBgc291cmNlYCB0byBgb2JqZWN0YC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtPYmplY3R9IHNvdXJjZSBUaGUgb2JqZWN0IHRvIGNvcHkgcHJvcGVydGllcyBmcm9tLlxuICogQHBhcmFtIHtBcnJheX0gcHJvcHMgVGhlIHByb3BlcnR5IG5hbWVzIHRvIGNvcHkuXG4gKiBAcGFyYW0ge09iamVjdH0gW29iamVjdD17fV0gVGhlIG9iamVjdCB0byBjb3B5IHByb3BlcnRpZXMgdG8uXG4gKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIGBvYmplY3RgLlxuICovXG5mdW5jdGlvbiBiYXNlQ29weShzb3VyY2UsIHByb3BzLCBvYmplY3QpIHtcbiAgb2JqZWN0IHx8IChvYmplY3QgPSB7fSk7XG5cbiAgdmFyIGluZGV4ID0gLTEsXG4gICAgICBsZW5ndGggPSBwcm9wcy5sZW5ndGg7XG5cbiAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICB2YXIga2V5ID0gcHJvcHNbaW5kZXhdO1xuICAgIG9iamVjdFtrZXldID0gc291cmNlW2tleV07XG4gIH1cbiAgcmV0dXJuIG9iamVjdDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBiYXNlQ29weTtcbiIsIi8qKlxuICogbG9kYXNoIDMuMS4xIChDdXN0b20gQnVpbGQpIDxodHRwczovL2xvZGFzaC5jb20vPlxuICogQnVpbGQ6IGBsb2Rhc2ggbW9kZXJuIG1vZHVsYXJpemUgZXhwb3J0cz1cIm5wbVwiIC1vIC4vYFxuICogQ29weXJpZ2h0IDIwMTItMjAxNSBUaGUgRG9qbyBGb3VuZGF0aW9uIDxodHRwOi8vZG9qb2ZvdW5kYXRpb24ub3JnLz5cbiAqIEJhc2VkIG9uIFVuZGVyc2NvcmUuanMgMS44LjMgPGh0dHA6Ly91bmRlcnNjb3JlanMub3JnL0xJQ0VOU0U+XG4gKiBDb3B5cmlnaHQgMjAwOS0yMDE1IEplcmVteSBBc2hrZW5hcywgRG9jdW1lbnRDbG91ZCBhbmQgSW52ZXN0aWdhdGl2ZSBSZXBvcnRlcnMgJiBFZGl0b3JzXG4gKiBBdmFpbGFibGUgdW5kZXIgTUlUIGxpY2Vuc2UgPGh0dHBzOi8vbG9kYXNoLmNvbS9saWNlbnNlPlxuICovXG52YXIgYmluZENhbGxiYWNrID0gcmVxdWlyZSgnbG9kYXNoLl9iaW5kY2FsbGJhY2snKSxcbiAgICBpc0l0ZXJhdGVlQ2FsbCA9IHJlcXVpcmUoJ2xvZGFzaC5faXNpdGVyYXRlZWNhbGwnKSxcbiAgICByZXN0UGFyYW0gPSByZXF1aXJlKCdsb2Rhc2gucmVzdHBhcmFtJyk7XG5cbi8qKlxuICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQgYXNzaWducyBwcm9wZXJ0aWVzIG9mIHNvdXJjZSBvYmplY3QocykgdG8gYSBnaXZlblxuICogZGVzdGluYXRpb24gb2JqZWN0LlxuICpcbiAqICoqTm90ZToqKiBUaGlzIGZ1bmN0aW9uIGlzIHVzZWQgdG8gY3JlYXRlIGBfLmFzc2lnbmAsIGBfLmRlZmF1bHRzYCwgYW5kIGBfLm1lcmdlYC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gYXNzaWduZXIgVGhlIGZ1bmN0aW9uIHRvIGFzc2lnbiB2YWx1ZXMuXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyBhc3NpZ25lciBmdW5jdGlvbi5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlQXNzaWduZXIoYXNzaWduZXIpIHtcbiAgcmV0dXJuIHJlc3RQYXJhbShmdW5jdGlvbihvYmplY3QsIHNvdXJjZXMpIHtcbiAgICB2YXIgaW5kZXggPSAtMSxcbiAgICAgICAgbGVuZ3RoID0gb2JqZWN0ID09IG51bGwgPyAwIDogc291cmNlcy5sZW5ndGgsXG4gICAgICAgIGN1c3RvbWl6ZXIgPSBsZW5ndGggPiAyID8gc291cmNlc1tsZW5ndGggLSAyXSA6IHVuZGVmaW5lZCxcbiAgICAgICAgZ3VhcmQgPSBsZW5ndGggPiAyID8gc291cmNlc1syXSA6IHVuZGVmaW5lZCxcbiAgICAgICAgdGhpc0FyZyA9IGxlbmd0aCA+IDEgPyBzb3VyY2VzW2xlbmd0aCAtIDFdIDogdW5kZWZpbmVkO1xuXG4gICAgaWYgKHR5cGVvZiBjdXN0b21pemVyID09ICdmdW5jdGlvbicpIHtcbiAgICAgIGN1c3RvbWl6ZXIgPSBiaW5kQ2FsbGJhY2soY3VzdG9taXplciwgdGhpc0FyZywgNSk7XG4gICAgICBsZW5ndGggLT0gMjtcbiAgICB9IGVsc2Uge1xuICAgICAgY3VzdG9taXplciA9IHR5cGVvZiB0aGlzQXJnID09ICdmdW5jdGlvbicgPyB0aGlzQXJnIDogdW5kZWZpbmVkO1xuICAgICAgbGVuZ3RoIC09IChjdXN0b21pemVyID8gMSA6IDApO1xuICAgIH1cbiAgICBpZiAoZ3VhcmQgJiYgaXNJdGVyYXRlZUNhbGwoc291cmNlc1swXSwgc291cmNlc1sxXSwgZ3VhcmQpKSB7XG4gICAgICBjdXN0b21pemVyID0gbGVuZ3RoIDwgMyA/IHVuZGVmaW5lZCA6IGN1c3RvbWl6ZXI7XG4gICAgICBsZW5ndGggPSAxO1xuICAgIH1cbiAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgdmFyIHNvdXJjZSA9IHNvdXJjZXNbaW5kZXhdO1xuICAgICAgaWYgKHNvdXJjZSkge1xuICAgICAgICBhc3NpZ25lcihvYmplY3QsIHNvdXJjZSwgY3VzdG9taXplcik7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBvYmplY3Q7XG4gIH0pO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZUFzc2lnbmVyO1xuIiwiLyoqXG4gKiBsb2Rhc2ggMy4wLjEgKEN1c3RvbSBCdWlsZCkgPGh0dHBzOi8vbG9kYXNoLmNvbS8+XG4gKiBCdWlsZDogYGxvZGFzaCBtb2Rlcm4gbW9kdWxhcml6ZSBleHBvcnRzPVwibnBtXCIgLW8gLi9gXG4gKiBDb3B5cmlnaHQgMjAxMi0yMDE1IFRoZSBEb2pvIEZvdW5kYXRpb24gPGh0dHA6Ly9kb2pvZm91bmRhdGlvbi5vcmcvPlxuICogQmFzZWQgb24gVW5kZXJzY29yZS5qcyAxLjguMyA8aHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvTElDRU5TRT5cbiAqIENvcHlyaWdodCAyMDA5LTIwMTUgSmVyZW15IEFzaGtlbmFzLCBEb2N1bWVudENsb3VkIGFuZCBJbnZlc3RpZ2F0aXZlIFJlcG9ydGVycyAmIEVkaXRvcnNcbiAqIEF2YWlsYWJsZSB1bmRlciBNSVQgbGljZW5zZSA8aHR0cHM6Ly9sb2Rhc2guY29tL2xpY2Vuc2U+XG4gKi9cblxuLyoqXG4gKiBBIHNwZWNpYWxpemVkIHZlcnNpb24gb2YgYGJhc2VDYWxsYmFja2Agd2hpY2ggb25seSBzdXBwb3J0cyBgdGhpc2AgYmluZGluZ1xuICogYW5kIHNwZWNpZnlpbmcgdGhlIG51bWJlciBvZiBhcmd1bWVudHMgdG8gcHJvdmlkZSB0byBgZnVuY2AuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIGJpbmQuXG4gKiBAcGFyYW0geyp9IHRoaXNBcmcgVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBmdW5jYC5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbYXJnQ291bnRdIFRoZSBudW1iZXIgb2YgYXJndW1lbnRzIHRvIHByb3ZpZGUgdG8gYGZ1bmNgLlxuICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBjYWxsYmFjay5cbiAqL1xuZnVuY3Rpb24gYmluZENhbGxiYWNrKGZ1bmMsIHRoaXNBcmcsIGFyZ0NvdW50KSB7XG4gIGlmICh0eXBlb2YgZnVuYyAhPSAnZnVuY3Rpb24nKSB7XG4gICAgcmV0dXJuIGlkZW50aXR5O1xuICB9XG4gIGlmICh0aGlzQXJnID09PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gZnVuYztcbiAgfVxuICBzd2l0Y2ggKGFyZ0NvdW50KSB7XG4gICAgY2FzZSAxOiByZXR1cm4gZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgIHJldHVybiBmdW5jLmNhbGwodGhpc0FyZywgdmFsdWUpO1xuICAgIH07XG4gICAgY2FzZSAzOiByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKSB7XG4gICAgICByZXR1cm4gZnVuYy5jYWxsKHRoaXNBcmcsIHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbik7XG4gICAgfTtcbiAgICBjYXNlIDQ6IHJldHVybiBmdW5jdGlvbihhY2N1bXVsYXRvciwgdmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKSB7XG4gICAgICByZXR1cm4gZnVuYy5jYWxsKHRoaXNBcmcsIGFjY3VtdWxhdG9yLCB2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pO1xuICAgIH07XG4gICAgY2FzZSA1OiByZXR1cm4gZnVuY3Rpb24odmFsdWUsIG90aGVyLCBrZXksIG9iamVjdCwgc291cmNlKSB7XG4gICAgICByZXR1cm4gZnVuYy5jYWxsKHRoaXNBcmcsIHZhbHVlLCBvdGhlciwga2V5LCBvYmplY3QsIHNvdXJjZSk7XG4gICAgfTtcbiAgfVxuICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIGZ1bmMuYXBwbHkodGhpc0FyZywgYXJndW1lbnRzKTtcbiAgfTtcbn1cblxuLyoqXG4gKiBUaGlzIG1ldGhvZCByZXR1cm5zIHRoZSBmaXJzdCBhcmd1bWVudCBwcm92aWRlZCB0byBpdC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IFV0aWxpdHlcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgQW55IHZhbHVlLlxuICogQHJldHVybnMgeyp9IFJldHVybnMgYHZhbHVlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogdmFyIG9iamVjdCA9IHsgJ3VzZXInOiAnZnJlZCcgfTtcbiAqXG4gKiBfLmlkZW50aXR5KG9iamVjdCkgPT09IG9iamVjdDtcbiAqIC8vID0+IHRydWVcbiAqL1xuZnVuY3Rpb24gaWRlbnRpdHkodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGJpbmRDYWxsYmFjaztcbiIsIi8qKlxuICogbG9kYXNoIDMuMC45IChDdXN0b20gQnVpbGQpIDxodHRwczovL2xvZGFzaC5jb20vPlxuICogQnVpbGQ6IGBsb2Rhc2ggbW9kZXJuIG1vZHVsYXJpemUgZXhwb3J0cz1cIm5wbVwiIC1vIC4vYFxuICogQ29weXJpZ2h0IDIwMTItMjAxNSBUaGUgRG9qbyBGb3VuZGF0aW9uIDxodHRwOi8vZG9qb2ZvdW5kYXRpb24ub3JnLz5cbiAqIEJhc2VkIG9uIFVuZGVyc2NvcmUuanMgMS44LjMgPGh0dHA6Ly91bmRlcnNjb3JlanMub3JnL0xJQ0VOU0U+XG4gKiBDb3B5cmlnaHQgMjAwOS0yMDE1IEplcmVteSBBc2hrZW5hcywgRG9jdW1lbnRDbG91ZCBhbmQgSW52ZXN0aWdhdGl2ZSBSZXBvcnRlcnMgJiBFZGl0b3JzXG4gKiBBdmFpbGFibGUgdW5kZXIgTUlUIGxpY2Vuc2UgPGh0dHBzOi8vbG9kYXNoLmNvbS9saWNlbnNlPlxuICovXG5cbi8qKiBVc2VkIHRvIGRldGVjdCB1bnNpZ25lZCBpbnRlZ2VyIHZhbHVlcy4gKi9cbnZhciByZUlzVWludCA9IC9eXFxkKyQvO1xuXG4vKipcbiAqIFVzZWQgYXMgdGhlIFttYXhpbXVtIGxlbmd0aF0oaHR0cHM6Ly9wZW9wbGUubW96aWxsYS5vcmcvfmpvcmVuZG9yZmYvZXM2LWRyYWZ0Lmh0bWwjc2VjLW51bWJlci5tYXhfc2FmZV9pbnRlZ2VyKVxuICogb2YgYW4gYXJyYXktbGlrZSB2YWx1ZS5cbiAqL1xudmFyIE1BWF9TQUZFX0lOVEVHRVIgPSA5MDA3MTk5MjU0NzQwOTkxO1xuXG4vKipcbiAqIFRoZSBiYXNlIGltcGxlbWVudGF0aW9uIG9mIGBfLnByb3BlcnR5YCB3aXRob3V0IHN1cHBvcnQgZm9yIGRlZXAgcGF0aHMuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgVGhlIGtleSBvZiB0aGUgcHJvcGVydHkgdG8gZ2V0LlxuICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgZnVuY3Rpb24uXG4gKi9cbmZ1bmN0aW9uIGJhc2VQcm9wZXJ0eShrZXkpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKG9iamVjdCkge1xuICAgIHJldHVybiBvYmplY3QgPT0gbnVsbCA/IHVuZGVmaW5lZCA6IG9iamVjdFtrZXldO1xuICB9O1xufVxuXG4vKipcbiAqIEdldHMgdGhlIFwibGVuZ3RoXCIgcHJvcGVydHkgdmFsdWUgb2YgYG9iamVjdGAuXG4gKlxuICogKipOb3RlOioqIFRoaXMgZnVuY3Rpb24gaXMgdXNlZCB0byBhdm9pZCBhIFtKSVQgYnVnXShodHRwczovL2J1Z3Mud2Via2l0Lm9yZy9zaG93X2J1Zy5jZ2k/aWQ9MTQyNzkyKVxuICogdGhhdCBhZmZlY3RzIFNhZmFyaSBvbiBhdCBsZWFzdCBpT1MgOC4xLTguMyBBUk02NC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIHF1ZXJ5LlxuICogQHJldHVybnMgeyp9IFJldHVybnMgdGhlIFwibGVuZ3RoXCIgdmFsdWUuXG4gKi9cbnZhciBnZXRMZW5ndGggPSBiYXNlUHJvcGVydHkoJ2xlbmd0aCcpO1xuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGFycmF5LWxpa2UuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYXJyYXktbGlrZSwgZWxzZSBgZmFsc2VgLlxuICovXG5mdW5jdGlvbiBpc0FycmF5TGlrZSh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgIT0gbnVsbCAmJiBpc0xlbmd0aChnZXRMZW5ndGgodmFsdWUpKTtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIHZhbGlkIGFycmF5LWxpa2UgaW5kZXguXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHBhcmFtIHtudW1iZXJ9IFtsZW5ndGg9TUFYX1NBRkVfSU5URUdFUl0gVGhlIHVwcGVyIGJvdW5kcyBvZiBhIHZhbGlkIGluZGV4LlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSB2YWxpZCBpbmRleCwgZWxzZSBgZmFsc2VgLlxuICovXG5mdW5jdGlvbiBpc0luZGV4KHZhbHVlLCBsZW5ndGgpIHtcbiAgdmFsdWUgPSAodHlwZW9mIHZhbHVlID09ICdudW1iZXInIHx8IHJlSXNVaW50LnRlc3QodmFsdWUpKSA/ICt2YWx1ZSA6IC0xO1xuICBsZW5ndGggPSBsZW5ndGggPT0gbnVsbCA/IE1BWF9TQUZFX0lOVEVHRVIgOiBsZW5ndGg7XG4gIHJldHVybiB2YWx1ZSA+IC0xICYmIHZhbHVlICUgMSA9PSAwICYmIHZhbHVlIDwgbGVuZ3RoO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiB0aGUgcHJvdmlkZWQgYXJndW1lbnRzIGFyZSBmcm9tIGFuIGl0ZXJhdGVlIGNhbGwuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHBvdGVudGlhbCBpdGVyYXRlZSB2YWx1ZSBhcmd1bWVudC5cbiAqIEBwYXJhbSB7Kn0gaW5kZXggVGhlIHBvdGVudGlhbCBpdGVyYXRlZSBpbmRleCBvciBrZXkgYXJndW1lbnQuXG4gKiBAcGFyYW0geyp9IG9iamVjdCBUaGUgcG90ZW50aWFsIGl0ZXJhdGVlIG9iamVjdCBhcmd1bWVudC5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgYXJndW1lbnRzIGFyZSBmcm9tIGFuIGl0ZXJhdGVlIGNhbGwsIGVsc2UgYGZhbHNlYC5cbiAqL1xuZnVuY3Rpb24gaXNJdGVyYXRlZUNhbGwodmFsdWUsIGluZGV4LCBvYmplY3QpIHtcbiAgaWYgKCFpc09iamVjdChvYmplY3QpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHZhciB0eXBlID0gdHlwZW9mIGluZGV4O1xuICBpZiAodHlwZSA9PSAnbnVtYmVyJ1xuICAgICAgPyAoaXNBcnJheUxpa2Uob2JqZWN0KSAmJiBpc0luZGV4KGluZGV4LCBvYmplY3QubGVuZ3RoKSlcbiAgICAgIDogKHR5cGUgPT0gJ3N0cmluZycgJiYgaW5kZXggaW4gb2JqZWN0KSkge1xuICAgIHZhciBvdGhlciA9IG9iamVjdFtpbmRleF07XG4gICAgcmV0dXJuIHZhbHVlID09PSB2YWx1ZSA/ICh2YWx1ZSA9PT0gb3RoZXIpIDogKG90aGVyICE9PSBvdGhlcik7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGEgdmFsaWQgYXJyYXktbGlrZSBsZW5ndGguXG4gKlxuICogKipOb3RlOioqIFRoaXMgZnVuY3Rpb24gaXMgYmFzZWQgb24gW2BUb0xlbmd0aGBdKGh0dHBzOi8vcGVvcGxlLm1vemlsbGEub3JnL35qb3JlbmRvcmZmL2VzNi1kcmFmdC5odG1sI3NlYy10b2xlbmd0aCkuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSB2YWxpZCBsZW5ndGgsIGVsc2UgYGZhbHNlYC5cbiAqL1xuZnVuY3Rpb24gaXNMZW5ndGgodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PSAnbnVtYmVyJyAmJiB2YWx1ZSA+IC0xICYmIHZhbHVlICUgMSA9PSAwICYmIHZhbHVlIDw9IE1BWF9TQUZFX0lOVEVHRVI7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgdGhlIFtsYW5ndWFnZSB0eXBlXShodHRwczovL2VzNS5naXRodWIuaW8vI3g4KSBvZiBgT2JqZWN0YC5cbiAqIChlLmcuIGFycmF5cywgZnVuY3Rpb25zLCBvYmplY3RzLCByZWdleGVzLCBgbmV3IE51bWJlcigwKWAsIGFuZCBgbmV3IFN0cmluZygnJylgKVxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhbiBvYmplY3QsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc09iamVjdCh7fSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdChbMSwgMiwgM10pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3QoMSk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc09iamVjdCh2YWx1ZSkge1xuICAvLyBBdm9pZCBhIFY4IEpJVCBidWcgaW4gQ2hyb21lIDE5LTIwLlxuICAvLyBTZWUgaHR0cHM6Ly9jb2RlLmdvb2dsZS5jb20vcC92OC9pc3N1ZXMvZGV0YWlsP2lkPTIyOTEgZm9yIG1vcmUgZGV0YWlscy5cbiAgdmFyIHR5cGUgPSB0eXBlb2YgdmFsdWU7XG4gIHJldHVybiAhIXZhbHVlICYmICh0eXBlID09ICdvYmplY3QnIHx8IHR5cGUgPT0gJ2Z1bmN0aW9uJyk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaXNJdGVyYXRlZUNhbGw7XG4iLCIvKipcbiAqIGxvZGFzaCAzLjYuMSAoQ3VzdG9tIEJ1aWxkKSA8aHR0cHM6Ly9sb2Rhc2guY29tLz5cbiAqIEJ1aWxkOiBgbG9kYXNoIG1vZGVybiBtb2R1bGFyaXplIGV4cG9ydHM9XCJucG1cIiAtbyAuL2BcbiAqIENvcHlyaWdodCAyMDEyLTIwMTUgVGhlIERvam8gRm91bmRhdGlvbiA8aHR0cDovL2Rvam9mb3VuZGF0aW9uLm9yZy8+XG4gKiBCYXNlZCBvbiBVbmRlcnNjb3JlLmpzIDEuOC4zIDxodHRwOi8vdW5kZXJzY29yZWpzLm9yZy9MSUNFTlNFPlxuICogQ29weXJpZ2h0IDIwMDktMjAxNSBKZXJlbXkgQXNoa2VuYXMsIERvY3VtZW50Q2xvdWQgYW5kIEludmVzdGlnYXRpdmUgUmVwb3J0ZXJzICYgRWRpdG9yc1xuICogQXZhaWxhYmxlIHVuZGVyIE1JVCBsaWNlbnNlIDxodHRwczovL2xvZGFzaC5jb20vbGljZW5zZT5cbiAqL1xuXG4vKiogVXNlZCBhcyB0aGUgYFR5cGVFcnJvcmAgbWVzc2FnZSBmb3IgXCJGdW5jdGlvbnNcIiBtZXRob2RzLiAqL1xudmFyIEZVTkNfRVJST1JfVEVYVCA9ICdFeHBlY3RlZCBhIGZ1bmN0aW9uJztcblxuLyogTmF0aXZlIG1ldGhvZCByZWZlcmVuY2VzIGZvciB0aG9zZSB3aXRoIHRoZSBzYW1lIG5hbWUgYXMgb3RoZXIgYGxvZGFzaGAgbWV0aG9kcy4gKi9cbnZhciBuYXRpdmVNYXggPSBNYXRoLm1heDtcblxuLyoqXG4gKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCBpbnZva2VzIGBmdW5jYCB3aXRoIHRoZSBgdGhpc2AgYmluZGluZyBvZiB0aGVcbiAqIGNyZWF0ZWQgZnVuY3Rpb24gYW5kIGFyZ3VtZW50cyBmcm9tIGBzdGFydGAgYW5kIGJleW9uZCBwcm92aWRlZCBhcyBhbiBhcnJheS5cbiAqXG4gKiAqKk5vdGU6KiogVGhpcyBtZXRob2QgaXMgYmFzZWQgb24gdGhlIFtyZXN0IHBhcmFtZXRlcl0oaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvRnVuY3Rpb25zL3Jlc3RfcGFyYW1ldGVycykuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBGdW5jdGlvblxuICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBUaGUgZnVuY3Rpb24gdG8gYXBwbHkgYSByZXN0IHBhcmFtZXRlciB0by5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbc3RhcnQ9ZnVuYy5sZW5ndGgtMV0gVGhlIHN0YXJ0IHBvc2l0aW9uIG9mIHRoZSByZXN0IHBhcmFtZXRlci5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGZ1bmN0aW9uLlxuICogQGV4YW1wbGVcbiAqXG4gKiB2YXIgc2F5ID0gXy5yZXN0UGFyYW0oZnVuY3Rpb24od2hhdCwgbmFtZXMpIHtcbiAqICAgcmV0dXJuIHdoYXQgKyAnICcgKyBfLmluaXRpYWwobmFtZXMpLmpvaW4oJywgJykgK1xuICogICAgIChfLnNpemUobmFtZXMpID4gMSA/ICcsICYgJyA6ICcnKSArIF8ubGFzdChuYW1lcyk7XG4gKiB9KTtcbiAqXG4gKiBzYXkoJ2hlbGxvJywgJ2ZyZWQnLCAnYmFybmV5JywgJ3BlYmJsZXMnKTtcbiAqIC8vID0+ICdoZWxsbyBmcmVkLCBiYXJuZXksICYgcGViYmxlcydcbiAqL1xuZnVuY3Rpb24gcmVzdFBhcmFtKGZ1bmMsIHN0YXJ0KSB7XG4gIGlmICh0eXBlb2YgZnVuYyAhPSAnZnVuY3Rpb24nKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihGVU5DX0VSUk9SX1RFWFQpO1xuICB9XG4gIHN0YXJ0ID0gbmF0aXZlTWF4KHN0YXJ0ID09PSB1bmRlZmluZWQgPyAoZnVuYy5sZW5ndGggLSAxKSA6ICgrc3RhcnQgfHwgMCksIDApO1xuICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGFyZ3MgPSBhcmd1bWVudHMsXG4gICAgICAgIGluZGV4ID0gLTEsXG4gICAgICAgIGxlbmd0aCA9IG5hdGl2ZU1heChhcmdzLmxlbmd0aCAtIHN0YXJ0LCAwKSxcbiAgICAgICAgcmVzdCA9IEFycmF5KGxlbmd0aCk7XG5cbiAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgcmVzdFtpbmRleF0gPSBhcmdzW3N0YXJ0ICsgaW5kZXhdO1xuICAgIH1cbiAgICBzd2l0Y2ggKHN0YXJ0KSB7XG4gICAgICBjYXNlIDA6IHJldHVybiBmdW5jLmNhbGwodGhpcywgcmVzdCk7XG4gICAgICBjYXNlIDE6IHJldHVybiBmdW5jLmNhbGwodGhpcywgYXJnc1swXSwgcmVzdCk7XG4gICAgICBjYXNlIDI6IHJldHVybiBmdW5jLmNhbGwodGhpcywgYXJnc1swXSwgYXJnc1sxXSwgcmVzdCk7XG4gICAgfVxuICAgIHZhciBvdGhlckFyZ3MgPSBBcnJheShzdGFydCArIDEpO1xuICAgIGluZGV4ID0gLTE7XG4gICAgd2hpbGUgKCsraW5kZXggPCBzdGFydCkge1xuICAgICAgb3RoZXJBcmdzW2luZGV4XSA9IGFyZ3NbaW5kZXhdO1xuICAgIH1cbiAgICBvdGhlckFyZ3Nbc3RhcnRdID0gcmVzdDtcbiAgICByZXR1cm4gZnVuYy5hcHBseSh0aGlzLCBvdGhlckFyZ3MpO1xuICB9O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHJlc3RQYXJhbTtcbiIsIi8qKlxuICogbG9kYXNoIDMuMS4yIChDdXN0b20gQnVpbGQpIDxodHRwczovL2xvZGFzaC5jb20vPlxuICogQnVpbGQ6IGBsb2Rhc2ggbW9kZXJuIG1vZHVsYXJpemUgZXhwb3J0cz1cIm5wbVwiIC1vIC4vYFxuICogQ29weXJpZ2h0IDIwMTItMjAxNSBUaGUgRG9qbyBGb3VuZGF0aW9uIDxodHRwOi8vZG9qb2ZvdW5kYXRpb24ub3JnLz5cbiAqIEJhc2VkIG9uIFVuZGVyc2NvcmUuanMgMS44LjMgPGh0dHA6Ly91bmRlcnNjb3JlanMub3JnL0xJQ0VOU0U+XG4gKiBDb3B5cmlnaHQgMjAwOS0yMDE1IEplcmVteSBBc2hrZW5hcywgRG9jdW1lbnRDbG91ZCBhbmQgSW52ZXN0aWdhdGl2ZSBSZXBvcnRlcnMgJiBFZGl0b3JzXG4gKiBBdmFpbGFibGUgdW5kZXIgTUlUIGxpY2Vuc2UgPGh0dHBzOi8vbG9kYXNoLmNvbS9saWNlbnNlPlxuICovXG52YXIgZ2V0TmF0aXZlID0gcmVxdWlyZSgnbG9kYXNoLl9nZXRuYXRpdmUnKSxcbiAgICBpc0FyZ3VtZW50cyA9IHJlcXVpcmUoJ2xvZGFzaC5pc2FyZ3VtZW50cycpLFxuICAgIGlzQXJyYXkgPSByZXF1aXJlKCdsb2Rhc2guaXNhcnJheScpO1xuXG4vKiogVXNlZCB0byBkZXRlY3QgdW5zaWduZWQgaW50ZWdlciB2YWx1ZXMuICovXG52YXIgcmVJc1VpbnQgPSAvXlxcZCskLztcblxuLyoqIFVzZWQgZm9yIG5hdGl2ZSBtZXRob2QgcmVmZXJlbmNlcy4gKi9cbnZhciBvYmplY3RQcm90byA9IE9iamVjdC5wcm90b3R5cGU7XG5cbi8qKiBVc2VkIHRvIGNoZWNrIG9iamVjdHMgZm9yIG93biBwcm9wZXJ0aWVzLiAqL1xudmFyIGhhc093blByb3BlcnR5ID0gb2JqZWN0UHJvdG8uaGFzT3duUHJvcGVydHk7XG5cbi8qIE5hdGl2ZSBtZXRob2QgcmVmZXJlbmNlcyBmb3IgdGhvc2Ugd2l0aCB0aGUgc2FtZSBuYW1lIGFzIG90aGVyIGBsb2Rhc2hgIG1ldGhvZHMuICovXG52YXIgbmF0aXZlS2V5cyA9IGdldE5hdGl2ZShPYmplY3QsICdrZXlzJyk7XG5cbi8qKlxuICogVXNlZCBhcyB0aGUgW21heGltdW0gbGVuZ3RoXShodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi82LjAvI3NlYy1udW1iZXIubWF4X3NhZmVfaW50ZWdlcilcbiAqIG9mIGFuIGFycmF5LWxpa2UgdmFsdWUuXG4gKi9cbnZhciBNQVhfU0FGRV9JTlRFR0VSID0gOTAwNzE5OTI1NDc0MDk5MTtcblxuLyoqXG4gKiBUaGUgYmFzZSBpbXBsZW1lbnRhdGlvbiBvZiBgXy5wcm9wZXJ0eWAgd2l0aG91dCBzdXBwb3J0IGZvciBkZWVwIHBhdGhzLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge3N0cmluZ30ga2V5IFRoZSBrZXkgb2YgdGhlIHByb3BlcnR5IHRvIGdldC5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGZ1bmN0aW9uLlxuICovXG5mdW5jdGlvbiBiYXNlUHJvcGVydHkoa2V5KSB7XG4gIHJldHVybiBmdW5jdGlvbihvYmplY3QpIHtcbiAgICByZXR1cm4gb2JqZWN0ID09IG51bGwgPyB1bmRlZmluZWQgOiBvYmplY3Rba2V5XTtcbiAgfTtcbn1cblxuLyoqXG4gKiBHZXRzIHRoZSBcImxlbmd0aFwiIHByb3BlcnR5IHZhbHVlIG9mIGBvYmplY3RgLlxuICpcbiAqICoqTm90ZToqKiBUaGlzIGZ1bmN0aW9uIGlzIHVzZWQgdG8gYXZvaWQgYSBbSklUIGJ1Z10oaHR0cHM6Ly9idWdzLndlYmtpdC5vcmcvc2hvd19idWcuY2dpP2lkPTE0Mjc5MilcbiAqIHRoYXQgYWZmZWN0cyBTYWZhcmkgb24gYXQgbGVhc3QgaU9TIDguMS04LjMgQVJNNjQuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBxdWVyeS5cbiAqIEByZXR1cm5zIHsqfSBSZXR1cm5zIHRoZSBcImxlbmd0aFwiIHZhbHVlLlxuICovXG52YXIgZ2V0TGVuZ3RoID0gYmFzZVByb3BlcnR5KCdsZW5ndGgnKTtcblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhcnJheS1saWtlLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGFycmF5LWxpa2UsIGVsc2UgYGZhbHNlYC5cbiAqL1xuZnVuY3Rpb24gaXNBcnJheUxpa2UodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlICE9IG51bGwgJiYgaXNMZW5ndGgoZ2V0TGVuZ3RoKHZhbHVlKSk7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSB2YWxpZCBhcnJheS1saWtlIGluZGV4LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbbGVuZ3RoPU1BWF9TQUZFX0lOVEVHRVJdIFRoZSB1cHBlciBib3VuZHMgb2YgYSB2YWxpZCBpbmRleC5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGEgdmFsaWQgaW5kZXgsIGVsc2UgYGZhbHNlYC5cbiAqL1xuZnVuY3Rpb24gaXNJbmRleCh2YWx1ZSwgbGVuZ3RoKSB7XG4gIHZhbHVlID0gKHR5cGVvZiB2YWx1ZSA9PSAnbnVtYmVyJyB8fCByZUlzVWludC50ZXN0KHZhbHVlKSkgPyArdmFsdWUgOiAtMTtcbiAgbGVuZ3RoID0gbGVuZ3RoID09IG51bGwgPyBNQVhfU0FGRV9JTlRFR0VSIDogbGVuZ3RoO1xuICByZXR1cm4gdmFsdWUgPiAtMSAmJiB2YWx1ZSAlIDEgPT0gMCAmJiB2YWx1ZSA8IGxlbmd0aDtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIHZhbGlkIGFycmF5LWxpa2UgbGVuZ3RoLlxuICpcbiAqICoqTm90ZToqKiBUaGlzIGZ1bmN0aW9uIGlzIGJhc2VkIG9uIFtgVG9MZW5ndGhgXShodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi82LjAvI3NlYy10b2xlbmd0aCkuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSB2YWxpZCBsZW5ndGgsIGVsc2UgYGZhbHNlYC5cbiAqL1xuZnVuY3Rpb24gaXNMZW5ndGgodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PSAnbnVtYmVyJyAmJiB2YWx1ZSA+IC0xICYmIHZhbHVlICUgMSA9PSAwICYmIHZhbHVlIDw9IE1BWF9TQUZFX0lOVEVHRVI7XG59XG5cbi8qKlxuICogQSBmYWxsYmFjayBpbXBsZW1lbnRhdGlvbiBvZiBgT2JqZWN0LmtleXNgIHdoaWNoIGNyZWF0ZXMgYW4gYXJyYXkgb2YgdGhlXG4gKiBvd24gZW51bWVyYWJsZSBwcm9wZXJ0eSBuYW1lcyBvZiBgb2JqZWN0YC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIHF1ZXJ5LlxuICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIHRoZSBhcnJheSBvZiBwcm9wZXJ0eSBuYW1lcy5cbiAqL1xuZnVuY3Rpb24gc2hpbUtleXMob2JqZWN0KSB7XG4gIHZhciBwcm9wcyA9IGtleXNJbihvYmplY3QpLFxuICAgICAgcHJvcHNMZW5ndGggPSBwcm9wcy5sZW5ndGgsXG4gICAgICBsZW5ndGggPSBwcm9wc0xlbmd0aCAmJiBvYmplY3QubGVuZ3RoO1xuXG4gIHZhciBhbGxvd0luZGV4ZXMgPSAhIWxlbmd0aCAmJiBpc0xlbmd0aChsZW5ndGgpICYmXG4gICAgKGlzQXJyYXkob2JqZWN0KSB8fCBpc0FyZ3VtZW50cyhvYmplY3QpKTtcblxuICB2YXIgaW5kZXggPSAtMSxcbiAgICAgIHJlc3VsdCA9IFtdO1xuXG4gIHdoaWxlICgrK2luZGV4IDwgcHJvcHNMZW5ndGgpIHtcbiAgICB2YXIga2V5ID0gcHJvcHNbaW5kZXhdO1xuICAgIGlmICgoYWxsb3dJbmRleGVzICYmIGlzSW5kZXgoa2V5LCBsZW5ndGgpKSB8fCBoYXNPd25Qcm9wZXJ0eS5jYWxsKG9iamVjdCwga2V5KSkge1xuICAgICAgcmVzdWx0LnB1c2goa2V5KTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyB0aGUgW2xhbmd1YWdlIHR5cGVdKGh0dHBzOi8vZXM1LmdpdGh1Yi5pby8jeDgpIG9mIGBPYmplY3RgLlxuICogKGUuZy4gYXJyYXlzLCBmdW5jdGlvbnMsIG9iamVjdHMsIHJlZ2V4ZXMsIGBuZXcgTnVtYmVyKDApYCwgYW5kIGBuZXcgU3RyaW5nKCcnKWApXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGFuIG9iamVjdCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzT2JqZWN0KHt9KTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0KFsxLCAyLCAzXSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdCgxKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzT2JqZWN0KHZhbHVlKSB7XG4gIC8vIEF2b2lkIGEgVjggSklUIGJ1ZyBpbiBDaHJvbWUgMTktMjAuXG4gIC8vIFNlZSBodHRwczovL2NvZGUuZ29vZ2xlLmNvbS9wL3Y4L2lzc3Vlcy9kZXRhaWw/aWQ9MjI5MSBmb3IgbW9yZSBkZXRhaWxzLlxuICB2YXIgdHlwZSA9IHR5cGVvZiB2YWx1ZTtcbiAgcmV0dXJuICEhdmFsdWUgJiYgKHR5cGUgPT0gJ29iamVjdCcgfHwgdHlwZSA9PSAnZnVuY3Rpb24nKTtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGFuIGFycmF5IG9mIHRoZSBvd24gZW51bWVyYWJsZSBwcm9wZXJ0eSBuYW1lcyBvZiBgb2JqZWN0YC5cbiAqXG4gKiAqKk5vdGU6KiogTm9uLW9iamVjdCB2YWx1ZXMgYXJlIGNvZXJjZWQgdG8gb2JqZWN0cy4gU2VlIHRoZVxuICogW0VTIHNwZWNdKGh0dHA6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzYuMC8jc2VjLW9iamVjdC5rZXlzKVxuICogZm9yIG1vcmUgZGV0YWlscy5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IE9iamVjdFxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIHF1ZXJ5LlxuICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIHRoZSBhcnJheSBvZiBwcm9wZXJ0eSBuYW1lcy5cbiAqIEBleGFtcGxlXG4gKlxuICogZnVuY3Rpb24gRm9vKCkge1xuICogICB0aGlzLmEgPSAxO1xuICogICB0aGlzLmIgPSAyO1xuICogfVxuICpcbiAqIEZvby5wcm90b3R5cGUuYyA9IDM7XG4gKlxuICogXy5rZXlzKG5ldyBGb28pO1xuICogLy8gPT4gWydhJywgJ2InXSAoaXRlcmF0aW9uIG9yZGVyIGlzIG5vdCBndWFyYW50ZWVkKVxuICpcbiAqIF8ua2V5cygnaGknKTtcbiAqIC8vID0+IFsnMCcsICcxJ11cbiAqL1xudmFyIGtleXMgPSAhbmF0aXZlS2V5cyA/IHNoaW1LZXlzIDogZnVuY3Rpb24ob2JqZWN0KSB7XG4gIHZhciBDdG9yID0gb2JqZWN0ID09IG51bGwgPyB1bmRlZmluZWQgOiBvYmplY3QuY29uc3RydWN0b3I7XG4gIGlmICgodHlwZW9mIEN0b3IgPT0gJ2Z1bmN0aW9uJyAmJiBDdG9yLnByb3RvdHlwZSA9PT0gb2JqZWN0KSB8fFxuICAgICAgKHR5cGVvZiBvYmplY3QgIT0gJ2Z1bmN0aW9uJyAmJiBpc0FycmF5TGlrZShvYmplY3QpKSkge1xuICAgIHJldHVybiBzaGltS2V5cyhvYmplY3QpO1xuICB9XG4gIHJldHVybiBpc09iamVjdChvYmplY3QpID8gbmF0aXZlS2V5cyhvYmplY3QpIDogW107XG59O1xuXG4vKipcbiAqIENyZWF0ZXMgYW4gYXJyYXkgb2YgdGhlIG93biBhbmQgaW5oZXJpdGVkIGVudW1lcmFibGUgcHJvcGVydHkgbmFtZXMgb2YgYG9iamVjdGAuXG4gKlxuICogKipOb3RlOioqIE5vbi1vYmplY3QgdmFsdWVzIGFyZSBjb2VyY2VkIHRvIG9iamVjdHMuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBPYmplY3RcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBxdWVyeS5cbiAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyB0aGUgYXJyYXkgb2YgcHJvcGVydHkgbmFtZXMuXG4gKiBAZXhhbXBsZVxuICpcbiAqIGZ1bmN0aW9uIEZvbygpIHtcbiAqICAgdGhpcy5hID0gMTtcbiAqICAgdGhpcy5iID0gMjtcbiAqIH1cbiAqXG4gKiBGb28ucHJvdG90eXBlLmMgPSAzO1xuICpcbiAqIF8ua2V5c0luKG5ldyBGb28pO1xuICogLy8gPT4gWydhJywgJ2InLCAnYyddIChpdGVyYXRpb24gb3JkZXIgaXMgbm90IGd1YXJhbnRlZWQpXG4gKi9cbmZ1bmN0aW9uIGtleXNJbihvYmplY3QpIHtcbiAgaWYgKG9iamVjdCA9PSBudWxsKSB7XG4gICAgcmV0dXJuIFtdO1xuICB9XG4gIGlmICghaXNPYmplY3Qob2JqZWN0KSkge1xuICAgIG9iamVjdCA9IE9iamVjdChvYmplY3QpO1xuICB9XG4gIHZhciBsZW5ndGggPSBvYmplY3QubGVuZ3RoO1xuICBsZW5ndGggPSAobGVuZ3RoICYmIGlzTGVuZ3RoKGxlbmd0aCkgJiZcbiAgICAoaXNBcnJheShvYmplY3QpIHx8IGlzQXJndW1lbnRzKG9iamVjdCkpICYmIGxlbmd0aCkgfHwgMDtcblxuICB2YXIgQ3RvciA9IG9iamVjdC5jb25zdHJ1Y3RvcixcbiAgICAgIGluZGV4ID0gLTEsXG4gICAgICBpc1Byb3RvID0gdHlwZW9mIEN0b3IgPT0gJ2Z1bmN0aW9uJyAmJiBDdG9yLnByb3RvdHlwZSA9PT0gb2JqZWN0LFxuICAgICAgcmVzdWx0ID0gQXJyYXkobGVuZ3RoKSxcbiAgICAgIHNraXBJbmRleGVzID0gbGVuZ3RoID4gMDtcblxuICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgIHJlc3VsdFtpbmRleF0gPSAoaW5kZXggKyAnJyk7XG4gIH1cbiAgZm9yICh2YXIga2V5IGluIG9iamVjdCkge1xuICAgIGlmICghKHNraXBJbmRleGVzICYmIGlzSW5kZXgoa2V5LCBsZW5ndGgpKSAmJlxuICAgICAgICAhKGtleSA9PSAnY29uc3RydWN0b3InICYmIChpc1Byb3RvIHx8ICFoYXNPd25Qcm9wZXJ0eS5jYWxsKG9iamVjdCwga2V5KSkpKSB7XG4gICAgICByZXN1bHQucHVzaChrZXkpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGtleXM7XG4iLCIvKipcbiAqIGxvZGFzaCAzLjkuMSAoQ3VzdG9tIEJ1aWxkKSA8aHR0cHM6Ly9sb2Rhc2guY29tLz5cbiAqIEJ1aWxkOiBgbG9kYXNoIG1vZGVybiBtb2R1bGFyaXplIGV4cG9ydHM9XCJucG1cIiAtbyAuL2BcbiAqIENvcHlyaWdodCAyMDEyLTIwMTUgVGhlIERvam8gRm91bmRhdGlvbiA8aHR0cDovL2Rvam9mb3VuZGF0aW9uLm9yZy8+XG4gKiBCYXNlZCBvbiBVbmRlcnNjb3JlLmpzIDEuOC4zIDxodHRwOi8vdW5kZXJzY29yZWpzLm9yZy9MSUNFTlNFPlxuICogQ29weXJpZ2h0IDIwMDktMjAxNSBKZXJlbXkgQXNoa2VuYXMsIERvY3VtZW50Q2xvdWQgYW5kIEludmVzdGlnYXRpdmUgUmVwb3J0ZXJzICYgRWRpdG9yc1xuICogQXZhaWxhYmxlIHVuZGVyIE1JVCBsaWNlbnNlIDxodHRwczovL2xvZGFzaC5jb20vbGljZW5zZT5cbiAqL1xuXG4vKiogYE9iamVjdCN0b1N0cmluZ2AgcmVzdWx0IHJlZmVyZW5jZXMuICovXG52YXIgZnVuY1RhZyA9ICdbb2JqZWN0IEZ1bmN0aW9uXSc7XG5cbi8qKiBVc2VkIHRvIGRldGVjdCBob3N0IGNvbnN0cnVjdG9ycyAoU2FmYXJpID4gNSkuICovXG52YXIgcmVJc0hvc3RDdG9yID0gL15cXFtvYmplY3QgLis/Q29uc3RydWN0b3JcXF0kLztcblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBvYmplY3QtbGlrZS5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBvYmplY3QtbGlrZSwgZWxzZSBgZmFsc2VgLlxuICovXG5mdW5jdGlvbiBpc09iamVjdExpa2UodmFsdWUpIHtcbiAgcmV0dXJuICEhdmFsdWUgJiYgdHlwZW9mIHZhbHVlID09ICdvYmplY3QnO1xufVxuXG4vKiogVXNlZCBmb3IgbmF0aXZlIG1ldGhvZCByZWZlcmVuY2VzLiAqL1xudmFyIG9iamVjdFByb3RvID0gT2JqZWN0LnByb3RvdHlwZTtcblxuLyoqIFVzZWQgdG8gcmVzb2x2ZSB0aGUgZGVjb21waWxlZCBzb3VyY2Ugb2YgZnVuY3Rpb25zLiAqL1xudmFyIGZuVG9TdHJpbmcgPSBGdW5jdGlvbi5wcm90b3R5cGUudG9TdHJpbmc7XG5cbi8qKiBVc2VkIHRvIGNoZWNrIG9iamVjdHMgZm9yIG93biBwcm9wZXJ0aWVzLiAqL1xudmFyIGhhc093blByb3BlcnR5ID0gb2JqZWN0UHJvdG8uaGFzT3duUHJvcGVydHk7XG5cbi8qKlxuICogVXNlZCB0byByZXNvbHZlIHRoZSBbYHRvU3RyaW5nVGFnYF0oaHR0cDovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNi4wLyNzZWMtb2JqZWN0LnByb3RvdHlwZS50b3N0cmluZylcbiAqIG9mIHZhbHVlcy5cbiAqL1xudmFyIG9ialRvU3RyaW5nID0gb2JqZWN0UHJvdG8udG9TdHJpbmc7XG5cbi8qKiBVc2VkIHRvIGRldGVjdCBpZiBhIG1ldGhvZCBpcyBuYXRpdmUuICovXG52YXIgcmVJc05hdGl2ZSA9IFJlZ0V4cCgnXicgK1xuICBmblRvU3RyaW5nLmNhbGwoaGFzT3duUHJvcGVydHkpLnJlcGxhY2UoL1tcXFxcXiQuKis/KClbXFxde318XS9nLCAnXFxcXCQmJylcbiAgLnJlcGxhY2UoL2hhc093blByb3BlcnR5fChmdW5jdGlvbikuKj8oPz1cXFxcXFwoKXwgZm9yIC4rPyg/PVxcXFxcXF0pL2csICckMS4qPycpICsgJyQnXG4pO1xuXG4vKipcbiAqIEdldHMgdGhlIG5hdGl2ZSBmdW5jdGlvbiBhdCBga2V5YCBvZiBgb2JqZWN0YC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIHF1ZXJ5LlxuICogQHBhcmFtIHtzdHJpbmd9IGtleSBUaGUga2V5IG9mIHRoZSBtZXRob2QgdG8gZ2V0LlxuICogQHJldHVybnMgeyp9IFJldHVybnMgdGhlIGZ1bmN0aW9uIGlmIGl0J3MgbmF0aXZlLCBlbHNlIGB1bmRlZmluZWRgLlxuICovXG5mdW5jdGlvbiBnZXROYXRpdmUob2JqZWN0LCBrZXkpIHtcbiAgdmFyIHZhbHVlID0gb2JqZWN0ID09IG51bGwgPyB1bmRlZmluZWQgOiBvYmplY3Rba2V5XTtcbiAgcmV0dXJuIGlzTmF0aXZlKHZhbHVlKSA/IHZhbHVlIDogdW5kZWZpbmVkO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGNsYXNzaWZpZWQgYXMgYSBgRnVuY3Rpb25gIG9iamVjdC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgY29ycmVjdGx5IGNsYXNzaWZpZWQsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc0Z1bmN0aW9uKF8pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNGdW5jdGlvbigvYWJjLyk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKHZhbHVlKSB7XG4gIC8vIFRoZSB1c2Ugb2YgYE9iamVjdCN0b1N0cmluZ2AgYXZvaWRzIGlzc3VlcyB3aXRoIHRoZSBgdHlwZW9mYCBvcGVyYXRvclxuICAvLyBpbiBvbGRlciB2ZXJzaW9ucyBvZiBDaHJvbWUgYW5kIFNhZmFyaSB3aGljaCByZXR1cm4gJ2Z1bmN0aW9uJyBmb3IgcmVnZXhlc1xuICAvLyBhbmQgU2FmYXJpIDggZXF1aXZhbGVudHMgd2hpY2ggcmV0dXJuICdvYmplY3QnIGZvciB0eXBlZCBhcnJheSBjb25zdHJ1Y3RvcnMuXG4gIHJldHVybiBpc09iamVjdCh2YWx1ZSkgJiYgb2JqVG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT0gZnVuY1RhZztcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyB0aGUgW2xhbmd1YWdlIHR5cGVdKGh0dHBzOi8vZXM1LmdpdGh1Yi5pby8jeDgpIG9mIGBPYmplY3RgLlxuICogKGUuZy4gYXJyYXlzLCBmdW5jdGlvbnMsIG9iamVjdHMsIHJlZ2V4ZXMsIGBuZXcgTnVtYmVyKDApYCwgYW5kIGBuZXcgU3RyaW5nKCcnKWApXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGFuIG9iamVjdCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzT2JqZWN0KHt9KTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0KFsxLCAyLCAzXSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdCgxKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzT2JqZWN0KHZhbHVlKSB7XG4gIC8vIEF2b2lkIGEgVjggSklUIGJ1ZyBpbiBDaHJvbWUgMTktMjAuXG4gIC8vIFNlZSBodHRwczovL2NvZGUuZ29vZ2xlLmNvbS9wL3Y4L2lzc3Vlcy9kZXRhaWw/aWQ9MjI5MSBmb3IgbW9yZSBkZXRhaWxzLlxuICB2YXIgdHlwZSA9IHR5cGVvZiB2YWx1ZTtcbiAgcmV0dXJuICEhdmFsdWUgJiYgKHR5cGUgPT0gJ29iamVjdCcgfHwgdHlwZSA9PSAnZnVuY3Rpb24nKTtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIG5hdGl2ZSBmdW5jdGlvbi5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSBuYXRpdmUgZnVuY3Rpb24sIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc05hdGl2ZShBcnJheS5wcm90b3R5cGUucHVzaCk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc05hdGl2ZShfKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzTmF0aXZlKHZhbHVlKSB7XG4gIGlmICh2YWx1ZSA9PSBudWxsKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmIChpc0Z1bmN0aW9uKHZhbHVlKSkge1xuICAgIHJldHVybiByZUlzTmF0aXZlLnRlc3QoZm5Ub1N0cmluZy5jYWxsKHZhbHVlKSk7XG4gIH1cbiAgcmV0dXJuIGlzT2JqZWN0TGlrZSh2YWx1ZSkgJiYgcmVJc0hvc3RDdG9yLnRlc3QodmFsdWUpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGdldE5hdGl2ZTtcbiIsIi8qKlxuICogbG9kYXNoIDMuMC40IChDdXN0b20gQnVpbGQpIDxodHRwczovL2xvZGFzaC5jb20vPlxuICogQnVpbGQ6IGBsb2Rhc2ggbW9kZXJuIG1vZHVsYXJpemUgZXhwb3J0cz1cIm5wbVwiIC1vIC4vYFxuICogQ29weXJpZ2h0IDIwMTItMjAxNSBUaGUgRG9qbyBGb3VuZGF0aW9uIDxodHRwOi8vZG9qb2ZvdW5kYXRpb24ub3JnLz5cbiAqIEJhc2VkIG9uIFVuZGVyc2NvcmUuanMgMS44LjMgPGh0dHA6Ly91bmRlcnNjb3JlanMub3JnL0xJQ0VOU0U+XG4gKiBDb3B5cmlnaHQgMjAwOS0yMDE1IEplcmVteSBBc2hrZW5hcywgRG9jdW1lbnRDbG91ZCBhbmQgSW52ZXN0aWdhdGl2ZSBSZXBvcnRlcnMgJiBFZGl0b3JzXG4gKiBBdmFpbGFibGUgdW5kZXIgTUlUIGxpY2Vuc2UgPGh0dHBzOi8vbG9kYXNoLmNvbS9saWNlbnNlPlxuICovXG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgb2JqZWN0LWxpa2UuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgb2JqZWN0LWxpa2UsIGVsc2UgYGZhbHNlYC5cbiAqL1xuZnVuY3Rpb24gaXNPYmplY3RMaWtlKHZhbHVlKSB7XG4gIHJldHVybiAhIXZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PSAnb2JqZWN0Jztcbn1cblxuLyoqIFVzZWQgZm9yIG5hdGl2ZSBtZXRob2QgcmVmZXJlbmNlcy4gKi9cbnZhciBvYmplY3RQcm90byA9IE9iamVjdC5wcm90b3R5cGU7XG5cbi8qKiBVc2VkIHRvIGNoZWNrIG9iamVjdHMgZm9yIG93biBwcm9wZXJ0aWVzLiAqL1xudmFyIGhhc093blByb3BlcnR5ID0gb2JqZWN0UHJvdG8uaGFzT3duUHJvcGVydHk7XG5cbi8qKiBOYXRpdmUgbWV0aG9kIHJlZmVyZW5jZXMuICovXG52YXIgcHJvcGVydHlJc0VudW1lcmFibGUgPSBvYmplY3RQcm90by5wcm9wZXJ0eUlzRW51bWVyYWJsZTtcblxuLyoqXG4gKiBVc2VkIGFzIHRoZSBbbWF4aW11bSBsZW5ndGhdKGh0dHA6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzYuMC8jc2VjLW51bWJlci5tYXhfc2FmZV9pbnRlZ2VyKVxuICogb2YgYW4gYXJyYXktbGlrZSB2YWx1ZS5cbiAqL1xudmFyIE1BWF9TQUZFX0lOVEVHRVIgPSA5MDA3MTk5MjU0NzQwOTkxO1xuXG4vKipcbiAqIFRoZSBiYXNlIGltcGxlbWVudGF0aW9uIG9mIGBfLnByb3BlcnR5YCB3aXRob3V0IHN1cHBvcnQgZm9yIGRlZXAgcGF0aHMuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgVGhlIGtleSBvZiB0aGUgcHJvcGVydHkgdG8gZ2V0LlxuICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgZnVuY3Rpb24uXG4gKi9cbmZ1bmN0aW9uIGJhc2VQcm9wZXJ0eShrZXkpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKG9iamVjdCkge1xuICAgIHJldHVybiBvYmplY3QgPT0gbnVsbCA/IHVuZGVmaW5lZCA6IG9iamVjdFtrZXldO1xuICB9O1xufVxuXG4vKipcbiAqIEdldHMgdGhlIFwibGVuZ3RoXCIgcHJvcGVydHkgdmFsdWUgb2YgYG9iamVjdGAuXG4gKlxuICogKipOb3RlOioqIFRoaXMgZnVuY3Rpb24gaXMgdXNlZCB0byBhdm9pZCBhIFtKSVQgYnVnXShodHRwczovL2J1Z3Mud2Via2l0Lm9yZy9zaG93X2J1Zy5jZ2k/aWQ9MTQyNzkyKVxuICogdGhhdCBhZmZlY3RzIFNhZmFyaSBvbiBhdCBsZWFzdCBpT1MgOC4xLTguMyBBUk02NC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIHF1ZXJ5LlxuICogQHJldHVybnMgeyp9IFJldHVybnMgdGhlIFwibGVuZ3RoXCIgdmFsdWUuXG4gKi9cbnZhciBnZXRMZW5ndGggPSBiYXNlUHJvcGVydHkoJ2xlbmd0aCcpO1xuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGFycmF5LWxpa2UuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYXJyYXktbGlrZSwgZWxzZSBgZmFsc2VgLlxuICovXG5mdW5jdGlvbiBpc0FycmF5TGlrZSh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgIT0gbnVsbCAmJiBpc0xlbmd0aChnZXRMZW5ndGgodmFsdWUpKTtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIHZhbGlkIGFycmF5LWxpa2UgbGVuZ3RoLlxuICpcbiAqICoqTm90ZToqKiBUaGlzIGZ1bmN0aW9uIGlzIGJhc2VkIG9uIFtgVG9MZW5ndGhgXShodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi82LjAvI3NlYy10b2xlbmd0aCkuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSB2YWxpZCBsZW5ndGgsIGVsc2UgYGZhbHNlYC5cbiAqL1xuZnVuY3Rpb24gaXNMZW5ndGgodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PSAnbnVtYmVyJyAmJiB2YWx1ZSA+IC0xICYmIHZhbHVlICUgMSA9PSAwICYmIHZhbHVlIDw9IE1BWF9TQUZFX0lOVEVHRVI7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgY2xhc3NpZmllZCBhcyBhbiBgYXJndW1lbnRzYCBvYmplY3QuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGNvcnJlY3RseSBjbGFzc2lmaWVkLCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNBcmd1bWVudHMoZnVuY3Rpb24oKSB7IHJldHVybiBhcmd1bWVudHM7IH0oKSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc0FyZ3VtZW50cyhbMSwgMiwgM10pO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNBcmd1bWVudHModmFsdWUpIHtcbiAgcmV0dXJuIGlzT2JqZWN0TGlrZSh2YWx1ZSkgJiYgaXNBcnJheUxpa2UodmFsdWUpICYmXG4gICAgaGFzT3duUHJvcGVydHkuY2FsbCh2YWx1ZSwgJ2NhbGxlZScpICYmICFwcm9wZXJ0eUlzRW51bWVyYWJsZS5jYWxsKHZhbHVlLCAnY2FsbGVlJyk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaXNBcmd1bWVudHM7XG4iLCIvKipcbiAqIGxvZGFzaCAzLjAuNCAoQ3VzdG9tIEJ1aWxkKSA8aHR0cHM6Ly9sb2Rhc2guY29tLz5cbiAqIEJ1aWxkOiBgbG9kYXNoIG1vZGVybiBtb2R1bGFyaXplIGV4cG9ydHM9XCJucG1cIiAtbyAuL2BcbiAqIENvcHlyaWdodCAyMDEyLTIwMTUgVGhlIERvam8gRm91bmRhdGlvbiA8aHR0cDovL2Rvam9mb3VuZGF0aW9uLm9yZy8+XG4gKiBCYXNlZCBvbiBVbmRlcnNjb3JlLmpzIDEuOC4zIDxodHRwOi8vdW5kZXJzY29yZWpzLm9yZy9MSUNFTlNFPlxuICogQ29weXJpZ2h0IDIwMDktMjAxNSBKZXJlbXkgQXNoa2VuYXMsIERvY3VtZW50Q2xvdWQgYW5kIEludmVzdGlnYXRpdmUgUmVwb3J0ZXJzICYgRWRpdG9yc1xuICogQXZhaWxhYmxlIHVuZGVyIE1JVCBsaWNlbnNlIDxodHRwczovL2xvZGFzaC5jb20vbGljZW5zZT5cbiAqL1xuXG4vKiogYE9iamVjdCN0b1N0cmluZ2AgcmVzdWx0IHJlZmVyZW5jZXMuICovXG52YXIgYXJyYXlUYWcgPSAnW29iamVjdCBBcnJheV0nLFxuICAgIGZ1bmNUYWcgPSAnW29iamVjdCBGdW5jdGlvbl0nO1xuXG4vKiogVXNlZCB0byBkZXRlY3QgaG9zdCBjb25zdHJ1Y3RvcnMgKFNhZmFyaSA+IDUpLiAqL1xudmFyIHJlSXNIb3N0Q3RvciA9IC9eXFxbb2JqZWN0IC4rP0NvbnN0cnVjdG9yXFxdJC87XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgb2JqZWN0LWxpa2UuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgb2JqZWN0LWxpa2UsIGVsc2UgYGZhbHNlYC5cbiAqL1xuZnVuY3Rpb24gaXNPYmplY3RMaWtlKHZhbHVlKSB7XG4gIHJldHVybiAhIXZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PSAnb2JqZWN0Jztcbn1cblxuLyoqIFVzZWQgZm9yIG5hdGl2ZSBtZXRob2QgcmVmZXJlbmNlcy4gKi9cbnZhciBvYmplY3RQcm90byA9IE9iamVjdC5wcm90b3R5cGU7XG5cbi8qKiBVc2VkIHRvIHJlc29sdmUgdGhlIGRlY29tcGlsZWQgc291cmNlIG9mIGZ1bmN0aW9ucy4gKi9cbnZhciBmblRvU3RyaW5nID0gRnVuY3Rpb24ucHJvdG90eXBlLnRvU3RyaW5nO1xuXG4vKiogVXNlZCB0byBjaGVjayBvYmplY3RzIGZvciBvd24gcHJvcGVydGllcy4gKi9cbnZhciBoYXNPd25Qcm9wZXJ0eSA9IG9iamVjdFByb3RvLmhhc093blByb3BlcnR5O1xuXG4vKipcbiAqIFVzZWQgdG8gcmVzb2x2ZSB0aGUgW2B0b1N0cmluZ1RhZ2BdKGh0dHA6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzYuMC8jc2VjLW9iamVjdC5wcm90b3R5cGUudG9zdHJpbmcpXG4gKiBvZiB2YWx1ZXMuXG4gKi9cbnZhciBvYmpUb1N0cmluZyA9IG9iamVjdFByb3RvLnRvU3RyaW5nO1xuXG4vKiogVXNlZCB0byBkZXRlY3QgaWYgYSBtZXRob2QgaXMgbmF0aXZlLiAqL1xudmFyIHJlSXNOYXRpdmUgPSBSZWdFeHAoJ14nICtcbiAgZm5Ub1N0cmluZy5jYWxsKGhhc093blByb3BlcnR5KS5yZXBsYWNlKC9bXFxcXF4kLiorPygpW1xcXXt9fF0vZywgJ1xcXFwkJicpXG4gIC5yZXBsYWNlKC9oYXNPd25Qcm9wZXJ0eXwoZnVuY3Rpb24pLio/KD89XFxcXFxcKCl8IGZvciAuKz8oPz1cXFxcXFxdKS9nLCAnJDEuKj8nKSArICckJ1xuKTtcblxuLyogTmF0aXZlIG1ldGhvZCByZWZlcmVuY2VzIGZvciB0aG9zZSB3aXRoIHRoZSBzYW1lIG5hbWUgYXMgb3RoZXIgYGxvZGFzaGAgbWV0aG9kcy4gKi9cbnZhciBuYXRpdmVJc0FycmF5ID0gZ2V0TmF0aXZlKEFycmF5LCAnaXNBcnJheScpO1xuXG4vKipcbiAqIFVzZWQgYXMgdGhlIFttYXhpbXVtIGxlbmd0aF0oaHR0cDovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNi4wLyNzZWMtbnVtYmVyLm1heF9zYWZlX2ludGVnZXIpXG4gKiBvZiBhbiBhcnJheS1saWtlIHZhbHVlLlxuICovXG52YXIgTUFYX1NBRkVfSU5URUdFUiA9IDkwMDcxOTkyNTQ3NDA5OTE7XG5cbi8qKlxuICogR2V0cyB0aGUgbmF0aXZlIGZ1bmN0aW9uIGF0IGBrZXlgIG9mIGBvYmplY3RgLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gcXVlcnkuXG4gKiBAcGFyYW0ge3N0cmluZ30ga2V5IFRoZSBrZXkgb2YgdGhlIG1ldGhvZCB0byBnZXQuXG4gKiBAcmV0dXJucyB7Kn0gUmV0dXJucyB0aGUgZnVuY3Rpb24gaWYgaXQncyBuYXRpdmUsIGVsc2UgYHVuZGVmaW5lZGAuXG4gKi9cbmZ1bmN0aW9uIGdldE5hdGl2ZShvYmplY3QsIGtleSkge1xuICB2YXIgdmFsdWUgPSBvYmplY3QgPT0gbnVsbCA/IHVuZGVmaW5lZCA6IG9iamVjdFtrZXldO1xuICByZXR1cm4gaXNOYXRpdmUodmFsdWUpID8gdmFsdWUgOiB1bmRlZmluZWQ7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSB2YWxpZCBhcnJheS1saWtlIGxlbmd0aC5cbiAqXG4gKiAqKk5vdGU6KiogVGhpcyBmdW5jdGlvbiBpcyBiYXNlZCBvbiBbYFRvTGVuZ3RoYF0oaHR0cDovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNi4wLyNzZWMtdG9sZW5ndGgpLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGEgdmFsaWQgbGVuZ3RoLCBlbHNlIGBmYWxzZWAuXG4gKi9cbmZ1bmN0aW9uIGlzTGVuZ3RoKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT0gJ251bWJlcicgJiYgdmFsdWUgPiAtMSAmJiB2YWx1ZSAlIDEgPT0gMCAmJiB2YWx1ZSA8PSBNQVhfU0FGRV9JTlRFR0VSO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGNsYXNzaWZpZWQgYXMgYW4gYEFycmF5YCBvYmplY3QuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGNvcnJlY3RseSBjbGFzc2lmaWVkLCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNBcnJheShbMSwgMiwgM10pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNBcnJheShmdW5jdGlvbigpIHsgcmV0dXJuIGFyZ3VtZW50czsgfSgpKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbnZhciBpc0FycmF5ID0gbmF0aXZlSXNBcnJheSB8fCBmdW5jdGlvbih2YWx1ZSkge1xuICByZXR1cm4gaXNPYmplY3RMaWtlKHZhbHVlKSAmJiBpc0xlbmd0aCh2YWx1ZS5sZW5ndGgpICYmIG9ialRvU3RyaW5nLmNhbGwodmFsdWUpID09IGFycmF5VGFnO1xufTtcblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBjbGFzc2lmaWVkIGFzIGEgYEZ1bmN0aW9uYCBvYmplY3QuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGNvcnJlY3RseSBjbGFzc2lmaWVkLCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNGdW5jdGlvbihfKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzRnVuY3Rpb24oL2FiYy8pO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNGdW5jdGlvbih2YWx1ZSkge1xuICAvLyBUaGUgdXNlIG9mIGBPYmplY3QjdG9TdHJpbmdgIGF2b2lkcyBpc3N1ZXMgd2l0aCB0aGUgYHR5cGVvZmAgb3BlcmF0b3JcbiAgLy8gaW4gb2xkZXIgdmVyc2lvbnMgb2YgQ2hyb21lIGFuZCBTYWZhcmkgd2hpY2ggcmV0dXJuICdmdW5jdGlvbicgZm9yIHJlZ2V4ZXNcbiAgLy8gYW5kIFNhZmFyaSA4IGVxdWl2YWxlbnRzIHdoaWNoIHJldHVybiAnb2JqZWN0JyBmb3IgdHlwZWQgYXJyYXkgY29uc3RydWN0b3JzLlxuICByZXR1cm4gaXNPYmplY3QodmFsdWUpICYmIG9ialRvU3RyaW5nLmNhbGwodmFsdWUpID09IGZ1bmNUYWc7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgdGhlIFtsYW5ndWFnZSB0eXBlXShodHRwczovL2VzNS5naXRodWIuaW8vI3g4KSBvZiBgT2JqZWN0YC5cbiAqIChlLmcuIGFycmF5cywgZnVuY3Rpb25zLCBvYmplY3RzLCByZWdleGVzLCBgbmV3IE51bWJlcigwKWAsIGFuZCBgbmV3IFN0cmluZygnJylgKVxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhbiBvYmplY3QsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc09iamVjdCh7fSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdChbMSwgMiwgM10pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3QoMSk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc09iamVjdCh2YWx1ZSkge1xuICAvLyBBdm9pZCBhIFY4IEpJVCBidWcgaW4gQ2hyb21lIDE5LTIwLlxuICAvLyBTZWUgaHR0cHM6Ly9jb2RlLmdvb2dsZS5jb20vcC92OC9pc3N1ZXMvZGV0YWlsP2lkPTIyOTEgZm9yIG1vcmUgZGV0YWlscy5cbiAgdmFyIHR5cGUgPSB0eXBlb2YgdmFsdWU7XG4gIHJldHVybiAhIXZhbHVlICYmICh0eXBlID09ICdvYmplY3QnIHx8IHR5cGUgPT0gJ2Z1bmN0aW9uJyk7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSBuYXRpdmUgZnVuY3Rpb24uXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGEgbmF0aXZlIGZ1bmN0aW9uLCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNOYXRpdmUoQXJyYXkucHJvdG90eXBlLnB1c2gpO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNOYXRpdmUoXyk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc05hdGl2ZSh2YWx1ZSkge1xuICBpZiAodmFsdWUgPT0gbnVsbCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAoaXNGdW5jdGlvbih2YWx1ZSkpIHtcbiAgICByZXR1cm4gcmVJc05hdGl2ZS50ZXN0KGZuVG9TdHJpbmcuY2FsbCh2YWx1ZSkpO1xuICB9XG4gIHJldHVybiBpc09iamVjdExpa2UodmFsdWUpICYmIHJlSXNIb3N0Q3Rvci50ZXN0KHZhbHVlKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpc0FycmF5O1xuIiwiLypqc2hpbnQgbm9kZTogdHJ1ZSovXG5cbi8qKlxuICogQGF1dGhvciBicm9sbGIgLyBodHRwczovL2dpdGh1Yi9icm9sbGJcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgQXV0b1JvdXRlciA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlcicpLFxuICAgIGFzc2VydCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5VdGlscycpLmFzc2VydDtcblxudmFyIEF1dG9Sb3V0ZXJBY3Rpb25BcHBsaWVyID0gZnVuY3Rpb24gKCkge1xufTtcblxuQXV0b1JvdXRlckFjdGlvbkFwcGxpZXIuQXV0b1JvdXRlciA9IEF1dG9Sb3V0ZXI7XG5cbkF1dG9Sb3V0ZXJBY3Rpb25BcHBsaWVyLnByb3RvdHlwZS5pbml0ID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuX3BvcnRTZXBhcmF0b3IgPSB0aGlzLl9wb3J0U2VwYXJhdG9yIHx8ICdfeF8nO1xuICAgIHRoaXMuYXV0b3JvdXRlciA9IG5ldyBBdXRvUm91dGVyKCk7XG4gICAgdGhpcy5kZWJ1Z0FjdGlvblNlcXVlbmNlID0gJ1snO1xuICAgIHRoaXMuX2NsZWFyUmVjb3JkcygpO1xufTtcblxuQXV0b1JvdXRlckFjdGlvbkFwcGxpZXIucHJvdG90eXBlLl9jbGVhclJlY29yZHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5fYXV0b3JvdXRlckJveGVzID0ge307ICAvLyBEZWZpbmUgY29udGFpbmVyIHRoYXQgd2lsbCBtYXAgb2JqK3N1YklEIC0+IGJveFxuICAgIHRoaXMuX2F1dG9yb3V0ZXJQb3J0cyA9IHt9OyAgLy8gTWFwcyBib3hJZHMgdG8gYW4gYXJyYXkgb2YgcG9ydCBpZHMgdGhhdCBoYXZlIGJlZW4gbWFwcGVkXG4gICAgdGhpcy5fYXV0b3JvdXRlclBhdGhzID0ge307XG4gICAgdGhpcy5fYXJQYXRoSWQyT3JpZ2luYWwgPSB7fTtcbn07XG5cbi8qKlxuICogUmVwbGFjZSBpZCBzdG9yZWQgYXQgdGhlIGdpdmVuIGluZGljZXMgb2YgdGhlIGFycmF5IHdpdGggdGhlIGl0ZW0gZnJvbSB0aGUgZGljdGlvbmFyeS5cbiAqXG4gKiBAcGFyYW0ge0RpY3Rpb25hcnl9IGRpY3Rpb25hcnlcbiAqIEBwYXJhbSB7QXJyYXl9IGFycmF5XG4gKiBAcGFyYW0ge0FycmF5PE51bWJlcj59IGluZGljZXNcbiAqIEByZXR1cm4ge3VuZGVmaW5lZH1cbiAqL1xuQXV0b1JvdXRlckFjdGlvbkFwcGxpZXIucHJvdG90eXBlLl9sb29rdXBJdGVtID0gZnVuY3Rpb24gKGRpY3Rpb25hcnksIGFycmF5LCBpbmRpY2VzKSB7ICAvLyBqc2hpbnQgaWdub3JlOmxpbmVcbiAgICB2YXIgaW5kZXgsXG4gICAgICAgIGlkO1xuXG4gICAgZm9yICh2YXIgaSA9IDI7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaW5kZXggPSBhcmd1bWVudHNbaV07XG4gICAgICAgIGlkID0gYXJyYXlbaW5kZXhdO1xuICAgICAgICBhcnJheVtpbmRleF0gPSBkaWN0aW9uYXJ5W2lkXTtcbiAgICB9XG59O1xuXG4vLyBGSVhNRTogVXBkYXRlIHRoaXMgbWV0aG9kIGZvciBuZXcgYXBpXG5BdXRvUm91dGVyQWN0aW9uQXBwbGllci5wcm90b3R5cGUuX2ZpeEFyZ3MgPSBmdW5jdGlvbiAoY29tbWFuZCwgYXJncykge1xuICAgIHZhciBpZDtcbiAgICAvLyBGaXggYXJncywgaWYgbmVlZGVkXG4gICAgc3dpdGNoIChjb21tYW5kKSB7XG4gICAgICAgIGNhc2UgJ21vdmUnOiAgLy8gYXJnc1swXSBpcyBpZCBzaG91bGQgYmUgdGhlIGJveFxuICAgICAgICAgICAgdGhpcy5fbG9va3VwSXRlbSh0aGlzLl9hdXRvcm91dGVyQm94ZXMsIGFyZ3MsIDApO1xuICAgICAgICAgICAgYXJnc1swXSA9IGFyZ3NbMF0uYm94O1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAnZ2V0UGF0aFBvaW50cyc6XG4gICAgICAgICAgICB0aGlzLl9sb29rdXBJdGVtKHRoaXMuX2F1dG9yb3V0ZXJQYXRocywgYXJncywgMCk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICdzZXRQYXRoQ3VzdG9tUG9pbnRzJzpcbiAgICAgICAgICAgIGlkID0gYXJnc1swXS5wYXRoO1xuICAgICAgICAgICAgYXJnc1swXS5wYXRoID0gdGhpcy5fYXV0b3JvdXRlclBhdGhzW2lkXTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ3NldEJveFJlY3QnOlxuICAgICAgICAgICAgdGhpcy5fbG9va3VwSXRlbSh0aGlzLl9hdXRvcm91dGVyQm94ZXMsIGFyZ3MsIDApO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAnZ2V0Qm94UmVjdCc6XG4gICAgICAgICAgICB0aGlzLl9sb29rdXBJdGVtKHRoaXMuX2F1dG9yb3V0ZXJCb3hlcywgYXJncywgMCk7XG4gICAgICAgICAgICBhcmdzWzBdID0gYXJnc1swXS5ib3guaWQ7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICd1cGRhdGVQb3J0JzpcbiAgICAgICAgICAgIHRoaXMuX2xvb2t1cEl0ZW0odGhpcy5fYXV0b3JvdXRlckJveGVzLCBhcmdzLCAwKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ3NldENvbXBvbmVudCc6XG4gICAgICAgICAgICB0aGlzLl9sb29rdXBJdGVtKHRoaXMuX2F1dG9yb3V0ZXJCb3hlcywgYXJncywgMCwgMSk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICdhZGRQYXRoJzpcbiAgICAgICAgICAgIHRoaXMuX2ZpeFBvcnRBcmdzKGFyZ3NbMF0uc3JjLCBhcmdzWzBdLmRzdCk7XG4gICAgICAgICAgICBhcmdzLnBvcCgpOyAgLy8gUmVtb3ZlIHRoZSBjb25uZWN0aW9uIGlkXG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICdyZW1vdmUnOlxuICAgICAgICAgICAgdmFyIGl0ZW07XG5cbiAgICAgICAgICAgIGlkID0gYXJnc1swXTtcbiAgICAgICAgICAgIGlmICh0aGlzLl9hdXRvcm91dGVyQm94ZXNbaWRdKSB7XG4gICAgICAgICAgICAgICAgaXRlbSA9IHRoaXMuX2F1dG9yb3V0ZXJCb3hlc1tpZF07XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2F1dG9yb3V0ZXJQYXRoc1tpZF0pIHtcbiAgICAgICAgICAgICAgICBpdGVtID0gdGhpcy5fYXV0b3JvdXRlclBhdGhzW2lkXTsgIC8vIElmIG9iaklkIGlzIGEgY29ubmVjdGlvblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBhcmdzWzBdID0gaXRlbTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ2FkZEJveCc6XG4gICAgICAgICAgICBhcmdzLnBvcCgpO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIGJyZWFrO1xuICAgIH1cblxufTtcblxuQXV0b1JvdXRlckFjdGlvbkFwcGxpZXIucHJvdG90eXBlLl9maXhQb3J0QXJncyA9IGZ1bmN0aW9uIChwb3J0MSwgcG9ydDIpIHsgLy8ganNoaW50IGlnbm9yZTpsaW5lXG4gICAgdmFyIHBvcnRJZCxcbiAgICAgICAgcG9ydElkcyxcbiAgICAgICAgYXJQb3J0SWQsXG4gICAgICAgIGJveElkLFxuICAgICAgICBwb3J0cztcblxuICAgIGZvciAodmFyIGkgPSBhcmd1bWVudHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHBvcnRzID0gYXJndW1lbnRzW2ldO1xuICAgICAgICBwb3J0SWRzID0gT2JqZWN0LmtleXMocG9ydHMpO1xuICAgICAgICBmb3IgKHZhciBqID0gcG9ydElkcy5sZW5ndGg7IGotLTspIHtcbiAgICAgICAgICAgIHBvcnRJZCA9IHBvcnRJZHNbal07XG4gICAgICAgICAgICBib3hJZCA9IHBvcnRzW3BvcnRJZF07XG5cbiAgICAgICAgICAgIGFyUG9ydElkID0gdGhpcy5hdXRvcm91dGVyLmdldFBvcnRJZChwb3J0SWQsIHRoaXMuX2F1dG9yb3V0ZXJCb3hlc1tib3hJZF0pO1xuICAgICAgICAgICAgcG9ydHNbcG9ydElkXSA9IHRoaXMuX2F1dG9yb3V0ZXJCb3hlc1tib3hJZF0ucG9ydHNbYXJQb3J0SWRdO1xuICAgICAgICAgICAgYXNzZXJ0KHRoaXMuX2F1dG9yb3V0ZXJCb3hlc1tib3hJZF0ucG9ydHNbYXJQb3J0SWRdLCAnQVIgUG9ydCBub3QgZm91bmQhJyk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG4vKipcbiAqIEludm9rZSBhbiBBdXRvUm91dGVyIG1ldGhvZC4gVGhpcyBhbGxvd3MgdGhlIGFjdGlvbiB0byBiZSBsb2dnZWQgYW5kIGJ1Z3MgcmVwbGljYXRlZC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gY29tbWFuZFxuICogQHBhcmFtIHtBcnJheX0gYXJnc1xuICogQHJldHVybiB7dW5kZWZpbmVkfVxuICovXG5BdXRvUm91dGVyQWN0aW9uQXBwbGllci5wcm90b3R5cGUuX2ludm9rZUF1dG9Sb3V0ZXJNZXRob2QgPSBmdW5jdGlvbiAoY29tbWFuZCwgYXJncykge1xuICAgIHRyeSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9pbnZva2VBdXRvUm91dGVyTWV0aG9kVW5zYWZlKGNvbW1hbmQsIGFyZ3MpO1xuXG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICB0aGlzLmxvZ2dlci5lcnJvcignQXV0b1JvdXRlci4nICsgY29tbWFuZCArICcgZmFpbGVkIHdpdGggZXJyb3I6ICcgKyBlKTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyQWN0aW9uQXBwbGllci5wcm90b3R5cGUuX2ludm9rZUF1dG9Sb3V0ZXJNZXRob2RVbnNhZmUgPSBmdW5jdGlvbiAoY29tbWFuZCwgYXJncykge1xuICAgIHZhciByZXN1bHQsXG4gICAgICAgIG9sZEFyZ3MgPSBhcmdzLnNsaWNlKCk7XG5cbiAgICBpZiAodGhpcy5fcmVjb3JkQWN0aW9ucykge1xuICAgICAgICB0aGlzLl9yZWNvcmRBY3Rpb24oY29tbWFuZCwgYXJncy5zbGljZSgpKTtcbiAgICB9XG5cbiAgICAvLyBTb21lIGFyZ3VtZW50cyBhcmUgc2ltcGx5IGlkcyBmb3IgZWFzaWVyIHJlY29yZGluZ1xuICAgIHRoaXMuX2ZpeEFyZ3MoY29tbWFuZCwgYXJncyk7XG5cbiAgICByZXN1bHQgPSB0aGlzLmF1dG9yb3V0ZXJbY29tbWFuZF0uYXBwbHkodGhpcy5hdXRvcm91dGVyLCBhcmdzKTtcbiAgICB0aGlzLl91cGRhdGVSZWNvcmRzKGNvbW1hbmQsIG9sZEFyZ3MsIHJlc3VsdCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbkF1dG9Sb3V0ZXJBY3Rpb25BcHBsaWVyLnByb3RvdHlwZS5fdXBkYXRlUmVjb3JkcyA9IGZ1bmN0aW9uIChjb21tYW5kLCBpbnB1dCwgcmVzdWx0KSB7XG4gICAgYXNzZXJ0IChpbnB1dCBpbnN0YW5jZW9mIEFycmF5KTtcbiAgICB2YXIgaWQsXG4gICAgICAgIGFyZ3MgPSBpbnB1dC5zbGljZSgpLFxuICAgICAgICBpO1xuXG4gICAgc3dpdGNoIChjb21tYW5kKSB7XG4gICAgICAgIGNhc2UgJ2FkZFBhdGgnOlxuICAgICAgICAgICAgaWQgPSBhcmdzLnBvcCgpO1xuICAgICAgICAgICAgdGhpcy5fYXV0b3JvdXRlclBhdGhzW2lkXSA9IHJlc3VsdDtcbiAgICAgICAgICAgIHRoaXMuX2FyUGF0aElkMk9yaWdpbmFsW3Jlc3VsdF0gPSBpZDtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ2FkZEJveCc6XG4gICAgICAgICAgICBpZCA9IGFyZ3MucG9wKCk7XG4gICAgICAgICAgICB0aGlzLl9hdXRvcm91dGVyQm94ZXNbaWRdID0gcmVzdWx0O1xuXG4gICAgICAgICAgICAvLyBBZGQgcG9ydHNcbiAgICAgICAgICAgIHRoaXMuX2F1dG9yb3V0ZXJQb3J0c1tpZF0gPSBbXTtcbiAgICAgICAgICAgIHZhciBpZHMgPSBPYmplY3Qua2V5cyhyZXN1bHQucG9ydHMpO1xuICAgICAgICAgICAgZm9yIChpID0gaWRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICAgICAgICAgIHRoaXMuX2F1dG9yb3V0ZXJQb3J0c1tpZF0ucHVzaChyZXN1bHQucG9ydHNbaWRzW2ldXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICdyZW1vdmUnOlxuICAgICAgICAgICAgaWQgPSBhcmdzWzBdO1xuICAgICAgICAgICAgaWYgKHRoaXMuX2F1dG9yb3V0ZXJCb3hlc1tpZF0pIHtcbiAgICAgICAgICAgICAgICBpID0gdGhpcy5fYXV0b3JvdXRlclBvcnRzW2lkXSA/IHRoaXMuX2F1dG9yb3V0ZXJQb3J0c1tpZF0ubGVuZ3RoIDogMDtcbiAgICAgICAgICAgICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBwb3J0SWQgPSBpZCArIHRoaXMuX3BvcnRTZXBhcmF0b3IgKyB0aGlzLl9hdXRvcm91dGVyUG9ydHNbaWRdW2ldOyAvL0lEIG9mIGNoaWxkIHBvcnRcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2F1dG9yb3V0ZXJCb3hlc1twb3J0SWRdO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9hdXRvcm91dGVyQm94ZXNbaWRdO1xuICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9hdXRvcm91dGVyUG9ydHNbaWRdO1xuXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2F1dG9yb3V0ZXJQYXRoc1tpZF0pIHtcbiAgICAgICAgICAgICAgICB2YXIgYXJJZCA9IHRoaXMuX2F1dG9yb3V0ZXJQYXRoc1tpZF07XG4gICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2F1dG9yb3V0ZXJQYXRoc1tpZF07XG4gICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2FyUGF0aElkMk9yaWdpbmFsW2FySWRdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAnc2V0Q29tcG9uZW50JzpcbiAgICAgICAgICAgIHZhciBsZW4sXG4gICAgICAgICAgICAgICAgc3ViQ29tcElkO1xuXG4gICAgICAgICAgICBpZCA9IGFyZ3NbMF07XG4gICAgICAgICAgICBsZW4gPSBpZC5sZW5ndGggKyB0aGlzLl9wb3J0U2VwYXJhdG9yLmxlbmd0aDtcbiAgICAgICAgICAgIHN1YkNvbXBJZCA9IGFyZ3NbMV0uc3Vic3RyaW5nKGxlbik7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9hdXRvcm91dGVyUG9ydHNbaWRdLmluZGV4T2Yoc3ViQ29tcElkKSA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9hdXRvcm91dGVyUG9ydHNbaWRdLnB1c2goc3ViQ29tcElkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ3VwZGF0ZVBvcnQnOlxuICAgICAgICAgICAgaWQgPSBhcmdzWzFdLmlkO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgfVxufTtcblxuLyoqXG4gKiBBZGQgdGhlIGdpdmVuIGFjdGlvbiB0byB0aGUgY3VycmVudCBzZXF1ZW5jZSBvZiBhdXRvcm91dGVyIGNvbW1hbmRzLlxuICpcbiAqIEBwYXJhbSBvYmpJZFxuICogQHBhcmFtIHN1YkNvbXBJZFxuICogQHJldHVybiB7dW5kZWZpbmVkfVxuICovXG5BdXRvUm91dGVyQWN0aW9uQXBwbGllci5wcm90b3R5cGUuX3JlY29yZEFjdGlvbiA9IGZ1bmN0aW9uIChjb21tYW5kLCBhcmdzKSB7XG5cbiAgICB2YXIgYWN0aW9uID0ge2FjdGlvbjogY29tbWFuZCwgYXJnczogYXJnc30sXG4gICAgICAgIGNpcmN1bGFyRml4ZXIgPSBmdW5jdGlvbiAoa2V5LCB2YWx1ZSkge1xuICAgICAgICAgICAgaWYgKHZhbHVlICYmIHZhbHVlLm93bmVyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHZhbHVlLmlkO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICAgIH07XG5cbiAgICB0aGlzLmRlYnVnQWN0aW9uU2VxdWVuY2UgKz0gSlNPTi5zdHJpbmdpZnkoYWN0aW9uLCBjaXJjdWxhckZpeGVyKSArICcsJztcbn07XG5cbkF1dG9Sb3V0ZXJBY3Rpb25BcHBsaWVyLnByb3RvdHlwZS5fZ2V0QWN0aW9uU2VxdWVuY2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGluZGV4ID0gdGhpcy5kZWJ1Z0FjdGlvblNlcXVlbmNlLmxhc3RJbmRleE9mKCcsJyksXG4gICAgICAgIHJlc3VsdCA9IHRoaXMuZGVidWdBY3Rpb25TZXF1ZW5jZS5zdWJzdHJpbmcoMCwgaW5kZXgpICsgJ10nO1xuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQXV0b1JvdXRlckFjdGlvbkFwcGxpZXI7XG4iLCIvKmpzaGludCBub2RlOiB0cnVlKi9cblxuLyoqXG4gKiBAYXV0aG9yIGJyb2xsYiAvIGh0dHBzOi8vZ2l0aHViL2Jyb2xsYlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIENPTlNUQU5UUyA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Db25zdGFudHMnKSxcbiAgICBVdGlscyA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5VdGlscycpLFxuICAgIGFzc2VydCA9IFV0aWxzLmFzc2VydCxcbiAgICBBclBvaW50ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlBvaW50JyksXG4gICAgQXJSZWN0ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlJlY3QnKSxcbiAgICBBdXRvUm91dGVyUG9ydCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Qb3J0Jyk7XG5cblxudmFyIEF1dG9Sb3V0ZXJCb3ggPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5vd25lciA9IG51bGw7XG4gICAgdGhpcy5yZWN0ID0gbmV3IEFyUmVjdCgpO1xuICAgIHRoaXMuYXRvbWljID0gZmFsc2U7XG4gICAgdGhpcy5zZWxmUG9pbnRzID0gW107XG4gICAgdGhpcy5wb3J0cyA9IFtdO1xuICAgIHRoaXMuY2hpbGRCb3hlcyA9IFtdOy8vZGVwZW5kZW50IGJveGVzXG4gICAgdGhpcy5wYXJlbnQgPSBudWxsO1xuICAgIHRoaXMuaWQgPSBudWxsO1xuXG4gICAgdGhpcy5jYWxjdWxhdGVTZWxmUG9pbnRzKCk7IC8vUGFydCBvZiBpbml0aWFsaXphdGlvblxufTtcblxuQXV0b1JvdXRlckJveC5wcm90b3R5cGUuY2FsY3VsYXRlU2VsZlBvaW50cyA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLnNlbGZQb2ludHMgPSBbXTtcbiAgICB0aGlzLnNlbGZQb2ludHMucHVzaChuZXcgQXJQb2ludCh0aGlzLnJlY3QuZ2V0VG9wTGVmdCgpKSk7XG5cbiAgICB0aGlzLnNlbGZQb2ludHMucHVzaChuZXcgQXJQb2ludCh0aGlzLnJlY3QucmlnaHQsIHRoaXMucmVjdC5jZWlsKSk7XG4gICAgdGhpcy5zZWxmUG9pbnRzLnB1c2gobmV3IEFyUG9pbnQodGhpcy5yZWN0LnJpZ2h0LCB0aGlzLnJlY3QuZmxvb3IpKTtcbiAgICB0aGlzLnNlbGZQb2ludHMucHVzaChuZXcgQXJQb2ludCh0aGlzLnJlY3QubGVmdCwgdGhpcy5yZWN0LmZsb29yKSk7XG59O1xuXG5BdXRvUm91dGVyQm94LnByb3RvdHlwZS5kZWxldGVBbGxQb3J0cyA9IGZ1bmN0aW9uICgpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMucG9ydHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdGhpcy5wb3J0c1tpXS5kZXN0cm95KCk7XG4gICAgfVxuXG4gICAgdGhpcy5wb3J0cyA9IFtdO1xuXG4gICAgdGhpcy5hdG9taWMgPSBmYWxzZTtcbn07XG5cbkF1dG9Sb3V0ZXJCb3gucHJvdG90eXBlLmhhc093bmVyID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLm93bmVyICE9PSBudWxsO1xufTtcblxuLy8gVE9ETzogUmVtb3ZlIHRoaXMgZnVuY3Rpb25cbkF1dG9Sb3V0ZXJCb3gucHJvdG90eXBlLmNyZWF0ZVBvcnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHBvcnQgPSBuZXcgQXV0b1JvdXRlclBvcnQoKTtcbiAgICBhc3NlcnQocG9ydCAhPT0gbnVsbCwgJ0FSQm94LmNyZWF0ZVBvcnQ6IHBvcnQgIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICByZXR1cm4gcG9ydDtcbn07XG5cbkF1dG9Sb3V0ZXJCb3gucHJvdG90eXBlLmhhc05vUG9ydCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5wb3J0cy5sZW5ndGggPT09IDA7XG59O1xuXG5BdXRvUm91dGVyQm94LnByb3RvdHlwZS5pc0F0b21pYyA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5hdG9taWM7XG59O1xuXG5BdXRvUm91dGVyQm94LnByb3RvdHlwZS5hZGRQb3J0ID0gZnVuY3Rpb24gKHBvcnQpIHtcbiAgICBhc3NlcnQocG9ydCAhPT0gbnVsbCwgJ0FSQm94LmFkZFBvcnQ6IHBvcnQgIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICBwb3J0Lm93bmVyID0gdGhpcztcbiAgICB0aGlzLnBvcnRzLnB1c2gocG9ydCk7XG5cbiAgICBpZiAodGhpcy5vd25lcikgeyAgLy8gTm90IHBvaW50aW5nIHRvIHRoZSBBUkdyYXBoXG4gICAgICAgIHRoaXMub3duZXIuX2FkZFBvcnRFZGdlcyhwb3J0KTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyQm94LnByb3RvdHlwZS5kZWxldGVQb3J0ID0gZnVuY3Rpb24gKHBvcnQpIHtcbiAgICBhc3NlcnQocG9ydCAhPT0gbnVsbCwgJ0FSQm94LmRlbGV0ZVBvcnQ6IHBvcnQgIT09IG51bGwgRkFJTEVEJyk7XG4gICAgaWYgKHBvcnQgPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBpbmRleCA9IHRoaXMucG9ydHMuaW5kZXhPZihwb3J0KSxcbiAgICAgICAgZ3JhcGggPSB0aGlzLm93bmVyO1xuXG4gICAgYXNzZXJ0KGluZGV4ICE9PSAtMSwgJ0FSQm94LmRlbGV0ZVBvcnQ6IGluZGV4ICE9PSAtMSBGQUlMRUQnKTtcblxuICAgIGdyYXBoLmRlbGV0ZUVkZ2VzKHBvcnQpO1xuICAgIHRoaXMucG9ydHMuc3BsaWNlKGluZGV4LCAxKTtcblxuICAgIHRoaXMuYXRvbWljID0gZmFsc2U7XG5cbn07XG5cbkF1dG9Sb3V0ZXJCb3gucHJvdG90eXBlLmlzUmVjdEVtcHR5ID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLnJlY3QuaXNSZWN0RW1wdHkoKTtcbn07XG5cbkF1dG9Sb3V0ZXJCb3gucHJvdG90eXBlLnNldFJlY3QgPSBmdW5jdGlvbiAocikge1xuICAgIGFzc2VydChyIGluc3RhbmNlb2YgQXJSZWN0LCAnSW52YWx0aGlzLmlkIGFyZyBpbiBBUkJveC5zZXRSZWN0LiBSZXF1aXJlcyBBclJlY3QnKTtcblxuICAgIGFzc2VydChyLmdldFdpZHRoKCkgPj0gMyAmJiByLmdldEhlaWdodCgpID49IDMsXG4gICAgICAgICdBUkJveC5zZXRSZWN0OiByLmdldFdpZHRoKCkgPj0gMyAmJiByLmdldEhlaWdodCgpID49IDMgRkFJTEVEIScpO1xuXG4gICAgYXNzZXJ0KHIuZ2V0VG9wTGVmdCgpLnggPj0gQ09OU1RBTlRTLkVEX01JTkNPT1JEICYmIHIuZ2V0VG9wTGVmdCgpLnkgPj0gQ09OU1RBTlRTLkVEX01JTkNPT1JELFxuICAgICAgICAnQVJCb3guc2V0UmVjdDogci5nZXRUb3BMZWZ0KCkueCA+PSBDT05TVEFOVFMuRURfTUlOQ09PUkQgJiYgci5nZXRUb3BMZWZ0KCkueSA+PSAnICtcbiAgICAgICAgJ0NPTlNUQU5UUy5FRF9NQVhDT09SRCBGQUlMRUQhJyk7XG5cbiAgICBhc3NlcnQoci5nZXRCb3R0b21SaWdodCgpLnggPD0gQ09OU1RBTlRTLkVEX01BWENPT1JEICYmIHIuZ2V0Qm90dG9tUmlnaHQoKS55IDw9IENPTlNUQU5UUy5FRF9NQVhDT09SRCxcbiAgICAgICAgJ0FSQm94LnNldFJlY3Q6ICByLmdldEJvdHRvbVJpZ2h0KCkueCA8PSBDT05TVEFOVFMuRURfTUFYQ09PUkQgJiYgci5nZXRCb3R0b21SaWdodCgpLnkgPD0gJyArXG4gICAgICAgICdDT05TVEFOVFMuRURfTUFYQ09PUkQgRkFJTEVEIScpO1xuXG4gICAgdGhpcy5yZWN0LmFzc2lnbihyKTtcbiAgICB0aGlzLmNhbGN1bGF0ZVNlbGZQb2ludHMoKTtcblxuICAgIGlmICh0aGlzLmF0b21pYykge1xuICAgICAgICBhc3NlcnQodGhpcy5wb3J0cy5sZW5ndGggPT09IDEsICdBUkJveC5zZXRSZWN0OiB0aGlzLnBvcnRzLmxlbmd0aCA9PT0gMSBGQUlMRUQhJyk7XG4gICAgICAgIHRoaXMucG9ydHNbMF0uc2V0UmVjdChyKTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyQm94LnByb3RvdHlwZS5zaGlmdEJ5ID0gZnVuY3Rpb24gKG9mZnNldCkge1xuICAgIHRoaXMucmVjdC5hZGQob2Zmc2V0KTtcblxuICAgIHZhciBpID0gdGhpcy5wb3J0cy5sZW5ndGg7XG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgICB0aGlzLnBvcnRzW2ldLnNoaWZ0Qnkob2Zmc2V0KTtcbiAgICB9XG5cbiAgICAvKlxuICAgICBUaGlzIGlzIG5vdCBuZWNlc3Nhcnk7IHRoZSBBUkdyYXBoIHdpbGwgc2hpZnQgYWxsIGNoaWxkcmVuXG4gICAgIGkgPSB0aGlzLmNoaWxkQm94ZXMubGVuZ3RoO1xuICAgICB3aGlsZShpLS0pe1xuICAgICB0aGlzLmNoaWxkQm94ZXNbaV0uc2hpZnRCeShvZmZzZXQpO1xuICAgICB9XG4gICAgICovXG4gICAgdGhpcy5jYWxjdWxhdGVTZWxmUG9pbnRzKCk7XG59O1xuXG5BdXRvUm91dGVyQm94LnByb3RvdHlwZS5yZXNldFBvcnRBdmFpbGFiaWxpdHkgPSBmdW5jdGlvbiAoKSB7XG4gICAgZm9yICh2YXIgaSA9IHRoaXMucG9ydHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHRoaXMucG9ydHNbaV0ucmVzZXRBdmFpbGFibGVBcmVhKCk7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckJveC5wcm90b3R5cGUuYWRqdXN0UG9ydEF2YWlsYWJpbGl0eSA9IGZ1bmN0aW9uIChib3gpIHtcbiAgICBpZiAoIWJveC5oYXNBbmNlc3RvcldpdGhJZCh0aGlzLmlkKSAmJiAgIC8vIEJveGVzIGFyZSBub3QgZGVwZW5kZW50IG9uIG9uZSBhbm90aGVyXG4gICAgICAgICF0aGlzLmhhc0FuY2VzdG9yV2l0aElkKGJveC5pZCkpIHtcblxuICAgICAgICBmb3IgKHZhciBpID0gdGhpcy5wb3J0cy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgICAgIHRoaXMucG9ydHNbaV0uYWRqdXN0QXZhaWxhYmxlQXJlYShib3gucmVjdCk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5BdXRvUm91dGVyQm94LnByb3RvdHlwZS5hZGRDaGlsZCA9IGZ1bmN0aW9uIChib3gpIHtcbiAgICBhc3NlcnQodGhpcy5jaGlsZEJveGVzLmluZGV4T2YoYm94KSA9PT0gLTEsXG4gICAgICAgICdBUkJveC5hZGRDaGlsZDogYm94IGFscmVhZHkgaXMgY2hpbGQgb2YgJyArIHRoaXMuaWQpO1xuICAgIGFzc2VydChib3ggaW5zdGFuY2VvZiBBdXRvUm91dGVyQm94LFxuICAgICAgICAnQ2hpbGQgYm94IG11c3QgYmUgb2YgdHlwZSBBdXRvUm91dGVyQm94Jyk7XG5cbiAgICB0aGlzLmNoaWxkQm94ZXMucHVzaChib3gpO1xuICAgIGJveC5wYXJlbnQgPSB0aGlzO1xufTtcblxuQXV0b1JvdXRlckJveC5wcm90b3R5cGUucmVtb3ZlQ2hpbGQgPSBmdW5jdGlvbiAoYm94KSB7XG4gICAgdmFyIGkgPSB0aGlzLmNoaWxkQm94ZXMuaW5kZXhPZihib3gpO1xuICAgIGFzc2VydChpICE9PSAtMSwgJ0FSQm94LnJlbW92ZUNoaWxkOiBib3ggaXNuXFwndCBjaGlsZCBvZiAnICsgdGhpcy5pZCk7XG4gICAgdGhpcy5jaGlsZEJveGVzLnNwbGljZShpLCAxKTtcbiAgICBib3gucGFyZW50ID0gbnVsbDtcbn07XG5cbkF1dG9Sb3V0ZXJCb3gucHJvdG90eXBlLmhhc0FuY2VzdG9yV2l0aElkID0gZnVuY3Rpb24gKGlkKSB7XG4gICAgdmFyIGJveCA9IHRoaXM7XG4gICAgd2hpbGUgKGJveCkge1xuICAgICAgICBpZiAoYm94LmlkID09PSBpZCkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgYm94ID0gYm94LnBhcmVudDtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xufTtcblxuQXV0b1JvdXRlckJveC5wcm90b3R5cGUuZ2V0Um9vdEJveCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgYm94ID0gdGhpcztcbiAgICB3aGlsZSAoYm94LnBhcmVudCkge1xuICAgICAgICBib3ggPSBib3gucGFyZW50O1xuICAgIH1cbiAgICByZXR1cm4gYm94O1xufTtcblxuQXV0b1JvdXRlckJveC5wcm90b3R5cGUuaXNCb3hBdCA9IGZ1bmN0aW9uIChwb2ludCwgbmVhcm5lc3MpIHtcbiAgICByZXR1cm4gVXRpbHMuaXNQb2ludEluKHBvaW50LCB0aGlzLnJlY3QsIG5lYXJuZXNzKTtcbn07XG5cbkF1dG9Sb3V0ZXJCb3gucHJvdG90eXBlLmlzQm94Q2xpcCA9IGZ1bmN0aW9uIChyKSB7XG4gICAgcmV0dXJuIFV0aWxzLmlzUmVjdENsaXAodGhpcy5yZWN0LCByKTtcbn07XG5cbkF1dG9Sb3V0ZXJCb3gucHJvdG90eXBlLmlzQm94SW4gPSBmdW5jdGlvbiAocikge1xuICAgIHJldHVybiBVdGlscy5pc1JlY3RJbih0aGlzLnJlY3QsIHIpO1xufTtcblxuQXV0b1JvdXRlckJveC5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgaSA9IHRoaXMuY2hpbGRCb3hlcy5sZW5ndGg7XG5cbiAgICAvL25vdGlmeSB0aGlzLnBhcmVudCBvZiBkZXN0cnVjdGlvblxuICAgIC8vaWYgdGhlcmUgaXMgYSB0aGlzLnBhcmVudCwgb2YgY291cnNlXG4gICAgaWYgKHRoaXMucGFyZW50KSB7XG4gICAgICAgIHRoaXMucGFyZW50LnJlbW92ZUNoaWxkKHRoaXMpO1xuICAgIH1cblxuICAgIHRoaXMub3duZXIgPSBudWxsO1xuICAgIHRoaXMuZGVsZXRlQWxsUG9ydHMoKTtcblxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgdGhpcy5jaGlsZEJveGVzW2ldLmRlc3Ryb3koKTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyQm94LnByb3RvdHlwZS5hc3NlcnRWYWxpZCA9IGZ1bmN0aW9uICgpIHtcbiAgICBmb3IgKHZhciBwID0gdGhpcy5wb3J0cy5sZW5ndGg7IHAtLTspIHtcbiAgICAgICAgdGhpcy5wb3J0c1twXS5hc3NlcnRWYWxpZCgpO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQXV0b1JvdXRlckJveDtcbiIsIi8qanNoaW50IG5vZGU6IHRydWUsIGJpdHdpc2U6IGZhbHNlKi9cblxuLyoqXG4gKiBAYXV0aG9yIGJyb2xsYiAvIGh0dHBzOi8vZ2l0aHViL2Jyb2xsYlxuICovXG5cbid1c2Ugc3RyaWN0JztcbnZhciBBclBvaW50ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlBvaW50Jyk7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIEVNUFRZX1BPSU5UOiBuZXcgQXJQb2ludCgtMTAwMDAwLCAtMTAwMDAwKSxcbiAgICBFRF9NQVhDT09SRDogMTAwMDAwLFxuICAgIEVEX01JTkNPT1JEOiAtMiwvL1RoaXMgYWxsb3dzIGNvbm5lY3Rpb25zIHRvIGJlIHN0aWxsIGJlIGRyYXcgd2hlbiBib3ggaXMgcHJlc3NlZCBhZ2FpbnN0IHRoZSBlZGdlXG4gICAgRURfU01BTExHQVA6IDE1LFxuICAgIENPTk5FQ1RJT05DVVNUT01JWkFUSU9OREFUQVZFUlNJT046IDAsXG4gICAgRU1QVFlDT05ORUNUSU9OQ1VTVE9NSVpBVElPTkRBVEFNQUdJQzogLTEsXG4gICAgREVCVUc6IGZhbHNlLFxuICAgIEJVRkZFUjogMTAsXG5cbiAgICBFRExTX1M6IDE1LC8vRURfU01BTExHQVBcbiAgICBFRExTX1I6IDE1ICsgMSwgLy9FRF9TTUFMTEdBUCsxXG4gICAgRURMU19EOiAxMDAwMDAgKyAyLC8vRURfTUFYQ09PUkQgLSBFRF9NSU5DT09SRCxcblxuICAgIFBhdGhFbmRPbkRlZmF1bHQ6IDB4MDAwMCxcbiAgICBQYXRoRW5kT25Ub3A6IDB4MDAxMCxcbiAgICBQYXRoRW5kT25SaWdodDogMHgwMDIwLFxuICAgIFBhdGhFbmRPbkJvdHRvbTogMHgwMDQwLFxuICAgIFBhdGhFbmRPbkxlZnQ6IDB4MDA4MCxcbiAgICBQYXRoRW5kTWFzazogKDB4MDAxMCB8IDB4MDAyMCB8IDB4MDA0MCB8IDB4MDA4MCksXG4gICAgLy8gKFBhdGhFbmRPblRvcCB8IFBhdGhFbmRPblJpZ2h0IHwgUGF0aEVuZE9uQm90dG9tIHwgUGF0aEVuZE9uTGVmdCksXG5cbiAgICBQYXRoU3RhcnRPbkRlZmF1bHQ6IDB4MDAwMCxcbiAgICBQYXRoU3RhcnRPblRvcDogMHgwMTAwLFxuICAgIFBhdGhTdGFydE9uUmlnaHQ6IDB4MDIwMCxcbiAgICBQYXRoU3RhcnRPbkJvdHRvbTogMHgwNDAwLFxuICAgIFBhdGhTdGFydE9uTGVmdDogMHgwODAwLFxuICAgIFBhdGhTdGFydE1hc2s6ICgweDAxMDAgfCAweDAyMDAgfCAweDA0MDAgfCAweDA4MDApLFxuICAgIC8vIChQYXRoU3RhcnRPblRvcCB8IFBhdGhTdGFydE9uUmlnaHQgfCBQYXRoU3RhcnRPbkJvdHRvbSB8IFBhdGhTdGFydE9uTGVmdCksXG5cbiAgICBQYXRoSGlnaExpZ2h0ZWQ6IDB4MDAwMixcdFx0Ly8gYXR0cmlidXRlcyxcbiAgICBQYXRoRml4ZWQ6IDB4MDAwMSxcbiAgICBQYXRoRGVmYXVsdDogMHgwMDAwLFxuXG4gICAgUGF0aFN0YXRlQ29ubmVjdGVkOiAweDAwMDEsXHRcdC8vIHN0YXRlcyxcbiAgICBQYXRoU3RhdGVEZWZhdWx0OiAweDAwMDAsXG5cbiAgICAvLyBQb3J0IENvbm5lY3Rpb24gVmFyaWFibGVzXG4gICAgUG9ydEVuZE9uVG9wOiAweDAwMDEsXG4gICAgUG9ydEVuZE9uUmlnaHQ6IDB4MDAwMixcbiAgICBQb3J0RW5kT25Cb3R0b206IDB4MDAwNCxcbiAgICBQb3J0RW5kT25MZWZ0OiAweDAwMDgsXG4gICAgUG9ydEVuZE9uQWxsOiAweDAwMEYsXG5cbiAgICBQb3J0U3RhcnRPblRvcDogMHgwMDEwLFxuICAgIFBvcnRTdGFydE9uUmlnaHQ6IDB4MDAyMCxcbiAgICBQb3J0U3RhcnRPbkJvdHRvbTogMHgwMDQwLFxuICAgIFBvcnRTdGFydE9uTGVmdDogMHgwMDgwLFxuICAgIFBvcnRTdGFydE9uQWxsOiAweDAwRjAsXG5cbiAgICBQb3J0Q29ubmVjdE9uQWxsOiAweDAwRkYsXG4gICAgUG9ydENvbm5lY3RUb0NlbnRlcjogMHgwMTAwLFxuXG4gICAgUG9ydFN0YXJ0RW5kSG9yaXpvbnRhbDogMHgwMEFBLFxuICAgIFBvcnRTdGFydEVuZFZlcnRpY2FsOiAweDAwNTUsXG5cbiAgICBQb3J0RGVmYXVsdDogMHgwMEZGLFxuXG4gICAgLy8gUm91dGluZ0RpcmVjdGlvbiB2YXJzIFxuICAgIERpck5vbmU6IC0xLFxuICAgIERpclRvcDogMCxcbiAgICBEaXJSaWdodDogMSxcbiAgICBEaXJCb3R0b206IDIsXG4gICAgRGlyTGVmdDogMyxcbiAgICBEaXJTa2V3OiA0LFxuXG4gICAgLy9QYXRoIEN1c3RvbSBEYXRhXG4gICAgU2ltcGxlRWRnZURpc3BsYWNlbWVudDogJ0VkZ2VEaXNwbGFjZW1lbnQnLFxuICAgIEN1c3RvbVBvaW50Q3VzdG9taXphdGlvbjogJ1BvaW50Q3VzdG9taXphdGlvbidcbiAgICAvL0NPTk5FQ1RJT05DVVNUT01JWkFUSU9OREFUQVZFUlNJT04gOiBudWxsXG59O1xuIiwiLypnbG9iYWxzIGRlZmluZSovXG4vKmpzaGludCBub2RlOiB0cnVlKi9cblxuLyoqXG4gKiBAYXV0aG9yIGJyb2xsYiAvIGh0dHBzOi8vZ2l0aHViL2Jyb2xsYlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIENPTlNUQU5UUyA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Db25zdGFudHMnKSxcbiAgICBVdGlscyA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5VdGlscycpLFxuICAgIGFzc2VydCA9IFV0aWxzLmFzc2VydCxcbiAgICBBclBvaW50ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlBvaW50Jyk7XG5cbnZhciBBdXRvUm91dGVyRWRnZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAvKlxuICAgICBJbiB0aGlzIHNlY3Rpb24gZXZlcnkgY29tbWVudCByZWZlciB0byB0aGUgaG9yaXpvbnRhbCBjYXNlLCB0aGF0IGlzLCBlYWNoXHRlZGdlIGlzXG4gICAgIGhvcml6b250YWwuXG4gICAgICovXG5cbiAgICAvKlxuICAgICAqIFRPRE8gVXBkYXRlIHRoaXMgY29tbWVudFxuICAgICAqXG4gICAgIEV2ZXJ5IENBdXRvUm91dGVyRWRnZSBiZWxvbmdzIHRvIGFuIGVkZ2Ugb2YgYSBDQXV0b1JvdXRlclBhdGgsIENBdXRvUm91dGVyQm94IG9yIENBdXRvUm91dGVyUG9ydC4gVGhpcyBlZGdlIGlzXG4gICAgIFJlcHJlc2VudGVkIGJ5IGEgQ0F1dG9Sb3V0ZXJQb2ludCB3aXRoIGl0cyBuZXh0IHBvaW50LiBUaGUgdmFyaWFibGUgJ3BvaW50JyB3aWxsIHJlZmVyXG4gICAgIHRvIHRoaXMgQ0F1dG9Sb3V0ZXJQb2ludC5cblxuICAgICBUaGUgY29vcmRpbmF0ZXMgb2YgYW4gZWRnZSBhcmUgJ3gxJywgJ3gyJyBhbmQgJ3knIHdoZXJlIHgxL3gyIGlzIHRoZSB4LWNvb3JkaW5hdGVcbiAgICAgb2YgdGhlIGxlZnQvcmlnaHQgcG9pbnQsIGFuZCB5IGlzIHRoZSBjb21tb24geS1jb29yZGluYXRlIG9mIHRoZSBwb2ludHMuXG5cbiAgICAgVGhlIGVkZ2VzIGFyZSBvcmRlcmVkIGFjY29yZGluZyB0byB0aGVpciB5LWNvb3JkaW5hdGVzLiBUaGUgZmlyc3QgZWRnZSBoYXNcbiAgICAgdGhlIGxlYXN0IHktY29vcmRpbmF0ZSAodG9wbW9zdCksIGFuZCBpdHMgcG9pbnRlciBpcyBpbiAnb3JkZXJGaXJzdCcuXG4gICAgIFdlIHVzZSB0aGUgJ29yZGVyJyBwcmVmaXggaW4gdGhlIHZhcmlhYmxlIG5hbWVzIHRvIHJlZmVyIHRvIHRoaXMgb3JkZXIuXG5cbiAgICAgV2Ugd2lsbCB3YWxrIGZyb20gdG9wIHRvIGJvdHRvbSAoZnJvbSB0aGUgJ29yZGVyRmlyc3QnIGFsb25nIHRoZSAndGhpcy5vcmRlck5leHQnKS5cbiAgICAgV2Uga2VlcCB0cmFjayBhICdzZWN0aW9uJyBvZiBzb21lIGVkZ2VzLiBJZiB3ZSBoYXZlIGFuIGluZmluaXRlIGhvcml6b250YWwgbGluZSxcbiAgICAgdGhlbiB0aGUgc2VjdGlvbiBjb25zaXN0cyBvZiB0aG9zZSBlZGdlcyB0aGF0IGFyZSBhYm92ZSB0aGUgbGluZSBhbmQgbm90IGJsb2NrZWRcbiAgICAgYnkgYW5vdGhlciBlZGdlIHdoaWNoIGlzIGNsb3NlciB0byB0aGUgbGluZS4gRWFjaCBlZGdlIGluIHRoZSBzZWN0aW9uIGhhc1xuICAgICBhIHZpZXdhYmxlIHBvcnRpb24gZnJvbSB0aGUgbGluZSAodGhlIG5vdCBibG9ja2VkIHBvcnRpb24pLiBUaGUgY29vcmRpbmF0ZXNcbiAgICAgb2YgdGhpcyBwb3J0aW9uIGFyZSAndGhpcy5zZWN0aW9uWDEnIGFuZCAndGhpcy5zZWN0aW9uWDInLiBXZSBoYXZlIGFuIG9yZGVyIG9mIHRoZSBlZGdlc1xuICAgICBiZWxvbmdpbmcgdG8gdGhlIGN1cnJlbnQgc2VjdGlvbi4gVGhlICdzZWN0aW9uX2ZpcnN0JyByZWZlcnMgdG8gdGhlIGxlZnRtb3N0XG4gICAgIGVkZ2UgaW4gdGhlIHNlY3Rpb24sIHdoaWxlIHRoZSAndGhpcy5zZWN0aW9uTmV4dCcgdG8gdGhlIG5leHQgZnJvbSBsZWZ0IHRvIHJpZ2h0LlxuXG4gICAgIFdlIHNheSB0aGF0IHRoZSBDQXV0b1JvdXRlckVkZ2UgRTEgJ3ByZWNlZGUnIHRoZSBDQXV0b1JvdXRlckVkZ2UgRTIgaWYgdGhlcmUgaXMgbm8gb3RoZXIgQ0F1dG9Sb3V0ZXJFZGdlIHdoaWNoXG4gICAgIHRvdGFsbHlcdGJsb2NrcyBTMSBmcm9tIFMyLiBTbyBhIHNlY3Rpb24gY29uc2lzdHMgb2YgdGhlIHByZWNlZGluZyBlZGdlcyBvZiBhblxuICAgICBpbmZpbml0ZSBlZGdlLiBXZSBzYXkgdGhhdCBFMSBpcyAnYWRqYWNlbnQnIHRvIEUyLCBpZiBFMSBpcyB0aGUgbmVhcmVzdCBlZGdlXG4gICAgIHRvIEUyIHdoaWNoIHByZWNlZGUgaXQuIENsZWFybHksIGV2ZXJ5IGVkZ2UgaGFzIGF0IG1vc3Qgb25lIGFkamFjZW50IHByZWNlZGVuY2UuXG5cbiAgICAgVGhlIGVkZ2VzIG9mIGFueSBDQXV0b1JvdXRlckJveCBvciBDQXV0b1JvdXRlclBvcnQgYXJlIGZpeGVkLiBXZSB3aWxsIGNvbnRpbnVhbGx5IGZpeCB0aGUgZWRnZXNcbiAgICAgb2YgdGhlIENBdXRvUm91dGVyUGF0aHMuIEJ1dCBmaXJzdCB3ZSBuZWVkIHNvbWUgZGVmaW5pdGlvbi5cblxuICAgICBXZSBjYWxsIGEgc2V0IG9mIGVkZ2VzIGFzIGEgJ2Jsb2NrJyBpZiB0aGUgdG9wbW9zdCAoZmlyc3QpIGFuZCBib3R0b21tb3N0IChsYXN0KVxuICAgICBlZGdlcyBvZiBpdCBhcmUgZml4ZWQgd2hpbGUgdGhlIGVkZ2VzIGJldHdlZW4gdGhlbSBhcmUgbm90LiBGdXJ0aGVybW9yZSwgZXZlcnlcbiAgICAgZWRnZSBpcyBhZGphY2VudCB0b1x0dGhlIG5leHQgb25lIGluIHRoZSBvcmRlci4gRXZlcnkgZWRnZSBpbiB0aGUgYmxvY2sgaGFzIGFuXG4gICAgICdpbmRleCcuIFRoZSBpbmRleCBvZiB0aGUgZmlyc3Qgb25lICh0b3Btb3N0KSBpcyAwLCBvZiB0aGUgc2Vjb25kIGlzIDEsIGFuZCBzbyBvbi5cbiAgICAgV2UgY2FsbCB0aGUgaW5kZXggb2YgdGhlIGxhc3QgZWRnZSAoIyBvZiBlZGdlcyAtIDEpIGFzIHRoZSBpbmRleCBvZiB0aGUgZW50aXJlIGJveC5cbiAgICAgVGhlICdkZXB0aCcgb2YgYSBibG9jayBpcyB0aGUgZGlmZmVyZW5jZSBvZiB0aGUgeS1jb29yZGluYXRlcyBvZiB0aGUgZmlyc3QgYW5kIGxhc3RcbiAgICAgZWRnZXMgb2YgaXQuIFRoZSAnZ29hbCBnYXAnIG9mIHRoZSBibG9jayBpcyB0aGUgcXVvdGllbnQgb2YgdGhlIGRlcHRoIGFuZCBpbmRleFxuICAgICBvZiB0aGUgYmxvY2suIElmIHRoZSBkaWZmZXJlbmNlIG9mIHRoZSB5LWNvb3JkaW5hdGVzIG9mIHRoZSBhZGphY2VudCBlZGdlcyBpblxuICAgICB0aGUgYmxvY2sgYXJlIGFsbCBlcXVhbCB0byB0aGUgZ29hbCBnYXAsIHRoZW4gd2Ugc2F5IHRoYXQgdGhlIGJsb2NrIGlzIGV2ZW5seVxuICAgICBkaXN0cmlidXRlZC5cblxuICAgICBTbyB3ZSBzZWFyY2ggdGhlIGJsb2NrIHdoaWNoIGhhcyBtaW5pbWFsIGdvYWwgZ2FwLiBUaGVuIGlmIGl0IGlzIG5vdCBldmVubHlcbiAgICAgZGlzdHJpYnV0ZWQsIHRoZW4gd2Ugc2hpZnQgdGhlIG5vdCBmaXhlZCBlZGdlcyB0byB0aGUgZGVzaXJlZCBwb3NpdGlvbi4gSXQgaXNcbiAgICAgbm90IGhhcmQgdG8gc2VlXHR0aGF0IGlmIHRoZSBibG9jayBoYXMgbWluaW1hbCBnb2FsIGdhcCAoYW1vbmcgdGhlIGFsbFxuICAgICBwb3NzaWJpbGl0aWVzIG9mIGJsb2NrcyksIHRoZW4gaW4gdGhpcyB3YXkgd2UgZG8gbm90IG1vdmUgYW55IGVkZ2VzIGludG8gYm94ZXMuXG4gICAgIEZpbmFsbHksIHdlIHNldCB0aGUgKGlubmVyKSBlZGdlcyBvZiB0aGUgYmxvY2sgdG8gYmUgZml4ZWQgKGV4Y2VwdCB0aGUgdG9wbW9zdCBhbmRcbiAgICAgYm90dG9tbW9zdCBlZGdlcywgc2luY2UgdGhleSBhcmUgYWxyZWFkeSBmaXhlZCkuIEFuZCB3ZSBhZ2FpbiBiZWdpbiB0aGUgc2VhcmNoLlxuICAgICBJZiBldmVyeSBlZGdlIGlzIGZpeGVkLCB0aGVuIHdlIGhhdmUgZmluaXNoZWQuIFRoaXMgaXMgdGhlIGJhc2ljIGlkZWEuIFdlIHdpbGxcbiAgICAgcmVmaW5lIHRoaXMgYWxnb3JpdGhtLlxuXG4gICAgIFRoZSB2YXJpYWJsZXMgcmVsYXRlZCB0byB0aGUgYmxvY2tzIGFyZSBwcmVmaXhlZCBieSAnYmxvY2snLiBOb3RlIHRoYXQgdGhlXG4gICAgIHZhcmlhYmxlcyBvZiBhbiBlZGdlIGFyZSByZWZlciB0byB0aGF0IGJsb2NrIGluIHdoaWNoIHRoaXMgZWRnZSBpcyBpbm5lciEgVGhlXG4gICAgICdibG9ja19vbGRnYXAnIGlzIHRoZSBnb2FsIGdhcCBvZiB0aGUgYmxvY2sgd2hlbiBpdCB3YXMgbGFzdCBldmVubHkgZGlzdHJpYnV0ZWQuXG5cbiAgICAgVGhlIHZhcmlhYmxlcyAnY2Fuc3RhcnQnIGFuZCAnY2FuZW5kJyBtZWFucyB0aGF0IHRoaXMgZWdkZSBjYW4gc3RhcnQgYW5kL29yIGVuZFxuICAgICBhIGJsb2NrLiBUaGUgdG9wIGVkZ2Ugb2YgYSBib3ggb25seSBjYW5lbmQsIHdoaWxlIGEgZml4ZWQgZWRnZSBvZiBhIHBhdGggY2FuIGJvdGhcbiAgICAgc3RhcnQgYW5kIGVuZCBvZiBhIGJsb2NrLlxuXG4gICAgICovXG5cbiAgICB0aGlzLm93bmVyID0gbnVsbDtcbiAgICB0aGlzLnN0YXJ0cG9pbnRQcmV2ID0gbnVsbDtcbiAgICB0aGlzLnN0YXJ0cG9pbnQgPSBudWxsO1xuICAgIHRoaXMuZW5kcG9pbnQgPSBudWxsO1xuICAgIHRoaXMuZW5kcG9pbnROZXh0ID0gbnVsbDtcblxuICAgIHRoaXMucG9zaXRpb25ZID0gMDtcbiAgICB0aGlzLnBvc2l0aW9uWDEgPSAwO1xuICAgIHRoaXMucG9zaXRpb25YMiA9IDA7XG4gICAgdGhpcy5icmFja2V0Q2xvc2luZyA9IGZhbHNlO1xuICAgIHRoaXMuYnJhY2tldE9wZW5pbmcgPSBmYWxzZTtcblxuICAgIHRoaXMub3JkZXJQcmV2ID0gbnVsbDtcbiAgICB0aGlzLm9yZGVyTmV4dCA9IG51bGw7XG5cbiAgICB0aGlzLnNlY3Rpb25YMSA9IG51bGw7XG4gICAgdGhpcy5zZWN0aW9uWDIgPSBudWxsO1xuICAgIHRoaXMuc2VjdGlvbk5leHQgPSBudWxsO1xuICAgIHRoaXMuc2VjdGlvbkRvd24gPSBudWxsO1xuXG4gICAgdGhpcy5lZGdlRml4ZWQgPSBmYWxzZTtcbiAgICB0aGlzLmVkZ2VDdXN0b21GaXhlZCA9IGZhbHNlO1xuICAgIHRoaXMuZWRnZUNhblBhc3NlZCA9IGZhbHNlO1xuICAgIHRoaXMuZWRnZURpcmVjdGlvbiA9IG51bGw7XG5cbiAgICB0aGlzLmJsb2NrUHJldiA9IG51bGw7XG4gICAgdGhpcy5ibG9ja05leHQgPSBudWxsO1xuICAgIHRoaXMuYmxvY2tUcmFjZSA9IG51bGw7XG5cbiAgICB0aGlzLmNsb3Nlc3RQcmV2ID0gbnVsbDtcbiAgICB0aGlzLmNsb3Nlc3ROZXh0ID0gbnVsbDtcblxufTtcblxuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuYXNzaWduID0gZnVuY3Rpb24gKG90aGVyRWRnZSkge1xuXG4gICAgaWYgKG90aGVyRWRnZSAhPT0gbnVsbCkge1xuICAgICAgICB0aGlzLm93bmVyID0gb3RoZXJFZGdlLm93bmVyO1xuICAgICAgICB0aGlzLnNldFN0YXJ0UG9pbnQob3RoZXJFZGdlLnN0YXJ0cG9pbnQsIGZhbHNlKTtcblxuICAgICAgICAvL09ubHkgY2FsY3VsYXRlRGlyZWN0aW9uIGlmIHRoaXMuZW5kcG9pbnQgaXMgbm90IG51bGxcbiAgICAgICAgdGhpcy5zZXRFbmRQb2ludChvdGhlckVkZ2UuZW5kcG9pbnQsIG90aGVyRWRnZS5lbmRwb2ludCAhPT0gbnVsbCk7XG5cbiAgICAgICAgdGhpcy5zdGFydHBvaW50UHJldiA9IG90aGVyRWRnZS5zdGFydHBvaW50UHJldjtcbiAgICAgICAgdGhpcy5lbmRwb2ludE5leHQgPSBvdGhlckVkZ2UuZW5kcG9pbnROZXh0O1xuXG4gICAgICAgIHRoaXMucG9zaXRpb25ZID0gb3RoZXJFZGdlLnBvc2l0aW9uWTtcbiAgICAgICAgdGhpcy5wb3NpdGlvblgxID0gb3RoZXJFZGdlLnBvc2l0aW9uWDE7XG4gICAgICAgIHRoaXMucG9zaXRpb25YMiA9IG90aGVyRWRnZS5wb3NpdGlvblgyO1xuICAgICAgICB0aGlzLmJyYWNrZXRDbG9zaW5nID0gb3RoZXJFZGdlLmJyYWNrZXRDbG9zaW5nO1xuICAgICAgICB0aGlzLmJyYWNrZXRPcGVuaW5nID0gb3RoZXJFZGdlLmJyYWNrZXRPcGVuaW5nO1xuXG4gICAgICAgIHRoaXMub3JkZXJOZXh0ID0gb3RoZXJFZGdlLm9yZGVyTmV4dDtcbiAgICAgICAgdGhpcy5vcmRlclByZXYgPSBvdGhlckVkZ2Uub3JkZXJQcmV2O1xuXG4gICAgICAgIHRoaXMuc2VjdGlvblgxID0gb3RoZXJFZGdlLnNlY3Rpb25YMTtcbiAgICAgICAgdGhpcy5zZWN0aW9uWDIgPSBvdGhlckVkZ2Uuc2VjdGlvblgyO1xuICAgICAgICB0aGlzLnNldFNlY3Rpb25OZXh0KG90aGVyRWRnZS5nZXRTZWN0aW9uTmV4dCh0cnVlKSk7XG4gICAgICAgIHRoaXMuc2V0U2VjdGlvbkRvd24ob3RoZXJFZGdlLmdldFNlY3Rpb25Eb3duKHRydWUpKTtcblxuICAgICAgICB0aGlzLmVkZ2VGaXhlZCA9IG90aGVyRWRnZS5lZGdlRml4ZWQ7XG4gICAgICAgIHRoaXMuZWRnZUN1c3RvbUZpeGVkID0gb3RoZXJFZGdlLmVkZ2VDdXN0b21GaXhlZDtcbiAgICAgICAgdGhpcy5zZXRFZGdlQ2FucGFzc2VkKG90aGVyRWRnZS5nZXRFZGdlQ2FucGFzc2VkKCkpO1xuICAgICAgICB0aGlzLnNldERpcmVjdGlvbihvdGhlckVkZ2UuZ2V0RGlyZWN0aW9uKCkpO1xuXG4gICAgICAgIHRoaXMuc2V0QmxvY2tQcmV2KG90aGVyRWRnZS5nZXRCbG9ja1ByZXYoKSk7XG4gICAgICAgIHRoaXMuc2V0QmxvY2tOZXh0KG90aGVyRWRnZS5nZXRCbG9ja05leHQoKSk7XG4gICAgICAgIHRoaXMuc2V0QmxvY2tUcmFjZShvdGhlckVkZ2UuZ2V0QmxvY2tUcmFjZSgpKTtcblxuICAgICAgICB0aGlzLnNldENsb3Nlc3RQcmV2KG90aGVyRWRnZS5nZXRDbG9zZXN0UHJldigpKTtcbiAgICAgICAgdGhpcy5zZXRDbG9zZXN0TmV4dChvdGhlckVkZ2UuZ2V0Q2xvc2VzdE5leHQoKSk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuZXF1YWxzID0gZnVuY3Rpb24gKG90aGVyRWRnZSkge1xuICAgIHJldHVybiB0aGlzID09PSBvdGhlckVkZ2U7IC8vIFRoaXMgY2hlY2tzIGlmIHRoZXkgcmVmZXJlbmNlIHRoZSBzYW1lIG9iamVjdFxufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLmdldFN0YXJ0UG9pbnRQcmV2ID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLnN0YXJ0cG9pbnRQcmV2ICE9PSBudWxsID8gdGhpcy5zdGFydHBvaW50UHJldiB8fCB0aGlzLnN0YXJ0cG9pbnRQcmV2IDogbnVsbDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5pc1N0YXJ0UG9pbnRQcmV2TnVsbCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gIXRoaXMuc3RhcnRwb2ludFByZXY7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuZ2V0U3RhcnRQb2ludCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5zdGFydHBvaW50ICE9PSBudWxsID9cbiAgICAgICAgKHRoaXMuc3RhcnRwb2ludCBpbnN0YW5jZW9mIEFycmF5ID8gbmV3IEFyUG9pbnQodGhpcy5zdGFydHBvaW50KSA6IG5ldyBBclBvaW50KHRoaXMuc3RhcnRwb2ludCkpIDpcbiAgICAgICAgQ09OU1RBTlRTLkVNUFRZX1BPSU5UOyAgLy8gcmV0dXJuaW5nIGNvcHkgb2YgdGhpcy5zdGFydHBvaW50XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuaXNTYW1lU3RhcnRQb2ludCA9IGZ1bmN0aW9uIChwb2ludCkge1xuICAgIHJldHVybiB0aGlzLnN0YXJ0cG9pbnQgPT09IHBvaW50O1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLmlzU3RhcnRQb2ludE51bGwgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RhcnRwb2ludCA9PT0gbnVsbDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5zZXRTdGFydFBvaW50ID0gZnVuY3Rpb24gKHBvaW50LCBiKSB7XG4gICAgdGhpcy5zdGFydHBvaW50ID0gcG9pbnQ7XG5cbiAgICBpZiAoYiAhPT0gZmFsc2UpIHtcbiAgICAgICAgdGhpcy5yZWNhbGN1bGF0ZURpcmVjdGlvbigpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5zZXRTdGFydFBvaW50WCA9IGZ1bmN0aW9uIChfeCkge1xuICAgIHRoaXMuc3RhcnRwb2ludC54ID0gX3g7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuc2V0U3RhcnRQb2ludFkgPSBmdW5jdGlvbiAoX3kpIHtcbiAgICB0aGlzLnN0YXJ0cG9pbnQueSA9IF95O1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLmdldEVuZFBvaW50ID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmVuZHBvaW50ICE9PSBudWxsID9cbiAgICAgICAgKHRoaXMuZW5kcG9pbnQgaW5zdGFuY2VvZiBBcnJheSA/XG4gICAgICAgICAgICBuZXcgQXJQb2ludCh0aGlzLmVuZHBvaW50KSA6XG4gICAgICAgICAgICBuZXcgQXJQb2ludCh0aGlzLmVuZHBvaW50KSkgOlxuICAgICAgICBDT05TVEFOVFMuRU1QVFlfUE9JTlQ7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuaXNFbmRQb2ludE51bGwgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuZW5kcG9pbnQgPT09IG51bGw7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuc2V0RW5kUG9pbnQgPSBmdW5jdGlvbiAocG9pbnQsIGIpIHtcbiAgICB0aGlzLmVuZHBvaW50ID0gcG9pbnQ7XG5cbiAgICBpZiAoYiAhPT0gZmFsc2UpIHtcbiAgICAgICAgdGhpcy5yZWNhbGN1bGF0ZURpcmVjdGlvbigpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5zZXRTdGFydEFuZEVuZFBvaW50ID0gZnVuY3Rpb24gKHN0YXJ0UG9pbnQsIGVuZFBvaW50KSB7XG4gICAgdGhpcy5zZXRTdGFydFBvaW50KHN0YXJ0UG9pbnQsIGZhbHNlKTsgLy93YWl0IHVudGlsIHNldHRpbmcgdGhlIHRoaXMuZW5kcG9pbnQgdG8gcmVjYWxjdWxhdGVEaXJlY3Rpb25cbiAgICB0aGlzLnNldEVuZFBvaW50KGVuZFBvaW50KTtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5zZXRFbmRQb2ludFggPSBmdW5jdGlvbiAoX3gpIHtcbiAgICB0aGlzLmVuZHBvaW50LnggPSBfeDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5zZXRFbmRQb2ludFkgPSBmdW5jdGlvbiAoX3kpIHtcbiAgICB0aGlzLmVuZHBvaW50LnkgPSBfeTtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5pc0VuZFBvaW50TmV4dE51bGwgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuICF0aGlzLmVuZHBvaW50TmV4dDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5nZXRTZWN0aW9uTmV4dCA9IGZ1bmN0aW9uICgpIHtcblxuICAgIHJldHVybiB0aGlzLnNlY3Rpb25OZXh0ICE9PSB1bmRlZmluZWQgPyB0aGlzLnNlY3Rpb25OZXh0WzBdIDogbnVsbDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5nZXRTZWN0aW9uTmV4dFB0ciA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoIXRoaXMuc2VjdGlvbk5leHQgfHwgIXRoaXMuc2VjdGlvbk5leHRbMF0pIHtcbiAgICAgICAgdGhpcy5zZWN0aW9uTmV4dCA9IFtuZXcgQXV0b1JvdXRlckVkZ2UoKV07XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnNlY3Rpb25OZXh0O1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLnNldFNlY3Rpb25OZXh0ID0gZnVuY3Rpb24gKG5leHRTZWN0aW9uKSB7XG4gICAgbmV4dFNlY3Rpb24gPSBuZXh0U2VjdGlvbiBpbnN0YW5jZW9mIEFycmF5ID8gbmV4dFNlY3Rpb25bMF0gOiBuZXh0U2VjdGlvbjtcbiAgICBpZiAodGhpcy5zZWN0aW9uTmV4dCBpbnN0YW5jZW9mIEFycmF5KSB7XG4gICAgICAgIHRoaXMuc2VjdGlvbk5leHRbMF0gPSBuZXh0U2VjdGlvbjtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnNlY3Rpb25OZXh0ID0gW25leHRTZWN0aW9uXTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuZ2V0U2VjdGlvbkRvd24gPSBmdW5jdGlvbiAoKSB7IC8vUmV0dXJucyBwb2ludGVyIC0gaWYgbm90IG51bGxcblxuICAgIHJldHVybiB0aGlzLnNlY3Rpb25Eb3duICE9PSB1bmRlZmluZWQgPyB0aGlzLnNlY3Rpb25Eb3duWzBdIDogbnVsbDtcblxufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLmdldFNlY3Rpb25Eb3duUHRyID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICghdGhpcy5zZWN0aW9uRG93biB8fCAhdGhpcy5zZWN0aW9uRG93blswXSkge1xuICAgICAgICB0aGlzLnNlY3Rpb25Eb3duID0gW25ldyBBdXRvUm91dGVyRWRnZSgpXTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuc2VjdGlvbkRvd247XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuc2V0U2VjdGlvbkRvd24gPSBmdW5jdGlvbiAoZG93blNlY3Rpb24pIHtcbiAgICBkb3duU2VjdGlvbiA9IGRvd25TZWN0aW9uIGluc3RhbmNlb2YgQXJyYXkgPyBkb3duU2VjdGlvblswXSA6IGRvd25TZWN0aW9uO1xuICAgIGlmICh0aGlzLnNlY3Rpb25Eb3duIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgICAgdGhpcy5zZWN0aW9uRG93blswXSA9IGRvd25TZWN0aW9uO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuc2VjdGlvbkRvd24gPSBbZG93blNlY3Rpb25dO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5nZXRFZGdlQ2FucGFzc2VkID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmVkZ2VDYW5QYXNzZWQ7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuc2V0RWRnZUNhbnBhc3NlZCA9IGZ1bmN0aW9uIChlY3ApIHtcbiAgICB0aGlzLmVkZ2VDYW5QYXNzZWQgPSBlY3A7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuZ2V0RGlyZWN0aW9uID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmVkZ2VEaXJlY3Rpb247XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuc2V0RGlyZWN0aW9uID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRoaXMuZWRnZURpcmVjdGlvbiA9IGRpcjtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5yZWNhbGN1bGF0ZURpcmVjdGlvbiA9IGZ1bmN0aW9uICgpIHtcbiAgICBhc3NlcnQodGhpcy5zdGFydHBvaW50ICE9PSBudWxsICYmIHRoaXMuZW5kcG9pbnQgIT09IG51bGwsXG4gICAgICAgICdBUkVkZ2UucmVjYWxjdWxhdGVEaXJlY3Rpb246IHRoaXMuc3RhcnRwb2ludCAhPT0gbnVsbCAmJiB0aGlzLmVuZHBvaW50ICE9PSBudWxsIEZBSUxFRCEnKTtcbiAgICB0aGlzLmVkZ2VEaXJlY3Rpb24gPSBVdGlscy5nZXREaXIodGhpcy5lbmRwb2ludC5taW51cyh0aGlzLnN0YXJ0cG9pbnQpKTtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5nZXRCbG9ja1ByZXYgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuYmxvY2tQcmV2O1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLnNldEJsb2NrUHJldiA9IGZ1bmN0aW9uIChwcmV2QmxvY2spIHtcbiAgICB0aGlzLmJsb2NrUHJldiA9IHByZXZCbG9jaztcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5nZXRCbG9ja05leHQgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuYmxvY2tOZXh0O1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLnNldEJsb2NrTmV4dCA9IGZ1bmN0aW9uIChuZXh0QmxvY2spIHtcbiAgICB0aGlzLmJsb2NrTmV4dCA9IG5leHRCbG9jaztcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5nZXRCbG9ja1RyYWNlID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmJsb2NrVHJhY2U7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuc2V0QmxvY2tUcmFjZSA9IGZ1bmN0aW9uICh0cmFjZUJsb2NrKSB7XG4gICAgdGhpcy5ibG9ja1RyYWNlID0gdHJhY2VCbG9jaztcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5nZXRDbG9zZXN0UHJldiA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5jbG9zZXN0UHJldjtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5zZXRDbG9zZXN0UHJldiA9IGZ1bmN0aW9uIChjcCkge1xuICAgIHRoaXMuY2xvc2VzdFByZXYgPSBjcDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5nZXRDbG9zZXN0TmV4dCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5jbG9zZXN0TmV4dDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5zZXRDbG9zZXN0TmV4dCA9IGZ1bmN0aW9uIChjcCkge1xuICAgIHRoaXMuY2xvc2VzdE5leHQgPSBjcDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQXV0b1JvdXRlckVkZ2U7XG4iLCIvKmdsb2JhbHMgZGVmaW5lLCBXZWJHTUVHbG9iYWwqL1xuLypqc2hpbnQgYnJvd3NlcjogdHJ1ZSovXG5cbi8qKlxuICogQGF1dGhvciBicm9sbGIgLyBodHRwczovL2dpdGh1Yi9icm9sbGJcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBMb2dnZXIgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuTG9nZ2VyJyksXG4gICAgQ09OU1RBTlRTID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLkNvbnN0YW50cycpLFxuICAgIFV0aWxzID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlV0aWxzJyksXG4gICAgYXNzZXJ0ID0gVXRpbHMuYXNzZXJ0LFxuICAgIEF1dG9Sb3V0ZXJQYXRoID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlBhdGgnKSxcbiAgICBBdXRvUm91dGVyUG9ydCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Qb3J0JyksXG4gICAgQXV0b1JvdXRlckJveCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Cb3gnKSxcbiAgICBBdXRvUm91dGVyRWRnZSA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5FZGdlJyk7XG5cblxuICAgIC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLUF1dG9Sb3V0ZXJFZGdlTGlzdFxuXG52YXIgX2xvZ2dlciA9IG5ldyBMb2dnZXIoJ0F1dG9Sb3V0ZXIuRWRnZUxpc3QnKTtcbnZhciBBdXRvUm91dGVyRWRnZUxpc3QgPSBmdW5jdGlvbiAoYikge1xuICAgIHRoaXMub3duZXIgPSBudWxsO1xuXG4gICAgLy8tLUVkZ2VzXG4gICAgdGhpcy5pc2hvcml6b250YWwgPSBiO1xuXG4gICAgLy8tLU9yZGVyXG4gICAgdGhpcy5vcmRlckZpcnN0ID0gbnVsbDtcbiAgICB0aGlzLm9yZGVyTGFzdCA9IG51bGw7XG5cbiAgICAvLy0tU2VjdGlvblxuICAgIHRoaXMuc2VjdGlvbkZpcnN0ID0gbnVsbDtcbiAgICB0aGlzLnNlY3Rpb25CbG9ja2VyID0gbnVsbDtcbiAgICB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCA9IFtdOyAvLyBUaGlzIGlzIGFuIGFycmF5IHRvIGVtdWxhdGUgdGhlIHBvaW50ZXIgdG8gYSBwb2ludGVyIGZ1bmN0aW9uYWxpdHkgaW4gQ1BQLiBcbiAgICAvLyBUaGF0IGlzLCB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZFswXSA9IHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkKlxuXG4gICAgdGhpcy5faW5pdE9yZGVyKCk7XG4gICAgdGhpcy5faW5pdFNlY3Rpb24oKTtcbn07XG5cbi8vIFB1YmxpYyBGdW5jdGlvbnNcbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuY29udGFpbnMgPSBmdW5jdGlvbiAoc3RhcnQsIGVuZCkge1xuICAgIHZhciBjdXJyZW50RWRnZSA9IHRoaXMub3JkZXJGaXJzdCxcbiAgICAgICAgc3RhcnRwb2ludCxcbiAgICAgICAgZW5kcG9pbnQ7XG5cbiAgICB3aGlsZSAoY3VycmVudEVkZ2UpIHtcbiAgICAgICAgc3RhcnRwb2ludCA9IGN1cnJlbnRFZGdlLnN0YXJ0cG9pbnQ7XG4gICAgICAgIGVuZHBvaW50ID0gY3VycmVudEVkZ2UuZW5kcG9pbnQ7XG4gICAgICAgIGlmIChzdGFydC5lcXVhbHMoc3RhcnRwb2ludCkgJiYgZW5kLmVxdWFscyhlbmRwb2ludCkpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGN1cnJlbnRFZGdlID0gY3VycmVudEVkZ2Uub3JkZXJOZXh0O1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmNoZWNrT3JkZXIoKTtcbiAgICB0aGlzLmNoZWNrU2VjdGlvbigpO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5hZGRQYXRoRWRnZXMgPSBmdW5jdGlvbiAocGF0aCkge1xuICAgIGFzc2VydChwYXRoLm93bmVyID09PSB0aGlzLm93bmVyLFxuICAgICAgICAnQVJFZGdlTGlzdC5hZGRFZGdlczogcGF0aC5vd25lciA9PT0gb3duZXIgRkFJTEVEIScpO1xuXG4gICAgdmFyIGlzUGF0aEF1dG9Sb3V0ZWQgPSBwYXRoLmlzQXV0b1JvdXRlZCgpLFxuICAgICAgICBoYXNDdXN0b21FZGdlID0gZmFsc2UsXG4gICAgICAgIGN1c3RvbWl6ZWRJbmRleGVzID0ge30sXG4gICAgICAgIGluZGV4ZXMgPSBbXSxcbiAgICAgICAgc3RhcnRwb2ludCxcbiAgICAgICAgZW5kcG9pbnQsXG4gICAgICAgIGRpcixcbiAgICAgICAgZWRnZSxcbiAgICAgICAgaTtcblxuICAgIGlmIChpc1BhdGhBdXRvUm91dGVkKSB7XG4gICAgICAgIGkgPSAtMTtcbiAgICAgICAgd2hpbGUgKCsraSA8IGluZGV4ZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICBoYXNDdXN0b21FZGdlID0gdHJ1ZTtcbiAgICAgICAgICAgIGN1c3RvbWl6ZWRJbmRleGVzW2luZGV4ZXNbaV1dID0gMDtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGhhc0N1c3RvbUVkZ2UgPSB0cnVlO1xuICAgIH1cblxuICAgIHZhciBwb2ludExpc3QgPSBwYXRoLmdldFBvaW50TGlzdCgpLFxuICAgICAgICBwdHJzT2JqZWN0ID0gcG9pbnRMaXN0LmdldFRhaWxFZGdlUHRycygpLFxuICAgICAgICBpbmRJdHIsXG4gICAgICAgIGN1cnJFZGdlSW5kZXggPSBwb2ludExpc3QubGVuZ3RoIC0gMixcbiAgICAgICAgZ29vZEFuZ2xlLFxuICAgICAgICBwb3MgPSBwdHJzT2JqZWN0LnBvcyxcbiAgICAgICAgc2tpcEVkZ2UsXG4gICAgICAgIGlzTW92ZWFibGUsXG4gICAgICAgIGlzRWRnZUN1c3RvbUZpeGVkLFxuICAgICAgICBzdGFydFBvcnQsXG4gICAgICAgIGVuZFBvcnQsXG4gICAgICAgIGlzU3RhcnRQb3J0Q29ubmVjdFRvQ2VudGVyLFxuICAgICAgICBpc0VuZFBvcnRDb25uZWN0VG9DZW50ZXIsXG4gICAgICAgIGlzUGF0aEZpeGVkO1xuXG4gICAgc3RhcnRwb2ludCA9IHB0cnNPYmplY3Quc3RhcnQ7XG4gICAgZW5kcG9pbnQgPSBwdHJzT2JqZWN0LmVuZDtcblxuICAgIHdoaWxlIChwb2ludExpc3QubGVuZ3RoICYmIHBvcyA+PSAwKSB7XG5cbiAgICAgICAgZGlyID0gVXRpbHMuZ2V0RGlyKGVuZHBvaW50Lm1pbnVzKHN0YXJ0cG9pbnQpKTtcblxuICAgICAgICBza2lwRWRnZSA9IGRpciA9PT0gQ09OU1RBTlRTLkRpck5vbmUgPyB0cnVlIDogZmFsc2U7XG4gICAgICAgIGlzTW92ZWFibGUgPSBwYXRoLmlzTW92ZWFibGUoKTtcblxuICAgICAgICBpZiAoIWlzTW92ZWFibGUgJiYgZGlyICE9PSBDT05TVEFOVFMuRGlyU2tldykge1xuICAgICAgICAgICAgZ29vZEFuZ2xlID0gVXRpbHMuaXNSaWdodEFuZ2xlKGRpcik7XG4gICAgICAgICAgICBhc3NlcnQoZ29vZEFuZ2xlLFxuICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0LmFkZEVkZ2VzOiBVdGlscy5pc1JpZ2h0QW5nbGUgKGRpcikgRkFJTEVEIScpO1xuXG4gICAgICAgICAgICBpZiAoIWdvb2RBbmdsZSkge1xuICAgICAgICAgICAgICAgIHNraXBFZGdlID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFza2lwRWRnZSAmJlxuICAgICAgICAgICAgKFV0aWxzLmlzUmlnaHRBbmdsZShkaXIpICYmIFV0aWxzLmlzSG9yaXpvbnRhbChkaXIpID09PSB0aGlzLmlzaG9yaXpvbnRhbCkpIHtcbiAgICAgICAgICAgIGVkZ2UgPSBuZXcgQXV0b1JvdXRlckVkZ2UoKTtcbiAgICAgICAgICAgIGVkZ2Uub3duZXIgPSBwYXRoO1xuXG4gICAgICAgICAgICBlZGdlLnNldFN0YXJ0QW5kRW5kUG9pbnQoc3RhcnRwb2ludCwgZW5kcG9pbnQpO1xuICAgICAgICAgICAgZWRnZS5zdGFydHBvaW50UHJldiA9IHBvaW50TGlzdC5nZXRQb2ludEJlZm9yZUVkZ2UocG9zKTtcbiAgICAgICAgICAgIGVkZ2UuZW5kcG9pbnROZXh0ID0gcG9pbnRMaXN0LmdldFBvaW50QWZ0ZXJFZGdlKHBvcyk7XG5cbiAgICAgICAgICAgIGlmIChoYXNDdXN0b21FZGdlKSB7XG4gICAgICAgICAgICAgICAgaXNFZGdlQ3VzdG9tRml4ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBpZiAoaXNQYXRoQXV0b1JvdXRlZCkge1xuICAgICAgICAgICAgICAgICAgICBpbmRJdHIgPSBjdXN0b21pemVkSW5kZXhlcy5pbmRleE9mKGN1cnJFZGdlSW5kZXgpO1xuICAgICAgICAgICAgICAgICAgICBpc0VkZ2VDdXN0b21GaXhlZCA9IChpbmRJdHIgIT09IGN1c3RvbWl6ZWRJbmRleGVzLmxlbmd0aCAtIDEpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlzRWRnZUN1c3RvbUZpeGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBlZGdlLmVkZ2VDdXN0b21GaXhlZCA9IGlzRWRnZUN1c3RvbUZpeGVkO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgZWRnZS5lZGdlQ3VzdG9tRml4ZWQgPSBkaXIgPT09IENPTlNUQU5UUy5EaXJTa2V3O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzdGFydFBvcnQgPSBwYXRoLmdldFN0YXJ0UG9ydCgpO1xuXG4gICAgICAgICAgICBhc3NlcnQoc3RhcnRQb3J0ICE9PSBudWxsLFxuICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0LmFkZEVkZ2VzOiBzdGFydFBvcnQgIT09IG51bGwgRkFJTEVEIScpO1xuXG4gICAgICAgICAgICBpc1N0YXJ0UG9ydENvbm5lY3RUb0NlbnRlciA9IHN0YXJ0UG9ydC5pc0Nvbm5lY3RUb0NlbnRlcigpO1xuICAgICAgICAgICAgZW5kUG9ydCA9IHBhdGguZ2V0RW5kUG9ydCgpO1xuXG4gICAgICAgICAgICBhc3NlcnQoZW5kUG9ydCAhPT0gbnVsbCxcbiAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5hZGRFZGdlczogZW5kUG9ydCAhPT0gbnVsbCBGQUlMRUQhJyk7XG5cbiAgICAgICAgICAgIGlzRW5kUG9ydENvbm5lY3RUb0NlbnRlciA9IGVuZFBvcnQuaXNDb25uZWN0VG9DZW50ZXIoKTtcbiAgICAgICAgICAgIGlzUGF0aEZpeGVkID0gcGF0aC5pc0ZpeGVkKCkgfHwgIXBhdGguaXNBdXRvUm91dGVkKCk7XG5cbiAgICAgICAgICAgIGVkZ2UuZWRnZUZpeGVkID0gZWRnZS5lZGdlQ3VzdG9tRml4ZWQgfHwgaXNQYXRoRml4ZWQgfHxcbiAgICAgICAgICAgIChlZGdlLmlzU3RhcnRQb2ludFByZXZOdWxsKCkgJiYgaXNTdGFydFBvcnRDb25uZWN0VG9DZW50ZXIpIHx8XG4gICAgICAgICAgICAoZWRnZS5pc0VuZFBvaW50TmV4dE51bGwoKSAmJiBpc0VuZFBvcnRDb25uZWN0VG9DZW50ZXIpO1xuXG4gICAgICAgICAgICBpZiAoZGlyICE9PSBDT05TVEFOVFMuRGlyU2tldykge1xuICAgICAgICAgICAgICAgIHRoaXMuX3Bvc2l0aW9uTG9hZFkoZWRnZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fcG9zaXRpb25Mb2FkQihlZGdlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZWRnZS5wb3NpdGlvblkgPSAwO1xuICAgICAgICAgICAgICAgIGVkZ2UuYnJhY2tldE9wZW5pbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBlZGdlLmJyYWNrZXRDbG9zaW5nID0gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuaW5zZXJ0KGVkZ2UpO1xuXG4gICAgICAgIH1cblxuICAgICAgICBwdHJzT2JqZWN0ID0gcG9pbnRMaXN0LmdldFByZXZFZGdlUHRycyhwb3MpO1xuICAgICAgICBwb3MgPSBwdHJzT2JqZWN0LnBvcztcbiAgICAgICAgc3RhcnRwb2ludCA9IHB0cnNPYmplY3Quc3RhcnQ7XG4gICAgICAgIGVuZHBvaW50ID0gcHRyc09iamVjdC5lbmQ7XG4gICAgICAgIGN1cnJFZGdlSW5kZXgtLTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuYWRkUG9ydEVkZ2VzID0gZnVuY3Rpb24gKHBvcnQpIHtcbiAgICB2YXIgc3RhcnRwb2ludCxcbiAgICAgICAgZW5kcG9pbnQsXG4gICAgICAgIGVkZ2UsXG4gICAgICAgIHNlbGZQb2ludHMsXG4gICAgICAgIHN0YXJ0cG9pbnRQcmV2LFxuICAgICAgICBlbmRwb2ludE5leHQsXG4gICAgICAgIGRpcixcbiAgICAgICAgaSxcbiAgICAgICAgY2FuSGF2ZVN0YXJ0RW5kUG9pbnRIb3Jpem9udGFsO1xuXG4gICAgYXNzZXJ0KHBvcnQub3duZXIub3duZXIgPT09IHRoaXMub3duZXIsXG4gICAgICAgICdBUkVkZ2VMaXN0LmFkZEVkZ2VzOiBwb3J0Lm93bmVyID09PSAob3duZXIpIEZBSUxFRCEnKTtcblxuICAgIGlmIChwb3J0LmlzQ29ubmVjdFRvQ2VudGVyKCkgfHwgcG9ydC5vd25lci5pc0F0b21pYygpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBzZWxmUG9pbnRzID0gcG9ydC5zZWxmUG9pbnRzO1xuXG4gICAgZm9yIChpID0gMDsgaSA8IDQ7IGkrKykge1xuXG4gICAgICAgIHN0YXJ0cG9pbnRQcmV2ID0gc2VsZlBvaW50c1soaSArIDMpICUgNF07XG4gICAgICAgIHN0YXJ0cG9pbnQgPSBzZWxmUG9pbnRzW2ldO1xuICAgICAgICBlbmRwb2ludCA9IHNlbGZQb2ludHNbKGkgKyAxKSAlIDRdO1xuICAgICAgICBlbmRwb2ludE5leHQgPSBzZWxmUG9pbnRzWyhpICsgMikgJSA0XTtcbiAgICAgICAgZGlyID0gVXRpbHMuZ2V0RGlyKGVuZHBvaW50Lm1pbnVzKHN0YXJ0cG9pbnQpKTtcblxuICAgICAgICBhc3NlcnQoVXRpbHMuaXNSaWdodEFuZ2xlKGRpciksXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5hZGRFZGdlczogVXRpbHMuaXNSaWdodEFuZ2xlIChkaXIpIEZBSUxFRCEnKTtcblxuICAgICAgICBjYW5IYXZlU3RhcnRFbmRQb2ludEhvcml6b250YWwgPSBwb3J0LmNhbkhhdmVTdGFydEVuZFBvaW50SG9yaXpvbnRhbCh0aGlzLmlzaG9yaXpvbnRhbCk7XG4gICAgICAgIGlmIChVdGlscy5pc0hvcml6b250YWwoZGlyKSA9PT0gdGhpcy5pc2hvcml6b250YWwgJiYgY2FuSGF2ZVN0YXJ0RW5kUG9pbnRIb3Jpem9udGFsKSB7XG4gICAgICAgICAgICBlZGdlID0gbmV3IEF1dG9Sb3V0ZXJFZGdlKCk7XG5cbiAgICAgICAgICAgIGVkZ2Uub3duZXIgPSBwb3J0O1xuICAgICAgICAgICAgZWRnZS5zZXRTdGFydEFuZEVuZFBvaW50KHN0YXJ0cG9pbnQsIGVuZHBvaW50KTtcbiAgICAgICAgICAgIGVkZ2Uuc3RhcnRwb2ludFByZXYgPSBzdGFydHBvaW50UHJldjtcbiAgICAgICAgICAgIGVkZ2UuZW5kcG9pbnROZXh0ID0gZW5kcG9pbnROZXh0O1xuXG4gICAgICAgICAgICBlZGdlLmVkZ2VGaXhlZCA9IHRydWU7XG5cbiAgICAgICAgICAgIHRoaXMuX3Bvc2l0aW9uTG9hZFkoZWRnZSk7XG4gICAgICAgICAgICB0aGlzLl9wb3NpdGlvbkxvYWRCKGVkZ2UpO1xuXG4gICAgICAgICAgICBpZiAoZWRnZS5icmFja2V0Q2xvc2luZykge1xuICAgICAgICAgICAgICAgIGVkZ2UuYWRkVG9Qb3NpdGlvbigwLjk5OSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuaW5zZXJ0KGVkZ2UpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5hZGRCb3hFZGdlcyA9IGZ1bmN0aW9uIChib3gpIHtcbiAgICB2YXIgc2VsZlBvaW50cyA9IGJveC5zZWxmUG9pbnRzLFxuICAgICAgICBzdGFydHBvaW50LFxuICAgICAgICBzdGFydHBvaW50UHJldixcbiAgICAgICAgZW5kcG9pbnQsXG4gICAgICAgIGVuZHBvaW50TmV4dCxcbiAgICAgICAgZWRnZSxcbiAgICAgICAgZGlyO1xuXG4gICAgYXNzZXJ0KGJveC5vd25lciA9PT0gdGhpcy5vd25lcixcbiAgICAgICAgJ0FSRWRnZUxpc3QuYWRkRWRnZXM6IGJveC5vd25lciA9PT0gKG93bmVyKSBGQUlMRUQhJyk7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IDQ7IGkrKykge1xuICAgICAgICBzdGFydHBvaW50UHJldiA9IHNlbGZQb2ludHNbKGkgKyAzKSAlIDRdO1xuICAgICAgICBzdGFydHBvaW50ID0gc2VsZlBvaW50c1tpXTtcbiAgICAgICAgZW5kcG9pbnQgPSBzZWxmUG9pbnRzWyhpICsgMSkgJSA0XTtcbiAgICAgICAgZW5kcG9pbnROZXh0ID0gc2VsZlBvaW50c1soaSArIDIpICUgNF07XG4gICAgICAgIGRpciA9IFV0aWxzLmdldERpcihlbmRwb2ludC5taW51cyhzdGFydHBvaW50KSk7XG5cbiAgICAgICAgYXNzZXJ0KFV0aWxzLmlzUmlnaHRBbmdsZShkaXIpLFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QuYWRkRWRnZXM6IFV0aWxzLmlzUmlnaHRBbmdsZSAoZGlyKSBGQUlMRUQhJyk7XG5cbiAgICAgICAgaWYgKFV0aWxzLmlzSG9yaXpvbnRhbChkaXIpID09PSB0aGlzLmlzaG9yaXpvbnRhbCkge1xuICAgICAgICAgICAgZWRnZSA9IG5ldyBBdXRvUm91dGVyRWRnZSgpO1xuXG4gICAgICAgICAgICBlZGdlLm93bmVyID0gYm94O1xuICAgICAgICAgICAgZWRnZS5zZXRTdGFydEFuZEVuZFBvaW50KHN0YXJ0cG9pbnQsIGVuZHBvaW50KTtcbiAgICAgICAgICAgIGVkZ2Uuc3RhcnRwb2ludFByZXYgPSBzdGFydHBvaW50UHJldjtcbiAgICAgICAgICAgIGVkZ2UuZW5kcG9pbnROZXh0ID0gZW5kcG9pbnROZXh0O1xuXG4gICAgICAgICAgICBlZGdlLmVkZ2VGaXhlZCA9IHRydWU7XG5cbiAgICAgICAgICAgIHRoaXMuX3Bvc2l0aW9uTG9hZFkoZWRnZSk7XG4gICAgICAgICAgICB0aGlzLl9wb3NpdGlvbkxvYWRCKGVkZ2UpO1xuXG4gICAgICAgICAgICBpZiAoZWRnZS5icmFja2V0Q2xvc2luZykge1xuICAgICAgICAgICAgICAgIGVkZ2UuYWRkVG9Qb3NpdGlvbigwLjk5OSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuaW5zZXJ0KGVkZ2UpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5hZGRHcmFwaEVkZ2VzID0gZnVuY3Rpb24gKGdyYXBoKSB7XG4gICAgdmFyIHNlbGZQb2ludHMsXG4gICAgICAgIHN0YXJ0cG9pbnQsXG4gICAgICAgIHN0YXJ0cG9pbnRQcmV2LFxuICAgICAgICBlbmRwb2ludE5leHQsXG4gICAgICAgIGVuZHBvaW50LFxuICAgICAgICBlZGdlLFxuICAgICAgICBkaXIsXG4gICAgICAgIGk7XG5cbiAgICBhc3NlcnQoZ3JhcGggPT09IHRoaXMub3duZXIsXG4gICAgICAgICdBUkVkZ2VMaXN0LmFkZEVkZ2VzOiBncmFwaCA9PT0gdGhpcy5vd25lciBGQUlMRUQhJyk7XG5cbiAgICBzZWxmUG9pbnRzID0gZ3JhcGguc2VsZlBvaW50cztcblxuICAgIGZvciAoaSA9IDA7IGkgPCA0OyBpKyspIHtcblxuICAgICAgICBzdGFydHBvaW50UHJldiA9IHNlbGZQb2ludHNbKGkgKyAzKSAlIDRdO1xuICAgICAgICBzdGFydHBvaW50ID0gc2VsZlBvaW50c1tpXTtcbiAgICAgICAgZW5kcG9pbnQgPSBzZWxmUG9pbnRzWyhpICsgMSkgJSA0XTtcbiAgICAgICAgZW5kcG9pbnROZXh0ID0gc2VsZlBvaW50c1soaSArIDIpICUgNF07XG4gICAgICAgIGRpciA9IFV0aWxzLmdldERpcihlbmRwb2ludC5taW51cyhzdGFydHBvaW50KSk7XG5cbiAgICAgICAgYXNzZXJ0KFV0aWxzLmlzUmlnaHRBbmdsZShkaXIpLFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QuYWRkRWRnZXM6IFV0aWxzLmlzUmlnaHRBbmdsZSAoZGlyKSBGQUlMRUQhJyk7XG5cbiAgICAgICAgaWYgKFV0aWxzLmlzSG9yaXpvbnRhbChkaXIpID09PSB0aGlzLmlzaG9yaXpvbnRhbCkge1xuICAgICAgICAgICAgZWRnZSA9IG5ldyBBdXRvUm91dGVyRWRnZSgpO1xuXG4gICAgICAgICAgICBlZGdlLm93bmVyID0gZ3JhcGg7XG4gICAgICAgICAgICBlZGdlLnNldFN0YXJ0QW5kRW5kUG9pbnQoc3RhcnRwb2ludCwgZW5kcG9pbnQpO1xuICAgICAgICAgICAgZWRnZS5zdGFydHBvaW50UHJldiA9IHN0YXJ0cG9pbnRQcmV2O1xuICAgICAgICAgICAgZWRnZS5lbmRwb2ludE5leHQgPSBlbmRwb2ludE5leHQ7XG5cbiAgICAgICAgICAgIGVkZ2UuZWRnZUZpeGVkID0gdHJ1ZTtcblxuICAgICAgICAgICAgdGhpcy5fcG9zaXRpb25Mb2FkWShlZGdlKTtcbiAgICAgICAgICAgIHRoaXMuaW5zZXJ0KGVkZ2UpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5kZWxldGVFZGdlcyA9IGZ1bmN0aW9uIChvYmplY3QpIHtcbiAgICB2YXIgZWRnZSA9IHRoaXMub3JkZXJGaXJzdCxcbiAgICAgICAgbmV4dDtcblxuICAgIHdoaWxlIChlZGdlICE9PSBudWxsKSB7XG4gICAgICAgIGlmIChlZGdlLm93bmVyID09PSBvYmplY3QpIHtcbiAgICAgICAgICAgIG5leHQgPSBlZGdlLm9yZGVyTmV4dDtcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlKGVkZ2UpO1xuICAgICAgICAgICAgZWRnZSA9IG5leHQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBlZGdlID0gZWRnZS5vcmRlck5leHQ7XG4gICAgICAgIH1cbiAgICB9XG5cbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuZGVsZXRlQWxsRWRnZXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgd2hpbGUgKHRoaXMub3JkZXJGaXJzdCkge1xuICAgICAgICB0aGlzLnJlbW92ZSh0aGlzLm9yZGVyRmlyc3QpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuZ2V0RWRnZSA9IGZ1bmN0aW9uIChwYXRoLCBzdGFydHBvaW50KSB7XG4gICAgdmFyIGVkZ2UgPSB0aGlzLm9yZGVyRmlyc3Q7XG4gICAgd2hpbGUgKGVkZ2UgIT09IG51bGwpIHtcblxuICAgICAgICBpZiAoZWRnZS5pc1NhbWVTdGFydFBvaW50KHN0YXJ0cG9pbnQpKSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIGVkZ2UgPSBlZGdlLm9yZGVyTmV4dDtcbiAgICB9XG5cbiAgICBhc3NlcnQoZWRnZSAhPT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZUxpc3QuZ2V0RWRnZTogZWRnZSAhPT0gbnVsbCBGQUlMRUQhJyk7XG4gICAgcmV0dXJuIGVkZ2U7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLmdldEVkZ2VCeVBvaW50ZXIgPSBmdW5jdGlvbiAoc3RhcnRwb2ludCkge1xuICAgIHZhciBlZGdlID0gdGhpcy5vcmRlckZpcnN0O1xuICAgIHdoaWxlIChlZGdlICE9PSBudWxsKSB7XG4gICAgICAgIGlmIChlZGdlLmlzU2FtZVN0YXJ0UG9pbnQoc3RhcnRwb2ludCkpIHtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgZWRnZSA9IGVkZ2Uub3JkZXJOZXh0O1xuICAgIH1cblxuICAgIGFzc2VydChlZGdlICE9PSBudWxsLFxuICAgICAgICAnQVJFZGdlTGlzdC5nZXRFZGdlQnlQb2ludGVyOiBlZGdlICE9PSBudWxsIEZBSUxFRCEnKTtcbiAgICByZXR1cm4gZWRnZTtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuc2V0RWRnZUJ5UG9pbnRlciA9IGZ1bmN0aW9uIChwRWRnZSwgbmV3RWRnZSkge1xuICAgIGFzc2VydChuZXdFZGdlIGluc3RhbmNlb2YgQXV0b1JvdXRlckVkZ2UsXG4gICAgICAgICdBUkVkZ2VMaXN0LnNldEVkZ2VCeVBvaW50ZXI6IG5ld0VkZ2UgaW5zdGFuY2VvZiBBdXRvUm91dGVyRWRnZSBGQUlMRUQhJyk7XG4gICAgdmFyIGVkZ2UgPSB0aGlzLnNlY3Rpb25GaXJzdDtcbiAgICB3aGlsZSAoZWRnZSAhPT0gbnVsbCkge1xuICAgICAgICBpZiAocEVkZ2UgPT09IGVkZ2UpIHtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgZWRnZSA9IGVkZ2UuZ2V0U2VjdGlvbkRvd24oKTtcbiAgICB9XG5cbiAgICBhc3NlcnQoZWRnZSAhPT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZUxpc3Quc2V0RWRnZUJ5UG9pbnRlcjogZWRnZSAhPT0gbnVsbCBGQUlMRUQhJyk7XG4gICAgZWRnZSA9IG5ld0VkZ2U7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLmdldEVkZ2VBdCA9IGZ1bmN0aW9uIChwb2ludCwgbmVhcm5lc3MpIHtcbiAgICB2YXIgZWRnZSA9IHRoaXMub3JkZXJGaXJzdDtcbiAgICB3aGlsZSAoZWRnZSkge1xuXG4gICAgICAgIGlmIChVdGlscy5pc1BvaW50TmVhckxpbmUocG9pbnQsIGVkZ2Uuc3RhcnRwb2ludCwgZWRnZS5lbmRwb2ludCwgbmVhcm5lc3MpKSB7XG4gICAgICAgICAgICByZXR1cm4gZWRnZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGVkZ2UgPSBlZGdlLm9yZGVyTmV4dDtcbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuZHVtcEVkZ2VzID0gZnVuY3Rpb24gKG1zZywgbG9nZ2VyKSB7XG4gICAgdmFyIGVkZ2UgPSB0aGlzLm9yZGVyRmlyc3QsXG4gICAgICAgIGxvZyA9IGxvZ2dlciB8fCBfbG9nZ2VyLmRlYnVnLFxuICAgICAgICB0b3RhbCA9IDE7XG5cbiAgICBsb2cobXNnKTtcblxuICAgIHdoaWxlIChlZGdlICE9PSBudWxsKSB7XG4gICAgICAgIGxvZygnXFx0JyArIGVkZ2Uuc3RhcnRwb2ludC54ICsgJywgJyArIGVkZ2Uuc3RhcnRwb2ludC55ICsgJ1xcdFxcdCcgKyBlZGdlLmVuZHBvaW50LnggKyAnLCAnICtcbiAgICAgICAgZWRnZS5lbmRwb2ludC55ICsgJ1xcdFxcdFxcdCgnICsgKGVkZ2UuZWRnZUZpeGVkID8gJ0ZJWEVEJyA6ICdNT1ZFQUJMRScgKSArICcpXFx0XFx0JyArXG4gICAgICAgIChlZGdlLmJyYWNrZXRDbG9zaW5nID8gJ0JyYWNrZXQgQ2xvc2luZycgOiAoZWRnZS5icmFja2V0T3BlbmluZyA/ICdCcmFja2V0IE9wZW5pbmcnIDogJycpKSk7XG5cbiAgICAgICAgZWRnZSA9IGVkZ2Uub3JkZXJOZXh0O1xuICAgICAgICB0b3RhbCsrO1xuICAgIH1cblxuICAgIGxvZygnVG90YWwgRWRnZXM6ICcgKyB0b3RhbCk7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLmdldEVkZ2VDb3VudCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgZWRnZSA9IHRoaXMub3JkZXJGaXJzdCxcbiAgICAgICAgdG90YWwgPSAxO1xuICAgIHdoaWxlIChlZGdlICE9PSBudWxsKSB7XG4gICAgICAgIGVkZ2UgPSBlZGdlLm9yZGVyTmV4dDtcbiAgICAgICAgdG90YWwrKztcbiAgICB9XG4gICAgcmV0dXJuIHRvdGFsO1xufTtcblxuLy8tLVByaXZhdGUgRnVuY3Rpb25zXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLl9wb3NpdGlvbkdldFJlYWxZID0gZnVuY3Rpb24gKGVkZ2UsIHkpIHtcbiAgICBpZiAoeSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmICh0aGlzLmlzaG9yaXpvbnRhbCkge1xuICAgICAgICAgICAgYXNzZXJ0KGVkZ2Uuc3RhcnRwb2ludC55ID09PSBlZGdlLmVuZHBvaW50LnksXG4gICAgICAgICAgICAgICAgJ0FSRWRnZUxpc3QucG9zaXRpb25fR2V0UmVhbFk6IGVkZ2Uuc3RhcnRwb2ludC55ID09PSBlZGdlLmVuZHBvaW50LnkgRkFJTEVEIScpO1xuICAgICAgICAgICAgcmV0dXJuIGVkZ2Uuc3RhcnRwb2ludC55O1xuICAgICAgICB9XG5cbiAgICAgICAgYXNzZXJ0KGVkZ2Uuc3RhcnRwb2ludC54ID09PSBlZGdlLmVuZHBvaW50LngsXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5wb3NpdGlvbl9HZXRSZWFsWTogZWRnZS5zdGFydHBvaW50LnggPT09IGVkZ2UuZW5kcG9pbnQueCBGQUlMRUQhJyk7XG4gICAgICAgIHJldHVybiBlZGdlLnN0YXJ0cG9pbnQueDtcbiAgICB9IGVsc2Uge1xuXG4gICAgICAgIGFzc2VydChlZGdlICE9PSBudWxsICYmICFlZGdlLmlzU3RhcnRQb2ludE51bGwoKSAmJiAhZWRnZS5pc0VuZFBvaW50TnVsbCgpLFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QucG9zaXRpb25fR2V0UmVhbFk6IGVkZ2UgIT09IG51bGwgJiYgIWVkZ2UuaXNTdGFydFBvaW50TnVsbCgpICYmICcgK1xuICAgICAgICAgICAgJyFlZGdlLmlzRW5kUG9pbnROdWxsKCkgRkFJTEVEIScpO1xuXG4gICAgICAgIGlmICh0aGlzLmlzaG9yaXpvbnRhbCkge1xuICAgICAgICAgICAgYXNzZXJ0KGVkZ2Uuc3RhcnRwb2ludC55ID09PSBlZGdlLmVuZHBvaW50LnksXG4gICAgICAgICAgICAgICAgJ0FSRWRnZUxpc3QucG9zaXRpb25fR2V0UmVhbFk6IGVkZ2Uuc3RhcnRwb2ludC55ID09PSBlZGdlLmVuZHBvaW50LnkgRkFJTEVEIScpO1xuICAgICAgICAgICAgZWRnZS5zZXRTdGFydFBvaW50WSh5KTtcbiAgICAgICAgICAgIGVkZ2Uuc2V0RW5kUG9pbnRZKHkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXNzZXJ0KGVkZ2Uuc3RhcnRwb2ludC54ID09PSBlZGdlLmVuZHBvaW50LngsXG4gICAgICAgICAgICAgICAgJ0FSRWRnZUxpc3QucG9zaXRpb25fR2V0UmVhbFk6IGVkZ2Uuc3RhcnRwb2ludC54ID09PSBlZGdlLmVuZHBvaW50LnggRkFJTEVEJyk7XG5cbiAgICAgICAgICAgIGVkZ2Uuc2V0U3RhcnRQb2ludFgoeSk7XG4gICAgICAgICAgICBlZGdlLnNldEVuZFBvaW50WCh5KTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuX3Bvc2l0aW9uU2V0UmVhbFkgPSBmdW5jdGlvbiAoZWRnZSwgeSkge1xuICAgIGlmIChlZGdlIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgICAgZWRnZSA9IGVkZ2VbMF07XG4gICAgfVxuXG4gICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwgJiYgIWVkZ2UuaXNTdGFydFBvaW50TnVsbCgpICYmICFlZGdlLmlzRW5kUG9pbnROdWxsKCksXG4gICAgICAgICdBUkVkZ2VMaXN0LnBvc2l0aW9uX1NldFJlYWxZOiBlZGdlICE9IG51bGwgJiYgIWVkZ2UuaXNTdGFydFBvaW50TnVsbCgpICYmICFlZGdlLmlzRW5kUG9pbnROdWxsKCkgRkFJTEVEJyk7XG5cbiAgICBpZiAodGhpcy5pc2hvcml6b250YWwpIHtcbiAgICAgICAgYXNzZXJ0KGVkZ2Uuc3RhcnRwb2ludC55ID09PSBlZGdlLmVuZHBvaW50LnksXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5wb3NpdGlvbl9TZXRSZWFsWTogZWRnZS5zdGFydHBvaW50LnkgPT09IGVkZ2UuZW5kcG9pbnQueSBGQUlMRUQnKTtcbiAgICAgICAgZWRnZS5zZXRTdGFydFBvaW50WSh5KTtcbiAgICAgICAgZWRnZS5zZXRFbmRQb2ludFkoeSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgYXNzZXJ0KGVkZ2Uuc3RhcnRwb2ludC54ID09PSBlZGdlLmVuZHBvaW50LngsXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5wb3NpdGlvbl9TZXRSZWFsWTogZWRnZS5zdGFydHBvaW50LnggPT09IGVkZ2UuZW5kcG9pbnQueCBGQUlMRUQnKTtcbiAgICAgICAgZWRnZS5zZXRTdGFydFBvaW50WCh5KTtcbiAgICAgICAgZWRnZS5zZXRFbmRQb2ludFgoeSk7XG4gICAgfVxufTtcblxuLyoqXG4gKiBOb3JtYWxpemUgdGhlIGVkZ2UgZW5kcG9pbnRzIHNvIHgxIDwgeDJcbiAqL1xuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5fcG9zaXRpb25HZXRSZWFsWCA9IGZ1bmN0aW9uIChlZGdlKSB7XG4gICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwgJiYgIWVkZ2UuaXNTdGFydFBvaW50TnVsbCgpICYmICFlZGdlLmlzRW5kUG9pbnROdWxsKCksXG4gICAgICAgICdBUkVkZ2VMaXN0LnBvc2l0aW9uX0dldFJlYWxYOiBlZGdlICE9PSBudWxsICYmICFlZGdlLmlzU3RhcnRQb2ludE51bGwoKSAmJiAhZWRnZS5pc0VuZFBvaW50TnVsbCgpIEZBSUxFRCcpO1xuICAgIHZhciB4MSwgeDI7XG5cbiAgICBpZiAodGhpcy5pc2hvcml6b250YWwpIHtcbiAgICAgICAgYXNzZXJ0KGVkZ2Uuc3RhcnRwb2ludC55ID09PSBlZGdlLmVuZHBvaW50LnksXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5wb3NpdGlvbl9HZXRSZWFsWDogZWRnZS5zdGFydHBvaW50LnkgPT09IGVkZ2UuZW5kcG9pbnQueSBGQUlMRUQnKTtcblxuICAgICAgICBpZiAoZWRnZS5zdGFydHBvaW50LnggPCBlZGdlLmVuZHBvaW50LngpIHtcblxuICAgICAgICAgICAgeDEgPSBlZGdlLnN0YXJ0cG9pbnQueDtcbiAgICAgICAgICAgIHgyID0gZWRnZS5lbmRwb2ludC54O1xuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICB4MSA9IGVkZ2UuZW5kcG9pbnQueDtcbiAgICAgICAgICAgIHgyID0gZWRnZS5zdGFydHBvaW50Lng7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBhc3NlcnQoZWRnZS5zdGFydHBvaW50LnggPT09IGVkZ2UuZW5kcG9pbnQueCxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0LnBvc2l0aW9uX0dldFJlYWxYOiBlZGdlLnN0YXJ0cG9pbnQueCA9PT0gZWRnZS5lbmRwb2ludC54IEZBSUxFRCcpO1xuICAgICAgICBpZiAoZWRnZS5zdGFydHBvaW50LnkgPCBlZGdlLmVuZHBvaW50LnkpIHtcblxuICAgICAgICAgICAgeDEgPSBlZGdlLnN0YXJ0cG9pbnQueTtcbiAgICAgICAgICAgIHgyID0gZWRnZS5lbmRwb2ludC55O1xuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICB4MSA9IGVkZ2UuZW5kcG9pbnQueTtcbiAgICAgICAgICAgIHgyID0gZWRnZS5zdGFydHBvaW50Lnk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gW3gxLCB4Ml07XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLl9wb3NpdGlvbkdldFJlYWxPID0gZnVuY3Rpb24gKGVkZ2UpIHtcbiAgICBhc3NlcnQoZWRnZSAhPT0gbnVsbCAmJiAhZWRnZS5pc1N0YXJ0UG9pbnROdWxsKCkgJiYgIWVkZ2UuaXNFbmRQb2ludE51bGwoKSxcbiAgICAgICAgJ0FSRWRnZUxpc3QucG9zaXRpb25fR2V0UmVhbE86IGVkZ2UgIT09IG51bGwgJiYgIWVkZ2UuaXNTdGFydFBvaW50TnVsbCgpICYmICFlZGdlLmlzRW5kUG9pbnROdWxsKCkgRkFJTEVEJyk7XG4gICAgdmFyIG8xLCBvMjtcblxuICAgIGlmICh0aGlzLmlzaG9yaXpvbnRhbCkge1xuICAgICAgICBhc3NlcnQoZWRnZS5zdGFydHBvaW50LnkgPT09IGVkZ2UuZW5kcG9pbnQueSxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0LnBvc2l0aW9uX0dldFJlYWxPOiBlZGdlLnN0YXJ0cG9pbnQueSA9PT0gZWRnZS5lbmRwb2ludC55IEZBSUxFRCcpO1xuICAgICAgICBpZiAoZWRnZS5zdGFydHBvaW50LnggPCBlZGdlLmVuZHBvaW50LngpIHtcblxuICAgICAgICAgICAgbzEgPSBlZGdlLmlzU3RhcnRQb2ludFByZXZOdWxsKCkgPyAwIDogZWRnZS5zdGFydHBvaW50UHJldi55IC0gZWRnZS5zdGFydHBvaW50Lnk7XG4gICAgICAgICAgICBvMiA9IGVkZ2UuaXNFbmRQb2ludE5leHROdWxsKCkgPyAwIDogZWRnZS5lbmRwb2ludE5leHQueSAtIGVkZ2UuZW5kcG9pbnQueTtcbiAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgbzEgPSBlZGdlLmlzRW5kUG9pbnROZXh0TnVsbCgpID8gMCA6IGVkZ2UuZW5kcG9pbnROZXh0LnkgLSBlZGdlLmVuZHBvaW50Lnk7XG4gICAgICAgICAgICBvMiA9IGVkZ2UuaXNTdGFydFBvaW50UHJldk51bGwoKSA/IDAgOiBlZGdlLnN0YXJ0cG9pbnRQcmV2LnkgLSBlZGdlLnN0YXJ0cG9pbnQueTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGFzc2VydChlZGdlLnN0YXJ0cG9pbnQueCA9PT0gZWRnZS5lbmRwb2ludC54LFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QucG9zaXRpb25fR2V0UmVhbE86IGVkZ2Uuc3RhcnRwb2ludC54ID09PSBlZGdlLmVuZHBvaW50LnggRkFJTEVEJyk7XG4gICAgICAgIGlmIChlZGdlLnN0YXJ0cG9pbnQueSA8IGVkZ2UuZW5kcG9pbnQueSkge1xuXG4gICAgICAgICAgICBvMSA9IGVkZ2UuaXNTdGFydFBvaW50UHJldk51bGwoKSA/IDAgOiBlZGdlLnN0YXJ0cG9pbnRQcmV2LnggLSBlZGdlLnN0YXJ0cG9pbnQueDtcbiAgICAgICAgICAgIG8yID0gZWRnZS5pc0VuZFBvaW50TmV4dE51bGwoKSA/IDAgOiBlZGdlLmVuZHBvaW50TmV4dC54IC0gZWRnZS5lbmRwb2ludC54O1xuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICBvMSA9IGVkZ2UuaXNFbmRQb2ludE5leHROdWxsKCkgPyAwIDogZWRnZS5lbmRwb2ludE5leHQueCAtIGVkZ2UuZW5kcG9pbnQueDtcbiAgICAgICAgICAgIG8yID0gZWRnZS5pc1N0YXJ0UG9pbnRQcmV2TnVsbCgpID8gMCA6IGVkZ2Uuc3RhcnRwb2ludFByZXYueCAtIGVkZ2Uuc3RhcnRwb2ludC54O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIFtvMSwgbzJdO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5fcG9zaXRpb25Mb2FkWSA9IGZ1bmN0aW9uIChlZGdlKSB7XG4gICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwgJiYgZWRnZS5vcmRlck5leHQgPT09IG51bGwgJiYgZWRnZS5vcmRlclByZXYgPT09IG51bGwsXG4gICAgICAgICdBUkVkZ2VMaXN0LnBvc2l0aW9uX0xvYWRZOiBlZGdlICE9PSBudWxsICYmIGVkZ2Uub3JkZXJOZXh0ID09PSBudWxsICYmIGVkZ2Uub3JkZXJQcmV2ID09PSBudWxsIEZBSUxFRCcpO1xuXG4gICAgZWRnZS5wb3NpdGlvblkgPSB0aGlzLl9wb3NpdGlvbkdldFJlYWxZKGVkZ2UpO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5fcG9zaXRpb25Mb2FkQiA9IGZ1bmN0aW9uIChlZGdlKSB7XG4gICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwsXG4gICAgICAgICdBUkVkZ2VMaXN0LnBvc2l0aW9uX0xvYWRCOiBlZGdlICE9PSBudWxsIEZBSUxFRCcpO1xuXG4gICAgZWRnZS5icmFja2V0T3BlbmluZyA9ICFlZGdlLmVkZ2VGaXhlZCAmJiB0aGlzLl9icmFja2V0SXNPcGVuaW5nKGVkZ2UpO1xuICAgIGVkZ2UuYnJhY2tldENsb3NpbmcgPSAhZWRnZS5lZGdlRml4ZWQgJiYgdGhpcy5fYnJhY2tldElzQ2xvc2luZyhlZGdlKTtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuX3Bvc2l0aW9uQWxsU3RvcmVZID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBlZGdlID0gdGhpcy5vcmRlckZpcnN0O1xuICAgIHdoaWxlIChlZGdlKSB7XG4gICAgICAgIHRoaXMuX3Bvc2l0aW9uU2V0UmVhbFkoZWRnZSwgZWRnZS5wb3NpdGlvblkpO1xuICAgICAgICBlZGdlID0gZWRnZS5vcmRlck5leHQ7XG4gICAgfVxuXG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLl9wb3NpdGlvbkFsbExvYWRYID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBlZGdlID0gdGhpcy5vcmRlckZpcnN0LFxuICAgICAgICBwdHM7XG4gICAgd2hpbGUgKGVkZ2UpIHtcbiAgICAgICAgcHRzID0gdGhpcy5fcG9zaXRpb25HZXRSZWFsWChlZGdlKTtcbiAgICAgICAgZWRnZS5wb3NpdGlvblgxID0gcHRzWzBdO1xuICAgICAgICBlZGdlLnBvc2l0aW9uWDIgPSBwdHNbMV07XG5cbiAgICAgICAgZWRnZSA9IGVkZ2Uub3JkZXJOZXh0O1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuX2luaXRPcmRlciA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLm9yZGVyRmlyc3QgPSBudWxsO1xuICAgIHRoaXMub3JkZXJMYXN0ID0gbnVsbDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuX2NoZWNrT3JkZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgYXNzZXJ0KHRoaXMub3JkZXJGaXJzdCA9PT0gbnVsbCAmJiB0aGlzLm9yZGVyTGFzdCA9PT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZUxpc3QuY2hlY2tPcmRlcjogdGhpcy5vcmRlckZpcnN0ID09PSBudWxsICYmIHRoaXMub3JkZXJMYXN0ID09PSBudWxsIEZBSUxFRCcpO1xufTtcblxuLy8tLS1PcmRlclxuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLmluc2VydEJlZm9yZSA9IGZ1bmN0aW9uIChlZGdlLCBiZWZvcmUpIHtcbiAgICBhc3NlcnQoZWRnZSAhPT0gbnVsbCAmJiBiZWZvcmUgIT09IG51bGwgJiYgZWRnZSAhPT0gYmVmb3JlLFxuICAgICAgICAnQVJFZGdlTGlzdC5pbnNlcnRCZWZvcmU6IGVkZ2UgIT09IG51bGwgJiYgYmVmb3JlICE9PSBudWxsICYmIGVkZ2UgIT09IGJlZm9yZSBGQUlMRUQnKTtcbiAgICBhc3NlcnQoZWRnZS5vcmRlck5leHQgPT09IG51bGwgJiYgZWRnZS5vcmRlclByZXYgPT09IG51bGwsXG4gICAgICAgICdBUkVkZ2VMaXN0Lmluc2VydEJlZm9yZTogZWRnZS5vcmRlck5leHQgPT09IG51bGwgJiYgZWRnZS5vcmRlclByZXYgPT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICBlZGdlLm9yZGVyUHJldiA9IGJlZm9yZS5vcmRlclByZXY7XG4gICAgZWRnZS5vcmRlck5leHQgPSBiZWZvcmU7XG5cbiAgICBpZiAoYmVmb3JlLm9yZGVyUHJldikge1xuICAgICAgICBhc3NlcnQoYmVmb3JlLm9yZGVyUHJldi5vcmRlck5leHQgPT09IGJlZm9yZSxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0Lmluc2VydEJlZm9yZTogYmVmb3JlLm9yZGVyUHJldi5vcmRlck5leHQgPT09IGJlZm9yZSBGQUlMRURcXG5iZWZvcmUub3JkZXJQcmV2Lm9yZGVyTmV4dCAnICtcbiAgICAgICAgICAgICdpcyAnICsgYmVmb3JlLm9yZGVyUHJldi5vcmRlck5leHQgKyAnIGFuZCBiZWZvcmUgaXMgJyArIGJlZm9yZSk7XG5cbiAgICAgICAgYmVmb3JlLm9yZGVyUHJldi5vcmRlck5leHQgPSBlZGdlO1xuXG4gICAgICAgIGFzc2VydCh0aGlzLm9yZGVyRmlyc3QgIT09IGJlZm9yZSxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0Lmluc2VydEJlZm9yZTogdGhpcy5vcmRlckZpcnN0ICE9PSBiZWZvcmUgRkFJTEVEJyk7XG4gICAgfSBlbHNlIHtcblxuICAgICAgICBhc3NlcnQodGhpcy5vcmRlckZpcnN0ID09PSBiZWZvcmUsXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5pbnNlcnRCZWZvcmU6IHRoaXMub3JkZXJGaXJzdCA9PT0gYmVmb3JlIEZBSUxFRCcpO1xuICAgICAgICB0aGlzLm9yZGVyRmlyc3QgPSBlZGdlO1xuICAgIH1cblxuICAgIGJlZm9yZS5vcmRlclByZXYgPSBlZGdlO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5pbnNlcnRBZnRlciA9IGZ1bmN0aW9uIChlZGdlLCBhZnRlcikge1xuICAgIGFzc2VydChlZGdlICE9PSBudWxsICYmIGFmdGVyICE9PSBudWxsICYmICFlZGdlLmVxdWFscyhhZnRlciksXG4gICAgICAgICdBUkVkZ2VMaXN0Lmluc2VydEFmdGVyOiAgZWRnZSAhPT0gbnVsbCAmJiBhZnRlciAhPT0gbnVsbCAmJiAhZWRnZS5lcXVhbHMoYWZ0ZXIpIEZBSUxFRCcpO1xuICAgIGFzc2VydChlZGdlLm9yZGVyTmV4dCA9PT0gbnVsbCAmJiBlZGdlLm9yZGVyUHJldiA9PT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZUxpc3QuaW5zZXJ0QWZ0ZXI6IGVkZ2Uub3JkZXJOZXh0ID09PSBudWxsICYmIGVkZ2Uub3JkZXJQcmV2ID09PSBudWxsIEZBSUxFRCAnKTtcblxuICAgIGVkZ2Uub3JkZXJOZXh0ID0gYWZ0ZXIub3JkZXJOZXh0O1xuICAgIGVkZ2Uub3JkZXJQcmV2ID0gYWZ0ZXI7XG5cbiAgICBpZiAoYWZ0ZXIub3JkZXJOZXh0KSB7XG4gICAgICAgIGFzc2VydChhZnRlci5vcmRlck5leHQub3JkZXJQcmV2LmVxdWFscyhhZnRlciksXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5pbnNlcnRBZnRlcjogIGFmdGVyLm9yZGVyTmV4dC5vcmRlclByZXYuZXF1YWxzKGFmdGVyKSBGQUlMRUQnKTtcbiAgICAgICAgYWZ0ZXIub3JkZXJOZXh0Lm9yZGVyUHJldiA9IGVkZ2U7XG5cbiAgICAgICAgYXNzZXJ0KCF0aGlzLm9yZGVyTGFzdC5lcXVhbHMoYWZ0ZXIpLCAnQVJFZGdlTGlzdC5pbnNlcnRBZnRlcjogIW9yZGVyTGFzdC5lcXVhbHMoYWZ0ZXIpIEZBSUxFRCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGFzc2VydCh0aGlzLm9yZGVyTGFzdC5lcXVhbHMoYWZ0ZXIpLCAnQVJFZGdlTGlzdC5pbnNlcnRBZnRlcjogdGhpcy5vcmRlckxhc3QuZXF1YWxzKGFmdGVyKSBGQUlMRUQnKTtcbiAgICAgICAgdGhpcy5vcmRlckxhc3QgPSBlZGdlO1xuICAgIH1cblxuICAgIGFmdGVyLm9yZGVyTmV4dCA9IGVkZ2U7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLmluc2VydExhc3QgPSBmdW5jdGlvbiAoZWRnZSkge1xuICAgIGFzc2VydChlZGdlICE9PSBudWxsLFxuICAgICAgICAnQVJFZGdlTGlzdC5pbnNlcnRMYXN0OiBlZGdlICE9PSBudWxsIEZBSUxFRCcpO1xuICAgIGFzc2VydChlZGdlLm9yZGVyUHJldiA9PT0gbnVsbCAmJiBlZGdlLm9yZGVyTmV4dCA9PT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZUxpc3QuaW5zZXJ0TGFzdDogZWRnZS5vcmRlclByZXYgPT09IG51bGwgJiYgZWRnZS5vcmRlck5leHQgPT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICBlZGdlLm9yZGVyUHJldiA9IHRoaXMub3JkZXJMYXN0O1xuXG4gICAgaWYgKHRoaXMub3JkZXJMYXN0KSB7XG4gICAgICAgIGFzc2VydCh0aGlzLm9yZGVyTGFzdC5vcmRlck5leHQgPT09IG51bGwsXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5pbnNlcnRMYXN0OiB0aGlzLm9yZGVyTGFzdC5vcmRlck5leHQgPT09IG51bGwgRkFJTEVEJyk7XG4gICAgICAgIGFzc2VydCh0aGlzLm9yZGVyRmlyc3QgIT09IG51bGwsXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5pbnNlcnRMYXN0OiB0aGlzLm9yZGVyRmlyc3QgIT0gbnVsbCBGQUlMRUQnKTtcblxuICAgICAgICB0aGlzLm9yZGVyTGFzdC5vcmRlck5leHQgPSBlZGdlO1xuICAgICAgICB0aGlzLm9yZGVyTGFzdCA9IGVkZ2U7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgYXNzZXJ0KHRoaXMub3JkZXJGaXJzdCA9PT0gbnVsbCxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0Lmluc2VydExhc3Q6ICB0aGlzLm9yZGVyRmlyc3QgPT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICAgICAgdGhpcy5vcmRlckZpcnN0ID0gZWRnZTtcbiAgICAgICAgdGhpcy5vcmRlckxhc3QgPSBlZGdlO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuaW5zZXJ0ID0gZnVuY3Rpb24gKGVkZ2UpIHtcbiAgICBhc3NlcnQoZWRnZSAhPT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZUxpc3QuaW5zZXJ0OiAgZWRnZSAhPT0gbnVsbCBGQUlMRUQnKTtcbiAgICBhc3NlcnQoZWRnZS5vcmRlclByZXYgPT09IG51bGwgJiYgZWRnZS5vcmRlck5leHQgPT09IG51bGwsXG4gICAgICAgICdBUkVkZ2VMaXN0Lmluc2VydDogZWRnZS5vcmRlclByZXYgPT09IG51bGwgJiYgZWRnZS5vcmRlck5leHQgPT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICB2YXIgeSA9IGVkZ2UucG9zaXRpb25ZO1xuXG4gICAgYXNzZXJ0KENPTlNUQU5UUy5FRF9NSU5DT09SRCA8PSB5ICYmIHkgPD0gQ09OU1RBTlRTLkVEX01BWENPT1JELFxuICAgICAgICAnQVJFZGdlTGlzdC5pbnNlcnQ6IENPTlNUQU5UUy5FRF9NSU5DT09SRCA8PSB5ICYmIHkgPD0gQ09OU1RBTlRTLkVEX01BWENPT1JEIEZBSUxFRCAoeSBpcyAnICsgeSArICcpJyk7XG5cbiAgICB2YXIgaW5zZXJ0ID0gdGhpcy5vcmRlckZpcnN0O1xuXG4gICAgd2hpbGUgKGluc2VydCAmJiBpbnNlcnQucG9zaXRpb25ZIDwgeSkge1xuICAgICAgICBpbnNlcnQgPSBpbnNlcnQub3JkZXJOZXh0O1xuICAgIH1cblxuICAgIGlmIChpbnNlcnQpIHtcbiAgICAgICAgdGhpcy5pbnNlcnRCZWZvcmUoZWRnZSwgaW5zZXJ0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmluc2VydExhc3QoZWRnZSk7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5yZW1vdmUgPSBmdW5jdGlvbiAoZWRnZSkge1xuICAgIGFzc2VydChlZGdlICE9PSBudWxsLFxuICAgICAgICAnQVJFZGdlTGlzdC5yZW1vdmU6ICBlZGdlICE9PSBudWxsIEZBSUxFRCcpO1xuXG4gICAgaWYgKHRoaXMub3JkZXJGaXJzdCA9PT0gZWRnZSkge1xuICAgICAgICB0aGlzLm9yZGVyRmlyc3QgPSBlZGdlLm9yZGVyTmV4dDtcbiAgICB9XG5cbiAgICBpZiAoZWRnZS5vcmRlck5leHQpIHtcbiAgICAgICAgZWRnZS5vcmRlck5leHQub3JkZXJQcmV2ID0gZWRnZS5vcmRlclByZXY7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMub3JkZXJMYXN0ID09PSBlZGdlKSB7XG4gICAgICAgIHRoaXMub3JkZXJMYXN0ID0gZWRnZS5vcmRlclByZXY7XG4gICAgfVxuXG4gICAgaWYgKGVkZ2Uub3JkZXJQcmV2KSB7XG4gICAgICAgIGVkZ2Uub3JkZXJQcmV2Lm9yZGVyTmV4dCA9IGVkZ2Uub3JkZXJOZXh0O1xuICAgIH1cblxuICAgIGVkZ2Uub3JkZXJOZXh0ID0gbnVsbDtcbiAgICBlZGdlLm9yZGVyUHJldiA9IG51bGw7XG59O1xuXG4vLy0tIFByaXZhdGVcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5fc2xpZGVCdXROb3RQYXNzRWRnZXMgPSBmdW5jdGlvbiAoZWRnZSwgeSkge1xuICAgIGFzc2VydChlZGdlICE9PSBudWxsLCAnQVJFZGdlTGlzdC5zbGlkZUJ1dE5vdFBhc3NFZGdlczogZWRnZSAhPSBudWxsIEZBSUxFRCcpO1xuICAgIGFzc2VydChDT05TVEFOVFMuRURfTUlOQ09PUkQgPCB5ICYmIHkgPCBDT05TVEFOVFMuRURfTUFYQ09PUkQsXG4gICAgICAgICdBUkVkZ2VMaXN0LnNsaWRlQnV0Tm90UGFzc0VkZ2VzOiBDT05TVEFOVFMuRURfTUlOQ09PUkQgPCB5ICYmIHkgPCBDT05TVEFOVFMuRURfTUFYQ09PUkQgRkFJTEVEJyk7XG5cbiAgICB2YXIgb2xkeSA9IGVkZ2UucG9zaXRpb25ZO1xuICAgIGFzc2VydChDT05TVEFOVFMuRURfTUlOQ09PUkQgPCBvbGR5ICYmIG9sZHkgPCBDT05TVEFOVFMuRURfTUFYQ09PUkQsXG4gICAgICAgICdBUkVkZ2VMaXN0LnNsaWRlQnV0Tm90UGFzc0VkZ2VzOiBDT05TVEFOVFMuRURfTUlOQ09PUkQgPCBvbGR5ICYmIG9sZHkgPCBDT05TVEFOVFMuRURfTUFYQ09PUkQgRkFJTEVEJyk7XG5cbiAgICBpZiAob2xkeSA9PT0geSkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICB2YXIgeDEgPSBlZGdlLnBvc2l0aW9uWDEsXG4gICAgICAgIHgyID0gZWRnZS5wb3NpdGlvblgyLFxuICAgICAgICByZXQgPSBudWxsLFxuICAgICAgICBpbnNlcnQgPSBlZGdlO1xuXG4gICAgLy9JZiB3ZSBhcmUgdHJ5aW5nIHRvIHNsaWRlIGRvd25cblxuICAgIGlmIChvbGR5IDwgeSkge1xuICAgICAgICB3aGlsZSAoaW5zZXJ0Lm9yZGVyTmV4dCkge1xuICAgICAgICAgICAgaW5zZXJ0ID0gaW5zZXJ0Lm9yZGVyTmV4dDtcblxuICAgICAgICAgICAgaWYgKHkgPCBpbnNlcnQucG9zaXRpb25ZKSB7XG4gICAgICAgICAgICAgICAgLy9UaGVuIHdlIHdvbid0IGJlIHNoaWZ0aW5nIHBhc3QgdGhlIG5ldyBlZGdlIChpbnNlcnQpXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vSWYgeW91IGNhbid0IHBhc3MgdGhlIGVkZ2UgKGJ1dCB3YW50IHRvKSBhbmQgdGhlIGxpbmVzIHdpbGwgb3ZlcmxhcCB4IHZhbHVlcy4uLlxuICAgICAgICAgICAgaWYgKCFpbnNlcnQuZ2V0RWRnZUNhbnBhc3NlZCgpICYmIFV0aWxzLmludGVyc2VjdCh4MSwgeDIsIGluc2VydC5wb3NpdGlvblgxLCBpbnNlcnQucG9zaXRpb25YMikpIHtcbiAgICAgICAgICAgICAgICByZXQgPSBpbnNlcnQ7XG4gICAgICAgICAgICAgICAgeSA9IGluc2VydC5wb3NpdGlvblk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZWRnZSAhPT0gaW5zZXJ0ICYmIGluc2VydC5vcmRlclByZXYgIT09IGVkZ2UpIHtcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlKGVkZ2UpO1xuICAgICAgICAgICAgdGhpcy5pbnNlcnRCZWZvcmUoZWRnZSwgaW5zZXJ0KTtcbiAgICAgICAgfVxuXG4gICAgfSBlbHNlIHsgLy8gSWYgd2UgYXJlIHRyeWluZyB0byBzbGlkZSB1cFxuICAgICAgICB3aGlsZSAoaW5zZXJ0Lm9yZGVyUHJldikge1xuICAgICAgICAgICAgaW5zZXJ0ID0gaW5zZXJ0Lm9yZGVyUHJldjtcblxuICAgICAgICAgICAgaWYgKHkgPiBpbnNlcnQucG9zaXRpb25ZKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vSWYgaW5zZXJ0IGNhbm5vdCBiZSBwYXNzZWQgYW5kIGl0IGlzIGluIHRoZSB3YXkgb2YgdGhlIGVkZ2UgKGlmIHRoZSBlZGdlIHdlcmUgdG8gc2xpZGUgdXApLlxuICAgICAgICAgICAgaWYgKCFpbnNlcnQuZ2V0RWRnZUNhbnBhc3NlZCgpICYmIFV0aWxzLmludGVyc2VjdCh4MSwgeDIsIGluc2VydC5wb3NpdGlvblgxLCBpbnNlcnQucG9zaXRpb25YMikpIHtcbiAgICAgICAgICAgICAgICByZXQgPSBpbnNlcnQ7XG4gICAgICAgICAgICAgICAgeSA9IGluc2VydC5wb3NpdGlvblk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZWRnZSAhPT0gaW5zZXJ0ICYmIGluc2VydC5vcmRlck5leHQgIT09IGVkZ2UpIHtcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlKGVkZ2UpOy8vVGhpcyBpcyB3aGVyZSBJIGJlbGlldmUgdGhlIGVycm9yIGNvdWxkIGxpZSFcbiAgICAgICAgICAgIHRoaXMuaW5zZXJ0QWZ0ZXIoZWRnZSwgaW5zZXJ0KTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgZWRnZS5wb3NpdGlvblkgPSB5O1xuXG4gICAgcmV0dXJuIHJldDtcbn07XG5cbi8vLS0tLS0tU2VjdGlvblxuXG4vLyBwcml2YXRlXG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuX2luaXRTZWN0aW9uID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuc2VjdGlvbkZpcnN0ID0gbnVsbDtcbiAgICB0aGlzLnNlY3Rpb25CbG9ja2VyID0gbnVsbDtcbiAgICB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCA9IG51bGw7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLmNoZWNrU2VjdGlvbiA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoISh0aGlzLnNlY3Rpb25CbG9ja2VyID09PSBudWxsICYmIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkID09PSBudWxsKSkge1xuICAgICAgICAvLyBUaGlzIHVzZWQgdG8gYmUgY29udGFpbmVkIGluIGFuIGFzc2VydC5cbiAgICAgICAgLy8gR2VuZXJhbGx5IHRoaXMgZmFpbHMgd2hlbiB0aGUgcm91dGVyIGRvZXMgbm90IGhhdmUgYSBjbGVhbiBleGl0IHRoZW4gaXMgYXNrZWQgdG8gcmVyb3V0ZS5cbiAgICAgICAgdGhpcy5fbG9nZ2VyLndhcm4oJ3NlY3Rpb25CbG9ja2VyIGFuZCB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCBhcmUgbm90IG51bGwuICcgK1xuICAgICAgICAnQXNzdW1pbmcgbGFzdCBydW4gZGlkIG5vdCBleGl0IGNsZWFubHkuIEZpeGluZy4uLicpO1xuICAgICAgICB0aGlzLnNlY3Rpb25CbG9ja2VyID0gbnVsbDtcbiAgICAgICAgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgPSBudWxsO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuc2VjdGlvblJlc2V0ID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuY2hlY2tTZWN0aW9uKCk7XG5cbiAgICB0aGlzLnNlY3Rpb25GaXJzdCA9IG51bGw7XG59O1xuXG4vKipcbiAqIEluaXRpYWxpemUgdGhlIHNlY3Rpb24gZGF0YSBzdHJ1Y3R1cmUuXG4gKlxuICogQHBhcmFtIGJsb2NrZXJcbiAqIEByZXR1cm4ge3VuZGVmaW5lZH1cbiAqL1xuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5fc2VjdGlvbkJlZ2luU2NhbiA9IGZ1bmN0aW9uIChibG9ja2VyKSB7XG4gICAgdGhpcy5jaGVja1NlY3Rpb24oKTtcblxuICAgIHRoaXMuc2VjdGlvbkJsb2NrZXIgPSBibG9ja2VyO1xuXG4gICAgdGhpcy5zZWN0aW9uQmxvY2tlci5zZWN0aW9uWDEgPSB0aGlzLnNlY3Rpb25CbG9ja2VyLnBvc2l0aW9uWDE7XG4gICAgdGhpcy5zZWN0aW9uQmxvY2tlci5zZWN0aW9uWDIgPSB0aGlzLnNlY3Rpb25CbG9ja2VyLnBvc2l0aW9uWDI7XG5cbiAgICB0aGlzLnNlY3Rpb25CbG9ja2VyLnNldFNlY3Rpb25OZXh0KG51bGwpO1xuICAgIHRoaXMuc2VjdGlvbkJsb2NrZXIuc2V0U2VjdGlvbkRvd24obnVsbCk7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLl9zZWN0aW9uSXNJbW1lZGlhdGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgYXNzZXJ0KHRoaXMuc2VjdGlvbkJsb2NrZXIgIT09IG51bGwgJiYgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgIT09IG51bGwgJiYgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgIT09IG51bGwsXG4gICAgICAgICdBUkVkZ2VMaXN0Ll9zZWN0aW9uSXNJbW1lZGlhdGU6IHRoaXMuc2VjdGlvbkJsb2NrZXIgIT0gbnVsbCAmJiB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCAhPSBudWxsICcgK1xuICAgICAgICAnJiYgKnNlY3Rpb25QdHIyQmxvY2tlZCAhPSBudWxsIEZBSUxFRCcpO1xuXG4gICAgdmFyIHNlY3Rpb25CbG9ja2VkID0gdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRbMF0sXG4gICAgICAgIGUgPSBzZWN0aW9uQmxvY2tlZC5nZXRTZWN0aW9uRG93bigpLFxuICAgICAgICBhMSA9IHNlY3Rpb25CbG9ja2VkLnNlY3Rpb25YMSxcbiAgICAgICAgYTIgPSBzZWN0aW9uQmxvY2tlZC5zZWN0aW9uWDIsXG4gICAgICAgIHAxID0gc2VjdGlvbkJsb2NrZWQucG9zaXRpb25YMSxcbiAgICAgICAgcDIgPSBzZWN0aW9uQmxvY2tlZC5wb3NpdGlvblgyLFxuICAgICAgICBiMSA9IHRoaXMuc2VjdGlvbkJsb2NrZXIuc2VjdGlvblgxLFxuICAgICAgICBiMiA9IHRoaXMuc2VjdGlvbkJsb2NrZXIuc2VjdGlvblgyO1xuXG4gICAgaWYgKGUgIT09IG51bGwpIHtcbiAgICAgICAgZSA9IChlLnN0YXJ0cG9pbnQgPT09IG51bGwgfHwgZS5zZWN0aW9uWDEgPT09IHVuZGVmaW5lZCA/IG51bGwgOiBlKTtcbiAgICB9XG5cbiAgICBhc3NlcnQoYjEgPD0gYTIgJiYgYTEgPD0gYjIsXG4gICAgICAgICdBUkVkZ2VMaXN0Ll9zZWN0aW9uSXNJbW1lZGlhdGU6IGIxIDw9IGEyICYmIGExIDw9IGIyIEZBSUxFRCcpOyAgICAgICAgICAgICAgICAgICAgIC8vIG5vdCBjYXNlIDEgb3IgNlxuXG4gICAgLy8gTk9URSBXRSBDSEFOR0VEIFRIRSBDT05ESVRJT05TIChBMTw9QjEgQU5EIEIyPD1BMilcbiAgICAvLyBCRUNBVVNFIEhFUkUgV0UgTkVFRCBUSElTIVxuXG4gICAgaWYgKGExIDw9IGIxKSB7XG4gICAgICAgIHdoaWxlICghKGUgPT09IG51bGwgfHwgZS5zdGFydHBvaW50ID09PSBudWxsKSAmJiBlLnNlY3Rpb25YMiA8IGIxKSB7XG4gICAgICAgICAgICBlID0gZS5nZXRTZWN0aW9uTmV4dCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGIyIDw9IGEyKSB7XG4gICAgICAgICAgICByZXR1cm4gKGUgPT09IG51bGwgfHwgZS5zdGFydHBvaW50ID09PSBudWxsKSB8fCBiMiA8IGUuc2VjdGlvblgxOyAgICAgICAgICAgICAgIC8vIGNhc2UgM1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIChlID09PSBudWxsIHx8IGUuc3RhcnRwb2ludCA9PT0gbnVsbCkgJiYgYTIgPT09IHAyOyAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY2FzZSAyXG4gICAgfVxuXG4gICAgaWYgKGIyIDw9IGEyKSB7XG4gICAgICAgIHJldHVybiBhMSA9PT0gcDEgJiYgKChlID09PSBudWxsIHx8IGUuc3RhcnRwb2ludCA9PT0gbnVsbCkgfHwgYjIgPCBlLnNlY3Rpb25YMSk7ICAgIC8vIGNhc2UgNVxuICAgIH1cblxuICAgIHJldHVybiAoZSA9PT0gbnVsbCB8fCBlLnN0YXJ0cG9pbnQgPT09IG51bGwpICYmIGExID09PSBwMSAmJiBhMiA9PT0gcDI7ICAgICAgICAgICAgICAgICAvLyBjYXNlIDRcbn07XG5cblxuLy8gVGhlIGZvbGxvd2luZyBtZXRob2RzIGFyZSBjb252ZW5pZW5jZSBtZXRob2RzIGZvciBhZGp1c3RpbmcgdGhlICdzZWN0aW9uJyBcbi8vIG9mIGFuIGVkZ2UuXG4vKipcbiAqIEdldCBlaXRoZXIgbWluKzEgb3IgYSB2YWx1ZSBiZXR3ZWVuIG1pbiBhbmQgbWF4LiBUZWNobmljYWxseSxcbiAqIHdlIGFyZSBsb29raW5nIGZvciBbbWluLCBtYXgpLlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBtaW5cbiAqIEBwYXJhbSB7TnVtYmVyfSBtYXhcbiAqIEByZXR1cm4ge051bWJlcn0gcmVzdWx0XG4gKi9cbnZhciBnZXRMYXJnZXJFbmRwb2ludCA9IGZ1bmN0aW9uIChtaW4sIG1heCkge1xuICAgIHZhciByZXN1bHQ7XG4gICAgYXNzZXJ0KG1pbiA8IG1heCk7XG5cbiAgICByZXN1bHQgPSBNYXRoLm1pbihtaW4gKyAxLCAobWluICsgbWF4KSAvIDIpO1xuICAgIGlmIChyZXN1bHQgPT09IG1heCkge1xuICAgICAgICByZXN1bHQgPSBtaW47XG4gICAgfVxuICAgIGFzc2VydChyZXN1bHQgPCBtYXgpO1xuICAgIHJldHVybiByZXN1bHQ7XG59O1xuXG4vKipcbiAqIEdldCBlaXRoZXIgbWF4LTEgb3IgYSB2YWx1ZSBiZXR3ZWVuIG1pbiBhbmQgbWF4LiBUZWNobmljYWxseSxcbiAqIHdlIGFyZSBsb29raW5nIGZvciAobWluLCBtYXhdLlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBtaW5cbiAqIEBwYXJhbSB7TnVtYmVyfSBtYXhcbiAqIEByZXR1cm4ge051bWJlcn0gcmVzdWx0XG4gKi9cbnZhciBnZXRTbWFsbGVyRW5kcG9pbnQgPSBmdW5jdGlvbiAobWluLCBtYXgpIHtcbiAgICB2YXIgcmVzdWx0O1xuICAgIGFzc2VydChtaW4gPCBtYXgpO1xuXG4gICAgLy8gSWYgbWluIGlzIHNvIHNtYWxsIHRoYXQgXG4gICAgLy8gXG4gICAgLy8gICAgICAobWluK21heCkvMiA9PT0gbWluXG4gICAgLy9cbiAgICAvLyB0aGVuIHdlIHdpbGwgc2ltcGx5IHVzZSBtYXggdmFsdWUgZm9yIHRoZSByZXN1bHRcbiAgICByZXN1bHQgPSBNYXRoLm1heChtYXggLSAxLCAobWluICsgbWF4KSAvIDIpO1xuICAgIGlmIChyZXN1bHQgPT09IG1pbikge1xuICAgICAgICByZXN1bHQgPSBtYXg7XG4gICAgfVxuXG4gICAgYXNzZXJ0KHJlc3VsdCA+IG1pbik7XG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuX3NlY3Rpb25IYXNCbG9ja2VkRWRnZSA9IGZ1bmN0aW9uICgpIHtcbiAgICBhc3NlcnQodGhpcy5zZWN0aW9uQmxvY2tlciAhPT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZUxpc3QuX3NlY3Rpb25IYXNCbG9ja2VkRWRnZTogdGhpcy5zZWN0aW9uQmxvY2tlciAhPSBudWxsIEZBSUxFRCcpO1xuXG4gICAgdmFyIG5ld1NlY3Rpb25YMSxcbiAgICAgICAgbmV3U2VjdGlvblgyLFxuICAgICAgICBlLFxuICAgICAgICBibG9ja2VyWDEgPSB0aGlzLnNlY3Rpb25CbG9ja2VyLnNlY3Rpb25YMSxcbiAgICAgICAgYmxvY2tlclgyID0gdGhpcy5zZWN0aW9uQmxvY2tlci5zZWN0aW9uWDI7XG5cbiAgICBhc3NlcnQoYmxvY2tlclgxIDw9IGJsb2NrZXJYMixcbiAgICAgICAgJ0FSRWRnZUxpc3QuX3NlY3Rpb25IYXNCbG9ja2VkRWRnZTogYmxvY2tlclgxIDw9IGJsb2NrZXJYMiBGQUlMRUQnKTtcblxuICAgIC8vIFNldHRpbmcgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRcbiAgICBpZiAodGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgPT09IG51bGwpIHsgIC8vIGluaXRpYWxpemUgc2VjdGlvblB0cjJCbG9ja2VkXG5cbiAgICAgICAgdGhpcy5zZWN0aW9uRmlyc3QgPSB0aGlzLnNlY3Rpb25GaXJzdCA9PT0gbnVsbCA/IFtuZXcgQXV0b1JvdXRlckVkZ2UoKV0gOiB0aGlzLnNlY3Rpb25GaXJzdDtcbiAgICAgICAgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgPSB0aGlzLnNlY3Rpb25GaXJzdDtcbiAgICB9IGVsc2UgeyAgIC8vIGdldCBuZXh0IHNlY3Rpb25QdHIyQmxvY2tlZFxuICAgICAgICB2YXIgY3VycmVudEVkZ2UgPSB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZFswXTtcblxuICAgICAgICBhc3NlcnQoY3VycmVudEVkZ2Uuc3RhcnRwb2ludCAhPT0gbnVsbCxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0Ll9zZWN0aW9uSGFzQmxvY2tlZEVkZ2U6IGN1cnJlbnRFZGdlLnN0YXJ0cG9pbnQgPT09IG51bGwnKTtcblxuICAgICAgICB2YXIgbyA9IG51bGw7XG5cbiAgICAgICAgZSA9IGN1cnJlbnRFZGdlLmdldFNlY3Rpb25Eb3duUHRyKClbMF07XG4gICAgICAgIG5ld1NlY3Rpb25YMSA9IGN1cnJlbnRFZGdlLnNlY3Rpb25YMTtcbiAgICAgICAgbmV3U2VjdGlvblgyID0gY3VycmVudEVkZ2Uuc2VjdGlvblgyO1xuXG4gICAgICAgIGFzc2VydChuZXdTZWN0aW9uWDEgPD0gbmV3U2VjdGlvblgyLFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QuX3NlY3Rpb25IYXNCbG9ja2VkRWRnZTogbmV3U2VjdGlvblgxIDw9IG5ld1NlY3Rpb25YMiBGQUlMRUQgKCcgKyBuZXdTZWN0aW9uWDEgK1xuICAgICAgICAgICAgJyA8PSAnICsgbmV3U2VjdGlvblgyICsgJyknICsgJ1xcbmVkZ2UgaXMgJyk7XG5cbiAgICAgICAgYXNzZXJ0KGJsb2NrZXJYMSA8PSBuZXdTZWN0aW9uWDIgJiYgbmV3U2VjdGlvblgxIDw9IGJsb2NrZXJYMixcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0Ll9zZWN0aW9uSGFzQmxvY2tlZEVkZ2U6IGJsb2NrZXJYMSA8PSBuZXdTZWN0aW9uWDIgJiYgIG5ld1NlY3Rpb25YMSA8PSBibG9ja2VyWDIgRkFJTEVEJyk7XG4gICAgICAgIC8vIG5vdCBjYXNlIDEgb3IgNlxuICAgICAgICBpZiAobmV3U2VjdGlvblgxIDwgYmxvY2tlclgxICYmIGJsb2NrZXJYMiA8IG5ld1NlY3Rpb25YMikgeyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNhc2UgM1xuICAgICAgICAgICAgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgPSBjdXJyZW50RWRnZS5nZXRTZWN0aW9uRG93blB0cigpO1xuXG4gICAgICAgIH0gZWxzZSBpZiAoYmxvY2tlclgxIDw9IG5ld1NlY3Rpb25YMSAmJiBuZXdTZWN0aW9uWDIgPD0gYmxvY2tlclgyKSB7ICAgICAgICAgICAgICAgICAgICAgICAgLy8gY2FzZSA0XG5cbiAgICAgICAgICAgIGlmIChlICYmIGUuc3RhcnRwb2ludCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHdoaWxlIChlLmdldFNlY3Rpb25OZXh0KCkgJiYgZS5nZXRTZWN0aW9uTmV4dCgpLnN0YXJ0cG9pbnQgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgZSA9IGUuZ2V0U2VjdGlvbk5leHQoKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBlLnNldFNlY3Rpb25OZXh0KGN1cnJlbnRFZGdlLmdldFNlY3Rpb25OZXh0KCkpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkWzBdID0gY3VycmVudEVkZ2UuZ2V0U2VjdGlvbkRvd24oKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZFswXSA9IChjdXJyZW50RWRnZS5nZXRTZWN0aW9uTmV4dCgpKTtcblxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGJsb2NrZXJYMSA8PSBuZXdTZWN0aW9uWDEgJiYgYmxvY2tlclgyIDwgbmV3U2VjdGlvblgyKSB7ICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNhc2UgNVxuXG4gICAgICAgICAgICBhc3NlcnQobmV3U2VjdGlvblgxIDw9IGJsb2NrZXJYMixcbiAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5fc2VjdGlvbkhhc0Jsb2NrZWRFZGdlOiBuZXdTZWN0aW9uWDEgPD0gYmxvY2tlclgyIEZBSUxFRCcpO1xuXG4gICAgICAgICAgICAvLyBNb3ZlIG5ld1NlY3Rpb25YMSBzdWNoIHRoYXQgYmxvY2tlclgyIDwgbmV3U2VjdGlvblgxIDwgbmV3U2VjdGlvblgyXG4gICAgICAgICAgICBuZXdTZWN0aW9uWDEgPSBnZXRMYXJnZXJFbmRwb2ludChibG9ja2VyWDIsIG5ld1NlY3Rpb25YMik7XG5cbiAgICAgICAgICAgIHdoaWxlICgoZSAmJiBlLnN0YXJ0cG9pbnQgIT09IG51bGwpICYmIGUuc2VjdGlvblgxIDw9IG5ld1NlY3Rpb25YMSkge1xuICAgICAgICAgICAgICAgIGFzc2VydChlLnNlY3Rpb25YMSA8PSBlLnNlY3Rpb25YMixcbiAgICAgICAgICAgICAgICAgICAgJ0FSRWRnZUxpc3QuX3NlY3Rpb25IYXNCbG9ja2VkRWRnZTogZS5zZWN0aW9uWDEgPD0gZS5zZWN0aW9uWDIgRkFJTEVEJyk7XG5cbiAgICAgICAgICAgICAgICBpZiAobmV3U2VjdGlvblgxIDw9IGUuc2VjdGlvblgyKSB7XG4gICAgICAgICAgICAgICAgICAgIG5ld1NlY3Rpb25YMSA9IGdldExhcmdlckVuZHBvaW50KGUuc2VjdGlvblgyLCBuZXdTZWN0aW9uWDIpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIG8gPSBlO1xuICAgICAgICAgICAgICAgIGUgPSBlLmdldFNlY3Rpb25OZXh0KCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChvKSB7XG4gICAgICAgICAgICAgICAgLy8gSW5zZXJ0IGN1cnJlbnRFZGdlIHRvIGJlIHNlY3Rpb25OZXh0IG9mIHRoZSBnaXZlbiBlZGdlIGluIHRoZSBsaXN0IFxuICAgICAgICAgICAgICAgIC8vIG9mIHNlY3Rpb25Eb3duIChiYXNpY2FsbHksIGNvbGxhcHNpbmcgY3VycmVudEVkZ2UgaW50byB0aGUgc2VjdGlvbkRvd24gXG4gICAgICAgICAgICAgICAgLy8gbGlzdC4gVGhlIHZhbHVlcyBpbiB0aGUgbGlzdCBmb2xsb3dpbmcgY3VycmVudEVkZ2Ugd2lsbCB0aGVuIGJlIHNldCB0byBcbiAgICAgICAgICAgICAgICAvLyBiZSBzZWN0aW9uRG93biBvZiB0aGUgY3VycmVudEVkZ2UuKVxuICAgICAgICAgICAgICAgIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkWzBdID0gY3VycmVudEVkZ2UuZ2V0U2VjdGlvbkRvd25QdHIoKVswXTtcbiAgICAgICAgICAgICAgICBvLnNldFNlY3Rpb25OZXh0KGN1cnJlbnRFZGdlKTtcbiAgICAgICAgICAgICAgICBjdXJyZW50RWRnZS5zZXRTZWN0aW9uRG93bihlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYXNzZXJ0KGJsb2NrZXJYMiA8IG5ld1NlY3Rpb25YMSxcbiAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5fc2VjdGlvbkhhc0Jsb2NrZWRFZGdlOiBibG9ja2VyWDIgPCBuZXdTZWN0aW9uWDEgRkFJTEVEICgnICtcbiAgICAgICAgICAgICAgICBibG9ja2VyWDIgKyAnIDwgJyArIG5ld1NlY3Rpb25YMSArICcpICcgK1xuICAgICAgICAgICAgICAgIGN1cnJlbnRFZGdlLnNlY3Rpb25YMiArICcgaXMgJyArIG5ld1NlY3Rpb25YMiArICcpJyk7XG4gICAgICAgICAgICAvLyBTaGlmdGluZyB0aGUgZnJvbnQgb2YgdGhlIHAyYiBzbyBpdCBubyBsb25nZXIgb3ZlcmxhcHMgdGhpcy5zZWN0aW9uQmxvY2tlclxuXG4gICAgICAgICAgICBjdXJyZW50RWRnZS5zZWN0aW9uWDEgPSBuZXdTZWN0aW9uWDE7XG5cbiAgICAgICAgICAgIGFzc2VydChjdXJyZW50RWRnZS5zZWN0aW9uWDEgPCBjdXJyZW50RWRnZS5zZWN0aW9uWDIsXG4gICAgICAgICAgICAgICAgJ2N1cnJlbnRFZGdlLnNlY3Rpb25YMSA8IGN1cnJlbnRFZGdlLnNlY3Rpb25YMiAoJyArXG4gICAgICAgICAgICAgICAgY3VycmVudEVkZ2Uuc2VjdGlvblgxICsgJyA8ICcgKyBjdXJyZW50RWRnZS5zZWN0aW9uWDIgKyAnKScpO1xuICAgICAgICB9IGVsc2UgeyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjYXNlIDJcbiAgICAgICAgICAgIGFzc2VydChuZXdTZWN0aW9uWDEgPCBibG9ja2VyWDEgJiYgYmxvY2tlclgxIDw9IG5ld1NlY3Rpb25YMiAmJiBuZXdTZWN0aW9uWDIgPD0gYmxvY2tlclgyLFxuICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0Ll9zZWN0aW9uSGFzQmxvY2tlZEVkZ2U6ICBuZXdTZWN0aW9uWDEgPCBibG9ja2VyWDEgJiYgYmxvY2tlclgxIDw9IG5ld1NlY3Rpb25YMiAmJiAnICtcbiAgICAgICAgICAgICAgICAnbmV3U2VjdGlvblgyIDw9IGJsb2NrZXJYMiBGQUlMRUQnKTtcblxuICAgICAgICAgICAgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgPSBjdXJyZW50RWRnZS5nZXRTZWN0aW9uRG93blB0cigpO1xuXG4gICAgICAgICAgICB3aGlsZSAoZSAmJiBlLnN0YXJ0cG9pbnQgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBvID0gZTtcbiAgICAgICAgICAgICAgICBlID0gZS5nZXRTZWN0aW9uTmV4dCgpO1xuXG4gICAgICAgICAgICAgICAgaWYgKG8uc2VjdGlvblgyICsgMSA8IGJsb2NrZXJYMSAmJiAoZSA9PT0gbnVsbCB8fCBlLnN0YXJ0cG9pbnQgPT09IG51bGwgfHxcbiAgICAgICAgICAgICAgICAgICAgby5zZWN0aW9uWDIgKyAxIDwgZS5zZWN0aW9uWDEpKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgPSBvLmdldFNlY3Rpb25OZXh0UHRyKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRbMF0uc3RhcnRwb2ludCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGFzc2VydChvICE9PSBudWxsLFxuICAgICAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5fc2VjdGlvbkhhc0Jsb2NrZWRFZGdlOiBvICE9IG51bGwgRkFJTEVEJyk7XG4gICAgICAgICAgICAgICAgby5zZXRTZWN0aW9uTmV4dChjdXJyZW50RWRnZS5nZXRTZWN0aW9uTmV4dCgpKTtcblxuICAgICAgICAgICAgICAgIHZhciBsYXJnZXIgPSBibG9ja2VyWDE7XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRbMF0uc2VjdGlvblgxIDwgYmxvY2tlclgxKSB7XG4gICAgICAgICAgICAgICAgICAgIGxhcmdlciA9IHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkWzBdLnNlY3Rpb25YMTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjdXJyZW50RWRnZS5zZWN0aW9uWDIgPSBnZXRTbWFsbGVyRW5kcG9pbnQobmV3U2VjdGlvblgxLCBsYXJnZXIpO1xuXG4gICAgICAgICAgICAgICAgY3VycmVudEVkZ2Uuc2V0U2VjdGlvbk5leHQodGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRbMF0pO1xuICAgICAgICAgICAgICAgIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkWzBdID0gbmV3IEF1dG9Sb3V0ZXJFZGdlKCk7IC8vVGhpcyBzZWVtcyBvZGRcbiAgICAgICAgICAgICAgICB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCA9IG51bGw7XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY3VycmVudEVkZ2Uuc2VjdGlvblgyID0gZ2V0U21hbGxlckVuZHBvaW50KG5ld1NlY3Rpb25YMSwgYmxvY2tlclgxKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYXNzZXJ0KGN1cnJlbnRFZGdlLnNlY3Rpb25YMSA8IGN1cnJlbnRFZGdlLnNlY3Rpb25YMixcbiAgICAgICAgICAgICAgICAnRXhwZWN0ZWQgc2VjdGlvblgxIDwgc2VjdGlvblgyIGJ1dCAnICsgY3VycmVudEVkZ2Uuc2VjdGlvblgxICtcbiAgICAgICAgICAgICAgICAnIGlzIG5vdCA8ICcgKyBjdXJyZW50RWRnZS5zZWN0aW9uWDIpO1xuXG4gICAgICAgICAgICB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCA9IGN1cnJlbnRFZGdlLmdldFNlY3Rpb25OZXh0UHRyKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3NlcnQodGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgIT09IG51bGwsXG4gICAgICAgICdBUkVkZ2VMaXN0Ll9zZWN0aW9uSGFzQmxvY2tlZEVkZ2U6IHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkICE9IG51bGwgRkFJTEVEJyk7XG4gICAgd2hpbGUgKHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkWzBdICE9PSBudWxsICYmIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkWzBdLnN0YXJ0cG9pbnQgIT09IG51bGwpIHtcbiAgICAgICAgbmV3U2VjdGlvblgxID0gdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRbMF0uc2VjdGlvblgxO1xuICAgICAgICBuZXdTZWN0aW9uWDIgPSB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZFswXS5zZWN0aW9uWDI7XG5cbiAgICAgICAgaWYgKG5ld1NlY3Rpb25YMiA8IGJsb2NrZXJYMSkgeyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjYXNlIDFcbiAgICAgICAgICAgIC8vSWYgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgaXMgY29tcGxldGVseSB0byB0aGUgbGVmdCAob3IgYWJvdmUpIHRoaXMuc2VjdGlvbkJsb2NrZXJcbiAgICAgICAgICAgIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkID0gdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRbMF0uZ2V0U2VjdGlvbk5leHRQdHIoKTtcblxuICAgICAgICAgICAgYXNzZXJ0KHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkICE9PSBudWxsLFxuICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0Ll9zZWN0aW9uSGFzQmxvY2tlZEVkZ2U6IHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkICE9IG51bGwgRkFJTEVEJyk7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfSBlbHNlIGlmIChibG9ja2VyWDIgPCBuZXdTZWN0aW9uWDEpIHsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY2FzZSA2XG4gICAgICAgICAgICAvL0lmIHRoaXMuc2VjdGlvbkJsb2NrZXIgaXMgY29tcGxldGVseSB0byB0aGUgcmlnaHQgKG9yIGJlbG93KSB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZFxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobmV3U2VjdGlvblgxIDwgYmxvY2tlclgxICYmIGJsb2NrZXJYMiA8IG5ld1NlY3Rpb25YMikgeyAgICAgICAgICAgICAgICAgICAgIC8vIGNhc2UgM1xuICAgICAgICAgICAgLy9JZiB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCBzdGFydHMgYmVmb3JlIGFuZCBlbmRzIGFmdGVyIHRoaXMuc2VjdGlvbkJsb2NrZXJcbiAgICAgICAgICAgIHZhciB4ID0gYmxvY2tlclgxO1xuICAgICAgICAgICAgZSA9IHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkWzBdLmdldFNlY3Rpb25Eb3duKCk7XG5cbiAgICAgICAgICAgIGZvciAoOyA7KSB7XG5cbiAgICAgICAgICAgICAgICBpZiAoZSA9PT0gbnVsbCB8fCBlLnN0YXJ0cG9pbnQgPT09IG51bGwgfHwgeCA8IGUuc2VjdGlvblgxKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoeCA8PSBlLnNlY3Rpb25YMikge1xuICAgICAgICAgICAgICAgICAgICB4ID0gZS5zZWN0aW9uWDIgKyAxO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYmxvY2tlclgyIDwgeCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBlID0gZS5nZXRTZWN0aW9uTmV4dCgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCA9IHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkWzBdLmdldFNlY3Rpb25Eb3duUHRyKCk7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICAvLyBUaGlzIGxlYXZlcyB0aGUgcmVndWxhciBwYXJ0aWFsIG92ZXJsYXAgcG9zc2liaWxpdHkuXG4gICAgICAgIC8vIFRoZXkgYWxzbyBpbmNsdWRlIHRoaXMuc2VjdGlvbkJsb2NrZXIgc3RhcnRpbmcgYmVmb3JlIGFuZCBlbmRpbmcgYWZ0ZXIgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQuXG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgYXNzZXJ0KHRoaXMuc2VjdGlvbkJsb2NrZXIuZ2V0U2VjdGlvbk5leHQoKSA9PT0gbnVsbCAmJlxuICAgICAgICAodGhpcy5zZWN0aW9uQmxvY2tlci5nZXRTZWN0aW9uRG93bigpID09PSBudWxsIHx8XG4gICAgICAgIHRoaXMuc2VjdGlvbkJsb2NrZXIuZ2V0U2VjdGlvbkRvd24oKS5zdGFydHBvaW50ID09PSBudWxsKSxcbiAgICAgICAgJ0FSRWRnZUxpc3QuX3NlY3Rpb25IYXNCbG9ja2VkRWRnZTogdGhpcy5zZWN0aW9uQmxvY2tlci5nZXRTZWN0aW9uTmV4dCgpID09PSBudWxsICYmJyArXG4gICAgICAgICd0aGlzLnNlY3Rpb25CbG9ja2VyLmdldFNlY3Rpb25Eb3duKCkgPT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICB0aGlzLnNlY3Rpb25CbG9ja2VyLnNldFNlY3Rpb25OZXh0KHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkWzBdKTtcblxuICAgIC8vIFNldCBhbnl0aGluZyBwb2ludGluZyB0byB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCB0byBwb2ludCB0byB0aGlzLnNlY3Rpb25CbG9ja2VyIChlZywgc2VjdGlvbkRvd24pXG4gICAgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRbMF0gPSB0aGlzLnNlY3Rpb25CbG9ja2VyO1xuXG4gICAgdGhpcy5zZWN0aW9uQmxvY2tlciA9IG51bGw7XG4gICAgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgPSBudWxsO1xuXG4gICAgcmV0dXJuIGZhbHNlO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5fc2VjdGlvbkdldEJsb2NrZWRFZGdlID0gZnVuY3Rpb24gKCkge1xuICAgIGFzc2VydCh0aGlzLnNlY3Rpb25CbG9ja2VyICE9PSBudWxsICYmIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkICE9PSBudWxsLFxuICAgICAgICAnQVJFZGdlTGlzdC5zZWN0aW9uR2V0QmxvY2tlZEVkZ2U6IHRoaXMuc2VjdGlvbkJsb2NrZXIgIT09IG51bGwgJiYgJyArXG4gICAgICAgICd0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCAhPT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIHJldHVybiB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZFswXTtcbn07XG5cbi8vLS0tLUJyYWNrZXRcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5fYnJhY2tldElzQ2xvc2luZyA9IGZ1bmN0aW9uIChlZGdlKSB7XG4gICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwsICdBUkVkZ2VMaXN0Ll9icmFja2V0SXNDbG9zaW5nOiBlZGdlICE9PSBudWxsIEZBSUxFRCcpO1xuICAgIGFzc2VydCghZWRnZS5pc1N0YXJ0UG9pbnROdWxsKCkgJiYgIWVkZ2UuaXNFbmRQb2ludE51bGwoKSxcbiAgICAgICAgJ0FSRWRnZUxpc3QuX2JyYWNrZXRJc0Nsb3Npbmc6ICFlZGdlLmlzU3RhcnRQb2ludE51bGwoKSAmJiAhZWRnZS5pc0VuZFBvaW50TnVsbCgpIEZBSUxFRCcpO1xuXG4gICAgdmFyIHN0YXJ0ID0gZWRnZS5zdGFydHBvaW50LFxuICAgICAgICBlbmQgPSBlZGdlLmVuZHBvaW50O1xuXG4gICAgaWYgKGVkZ2UuaXNTdGFydFBvaW50UHJldk51bGwoKSB8fCBlZGdlLmlzRW5kUG9pbnROZXh0TnVsbCgpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5pc2hvcml6b250YWwgP1xuICAgICAgICAoZWRnZS5zdGFydHBvaW50UHJldi55IDwgc3RhcnQueSAmJiBlZGdlLmVuZHBvaW50TmV4dC55IDwgZW5kLnkgKSA6XG4gICAgICAgIChlZGdlLnN0YXJ0cG9pbnRQcmV2LnggPCBzdGFydC54ICYmIGVkZ2UuZW5kcG9pbnROZXh0LnggPCBlbmQueCApO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5fYnJhY2tldElzT3BlbmluZyA9IGZ1bmN0aW9uIChlZGdlKSB7XG4gICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwsICdBUkVkZ2VMaXN0Ll9icmFja2V0SXNPcGVuaW5nOiBlZGdlICE9PSBudWxsIEZBSUxFRCcpO1xuICAgIGFzc2VydCghZWRnZS5pc1N0YXJ0UG9pbnROdWxsKCkgJiYgIWVkZ2UuaXNFbmRQb2ludE51bGwoKSxcbiAgICAgICAgJ0FSRWRnZUxpc3QuX2JyYWNrZXRJc09wZW5pbmc6ICFlZGdlLmlzU3RhcnRQb2ludE51bGwoKSAmJiAhZWRnZS5pc0VuZFBvaW50TnVsbCgpIEZBSUxFRCcpO1xuXG4gICAgdmFyIHN0YXJ0ID0gZWRnZS5zdGFydHBvaW50IHx8IGVkZ2Uuc3RhcnRwb2ludCxcbiAgICAgICAgZW5kID0gZWRnZS5lbmRwb2ludCB8fCBlZGdlLmVuZHBvaW50LFxuICAgICAgICBwcmV2LFxuICAgICAgICBuZXh0O1xuXG4gICAgaWYgKGVkZ2UuaXNTdGFydFBvaW50UHJldk51bGwoKSB8fCBlZGdlLmlzRW5kUG9pbnROZXh0TnVsbCgpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBuZXh0ID0gZWRnZS5lbmRwb2ludE5leHQgfHwgZWRnZS5lbmRwb2ludE5leHQ7XG4gICAgcHJldiA9IGVkZ2Uuc3RhcnRwb2ludFByZXYgfHwgZWRnZS5zdGFydHBvaW50UHJldjtcblxuICAgIHJldHVybiB0aGlzLmlzaG9yaXpvbnRhbCA/XG4gICAgICAgIChwcmV2LnkgPiBzdGFydC55ICYmIG5leHQueSA+IGVuZC55ICkgOlxuICAgICAgICAocHJldi54ID4gc3RhcnQueCAmJiBuZXh0LnggPiBlbmQueCApO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5fYnJhY2tldFNob3VsZEJlU3dpdGNoZWQgPSBmdW5jdGlvbiAoZWRnZSwgbmV4dCkge1xuICAgIGFzc2VydChlZGdlICE9PSBudWxsICYmIG5leHQgIT09IG51bGwsXG4gICAgICAgICdBUkVkZ2VMaXN0Ll9icmFja2V0U2hvdWxkQmVTd2l0Y2hlZDogZWRnZSAhPT0gbnVsbCAmJiBuZXh0ICE9PSBudWxsIEZBSUxFRCcpO1xuXG4gICAgdmFyIGV4ID0gdGhpcy5fcG9zaXRpb25HZXRSZWFsWChlZGdlKSxcbiAgICAgICAgZXgxID0gZXhbMF0sXG4gICAgICAgIGV4MiA9IGV4WzFdLFxuICAgICAgICBlbyA9IHRoaXMuX3Bvc2l0aW9uR2V0UmVhbE8oZWRnZSksXG4gICAgICAgIGVvMSA9IGVvWzBdLFxuICAgICAgICBlbzIgPSBlb1sxXSxcbiAgICAgICAgbnggPSB0aGlzLl9wb3NpdGlvbkdldFJlYWxYKG5leHQpLFxuICAgICAgICBueDEgPSBueFswXSxcbiAgICAgICAgbngyID0gbnhbMV0sXG4gICAgICAgIG5vID0gdGhpcy5fcG9zaXRpb25HZXRSZWFsTyhuZXh0KSxcbiAgICAgICAgbm8xID0gbm9bMF0sXG4gICAgICAgIG5vMiA9IG5vWzFdO1xuXG4gICAgdmFyIGMxLCBjMjtcblxuICAgIGlmICgobngxIDwgZXgxICYmIGV4MSA8IG54MiAmJiBlbzEgPiAwICkgfHwgKGV4MSA8IG54MSAmJiBueDEgPCBleDIgJiYgbm8xIDwgMCkpIHtcbiAgICAgICAgYzEgPSArMTtcbiAgICB9IGVsc2UgaWYgKGV4MSA9PT0gbngxICYmIGVvMSA9PT0gMCAmJiBubzEgPT09IDApIHtcbiAgICAgICAgYzEgPSAwO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGMxID0gLTk7XG4gICAgfVxuXG4gICAgaWYgKChueDEgPCBleDIgJiYgZXgyIDwgbngyICYmIGVvMiA+IDAgKSB8fCAoZXgxIDwgbngyICYmIG54MiA8IGV4MiAmJiBubzIgPCAwKSkge1xuICAgICAgICBjMiA9ICsxO1xuICAgIH0gZWxzZSBpZiAoZXgyID09PSBueDIgJiYgZW8yID09PSAwICYmIG5vMiA9PT0gMCkge1xuICAgICAgICBjMiA9IDA7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgYzIgPSAtOTtcbiAgICB9XG5cbiAgICByZXR1cm4gKGMxICsgYzIpID4gMDtcbn07XG5cbi8vLS0tQmxvY2tcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5fYmxvY2tHZXRGID0gZnVuY3Rpb24gKGQsIGIsIHMpIHtcbiAgICB2YXIgZiA9IGQgLyAoYiArIHMpLCAvL2YgaXMgdGhlIHRvdGFsIGRpc3RhbmNlIGJldHdlZW4gZWRnZXMgZGl2aWRlZCBieSB0aGUgdG90YWwgbnVtYmVyIG9mIGVkZ2VzXG4gICAgICAgIFMgPSBDT05TVEFOVFMuRURMU19TLCAvL1RoaXMgaXMgJ1NNQUxMR0FQJ1xuICAgICAgICBSID0gQ09OU1RBTlRTLkVETFNfUiwvL1RoaXMgaXMgJ1NNQUxMR0FQICsgMSdcbiAgICAgICAgRCA9IENPTlNUQU5UUy5FRExTX0Q7IC8vVGhpcyBpcyB0aGUgdG90YWwgZGlzdGFuY2Ugb2YgdGhlIGdyYXBoXG5cbiAgICAvL0lmIGYgaXMgZ3JlYXRlciB0aGFuIHRoZSBTTUFMTEdBUCwgdGhlbiBtYWtlIHNvbWUgY2hlY2tzL2VkaXRzXG4gICAgaWYgKGIgPT09IDAgJiYgUiA8PSBmKSB7XG4gICAgICAgIC8vIElmIGV2ZXJ5IGNvbXBhcmlzb24gcmVzdWx0ZWQgaW4gYW4gb3ZlcmxhcCBBTkQgU01BTExHQVAgKyAxIGlzIGxlc3MgdGhhblxuICAgICAgICAvLyB0aGUgZGlzdGFuY2UgYmV0d2VlbiBlYWNoIGVkZ2UgKGluIHRoZSBnaXZlbiByYW5nZSkuXG4gICAgICAgIGYgKz0gKEQgLSBSKTtcbiAgICB9IGVsc2UgaWYgKFMgPCBmICYmIHMgPiAwKSB7XG4gICAgICAgIGYgPSAoKEQgLSBTKSAqIGQgLSBTICogKEQgLSBSKSAqIHMpIC8gKChEIC0gUykgKiBiICsgKFIgLSBTKSAqIHMpO1xuICAgIH1cblxuICAgIHJldHVybiBmO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5fYmxvY2tHZXRHID0gZnVuY3Rpb24gKGQsIGIsIHMpIHtcbiAgICB2YXIgZyA9IGQgLyAoYiArIHMpLFxuICAgICAgICBTID0gQ09OU1RBTlRTLkVETFNfUyxcbiAgICAgICAgUiA9IENPTlNUQU5UUy5FRExTX1IsXG4gICAgICAgIEQgPSBDT05TVEFOVFMuRURMU19EO1xuXG4gICAgaWYgKFMgPCBnICYmIGIgPiAwKSB7XG4gICAgICAgIGcgPSAoKFIgLSBTKSAqIGQgKyBTICogKEQgLSBSKSAqIGIpIC8gKChEIC0gUykgKiBiICsgKFIgLSBTKSAqIHMpO1xuICAgIH1cblxuICAgIHJldHVybiBnO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5fYmxvY2tQdXNoQmFja3dhcmQgPSBmdW5jdGlvbiAoYmxvY2tlZCwgYmxvY2tlcikge1xuICAgIHZhciBtb2RpZmllZCA9IGZhbHNlO1xuXG4gICAgYXNzZXJ0KGJsb2NrZWQgIT09IG51bGwgJiYgYmxvY2tlciAhPT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZUxpc3QuX2Jsb2NrUHVzaEJhY2t3YXJkOiBibG9ja2VkICE9PSBudWxsICYmIGJsb2NrZXIgIT09IG51bGwgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KGJsb2NrZWQucG9zaXRpb25ZIDw9IGJsb2NrZXIucG9zaXRpb25ZLFxuICAgICAgICAnQVJFZGdlTGlzdC5fYmxvY2tQdXNoQmFja3dhcmQ6IGJsb2NrZWQucG9zaXRpb25ZIDw9IGJsb2NrZXIucG9zaXRpb25ZIEZBSUxFRCcpO1xuICAgIGFzc2VydChibG9ja2VkLmdldEJsb2NrUHJldigpICE9PSBudWxsLFxuICAgICAgICAnQVJFZGdlTGlzdC5fYmxvY2tQdXNoQmFja3dhcmQ6IGJsb2NrZWQuZ2V0QmxvY2tQcmV2KCkgIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICB2YXIgZiA9IDAsXG4gICAgICAgIGcgPSAwLFxuICAgICAgICBlZGdlID0gYmxvY2tlZCxcbiAgICAgICAgdHJhY2UgPSBibG9ja2VyLFxuICAgICAgICBkID0gdHJhY2UucG9zaXRpb25ZIC0gZWRnZS5wb3NpdGlvblk7XG5cbiAgICBhc3NlcnQoZCA+PSAwLFxuICAgICAgICAnQVJFZGdlTGlzdC5fYmxvY2tQdXNoQmFja3dhcmQ6IGQgPj0gMCBGQUlMRUQnKTtcblxuICAgIHZhciBzID0gKGVkZ2UuYnJhY2tldE9wZW5pbmcgfHwgdHJhY2UuYnJhY2tldENsb3NpbmcpLFxuICAgICAgICBiID0gMSAtIHMsXG4gICAgICAgIGQyO1xuXG4gICAgZm9yICg7IDspIHtcbiAgICAgICAgZWRnZS5zZXRCbG9ja1RyYWNlKHRyYWNlKTtcbiAgICAgICAgdHJhY2UgPSBlZGdlO1xuICAgICAgICBlZGdlID0gZWRnZS5nZXRCbG9ja1ByZXYoKTtcblxuICAgICAgICBpZiAoZWRnZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICBkMiA9IHRyYWNlLnBvc2l0aW9uWSAtIGVkZ2UucG9zaXRpb25ZO1xuICAgICAgICBhc3NlcnQoZDIgPj0gMCxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0Ll9ibG9ja1B1c2hCYWNrd2FyZDogIGQyID49IDAgRkFJTEVEJyk7XG5cbiAgICAgICAgaWYgKGVkZ2UuYnJhY2tldE9wZW5pbmcgfHwgdHJhY2UuYnJhY2tldENsb3NpbmcpIHtcbiAgICAgICAgICAgIGcgPSB0aGlzLl9ibG9ja0dldEcoZCwgYiwgcyk7XG4gICAgICAgICAgICBpZiAoZDIgPD0gZykge1xuICAgICAgICAgICAgICAgIGYgPSB0aGlzLl9ibG9ja0dldEYoZCwgYiwgcyk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmID0gdGhpcy5fYmxvY2tHZXRGKGQsIGIsIHMpO1xuICAgICAgICAgICAgaWYgKGQyIDw9IGYpIHtcbiAgICAgICAgICAgICAgICBnID0gdGhpcy5fYmxvY2tHZXRHKGQsIGIsIHMpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYisrO1xuICAgICAgICB9XG5cbiAgICAgICAgZCArPSBkMjtcbiAgICB9XG5cbiAgICBpZiAoYiArIHMgPiAxKSB7XG4gICAgICAgIGlmIChlZGdlID09PSBudWxsKSB7XG4gICAgICAgICAgICBmID0gdGhpcy5fYmxvY2tHZXRGKGQsIGIsIHMpO1xuICAgICAgICAgICAgZyA9IHRoaXMuX2Jsb2NrR2V0RyhkLCBiLCBzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGFzc2VydChVdGlscy5mbG9hdEVxdWFscyhkLCBmICogYiArIGcgKiBzKSxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0Ll9ibG9ja1B1c2hCYWNrd2FyZDogZmxvYXRFcXVhbHMoZCwgZipiICsgZypzKSBGQUlMRUQnKTtcblxuICAgICAgICBlZGdlID0gdHJhY2U7XG4gICAgICAgIGFzc2VydChlZGdlICE9PSBudWxsICYmIGVkZ2UgIT09IGJsb2NrZWQsXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5fYmxvY2tQdXNoQmFja3dhcmQ6IGVkZ2UgIT09IG51bGwgJiYgZWRnZSAhPT0gYmxvY2tlZCBGQUlMRUQnKTtcblxuICAgICAgICB2YXIgeSA9IGVkZ2UucG9zaXRpb25ZO1xuXG4gICAgICAgIGRvIHtcbiAgICAgICAgICAgIGFzc2VydChlZGdlICE9PSBudWxsICYmIGVkZ2UuZ2V0QmxvY2tUcmFjZSgpICE9PSBudWxsLFxuICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0Ll9ibG9ja1B1c2hCYWNrd2FyZDogZWRnZSAhPT0gbnVsbCAmJiBlZGdlLmdldEJsb2NrVHJhY2UoKSAhPT0gbnVsbCBGQUlMRUQnKTtcblxuICAgICAgICAgICAgdHJhY2UgPSBlZGdlLmdldEJsb2NrVHJhY2UoKTtcblxuICAgICAgICAgICAgeSArPSAoZWRnZS5icmFja2V0T3BlbmluZyB8fCB0cmFjZS5icmFja2V0Q2xvc2luZykgPyBnIDogZjtcbiAgICAgICAgICAgIHkgPSBVdGlscy5yb3VuZFRydW5jKHksIDEwKTsgIC8vIEZpeCBhbnkgZmxvYXRpbmcgcG9pbnQgZXJyb3JzXG5cbiAgICAgICAgICAgIGlmICh5ICsgMC4wMDEgPCB0cmFjZS5wb3NpdGlvblkpIHtcbiAgICAgICAgICAgICAgICBtb2RpZmllZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX3NsaWRlQnV0Tm90UGFzc0VkZ2VzKHRyYWNlLCB5KSkge1xuICAgICAgICAgICAgICAgICAgICB0cmFjZS5zZXRCbG9ja1ByZXYobnVsbCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBlZGdlID0gdHJhY2U7XG4gICAgICAgIH0gd2hpbGUgKGVkZ2UgIT09IGJsb2NrZWQpO1xuXG4gICAgICAgIGlmIChDT05TVEFOVFMuREVCVUcpIHtcbiAgICAgICAgICAgIC8veSArPSAoZWRnZS5icmFja2V0T3BlbmluZyB8fCBibG9ja2VyLmJyYWNrZXRDbG9zaW5nKSA/IGcgOiBmO1xuICAgICAgICAgICAgYXNzZXJ0KFV0aWxzLmZsb2F0RXF1YWxzKHksIGJsb2NrZXIucG9zaXRpb25ZKSxcbiAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5fYmxvY2tQdXNoQmFja3dhcmQ6IGZsb2F0RXF1YWxzKHksIGJsb2NrZXIucG9zaXRpb25ZKSBGQUlMRUQnKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBtb2RpZmllZDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuX2Jsb2NrUHVzaEZvcndhcmQgPSBmdW5jdGlvbiAoYmxvY2tlZCwgYmxvY2tlcikge1xuICAgIHZhciBtb2RpZmllZCA9IGZhbHNlO1xuXG4gICAgYXNzZXJ0KGJsb2NrZWQgIT09IG51bGwgJiYgYmxvY2tlciAhPT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZUxpc3QuX2Jsb2NrUHVzaEZvcndhcmQ6IGJsb2NrZWQgIT09IG51bGwgJiYgYmxvY2tlciAhPT0gbnVsbCBGQUlMRUQnKTtcbiAgICBhc3NlcnQoYmxvY2tlZC5wb3NpdGlvblkgPj0gYmxvY2tlci5wb3NpdGlvblksXG4gICAgICAgICdBUkVkZ2VMaXN0Ll9ibG9ja1B1c2hGb3J3YXJkOiBibG9ja2VkLnBvc2l0aW9uWSA+PSBibG9ja2VyLnBvc2l0aW9uWSBGQUlMRUQnKTtcbiAgICBhc3NlcnQoYmxvY2tlZC5nZXRCbG9ja05leHQoKSAhPT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZUxpc3QuX2Jsb2NrUHVzaEZvcndhcmQ6IGJsb2NrZWQuZ2V0QmxvY2tOZXh0KCkgIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICB2YXIgZiA9IDAsXG4gICAgICAgIGcgPSAwLFxuICAgICAgICBlZGdlID0gYmxvY2tlZCxcbiAgICAgICAgdHJhY2UgPSBibG9ja2VyLFxuICAgICAgICBkID0gZWRnZS5wb3NpdGlvblkgLSB0cmFjZS5wb3NpdGlvblk7XG5cbiAgICBhc3NlcnQoZCA+PSAwLFxuICAgICAgICAnQVJFZGdlTGlzdC5fYmxvY2tQdXNoRm9yd2FyZDogIGQgPj0gMCBGQUlMRUQnKTtcblxuICAgIHZhciBzID0gKHRyYWNlLmJyYWNrZXRPcGVuaW5nIHx8IGVkZ2UuYnJhY2tldENsb3NpbmcpLFxuICAgICAgICBiID0gMSAtIHMsXG4gICAgICAgIGQyO1xuXG4gICAgZm9yICg7IDspIHtcbiAgICAgICAgZWRnZS5zZXRCbG9ja1RyYWNlKHRyYWNlKTtcbiAgICAgICAgdHJhY2UgPSBlZGdlO1xuICAgICAgICBlZGdlID0gZWRnZS5nZXRCbG9ja05leHQoKTtcblxuICAgICAgICBpZiAoZWRnZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICBkMiA9IGVkZ2UucG9zaXRpb25ZIC0gdHJhY2UucG9zaXRpb25ZO1xuICAgICAgICBhc3NlcnQoZDIgPj0gMCxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0Ll9ibG9ja1B1c2hGb3J3YXJkOiBkMiA+PSAwIEZBSUxFRCcpO1xuXG4gICAgICAgIGlmICh0cmFjZS5icmFja2V0T3BlbmluZyB8fCBlZGdlLmJyYWNrZXRDbG9zaW5nKSB7XG4gICAgICAgICAgICBnID0gdGhpcy5fYmxvY2tHZXRHKGQsIGIsIHMpO1xuICAgICAgICAgICAgaWYgKGQyIDw9IGcpIHtcbiAgICAgICAgICAgICAgICBmID0gdGhpcy5fYmxvY2tHZXRGKGQsIGIsIHMpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZiA9IHRoaXMuX2Jsb2NrR2V0RihkLCBiLCBzKTtcbiAgICAgICAgICAgIGlmIChkMiA8PSBmKSB7XG4gICAgICAgICAgICAgICAgZyA9IHRoaXMuX2Jsb2NrR2V0RyhkLCBiLCBzKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGIrKztcbiAgICAgICAgfVxuXG4gICAgICAgIGQgKz0gZDI7XG4gICAgfVxuXG4gICAgaWYgKGIgKyBzID4gMSkgeyAvL0xvb2tpbmcgYXQgbW9yZSB0aGFuIG9uZSBlZGdlIChvciBlZGdlL3RyYWNlIGNvbXBhcmlzb24pIHtcbiAgICAgICAgaWYgKGVkZ2UgPT09IG51bGwpIHtcbiAgICAgICAgICAgIGYgPSB0aGlzLl9ibG9ja0dldEYoZCwgYiwgcyk7XG4gICAgICAgICAgICBnID0gdGhpcy5fYmxvY2tHZXRHKGQsIGIsIHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgYXNzZXJ0KFV0aWxzLmZsb2F0RXF1YWxzKGQsIGYgKiBiICsgZyAqIHMpLFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QuX2Jsb2NrUHVzaEZvcndhcmQ6IGZsb2F0RXF1YWxzKGQsIGYqYiArIGcqcykgRkFJTEVEJyk7XG5cbiAgICAgICAgZWRnZSA9IHRyYWNlO1xuICAgICAgICBhc3NlcnQoZWRnZSAhPT0gbnVsbCAmJiAhZWRnZS5lcXVhbHMoYmxvY2tlZCksXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5fYmxvY2tQdXNoRm9yd2FyZDogZWRnZSAhPSBudWxsICYmICFlZGdlLmVxdWFscyhibG9ja2VkKSBGQUlMRUQnKTtcblxuICAgICAgICB2YXIgeSA9IGVkZ2UucG9zaXRpb25ZO1xuXG4gICAgICAgIGRvIHtcbiAgICAgICAgICAgIGFzc2VydChlZGdlICE9PSBudWxsICYmIGVkZ2UuZ2V0QmxvY2tUcmFjZSgpICE9PSBudWxsLFxuICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0Ll9ibG9ja1B1c2hGb3J3YXJkOiBlZGdlICE9PSBudWxsICYmIGVkZ2UuZ2V0QmxvY2tUcmFjZSgpICE9PSBudWxsIEZBSUxFRCcpO1xuICAgICAgICAgICAgdHJhY2UgPSBlZGdlLmdldEJsb2NrVHJhY2UoKTtcblxuICAgICAgICAgICAgeSAtPSAodHJhY2UuYnJhY2tldE9wZW5pbmcgfHwgZWRnZS5icmFja2V0Q2xvc2luZykgPyBnIDogZjtcblxuICAgICAgICAgICAgaWYgKHRyYWNlLnBvc2l0aW9uWSA8IHkgLSAwLjAwMSkge1xuICAgICAgICAgICAgICAgIG1vZGlmaWVkID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9zbGlkZUJ1dE5vdFBhc3NFZGdlcyh0cmFjZSwgeSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJhY2Uuc2V0QmxvY2tOZXh0KG51bGwpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZWRnZSA9IHRyYWNlO1xuICAgICAgICB9IHdoaWxlIChlZGdlICE9PSBibG9ja2VkKTtcbiAgICB9XG5cblxuICAgIHJldHVybiBtb2RpZmllZDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuYmxvY2tTY2FuRm9yd2FyZCA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLl9wb3NpdGlvbkFsbExvYWRYKCk7XG5cbiAgICB2YXIgbW9kaWZpZWQgPSBmYWxzZTtcblxuICAgIHRoaXMuc2VjdGlvblJlc2V0KCk7XG5cbiAgICB2YXIgYmxvY2tlciA9IHRoaXMub3JkZXJGaXJzdCxcbiAgICAgICAgYmxvY2tlZCxcbiAgICAgICAgYm1pbixcbiAgICAgICAgc21pbixcbiAgICAgICAgYk1pbkYsXG4gICAgICAgIHNNaW5GO1xuXG4gICAgd2hpbGUgKGJsb2NrZXIpIHtcbiAgICAgICAgYm1pbiA9IG51bGw7IC8vYmxvY2sgbWluP1xuICAgICAgICBzbWluID0gbnVsbDsgLy9zZWN0aW9uIG1pbj9cbiAgICAgICAgYk1pbkYgPSBDT05TVEFOVFMuRURfTUlOQ09PUkQgLSAxO1xuICAgICAgICBzTWluRiA9IENPTlNUQU5UUy5FRF9NSU5DT09SRCAtIDE7XG5cbiAgICAgICAgdGhpcy5fc2VjdGlvbkJlZ2luU2NhbihibG9ja2VyKTtcbiAgICAgICAgd2hpbGUgKHRoaXMuX3NlY3Rpb25IYXNCbG9ja2VkRWRnZSgpKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fc2VjdGlvbklzSW1tZWRpYXRlKCkpIHtcbiAgICAgICAgICAgICAgICBibG9ja2VkID0gdGhpcy5fc2VjdGlvbkdldEJsb2NrZWRFZGdlKCk7XG4gICAgICAgICAgICAgICAgYXNzZXJ0KGJsb2NrZWQgIT09IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0Ll9ibG9ja1B1c2hGb3J3YXJkOiBibG9ja2VkICE9PSBudWxsIEZBSUxFRCcpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGJsb2NrZWQuZ2V0QmxvY2tQcmV2KCkgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgbW9kaWZpZWQgPSB0aGlzLl9ibG9ja1B1c2hCYWNrd2FyZChibG9ja2VkLCBibG9ja2VyKSB8fCBtb2RpZmllZDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoIWJsb2NrZXIuZWRnZUZpeGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChibG9ja2VkLmJyYWNrZXRPcGVuaW5nIHx8IGJsb2NrZXIuYnJhY2tldENsb3NpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzTWluRiA8IGJsb2NrZWQucG9zaXRpb25ZKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc01pbkYgPSBibG9ja2VkLnBvc2l0aW9uWTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzbWluID0gYmxvY2tlZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChiTWluRiA8IGJsb2NrZWQucG9zaXRpb25ZKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYk1pbkYgPSBibG9ja2VkLnBvc2l0aW9uWTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBibWluID0gYmxvY2tlZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGJtaW4pIHtcbiAgICAgICAgICAgIGlmIChzbWluKSB7XG4gICAgICAgICAgICAgICAgYmxvY2tlci5zZXRDbG9zZXN0UHJldihzTWluRiA+IGJNaW5GID8gc21pbiA6IGJtaW4pO1xuXG4gICAgICAgICAgICAgICAgYk1pbkYgPSBibG9ja2VyLnBvc2l0aW9uWSAtIGJNaW5GO1xuICAgICAgICAgICAgICAgIHNNaW5GID0gdGhpcy5fYmxvY2tHZXRGKGJsb2NrZXIucG9zaXRpb25ZIC0gc01pbkYsIDAsIDEpO1xuXG4gICAgICAgICAgICAgICAgYmxvY2tlci5zZXRCbG9ja1ByZXYoc01pbkYgPCBiTWluRiA/IHNtaW4gOiBibWluKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYmxvY2tlci5zZXRCbG9ja1ByZXYoYm1pbik7XG4gICAgICAgICAgICAgICAgYmxvY2tlci5zZXRDbG9zZXN0UHJldihibWluKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGJsb2NrZXIuc2V0QmxvY2tQcmV2KHNtaW4pO1xuICAgICAgICAgICAgYmxvY2tlci5zZXRDbG9zZXN0UHJldihzbWluKTtcbiAgICAgICAgfVxuXG5cbiAgICAgICAgYmxvY2tlciA9IGJsb2NrZXIub3JkZXJOZXh0O1xuICAgIH1cblxuICAgIHRoaXMuX3Bvc2l0aW9uQWxsU3RvcmVZKCk7XG5cbiAgICByZXR1cm4gbW9kaWZpZWQ7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLmJsb2NrU2NhbkJhY2t3YXJkID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuX3Bvc2l0aW9uQWxsTG9hZFgoKTtcblxuICAgIHZhciBtb2RpZmllZCA9IGZhbHNlO1xuXG4gICAgdGhpcy5zZWN0aW9uUmVzZXQoKTtcbiAgICB2YXIgYmxvY2tlciA9IHRoaXMub3JkZXJMYXN0LFxuICAgICAgICBibG9ja2VkLFxuICAgICAgICBibWluLFxuICAgICAgICBzbWluLFxuICAgICAgICBiTWluRixcbiAgICAgICAgc01pbkY7XG5cbiAgICB3aGlsZSAoYmxvY2tlcikge1xuICAgICAgICBibWluID0gbnVsbDtcbiAgICAgICAgc21pbiA9IG51bGw7XG4gICAgICAgIGJNaW5GID0gQ09OU1RBTlRTLkVEX01BWENPT1JEICsgMTtcbiAgICAgICAgc01pbkYgPSBDT05TVEFOVFMuRURfTUFYQ09PUkQgKyAxO1xuXG4gICAgICAgIHRoaXMuX3NlY3Rpb25CZWdpblNjYW4oYmxvY2tlcik7XG5cbiAgICAgICAgd2hpbGUgKHRoaXMuX3NlY3Rpb25IYXNCbG9ja2VkRWRnZSgpKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fc2VjdGlvbklzSW1tZWRpYXRlKCkpIHtcbiAgICAgICAgICAgICAgICBibG9ja2VkID0gdGhpcy5fc2VjdGlvbkdldEJsb2NrZWRFZGdlKCk7XG5cbiAgICAgICAgICAgICAgICBhc3NlcnQoYmxvY2tlZCAhPT0gbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgJ0FSRWRnZUxpc3QuYmxvY2tTY2FuQmFja3dhcmQ6IGJsb2NrZWQgIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICAgICAgICAgICAgICBpZiAoYmxvY2tlZC5nZXRCbG9ja05leHQoKSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICBtb2RpZmllZCA9IHRoaXMuX2Jsb2NrUHVzaEZvcndhcmQoYmxvY2tlZCwgYmxvY2tlcikgfHwgbW9kaWZpZWQ7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKCFibG9ja2VyLmVkZ2VGaXhlZCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoYmxvY2tlci5icmFja2V0T3BlbmluZyB8fCBibG9ja2VkLmJyYWNrZXRDbG9zaW5nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc01pbkYgPiBibG9ja2VkLnBvc2l0aW9uWSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNNaW5GID0gYmxvY2tlZC5wb3NpdGlvblk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc21pbiA9IGJsb2NrZWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYk1pbkYgPiBibG9ja2VkLnBvc2l0aW9uWSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJNaW5GID0gYmxvY2tlZC5wb3NpdGlvblk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYm1pbiA9IGJsb2NrZWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYm1pbikge1xuICAgICAgICAgICAgaWYgKHNtaW4pIHtcbiAgICAgICAgICAgICAgICBibG9ja2VyLnNldENsb3Nlc3ROZXh0KHNNaW5GIDwgYk1pbkYgPyBzbWluIDogYm1pbik7XG5cbiAgICAgICAgICAgICAgICBiTWluRiA9IGJNaW5GIC0gYmxvY2tlci5wb3NpdGlvblk7XG4gICAgICAgICAgICAgICAgc01pbkYgPSB0aGlzLl9ibG9ja0dldEYoc01pbkYgLSBibG9ja2VyLnBvc2l0aW9uWSwgMCwgMSk7XG5cbiAgICAgICAgICAgICAgICBibG9ja2VyLnNldEJsb2NrTmV4dChzTWluRiA8IGJNaW5GID8gc21pbiA6IGJtaW4pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBibG9ja2VyLnNldEJsb2NrTmV4dChibWluKTtcbiAgICAgICAgICAgICAgICBibG9ja2VyLnNldENsb3Nlc3ROZXh0KGJtaW4pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYmxvY2tlci5zZXRCbG9ja05leHQoc21pbik7XG4gICAgICAgICAgICBibG9ja2VyLnNldENsb3Nlc3ROZXh0KHNtaW4pO1xuICAgICAgICB9XG5cbiAgICAgICAgYmxvY2tlciA9IGJsb2NrZXIub3JkZXJQcmV2O1xuICAgIH1cblxuICAgIHRoaXMuX3Bvc2l0aW9uQWxsU3RvcmVZKCk7XG5cbiAgICByZXR1cm4gbW9kaWZpZWQ7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLmJsb2NrU3dpdGNoV3JvbmdzID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciB3YXMgPSBmYWxzZTtcblxuICAgIHRoaXMuX3Bvc2l0aW9uQWxsTG9hZFgoKTtcbiAgICB2YXIgc2Vjb25kID0gdGhpcy5vcmRlckZpcnN0LFxuICAgICAgICBlZGdlLFxuICAgICAgICBuZXh0LFxuICAgICAgICBleSxcbiAgICAgICAgbnksXG4gICAgICAgIGE7XG5cbiAgICB3aGlsZSAoc2Vjb25kICE9PSBudWxsKSB7XG4gICAgICAgIC8vQ2hlY2sgaWYgaXQgcmVmZXJlbmNlcyBpdHNlbGZcbiAgICAgICAgaWYgKHNlY29uZC5nZXRDbG9zZXN0UHJldigpICE9PSBudWxsICYmIHNlY29uZC5nZXRDbG9zZXN0UHJldigpLmdldENsb3Nlc3ROZXh0KCkgIT09IChzZWNvbmQpICYmXG4gICAgICAgICAgICBzZWNvbmQuZ2V0Q2xvc2VzdE5leHQoKSAhPT0gbnVsbCAmJiBzZWNvbmQuZ2V0Q2xvc2VzdE5leHQoKS5nZXRDbG9zZXN0UHJldigpID09PSAoc2Vjb25kKSkge1xuXG4gICAgICAgICAgICBhc3NlcnQoIXNlY29uZC5lZGdlRml4ZWQsXG4gICAgICAgICAgICAgICAgJ0FSRWRnZUxpc3QuYmxvY2tTd2l0Y2hXcm9uZ3M6ICFzZWNvbmQuZWRnZUZpeGVkIEZBSUxFRCcpO1xuXG4gICAgICAgICAgICBlZGdlID0gc2Vjb25kO1xuICAgICAgICAgICAgbmV4dCA9IGVkZ2UuZ2V0Q2xvc2VzdE5leHQoKTtcblxuICAgICAgICAgICAgd2hpbGUgKG5leHQgIT09IG51bGwgJiYgZWRnZSA9PT0gbmV4dC5nZXRDbG9zZXN0UHJldigpKSB7XG4gICAgICAgICAgICAgICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwgJiYgIWVkZ2UuZWRnZUZpeGVkLFxuICAgICAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5ibG9ja1N3aXRjaFdyb25nczogZWRnZSAhPSBudWxsICYmICFlZGdlLmVkZ2VGaXhlZCBGQUlMRUQnKTtcbiAgICAgICAgICAgICAgICBhc3NlcnQobmV4dCAhPT0gbnVsbCAmJiAhbmV4dC5lZGdlRml4ZWQsXG4gICAgICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0LmJsb2NrU3dpdGNoV3JvbmdzOiBuZXh0ICE9IG51bGwgJiYgIW5leHQuZWRnZUZpeGVkIEZBSUxFRCcpO1xuXG4gICAgICAgICAgICAgICAgZXkgPSBlZGdlLnBvc2l0aW9uWTtcbiAgICAgICAgICAgICAgICBueSA9IG5leHQucG9zaXRpb25ZO1xuXG4gICAgICAgICAgICAgICAgYXNzZXJ0KGV5IDw9IG55LFxuICAgICAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5ibG9ja1N3aXRjaFdyb25nczogZXkgPD0gbnkgRkFJTEVEJyk7XG5cbiAgICAgICAgICAgICAgICBpZiAoZXkgKyAxIDw9IG55ICYmIHRoaXMuX2JyYWNrZXRTaG91bGRCZVN3aXRjaGVkKGVkZ2UsIG5leHQpKSB7XG4gICAgICAgICAgICAgICAgICAgIHdhcyA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KCFlZGdlLmdldEVkZ2VDYW5wYXNzZWQoKSAmJiAhbmV4dC5nZXRFZGdlQ2FucGFzc2VkKCksXG4gICAgICAgICAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5ibG9ja1N3aXRjaFdyb25nczogIWVkZ2UuZ2V0RWRnZUNhbnBhc3NlZCgpICYmICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgJyFuZXh0LmdldEVkZ2VDYW5wYXNzZWQoKSBGQUlMRUQnKTtcbiAgICAgICAgICAgICAgICAgICAgZWRnZS5zZXRFZGdlQ2FucGFzc2VkKHRydWUpO1xuICAgICAgICAgICAgICAgICAgICBuZXh0LnNldEVkZ2VDYW5wYXNzZWQodHJ1ZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgYSA9IHRoaXMuX3NsaWRlQnV0Tm90UGFzc0VkZ2VzKGVkZ2UsIChueSArIGV5KSAvIDIgKyAwLjAwMSkgIT09IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGEgPSB0aGlzLl9zbGlkZUJ1dE5vdFBhc3NFZGdlcyhuZXh0LCAobnkgKyBleSkgLyAyIC0gMC4wMDEpICE9PSBudWxsIHx8IGE7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVkZ2Uuc2V0Q2xvc2VzdFByZXYobnVsbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlZGdlLnNldENsb3Nlc3ROZXh0KG51bGwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbmV4dC5zZXRDbG9zZXN0UHJldihudWxsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5leHQuc2V0Q2xvc2VzdE5leHQobnVsbCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGVkZ2Uuc2V0RWRnZUNhbnBhc3NlZChmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBuZXh0LnNldEVkZ2VDYW5wYXNzZWQoZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAoZWRnZS5nZXRDbG9zZXN0UHJldigpICE9PSBudWxsICYmIGVkZ2UuZ2V0Q2xvc2VzdFByZXYoKS5nZXRDbG9zZXN0TmV4dCgpID09PSBlZGdlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlZGdlLmdldENsb3Nlc3RQcmV2KCkuc2V0Q2xvc2VzdE5leHQobmV4dCk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAobmV4dC5nZXRDbG9zZXN0TmV4dCgpICE9PSBudWxsICYmIG5leHQuZ2V0Q2xvc2VzdE5leHQoKS5nZXRDbG9zZXN0UHJldigpID09PSBuZXh0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuZXh0LmdldENsb3Nlc3ROZXh0KCkuc2V0Q2xvc2VzdFByZXYoZWRnZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBlZGdlLnNldENsb3Nlc3ROZXh0KG5leHQuZ2V0Q2xvc2VzdE5leHQoKSk7XG4gICAgICAgICAgICAgICAgICAgIG5leHQuc2V0Q2xvc2VzdE5leHQoZWRnZSk7XG4gICAgICAgICAgICAgICAgICAgIG5leHQuc2V0Q2xvc2VzdFByZXYoZWRnZS5nZXRDbG9zZXN0UHJldigpKTtcbiAgICAgICAgICAgICAgICAgICAgZWRnZS5zZXRDbG9zZXN0UHJldihuZXh0KTtcblxuICAgICAgICAgICAgICAgICAgICBlZGdlLnNldEVkZ2VDYW5wYXNzZWQoZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICBuZXh0LnNldEVkZ2VDYW5wYXNzZWQoZmFsc2UpO1xuXG4gICAgICAgICAgICAgICAgICAgIGFzc2VydCghdGhpcy5fYnJhY2tldFNob3VsZEJlU3dpdGNoZWQobmV4dCwgZWRnZSksXG4gICAgICAgICAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5ibG9ja1N3aXRjaFdyb25nczogIWJyYWNrZXRTaG91bGRCZVN3aXRjaGVkKG5leHQsIGVkZ2UpIEZBSUxFRCcpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChuZXh0LmdldENsb3Nlc3RQcmV2KCkgIT09IG51bGwgJiYgbmV4dC5nZXRDbG9zZXN0UHJldigpLmdldENsb3Nlc3ROZXh0KCkgPT09IG5leHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVkZ2UgPSBuZXh0LmdldENsb3Nlc3RQcmV2KCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuZXh0ID0gZWRnZS5nZXRDbG9zZXN0TmV4dCgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZWRnZSA9IG5leHQ7XG4gICAgICAgICAgICAgICAgICAgIG5leHQgPSBuZXh0LmdldENsb3Nlc3ROZXh0KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgc2Vjb25kID0gc2Vjb25kLm9yZGVyTmV4dDtcbiAgICB9XG5cbiAgICBpZiAod2FzKSB7XG4gICAgICAgIHRoaXMuX3Bvc2l0aW9uQWxsU3RvcmVZKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHdhcztcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuYXNzZXJ0VmFsaWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgLy8gQ2hlY2sgdGhhdCBhbGwgZWRnZXMgaGF2ZSBzdGFydC9lbmQgcG9pbnRzXG4gICAgdmFyIGVkZ2UgPSB0aGlzLm9yZGVyRmlyc3Q7XG4gICAgd2hpbGUgKGVkZ2UpIHtcbiAgICAgICAgYXNzZXJ0KGVkZ2Uuc3RhcnRwb2ludC54ICE9PSB1bmRlZmluZWQsICdFZGdlIGhhcyB1bnJlY29nbml6ZWQgc3RhcnRwb2ludDogJyArIGVkZ2Uuc3RhcnRwb2ludCk7XG4gICAgICAgIGFzc2VydChlZGdlLmVuZHBvaW50LnggIT09IHVuZGVmaW5lZCwgJ0VkZ2UgaGFzIHVucmVjb2duaXplZCBlbmRwb2ludDogJyArIGVkZ2UuZW5kcG9pbnQpO1xuICAgICAgICBlZGdlID0gZWRnZS5vcmRlck5leHQ7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBdXRvUm91dGVyRWRnZUxpc3Q7XG4iLCIvKmdsb2JhbHMgZGVmaW5lLCBXZWJHTUVHbG9iYWwqL1xuLypqc2hpbnQgbm9kZTogdHJ1ZSovXG5cbi8qKlxuICogQGF1dGhvciBicm9sbGIgLyBodHRwczovL2dpdGh1Yi9icm9sbGJcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBMb2dnZXIgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuTG9nZ2VyJyksICAvLyBGSVhNRVxuICAgIENPTlNUQU5UUyA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Db25zdGFudHMnKSxcbiAgICBVdGlscyA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5VdGlscycpLFxuICAgIGFzc2VydCA9IFV0aWxzLmFzc2VydCxcbiAgICBBclBvaW50ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlBvaW50JyksXG4gICAgQXJQb2ludExpc3RQYXRoID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlBvaW50TGlzdCcpLFxuICAgIEFyUmVjdCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5SZWN0JyksXG4gICAgQXV0b1JvdXRlclBhdGggPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUGF0aCcpLFxuICAgIEF1dG9Sb3V0ZXJQb3J0ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlBvcnQnKSxcbiAgICBBdXRvUm91dGVyQm94ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLkJveCcpLFxuICAgIEF1dG9Sb3V0ZXJFZGdlID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLkVkZ2UnKSxcbiAgICBBdXRvUm91dGVyRWRnZUxpc3QgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuRWRnZUxpc3QnKTtcblxudmFyIF9sb2dnZXIgPSBuZXcgTG9nZ2VyKCdBdXRvUm91dGVyLkdyYXBoJyksXG4gICAgQ09VTlRFUiA9IDE7ICAvLyBVc2VkIGZvciB1bmlxdWUgaWRzXG5cbnZhciBBdXRvUm91dGVyR3JhcGggPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5jb21wbGV0ZWx5Q29ubmVjdGVkID0gdHJ1ZTsgIC8vIHRydWUgaWYgYWxsIHBhdGhzIGFyZSBjb25uZWN0ZWRcbiAgICB0aGlzLmhvcml6b250YWwgPSBuZXcgQXV0b1JvdXRlckVkZ2VMaXN0KHRydWUpO1xuICAgIHRoaXMudmVydGljYWwgPSBuZXcgQXV0b1JvdXRlckVkZ2VMaXN0KGZhbHNlKTtcbiAgICB0aGlzLmJveGVzID0ge307XG4gICAgdGhpcy5wYXRocyA9IFtdO1xuICAgIHRoaXMuYnVmZmVyQm94ZXMgPSBbXTtcbiAgICB0aGlzLmJveDJidWZmZXJCb3ggPSB7fTsgLy8gbWFwcyBib3hJZCB0byBjb3JyZXNwb25kaW5nIGJ1ZmZlcmJveCBvYmplY3RcblxuICAgIHRoaXMuaG9yaXpvbnRhbC5vd25lciA9IHRoaXM7XG4gICAgdGhpcy52ZXJ0aWNhbC5vd25lciA9IHRoaXM7XG5cbiAgICAvL0luaXRpYWxpemluZyBzZWxmUG9pbnRzXG4gICAgdGhpcy5zZWxmUG9pbnRzID0gW1xuICAgICAgICBuZXcgQXJQb2ludChDT05TVEFOVFMuRURfTUlOQ09PUkQsIENPTlNUQU5UUy5FRF9NSU5DT09SRCksXG4gICAgICAgIG5ldyBBclBvaW50KENPTlNUQU5UUy5FRF9NQVhDT09SRCwgQ09OU1RBTlRTLkVEX01JTkNPT1JEKSxcbiAgICAgICAgbmV3IEFyUG9pbnQoQ09OU1RBTlRTLkVEX01BWENPT1JELCBDT05TVEFOVFMuRURfTUFYQ09PUkQpLFxuICAgICAgICBuZXcgQXJQb2ludChDT05TVEFOVFMuRURfTUlOQ09PUkQsIENPTlNUQU5UUy5FRF9NQVhDT09SRClcbiAgICBdO1xuXG4gICAgdGhpcy5fYWRkU2VsZkVkZ2VzKCk7XG59O1xuXG4vL0Z1bmN0aW9uc1xuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fZGVsZXRlQWxsQm94ZXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGlkcyA9IE9iamVjdC5rZXlzKHRoaXMuYm94ZXMpO1xuICAgIGZvciAodmFyIGkgPSBpZHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHRoaXMuYm94ZXNbaWRzW2ldXS5kZXN0cm95KCk7XG4gICAgICAgIGRlbGV0ZSB0aGlzLmJveGVzW2lkc1tpXV07XG4gICAgfVxuICAgIC8vIENsZWFuIHVwIHRoZSBidWZmZXJCb3hlc1xuICAgIHRoaXMuYnVmZmVyQm94ZXMgPSBbXTtcbiAgICB0aGlzLmJveDJidWZmZXJCb3ggPSB7fTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2dldEJveEF0ID0gZnVuY3Rpb24gKHBvaW50LCBuZWFybmVzcykge1xuICAgIHZhciBpZHMgPSBPYmplY3Qua2V5cyh0aGlzLmJveGVzKTtcbiAgICBmb3IgKHZhciBpID0gaWRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICBpZiAodGhpcy5ib3hlc1tpZHNbaV1dLmlzQm94QXQocG9pbnQsIG5lYXJuZXNzKSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuYm94ZXNbaWRzW2ldXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fc2V0UG9ydEF0dHIgPSBmdW5jdGlvbiAocG9ydCwgYXR0cikge1xuICAgIHRoaXMuX2Rpc2Nvbm5lY3RQYXRoc0Zyb20ocG9ydCk7XG4gICAgcG9ydC5hdHRyaWJ1dGVzID0gYXR0cjtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2lzUmVjdENsaXBCb3hlcyA9IGZ1bmN0aW9uIChyZWN0KSB7XG4gICAgdmFyIGJveFJlY3Q7XG4gICAgdmFyIGlkcyA9IE9iamVjdC5rZXlzKHRoaXMuYm94ZXMpO1xuICAgIGZvciAodmFyIGkgPSBpZHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIGJveFJlY3QgPSB0aGlzLmJveGVzW2lkc1tpXV0ucmVjdDtcbiAgICAgICAgaWYgKFV0aWxzLmlzUmVjdENsaXAocmVjdCwgYm94UmVjdCkpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2lzUmVjdENsaXBCdWZmZXJCb3hlcyA9IGZ1bmN0aW9uIChyZWN0KSB7XG4gICAgdmFyIGkgPSB0aGlzLmJ1ZmZlckJveGVzLmxlbmd0aCxcbiAgICAgICAgYztcblxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgYyA9IHRoaXMuYnVmZmVyQm94ZXNbaV0uY2hpbGRyZW4ubGVuZ3RoO1xuXG4gICAgICAgIHdoaWxlIChjLS0pIHtcbiAgICAgICAgICAgIGlmIChVdGlscy5pc1JlY3RDbGlwKHJlY3QsIHRoaXMuYnVmZmVyQm94ZXNbaV0uY2hpbGRyZW5bY10pKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9pc0xpbmVDbGlwQnVmZmVyQm94ZXMgPSBmdW5jdGlvbiAocDEsIHAyKSB7XG4gICAgdmFyIHJlY3QgPSBuZXcgQXJSZWN0KHAxLCBwMik7XG4gICAgcmVjdC5ub3JtYWxpemVSZWN0KCk7XG4gICAgYXNzZXJ0KHJlY3QubGVmdCA9PT0gcmVjdC5yaWdodCB8fCByZWN0LmNlaWwgPT09IHJlY3QuZmxvb3IsXG4gICAgICAgICdBUkdyYXBoLnRoaXMuX2lzTGluZUNsaXBCb3hlczogcmVjdC5sZWZ0ID09PSByZWN0LnJpZ2h0IHx8IHJlY3QuY2VpbCA9PT0gcmVjdC5mbG9vciBGQUlMRUQnKTtcblxuICAgIGlmIChyZWN0LmxlZnQgPT09IHJlY3QucmlnaHQpIHtcbiAgICAgICAgcmVjdC5yaWdodCsrO1xuICAgIH1cbiAgICBpZiAocmVjdC5jZWlsID09PSByZWN0LmZsb29yKSB7XG4gICAgICAgIHJlY3QuZmxvb3IrKztcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5faXNSZWN0Q2xpcEJ1ZmZlckJveGVzKHJlY3QpO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5faXNMaW5lQ2xpcEJveGVzID0gZnVuY3Rpb24gKHAxLCBwMikge1xuICAgIHZhciByZWN0ID0gbmV3IEFyUmVjdChwMSwgcDIpO1xuICAgIHJlY3Qubm9ybWFsaXplUmVjdCgpO1xuICAgIGFzc2VydChyZWN0LmxlZnQgPT09IHJlY3QucmlnaHQgfHwgcmVjdC5jZWlsID09PSByZWN0LmZsb29yLFxuICAgICAgICAnQVJHcmFwaC5pc0xpbmVDbGlwQm94ZXM6IHJlY3QubGVmdCA9PT0gcmVjdC5yaWdodCB8fCByZWN0LmNlaWwgPT09IHJlY3QuZmxvb3IgRkFJTEVEJyk7XG5cbiAgICBpZiAocmVjdC5sZWZ0ID09PSByZWN0LnJpZ2h0KSB7XG4gICAgICAgIHJlY3QucmlnaHQrKztcbiAgICB9XG4gICAgaWYgKHJlY3QuY2VpbCA9PT0gcmVjdC5mbG9vcikge1xuICAgICAgICByZWN0LmZsb29yKys7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuX2lzUmVjdENsaXBCb3hlcyhyZWN0KTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2NhbkJveEF0ID0gZnVuY3Rpb24gKHJlY3QpIHtcbiAgICByZXR1cm4gIXRoaXMuX2lzUmVjdENsaXBCb3hlcy5pbmZsYXRlZFJlY3QocmVjdCwgMSk7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9hZGQgPSBmdW5jdGlvbiAocGF0aCkge1xuICAgIGFzc2VydChwYXRoICE9PSBudWxsLCAnQVJHcmFwaC5hZGQ6IHBhdGggIT09IG51bGwgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KCFwYXRoLmhhc093bmVyKCksICdBUkdyYXBoLmFkZDogIXBhdGguaGFzT3duZXIoKSBGQUlMRUQnKTtcblxuICAgIHBhdGgub3duZXIgPSB0aGlzO1xuXG4gICAgdGhpcy5wYXRocy5wdXNoKHBhdGgpO1xuXG4gICAgdGhpcy5ob3Jpem9udGFsLmFkZFBhdGhFZGdlcyhwYXRoKTtcbiAgICB0aGlzLnZlcnRpY2FsLmFkZFBhdGhFZGdlcyhwYXRoKTtcblxuICAgIGlmIChDT05TVEFOVFMuREVCVUcpIHtcbiAgICAgICAgdGhpcy5fYXNzZXJ0VmFsaWRQYXRoKHBhdGgpO1xuICAgIH1cblxufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fZGVsZXRlQWxsUGF0aHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgZm9yICh2YXIgaSA9IHRoaXMucGF0aHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHRoaXMucGF0aHNbaV0uZGVzdHJveSgpOyAgLy8gUmVtb3ZlIHBvaW50IGZyb20gc3RhcnQvZW5kIHBvcnRcbiAgICB9XG5cbiAgICB0aGlzLnBhdGhzID0gW107XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9oYXNOb1BhdGggPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMucGF0aHMubGVuZ3RoID09PSAwO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fZ2V0UGF0aENvdW50ID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLnBhdGhzLmxlbmd0aDtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2dldExpc3RFZGdlQXQgPSBmdW5jdGlvbiAocG9pbnQsIG5lYXJuZXNzKSB7XG5cbiAgICB2YXIgZWRnZSA9IHRoaXMuaG9yaXpvbnRhbC5nZXRFZGdlQXQocG9pbnQsIG5lYXJuZXNzKTtcbiAgICBpZiAoZWRnZSkge1xuICAgICAgICByZXR1cm4gZWRnZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy52ZXJ0aWNhbC5nZXRFZGdlQXQocG9pbnQsIG5lYXJuZXNzKTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2dldFN1cnJvdW5kUmVjdCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgcmVjdCA9IG5ldyBBclJlY3QoMCwgMCwgMCwgMCksXG4gICAgICAgIGk7XG5cbiAgICB2YXIgaWRzID0gT2JqZWN0LmtleXModGhpcy5ib3hlcyk7XG4gICAgZm9yIChpID0gaWRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICByZWN0LnVuaW9uQXNzaWduKHRoaXMuYm94ZXNbaWRzW2ldXS5yZWN0KTtcbiAgICB9XG5cbiAgICBmb3IgKGkgPSB0aGlzLnBhdGhzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICByZWN0LnVuaW9uQXNzaWduKHRoaXMucGF0aHNbaV0uZ2V0U3Vycm91bmRSZWN0KCkpO1xuICAgIH1cblxuICAgIHJldHVybiByZWN0O1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fZ2V0T3V0T2ZCb3ggPSBmdW5jdGlvbiAoZGV0YWlscykge1xuICAgIHZhciBidWZmZXJPYmplY3QgPSB0aGlzLmJveDJidWZmZXJCb3hbZGV0YWlscy5ib3guaWRdLFxuICAgICAgICBjaGlsZHJlbiA9IGJ1ZmZlck9iamVjdC5jaGlsZHJlbixcbiAgICAgICAgaSA9IGJ1ZmZlck9iamVjdC5jaGlsZHJlbi5sZW5ndGgsXG4gICAgICAgIHBvaW50ID0gZGV0YWlscy5wb2ludCxcbiAgICAgICAgZGlyID0gZGV0YWlscy5kaXIsXG4gICAgICAgIGJveFJlY3QgPSBuZXcgQXJSZWN0KGRldGFpbHMuYm94LnJlY3QpO1xuXG4gICAgYm94UmVjdC5pbmZsYXRlUmVjdChDT05TVEFOVFMuQlVGRkVSKTsgLy9DcmVhdGUgYSBjb3B5IG9mIHRoZSBidWZmZXIgYm94XG5cbiAgICBhc3NlcnQoVXRpbHMuaXNSaWdodEFuZ2xlKGRpciksICdBUkdyYXBoLmdldE91dE9mQm94OiBVdGlscy5pc1JpZ2h0QW5nbGUgKGRpcikgRkFJTEVEJyk7XG5cbiAgICB3aGlsZSAoYm94UmVjdC5wdEluUmVjdChwb2ludCkpIHtcbiAgICAgICAgaWYgKFV0aWxzLmlzSG9yaXpvbnRhbChkaXIpKSB7XG4gICAgICAgICAgICBwb2ludC54ID0gVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQoYm94UmVjdCwgZGlyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBvaW50LnkgPSBVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChib3hSZWN0LCBkaXIpO1xuICAgICAgICB9XG5cbiAgICAgICAgd2hpbGUgKGktLSkge1xuICAgICAgICAgICAgaWYgKGNoaWxkcmVuW2ldLnB0SW5SZWN0KHBvaW50KSkge1xuICAgICAgICAgICAgICAgIGJveFJlY3QgPSBjaGlsZHJlbltpXTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpID0gYnVmZmVyT2JqZWN0LmNoaWxkcmVuLmxlbmd0aDtcbiAgICB9XG5cbiAgICBhc3NlcnQoIWJveFJlY3QucHRJblJlY3QocG9pbnQpLCAnQVJHcmFwaC5nZXRPdXRPZkJveDogIWJveFJlY3QucHRJblJlY3QoIHBvaW50KSBGQUlMRUQnKTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2dvVG9OZXh0QnVmZmVyQm94ID0gZnVuY3Rpb24gKGFyZ3MpIHtcbiAgICB2YXIgcG9pbnQgPSBhcmdzLnBvaW50LFxuICAgICAgICBlbmQgPSBhcmdzLmVuZCxcbiAgICAgICAgZGlyID0gYXJncy5kaXIsXG4gICAgICAgIGRpcjIgPSBhcmdzLmRpcjIgPT09IHVuZGVmaW5lZCB8fCAhVXRpbHMuaXNSaWdodEFuZ2xlKGFyZ3MuZGlyMikgPyAoZW5kIGluc3RhbmNlb2YgQXJQb2ludCA/XG4gICAgICAgICAgICBVdGlscy5leEdldE1ham9yRGlyKGVuZC5taW51cyhwb2ludCkpIDogQ09OU1RBTlRTLkRpck5vbmUpIDogYXJncy5kaXIyLFxuICAgICAgICBzdG9waGVyZSA9IGFyZ3MuZW5kICE9PSB1bmRlZmluZWQgPyBhcmdzLmVuZCA6XG4gICAgICAgICAgICAoZGlyID09PSAxIHx8IGRpciA9PT0gMiA/IENPTlNUQU5UUy5FRF9NQVhDT09SRCA6IENPTlNUQU5UUy5FRF9NSU5DT09SRCApO1xuXG4gICAgaWYgKGRpcjIgPT09IGRpcikge1xuICAgICAgICBkaXIyID0gVXRpbHMuaXNSaWdodEFuZ2xlKFV0aWxzLmV4R2V0TWlub3JEaXIoZW5kLm1pbnVzKHBvaW50KSkpID9cbiAgICAgICAgICAgIFV0aWxzLmV4R2V0TWlub3JEaXIoZW5kLm1pbnVzKHBvaW50KSkgOiAoZGlyICsgMSkgJSA0O1xuICAgIH1cblxuICAgIGlmIChlbmQgaW5zdGFuY2VvZiBBclBvaW50KSB7XG4gICAgICAgIHN0b3BoZXJlID0gVXRpbHMuZ2V0UG9pbnRDb29yZChzdG9waGVyZSwgZGlyKTtcbiAgICB9XG5cbiAgICBhc3NlcnQoVXRpbHMuaXNSaWdodEFuZ2xlKGRpciksICdBckdyYXBoLmdvVG9OZXh0QnVmZmVyQm94OiBVdGlscy5pc1JpZ2h0QW5nbGUgKGRpcikgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KFV0aWxzLmdldFBvaW50Q29vcmQocG9pbnQsIGRpcikgIT09IHN0b3BoZXJlLFxuICAgICAgICAnQXJHcmFwaC5nb1RvTmV4dEJ1ZmZlckJveDogVXRpbHMuZ2V0UG9pbnRDb29yZCAocG9pbnQsIGRpcikgIT09IHN0b3BoZXJlIEZBSUxFRCcpO1xuXG4gICAgdmFyIGJveGJ5ID0gbnVsbCxcbiAgICAgICAgaSA9IC0xLFxuICAgICAgICBib3hSZWN0O1xuICAgIC8vanNjczpkaXNhYmxlIG1heGltdW1MaW5lTGVuZ3RoXG4gICAgd2hpbGUgKCsraSA8IHRoaXMuYnVmZmVyQm94ZXMubGVuZ3RoKSB7XG4gICAgICAgIGJveFJlY3QgPSB0aGlzLmJ1ZmZlckJveGVzW2ldLmJveDtcblxuICAgICAgICBpZiAoIVV0aWxzLmlzUG9pbnRJbkRpckZyb20ocG9pbnQsIGJveFJlY3QsIGRpcikgJiYgLy9BZGQgc3VwcG9ydCBmb3IgZW50ZXJpbmcgdGhlIHBhcmVudCBib3hcbiAgICAgICAgICAgIFV0aWxzLmlzUG9pbnRCZXR3ZWVuU2lkZXMocG9pbnQsIGJveFJlY3QsIGRpcikgJiYgIC8vIGlmIGl0IHdpbGwgbm90IHB1dCB0aGUgcG9pbnQgaW4gYSBjb3JuZXIgKHJlbGF0aXZlIHRvIGRpcjIpXG4gICAgICAgICAgICBVdGlscy5pc0Nvb3JkSW5EaXJGcm9tKHN0b3BoZXJlLFxuICAgICAgICAgICAgICAgIFV0aWxzLmdldENoaWxkUmVjdE91dGVyQ29vcmRGcm9tKHRoaXMuYnVmZmVyQm94ZXNbaV0sIGRpciwgcG9pbnQpLmNvb3JkLCBkaXIpKSB7XG4gICAgICAgICAgICAvL1JldHVybiBleHRyZW1lIChwYXJlbnQgYm94KSBmb3IgdGhpcyBjb21wYXJpc29uXG4gICAgICAgICAgICBzdG9waGVyZSA9IFV0aWxzLmdldENoaWxkUmVjdE91dGVyQ29vcmRGcm9tKHRoaXMuYnVmZmVyQm94ZXNbaV0sIGRpciwgcG9pbnQpLmNvb3JkO1xuICAgICAgICAgICAgYm94YnkgPSB0aGlzLmJ1ZmZlckJveGVzW2ldO1xuICAgICAgICB9XG4gICAgfVxuICAgIC8vanNjczplbmFibGUgbWF4aW11bUxpbmVMZW5ndGhcblxuICAgIGlmIChVdGlscy5pc0hvcml6b250YWwoZGlyKSkge1xuICAgICAgICBwb2ludC54ID0gc3RvcGhlcmU7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcG9pbnQueSA9IHN0b3BoZXJlO1xuICAgIH1cblxuICAgIHJldHVybiBib3hieTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2h1Z0NoaWxkcmVuID0gZnVuY3Rpb24gKGJ1ZmZlck9iamVjdCwgcG9pbnQsIGRpcjEsIGRpcjIsIGV4aXRDb25kaXRpb24pIHtcbiAgICAvLyBUaGlzIG1ldGhvZCBjcmVhdGVzIGEgcGF0aCB0aGF0IGVudGVycyB0aGUgcGFyZW50IGJveCBhbmQgJ2h1Z3MnIHRoZSBjaGlsZHJlbiBib3hlc1xuICAgIC8vIChyZW1haW5zIHdpdGhpbiBvbmUgcGl4ZWwgb2YgdGhlbSkgYW5kIGZvbGxvd3MgdGhlbSBvdXQuXG4gICAgYXNzZXJ0KChkaXIxICsgZGlyMikgJSAyID09PSAxLCAnQVJHcmFwaC5odWdDaGlsZHJlbjogT25lIGFuZCBvbmx5IG9uZSBkaXJlY3Rpb24gbXVzdCBiZSBob3Jpem9udGFsJyk7XG4gICAgdmFyIGNoaWxkcmVuID0gYnVmZmVyT2JqZWN0LmNoaWxkcmVuLFxuICAgICAgICBwYXJlbnRCb3ggPSBidWZmZXJPYmplY3QuYm94LFxuICAgICAgICBpbml0UG9pbnQgPSBuZXcgQXJQb2ludChwb2ludCksXG4gICAgICAgIGNoaWxkID0gdGhpcy5fZ29Ub05leHRCb3gocG9pbnQsIGRpcjEsIChkaXIxID09PSAxIHx8IGRpcjEgPT09IDIgP1xuICAgICAgICAgICAgQ09OU1RBTlRTLkVEX01BWENPT1JEIDogQ09OU1RBTlRTLkVEX01JTkNPT1JEICksIGNoaWxkcmVuKSxcbiAgICAgICAgZmluYWxQb2ludCxcbiAgICAgICAgZGlyID0gZGlyMixcbiAgICAgICAgbmV4dERpciA9IFV0aWxzLm5leHRDbG9ja3dpc2VEaXIoZGlyMSkgPT09IGRpcjIgPyBVdGlscy5uZXh0Q2xvY2t3aXNlRGlyIDogVXRpbHMucHJldkNsb2Nrd2lzZURpcixcbiAgICAgICAgcG9pbnRzID0gW25ldyBBclBvaW50KHBvaW50KV0sXG4gICAgICAgIGhhc0V4aXQgPSB0cnVlLFxuICAgICAgICBuZXh0Q2hpbGQsXG4gICAgICAgIG9sZDtcblxuICAgIGFzc2VydChjaGlsZCAhPT0gbnVsbCwgJ0FSR3JhcGguaHVnQ2hpbGRyZW46IGNoaWxkICE9PSBudWxsIEZBSUxFRCcpO1xuICAgIGV4aXRDb25kaXRpb24gPSBleGl0Q29uZGl0aW9uID09PSB1bmRlZmluZWQgPyBmdW5jdGlvbiAocHQpIHtcbiAgICAgICAgcmV0dXJuICFwYXJlbnRCb3gucHRJblJlY3QocHQpO1xuICAgIH0gOiBleGl0Q29uZGl0aW9uO1xuXG4gICAgX2xvZ2dlci5pbmZvKCdBYm91dCB0byBodWcgY2hpbGQgYm94ZXMgdG8gZmluZCBhIHBhdGgnKTtcbiAgICB3aGlsZSAoaGFzRXhpdCAmJiAhZXhpdENvbmRpdGlvbihwb2ludCwgYnVmZmVyT2JqZWN0KSkge1xuICAgICAgICBvbGQgPSBuZXcgQXJQb2ludChwb2ludCk7XG4gICAgICAgIG5leHRDaGlsZCA9IHRoaXMuX2dvVG9OZXh0Qm94KHBvaW50LCBkaXIsIFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKGNoaWxkLCBkaXIpLCBjaGlsZHJlbik7XG5cbiAgICAgICAgaWYgKCFwb2ludHNbcG9pbnRzLmxlbmd0aCAtIDFdLmVxdWFscyhvbGQpKSB7XG4gICAgICAgICAgICBwb2ludHMucHVzaChuZXcgQXJQb2ludChvbGQpKTsgLy9UaGUgcG9pbnRzIGFycmF5IHNob3VsZCBub3QgY29udGFpbiB0aGUgbW9zdCByZWNlbnQgcG9pbnQuXG4gICAgICAgIH1cblxuICAgICAgICBpZiAobmV4dENoaWxkID09PSBudWxsKSB7XG4gICAgICAgICAgICBkaXIgPSBVdGlscy5yZXZlcnNlRGlyKG5leHREaXIoZGlyKSk7XG4gICAgICAgIH0gZWxzZSBpZiAoVXRpbHMuaXNDb29yZEluRGlyRnJvbShVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChuZXh0Q2hpbGQsIFV0aWxzLnJldmVyc2VEaXIobmV4dERpcihkaXIpKSksXG4gICAgICAgICAgICAgICAgVXRpbHMuZ2V0UG9pbnRDb29yZChwb2ludCwgVXRpbHMucmV2ZXJzZURpcihuZXh0RGlyKGRpcikpKSwgVXRpbHMucmV2ZXJzZURpcihuZXh0RGlyKGRpcikpKSkge1xuICAgICAgICAgICAgZGlyID0gbmV4dERpcihkaXIpO1xuICAgICAgICAgICAgY2hpbGQgPSBuZXh0Q2hpbGQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZmluYWxQb2ludCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBmaW5hbFBvaW50ID0gbmV3IEFyUG9pbnQocG9pbnQpO1xuICAgICAgICB9IGVsc2UgaWYgKCFmaW5hbFBvaW50LmVxdWFscyhvbGQpKSB7XG4gICAgICAgICAgICBoYXNFeGl0ID0gIXBvaW50LmVxdWFscyhmaW5hbFBvaW50KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb2ludHNbMF0uZXF1YWxzKGluaXRQb2ludCkpIHtcbiAgICAgICAgcG9pbnRzLnNwbGljZSgwLCAxKTtcbiAgICB9XG5cbiAgICBpZiAoIWhhc0V4aXQpIHtcbiAgICAgICAgcG9pbnRzID0gbnVsbDtcbiAgICAgICAgcG9pbnQuYXNzaWduKGluaXRQb2ludCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHBvaW50cztcblxufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fZ29Ub05leHRCb3ggPSBmdW5jdGlvbiAocG9pbnQsIGRpciwgc3RvcDEsIGJveExpc3QpIHtcbiAgICB2YXIgc3RvcGhlcmUgPSBzdG9wMTtcblxuICAgIC8qXG4gICAgIGlmIChzdG9wMiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgIGlmIChzdG9wMiBpbnN0YW5jZW9mIEFycmF5KSB7XG4gICAgIGJveExpc3QgPSBzdG9wMjtcbiAgICAgfSBlbHNlIHtcbiAgICAgc3RvcGhlcmUgPSBzdG9wMSBpbnN0YW5jZW9mIEFyUG9pbnQgP1xuICAgICBjaG9vc2VJbkRpci5nZXRQb2ludENvb3JkIChzdG9wMSwgZGlyKSwgVXRpbHMuZ2V0UG9pbnRDb29yZCAoc3RvcDIsIGRpciksIFV0aWxzLnJldmVyc2VEaXIgKGRpcikpIDpcbiAgICAgY2hvb3NlSW5EaXIoc3RvcDEsIHN0b3AyLCBVdGlscy5yZXZlcnNlRGlyIChkaXIpKTtcbiAgICAgfVxuXG4gICAgIH1lbHNlICovXG4gICAgaWYgKHN0b3AxIGluc3RhbmNlb2YgQXJQb2ludCkge1xuICAgICAgICBzdG9waGVyZSA9IFV0aWxzLmdldFBvaW50Q29vcmQoc3RvcGhlcmUsIGRpcik7XG4gICAgfVxuXG4gICAgYXNzZXJ0KFV0aWxzLmlzUmlnaHRBbmdsZShkaXIpLCAnQXJHcmFwaC5nb1RvTmV4dEJveDogVXRpbHMuaXNSaWdodEFuZ2xlIChkaXIpIEZBSUxFRCcpO1xuICAgIGFzc2VydChVdGlscy5nZXRQb2ludENvb3JkKHBvaW50LCBkaXIpICE9PSBzdG9waGVyZSxcbiAgICAgICAgJ0FyR3JhcGguZ29Ub05leHRCb3g6IFV0aWxzLmdldFBvaW50Q29vcmQgKHBvaW50LCBkaXIpICE9PSBzdG9waGVyZSBGQUlMRUQnKTtcblxuICAgIHZhciBib3hieSA9IG51bGwsXG4gICAgICAgIGl0ZXIgPSBib3hMaXN0Lmxlbmd0aCxcbiAgICAgICAgYm94UmVjdDtcblxuICAgIHdoaWxlIChpdGVyLS0pIHtcbiAgICAgICAgYm94UmVjdCA9IGJveExpc3RbaXRlcl07XG5cbiAgICAgICAgaWYgKFV0aWxzLmlzUG9pbnRJbkRpckZyb20ocG9pbnQsIGJveFJlY3QsIFV0aWxzLnJldmVyc2VEaXIoZGlyKSkgJiZcbiAgICAgICAgICAgIFV0aWxzLmlzUG9pbnRCZXR3ZWVuU2lkZXMocG9pbnQsIGJveFJlY3QsIGRpcikgJiZcbiAgICAgICAgICAgIFV0aWxzLmlzQ29vcmRJbkRpckZyb20oc3RvcGhlcmUsIFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKGJveFJlY3QsIFV0aWxzLnJldmVyc2VEaXIoZGlyKSksIGRpcikpIHtcbiAgICAgICAgICAgIHN0b3BoZXJlID0gVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQoYm94UmVjdCwgVXRpbHMucmV2ZXJzZURpcihkaXIpKTtcbiAgICAgICAgICAgIGJveGJ5ID0gYm94TGlzdFtpdGVyXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChVdGlscy5pc0hvcml6b250YWwoZGlyKSkge1xuICAgICAgICBwb2ludC54ID0gc3RvcGhlcmU7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcG9pbnQueSA9IHN0b3BoZXJlO1xuICAgIH1cblxuICAgIHJldHVybiBib3hieTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2dldExpbWl0c09mRWRnZSA9IGZ1bmN0aW9uIChzdGFydFB0LCBlbmRQdCwgbWluLCBtYXgpIHtcbiAgICB2YXIgdCxcbiAgICAgICAgc3RhcnQgPSAobmV3IEFyUG9pbnQoc3RhcnRQdCkpLFxuICAgICAgICBlbmQgPSAobmV3IEFyUG9pbnQoZW5kUHQpKSxcbiAgICAgICAgaWRzID0gT2JqZWN0LmtleXModGhpcy5ib3hlcyksXG4gICAgICAgIGksXG4gICAgICAgIHJlY3Q7XG5cbiAgICBpZiAoc3RhcnQueSA9PT0gZW5kLnkpIHtcbiAgICAgICAgaWYgKHN0YXJ0LnggPiBlbmQueCkge1xuICAgICAgICAgICAgdCA9IHN0YXJ0Lng7XG4gICAgICAgICAgICBzdGFydC54ID0gZW5kLng7XG4gICAgICAgICAgICBlbmQueCA9IHQ7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGkgPSBpZHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgICAgICByZWN0ID0gdGhpcy5ib3hlc1tpZHNbaV1dLnJlY3Q7XG5cbiAgICAgICAgICAgIGlmIChzdGFydC54IDwgcmVjdC5yaWdodCAmJiByZWN0LmxlZnQgPD0gZW5kLngpIHtcbiAgICAgICAgICAgICAgICBpZiAocmVjdC5mbG9vciA8PSBzdGFydC55ICYmIHJlY3QuZmxvb3IgPiBtaW4pIHtcbiAgICAgICAgICAgICAgICAgICAgbWluID0gcmVjdC5mbG9vcjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHJlY3QuY2VpbCA+IHN0YXJ0LnkgJiYgcmVjdC5jZWlsIDwgbWF4KSB7XG4gICAgICAgICAgICAgICAgICAgIG1heCA9IHJlY3QuY2VpbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBhc3NlcnQoc3RhcnQueCA9PT0gZW5kLngsICdBUkdyYXBoLnRoaXMuZ2V0TGltaXRzT2ZFZGdlOiBzdGFydC54ID09PSBlbmQueCBGQUlMRUQnKTtcblxuICAgICAgICBpZiAoc3RhcnQueSA+IGVuZC55KSB7XG4gICAgICAgICAgICB0ID0gc3RhcnQueTtcbiAgICAgICAgICAgIHN0YXJ0LnkgPSBlbmQueTtcbiAgICAgICAgICAgIGVuZC55ID0gdDtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAoaSA9IGlkcy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgICAgIHJlY3QgPSB0aGlzLmJveGVzW2lkc1tpXV0ucmVjdDtcblxuICAgICAgICAgICAgaWYgKHN0YXJ0LnkgPCByZWN0LmZsb29yICYmIHJlY3QuY2VpbCA8PSBlbmQueSkge1xuICAgICAgICAgICAgICAgIGlmIChyZWN0LnJpZ2h0IDw9IHN0YXJ0LnggJiYgcmVjdC5yaWdodCA+IG1pbikge1xuICAgICAgICAgICAgICAgICAgICBtaW4gPSByZWN0LnJpZ2h0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAocmVjdC5sZWZ0ID4gc3RhcnQueCAmJiByZWN0LmxlZnQgPCBtYXgpIHtcbiAgICAgICAgICAgICAgICAgICAgbWF4ID0gcmVjdC5sZWZ0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIG1heC0tO1xuXG4gICAgcmV0dXJuIHttaW46IG1pbiwgbWF4OiBtYXh9O1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fY29ubmVjdCA9IGZ1bmN0aW9uIChwYXRoKSB7XG4gICAgdmFyIHN0YXJ0cG9ydCA9IHBhdGguZ2V0U3RhcnRQb3J0KCksXG4gICAgICAgIGVuZHBvcnQgPSBwYXRoLmdldEVuZFBvcnQoKSxcbiAgICAgICAgc3RhcnRwb2ludCA9IHBhdGguc3RhcnRwb2ludCxcbiAgICAgICAgZW5kcG9pbnQgPSBwYXRoLmVuZHBvaW50O1xuXG4gICAgYXNzZXJ0KHN0YXJ0cG9ydC5oYXNQb2ludChzdGFydHBvaW50KSwgJ0FSR3JhcGguY29ubmVjdDogc3RhcnRwb3J0Lmhhc1BvaW50KHN0YXJ0cG9pbnQpIEZBSUxFRCcpO1xuICAgIGFzc2VydChlbmRwb3J0Lmhhc1BvaW50KGVuZHBvaW50KSwgJ0FSR3JhcGguY29ubmVjdDogZW5kcG9ydC5oYXNQb2ludChlbmRwb2ludCkgRkFJTEVEJyk7XG5cbiAgICB2YXIgc3RhcnRSb290ID0gc3RhcnRwb3J0Lm93bmVyLmdldFJvb3RCb3goKSxcbiAgICAgICAgZW5kUm9vdCA9IGVuZHBvcnQub3duZXIuZ2V0Um9vdEJveCgpLFxuICAgICAgICBzdGFydElkID0gc3RhcnRSb290LmlkLFxuICAgICAgICBlbmRJZCA9IGVuZFJvb3QuaWQsXG4gICAgICAgIHN0YXJ0ZGlyID0gc3RhcnRwb3J0LnBvcnRPbldoaWNoRWRnZShzdGFydHBvaW50KSxcbiAgICAgICAgZW5kZGlyID0gZW5kcG9ydC5wb3J0T25XaGljaEVkZ2UoZW5kcG9pbnQpO1xuXG4gICAgaWYgKHN0YXJ0cG9pbnQuZXF1YWxzKGVuZHBvaW50KSkge1xuICAgICAgICBVdGlscy5zdGVwT25lSW5EaXIoc3RhcnRwb2ludCwgVXRpbHMubmV4dENsb2Nrd2lzZURpcihzdGFydGRpcikpO1xuICAgIH1cblxuICAgIGlmICghcGF0aC5pc0F1dG9Sb3V0ZWQoKSkge1xuICAgICAgICBwYXRoLmNyZWF0ZUN1c3RvbVBhdGgoKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuaG9yaXpvbnRhbC5hZGRQYXRoRWRnZXMocGF0aCkgJiYgdGhpcy52ZXJ0aWNhbC5hZGRQYXRoRWRnZXMocGF0aCk7XG4gICAgfSBlbHNlIGlmICh0aGlzLmJveDJidWZmZXJCb3hbc3RhcnRJZF0gPT09IHRoaXMuYm94MmJ1ZmZlckJveFtlbmRJZF0gJiZcbiAgICAgICAgc3RhcnRkaXIgPT09IFV0aWxzLnJldmVyc2VEaXIoZW5kZGlyKSAmJiBzdGFydFJvb3QgIT09IGVuZFJvb3QpIHtcblxuICAgICAgICByZXR1cm4gdGhpcy5fY29ubmVjdFBvaW50c1NoYXJpbmdQYXJlbnRCb3gocGF0aCwgc3RhcnRwb2ludCwgZW5kcG9pbnQsIHN0YXJ0ZGlyKTtcbiAgICB9IGVsc2Uge1xuXG4gICAgICAgIHJldHVybiB0aGlzLl9jb25uZWN0UGF0aFdpdGhQb2ludHMocGF0aCwgc3RhcnRwb2ludCwgZW5kcG9pbnQpO1xuICAgIH1cblxufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fY29ubmVjdFBhdGhXaXRoUG9pbnRzID0gZnVuY3Rpb24gKHBhdGgsIHN0YXJ0cG9pbnQsIGVuZHBvaW50KSB7XG4gICAgYXNzZXJ0KHN0YXJ0cG9pbnQgaW5zdGFuY2VvZiBBclBvaW50LCAnQVJHcmFwaC5jb25uZWN0OiBzdGFydHBvaW50IGluc3RhbmNlb2YgQXJQb2ludCBGQUlMRUQnKTtcbiAgICBhc3NlcnQocGF0aCAhPT0gbnVsbCAmJiBwYXRoLm93bmVyID09PSB0aGlzLCAnQVJHcmFwaC5jb25uZWN0OiBwYXRoICE9PSBudWxsICYmIHBhdGgub3duZXIgPT09IHNlbGYgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KCFwYXRoLmlzQ29ubmVjdGVkKCksICdBUkdyYXBoLmNvbm5lY3Q6ICFwYXRoLmlzQ29ubmVjdGVkKCkgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KCFzdGFydHBvaW50LmVxdWFscyhlbmRwb2ludCksICdBUkdyYXBoLmNvbm5lY3Q6ICFzdGFydHBvaW50LmVxdWFscyhlbmRwb2ludCkgRkFJTEVEJyk7XG5cbiAgICB2YXIgc3RhcnRQb3J0ID0gcGF0aC5nZXRTdGFydFBvcnQoKTtcbiAgICBhc3NlcnQoc3RhcnRQb3J0ICE9PSBudWxsLCAnQVJHcmFwaC5jb25uZWN0OiBzdGFydFBvcnQgIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICB2YXIgc3RhcnRkaXIgPSBzdGFydFBvcnQucG9ydE9uV2hpY2hFZGdlKHN0YXJ0cG9pbnQpLFxuICAgICAgICBlbmRQb3J0ID0gcGF0aC5nZXRFbmRQb3J0KCk7XG5cbiAgICBhc3NlcnQoZW5kUG9ydCAhPT0gbnVsbCwgJ0FSR3JhcGguY29ubmVjdDogZW5kUG9ydCAhPT0gbnVsbCBGQUlMRUQnKTtcbiAgICB2YXIgZW5kZGlyID0gZW5kUG9ydC5wb3J0T25XaGljaEVkZ2UoZW5kcG9pbnQpO1xuICAgIGFzc2VydChVdGlscy5pc1JpZ2h0QW5nbGUoc3RhcnRkaXIpICYmIFV0aWxzLmlzUmlnaHRBbmdsZShlbmRkaXIpLFxuICAgICAgICAnQVJHcmFwaC5jb25uZWN0OiBVdGlscy5pc1JpZ2h0QW5nbGUgKHN0YXJ0ZGlyKSAmJiBVdGlscy5pc1JpZ2h0QW5nbGUgKGVuZGRpcikgRkFJTEVEJyk7XG5cbiAgICAvL0ZpbmQgdGhlIGJ1ZmZlcmJveCBjb250YWluaW5nIHN0YXJ0cG9pbnQsIGVuZHBvaW50XG4gICAgdmFyIHN0YXJ0ID0gbmV3IEFyUG9pbnQoc3RhcnRwb2ludCk7XG4gICAgdGhpcy5fZ2V0T3V0T2ZCb3goe1xuICAgICAgICBwb2ludDogc3RhcnQsXG4gICAgICAgIGRpcjogc3RhcnRkaXIsXG4gICAgICAgIGVuZDogZW5kcG9pbnQsXG4gICAgICAgIGJveDogc3RhcnRQb3J0Lm93bmVyXG4gICAgfSk7XG4gICAgYXNzZXJ0KCFzdGFydC5lcXVhbHMoc3RhcnRwb2ludCksICdBUkdyYXBoLmNvbm5lY3Q6ICFzdGFydC5lcXVhbHMoc3RhcnRwb2ludCkgRkFJTEVEJyk7XG5cbiAgICB2YXIgZW5kID0gbmV3IEFyUG9pbnQoZW5kcG9pbnQpO1xuICAgIHRoaXMuX2dldE91dE9mQm94KHtcbiAgICAgICAgcG9pbnQ6IGVuZCxcbiAgICAgICAgZGlyOiBlbmRkaXIsXG4gICAgICAgIGVuZDogc3RhcnQsXG4gICAgICAgIGJveDogZW5kUG9ydC5vd25lclxuICAgIH0pO1xuICAgIGFzc2VydCghZW5kLmVxdWFscyhlbmRwb2ludCksICdBUkdyYXBoLmNvbm5lY3Q6ICFlbmQuZXF1YWxzKGVuZHBvaW50KSBGQUlMRUQnKTtcblxuICAgIHZhciBwb2ludHMsXG4gICAgICAgIGlzQXV0b1JvdXRlZCA9IHBhdGguaXNBdXRvUm91dGVkKCk7XG4gICAgaWYgKGlzQXV0b1JvdXRlZCkge1xuICAgICAgICBwb2ludHMgPSB0aGlzLl9jb25uZWN0UG9pbnRzKHN0YXJ0LCBlbmQsIHN0YXJ0ZGlyLCBlbmRkaXIpO1xuICAgIH1cblxuICAgIHBhdGgucG9pbnRzID0gcG9pbnRzO1xuICAgIHBhdGgucG9pbnRzLnVuc2hpZnQoc3RhcnRwb2ludCk7XG4gICAgcGF0aC5wb2ludHMucHVzaChlbmRwb2ludCk7XG5cbiAgICBpZiAoaXNBdXRvUm91dGVkKSB7XG4gICAgICAgIHRoaXMuX3NpbXBsaWZ5UGF0aEN1cnZlcyhwYXRoKTtcbiAgICAgICAgcGF0aC5zaW1wbGlmeVRyaXZpYWxseSgpO1xuICAgICAgICB0aGlzLl9zaW1wbGlmeVBhdGhQb2ludHMocGF0aCk7XG4gICAgICAgIHRoaXMuX2NlbnRlclN0YWlyc0luUGF0aFBvaW50cyhwYXRoLCBzdGFydGRpciwgZW5kZGlyKTtcbiAgICB9XG4gICAgcGF0aC5zZXRTdGF0ZShDT05TVEFOVFMuUGF0aFN0YXRlQ29ubmVjdGVkKTtcblxuICAgIHJldHVybiB0aGlzLmhvcml6b250YWwuYWRkUGF0aEVkZ2VzKHBhdGgpICYmIHRoaXMudmVydGljYWwuYWRkUGF0aEVkZ2VzKHBhdGgpO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fY29ubmVjdFBvaW50c1NoYXJpbmdQYXJlbnRCb3ggPSBmdW5jdGlvbiAocGF0aCwgc3RhcnRwb2ludCwgZW5kcG9pbnQsIHN0YXJ0ZGlyKSB7XG4gICAgLy8gQ29ubmVjdCBwb2ludHMgdGhhdCBzaGFyZSBhIHBhcmVudCBib3ggYW5kIGZhY2UgZWFjaCBvdGhlclxuICAgIC8vIFRoZXNlIHdpbGwgbm90IG5lZWQgdGhlIHNpbXBsaWZpY2F0aW9uIGFuZCBjb21wbGljYXRlZCBwYXRoIGZpbmRpbmdcbiAgICB2YXIgc3RhcnQgPSBuZXcgQXJQb2ludChzdGFydHBvaW50KSxcbiAgICAgICAgZHggPSBlbmRwb2ludC54IC0gc3RhcnQueCxcbiAgICAgICAgZHkgPSBlbmRwb2ludC55IC0gc3RhcnQueTtcblxuICAgIHBhdGguZGVsZXRlQWxsKCk7XG5cbiAgICBwYXRoLmFkZFRhaWwoc3RhcnRwb2ludCk7XG4gICAgaWYgKGR4ICE9PSAwICYmIGR5ICE9PSAwKSB7XG4gICAgICAgIGlmIChVdGlscy5pc0hvcml6b250YWwoc3RhcnRkaXIpKSB7XG4gICAgICAgICAgICBzdGFydC54ICs9IGR4IC8gMjtcbiAgICAgICAgICAgIHBhdGguYWRkVGFpbChuZXcgQXJQb2ludChzdGFydCkpO1xuICAgICAgICAgICAgc3RhcnQueSArPSBkeTtcbiAgICAgICAgICAgIHBhdGguYWRkVGFpbChuZXcgQXJQb2ludChzdGFydCkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3RhcnQueSArPSBkeSAvIDI7XG4gICAgICAgICAgICBwYXRoLmFkZFRhaWwobmV3IEFyUG9pbnQoc3RhcnQpKTtcbiAgICAgICAgICAgIHN0YXJ0LnggKz0gZHg7XG4gICAgICAgICAgICBwYXRoLmFkZFRhaWwobmV3IEFyUG9pbnQoc3RhcnQpKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBwYXRoLmFkZFRhaWwoZW5kcG9pbnQpO1xuXG4gICAgcGF0aC5zZXRTdGF0ZShDT05TVEFOVFMuUGF0aFN0YXRlQ29ubmVjdGVkKTtcblxuICAgIHJldHVybiB0aGlzLmhvcml6b250YWwuYWRkUGF0aEVkZ2VzKHBhdGgpICYmIHRoaXMudmVydGljYWwuYWRkUGF0aEVkZ2VzKHBhdGgpO1xuXG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9jb25uZWN0UG9pbnRzID0gZnVuY3Rpb24gKHN0YXJ0LCBlbmQsIGhpbnRzdGFydGRpciwgaGludGVuZGRpciwgZmxpcHBlZCkge1xuICAgIHZhciByZXQgPSBuZXcgQXJQb2ludExpc3RQYXRoKCksXG4gICAgICAgIHRoZXN0YXJ0ID0gbmV3IEFyUG9pbnQoc3RhcnQpLFxuICAgICAgICBidWZmZXJPYmplY3QsXG4gICAgICAgIGJveCxcbiAgICAgICAgcmVjdCxcbiAgICAgICAgZGlyMSxcbiAgICAgICAgZGlyMixcbiAgICAgICAgb2xkLFxuICAgICAgICBvbGRFbmQsXG4gICAgICAgIHJldDIsXG4gICAgICAgIHB0cyxcbiAgICAgICAgcmV2LFxuICAgICAgICBpLFxuXG4gICAgLy9FeGl0IGNvbmRpdGlvbnNcbiAgICAvL2lmIHRoZXJlIGlzIGEgc3RyYWlnaHQgbGluZSB0byB0aGUgZW5kIHBvaW50XG4gICAgICAgIGZpbmRFeGl0VG9FbmRwb2ludCA9IGZ1bmN0aW9uIChwdCwgYm8pIHtcbiAgICAgICAgICAgIHJldHVybiAocHQueCA9PT0gZW5kLnggfHwgcHQueSA9PT0gZW5kLnkpICYmICFVdGlscy5pc0xpbmVDbGlwUmVjdHMocHQsIGVuZCwgYm8uY2hpbGRyZW4pO1xuICAgICAgICB9LCAgLy9JZiB5b3UgcGFzcyB0aGUgZW5kcG9pbnQsIHlvdSBuZWVkIHRvIGhhdmUgYSB3YXkgb3V0LlxuXG4gICAgLy9leGl0Q29uZGl0aW9uIGlzIHdoZW4geW91IGdldCB0byB0aGUgZGlyMSBzaWRlIG9mIHRoZSBib3ggb3Igd2hlbiB5b3UgcGFzcyBlbmRcbiAgICAgICAgZ2V0VG9EaXIxU2lkZSA9IGZ1bmN0aW9uIChwdCwgYm8pIHtcbiAgICAgICAgICAgIHJldHVybiBVdGlscy5nZXRQb2ludENvb3JkKHB0LCBkaXIxKSA9PT0gVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQoYm8uYm94LCBkaXIxKSB8fFxuICAgICAgICAgICAgICAgICggVXRpbHMuaXNQb2ludEluRGlyRnJvbShwdCwgZW5kLCBkaXIxKSk7XG4gICAgICAgIH07XG5cblxuICAgIC8vVGhpcyBpcyB3aGVyZSB3ZSBjcmVhdGUgdGhlIG9yaWdpbmFsIHBhdGggdGhhdCB3ZSB3aWxsIGxhdGVyIGFkanVzdFxuICAgIHdoaWxlICghc3RhcnQuZXF1YWxzKGVuZCkpIHtcblxuICAgICAgICBkaXIxID0gVXRpbHMuZXhHZXRNYWpvckRpcihlbmQubWludXMoc3RhcnQpKTtcbiAgICAgICAgZGlyMiA9IFV0aWxzLmV4R2V0TWlub3JEaXIoZW5kLm1pbnVzKHN0YXJ0KSk7XG5cbiAgICAgICAgYXNzZXJ0KGRpcjEgIT09IENPTlNUQU5UUy5EaXJOb25lLCAnQVJHcmFwaC5jb25uZWN0UG9pbnRzOiBkaXIxICE9PSBDT05TVEFOVFMuRGlyTm9uZSBGQUlMRUQnKTtcbiAgICAgICAgYXNzZXJ0KGRpcjEgPT09IFV0aWxzLmdldE1ham9yRGlyKGVuZC5taW51cyhzdGFydCkpLFxuICAgICAgICAgICAgJ0FSR3JhcGguY29ubmVjdFBvaW50czogZGlyMSA9PT0gVXRpbHMuZ2V0TWFqb3JEaXIoZW5kLm1pbnVzKHN0YXJ0KSkgRkFJTEVEJyk7XG4gICAgICAgIGFzc2VydChkaXIyID09PSBDT05TVEFOVFMuRGlyTm9uZSB8fCBkaXIyID09PSBVdGlscy5nZXRNaW5vckRpcihlbmQubWludXMoc3RhcnQpKSxcbiAgICAgICAgICAgICdBUkdyYXBoLmNvbm5lY3RQb2ludHM6IGRpcjIgPT09IENPTlNUQU5UUy5EaXJOb25lIHx8ICcgK1xuICAgICAgICAgICAgJ2RpcjIgPT09IFV0aWxzLmdldE1pbm9yRGlyKGVuZC5taW51cyhzdGFydCkpIEZBSUxFRCcpO1xuXG4gICAgICAgIGlmIChkaXIyID09PSBoaW50c3RhcnRkaXIgJiYgZGlyMiAhPT0gQ09OU1RBTlRTLkRpck5vbmUpIHtcbiAgICAgICAgICAgIC8vIGkuZS4gc3RkOjpzd2FwKGRpcjEsIGRpcjIpO1xuICAgICAgICAgICAgZGlyMiA9IGRpcjE7XG4gICAgICAgICAgICBkaXIxID0gaGludHN0YXJ0ZGlyO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0LnB1c2gobmV3IEFyUG9pbnQoc3RhcnQpKTtcblxuICAgICAgICBvbGQgPSBuZXcgQXJQb2ludChzdGFydCk7XG5cbiAgICAgICAgYnVmZmVyT2JqZWN0ID0gdGhpcy5fZ29Ub05leHRCdWZmZXJCb3goe1xuICAgICAgICAgICAgcG9pbnQ6IHN0YXJ0LFxuICAgICAgICAgICAgZGlyOiBkaXIxLFxuICAgICAgICAgICAgZGlyMjogZGlyMixcbiAgICAgICAgICAgIGVuZDogZW5kXG4gICAgICAgIH0pOyAgLy8gTW9kaWZpZWQgZ29Ub05leHRCb3ggKHRoYXQgYWxsb3dzIGVudGVyaW5nIHBhcmVudCBidWZmZXIgYm94ZXMgaGVyZVxuICAgICAgICBib3ggPSBidWZmZXJPYmplY3QgPT09IG51bGwgPyBudWxsIDogYnVmZmVyT2JqZWN0LmJveDtcblxuICAgICAgICAvL0lmIGdvVG9OZXh0Qm94IGRvZXMgbm90IG1vZGlmeSBzdGFydFxuICAgICAgICBpZiAoc3RhcnQuZXF1YWxzKG9sZCkpIHtcblxuICAgICAgICAgICAgYXNzZXJ0KGJveCAhPT0gbnVsbCwgJ0FSR3JhcGguY29ubmVjdFBvaW50czogYm94ICE9PSBudWxsIEZBSUxFRCcpO1xuICAgICAgICAgICAgcmVjdCA9IGJveCBpbnN0YW5jZW9mIEFyUmVjdCA/IGJveCA6IGJveC5yZWN0O1xuXG4gICAgICAgICAgICBpZiAoZGlyMiA9PT0gQ09OU1RBTlRTLkRpck5vbmUpIHtcbiAgICAgICAgICAgICAgICBkaXIyID0gVXRpbHMubmV4dENsb2Nrd2lzZURpcihkaXIxKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYXNzZXJ0KGRpcjEgIT09IGRpcjIgJiYgZGlyMSAhPT0gQ09OU1RBTlRTLkRpck5vbmUgJiYgZGlyMiAhPT0gQ09OU1RBTlRTLkRpck5vbmUsXG4gICAgICAgICAgICAgICAgJ0FSR3JhcGguY29ubmVjdFBvaW50czogZGlyMSAhPT0gZGlyMiAmJiBkaXIxICE9PSBDT05TVEFOVFMuRGlyTm9uZSAmJiBkaXIyICE9PSAnICtcbiAgICAgICAgICAgICAgICAnQ09OU1RBTlRTLkRpck5vbmUgRkFJTEVEJyk7XG4gICAgICAgICAgICBpZiAoYnVmZmVyT2JqZWN0LmJveC5wdEluUmVjdChlbmQpICYmICFidWZmZXJPYmplY3QuYm94LnB0SW5SZWN0KHN0YXJ0KSAmJiBmbGlwcGVkKSB7XG4gICAgICAgICAgICAgICAgLy9VbmZvcnR1bmF0ZWx5LCBpZiBwYXJlbnRib3hlcyBhcmUgYSBwaXhlbCBhcGFydCwgc3RhcnQvZW5kIGNhbiBnZXQgc3R1Y2sgYW5kIG5vdCBjcm9zcyB0aGUgYm9yZGVyXG4gICAgICAgICAgICAgICAgLy9zZXBhcmF0aW5nIHRoZW0uLi4uIFRoaXMgaXMgYSBudWRnZSB0byBnZXQgdGhlbSB0byBjcm9zcyBpdC5cbiAgICAgICAgICAgICAgICBpZiAoVXRpbHMuaXNIb3Jpem9udGFsKGRpcjEpKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXJ0LnggPSBlbmQueDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBzdGFydC55ID0gZW5kLnk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChidWZmZXJPYmplY3QuYm94LnB0SW5SZWN0KGVuZCkpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWZsaXBwZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgX2xvZ2dlci5pbmZvKCdDb3VsZCBub3QgZmluZCBwYXRoIGZyb20nLHN0YXJ0LCd0bycsIGVuZCwnLiBGbGlwcGluZyBzdGFydCBhbmQgZW5kIHBvaW50cycpO1xuICAgICAgICAgICAgICAgICAgICBvbGRFbmQgPSBuZXcgQXJQb2ludChlbmQpO1xuXG4gICAgICAgICAgICAgICAgICAgIHJldDIgPSB0aGlzLl9jb25uZWN0UG9pbnRzKGVuZCwgc3RhcnQsIGhpbnRlbmRkaXIsIGRpcjEsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICBpID0gcmV0Mi5sZW5ndGggLSAxO1xuXG4gICAgICAgICAgICAgICAgICAgIHdoaWxlIChpLS0gPiAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXQucHVzaChyZXQyW2ldKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGFzc2VydChzdGFydC5lcXVhbHMoZW5kKSwgJ0FyR3JhcGguY29ubmVjdFBvaW50czogc3RhcnQuZXF1YWxzKGVuZCkgRkFJTEVEJyk7XG4gICAgICAgICAgICAgICAgICAgIG9sZCA9IENPTlNUQU5UUy5FTVBUWV9QT0lOVDtcbiAgICAgICAgICAgICAgICAgICAgc3RhcnQgPSBlbmQgPSBvbGRFbmQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHsgIC8vSWYgd2UgaGF2ZSBmbGlwcGVkIGFuZCBib3RoIHBvaW50cyBhcmUgaW4gdGhlIHNhbWUgYnVmZmVyYm94XG4gICAgICAgICAgICAgICAgICAgIC8vIFdlIHdpbGwgaHVnY2hpbGRyZW4gdW50aWwgd2UgY2FuIGNvbm5lY3QgYm90aCBwb2ludHMuXG4gICAgICAgICAgICAgICAgICAgIC8vIElmIHdlIGNhbid0LCBmb3JjZSBpdFxuICAgICAgICAgICAgICAgICAgICBwdHMgPSB0aGlzLl9odWdDaGlsZHJlbihidWZmZXJPYmplY3QsIHN0YXJ0LCBkaXIxLCBkaXIyLCBmaW5kRXhpdFRvRW5kcG9pbnQpO1xuICAgICAgICAgICAgICAgICAgICBpZiAocHRzICE9PSBudWxsKSB7ICAvLyBUaGVyZSBpcyBhIHBhdGggZnJvbSBzdGFydCAtPiBlbmRcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwdHMubGVuZ3RoKSB7ICAvLyBBZGQgbmV3IHBvaW50cyB0byB0aGUgY3VycmVudCBsaXN0IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldCA9IHJldC5jb25jYXQocHRzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHJldC5wdXNoKG5ldyBBclBvaW50KHN0YXJ0KSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdGFydC5hc3NpZ24oZW5kKTsgIC8vIFRoZXNlIHNob3VsZCBub3QgYmUgc2tldyEgRklYTUVcblxuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgeyAvL0ZvcmNlIHRvIHRoZSBlbmRwb2ludFxuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KFV0aWxzLmlzUmlnaHRBbmdsZShkaXIxKSwgJ0FSR3JhcGguY29ubmVjdFBvaW50czogVXRpbHMuaXNSaWdodEFuZ2xlIChkaXIxKSBGQUlMRUQnKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKFV0aWxzLmlzSG9yaXpvbnRhbChkaXIxKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0LnggPSBlbmQueDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnQueSA9IGVuZC55O1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICByZXQucHVzaChuZXcgQXJQb2ludChzdGFydCkpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIVV0aWxzLmlzSG9yaXpvbnRhbChkaXIxKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0LnggPSBlbmQueDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnQueSA9IGVuZC55O1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICByZXQucHVzaChuZXcgQXJQb2ludChzdGFydCkpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBhc3NlcnQoc3RhcnQuZXF1YWxzKGVuZCkpOyAgLy8gV2UgYXJlIGZvcmNpbmcgb3V0IHNvIHRoZXNlIHNob3VsZCBiZSB0aGUgc2FtZSBub3dcblxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGFzc2VydCghc3RhcnQuZXF1YWxzKG9sZCkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoVXRpbHMuaXNQb2ludEluRGlyRnJvbShlbmQsIHJlY3QsIGRpcjIpKSB7XG5cbiAgICAgICAgICAgICAgICBhc3NlcnQoIVV0aWxzLmlzUG9pbnRJbkRpckZyb20oc3RhcnQsIHJlY3QsIGRpcjIpLFxuICAgICAgICAgICAgICAgICAgICAnQVJHcmFwaC5jb25uZWN0UG9pbnRzOiAhVXRpbHMuaXNQb2ludEluRGlyRnJvbShzdGFydCwgcmVjdCwgZGlyMikgRkFJTEVEJyk7XG4gICAgICAgICAgICAgICAgYm94ID0gdGhpcy5fZ29Ub05leHRCdWZmZXJCb3goe1xuICAgICAgICAgICAgICAgICAgICBwb2ludDogc3RhcnQsXG4gICAgICAgICAgICAgICAgICAgIGRpcjogZGlyMixcbiAgICAgICAgICAgICAgICAgICAgZGlyMjogZGlyMSxcbiAgICAgICAgICAgICAgICAgICAgZW5kOiBlbmRcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIC8vIHRoaXMgYXNzZXJ0IGZhaWxzIGlmIHR3byBib3hlcyBhcmUgYWRqYWNlbnQsIGFuZCBhIGNvbm5lY3Rpb24gd2FudHMgdG8gZ28gYmV0d2VlblxuICAgICAgICAgICAgICAgIC8vYXNzZXJ0KFV0aWxzLmlzUG9pbnRJbkRpckZyb20oc3RhcnQsIHJlY3QsIGRpcjIpLFxuICAgICAgICAgICAgICAgIC8vICdBUkdyYXBoLmNvbm5lY3RQb2ludHM6IFV0aWxzLmlzUG9pbnRJbkRpckZyb20oc3RhcnQsIHJlY3QsIGRpcjIpIEZBSUxFRCcpO1xuICAgICAgICAgICAgICAgIC8vIFRoaXMgaXMgbm90IHRoZSBiZXN0IGNoZWNrIHdpdGggcGFyZW50IGJveGVzXG4gICAgICAgICAgICAgICAgaWYgKHN0YXJ0LmVxdWFscyhvbGQpKSB7IC8vVGhlbiB3ZSBhcmUgaW4gYSBjb3JuZXJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGJveC5jaGlsZHJlbi5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwdHMgPSB0aGlzLl9odWdDaGlsZHJlbihib3gsIHN0YXJ0LCBkaXIyLCBkaXIxLCBnZXRUb0RpcjFTaWRlKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHB0cyA9IHRoaXMuX2h1Z0NoaWxkcmVuKGJ1ZmZlck9iamVjdCwgc3RhcnQsIGRpcjEsIGRpcjIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChwdHMgIT09IG51bGwpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy9BZGQgbmV3IHBvaW50cyB0byB0aGUgY3VycmVudCBsaXN0IFxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0ID0gcmV0LmNvbmNhdChwdHMpO1xuXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7IC8vR28gdGhyb3VnaCB0aGUgYmxvY2tpbmcgYm94XG4gICAgICAgICAgICAgICAgICAgICAgICBhc3NlcnQoVXRpbHMuaXNSaWdodEFuZ2xlKGRpcjEpLCAnQVJHcmFwaC5nZXRPdXRPZkJveDogVXRpbHMuaXNSaWdodEFuZ2xlIChkaXIxKSBGQUlMRUQnKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKFV0aWxzLmlzSG9yaXpvbnRhbChkaXIxKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0LnggPSBVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChidWZmZXJPYmplY3QuYm94LCBkaXIxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnQueSA9IFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKGJ1ZmZlck9iamVjdC5ib3gsIGRpcjEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBhc3NlcnQoVXRpbHMuaXNQb2ludEJldHdlZW5TaWRlcyhlbmQsIHJlY3QsIGRpcjEpLFxuICAgICAgICAgICAgICAgICAgICAnQVJHcmFwaC5jb25uZWN0UG9pbnRzOiBVdGlscy5pc1BvaW50QmV0d2VlblNpZGVzKGVuZCwgcmVjdCwgZGlyMSkgRkFJTEVEJyk7XG4gICAgICAgICAgICAgICAgYXNzZXJ0KCFVdGlscy5pc1BvaW50SW4oZW5kLCByZWN0KSwgJ0FSR3JhcGguY29ubmVjdFBvaW50czogIVV0aWxzLmlzUG9pbnRJbihlbmQsIHJlY3QpIEZBSUxFRCcpO1xuXG4gICAgICAgICAgICAgICAgcmV2ID0gMDtcblxuICAgICAgICAgICAgICAgIGlmIChVdGlscy5yZXZlcnNlRGlyKGRpcjIpID09PSBoaW50ZW5kZGlyICYmXG4gICAgICAgICAgICAgICAgICAgIFV0aWxzLmdldENoaWxkUmVjdE91dGVyQ29vcmRGcm9tKGJ1ZmZlck9iamVjdCwgVXRpbHMucmV2ZXJzZURpcihkaXIyKSwgc3RhcnQpID09PVxuICAgICAgICAgICAgICAgICAgICBVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChyZWN0LCBVdGlscy5yZXZlcnNlRGlyKGRpcjIpKSkgeyAvL0FuZCBpZiBwb2ludCBjYW4gZXhpdCB0aGF0IHdheVxuICAgICAgICAgICAgICAgICAgICByZXYgPSAxO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZGlyMiAhPT0gaGludGVuZGRpcikge1xuICAgICAgICAgICAgICAgICAgICBpZiAoVXRpbHMuaXNQb2ludEJldHdlZW5TaWRlcyh0aGVzdGFydCwgcmVjdCwgZGlyMSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChVdGlscy5pc1BvaW50SW5EaXJGcm9tKHJlY3QuZ2V0VG9wTGVmdCgpLnBsdXMocmVjdC5nZXRCb3R0b21SaWdodCgpKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnQucGx1cyhlbmQpLCBkaXIyKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldiA9IDE7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoVXRpbHMuaXNQb2ludEluRGlyRnJvbShzdGFydCwgdGhlc3RhcnQsIGRpcjIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXYgPSAxO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHJldikge1xuICAgICAgICAgICAgICAgICAgICBkaXIyID0gVXRpbHMucmV2ZXJzZURpcihkaXIyKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvL0lmIHRoZSBib3ggaW4gdGhlIHdheSBoYXMgb25lIGNoaWxkXG4gICAgICAgICAgICAgICAgaWYgKGJ1ZmZlck9iamVjdC5jaGlsZHJlbi5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKFV0aWxzLmlzSG9yaXpvbnRhbChkaXIyKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnQueCA9IFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKHJlY3QsIGRpcjIpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnQueSA9IFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKHJlY3QsIGRpcjIpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KCFzdGFydC5lcXVhbHMob2xkKSwgJ0FSR3JhcGguY29ubmVjdFBvaW50czogIXN0YXJ0LmVxdWFscyhvbGQpIEZBSUxFRCcpO1xuICAgICAgICAgICAgICAgICAgICByZXQucHVzaChuZXcgQXJQb2ludChzdGFydCkpO1xuICAgICAgICAgICAgICAgICAgICBvbGQuYXNzaWduKHN0YXJ0KTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoVXRpbHMuaXNIb3Jpem9udGFsKGRpcjEpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdGFydC54ID0gVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQocmVjdCwgZGlyMSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdGFydC55ID0gVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQocmVjdCwgZGlyMSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBhc3NlcnQoVXRpbHMuaXNQb2ludEluRGlyRnJvbShlbmQsIHN0YXJ0LCBkaXIxKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICdBUkdyYXBoLmNvbm5lY3RQb2ludHM6IFV0aWxzLmlzUG9pbnRJbkRpckZyb20oZW5kLCBzdGFydCwgZGlyMSkgRkFJTEVEJyk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChVdGlscy5nZXRQb2ludENvb3JkKHN0YXJ0LCBkaXIxKSAhPT0gVXRpbHMuZ2V0UG9pbnRDb29yZChlbmQsIGRpcjEpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nb1RvTmV4dEJ1ZmZlckJveCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcG9pbnQ6IHN0YXJ0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRpcjogZGlyMSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbmQ6IGVuZFxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIH0gZWxzZSB7IC8vSWYgdGhlIGJveCBoYXMgbXVsdGlwbGUgY2hpbGRyZW5cbiAgICAgICAgICAgICAgICAgICAgcHRzID0gdGhpcy5faHVnQ2hpbGRyZW4oYnVmZmVyT2JqZWN0LCBzdGFydCwgZGlyMSwgZGlyMiwgZ2V0VG9EaXIxU2lkZSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwdHMgIT09IG51bGwpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy9BZGQgbmV3IHBvaW50cyB0byB0aGUgY3VycmVudCBsaXN0IFxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0ID0gcmV0LmNvbmNhdChwdHMpO1xuXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7IC8vR28gdGhyb3VnaCB0aGUgYmxvY2tpbmcgYm94XG4gICAgICAgICAgICAgICAgICAgICAgICBhc3NlcnQoVXRpbHMuaXNSaWdodEFuZ2xlKGRpcjEpLCAnQVJHcmFwaC5nZXRPdXRPZkJveDogVXRpbHMuaXNSaWdodEFuZ2xlIChkaXIxKSBGQUlMRUQnKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKFV0aWxzLmlzSG9yaXpvbnRhbChkaXIxKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0LnggPSBVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChidWZmZXJPYmplY3QuYm94LCBkaXIxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnQueSA9IFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKGJ1ZmZlck9iamVjdC5ib3gsIGRpcjEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBhc3NlcnQoIXN0YXJ0LmVxdWFscyhvbGQpLCAnQVJHcmFwaC5jb25uZWN0UG9pbnRzOiAhc3RhcnQuZXF1YWxzKG9sZCkgRkFJTEVEJyk7XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIHJldC5wdXNoKGVuZCk7XG5cbiAgICBpZiAoQ09OU1RBTlRTLkRFQlVHKSB7XG4gICAgICAgIHJldC5hc3NlcnRWYWxpZCgpOyAgLy8gQ2hlY2sgdGhhdCBhbGwgZWRnZXMgYXJlIGhvcml6b250YWwgYXJlIHZlcnRpY2FsXG4gICAgfVxuXG4gICAgcmV0dXJuIHJldDtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2Rpc2Nvbm5lY3RBbGwgPSBmdW5jdGlvbiAoKSB7XG4gICAgZm9yICh2YXIgaSA9IHRoaXMucGF0aHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHRoaXMuZGlzY29ubmVjdCh0aGlzLnBhdGhzW2ldKTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLmRpc2Nvbm5lY3QgPSBmdW5jdGlvbiAocGF0aCkge1xuICAgIGlmIChwYXRoLmlzQ29ubmVjdGVkKCkpIHtcbiAgICAgICAgdGhpcy5kZWxldGVFZGdlcyhwYXRoKTtcbiAgICB9XG5cbiAgICBwYXRoLmRlbGV0ZUFsbCgpO1xuICAgIHRoaXMuY29tcGxldGVseUNvbm5lY3RlZCA9IGZhbHNlO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fZGlzY29ubmVjdFBhdGhzQ2xpcHBpbmcgPSBmdW5jdGlvbiAocmVjdCkge1xuICAgIGZvciAodmFyIGkgPSB0aGlzLnBhdGhzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICBpZiAodGhpcy5wYXRoc1tpXS5pc1BhdGhDbGlwKHJlY3QpKSB7XG4gICAgICAgICAgICB0aGlzLmRpc2Nvbm5lY3QodGhpcy5wYXRoc1tpXSk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9kaXNjb25uZWN0UGF0aHNGcm9tID0gZnVuY3Rpb24gKG9iaikge1xuICAgIHZhciBpdGVyID0gdGhpcy5wYXRocy5sZW5ndGgsXG4gICAgICAgIHBhdGgsXG4gICAgICAgIHN0YXJ0cG9ydCxcbiAgICAgICAgZW5kcG9ydDtcblxuICAgIGlmIChvYmogaW5zdGFuY2VvZiBBdXRvUm91dGVyQm94KSB7XG4gICAgICAgIHZhciBib3ggPSBvYmosXG4gICAgICAgICAgICBzdGFydGJveCxcbiAgICAgICAgICAgIGVuZGJveDtcbiAgICAgICAgd2hpbGUgKGl0ZXItLSkge1xuICAgICAgICAgICAgcGF0aCA9IHRoaXMucGF0aHNbaXRlcl07XG5cbiAgICAgICAgICAgIGFzc2VydChwYXRoLnN0YXJ0cG9ydHMgIT09IG51bGwsICdBUkdyYXBoLmRpc2Nvbm5lY3RQYXRoc0Zyb206IHN0YXJ0cG9ydCAhPT0gbnVsbCBGQUlMRUQnKTtcbiAgICAgICAgICAgIGFzc2VydChwYXRoLnN0YXJ0cG9ydHMubGVuZ3RoID4gMCwgJ0FSR3JhcGguZGlzY29ubmVjdFBhdGhzRnJvbTogUGF0aCBoYXMgbm8gc3RhcnRwb3J0cycpO1xuICAgICAgICAgICAgYXNzZXJ0KHBhdGguZW5kcG9ydHMgIT09IG51bGwsICdBUkdyYXBoLmRpc2Nvbm5lY3RQYXRoc0Zyb206IGVuZHBvcnQgIT09IG51bGwgRkFJTEVEJyk7XG4gICAgICAgICAgICBhc3NlcnQocGF0aC5lbmRwb3J0cy5sZW5ndGggPiAwLCAnQVJHcmFwaC5kaXNjb25uZWN0UGF0aHNGcm9tOiBQYXRoIGhhcyBubyBlbmRwb3J0cycpO1xuXG4gICAgICAgICAgICAvLyBDYW4gc2ltcGx5IHNlbGVjdCBhbnkgc3RhcnQvZW5kIHBvcnQgdG8gY2hlY2sgdGhlIG93bmVyXG4gICAgICAgICAgICBzdGFydGJveCA9IHBhdGguc3RhcnRwb3J0c1swXS5vd25lcjtcbiAgICAgICAgICAgIGVuZGJveCA9IHBhdGguZW5kcG9ydHNbMF0ub3duZXI7XG5cbiAgICAgICAgICAgIGFzc2VydChzdGFydGJveCAhPT0gbnVsbCwgJ0FSR3JhcGguZGlzY29ubmVjdFBhdGhzRnJvbTogc3RhcnRib3ggIT09IG51bGwgRkFJTEVEJyk7XG4gICAgICAgICAgICBhc3NlcnQoZW5kYm94ICE9PSBudWxsLCAnQVJHcmFwaC5kaXNjb25uZWN0UGF0aHNGcm9tOiBlbmRib3ggIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICAgICAgICAgIGlmICgoc3RhcnRib3ggPT09IGJveCB8fCBlbmRib3ggPT09IGJveCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRpc2Nvbm5lY3QocGF0aCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuICAgIH0gZWxzZSB7ICAvLyBBc3N1bWluZyAnYm94JyBpcyBhIHBvcnRcblxuICAgICAgICB2YXIgcG9ydCA9IG9iajtcbiAgICAgICAgd2hpbGUgKGl0ZXItLSkge1xuICAgICAgICAgICAgcGF0aCA9IHRoaXMucGF0aHNbaXRlcl07XG4gICAgICAgICAgICBzdGFydHBvcnQgPSBwYXRoLmdldFN0YXJ0UG9ydCgpO1xuICAgICAgICAgICAgZW5kcG9ydCA9IHBhdGguZ2V0RW5kUG9ydCgpO1xuXG4gICAgICAgICAgICBpZiAoKHN0YXJ0cG9ydCA9PT0gcG9ydCB8fCBlbmRwb3J0ID09PSBwb3J0KSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGlzY29ubmVjdChwYXRoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fYWRkU2VsZkVkZ2VzID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuaG9yaXpvbnRhbC5hZGRHcmFwaEVkZ2VzKHRoaXMpO1xuICAgIHRoaXMudmVydGljYWwuYWRkR3JhcGhFZGdlcyh0aGlzKTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2FkZEJveEVkZ2VzID0gZnVuY3Rpb24gKGJveCkge1xuICAgIGFzc2VydChib3ggaW5zdGFuY2VvZiBBdXRvUm91dGVyQm94KTtcbiAgICB0aGlzLmhvcml6b250YWwuYWRkQm94RWRnZXMoYm94KTtcbiAgICB0aGlzLnZlcnRpY2FsLmFkZEJveEVkZ2VzKGJveCk7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9hZGRQb3J0RWRnZXMgPSBmdW5jdGlvbiAocG9ydCkge1xuICAgIGFzc2VydChwb3J0IGluc3RhbmNlb2YgQXV0b1JvdXRlclBvcnQpO1xuICAgIHRoaXMuaG9yaXpvbnRhbC5hZGRQb3J0RWRnZXMocG9ydCk7XG4gICAgdGhpcy52ZXJ0aWNhbC5hZGRQb3J0RWRnZXMocG9ydCk7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLmRlbGV0ZUVkZ2VzID0gZnVuY3Rpb24gKG9iamVjdCkge1xuICAgIHRoaXMuaG9yaXpvbnRhbC5kZWxldGVFZGdlcyhvYmplY3QpO1xuICAgIHRoaXMudmVydGljYWwuZGVsZXRlRWRnZXMob2JqZWN0KTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2FkZEFsbEVkZ2VzID0gZnVuY3Rpb24gKCkge1xuICAgIGFzc2VydCh0aGlzLmhvcml6b250YWwuaXNFbXB0eSgpICYmIHRoaXMudmVydGljYWwuaXNFbXB0eSgpLFxuICAgICAgICAnQVJHcmFwaC5hZGRBbGxFZGdlczogaG9yaXpvbnRhbC5pc0VtcHR5KCkgJiYgdmVydGljYWwuaXNFbXB0eSgpIEZBSUxFRCcpO1xuXG4gICAgdmFyIGlkcyA9IE9iamVjdC5rZXlzKHRoaXMuYm94ZXMpLFxuICAgICAgICBpO1xuXG4gICAgZm9yIChpID0gaWRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICB0aGlzLl9hZGRCb3hBbmRQb3J0RWRnZXModGhpcy5ib3hlc1tpZHNbaV1dKTtcbiAgICB9XG5cbiAgICBmb3IgKGkgPSB0aGlzLnBhdGhzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICB0aGlzLmhvcml6b250YWwuYWRkUGF0aEVkZ2VzKHRoaXMucGF0aHNbaV0pO1xuICAgICAgICB0aGlzLnZlcnRpY2FsLmFkZFBhdGhFZGdlcyh0aGlzLnBhdGhzW2ldKTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9kZWxldGVBbGxFZGdlcyA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmhvcml6b250YWwuZGVsZXRlQWxsRWRnZXMoKTtcbiAgICB0aGlzLnZlcnRpY2FsLmRlbGV0ZUFsbEVkZ2VzKCk7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9hZGRCb3hBbmRQb3J0RWRnZXMgPSBmdW5jdGlvbiAoYm94KSB7XG4gICAgYXNzZXJ0KGJveCAhPT0gbnVsbCwgJ0FSR3JhcGguYWRkQm94QW5kUG9ydEVkZ2VzOiBib3ggIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICB0aGlzLl9hZGRCb3hFZGdlcyhib3gpO1xuXG4gICAgZm9yICh2YXIgaSA9IGJveC5wb3J0cy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgdGhpcy5fYWRkUG9ydEVkZ2VzKGJveC5wb3J0c1tpXSk7XG4gICAgfVxuXG4gICAgLy8gQWRkIHRvIGJ1ZmZlcmJveGVzXG4gICAgdGhpcy5fYWRkVG9CdWZmZXJCb3hlcyhib3gpO1xuICAgIHRoaXMuX3VwZGF0ZUJveFBvcnRBdmFpbGFiaWxpdHkoYm94KTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2RlbGV0ZUJveEFuZFBvcnRFZGdlcyA9IGZ1bmN0aW9uIChib3gpIHtcbiAgICBhc3NlcnQoYm94ICE9PSBudWxsLCAnQVJHcmFwaC5kZWxldGVCb3hBbmRQb3J0RWRnZXM6IGJveCAhPT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIHRoaXMuZGVsZXRlRWRnZXMoYm94KTtcblxuICAgIGZvciAodmFyIGkgPSBib3gucG9ydHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHRoaXMuZGVsZXRlRWRnZXMoYm94LnBvcnRzW2ldKTtcbiAgICB9XG5cbiAgICB0aGlzLl9yZW1vdmVGcm9tQnVmZmVyQm94ZXMoYm94KTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2dldEVkZ2VMaXN0ID0gZnVuY3Rpb24gKGlzaG9yaXpvbnRhbCkge1xuICAgIHJldHVybiBpc2hvcml6b250YWwgPyB0aGlzLmhvcml6b250YWwgOiB0aGlzLnZlcnRpY2FsO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fY2FuZGVsZXRlVHdvRWRnZXNBdCA9IGZ1bmN0aW9uIChwYXRoLCBwb2ludHMsIHBvcykge1xuICAgIGlmIChDT05TVEFOVFMuREVCVUcpIHtcbiAgICAgICAgYXNzZXJ0KHBhdGgub3duZXIgPT09IHRoaXMsICdBUkdyYXBoLmNhbmRlbGV0ZVR3b0VkZ2VzQXQ6IHBhdGgub3duZXIgPT09IHRoaXMgRkFJTEVEJyk7XG4gICAgICAgIHBhdGguYXNzZXJ0VmFsaWQoKTtcbiAgICAgICAgYXNzZXJ0KHBhdGguaXNDb25uZWN0ZWQoKSwgJ0FSR3JhcGguY2FuZGVsZXRlVHdvRWRnZXNBdDogcGF0aC5pc0Nvbm5lY3RlZCgpIEZBSUxFRCcpO1xuICAgICAgICBwb2ludHMuQXNzZXJ0VmFsaWRQb3MocG9zKTtcbiAgICB9XG5cbiAgICBpZiAocG9zICsgMiA+PSBwb2ludHMubGVuZ3RoIHx8IHBvcyA8IDEpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHZhciBwb2ludHBvcyA9IHBvcyxcbiAgICAgICAgcG9pbnQgPSBwb2ludHNbcG9zKytdLFxuICAgICAgICBucG9pbnRwb3MgPSBwb3MsXG4gICAgICAgIG5wb2ludCA9IHBvaW50c1twb3MrK10sXG4gICAgICAgIG5ucG9pbnRwb3MgPSBwb3M7XG5cbiAgICBwb3MgPSBwb2ludHBvcztcbiAgICBwb3MtLTtcbiAgICB2YXIgcHBvaW50cG9zID0gcG9zO1xuXG4gICAgdmFyIHBwb2ludCA9IHBvaW50c1twb3MtLV0sXG4gICAgICAgIHBwcG9pbnRwb3MgPSBwb3M7XG5cbiAgICBpZiAobnBvaW50LmVxdWFscyhwb2ludCkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlOyAvLyBkaXJlY3Rpb24gb2YgemVyby1sZW5ndGggZWRnZXMgY2FuJ3QgYmUgZGV0ZXJtaW5lZCwgc28gZG9uJ3QgZGVsZXRlIHRoZW1cbiAgICB9XG5cbiAgICBhc3NlcnQocHBwb2ludHBvcyA8IHBvaW50cy5sZW5ndGggJiYgcHBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCAmJiBwb2ludHBvcyA8IHBvaW50cy5sZW5ndGggJiZcbiAgICAgICAgbnBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCAmJiBubnBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCxcbiAgICAgICAgJ0FSR3JhcGguY2FuZGVsZXRlVHdvRWRnZXNBdDogcHBwb2ludHBvcyA8IHBvaW50cy5sZW5ndGggJiYgcHBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCAmJicgK1xuICAgICAgICAncG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoICYmIG5wb2ludHBvcyA8IHBvaW50cy5sZW5ndGggJiYgbm5wb2ludHBvcyA8IHBvaW50cy5sZW5ndGggRkFJTEVEJyk7XG5cbiAgICB2YXIgZGlyID0gVXRpbHMuZ2V0RGlyKG5wb2ludC5taW51cyhwb2ludCkpO1xuXG4gICAgYXNzZXJ0KFV0aWxzLmlzUmlnaHRBbmdsZShkaXIpLCAnQVJHcmFwaC5jYW5kZWxldGVUd29FZGdlc0F0OiBVdGlscy5pc1JpZ2h0QW5nbGUgKGRpcikgRkFJTEVEJyk7XG4gICAgdmFyIGlzaG9yaXpvbnRhbCA9IFV0aWxzLmlzSG9yaXpvbnRhbChkaXIpO1xuXG4gICAgdmFyIG5ld3BvaW50ID0gbmV3IEFyUG9pbnQoKTtcblxuICAgIGlmIChpc2hvcml6b250YWwpIHtcbiAgICAgICAgbmV3cG9pbnQueCA9IFV0aWxzLmdldFBvaW50Q29vcmQobnBvaW50LCBpc2hvcml6b250YWwpO1xuICAgICAgICBuZXdwb2ludC55ID0gVXRpbHMuZ2V0UG9pbnRDb29yZChwcG9pbnQsICFpc2hvcml6b250YWwpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG5ld3BvaW50LnkgPSBVdGlscy5nZXRQb2ludENvb3JkKG5wb2ludCwgaXNob3Jpem9udGFsKTtcbiAgICAgICAgbmV3cG9pbnQueCA9IFV0aWxzLmdldFBvaW50Q29vcmQocHBvaW50LCAhaXNob3Jpem9udGFsKTtcbiAgICB9XG5cbiAgICBhc3NlcnQoVXRpbHMuZ2V0RGlyKG5ld3BvaW50Lm1pbnVzKHBwb2ludCkpID09PSBkaXIsXG4gICAgICAgICdBUkdyYXBoLmNhbmRlbGV0ZVR3b0VkZ2VzQXQ6IFV0aWxzLmdldERpciAobmV3cG9pbnQubWludXMocHBvaW50KSkgPT09IGRpciBGQUlMRUQnKTtcblxuICAgIGlmICh0aGlzLl9pc0xpbmVDbGlwQm94ZXMobmV3cG9pbnQsIG5wb2ludCkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBpZiAodGhpcy5faXNMaW5lQ2xpcEJveGVzKG5ld3BvaW50LCBwcG9pbnQpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2RlbGV0ZVR3b0VkZ2VzQXQgPSBmdW5jdGlvbiAocGF0aCwgcG9pbnRzLCBwb3MpIHtcbiAgICBpZiAoQ09OU1RBTlRTLkRFQlVHKSB7XG4gICAgICAgIGFzc2VydChwYXRoLm93bmVyID09PSB0aGlzLCAnQVJHcmFwaC5kZWxldGVUd29FZGdlc0F0OiBwYXRoLm93bmVyID09PSB0aGlzIEZBSUxFRCcpO1xuICAgICAgICBwYXRoLmFzc2VydFZhbGlkKCk7XG4gICAgICAgIGFzc2VydChwYXRoLmlzQ29ubmVjdGVkKCksICdBUkdyYXBoLmRlbGV0ZVR3b0VkZ2VzQXQ6IHBhdGguaXNDb25uZWN0ZWQoKSBGQUlMRUQnKTtcbiAgICAgICAgcG9pbnRzLkFzc2VydFZhbGlkUG9zKHBvcyk7XG4gICAgfVxuXG4gICAgdmFyIHBvaW50cG9zID0gcG9zLCAvL0dldHRpbmcgdGhlIG5leHQsIGFuZCBuZXh0LW5leHQsIHBvaW50c1xuICAgICAgICBwb2ludCA9IHBvaW50c1twb3MrK10sXG4gICAgICAgIG5wb2ludHBvcyA9IHBvcyxcbiAgICAgICAgbnBvaW50ID0gcG9pbnRzW3BvcysrXSxcbiAgICAgICAgbm5wb2ludHBvcyA9IHBvcyxcbiAgICAgICAgbm5wb2ludCA9IHBvaW50c1twb3MrK10sXG4gICAgICAgIG5ubnBvaW50cG9zID0gcG9zO1xuXG4gICAgcG9zID0gcG9pbnRwb3M7XG4gICAgcG9zLS07XG5cbiAgICB2YXIgcHBvaW50cG9zID0gcG9zLCAvL0dldHRpbmcgdGhlIHByZXYsIHByZXYtcHJldiBwb2ludHNcbiAgICAgICAgcHBvaW50ID0gcG9pbnRzW3Bvcy0tXSxcbiAgICAgICAgcHBwb2ludHBvcyA9IHBvcyxcbiAgICAgICAgcHBwb2ludCA9IHBvaW50c1twb3MtLV07XG5cbiAgICBhc3NlcnQocHBwb2ludHBvcyA8IHBvaW50cy5sZW5ndGggJiYgcHBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCAmJiBwb2ludHBvcyA8IHBvaW50cy5sZW5ndGggJiZcbiAgICBucG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoICYmIG5ucG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoLFxuICAgICAgICAnQVJHcmFwaC5kZWxldGVUd29FZGdlc0F0OiBwcHBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCAmJiBwcG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoICYmIHBvaW50cG9zIDwgJyArXG4gICAgICAgICdwb2ludHMubGVuZ3RoICYmIG5wb2ludHBvcyA8IHBvaW50cy5sZW5ndGggJiYgbm5wb2ludHBvcyA8IHBvaW50cy5sZW5ndGggRkFJTEVEJyk7XG4gICAgYXNzZXJ0KHBwcG9pbnQgIT09IG51bGwgJiYgcHBvaW50ICE9PSBudWxsICYmIHBvaW50ICE9PSBudWxsICYmIG5wb2ludCAhPT0gbnVsbCAmJiBubnBvaW50ICE9PSBudWxsLFxuICAgICAgICAnQVJHcmFwaC5kZWxldGVUd29FZGdlc0F0OiBwcHBvaW50ICE9PSBudWxsICYmIHBwb2ludCAhPT0gbnVsbCAmJiBwb2ludCAhPT0gbnVsbCAmJiBucG9pbnQgIT09IG51bGwgJiYnICtcbiAgICAgICAgJyBubnBvaW50ICE9PSBudWxsIEZBSUxFRCcpO1xuXG4gICAgdmFyIGRpciA9IFV0aWxzLmdldERpcihucG9pbnQubWludXMocG9pbnQpKTtcblxuICAgIGFzc2VydChVdGlscy5pc1JpZ2h0QW5nbGUoZGlyKSwgJ0FSR3JhcGguZGVsZXRlVHdvRWRnZXNBdDogVXRpbHMuaXNSaWdodEFuZ2xlIChkaXIpIEZBSUxFRCcpO1xuICAgIHZhciBpc2hvcml6b250YWwgPSBVdGlscy5pc0hvcml6b250YWwoZGlyKTtcblxuICAgIHZhciBuZXdwb2ludCA9IG5ldyBBclBvaW50KCk7XG4gICAgaWYgKGlzaG9yaXpvbnRhbCkge1xuICAgICAgICBuZXdwb2ludC54ID0gVXRpbHMuZ2V0UG9pbnRDb29yZChucG9pbnQsIGlzaG9yaXpvbnRhbCk7XG4gICAgICAgIG5ld3BvaW50LnkgPSBVdGlscy5nZXRQb2ludENvb3JkKHBwb2ludCwgIWlzaG9yaXpvbnRhbCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbmV3cG9pbnQueCA9IFV0aWxzLmdldFBvaW50Q29vcmQocHBvaW50LCAhaXNob3Jpem9udGFsKTtcbiAgICAgICAgbmV3cG9pbnQueSA9IFV0aWxzLmdldFBvaW50Q29vcmQobnBvaW50LCBpc2hvcml6b250YWwpO1xuICAgIH1cblxuICAgIGFzc2VydChVdGlscy5nZXREaXIobmV3cG9pbnQubWludXMocHBvaW50KSkgPT09IGRpcixcbiAgICAgICAgJ0FSR3JhcGguZGVsZXRlVHdvRWRnZXNBdDogVXRpbHMuZ2V0RGlyIChuZXdwb2ludC5taW51cyhwcG9pbnQpKSA9PT0gZGlyIEZBSUxFRCcpO1xuXG4gICAgYXNzZXJ0KCF0aGlzLl9pc0xpbmVDbGlwQm94ZXMobmV3cG9pbnQsIG5wb2ludCksXG4gICAgICAgICdBUkdyYXBoLmRlbGV0ZVR3b0VkZ2VzQXQ6ICFpc0xpbmVDbGlwQm94ZXMobmV3cG9pbnQsIG5wb2ludCkgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KCF0aGlzLl9pc0xpbmVDbGlwQm94ZXMobmV3cG9pbnQsIHBwb2ludCksXG4gICAgICAgICdBUkdyYXBoLmRlbGV0ZVR3b0VkZ2VzQXQ6ICFpc0xpbmVDbGlwQm94ZXMobmV3cG9pbnQsIHBwb2ludCkgRkFJTEVEJyk7XG5cbiAgICB2YXIgaGxpc3QgPSB0aGlzLl9nZXRFZGdlTGlzdChpc2hvcml6b250YWwpLFxuICAgICAgICB2bGlzdCA9IHRoaXMuX2dldEVkZ2VMaXN0KCFpc2hvcml6b250YWwpO1xuXG4gICAgdmFyIHBwZWRnZSA9IGhsaXN0LmdldEVkZ2VCeVBvaW50ZXIocHBwb2ludCksXG4gICAgICAgIHBlZGdlID0gdmxpc3QuZ2V0RWRnZUJ5UG9pbnRlcihwcG9pbnQpLFxuICAgICAgICBuZWRnZSA9IGhsaXN0LmdldEVkZ2VCeVBvaW50ZXIocG9pbnQpLFxuICAgICAgICBubmVkZ2UgPSB2bGlzdC5nZXRFZGdlQnlQb2ludGVyKG5wb2ludCk7XG5cbiAgICBhc3NlcnQocHBlZGdlICE9PSBudWxsICYmIHBlZGdlICE9PSBudWxsICYmIG5lZGdlICE9PSBudWxsICYmIG5uZWRnZSAhPT0gbnVsbCxcbiAgICAgICAgJ0FSR3JhcGguZGVsZXRlVHdvRWRnZXNBdDogIHBwZWRnZSAhPT0gbnVsbCAmJiBwZWRnZSAhPT0gbnVsbCAmJiBuZWRnZSAhPT0gbnVsbCAmJiBubmVkZ2UgIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICB2bGlzdC5yZW1vdmUocGVkZ2UpO1xuICAgIGhsaXN0LnJlbW92ZShuZWRnZSk7XG5cbiAgICBwb2ludHMuc3BsaWNlKHBwb2ludHBvcywgMywgbmV3cG9pbnQpO1xuICAgIHBwZWRnZS5lbmRwb2ludE5leHQgPSBubnBvaW50O1xuICAgIHBwZWRnZS5lbmRwb2ludCA9IG5ld3BvaW50O1xuXG4gICAgbm5lZGdlLnN0YXJ0cG9pbnQgPSBuZXdwb2ludDtcbiAgICBubmVkZ2Uuc3RhcnRwb2ludFByZXYgPSBwcHBvaW50O1xuXG4gICAgaWYgKG5ubnBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCkge1xuICAgICAgICB2YXIgbm5uZWRnZSA9IGhsaXN0LmdldEVkZ2VCeVBvaW50ZXIobm5wb2ludCwgKG5ubnBvaW50cG9zKSk7XG4gICAgICAgIGFzc2VydChubm5lZGdlICE9PSBudWxsLFxuICAgICAgICAgICAgJ0FSR3JhcGguZGVsZXRlVHdvRWRnZXNBdDogbm5uZWRnZSAhPT0gbnVsbCBGQUlMRUQnKTtcbiAgICAgICAgYXNzZXJ0KG5ubmVkZ2Uuc3RhcnRwb2ludFByZXYuZXF1YWxzKG5wb2ludCkgJiYgbm5uZWRnZS5zdGFydHBvaW50LmVxdWFscyhubnBvaW50KSxcbiAgICAgICAgICAgICdBUkdyYXBoLmRlbGV0ZVR3b0VkZ2VzQXQ6IG5ubmVkZ2Uuc3RhcnRwb2ludFByZXYuZXF1YWxzKG5wb2ludCknICtcbiAgICAgICAgICAgICcmJiBubm5lZGdlLnN0YXJ0cG9pbnQuZXF1YWxzKG5ucG9pbnQpIEZBSUxFRCcpO1xuICAgICAgICBubm5lZGdlLnN0YXJ0cG9pbnRQcmV2ID0gcHBvaW50O1xuICAgIH1cblxuICAgIGlmIChubnBvaW50LmVxdWFscyhuZXdwb2ludCkpIHtcbiAgICAgICAgdGhpcy5fZGVsZXRlU2FtZVBvaW50c0F0KHBhdGgsIHBvaW50cywgcHBvaW50cG9zKTtcbiAgICB9XG5cbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2RlbGV0ZVNhbWVQb2ludHNBdCA9IGZ1bmN0aW9uIChwYXRoLCBwb2ludHMsIHBvcykge1xuICAgIGlmIChDT05TVEFOVFMuREVCVUcpIHtcbiAgICAgICAgYXNzZXJ0KHBhdGgub3duZXIgPT09IHRoaXMsICdBUkdyYXBoLmRlbGV0ZVNhbWVQb2ludHNBdDogcGF0aC5vd25lciA9PT0gdGhpcyBGQUlMRUQnKTtcbiAgICAgICAgcGF0aC5hc3NlcnRWYWxpZCgpO1xuICAgICAgICBhc3NlcnQocGF0aC5pc0Nvbm5lY3RlZCgpLCAnQVJHcmFwaC5kZWxldGVTYW1lUG9pbnRzQXQ6IHBhdGguaXNDb25uZWN0ZWQoKSBGQUlMRUQnKTtcbiAgICAgICAgcG9pbnRzLkFzc2VydFZhbGlkUG9zKHBvcyk7XG4gICAgfVxuXG4gICAgdmFyIHBvaW50cG9zID0gcG9zLFxuICAgICAgICBwb2ludCA9IHBvaW50c1twb3MrK10sXG4gICAgICAgIG5wb2ludHBvcyA9IHBvcyxcbiAgICAgICAgbnBvaW50ID0gcG9pbnRzW3BvcysrXSxcbiAgICAgICAgbm5wb2ludHBvcyA9IHBvcyxcbiAgICAgICAgbm5wb2ludCA9IHBvaW50c1twb3MrK10sXG4gICAgICAgIG5ubnBvaW50cG9zID0gcG9zO1xuXG4gICAgcG9zID0gcG9pbnRwb3M7XG4gICAgcG9zLS07XG5cbiAgICB2YXIgcHBvaW50cG9zID0gcG9zLFxuICAgICAgICBwcG9pbnQgPSBwb2ludHNbcG9zLS1dLFxuICAgICAgICBwcHBvaW50cG9zID0gcG9zLFxuICAgICAgICBwcHBvaW50ID0gcG9zID09PSBwb2ludHMubGVuZ3RoID8gbnVsbCA6IHBvaW50c1twb3MtLV07XG5cbiAgICBhc3NlcnQocHBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCAmJiBwb2ludHBvcyA8IHBvaW50cy5sZW5ndGggJiYgbnBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCAmJlxuICAgIG5ucG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoKTtcbiAgICBhc3NlcnQocHBvaW50ICE9PSBudWxsICYmIHBvaW50ICE9PSBudWxsICYmIG5wb2ludCAhPT0gbnVsbCAmJiBubnBvaW50ICE9PSBudWxsLFxuICAgICAgICAnQVJHcmFwaC5kZWxldGVTYW1lUG9pbnRzQXQ6IHBwb2ludCAhPT0gbnVsbCAmJiBwb2ludCAhPT0gbnVsbCAmJiBucG9pbnQgIT09IG51bGwgJiYgJyArXG4gICAgICAgICdubnBvaW50ICE9PSBudWxsIEZBSUxFRCcpO1xuICAgIGFzc2VydChwb2ludC5lcXVhbHMobnBvaW50KSAmJiAhcG9pbnQuZXF1YWxzKHBwb2ludCksXG4gICAgICAgICdBUkdyYXBoLmRlbGV0ZVNhbWVQb2ludHNBdDogcG9pbnQuZXF1YWxzKG5wb2ludCkgJiYgIXBvaW50LmVxdWFscyhwcG9pbnQpIEZBSUxFRCcpO1xuXG4gICAgdmFyIGRpciA9IFV0aWxzLmdldERpcihwb2ludC5taW51cyhwcG9pbnQpKTtcbiAgICBhc3NlcnQoVXRpbHMuaXNSaWdodEFuZ2xlKGRpciksICdBUkdyYXBoLmRlbGV0ZVNhbWVQb2ludHNBdDogVXRpbHMuaXNSaWdodEFuZ2xlIChkaXIpIEZBSUxFRCcpO1xuXG4gICAgdmFyIGlzaG9yaXpvbnRhbCA9IFV0aWxzLmlzSG9yaXpvbnRhbChkaXIpLFxuICAgICAgICBobGlzdCA9IHRoaXMuX2dldEVkZ2VMaXN0KGlzaG9yaXpvbnRhbCksXG4gICAgICAgIHZsaXN0ID0gdGhpcy5fZ2V0RWRnZUxpc3QoIWlzaG9yaXpvbnRhbCksXG5cbiAgICAgICAgcGVkZ2UgPSBobGlzdC5nZXRFZGdlQnlQb2ludGVyKHBwb2ludCwgcG9pbnQpLFxuICAgICAgICBuZWRnZSA9IHZsaXN0LmdldEVkZ2VCeVBvaW50ZXIocG9pbnQsIG5wb2ludCksXG4gICAgICAgIG5uZWRnZSA9IGhsaXN0LmdldEVkZ2VCeVBvaW50ZXIobnBvaW50LCBubnBvaW50KTtcblxuICAgIGFzc2VydChwZWRnZSAhPT0gbnVsbCAmJiBuZWRnZSAhPT0gbnVsbCAmJiBubmVkZ2UgIT09IG51bGwsICdBUkdyYXBoLmRlbGV0ZVNhbWVQb2ludHNBdDogcGVkZ2UgIT09IG51bGwgJyArXG4gICAgJyYmIG5lZGdlICE9PSBudWxsICYmIG5uZWRnZSAhPT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIHZsaXN0LnJlbW92ZShwZWRnZSk7XG4gICAgaGxpc3QucmVtb3ZlKG5lZGdlKTtcblxuICAgIHBvaW50cy5zcGxpY2UocG9pbnRwb3MsIDIpO1xuXG4gICAgaWYgKHBwcG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoKSB7XG4gICAgICAgIHZhciBwcGVkZ2UgPSB2bGlzdC5nZXRFZGdlQnlQb2ludGVyKHBwcG9pbnQsIHBwb2ludCk7XG4gICAgICAgIGFzc2VydChwcGVkZ2UgIT09IG51bGwgJiYgcHBlZGdlLmVuZHBvaW50LmVxdWFscyhwcG9pbnQpICYmIHBwZWRnZS5lbmRwb2ludE5leHQuZXF1YWxzKHBvaW50KSxcbiAgICAgICAgICAgICdBUkdyYXBoLmRlbGV0ZVNhbWVQb2ludHNBdDogcHBlZGdlICE9PSBudWxsICYmIHBwZWRnZS5lbmRwb2ludC5lcXVhbHMocHBvaW50KSAmJiAnICtcbiAgICAgICAgICAgICdwcGVkZ2UuZW5kcG9pbnROZXh0LmVxdWFscyhwb2ludCkgRkFJTEVEJyk7XG4gICAgICAgIHBwZWRnZS5lbmRwb2ludE5leHQgPSBubnBvaW50O1xuICAgIH1cblxuICAgIGFzc2VydChubmVkZ2Uuc3RhcnRwb2ludC5lcXVhbHMobnBvaW50KSAmJiBubmVkZ2Uuc3RhcnRwb2ludFByZXYuZXF1YWxzKHBvaW50KSxcbiAgICAgICAgJ0FSR3JhcGguZGVsZXRlU2FtZVBvaW50c0F0OiBubmVkZ2Uuc3RhcnRwb2ludC5lcXVhbHMobnBvaW50KSAmJiBubmVkZ2Uuc3RhcnRwb2ludFByZXYuZXF1YWxzKHBvaW50KScgK1xuICAgICAgICAnIEZBSUxFRCcpO1xuICAgIG5uZWRnZS5zZXRTdGFydFBvaW50KHBwb2ludCk7XG4gICAgbm5lZGdlLnN0YXJ0cG9pbnRQcmV2ID0gcHBwb2ludDtcblxuICAgIGlmIChubm5wb2ludHBvcyA8IHBvaW50cy5sZW5ndGgpIHtcbiAgICAgICAgdmFyIG5ubmVkZ2UgPSB2bGlzdC5nZXRFZGdlQnlQb2ludGVyKG5ucG9pbnQsIChubm5wb2ludHBvcykpOyAvLyYqXG4gICAgICAgIGFzc2VydChubm5lZGdlICE9PSBudWxsICYmIG5ubmVkZ2Uuc3RhcnRwb2ludFByZXYuZXF1YWxzKG5wb2ludCkgJiYgbm5uZWRnZS5zdGFydHBvaW50LmVxdWFscyhubnBvaW50KSxcbiAgICAgICAgICAgICdBUkdyYXBoLmRlbGV0ZVNhbWVQb2ludHNBdDogbm5uZWRnZSAhPT0gbnVsbCAmJiBubm5lZGdlLnN0YXJ0cG9pbnRQcmV2LmVxdWFscyhucG9pbnQpICYmICcgK1xuICAgICAgICAgICAgJ25ubmVkZ2Uuc3RhcnRwb2ludC5lcXVhbHMobm5wb2ludCkgRkFJTEVEJyk7XG4gICAgICAgIG5ubmVkZ2Uuc3RhcnRwb2ludFByZXYgPSBwcG9pbnQ7XG4gICAgfVxuXG4gICAgaWYgKENPTlNUQU5UUy5ERUJVR19ERUVQKSB7XG4gICAgICAgIHBhdGguYXNzZXJ0VmFsaWQoKTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9zaW1wbGlmeVBhdGhzID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBtb2RpZmllZCA9IGZhbHNlLFxuICAgICAgICBwYXRoLFxuICAgICAgICBwb2ludExpc3QsXG4gICAgICAgIHBvaW50cG9zO1xuXG4gICAgZm9yICh2YXIgaSA9IHRoaXMucGF0aHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHBhdGggPSB0aGlzLnBhdGhzW2ldO1xuXG4gICAgICAgIGlmIChwYXRoLmlzQXV0b1JvdXRlZCgpKSB7XG4gICAgICAgICAgICBwb2ludExpc3QgPSBwYXRoLmdldFBvaW50TGlzdCgpO1xuICAgICAgICAgICAgcG9pbnRwb3MgPSAwO1xuXG4gICAgICAgICAgICBtb2RpZmllZCA9IHRoaXMuX2ZpeFNob3J0UGF0aHMocGF0aCkgfHwgbW9kaWZpZWQ7XG5cbiAgICAgICAgICAgIHdoaWxlIChwb2ludHBvcyA8IHBvaW50TGlzdC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fY2FuZGVsZXRlVHdvRWRnZXNBdChwYXRoLCBwb2ludExpc3QsIHBvaW50cG9zKSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9kZWxldGVUd29FZGdlc0F0KHBhdGgsIHBvaW50TGlzdCwgcG9pbnRwb3MpO1xuICAgICAgICAgICAgICAgICAgICBtb2RpZmllZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBwb2ludHBvcysrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG1vZGlmaWVkO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fY2VudGVyU3RhaXJzSW5QYXRoUG9pbnRzID0gZnVuY3Rpb24gKHBhdGgsIGhpbnRzdGFydGRpciwgaGludGVuZGRpcikge1xuICAgIGFzc2VydChwYXRoICE9PSBudWxsLCAnQVJHcmFwaC5jZW50ZXJTdGFpcnNJblBhdGhQb2ludHM6IHBhdGggIT09IG51bGwgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KCFwYXRoLmlzQ29ubmVjdGVkKCksICdBUkdyYXBoLmNlbnRlclN0YWlyc0luUGF0aFBvaW50czogIXBhdGguaXNDb25uZWN0ZWQoKSBGQUlMRUQnKTtcblxuICAgIHZhciBwb2ludExpc3QgPSBwYXRoLmdldFBvaW50TGlzdCgpO1xuICAgIGFzc2VydChwb2ludExpc3QubGVuZ3RoID49IDIsICdBUkdyYXBoLmNlbnRlclN0YWlyc0luUGF0aFBvaW50czogcG9pbnRMaXN0Lmxlbmd0aCA+PSAyIEZBSUxFRCcpO1xuXG4gICAgaWYgKENPTlNUQU5UUy5ERUJVRykge1xuICAgICAgICBwYXRoLmFzc2VydFZhbGlkUG9pbnRzKCk7XG4gICAgfVxuXG4gICAgdmFyIHAxLFxuICAgICAgICBwMixcbiAgICAgICAgcDMsXG4gICAgICAgIHA0LFxuXG4gICAgICAgIHAxcCA9IHBvaW50TGlzdC5sZW5ndGgsXG4gICAgICAgIHAycCA9IHBvaW50TGlzdC5sZW5ndGgsXG4gICAgICAgIHAzcCA9IHBvaW50TGlzdC5sZW5ndGgsXG4gICAgICAgIHA0cCA9IHBvaW50TGlzdC5sZW5ndGgsXG5cbiAgICAgICAgZDEyID0gQ09OU1RBTlRTLkRpck5vbmUsXG4gICAgICAgIGQyMyA9IENPTlNUQU5UUy5EaXJOb25lLFxuICAgICAgICBkMzQgPSBDT05TVEFOVFMuRGlyTm9uZSxcblxuICAgICAgICBvdXRPZkJveFN0YXJ0UG9pbnQgPSBwYXRoLmdldE91dE9mQm94U3RhcnRQb2ludChoaW50c3RhcnRkaXIpLFxuICAgICAgICBvdXRPZkJveEVuZFBvaW50ID0gcGF0aC5nZXRPdXRPZkJveEVuZFBvaW50KGhpbnRlbmRkaXIpLFxuXG4gICAgICAgIHBvcyA9IDA7XG4gICAgYXNzZXJ0KHBvcyA8IHBvaW50TGlzdC5sZW5ndGgsICdBUkdyYXBoLmNlbnRlclN0YWlyc0luUGF0aFBvaW50cyBwb3MgPCBwb2ludExpc3QubGVuZ3RoIEZBSUxFRCcpO1xuXG4gICAgcDFwID0gcG9zO1xuICAgIHAxID0gKHBvaW50TGlzdFtwb3MrK10pO1xuXG4gICAgdmFyIG5wMixcbiAgICAgICAgbnAzLFxuICAgICAgICBoLFxuICAgICAgICBwNHgsXG4gICAgICAgIHAzeCxcbiAgICAgICAgcDF4LFxuICAgICAgICB0bXAsXG4gICAgICAgIHQsXG4gICAgICAgIG07XG5cblxuICAgIHdoaWxlIChwb3MgPCBwb2ludExpc3QubGVuZ3RoKSB7XG4gICAgICAgIHA0cCA9IHAzcDtcbiAgICAgICAgcDNwID0gcDJwO1xuICAgICAgICBwMnAgPSBwMXA7XG4gICAgICAgIHAxcCA9IHBvcztcblxuICAgICAgICBwNCA9IHAzO1xuICAgICAgICBwMyA9IHAyO1xuICAgICAgICBwMiA9IHAxO1xuICAgICAgICBwMSA9IChwb2ludExpc3RbcG9zKytdKTtcblxuICAgICAgICBkMzQgPSBkMjM7XG4gICAgICAgIGQyMyA9IGQxMjtcblxuICAgICAgICBpZiAocDJwIDwgcG9pbnRMaXN0Lmxlbmd0aCkge1xuICAgICAgICAgICAgZDEyID0gVXRpbHMuZ2V0RGlyKHAyLm1pbnVzKHAxKSk7XG4gICAgICAgICAgICBpZiAoQ09OU1RBTlRTLkRFQlVHKSB7XG4gICAgICAgICAgICAgICAgYXNzZXJ0KFV0aWxzLmlzUmlnaHRBbmdsZShkMTIpLCAnQVJHcmFwaC5jZW50ZXJTdGFpcnNJblBhdGhQb2ludHM6ICcgK1xuICAgICAgICAgICAgICAgICdVdGlscy5pc1JpZ2h0QW5nbGUgKGQxMikgRkFJTEVEJyk7XG4gICAgICAgICAgICAgICAgaWYgKHAzcCAhPT0gcG9pbnRMaXN0LmVuZCgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGFzc2VydChVdGlscy5hcmVJblJpZ2h0QW5nbGUoZDEyLCBkMjMpLCAnQVJHcmFwaC5jZW50ZXJTdGFpcnNJblBhdGhQb2ludHM6ICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXRpbHMuYXJlSW5SaWdodEFuZ2xlIChkMTIsIGQyMykgRkFJTEVEJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHA0cCA8IHBvaW50TGlzdC5sZW5ndGggJiYgZDEyID09PSBkMzQpIHtcbiAgICAgICAgICAgIGFzc2VydChwMXAgPCBwb2ludExpc3QubGVuZ3RoICYmIHAycCA8IHBvaW50TGlzdC5sZW5ndGggJiYgcDNwIDwgcG9pbnRMaXN0Lmxlbmd0aCAmJlxuICAgICAgICAgICAgcDRwIDwgcG9pbnRMaXN0Lmxlbmd0aCwgJ0FSR3JhcGguY2VudGVyU3RhaXJzSW5QYXRoUG9pbnRzOiBwMXAgPCBwb2ludExpc3QubGVuZ3RoICYmICcgK1xuICAgICAgICAgICAgJ3AycCA8IHBvaW50TGlzdC5sZW5ndGggJiYgcDNwIDwgcG9pbnRMaXN0Lmxlbmd0aCAmJiBwNHAgPCBwb2ludExpc3QubGVuZ3RoIEZBSUxFRCcpO1xuXG4gICAgICAgICAgICBucDIgPSBuZXcgQXJQb2ludChwMik7XG4gICAgICAgICAgICBucDMgPSBuZXcgQXJQb2ludChwMyk7XG4gICAgICAgICAgICBoID0gVXRpbHMuaXNIb3Jpem9udGFsKGQxMik7XG5cbiAgICAgICAgICAgIHA0eCA9IFV0aWxzLmdldFBvaW50Q29vcmQocDQsIGgpO1xuICAgICAgICAgICAgcDN4ID0gVXRpbHMuZ2V0UG9pbnRDb29yZChwMywgaCk7XG4gICAgICAgICAgICBwMXggPSBVdGlscy5nZXRQb2ludENvb3JkKHAxLCBoKTtcblxuICAgICAgICAgICAgLy8gcDF4IHdpbGwgcmVwcmVzZW50IHRoZSBsYXJnZXIgeCB2YWx1ZSBpbiB0aGlzICdzdGVwJyBzaXR1YXRpb25cbiAgICAgICAgICAgIGlmIChwMXggPCBwNHgpIHtcbiAgICAgICAgICAgICAgICB0ID0gcDF4O1xuICAgICAgICAgICAgICAgIHAxeCA9IHA0eDtcbiAgICAgICAgICAgICAgICBwNHggPSB0O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAocDR4IDwgcDN4ICYmIHAzeCA8IHAxeCkge1xuICAgICAgICAgICAgICAgIG0gPSBNYXRoLnJvdW5kKChwNHggKyBwMXgpIC8gMik7XG4gICAgICAgICAgICAgICAgaWYgKGgpIHtcbiAgICAgICAgICAgICAgICAgICAgbnAyLnggPSBtO1xuICAgICAgICAgICAgICAgICAgICBucDMueCA9IG07XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbnAyLnkgPSBtO1xuICAgICAgICAgICAgICAgICAgICBucDMueSA9IG07XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdG1wID0gdGhpcy5fZ2V0TGltaXRzT2ZFZGdlKG5wMiwgbnAzLCBwNHgsIHAxeCk7XG4gICAgICAgICAgICAgICAgcDR4ID0gdG1wLm1pbjtcbiAgICAgICAgICAgICAgICBwMXggPSB0bXAubWF4O1xuXG4gICAgICAgICAgICAgICAgbSA9IE1hdGgucm91bmQoKHA0eCArIHAxeCkgLyAyKTtcblxuICAgICAgICAgICAgICAgIGlmIChoKSB7XG4gICAgICAgICAgICAgICAgICAgIG5wMi54ID0gbTtcbiAgICAgICAgICAgICAgICAgICAgbnAzLnggPSBtO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG5wMi55ID0gbTtcbiAgICAgICAgICAgICAgICAgICAgbnAzLnkgPSBtO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICghdGhpcy5faXNMaW5lQ2xpcEJveGVzKG5wMiwgbnAzKSAmJiAhdGhpcy5faXNMaW5lQ2xpcEJveGVzKHAxcCA9PT0gcG9pbnRMaXN0Lmxlbmd0aCA/XG4gICAgICAgICAgICAgICAgICAgICAgICBvdXRPZkJveEVuZFBvaW50IDogcDEsIG5wMikgJiYgIXRoaXMuX2lzTGluZUNsaXBCb3hlcyhwNHAgPT09IDAgP1xuICAgICAgICAgICAgICAgICAgICAgICAgb3V0T2ZCb3hTdGFydFBvaW50IDogcDQsIG5wMykpIHtcbiAgICAgICAgICAgICAgICAgICAgcDIgPSBucDI7XG4gICAgICAgICAgICAgICAgICAgIHAzID0gbnAzO1xuICAgICAgICAgICAgICAgICAgICBwb2ludExpc3Quc3BsaWNlKHAycCwgMSwgcDIpO1xuICAgICAgICAgICAgICAgICAgICBwb2ludExpc3Quc3BsaWNlKHAzcCwgMSwgcDMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChDT05TVEFOVFMuREVCVUcpIHtcbiAgICAgICAgcGF0aC5hc3NlcnRWYWxpZFBvaW50cygpO1xuICAgIH1cbn07XG5cbi8qKlxuICogTWFrZSBzdXJlIGlmIGEgc3RyYWlnaHQgbGluZSBpcyBwb3NzaWJsZSwgY3JlYXRlIGEgc3RyYWlnaHQgbGluZSBmb3JcbiAqIHRoZSBwYXRoLlxuICpcbiAqIEBwYXJhbSB7QXV0b1JvdXRlclBhdGh9IHBhdGhcbiAqL1xuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fZml4U2hvcnRQYXRocyA9IGZ1bmN0aW9uIChwYXRoKSB7XG5cbiAgICB2YXIgbW9kaWZpZWQgPSBmYWxzZSxcbiAgICAgICAgc3RhcnRwb3J0ID0gcGF0aC5nZXRTdGFydFBvcnQoKSxcbiAgICAgICAgZW5kcG9ydCA9IHBhdGguZ2V0RW5kUG9ydCgpLFxuICAgICAgICBsZW4gPSBwYXRoLmdldFBvaW50TGlzdCgpLmxlbmd0aDtcblxuICAgIGlmIChsZW4gPT09IDQpIHtcbiAgICAgICAgdmFyIHBvaW50cyA9IHBhdGguZ2V0UG9pbnRMaXN0KCksXG4gICAgICAgICAgICBzdGFydHBvaW50ID0gcG9pbnRzWzBdLFxuICAgICAgICAgICAgZW5kcG9pbnQgPSBwb2ludHNbbGVuIC0gMV0sXG4gICAgICAgICAgICBzdGFydERpciA9IHN0YXJ0cG9ydC5wb3J0T25XaGljaEVkZ2Uoc3RhcnRwb2ludCksXG4gICAgICAgICAgICBlbmREaXIgPSBlbmRwb3J0LnBvcnRPbldoaWNoRWRnZShlbmRwb2ludCksXG4gICAgICAgICAgICB0c3RTdGFydCxcbiAgICAgICAgICAgIHRzdEVuZDtcblxuICAgICAgICBpZiAoc3RhcnREaXIgPT09IFV0aWxzLnJldmVyc2VEaXIoZW5kRGlyKSkge1xuICAgICAgICAgICAgdmFyIGlzSG9yaXpvbnRhbCA9IFV0aWxzLmlzSG9yaXpvbnRhbChzdGFydERpciksXG4gICAgICAgICAgICAgICAgbmV3U3RhcnQgPSBuZXcgQXJQb2ludChzdGFydHBvaW50KSxcbiAgICAgICAgICAgICAgICBuZXdFbmQgPSBuZXcgQXJQb2ludChlbmRwb2ludCksXG4gICAgICAgICAgICAgICAgc3RhcnRSZWN0ID0gc3RhcnRwb3J0LnJlY3QsXG4gICAgICAgICAgICAgICAgZW5kUmVjdCA9IGVuZHBvcnQucmVjdCxcbiAgICAgICAgICAgICAgICBtaW5PdmVybGFwLFxuICAgICAgICAgICAgICAgIG1heE92ZXJsYXA7XG5cbiAgICAgICAgICAgIGlmIChpc0hvcml6b250YWwpIHtcbiAgICAgICAgICAgICAgICBtaW5PdmVybGFwID0gTWF0aC5taW4oc3RhcnRSZWN0LmZsb29yLCBlbmRSZWN0LmZsb29yKTtcbiAgICAgICAgICAgICAgICBtYXhPdmVybGFwID0gTWF0aC5tYXgoc3RhcnRSZWN0LmNlaWwsIGVuZFJlY3QuY2VpbCk7XG5cbiAgICAgICAgICAgICAgICB2YXIgbmV3WSA9IChtaW5PdmVybGFwICsgbWF4T3ZlcmxhcCkgLyAyO1xuICAgICAgICAgICAgICAgIG5ld1N0YXJ0LnkgPSBuZXdZO1xuICAgICAgICAgICAgICAgIG5ld0VuZC55ID0gbmV3WTtcblxuICAgICAgICAgICAgICAgIHRzdFN0YXJ0ID0gbmV3IEFyUG9pbnQoVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQoc3RhcnRwb3J0Lm93bmVyLnJlY3QsIHN0YXJ0RGlyKSwgbmV3U3RhcnQueSk7XG4gICAgICAgICAgICAgICAgdHN0RW5kID0gbmV3IEFyUG9pbnQoVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQoZW5kcG9ydC5vd25lci5yZWN0LCBlbmREaXIpLCBuZXdFbmQueSk7XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbWluT3ZlcmxhcCA9IE1hdGgubWluKHN0YXJ0UmVjdC5yaWdodCwgZW5kUmVjdC5yaWdodCk7XG4gICAgICAgICAgICAgICAgbWF4T3ZlcmxhcCA9IE1hdGgubWF4KHN0YXJ0UmVjdC5sZWZ0LCBlbmRSZWN0LmxlZnQpO1xuXG4gICAgICAgICAgICAgICAgdmFyIG5ld1ggPSAobWluT3ZlcmxhcCArIG1heE92ZXJsYXApIC8gMjtcbiAgICAgICAgICAgICAgICBuZXdTdGFydC54ID0gbmV3WDtcbiAgICAgICAgICAgICAgICBuZXdFbmQueCA9IG5ld1g7XG5cbiAgICAgICAgICAgICAgICB0c3RTdGFydCA9IG5ldyBBclBvaW50KG5ld1N0YXJ0LngsIFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKHN0YXJ0cG9ydC5vd25lci5yZWN0LCBzdGFydERpcikpO1xuICAgICAgICAgICAgICAgIHRzdEVuZCA9IG5ldyBBclBvaW50KG5ld0VuZC54LCBVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChlbmRwb3J0Lm93bmVyLnJlY3QsIGVuZERpcikpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgdmFsaWRQb2ludExvY2F0aW9uID0gc3RhcnRSZWN0LnB0SW5SZWN0KG5ld1N0YXJ0KSAmJiAhc3RhcnRSZWN0Lm9uQ29ybmVyKG5ld1N0YXJ0KSAmJlxuICAgICAgICAgICAgICAgIGVuZFJlY3QucHRJblJlY3QobmV3RW5kKSAmJiAhZW5kUmVjdC5vbkNvcm5lcihuZXdFbmQpO1xuXG4gICAgICAgICAgICBpZiAodmFsaWRQb2ludExvY2F0aW9uICYmICF0aGlzLl9pc0xpbmVDbGlwQm94ZXModHN0U3RhcnQsIHRzdEVuZCkpIHtcbiAgICAgICAgICAgICAgICB2YXIgaGxpc3QgPSB0aGlzLl9nZXRFZGdlTGlzdChpc0hvcml6b250YWwpLFxuICAgICAgICAgICAgICAgICAgICB2bGlzdCA9IHRoaXMuX2dldEVkZ2VMaXN0KCFpc0hvcml6b250YWwpLFxuICAgICAgICAgICAgICAgICAgICBlZGdlID0gaGxpc3QuZ2V0RWRnZUJ5UG9pbnRlcihzdGFydHBvaW50KSxcbiAgICAgICAgICAgICAgICAgICAgZWRnZTIgPSB2bGlzdC5nZXRFZGdlQnlQb2ludGVyKHBvaW50c1sxXSksXG4gICAgICAgICAgICAgICAgICAgIGVkZ2UzID0gaGxpc3QuZ2V0RWRnZUJ5UG9pbnRlcihwb2ludHNbMl0pO1xuXG4gICAgICAgICAgICAgICAgdmxpc3QucmVtb3ZlKGVkZ2UyKTtcbiAgICAgICAgICAgICAgICBobGlzdC5yZW1vdmUoZWRnZTMpO1xuICAgICAgICAgICAgICAgIGhsaXN0LnJlbW92ZShlZGdlKTtcblxuICAgICAgICAgICAgICAgIC8vIFRoZSB2YWx1ZXMgb2Ygc3RhcnRwb2ludCBpcyBjaGFuZ2VkIGJ1dCB3ZSBkb24ndCBjaGFuZ2UgdGhlIHN0YXJ0cG9pbnQgb2YgdGhlIGVkZ2VcbiAgICAgICAgICAgICAgICBzdGFydHBvaW50LmFzc2lnbihuZXdTdGFydCk7XG4gICAgICAgICAgICAgICAgLy8gdG8gbWFpbnRhaW4gdGhlIHJlZmVyZW5jZSB0aGF0IHRoZSBwb3J0IGhhcyB0byB0aGUgc3RhcnRwb2ludFxuICAgICAgICAgICAgICAgIGVuZHBvaW50LmFzc2lnbihuZXdFbmQpO1xuICAgICAgICAgICAgICAgIGVkZ2Uuc2V0RW5kUG9pbnQoZW5kcG9pbnQpO1xuXG4gICAgICAgICAgICAgICAgZWRnZS5zdGFydHBvaW50UHJldiA9IG51bGw7XG4gICAgICAgICAgICAgICAgZWRnZS5lbmRwb2ludE5leHQgPSBudWxsO1xuXG4gICAgICAgICAgICAgICAgZWRnZS5wb3NpdGlvblkgPSBVdGlscy5nZXRQb2ludENvb3JkKG5ld1N0YXJ0LCBVdGlscy5uZXh0Q2xvY2t3aXNlRGlyKHN0YXJ0RGlyKSk7XG4gICAgICAgICAgICAgICAgaGxpc3QuaW5zZXJ0KGVkZ2UpO1xuXG4gICAgICAgICAgICAgICAgcG9pbnRzLnNwbGljZSgxLCAyKTtcbiAgICAgICAgICAgICAgICBtb2RpZmllZCA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbW9kaWZpZWQ7XG59O1xuXG4vKipcbiAqIFJlbW92ZSB1bm5lY2Vzc2FyeSBjdXJ2ZXMgaW5zZXJ0ZWQgaW50byB0aGUgcGF0aCBmcm9tIHRoZVxuICogdHJhY2luZyB0aGUgZWRnZXMgb2Ygb3ZlcmxhcHBpbmcgYm94ZXMuIChodWcgY2hpbGRyZW4pXG4gKlxuICogQHBhcmFtIHtBdXRvUm91dGVyUGF0aH0gcGF0aFxuICovXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9zaW1wbGlmeVBhdGhDdXJ2ZXMgPSBmdW5jdGlvbiAocGF0aCkge1xuICAgIC8vIEluY2lkZW50bHksIHRoaXMgd2lsbCBhbHNvIGNvbnRhaW4gdGhlIGZ1bmN0aW9uYWxpdHkgb2Ygc2ltcGxpZnlUcml2aWFsbHlcbiAgICB2YXIgcG9pbnRMaXN0ID0gcGF0aC5nZXRQb2ludExpc3QoKSxcbiAgICAgICAgcDEsXG4gICAgICAgIHAyLFxuICAgICAgICBpID0gMCxcbiAgICAgICAgajtcblxuICAgIC8vIEkgd2lsbCBiZSB0YWtpbmcgdGhlIGZpcnN0IHBvaW50IGFuZCBjaGVja2luZyB0byBzZWUgaWYgaXQgY2FuIGNyZWF0ZSBhIHN0cmFpZ2h0IGxpbmVcbiAgICAvLyB0aGF0IGRvZXMgbm90IFV0aWxzLmludGVyc2VjdCAgYW55IG90aGVyIGJveGVzIG9uIHRoZSBncmFwaCBmcm9tIHRoZSB0ZXN0IHBvaW50IHRvIHRoZSBvdGhlciBwb2ludC5cbiAgICAvLyBUaGUgJ290aGVyIHBvaW50JyB3aWxsIGJlIHRoZSBlbmQgb2YgdGhlIHBhdGggaXRlcmF0aW5nIGJhY2sgdGlsIHRoZSB0d28gcG9pbnRzIGJlZm9yZSB0aGUgXG4gICAgLy8gY3VycmVudC5cbiAgICB3aGlsZSAoaSA8IHBvaW50TGlzdC5sZW5ndGggLSAzKSB7XG4gICAgICAgIHAxID0gcG9pbnRMaXN0W2ldO1xuICAgICAgICBqID0gcG9pbnRMaXN0Lmxlbmd0aDtcblxuICAgICAgICB3aGlsZSAoai0tID4gMCkge1xuICAgICAgICAgICAgcDIgPSBwb2ludExpc3Rbal07XG4gICAgICAgICAgICBpZiAoVXRpbHMuaXNSaWdodEFuZ2xlKFV0aWxzLmdldERpcihwMS5taW51cyhwMikpKSAmJiAhdGhpcy5faXNMaW5lQ2xpcEJveGVzKHAxLCBwMikgfHxcbiAgICAgICAgICAgICAgICBwMS5lcXVhbHMocDIpKSB7XG4gICAgICAgICAgICAgICAgcG9pbnRMaXN0LnNwbGljZShpICsgMSwgaiAtIGkgLSAxKTsgLy8gUmVtb3ZlIGFsbCBwb2ludHMgYmV0d2VlbiBpLCBqXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgKytpO1xuICAgIH1cbn07XG5cbi8qIFRoZSBmb2xsb3dpbmcgc2hhcGUgaW4gYSBwYXRoXG4gKiBfX19fX19fXG4gKiAgICAgICB8ICAgICAgIF9fX1xuICogICAgICAgfCAgICAgIHxcbiAqICAgICAgIHxfX19fX198XG4gKlxuICogd2lsbCBiZSByZXBsYWNlZCB3aXRoIFxuICogX19fX19fX1xuICogICAgICAgfF9fX19fX1xuICpcbiAqIGlmIHBvc3NpYmxlLlxuICovXG4vKipcbiAqIFJlcGxhY2UgNSBwb2ludHMgZm9yIDMgd2hlcmUgcG9zc2libGUuIFRoaXMgd2lsbCByZXBsYWNlICd1Jy1saWtlIHNoYXBlc1xuICogd2l0aCAneicgbGlrZSBzaGFwZXMuXG4gKlxuICogQHBhcmFtIHBhdGhcbiAqIEByZXR1cm4ge3VuZGVmaW5lZH1cbiAqL1xuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fc2ltcGxpZnlQYXRoUG9pbnRzID0gZnVuY3Rpb24gKHBhdGgpIHtcbiAgICBhc3NlcnQocGF0aCAhPT0gbnVsbCwgJ0FSR3JhcGguc2ltcGxpZnlQYXRoUG9pbnRzOiBwYXRoICE9PSBudWxsIEZBSUxFRCcpO1xuICAgIGFzc2VydCghcGF0aC5pc0Nvbm5lY3RlZCgpLCAnQVJHcmFwaC5zaW1wbGlmeVBhdGhQb2ludHM6ICFwYXRoLmlzQ29ubmVjdGVkKCkgRkFJTEVEJyk7XG5cbiAgICB2YXIgcG9pbnRMaXN0ID0gcGF0aC5nZXRQb2ludExpc3QoKTtcbiAgICBhc3NlcnQocG9pbnRMaXN0Lmxlbmd0aCA+PSAyLCAnQVJHcmFwaC5zaW1wbGlmeVBhdGhQb2ludHM6IHBvaW50TGlzdC5sZW5ndGggPj0gMiBGQUlMRUQnKTtcblxuICAgIGlmIChDT05TVEFOVFMuREVCVUcpIHtcbiAgICAgICAgcGF0aC5hc3NlcnRWYWxpZFBvaW50cygpO1xuICAgIH1cblxuICAgIHZhciBwMSxcbiAgICAgICAgcDIsXG4gICAgICAgIHAzLFxuICAgICAgICBwNCxcbiAgICAgICAgcDUsXG5cbiAgICAgICAgcDFwID0gcG9pbnRMaXN0Lmxlbmd0aCxcbiAgICAgICAgcDJwID0gcG9pbnRMaXN0Lmxlbmd0aCxcbiAgICAgICAgcDNwID0gcG9pbnRMaXN0Lmxlbmd0aCxcbiAgICAgICAgcDRwID0gcG9pbnRMaXN0Lmxlbmd0aCxcbiAgICAgICAgcDVwID0gcG9pbnRMaXN0Lmxlbmd0aCxcblxuICAgICAgICBwb3MgPSAwLFxuXG4gICAgICAgIG5wMyxcbiAgICAgICAgZCxcbiAgICAgICAgaDtcblxuICAgIGFzc2VydChwb3MgPCBwb2ludExpc3QubGVuZ3RoLCAnQVJHcmFwaC5zaW1wbGlmeVBhdGhQb2ludHM6IHBvcyA8IHBvaW50TGlzdC5sZW5ndGggRkFJTEVEJyk7XG5cbiAgICBwMXAgPSBwb3M7XG4gICAgcDEgPSBwb2ludExpc3RbcG9zKytdO1xuXG4gICAgd2hpbGUgKHBvcyA8IHBvaW50TGlzdC5sZW5ndGgpIHtcbiAgICAgICAgcDVwID0gcDRwO1xuICAgICAgICBwNHAgPSBwM3A7XG4gICAgICAgIHAzcCA9IHAycDtcbiAgICAgICAgcDJwID0gcDFwO1xuICAgICAgICBwMXAgPSBwb3M7XG5cbiAgICAgICAgcDUgPSBwNDtcbiAgICAgICAgcDQgPSBwMztcbiAgICAgICAgcDMgPSBwMjtcbiAgICAgICAgcDIgPSBwMTtcbiAgICAgICAgcDEgPSBwb2ludExpc3RbcG9zKytdO1xuXG4gICAgICAgIGlmIChwNXAgPCBwb2ludExpc3QubGVuZ3RoKSB7XG4gICAgICAgICAgICBhc3NlcnQocDFwIDwgcG9pbnRMaXN0Lmxlbmd0aCAmJiBwMnAgPCBwb2ludExpc3QubGVuZ3RoICYmIHAzcCA8IHBvaW50TGlzdC5sZW5ndGggJiZcbiAgICAgICAgICAgICAgICBwNHAgPCBwb2ludExpc3QubGVuZ3RoICYmIHA1cCA8IHBvaW50TGlzdC5sZW5ndGgsXG4gICAgICAgICAgICAgICAgJ0FSR3JhcGguc2ltcGxpZnlQYXRoUG9pbnRzOiBwMXAgPCBwb2ludExpc3QubGVuZ3RoICYmIHAycCA8IHBvaW50TGlzdC5sZW5ndGggJiYgJyArXG4gICAgICAgICAgICAgICAgJ3AzcCA8IHBvaW50TGlzdC5sZW5ndGggJiYgcDRwIDwgcG9pbnRMaXN0Lmxlbmd0aCAmJiBwNXAgPCBwb2ludExpc3QubGVuZ3RoIEZBSUxFRCcpO1xuXG4gICAgICAgICAgICBhc3NlcnQoIXAxLmVxdWFscyhwMikgJiYgIXAyLmVxdWFscyhwMykgJiYgIXAzLmVxdWFscyhwNCkgJiYgIXA0LmVxdWFscyhwNSksXG4gICAgICAgICAgICAgICAgJ0FSR3JhcGguc2ltcGxpZnlQYXRoUG9pbnRzOiAhcDEuZXF1YWxzKHAyKSAmJiAhcDIuZXF1YWxzKHAzKSAmJiAhcDMuZXF1YWxzKHA0KSAmJiAnICtcbiAgICAgICAgICAgICAgICAnIXA0LmVxdWFscyhwNSkgRkFJTEVEJyk7XG5cbiAgICAgICAgICAgIGQgPSBVdGlscy5nZXREaXIocDIubWludXMocDEpKTtcbiAgICAgICAgICAgIGFzc2VydChVdGlscy5pc1JpZ2h0QW5nbGUoZCksICdBUkdyYXBoLnNpbXBsaWZ5UGF0aFBvaW50czogVXRpbHMuaXNSaWdodEFuZ2xlIChkKSBGQUlMRUQnKTtcbiAgICAgICAgICAgIGggPSBVdGlscy5pc0hvcml6b250YWwoZCk7XG5cbiAgICAgICAgICAgIG5wMyA9IG5ldyBBclBvaW50KCk7XG4gICAgICAgICAgICBpZiAoaCkge1xuICAgICAgICAgICAgICAgIG5wMy54ID0gVXRpbHMuZ2V0UG9pbnRDb29yZChwNSwgaCk7XG4gICAgICAgICAgICAgICAgbnAzLnkgPSBVdGlscy5nZXRQb2ludENvb3JkKHAxLCAhaCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG5wMy54ID0gVXRpbHMuZ2V0UG9pbnRDb29yZChwMSwgIWgpO1xuICAgICAgICAgICAgICAgIG5wMy55ID0gVXRpbHMuZ2V0UG9pbnRDb29yZChwNSwgaCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5faXNMaW5lQ2xpcEJveGVzKHAyLCBucDMpICYmICF0aGlzLl9pc0xpbmVDbGlwQm94ZXMobnAzLCBwNCkpIHtcbiAgICAgICAgICAgICAgICBwb2ludExpc3Quc3BsaWNlKHAycCwgMSk7XG4gICAgICAgICAgICAgICAgcG9pbnRMaXN0LnNwbGljZShwM3AsIDEpO1xuICAgICAgICAgICAgICAgIHBvaW50TGlzdC5zcGxpY2UocDRwLCAxKTtcblxuICAgICAgICAgICAgICAgIGlmICghbnAzLmVxdWFscyhwMSkgJiYgIW5wMy5lcXVhbHMocDUpKSB7XG4gICAgICAgICAgICAgICAgICAgIHBvaW50TGlzdC5zcGxpY2UocDRwLCAwLCBucDMpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHAxcCA9IHBvaW50TGlzdC5sZW5ndGg7XG4gICAgICAgICAgICAgICAgcDJwID0gcG9pbnRMaXN0Lmxlbmd0aDtcbiAgICAgICAgICAgICAgICBwM3AgPSBwb2ludExpc3QubGVuZ3RoO1xuICAgICAgICAgICAgICAgIHA0cCA9IHBvaW50TGlzdC5sZW5ndGg7XG5cbiAgICAgICAgICAgICAgICBwb3MgPSAwO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKENPTlNUQU5UUy5ERUJVRykge1xuICAgICAgICBwYXRoLmFzc2VydFZhbGlkUG9pbnRzKCk7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fY29ubmVjdEFsbERpc2Nvbm5lY3RlZFBhdGhzID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBpLFxuICAgICAgICBsZW4gPSB0aGlzLnBhdGhzLmxlbmd0aCxcbiAgICAgICAgc3VjY2VzcyA9IGZhbHNlLFxuICAgICAgICBnaXZldXAgPSBmYWxzZSxcbiAgICAgICAgcGF0aDtcblxuICAgIHdoaWxlICghc3VjY2VzcyAmJiAhZ2l2ZXVwKSB7XG4gICAgICAgIHN1Y2Nlc3MgPSB0cnVlO1xuICAgICAgICBpID0gbGVuO1xuICAgICAgICB3aGlsZSAoaS0tICYmIHN1Y2Nlc3MpIHtcbiAgICAgICAgICAgIHBhdGggPSB0aGlzLnBhdGhzW2ldO1xuXG4gICAgICAgICAgICBpZiAoIXBhdGguaXNDb25uZWN0ZWQoKSkge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgPSB0aGlzLl9jb25uZWN0KHBhdGgpO1xuXG4gICAgICAgICAgICAgICAgaWYgKCFzdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFNvbWV0aGluZyBpcyBtZXNzZWQgdXAsIHByb2JhYmx5IGFuIGV4aXN0aW5nIGVkZ2UgY3VzdG9taXphdGlvbiByZXN1bHRzIGluIGEgemVybyBsZW5ndGggZWRnZVxuICAgICAgICAgICAgICAgICAgICAvLyBJbiB0aGF0IGNhc2Ugd2UgdHJ5IHRvIGRlbGV0ZSBhbnkgY3VzdG9taXphdGlvbiBmb3IgdGhpcyBwYXRoIHRvIHJlY292ZXIgZnJvbSB0aGUgcHJvYmxlbVxuICAgICAgICAgICAgICAgICAgICBpZiAocGF0aC5hcmVUaGVyZVBhdGhDdXN0b21pemF0aW9ucygpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwYXRoLnJlbW92ZVBhdGhDdXN0b21pemF0aW9ucygpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgZ2l2ZXVwID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoIXN1Y2Nlc3MgJiYgIWdpdmV1cCkge1xuICAgICAgICAgICAgdGhpcy5fZGlzY29ubmVjdEFsbCgpO1x0Ly8gVGhlcmUgd2FzIGFuIGVycm9yLCBkZWxldGUgaGFsZndheSByZXN1bHRzIHRvIGJlIGFibGUgdG8gc3RhcnQgYSBuZXcgcGFzc1xuICAgICAgICB9XG4gICAgfVxuICAgIHRoaXMuY29tcGxldGVseUNvbm5lY3RlZCA9IHRydWU7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl91cGRhdGVCb3hQb3J0QXZhaWxhYmlsaXR5ID0gZnVuY3Rpb24gKGlucHV0Qm94KSB7XG4gICAgdmFyIGJ1ZmZlcmJveCxcbiAgICAgICAgc2libGluZ3MsXG4gICAgICAgIHNraXBCb3hlcyA9IHt9LFxuICAgICAgICBib3gsXG4gICAgICAgIGlkO1xuXG4gICAgYnVmZmVyYm94ID0gdGhpcy5ib3gyYnVmZmVyQm94W2lucHV0Qm94LmlkXTtcbiAgICBhc3NlcnQoYnVmZmVyYm94LCAnQnVmZmVyYm94IG5vdCBmb3VuZCBmb3IgJyArIGlucHV0Qm94LmlkKTtcbiAgICBzaWJsaW5ncyA9IGJ1ZmZlcmJveC5jaGlsZHJlbjtcbiAgICAvLyBJZ25vcmUgb3ZlcmxhcCBmcm9tIGFuY2VzdG9yIGJveGVzIGluIHRoZSBib3ggdHJlZXNcbiAgICBib3ggPSBpbnB1dEJveDtcbiAgICBkbyB7XG4gICAgICAgIHNraXBCb3hlc1tib3guaWRdID0gdHJ1ZTtcbiAgICAgICAgYm94ID0gYm94LnBhcmVudDtcbiAgICB9IHdoaWxlIChib3gpO1xuXG4gICAgZm9yICh2YXIgaSA9IHNpYmxpbmdzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICBpZCA9IHNpYmxpbmdzW2ldLmlkO1xuICAgICAgICBpZiAoc2tpcEJveGVzW2lkXSkgeyAgLy8gU2tpcCBib3hlcyBvbiB0aGUgYm94IHRyZWVcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlucHV0Qm94LnJlY3QudG91Y2hpbmcoc2libGluZ3NbaV0pKSB7XG4gICAgICAgICAgICBpbnB1dEJveC5hZGp1c3RQb3J0QXZhaWxhYmlsaXR5KHRoaXMuYm94ZXNbc2libGluZ3NbaV0uaWRdKTtcbiAgICAgICAgICAgIHRoaXMuYm94ZXNbc2libGluZ3NbaV0uaWRdLmFkanVzdFBvcnRBdmFpbGFiaWxpdHkoaW5wdXRCb3gpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fYWRkVG9CdWZmZXJCb3hlcyA9IGZ1bmN0aW9uIChpbnB1dEJveCkge1xuICAgIHZhciBib3ggPSB7cmVjdDogbmV3IEFyUmVjdChpbnB1dEJveC5yZWN0KSwgaWQ6IGlucHV0Qm94LmlkfSxcbiAgICAgICAgb3ZlcmxhcEJveGVzSW5kaWNlcyA9IFtdLFxuICAgICAgICBidWZmZXJCb3gsXG4gICAgICAgIGNoaWxkcmVuID0gW10sXG4gICAgICAgIHBhcmVudEJveCxcbiAgICAgICAgaWRzID0gW2lucHV0Qm94LmlkXSxcbiAgICAgICAgY2hpbGQsXG4gICAgICAgIGksXG4gICAgICAgIGo7XG5cbiAgICBib3gucmVjdC5pbmZsYXRlUmVjdChDT05TVEFOVFMuQlVGRkVSKTtcbiAgICBhc3NlcnQoIXRoaXMuYm94MmJ1ZmZlckJveFtpbnB1dEJveC5pZF0sXG4gICAgICAgICdDYW5cXCd0IGFkZCBib3ggdG8gMiBidWZmZXJib3hlcycpO1xuXG4gICAgLy8gRm9yIGV2ZXJ5IGJ1ZmZlciBib3ggdG91Y2hpbmcgdGhlIGlucHV0IGJveFxuICAgIC8vIFJlY29yZCB0aGUgYnVmZmVyIGJveGVzIHdpdGggY2hpbGRyZW4gdG91Y2hpbmcgXG4gICAgLy8gdGhlIGlucHV0IGJveFxuICAgIGZvciAoaSA9IHRoaXMuYnVmZmVyQm94ZXMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIGlmICghYm94LnJlY3QudG91Y2hpbmcodGhpcy5idWZmZXJCb3hlc1tpXS5ib3gpKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGogPSB0aGlzLmJ1ZmZlckJveGVzW2ldLmNoaWxkcmVuLmxlbmd0aDtcbiAgICAgICAgd2hpbGUgKGotLSkge1xuICAgICAgICAgICAgY2hpbGQgPSB0aGlzLmJ1ZmZlckJveGVzW2ldLmNoaWxkcmVuW2pdO1xuICAgICAgICAgICAgaWYgKGJveC5yZWN0LnRvdWNoaW5nKGNoaWxkKSkge1xuICAgICAgICAgICAgICAgIGlucHV0Qm94LmFkanVzdFBvcnRBdmFpbGFiaWxpdHkodGhpcy5ib3hlc1tjaGlsZC5pZF0pO1xuICAgICAgICAgICAgICAgIHRoaXMuYm94ZXNbY2hpbGQuaWRdLmFkanVzdFBvcnRBdmFpbGFiaWxpdHkoaW5wdXRCb3gpO1xuXG4gICAgICAgICAgICAgICAgaWYgKG92ZXJsYXBCb3hlc0luZGljZXMuaW5kZXhPZihpKSA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgb3ZlcmxhcEJveGVzSW5kaWNlcy5wdXNoKGkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcGFyZW50Qm94ID0gbmV3IEFyUmVjdChib3gucmVjdCk7XG4gICAgLy8gSWYgb3ZlcmxhcHBlZCBvdGhlciBib3hlcywgY3JlYXRlIHRoZSBuZXcgYnVmZmVyYm94IHBhcmVudCByZWN0XG4gICAgaWYgKG92ZXJsYXBCb3hlc0luZGljZXMubGVuZ3RoICE9PSAwKSB7XG5cbiAgICAgICAgZm9yIChpID0gMDsgaSA8IG92ZXJsYXBCb3hlc0luZGljZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFzc2VydChvdmVybGFwQm94ZXNJbmRpY2VzW2ldIDwgdGhpcy5idWZmZXJCb3hlcy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgJ0FyR3JhcGguYWRkVG9CdWZmZXJCb3hlczogb3ZlcmxhcEJveGVzIGluZGV4IG91dCBvZiBib3VuZHMuICgnICtcbiAgICAgICAgICAgICAgICBvdmVybGFwQm94ZXNJbmRpY2VzW2ldICsgJyA8ICcgKyB0aGlzLmJ1ZmZlckJveGVzLmxlbmd0aCArICcpJyk7XG5cbiAgICAgICAgICAgIGJ1ZmZlckJveCA9IHRoaXMuYnVmZmVyQm94ZXMuc3BsaWNlKG92ZXJsYXBCb3hlc0luZGljZXNbaV0sIDEpWzBdO1xuXG4gICAgICAgICAgICBmb3IgKGogPSBidWZmZXJCb3guY2hpbGRyZW4ubGVuZ3RoOyBqLS07KSB7XG4gICAgICAgICAgICAgICAgY2hpbGRyZW4ucHVzaChidWZmZXJCb3guY2hpbGRyZW5bal0pO1xuICAgICAgICAgICAgICAgIGlkcy5wdXNoKGJ1ZmZlckJveC5jaGlsZHJlbltqXS5pZCk7ICAvLyBTdG9yZSB0aGUgaWRzIG9mIHRoZSBjaGlsZHJlbiB0aGF0IG5lZWQgdG8gYmUgYWRqdXN0ZWRcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcGFyZW50Qm94LnVuaW9uQXNzaWduKGJ1ZmZlckJveC5ib3gpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYm94LnJlY3QuaWQgPSBpbnB1dEJveC5pZDtcbiAgICBjaGlsZHJlbi5wdXNoKGJveC5yZWN0KTtcblxuICAgIHRoaXMuYnVmZmVyQm94ZXMucHVzaCh7Ym94OiBwYXJlbnRCb3gsIGNoaWxkcmVuOiBjaGlsZHJlbn0pO1xuXG4gICAgZm9yIChpID0gaWRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICB0aGlzLmJveDJidWZmZXJCb3hbaWRzW2ldXSA9IHRoaXMuYnVmZmVyQm94ZXNbdGhpcy5idWZmZXJCb3hlcy5sZW5ndGggLSAxXTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9yZW1vdmVGcm9tQnVmZmVyQm94ZXMgPSBmdW5jdGlvbiAoYm94KSB7XG4gICAgLy8gR2V0IHRoZSBjaGlsZHJlbiBvZiB0aGUgcGFyZW50Qm94IChub3QgaW5jbHVkaW5nIHRoZSBib3ggdG8gcmVtb3ZlKVxuICAgIC8vIENyZWF0ZSBidWZmZXJib3hlcyBmcm9tIHRoZXNlIGNoaWxkcmVuXG4gICAgdmFyIGJ1ZmZlckJveCA9IHRoaXMuYm94MmJ1ZmZlckJveFtib3guaWRdLFxuICAgICAgICBpID0gdGhpcy5idWZmZXJCb3hlcy5pbmRleE9mKGJ1ZmZlckJveCksXG4gICAgICAgIGNoaWxkcmVuID0gYnVmZmVyQm94LmNoaWxkcmVuLFxuICAgICAgICBncm91cHMgPSBbXSxcbiAgICAgICAgYWRkID0gZmFsc2UsXG4gICAgICAgIHBhcmVudEJveCxcbiAgICAgICAgY2hpbGQsXG4gICAgICAgIGdyb3VwLFxuICAgICAgICBpZHMsXG4gICAgICAgIGlkLFxuICAgICAgICBqLFxuICAgICAgICBnO1xuXG4gICAgYXNzZXJ0KGkgIT09IC0xLCAnQVJHcmFwaC5yZW1vdmVGcm9tQnVmZmVyQm94ZXM6IENhblxcJ3QgZmluZCB0aGUgY29ycmVjdCBidWZmZXJib3guJyk7XG5cbiAgICAvLyBSZW1vdmUgcmVjb3JkIG9mIHJlbW92ZWQgYm94XG4gICAgdGhpcy5idWZmZXJCb3hlcy5zcGxpY2UoaSwgMSk7XG4gICAgdGhpcy5ib3gyYnVmZmVyQm94W2JveC5pZF0gPSB1bmRlZmluZWQ7XG5cbiAgICAvL0NyZWF0ZSBncm91cHMgb2Ygb3ZlcmxhcCBmcm9tIGNoaWxkcmVuXG4gICAgaSA9IGNoaWxkcmVuLmxlbmd0aDtcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgIGcgPSBncm91cHMubGVuZ3RoO1xuICAgICAgICBjaGlsZCA9IGNoaWxkcmVuW2ldO1xuICAgICAgICBncm91cCA9IFtjaGlsZF07XG4gICAgICAgIGFkZCA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuYm94ZXNbY2hpbGQuaWRdLnJlc2V0UG9ydEF2YWlsYWJpbGl0eSgpOyAgLy8gUmVzZXQgYm94J3MgcG9ydHMgYXZhaWxhYmxlQXJlYXNcblxuICAgICAgICBpZiAoY2hpbGQuaWQgPT09IGJveC5pZCkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICB3aGlsZSAoZy0tKSB7XG4gICAgICAgICAgICBqID0gZ3JvdXBzW2ddLmxlbmd0aDtcblxuICAgICAgICAgICAgd2hpbGUgKGotLSkge1xuICAgICAgICAgICAgICAgIGlmIChncm91cHNbZ11bal0udG91Y2hpbmcoY2hpbGQpKSB7XG4gICAgICAgICAgICAgICAgICAgIGlkID0gZ3JvdXBzW2ddW2pdLmlkO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmJveGVzW2NoaWxkLmlkXS5hZGp1c3RQb3J0QXZhaWxhYmlsaXR5KHRoaXMuYm94ZXNbaWRdKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5ib3hlc1tpZF0uYWRqdXN0UG9ydEF2YWlsYWJpbGl0eSh0aGlzLmJveGVzW2NoaWxkLmlkXSk7XG4gICAgICAgICAgICAgICAgICAgIGFkZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoYWRkKSB7XG4gICAgICAgICAgICAgICAgLy8gZ3JvdXAgd2lsbCBhY2N1bXVsYXRlIGFsbCB0aGluZ3Mgb3ZlcmxhcHBpbmcgdGhlIGNoaWxkXG4gICAgICAgICAgICAgICAgZ3JvdXAgPSBncm91cC5jb25jYXQoZ3JvdXBzLnNwbGljZShnLCAxKVswXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBncm91cHMucHVzaChncm91cCk7ICAvLyBBZGQgZ3JvdXAgdG8gZ3JvdXBzXG4gICAgfVxuXG4gICAgaSA9IGdyb3Vwcy5sZW5ndGg7XG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgICBqID0gZ3JvdXBzW2ldLmxlbmd0aDtcbiAgICAgICAgcGFyZW50Qm94ID0gbmV3IEFyUmVjdChncm91cHNbaV1bMF0pO1xuICAgICAgICBpZHMgPSBbXTtcblxuICAgICAgICB3aGlsZSAoai0tKSB7XG4gICAgICAgICAgICBwYXJlbnRCb3gudW5pb25Bc3NpZ24oZ3JvdXBzW2ldW2pdKTtcbiAgICAgICAgICAgIGlkcy5wdXNoKGdyb3Vwc1tpXVtqXS5pZCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmJ1ZmZlckJveGVzLnB1c2goe2JveDogcGFyZW50Qm94LCBjaGlsZHJlbjogZ3JvdXBzW2ldfSk7XG5cbiAgICAgICAgaiA9IGlkcy5sZW5ndGg7XG4gICAgICAgIHdoaWxlIChqLS0pIHtcbiAgICAgICAgICAgIHRoaXMuYm94MmJ1ZmZlckJveFtpZHNbal1dID0gdGhpcy5idWZmZXJCb3hlc1t0aGlzLmJ1ZmZlckJveGVzLmxlbmd0aCAtIDFdO1xuICAgICAgICB9XG4gICAgfVxuXG59O1xuXG4vL1B1YmxpYyBGdW5jdGlvbnNcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5zZXRCdWZmZXIgPSBmdW5jdGlvbiAobmV3QnVmZmVyKSB7XG4gICAgQ09OU1RBTlRTLkJVRkZFUiA9IG5ld0J1ZmZlcjtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuY2FsY3VsYXRlU2VsZlBvaW50cyA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLnNlbGZQb2ludHMgPSBbXTtcbiAgICB0aGlzLnNlbGZQb2ludHMucHVzaChuZXcgQXJQb2ludChDT05TVEFOVFMuRURfTUlOQ09PUkQsIENPTlNUQU5UUy5FRF9NSU5DT09SRCkpO1xuICAgIHRoaXMuc2VsZlBvaW50cy5wdXNoKG5ldyBBclBvaW50KENPTlNUQU5UUy5FRF9NQVhDT09SRCwgQ09OU1RBTlRTLkVEX01JTkNPT1JEKSk7XG4gICAgdGhpcy5zZWxmUG9pbnRzLnB1c2gobmV3IEFyUG9pbnQoQ09OU1RBTlRTLkVEX01BWENPT1JELCBDT05TVEFOVFMuRURfTUFYQ09PUkQpKTtcbiAgICB0aGlzLnNlbGZQb2ludHMucHVzaChuZXcgQXJQb2ludChDT05TVEFOVFMuRURfTUlOQ09PUkQsIENPTlNUQU5UUy5FRF9NQVhDT09SRCkpO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5jcmVhdGVCb3ggPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGJveCA9IG5ldyBBdXRvUm91dGVyQm94KCk7XG4gICAgYXNzZXJ0KGJveCAhPT0gbnVsbCwgJ0FSR3JhcGguY3JlYXRlQm94OiBib3ggIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICByZXR1cm4gYm94O1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5hZGRCb3ggPSBmdW5jdGlvbiAoYm94KSB7XG4gICAgYXNzZXJ0KGJveCAhPT0gbnVsbCxcbiAgICAgICAgJ0FSR3JhcGguYWRkQm94OiBib3ggIT09IG51bGwgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KGJveCBpbnN0YW5jZW9mIEF1dG9Sb3V0ZXJCb3gsXG4gICAgICAgICdBUkdyYXBoLmFkZEJveDogYm94IGluc3RhbmNlb2YgQXV0b1JvdXRlckJveCBGQUlMRUQnKTtcblxuICAgIHZhciByZWN0ID0gYm94LnJlY3Q7XG5cbiAgICB0aGlzLl9kaXNjb25uZWN0UGF0aHNDbGlwcGluZyhyZWN0KTtcblxuICAgIGJveC5vd25lciA9IHRoaXM7XG4gICAgdmFyIGJveElkID0gKENPVU5URVIrKykudG9TdHJpbmcoKTtcbiAgICB3aGlsZSAoYm94SWQubGVuZ3RoIDwgNikge1xuICAgICAgICBib3hJZCA9ICcwJyArIGJveElkO1xuICAgIH1cbiAgICBib3hJZCA9ICdCT1hfJyArIGJveElkO1xuICAgIGJveC5pZCA9IGJveElkO1xuXG4gICAgdGhpcy5ib3hlc1tib3hJZF0gPSBib3g7XG5cbiAgICB0aGlzLl9hZGRCb3hBbmRQb3J0RWRnZXMoYm94KTtcblxuICAgIC8vIGFkZCBjaGlsZHJlbiBvZiB0aGUgYm94XG4gICAgdmFyIGNoaWxkcmVuID0gYm94LmNoaWxkQm94ZXMsXG4gICAgICAgIGkgPSBjaGlsZHJlbi5sZW5ndGg7XG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgICB0aGlzLmFkZEJveChjaGlsZHJlbltpXSk7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5kZWxldGVCb3ggPSBmdW5jdGlvbiAoYm94KSB7XG4gICAgYXNzZXJ0KGJveCAhPT0gbnVsbCwgJ0FSR3JhcGguZGVsZXRlQm94OiBib3ggIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICBpZiAoYm94Lmhhc093bmVyKCkpIHtcbiAgICAgICAgdmFyIHBhcmVudCA9IGJveC5wYXJlbnQsXG4gICAgICAgICAgICBjaGlsZHJlbiA9IGJveC5jaGlsZEJveGVzLFxuICAgICAgICAgICAgaSA9IGNoaWxkcmVuLmxlbmd0aDtcblxuICAgICAgICAvLyBub3RpZnkgdGhlIHBhcmVudCBvZiB0aGUgZGVsZXRpb25cbiAgICAgICAgaWYgKHBhcmVudCkge1xuICAgICAgICAgICAgcGFyZW50LnJlbW92ZUNoaWxkKGJveCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyByZW1vdmUgY2hpbGRyZW5cbiAgICAgICAgd2hpbGUgKGktLSkge1xuICAgICAgICAgICAgdGhpcy5kZWxldGVCb3goY2hpbGRyZW5baV0pO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fZGVsZXRlQm94QW5kUG9ydEVkZ2VzKGJveCk7XG4gICAgICAgIGJveC5vd25lciA9IG51bGw7XG4gICAgICAgIGFzc2VydCh0aGlzLmJveGVzW2JveC5pZF0gIT09IHVuZGVmaW5lZCwgJ0FSR3JhcGgucmVtb3ZlOiBCb3ggZG9lcyBub3QgZXhpc3QnKTtcblxuICAgICAgICBkZWxldGUgdGhpcy5ib3hlc1tib3guaWRdO1xuICAgIH1cblxuICAgIGJveC5kZXN0cm95KCk7XG4gICAgYm94ID0gbnVsbDtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuc2hpZnRCb3hCeSA9IGZ1bmN0aW9uIChib3gsIG9mZnNldCkge1xuICAgIGFzc2VydChib3ggIT09IG51bGwsICdBUkdyYXBoLnNoaWZ0Qm94Qnk6IGJveCAhPT0gbnVsbCBGQUlMRUQnKTtcbiAgICBhc3NlcnQoISF0aGlzLmJveGVzW2JveC5pZF0sICdBUkdyYXBoLnNoaWZ0Qm94Qnk6IEJveCBkb2VzIG5vdCBleGlzdCEnKTtcblxuICAgIHZhciByZWN0ID0gdGhpcy5ib3gyYnVmZmVyQm94W2JveC5pZF0uYm94LFxuICAgICAgICBjaGlsZHJlbiA9IGJveC5jaGlsZEJveGVzO1xuXG4gICAgdGhpcy5fZGlzY29ubmVjdFBhdGhzQ2xpcHBpbmcocmVjdCk7IC8vIHJlZHJhdyBhbGwgcGF0aHMgY2xpcHBpbmcgcGFyZW50IGJveC5cbiAgICB0aGlzLl9kaXNjb25uZWN0UGF0aHNGcm9tKGJveCk7XG5cbiAgICB0aGlzLl9kZWxldGVCb3hBbmRQb3J0RWRnZXMoYm94KTtcblxuICAgIGJveC5zaGlmdEJ5KG9mZnNldCk7XG4gICAgdGhpcy5fYWRkQm94QW5kUG9ydEVkZ2VzKGJveCk7XG5cbiAgICByZWN0ID0gYm94LnJlY3Q7XG4gICAgdGhpcy5fZGlzY29ubmVjdFBhdGhzQ2xpcHBpbmcocmVjdCk7XG5cbiAgICBmb3IgKHZhciBpID0gY2hpbGRyZW4ubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHRoaXMuc2hpZnRCb3hCeShjaGlsZHJlbltpXSwgb2Zmc2V0KTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLnNldEJveFJlY3QgPSBmdW5jdGlvbiAoYm94LCByZWN0KSB7XG4gICAgaWYgKGJveCA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5fZGVsZXRlQm94QW5kUG9ydEVkZ2VzKGJveCk7XG4gICAgYm94LnNldFJlY3QocmVjdCk7XG4gICAgdGhpcy5fYWRkQm94QW5kUG9ydEVkZ2VzKGJveCk7XG5cbiAgICB0aGlzLl9kaXNjb25uZWN0UGF0aHNDbGlwcGluZyhyZWN0KTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUucm91dGVTeW5jID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBzdGF0ZSA9IHtmaW5pc2hlZDogZmFsc2V9O1xuXG4gICAgdGhpcy5fY29ubmVjdEFsbERpc2Nvbm5lY3RlZFBhdGhzKCk7XG5cbiAgICB3aGlsZSAoIXN0YXRlLmZpbmlzaGVkKSB7XG4gICAgICAgIHN0YXRlID0gdGhpcy5fb3B0aW1pemUoc3RhdGUpO1xuICAgIH1cblxufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5yb3V0ZUFzeW5jID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXMsXG4gICAgICAgIHVwZGF0ZUZuID0gb3B0aW9ucy51cGRhdGUgfHwgVXRpbHMubm9wLFxuICAgICAgICBmaXJzdEZuID0gb3B0aW9ucy5maXJzdCB8fCBVdGlscy5ub3AsXG4gICAgICAgIGNhbGxiYWNrRm4gPSBvcHRpb25zLmNhbGxiYWNrIHx8IFV0aWxzLm5vcCxcbiAgICAgICAgdGltZSA9IG9wdGlvbnMudGltZSB8fCA1LFxuICAgICAgICBvcHRpbWl6ZUZuID0gZnVuY3Rpb24gKHN0YXRlKSB7XG4gICAgICAgICAgICBfbG9nZ2VyLmluZm8oJ0FzeW5jIG9wdGltaXphdGlvbiBjeWNsZSBzdGFydGVkJyk7XG5cbiAgICAgICAgICAgIC8vIElmIGEgcGF0aCBoYXMgYmVlbiBkaXNjb25uZWN0ZWQsIHN0YXJ0IHRoZSByb3V0aW5nIG92ZXJcbiAgICAgICAgICAgIGlmICghc2VsZi5jb21wbGV0ZWx5Q29ubmVjdGVkKSB7XG4gICAgICAgICAgICAgICAgX2xvZ2dlci5pbmZvKCdBc3luYyBvcHRpbWl6YXRpb24gaW50ZXJydXB0ZWQnKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gc2V0VGltZW91dChzdGFydFJvdXRpbmcsIHRpbWUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB1cGRhdGVGbihzZWxmLnBhdGhzKTtcbiAgICAgICAgICAgIGlmIChzdGF0ZS5maW5pc2hlZCkge1xuICAgICAgICAgICAgICAgIF9sb2dnZXIuaW5mbygnQXN5bmMgcm91dGluZyBmaW5pc2hlZCcpO1xuICAgICAgICAgICAgICAgIHJldHVybiBjYWxsYmFja0ZuKHNlbGYucGF0aHMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzdGF0ZSA9IHNlbGYuX29wdGltaXplKHN0YXRlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gc2V0VGltZW91dChvcHRpbWl6ZUZuLCB0aW1lLCBzdGF0ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHN0YXJ0Um91dGluZyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIF9sb2dnZXIuaW5mbygnQXN5bmMgcm91dGluZyBzdGFydGVkJyk7XG4gICAgICAgICAgICB2YXIgc3RhdGUgPSB7ZmluaXNoZWQ6IGZhbHNlfTtcbiAgICAgICAgICAgIHNlbGYuX2Nvbm5lY3RBbGxEaXNjb25uZWN0ZWRQYXRocygpO1xuXG4gICAgICAgICAgICAvLyBTdGFydCB0aGUgb3B0aW1pemF0aW9uXG4gICAgICAgICAgICBzZXRUaW1lb3V0KG9wdGltaXplRm4sIHRpbWUsIHN0YXRlKTtcbiAgICAgICAgfTtcblxuICAgIF9sb2dnZXIuaW5mbygnQXN5bmMgcm91dGluZyB0cmlnZ2VyZWQnKTtcbiAgICAvLyBDb25uZWN0IGFsbCBkaXNjb25uZWN0ZWQgcGF0aHMgd2l0aCBhIHN0cmFpZ2h0IGxpbmVcbiAgICB2YXIgZGlzY29ubmVjdGVkID0gdGhpcy5fcXVpY2tDb25uZWN0RGlzY29ubmVjdGVkUGF0aHMoKTtcbiAgICBmaXJzdEZuKGRpc2Nvbm5lY3RlZCk7XG5cbiAgICB0aGlzLl9kaXNjb25uZWN0VGVtcFBhdGhzKGRpc2Nvbm5lY3RlZCk7XG5cbiAgICBzZXRUaW1lb3V0KHN0YXJ0Um91dGluZywgdGltZSk7XG59O1xuXG4vKipcbiAqIENvbm5lY3QgYWxsIGRpc2Nvbm5lY3RlZCBwYXRocyBpbiBhIHF1aWNrIHdheSB3aGlsZSBhIGJldHRlciBsYXlvdXQgaXNcbiAqIGJlaW5nIGNhbGN1bGF0ZWQuXG4gKlxuICogQHJldHVybiB7QXJyYXk8UGF0aD59IGRpc2Nvbm5lY3RlZCBwYXRoc1xuICovXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9xdWlja0Nvbm5lY3REaXNjb25uZWN0ZWRQYXRocyA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgcGF0aCxcbiAgICAgICAgZGlzY29ubmVjdGVkID0gW107XG4gICAgZm9yICh2YXIgaSA9IHRoaXMucGF0aHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHBhdGggPSB0aGlzLnBhdGhzW2ldO1xuICAgICAgICBpZiAoIXBhdGguaXNDb25uZWN0ZWQoKSkge1xuICAgICAgICAgICAgcGF0aC5jYWxjdWxhdGVTdGFydEVuZFBvcnRzKCk7XG4gICAgICAgICAgICBwYXRoLnBvaW50cyA9IG5ldyBBclBvaW50TGlzdFBhdGgocGF0aC5zdGFydHBvaW50LCBwYXRoLmVuZHBvaW50KTtcbiAgICAgICAgICAgIGRpc2Nvbm5lY3RlZC5wdXNoKHBhdGgpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBkaXNjb25uZWN0ZWQ7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9kaXNjb25uZWN0VGVtcFBhdGhzID0gZnVuY3Rpb24gKHBhdGhzKSB7XG4gICAgZm9yICh2YXIgaSA9IHBhdGhzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICBwYXRoc1tpXS5wb2ludHMgPSBuZXcgQXJQb2ludExpc3RQYXRoKCk7XG4gICAgfVxufTtcblxuLyoqXG4gKiBQZXJmb3JtcyBvbmUgc2V0IG9mIG9wdGltaXphdGlvbnMuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IGNvdW50IFRoaXMgc3RvcmVzIHRoZSBtYXggbnVtYmVyIG9mIG9wdGltaXphdGlvbnMgYWxsb3dlZFxuICogQHBhcmFtIHtOdW1iZXJ9IGxhc3QgVGhpcyBzdG9yZXMgdGhlIGxhc3Qgb3B0aW1pemF0aW9uIHR5cGUgbWFkZVxuICpcbiAqIEByZXR1cm4ge09iamVjdH0gQ3VycmVudCBjb3VudCwgbGFzdCB2YWx1ZXNcbiAqL1xuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fb3B0aW1pemUgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgIHZhciBtYXhPcGVyYXRpb25zID0gb3B0aW9ucy5tYXhPcGVyYXRpb25zIHx8IDEwMCxcbiAgICAgICAgbGFzdCA9IG9wdGlvbnMubGFzdCB8fCAwLFxuICAgICAgICBkbSA9IG9wdGlvbnMuZG0gfHwgMTAsXHRcdC8vIG1heCAjIG9mIGRpc3RyaWJ1dGlvbiBvcFxuICAgICAgICBkID0gb3B0aW9ucy5kIHx8IDAsXG4gICAgICAgIGdldFN0YXRlID0gZnVuY3Rpb24gKGZpbmlzaGVkKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGZpbmlzaGVkOiBmaW5pc2hlZCB8fCAhbWF4T3BlcmF0aW9ucyxcbiAgICAgICAgICAgICAgICBtYXhPcGVyYXRpb25zOiBtYXhPcGVyYXRpb25zLFxuICAgICAgICAgICAgICAgIGxhc3Q6IGxhc3QsXG4gICAgICAgICAgICAgICAgZG06IGRtLFxuICAgICAgICAgICAgICAgIGQ6IGRcbiAgICAgICAgICAgIH07XG4gICAgICAgIH07XG5cbiAgICBpZiAobWF4T3BlcmF0aW9ucyA+IDApIHtcblxuICAgICAgICBpZiAobGFzdCA9PT0gMSkge1xuICAgICAgICAgICAgcmV0dXJuIGdldFN0YXRlKHRydWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgbWF4T3BlcmF0aW9ucy0tO1xuICAgICAgICBpZiAodGhpcy5fc2ltcGxpZnlQYXRocygpKSB7XG4gICAgICAgICAgICBsYXN0ID0gMTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChtYXhPcGVyYXRpb25zID4gMCkge1xuICAgICAgICBpZiAobGFzdCA9PT0gMikge1xuICAgICAgICAgICAgcmV0dXJuIGdldFN0YXRlKHRydWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgbWF4T3BlcmF0aW9ucy0tO1xuICAgICAgICBpZiAodGhpcy5ob3Jpem9udGFsLmJsb2NrU2NhbkJhY2t3YXJkKCkpIHtcblxuICAgICAgICAgICAgZG8ge1xuICAgICAgICAgICAgICAgIG1heE9wZXJhdGlvbnMtLTtcbiAgICAgICAgICAgIH0gd2hpbGUgKG1heE9wZXJhdGlvbnMgPiAwICYmIHRoaXMuaG9yaXpvbnRhbC5ibG9ja1NjYW5CYWNrd2FyZCgpKTtcblxuICAgICAgICAgICAgaWYgKGxhc3QgPCAyIHx8IGxhc3QgPiA1KSB7XG4gICAgICAgICAgICAgICAgZCA9IDA7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCsrZCA+PSBkbSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBnZXRTdGF0ZSh0cnVlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGFzdCA9IDI7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAobWF4T3BlcmF0aW9ucyA+IDApIHtcbiAgICAgICAgaWYgKGxhc3QgPT09IDMpIHtcbiAgICAgICAgICAgIHJldHVybiBnZXRTdGF0ZSh0cnVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIG1heE9wZXJhdGlvbnMtLTtcbiAgICAgICAgaWYgKHRoaXMuaG9yaXpvbnRhbC5ibG9ja1NjYW5Gb3J3YXJkKCkpIHtcblxuICAgICAgICAgICAgZG8ge1xuICAgICAgICAgICAgICAgIG1heE9wZXJhdGlvbnMtLTtcbiAgICAgICAgICAgIH0gd2hpbGUgKG1heE9wZXJhdGlvbnMgPiAwICYmIHRoaXMuaG9yaXpvbnRhbC5ibG9ja1NjYW5Gb3J3YXJkKCkpO1xuXG4gICAgICAgICAgICBpZiAobGFzdCA8IDIgfHwgbGFzdCA+IDUpIHtcbiAgICAgICAgICAgICAgICBkID0gMDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoKytkID49IGRtKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGdldFN0YXRlKHRydWUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsYXN0ID0gMztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChtYXhPcGVyYXRpb25zID4gMCkge1xuICAgICAgICBpZiAobGFzdCA9PT0gNCkge1xuICAgICAgICAgICAgcmV0dXJuIGdldFN0YXRlKHRydWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgbWF4T3BlcmF0aW9ucy0tO1xuICAgICAgICBpZiAodGhpcy52ZXJ0aWNhbC5ibG9ja1NjYW5CYWNrd2FyZCgpKSB7XG4gICAgICAgICAgICBkbyB7XG4gICAgICAgICAgICAgICAgbWF4T3BlcmF0aW9ucy0tO1xuICAgICAgICAgICAgfSB3aGlsZSAobWF4T3BlcmF0aW9ucyA+IDAgJiYgdGhpcy52ZXJ0aWNhbC5ibG9ja1NjYW5CYWNrd2FyZCgpKTtcblxuICAgICAgICAgICAgaWYgKGxhc3QgPCAyIHx8IGxhc3QgPiA1KSB7XG4gICAgICAgICAgICAgICAgZCA9IDA7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCsrZCA+PSBkbSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBnZXRTdGF0ZSh0cnVlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGFzdCA9IDQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAobWF4T3BlcmF0aW9ucyA+IDApIHtcbiAgICAgICAgaWYgKGxhc3QgPT09IDUpIHtcbiAgICAgICAgICAgIHJldHVybiBnZXRTdGF0ZSh0cnVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIG1heE9wZXJhdGlvbnMtLTtcbiAgICAgICAgaWYgKHRoaXMudmVydGljYWwuYmxvY2tTY2FuRm9yd2FyZCgpKSB7XG5cbiAgICAgICAgICAgIGRvIHtcbiAgICAgICAgICAgICAgICBtYXhPcGVyYXRpb25zLS07XG4gICAgICAgICAgICB9IHdoaWxlIChtYXhPcGVyYXRpb25zID4gMCAmJiB0aGlzLnZlcnRpY2FsLmJsb2NrU2NhbkZvcndhcmQoKSk7XG5cbiAgICAgICAgICAgIGlmIChsYXN0IDwgMiB8fCBsYXN0ID4gNSkge1xuICAgICAgICAgICAgICAgIGQgPSAwO1xuICAgICAgICAgICAgfSBlbHNlIGlmICgrK2QgPj0gZG0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZ2V0U3RhdGUodHJ1ZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxhc3QgPSA1O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKG1heE9wZXJhdGlvbnMgPiAwKSB7XG4gICAgICAgIGlmIChsYXN0ID09PSA2KSB7XG4gICAgICAgICAgICByZXR1cm4gZ2V0U3RhdGUodHJ1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICBtYXhPcGVyYXRpb25zLS07XG4gICAgICAgIGlmICh0aGlzLmhvcml6b250YWwuYmxvY2tTd2l0Y2hXcm9uZ3MoKSkge1xuICAgICAgICAgICAgbGFzdCA9IDY7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAobWF4T3BlcmF0aW9ucyA+IDApIHtcbiAgICAgICAgaWYgKGxhc3QgPT09IDcpIHtcbiAgICAgICAgICAgIHJldHVybiBnZXRTdGF0ZSh0cnVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIG1heE9wZXJhdGlvbnMtLTtcbiAgICAgICAgaWYgKHRoaXMudmVydGljYWwuYmxvY2tTd2l0Y2hXcm9uZ3MoKSkge1xuICAgICAgICAgICAgbGFzdCA9IDc7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAobGFzdCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gZ2V0U3RhdGUodHJ1ZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGdldFN0YXRlKGZhbHNlKTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuZGVsZXRlUGF0aCA9IGZ1bmN0aW9uIChwYXRoKSB7XG4gICAgYXNzZXJ0KHBhdGggIT09IG51bGwsICdBUkdyYXBoLmRlbGV0ZVBhdGg6IHBhdGggIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICBpZiAocGF0aC5oYXNPd25lcigpKSB7XG4gICAgICAgIGFzc2VydChwYXRoLm93bmVyID09PSB0aGlzLCAnQVJHcmFwaC5kZWxldGVQYXRoOiBwYXRoLm93bmVyID09PSB0aGlzIEZBSUxFRCcpO1xuXG4gICAgICAgIHRoaXMuZGVsZXRlRWRnZXMocGF0aCk7XG4gICAgICAgIHBhdGgub3duZXIgPSBudWxsO1xuICAgICAgICB2YXIgaW5kZXggPSB0aGlzLnBhdGhzLmluZGV4T2YocGF0aCk7XG5cbiAgICAgICAgYXNzZXJ0KGluZGV4ID4gLTEsICdBUkdyYXBoLnJlbW92ZTogUGF0aCBkb2VzIG5vdCBleGlzdCcpO1xuICAgICAgICB0aGlzLnBhdGhzLnNwbGljZShpbmRleCwgMSk7XG4gICAgfVxuXG4gICAgcGF0aC5kZXN0cm95KCk7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24gKGFkZEJhY2tTZWxmRWRnZXMpIHtcbiAgICB0aGlzLl9kZWxldGVBbGxQYXRocygpO1xuICAgIHRoaXMuX2RlbGV0ZUFsbEJveGVzKCk7XG4gICAgdGhpcy5fZGVsZXRlQWxsRWRnZXMoKTtcbiAgICBpZiAoYWRkQmFja1NlbGZFZGdlcykge1xuICAgICAgICB0aGlzLl9hZGRTZWxmRWRnZXMoKTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLmFkZFBhdGggPSBmdW5jdGlvbiAoaXNBdXRvUm91dGVkLCBzdGFydHBvcnRzLCBlbmRwb3J0cykge1xuICAgIHZhciBwYXRoID0gbmV3IEF1dG9Sb3V0ZXJQYXRoKCk7XG5cbiAgICBwYXRoLnNldEF1dG9Sb3V0aW5nKGlzQXV0b1JvdXRlZCk7XG4gICAgcGF0aC5zZXRTdGFydEVuZFBvcnRzKHN0YXJ0cG9ydHMsIGVuZHBvcnRzKTtcbiAgICB0aGlzLl9hZGQocGF0aCk7XG5cbiAgICByZXR1cm4gcGF0aDtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuaXNFZGdlRml4ZWQgPSBmdW5jdGlvbiAocGF0aCwgc3RhcnRwb2ludCwgZW5kcG9pbnQpIHtcbiAgICB2YXIgZCA9IFV0aWxzLmdldERpcihlbmRwb2ludC5taW51cyhzdGFydHBvaW50KSksXG4gICAgICAgIGggPSBVdGlscy5pc0hvcml6b250YWwoZCksXG5cbiAgICAgICAgZWxpc3QgPSB0aGlzLl9nZXRFZGdlTGlzdChoKSxcblxuICAgICAgICBlZGdlID0gZWxpc3QuZ2V0RWRnZShwYXRoLCBzdGFydHBvaW50LCBlbmRwb2ludCk7XG4gICAgaWYgKGVkZ2UgIT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIGVkZ2UuZ2V0RWRnZUZpeGVkKCkgJiYgIWVkZ2UuZ2V0RWRnZUN1c3RvbUZpeGVkKCk7XG4gICAgfVxuXG4gICAgYXNzZXJ0KGZhbHNlLCAnQVJHcmFwaC5pc0VkZ2VGaXhlZDogRkFJTEVEJyk7XG4gICAgcmV0dXJuIHRydWU7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5kZWxldGVBbGwoZmFsc2UpO1xuXG4gICAgdGhpcy5ob3Jpem9udGFsLlNldE93bmVyKG51bGwpO1xuICAgIHRoaXMudmVydGljYWwuU2V0T3duZXIobnVsbCk7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLmFzc2VydFZhbGlkID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBpZHMgPSBPYmplY3Qua2V5cyh0aGlzLmJveGVzKSxcbiAgICAgICAgaTtcblxuICAgIGZvciAoaSA9IHRoaXMuYm94ZXMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHRoaXMuYXNzZXJ0VmFsaWRCb3godGhpcy5ib3hlc1tpZHNbaV1dKTtcbiAgICB9XG5cbiAgICBmb3IgKGkgPSB0aGlzLnBhdGhzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICB0aGlzLl9hc3NlcnRWYWxpZFBhdGgodGhpcy5wYXRoc1tpXSk7XG4gICAgfVxuXG4gICAgdGhpcy5ob3Jpem9udGFsLmFzc2VydFZhbGlkKCk7XG4gICAgdGhpcy52ZXJ0aWNhbC5hc3NlcnRWYWxpZCgpO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5hc3NlcnRWYWxpZEJveCA9IGZ1bmN0aW9uIChib3gpIHtcbiAgICBib3guYXNzZXJ0VmFsaWQoKTtcbiAgICBhc3NlcnQoYm94Lm93bmVyID09PSB0aGlzLFxuICAgICAgICAnQVJHcmFwaC5hc3NlcnRWYWxpZEJveDogYm94Lm93bmVyID09PSB0aGlzIEZBSUxFRCcpO1xuICAgIGFzc2VydCh0aGlzLmJveGVzW2JveC5pZF0gIT09IHVuZGVmaW5lZCxcbiAgICAgICAgJ0FSR3JhcGguYXNzZXJ0VmFsaWRCb3g6IHRoaXMuYm94ZXNbYm94LmlkXSAhPT0gdW5kZWZpbmVkIEZBSUxFRCcpO1xuXG4gICAgLy8gVmVyaWZ5IHRoYXQgdGhlIGJveCAoYW5kIHBvcnQpIGVkZ2VzIGFyZSBvbiB0aGUgZ3JhcGhcbiAgICBhc3NlcnQodGhpcy5fY29udGFpbnNSZWN0RWRnZXMoYm94LnJlY3QpLFxuICAgICAgICAnR3JhcGggZG9lcyBub3QgY29udGFpbiBlZGdlcyBmb3IgYm94ICcgKyBib3guaWQpO1xuXG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9jb250YWluc1JlY3RFZGdlcyA9IGZ1bmN0aW9uIChyZWN0KSB7XG4gICAgdmFyIHRvcExlZnQgPSByZWN0LmdldFRvcExlZnQoKSxcbiAgICAgICAgYm90dG9tUmlnaHQgPSByZWN0LmdldEJvdHRvbVJpZ2h0KCksXG4gICAgICAgIHBvaW50cyA9IFtdLFxuICAgICAgICByZXN1bHQgPSB0cnVlLFxuICAgICAgICBsZW4sXG4gICAgICAgIHN0YXJ0LFxuICAgICAgICBlbmQ7XG5cbiAgICBwb2ludHMucHVzaCh0b3BMZWZ0KTtcbiAgICBwb2ludHMucHVzaChuZXcgQXJQb2ludChib3R0b21SaWdodC54LCB0b3BMZWZ0LnkpKTsgIC8vIHRvcCByaWdodFxuICAgIHBvaW50cy5wdXNoKGJvdHRvbVJpZ2h0KTtcbiAgICBwb2ludHMucHVzaChuZXcgQXJQb2ludCh0b3BMZWZ0LngsIGJvdHRvbVJpZ2h0LnkpKTsgIC8vIGJvdHRvbSBsZWZ0XG5cbiAgICBsZW4gPSBwb2ludHMubGVuZ3RoO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgc3RhcnQgPSBwb2ludHNbaV07XG4gICAgICAgIGVuZCA9IHBvaW50c1soaSArIDEpICUgbGVuXTtcbiAgICAgICAgcmVzdWx0ID0gcmVzdWx0ICYmIHRoaXMuX2NvbnRhaW5zRWRnZShzdGFydCwgZW5kKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxuLyoqXG4gKiBUaGlzIGNoZWNrcyBmb3IgYW4gZWRnZSB3aXRoIHRoZSBnaXZlbiBzdGFydC9lbmQgcG9pbnRzLiBUaGlzIHdpbGwgb25seVxuICogd29yayBmb3IgZml4ZWQgZWRnZXMgc3VjaCBhcyBib3hlcyBvciBwb3J0cy5cbiAqXG4gKiBAcGFyYW0gc3RhcnRcbiAqIEBwYXJhbSBlbmRcbiAqIEByZXR1cm4ge3VuZGVmaW5lZH1cbiAqL1xuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fY29udGFpbnNFZGdlID0gZnVuY3Rpb24gKHN0YXJ0LCBlbmQpIHtcbiAgICB2YXIgZGlyO1xuXG4gICAgZGlyID0gVXRpbHMuZ2V0RGlyKHN0YXJ0Lm1pbnVzKGVuZCkpO1xuICAgIGFzc2VydChVdGlscy5pc1JpZ2h0QW5nbGUoZGlyKSxcbiAgICAgICAgJ0VkZ2UgaXMgaW52YWxpZDogJyArIFV0aWxzLnN0cmluZ2lmeShzdGFydCkgKyAnIGFuZCAnICsgVXRpbHMuc3RyaW5naWZ5KGVuZCkpO1xuXG4gICAgaWYgKFV0aWxzLmlzSG9yaXpvbnRhbChkaXIpKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmhvcml6b250YWwuY29udGFpbnMoc3RhcnQsIGVuZCkgfHwgdGhpcy5ob3Jpem9udGFsLmNvbnRhaW5zKGVuZCwgc3RhcnQpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0aGlzLnZlcnRpY2FsLmNvbnRhaW5zKHN0YXJ0LCBlbmQpIHx8IHRoaXMudmVydGljYWwuY29udGFpbnMoZW5kLCBzdGFydCk7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fYXNzZXJ0VmFsaWRQYXRoID0gZnVuY3Rpb24gKHBhdGgpIHtcbiAgICBhc3NlcnQocGF0aC5vd25lciA9PT0gdGhpcyxcbiAgICAgICAgJ0FSR3JhcGguYXNzZXJ0VmFsaWRCb3g6IGJveC5vd25lciA9PT0gdGhpcyBGQUlMRUQnKTtcbiAgICBwYXRoLmFzc2VydFZhbGlkKCk7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLmR1bXBQYXRocyA9IGZ1bmN0aW9uIChwb3MsIGMpIHtcbiAgICBfbG9nZ2VyLmRlYnVnKCdQYXRocyBkdW1wIHBvcyAnICsgcG9zICsgJywgYyAnICsgYyk7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMucGF0aHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgX2xvZ2dlci5kZWJ1ZyhpICsgJy4gUGF0aDogJyk7XG4gICAgICAgIHRoaXMucGF0aHNbaV0uZ2V0UG9pbnRMaXN0KCkuZHVtcFBvaW50cygnRHVtcFBhdGhzJyk7XG4gICAgfVxuXG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLmR1bXBFZGdlTGlzdHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5ob3Jpem9udGFsLmR1bXBFZGdlcygnSG9yaXpvbnRhbCBlZGdlczonKTtcbiAgICB0aGlzLnZlcnRpY2FsLmR1bXBFZGdlcygnVmVydGljYWwgZWRnZXM6Jyk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEF1dG9Sb3V0ZXJHcmFwaDtcbiIsIid1c2Ugc3RyaWN0JztcbnZhciBkZWJ1ZyA9IHJlcXVpcmUoJ2RlYnVnJyksXG4gICAgTEVWRUxTID0gWyd3YXJuJywgJ2RlYnVnJywgJ2luZm8nXTtcblxudmFyIExvZ2dlciA9IGZ1bmN0aW9uKG5hbWUpe1xuICAgIGZvciAodmFyIGkgPSBMRVZFTFMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHRoaXNbTEVWRUxTW2ldXSA9IGRlYnVnKG5hbWUgKyAnOicgKyBMRVZFTFNbaV0pO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gTG9nZ2VyO1xuIiwiLypnbG9iYWxzIGRlZmluZSovXG4vKmpzaGludCBicm93c2VyOiB0cnVlLCBiaXR3aXNlOiBmYWxzZSovXG5cbi8qKlxuICogQGF1dGhvciBicm9sbGIgLyBodHRwczovL2dpdGh1Yi9icm9sbGJcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBDT05TVEFOVFMgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuQ29uc3RhbnRzJyksXG4gICAgVXRpbHMgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuVXRpbHMnKSxcbiAgICBhc3NlcnQgPSBVdGlscy5hc3NlcnQsXG4gICAgQXJQb2ludCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Qb2ludCcpLFxuICAgIEFyUmVjdCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5SZWN0JyksXG4gICAgQXJQb2ludExpc3RQYXRoID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlBvaW50TGlzdCcpO1xuXG4vLyBBdXRvUm91dGVyUGF0aFxudmFyIEF1dG9Sb3V0ZXJQYXRoID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuaWQgPSAnTm9uZSc7XG4gICAgdGhpcy5vd25lciA9IG51bGw7XG4gICAgdGhpcy5zdGFydHBvaW50ID0gbnVsbDtcbiAgICB0aGlzLmVuZHBvaW50ID0gbnVsbDtcbiAgICB0aGlzLnN0YXJ0cG9ydHMgPSBudWxsO1xuICAgIHRoaXMuZW5kcG9ydHMgPSBudWxsO1xuICAgIHRoaXMuc3RhcnRwb3J0ID0gbnVsbDtcbiAgICB0aGlzLmVuZHBvcnQgPSBudWxsO1xuICAgIHRoaXMuYXR0cmlidXRlcyA9IENPTlNUQU5UUy5QYXRoRGVmYXVsdDtcbiAgICB0aGlzLnN0YXRlID0gQ09OU1RBTlRTLlBhdGhTdGF0ZURlZmF1bHQ7XG4gICAgdGhpcy5pc0F1dG9Sb3V0aW5nT24gPSB0cnVlO1xuICAgIHRoaXMuY3VzdG9tUGF0aERhdGEgPSBbXTtcbiAgICB0aGlzLmN1c3RvbWl6YXRpb25UeXBlID0gJ1BvaW50cyc7XG4gICAgdGhpcy5wYXRoRGF0YVRvRGVsZXRlID0gW107XG4gICAgdGhpcy5wb2ludHMgPSBuZXcgQXJQb2ludExpc3RQYXRoKCk7XG59O1xuXG5cbi8vLS0tLVBvaW50c1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuaGFzT3duZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMub3duZXIgIT09IG51bGw7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuc2V0U3RhcnRFbmRQb3J0cyA9IGZ1bmN0aW9uIChzdGFydCwgZW5kKSB7XG4gICAgdGhpcy5zdGFydHBvcnRzID0gc3RhcnQ7XG4gICAgdGhpcy5lbmRwb3J0cyA9IGVuZDtcbiAgICB0aGlzLmNhbGN1bGF0ZVN0YXJ0RW5kUG9ydHMoKTtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5jbGVhclBvcnRzID0gZnVuY3Rpb24gKCkge1xuICAgIC8vIHJlbW92ZSB0aGUgc3RhcnQvZW5kcG9pbnRzIGZyb20gdGhlIGdpdmVuIHBvcnRzXG4gICAgaWYgKHRoaXMuc3RhcnRwb2ludCkge1xuICAgICAgICB0aGlzLnN0YXJ0cG9ydC5yZW1vdmVQb2ludCh0aGlzLnN0YXJ0cG9pbnQpO1xuICAgICAgICB0aGlzLnN0YXJ0cG9pbnQgPSBudWxsO1xuICAgIH1cbiAgICBpZiAodGhpcy5lbmRwb2ludCkge1xuICAgICAgICB0aGlzLmVuZHBvcnQucmVtb3ZlUG9pbnQodGhpcy5lbmRwb2ludCk7XG4gICAgICAgIHRoaXMuZW5kcG9pbnQgPSBudWxsO1xuICAgIH1cbiAgICB0aGlzLnN0YXJ0cG9ydCA9IG51bGw7XG4gICAgdGhpcy5lbmRwb3J0ID0gbnVsbDtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5nZXRTdGFydFBvcnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgYXNzZXJ0KHRoaXMuc3RhcnRwb3J0cy5sZW5ndGgsIFxuICAgICAgICBgQVJQYXRoLmdldFN0YXJ0UG9ydDogQ2FuXFwndCByZXRyaWV2ZSBzdGFydCBwb3J0IGZyb20gJHt0aGlzLmlkfWApO1xuXG4gICAgaWYgKCF0aGlzLnN0YXJ0cG9ydCkge1xuICAgICAgICB0aGlzLmNhbGN1bGF0ZVN0YXJ0UG9ydHMoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuc3RhcnRwb3J0O1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmdldEVuZFBvcnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgYXNzZXJ0KHRoaXMuZW5kcG9ydHMubGVuZ3RoLCBcbiAgICAgICAgJ0FSUG9ydC5nZXRFbmRQb3J0OiBDYW5cXCd0IHJldHJpZXZlIGVuZCBwb3J0IGZyb20gJyt0aGlzLmlkKTtcbiAgICBpZiAoIXRoaXMuZW5kcG9ydCkge1xuICAgICAgICB0aGlzLmNhbGN1bGF0ZUVuZFBvcnRzKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmVuZHBvcnQ7XG59O1xuXG4vKipcbiAqIFJlbW92ZSBwb3J0IGZyb20gc3RhcnQvZW5kIHBvcnQgbGlzdHMuXG4gKlxuICogQHBhcmFtIHBvcnRcbiAqIEByZXR1cm4ge3VuZGVmaW5lZH1cbiAqL1xuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLnJlbW92ZVBvcnQgPSBmdW5jdGlvbiAocG9ydCkge1xuICAgIHZhciByZW1vdmVkID0gVXRpbHMucmVtb3ZlRnJvbUFycmF5cyhwb3J0LCB0aGlzLnN0YXJ0cG9ydHMsIHRoaXMuZW5kcG9ydHMpO1xuICAgIGFzc2VydChyZW1vdmVkLCAnUG9ydCB3YXMgbm90IHJlbW92ZWQgZnJvbSBwYXRoIHN0YXJ0L2VuZCBwb3J0cycpO1xuXG4gICAgLy8gSWYgbm8gbW9yZSBzdGFydC9lbmQgcG9ydHMsIHJlbW92ZSB0aGUgcGF0aFxuICAgIC8vIGFzc2VydCh0aGlzLnN0YXJ0cG9ydHMubGVuZ3RoICYmIHRoaXMuZW5kcG9ydHMubGVuZ3RoLCAnUmVtb3ZlZCBhbGwgc3RhcnQvZW5kcG9ydHMgb2YgcGF0aCAnICsgdGhpcy5pZCk7XG4gICAgdGhpcy5vd25lci5kaXNjb25uZWN0KHRoaXMpO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmNhbGN1bGF0ZVN0YXJ0RW5kUG9ydHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHtzcmM6IHRoaXMuY2FsY3VsYXRlU3RhcnRQb3J0cygpLCBkc3Q6IHRoaXMuY2FsY3VsYXRlRW5kUG9ydHMoKX07XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuY2FsY3VsYXRlU3RhcnRQb3J0cyA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc3JjUG9ydHMgPSBbXSxcbiAgICAgICAgdGd0LFxuICAgICAgICBpO1xuXG4gICAgYXNzZXJ0KHRoaXMuc3RhcnRwb3J0cy5sZW5ndGggPiAwLCAnQXJQYXRoLmNhbGN1bGF0ZVN0YXJ0RW5kUG9ydHM6IHRoaXMuc3RhcnRwb3J0cyBjYW5ub3QgYmUgZW1wdHkhJyk7XG5cbiAgICAvL1JlbW92ZSB0aGlzLnN0YXJ0cG9pbnRcbiAgICBpZiAodGhpcy5zdGFydHBvcnQgJiYgdGhpcy5zdGFydHBvcnQuaGFzUG9pbnQodGhpcy5zdGFydHBvaW50KSkge1xuICAgICAgICB0aGlzLnN0YXJ0cG9ydC5yZW1vdmVQb2ludCh0aGlzLnN0YXJ0cG9pbnQpO1xuICAgIH1cblxuICAgIC8vR2V0IGF2YWlsYWJsZSBwb3J0c1xuICAgIGZvciAoaSA9IHRoaXMuc3RhcnRwb3J0cy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgYXNzZXJ0KHRoaXMuc3RhcnRwb3J0c1tpXS5vd25lcixcbiAgICAgICAgICAgICdBUlBhdGguY2FsY3VsYXRlU3RhcnRFbmRQb3J0czogcG9ydCAnICsgdGhpcy5zdGFydHBvcnRzW2ldLmlkICsgJyBoYXMgaW52YWxpZCB0aGlzLm93bmVyIScpO1xuICAgICAgICBpZiAodGhpcy5zdGFydHBvcnRzW2ldLmlzQXZhaWxhYmxlKCkpIHtcbiAgICAgICAgICAgIHNyY1BvcnRzLnB1c2godGhpcy5zdGFydHBvcnRzW2ldKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChzcmNQb3J0cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgc3JjUG9ydHMgPSB0aGlzLnN0YXJ0cG9ydHM7XG4gICAgfVxuXG4gICAgLy9QcmV2ZW50aW5nIHNhbWUgc3RhcnQvZW5kcG9ydFxuICAgIGlmICh0aGlzLmVuZHBvcnQgJiYgc3JjUG9ydHMubGVuZ3RoID4gMSkge1xuICAgICAgICBpID0gc3JjUG9ydHMubGVuZ3RoO1xuICAgICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgICAgICBpZiAoc3JjUG9ydHNbaV0gPT09IHRoaXMuZW5kcG9ydCkge1xuICAgICAgICAgICAgICAgIHNyY1BvcnRzLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgLy8gR2V0dGluZyB0YXJnZXRcbiAgICBpZiAodGhpcy5pc0F1dG9Sb3V0ZWQoKSkge1xuICAgICAgICB2YXIgYWNjdW11bGF0ZVBvcnRDZW50ZXJzID0gZnVuY3Rpb24gKHByZXYsIGN1cnJlbnQpIHtcbiAgICAgICAgICAgIHZhciBjZW50ZXIgPSBjdXJyZW50LnJlY3QuZ2V0Q2VudGVyKCk7XG4gICAgICAgICAgICBwcmV2LnggKz0gY2VudGVyLng7XG4gICAgICAgICAgICBwcmV2LnkgKz0gY2VudGVyLnk7XG4gICAgICAgICAgICByZXR1cm4gcHJldjtcbiAgICAgICAgfTtcbiAgICAgICAgdGd0ID0gdGhpcy5lbmRwb3J0cy5yZWR1Y2UoYWNjdW11bGF0ZVBvcnRDZW50ZXJzLCBuZXcgQXJQb2ludCgwLCAwKSk7XG5cbiAgICAgICAgdGd0LnggLz0gdGhpcy5lbmRwb3J0cy5sZW5ndGg7XG4gICAgICAgIHRndC55IC89IHRoaXMuZW5kcG9ydHMubGVuZ3RoO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRndCA9IHRoaXMuY3VzdG9tUGF0aERhdGFbMF07XG4gICAgfVxuICAgIC8vIEdldCB0aGUgb3B0aW1hbCBwb3J0IHRvIHRoZSB0YXJnZXRcbiAgICB0aGlzLnN0YXJ0cG9ydCA9IFV0aWxzLmdldE9wdGltYWxQb3J0cyhzcmNQb3J0cywgdGd0KTtcblxuICAgIC8vIENyZWF0ZSBhIHRoaXMuc3RhcnRwb2ludCBhdCB0aGUgcG9ydFxuICAgIHZhciBzdGFydGRpciA9IHRoaXMuZ2V0U3RhcnREaXIoKSxcbiAgICAgICAgc3RhcnRwb3J0SGFzTGltaXRlZCA9IGZhbHNlLFxuICAgICAgICBzdGFydHBvcnRDYW5IYXZlID0gdHJ1ZTtcblxuICAgIGlmIChzdGFydGRpciAhPT0gQ09OU1RBTlRTLkRpck5vbmUpIHtcbiAgICAgICAgc3RhcnRwb3J0SGFzTGltaXRlZCA9IHRoaXMuc3RhcnRwb3J0Lmhhc0xpbWl0ZWREaXJzKCk7XG4gICAgICAgIHN0YXJ0cG9ydENhbkhhdmUgPSB0aGlzLnN0YXJ0cG9ydC5jYW5IYXZlU3RhcnRFbmRQb2ludE9uKHN0YXJ0ZGlyLCB0cnVlKTtcbiAgICB9XG4gICAgaWYgKHN0YXJ0ZGlyID09PSBDT05TVEFOVFMuRGlyTm9uZSB8fFx0XHRcdFx0XHRcdFx0Ly8gcmVjYWxjIHN0YXJ0ZGlyIGlmIGVtcHR5XG4gICAgICAgIHN0YXJ0cG9ydEhhc0xpbWl0ZWQgJiYgIXN0YXJ0cG9ydENhbkhhdmUpIHtcdFx0Ly8gb3IgaXMgbGltaXRlZCBhbmQgdXNlcnByZWYgaXMgaW52YWxpZFxuICAgICAgICBzdGFydGRpciA9IHRoaXMuc3RhcnRwb3J0LmdldFN0YXJ0RW5kRGlyVG8odGd0LCB0cnVlKTtcbiAgICB9XG5cbiAgICB0aGlzLnN0YXJ0cG9pbnQgPSB0aGlzLnN0YXJ0cG9ydC5jcmVhdGVTdGFydEVuZFBvaW50VG8odGd0LCBzdGFydGRpcik7XG4gICAgdGhpcy5zdGFydHBvaW50Lm93bmVyID0gdGhpcztcbiAgICByZXR1cm4gdGhpcy5zdGFydHBvcnQ7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuY2FsY3VsYXRlRW5kUG9ydHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGRzdFBvcnRzID0gW10sXG4gICAgICAgIHRndCxcbiAgICAgICAgaSA9IHRoaXMuZW5kcG9ydHMubGVuZ3RoO1xuXG4gICAgYXNzZXJ0KHRoaXMuZW5kcG9ydHMubGVuZ3RoID4gMCwgJ0FyUGF0aC5jYWxjdWxhdGVTdGFydEVuZFBvcnRzOiB0aGlzLmVuZHBvcnRzIGNhbm5vdCBiZSBlbXB0eSEnKTtcblxuICAgIC8vUmVtb3ZlIG9sZCB0aGlzLmVuZHBvaW50XG4gICAgaWYgKHRoaXMuZW5kcG9ydCAmJiB0aGlzLmVuZHBvcnQuaGFzUG9pbnQodGhpcy5lbmRwb2ludCkpIHtcbiAgICAgICAgdGhpcy5lbmRwb3J0LnJlbW92ZVBvaW50KHRoaXMuZW5kcG9pbnQpO1xuICAgIH1cblxuICAgIC8vR2V0IGF2YWlsYWJsZSBwb3J0c1xuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgYXNzZXJ0KHRoaXMuZW5kcG9ydHNbaV0ub3duZXIsICdBUlBhdGguY2FsY3VsYXRlU3RhcnRFbmRQb3J0czogdGhpcy5lbmRwb3J0IGhhcyBpbnZhbGlkIHRoaXMub3duZXIhJyk7XG4gICAgICAgIGlmICh0aGlzLmVuZHBvcnRzW2ldLmlzQXZhaWxhYmxlKCkpIHtcbiAgICAgICAgICAgIGRzdFBvcnRzLnB1c2godGhpcy5lbmRwb3J0c1tpXSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoZHN0UG9ydHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGRzdFBvcnRzID0gdGhpcy5lbmRwb3J0cztcbiAgICB9XG5cbiAgICAvL1ByZXZlbnRpbmcgc2FtZSBzdGFydC90aGlzLmVuZHBvcnRcbiAgICBpZiAodGhpcy5zdGFydHBvcnQgJiYgZHN0UG9ydHMubGVuZ3RoID4gMSkge1xuICAgICAgICBpID0gZHN0UG9ydHMubGVuZ3RoO1xuICAgICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgICAgICBpZiAoZHN0UG9ydHNbaV0gPT09IHRoaXMuc3RhcnRwb3J0KSB7XG4gICAgICAgICAgICAgICAgZHN0UG9ydHMuc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy9HZXR0aW5nIHRhcmdldFxuICAgIGlmICh0aGlzLmlzQXV0b1JvdXRlZCgpKSB7XG5cbiAgICAgICAgdmFyIGFjY3VtdWxhdGVQb3J0Q2VudGVycyA9IGZ1bmN0aW9uIChwcmV2LCBjdXJyZW50KSB7XG4gICAgICAgICAgICB2YXIgY2VudGVyID0gY3VycmVudC5yZWN0LmdldENlbnRlcigpO1xuICAgICAgICAgICAgcHJldi54ICs9IGNlbnRlci54O1xuICAgICAgICAgICAgcHJldi55ICs9IGNlbnRlci55O1xuICAgICAgICAgICAgcmV0dXJuIHByZXY7XG4gICAgICAgIH07XG4gICAgICAgIHRndCA9IHRoaXMuc3RhcnRwb3J0cy5yZWR1Y2UoYWNjdW11bGF0ZVBvcnRDZW50ZXJzLCBuZXcgQXJQb2ludCgwLCAwKSk7XG5cbiAgICAgICAgdGd0LnggLz0gdGhpcy5zdGFydHBvcnRzLmxlbmd0aDtcbiAgICAgICAgdGd0LnkgLz0gdGhpcy5zdGFydHBvcnRzLmxlbmd0aDtcblxuICAgIH0gZWxzZSB7XG4gICAgICAgIHRndCA9IHRoaXMuY3VzdG9tUGF0aERhdGFbdGhpcy5jdXN0b21QYXRoRGF0YS5sZW5ndGggLSAxXTtcbiAgICB9XG5cbiAgICAvL0dldCB0aGUgb3B0aW1hbCBwb3J0IHRvIHRoZSB0YXJnZXRcbiAgICB0aGlzLmVuZHBvcnQgPSBVdGlscy5nZXRPcHRpbWFsUG9ydHMoZHN0UG9ydHMsIHRndCk7XG5cbiAgICAvL0NyZWF0ZSB0aGlzLmVuZHBvaW50IGF0IHRoZSBwb3J0XG4gICAgdmFyIGVuZGRpciA9IHRoaXMuZ2V0RW5kRGlyKCksXG4gICAgICAgIHN0YXJ0ZGlyID0gdGhpcy5nZXRTdGFydERpcigpLFxuICAgICAgICBlbmRwb3J0SGFzTGltaXRlZCA9IGZhbHNlLFxuICAgICAgICBlbmRwb3J0Q2FuSGF2ZSA9IHRydWU7XG5cbiAgICBpZiAoZW5kZGlyICE9PSBDT05TVEFOVFMuRGlyTm9uZSkge1xuICAgICAgICBlbmRwb3J0SGFzTGltaXRlZCA9IHRoaXMuZW5kcG9ydC5oYXNMaW1pdGVkRGlycygpO1xuICAgICAgICBlbmRwb3J0Q2FuSGF2ZSA9IHRoaXMuZW5kcG9ydC5jYW5IYXZlU3RhcnRFbmRQb2ludE9uKGVuZGRpciwgZmFsc2UpO1xuICAgIH1cbiAgICBpZiAoZW5kZGlyID09PSBDT05TVEFOVFMuRGlyTm9uZSB8fCAgICAgICAgICAgICAgICAgICAgICAgICAvLyBsaWtlIGFib3ZlXG4gICAgICAgIGVuZHBvcnRIYXNMaW1pdGVkICYmICFlbmRwb3J0Q2FuSGF2ZSkge1xuICAgICAgICBlbmRkaXIgPSB0aGlzLmVuZHBvcnQuZ2V0U3RhcnRFbmREaXJUbyh0Z3QsIGZhbHNlLCB0aGlzLnN0YXJ0cG9ydCA9PT0gdGhpcy5lbmRwb3J0ID9cbiAgICAgICAgICAgIHN0YXJ0ZGlyIDogQ09OU1RBTlRTLkRpck5vbmUpO1xuICAgIH1cblxuICAgIHRoaXMuZW5kcG9pbnQgPSB0aGlzLmVuZHBvcnQuY3JlYXRlU3RhcnRFbmRQb2ludFRvKHRndCwgZW5kZGlyKTtcbiAgICB0aGlzLmVuZHBvaW50Lm93bmVyID0gdGhpcztcbiAgICByZXR1cm4gdGhpcy5lbmRwb3J0O1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmlzQ29ubmVjdGVkID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiAodGhpcy5zdGF0ZSAmIENPTlNUQU5UUy5QYXRoU3RhdGVDb25uZWN0ZWQpICE9PSAwO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmFkZFRhaWwgPSBmdW5jdGlvbiAocHQpIHtcbiAgICBhc3NlcnQoIXRoaXMuaXNDb25uZWN0ZWQoKSxcbiAgICAgICAgJ0FSUGF0aC5hZGRUYWlsOiAhdGhpcy5pc0Nvbm5lY3RlZCgpIEZBSUxFRCcpO1xuICAgIHRoaXMucG9pbnRzLnB1c2gocHQpO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmRlbGV0ZUFsbCA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLnBvaW50cyA9IG5ldyBBclBvaW50TGlzdFBhdGgoKTtcbiAgICB0aGlzLnN0YXRlID0gQ09OU1RBTlRTLlBhdGhTdGF0ZURlZmF1bHQ7XG4gICAgdGhpcy5jbGVhclBvcnRzKCk7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuZ2V0U3RhcnRCb3ggPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHBvcnQgPSB0aGlzLnN0YXJ0cG9ydCB8fCB0aGlzLnN0YXJ0cG9ydHNbMF07XG4gICAgcmV0dXJuIHBvcnQub3duZXIuZ2V0Um9vdEJveCgpO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmdldEVuZEJveCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgcG9ydCA9IHRoaXMuZW5kcG9ydCB8fCB0aGlzLmVuZHBvcnRzWzBdO1xuICAgIHJldHVybiBwb3J0Lm93bmVyLmdldFJvb3RCb3goKTtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5nZXRPdXRPZkJveFN0YXJ0UG9pbnQgPSBmdW5jdGlvbiAoaGludERpcikge1xuICAgIHZhciBzdGFydEJveFJlY3QgPSB0aGlzLmdldFN0YXJ0Qm94KCk7XG5cbiAgICBhc3NlcnQoaGludERpciAhPT0gQ09OU1RBTlRTLkRpclNrZXcsICdBUlBhdGguZ2V0T3V0T2ZCb3hTdGFydFBvaW50OiBoaW50RGlyICE9PSBDT05TVEFOVFMuRGlyU2tldyBGQUlMRUQnKTtcbiAgICBhc3NlcnQodGhpcy5wb2ludHMubGVuZ3RoID49IDIsICdBUlBhdGguZ2V0T3V0T2ZCb3hTdGFydFBvaW50OiB0aGlzLnBvaW50cy5sZW5ndGggPj0gMiBGQUlMRUQnKTtcblxuICAgIHZhciBwb3MgPSAwLFxuICAgICAgICBwID0gbmV3IEFyUG9pbnQodGhpcy5wb2ludHNbcG9zKytdKSxcbiAgICAgICAgZCA9IFV0aWxzLmdldERpcih0aGlzLnBvaW50c1twb3NdLm1pbnVzKHApKTtcblxuICAgIGlmIChkID09PSBDT05TVEFOVFMuRGlyU2tldykge1xuICAgICAgICBkID0gaGludERpcjtcbiAgICB9XG4gICAgYXNzZXJ0KFV0aWxzLmlzUmlnaHRBbmdsZShkKSwgJ0FSUGF0aC5nZXRPdXRPZkJveFN0YXJ0UG9pbnQ6IFV0aWxzLmlzUmlnaHRBbmdsZSAoZCkgRkFJTEVEJyk7XG5cbiAgICBpZiAoVXRpbHMuaXNIb3Jpem9udGFsKGQpKSB7XG4gICAgICAgIHAueCA9IFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKHN0YXJ0Qm94UmVjdCwgZCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcC55ID0gVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQoc3RhcnRCb3hSZWN0LCBkKTtcbiAgICB9XG5cbiAgICAvL2Fzc2VydChVdGlscy5nZXREaXIgKHRoaXMucG9pbnRzW3Bvc10ubWludXMocCkpID09PSBVdGlscy5yZXZlcnNlRGlyICggZCApIHx8XG4gICAgLy8gVXRpbHMuZ2V0RGlyICh0aGlzLnBvaW50c1twb3NdLm1pbnVzKHApKSA9PT0gZCwgJ1V0aWxzLmdldERpciAodGhpcy5wb2ludHNbcG9zXS5taW51cyhwKSkgPT09XG4gICAgLy8gVXRpbHMucmV2ZXJzZURpciAoIGQgKSB8fCBVdGlscy5nZXREaXIgKHRoaXMucG9pbnRzW3Bvc10ubWludXMocCkpID09PSBkIEZBSUxFRCcpO1xuXG4gICAgcmV0dXJuIHA7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuZ2V0T3V0T2ZCb3hFbmRQb2ludCA9IGZ1bmN0aW9uIChoaW50RGlyKSB7XG4gICAgdmFyIGVuZEJveFJlY3QgPSB0aGlzLmdldEVuZEJveCgpO1xuXG4gICAgYXNzZXJ0KGhpbnREaXIgIT09IENPTlNUQU5UUy5EaXJTa2V3LCAnQVJQYXRoLmdldE91dE9mQm94RW5kUG9pbnQ6IGhpbnREaXIgIT09IENPTlNUQU5UUy5EaXJTa2V3IEZBSUxFRCcpO1xuICAgIGFzc2VydCh0aGlzLnBvaW50cy5sZW5ndGggPj0gMiwgJ0FSUGF0aC5nZXRPdXRPZkJveEVuZFBvaW50OiB0aGlzLnBvaW50cy5sZW5ndGggPj0gMiBGQUlMRUQnKTtcblxuICAgIHZhciBwb3MgPSB0aGlzLnBvaW50cy5sZW5ndGggLSAxLFxuICAgICAgICBwID0gbmV3IEFyUG9pbnQodGhpcy5wb2ludHNbcG9zLS1dKSxcbiAgICAgICAgZCA9IFV0aWxzLmdldERpcih0aGlzLnBvaW50c1twb3NdLm1pbnVzKHApKTtcblxuICAgIGlmIChkID09PSBDT05TVEFOVFMuRGlyU2tldykge1xuICAgICAgICBkID0gaGludERpcjtcbiAgICB9XG4gICAgYXNzZXJ0KFV0aWxzLmlzUmlnaHRBbmdsZShkKSwgJ0FSUGF0aC5nZXRPdXRPZkJveEVuZFBvaW50OiBVdGlscy5pc1JpZ2h0QW5nbGUgKGQpIEZBSUxFRCcpO1xuXG4gICAgaWYgKFV0aWxzLmlzSG9yaXpvbnRhbChkKSkge1xuICAgICAgICBwLnggPSBVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChlbmRCb3hSZWN0LCBkKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBwLnkgPSBVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChlbmRCb3hSZWN0LCBkKTtcbiAgICB9XG5cbiAgICAvL2Fzc2VydChVdGlscy5nZXREaXIgKHRoaXMucG9pbnRzW3Bvc10ubWludXMocCkpID09PSBVdGlscy5yZXZlcnNlRGlyICggZCApIHx8XG4gICAgLy8gVXRpbHMuZ2V0RGlyICh0aGlzLnBvaW50c1twb3NdLm1pbnVzKHApKSA9PT0gZCwgJ0FSUGF0aC5nZXRPdXRPZkJveEVuZFBvaW50OiBVdGlscy5nZXREaXJcbiAgICAvLyAodGhpcy5wb2ludHNbcG9zXS5taW51cyhwKSkgPT09IGQgfHwgVXRpbHMuZ2V0RGlyICh0aGlzLnBvaW50c1twb3NdLm1pbnVzKHApKSA9PT0gZCBGQUlMRUQnKTtcblxuICAgIHJldHVybiBwO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLnNpbXBsaWZ5VHJpdmlhbGx5ID0gZnVuY3Rpb24gKCkge1xuICAgIGFzc2VydCghdGhpcy5pc0Nvbm5lY3RlZCgpLCAnQVJQYXRoLnNpbXBsaWZ5VHJpdmlhbGx5OiAhaXNDb25uZWN0ZWQoKSBGQUlMRUQnKTtcblxuICAgIGlmICh0aGlzLnBvaW50cy5sZW5ndGggPD0gMikge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIHBvcyA9IDAsXG4gICAgICAgIHBvczEgPSBwb3M7XG5cbiAgICBhc3NlcnQocG9zMSAhPT0gdGhpcy5wb2ludHMubGVuZ3RoLCAnQVJQYXRoLnNpbXBsaWZ5VHJpdmlhbGx5OiBwb3MxICE9PSB0aGlzLnBvaW50cy5sZW5ndGggRkFJTEVEJyk7XG4gICAgdmFyIHAxID0gdGhpcy5wb2ludHNbcG9zKytdLFxuICAgICAgICBwb3MyID0gcG9zO1xuXG4gICAgYXNzZXJ0KHBvczIgIT09IHRoaXMucG9pbnRzLmxlbmd0aCwgJ0FSUGF0aC5zaW1wbGlmeVRyaXZpYWxseTogcG9zMiAhPT0gdGhpcy5wb2ludHMubGVuZ3RoIEZBSUxFRCcpO1xuICAgIHZhciBwMiA9IHRoaXMucG9pbnRzW3BvcysrXSxcbiAgICAgICAgZGlyMTIgPSBVdGlscy5nZXREaXIocDIubWludXMocDEpKSxcbiAgICAgICAgcG9zMyA9IHBvcztcblxuICAgIGFzc2VydChwb3MzICE9PSB0aGlzLnBvaW50cy5sZW5ndGgsICdBUlBhdGguc2ltcGxpZnlUcml2aWFsbHk6IHBvczMgIT09IHRoaXMucG9pbnRzLmxlbmd0aCBGQUlMRUQnKTtcbiAgICB2YXIgcDMgPSB0aGlzLnBvaW50c1twb3MrK10sXG4gICAgICAgIGRpcjIzID0gVXRpbHMuZ2V0RGlyKHAzLm1pbnVzKHAyKSk7XG5cbiAgICBmb3IgKDsgOykge1xuICAgICAgICBpZiAoZGlyMTIgPT09IENPTlNUQU5UUy5EaXJOb25lIHx8IGRpcjIzID09PSBDT05TVEFOVFMuRGlyTm9uZSB8fFxuICAgICAgICAgICAgKGRpcjEyICE9PSBDT05TVEFOVFMuRGlyU2tldyAmJiBkaXIyMyAhPT0gQ09OU1RBTlRTLkRpclNrZXcgJiZcbiAgICAgICAgICAgIChkaXIxMiA9PT0gZGlyMjMgfHwgZGlyMTIgPT09IFV0aWxzLnJldmVyc2VEaXIoZGlyMjMpKSApKSB7XG4gICAgICAgICAgICB0aGlzLnBvaW50cy5zcGxpY2UocG9zMiwgMSk7XG4gICAgICAgICAgICBwb3MtLTtcbiAgICAgICAgICAgIHBvczMtLTtcbiAgICAgICAgICAgIGRpcjEyID0gVXRpbHMuZ2V0RGlyKHAzLm1pbnVzKHAxKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwb3MxID0gcG9zMjtcbiAgICAgICAgICAgIHAxID0gcDI7XG4gICAgICAgICAgICBkaXIxMiA9IGRpcjIzO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHBvcyA9PT0gdGhpcy5wb2ludHMubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBwb3MyID0gcG9zMztcbiAgICAgICAgcDIgPSBwMztcblxuICAgICAgICBwb3MzID0gcG9zO1xuICAgICAgICBwMyA9IHRoaXMucG9pbnRzW3BvcysrXTtcblxuICAgICAgICBkaXIyMyA9IFV0aWxzLmdldERpcihwMy5taW51cyhwMikpO1xuICAgIH1cblxuICAgIGlmIChDT05TVEFOVFMuREVCVUcpIHtcbiAgICAgICAgdGhpcy5hc3NlcnRWYWxpZFBvaW50cygpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5nZXRQb2ludExpc3QgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMucG9pbnRzO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmlzUGF0aENsaXAgPSBmdW5jdGlvbiAociwgaXNTdGFydE9yRW5kUmVjdCkge1xuICAgIHZhciB0bXAgPSB0aGlzLnBvaW50cy5nZXRUYWlsRWRnZSgpLFxuICAgICAgICBhID0gdG1wLnN0YXJ0LFxuICAgICAgICBiID0gdG1wLmVuZCxcbiAgICAgICAgcG9zID0gdG1wLnBvcyxcbiAgICAgICAgaSA9IDAsXG4gICAgICAgIG51bUVkZ2VzID0gdGhpcy5wb2ludHMubGVuZ3RoIC0gMTtcblxuICAgIHdoaWxlIChwb3MgPj0gMCkge1xuICAgICAgICBpZiAoaXNTdGFydE9yRW5kUmVjdCAmJiAoIGkgPT09IDAgfHwgaSA9PT0gbnVtRWRnZXMgLSAxICkpIHtcbiAgICAgICAgICAgIGlmIChVdGlscy5pc1BvaW50SW4oYSwgciwgMSkgJiZcbiAgICAgICAgICAgICAgICBVdGlscy5pc1BvaW50SW4oYiwgciwgMSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChVdGlscy5pc0xpbmVDbGlwUmVjdChhLCBiLCByKSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICB0bXAgPSB0aGlzLnBvaW50cy5nZXRQcmV2RWRnZShwb3MsIGEsIGIpO1xuICAgICAgICBhID0gdG1wLnN0YXJ0O1xuICAgICAgICBiID0gdG1wLmVuZDtcbiAgICAgICAgcG9zID0gdG1wLnBvcztcbiAgICAgICAgaSsrO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5pc0ZpeGVkID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiAoKHRoaXMuYXR0cmlidXRlcyAmIENPTlNUQU5UUy5QYXRoRml4ZWQpICE9PSAwKTtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5pc01vdmVhYmxlID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiAoKHRoaXMuYXR0cmlidXRlcyAmIENPTlNUQU5UUy5QYXRoRml4ZWQpID09PSAwKTtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5zZXRTdGF0ZSA9IGZ1bmN0aW9uIChzKSB7XG4gICAgYXNzZXJ0KHRoaXMub3duZXIgIT09IG51bGwsICdBUlBhdGguc2V0U3RhdGU6IHRoaXMub3duZXIgIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICB0aGlzLnN0YXRlID0gcztcbiAgICBpZiAoQ09OU1RBTlRTLkRFQlVHKSB7XG4gICAgICAgIHRoaXMuYXNzZXJ0VmFsaWQoKTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuZ2V0RW5kRGlyID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBhID0gdGhpcy5hdHRyaWJ1dGVzICYgQ09OU1RBTlRTLlBhdGhFbmRNYXNrO1xuICAgIHJldHVybiBhICYgQ09OU1RBTlRTLlBhdGhFbmRPblRvcCA/IENPTlNUQU5UUy5EaXJUb3AgOlxuICAgICAgICBhICYgQ09OU1RBTlRTLlBhdGhFbmRPblJpZ2h0ID8gQ09OU1RBTlRTLkRpclJpZ2h0IDpcbiAgICAgICAgICAgIGEgJiBDT05TVEFOVFMuUGF0aEVuZE9uQm90dG9tID8gQ09OU1RBTlRTLkRpckJvdHRvbSA6XG4gICAgICAgICAgICAgICAgYSAmIENPTlNUQU5UUy5QYXRoRW5kT25MZWZ0ID8gQ09OU1RBTlRTLkRpckxlZnQgOiBDT05TVEFOVFMuRGlyTm9uZTtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5nZXRTdGFydERpciA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgYSA9IHRoaXMuYXR0cmlidXRlcyAmIENPTlNUQU5UUy5QYXRoU3RhcnRNYXNrO1xuICAgIHJldHVybiBhICYgQ09OU1RBTlRTLlBhdGhTdGFydE9uVG9wID8gQ09OU1RBTlRTLkRpclRvcCA6XG4gICAgICAgIGEgJiBDT05TVEFOVFMuUGF0aFN0YXJ0T25SaWdodCA/IENPTlNUQU5UUy5EaXJSaWdodCA6XG4gICAgICAgICAgICBhICYgQ09OU1RBTlRTLlBhdGhTdGFydE9uQm90dG9tID8gQ09OU1RBTlRTLkRpckJvdHRvbSA6XG4gICAgICAgICAgICAgICAgYSAmIENPTlNUQU5UUy5QYXRoU3RhcnRPbkxlZnQgPyBDT05TVEFOVFMuRGlyTGVmdCA6IENPTlNUQU5UUy5EaXJOb25lO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLnNldEVuZERpciA9IGZ1bmN0aW9uIChwYXRoRW5kKSB7XG4gICAgdGhpcy5hdHRyaWJ1dGVzID0gKHRoaXMuYXR0cmlidXRlcyAmIH5DT05TVEFOVFMuUGF0aEVuZE1hc2spICsgcGF0aEVuZDtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5zZXRTdGFydERpciA9IGZ1bmN0aW9uIChwYXRoU3RhcnQpIHtcbiAgICB0aGlzLmF0dHJpYnV0ZXMgPSAodGhpcy5hdHRyaWJ1dGVzICYgfkNPTlNUQU5UUy5QYXRoU3RhcnRNYXNrKSArIHBhdGhTdGFydDtcbn07XG5cbi8qKlxuICogU2V0IHRoZSBjdXN0b20gcG9pbnRzIG9mIHRoZSBwYXRoIGFuZCBkZXRlcm1pbmUgc3RhcnQvZW5kIHBvaW50cy9wb3J0cy5cbiAqXG4gKiBAcGFyYW0ge0FycmF5PEFyUG9pbnQ+fSBwb2ludHNcbiAqIEByZXR1cm4ge3VuZGVmaW5lZH1cbiAqL1xuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLnNldEN1c3RvbVBhdGhQb2ludHMgPSBmdW5jdGlvbiAocG9pbnRzKSB7XG4gICAgdGhpcy5jdXN0b21QYXRoRGF0YSA9IHBvaW50cztcblxuICAgIC8vIEZpbmQgdGhlIHN0YXJ0L2VuZHBvcnRzXG4gICAgdGhpcy5jYWxjdWxhdGVTdGFydEVuZFBvcnRzKCk7XG5cbiAgICB0aGlzLnBvaW50cyA9IG5ldyBBclBvaW50TGlzdFBhdGgoKS5jb25jYXQocG9pbnRzKTtcblxuICAgIC8vIEFkZCB0aGUgc3RhcnQvZW5kIHBvaW50cyB0byB0aGUgbGlzdFxuICAgIHRoaXMucG9pbnRzLnVuc2hpZnQodGhpcy5zdGFydHBvaW50KTtcbiAgICB0aGlzLnBvaW50cy5wdXNoKHRoaXMuZW5kcG9pbnQpO1xuXG4gICAgLy8gU2V0IGFzIGNvbm5lY3RlZFxuICAgIHRoaXMuc2V0U3RhdGUoQ09OU1RBTlRTLlBhdGhTdGF0ZUNvbm5lY3RlZCk7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuY3JlYXRlQ3VzdG9tUGF0aCA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLnBvaW50cy5zaGlmdCgpO1xuICAgIHRoaXMucG9pbnRzLnBvcCgpO1xuXG4gICAgdGhpcy5wb2ludHMudW5zaGlmdCh0aGlzLnN0YXJ0cG9pbnQpO1xuICAgIHRoaXMucG9pbnRzLnB1c2godGhpcy5lbmRwb2ludCk7XG5cbiAgICB0aGlzLnNldFN0YXRlKENPTlNUQU5UUy5QYXRoU3RhdGVDb25uZWN0ZWQpO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLnJlbW92ZVBhdGhDdXN0b21pemF0aW9ucyA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmN1c3RvbVBhdGhEYXRhID0gW107XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuYXJlVGhlcmVQYXRoQ3VzdG9taXphdGlvbnMgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY3VzdG9tUGF0aERhdGEubGVuZ3RoICE9PSAwO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmlzQXV0b1JvdXRlZCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5pc0F1dG9Sb3V0aW5nT247XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuc2V0QXV0b1JvdXRpbmcgPSBmdW5jdGlvbiAoYXJTdGF0ZSkge1xuICAgIHRoaXMuaXNBdXRvUm91dGluZ09uID0gYXJTdGF0ZTtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLnN0YXJ0cG9pbnQpIHtcbiAgICAgICAgdGhpcy5zdGFydHBvcnQucmVtb3ZlUG9pbnQodGhpcy5zdGFydHBvaW50KTtcbiAgICB9XG4gICAgaWYgKHRoaXMuZW5kcG9pbnQpIHtcbiAgICAgICAgdGhpcy5lbmRwb3J0LnJlbW92ZVBvaW50KHRoaXMuZW5kcG9pbnQpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5hc3NlcnRWYWxpZCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgaTtcblxuICAgIGFzc2VydCh0aGlzLnN0YXJ0cG9ydHMubGVuZ3RoID4gMCwgJ1BhdGggaGFzIG5vIHN0YXJ0cG9ydHMhJyk7XG4gICAgYXNzZXJ0KHRoaXMuZW5kcG9ydHMubGVuZ3RoID4gMCwgJ1BhdGggaGFzIG5vIGVuZHBvcnRzIScpO1xuXG4gICAgZm9yIChpID0gdGhpcy5zdGFydHBvcnRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICB0aGlzLnN0YXJ0cG9ydHNbaV0uYXNzZXJ0VmFsaWQoKTtcbiAgICB9XG5cbiAgICBmb3IgKGkgPSB0aGlzLmVuZHBvcnRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICB0aGlzLmVuZHBvcnRzW2ldLmFzc2VydFZhbGlkKCk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuaXNBdXRvUm91dGVkKCkpIHtcbiAgICAgICAgaWYgKHRoaXMuaXNDb25uZWN0ZWQoKSkge1xuICAgICAgICAgICAgYXNzZXJ0KHRoaXMucG9pbnRzLmxlbmd0aCAhPT0gMCxcbiAgICAgICAgICAgICAgICAnQVJQYXRoLmFzc2VydFZhbGlkOiB0aGlzLnBvaW50cy5sZW5ndGggIT09IDAgRkFJTEVEJyk7XG4gICAgICAgICAgICB2YXIgcG9pbnRzID0gdGhpcy5nZXRQb2ludExpc3QoKTtcbiAgICAgICAgICAgIHBvaW50cy5hc3NlcnRWYWxpZCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gSWYgaXQgaGFzIGEgc3RhcnRwb2ludCwgbXVzdCBhbHNvIGhhdmUgYSBzdGFydHBvcnRcbiAgICBpZiAodGhpcy5zdGFydHBvaW50KSB7XG4gICAgICAgIGFzc2VydCh0aGlzLnN0YXJ0cG9ydCwgJ1BhdGggaGFzIGEgc3RhcnRwb2ludCB3aXRob3V0IGEgc3RhcnRwb3J0Jyk7XG4gICAgfVxuICAgIGlmICh0aGlzLmVuZHBvaW50KSB7XG4gICAgICAgIGFzc2VydCh0aGlzLmVuZHBvcnQsICdQYXRoIGhhcyBhIGVuZHBvaW50IHdpdGhvdXQgYSBlbmRwb3J0Jyk7XG4gICAgfVxuXG4gICAgYXNzZXJ0KHRoaXMub3duZXIsICdQYXRoIGRvZXMgbm90IGhhdmUgb3duZXIhJyk7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuYXNzZXJ0VmFsaWRQb2ludHMgPSBmdW5jdGlvbiAoKSB7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEF1dG9Sb3V0ZXJQYXRoO1xuIiwiLypnbG9iYWxzIGRlZmluZSovXG4vKmpzaGludCBicm93c2VyOiB0cnVlLCBiaXR3aXNlOiBmYWxzZSovXG5cbi8qKlxuICogQGF1dGhvciBicm9sbGIgLyBodHRwczovL2dpdGh1Yi9icm9sbGJcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBBclNpemUgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuU2l6ZScpO1xuXG52YXIgQXJQb2ludCA9IGZ1bmN0aW9uICh4LCB5KSB7XG4gICAgLy8gTXVsdGlwbGUgQ29uc3RydWN0b3JzXG4gICAgaWYgKHggPT09IHVuZGVmaW5lZCkge1xuICAgICAgICB4ID0gMDtcbiAgICAgICAgeSA9IDA7XG4gICAgfSBlbHNlIGlmICh5ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgeSA9IHgueTtcbiAgICAgICAgeCA9IHgueDtcbiAgICB9XG5cbiAgICB0aGlzLnggPSB4O1xuICAgIHRoaXMueSA9IHk7XG59O1xuXG4vKipcbiAqIENoZWNrIGlmIHRoZSBwb2ludHMgaGF2ZSB0aGUgc2FtZSBjb29yZGluYXRlcy5cbiAqXG4gKiBAcGFyYW0ge0FyUG9pbnR9IG90aGVyUG9pbnRcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKi9cbkFyUG9pbnQucHJvdG90eXBlLmVxdWFscyA9IGZ1bmN0aW9uIChvdGhlclBvaW50KSB7XG4gICAgcmV0dXJuIHRoaXMueCA9PT0gb3RoZXJQb2ludC54ICYmIHRoaXMueSA9PT0gb3RoZXJQb2ludC55O1xufTtcblxuQXJQb2ludC5wcm90b3R5cGUuc2hpZnQgPSBmdW5jdGlvbiAob3RoZXJPYmplY3QpIHsgLy9lcXVpdmFsZW50IHRvICs9XG4gICAgdGhpcy54ICs9IG90aGVyT2JqZWN0LmR4O1xuICAgIHRoaXMueSArPSBvdGhlck9iamVjdC5keTtcblxuICAgIHJldHVybiB0aGlzO1xufTtcblxuQXJQb2ludC5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24gKG90aGVyT2JqZWN0KSB7IC8vZXF1aXZhbGVudCB0byArPVxuICAgIGlmIChvdGhlck9iamVjdCBpbnN0YW5jZW9mIEFyU2l6ZSkge1xuICAgICAgICB0aGlzLnggKz0gb3RoZXJPYmplY3QuY3g7XG4gICAgICAgIHRoaXMueSArPSBvdGhlck9iamVjdC5jeTtcbiAgICB9IGVsc2UgaWYgKG90aGVyT2JqZWN0IGluc3RhbmNlb2YgQXJQb2ludCkge1xuICAgICAgICB0aGlzLnggKz0gb3RoZXJPYmplY3QueDtcbiAgICAgICAgdGhpcy55ICs9IG90aGVyT2JqZWN0Lnk7XG4gICAgfVxufTtcblxuQXJQb2ludC5wcm90b3R5cGUuc3VidHJhY3QgPSBmdW5jdGlvbiAob3RoZXJPYmplY3QpIHsgLy9lcXVpdmFsZW50IHRvICs9XG4gICAgaWYgKG90aGVyT2JqZWN0IGluc3RhbmNlb2YgQXJTaXplKSB7XG4gICAgICAgIHRoaXMueCAtPSBvdGhlck9iamVjdC5jeDtcbiAgICAgICAgdGhpcy55IC09IG90aGVyT2JqZWN0LmN5O1xuICAgIH0gZWxzZSBpZiAob3RoZXJPYmplY3QgaW5zdGFuY2VvZiBBclBvaW50KSB7XG4gICAgICAgIHRoaXMueCAtPSBvdGhlck9iamVjdC54O1xuICAgICAgICB0aGlzLnkgLT0gb3RoZXJPYmplY3QueTtcbiAgICB9XG59O1xuXG5BclBvaW50LnByb3RvdHlwZS5wbHVzID0gZnVuY3Rpb24gKG90aGVyT2JqZWN0KSB7IC8vZXF1aXZhbGVudCB0byArXG4gICAgdmFyIG9iamVjdENvcHkgPSBudWxsO1xuXG4gICAgaWYgKG90aGVyT2JqZWN0IGluc3RhbmNlb2YgQXJTaXplKSB7XG4gICAgICAgIG9iamVjdENvcHkgPSBuZXcgQXJQb2ludCh0aGlzKTtcbiAgICAgICAgb2JqZWN0Q29weS5hZGQob3RoZXJPYmplY3QpO1xuXG4gICAgfSBlbHNlIGlmIChvdGhlck9iamVjdCBpbnN0YW5jZW9mIEFyUG9pbnQpIHtcbiAgICAgICAgb2JqZWN0Q29weSA9IG5ldyBBclBvaW50KG90aGVyT2JqZWN0KTtcbiAgICAgICAgb2JqZWN0Q29weS54ICs9IHRoaXMueDtcbiAgICAgICAgb2JqZWN0Q29weS55ICs9IHRoaXMueTtcbiAgICB9XG4gICAgcmV0dXJuIG9iamVjdENvcHkgfHwgdW5kZWZpbmVkO1xufTtcblxuQXJQb2ludC5wcm90b3R5cGUubWludXMgPSBmdW5jdGlvbiAob3RoZXJPYmplY3QpIHtcbiAgICB2YXIgb2JqZWN0Q29weSA9IG5ldyBBclBvaW50KG90aGVyT2JqZWN0KTtcblxuICAgIGlmIChvdGhlck9iamVjdC5jeCAhPT0gdW5kZWZpbmVkICYmIG90aGVyT2JqZWN0LmN5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgb2JqZWN0Q29weS5zdWJ0cmFjdCh0aGlzKTtcblxuICAgIH0gZWxzZSBpZiAob3RoZXJPYmplY3QueCAhPT0gdW5kZWZpbmVkICYmIG90aGVyT2JqZWN0LnkgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBvYmplY3RDb3B5ID0gbmV3IEFyU2l6ZSgpO1xuICAgICAgICBvYmplY3RDb3B5LmN4ID0gdGhpcy54IC0gb3RoZXJPYmplY3QueDtcbiAgICAgICAgb2JqZWN0Q29weS5jeSA9IHRoaXMueSAtIG90aGVyT2JqZWN0Lnk7XG5cbiAgICB9XG4gICAgcmV0dXJuIG9iamVjdENvcHk7XG59O1xuXG5BclBvaW50LnByb3RvdHlwZS5hc3NpZ24gPSBmdW5jdGlvbiAob3RoZXJQb2ludCkge1xuICAgIHRoaXMueCA9IG90aGVyUG9pbnQueDtcbiAgICB0aGlzLnkgPSBvdGhlclBvaW50Lnk7XG5cbiAgICByZXR1cm4gdGhpcztcbn07XG5cbkFyUG9pbnQucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiAnKCcgKyB0aGlzLnggKyAnLCAnICsgdGhpcy55ICsgJyknO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBclBvaW50O1xuIiwiLypqc2hpbnQgbm9kZTogdHJ1ZSwgYml0d2lzZTogZmFsc2UqL1xuXG4vKipcbiAqIEBhdXRob3IgYnJvbGxiIC8gaHR0cHM6Ly9naXRodWIvYnJvbGxiXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgTG9nZ2VyID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLkxvZ2dlcicpLCAgLy8gRklYTUVcbiAgICBDT05TVEFOVFMgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuQ29uc3RhbnRzJyksXG4gICAgVXRpbHMgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuVXRpbHMnKSxcbiAgICBhc3NlcnQgPSBVdGlscy5hc3NlcnQsXG4gICAgX2xvZ2dlciA9IG5ldyBMb2dnZXIoJ0F1dG9Sb3V0ZXIuUG9pbnRMaXN0Jyk7XG5cbnZhciBBclBvaW50TGlzdFBhdGggPSBmdW5jdGlvbiAoKSB7XG4gICAgZm9yICh2YXIgaSA9IGFyZ3VtZW50cy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgdGhpcy51bnNoaWZ0KGFyZ3VtZW50c1tpXSk7XG4gICAgfVxufTtcblxuQXJQb2ludExpc3RQYXRoLnByb3RvdHlwZSA9IFtdO1xuXG4vLyBXcmFwcGVyIEZ1bmN0aW9uc1xuQXJQb2ludExpc3RQYXRoLnByb3RvdHlwZS5jb25jYXQgPSBmdW5jdGlvbiAobGlzdCkge1xuICAgIHZhciBuZXdQb2ludHMgPSBuZXcgQXJQb2ludExpc3RQYXRoKCksXG4gICAgICAgIGk7XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBuZXdQb2ludHMucHVzaCh0aGlzW2ldKTtcbiAgICB9XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgICBuZXdQb2ludHMucHVzaChsaXN0W2ldKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ld1BvaW50cztcbn07XG5cbi8vIEZ1bmN0aW9uc1xuXG5BclBvaW50TGlzdFBhdGgucHJvdG90eXBlLmVuZCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpc1t0aGlzLmxlbmd0aCAtIDFdO1xufTtcblxuQXJQb2ludExpc3RQYXRoLnByb3RvdHlwZS5nZXRUYWlsRWRnZSA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodGhpcy5sZW5ndGggPCAyKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmxlbmd0aDtcbiAgICB9XG5cbiAgICB2YXIgcG9zID0gdGhpcy5sZW5ndGggLSAxLFxuICAgICAgICBlbmQgPSB0aGlzW3Bvcy0tXSxcbiAgICAgICAgc3RhcnQgPSB0aGlzW3Bvc107XG5cbiAgICByZXR1cm4geydwb3MnOiBwb3MsICdzdGFydCc6IHN0YXJ0LCAnZW5kJzogZW5kfTtcbn07XG5cbkFyUG9pbnRMaXN0UGF0aC5wcm90b3R5cGUuZ2V0UHJldkVkZ2UgPSBmdW5jdGlvbiAocG9zLCBzdGFydCwgZW5kKSB7XG4gICAgaWYgKENPTlNUQU5UUy5ERUJVRykge1xuICAgICAgICB0aGlzLkFzc2VydFZhbGlkUG9zKHBvcyk7XG4gICAgfVxuXG4gICAgZW5kID0gdGhpc1twb3MtLV07XG4gICAgaWYgKHBvcyAhPT0gdGhpcy5sZW5ndGgpIHtcbiAgICAgICAgc3RhcnQgPSB0aGlzW3Bvc107XG4gICAgfVxuXG4gICAgcmV0dXJuIHsncG9zJzogcG9zLCAnc3RhcnQnOiBzdGFydCwgJ2VuZCc6IGVuZH07XG59O1xuXG5BclBvaW50TGlzdFBhdGgucHJvdG90eXBlLmdldEVkZ2UgPSBmdW5jdGlvbiAocG9zLCBzdGFydCwgZW5kKSB7XG4gICAgaWYgKENPTlNUQU5UUy5ERUJVRykge1xuICAgICAgICB0aGlzLkFzc2VydFZhbGlkUG9zKHBvcyk7XG4gICAgfVxuXG4gICAgc3RhcnQgPSB0aGlzW3BvcysrXTtcbiAgICBhc3NlcnQocG9zIDwgdGhpcy5sZW5ndGgsICdBclBvaW50TGlzdFBhdGguZ2V0RWRnZTogcG9zIDwgdGhpcy5sZW5ndGggRkFJTEVEJyk7XG5cbiAgICBlbmQgPSB0aGlzW3Bvc107XG59O1xuXG5BclBvaW50TGlzdFBhdGgucHJvdG90eXBlLmdldFRhaWxFZGdlUHRycyA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgcG9zID0gdGhpcy5sZW5ndGgsXG4gICAgICAgIHN0YXJ0LFxuICAgICAgICBlbmQ7XG5cbiAgICBpZiAodGhpcy5sZW5ndGggPCAyKSB7XG4gICAgICAgIHJldHVybiB7J3Bvcyc6IHBvc307XG4gICAgfVxuXG4gICAgYXNzZXJ0KC0tcG9zIDwgdGhpcy5sZW5ndGgsICdBclBvaW50TGlzdFBhdGguZ2V0VGFpbEVkZ2VQdHJzOiAtLXBvcyA8IHRoaXMubGVuZ3RoIEZBSUxFRCcpO1xuXG4gICAgZW5kID0gdGhpc1twb3MtLV07XG4gICAgYXNzZXJ0KHBvcyA8IHRoaXMubGVuZ3RoLCAnQXJQb2ludExpc3RQYXRoLmdldFRhaWxFZGdlUHRyczogcG9zIDwgdGhpcy5sZW5ndGggRkFJTEVEJyk7XG5cbiAgICBzdGFydCA9IHRoaXNbcG9zXTtcblxuICAgIHJldHVybiB7J3Bvcyc6IHBvcywgJ3N0YXJ0Jzogc3RhcnQsICdlbmQnOiBlbmR9O1xufTtcblxuQXJQb2ludExpc3RQYXRoLnByb3RvdHlwZS5nZXRQcmV2RWRnZVB0cnMgPSBmdW5jdGlvbiAocG9zKSB7XG4gICAgdmFyIHN0YXJ0LFxuICAgICAgICBlbmQ7XG5cbiAgICBpZiAoQ09OU1RBTlRTLkRFQlVHKSB7XG4gICAgICAgIHRoaXMuQXNzZXJ0VmFsaWRQb3MocG9zKTtcbiAgICB9XG5cbiAgICBlbmQgPSB0aGlzW3Bvc107XG5cbiAgICBpZiAocG9zLS0gPiAwKSB7XG4gICAgICAgIHN0YXJ0ID0gdGhpc1twb3NdO1xuICAgIH1cblxuICAgIHJldHVybiB7cG9zOiBwb3MsIHN0YXJ0OiBzdGFydCwgZW5kOiBlbmR9O1xufTtcblxuQXJQb2ludExpc3RQYXRoLnByb3RvdHlwZS5nZXRTdGFydFBvaW50ID0gZnVuY3Rpb24gKHBvcykge1xuICAgIGlmIChDT05TVEFOVFMuREVCVUcpIHtcbiAgICAgICAgdGhpcy5Bc3NlcnRWYWxpZFBvcyhwb3MpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzW3Bvc107XG59O1xuXG5BclBvaW50TGlzdFBhdGgucHJvdG90eXBlLmdldEVuZFBvaW50ID0gZnVuY3Rpb24gKHBvcykge1xuICAgIGlmIChDT05TVEFOVFMuREVCVUcpIHtcbiAgICAgICAgdGhpcy5Bc3NlcnRWYWxpZFBvcyhwb3MpO1xuICAgIH1cblxuICAgIHBvcysrO1xuICAgIGFzc2VydChwb3MgPCB0aGlzLmxlbmd0aCxcbiAgICAgICAgJ0FyUG9pbnRMaXN0UGF0aC5nZXRFbmRQb2ludDogcG9zIDwgdGhpcy5sZW5ndGggRkFJTEVEJyk7XG5cbiAgICByZXR1cm4gdGhpc1twb3NdO1xufTtcblxuQXJQb2ludExpc3RQYXRoLnByb3RvdHlwZS5nZXRQb2ludEJlZm9yZUVkZ2UgPSBmdW5jdGlvbiAocG9zKSB7XG4gICAgaWYgKENPTlNUQU5UUy5ERUJVRykge1xuICAgICAgICB0aGlzLkFzc2VydFZhbGlkUG9zKHBvcyk7XG4gICAgfVxuXG4gICAgcG9zLS07XG4gICAgaWYgKHBvcyA9PT0gdGhpcy5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXNbcG9zXTtcbn07XG5cbkFyUG9pbnRMaXN0UGF0aC5wcm90b3R5cGUuZ2V0UG9pbnRBZnRlckVkZ2UgPSBmdW5jdGlvbiAocG9zKSB7XG4gICAgaWYgKENPTlNUQU5UUy5ERUJVRykge1xuICAgICAgICB0aGlzLkFzc2VydFZhbGlkUG9zKHBvcyk7XG4gICAgfVxuXG4gICAgcG9zKys7XG4gICAgYXNzZXJ0KHBvcyA8IHRoaXMubGVuZ3RoLFxuICAgICAgICAnQXJQb2ludExpc3RQYXRoLmdldFBvaW50QWZ0ZXJFZGdlOiBwb3MgPCB0aGlzLmxlbmd0aCBGQUlMRUQnKTtcblxuICAgIHBvcysrO1xuICAgIGlmIChwb3MgPT09IHRoaXMubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzW3Bvc107XG59O1xuXG5BclBvaW50TGlzdFBhdGgucHJvdG90eXBlLmFzc2VydFZhbGlkID0gZnVuY3Rpb24gKG1zZykge1xuICAgIC8vIENoZWNrIHRvIG1ha2Ugc3VyZSBlYWNoIHBvaW50IG1ha2VzIGEgaG9yaXpvbnRhbC92ZXJ0aWNhbCBsaW5lIHdpdGggaXQncyBuZWlnaGJvcnNcbiAgICBtc2cgPSBtc2cgfHwgJyc7XG4gICAgZm9yICh2YXIgaSA9IHRoaXMubGVuZ3RoIC0gMTsgaSA+IDA7IGktLSkge1xuICAgICAgICBhc3NlcnQoISF0aGlzW2ldLm1pbnVzLCAnQmFkIHZhbHVlIGF0IHBvc2l0aW9uICcgKyBpICsgJyAoJyArIFV0aWxzLnN0cmluZ2lmeSh0aGlzW2ldKSArICcpJyk7XG4gICAgICAgIGFzc2VydCghIXRoaXNbaSAtIDFdLm1pbnVzLCAnQmFkIHZhbHVlIGF0IHBvc2l0aW9uICcgKyAoaSAtIDEpICsgJyAoJyArIFV0aWxzLnN0cmluZ2lmeSh0aGlzW2kgLSAxXSkgKyAnKScpO1xuXG4gICAgICAgIGFzc2VydChVdGlscy5pc1JpZ2h0QW5nbGUoVXRpbHMuZ2V0RGlyKHRoaXNbaSAtIDFdLm1pbnVzKHRoaXNbaV0pKSksXG4gICAgICAgICAgICBtc2cgKyAnXFxuXFx0QXJQb2ludExpc3RQYXRoIGNvbnRhaW5zIHNrZXcgZWRnZTpcXG4nICsgVXRpbHMuc3RyaW5naWZ5KHRoaXMpKTtcbiAgICB9XG59O1xuXG5BclBvaW50TGlzdFBhdGgucHJvdG90eXBlLmFzc2VydFZhbGlkUG9zID0gZnVuY3Rpb24gKHBvcykge1xuICAgIGFzc2VydChwb3MgPCB0aGlzLmxlbmd0aCwgJ0FyUG9pbnRMaXN0UGF0aC5hc3NlcnRWYWxpZFBvczogcG9zIDwgdGhpcy5sZW5ndGggRkFJTEVEJyk7XG59O1xuXG5BclBvaW50TGlzdFBhdGgucHJvdG90eXBlLmR1bXBQb2ludHMgPSBmdW5jdGlvbiAobXNnKSB7XG4gICAgbXNnICs9ICcsIHBvaW50cyBkdW1wIGJlZ2luOlxcbic7XG4gICAgdmFyIHBvcyA9IDAsXG4gICAgICAgIGkgPSAwLFxuICAgICAgICBwO1xuICAgIHdoaWxlIChwb3MgPCB0aGlzLmxlbmd0aCkge1xuICAgICAgICBwID0gdGhpc1twb3MrK107XG4gICAgICAgIG1zZyArPSBpICsgJy46ICgnICsgcC54ICsgJywgJyArIHAueSArICcpXFxuJztcbiAgICAgICAgaSsrO1xuICAgIH1cbiAgICBtc2cgKz0gJ3BvaW50cyBkdW1wIGVuZC4nO1xuICAgIF9sb2dnZXIuZGVidWcobXNnKTtcbiAgICByZXR1cm4gbXNnO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBclBvaW50TGlzdFBhdGg7XG5cbiIsIi8qanNoaW50IG5vZGU6IHRydWUsIGJpdHdpc2U6IGZhbHNlKi9cblxuLyoqXG4gKiBAYXV0aG9yIGJyb2xsYiAvIGh0dHBzOi8vZ2l0aHViL2Jyb2xsYlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIENPTlNUQU5UUyA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Db25zdGFudHMnKSxcbiAgICBVdGlscyA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5VdGlscycpLFxuICAgIGFzc2VydCA9IFV0aWxzLmFzc2VydCxcbiAgICBBclBvaW50ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlBvaW50JyksXG4gICAgQXJTaXplID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlNpemUnKSxcbiAgICBBclJlY3QgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUmVjdCcpO1xuXG52YXIgQXV0b1JvdXRlclBvcnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5pZCA9IG51bGw7XG4gICAgdGhpcy5vd25lciA9IG51bGw7XG4gICAgdGhpcy5saW1pdGVkRGlyZWN0aW9ucyA9IHRydWU7XG4gICAgdGhpcy5yZWN0ID0gbmV3IEFyUmVjdCgpO1xuICAgIHRoaXMuYXR0cmlidXRlcyA9IENPTlNUQU5UUy5Qb3J0RGVmYXVsdDtcblxuICAgIC8vIEZvciB0aGlzLnBvaW50cyBvbiBDT05TVEFOVFMuRGlyVG9wLCBDT05TVEFOVFMuRGlyTGVmdCwgQ09OU1RBTlRTLkRpclJpZ2h0LCBldGNcbiAgICB0aGlzLnBvaW50cyA9IFtbXSwgW10sIFtdLCBbXV07XG4gICAgdGhpcy5zZWxmUG9pbnRzID0gW107XG4gICAgdGhpcy5hdmFpbGFibGVBcmVhID0gW107ICAvLyBhdmFpbGFibGVBcmVhcyBrZWVwcyB0cmFjayBvZiB2aXNpYmxlIChub3Qgb3ZlcmxhcHBlZCkgcG9ydGlvbnMgb2YgdGhlIHBvcnRcblxuICAgIHRoaXMuY2FsY3VsYXRlU2VsZlBvaW50cygpO1xufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLmNhbGN1bGF0ZVNlbGZQb2ludHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5zZWxmUG9pbnRzID0gW107XG4gICAgdGhpcy5zZWxmUG9pbnRzLnB1c2gobmV3IEFyUG9pbnQodGhpcy5yZWN0LmdldFRvcExlZnQoKSkpO1xuXG4gICAgdGhpcy5zZWxmUG9pbnRzLnB1c2gobmV3IEFyUG9pbnQodGhpcy5yZWN0LnJpZ2h0LCB0aGlzLnJlY3QuY2VpbCkpO1xuICAgIHRoaXMuc2VsZlBvaW50cy5wdXNoKG5ldyBBclBvaW50KHRoaXMucmVjdC5yaWdodCwgdGhpcy5yZWN0LmZsb29yKSk7XG4gICAgdGhpcy5zZWxmUG9pbnRzLnB1c2gobmV3IEFyUG9pbnQodGhpcy5yZWN0LmxlZnQsIHRoaXMucmVjdC5mbG9vcikpO1xuICAgIHRoaXMucmVzZXRBdmFpbGFibGVBcmVhKCk7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuaGFzT3duZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMub3duZXIgIT09IG51bGw7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuaXNSZWN0RW1wdHkgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMucmVjdC5pc1JlY3RFbXB0eSgpO1xufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLmdldENlbnRlciA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5yZWN0LmdldENlbnRlclBvaW50KCk7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuc2V0UmVjdCA9IGZ1bmN0aW9uIChyKSB7XG4gICAgYXNzZXJ0KHIuZ2V0V2lkdGgoKSA+PSAzICYmIHIuZ2V0SGVpZ2h0KCkgPj0gMyxcbiAgICAgICAgJ0FSUG9ydC5zZXRSZWN0OiByLmdldFdpZHRoKCkgPj0gMyAmJiByLmdldEhlaWdodCgpID49IDMgRkFJTEVEIScpO1xuXG4gICAgdGhpcy5yZWN0LmFzc2lnbihyKTtcbiAgICB0aGlzLmNhbGN1bGF0ZVNlbGZQb2ludHMoKTtcbiAgICB0aGlzLnJlc2V0QXZhaWxhYmxlQXJlYSgpO1xufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLnNoaWZ0QnkgPSBmdW5jdGlvbiAob2Zmc2V0KSB7XG4gICAgYXNzZXJ0KCF0aGlzLnJlY3QuaXNSZWN0RW1wdHkoKSwgJ0FSUG9ydC5zaGlmdEJ5OiAhdGhpcy5yZWN0LmlzUmVjdEVtcHR5KCkgRkFJTEVEIScpO1xuXG4gICAgdGhpcy5yZWN0LmFkZChvZmZzZXQpO1xuXG4gICAgdGhpcy5jYWxjdWxhdGVTZWxmUG9pbnRzKCk7XG4gICAgLy8gU2hpZnQgcG9pbnRzXG4gICAgdGhpcy5zaGlmdFBvaW50cyhvZmZzZXQpO1xufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLmlzQ29ubmVjdFRvQ2VudGVyID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiAodGhpcy5hdHRyaWJ1dGVzICYgQ09OU1RBTlRTLlBvcnRDb25uZWN0VG9DZW50ZXIpICE9PSAwO1xufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLmhhc0xpbWl0ZWREaXJzID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmxpbWl0ZWREaXJlY3Rpb25zO1xufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLnNldExpbWl0ZWREaXJzID0gZnVuY3Rpb24gKGx0ZCkge1xuICAgIHRoaXMubGltaXRlZERpcmVjdGlvbnMgPSBsdGQ7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUucG9ydE9uV2hpY2hFZGdlID0gZnVuY3Rpb24gKHBvaW50KSB7XG4gICAgcmV0dXJuIFV0aWxzLm9uV2hpY2hFZGdlKHRoaXMucmVjdCwgcG9pbnQpO1xufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLmNhbkhhdmVTdGFydEVuZFBvaW50T24gPSBmdW5jdGlvbiAoZGlyLCBpc1N0YXJ0KSB7XG4gICAgYXNzZXJ0KDAgPD0gZGlyICYmIGRpciA8PSAzLCAnQVJQb3J0LmNhbkhhdmVTdGFydEVuZFBvaW50T246IDAgPD0gZGlyICYmIGRpciA8PSAzIEZBSUxFRCEnKTtcblxuICAgIGlmIChpc1N0YXJ0KSB7XG4gICAgICAgIGRpciArPSA0O1xuICAgIH1cblxuICAgIHJldHVybiAoKHRoaXMuYXR0cmlidXRlcyAmICgxIDw8IGRpcikpICE9PSAwKTtcbn07XG5cbkF1dG9Sb3V0ZXJQb3J0LnByb3RvdHlwZS5jYW5IYXZlU3RhcnRFbmRQb2ludCA9IGZ1bmN0aW9uIChpc1N0YXJ0KSB7XG4gICAgcmV0dXJuICgodGhpcy5hdHRyaWJ1dGVzICYgKGlzU3RhcnQgPyBDT05TVEFOVFMuUG9ydFN0YXJ0T25BbGwgOiBDT05TVEFOVFMuUG9ydEVuZE9uQWxsKSkgIT09IDApO1xufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLmNhbkhhdmVTdGFydEVuZFBvaW50SG9yaXpvbnRhbCA9IGZ1bmN0aW9uIChpc0hvcml6b250YWwpIHtcbiAgICByZXR1cm4gKCh0aGlzLmF0dHJpYnV0ZXMgJlxuICAgIChpc0hvcml6b250YWwgPyBDT05TVEFOVFMuUG9ydFN0YXJ0RW5kSG9yaXpvbnRhbCA6IENPTlNUQU5UUy5Qb3J0U3RhcnRFbmRWZXJ0aWNhbCkpICE9PSAwKTtcbn07XG5cbkF1dG9Sb3V0ZXJQb3J0LnByb3RvdHlwZS5nZXRTdGFydEVuZERpclRvID0gZnVuY3Rpb24gKHBvaW50LCBpc1N0YXJ0LCBub3R0aGlzKSB7XG4gICAgYXNzZXJ0KCF0aGlzLnJlY3QuaXNSZWN0RW1wdHkoKSwgJ0FSUG9ydC5nZXRTdGFydEVuZERpclRvOiAhdGhpcy5yZWN0LmlzUmVjdEVtcHR5KCkgRkFJTEVEIScpO1xuXG4gICAgbm90dGhpcyA9IG5vdHRoaXMgPyBub3R0aGlzIDogQ09OU1RBTlRTLkRpck5vbmU7IC8vIGlmIG5vdHRoaXMgaXMgdW5kZWZpbmVkLCBzZXQgaXQgdG8gQ09OU1RBTlRTLkRpck5vbmUgKC0xKVxuXG4gICAgdmFyIG9mZnNldCA9IHBvaW50Lm1pbnVzKHRoaXMucmVjdC5nZXRDZW50ZXJQb2ludCgpKSxcbiAgICAgICAgZGlyMSA9IFV0aWxzLmdldE1ham9yRGlyKG9mZnNldCk7XG5cbiAgICBpZiAoZGlyMSAhPT0gbm90dGhpcyAmJiB0aGlzLmNhbkhhdmVTdGFydEVuZFBvaW50T24oZGlyMSwgaXNTdGFydCkpIHtcbiAgICAgICAgcmV0dXJuIGRpcjE7XG4gICAgfVxuXG4gICAgdmFyIGRpcjIgPSBVdGlscy5nZXRNaW5vckRpcihvZmZzZXQpO1xuXG4gICAgaWYgKGRpcjIgIT09IG5vdHRoaXMgJiYgdGhpcy5jYW5IYXZlU3RhcnRFbmRQb2ludE9uKGRpcjIsIGlzU3RhcnQpKSB7XG4gICAgICAgIHJldHVybiBkaXIyO1xuICAgIH1cblxuICAgIHZhciBkaXIzID0gVXRpbHMucmV2ZXJzZURpcihkaXIyKTtcblxuICAgIGlmIChkaXIzICE9PSBub3R0aGlzICYmIHRoaXMuY2FuSGF2ZVN0YXJ0RW5kUG9pbnRPbihkaXIzLCBpc1N0YXJ0KSkge1xuICAgICAgICByZXR1cm4gZGlyMztcbiAgICB9XG5cbiAgICB2YXIgZGlyNCA9IFV0aWxzLnJldmVyc2VEaXIoZGlyMSk7XG5cbiAgICBpZiAoZGlyNCAhPT0gbm90dGhpcyAmJiB0aGlzLmNhbkhhdmVTdGFydEVuZFBvaW50T24oZGlyNCwgaXNTdGFydCkpIHtcbiAgICAgICAgcmV0dXJuIGRpcjQ7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuY2FuSGF2ZVN0YXJ0RW5kUG9pbnRPbihkaXIxLCBpc1N0YXJ0KSkge1xuICAgICAgICByZXR1cm4gZGlyMTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5jYW5IYXZlU3RhcnRFbmRQb2ludE9uKGRpcjIsIGlzU3RhcnQpKSB7XG4gICAgICAgIHJldHVybiBkaXIyO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmNhbkhhdmVTdGFydEVuZFBvaW50T24oZGlyMywgaXNTdGFydCkpIHtcbiAgICAgICAgcmV0dXJuIGRpcjM7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuY2FuSGF2ZVN0YXJ0RW5kUG9pbnRPbihkaXI0LCBpc1N0YXJ0KSkge1xuICAgICAgICByZXR1cm4gZGlyNDtcbiAgICB9XG5cbiAgICByZXR1cm4gQ09OU1RBTlRTLkRpclRvcDtcbn07XG5cbkF1dG9Sb3V0ZXJQb3J0LnByb3RvdHlwZS5yb3VuZFRvSGFsZkdyaWQgPSBmdW5jdGlvbiAobGVmdCwgcmlnaHQpIHtcbiAgICB2YXIgYnR3biA9IChsZWZ0ICsgcmlnaHQpIC8gMjtcbiAgICBhc3NlcnQoYnR3biA8IE1hdGgubWF4KGxlZnQsIHJpZ2h0KSAmJiBidHduID4gTWF0aC5taW4obGVmdCwgcmlnaHQpLFxuICAgICAgICAncm91bmRUb0hhbGZHcmlkOiBidHduIHZhcmlhYmxlIG5vdCBiZXR3ZWVuIGxlZnQsIHJpZ2h0IHZhbHVlcy4gUGVyaGFwcyBib3gvY29ubmVjdGlvbkFyZWEgaXMgdG9vIHNtYWxsPycpO1xuICAgIHJldHVybiBidHduO1xufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLmNyZWF0ZVN0YXJ0RW5kUG9pbnRUbyA9IGZ1bmN0aW9uIChwb2ludCwgZGlyKSB7XG4gICAgLy8gY2FsY3VsYXRlIHBhdGhBbmdsZVxuICAgIHZhciBkeCA9IHBvaW50LnggLSB0aGlzLmdldENlbnRlcigpLngsXG4gICAgICAgIGR5ID0gcG9pbnQueSAtIHRoaXMuZ2V0Q2VudGVyKCkueSxcbiAgICAgICAgcGF0aEFuZ2xlID0gTWF0aC5hdGFuMigtZHksIGR4KSxcbiAgICAgICAgayA9IDAsXG4gICAgICAgIG1heFggPSB0aGlzLnJlY3QucmlnaHQsXG4gICAgICAgIG1heFkgPSB0aGlzLnJlY3QuZmxvb3IsXG4gICAgICAgIG1pblggPSB0aGlzLnJlY3QubGVmdCxcbiAgICAgICAgbWluWSA9IHRoaXMucmVjdC5jZWlsLFxuICAgICAgICByZXN1bHRQb2ludCxcbiAgICAgICAgc21hbGxlclB0ID0gbmV3IEFyUG9pbnQobWluWCwgbWluWSksICAvLyBUaGUgdGhpcy5wb2ludHMgdGhhdCB0aGUgcmVzdWx0UG9pbnQgaXMgY2VudGVyZWQgYmV0d2VlblxuICAgICAgICBsYXJnZXJQdCA9IG5ldyBBclBvaW50KG1heFgsIG1heFkpO1xuXG4gICAgLy8gRmluZCB0aGUgc21hbGxlciBhbmQgbGFyZ2VyIHBvaW50c1xuICAgIC8vIEFzIHRoZSBwb2ludHMgY2Fubm90IGJlIG9uIHRoZSBjb3JuZXIgb2YgYW4gZWRnZSAoYW1iaWd1b3VzIGRpcmVjdGlvbiksIFxuICAgIC8vIHdlIHdpbGwgc2hpZnQgdGhlIG1pbiwgbWF4IGluIG9uZSBwaXhlbFxuICAgIGlmIChVdGlscy5pc0hvcml6b250YWwoZGlyKSkgeyAgLy8gc2hpZnQgeCBjb29yZGluYXRlc1xuICAgICAgICBtaW5YKys7XG4gICAgICAgIG1heFgtLTtcbiAgICB9IGVsc2UgeyAvLyBzaGlmdCB5IGNvb3JkaW5hdGVzXG4gICAgICAgIG1pblkrKztcbiAgICAgICAgbWF4WS0tO1xuICAgIH1cblxuICAgIC8vIEFkanVzdCBhbmdsZSBiYXNlZCBvbiBwYXJ0IG9mIHBvcnQgdG8gd2hpY2ggaXQgaXMgY29ubmVjdGluZ1xuICAgIHN3aXRjaCAoZGlyKSB7XG5cbiAgICAgICAgY2FzZSBDT05TVEFOVFMuRGlyVG9wOlxuICAgICAgICAgICAgcGF0aEFuZ2xlID0gMiAqIE1hdGguUEkgLSAocGF0aEFuZ2xlICsgTWF0aC5QSSAvIDIpO1xuICAgICAgICAgICAgbGFyZ2VyUHQueSA9IHRoaXMucmVjdC5jZWlsO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSBDT05TVEFOVFMuRGlyUmlnaHQ6XG4gICAgICAgICAgICBwYXRoQW5nbGUgPSAyICogTWF0aC5QSSAtIHBhdGhBbmdsZTtcbiAgICAgICAgICAgIHNtYWxsZXJQdC54ID0gdGhpcy5yZWN0LnJpZ2h0O1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSBDT05TVEFOVFMuRGlyQm90dG9tOlxuICAgICAgICAgICAgcGF0aEFuZ2xlIC09IE1hdGguUEkgLyAyO1xuICAgICAgICAgICAgc21hbGxlclB0LnkgPSB0aGlzLnJlY3QuZmxvb3I7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlIENPTlNUQU5UUy5EaXJMZWZ0OlxuICAgICAgICAgICAgbGFyZ2VyUHQueCA9IHRoaXMucmVjdC5sZWZ0O1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgaWYgKHBhdGhBbmdsZSA8IDApIHtcbiAgICAgICAgcGF0aEFuZ2xlICs9IDIgKiBNYXRoLlBJO1xuICAgIH1cblxuICAgIHBhdGhBbmdsZSAqPSAxODAgLyBNYXRoLlBJOyAgLy8gVXNpbmcgZGVncmVlcyBmb3IgZWFzaWVyIGRlYnVnZ2luZ1xuXG4gICAgLy8gRmluZGluZyB0aGlzLnBvaW50cyBvcmRlcmluZ1xuICAgIHdoaWxlIChrIDwgdGhpcy5wb2ludHNbZGlyXS5sZW5ndGggJiYgcGF0aEFuZ2xlID4gdGhpcy5wb2ludHNbZGlyXVtrXS5wYXRoQW5nbGUpIHtcbiAgICAgICAgaysrO1xuICAgIH1cblxuICAgIGlmICh0aGlzLnBvaW50c1tkaXJdLmxlbmd0aCkge1xuICAgICAgICBpZiAoayA9PT0gMCkge1xuICAgICAgICAgICAgbGFyZ2VyUHQgPSBuZXcgQXJQb2ludCh0aGlzLnBvaW50c1tkaXJdW2tdKTtcblxuICAgICAgICB9IGVsc2UgaWYgKGsgIT09IHRoaXMucG9pbnRzW2Rpcl0ubGVuZ3RoKSB7XG4gICAgICAgICAgICBzbWFsbGVyUHQgPSBuZXcgQXJQb2ludCh0aGlzLnBvaW50c1tkaXJdW2sgLSAxXSk7XG4gICAgICAgICAgICBsYXJnZXJQdCA9IG5ldyBBclBvaW50KHRoaXMucG9pbnRzW2Rpcl1ba10pO1xuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzbWFsbGVyUHQgPSBuZXcgQXJQb2ludCh0aGlzLnBvaW50c1tkaXJdW2sgLSAxXSk7XG5cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlc3VsdFBvaW50ID0gbmV3IEFyUG9pbnQoKGxhcmdlclB0LnggKyBzbWFsbGVyUHQueCkgLyAyLCAobGFyZ2VyUHQueSArIHNtYWxsZXJQdC55KSAvIDIpO1xuICAgIHJlc3VsdFBvaW50LnBhdGhBbmdsZSA9IHBhdGhBbmdsZTtcblxuICAgIC8vIE1vdmUgdGhlIHBvaW50IG92ZXIgdG8gYW4gJ3RoaXMuYXZhaWxhYmxlQXJlYScgaWYgYXBwcm9wcmlhdGVcbiAgICB2YXIgaSA9IHRoaXMuYXZhaWxhYmxlQXJlYS5sZW5ndGgsXG4gICAgICAgIGNsb3Nlc3RBcmVhID0gMCxcbiAgICAgICAgZGlzdGFuY2UgPSBJbmZpbml0eSxcbiAgICAgICAgc3RhcnQsXG4gICAgICAgIGVuZDtcblxuICAgIC8vIEZpbmQgZGlzdGFuY2UgZnJvbSBlYWNoIHRoaXMuYXZhaWxhYmxlQXJlYSBhbmQgc3RvcmUgY2xvc2VzdCBpbmRleFxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgc3RhcnQgPSB0aGlzLmF2YWlsYWJsZUFyZWFbaV1bMF07XG4gICAgICAgIGVuZCA9IHRoaXMuYXZhaWxhYmxlQXJlYVtpXVsxXTtcblxuICAgICAgICBpZiAoVXRpbHMuaXNPbkVkZ2Uoc3RhcnQsIGVuZCwgcmVzdWx0UG9pbnQpKSB7XG4gICAgICAgICAgICBjbG9zZXN0QXJlYSA9IC0xO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH0gZWxzZSBpZiAoVXRpbHMuZGlzdGFuY2VGcm9tTGluZShyZXN1bHRQb2ludCwgc3RhcnQsIGVuZCkgPCBkaXN0YW5jZSkge1xuICAgICAgICAgICAgY2xvc2VzdEFyZWEgPSBpO1xuICAgICAgICAgICAgZGlzdGFuY2UgPSBVdGlscy5kaXN0YW5jZUZyb21MaW5lKHJlc3VsdFBvaW50LCBzdGFydCwgZW5kKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChjbG9zZXN0QXJlYSAhPT0gLTEgJiYgdGhpcy5pc0F2YWlsYWJsZSgpKSB7IC8vIHJlc3VsdFBvaW50IG5lZWRzIHRvIGJlIG1vdmVkIHRvIHRoZSBjbG9zZXN0IGF2YWlsYWJsZSBhcmVhXG4gICAgICAgIHZhciBkaXIyID0gVXRpbHMuZ2V0RGlyKHRoaXMuYXZhaWxhYmxlQXJlYVtjbG9zZXN0QXJlYV1bMF0ubWludXMocmVzdWx0UG9pbnQpKTtcblxuICAgICAgICBhc3NlcnQoVXRpbHMuaXNSaWdodEFuZ2xlKGRpcjIpLFxuICAgICAgICAgICAgJ0F1dG9Sb3V0ZXJQb3J0LmNyZWF0ZVN0YXJ0RW5kUG9pbnRUbzogVXRpbHMuaXNSaWdodEFuZ2xlKGRpcjIpIEZBSUxFRCcpO1xuXG4gICAgICAgIGlmIChkaXIyID09PSBDT05TVEFOVFMuRGlyTGVmdCB8fCBkaXIyID09PSBDT05TVEFOVFMuRGlyVG9wKSB7IC8vIFRoZW4gcmVzdWx0UG9pbnQgbXVzdCBiZSBtb3ZlZCB1cFxuICAgICAgICAgICAgbGFyZ2VyUHQgPSB0aGlzLmF2YWlsYWJsZUFyZWFbY2xvc2VzdEFyZWFdWzFdO1xuICAgICAgICB9IGVsc2UgeyAvLyBUaGVuIHJlc3VsdFBvaW50IG11c3QgYmUgbW92ZWQgZG93blxuICAgICAgICAgICAgc21hbGxlclB0ID0gdGhpcy5hdmFpbGFibGVBcmVhW2Nsb3Nlc3RBcmVhXVswXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlc3VsdFBvaW50ID0gbmV3IEFyUG9pbnQoKGxhcmdlclB0LnggKyBzbWFsbGVyUHQueCkgLyAyLCAobGFyZ2VyUHQueSArIHNtYWxsZXJQdC55KSAvIDIpO1xuICAgIH1cblxuICAgIHRoaXMucG9pbnRzW2Rpcl0uc3BsaWNlKGssIDAsIHJlc3VsdFBvaW50KTtcblxuICAgIGFzc2VydChVdGlscy5pc1JpZ2h0QW5nbGUodGhpcy5wb3J0T25XaGljaEVkZ2UocmVzdWx0UG9pbnQpKSxcbiAgICAgICAgJ0F1dG9Sb3V0ZXJQb3J0LmNyZWF0ZVN0YXJ0RW5kUG9pbnRUbzogVXRpbHMuaXNSaWdodEFuZ2xlKHRoaXMucG9ydE9uV2hpY2hFZGdlKHJlc3VsdFBvaW50KSkgRkFJTEVEJyk7XG5cbiAgICByZXR1cm4gcmVzdWx0UG9pbnQ7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUucmVtb3ZlUG9pbnQgPSBmdW5jdGlvbiAocHQpIHtcbiAgICB2YXIgcmVtb3ZlZDtcblxuICAgIHJlbW92ZWQgPSBVdGlscy5yZW1vdmVGcm9tQXJyYXlzLmFwcGx5KG51bGwsIFtwdF0uY29uY2F0KHRoaXMucG9pbnRzKSk7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuaGFzUG9pbnQgPSBmdW5jdGlvbiAocHQpIHtcbiAgICB2YXIgaSA9IDAsXG4gICAgICAgIGs7XG5cbiAgICB3aGlsZSAoaSA8IDQpIHsgLy9DaGVjayBhbGwgc2lkZXMgZm9yIHRoZSBwb2ludFxuICAgICAgICBrID0gdGhpcy5wb2ludHNbaV0uaW5kZXhPZihwdCk7XG5cbiAgICAgICAgaWYgKGsgPiAtMSkgeyAvL0lmIHRoZSBwb2ludCBpcyBvbiB0aGlzIHNpZGUgb2YgdGhlIHBvcnRcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGkrKztcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuc2hpZnRQb2ludHMgPSBmdW5jdGlvbiAoc2hpZnQpIHtcbiAgICBmb3IgKHZhciBzID0gdGhpcy5wb2ludHMubGVuZ3RoOyBzLS07KSB7XG4gICAgICAgIGZvciAodmFyIGkgPSB0aGlzLnBvaW50c1tzXS5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgICAgIC8vIFNoaWZ0IHRoaXMgcG9pbnRcbiAgICAgICAgICAgIHRoaXMucG9pbnRzW3NdW2ldLmFkZChzaGlmdCk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuZ2V0UG9pbnRDb3VudCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgaSA9IDAsXG4gICAgICAgIGNvdW50ID0gMDtcblxuICAgIHdoaWxlIChpIDwgNCkgeyAvLyBDaGVjayBhbGwgc2lkZXMgZm9yIHRoZSBwb2ludFxuICAgICAgICBjb3VudCArPSB0aGlzLnBvaW50c1tpKytdLmxlbmd0aDtcbiAgICB9XG5cbiAgICByZXR1cm4gY291bnQ7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUucmVzZXRBdmFpbGFibGVBcmVhID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuYXZhaWxhYmxlQXJlYSA9IFtdO1xuXG4gICAgaWYgKHRoaXMuY2FuSGF2ZVN0YXJ0RW5kUG9pbnRPbihDT05TVEFOVFMuRGlyVG9wKSkge1xuICAgICAgICB0aGlzLmF2YWlsYWJsZUFyZWEucHVzaChbdGhpcy5yZWN0LmdldFRvcExlZnQoKSwgbmV3IEFyUG9pbnQodGhpcy5yZWN0LnJpZ2h0LCB0aGlzLnJlY3QuY2VpbCldKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5jYW5IYXZlU3RhcnRFbmRQb2ludE9uKENPTlNUQU5UUy5EaXJSaWdodCkpIHtcbiAgICAgICAgdGhpcy5hdmFpbGFibGVBcmVhLnB1c2goW25ldyBBclBvaW50KHRoaXMucmVjdC5yaWdodCwgdGhpcy5yZWN0LmNlaWwpLCB0aGlzLnJlY3QuZ2V0Qm90dG9tUmlnaHQoKV0pO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmNhbkhhdmVTdGFydEVuZFBvaW50T24oQ09OU1RBTlRTLkRpckJvdHRvbSkpIHtcbiAgICAgICAgdGhpcy5hdmFpbGFibGVBcmVhLnB1c2goW25ldyBBclBvaW50KHRoaXMucmVjdC5sZWZ0LCB0aGlzLnJlY3QuZmxvb3IpLCB0aGlzLnJlY3QuZ2V0Qm90dG9tUmlnaHQoKV0pO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmNhbkhhdmVTdGFydEVuZFBvaW50T24oQ09OU1RBTlRTLkRpckxlZnQpKSB7XG4gICAgICAgIHRoaXMuYXZhaWxhYmxlQXJlYS5wdXNoKFt0aGlzLnJlY3QuZ2V0VG9wTGVmdCgpLCBuZXcgQXJQb2ludCh0aGlzLnJlY3QubGVmdCwgdGhpcy5yZWN0LmZsb29yKV0pO1xuICAgIH1cblxufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLmFkanVzdEF2YWlsYWJsZUFyZWEgPSBmdW5jdGlvbiAocikge1xuICAgIC8vRm9yIGFsbCBsaW5lcyBzcGVjaWZpZWQgaW4gYXZhaWxhYmxlQXJlYXMsIGNoZWNrIGlmIHRoZSBsaW5lIFV0aWxzLmludGVyc2VjdCBzIHRoZSByZWN0YW5nbGVcbiAgICAvL0lmIGl0IGRvZXMsIHJlbW92ZSB0aGUgcGFydCBvZiB0aGUgbGluZSB0aGF0IFV0aWxzLmludGVyc2VjdCBzIHRoZSByZWN0YW5nbGVcbiAgICBpZiAoIXRoaXMucmVjdC50b3VjaGluZyhyKSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGkgPSB0aGlzLmF2YWlsYWJsZUFyZWEubGVuZ3RoLFxuICAgICAgICBpbnRlcnNlY3Rpb24sXG4gICAgICAgIGxpbmU7XG5cbiAgICB3aGlsZSAoaS0tKSB7XG5cbiAgICAgICAgaWYgKFV0aWxzLmlzTGluZUNsaXBSZWN0KHRoaXMuYXZhaWxhYmxlQXJlYVtpXVswXSwgdGhpcy5hdmFpbGFibGVBcmVhW2ldWzFdLCByKSkge1xuICAgICAgICAgICAgbGluZSA9IHRoaXMuYXZhaWxhYmxlQXJlYS5zcGxpY2UoaSwgMSlbMF07XG4gICAgICAgICAgICBpbnRlcnNlY3Rpb24gPSBVdGlscy5nZXRMaW5lQ2xpcFJlY3RJbnRlcnNlY3QobGluZVswXSwgbGluZVsxXSwgcik7XG5cbiAgICAgICAgICAgIGlmICghaW50ZXJzZWN0aW9uWzBdLmVxdWFscyhsaW5lWzBdKSkge1xuICAgICAgICAgICAgICAgIHRoaXMuYXZhaWxhYmxlQXJlYS5wdXNoKFtsaW5lWzBdLCBpbnRlcnNlY3Rpb25bMF1dKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFpbnRlcnNlY3Rpb25bMV0uZXF1YWxzKGxpbmVbMV0pKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hdmFpbGFibGVBcmVhLnB1c2goW2ludGVyc2VjdGlvblsxXSwgbGluZVsxXV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLmdldFRvdGFsQXZhaWxhYmxlQXJlYSA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgaSA9IHRoaXMuYXZhaWxhYmxlQXJlYS5sZW5ndGgsXG4gICAgICAgIGxlbmd0aCA9IG5ldyBBclNpemUoKTtcblxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgbGVuZ3RoLmFkZCh0aGlzLmF2YWlsYWJsZUFyZWFbaV1bMV0ubWludXModGhpcy5hdmFpbGFibGVBcmVhW2ldWzBdKSk7XG4gICAgfVxuXG4gICAgYXNzZXJ0KGxlbmd0aC5jeCA9PT0gMCB8fCBsZW5ndGguY3kgPT09IDAsXG4gICAgICAgICdBUlBvcnQuZ2V0VG90YWxBdmFpbGFibGVBcmVhOiBsZW5ndGhbMF0gPT09IDAgfHwgbGVuZ3RoWzFdID09PSAwIEZBSUxFRCcpO1xuICAgIHJldHVybiBsZW5ndGguY3ggfHwgbGVuZ3RoLmN5O1xufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLmlzQXZhaWxhYmxlID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmF2YWlsYWJsZUFyZWEubGVuZ3RoID4gMDtcbn07XG5cbkF1dG9Sb3V0ZXJQb3J0LnByb3RvdHlwZS5hc3NlcnRWYWxpZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAvLyBDaGVjayB0aGF0IGFsbCBwb2ludHMgYXJlIG9uIGEgc2lkZSBvZiB0aGUgcG9ydFxuICAgIHZhciBwb2ludDtcblxuICAgIGFzc2VydCh0aGlzLm93bmVyLCAnUG9ydCAnICsgdGhpcy5pZCArICcgZG9lcyBub3QgaGF2ZSB2YWxpZCBvd25lciEnKTtcbiAgICBmb3IgKHZhciBzID0gdGhpcy5wb2ludHMubGVuZ3RoOyBzLS07KSB7XG4gICAgICAgIGZvciAodmFyIGkgPSB0aGlzLnBvaW50c1tzXS5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgICAgIHBvaW50ID0gdGhpcy5wb2ludHNbc11baV07XG4gICAgICAgICAgICBhc3NlcnQoVXRpbHMuaXNSaWdodEFuZ2xlKHRoaXMucG9ydE9uV2hpY2hFZGdlKHBvaW50KSksXG4gICAgICAgICAgICAgICAgJ0F1dG9Sb3V0ZXJQb3J0LmNyZWF0ZVN0YXJ0RW5kUG9pbnRUbzogVXRpbHMuaXNSaWdodEFuZ2xlKHRoaXMucG9ydE9uV2hpY2hFZGdlKHJlc3VsdFBvaW50KSknICtcbiAgICAgICAgICAgICAgICAnIEZBSUxFRCcpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbiAoKSB7XG4gICAgLy8gUmVtb3ZlIGFsbCBwb2ludHMgYW5kIHNlbGYgZnJvbSBhbGwgcGF0aHNcbiAgICB2YXIgcG9pbnQsXG4gICAgICAgIHBhdGg7XG5cbiAgICB0aGlzLm93bmVyID0gbnVsbDtcbiAgICBmb3IgKHZhciBpID0gdGhpcy5wb2ludHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIGZvciAodmFyIGogPSB0aGlzLnBvaW50c1tpXS5sZW5ndGg7IGotLTspIHtcbiAgICAgICAgICAgIHBvaW50ID0gdGhpcy5wb2ludHNbaV1bal07XG4gICAgICAgICAgICBwYXRoID0gcG9pbnQub3duZXI7XG4gICAgICAgICAgICBhc3NlcnQocGF0aCwgJ3N0YXJ0L2VuZCBwb2ludCBkb2VzIG5vdCBoYXZlIGFuIG93bmVyIScpO1xuICAgICAgICAgICAgcGF0aC5yZW1vdmVQb3J0KHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5wb2ludHMgPSBbW10sIFtdLCBbXSwgW11dO1xuXG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEF1dG9Sb3V0ZXJQb3J0O1xuIiwiLypqc2hpbnQgbm9kZTogdHJ1ZSovXG5cbi8qKlxuICogQGF1dGhvciBicm9sbGIgLyBodHRwczovL2dpdGh1Yi9icm9sbGJcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBkZWJ1ZyA9IHJlcXVpcmUoJ2RlYnVnJyksXG4gICAgQXJQb2ludCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Qb2ludCcpLFxuICAgIEFyU2l6ZSA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5TaXplJyksXG4gICAgTG9nZ2VyID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLkxvZ2dlcicpLFxuICAgIF9sb2dnZXIgPSBuZXcgTG9nZ2VyKCdBdXRvUm91dGVyLlJlY3QnKTtcblxudmFyIEFyUmVjdCA9IGZ1bmN0aW9uIChMZWZ0LCBDZWlsLCBSaWdodCwgRmxvb3IpIHtcbiAgICBpZiAoTGVmdCA9PT0gdW5kZWZpbmVkKSB7IC8vTm8gYXJndW1lbnRzXG4gICAgICAgIExlZnQgPSAwO1xuICAgICAgICBDZWlsID0gMDtcbiAgICAgICAgUmlnaHQgPSAwO1xuICAgICAgICBGbG9vciA9IDA7XG5cbiAgICB9IGVsc2UgaWYgKENlaWwgPT09IHVuZGVmaW5lZCAmJiBMZWZ0IGluc3RhbmNlb2YgQXJSZWN0KSB7IC8vIE9uZSBhcmd1bWVudFxuICAgICAgICAvLyBMZWZ0IGlzIGFuIEFyUmVjdFxuICAgICAgICBDZWlsID0gTGVmdC5jZWlsO1xuICAgICAgICBSaWdodCA9IExlZnQucmlnaHQ7XG4gICAgICAgIEZsb29yID0gTGVmdC5mbG9vcjtcbiAgICAgICAgTGVmdCA9IExlZnQubGVmdDtcblxuICAgIH0gZWxzZSBpZiAoUmlnaHQgPT09IHVuZGVmaW5lZCAmJiBMZWZ0IGluc3RhbmNlb2YgQXJQb2ludCkgeyAvLyBUd28gYXJndW1lbnRzXG4gICAgICAgIC8vIENyZWF0aW5nIEFyUmVjdCB3aXRoIEFyUG9pbnQgYW5kIGVpdGhlciBhbm90aGVyIEFyUG9pbnQgb3IgQXJTaXplXG4gICAgICAgIGlmIChDZWlsIGluc3RhbmNlb2YgQXJTaXplKSB7XG4gICAgICAgICAgICBSaWdodCA9IExlZnQueCArIENlaWwuY3g7XG4gICAgICAgICAgICBGbG9vciA9IExlZnQueSArIENlaWwuY3k7XG4gICAgICAgICAgICBDZWlsID0gTGVmdC55O1xuICAgICAgICAgICAgTGVmdCA9IExlZnQueDtcblxuICAgICAgICB9IGVsc2UgaWYgKExlZnQgaW5zdGFuY2VvZiBBclBvaW50ICYmIENlaWwgaW5zdGFuY2VvZiBBclBvaW50KSB7XG4gICAgICAgICAgICBSaWdodCA9IE1hdGgucm91bmQoQ2VpbC54KTtcbiAgICAgICAgICAgIEZsb29yID0gTWF0aC5yb3VuZChDZWlsLnkpO1xuICAgICAgICAgICAgQ2VpbCA9IE1hdGgucm91bmQoTGVmdC55KTtcbiAgICAgICAgICAgIExlZnQgPSBNYXRoLnJvdW5kKExlZnQueCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgQXJSZWN0IENvbnN0cnVjdG9yJyk7XG4gICAgICAgIH1cblxuICAgIH0gZWxzZSBpZiAoRmxvb3IgPT09IHVuZGVmaW5lZCkgeyAvLyBJbnZhbGlkXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBBclJlY3QgQ29uc3RydWN0b3InKTtcbiAgICB9XG5cbiAgICB0aGlzLmxlZnQgPSBNYXRoLnJvdW5kKExlZnQpO1xuICAgIHRoaXMuY2VpbCA9IE1hdGgucm91bmQoQ2VpbCk7XG4gICAgdGhpcy5mbG9vciA9IE1hdGgucm91bmQoRmxvb3IpO1xuICAgIHRoaXMucmlnaHQgPSBNYXRoLnJvdW5kKFJpZ2h0KTtcbn07XG5cbkFyUmVjdC5wcm90b3R5cGUuZ2V0Q2VudGVyID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB7J3gnOiAodGhpcy5sZWZ0ICsgdGhpcy5yaWdodCkgLyAyLCAneSc6ICh0aGlzLmNlaWwgKyB0aGlzLmZsb29yKSAvIDJ9O1xufTtcblxuQXJSZWN0LnByb3RvdHlwZS5nZXRXaWR0aCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gKHRoaXMucmlnaHQgLSB0aGlzLmxlZnQpO1xufTtcblxuQXJSZWN0LnByb3RvdHlwZS5nZXRIZWlnaHQgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuICh0aGlzLmZsb29yIC0gdGhpcy5jZWlsKTtcbn07XG5cbkFyUmVjdC5wcm90b3R5cGUuZ2V0U2l6ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gbmV3IEFyU2l6ZSh0aGlzLmdldFdpZHRoKCksIHRoaXMuZ2V0SGVpZ2h0KCkpO1xufTtcblxuQXJSZWN0LnByb3RvdHlwZS5nZXRUb3BMZWZ0ID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBuZXcgQXJQb2ludCh0aGlzLmxlZnQsIHRoaXMuY2VpbCk7XG59O1xuXG5BclJlY3QucHJvdG90eXBlLmdldEJvdHRvbVJpZ2h0ID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBuZXcgQXJQb2ludCh0aGlzLnJpZ2h0LCB0aGlzLmZsb29yKTtcbn07XG5cbkFyUmVjdC5wcm90b3R5cGUuZ2V0Q2VudGVyUG9pbnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIG5ldyBBclBvaW50KHRoaXMubGVmdCArIHRoaXMuZ2V0V2lkdGgoKSAvIDIsIHRoaXMuY2VpbCArIHRoaXMuZ2V0SGVpZ2h0KCkgLyAyKTtcbn07XG5cbkFyUmVjdC5wcm90b3R5cGUuaXNSZWN0RW1wdHkgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKCh0aGlzLmxlZnQgPj0gdGhpcy5yaWdodCkgJiYgKHRoaXMuY2VpbCA+PSB0aGlzLmZsb29yKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG59O1xuXG5cbkFyUmVjdC5wcm90b3R5cGUuaXNSZWN0TnVsbCA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodGhpcy5sZWZ0ID09PSAwICYmXG4gICAgICAgIHRoaXMucmlnaHQgPT09IDAgJiZcbiAgICAgICAgdGhpcy5jZWlsID09PSAwICYmXG4gICAgICAgIHRoaXMuZmxvb3IgPT09IDApIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xufTtcblxuQXJSZWN0LnByb3RvdHlwZS5wdEluUmVjdCA9IGZ1bmN0aW9uIChwdCkge1xuICAgIGlmIChwdCBpbnN0YW5jZW9mIEFycmF5KSB7XG4gICAgICAgIHB0ID0gcHRbMF07XG4gICAgfVxuXG4gICAgaWYgKHB0LnggPj0gdGhpcy5sZWZ0ICYmXG4gICAgICAgIHB0LnggPD0gdGhpcy5yaWdodCAmJlxuICAgICAgICBwdC55ID49IHRoaXMuY2VpbCAmJlxuICAgICAgICBwdC55IDw9IHRoaXMuZmxvb3IpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xufTtcblxuQXJSZWN0LnByb3RvdHlwZS5zZXRSZWN0ID0gZnVuY3Rpb24gKG5MZWZ0LCBuQ2VpbCwgblJpZ2h0LCBuRmxvb3IpIHtcbiAgICBpZiAobkNlaWwgPT09IHVuZGVmaW5lZCAmJiBuTGVmdCBpbnN0YW5jZW9mIEFyUmVjdCkgeyAvL1xuICAgICAgICB0aGlzLmFzc2lnbihuTGVmdCk7XG5cbiAgICB9IGVsc2UgaWYgKG5SaWdodCA9PT0gdW5kZWZpbmVkIHx8IG5GbG9vciA9PT0gdW5kZWZpbmVkKSB7IC8vaW52YWxpZFxuICAgICAgICBfbG9nZ2VyLmRlYnVnKCdJbnZhbGlkIGFyZ3MgZm9yIFtBclJlY3RdLnNldFJlY3QnKTtcblxuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMubGVmdCA9IG5MZWZ0O1xuICAgICAgICB0aGlzLmNlaWwgPSBuQ2VpbDtcbiAgICAgICAgdGhpcy5yaWdodCA9IG5SaWdodDtcbiAgICAgICAgdGhpcy5mbG9vciA9IG5GbG9vcjtcbiAgICB9XG5cbn07XG5cbkFyUmVjdC5wcm90b3R5cGUuc2V0UmVjdEVtcHR5ID0gZnVuY3Rpb24gKCkge1xuXG4gICAgdGhpcy5jZWlsID0gMDtcbiAgICB0aGlzLnJpZ2h0ID0gMDtcbiAgICB0aGlzLmZsb29yID0gMDtcbiAgICB0aGlzLmxlZnQgPSAwO1xufTtcblxuQXJSZWN0LnByb3RvdHlwZS5pbmZsYXRlUmVjdCA9IGZ1bmN0aW9uICh4LCB5KSB7XG4gICAgaWYgKHggIT09IHVuZGVmaW5lZCAmJiB4LmN4ICE9PSB1bmRlZmluZWQgJiYgeC5jeSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHkgPSB4LmN5O1xuICAgICAgICB4ID0geC5jeDtcbiAgICB9IGVsc2UgaWYgKHkgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICB5ID0geDtcbiAgICB9XG5cbiAgICB0aGlzLmxlZnQgLT0geDtcbiAgICB0aGlzLnJpZ2h0ICs9IHg7XG4gICAgdGhpcy5jZWlsIC09IHk7XG4gICAgdGhpcy5mbG9vciArPSB5O1xufTtcblxuQXJSZWN0LnByb3RvdHlwZS5kZWZsYXRlUmVjdCA9IGZ1bmN0aW9uICh4LCB5KSB7XG4gICAgaWYgKHggIT09IHVuZGVmaW5lZCAmJiB4LmN4ICE9PSB1bmRlZmluZWQgJiYgeC5jeSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHkgPSB4LmN5O1xuICAgICAgICB4ID0geC5jeDtcbiAgICB9XG5cbiAgICB0aGlzLmxlZnQgKz0geDtcbiAgICB0aGlzLnJpZ2h0IC09IHg7XG4gICAgdGhpcy5jZWlsICs9IHk7XG4gICAgdGhpcy5mbG9vciAtPSB5O1xufTtcblxuQXJSZWN0LnByb3RvdHlwZS5ub3JtYWxpemVSZWN0ID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciB0ZW1wO1xuXG4gICAgaWYgKHRoaXMubGVmdCA+IHRoaXMucmlnaHQpIHtcbiAgICAgICAgdGVtcCA9IHRoaXMubGVmdDtcbiAgICAgICAgdGhpcy5sZWZ0ID0gdGhpcy5yaWdodDtcbiAgICAgICAgdGhpcy5yaWdodCA9IHRlbXA7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuY2VpbCA+IHRoaXMuZmxvb3IpIHtcbiAgICAgICAgdGVtcCA9IHRoaXMuY2VpbDtcbiAgICAgICAgdGhpcy5jZWlsID0gdGhpcy5mbG9vcjtcbiAgICAgICAgdGhpcy5mbG9vciA9IHRlbXA7XG4gICAgfVxufTtcblxuQXJSZWN0LnByb3RvdHlwZS5hc3NpZ24gPSBmdW5jdGlvbiAocmVjdCkge1xuXG4gICAgdGhpcy5jZWlsID0gcmVjdC5jZWlsO1xuICAgIHRoaXMucmlnaHQgPSByZWN0LnJpZ2h0O1xuICAgIHRoaXMuZmxvb3IgPSByZWN0LmZsb29yO1xuICAgIHRoaXMubGVmdCA9IHJlY3QubGVmdDtcbn07XG5cbkFyUmVjdC5wcm90b3R5cGUuZXF1YWxzID0gZnVuY3Rpb24gKHJlY3QpIHtcbiAgICBpZiAodGhpcy5sZWZ0ID09PSByZWN0LmxlZnQgJiZcbiAgICAgICAgdGhpcy5yaWdodCA9PT0gcmVjdC5yaWdodCAmJlxuICAgICAgICB0aGlzLmNlaWwgPT09IHJlY3QuY2VpbCAmJlxuICAgICAgICB0aGlzLmZsb29yID09PSByZWN0LmZsb29yKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcblxufTtcblxuQXJSZWN0LnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiAoQXJPYmplY3QpIHtcbiAgICB2YXIgZHgsXG4gICAgICAgIGR5O1xuICAgIGlmIChBck9iamVjdCBpbnN0YW5jZW9mIEFyUG9pbnQpIHtcbiAgICAgICAgZHggPSBBck9iamVjdC54O1xuICAgICAgICBkeSA9IEFyT2JqZWN0Lnk7XG5cbiAgICB9IGVsc2UgaWYgKEFyT2JqZWN0LmN4ICE9PSB1bmRlZmluZWQgJiYgQXJPYmplY3QuY3kgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBkeCA9IEFyT2JqZWN0LmN4O1xuICAgICAgICBkeSA9IEFyT2JqZWN0LmN5O1xuXG4gICAgfSBlbHNlIHtcbiAgICAgICAgX2xvZ2dlci5kZWJ1ZygnSW52YWxpZCBhcmcgZm9yIFtBclJlY3RdLmFkZCBtZXRob2QnKTtcbiAgICB9XG5cbiAgICB0aGlzLmxlZnQgKz0gZHg7XG4gICAgdGhpcy5yaWdodCArPSBkeDtcbiAgICB0aGlzLmNlaWwgKz0gZHk7XG4gICAgdGhpcy5mbG9vciArPSBkeTtcbn07XG5cbkFyUmVjdC5wcm90b3R5cGUuc3VidHJhY3QgPSBmdW5jdGlvbiAoQXJPYmplY3QpIHtcbiAgICBpZiAoQXJPYmplY3QgaW5zdGFuY2VvZiBBclBvaW50KSB7XG4gICAgICAgIHRoaXMuZGVmbGF0ZVJlY3QoQXJPYmplY3QueCwgQXJPYmplY3QueSk7XG5cbiAgICB9IGVsc2UgaWYgKEFyT2JqZWN0IGluc3RhbmNlb2YgQXJTaXplKSB7XG4gICAgICAgIHRoaXMuZGVmbGF0ZVJlY3QoQXJPYmplY3QpO1xuXG4gICAgfSBlbHNlIGlmIChBck9iamVjdCBpbnN0YW5jZW9mIEFyUmVjdCkge1xuICAgICAgICB0aGlzLmxlZnQgKz0gQXJPYmplY3QubGVmdDtcbiAgICAgICAgdGhpcy5yaWdodCAtPSBBck9iamVjdC5yaWdodDtcbiAgICAgICAgdGhpcy5jZWlsICs9IEFyT2JqZWN0LmNlaWw7XG4gICAgICAgIHRoaXMuZmxvb3IgLT0gQXJPYmplY3QuZmxvb3I7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgICBfbG9nZ2VyLmRlYnVnKCdJbnZhbGlkIGFyZyBmb3IgW0FyUmVjdF0uc3VidHJhY3QgbWV0aG9kJyk7XG4gICAgfVxufTtcblxuQXJSZWN0LnByb3RvdHlwZS5wbHVzID0gZnVuY3Rpb24gKEFyT2JqZWN0KSB7XG4gICAgdmFyIHJlc09iamVjdCA9IG5ldyBBclJlY3QodGhpcyk7XG4gICAgcmVzT2JqZWN0LmFkZChBck9iamVjdCk7XG5cbiAgICByZXR1cm4gcmVzT2JqZWN0O1xufTtcblxuQXJSZWN0LnByb3RvdHlwZS5taW51cyA9IGZ1bmN0aW9uIChBck9iamVjdCkge1xuICAgIHZhciByZXNPYmplY3QgPSBuZXcgQXJSZWN0KHRoaXMpO1xuICAgIHJlc09iamVjdC5zdWJ0cmFjdChBck9iamVjdCk7XG5cbiAgICByZXR1cm4gcmVzT2JqZWN0O1xufTtcblxuQXJSZWN0LnByb3RvdHlwZS51bmlvbkFzc2lnbiA9IGZ1bmN0aW9uIChyZWN0KSB7XG4gICAgaWYgKHJlY3QuaXNSZWN0RW1wdHkoKSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmICh0aGlzLmlzUmVjdEVtcHR5KCkpIHtcbiAgICAgICAgdGhpcy5hc3NpZ24ocmVjdCk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvL1Rha2UgdGhlIG91dGVybW9zdCBkaW1lbnNpb25cbiAgICB0aGlzLmxlZnQgPSBNYXRoLm1pbih0aGlzLmxlZnQsIHJlY3QubGVmdCk7XG4gICAgdGhpcy5yaWdodCA9IE1hdGgubWF4KHRoaXMucmlnaHQsIHJlY3QucmlnaHQpO1xuICAgIHRoaXMuY2VpbCA9IE1hdGgubWluKHRoaXMuY2VpbCwgcmVjdC5jZWlsKTtcbiAgICB0aGlzLmZsb29yID0gTWF0aC5tYXgodGhpcy5mbG9vciwgcmVjdC5mbG9vcik7XG5cbn07XG5cbkFyUmVjdC5wcm90b3R5cGUudW5pb24gPSBmdW5jdGlvbiAocmVjdCkge1xuICAgIHZhciByZXNSZWN0ID0gbmV3IEFyUmVjdCh0aGlzKTtcbiAgICByZXNSZWN0LnVuaW9uQXNzaWduKHJlY3QpO1xuXG4gICAgcmV0dXJuIHJlc1JlY3Q7XG59O1xuXG5BclJlY3QucHJvdG90eXBlLmludGVyc2VjdEFzc2lnbiA9IGZ1bmN0aW9uIChyZWN0MSwgcmVjdDIpIHtcbiAgICByZWN0MiA9IHJlY3QyID8gcmVjdDIgOiB0aGlzO1xuICAgIC8vU2V0cyB0aGlzIHJlY3QgdG8gdGhlIGludGVyc2VjdGlvbiByZWN0XG4gICAgdGhpcy5sZWZ0ID0gTWF0aC5tYXgocmVjdDEubGVmdCwgcmVjdDIubGVmdCk7XG4gICAgdGhpcy5yaWdodCA9IE1hdGgubWluKHJlY3QxLnJpZ2h0LCByZWN0Mi5yaWdodCk7XG4gICAgdGhpcy5jZWlsID0gTWF0aC5tYXgocmVjdDEuY2VpbCwgcmVjdDIuY2VpbCk7XG4gICAgdGhpcy5mbG9vciA9IE1hdGgubWluKHJlY3QxLmZsb29yLCByZWN0Mi5mbG9vcik7XG5cbiAgICBpZiAodGhpcy5sZWZ0ID49IHRoaXMucmlnaHQgfHwgdGhpcy5jZWlsID49IHRoaXMuZmxvb3IpIHtcbiAgICAgICAgdGhpcy5zZXRSZWN0RW1wdHkoKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xufTtcblxuQXJSZWN0LnByb3RvdHlwZS5pbnRlcnNlY3QgPSBmdW5jdGlvbiAocmVjdCkge1xuICAgIHZhciByZXNSZWN0ID0gbmV3IEFyUmVjdCh0aGlzKTtcblxuICAgIHJlc1JlY3QuaW50ZXJzZWN0QXNzaWduKHJlY3QpO1xuICAgIHJldHVybiByZXNSZWN0O1xufTtcblxuQXJSZWN0LnByb3RvdHlwZS50b3VjaGluZyA9IGZ1bmN0aW9uIChyZWN0KSB7XG4gICAgLy9PbmUgcGl4ZWwgaXMgYWRkZWQgdG8gdGhlIG1pbmltdW1zIHNvLCBpZiB0aGV5IGFyZSBub3QgZGVlbWVkIHRvIGJlIHRvdWNoaW5nXG4gICAgLy90aGVyZSBpcyBndWFyYW50ZWVkIHRvIGJlIGF0IGxlYXNlIGEgb25lIHBpeGVsIHBhdGggYmV0d2VlbiB0aGVtXG4gICAgcmV0dXJuIE1hdGgubWF4KHJlY3QubGVmdCwgdGhpcy5sZWZ0KSA8PSBNYXRoLm1pbihyZWN0LnJpZ2h0LCB0aGlzLnJpZ2h0KSArIDEgJiZcbiAgICAgICAgTWF0aC5tYXgocmVjdC5jZWlsLCB0aGlzLmNlaWwpIDw9IE1hdGgubWluKHJlY3QuZmxvb3IsIHRoaXMuZmxvb3IpICsgMTtcbn07XG5cbi8qKlxuICogUmV0dXJucyB0cnVlIGlmIHRoZSBnaXZlbiBwb2ludCBpcyBvbiBvbmUgb2YgdGhlIGNvcm5lcnMgb2YgdGhlIHJlY3RhbmdsZS5cbiAqXG4gKiBAcGFyYW0gcG9pbnRcbiAqIEByZXR1cm4ge3VuZGVmaW5lZH1cbiAqL1xuQXJSZWN0LnByb3RvdHlwZS5vbkNvcm5lciA9IGZ1bmN0aW9uIChwb2ludCkge1xuICAgIHZhciBvbkhvcml6b250YWxTaWRlLFxuICAgICAgICBvblZlcnRpY2FsU2lkZTtcblxuICAgIG9uSG9yaXpvbnRhbFNpZGUgPSBwb2ludC54ID09PSB0aGlzLmxlZnQgfHwgcG9pbnQueCA9PT0gdGhpcy5yaWdodDtcbiAgICBvblZlcnRpY2FsU2lkZSA9IHBvaW50LnkgPT09IHRoaXMuY2VpbCB8fCBwb2ludC55ID09PSB0aGlzLmZsb29yO1xuXG4gICAgcmV0dXJuIG9uSG9yaXpvbnRhbFNpZGUgJiYgb25WZXJ0aWNhbFNpZGU7XG59O1xuXG5BclJlY3QucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmdldFRvcExlZnQoKS50b1N0cmluZygpICsgJyAnICsgdGhpcy5nZXRCb3R0b21SaWdodCgpLnRvU3RyaW5nKCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEFyUmVjdDtcbiIsIi8qanNoaW50IG5vZGU6IHRydWUqL1xuXG4vKipcbiAqIEBhdXRob3IgYnJvbGxiIC8gaHR0cHM6Ly9naXRodWIvYnJvbGxiXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgQXJTaXplID0gZnVuY3Rpb24gKHgsIHkpIHtcbiAgICAvL011bHRpcGxlIENvbnN0cnVjdG9yc1xuICAgIGlmICh4ID09PSB1bmRlZmluZWQpIHsgLy9ObyBhcmd1bWVudHMgd2VyZSBwYXNzZWQgdG8gY29uc3RydWN0b3JcbiAgICAgICAgeCA9IDA7XG4gICAgICAgIHkgPSAwO1xuICAgIH0gZWxzZSBpZiAoeSA9PT0gdW5kZWZpbmVkKSB7IC8vT25lIGFyZ3VtZW50IHBhc3NlZCB0byBjb25zdHJ1Y3RvclxuICAgICAgICB5ID0geC5jeTtcbiAgICAgICAgeCA9IHguY3g7XG4gICAgfVxuXG4gICAgdGhpcy5jeCA9IHg7XG4gICAgdGhpcy5jeSA9IHk7XG59O1xuXG5BclNpemUucHJvdG90eXBlLmVxdWFscyA9IGZ1bmN0aW9uIChvdGhlclNpemUpIHtcbiAgICBpZiAodGhpcy5jeCA9PT0gb3RoZXJTaXplLmN4ICYmIHRoaXMuY3kgPT09IG90aGVyU2l6ZS5jeSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG59O1xuXG5BclNpemUucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uIChvdGhlclNpemUpIHsgLy9lcXVpdmFsZW50IHRvICs9XG4gICAgaWYgKG90aGVyU2l6ZS5jeCB8fCBvdGhlclNpemUuY3kpIHtcbiAgICAgICAgdGhpcy5jeCArPSBvdGhlclNpemUuY3g7XG4gICAgICAgIHRoaXMuY3kgKz0gb3RoZXJTaXplLmN5O1xuICAgIH1cbiAgICBpZiAob3RoZXJTaXplLnggfHwgb3RoZXJTaXplLnkpIHtcbiAgICAgICAgdGhpcy5jeCArPSBvdGhlclNpemUueDtcbiAgICAgICAgdGhpcy5jeSArPSBvdGhlclNpemUueTtcbiAgICB9XG59O1xuXG5BclNpemUucHJvdG90eXBlLmdldEFycmF5ID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciByZXMgPSBbXTtcbiAgICByZXMucHVzaCh0aGlzLmN4KTtcbiAgICByZXMucHVzaCh0aGlzLmN5KTtcbiAgICByZXR1cm4gcmVzO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBclNpemU7XG4iLCIvKmpzaGludCBub2RlOiB0cnVlKi9cblxuLyoqXG4gKiBAYXV0aG9yIGJyb2xsYiAvIGh0dHBzOi8vZ2l0aHViL2Jyb2xsYlxuICovXG5cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgQ09OU1RBTlRTID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLkNvbnN0YW50cycpLFxuICAgIGFzc2VydCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5VdGlscycpLmFzc2VydCxcbiAgICBBclJlY3QgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUmVjdCcpLFxuICAgIEFyUG9pbnQgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUG9pbnQnKTtcblxudmFyIF9nZXRPcHRpbWFsUG9ydHMgPSBmdW5jdGlvbiAocG9ydHMsIHRndCkge1xuICAgIC8vSSB3aWxsIGdldCB0aGUgZHgsIGR5IHRoYXQgdG8gdGhlIHNyYy9kc3QgdGFyZ2V0IGFuZCB0aGVuIEkgd2lsbCBjYWxjdWxhdGVcbiAgICAvLyBhIHByaW9yaXR5IHZhbHVlIHRoYXQgd2lsbCByYXRlIHRoZSBwb3J0cyBhcyBjYW5kaWRhdGVzIGZvciB0aGUgXG4gICAgLy9naXZlbiBwYXRoXG4gICAgdmFyIHNyY0MgPSBuZXcgQXJQb2ludCgpLCAvL3NyYyBjZW50ZXJcbiAgICAgICAgdmVjdG9yLFxuICAgICAgICBwb3J0LCAvL3Jlc3VsdFxuICAgICAgICBtYXhQID0gLUluZmluaXR5LFxuICAgICAgICBtYXhBcmVhID0gMCxcbiAgICAgICAgc1BvaW50LFxuICAgICAgICBpO1xuXG4gICAgLy9HZXQgdGhlIGNlbnRlciBwb2ludHMgb2YgdGhlIHNyYyxkc3QgcG9ydHNcbiAgICBmb3IgKGkgPSAwOyBpIDwgcG9ydHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgc1BvaW50ID0gcG9ydHNbaV0ucmVjdC5nZXRDZW50ZXIoKTtcbiAgICAgICAgc3JjQy54ICs9IHNQb2ludC54O1xuICAgICAgICBzcmNDLnkgKz0gc1BvaW50Lnk7XG5cbiAgICAgICAgLy9hZGp1c3QgbWF4QXJlYVxuICAgICAgICBpZiAobWF4QXJlYSA8IHBvcnRzW2ldLmdldFRvdGFsQXZhaWxhYmxlQXJlYSgpKSB7XG4gICAgICAgICAgICBtYXhBcmVhID0gcG9ydHNbaV0uZ2V0VG90YWxBdmFpbGFibGVBcmVhKCk7XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIC8vR2V0IHRoZSBhdmVyYWdlIGNlbnRlciBwb2ludCBvZiBzcmNcbiAgICBzcmNDLnggPSBzcmNDLnggLyBwb3J0cy5sZW5ndGg7XG4gICAgc3JjQy55ID0gc3JjQy55IC8gcG9ydHMubGVuZ3RoO1xuXG4gICAgLy9HZXQgdGhlIGRpcmVjdGlvbnNcbiAgICB2ZWN0b3IgPSAodGd0Lm1pbnVzKHNyY0MpLmdldEFycmF5KCkpO1xuXG4gICAgLy9DcmVhdGUgcHJpb3JpdHkgZnVuY3Rpb25cbiAgICBmdW5jdGlvbiBjcmVhdGVQcmlvcml0eShwb3J0LCBjZW50ZXIpIHtcbiAgICAgICAgdmFyIHByaW9yaXR5ID0gMCxcbiAgICAgICAgLy9wb2ludCA9IFsgIGNlbnRlci54IC0gcG9ydC5yZWN0LmdldENlbnRlcigpLngsIGNlbnRlci55IC0gcG9ydC5yZWN0LmdldENlbnRlcigpLnldLFxuICAgICAgICAgICAgcG9pbnQgPSBbcG9ydC5yZWN0LmdldENlbnRlcigpLnggLSBjZW50ZXIueCwgcG9ydC5yZWN0LmdldENlbnRlcigpLnkgLSBjZW50ZXIueV0sXG4gICAgICAgICAgICBsaW5lQ291bnQgPSAocG9ydC5nZXRQb2ludENvdW50KCkgfHwgMSksXG4gICAgICAgICAgICAvL0lmIHRoZXJlIGlzIGEgcHJvYmxlbSB3aXRoIG1heEFyZWEsIGp1c3QgaWdub3JlIGRlbnNpdHlcbiAgICAgICAgICAgIGRlbnNpdHkgPSAocG9ydC5nZXRUb3RhbEF2YWlsYWJsZUFyZWEoKSAvIGxpbmVDb3VudCkgLyBtYXhBcmVhIHx8IDEsXG4gICAgICAgICAgICBtYWpvciA9IE1hdGguYWJzKHZlY3RvclswXSkgPiBNYXRoLmFicyh2ZWN0b3JbMV0pID8gMCA6IDEsXG4gICAgICAgICAgICBtaW5vciA9IChtYWpvciArIDEpICUgMjtcblxuICAgICAgICBpZiAocG9pbnRbbWFqb3JdID4gMCA9PT0gdmVjdG9yW21ham9yXSA+IDAgJiYgKHBvaW50W21ham9yXSA9PT0gMCkgPT09ICh2ZWN0b3JbbWFqb3JdID09PSAwKSkge1xuICAgICAgICAgICAgLy9oYW5kbGluZyB0aGUgPT09IDAgZXJyb3JcbiAgICAgICAgICAgIC8vSWYgdGhleSBoYXZlIHRoZSBzYW1lIHBhcml0eSwgYXNzaWduIHRoZSBwcmlvcml0eSB0byBtYXhpbWl6ZSB0aGF0IGlzID4gMVxuICAgICAgICAgICAgcHJpb3JpdHkgPSAoTWF0aC5hYnModmVjdG9yW21ham9yXSkgLyBNYXRoLmFicyh2ZWN0b3JbbWFqb3JdIC0gcG9pbnRbbWFqb3JdKSkgKiAyNTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChwb2ludFttaW5vcl0gPiAwID09PSB2ZWN0b3JbbWlub3JdID4gMCAmJiAocG9pbnRbbWlub3JdID09PSAwKSA9PT0gKHZlY3RvclttaW5vcl0gPT09IDApKSB7XG4gICAgICAgICAgICAvL2hhbmRsaW5nIHRoZSA9PT0gMCBlcnJvclxuICAgICAgICAgICAgLy9JZiB0aGV5IGhhdmUgdGhlIHNhbWUgcGFyaXR5LCBhc3NpZ24gdGhlIHByaW9yaXR5IHRvIG1heGltaXplIHRoYXQgaXMgPCAxXG4gICAgICAgICAgICBwcmlvcml0eSArPSB2ZWN0b3JbbWlub3JdICE9PSBwb2ludFttaW5vcl0gP1xuICAgICAgICAgICAgKE1hdGguYWJzKHZlY3RvclttaW5vcl0pIC8gTWF0aC5hYnModmVjdG9yW21pbm9yXSAtIHBvaW50W21pbm9yXSkpICogMSA6IDA7XG4gICAgICAgIH1cblxuICAgICAgICAvL0FkanVzdCBwcmlvcml0eSBiYXNlZCBvbiB0aGUgZGVuc2l0eSBvZiB0aGUgbGluZXMuLi5cbiAgICAgICAgcHJpb3JpdHkgKj0gZGVuc2l0eTtcblxuICAgICAgICByZXR1cm4gcHJpb3JpdHk7XG4gICAgfVxuXG4gICAgLy9DcmVhdGUgcHJpb3JpdHkgdmFsdWVzIGZvciBlYWNoIHBvcnQuXG4gICAgdmFyIHByaW9yaXR5O1xuICAgIGZvciAoaSA9IDA7IGkgPCBwb3J0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBwcmlvcml0eSA9IGNyZWF0ZVByaW9yaXR5KHBvcnRzW2ldLCBzcmNDKSB8fCAwO1xuICAgICAgICBpZiAocHJpb3JpdHkgPj0gbWF4UCkge1xuICAgICAgICAgICAgcG9ydCA9IHBvcnRzW2ldO1xuICAgICAgICAgICAgbWF4UCA9IHByaW9yaXR5O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXNzZXJ0KHBvcnQub3duZXIsICdBUkdyYXBoLmdldE9wdGltYWxQb3J0czogcG9ydCBoYXMgaW52YWxpZCBvd25lcicpO1xuXG4gICAgcmV0dXJuIHBvcnQ7XG59O1xuXG52YXIgX2dldFBvaW50Q29vcmQgPSBmdW5jdGlvbiAocG9pbnQsIGhvckRpcikge1xuICAgIGlmIChob3JEaXIgPT09IHRydWUgfHwgX2lzSG9yaXpvbnRhbChob3JEaXIpKSB7XG4gICAgICAgIHJldHVybiBwb2ludC54O1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBwb2ludC55O1xuICAgIH1cbn07XG5cbnZhciBfaW5mbGF0ZWRSZWN0ID0gZnVuY3Rpb24gKHJlY3QsIGEpIHtcbiAgICB2YXIgciA9IHJlY3Q7XG4gICAgci5pbmZsYXRlUmVjdChhLCBhKTtcbiAgICByZXR1cm4gcjtcbn07XG5cbnZhciBfaXNQb2ludE5lYXIgPSBmdW5jdGlvbiAocDEsIHAyLCBuZWFybmVzcykge1xuICAgIHJldHVybiBwMi54IC0gbmVhcm5lc3MgPD0gcDEueCAmJiBwMS54IDw9IHAyLnggKyBuZWFybmVzcyAmJlxuICAgICAgICBwMi55IC0gbmVhcm5lc3MgPD0gcDEueSAmJiBwMS55IDw9IHAyLnkgKyBuZWFybmVzcztcbn07XG5cbnZhciBfaXNQb2ludEluID0gZnVuY3Rpb24gKHBvaW50LCByZWN0LCBuZWFybmVzcykge1xuICAgIHZhciB0bXBSID0gbmV3IEFyUmVjdChyZWN0KTtcbiAgICB0bXBSLmluZmxhdGVSZWN0KG5lYXJuZXNzLCBuZWFybmVzcyk7XG4gICAgcmV0dXJuIHRtcFIucHRJblJlY3QocG9pbnQpID09PSB0cnVlO1xufTtcblxudmFyIF9pc1JlY3RJbiA9IGZ1bmN0aW9uIChyMSwgcjIpIHtcbiAgICByZXR1cm4gcjIubGVmdCA8PSByMS5sZWZ0ICYmIHIxLnJpZ2h0IDw9IHIyLnJpZ2h0ICYmXG4gICAgICAgIHIyLmNlaWwgPD0gcjEuY2VpbCAmJiByMS5mbG9vciA8PSByMi5mbG9vcjtcbn07XG5cbnZhciBfaXNSZWN0Q2xpcCA9IGZ1bmN0aW9uIChyMSwgcjIpIHtcbiAgICB2YXIgcmVjdCA9IG5ldyBBclJlY3QoKTtcbiAgICByZXR1cm4gcmVjdC5pbnRlcnNlY3RBc3NpZ24ocjEsIHIyKSA9PT0gdHJ1ZTtcbn07XG5cbnZhciBfZGlzdGFuY2VGcm9tSExpbmUgPSBmdW5jdGlvbiAocCwgeDEsIHgyLCB5KSB7XG4gICAgYXNzZXJ0KHgxIDw9IHgyLCAnQXJIZWxwZXIuZGlzdGFuY2VGcm9tSExpbmU6IHgxIDw9IHgyIEZBSUxFRCcpO1xuXG4gICAgcmV0dXJuIE1hdGgubWF4KE1hdGguYWJzKHAueSAtIHkpLCBNYXRoLm1heCh4MSAtIHAueCwgcC54IC0geDIpKTtcbn07XG5cbnZhciBfZGlzdGFuY2VGcm9tVkxpbmUgPSBmdW5jdGlvbiAocCwgeTEsIHkyLCB4KSB7XG4gICAgYXNzZXJ0KHkxIDw9IHkyLCAnQXJIZWxwZXIuZGlzdGFuY2VGcm9tVkxpbmU6IHkxIDw9IHkyIEZBSUxFRCcpO1xuXG4gICAgcmV0dXJuIE1hdGgubWF4KE1hdGguYWJzKHAueCAtIHgpLCBNYXRoLm1heCh5MSAtIHAueSwgcC55IC0geTIpKTtcbn07XG5cbnZhciBfZGlzdGFuY2VGcm9tTGluZSA9IGZ1bmN0aW9uIChwdCwgc3RhcnQsIGVuZCkge1xuICAgIHZhciBkaXIgPSBfZ2V0RGlyKGVuZC5taW51cyhzdGFydCkpO1xuXG4gICAgaWYgKF9pc0hvcml6b250YWwoZGlyKSkge1xuICAgICAgICByZXR1cm4gX2Rpc3RhbmNlRnJvbVZMaW5lKHB0LCBzdGFydC55LCBlbmQueSwgc3RhcnQueCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIF9kaXN0YW5jZUZyb21ITGluZShwdCwgc3RhcnQueCwgZW5kLngsIHN0YXJ0LnkpO1xuICAgIH1cbn07XG5cbnZhciBfaXNPbkVkZ2UgPSBmdW5jdGlvbiAoc3RhcnQsIGVuZCwgcHQpIHtcbiAgICBpZiAoc3RhcnQueCA9PT0gZW5kLngpIHtcdFx0XHQvLyB2ZXJ0aWNhbCBlZGdlLCBob3Jpem9udGFsIG1vdmVcbiAgICAgICAgaWYgKGVuZC54ID09PSBwdC54ICYmIHB0LnkgPD0gTWF0aC5tYXgoZW5kLnksIHN0YXJ0LnkpICYmIHB0LnkgPj0gTWF0aC5taW4oZW5kLnksIHN0YXJ0LnkpKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoc3RhcnQueSA9PT0gZW5kLnkpIHtcdC8vIGhvcml6b250YWwgbGluZSwgdmVydGljYWwgbW92ZVxuICAgICAgICBpZiAoc3RhcnQueSA9PT0gcHQueSAmJiBwdC54IDw9IE1hdGgubWF4KGVuZC54LCBzdGFydC54KSAmJiBwdC54ID49IE1hdGgubWluKGVuZC54LCBzdGFydC54KSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG59O1xuXG52YXIgX2lzUG9pbnROZWFyTGluZSA9IGZ1bmN0aW9uIChwb2ludCwgc3RhcnQsIGVuZCwgbmVhcm5lc3MpIHtcbiAgICBhc3NlcnQoMCA8PSBuZWFybmVzcywgJ0FySGVscGVyLmlzUG9pbnROZWFyTGluZTogMCA8PSBuZWFybmVzcyBGQUlMRUQnKTtcblxuICAgIC8vIGJlZ2luIFpvbG1vbFxuICAgIC8vIHRoZSByb3V0aW5nIG1heSBjcmVhdGUgZWRnZXMgdGhhdCBoYXZlIHN0YXJ0PT1lbmRcbiAgICAvLyB0aHVzIGNvbmZ1c2luZyB0aGlzIGFsZ29yaXRobVxuICAgIGlmIChlbmQueCA9PT0gc3RhcnQueCAmJiBlbmQueSA9PT0gc3RhcnQueSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIC8vIGVuZCBab2xtb2xcblxuICAgIHZhciBwb2ludDIgPSBwb2ludDtcblxuICAgIHBvaW50Mi5zdWJ0cmFjdChzdGFydCk7XG5cbiAgICB2YXIgZW5kMiA9IGVuZDtcbiAgICBlbmQyLnN1YnRyYWN0KHN0YXJ0KTtcblxuICAgIHZhciB4ID0gZW5kMi54LFxuICAgICAgICB5ID0gZW5kMi55LFxuICAgICAgICB1ID0gcG9pbnQyLngsXG4gICAgICAgIHYgPSBwb2ludDIueSxcbiAgICAgICAgeHV5diA9IHggKiB1ICsgeSAqIHYsXG4gICAgICAgIHgyeTIgPSB4ICogeCArIHkgKiB5O1xuXG4gICAgaWYgKHh1eXYgPCAwIHx8IHh1eXYgPiB4MnkyKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB2YXIgZXhwcjEgPSAoeCAqIHYgLSB5ICogdSk7XG4gICAgZXhwcjEgKj0gZXhwcjE7XG4gICAgdmFyIGV4cHIyID0gbmVhcm5lc3MgKiBuZWFybmVzcyAqIHgyeTI7XG5cbiAgICByZXR1cm4gZXhwcjEgPD0gZXhwcjI7XG59O1xuXG52YXIgX2lzTGluZU1lZXRITGluZSA9IGZ1bmN0aW9uIChzdGFydCwgZW5kLCB4MSwgeDIsIHkpIHtcbiAgICBhc3NlcnQoeDEgPD0geDIsICdBckhlbHBlci5pc0xpbmVNZWV0SExpbmU6IHgxIDw9IHgyIEZBSUxFRCcpO1xuICAgIGlmIChzdGFydCBpbnN0YW5jZW9mIEFycmF5KSB7Ly9Db252ZXJ0aW5nIGZyb20gJ3BvaW50ZXInXG4gICAgICAgIHN0YXJ0ID0gc3RhcnRbMF07XG4gICAgfVxuICAgIGlmIChlbmQgaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgICBlbmQgPSBlbmRbMF07XG4gICAgfVxuXG4gICAgaWYgKCEoKHN0YXJ0LnkgPD0geSAmJiB5IDw9IGVuZC55KSB8fCAoZW5kLnkgPD0geSAmJiB5IDw9IHN0YXJ0LnkgKSkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHZhciBlbmQyID0gbmV3IEFyUG9pbnQoZW5kKTtcbiAgICBlbmQyLnN1YnRyYWN0KHN0YXJ0KTtcbiAgICB4MSAtPSBzdGFydC54O1xuICAgIHgyIC09IHN0YXJ0Lng7XG4gICAgeSAtPSBzdGFydC55O1xuXG4gICAgaWYgKGVuZDIueSA9PT0gMCkge1xuICAgICAgICByZXR1cm4geSA9PT0gMCAmJiAoKCB4MSA8PSAwICYmIDAgPD0geDIgKSB8fCAoeDEgPD0gZW5kMi54ICYmIGVuZDIueCA8PSB4MikpO1xuICAgIH1cblxuICAgIHZhciB4ID0gKChlbmQyLngpIC8gZW5kMi55KSAqIHk7XG4gICAgcmV0dXJuIHgxIDw9IHggJiYgeCA8PSB4Mjtcbn07XG5cbnZhciBfaXNMaW5lTWVldFZMaW5lID0gZnVuY3Rpb24gKHN0YXJ0LCBlbmQsIHkxLCB5MiwgeCkge1xuICAgIGFzc2VydCh5MSA8PSB5MiwgJ0FySGVscGVyLmlzTGluZU1lZXRWTGluZTogeTEgPD0geTIgIEZBSUxFRCcpO1xuICAgIGlmIChzdGFydCBpbnN0YW5jZW9mIEFycmF5KSB7Ly9Db252ZXJ0aW5nIGZyb20gJ3BvaW50ZXInXG4gICAgICAgIHN0YXJ0ID0gc3RhcnRbMF07XG4gICAgfVxuICAgIGlmIChlbmQgaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgICBlbmQgPSBlbmRbMF07XG4gICAgfVxuXG4gICAgaWYgKCEoKHN0YXJ0LnggPD0geCAmJiB4IDw9IGVuZC54KSB8fCAoZW5kLnggPD0geCAmJiB4IDw9IHN0YXJ0LnggKSkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHZhciBlbmQyID0gbmV3IEFyUG9pbnQoZW5kKTtcbiAgICBlbmQyLnN1YnRyYWN0KHN0YXJ0KTtcbiAgICB5MSAtPSBzdGFydC55O1xuICAgIHkyIC09IHN0YXJ0Lnk7XG4gICAgeCAtPSBzdGFydC54O1xuXG4gICAgaWYgKGVuZDIueCA9PT0gMCkge1xuICAgICAgICByZXR1cm4geCA9PT0gMCAmJiAoKCB5MSA8PSAwICYmIDAgPD0geTIgKSB8fCAoeTEgPD0gZW5kMi55ICYmIGVuZDIueSA8PSB5MikpO1xuICAgIH1cblxuICAgIHZhciB5ID0gKChlbmQyLnkpIC8gZW5kMi54KSAqIHg7XG4gICAgcmV0dXJuIHkxIDw9IHkgJiYgeSA8PSB5Mjtcbn07XG5cbnZhciBfaXNMaW5lQ2xpcFJlY3RzID0gZnVuY3Rpb24gKHN0YXJ0LCBlbmQsIHJlY3RzKSB7XG4gICAgdmFyIGkgPSByZWN0cy5sZW5ndGg7XG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgICBpZiAoX2lzTGluZUNsaXBSZWN0KHN0YXJ0LCBlbmQsIHJlY3RzW2ldKSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xufTtcblxudmFyIF9pc0xpbmVDbGlwUmVjdCA9IGZ1bmN0aW9uIChzdGFydCwgZW5kLCByZWN0KSB7XG4gICAgaWYgKHJlY3QucHRJblJlY3Qoc3RhcnQpIHx8IHJlY3QucHRJblJlY3QoZW5kKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gX2lzTGluZU1lZXRITGluZShzdGFydCwgZW5kLCByZWN0LmxlZnQsIHJlY3QucmlnaHQsIHJlY3QuY2VpbCkgfHxcbiAgICAgICAgX2lzTGluZU1lZXRITGluZShzdGFydCwgZW5kLCByZWN0LmxlZnQsIHJlY3QucmlnaHQsIHJlY3QuZmxvb3IpIHx8XG4gICAgICAgIF9pc0xpbmVNZWV0VkxpbmUoc3RhcnQsIGVuZCwgcmVjdC5jZWlsLCByZWN0LmZsb29yLCByZWN0LmxlZnQpIHx8XG4gICAgICAgIF9pc0xpbmVNZWV0VkxpbmUoc3RhcnQsIGVuZCwgcmVjdC5jZWlsLCByZWN0LmZsb29yLCByZWN0LnJpZ2h0KTtcbn07XG5cbnZhciBfZ2V0TGluZUNsaXBSZWN0SW50ZXJzZWN0ID0gZnVuY3Rpb24gKHN0YXJ0LCBlbmQsIHJlY3QpIHtcbiAgICAvL3JldHVybiB0aGUgZW5kcG9pbnRzIG9mIHRoZSBpbnRlcnNlY3Rpb24gbGluZVxuICAgIHZhciBkaXIgPSBfZ2V0RGlyKGVuZC5taW51cyhzdGFydCkpLFxuICAgICAgICBlbmRwb2ludHMgPSBbbmV3IEFyUG9pbnQoc3RhcnQpLCBuZXcgQXJQb2ludChlbmQpXTtcblxuICAgIGlmICghX2lzTGluZUNsaXBSZWN0KHN0YXJ0LCBlbmQsIHJlY3QpKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGFzc2VydChfaXNSaWdodEFuZ2xlKGRpciksICdBckhlbHBlci5nZXRMaW5lQ2xpcFJlY3RJbnRlcnNlY3Q6IF9pc1JpZ2h0QW5nbGUoZGlyKSBGQUlMRUQnKTtcblxuICAgIC8vTWFrZSBzdXJlIHdlIGFyZSB3b3JraW5nIGxlZnQgdG8gcmlnaHQgb3IgdG9wIGRvd25cbiAgICBpZiAoZGlyID09PSBDT05TVEFOVFMuRGlyTGVmdCB8fCBkaXIgPT09IENPTlNUQU5UUy5EaXJUb3ApIHtcbiAgICAgICAgZGlyID0gX3JldmVyc2VEaXIoZGlyKTtcbiAgICAgICAgZW5kcG9pbnRzLnB1c2goZW5kcG9pbnRzLnNwbGljZSgwLCAxKVswXSk7IC8vU3dhcCBwb2ludCAwIGFuZCBwb2ludCAxXG4gICAgfVxuXG4gICAgaWYgKF9pc1BvaW50SW5EaXJGcm9tKGVuZHBvaW50c1swXSwgcmVjdC5nZXRUb3BMZWZ0KCksIF9yZXZlcnNlRGlyKGRpcikpKSB7XG4gICAgICAgIGVuZHBvaW50c1swXS5hc3NpZ24ocmVjdC5nZXRUb3BMZWZ0KCkpO1xuICAgIH1cblxuICAgIGlmIChfaXNQb2ludEluRGlyRnJvbShlbmRwb2ludHNbMV0sIHJlY3QuZ2V0Qm90dG9tUmlnaHQoKSwgZGlyKSkge1xuICAgICAgICBlbmRwb2ludHNbMV0uYXNzaWduKHJlY3QuZ2V0Qm90dG9tUmlnaHQoKSk7XG4gICAgfVxuXG4gICAgaWYgKF9pc0hvcml6b250YWwoZGlyKSkge1xuICAgICAgICBlbmRwb2ludHNbMF0ueSA9IHN0YXJ0Lnk7XG4gICAgICAgIGVuZHBvaW50c1sxXS55ID0gZW5kLnk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgZW5kcG9pbnRzWzBdLnggPSBzdGFydC54O1xuICAgICAgICBlbmRwb2ludHNbMV0ueCA9IGVuZC54O1xuICAgIH1cblxuICAgIHJldHVybiBlbmRwb2ludHM7XG5cbn07XG5cbnZhciBfaW50ZXJzZWN0ID0gZnVuY3Rpb24gKGExLCBhMiwgYjEsIGIyKSB7XG4gICAgcmV0dXJuIE1hdGgubWluKGExLCBhMikgPD0gTWF0aC5tYXgoYjEsIGIyKSAmJiBNYXRoLm1pbihiMSwgYjIpIDw9IE1hdGgubWF4KGExLCBhMik7XG59O1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gUm91dGluZ0RpcmVjdGlvblxuXG52YXIgX2lzSG9yaXpvbnRhbCA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICByZXR1cm4gZGlyID09PSBDT05TVEFOVFMuRGlyUmlnaHQgfHwgZGlyID09PSBDT05TVEFOVFMuRGlyTGVmdDtcbn07XG5cbnZhciBfaXNWZXJ0aWNhbCA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICByZXR1cm4gZGlyID09PSBDT05TVEFOVFMuRGlyVG9wIHx8IGRpciA9PT0gQ09OU1RBTlRTLkRpckJvdHRvbTtcbn07XG5cbnZhciBfaXNSaWdodEFuZ2xlID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHJldHVybiBDT05TVEFOVFMuRGlyVG9wIDw9IGRpciAmJiBkaXIgPD0gQ09OU1RBTlRTLkRpckxlZnQ7XG59O1xuXG52YXIgX2FyZUluUmlnaHRBbmdsZSA9IGZ1bmN0aW9uIChkaXIxLCBkaXIyKSB7XG4gICAgYXNzZXJ0KF9pc1JpZ2h0QW5nbGUoZGlyMSkgJiYgX2lzUmlnaHRBbmdsZShkaXIyKSxcbiAgICAgICAgJ0FySGVscGVyLmFyZUluUmlnaHRBbmdsZTogX2lzUmlnaHRBbmdsZShkaXIxKSAmJiBfaXNSaWdodEFuZ2xlKGRpcjIpIEZBSUxFRCcpO1xuICAgIHJldHVybiBfaXNIb3Jpem9udGFsKGRpcjEpID09PSBfaXNWZXJ0aWNhbChkaXIyKTtcbn07XG5cbnZhciBfbmV4dENsb2Nrd2lzZURpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICBpZiAoX2lzUmlnaHRBbmdsZShkaXIpKSB7XG4gICAgICAgIHJldHVybiAoKGRpciArIDEpICUgNCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRpcjtcbn07XG5cbnZhciBfcHJldkNsb2Nrd2lzZURpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICBpZiAoX2lzUmlnaHRBbmdsZShkaXIpKSB7XG4gICAgICAgIHJldHVybiAoKGRpciArIDMpICUgNCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRpcjtcbn07XG5cbnZhciBfcmV2ZXJzZURpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICBpZiAoX2lzUmlnaHRBbmdsZShkaXIpKSB7XG4gICAgICAgIHJldHVybiAoKGRpciArIDIpICUgNCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRpcjtcbn07XG5cbnZhciBfc3RlcE9uZUluRGlyID0gZnVuY3Rpb24gKHBvaW50LCBkaXIpIHtcbiAgICBhc3NlcnQoX2lzUmlnaHRBbmdsZShkaXIpLCAnQXJIZWxwZXIuc3RlcE9uSW5EaXI6IF9pc1JpZ2h0QW5nbGUoZGlyKSBGQUlMRUQnKTtcblxuICAgIHN3aXRjaCAoZGlyKSB7XG4gICAgICAgIGNhc2UgQ09OU1RBTlRTLkRpclRvcDpcbiAgICAgICAgICAgIHBvaW50LnktLTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgQ09OU1RBTlRTLkRpclJpZ2h0OlxuICAgICAgICAgICAgcG9pbnQueCsrO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSBDT05TVEFOVFMuRGlyQm90dG9tOlxuICAgICAgICAgICAgcG9pbnQueSsrO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSBDT05TVEFOVFMuRGlyTGVmdDpcbiAgICAgICAgICAgIHBvaW50LngtLTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgIH1cblxufTtcblxudmFyIF9nZXRDaGlsZFJlY3RPdXRlckNvb3JkRnJvbSA9IGZ1bmN0aW9uIChidWZmZXJPYmplY3QsIGluRGlyLCBwb2ludCkgeyAvL1BvaW50IHRyYXZlbHMgaW5EaXIgdW50aWwgaGl0cyBjaGlsZCBib3hcbiAgICB2YXIgY2hpbGRyZW4gPSBidWZmZXJPYmplY3QuY2hpbGRyZW4sXG4gICAgICAgIGkgPSAtMSxcbiAgICAgICAgYm94ID0gbnVsbCxcbiAgICAgICAgcmVzID0gX2dldFJlY3RPdXRlckNvb3JkKGJ1ZmZlck9iamVjdC5ib3gsIGluRGlyKTtcblxuICAgIGFzc2VydChfaXNSaWdodEFuZ2xlKGluRGlyKSwgJ2dldENoaWxkUmVjdE91dGVyQ29vcmRGcm9tOiBfaXNSaWdodEFuZ2xlKGluRGlyKSBGQUlMRUQnKTtcbiAgICAvL1RoZSBuZXh0IGFzc2VydCBmYWlscyBpZiB0aGUgcG9pbnQgaXMgaW4gdGhlIG9wcG9zaXRlIGRpcmVjdGlvbiBvZiB0aGUgcmVjdGFuZ2xlIHRoYXQgaXQgaXMgY2hlY2tpbmcuXG4gICAgLy8gZS5nLiBUaGUgcG9pbnQgaXMgY2hlY2tpbmcgd2hlbiBpdCB3aWxsIGhpdCB0aGUgYm94IGZyb20gdGhlIHJpZ2h0IGJ1dCB0aGUgcG9pbnQgaXMgb24gdGhlIGxlZnRcbiAgICBhc3NlcnQoIV9pc1BvaW50SW5EaXJGcm9tKHBvaW50LCBidWZmZXJPYmplY3QuYm94LCBpbkRpciksXG4gICAgICAgICdnZXRDaGlsZFJlY3RPdXRlckNvb3JkRnJvbTogIWlzUG9pbnRJbkRpckZyb20ocG9pbnQsIGJ1ZmZlck9iamVjdC5ib3gucmVjdCwgKGluRGlyKSkgRkFJTEVEJyk7XG5cbiAgICB3aGlsZSAoKytpIDwgY2hpbGRyZW4ubGVuZ3RoKSB7XG5cbiAgICAgICAgaWYgKF9pc1BvaW50SW5EaXJGcm9tKHBvaW50LCBjaGlsZHJlbltpXSwgX3JldmVyc2VEaXIoaW5EaXIpKSAmJlxuICAgICAgICAgICAgX2lzUG9pbnRCZXR3ZWVuU2lkZXMocG9pbnQsIGNoaWxkcmVuW2ldLCBpbkRpcikgJiZcbiAgICAgICAgICAgIF9pc0Nvb3JkSW5EaXJGcm9tKHJlcywgX2dldFJlY3RPdXRlckNvb3JkKGNoaWxkcmVuW2ldLCBfcmV2ZXJzZURpcihpbkRpcikpLCAoaW5EaXIpKSkge1xuXG4gICAgICAgICAgICByZXMgPSBfZ2V0UmVjdE91dGVyQ29vcmQoY2hpbGRyZW5baV0sIF9yZXZlcnNlRGlyKGluRGlyKSk7XG4gICAgICAgICAgICBib3ggPSBjaGlsZHJlbltpXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB7J2JveCc6IGJveCwgJ2Nvb3JkJzogcmVzfTtcbn07XG5cbnZhciBfZ2V0UmVjdE91dGVyQ29vcmQgPSBmdW5jdGlvbiAocmVjdCwgZGlyKSB7XG4gICAgYXNzZXJ0KF9pc1JpZ2h0QW5nbGUoZGlyKSwgJ1V0aWxzLmdldFJlY3RPdXRlckNvb3JkOiBpc1JpZ2h0QW5nbGUoZGlyKSBGQUlMRUQnKTtcbiAgICB2YXIgdCA9IHJlY3QuY2VpbCAtIDEsXG4gICAgICAgIHIgPSByZWN0LnJpZ2h0ICsgMSxcbiAgICAgICAgYiA9IHJlY3QuZmxvb3IgKyAxLFxuICAgICAgICBsID0gcmVjdC5sZWZ0IC0gMTtcblxuICAgIHN3aXRjaCAoZGlyKSB7XG4gICAgICAgIGNhc2UgQ09OU1RBTlRTLkRpclRvcDpcbiAgICAgICAgICAgIHJldHVybiB0O1xuXG4gICAgICAgIGNhc2UgQ09OU1RBTlRTLkRpclJpZ2h0OlxuICAgICAgICAgICAgcmV0dXJuIHI7XG5cbiAgICAgICAgY2FzZSBDT05TVEFOVFMuRGlyQm90dG9tOlxuICAgICAgICAgICAgcmV0dXJuIGI7XG4gICAgfVxuXG4gICAgcmV0dXJuIGw7XG59O1xuXG4vL1x0SW5kZXhlczpcbi8vXHRcdFx0XHQgMDRcbi8vXHRcdFx0XHQxICA1XG4vL1x0XHRcdFx0MyAgN1xuLy9cdFx0XHRcdCAyNlxuXG52YXIgZ2V0RGlyVGFibGVJbmRleCA9IGZ1bmN0aW9uIChvZmZzZXQpIHtcbiAgICByZXR1cm4gKG9mZnNldC5jeCA+PSAwKSAqIDQgKyAob2Zmc2V0LmN5ID49IDApICogMiArIChNYXRoLmFicyhvZmZzZXQuY3gpID49IE1hdGguYWJzKG9mZnNldC5jeSkpO1xufTtcblxudmFyIG1ham9yRGlyVGFibGUgPVxuICAgIFtcbiAgICAgICAgQ09OU1RBTlRTLkRpclRvcCxcbiAgICAgICAgQ09OU1RBTlRTLkRpckxlZnQsXG4gICAgICAgIENPTlNUQU5UUy5EaXJCb3R0b20sXG4gICAgICAgIENPTlNUQU5UUy5EaXJMZWZ0LFxuICAgICAgICBDT05TVEFOVFMuRGlyVG9wLFxuICAgICAgICBDT05TVEFOVFMuRGlyUmlnaHQsXG4gICAgICAgIENPTlNUQU5UUy5EaXJCb3R0b20sXG4gICAgICAgIENPTlNUQU5UUy5EaXJSaWdodFxuICAgIF07XG5cbnZhciBfZ2V0TWFqb3JEaXIgPSBmdW5jdGlvbiAob2Zmc2V0KSB7XG4gICAgcmV0dXJuIG1ham9yRGlyVGFibGVbZ2V0RGlyVGFibGVJbmRleChvZmZzZXQpXTtcbn07XG5cbnZhciBtaW5vckRpclRhYmxlID1cbiAgICBbXG4gICAgICAgIENPTlNUQU5UUy5EaXJMZWZ0LFxuICAgICAgICBDT05TVEFOVFMuRGlyVG9wLFxuICAgICAgICBDT05TVEFOVFMuRGlyTGVmdCxcbiAgICAgICAgQ09OU1RBTlRTLkRpckJvdHRvbSxcbiAgICAgICAgQ09OU1RBTlRTLkRpclJpZ2h0LFxuICAgICAgICBDT05TVEFOVFMuRGlyVG9wLFxuICAgICAgICBDT05TVEFOVFMuRGlyUmlnaHQsXG4gICAgICAgIENPTlNUQU5UUy5EaXJCb3R0b21cbiAgICBdO1xuXG52YXIgX2dldE1pbm9yRGlyID0gZnVuY3Rpb24gKG9mZnNldCkge1xuICAgIHJldHVybiBtaW5vckRpclRhYmxlW2dldERpclRhYmxlSW5kZXgob2Zmc2V0KV07XG59O1xuXG4vL1x0RkcxMjNcbi8vXHRFICAgNFxuLy9cdEQgMCA1XG4vL1x0QyAgIDZcbi8vICBCQTk4N1xuXG5cbnZhciBfZXhHZXREaXJUYWJsZUluZGV4ID0gZnVuY3Rpb24gKG9mZnNldCkge1xuICAgIC8vVGhpcyByZXF1aXJlZCBhIHZhcmlhYmxlIGFzc2lnbm1lbnQ7IG90aGVyd2lzZSB0aGlzIGZ1bmN0aW9uXG4gICAgLy9yZXR1cm5lZCB1bmRlZmluZWQuLi5cbiAgICB2YXIgcmVzID1cbiAgICAgICAgb2Zmc2V0LmN4ID4gMCA/XG4gICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgb2Zmc2V0LmN5ID4gMCA/XG4gICAgICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgICAgIG9mZnNldC5jeCA+IG9mZnNldC5jeSA/XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA2XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKG9mZnNldC5jeCA8IG9mZnNldC5jeSA/XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKSlcbiAgICAgICAgICAgICAgICAgICAgKSA6XG4gICAgICAgICAgICAgICAgICAgIChvZmZzZXQuY3kgPCAwID9cbiAgICAgICAgICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvZmZzZXQuY3ggPiAtb2Zmc2V0LmN5ID9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgNFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKG9mZnNldC5jeCA8IC1vZmZzZXQuY3kgP1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICkpXG4gICAgICAgICAgICAgICAgICAgICAgICApIDpcbiAgICAgICAgICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA1XG4gICAgICAgICAgICAgICAgICAgICAgICApKVxuICAgICAgICAgICAgKSA6XG4gICAgICAgICAgICAob2Zmc2V0LmN4IDwgMCA/XG4gICAgICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgICAgICBvZmZzZXQuY3kgPiAwID9cbiAgICAgICAgICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAtb2Zmc2V0LmN4ID4gb2Zmc2V0LmN5ID9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMTJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICgtb2Zmc2V0LmN4IDwgb2Zmc2V0LmN5ID9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAxMFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMTFcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICkpXG4gICAgICAgICAgICAgICAgICAgICAgICApIDpcbiAgICAgICAgICAgICAgICAgICAgICAgIChvZmZzZXQuY3kgPCAwID9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9mZnNldC5jeCA8IG9mZnNldC5jeSA/XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMTRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKG9mZnNldC5jeCA+IG9mZnNldC5jeSA/XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAxNlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMTVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMTNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApKVxuICAgICAgICAgICAgICAgICkgOlxuICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgb2Zmc2V0LmN5ID4gMCA/XG4gICAgICAgICAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgOVxuICAgICAgICAgICAgICAgICAgICAgICAgKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAob2Zmc2V0LmN5IDwgMCA/XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAxXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKSlcbiAgICAgICAgICAgICAgICApKTtcblxuICAgIHJldHVybiByZXM7XG59O1xudmFyIGV4TWFqb3JEaXJUYWJsZSA9XG4gICAgW1xuICAgICAgICBDT05TVEFOVFMuRGlyTm9uZSxcbiAgICAgICAgQ09OU1RBTlRTLkRpclRvcCxcbiAgICAgICAgQ09OU1RBTlRTLkRpclRvcCxcbiAgICAgICAgQ09OU1RBTlRTLkRpclJpZ2h0LFxuICAgICAgICBDT05TVEFOVFMuRGlyUmlnaHQsXG4gICAgICAgIENPTlNUQU5UUy5EaXJSaWdodCxcbiAgICAgICAgQ09OU1RBTlRTLkRpclJpZ2h0LFxuICAgICAgICBDT05TVEFOVFMuRGlyUmlnaHQsXG4gICAgICAgIENPTlNUQU5UUy5EaXJCb3R0b20sXG4gICAgICAgIENPTlNUQU5UUy5EaXJCb3R0b20sXG4gICAgICAgIENPTlNUQU5UUy5EaXJCb3R0b20sXG4gICAgICAgIENPTlNUQU5UUy5EaXJMZWZ0LFxuICAgICAgICBDT05TVEFOVFMuRGlyTGVmdCxcbiAgICAgICAgQ09OU1RBTlRTLkRpckxlZnQsXG4gICAgICAgIENPTlNUQU5UUy5EaXJMZWZ0LFxuICAgICAgICBDT05TVEFOVFMuRGlyTGVmdCxcbiAgICAgICAgQ09OU1RBTlRTLkRpclRvcFxuICAgIF07XG5cbnZhciBfZXhHZXRNYWpvckRpciA9IGZ1bmN0aW9uIChvZmZzZXQpIHtcbiAgICByZXR1cm4gZXhNYWpvckRpclRhYmxlW19leEdldERpclRhYmxlSW5kZXgob2Zmc2V0KV07XG59O1xuXG52YXIgZXhNaW5vckRpclRhYmxlID1cbiAgICBbXG4gICAgICAgIENPTlNUQU5UUy5EaXJOb25lLFxuICAgICAgICBDT05TVEFOVFMuRGlyTm9uZSxcbiAgICAgICAgQ09OU1RBTlRTLkRpclJpZ2h0LFxuICAgICAgICBDT05TVEFOVFMuRGlyVG9wLFxuICAgICAgICBDT05TVEFOVFMuRGlyVG9wLFxuICAgICAgICBDT05TVEFOVFMuRGlyTm9uZSxcbiAgICAgICAgQ09OU1RBTlRTLkRpckJvdHRvbSxcbiAgICAgICAgQ09OU1RBTlRTLkRpckJvdHRvbSxcbiAgICAgICAgQ09OU1RBTlRTLkRpclJpZ2h0LFxuICAgICAgICBDT05TVEFOVFMuRGlyTm9uZSxcbiAgICAgICAgQ09OU1RBTlRTLkRpckxlZnQsXG4gICAgICAgIENPTlNUQU5UUy5EaXJCb3R0b20sXG4gICAgICAgIENPTlNUQU5UUy5EaXJCb3R0b20sXG4gICAgICAgIENPTlNUQU5UUy5EaXJOb25lLFxuICAgICAgICBDT05TVEFOVFMuRGlyVG9wLFxuICAgICAgICBDT05TVEFOVFMuRGlyVG9wLFxuICAgICAgICBDT05TVEFOVFMuRGlyTGVmdFxuICAgIF07XG5cbnZhciBfZXhHZXRNaW5vckRpciA9IGZ1bmN0aW9uIChvZmZzZXQpIHtcbiAgICByZXR1cm4gZXhNaW5vckRpclRhYmxlW19leEdldERpclRhYmxlSW5kZXgob2Zmc2V0KV07XG59O1xuXG52YXIgX2dldERpciA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vZGlyKSB7XG4gICAgaWYgKG9mZnNldC5jeCA9PT0gMCkge1xuICAgICAgICBpZiAob2Zmc2V0LmN5ID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gbm9kaXI7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob2Zmc2V0LmN5IDwgMCkge1xuICAgICAgICAgICAgcmV0dXJuIENPTlNUQU5UUy5EaXJUb3A7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gQ09OU1RBTlRTLkRpckJvdHRvbTtcbiAgICB9XG5cbiAgICBpZiAob2Zmc2V0LmN5ID09PSAwKSB7XG4gICAgICAgIGlmIChvZmZzZXQuY3ggPiAwKSB7XG4gICAgICAgICAgICByZXR1cm4gQ09OU1RBTlRTLkRpclJpZ2h0O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIENPTlNUQU5UUy5EaXJMZWZ0O1xuICAgIH1cblxuICAgIHJldHVybiBDT05TVEFOVFMuRGlyU2tldztcbn07XG5cbnZhciBfaXNQb2ludEluRGlyRnJvbUNoaWxkcmVuID0gZnVuY3Rpb24gKHBvaW50LCBmcm9tUGFyZW50LCBkaXIpIHtcbiAgICB2YXIgY2hpbGRyZW4gPSBmcm9tUGFyZW50LmNoaWxkcmVuLFxuICAgICAgICBpID0gMDtcblxuICAgIGFzc2VydChfaXNSaWdodEFuZ2xlKGRpciksICdpc1BvaW50SW5EaXJGcm9tQ2hpbGRyZW46IF9pc1JpZ2h0QW5nbGUoZGlyKSBGQUlMRUQnKTtcblxuICAgIHdoaWxlIChpIDwgY2hpbGRyZW4ubGVuZ3RoKSB7XG4gICAgICAgIGlmIChfaXNQb2ludEluRGlyRnJvbShwb2ludCwgY2hpbGRyZW5baV0ucmVjdCwgZGlyKSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgKytpO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbn07XG5cbnZhciBfaXNQb2ludEluRGlyRnJvbSA9IGZ1bmN0aW9uIChwb2ludCwgZnJvbSwgZGlyKSB7XG4gICAgaWYgKGZyb20gaW5zdGFuY2VvZiBBclJlY3QpIHtcbiAgICAgICAgdmFyIHJlY3QgPSBmcm9tO1xuICAgICAgICBhc3NlcnQoX2lzUmlnaHRBbmdsZShkaXIpLCAnQXJIZWxwZXIuaXNQb2ludEluRGlyRnJvbTogX2lzUmlnaHRBbmdsZShkaXIpIEZBSUxFRCcpO1xuXG4gICAgICAgIHN3aXRjaCAoZGlyKSB7XG4gICAgICAgICAgICBjYXNlIENPTlNUQU5UUy5EaXJUb3A6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBvaW50LnkgPCByZWN0LmNlaWw7XG5cbiAgICAgICAgICAgIGNhc2UgQ09OU1RBTlRTLkRpclJpZ2h0OlxuICAgICAgICAgICAgICAgIHJldHVybiBwb2ludC54ID49IHJlY3QucmlnaHQ7XG5cbiAgICAgICAgICAgIGNhc2UgQ09OU1RBTlRTLkRpckJvdHRvbTpcbiAgICAgICAgICAgICAgICByZXR1cm4gcG9pbnQueSA+PSByZWN0LmZsb29yO1xuXG4gICAgICAgICAgICBjYXNlIENPTlNUQU5UUy5EaXJMZWZ0OlxuICAgICAgICAgICAgICAgIHJldHVybiBwb2ludC54IDwgcmVjdC5sZWZ0O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgICAgYXNzZXJ0KF9pc1JpZ2h0QW5nbGUoZGlyKSwgJ0FySGVscGVyLmlzUG9pbnRJbkRpckZyb206IF9pc1JpZ2h0QW5nbGUoZGlyKSBGQUlMRUQnKTtcblxuICAgICAgICBzd2l0Y2ggKGRpcikge1xuICAgICAgICAgICAgY2FzZSBDT05TVEFOVFMuRGlyVG9wOlxuICAgICAgICAgICAgICAgIHJldHVybiBwb2ludC55IDw9IGZyb20ueTtcblxuICAgICAgICAgICAgY2FzZSBDT05TVEFOVFMuRGlyUmlnaHQ6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBvaW50LnggPj0gZnJvbS54O1xuXG4gICAgICAgICAgICBjYXNlIENPTlNUQU5UUy5EaXJCb3R0b206XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBvaW50LnkgPj0gZnJvbS55O1xuXG4gICAgICAgICAgICBjYXNlIENPTlNUQU5UUy5EaXJMZWZ0OlxuICAgICAgICAgICAgICAgIHJldHVybiBwb2ludC54IDw9IGZyb20ueDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgIH1cbn07XG5cbnZhciBfaXNQb2ludEJldHdlZW5TaWRlcyA9IGZ1bmN0aW9uIChwb2ludCwgcmVjdCwgaXNob3Jpem9udGFsKSB7XG4gICAgaWYgKGlzaG9yaXpvbnRhbCA9PT0gdHJ1ZSB8fCBfaXNIb3Jpem9udGFsKGlzaG9yaXpvbnRhbCkpIHtcbiAgICAgICAgcmV0dXJuIHJlY3QuY2VpbCA8PSBwb2ludC55ICYmIHBvaW50LnkgPCByZWN0LmZsb29yO1xuICAgIH1cblxuICAgIHJldHVybiByZWN0LmxlZnQgPD0gcG9pbnQueCAmJiBwb2ludC54IDwgcmVjdC5yaWdodDtcbn07XG5cbnZhciBfaXNDb29yZEluRGlyRnJvbSA9IGZ1bmN0aW9uIChjb29yZCwgZnJvbSwgZGlyKSB7XG4gICAgYXNzZXJ0KF9pc1JpZ2h0QW5nbGUoZGlyKSwgJ0FySGVscGVyLmlzQ29vcmRJbkRpckZyb206IF9pc1JpZ2h0QW5nbGUoZGlyKSBGQUlMRUQnKTtcbiAgICBpZiAoZnJvbSBpbnN0YW5jZW9mIEFyUG9pbnQpIHtcbiAgICAgICAgZnJvbSA9IF9nZXRQb2ludENvb3JkKGZyb20sIGRpcik7XG4gICAgfVxuXG4gICAgaWYgKGRpciA9PT0gQ09OU1RBTlRTLkRpclRvcCB8fCBkaXIgPT09IENPTlNUQU5UUy5EaXJMZWZ0KSB7XG4gICAgICAgIHJldHVybiBjb29yZCA8PSBmcm9tO1xuICAgIH1cblxuICAgIHJldHVybiBjb29yZCA+PSBmcm9tO1xufTtcblxuLy8gVGhpcyBuZXh0IG1ldGhvZCBvbmx5IHN1cHBvcnRzIHVuYW1iaWd1b3VzIG9yaWVudGF0aW9ucy4gVGhhdCBpcywgdGhlIHBvaW50XG4vLyBjYW5ub3QgYmUgaW4gYSBjb3JuZXIgb2YgdGhlIHJlY3RhbmdsZS5cbi8vIE5PVEU6IHRoZSByaWdodCBhbmQgZmxvb3IgdXNlZCB0byBiZSAtIDEuIFxudmFyIF9vbldoaWNoRWRnZSA9IGZ1bmN0aW9uIChyZWN0LCBwb2ludCkge1xuICAgIGlmIChwb2ludC55ID09PSByZWN0LmNlaWwgJiYgcmVjdC5sZWZ0IDwgcG9pbnQueCAmJiBwb2ludC54IDwgcmVjdC5yaWdodCkge1xuICAgICAgICByZXR1cm4gQ09OU1RBTlRTLkRpclRvcDtcbiAgICB9XG5cbiAgICBpZiAocG9pbnQueSA9PT0gcmVjdC5mbG9vciAmJiByZWN0LmxlZnQgPCBwb2ludC54ICYmIHBvaW50LnggPCByZWN0LnJpZ2h0KSB7XG4gICAgICAgIHJldHVybiBDT05TVEFOVFMuRGlyQm90dG9tO1xuICAgIH1cblxuICAgIGlmIChwb2ludC54ID09PSByZWN0LmxlZnQgJiYgcmVjdC5jZWlsIDwgcG9pbnQueSAmJiBwb2ludC55IDwgcmVjdC5mbG9vcikge1xuICAgICAgICByZXR1cm4gQ09OU1RBTlRTLkRpckxlZnQ7XG4gICAgfVxuXG4gICAgaWYgKHBvaW50LnggPT09IHJlY3QucmlnaHQgJiYgcmVjdC5jZWlsIDwgcG9pbnQueSAmJiBwb2ludC55IDwgcmVjdC5mbG9vcikge1xuICAgICAgICByZXR1cm4gQ09OU1RBTlRTLkRpclJpZ2h0O1xuICAgIH1cblxuICAgIHJldHVybiBDT05TVEFOVFMuRGlyTm9uZTtcbn07XG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gQ0FyRmluZE5lYXJlc3RMaW5lXG5cbnZhciBBckZpbmROZWFyZXN0TGluZSA9IGZ1bmN0aW9uIChwdCkge1xuICAgIHRoaXMucG9pbnQgPSBwdDtcbiAgICB0aGlzLmRpc3QxID0gSW5maW5pdHk7XG4gICAgdGhpcy5kaXN0MiA9IEluZmluaXR5O1xufTtcblxuQXJGaW5kTmVhcmVzdExpbmUucHJvdG90eXBlLmhMaW5lID0gZnVuY3Rpb24gKHgxLCB4MiwgeSkge1xuICAgIGFzc2VydCh4MSA8PSB4MiwgJ0FyRmluZE5lYXJlc3RMaW5lLmhMaW5lOiB4MSA8PSB4MiAgRkFJTEVEJyk7XG5cbiAgICB2YXIgZDEgPSBfZGlzdGFuY2VGcm9tSExpbmUodGhpcy5wb2ludCwgeDEsIHgyLCB5KSxcbiAgICAgICAgZDIgPSBNYXRoLmFicyh0aGlzLnBvaW50LnkgLSB5KTtcblxuICAgIGlmIChkMSA8IHRoaXMuZGlzdDEgfHwgKGQxID09PSB0aGlzLmRpc3QxICYmIGQyIDwgdGhpcy5kaXN0MikpIHtcbiAgICAgICAgdGhpcy5kaXN0MSA9IGQxO1xuICAgICAgICB0aGlzLmRpc3QyID0gZDI7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbn07XG5cbkFyRmluZE5lYXJlc3RMaW5lLnByb3RvdHlwZS52TGluZSA9IGZ1bmN0aW9uICh5MSwgeTIsIHgpIHtcbiAgICBhc3NlcnQoeTEgPD0geTIsICdBckZpbmROZWFyZXN0TGluZS5oTGluZTogeTEgPD0geTIgRkFJTEVEJyk7XG5cbiAgICB2YXIgZDEgPSBfZGlzdGFuY2VGcm9tVkxpbmUodGhpcy5wb2ludCwgeTEsIHkyLCB4KSxcbiAgICAgICAgZDIgPSBNYXRoLmFicyh0aGlzLnBvaW50LnggLSB4KTtcblxuICAgIGlmIChkMSA8IHRoaXMuZGlzdDEgfHwgKGQxID09PSB0aGlzLmRpc3QxICYmIGQyIDwgdGhpcy5kaXN0MikpIHtcbiAgICAgICAgdGhpcy5kaXN0MSA9IGQxO1xuICAgICAgICB0aGlzLmRpc3QyID0gZDI7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbn07XG5cbkFyRmluZE5lYXJlc3RMaW5lLnByb3RvdHlwZS53YXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuZGlzdDEgPCBJbmZpbml0eSAmJiB0aGlzLmRpc3QyIDwgSW5maW5pdHk7XG59O1xuXG4vLyBDb252ZW5pZW5jZSBGdW5jdGlvbnNcbnZhciByZW1vdmVGcm9tQXJyYXlzID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgdmFyIGluZGV4LFxuICAgICAgICByZW1vdmVkID0gZmFsc2UsXG4gICAgICAgIGFycmF5O1xuXG4gICAgZm9yICh2YXIgaSA9IGFyZ3VtZW50cy5sZW5ndGggLSAxOyBpID4gMDsgaS0tKSB7XG4gICAgICAgIGFycmF5ID0gYXJndW1lbnRzW2ldO1xuICAgICAgICBpbmRleCA9IGFycmF5LmluZGV4T2YodmFsdWUpO1xuICAgICAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICAgICAgICBhcnJheS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgcmVtb3ZlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmVtb3ZlZDtcbn07XG5cbnZhciBzdHJpbmdpZnkgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodmFsdWUsIGZ1bmN0aW9uIChrZXksIHZhbHVlKSB7XG4gICAgICAgIGlmIChrZXkgPT09ICdvd25lcicgJiYgdmFsdWUpIHtcbiAgICAgICAgICAgIHJldHVybiB2YWx1ZS5pZCB8fCB0eXBlb2YgdmFsdWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH0pO1xufTtcblxuLyoqXG4gKiBSb3VuZCB0aGUgbnVtYmVyIHRvIHRoZSBnaXZlbiBkZWNpbWFsIHBsYWNlcy4gVHJ1bmNhdGUgZm9sbG93aW5nIGRpZ2l0cy5cbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gdmFsdWVcbiAqIEBwYXJhbSB7TnVtYmVyfSBwbGFjZXNcbiAqIEByZXR1cm4ge051bWJlcn0gcmVzdWx0XG4gKi9cbnZhciByb3VuZFRydW5jID0gZnVuY3Rpb24gKHZhbHVlLCBwbGFjZXMpIHtcbiAgICB2YWx1ZSA9ICt2YWx1ZTtcbiAgICB2YXIgc2NhbGUgPSBNYXRoLnBvdygxMCwgK3BsYWNlcyksXG4gICAgICAgIGZuID0gJ2Zsb29yJztcblxuICAgIGlmICh2YWx1ZSA8IDApIHtcbiAgICAgICAgZm4gPSAnY2VpbCc7XG4gICAgfVxuXG4gICAgcmV0dXJuIE1hdGhbZm5dKHZhbHVlICogc2NhbGUpIC8gc2NhbGU7XG59O1xuXG4vL0Zsb2F0IGVxdWFsc1xudmFyIGZsb2F0RXF1YWxzID0gZnVuY3Rpb24gKGEsIGIpIHtcbiAgICByZXR1cm4gKChhIC0gMC4xKSA8IGIpICYmIChiIDwgKGEgKyAwLjEpKTtcbn07XG5cbi8qKlxuICogQ29udmVydCBhbiBvYmplY3Qgd2l0aCBpbmNyZWFzaW5nIGludGVnZXIga2V5cyB0byBhbiBhcnJheS5cbiAqIFVzaW5nIG1ldGhvZCBmcm9tIGh0dHA6Ly9qc3BlcmYuY29tL2FyZ3VtZW50cy1wZXJmb3JtYW5jZS82XG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9ialxuICogQHJldHVybiB7QXJyYXl9XG4gKi9cbnZhciB0b0FycmF5ID0gZnVuY3Rpb24gKG9iaikge1xuICAgIHZhciByZXN1bHQgPSBuZXcgQXJyYXkob2JqLmxlbmd0aHx8MCksXG4gICAgICAgIGkgPSAwO1xuICAgIHdoaWxlIChvYmpbaV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXN1bHRbaV0gPSBvYmpbaSsrXTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbnZhciBwaWNrID0gZnVuY3Rpb24oa2V5cywgb2JqKSB7XG4gICAgdmFyIHJlcyA9IHt9O1xuICAgIGZvciAodmFyIGkgPSBrZXlzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICByZXNba2V5c1tpXV0gPSBvYmpba2V5c1tpXV07XG4gICAgfVxuICAgIHJldHVybiByZXM7XG59O1xuXG52YXIgbm9wID0gZnVuY3Rpb24oKSB7XG4gICAgLy8gbm9wXG59O1xuXG52YXIgYXNzZXJ0ID0gZnVuY3Rpb24oY29uZCwgbXNnKSB7XG4gICAgaWYgKCFjb25kKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihtc2cgfHwgJ0Fzc2VydCBmYWlsZWQnKTtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBvbldoaWNoRWRnZTogX29uV2hpY2hFZGdlLFxuICAgIGlzQ29vcmRJbkRpckZyb206IF9pc0Nvb3JkSW5EaXJGcm9tLFxuICAgIGlzUG9pbnRCZXR3ZWVuU2lkZXM6IF9pc1BvaW50QmV0d2VlblNpZGVzLFxuICAgIGlzUG9pbnRJbkRpckZyb206IF9pc1BvaW50SW5EaXJGcm9tLFxuICAgIGlzUG9pbnRJbkRpckZyb21DaGlsZHJlbjogX2lzUG9pbnRJbkRpckZyb21DaGlsZHJlbixcbiAgICBpc1BvaW50SW46IF9pc1BvaW50SW4sXG4gICAgaXNQb2ludE5lYXI6IF9pc1BvaW50TmVhcixcbiAgICBnZXREaXI6IF9nZXREaXIsXG4gICAgZXhHZXRNaW5vckRpcjogX2V4R2V0TWlub3JEaXIsXG4gICAgZXhHZXRNYWpvckRpcjogX2V4R2V0TWFqb3JEaXIsXG4gICAgZXhHZXREaXJUYWJsZUluZGV4OiBfZXhHZXREaXJUYWJsZUluZGV4LFxuICAgIGdldE1pbm9yRGlyOiBfZ2V0TWlub3JEaXIsXG4gICAgZ2V0TWFqb3JEaXI6IF9nZXRNYWpvckRpcixcbiAgICBnZXRSZWN0T3V0ZXJDb29yZDogX2dldFJlY3RPdXRlckNvb3JkLFxuICAgIGdldENoaWxkUmVjdE91dGVyQ29vcmRGcm9tOiBfZ2V0Q2hpbGRSZWN0T3V0ZXJDb29yZEZyb20sXG4gICAgc3RlcE9uZUluRGlyOiBfc3RlcE9uZUluRGlyLFxuICAgIHJldmVyc2VEaXI6IF9yZXZlcnNlRGlyLFxuICAgIHByZXZDbG9ja3dpc2VEaXI6IF9wcmV2Q2xvY2t3aXNlRGlyLFxuICAgIG5leHRDbG9ja3dpc2VEaXI6IF9uZXh0Q2xvY2t3aXNlRGlyLFxuICAgIGFyZUluUmlnaHRBbmdsZTogX2FyZUluUmlnaHRBbmdsZSxcbiAgICBpc1JpZ2h0QW5nbGU6IF9pc1JpZ2h0QW5nbGUsXG4gICAgaXNIb3Jpem9udGFsOiBfaXNIb3Jpem9udGFsLFxuICAgIGludGVyc2VjdDogX2ludGVyc2VjdCxcbiAgICBnZXRMaW5lQ2xpcFJlY3RJbnRlcnNlY3Q6IF9nZXRMaW5lQ2xpcFJlY3RJbnRlcnNlY3QsXG4gICAgaXNMaW5lQ2xpcFJlY3Q6IF9pc0xpbmVDbGlwUmVjdCxcbiAgICBpc0xpbmVDbGlwUmVjdHM6IF9pc0xpbmVDbGlwUmVjdHMsXG4gICAgaXNQb2ludE5lYXJMaW5lOiBfaXNQb2ludE5lYXJMaW5lLFxuICAgIGlzT25FZGdlOiBfaXNPbkVkZ2UsXG4gICAgZGlzdGFuY2VGcm9tTGluZTogX2Rpc3RhbmNlRnJvbUxpbmUsXG4gICAgaXNSZWN0Q2xpcDogX2lzUmVjdENsaXAsXG4gICAgaXNSZWN0SW46IF9pc1JlY3RJbixcbiAgICBpbmZsYXRlZFJlY3Q6IF9pbmZsYXRlZFJlY3QsXG4gICAgZ2V0UG9pbnRDb29yZDogX2dldFBvaW50Q29vcmQsXG4gICAgZ2V0T3B0aW1hbFBvcnRzOiBfZ2V0T3B0aW1hbFBvcnRzLFxuICAgIEFyRmluZE5lYXJlc3RMaW5lOiBBckZpbmROZWFyZXN0TGluZSxcblxuICAgIHJlbW92ZUZyb21BcnJheXM6IHJlbW92ZUZyb21BcnJheXMsXG4gICAgc3RyaW5naWZ5OiBzdHJpbmdpZnksXG4gICAgZmxvYXRFcXVhbHM6IGZsb2F0RXF1YWxzLFxuICAgIHJvdW5kVHJ1bmM6IHJvdW5kVHJ1bmMsXG4gICAgdG9BcnJheTogdG9BcnJheSxcbiAgICBub3A6IG5vcCxcbiAgICBhc3NlcnQ6IGFzc2VydCxcbiAgICBwaWNrOiBwaWNrIFxufTtcbiIsIi8qZ2xvYmFscyBkZWZpbmUqL1xuLypqc2hpbnQgYnJvd3NlcjogdHJ1ZSovXG5cbi8qKlxuICogQGF1dGhvciBicm9sbGIgLyBodHRwczovL2dpdGh1Yi9icm9sbGJcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBDT05TVEFOVFMgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuQ29uc3RhbnRzJyksXG4gICAgdXRpbHMgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuVXRpbHMnKSxcbiAgICBhc3NlcnQgPSB1dGlscy5hc3NlcnQsXG4gICAgQXJQb2ludCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Qb2ludCcpLFxuICAgIEFyUmVjdCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5SZWN0JyksXG4gICAgQXV0b1JvdXRlckdyYXBoID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLkdyYXBoJyksXG4gICAgQXV0b1JvdXRlclBvcnQgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUG9ydCcpO1xuXG52YXIgQXV0b1JvdXRlciA9IGZ1bmN0aW9uICgpIHtcbiAgICAvLyBpbnRlcm5hbCB0byBleHRlcm5hbCBpZHNcbiAgICB0aGlzLl9ib3hJZHMgPSB7fTtcbiAgICB0aGlzLl9wb3J0SWRzID0ge307XG4gICAgdGhpcy5fcGF0aElkcyA9IHt9O1xuXG4gICAgdGhpcy5fcGF0aHNUb1VwZGF0ZU9uRGVsZXRpb24gPSB7fTsgIC8vIHBvcnRJZHMgPT4gcGF0aHNcbiAgICB0aGlzLl9wYXRoc1RvVXBkYXRlT25BZGRpdGlvbiA9IHt9OyAgLy8gYm94SWRzID0+IHBhdGhzXG4gICAgdGhpcy5fcGF0aFNyYyA9IHt9O1xuICAgIHRoaXMuX3BhdGhEc3QgPSB7fTtcblxuICAgIHRoaXMuX2dyYXBoID0gbmV3IEF1dG9Sb3V0ZXJHcmFwaCgpO1xufTtcblxuLyogKiAqICogKiAqICogUHVibGljIEFQSSAqICogKiAqICogKiAqL1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLl9ncmFwaC5jbGVhcih0cnVlKTtcbiAgICB0aGlzLl9ib3hJZHMgPSB7fTtcbiAgICB0aGlzLl9wb3J0SWRzID0ge307XG4gICAgdGhpcy5fcGF0aElkcyA9IHt9O1xuXG4gICAgdGhpcy5fcGF0aHNUb1VwZGF0ZU9uRGVsZXRpb24gPSB7fTsgIC8vIHBvcnRJZHMgPT4gcGF0aHNcbiAgICB0aGlzLl9wYXRoc1RvVXBkYXRlT25BZGRpdGlvbiA9IHt9OyAgLy8gYm94SWRzID0+IHBhdGhzXG4gICAgdGhpcy5fcGF0aFNyYyA9IHt9O1xuICAgIHRoaXMuX3BhdGhEc3QgPSB7fTtcbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLnNldEJveCA9IGZ1bmN0aW9uKGlkLCByZWN0KSB7XG4gICAgdmFyIGJveDtcbiAgICBpZiAocmVjdCA9PT0gbnVsbCkgeyAgLy8gUmVtb3ZlIHRoZSBib3hcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JlbW92ZUJveChpZCk7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLl9ib3hJZHNbaWRdKSB7XG4gICAgICAgIGJveCA9IHRoaXMuX2NyZWF0ZUJveChyZWN0KTtcbiAgICAgICAgLy8gVXBkYXRlIHJlY29yZHNcbiAgICAgICAgdGhpcy5fYm94SWRzW2lkXSA9IGJveC5pZDtcbiAgICAgICAgdGhpcy5fcG9ydElkc1tpZF0gPSB7fTtcbiAgICAgICAgaWYgKHRoaXMuX3BhdGhzVG9VcGRhdGVPbkFkZGl0aW9uW2lkXSkge1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlUGF0aHNGb3JCb3goaWQpO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fdXBkYXRlQm94KGlkLCByZWN0KTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5ib3goaWQpO1xufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuc2V0RGVwZW5kZW50Qm94ID0gZnVuY3Rpb24ocGFyZW50SWQsIGNoaWxkSWQpIHtcbiAgICB2YXIgcGFyZW50ID0gdGhpcy5fYm94KHBhcmVudElkKSxcbiAgICAgICAgY2hpbGQgPSB0aGlzLl9ib3goY2hpbGRJZCk7XG5cbiAgICBhc3NlcnQocGFyZW50ICYmIGNoaWxkLCAnQ291bGQgbm90IGZpbmQgcGFyZW50IG9yIGNoaWxkJyk7XG4gICAgcGFyZW50LmFkZENoaWxkKGNoaWxkKTtcbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLm1vdmVCb3ggPSBmdW5jdGlvbihpZCwgeCwgeSkge1xuICAgIHZhciBib3ggPSB0aGlzLl9ib3goaWQpLFxuICAgICAgICByZWN0LFxuICAgICAgICBkeCxcbiAgICAgICAgZHk7XG5cbiAgICBpZiAoYm94KSB7XG4gICAgICAgIHJlY3QgPSBib3gucmVjdDtcbiAgICAgICAgZHggPSB4IC0gcmVjdC5sZWZ0O1xuICAgICAgICBkeSA9IHkgLSByZWN0LmNlaWw7XG4gICAgICAgIHRoaXMuX2dyYXBoLnNoaWZ0Qm94QnkoYm94LCB7Y3g6IGR4LCBjeTogZHl9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBFcnJvcihgQXV0b1JvdXRlcjogQ2Fubm90IGZpbmQgYm94ICR7aWR9XCIgdG8gbW92ZSFgKTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5zZXRQb3J0ID0gZnVuY3Rpb24oYm94SWQsIHBvcnRJZCwgYXJlYSkge1xuICAgIGlmIChhcmVhID09PSBudWxsKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yZW1vdmVQb3J0KGJveElkLCBwb3J0SWQpO1xuICAgIH1cblxuICAgIGFzc2VydCh0aGlzLl9ib3goYm94SWQpLCAnQm94IFwiJyArIGJveElkICsgJ1wiIGRvZXMgbm90IGV4aXN0Jyk7XG4gICAgaWYgKCF0aGlzLl9wb3J0SWRzW2JveElkXSB8fCAhdGhpcy5fcG9ydElkc1tib3hJZF1bcG9ydElkXSkge1xuICAgICAgICB0aGlzLl9jcmVhdGVQb3J0KGJveElkLCBwb3J0SWQsIGFyZWEpO1xuICAgICAgICBhc3NlcnQodGhpcy5fcG9ydChib3hJZCwgcG9ydElkKSwgJ1BvcnQgbm90IGFkZGVkIScpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX3VwZGF0ZVBvcnQoYm94SWQsIHBvcnRJZCwgYXJlYSk7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuc2V0UGF0aCA9IGZ1bmN0aW9uKGlkLCBzcmNJZCwgZHN0SWQpIHtcbiAgICBpZiAoc3JjSWQgPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JlbW92ZVBhdGgoaWQpO1xuICAgIH1cblxuICAgIGlmICghdGhpcy5fcGF0aElkc1tpZF0pIHtcbiAgICAgICAgdGhpcy5fY3JlYXRlUGF0aChpZCwgc3JjSWQsIGRzdElkKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl91cGRhdGVQYXRoKGlkLCBzcmNJZCwgZHN0SWQpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLnNldEN1c3RvbVJvdXRpbmcgPSBmdW5jdGlvbihpZCwgcG9pbnRzKSB7XG4gICAgdmFyIHBhdGggPSB0aGlzLl9wYXRoKGlkKTtcblxuICAgIGlmICghcGF0aCkge1xuICAgICAgICB0aHJvdyBFcnJvcignQXV0b1JvdXRlcjogTmVlZCB0byBoYXZlIGFuIEF1dG9Sb3V0ZXJQYXRoIHR5cGUgdG8gc2V0IGN1c3RvbSBwYXRoIHBvaW50cycpO1xuICAgIH1cblxuICAgIGlmIChwb2ludHMgPT09IG51bGwpIHtcbiAgICAgICAgcGF0aC5zZXRBdXRvUm91dGluZyh0cnVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9zZXRDdXN0b21QYXRoKHBhdGgsIHBvaW50cyk7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUucm91dGVTeW5jID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuX2dyYXBoLnJvdXRlU3luYygpO1xufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUucm91dGVBc3luYyA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgdGhpcy5fZ3JhcGgucm91dGVBc3luYyhvcHRpb25zKTtcbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLmJveCA9IGZ1bmN0aW9uIChpZCkge1xuICAgIHZhciBwQm94ID0gdGhpcy5fYm94KGlkKSwgIC8vIHByaXZhdGUgYm94XG4gICAgICAgIHJlY3Q7XG5cbiAgICBpZiAoIXBCb3gpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmVjdCA9IHBCb3gucmVjdDtcbiAgICByZXR1cm4ge1xuICAgICAgICBpZDogaWQsXG4gICAgICAgIHg6IHJlY3QubGVmdCxcbiAgICAgICAgd2lkdGg6IHJlY3QucmlnaHQgLSByZWN0LmxlZnQsXG4gICAgICAgIHk6IHJlY3QuY2VpbCxcbiAgICAgICAgaGVpZ2h0OiByZWN0LmZsb29yIC0gcmVjdC5jZWlsXG4gICAgfTtcbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLnBvcnQgPSBmdW5jdGlvbiAoYm94SWQsIGlkKSB7XG4gICAgdmFyIGNvbnRhaW5lciA9IHRoaXMuX3BvcnQoYm94SWQsIGlkKSxcbiAgICAgICAgcmVjdDtcblxuICAgIGlmICghY29udGFpbmVyKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJlY3QgPSBjb250YWluZXIucG9ydHNbMF0ucmVjdDtcblxuICAgIHJldHVybiB7XG4gICAgICAgIGlkOiBpZCxcbiAgICAgICAgeDogcmVjdC5sZWZ0LFxuICAgICAgICB3aWR0aDogcmVjdC5yaWdodCAtIHJlY3QubGVmdCxcbiAgICAgICAgeTogcmVjdC5jZWlsLFxuICAgICAgICBoZWlnaHQ6IHJlY3QuZmxvb3IgLSByZWN0LmNlaWxcbiAgICB9O1xufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUucGF0aCA9IGZ1bmN0aW9uIChpZCkge1xuICAgIHZhciBwYXRoID0gdGhpcy5fcGF0aChpZCk7XG4gICAgcmV0dXJuIHsgIC8vIFRPRE86IENvbnNpZGVyIGFkZGluZyBzcmMsIGRzdFxuICAgICAgICBpZDogaWQsXG4gICAgICAgIHBvaW50czogcGF0aC5wb2ludHMubWFwKGZ1bmN0aW9uKHB0KSB7XG4gICAgICAgICAgICByZXR1cm4gW3B0LngsIHB0LnldO1xuICAgICAgICB9KVxuICAgIH07XG59O1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5ib3hlcyA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fYm94SWRzKTtcbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLnBvcnRzID0gZnVuY3Rpb24gKGJveElkKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX3BvcnRJZHNbYm94SWRdKTtcbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLnBhdGhzID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLl9wYXRoSWRzKTtcbn07XG5cbi8qICogKiAqICogKiAqIFByaXZhdGUgQVBJICogKiAqICogKiAqICovXG5cbi8vIEdldHRlcnNcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuX2JveCA9IGZ1bmN0aW9uIChpZCkge1xuICAgIHZhciBwSWQgPSB0aGlzLl9ib3hJZHNbaWRdO1xuICAgIHJldHVybiB0aGlzLl9ncmFwaC5ib3hlc1twSWRdIHx8IG51bGw7XG59O1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5fcG9ydCA9IGZ1bmN0aW9uIChib3hJZCwgaWQpIHtcbiAgICBhc3NlcnQoYm94SWQgIT09IHVuZGVmaW5lZCAmJiBpZCAhPT0gdW5kZWZpbmVkLCAnTWlzc2luZyAnICsgKCFib3hJZCA/ICdib3hJZCcgOiAnaWQnKSk7XG4gICAgcmV0dXJuIHRoaXMuX3BvcnRJZHNbYm94SWRdW2lkXTtcbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLl9wYXRoID0gZnVuY3Rpb24gKGlkKSB7XG4gICAgdmFyIHBJZCA9IHRoaXMuX3BhdGhJZHNbaWRdO1xuICAgIGZvciAodmFyIGkgPSB0aGlzLl9ncmFwaC5wYXRocy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgaWYgKHRoaXMuX2dyYXBoLnBhdGhzW2ldLmlkID09PSBwSWQpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9ncmFwaC5wYXRoc1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbn07XG5cbi8vIEJveGVzXG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLl9jcmVhdGVCb3ggPSBmdW5jdGlvbiAocGFyYW1zKSB7XG4gICAgdmFyIHgxID0gcGFyYW1zLngxLFxuICAgICAgICB4MiA9IHBhcmFtcy54MixcbiAgICAgICAgeTEgPSBwYXJhbXMueTEsXG4gICAgICAgIHkyID0gcGFyYW1zLnkyLFxuICAgICAgICBib3ggPSB0aGlzLl9ncmFwaC5jcmVhdGVCb3goKSxcbiAgICAgICAgcmVjdCA9IG5ldyBBclJlY3QoeDEsIHkxLCB4MiwgeTIpO1xuXG4gICAgYXNzZXJ0KCFpc05hTih4MSArIHgyICsgeTEgKyB5MiksICdNaXNzaW5nIHNpemUgaW5mbyBmb3IgYm94Jyk7XG5cbiAgICB0aGlzLl9zZXRWYWxpZFJlY3RTaXplKHJlY3QpO1xuICAgIGJveC5zZXRSZWN0KHJlY3QpO1xuXG4gICAgLy8gQWRkIHRoZSBib3ggdG8gdGhlIGdyYXBoXG4gICAgdGhpcy5fZ3JhcGguYWRkQm94KGJveCk7XG4gICAgLy8gUmVjb3JkIGtlZXBpbmcgaXMgbm90IGRvbmUgaW4gdGhpcyBmdW5jdGlvbiBiYyB0aGlzIGZ1bmN0aW9uXG4gICAgLy8gaXMgcmV1c2VkIGZvciB0aGUgcG9ydCBjb250YWluZXJzXG4gICAgcmV0dXJuIGJveDtcbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLl91cGRhdGVCb3ggPSBmdW5jdGlvbiAoaWQsIHBhcmFtcykgeyAgLy8gcHVibGljIGlkXG4gICAgdmFyIGJveCA9IHRoaXMuX2JveChpZCksXG4gICAgICAgIHJlY3QgPSBib3gucmVjdCxcbiAgICAgICAgbmV3V2lkdGggPSBwYXJhbXMueDIgLSBwYXJhbXMueDEsXG4gICAgICAgIG5ld0hlaWdodCA9IHBhcmFtcy55MiAtIHBhcmFtcy55MSxcbiAgICAgICAgZHgsXG4gICAgICAgIGR5LFxuICAgICAgICBuZXdSZWN0O1xuXG4gICAgLy8gU2hpZnRcbiAgICBpZiAobmV3SGVpZ2h0ID09PSByZWN0LmdldEhlaWdodCgpICYmIG5ld1dpZHRoID09PSByZWN0LmdldFdpZHRoKCkpIHtcbiAgICAgICAgZHggPSBwYXJhbXMueDEgLSByZWN0LmxlZnQ7XG4gICAgICAgIGR5ID0gcGFyYW1zLnkxIC0gcmVjdC5jZWlsO1xuICAgICAgICB0aGlzLl9ncmFwaC5zaGlmdEJveEJ5KGJveCwge2N4OiBkeCwgY3k6IGR5fSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbmV3UmVjdCA9IG5ldyBBclJlY3QocGFyYW1zLngxLCBwYXJhbXMueTEsIHBhcmFtcy54MiwgcGFyYW1zLnkyKTtcbiAgICAgICAgdGhpcy5fZ3JhcGguc2V0Qm94UmVjdChib3gsIG5ld1JlY3QpO1xuICAgIH1cblxufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuX3JlbW92ZUJveCA9IGZ1bmN0aW9uIChpZCkgeyAgLy8gcHVibGljIGlkXG4gICAgdmFyIGJveCA9IHRoaXMuX2JveChpZCksXG4gICAgICAgIHBvcnRzID0gT2JqZWN0LmtleXModGhpcy5fcG9ydElkc1tpZF0pO1xuXG4gICAgLy8gUmVtb3ZlIGFsbCBwb3J0c1xuICAgIGZvciAodmFyIGkgPSBwb3J0cy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgdGhpcy5fcmVtb3ZlUG9ydChpZCwgcG9ydHNbaV0pO1xuICAgIH1cblxuICAgIHRoaXMuX2dyYXBoLmRlbGV0ZUJveChib3gpO1xuICAgIGRlbGV0ZSB0aGlzLl9ib3hJZHNbaWRdO1xuICAgIGRlbGV0ZSB0aGlzLl9wb3J0SWRzW2lkXTtcblxuICAgIGlmICh0aGlzLl9wYXRoc1RvVXBkYXRlT25BZGRpdGlvbltpZF0gJiYgdGhpcy5fcGF0aHNUb1VwZGF0ZU9uQWRkaXRpb25baWRdLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBkZWxldGUgdGhpcy5fcGF0aHNUb1VwZGF0ZU9uQWRkaXRpb25baWRdO1xuICAgIH1cbn07XG5cbi8vIFBhdGhzXG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLl9jcmVhdGVQYXRoID0gZnVuY3Rpb24gKGlkLCBzcmNJZCwgZHN0SWQpIHsgIC8vIHB1YmxpYyBpZFxuICAgIHZhciBzcmNQb3J0cyA9IHRoaXMuX2dldFBvcnRzRm9yKHNyY0lkKSwgIC8vIEZJWE1FOiBzaG91bGQgYmUgYWJsZSB0byBzcGVjaWZ5IHBvcnRzXG4gICAgICAgIGRzdFBvcnRzID0gdGhpcy5fZ2V0UG9ydHNGb3IoZHN0SWQpLFxuICAgICAgICBwb3J0cyA9IHNyY1BvcnRzLmNvbmNhdChkc3RQb3J0cyksXG4gICAgICAgIHBhdGg7XG5cbiAgICBhc3NlcnQoc3JjUG9ydHMsICdNaXNzaW5nIHNyY1BvcnRzICgnICsgc3JjUG9ydHMgKyAnKScpO1xuICAgIGFzc2VydChkc3RQb3J0cywgJ01pc3NpbmcgZHN0UG9ydHMgKCcgKyBkc3RQb3J0cyArICcpJyk7XG5cbiAgICBwYXRoID0gdGhpcy5fZ3JhcGguYWRkUGF0aCh0cnVlLCBzcmNQb3J0cywgZHN0UG9ydHMpO1xuICAgIHBhdGguaWQgPSBpZDtcbiAgICB0aGlzLl9wYXRoSWRzW2lkXSA9IHBhdGguaWQ7XG5cbiAgICAvLyBVcGRhdGUgdGhlIHVwZGF0ZXMgZGljdGlvbmFyaWVzXG4gICAgZm9yICh2YXIgaSA9IHBvcnRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICBpZiAoIXRoaXMuX3BhdGhzVG9VcGRhdGVPbkRlbGV0aW9uW3BvcnRzW2ldLmlkXSkge1xuICAgICAgICAgICAgdGhpcy5fcGF0aHNUb1VwZGF0ZU9uRGVsZXRpb25bcG9ydHNbaV0uaWRdID0gW107XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fcGF0aHNUb1VwZGF0ZU9uRGVsZXRpb25bcG9ydHNbaV0uaWRdLnB1c2gocGF0aCk7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBzcmNJZCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9wYXRoc1RvVXBkYXRlT25BZGRpdGlvbltzcmNJZF0pIHtcbiAgICAgICAgICAgIHRoaXMuX3BhdGhzVG9VcGRhdGVPbkFkZGl0aW9uW3NyY0lkXSA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3BhdGhzVG9VcGRhdGVPbkFkZGl0aW9uW3NyY0lkXS5wdXNoKHBhdGgpO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIGRzdElkID09PSAnc3RyaW5nJykge1xuICAgICAgICBpZiAoIXRoaXMuX3BhdGhzVG9VcGRhdGVPbkFkZGl0aW9uW2RzdElkXSkge1xuICAgICAgICAgICAgdGhpcy5fcGF0aHNUb1VwZGF0ZU9uQWRkaXRpb25bZHN0SWRdID0gW107XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fcGF0aHNUb1VwZGF0ZU9uQWRkaXRpb25bZHN0SWRdLnB1c2gocGF0aCk7XG4gICAgfVxuICAgIHRoaXMuX3BhdGhTcmNbaWRdID0gc3JjSWQ7XG4gICAgdGhpcy5fcGF0aERzdFtpZF0gPSBkc3RJZDtcbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLl9nZXRQb3J0c0ZvciA9IGZ1bmN0aW9uIChib3hJZCkge1xuICAgIGlmIChib3hJZCBpbnN0YW5jZW9mIEFycmF5KSB7ICAvLyBsaXN0IG9mIHBvcnRzIC0+IG5vdCBhIGJveElkXG4gICAgICAgIC8vIEZJWE1FOiBUaGVzZSBwb3J0cyB3b3VsZCBhbHNvIG5lZWQgdG8gYmUgcmVzb2x2ZWQhXG4gICAgICAgIHJldHVybiBib3hJZDtcbiAgICB9IGVsc2UgeyAgLy8gYm94SWQgaXMgYSBib3ggaWQgLT4gZ2V0IHRoZSBwb3J0c1xuICAgICAgICB2YXIgcG9ydElkcyA9IE9iamVjdC5rZXlzKHRoaXMuX3BvcnRJZHNbYm94SWRdKSxcbiAgICAgICAgICAgIHBvcnRzID0gW107XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IHBvcnRJZHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgICAgICBhc3NlcnQodGhpcy5fcG9ydElkc1tib3hJZF1bcG9ydElkc1tpXV0ucG9ydHMubGVuZ3RoID09PSAxKTtcbiAgICAgICAgICAgIHBvcnRzLnB1c2godGhpcy5fcG9ydElkc1tib3hJZF1bcG9ydElkc1tpXV0ucG9ydHNbMF0pO1xuICAgICAgICB9XG4gICAgICAgIGFzc2VydChwb3J0cywgJ25vIHBvcnRzIGZvdW5kICgnICsgcG9ydHMgKyAnKScpO1xuICAgICAgICBmb3IgKHZhciBpID0gcG9ydHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgICAgICBhc3NlcnQgKHBvcnRzW2ldLm93bmVyLCAnSW52YWxpZCBvd25lcicpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBwb3J0cztcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5fdXBkYXRlUGF0aCA9IGZ1bmN0aW9uIChpZCwgc3JjSWQsIGRzdElkKSB7ICAvLyBwdWJsaWMgaWRcbiAgICB0aGlzLl9yZW1vdmVQYXRoKGlkLCB0cnVlKTtcbiAgICB0aGlzLl9jcmVhdGVQYXRoKGlkLCBzcmNJZCwgZHN0SWQpO1xufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuX3JlbW92ZVBhdGggPSBmdW5jdGlvbiAoaWQsIHNpbGVudCkgeyAgLy8gcHVibGljIGlkXG4gICAgdmFyIHBhdGggPSB0aGlzLl9wYXRoKGlkKSxcbiAgICAgICAgc3JjID0gdGhpcy5fcGF0aFNyY1tpZF0sXG4gICAgICAgIGRzdCA9IHRoaXMuX3BhdGhEc3RbaWRdO1xuXG4gICAgdGhpcy5fZ3JhcGguZGVsZXRlUGF0aChwYXRoKTtcbiAgICBkZWxldGUgdGhpcy5fcGF0aElkc1tpZF07XG4gICAgZGVsZXRlIHRoaXMuX3BhdGhTcmNbaWRdO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXRoRHN0W2lkXTtcblxuICAgIGlmICghc2lsZW50KSB7XG4gICAgICAgIHRoaXMuX2NsZWFyT2xkQm94UmVjb3JkcyhzcmMsIGlkKTtcbiAgICAgICAgdGhpcy5fY2xlYXJPbGRCb3hSZWNvcmRzKGRzdCwgaWQpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLl9jbGVhck9sZEJveFJlY29yZHMgPSBmdW5jdGlvbiAoaWQsIHBhdGhJZCkgeyAgLy8gcHVibGljIGlkXG4gICAgdmFyIGJveElzRGVsZXRlZCA9ICF0aGlzLl9ib3hJZHNbaWRdLFxuICAgICAgICBoYXNSZWNvcmQgPSB0aGlzLl9wYXRoc1RvVXBkYXRlT25BZGRpdGlvbi5oYXNPd25Qcm9wZXJ0eShpZCk7XG5cbiAgICBpZiAoaGFzUmVjb3JkKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSB0aGlzLl9wYXRoc1RvVXBkYXRlT25BZGRpdGlvbltpZF0ubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fcGF0aHNUb1VwZGF0ZU9uQWRkaXRpb25baWRdW2ldLmlkID09PSBwYXRoSWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9wYXRoc1RvVXBkYXRlT25BZGRpdGlvbltpZF0uc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChib3hJc0RlbGV0ZWQgJiYgdGhpcy5fcGF0aHNUb1VwZGF0ZU9uQWRkaXRpb25baWRdLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX3BhdGhzVG9VcGRhdGVPbkFkZGl0aW9uW2lkXTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLl9zZXRDdXN0b21QYXRoID0gZnVuY3Rpb24gKHBhdGgsIHBvaW50cykgeyAgLy8gcHVibGljIGlkXG4gICAgLy8gQ29udmVydCBwb2ludHMgdG8gYXJyYXkgb2YgQXJQb2ludHNcbiAgICBwb2ludHMgPSBwb2ludHMubWFwKGZ1bmN0aW9uIChwb2ludCkge1xuICAgICAgICByZXR1cm4gbmV3IEFyUG9pbnQocG9pbnRbMF0sIHBvaW50WzFdKTtcbiAgICB9KTtcblxuICAgIHBhdGguc2V0Q3VzdG9tUGF0aFBvaW50cyhwb2ludHMpO1xuICAgIHBhdGguc2V0QXV0b1JvdXRpbmcoZmFsc2UpO1xufTtcblxuLy8gUG9ydHNcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuX2NyZWF0ZVBvcnQgPSBmdW5jdGlvbiAoYm94SWQsIHBvcnRJZCwgYXJlYSkgeyAgLy8gYXJlYTogW1t4MSwgeTFdLCBbeDIsIHkyXV1cbiAgICB2YXIgYm94ID0gdGhpcy5fYm94KGJveElkKSxcbiAgICAgICAgY29udGFpbmVyLFxuICAgICAgICBjUmVjdCA9IG5ldyBBclJlY3QoKSxcbiAgICAgICAgcG9ydCA9IG5ldyBBdXRvUm91dGVyUG9ydCgpLFxuICAgICAgICByZWN0ID0gdGhpcy5fY3JlYXRlUmVjdEZyb21BcmVhKGFyZWEpLFxuICAgICAgICBhdHRyO1xuXG4gICAgLy8gQ3JlYXRlIHRoZSBwb3J0XG4gICAgYXR0ciA9IHRoaXMuX2dldFBvcnRBdHRyaWJ1dGVzKGJveC5yZWN0LCBhcmVhKTtcbiAgICBwb3J0LmlkID0gYm94SWQgKyAnL3xcXFxcJyArIHBvcnRJZDtcbiAgICBwb3J0LnNldExpbWl0ZWREaXJzKGZhbHNlKTtcbiAgICBwb3J0LmF0dHJpYnV0ZXMgPSBhdHRyO1xuICAgIHRoaXMuX3NldFZhbGlkUmVjdFNpemUocmVjdCk7XG4gICAgcG9ydC5zZXRSZWN0KHJlY3QpO1xuXG4gICAgLy8gQ3JlYXRlIGEgY29udGFpbmVyIHJlY3RcbiAgICBjUmVjdC5hc3NpZ24ocmVjdCk7XG4gICAgY1JlY3QuaW5mbGF0ZVJlY3QoMSk7XG4gICAgY29udGFpbmVyID0gdGhpcy5fY3JlYXRlQm94KHtcbiAgICAgICAgeDE6IGNSZWN0LmxlZnQsXG4gICAgICAgIHkxOiBjUmVjdC5jZWlsLFxuICAgICAgICB4MjogY1JlY3QucmlnaHQsXG4gICAgICAgIHkyOiBjUmVjdC5mbG9vclxuICAgIH0pO1xuXG4gICAgYm94LmFkZENoaWxkKGNvbnRhaW5lcik7XG4gICAgY29udGFpbmVyLmFkZFBvcnQocG9ydCk7XG4gICAgdGhpcy5fcG9ydElkc1tib3hJZF1bcG9ydElkXSA9IGNvbnRhaW5lcjtcblxuICAgIC8vIFVwZGF0ZSBwYXRocyBhcyBuZWVkZWRcbiAgICB0aGlzLl91cGRhdGVQYXRoc0ZvckJveChib3hJZCk7XG59O1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5fdXBkYXRlUGF0aHNGb3JCb3ggPSBmdW5jdGlvbiAoYm94SWQpIHtcbiAgICB2YXIgcGF0aHMgPSB0aGlzLl9wYXRoc1RvVXBkYXRlT25BZGRpdGlvbltib3hJZF0gfHwgW10sXG4gICAgICAgIHN0YXJ0LFxuICAgICAgICBlbmQ7XG5cbiAgICBmb3IgKHZhciBpID0gcGF0aHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIC8vIEdldCB0aGUgbmV3IHBvcnRzXG4gICAgICAgIHN0YXJ0ID0gdGhpcy5fZ2V0UG9ydHNGb3IodGhpcy5fcGF0aFNyY1twYXRoc1tpXS5pZF0pO1xuICAgICAgICBlbmQgPSB0aGlzLl9nZXRQb3J0c0Zvcih0aGlzLl9wYXRoRHN0W3BhdGhzW2ldLmlkXSk7XG5cbiAgICAgICAgLy8gRGlzY29ubmVjdCBhbmQgdXBkYXRlIHBhdGhcbiAgICAgICAgdGhpcy5fZ3JhcGguZGlzY29ubmVjdChwYXRoc1tpXSk7XG4gICAgICAgIGlmIChzdGFydC5sZW5ndGggJiYgZW5kLmxlbmd0aCkge1xuICAgICAgICAgICAgcGF0aHNbaV0uc2V0U3RhcnRFbmRQb3J0cyhzdGFydCwgZW5kKTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLl9jcmVhdGVSZWN0RnJvbUFyZWEgPSBmdW5jdGlvbiAoYXJlYSkge1xuICAgIHZhciByZWN0ID0gbmV3IEFyUmVjdChhcmVhLngxLCBhcmVhLnkxLCBhcmVhLngyLCBhcmVhLnkyKTtcbiAgICB0aGlzLl9zZXRWYWxpZFJlY3RTaXplKHJlY3QpO1xuICAgIHJldHVybiByZWN0O1xufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuX2dldFBvcnRBdHRyaWJ1dGVzID0gZnVuY3Rpb24gKHJlY3QsIGFyZWEpIHtcbiAgICB2YXIgYXR0ciA9IDAsXG4gICAgICAgIHgxID0gYXJlYS54MSxcbiAgICAgICAgeDIgPSBhcmVhLngyLFxuICAgICAgICB5MSA9IGFyZWEueTEsXG4gICAgICAgIHkyID0gYXJlYS55MixcbiAgICAgICAgaG9yaXpvbnRhbCA9IHkxID09PSB5MjtcblxuICAgIGlmIChob3Jpem9udGFsKSB7XG4gICAgICAgIGlmIChNYXRoLmFicyh5MSAtIHJlY3QuY2VpbCkgPCBNYXRoLmFicyh5MSAtIHJlY3QuZmxvb3IpKSB7ICAvLyBDbG9zZXIgdG8gdGhlIHRvcFxuICAgICAgICAgICAgYXR0ciA9IENPTlNUQU5UUy5Qb3J0U3RhcnRPblRvcCArIENPTlNUQU5UUy5Qb3J0RW5kT25Ub3A7XG4gICAgICAgIH0gZWxzZSB7ICAvLyBDbG9zZXIgdG8gdGhlIHRvcCAoaG9yaXpvbnRhbClcbiAgICAgICAgICAgIGF0dHIgPSBDT05TVEFOVFMuUG9ydFN0YXJ0T25Cb3R0b20gKyBDT05TVEFOVFMuUG9ydEVuZE9uQm90dG9tO1xuICAgICAgICB9XG5cbiAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoTWF0aC5hYnMoeDEgLSByZWN0LmxlZnQpIDwgTWF0aC5hYnMoeDEgLSByZWN0LnJpZ2h0KSkgeyAgLy8gQ2xvc2VyIHRvIHRoZSBsZWZ0XG4gICAgICAgICAgICBhdHRyID0gQ09OU1RBTlRTLlBvcnRTdGFydE9uTGVmdCArIENPTlNUQU5UUy5Qb3J0RW5kT25MZWZ0O1xuICAgICAgICB9IGVsc2UgeyAgLy8gQ2xvc2VyIHRvIHRoZSByaWdodCAodmVydGljYWwpXG4gICAgICAgICAgICBhdHRyID0gQ09OU1RBTlRTLlBvcnRTdGFydE9uUmlnaHQgKyBDT05TVEFOVFMuUG9ydEVuZE9uUmlnaHQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gYXR0cjtcbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLl91cGRhdGVQb3J0ID0gZnVuY3Rpb24gKGJveElkLCBwb3J0SWQsIGFyZWEpIHtcbiAgICB2YXIgYm94ID0gdGhpcy5fYm94KGJveElkKSxcbiAgICAgICAgY29udGFpbmVyID0gdGhpcy5fcG9ydChib3hJZCwgcG9ydElkKSxcbiAgICAgICAgY1JlY3QgPSBjb250YWluZXIucmVjdCxcbiAgICAgICAgcG9ydCA9IGNvbnRhaW5lci5wb3J0c1swXSxcbiAgICAgICAgcmVjdCA9IHRoaXMuX2NyZWF0ZVJlY3RGcm9tQXJlYShhcmVhKSxcbiAgICAgICAgYXR0cjtcblxuICAgIC8vIFVwZGF0ZSB0aGUgcG9ydCdzIHJlY3RcbiAgICBhdHRyID0gdGhpcy5fZ2V0UG9ydEF0dHJpYnV0ZXMoYm94LnJlY3QsIGFyZWEpO1xuICAgIHBvcnQuc2V0TGltaXRlZERpcnMoZmFsc2UpO1xuICAgIHBvcnQuYXR0cmlidXRlcyA9IGF0dHI7XG4gICAgdGhpcy5fc2V0VmFsaWRSZWN0U2l6ZShyZWN0KTtcbiAgICBwb3J0LnNldFJlY3QocmVjdCk7XG5cbiAgICBjUmVjdC5hc3NpZ24ocG9ydC5yZWN0KTtcbiAgICBjUmVjdC5pbmZsYXRlUmVjdCgxKTtcbiAgICBjb250YWluZXIuc2V0UmVjdChjUmVjdCk7XG59O1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5fcmVtb3ZlUG9ydCA9IGZ1bmN0aW9uIChib3hJZCwgcG9ydElkKSB7XG4gICAgdmFyIGNvbnRhaW5lciA9IHRoaXMuX3BvcnQoYm94SWQsIHBvcnRJZCksXG4gICAgICAgIHBvcnQgPSBjb250YWluZXIucG9ydHNbMF0sXG4gICAgICAgIHBhdGhzID0gdGhpcy5fcGF0aHNUb1VwZGF0ZU9uRGVsZXRpb25bcG9ydC5pZF0gfHwgW10sXG4gICAgICAgIHN0YXJ0LFxuICAgICAgICBlbmQ7XG5cbiAgICB0aGlzLl9ncmFwaC5kZWxldGVCb3goY29udGFpbmVyKTtcblxuICAgIC8vIFVwZGF0ZSBwYXRoc1xuICAgIGRlbGV0ZSB0aGlzLl9wYXRoc1RvVXBkYXRlT25EZWxldGlvbltwb3J0LmlkXTtcbiAgICBmb3IgKHZhciBpID0gcGF0aHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHN0YXJ0ID0gcGF0aHNbaV0uc3RhcnRwb3J0cztcbiAgICAgICAgZW5kID0gcGF0aHNbaV0uZW5kcG9ydHM7XG4gICAgICAgIHV0aWxzLnJlbW92ZUZyb21BcnJheXMocG9ydCwgc3RhcnQsIGVuZCk7XG4gICAgICAgIGlmIChzdGFydC5sZW5ndGggJiYgZW5kLmxlbmd0aCkge1xuICAgICAgICAgICAgcGF0aHNbaV0uc2V0U3RhcnRFbmRQb3J0cyhzdGFydCwgZW5kKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBkZWxldGUgdGhpcy5fcG9ydElkc1tib3hJZF1bcG9ydElkXTtcbn07XG5cbi8vIFNoYXJlZCB1dGlsaXRpZXNcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuX3NldFZhbGlkUmVjdFNpemUgPSBmdW5jdGlvbiAocmVjdCkge1xuICAgIC8vIE1ha2Ugc3VyZSB0aGUgcmVjdCBpcyBhdCBsZWFzdCAzeDNcbiAgICB2YXIgaGVpZ2h0ID0gcmVjdC5nZXRIZWlnaHQoKSxcbiAgICAgICAgd2lkdGggPSByZWN0LmdldFdpZHRoKCksXG4gICAgICAgIGR4ID0gTWF0aC5tYXgoKDMgLSB3aWR0aCkgLyAyLCAwKSxcbiAgICAgICAgZHkgPSBNYXRoLm1heCgoMyAtIGhlaWdodCkgLyAyLCAwKTtcblxuICAgIHJlY3QuaW5mbGF0ZVJlY3QoZHgsIGR5KTtcbiAgICByZXR1cm4gcmVjdDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQXV0b1JvdXRlcjtcbiIsIi8qanNoaW50IG5vZGU6dHJ1ZSwgbW9jaGE6dHJ1ZSovXG4vKipcbiAqIEBhdXRob3IgYnJvbGxiIC8gaHR0cHM6Ly9naXRodWIuY29tL2Jyb2xsYlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIHNyY1BhdGggPSAnLi8uLi8uLi9zcmMvJyxcbiAgICBBY3Rpb25BcHBsaWVyID0gcmVxdWlyZSgnLi8uLi8uLi9zcmMvQXV0b1JvdXRlci5BY3Rpb25BcHBsaWVyJyksXG4gICAgbm9wID0gZnVuY3Rpb24oKXt9LFxuICAgIGV4dGVuZCA9IHJlcXVpcmUoJ2xvZGFzaC5hc3NpZ24nKSxcbiAgICBhc3NlcnQgPSByZXF1aXJlKCdhc3NlcnQnKSxcbiAgICB2ZXJib3NlLFxuICAgIEhFQURFUiA9ICdBVVRPUk9VVEVSIFJFUExBWUVSOlxcdCcsXG4gICAgV29ya2VyIC8qPSByZXF1aXJlKCd3ZWJ3b3JrZXItdGhyZWFkcycpLldvcmtlciovO1xuXG52YXIgQXV0b1JvdXRlclJlcGxheWVyID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMubG9nZ2VyID0ge2Vycm9yOiBjb25zb2xlLmxvZ307XG5cbiAgICAvLyBXZWIgd29ya2VyIHN1cHBvcnRcbiAgICB0aGlzLnVzaW5nV2ViV29ya2VyID0gZmFsc2U7XG4gICAgdGhpcy5vbkZpbmlzaGVkID0gZmFsc2U7XG4gICAgdGhpcy51c2VXZWJXb3JrZXIoKTtcbiAgICB0aGlzLmV4cGVjdGVkRXJyb3JzID0gW107XG4gICAgdGhpcy5fcXVldWUgPSBudWxsO1xuICAgIHRoaXMuX2NvdW50ID0gbnVsbDtcbn07XG5cbkF1dG9Sb3V0ZXJSZXBsYXllci5wcm90b3R5cGUubG9nID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBtc2csXG4gICAgICAgIGk7XG5cbiAgICBpZiAodmVyYm9zZSkge1xuICAgICAgICBtc2cgPSBbSEVBREVSXTtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICAgICAgbXNnLnB1c2goYXJndW1lbnRzW2ldKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zb2xlLmxvZy5hcHBseShudWxsLCBtc2cpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJSZXBsYXllci5wcm90b3R5cGUudGVzdExvY2FsID0gZnVuY3Rpb24gKGFjdGlvbnMsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgdmFyIGJlZm9yZSxcbiAgICAgICAgYWZ0ZXIsXG4gICAgICAgIGxhc3QsXG5cbiAgICAgICAgaTtcblxuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMykge1xuICAgICAgICBjYWxsYmFjayA9IG9wdGlvbnM7XG4gICAgfVxuXG4gICAgLy8gVW5wYWNrIHRoZSBvcHRpb25zXG4gICAgdGhpcy5pbml0KCk7XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgdmVyYm9zZSA9IG9wdGlvbnMudmVyYm9zZSB8fCBmYWxzZTtcbiAgICBiZWZvcmUgPSBvcHRpb25zLmJlZm9yZSB8fCBub3A7XG4gICAgYWZ0ZXIgPSBvcHRpb25zLmFmdGVyIHx8IG5vcDtcbiAgICBjYWxsYmFjayA9IGNhbGxiYWNrIHx8IG5vcDtcbiAgICBsYXN0ID0gb3B0aW9ucy5hY3Rpb25Db3VudCB8fCBhY3Rpb25zLmxlbmd0aDtcblxuICAgIC8vIFJ1biB0aGUgdGVzdHNcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGFzdDsgaSArPSAxKSB7XG4gICAgICAgIHRoaXMubG9nKGBDYWxsaW5nIEFjdGlvbiAjJHtpfS8ke2xhc3R9OiAke2FjdGlvbnNbaV0uYWN0aW9ufSB3aXRoYCwgYWN0aW9uc1tpXS5hcmdzKTtcbiAgICAgICAgYmVmb3JlKHRoaXMuYXV0b3JvdXRlciwgaSk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB0aGlzLl9pbnZva2VBdXRvUm91dGVyTWV0aG9kVW5zYWZlKGFjdGlvbnNbaV0uYWN0aW9uLCBhY3Rpb25zW2ldLmFyZ3MpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuX2lzRXhwZWN0ZWRFcnJvcihlLm1lc3NhZ2UpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBhZnRlcih0aGlzLmF1dG9yb3V0ZXIsIGkpO1xuICAgIH1cblxuICAgIGNhbGxiYWNrKCk7XG59O1xuXG4vLyBXZWIgd29ya2VyIGZ1bmN0aW9uYWxpdHlcbi8qKlxuICogU2V0IHRoZSBBdXRvUm91dGVyUmVwbGF5ZXIgdG8gdXNlIGEgd2ViIHdvcmtlciBvciBub3QuXG4gKlxuICogQHBhcmFtIHtCb29sZWFufSBbdXNpbmdXZWJXb3JrZXJdXG4gKiBAcmV0dXJuIHt1bmRlZmluZWR9XG4gKi9cbkF1dG9Sb3V0ZXJSZXBsYXllci5wcm90b3R5cGUudXNlV2ViV29ya2VyID0gZnVuY3Rpb24gKHVzaW5nV2ViV29ya2VyKSB7XG4gICAgaWYgKHVzaW5nV2ViV29ya2VyKSB7ICAvLyBFbmFibGUgd2ViIHdvcmtlclxuICAgICAgICB0aGlzLnRlc3QgPSBBdXRvUm91dGVyUmVwbGF5ZXIucHJvdG90eXBlLnRlc3RXaXRoV2ViV29ya2VyO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMudGVzdCA9IEF1dG9Sb3V0ZXJSZXBsYXllci5wcm90b3R5cGUudGVzdExvY2FsO1xuICAgIH1cbiAgICB0aGlzLnVzaW5nV2ViV29ya2VyID0gdXNpbmdXZWJXb3JrZXI7XG59O1xuXG4vLyBGSVhNRTogVGVzdCB0aGUgd2ViIHdvcmtlclxuQXV0b1JvdXRlclJlcGxheWVyLnByb3RvdHlwZS5fY3JlYXRlV2ViV29ya2VyID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgdmFyIHdvcmtlckZpbGUgPSBzcmNQYXRoICsgJ0F1dG9Sb3V0ZXIuV29ya2VyLmpzJztcbiAgICBhc3NlcnQoISFXb3JrZXIsICdXZWIgV29ya2VycyBhcmUgbm90IHN1cHBvcnRlZCBpbiB5b3VyIGVudmlyb25tZW50Jyk7XG5cbiAgICB0aGlzLmxvZygnQ3JlYXRpbmcgd2ViIHdvcmtlcicpO1xuICAgIGlmICh0aGlzLl93b3JrZXIpIHtcbiAgICAgICAgdGhpcy5fd29ya2VyLnRlcm1pbmF0ZSgpO1xuICAgIH1cbiAgICB0aGlzLl93b3JrZXIgPSBuZXcgV29ya2VyKHdvcmtlckZpbGUpO1xuICAgIHRoaXMubG9nKCdTZW5kaW5nOicse30pO1xuICAgIHRoaXMuX3dvcmtlci5wb3N0TWVzc2FnZShbe30sIHRydWVdKTtcblxuICAgIHRoaXMuX3dvcmtlci5vbm1lc3NhZ2UgPSBmdW5jdGlvbihyZXNwb25zZSkge1xuICAgICAgICB0aGlzLmxvZygnQ3JlYXRlZCB3ZWIgd29ya2VyJyk7XG4gICAgICAgIGFzc2VydChyZXNwb25zZS5kYXRhID09PSAnUkVBRFknKTtcbiAgICAgICAgdGhpcy5fd29ya2VyLm9ubWVzc2FnZSA9IHRoaXMuX29uV29ya2VyTWVzc2FnZS5iaW5kKHRoaXMpO1xuICAgICAgICBjYWxsYmFjaygpO1xuICAgIH0uYmluZCh0aGlzKTtcbn07XG5cbi8qKlxuICogQ2xlYW4gdXAgcmVzb3VyY2VzIHVzZWQgZm9yIHRlc3RpbmcgKG5hbWVseSB0aGUgd2ViIHdvcmtlcikuXG4gKlxuICogQHJldHVybiB7dW5kZWZpbmVkfVxuICovXG5BdXRvUm91dGVyUmVwbGF5ZXIucHJvdG90eXBlLnRlYXJkb3duID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLl93b3JrZXIpIHtcbiAgICAgICAgdGhpcy5fd29ya2VyLnRlcm1pbmF0ZSgpO1xuICAgICAgICB0aGlzLl93b3JrZXIgPSBudWxsO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJSZXBsYXllci5wcm90b3R5cGUudGVzdFdpdGhXZWJXb3JrZXIgPSBmdW5jdGlvbiAoYWN0aW9ucywgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICB2YXIgbGFzdDtcblxuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgIHZlcmJvc2UgPSBvcHRpb25zLnZlcmJvc2UgfHwgZmFsc2U7XG4gICAgbGFzdCA9IG9wdGlvbnMuYWN0aW9uQ291bnQgfHwgYWN0aW9ucy5sZW5ndGg7XG5cbiAgICB0aGlzLl9jb3VudCA9IDA7XG4gICAgdGhpcy5fcXVldWUgPSBhY3Rpb25zLnNsaWNlKDAsbGFzdCk7XG5cbiAgICBhc3NlcnQodGhpcy5fcXVldWUubGVuZ3RoLCAnUmVjZWl2ZWQgYW4gZW1wdHkgbGlzdCBvZiBhY3Rpb25zJyk7XG4gICAgdGhpcy5fY3JlYXRlV2ViV29ya2VyKHRoaXMuX2NhbGxOZXh0LmJpbmQodGhpcykpO1xuICAgIHRoaXMub25GaW5pc2hlZCA9IGNhbGxiYWNrO1xufTtcblxuQXV0b1JvdXRlclJlcGxheWVyLnByb3RvdHlwZS5fb25Xb3JrZXJNZXNzYWdlID0gZnVuY3Rpb24gKGRhdGEpIHtcbiAgICB2YXIgcmVzcG9uc2UgPSBkYXRhLmRhdGE7XG4gICAgdGhpcy5sb2coJ1dlYiB3b3JrZXIgcmVzcG9uZGVkOicrcmVzcG9uc2UpO1xuICAgIGlmICh0eXBlb2YgcmVzcG9uc2VbMl0gPT09ICdzdHJpbmcnICYmIHJlc3BvbnNlWzJdLmluZGV4T2YoJ0Vycm9yJykgPT09IDApIHtcbiAgICAgICAgYXNzZXJ0KHRoaXMuX2lzRXhwZWN0ZWRFcnJvcihyZXNwb25zZVsyXSksICdVbmV4cGVjdGVkIGVycm9yOiAnK3Jlc3BvbnNlWzJdKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fcXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHRoaXMuX2NhbGxOZXh0KCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKHRoaXMub25GaW5pc2hlZCkge1xuICAgICAgICAgICAgdGhpcy5vbkZpbmlzaGVkKCk7XG4gICAgICAgICAgICB0aGlzLm9uRmluaXNoZWQgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGFzc2VydCh0aGlzLmV4cGVjdGVkRXJyb3JzLmxlbmd0aCA9PT0gMCk7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlclJlcGxheWVyLnByb3RvdHlwZS5faXNFeHBlY3RlZEVycm9yID0gZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgZm9yICh2YXIgaSA9IHRoaXMuZXhwZWN0ZWRFcnJvcnMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIGlmICh0aGlzLmV4cGVjdGVkRXJyb3JzW2ldLnRlc3QoZXJyb3IpKSB7XG4gICAgICAgICAgICB0aGlzLmV4cGVjdGVkRXJyb3JzLnNwbGljZShpLDEpO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xufTtcblxuQXV0b1JvdXRlclJlcGxheWVyLnByb3RvdHlwZS5fY2FsbE5leHQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHRhc2sgPSB0aGlzLl9xdWV1ZS5zaGlmdCgpO1xuICAgIHRoaXMubG9nKCdDYWxsaW5nIEFjdGlvbiAjJyArIHRoaXMuX2NvdW50ICsgJzonLCB0YXNrLmFjdGlvbiwgJ3dpdGgnLCB0YXNrLmFyZ3MpO1xuICAgIHRoaXMuX3dvcmtlci5wb3N0TWVzc2FnZShbdGFzay5hY3Rpb24sIHRhc2suYXJnc10pO1xufTtcblxuLyogKiAqICogKiAqICogKiBRdWVyeWluZyB0aGUgQXV0b1JvdXRlciAqICogKiAqICogKiAqICovXG5BdXRvUm91dGVyUmVwbGF5ZXIucHJvdG90eXBlLmdldFBhdGhQb2ludHMgPSBmdW5jdGlvbiAocGF0aElkLCBjYWxsYmFjaykge1xuICAgIGlmICh0aGlzLnVzaW5nV2ViV29ya2VyKSB7ICAvLyBFbmFibGUgd2ViIHdvcmtlclxuICAgICAgICB0aGlzLl93b3JrZXIub25tZXNzYWdlID0gZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ3JlY2VpdmVkIGRhdGE6JywgZGF0YSk7XG4gICAgICAgICAgICBpZiAoZGF0YS5kYXRhWzBdID09PSAncGF0aCcgJiYgcGF0aElkID09PSBkYXRhLmRhdGFbMV0uaWQpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhkYXRhLmRhdGFbMl0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLl93b3JrZXIucG9zdE1lc3NhZ2UoWydwYXRoJywgW3BhdGhJZF1dKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjYWxsYmFjayh0aGlzLmF1dG9yb3V0ZXIucGF0aChwYXRoSWQpLnBvaW50cyk7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlclJlcGxheWVyLnByb3RvdHlwZS5nZXRCb3hSZWN0ID0gZnVuY3Rpb24gKGJveElkLCBjYWxsYmFjaykge1xuICAgIGlmICh0aGlzLnVzaW5nV2ViV29ya2VyKSB7ICAvLyBFbmFibGUgd2ViIHdvcmtlclxuICAgICAgICB0aGlzLl93b3JrZXIub25tZXNzYWdlID0gZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICAgICAgaWYgKGRhdGEuZGF0YVswXSA9PT0gJ2dldEJveFJlY3QnICYmIGJveElkID09PSBkYXRhLmRhdGFbMV1bMF0pIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhkYXRhLmRhdGFbMl0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLl93b3JrZXIucG9zdE1lc3NhZ2UoWydnZXRCb3hSZWN0JywgW2JveElkXV0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciByZWN0ID0gdGhpcy5hdXRvcm91dGVyLmJveChib3hJZCk7XG4gICAgICAgIGNhbGxiYWNrKHJlY3QpO1xuICAgIH1cbn07XG5cbmV4dGVuZChBdXRvUm91dGVyUmVwbGF5ZXIucHJvdG90eXBlLCBBY3Rpb25BcHBsaWVyLnByb3RvdHlwZSk7XG5cbm1vZHVsZS5leHBvcnRzID0gQXV0b1JvdXRlclJlcGxheWVyO1xuIl19
