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
        this.owner._addEdges(port);
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

AutoRouterEdgeList.prototype.addEdges = function (path) {
    var selfPoints,
        startpoint,
        startpointPrev,
        endpointNext,
        endpoint,
        edge,
        dir,
        i;

    if (path instanceof AutoRouterBox) {
        var box = path;

        assert(box.owner === this.owner,
            'AREdgeList.addEdges: box.owner === (owner) FAILED!');


        selfPoints = box.selfPoints;

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
    } else if (path) {  // path is an ARGraph
        var graph = path;
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
    this.horizontal.addEdges(this);
    this.vertical.addEdges(this);
};

AutoRouterGraph.prototype._addEdges = function (obj) {
    assert(!(obj instanceof AutoRouterPath), 'No Paths should be here!');
    if (obj instanceof AutoRouterPort) {
        this.horizontal.addPortEdges(obj);
        this.vertical.addPortEdges(obj);
    } else {
        this.horizontal.addEdges(obj);
        this.vertical.addEdges(obj);
    }
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

    this._addEdges(box);

    for (var i = box.ports.length; i--;) {
        this._addEdges(box.ports[i]);
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
        'ARPort.getStartPort: Can\'t retrieve start port. from '+this.id);

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
    if (this.isConnected()) {
        this.startport.removePoint(this.startpoint);
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
    // Remove all points
    this.owner = null;

    // Remove all points and self from all paths
    var point,
        path;

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
    } else {
        this._updateBox(id, rect);
    }
};

AutoRouter.prototype.setDependentBox = function(parentId, childId) {
    var parent = this._box(parentId),
        child = this._box(childId);

    assert(parent && child, 'Could not find parent or child');
    parent.addChild(child);
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

    if (path === undefined) {
        throw 'AutoRouter: Need to have an AutoRouterPath type to set custom path points';
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
    assert(boxId !== undefined && id !== undefined, 'Missing ' + (boxId ? 'boxId' : 'id'));
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
    delete this._pathsToUpdateOnAddition[id];
};

// Paths

AutoRouter.prototype._createPath = function (id, srcId, dstId) {  // public id
    var srcPorts = this._getPortsFor(srcId),
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
    this._removePath(id);
    this._createPath(id, srcId, dstId);
};

AutoRouter.prototype._removePath = function (id) {  // public id
    var path = this._path(id);
    this._graph.deletePath(path);
    delete this._pathIds[id];
    delete this._pathSrc[id];
    delete this._pathDst[id];
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
        this.log('Calling Action #' + i + ':', actions[i].action, 'with', actions[i].args);
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
            if (data.data[0] === 'getPathPoints' && pathId === data.data[1][0]) {
                callback(data.data[2]);
            }
        };
        this._worker.postMessage(['getPathPoints', [pathId]]);
    } else {
        var id = this._autorouterPaths[pathId];
        callback(this.autorouter.getPathPoints(id));
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
        var rect = this._autorouterBoxes[boxId].box.rect;
        callback(rect);
    }
};

extend(AutoRouterReplayer.prototype, ActionApplier.prototype);

module.exports = AutoRouterReplayer;

},{"./../../src/AutoRouter.ActionApplier":20,"assert":1,"lodash.assign":9}]},{},[35])(35)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYXNzZXJ0L2Fzc2VydC5qcyIsIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9pbmhlcml0cy9pbmhlcml0c19icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy91dGlsL3N1cHBvcnQvaXNCdWZmZXJCcm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3V0aWwvdXRpbC5qcyIsIm5vZGVfbW9kdWxlcy9kZWJ1Zy9icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL2RlYnVnL2RlYnVnLmpzIiwibm9kZV9tb2R1bGVzL2RlYnVnL25vZGVfbW9kdWxlcy9tcy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2guYXNzaWduL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC5hc3NpZ24vbm9kZV9tb2R1bGVzL2xvZGFzaC5fYmFzZWFzc2lnbi9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2guYXNzaWduL25vZGVfbW9kdWxlcy9sb2Rhc2guX2Jhc2Vhc3NpZ24vbm9kZV9tb2R1bGVzL2xvZGFzaC5fYmFzZWNvcHkvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbG9kYXNoLmFzc2lnbi9ub2RlX21vZHVsZXMvbG9kYXNoLl9jcmVhdGVhc3NpZ25lci9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2guYXNzaWduL25vZGVfbW9kdWxlcy9sb2Rhc2guX2NyZWF0ZWFzc2lnbmVyL25vZGVfbW9kdWxlcy9sb2Rhc2guX2JpbmRjYWxsYmFjay9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2guYXNzaWduL25vZGVfbW9kdWxlcy9sb2Rhc2guX2NyZWF0ZWFzc2lnbmVyL25vZGVfbW9kdWxlcy9sb2Rhc2guX2lzaXRlcmF0ZWVjYWxsL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC5hc3NpZ24vbm9kZV9tb2R1bGVzL2xvZGFzaC5fY3JlYXRlYXNzaWduZXIvbm9kZV9tb2R1bGVzL2xvZGFzaC5yZXN0cGFyYW0vaW5kZXguanMiLCJub2RlX21vZHVsZXMvbG9kYXNoLmFzc2lnbi9ub2RlX21vZHVsZXMvbG9kYXNoLmtleXMvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbG9kYXNoLmFzc2lnbi9ub2RlX21vZHVsZXMvbG9kYXNoLmtleXMvbm9kZV9tb2R1bGVzL2xvZGFzaC5fZ2V0bmF0aXZlL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC5hc3NpZ24vbm9kZV9tb2R1bGVzL2xvZGFzaC5rZXlzL25vZGVfbW9kdWxlcy9sb2Rhc2guaXNhcmd1bWVudHMvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbG9kYXNoLmFzc2lnbi9ub2RlX21vZHVsZXMvbG9kYXNoLmtleXMvbm9kZV9tb2R1bGVzL2xvZGFzaC5pc2FycmF5L2luZGV4LmpzIiwic3JjL0F1dG9Sb3V0ZXIuQWN0aW9uQXBwbGllci5qcyIsInNyYy9BdXRvUm91dGVyLkJveC5qcyIsInNyYy9BdXRvUm91dGVyLkNvbnN0YW50cy5qcyIsInNyYy9BdXRvUm91dGVyLkVkZ2UuanMiLCJzcmMvQXV0b1JvdXRlci5FZGdlTGlzdC5qcyIsInNyYy9BdXRvUm91dGVyLkdyYXBoLmpzIiwic3JjL0F1dG9Sb3V0ZXIuTG9nZ2VyLmpzIiwic3JjL0F1dG9Sb3V0ZXIuUGF0aC5qcyIsInNyYy9BdXRvUm91dGVyLlBvaW50LmpzIiwic3JjL0F1dG9Sb3V0ZXIuUG9pbnRMaXN0LmpzIiwic3JjL0F1dG9Sb3V0ZXIuUG9ydC5qcyIsInNyYy9BdXRvUm91dGVyLlJlY3QuanMiLCJzcmMvQXV0b1JvdXRlci5TaXplLmpzIiwic3JjL0F1dG9Sb3V0ZXIuVXRpbHMuanMiLCJzcmMvQXV0b1JvdXRlci5qcyIsInRlc3QvdXRpbHMvYXV0b3JvdXRlci5yZXBsYXkuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdldBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDMWtCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeklBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDalFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0T0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6VkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzckRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeHZFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeGlCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNhQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNVVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsNUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOWRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLy8gaHR0cDovL3dpa2kuY29tbW9uanMub3JnL3dpa2kvVW5pdF9UZXN0aW5nLzEuMFxuLy9cbi8vIFRISVMgSVMgTk9UIFRFU1RFRCBOT1IgTElLRUxZIFRPIFdPUksgT1VUU0lERSBWOCFcbi8vXG4vLyBPcmlnaW5hbGx5IGZyb20gbmFyd2hhbC5qcyAoaHR0cDovL25hcndoYWxqcy5vcmcpXG4vLyBDb3B5cmlnaHQgKGMpIDIwMDkgVGhvbWFzIFJvYmluc29uIDwyODBub3J0aC5jb20+XG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGEgY29weVxuLy8gb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGUgJ1NvZnR3YXJlJyksIHRvXG4vLyBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmcgd2l0aG91dCBsaW1pdGF0aW9uIHRoZVxuLy8gcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCwgZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yXG4vLyBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXQgcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpc1xuLy8gZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpblxuLy8gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEICdBUyBJUycsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1Jcbi8vIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZLFxuLy8gRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFXG4vLyBBVVRIT1JTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLCBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTlxuLy8gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTlxuLy8gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbi8vIHdoZW4gdXNlZCBpbiBub2RlLCB0aGlzIHdpbGwgYWN0dWFsbHkgbG9hZCB0aGUgdXRpbCBtb2R1bGUgd2UgZGVwZW5kIG9uXG4vLyB2ZXJzdXMgbG9hZGluZyB0aGUgYnVpbHRpbiB1dGlsIG1vZHVsZSBhcyBoYXBwZW5zIG90aGVyd2lzZVxuLy8gdGhpcyBpcyBhIGJ1ZyBpbiBub2RlIG1vZHVsZSBsb2FkaW5nIGFzIGZhciBhcyBJIGFtIGNvbmNlcm5lZFxudmFyIHV0aWwgPSByZXF1aXJlKCd1dGlsLycpO1xuXG52YXIgcFNsaWNlID0gQXJyYXkucHJvdG90eXBlLnNsaWNlO1xudmFyIGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5cbi8vIDEuIFRoZSBhc3NlcnQgbW9kdWxlIHByb3ZpZGVzIGZ1bmN0aW9ucyB0aGF0IHRocm93XG4vLyBBc3NlcnRpb25FcnJvcidzIHdoZW4gcGFydGljdWxhciBjb25kaXRpb25zIGFyZSBub3QgbWV0LiBUaGVcbi8vIGFzc2VydCBtb2R1bGUgbXVzdCBjb25mb3JtIHRvIHRoZSBmb2xsb3dpbmcgaW50ZXJmYWNlLlxuXG52YXIgYXNzZXJ0ID0gbW9kdWxlLmV4cG9ydHMgPSBvaztcblxuLy8gMi4gVGhlIEFzc2VydGlvbkVycm9yIGlzIGRlZmluZWQgaW4gYXNzZXJ0LlxuLy8gbmV3IGFzc2VydC5Bc3NlcnRpb25FcnJvcih7IG1lc3NhZ2U6IG1lc3NhZ2UsXG4vLyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYWN0dWFsOiBhY3R1YWwsXG4vLyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXhwZWN0ZWQ6IGV4cGVjdGVkIH0pXG5cbmFzc2VydC5Bc3NlcnRpb25FcnJvciA9IGZ1bmN0aW9uIEFzc2VydGlvbkVycm9yKG9wdGlvbnMpIHtcbiAgdGhpcy5uYW1lID0gJ0Fzc2VydGlvbkVycm9yJztcbiAgdGhpcy5hY3R1YWwgPSBvcHRpb25zLmFjdHVhbDtcbiAgdGhpcy5leHBlY3RlZCA9IG9wdGlvbnMuZXhwZWN0ZWQ7XG4gIHRoaXMub3BlcmF0b3IgPSBvcHRpb25zLm9wZXJhdG9yO1xuICBpZiAob3B0aW9ucy5tZXNzYWdlKSB7XG4gICAgdGhpcy5tZXNzYWdlID0gb3B0aW9ucy5tZXNzYWdlO1xuICAgIHRoaXMuZ2VuZXJhdGVkTWVzc2FnZSA9IGZhbHNlO1xuICB9IGVsc2Uge1xuICAgIHRoaXMubWVzc2FnZSA9IGdldE1lc3NhZ2UodGhpcyk7XG4gICAgdGhpcy5nZW5lcmF0ZWRNZXNzYWdlID0gdHJ1ZTtcbiAgfVxuICB2YXIgc3RhY2tTdGFydEZ1bmN0aW9uID0gb3B0aW9ucy5zdGFja1N0YXJ0RnVuY3Rpb24gfHwgZmFpbDtcblxuICBpZiAoRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2UpIHtcbiAgICBFcnJvci5jYXB0dXJlU3RhY2tUcmFjZSh0aGlzLCBzdGFja1N0YXJ0RnVuY3Rpb24pO1xuICB9XG4gIGVsc2Uge1xuICAgIC8vIG5vbiB2OCBicm93c2VycyBzbyB3ZSBjYW4gaGF2ZSBhIHN0YWNrdHJhY2VcbiAgICB2YXIgZXJyID0gbmV3IEVycm9yKCk7XG4gICAgaWYgKGVyci5zdGFjaykge1xuICAgICAgdmFyIG91dCA9IGVyci5zdGFjaztcblxuICAgICAgLy8gdHJ5IHRvIHN0cmlwIHVzZWxlc3MgZnJhbWVzXG4gICAgICB2YXIgZm5fbmFtZSA9IHN0YWNrU3RhcnRGdW5jdGlvbi5uYW1lO1xuICAgICAgdmFyIGlkeCA9IG91dC5pbmRleE9mKCdcXG4nICsgZm5fbmFtZSk7XG4gICAgICBpZiAoaWR4ID49IDApIHtcbiAgICAgICAgLy8gb25jZSB3ZSBoYXZlIGxvY2F0ZWQgdGhlIGZ1bmN0aW9uIGZyYW1lXG4gICAgICAgIC8vIHdlIG5lZWQgdG8gc3RyaXAgb3V0IGV2ZXJ5dGhpbmcgYmVmb3JlIGl0IChhbmQgaXRzIGxpbmUpXG4gICAgICAgIHZhciBuZXh0X2xpbmUgPSBvdXQuaW5kZXhPZignXFxuJywgaWR4ICsgMSk7XG4gICAgICAgIG91dCA9IG91dC5zdWJzdHJpbmcobmV4dF9saW5lICsgMSk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuc3RhY2sgPSBvdXQ7XG4gICAgfVxuICB9XG59O1xuXG4vLyBhc3NlcnQuQXNzZXJ0aW9uRXJyb3IgaW5zdGFuY2VvZiBFcnJvclxudXRpbC5pbmhlcml0cyhhc3NlcnQuQXNzZXJ0aW9uRXJyb3IsIEVycm9yKTtcblxuZnVuY3Rpb24gcmVwbGFjZXIoa2V5LCB2YWx1ZSkge1xuICBpZiAodXRpbC5pc1VuZGVmaW5lZCh2YWx1ZSkpIHtcbiAgICByZXR1cm4gJycgKyB2YWx1ZTtcbiAgfVxuICBpZiAodXRpbC5pc051bWJlcih2YWx1ZSkgJiYgIWlzRmluaXRlKHZhbHVlKSkge1xuICAgIHJldHVybiB2YWx1ZS50b1N0cmluZygpO1xuICB9XG4gIGlmICh1dGlsLmlzRnVuY3Rpb24odmFsdWUpIHx8IHV0aWwuaXNSZWdFeHAodmFsdWUpKSB7XG4gICAgcmV0dXJuIHZhbHVlLnRvU3RyaW5nKCk7XG4gIH1cbiAgcmV0dXJuIHZhbHVlO1xufVxuXG5mdW5jdGlvbiB0cnVuY2F0ZShzLCBuKSB7XG4gIGlmICh1dGlsLmlzU3RyaW5nKHMpKSB7XG4gICAgcmV0dXJuIHMubGVuZ3RoIDwgbiA/IHMgOiBzLnNsaWNlKDAsIG4pO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBzO1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldE1lc3NhZ2Uoc2VsZikge1xuICByZXR1cm4gdHJ1bmNhdGUoSlNPTi5zdHJpbmdpZnkoc2VsZi5hY3R1YWwsIHJlcGxhY2VyKSwgMTI4KSArICcgJyArXG4gICAgICAgICBzZWxmLm9wZXJhdG9yICsgJyAnICtcbiAgICAgICAgIHRydW5jYXRlKEpTT04uc3RyaW5naWZ5KHNlbGYuZXhwZWN0ZWQsIHJlcGxhY2VyKSwgMTI4KTtcbn1cblxuLy8gQXQgcHJlc2VudCBvbmx5IHRoZSB0aHJlZSBrZXlzIG1lbnRpb25lZCBhYm92ZSBhcmUgdXNlZCBhbmRcbi8vIHVuZGVyc3Rvb2QgYnkgdGhlIHNwZWMuIEltcGxlbWVudGF0aW9ucyBvciBzdWIgbW9kdWxlcyBjYW4gcGFzc1xuLy8gb3RoZXIga2V5cyB0byB0aGUgQXNzZXJ0aW9uRXJyb3IncyBjb25zdHJ1Y3RvciAtIHRoZXkgd2lsbCBiZVxuLy8gaWdub3JlZC5cblxuLy8gMy4gQWxsIG9mIHRoZSBmb2xsb3dpbmcgZnVuY3Rpb25zIG11c3QgdGhyb3cgYW4gQXNzZXJ0aW9uRXJyb3Jcbi8vIHdoZW4gYSBjb3JyZXNwb25kaW5nIGNvbmRpdGlvbiBpcyBub3QgbWV0LCB3aXRoIGEgbWVzc2FnZSB0aGF0XG4vLyBtYXkgYmUgdW5kZWZpbmVkIGlmIG5vdCBwcm92aWRlZC4gIEFsbCBhc3NlcnRpb24gbWV0aG9kcyBwcm92aWRlXG4vLyBib3RoIHRoZSBhY3R1YWwgYW5kIGV4cGVjdGVkIHZhbHVlcyB0byB0aGUgYXNzZXJ0aW9uIGVycm9yIGZvclxuLy8gZGlzcGxheSBwdXJwb3Nlcy5cblxuZnVuY3Rpb24gZmFpbChhY3R1YWwsIGV4cGVjdGVkLCBtZXNzYWdlLCBvcGVyYXRvciwgc3RhY2tTdGFydEZ1bmN0aW9uKSB7XG4gIHRocm93IG5ldyBhc3NlcnQuQXNzZXJ0aW9uRXJyb3Ioe1xuICAgIG1lc3NhZ2U6IG1lc3NhZ2UsXG4gICAgYWN0dWFsOiBhY3R1YWwsXG4gICAgZXhwZWN0ZWQ6IGV4cGVjdGVkLFxuICAgIG9wZXJhdG9yOiBvcGVyYXRvcixcbiAgICBzdGFja1N0YXJ0RnVuY3Rpb246IHN0YWNrU3RhcnRGdW5jdGlvblxuICB9KTtcbn1cblxuLy8gRVhURU5TSU9OISBhbGxvd3MgZm9yIHdlbGwgYmVoYXZlZCBlcnJvcnMgZGVmaW5lZCBlbHNld2hlcmUuXG5hc3NlcnQuZmFpbCA9IGZhaWw7XG5cbi8vIDQuIFB1cmUgYXNzZXJ0aW9uIHRlc3RzIHdoZXRoZXIgYSB2YWx1ZSBpcyB0cnV0aHksIGFzIGRldGVybWluZWRcbi8vIGJ5ICEhZ3VhcmQuXG4vLyBhc3NlcnQub2soZ3VhcmQsIG1lc3NhZ2Vfb3B0KTtcbi8vIFRoaXMgc3RhdGVtZW50IGlzIGVxdWl2YWxlbnQgdG8gYXNzZXJ0LmVxdWFsKHRydWUsICEhZ3VhcmQsXG4vLyBtZXNzYWdlX29wdCk7LiBUbyB0ZXN0IHN0cmljdGx5IGZvciB0aGUgdmFsdWUgdHJ1ZSwgdXNlXG4vLyBhc3NlcnQuc3RyaWN0RXF1YWwodHJ1ZSwgZ3VhcmQsIG1lc3NhZ2Vfb3B0KTsuXG5cbmZ1bmN0aW9uIG9rKHZhbHVlLCBtZXNzYWdlKSB7XG4gIGlmICghdmFsdWUpIGZhaWwodmFsdWUsIHRydWUsIG1lc3NhZ2UsICc9PScsIGFzc2VydC5vayk7XG59XG5hc3NlcnQub2sgPSBvaztcblxuLy8gNS4gVGhlIGVxdWFsaXR5IGFzc2VydGlvbiB0ZXN0cyBzaGFsbG93LCBjb2VyY2l2ZSBlcXVhbGl0eSB3aXRoXG4vLyA9PS5cbi8vIGFzc2VydC5lcXVhbChhY3R1YWwsIGV4cGVjdGVkLCBtZXNzYWdlX29wdCk7XG5cbmFzc2VydC5lcXVhbCA9IGZ1bmN0aW9uIGVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQsIG1lc3NhZ2UpIHtcbiAgaWYgKGFjdHVhbCAhPSBleHBlY3RlZCkgZmFpbChhY3R1YWwsIGV4cGVjdGVkLCBtZXNzYWdlLCAnPT0nLCBhc3NlcnQuZXF1YWwpO1xufTtcblxuLy8gNi4gVGhlIG5vbi1lcXVhbGl0eSBhc3NlcnRpb24gdGVzdHMgZm9yIHdoZXRoZXIgdHdvIG9iamVjdHMgYXJlIG5vdCBlcXVhbFxuLy8gd2l0aCAhPSBhc3NlcnQubm90RXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZV9vcHQpO1xuXG5hc3NlcnQubm90RXF1YWwgPSBmdW5jdGlvbiBub3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkLCBtZXNzYWdlKSB7XG4gIGlmIChhY3R1YWwgPT0gZXhwZWN0ZWQpIHtcbiAgICBmYWlsKGFjdHVhbCwgZXhwZWN0ZWQsIG1lc3NhZ2UsICchPScsIGFzc2VydC5ub3RFcXVhbCk7XG4gIH1cbn07XG5cbi8vIDcuIFRoZSBlcXVpdmFsZW5jZSBhc3NlcnRpb24gdGVzdHMgYSBkZWVwIGVxdWFsaXR5IHJlbGF0aW9uLlxuLy8gYXNzZXJ0LmRlZXBFcXVhbChhY3R1YWwsIGV4cGVjdGVkLCBtZXNzYWdlX29wdCk7XG5cbmFzc2VydC5kZWVwRXF1YWwgPSBmdW5jdGlvbiBkZWVwRXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZSkge1xuICBpZiAoIV9kZWVwRXF1YWwoYWN0dWFsLCBleHBlY3RlZCkpIHtcbiAgICBmYWlsKGFjdHVhbCwgZXhwZWN0ZWQsIG1lc3NhZ2UsICdkZWVwRXF1YWwnLCBhc3NlcnQuZGVlcEVxdWFsKTtcbiAgfVxufTtcblxuZnVuY3Rpb24gX2RlZXBFcXVhbChhY3R1YWwsIGV4cGVjdGVkKSB7XG4gIC8vIDcuMS4gQWxsIGlkZW50aWNhbCB2YWx1ZXMgYXJlIGVxdWl2YWxlbnQsIGFzIGRldGVybWluZWQgYnkgPT09LlxuICBpZiAoYWN0dWFsID09PSBleHBlY3RlZCkge1xuICAgIHJldHVybiB0cnVlO1xuXG4gIH0gZWxzZSBpZiAodXRpbC5pc0J1ZmZlcihhY3R1YWwpICYmIHV0aWwuaXNCdWZmZXIoZXhwZWN0ZWQpKSB7XG4gICAgaWYgKGFjdHVhbC5sZW5ndGggIT0gZXhwZWN0ZWQubGVuZ3RoKSByZXR1cm4gZmFsc2U7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFjdHVhbC5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGFjdHVhbFtpXSAhPT0gZXhwZWN0ZWRbaV0pIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcblxuICAvLyA3LjIuIElmIHRoZSBleHBlY3RlZCB2YWx1ZSBpcyBhIERhdGUgb2JqZWN0LCB0aGUgYWN0dWFsIHZhbHVlIGlzXG4gIC8vIGVxdWl2YWxlbnQgaWYgaXQgaXMgYWxzbyBhIERhdGUgb2JqZWN0IHRoYXQgcmVmZXJzIHRvIHRoZSBzYW1lIHRpbWUuXG4gIH0gZWxzZSBpZiAodXRpbC5pc0RhdGUoYWN0dWFsKSAmJiB1dGlsLmlzRGF0ZShleHBlY3RlZCkpIHtcbiAgICByZXR1cm4gYWN0dWFsLmdldFRpbWUoKSA9PT0gZXhwZWN0ZWQuZ2V0VGltZSgpO1xuXG4gIC8vIDcuMyBJZiB0aGUgZXhwZWN0ZWQgdmFsdWUgaXMgYSBSZWdFeHAgb2JqZWN0LCB0aGUgYWN0dWFsIHZhbHVlIGlzXG4gIC8vIGVxdWl2YWxlbnQgaWYgaXQgaXMgYWxzbyBhIFJlZ0V4cCBvYmplY3Qgd2l0aCB0aGUgc2FtZSBzb3VyY2UgYW5kXG4gIC8vIHByb3BlcnRpZXMgKGBnbG9iYWxgLCBgbXVsdGlsaW5lYCwgYGxhc3RJbmRleGAsIGBpZ25vcmVDYXNlYCkuXG4gIH0gZWxzZSBpZiAodXRpbC5pc1JlZ0V4cChhY3R1YWwpICYmIHV0aWwuaXNSZWdFeHAoZXhwZWN0ZWQpKSB7XG4gICAgcmV0dXJuIGFjdHVhbC5zb3VyY2UgPT09IGV4cGVjdGVkLnNvdXJjZSAmJlxuICAgICAgICAgICBhY3R1YWwuZ2xvYmFsID09PSBleHBlY3RlZC5nbG9iYWwgJiZcbiAgICAgICAgICAgYWN0dWFsLm11bHRpbGluZSA9PT0gZXhwZWN0ZWQubXVsdGlsaW5lICYmXG4gICAgICAgICAgIGFjdHVhbC5sYXN0SW5kZXggPT09IGV4cGVjdGVkLmxhc3RJbmRleCAmJlxuICAgICAgICAgICBhY3R1YWwuaWdub3JlQ2FzZSA9PT0gZXhwZWN0ZWQuaWdub3JlQ2FzZTtcblxuICAvLyA3LjQuIE90aGVyIHBhaXJzIHRoYXQgZG8gbm90IGJvdGggcGFzcyB0eXBlb2YgdmFsdWUgPT0gJ29iamVjdCcsXG4gIC8vIGVxdWl2YWxlbmNlIGlzIGRldGVybWluZWQgYnkgPT0uXG4gIH0gZWxzZSBpZiAoIXV0aWwuaXNPYmplY3QoYWN0dWFsKSAmJiAhdXRpbC5pc09iamVjdChleHBlY3RlZCkpIHtcbiAgICByZXR1cm4gYWN0dWFsID09IGV4cGVjdGVkO1xuXG4gIC8vIDcuNSBGb3IgYWxsIG90aGVyIE9iamVjdCBwYWlycywgaW5jbHVkaW5nIEFycmF5IG9iamVjdHMsIGVxdWl2YWxlbmNlIGlzXG4gIC8vIGRldGVybWluZWQgYnkgaGF2aW5nIHRoZSBzYW1lIG51bWJlciBvZiBvd25lZCBwcm9wZXJ0aWVzIChhcyB2ZXJpZmllZFxuICAvLyB3aXRoIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCksIHRoZSBzYW1lIHNldCBvZiBrZXlzXG4gIC8vIChhbHRob3VnaCBub3QgbmVjZXNzYXJpbHkgdGhlIHNhbWUgb3JkZXIpLCBlcXVpdmFsZW50IHZhbHVlcyBmb3IgZXZlcnlcbiAgLy8gY29ycmVzcG9uZGluZyBrZXksIGFuZCBhbiBpZGVudGljYWwgJ3Byb3RvdHlwZScgcHJvcGVydHkuIE5vdGU6IHRoaXNcbiAgLy8gYWNjb3VudHMgZm9yIGJvdGggbmFtZWQgYW5kIGluZGV4ZWQgcHJvcGVydGllcyBvbiBBcnJheXMuXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG9iakVxdWl2KGFjdHVhbCwgZXhwZWN0ZWQpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGlzQXJndW1lbnRzKG9iamVjdCkge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iamVjdCkgPT0gJ1tvYmplY3QgQXJndW1lbnRzXSc7XG59XG5cbmZ1bmN0aW9uIG9iakVxdWl2KGEsIGIpIHtcbiAgaWYgKHV0aWwuaXNOdWxsT3JVbmRlZmluZWQoYSkgfHwgdXRpbC5pc051bGxPclVuZGVmaW5lZChiKSlcbiAgICByZXR1cm4gZmFsc2U7XG4gIC8vIGFuIGlkZW50aWNhbCAncHJvdG90eXBlJyBwcm9wZXJ0eS5cbiAgaWYgKGEucHJvdG90eXBlICE9PSBiLnByb3RvdHlwZSkgcmV0dXJuIGZhbHNlO1xuICAvLyBpZiBvbmUgaXMgYSBwcmltaXRpdmUsIHRoZSBvdGhlciBtdXN0IGJlIHNhbWVcbiAgaWYgKHV0aWwuaXNQcmltaXRpdmUoYSkgfHwgdXRpbC5pc1ByaW1pdGl2ZShiKSkge1xuICAgIHJldHVybiBhID09PSBiO1xuICB9XG4gIHZhciBhSXNBcmdzID0gaXNBcmd1bWVudHMoYSksXG4gICAgICBiSXNBcmdzID0gaXNBcmd1bWVudHMoYik7XG4gIGlmICgoYUlzQXJncyAmJiAhYklzQXJncykgfHwgKCFhSXNBcmdzICYmIGJJc0FyZ3MpKVxuICAgIHJldHVybiBmYWxzZTtcbiAgaWYgKGFJc0FyZ3MpIHtcbiAgICBhID0gcFNsaWNlLmNhbGwoYSk7XG4gICAgYiA9IHBTbGljZS5jYWxsKGIpO1xuICAgIHJldHVybiBfZGVlcEVxdWFsKGEsIGIpO1xuICB9XG4gIHZhciBrYSA9IG9iamVjdEtleXMoYSksXG4gICAgICBrYiA9IG9iamVjdEtleXMoYiksXG4gICAgICBrZXksIGk7XG4gIC8vIGhhdmluZyB0aGUgc2FtZSBudW1iZXIgb2Ygb3duZWQgcHJvcGVydGllcyAoa2V5cyBpbmNvcnBvcmF0ZXNcbiAgLy8gaGFzT3duUHJvcGVydHkpXG4gIGlmIChrYS5sZW5ndGggIT0ga2IubGVuZ3RoKVxuICAgIHJldHVybiBmYWxzZTtcbiAgLy90aGUgc2FtZSBzZXQgb2Yga2V5cyAoYWx0aG91Z2ggbm90IG5lY2Vzc2FyaWx5IHRoZSBzYW1lIG9yZGVyKSxcbiAga2Euc29ydCgpO1xuICBrYi5zb3J0KCk7XG4gIC8vfn5+Y2hlYXAga2V5IHRlc3RcbiAgZm9yIChpID0ga2EubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICBpZiAoa2FbaV0gIT0ga2JbaV0pXG4gICAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgLy9lcXVpdmFsZW50IHZhbHVlcyBmb3IgZXZlcnkgY29ycmVzcG9uZGluZyBrZXksIGFuZFxuICAvL35+fnBvc3NpYmx5IGV4cGVuc2l2ZSBkZWVwIHRlc3RcbiAgZm9yIChpID0ga2EubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICBrZXkgPSBrYVtpXTtcbiAgICBpZiAoIV9kZWVwRXF1YWwoYVtrZXldLCBiW2tleV0pKSByZXR1cm4gZmFsc2U7XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbi8vIDguIFRoZSBub24tZXF1aXZhbGVuY2UgYXNzZXJ0aW9uIHRlc3RzIGZvciBhbnkgZGVlcCBpbmVxdWFsaXR5LlxuLy8gYXNzZXJ0Lm5vdERlZXBFcXVhbChhY3R1YWwsIGV4cGVjdGVkLCBtZXNzYWdlX29wdCk7XG5cbmFzc2VydC5ub3REZWVwRXF1YWwgPSBmdW5jdGlvbiBub3REZWVwRXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZSkge1xuICBpZiAoX2RlZXBFcXVhbChhY3R1YWwsIGV4cGVjdGVkKSkge1xuICAgIGZhaWwoYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZSwgJ25vdERlZXBFcXVhbCcsIGFzc2VydC5ub3REZWVwRXF1YWwpO1xuICB9XG59O1xuXG4vLyA5LiBUaGUgc3RyaWN0IGVxdWFsaXR5IGFzc2VydGlvbiB0ZXN0cyBzdHJpY3QgZXF1YWxpdHksIGFzIGRldGVybWluZWQgYnkgPT09LlxuLy8gYXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQsIG1lc3NhZ2Vfb3B0KTtcblxuYXNzZXJ0LnN0cmljdEVxdWFsID0gZnVuY3Rpb24gc3RyaWN0RXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZSkge1xuICBpZiAoYWN0dWFsICE9PSBleHBlY3RlZCkge1xuICAgIGZhaWwoYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZSwgJz09PScsIGFzc2VydC5zdHJpY3RFcXVhbCk7XG4gIH1cbn07XG5cbi8vIDEwLiBUaGUgc3RyaWN0IG5vbi1lcXVhbGl0eSBhc3NlcnRpb24gdGVzdHMgZm9yIHN0cmljdCBpbmVxdWFsaXR5LCBhc1xuLy8gZGV0ZXJtaW5lZCBieSAhPT0uICBhc3NlcnQubm90U3RyaWN0RXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZV9vcHQpO1xuXG5hc3NlcnQubm90U3RyaWN0RXF1YWwgPSBmdW5jdGlvbiBub3RTdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkLCBtZXNzYWdlKSB7XG4gIGlmIChhY3R1YWwgPT09IGV4cGVjdGVkKSB7XG4gICAgZmFpbChhY3R1YWwsIGV4cGVjdGVkLCBtZXNzYWdlLCAnIT09JywgYXNzZXJ0Lm5vdFN0cmljdEVxdWFsKTtcbiAgfVxufTtcblxuZnVuY3Rpb24gZXhwZWN0ZWRFeGNlcHRpb24oYWN0dWFsLCBleHBlY3RlZCkge1xuICBpZiAoIWFjdHVhbCB8fCAhZXhwZWN0ZWQpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBpZiAoT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKGV4cGVjdGVkKSA9PSAnW29iamVjdCBSZWdFeHBdJykge1xuICAgIHJldHVybiBleHBlY3RlZC50ZXN0KGFjdHVhbCk7XG4gIH0gZWxzZSBpZiAoYWN0dWFsIGluc3RhbmNlb2YgZXhwZWN0ZWQpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSBlbHNlIGlmIChleHBlY3RlZC5jYWxsKHt9LCBhY3R1YWwpID09PSB0cnVlKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICByZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIF90aHJvd3Moc2hvdWxkVGhyb3csIGJsb2NrLCBleHBlY3RlZCwgbWVzc2FnZSkge1xuICB2YXIgYWN0dWFsO1xuXG4gIGlmICh1dGlsLmlzU3RyaW5nKGV4cGVjdGVkKSkge1xuICAgIG1lc3NhZ2UgPSBleHBlY3RlZDtcbiAgICBleHBlY3RlZCA9IG51bGw7XG4gIH1cblxuICB0cnkge1xuICAgIGJsb2NrKCk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBhY3R1YWwgPSBlO1xuICB9XG5cbiAgbWVzc2FnZSA9IChleHBlY3RlZCAmJiBleHBlY3RlZC5uYW1lID8gJyAoJyArIGV4cGVjdGVkLm5hbWUgKyAnKS4nIDogJy4nKSArXG4gICAgICAgICAgICAobWVzc2FnZSA/ICcgJyArIG1lc3NhZ2UgOiAnLicpO1xuXG4gIGlmIChzaG91bGRUaHJvdyAmJiAhYWN0dWFsKSB7XG4gICAgZmFpbChhY3R1YWwsIGV4cGVjdGVkLCAnTWlzc2luZyBleHBlY3RlZCBleGNlcHRpb24nICsgbWVzc2FnZSk7XG4gIH1cblxuICBpZiAoIXNob3VsZFRocm93ICYmIGV4cGVjdGVkRXhjZXB0aW9uKGFjdHVhbCwgZXhwZWN0ZWQpKSB7XG4gICAgZmFpbChhY3R1YWwsIGV4cGVjdGVkLCAnR290IHVud2FudGVkIGV4Y2VwdGlvbicgKyBtZXNzYWdlKTtcbiAgfVxuXG4gIGlmICgoc2hvdWxkVGhyb3cgJiYgYWN0dWFsICYmIGV4cGVjdGVkICYmXG4gICAgICAhZXhwZWN0ZWRFeGNlcHRpb24oYWN0dWFsLCBleHBlY3RlZCkpIHx8ICghc2hvdWxkVGhyb3cgJiYgYWN0dWFsKSkge1xuICAgIHRocm93IGFjdHVhbDtcbiAgfVxufVxuXG4vLyAxMS4gRXhwZWN0ZWQgdG8gdGhyb3cgYW4gZXJyb3I6XG4vLyBhc3NlcnQudGhyb3dzKGJsb2NrLCBFcnJvcl9vcHQsIG1lc3NhZ2Vfb3B0KTtcblxuYXNzZXJ0LnRocm93cyA9IGZ1bmN0aW9uKGJsb2NrLCAvKm9wdGlvbmFsKi9lcnJvciwgLypvcHRpb25hbCovbWVzc2FnZSkge1xuICBfdGhyb3dzLmFwcGx5KHRoaXMsIFt0cnVlXS5jb25jYXQocFNsaWNlLmNhbGwoYXJndW1lbnRzKSkpO1xufTtcblxuLy8gRVhURU5TSU9OISBUaGlzIGlzIGFubm95aW5nIHRvIHdyaXRlIG91dHNpZGUgdGhpcyBtb2R1bGUuXG5hc3NlcnQuZG9lc05vdFRocm93ID0gZnVuY3Rpb24oYmxvY2ssIC8qb3B0aW9uYWwqL21lc3NhZ2UpIHtcbiAgX3Rocm93cy5hcHBseSh0aGlzLCBbZmFsc2VdLmNvbmNhdChwU2xpY2UuY2FsbChhcmd1bWVudHMpKSk7XG59O1xuXG5hc3NlcnQuaWZFcnJvciA9IGZ1bmN0aW9uKGVycikgeyBpZiAoZXJyKSB7dGhyb3cgZXJyO319O1xuXG52YXIgb2JqZWN0S2V5cyA9IE9iamVjdC5rZXlzIHx8IGZ1bmN0aW9uIChvYmopIHtcbiAgdmFyIGtleXMgPSBbXTtcbiAgZm9yICh2YXIga2V5IGluIG9iaikge1xuICAgIGlmIChoYXNPd24uY2FsbChvYmosIGtleSkpIGtleXMucHVzaChrZXkpO1xuICB9XG4gIHJldHVybiBrZXlzO1xufTtcbiIsImlmICh0eXBlb2YgT2JqZWN0LmNyZWF0ZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAvLyBpbXBsZW1lbnRhdGlvbiBmcm9tIHN0YW5kYXJkIG5vZGUuanMgJ3V0aWwnIG1vZHVsZVxuICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGluaGVyaXRzKGN0b3IsIHN1cGVyQ3Rvcikge1xuICAgIGN0b3Iuc3VwZXJfID0gc3VwZXJDdG9yXG4gICAgY3Rvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKHN1cGVyQ3Rvci5wcm90b3R5cGUsIHtcbiAgICAgIGNvbnN0cnVjdG9yOiB7XG4gICAgICAgIHZhbHVlOiBjdG9yLFxuICAgICAgICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgICAgfVxuICAgIH0pO1xuICB9O1xufSBlbHNlIHtcbiAgLy8gb2xkIHNjaG9vbCBzaGltIGZvciBvbGQgYnJvd3NlcnNcbiAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpbmhlcml0cyhjdG9yLCBzdXBlckN0b3IpIHtcbiAgICBjdG9yLnN1cGVyXyA9IHN1cGVyQ3RvclxuICAgIHZhciBUZW1wQ3RvciA9IGZ1bmN0aW9uICgpIHt9XG4gICAgVGVtcEN0b3IucHJvdG90eXBlID0gc3VwZXJDdG9yLnByb3RvdHlwZVxuICAgIGN0b3IucHJvdG90eXBlID0gbmV3IFRlbXBDdG9yKClcbiAgICBjdG9yLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IGN0b3JcbiAgfVxufVxuIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG5cbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IHNldFRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZHJhaW5RdWV1ZSwgMCk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGlzQnVmZmVyKGFyZykge1xuICByZXR1cm4gYXJnICYmIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnXG4gICAgJiYgdHlwZW9mIGFyZy5jb3B5ID09PSAnZnVuY3Rpb24nXG4gICAgJiYgdHlwZW9mIGFyZy5maWxsID09PSAnZnVuY3Rpb24nXG4gICAgJiYgdHlwZW9mIGFyZy5yZWFkVUludDggPT09ICdmdW5jdGlvbic7XG59IiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbnZhciBmb3JtYXRSZWdFeHAgPSAvJVtzZGolXS9nO1xuZXhwb3J0cy5mb3JtYXQgPSBmdW5jdGlvbihmKSB7XG4gIGlmICghaXNTdHJpbmcoZikpIHtcbiAgICB2YXIgb2JqZWN0cyA9IFtdO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBvYmplY3RzLnB1c2goaW5zcGVjdChhcmd1bWVudHNbaV0pKTtcbiAgICB9XG4gICAgcmV0dXJuIG9iamVjdHMuam9pbignICcpO1xuICB9XG5cbiAgdmFyIGkgPSAxO1xuICB2YXIgYXJncyA9IGFyZ3VtZW50cztcbiAgdmFyIGxlbiA9IGFyZ3MubGVuZ3RoO1xuICB2YXIgc3RyID0gU3RyaW5nKGYpLnJlcGxhY2UoZm9ybWF0UmVnRXhwLCBmdW5jdGlvbih4KSB7XG4gICAgaWYgKHggPT09ICclJScpIHJldHVybiAnJSc7XG4gICAgaWYgKGkgPj0gbGVuKSByZXR1cm4geDtcbiAgICBzd2l0Y2ggKHgpIHtcbiAgICAgIGNhc2UgJyVzJzogcmV0dXJuIFN0cmluZyhhcmdzW2krK10pO1xuICAgICAgY2FzZSAnJWQnOiByZXR1cm4gTnVtYmVyKGFyZ3NbaSsrXSk7XG4gICAgICBjYXNlICclaic6XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGFyZ3NbaSsrXSk7XG4gICAgICAgIH0gY2F0Y2ggKF8pIHtcbiAgICAgICAgICByZXR1cm4gJ1tDaXJjdWxhcl0nO1xuICAgICAgICB9XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4geDtcbiAgICB9XG4gIH0pO1xuICBmb3IgKHZhciB4ID0gYXJnc1tpXTsgaSA8IGxlbjsgeCA9IGFyZ3NbKytpXSkge1xuICAgIGlmIChpc051bGwoeCkgfHwgIWlzT2JqZWN0KHgpKSB7XG4gICAgICBzdHIgKz0gJyAnICsgeDtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RyICs9ICcgJyArIGluc3BlY3QoeCk7XG4gICAgfVxuICB9XG4gIHJldHVybiBzdHI7XG59O1xuXG5cbi8vIE1hcmsgdGhhdCBhIG1ldGhvZCBzaG91bGQgbm90IGJlIHVzZWQuXG4vLyBSZXR1cm5zIGEgbW9kaWZpZWQgZnVuY3Rpb24gd2hpY2ggd2FybnMgb25jZSBieSBkZWZhdWx0LlxuLy8gSWYgLS1uby1kZXByZWNhdGlvbiBpcyBzZXQsIHRoZW4gaXQgaXMgYSBuby1vcC5cbmV4cG9ydHMuZGVwcmVjYXRlID0gZnVuY3Rpb24oZm4sIG1zZykge1xuICAvLyBBbGxvdyBmb3IgZGVwcmVjYXRpbmcgdGhpbmdzIGluIHRoZSBwcm9jZXNzIG9mIHN0YXJ0aW5nIHVwLlxuICBpZiAoaXNVbmRlZmluZWQoZ2xvYmFsLnByb2Nlc3MpKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIGV4cG9ydHMuZGVwcmVjYXRlKGZuLCBtc2cpLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfTtcbiAgfVxuXG4gIGlmIChwcm9jZXNzLm5vRGVwcmVjYXRpb24gPT09IHRydWUpIHtcbiAgICByZXR1cm4gZm47XG4gIH1cblxuICB2YXIgd2FybmVkID0gZmFsc2U7XG4gIGZ1bmN0aW9uIGRlcHJlY2F0ZWQoKSB7XG4gICAgaWYgKCF3YXJuZWQpIHtcbiAgICAgIGlmIChwcm9jZXNzLnRocm93RGVwcmVjYXRpb24pIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKG1zZyk7XG4gICAgICB9IGVsc2UgaWYgKHByb2Nlc3MudHJhY2VEZXByZWNhdGlvbikge1xuICAgICAgICBjb25zb2xlLnRyYWNlKG1zZyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmVycm9yKG1zZyk7XG4gICAgICB9XG4gICAgICB3YXJuZWQgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgfVxuXG4gIHJldHVybiBkZXByZWNhdGVkO1xufTtcblxuXG52YXIgZGVidWdzID0ge307XG52YXIgZGVidWdFbnZpcm9uO1xuZXhwb3J0cy5kZWJ1Z2xvZyA9IGZ1bmN0aW9uKHNldCkge1xuICBpZiAoaXNVbmRlZmluZWQoZGVidWdFbnZpcm9uKSlcbiAgICBkZWJ1Z0Vudmlyb24gPSBwcm9jZXNzLmVudi5OT0RFX0RFQlVHIHx8ICcnO1xuICBzZXQgPSBzZXQudG9VcHBlckNhc2UoKTtcbiAgaWYgKCFkZWJ1Z3Nbc2V0XSkge1xuICAgIGlmIChuZXcgUmVnRXhwKCdcXFxcYicgKyBzZXQgKyAnXFxcXGInLCAnaScpLnRlc3QoZGVidWdFbnZpcm9uKSkge1xuICAgICAgdmFyIHBpZCA9IHByb2Nlc3MucGlkO1xuICAgICAgZGVidWdzW3NldF0gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIG1zZyA9IGV4cG9ydHMuZm9ybWF0LmFwcGx5KGV4cG9ydHMsIGFyZ3VtZW50cyk7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJyVzICVkOiAlcycsIHNldCwgcGlkLCBtc2cpO1xuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgZGVidWdzW3NldF0gPSBmdW5jdGlvbigpIHt9O1xuICAgIH1cbiAgfVxuICByZXR1cm4gZGVidWdzW3NldF07XG59O1xuXG5cbi8qKlxuICogRWNob3MgdGhlIHZhbHVlIG9mIGEgdmFsdWUuIFRyeXMgdG8gcHJpbnQgdGhlIHZhbHVlIG91dFxuICogaW4gdGhlIGJlc3Qgd2F5IHBvc3NpYmxlIGdpdmVuIHRoZSBkaWZmZXJlbnQgdHlwZXMuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9iaiBUaGUgb2JqZWN0IHRvIHByaW50IG91dC5cbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzIE9wdGlvbmFsIG9wdGlvbnMgb2JqZWN0IHRoYXQgYWx0ZXJzIHRoZSBvdXRwdXQuXG4gKi9cbi8qIGxlZ2FjeTogb2JqLCBzaG93SGlkZGVuLCBkZXB0aCwgY29sb3JzKi9cbmZ1bmN0aW9uIGluc3BlY3Qob2JqLCBvcHRzKSB7XG4gIC8vIGRlZmF1bHQgb3B0aW9uc1xuICB2YXIgY3R4ID0ge1xuICAgIHNlZW46IFtdLFxuICAgIHN0eWxpemU6IHN0eWxpemVOb0NvbG9yXG4gIH07XG4gIC8vIGxlZ2FjeS4uLlxuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+PSAzKSBjdHguZGVwdGggPSBhcmd1bWVudHNbMl07XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID49IDQpIGN0eC5jb2xvcnMgPSBhcmd1bWVudHNbM107XG4gIGlmIChpc0Jvb2xlYW4ob3B0cykpIHtcbiAgICAvLyBsZWdhY3kuLi5cbiAgICBjdHguc2hvd0hpZGRlbiA9IG9wdHM7XG4gIH0gZWxzZSBpZiAob3B0cykge1xuICAgIC8vIGdvdCBhbiBcIm9wdGlvbnNcIiBvYmplY3RcbiAgICBleHBvcnRzLl9leHRlbmQoY3R4LCBvcHRzKTtcbiAgfVxuICAvLyBzZXQgZGVmYXVsdCBvcHRpb25zXG4gIGlmIChpc1VuZGVmaW5lZChjdHguc2hvd0hpZGRlbikpIGN0eC5zaG93SGlkZGVuID0gZmFsc2U7XG4gIGlmIChpc1VuZGVmaW5lZChjdHguZGVwdGgpKSBjdHguZGVwdGggPSAyO1xuICBpZiAoaXNVbmRlZmluZWQoY3R4LmNvbG9ycykpIGN0eC5jb2xvcnMgPSBmYWxzZTtcbiAgaWYgKGlzVW5kZWZpbmVkKGN0eC5jdXN0b21JbnNwZWN0KSkgY3R4LmN1c3RvbUluc3BlY3QgPSB0cnVlO1xuICBpZiAoY3R4LmNvbG9ycykgY3R4LnN0eWxpemUgPSBzdHlsaXplV2l0aENvbG9yO1xuICByZXR1cm4gZm9ybWF0VmFsdWUoY3R4LCBvYmosIGN0eC5kZXB0aCk7XG59XG5leHBvcnRzLmluc3BlY3QgPSBpbnNwZWN0O1xuXG5cbi8vIGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvQU5TSV9lc2NhcGVfY29kZSNncmFwaGljc1xuaW5zcGVjdC5jb2xvcnMgPSB7XG4gICdib2xkJyA6IFsxLCAyMl0sXG4gICdpdGFsaWMnIDogWzMsIDIzXSxcbiAgJ3VuZGVybGluZScgOiBbNCwgMjRdLFxuICAnaW52ZXJzZScgOiBbNywgMjddLFxuICAnd2hpdGUnIDogWzM3LCAzOV0sXG4gICdncmV5JyA6IFs5MCwgMzldLFxuICAnYmxhY2snIDogWzMwLCAzOV0sXG4gICdibHVlJyA6IFszNCwgMzldLFxuICAnY3lhbicgOiBbMzYsIDM5XSxcbiAgJ2dyZWVuJyA6IFszMiwgMzldLFxuICAnbWFnZW50YScgOiBbMzUsIDM5XSxcbiAgJ3JlZCcgOiBbMzEsIDM5XSxcbiAgJ3llbGxvdycgOiBbMzMsIDM5XVxufTtcblxuLy8gRG9uJ3QgdXNlICdibHVlJyBub3QgdmlzaWJsZSBvbiBjbWQuZXhlXG5pbnNwZWN0LnN0eWxlcyA9IHtcbiAgJ3NwZWNpYWwnOiAnY3lhbicsXG4gICdudW1iZXInOiAneWVsbG93JyxcbiAgJ2Jvb2xlYW4nOiAneWVsbG93JyxcbiAgJ3VuZGVmaW5lZCc6ICdncmV5JyxcbiAgJ251bGwnOiAnYm9sZCcsXG4gICdzdHJpbmcnOiAnZ3JlZW4nLFxuICAnZGF0ZSc6ICdtYWdlbnRhJyxcbiAgLy8gXCJuYW1lXCI6IGludGVudGlvbmFsbHkgbm90IHN0eWxpbmdcbiAgJ3JlZ2V4cCc6ICdyZWQnXG59O1xuXG5cbmZ1bmN0aW9uIHN0eWxpemVXaXRoQ29sb3Ioc3RyLCBzdHlsZVR5cGUpIHtcbiAgdmFyIHN0eWxlID0gaW5zcGVjdC5zdHlsZXNbc3R5bGVUeXBlXTtcblxuICBpZiAoc3R5bGUpIHtcbiAgICByZXR1cm4gJ1xcdTAwMWJbJyArIGluc3BlY3QuY29sb3JzW3N0eWxlXVswXSArICdtJyArIHN0ciArXG4gICAgICAgICAgICdcXHUwMDFiWycgKyBpbnNwZWN0LmNvbG9yc1tzdHlsZV1bMV0gKyAnbSc7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHN0cjtcbiAgfVxufVxuXG5cbmZ1bmN0aW9uIHN0eWxpemVOb0NvbG9yKHN0ciwgc3R5bGVUeXBlKSB7XG4gIHJldHVybiBzdHI7XG59XG5cblxuZnVuY3Rpb24gYXJyYXlUb0hhc2goYXJyYXkpIHtcbiAgdmFyIGhhc2ggPSB7fTtcblxuICBhcnJheS5mb3JFYWNoKGZ1bmN0aW9uKHZhbCwgaWR4KSB7XG4gICAgaGFzaFt2YWxdID0gdHJ1ZTtcbiAgfSk7XG5cbiAgcmV0dXJuIGhhc2g7XG59XG5cblxuZnVuY3Rpb24gZm9ybWF0VmFsdWUoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzKSB7XG4gIC8vIFByb3ZpZGUgYSBob29rIGZvciB1c2VyLXNwZWNpZmllZCBpbnNwZWN0IGZ1bmN0aW9ucy5cbiAgLy8gQ2hlY2sgdGhhdCB2YWx1ZSBpcyBhbiBvYmplY3Qgd2l0aCBhbiBpbnNwZWN0IGZ1bmN0aW9uIG9uIGl0XG4gIGlmIChjdHguY3VzdG9tSW5zcGVjdCAmJlxuICAgICAgdmFsdWUgJiZcbiAgICAgIGlzRnVuY3Rpb24odmFsdWUuaW5zcGVjdCkgJiZcbiAgICAgIC8vIEZpbHRlciBvdXQgdGhlIHV0aWwgbW9kdWxlLCBpdCdzIGluc3BlY3QgZnVuY3Rpb24gaXMgc3BlY2lhbFxuICAgICAgdmFsdWUuaW5zcGVjdCAhPT0gZXhwb3J0cy5pbnNwZWN0ICYmXG4gICAgICAvLyBBbHNvIGZpbHRlciBvdXQgYW55IHByb3RvdHlwZSBvYmplY3RzIHVzaW5nIHRoZSBjaXJjdWxhciBjaGVjay5cbiAgICAgICEodmFsdWUuY29uc3RydWN0b3IgJiYgdmFsdWUuY29uc3RydWN0b3IucHJvdG90eXBlID09PSB2YWx1ZSkpIHtcbiAgICB2YXIgcmV0ID0gdmFsdWUuaW5zcGVjdChyZWN1cnNlVGltZXMsIGN0eCk7XG4gICAgaWYgKCFpc1N0cmluZyhyZXQpKSB7XG4gICAgICByZXQgPSBmb3JtYXRWYWx1ZShjdHgsIHJldCwgcmVjdXJzZVRpbWVzKTtcbiAgICB9XG4gICAgcmV0dXJuIHJldDtcbiAgfVxuXG4gIC8vIFByaW1pdGl2ZSB0eXBlcyBjYW5ub3QgaGF2ZSBwcm9wZXJ0aWVzXG4gIHZhciBwcmltaXRpdmUgPSBmb3JtYXRQcmltaXRpdmUoY3R4LCB2YWx1ZSk7XG4gIGlmIChwcmltaXRpdmUpIHtcbiAgICByZXR1cm4gcHJpbWl0aXZlO1xuICB9XG5cbiAgLy8gTG9vayB1cCB0aGUga2V5cyBvZiB0aGUgb2JqZWN0LlxuICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKHZhbHVlKTtcbiAgdmFyIHZpc2libGVLZXlzID0gYXJyYXlUb0hhc2goa2V5cyk7XG5cbiAgaWYgKGN0eC5zaG93SGlkZGVuKSB7XG4gICAga2V5cyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHZhbHVlKTtcbiAgfVxuXG4gIC8vIElFIGRvZXNuJ3QgbWFrZSBlcnJvciBmaWVsZHMgbm9uLWVudW1lcmFibGVcbiAgLy8gaHR0cDovL21zZG4ubWljcm9zb2Z0LmNvbS9lbi11cy9saWJyYXJ5L2llL2R3dzUyc2J0KHY9dnMuOTQpLmFzcHhcbiAgaWYgKGlzRXJyb3IodmFsdWUpXG4gICAgICAmJiAoa2V5cy5pbmRleE9mKCdtZXNzYWdlJykgPj0gMCB8fCBrZXlzLmluZGV4T2YoJ2Rlc2NyaXB0aW9uJykgPj0gMCkpIHtcbiAgICByZXR1cm4gZm9ybWF0RXJyb3IodmFsdWUpO1xuICB9XG5cbiAgLy8gU29tZSB0eXBlIG9mIG9iamVjdCB3aXRob3V0IHByb3BlcnRpZXMgY2FuIGJlIHNob3J0Y3V0dGVkLlxuICBpZiAoa2V5cy5sZW5ndGggPT09IDApIHtcbiAgICBpZiAoaXNGdW5jdGlvbih2YWx1ZSkpIHtcbiAgICAgIHZhciBuYW1lID0gdmFsdWUubmFtZSA/ICc6ICcgKyB2YWx1ZS5uYW1lIDogJyc7XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoJ1tGdW5jdGlvbicgKyBuYW1lICsgJ10nLCAnc3BlY2lhbCcpO1xuICAgIH1cbiAgICBpZiAoaXNSZWdFeHAodmFsdWUpKSB7XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoUmVnRXhwLnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSwgJ3JlZ2V4cCcpO1xuICAgIH1cbiAgICBpZiAoaXNEYXRlKHZhbHVlKSkge1xuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKERhdGUucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpLCAnZGF0ZScpO1xuICAgIH1cbiAgICBpZiAoaXNFcnJvcih2YWx1ZSkpIHtcbiAgICAgIHJldHVybiBmb3JtYXRFcnJvcih2YWx1ZSk7XG4gICAgfVxuICB9XG5cbiAgdmFyIGJhc2UgPSAnJywgYXJyYXkgPSBmYWxzZSwgYnJhY2VzID0gWyd7JywgJ30nXTtcblxuICAvLyBNYWtlIEFycmF5IHNheSB0aGF0IHRoZXkgYXJlIEFycmF5XG4gIGlmIChpc0FycmF5KHZhbHVlKSkge1xuICAgIGFycmF5ID0gdHJ1ZTtcbiAgICBicmFjZXMgPSBbJ1snLCAnXSddO1xuICB9XG5cbiAgLy8gTWFrZSBmdW5jdGlvbnMgc2F5IHRoYXQgdGhleSBhcmUgZnVuY3Rpb25zXG4gIGlmIChpc0Z1bmN0aW9uKHZhbHVlKSkge1xuICAgIHZhciBuID0gdmFsdWUubmFtZSA/ICc6ICcgKyB2YWx1ZS5uYW1lIDogJyc7XG4gICAgYmFzZSA9ICcgW0Z1bmN0aW9uJyArIG4gKyAnXSc7XG4gIH1cblxuICAvLyBNYWtlIFJlZ0V4cHMgc2F5IHRoYXQgdGhleSBhcmUgUmVnRXhwc1xuICBpZiAoaXNSZWdFeHAodmFsdWUpKSB7XG4gICAgYmFzZSA9ICcgJyArIFJlZ0V4cC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSk7XG4gIH1cblxuICAvLyBNYWtlIGRhdGVzIHdpdGggcHJvcGVydGllcyBmaXJzdCBzYXkgdGhlIGRhdGVcbiAgaWYgKGlzRGF0ZSh2YWx1ZSkpIHtcbiAgICBiYXNlID0gJyAnICsgRGF0ZS5wcm90b3R5cGUudG9VVENTdHJpbmcuY2FsbCh2YWx1ZSk7XG4gIH1cblxuICAvLyBNYWtlIGVycm9yIHdpdGggbWVzc2FnZSBmaXJzdCBzYXkgdGhlIGVycm9yXG4gIGlmIChpc0Vycm9yKHZhbHVlKSkge1xuICAgIGJhc2UgPSAnICcgKyBmb3JtYXRFcnJvcih2YWx1ZSk7XG4gIH1cblxuICBpZiAoa2V5cy5sZW5ndGggPT09IDAgJiYgKCFhcnJheSB8fCB2YWx1ZS5sZW5ndGggPT0gMCkpIHtcbiAgICByZXR1cm4gYnJhY2VzWzBdICsgYmFzZSArIGJyYWNlc1sxXTtcbiAgfVxuXG4gIGlmIChyZWN1cnNlVGltZXMgPCAwKSB7XG4gICAgaWYgKGlzUmVnRXhwKHZhbHVlKSkge1xuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKFJlZ0V4cC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSksICdyZWdleHAnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKCdbT2JqZWN0XScsICdzcGVjaWFsJyk7XG4gICAgfVxuICB9XG5cbiAgY3R4LnNlZW4ucHVzaCh2YWx1ZSk7XG5cbiAgdmFyIG91dHB1dDtcbiAgaWYgKGFycmF5KSB7XG4gICAgb3V0cHV0ID0gZm9ybWF0QXJyYXkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cywga2V5cyk7XG4gIH0gZWxzZSB7XG4gICAgb3V0cHV0ID0ga2V5cy5tYXAoZnVuY3Rpb24oa2V5KSB7XG4gICAgICByZXR1cm4gZm9ybWF0UHJvcGVydHkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cywga2V5LCBhcnJheSk7XG4gICAgfSk7XG4gIH1cblxuICBjdHguc2Vlbi5wb3AoKTtcblxuICByZXR1cm4gcmVkdWNlVG9TaW5nbGVTdHJpbmcob3V0cHV0LCBiYXNlLCBicmFjZXMpO1xufVxuXG5cbmZ1bmN0aW9uIGZvcm1hdFByaW1pdGl2ZShjdHgsIHZhbHVlKSB7XG4gIGlmIChpc1VuZGVmaW5lZCh2YWx1ZSkpXG4gICAgcmV0dXJuIGN0eC5zdHlsaXplKCd1bmRlZmluZWQnLCAndW5kZWZpbmVkJyk7XG4gIGlmIChpc1N0cmluZyh2YWx1ZSkpIHtcbiAgICB2YXIgc2ltcGxlID0gJ1xcJycgKyBKU09OLnN0cmluZ2lmeSh2YWx1ZSkucmVwbGFjZSgvXlwifFwiJC9nLCAnJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKC8nL2csIFwiXFxcXCdcIilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKC9cXFxcXCIvZywgJ1wiJykgKyAnXFwnJztcbiAgICByZXR1cm4gY3R4LnN0eWxpemUoc2ltcGxlLCAnc3RyaW5nJyk7XG4gIH1cbiAgaWYgKGlzTnVtYmVyKHZhbHVlKSlcbiAgICByZXR1cm4gY3R4LnN0eWxpemUoJycgKyB2YWx1ZSwgJ251bWJlcicpO1xuICBpZiAoaXNCb29sZWFuKHZhbHVlKSlcbiAgICByZXR1cm4gY3R4LnN0eWxpemUoJycgKyB2YWx1ZSwgJ2Jvb2xlYW4nKTtcbiAgLy8gRm9yIHNvbWUgcmVhc29uIHR5cGVvZiBudWxsIGlzIFwib2JqZWN0XCIsIHNvIHNwZWNpYWwgY2FzZSBoZXJlLlxuICBpZiAoaXNOdWxsKHZhbHVlKSlcbiAgICByZXR1cm4gY3R4LnN0eWxpemUoJ251bGwnLCAnbnVsbCcpO1xufVxuXG5cbmZ1bmN0aW9uIGZvcm1hdEVycm9yKHZhbHVlKSB7XG4gIHJldHVybiAnWycgKyBFcnJvci5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSkgKyAnXSc7XG59XG5cblxuZnVuY3Rpb24gZm9ybWF0QXJyYXkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cywga2V5cykge1xuICB2YXIgb3V0cHV0ID0gW107XG4gIGZvciAodmFyIGkgPSAwLCBsID0gdmFsdWUubGVuZ3RoOyBpIDwgbDsgKytpKSB7XG4gICAgaWYgKGhhc093blByb3BlcnR5KHZhbHVlLCBTdHJpbmcoaSkpKSB7XG4gICAgICBvdXRwdXQucHVzaChmb3JtYXRQcm9wZXJ0eShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLFxuICAgICAgICAgIFN0cmluZyhpKSwgdHJ1ZSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBvdXRwdXQucHVzaCgnJyk7XG4gICAgfVxuICB9XG4gIGtleXMuZm9yRWFjaChmdW5jdGlvbihrZXkpIHtcbiAgICBpZiAoIWtleS5tYXRjaCgvXlxcZCskLykpIHtcbiAgICAgIG91dHB1dC5wdXNoKGZvcm1hdFByb3BlcnR5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsXG4gICAgICAgICAga2V5LCB0cnVlKSk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIG91dHB1dDtcbn1cblxuXG5mdW5jdGlvbiBmb3JtYXRQcm9wZXJ0eShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLCBrZXksIGFycmF5KSB7XG4gIHZhciBuYW1lLCBzdHIsIGRlc2M7XG4gIGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHZhbHVlLCBrZXkpIHx8IHsgdmFsdWU6IHZhbHVlW2tleV0gfTtcbiAgaWYgKGRlc2MuZ2V0KSB7XG4gICAgaWYgKGRlc2Muc2V0KSB7XG4gICAgICBzdHIgPSBjdHguc3R5bGl6ZSgnW0dldHRlci9TZXR0ZXJdJywgJ3NwZWNpYWwnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RyID0gY3R4LnN0eWxpemUoJ1tHZXR0ZXJdJywgJ3NwZWNpYWwnKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgaWYgKGRlc2Muc2V0KSB7XG4gICAgICBzdHIgPSBjdHguc3R5bGl6ZSgnW1NldHRlcl0nLCAnc3BlY2lhbCcpO1xuICAgIH1cbiAgfVxuICBpZiAoIWhhc093blByb3BlcnR5KHZpc2libGVLZXlzLCBrZXkpKSB7XG4gICAgbmFtZSA9ICdbJyArIGtleSArICddJztcbiAgfVxuICBpZiAoIXN0cikge1xuICAgIGlmIChjdHguc2Vlbi5pbmRleE9mKGRlc2MudmFsdWUpIDwgMCkge1xuICAgICAgaWYgKGlzTnVsbChyZWN1cnNlVGltZXMpKSB7XG4gICAgICAgIHN0ciA9IGZvcm1hdFZhbHVlKGN0eCwgZGVzYy52YWx1ZSwgbnVsbCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdHIgPSBmb3JtYXRWYWx1ZShjdHgsIGRlc2MudmFsdWUsIHJlY3Vyc2VUaW1lcyAtIDEpO1xuICAgICAgfVxuICAgICAgaWYgKHN0ci5pbmRleE9mKCdcXG4nKSA+IC0xKSB7XG4gICAgICAgIGlmIChhcnJheSkge1xuICAgICAgICAgIHN0ciA9IHN0ci5zcGxpdCgnXFxuJykubWFwKGZ1bmN0aW9uKGxpbmUpIHtcbiAgICAgICAgICAgIHJldHVybiAnICAnICsgbGluZTtcbiAgICAgICAgICB9KS5qb2luKCdcXG4nKS5zdWJzdHIoMik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc3RyID0gJ1xcbicgKyBzdHIuc3BsaXQoJ1xcbicpLm1hcChmdW5jdGlvbihsaW5lKSB7XG4gICAgICAgICAgICByZXR1cm4gJyAgICcgKyBsaW5lO1xuICAgICAgICAgIH0pLmpvaW4oJ1xcbicpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0ciA9IGN0eC5zdHlsaXplKCdbQ2lyY3VsYXJdJywgJ3NwZWNpYWwnKTtcbiAgICB9XG4gIH1cbiAgaWYgKGlzVW5kZWZpbmVkKG5hbWUpKSB7XG4gICAgaWYgKGFycmF5ICYmIGtleS5tYXRjaCgvXlxcZCskLykpIHtcbiAgICAgIHJldHVybiBzdHI7XG4gICAgfVxuICAgIG5hbWUgPSBKU09OLnN0cmluZ2lmeSgnJyArIGtleSk7XG4gICAgaWYgKG5hbWUubWF0Y2goL15cIihbYS16QS1aX11bYS16QS1aXzAtOV0qKVwiJC8pKSB7XG4gICAgICBuYW1lID0gbmFtZS5zdWJzdHIoMSwgbmFtZS5sZW5ndGggLSAyKTtcbiAgICAgIG5hbWUgPSBjdHguc3R5bGl6ZShuYW1lLCAnbmFtZScpO1xuICAgIH0gZWxzZSB7XG4gICAgICBuYW1lID0gbmFtZS5yZXBsYWNlKC8nL2csIFwiXFxcXCdcIilcbiAgICAgICAgICAgICAgICAgLnJlcGxhY2UoL1xcXFxcIi9nLCAnXCInKVxuICAgICAgICAgICAgICAgICAucmVwbGFjZSgvKF5cInxcIiQpL2csIFwiJ1wiKTtcbiAgICAgIG5hbWUgPSBjdHguc3R5bGl6ZShuYW1lLCAnc3RyaW5nJyk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG5hbWUgKyAnOiAnICsgc3RyO1xufVxuXG5cbmZ1bmN0aW9uIHJlZHVjZVRvU2luZ2xlU3RyaW5nKG91dHB1dCwgYmFzZSwgYnJhY2VzKSB7XG4gIHZhciBudW1MaW5lc0VzdCA9IDA7XG4gIHZhciBsZW5ndGggPSBvdXRwdXQucmVkdWNlKGZ1bmN0aW9uKHByZXYsIGN1cikge1xuICAgIG51bUxpbmVzRXN0Kys7XG4gICAgaWYgKGN1ci5pbmRleE9mKCdcXG4nKSA+PSAwKSBudW1MaW5lc0VzdCsrO1xuICAgIHJldHVybiBwcmV2ICsgY3VyLnJlcGxhY2UoL1xcdTAwMWJcXFtcXGRcXGQ/bS9nLCAnJykubGVuZ3RoICsgMTtcbiAgfSwgMCk7XG5cbiAgaWYgKGxlbmd0aCA+IDYwKSB7XG4gICAgcmV0dXJuIGJyYWNlc1swXSArXG4gICAgICAgICAgIChiYXNlID09PSAnJyA/ICcnIDogYmFzZSArICdcXG4gJykgK1xuICAgICAgICAgICAnICcgK1xuICAgICAgICAgICBvdXRwdXQuam9pbignLFxcbiAgJykgK1xuICAgICAgICAgICAnICcgK1xuICAgICAgICAgICBicmFjZXNbMV07XG4gIH1cblxuICByZXR1cm4gYnJhY2VzWzBdICsgYmFzZSArICcgJyArIG91dHB1dC5qb2luKCcsICcpICsgJyAnICsgYnJhY2VzWzFdO1xufVxuXG5cbi8vIE5PVEU6IFRoZXNlIHR5cGUgY2hlY2tpbmcgZnVuY3Rpb25zIGludGVudGlvbmFsbHkgZG9uJ3QgdXNlIGBpbnN0YW5jZW9mYFxuLy8gYmVjYXVzZSBpdCBpcyBmcmFnaWxlIGFuZCBjYW4gYmUgZWFzaWx5IGZha2VkIHdpdGggYE9iamVjdC5jcmVhdGUoKWAuXG5mdW5jdGlvbiBpc0FycmF5KGFyKSB7XG4gIHJldHVybiBBcnJheS5pc0FycmF5KGFyKTtcbn1cbmV4cG9ydHMuaXNBcnJheSA9IGlzQXJyYXk7XG5cbmZ1bmN0aW9uIGlzQm9vbGVhbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdib29sZWFuJztcbn1cbmV4cG9ydHMuaXNCb29sZWFuID0gaXNCb29sZWFuO1xuXG5mdW5jdGlvbiBpc051bGwoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IG51bGw7XG59XG5leHBvcnRzLmlzTnVsbCA9IGlzTnVsbDtcblxuZnVuY3Rpb24gaXNOdWxsT3JVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT0gbnVsbDtcbn1cbmV4cG9ydHMuaXNOdWxsT3JVbmRlZmluZWQgPSBpc051bGxPclVuZGVmaW5lZDtcblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cbmV4cG9ydHMuaXNOdW1iZXIgPSBpc051bWJlcjtcblxuZnVuY3Rpb24gaXNTdHJpbmcoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnc3RyaW5nJztcbn1cbmV4cG9ydHMuaXNTdHJpbmcgPSBpc1N0cmluZztcblxuZnVuY3Rpb24gaXNTeW1ib2woYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnc3ltYm9sJztcbn1cbmV4cG9ydHMuaXNTeW1ib2wgPSBpc1N5bWJvbDtcblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbmV4cG9ydHMuaXNVbmRlZmluZWQgPSBpc1VuZGVmaW5lZDtcblxuZnVuY3Rpb24gaXNSZWdFeHAocmUpIHtcbiAgcmV0dXJuIGlzT2JqZWN0KHJlKSAmJiBvYmplY3RUb1N0cmluZyhyZSkgPT09ICdbb2JqZWN0IFJlZ0V4cF0nO1xufVxuZXhwb3J0cy5pc1JlZ0V4cCA9IGlzUmVnRXhwO1xuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cbmV4cG9ydHMuaXNPYmplY3QgPSBpc09iamVjdDtcblxuZnVuY3Rpb24gaXNEYXRlKGQpIHtcbiAgcmV0dXJuIGlzT2JqZWN0KGQpICYmIG9iamVjdFRvU3RyaW5nKGQpID09PSAnW29iamVjdCBEYXRlXSc7XG59XG5leHBvcnRzLmlzRGF0ZSA9IGlzRGF0ZTtcblxuZnVuY3Rpb24gaXNFcnJvcihlKSB7XG4gIHJldHVybiBpc09iamVjdChlKSAmJlxuICAgICAgKG9iamVjdFRvU3RyaW5nKGUpID09PSAnW29iamVjdCBFcnJvcl0nIHx8IGUgaW5zdGFuY2VvZiBFcnJvcik7XG59XG5leHBvcnRzLmlzRXJyb3IgPSBpc0Vycm9yO1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cbmV4cG9ydHMuaXNGdW5jdGlvbiA9IGlzRnVuY3Rpb247XG5cbmZ1bmN0aW9uIGlzUHJpbWl0aXZlKGFyZykge1xuICByZXR1cm4gYXJnID09PSBudWxsIHx8XG4gICAgICAgICB0eXBlb2YgYXJnID09PSAnYm9vbGVhbicgfHxcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICdudW1iZXInIHx8XG4gICAgICAgICB0eXBlb2YgYXJnID09PSAnc3RyaW5nJyB8fFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ3N5bWJvbCcgfHwgIC8vIEVTNiBzeW1ib2xcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICd1bmRlZmluZWQnO1xufVxuZXhwb3J0cy5pc1ByaW1pdGl2ZSA9IGlzUHJpbWl0aXZlO1xuXG5leHBvcnRzLmlzQnVmZmVyID0gcmVxdWlyZSgnLi9zdXBwb3J0L2lzQnVmZmVyJyk7XG5cbmZ1bmN0aW9uIG9iamVjdFRvU3RyaW5nKG8pIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvKTtcbn1cblxuXG5mdW5jdGlvbiBwYWQobikge1xuICByZXR1cm4gbiA8IDEwID8gJzAnICsgbi50b1N0cmluZygxMCkgOiBuLnRvU3RyaW5nKDEwKTtcbn1cblxuXG52YXIgbW9udGhzID0gWydKYW4nLCAnRmViJywgJ01hcicsICdBcHInLCAnTWF5JywgJ0p1bicsICdKdWwnLCAnQXVnJywgJ1NlcCcsXG4gICAgICAgICAgICAgICdPY3QnLCAnTm92JywgJ0RlYyddO1xuXG4vLyAyNiBGZWIgMTY6MTk6MzRcbmZ1bmN0aW9uIHRpbWVzdGFtcCgpIHtcbiAgdmFyIGQgPSBuZXcgRGF0ZSgpO1xuICB2YXIgdGltZSA9IFtwYWQoZC5nZXRIb3VycygpKSxcbiAgICAgICAgICAgICAgcGFkKGQuZ2V0TWludXRlcygpKSxcbiAgICAgICAgICAgICAgcGFkKGQuZ2V0U2Vjb25kcygpKV0uam9pbignOicpO1xuICByZXR1cm4gW2QuZ2V0RGF0ZSgpLCBtb250aHNbZC5nZXRNb250aCgpXSwgdGltZV0uam9pbignICcpO1xufVxuXG5cbi8vIGxvZyBpcyBqdXN0IGEgdGhpbiB3cmFwcGVyIHRvIGNvbnNvbGUubG9nIHRoYXQgcHJlcGVuZHMgYSB0aW1lc3RhbXBcbmV4cG9ydHMubG9nID0gZnVuY3Rpb24oKSB7XG4gIGNvbnNvbGUubG9nKCclcyAtICVzJywgdGltZXN0YW1wKCksIGV4cG9ydHMuZm9ybWF0LmFwcGx5KGV4cG9ydHMsIGFyZ3VtZW50cykpO1xufTtcblxuXG4vKipcbiAqIEluaGVyaXQgdGhlIHByb3RvdHlwZSBtZXRob2RzIGZyb20gb25lIGNvbnN0cnVjdG9yIGludG8gYW5vdGhlci5cbiAqXG4gKiBUaGUgRnVuY3Rpb24ucHJvdG90eXBlLmluaGVyaXRzIGZyb20gbGFuZy5qcyByZXdyaXR0ZW4gYXMgYSBzdGFuZGFsb25lXG4gKiBmdW5jdGlvbiAobm90IG9uIEZ1bmN0aW9uLnByb3RvdHlwZSkuIE5PVEU6IElmIHRoaXMgZmlsZSBpcyB0byBiZSBsb2FkZWRcbiAqIGR1cmluZyBib290c3RyYXBwaW5nIHRoaXMgZnVuY3Rpb24gbmVlZHMgdG8gYmUgcmV3cml0dGVuIHVzaW5nIHNvbWUgbmF0aXZlXG4gKiBmdW5jdGlvbnMgYXMgcHJvdG90eXBlIHNldHVwIHVzaW5nIG5vcm1hbCBKYXZhU2NyaXB0IGRvZXMgbm90IHdvcmsgYXNcbiAqIGV4cGVjdGVkIGR1cmluZyBib290c3RyYXBwaW5nIChzZWUgbWlycm9yLmpzIGluIHIxMTQ5MDMpLlxuICpcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGN0b3IgQ29uc3RydWN0b3IgZnVuY3Rpb24gd2hpY2ggbmVlZHMgdG8gaW5oZXJpdCB0aGVcbiAqICAgICBwcm90b3R5cGUuXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBzdXBlckN0b3IgQ29uc3RydWN0b3IgZnVuY3Rpb24gdG8gaW5oZXJpdCBwcm90b3R5cGUgZnJvbS5cbiAqL1xuZXhwb3J0cy5pbmhlcml0cyA9IHJlcXVpcmUoJ2luaGVyaXRzJyk7XG5cbmV4cG9ydHMuX2V4dGVuZCA9IGZ1bmN0aW9uKG9yaWdpbiwgYWRkKSB7XG4gIC8vIERvbid0IGRvIGFueXRoaW5nIGlmIGFkZCBpc24ndCBhbiBvYmplY3RcbiAgaWYgKCFhZGQgfHwgIWlzT2JqZWN0KGFkZCkpIHJldHVybiBvcmlnaW47XG5cbiAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhhZGQpO1xuICB2YXIgaSA9IGtleXMubGVuZ3RoO1xuICB3aGlsZSAoaS0tKSB7XG4gICAgb3JpZ2luW2tleXNbaV1dID0gYWRkW2tleXNbaV1dO1xuICB9XG4gIHJldHVybiBvcmlnaW47XG59O1xuXG5mdW5jdGlvbiBoYXNPd25Qcm9wZXJ0eShvYmosIHByb3ApIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIHByb3ApO1xufVxuIiwiXG4vKipcbiAqIFRoaXMgaXMgdGhlIHdlYiBicm93c2VyIGltcGxlbWVudGF0aW9uIG9mIGBkZWJ1ZygpYC5cbiAqXG4gKiBFeHBvc2UgYGRlYnVnKClgIGFzIHRoZSBtb2R1bGUuXG4gKi9cblxuZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9kZWJ1ZycpO1xuZXhwb3J0cy5sb2cgPSBsb2c7XG5leHBvcnRzLmZvcm1hdEFyZ3MgPSBmb3JtYXRBcmdzO1xuZXhwb3J0cy5zYXZlID0gc2F2ZTtcbmV4cG9ydHMubG9hZCA9IGxvYWQ7XG5leHBvcnRzLnVzZUNvbG9ycyA9IHVzZUNvbG9ycztcbmV4cG9ydHMuc3RvcmFnZSA9ICd1bmRlZmluZWQnICE9IHR5cGVvZiBjaHJvbWVcbiAgICAgICAgICAgICAgICYmICd1bmRlZmluZWQnICE9IHR5cGVvZiBjaHJvbWUuc3RvcmFnZVxuICAgICAgICAgICAgICAgICAgPyBjaHJvbWUuc3RvcmFnZS5sb2NhbFxuICAgICAgICAgICAgICAgICAgOiBsb2NhbHN0b3JhZ2UoKTtcblxuLyoqXG4gKiBDb2xvcnMuXG4gKi9cblxuZXhwb3J0cy5jb2xvcnMgPSBbXG4gICdsaWdodHNlYWdyZWVuJyxcbiAgJ2ZvcmVzdGdyZWVuJyxcbiAgJ2dvbGRlbnJvZCcsXG4gICdkb2RnZXJibHVlJyxcbiAgJ2RhcmtvcmNoaWQnLFxuICAnY3JpbXNvbidcbl07XG5cbi8qKlxuICogQ3VycmVudGx5IG9ubHkgV2ViS2l0LWJhc2VkIFdlYiBJbnNwZWN0b3JzLCBGaXJlZm94ID49IHYzMSxcbiAqIGFuZCB0aGUgRmlyZWJ1ZyBleHRlbnNpb24gKGFueSBGaXJlZm94IHZlcnNpb24pIGFyZSBrbm93blxuICogdG8gc3VwcG9ydCBcIiVjXCIgQ1NTIGN1c3RvbWl6YXRpb25zLlxuICpcbiAqIFRPRE86IGFkZCBhIGBsb2NhbFN0b3JhZ2VgIHZhcmlhYmxlIHRvIGV4cGxpY2l0bHkgZW5hYmxlL2Rpc2FibGUgY29sb3JzXG4gKi9cblxuZnVuY3Rpb24gdXNlQ29sb3JzKCkge1xuICAvLyBpcyB3ZWJraXQ/IGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzE2NDU5NjA2LzM3Njc3M1xuICByZXR1cm4gKCdXZWJraXRBcHBlYXJhbmNlJyBpbiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc3R5bGUpIHx8XG4gICAgLy8gaXMgZmlyZWJ1Zz8gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMzk4MTIwLzM3Njc3M1xuICAgICh3aW5kb3cuY29uc29sZSAmJiAoY29uc29sZS5maXJlYnVnIHx8IChjb25zb2xlLmV4Y2VwdGlvbiAmJiBjb25zb2xlLnRhYmxlKSkpIHx8XG4gICAgLy8gaXMgZmlyZWZveCA+PSB2MzE/XG4gICAgLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9Ub29scy9XZWJfQ29uc29sZSNTdHlsaW5nX21lc3NhZ2VzXG4gICAgKG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5tYXRjaCgvZmlyZWZveFxcLyhcXGQrKS8pICYmIHBhcnNlSW50KFJlZ0V4cC4kMSwgMTApID49IDMxKTtcbn1cblxuLyoqXG4gKiBNYXAgJWogdG8gYEpTT04uc3RyaW5naWZ5KClgLCBzaW5jZSBubyBXZWIgSW5zcGVjdG9ycyBkbyB0aGF0IGJ5IGRlZmF1bHQuXG4gKi9cblxuZXhwb3J0cy5mb3JtYXR0ZXJzLmogPSBmdW5jdGlvbih2KSB7XG4gIHJldHVybiBKU09OLnN0cmluZ2lmeSh2KTtcbn07XG5cblxuLyoqXG4gKiBDb2xvcml6ZSBsb2cgYXJndW1lbnRzIGlmIGVuYWJsZWQuXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBmb3JtYXRBcmdzKCkge1xuICB2YXIgYXJncyA9IGFyZ3VtZW50cztcbiAgdmFyIHVzZUNvbG9ycyA9IHRoaXMudXNlQ29sb3JzO1xuXG4gIGFyZ3NbMF0gPSAodXNlQ29sb3JzID8gJyVjJyA6ICcnKVxuICAgICsgdGhpcy5uYW1lc3BhY2VcbiAgICArICh1c2VDb2xvcnMgPyAnICVjJyA6ICcgJylcbiAgICArIGFyZ3NbMF1cbiAgICArICh1c2VDb2xvcnMgPyAnJWMgJyA6ICcgJylcbiAgICArICcrJyArIGV4cG9ydHMuaHVtYW5pemUodGhpcy5kaWZmKTtcblxuICBpZiAoIXVzZUNvbG9ycykgcmV0dXJuIGFyZ3M7XG5cbiAgdmFyIGMgPSAnY29sb3I6ICcgKyB0aGlzLmNvbG9yO1xuICBhcmdzID0gW2FyZ3NbMF0sIGMsICdjb2xvcjogaW5oZXJpdCddLmNvbmNhdChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmdzLCAxKSk7XG5cbiAgLy8gdGhlIGZpbmFsIFwiJWNcIiBpcyBzb21ld2hhdCB0cmlja3ksIGJlY2F1c2UgdGhlcmUgY291bGQgYmUgb3RoZXJcbiAgLy8gYXJndW1lbnRzIHBhc3NlZCBlaXRoZXIgYmVmb3JlIG9yIGFmdGVyIHRoZSAlYywgc28gd2UgbmVlZCB0b1xuICAvLyBmaWd1cmUgb3V0IHRoZSBjb3JyZWN0IGluZGV4IHRvIGluc2VydCB0aGUgQ1NTIGludG9cbiAgdmFyIGluZGV4ID0gMDtcbiAgdmFyIGxhc3RDID0gMDtcbiAgYXJnc1swXS5yZXBsYWNlKC8lW2EteiVdL2csIGZ1bmN0aW9uKG1hdGNoKSB7XG4gICAgaWYgKCclJScgPT09IG1hdGNoKSByZXR1cm47XG4gICAgaW5kZXgrKztcbiAgICBpZiAoJyVjJyA9PT0gbWF0Y2gpIHtcbiAgICAgIC8vIHdlIG9ubHkgYXJlIGludGVyZXN0ZWQgaW4gdGhlICpsYXN0KiAlY1xuICAgICAgLy8gKHRoZSB1c2VyIG1heSBoYXZlIHByb3ZpZGVkIHRoZWlyIG93bilcbiAgICAgIGxhc3RDID0gaW5kZXg7XG4gICAgfVxuICB9KTtcblxuICBhcmdzLnNwbGljZShsYXN0QywgMCwgYyk7XG4gIHJldHVybiBhcmdzO1xufVxuXG4vKipcbiAqIEludm9rZXMgYGNvbnNvbGUubG9nKClgIHdoZW4gYXZhaWxhYmxlLlxuICogTm8tb3Agd2hlbiBgY29uc29sZS5sb2dgIGlzIG5vdCBhIFwiZnVuY3Rpb25cIi5cbiAqXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGxvZygpIHtcbiAgLy8gdGhpcyBoYWNrZXJ5IGlzIHJlcXVpcmVkIGZvciBJRTgvOSwgd2hlcmVcbiAgLy8gdGhlIGBjb25zb2xlLmxvZ2AgZnVuY3Rpb24gZG9lc24ndCBoYXZlICdhcHBseSdcbiAgcmV0dXJuICdvYmplY3QnID09PSB0eXBlb2YgY29uc29sZVxuICAgICYmIGNvbnNvbGUubG9nXG4gICAgJiYgRnVuY3Rpb24ucHJvdG90eXBlLmFwcGx5LmNhbGwoY29uc29sZS5sb2csIGNvbnNvbGUsIGFyZ3VtZW50cyk7XG59XG5cbi8qKlxuICogU2F2ZSBgbmFtZXNwYWNlc2AuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVzcGFjZXNcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHNhdmUobmFtZXNwYWNlcykge1xuICB0cnkge1xuICAgIGlmIChudWxsID09IG5hbWVzcGFjZXMpIHtcbiAgICAgIGV4cG9ydHMuc3RvcmFnZS5yZW1vdmVJdGVtKCdkZWJ1ZycpO1xuICAgIH0gZWxzZSB7XG4gICAgICBleHBvcnRzLnN0b3JhZ2UuZGVidWcgPSBuYW1lc3BhY2VzO1xuICAgIH1cbiAgfSBjYXRjaChlKSB7fVxufVxuXG4vKipcbiAqIExvYWQgYG5hbWVzcGFjZXNgLlxuICpcbiAqIEByZXR1cm4ge1N0cmluZ30gcmV0dXJucyB0aGUgcHJldmlvdXNseSBwZXJzaXN0ZWQgZGVidWcgbW9kZXNcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGxvYWQoKSB7XG4gIHZhciByO1xuICB0cnkge1xuICAgIHIgPSBleHBvcnRzLnN0b3JhZ2UuZGVidWc7XG4gIH0gY2F0Y2goZSkge31cbiAgcmV0dXJuIHI7XG59XG5cbi8qKlxuICogRW5hYmxlIG5hbWVzcGFjZXMgbGlzdGVkIGluIGBsb2NhbFN0b3JhZ2UuZGVidWdgIGluaXRpYWxseS5cbiAqL1xuXG5leHBvcnRzLmVuYWJsZShsb2FkKCkpO1xuXG4vKipcbiAqIExvY2Fsc3RvcmFnZSBhdHRlbXB0cyB0byByZXR1cm4gdGhlIGxvY2Fsc3RvcmFnZS5cbiAqXG4gKiBUaGlzIGlzIG5lY2Vzc2FyeSBiZWNhdXNlIHNhZmFyaSB0aHJvd3NcbiAqIHdoZW4gYSB1c2VyIGRpc2FibGVzIGNvb2tpZXMvbG9jYWxzdG9yYWdlXG4gKiBhbmQgeW91IGF0dGVtcHQgdG8gYWNjZXNzIGl0LlxuICpcbiAqIEByZXR1cm4ge0xvY2FsU3RvcmFnZX1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGxvY2Fsc3RvcmFnZSgpe1xuICB0cnkge1xuICAgIHJldHVybiB3aW5kb3cubG9jYWxTdG9yYWdlO1xuICB9IGNhdGNoIChlKSB7fVxufVxuIiwiXG4vKipcbiAqIFRoaXMgaXMgdGhlIGNvbW1vbiBsb2dpYyBmb3IgYm90aCB0aGUgTm9kZS5qcyBhbmQgd2ViIGJyb3dzZXJcbiAqIGltcGxlbWVudGF0aW9ucyBvZiBgZGVidWcoKWAuXG4gKlxuICogRXhwb3NlIGBkZWJ1ZygpYCBhcyB0aGUgbW9kdWxlLlxuICovXG5cbmV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IGRlYnVnO1xuZXhwb3J0cy5jb2VyY2UgPSBjb2VyY2U7XG5leHBvcnRzLmRpc2FibGUgPSBkaXNhYmxlO1xuZXhwb3J0cy5lbmFibGUgPSBlbmFibGU7XG5leHBvcnRzLmVuYWJsZWQgPSBlbmFibGVkO1xuZXhwb3J0cy5odW1hbml6ZSA9IHJlcXVpcmUoJ21zJyk7XG5cbi8qKlxuICogVGhlIGN1cnJlbnRseSBhY3RpdmUgZGVidWcgbW9kZSBuYW1lcywgYW5kIG5hbWVzIHRvIHNraXAuXG4gKi9cblxuZXhwb3J0cy5uYW1lcyA9IFtdO1xuZXhwb3J0cy5za2lwcyA9IFtdO1xuXG4vKipcbiAqIE1hcCBvZiBzcGVjaWFsIFwiJW5cIiBoYW5kbGluZyBmdW5jdGlvbnMsIGZvciB0aGUgZGVidWcgXCJmb3JtYXRcIiBhcmd1bWVudC5cbiAqXG4gKiBWYWxpZCBrZXkgbmFtZXMgYXJlIGEgc2luZ2xlLCBsb3dlcmNhc2VkIGxldHRlciwgaS5lLiBcIm5cIi5cbiAqL1xuXG5leHBvcnRzLmZvcm1hdHRlcnMgPSB7fTtcblxuLyoqXG4gKiBQcmV2aW91c2x5IGFzc2lnbmVkIGNvbG9yLlxuICovXG5cbnZhciBwcmV2Q29sb3IgPSAwO1xuXG4vKipcbiAqIFByZXZpb3VzIGxvZyB0aW1lc3RhbXAuXG4gKi9cblxudmFyIHByZXZUaW1lO1xuXG4vKipcbiAqIFNlbGVjdCBhIGNvbG9yLlxuICpcbiAqIEByZXR1cm4ge051bWJlcn1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHNlbGVjdENvbG9yKCkge1xuICByZXR1cm4gZXhwb3J0cy5jb2xvcnNbcHJldkNvbG9yKysgJSBleHBvcnRzLmNvbG9ycy5sZW5ndGhdO1xufVxuXG4vKipcbiAqIENyZWF0ZSBhIGRlYnVnZ2VyIHdpdGggdGhlIGdpdmVuIGBuYW1lc3BhY2VgLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lc3BhY2VcbiAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBkZWJ1ZyhuYW1lc3BhY2UpIHtcblxuICAvLyBkZWZpbmUgdGhlIGBkaXNhYmxlZGAgdmVyc2lvblxuICBmdW5jdGlvbiBkaXNhYmxlZCgpIHtcbiAgfVxuICBkaXNhYmxlZC5lbmFibGVkID0gZmFsc2U7XG5cbiAgLy8gZGVmaW5lIHRoZSBgZW5hYmxlZGAgdmVyc2lvblxuICBmdW5jdGlvbiBlbmFibGVkKCkge1xuXG4gICAgdmFyIHNlbGYgPSBlbmFibGVkO1xuXG4gICAgLy8gc2V0IGBkaWZmYCB0aW1lc3RhbXBcbiAgICB2YXIgY3VyciA9ICtuZXcgRGF0ZSgpO1xuICAgIHZhciBtcyA9IGN1cnIgLSAocHJldlRpbWUgfHwgY3Vycik7XG4gICAgc2VsZi5kaWZmID0gbXM7XG4gICAgc2VsZi5wcmV2ID0gcHJldlRpbWU7XG4gICAgc2VsZi5jdXJyID0gY3VycjtcbiAgICBwcmV2VGltZSA9IGN1cnI7XG5cbiAgICAvLyBhZGQgdGhlIGBjb2xvcmAgaWYgbm90IHNldFxuICAgIGlmIChudWxsID09IHNlbGYudXNlQ29sb3JzKSBzZWxmLnVzZUNvbG9ycyA9IGV4cG9ydHMudXNlQ29sb3JzKCk7XG4gICAgaWYgKG51bGwgPT0gc2VsZi5jb2xvciAmJiBzZWxmLnVzZUNvbG9ycykgc2VsZi5jb2xvciA9IHNlbGVjdENvbG9yKCk7XG5cbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG5cbiAgICBhcmdzWzBdID0gZXhwb3J0cy5jb2VyY2UoYXJnc1swXSk7XG5cbiAgICBpZiAoJ3N0cmluZycgIT09IHR5cGVvZiBhcmdzWzBdKSB7XG4gICAgICAvLyBhbnl0aGluZyBlbHNlIGxldCdzIGluc3BlY3Qgd2l0aCAlb1xuICAgICAgYXJncyA9IFsnJW8nXS5jb25jYXQoYXJncyk7XG4gICAgfVxuXG4gICAgLy8gYXBwbHkgYW55IGBmb3JtYXR0ZXJzYCB0cmFuc2Zvcm1hdGlvbnNcbiAgICB2YXIgaW5kZXggPSAwO1xuICAgIGFyZ3NbMF0gPSBhcmdzWzBdLnJlcGxhY2UoLyUoW2EteiVdKS9nLCBmdW5jdGlvbihtYXRjaCwgZm9ybWF0KSB7XG4gICAgICAvLyBpZiB3ZSBlbmNvdW50ZXIgYW4gZXNjYXBlZCAlIHRoZW4gZG9uJ3QgaW5jcmVhc2UgdGhlIGFycmF5IGluZGV4XG4gICAgICBpZiAobWF0Y2ggPT09ICclJScpIHJldHVybiBtYXRjaDtcbiAgICAgIGluZGV4Kys7XG4gICAgICB2YXIgZm9ybWF0dGVyID0gZXhwb3J0cy5mb3JtYXR0ZXJzW2Zvcm1hdF07XG4gICAgICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGZvcm1hdHRlcikge1xuICAgICAgICB2YXIgdmFsID0gYXJnc1tpbmRleF07XG4gICAgICAgIG1hdGNoID0gZm9ybWF0dGVyLmNhbGwoc2VsZiwgdmFsKTtcblxuICAgICAgICAvLyBub3cgd2UgbmVlZCB0byByZW1vdmUgYGFyZ3NbaW5kZXhdYCBzaW5jZSBpdCdzIGlubGluZWQgaW4gdGhlIGBmb3JtYXRgXG4gICAgICAgIGFyZ3Muc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgaW5kZXgtLTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtYXRjaDtcbiAgICB9KTtcblxuICAgIGlmICgnZnVuY3Rpb24nID09PSB0eXBlb2YgZXhwb3J0cy5mb3JtYXRBcmdzKSB7XG4gICAgICBhcmdzID0gZXhwb3J0cy5mb3JtYXRBcmdzLmFwcGx5KHNlbGYsIGFyZ3MpO1xuICAgIH1cbiAgICB2YXIgbG9nRm4gPSBlbmFibGVkLmxvZyB8fCBleHBvcnRzLmxvZyB8fCBjb25zb2xlLmxvZy5iaW5kKGNvbnNvbGUpO1xuICAgIGxvZ0ZuLmFwcGx5KHNlbGYsIGFyZ3MpO1xuICB9XG4gIGVuYWJsZWQuZW5hYmxlZCA9IHRydWU7XG5cbiAgdmFyIGZuID0gZXhwb3J0cy5lbmFibGVkKG5hbWVzcGFjZSkgPyBlbmFibGVkIDogZGlzYWJsZWQ7XG5cbiAgZm4ubmFtZXNwYWNlID0gbmFtZXNwYWNlO1xuXG4gIHJldHVybiBmbjtcbn1cblxuLyoqXG4gKiBFbmFibGVzIGEgZGVidWcgbW9kZSBieSBuYW1lc3BhY2VzLiBUaGlzIGNhbiBpbmNsdWRlIG1vZGVzXG4gKiBzZXBhcmF0ZWQgYnkgYSBjb2xvbiBhbmQgd2lsZGNhcmRzLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lc3BhY2VzXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGVuYWJsZShuYW1lc3BhY2VzKSB7XG4gIGV4cG9ydHMuc2F2ZShuYW1lc3BhY2VzKTtcblxuICB2YXIgc3BsaXQgPSAobmFtZXNwYWNlcyB8fCAnJykuc3BsaXQoL1tcXHMsXSsvKTtcbiAgdmFyIGxlbiA9IHNwbGl0Lmxlbmd0aDtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgaWYgKCFzcGxpdFtpXSkgY29udGludWU7IC8vIGlnbm9yZSBlbXB0eSBzdHJpbmdzXG4gICAgbmFtZXNwYWNlcyA9IHNwbGl0W2ldLnJlcGxhY2UoL1xcKi9nLCAnLio/Jyk7XG4gICAgaWYgKG5hbWVzcGFjZXNbMF0gPT09ICctJykge1xuICAgICAgZXhwb3J0cy5za2lwcy5wdXNoKG5ldyBSZWdFeHAoJ14nICsgbmFtZXNwYWNlcy5zdWJzdHIoMSkgKyAnJCcpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZXhwb3J0cy5uYW1lcy5wdXNoKG5ldyBSZWdFeHAoJ14nICsgbmFtZXNwYWNlcyArICckJykpO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIERpc2FibGUgZGVidWcgb3V0cHV0LlxuICpcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZGlzYWJsZSgpIHtcbiAgZXhwb3J0cy5lbmFibGUoJycpO1xufVxuXG4vKipcbiAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgZ2l2ZW4gbW9kZSBuYW1lIGlzIGVuYWJsZWQsIGZhbHNlIG90aGVyd2lzZS5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZVxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZW5hYmxlZChuYW1lKSB7XG4gIHZhciBpLCBsZW47XG4gIGZvciAoaSA9IDAsIGxlbiA9IGV4cG9ydHMuc2tpcHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBpZiAoZXhwb3J0cy5za2lwc1tpXS50ZXN0KG5hbWUpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIGZvciAoaSA9IDAsIGxlbiA9IGV4cG9ydHMubmFtZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBpZiAoZXhwb3J0cy5uYW1lc1tpXS50ZXN0KG5hbWUpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG4vKipcbiAqIENvZXJjZSBgdmFsYC5cbiAqXG4gKiBAcGFyYW0ge01peGVkfSB2YWxcbiAqIEByZXR1cm4ge01peGVkfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gY29lcmNlKHZhbCkge1xuICBpZiAodmFsIGluc3RhbmNlb2YgRXJyb3IpIHJldHVybiB2YWwuc3RhY2sgfHwgdmFsLm1lc3NhZ2U7XG4gIHJldHVybiB2YWw7XG59XG4iLCIvKipcbiAqIEhlbHBlcnMuXG4gKi9cblxudmFyIHMgPSAxMDAwO1xudmFyIG0gPSBzICogNjA7XG52YXIgaCA9IG0gKiA2MDtcbnZhciBkID0gaCAqIDI0O1xudmFyIHkgPSBkICogMzY1LjI1O1xuXG4vKipcbiAqIFBhcnNlIG9yIGZvcm1hdCB0aGUgZ2l2ZW4gYHZhbGAuXG4gKlxuICogT3B0aW9uczpcbiAqXG4gKiAgLSBgbG9uZ2AgdmVyYm9zZSBmb3JtYXR0aW5nIFtmYWxzZV1cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ3xOdW1iZXJ9IHZhbFxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqIEByZXR1cm4ge1N0cmluZ3xOdW1iZXJ9XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odmFsLCBvcHRpb25zKXtcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gIGlmICgnc3RyaW5nJyA9PSB0eXBlb2YgdmFsKSByZXR1cm4gcGFyc2UodmFsKTtcbiAgcmV0dXJuIG9wdGlvbnMubG9uZ1xuICAgID8gbG9uZyh2YWwpXG4gICAgOiBzaG9ydCh2YWwpO1xufTtcblxuLyoqXG4gKiBQYXJzZSB0aGUgZ2l2ZW4gYHN0cmAgYW5kIHJldHVybiBtaWxsaXNlY29uZHMuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxuICogQHJldHVybiB7TnVtYmVyfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gcGFyc2Uoc3RyKSB7XG4gIHN0ciA9ICcnICsgc3RyO1xuICBpZiAoc3RyLmxlbmd0aCA+IDEwMDAwKSByZXR1cm47XG4gIHZhciBtYXRjaCA9IC9eKCg/OlxcZCspP1xcLj9cXGQrKSAqKG1pbGxpc2Vjb25kcz98bXNlY3M/fG1zfHNlY29uZHM/fHNlY3M/fHN8bWludXRlcz98bWlucz98bXxob3Vycz98aHJzP3xofGRheXM/fGR8eWVhcnM/fHlycz98eSk/JC9pLmV4ZWMoc3RyKTtcbiAgaWYgKCFtYXRjaCkgcmV0dXJuO1xuICB2YXIgbiA9IHBhcnNlRmxvYXQobWF0Y2hbMV0pO1xuICB2YXIgdHlwZSA9IChtYXRjaFsyXSB8fCAnbXMnKS50b0xvd2VyQ2FzZSgpO1xuICBzd2l0Y2ggKHR5cGUpIHtcbiAgICBjYXNlICd5ZWFycyc6XG4gICAgY2FzZSAneWVhcic6XG4gICAgY2FzZSAneXJzJzpcbiAgICBjYXNlICd5cic6XG4gICAgY2FzZSAneSc6XG4gICAgICByZXR1cm4gbiAqIHk7XG4gICAgY2FzZSAnZGF5cyc6XG4gICAgY2FzZSAnZGF5JzpcbiAgICBjYXNlICdkJzpcbiAgICAgIHJldHVybiBuICogZDtcbiAgICBjYXNlICdob3Vycyc6XG4gICAgY2FzZSAnaG91cic6XG4gICAgY2FzZSAnaHJzJzpcbiAgICBjYXNlICdocic6XG4gICAgY2FzZSAnaCc6XG4gICAgICByZXR1cm4gbiAqIGg7XG4gICAgY2FzZSAnbWludXRlcyc6XG4gICAgY2FzZSAnbWludXRlJzpcbiAgICBjYXNlICdtaW5zJzpcbiAgICBjYXNlICdtaW4nOlxuICAgIGNhc2UgJ20nOlxuICAgICAgcmV0dXJuIG4gKiBtO1xuICAgIGNhc2UgJ3NlY29uZHMnOlxuICAgIGNhc2UgJ3NlY29uZCc6XG4gICAgY2FzZSAnc2Vjcyc6XG4gICAgY2FzZSAnc2VjJzpcbiAgICBjYXNlICdzJzpcbiAgICAgIHJldHVybiBuICogcztcbiAgICBjYXNlICdtaWxsaXNlY29uZHMnOlxuICAgIGNhc2UgJ21pbGxpc2Vjb25kJzpcbiAgICBjYXNlICdtc2Vjcyc6XG4gICAgY2FzZSAnbXNlYyc6XG4gICAgY2FzZSAnbXMnOlxuICAgICAgcmV0dXJuIG47XG4gIH1cbn1cblxuLyoqXG4gKiBTaG9ydCBmb3JtYXQgZm9yIGBtc2AuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IG1zXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBzaG9ydChtcykge1xuICBpZiAobXMgPj0gZCkgcmV0dXJuIE1hdGgucm91bmQobXMgLyBkKSArICdkJztcbiAgaWYgKG1zID49IGgpIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gaCkgKyAnaCc7XG4gIGlmIChtcyA+PSBtKSByZXR1cm4gTWF0aC5yb3VuZChtcyAvIG0pICsgJ20nO1xuICBpZiAobXMgPj0gcykgcmV0dXJuIE1hdGgucm91bmQobXMgLyBzKSArICdzJztcbiAgcmV0dXJuIG1zICsgJ21zJztcbn1cblxuLyoqXG4gKiBMb25nIGZvcm1hdCBmb3IgYG1zYC5cbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gbXNcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGxvbmcobXMpIHtcbiAgcmV0dXJuIHBsdXJhbChtcywgZCwgJ2RheScpXG4gICAgfHwgcGx1cmFsKG1zLCBoLCAnaG91cicpXG4gICAgfHwgcGx1cmFsKG1zLCBtLCAnbWludXRlJylcbiAgICB8fCBwbHVyYWwobXMsIHMsICdzZWNvbmQnKVxuICAgIHx8IG1zICsgJyBtcyc7XG59XG5cbi8qKlxuICogUGx1cmFsaXphdGlvbiBoZWxwZXIuXG4gKi9cblxuZnVuY3Rpb24gcGx1cmFsKG1zLCBuLCBuYW1lKSB7XG4gIGlmIChtcyA8IG4pIHJldHVybjtcbiAgaWYgKG1zIDwgbiAqIDEuNSkgcmV0dXJuIE1hdGguZmxvb3IobXMgLyBuKSArICcgJyArIG5hbWU7XG4gIHJldHVybiBNYXRoLmNlaWwobXMgLyBuKSArICcgJyArIG5hbWUgKyAncyc7XG59XG4iLCIvKipcbiAqIGxvZGFzaCAzLjIuMCAoQ3VzdG9tIEJ1aWxkKSA8aHR0cHM6Ly9sb2Rhc2guY29tLz5cbiAqIEJ1aWxkOiBgbG9kYXNoIG1vZGVybiBtb2R1bGFyaXplIGV4cG9ydHM9XCJucG1cIiAtbyAuL2BcbiAqIENvcHlyaWdodCAyMDEyLTIwMTUgVGhlIERvam8gRm91bmRhdGlvbiA8aHR0cDovL2Rvam9mb3VuZGF0aW9uLm9yZy8+XG4gKiBCYXNlZCBvbiBVbmRlcnNjb3JlLmpzIDEuOC4zIDxodHRwOi8vdW5kZXJzY29yZWpzLm9yZy9MSUNFTlNFPlxuICogQ29weXJpZ2h0IDIwMDktMjAxNSBKZXJlbXkgQXNoa2VuYXMsIERvY3VtZW50Q2xvdWQgYW5kIEludmVzdGlnYXRpdmUgUmVwb3J0ZXJzICYgRWRpdG9yc1xuICogQXZhaWxhYmxlIHVuZGVyIE1JVCBsaWNlbnNlIDxodHRwczovL2xvZGFzaC5jb20vbGljZW5zZT5cbiAqL1xudmFyIGJhc2VBc3NpZ24gPSByZXF1aXJlKCdsb2Rhc2guX2Jhc2Vhc3NpZ24nKSxcbiAgICBjcmVhdGVBc3NpZ25lciA9IHJlcXVpcmUoJ2xvZGFzaC5fY3JlYXRlYXNzaWduZXInKSxcbiAgICBrZXlzID0gcmVxdWlyZSgnbG9kYXNoLmtleXMnKTtcblxuLyoqXG4gKiBBIHNwZWNpYWxpemVkIHZlcnNpb24gb2YgYF8uYXNzaWduYCBmb3IgY3VzdG9taXppbmcgYXNzaWduZWQgdmFsdWVzIHdpdGhvdXRcbiAqIHN1cHBvcnQgZm9yIGFyZ3VtZW50IGp1Z2dsaW5nLCBtdWx0aXBsZSBzb3VyY2VzLCBhbmQgYHRoaXNgIGJpbmRpbmcgYGN1c3RvbWl6ZXJgXG4gKiBmdW5jdGlvbnMuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIGRlc3RpbmF0aW9uIG9iamVjdC5cbiAqIEBwYXJhbSB7T2JqZWN0fSBzb3VyY2UgVGhlIHNvdXJjZSBvYmplY3QuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjdXN0b21pemVyIFRoZSBmdW5jdGlvbiB0byBjdXN0b21pemUgYXNzaWduZWQgdmFsdWVzLlxuICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyBgb2JqZWN0YC5cbiAqL1xuZnVuY3Rpb24gYXNzaWduV2l0aChvYmplY3QsIHNvdXJjZSwgY3VzdG9taXplcikge1xuICB2YXIgaW5kZXggPSAtMSxcbiAgICAgIHByb3BzID0ga2V5cyhzb3VyY2UpLFxuICAgICAgbGVuZ3RoID0gcHJvcHMubGVuZ3RoO1xuXG4gIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgdmFyIGtleSA9IHByb3BzW2luZGV4XSxcbiAgICAgICAgdmFsdWUgPSBvYmplY3Rba2V5XSxcbiAgICAgICAgcmVzdWx0ID0gY3VzdG9taXplcih2YWx1ZSwgc291cmNlW2tleV0sIGtleSwgb2JqZWN0LCBzb3VyY2UpO1xuXG4gICAgaWYgKChyZXN1bHQgPT09IHJlc3VsdCA/IChyZXN1bHQgIT09IHZhbHVlKSA6ICh2YWx1ZSA9PT0gdmFsdWUpKSB8fFxuICAgICAgICAodmFsdWUgPT09IHVuZGVmaW5lZCAmJiAhKGtleSBpbiBvYmplY3QpKSkge1xuICAgICAgb2JqZWN0W2tleV0gPSByZXN1bHQ7XG4gICAgfVxuICB9XG4gIHJldHVybiBvYmplY3Q7XG59XG5cbi8qKlxuICogQXNzaWducyBvd24gZW51bWVyYWJsZSBwcm9wZXJ0aWVzIG9mIHNvdXJjZSBvYmplY3QocykgdG8gdGhlIGRlc3RpbmF0aW9uXG4gKiBvYmplY3QuIFN1YnNlcXVlbnQgc291cmNlcyBvdmVyd3JpdGUgcHJvcGVydHkgYXNzaWdubWVudHMgb2YgcHJldmlvdXMgc291cmNlcy5cbiAqIElmIGBjdXN0b21pemVyYCBpcyBwcm92aWRlZCBpdCBpcyBpbnZva2VkIHRvIHByb2R1Y2UgdGhlIGFzc2lnbmVkIHZhbHVlcy5cbiAqIFRoZSBgY3VzdG9taXplcmAgaXMgYm91bmQgdG8gYHRoaXNBcmdgIGFuZCBpbnZva2VkIHdpdGggZml2ZSBhcmd1bWVudHM6XG4gKiAob2JqZWN0VmFsdWUsIHNvdXJjZVZhbHVlLCBrZXksIG9iamVjdCwgc291cmNlKS5cbiAqXG4gKiAqKk5vdGU6KiogVGhpcyBtZXRob2QgbXV0YXRlcyBgb2JqZWN0YCBhbmQgaXMgYmFzZWQgb25cbiAqIFtgT2JqZWN0LmFzc2lnbmBdKGh0dHBzOi8vcGVvcGxlLm1vemlsbGEub3JnL35qb3JlbmRvcmZmL2VzNi1kcmFmdC5odG1sI3NlYy1vYmplY3QuYXNzaWduKS5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGFsaWFzIGV4dGVuZFxuICogQGNhdGVnb3J5IE9iamVjdFxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgZGVzdGluYXRpb24gb2JqZWN0LlxuICogQHBhcmFtIHsuLi5PYmplY3R9IFtzb3VyY2VzXSBUaGUgc291cmNlIG9iamVjdHMuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY3VzdG9taXplcl0gVGhlIGZ1bmN0aW9uIHRvIGN1c3RvbWl6ZSBhc3NpZ25lZCB2YWx1ZXMuXG4gKiBAcGFyYW0geyp9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGN1c3RvbWl6ZXJgLlxuICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyBgb2JqZWN0YC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5hc3NpZ24oeyAndXNlcic6ICdiYXJuZXknIH0sIHsgJ2FnZSc6IDQwIH0sIHsgJ3VzZXInOiAnZnJlZCcgfSk7XG4gKiAvLyA9PiB7ICd1c2VyJzogJ2ZyZWQnLCAnYWdlJzogNDAgfVxuICpcbiAqIC8vIHVzaW5nIGEgY3VzdG9taXplciBjYWxsYmFja1xuICogdmFyIGRlZmF1bHRzID0gXy5wYXJ0aWFsUmlnaHQoXy5hc3NpZ24sIGZ1bmN0aW9uKHZhbHVlLCBvdGhlcikge1xuICogICByZXR1cm4gXy5pc1VuZGVmaW5lZCh2YWx1ZSkgPyBvdGhlciA6IHZhbHVlO1xuICogfSk7XG4gKlxuICogZGVmYXVsdHMoeyAndXNlcic6ICdiYXJuZXknIH0sIHsgJ2FnZSc6IDM2IH0sIHsgJ3VzZXInOiAnZnJlZCcgfSk7XG4gKiAvLyA9PiB7ICd1c2VyJzogJ2Jhcm5leScsICdhZ2UnOiAzNiB9XG4gKi9cbnZhciBhc3NpZ24gPSBjcmVhdGVBc3NpZ25lcihmdW5jdGlvbihvYmplY3QsIHNvdXJjZSwgY3VzdG9taXplcikge1xuICByZXR1cm4gY3VzdG9taXplclxuICAgID8gYXNzaWduV2l0aChvYmplY3QsIHNvdXJjZSwgY3VzdG9taXplcilcbiAgICA6IGJhc2VBc3NpZ24ob2JqZWN0LCBzb3VyY2UpO1xufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gYXNzaWduO1xuIiwiLyoqXG4gKiBsb2Rhc2ggMy4yLjAgKEN1c3RvbSBCdWlsZCkgPGh0dHBzOi8vbG9kYXNoLmNvbS8+XG4gKiBCdWlsZDogYGxvZGFzaCBtb2Rlcm4gbW9kdWxhcml6ZSBleHBvcnRzPVwibnBtXCIgLW8gLi9gXG4gKiBDb3B5cmlnaHQgMjAxMi0yMDE1IFRoZSBEb2pvIEZvdW5kYXRpb24gPGh0dHA6Ly9kb2pvZm91bmRhdGlvbi5vcmcvPlxuICogQmFzZWQgb24gVW5kZXJzY29yZS5qcyAxLjguMyA8aHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvTElDRU5TRT5cbiAqIENvcHlyaWdodCAyMDA5LTIwMTUgSmVyZW15IEFzaGtlbmFzLCBEb2N1bWVudENsb3VkIGFuZCBJbnZlc3RpZ2F0aXZlIFJlcG9ydGVycyAmIEVkaXRvcnNcbiAqIEF2YWlsYWJsZSB1bmRlciBNSVQgbGljZW5zZSA8aHR0cHM6Ly9sb2Rhc2guY29tL2xpY2Vuc2U+XG4gKi9cbnZhciBiYXNlQ29weSA9IHJlcXVpcmUoJ2xvZGFzaC5fYmFzZWNvcHknKSxcbiAgICBrZXlzID0gcmVxdWlyZSgnbG9kYXNoLmtleXMnKTtcblxuLyoqXG4gKiBUaGUgYmFzZSBpbXBsZW1lbnRhdGlvbiBvZiBgXy5hc3NpZ25gIHdpdGhvdXQgc3VwcG9ydCBmb3IgYXJndW1lbnQganVnZ2xpbmcsXG4gKiBtdWx0aXBsZSBzb3VyY2VzLCBhbmQgYGN1c3RvbWl6ZXJgIGZ1bmN0aW9ucy5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgZGVzdGluYXRpb24gb2JqZWN0LlxuICogQHBhcmFtIHtPYmplY3R9IHNvdXJjZSBUaGUgc291cmNlIG9iamVjdC5cbiAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgYG9iamVjdGAuXG4gKi9cbmZ1bmN0aW9uIGJhc2VBc3NpZ24ob2JqZWN0LCBzb3VyY2UpIHtcbiAgcmV0dXJuIHNvdXJjZSA9PSBudWxsXG4gICAgPyBvYmplY3RcbiAgICA6IGJhc2VDb3B5KHNvdXJjZSwga2V5cyhzb3VyY2UpLCBvYmplY3QpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGJhc2VBc3NpZ247XG4iLCIvKipcbiAqIGxvZGFzaCAzLjAuMSAoQ3VzdG9tIEJ1aWxkKSA8aHR0cHM6Ly9sb2Rhc2guY29tLz5cbiAqIEJ1aWxkOiBgbG9kYXNoIG1vZGVybiBtb2R1bGFyaXplIGV4cG9ydHM9XCJucG1cIiAtbyAuL2BcbiAqIENvcHlyaWdodCAyMDEyLTIwMTUgVGhlIERvam8gRm91bmRhdGlvbiA8aHR0cDovL2Rvam9mb3VuZGF0aW9uLm9yZy8+XG4gKiBCYXNlZCBvbiBVbmRlcnNjb3JlLmpzIDEuOC4zIDxodHRwOi8vdW5kZXJzY29yZWpzLm9yZy9MSUNFTlNFPlxuICogQ29weXJpZ2h0IDIwMDktMjAxNSBKZXJlbXkgQXNoa2VuYXMsIERvY3VtZW50Q2xvdWQgYW5kIEludmVzdGlnYXRpdmUgUmVwb3J0ZXJzICYgRWRpdG9yc1xuICogQXZhaWxhYmxlIHVuZGVyIE1JVCBsaWNlbnNlIDxodHRwczovL2xvZGFzaC5jb20vbGljZW5zZT5cbiAqL1xuXG4vKipcbiAqIENvcGllcyBwcm9wZXJ0aWVzIG9mIGBzb3VyY2VgIHRvIGBvYmplY3RgLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge09iamVjdH0gc291cmNlIFRoZSBvYmplY3QgdG8gY29weSBwcm9wZXJ0aWVzIGZyb20uXG4gKiBAcGFyYW0ge0FycmF5fSBwcm9wcyBUaGUgcHJvcGVydHkgbmFtZXMgdG8gY29weS5cbiAqIEBwYXJhbSB7T2JqZWN0fSBbb2JqZWN0PXt9XSBUaGUgb2JqZWN0IHRvIGNvcHkgcHJvcGVydGllcyB0by5cbiAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgYG9iamVjdGAuXG4gKi9cbmZ1bmN0aW9uIGJhc2VDb3B5KHNvdXJjZSwgcHJvcHMsIG9iamVjdCkge1xuICBvYmplY3QgfHwgKG9iamVjdCA9IHt9KTtcblxuICB2YXIgaW5kZXggPSAtMSxcbiAgICAgIGxlbmd0aCA9IHByb3BzLmxlbmd0aDtcblxuICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgIHZhciBrZXkgPSBwcm9wc1tpbmRleF07XG4gICAgb2JqZWN0W2tleV0gPSBzb3VyY2Vba2V5XTtcbiAgfVxuICByZXR1cm4gb2JqZWN0O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGJhc2VDb3B5O1xuIiwiLyoqXG4gKiBsb2Rhc2ggMy4xLjEgKEN1c3RvbSBCdWlsZCkgPGh0dHBzOi8vbG9kYXNoLmNvbS8+XG4gKiBCdWlsZDogYGxvZGFzaCBtb2Rlcm4gbW9kdWxhcml6ZSBleHBvcnRzPVwibnBtXCIgLW8gLi9gXG4gKiBDb3B5cmlnaHQgMjAxMi0yMDE1IFRoZSBEb2pvIEZvdW5kYXRpb24gPGh0dHA6Ly9kb2pvZm91bmRhdGlvbi5vcmcvPlxuICogQmFzZWQgb24gVW5kZXJzY29yZS5qcyAxLjguMyA8aHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvTElDRU5TRT5cbiAqIENvcHlyaWdodCAyMDA5LTIwMTUgSmVyZW15IEFzaGtlbmFzLCBEb2N1bWVudENsb3VkIGFuZCBJbnZlc3RpZ2F0aXZlIFJlcG9ydGVycyAmIEVkaXRvcnNcbiAqIEF2YWlsYWJsZSB1bmRlciBNSVQgbGljZW5zZSA8aHR0cHM6Ly9sb2Rhc2guY29tL2xpY2Vuc2U+XG4gKi9cbnZhciBiaW5kQ2FsbGJhY2sgPSByZXF1aXJlKCdsb2Rhc2guX2JpbmRjYWxsYmFjaycpLFxuICAgIGlzSXRlcmF0ZWVDYWxsID0gcmVxdWlyZSgnbG9kYXNoLl9pc2l0ZXJhdGVlY2FsbCcpLFxuICAgIHJlc3RQYXJhbSA9IHJlcXVpcmUoJ2xvZGFzaC5yZXN0cGFyYW0nKTtcblxuLyoqXG4gKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCBhc3NpZ25zIHByb3BlcnRpZXMgb2Ygc291cmNlIG9iamVjdChzKSB0byBhIGdpdmVuXG4gKiBkZXN0aW5hdGlvbiBvYmplY3QuXG4gKlxuICogKipOb3RlOioqIFRoaXMgZnVuY3Rpb24gaXMgdXNlZCB0byBjcmVhdGUgYF8uYXNzaWduYCwgYF8uZGVmYXVsdHNgLCBhbmQgYF8ubWVyZ2VgLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBhc3NpZ25lciBUaGUgZnVuY3Rpb24gdG8gYXNzaWduIHZhbHVlcy5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGFzc2lnbmVyIGZ1bmN0aW9uLlxuICovXG5mdW5jdGlvbiBjcmVhdGVBc3NpZ25lcihhc3NpZ25lcikge1xuICByZXR1cm4gcmVzdFBhcmFtKGZ1bmN0aW9uKG9iamVjdCwgc291cmNlcykge1xuICAgIHZhciBpbmRleCA9IC0xLFxuICAgICAgICBsZW5ndGggPSBvYmplY3QgPT0gbnVsbCA/IDAgOiBzb3VyY2VzLmxlbmd0aCxcbiAgICAgICAgY3VzdG9taXplciA9IGxlbmd0aCA+IDIgPyBzb3VyY2VzW2xlbmd0aCAtIDJdIDogdW5kZWZpbmVkLFxuICAgICAgICBndWFyZCA9IGxlbmd0aCA+IDIgPyBzb3VyY2VzWzJdIDogdW5kZWZpbmVkLFxuICAgICAgICB0aGlzQXJnID0gbGVuZ3RoID4gMSA/IHNvdXJjZXNbbGVuZ3RoIC0gMV0gOiB1bmRlZmluZWQ7XG5cbiAgICBpZiAodHlwZW9mIGN1c3RvbWl6ZXIgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY3VzdG9taXplciA9IGJpbmRDYWxsYmFjayhjdXN0b21pemVyLCB0aGlzQXJnLCA1KTtcbiAgICAgIGxlbmd0aCAtPSAyO1xuICAgIH0gZWxzZSB7XG4gICAgICBjdXN0b21pemVyID0gdHlwZW9mIHRoaXNBcmcgPT0gJ2Z1bmN0aW9uJyA/IHRoaXNBcmcgOiB1bmRlZmluZWQ7XG4gICAgICBsZW5ndGggLT0gKGN1c3RvbWl6ZXIgPyAxIDogMCk7XG4gICAgfVxuICAgIGlmIChndWFyZCAmJiBpc0l0ZXJhdGVlQ2FsbChzb3VyY2VzWzBdLCBzb3VyY2VzWzFdLCBndWFyZCkpIHtcbiAgICAgIGN1c3RvbWl6ZXIgPSBsZW5ndGggPCAzID8gdW5kZWZpbmVkIDogY3VzdG9taXplcjtcbiAgICAgIGxlbmd0aCA9IDE7XG4gICAgfVxuICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICB2YXIgc291cmNlID0gc291cmNlc1tpbmRleF07XG4gICAgICBpZiAoc291cmNlKSB7XG4gICAgICAgIGFzc2lnbmVyKG9iamVjdCwgc291cmNlLCBjdXN0b21pemVyKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9iamVjdDtcbiAgfSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gY3JlYXRlQXNzaWduZXI7XG4iLCIvKipcbiAqIGxvZGFzaCAzLjAuMSAoQ3VzdG9tIEJ1aWxkKSA8aHR0cHM6Ly9sb2Rhc2guY29tLz5cbiAqIEJ1aWxkOiBgbG9kYXNoIG1vZGVybiBtb2R1bGFyaXplIGV4cG9ydHM9XCJucG1cIiAtbyAuL2BcbiAqIENvcHlyaWdodCAyMDEyLTIwMTUgVGhlIERvam8gRm91bmRhdGlvbiA8aHR0cDovL2Rvam9mb3VuZGF0aW9uLm9yZy8+XG4gKiBCYXNlZCBvbiBVbmRlcnNjb3JlLmpzIDEuOC4zIDxodHRwOi8vdW5kZXJzY29yZWpzLm9yZy9MSUNFTlNFPlxuICogQ29weXJpZ2h0IDIwMDktMjAxNSBKZXJlbXkgQXNoa2VuYXMsIERvY3VtZW50Q2xvdWQgYW5kIEludmVzdGlnYXRpdmUgUmVwb3J0ZXJzICYgRWRpdG9yc1xuICogQXZhaWxhYmxlIHVuZGVyIE1JVCBsaWNlbnNlIDxodHRwczovL2xvZGFzaC5jb20vbGljZW5zZT5cbiAqL1xuXG4vKipcbiAqIEEgc3BlY2lhbGl6ZWQgdmVyc2lvbiBvZiBgYmFzZUNhbGxiYWNrYCB3aGljaCBvbmx5IHN1cHBvcnRzIGB0aGlzYCBiaW5kaW5nXG4gKiBhbmQgc3BlY2lmeWluZyB0aGUgbnVtYmVyIG9mIGFyZ3VtZW50cyB0byBwcm92aWRlIHRvIGBmdW5jYC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBUaGUgZnVuY3Rpb24gdG8gYmluZC5cbiAqIEBwYXJhbSB7Kn0gdGhpc0FyZyBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGZ1bmNgLlxuICogQHBhcmFtIHtudW1iZXJ9IFthcmdDb3VudF0gVGhlIG51bWJlciBvZiBhcmd1bWVudHMgdG8gcHJvdmlkZSB0byBgZnVuY2AuXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIGNhbGxiYWNrLlxuICovXG5mdW5jdGlvbiBiaW5kQ2FsbGJhY2soZnVuYywgdGhpc0FyZywgYXJnQ291bnQpIHtcbiAgaWYgKHR5cGVvZiBmdW5jICE9ICdmdW5jdGlvbicpIHtcbiAgICByZXR1cm4gaWRlbnRpdHk7XG4gIH1cbiAgaWYgKHRoaXNBcmcgPT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBmdW5jO1xuICB9XG4gIHN3aXRjaCAoYXJnQ291bnQpIHtcbiAgICBjYXNlIDE6IHJldHVybiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgcmV0dXJuIGZ1bmMuY2FsbCh0aGlzQXJnLCB2YWx1ZSk7XG4gICAgfTtcbiAgICBjYXNlIDM6IHJldHVybiBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pIHtcbiAgICAgIHJldHVybiBmdW5jLmNhbGwodGhpc0FyZywgdmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKTtcbiAgICB9O1xuICAgIGNhc2UgNDogcmV0dXJuIGZ1bmN0aW9uKGFjY3VtdWxhdG9yLCB2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pIHtcbiAgICAgIHJldHVybiBmdW5jLmNhbGwodGhpc0FyZywgYWNjdW11bGF0b3IsIHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbik7XG4gICAgfTtcbiAgICBjYXNlIDU6IHJldHVybiBmdW5jdGlvbih2YWx1ZSwgb3RoZXIsIGtleSwgb2JqZWN0LCBzb3VyY2UpIHtcbiAgICAgIHJldHVybiBmdW5jLmNhbGwodGhpc0FyZywgdmFsdWUsIG90aGVyLCBrZXksIG9iamVjdCwgc291cmNlKTtcbiAgICB9O1xuICB9XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gZnVuYy5hcHBseSh0aGlzQXJnLCBhcmd1bWVudHMpO1xuICB9O1xufVxuXG4vKipcbiAqIFRoaXMgbWV0aG9kIHJldHVybnMgdGhlIGZpcnN0IGFyZ3VtZW50IHByb3ZpZGVkIHRvIGl0LlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgVXRpbGl0eVxuICogQHBhcmFtIHsqfSB2YWx1ZSBBbnkgdmFsdWUuXG4gKiBAcmV0dXJucyB7Kn0gUmV0dXJucyBgdmFsdWVgLlxuICogQGV4YW1wbGVcbiAqXG4gKiB2YXIgb2JqZWN0ID0geyAndXNlcic6ICdmcmVkJyB9O1xuICpcbiAqIF8uaWRlbnRpdHkob2JqZWN0KSA9PT0gb2JqZWN0O1xuICogLy8gPT4gdHJ1ZVxuICovXG5mdW5jdGlvbiBpZGVudGl0eSh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWU7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYmluZENhbGxiYWNrO1xuIiwiLyoqXG4gKiBsb2Rhc2ggMy4wLjkgKEN1c3RvbSBCdWlsZCkgPGh0dHBzOi8vbG9kYXNoLmNvbS8+XG4gKiBCdWlsZDogYGxvZGFzaCBtb2Rlcm4gbW9kdWxhcml6ZSBleHBvcnRzPVwibnBtXCIgLW8gLi9gXG4gKiBDb3B5cmlnaHQgMjAxMi0yMDE1IFRoZSBEb2pvIEZvdW5kYXRpb24gPGh0dHA6Ly9kb2pvZm91bmRhdGlvbi5vcmcvPlxuICogQmFzZWQgb24gVW5kZXJzY29yZS5qcyAxLjguMyA8aHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvTElDRU5TRT5cbiAqIENvcHlyaWdodCAyMDA5LTIwMTUgSmVyZW15IEFzaGtlbmFzLCBEb2N1bWVudENsb3VkIGFuZCBJbnZlc3RpZ2F0aXZlIFJlcG9ydGVycyAmIEVkaXRvcnNcbiAqIEF2YWlsYWJsZSB1bmRlciBNSVQgbGljZW5zZSA8aHR0cHM6Ly9sb2Rhc2guY29tL2xpY2Vuc2U+XG4gKi9cblxuLyoqIFVzZWQgdG8gZGV0ZWN0IHVuc2lnbmVkIGludGVnZXIgdmFsdWVzLiAqL1xudmFyIHJlSXNVaW50ID0gL15cXGQrJC87XG5cbi8qKlxuICogVXNlZCBhcyB0aGUgW21heGltdW0gbGVuZ3RoXShodHRwczovL3Blb3BsZS5tb3ppbGxhLm9yZy9+am9yZW5kb3JmZi9lczYtZHJhZnQuaHRtbCNzZWMtbnVtYmVyLm1heF9zYWZlX2ludGVnZXIpXG4gKiBvZiBhbiBhcnJheS1saWtlIHZhbHVlLlxuICovXG52YXIgTUFYX1NBRkVfSU5URUdFUiA9IDkwMDcxOTkyNTQ3NDA5OTE7XG5cbi8qKlxuICogVGhlIGJhc2UgaW1wbGVtZW50YXRpb24gb2YgYF8ucHJvcGVydHlgIHdpdGhvdXQgc3VwcG9ydCBmb3IgZGVlcCBwYXRocy5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtzdHJpbmd9IGtleSBUaGUga2V5IG9mIHRoZSBwcm9wZXJ0eSB0byBnZXQuXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyBmdW5jdGlvbi5cbiAqL1xuZnVuY3Rpb24gYmFzZVByb3BlcnR5KGtleSkge1xuICByZXR1cm4gZnVuY3Rpb24ob2JqZWN0KSB7XG4gICAgcmV0dXJuIG9iamVjdCA9PSBudWxsID8gdW5kZWZpbmVkIDogb2JqZWN0W2tleV07XG4gIH07XG59XG5cbi8qKlxuICogR2V0cyB0aGUgXCJsZW5ndGhcIiBwcm9wZXJ0eSB2YWx1ZSBvZiBgb2JqZWN0YC5cbiAqXG4gKiAqKk5vdGU6KiogVGhpcyBmdW5jdGlvbiBpcyB1c2VkIHRvIGF2b2lkIGEgW0pJVCBidWddKGh0dHBzOi8vYnVncy53ZWJraXQub3JnL3Nob3dfYnVnLmNnaT9pZD0xNDI3OTIpXG4gKiB0aGF0IGFmZmVjdHMgU2FmYXJpIG9uIGF0IGxlYXN0IGlPUyA4LjEtOC4zIEFSTTY0LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gcXVlcnkuXG4gKiBAcmV0dXJucyB7Kn0gUmV0dXJucyB0aGUgXCJsZW5ndGhcIiB2YWx1ZS5cbiAqL1xudmFyIGdldExlbmd0aCA9IGJhc2VQcm9wZXJ0eSgnbGVuZ3RoJyk7XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYXJyYXktbGlrZS5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhcnJheS1saWtlLCBlbHNlIGBmYWxzZWAuXG4gKi9cbmZ1bmN0aW9uIGlzQXJyYXlMaWtlKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSAhPSBudWxsICYmIGlzTGVuZ3RoKGdldExlbmd0aCh2YWx1ZSkpO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGEgdmFsaWQgYXJyYXktbGlrZSBpbmRleC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcGFyYW0ge251bWJlcn0gW2xlbmd0aD1NQVhfU0FGRV9JTlRFR0VSXSBUaGUgdXBwZXIgYm91bmRzIG9mIGEgdmFsaWQgaW5kZXguXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhIHZhbGlkIGluZGV4LCBlbHNlIGBmYWxzZWAuXG4gKi9cbmZ1bmN0aW9uIGlzSW5kZXgodmFsdWUsIGxlbmd0aCkge1xuICB2YWx1ZSA9ICh0eXBlb2YgdmFsdWUgPT0gJ251bWJlcicgfHwgcmVJc1VpbnQudGVzdCh2YWx1ZSkpID8gK3ZhbHVlIDogLTE7XG4gIGxlbmd0aCA9IGxlbmd0aCA9PSBudWxsID8gTUFYX1NBRkVfSU5URUdFUiA6IGxlbmd0aDtcbiAgcmV0dXJuIHZhbHVlID4gLTEgJiYgdmFsdWUgJSAxID09IDAgJiYgdmFsdWUgPCBsZW5ndGg7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIHRoZSBwcm92aWRlZCBhcmd1bWVudHMgYXJlIGZyb20gYW4gaXRlcmF0ZWUgY2FsbC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgcG90ZW50aWFsIGl0ZXJhdGVlIHZhbHVlIGFyZ3VtZW50LlxuICogQHBhcmFtIHsqfSBpbmRleCBUaGUgcG90ZW50aWFsIGl0ZXJhdGVlIGluZGV4IG9yIGtleSBhcmd1bWVudC5cbiAqIEBwYXJhbSB7Kn0gb2JqZWN0IFRoZSBwb3RlbnRpYWwgaXRlcmF0ZWUgb2JqZWN0IGFyZ3VtZW50LlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSBhcmd1bWVudHMgYXJlIGZyb20gYW4gaXRlcmF0ZWUgY2FsbCwgZWxzZSBgZmFsc2VgLlxuICovXG5mdW5jdGlvbiBpc0l0ZXJhdGVlQ2FsbCh2YWx1ZSwgaW5kZXgsIG9iamVjdCkge1xuICBpZiAoIWlzT2JqZWN0KG9iamVjdCkpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgdmFyIHR5cGUgPSB0eXBlb2YgaW5kZXg7XG4gIGlmICh0eXBlID09ICdudW1iZXInXG4gICAgICA/IChpc0FycmF5TGlrZShvYmplY3QpICYmIGlzSW5kZXgoaW5kZXgsIG9iamVjdC5sZW5ndGgpKVxuICAgICAgOiAodHlwZSA9PSAnc3RyaW5nJyAmJiBpbmRleCBpbiBvYmplY3QpKSB7XG4gICAgdmFyIG90aGVyID0gb2JqZWN0W2luZGV4XTtcbiAgICByZXR1cm4gdmFsdWUgPT09IHZhbHVlID8gKHZhbHVlID09PSBvdGhlcikgOiAob3RoZXIgIT09IG90aGVyKTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSB2YWxpZCBhcnJheS1saWtlIGxlbmd0aC5cbiAqXG4gKiAqKk5vdGU6KiogVGhpcyBmdW5jdGlvbiBpcyBiYXNlZCBvbiBbYFRvTGVuZ3RoYF0oaHR0cHM6Ly9wZW9wbGUubW96aWxsYS5vcmcvfmpvcmVuZG9yZmYvZXM2LWRyYWZ0Lmh0bWwjc2VjLXRvbGVuZ3RoKS5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhIHZhbGlkIGxlbmd0aCwgZWxzZSBgZmFsc2VgLlxuICovXG5mdW5jdGlvbiBpc0xlbmd0aCh2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09ICdudW1iZXInICYmIHZhbHVlID4gLTEgJiYgdmFsdWUgJSAxID09IDAgJiYgdmFsdWUgPD0gTUFYX1NBRkVfSU5URUdFUjtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyB0aGUgW2xhbmd1YWdlIHR5cGVdKGh0dHBzOi8vZXM1LmdpdGh1Yi5pby8jeDgpIG9mIGBPYmplY3RgLlxuICogKGUuZy4gYXJyYXlzLCBmdW5jdGlvbnMsIG9iamVjdHMsIHJlZ2V4ZXMsIGBuZXcgTnVtYmVyKDApYCwgYW5kIGBuZXcgU3RyaW5nKCcnKWApXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGFuIG9iamVjdCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzT2JqZWN0KHt9KTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0KFsxLCAyLCAzXSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdCgxKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzT2JqZWN0KHZhbHVlKSB7XG4gIC8vIEF2b2lkIGEgVjggSklUIGJ1ZyBpbiBDaHJvbWUgMTktMjAuXG4gIC8vIFNlZSBodHRwczovL2NvZGUuZ29vZ2xlLmNvbS9wL3Y4L2lzc3Vlcy9kZXRhaWw/aWQ9MjI5MSBmb3IgbW9yZSBkZXRhaWxzLlxuICB2YXIgdHlwZSA9IHR5cGVvZiB2YWx1ZTtcbiAgcmV0dXJuICEhdmFsdWUgJiYgKHR5cGUgPT0gJ29iamVjdCcgfHwgdHlwZSA9PSAnZnVuY3Rpb24nKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpc0l0ZXJhdGVlQ2FsbDtcbiIsIi8qKlxuICogbG9kYXNoIDMuNi4xIChDdXN0b20gQnVpbGQpIDxodHRwczovL2xvZGFzaC5jb20vPlxuICogQnVpbGQ6IGBsb2Rhc2ggbW9kZXJuIG1vZHVsYXJpemUgZXhwb3J0cz1cIm5wbVwiIC1vIC4vYFxuICogQ29weXJpZ2h0IDIwMTItMjAxNSBUaGUgRG9qbyBGb3VuZGF0aW9uIDxodHRwOi8vZG9qb2ZvdW5kYXRpb24ub3JnLz5cbiAqIEJhc2VkIG9uIFVuZGVyc2NvcmUuanMgMS44LjMgPGh0dHA6Ly91bmRlcnNjb3JlanMub3JnL0xJQ0VOU0U+XG4gKiBDb3B5cmlnaHQgMjAwOS0yMDE1IEplcmVteSBBc2hrZW5hcywgRG9jdW1lbnRDbG91ZCBhbmQgSW52ZXN0aWdhdGl2ZSBSZXBvcnRlcnMgJiBFZGl0b3JzXG4gKiBBdmFpbGFibGUgdW5kZXIgTUlUIGxpY2Vuc2UgPGh0dHBzOi8vbG9kYXNoLmNvbS9saWNlbnNlPlxuICovXG5cbi8qKiBVc2VkIGFzIHRoZSBgVHlwZUVycm9yYCBtZXNzYWdlIGZvciBcIkZ1bmN0aW9uc1wiIG1ldGhvZHMuICovXG52YXIgRlVOQ19FUlJPUl9URVhUID0gJ0V4cGVjdGVkIGEgZnVuY3Rpb24nO1xuXG4vKiBOYXRpdmUgbWV0aG9kIHJlZmVyZW5jZXMgZm9yIHRob3NlIHdpdGggdGhlIHNhbWUgbmFtZSBhcyBvdGhlciBgbG9kYXNoYCBtZXRob2RzLiAqL1xudmFyIG5hdGl2ZU1heCA9IE1hdGgubWF4O1xuXG4vKipcbiAqIENyZWF0ZXMgYSBmdW5jdGlvbiB0aGF0IGludm9rZXMgYGZ1bmNgIHdpdGggdGhlIGB0aGlzYCBiaW5kaW5nIG9mIHRoZVxuICogY3JlYXRlZCBmdW5jdGlvbiBhbmQgYXJndW1lbnRzIGZyb20gYHN0YXJ0YCBhbmQgYmV5b25kIHByb3ZpZGVkIGFzIGFuIGFycmF5LlxuICpcbiAqICoqTm90ZToqKiBUaGlzIG1ldGhvZCBpcyBiYXNlZCBvbiB0aGUgW3Jlc3QgcGFyYW1ldGVyXShodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9GdW5jdGlvbnMvcmVzdF9wYXJhbWV0ZXJzKS5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IEZ1bmN0aW9uXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jIFRoZSBmdW5jdGlvbiB0byBhcHBseSBhIHJlc3QgcGFyYW1ldGVyIHRvLlxuICogQHBhcmFtIHtudW1iZXJ9IFtzdGFydD1mdW5jLmxlbmd0aC0xXSBUaGUgc3RhcnQgcG9zaXRpb24gb2YgdGhlIHJlc3QgcGFyYW1ldGVyLlxuICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgZnVuY3Rpb24uXG4gKiBAZXhhbXBsZVxuICpcbiAqIHZhciBzYXkgPSBfLnJlc3RQYXJhbShmdW5jdGlvbih3aGF0LCBuYW1lcykge1xuICogICByZXR1cm4gd2hhdCArICcgJyArIF8uaW5pdGlhbChuYW1lcykuam9pbignLCAnKSArXG4gKiAgICAgKF8uc2l6ZShuYW1lcykgPiAxID8gJywgJiAnIDogJycpICsgXy5sYXN0KG5hbWVzKTtcbiAqIH0pO1xuICpcbiAqIHNheSgnaGVsbG8nLCAnZnJlZCcsICdiYXJuZXknLCAncGViYmxlcycpO1xuICogLy8gPT4gJ2hlbGxvIGZyZWQsIGJhcm5leSwgJiBwZWJibGVzJ1xuICovXG5mdW5jdGlvbiByZXN0UGFyYW0oZnVuYywgc3RhcnQpIHtcbiAgaWYgKHR5cGVvZiBmdW5jICE9ICdmdW5jdGlvbicpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKEZVTkNfRVJST1JfVEVYVCk7XG4gIH1cbiAgc3RhcnQgPSBuYXRpdmVNYXgoc3RhcnQgPT09IHVuZGVmaW5lZCA/IChmdW5jLmxlbmd0aCAtIDEpIDogKCtzdGFydCB8fCAwKSwgMCk7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICB2YXIgYXJncyA9IGFyZ3VtZW50cyxcbiAgICAgICAgaW5kZXggPSAtMSxcbiAgICAgICAgbGVuZ3RoID0gbmF0aXZlTWF4KGFyZ3MubGVuZ3RoIC0gc3RhcnQsIDApLFxuICAgICAgICByZXN0ID0gQXJyYXkobGVuZ3RoKTtcblxuICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICByZXN0W2luZGV4XSA9IGFyZ3Nbc3RhcnQgKyBpbmRleF07XG4gICAgfVxuICAgIHN3aXRjaCAoc3RhcnQpIHtcbiAgICAgIGNhc2UgMDogcmV0dXJuIGZ1bmMuY2FsbCh0aGlzLCByZXN0KTtcbiAgICAgIGNhc2UgMTogcmV0dXJuIGZ1bmMuY2FsbCh0aGlzLCBhcmdzWzBdLCByZXN0KTtcbiAgICAgIGNhc2UgMjogcmV0dXJuIGZ1bmMuY2FsbCh0aGlzLCBhcmdzWzBdLCBhcmdzWzFdLCByZXN0KTtcbiAgICB9XG4gICAgdmFyIG90aGVyQXJncyA9IEFycmF5KHN0YXJ0ICsgMSk7XG4gICAgaW5kZXggPSAtMTtcbiAgICB3aGlsZSAoKytpbmRleCA8IHN0YXJ0KSB7XG4gICAgICBvdGhlckFyZ3NbaW5kZXhdID0gYXJnc1tpbmRleF07XG4gICAgfVxuICAgIG90aGVyQXJnc1tzdGFydF0gPSByZXN0O1xuICAgIHJldHVybiBmdW5jLmFwcGx5KHRoaXMsIG90aGVyQXJncyk7XG4gIH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gcmVzdFBhcmFtO1xuIiwiLyoqXG4gKiBsb2Rhc2ggMy4xLjIgKEN1c3RvbSBCdWlsZCkgPGh0dHBzOi8vbG9kYXNoLmNvbS8+XG4gKiBCdWlsZDogYGxvZGFzaCBtb2Rlcm4gbW9kdWxhcml6ZSBleHBvcnRzPVwibnBtXCIgLW8gLi9gXG4gKiBDb3B5cmlnaHQgMjAxMi0yMDE1IFRoZSBEb2pvIEZvdW5kYXRpb24gPGh0dHA6Ly9kb2pvZm91bmRhdGlvbi5vcmcvPlxuICogQmFzZWQgb24gVW5kZXJzY29yZS5qcyAxLjguMyA8aHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvTElDRU5TRT5cbiAqIENvcHlyaWdodCAyMDA5LTIwMTUgSmVyZW15IEFzaGtlbmFzLCBEb2N1bWVudENsb3VkIGFuZCBJbnZlc3RpZ2F0aXZlIFJlcG9ydGVycyAmIEVkaXRvcnNcbiAqIEF2YWlsYWJsZSB1bmRlciBNSVQgbGljZW5zZSA8aHR0cHM6Ly9sb2Rhc2guY29tL2xpY2Vuc2U+XG4gKi9cbnZhciBnZXROYXRpdmUgPSByZXF1aXJlKCdsb2Rhc2guX2dldG5hdGl2ZScpLFxuICAgIGlzQXJndW1lbnRzID0gcmVxdWlyZSgnbG9kYXNoLmlzYXJndW1lbnRzJyksXG4gICAgaXNBcnJheSA9IHJlcXVpcmUoJ2xvZGFzaC5pc2FycmF5Jyk7XG5cbi8qKiBVc2VkIHRvIGRldGVjdCB1bnNpZ25lZCBpbnRlZ2VyIHZhbHVlcy4gKi9cbnZhciByZUlzVWludCA9IC9eXFxkKyQvO1xuXG4vKiogVXNlZCBmb3IgbmF0aXZlIG1ldGhvZCByZWZlcmVuY2VzLiAqL1xudmFyIG9iamVjdFByb3RvID0gT2JqZWN0LnByb3RvdHlwZTtcblxuLyoqIFVzZWQgdG8gY2hlY2sgb2JqZWN0cyBmb3Igb3duIHByb3BlcnRpZXMuICovXG52YXIgaGFzT3duUHJvcGVydHkgPSBvYmplY3RQcm90by5oYXNPd25Qcm9wZXJ0eTtcblxuLyogTmF0aXZlIG1ldGhvZCByZWZlcmVuY2VzIGZvciB0aG9zZSB3aXRoIHRoZSBzYW1lIG5hbWUgYXMgb3RoZXIgYGxvZGFzaGAgbWV0aG9kcy4gKi9cbnZhciBuYXRpdmVLZXlzID0gZ2V0TmF0aXZlKE9iamVjdCwgJ2tleXMnKTtcblxuLyoqXG4gKiBVc2VkIGFzIHRoZSBbbWF4aW11bSBsZW5ndGhdKGh0dHA6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzYuMC8jc2VjLW51bWJlci5tYXhfc2FmZV9pbnRlZ2VyKVxuICogb2YgYW4gYXJyYXktbGlrZSB2YWx1ZS5cbiAqL1xudmFyIE1BWF9TQUZFX0lOVEVHRVIgPSA5MDA3MTk5MjU0NzQwOTkxO1xuXG4vKipcbiAqIFRoZSBiYXNlIGltcGxlbWVudGF0aW9uIG9mIGBfLnByb3BlcnR5YCB3aXRob3V0IHN1cHBvcnQgZm9yIGRlZXAgcGF0aHMuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgVGhlIGtleSBvZiB0aGUgcHJvcGVydHkgdG8gZ2V0LlxuICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgZnVuY3Rpb24uXG4gKi9cbmZ1bmN0aW9uIGJhc2VQcm9wZXJ0eShrZXkpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKG9iamVjdCkge1xuICAgIHJldHVybiBvYmplY3QgPT0gbnVsbCA/IHVuZGVmaW5lZCA6IG9iamVjdFtrZXldO1xuICB9O1xufVxuXG4vKipcbiAqIEdldHMgdGhlIFwibGVuZ3RoXCIgcHJvcGVydHkgdmFsdWUgb2YgYG9iamVjdGAuXG4gKlxuICogKipOb3RlOioqIFRoaXMgZnVuY3Rpb24gaXMgdXNlZCB0byBhdm9pZCBhIFtKSVQgYnVnXShodHRwczovL2J1Z3Mud2Via2l0Lm9yZy9zaG93X2J1Zy5jZ2k/aWQ9MTQyNzkyKVxuICogdGhhdCBhZmZlY3RzIFNhZmFyaSBvbiBhdCBsZWFzdCBpT1MgOC4xLTguMyBBUk02NC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIHF1ZXJ5LlxuICogQHJldHVybnMgeyp9IFJldHVybnMgdGhlIFwibGVuZ3RoXCIgdmFsdWUuXG4gKi9cbnZhciBnZXRMZW5ndGggPSBiYXNlUHJvcGVydHkoJ2xlbmd0aCcpO1xuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGFycmF5LWxpa2UuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYXJyYXktbGlrZSwgZWxzZSBgZmFsc2VgLlxuICovXG5mdW5jdGlvbiBpc0FycmF5TGlrZSh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgIT0gbnVsbCAmJiBpc0xlbmd0aChnZXRMZW5ndGgodmFsdWUpKTtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIHZhbGlkIGFycmF5LWxpa2UgaW5kZXguXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHBhcmFtIHtudW1iZXJ9IFtsZW5ndGg9TUFYX1NBRkVfSU5URUdFUl0gVGhlIHVwcGVyIGJvdW5kcyBvZiBhIHZhbGlkIGluZGV4LlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSB2YWxpZCBpbmRleCwgZWxzZSBgZmFsc2VgLlxuICovXG5mdW5jdGlvbiBpc0luZGV4KHZhbHVlLCBsZW5ndGgpIHtcbiAgdmFsdWUgPSAodHlwZW9mIHZhbHVlID09ICdudW1iZXInIHx8IHJlSXNVaW50LnRlc3QodmFsdWUpKSA/ICt2YWx1ZSA6IC0xO1xuICBsZW5ndGggPSBsZW5ndGggPT0gbnVsbCA/IE1BWF9TQUZFX0lOVEVHRVIgOiBsZW5ndGg7XG4gIHJldHVybiB2YWx1ZSA+IC0xICYmIHZhbHVlICUgMSA9PSAwICYmIHZhbHVlIDwgbGVuZ3RoO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGEgdmFsaWQgYXJyYXktbGlrZSBsZW5ndGguXG4gKlxuICogKipOb3RlOioqIFRoaXMgZnVuY3Rpb24gaXMgYmFzZWQgb24gW2BUb0xlbmd0aGBdKGh0dHA6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzYuMC8jc2VjLXRvbGVuZ3RoKS5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhIHZhbGlkIGxlbmd0aCwgZWxzZSBgZmFsc2VgLlxuICovXG5mdW5jdGlvbiBpc0xlbmd0aCh2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09ICdudW1iZXInICYmIHZhbHVlID4gLTEgJiYgdmFsdWUgJSAxID09IDAgJiYgdmFsdWUgPD0gTUFYX1NBRkVfSU5URUdFUjtcbn1cblxuLyoqXG4gKiBBIGZhbGxiYWNrIGltcGxlbWVudGF0aW9uIG9mIGBPYmplY3Qua2V5c2Agd2hpY2ggY3JlYXRlcyBhbiBhcnJheSBvZiB0aGVcbiAqIG93biBlbnVtZXJhYmxlIHByb3BlcnR5IG5hbWVzIG9mIGBvYmplY3RgLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gcXVlcnkuXG4gKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgdGhlIGFycmF5IG9mIHByb3BlcnR5IG5hbWVzLlxuICovXG5mdW5jdGlvbiBzaGltS2V5cyhvYmplY3QpIHtcbiAgdmFyIHByb3BzID0ga2V5c0luKG9iamVjdCksXG4gICAgICBwcm9wc0xlbmd0aCA9IHByb3BzLmxlbmd0aCxcbiAgICAgIGxlbmd0aCA9IHByb3BzTGVuZ3RoICYmIG9iamVjdC5sZW5ndGg7XG5cbiAgdmFyIGFsbG93SW5kZXhlcyA9ICEhbGVuZ3RoICYmIGlzTGVuZ3RoKGxlbmd0aCkgJiZcbiAgICAoaXNBcnJheShvYmplY3QpIHx8IGlzQXJndW1lbnRzKG9iamVjdCkpO1xuXG4gIHZhciBpbmRleCA9IC0xLFxuICAgICAgcmVzdWx0ID0gW107XG5cbiAgd2hpbGUgKCsraW5kZXggPCBwcm9wc0xlbmd0aCkge1xuICAgIHZhciBrZXkgPSBwcm9wc1tpbmRleF07XG4gICAgaWYgKChhbGxvd0luZGV4ZXMgJiYgaXNJbmRleChrZXksIGxlbmd0aCkpIHx8IGhhc093blByb3BlcnR5LmNhbGwob2JqZWN0LCBrZXkpKSB7XG4gICAgICByZXN1bHQucHVzaChrZXkpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIHRoZSBbbGFuZ3VhZ2UgdHlwZV0oaHR0cHM6Ly9lczUuZ2l0aHViLmlvLyN4OCkgb2YgYE9iamVjdGAuXG4gKiAoZS5nLiBhcnJheXMsIGZ1bmN0aW9ucywgb2JqZWN0cywgcmVnZXhlcywgYG5ldyBOdW1iZXIoMClgLCBhbmQgYG5ldyBTdHJpbmcoJycpYClcbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYW4gb2JqZWN0LCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNPYmplY3Qoe30pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3QoWzEsIDIsIDNdKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0KDEpO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNPYmplY3QodmFsdWUpIHtcbiAgLy8gQXZvaWQgYSBWOCBKSVQgYnVnIGluIENocm9tZSAxOS0yMC5cbiAgLy8gU2VlIGh0dHBzOi8vY29kZS5nb29nbGUuY29tL3AvdjgvaXNzdWVzL2RldGFpbD9pZD0yMjkxIGZvciBtb3JlIGRldGFpbHMuXG4gIHZhciB0eXBlID0gdHlwZW9mIHZhbHVlO1xuICByZXR1cm4gISF2YWx1ZSAmJiAodHlwZSA9PSAnb2JqZWN0JyB8fCB0eXBlID09ICdmdW5jdGlvbicpO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYW4gYXJyYXkgb2YgdGhlIG93biBlbnVtZXJhYmxlIHByb3BlcnR5IG5hbWVzIG9mIGBvYmplY3RgLlxuICpcbiAqICoqTm90ZToqKiBOb24tb2JqZWN0IHZhbHVlcyBhcmUgY29lcmNlZCB0byBvYmplY3RzLiBTZWUgdGhlXG4gKiBbRVMgc3BlY10oaHR0cDovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNi4wLyNzZWMtb2JqZWN0LmtleXMpXG4gKiBmb3IgbW9yZSBkZXRhaWxzLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgT2JqZWN0XG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gcXVlcnkuXG4gKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgdGhlIGFycmF5IG9mIHByb3BlcnR5IG5hbWVzLlxuICogQGV4YW1wbGVcbiAqXG4gKiBmdW5jdGlvbiBGb28oKSB7XG4gKiAgIHRoaXMuYSA9IDE7XG4gKiAgIHRoaXMuYiA9IDI7XG4gKiB9XG4gKlxuICogRm9vLnByb3RvdHlwZS5jID0gMztcbiAqXG4gKiBfLmtleXMobmV3IEZvbyk7XG4gKiAvLyA9PiBbJ2EnLCAnYiddIChpdGVyYXRpb24gb3JkZXIgaXMgbm90IGd1YXJhbnRlZWQpXG4gKlxuICogXy5rZXlzKCdoaScpO1xuICogLy8gPT4gWycwJywgJzEnXVxuICovXG52YXIga2V5cyA9ICFuYXRpdmVLZXlzID8gc2hpbUtleXMgOiBmdW5jdGlvbihvYmplY3QpIHtcbiAgdmFyIEN0b3IgPSBvYmplY3QgPT0gbnVsbCA/IHVuZGVmaW5lZCA6IG9iamVjdC5jb25zdHJ1Y3RvcjtcbiAgaWYgKCh0eXBlb2YgQ3RvciA9PSAnZnVuY3Rpb24nICYmIEN0b3IucHJvdG90eXBlID09PSBvYmplY3QpIHx8XG4gICAgICAodHlwZW9mIG9iamVjdCAhPSAnZnVuY3Rpb24nICYmIGlzQXJyYXlMaWtlKG9iamVjdCkpKSB7XG4gICAgcmV0dXJuIHNoaW1LZXlzKG9iamVjdCk7XG4gIH1cbiAgcmV0dXJuIGlzT2JqZWN0KG9iamVjdCkgPyBuYXRpdmVLZXlzKG9iamVjdCkgOiBbXTtcbn07XG5cbi8qKlxuICogQ3JlYXRlcyBhbiBhcnJheSBvZiB0aGUgb3duIGFuZCBpbmhlcml0ZWQgZW51bWVyYWJsZSBwcm9wZXJ0eSBuYW1lcyBvZiBgb2JqZWN0YC5cbiAqXG4gKiAqKk5vdGU6KiogTm9uLW9iamVjdCB2YWx1ZXMgYXJlIGNvZXJjZWQgdG8gb2JqZWN0cy5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IE9iamVjdFxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIHF1ZXJ5LlxuICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIHRoZSBhcnJheSBvZiBwcm9wZXJ0eSBuYW1lcy5cbiAqIEBleGFtcGxlXG4gKlxuICogZnVuY3Rpb24gRm9vKCkge1xuICogICB0aGlzLmEgPSAxO1xuICogICB0aGlzLmIgPSAyO1xuICogfVxuICpcbiAqIEZvby5wcm90b3R5cGUuYyA9IDM7XG4gKlxuICogXy5rZXlzSW4obmV3IEZvbyk7XG4gKiAvLyA9PiBbJ2EnLCAnYicsICdjJ10gKGl0ZXJhdGlvbiBvcmRlciBpcyBub3QgZ3VhcmFudGVlZClcbiAqL1xuZnVuY3Rpb24ga2V5c0luKG9iamVjdCkge1xuICBpZiAob2JqZWN0ID09IG51bGwpIHtcbiAgICByZXR1cm4gW107XG4gIH1cbiAgaWYgKCFpc09iamVjdChvYmplY3QpKSB7XG4gICAgb2JqZWN0ID0gT2JqZWN0KG9iamVjdCk7XG4gIH1cbiAgdmFyIGxlbmd0aCA9IG9iamVjdC5sZW5ndGg7XG4gIGxlbmd0aCA9IChsZW5ndGggJiYgaXNMZW5ndGgobGVuZ3RoKSAmJlxuICAgIChpc0FycmF5KG9iamVjdCkgfHwgaXNBcmd1bWVudHMob2JqZWN0KSkgJiYgbGVuZ3RoKSB8fCAwO1xuXG4gIHZhciBDdG9yID0gb2JqZWN0LmNvbnN0cnVjdG9yLFxuICAgICAgaW5kZXggPSAtMSxcbiAgICAgIGlzUHJvdG8gPSB0eXBlb2YgQ3RvciA9PSAnZnVuY3Rpb24nICYmIEN0b3IucHJvdG90eXBlID09PSBvYmplY3QsXG4gICAgICByZXN1bHQgPSBBcnJheShsZW5ndGgpLFxuICAgICAgc2tpcEluZGV4ZXMgPSBsZW5ndGggPiAwO1xuXG4gIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgcmVzdWx0W2luZGV4XSA9IChpbmRleCArICcnKTtcbiAgfVxuICBmb3IgKHZhciBrZXkgaW4gb2JqZWN0KSB7XG4gICAgaWYgKCEoc2tpcEluZGV4ZXMgJiYgaXNJbmRleChrZXksIGxlbmd0aCkpICYmXG4gICAgICAgICEoa2V5ID09ICdjb25zdHJ1Y3RvcicgJiYgKGlzUHJvdG8gfHwgIWhhc093blByb3BlcnR5LmNhbGwob2JqZWN0LCBrZXkpKSkpIHtcbiAgICAgIHJlc3VsdC5wdXNoKGtleSk7XG4gICAgfVxuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ga2V5cztcbiIsIi8qKlxuICogbG9kYXNoIDMuOS4xIChDdXN0b20gQnVpbGQpIDxodHRwczovL2xvZGFzaC5jb20vPlxuICogQnVpbGQ6IGBsb2Rhc2ggbW9kZXJuIG1vZHVsYXJpemUgZXhwb3J0cz1cIm5wbVwiIC1vIC4vYFxuICogQ29weXJpZ2h0IDIwMTItMjAxNSBUaGUgRG9qbyBGb3VuZGF0aW9uIDxodHRwOi8vZG9qb2ZvdW5kYXRpb24ub3JnLz5cbiAqIEJhc2VkIG9uIFVuZGVyc2NvcmUuanMgMS44LjMgPGh0dHA6Ly91bmRlcnNjb3JlanMub3JnL0xJQ0VOU0U+XG4gKiBDb3B5cmlnaHQgMjAwOS0yMDE1IEplcmVteSBBc2hrZW5hcywgRG9jdW1lbnRDbG91ZCBhbmQgSW52ZXN0aWdhdGl2ZSBSZXBvcnRlcnMgJiBFZGl0b3JzXG4gKiBBdmFpbGFibGUgdW5kZXIgTUlUIGxpY2Vuc2UgPGh0dHBzOi8vbG9kYXNoLmNvbS9saWNlbnNlPlxuICovXG5cbi8qKiBgT2JqZWN0I3RvU3RyaW5nYCByZXN1bHQgcmVmZXJlbmNlcy4gKi9cbnZhciBmdW5jVGFnID0gJ1tvYmplY3QgRnVuY3Rpb25dJztcblxuLyoqIFVzZWQgdG8gZGV0ZWN0IGhvc3QgY29uc3RydWN0b3JzIChTYWZhcmkgPiA1KS4gKi9cbnZhciByZUlzSG9zdEN0b3IgPSAvXlxcW29iamVjdCAuKz9Db25zdHJ1Y3RvclxcXSQvO1xuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIG9iamVjdC1saWtlLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIG9iamVjdC1saWtlLCBlbHNlIGBmYWxzZWAuXG4gKi9cbmZ1bmN0aW9uIGlzT2JqZWN0TGlrZSh2YWx1ZSkge1xuICByZXR1cm4gISF2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT0gJ29iamVjdCc7XG59XG5cbi8qKiBVc2VkIGZvciBuYXRpdmUgbWV0aG9kIHJlZmVyZW5jZXMuICovXG52YXIgb2JqZWN0UHJvdG8gPSBPYmplY3QucHJvdG90eXBlO1xuXG4vKiogVXNlZCB0byByZXNvbHZlIHRoZSBkZWNvbXBpbGVkIHNvdXJjZSBvZiBmdW5jdGlvbnMuICovXG52YXIgZm5Ub1N0cmluZyA9IEZ1bmN0aW9uLnByb3RvdHlwZS50b1N0cmluZztcblxuLyoqIFVzZWQgdG8gY2hlY2sgb2JqZWN0cyBmb3Igb3duIHByb3BlcnRpZXMuICovXG52YXIgaGFzT3duUHJvcGVydHkgPSBvYmplY3RQcm90by5oYXNPd25Qcm9wZXJ0eTtcblxuLyoqXG4gKiBVc2VkIHRvIHJlc29sdmUgdGhlIFtgdG9TdHJpbmdUYWdgXShodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi82LjAvI3NlYy1vYmplY3QucHJvdG90eXBlLnRvc3RyaW5nKVxuICogb2YgdmFsdWVzLlxuICovXG52YXIgb2JqVG9TdHJpbmcgPSBvYmplY3RQcm90by50b1N0cmluZztcblxuLyoqIFVzZWQgdG8gZGV0ZWN0IGlmIGEgbWV0aG9kIGlzIG5hdGl2ZS4gKi9cbnZhciByZUlzTmF0aXZlID0gUmVnRXhwKCdeJyArXG4gIGZuVG9TdHJpbmcuY2FsbChoYXNPd25Qcm9wZXJ0eSkucmVwbGFjZSgvW1xcXFxeJC4qKz8oKVtcXF17fXxdL2csICdcXFxcJCYnKVxuICAucmVwbGFjZSgvaGFzT3duUHJvcGVydHl8KGZ1bmN0aW9uKS4qPyg/PVxcXFxcXCgpfCBmb3IgLis/KD89XFxcXFxcXSkvZywgJyQxLio/JykgKyAnJCdcbik7XG5cbi8qKlxuICogR2V0cyB0aGUgbmF0aXZlIGZ1bmN0aW9uIGF0IGBrZXlgIG9mIGBvYmplY3RgLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gcXVlcnkuXG4gKiBAcGFyYW0ge3N0cmluZ30ga2V5IFRoZSBrZXkgb2YgdGhlIG1ldGhvZCB0byBnZXQuXG4gKiBAcmV0dXJucyB7Kn0gUmV0dXJucyB0aGUgZnVuY3Rpb24gaWYgaXQncyBuYXRpdmUsIGVsc2UgYHVuZGVmaW5lZGAuXG4gKi9cbmZ1bmN0aW9uIGdldE5hdGl2ZShvYmplY3QsIGtleSkge1xuICB2YXIgdmFsdWUgPSBvYmplY3QgPT0gbnVsbCA/IHVuZGVmaW5lZCA6IG9iamVjdFtrZXldO1xuICByZXR1cm4gaXNOYXRpdmUodmFsdWUpID8gdmFsdWUgOiB1bmRlZmluZWQ7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgY2xhc3NpZmllZCBhcyBhIGBGdW5jdGlvbmAgb2JqZWN0LlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBjb3JyZWN0bHkgY2xhc3NpZmllZCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzRnVuY3Rpb24oXyk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc0Z1bmN0aW9uKC9hYmMvKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzRnVuY3Rpb24odmFsdWUpIHtcbiAgLy8gVGhlIHVzZSBvZiBgT2JqZWN0I3RvU3RyaW5nYCBhdm9pZHMgaXNzdWVzIHdpdGggdGhlIGB0eXBlb2ZgIG9wZXJhdG9yXG4gIC8vIGluIG9sZGVyIHZlcnNpb25zIG9mIENocm9tZSBhbmQgU2FmYXJpIHdoaWNoIHJldHVybiAnZnVuY3Rpb24nIGZvciByZWdleGVzXG4gIC8vIGFuZCBTYWZhcmkgOCBlcXVpdmFsZW50cyB3aGljaCByZXR1cm4gJ29iamVjdCcgZm9yIHR5cGVkIGFycmF5IGNvbnN0cnVjdG9ycy5cbiAgcmV0dXJuIGlzT2JqZWN0KHZhbHVlKSAmJiBvYmpUb1N0cmluZy5jYWxsKHZhbHVlKSA9PSBmdW5jVGFnO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIHRoZSBbbGFuZ3VhZ2UgdHlwZV0oaHR0cHM6Ly9lczUuZ2l0aHViLmlvLyN4OCkgb2YgYE9iamVjdGAuXG4gKiAoZS5nLiBhcnJheXMsIGZ1bmN0aW9ucywgb2JqZWN0cywgcmVnZXhlcywgYG5ldyBOdW1iZXIoMClgLCBhbmQgYG5ldyBTdHJpbmcoJycpYClcbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYW4gb2JqZWN0LCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNPYmplY3Qoe30pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3QoWzEsIDIsIDNdKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0KDEpO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNPYmplY3QodmFsdWUpIHtcbiAgLy8gQXZvaWQgYSBWOCBKSVQgYnVnIGluIENocm9tZSAxOS0yMC5cbiAgLy8gU2VlIGh0dHBzOi8vY29kZS5nb29nbGUuY29tL3AvdjgvaXNzdWVzL2RldGFpbD9pZD0yMjkxIGZvciBtb3JlIGRldGFpbHMuXG4gIHZhciB0eXBlID0gdHlwZW9mIHZhbHVlO1xuICByZXR1cm4gISF2YWx1ZSAmJiAodHlwZSA9PSAnb2JqZWN0JyB8fCB0eXBlID09ICdmdW5jdGlvbicpO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGEgbmF0aXZlIGZ1bmN0aW9uLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhIG5hdGl2ZSBmdW5jdGlvbiwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzTmF0aXZlKEFycmF5LnByb3RvdHlwZS5wdXNoKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzTmF0aXZlKF8pO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNOYXRpdmUodmFsdWUpIHtcbiAgaWYgKHZhbHVlID09IG51bGwpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKGlzRnVuY3Rpb24odmFsdWUpKSB7XG4gICAgcmV0dXJuIHJlSXNOYXRpdmUudGVzdChmblRvU3RyaW5nLmNhbGwodmFsdWUpKTtcbiAgfVxuICByZXR1cm4gaXNPYmplY3RMaWtlKHZhbHVlKSAmJiByZUlzSG9zdEN0b3IudGVzdCh2YWx1ZSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZ2V0TmF0aXZlO1xuIiwiLyoqXG4gKiBsb2Rhc2ggMy4wLjQgKEN1c3RvbSBCdWlsZCkgPGh0dHBzOi8vbG9kYXNoLmNvbS8+XG4gKiBCdWlsZDogYGxvZGFzaCBtb2Rlcm4gbW9kdWxhcml6ZSBleHBvcnRzPVwibnBtXCIgLW8gLi9gXG4gKiBDb3B5cmlnaHQgMjAxMi0yMDE1IFRoZSBEb2pvIEZvdW5kYXRpb24gPGh0dHA6Ly9kb2pvZm91bmRhdGlvbi5vcmcvPlxuICogQmFzZWQgb24gVW5kZXJzY29yZS5qcyAxLjguMyA8aHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvTElDRU5TRT5cbiAqIENvcHlyaWdodCAyMDA5LTIwMTUgSmVyZW15IEFzaGtlbmFzLCBEb2N1bWVudENsb3VkIGFuZCBJbnZlc3RpZ2F0aXZlIFJlcG9ydGVycyAmIEVkaXRvcnNcbiAqIEF2YWlsYWJsZSB1bmRlciBNSVQgbGljZW5zZSA8aHR0cHM6Ly9sb2Rhc2guY29tL2xpY2Vuc2U+XG4gKi9cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBvYmplY3QtbGlrZS5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBvYmplY3QtbGlrZSwgZWxzZSBgZmFsc2VgLlxuICovXG5mdW5jdGlvbiBpc09iamVjdExpa2UodmFsdWUpIHtcbiAgcmV0dXJuICEhdmFsdWUgJiYgdHlwZW9mIHZhbHVlID09ICdvYmplY3QnO1xufVxuXG4vKiogVXNlZCBmb3IgbmF0aXZlIG1ldGhvZCByZWZlcmVuY2VzLiAqL1xudmFyIG9iamVjdFByb3RvID0gT2JqZWN0LnByb3RvdHlwZTtcblxuLyoqIFVzZWQgdG8gY2hlY2sgb2JqZWN0cyBmb3Igb3duIHByb3BlcnRpZXMuICovXG52YXIgaGFzT3duUHJvcGVydHkgPSBvYmplY3RQcm90by5oYXNPd25Qcm9wZXJ0eTtcblxuLyoqIE5hdGl2ZSBtZXRob2QgcmVmZXJlbmNlcy4gKi9cbnZhciBwcm9wZXJ0eUlzRW51bWVyYWJsZSA9IG9iamVjdFByb3RvLnByb3BlcnR5SXNFbnVtZXJhYmxlO1xuXG4vKipcbiAqIFVzZWQgYXMgdGhlIFttYXhpbXVtIGxlbmd0aF0oaHR0cDovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNi4wLyNzZWMtbnVtYmVyLm1heF9zYWZlX2ludGVnZXIpXG4gKiBvZiBhbiBhcnJheS1saWtlIHZhbHVlLlxuICovXG52YXIgTUFYX1NBRkVfSU5URUdFUiA9IDkwMDcxOTkyNTQ3NDA5OTE7XG5cbi8qKlxuICogVGhlIGJhc2UgaW1wbGVtZW50YXRpb24gb2YgYF8ucHJvcGVydHlgIHdpdGhvdXQgc3VwcG9ydCBmb3IgZGVlcCBwYXRocy5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtzdHJpbmd9IGtleSBUaGUga2V5IG9mIHRoZSBwcm9wZXJ0eSB0byBnZXQuXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyBmdW5jdGlvbi5cbiAqL1xuZnVuY3Rpb24gYmFzZVByb3BlcnR5KGtleSkge1xuICByZXR1cm4gZnVuY3Rpb24ob2JqZWN0KSB7XG4gICAgcmV0dXJuIG9iamVjdCA9PSBudWxsID8gdW5kZWZpbmVkIDogb2JqZWN0W2tleV07XG4gIH07XG59XG5cbi8qKlxuICogR2V0cyB0aGUgXCJsZW5ndGhcIiBwcm9wZXJ0eSB2YWx1ZSBvZiBgb2JqZWN0YC5cbiAqXG4gKiAqKk5vdGU6KiogVGhpcyBmdW5jdGlvbiBpcyB1c2VkIHRvIGF2b2lkIGEgW0pJVCBidWddKGh0dHBzOi8vYnVncy53ZWJraXQub3JnL3Nob3dfYnVnLmNnaT9pZD0xNDI3OTIpXG4gKiB0aGF0IGFmZmVjdHMgU2FmYXJpIG9uIGF0IGxlYXN0IGlPUyA4LjEtOC4zIEFSTTY0LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gcXVlcnkuXG4gKiBAcmV0dXJucyB7Kn0gUmV0dXJucyB0aGUgXCJsZW5ndGhcIiB2YWx1ZS5cbiAqL1xudmFyIGdldExlbmd0aCA9IGJhc2VQcm9wZXJ0eSgnbGVuZ3RoJyk7XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYXJyYXktbGlrZS5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhcnJheS1saWtlLCBlbHNlIGBmYWxzZWAuXG4gKi9cbmZ1bmN0aW9uIGlzQXJyYXlMaWtlKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSAhPSBudWxsICYmIGlzTGVuZ3RoKGdldExlbmd0aCh2YWx1ZSkpO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGEgdmFsaWQgYXJyYXktbGlrZSBsZW5ndGguXG4gKlxuICogKipOb3RlOioqIFRoaXMgZnVuY3Rpb24gaXMgYmFzZWQgb24gW2BUb0xlbmd0aGBdKGh0dHA6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzYuMC8jc2VjLXRvbGVuZ3RoKS5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhIHZhbGlkIGxlbmd0aCwgZWxzZSBgZmFsc2VgLlxuICovXG5mdW5jdGlvbiBpc0xlbmd0aCh2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09ICdudW1iZXInICYmIHZhbHVlID4gLTEgJiYgdmFsdWUgJSAxID09IDAgJiYgdmFsdWUgPD0gTUFYX1NBRkVfSU5URUdFUjtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBjbGFzc2lmaWVkIGFzIGFuIGBhcmd1bWVudHNgIG9iamVjdC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgY29ycmVjdGx5IGNsYXNzaWZpZWQsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc0FyZ3VtZW50cyhmdW5jdGlvbigpIHsgcmV0dXJuIGFyZ3VtZW50czsgfSgpKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzQXJndW1lbnRzKFsxLCAyLCAzXSk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0FyZ3VtZW50cyh2YWx1ZSkge1xuICByZXR1cm4gaXNPYmplY3RMaWtlKHZhbHVlKSAmJiBpc0FycmF5TGlrZSh2YWx1ZSkgJiZcbiAgICBoYXNPd25Qcm9wZXJ0eS5jYWxsKHZhbHVlLCAnY2FsbGVlJykgJiYgIXByb3BlcnR5SXNFbnVtZXJhYmxlLmNhbGwodmFsdWUsICdjYWxsZWUnKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpc0FyZ3VtZW50cztcbiIsIi8qKlxuICogbG9kYXNoIDMuMC40IChDdXN0b20gQnVpbGQpIDxodHRwczovL2xvZGFzaC5jb20vPlxuICogQnVpbGQ6IGBsb2Rhc2ggbW9kZXJuIG1vZHVsYXJpemUgZXhwb3J0cz1cIm5wbVwiIC1vIC4vYFxuICogQ29weXJpZ2h0IDIwMTItMjAxNSBUaGUgRG9qbyBGb3VuZGF0aW9uIDxodHRwOi8vZG9qb2ZvdW5kYXRpb24ub3JnLz5cbiAqIEJhc2VkIG9uIFVuZGVyc2NvcmUuanMgMS44LjMgPGh0dHA6Ly91bmRlcnNjb3JlanMub3JnL0xJQ0VOU0U+XG4gKiBDb3B5cmlnaHQgMjAwOS0yMDE1IEplcmVteSBBc2hrZW5hcywgRG9jdW1lbnRDbG91ZCBhbmQgSW52ZXN0aWdhdGl2ZSBSZXBvcnRlcnMgJiBFZGl0b3JzXG4gKiBBdmFpbGFibGUgdW5kZXIgTUlUIGxpY2Vuc2UgPGh0dHBzOi8vbG9kYXNoLmNvbS9saWNlbnNlPlxuICovXG5cbi8qKiBgT2JqZWN0I3RvU3RyaW5nYCByZXN1bHQgcmVmZXJlbmNlcy4gKi9cbnZhciBhcnJheVRhZyA9ICdbb2JqZWN0IEFycmF5XScsXG4gICAgZnVuY1RhZyA9ICdbb2JqZWN0IEZ1bmN0aW9uXSc7XG5cbi8qKiBVc2VkIHRvIGRldGVjdCBob3N0IGNvbnN0cnVjdG9ycyAoU2FmYXJpID4gNSkuICovXG52YXIgcmVJc0hvc3RDdG9yID0gL15cXFtvYmplY3QgLis/Q29uc3RydWN0b3JcXF0kLztcblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBvYmplY3QtbGlrZS5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBvYmplY3QtbGlrZSwgZWxzZSBgZmFsc2VgLlxuICovXG5mdW5jdGlvbiBpc09iamVjdExpa2UodmFsdWUpIHtcbiAgcmV0dXJuICEhdmFsdWUgJiYgdHlwZW9mIHZhbHVlID09ICdvYmplY3QnO1xufVxuXG4vKiogVXNlZCBmb3IgbmF0aXZlIG1ldGhvZCByZWZlcmVuY2VzLiAqL1xudmFyIG9iamVjdFByb3RvID0gT2JqZWN0LnByb3RvdHlwZTtcblxuLyoqIFVzZWQgdG8gcmVzb2x2ZSB0aGUgZGVjb21waWxlZCBzb3VyY2Ugb2YgZnVuY3Rpb25zLiAqL1xudmFyIGZuVG9TdHJpbmcgPSBGdW5jdGlvbi5wcm90b3R5cGUudG9TdHJpbmc7XG5cbi8qKiBVc2VkIHRvIGNoZWNrIG9iamVjdHMgZm9yIG93biBwcm9wZXJ0aWVzLiAqL1xudmFyIGhhc093blByb3BlcnR5ID0gb2JqZWN0UHJvdG8uaGFzT3duUHJvcGVydHk7XG5cbi8qKlxuICogVXNlZCB0byByZXNvbHZlIHRoZSBbYHRvU3RyaW5nVGFnYF0oaHR0cDovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNi4wLyNzZWMtb2JqZWN0LnByb3RvdHlwZS50b3N0cmluZylcbiAqIG9mIHZhbHVlcy5cbiAqL1xudmFyIG9ialRvU3RyaW5nID0gb2JqZWN0UHJvdG8udG9TdHJpbmc7XG5cbi8qKiBVc2VkIHRvIGRldGVjdCBpZiBhIG1ldGhvZCBpcyBuYXRpdmUuICovXG52YXIgcmVJc05hdGl2ZSA9IFJlZ0V4cCgnXicgK1xuICBmblRvU3RyaW5nLmNhbGwoaGFzT3duUHJvcGVydHkpLnJlcGxhY2UoL1tcXFxcXiQuKis/KClbXFxde318XS9nLCAnXFxcXCQmJylcbiAgLnJlcGxhY2UoL2hhc093blByb3BlcnR5fChmdW5jdGlvbikuKj8oPz1cXFxcXFwoKXwgZm9yIC4rPyg/PVxcXFxcXF0pL2csICckMS4qPycpICsgJyQnXG4pO1xuXG4vKiBOYXRpdmUgbWV0aG9kIHJlZmVyZW5jZXMgZm9yIHRob3NlIHdpdGggdGhlIHNhbWUgbmFtZSBhcyBvdGhlciBgbG9kYXNoYCBtZXRob2RzLiAqL1xudmFyIG5hdGl2ZUlzQXJyYXkgPSBnZXROYXRpdmUoQXJyYXksICdpc0FycmF5Jyk7XG5cbi8qKlxuICogVXNlZCBhcyB0aGUgW21heGltdW0gbGVuZ3RoXShodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi82LjAvI3NlYy1udW1iZXIubWF4X3NhZmVfaW50ZWdlcilcbiAqIG9mIGFuIGFycmF5LWxpa2UgdmFsdWUuXG4gKi9cbnZhciBNQVhfU0FGRV9JTlRFR0VSID0gOTAwNzE5OTI1NDc0MDk5MTtcblxuLyoqXG4gKiBHZXRzIHRoZSBuYXRpdmUgZnVuY3Rpb24gYXQgYGtleWAgb2YgYG9iamVjdGAuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBxdWVyeS5cbiAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgVGhlIGtleSBvZiB0aGUgbWV0aG9kIHRvIGdldC5cbiAqIEByZXR1cm5zIHsqfSBSZXR1cm5zIHRoZSBmdW5jdGlvbiBpZiBpdCdzIG5hdGl2ZSwgZWxzZSBgdW5kZWZpbmVkYC5cbiAqL1xuZnVuY3Rpb24gZ2V0TmF0aXZlKG9iamVjdCwga2V5KSB7XG4gIHZhciB2YWx1ZSA9IG9iamVjdCA9PSBudWxsID8gdW5kZWZpbmVkIDogb2JqZWN0W2tleV07XG4gIHJldHVybiBpc05hdGl2ZSh2YWx1ZSkgPyB2YWx1ZSA6IHVuZGVmaW5lZDtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIHZhbGlkIGFycmF5LWxpa2UgbGVuZ3RoLlxuICpcbiAqICoqTm90ZToqKiBUaGlzIGZ1bmN0aW9uIGlzIGJhc2VkIG9uIFtgVG9MZW5ndGhgXShodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi82LjAvI3NlYy10b2xlbmd0aCkuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSB2YWxpZCBsZW5ndGgsIGVsc2UgYGZhbHNlYC5cbiAqL1xuZnVuY3Rpb24gaXNMZW5ndGgodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PSAnbnVtYmVyJyAmJiB2YWx1ZSA+IC0xICYmIHZhbHVlICUgMSA9PSAwICYmIHZhbHVlIDw9IE1BWF9TQUZFX0lOVEVHRVI7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgY2xhc3NpZmllZCBhcyBhbiBgQXJyYXlgIG9iamVjdC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgY29ycmVjdGx5IGNsYXNzaWZpZWQsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc0FycmF5KFsxLCAyLCAzXSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc0FycmF5KGZ1bmN0aW9uKCkgeyByZXR1cm4gYXJndW1lbnRzOyB9KCkpO1xuICogLy8gPT4gZmFsc2VcbiAqL1xudmFyIGlzQXJyYXkgPSBuYXRpdmVJc0FycmF5IHx8IGZ1bmN0aW9uKHZhbHVlKSB7XG4gIHJldHVybiBpc09iamVjdExpa2UodmFsdWUpICYmIGlzTGVuZ3RoKHZhbHVlLmxlbmd0aCkgJiYgb2JqVG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT0gYXJyYXlUYWc7XG59O1xuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGNsYXNzaWZpZWQgYXMgYSBgRnVuY3Rpb25gIG9iamVjdC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgY29ycmVjdGx5IGNsYXNzaWZpZWQsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc0Z1bmN0aW9uKF8pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNGdW5jdGlvbigvYWJjLyk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKHZhbHVlKSB7XG4gIC8vIFRoZSB1c2Ugb2YgYE9iamVjdCN0b1N0cmluZ2AgYXZvaWRzIGlzc3VlcyB3aXRoIHRoZSBgdHlwZW9mYCBvcGVyYXRvclxuICAvLyBpbiBvbGRlciB2ZXJzaW9ucyBvZiBDaHJvbWUgYW5kIFNhZmFyaSB3aGljaCByZXR1cm4gJ2Z1bmN0aW9uJyBmb3IgcmVnZXhlc1xuICAvLyBhbmQgU2FmYXJpIDggZXF1aXZhbGVudHMgd2hpY2ggcmV0dXJuICdvYmplY3QnIGZvciB0eXBlZCBhcnJheSBjb25zdHJ1Y3RvcnMuXG4gIHJldHVybiBpc09iamVjdCh2YWx1ZSkgJiYgb2JqVG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT0gZnVuY1RhZztcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyB0aGUgW2xhbmd1YWdlIHR5cGVdKGh0dHBzOi8vZXM1LmdpdGh1Yi5pby8jeDgpIG9mIGBPYmplY3RgLlxuICogKGUuZy4gYXJyYXlzLCBmdW5jdGlvbnMsIG9iamVjdHMsIHJlZ2V4ZXMsIGBuZXcgTnVtYmVyKDApYCwgYW5kIGBuZXcgU3RyaW5nKCcnKWApXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGFuIG9iamVjdCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzT2JqZWN0KHt9KTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0KFsxLCAyLCAzXSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdCgxKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzT2JqZWN0KHZhbHVlKSB7XG4gIC8vIEF2b2lkIGEgVjggSklUIGJ1ZyBpbiBDaHJvbWUgMTktMjAuXG4gIC8vIFNlZSBodHRwczovL2NvZGUuZ29vZ2xlLmNvbS9wL3Y4L2lzc3Vlcy9kZXRhaWw/aWQ9MjI5MSBmb3IgbW9yZSBkZXRhaWxzLlxuICB2YXIgdHlwZSA9IHR5cGVvZiB2YWx1ZTtcbiAgcmV0dXJuICEhdmFsdWUgJiYgKHR5cGUgPT0gJ29iamVjdCcgfHwgdHlwZSA9PSAnZnVuY3Rpb24nKTtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIG5hdGl2ZSBmdW5jdGlvbi5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSBuYXRpdmUgZnVuY3Rpb24sIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc05hdGl2ZShBcnJheS5wcm90b3R5cGUucHVzaCk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc05hdGl2ZShfKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzTmF0aXZlKHZhbHVlKSB7XG4gIGlmICh2YWx1ZSA9PSBudWxsKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmIChpc0Z1bmN0aW9uKHZhbHVlKSkge1xuICAgIHJldHVybiByZUlzTmF0aXZlLnRlc3QoZm5Ub1N0cmluZy5jYWxsKHZhbHVlKSk7XG4gIH1cbiAgcmV0dXJuIGlzT2JqZWN0TGlrZSh2YWx1ZSkgJiYgcmVJc0hvc3RDdG9yLnRlc3QodmFsdWUpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGlzQXJyYXk7XG4iLCIvKmpzaGludCBub2RlOiB0cnVlKi9cblxuLyoqXG4gKiBAYXV0aG9yIGJyb2xsYiAvIGh0dHBzOi8vZ2l0aHViL2Jyb2xsYlxuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBBdXRvUm91dGVyID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyJyksXG4gICAgYXNzZXJ0ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlV0aWxzJykuYXNzZXJ0O1xuXG52YXIgQXV0b1JvdXRlckFjdGlvbkFwcGxpZXIgPSBmdW5jdGlvbiAoKSB7XG59O1xuXG5BdXRvUm91dGVyQWN0aW9uQXBwbGllci5BdXRvUm91dGVyID0gQXV0b1JvdXRlcjtcblxuQXV0b1JvdXRlckFjdGlvbkFwcGxpZXIucHJvdG90eXBlLmluaXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5fcG9ydFNlcGFyYXRvciA9IHRoaXMuX3BvcnRTZXBhcmF0b3IgfHwgJ194Xyc7XG4gICAgdGhpcy5hdXRvcm91dGVyID0gbmV3IEF1dG9Sb3V0ZXIoKTtcbiAgICB0aGlzLmRlYnVnQWN0aW9uU2VxdWVuY2UgPSAnWyc7XG4gICAgdGhpcy5fY2xlYXJSZWNvcmRzKCk7XG59O1xuXG5BdXRvUm91dGVyQWN0aW9uQXBwbGllci5wcm90b3R5cGUuX2NsZWFyUmVjb3JkcyA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLl9hdXRvcm91dGVyQm94ZXMgPSB7fTsgIC8vIERlZmluZSBjb250YWluZXIgdGhhdCB3aWxsIG1hcCBvYmorc3ViSUQgLT4gYm94XG4gICAgdGhpcy5fYXV0b3JvdXRlclBvcnRzID0ge307ICAvLyBNYXBzIGJveElkcyB0byBhbiBhcnJheSBvZiBwb3J0IGlkcyB0aGF0IGhhdmUgYmVlbiBtYXBwZWRcbiAgICB0aGlzLl9hdXRvcm91dGVyUGF0aHMgPSB7fTtcbiAgICB0aGlzLl9hclBhdGhJZDJPcmlnaW5hbCA9IHt9O1xufTtcblxuLyoqXG4gKiBSZXBsYWNlIGlkIHN0b3JlZCBhdCB0aGUgZ2l2ZW4gaW5kaWNlcyBvZiB0aGUgYXJyYXkgd2l0aCB0aGUgaXRlbSBmcm9tIHRoZSBkaWN0aW9uYXJ5LlxuICpcbiAqIEBwYXJhbSB7RGljdGlvbmFyeX0gZGljdGlvbmFyeVxuICogQHBhcmFtIHtBcnJheX0gYXJyYXlcbiAqIEBwYXJhbSB7QXJyYXk8TnVtYmVyPn0gaW5kaWNlc1xuICogQHJldHVybiB7dW5kZWZpbmVkfVxuICovXG5BdXRvUm91dGVyQWN0aW9uQXBwbGllci5wcm90b3R5cGUuX2xvb2t1cEl0ZW0gPSBmdW5jdGlvbiAoZGljdGlvbmFyeSwgYXJyYXksIGluZGljZXMpIHsgIC8vIGpzaGludCBpZ25vcmU6bGluZVxuICAgIHZhciBpbmRleCxcbiAgICAgICAgaWQ7XG5cbiAgICBmb3IgKHZhciBpID0gMjsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpbmRleCA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgaWQgPSBhcnJheVtpbmRleF07XG4gICAgICAgIGFycmF5W2luZGV4XSA9IGRpY3Rpb25hcnlbaWRdO1xuICAgIH1cbn07XG5cbi8vIEZJWE1FOiBVcGRhdGUgdGhpcyBtZXRob2QgZm9yIG5ldyBhcGlcbkF1dG9Sb3V0ZXJBY3Rpb25BcHBsaWVyLnByb3RvdHlwZS5fZml4QXJncyA9IGZ1bmN0aW9uIChjb21tYW5kLCBhcmdzKSB7XG4gICAgdmFyIGlkO1xuICAgIC8vIEZpeCBhcmdzLCBpZiBuZWVkZWRcbiAgICBzd2l0Y2ggKGNvbW1hbmQpIHtcbiAgICAgICAgY2FzZSAnbW92ZSc6ICAvLyBhcmdzWzBdIGlzIGlkIHNob3VsZCBiZSB0aGUgYm94XG4gICAgICAgICAgICB0aGlzLl9sb29rdXBJdGVtKHRoaXMuX2F1dG9yb3V0ZXJCb3hlcywgYXJncywgMCk7XG4gICAgICAgICAgICBhcmdzWzBdID0gYXJnc1swXS5ib3g7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICdnZXRQYXRoUG9pbnRzJzpcbiAgICAgICAgICAgIHRoaXMuX2xvb2t1cEl0ZW0odGhpcy5fYXV0b3JvdXRlclBhdGhzLCBhcmdzLCAwKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ3NldFBhdGhDdXN0b21Qb2ludHMnOlxuICAgICAgICAgICAgaWQgPSBhcmdzWzBdLnBhdGg7XG4gICAgICAgICAgICBhcmdzWzBdLnBhdGggPSB0aGlzLl9hdXRvcm91dGVyUGF0aHNbaWRdO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAnc2V0Qm94UmVjdCc6XG4gICAgICAgICAgICB0aGlzLl9sb29rdXBJdGVtKHRoaXMuX2F1dG9yb3V0ZXJCb3hlcywgYXJncywgMCk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICdnZXRCb3hSZWN0JzpcbiAgICAgICAgICAgIHRoaXMuX2xvb2t1cEl0ZW0odGhpcy5fYXV0b3JvdXRlckJveGVzLCBhcmdzLCAwKTtcbiAgICAgICAgICAgIGFyZ3NbMF0gPSBhcmdzWzBdLmJveC5pZDtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ3VwZGF0ZVBvcnQnOlxuICAgICAgICAgICAgdGhpcy5fbG9va3VwSXRlbSh0aGlzLl9hdXRvcm91dGVyQm94ZXMsIGFyZ3MsIDApO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAnc2V0Q29tcG9uZW50JzpcbiAgICAgICAgICAgIHRoaXMuX2xvb2t1cEl0ZW0odGhpcy5fYXV0b3JvdXRlckJveGVzLCBhcmdzLCAwLCAxKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ2FkZFBhdGgnOlxuICAgICAgICAgICAgdGhpcy5fZml4UG9ydEFyZ3MoYXJnc1swXS5zcmMsIGFyZ3NbMF0uZHN0KTtcbiAgICAgICAgICAgIGFyZ3MucG9wKCk7ICAvLyBSZW1vdmUgdGhlIGNvbm5lY3Rpb24gaWRcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ3JlbW92ZSc6XG4gICAgICAgICAgICB2YXIgaXRlbTtcblxuICAgICAgICAgICAgaWQgPSBhcmdzWzBdO1xuICAgICAgICAgICAgaWYgKHRoaXMuX2F1dG9yb3V0ZXJCb3hlc1tpZF0pIHtcbiAgICAgICAgICAgICAgICBpdGVtID0gdGhpcy5fYXV0b3JvdXRlckJveGVzW2lkXTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5fYXV0b3JvdXRlclBhdGhzW2lkXSkge1xuICAgICAgICAgICAgICAgIGl0ZW0gPSB0aGlzLl9hdXRvcm91dGVyUGF0aHNbaWRdOyAgLy8gSWYgb2JqSWQgaXMgYSBjb25uZWN0aW9uXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGFyZ3NbMF0gPSBpdGVtO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAnYWRkQm94JzpcbiAgICAgICAgICAgIGFyZ3MucG9wKCk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgYnJlYWs7XG4gICAgfVxuXG59O1xuXG5BdXRvUm91dGVyQWN0aW9uQXBwbGllci5wcm90b3R5cGUuX2ZpeFBvcnRBcmdzID0gZnVuY3Rpb24gKHBvcnQxLCBwb3J0MikgeyAvLyBqc2hpbnQgaWdub3JlOmxpbmVcbiAgICB2YXIgcG9ydElkLFxuICAgICAgICBwb3J0SWRzLFxuICAgICAgICBhclBvcnRJZCxcbiAgICAgICAgYm94SWQsXG4gICAgICAgIHBvcnRzO1xuXG4gICAgZm9yICh2YXIgaSA9IGFyZ3VtZW50cy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgcG9ydHMgPSBhcmd1bWVudHNbaV07XG4gICAgICAgIHBvcnRJZHMgPSBPYmplY3Qua2V5cyhwb3J0cyk7XG4gICAgICAgIGZvciAodmFyIGogPSBwb3J0SWRzLmxlbmd0aDsgai0tOykge1xuICAgICAgICAgICAgcG9ydElkID0gcG9ydElkc1tqXTtcbiAgICAgICAgICAgIGJveElkID0gcG9ydHNbcG9ydElkXTtcblxuICAgICAgICAgICAgYXJQb3J0SWQgPSB0aGlzLmF1dG9yb3V0ZXIuZ2V0UG9ydElkKHBvcnRJZCwgdGhpcy5fYXV0b3JvdXRlckJveGVzW2JveElkXSk7XG4gICAgICAgICAgICBwb3J0c1twb3J0SWRdID0gdGhpcy5fYXV0b3JvdXRlckJveGVzW2JveElkXS5wb3J0c1thclBvcnRJZF07XG4gICAgICAgICAgICBhc3NlcnQodGhpcy5fYXV0b3JvdXRlckJveGVzW2JveElkXS5wb3J0c1thclBvcnRJZF0sICdBUiBQb3J0IG5vdCBmb3VuZCEnKTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbi8qKlxuICogSW52b2tlIGFuIEF1dG9Sb3V0ZXIgbWV0aG9kLiBUaGlzIGFsbG93cyB0aGUgYWN0aW9uIHRvIGJlIGxvZ2dlZCBhbmQgYnVncyByZXBsaWNhdGVkLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBjb21tYW5kXG4gKiBAcGFyYW0ge0FycmF5fSBhcmdzXG4gKiBAcmV0dXJuIHt1bmRlZmluZWR9XG4gKi9cbkF1dG9Sb3V0ZXJBY3Rpb25BcHBsaWVyLnByb3RvdHlwZS5faW52b2tlQXV0b1JvdXRlck1ldGhvZCA9IGZ1bmN0aW9uIChjb21tYW5kLCBhcmdzKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ludm9rZUF1dG9Sb3V0ZXJNZXRob2RVbnNhZmUoY29tbWFuZCwgYXJncyk7XG5cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHRoaXMubG9nZ2VyLmVycm9yKCdBdXRvUm91dGVyLicgKyBjb21tYW5kICsgJyBmYWlsZWQgd2l0aCBlcnJvcjogJyArIGUpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJBY3Rpb25BcHBsaWVyLnByb3RvdHlwZS5faW52b2tlQXV0b1JvdXRlck1ldGhvZFVuc2FmZSA9IGZ1bmN0aW9uIChjb21tYW5kLCBhcmdzKSB7XG4gICAgdmFyIHJlc3VsdCxcbiAgICAgICAgb2xkQXJncyA9IGFyZ3Muc2xpY2UoKTtcblxuICAgIGlmICh0aGlzLl9yZWNvcmRBY3Rpb25zKSB7XG4gICAgICAgIHRoaXMuX3JlY29yZEFjdGlvbihjb21tYW5kLCBhcmdzLnNsaWNlKCkpO1xuICAgIH1cblxuICAgIC8vIFNvbWUgYXJndW1lbnRzIGFyZSBzaW1wbHkgaWRzIGZvciBlYXNpZXIgcmVjb3JkaW5nXG4gICAgdGhpcy5fZml4QXJncyhjb21tYW5kLCBhcmdzKTtcblxuICAgIHJlc3VsdCA9IHRoaXMuYXV0b3JvdXRlcltjb21tYW5kXS5hcHBseSh0aGlzLmF1dG9yb3V0ZXIsIGFyZ3MpO1xuICAgIHRoaXMuX3VwZGF0ZVJlY29yZHMoY29tbWFuZCwgb2xkQXJncywgcmVzdWx0KTtcbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxuQXV0b1JvdXRlckFjdGlvbkFwcGxpZXIucHJvdG90eXBlLl91cGRhdGVSZWNvcmRzID0gZnVuY3Rpb24gKGNvbW1hbmQsIGlucHV0LCByZXN1bHQpIHtcbiAgICBhc3NlcnQgKGlucHV0IGluc3RhbmNlb2YgQXJyYXkpO1xuICAgIHZhciBpZCxcbiAgICAgICAgYXJncyA9IGlucHV0LnNsaWNlKCksXG4gICAgICAgIGk7XG5cbiAgICBzd2l0Y2ggKGNvbW1hbmQpIHtcbiAgICAgICAgY2FzZSAnYWRkUGF0aCc6XG4gICAgICAgICAgICBpZCA9IGFyZ3MucG9wKCk7XG4gICAgICAgICAgICB0aGlzLl9hdXRvcm91dGVyUGF0aHNbaWRdID0gcmVzdWx0O1xuICAgICAgICAgICAgdGhpcy5fYXJQYXRoSWQyT3JpZ2luYWxbcmVzdWx0XSA9IGlkO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAnYWRkQm94JzpcbiAgICAgICAgICAgIGlkID0gYXJncy5wb3AoKTtcbiAgICAgICAgICAgIHRoaXMuX2F1dG9yb3V0ZXJCb3hlc1tpZF0gPSByZXN1bHQ7XG5cbiAgICAgICAgICAgIC8vIEFkZCBwb3J0c1xuICAgICAgICAgICAgdGhpcy5fYXV0b3JvdXRlclBvcnRzW2lkXSA9IFtdO1xuICAgICAgICAgICAgdmFyIGlkcyA9IE9iamVjdC5rZXlzKHJlc3VsdC5wb3J0cyk7XG4gICAgICAgICAgICBmb3IgKGkgPSBpZHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYXV0b3JvdXRlclBvcnRzW2lkXS5wdXNoKHJlc3VsdC5wb3J0c1tpZHNbaV1dKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ3JlbW92ZSc6XG4gICAgICAgICAgICBpZCA9IGFyZ3NbMF07XG4gICAgICAgICAgICBpZiAodGhpcy5fYXV0b3JvdXRlckJveGVzW2lkXSkge1xuICAgICAgICAgICAgICAgIGkgPSB0aGlzLl9hdXRvcm91dGVyUG9ydHNbaWRdID8gdGhpcy5fYXV0b3JvdXRlclBvcnRzW2lkXS5sZW5ndGggOiAwO1xuICAgICAgICAgICAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHBvcnRJZCA9IGlkICsgdGhpcy5fcG9ydFNlcGFyYXRvciArIHRoaXMuX2F1dG9yb3V0ZXJQb3J0c1tpZF1baV07IC8vSUQgb2YgY2hpbGQgcG9ydFxuICAgICAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5fYXV0b3JvdXRlckJveGVzW3BvcnRJZF07XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2F1dG9yb3V0ZXJCb3hlc1tpZF07XG4gICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2F1dG9yb3V0ZXJQb3J0c1tpZF07XG5cbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5fYXV0b3JvdXRlclBhdGhzW2lkXSkge1xuICAgICAgICAgICAgICAgIHZhciBhcklkID0gdGhpcy5fYXV0b3JvdXRlclBhdGhzW2lkXTtcbiAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5fYXV0b3JvdXRlclBhdGhzW2lkXTtcbiAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5fYXJQYXRoSWQyT3JpZ2luYWxbYXJJZF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICdzZXRDb21wb25lbnQnOlxuICAgICAgICAgICAgdmFyIGxlbixcbiAgICAgICAgICAgICAgICBzdWJDb21wSWQ7XG5cbiAgICAgICAgICAgIGlkID0gYXJnc1swXTtcbiAgICAgICAgICAgIGxlbiA9IGlkLmxlbmd0aCArIHRoaXMuX3BvcnRTZXBhcmF0b3IubGVuZ3RoO1xuICAgICAgICAgICAgc3ViQ29tcElkID0gYXJnc1sxXS5zdWJzdHJpbmcobGVuKTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuX2F1dG9yb3V0ZXJQb3J0c1tpZF0uaW5kZXhPZihzdWJDb21wSWQpID09PSAtMSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2F1dG9yb3V0ZXJQb3J0c1tpZF0ucHVzaChzdWJDb21wSWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAndXBkYXRlUG9ydCc6XG4gICAgICAgICAgICBpZCA9IGFyZ3NbMV0uaWQ7XG4gICAgICAgICAgICBicmVhaztcbiAgICB9XG59O1xuXG4vKipcbiAqIEFkZCB0aGUgZ2l2ZW4gYWN0aW9uIHRvIHRoZSBjdXJyZW50IHNlcXVlbmNlIG9mIGF1dG9yb3V0ZXIgY29tbWFuZHMuXG4gKlxuICogQHBhcmFtIG9iaklkXG4gKiBAcGFyYW0gc3ViQ29tcElkXG4gKiBAcmV0dXJuIHt1bmRlZmluZWR9XG4gKi9cbkF1dG9Sb3V0ZXJBY3Rpb25BcHBsaWVyLnByb3RvdHlwZS5fcmVjb3JkQWN0aW9uID0gZnVuY3Rpb24gKGNvbW1hbmQsIGFyZ3MpIHtcblxuICAgIHZhciBhY3Rpb24gPSB7YWN0aW9uOiBjb21tYW5kLCBhcmdzOiBhcmdzfSxcbiAgICAgICAgY2lyY3VsYXJGaXhlciA9IGZ1bmN0aW9uIChrZXksIHZhbHVlKSB7XG4gICAgICAgICAgICBpZiAodmFsdWUgJiYgdmFsdWUub3duZXIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWUuaWQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICAgICAgfTtcblxuICAgIHRoaXMuZGVidWdBY3Rpb25TZXF1ZW5jZSArPSBKU09OLnN0cmluZ2lmeShhY3Rpb24sIGNpcmN1bGFyRml4ZXIpICsgJywnO1xufTtcblxuQXV0b1JvdXRlckFjdGlvbkFwcGxpZXIucHJvdG90eXBlLl9nZXRBY3Rpb25TZXF1ZW5jZSA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgaW5kZXggPSB0aGlzLmRlYnVnQWN0aW9uU2VxdWVuY2UubGFzdEluZGV4T2YoJywnKSxcbiAgICAgICAgcmVzdWx0ID0gdGhpcy5kZWJ1Z0FjdGlvblNlcXVlbmNlLnN1YnN0cmluZygwLCBpbmRleCkgKyAnXSc7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBdXRvUm91dGVyQWN0aW9uQXBwbGllcjtcbiIsIi8qanNoaW50IG5vZGU6IHRydWUqL1xuXG4vKipcbiAqIEBhdXRob3IgYnJvbGxiIC8gaHR0cHM6Ly9naXRodWIvYnJvbGxiXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgQ09OU1RBTlRTID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLkNvbnN0YW50cycpLFxuICAgIFV0aWxzID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlV0aWxzJyksXG4gICAgYXNzZXJ0ID0gVXRpbHMuYXNzZXJ0LFxuICAgIEFyUG9pbnQgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUG9pbnQnKSxcbiAgICBBclJlY3QgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUmVjdCcpLFxuICAgIEF1dG9Sb3V0ZXJQb3J0ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlBvcnQnKTtcblxuXG52YXIgQXV0b1JvdXRlckJveCA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLm93bmVyID0gbnVsbDtcbiAgICB0aGlzLnJlY3QgPSBuZXcgQXJSZWN0KCk7XG4gICAgdGhpcy5hdG9taWMgPSBmYWxzZTtcbiAgICB0aGlzLnNlbGZQb2ludHMgPSBbXTtcbiAgICB0aGlzLnBvcnRzID0gW107XG4gICAgdGhpcy5jaGlsZEJveGVzID0gW107Ly9kZXBlbmRlbnQgYm94ZXNcbiAgICB0aGlzLnBhcmVudCA9IG51bGw7XG4gICAgdGhpcy5pZCA9IG51bGw7XG5cbiAgICB0aGlzLmNhbGN1bGF0ZVNlbGZQb2ludHMoKTsgLy9QYXJ0IG9mIGluaXRpYWxpemF0aW9uXG59O1xuXG5BdXRvUm91dGVyQm94LnByb3RvdHlwZS5jYWxjdWxhdGVTZWxmUG9pbnRzID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuc2VsZlBvaW50cyA9IFtdO1xuICAgIHRoaXMuc2VsZlBvaW50cy5wdXNoKG5ldyBBclBvaW50KHRoaXMucmVjdC5nZXRUb3BMZWZ0KCkpKTtcblxuICAgIHRoaXMuc2VsZlBvaW50cy5wdXNoKG5ldyBBclBvaW50KHRoaXMucmVjdC5yaWdodCwgdGhpcy5yZWN0LmNlaWwpKTtcbiAgICB0aGlzLnNlbGZQb2ludHMucHVzaChuZXcgQXJQb2ludCh0aGlzLnJlY3QucmlnaHQsIHRoaXMucmVjdC5mbG9vcikpO1xuICAgIHRoaXMuc2VsZlBvaW50cy5wdXNoKG5ldyBBclBvaW50KHRoaXMucmVjdC5sZWZ0LCB0aGlzLnJlY3QuZmxvb3IpKTtcbn07XG5cbkF1dG9Sb3V0ZXJCb3gucHJvdG90eXBlLmRlbGV0ZUFsbFBvcnRzID0gZnVuY3Rpb24gKCkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5wb3J0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICB0aGlzLnBvcnRzW2ldLmRlc3Ryb3koKTtcbiAgICB9XG5cbiAgICB0aGlzLnBvcnRzID0gW107XG5cbiAgICB0aGlzLmF0b21pYyA9IGZhbHNlO1xufTtcblxuQXV0b1JvdXRlckJveC5wcm90b3R5cGUuaGFzT3duZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMub3duZXIgIT09IG51bGw7XG59O1xuXG4vLyBUT0RPOiBSZW1vdmUgdGhpcyBmdW5jdGlvblxuQXV0b1JvdXRlckJveC5wcm90b3R5cGUuY3JlYXRlUG9ydCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgcG9ydCA9IG5ldyBBdXRvUm91dGVyUG9ydCgpO1xuICAgIGFzc2VydChwb3J0ICE9PSBudWxsLCAnQVJCb3guY3JlYXRlUG9ydDogcG9ydCAhPT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIHJldHVybiBwb3J0O1xufTtcblxuQXV0b1JvdXRlckJveC5wcm90b3R5cGUuaGFzTm9Qb3J0ID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLnBvcnRzLmxlbmd0aCA9PT0gMDtcbn07XG5cbkF1dG9Sb3V0ZXJCb3gucHJvdG90eXBlLmlzQXRvbWljID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmF0b21pYztcbn07XG5cbkF1dG9Sb3V0ZXJCb3gucHJvdG90eXBlLmFkZFBvcnQgPSBmdW5jdGlvbiAocG9ydCkge1xuICAgIGFzc2VydChwb3J0ICE9PSBudWxsLCAnQVJCb3guYWRkUG9ydDogcG9ydCAhPT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIHBvcnQub3duZXIgPSB0aGlzO1xuICAgIHRoaXMucG9ydHMucHVzaChwb3J0KTtcblxuICAgIGlmICh0aGlzLm93bmVyKSB7ICAvLyBOb3QgcG9pbnRpbmcgdG8gdGhlIEFSR3JhcGhcbiAgICAgICAgdGhpcy5vd25lci5fYWRkRWRnZXMocG9ydCk7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckJveC5wcm90b3R5cGUuZGVsZXRlUG9ydCA9IGZ1bmN0aW9uIChwb3J0KSB7XG4gICAgYXNzZXJ0KHBvcnQgIT09IG51bGwsICdBUkJveC5kZWxldGVQb3J0OiBwb3J0ICE9PSBudWxsIEZBSUxFRCcpO1xuICAgIGlmIChwb3J0ID09PSBudWxsKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgaW5kZXggPSB0aGlzLnBvcnRzLmluZGV4T2YocG9ydCksXG4gICAgICAgIGdyYXBoID0gdGhpcy5vd25lcjtcblxuICAgIGFzc2VydChpbmRleCAhPT0gLTEsICdBUkJveC5kZWxldGVQb3J0OiBpbmRleCAhPT0gLTEgRkFJTEVEJyk7XG5cbiAgICBncmFwaC5kZWxldGVFZGdlcyhwb3J0KTtcbiAgICB0aGlzLnBvcnRzLnNwbGljZShpbmRleCwgMSk7XG5cbiAgICB0aGlzLmF0b21pYyA9IGZhbHNlO1xuXG59O1xuXG5BdXRvUm91dGVyQm94LnByb3RvdHlwZS5pc1JlY3RFbXB0eSA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5yZWN0LmlzUmVjdEVtcHR5KCk7XG59O1xuXG5BdXRvUm91dGVyQm94LnByb3RvdHlwZS5zZXRSZWN0ID0gZnVuY3Rpb24gKHIpIHtcbiAgICBhc3NlcnQociBpbnN0YW5jZW9mIEFyUmVjdCwgJ0ludmFsdGhpcy5pZCBhcmcgaW4gQVJCb3guc2V0UmVjdC4gUmVxdWlyZXMgQXJSZWN0Jyk7XG5cbiAgICBhc3NlcnQoci5nZXRXaWR0aCgpID49IDMgJiYgci5nZXRIZWlnaHQoKSA+PSAzLFxuICAgICAgICAnQVJCb3guc2V0UmVjdDogci5nZXRXaWR0aCgpID49IDMgJiYgci5nZXRIZWlnaHQoKSA+PSAzIEZBSUxFRCEnKTtcblxuICAgIGFzc2VydChyLmdldFRvcExlZnQoKS54ID49IENPTlNUQU5UUy5FRF9NSU5DT09SRCAmJiByLmdldFRvcExlZnQoKS55ID49IENPTlNUQU5UUy5FRF9NSU5DT09SRCxcbiAgICAgICAgJ0FSQm94LnNldFJlY3Q6IHIuZ2V0VG9wTGVmdCgpLnggPj0gQ09OU1RBTlRTLkVEX01JTkNPT1JEICYmIHIuZ2V0VG9wTGVmdCgpLnkgPj0gJyArXG4gICAgICAgICdDT05TVEFOVFMuRURfTUFYQ09PUkQgRkFJTEVEIScpO1xuXG4gICAgYXNzZXJ0KHIuZ2V0Qm90dG9tUmlnaHQoKS54IDw9IENPTlNUQU5UUy5FRF9NQVhDT09SRCAmJiByLmdldEJvdHRvbVJpZ2h0KCkueSA8PSBDT05TVEFOVFMuRURfTUFYQ09PUkQsXG4gICAgICAgICdBUkJveC5zZXRSZWN0OiAgci5nZXRCb3R0b21SaWdodCgpLnggPD0gQ09OU1RBTlRTLkVEX01BWENPT1JEICYmIHIuZ2V0Qm90dG9tUmlnaHQoKS55IDw9ICcgK1xuICAgICAgICAnQ09OU1RBTlRTLkVEX01BWENPT1JEIEZBSUxFRCEnKTtcblxuICAgIHRoaXMucmVjdC5hc3NpZ24ocik7XG4gICAgdGhpcy5jYWxjdWxhdGVTZWxmUG9pbnRzKCk7XG5cbiAgICBpZiAodGhpcy5hdG9taWMpIHtcbiAgICAgICAgYXNzZXJ0KHRoaXMucG9ydHMubGVuZ3RoID09PSAxLCAnQVJCb3guc2V0UmVjdDogdGhpcy5wb3J0cy5sZW5ndGggPT09IDEgRkFJTEVEIScpO1xuICAgICAgICB0aGlzLnBvcnRzWzBdLnNldFJlY3Qocik7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckJveC5wcm90b3R5cGUuc2hpZnRCeSA9IGZ1bmN0aW9uIChvZmZzZXQpIHtcbiAgICB0aGlzLnJlY3QuYWRkKG9mZnNldCk7XG5cbiAgICB2YXIgaSA9IHRoaXMucG9ydHMubGVuZ3RoO1xuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgdGhpcy5wb3J0c1tpXS5zaGlmdEJ5KG9mZnNldCk7XG4gICAgfVxuXG4gICAgLypcbiAgICAgVGhpcyBpcyBub3QgbmVjZXNzYXJ5OyB0aGUgQVJHcmFwaCB3aWxsIHNoaWZ0IGFsbCBjaGlsZHJlblxuICAgICBpID0gdGhpcy5jaGlsZEJveGVzLmxlbmd0aDtcbiAgICAgd2hpbGUoaS0tKXtcbiAgICAgdGhpcy5jaGlsZEJveGVzW2ldLnNoaWZ0Qnkob2Zmc2V0KTtcbiAgICAgfVxuICAgICAqL1xuICAgIHRoaXMuY2FsY3VsYXRlU2VsZlBvaW50cygpO1xufTtcblxuQXV0b1JvdXRlckJveC5wcm90b3R5cGUucmVzZXRQb3J0QXZhaWxhYmlsaXR5ID0gZnVuY3Rpb24gKCkge1xuICAgIGZvciAodmFyIGkgPSB0aGlzLnBvcnRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICB0aGlzLnBvcnRzW2ldLnJlc2V0QXZhaWxhYmxlQXJlYSgpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJCb3gucHJvdG90eXBlLmFkanVzdFBvcnRBdmFpbGFiaWxpdHkgPSBmdW5jdGlvbiAoYm94KSB7XG4gICAgaWYgKCFib3guaGFzQW5jZXN0b3JXaXRoSWQodGhpcy5pZCkgJiYgICAvLyBCb3hlcyBhcmUgbm90IGRlcGVuZGVudCBvbiBvbmUgYW5vdGhlclxuICAgICAgICAhdGhpcy5oYXNBbmNlc3RvcldpdGhJZChib3guaWQpKSB7XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IHRoaXMucG9ydHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgICAgICB0aGlzLnBvcnRzW2ldLmFkanVzdEF2YWlsYWJsZUFyZWEoYm94LnJlY3QpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckJveC5wcm90b3R5cGUuYWRkQ2hpbGQgPSBmdW5jdGlvbiAoYm94KSB7XG4gICAgYXNzZXJ0KHRoaXMuY2hpbGRCb3hlcy5pbmRleE9mKGJveCkgPT09IC0xLFxuICAgICAgICAnQVJCb3guYWRkQ2hpbGQ6IGJveCBhbHJlYWR5IGlzIGNoaWxkIG9mICcgKyB0aGlzLmlkKTtcbiAgICBhc3NlcnQoYm94IGluc3RhbmNlb2YgQXV0b1JvdXRlckJveCxcbiAgICAgICAgJ0NoaWxkIGJveCBtdXN0IGJlIG9mIHR5cGUgQXV0b1JvdXRlckJveCcpO1xuXG4gICAgdGhpcy5jaGlsZEJveGVzLnB1c2goYm94KTtcbiAgICBib3gucGFyZW50ID0gdGhpcztcbn07XG5cbkF1dG9Sb3V0ZXJCb3gucHJvdG90eXBlLnJlbW92ZUNoaWxkID0gZnVuY3Rpb24gKGJveCkge1xuICAgIHZhciBpID0gdGhpcy5jaGlsZEJveGVzLmluZGV4T2YoYm94KTtcbiAgICBhc3NlcnQoaSAhPT0gLTEsICdBUkJveC5yZW1vdmVDaGlsZDogYm94IGlzblxcJ3QgY2hpbGQgb2YgJyArIHRoaXMuaWQpO1xuICAgIHRoaXMuY2hpbGRCb3hlcy5zcGxpY2UoaSwgMSk7XG4gICAgYm94LnBhcmVudCA9IG51bGw7XG59O1xuXG5BdXRvUm91dGVyQm94LnByb3RvdHlwZS5oYXNBbmNlc3RvcldpdGhJZCA9IGZ1bmN0aW9uIChpZCkge1xuICAgIHZhciBib3ggPSB0aGlzO1xuICAgIHdoaWxlIChib3gpIHtcbiAgICAgICAgaWYgKGJveC5pZCA9PT0gaWQpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGJveCA9IGJveC5wYXJlbnQ7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbn07XG5cbkF1dG9Sb3V0ZXJCb3gucHJvdG90eXBlLmdldFJvb3RCb3ggPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGJveCA9IHRoaXM7XG4gICAgd2hpbGUgKGJveC5wYXJlbnQpIHtcbiAgICAgICAgYm94ID0gYm94LnBhcmVudDtcbiAgICB9XG4gICAgcmV0dXJuIGJveDtcbn07XG5cbkF1dG9Sb3V0ZXJCb3gucHJvdG90eXBlLmlzQm94QXQgPSBmdW5jdGlvbiAocG9pbnQsIG5lYXJuZXNzKSB7XG4gICAgcmV0dXJuIFV0aWxzLmlzUG9pbnRJbihwb2ludCwgdGhpcy5yZWN0LCBuZWFybmVzcyk7XG59O1xuXG5BdXRvUm91dGVyQm94LnByb3RvdHlwZS5pc0JveENsaXAgPSBmdW5jdGlvbiAocikge1xuICAgIHJldHVybiBVdGlscy5pc1JlY3RDbGlwKHRoaXMucmVjdCwgcik7XG59O1xuXG5BdXRvUm91dGVyQm94LnByb3RvdHlwZS5pc0JveEluID0gZnVuY3Rpb24gKHIpIHtcbiAgICByZXR1cm4gVXRpbHMuaXNSZWN0SW4odGhpcy5yZWN0LCByKTtcbn07XG5cbkF1dG9Sb3V0ZXJCb3gucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGkgPSB0aGlzLmNoaWxkQm94ZXMubGVuZ3RoO1xuXG4gICAgLy9ub3RpZnkgdGhpcy5wYXJlbnQgb2YgZGVzdHJ1Y3Rpb25cbiAgICAvL2lmIHRoZXJlIGlzIGEgdGhpcy5wYXJlbnQsIG9mIGNvdXJzZVxuICAgIGlmICh0aGlzLnBhcmVudCkge1xuICAgICAgICB0aGlzLnBhcmVudC5yZW1vdmVDaGlsZCh0aGlzKTtcbiAgICB9XG5cbiAgICB0aGlzLm93bmVyID0gbnVsbDtcbiAgICB0aGlzLmRlbGV0ZUFsbFBvcnRzKCk7XG5cbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgIHRoaXMuY2hpbGRCb3hlc1tpXS5kZXN0cm95KCk7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckJveC5wcm90b3R5cGUuYXNzZXJ0VmFsaWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgZm9yICh2YXIgcCA9IHRoaXMucG9ydHMubGVuZ3RoOyBwLS07KSB7XG4gICAgICAgIHRoaXMucG9ydHNbcF0uYXNzZXJ0VmFsaWQoKTtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEF1dG9Sb3V0ZXJCb3g7XG4iLCIvKmpzaGludCBub2RlOiB0cnVlLCBiaXR3aXNlOiBmYWxzZSovXG5cbi8qKlxuICogQGF1dGhvciBicm9sbGIgLyBodHRwczovL2dpdGh1Yi9icm9sbGJcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG52YXIgQXJQb2ludCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Qb2ludCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBFTVBUWV9QT0lOVDogbmV3IEFyUG9pbnQoLTEwMDAwMCwgLTEwMDAwMCksXG4gICAgRURfTUFYQ09PUkQ6IDEwMDAwMCxcbiAgICBFRF9NSU5DT09SRDogLTIsLy9UaGlzIGFsbG93cyBjb25uZWN0aW9ucyB0byBiZSBzdGlsbCBiZSBkcmF3IHdoZW4gYm94IGlzIHByZXNzZWQgYWdhaW5zdCB0aGUgZWRnZVxuICAgIEVEX1NNQUxMR0FQOiAxNSxcbiAgICBDT05ORUNUSU9OQ1VTVE9NSVpBVElPTkRBVEFWRVJTSU9OOiAwLFxuICAgIEVNUFRZQ09OTkVDVElPTkNVU1RPTUlaQVRJT05EQVRBTUFHSUM6IC0xLFxuICAgIERFQlVHOiBmYWxzZSxcbiAgICBCVUZGRVI6IDEwLFxuXG4gICAgRURMU19TOiAxNSwvL0VEX1NNQUxMR0FQXG4gICAgRURMU19SOiAxNSArIDEsIC8vRURfU01BTExHQVArMVxuICAgIEVETFNfRDogMTAwMDAwICsgMiwvL0VEX01BWENPT1JEIC0gRURfTUlOQ09PUkQsXG5cbiAgICBQYXRoRW5kT25EZWZhdWx0OiAweDAwMDAsXG4gICAgUGF0aEVuZE9uVG9wOiAweDAwMTAsXG4gICAgUGF0aEVuZE9uUmlnaHQ6IDB4MDAyMCxcbiAgICBQYXRoRW5kT25Cb3R0b206IDB4MDA0MCxcbiAgICBQYXRoRW5kT25MZWZ0OiAweDAwODAsXG4gICAgUGF0aEVuZE1hc2s6ICgweDAwMTAgfCAweDAwMjAgfCAweDAwNDAgfCAweDAwODApLFxuICAgIC8vIChQYXRoRW5kT25Ub3AgfCBQYXRoRW5kT25SaWdodCB8IFBhdGhFbmRPbkJvdHRvbSB8IFBhdGhFbmRPbkxlZnQpLFxuXG4gICAgUGF0aFN0YXJ0T25EZWZhdWx0OiAweDAwMDAsXG4gICAgUGF0aFN0YXJ0T25Ub3A6IDB4MDEwMCxcbiAgICBQYXRoU3RhcnRPblJpZ2h0OiAweDAyMDAsXG4gICAgUGF0aFN0YXJ0T25Cb3R0b206IDB4MDQwMCxcbiAgICBQYXRoU3RhcnRPbkxlZnQ6IDB4MDgwMCxcbiAgICBQYXRoU3RhcnRNYXNrOiAoMHgwMTAwIHwgMHgwMjAwIHwgMHgwNDAwIHwgMHgwODAwKSxcbiAgICAvLyAoUGF0aFN0YXJ0T25Ub3AgfCBQYXRoU3RhcnRPblJpZ2h0IHwgUGF0aFN0YXJ0T25Cb3R0b20gfCBQYXRoU3RhcnRPbkxlZnQpLFxuXG4gICAgUGF0aEhpZ2hMaWdodGVkOiAweDAwMDIsXHRcdC8vIGF0dHJpYnV0ZXMsXG4gICAgUGF0aEZpeGVkOiAweDAwMDEsXG4gICAgUGF0aERlZmF1bHQ6IDB4MDAwMCxcblxuICAgIFBhdGhTdGF0ZUNvbm5lY3RlZDogMHgwMDAxLFx0XHQvLyBzdGF0ZXMsXG4gICAgUGF0aFN0YXRlRGVmYXVsdDogMHgwMDAwLFxuXG4gICAgLy8gUG9ydCBDb25uZWN0aW9uIFZhcmlhYmxlc1xuICAgIFBvcnRFbmRPblRvcDogMHgwMDAxLFxuICAgIFBvcnRFbmRPblJpZ2h0OiAweDAwMDIsXG4gICAgUG9ydEVuZE9uQm90dG9tOiAweDAwMDQsXG4gICAgUG9ydEVuZE9uTGVmdDogMHgwMDA4LFxuICAgIFBvcnRFbmRPbkFsbDogMHgwMDBGLFxuXG4gICAgUG9ydFN0YXJ0T25Ub3A6IDB4MDAxMCxcbiAgICBQb3J0U3RhcnRPblJpZ2h0OiAweDAwMjAsXG4gICAgUG9ydFN0YXJ0T25Cb3R0b206IDB4MDA0MCxcbiAgICBQb3J0U3RhcnRPbkxlZnQ6IDB4MDA4MCxcbiAgICBQb3J0U3RhcnRPbkFsbDogMHgwMEYwLFxuXG4gICAgUG9ydENvbm5lY3RPbkFsbDogMHgwMEZGLFxuICAgIFBvcnRDb25uZWN0VG9DZW50ZXI6IDB4MDEwMCxcblxuICAgIFBvcnRTdGFydEVuZEhvcml6b250YWw6IDB4MDBBQSxcbiAgICBQb3J0U3RhcnRFbmRWZXJ0aWNhbDogMHgwMDU1LFxuXG4gICAgUG9ydERlZmF1bHQ6IDB4MDBGRixcblxuICAgIC8vIFJvdXRpbmdEaXJlY3Rpb24gdmFycyBcbiAgICBEaXJOb25lOiAtMSxcbiAgICBEaXJUb3A6IDAsXG4gICAgRGlyUmlnaHQ6IDEsXG4gICAgRGlyQm90dG9tOiAyLFxuICAgIERpckxlZnQ6IDMsXG4gICAgRGlyU2tldzogNCxcblxuICAgIC8vUGF0aCBDdXN0b20gRGF0YVxuICAgIFNpbXBsZUVkZ2VEaXNwbGFjZW1lbnQ6ICdFZGdlRGlzcGxhY2VtZW50JyxcbiAgICBDdXN0b21Qb2ludEN1c3RvbWl6YXRpb246ICdQb2ludEN1c3RvbWl6YXRpb24nXG4gICAgLy9DT05ORUNUSU9OQ1VTVE9NSVpBVElPTkRBVEFWRVJTSU9OIDogbnVsbFxufTtcbiIsIi8qZ2xvYmFscyBkZWZpbmUqL1xuLypqc2hpbnQgbm9kZTogdHJ1ZSovXG5cbi8qKlxuICogQGF1dGhvciBicm9sbGIgLyBodHRwczovL2dpdGh1Yi9icm9sbGJcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBDT05TVEFOVFMgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuQ29uc3RhbnRzJyksXG4gICAgVXRpbHMgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuVXRpbHMnKSxcbiAgICBhc3NlcnQgPSBVdGlscy5hc3NlcnQsXG4gICAgQXJQb2ludCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Qb2ludCcpO1xuXG52YXIgQXV0b1JvdXRlckVkZ2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgLypcbiAgICAgSW4gdGhpcyBzZWN0aW9uIGV2ZXJ5IGNvbW1lbnQgcmVmZXIgdG8gdGhlIGhvcml6b250YWwgY2FzZSwgdGhhdCBpcywgZWFjaFx0ZWRnZSBpc1xuICAgICBob3Jpem9udGFsLlxuICAgICAqL1xuXG4gICAgLypcbiAgICAgKiBUT0RPIFVwZGF0ZSB0aGlzIGNvbW1lbnRcbiAgICAgKlxuICAgICBFdmVyeSBDQXV0b1JvdXRlckVkZ2UgYmVsb25ncyB0byBhbiBlZGdlIG9mIGEgQ0F1dG9Sb3V0ZXJQYXRoLCBDQXV0b1JvdXRlckJveCBvciBDQXV0b1JvdXRlclBvcnQuIFRoaXMgZWRnZSBpc1xuICAgICBSZXByZXNlbnRlZCBieSBhIENBdXRvUm91dGVyUG9pbnQgd2l0aCBpdHMgbmV4dCBwb2ludC4gVGhlIHZhcmlhYmxlICdwb2ludCcgd2lsbCByZWZlclxuICAgICB0byB0aGlzIENBdXRvUm91dGVyUG9pbnQuXG5cbiAgICAgVGhlIGNvb3JkaW5hdGVzIG9mIGFuIGVkZ2UgYXJlICd4MScsICd4MicgYW5kICd5JyB3aGVyZSB4MS94MiBpcyB0aGUgeC1jb29yZGluYXRlXG4gICAgIG9mIHRoZSBsZWZ0L3JpZ2h0IHBvaW50LCBhbmQgeSBpcyB0aGUgY29tbW9uIHktY29vcmRpbmF0ZSBvZiB0aGUgcG9pbnRzLlxuXG4gICAgIFRoZSBlZGdlcyBhcmUgb3JkZXJlZCBhY2NvcmRpbmcgdG8gdGhlaXIgeS1jb29yZGluYXRlcy4gVGhlIGZpcnN0IGVkZ2UgaGFzXG4gICAgIHRoZSBsZWFzdCB5LWNvb3JkaW5hdGUgKHRvcG1vc3QpLCBhbmQgaXRzIHBvaW50ZXIgaXMgaW4gJ29yZGVyRmlyc3QnLlxuICAgICBXZSB1c2UgdGhlICdvcmRlcicgcHJlZml4IGluIHRoZSB2YXJpYWJsZSBuYW1lcyB0byByZWZlciB0byB0aGlzIG9yZGVyLlxuXG4gICAgIFdlIHdpbGwgd2FsayBmcm9tIHRvcCB0byBib3R0b20gKGZyb20gdGhlICdvcmRlckZpcnN0JyBhbG9uZyB0aGUgJ3RoaXMub3JkZXJOZXh0JykuXG4gICAgIFdlIGtlZXAgdHJhY2sgYSAnc2VjdGlvbicgb2Ygc29tZSBlZGdlcy4gSWYgd2UgaGF2ZSBhbiBpbmZpbml0ZSBob3Jpem9udGFsIGxpbmUsXG4gICAgIHRoZW4gdGhlIHNlY3Rpb24gY29uc2lzdHMgb2YgdGhvc2UgZWRnZXMgdGhhdCBhcmUgYWJvdmUgdGhlIGxpbmUgYW5kIG5vdCBibG9ja2VkXG4gICAgIGJ5IGFub3RoZXIgZWRnZSB3aGljaCBpcyBjbG9zZXIgdG8gdGhlIGxpbmUuIEVhY2ggZWRnZSBpbiB0aGUgc2VjdGlvbiBoYXNcbiAgICAgYSB2aWV3YWJsZSBwb3J0aW9uIGZyb20gdGhlIGxpbmUgKHRoZSBub3QgYmxvY2tlZCBwb3J0aW9uKS4gVGhlIGNvb3JkaW5hdGVzXG4gICAgIG9mIHRoaXMgcG9ydGlvbiBhcmUgJ3RoaXMuc2VjdGlvblgxJyBhbmQgJ3RoaXMuc2VjdGlvblgyJy4gV2UgaGF2ZSBhbiBvcmRlciBvZiB0aGUgZWRnZXNcbiAgICAgYmVsb25naW5nIHRvIHRoZSBjdXJyZW50IHNlY3Rpb24uIFRoZSAnc2VjdGlvbl9maXJzdCcgcmVmZXJzIHRvIHRoZSBsZWZ0bW9zdFxuICAgICBlZGdlIGluIHRoZSBzZWN0aW9uLCB3aGlsZSB0aGUgJ3RoaXMuc2VjdGlvbk5leHQnIHRvIHRoZSBuZXh0IGZyb20gbGVmdCB0byByaWdodC5cblxuICAgICBXZSBzYXkgdGhhdCB0aGUgQ0F1dG9Sb3V0ZXJFZGdlIEUxICdwcmVjZWRlJyB0aGUgQ0F1dG9Sb3V0ZXJFZGdlIEUyIGlmIHRoZXJlIGlzIG5vIG90aGVyIENBdXRvUm91dGVyRWRnZSB3aGljaFxuICAgICB0b3RhbGx5XHRibG9ja3MgUzEgZnJvbSBTMi4gU28gYSBzZWN0aW9uIGNvbnNpc3RzIG9mIHRoZSBwcmVjZWRpbmcgZWRnZXMgb2YgYW5cbiAgICAgaW5maW5pdGUgZWRnZS4gV2Ugc2F5IHRoYXQgRTEgaXMgJ2FkamFjZW50JyB0byBFMiwgaWYgRTEgaXMgdGhlIG5lYXJlc3QgZWRnZVxuICAgICB0byBFMiB3aGljaCBwcmVjZWRlIGl0LiBDbGVhcmx5LCBldmVyeSBlZGdlIGhhcyBhdCBtb3N0IG9uZSBhZGphY2VudCBwcmVjZWRlbmNlLlxuXG4gICAgIFRoZSBlZGdlcyBvZiBhbnkgQ0F1dG9Sb3V0ZXJCb3ggb3IgQ0F1dG9Sb3V0ZXJQb3J0IGFyZSBmaXhlZC4gV2Ugd2lsbCBjb250aW51YWxseSBmaXggdGhlIGVkZ2VzXG4gICAgIG9mIHRoZSBDQXV0b1JvdXRlclBhdGhzLiBCdXQgZmlyc3Qgd2UgbmVlZCBzb21lIGRlZmluaXRpb24uXG5cbiAgICAgV2UgY2FsbCBhIHNldCBvZiBlZGdlcyBhcyBhICdibG9jaycgaWYgdGhlIHRvcG1vc3QgKGZpcnN0KSBhbmQgYm90dG9tbW9zdCAobGFzdClcbiAgICAgZWRnZXMgb2YgaXQgYXJlIGZpeGVkIHdoaWxlIHRoZSBlZGdlcyBiZXR3ZWVuIHRoZW0gYXJlIG5vdC4gRnVydGhlcm1vcmUsIGV2ZXJ5XG4gICAgIGVkZ2UgaXMgYWRqYWNlbnQgdG9cdHRoZSBuZXh0IG9uZSBpbiB0aGUgb3JkZXIuIEV2ZXJ5IGVkZ2UgaW4gdGhlIGJsb2NrIGhhcyBhblxuICAgICAnaW5kZXgnLiBUaGUgaW5kZXggb2YgdGhlIGZpcnN0IG9uZSAodG9wbW9zdCkgaXMgMCwgb2YgdGhlIHNlY29uZCBpcyAxLCBhbmQgc28gb24uXG4gICAgIFdlIGNhbGwgdGhlIGluZGV4IG9mIHRoZSBsYXN0IGVkZ2UgKCMgb2YgZWRnZXMgLSAxKSBhcyB0aGUgaW5kZXggb2YgdGhlIGVudGlyZSBib3guXG4gICAgIFRoZSAnZGVwdGgnIG9mIGEgYmxvY2sgaXMgdGhlIGRpZmZlcmVuY2Ugb2YgdGhlIHktY29vcmRpbmF0ZXMgb2YgdGhlIGZpcnN0IGFuZCBsYXN0XG4gICAgIGVkZ2VzIG9mIGl0LiBUaGUgJ2dvYWwgZ2FwJyBvZiB0aGUgYmxvY2sgaXMgdGhlIHF1b3RpZW50IG9mIHRoZSBkZXB0aCBhbmQgaW5kZXhcbiAgICAgb2YgdGhlIGJsb2NrLiBJZiB0aGUgZGlmZmVyZW5jZSBvZiB0aGUgeS1jb29yZGluYXRlcyBvZiB0aGUgYWRqYWNlbnQgZWRnZXMgaW5cbiAgICAgdGhlIGJsb2NrIGFyZSBhbGwgZXF1YWwgdG8gdGhlIGdvYWwgZ2FwLCB0aGVuIHdlIHNheSB0aGF0IHRoZSBibG9jayBpcyBldmVubHlcbiAgICAgZGlzdHJpYnV0ZWQuXG5cbiAgICAgU28gd2Ugc2VhcmNoIHRoZSBibG9jayB3aGljaCBoYXMgbWluaW1hbCBnb2FsIGdhcC4gVGhlbiBpZiBpdCBpcyBub3QgZXZlbmx5XG4gICAgIGRpc3RyaWJ1dGVkLCB0aGVuIHdlIHNoaWZ0IHRoZSBub3QgZml4ZWQgZWRnZXMgdG8gdGhlIGRlc2lyZWQgcG9zaXRpb24uIEl0IGlzXG4gICAgIG5vdCBoYXJkIHRvIHNlZVx0dGhhdCBpZiB0aGUgYmxvY2sgaGFzIG1pbmltYWwgZ29hbCBnYXAgKGFtb25nIHRoZSBhbGxcbiAgICAgcG9zc2liaWxpdGllcyBvZiBibG9ja3MpLCB0aGVuIGluIHRoaXMgd2F5IHdlIGRvIG5vdCBtb3ZlIGFueSBlZGdlcyBpbnRvIGJveGVzLlxuICAgICBGaW5hbGx5LCB3ZSBzZXQgdGhlIChpbm5lcikgZWRnZXMgb2YgdGhlIGJsb2NrIHRvIGJlIGZpeGVkIChleGNlcHQgdGhlIHRvcG1vc3QgYW5kXG4gICAgIGJvdHRvbW1vc3QgZWRnZXMsIHNpbmNlIHRoZXkgYXJlIGFscmVhZHkgZml4ZWQpLiBBbmQgd2UgYWdhaW4gYmVnaW4gdGhlIHNlYXJjaC5cbiAgICAgSWYgZXZlcnkgZWRnZSBpcyBmaXhlZCwgdGhlbiB3ZSBoYXZlIGZpbmlzaGVkLiBUaGlzIGlzIHRoZSBiYXNpYyBpZGVhLiBXZSB3aWxsXG4gICAgIHJlZmluZSB0aGlzIGFsZ29yaXRobS5cblxuICAgICBUaGUgdmFyaWFibGVzIHJlbGF0ZWQgdG8gdGhlIGJsb2NrcyBhcmUgcHJlZml4ZWQgYnkgJ2Jsb2NrJy4gTm90ZSB0aGF0IHRoZVxuICAgICB2YXJpYWJsZXMgb2YgYW4gZWRnZSBhcmUgcmVmZXIgdG8gdGhhdCBibG9jayBpbiB3aGljaCB0aGlzIGVkZ2UgaXMgaW5uZXIhIFRoZVxuICAgICAnYmxvY2tfb2xkZ2FwJyBpcyB0aGUgZ29hbCBnYXAgb2YgdGhlIGJsb2NrIHdoZW4gaXQgd2FzIGxhc3QgZXZlbmx5IGRpc3RyaWJ1dGVkLlxuXG4gICAgIFRoZSB2YXJpYWJsZXMgJ2NhbnN0YXJ0JyBhbmQgJ2NhbmVuZCcgbWVhbnMgdGhhdCB0aGlzIGVnZGUgY2FuIHN0YXJ0IGFuZC9vciBlbmRcbiAgICAgYSBibG9jay4gVGhlIHRvcCBlZGdlIG9mIGEgYm94IG9ubHkgY2FuZW5kLCB3aGlsZSBhIGZpeGVkIGVkZ2Ugb2YgYSBwYXRoIGNhbiBib3RoXG4gICAgIHN0YXJ0IGFuZCBlbmQgb2YgYSBibG9jay5cblxuICAgICAqL1xuXG4gICAgdGhpcy5vd25lciA9IG51bGw7XG4gICAgdGhpcy5zdGFydHBvaW50UHJldiA9IG51bGw7XG4gICAgdGhpcy5zdGFydHBvaW50ID0gbnVsbDtcbiAgICB0aGlzLmVuZHBvaW50ID0gbnVsbDtcbiAgICB0aGlzLmVuZHBvaW50TmV4dCA9IG51bGw7XG5cbiAgICB0aGlzLnBvc2l0aW9uWSA9IDA7XG4gICAgdGhpcy5wb3NpdGlvblgxID0gMDtcbiAgICB0aGlzLnBvc2l0aW9uWDIgPSAwO1xuICAgIHRoaXMuYnJhY2tldENsb3NpbmcgPSBmYWxzZTtcbiAgICB0aGlzLmJyYWNrZXRPcGVuaW5nID0gZmFsc2U7XG5cbiAgICB0aGlzLm9yZGVyUHJldiA9IG51bGw7XG4gICAgdGhpcy5vcmRlck5leHQgPSBudWxsO1xuXG4gICAgdGhpcy5zZWN0aW9uWDEgPSBudWxsO1xuICAgIHRoaXMuc2VjdGlvblgyID0gbnVsbDtcbiAgICB0aGlzLnNlY3Rpb25OZXh0ID0gbnVsbDtcbiAgICB0aGlzLnNlY3Rpb25Eb3duID0gbnVsbDtcblxuICAgIHRoaXMuZWRnZUZpeGVkID0gZmFsc2U7XG4gICAgdGhpcy5lZGdlQ3VzdG9tRml4ZWQgPSBmYWxzZTtcbiAgICB0aGlzLmVkZ2VDYW5QYXNzZWQgPSBmYWxzZTtcbiAgICB0aGlzLmVkZ2VEaXJlY3Rpb24gPSBudWxsO1xuXG4gICAgdGhpcy5ibG9ja1ByZXYgPSBudWxsO1xuICAgIHRoaXMuYmxvY2tOZXh0ID0gbnVsbDtcbiAgICB0aGlzLmJsb2NrVHJhY2UgPSBudWxsO1xuXG4gICAgdGhpcy5jbG9zZXN0UHJldiA9IG51bGw7XG4gICAgdGhpcy5jbG9zZXN0TmV4dCA9IG51bGw7XG5cbn07XG5cblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLmFzc2lnbiA9IGZ1bmN0aW9uIChvdGhlckVkZ2UpIHtcblxuICAgIGlmIChvdGhlckVkZ2UgIT09IG51bGwpIHtcbiAgICAgICAgdGhpcy5vd25lciA9IG90aGVyRWRnZS5vd25lcjtcbiAgICAgICAgdGhpcy5zZXRTdGFydFBvaW50KG90aGVyRWRnZS5zdGFydHBvaW50LCBmYWxzZSk7XG5cbiAgICAgICAgLy9Pbmx5IGNhbGN1bGF0ZURpcmVjdGlvbiBpZiB0aGlzLmVuZHBvaW50IGlzIG5vdCBudWxsXG4gICAgICAgIHRoaXMuc2V0RW5kUG9pbnQob3RoZXJFZGdlLmVuZHBvaW50LCBvdGhlckVkZ2UuZW5kcG9pbnQgIT09IG51bGwpO1xuXG4gICAgICAgIHRoaXMuc3RhcnRwb2ludFByZXYgPSBvdGhlckVkZ2Uuc3RhcnRwb2ludFByZXY7XG4gICAgICAgIHRoaXMuZW5kcG9pbnROZXh0ID0gb3RoZXJFZGdlLmVuZHBvaW50TmV4dDtcblxuICAgICAgICB0aGlzLnBvc2l0aW9uWSA9IG90aGVyRWRnZS5wb3NpdGlvblk7XG4gICAgICAgIHRoaXMucG9zaXRpb25YMSA9IG90aGVyRWRnZS5wb3NpdGlvblgxO1xuICAgICAgICB0aGlzLnBvc2l0aW9uWDIgPSBvdGhlckVkZ2UucG9zaXRpb25YMjtcbiAgICAgICAgdGhpcy5icmFja2V0Q2xvc2luZyA9IG90aGVyRWRnZS5icmFja2V0Q2xvc2luZztcbiAgICAgICAgdGhpcy5icmFja2V0T3BlbmluZyA9IG90aGVyRWRnZS5icmFja2V0T3BlbmluZztcblxuICAgICAgICB0aGlzLm9yZGVyTmV4dCA9IG90aGVyRWRnZS5vcmRlck5leHQ7XG4gICAgICAgIHRoaXMub3JkZXJQcmV2ID0gb3RoZXJFZGdlLm9yZGVyUHJldjtcblxuICAgICAgICB0aGlzLnNlY3Rpb25YMSA9IG90aGVyRWRnZS5zZWN0aW9uWDE7XG4gICAgICAgIHRoaXMuc2VjdGlvblgyID0gb3RoZXJFZGdlLnNlY3Rpb25YMjtcbiAgICAgICAgdGhpcy5zZXRTZWN0aW9uTmV4dChvdGhlckVkZ2UuZ2V0U2VjdGlvbk5leHQodHJ1ZSkpO1xuICAgICAgICB0aGlzLnNldFNlY3Rpb25Eb3duKG90aGVyRWRnZS5nZXRTZWN0aW9uRG93bih0cnVlKSk7XG5cbiAgICAgICAgdGhpcy5lZGdlRml4ZWQgPSBvdGhlckVkZ2UuZWRnZUZpeGVkO1xuICAgICAgICB0aGlzLmVkZ2VDdXN0b21GaXhlZCA9IG90aGVyRWRnZS5lZGdlQ3VzdG9tRml4ZWQ7XG4gICAgICAgIHRoaXMuc2V0RWRnZUNhbnBhc3NlZChvdGhlckVkZ2UuZ2V0RWRnZUNhbnBhc3NlZCgpKTtcbiAgICAgICAgdGhpcy5zZXREaXJlY3Rpb24ob3RoZXJFZGdlLmdldERpcmVjdGlvbigpKTtcblxuICAgICAgICB0aGlzLnNldEJsb2NrUHJldihvdGhlckVkZ2UuZ2V0QmxvY2tQcmV2KCkpO1xuICAgICAgICB0aGlzLnNldEJsb2NrTmV4dChvdGhlckVkZ2UuZ2V0QmxvY2tOZXh0KCkpO1xuICAgICAgICB0aGlzLnNldEJsb2NrVHJhY2Uob3RoZXJFZGdlLmdldEJsb2NrVHJhY2UoKSk7XG5cbiAgICAgICAgdGhpcy5zZXRDbG9zZXN0UHJldihvdGhlckVkZ2UuZ2V0Q2xvc2VzdFByZXYoKSk7XG4gICAgICAgIHRoaXMuc2V0Q2xvc2VzdE5leHQob3RoZXJFZGdlLmdldENsb3Nlc3ROZXh0KCkpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLmVxdWFscyA9IGZ1bmN0aW9uIChvdGhlckVkZ2UpIHtcbiAgICByZXR1cm4gdGhpcyA9PT0gb3RoZXJFZGdlOyAvLyBUaGlzIGNoZWNrcyBpZiB0aGV5IHJlZmVyZW5jZSB0aGUgc2FtZSBvYmplY3Rcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5nZXRTdGFydFBvaW50UHJldiA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5zdGFydHBvaW50UHJldiAhPT0gbnVsbCA/IHRoaXMuc3RhcnRwb2ludFByZXYgfHwgdGhpcy5zdGFydHBvaW50UHJldiA6IG51bGw7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuaXNTdGFydFBvaW50UHJldk51bGwgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuICF0aGlzLnN0YXJ0cG9pbnRQcmV2O1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLmdldFN0YXJ0UG9pbnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RhcnRwb2ludCAhPT0gbnVsbCA/XG4gICAgICAgICh0aGlzLnN0YXJ0cG9pbnQgaW5zdGFuY2VvZiBBcnJheSA/IG5ldyBBclBvaW50KHRoaXMuc3RhcnRwb2ludCkgOiBuZXcgQXJQb2ludCh0aGlzLnN0YXJ0cG9pbnQpKSA6XG4gICAgICAgIENPTlNUQU5UUy5FTVBUWV9QT0lOVDsgIC8vIHJldHVybmluZyBjb3B5IG9mIHRoaXMuc3RhcnRwb2ludFxufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLmlzU2FtZVN0YXJ0UG9pbnQgPSBmdW5jdGlvbiAocG9pbnQpIHtcbiAgICByZXR1cm4gdGhpcy5zdGFydHBvaW50ID09PSBwb2ludDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5pc1N0YXJ0UG9pbnROdWxsID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLnN0YXJ0cG9pbnQgPT09IG51bGw7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuc2V0U3RhcnRQb2ludCA9IGZ1bmN0aW9uIChwb2ludCwgYikge1xuICAgIHRoaXMuc3RhcnRwb2ludCA9IHBvaW50O1xuXG4gICAgaWYgKGIgIT09IGZhbHNlKSB7XG4gICAgICAgIHRoaXMucmVjYWxjdWxhdGVEaXJlY3Rpb24oKTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuc2V0U3RhcnRQb2ludFggPSBmdW5jdGlvbiAoX3gpIHtcbiAgICB0aGlzLnN0YXJ0cG9pbnQueCA9IF94O1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLnNldFN0YXJ0UG9pbnRZID0gZnVuY3Rpb24gKF95KSB7XG4gICAgdGhpcy5zdGFydHBvaW50LnkgPSBfeTtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5nZXRFbmRQb2ludCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5lbmRwb2ludCAhPT0gbnVsbCA/XG4gICAgICAgICh0aGlzLmVuZHBvaW50IGluc3RhbmNlb2YgQXJyYXkgP1xuICAgICAgICAgICAgbmV3IEFyUG9pbnQodGhpcy5lbmRwb2ludCkgOlxuICAgICAgICAgICAgbmV3IEFyUG9pbnQodGhpcy5lbmRwb2ludCkpIDpcbiAgICAgICAgQ09OU1RBTlRTLkVNUFRZX1BPSU5UO1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLmlzRW5kUG9pbnROdWxsID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmVuZHBvaW50ID09PSBudWxsO1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLnNldEVuZFBvaW50ID0gZnVuY3Rpb24gKHBvaW50LCBiKSB7XG4gICAgdGhpcy5lbmRwb2ludCA9IHBvaW50O1xuXG4gICAgaWYgKGIgIT09IGZhbHNlKSB7XG4gICAgICAgIHRoaXMucmVjYWxjdWxhdGVEaXJlY3Rpb24oKTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuc2V0U3RhcnRBbmRFbmRQb2ludCA9IGZ1bmN0aW9uIChzdGFydFBvaW50LCBlbmRQb2ludCkge1xuICAgIHRoaXMuc2V0U3RhcnRQb2ludChzdGFydFBvaW50LCBmYWxzZSk7IC8vd2FpdCB1bnRpbCBzZXR0aW5nIHRoZSB0aGlzLmVuZHBvaW50IHRvIHJlY2FsY3VsYXRlRGlyZWN0aW9uXG4gICAgdGhpcy5zZXRFbmRQb2ludChlbmRQb2ludCk7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuc2V0RW5kUG9pbnRYID0gZnVuY3Rpb24gKF94KSB7XG4gICAgdGhpcy5lbmRwb2ludC54ID0gX3g7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuc2V0RW5kUG9pbnRZID0gZnVuY3Rpb24gKF95KSB7XG4gICAgdGhpcy5lbmRwb2ludC55ID0gX3k7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuaXNFbmRQb2ludE5leHROdWxsID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiAhdGhpcy5lbmRwb2ludE5leHQ7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuZ2V0U2VjdGlvbk5leHQgPSBmdW5jdGlvbiAoKSB7XG5cbiAgICByZXR1cm4gdGhpcy5zZWN0aW9uTmV4dCAhPT0gdW5kZWZpbmVkID8gdGhpcy5zZWN0aW9uTmV4dFswXSA6IG51bGw7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuZ2V0U2VjdGlvbk5leHRQdHIgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKCF0aGlzLnNlY3Rpb25OZXh0IHx8ICF0aGlzLnNlY3Rpb25OZXh0WzBdKSB7XG4gICAgICAgIHRoaXMuc2VjdGlvbk5leHQgPSBbbmV3IEF1dG9Sb3V0ZXJFZGdlKCldO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5zZWN0aW9uTmV4dDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5zZXRTZWN0aW9uTmV4dCA9IGZ1bmN0aW9uIChuZXh0U2VjdGlvbikge1xuICAgIG5leHRTZWN0aW9uID0gbmV4dFNlY3Rpb24gaW5zdGFuY2VvZiBBcnJheSA/IG5leHRTZWN0aW9uWzBdIDogbmV4dFNlY3Rpb247XG4gICAgaWYgKHRoaXMuc2VjdGlvbk5leHQgaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgICB0aGlzLnNlY3Rpb25OZXh0WzBdID0gbmV4dFNlY3Rpb247XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5zZWN0aW9uTmV4dCA9IFtuZXh0U2VjdGlvbl07XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLmdldFNlY3Rpb25Eb3duID0gZnVuY3Rpb24gKCkgeyAvL1JldHVybnMgcG9pbnRlciAtIGlmIG5vdCBudWxsXG5cbiAgICByZXR1cm4gdGhpcy5zZWN0aW9uRG93biAhPT0gdW5kZWZpbmVkID8gdGhpcy5zZWN0aW9uRG93blswXSA6IG51bGw7XG5cbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5nZXRTZWN0aW9uRG93blB0ciA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoIXRoaXMuc2VjdGlvbkRvd24gfHwgIXRoaXMuc2VjdGlvbkRvd25bMF0pIHtcbiAgICAgICAgdGhpcy5zZWN0aW9uRG93biA9IFtuZXcgQXV0b1JvdXRlckVkZ2UoKV07XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnNlY3Rpb25Eb3duO1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLnNldFNlY3Rpb25Eb3duID0gZnVuY3Rpb24gKGRvd25TZWN0aW9uKSB7XG4gICAgZG93blNlY3Rpb24gPSBkb3duU2VjdGlvbiBpbnN0YW5jZW9mIEFycmF5ID8gZG93blNlY3Rpb25bMF0gOiBkb3duU2VjdGlvbjtcbiAgICBpZiAodGhpcy5zZWN0aW9uRG93biBpbnN0YW5jZW9mIEFycmF5KSB7XG4gICAgICAgIHRoaXMuc2VjdGlvbkRvd25bMF0gPSBkb3duU2VjdGlvbjtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnNlY3Rpb25Eb3duID0gW2Rvd25TZWN0aW9uXTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuZ2V0RWRnZUNhbnBhc3NlZCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5lZGdlQ2FuUGFzc2VkO1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLnNldEVkZ2VDYW5wYXNzZWQgPSBmdW5jdGlvbiAoZWNwKSB7XG4gICAgdGhpcy5lZGdlQ2FuUGFzc2VkID0gZWNwO1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLmdldERpcmVjdGlvbiA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5lZGdlRGlyZWN0aW9uO1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLnNldERpcmVjdGlvbiA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aGlzLmVkZ2VEaXJlY3Rpb24gPSBkaXI7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUucmVjYWxjdWxhdGVEaXJlY3Rpb24gPSBmdW5jdGlvbiAoKSB7XG4gICAgYXNzZXJ0KHRoaXMuc3RhcnRwb2ludCAhPT0gbnVsbCAmJiB0aGlzLmVuZHBvaW50ICE9PSBudWxsLFxuICAgICAgICAnQVJFZGdlLnJlY2FsY3VsYXRlRGlyZWN0aW9uOiB0aGlzLnN0YXJ0cG9pbnQgIT09IG51bGwgJiYgdGhpcy5lbmRwb2ludCAhPT0gbnVsbCBGQUlMRUQhJyk7XG4gICAgdGhpcy5lZGdlRGlyZWN0aW9uID0gVXRpbHMuZ2V0RGlyKHRoaXMuZW5kcG9pbnQubWludXModGhpcy5zdGFydHBvaW50KSk7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuZ2V0QmxvY2tQcmV2ID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmJsb2NrUHJldjtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5zZXRCbG9ja1ByZXYgPSBmdW5jdGlvbiAocHJldkJsb2NrKSB7XG4gICAgdGhpcy5ibG9ja1ByZXYgPSBwcmV2QmxvY2s7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuZ2V0QmxvY2tOZXh0ID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmJsb2NrTmV4dDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlLnByb3RvdHlwZS5zZXRCbG9ja05leHQgPSBmdW5jdGlvbiAobmV4dEJsb2NrKSB7XG4gICAgdGhpcy5ibG9ja05leHQgPSBuZXh0QmxvY2s7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuZ2V0QmxvY2tUcmFjZSA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5ibG9ja1RyYWNlO1xufTtcblxuQXV0b1JvdXRlckVkZ2UucHJvdG90eXBlLnNldEJsb2NrVHJhY2UgPSBmdW5jdGlvbiAodHJhY2VCbG9jaykge1xuICAgIHRoaXMuYmxvY2tUcmFjZSA9IHRyYWNlQmxvY2s7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuZ2V0Q2xvc2VzdFByZXYgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY2xvc2VzdFByZXY7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuc2V0Q2xvc2VzdFByZXYgPSBmdW5jdGlvbiAoY3ApIHtcbiAgICB0aGlzLmNsb3Nlc3RQcmV2ID0gY3A7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuZ2V0Q2xvc2VzdE5leHQgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY2xvc2VzdE5leHQ7XG59O1xuXG5BdXRvUm91dGVyRWRnZS5wcm90b3R5cGUuc2V0Q2xvc2VzdE5leHQgPSBmdW5jdGlvbiAoY3ApIHtcbiAgICB0aGlzLmNsb3Nlc3ROZXh0ID0gY3A7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEF1dG9Sb3V0ZXJFZGdlO1xuIiwiLypnbG9iYWxzIGRlZmluZSwgV2ViR01FR2xvYmFsKi9cbi8qanNoaW50IGJyb3dzZXI6IHRydWUqL1xuXG4vKipcbiAqIEBhdXRob3IgYnJvbGxiIC8gaHR0cHM6Ly9naXRodWIvYnJvbGxiXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgTG9nZ2VyID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLkxvZ2dlcicpLFxuICAgIENPTlNUQU5UUyA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Db25zdGFudHMnKSxcbiAgICBVdGlscyA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5VdGlscycpLFxuICAgIGFzc2VydCA9IFV0aWxzLmFzc2VydCxcbiAgICBBdXRvUm91dGVyUGF0aCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5QYXRoJyksXG4gICAgQXV0b1JvdXRlclBvcnQgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUG9ydCcpLFxuICAgIEF1dG9Sb3V0ZXJCb3ggPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuQm94JyksXG4gICAgQXV0b1JvdXRlckVkZ2UgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuRWRnZScpO1xuXG5cbiAgICAvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS1BdXRvUm91dGVyRWRnZUxpc3RcblxudmFyIF9sb2dnZXIgPSBuZXcgTG9nZ2VyKCdBdXRvUm91dGVyLkVkZ2VMaXN0Jyk7XG52YXIgQXV0b1JvdXRlckVkZ2VMaXN0ID0gZnVuY3Rpb24gKGIpIHtcbiAgICB0aGlzLm93bmVyID0gbnVsbDtcblxuICAgIC8vLS1FZGdlc1xuICAgIHRoaXMuaXNob3Jpem9udGFsID0gYjtcblxuICAgIC8vLS1PcmRlclxuICAgIHRoaXMub3JkZXJGaXJzdCA9IG51bGw7XG4gICAgdGhpcy5vcmRlckxhc3QgPSBudWxsO1xuXG4gICAgLy8tLVNlY3Rpb25cbiAgICB0aGlzLnNlY3Rpb25GaXJzdCA9IG51bGw7XG4gICAgdGhpcy5zZWN0aW9uQmxvY2tlciA9IG51bGw7XG4gICAgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgPSBbXTsgLy8gVGhpcyBpcyBhbiBhcnJheSB0byBlbXVsYXRlIHRoZSBwb2ludGVyIHRvIGEgcG9pbnRlciBmdW5jdGlvbmFsaXR5IGluIENQUC4gXG4gICAgLy8gVGhhdCBpcywgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRbMF0gPSB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCpcblxuICAgIHRoaXMuX2luaXRPcmRlcigpO1xuICAgIHRoaXMuX2luaXRTZWN0aW9uKCk7XG59O1xuXG4vLyBQdWJsaWMgRnVuY3Rpb25zXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLmNvbnRhaW5zID0gZnVuY3Rpb24gKHN0YXJ0LCBlbmQpIHtcbiAgICB2YXIgY3VycmVudEVkZ2UgPSB0aGlzLm9yZGVyRmlyc3QsXG4gICAgICAgIHN0YXJ0cG9pbnQsXG4gICAgICAgIGVuZHBvaW50O1xuXG4gICAgd2hpbGUgKGN1cnJlbnRFZGdlKSB7XG4gICAgICAgIHN0YXJ0cG9pbnQgPSBjdXJyZW50RWRnZS5zdGFydHBvaW50O1xuICAgICAgICBlbmRwb2ludCA9IGN1cnJlbnRFZGdlLmVuZHBvaW50O1xuICAgICAgICBpZiAoc3RhcnQuZXF1YWxzKHN0YXJ0cG9pbnQpICYmIGVuZC5lcXVhbHMoZW5kcG9pbnQpKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBjdXJyZW50RWRnZSA9IGN1cnJlbnRFZGdlLm9yZGVyTmV4dDtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5jaGVja09yZGVyKCk7XG4gICAgdGhpcy5jaGVja1NlY3Rpb24oKTtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuYWRkUGF0aEVkZ2VzID0gZnVuY3Rpb24gKHBhdGgpIHtcbiAgICBhc3NlcnQocGF0aC5vd25lciA9PT0gdGhpcy5vd25lcixcbiAgICAgICAgJ0FSRWRnZUxpc3QuYWRkRWRnZXM6IHBhdGgub3duZXIgPT09IG93bmVyIEZBSUxFRCEnKTtcblxuICAgIHZhciBpc1BhdGhBdXRvUm91dGVkID0gcGF0aC5pc0F1dG9Sb3V0ZWQoKSxcbiAgICAgICAgaGFzQ3VzdG9tRWRnZSA9IGZhbHNlLFxuICAgICAgICBjdXN0b21pemVkSW5kZXhlcyA9IHt9LFxuICAgICAgICBpbmRleGVzID0gW10sXG4gICAgICAgIHN0YXJ0cG9pbnQsXG4gICAgICAgIGVuZHBvaW50LFxuICAgICAgICBkaXIsXG4gICAgICAgIGVkZ2UsXG4gICAgICAgIGk7XG5cbiAgICBpZiAoaXNQYXRoQXV0b1JvdXRlZCkge1xuICAgICAgICBpID0gLTE7XG4gICAgICAgIHdoaWxlICgrK2kgPCBpbmRleGVzLmxlbmd0aCkge1xuICAgICAgICAgICAgaGFzQ3VzdG9tRWRnZSA9IHRydWU7XG4gICAgICAgICAgICBjdXN0b21pemVkSW5kZXhlc1tpbmRleGVzW2ldXSA9IDA7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBoYXNDdXN0b21FZGdlID0gdHJ1ZTtcbiAgICB9XG5cbiAgICB2YXIgcG9pbnRMaXN0ID0gcGF0aC5nZXRQb2ludExpc3QoKSxcbiAgICAgICAgcHRyc09iamVjdCA9IHBvaW50TGlzdC5nZXRUYWlsRWRnZVB0cnMoKSxcbiAgICAgICAgaW5kSXRyLFxuICAgICAgICBjdXJyRWRnZUluZGV4ID0gcG9pbnRMaXN0Lmxlbmd0aCAtIDIsXG4gICAgICAgIGdvb2RBbmdsZSxcbiAgICAgICAgcG9zID0gcHRyc09iamVjdC5wb3MsXG4gICAgICAgIHNraXBFZGdlLFxuICAgICAgICBpc01vdmVhYmxlLFxuICAgICAgICBpc0VkZ2VDdXN0b21GaXhlZCxcbiAgICAgICAgc3RhcnRQb3J0LFxuICAgICAgICBlbmRQb3J0LFxuICAgICAgICBpc1N0YXJ0UG9ydENvbm5lY3RUb0NlbnRlcixcbiAgICAgICAgaXNFbmRQb3J0Q29ubmVjdFRvQ2VudGVyLFxuICAgICAgICBpc1BhdGhGaXhlZDtcblxuICAgIHN0YXJ0cG9pbnQgPSBwdHJzT2JqZWN0LnN0YXJ0O1xuICAgIGVuZHBvaW50ID0gcHRyc09iamVjdC5lbmQ7XG5cbiAgICB3aGlsZSAocG9pbnRMaXN0Lmxlbmd0aCAmJiBwb3MgPj0gMCkge1xuXG4gICAgICAgIGRpciA9IFV0aWxzLmdldERpcihlbmRwb2ludC5taW51cyhzdGFydHBvaW50KSk7XG5cbiAgICAgICAgc2tpcEVkZ2UgPSBkaXIgPT09IENPTlNUQU5UUy5EaXJOb25lID8gdHJ1ZSA6IGZhbHNlO1xuICAgICAgICBpc01vdmVhYmxlID0gcGF0aC5pc01vdmVhYmxlKCk7XG5cbiAgICAgICAgaWYgKCFpc01vdmVhYmxlICYmIGRpciAhPT0gQ09OU1RBTlRTLkRpclNrZXcpIHtcbiAgICAgICAgICAgIGdvb2RBbmdsZSA9IFV0aWxzLmlzUmlnaHRBbmdsZShkaXIpO1xuICAgICAgICAgICAgYXNzZXJ0KGdvb2RBbmdsZSxcbiAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5hZGRFZGdlczogVXRpbHMuaXNSaWdodEFuZ2xlIChkaXIpIEZBSUxFRCEnKTtcblxuICAgICAgICAgICAgaWYgKCFnb29kQW5nbGUpIHtcbiAgICAgICAgICAgICAgICBza2lwRWRnZSA9IHRydWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghc2tpcEVkZ2UgJiZcbiAgICAgICAgICAgIChVdGlscy5pc1JpZ2h0QW5nbGUoZGlyKSAmJiBVdGlscy5pc0hvcml6b250YWwoZGlyKSA9PT0gdGhpcy5pc2hvcml6b250YWwpKSB7XG4gICAgICAgICAgICBlZGdlID0gbmV3IEF1dG9Sb3V0ZXJFZGdlKCk7XG4gICAgICAgICAgICBlZGdlLm93bmVyID0gcGF0aDtcblxuICAgICAgICAgICAgZWRnZS5zZXRTdGFydEFuZEVuZFBvaW50KHN0YXJ0cG9pbnQsIGVuZHBvaW50KTtcbiAgICAgICAgICAgIGVkZ2Uuc3RhcnRwb2ludFByZXYgPSBwb2ludExpc3QuZ2V0UG9pbnRCZWZvcmVFZGdlKHBvcyk7XG4gICAgICAgICAgICBlZGdlLmVuZHBvaW50TmV4dCA9IHBvaW50TGlzdC5nZXRQb2ludEFmdGVyRWRnZShwb3MpO1xuXG4gICAgICAgICAgICBpZiAoaGFzQ3VzdG9tRWRnZSkge1xuICAgICAgICAgICAgICAgIGlzRWRnZUN1c3RvbUZpeGVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgaWYgKGlzUGF0aEF1dG9Sb3V0ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5kSXRyID0gY3VzdG9taXplZEluZGV4ZXMuaW5kZXhPZihjdXJyRWRnZUluZGV4KTtcbiAgICAgICAgICAgICAgICAgICAgaXNFZGdlQ3VzdG9tRml4ZWQgPSAoaW5kSXRyICE9PSBjdXN0b21pemVkSW5kZXhlcy5sZW5ndGggLSAxKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpc0VkZ2VDdXN0b21GaXhlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZWRnZS5lZGdlQ3VzdG9tRml4ZWQgPSBpc0VkZ2VDdXN0b21GaXhlZDtcblxuICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgIGVkZ2UuZWRnZUN1c3RvbUZpeGVkID0gZGlyID09PSBDT05TVEFOVFMuRGlyU2tldztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc3RhcnRQb3J0ID0gcGF0aC5nZXRTdGFydFBvcnQoKTtcblxuICAgICAgICAgICAgYXNzZXJ0KHN0YXJ0UG9ydCAhPT0gbnVsbCxcbiAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5hZGRFZGdlczogc3RhcnRQb3J0ICE9PSBudWxsIEZBSUxFRCEnKTtcblxuICAgICAgICAgICAgaXNTdGFydFBvcnRDb25uZWN0VG9DZW50ZXIgPSBzdGFydFBvcnQuaXNDb25uZWN0VG9DZW50ZXIoKTtcbiAgICAgICAgICAgIGVuZFBvcnQgPSBwYXRoLmdldEVuZFBvcnQoKTtcblxuICAgICAgICAgICAgYXNzZXJ0KGVuZFBvcnQgIT09IG51bGwsXG4gICAgICAgICAgICAgICAgJ0FSRWRnZUxpc3QuYWRkRWRnZXM6IGVuZFBvcnQgIT09IG51bGwgRkFJTEVEIScpO1xuXG4gICAgICAgICAgICBpc0VuZFBvcnRDb25uZWN0VG9DZW50ZXIgPSBlbmRQb3J0LmlzQ29ubmVjdFRvQ2VudGVyKCk7XG4gICAgICAgICAgICBpc1BhdGhGaXhlZCA9IHBhdGguaXNGaXhlZCgpIHx8ICFwYXRoLmlzQXV0b1JvdXRlZCgpO1xuXG4gICAgICAgICAgICBlZGdlLmVkZ2VGaXhlZCA9IGVkZ2UuZWRnZUN1c3RvbUZpeGVkIHx8IGlzUGF0aEZpeGVkIHx8XG4gICAgICAgICAgICAoZWRnZS5pc1N0YXJ0UG9pbnRQcmV2TnVsbCgpICYmIGlzU3RhcnRQb3J0Q29ubmVjdFRvQ2VudGVyKSB8fFxuICAgICAgICAgICAgKGVkZ2UuaXNFbmRQb2ludE5leHROdWxsKCkgJiYgaXNFbmRQb3J0Q29ubmVjdFRvQ2VudGVyKTtcblxuICAgICAgICAgICAgaWYgKGRpciAhPT0gQ09OU1RBTlRTLkRpclNrZXcpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9wb3NpdGlvbkxvYWRZKGVkZ2UpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3Bvc2l0aW9uTG9hZEIoZWRnZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGVkZ2UucG9zaXRpb25ZID0gMDtcbiAgICAgICAgICAgICAgICBlZGdlLmJyYWNrZXRPcGVuaW5nID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgZWRnZS5icmFja2V0Q2xvc2luZyA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLmluc2VydChlZGdlKTtcblxuICAgICAgICB9XG5cbiAgICAgICAgcHRyc09iamVjdCA9IHBvaW50TGlzdC5nZXRQcmV2RWRnZVB0cnMocG9zKTtcbiAgICAgICAgcG9zID0gcHRyc09iamVjdC5wb3M7XG4gICAgICAgIHN0YXJ0cG9pbnQgPSBwdHJzT2JqZWN0LnN0YXJ0O1xuICAgICAgICBlbmRwb2ludCA9IHB0cnNPYmplY3QuZW5kO1xuICAgICAgICBjdXJyRWRnZUluZGV4LS07XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLmFkZFBvcnRFZGdlcyA9IGZ1bmN0aW9uIChwb3J0KSB7XG4gICAgdmFyIHN0YXJ0cG9pbnQsXG4gICAgICAgIGVuZHBvaW50LFxuICAgICAgICBlZGdlLFxuICAgICAgICBzZWxmUG9pbnRzLFxuICAgICAgICBzdGFydHBvaW50UHJldixcbiAgICAgICAgZW5kcG9pbnROZXh0LFxuICAgICAgICBkaXIsXG4gICAgICAgIGksXG4gICAgICAgIGNhbkhhdmVTdGFydEVuZFBvaW50SG9yaXpvbnRhbDtcblxuICAgIGFzc2VydChwb3J0Lm93bmVyLm93bmVyID09PSB0aGlzLm93bmVyLFxuICAgICAgICAnQVJFZGdlTGlzdC5hZGRFZGdlczogcG9ydC5vd25lciA9PT0gKG93bmVyKSBGQUlMRUQhJyk7XG5cbiAgICBpZiAocG9ydC5pc0Nvbm5lY3RUb0NlbnRlcigpIHx8IHBvcnQub3duZXIuaXNBdG9taWMoKSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgc2VsZlBvaW50cyA9IHBvcnQuc2VsZlBvaW50cztcblxuICAgIGZvciAoaSA9IDA7IGkgPCA0OyBpKyspIHtcblxuICAgICAgICBzdGFydHBvaW50UHJldiA9IHNlbGZQb2ludHNbKGkgKyAzKSAlIDRdO1xuICAgICAgICBzdGFydHBvaW50ID0gc2VsZlBvaW50c1tpXTtcbiAgICAgICAgZW5kcG9pbnQgPSBzZWxmUG9pbnRzWyhpICsgMSkgJSA0XTtcbiAgICAgICAgZW5kcG9pbnROZXh0ID0gc2VsZlBvaW50c1soaSArIDIpICUgNF07XG4gICAgICAgIGRpciA9IFV0aWxzLmdldERpcihlbmRwb2ludC5taW51cyhzdGFydHBvaW50KSk7XG5cbiAgICAgICAgYXNzZXJ0KFV0aWxzLmlzUmlnaHRBbmdsZShkaXIpLFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QuYWRkRWRnZXM6IFV0aWxzLmlzUmlnaHRBbmdsZSAoZGlyKSBGQUlMRUQhJyk7XG5cbiAgICAgICAgY2FuSGF2ZVN0YXJ0RW5kUG9pbnRIb3Jpem9udGFsID0gcG9ydC5jYW5IYXZlU3RhcnRFbmRQb2ludEhvcml6b250YWwodGhpcy5pc2hvcml6b250YWwpO1xuICAgICAgICBpZiAoVXRpbHMuaXNIb3Jpem9udGFsKGRpcikgPT09IHRoaXMuaXNob3Jpem9udGFsICYmIGNhbkhhdmVTdGFydEVuZFBvaW50SG9yaXpvbnRhbCkge1xuICAgICAgICAgICAgZWRnZSA9IG5ldyBBdXRvUm91dGVyRWRnZSgpO1xuXG4gICAgICAgICAgICBlZGdlLm93bmVyID0gcG9ydDtcbiAgICAgICAgICAgIGVkZ2Uuc2V0U3RhcnRBbmRFbmRQb2ludChzdGFydHBvaW50LCBlbmRwb2ludCk7XG4gICAgICAgICAgICBlZGdlLnN0YXJ0cG9pbnRQcmV2ID0gc3RhcnRwb2ludFByZXY7XG4gICAgICAgICAgICBlZGdlLmVuZHBvaW50TmV4dCA9IGVuZHBvaW50TmV4dDtcblxuICAgICAgICAgICAgZWRnZS5lZGdlRml4ZWQgPSB0cnVlO1xuXG4gICAgICAgICAgICB0aGlzLl9wb3NpdGlvbkxvYWRZKGVkZ2UpO1xuICAgICAgICAgICAgdGhpcy5fcG9zaXRpb25Mb2FkQihlZGdlKTtcblxuICAgICAgICAgICAgaWYgKGVkZ2UuYnJhY2tldENsb3NpbmcpIHtcbiAgICAgICAgICAgICAgICBlZGdlLmFkZFRvUG9zaXRpb24oMC45OTkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLmluc2VydChlZGdlKTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuYWRkRWRnZXMgPSBmdW5jdGlvbiAocGF0aCkge1xuICAgIHZhciBzZWxmUG9pbnRzLFxuICAgICAgICBzdGFydHBvaW50LFxuICAgICAgICBzdGFydHBvaW50UHJldixcbiAgICAgICAgZW5kcG9pbnROZXh0LFxuICAgICAgICBlbmRwb2ludCxcbiAgICAgICAgZWRnZSxcbiAgICAgICAgZGlyLFxuICAgICAgICBpO1xuXG4gICAgaWYgKHBhdGggaW5zdGFuY2VvZiBBdXRvUm91dGVyQm94KSB7XG4gICAgICAgIHZhciBib3ggPSBwYXRoO1xuXG4gICAgICAgIGFzc2VydChib3gub3duZXIgPT09IHRoaXMub3duZXIsXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5hZGRFZGdlczogYm94Lm93bmVyID09PSAob3duZXIpIEZBSUxFRCEnKTtcblxuXG4gICAgICAgIHNlbGZQb2ludHMgPSBib3guc2VsZlBvaW50cztcblxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgNDsgaSsrKSB7XG4gICAgICAgICAgICBzdGFydHBvaW50UHJldiA9IHNlbGZQb2ludHNbKGkgKyAzKSAlIDRdO1xuICAgICAgICAgICAgc3RhcnRwb2ludCA9IHNlbGZQb2ludHNbaV07XG4gICAgICAgICAgICBlbmRwb2ludCA9IHNlbGZQb2ludHNbKGkgKyAxKSAlIDRdO1xuICAgICAgICAgICAgZW5kcG9pbnROZXh0ID0gc2VsZlBvaW50c1soaSArIDIpICUgNF07XG4gICAgICAgICAgICBkaXIgPSBVdGlscy5nZXREaXIoZW5kcG9pbnQubWludXMoc3RhcnRwb2ludCkpO1xuXG4gICAgICAgICAgICBhc3NlcnQoVXRpbHMuaXNSaWdodEFuZ2xlKGRpciksXG4gICAgICAgICAgICAgICAgJ0FSRWRnZUxpc3QuYWRkRWRnZXM6IFV0aWxzLmlzUmlnaHRBbmdsZSAoZGlyKSBGQUlMRUQhJyk7XG5cbiAgICAgICAgICAgIGlmIChVdGlscy5pc0hvcml6b250YWwoZGlyKSA9PT0gdGhpcy5pc2hvcml6b250YWwpIHtcbiAgICAgICAgICAgICAgICBlZGdlID0gbmV3IEF1dG9Sb3V0ZXJFZGdlKCk7XG5cbiAgICAgICAgICAgICAgICBlZGdlLm93bmVyID0gYm94O1xuICAgICAgICAgICAgICAgIGVkZ2Uuc2V0U3RhcnRBbmRFbmRQb2ludChzdGFydHBvaW50LCBlbmRwb2ludCk7XG4gICAgICAgICAgICAgICAgZWRnZS5zdGFydHBvaW50UHJldiA9IHN0YXJ0cG9pbnRQcmV2O1xuICAgICAgICAgICAgICAgIGVkZ2UuZW5kcG9pbnROZXh0ID0gZW5kcG9pbnROZXh0O1xuXG4gICAgICAgICAgICAgICAgZWRnZS5lZGdlRml4ZWQgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5fcG9zaXRpb25Mb2FkWShlZGdlKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9wb3NpdGlvbkxvYWRCKGVkZ2UpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGVkZ2UuYnJhY2tldENsb3NpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgZWRnZS5hZGRUb1Bvc2l0aW9uKDAuOTk5KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLmluc2VydChlZGdlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAocGF0aCkgeyAgLy8gcGF0aCBpcyBhbiBBUkdyYXBoXG4gICAgICAgIHZhciBncmFwaCA9IHBhdGg7XG4gICAgICAgIGFzc2VydChncmFwaCA9PT0gdGhpcy5vd25lcixcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0LmFkZEVkZ2VzOiBncmFwaCA9PT0gdGhpcy5vd25lciBGQUlMRUQhJyk7XG5cbiAgICAgICAgc2VsZlBvaW50cyA9IGdyYXBoLnNlbGZQb2ludHM7XG5cbiAgICAgICAgZm9yIChpID0gMDsgaSA8IDQ7IGkrKykge1xuXG4gICAgICAgICAgICBzdGFydHBvaW50UHJldiA9IHNlbGZQb2ludHNbKGkgKyAzKSAlIDRdO1xuICAgICAgICAgICAgc3RhcnRwb2ludCA9IHNlbGZQb2ludHNbaV07XG4gICAgICAgICAgICBlbmRwb2ludCA9IHNlbGZQb2ludHNbKGkgKyAxKSAlIDRdO1xuICAgICAgICAgICAgZW5kcG9pbnROZXh0ID0gc2VsZlBvaW50c1soaSArIDIpICUgNF07XG4gICAgICAgICAgICBkaXIgPSBVdGlscy5nZXREaXIoZW5kcG9pbnQubWludXMoc3RhcnRwb2ludCkpO1xuXG4gICAgICAgICAgICBhc3NlcnQoVXRpbHMuaXNSaWdodEFuZ2xlKGRpciksXG4gICAgICAgICAgICAgICAgJ0FSRWRnZUxpc3QuYWRkRWRnZXM6IFV0aWxzLmlzUmlnaHRBbmdsZSAoZGlyKSBGQUlMRUQhJyk7XG5cbiAgICAgICAgICAgIGlmIChVdGlscy5pc0hvcml6b250YWwoZGlyKSA9PT0gdGhpcy5pc2hvcml6b250YWwpIHtcbiAgICAgICAgICAgICAgICBlZGdlID0gbmV3IEF1dG9Sb3V0ZXJFZGdlKCk7XG5cbiAgICAgICAgICAgICAgICBlZGdlLm93bmVyID0gZ3JhcGg7XG4gICAgICAgICAgICAgICAgZWRnZS5zZXRTdGFydEFuZEVuZFBvaW50KHN0YXJ0cG9pbnQsIGVuZHBvaW50KTtcbiAgICAgICAgICAgICAgICBlZGdlLnN0YXJ0cG9pbnRQcmV2ID0gc3RhcnRwb2ludFByZXY7XG4gICAgICAgICAgICAgICAgZWRnZS5lbmRwb2ludE5leHQgPSBlbmRwb2ludE5leHQ7XG5cbiAgICAgICAgICAgICAgICBlZGdlLmVkZ2VGaXhlZCA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICB0aGlzLl9wb3NpdGlvbkxvYWRZKGVkZ2UpO1xuICAgICAgICAgICAgICAgIHRoaXMuaW5zZXJ0KGVkZ2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICB9XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLmRlbGV0ZUVkZ2VzID0gZnVuY3Rpb24gKG9iamVjdCkge1xuICAgIHZhciBlZGdlID0gdGhpcy5vcmRlckZpcnN0LFxuICAgICAgICBuZXh0O1xuXG4gICAgd2hpbGUgKGVkZ2UgIT09IG51bGwpIHtcbiAgICAgICAgaWYgKGVkZ2Uub3duZXIgPT09IG9iamVjdCkge1xuICAgICAgICAgICAgbmV4dCA9IGVkZ2Uub3JkZXJOZXh0O1xuICAgICAgICAgICAgdGhpcy5yZW1vdmUoZWRnZSk7XG4gICAgICAgICAgICBlZGdlID0gbmV4dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGVkZ2UgPSBlZGdlLm9yZGVyTmV4dDtcbiAgICAgICAgfVxuICAgIH1cblxufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5kZWxldGVBbGxFZGdlcyA9IGZ1bmN0aW9uICgpIHtcbiAgICB3aGlsZSAodGhpcy5vcmRlckZpcnN0KSB7XG4gICAgICAgIHRoaXMucmVtb3ZlKHRoaXMub3JkZXJGaXJzdCk7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5nZXRFZGdlID0gZnVuY3Rpb24gKHBhdGgsIHN0YXJ0cG9pbnQpIHtcbiAgICB2YXIgZWRnZSA9IHRoaXMub3JkZXJGaXJzdDtcbiAgICB3aGlsZSAoZWRnZSAhPT0gbnVsbCkge1xuXG4gICAgICAgIGlmIChlZGdlLmlzU2FtZVN0YXJ0UG9pbnQoc3RhcnRwb2ludCkpIHtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgZWRnZSA9IGVkZ2Uub3JkZXJOZXh0O1xuICAgIH1cblxuICAgIGFzc2VydChlZGdlICE9PSBudWxsLFxuICAgICAgICAnQVJFZGdlTGlzdC5nZXRFZGdlOiBlZGdlICE9PSBudWxsIEZBSUxFRCEnKTtcbiAgICByZXR1cm4gZWRnZTtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuZ2V0RWRnZUJ5UG9pbnRlciA9IGZ1bmN0aW9uIChzdGFydHBvaW50KSB7XG4gICAgdmFyIGVkZ2UgPSB0aGlzLm9yZGVyRmlyc3Q7XG4gICAgd2hpbGUgKGVkZ2UgIT09IG51bGwpIHtcbiAgICAgICAgaWYgKGVkZ2UuaXNTYW1lU3RhcnRQb2ludChzdGFydHBvaW50KSkge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICBlZGdlID0gZWRnZS5vcmRlck5leHQ7XG4gICAgfVxuXG4gICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwsXG4gICAgICAgICdBUkVkZ2VMaXN0LmdldEVkZ2VCeVBvaW50ZXI6IGVkZ2UgIT09IG51bGwgRkFJTEVEIScpO1xuICAgIHJldHVybiBlZGdlO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5zZXRFZGdlQnlQb2ludGVyID0gZnVuY3Rpb24gKHBFZGdlLCBuZXdFZGdlKSB7XG4gICAgYXNzZXJ0KG5ld0VkZ2UgaW5zdGFuY2VvZiBBdXRvUm91dGVyRWRnZSxcbiAgICAgICAgJ0FSRWRnZUxpc3Quc2V0RWRnZUJ5UG9pbnRlcjogbmV3RWRnZSBpbnN0YW5jZW9mIEF1dG9Sb3V0ZXJFZGdlIEZBSUxFRCEnKTtcbiAgICB2YXIgZWRnZSA9IHRoaXMuc2VjdGlvbkZpcnN0O1xuICAgIHdoaWxlIChlZGdlICE9PSBudWxsKSB7XG4gICAgICAgIGlmIChwRWRnZSA9PT0gZWRnZSkge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICBlZGdlID0gZWRnZS5nZXRTZWN0aW9uRG93bigpO1xuICAgIH1cblxuICAgIGFzc2VydChlZGdlICE9PSBudWxsLFxuICAgICAgICAnQVJFZGdlTGlzdC5zZXRFZGdlQnlQb2ludGVyOiBlZGdlICE9PSBudWxsIEZBSUxFRCEnKTtcbiAgICBlZGdlID0gbmV3RWRnZTtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuZ2V0RWRnZUF0ID0gZnVuY3Rpb24gKHBvaW50LCBuZWFybmVzcykge1xuICAgIHZhciBlZGdlID0gdGhpcy5vcmRlckZpcnN0O1xuICAgIHdoaWxlIChlZGdlKSB7XG5cbiAgICAgICAgaWYgKFV0aWxzLmlzUG9pbnROZWFyTGluZShwb2ludCwgZWRnZS5zdGFydHBvaW50LCBlZGdlLmVuZHBvaW50LCBuZWFybmVzcykpIHtcbiAgICAgICAgICAgIHJldHVybiBlZGdlO1xuICAgICAgICB9XG5cbiAgICAgICAgZWRnZSA9IGVkZ2Uub3JkZXJOZXh0O1xuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5kdW1wRWRnZXMgPSBmdW5jdGlvbiAobXNnLCBsb2dnZXIpIHtcbiAgICB2YXIgZWRnZSA9IHRoaXMub3JkZXJGaXJzdCxcbiAgICAgICAgbG9nID0gbG9nZ2VyIHx8IF9sb2dnZXIuZGVidWcsXG4gICAgICAgIHRvdGFsID0gMTtcblxuICAgIGxvZyhtc2cpO1xuXG4gICAgd2hpbGUgKGVkZ2UgIT09IG51bGwpIHtcbiAgICAgICAgbG9nKCdcXHQnICsgZWRnZS5zdGFydHBvaW50LnggKyAnLCAnICsgZWRnZS5zdGFydHBvaW50LnkgKyAnXFx0XFx0JyArIGVkZ2UuZW5kcG9pbnQueCArICcsICcgK1xuICAgICAgICBlZGdlLmVuZHBvaW50LnkgKyAnXFx0XFx0XFx0KCcgKyAoZWRnZS5lZGdlRml4ZWQgPyAnRklYRUQnIDogJ01PVkVBQkxFJyApICsgJylcXHRcXHQnICtcbiAgICAgICAgKGVkZ2UuYnJhY2tldENsb3NpbmcgPyAnQnJhY2tldCBDbG9zaW5nJyA6IChlZGdlLmJyYWNrZXRPcGVuaW5nID8gJ0JyYWNrZXQgT3BlbmluZycgOiAnJykpKTtcblxuICAgICAgICBlZGdlID0gZWRnZS5vcmRlck5leHQ7XG4gICAgICAgIHRvdGFsKys7XG4gICAgfVxuXG4gICAgbG9nKCdUb3RhbCBFZGdlczogJyArIHRvdGFsKTtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuZ2V0RWRnZUNvdW50ID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBlZGdlID0gdGhpcy5vcmRlckZpcnN0LFxuICAgICAgICB0b3RhbCA9IDE7XG4gICAgd2hpbGUgKGVkZ2UgIT09IG51bGwpIHtcbiAgICAgICAgZWRnZSA9IGVkZ2Uub3JkZXJOZXh0O1xuICAgICAgICB0b3RhbCsrO1xuICAgIH1cbiAgICByZXR1cm4gdG90YWw7XG59O1xuXG4vLy0tUHJpdmF0ZSBGdW5jdGlvbnNcbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuX3Bvc2l0aW9uR2V0UmVhbFkgPSBmdW5jdGlvbiAoZWRnZSwgeSkge1xuICAgIGlmICh5ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKHRoaXMuaXNob3Jpem9udGFsKSB7XG4gICAgICAgICAgICBhc3NlcnQoZWRnZS5zdGFydHBvaW50LnkgPT09IGVkZ2UuZW5kcG9pbnQueSxcbiAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5wb3NpdGlvbl9HZXRSZWFsWTogZWRnZS5zdGFydHBvaW50LnkgPT09IGVkZ2UuZW5kcG9pbnQueSBGQUlMRUQhJyk7XG4gICAgICAgICAgICByZXR1cm4gZWRnZS5zdGFydHBvaW50Lnk7XG4gICAgICAgIH1cblxuICAgICAgICBhc3NlcnQoZWRnZS5zdGFydHBvaW50LnggPT09IGVkZ2UuZW5kcG9pbnQueCxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0LnBvc2l0aW9uX0dldFJlYWxZOiBlZGdlLnN0YXJ0cG9pbnQueCA9PT0gZWRnZS5lbmRwb2ludC54IEZBSUxFRCEnKTtcbiAgICAgICAgcmV0dXJuIGVkZ2Uuc3RhcnRwb2ludC54O1xuICAgIH0gZWxzZSB7XG5cbiAgICAgICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwgJiYgIWVkZ2UuaXNTdGFydFBvaW50TnVsbCgpICYmICFlZGdlLmlzRW5kUG9pbnROdWxsKCksXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5wb3NpdGlvbl9HZXRSZWFsWTogZWRnZSAhPT0gbnVsbCAmJiAhZWRnZS5pc1N0YXJ0UG9pbnROdWxsKCkgJiYgJyArXG4gICAgICAgICAgICAnIWVkZ2UuaXNFbmRQb2ludE51bGwoKSBGQUlMRUQhJyk7XG5cbiAgICAgICAgaWYgKHRoaXMuaXNob3Jpem9udGFsKSB7XG4gICAgICAgICAgICBhc3NlcnQoZWRnZS5zdGFydHBvaW50LnkgPT09IGVkZ2UuZW5kcG9pbnQueSxcbiAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5wb3NpdGlvbl9HZXRSZWFsWTogZWRnZS5zdGFydHBvaW50LnkgPT09IGVkZ2UuZW5kcG9pbnQueSBGQUlMRUQhJyk7XG4gICAgICAgICAgICBlZGdlLnNldFN0YXJ0UG9pbnRZKHkpO1xuICAgICAgICAgICAgZWRnZS5zZXRFbmRQb2ludFkoeSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhc3NlcnQoZWRnZS5zdGFydHBvaW50LnggPT09IGVkZ2UuZW5kcG9pbnQueCxcbiAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5wb3NpdGlvbl9HZXRSZWFsWTogZWRnZS5zdGFydHBvaW50LnggPT09IGVkZ2UuZW5kcG9pbnQueCBGQUlMRUQnKTtcblxuICAgICAgICAgICAgZWRnZS5zZXRTdGFydFBvaW50WCh5KTtcbiAgICAgICAgICAgIGVkZ2Uuc2V0RW5kUG9pbnRYKHkpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5fcG9zaXRpb25TZXRSZWFsWSA9IGZ1bmN0aW9uIChlZGdlLCB5KSB7XG4gICAgaWYgKGVkZ2UgaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgICBlZGdlID0gZWRnZVswXTtcbiAgICB9XG5cbiAgICBhc3NlcnQoZWRnZSAhPT0gbnVsbCAmJiAhZWRnZS5pc1N0YXJ0UG9pbnROdWxsKCkgJiYgIWVkZ2UuaXNFbmRQb2ludE51bGwoKSxcbiAgICAgICAgJ0FSRWRnZUxpc3QucG9zaXRpb25fU2V0UmVhbFk6IGVkZ2UgIT0gbnVsbCAmJiAhZWRnZS5pc1N0YXJ0UG9pbnROdWxsKCkgJiYgIWVkZ2UuaXNFbmRQb2ludE51bGwoKSBGQUlMRUQnKTtcblxuICAgIGlmICh0aGlzLmlzaG9yaXpvbnRhbCkge1xuICAgICAgICBhc3NlcnQoZWRnZS5zdGFydHBvaW50LnkgPT09IGVkZ2UuZW5kcG9pbnQueSxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0LnBvc2l0aW9uX1NldFJlYWxZOiBlZGdlLnN0YXJ0cG9pbnQueSA9PT0gZWRnZS5lbmRwb2ludC55IEZBSUxFRCcpO1xuICAgICAgICBlZGdlLnNldFN0YXJ0UG9pbnRZKHkpO1xuICAgICAgICBlZGdlLnNldEVuZFBvaW50WSh5KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBhc3NlcnQoZWRnZS5zdGFydHBvaW50LnggPT09IGVkZ2UuZW5kcG9pbnQueCxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0LnBvc2l0aW9uX1NldFJlYWxZOiBlZGdlLnN0YXJ0cG9pbnQueCA9PT0gZWRnZS5lbmRwb2ludC54IEZBSUxFRCcpO1xuICAgICAgICBlZGdlLnNldFN0YXJ0UG9pbnRYKHkpO1xuICAgICAgICBlZGdlLnNldEVuZFBvaW50WCh5KTtcbiAgICB9XG59O1xuXG4vKipcbiAqIE5vcm1hbGl6ZSB0aGUgZWRnZSBlbmRwb2ludHMgc28geDEgPCB4MlxuICovXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLl9wb3NpdGlvbkdldFJlYWxYID0gZnVuY3Rpb24gKGVkZ2UpIHtcbiAgICBhc3NlcnQoZWRnZSAhPT0gbnVsbCAmJiAhZWRnZS5pc1N0YXJ0UG9pbnROdWxsKCkgJiYgIWVkZ2UuaXNFbmRQb2ludE51bGwoKSxcbiAgICAgICAgJ0FSRWRnZUxpc3QucG9zaXRpb25fR2V0UmVhbFg6IGVkZ2UgIT09IG51bGwgJiYgIWVkZ2UuaXNTdGFydFBvaW50TnVsbCgpICYmICFlZGdlLmlzRW5kUG9pbnROdWxsKCkgRkFJTEVEJyk7XG4gICAgdmFyIHgxLCB4MjtcblxuICAgIGlmICh0aGlzLmlzaG9yaXpvbnRhbCkge1xuICAgICAgICBhc3NlcnQoZWRnZS5zdGFydHBvaW50LnkgPT09IGVkZ2UuZW5kcG9pbnQueSxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0LnBvc2l0aW9uX0dldFJlYWxYOiBlZGdlLnN0YXJ0cG9pbnQueSA9PT0gZWRnZS5lbmRwb2ludC55IEZBSUxFRCcpO1xuXG4gICAgICAgIGlmIChlZGdlLnN0YXJ0cG9pbnQueCA8IGVkZ2UuZW5kcG9pbnQueCkge1xuXG4gICAgICAgICAgICB4MSA9IGVkZ2Uuc3RhcnRwb2ludC54O1xuICAgICAgICAgICAgeDIgPSBlZGdlLmVuZHBvaW50Lng7XG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgIHgxID0gZWRnZS5lbmRwb2ludC54O1xuICAgICAgICAgICAgeDIgPSBlZGdlLnN0YXJ0cG9pbnQueDtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGFzc2VydChlZGdlLnN0YXJ0cG9pbnQueCA9PT0gZWRnZS5lbmRwb2ludC54LFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QucG9zaXRpb25fR2V0UmVhbFg6IGVkZ2Uuc3RhcnRwb2ludC54ID09PSBlZGdlLmVuZHBvaW50LnggRkFJTEVEJyk7XG4gICAgICAgIGlmIChlZGdlLnN0YXJ0cG9pbnQueSA8IGVkZ2UuZW5kcG9pbnQueSkge1xuXG4gICAgICAgICAgICB4MSA9IGVkZ2Uuc3RhcnRwb2ludC55O1xuICAgICAgICAgICAgeDIgPSBlZGdlLmVuZHBvaW50Lnk7XG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgIHgxID0gZWRnZS5lbmRwb2ludC55O1xuICAgICAgICAgICAgeDIgPSBlZGdlLnN0YXJ0cG9pbnQueTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBbeDEsIHgyXTtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuX3Bvc2l0aW9uR2V0UmVhbE8gPSBmdW5jdGlvbiAoZWRnZSkge1xuICAgIGFzc2VydChlZGdlICE9PSBudWxsICYmICFlZGdlLmlzU3RhcnRQb2ludE51bGwoKSAmJiAhZWRnZS5pc0VuZFBvaW50TnVsbCgpLFxuICAgICAgICAnQVJFZGdlTGlzdC5wb3NpdGlvbl9HZXRSZWFsTzogZWRnZSAhPT0gbnVsbCAmJiAhZWRnZS5pc1N0YXJ0UG9pbnROdWxsKCkgJiYgIWVkZ2UuaXNFbmRQb2ludE51bGwoKSBGQUlMRUQnKTtcbiAgICB2YXIgbzEsIG8yO1xuXG4gICAgaWYgKHRoaXMuaXNob3Jpem9udGFsKSB7XG4gICAgICAgIGFzc2VydChlZGdlLnN0YXJ0cG9pbnQueSA9PT0gZWRnZS5lbmRwb2ludC55LFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QucG9zaXRpb25fR2V0UmVhbE86IGVkZ2Uuc3RhcnRwb2ludC55ID09PSBlZGdlLmVuZHBvaW50LnkgRkFJTEVEJyk7XG4gICAgICAgIGlmIChlZGdlLnN0YXJ0cG9pbnQueCA8IGVkZ2UuZW5kcG9pbnQueCkge1xuXG4gICAgICAgICAgICBvMSA9IGVkZ2UuaXNTdGFydFBvaW50UHJldk51bGwoKSA/IDAgOiBlZGdlLnN0YXJ0cG9pbnRQcmV2LnkgLSBlZGdlLnN0YXJ0cG9pbnQueTtcbiAgICAgICAgICAgIG8yID0gZWRnZS5pc0VuZFBvaW50TmV4dE51bGwoKSA/IDAgOiBlZGdlLmVuZHBvaW50TmV4dC55IC0gZWRnZS5lbmRwb2ludC55O1xuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICBvMSA9IGVkZ2UuaXNFbmRQb2ludE5leHROdWxsKCkgPyAwIDogZWRnZS5lbmRwb2ludE5leHQueSAtIGVkZ2UuZW5kcG9pbnQueTtcbiAgICAgICAgICAgIG8yID0gZWRnZS5pc1N0YXJ0UG9pbnRQcmV2TnVsbCgpID8gMCA6IGVkZ2Uuc3RhcnRwb2ludFByZXYueSAtIGVkZ2Uuc3RhcnRwb2ludC55O1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgYXNzZXJ0KGVkZ2Uuc3RhcnRwb2ludC54ID09PSBlZGdlLmVuZHBvaW50LngsXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5wb3NpdGlvbl9HZXRSZWFsTzogZWRnZS5zdGFydHBvaW50LnggPT09IGVkZ2UuZW5kcG9pbnQueCBGQUlMRUQnKTtcbiAgICAgICAgaWYgKGVkZ2Uuc3RhcnRwb2ludC55IDwgZWRnZS5lbmRwb2ludC55KSB7XG5cbiAgICAgICAgICAgIG8xID0gZWRnZS5pc1N0YXJ0UG9pbnRQcmV2TnVsbCgpID8gMCA6IGVkZ2Uuc3RhcnRwb2ludFByZXYueCAtIGVkZ2Uuc3RhcnRwb2ludC54O1xuICAgICAgICAgICAgbzIgPSBlZGdlLmlzRW5kUG9pbnROZXh0TnVsbCgpID8gMCA6IGVkZ2UuZW5kcG9pbnROZXh0LnggLSBlZGdlLmVuZHBvaW50Lng7XG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgIG8xID0gZWRnZS5pc0VuZFBvaW50TmV4dE51bGwoKSA/IDAgOiBlZGdlLmVuZHBvaW50TmV4dC54IC0gZWRnZS5lbmRwb2ludC54O1xuICAgICAgICAgICAgbzIgPSBlZGdlLmlzU3RhcnRQb2ludFByZXZOdWxsKCkgPyAwIDogZWRnZS5zdGFydHBvaW50UHJldi54IC0gZWRnZS5zdGFydHBvaW50Lng7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gW28xLCBvMl07XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLl9wb3NpdGlvbkxvYWRZID0gZnVuY3Rpb24gKGVkZ2UpIHtcbiAgICBhc3NlcnQoZWRnZSAhPT0gbnVsbCAmJiBlZGdlLm9yZGVyTmV4dCA9PT0gbnVsbCAmJiBlZGdlLm9yZGVyUHJldiA9PT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZUxpc3QucG9zaXRpb25fTG9hZFk6IGVkZ2UgIT09IG51bGwgJiYgZWRnZS5vcmRlck5leHQgPT09IG51bGwgJiYgZWRnZS5vcmRlclByZXYgPT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICBlZGdlLnBvc2l0aW9uWSA9IHRoaXMuX3Bvc2l0aW9uR2V0UmVhbFkoZWRnZSk7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLl9wb3NpdGlvbkxvYWRCID0gZnVuY3Rpb24gKGVkZ2UpIHtcbiAgICBhc3NlcnQoZWRnZSAhPT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZUxpc3QucG9zaXRpb25fTG9hZEI6IGVkZ2UgIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICBlZGdlLmJyYWNrZXRPcGVuaW5nID0gIWVkZ2UuZWRnZUZpeGVkICYmIHRoaXMuX2JyYWNrZXRJc09wZW5pbmcoZWRnZSk7XG4gICAgZWRnZS5icmFja2V0Q2xvc2luZyA9ICFlZGdlLmVkZ2VGaXhlZCAmJiB0aGlzLl9icmFja2V0SXNDbG9zaW5nKGVkZ2UpO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5fcG9zaXRpb25BbGxTdG9yZVkgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGVkZ2UgPSB0aGlzLm9yZGVyRmlyc3Q7XG4gICAgd2hpbGUgKGVkZ2UpIHtcbiAgICAgICAgdGhpcy5fcG9zaXRpb25TZXRSZWFsWShlZGdlLCBlZGdlLnBvc2l0aW9uWSk7XG4gICAgICAgIGVkZ2UgPSBlZGdlLm9yZGVyTmV4dDtcbiAgICB9XG5cbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuX3Bvc2l0aW9uQWxsTG9hZFggPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGVkZ2UgPSB0aGlzLm9yZGVyRmlyc3QsXG4gICAgICAgIHB0cztcbiAgICB3aGlsZSAoZWRnZSkge1xuICAgICAgICBwdHMgPSB0aGlzLl9wb3NpdGlvbkdldFJlYWxYKGVkZ2UpO1xuICAgICAgICBlZGdlLnBvc2l0aW9uWDEgPSBwdHNbMF07XG4gICAgICAgIGVkZ2UucG9zaXRpb25YMiA9IHB0c1sxXTtcblxuICAgICAgICBlZGdlID0gZWRnZS5vcmRlck5leHQ7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5faW5pdE9yZGVyID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMub3JkZXJGaXJzdCA9IG51bGw7XG4gICAgdGhpcy5vcmRlckxhc3QgPSBudWxsO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5fY2hlY2tPcmRlciA9IGZ1bmN0aW9uICgpIHtcbiAgICBhc3NlcnQodGhpcy5vcmRlckZpcnN0ID09PSBudWxsICYmIHRoaXMub3JkZXJMYXN0ID09PSBudWxsLFxuICAgICAgICAnQVJFZGdlTGlzdC5jaGVja09yZGVyOiB0aGlzLm9yZGVyRmlyc3QgPT09IG51bGwgJiYgdGhpcy5vcmRlckxhc3QgPT09IG51bGwgRkFJTEVEJyk7XG59O1xuXG4vLy0tLU9yZGVyXG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuaW5zZXJ0QmVmb3JlID0gZnVuY3Rpb24gKGVkZ2UsIGJlZm9yZSkge1xuICAgIGFzc2VydChlZGdlICE9PSBudWxsICYmIGJlZm9yZSAhPT0gbnVsbCAmJiBlZGdlICE9PSBiZWZvcmUsXG4gICAgICAgICdBUkVkZ2VMaXN0Lmluc2VydEJlZm9yZTogZWRnZSAhPT0gbnVsbCAmJiBiZWZvcmUgIT09IG51bGwgJiYgZWRnZSAhPT0gYmVmb3JlIEZBSUxFRCcpO1xuICAgIGFzc2VydChlZGdlLm9yZGVyTmV4dCA9PT0gbnVsbCAmJiBlZGdlLm9yZGVyUHJldiA9PT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZUxpc3QuaW5zZXJ0QmVmb3JlOiBlZGdlLm9yZGVyTmV4dCA9PT0gbnVsbCAmJiBlZGdlLm9yZGVyUHJldiA9PT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIGVkZ2Uub3JkZXJQcmV2ID0gYmVmb3JlLm9yZGVyUHJldjtcbiAgICBlZGdlLm9yZGVyTmV4dCA9IGJlZm9yZTtcblxuICAgIGlmIChiZWZvcmUub3JkZXJQcmV2KSB7XG4gICAgICAgIGFzc2VydChiZWZvcmUub3JkZXJQcmV2Lm9yZGVyTmV4dCA9PT0gYmVmb3JlLFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QuaW5zZXJ0QmVmb3JlOiBiZWZvcmUub3JkZXJQcmV2Lm9yZGVyTmV4dCA9PT0gYmVmb3JlIEZBSUxFRFxcbmJlZm9yZS5vcmRlclByZXYub3JkZXJOZXh0ICcgK1xuICAgICAgICAgICAgJ2lzICcgKyBiZWZvcmUub3JkZXJQcmV2Lm9yZGVyTmV4dCArICcgYW5kIGJlZm9yZSBpcyAnICsgYmVmb3JlKTtcblxuICAgICAgICBiZWZvcmUub3JkZXJQcmV2Lm9yZGVyTmV4dCA9IGVkZ2U7XG5cbiAgICAgICAgYXNzZXJ0KHRoaXMub3JkZXJGaXJzdCAhPT0gYmVmb3JlLFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QuaW5zZXJ0QmVmb3JlOiB0aGlzLm9yZGVyRmlyc3QgIT09IGJlZm9yZSBGQUlMRUQnKTtcbiAgICB9IGVsc2Uge1xuXG4gICAgICAgIGFzc2VydCh0aGlzLm9yZGVyRmlyc3QgPT09IGJlZm9yZSxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0Lmluc2VydEJlZm9yZTogdGhpcy5vcmRlckZpcnN0ID09PSBiZWZvcmUgRkFJTEVEJyk7XG4gICAgICAgIHRoaXMub3JkZXJGaXJzdCA9IGVkZ2U7XG4gICAgfVxuXG4gICAgYmVmb3JlLm9yZGVyUHJldiA9IGVkZ2U7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLmluc2VydEFmdGVyID0gZnVuY3Rpb24gKGVkZ2UsIGFmdGVyKSB7XG4gICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwgJiYgYWZ0ZXIgIT09IG51bGwgJiYgIWVkZ2UuZXF1YWxzKGFmdGVyKSxcbiAgICAgICAgJ0FSRWRnZUxpc3QuaW5zZXJ0QWZ0ZXI6ICBlZGdlICE9PSBudWxsICYmIGFmdGVyICE9PSBudWxsICYmICFlZGdlLmVxdWFscyhhZnRlcikgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KGVkZ2Uub3JkZXJOZXh0ID09PSBudWxsICYmIGVkZ2Uub3JkZXJQcmV2ID09PSBudWxsLFxuICAgICAgICAnQVJFZGdlTGlzdC5pbnNlcnRBZnRlcjogZWRnZS5vcmRlck5leHQgPT09IG51bGwgJiYgZWRnZS5vcmRlclByZXYgPT09IG51bGwgRkFJTEVEICcpO1xuXG4gICAgZWRnZS5vcmRlck5leHQgPSBhZnRlci5vcmRlck5leHQ7XG4gICAgZWRnZS5vcmRlclByZXYgPSBhZnRlcjtcblxuICAgIGlmIChhZnRlci5vcmRlck5leHQpIHtcbiAgICAgICAgYXNzZXJ0KGFmdGVyLm9yZGVyTmV4dC5vcmRlclByZXYuZXF1YWxzKGFmdGVyKSxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0Lmluc2VydEFmdGVyOiAgYWZ0ZXIub3JkZXJOZXh0Lm9yZGVyUHJldi5lcXVhbHMoYWZ0ZXIpIEZBSUxFRCcpO1xuICAgICAgICBhZnRlci5vcmRlck5leHQub3JkZXJQcmV2ID0gZWRnZTtcblxuICAgICAgICBhc3NlcnQoIXRoaXMub3JkZXJMYXN0LmVxdWFscyhhZnRlciksICdBUkVkZ2VMaXN0Lmluc2VydEFmdGVyOiAhb3JkZXJMYXN0LmVxdWFscyhhZnRlcikgRkFJTEVEJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgYXNzZXJ0KHRoaXMub3JkZXJMYXN0LmVxdWFscyhhZnRlciksICdBUkVkZ2VMaXN0Lmluc2VydEFmdGVyOiB0aGlzLm9yZGVyTGFzdC5lcXVhbHMoYWZ0ZXIpIEZBSUxFRCcpO1xuICAgICAgICB0aGlzLm9yZGVyTGFzdCA9IGVkZ2U7XG4gICAgfVxuXG4gICAgYWZ0ZXIub3JkZXJOZXh0ID0gZWRnZTtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuaW5zZXJ0TGFzdCA9IGZ1bmN0aW9uIChlZGdlKSB7XG4gICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwsXG4gICAgICAgICdBUkVkZ2VMaXN0Lmluc2VydExhc3Q6IGVkZ2UgIT09IG51bGwgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KGVkZ2Uub3JkZXJQcmV2ID09PSBudWxsICYmIGVkZ2Uub3JkZXJOZXh0ID09PSBudWxsLFxuICAgICAgICAnQVJFZGdlTGlzdC5pbnNlcnRMYXN0OiBlZGdlLm9yZGVyUHJldiA9PT0gbnVsbCAmJiBlZGdlLm9yZGVyTmV4dCA9PT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIGVkZ2Uub3JkZXJQcmV2ID0gdGhpcy5vcmRlckxhc3Q7XG5cbiAgICBpZiAodGhpcy5vcmRlckxhc3QpIHtcbiAgICAgICAgYXNzZXJ0KHRoaXMub3JkZXJMYXN0Lm9yZGVyTmV4dCA9PT0gbnVsbCxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0Lmluc2VydExhc3Q6IHRoaXMub3JkZXJMYXN0Lm9yZGVyTmV4dCA9PT0gbnVsbCBGQUlMRUQnKTtcbiAgICAgICAgYXNzZXJ0KHRoaXMub3JkZXJGaXJzdCAhPT0gbnVsbCxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0Lmluc2VydExhc3Q6IHRoaXMub3JkZXJGaXJzdCAhPSBudWxsIEZBSUxFRCcpO1xuXG4gICAgICAgIHRoaXMub3JkZXJMYXN0Lm9yZGVyTmV4dCA9IGVkZ2U7XG4gICAgICAgIHRoaXMub3JkZXJMYXN0ID0gZWRnZTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBhc3NlcnQodGhpcy5vcmRlckZpcnN0ID09PSBudWxsLFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QuaW5zZXJ0TGFzdDogIHRoaXMub3JkZXJGaXJzdCA9PT0gbnVsbCBGQUlMRUQnKTtcblxuICAgICAgICB0aGlzLm9yZGVyRmlyc3QgPSBlZGdlO1xuICAgICAgICB0aGlzLm9yZGVyTGFzdCA9IGVkZ2U7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5pbnNlcnQgPSBmdW5jdGlvbiAoZWRnZSkge1xuICAgIGFzc2VydChlZGdlICE9PSBudWxsLFxuICAgICAgICAnQVJFZGdlTGlzdC5pbnNlcnQ6ICBlZGdlICE9PSBudWxsIEZBSUxFRCcpO1xuICAgIGFzc2VydChlZGdlLm9yZGVyUHJldiA9PT0gbnVsbCAmJiBlZGdlLm9yZGVyTmV4dCA9PT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZUxpc3QuaW5zZXJ0OiBlZGdlLm9yZGVyUHJldiA9PT0gbnVsbCAmJiBlZGdlLm9yZGVyTmV4dCA9PT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIHZhciB5ID0gZWRnZS5wb3NpdGlvblk7XG5cbiAgICBhc3NlcnQoQ09OU1RBTlRTLkVEX01JTkNPT1JEIDw9IHkgJiYgeSA8PSBDT05TVEFOVFMuRURfTUFYQ09PUkQsXG4gICAgICAgICdBUkVkZ2VMaXN0Lmluc2VydDogQ09OU1RBTlRTLkVEX01JTkNPT1JEIDw9IHkgJiYgeSA8PSBDT05TVEFOVFMuRURfTUFYQ09PUkQgRkFJTEVEICh5IGlzICcgKyB5ICsgJyknKTtcblxuICAgIHZhciBpbnNlcnQgPSB0aGlzLm9yZGVyRmlyc3Q7XG5cbiAgICB3aGlsZSAoaW5zZXJ0ICYmIGluc2VydC5wb3NpdGlvblkgPCB5KSB7XG4gICAgICAgIGluc2VydCA9IGluc2VydC5vcmRlck5leHQ7XG4gICAgfVxuXG4gICAgaWYgKGluc2VydCkge1xuICAgICAgICB0aGlzLmluc2VydEJlZm9yZShlZGdlLCBpbnNlcnQpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuaW5zZXJ0TGFzdChlZGdlKTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLnJlbW92ZSA9IGZ1bmN0aW9uIChlZGdlKSB7XG4gICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwsXG4gICAgICAgICdBUkVkZ2VMaXN0LnJlbW92ZTogIGVkZ2UgIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICBpZiAodGhpcy5vcmRlckZpcnN0ID09PSBlZGdlKSB7XG4gICAgICAgIHRoaXMub3JkZXJGaXJzdCA9IGVkZ2Uub3JkZXJOZXh0O1xuICAgIH1cblxuICAgIGlmIChlZGdlLm9yZGVyTmV4dCkge1xuICAgICAgICBlZGdlLm9yZGVyTmV4dC5vcmRlclByZXYgPSBlZGdlLm9yZGVyUHJldjtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5vcmRlckxhc3QgPT09IGVkZ2UpIHtcbiAgICAgICAgdGhpcy5vcmRlckxhc3QgPSBlZGdlLm9yZGVyUHJldjtcbiAgICB9XG5cbiAgICBpZiAoZWRnZS5vcmRlclByZXYpIHtcbiAgICAgICAgZWRnZS5vcmRlclByZXYub3JkZXJOZXh0ID0gZWRnZS5vcmRlck5leHQ7XG4gICAgfVxuXG4gICAgZWRnZS5vcmRlck5leHQgPSBudWxsO1xuICAgIGVkZ2Uub3JkZXJQcmV2ID0gbnVsbDtcbn07XG5cbi8vLS0gUHJpdmF0ZVxuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLl9zbGlkZUJ1dE5vdFBhc3NFZGdlcyA9IGZ1bmN0aW9uIChlZGdlLCB5KSB7XG4gICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwsICdBUkVkZ2VMaXN0LnNsaWRlQnV0Tm90UGFzc0VkZ2VzOiBlZGdlICE9IG51bGwgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KENPTlNUQU5UUy5FRF9NSU5DT09SRCA8IHkgJiYgeSA8IENPTlNUQU5UUy5FRF9NQVhDT09SRCxcbiAgICAgICAgJ0FSRWRnZUxpc3Quc2xpZGVCdXROb3RQYXNzRWRnZXM6IENPTlNUQU5UUy5FRF9NSU5DT09SRCA8IHkgJiYgeSA8IENPTlNUQU5UUy5FRF9NQVhDT09SRCBGQUlMRUQnKTtcblxuICAgIHZhciBvbGR5ID0gZWRnZS5wb3NpdGlvblk7XG4gICAgYXNzZXJ0KENPTlNUQU5UUy5FRF9NSU5DT09SRCA8IG9sZHkgJiYgb2xkeSA8IENPTlNUQU5UUy5FRF9NQVhDT09SRCxcbiAgICAgICAgJ0FSRWRnZUxpc3Quc2xpZGVCdXROb3RQYXNzRWRnZXM6IENPTlNUQU5UUy5FRF9NSU5DT09SRCA8IG9sZHkgJiYgb2xkeSA8IENPTlNUQU5UUy5FRF9NQVhDT09SRCBGQUlMRUQnKTtcblxuICAgIGlmIChvbGR5ID09PSB5KSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHZhciB4MSA9IGVkZ2UucG9zaXRpb25YMSxcbiAgICAgICAgeDIgPSBlZGdlLnBvc2l0aW9uWDIsXG4gICAgICAgIHJldCA9IG51bGwsXG4gICAgICAgIGluc2VydCA9IGVkZ2U7XG5cbiAgICAvL0lmIHdlIGFyZSB0cnlpbmcgdG8gc2xpZGUgZG93blxuXG4gICAgaWYgKG9sZHkgPCB5KSB7XG4gICAgICAgIHdoaWxlIChpbnNlcnQub3JkZXJOZXh0KSB7XG4gICAgICAgICAgICBpbnNlcnQgPSBpbnNlcnQub3JkZXJOZXh0O1xuXG4gICAgICAgICAgICBpZiAoeSA8IGluc2VydC5wb3NpdGlvblkpIHtcbiAgICAgICAgICAgICAgICAvL1RoZW4gd2Ugd29uJ3QgYmUgc2hpZnRpbmcgcGFzdCB0aGUgbmV3IGVkZ2UgKGluc2VydClcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy9JZiB5b3UgY2FuJ3QgcGFzcyB0aGUgZWRnZSAoYnV0IHdhbnQgdG8pIGFuZCB0aGUgbGluZXMgd2lsbCBvdmVybGFwIHggdmFsdWVzLi4uXG4gICAgICAgICAgICBpZiAoIWluc2VydC5nZXRFZGdlQ2FucGFzc2VkKCkgJiYgVXRpbHMuaW50ZXJzZWN0KHgxLCB4MiwgaW5zZXJ0LnBvc2l0aW9uWDEsIGluc2VydC5wb3NpdGlvblgyKSkge1xuICAgICAgICAgICAgICAgIHJldCA9IGluc2VydDtcbiAgICAgICAgICAgICAgICB5ID0gaW5zZXJ0LnBvc2l0aW9uWTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChlZGdlICE9PSBpbnNlcnQgJiYgaW5zZXJ0Lm9yZGVyUHJldiAhPT0gZWRnZSkge1xuICAgICAgICAgICAgdGhpcy5yZW1vdmUoZWRnZSk7XG4gICAgICAgICAgICB0aGlzLmluc2VydEJlZm9yZShlZGdlLCBpbnNlcnQpO1xuICAgICAgICB9XG5cbiAgICB9IGVsc2UgeyAvLyBJZiB3ZSBhcmUgdHJ5aW5nIHRvIHNsaWRlIHVwXG4gICAgICAgIHdoaWxlIChpbnNlcnQub3JkZXJQcmV2KSB7XG4gICAgICAgICAgICBpbnNlcnQgPSBpbnNlcnQub3JkZXJQcmV2O1xuXG4gICAgICAgICAgICBpZiAoeSA+IGluc2VydC5wb3NpdGlvblkpIHtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy9JZiBpbnNlcnQgY2Fubm90IGJlIHBhc3NlZCBhbmQgaXQgaXMgaW4gdGhlIHdheSBvZiB0aGUgZWRnZSAoaWYgdGhlIGVkZ2Ugd2VyZSB0byBzbGlkZSB1cCkuXG4gICAgICAgICAgICBpZiAoIWluc2VydC5nZXRFZGdlQ2FucGFzc2VkKCkgJiYgVXRpbHMuaW50ZXJzZWN0KHgxLCB4MiwgaW5zZXJ0LnBvc2l0aW9uWDEsIGluc2VydC5wb3NpdGlvblgyKSkge1xuICAgICAgICAgICAgICAgIHJldCA9IGluc2VydDtcbiAgICAgICAgICAgICAgICB5ID0gaW5zZXJ0LnBvc2l0aW9uWTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChlZGdlICE9PSBpbnNlcnQgJiYgaW5zZXJ0Lm9yZGVyTmV4dCAhPT0gZWRnZSkge1xuICAgICAgICAgICAgdGhpcy5yZW1vdmUoZWRnZSk7Ly9UaGlzIGlzIHdoZXJlIEkgYmVsaWV2ZSB0aGUgZXJyb3IgY291bGQgbGllIVxuICAgICAgICAgICAgdGhpcy5pbnNlcnRBZnRlcihlZGdlLCBpbnNlcnQpO1xuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICBlZGdlLnBvc2l0aW9uWSA9IHk7XG5cbiAgICByZXR1cm4gcmV0O1xufTtcblxuLy8tLS0tLS1TZWN0aW9uXG5cbi8vIHByaXZhdGVcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5faW5pdFNlY3Rpb24gPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5zZWN0aW9uRmlyc3QgPSBudWxsO1xuICAgIHRoaXMuc2VjdGlvbkJsb2NrZXIgPSBudWxsO1xuICAgIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkID0gbnVsbDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuY2hlY2tTZWN0aW9uID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICghKHRoaXMuc2VjdGlvbkJsb2NrZXIgPT09IG51bGwgJiYgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgPT09IG51bGwpKSB7XG4gICAgICAgIC8vIFRoaXMgdXNlZCB0byBiZSBjb250YWluZWQgaW4gYW4gYXNzZXJ0LlxuICAgICAgICAvLyBHZW5lcmFsbHkgdGhpcyBmYWlscyB3aGVuIHRoZSByb3V0ZXIgZG9lcyBub3QgaGF2ZSBhIGNsZWFuIGV4aXQgdGhlbiBpcyBhc2tlZCB0byByZXJvdXRlLlxuICAgICAgICB0aGlzLl9sb2dnZXIud2Fybignc2VjdGlvbkJsb2NrZXIgYW5kIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkIGFyZSBub3QgbnVsbC4gJyArXG4gICAgICAgICdBc3N1bWluZyBsYXN0IHJ1biBkaWQgbm90IGV4aXQgY2xlYW5seS4gRml4aW5nLi4uJyk7XG4gICAgICAgIHRoaXMuc2VjdGlvbkJsb2NrZXIgPSBudWxsO1xuICAgICAgICB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCA9IG51bGw7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5zZWN0aW9uUmVzZXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5jaGVja1NlY3Rpb24oKTtcblxuICAgIHRoaXMuc2VjdGlvbkZpcnN0ID0gbnVsbDtcbn07XG5cbi8qKlxuICogSW5pdGlhbGl6ZSB0aGUgc2VjdGlvbiBkYXRhIHN0cnVjdHVyZS5cbiAqXG4gKiBAcGFyYW0gYmxvY2tlclxuICogQHJldHVybiB7dW5kZWZpbmVkfVxuICovXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLl9zZWN0aW9uQmVnaW5TY2FuID0gZnVuY3Rpb24gKGJsb2NrZXIpIHtcbiAgICB0aGlzLmNoZWNrU2VjdGlvbigpO1xuXG4gICAgdGhpcy5zZWN0aW9uQmxvY2tlciA9IGJsb2NrZXI7XG5cbiAgICB0aGlzLnNlY3Rpb25CbG9ja2VyLnNlY3Rpb25YMSA9IHRoaXMuc2VjdGlvbkJsb2NrZXIucG9zaXRpb25YMTtcbiAgICB0aGlzLnNlY3Rpb25CbG9ja2VyLnNlY3Rpb25YMiA9IHRoaXMuc2VjdGlvbkJsb2NrZXIucG9zaXRpb25YMjtcblxuICAgIHRoaXMuc2VjdGlvbkJsb2NrZXIuc2V0U2VjdGlvbk5leHQobnVsbCk7XG4gICAgdGhpcy5zZWN0aW9uQmxvY2tlci5zZXRTZWN0aW9uRG93bihudWxsKTtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuX3NlY3Rpb25Jc0ltbWVkaWF0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICBhc3NlcnQodGhpcy5zZWN0aW9uQmxvY2tlciAhPT0gbnVsbCAmJiB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCAhPT0gbnVsbCAmJiB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCAhPT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZUxpc3QuX3NlY3Rpb25Jc0ltbWVkaWF0ZTogdGhpcy5zZWN0aW9uQmxvY2tlciAhPSBudWxsICYmIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkICE9IG51bGwgJyArXG4gICAgICAgICcmJiAqc2VjdGlvblB0cjJCbG9ja2VkICE9IG51bGwgRkFJTEVEJyk7XG5cbiAgICB2YXIgc2VjdGlvbkJsb2NrZWQgPSB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZFswXSxcbiAgICAgICAgZSA9IHNlY3Rpb25CbG9ja2VkLmdldFNlY3Rpb25Eb3duKCksXG4gICAgICAgIGExID0gc2VjdGlvbkJsb2NrZWQuc2VjdGlvblgxLFxuICAgICAgICBhMiA9IHNlY3Rpb25CbG9ja2VkLnNlY3Rpb25YMixcbiAgICAgICAgcDEgPSBzZWN0aW9uQmxvY2tlZC5wb3NpdGlvblgxLFxuICAgICAgICBwMiA9IHNlY3Rpb25CbG9ja2VkLnBvc2l0aW9uWDIsXG4gICAgICAgIGIxID0gdGhpcy5zZWN0aW9uQmxvY2tlci5zZWN0aW9uWDEsXG4gICAgICAgIGIyID0gdGhpcy5zZWN0aW9uQmxvY2tlci5zZWN0aW9uWDI7XG5cbiAgICBpZiAoZSAhPT0gbnVsbCkge1xuICAgICAgICBlID0gKGUuc3RhcnRwb2ludCA9PT0gbnVsbCB8fCBlLnNlY3Rpb25YMSA9PT0gdW5kZWZpbmVkID8gbnVsbCA6IGUpO1xuICAgIH1cblxuICAgIGFzc2VydChiMSA8PSBhMiAmJiBhMSA8PSBiMixcbiAgICAgICAgJ0FSRWRnZUxpc3QuX3NlY3Rpb25Jc0ltbWVkaWF0ZTogYjEgPD0gYTIgJiYgYTEgPD0gYjIgRkFJTEVEJyk7ICAgICAgICAgICAgICAgICAgICAgLy8gbm90IGNhc2UgMSBvciA2XG5cbiAgICAvLyBOT1RFIFdFIENIQU5HRUQgVEhFIENPTkRJVElPTlMgKEExPD1CMSBBTkQgQjI8PUEyKVxuICAgIC8vIEJFQ0FVU0UgSEVSRSBXRSBORUVEIFRISVMhXG5cbiAgICBpZiAoYTEgPD0gYjEpIHtcbiAgICAgICAgd2hpbGUgKCEoZSA9PT0gbnVsbCB8fCBlLnN0YXJ0cG9pbnQgPT09IG51bGwpICYmIGUuc2VjdGlvblgyIDwgYjEpIHtcbiAgICAgICAgICAgIGUgPSBlLmdldFNlY3Rpb25OZXh0KCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYjIgPD0gYTIpIHtcbiAgICAgICAgICAgIHJldHVybiAoZSA9PT0gbnVsbCB8fCBlLnN0YXJ0cG9pbnQgPT09IG51bGwpIHx8IGIyIDwgZS5zZWN0aW9uWDE7ICAgICAgICAgICAgICAgLy8gY2FzZSAzXG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gKGUgPT09IG51bGwgfHwgZS5zdGFydHBvaW50ID09PSBudWxsKSAmJiBhMiA9PT0gcDI7ICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjYXNlIDJcbiAgICB9XG5cbiAgICBpZiAoYjIgPD0gYTIpIHtcbiAgICAgICAgcmV0dXJuIGExID09PSBwMSAmJiAoKGUgPT09IG51bGwgfHwgZS5zdGFydHBvaW50ID09PSBudWxsKSB8fCBiMiA8IGUuc2VjdGlvblgxKTsgICAgLy8gY2FzZSA1XG4gICAgfVxuXG4gICAgcmV0dXJuIChlID09PSBudWxsIHx8IGUuc3RhcnRwb2ludCA9PT0gbnVsbCkgJiYgYTEgPT09IHAxICYmIGEyID09PSBwMjsgICAgICAgICAgICAgICAgIC8vIGNhc2UgNFxufTtcblxuXG4vLyBUaGUgZm9sbG93aW5nIG1ldGhvZHMgYXJlIGNvbnZlbmllbmNlIG1ldGhvZHMgZm9yIGFkanVzdGluZyB0aGUgJ3NlY3Rpb24nIFxuLy8gb2YgYW4gZWRnZS5cbi8qKlxuICogR2V0IGVpdGhlciBtaW4rMSBvciBhIHZhbHVlIGJldHdlZW4gbWluIGFuZCBtYXguIFRlY2huaWNhbGx5LFxuICogd2UgYXJlIGxvb2tpbmcgZm9yIFttaW4sIG1heCkuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IG1pblxuICogQHBhcmFtIHtOdW1iZXJ9IG1heFxuICogQHJldHVybiB7TnVtYmVyfSByZXN1bHRcbiAqL1xudmFyIGdldExhcmdlckVuZHBvaW50ID0gZnVuY3Rpb24gKG1pbiwgbWF4KSB7XG4gICAgdmFyIHJlc3VsdDtcbiAgICBhc3NlcnQobWluIDwgbWF4KTtcblxuICAgIHJlc3VsdCA9IE1hdGgubWluKG1pbiArIDEsIChtaW4gKyBtYXgpIC8gMik7XG4gICAgaWYgKHJlc3VsdCA9PT0gbWF4KSB7XG4gICAgICAgIHJlc3VsdCA9IG1pbjtcbiAgICB9XG4gICAgYXNzZXJ0KHJlc3VsdCA8IG1heCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbi8qKlxuICogR2V0IGVpdGhlciBtYXgtMSBvciBhIHZhbHVlIGJldHdlZW4gbWluIGFuZCBtYXguIFRlY2huaWNhbGx5LFxuICogd2UgYXJlIGxvb2tpbmcgZm9yIChtaW4sIG1heF0uXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IG1pblxuICogQHBhcmFtIHtOdW1iZXJ9IG1heFxuICogQHJldHVybiB7TnVtYmVyfSByZXN1bHRcbiAqL1xudmFyIGdldFNtYWxsZXJFbmRwb2ludCA9IGZ1bmN0aW9uIChtaW4sIG1heCkge1xuICAgIHZhciByZXN1bHQ7XG4gICAgYXNzZXJ0KG1pbiA8IG1heCk7XG5cbiAgICAvLyBJZiBtaW4gaXMgc28gc21hbGwgdGhhdCBcbiAgICAvLyBcbiAgICAvLyAgICAgIChtaW4rbWF4KS8yID09PSBtaW5cbiAgICAvL1xuICAgIC8vIHRoZW4gd2Ugd2lsbCBzaW1wbHkgdXNlIG1heCB2YWx1ZSBmb3IgdGhlIHJlc3VsdFxuICAgIHJlc3VsdCA9IE1hdGgubWF4KG1heCAtIDEsIChtaW4gKyBtYXgpIC8gMik7XG4gICAgaWYgKHJlc3VsdCA9PT0gbWluKSB7XG4gICAgICAgIHJlc3VsdCA9IG1heDtcbiAgICB9XG5cbiAgICBhc3NlcnQocmVzdWx0ID4gbWluKTtcbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5fc2VjdGlvbkhhc0Jsb2NrZWRFZGdlID0gZnVuY3Rpb24gKCkge1xuICAgIGFzc2VydCh0aGlzLnNlY3Rpb25CbG9ja2VyICE9PSBudWxsLFxuICAgICAgICAnQVJFZGdlTGlzdC5fc2VjdGlvbkhhc0Jsb2NrZWRFZGdlOiB0aGlzLnNlY3Rpb25CbG9ja2VyICE9IG51bGwgRkFJTEVEJyk7XG5cbiAgICB2YXIgbmV3U2VjdGlvblgxLFxuICAgICAgICBuZXdTZWN0aW9uWDIsXG4gICAgICAgIGUsXG4gICAgICAgIGJsb2NrZXJYMSA9IHRoaXMuc2VjdGlvbkJsb2NrZXIuc2VjdGlvblgxLFxuICAgICAgICBibG9ja2VyWDIgPSB0aGlzLnNlY3Rpb25CbG9ja2VyLnNlY3Rpb25YMjtcblxuICAgIGFzc2VydChibG9ja2VyWDEgPD0gYmxvY2tlclgyLFxuICAgICAgICAnQVJFZGdlTGlzdC5fc2VjdGlvbkhhc0Jsb2NrZWRFZGdlOiBibG9ja2VyWDEgPD0gYmxvY2tlclgyIEZBSUxFRCcpO1xuXG4gICAgLy8gU2V0dGluZyB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZFxuICAgIGlmICh0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCA9PT0gbnVsbCkgeyAgLy8gaW5pdGlhbGl6ZSBzZWN0aW9uUHRyMkJsb2NrZWRcblxuICAgICAgICB0aGlzLnNlY3Rpb25GaXJzdCA9IHRoaXMuc2VjdGlvbkZpcnN0ID09PSBudWxsID8gW25ldyBBdXRvUm91dGVyRWRnZSgpXSA6IHRoaXMuc2VjdGlvbkZpcnN0O1xuICAgICAgICB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCA9IHRoaXMuc2VjdGlvbkZpcnN0O1xuICAgIH0gZWxzZSB7ICAgLy8gZ2V0IG5leHQgc2VjdGlvblB0cjJCbG9ja2VkXG4gICAgICAgIHZhciBjdXJyZW50RWRnZSA9IHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkWzBdO1xuXG4gICAgICAgIGFzc2VydChjdXJyZW50RWRnZS5zdGFydHBvaW50ICE9PSBudWxsLFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QuX3NlY3Rpb25IYXNCbG9ja2VkRWRnZTogY3VycmVudEVkZ2Uuc3RhcnRwb2ludCA9PT0gbnVsbCcpO1xuXG4gICAgICAgIHZhciBvID0gbnVsbDtcblxuICAgICAgICBlID0gY3VycmVudEVkZ2UuZ2V0U2VjdGlvbkRvd25QdHIoKVswXTtcbiAgICAgICAgbmV3U2VjdGlvblgxID0gY3VycmVudEVkZ2Uuc2VjdGlvblgxO1xuICAgICAgICBuZXdTZWN0aW9uWDIgPSBjdXJyZW50RWRnZS5zZWN0aW9uWDI7XG5cbiAgICAgICAgYXNzZXJ0KG5ld1NlY3Rpb25YMSA8PSBuZXdTZWN0aW9uWDIsXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5fc2VjdGlvbkhhc0Jsb2NrZWRFZGdlOiBuZXdTZWN0aW9uWDEgPD0gbmV3U2VjdGlvblgyIEZBSUxFRCAoJyArIG5ld1NlY3Rpb25YMSArXG4gICAgICAgICAgICAnIDw9ICcgKyBuZXdTZWN0aW9uWDIgKyAnKScgKyAnXFxuZWRnZSBpcyAnKTtcblxuICAgICAgICBhc3NlcnQoYmxvY2tlclgxIDw9IG5ld1NlY3Rpb25YMiAmJiBuZXdTZWN0aW9uWDEgPD0gYmxvY2tlclgyLFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QuX3NlY3Rpb25IYXNCbG9ja2VkRWRnZTogYmxvY2tlclgxIDw9IG5ld1NlY3Rpb25YMiAmJiAgbmV3U2VjdGlvblgxIDw9IGJsb2NrZXJYMiBGQUlMRUQnKTtcbiAgICAgICAgLy8gbm90IGNhc2UgMSBvciA2XG4gICAgICAgIGlmIChuZXdTZWN0aW9uWDEgPCBibG9ja2VyWDEgJiYgYmxvY2tlclgyIDwgbmV3U2VjdGlvblgyKSB7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY2FzZSAzXG4gICAgICAgICAgICB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCA9IGN1cnJlbnRFZGdlLmdldFNlY3Rpb25Eb3duUHRyKCk7XG5cbiAgICAgICAgfSBlbHNlIGlmIChibG9ja2VyWDEgPD0gbmV3U2VjdGlvblgxICYmIG5ld1NlY3Rpb25YMiA8PSBibG9ja2VyWDIpIHsgICAgICAgICAgICAgICAgICAgICAgICAvLyBjYXNlIDRcblxuICAgICAgICAgICAgaWYgKGUgJiYgZS5zdGFydHBvaW50ICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgd2hpbGUgKGUuZ2V0U2VjdGlvbk5leHQoKSAmJiBlLmdldFNlY3Rpb25OZXh0KCkuc3RhcnRwb2ludCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICBlID0gZS5nZXRTZWN0aW9uTmV4dCgpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGUuc2V0U2VjdGlvbk5leHQoY3VycmVudEVkZ2UuZ2V0U2VjdGlvbk5leHQoKSk7XG4gICAgICAgICAgICAgICAgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRbMF0gPSBjdXJyZW50RWRnZS5nZXRTZWN0aW9uRG93bigpO1xuICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkWzBdID0gKGN1cnJlbnRFZGdlLmdldFNlY3Rpb25OZXh0KCkpO1xuXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoYmxvY2tlclgxIDw9IG5ld1NlY3Rpb25YMSAmJiBibG9ja2VyWDIgPCBuZXdTZWN0aW9uWDIpIHsgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY2FzZSA1XG5cbiAgICAgICAgICAgIGFzc2VydChuZXdTZWN0aW9uWDEgPD0gYmxvY2tlclgyLFxuICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0Ll9zZWN0aW9uSGFzQmxvY2tlZEVkZ2U6IG5ld1NlY3Rpb25YMSA8PSBibG9ja2VyWDIgRkFJTEVEJyk7XG5cbiAgICAgICAgICAgIC8vIE1vdmUgbmV3U2VjdGlvblgxIHN1Y2ggdGhhdCBibG9ja2VyWDIgPCBuZXdTZWN0aW9uWDEgPCBuZXdTZWN0aW9uWDJcbiAgICAgICAgICAgIG5ld1NlY3Rpb25YMSA9IGdldExhcmdlckVuZHBvaW50KGJsb2NrZXJYMiwgbmV3U2VjdGlvblgyKTtcblxuICAgICAgICAgICAgd2hpbGUgKChlICYmIGUuc3RhcnRwb2ludCAhPT0gbnVsbCkgJiYgZS5zZWN0aW9uWDEgPD0gbmV3U2VjdGlvblgxKSB7XG4gICAgICAgICAgICAgICAgYXNzZXJ0KGUuc2VjdGlvblgxIDw9IGUuc2VjdGlvblgyLFxuICAgICAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5fc2VjdGlvbkhhc0Jsb2NrZWRFZGdlOiBlLnNlY3Rpb25YMSA8PSBlLnNlY3Rpb25YMiBGQUlMRUQnKTtcblxuICAgICAgICAgICAgICAgIGlmIChuZXdTZWN0aW9uWDEgPD0gZS5zZWN0aW9uWDIpIHtcbiAgICAgICAgICAgICAgICAgICAgbmV3U2VjdGlvblgxID0gZ2V0TGFyZ2VyRW5kcG9pbnQoZS5zZWN0aW9uWDIsIG5ld1NlY3Rpb25YMik7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbyA9IGU7XG4gICAgICAgICAgICAgICAgZSA9IGUuZ2V0U2VjdGlvbk5leHQoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG8pIHtcbiAgICAgICAgICAgICAgICAvLyBJbnNlcnQgY3VycmVudEVkZ2UgdG8gYmUgc2VjdGlvbk5leHQgb2YgdGhlIGdpdmVuIGVkZ2UgaW4gdGhlIGxpc3QgXG4gICAgICAgICAgICAgICAgLy8gb2Ygc2VjdGlvbkRvd24gKGJhc2ljYWxseSwgY29sbGFwc2luZyBjdXJyZW50RWRnZSBpbnRvIHRoZSBzZWN0aW9uRG93biBcbiAgICAgICAgICAgICAgICAvLyBsaXN0LiBUaGUgdmFsdWVzIGluIHRoZSBsaXN0IGZvbGxvd2luZyBjdXJyZW50RWRnZSB3aWxsIHRoZW4gYmUgc2V0IHRvIFxuICAgICAgICAgICAgICAgIC8vIGJlIHNlY3Rpb25Eb3duIG9mIHRoZSBjdXJyZW50RWRnZS4pXG4gICAgICAgICAgICAgICAgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRbMF0gPSBjdXJyZW50RWRnZS5nZXRTZWN0aW9uRG93blB0cigpWzBdO1xuICAgICAgICAgICAgICAgIG8uc2V0U2VjdGlvbk5leHQoY3VycmVudEVkZ2UpO1xuICAgICAgICAgICAgICAgIGN1cnJlbnRFZGdlLnNldFNlY3Rpb25Eb3duKGUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBhc3NlcnQoYmxvY2tlclgyIDwgbmV3U2VjdGlvblgxLFxuICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0Ll9zZWN0aW9uSGFzQmxvY2tlZEVkZ2U6IGJsb2NrZXJYMiA8IG5ld1NlY3Rpb25YMSBGQUlMRUQgKCcgK1xuICAgICAgICAgICAgICAgIGJsb2NrZXJYMiArICcgPCAnICsgbmV3U2VjdGlvblgxICsgJykgJyArXG4gICAgICAgICAgICAgICAgY3VycmVudEVkZ2Uuc2VjdGlvblgyICsgJyBpcyAnICsgbmV3U2VjdGlvblgyICsgJyknKTtcbiAgICAgICAgICAgIC8vIFNoaWZ0aW5nIHRoZSBmcm9udCBvZiB0aGUgcDJiIHNvIGl0IG5vIGxvbmdlciBvdmVybGFwcyB0aGlzLnNlY3Rpb25CbG9ja2VyXG5cbiAgICAgICAgICAgIGN1cnJlbnRFZGdlLnNlY3Rpb25YMSA9IG5ld1NlY3Rpb25YMTtcblxuICAgICAgICAgICAgYXNzZXJ0KGN1cnJlbnRFZGdlLnNlY3Rpb25YMSA8IGN1cnJlbnRFZGdlLnNlY3Rpb25YMixcbiAgICAgICAgICAgICAgICAnY3VycmVudEVkZ2Uuc2VjdGlvblgxIDwgY3VycmVudEVkZ2Uuc2VjdGlvblgyICgnICtcbiAgICAgICAgICAgICAgICBjdXJyZW50RWRnZS5zZWN0aW9uWDEgKyAnIDwgJyArIGN1cnJlbnRFZGdlLnNlY3Rpb25YMiArICcpJyk7XG4gICAgICAgIH0gZWxzZSB7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNhc2UgMlxuICAgICAgICAgICAgYXNzZXJ0KG5ld1NlY3Rpb25YMSA8IGJsb2NrZXJYMSAmJiBibG9ja2VyWDEgPD0gbmV3U2VjdGlvblgyICYmIG5ld1NlY3Rpb25YMiA8PSBibG9ja2VyWDIsXG4gICAgICAgICAgICAgICAgJ0FSRWRnZUxpc3QuX3NlY3Rpb25IYXNCbG9ja2VkRWRnZTogIG5ld1NlY3Rpb25YMSA8IGJsb2NrZXJYMSAmJiBibG9ja2VyWDEgPD0gbmV3U2VjdGlvblgyICYmICcgK1xuICAgICAgICAgICAgICAgICduZXdTZWN0aW9uWDIgPD0gYmxvY2tlclgyIEZBSUxFRCcpO1xuXG4gICAgICAgICAgICB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCA9IGN1cnJlbnRFZGdlLmdldFNlY3Rpb25Eb3duUHRyKCk7XG5cbiAgICAgICAgICAgIHdoaWxlIChlICYmIGUuc3RhcnRwb2ludCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIG8gPSBlO1xuICAgICAgICAgICAgICAgIGUgPSBlLmdldFNlY3Rpb25OZXh0KCk7XG5cbiAgICAgICAgICAgICAgICBpZiAoby5zZWN0aW9uWDIgKyAxIDwgYmxvY2tlclgxICYmIChlID09PSBudWxsIHx8IGUuc3RhcnRwb2ludCA9PT0gbnVsbCB8fFxuICAgICAgICAgICAgICAgICAgICBvLnNlY3Rpb25YMiArIDEgPCBlLnNlY3Rpb25YMSkpIHtcblxuICAgICAgICAgICAgICAgICAgICB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCA9IG8uZ2V0U2VjdGlvbk5leHRQdHIoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZFswXS5zdGFydHBvaW50ICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgYXNzZXJ0KG8gIT09IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0Ll9zZWN0aW9uSGFzQmxvY2tlZEVkZ2U6IG8gIT0gbnVsbCBGQUlMRUQnKTtcbiAgICAgICAgICAgICAgICBvLnNldFNlY3Rpb25OZXh0KGN1cnJlbnRFZGdlLmdldFNlY3Rpb25OZXh0KCkpO1xuXG4gICAgICAgICAgICAgICAgdmFyIGxhcmdlciA9IGJsb2NrZXJYMTtcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZFswXS5zZWN0aW9uWDEgPCBibG9ja2VyWDEpIHtcbiAgICAgICAgICAgICAgICAgICAgbGFyZ2VyID0gdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRbMF0uc2VjdGlvblgxO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGN1cnJlbnRFZGdlLnNlY3Rpb25YMiA9IGdldFNtYWxsZXJFbmRwb2ludChuZXdTZWN0aW9uWDEsIGxhcmdlcik7XG5cbiAgICAgICAgICAgICAgICBjdXJyZW50RWRnZS5zZXRTZWN0aW9uTmV4dCh0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZFswXSk7XG4gICAgICAgICAgICAgICAgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRbMF0gPSBuZXcgQXV0b1JvdXRlckVkZ2UoKTsgLy9UaGlzIHNlZW1zIG9kZFxuICAgICAgICAgICAgICAgIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkID0gbnVsbDtcblxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50RWRnZS5zZWN0aW9uWDIgPSBnZXRTbWFsbGVyRW5kcG9pbnQobmV3U2VjdGlvblgxLCBibG9ja2VyWDEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBhc3NlcnQoY3VycmVudEVkZ2Uuc2VjdGlvblgxIDwgY3VycmVudEVkZ2Uuc2VjdGlvblgyLFxuICAgICAgICAgICAgICAgICdFeHBlY3RlZCBzZWN0aW9uWDEgPCBzZWN0aW9uWDIgYnV0ICcgKyBjdXJyZW50RWRnZS5zZWN0aW9uWDEgK1xuICAgICAgICAgICAgICAgICcgaXMgbm90IDwgJyArIGN1cnJlbnRFZGdlLnNlY3Rpb25YMik7XG5cbiAgICAgICAgICAgIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkID0gY3VycmVudEVkZ2UuZ2V0U2VjdGlvbk5leHRQdHIoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzc2VydCh0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCAhPT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZUxpc3QuX3NlY3Rpb25IYXNCbG9ja2VkRWRnZTogdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgIT0gbnVsbCBGQUlMRUQnKTtcbiAgICB3aGlsZSAodGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRbMF0gIT09IG51bGwgJiYgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRbMF0uc3RhcnRwb2ludCAhPT0gbnVsbCkge1xuICAgICAgICBuZXdTZWN0aW9uWDEgPSB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZFswXS5zZWN0aW9uWDE7XG4gICAgICAgIG5ld1NlY3Rpb25YMiA9IHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkWzBdLnNlY3Rpb25YMjtcblxuICAgICAgICBpZiAobmV3U2VjdGlvblgyIDwgYmxvY2tlclgxKSB7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNhc2UgMVxuICAgICAgICAgICAgLy9JZiB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCBpcyBjb21wbGV0ZWx5IHRvIHRoZSBsZWZ0IChvciBhYm92ZSkgdGhpcy5zZWN0aW9uQmxvY2tlclxuICAgICAgICAgICAgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgPSB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZFswXS5nZXRTZWN0aW9uTmV4dFB0cigpO1xuXG4gICAgICAgICAgICBhc3NlcnQodGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgIT09IG51bGwsXG4gICAgICAgICAgICAgICAgJ0FSRWRnZUxpc3QuX3NlY3Rpb25IYXNCbG9ja2VkRWRnZTogdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgIT0gbnVsbCBGQUlMRUQnKTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9IGVsc2UgaWYgKGJsb2NrZXJYMiA8IG5ld1NlY3Rpb25YMSkgeyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjYXNlIDZcbiAgICAgICAgICAgIC8vSWYgdGhpcy5zZWN0aW9uQmxvY2tlciBpcyBjb21wbGV0ZWx5IHRvIHRoZSByaWdodCAob3IgYmVsb3cpIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkXG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChuZXdTZWN0aW9uWDEgPCBibG9ja2VyWDEgJiYgYmxvY2tlclgyIDwgbmV3U2VjdGlvblgyKSB7ICAgICAgICAgICAgICAgICAgICAgLy8gY2FzZSAzXG4gICAgICAgICAgICAvL0lmIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkIHN0YXJ0cyBiZWZvcmUgYW5kIGVuZHMgYWZ0ZXIgdGhpcy5zZWN0aW9uQmxvY2tlclxuICAgICAgICAgICAgdmFyIHggPSBibG9ja2VyWDE7XG4gICAgICAgICAgICBlID0gdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRbMF0uZ2V0U2VjdGlvbkRvd24oKTtcblxuICAgICAgICAgICAgZm9yICg7IDspIHtcblxuICAgICAgICAgICAgICAgIGlmIChlID09PSBudWxsIHx8IGUuc3RhcnRwb2ludCA9PT0gbnVsbCB8fCB4IDwgZS5zZWN0aW9uWDEpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh4IDw9IGUuc2VjdGlvblgyKSB7XG4gICAgICAgICAgICAgICAgICAgIHggPSBlLnNlY3Rpb25YMiArIDE7XG4gICAgICAgICAgICAgICAgICAgIGlmIChibG9ja2VyWDIgPCB4KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGUgPSBlLmdldFNlY3Rpb25OZXh0KCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkID0gdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRbMF0uZ2V0U2VjdGlvbkRvd25QdHIoKTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIC8vIFRoaXMgbGVhdmVzIHRoZSByZWd1bGFyIHBhcnRpYWwgb3ZlcmxhcCBwb3NzaWJpbGl0eS5cbiAgICAgICAgLy8gVGhleSBhbHNvIGluY2x1ZGUgdGhpcy5zZWN0aW9uQmxvY2tlciBzdGFydGluZyBiZWZvcmUgYW5kIGVuZGluZyBhZnRlciB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZC5cblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBhc3NlcnQodGhpcy5zZWN0aW9uQmxvY2tlci5nZXRTZWN0aW9uTmV4dCgpID09PSBudWxsICYmXG4gICAgICAgICh0aGlzLnNlY3Rpb25CbG9ja2VyLmdldFNlY3Rpb25Eb3duKCkgPT09IG51bGwgfHxcbiAgICAgICAgdGhpcy5zZWN0aW9uQmxvY2tlci5nZXRTZWN0aW9uRG93bigpLnN0YXJ0cG9pbnQgPT09IG51bGwpLFxuICAgICAgICAnQVJFZGdlTGlzdC5fc2VjdGlvbkhhc0Jsb2NrZWRFZGdlOiB0aGlzLnNlY3Rpb25CbG9ja2VyLmdldFNlY3Rpb25OZXh0KCkgPT09IG51bGwgJiYnICtcbiAgICAgICAgJ3RoaXMuc2VjdGlvbkJsb2NrZXIuZ2V0U2VjdGlvbkRvd24oKSA9PT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIHRoaXMuc2VjdGlvbkJsb2NrZXIuc2V0U2VjdGlvbk5leHQodGhpcy5zZWN0aW9uUHRyMkJsb2NrZWRbMF0pO1xuXG4gICAgLy8gU2V0IGFueXRoaW5nIHBvaW50aW5nIHRvIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkIHRvIHBvaW50IHRvIHRoaXMuc2VjdGlvbkJsb2NrZXIgKGVnLCBzZWN0aW9uRG93bilcbiAgICB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZFswXSA9IHRoaXMuc2VjdGlvbkJsb2NrZXI7XG5cbiAgICB0aGlzLnNlY3Rpb25CbG9ja2VyID0gbnVsbDtcbiAgICB0aGlzLnNlY3Rpb25QdHIyQmxvY2tlZCA9IG51bGw7XG5cbiAgICByZXR1cm4gZmFsc2U7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLl9zZWN0aW9uR2V0QmxvY2tlZEVkZ2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgYXNzZXJ0KHRoaXMuc2VjdGlvbkJsb2NrZXIgIT09IG51bGwgJiYgdGhpcy5zZWN0aW9uUHRyMkJsb2NrZWQgIT09IG51bGwsXG4gICAgICAgICdBUkVkZ2VMaXN0LnNlY3Rpb25HZXRCbG9ja2VkRWRnZTogdGhpcy5zZWN0aW9uQmxvY2tlciAhPT0gbnVsbCAmJiAnICtcbiAgICAgICAgJ3RoaXMuc2VjdGlvblB0cjJCbG9ja2VkICE9PSBudWxsIEZBSUxFRCcpO1xuXG4gICAgcmV0dXJuIHRoaXMuc2VjdGlvblB0cjJCbG9ja2VkWzBdO1xufTtcblxuLy8tLS0tQnJhY2tldFxuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLl9icmFja2V0SXNDbG9zaW5nID0gZnVuY3Rpb24gKGVkZ2UpIHtcbiAgICBhc3NlcnQoZWRnZSAhPT0gbnVsbCwgJ0FSRWRnZUxpc3QuX2JyYWNrZXRJc0Nsb3Npbmc6IGVkZ2UgIT09IG51bGwgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KCFlZGdlLmlzU3RhcnRQb2ludE51bGwoKSAmJiAhZWRnZS5pc0VuZFBvaW50TnVsbCgpLFxuICAgICAgICAnQVJFZGdlTGlzdC5fYnJhY2tldElzQ2xvc2luZzogIWVkZ2UuaXNTdGFydFBvaW50TnVsbCgpICYmICFlZGdlLmlzRW5kUG9pbnROdWxsKCkgRkFJTEVEJyk7XG5cbiAgICB2YXIgc3RhcnQgPSBlZGdlLnN0YXJ0cG9pbnQsXG4gICAgICAgIGVuZCA9IGVkZ2UuZW5kcG9pbnQ7XG5cbiAgICBpZiAoZWRnZS5pc1N0YXJ0UG9pbnRQcmV2TnVsbCgpIHx8IGVkZ2UuaXNFbmRQb2ludE5leHROdWxsKCkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmlzaG9yaXpvbnRhbCA/XG4gICAgICAgIChlZGdlLnN0YXJ0cG9pbnRQcmV2LnkgPCBzdGFydC55ICYmIGVkZ2UuZW5kcG9pbnROZXh0LnkgPCBlbmQueSApIDpcbiAgICAgICAgKGVkZ2Uuc3RhcnRwb2ludFByZXYueCA8IHN0YXJ0LnggJiYgZWRnZS5lbmRwb2ludE5leHQueCA8IGVuZC54ICk7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLl9icmFja2V0SXNPcGVuaW5nID0gZnVuY3Rpb24gKGVkZ2UpIHtcbiAgICBhc3NlcnQoZWRnZSAhPT0gbnVsbCwgJ0FSRWRnZUxpc3QuX2JyYWNrZXRJc09wZW5pbmc6IGVkZ2UgIT09IG51bGwgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KCFlZGdlLmlzU3RhcnRQb2ludE51bGwoKSAmJiAhZWRnZS5pc0VuZFBvaW50TnVsbCgpLFxuICAgICAgICAnQVJFZGdlTGlzdC5fYnJhY2tldElzT3BlbmluZzogIWVkZ2UuaXNTdGFydFBvaW50TnVsbCgpICYmICFlZGdlLmlzRW5kUG9pbnROdWxsKCkgRkFJTEVEJyk7XG5cbiAgICB2YXIgc3RhcnQgPSBlZGdlLnN0YXJ0cG9pbnQgfHwgZWRnZS5zdGFydHBvaW50LFxuICAgICAgICBlbmQgPSBlZGdlLmVuZHBvaW50IHx8IGVkZ2UuZW5kcG9pbnQsXG4gICAgICAgIHByZXYsXG4gICAgICAgIG5leHQ7XG5cbiAgICBpZiAoZWRnZS5pc1N0YXJ0UG9pbnRQcmV2TnVsbCgpIHx8IGVkZ2UuaXNFbmRQb2ludE5leHROdWxsKCkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIG5leHQgPSBlZGdlLmVuZHBvaW50TmV4dCB8fCBlZGdlLmVuZHBvaW50TmV4dDtcbiAgICBwcmV2ID0gZWRnZS5zdGFydHBvaW50UHJldiB8fCBlZGdlLnN0YXJ0cG9pbnRQcmV2O1xuXG4gICAgcmV0dXJuIHRoaXMuaXNob3Jpem9udGFsID9cbiAgICAgICAgKHByZXYueSA+IHN0YXJ0LnkgJiYgbmV4dC55ID4gZW5kLnkgKSA6XG4gICAgICAgIChwcmV2LnggPiBzdGFydC54ICYmIG5leHQueCA+IGVuZC54ICk7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLl9icmFja2V0U2hvdWxkQmVTd2l0Y2hlZCA9IGZ1bmN0aW9uIChlZGdlLCBuZXh0KSB7XG4gICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwgJiYgbmV4dCAhPT0gbnVsbCxcbiAgICAgICAgJ0FSRWRnZUxpc3QuX2JyYWNrZXRTaG91bGRCZVN3aXRjaGVkOiBlZGdlICE9PSBudWxsICYmIG5leHQgIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICB2YXIgZXggPSB0aGlzLl9wb3NpdGlvbkdldFJlYWxYKGVkZ2UpLFxuICAgICAgICBleDEgPSBleFswXSxcbiAgICAgICAgZXgyID0gZXhbMV0sXG4gICAgICAgIGVvID0gdGhpcy5fcG9zaXRpb25HZXRSZWFsTyhlZGdlKSxcbiAgICAgICAgZW8xID0gZW9bMF0sXG4gICAgICAgIGVvMiA9IGVvWzFdLFxuICAgICAgICBueCA9IHRoaXMuX3Bvc2l0aW9uR2V0UmVhbFgobmV4dCksXG4gICAgICAgIG54MSA9IG54WzBdLFxuICAgICAgICBueDIgPSBueFsxXSxcbiAgICAgICAgbm8gPSB0aGlzLl9wb3NpdGlvbkdldFJlYWxPKG5leHQpLFxuICAgICAgICBubzEgPSBub1swXSxcbiAgICAgICAgbm8yID0gbm9bMV07XG5cbiAgICB2YXIgYzEsIGMyO1xuXG4gICAgaWYgKChueDEgPCBleDEgJiYgZXgxIDwgbngyICYmIGVvMSA+IDAgKSB8fCAoZXgxIDwgbngxICYmIG54MSA8IGV4MiAmJiBubzEgPCAwKSkge1xuICAgICAgICBjMSA9ICsxO1xuICAgIH0gZWxzZSBpZiAoZXgxID09PSBueDEgJiYgZW8xID09PSAwICYmIG5vMSA9PT0gMCkge1xuICAgICAgICBjMSA9IDA7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgYzEgPSAtOTtcbiAgICB9XG5cbiAgICBpZiAoKG54MSA8IGV4MiAmJiBleDIgPCBueDIgJiYgZW8yID4gMCApIHx8IChleDEgPCBueDIgJiYgbngyIDwgZXgyICYmIG5vMiA8IDApKSB7XG4gICAgICAgIGMyID0gKzE7XG4gICAgfSBlbHNlIGlmIChleDIgPT09IG54MiAmJiBlbzIgPT09IDAgJiYgbm8yID09PSAwKSB7XG4gICAgICAgIGMyID0gMDtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjMiA9IC05O1xuICAgIH1cblxuICAgIHJldHVybiAoYzEgKyBjMikgPiAwO1xufTtcblxuLy8tLS1CbG9ja1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLl9ibG9ja0dldEYgPSBmdW5jdGlvbiAoZCwgYiwgcykge1xuICAgIHZhciBmID0gZCAvIChiICsgcyksIC8vZiBpcyB0aGUgdG90YWwgZGlzdGFuY2UgYmV0d2VlbiBlZGdlcyBkaXZpZGVkIGJ5IHRoZSB0b3RhbCBudW1iZXIgb2YgZWRnZXNcbiAgICAgICAgUyA9IENPTlNUQU5UUy5FRExTX1MsIC8vVGhpcyBpcyAnU01BTExHQVAnXG4gICAgICAgIFIgPSBDT05TVEFOVFMuRURMU19SLC8vVGhpcyBpcyAnU01BTExHQVAgKyAxJ1xuICAgICAgICBEID0gQ09OU1RBTlRTLkVETFNfRDsgLy9UaGlzIGlzIHRoZSB0b3RhbCBkaXN0YW5jZSBvZiB0aGUgZ3JhcGhcblxuICAgIC8vSWYgZiBpcyBncmVhdGVyIHRoYW4gdGhlIFNNQUxMR0FQLCB0aGVuIG1ha2Ugc29tZSBjaGVja3MvZWRpdHNcbiAgICBpZiAoYiA9PT0gMCAmJiBSIDw9IGYpIHtcbiAgICAgICAgLy8gSWYgZXZlcnkgY29tcGFyaXNvbiByZXN1bHRlZCBpbiBhbiBvdmVybGFwIEFORCBTTUFMTEdBUCArIDEgaXMgbGVzcyB0aGFuXG4gICAgICAgIC8vIHRoZSBkaXN0YW5jZSBiZXR3ZWVuIGVhY2ggZWRnZSAoaW4gdGhlIGdpdmVuIHJhbmdlKS5cbiAgICAgICAgZiArPSAoRCAtIFIpO1xuICAgIH0gZWxzZSBpZiAoUyA8IGYgJiYgcyA+IDApIHtcbiAgICAgICAgZiA9ICgoRCAtIFMpICogZCAtIFMgKiAoRCAtIFIpICogcykgLyAoKEQgLSBTKSAqIGIgKyAoUiAtIFMpICogcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGY7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLl9ibG9ja0dldEcgPSBmdW5jdGlvbiAoZCwgYiwgcykge1xuICAgIHZhciBnID0gZCAvIChiICsgcyksXG4gICAgICAgIFMgPSBDT05TVEFOVFMuRURMU19TLFxuICAgICAgICBSID0gQ09OU1RBTlRTLkVETFNfUixcbiAgICAgICAgRCA9IENPTlNUQU5UUy5FRExTX0Q7XG5cbiAgICBpZiAoUyA8IGcgJiYgYiA+IDApIHtcbiAgICAgICAgZyA9ICgoUiAtIFMpICogZCArIFMgKiAoRCAtIFIpICogYikgLyAoKEQgLSBTKSAqIGIgKyAoUiAtIFMpICogcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGc7XG59O1xuXG5BdXRvUm91dGVyRWRnZUxpc3QucHJvdG90eXBlLl9ibG9ja1B1c2hCYWNrd2FyZCA9IGZ1bmN0aW9uIChibG9ja2VkLCBibG9ja2VyKSB7XG4gICAgdmFyIG1vZGlmaWVkID0gZmFsc2U7XG5cbiAgICBhc3NlcnQoYmxvY2tlZCAhPT0gbnVsbCAmJiBibG9ja2VyICE9PSBudWxsLFxuICAgICAgICAnQVJFZGdlTGlzdC5fYmxvY2tQdXNoQmFja3dhcmQ6IGJsb2NrZWQgIT09IG51bGwgJiYgYmxvY2tlciAhPT0gbnVsbCBGQUlMRUQnKTtcbiAgICBhc3NlcnQoYmxvY2tlZC5wb3NpdGlvblkgPD0gYmxvY2tlci5wb3NpdGlvblksXG4gICAgICAgICdBUkVkZ2VMaXN0Ll9ibG9ja1B1c2hCYWNrd2FyZDogYmxvY2tlZC5wb3NpdGlvblkgPD0gYmxvY2tlci5wb3NpdGlvblkgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KGJsb2NrZWQuZ2V0QmxvY2tQcmV2KCkgIT09IG51bGwsXG4gICAgICAgICdBUkVkZ2VMaXN0Ll9ibG9ja1B1c2hCYWNrd2FyZDogYmxvY2tlZC5nZXRCbG9ja1ByZXYoKSAhPT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIHZhciBmID0gMCxcbiAgICAgICAgZyA9IDAsXG4gICAgICAgIGVkZ2UgPSBibG9ja2VkLFxuICAgICAgICB0cmFjZSA9IGJsb2NrZXIsXG4gICAgICAgIGQgPSB0cmFjZS5wb3NpdGlvblkgLSBlZGdlLnBvc2l0aW9uWTtcblxuICAgIGFzc2VydChkID49IDAsXG4gICAgICAgICdBUkVkZ2VMaXN0Ll9ibG9ja1B1c2hCYWNrd2FyZDogZCA+PSAwIEZBSUxFRCcpO1xuXG4gICAgdmFyIHMgPSAoZWRnZS5icmFja2V0T3BlbmluZyB8fCB0cmFjZS5icmFja2V0Q2xvc2luZyksXG4gICAgICAgIGIgPSAxIC0gcyxcbiAgICAgICAgZDI7XG5cbiAgICBmb3IgKDsgOykge1xuICAgICAgICBlZGdlLnNldEJsb2NrVHJhY2UodHJhY2UpO1xuICAgICAgICB0cmFjZSA9IGVkZ2U7XG4gICAgICAgIGVkZ2UgPSBlZGdlLmdldEJsb2NrUHJldigpO1xuXG4gICAgICAgIGlmIChlZGdlID09PSBudWxsKSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIGQyID0gdHJhY2UucG9zaXRpb25ZIC0gZWRnZS5wb3NpdGlvblk7XG4gICAgICAgIGFzc2VydChkMiA+PSAwLFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QuX2Jsb2NrUHVzaEJhY2t3YXJkOiAgZDIgPj0gMCBGQUlMRUQnKTtcblxuICAgICAgICBpZiAoZWRnZS5icmFja2V0T3BlbmluZyB8fCB0cmFjZS5icmFja2V0Q2xvc2luZykge1xuICAgICAgICAgICAgZyA9IHRoaXMuX2Jsb2NrR2V0RyhkLCBiLCBzKTtcbiAgICAgICAgICAgIGlmIChkMiA8PSBnKSB7XG4gICAgICAgICAgICAgICAgZiA9IHRoaXMuX2Jsb2NrR2V0RihkLCBiLCBzKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHMrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGYgPSB0aGlzLl9ibG9ja0dldEYoZCwgYiwgcyk7XG4gICAgICAgICAgICBpZiAoZDIgPD0gZikge1xuICAgICAgICAgICAgICAgIGcgPSB0aGlzLl9ibG9ja0dldEcoZCwgYiwgcyk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBiKys7XG4gICAgICAgIH1cblxuICAgICAgICBkICs9IGQyO1xuICAgIH1cblxuICAgIGlmIChiICsgcyA+IDEpIHtcbiAgICAgICAgaWYgKGVkZ2UgPT09IG51bGwpIHtcbiAgICAgICAgICAgIGYgPSB0aGlzLl9ibG9ja0dldEYoZCwgYiwgcyk7XG4gICAgICAgICAgICBnID0gdGhpcy5fYmxvY2tHZXRHKGQsIGIsIHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgYXNzZXJ0KFV0aWxzLmZsb2F0RXF1YWxzKGQsIGYgKiBiICsgZyAqIHMpLFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QuX2Jsb2NrUHVzaEJhY2t3YXJkOiBmbG9hdEVxdWFscyhkLCBmKmIgKyBnKnMpIEZBSUxFRCcpO1xuXG4gICAgICAgIGVkZ2UgPSB0cmFjZTtcbiAgICAgICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwgJiYgZWRnZSAhPT0gYmxvY2tlZCxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0Ll9ibG9ja1B1c2hCYWNrd2FyZDogZWRnZSAhPT0gbnVsbCAmJiBlZGdlICE9PSBibG9ja2VkIEZBSUxFRCcpO1xuXG4gICAgICAgIHZhciB5ID0gZWRnZS5wb3NpdGlvblk7XG5cbiAgICAgICAgZG8ge1xuICAgICAgICAgICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwgJiYgZWRnZS5nZXRCbG9ja1RyYWNlKCkgIT09IG51bGwsXG4gICAgICAgICAgICAgICAgJ0FSRWRnZUxpc3QuX2Jsb2NrUHVzaEJhY2t3YXJkOiBlZGdlICE9PSBudWxsICYmIGVkZ2UuZ2V0QmxvY2tUcmFjZSgpICE9PSBudWxsIEZBSUxFRCcpO1xuXG4gICAgICAgICAgICB0cmFjZSA9IGVkZ2UuZ2V0QmxvY2tUcmFjZSgpO1xuXG4gICAgICAgICAgICB5ICs9IChlZGdlLmJyYWNrZXRPcGVuaW5nIHx8IHRyYWNlLmJyYWNrZXRDbG9zaW5nKSA/IGcgOiBmO1xuICAgICAgICAgICAgeSA9IFV0aWxzLnJvdW5kVHJ1bmMoeSwgMTApOyAgLy8gRml4IGFueSBmbG9hdGluZyBwb2ludCBlcnJvcnNcblxuICAgICAgICAgICAgaWYgKHkgKyAwLjAwMSA8IHRyYWNlLnBvc2l0aW9uWSkge1xuICAgICAgICAgICAgICAgIG1vZGlmaWVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fc2xpZGVCdXROb3RQYXNzRWRnZXModHJhY2UsIHkpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRyYWNlLnNldEJsb2NrUHJldihudWxsKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGVkZ2UgPSB0cmFjZTtcbiAgICAgICAgfSB3aGlsZSAoZWRnZSAhPT0gYmxvY2tlZCk7XG5cbiAgICAgICAgaWYgKENPTlNUQU5UUy5ERUJVRykge1xuICAgICAgICAgICAgLy95ICs9IChlZGdlLmJyYWNrZXRPcGVuaW5nIHx8IGJsb2NrZXIuYnJhY2tldENsb3NpbmcpID8gZyA6IGY7XG4gICAgICAgICAgICBhc3NlcnQoVXRpbHMuZmxvYXRFcXVhbHMoeSwgYmxvY2tlci5wb3NpdGlvblkpLFxuICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0Ll9ibG9ja1B1c2hCYWNrd2FyZDogZmxvYXRFcXVhbHMoeSwgYmxvY2tlci5wb3NpdGlvblkpIEZBSUxFRCcpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG1vZGlmaWVkO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5fYmxvY2tQdXNoRm9yd2FyZCA9IGZ1bmN0aW9uIChibG9ja2VkLCBibG9ja2VyKSB7XG4gICAgdmFyIG1vZGlmaWVkID0gZmFsc2U7XG5cbiAgICBhc3NlcnQoYmxvY2tlZCAhPT0gbnVsbCAmJiBibG9ja2VyICE9PSBudWxsLFxuICAgICAgICAnQVJFZGdlTGlzdC5fYmxvY2tQdXNoRm9yd2FyZDogYmxvY2tlZCAhPT0gbnVsbCAmJiBibG9ja2VyICE9PSBudWxsIEZBSUxFRCcpO1xuICAgIGFzc2VydChibG9ja2VkLnBvc2l0aW9uWSA+PSBibG9ja2VyLnBvc2l0aW9uWSxcbiAgICAgICAgJ0FSRWRnZUxpc3QuX2Jsb2NrUHVzaEZvcndhcmQ6IGJsb2NrZWQucG9zaXRpb25ZID49IGJsb2NrZXIucG9zaXRpb25ZIEZBSUxFRCcpO1xuICAgIGFzc2VydChibG9ja2VkLmdldEJsb2NrTmV4dCgpICE9PSBudWxsLFxuICAgICAgICAnQVJFZGdlTGlzdC5fYmxvY2tQdXNoRm9yd2FyZDogYmxvY2tlZC5nZXRCbG9ja05leHQoKSAhPT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIHZhciBmID0gMCxcbiAgICAgICAgZyA9IDAsXG4gICAgICAgIGVkZ2UgPSBibG9ja2VkLFxuICAgICAgICB0cmFjZSA9IGJsb2NrZXIsXG4gICAgICAgIGQgPSBlZGdlLnBvc2l0aW9uWSAtIHRyYWNlLnBvc2l0aW9uWTtcblxuICAgIGFzc2VydChkID49IDAsXG4gICAgICAgICdBUkVkZ2VMaXN0Ll9ibG9ja1B1c2hGb3J3YXJkOiAgZCA+PSAwIEZBSUxFRCcpO1xuXG4gICAgdmFyIHMgPSAodHJhY2UuYnJhY2tldE9wZW5pbmcgfHwgZWRnZS5icmFja2V0Q2xvc2luZyksXG4gICAgICAgIGIgPSAxIC0gcyxcbiAgICAgICAgZDI7XG5cbiAgICBmb3IgKDsgOykge1xuICAgICAgICBlZGdlLnNldEJsb2NrVHJhY2UodHJhY2UpO1xuICAgICAgICB0cmFjZSA9IGVkZ2U7XG4gICAgICAgIGVkZ2UgPSBlZGdlLmdldEJsb2NrTmV4dCgpO1xuXG4gICAgICAgIGlmIChlZGdlID09PSBudWxsKSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIGQyID0gZWRnZS5wb3NpdGlvblkgLSB0cmFjZS5wb3NpdGlvblk7XG4gICAgICAgIGFzc2VydChkMiA+PSAwLFxuICAgICAgICAgICAgJ0FSRWRnZUxpc3QuX2Jsb2NrUHVzaEZvcndhcmQ6IGQyID49IDAgRkFJTEVEJyk7XG5cbiAgICAgICAgaWYgKHRyYWNlLmJyYWNrZXRPcGVuaW5nIHx8IGVkZ2UuYnJhY2tldENsb3NpbmcpIHtcbiAgICAgICAgICAgIGcgPSB0aGlzLl9ibG9ja0dldEcoZCwgYiwgcyk7XG4gICAgICAgICAgICBpZiAoZDIgPD0gZykge1xuICAgICAgICAgICAgICAgIGYgPSB0aGlzLl9ibG9ja0dldEYoZCwgYiwgcyk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmID0gdGhpcy5fYmxvY2tHZXRGKGQsIGIsIHMpO1xuICAgICAgICAgICAgaWYgKGQyIDw9IGYpIHtcbiAgICAgICAgICAgICAgICBnID0gdGhpcy5fYmxvY2tHZXRHKGQsIGIsIHMpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYisrO1xuICAgICAgICB9XG5cbiAgICAgICAgZCArPSBkMjtcbiAgICB9XG5cbiAgICBpZiAoYiArIHMgPiAxKSB7IC8vTG9va2luZyBhdCBtb3JlIHRoYW4gb25lIGVkZ2UgKG9yIGVkZ2UvdHJhY2UgY29tcGFyaXNvbikge1xuICAgICAgICBpZiAoZWRnZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgZiA9IHRoaXMuX2Jsb2NrR2V0RihkLCBiLCBzKTtcbiAgICAgICAgICAgIGcgPSB0aGlzLl9ibG9ja0dldEcoZCwgYiwgcyk7XG4gICAgICAgIH1cblxuICAgICAgICBhc3NlcnQoVXRpbHMuZmxvYXRFcXVhbHMoZCwgZiAqIGIgKyBnICogcyksXG4gICAgICAgICAgICAnQVJFZGdlTGlzdC5fYmxvY2tQdXNoRm9yd2FyZDogZmxvYXRFcXVhbHMoZCwgZipiICsgZypzKSBGQUlMRUQnKTtcblxuICAgICAgICBlZGdlID0gdHJhY2U7XG4gICAgICAgIGFzc2VydChlZGdlICE9PSBudWxsICYmICFlZGdlLmVxdWFscyhibG9ja2VkKSxcbiAgICAgICAgICAgICdBUkVkZ2VMaXN0Ll9ibG9ja1B1c2hGb3J3YXJkOiBlZGdlICE9IG51bGwgJiYgIWVkZ2UuZXF1YWxzKGJsb2NrZWQpIEZBSUxFRCcpO1xuXG4gICAgICAgIHZhciB5ID0gZWRnZS5wb3NpdGlvblk7XG5cbiAgICAgICAgZG8ge1xuICAgICAgICAgICAgYXNzZXJ0KGVkZ2UgIT09IG51bGwgJiYgZWRnZS5nZXRCbG9ja1RyYWNlKCkgIT09IG51bGwsXG4gICAgICAgICAgICAgICAgJ0FSRWRnZUxpc3QuX2Jsb2NrUHVzaEZvcndhcmQ6IGVkZ2UgIT09IG51bGwgJiYgZWRnZS5nZXRCbG9ja1RyYWNlKCkgIT09IG51bGwgRkFJTEVEJyk7XG4gICAgICAgICAgICB0cmFjZSA9IGVkZ2UuZ2V0QmxvY2tUcmFjZSgpO1xuXG4gICAgICAgICAgICB5IC09ICh0cmFjZS5icmFja2V0T3BlbmluZyB8fCBlZGdlLmJyYWNrZXRDbG9zaW5nKSA/IGcgOiBmO1xuXG4gICAgICAgICAgICBpZiAodHJhY2UucG9zaXRpb25ZIDwgeSAtIDAuMDAxKSB7XG4gICAgICAgICAgICAgICAgbW9kaWZpZWQgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX3NsaWRlQnV0Tm90UGFzc0VkZ2VzKHRyYWNlLCB5KSkge1xuICAgICAgICAgICAgICAgICAgICB0cmFjZS5zZXRCbG9ja05leHQobnVsbCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBlZGdlID0gdHJhY2U7XG4gICAgICAgIH0gd2hpbGUgKGVkZ2UgIT09IGJsb2NrZWQpO1xuICAgIH1cblxuXG4gICAgcmV0dXJuIG1vZGlmaWVkO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5ibG9ja1NjYW5Gb3J3YXJkID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuX3Bvc2l0aW9uQWxsTG9hZFgoKTtcblxuICAgIHZhciBtb2RpZmllZCA9IGZhbHNlO1xuXG4gICAgdGhpcy5zZWN0aW9uUmVzZXQoKTtcblxuICAgIHZhciBibG9ja2VyID0gdGhpcy5vcmRlckZpcnN0LFxuICAgICAgICBibG9ja2VkLFxuICAgICAgICBibWluLFxuICAgICAgICBzbWluLFxuICAgICAgICBiTWluRixcbiAgICAgICAgc01pbkY7XG5cbiAgICB3aGlsZSAoYmxvY2tlcikge1xuICAgICAgICBibWluID0gbnVsbDsgLy9ibG9jayBtaW4/XG4gICAgICAgIHNtaW4gPSBudWxsOyAvL3NlY3Rpb24gbWluP1xuICAgICAgICBiTWluRiA9IENPTlNUQU5UUy5FRF9NSU5DT09SRCAtIDE7XG4gICAgICAgIHNNaW5GID0gQ09OU1RBTlRTLkVEX01JTkNPT1JEIC0gMTtcblxuICAgICAgICB0aGlzLl9zZWN0aW9uQmVnaW5TY2FuKGJsb2NrZXIpO1xuICAgICAgICB3aGlsZSAodGhpcy5fc2VjdGlvbkhhc0Jsb2NrZWRFZGdlKCkpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9zZWN0aW9uSXNJbW1lZGlhdGUoKSkge1xuICAgICAgICAgICAgICAgIGJsb2NrZWQgPSB0aGlzLl9zZWN0aW9uR2V0QmxvY2tlZEVkZ2UoKTtcbiAgICAgICAgICAgICAgICBhc3NlcnQoYmxvY2tlZCAhPT0gbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgJ0FSRWRnZUxpc3QuX2Jsb2NrUHVzaEZvcndhcmQ6IGJsb2NrZWQgIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICAgICAgICAgICAgICBpZiAoYmxvY2tlZC5nZXRCbG9ja1ByZXYoKSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICBtb2RpZmllZCA9IHRoaXMuX2Jsb2NrUHVzaEJhY2t3YXJkKGJsb2NrZWQsIGJsb2NrZXIpIHx8IG1vZGlmaWVkO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICghYmxvY2tlci5lZGdlRml4ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGJsb2NrZWQuYnJhY2tldE9wZW5pbmcgfHwgYmxvY2tlci5icmFja2V0Q2xvc2luZykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNNaW5GIDwgYmxvY2tlZC5wb3NpdGlvblkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzTWluRiA9IGJsb2NrZWQucG9zaXRpb25ZO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNtaW4gPSBibG9ja2VkO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGJNaW5GIDwgYmxvY2tlZC5wb3NpdGlvblkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBiTWluRiA9IGJsb2NrZWQucG9zaXRpb25ZO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJtaW4gPSBibG9ja2VkO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYm1pbikge1xuICAgICAgICAgICAgaWYgKHNtaW4pIHtcbiAgICAgICAgICAgICAgICBibG9ja2VyLnNldENsb3Nlc3RQcmV2KHNNaW5GID4gYk1pbkYgPyBzbWluIDogYm1pbik7XG5cbiAgICAgICAgICAgICAgICBiTWluRiA9IGJsb2NrZXIucG9zaXRpb25ZIC0gYk1pbkY7XG4gICAgICAgICAgICAgICAgc01pbkYgPSB0aGlzLl9ibG9ja0dldEYoYmxvY2tlci5wb3NpdGlvblkgLSBzTWluRiwgMCwgMSk7XG5cbiAgICAgICAgICAgICAgICBibG9ja2VyLnNldEJsb2NrUHJldihzTWluRiA8IGJNaW5GID8gc21pbiA6IGJtaW4pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBibG9ja2VyLnNldEJsb2NrUHJldihibWluKTtcbiAgICAgICAgICAgICAgICBibG9ja2VyLnNldENsb3Nlc3RQcmV2KGJtaW4pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYmxvY2tlci5zZXRCbG9ja1ByZXYoc21pbik7XG4gICAgICAgICAgICBibG9ja2VyLnNldENsb3Nlc3RQcmV2KHNtaW4pO1xuICAgICAgICB9XG5cblxuICAgICAgICBibG9ja2VyID0gYmxvY2tlci5vcmRlck5leHQ7XG4gICAgfVxuXG4gICAgdGhpcy5fcG9zaXRpb25BbGxTdG9yZVkoKTtcblxuICAgIHJldHVybiBtb2RpZmllZDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuYmxvY2tTY2FuQmFja3dhcmQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5fcG9zaXRpb25BbGxMb2FkWCgpO1xuXG4gICAgdmFyIG1vZGlmaWVkID0gZmFsc2U7XG5cbiAgICB0aGlzLnNlY3Rpb25SZXNldCgpO1xuICAgIHZhciBibG9ja2VyID0gdGhpcy5vcmRlckxhc3QsXG4gICAgICAgIGJsb2NrZWQsXG4gICAgICAgIGJtaW4sXG4gICAgICAgIHNtaW4sXG4gICAgICAgIGJNaW5GLFxuICAgICAgICBzTWluRjtcblxuICAgIHdoaWxlIChibG9ja2VyKSB7XG4gICAgICAgIGJtaW4gPSBudWxsO1xuICAgICAgICBzbWluID0gbnVsbDtcbiAgICAgICAgYk1pbkYgPSBDT05TVEFOVFMuRURfTUFYQ09PUkQgKyAxO1xuICAgICAgICBzTWluRiA9IENPTlNUQU5UUy5FRF9NQVhDT09SRCArIDE7XG5cbiAgICAgICAgdGhpcy5fc2VjdGlvbkJlZ2luU2NhbihibG9ja2VyKTtcblxuICAgICAgICB3aGlsZSAodGhpcy5fc2VjdGlvbkhhc0Jsb2NrZWRFZGdlKCkpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9zZWN0aW9uSXNJbW1lZGlhdGUoKSkge1xuICAgICAgICAgICAgICAgIGJsb2NrZWQgPSB0aGlzLl9zZWN0aW9uR2V0QmxvY2tlZEVkZ2UoKTtcblxuICAgICAgICAgICAgICAgIGFzc2VydChibG9ja2VkICE9PSBudWxsLFxuICAgICAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5ibG9ja1NjYW5CYWNrd2FyZDogYmxvY2tlZCAhPT0gbnVsbCBGQUlMRUQnKTtcblxuICAgICAgICAgICAgICAgIGlmIChibG9ja2VkLmdldEJsb2NrTmV4dCgpICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIG1vZGlmaWVkID0gdGhpcy5fYmxvY2tQdXNoRm9yd2FyZChibG9ja2VkLCBibG9ja2VyKSB8fCBtb2RpZmllZDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoIWJsb2NrZXIuZWRnZUZpeGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChibG9ja2VyLmJyYWNrZXRPcGVuaW5nIHx8IGJsb2NrZWQuYnJhY2tldENsb3NpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzTWluRiA+IGJsb2NrZWQucG9zaXRpb25ZKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc01pbkYgPSBibG9ja2VkLnBvc2l0aW9uWTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzbWluID0gYmxvY2tlZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChiTWluRiA+IGJsb2NrZWQucG9zaXRpb25ZKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYk1pbkYgPSBibG9ja2VkLnBvc2l0aW9uWTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBibWluID0gYmxvY2tlZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChibWluKSB7XG4gICAgICAgICAgICBpZiAoc21pbikge1xuICAgICAgICAgICAgICAgIGJsb2NrZXIuc2V0Q2xvc2VzdE5leHQoc01pbkYgPCBiTWluRiA/IHNtaW4gOiBibWluKTtcblxuICAgICAgICAgICAgICAgIGJNaW5GID0gYk1pbkYgLSBibG9ja2VyLnBvc2l0aW9uWTtcbiAgICAgICAgICAgICAgICBzTWluRiA9IHRoaXMuX2Jsb2NrR2V0RihzTWluRiAtIGJsb2NrZXIucG9zaXRpb25ZLCAwLCAxKTtcblxuICAgICAgICAgICAgICAgIGJsb2NrZXIuc2V0QmxvY2tOZXh0KHNNaW5GIDwgYk1pbkYgPyBzbWluIDogYm1pbik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGJsb2NrZXIuc2V0QmxvY2tOZXh0KGJtaW4pO1xuICAgICAgICAgICAgICAgIGJsb2NrZXIuc2V0Q2xvc2VzdE5leHQoYm1pbik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBibG9ja2VyLnNldEJsb2NrTmV4dChzbWluKTtcbiAgICAgICAgICAgIGJsb2NrZXIuc2V0Q2xvc2VzdE5leHQoc21pbik7XG4gICAgICAgIH1cblxuICAgICAgICBibG9ja2VyID0gYmxvY2tlci5vcmRlclByZXY7XG4gICAgfVxuXG4gICAgdGhpcy5fcG9zaXRpb25BbGxTdG9yZVkoKTtcblxuICAgIHJldHVybiBtb2RpZmllZDtcbn07XG5cbkF1dG9Sb3V0ZXJFZGdlTGlzdC5wcm90b3R5cGUuYmxvY2tTd2l0Y2hXcm9uZ3MgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHdhcyA9IGZhbHNlO1xuXG4gICAgdGhpcy5fcG9zaXRpb25BbGxMb2FkWCgpO1xuICAgIHZhciBzZWNvbmQgPSB0aGlzLm9yZGVyRmlyc3QsXG4gICAgICAgIGVkZ2UsXG4gICAgICAgIG5leHQsXG4gICAgICAgIGV5LFxuICAgICAgICBueSxcbiAgICAgICAgYTtcblxuICAgIHdoaWxlIChzZWNvbmQgIT09IG51bGwpIHtcbiAgICAgICAgLy9DaGVjayBpZiBpdCByZWZlcmVuY2VzIGl0c2VsZlxuICAgICAgICBpZiAoc2Vjb25kLmdldENsb3Nlc3RQcmV2KCkgIT09IG51bGwgJiYgc2Vjb25kLmdldENsb3Nlc3RQcmV2KCkuZ2V0Q2xvc2VzdE5leHQoKSAhPT0gKHNlY29uZCkgJiZcbiAgICAgICAgICAgIHNlY29uZC5nZXRDbG9zZXN0TmV4dCgpICE9PSBudWxsICYmIHNlY29uZC5nZXRDbG9zZXN0TmV4dCgpLmdldENsb3Nlc3RQcmV2KCkgPT09IChzZWNvbmQpKSB7XG5cbiAgICAgICAgICAgIGFzc2VydCghc2Vjb25kLmVkZ2VGaXhlZCxcbiAgICAgICAgICAgICAgICAnQVJFZGdlTGlzdC5ibG9ja1N3aXRjaFdyb25nczogIXNlY29uZC5lZGdlRml4ZWQgRkFJTEVEJyk7XG5cbiAgICAgICAgICAgIGVkZ2UgPSBzZWNvbmQ7XG4gICAgICAgICAgICBuZXh0ID0gZWRnZS5nZXRDbG9zZXN0TmV4dCgpO1xuXG4gICAgICAgICAgICB3aGlsZSAobmV4dCAhPT0gbnVsbCAmJiBlZGdlID09PSBuZXh0LmdldENsb3Nlc3RQcmV2KCkpIHtcbiAgICAgICAgICAgICAgICBhc3NlcnQoZWRnZSAhPT0gbnVsbCAmJiAhZWRnZS5lZGdlRml4ZWQsXG4gICAgICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0LmJsb2NrU3dpdGNoV3JvbmdzOiBlZGdlICE9IG51bGwgJiYgIWVkZ2UuZWRnZUZpeGVkIEZBSUxFRCcpO1xuICAgICAgICAgICAgICAgIGFzc2VydChuZXh0ICE9PSBudWxsICYmICFuZXh0LmVkZ2VGaXhlZCxcbiAgICAgICAgICAgICAgICAgICAgJ0FSRWRnZUxpc3QuYmxvY2tTd2l0Y2hXcm9uZ3M6IG5leHQgIT0gbnVsbCAmJiAhbmV4dC5lZGdlRml4ZWQgRkFJTEVEJyk7XG5cbiAgICAgICAgICAgICAgICBleSA9IGVkZ2UucG9zaXRpb25ZO1xuICAgICAgICAgICAgICAgIG55ID0gbmV4dC5wb3NpdGlvblk7XG5cbiAgICAgICAgICAgICAgICBhc3NlcnQoZXkgPD0gbnksXG4gICAgICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0LmJsb2NrU3dpdGNoV3JvbmdzOiBleSA8PSBueSBGQUlMRUQnKTtcblxuICAgICAgICAgICAgICAgIGlmIChleSArIDEgPD0gbnkgJiYgdGhpcy5fYnJhY2tldFNob3VsZEJlU3dpdGNoZWQoZWRnZSwgbmV4dCkpIHtcbiAgICAgICAgICAgICAgICAgICAgd2FzID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgICAgICBhc3NlcnQoIWVkZ2UuZ2V0RWRnZUNhbnBhc3NlZCgpICYmICFuZXh0LmdldEVkZ2VDYW5wYXNzZWQoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0LmJsb2NrU3dpdGNoV3JvbmdzOiAhZWRnZS5nZXRFZGdlQ2FucGFzc2VkKCkgJiYgJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAnIW5leHQuZ2V0RWRnZUNhbnBhc3NlZCgpIEZBSUxFRCcpO1xuICAgICAgICAgICAgICAgICAgICBlZGdlLnNldEVkZ2VDYW5wYXNzZWQodHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgIG5leHQuc2V0RWRnZUNhbnBhc3NlZCh0cnVlKTtcblxuICAgICAgICAgICAgICAgICAgICBhID0gdGhpcy5fc2xpZGVCdXROb3RQYXNzRWRnZXMoZWRnZSwgKG55ICsgZXkpIC8gMiArIDAuMDAxKSAhPT0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgYSA9IHRoaXMuX3NsaWRlQnV0Tm90UGFzc0VkZ2VzKG5leHQsIChueSArIGV5KSAvIDIgLSAwLjAwMSkgIT09IG51bGwgfHwgYTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoYSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZWRnZS5zZXRDbG9zZXN0UHJldihudWxsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVkZ2Uuc2V0Q2xvc2VzdE5leHQobnVsbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBuZXh0LnNldENsb3Nlc3RQcmV2KG51bGwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbmV4dC5zZXRDbG9zZXN0TmV4dChudWxsKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgZWRnZS5zZXRFZGdlQ2FucGFzc2VkKGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5leHQuc2V0RWRnZUNhbnBhc3NlZChmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChlZGdlLmdldENsb3Nlc3RQcmV2KCkgIT09IG51bGwgJiYgZWRnZS5nZXRDbG9zZXN0UHJldigpLmdldENsb3Nlc3ROZXh0KCkgPT09IGVkZ2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVkZ2UuZ2V0Q2xvc2VzdFByZXYoKS5zZXRDbG9zZXN0TmV4dChuZXh0KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChuZXh0LmdldENsb3Nlc3ROZXh0KCkgIT09IG51bGwgJiYgbmV4dC5nZXRDbG9zZXN0TmV4dCgpLmdldENsb3Nlc3RQcmV2KCkgPT09IG5leHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5leHQuZ2V0Q2xvc2VzdE5leHQoKS5zZXRDbG9zZXN0UHJldihlZGdlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGVkZ2Uuc2V0Q2xvc2VzdE5leHQobmV4dC5nZXRDbG9zZXN0TmV4dCgpKTtcbiAgICAgICAgICAgICAgICAgICAgbmV4dC5zZXRDbG9zZXN0TmV4dChlZGdlKTtcbiAgICAgICAgICAgICAgICAgICAgbmV4dC5zZXRDbG9zZXN0UHJldihlZGdlLmdldENsb3Nlc3RQcmV2KCkpO1xuICAgICAgICAgICAgICAgICAgICBlZGdlLnNldENsb3Nlc3RQcmV2KG5leHQpO1xuXG4gICAgICAgICAgICAgICAgICAgIGVkZ2Uuc2V0RWRnZUNhbnBhc3NlZChmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgIG5leHQuc2V0RWRnZUNhbnBhc3NlZChmYWxzZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KCF0aGlzLl9icmFja2V0U2hvdWxkQmVTd2l0Y2hlZChuZXh0LCBlZGdlKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICdBUkVkZ2VMaXN0LmJsb2NrU3dpdGNoV3JvbmdzOiAhYnJhY2tldFNob3VsZEJlU3dpdGNoZWQobmV4dCwgZWRnZSkgRkFJTEVEJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKG5leHQuZ2V0Q2xvc2VzdFByZXYoKSAhPT0gbnVsbCAmJiBuZXh0LmdldENsb3Nlc3RQcmV2KCkuZ2V0Q2xvc2VzdE5leHQoKSA9PT0gbmV4dCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZWRnZSA9IG5leHQuZ2V0Q2xvc2VzdFByZXYoKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5leHQgPSBlZGdlLmdldENsb3Nlc3ROZXh0KCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBlZGdlID0gbmV4dDtcbiAgICAgICAgICAgICAgICAgICAgbmV4dCA9IG5leHQuZ2V0Q2xvc2VzdE5leHQoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBzZWNvbmQgPSBzZWNvbmQub3JkZXJOZXh0O1xuICAgIH1cblxuICAgIGlmICh3YXMpIHtcbiAgICAgICAgdGhpcy5fcG9zaXRpb25BbGxTdG9yZVkoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gd2FzO1xufTtcblxuQXV0b1JvdXRlckVkZ2VMaXN0LnByb3RvdHlwZS5hc3NlcnRWYWxpZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAvLyBDaGVjayB0aGF0IGFsbCBlZGdlcyBoYXZlIHN0YXJ0L2VuZCBwb2ludHNcbiAgICB2YXIgZWRnZSA9IHRoaXMub3JkZXJGaXJzdDtcbiAgICB3aGlsZSAoZWRnZSkge1xuICAgICAgICBhc3NlcnQoZWRnZS5zdGFydHBvaW50LnggIT09IHVuZGVmaW5lZCwgJ0VkZ2UgaGFzIHVucmVjb2duaXplZCBzdGFydHBvaW50OiAnICsgZWRnZS5zdGFydHBvaW50KTtcbiAgICAgICAgYXNzZXJ0KGVkZ2UuZW5kcG9pbnQueCAhPT0gdW5kZWZpbmVkLCAnRWRnZSBoYXMgdW5yZWNvZ25pemVkIGVuZHBvaW50OiAnICsgZWRnZS5lbmRwb2ludCk7XG4gICAgICAgIGVkZ2UgPSBlZGdlLm9yZGVyTmV4dDtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEF1dG9Sb3V0ZXJFZGdlTGlzdDtcbiIsIi8qZ2xvYmFscyBkZWZpbmUsIFdlYkdNRUdsb2JhbCovXG4vKmpzaGludCBub2RlOiB0cnVlKi9cblxuLyoqXG4gKiBAYXV0aG9yIGJyb2xsYiAvIGh0dHBzOi8vZ2l0aHViL2Jyb2xsYlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIExvZ2dlciA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Mb2dnZXInKSwgIC8vIEZJWE1FXG4gICAgQ09OU1RBTlRTID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLkNvbnN0YW50cycpLFxuICAgIFV0aWxzID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlV0aWxzJyksXG4gICAgYXNzZXJ0ID0gVXRpbHMuYXNzZXJ0LFxuICAgIEFyUG9pbnQgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUG9pbnQnKSxcbiAgICBBclBvaW50TGlzdFBhdGggPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUG9pbnRMaXN0JyksXG4gICAgQXJSZWN0ID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlJlY3QnKSxcbiAgICBBdXRvUm91dGVyUGF0aCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5QYXRoJyksXG4gICAgQXV0b1JvdXRlclBvcnQgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUG9ydCcpLFxuICAgIEF1dG9Sb3V0ZXJCb3ggPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuQm94JyksXG4gICAgQXV0b1JvdXRlckVkZ2UgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuRWRnZScpLFxuICAgIEF1dG9Sb3V0ZXJFZGdlTGlzdCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5FZGdlTGlzdCcpO1xuXG52YXIgX2xvZ2dlciA9IG5ldyBMb2dnZXIoJ0F1dG9Sb3V0ZXIuR3JhcGgnKSxcbiAgICBDT1VOVEVSID0gMTsgIC8vIFVzZWQgZm9yIHVuaXF1ZSBpZHNcblxudmFyIEF1dG9Sb3V0ZXJHcmFwaCA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmNvbXBsZXRlbHlDb25uZWN0ZWQgPSB0cnVlOyAgLy8gdHJ1ZSBpZiBhbGwgcGF0aHMgYXJlIGNvbm5lY3RlZFxuICAgIHRoaXMuaG9yaXpvbnRhbCA9IG5ldyBBdXRvUm91dGVyRWRnZUxpc3QodHJ1ZSk7XG4gICAgdGhpcy52ZXJ0aWNhbCA9IG5ldyBBdXRvUm91dGVyRWRnZUxpc3QoZmFsc2UpO1xuICAgIHRoaXMuYm94ZXMgPSB7fTtcbiAgICB0aGlzLnBhdGhzID0gW107XG4gICAgdGhpcy5idWZmZXJCb3hlcyA9IFtdO1xuICAgIHRoaXMuYm94MmJ1ZmZlckJveCA9IHt9OyAvLyBtYXBzIGJveElkIHRvIGNvcnJlc3BvbmRpbmcgYnVmZmVyYm94IG9iamVjdFxuXG4gICAgdGhpcy5ob3Jpem9udGFsLm93bmVyID0gdGhpcztcbiAgICB0aGlzLnZlcnRpY2FsLm93bmVyID0gdGhpcztcblxuICAgIC8vSW5pdGlhbGl6aW5nIHNlbGZQb2ludHNcbiAgICB0aGlzLnNlbGZQb2ludHMgPSBbXG4gICAgICAgIG5ldyBBclBvaW50KENPTlNUQU5UUy5FRF9NSU5DT09SRCwgQ09OU1RBTlRTLkVEX01JTkNPT1JEKSxcbiAgICAgICAgbmV3IEFyUG9pbnQoQ09OU1RBTlRTLkVEX01BWENPT1JELCBDT05TVEFOVFMuRURfTUlOQ09PUkQpLFxuICAgICAgICBuZXcgQXJQb2ludChDT05TVEFOVFMuRURfTUFYQ09PUkQsIENPTlNUQU5UUy5FRF9NQVhDT09SRCksXG4gICAgICAgIG5ldyBBclBvaW50KENPTlNUQU5UUy5FRF9NSU5DT09SRCwgQ09OU1RBTlRTLkVEX01BWENPT1JEKVxuICAgIF07XG5cbiAgICB0aGlzLl9hZGRTZWxmRWRnZXMoKTtcbn07XG5cbi8vRnVuY3Rpb25zXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9kZWxldGVBbGxCb3hlcyA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgaWRzID0gT2JqZWN0LmtleXModGhpcy5ib3hlcyk7XG4gICAgZm9yICh2YXIgaSA9IGlkcy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgdGhpcy5ib3hlc1tpZHNbaV1dLmRlc3Ryb3koKTtcbiAgICAgICAgZGVsZXRlIHRoaXMuYm94ZXNbaWRzW2ldXTtcbiAgICB9XG4gICAgLy8gQ2xlYW4gdXAgdGhlIGJ1ZmZlckJveGVzXG4gICAgdGhpcy5idWZmZXJCb3hlcyA9IFtdO1xuICAgIHRoaXMuYm94MmJ1ZmZlckJveCA9IHt9O1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fZ2V0Qm94QXQgPSBmdW5jdGlvbiAocG9pbnQsIG5lYXJuZXNzKSB7XG4gICAgdmFyIGlkcyA9IE9iamVjdC5rZXlzKHRoaXMuYm94ZXMpO1xuICAgIGZvciAodmFyIGkgPSBpZHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIGlmICh0aGlzLmJveGVzW2lkc1tpXV0uaXNCb3hBdChwb2ludCwgbmVhcm5lc3MpKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5ib3hlc1tpZHNbaV1dO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9zZXRQb3J0QXR0ciA9IGZ1bmN0aW9uIChwb3J0LCBhdHRyKSB7XG4gICAgdGhpcy5fZGlzY29ubmVjdFBhdGhzRnJvbShwb3J0KTtcbiAgICBwb3J0LmF0dHJpYnV0ZXMgPSBhdHRyO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5faXNSZWN0Q2xpcEJveGVzID0gZnVuY3Rpb24gKHJlY3QpIHtcbiAgICB2YXIgYm94UmVjdDtcbiAgICB2YXIgaWRzID0gT2JqZWN0LmtleXModGhpcy5ib3hlcyk7XG4gICAgZm9yICh2YXIgaSA9IGlkcy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgYm94UmVjdCA9IHRoaXMuYm94ZXNbaWRzW2ldXS5yZWN0O1xuICAgICAgICBpZiAoVXRpbHMuaXNSZWN0Q2xpcChyZWN0LCBib3hSZWN0KSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5faXNSZWN0Q2xpcEJ1ZmZlckJveGVzID0gZnVuY3Rpb24gKHJlY3QpIHtcbiAgICB2YXIgaSA9IHRoaXMuYnVmZmVyQm94ZXMubGVuZ3RoLFxuICAgICAgICBjO1xuXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgICBjID0gdGhpcy5idWZmZXJCb3hlc1tpXS5jaGlsZHJlbi5sZW5ndGg7XG5cbiAgICAgICAgd2hpbGUgKGMtLSkge1xuICAgICAgICAgICAgaWYgKFV0aWxzLmlzUmVjdENsaXAocmVjdCwgdGhpcy5idWZmZXJCb3hlc1tpXS5jaGlsZHJlbltjXSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2lzTGluZUNsaXBCdWZmZXJCb3hlcyA9IGZ1bmN0aW9uIChwMSwgcDIpIHtcbiAgICB2YXIgcmVjdCA9IG5ldyBBclJlY3QocDEsIHAyKTtcbiAgICByZWN0Lm5vcm1hbGl6ZVJlY3QoKTtcbiAgICBhc3NlcnQocmVjdC5sZWZ0ID09PSByZWN0LnJpZ2h0IHx8IHJlY3QuY2VpbCA9PT0gcmVjdC5mbG9vcixcbiAgICAgICAgJ0FSR3JhcGgudGhpcy5faXNMaW5lQ2xpcEJveGVzOiByZWN0LmxlZnQgPT09IHJlY3QucmlnaHQgfHwgcmVjdC5jZWlsID09PSByZWN0LmZsb29yIEZBSUxFRCcpO1xuXG4gICAgaWYgKHJlY3QubGVmdCA9PT0gcmVjdC5yaWdodCkge1xuICAgICAgICByZWN0LnJpZ2h0Kys7XG4gICAgfVxuICAgIGlmIChyZWN0LmNlaWwgPT09IHJlY3QuZmxvb3IpIHtcbiAgICAgICAgcmVjdC5mbG9vcisrO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLl9pc1JlY3RDbGlwQnVmZmVyQm94ZXMocmVjdCk7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9pc0xpbmVDbGlwQm94ZXMgPSBmdW5jdGlvbiAocDEsIHAyKSB7XG4gICAgdmFyIHJlY3QgPSBuZXcgQXJSZWN0KHAxLCBwMik7XG4gICAgcmVjdC5ub3JtYWxpemVSZWN0KCk7XG4gICAgYXNzZXJ0KHJlY3QubGVmdCA9PT0gcmVjdC5yaWdodCB8fCByZWN0LmNlaWwgPT09IHJlY3QuZmxvb3IsXG4gICAgICAgICdBUkdyYXBoLmlzTGluZUNsaXBCb3hlczogcmVjdC5sZWZ0ID09PSByZWN0LnJpZ2h0IHx8IHJlY3QuY2VpbCA9PT0gcmVjdC5mbG9vciBGQUlMRUQnKTtcblxuICAgIGlmIChyZWN0LmxlZnQgPT09IHJlY3QucmlnaHQpIHtcbiAgICAgICAgcmVjdC5yaWdodCsrO1xuICAgIH1cbiAgICBpZiAocmVjdC5jZWlsID09PSByZWN0LmZsb29yKSB7XG4gICAgICAgIHJlY3QuZmxvb3IrKztcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5faXNSZWN0Q2xpcEJveGVzKHJlY3QpO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fY2FuQm94QXQgPSBmdW5jdGlvbiAocmVjdCkge1xuICAgIHJldHVybiAhdGhpcy5faXNSZWN0Q2xpcEJveGVzLmluZmxhdGVkUmVjdChyZWN0LCAxKTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2FkZCA9IGZ1bmN0aW9uIChwYXRoKSB7XG4gICAgYXNzZXJ0KHBhdGggIT09IG51bGwsICdBUkdyYXBoLmFkZDogcGF0aCAhPT0gbnVsbCBGQUlMRUQnKTtcbiAgICBhc3NlcnQoIXBhdGguaGFzT3duZXIoKSwgJ0FSR3JhcGguYWRkOiAhcGF0aC5oYXNPd25lcigpIEZBSUxFRCcpO1xuXG4gICAgcGF0aC5vd25lciA9IHRoaXM7XG5cbiAgICB0aGlzLnBhdGhzLnB1c2gocGF0aCk7XG5cbiAgICB0aGlzLmhvcml6b250YWwuYWRkUGF0aEVkZ2VzKHBhdGgpO1xuICAgIHRoaXMudmVydGljYWwuYWRkUGF0aEVkZ2VzKHBhdGgpO1xuXG4gICAgaWYgKENPTlNUQU5UUy5ERUJVRykge1xuICAgICAgICB0aGlzLl9hc3NlcnRWYWxpZFBhdGgocGF0aCk7XG4gICAgfVxuXG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9kZWxldGVBbGxQYXRocyA9IGZ1bmN0aW9uICgpIHtcbiAgICBmb3IgKHZhciBpID0gdGhpcy5wYXRocy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgdGhpcy5wYXRoc1tpXS5kZXN0cm95KCk7ICAvLyBSZW1vdmUgcG9pbnQgZnJvbSBzdGFydC9lbmQgcG9ydFxuICAgIH1cblxuICAgIHRoaXMucGF0aHMgPSBbXTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2hhc05vUGF0aCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXRocy5sZW5ndGggPT09IDA7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9nZXRQYXRoQ291bnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMucGF0aHMubGVuZ3RoO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fZ2V0TGlzdEVkZ2VBdCA9IGZ1bmN0aW9uIChwb2ludCwgbmVhcm5lc3MpIHtcblxuICAgIHZhciBlZGdlID0gdGhpcy5ob3Jpem9udGFsLmdldEVkZ2VBdChwb2ludCwgbmVhcm5lc3MpO1xuICAgIGlmIChlZGdlKSB7XG4gICAgICAgIHJldHVybiBlZGdlO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLnZlcnRpY2FsLmdldEVkZ2VBdChwb2ludCwgbmVhcm5lc3MpO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fZ2V0U3Vycm91bmRSZWN0ID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciByZWN0ID0gbmV3IEFyUmVjdCgwLCAwLCAwLCAwKSxcbiAgICAgICAgaTtcblxuICAgIHZhciBpZHMgPSBPYmplY3Qua2V5cyh0aGlzLmJveGVzKTtcbiAgICBmb3IgKGkgPSBpZHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHJlY3QudW5pb25Bc3NpZ24odGhpcy5ib3hlc1tpZHNbaV1dLnJlY3QpO1xuICAgIH1cblxuICAgIGZvciAoaSA9IHRoaXMucGF0aHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHJlY3QudW5pb25Bc3NpZ24odGhpcy5wYXRoc1tpXS5nZXRTdXJyb3VuZFJlY3QoKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlY3Q7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9nZXRPdXRPZkJveCA9IGZ1bmN0aW9uIChkZXRhaWxzKSB7XG4gICAgdmFyIGJ1ZmZlck9iamVjdCA9IHRoaXMuYm94MmJ1ZmZlckJveFtkZXRhaWxzLmJveC5pZF0sXG4gICAgICAgIGNoaWxkcmVuID0gYnVmZmVyT2JqZWN0LmNoaWxkcmVuLFxuICAgICAgICBpID0gYnVmZmVyT2JqZWN0LmNoaWxkcmVuLmxlbmd0aCxcbiAgICAgICAgcG9pbnQgPSBkZXRhaWxzLnBvaW50LFxuICAgICAgICBkaXIgPSBkZXRhaWxzLmRpcixcbiAgICAgICAgYm94UmVjdCA9IG5ldyBBclJlY3QoZGV0YWlscy5ib3gucmVjdCk7XG5cbiAgICBib3hSZWN0LmluZmxhdGVSZWN0KENPTlNUQU5UUy5CVUZGRVIpOyAvL0NyZWF0ZSBhIGNvcHkgb2YgdGhlIGJ1ZmZlciBib3hcblxuICAgIGFzc2VydChVdGlscy5pc1JpZ2h0QW5nbGUoZGlyKSwgJ0FSR3JhcGguZ2V0T3V0T2ZCb3g6IFV0aWxzLmlzUmlnaHRBbmdsZSAoZGlyKSBGQUlMRUQnKTtcblxuICAgIHdoaWxlIChib3hSZWN0LnB0SW5SZWN0KHBvaW50KSkge1xuICAgICAgICBpZiAoVXRpbHMuaXNIb3Jpem9udGFsKGRpcikpIHtcbiAgICAgICAgICAgIHBvaW50LnggPSBVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChib3hSZWN0LCBkaXIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcG9pbnQueSA9IFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKGJveFJlY3QsIGRpcik7XG4gICAgICAgIH1cblxuICAgICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgICAgICBpZiAoY2hpbGRyZW5baV0ucHRJblJlY3QocG9pbnQpKSB7XG4gICAgICAgICAgICAgICAgYm94UmVjdCA9IGNoaWxkcmVuW2ldO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGkgPSBidWZmZXJPYmplY3QuY2hpbGRyZW4ubGVuZ3RoO1xuICAgIH1cblxuICAgIGFzc2VydCghYm94UmVjdC5wdEluUmVjdChwb2ludCksICdBUkdyYXBoLmdldE91dE9mQm94OiAhYm94UmVjdC5wdEluUmVjdCggcG9pbnQpIEZBSUxFRCcpO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fZ29Ub05leHRCdWZmZXJCb3ggPSBmdW5jdGlvbiAoYXJncykge1xuICAgIHZhciBwb2ludCA9IGFyZ3MucG9pbnQsXG4gICAgICAgIGVuZCA9IGFyZ3MuZW5kLFxuICAgICAgICBkaXIgPSBhcmdzLmRpcixcbiAgICAgICAgZGlyMiA9IGFyZ3MuZGlyMiA9PT0gdW5kZWZpbmVkIHx8ICFVdGlscy5pc1JpZ2h0QW5nbGUoYXJncy5kaXIyKSA/IChlbmQgaW5zdGFuY2VvZiBBclBvaW50ID9cbiAgICAgICAgICAgIFV0aWxzLmV4R2V0TWFqb3JEaXIoZW5kLm1pbnVzKHBvaW50KSkgOiBDT05TVEFOVFMuRGlyTm9uZSkgOiBhcmdzLmRpcjIsXG4gICAgICAgIHN0b3BoZXJlID0gYXJncy5lbmQgIT09IHVuZGVmaW5lZCA/IGFyZ3MuZW5kIDpcbiAgICAgICAgICAgIChkaXIgPT09IDEgfHwgZGlyID09PSAyID8gQ09OU1RBTlRTLkVEX01BWENPT1JEIDogQ09OU1RBTlRTLkVEX01JTkNPT1JEICk7XG5cbiAgICBpZiAoZGlyMiA9PT0gZGlyKSB7XG4gICAgICAgIGRpcjIgPSBVdGlscy5pc1JpZ2h0QW5nbGUoVXRpbHMuZXhHZXRNaW5vckRpcihlbmQubWludXMocG9pbnQpKSkgP1xuICAgICAgICAgICAgVXRpbHMuZXhHZXRNaW5vckRpcihlbmQubWludXMocG9pbnQpKSA6IChkaXIgKyAxKSAlIDQ7XG4gICAgfVxuXG4gICAgaWYgKGVuZCBpbnN0YW5jZW9mIEFyUG9pbnQpIHtcbiAgICAgICAgc3RvcGhlcmUgPSBVdGlscy5nZXRQb2ludENvb3JkKHN0b3BoZXJlLCBkaXIpO1xuICAgIH1cblxuICAgIGFzc2VydChVdGlscy5pc1JpZ2h0QW5nbGUoZGlyKSwgJ0FyR3JhcGguZ29Ub05leHRCdWZmZXJCb3g6IFV0aWxzLmlzUmlnaHRBbmdsZSAoZGlyKSBGQUlMRUQnKTtcbiAgICBhc3NlcnQoVXRpbHMuZ2V0UG9pbnRDb29yZChwb2ludCwgZGlyKSAhPT0gc3RvcGhlcmUsXG4gICAgICAgICdBckdyYXBoLmdvVG9OZXh0QnVmZmVyQm94OiBVdGlscy5nZXRQb2ludENvb3JkIChwb2ludCwgZGlyKSAhPT0gc3RvcGhlcmUgRkFJTEVEJyk7XG5cbiAgICB2YXIgYm94YnkgPSBudWxsLFxuICAgICAgICBpID0gLTEsXG4gICAgICAgIGJveFJlY3Q7XG4gICAgLy9qc2NzOmRpc2FibGUgbWF4aW11bUxpbmVMZW5ndGhcbiAgICB3aGlsZSAoKytpIDwgdGhpcy5idWZmZXJCb3hlcy5sZW5ndGgpIHtcbiAgICAgICAgYm94UmVjdCA9IHRoaXMuYnVmZmVyQm94ZXNbaV0uYm94O1xuXG4gICAgICAgIGlmICghVXRpbHMuaXNQb2ludEluRGlyRnJvbShwb2ludCwgYm94UmVjdCwgZGlyKSAmJiAvL0FkZCBzdXBwb3J0IGZvciBlbnRlcmluZyB0aGUgcGFyZW50IGJveFxuICAgICAgICAgICAgVXRpbHMuaXNQb2ludEJldHdlZW5TaWRlcyhwb2ludCwgYm94UmVjdCwgZGlyKSAmJiAgLy8gaWYgaXQgd2lsbCBub3QgcHV0IHRoZSBwb2ludCBpbiBhIGNvcm5lciAocmVsYXRpdmUgdG8gZGlyMilcbiAgICAgICAgICAgIFV0aWxzLmlzQ29vcmRJbkRpckZyb20oc3RvcGhlcmUsXG4gICAgICAgICAgICAgICAgVXRpbHMuZ2V0Q2hpbGRSZWN0T3V0ZXJDb29yZEZyb20odGhpcy5idWZmZXJCb3hlc1tpXSwgZGlyLCBwb2ludCkuY29vcmQsIGRpcikpIHtcbiAgICAgICAgICAgIC8vUmV0dXJuIGV4dHJlbWUgKHBhcmVudCBib3gpIGZvciB0aGlzIGNvbXBhcmlzb25cbiAgICAgICAgICAgIHN0b3BoZXJlID0gVXRpbHMuZ2V0Q2hpbGRSZWN0T3V0ZXJDb29yZEZyb20odGhpcy5idWZmZXJCb3hlc1tpXSwgZGlyLCBwb2ludCkuY29vcmQ7XG4gICAgICAgICAgICBib3hieSA9IHRoaXMuYnVmZmVyQm94ZXNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgLy9qc2NzOmVuYWJsZSBtYXhpbXVtTGluZUxlbmd0aFxuXG4gICAgaWYgKFV0aWxzLmlzSG9yaXpvbnRhbChkaXIpKSB7XG4gICAgICAgIHBvaW50LnggPSBzdG9waGVyZTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBwb2ludC55ID0gc3RvcGhlcmU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGJveGJ5O1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5faHVnQ2hpbGRyZW4gPSBmdW5jdGlvbiAoYnVmZmVyT2JqZWN0LCBwb2ludCwgZGlyMSwgZGlyMiwgZXhpdENvbmRpdGlvbikge1xuICAgIC8vIFRoaXMgbWV0aG9kIGNyZWF0ZXMgYSBwYXRoIHRoYXQgZW50ZXJzIHRoZSBwYXJlbnQgYm94IGFuZCAnaHVncycgdGhlIGNoaWxkcmVuIGJveGVzXG4gICAgLy8gKHJlbWFpbnMgd2l0aGluIG9uZSBwaXhlbCBvZiB0aGVtKSBhbmQgZm9sbG93cyB0aGVtIG91dC5cbiAgICBhc3NlcnQoKGRpcjEgKyBkaXIyKSAlIDIgPT09IDEsICdBUkdyYXBoLmh1Z0NoaWxkcmVuOiBPbmUgYW5kIG9ubHkgb25lIGRpcmVjdGlvbiBtdXN0IGJlIGhvcml6b250YWwnKTtcbiAgICB2YXIgY2hpbGRyZW4gPSBidWZmZXJPYmplY3QuY2hpbGRyZW4sXG4gICAgICAgIHBhcmVudEJveCA9IGJ1ZmZlck9iamVjdC5ib3gsXG4gICAgICAgIGluaXRQb2ludCA9IG5ldyBBclBvaW50KHBvaW50KSxcbiAgICAgICAgY2hpbGQgPSB0aGlzLl9nb1RvTmV4dEJveChwb2ludCwgZGlyMSwgKGRpcjEgPT09IDEgfHwgZGlyMSA9PT0gMiA/XG4gICAgICAgICAgICBDT05TVEFOVFMuRURfTUFYQ09PUkQgOiBDT05TVEFOVFMuRURfTUlOQ09PUkQgKSwgY2hpbGRyZW4pLFxuICAgICAgICBmaW5hbFBvaW50LFxuICAgICAgICBkaXIgPSBkaXIyLFxuICAgICAgICBuZXh0RGlyID0gVXRpbHMubmV4dENsb2Nrd2lzZURpcihkaXIxKSA9PT0gZGlyMiA/IFV0aWxzLm5leHRDbG9ja3dpc2VEaXIgOiBVdGlscy5wcmV2Q2xvY2t3aXNlRGlyLFxuICAgICAgICBwb2ludHMgPSBbbmV3IEFyUG9pbnQocG9pbnQpXSxcbiAgICAgICAgaGFzRXhpdCA9IHRydWUsXG4gICAgICAgIG5leHRDaGlsZCxcbiAgICAgICAgb2xkO1xuXG4gICAgYXNzZXJ0KGNoaWxkICE9PSBudWxsLCAnQVJHcmFwaC5odWdDaGlsZHJlbjogY2hpbGQgIT09IG51bGwgRkFJTEVEJyk7XG4gICAgZXhpdENvbmRpdGlvbiA9IGV4aXRDb25kaXRpb24gPT09IHVuZGVmaW5lZCA/IGZ1bmN0aW9uIChwdCkge1xuICAgICAgICByZXR1cm4gIXBhcmVudEJveC5wdEluUmVjdChwdCk7XG4gICAgfSA6IGV4aXRDb25kaXRpb247XG5cbiAgICBfbG9nZ2VyLmluZm8oJ0Fib3V0IHRvIGh1ZyBjaGlsZCBib3hlcyB0byBmaW5kIGEgcGF0aCcpO1xuICAgIHdoaWxlIChoYXNFeGl0ICYmICFleGl0Q29uZGl0aW9uKHBvaW50LCBidWZmZXJPYmplY3QpKSB7XG4gICAgICAgIG9sZCA9IG5ldyBBclBvaW50KHBvaW50KTtcbiAgICAgICAgbmV4dENoaWxkID0gdGhpcy5fZ29Ub05leHRCb3gocG9pbnQsIGRpciwgVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQoY2hpbGQsIGRpciksIGNoaWxkcmVuKTtcblxuICAgICAgICBpZiAoIXBvaW50c1twb2ludHMubGVuZ3RoIC0gMV0uZXF1YWxzKG9sZCkpIHtcbiAgICAgICAgICAgIHBvaW50cy5wdXNoKG5ldyBBclBvaW50KG9sZCkpOyAvL1RoZSBwb2ludHMgYXJyYXkgc2hvdWxkIG5vdCBjb250YWluIHRoZSBtb3N0IHJlY2VudCBwb2ludC5cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChuZXh0Q2hpbGQgPT09IG51bGwpIHtcbiAgICAgICAgICAgIGRpciA9IFV0aWxzLnJldmVyc2VEaXIobmV4dERpcihkaXIpKTtcbiAgICAgICAgfSBlbHNlIGlmIChVdGlscy5pc0Nvb3JkSW5EaXJGcm9tKFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKG5leHRDaGlsZCwgVXRpbHMucmV2ZXJzZURpcihuZXh0RGlyKGRpcikpKSxcbiAgICAgICAgICAgICAgICBVdGlscy5nZXRQb2ludENvb3JkKHBvaW50LCBVdGlscy5yZXZlcnNlRGlyKG5leHREaXIoZGlyKSkpLCBVdGlscy5yZXZlcnNlRGlyKG5leHREaXIoZGlyKSkpKSB7XG4gICAgICAgICAgICBkaXIgPSBuZXh0RGlyKGRpcik7XG4gICAgICAgICAgICBjaGlsZCA9IG5leHRDaGlsZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChmaW5hbFBvaW50ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGZpbmFsUG9pbnQgPSBuZXcgQXJQb2ludChwb2ludCk7XG4gICAgICAgIH0gZWxzZSBpZiAoIWZpbmFsUG9pbnQuZXF1YWxzKG9sZCkpIHtcbiAgICAgICAgICAgIGhhc0V4aXQgPSAhcG9pbnQuZXF1YWxzKGZpbmFsUG9pbnQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvaW50c1swXS5lcXVhbHMoaW5pdFBvaW50KSkge1xuICAgICAgICBwb2ludHMuc3BsaWNlKDAsIDEpO1xuICAgIH1cblxuICAgIGlmICghaGFzRXhpdCkge1xuICAgICAgICBwb2ludHMgPSBudWxsO1xuICAgICAgICBwb2ludC5hc3NpZ24oaW5pdFBvaW50KTtcbiAgICB9XG5cbiAgICByZXR1cm4gcG9pbnRzO1xuXG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9nb1RvTmV4dEJveCA9IGZ1bmN0aW9uIChwb2ludCwgZGlyLCBzdG9wMSwgYm94TGlzdCkge1xuICAgIHZhciBzdG9waGVyZSA9IHN0b3AxO1xuXG4gICAgLypcbiAgICAgaWYgKHN0b3AyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgaWYgKHN0b3AyIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgYm94TGlzdCA9IHN0b3AyO1xuICAgICB9IGVsc2Uge1xuICAgICBzdG9waGVyZSA9IHN0b3AxIGluc3RhbmNlb2YgQXJQb2ludCA/XG4gICAgIGNob29zZUluRGlyLmdldFBvaW50Q29vcmQgKHN0b3AxLCBkaXIpLCBVdGlscy5nZXRQb2ludENvb3JkIChzdG9wMiwgZGlyKSwgVXRpbHMucmV2ZXJzZURpciAoZGlyKSkgOlxuICAgICBjaG9vc2VJbkRpcihzdG9wMSwgc3RvcDIsIFV0aWxzLnJldmVyc2VEaXIgKGRpcikpO1xuICAgICB9XG5cbiAgICAgfWVsc2UgKi9cbiAgICBpZiAoc3RvcDEgaW5zdGFuY2VvZiBBclBvaW50KSB7XG4gICAgICAgIHN0b3BoZXJlID0gVXRpbHMuZ2V0UG9pbnRDb29yZChzdG9waGVyZSwgZGlyKTtcbiAgICB9XG5cbiAgICBhc3NlcnQoVXRpbHMuaXNSaWdodEFuZ2xlKGRpciksICdBckdyYXBoLmdvVG9OZXh0Qm94OiBVdGlscy5pc1JpZ2h0QW5nbGUgKGRpcikgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KFV0aWxzLmdldFBvaW50Q29vcmQocG9pbnQsIGRpcikgIT09IHN0b3BoZXJlLFxuICAgICAgICAnQXJHcmFwaC5nb1RvTmV4dEJveDogVXRpbHMuZ2V0UG9pbnRDb29yZCAocG9pbnQsIGRpcikgIT09IHN0b3BoZXJlIEZBSUxFRCcpO1xuXG4gICAgdmFyIGJveGJ5ID0gbnVsbCxcbiAgICAgICAgaXRlciA9IGJveExpc3QubGVuZ3RoLFxuICAgICAgICBib3hSZWN0O1xuXG4gICAgd2hpbGUgKGl0ZXItLSkge1xuICAgICAgICBib3hSZWN0ID0gYm94TGlzdFtpdGVyXTtcblxuICAgICAgICBpZiAoVXRpbHMuaXNQb2ludEluRGlyRnJvbShwb2ludCwgYm94UmVjdCwgVXRpbHMucmV2ZXJzZURpcihkaXIpKSAmJlxuICAgICAgICAgICAgVXRpbHMuaXNQb2ludEJldHdlZW5TaWRlcyhwb2ludCwgYm94UmVjdCwgZGlyKSAmJlxuICAgICAgICAgICAgVXRpbHMuaXNDb29yZEluRGlyRnJvbShzdG9waGVyZSwgVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQoYm94UmVjdCwgVXRpbHMucmV2ZXJzZURpcihkaXIpKSwgZGlyKSkge1xuICAgICAgICAgICAgc3RvcGhlcmUgPSBVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChib3hSZWN0LCBVdGlscy5yZXZlcnNlRGlyKGRpcikpO1xuICAgICAgICAgICAgYm94YnkgPSBib3hMaXN0W2l0ZXJdO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKFV0aWxzLmlzSG9yaXpvbnRhbChkaXIpKSB7XG4gICAgICAgIHBvaW50LnggPSBzdG9waGVyZTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBwb2ludC55ID0gc3RvcGhlcmU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGJveGJ5O1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fZ2V0TGltaXRzT2ZFZGdlID0gZnVuY3Rpb24gKHN0YXJ0UHQsIGVuZFB0LCBtaW4sIG1heCkge1xuICAgIHZhciB0LFxuICAgICAgICBzdGFydCA9IChuZXcgQXJQb2ludChzdGFydFB0KSksXG4gICAgICAgIGVuZCA9IChuZXcgQXJQb2ludChlbmRQdCkpLFxuICAgICAgICBpZHMgPSBPYmplY3Qua2V5cyh0aGlzLmJveGVzKSxcbiAgICAgICAgaSxcbiAgICAgICAgcmVjdDtcblxuICAgIGlmIChzdGFydC55ID09PSBlbmQueSkge1xuICAgICAgICBpZiAoc3RhcnQueCA+IGVuZC54KSB7XG4gICAgICAgICAgICB0ID0gc3RhcnQueDtcbiAgICAgICAgICAgIHN0YXJ0LnggPSBlbmQueDtcbiAgICAgICAgICAgIGVuZC54ID0gdDtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAoaSA9IGlkcy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgICAgIHJlY3QgPSB0aGlzLmJveGVzW2lkc1tpXV0ucmVjdDtcblxuICAgICAgICAgICAgaWYgKHN0YXJ0LnggPCByZWN0LnJpZ2h0ICYmIHJlY3QubGVmdCA8PSBlbmQueCkge1xuICAgICAgICAgICAgICAgIGlmIChyZWN0LmZsb29yIDw9IHN0YXJ0LnkgJiYgcmVjdC5mbG9vciA+IG1pbikge1xuICAgICAgICAgICAgICAgICAgICBtaW4gPSByZWN0LmZsb29yO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAocmVjdC5jZWlsID4gc3RhcnQueSAmJiByZWN0LmNlaWwgPCBtYXgpIHtcbiAgICAgICAgICAgICAgICAgICAgbWF4ID0gcmVjdC5jZWlsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGFzc2VydChzdGFydC54ID09PSBlbmQueCwgJ0FSR3JhcGgudGhpcy5nZXRMaW1pdHNPZkVkZ2U6IHN0YXJ0LnggPT09IGVuZC54IEZBSUxFRCcpO1xuXG4gICAgICAgIGlmIChzdGFydC55ID4gZW5kLnkpIHtcbiAgICAgICAgICAgIHQgPSBzdGFydC55O1xuICAgICAgICAgICAgc3RhcnQueSA9IGVuZC55O1xuICAgICAgICAgICAgZW5kLnkgPSB0O1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChpID0gaWRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICAgICAgcmVjdCA9IHRoaXMuYm94ZXNbaWRzW2ldXS5yZWN0O1xuXG4gICAgICAgICAgICBpZiAoc3RhcnQueSA8IHJlY3QuZmxvb3IgJiYgcmVjdC5jZWlsIDw9IGVuZC55KSB7XG4gICAgICAgICAgICAgICAgaWYgKHJlY3QucmlnaHQgPD0gc3RhcnQueCAmJiByZWN0LnJpZ2h0ID4gbWluKSB7XG4gICAgICAgICAgICAgICAgICAgIG1pbiA9IHJlY3QucmlnaHQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChyZWN0LmxlZnQgPiBzdGFydC54ICYmIHJlY3QubGVmdCA8IG1heCkge1xuICAgICAgICAgICAgICAgICAgICBtYXggPSByZWN0LmxlZnQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgbWF4LS07XG5cbiAgICByZXR1cm4ge21pbjogbWluLCBtYXg6IG1heH07XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9jb25uZWN0ID0gZnVuY3Rpb24gKHBhdGgpIHtcbiAgICB2YXIgc3RhcnRwb3J0ID0gcGF0aC5nZXRTdGFydFBvcnQoKSxcbiAgICAgICAgZW5kcG9ydCA9IHBhdGguZ2V0RW5kUG9ydCgpLFxuICAgICAgICBzdGFydHBvaW50ID0gcGF0aC5zdGFydHBvaW50LFxuICAgICAgICBlbmRwb2ludCA9IHBhdGguZW5kcG9pbnQ7XG5cbiAgICBhc3NlcnQoc3RhcnRwb3J0Lmhhc1BvaW50KHN0YXJ0cG9pbnQpLCAnQVJHcmFwaC5jb25uZWN0OiBzdGFydHBvcnQuaGFzUG9pbnQoc3RhcnRwb2ludCkgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KGVuZHBvcnQuaGFzUG9pbnQoZW5kcG9pbnQpLCAnQVJHcmFwaC5jb25uZWN0OiBlbmRwb3J0Lmhhc1BvaW50KGVuZHBvaW50KSBGQUlMRUQnKTtcblxuICAgIHZhciBzdGFydFJvb3QgPSBzdGFydHBvcnQub3duZXIuZ2V0Um9vdEJveCgpLFxuICAgICAgICBlbmRSb290ID0gZW5kcG9ydC5vd25lci5nZXRSb290Qm94KCksXG4gICAgICAgIHN0YXJ0SWQgPSBzdGFydFJvb3QuaWQsXG4gICAgICAgIGVuZElkID0gZW5kUm9vdC5pZCxcbiAgICAgICAgc3RhcnRkaXIgPSBzdGFydHBvcnQucG9ydE9uV2hpY2hFZGdlKHN0YXJ0cG9pbnQpLFxuICAgICAgICBlbmRkaXIgPSBlbmRwb3J0LnBvcnRPbldoaWNoRWRnZShlbmRwb2ludCk7XG5cbiAgICBpZiAoc3RhcnRwb2ludC5lcXVhbHMoZW5kcG9pbnQpKSB7XG4gICAgICAgIFV0aWxzLnN0ZXBPbmVJbkRpcihzdGFydHBvaW50LCBVdGlscy5uZXh0Q2xvY2t3aXNlRGlyKHN0YXJ0ZGlyKSk7XG4gICAgfVxuXG4gICAgaWYgKCFwYXRoLmlzQXV0b1JvdXRlZCgpKSB7XG4gICAgICAgIHBhdGguY3JlYXRlQ3VzdG9tUGF0aCgpO1xuICAgICAgICByZXR1cm4gdGhpcy5ob3Jpem9udGFsLmFkZFBhdGhFZGdlcyhwYXRoKSAmJiB0aGlzLnZlcnRpY2FsLmFkZFBhdGhFZGdlcyhwYXRoKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuYm94MmJ1ZmZlckJveFtzdGFydElkXSA9PT0gdGhpcy5ib3gyYnVmZmVyQm94W2VuZElkXSAmJlxuICAgICAgICBzdGFydGRpciA9PT0gVXRpbHMucmV2ZXJzZURpcihlbmRkaXIpICYmIHN0YXJ0Um9vdCAhPT0gZW5kUm9vdCkge1xuXG4gICAgICAgIHJldHVybiB0aGlzLl9jb25uZWN0UG9pbnRzU2hhcmluZ1BhcmVudEJveChwYXRoLCBzdGFydHBvaW50LCBlbmRwb2ludCwgc3RhcnRkaXIpO1xuICAgIH0gZWxzZSB7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuX2Nvbm5lY3RQYXRoV2l0aFBvaW50cyhwYXRoLCBzdGFydHBvaW50LCBlbmRwb2ludCk7XG4gICAgfVxuXG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9jb25uZWN0UGF0aFdpdGhQb2ludHMgPSBmdW5jdGlvbiAocGF0aCwgc3RhcnRwb2ludCwgZW5kcG9pbnQpIHtcbiAgICBhc3NlcnQoc3RhcnRwb2ludCBpbnN0YW5jZW9mIEFyUG9pbnQsICdBUkdyYXBoLmNvbm5lY3Q6IHN0YXJ0cG9pbnQgaW5zdGFuY2VvZiBBclBvaW50IEZBSUxFRCcpO1xuICAgIGFzc2VydChwYXRoICE9PSBudWxsICYmIHBhdGgub3duZXIgPT09IHRoaXMsICdBUkdyYXBoLmNvbm5lY3Q6IHBhdGggIT09IG51bGwgJiYgcGF0aC5vd25lciA9PT0gc2VsZiBGQUlMRUQnKTtcbiAgICBhc3NlcnQoIXBhdGguaXNDb25uZWN0ZWQoKSwgJ0FSR3JhcGguY29ubmVjdDogIXBhdGguaXNDb25uZWN0ZWQoKSBGQUlMRUQnKTtcbiAgICBhc3NlcnQoIXN0YXJ0cG9pbnQuZXF1YWxzKGVuZHBvaW50KSwgJ0FSR3JhcGguY29ubmVjdDogIXN0YXJ0cG9pbnQuZXF1YWxzKGVuZHBvaW50KSBGQUlMRUQnKTtcblxuICAgIHZhciBzdGFydFBvcnQgPSBwYXRoLmdldFN0YXJ0UG9ydCgpO1xuICAgIGFzc2VydChzdGFydFBvcnQgIT09IG51bGwsICdBUkdyYXBoLmNvbm5lY3Q6IHN0YXJ0UG9ydCAhPT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIHZhciBzdGFydGRpciA9IHN0YXJ0UG9ydC5wb3J0T25XaGljaEVkZ2Uoc3RhcnRwb2ludCksXG4gICAgICAgIGVuZFBvcnQgPSBwYXRoLmdldEVuZFBvcnQoKTtcblxuICAgIGFzc2VydChlbmRQb3J0ICE9PSBudWxsLCAnQVJHcmFwaC5jb25uZWN0OiBlbmRQb3J0ICE9PSBudWxsIEZBSUxFRCcpO1xuICAgIHZhciBlbmRkaXIgPSBlbmRQb3J0LnBvcnRPbldoaWNoRWRnZShlbmRwb2ludCk7XG4gICAgYXNzZXJ0KFV0aWxzLmlzUmlnaHRBbmdsZShzdGFydGRpcikgJiYgVXRpbHMuaXNSaWdodEFuZ2xlKGVuZGRpciksXG4gICAgICAgICdBUkdyYXBoLmNvbm5lY3Q6IFV0aWxzLmlzUmlnaHRBbmdsZSAoc3RhcnRkaXIpICYmIFV0aWxzLmlzUmlnaHRBbmdsZSAoZW5kZGlyKSBGQUlMRUQnKTtcblxuICAgIC8vRmluZCB0aGUgYnVmZmVyYm94IGNvbnRhaW5pbmcgc3RhcnRwb2ludCwgZW5kcG9pbnRcbiAgICB2YXIgc3RhcnQgPSBuZXcgQXJQb2ludChzdGFydHBvaW50KTtcbiAgICB0aGlzLl9nZXRPdXRPZkJveCh7XG4gICAgICAgIHBvaW50OiBzdGFydCxcbiAgICAgICAgZGlyOiBzdGFydGRpcixcbiAgICAgICAgZW5kOiBlbmRwb2ludCxcbiAgICAgICAgYm94OiBzdGFydFBvcnQub3duZXJcbiAgICB9KTtcbiAgICBhc3NlcnQoIXN0YXJ0LmVxdWFscyhzdGFydHBvaW50KSwgJ0FSR3JhcGguY29ubmVjdDogIXN0YXJ0LmVxdWFscyhzdGFydHBvaW50KSBGQUlMRUQnKTtcblxuICAgIHZhciBlbmQgPSBuZXcgQXJQb2ludChlbmRwb2ludCk7XG4gICAgdGhpcy5fZ2V0T3V0T2ZCb3goe1xuICAgICAgICBwb2ludDogZW5kLFxuICAgICAgICBkaXI6IGVuZGRpcixcbiAgICAgICAgZW5kOiBzdGFydCxcbiAgICAgICAgYm94OiBlbmRQb3J0Lm93bmVyXG4gICAgfSk7XG4gICAgYXNzZXJ0KCFlbmQuZXF1YWxzKGVuZHBvaW50KSwgJ0FSR3JhcGguY29ubmVjdDogIWVuZC5lcXVhbHMoZW5kcG9pbnQpIEZBSUxFRCcpO1xuXG4gICAgdmFyIHBvaW50cyxcbiAgICAgICAgaXNBdXRvUm91dGVkID0gcGF0aC5pc0F1dG9Sb3V0ZWQoKTtcbiAgICBpZiAoaXNBdXRvUm91dGVkKSB7XG4gICAgICAgIHBvaW50cyA9IHRoaXMuX2Nvbm5lY3RQb2ludHMoc3RhcnQsIGVuZCwgc3RhcnRkaXIsIGVuZGRpcik7XG4gICAgfVxuXG4gICAgcGF0aC5wb2ludHMgPSBwb2ludHM7XG4gICAgcGF0aC5wb2ludHMudW5zaGlmdChzdGFydHBvaW50KTtcbiAgICBwYXRoLnBvaW50cy5wdXNoKGVuZHBvaW50KTtcblxuICAgIGlmIChpc0F1dG9Sb3V0ZWQpIHtcbiAgICAgICAgdGhpcy5fc2ltcGxpZnlQYXRoQ3VydmVzKHBhdGgpO1xuICAgICAgICBwYXRoLnNpbXBsaWZ5VHJpdmlhbGx5KCk7XG4gICAgICAgIHRoaXMuX3NpbXBsaWZ5UGF0aFBvaW50cyhwYXRoKTtcbiAgICAgICAgdGhpcy5fY2VudGVyU3RhaXJzSW5QYXRoUG9pbnRzKHBhdGgsIHN0YXJ0ZGlyLCBlbmRkaXIpO1xuICAgIH1cbiAgICBwYXRoLnNldFN0YXRlKENPTlNUQU5UUy5QYXRoU3RhdGVDb25uZWN0ZWQpO1xuXG4gICAgcmV0dXJuIHRoaXMuaG9yaXpvbnRhbC5hZGRQYXRoRWRnZXMocGF0aCkgJiYgdGhpcy52ZXJ0aWNhbC5hZGRQYXRoRWRnZXMocGF0aCk7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9jb25uZWN0UG9pbnRzU2hhcmluZ1BhcmVudEJveCA9IGZ1bmN0aW9uIChwYXRoLCBzdGFydHBvaW50LCBlbmRwb2ludCwgc3RhcnRkaXIpIHtcbiAgICAvLyBDb25uZWN0IHBvaW50cyB0aGF0IHNoYXJlIGEgcGFyZW50IGJveCBhbmQgZmFjZSBlYWNoIG90aGVyXG4gICAgLy8gVGhlc2Ugd2lsbCBub3QgbmVlZCB0aGUgc2ltcGxpZmljYXRpb24gYW5kIGNvbXBsaWNhdGVkIHBhdGggZmluZGluZ1xuICAgIHZhciBzdGFydCA9IG5ldyBBclBvaW50KHN0YXJ0cG9pbnQpLFxuICAgICAgICBkeCA9IGVuZHBvaW50LnggLSBzdGFydC54LFxuICAgICAgICBkeSA9IGVuZHBvaW50LnkgLSBzdGFydC55O1xuXG4gICAgcGF0aC5kZWxldGVBbGwoKTtcblxuICAgIHBhdGguYWRkVGFpbChzdGFydHBvaW50KTtcbiAgICBpZiAoZHggIT09IDAgJiYgZHkgIT09IDApIHtcbiAgICAgICAgaWYgKFV0aWxzLmlzSG9yaXpvbnRhbChzdGFydGRpcikpIHtcbiAgICAgICAgICAgIHN0YXJ0LnggKz0gZHggLyAyO1xuICAgICAgICAgICAgcGF0aC5hZGRUYWlsKG5ldyBBclBvaW50KHN0YXJ0KSk7XG4gICAgICAgICAgICBzdGFydC55ICs9IGR5O1xuICAgICAgICAgICAgcGF0aC5hZGRUYWlsKG5ldyBBclBvaW50KHN0YXJ0KSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzdGFydC55ICs9IGR5IC8gMjtcbiAgICAgICAgICAgIHBhdGguYWRkVGFpbChuZXcgQXJQb2ludChzdGFydCkpO1xuICAgICAgICAgICAgc3RhcnQueCArPSBkeDtcbiAgICAgICAgICAgIHBhdGguYWRkVGFpbChuZXcgQXJQb2ludChzdGFydCkpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHBhdGguYWRkVGFpbChlbmRwb2ludCk7XG5cbiAgICBwYXRoLnNldFN0YXRlKENPTlNUQU5UUy5QYXRoU3RhdGVDb25uZWN0ZWQpO1xuXG4gICAgcmV0dXJuIHRoaXMuaG9yaXpvbnRhbC5hZGRQYXRoRWRnZXMocGF0aCkgJiYgdGhpcy52ZXJ0aWNhbC5hZGRQYXRoRWRnZXMocGF0aCk7XG5cbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2Nvbm5lY3RQb2ludHMgPSBmdW5jdGlvbiAoc3RhcnQsIGVuZCwgaGludHN0YXJ0ZGlyLCBoaW50ZW5kZGlyLCBmbGlwcGVkKSB7XG4gICAgdmFyIHJldCA9IG5ldyBBclBvaW50TGlzdFBhdGgoKSxcbiAgICAgICAgdGhlc3RhcnQgPSBuZXcgQXJQb2ludChzdGFydCksXG4gICAgICAgIGJ1ZmZlck9iamVjdCxcbiAgICAgICAgYm94LFxuICAgICAgICByZWN0LFxuICAgICAgICBkaXIxLFxuICAgICAgICBkaXIyLFxuICAgICAgICBvbGQsXG4gICAgICAgIG9sZEVuZCxcbiAgICAgICAgcmV0MixcbiAgICAgICAgcHRzLFxuICAgICAgICByZXYsXG4gICAgICAgIGksXG5cbiAgICAvL0V4aXQgY29uZGl0aW9uc1xuICAgIC8vaWYgdGhlcmUgaXMgYSBzdHJhaWdodCBsaW5lIHRvIHRoZSBlbmQgcG9pbnRcbiAgICAgICAgZmluZEV4aXRUb0VuZHBvaW50ID0gZnVuY3Rpb24gKHB0LCBibykge1xuICAgICAgICAgICAgcmV0dXJuIChwdC54ID09PSBlbmQueCB8fCBwdC55ID09PSBlbmQueSkgJiYgIVV0aWxzLmlzTGluZUNsaXBSZWN0cyhwdCwgZW5kLCBiby5jaGlsZHJlbik7XG4gICAgICAgIH0sICAvL0lmIHlvdSBwYXNzIHRoZSBlbmRwb2ludCwgeW91IG5lZWQgdG8gaGF2ZSBhIHdheSBvdXQuXG5cbiAgICAvL2V4aXRDb25kaXRpb24gaXMgd2hlbiB5b3UgZ2V0IHRvIHRoZSBkaXIxIHNpZGUgb2YgdGhlIGJveCBvciB3aGVuIHlvdSBwYXNzIGVuZFxuICAgICAgICBnZXRUb0RpcjFTaWRlID0gZnVuY3Rpb24gKHB0LCBibykge1xuICAgICAgICAgICAgcmV0dXJuIFV0aWxzLmdldFBvaW50Q29vcmQocHQsIGRpcjEpID09PSBVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChiby5ib3gsIGRpcjEpIHx8XG4gICAgICAgICAgICAgICAgKCBVdGlscy5pc1BvaW50SW5EaXJGcm9tKHB0LCBlbmQsIGRpcjEpKTtcbiAgICAgICAgfTtcblxuXG4gICAgLy9UaGlzIGlzIHdoZXJlIHdlIGNyZWF0ZSB0aGUgb3JpZ2luYWwgcGF0aCB0aGF0IHdlIHdpbGwgbGF0ZXIgYWRqdXN0XG4gICAgd2hpbGUgKCFzdGFydC5lcXVhbHMoZW5kKSkge1xuXG4gICAgICAgIGRpcjEgPSBVdGlscy5leEdldE1ham9yRGlyKGVuZC5taW51cyhzdGFydCkpO1xuICAgICAgICBkaXIyID0gVXRpbHMuZXhHZXRNaW5vckRpcihlbmQubWludXMoc3RhcnQpKTtcblxuICAgICAgICBhc3NlcnQoZGlyMSAhPT0gQ09OU1RBTlRTLkRpck5vbmUsICdBUkdyYXBoLmNvbm5lY3RQb2ludHM6IGRpcjEgIT09IENPTlNUQU5UUy5EaXJOb25lIEZBSUxFRCcpO1xuICAgICAgICBhc3NlcnQoZGlyMSA9PT0gVXRpbHMuZ2V0TWFqb3JEaXIoZW5kLm1pbnVzKHN0YXJ0KSksXG4gICAgICAgICAgICAnQVJHcmFwaC5jb25uZWN0UG9pbnRzOiBkaXIxID09PSBVdGlscy5nZXRNYWpvckRpcihlbmQubWludXMoc3RhcnQpKSBGQUlMRUQnKTtcbiAgICAgICAgYXNzZXJ0KGRpcjIgPT09IENPTlNUQU5UUy5EaXJOb25lIHx8IGRpcjIgPT09IFV0aWxzLmdldE1pbm9yRGlyKGVuZC5taW51cyhzdGFydCkpLFxuICAgICAgICAgICAgJ0FSR3JhcGguY29ubmVjdFBvaW50czogZGlyMiA9PT0gQ09OU1RBTlRTLkRpck5vbmUgfHwgJyArXG4gICAgICAgICAgICAnZGlyMiA9PT0gVXRpbHMuZ2V0TWlub3JEaXIoZW5kLm1pbnVzKHN0YXJ0KSkgRkFJTEVEJyk7XG5cbiAgICAgICAgaWYgKGRpcjIgPT09IGhpbnRzdGFydGRpciAmJiBkaXIyICE9PSBDT05TVEFOVFMuRGlyTm9uZSkge1xuICAgICAgICAgICAgLy8gaS5lLiBzdGQ6OnN3YXAoZGlyMSwgZGlyMik7XG4gICAgICAgICAgICBkaXIyID0gZGlyMTtcbiAgICAgICAgICAgIGRpcjEgPSBoaW50c3RhcnRkaXI7XG4gICAgICAgIH1cblxuICAgICAgICByZXQucHVzaChuZXcgQXJQb2ludChzdGFydCkpO1xuXG4gICAgICAgIG9sZCA9IG5ldyBBclBvaW50KHN0YXJ0KTtcblxuICAgICAgICBidWZmZXJPYmplY3QgPSB0aGlzLl9nb1RvTmV4dEJ1ZmZlckJveCh7XG4gICAgICAgICAgICBwb2ludDogc3RhcnQsXG4gICAgICAgICAgICBkaXI6IGRpcjEsXG4gICAgICAgICAgICBkaXIyOiBkaXIyLFxuICAgICAgICAgICAgZW5kOiBlbmRcbiAgICAgICAgfSk7ICAvLyBNb2RpZmllZCBnb1RvTmV4dEJveCAodGhhdCBhbGxvd3MgZW50ZXJpbmcgcGFyZW50IGJ1ZmZlciBib3hlcyBoZXJlXG4gICAgICAgIGJveCA9IGJ1ZmZlck9iamVjdCA9PT0gbnVsbCA/IG51bGwgOiBidWZmZXJPYmplY3QuYm94O1xuXG4gICAgICAgIC8vSWYgZ29Ub05leHRCb3ggZG9lcyBub3QgbW9kaWZ5IHN0YXJ0XG4gICAgICAgIGlmIChzdGFydC5lcXVhbHMob2xkKSkge1xuXG4gICAgICAgICAgICBhc3NlcnQoYm94ICE9PSBudWxsLCAnQVJHcmFwaC5jb25uZWN0UG9pbnRzOiBib3ggIT09IG51bGwgRkFJTEVEJyk7XG4gICAgICAgICAgICByZWN0ID0gYm94IGluc3RhbmNlb2YgQXJSZWN0ID8gYm94IDogYm94LnJlY3Q7XG5cbiAgICAgICAgICAgIGlmIChkaXIyID09PSBDT05TVEFOVFMuRGlyTm9uZSkge1xuICAgICAgICAgICAgICAgIGRpcjIgPSBVdGlscy5uZXh0Q2xvY2t3aXNlRGlyKGRpcjEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBhc3NlcnQoZGlyMSAhPT0gZGlyMiAmJiBkaXIxICE9PSBDT05TVEFOVFMuRGlyTm9uZSAmJiBkaXIyICE9PSBDT05TVEFOVFMuRGlyTm9uZSxcbiAgICAgICAgICAgICAgICAnQVJHcmFwaC5jb25uZWN0UG9pbnRzOiBkaXIxICE9PSBkaXIyICYmIGRpcjEgIT09IENPTlNUQU5UUy5EaXJOb25lICYmIGRpcjIgIT09ICcgK1xuICAgICAgICAgICAgICAgICdDT05TVEFOVFMuRGlyTm9uZSBGQUlMRUQnKTtcbiAgICAgICAgICAgIGlmIChidWZmZXJPYmplY3QuYm94LnB0SW5SZWN0KGVuZCkgJiYgIWJ1ZmZlck9iamVjdC5ib3gucHRJblJlY3Qoc3RhcnQpICYmIGZsaXBwZWQpIHtcbiAgICAgICAgICAgICAgICAvL1VuZm9ydHVuYXRlbHksIGlmIHBhcmVudGJveGVzIGFyZSBhIHBpeGVsIGFwYXJ0LCBzdGFydC9lbmQgY2FuIGdldCBzdHVjayBhbmQgbm90IGNyb3NzIHRoZSBib3JkZXJcbiAgICAgICAgICAgICAgICAvL3NlcGFyYXRpbmcgdGhlbS4uLi4gVGhpcyBpcyBhIG51ZGdlIHRvIGdldCB0aGVtIHRvIGNyb3NzIGl0LlxuICAgICAgICAgICAgICAgIGlmIChVdGlscy5pc0hvcml6b250YWwoZGlyMSkpIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhcnQueCA9IGVuZC54O1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXJ0LnkgPSBlbmQueTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGJ1ZmZlck9iamVjdC5ib3gucHRJblJlY3QoZW5kKSkge1xuICAgICAgICAgICAgICAgIGlmICghZmxpcHBlZCkge1xuICAgICAgICAgICAgICAgICAgICBfbG9nZ2VyLmluZm8oJ0NvdWxkIG5vdCBmaW5kIHBhdGggZnJvbScsc3RhcnQsJ3RvJywgZW5kLCcuIEZsaXBwaW5nIHN0YXJ0IGFuZCBlbmQgcG9pbnRzJyk7XG4gICAgICAgICAgICAgICAgICAgIG9sZEVuZCA9IG5ldyBBclBvaW50KGVuZCk7XG5cbiAgICAgICAgICAgICAgICAgICAgcmV0MiA9IHRoaXMuX2Nvbm5lY3RQb2ludHMoZW5kLCBzdGFydCwgaGludGVuZGRpciwgZGlyMSwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgIGkgPSByZXQyLmxlbmd0aCAtIDE7XG5cbiAgICAgICAgICAgICAgICAgICAgd2hpbGUgKGktLSA+IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldC5wdXNoKHJldDJbaV0pO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KHN0YXJ0LmVxdWFscyhlbmQpLCAnQXJHcmFwaC5jb25uZWN0UG9pbnRzOiBzdGFydC5lcXVhbHMoZW5kKSBGQUlMRUQnKTtcbiAgICAgICAgICAgICAgICAgICAgb2xkID0gQ09OU1RBTlRTLkVNUFRZX1BPSU5UO1xuICAgICAgICAgICAgICAgICAgICBzdGFydCA9IGVuZCA9IG9sZEVuZDtcbiAgICAgICAgICAgICAgICB9IGVsc2UgeyAgLy9JZiB3ZSBoYXZlIGZsaXBwZWQgYW5kIGJvdGggcG9pbnRzIGFyZSBpbiB0aGUgc2FtZSBidWZmZXJib3hcbiAgICAgICAgICAgICAgICAgICAgLy8gV2Ugd2lsbCBodWdjaGlsZHJlbiB1bnRpbCB3ZSBjYW4gY29ubmVjdCBib3RoIHBvaW50cy5cbiAgICAgICAgICAgICAgICAgICAgLy8gSWYgd2UgY2FuJ3QsIGZvcmNlIGl0XG4gICAgICAgICAgICAgICAgICAgIHB0cyA9IHRoaXMuX2h1Z0NoaWxkcmVuKGJ1ZmZlck9iamVjdCwgc3RhcnQsIGRpcjEsIGRpcjIsIGZpbmRFeGl0VG9FbmRwb2ludCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwdHMgIT09IG51bGwpIHsgIC8vIFRoZXJlIGlzIGEgcGF0aCBmcm9tIHN0YXJ0IC0+IGVuZFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHB0cy5sZW5ndGgpIHsgIC8vIEFkZCBuZXcgcG9pbnRzIHRvIHRoZSBjdXJyZW50IGxpc3QgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0ID0gcmV0LmNvbmNhdChwdHMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0LnB1c2gobmV3IEFyUG9pbnQoc3RhcnQpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0LmFzc2lnbihlbmQpOyAgLy8gVGhlc2Ugc2hvdWxkIG5vdCBiZSBza2V3ISBGSVhNRVxuXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7IC8vRm9yY2UgdG8gdGhlIGVuZHBvaW50XG4gICAgICAgICAgICAgICAgICAgICAgICBhc3NlcnQoVXRpbHMuaXNSaWdodEFuZ2xlKGRpcjEpLCAnQVJHcmFwaC5jb25uZWN0UG9pbnRzOiBVdGlscy5pc1JpZ2h0QW5nbGUgKGRpcjEpIEZBSUxFRCcpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoVXRpbHMuaXNIb3Jpem9udGFsKGRpcjEpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnQueCA9IGVuZC54O1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGFydC55ID0gZW5kLnk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHJldC5wdXNoKG5ldyBBclBvaW50KHN0YXJ0KSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghVXRpbHMuaXNIb3Jpem9udGFsKGRpcjEpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnQueCA9IGVuZC54O1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGFydC55ID0gZW5kLnk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHJldC5wdXNoKG5ldyBBclBvaW50KHN0YXJ0KSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGFzc2VydChzdGFydC5lcXVhbHMoZW5kKSk7ICAvLyBXZSBhcmUgZm9yY2luZyBvdXQgc28gdGhlc2Ugc2hvdWxkIGJlIHRoZSBzYW1lIG5vd1xuXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgYXNzZXJ0KCFzdGFydC5lcXVhbHMob2xkKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChVdGlscy5pc1BvaW50SW5EaXJGcm9tKGVuZCwgcmVjdCwgZGlyMikpIHtcblxuICAgICAgICAgICAgICAgIGFzc2VydCghVXRpbHMuaXNQb2ludEluRGlyRnJvbShzdGFydCwgcmVjdCwgZGlyMiksXG4gICAgICAgICAgICAgICAgICAgICdBUkdyYXBoLmNvbm5lY3RQb2ludHM6ICFVdGlscy5pc1BvaW50SW5EaXJGcm9tKHN0YXJ0LCByZWN0LCBkaXIyKSBGQUlMRUQnKTtcbiAgICAgICAgICAgICAgICBib3ggPSB0aGlzLl9nb1RvTmV4dEJ1ZmZlckJveCh7XG4gICAgICAgICAgICAgICAgICAgIHBvaW50OiBzdGFydCxcbiAgICAgICAgICAgICAgICAgICAgZGlyOiBkaXIyLFxuICAgICAgICAgICAgICAgICAgICBkaXIyOiBkaXIxLFxuICAgICAgICAgICAgICAgICAgICBlbmQ6IGVuZFxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgLy8gdGhpcyBhc3NlcnQgZmFpbHMgaWYgdHdvIGJveGVzIGFyZSBhZGphY2VudCwgYW5kIGEgY29ubmVjdGlvbiB3YW50cyB0byBnbyBiZXR3ZWVuXG4gICAgICAgICAgICAgICAgLy9hc3NlcnQoVXRpbHMuaXNQb2ludEluRGlyRnJvbShzdGFydCwgcmVjdCwgZGlyMiksXG4gICAgICAgICAgICAgICAgLy8gJ0FSR3JhcGguY29ubmVjdFBvaW50czogVXRpbHMuaXNQb2ludEluRGlyRnJvbShzdGFydCwgcmVjdCwgZGlyMikgRkFJTEVEJyk7XG4gICAgICAgICAgICAgICAgLy8gVGhpcyBpcyBub3QgdGhlIGJlc3QgY2hlY2sgd2l0aCBwYXJlbnQgYm94ZXNcbiAgICAgICAgICAgICAgICBpZiAoc3RhcnQuZXF1YWxzKG9sZCkpIHsgLy9UaGVuIHdlIGFyZSBpbiBhIGNvcm5lclxuICAgICAgICAgICAgICAgICAgICBpZiAoYm94LmNoaWxkcmVuLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHB0cyA9IHRoaXMuX2h1Z0NoaWxkcmVuKGJveCwgc3RhcnQsIGRpcjIsIGRpcjEsIGdldFRvRGlyMVNpZGUpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcHRzID0gdGhpcy5faHVnQ2hpbGRyZW4oYnVmZmVyT2JqZWN0LCBzdGFydCwgZGlyMSwgZGlyMik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHB0cyAhPT0gbnVsbCkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvL0FkZCBuZXcgcG9pbnRzIHRvIHRoZSBjdXJyZW50IGxpc3QgXG4gICAgICAgICAgICAgICAgICAgICAgICByZXQgPSByZXQuY29uY2F0KHB0cyk7XG5cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHsgLy9HbyB0aHJvdWdoIHRoZSBibG9ja2luZyBib3hcbiAgICAgICAgICAgICAgICAgICAgICAgIGFzc2VydChVdGlscy5pc1JpZ2h0QW5nbGUoZGlyMSksICdBUkdyYXBoLmdldE91dE9mQm94OiBVdGlscy5pc1JpZ2h0QW5nbGUgKGRpcjEpIEZBSUxFRCcpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoVXRpbHMuaXNIb3Jpem9udGFsKGRpcjEpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnQueCA9IFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKGJ1ZmZlck9iamVjdC5ib3gsIGRpcjEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGFydC55ID0gVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQoYnVmZmVyT2JqZWN0LmJveCwgZGlyMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGFzc2VydChVdGlscy5pc1BvaW50QmV0d2VlblNpZGVzKGVuZCwgcmVjdCwgZGlyMSksXG4gICAgICAgICAgICAgICAgICAgICdBUkdyYXBoLmNvbm5lY3RQb2ludHM6IFV0aWxzLmlzUG9pbnRCZXR3ZWVuU2lkZXMoZW5kLCByZWN0LCBkaXIxKSBGQUlMRUQnKTtcbiAgICAgICAgICAgICAgICBhc3NlcnQoIVV0aWxzLmlzUG9pbnRJbihlbmQsIHJlY3QpLCAnQVJHcmFwaC5jb25uZWN0UG9pbnRzOiAhVXRpbHMuaXNQb2ludEluKGVuZCwgcmVjdCkgRkFJTEVEJyk7XG5cbiAgICAgICAgICAgICAgICByZXYgPSAwO1xuXG4gICAgICAgICAgICAgICAgaWYgKFV0aWxzLnJldmVyc2VEaXIoZGlyMikgPT09IGhpbnRlbmRkaXIgJiZcbiAgICAgICAgICAgICAgICAgICAgVXRpbHMuZ2V0Q2hpbGRSZWN0T3V0ZXJDb29yZEZyb20oYnVmZmVyT2JqZWN0LCBVdGlscy5yZXZlcnNlRGlyKGRpcjIpLCBzdGFydCkgPT09XG4gICAgICAgICAgICAgICAgICAgIFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKHJlY3QsIFV0aWxzLnJldmVyc2VEaXIoZGlyMikpKSB7IC8vQW5kIGlmIHBvaW50IGNhbiBleGl0IHRoYXQgd2F5XG4gICAgICAgICAgICAgICAgICAgIHJldiA9IDE7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChkaXIyICE9PSBoaW50ZW5kZGlyKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChVdGlscy5pc1BvaW50QmV0d2VlblNpZGVzKHRoZXN0YXJ0LCByZWN0LCBkaXIxKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKFV0aWxzLmlzUG9pbnRJbkRpckZyb20ocmVjdC5nZXRUb3BMZWZ0KCkucGx1cyhyZWN0LmdldEJvdHRvbVJpZ2h0KCkpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGFydC5wbHVzKGVuZCksIGRpcjIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV2ID0gMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChVdGlscy5pc1BvaW50SW5EaXJGcm9tKHN0YXJ0LCB0aGVzdGFydCwgZGlyMikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldiA9IDE7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAocmV2KSB7XG4gICAgICAgICAgICAgICAgICAgIGRpcjIgPSBVdGlscy5yZXZlcnNlRGlyKGRpcjIpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vSWYgdGhlIGJveCBpbiB0aGUgd2F5IGhhcyBvbmUgY2hpbGRcbiAgICAgICAgICAgICAgICBpZiAoYnVmZmVyT2JqZWN0LmNoaWxkcmVuLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoVXRpbHMuaXNIb3Jpem9udGFsKGRpcjIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdGFydC54ID0gVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQocmVjdCwgZGlyMik7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdGFydC55ID0gVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQocmVjdCwgZGlyMik7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBhc3NlcnQoIXN0YXJ0LmVxdWFscyhvbGQpLCAnQVJHcmFwaC5jb25uZWN0UG9pbnRzOiAhc3RhcnQuZXF1YWxzKG9sZCkgRkFJTEVEJyk7XG4gICAgICAgICAgICAgICAgICAgIHJldC5wdXNoKG5ldyBBclBvaW50KHN0YXJ0KSk7XG4gICAgICAgICAgICAgICAgICAgIG9sZC5hc3NpZ24oc3RhcnQpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChVdGlscy5pc0hvcml6b250YWwoZGlyMSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0LnggPSBVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChyZWN0LCBkaXIxKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0LnkgPSBVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChyZWN0LCBkaXIxKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGFzc2VydChVdGlscy5pc1BvaW50SW5EaXJGcm9tKGVuZCwgc3RhcnQsIGRpcjEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ0FSR3JhcGguY29ubmVjdFBvaW50czogVXRpbHMuaXNQb2ludEluRGlyRnJvbShlbmQsIHN0YXJ0LCBkaXIxKSBGQUlMRUQnKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKFV0aWxzLmdldFBvaW50Q29vcmQoc3RhcnQsIGRpcjEpICE9PSBVdGlscy5nZXRQb2ludENvb3JkKGVuZCwgZGlyMSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dvVG9OZXh0QnVmZmVyQm94KHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwb2ludDogc3RhcnQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGlyOiBkaXIxLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVuZDogZW5kXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgfSBlbHNlIHsgLy9JZiB0aGUgYm94IGhhcyBtdWx0aXBsZSBjaGlsZHJlblxuICAgICAgICAgICAgICAgICAgICBwdHMgPSB0aGlzLl9odWdDaGlsZHJlbihidWZmZXJPYmplY3QsIHN0YXJ0LCBkaXIxLCBkaXIyLCBnZXRUb0RpcjFTaWRlKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHB0cyAhPT0gbnVsbCkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvL0FkZCBuZXcgcG9pbnRzIHRvIHRoZSBjdXJyZW50IGxpc3QgXG4gICAgICAgICAgICAgICAgICAgICAgICByZXQgPSByZXQuY29uY2F0KHB0cyk7XG5cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHsgLy9HbyB0aHJvdWdoIHRoZSBibG9ja2luZyBib3hcbiAgICAgICAgICAgICAgICAgICAgICAgIGFzc2VydChVdGlscy5pc1JpZ2h0QW5nbGUoZGlyMSksICdBUkdyYXBoLmdldE91dE9mQm94OiBVdGlscy5pc1JpZ2h0QW5nbGUgKGRpcjEpIEZBSUxFRCcpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoVXRpbHMuaXNIb3Jpem9udGFsKGRpcjEpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnQueCA9IFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKGJ1ZmZlck9iamVjdC5ib3gsIGRpcjEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGFydC55ID0gVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQoYnVmZmVyT2JqZWN0LmJveCwgZGlyMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGFzc2VydCghc3RhcnQuZXF1YWxzKG9sZCksICdBUkdyYXBoLmNvbm5lY3RQb2ludHM6ICFzdGFydC5lcXVhbHMob2xkKSBGQUlMRUQnKTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgcmV0LnB1c2goZW5kKTtcblxuICAgIGlmIChDT05TVEFOVFMuREVCVUcpIHtcbiAgICAgICAgcmV0LmFzc2VydFZhbGlkKCk7ICAvLyBDaGVjayB0aGF0IGFsbCBlZGdlcyBhcmUgaG9yaXpvbnRhbCBhcmUgdmVydGljYWxcbiAgICB9XG5cbiAgICByZXR1cm4gcmV0O1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fZGlzY29ubmVjdEFsbCA9IGZ1bmN0aW9uICgpIHtcbiAgICBmb3IgKHZhciBpID0gdGhpcy5wYXRocy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgdGhpcy5kaXNjb25uZWN0KHRoaXMucGF0aHNbaV0pO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuZGlzY29ubmVjdCA9IGZ1bmN0aW9uIChwYXRoKSB7XG4gICAgaWYgKHBhdGguaXNDb25uZWN0ZWQoKSkge1xuICAgICAgICB0aGlzLmRlbGV0ZUVkZ2VzKHBhdGgpO1xuICAgIH1cblxuICAgIHBhdGguZGVsZXRlQWxsKCk7XG4gICAgdGhpcy5jb21wbGV0ZWx5Q29ubmVjdGVkID0gZmFsc2U7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9kaXNjb25uZWN0UGF0aHNDbGlwcGluZyA9IGZ1bmN0aW9uIChyZWN0KSB7XG4gICAgZm9yICh2YXIgaSA9IHRoaXMucGF0aHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIGlmICh0aGlzLnBhdGhzW2ldLmlzUGF0aENsaXAocmVjdCkpIHtcbiAgICAgICAgICAgIHRoaXMuZGlzY29ubmVjdCh0aGlzLnBhdGhzW2ldKTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2Rpc2Nvbm5lY3RQYXRoc0Zyb20gPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgdmFyIGl0ZXIgPSB0aGlzLnBhdGhzLmxlbmd0aCxcbiAgICAgICAgcGF0aCxcbiAgICAgICAgc3RhcnRwb3J0LFxuICAgICAgICBlbmRwb3J0O1xuXG4gICAgaWYgKG9iaiBpbnN0YW5jZW9mIEF1dG9Sb3V0ZXJCb3gpIHtcbiAgICAgICAgdmFyIGJveCA9IG9iaixcbiAgICAgICAgICAgIHN0YXJ0Ym94LFxuICAgICAgICAgICAgZW5kYm94O1xuICAgICAgICB3aGlsZSAoaXRlci0tKSB7XG4gICAgICAgICAgICBwYXRoID0gdGhpcy5wYXRoc1tpdGVyXTtcblxuICAgICAgICAgICAgYXNzZXJ0KHBhdGguc3RhcnRwb3J0cyAhPT0gbnVsbCwgJ0FSR3JhcGguZGlzY29ubmVjdFBhdGhzRnJvbTogc3RhcnRwb3J0ICE9PSBudWxsIEZBSUxFRCcpO1xuICAgICAgICAgICAgYXNzZXJ0KHBhdGguc3RhcnRwb3J0cy5sZW5ndGggPiAwLCAnQVJHcmFwaC5kaXNjb25uZWN0UGF0aHNGcm9tOiBQYXRoIGhhcyBubyBzdGFydHBvcnRzJyk7XG4gICAgICAgICAgICBhc3NlcnQocGF0aC5lbmRwb3J0cyAhPT0gbnVsbCwgJ0FSR3JhcGguZGlzY29ubmVjdFBhdGhzRnJvbTogZW5kcG9ydCAhPT0gbnVsbCBGQUlMRUQnKTtcbiAgICAgICAgICAgIGFzc2VydChwYXRoLmVuZHBvcnRzLmxlbmd0aCA+IDAsICdBUkdyYXBoLmRpc2Nvbm5lY3RQYXRoc0Zyb206IFBhdGggaGFzIG5vIGVuZHBvcnRzJyk7XG5cbiAgICAgICAgICAgIC8vIENhbiBzaW1wbHkgc2VsZWN0IGFueSBzdGFydC9lbmQgcG9ydCB0byBjaGVjayB0aGUgb3duZXJcbiAgICAgICAgICAgIHN0YXJ0Ym94ID0gcGF0aC5zdGFydHBvcnRzWzBdLm93bmVyO1xuICAgICAgICAgICAgZW5kYm94ID0gcGF0aC5lbmRwb3J0c1swXS5vd25lcjtcblxuICAgICAgICAgICAgYXNzZXJ0KHN0YXJ0Ym94ICE9PSBudWxsLCAnQVJHcmFwaC5kaXNjb25uZWN0UGF0aHNGcm9tOiBzdGFydGJveCAhPT0gbnVsbCBGQUlMRUQnKTtcbiAgICAgICAgICAgIGFzc2VydChlbmRib3ggIT09IG51bGwsICdBUkdyYXBoLmRpc2Nvbm5lY3RQYXRoc0Zyb206IGVuZGJveCAhPT0gbnVsbCBGQUlMRUQnKTtcblxuICAgICAgICAgICAgaWYgKChzdGFydGJveCA9PT0gYm94IHx8IGVuZGJveCA9PT0gYm94KSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGlzY29ubmVjdChwYXRoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG4gICAgfSBlbHNlIHsgIC8vIEFzc3VtaW5nICdib3gnIGlzIGEgcG9ydFxuXG4gICAgICAgIHZhciBwb3J0ID0gb2JqO1xuICAgICAgICB3aGlsZSAoaXRlci0tKSB7XG4gICAgICAgICAgICBwYXRoID0gdGhpcy5wYXRoc1tpdGVyXTtcbiAgICAgICAgICAgIHN0YXJ0cG9ydCA9IHBhdGguZ2V0U3RhcnRQb3J0KCk7XG4gICAgICAgICAgICBlbmRwb3J0ID0gcGF0aC5nZXRFbmRQb3J0KCk7XG5cbiAgICAgICAgICAgIGlmICgoc3RhcnRwb3J0ID09PSBwb3J0IHx8IGVuZHBvcnQgPT09IHBvcnQpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kaXNjb25uZWN0KHBhdGgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9hZGRTZWxmRWRnZXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5ob3Jpem9udGFsLmFkZEVkZ2VzKHRoaXMpO1xuICAgIHRoaXMudmVydGljYWwuYWRkRWRnZXModGhpcyk7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9hZGRFZGdlcyA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICBhc3NlcnQoIShvYmogaW5zdGFuY2VvZiBBdXRvUm91dGVyUGF0aCksICdObyBQYXRocyBzaG91bGQgYmUgaGVyZSEnKTtcbiAgICBpZiAob2JqIGluc3RhbmNlb2YgQXV0b1JvdXRlclBvcnQpIHtcbiAgICAgICAgdGhpcy5ob3Jpem9udGFsLmFkZFBvcnRFZGdlcyhvYmopO1xuICAgICAgICB0aGlzLnZlcnRpY2FsLmFkZFBvcnRFZGdlcyhvYmopO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuaG9yaXpvbnRhbC5hZGRFZGdlcyhvYmopO1xuICAgICAgICB0aGlzLnZlcnRpY2FsLmFkZEVkZ2VzKG9iaik7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5kZWxldGVFZGdlcyA9IGZ1bmN0aW9uIChvYmplY3QpIHtcbiAgICB0aGlzLmhvcml6b250YWwuZGVsZXRlRWRnZXMob2JqZWN0KTtcbiAgICB0aGlzLnZlcnRpY2FsLmRlbGV0ZUVkZ2VzKG9iamVjdCk7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9hZGRBbGxFZGdlcyA9IGZ1bmN0aW9uICgpIHtcbiAgICBhc3NlcnQodGhpcy5ob3Jpem9udGFsLmlzRW1wdHkoKSAmJiB0aGlzLnZlcnRpY2FsLmlzRW1wdHkoKSxcbiAgICAgICAgJ0FSR3JhcGguYWRkQWxsRWRnZXM6IGhvcml6b250YWwuaXNFbXB0eSgpICYmIHZlcnRpY2FsLmlzRW1wdHkoKSBGQUlMRUQnKTtcblxuICAgIHZhciBpZHMgPSBPYmplY3Qua2V5cyh0aGlzLmJveGVzKSxcbiAgICAgICAgaTtcblxuICAgIGZvciAoaSA9IGlkcy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgdGhpcy5fYWRkQm94QW5kUG9ydEVkZ2VzKHRoaXMuYm94ZXNbaWRzW2ldXSk7XG4gICAgfVxuXG4gICAgZm9yIChpID0gdGhpcy5wYXRocy5sZW5ndGg7IGktLTspIHtcbiAgICAgICAgdGhpcy5ob3Jpem9udGFsLmFkZFBhdGhFZGdlcyh0aGlzLnBhdGhzW2ldKTtcbiAgICAgICAgdGhpcy52ZXJ0aWNhbC5hZGRQYXRoRWRnZXModGhpcy5wYXRoc1tpXSk7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fZGVsZXRlQWxsRWRnZXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5ob3Jpem9udGFsLmRlbGV0ZUFsbEVkZ2VzKCk7XG4gICAgdGhpcy52ZXJ0aWNhbC5kZWxldGVBbGxFZGdlcygpO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fYWRkQm94QW5kUG9ydEVkZ2VzID0gZnVuY3Rpb24gKGJveCkge1xuICAgIGFzc2VydChib3ggIT09IG51bGwsICdBUkdyYXBoLmFkZEJveEFuZFBvcnRFZGdlczogYm94ICE9PSBudWxsIEZBSUxFRCcpO1xuXG4gICAgdGhpcy5fYWRkRWRnZXMoYm94KTtcblxuICAgIGZvciAodmFyIGkgPSBib3gucG9ydHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHRoaXMuX2FkZEVkZ2VzKGJveC5wb3J0c1tpXSk7XG4gICAgfVxuXG4gICAgLy8gQWRkIHRvIGJ1ZmZlcmJveGVzXG4gICAgdGhpcy5fYWRkVG9CdWZmZXJCb3hlcyhib3gpO1xuICAgIHRoaXMuX3VwZGF0ZUJveFBvcnRBdmFpbGFiaWxpdHkoYm94KTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2RlbGV0ZUJveEFuZFBvcnRFZGdlcyA9IGZ1bmN0aW9uIChib3gpIHtcbiAgICBhc3NlcnQoYm94ICE9PSBudWxsLCAnQVJHcmFwaC5kZWxldGVCb3hBbmRQb3J0RWRnZXM6IGJveCAhPT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIHRoaXMuZGVsZXRlRWRnZXMoYm94KTtcblxuICAgIGZvciAodmFyIGkgPSBib3gucG9ydHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHRoaXMuZGVsZXRlRWRnZXMoYm94LnBvcnRzW2ldKTtcbiAgICB9XG5cbiAgICB0aGlzLl9yZW1vdmVGcm9tQnVmZmVyQm94ZXMoYm94KTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2dldEVkZ2VMaXN0ID0gZnVuY3Rpb24gKGlzaG9yaXpvbnRhbCkge1xuICAgIHJldHVybiBpc2hvcml6b250YWwgPyB0aGlzLmhvcml6b250YWwgOiB0aGlzLnZlcnRpY2FsO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fY2FuZGVsZXRlVHdvRWRnZXNBdCA9IGZ1bmN0aW9uIChwYXRoLCBwb2ludHMsIHBvcykge1xuICAgIGlmIChDT05TVEFOVFMuREVCVUcpIHtcbiAgICAgICAgYXNzZXJ0KHBhdGgub3duZXIgPT09IHRoaXMsICdBUkdyYXBoLmNhbmRlbGV0ZVR3b0VkZ2VzQXQ6IHBhdGgub3duZXIgPT09IHRoaXMgRkFJTEVEJyk7XG4gICAgICAgIHBhdGguYXNzZXJ0VmFsaWQoKTtcbiAgICAgICAgYXNzZXJ0KHBhdGguaXNDb25uZWN0ZWQoKSwgJ0FSR3JhcGguY2FuZGVsZXRlVHdvRWRnZXNBdDogcGF0aC5pc0Nvbm5lY3RlZCgpIEZBSUxFRCcpO1xuICAgICAgICBwb2ludHMuQXNzZXJ0VmFsaWRQb3MocG9zKTtcbiAgICB9XG5cbiAgICBpZiAocG9zICsgMiA+PSBwb2ludHMubGVuZ3RoIHx8IHBvcyA8IDEpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHZhciBwb2ludHBvcyA9IHBvcyxcbiAgICAgICAgcG9pbnQgPSBwb2ludHNbcG9zKytdLFxuICAgICAgICBucG9pbnRwb3MgPSBwb3MsXG4gICAgICAgIG5wb2ludCA9IHBvaW50c1twb3MrK10sXG4gICAgICAgIG5ucG9pbnRwb3MgPSBwb3M7XG5cbiAgICBwb3MgPSBwb2ludHBvcztcbiAgICBwb3MtLTtcbiAgICB2YXIgcHBvaW50cG9zID0gcG9zO1xuXG4gICAgdmFyIHBwb2ludCA9IHBvaW50c1twb3MtLV0sXG4gICAgICAgIHBwcG9pbnRwb3MgPSBwb3M7XG5cbiAgICBpZiAobnBvaW50LmVxdWFscyhwb2ludCkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlOyAvLyBkaXJlY3Rpb24gb2YgemVyby1sZW5ndGggZWRnZXMgY2FuJ3QgYmUgZGV0ZXJtaW5lZCwgc28gZG9uJ3QgZGVsZXRlIHRoZW1cbiAgICB9XG5cbiAgICBhc3NlcnQocHBwb2ludHBvcyA8IHBvaW50cy5sZW5ndGggJiYgcHBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCAmJiBwb2ludHBvcyA8IHBvaW50cy5sZW5ndGggJiZcbiAgICAgICAgbnBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCAmJiBubnBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCxcbiAgICAgICAgJ0FSR3JhcGguY2FuZGVsZXRlVHdvRWRnZXNBdDogcHBwb2ludHBvcyA8IHBvaW50cy5sZW5ndGggJiYgcHBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCAmJicgK1xuICAgICAgICAncG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoICYmIG5wb2ludHBvcyA8IHBvaW50cy5sZW5ndGggJiYgbm5wb2ludHBvcyA8IHBvaW50cy5sZW5ndGggRkFJTEVEJyk7XG5cbiAgICB2YXIgZGlyID0gVXRpbHMuZ2V0RGlyKG5wb2ludC5taW51cyhwb2ludCkpO1xuXG4gICAgYXNzZXJ0KFV0aWxzLmlzUmlnaHRBbmdsZShkaXIpLCAnQVJHcmFwaC5jYW5kZWxldGVUd29FZGdlc0F0OiBVdGlscy5pc1JpZ2h0QW5nbGUgKGRpcikgRkFJTEVEJyk7XG4gICAgdmFyIGlzaG9yaXpvbnRhbCA9IFV0aWxzLmlzSG9yaXpvbnRhbChkaXIpO1xuXG4gICAgdmFyIG5ld3BvaW50ID0gbmV3IEFyUG9pbnQoKTtcblxuICAgIGlmIChpc2hvcml6b250YWwpIHtcbiAgICAgICAgbmV3cG9pbnQueCA9IFV0aWxzLmdldFBvaW50Q29vcmQobnBvaW50LCBpc2hvcml6b250YWwpO1xuICAgICAgICBuZXdwb2ludC55ID0gVXRpbHMuZ2V0UG9pbnRDb29yZChwcG9pbnQsICFpc2hvcml6b250YWwpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG5ld3BvaW50LnkgPSBVdGlscy5nZXRQb2ludENvb3JkKG5wb2ludCwgaXNob3Jpem9udGFsKTtcbiAgICAgICAgbmV3cG9pbnQueCA9IFV0aWxzLmdldFBvaW50Q29vcmQocHBvaW50LCAhaXNob3Jpem9udGFsKTtcbiAgICB9XG5cbiAgICBhc3NlcnQoVXRpbHMuZ2V0RGlyKG5ld3BvaW50Lm1pbnVzKHBwb2ludCkpID09PSBkaXIsXG4gICAgICAgICdBUkdyYXBoLmNhbmRlbGV0ZVR3b0VkZ2VzQXQ6IFV0aWxzLmdldERpciAobmV3cG9pbnQubWludXMocHBvaW50KSkgPT09IGRpciBGQUlMRUQnKTtcblxuICAgIGlmICh0aGlzLl9pc0xpbmVDbGlwQm94ZXMobmV3cG9pbnQsIG5wb2ludCkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBpZiAodGhpcy5faXNMaW5lQ2xpcEJveGVzKG5ld3BvaW50LCBwcG9pbnQpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2RlbGV0ZVR3b0VkZ2VzQXQgPSBmdW5jdGlvbiAocGF0aCwgcG9pbnRzLCBwb3MpIHtcbiAgICBpZiAoQ09OU1RBTlRTLkRFQlVHKSB7XG4gICAgICAgIGFzc2VydChwYXRoLm93bmVyID09PSB0aGlzLCAnQVJHcmFwaC5kZWxldGVUd29FZGdlc0F0OiBwYXRoLm93bmVyID09PSB0aGlzIEZBSUxFRCcpO1xuICAgICAgICBwYXRoLmFzc2VydFZhbGlkKCk7XG4gICAgICAgIGFzc2VydChwYXRoLmlzQ29ubmVjdGVkKCksICdBUkdyYXBoLmRlbGV0ZVR3b0VkZ2VzQXQ6IHBhdGguaXNDb25uZWN0ZWQoKSBGQUlMRUQnKTtcbiAgICAgICAgcG9pbnRzLkFzc2VydFZhbGlkUG9zKHBvcyk7XG4gICAgfVxuXG4gICAgdmFyIHBvaW50cG9zID0gcG9zLCAvL0dldHRpbmcgdGhlIG5leHQsIGFuZCBuZXh0LW5leHQsIHBvaW50c1xuICAgICAgICBwb2ludCA9IHBvaW50c1twb3MrK10sXG4gICAgICAgIG5wb2ludHBvcyA9IHBvcyxcbiAgICAgICAgbnBvaW50ID0gcG9pbnRzW3BvcysrXSxcbiAgICAgICAgbm5wb2ludHBvcyA9IHBvcyxcbiAgICAgICAgbm5wb2ludCA9IHBvaW50c1twb3MrK10sXG4gICAgICAgIG5ubnBvaW50cG9zID0gcG9zO1xuXG4gICAgcG9zID0gcG9pbnRwb3M7XG4gICAgcG9zLS07XG5cbiAgICB2YXIgcHBvaW50cG9zID0gcG9zLCAvL0dldHRpbmcgdGhlIHByZXYsIHByZXYtcHJldiBwb2ludHNcbiAgICAgICAgcHBvaW50ID0gcG9pbnRzW3Bvcy0tXSxcbiAgICAgICAgcHBwb2ludHBvcyA9IHBvcyxcbiAgICAgICAgcHBwb2ludCA9IHBvaW50c1twb3MtLV07XG5cbiAgICBhc3NlcnQocHBwb2ludHBvcyA8IHBvaW50cy5sZW5ndGggJiYgcHBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCAmJiBwb2ludHBvcyA8IHBvaW50cy5sZW5ndGggJiZcbiAgICBucG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoICYmIG5ucG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoLFxuICAgICAgICAnQVJHcmFwaC5kZWxldGVUd29FZGdlc0F0OiBwcHBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCAmJiBwcG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoICYmIHBvaW50cG9zIDwgJyArXG4gICAgICAgICdwb2ludHMubGVuZ3RoICYmIG5wb2ludHBvcyA8IHBvaW50cy5sZW5ndGggJiYgbm5wb2ludHBvcyA8IHBvaW50cy5sZW5ndGggRkFJTEVEJyk7XG4gICAgYXNzZXJ0KHBwcG9pbnQgIT09IG51bGwgJiYgcHBvaW50ICE9PSBudWxsICYmIHBvaW50ICE9PSBudWxsICYmIG5wb2ludCAhPT0gbnVsbCAmJiBubnBvaW50ICE9PSBudWxsLFxuICAgICAgICAnQVJHcmFwaC5kZWxldGVUd29FZGdlc0F0OiBwcHBvaW50ICE9PSBudWxsICYmIHBwb2ludCAhPT0gbnVsbCAmJiBwb2ludCAhPT0gbnVsbCAmJiBucG9pbnQgIT09IG51bGwgJiYnICtcbiAgICAgICAgJyBubnBvaW50ICE9PSBudWxsIEZBSUxFRCcpO1xuXG4gICAgdmFyIGRpciA9IFV0aWxzLmdldERpcihucG9pbnQubWludXMocG9pbnQpKTtcblxuICAgIGFzc2VydChVdGlscy5pc1JpZ2h0QW5nbGUoZGlyKSwgJ0FSR3JhcGguZGVsZXRlVHdvRWRnZXNBdDogVXRpbHMuaXNSaWdodEFuZ2xlIChkaXIpIEZBSUxFRCcpO1xuICAgIHZhciBpc2hvcml6b250YWwgPSBVdGlscy5pc0hvcml6b250YWwoZGlyKTtcblxuICAgIHZhciBuZXdwb2ludCA9IG5ldyBBclBvaW50KCk7XG4gICAgaWYgKGlzaG9yaXpvbnRhbCkge1xuICAgICAgICBuZXdwb2ludC54ID0gVXRpbHMuZ2V0UG9pbnRDb29yZChucG9pbnQsIGlzaG9yaXpvbnRhbCk7XG4gICAgICAgIG5ld3BvaW50LnkgPSBVdGlscy5nZXRQb2ludENvb3JkKHBwb2ludCwgIWlzaG9yaXpvbnRhbCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbmV3cG9pbnQueCA9IFV0aWxzLmdldFBvaW50Q29vcmQocHBvaW50LCAhaXNob3Jpem9udGFsKTtcbiAgICAgICAgbmV3cG9pbnQueSA9IFV0aWxzLmdldFBvaW50Q29vcmQobnBvaW50LCBpc2hvcml6b250YWwpO1xuICAgIH1cblxuICAgIGFzc2VydChVdGlscy5nZXREaXIobmV3cG9pbnQubWludXMocHBvaW50KSkgPT09IGRpcixcbiAgICAgICAgJ0FSR3JhcGguZGVsZXRlVHdvRWRnZXNBdDogVXRpbHMuZ2V0RGlyIChuZXdwb2ludC5taW51cyhwcG9pbnQpKSA9PT0gZGlyIEZBSUxFRCcpO1xuXG4gICAgYXNzZXJ0KCF0aGlzLl9pc0xpbmVDbGlwQm94ZXMobmV3cG9pbnQsIG5wb2ludCksXG4gICAgICAgICdBUkdyYXBoLmRlbGV0ZVR3b0VkZ2VzQXQ6ICFpc0xpbmVDbGlwQm94ZXMobmV3cG9pbnQsIG5wb2ludCkgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KCF0aGlzLl9pc0xpbmVDbGlwQm94ZXMobmV3cG9pbnQsIHBwb2ludCksXG4gICAgICAgICdBUkdyYXBoLmRlbGV0ZVR3b0VkZ2VzQXQ6ICFpc0xpbmVDbGlwQm94ZXMobmV3cG9pbnQsIHBwb2ludCkgRkFJTEVEJyk7XG5cbiAgICB2YXIgaGxpc3QgPSB0aGlzLl9nZXRFZGdlTGlzdChpc2hvcml6b250YWwpLFxuICAgICAgICB2bGlzdCA9IHRoaXMuX2dldEVkZ2VMaXN0KCFpc2hvcml6b250YWwpO1xuXG4gICAgdmFyIHBwZWRnZSA9IGhsaXN0LmdldEVkZ2VCeVBvaW50ZXIocHBwb2ludCksXG4gICAgICAgIHBlZGdlID0gdmxpc3QuZ2V0RWRnZUJ5UG9pbnRlcihwcG9pbnQpLFxuICAgICAgICBuZWRnZSA9IGhsaXN0LmdldEVkZ2VCeVBvaW50ZXIocG9pbnQpLFxuICAgICAgICBubmVkZ2UgPSB2bGlzdC5nZXRFZGdlQnlQb2ludGVyKG5wb2ludCk7XG5cbiAgICBhc3NlcnQocHBlZGdlICE9PSBudWxsICYmIHBlZGdlICE9PSBudWxsICYmIG5lZGdlICE9PSBudWxsICYmIG5uZWRnZSAhPT0gbnVsbCxcbiAgICAgICAgJ0FSR3JhcGguZGVsZXRlVHdvRWRnZXNBdDogIHBwZWRnZSAhPT0gbnVsbCAmJiBwZWRnZSAhPT0gbnVsbCAmJiBuZWRnZSAhPT0gbnVsbCAmJiBubmVkZ2UgIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICB2bGlzdC5yZW1vdmUocGVkZ2UpO1xuICAgIGhsaXN0LnJlbW92ZShuZWRnZSk7XG5cbiAgICBwb2ludHMuc3BsaWNlKHBwb2ludHBvcywgMywgbmV3cG9pbnQpO1xuICAgIHBwZWRnZS5lbmRwb2ludE5leHQgPSBubnBvaW50O1xuICAgIHBwZWRnZS5lbmRwb2ludCA9IG5ld3BvaW50O1xuXG4gICAgbm5lZGdlLnN0YXJ0cG9pbnQgPSBuZXdwb2ludDtcbiAgICBubmVkZ2Uuc3RhcnRwb2ludFByZXYgPSBwcHBvaW50O1xuXG4gICAgaWYgKG5ubnBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCkge1xuICAgICAgICB2YXIgbm5uZWRnZSA9IGhsaXN0LmdldEVkZ2VCeVBvaW50ZXIobm5wb2ludCwgKG5ubnBvaW50cG9zKSk7XG4gICAgICAgIGFzc2VydChubm5lZGdlICE9PSBudWxsLFxuICAgICAgICAgICAgJ0FSR3JhcGguZGVsZXRlVHdvRWRnZXNBdDogbm5uZWRnZSAhPT0gbnVsbCBGQUlMRUQnKTtcbiAgICAgICAgYXNzZXJ0KG5ubmVkZ2Uuc3RhcnRwb2ludFByZXYuZXF1YWxzKG5wb2ludCkgJiYgbm5uZWRnZS5zdGFydHBvaW50LmVxdWFscyhubnBvaW50KSxcbiAgICAgICAgICAgICdBUkdyYXBoLmRlbGV0ZVR3b0VkZ2VzQXQ6IG5ubmVkZ2Uuc3RhcnRwb2ludFByZXYuZXF1YWxzKG5wb2ludCknICtcbiAgICAgICAgICAgICcmJiBubm5lZGdlLnN0YXJ0cG9pbnQuZXF1YWxzKG5ucG9pbnQpIEZBSUxFRCcpO1xuICAgICAgICBubm5lZGdlLnN0YXJ0cG9pbnRQcmV2ID0gcHBvaW50O1xuICAgIH1cblxuICAgIGlmIChubnBvaW50LmVxdWFscyhuZXdwb2ludCkpIHtcbiAgICAgICAgdGhpcy5fZGVsZXRlU2FtZVBvaW50c0F0KHBhdGgsIHBvaW50cywgcHBvaW50cG9zKTtcbiAgICB9XG5cbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuX2RlbGV0ZVNhbWVQb2ludHNBdCA9IGZ1bmN0aW9uIChwYXRoLCBwb2ludHMsIHBvcykge1xuICAgIGlmIChDT05TVEFOVFMuREVCVUcpIHtcbiAgICAgICAgYXNzZXJ0KHBhdGgub3duZXIgPT09IHRoaXMsICdBUkdyYXBoLmRlbGV0ZVNhbWVQb2ludHNBdDogcGF0aC5vd25lciA9PT0gdGhpcyBGQUlMRUQnKTtcbiAgICAgICAgcGF0aC5hc3NlcnRWYWxpZCgpO1xuICAgICAgICBhc3NlcnQocGF0aC5pc0Nvbm5lY3RlZCgpLCAnQVJHcmFwaC5kZWxldGVTYW1lUG9pbnRzQXQ6IHBhdGguaXNDb25uZWN0ZWQoKSBGQUlMRUQnKTtcbiAgICAgICAgcG9pbnRzLkFzc2VydFZhbGlkUG9zKHBvcyk7XG4gICAgfVxuXG4gICAgdmFyIHBvaW50cG9zID0gcG9zLFxuICAgICAgICBwb2ludCA9IHBvaW50c1twb3MrK10sXG4gICAgICAgIG5wb2ludHBvcyA9IHBvcyxcbiAgICAgICAgbnBvaW50ID0gcG9pbnRzW3BvcysrXSxcbiAgICAgICAgbm5wb2ludHBvcyA9IHBvcyxcbiAgICAgICAgbm5wb2ludCA9IHBvaW50c1twb3MrK10sXG4gICAgICAgIG5ubnBvaW50cG9zID0gcG9zO1xuXG4gICAgcG9zID0gcG9pbnRwb3M7XG4gICAgcG9zLS07XG5cbiAgICB2YXIgcHBvaW50cG9zID0gcG9zLFxuICAgICAgICBwcG9pbnQgPSBwb2ludHNbcG9zLS1dLFxuICAgICAgICBwcHBvaW50cG9zID0gcG9zLFxuICAgICAgICBwcHBvaW50ID0gcG9zID09PSBwb2ludHMubGVuZ3RoID8gbnVsbCA6IHBvaW50c1twb3MtLV07XG5cbiAgICBhc3NlcnQocHBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCAmJiBwb2ludHBvcyA8IHBvaW50cy5sZW5ndGggJiYgbnBvaW50cG9zIDwgcG9pbnRzLmxlbmd0aCAmJlxuICAgIG5ucG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoKTtcbiAgICBhc3NlcnQocHBvaW50ICE9PSBudWxsICYmIHBvaW50ICE9PSBudWxsICYmIG5wb2ludCAhPT0gbnVsbCAmJiBubnBvaW50ICE9PSBudWxsLFxuICAgICAgICAnQVJHcmFwaC5kZWxldGVTYW1lUG9pbnRzQXQ6IHBwb2ludCAhPT0gbnVsbCAmJiBwb2ludCAhPT0gbnVsbCAmJiBucG9pbnQgIT09IG51bGwgJiYgJyArXG4gICAgICAgICdubnBvaW50ICE9PSBudWxsIEZBSUxFRCcpO1xuICAgIGFzc2VydChwb2ludC5lcXVhbHMobnBvaW50KSAmJiAhcG9pbnQuZXF1YWxzKHBwb2ludCksXG4gICAgICAgICdBUkdyYXBoLmRlbGV0ZVNhbWVQb2ludHNBdDogcG9pbnQuZXF1YWxzKG5wb2ludCkgJiYgIXBvaW50LmVxdWFscyhwcG9pbnQpIEZBSUxFRCcpO1xuXG4gICAgdmFyIGRpciA9IFV0aWxzLmdldERpcihwb2ludC5taW51cyhwcG9pbnQpKTtcbiAgICBhc3NlcnQoVXRpbHMuaXNSaWdodEFuZ2xlKGRpciksICdBUkdyYXBoLmRlbGV0ZVNhbWVQb2ludHNBdDogVXRpbHMuaXNSaWdodEFuZ2xlIChkaXIpIEZBSUxFRCcpO1xuXG4gICAgdmFyIGlzaG9yaXpvbnRhbCA9IFV0aWxzLmlzSG9yaXpvbnRhbChkaXIpLFxuICAgICAgICBobGlzdCA9IHRoaXMuX2dldEVkZ2VMaXN0KGlzaG9yaXpvbnRhbCksXG4gICAgICAgIHZsaXN0ID0gdGhpcy5fZ2V0RWRnZUxpc3QoIWlzaG9yaXpvbnRhbCksXG5cbiAgICAgICAgcGVkZ2UgPSBobGlzdC5nZXRFZGdlQnlQb2ludGVyKHBwb2ludCwgcG9pbnQpLFxuICAgICAgICBuZWRnZSA9IHZsaXN0LmdldEVkZ2VCeVBvaW50ZXIocG9pbnQsIG5wb2ludCksXG4gICAgICAgIG5uZWRnZSA9IGhsaXN0LmdldEVkZ2VCeVBvaW50ZXIobnBvaW50LCBubnBvaW50KTtcblxuICAgIGFzc2VydChwZWRnZSAhPT0gbnVsbCAmJiBuZWRnZSAhPT0gbnVsbCAmJiBubmVkZ2UgIT09IG51bGwsICdBUkdyYXBoLmRlbGV0ZVNhbWVQb2ludHNBdDogcGVkZ2UgIT09IG51bGwgJyArXG4gICAgJyYmIG5lZGdlICE9PSBudWxsICYmIG5uZWRnZSAhPT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIHZsaXN0LnJlbW92ZShwZWRnZSk7XG4gICAgaGxpc3QucmVtb3ZlKG5lZGdlKTtcblxuICAgIHBvaW50cy5zcGxpY2UocG9pbnRwb3MsIDIpO1xuXG4gICAgaWYgKHBwcG9pbnRwb3MgPCBwb2ludHMubGVuZ3RoKSB7XG4gICAgICAgIHZhciBwcGVkZ2UgPSB2bGlzdC5nZXRFZGdlQnlQb2ludGVyKHBwcG9pbnQsIHBwb2ludCk7XG4gICAgICAgIGFzc2VydChwcGVkZ2UgIT09IG51bGwgJiYgcHBlZGdlLmVuZHBvaW50LmVxdWFscyhwcG9pbnQpICYmIHBwZWRnZS5lbmRwb2ludE5leHQuZXF1YWxzKHBvaW50KSxcbiAgICAgICAgICAgICdBUkdyYXBoLmRlbGV0ZVNhbWVQb2ludHNBdDogcHBlZGdlICE9PSBudWxsICYmIHBwZWRnZS5lbmRwb2ludC5lcXVhbHMocHBvaW50KSAmJiAnICtcbiAgICAgICAgICAgICdwcGVkZ2UuZW5kcG9pbnROZXh0LmVxdWFscyhwb2ludCkgRkFJTEVEJyk7XG4gICAgICAgIHBwZWRnZS5lbmRwb2ludE5leHQgPSBubnBvaW50O1xuICAgIH1cblxuICAgIGFzc2VydChubmVkZ2Uuc3RhcnRwb2ludC5lcXVhbHMobnBvaW50KSAmJiBubmVkZ2Uuc3RhcnRwb2ludFByZXYuZXF1YWxzKHBvaW50KSxcbiAgICAgICAgJ0FSR3JhcGguZGVsZXRlU2FtZVBvaW50c0F0OiBubmVkZ2Uuc3RhcnRwb2ludC5lcXVhbHMobnBvaW50KSAmJiBubmVkZ2Uuc3RhcnRwb2ludFByZXYuZXF1YWxzKHBvaW50KScgK1xuICAgICAgICAnIEZBSUxFRCcpO1xuICAgIG5uZWRnZS5zZXRTdGFydFBvaW50KHBwb2ludCk7XG4gICAgbm5lZGdlLnN0YXJ0cG9pbnRQcmV2ID0gcHBwb2ludDtcblxuICAgIGlmIChubm5wb2ludHBvcyA8IHBvaW50cy5sZW5ndGgpIHtcbiAgICAgICAgdmFyIG5ubmVkZ2UgPSB2bGlzdC5nZXRFZGdlQnlQb2ludGVyKG5ucG9pbnQsIChubm5wb2ludHBvcykpOyAvLyYqXG4gICAgICAgIGFzc2VydChubm5lZGdlICE9PSBudWxsICYmIG5ubmVkZ2Uuc3RhcnRwb2ludFByZXYuZXF1YWxzKG5wb2ludCkgJiYgbm5uZWRnZS5zdGFydHBvaW50LmVxdWFscyhubnBvaW50KSxcbiAgICAgICAgICAgICdBUkdyYXBoLmRlbGV0ZVNhbWVQb2ludHNBdDogbm5uZWRnZSAhPT0gbnVsbCAmJiBubm5lZGdlLnN0YXJ0cG9pbnRQcmV2LmVxdWFscyhucG9pbnQpICYmICcgK1xuICAgICAgICAgICAgJ25ubmVkZ2Uuc3RhcnRwb2ludC5lcXVhbHMobm5wb2ludCkgRkFJTEVEJyk7XG4gICAgICAgIG5ubmVkZ2Uuc3RhcnRwb2ludFByZXYgPSBwcG9pbnQ7XG4gICAgfVxuXG4gICAgaWYgKENPTlNUQU5UUy5ERUJVR19ERUVQKSB7XG4gICAgICAgIHBhdGguYXNzZXJ0VmFsaWQoKTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9zaW1wbGlmeVBhdGhzID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBtb2RpZmllZCA9IGZhbHNlLFxuICAgICAgICBwYXRoLFxuICAgICAgICBwb2ludExpc3QsXG4gICAgICAgIHBvaW50cG9zO1xuXG4gICAgZm9yICh2YXIgaSA9IHRoaXMucGF0aHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHBhdGggPSB0aGlzLnBhdGhzW2ldO1xuXG4gICAgICAgIGlmIChwYXRoLmlzQXV0b1JvdXRlZCgpKSB7XG4gICAgICAgICAgICBwb2ludExpc3QgPSBwYXRoLmdldFBvaW50TGlzdCgpO1xuICAgICAgICAgICAgcG9pbnRwb3MgPSAwO1xuXG4gICAgICAgICAgICBtb2RpZmllZCA9IHRoaXMuX2ZpeFNob3J0UGF0aHMocGF0aCkgfHwgbW9kaWZpZWQ7XG5cbiAgICAgICAgICAgIHdoaWxlIChwb2ludHBvcyA8IHBvaW50TGlzdC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fY2FuZGVsZXRlVHdvRWRnZXNBdChwYXRoLCBwb2ludExpc3QsIHBvaW50cG9zKSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9kZWxldGVUd29FZGdlc0F0KHBhdGgsIHBvaW50TGlzdCwgcG9pbnRwb3MpO1xuICAgICAgICAgICAgICAgICAgICBtb2RpZmllZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBwb2ludHBvcysrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG1vZGlmaWVkO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fY2VudGVyU3RhaXJzSW5QYXRoUG9pbnRzID0gZnVuY3Rpb24gKHBhdGgsIGhpbnRzdGFydGRpciwgaGludGVuZGRpcikge1xuICAgIGFzc2VydChwYXRoICE9PSBudWxsLCAnQVJHcmFwaC5jZW50ZXJTdGFpcnNJblBhdGhQb2ludHM6IHBhdGggIT09IG51bGwgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KCFwYXRoLmlzQ29ubmVjdGVkKCksICdBUkdyYXBoLmNlbnRlclN0YWlyc0luUGF0aFBvaW50czogIXBhdGguaXNDb25uZWN0ZWQoKSBGQUlMRUQnKTtcblxuICAgIHZhciBwb2ludExpc3QgPSBwYXRoLmdldFBvaW50TGlzdCgpO1xuICAgIGFzc2VydChwb2ludExpc3QubGVuZ3RoID49IDIsICdBUkdyYXBoLmNlbnRlclN0YWlyc0luUGF0aFBvaW50czogcG9pbnRMaXN0Lmxlbmd0aCA+PSAyIEZBSUxFRCcpO1xuXG4gICAgaWYgKENPTlNUQU5UUy5ERUJVRykge1xuICAgICAgICBwYXRoLmFzc2VydFZhbGlkUG9pbnRzKCk7XG4gICAgfVxuXG4gICAgdmFyIHAxLFxuICAgICAgICBwMixcbiAgICAgICAgcDMsXG4gICAgICAgIHA0LFxuXG4gICAgICAgIHAxcCA9IHBvaW50TGlzdC5sZW5ndGgsXG4gICAgICAgIHAycCA9IHBvaW50TGlzdC5sZW5ndGgsXG4gICAgICAgIHAzcCA9IHBvaW50TGlzdC5sZW5ndGgsXG4gICAgICAgIHA0cCA9IHBvaW50TGlzdC5sZW5ndGgsXG5cbiAgICAgICAgZDEyID0gQ09OU1RBTlRTLkRpck5vbmUsXG4gICAgICAgIGQyMyA9IENPTlNUQU5UUy5EaXJOb25lLFxuICAgICAgICBkMzQgPSBDT05TVEFOVFMuRGlyTm9uZSxcblxuICAgICAgICBvdXRPZkJveFN0YXJ0UG9pbnQgPSBwYXRoLmdldE91dE9mQm94U3RhcnRQb2ludChoaW50c3RhcnRkaXIpLFxuICAgICAgICBvdXRPZkJveEVuZFBvaW50ID0gcGF0aC5nZXRPdXRPZkJveEVuZFBvaW50KGhpbnRlbmRkaXIpLFxuXG4gICAgICAgIHBvcyA9IDA7XG4gICAgYXNzZXJ0KHBvcyA8IHBvaW50TGlzdC5sZW5ndGgsICdBUkdyYXBoLmNlbnRlclN0YWlyc0luUGF0aFBvaW50cyBwb3MgPCBwb2ludExpc3QubGVuZ3RoIEZBSUxFRCcpO1xuXG4gICAgcDFwID0gcG9zO1xuICAgIHAxID0gKHBvaW50TGlzdFtwb3MrK10pO1xuXG4gICAgdmFyIG5wMixcbiAgICAgICAgbnAzLFxuICAgICAgICBoLFxuICAgICAgICBwNHgsXG4gICAgICAgIHAzeCxcbiAgICAgICAgcDF4LFxuICAgICAgICB0bXAsXG4gICAgICAgIHQsXG4gICAgICAgIG07XG5cblxuICAgIHdoaWxlIChwb3MgPCBwb2ludExpc3QubGVuZ3RoKSB7XG4gICAgICAgIHA0cCA9IHAzcDtcbiAgICAgICAgcDNwID0gcDJwO1xuICAgICAgICBwMnAgPSBwMXA7XG4gICAgICAgIHAxcCA9IHBvcztcblxuICAgICAgICBwNCA9IHAzO1xuICAgICAgICBwMyA9IHAyO1xuICAgICAgICBwMiA9IHAxO1xuICAgICAgICBwMSA9IChwb2ludExpc3RbcG9zKytdKTtcblxuICAgICAgICBkMzQgPSBkMjM7XG4gICAgICAgIGQyMyA9IGQxMjtcblxuICAgICAgICBpZiAocDJwIDwgcG9pbnRMaXN0Lmxlbmd0aCkge1xuICAgICAgICAgICAgZDEyID0gVXRpbHMuZ2V0RGlyKHAyLm1pbnVzKHAxKSk7XG4gICAgICAgICAgICBpZiAoQ09OU1RBTlRTLkRFQlVHKSB7XG4gICAgICAgICAgICAgICAgYXNzZXJ0KFV0aWxzLmlzUmlnaHRBbmdsZShkMTIpLCAnQVJHcmFwaC5jZW50ZXJTdGFpcnNJblBhdGhQb2ludHM6ICcgK1xuICAgICAgICAgICAgICAgICdVdGlscy5pc1JpZ2h0QW5nbGUgKGQxMikgRkFJTEVEJyk7XG4gICAgICAgICAgICAgICAgaWYgKHAzcCAhPT0gcG9pbnRMaXN0LmVuZCgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGFzc2VydChVdGlscy5hcmVJblJpZ2h0QW5nbGUoZDEyLCBkMjMpLCAnQVJHcmFwaC5jZW50ZXJTdGFpcnNJblBhdGhQb2ludHM6ICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXRpbHMuYXJlSW5SaWdodEFuZ2xlIChkMTIsIGQyMykgRkFJTEVEJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHA0cCA8IHBvaW50TGlzdC5sZW5ndGggJiYgZDEyID09PSBkMzQpIHtcbiAgICAgICAgICAgIGFzc2VydChwMXAgPCBwb2ludExpc3QubGVuZ3RoICYmIHAycCA8IHBvaW50TGlzdC5sZW5ndGggJiYgcDNwIDwgcG9pbnRMaXN0Lmxlbmd0aCAmJlxuICAgICAgICAgICAgcDRwIDwgcG9pbnRMaXN0Lmxlbmd0aCwgJ0FSR3JhcGguY2VudGVyU3RhaXJzSW5QYXRoUG9pbnRzOiBwMXAgPCBwb2ludExpc3QubGVuZ3RoICYmICcgK1xuICAgICAgICAgICAgJ3AycCA8IHBvaW50TGlzdC5sZW5ndGggJiYgcDNwIDwgcG9pbnRMaXN0Lmxlbmd0aCAmJiBwNHAgPCBwb2ludExpc3QubGVuZ3RoIEZBSUxFRCcpO1xuXG4gICAgICAgICAgICBucDIgPSBuZXcgQXJQb2ludChwMik7XG4gICAgICAgICAgICBucDMgPSBuZXcgQXJQb2ludChwMyk7XG4gICAgICAgICAgICBoID0gVXRpbHMuaXNIb3Jpem9udGFsKGQxMik7XG5cbiAgICAgICAgICAgIHA0eCA9IFV0aWxzLmdldFBvaW50Q29vcmQocDQsIGgpO1xuICAgICAgICAgICAgcDN4ID0gVXRpbHMuZ2V0UG9pbnRDb29yZChwMywgaCk7XG4gICAgICAgICAgICBwMXggPSBVdGlscy5nZXRQb2ludENvb3JkKHAxLCBoKTtcblxuICAgICAgICAgICAgLy8gcDF4IHdpbGwgcmVwcmVzZW50IHRoZSBsYXJnZXIgeCB2YWx1ZSBpbiB0aGlzICdzdGVwJyBzaXR1YXRpb25cbiAgICAgICAgICAgIGlmIChwMXggPCBwNHgpIHtcbiAgICAgICAgICAgICAgICB0ID0gcDF4O1xuICAgICAgICAgICAgICAgIHAxeCA9IHA0eDtcbiAgICAgICAgICAgICAgICBwNHggPSB0O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAocDR4IDwgcDN4ICYmIHAzeCA8IHAxeCkge1xuICAgICAgICAgICAgICAgIG0gPSBNYXRoLnJvdW5kKChwNHggKyBwMXgpIC8gMik7XG4gICAgICAgICAgICAgICAgaWYgKGgpIHtcbiAgICAgICAgICAgICAgICAgICAgbnAyLnggPSBtO1xuICAgICAgICAgICAgICAgICAgICBucDMueCA9IG07XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbnAyLnkgPSBtO1xuICAgICAgICAgICAgICAgICAgICBucDMueSA9IG07XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdG1wID0gdGhpcy5fZ2V0TGltaXRzT2ZFZGdlKG5wMiwgbnAzLCBwNHgsIHAxeCk7XG4gICAgICAgICAgICAgICAgcDR4ID0gdG1wLm1pbjtcbiAgICAgICAgICAgICAgICBwMXggPSB0bXAubWF4O1xuXG4gICAgICAgICAgICAgICAgbSA9IE1hdGgucm91bmQoKHA0eCArIHAxeCkgLyAyKTtcblxuICAgICAgICAgICAgICAgIGlmIChoKSB7XG4gICAgICAgICAgICAgICAgICAgIG5wMi54ID0gbTtcbiAgICAgICAgICAgICAgICAgICAgbnAzLnggPSBtO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG5wMi55ID0gbTtcbiAgICAgICAgICAgICAgICAgICAgbnAzLnkgPSBtO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICghdGhpcy5faXNMaW5lQ2xpcEJveGVzKG5wMiwgbnAzKSAmJiAhdGhpcy5faXNMaW5lQ2xpcEJveGVzKHAxcCA9PT0gcG9pbnRMaXN0Lmxlbmd0aCA/XG4gICAgICAgICAgICAgICAgICAgICAgICBvdXRPZkJveEVuZFBvaW50IDogcDEsIG5wMikgJiYgIXRoaXMuX2lzTGluZUNsaXBCb3hlcyhwNHAgPT09IDAgP1xuICAgICAgICAgICAgICAgICAgICAgICAgb3V0T2ZCb3hTdGFydFBvaW50IDogcDQsIG5wMykpIHtcbiAgICAgICAgICAgICAgICAgICAgcDIgPSBucDI7XG4gICAgICAgICAgICAgICAgICAgIHAzID0gbnAzO1xuICAgICAgICAgICAgICAgICAgICBwb2ludExpc3Quc3BsaWNlKHAycCwgMSwgcDIpO1xuICAgICAgICAgICAgICAgICAgICBwb2ludExpc3Quc3BsaWNlKHAzcCwgMSwgcDMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChDT05TVEFOVFMuREVCVUcpIHtcbiAgICAgICAgcGF0aC5hc3NlcnRWYWxpZFBvaW50cygpO1xuICAgIH1cbn07XG5cbi8qKlxuICogTWFrZSBzdXJlIGlmIGEgc3RyYWlnaHQgbGluZSBpcyBwb3NzaWJsZSwgY3JlYXRlIGEgc3RyYWlnaHQgbGluZSBmb3JcbiAqIHRoZSBwYXRoLlxuICpcbiAqIEBwYXJhbSB7QXV0b1JvdXRlclBhdGh9IHBhdGhcbiAqL1xuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fZml4U2hvcnRQYXRocyA9IGZ1bmN0aW9uIChwYXRoKSB7XG5cbiAgICB2YXIgbW9kaWZpZWQgPSBmYWxzZSxcbiAgICAgICAgc3RhcnRwb3J0ID0gcGF0aC5nZXRTdGFydFBvcnQoKSxcbiAgICAgICAgZW5kcG9ydCA9IHBhdGguZ2V0RW5kUG9ydCgpLFxuICAgICAgICBsZW4gPSBwYXRoLmdldFBvaW50TGlzdCgpLmxlbmd0aDtcblxuICAgIGlmIChsZW4gPT09IDQpIHtcbiAgICAgICAgdmFyIHBvaW50cyA9IHBhdGguZ2V0UG9pbnRMaXN0KCksXG4gICAgICAgICAgICBzdGFydHBvaW50ID0gcG9pbnRzWzBdLFxuICAgICAgICAgICAgZW5kcG9pbnQgPSBwb2ludHNbbGVuIC0gMV0sXG4gICAgICAgICAgICBzdGFydERpciA9IHN0YXJ0cG9ydC5wb3J0T25XaGljaEVkZ2Uoc3RhcnRwb2ludCksXG4gICAgICAgICAgICBlbmREaXIgPSBlbmRwb3J0LnBvcnRPbldoaWNoRWRnZShlbmRwb2ludCksXG4gICAgICAgICAgICB0c3RTdGFydCxcbiAgICAgICAgICAgIHRzdEVuZDtcblxuICAgICAgICBpZiAoc3RhcnREaXIgPT09IFV0aWxzLnJldmVyc2VEaXIoZW5kRGlyKSkge1xuICAgICAgICAgICAgdmFyIGlzSG9yaXpvbnRhbCA9IFV0aWxzLmlzSG9yaXpvbnRhbChzdGFydERpciksXG4gICAgICAgICAgICAgICAgbmV3U3RhcnQgPSBuZXcgQXJQb2ludChzdGFydHBvaW50KSxcbiAgICAgICAgICAgICAgICBuZXdFbmQgPSBuZXcgQXJQb2ludChlbmRwb2ludCksXG4gICAgICAgICAgICAgICAgc3RhcnRSZWN0ID0gc3RhcnRwb3J0LnJlY3QsXG4gICAgICAgICAgICAgICAgZW5kUmVjdCA9IGVuZHBvcnQucmVjdCxcbiAgICAgICAgICAgICAgICBtaW5PdmVybGFwLFxuICAgICAgICAgICAgICAgIG1heE92ZXJsYXA7XG5cbiAgICAgICAgICAgIGlmIChpc0hvcml6b250YWwpIHtcbiAgICAgICAgICAgICAgICBtaW5PdmVybGFwID0gTWF0aC5taW4oc3RhcnRSZWN0LmZsb29yLCBlbmRSZWN0LmZsb29yKTtcbiAgICAgICAgICAgICAgICBtYXhPdmVybGFwID0gTWF0aC5tYXgoc3RhcnRSZWN0LmNlaWwsIGVuZFJlY3QuY2VpbCk7XG5cbiAgICAgICAgICAgICAgICB2YXIgbmV3WSA9IChtaW5PdmVybGFwICsgbWF4T3ZlcmxhcCkgLyAyO1xuICAgICAgICAgICAgICAgIG5ld1N0YXJ0LnkgPSBuZXdZO1xuICAgICAgICAgICAgICAgIG5ld0VuZC55ID0gbmV3WTtcblxuICAgICAgICAgICAgICAgIHRzdFN0YXJ0ID0gbmV3IEFyUG9pbnQoVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQoc3RhcnRwb3J0Lm93bmVyLnJlY3QsIHN0YXJ0RGlyKSwgbmV3U3RhcnQueSk7XG4gICAgICAgICAgICAgICAgdHN0RW5kID0gbmV3IEFyUG9pbnQoVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQoZW5kcG9ydC5vd25lci5yZWN0LCBlbmREaXIpLCBuZXdFbmQueSk7XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbWluT3ZlcmxhcCA9IE1hdGgubWluKHN0YXJ0UmVjdC5yaWdodCwgZW5kUmVjdC5yaWdodCk7XG4gICAgICAgICAgICAgICAgbWF4T3ZlcmxhcCA9IE1hdGgubWF4KHN0YXJ0UmVjdC5sZWZ0LCBlbmRSZWN0LmxlZnQpO1xuXG4gICAgICAgICAgICAgICAgdmFyIG5ld1ggPSAobWluT3ZlcmxhcCArIG1heE92ZXJsYXApIC8gMjtcbiAgICAgICAgICAgICAgICBuZXdTdGFydC54ID0gbmV3WDtcbiAgICAgICAgICAgICAgICBuZXdFbmQueCA9IG5ld1g7XG5cbiAgICAgICAgICAgICAgICB0c3RTdGFydCA9IG5ldyBBclBvaW50KG5ld1N0YXJ0LngsIFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKHN0YXJ0cG9ydC5vd25lci5yZWN0LCBzdGFydERpcikpO1xuICAgICAgICAgICAgICAgIHRzdEVuZCA9IG5ldyBBclBvaW50KG5ld0VuZC54LCBVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChlbmRwb3J0Lm93bmVyLnJlY3QsIGVuZERpcikpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgdmFsaWRQb2ludExvY2F0aW9uID0gc3RhcnRSZWN0LnB0SW5SZWN0KG5ld1N0YXJ0KSAmJiAhc3RhcnRSZWN0Lm9uQ29ybmVyKG5ld1N0YXJ0KSAmJlxuICAgICAgICAgICAgICAgIGVuZFJlY3QucHRJblJlY3QobmV3RW5kKSAmJiAhZW5kUmVjdC5vbkNvcm5lcihuZXdFbmQpO1xuXG4gICAgICAgICAgICBpZiAodmFsaWRQb2ludExvY2F0aW9uICYmICF0aGlzLl9pc0xpbmVDbGlwQm94ZXModHN0U3RhcnQsIHRzdEVuZCkpIHtcbiAgICAgICAgICAgICAgICB2YXIgaGxpc3QgPSB0aGlzLl9nZXRFZGdlTGlzdChpc0hvcml6b250YWwpLFxuICAgICAgICAgICAgICAgICAgICB2bGlzdCA9IHRoaXMuX2dldEVkZ2VMaXN0KCFpc0hvcml6b250YWwpLFxuICAgICAgICAgICAgICAgICAgICBlZGdlID0gaGxpc3QuZ2V0RWRnZUJ5UG9pbnRlcihzdGFydHBvaW50KSxcbiAgICAgICAgICAgICAgICAgICAgZWRnZTIgPSB2bGlzdC5nZXRFZGdlQnlQb2ludGVyKHBvaW50c1sxXSksXG4gICAgICAgICAgICAgICAgICAgIGVkZ2UzID0gaGxpc3QuZ2V0RWRnZUJ5UG9pbnRlcihwb2ludHNbMl0pO1xuXG4gICAgICAgICAgICAgICAgdmxpc3QucmVtb3ZlKGVkZ2UyKTtcbiAgICAgICAgICAgICAgICBobGlzdC5yZW1vdmUoZWRnZTMpO1xuICAgICAgICAgICAgICAgIGhsaXN0LnJlbW92ZShlZGdlKTtcblxuICAgICAgICAgICAgICAgIC8vIFRoZSB2YWx1ZXMgb2Ygc3RhcnRwb2ludCBpcyBjaGFuZ2VkIGJ1dCB3ZSBkb24ndCBjaGFuZ2UgdGhlIHN0YXJ0cG9pbnQgb2YgdGhlIGVkZ2VcbiAgICAgICAgICAgICAgICBzdGFydHBvaW50LmFzc2lnbihuZXdTdGFydCk7XG4gICAgICAgICAgICAgICAgLy8gdG8gbWFpbnRhaW4gdGhlIHJlZmVyZW5jZSB0aGF0IHRoZSBwb3J0IGhhcyB0byB0aGUgc3RhcnRwb2ludFxuICAgICAgICAgICAgICAgIGVuZHBvaW50LmFzc2lnbihuZXdFbmQpO1xuICAgICAgICAgICAgICAgIGVkZ2Uuc2V0RW5kUG9pbnQoZW5kcG9pbnQpO1xuXG4gICAgICAgICAgICAgICAgZWRnZS5zdGFydHBvaW50UHJldiA9IG51bGw7XG4gICAgICAgICAgICAgICAgZWRnZS5lbmRwb2ludE5leHQgPSBudWxsO1xuXG4gICAgICAgICAgICAgICAgZWRnZS5wb3NpdGlvblkgPSBVdGlscy5nZXRQb2ludENvb3JkKG5ld1N0YXJ0LCBVdGlscy5uZXh0Q2xvY2t3aXNlRGlyKHN0YXJ0RGlyKSk7XG4gICAgICAgICAgICAgICAgaGxpc3QuaW5zZXJ0KGVkZ2UpO1xuXG4gICAgICAgICAgICAgICAgcG9pbnRzLnNwbGljZSgxLCAyKTtcbiAgICAgICAgICAgICAgICBtb2RpZmllZCA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbW9kaWZpZWQ7XG59O1xuXG4vKipcbiAqIFJlbW92ZSB1bm5lY2Vzc2FyeSBjdXJ2ZXMgaW5zZXJ0ZWQgaW50byB0aGUgcGF0aCBmcm9tIHRoZVxuICogdHJhY2luZyB0aGUgZWRnZXMgb2Ygb3ZlcmxhcHBpbmcgYm94ZXMuIChodWcgY2hpbGRyZW4pXG4gKlxuICogQHBhcmFtIHtBdXRvUm91dGVyUGF0aH0gcGF0aFxuICovXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9zaW1wbGlmeVBhdGhDdXJ2ZXMgPSBmdW5jdGlvbiAocGF0aCkge1xuICAgIC8vIEluY2lkZW50bHksIHRoaXMgd2lsbCBhbHNvIGNvbnRhaW4gdGhlIGZ1bmN0aW9uYWxpdHkgb2Ygc2ltcGxpZnlUcml2aWFsbHlcbiAgICB2YXIgcG9pbnRMaXN0ID0gcGF0aC5nZXRQb2ludExpc3QoKSxcbiAgICAgICAgcDEsXG4gICAgICAgIHAyLFxuICAgICAgICBpID0gMCxcbiAgICAgICAgajtcblxuICAgIC8vIEkgd2lsbCBiZSB0YWtpbmcgdGhlIGZpcnN0IHBvaW50IGFuZCBjaGVja2luZyB0byBzZWUgaWYgaXQgY2FuIGNyZWF0ZSBhIHN0cmFpZ2h0IGxpbmVcbiAgICAvLyB0aGF0IGRvZXMgbm90IFV0aWxzLmludGVyc2VjdCAgYW55IG90aGVyIGJveGVzIG9uIHRoZSBncmFwaCBmcm9tIHRoZSB0ZXN0IHBvaW50IHRvIHRoZSBvdGhlciBwb2ludC5cbiAgICAvLyBUaGUgJ290aGVyIHBvaW50JyB3aWxsIGJlIHRoZSBlbmQgb2YgdGhlIHBhdGggaXRlcmF0aW5nIGJhY2sgdGlsIHRoZSB0d28gcG9pbnRzIGJlZm9yZSB0aGUgXG4gICAgLy8gY3VycmVudC5cbiAgICB3aGlsZSAoaSA8IHBvaW50TGlzdC5sZW5ndGggLSAzKSB7XG4gICAgICAgIHAxID0gcG9pbnRMaXN0W2ldO1xuICAgICAgICBqID0gcG9pbnRMaXN0Lmxlbmd0aDtcblxuICAgICAgICB3aGlsZSAoai0tID4gMCkge1xuICAgICAgICAgICAgcDIgPSBwb2ludExpc3Rbal07XG4gICAgICAgICAgICBpZiAoVXRpbHMuaXNSaWdodEFuZ2xlKFV0aWxzLmdldERpcihwMS5taW51cyhwMikpKSAmJiAhdGhpcy5faXNMaW5lQ2xpcEJveGVzKHAxLCBwMikgfHxcbiAgICAgICAgICAgICAgICBwMS5lcXVhbHMocDIpKSB7XG4gICAgICAgICAgICAgICAgcG9pbnRMaXN0LnNwbGljZShpICsgMSwgaiAtIGkgLSAxKTsgLy8gUmVtb3ZlIGFsbCBwb2ludHMgYmV0d2VlbiBpLCBqXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgKytpO1xuICAgIH1cbn07XG5cbi8qIFRoZSBmb2xsb3dpbmcgc2hhcGUgaW4gYSBwYXRoXG4gKiBfX19fX19fXG4gKiAgICAgICB8ICAgICAgIF9fX1xuICogICAgICAgfCAgICAgIHxcbiAqICAgICAgIHxfX19fX198XG4gKlxuICogd2lsbCBiZSByZXBsYWNlZCB3aXRoIFxuICogX19fX19fX1xuICogICAgICAgfF9fX19fX1xuICpcbiAqIGlmIHBvc3NpYmxlLlxuICovXG4vKipcbiAqIFJlcGxhY2UgNSBwb2ludHMgZm9yIDMgd2hlcmUgcG9zc2libGUuIFRoaXMgd2lsbCByZXBsYWNlICd1Jy1saWtlIHNoYXBlc1xuICogd2l0aCAneicgbGlrZSBzaGFwZXMuXG4gKlxuICogQHBhcmFtIHBhdGhcbiAqIEByZXR1cm4ge3VuZGVmaW5lZH1cbiAqL1xuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fc2ltcGxpZnlQYXRoUG9pbnRzID0gZnVuY3Rpb24gKHBhdGgpIHtcbiAgICBhc3NlcnQocGF0aCAhPT0gbnVsbCwgJ0FSR3JhcGguc2ltcGxpZnlQYXRoUG9pbnRzOiBwYXRoICE9PSBudWxsIEZBSUxFRCcpO1xuICAgIGFzc2VydCghcGF0aC5pc0Nvbm5lY3RlZCgpLCAnQVJHcmFwaC5zaW1wbGlmeVBhdGhQb2ludHM6ICFwYXRoLmlzQ29ubmVjdGVkKCkgRkFJTEVEJyk7XG5cbiAgICB2YXIgcG9pbnRMaXN0ID0gcGF0aC5nZXRQb2ludExpc3QoKTtcbiAgICBhc3NlcnQocG9pbnRMaXN0Lmxlbmd0aCA+PSAyLCAnQVJHcmFwaC5zaW1wbGlmeVBhdGhQb2ludHM6IHBvaW50TGlzdC5sZW5ndGggPj0gMiBGQUlMRUQnKTtcblxuICAgIGlmIChDT05TVEFOVFMuREVCVUcpIHtcbiAgICAgICAgcGF0aC5hc3NlcnRWYWxpZFBvaW50cygpO1xuICAgIH1cblxuICAgIHZhciBwMSxcbiAgICAgICAgcDIsXG4gICAgICAgIHAzLFxuICAgICAgICBwNCxcbiAgICAgICAgcDUsXG5cbiAgICAgICAgcDFwID0gcG9pbnRMaXN0Lmxlbmd0aCxcbiAgICAgICAgcDJwID0gcG9pbnRMaXN0Lmxlbmd0aCxcbiAgICAgICAgcDNwID0gcG9pbnRMaXN0Lmxlbmd0aCxcbiAgICAgICAgcDRwID0gcG9pbnRMaXN0Lmxlbmd0aCxcbiAgICAgICAgcDVwID0gcG9pbnRMaXN0Lmxlbmd0aCxcblxuICAgICAgICBwb3MgPSAwLFxuXG4gICAgICAgIG5wMyxcbiAgICAgICAgZCxcbiAgICAgICAgaDtcblxuICAgIGFzc2VydChwb3MgPCBwb2ludExpc3QubGVuZ3RoLCAnQVJHcmFwaC5zaW1wbGlmeVBhdGhQb2ludHM6IHBvcyA8IHBvaW50TGlzdC5sZW5ndGggRkFJTEVEJyk7XG5cbiAgICBwMXAgPSBwb3M7XG4gICAgcDEgPSBwb2ludExpc3RbcG9zKytdO1xuXG4gICAgd2hpbGUgKHBvcyA8IHBvaW50TGlzdC5sZW5ndGgpIHtcbiAgICAgICAgcDVwID0gcDRwO1xuICAgICAgICBwNHAgPSBwM3A7XG4gICAgICAgIHAzcCA9IHAycDtcbiAgICAgICAgcDJwID0gcDFwO1xuICAgICAgICBwMXAgPSBwb3M7XG5cbiAgICAgICAgcDUgPSBwNDtcbiAgICAgICAgcDQgPSBwMztcbiAgICAgICAgcDMgPSBwMjtcbiAgICAgICAgcDIgPSBwMTtcbiAgICAgICAgcDEgPSBwb2ludExpc3RbcG9zKytdO1xuXG4gICAgICAgIGlmIChwNXAgPCBwb2ludExpc3QubGVuZ3RoKSB7XG4gICAgICAgICAgICBhc3NlcnQocDFwIDwgcG9pbnRMaXN0Lmxlbmd0aCAmJiBwMnAgPCBwb2ludExpc3QubGVuZ3RoICYmIHAzcCA8IHBvaW50TGlzdC5sZW5ndGggJiZcbiAgICAgICAgICAgICAgICBwNHAgPCBwb2ludExpc3QubGVuZ3RoICYmIHA1cCA8IHBvaW50TGlzdC5sZW5ndGgsXG4gICAgICAgICAgICAgICAgJ0FSR3JhcGguc2ltcGxpZnlQYXRoUG9pbnRzOiBwMXAgPCBwb2ludExpc3QubGVuZ3RoICYmIHAycCA8IHBvaW50TGlzdC5sZW5ndGggJiYgJyArXG4gICAgICAgICAgICAgICAgJ3AzcCA8IHBvaW50TGlzdC5sZW5ndGggJiYgcDRwIDwgcG9pbnRMaXN0Lmxlbmd0aCAmJiBwNXAgPCBwb2ludExpc3QubGVuZ3RoIEZBSUxFRCcpO1xuXG4gICAgICAgICAgICBhc3NlcnQoIXAxLmVxdWFscyhwMikgJiYgIXAyLmVxdWFscyhwMykgJiYgIXAzLmVxdWFscyhwNCkgJiYgIXA0LmVxdWFscyhwNSksXG4gICAgICAgICAgICAgICAgJ0FSR3JhcGguc2ltcGxpZnlQYXRoUG9pbnRzOiAhcDEuZXF1YWxzKHAyKSAmJiAhcDIuZXF1YWxzKHAzKSAmJiAhcDMuZXF1YWxzKHA0KSAmJiAnICtcbiAgICAgICAgICAgICAgICAnIXA0LmVxdWFscyhwNSkgRkFJTEVEJyk7XG5cbiAgICAgICAgICAgIGQgPSBVdGlscy5nZXREaXIocDIubWludXMocDEpKTtcbiAgICAgICAgICAgIGFzc2VydChVdGlscy5pc1JpZ2h0QW5nbGUoZCksICdBUkdyYXBoLnNpbXBsaWZ5UGF0aFBvaW50czogVXRpbHMuaXNSaWdodEFuZ2xlIChkKSBGQUlMRUQnKTtcbiAgICAgICAgICAgIGggPSBVdGlscy5pc0hvcml6b250YWwoZCk7XG5cbiAgICAgICAgICAgIG5wMyA9IG5ldyBBclBvaW50KCk7XG4gICAgICAgICAgICBpZiAoaCkge1xuICAgICAgICAgICAgICAgIG5wMy54ID0gVXRpbHMuZ2V0UG9pbnRDb29yZChwNSwgaCk7XG4gICAgICAgICAgICAgICAgbnAzLnkgPSBVdGlscy5nZXRQb2ludENvb3JkKHAxLCAhaCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG5wMy54ID0gVXRpbHMuZ2V0UG9pbnRDb29yZChwMSwgIWgpO1xuICAgICAgICAgICAgICAgIG5wMy55ID0gVXRpbHMuZ2V0UG9pbnRDb29yZChwNSwgaCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5faXNMaW5lQ2xpcEJveGVzKHAyLCBucDMpICYmICF0aGlzLl9pc0xpbmVDbGlwQm94ZXMobnAzLCBwNCkpIHtcbiAgICAgICAgICAgICAgICBwb2ludExpc3Quc3BsaWNlKHAycCwgMSk7XG4gICAgICAgICAgICAgICAgcG9pbnRMaXN0LnNwbGljZShwM3AsIDEpO1xuICAgICAgICAgICAgICAgIHBvaW50TGlzdC5zcGxpY2UocDRwLCAxKTtcblxuICAgICAgICAgICAgICAgIGlmICghbnAzLmVxdWFscyhwMSkgJiYgIW5wMy5lcXVhbHMocDUpKSB7XG4gICAgICAgICAgICAgICAgICAgIHBvaW50TGlzdC5zcGxpY2UocDRwLCAwLCBucDMpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHAxcCA9IHBvaW50TGlzdC5sZW5ndGg7XG4gICAgICAgICAgICAgICAgcDJwID0gcG9pbnRMaXN0Lmxlbmd0aDtcbiAgICAgICAgICAgICAgICBwM3AgPSBwb2ludExpc3QubGVuZ3RoO1xuICAgICAgICAgICAgICAgIHA0cCA9IHBvaW50TGlzdC5sZW5ndGg7XG5cbiAgICAgICAgICAgICAgICBwb3MgPSAwO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKENPTlNUQU5UUy5ERUJVRykge1xuICAgICAgICBwYXRoLmFzc2VydFZhbGlkUG9pbnRzKCk7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fY29ubmVjdEFsbERpc2Nvbm5lY3RlZFBhdGhzID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBpLFxuICAgICAgICBsZW4gPSB0aGlzLnBhdGhzLmxlbmd0aCxcbiAgICAgICAgc3VjY2VzcyA9IGZhbHNlLFxuICAgICAgICBnaXZldXAgPSBmYWxzZSxcbiAgICAgICAgcGF0aDtcblxuICAgIHdoaWxlICghc3VjY2VzcyAmJiAhZ2l2ZXVwKSB7XG4gICAgICAgIHN1Y2Nlc3MgPSB0cnVlO1xuICAgICAgICBpID0gbGVuO1xuICAgICAgICB3aGlsZSAoaS0tICYmIHN1Y2Nlc3MpIHtcbiAgICAgICAgICAgIHBhdGggPSB0aGlzLnBhdGhzW2ldO1xuXG4gICAgICAgICAgICBpZiAoIXBhdGguaXNDb25uZWN0ZWQoKSkge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgPSB0aGlzLl9jb25uZWN0KHBhdGgpO1xuXG4gICAgICAgICAgICAgICAgaWYgKCFzdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFNvbWV0aGluZyBpcyBtZXNzZWQgdXAsIHByb2JhYmx5IGFuIGV4aXN0aW5nIGVkZ2UgY3VzdG9taXphdGlvbiByZXN1bHRzIGluIGEgemVybyBsZW5ndGggZWRnZVxuICAgICAgICAgICAgICAgICAgICAvLyBJbiB0aGF0IGNhc2Ugd2UgdHJ5IHRvIGRlbGV0ZSBhbnkgY3VzdG9taXphdGlvbiBmb3IgdGhpcyBwYXRoIHRvIHJlY292ZXIgZnJvbSB0aGUgcHJvYmxlbVxuICAgICAgICAgICAgICAgICAgICBpZiAocGF0aC5hcmVUaGVyZVBhdGhDdXN0b21pemF0aW9ucygpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwYXRoLnJlbW92ZVBhdGhDdXN0b21pemF0aW9ucygpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgZ2l2ZXVwID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoIXN1Y2Nlc3MgJiYgIWdpdmV1cCkge1xuICAgICAgICAgICAgdGhpcy5fZGlzY29ubmVjdEFsbCgpO1x0Ly8gVGhlcmUgd2FzIGFuIGVycm9yLCBkZWxldGUgaGFsZndheSByZXN1bHRzIHRvIGJlIGFibGUgdG8gc3RhcnQgYSBuZXcgcGFzc1xuICAgICAgICB9XG4gICAgfVxuICAgIHRoaXMuY29tcGxldGVseUNvbm5lY3RlZCA9IHRydWU7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl91cGRhdGVCb3hQb3J0QXZhaWxhYmlsaXR5ID0gZnVuY3Rpb24gKGlucHV0Qm94KSB7XG4gICAgdmFyIGJ1ZmZlcmJveCxcbiAgICAgICAgc2libGluZ3MsXG4gICAgICAgIHNraXBCb3hlcyA9IHt9LFxuICAgICAgICBib3gsXG4gICAgICAgIGlkO1xuXG4gICAgYnVmZmVyYm94ID0gdGhpcy5ib3gyYnVmZmVyQm94W2lucHV0Qm94LmlkXTtcbiAgICBhc3NlcnQoYnVmZmVyYm94LCAnQnVmZmVyYm94IG5vdCBmb3VuZCBmb3IgJyArIGlucHV0Qm94LmlkKTtcbiAgICBzaWJsaW5ncyA9IGJ1ZmZlcmJveC5jaGlsZHJlbjtcbiAgICAvLyBJZ25vcmUgb3ZlcmxhcCBmcm9tIGFuY2VzdG9yIGJveGVzIGluIHRoZSBib3ggdHJlZXNcbiAgICBib3ggPSBpbnB1dEJveDtcbiAgICBkbyB7XG4gICAgICAgIHNraXBCb3hlc1tib3guaWRdID0gdHJ1ZTtcbiAgICAgICAgYm94ID0gYm94LnBhcmVudDtcbiAgICB9IHdoaWxlIChib3gpO1xuXG4gICAgZm9yICh2YXIgaSA9IHNpYmxpbmdzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICBpZCA9IHNpYmxpbmdzW2ldLmlkO1xuICAgICAgICBpZiAoc2tpcEJveGVzW2lkXSkgeyAgLy8gU2tpcCBib3hlcyBvbiB0aGUgYm94IHRyZWVcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlucHV0Qm94LnJlY3QudG91Y2hpbmcoc2libGluZ3NbaV0pKSB7XG4gICAgICAgICAgICBpbnB1dEJveC5hZGp1c3RQb3J0QXZhaWxhYmlsaXR5KHRoaXMuYm94ZXNbc2libGluZ3NbaV0uaWRdKTtcbiAgICAgICAgICAgIHRoaXMuYm94ZXNbc2libGluZ3NbaV0uaWRdLmFkanVzdFBvcnRBdmFpbGFiaWxpdHkoaW5wdXRCb3gpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fYWRkVG9CdWZmZXJCb3hlcyA9IGZ1bmN0aW9uIChpbnB1dEJveCkge1xuICAgIHZhciBib3ggPSB7cmVjdDogbmV3IEFyUmVjdChpbnB1dEJveC5yZWN0KSwgaWQ6IGlucHV0Qm94LmlkfSxcbiAgICAgICAgb3ZlcmxhcEJveGVzSW5kaWNlcyA9IFtdLFxuICAgICAgICBidWZmZXJCb3gsXG4gICAgICAgIGNoaWxkcmVuID0gW10sXG4gICAgICAgIHBhcmVudEJveCxcbiAgICAgICAgaWRzID0gW2lucHV0Qm94LmlkXSxcbiAgICAgICAgY2hpbGQsXG4gICAgICAgIGksXG4gICAgICAgIGo7XG5cbiAgICBib3gucmVjdC5pbmZsYXRlUmVjdChDT05TVEFOVFMuQlVGRkVSKTtcbiAgICBhc3NlcnQoIXRoaXMuYm94MmJ1ZmZlckJveFtpbnB1dEJveC5pZF0sXG4gICAgICAgICdDYW5cXCd0IGFkZCBib3ggdG8gMiBidWZmZXJib3hlcycpO1xuXG4gICAgLy8gRm9yIGV2ZXJ5IGJ1ZmZlciBib3ggdG91Y2hpbmcgdGhlIGlucHV0IGJveFxuICAgIC8vIFJlY29yZCB0aGUgYnVmZmVyIGJveGVzIHdpdGggY2hpbGRyZW4gdG91Y2hpbmcgXG4gICAgLy8gdGhlIGlucHV0IGJveFxuICAgIGZvciAoaSA9IHRoaXMuYnVmZmVyQm94ZXMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIGlmICghYm94LnJlY3QudG91Y2hpbmcodGhpcy5idWZmZXJCb3hlc1tpXS5ib3gpKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGogPSB0aGlzLmJ1ZmZlckJveGVzW2ldLmNoaWxkcmVuLmxlbmd0aDtcbiAgICAgICAgd2hpbGUgKGotLSkge1xuICAgICAgICAgICAgY2hpbGQgPSB0aGlzLmJ1ZmZlckJveGVzW2ldLmNoaWxkcmVuW2pdO1xuICAgICAgICAgICAgaWYgKGJveC5yZWN0LnRvdWNoaW5nKGNoaWxkKSkge1xuICAgICAgICAgICAgICAgIGlucHV0Qm94LmFkanVzdFBvcnRBdmFpbGFiaWxpdHkodGhpcy5ib3hlc1tjaGlsZC5pZF0pO1xuICAgICAgICAgICAgICAgIHRoaXMuYm94ZXNbY2hpbGQuaWRdLmFkanVzdFBvcnRBdmFpbGFiaWxpdHkoaW5wdXRCb3gpO1xuXG4gICAgICAgICAgICAgICAgaWYgKG92ZXJsYXBCb3hlc0luZGljZXMuaW5kZXhPZihpKSA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgb3ZlcmxhcEJveGVzSW5kaWNlcy5wdXNoKGkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcGFyZW50Qm94ID0gbmV3IEFyUmVjdChib3gucmVjdCk7XG4gICAgLy8gSWYgb3ZlcmxhcHBlZCBvdGhlciBib3hlcywgY3JlYXRlIHRoZSBuZXcgYnVmZmVyYm94IHBhcmVudCByZWN0XG4gICAgaWYgKG92ZXJsYXBCb3hlc0luZGljZXMubGVuZ3RoICE9PSAwKSB7XG5cbiAgICAgICAgZm9yIChpID0gMDsgaSA8IG92ZXJsYXBCb3hlc0luZGljZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFzc2VydChvdmVybGFwQm94ZXNJbmRpY2VzW2ldIDwgdGhpcy5idWZmZXJCb3hlcy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgJ0FyR3JhcGguYWRkVG9CdWZmZXJCb3hlczogb3ZlcmxhcEJveGVzIGluZGV4IG91dCBvZiBib3VuZHMuICgnICtcbiAgICAgICAgICAgICAgICBvdmVybGFwQm94ZXNJbmRpY2VzW2ldICsgJyA8ICcgKyB0aGlzLmJ1ZmZlckJveGVzLmxlbmd0aCArICcpJyk7XG5cbiAgICAgICAgICAgIGJ1ZmZlckJveCA9IHRoaXMuYnVmZmVyQm94ZXMuc3BsaWNlKG92ZXJsYXBCb3hlc0luZGljZXNbaV0sIDEpWzBdO1xuXG4gICAgICAgICAgICBmb3IgKGogPSBidWZmZXJCb3guY2hpbGRyZW4ubGVuZ3RoOyBqLS07KSB7XG4gICAgICAgICAgICAgICAgY2hpbGRyZW4ucHVzaChidWZmZXJCb3guY2hpbGRyZW5bal0pO1xuICAgICAgICAgICAgICAgIGlkcy5wdXNoKGJ1ZmZlckJveC5jaGlsZHJlbltqXS5pZCk7ICAvLyBTdG9yZSB0aGUgaWRzIG9mIHRoZSBjaGlsZHJlbiB0aGF0IG5lZWQgdG8gYmUgYWRqdXN0ZWRcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcGFyZW50Qm94LnVuaW9uQXNzaWduKGJ1ZmZlckJveC5ib3gpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYm94LnJlY3QuaWQgPSBpbnB1dEJveC5pZDtcbiAgICBjaGlsZHJlbi5wdXNoKGJveC5yZWN0KTtcblxuICAgIHRoaXMuYnVmZmVyQm94ZXMucHVzaCh7Ym94OiBwYXJlbnRCb3gsIGNoaWxkcmVuOiBjaGlsZHJlbn0pO1xuXG4gICAgZm9yIChpID0gaWRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICB0aGlzLmJveDJidWZmZXJCb3hbaWRzW2ldXSA9IHRoaXMuYnVmZmVyQm94ZXNbdGhpcy5idWZmZXJCb3hlcy5sZW5ndGggLSAxXTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9yZW1vdmVGcm9tQnVmZmVyQm94ZXMgPSBmdW5jdGlvbiAoYm94KSB7XG4gICAgLy8gR2V0IHRoZSBjaGlsZHJlbiBvZiB0aGUgcGFyZW50Qm94IChub3QgaW5jbHVkaW5nIHRoZSBib3ggdG8gcmVtb3ZlKVxuICAgIC8vIENyZWF0ZSBidWZmZXJib3hlcyBmcm9tIHRoZXNlIGNoaWxkcmVuXG4gICAgdmFyIGJ1ZmZlckJveCA9IHRoaXMuYm94MmJ1ZmZlckJveFtib3guaWRdLFxuICAgICAgICBpID0gdGhpcy5idWZmZXJCb3hlcy5pbmRleE9mKGJ1ZmZlckJveCksXG4gICAgICAgIGNoaWxkcmVuID0gYnVmZmVyQm94LmNoaWxkcmVuLFxuICAgICAgICBncm91cHMgPSBbXSxcbiAgICAgICAgYWRkID0gZmFsc2UsXG4gICAgICAgIHBhcmVudEJveCxcbiAgICAgICAgY2hpbGQsXG4gICAgICAgIGdyb3VwLFxuICAgICAgICBpZHMsXG4gICAgICAgIGlkLFxuICAgICAgICBqLFxuICAgICAgICBnO1xuXG4gICAgYXNzZXJ0KGkgIT09IC0xLCAnQVJHcmFwaC5yZW1vdmVGcm9tQnVmZmVyQm94ZXM6IENhblxcJ3QgZmluZCB0aGUgY29ycmVjdCBidWZmZXJib3guJyk7XG5cbiAgICAvLyBSZW1vdmUgcmVjb3JkIG9mIHJlbW92ZWQgYm94XG4gICAgdGhpcy5idWZmZXJCb3hlcy5zcGxpY2UoaSwgMSk7XG4gICAgdGhpcy5ib3gyYnVmZmVyQm94W2JveC5pZF0gPSB1bmRlZmluZWQ7XG5cbiAgICAvL0NyZWF0ZSBncm91cHMgb2Ygb3ZlcmxhcCBmcm9tIGNoaWxkcmVuXG4gICAgaSA9IGNoaWxkcmVuLmxlbmd0aDtcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgIGcgPSBncm91cHMubGVuZ3RoO1xuICAgICAgICBjaGlsZCA9IGNoaWxkcmVuW2ldO1xuICAgICAgICBncm91cCA9IFtjaGlsZF07XG4gICAgICAgIGFkZCA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuYm94ZXNbY2hpbGQuaWRdLnJlc2V0UG9ydEF2YWlsYWJpbGl0eSgpOyAgLy8gUmVzZXQgYm94J3MgcG9ydHMgYXZhaWxhYmxlQXJlYXNcblxuICAgICAgICBpZiAoY2hpbGQuaWQgPT09IGJveC5pZCkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICB3aGlsZSAoZy0tKSB7XG4gICAgICAgICAgICBqID0gZ3JvdXBzW2ddLmxlbmd0aDtcblxuICAgICAgICAgICAgd2hpbGUgKGotLSkge1xuICAgICAgICAgICAgICAgIGlmIChncm91cHNbZ11bal0udG91Y2hpbmcoY2hpbGQpKSB7XG4gICAgICAgICAgICAgICAgICAgIGlkID0gZ3JvdXBzW2ddW2pdLmlkO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmJveGVzW2NoaWxkLmlkXS5hZGp1c3RQb3J0QXZhaWxhYmlsaXR5KHRoaXMuYm94ZXNbaWRdKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5ib3hlc1tpZF0uYWRqdXN0UG9ydEF2YWlsYWJpbGl0eSh0aGlzLmJveGVzW2NoaWxkLmlkXSk7XG4gICAgICAgICAgICAgICAgICAgIGFkZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoYWRkKSB7XG4gICAgICAgICAgICAgICAgLy8gZ3JvdXAgd2lsbCBhY2N1bXVsYXRlIGFsbCB0aGluZ3Mgb3ZlcmxhcHBpbmcgdGhlIGNoaWxkXG4gICAgICAgICAgICAgICAgZ3JvdXAgPSBncm91cC5jb25jYXQoZ3JvdXBzLnNwbGljZShnLCAxKVswXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBncm91cHMucHVzaChncm91cCk7ICAvLyBBZGQgZ3JvdXAgdG8gZ3JvdXBzXG4gICAgfVxuXG4gICAgaSA9IGdyb3Vwcy5sZW5ndGg7XG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgICBqID0gZ3JvdXBzW2ldLmxlbmd0aDtcbiAgICAgICAgcGFyZW50Qm94ID0gbmV3IEFyUmVjdChncm91cHNbaV1bMF0pO1xuICAgICAgICBpZHMgPSBbXTtcblxuICAgICAgICB3aGlsZSAoai0tKSB7XG4gICAgICAgICAgICBwYXJlbnRCb3gudW5pb25Bc3NpZ24oZ3JvdXBzW2ldW2pdKTtcbiAgICAgICAgICAgIGlkcy5wdXNoKGdyb3Vwc1tpXVtqXS5pZCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmJ1ZmZlckJveGVzLnB1c2goe2JveDogcGFyZW50Qm94LCBjaGlsZHJlbjogZ3JvdXBzW2ldfSk7XG5cbiAgICAgICAgaiA9IGlkcy5sZW5ndGg7XG4gICAgICAgIHdoaWxlIChqLS0pIHtcbiAgICAgICAgICAgIHRoaXMuYm94MmJ1ZmZlckJveFtpZHNbal1dID0gdGhpcy5idWZmZXJCb3hlc1t0aGlzLmJ1ZmZlckJveGVzLmxlbmd0aCAtIDFdO1xuICAgICAgICB9XG4gICAgfVxuXG59O1xuXG4vL1B1YmxpYyBGdW5jdGlvbnNcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5zZXRCdWZmZXIgPSBmdW5jdGlvbiAobmV3QnVmZmVyKSB7XG4gICAgQ09OU1RBTlRTLkJVRkZFUiA9IG5ld0J1ZmZlcjtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuY2FsY3VsYXRlU2VsZlBvaW50cyA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLnNlbGZQb2ludHMgPSBbXTtcbiAgICB0aGlzLnNlbGZQb2ludHMucHVzaChuZXcgQXJQb2ludChDT05TVEFOVFMuRURfTUlOQ09PUkQsIENPTlNUQU5UUy5FRF9NSU5DT09SRCkpO1xuICAgIHRoaXMuc2VsZlBvaW50cy5wdXNoKG5ldyBBclBvaW50KENPTlNUQU5UUy5FRF9NQVhDT09SRCwgQ09OU1RBTlRTLkVEX01JTkNPT1JEKSk7XG4gICAgdGhpcy5zZWxmUG9pbnRzLnB1c2gobmV3IEFyUG9pbnQoQ09OU1RBTlRTLkVEX01BWENPT1JELCBDT05TVEFOVFMuRURfTUFYQ09PUkQpKTtcbiAgICB0aGlzLnNlbGZQb2ludHMucHVzaChuZXcgQXJQb2ludChDT05TVEFOVFMuRURfTUlOQ09PUkQsIENPTlNUQU5UUy5FRF9NQVhDT09SRCkpO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5jcmVhdGVCb3ggPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGJveCA9IG5ldyBBdXRvUm91dGVyQm94KCk7XG4gICAgYXNzZXJ0KGJveCAhPT0gbnVsbCwgJ0FSR3JhcGguY3JlYXRlQm94OiBib3ggIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICByZXR1cm4gYm94O1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5hZGRCb3ggPSBmdW5jdGlvbiAoYm94KSB7XG4gICAgYXNzZXJ0KGJveCAhPT0gbnVsbCxcbiAgICAgICAgJ0FSR3JhcGguYWRkQm94OiBib3ggIT09IG51bGwgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KGJveCBpbnN0YW5jZW9mIEF1dG9Sb3V0ZXJCb3gsXG4gICAgICAgICdBUkdyYXBoLmFkZEJveDogYm94IGluc3RhbmNlb2YgQXV0b1JvdXRlckJveCBGQUlMRUQnKTtcblxuICAgIHZhciByZWN0ID0gYm94LnJlY3Q7XG5cbiAgICB0aGlzLl9kaXNjb25uZWN0UGF0aHNDbGlwcGluZyhyZWN0KTtcblxuICAgIGJveC5vd25lciA9IHRoaXM7XG4gICAgdmFyIGJveElkID0gKENPVU5URVIrKykudG9TdHJpbmcoKTtcbiAgICB3aGlsZSAoYm94SWQubGVuZ3RoIDwgNikge1xuICAgICAgICBib3hJZCA9ICcwJyArIGJveElkO1xuICAgIH1cbiAgICBib3hJZCA9ICdCT1hfJyArIGJveElkO1xuICAgIGJveC5pZCA9IGJveElkO1xuXG4gICAgdGhpcy5ib3hlc1tib3hJZF0gPSBib3g7XG5cbiAgICB0aGlzLl9hZGRCb3hBbmRQb3J0RWRnZXMoYm94KTtcblxuICAgIC8vIGFkZCBjaGlsZHJlbiBvZiB0aGUgYm94XG4gICAgdmFyIGNoaWxkcmVuID0gYm94LmNoaWxkQm94ZXMsXG4gICAgICAgIGkgPSBjaGlsZHJlbi5sZW5ndGg7XG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgICB0aGlzLmFkZEJveChjaGlsZHJlbltpXSk7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5kZWxldGVCb3ggPSBmdW5jdGlvbiAoYm94KSB7XG4gICAgYXNzZXJ0KGJveCAhPT0gbnVsbCwgJ0FSR3JhcGguZGVsZXRlQm94OiBib3ggIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICBpZiAoYm94Lmhhc093bmVyKCkpIHtcbiAgICAgICAgdmFyIHBhcmVudCA9IGJveC5wYXJlbnQsXG4gICAgICAgICAgICBjaGlsZHJlbiA9IGJveC5jaGlsZEJveGVzLFxuICAgICAgICAgICAgaSA9IGNoaWxkcmVuLmxlbmd0aDtcblxuICAgICAgICAvLyBub3RpZnkgdGhlIHBhcmVudCBvZiB0aGUgZGVsZXRpb25cbiAgICAgICAgaWYgKHBhcmVudCkge1xuICAgICAgICAgICAgcGFyZW50LnJlbW92ZUNoaWxkKGJveCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyByZW1vdmUgY2hpbGRyZW5cbiAgICAgICAgd2hpbGUgKGktLSkge1xuICAgICAgICAgICAgdGhpcy5kZWxldGVCb3goY2hpbGRyZW5baV0pO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fZGVsZXRlQm94QW5kUG9ydEVkZ2VzKGJveCk7XG4gICAgICAgIGJveC5vd25lciA9IG51bGw7XG4gICAgICAgIGFzc2VydCh0aGlzLmJveGVzW2JveC5pZF0gIT09IHVuZGVmaW5lZCwgJ0FSR3JhcGgucmVtb3ZlOiBCb3ggZG9lcyBub3QgZXhpc3QnKTtcblxuICAgICAgICBkZWxldGUgdGhpcy5ib3hlc1tib3guaWRdO1xuICAgIH1cblxuICAgIGJveC5kZXN0cm95KCk7XG4gICAgYm94ID0gbnVsbDtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuc2hpZnRCb3hCeSA9IGZ1bmN0aW9uIChib3gsIG9mZnNldCkge1xuICAgIGFzc2VydChib3ggIT09IG51bGwsICdBUkdyYXBoLnNoaWZ0Qm94Qnk6IGJveCAhPT0gbnVsbCBGQUlMRUQnKTtcbiAgICBhc3NlcnQoISF0aGlzLmJveGVzW2JveC5pZF0sICdBUkdyYXBoLnNoaWZ0Qm94Qnk6IEJveCBkb2VzIG5vdCBleGlzdCEnKTtcblxuICAgIHZhciByZWN0ID0gdGhpcy5ib3gyYnVmZmVyQm94W2JveC5pZF0uYm94LFxuICAgICAgICBjaGlsZHJlbiA9IGJveC5jaGlsZEJveGVzO1xuXG4gICAgdGhpcy5fZGlzY29ubmVjdFBhdGhzQ2xpcHBpbmcocmVjdCk7IC8vIHJlZHJhdyBhbGwgcGF0aHMgY2xpcHBpbmcgcGFyZW50IGJveC5cbiAgICB0aGlzLl9kaXNjb25uZWN0UGF0aHNGcm9tKGJveCk7XG5cbiAgICB0aGlzLl9kZWxldGVCb3hBbmRQb3J0RWRnZXMoYm94KTtcblxuICAgIGJveC5zaGlmdEJ5KG9mZnNldCk7XG4gICAgdGhpcy5fYWRkQm94QW5kUG9ydEVkZ2VzKGJveCk7XG5cbiAgICByZWN0ID0gYm94LnJlY3Q7XG4gICAgdGhpcy5fZGlzY29ubmVjdFBhdGhzQ2xpcHBpbmcocmVjdCk7XG5cbiAgICBmb3IgKHZhciBpID0gY2hpbGRyZW4ubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHRoaXMuc2hpZnRCb3hCeShjaGlsZHJlbltpXSwgb2Zmc2V0KTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLnNldEJveFJlY3QgPSBmdW5jdGlvbiAoYm94LCByZWN0KSB7XG4gICAgaWYgKGJveCA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5fZGVsZXRlQm94QW5kUG9ydEVkZ2VzKGJveCk7XG4gICAgYm94LnNldFJlY3QocmVjdCk7XG4gICAgdGhpcy5fYWRkQm94QW5kUG9ydEVkZ2VzKGJveCk7XG5cbiAgICB0aGlzLl9kaXNjb25uZWN0UGF0aHNDbGlwcGluZyhyZWN0KTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUucm91dGVTeW5jID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBzdGF0ZSA9IHtmaW5pc2hlZDogZmFsc2V9O1xuXG4gICAgdGhpcy5fY29ubmVjdEFsbERpc2Nvbm5lY3RlZFBhdGhzKCk7XG5cbiAgICB3aGlsZSAoIXN0YXRlLmZpbmlzaGVkKSB7XG4gICAgICAgIHN0YXRlID0gdGhpcy5fb3B0aW1pemUoc3RhdGUpO1xuICAgIH1cblxufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5yb3V0ZUFzeW5jID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXMsXG4gICAgICAgIHVwZGF0ZUZuID0gb3B0aW9ucy51cGRhdGUgfHwgVXRpbHMubm9wLFxuICAgICAgICBmaXJzdEZuID0gb3B0aW9ucy5maXJzdCB8fCBVdGlscy5ub3AsXG4gICAgICAgIGNhbGxiYWNrRm4gPSBvcHRpb25zLmNhbGxiYWNrIHx8IFV0aWxzLm5vcCxcbiAgICAgICAgdGltZSA9IG9wdGlvbnMudGltZSB8fCA1LFxuICAgICAgICBvcHRpbWl6ZUZuID0gZnVuY3Rpb24gKHN0YXRlKSB7XG4gICAgICAgICAgICBfbG9nZ2VyLmluZm8oJ0FzeW5jIG9wdGltaXphdGlvbiBjeWNsZSBzdGFydGVkJyk7XG5cbiAgICAgICAgICAgIC8vIElmIGEgcGF0aCBoYXMgYmVlbiBkaXNjb25uZWN0ZWQsIHN0YXJ0IHRoZSByb3V0aW5nIG92ZXJcbiAgICAgICAgICAgIGlmICghc2VsZi5jb21wbGV0ZWx5Q29ubmVjdGVkKSB7XG4gICAgICAgICAgICAgICAgX2xvZ2dlci5pbmZvKCdBc3luYyBvcHRpbWl6YXRpb24gaW50ZXJydXB0ZWQnKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gc2V0VGltZW91dChzdGFydFJvdXRpbmcsIHRpbWUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB1cGRhdGVGbihzZWxmLnBhdGhzKTtcbiAgICAgICAgICAgIGlmIChzdGF0ZS5maW5pc2hlZCkge1xuICAgICAgICAgICAgICAgIF9sb2dnZXIuaW5mbygnQXN5bmMgcm91dGluZyBmaW5pc2hlZCcpO1xuICAgICAgICAgICAgICAgIHJldHVybiBjYWxsYmFja0ZuKHNlbGYucGF0aHMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzdGF0ZSA9IHNlbGYuX29wdGltaXplKHN0YXRlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gc2V0VGltZW91dChvcHRpbWl6ZUZuLCB0aW1lLCBzdGF0ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHN0YXJ0Um91dGluZyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIF9sb2dnZXIuaW5mbygnQXN5bmMgcm91dGluZyBzdGFydGVkJyk7XG4gICAgICAgICAgICB2YXIgc3RhdGUgPSB7ZmluaXNoZWQ6IGZhbHNlfTtcbiAgICAgICAgICAgIHNlbGYuX2Nvbm5lY3RBbGxEaXNjb25uZWN0ZWRQYXRocygpO1xuXG4gICAgICAgICAgICAvLyBTdGFydCB0aGUgb3B0aW1pemF0aW9uXG4gICAgICAgICAgICBzZXRUaW1lb3V0KG9wdGltaXplRm4sIHRpbWUsIHN0YXRlKTtcbiAgICAgICAgfTtcblxuICAgIF9sb2dnZXIuaW5mbygnQXN5bmMgcm91dGluZyB0cmlnZ2VyZWQnKTtcbiAgICAvLyBDb25uZWN0IGFsbCBkaXNjb25uZWN0ZWQgcGF0aHMgd2l0aCBhIHN0cmFpZ2h0IGxpbmVcbiAgICB2YXIgZGlzY29ubmVjdGVkID0gdGhpcy5fcXVpY2tDb25uZWN0RGlzY29ubmVjdGVkUGF0aHMoKTtcbiAgICBmaXJzdEZuKGRpc2Nvbm5lY3RlZCk7XG5cbiAgICB0aGlzLl9kaXNjb25uZWN0VGVtcFBhdGhzKGRpc2Nvbm5lY3RlZCk7XG5cbiAgICBzZXRUaW1lb3V0KHN0YXJ0Um91dGluZywgdGltZSk7XG59O1xuXG4vKipcbiAqIENvbm5lY3QgYWxsIGRpc2Nvbm5lY3RlZCBwYXRocyBpbiBhIHF1aWNrIHdheSB3aGlsZSBhIGJldHRlciBsYXlvdXQgaXNcbiAqIGJlaW5nIGNhbGN1bGF0ZWQuXG4gKlxuICogQHJldHVybiB7QXJyYXk8UGF0aD59IGRpc2Nvbm5lY3RlZCBwYXRoc1xuICovXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9xdWlja0Nvbm5lY3REaXNjb25uZWN0ZWRQYXRocyA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgcGF0aCxcbiAgICAgICAgZGlzY29ubmVjdGVkID0gW107XG4gICAgZm9yICh2YXIgaSA9IHRoaXMucGF0aHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHBhdGggPSB0aGlzLnBhdGhzW2ldO1xuICAgICAgICBpZiAoIXBhdGguaXNDb25uZWN0ZWQoKSkge1xuICAgICAgICAgICAgcGF0aC5jYWxjdWxhdGVTdGFydEVuZFBvcnRzKCk7XG4gICAgICAgICAgICBwYXRoLnBvaW50cyA9IG5ldyBBclBvaW50TGlzdFBhdGgocGF0aC5zdGFydHBvaW50LCBwYXRoLmVuZHBvaW50KTtcbiAgICAgICAgICAgIGRpc2Nvbm5lY3RlZC5wdXNoKHBhdGgpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBkaXNjb25uZWN0ZWQ7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9kaXNjb25uZWN0VGVtcFBhdGhzID0gZnVuY3Rpb24gKHBhdGhzKSB7XG4gICAgZm9yICh2YXIgaSA9IHBhdGhzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICBwYXRoc1tpXS5wb2ludHMgPSBuZXcgQXJQb2ludExpc3RQYXRoKCk7XG4gICAgfVxufTtcblxuLyoqXG4gKiBQZXJmb3JtcyBvbmUgc2V0IG9mIG9wdGltaXphdGlvbnMuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IGNvdW50IFRoaXMgc3RvcmVzIHRoZSBtYXggbnVtYmVyIG9mIG9wdGltaXphdGlvbnMgYWxsb3dlZFxuICogQHBhcmFtIHtOdW1iZXJ9IGxhc3QgVGhpcyBzdG9yZXMgdGhlIGxhc3Qgb3B0aW1pemF0aW9uIHR5cGUgbWFkZVxuICpcbiAqIEByZXR1cm4ge09iamVjdH0gQ3VycmVudCBjb3VudCwgbGFzdCB2YWx1ZXNcbiAqL1xuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fb3B0aW1pemUgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgIHZhciBtYXhPcGVyYXRpb25zID0gb3B0aW9ucy5tYXhPcGVyYXRpb25zIHx8IDEwMCxcbiAgICAgICAgbGFzdCA9IG9wdGlvbnMubGFzdCB8fCAwLFxuICAgICAgICBkbSA9IG9wdGlvbnMuZG0gfHwgMTAsXHRcdC8vIG1heCAjIG9mIGRpc3RyaWJ1dGlvbiBvcFxuICAgICAgICBkID0gb3B0aW9ucy5kIHx8IDAsXG4gICAgICAgIGdldFN0YXRlID0gZnVuY3Rpb24gKGZpbmlzaGVkKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGZpbmlzaGVkOiBmaW5pc2hlZCB8fCAhbWF4T3BlcmF0aW9ucyxcbiAgICAgICAgICAgICAgICBtYXhPcGVyYXRpb25zOiBtYXhPcGVyYXRpb25zLFxuICAgICAgICAgICAgICAgIGxhc3Q6IGxhc3QsXG4gICAgICAgICAgICAgICAgZG06IGRtLFxuICAgICAgICAgICAgICAgIGQ6IGRcbiAgICAgICAgICAgIH07XG4gICAgICAgIH07XG5cbiAgICBpZiAobWF4T3BlcmF0aW9ucyA+IDApIHtcblxuICAgICAgICBpZiAobGFzdCA9PT0gMSkge1xuICAgICAgICAgICAgcmV0dXJuIGdldFN0YXRlKHRydWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgbWF4T3BlcmF0aW9ucy0tO1xuICAgICAgICBpZiAodGhpcy5fc2ltcGxpZnlQYXRocygpKSB7XG4gICAgICAgICAgICBsYXN0ID0gMTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChtYXhPcGVyYXRpb25zID4gMCkge1xuICAgICAgICBpZiAobGFzdCA9PT0gMikge1xuICAgICAgICAgICAgcmV0dXJuIGdldFN0YXRlKHRydWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgbWF4T3BlcmF0aW9ucy0tO1xuICAgICAgICBpZiAodGhpcy5ob3Jpem9udGFsLmJsb2NrU2NhbkJhY2t3YXJkKCkpIHtcblxuICAgICAgICAgICAgZG8ge1xuICAgICAgICAgICAgICAgIG1heE9wZXJhdGlvbnMtLTtcbiAgICAgICAgICAgIH0gd2hpbGUgKG1heE9wZXJhdGlvbnMgPiAwICYmIHRoaXMuaG9yaXpvbnRhbC5ibG9ja1NjYW5CYWNrd2FyZCgpKTtcblxuICAgICAgICAgICAgaWYgKGxhc3QgPCAyIHx8IGxhc3QgPiA1KSB7XG4gICAgICAgICAgICAgICAgZCA9IDA7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCsrZCA+PSBkbSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBnZXRTdGF0ZSh0cnVlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGFzdCA9IDI7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAobWF4T3BlcmF0aW9ucyA+IDApIHtcbiAgICAgICAgaWYgKGxhc3QgPT09IDMpIHtcbiAgICAgICAgICAgIHJldHVybiBnZXRTdGF0ZSh0cnVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIG1heE9wZXJhdGlvbnMtLTtcbiAgICAgICAgaWYgKHRoaXMuaG9yaXpvbnRhbC5ibG9ja1NjYW5Gb3J3YXJkKCkpIHtcblxuICAgICAgICAgICAgZG8ge1xuICAgICAgICAgICAgICAgIG1heE9wZXJhdGlvbnMtLTtcbiAgICAgICAgICAgIH0gd2hpbGUgKG1heE9wZXJhdGlvbnMgPiAwICYmIHRoaXMuaG9yaXpvbnRhbC5ibG9ja1NjYW5Gb3J3YXJkKCkpO1xuXG4gICAgICAgICAgICBpZiAobGFzdCA8IDIgfHwgbGFzdCA+IDUpIHtcbiAgICAgICAgICAgICAgICBkID0gMDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoKytkID49IGRtKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGdldFN0YXRlKHRydWUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsYXN0ID0gMztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChtYXhPcGVyYXRpb25zID4gMCkge1xuICAgICAgICBpZiAobGFzdCA9PT0gNCkge1xuICAgICAgICAgICAgcmV0dXJuIGdldFN0YXRlKHRydWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgbWF4T3BlcmF0aW9ucy0tO1xuICAgICAgICBpZiAodGhpcy52ZXJ0aWNhbC5ibG9ja1NjYW5CYWNrd2FyZCgpKSB7XG4gICAgICAgICAgICBkbyB7XG4gICAgICAgICAgICAgICAgbWF4T3BlcmF0aW9ucy0tO1xuICAgICAgICAgICAgfSB3aGlsZSAobWF4T3BlcmF0aW9ucyA+IDAgJiYgdGhpcy52ZXJ0aWNhbC5ibG9ja1NjYW5CYWNrd2FyZCgpKTtcblxuICAgICAgICAgICAgaWYgKGxhc3QgPCAyIHx8IGxhc3QgPiA1KSB7XG4gICAgICAgICAgICAgICAgZCA9IDA7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCsrZCA+PSBkbSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBnZXRTdGF0ZSh0cnVlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGFzdCA9IDQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAobWF4T3BlcmF0aW9ucyA+IDApIHtcbiAgICAgICAgaWYgKGxhc3QgPT09IDUpIHtcbiAgICAgICAgICAgIHJldHVybiBnZXRTdGF0ZSh0cnVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIG1heE9wZXJhdGlvbnMtLTtcbiAgICAgICAgaWYgKHRoaXMudmVydGljYWwuYmxvY2tTY2FuRm9yd2FyZCgpKSB7XG5cbiAgICAgICAgICAgIGRvIHtcbiAgICAgICAgICAgICAgICBtYXhPcGVyYXRpb25zLS07XG4gICAgICAgICAgICB9IHdoaWxlIChtYXhPcGVyYXRpb25zID4gMCAmJiB0aGlzLnZlcnRpY2FsLmJsb2NrU2NhbkZvcndhcmQoKSk7XG5cbiAgICAgICAgICAgIGlmIChsYXN0IDwgMiB8fCBsYXN0ID4gNSkge1xuICAgICAgICAgICAgICAgIGQgPSAwO1xuICAgICAgICAgICAgfSBlbHNlIGlmICgrK2QgPj0gZG0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZ2V0U3RhdGUodHJ1ZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxhc3QgPSA1O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKG1heE9wZXJhdGlvbnMgPiAwKSB7XG4gICAgICAgIGlmIChsYXN0ID09PSA2KSB7XG4gICAgICAgICAgICByZXR1cm4gZ2V0U3RhdGUodHJ1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICBtYXhPcGVyYXRpb25zLS07XG4gICAgICAgIGlmICh0aGlzLmhvcml6b250YWwuYmxvY2tTd2l0Y2hXcm9uZ3MoKSkge1xuICAgICAgICAgICAgbGFzdCA9IDY7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAobWF4T3BlcmF0aW9ucyA+IDApIHtcbiAgICAgICAgaWYgKGxhc3QgPT09IDcpIHtcbiAgICAgICAgICAgIHJldHVybiBnZXRTdGF0ZSh0cnVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIG1heE9wZXJhdGlvbnMtLTtcbiAgICAgICAgaWYgKHRoaXMudmVydGljYWwuYmxvY2tTd2l0Y2hXcm9uZ3MoKSkge1xuICAgICAgICAgICAgbGFzdCA9IDc7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAobGFzdCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gZ2V0U3RhdGUodHJ1ZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGdldFN0YXRlKGZhbHNlKTtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuZGVsZXRlUGF0aCA9IGZ1bmN0aW9uIChwYXRoKSB7XG4gICAgYXNzZXJ0KHBhdGggIT09IG51bGwsICdBUkdyYXBoLmRlbGV0ZVBhdGg6IHBhdGggIT09IG51bGwgRkFJTEVEJyk7XG5cbiAgICBpZiAocGF0aC5oYXNPd25lcigpKSB7XG4gICAgICAgIGFzc2VydChwYXRoLm93bmVyID09PSB0aGlzLCAnQVJHcmFwaC5kZWxldGVQYXRoOiBwYXRoLm93bmVyID09PSB0aGlzIEZBSUxFRCcpO1xuXG4gICAgICAgIHRoaXMuZGVsZXRlRWRnZXMocGF0aCk7XG4gICAgICAgIHBhdGgub3duZXIgPSBudWxsO1xuICAgICAgICB2YXIgaW5kZXggPSB0aGlzLnBhdGhzLmluZGV4T2YocGF0aCk7XG5cbiAgICAgICAgYXNzZXJ0KGluZGV4ID4gLTEsICdBUkdyYXBoLnJlbW92ZTogUGF0aCBkb2VzIG5vdCBleGlzdCcpO1xuICAgICAgICB0aGlzLnBhdGhzLnNwbGljZShpbmRleCwgMSk7XG4gICAgfVxuXG4gICAgcGF0aC5kZXN0cm95KCk7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24gKGFkZEJhY2tTZWxmRWRnZXMpIHtcbiAgICB0aGlzLl9kZWxldGVBbGxQYXRocygpO1xuICAgIHRoaXMuX2RlbGV0ZUFsbEJveGVzKCk7XG4gICAgdGhpcy5fZGVsZXRlQWxsRWRnZXMoKTtcbiAgICBpZiAoYWRkQmFja1NlbGZFZGdlcykge1xuICAgICAgICB0aGlzLl9hZGRTZWxmRWRnZXMoKTtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLmFkZFBhdGggPSBmdW5jdGlvbiAoaXNBdXRvUm91dGVkLCBzdGFydHBvcnRzLCBlbmRwb3J0cykge1xuICAgIHZhciBwYXRoID0gbmV3IEF1dG9Sb3V0ZXJQYXRoKCk7XG5cbiAgICBwYXRoLnNldEF1dG9Sb3V0aW5nKGlzQXV0b1JvdXRlZCk7XG4gICAgcGF0aC5zZXRTdGFydEVuZFBvcnRzKHN0YXJ0cG9ydHMsIGVuZHBvcnRzKTtcbiAgICB0aGlzLl9hZGQocGF0aCk7XG5cbiAgICByZXR1cm4gcGF0aDtcbn07XG5cbkF1dG9Sb3V0ZXJHcmFwaC5wcm90b3R5cGUuaXNFZGdlRml4ZWQgPSBmdW5jdGlvbiAocGF0aCwgc3RhcnRwb2ludCwgZW5kcG9pbnQpIHtcbiAgICB2YXIgZCA9IFV0aWxzLmdldERpcihlbmRwb2ludC5taW51cyhzdGFydHBvaW50KSksXG4gICAgICAgIGggPSBVdGlscy5pc0hvcml6b250YWwoZCksXG5cbiAgICAgICAgZWxpc3QgPSB0aGlzLl9nZXRFZGdlTGlzdChoKSxcblxuICAgICAgICBlZGdlID0gZWxpc3QuZ2V0RWRnZShwYXRoLCBzdGFydHBvaW50LCBlbmRwb2ludCk7XG4gICAgaWYgKGVkZ2UgIT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIGVkZ2UuZ2V0RWRnZUZpeGVkKCkgJiYgIWVkZ2UuZ2V0RWRnZUN1c3RvbUZpeGVkKCk7XG4gICAgfVxuXG4gICAgYXNzZXJ0KGZhbHNlLCAnQVJHcmFwaC5pc0VkZ2VGaXhlZDogRkFJTEVEJyk7XG4gICAgcmV0dXJuIHRydWU7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5kZWxldGVBbGwoZmFsc2UpO1xuXG4gICAgdGhpcy5ob3Jpem9udGFsLlNldE93bmVyKG51bGwpO1xuICAgIHRoaXMudmVydGljYWwuU2V0T3duZXIobnVsbCk7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLmFzc2VydFZhbGlkID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBpZHMgPSBPYmplY3Qua2V5cyh0aGlzLmJveGVzKSxcbiAgICAgICAgaTtcblxuICAgIGZvciAoaSA9IHRoaXMuYm94ZXMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHRoaXMuYXNzZXJ0VmFsaWRCb3godGhpcy5ib3hlc1tpZHNbaV1dKTtcbiAgICB9XG5cbiAgICBmb3IgKGkgPSB0aGlzLnBhdGhzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICB0aGlzLl9hc3NlcnRWYWxpZFBhdGgodGhpcy5wYXRoc1tpXSk7XG4gICAgfVxuXG4gICAgdGhpcy5ob3Jpem9udGFsLmFzc2VydFZhbGlkKCk7XG4gICAgdGhpcy52ZXJ0aWNhbC5hc3NlcnRWYWxpZCgpO1xufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5hc3NlcnRWYWxpZEJveCA9IGZ1bmN0aW9uIChib3gpIHtcbiAgICBib3guYXNzZXJ0VmFsaWQoKTtcbiAgICBhc3NlcnQoYm94Lm93bmVyID09PSB0aGlzLFxuICAgICAgICAnQVJHcmFwaC5hc3NlcnRWYWxpZEJveDogYm94Lm93bmVyID09PSB0aGlzIEZBSUxFRCcpO1xuICAgIGFzc2VydCh0aGlzLmJveGVzW2JveC5pZF0gIT09IHVuZGVmaW5lZCxcbiAgICAgICAgJ0FSR3JhcGguYXNzZXJ0VmFsaWRCb3g6IHRoaXMuYm94ZXNbYm94LmlkXSAhPT0gdW5kZWZpbmVkIEZBSUxFRCcpO1xuXG4gICAgLy8gVmVyaWZ5IHRoYXQgdGhlIGJveCAoYW5kIHBvcnQpIGVkZ2VzIGFyZSBvbiB0aGUgZ3JhcGhcbiAgICBhc3NlcnQodGhpcy5fY29udGFpbnNSZWN0RWRnZXMoYm94LnJlY3QpLFxuICAgICAgICAnR3JhcGggZG9lcyBub3QgY29udGFpbiBlZGdlcyBmb3IgYm94ICcgKyBib3guaWQpO1xuXG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLl9jb250YWluc1JlY3RFZGdlcyA9IGZ1bmN0aW9uIChyZWN0KSB7XG4gICAgdmFyIHRvcExlZnQgPSByZWN0LmdldFRvcExlZnQoKSxcbiAgICAgICAgYm90dG9tUmlnaHQgPSByZWN0LmdldEJvdHRvbVJpZ2h0KCksXG4gICAgICAgIHBvaW50cyA9IFtdLFxuICAgICAgICByZXN1bHQgPSB0cnVlLFxuICAgICAgICBsZW4sXG4gICAgICAgIHN0YXJ0LFxuICAgICAgICBlbmQ7XG5cbiAgICBwb2ludHMucHVzaCh0b3BMZWZ0KTtcbiAgICBwb2ludHMucHVzaChuZXcgQXJQb2ludChib3R0b21SaWdodC54LCB0b3BMZWZ0LnkpKTsgIC8vIHRvcCByaWdodFxuICAgIHBvaW50cy5wdXNoKGJvdHRvbVJpZ2h0KTtcbiAgICBwb2ludHMucHVzaChuZXcgQXJQb2ludCh0b3BMZWZ0LngsIGJvdHRvbVJpZ2h0LnkpKTsgIC8vIGJvdHRvbSBsZWZ0XG5cbiAgICBsZW4gPSBwb2ludHMubGVuZ3RoO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgc3RhcnQgPSBwb2ludHNbaV07XG4gICAgICAgIGVuZCA9IHBvaW50c1soaSArIDEpICUgbGVuXTtcbiAgICAgICAgcmVzdWx0ID0gcmVzdWx0ICYmIHRoaXMuX2NvbnRhaW5zRWRnZShzdGFydCwgZW5kKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxuLyoqXG4gKiBUaGlzIGNoZWNrcyBmb3IgYW4gZWRnZSB3aXRoIHRoZSBnaXZlbiBzdGFydC9lbmQgcG9pbnRzLiBUaGlzIHdpbGwgb25seVxuICogd29yayBmb3IgZml4ZWQgZWRnZXMgc3VjaCBhcyBib3hlcyBvciBwb3J0cy5cbiAqXG4gKiBAcGFyYW0gc3RhcnRcbiAqIEBwYXJhbSBlbmRcbiAqIEByZXR1cm4ge3VuZGVmaW5lZH1cbiAqL1xuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fY29udGFpbnNFZGdlID0gZnVuY3Rpb24gKHN0YXJ0LCBlbmQpIHtcbiAgICB2YXIgZGlyO1xuXG4gICAgZGlyID0gVXRpbHMuZ2V0RGlyKHN0YXJ0Lm1pbnVzKGVuZCkpO1xuICAgIGFzc2VydChVdGlscy5pc1JpZ2h0QW5nbGUoZGlyKSxcbiAgICAgICAgJ0VkZ2UgaXMgaW52YWxpZDogJyArIFV0aWxzLnN0cmluZ2lmeShzdGFydCkgKyAnIGFuZCAnICsgVXRpbHMuc3RyaW5naWZ5KGVuZCkpO1xuXG4gICAgaWYgKFV0aWxzLmlzSG9yaXpvbnRhbChkaXIpKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmhvcml6b250YWwuY29udGFpbnMoc3RhcnQsIGVuZCkgfHwgdGhpcy5ob3Jpem9udGFsLmNvbnRhaW5zKGVuZCwgc3RhcnQpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0aGlzLnZlcnRpY2FsLmNvbnRhaW5zKHN0YXJ0LCBlbmQpIHx8IHRoaXMudmVydGljYWwuY29udGFpbnMoZW5kLCBzdGFydCk7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlckdyYXBoLnByb3RvdHlwZS5fYXNzZXJ0VmFsaWRQYXRoID0gZnVuY3Rpb24gKHBhdGgpIHtcbiAgICBhc3NlcnQocGF0aC5vd25lciA9PT0gdGhpcyxcbiAgICAgICAgJ0FSR3JhcGguYXNzZXJ0VmFsaWRCb3g6IGJveC5vd25lciA9PT0gdGhpcyBGQUlMRUQnKTtcbiAgICBwYXRoLmFzc2VydFZhbGlkKCk7XG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLmR1bXBQYXRocyA9IGZ1bmN0aW9uIChwb3MsIGMpIHtcbiAgICBfbG9nZ2VyLmRlYnVnKCdQYXRocyBkdW1wIHBvcyAnICsgcG9zICsgJywgYyAnICsgYyk7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMucGF0aHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgX2xvZ2dlci5kZWJ1ZyhpICsgJy4gUGF0aDogJyk7XG4gICAgICAgIHRoaXMucGF0aHNbaV0uZ2V0UG9pbnRMaXN0KCkuZHVtcFBvaW50cygnRHVtcFBhdGhzJyk7XG4gICAgfVxuXG59O1xuXG5BdXRvUm91dGVyR3JhcGgucHJvdG90eXBlLmR1bXBFZGdlTGlzdHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5ob3Jpem9udGFsLmR1bXBFZGdlcygnSG9yaXpvbnRhbCBlZGdlczonKTtcbiAgICB0aGlzLnZlcnRpY2FsLmR1bXBFZGdlcygnVmVydGljYWwgZWRnZXM6Jyk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEF1dG9Sb3V0ZXJHcmFwaDtcbiIsIid1c2Ugc3RyaWN0JztcbnZhciBkZWJ1ZyA9IHJlcXVpcmUoJ2RlYnVnJyksXG4gICAgTEVWRUxTID0gWyd3YXJuJywgJ2RlYnVnJywgJ2luZm8nXTtcblxudmFyIExvZ2dlciA9IGZ1bmN0aW9uKG5hbWUpe1xuICAgIGZvciAodmFyIGkgPSBMRVZFTFMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHRoaXNbTEVWRUxTW2ldXSA9IGRlYnVnKG5hbWUgKyAnOicgKyBMRVZFTFNbaV0pO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gTG9nZ2VyO1xuIiwiLypnbG9iYWxzIGRlZmluZSovXG4vKmpzaGludCBicm93c2VyOiB0cnVlLCBiaXR3aXNlOiBmYWxzZSovXG5cbi8qKlxuICogQGF1dGhvciBicm9sbGIgLyBodHRwczovL2dpdGh1Yi9icm9sbGJcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBDT05TVEFOVFMgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuQ29uc3RhbnRzJyksXG4gICAgVXRpbHMgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuVXRpbHMnKSxcbiAgICBhc3NlcnQgPSBVdGlscy5hc3NlcnQsXG4gICAgQXJQb2ludCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Qb2ludCcpLFxuICAgIEFyUmVjdCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5SZWN0JyksXG4gICAgQXJQb2ludExpc3RQYXRoID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlBvaW50TGlzdCcpO1xuXG4vLyBBdXRvUm91dGVyUGF0aFxudmFyIEF1dG9Sb3V0ZXJQYXRoID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuaWQgPSAnTm9uZSc7XG4gICAgdGhpcy5vd25lciA9IG51bGw7XG4gICAgdGhpcy5zdGFydHBvaW50ID0gbnVsbDtcbiAgICB0aGlzLmVuZHBvaW50ID0gbnVsbDtcbiAgICB0aGlzLnN0YXJ0cG9ydHMgPSBudWxsO1xuICAgIHRoaXMuZW5kcG9ydHMgPSBudWxsO1xuICAgIHRoaXMuc3RhcnRwb3J0ID0gbnVsbDtcbiAgICB0aGlzLmVuZHBvcnQgPSBudWxsO1xuICAgIHRoaXMuYXR0cmlidXRlcyA9IENPTlNUQU5UUy5QYXRoRGVmYXVsdDtcbiAgICB0aGlzLnN0YXRlID0gQ09OU1RBTlRTLlBhdGhTdGF0ZURlZmF1bHQ7XG4gICAgdGhpcy5pc0F1dG9Sb3V0aW5nT24gPSB0cnVlO1xuICAgIHRoaXMuY3VzdG9tUGF0aERhdGEgPSBbXTtcbiAgICB0aGlzLmN1c3RvbWl6YXRpb25UeXBlID0gJ1BvaW50cyc7XG4gICAgdGhpcy5wYXRoRGF0YVRvRGVsZXRlID0gW107XG4gICAgdGhpcy5wb2ludHMgPSBuZXcgQXJQb2ludExpc3RQYXRoKCk7XG59O1xuXG5cbi8vLS0tLVBvaW50c1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuaGFzT3duZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMub3duZXIgIT09IG51bGw7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuc2V0U3RhcnRFbmRQb3J0cyA9IGZ1bmN0aW9uIChzdGFydCwgZW5kKSB7XG4gICAgdGhpcy5zdGFydHBvcnRzID0gc3RhcnQ7XG4gICAgdGhpcy5lbmRwb3J0cyA9IGVuZDtcbiAgICB0aGlzLmNhbGN1bGF0ZVN0YXJ0RW5kUG9ydHMoKTtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5jbGVhclBvcnRzID0gZnVuY3Rpb24gKCkge1xuICAgIC8vIHJlbW92ZSB0aGUgc3RhcnQvZW5kcG9pbnRzIGZyb20gdGhlIGdpdmVuIHBvcnRzXG4gICAgaWYgKHRoaXMuc3RhcnRwb2ludCkge1xuICAgICAgICB0aGlzLnN0YXJ0cG9ydC5yZW1vdmVQb2ludCh0aGlzLnN0YXJ0cG9pbnQpO1xuICAgICAgICB0aGlzLnN0YXJ0cG9pbnQgPSBudWxsO1xuICAgIH1cbiAgICBpZiAodGhpcy5lbmRwb2ludCkge1xuICAgICAgICB0aGlzLmVuZHBvcnQucmVtb3ZlUG9pbnQodGhpcy5lbmRwb2ludCk7XG4gICAgICAgIHRoaXMuZW5kcG9pbnQgPSBudWxsO1xuICAgIH1cbiAgICB0aGlzLnN0YXJ0cG9ydCA9IG51bGw7XG4gICAgdGhpcy5lbmRwb3J0ID0gbnVsbDtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5nZXRTdGFydFBvcnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgYXNzZXJ0KHRoaXMuc3RhcnRwb3J0cy5sZW5ndGgsIFxuICAgICAgICAnQVJQb3J0LmdldFN0YXJ0UG9ydDogQ2FuXFwndCByZXRyaWV2ZSBzdGFydCBwb3J0LiBmcm9tICcrdGhpcy5pZCk7XG5cbiAgICBpZiAoIXRoaXMuc3RhcnRwb3J0KSB7XG4gICAgICAgIHRoaXMuY2FsY3VsYXRlU3RhcnRQb3J0cygpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5zdGFydHBvcnQ7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuZ2V0RW5kUG9ydCA9IGZ1bmN0aW9uICgpIHtcbiAgICBhc3NlcnQodGhpcy5lbmRwb3J0cy5sZW5ndGgsIFxuICAgICAgICAnQVJQb3J0LmdldEVuZFBvcnQ6IENhblxcJ3QgcmV0cmlldmUgZW5kIHBvcnQgZnJvbSAnK3RoaXMuaWQpO1xuICAgIGlmICghdGhpcy5lbmRwb3J0KSB7XG4gICAgICAgIHRoaXMuY2FsY3VsYXRlRW5kUG9ydHMoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZW5kcG9ydDtcbn07XG5cbi8qKlxuICogUmVtb3ZlIHBvcnQgZnJvbSBzdGFydC9lbmQgcG9ydCBsaXN0cy5cbiAqXG4gKiBAcGFyYW0gcG9ydFxuICogQHJldHVybiB7dW5kZWZpbmVkfVxuICovXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUucmVtb3ZlUG9ydCA9IGZ1bmN0aW9uIChwb3J0KSB7XG4gICAgdmFyIHJlbW92ZWQgPSBVdGlscy5yZW1vdmVGcm9tQXJyYXlzKHBvcnQsIHRoaXMuc3RhcnRwb3J0cywgdGhpcy5lbmRwb3J0cyk7XG4gICAgYXNzZXJ0KHJlbW92ZWQsICdQb3J0IHdhcyBub3QgcmVtb3ZlZCBmcm9tIHBhdGggc3RhcnQvZW5kIHBvcnRzJyk7XG5cbiAgICAvLyBJZiBubyBtb3JlIHN0YXJ0L2VuZCBwb3J0cywgcmVtb3ZlIHRoZSBwYXRoXG4gICAgLy8gYXNzZXJ0KHRoaXMuc3RhcnRwb3J0cy5sZW5ndGggJiYgdGhpcy5lbmRwb3J0cy5sZW5ndGgsICdSZW1vdmVkIGFsbCBzdGFydC9lbmRwb3J0cyBvZiBwYXRoICcgKyB0aGlzLmlkKTtcbiAgICB0aGlzLm93bmVyLmRpc2Nvbm5lY3QodGhpcyk7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuY2FsY3VsYXRlU3RhcnRFbmRQb3J0cyA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4ge3NyYzogdGhpcy5jYWxjdWxhdGVTdGFydFBvcnRzKCksIGRzdDogdGhpcy5jYWxjdWxhdGVFbmRQb3J0cygpfTtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5jYWxjdWxhdGVTdGFydFBvcnRzID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBzcmNQb3J0cyA9IFtdLFxuICAgICAgICB0Z3QsXG4gICAgICAgIGk7XG5cbiAgICBhc3NlcnQodGhpcy5zdGFydHBvcnRzLmxlbmd0aCA+IDAsICdBclBhdGguY2FsY3VsYXRlU3RhcnRFbmRQb3J0czogdGhpcy5zdGFydHBvcnRzIGNhbm5vdCBiZSBlbXB0eSEnKTtcblxuICAgIC8vUmVtb3ZlIHRoaXMuc3RhcnRwb2ludFxuICAgIGlmICh0aGlzLnN0YXJ0cG9ydCAmJiB0aGlzLnN0YXJ0cG9ydC5oYXNQb2ludCh0aGlzLnN0YXJ0cG9pbnQpKSB7XG4gICAgICAgIHRoaXMuc3RhcnRwb3J0LnJlbW92ZVBvaW50KHRoaXMuc3RhcnRwb2ludCk7XG4gICAgfVxuXG4gICAgLy9HZXQgYXZhaWxhYmxlIHBvcnRzXG4gICAgZm9yIChpID0gdGhpcy5zdGFydHBvcnRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICBhc3NlcnQodGhpcy5zdGFydHBvcnRzW2ldLm93bmVyLFxuICAgICAgICAgICAgJ0FSUGF0aC5jYWxjdWxhdGVTdGFydEVuZFBvcnRzOiBwb3J0ICcgKyB0aGlzLnN0YXJ0cG9ydHNbaV0uaWQgKyAnIGhhcyBpbnZhbGlkIHRoaXMub3duZXIhJyk7XG4gICAgICAgIGlmICh0aGlzLnN0YXJ0cG9ydHNbaV0uaXNBdmFpbGFibGUoKSkge1xuICAgICAgICAgICAgc3JjUG9ydHMucHVzaCh0aGlzLnN0YXJ0cG9ydHNbaV0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHNyY1BvcnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBzcmNQb3J0cyA9IHRoaXMuc3RhcnRwb3J0cztcbiAgICB9XG5cbiAgICAvL1ByZXZlbnRpbmcgc2FtZSBzdGFydC9lbmRwb3J0XG4gICAgaWYgKHRoaXMuZW5kcG9ydCAmJiBzcmNQb3J0cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGkgPSBzcmNQb3J0cy5sZW5ndGg7XG4gICAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgICAgIGlmIChzcmNQb3J0c1tpXSA9PT0gdGhpcy5lbmRwb3J0KSB7XG4gICAgICAgICAgICAgICAgc3JjUG9ydHMuc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG5cbiAgICAvLyBHZXR0aW5nIHRhcmdldFxuICAgIGlmICh0aGlzLmlzQXV0b1JvdXRlZCgpKSB7XG4gICAgICAgIHZhciBhY2N1bXVsYXRlUG9ydENlbnRlcnMgPSBmdW5jdGlvbiAocHJldiwgY3VycmVudCkge1xuICAgICAgICAgICAgdmFyIGNlbnRlciA9IGN1cnJlbnQucmVjdC5nZXRDZW50ZXIoKTtcbiAgICAgICAgICAgIHByZXYueCArPSBjZW50ZXIueDtcbiAgICAgICAgICAgIHByZXYueSArPSBjZW50ZXIueTtcbiAgICAgICAgICAgIHJldHVybiBwcmV2O1xuICAgICAgICB9O1xuICAgICAgICB0Z3QgPSB0aGlzLmVuZHBvcnRzLnJlZHVjZShhY2N1bXVsYXRlUG9ydENlbnRlcnMsIG5ldyBBclBvaW50KDAsIDApKTtcblxuICAgICAgICB0Z3QueCAvPSB0aGlzLmVuZHBvcnRzLmxlbmd0aDtcbiAgICAgICAgdGd0LnkgLz0gdGhpcy5lbmRwb3J0cy5sZW5ndGg7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGd0ID0gdGhpcy5jdXN0b21QYXRoRGF0YVswXTtcbiAgICB9XG4gICAgLy8gR2V0IHRoZSBvcHRpbWFsIHBvcnQgdG8gdGhlIHRhcmdldFxuICAgIHRoaXMuc3RhcnRwb3J0ID0gVXRpbHMuZ2V0T3B0aW1hbFBvcnRzKHNyY1BvcnRzLCB0Z3QpO1xuXG4gICAgLy8gQ3JlYXRlIGEgdGhpcy5zdGFydHBvaW50IGF0IHRoZSBwb3J0XG4gICAgdmFyIHN0YXJ0ZGlyID0gdGhpcy5nZXRTdGFydERpcigpLFxuICAgICAgICBzdGFydHBvcnRIYXNMaW1pdGVkID0gZmFsc2UsXG4gICAgICAgIHN0YXJ0cG9ydENhbkhhdmUgPSB0cnVlO1xuXG4gICAgaWYgKHN0YXJ0ZGlyICE9PSBDT05TVEFOVFMuRGlyTm9uZSkge1xuICAgICAgICBzdGFydHBvcnRIYXNMaW1pdGVkID0gdGhpcy5zdGFydHBvcnQuaGFzTGltaXRlZERpcnMoKTtcbiAgICAgICAgc3RhcnRwb3J0Q2FuSGF2ZSA9IHRoaXMuc3RhcnRwb3J0LmNhbkhhdmVTdGFydEVuZFBvaW50T24oc3RhcnRkaXIsIHRydWUpO1xuICAgIH1cbiAgICBpZiAoc3RhcnRkaXIgPT09IENPTlNUQU5UUy5EaXJOb25lIHx8XHRcdFx0XHRcdFx0XHQvLyByZWNhbGMgc3RhcnRkaXIgaWYgZW1wdHlcbiAgICAgICAgc3RhcnRwb3J0SGFzTGltaXRlZCAmJiAhc3RhcnRwb3J0Q2FuSGF2ZSkge1x0XHQvLyBvciBpcyBsaW1pdGVkIGFuZCB1c2VycHJlZiBpcyBpbnZhbGlkXG4gICAgICAgIHN0YXJ0ZGlyID0gdGhpcy5zdGFydHBvcnQuZ2V0U3RhcnRFbmREaXJUbyh0Z3QsIHRydWUpO1xuICAgIH1cblxuICAgIHRoaXMuc3RhcnRwb2ludCA9IHRoaXMuc3RhcnRwb3J0LmNyZWF0ZVN0YXJ0RW5kUG9pbnRUbyh0Z3QsIHN0YXJ0ZGlyKTtcbiAgICB0aGlzLnN0YXJ0cG9pbnQub3duZXIgPSB0aGlzO1xuICAgIHJldHVybiB0aGlzLnN0YXJ0cG9ydDtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5jYWxjdWxhdGVFbmRQb3J0cyA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgZHN0UG9ydHMgPSBbXSxcbiAgICAgICAgdGd0LFxuICAgICAgICBpID0gdGhpcy5lbmRwb3J0cy5sZW5ndGg7XG5cbiAgICBhc3NlcnQodGhpcy5lbmRwb3J0cy5sZW5ndGggPiAwLCAnQXJQYXRoLmNhbGN1bGF0ZVN0YXJ0RW5kUG9ydHM6IHRoaXMuZW5kcG9ydHMgY2Fubm90IGJlIGVtcHR5IScpO1xuXG4gICAgLy9SZW1vdmUgb2xkIHRoaXMuZW5kcG9pbnRcbiAgICBpZiAodGhpcy5lbmRwb3J0ICYmIHRoaXMuZW5kcG9ydC5oYXNQb2ludCh0aGlzLmVuZHBvaW50KSkge1xuICAgICAgICB0aGlzLmVuZHBvcnQucmVtb3ZlUG9pbnQodGhpcy5lbmRwb2ludCk7XG4gICAgfVxuXG4gICAgLy9HZXQgYXZhaWxhYmxlIHBvcnRzXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgICBhc3NlcnQodGhpcy5lbmRwb3J0c1tpXS5vd25lciwgJ0FSUGF0aC5jYWxjdWxhdGVTdGFydEVuZFBvcnRzOiB0aGlzLmVuZHBvcnQgaGFzIGludmFsaWQgdGhpcy5vd25lciEnKTtcbiAgICAgICAgaWYgKHRoaXMuZW5kcG9ydHNbaV0uaXNBdmFpbGFibGUoKSkge1xuICAgICAgICAgICAgZHN0UG9ydHMucHVzaCh0aGlzLmVuZHBvcnRzW2ldKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChkc3RQb3J0cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgZHN0UG9ydHMgPSB0aGlzLmVuZHBvcnRzO1xuICAgIH1cblxuICAgIC8vUHJldmVudGluZyBzYW1lIHN0YXJ0L3RoaXMuZW5kcG9ydFxuICAgIGlmICh0aGlzLnN0YXJ0cG9ydCAmJiBkc3RQb3J0cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGkgPSBkc3RQb3J0cy5sZW5ndGg7XG4gICAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgICAgIGlmIChkc3RQb3J0c1tpXSA9PT0gdGhpcy5zdGFydHBvcnQpIHtcbiAgICAgICAgICAgICAgICBkc3RQb3J0cy5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvL0dldHRpbmcgdGFyZ2V0XG4gICAgaWYgKHRoaXMuaXNBdXRvUm91dGVkKCkpIHtcblxuICAgICAgICB2YXIgYWNjdW11bGF0ZVBvcnRDZW50ZXJzID0gZnVuY3Rpb24gKHByZXYsIGN1cnJlbnQpIHtcbiAgICAgICAgICAgIHZhciBjZW50ZXIgPSBjdXJyZW50LnJlY3QuZ2V0Q2VudGVyKCk7XG4gICAgICAgICAgICBwcmV2LnggKz0gY2VudGVyLng7XG4gICAgICAgICAgICBwcmV2LnkgKz0gY2VudGVyLnk7XG4gICAgICAgICAgICByZXR1cm4gcHJldjtcbiAgICAgICAgfTtcbiAgICAgICAgdGd0ID0gdGhpcy5zdGFydHBvcnRzLnJlZHVjZShhY2N1bXVsYXRlUG9ydENlbnRlcnMsIG5ldyBBclBvaW50KDAsIDApKTtcblxuICAgICAgICB0Z3QueCAvPSB0aGlzLnN0YXJ0cG9ydHMubGVuZ3RoO1xuICAgICAgICB0Z3QueSAvPSB0aGlzLnN0YXJ0cG9ydHMubGVuZ3RoO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGd0ID0gdGhpcy5jdXN0b21QYXRoRGF0YVt0aGlzLmN1c3RvbVBhdGhEYXRhLmxlbmd0aCAtIDFdO1xuICAgIH1cblxuICAgIC8vR2V0IHRoZSBvcHRpbWFsIHBvcnQgdG8gdGhlIHRhcmdldFxuICAgIHRoaXMuZW5kcG9ydCA9IFV0aWxzLmdldE9wdGltYWxQb3J0cyhkc3RQb3J0cywgdGd0KTtcblxuICAgIC8vQ3JlYXRlIHRoaXMuZW5kcG9pbnQgYXQgdGhlIHBvcnRcbiAgICB2YXIgZW5kZGlyID0gdGhpcy5nZXRFbmREaXIoKSxcbiAgICAgICAgc3RhcnRkaXIgPSB0aGlzLmdldFN0YXJ0RGlyKCksXG4gICAgICAgIGVuZHBvcnRIYXNMaW1pdGVkID0gZmFsc2UsXG4gICAgICAgIGVuZHBvcnRDYW5IYXZlID0gdHJ1ZTtcblxuICAgIGlmIChlbmRkaXIgIT09IENPTlNUQU5UUy5EaXJOb25lKSB7XG4gICAgICAgIGVuZHBvcnRIYXNMaW1pdGVkID0gdGhpcy5lbmRwb3J0Lmhhc0xpbWl0ZWREaXJzKCk7XG4gICAgICAgIGVuZHBvcnRDYW5IYXZlID0gdGhpcy5lbmRwb3J0LmNhbkhhdmVTdGFydEVuZFBvaW50T24oZW5kZGlyLCBmYWxzZSk7XG4gICAgfVxuICAgIGlmIChlbmRkaXIgPT09IENPTlNUQU5UUy5EaXJOb25lIHx8ICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGxpa2UgYWJvdmVcbiAgICAgICAgZW5kcG9ydEhhc0xpbWl0ZWQgJiYgIWVuZHBvcnRDYW5IYXZlKSB7XG4gICAgICAgIGVuZGRpciA9IHRoaXMuZW5kcG9ydC5nZXRTdGFydEVuZERpclRvKHRndCwgZmFsc2UsIHRoaXMuc3RhcnRwb3J0ID09PSB0aGlzLmVuZHBvcnQgP1xuICAgICAgICAgICAgc3RhcnRkaXIgOiBDT05TVEFOVFMuRGlyTm9uZSk7XG4gICAgfVxuXG4gICAgdGhpcy5lbmRwb2ludCA9IHRoaXMuZW5kcG9ydC5jcmVhdGVTdGFydEVuZFBvaW50VG8odGd0LCBlbmRkaXIpO1xuICAgIHRoaXMuZW5kcG9pbnQub3duZXIgPSB0aGlzO1xuICAgIHJldHVybiB0aGlzLmVuZHBvcnQ7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuaXNDb25uZWN0ZWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuICh0aGlzLnN0YXRlICYgQ09OU1RBTlRTLlBhdGhTdGF0ZUNvbm5lY3RlZCkgIT09IDA7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuYWRkVGFpbCA9IGZ1bmN0aW9uIChwdCkge1xuICAgIGFzc2VydCghdGhpcy5pc0Nvbm5lY3RlZCgpLFxuICAgICAgICAnQVJQYXRoLmFkZFRhaWw6ICF0aGlzLmlzQ29ubmVjdGVkKCkgRkFJTEVEJyk7XG4gICAgdGhpcy5wb2ludHMucHVzaChwdCk7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuZGVsZXRlQWxsID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMucG9pbnRzID0gbmV3IEFyUG9pbnRMaXN0UGF0aCgpO1xuICAgIHRoaXMuc3RhdGUgPSBDT05TVEFOVFMuUGF0aFN0YXRlRGVmYXVsdDtcbiAgICB0aGlzLmNsZWFyUG9ydHMoKTtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5nZXRTdGFydEJveCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgcG9ydCA9IHRoaXMuc3RhcnRwb3J0IHx8IHRoaXMuc3RhcnRwb3J0c1swXTtcbiAgICByZXR1cm4gcG9ydC5vd25lci5nZXRSb290Qm94KCk7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuZ2V0RW5kQm94ID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBwb3J0ID0gdGhpcy5lbmRwb3J0IHx8IHRoaXMuZW5kcG9ydHNbMF07XG4gICAgcmV0dXJuIHBvcnQub3duZXIuZ2V0Um9vdEJveCgpO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmdldE91dE9mQm94U3RhcnRQb2ludCA9IGZ1bmN0aW9uIChoaW50RGlyKSB7XG4gICAgdmFyIHN0YXJ0Qm94UmVjdCA9IHRoaXMuZ2V0U3RhcnRCb3goKTtcblxuICAgIGFzc2VydChoaW50RGlyICE9PSBDT05TVEFOVFMuRGlyU2tldywgJ0FSUGF0aC5nZXRPdXRPZkJveFN0YXJ0UG9pbnQ6IGhpbnREaXIgIT09IENPTlNUQU5UUy5EaXJTa2V3IEZBSUxFRCcpO1xuICAgIGFzc2VydCh0aGlzLnBvaW50cy5sZW5ndGggPj0gMiwgJ0FSUGF0aC5nZXRPdXRPZkJveFN0YXJ0UG9pbnQ6IHRoaXMucG9pbnRzLmxlbmd0aCA+PSAyIEZBSUxFRCcpO1xuXG4gICAgdmFyIHBvcyA9IDAsXG4gICAgICAgIHAgPSBuZXcgQXJQb2ludCh0aGlzLnBvaW50c1twb3MrK10pLFxuICAgICAgICBkID0gVXRpbHMuZ2V0RGlyKHRoaXMucG9pbnRzW3Bvc10ubWludXMocCkpO1xuXG4gICAgaWYgKGQgPT09IENPTlNUQU5UUy5EaXJTa2V3KSB7XG4gICAgICAgIGQgPSBoaW50RGlyO1xuICAgIH1cbiAgICBhc3NlcnQoVXRpbHMuaXNSaWdodEFuZ2xlKGQpLCAnQVJQYXRoLmdldE91dE9mQm94U3RhcnRQb2ludDogVXRpbHMuaXNSaWdodEFuZ2xlIChkKSBGQUlMRUQnKTtcblxuICAgIGlmIChVdGlscy5pc0hvcml6b250YWwoZCkpIHtcbiAgICAgICAgcC54ID0gVXRpbHMuZ2V0UmVjdE91dGVyQ29vcmQoc3RhcnRCb3hSZWN0LCBkKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBwLnkgPSBVdGlscy5nZXRSZWN0T3V0ZXJDb29yZChzdGFydEJveFJlY3QsIGQpO1xuICAgIH1cblxuICAgIC8vYXNzZXJ0KFV0aWxzLmdldERpciAodGhpcy5wb2ludHNbcG9zXS5taW51cyhwKSkgPT09IFV0aWxzLnJldmVyc2VEaXIgKCBkICkgfHxcbiAgICAvLyBVdGlscy5nZXREaXIgKHRoaXMucG9pbnRzW3Bvc10ubWludXMocCkpID09PSBkLCAnVXRpbHMuZ2V0RGlyICh0aGlzLnBvaW50c1twb3NdLm1pbnVzKHApKSA9PT1cbiAgICAvLyBVdGlscy5yZXZlcnNlRGlyICggZCApIHx8IFV0aWxzLmdldERpciAodGhpcy5wb2ludHNbcG9zXS5taW51cyhwKSkgPT09IGQgRkFJTEVEJyk7XG5cbiAgICByZXR1cm4gcDtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5nZXRPdXRPZkJveEVuZFBvaW50ID0gZnVuY3Rpb24gKGhpbnREaXIpIHtcbiAgICB2YXIgZW5kQm94UmVjdCA9IHRoaXMuZ2V0RW5kQm94KCk7XG5cbiAgICBhc3NlcnQoaGludERpciAhPT0gQ09OU1RBTlRTLkRpclNrZXcsICdBUlBhdGguZ2V0T3V0T2ZCb3hFbmRQb2ludDogaGludERpciAhPT0gQ09OU1RBTlRTLkRpclNrZXcgRkFJTEVEJyk7XG4gICAgYXNzZXJ0KHRoaXMucG9pbnRzLmxlbmd0aCA+PSAyLCAnQVJQYXRoLmdldE91dE9mQm94RW5kUG9pbnQ6IHRoaXMucG9pbnRzLmxlbmd0aCA+PSAyIEZBSUxFRCcpO1xuXG4gICAgdmFyIHBvcyA9IHRoaXMucG9pbnRzLmxlbmd0aCAtIDEsXG4gICAgICAgIHAgPSBuZXcgQXJQb2ludCh0aGlzLnBvaW50c1twb3MtLV0pLFxuICAgICAgICBkID0gVXRpbHMuZ2V0RGlyKHRoaXMucG9pbnRzW3Bvc10ubWludXMocCkpO1xuXG4gICAgaWYgKGQgPT09IENPTlNUQU5UUy5EaXJTa2V3KSB7XG4gICAgICAgIGQgPSBoaW50RGlyO1xuICAgIH1cbiAgICBhc3NlcnQoVXRpbHMuaXNSaWdodEFuZ2xlKGQpLCAnQVJQYXRoLmdldE91dE9mQm94RW5kUG9pbnQ6IFV0aWxzLmlzUmlnaHRBbmdsZSAoZCkgRkFJTEVEJyk7XG5cbiAgICBpZiAoVXRpbHMuaXNIb3Jpem9udGFsKGQpKSB7XG4gICAgICAgIHAueCA9IFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKGVuZEJveFJlY3QsIGQpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHAueSA9IFV0aWxzLmdldFJlY3RPdXRlckNvb3JkKGVuZEJveFJlY3QsIGQpO1xuICAgIH1cblxuICAgIC8vYXNzZXJ0KFV0aWxzLmdldERpciAodGhpcy5wb2ludHNbcG9zXS5taW51cyhwKSkgPT09IFV0aWxzLnJldmVyc2VEaXIgKCBkICkgfHxcbiAgICAvLyBVdGlscy5nZXREaXIgKHRoaXMucG9pbnRzW3Bvc10ubWludXMocCkpID09PSBkLCAnQVJQYXRoLmdldE91dE9mQm94RW5kUG9pbnQ6IFV0aWxzLmdldERpclxuICAgIC8vICh0aGlzLnBvaW50c1twb3NdLm1pbnVzKHApKSA9PT0gZCB8fCBVdGlscy5nZXREaXIgKHRoaXMucG9pbnRzW3Bvc10ubWludXMocCkpID09PSBkIEZBSUxFRCcpO1xuXG4gICAgcmV0dXJuIHA7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuc2ltcGxpZnlUcml2aWFsbHkgPSBmdW5jdGlvbiAoKSB7XG4gICAgYXNzZXJ0KCF0aGlzLmlzQ29ubmVjdGVkKCksICdBUlBhdGguc2ltcGxpZnlUcml2aWFsbHk6ICFpc0Nvbm5lY3RlZCgpIEZBSUxFRCcpO1xuXG4gICAgaWYgKHRoaXMucG9pbnRzLmxlbmd0aCA8PSAyKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgcG9zID0gMCxcbiAgICAgICAgcG9zMSA9IHBvcztcblxuICAgIGFzc2VydChwb3MxICE9PSB0aGlzLnBvaW50cy5sZW5ndGgsICdBUlBhdGguc2ltcGxpZnlUcml2aWFsbHk6IHBvczEgIT09IHRoaXMucG9pbnRzLmxlbmd0aCBGQUlMRUQnKTtcbiAgICB2YXIgcDEgPSB0aGlzLnBvaW50c1twb3MrK10sXG4gICAgICAgIHBvczIgPSBwb3M7XG5cbiAgICBhc3NlcnQocG9zMiAhPT0gdGhpcy5wb2ludHMubGVuZ3RoLCAnQVJQYXRoLnNpbXBsaWZ5VHJpdmlhbGx5OiBwb3MyICE9PSB0aGlzLnBvaW50cy5sZW5ndGggRkFJTEVEJyk7XG4gICAgdmFyIHAyID0gdGhpcy5wb2ludHNbcG9zKytdLFxuICAgICAgICBkaXIxMiA9IFV0aWxzLmdldERpcihwMi5taW51cyhwMSkpLFxuICAgICAgICBwb3MzID0gcG9zO1xuXG4gICAgYXNzZXJ0KHBvczMgIT09IHRoaXMucG9pbnRzLmxlbmd0aCwgJ0FSUGF0aC5zaW1wbGlmeVRyaXZpYWxseTogcG9zMyAhPT0gdGhpcy5wb2ludHMubGVuZ3RoIEZBSUxFRCcpO1xuICAgIHZhciBwMyA9IHRoaXMucG9pbnRzW3BvcysrXSxcbiAgICAgICAgZGlyMjMgPSBVdGlscy5nZXREaXIocDMubWludXMocDIpKTtcblxuICAgIGZvciAoOyA7KSB7XG4gICAgICAgIGlmIChkaXIxMiA9PT0gQ09OU1RBTlRTLkRpck5vbmUgfHwgZGlyMjMgPT09IENPTlNUQU5UUy5EaXJOb25lIHx8XG4gICAgICAgICAgICAoZGlyMTIgIT09IENPTlNUQU5UUy5EaXJTa2V3ICYmIGRpcjIzICE9PSBDT05TVEFOVFMuRGlyU2tldyAmJlxuICAgICAgICAgICAgKGRpcjEyID09PSBkaXIyMyB8fCBkaXIxMiA9PT0gVXRpbHMucmV2ZXJzZURpcihkaXIyMykpICkpIHtcbiAgICAgICAgICAgIHRoaXMucG9pbnRzLnNwbGljZShwb3MyLCAxKTtcbiAgICAgICAgICAgIHBvcy0tO1xuICAgICAgICAgICAgcG9zMy0tO1xuICAgICAgICAgICAgZGlyMTIgPSBVdGlscy5nZXREaXIocDMubWludXMocDEpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBvczEgPSBwb3MyO1xuICAgICAgICAgICAgcDEgPSBwMjtcbiAgICAgICAgICAgIGRpcjEyID0gZGlyMjM7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocG9zID09PSB0aGlzLnBvaW50cy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHBvczIgPSBwb3MzO1xuICAgICAgICBwMiA9IHAzO1xuXG4gICAgICAgIHBvczMgPSBwb3M7XG4gICAgICAgIHAzID0gdGhpcy5wb2ludHNbcG9zKytdO1xuXG4gICAgICAgIGRpcjIzID0gVXRpbHMuZ2V0RGlyKHAzLm1pbnVzKHAyKSk7XG4gICAgfVxuXG4gICAgaWYgKENPTlNUQU5UUy5ERUJVRykge1xuICAgICAgICB0aGlzLmFzc2VydFZhbGlkUG9pbnRzKCk7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmdldFBvaW50TGlzdCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5wb2ludHM7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuaXNQYXRoQ2xpcCA9IGZ1bmN0aW9uIChyLCBpc1N0YXJ0T3JFbmRSZWN0KSB7XG4gICAgdmFyIHRtcCA9IHRoaXMucG9pbnRzLmdldFRhaWxFZGdlKCksXG4gICAgICAgIGEgPSB0bXAuc3RhcnQsXG4gICAgICAgIGIgPSB0bXAuZW5kLFxuICAgICAgICBwb3MgPSB0bXAucG9zLFxuICAgICAgICBpID0gMCxcbiAgICAgICAgbnVtRWRnZXMgPSB0aGlzLnBvaW50cy5sZW5ndGggLSAxO1xuXG4gICAgd2hpbGUgKHBvcyA+PSAwKSB7XG4gICAgICAgIGlmIChpc1N0YXJ0T3JFbmRSZWN0ICYmICggaSA9PT0gMCB8fCBpID09PSBudW1FZGdlcyAtIDEgKSkge1xuICAgICAgICAgICAgaWYgKFV0aWxzLmlzUG9pbnRJbihhLCByLCAxKSAmJlxuICAgICAgICAgICAgICAgIFV0aWxzLmlzUG9pbnRJbihiLCByLCAxKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKFV0aWxzLmlzTGluZUNsaXBSZWN0KGEsIGIsIHIpKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRtcCA9IHRoaXMucG9pbnRzLmdldFByZXZFZGdlKHBvcywgYSwgYik7XG4gICAgICAgIGEgPSB0bXAuc3RhcnQ7XG4gICAgICAgIGIgPSB0bXAuZW5kO1xuICAgICAgICBwb3MgPSB0bXAucG9zO1xuICAgICAgICBpKys7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmlzRml4ZWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuICgodGhpcy5hdHRyaWJ1dGVzICYgQ09OU1RBTlRTLlBhdGhGaXhlZCkgIT09IDApO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmlzTW92ZWFibGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuICgodGhpcy5hdHRyaWJ1dGVzICYgQ09OU1RBTlRTLlBhdGhGaXhlZCkgPT09IDApO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLnNldFN0YXRlID0gZnVuY3Rpb24gKHMpIHtcbiAgICBhc3NlcnQodGhpcy5vd25lciAhPT0gbnVsbCwgJ0FSUGF0aC5zZXRTdGF0ZTogdGhpcy5vd25lciAhPT0gbnVsbCBGQUlMRUQnKTtcblxuICAgIHRoaXMuc3RhdGUgPSBzO1xuICAgIGlmIChDT05TVEFOVFMuREVCVUcpIHtcbiAgICAgICAgdGhpcy5hc3NlcnRWYWxpZCgpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5nZXRFbmREaXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGEgPSB0aGlzLmF0dHJpYnV0ZXMgJiBDT05TVEFOVFMuUGF0aEVuZE1hc2s7XG4gICAgcmV0dXJuIGEgJiBDT05TVEFOVFMuUGF0aEVuZE9uVG9wID8gQ09OU1RBTlRTLkRpclRvcCA6XG4gICAgICAgIGEgJiBDT05TVEFOVFMuUGF0aEVuZE9uUmlnaHQgPyBDT05TVEFOVFMuRGlyUmlnaHQgOlxuICAgICAgICAgICAgYSAmIENPTlNUQU5UUy5QYXRoRW5kT25Cb3R0b20gPyBDT05TVEFOVFMuRGlyQm90dG9tIDpcbiAgICAgICAgICAgICAgICBhICYgQ09OU1RBTlRTLlBhdGhFbmRPbkxlZnQgPyBDT05TVEFOVFMuRGlyTGVmdCA6IENPTlNUQU5UUy5EaXJOb25lO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmdldFN0YXJ0RGlyID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBhID0gdGhpcy5hdHRyaWJ1dGVzICYgQ09OU1RBTlRTLlBhdGhTdGFydE1hc2s7XG4gICAgcmV0dXJuIGEgJiBDT05TVEFOVFMuUGF0aFN0YXJ0T25Ub3AgPyBDT05TVEFOVFMuRGlyVG9wIDpcbiAgICAgICAgYSAmIENPTlNUQU5UUy5QYXRoU3RhcnRPblJpZ2h0ID8gQ09OU1RBTlRTLkRpclJpZ2h0IDpcbiAgICAgICAgICAgIGEgJiBDT05TVEFOVFMuUGF0aFN0YXJ0T25Cb3R0b20gPyBDT05TVEFOVFMuRGlyQm90dG9tIDpcbiAgICAgICAgICAgICAgICBhICYgQ09OU1RBTlRTLlBhdGhTdGFydE9uTGVmdCA/IENPTlNUQU5UUy5EaXJMZWZ0IDogQ09OU1RBTlRTLkRpck5vbmU7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuc2V0RW5kRGlyID0gZnVuY3Rpb24gKHBhdGhFbmQpIHtcbiAgICB0aGlzLmF0dHJpYnV0ZXMgPSAodGhpcy5hdHRyaWJ1dGVzICYgfkNPTlNUQU5UUy5QYXRoRW5kTWFzaykgKyBwYXRoRW5kO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLnNldFN0YXJ0RGlyID0gZnVuY3Rpb24gKHBhdGhTdGFydCkge1xuICAgIHRoaXMuYXR0cmlidXRlcyA9ICh0aGlzLmF0dHJpYnV0ZXMgJiB+Q09OU1RBTlRTLlBhdGhTdGFydE1hc2spICsgcGF0aFN0YXJ0O1xufTtcblxuLyoqXG4gKiBTZXQgdGhlIGN1c3RvbSBwb2ludHMgb2YgdGhlIHBhdGggYW5kIGRldGVybWluZSBzdGFydC9lbmQgcG9pbnRzL3BvcnRzLlxuICpcbiAqIEBwYXJhbSB7QXJyYXk8QXJQb2ludD59IHBvaW50c1xuICogQHJldHVybiB7dW5kZWZpbmVkfVxuICovXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuc2V0Q3VzdG9tUGF0aFBvaW50cyA9IGZ1bmN0aW9uIChwb2ludHMpIHtcbiAgICB0aGlzLmN1c3RvbVBhdGhEYXRhID0gcG9pbnRzO1xuXG4gICAgLy8gRmluZCB0aGUgc3RhcnQvZW5kcG9ydHNcbiAgICB0aGlzLmNhbGN1bGF0ZVN0YXJ0RW5kUG9ydHMoKTtcblxuICAgIHRoaXMucG9pbnRzID0gbmV3IEFyUG9pbnRMaXN0UGF0aCgpLmNvbmNhdChwb2ludHMpO1xuXG4gICAgLy8gQWRkIHRoZSBzdGFydC9lbmQgcG9pbnRzIHRvIHRoZSBsaXN0XG4gICAgdGhpcy5wb2ludHMudW5zaGlmdCh0aGlzLnN0YXJ0cG9pbnQpO1xuICAgIHRoaXMucG9pbnRzLnB1c2godGhpcy5lbmRwb2ludCk7XG5cbiAgICAvLyBTZXQgYXMgY29ubmVjdGVkXG4gICAgdGhpcy5zZXRTdGF0ZShDT05TVEFOVFMuUGF0aFN0YXRlQ29ubmVjdGVkKTtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5jcmVhdGVDdXN0b21QYXRoID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMucG9pbnRzLnNoaWZ0KCk7XG4gICAgdGhpcy5wb2ludHMucG9wKCk7XG5cbiAgICB0aGlzLnBvaW50cy51bnNoaWZ0KHRoaXMuc3RhcnRwb2ludCk7XG4gICAgdGhpcy5wb2ludHMucHVzaCh0aGlzLmVuZHBvaW50KTtcblxuICAgIHRoaXMuc2V0U3RhdGUoQ09OU1RBTlRTLlBhdGhTdGF0ZUNvbm5lY3RlZCk7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUucmVtb3ZlUGF0aEN1c3RvbWl6YXRpb25zID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuY3VzdG9tUGF0aERhdGEgPSBbXTtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5hcmVUaGVyZVBhdGhDdXN0b21pemF0aW9ucyA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5jdXN0b21QYXRoRGF0YS5sZW5ndGggIT09IDA7XG59O1xuXG5BdXRvUm91dGVyUGF0aC5wcm90b3R5cGUuaXNBdXRvUm91dGVkID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmlzQXV0b1JvdXRpbmdPbjtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5zZXRBdXRvUm91dGluZyA9IGZ1bmN0aW9uIChhclN0YXRlKSB7XG4gICAgdGhpcy5pc0F1dG9Sb3V0aW5nT24gPSBhclN0YXRlO1xufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMuaXNDb25uZWN0ZWQoKSkge1xuICAgICAgICB0aGlzLnN0YXJ0cG9ydC5yZW1vdmVQb2ludCh0aGlzLnN0YXJ0cG9pbnQpO1xuICAgICAgICB0aGlzLmVuZHBvcnQucmVtb3ZlUG9pbnQodGhpcy5lbmRwb2ludCk7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlclBhdGgucHJvdG90eXBlLmFzc2VydFZhbGlkID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBpO1xuXG4gICAgYXNzZXJ0KHRoaXMuc3RhcnRwb3J0cy5sZW5ndGggPiAwLCAnUGF0aCBoYXMgbm8gc3RhcnRwb3J0cyEnKTtcbiAgICBhc3NlcnQodGhpcy5lbmRwb3J0cy5sZW5ndGggPiAwLCAnUGF0aCBoYXMgbm8gZW5kcG9ydHMhJyk7XG5cbiAgICBmb3IgKGkgPSB0aGlzLnN0YXJ0cG9ydHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHRoaXMuc3RhcnRwb3J0c1tpXS5hc3NlcnRWYWxpZCgpO1xuICAgIH1cblxuICAgIGZvciAoaSA9IHRoaXMuZW5kcG9ydHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHRoaXMuZW5kcG9ydHNbaV0uYXNzZXJ0VmFsaWQoKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5pc0F1dG9Sb3V0ZWQoKSkge1xuICAgICAgICBpZiAodGhpcy5pc0Nvbm5lY3RlZCgpKSB7XG4gICAgICAgICAgICBhc3NlcnQodGhpcy5wb2ludHMubGVuZ3RoICE9PSAwLFxuICAgICAgICAgICAgICAgICdBUlBhdGguYXNzZXJ0VmFsaWQ6IHRoaXMucG9pbnRzLmxlbmd0aCAhPT0gMCBGQUlMRUQnKTtcbiAgICAgICAgICAgIHZhciBwb2ludHMgPSB0aGlzLmdldFBvaW50TGlzdCgpO1xuICAgICAgICAgICAgcG9pbnRzLmFzc2VydFZhbGlkKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBJZiBpdCBoYXMgYSBzdGFydHBvaW50LCBtdXN0IGFsc28gaGF2ZSBhIHN0YXJ0cG9ydFxuICAgIGlmICh0aGlzLnN0YXJ0cG9pbnQpIHtcbiAgICAgICAgYXNzZXJ0KHRoaXMuc3RhcnRwb3J0LCAnUGF0aCBoYXMgYSBzdGFydHBvaW50IHdpdGhvdXQgYSBzdGFydHBvcnQnKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuZW5kcG9pbnQpIHtcbiAgICAgICAgYXNzZXJ0KHRoaXMuZW5kcG9ydCwgJ1BhdGggaGFzIGEgZW5kcG9pbnQgd2l0aG91dCBhIGVuZHBvcnQnKTtcbiAgICB9XG5cbiAgICBhc3NlcnQodGhpcy5vd25lciwgJ1BhdGggZG9lcyBub3QgaGF2ZSBvd25lciEnKTtcbn07XG5cbkF1dG9Sb3V0ZXJQYXRoLnByb3RvdHlwZS5hc3NlcnRWYWxpZFBvaW50cyA9IGZ1bmN0aW9uICgpIHtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQXV0b1JvdXRlclBhdGg7XG4iLCIvKmdsb2JhbHMgZGVmaW5lKi9cbi8qanNoaW50IGJyb3dzZXI6IHRydWUsIGJpdHdpc2U6IGZhbHNlKi9cblxuLyoqXG4gKiBAYXV0aG9yIGJyb2xsYiAvIGh0dHBzOi8vZ2l0aHViL2Jyb2xsYlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIEFyU2l6ZSA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5TaXplJyk7XG5cbnZhciBBclBvaW50ID0gZnVuY3Rpb24gKHgsIHkpIHtcbiAgICAvLyBNdWx0aXBsZSBDb25zdHJ1Y3RvcnNcbiAgICBpZiAoeCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHggPSAwO1xuICAgICAgICB5ID0gMDtcbiAgICB9IGVsc2UgaWYgKHkgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICB5ID0geC55O1xuICAgICAgICB4ID0geC54O1xuICAgIH1cblxuICAgIHRoaXMueCA9IHg7XG4gICAgdGhpcy55ID0geTtcbn07XG5cbi8qKlxuICogQ2hlY2sgaWYgdGhlIHBvaW50cyBoYXZlIHRoZSBzYW1lIGNvb3JkaW5hdGVzLlxuICpcbiAqIEBwYXJhbSB7QXJQb2ludH0gb3RoZXJQb2ludFxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqL1xuQXJQb2ludC5wcm90b3R5cGUuZXF1YWxzID0gZnVuY3Rpb24gKG90aGVyUG9pbnQpIHtcbiAgICByZXR1cm4gdGhpcy54ID09PSBvdGhlclBvaW50LnggJiYgdGhpcy55ID09PSBvdGhlclBvaW50Lnk7XG59O1xuXG5BclBvaW50LnByb3RvdHlwZS5zaGlmdCA9IGZ1bmN0aW9uIChvdGhlck9iamVjdCkgeyAvL2VxdWl2YWxlbnQgdG8gKz1cbiAgICB0aGlzLnggKz0gb3RoZXJPYmplY3QuZHg7XG4gICAgdGhpcy55ICs9IG90aGVyT2JqZWN0LmR5O1xuXG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG5BclBvaW50LnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiAob3RoZXJPYmplY3QpIHsgLy9lcXVpdmFsZW50IHRvICs9XG4gICAgaWYgKG90aGVyT2JqZWN0IGluc3RhbmNlb2YgQXJTaXplKSB7XG4gICAgICAgIHRoaXMueCArPSBvdGhlck9iamVjdC5jeDtcbiAgICAgICAgdGhpcy55ICs9IG90aGVyT2JqZWN0LmN5O1xuICAgIH0gZWxzZSBpZiAob3RoZXJPYmplY3QgaW5zdGFuY2VvZiBBclBvaW50KSB7XG4gICAgICAgIHRoaXMueCArPSBvdGhlck9iamVjdC54O1xuICAgICAgICB0aGlzLnkgKz0gb3RoZXJPYmplY3QueTtcbiAgICB9XG59O1xuXG5BclBvaW50LnByb3RvdHlwZS5zdWJ0cmFjdCA9IGZ1bmN0aW9uIChvdGhlck9iamVjdCkgeyAvL2VxdWl2YWxlbnQgdG8gKz1cbiAgICBpZiAob3RoZXJPYmplY3QgaW5zdGFuY2VvZiBBclNpemUpIHtcbiAgICAgICAgdGhpcy54IC09IG90aGVyT2JqZWN0LmN4O1xuICAgICAgICB0aGlzLnkgLT0gb3RoZXJPYmplY3QuY3k7XG4gICAgfSBlbHNlIGlmIChvdGhlck9iamVjdCBpbnN0YW5jZW9mIEFyUG9pbnQpIHtcbiAgICAgICAgdGhpcy54IC09IG90aGVyT2JqZWN0Lng7XG4gICAgICAgIHRoaXMueSAtPSBvdGhlck9iamVjdC55O1xuICAgIH1cbn07XG5cbkFyUG9pbnQucHJvdG90eXBlLnBsdXMgPSBmdW5jdGlvbiAob3RoZXJPYmplY3QpIHsgLy9lcXVpdmFsZW50IHRvICtcbiAgICB2YXIgb2JqZWN0Q29weSA9IG51bGw7XG5cbiAgICBpZiAob3RoZXJPYmplY3QgaW5zdGFuY2VvZiBBclNpemUpIHtcbiAgICAgICAgb2JqZWN0Q29weSA9IG5ldyBBclBvaW50KHRoaXMpO1xuICAgICAgICBvYmplY3RDb3B5LmFkZChvdGhlck9iamVjdCk7XG5cbiAgICB9IGVsc2UgaWYgKG90aGVyT2JqZWN0IGluc3RhbmNlb2YgQXJQb2ludCkge1xuICAgICAgICBvYmplY3RDb3B5ID0gbmV3IEFyUG9pbnQob3RoZXJPYmplY3QpO1xuICAgICAgICBvYmplY3RDb3B5LnggKz0gdGhpcy54O1xuICAgICAgICBvYmplY3RDb3B5LnkgKz0gdGhpcy55O1xuICAgIH1cbiAgICByZXR1cm4gb2JqZWN0Q29weSB8fCB1bmRlZmluZWQ7XG59O1xuXG5BclBvaW50LnByb3RvdHlwZS5taW51cyA9IGZ1bmN0aW9uIChvdGhlck9iamVjdCkge1xuICAgIHZhciBvYmplY3RDb3B5ID0gbmV3IEFyUG9pbnQob3RoZXJPYmplY3QpO1xuXG4gICAgaWYgKG90aGVyT2JqZWN0LmN4ICE9PSB1bmRlZmluZWQgJiYgb3RoZXJPYmplY3QuY3kgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBvYmplY3RDb3B5LnN1YnRyYWN0KHRoaXMpO1xuXG4gICAgfSBlbHNlIGlmIChvdGhlck9iamVjdC54ICE9PSB1bmRlZmluZWQgJiYgb3RoZXJPYmplY3QueSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIG9iamVjdENvcHkgPSBuZXcgQXJTaXplKCk7XG4gICAgICAgIG9iamVjdENvcHkuY3ggPSB0aGlzLnggLSBvdGhlck9iamVjdC54O1xuICAgICAgICBvYmplY3RDb3B5LmN5ID0gdGhpcy55IC0gb3RoZXJPYmplY3QueTtcblxuICAgIH1cbiAgICByZXR1cm4gb2JqZWN0Q29weTtcbn07XG5cbkFyUG9pbnQucHJvdG90eXBlLmFzc2lnbiA9IGZ1bmN0aW9uIChvdGhlclBvaW50KSB7XG4gICAgdGhpcy54ID0gb3RoZXJQb2ludC54O1xuICAgIHRoaXMueSA9IG90aGVyUG9pbnQueTtcblxuICAgIHJldHVybiB0aGlzO1xufTtcblxuQXJQb2ludC5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuICcoJyArIHRoaXMueCArICcsICcgKyB0aGlzLnkgKyAnKSc7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEFyUG9pbnQ7XG4iLCIvKmpzaGludCBub2RlOiB0cnVlLCBiaXR3aXNlOiBmYWxzZSovXG5cbi8qKlxuICogQGF1dGhvciBicm9sbGIgLyBodHRwczovL2dpdGh1Yi9icm9sbGJcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBMb2dnZXIgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuTG9nZ2VyJyksICAvLyBGSVhNRVxuICAgIENPTlNUQU5UUyA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Db25zdGFudHMnKSxcbiAgICBVdGlscyA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5VdGlscycpLFxuICAgIGFzc2VydCA9IFV0aWxzLmFzc2VydCxcbiAgICBfbG9nZ2VyID0gbmV3IExvZ2dlcignQXV0b1JvdXRlci5Qb2ludExpc3QnKTtcblxudmFyIEFyUG9pbnRMaXN0UGF0aCA9IGZ1bmN0aW9uICgpIHtcbiAgICBmb3IgKHZhciBpID0gYXJndW1lbnRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICB0aGlzLnVuc2hpZnQoYXJndW1lbnRzW2ldKTtcbiAgICB9XG59O1xuXG5BclBvaW50TGlzdFBhdGgucHJvdG90eXBlID0gW107XG5cbi8vIFdyYXBwZXIgRnVuY3Rpb25zXG5BclBvaW50TGlzdFBhdGgucHJvdG90eXBlLmNvbmNhdCA9IGZ1bmN0aW9uIChsaXN0KSB7XG4gICAgdmFyIG5ld1BvaW50cyA9IG5ldyBBclBvaW50TGlzdFBhdGgoKSxcbiAgICAgICAgaTtcblxuICAgIGZvciAoaSA9IDA7IGkgPCB0aGlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIG5ld1BvaW50cy5wdXNoKHRoaXNbaV0pO1xuICAgIH1cblxuICAgIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIG5ld1BvaW50cy5wdXNoKGxpc3RbaV0pO1xuICAgIH1cbiAgICByZXR1cm4gbmV3UG9pbnRzO1xufTtcblxuLy8gRnVuY3Rpb25zXG5cbkFyUG9pbnRMaXN0UGF0aC5wcm90b3R5cGUuZW5kID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzW3RoaXMubGVuZ3RoIC0gMV07XG59O1xuXG5BclBvaW50TGlzdFBhdGgucHJvdG90eXBlLmdldFRhaWxFZGdlID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLmxlbmd0aCA8IDIpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubGVuZ3RoO1xuICAgIH1cblxuICAgIHZhciBwb3MgPSB0aGlzLmxlbmd0aCAtIDEsXG4gICAgICAgIGVuZCA9IHRoaXNbcG9zLS1dLFxuICAgICAgICBzdGFydCA9IHRoaXNbcG9zXTtcblxuICAgIHJldHVybiB7J3Bvcyc6IHBvcywgJ3N0YXJ0Jzogc3RhcnQsICdlbmQnOiBlbmR9O1xufTtcblxuQXJQb2ludExpc3RQYXRoLnByb3RvdHlwZS5nZXRQcmV2RWRnZSA9IGZ1bmN0aW9uIChwb3MsIHN0YXJ0LCBlbmQpIHtcbiAgICBpZiAoQ09OU1RBTlRTLkRFQlVHKSB7XG4gICAgICAgIHRoaXMuQXNzZXJ0VmFsaWRQb3MocG9zKTtcbiAgICB9XG5cbiAgICBlbmQgPSB0aGlzW3Bvcy0tXTtcbiAgICBpZiAocG9zICE9PSB0aGlzLmxlbmd0aCkge1xuICAgICAgICBzdGFydCA9IHRoaXNbcG9zXTtcbiAgICB9XG5cbiAgICByZXR1cm4geydwb3MnOiBwb3MsICdzdGFydCc6IHN0YXJ0LCAnZW5kJzogZW5kfTtcbn07XG5cbkFyUG9pbnRMaXN0UGF0aC5wcm90b3R5cGUuZ2V0RWRnZSA9IGZ1bmN0aW9uIChwb3MsIHN0YXJ0LCBlbmQpIHtcbiAgICBpZiAoQ09OU1RBTlRTLkRFQlVHKSB7XG4gICAgICAgIHRoaXMuQXNzZXJ0VmFsaWRQb3MocG9zKTtcbiAgICB9XG5cbiAgICBzdGFydCA9IHRoaXNbcG9zKytdO1xuICAgIGFzc2VydChwb3MgPCB0aGlzLmxlbmd0aCwgJ0FyUG9pbnRMaXN0UGF0aC5nZXRFZGdlOiBwb3MgPCB0aGlzLmxlbmd0aCBGQUlMRUQnKTtcblxuICAgIGVuZCA9IHRoaXNbcG9zXTtcbn07XG5cbkFyUG9pbnRMaXN0UGF0aC5wcm90b3R5cGUuZ2V0VGFpbEVkZ2VQdHJzID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBwb3MgPSB0aGlzLmxlbmd0aCxcbiAgICAgICAgc3RhcnQsXG4gICAgICAgIGVuZDtcblxuICAgIGlmICh0aGlzLmxlbmd0aCA8IDIpIHtcbiAgICAgICAgcmV0dXJuIHsncG9zJzogcG9zfTtcbiAgICB9XG5cbiAgICBhc3NlcnQoLS1wb3MgPCB0aGlzLmxlbmd0aCwgJ0FyUG9pbnRMaXN0UGF0aC5nZXRUYWlsRWRnZVB0cnM6IC0tcG9zIDwgdGhpcy5sZW5ndGggRkFJTEVEJyk7XG5cbiAgICBlbmQgPSB0aGlzW3Bvcy0tXTtcbiAgICBhc3NlcnQocG9zIDwgdGhpcy5sZW5ndGgsICdBclBvaW50TGlzdFBhdGguZ2V0VGFpbEVkZ2VQdHJzOiBwb3MgPCB0aGlzLmxlbmd0aCBGQUlMRUQnKTtcblxuICAgIHN0YXJ0ID0gdGhpc1twb3NdO1xuXG4gICAgcmV0dXJuIHsncG9zJzogcG9zLCAnc3RhcnQnOiBzdGFydCwgJ2VuZCc6IGVuZH07XG59O1xuXG5BclBvaW50TGlzdFBhdGgucHJvdG90eXBlLmdldFByZXZFZGdlUHRycyA9IGZ1bmN0aW9uIChwb3MpIHtcbiAgICB2YXIgc3RhcnQsXG4gICAgICAgIGVuZDtcblxuICAgIGlmIChDT05TVEFOVFMuREVCVUcpIHtcbiAgICAgICAgdGhpcy5Bc3NlcnRWYWxpZFBvcyhwb3MpO1xuICAgIH1cblxuICAgIGVuZCA9IHRoaXNbcG9zXTtcblxuICAgIGlmIChwb3MtLSA+IDApIHtcbiAgICAgICAgc3RhcnQgPSB0aGlzW3Bvc107XG4gICAgfVxuXG4gICAgcmV0dXJuIHtwb3M6IHBvcywgc3RhcnQ6IHN0YXJ0LCBlbmQ6IGVuZH07XG59O1xuXG5BclBvaW50TGlzdFBhdGgucHJvdG90eXBlLmdldFN0YXJ0UG9pbnQgPSBmdW5jdGlvbiAocG9zKSB7XG4gICAgaWYgKENPTlNUQU5UUy5ERUJVRykge1xuICAgICAgICB0aGlzLkFzc2VydFZhbGlkUG9zKHBvcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXNbcG9zXTtcbn07XG5cbkFyUG9pbnRMaXN0UGF0aC5wcm90b3R5cGUuZ2V0RW5kUG9pbnQgPSBmdW5jdGlvbiAocG9zKSB7XG4gICAgaWYgKENPTlNUQU5UUy5ERUJVRykge1xuICAgICAgICB0aGlzLkFzc2VydFZhbGlkUG9zKHBvcyk7XG4gICAgfVxuXG4gICAgcG9zKys7XG4gICAgYXNzZXJ0KHBvcyA8IHRoaXMubGVuZ3RoLFxuICAgICAgICAnQXJQb2ludExpc3RQYXRoLmdldEVuZFBvaW50OiBwb3MgPCB0aGlzLmxlbmd0aCBGQUlMRUQnKTtcblxuICAgIHJldHVybiB0aGlzW3Bvc107XG59O1xuXG5BclBvaW50TGlzdFBhdGgucHJvdG90eXBlLmdldFBvaW50QmVmb3JlRWRnZSA9IGZ1bmN0aW9uIChwb3MpIHtcbiAgICBpZiAoQ09OU1RBTlRTLkRFQlVHKSB7XG4gICAgICAgIHRoaXMuQXNzZXJ0VmFsaWRQb3MocG9zKTtcbiAgICB9XG5cbiAgICBwb3MtLTtcbiAgICBpZiAocG9zID09PSB0aGlzLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpc1twb3NdO1xufTtcblxuQXJQb2ludExpc3RQYXRoLnByb3RvdHlwZS5nZXRQb2ludEFmdGVyRWRnZSA9IGZ1bmN0aW9uIChwb3MpIHtcbiAgICBpZiAoQ09OU1RBTlRTLkRFQlVHKSB7XG4gICAgICAgIHRoaXMuQXNzZXJ0VmFsaWRQb3MocG9zKTtcbiAgICB9XG5cbiAgICBwb3MrKztcbiAgICBhc3NlcnQocG9zIDwgdGhpcy5sZW5ndGgsXG4gICAgICAgICdBclBvaW50TGlzdFBhdGguZ2V0UG9pbnRBZnRlckVkZ2U6IHBvcyA8IHRoaXMubGVuZ3RoIEZBSUxFRCcpO1xuXG4gICAgcG9zKys7XG4gICAgaWYgKHBvcyA9PT0gdGhpcy5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXNbcG9zXTtcbn07XG5cbkFyUG9pbnRMaXN0UGF0aC5wcm90b3R5cGUuYXNzZXJ0VmFsaWQgPSBmdW5jdGlvbiAobXNnKSB7XG4gICAgLy8gQ2hlY2sgdG8gbWFrZSBzdXJlIGVhY2ggcG9pbnQgbWFrZXMgYSBob3Jpem9udGFsL3ZlcnRpY2FsIGxpbmUgd2l0aCBpdCdzIG5laWdoYm9yc1xuICAgIG1zZyA9IG1zZyB8fCAnJztcbiAgICBmb3IgKHZhciBpID0gdGhpcy5sZW5ndGggLSAxOyBpID4gMDsgaS0tKSB7XG4gICAgICAgIGFzc2VydCghIXRoaXNbaV0ubWludXMsICdCYWQgdmFsdWUgYXQgcG9zaXRpb24gJyArIGkgKyAnICgnICsgVXRpbHMuc3RyaW5naWZ5KHRoaXNbaV0pICsgJyknKTtcbiAgICAgICAgYXNzZXJ0KCEhdGhpc1tpIC0gMV0ubWludXMsICdCYWQgdmFsdWUgYXQgcG9zaXRpb24gJyArIChpIC0gMSkgKyAnICgnICsgVXRpbHMuc3RyaW5naWZ5KHRoaXNbaSAtIDFdKSArICcpJyk7XG5cbiAgICAgICAgYXNzZXJ0KFV0aWxzLmlzUmlnaHRBbmdsZShVdGlscy5nZXREaXIodGhpc1tpIC0gMV0ubWludXModGhpc1tpXSkpKSxcbiAgICAgICAgICAgIG1zZyArICdcXG5cXHRBclBvaW50TGlzdFBhdGggY29udGFpbnMgc2tldyBlZGdlOlxcbicgKyBVdGlscy5zdHJpbmdpZnkodGhpcykpO1xuICAgIH1cbn07XG5cbkFyUG9pbnRMaXN0UGF0aC5wcm90b3R5cGUuYXNzZXJ0VmFsaWRQb3MgPSBmdW5jdGlvbiAocG9zKSB7XG4gICAgYXNzZXJ0KHBvcyA8IHRoaXMubGVuZ3RoLCAnQXJQb2ludExpc3RQYXRoLmFzc2VydFZhbGlkUG9zOiBwb3MgPCB0aGlzLmxlbmd0aCBGQUlMRUQnKTtcbn07XG5cbkFyUG9pbnRMaXN0UGF0aC5wcm90b3R5cGUuZHVtcFBvaW50cyA9IGZ1bmN0aW9uIChtc2cpIHtcbiAgICBtc2cgKz0gJywgcG9pbnRzIGR1bXAgYmVnaW46XFxuJztcbiAgICB2YXIgcG9zID0gMCxcbiAgICAgICAgaSA9IDAsXG4gICAgICAgIHA7XG4gICAgd2hpbGUgKHBvcyA8IHRoaXMubGVuZ3RoKSB7XG4gICAgICAgIHAgPSB0aGlzW3BvcysrXTtcbiAgICAgICAgbXNnICs9IGkgKyAnLjogKCcgKyBwLnggKyAnLCAnICsgcC55ICsgJylcXG4nO1xuICAgICAgICBpKys7XG4gICAgfVxuICAgIG1zZyArPSAncG9pbnRzIGR1bXAgZW5kLic7XG4gICAgX2xvZ2dlci5kZWJ1Zyhtc2cpO1xuICAgIHJldHVybiBtc2c7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEFyUG9pbnRMaXN0UGF0aDtcblxuIiwiLypqc2hpbnQgbm9kZTogdHJ1ZSwgYml0d2lzZTogZmFsc2UqL1xuXG4vKipcbiAqIEBhdXRob3IgYnJvbGxiIC8gaHR0cHM6Ly9naXRodWIvYnJvbGxiXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgQ09OU1RBTlRTID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLkNvbnN0YW50cycpLFxuICAgIFV0aWxzID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLlV0aWxzJyksXG4gICAgYXNzZXJ0ID0gVXRpbHMuYXNzZXJ0LFxuICAgIEFyUG9pbnQgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUG9pbnQnKSxcbiAgICBBclNpemUgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuU2l6ZScpLFxuICAgIEFyUmVjdCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5SZWN0Jyk7XG5cbnZhciBBdXRvUm91dGVyUG9ydCA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmlkID0gbnVsbDtcbiAgICB0aGlzLm93bmVyID0gbnVsbDtcbiAgICB0aGlzLmxpbWl0ZWREaXJlY3Rpb25zID0gdHJ1ZTtcbiAgICB0aGlzLnJlY3QgPSBuZXcgQXJSZWN0KCk7XG4gICAgdGhpcy5hdHRyaWJ1dGVzID0gQ09OU1RBTlRTLlBvcnREZWZhdWx0O1xuXG4gICAgLy8gRm9yIHRoaXMucG9pbnRzIG9uIENPTlNUQU5UUy5EaXJUb3AsIENPTlNUQU5UUy5EaXJMZWZ0LCBDT05TVEFOVFMuRGlyUmlnaHQsIGV0Y1xuICAgIHRoaXMucG9pbnRzID0gW1tdLCBbXSwgW10sIFtdXTtcbiAgICB0aGlzLnNlbGZQb2ludHMgPSBbXTtcbiAgICB0aGlzLmF2YWlsYWJsZUFyZWEgPSBbXTsgIC8vIGF2YWlsYWJsZUFyZWFzIGtlZXBzIHRyYWNrIG9mIHZpc2libGUgKG5vdCBvdmVybGFwcGVkKSBwb3J0aW9ucyBvZiB0aGUgcG9ydFxuXG4gICAgdGhpcy5jYWxjdWxhdGVTZWxmUG9pbnRzKCk7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuY2FsY3VsYXRlU2VsZlBvaW50cyA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLnNlbGZQb2ludHMgPSBbXTtcbiAgICB0aGlzLnNlbGZQb2ludHMucHVzaChuZXcgQXJQb2ludCh0aGlzLnJlY3QuZ2V0VG9wTGVmdCgpKSk7XG5cbiAgICB0aGlzLnNlbGZQb2ludHMucHVzaChuZXcgQXJQb2ludCh0aGlzLnJlY3QucmlnaHQsIHRoaXMucmVjdC5jZWlsKSk7XG4gICAgdGhpcy5zZWxmUG9pbnRzLnB1c2gobmV3IEFyUG9pbnQodGhpcy5yZWN0LnJpZ2h0LCB0aGlzLnJlY3QuZmxvb3IpKTtcbiAgICB0aGlzLnNlbGZQb2ludHMucHVzaChuZXcgQXJQb2ludCh0aGlzLnJlY3QubGVmdCwgdGhpcy5yZWN0LmZsb29yKSk7XG4gICAgdGhpcy5yZXNldEF2YWlsYWJsZUFyZWEoKTtcbn07XG5cbkF1dG9Sb3V0ZXJQb3J0LnByb3RvdHlwZS5oYXNPd25lciA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5vd25lciAhPT0gbnVsbDtcbn07XG5cbkF1dG9Sb3V0ZXJQb3J0LnByb3RvdHlwZS5pc1JlY3RFbXB0eSA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5yZWN0LmlzUmVjdEVtcHR5KCk7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuZ2V0Q2VudGVyID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLnJlY3QuZ2V0Q2VudGVyUG9pbnQoKTtcbn07XG5cbkF1dG9Sb3V0ZXJQb3J0LnByb3RvdHlwZS5zZXRSZWN0ID0gZnVuY3Rpb24gKHIpIHtcbiAgICBhc3NlcnQoci5nZXRXaWR0aCgpID49IDMgJiYgci5nZXRIZWlnaHQoKSA+PSAzLFxuICAgICAgICAnQVJQb3J0LnNldFJlY3Q6IHIuZ2V0V2lkdGgoKSA+PSAzICYmIHIuZ2V0SGVpZ2h0KCkgPj0gMyBGQUlMRUQhJyk7XG5cbiAgICB0aGlzLnJlY3QuYXNzaWduKHIpO1xuICAgIHRoaXMuY2FsY3VsYXRlU2VsZlBvaW50cygpO1xuICAgIHRoaXMucmVzZXRBdmFpbGFibGVBcmVhKCk7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuc2hpZnRCeSA9IGZ1bmN0aW9uIChvZmZzZXQpIHtcbiAgICBhc3NlcnQoIXRoaXMucmVjdC5pc1JlY3RFbXB0eSgpLCAnQVJQb3J0LnNoaWZ0Qnk6ICF0aGlzLnJlY3QuaXNSZWN0RW1wdHkoKSBGQUlMRUQhJyk7XG5cbiAgICB0aGlzLnJlY3QuYWRkKG9mZnNldCk7XG5cbiAgICB0aGlzLmNhbGN1bGF0ZVNlbGZQb2ludHMoKTtcbiAgICAvLyBTaGlmdCBwb2ludHNcbiAgICB0aGlzLnNoaWZ0UG9pbnRzKG9mZnNldCk7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuaXNDb25uZWN0VG9DZW50ZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuICh0aGlzLmF0dHJpYnV0ZXMgJiBDT05TVEFOVFMuUG9ydENvbm5lY3RUb0NlbnRlcikgIT09IDA7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuaGFzTGltaXRlZERpcnMgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMubGltaXRlZERpcmVjdGlvbnM7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuc2V0TGltaXRlZERpcnMgPSBmdW5jdGlvbiAobHRkKSB7XG4gICAgdGhpcy5saW1pdGVkRGlyZWN0aW9ucyA9IGx0ZDtcbn07XG5cbkF1dG9Sb3V0ZXJQb3J0LnByb3RvdHlwZS5wb3J0T25XaGljaEVkZ2UgPSBmdW5jdGlvbiAocG9pbnQpIHtcbiAgICByZXR1cm4gVXRpbHMub25XaGljaEVkZ2UodGhpcy5yZWN0LCBwb2ludCk7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuY2FuSGF2ZVN0YXJ0RW5kUG9pbnRPbiA9IGZ1bmN0aW9uIChkaXIsIGlzU3RhcnQpIHtcbiAgICBhc3NlcnQoMCA8PSBkaXIgJiYgZGlyIDw9IDMsICdBUlBvcnQuY2FuSGF2ZVN0YXJ0RW5kUG9pbnRPbjogMCA8PSBkaXIgJiYgZGlyIDw9IDMgRkFJTEVEIScpO1xuXG4gICAgaWYgKGlzU3RhcnQpIHtcbiAgICAgICAgZGlyICs9IDQ7XG4gICAgfVxuXG4gICAgcmV0dXJuICgodGhpcy5hdHRyaWJ1dGVzICYgKDEgPDwgZGlyKSkgIT09IDApO1xufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLmNhbkhhdmVTdGFydEVuZFBvaW50ID0gZnVuY3Rpb24gKGlzU3RhcnQpIHtcbiAgICByZXR1cm4gKCh0aGlzLmF0dHJpYnV0ZXMgJiAoaXNTdGFydCA/IENPTlNUQU5UUy5Qb3J0U3RhcnRPbkFsbCA6IENPTlNUQU5UUy5Qb3J0RW5kT25BbGwpKSAhPT0gMCk7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuY2FuSGF2ZVN0YXJ0RW5kUG9pbnRIb3Jpem9udGFsID0gZnVuY3Rpb24gKGlzSG9yaXpvbnRhbCkge1xuICAgIHJldHVybiAoKHRoaXMuYXR0cmlidXRlcyAmXG4gICAgKGlzSG9yaXpvbnRhbCA/IENPTlNUQU5UUy5Qb3J0U3RhcnRFbmRIb3Jpem9udGFsIDogQ09OU1RBTlRTLlBvcnRTdGFydEVuZFZlcnRpY2FsKSkgIT09IDApO1xufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLmdldFN0YXJ0RW5kRGlyVG8gPSBmdW5jdGlvbiAocG9pbnQsIGlzU3RhcnQsIG5vdHRoaXMpIHtcbiAgICBhc3NlcnQoIXRoaXMucmVjdC5pc1JlY3RFbXB0eSgpLCAnQVJQb3J0LmdldFN0YXJ0RW5kRGlyVG86ICF0aGlzLnJlY3QuaXNSZWN0RW1wdHkoKSBGQUlMRUQhJyk7XG5cbiAgICBub3R0aGlzID0gbm90dGhpcyA/IG5vdHRoaXMgOiBDT05TVEFOVFMuRGlyTm9uZTsgLy8gaWYgbm90dGhpcyBpcyB1bmRlZmluZWQsIHNldCBpdCB0byBDT05TVEFOVFMuRGlyTm9uZSAoLTEpXG5cbiAgICB2YXIgb2Zmc2V0ID0gcG9pbnQubWludXModGhpcy5yZWN0LmdldENlbnRlclBvaW50KCkpLFxuICAgICAgICBkaXIxID0gVXRpbHMuZ2V0TWFqb3JEaXIob2Zmc2V0KTtcblxuICAgIGlmIChkaXIxICE9PSBub3R0aGlzICYmIHRoaXMuY2FuSGF2ZVN0YXJ0RW5kUG9pbnRPbihkaXIxLCBpc1N0YXJ0KSkge1xuICAgICAgICByZXR1cm4gZGlyMTtcbiAgICB9XG5cbiAgICB2YXIgZGlyMiA9IFV0aWxzLmdldE1pbm9yRGlyKG9mZnNldCk7XG5cbiAgICBpZiAoZGlyMiAhPT0gbm90dGhpcyAmJiB0aGlzLmNhbkhhdmVTdGFydEVuZFBvaW50T24oZGlyMiwgaXNTdGFydCkpIHtcbiAgICAgICAgcmV0dXJuIGRpcjI7XG4gICAgfVxuXG4gICAgdmFyIGRpcjMgPSBVdGlscy5yZXZlcnNlRGlyKGRpcjIpO1xuXG4gICAgaWYgKGRpcjMgIT09IG5vdHRoaXMgJiYgdGhpcy5jYW5IYXZlU3RhcnRFbmRQb2ludE9uKGRpcjMsIGlzU3RhcnQpKSB7XG4gICAgICAgIHJldHVybiBkaXIzO1xuICAgIH1cblxuICAgIHZhciBkaXI0ID0gVXRpbHMucmV2ZXJzZURpcihkaXIxKTtcblxuICAgIGlmIChkaXI0ICE9PSBub3R0aGlzICYmIHRoaXMuY2FuSGF2ZVN0YXJ0RW5kUG9pbnRPbihkaXI0LCBpc1N0YXJ0KSkge1xuICAgICAgICByZXR1cm4gZGlyNDtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5jYW5IYXZlU3RhcnRFbmRQb2ludE9uKGRpcjEsIGlzU3RhcnQpKSB7XG4gICAgICAgIHJldHVybiBkaXIxO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmNhbkhhdmVTdGFydEVuZFBvaW50T24oZGlyMiwgaXNTdGFydCkpIHtcbiAgICAgICAgcmV0dXJuIGRpcjI7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuY2FuSGF2ZVN0YXJ0RW5kUG9pbnRPbihkaXIzLCBpc1N0YXJ0KSkge1xuICAgICAgICByZXR1cm4gZGlyMztcbiAgICB9XG5cbiAgICBpZiAodGhpcy5jYW5IYXZlU3RhcnRFbmRQb2ludE9uKGRpcjQsIGlzU3RhcnQpKSB7XG4gICAgICAgIHJldHVybiBkaXI0O1xuICAgIH1cblxuICAgIHJldHVybiBDT05TVEFOVFMuRGlyVG9wO1xufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLnJvdW5kVG9IYWxmR3JpZCA9IGZ1bmN0aW9uIChsZWZ0LCByaWdodCkge1xuICAgIHZhciBidHduID0gKGxlZnQgKyByaWdodCkgLyAyO1xuICAgIGFzc2VydChidHduIDwgTWF0aC5tYXgobGVmdCwgcmlnaHQpICYmIGJ0d24gPiBNYXRoLm1pbihsZWZ0LCByaWdodCksXG4gICAgICAgICdyb3VuZFRvSGFsZkdyaWQ6IGJ0d24gdmFyaWFibGUgbm90IGJldHdlZW4gbGVmdCwgcmlnaHQgdmFsdWVzLiBQZXJoYXBzIGJveC9jb25uZWN0aW9uQXJlYSBpcyB0b28gc21hbGw/Jyk7XG4gICAgcmV0dXJuIGJ0d247XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuY3JlYXRlU3RhcnRFbmRQb2ludFRvID0gZnVuY3Rpb24gKHBvaW50LCBkaXIpIHtcbiAgICAvLyBjYWxjdWxhdGUgcGF0aEFuZ2xlXG4gICAgdmFyIGR4ID0gcG9pbnQueCAtIHRoaXMuZ2V0Q2VudGVyKCkueCxcbiAgICAgICAgZHkgPSBwb2ludC55IC0gdGhpcy5nZXRDZW50ZXIoKS55LFxuICAgICAgICBwYXRoQW5nbGUgPSBNYXRoLmF0YW4yKC1keSwgZHgpLFxuICAgICAgICBrID0gMCxcbiAgICAgICAgbWF4WCA9IHRoaXMucmVjdC5yaWdodCxcbiAgICAgICAgbWF4WSA9IHRoaXMucmVjdC5mbG9vcixcbiAgICAgICAgbWluWCA9IHRoaXMucmVjdC5sZWZ0LFxuICAgICAgICBtaW5ZID0gdGhpcy5yZWN0LmNlaWwsXG4gICAgICAgIHJlc3VsdFBvaW50LFxuICAgICAgICBzbWFsbGVyUHQgPSBuZXcgQXJQb2ludChtaW5YLCBtaW5ZKSwgIC8vIFRoZSB0aGlzLnBvaW50cyB0aGF0IHRoZSByZXN1bHRQb2ludCBpcyBjZW50ZXJlZCBiZXR3ZWVuXG4gICAgICAgIGxhcmdlclB0ID0gbmV3IEFyUG9pbnQobWF4WCwgbWF4WSk7XG5cbiAgICAvLyBGaW5kIHRoZSBzbWFsbGVyIGFuZCBsYXJnZXIgcG9pbnRzXG4gICAgLy8gQXMgdGhlIHBvaW50cyBjYW5ub3QgYmUgb24gdGhlIGNvcm5lciBvZiBhbiBlZGdlIChhbWJpZ3VvdXMgZGlyZWN0aW9uKSwgXG4gICAgLy8gd2Ugd2lsbCBzaGlmdCB0aGUgbWluLCBtYXggaW4gb25lIHBpeGVsXG4gICAgaWYgKFV0aWxzLmlzSG9yaXpvbnRhbChkaXIpKSB7ICAvLyBzaGlmdCB4IGNvb3JkaW5hdGVzXG4gICAgICAgIG1pblgrKztcbiAgICAgICAgbWF4WC0tO1xuICAgIH0gZWxzZSB7IC8vIHNoaWZ0IHkgY29vcmRpbmF0ZXNcbiAgICAgICAgbWluWSsrO1xuICAgICAgICBtYXhZLS07XG4gICAgfVxuXG4gICAgLy8gQWRqdXN0IGFuZ2xlIGJhc2VkIG9uIHBhcnQgb2YgcG9ydCB0byB3aGljaCBpdCBpcyBjb25uZWN0aW5nXG4gICAgc3dpdGNoIChkaXIpIHtcblxuICAgICAgICBjYXNlIENPTlNUQU5UUy5EaXJUb3A6XG4gICAgICAgICAgICBwYXRoQW5nbGUgPSAyICogTWF0aC5QSSAtIChwYXRoQW5nbGUgKyBNYXRoLlBJIC8gMik7XG4gICAgICAgICAgICBsYXJnZXJQdC55ID0gdGhpcy5yZWN0LmNlaWw7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlIENPTlNUQU5UUy5EaXJSaWdodDpcbiAgICAgICAgICAgIHBhdGhBbmdsZSA9IDIgKiBNYXRoLlBJIC0gcGF0aEFuZ2xlO1xuICAgICAgICAgICAgc21hbGxlclB0LnggPSB0aGlzLnJlY3QucmlnaHQ7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlIENPTlNUQU5UUy5EaXJCb3R0b206XG4gICAgICAgICAgICBwYXRoQW5nbGUgLT0gTWF0aC5QSSAvIDI7XG4gICAgICAgICAgICBzbWFsbGVyUHQueSA9IHRoaXMucmVjdC5mbG9vcjtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgQ09OU1RBTlRTLkRpckxlZnQ6XG4gICAgICAgICAgICBsYXJnZXJQdC54ID0gdGhpcy5yZWN0LmxlZnQ7XG4gICAgICAgICAgICBicmVhaztcbiAgICB9XG5cbiAgICBpZiAocGF0aEFuZ2xlIDwgMCkge1xuICAgICAgICBwYXRoQW5nbGUgKz0gMiAqIE1hdGguUEk7XG4gICAgfVxuXG4gICAgcGF0aEFuZ2xlICo9IDE4MCAvIE1hdGguUEk7ICAvLyBVc2luZyBkZWdyZWVzIGZvciBlYXNpZXIgZGVidWdnaW5nXG5cbiAgICAvLyBGaW5kaW5nIHRoaXMucG9pbnRzIG9yZGVyaW5nXG4gICAgd2hpbGUgKGsgPCB0aGlzLnBvaW50c1tkaXJdLmxlbmd0aCAmJiBwYXRoQW5nbGUgPiB0aGlzLnBvaW50c1tkaXJdW2tdLnBhdGhBbmdsZSkge1xuICAgICAgICBrKys7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMucG9pbnRzW2Rpcl0ubGVuZ3RoKSB7XG4gICAgICAgIGlmIChrID09PSAwKSB7XG4gICAgICAgICAgICBsYXJnZXJQdCA9IG5ldyBBclBvaW50KHRoaXMucG9pbnRzW2Rpcl1ba10pO1xuXG4gICAgICAgIH0gZWxzZSBpZiAoayAhPT0gdGhpcy5wb2ludHNbZGlyXS5sZW5ndGgpIHtcbiAgICAgICAgICAgIHNtYWxsZXJQdCA9IG5ldyBBclBvaW50KHRoaXMucG9pbnRzW2Rpcl1bayAtIDFdKTtcbiAgICAgICAgICAgIGxhcmdlclB0ID0gbmV3IEFyUG9pbnQodGhpcy5wb2ludHNbZGlyXVtrXSk7XG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNtYWxsZXJQdCA9IG5ldyBBclBvaW50KHRoaXMucG9pbnRzW2Rpcl1bayAtIDFdKTtcblxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVzdWx0UG9pbnQgPSBuZXcgQXJQb2ludCgobGFyZ2VyUHQueCArIHNtYWxsZXJQdC54KSAvIDIsIChsYXJnZXJQdC55ICsgc21hbGxlclB0LnkpIC8gMik7XG4gICAgcmVzdWx0UG9pbnQucGF0aEFuZ2xlID0gcGF0aEFuZ2xlO1xuXG4gICAgLy8gTW92ZSB0aGUgcG9pbnQgb3ZlciB0byBhbiAndGhpcy5hdmFpbGFibGVBcmVhJyBpZiBhcHByb3ByaWF0ZVxuICAgIHZhciBpID0gdGhpcy5hdmFpbGFibGVBcmVhLmxlbmd0aCxcbiAgICAgICAgY2xvc2VzdEFyZWEgPSAwLFxuICAgICAgICBkaXN0YW5jZSA9IEluZmluaXR5LFxuICAgICAgICBzdGFydCxcbiAgICAgICAgZW5kO1xuXG4gICAgLy8gRmluZCBkaXN0YW5jZSBmcm9tIGVhY2ggdGhpcy5hdmFpbGFibGVBcmVhIGFuZCBzdG9yZSBjbG9zZXN0IGluZGV4XG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgICBzdGFydCA9IHRoaXMuYXZhaWxhYmxlQXJlYVtpXVswXTtcbiAgICAgICAgZW5kID0gdGhpcy5hdmFpbGFibGVBcmVhW2ldWzFdO1xuXG4gICAgICAgIGlmIChVdGlscy5pc09uRWRnZShzdGFydCwgZW5kLCByZXN1bHRQb2ludCkpIHtcbiAgICAgICAgICAgIGNsb3Nlc3RBcmVhID0gLTE7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfSBlbHNlIGlmIChVdGlscy5kaXN0YW5jZUZyb21MaW5lKHJlc3VsdFBvaW50LCBzdGFydCwgZW5kKSA8IGRpc3RhbmNlKSB7XG4gICAgICAgICAgICBjbG9zZXN0QXJlYSA9IGk7XG4gICAgICAgICAgICBkaXN0YW5jZSA9IFV0aWxzLmRpc3RhbmNlRnJvbUxpbmUocmVzdWx0UG9pbnQsIHN0YXJ0LCBlbmQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGNsb3Nlc3RBcmVhICE9PSAtMSAmJiB0aGlzLmlzQXZhaWxhYmxlKCkpIHsgLy8gcmVzdWx0UG9pbnQgbmVlZHMgdG8gYmUgbW92ZWQgdG8gdGhlIGNsb3Nlc3QgYXZhaWxhYmxlIGFyZWFcbiAgICAgICAgdmFyIGRpcjIgPSBVdGlscy5nZXREaXIodGhpcy5hdmFpbGFibGVBcmVhW2Nsb3Nlc3RBcmVhXVswXS5taW51cyhyZXN1bHRQb2ludCkpO1xuXG4gICAgICAgIGFzc2VydChVdGlscy5pc1JpZ2h0QW5nbGUoZGlyMiksXG4gICAgICAgICAgICAnQXV0b1JvdXRlclBvcnQuY3JlYXRlU3RhcnRFbmRQb2ludFRvOiBVdGlscy5pc1JpZ2h0QW5nbGUoZGlyMikgRkFJTEVEJyk7XG5cbiAgICAgICAgaWYgKGRpcjIgPT09IENPTlNUQU5UUy5EaXJMZWZ0IHx8IGRpcjIgPT09IENPTlNUQU5UUy5EaXJUb3ApIHsgLy8gVGhlbiByZXN1bHRQb2ludCBtdXN0IGJlIG1vdmVkIHVwXG4gICAgICAgICAgICBsYXJnZXJQdCA9IHRoaXMuYXZhaWxhYmxlQXJlYVtjbG9zZXN0QXJlYV1bMV07XG4gICAgICAgIH0gZWxzZSB7IC8vIFRoZW4gcmVzdWx0UG9pbnQgbXVzdCBiZSBtb3ZlZCBkb3duXG4gICAgICAgICAgICBzbWFsbGVyUHQgPSB0aGlzLmF2YWlsYWJsZUFyZWFbY2xvc2VzdEFyZWFdWzBdO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVzdWx0UG9pbnQgPSBuZXcgQXJQb2ludCgobGFyZ2VyUHQueCArIHNtYWxsZXJQdC54KSAvIDIsIChsYXJnZXJQdC55ICsgc21hbGxlclB0LnkpIC8gMik7XG4gICAgfVxuXG4gICAgdGhpcy5wb2ludHNbZGlyXS5zcGxpY2UoaywgMCwgcmVzdWx0UG9pbnQpO1xuXG4gICAgYXNzZXJ0KFV0aWxzLmlzUmlnaHRBbmdsZSh0aGlzLnBvcnRPbldoaWNoRWRnZShyZXN1bHRQb2ludCkpLFxuICAgICAgICAnQXV0b1JvdXRlclBvcnQuY3JlYXRlU3RhcnRFbmRQb2ludFRvOiBVdGlscy5pc1JpZ2h0QW5nbGUodGhpcy5wb3J0T25XaGljaEVkZ2UocmVzdWx0UG9pbnQpKSBGQUlMRUQnKTtcblxuICAgIHJldHVybiByZXN1bHRQb2ludDtcbn07XG5cbkF1dG9Sb3V0ZXJQb3J0LnByb3RvdHlwZS5yZW1vdmVQb2ludCA9IGZ1bmN0aW9uIChwdCkge1xuICAgIHZhciByZW1vdmVkO1xuXG4gICAgcmVtb3ZlZCA9IFV0aWxzLnJlbW92ZUZyb21BcnJheXMuYXBwbHkobnVsbCwgW3B0XS5jb25jYXQodGhpcy5wb2ludHMpKTtcbn07XG5cbkF1dG9Sb3V0ZXJQb3J0LnByb3RvdHlwZS5oYXNQb2ludCA9IGZ1bmN0aW9uIChwdCkge1xuICAgIHZhciBpID0gMCxcbiAgICAgICAgaztcblxuICAgIHdoaWxlIChpIDwgNCkgeyAvL0NoZWNrIGFsbCBzaWRlcyBmb3IgdGhlIHBvaW50XG4gICAgICAgIGsgPSB0aGlzLnBvaW50c1tpXS5pbmRleE9mKHB0KTtcblxuICAgICAgICBpZiAoayA+IC0xKSB7IC8vSWYgdGhlIHBvaW50IGlzIG9uIHRoaXMgc2lkZSBvZiB0aGUgcG9ydFxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaSsrO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbn07XG5cbkF1dG9Sb3V0ZXJQb3J0LnByb3RvdHlwZS5zaGlmdFBvaW50cyA9IGZ1bmN0aW9uIChzaGlmdCkge1xuICAgIGZvciAodmFyIHMgPSB0aGlzLnBvaW50cy5sZW5ndGg7IHMtLTspIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IHRoaXMucG9pbnRzW3NdLmxlbmd0aDsgaS0tOykge1xuICAgICAgICAgICAgLy8gU2hpZnQgdGhpcyBwb2ludFxuICAgICAgICAgICAgdGhpcy5wb2ludHNbc11baV0uYWRkKHNoaWZ0KTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJQb3J0LnByb3RvdHlwZS5nZXRQb2ludENvdW50ID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBpID0gMCxcbiAgICAgICAgY291bnQgPSAwO1xuXG4gICAgd2hpbGUgKGkgPCA0KSB7IC8vIENoZWNrIGFsbCBzaWRlcyBmb3IgdGhlIHBvaW50XG4gICAgICAgIGNvdW50ICs9IHRoaXMucG9pbnRzW2krK10ubGVuZ3RoO1xuICAgIH1cblxuICAgIHJldHVybiBjb3VudDtcbn07XG5cbkF1dG9Sb3V0ZXJQb3J0LnByb3RvdHlwZS5yZXNldEF2YWlsYWJsZUFyZWEgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5hdmFpbGFibGVBcmVhID0gW107XG5cbiAgICBpZiAodGhpcy5jYW5IYXZlU3RhcnRFbmRQb2ludE9uKENPTlNUQU5UUy5EaXJUb3ApKSB7XG4gICAgICAgIHRoaXMuYXZhaWxhYmxlQXJlYS5wdXNoKFt0aGlzLnJlY3QuZ2V0VG9wTGVmdCgpLCBuZXcgQXJQb2ludCh0aGlzLnJlY3QucmlnaHQsIHRoaXMucmVjdC5jZWlsKV0pO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmNhbkhhdmVTdGFydEVuZFBvaW50T24oQ09OU1RBTlRTLkRpclJpZ2h0KSkge1xuICAgICAgICB0aGlzLmF2YWlsYWJsZUFyZWEucHVzaChbbmV3IEFyUG9pbnQodGhpcy5yZWN0LnJpZ2h0LCB0aGlzLnJlY3QuY2VpbCksIHRoaXMucmVjdC5nZXRCb3R0b21SaWdodCgpXSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuY2FuSGF2ZVN0YXJ0RW5kUG9pbnRPbihDT05TVEFOVFMuRGlyQm90dG9tKSkge1xuICAgICAgICB0aGlzLmF2YWlsYWJsZUFyZWEucHVzaChbbmV3IEFyUG9pbnQodGhpcy5yZWN0LmxlZnQsIHRoaXMucmVjdC5mbG9vciksIHRoaXMucmVjdC5nZXRCb3R0b21SaWdodCgpXSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuY2FuSGF2ZVN0YXJ0RW5kUG9pbnRPbihDT05TVEFOVFMuRGlyTGVmdCkpIHtcbiAgICAgICAgdGhpcy5hdmFpbGFibGVBcmVhLnB1c2goW3RoaXMucmVjdC5nZXRUb3BMZWZ0KCksIG5ldyBBclBvaW50KHRoaXMucmVjdC5sZWZ0LCB0aGlzLnJlY3QuZmxvb3IpXSk7XG4gICAgfVxuXG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuYWRqdXN0QXZhaWxhYmxlQXJlYSA9IGZ1bmN0aW9uIChyKSB7XG4gICAgLy9Gb3IgYWxsIGxpbmVzIHNwZWNpZmllZCBpbiBhdmFpbGFibGVBcmVhcywgY2hlY2sgaWYgdGhlIGxpbmUgVXRpbHMuaW50ZXJzZWN0IHMgdGhlIHJlY3RhbmdsZVxuICAgIC8vSWYgaXQgZG9lcywgcmVtb3ZlIHRoZSBwYXJ0IG9mIHRoZSBsaW5lIHRoYXQgVXRpbHMuaW50ZXJzZWN0IHMgdGhlIHJlY3RhbmdsZVxuICAgIGlmICghdGhpcy5yZWN0LnRvdWNoaW5nKHIpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgaSA9IHRoaXMuYXZhaWxhYmxlQXJlYS5sZW5ndGgsXG4gICAgICAgIGludGVyc2VjdGlvbixcbiAgICAgICAgbGluZTtcblxuICAgIHdoaWxlIChpLS0pIHtcblxuICAgICAgICBpZiAoVXRpbHMuaXNMaW5lQ2xpcFJlY3QodGhpcy5hdmFpbGFibGVBcmVhW2ldWzBdLCB0aGlzLmF2YWlsYWJsZUFyZWFbaV1bMV0sIHIpKSB7XG4gICAgICAgICAgICBsaW5lID0gdGhpcy5hdmFpbGFibGVBcmVhLnNwbGljZShpLCAxKVswXTtcbiAgICAgICAgICAgIGludGVyc2VjdGlvbiA9IFV0aWxzLmdldExpbmVDbGlwUmVjdEludGVyc2VjdChsaW5lWzBdLCBsaW5lWzFdLCByKTtcblxuICAgICAgICAgICAgaWYgKCFpbnRlcnNlY3Rpb25bMF0uZXF1YWxzKGxpbmVbMF0pKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hdmFpbGFibGVBcmVhLnB1c2goW2xpbmVbMF0sIGludGVyc2VjdGlvblswXV0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIWludGVyc2VjdGlvblsxXS5lcXVhbHMobGluZVsxXSkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmF2YWlsYWJsZUFyZWEucHVzaChbaW50ZXJzZWN0aW9uWzFdLCBsaW5lWzFdXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuZ2V0VG90YWxBdmFpbGFibGVBcmVhID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBpID0gdGhpcy5hdmFpbGFibGVBcmVhLmxlbmd0aCxcbiAgICAgICAgbGVuZ3RoID0gbmV3IEFyU2l6ZSgpO1xuXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgICBsZW5ndGguYWRkKHRoaXMuYXZhaWxhYmxlQXJlYVtpXVsxXS5taW51cyh0aGlzLmF2YWlsYWJsZUFyZWFbaV1bMF0pKTtcbiAgICB9XG5cbiAgICBhc3NlcnQobGVuZ3RoLmN4ID09PSAwIHx8IGxlbmd0aC5jeSA9PT0gMCxcbiAgICAgICAgJ0FSUG9ydC5nZXRUb3RhbEF2YWlsYWJsZUFyZWE6IGxlbmd0aFswXSA9PT0gMCB8fCBsZW5ndGhbMV0gPT09IDAgRkFJTEVEJyk7XG4gICAgcmV0dXJuIGxlbmd0aC5jeCB8fCBsZW5ndGguY3k7XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuaXNBdmFpbGFibGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuYXZhaWxhYmxlQXJlYS5sZW5ndGggPiAwO1xufTtcblxuQXV0b1JvdXRlclBvcnQucHJvdG90eXBlLmFzc2VydFZhbGlkID0gZnVuY3Rpb24gKCkge1xuICAgIC8vIENoZWNrIHRoYXQgYWxsIHBvaW50cyBhcmUgb24gYSBzaWRlIG9mIHRoZSBwb3J0XG4gICAgdmFyIHBvaW50O1xuXG4gICAgYXNzZXJ0KHRoaXMub3duZXIsICdQb3J0ICcgKyB0aGlzLmlkICsgJyBkb2VzIG5vdCBoYXZlIHZhbGlkIG93bmVyIScpO1xuICAgIGZvciAodmFyIHMgPSB0aGlzLnBvaW50cy5sZW5ndGg7IHMtLTspIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IHRoaXMucG9pbnRzW3NdLmxlbmd0aDsgaS0tOykge1xuICAgICAgICAgICAgcG9pbnQgPSB0aGlzLnBvaW50c1tzXVtpXTtcbiAgICAgICAgICAgIGFzc2VydChVdGlscy5pc1JpZ2h0QW5nbGUodGhpcy5wb3J0T25XaGljaEVkZ2UocG9pbnQpKSxcbiAgICAgICAgICAgICAgICAnQXV0b1JvdXRlclBvcnQuY3JlYXRlU3RhcnRFbmRQb2ludFRvOiBVdGlscy5pc1JpZ2h0QW5nbGUodGhpcy5wb3J0T25XaGljaEVkZ2UocmVzdWx0UG9pbnQpKScgK1xuICAgICAgICAgICAgICAgICcgRkFJTEVEJyk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5BdXRvUm91dGVyUG9ydC5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcbiAgICAvLyBSZW1vdmUgYWxsIHBvaW50c1xuICAgIHRoaXMub3duZXIgPSBudWxsO1xuXG4gICAgLy8gUmVtb3ZlIGFsbCBwb2ludHMgYW5kIHNlbGYgZnJvbSBhbGwgcGF0aHNcbiAgICB2YXIgcG9pbnQsXG4gICAgICAgIHBhdGg7XG5cbiAgICBmb3IgKHZhciBpID0gdGhpcy5wb2ludHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIGZvciAodmFyIGogPSB0aGlzLnBvaW50c1tpXS5sZW5ndGg7IGotLTspIHtcbiAgICAgICAgICAgIHBvaW50ID0gdGhpcy5wb2ludHNbaV1bal07XG4gICAgICAgICAgICBwYXRoID0gcG9pbnQub3duZXI7XG4gICAgICAgICAgICBhc3NlcnQocGF0aCwgJ3N0YXJ0L2VuZCBwb2ludCBkb2VzIG5vdCBoYXZlIGFuIG93bmVyIScpO1xuICAgICAgICAgICAgcGF0aC5yZW1vdmVQb3J0KHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5wb2ludHMgPSBbW10sIFtdLCBbXSwgW11dO1xuXG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEF1dG9Sb3V0ZXJQb3J0O1xuIiwiLypqc2hpbnQgbm9kZTogdHJ1ZSovXG5cbi8qKlxuICogQGF1dGhvciBicm9sbGIgLyBodHRwczovL2dpdGh1Yi9icm9sbGJcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBkZWJ1ZyA9IHJlcXVpcmUoJ2RlYnVnJyksXG4gICAgQXJQb2ludCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Qb2ludCcpLFxuICAgIEFyU2l6ZSA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5TaXplJyksXG4gICAgTG9nZ2VyID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLkxvZ2dlcicpLFxuICAgIF9sb2dnZXIgPSBuZXcgTG9nZ2VyKCdBdXRvUm91dGVyLlJlY3QnKTtcblxudmFyIEFyUmVjdCA9IGZ1bmN0aW9uIChMZWZ0LCBDZWlsLCBSaWdodCwgRmxvb3IpIHtcbiAgICBpZiAoTGVmdCA9PT0gdW5kZWZpbmVkKSB7IC8vTm8gYXJndW1lbnRzXG4gICAgICAgIExlZnQgPSAwO1xuICAgICAgICBDZWlsID0gMDtcbiAgICAgICAgUmlnaHQgPSAwO1xuICAgICAgICBGbG9vciA9IDA7XG5cbiAgICB9IGVsc2UgaWYgKENlaWwgPT09IHVuZGVmaW5lZCAmJiBMZWZ0IGluc3RhbmNlb2YgQXJSZWN0KSB7IC8vIE9uZSBhcmd1bWVudFxuICAgICAgICAvLyBMZWZ0IGlzIGFuIEFyUmVjdFxuICAgICAgICBDZWlsID0gTGVmdC5jZWlsO1xuICAgICAgICBSaWdodCA9IExlZnQucmlnaHQ7XG4gICAgICAgIEZsb29yID0gTGVmdC5mbG9vcjtcbiAgICAgICAgTGVmdCA9IExlZnQubGVmdDtcblxuICAgIH0gZWxzZSBpZiAoUmlnaHQgPT09IHVuZGVmaW5lZCAmJiBMZWZ0IGluc3RhbmNlb2YgQXJQb2ludCkgeyAvLyBUd28gYXJndW1lbnRzXG4gICAgICAgIC8vIENyZWF0aW5nIEFyUmVjdCB3aXRoIEFyUG9pbnQgYW5kIGVpdGhlciBhbm90aGVyIEFyUG9pbnQgb3IgQXJTaXplXG4gICAgICAgIGlmIChDZWlsIGluc3RhbmNlb2YgQXJTaXplKSB7XG4gICAgICAgICAgICBSaWdodCA9IExlZnQueCArIENlaWwuY3g7XG4gICAgICAgICAgICBGbG9vciA9IExlZnQueSArIENlaWwuY3k7XG4gICAgICAgICAgICBDZWlsID0gTGVmdC55O1xuICAgICAgICAgICAgTGVmdCA9IExlZnQueDtcblxuICAgICAgICB9IGVsc2UgaWYgKExlZnQgaW5zdGFuY2VvZiBBclBvaW50ICYmIENlaWwgaW5zdGFuY2VvZiBBclBvaW50KSB7XG4gICAgICAgICAgICBSaWdodCA9IE1hdGgucm91bmQoQ2VpbC54KTtcbiAgICAgICAgICAgIEZsb29yID0gTWF0aC5yb3VuZChDZWlsLnkpO1xuICAgICAgICAgICAgQ2VpbCA9IE1hdGgucm91bmQoTGVmdC55KTtcbiAgICAgICAgICAgIExlZnQgPSBNYXRoLnJvdW5kKExlZnQueCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgQXJSZWN0IENvbnN0cnVjdG9yJyk7XG4gICAgICAgIH1cblxuICAgIH0gZWxzZSBpZiAoRmxvb3IgPT09IHVuZGVmaW5lZCkgeyAvLyBJbnZhbGlkXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBBclJlY3QgQ29uc3RydWN0b3InKTtcbiAgICB9XG5cbiAgICB0aGlzLmxlZnQgPSBNYXRoLnJvdW5kKExlZnQpO1xuICAgIHRoaXMuY2VpbCA9IE1hdGgucm91bmQoQ2VpbCk7XG4gICAgdGhpcy5mbG9vciA9IE1hdGgucm91bmQoRmxvb3IpO1xuICAgIHRoaXMucmlnaHQgPSBNYXRoLnJvdW5kKFJpZ2h0KTtcbn07XG5cbkFyUmVjdC5wcm90b3R5cGUuZ2V0Q2VudGVyID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB7J3gnOiAodGhpcy5sZWZ0ICsgdGhpcy5yaWdodCkgLyAyLCAneSc6ICh0aGlzLmNlaWwgKyB0aGlzLmZsb29yKSAvIDJ9O1xufTtcblxuQXJSZWN0LnByb3RvdHlwZS5nZXRXaWR0aCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gKHRoaXMucmlnaHQgLSB0aGlzLmxlZnQpO1xufTtcblxuQXJSZWN0LnByb3RvdHlwZS5nZXRIZWlnaHQgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuICh0aGlzLmZsb29yIC0gdGhpcy5jZWlsKTtcbn07XG5cbkFyUmVjdC5wcm90b3R5cGUuZ2V0U2l6ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gbmV3IEFyU2l6ZSh0aGlzLmdldFdpZHRoKCksIHRoaXMuZ2V0SGVpZ2h0KCkpO1xufTtcblxuQXJSZWN0LnByb3RvdHlwZS5nZXRUb3BMZWZ0ID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBuZXcgQXJQb2ludCh0aGlzLmxlZnQsIHRoaXMuY2VpbCk7XG59O1xuXG5BclJlY3QucHJvdG90eXBlLmdldEJvdHRvbVJpZ2h0ID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBuZXcgQXJQb2ludCh0aGlzLnJpZ2h0LCB0aGlzLmZsb29yKTtcbn07XG5cbkFyUmVjdC5wcm90b3R5cGUuZ2V0Q2VudGVyUG9pbnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIG5ldyBBclBvaW50KHRoaXMubGVmdCArIHRoaXMuZ2V0V2lkdGgoKSAvIDIsIHRoaXMuY2VpbCArIHRoaXMuZ2V0SGVpZ2h0KCkgLyAyKTtcbn07XG5cbkFyUmVjdC5wcm90b3R5cGUuaXNSZWN0RW1wdHkgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKCh0aGlzLmxlZnQgPj0gdGhpcy5yaWdodCkgJiYgKHRoaXMuY2VpbCA+PSB0aGlzLmZsb29yKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG59O1xuXG5cbkFyUmVjdC5wcm90b3R5cGUuaXNSZWN0TnVsbCA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodGhpcy5sZWZ0ID09PSAwICYmXG4gICAgICAgIHRoaXMucmlnaHQgPT09IDAgJiZcbiAgICAgICAgdGhpcy5jZWlsID09PSAwICYmXG4gICAgICAgIHRoaXMuZmxvb3IgPT09IDApIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xufTtcblxuQXJSZWN0LnByb3RvdHlwZS5wdEluUmVjdCA9IGZ1bmN0aW9uIChwdCkge1xuICAgIGlmIChwdCBpbnN0YW5jZW9mIEFycmF5KSB7XG4gICAgICAgIHB0ID0gcHRbMF07XG4gICAgfVxuXG4gICAgaWYgKHB0LnggPj0gdGhpcy5sZWZ0ICYmXG4gICAgICAgIHB0LnggPD0gdGhpcy5yaWdodCAmJlxuICAgICAgICBwdC55ID49IHRoaXMuY2VpbCAmJlxuICAgICAgICBwdC55IDw9IHRoaXMuZmxvb3IpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xufTtcblxuQXJSZWN0LnByb3RvdHlwZS5zZXRSZWN0ID0gZnVuY3Rpb24gKG5MZWZ0LCBuQ2VpbCwgblJpZ2h0LCBuRmxvb3IpIHtcbiAgICBpZiAobkNlaWwgPT09IHVuZGVmaW5lZCAmJiBuTGVmdCBpbnN0YW5jZW9mIEFyUmVjdCkgeyAvL1xuICAgICAgICB0aGlzLmFzc2lnbihuTGVmdCk7XG5cbiAgICB9IGVsc2UgaWYgKG5SaWdodCA9PT0gdW5kZWZpbmVkIHx8IG5GbG9vciA9PT0gdW5kZWZpbmVkKSB7IC8vaW52YWxpZFxuICAgICAgICBfbG9nZ2VyLmRlYnVnKCdJbnZhbGlkIGFyZ3MgZm9yIFtBclJlY3RdLnNldFJlY3QnKTtcblxuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMubGVmdCA9IG5MZWZ0O1xuICAgICAgICB0aGlzLmNlaWwgPSBuQ2VpbDtcbiAgICAgICAgdGhpcy5yaWdodCA9IG5SaWdodDtcbiAgICAgICAgdGhpcy5mbG9vciA9IG5GbG9vcjtcbiAgICB9XG5cbn07XG5cbkFyUmVjdC5wcm90b3R5cGUuc2V0UmVjdEVtcHR5ID0gZnVuY3Rpb24gKCkge1xuXG4gICAgdGhpcy5jZWlsID0gMDtcbiAgICB0aGlzLnJpZ2h0ID0gMDtcbiAgICB0aGlzLmZsb29yID0gMDtcbiAgICB0aGlzLmxlZnQgPSAwO1xufTtcblxuQXJSZWN0LnByb3RvdHlwZS5pbmZsYXRlUmVjdCA9IGZ1bmN0aW9uICh4LCB5KSB7XG4gICAgaWYgKHggIT09IHVuZGVmaW5lZCAmJiB4LmN4ICE9PSB1bmRlZmluZWQgJiYgeC5jeSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHkgPSB4LmN5O1xuICAgICAgICB4ID0geC5jeDtcbiAgICB9IGVsc2UgaWYgKHkgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICB5ID0geDtcbiAgICB9XG5cbiAgICB0aGlzLmxlZnQgLT0geDtcbiAgICB0aGlzLnJpZ2h0ICs9IHg7XG4gICAgdGhpcy5jZWlsIC09IHk7XG4gICAgdGhpcy5mbG9vciArPSB5O1xufTtcblxuQXJSZWN0LnByb3RvdHlwZS5kZWZsYXRlUmVjdCA9IGZ1bmN0aW9uICh4LCB5KSB7XG4gICAgaWYgKHggIT09IHVuZGVmaW5lZCAmJiB4LmN4ICE9PSB1bmRlZmluZWQgJiYgeC5jeSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHkgPSB4LmN5O1xuICAgICAgICB4ID0geC5jeDtcbiAgICB9XG5cbiAgICB0aGlzLmxlZnQgKz0geDtcbiAgICB0aGlzLnJpZ2h0IC09IHg7XG4gICAgdGhpcy5jZWlsICs9IHk7XG4gICAgdGhpcy5mbG9vciAtPSB5O1xufTtcblxuQXJSZWN0LnByb3RvdHlwZS5ub3JtYWxpemVSZWN0ID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciB0ZW1wO1xuXG4gICAgaWYgKHRoaXMubGVmdCA+IHRoaXMucmlnaHQpIHtcbiAgICAgICAgdGVtcCA9IHRoaXMubGVmdDtcbiAgICAgICAgdGhpcy5sZWZ0ID0gdGhpcy5yaWdodDtcbiAgICAgICAgdGhpcy5yaWdodCA9IHRlbXA7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuY2VpbCA+IHRoaXMuZmxvb3IpIHtcbiAgICAgICAgdGVtcCA9IHRoaXMuY2VpbDtcbiAgICAgICAgdGhpcy5jZWlsID0gdGhpcy5mbG9vcjtcbiAgICAgICAgdGhpcy5mbG9vciA9IHRlbXA7XG4gICAgfVxufTtcblxuQXJSZWN0LnByb3RvdHlwZS5hc3NpZ24gPSBmdW5jdGlvbiAocmVjdCkge1xuXG4gICAgdGhpcy5jZWlsID0gcmVjdC5jZWlsO1xuICAgIHRoaXMucmlnaHQgPSByZWN0LnJpZ2h0O1xuICAgIHRoaXMuZmxvb3IgPSByZWN0LmZsb29yO1xuICAgIHRoaXMubGVmdCA9IHJlY3QubGVmdDtcbn07XG5cbkFyUmVjdC5wcm90b3R5cGUuZXF1YWxzID0gZnVuY3Rpb24gKHJlY3QpIHtcbiAgICBpZiAodGhpcy5sZWZ0ID09PSByZWN0LmxlZnQgJiZcbiAgICAgICAgdGhpcy5yaWdodCA9PT0gcmVjdC5yaWdodCAmJlxuICAgICAgICB0aGlzLmNlaWwgPT09IHJlY3QuY2VpbCAmJlxuICAgICAgICB0aGlzLmZsb29yID09PSByZWN0LmZsb29yKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcblxufTtcblxuQXJSZWN0LnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiAoQXJPYmplY3QpIHtcbiAgICB2YXIgZHgsXG4gICAgICAgIGR5O1xuICAgIGlmIChBck9iamVjdCBpbnN0YW5jZW9mIEFyUG9pbnQpIHtcbiAgICAgICAgZHggPSBBck9iamVjdC54O1xuICAgICAgICBkeSA9IEFyT2JqZWN0Lnk7XG5cbiAgICB9IGVsc2UgaWYgKEFyT2JqZWN0LmN4ICE9PSB1bmRlZmluZWQgJiYgQXJPYmplY3QuY3kgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBkeCA9IEFyT2JqZWN0LmN4O1xuICAgICAgICBkeSA9IEFyT2JqZWN0LmN5O1xuXG4gICAgfSBlbHNlIHtcbiAgICAgICAgX2xvZ2dlci5kZWJ1ZygnSW52YWxpZCBhcmcgZm9yIFtBclJlY3RdLmFkZCBtZXRob2QnKTtcbiAgICB9XG5cbiAgICB0aGlzLmxlZnQgKz0gZHg7XG4gICAgdGhpcy5yaWdodCArPSBkeDtcbiAgICB0aGlzLmNlaWwgKz0gZHk7XG4gICAgdGhpcy5mbG9vciArPSBkeTtcbn07XG5cbkFyUmVjdC5wcm90b3R5cGUuc3VidHJhY3QgPSBmdW5jdGlvbiAoQXJPYmplY3QpIHtcbiAgICBpZiAoQXJPYmplY3QgaW5zdGFuY2VvZiBBclBvaW50KSB7XG4gICAgICAgIHRoaXMuZGVmbGF0ZVJlY3QoQXJPYmplY3QueCwgQXJPYmplY3QueSk7XG5cbiAgICB9IGVsc2UgaWYgKEFyT2JqZWN0IGluc3RhbmNlb2YgQXJTaXplKSB7XG4gICAgICAgIHRoaXMuZGVmbGF0ZVJlY3QoQXJPYmplY3QpO1xuXG4gICAgfSBlbHNlIGlmIChBck9iamVjdCBpbnN0YW5jZW9mIEFyUmVjdCkge1xuICAgICAgICB0aGlzLmxlZnQgKz0gQXJPYmplY3QubGVmdDtcbiAgICAgICAgdGhpcy5yaWdodCAtPSBBck9iamVjdC5yaWdodDtcbiAgICAgICAgdGhpcy5jZWlsICs9IEFyT2JqZWN0LmNlaWw7XG4gICAgICAgIHRoaXMuZmxvb3IgLT0gQXJPYmplY3QuZmxvb3I7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgICBfbG9nZ2VyLmRlYnVnKCdJbnZhbGlkIGFyZyBmb3IgW0FyUmVjdF0uc3VidHJhY3QgbWV0aG9kJyk7XG4gICAgfVxufTtcblxuQXJSZWN0LnByb3RvdHlwZS5wbHVzID0gZnVuY3Rpb24gKEFyT2JqZWN0KSB7XG4gICAgdmFyIHJlc09iamVjdCA9IG5ldyBBclJlY3QodGhpcyk7XG4gICAgcmVzT2JqZWN0LmFkZChBck9iamVjdCk7XG5cbiAgICByZXR1cm4gcmVzT2JqZWN0O1xufTtcblxuQXJSZWN0LnByb3RvdHlwZS5taW51cyA9IGZ1bmN0aW9uIChBck9iamVjdCkge1xuICAgIHZhciByZXNPYmplY3QgPSBuZXcgQXJSZWN0KHRoaXMpO1xuICAgIHJlc09iamVjdC5zdWJ0cmFjdChBck9iamVjdCk7XG5cbiAgICByZXR1cm4gcmVzT2JqZWN0O1xufTtcblxuQXJSZWN0LnByb3RvdHlwZS51bmlvbkFzc2lnbiA9IGZ1bmN0aW9uIChyZWN0KSB7XG4gICAgaWYgKHJlY3QuaXNSZWN0RW1wdHkoKSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmICh0aGlzLmlzUmVjdEVtcHR5KCkpIHtcbiAgICAgICAgdGhpcy5hc3NpZ24ocmVjdCk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvL1Rha2UgdGhlIG91dGVybW9zdCBkaW1lbnNpb25cbiAgICB0aGlzLmxlZnQgPSBNYXRoLm1pbih0aGlzLmxlZnQsIHJlY3QubGVmdCk7XG4gICAgdGhpcy5yaWdodCA9IE1hdGgubWF4KHRoaXMucmlnaHQsIHJlY3QucmlnaHQpO1xuICAgIHRoaXMuY2VpbCA9IE1hdGgubWluKHRoaXMuY2VpbCwgcmVjdC5jZWlsKTtcbiAgICB0aGlzLmZsb29yID0gTWF0aC5tYXgodGhpcy5mbG9vciwgcmVjdC5mbG9vcik7XG5cbn07XG5cbkFyUmVjdC5wcm90b3R5cGUudW5pb24gPSBmdW5jdGlvbiAocmVjdCkge1xuICAgIHZhciByZXNSZWN0ID0gbmV3IEFyUmVjdCh0aGlzKTtcbiAgICByZXNSZWN0LnVuaW9uQXNzaWduKHJlY3QpO1xuXG4gICAgcmV0dXJuIHJlc1JlY3Q7XG59O1xuXG5BclJlY3QucHJvdG90eXBlLmludGVyc2VjdEFzc2lnbiA9IGZ1bmN0aW9uIChyZWN0MSwgcmVjdDIpIHtcbiAgICByZWN0MiA9IHJlY3QyID8gcmVjdDIgOiB0aGlzO1xuICAgIC8vU2V0cyB0aGlzIHJlY3QgdG8gdGhlIGludGVyc2VjdGlvbiByZWN0XG4gICAgdGhpcy5sZWZ0ID0gTWF0aC5tYXgocmVjdDEubGVmdCwgcmVjdDIubGVmdCk7XG4gICAgdGhpcy5yaWdodCA9IE1hdGgubWluKHJlY3QxLnJpZ2h0LCByZWN0Mi5yaWdodCk7XG4gICAgdGhpcy5jZWlsID0gTWF0aC5tYXgocmVjdDEuY2VpbCwgcmVjdDIuY2VpbCk7XG4gICAgdGhpcy5mbG9vciA9IE1hdGgubWluKHJlY3QxLmZsb29yLCByZWN0Mi5mbG9vcik7XG5cbiAgICBpZiAodGhpcy5sZWZ0ID49IHRoaXMucmlnaHQgfHwgdGhpcy5jZWlsID49IHRoaXMuZmxvb3IpIHtcbiAgICAgICAgdGhpcy5zZXRSZWN0RW1wdHkoKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xufTtcblxuQXJSZWN0LnByb3RvdHlwZS5pbnRlcnNlY3QgPSBmdW5jdGlvbiAocmVjdCkge1xuICAgIHZhciByZXNSZWN0ID0gbmV3IEFyUmVjdCh0aGlzKTtcblxuICAgIHJlc1JlY3QuaW50ZXJzZWN0QXNzaWduKHJlY3QpO1xuICAgIHJldHVybiByZXNSZWN0O1xufTtcblxuQXJSZWN0LnByb3RvdHlwZS50b3VjaGluZyA9IGZ1bmN0aW9uIChyZWN0KSB7XG4gICAgLy9PbmUgcGl4ZWwgaXMgYWRkZWQgdG8gdGhlIG1pbmltdW1zIHNvLCBpZiB0aGV5IGFyZSBub3QgZGVlbWVkIHRvIGJlIHRvdWNoaW5nXG4gICAgLy90aGVyZSBpcyBndWFyYW50ZWVkIHRvIGJlIGF0IGxlYXNlIGEgb25lIHBpeGVsIHBhdGggYmV0d2VlbiB0aGVtXG4gICAgcmV0dXJuIE1hdGgubWF4KHJlY3QubGVmdCwgdGhpcy5sZWZ0KSA8PSBNYXRoLm1pbihyZWN0LnJpZ2h0LCB0aGlzLnJpZ2h0KSArIDEgJiZcbiAgICAgICAgTWF0aC5tYXgocmVjdC5jZWlsLCB0aGlzLmNlaWwpIDw9IE1hdGgubWluKHJlY3QuZmxvb3IsIHRoaXMuZmxvb3IpICsgMTtcbn07XG5cbi8qKlxuICogUmV0dXJucyB0cnVlIGlmIHRoZSBnaXZlbiBwb2ludCBpcyBvbiBvbmUgb2YgdGhlIGNvcm5lcnMgb2YgdGhlIHJlY3RhbmdsZS5cbiAqXG4gKiBAcGFyYW0gcG9pbnRcbiAqIEByZXR1cm4ge3VuZGVmaW5lZH1cbiAqL1xuQXJSZWN0LnByb3RvdHlwZS5vbkNvcm5lciA9IGZ1bmN0aW9uIChwb2ludCkge1xuICAgIHZhciBvbkhvcml6b250YWxTaWRlLFxuICAgICAgICBvblZlcnRpY2FsU2lkZTtcblxuICAgIG9uSG9yaXpvbnRhbFNpZGUgPSBwb2ludC54ID09PSB0aGlzLmxlZnQgfHwgcG9pbnQueCA9PT0gdGhpcy5yaWdodDtcbiAgICBvblZlcnRpY2FsU2lkZSA9IHBvaW50LnkgPT09IHRoaXMuY2VpbCB8fCBwb2ludC55ID09PSB0aGlzLmZsb29yO1xuXG4gICAgcmV0dXJuIG9uSG9yaXpvbnRhbFNpZGUgJiYgb25WZXJ0aWNhbFNpZGU7XG59O1xuXG5BclJlY3QucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmdldFRvcExlZnQoKS50b1N0cmluZygpICsgJyAnICsgdGhpcy5nZXRCb3R0b21SaWdodCgpLnRvU3RyaW5nKCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEFyUmVjdDtcbiIsIi8qanNoaW50IG5vZGU6IHRydWUqL1xuXG4vKipcbiAqIEBhdXRob3IgYnJvbGxiIC8gaHR0cHM6Ly9naXRodWIvYnJvbGxiXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgQXJTaXplID0gZnVuY3Rpb24gKHgsIHkpIHtcbiAgICAvL011bHRpcGxlIENvbnN0cnVjdG9yc1xuICAgIGlmICh4ID09PSB1bmRlZmluZWQpIHsgLy9ObyBhcmd1bWVudHMgd2VyZSBwYXNzZWQgdG8gY29uc3RydWN0b3JcbiAgICAgICAgeCA9IDA7XG4gICAgICAgIHkgPSAwO1xuICAgIH0gZWxzZSBpZiAoeSA9PT0gdW5kZWZpbmVkKSB7IC8vT25lIGFyZ3VtZW50IHBhc3NlZCB0byBjb25zdHJ1Y3RvclxuICAgICAgICB5ID0geC5jeTtcbiAgICAgICAgeCA9IHguY3g7XG4gICAgfVxuXG4gICAgdGhpcy5jeCA9IHg7XG4gICAgdGhpcy5jeSA9IHk7XG59O1xuXG5BclNpemUucHJvdG90eXBlLmVxdWFscyA9IGZ1bmN0aW9uIChvdGhlclNpemUpIHtcbiAgICBpZiAodGhpcy5jeCA9PT0gb3RoZXJTaXplLmN4ICYmIHRoaXMuY3kgPT09IG90aGVyU2l6ZS5jeSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG59O1xuXG5BclNpemUucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uIChvdGhlclNpemUpIHsgLy9lcXVpdmFsZW50IHRvICs9XG4gICAgaWYgKG90aGVyU2l6ZS5jeCB8fCBvdGhlclNpemUuY3kpIHtcbiAgICAgICAgdGhpcy5jeCArPSBvdGhlclNpemUuY3g7XG4gICAgICAgIHRoaXMuY3kgKz0gb3RoZXJTaXplLmN5O1xuICAgIH1cbiAgICBpZiAob3RoZXJTaXplLnggfHwgb3RoZXJTaXplLnkpIHtcbiAgICAgICAgdGhpcy5jeCArPSBvdGhlclNpemUueDtcbiAgICAgICAgdGhpcy5jeSArPSBvdGhlclNpemUueTtcbiAgICB9XG59O1xuXG5BclNpemUucHJvdG90eXBlLmdldEFycmF5ID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciByZXMgPSBbXTtcbiAgICByZXMucHVzaCh0aGlzLmN4KTtcbiAgICByZXMucHVzaCh0aGlzLmN5KTtcbiAgICByZXR1cm4gcmVzO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBclNpemU7XG4iLCIvKmpzaGludCBub2RlOiB0cnVlKi9cblxuLyoqXG4gKiBAYXV0aG9yIGJyb2xsYiAvIGh0dHBzOi8vZ2l0aHViL2Jyb2xsYlxuICovXG5cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgQ09OU1RBTlRTID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLkNvbnN0YW50cycpLFxuICAgIGFzc2VydCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5VdGlscycpLmFzc2VydCxcbiAgICBBclJlY3QgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUmVjdCcpLFxuICAgIEFyUG9pbnQgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUG9pbnQnKTtcblxudmFyIF9nZXRPcHRpbWFsUG9ydHMgPSBmdW5jdGlvbiAocG9ydHMsIHRndCkge1xuICAgIC8vSSB3aWxsIGdldCB0aGUgZHgsIGR5IHRoYXQgdG8gdGhlIHNyYy9kc3QgdGFyZ2V0IGFuZCB0aGVuIEkgd2lsbCBjYWxjdWxhdGVcbiAgICAvLyBhIHByaW9yaXR5IHZhbHVlIHRoYXQgd2lsbCByYXRlIHRoZSBwb3J0cyBhcyBjYW5kaWRhdGVzIGZvciB0aGUgXG4gICAgLy9naXZlbiBwYXRoXG4gICAgdmFyIHNyY0MgPSBuZXcgQXJQb2ludCgpLCAvL3NyYyBjZW50ZXJcbiAgICAgICAgdmVjdG9yLFxuICAgICAgICBwb3J0LCAvL3Jlc3VsdFxuICAgICAgICBtYXhQID0gLUluZmluaXR5LFxuICAgICAgICBtYXhBcmVhID0gMCxcbiAgICAgICAgc1BvaW50LFxuICAgICAgICBpO1xuXG4gICAgLy9HZXQgdGhlIGNlbnRlciBwb2ludHMgb2YgdGhlIHNyYyxkc3QgcG9ydHNcbiAgICBmb3IgKGkgPSAwOyBpIDwgcG9ydHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgc1BvaW50ID0gcG9ydHNbaV0ucmVjdC5nZXRDZW50ZXIoKTtcbiAgICAgICAgc3JjQy54ICs9IHNQb2ludC54O1xuICAgICAgICBzcmNDLnkgKz0gc1BvaW50Lnk7XG5cbiAgICAgICAgLy9hZGp1c3QgbWF4QXJlYVxuICAgICAgICBpZiAobWF4QXJlYSA8IHBvcnRzW2ldLmdldFRvdGFsQXZhaWxhYmxlQXJlYSgpKSB7XG4gICAgICAgICAgICBtYXhBcmVhID0gcG9ydHNbaV0uZ2V0VG90YWxBdmFpbGFibGVBcmVhKCk7XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIC8vR2V0IHRoZSBhdmVyYWdlIGNlbnRlciBwb2ludCBvZiBzcmNcbiAgICBzcmNDLnggPSBzcmNDLnggLyBwb3J0cy5sZW5ndGg7XG4gICAgc3JjQy55ID0gc3JjQy55IC8gcG9ydHMubGVuZ3RoO1xuXG4gICAgLy9HZXQgdGhlIGRpcmVjdGlvbnNcbiAgICB2ZWN0b3IgPSAodGd0Lm1pbnVzKHNyY0MpLmdldEFycmF5KCkpO1xuXG4gICAgLy9DcmVhdGUgcHJpb3JpdHkgZnVuY3Rpb25cbiAgICBmdW5jdGlvbiBjcmVhdGVQcmlvcml0eShwb3J0LCBjZW50ZXIpIHtcbiAgICAgICAgdmFyIHByaW9yaXR5ID0gMCxcbiAgICAgICAgLy9wb2ludCA9IFsgIGNlbnRlci54IC0gcG9ydC5yZWN0LmdldENlbnRlcigpLngsIGNlbnRlci55IC0gcG9ydC5yZWN0LmdldENlbnRlcigpLnldLFxuICAgICAgICAgICAgcG9pbnQgPSBbcG9ydC5yZWN0LmdldENlbnRlcigpLnggLSBjZW50ZXIueCwgcG9ydC5yZWN0LmdldENlbnRlcigpLnkgLSBjZW50ZXIueV0sXG4gICAgICAgICAgICBsaW5lQ291bnQgPSAocG9ydC5nZXRQb2ludENvdW50KCkgfHwgMSksXG4gICAgICAgICAgICAvL0lmIHRoZXJlIGlzIGEgcHJvYmxlbSB3aXRoIG1heEFyZWEsIGp1c3QgaWdub3JlIGRlbnNpdHlcbiAgICAgICAgICAgIGRlbnNpdHkgPSAocG9ydC5nZXRUb3RhbEF2YWlsYWJsZUFyZWEoKSAvIGxpbmVDb3VudCkgLyBtYXhBcmVhIHx8IDEsXG4gICAgICAgICAgICBtYWpvciA9IE1hdGguYWJzKHZlY3RvclswXSkgPiBNYXRoLmFicyh2ZWN0b3JbMV0pID8gMCA6IDEsXG4gICAgICAgICAgICBtaW5vciA9IChtYWpvciArIDEpICUgMjtcblxuICAgICAgICBpZiAocG9pbnRbbWFqb3JdID4gMCA9PT0gdmVjdG9yW21ham9yXSA+IDAgJiYgKHBvaW50W21ham9yXSA9PT0gMCkgPT09ICh2ZWN0b3JbbWFqb3JdID09PSAwKSkge1xuICAgICAgICAgICAgLy9oYW5kbGluZyB0aGUgPT09IDAgZXJyb3JcbiAgICAgICAgICAgIC8vSWYgdGhleSBoYXZlIHRoZSBzYW1lIHBhcml0eSwgYXNzaWduIHRoZSBwcmlvcml0eSB0byBtYXhpbWl6ZSB0aGF0IGlzID4gMVxuICAgICAgICAgICAgcHJpb3JpdHkgPSAoTWF0aC5hYnModmVjdG9yW21ham9yXSkgLyBNYXRoLmFicyh2ZWN0b3JbbWFqb3JdIC0gcG9pbnRbbWFqb3JdKSkgKiAyNTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChwb2ludFttaW5vcl0gPiAwID09PSB2ZWN0b3JbbWlub3JdID4gMCAmJiAocG9pbnRbbWlub3JdID09PSAwKSA9PT0gKHZlY3RvclttaW5vcl0gPT09IDApKSB7XG4gICAgICAgICAgICAvL2hhbmRsaW5nIHRoZSA9PT0gMCBlcnJvclxuICAgICAgICAgICAgLy9JZiB0aGV5IGhhdmUgdGhlIHNhbWUgcGFyaXR5LCBhc3NpZ24gdGhlIHByaW9yaXR5IHRvIG1heGltaXplIHRoYXQgaXMgPCAxXG4gICAgICAgICAgICBwcmlvcml0eSArPSB2ZWN0b3JbbWlub3JdICE9PSBwb2ludFttaW5vcl0gP1xuICAgICAgICAgICAgKE1hdGguYWJzKHZlY3RvclttaW5vcl0pIC8gTWF0aC5hYnModmVjdG9yW21pbm9yXSAtIHBvaW50W21pbm9yXSkpICogMSA6IDA7XG4gICAgICAgIH1cblxuICAgICAgICAvL0FkanVzdCBwcmlvcml0eSBiYXNlZCBvbiB0aGUgZGVuc2l0eSBvZiB0aGUgbGluZXMuLi5cbiAgICAgICAgcHJpb3JpdHkgKj0gZGVuc2l0eTtcblxuICAgICAgICByZXR1cm4gcHJpb3JpdHk7XG4gICAgfVxuXG4gICAgLy9DcmVhdGUgcHJpb3JpdHkgdmFsdWVzIGZvciBlYWNoIHBvcnQuXG4gICAgdmFyIHByaW9yaXR5O1xuICAgIGZvciAoaSA9IDA7IGkgPCBwb3J0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBwcmlvcml0eSA9IGNyZWF0ZVByaW9yaXR5KHBvcnRzW2ldLCBzcmNDKSB8fCAwO1xuICAgICAgICBpZiAocHJpb3JpdHkgPj0gbWF4UCkge1xuICAgICAgICAgICAgcG9ydCA9IHBvcnRzW2ldO1xuICAgICAgICAgICAgbWF4UCA9IHByaW9yaXR5O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXNzZXJ0KHBvcnQub3duZXIsICdBUkdyYXBoLmdldE9wdGltYWxQb3J0czogcG9ydCBoYXMgaW52YWxpZCBvd25lcicpO1xuXG4gICAgcmV0dXJuIHBvcnQ7XG59O1xuXG52YXIgX2dldFBvaW50Q29vcmQgPSBmdW5jdGlvbiAocG9pbnQsIGhvckRpcikge1xuICAgIGlmIChob3JEaXIgPT09IHRydWUgfHwgX2lzSG9yaXpvbnRhbChob3JEaXIpKSB7XG4gICAgICAgIHJldHVybiBwb2ludC54O1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBwb2ludC55O1xuICAgIH1cbn07XG5cbnZhciBfaW5mbGF0ZWRSZWN0ID0gZnVuY3Rpb24gKHJlY3QsIGEpIHtcbiAgICB2YXIgciA9IHJlY3Q7XG4gICAgci5pbmZsYXRlUmVjdChhLCBhKTtcbiAgICByZXR1cm4gcjtcbn07XG5cbnZhciBfaXNQb2ludE5lYXIgPSBmdW5jdGlvbiAocDEsIHAyLCBuZWFybmVzcykge1xuICAgIHJldHVybiBwMi54IC0gbmVhcm5lc3MgPD0gcDEueCAmJiBwMS54IDw9IHAyLnggKyBuZWFybmVzcyAmJlxuICAgICAgICBwMi55IC0gbmVhcm5lc3MgPD0gcDEueSAmJiBwMS55IDw9IHAyLnkgKyBuZWFybmVzcztcbn07XG5cbnZhciBfaXNQb2ludEluID0gZnVuY3Rpb24gKHBvaW50LCByZWN0LCBuZWFybmVzcykge1xuICAgIHZhciB0bXBSID0gbmV3IEFyUmVjdChyZWN0KTtcbiAgICB0bXBSLmluZmxhdGVSZWN0KG5lYXJuZXNzLCBuZWFybmVzcyk7XG4gICAgcmV0dXJuIHRtcFIucHRJblJlY3QocG9pbnQpID09PSB0cnVlO1xufTtcblxudmFyIF9pc1JlY3RJbiA9IGZ1bmN0aW9uIChyMSwgcjIpIHtcbiAgICByZXR1cm4gcjIubGVmdCA8PSByMS5sZWZ0ICYmIHIxLnJpZ2h0IDw9IHIyLnJpZ2h0ICYmXG4gICAgICAgIHIyLmNlaWwgPD0gcjEuY2VpbCAmJiByMS5mbG9vciA8PSByMi5mbG9vcjtcbn07XG5cbnZhciBfaXNSZWN0Q2xpcCA9IGZ1bmN0aW9uIChyMSwgcjIpIHtcbiAgICB2YXIgcmVjdCA9IG5ldyBBclJlY3QoKTtcbiAgICByZXR1cm4gcmVjdC5pbnRlcnNlY3RBc3NpZ24ocjEsIHIyKSA9PT0gdHJ1ZTtcbn07XG5cbnZhciBfZGlzdGFuY2VGcm9tSExpbmUgPSBmdW5jdGlvbiAocCwgeDEsIHgyLCB5KSB7XG4gICAgYXNzZXJ0KHgxIDw9IHgyLCAnQXJIZWxwZXIuZGlzdGFuY2VGcm9tSExpbmU6IHgxIDw9IHgyIEZBSUxFRCcpO1xuXG4gICAgcmV0dXJuIE1hdGgubWF4KE1hdGguYWJzKHAueSAtIHkpLCBNYXRoLm1heCh4MSAtIHAueCwgcC54IC0geDIpKTtcbn07XG5cbnZhciBfZGlzdGFuY2VGcm9tVkxpbmUgPSBmdW5jdGlvbiAocCwgeTEsIHkyLCB4KSB7XG4gICAgYXNzZXJ0KHkxIDw9IHkyLCAnQXJIZWxwZXIuZGlzdGFuY2VGcm9tVkxpbmU6IHkxIDw9IHkyIEZBSUxFRCcpO1xuXG4gICAgcmV0dXJuIE1hdGgubWF4KE1hdGguYWJzKHAueCAtIHgpLCBNYXRoLm1heCh5MSAtIHAueSwgcC55IC0geTIpKTtcbn07XG5cbnZhciBfZGlzdGFuY2VGcm9tTGluZSA9IGZ1bmN0aW9uIChwdCwgc3RhcnQsIGVuZCkge1xuICAgIHZhciBkaXIgPSBfZ2V0RGlyKGVuZC5taW51cyhzdGFydCkpO1xuXG4gICAgaWYgKF9pc0hvcml6b250YWwoZGlyKSkge1xuICAgICAgICByZXR1cm4gX2Rpc3RhbmNlRnJvbVZMaW5lKHB0LCBzdGFydC55LCBlbmQueSwgc3RhcnQueCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIF9kaXN0YW5jZUZyb21ITGluZShwdCwgc3RhcnQueCwgZW5kLngsIHN0YXJ0LnkpO1xuICAgIH1cbn07XG5cbnZhciBfaXNPbkVkZ2UgPSBmdW5jdGlvbiAoc3RhcnQsIGVuZCwgcHQpIHtcbiAgICBpZiAoc3RhcnQueCA9PT0gZW5kLngpIHtcdFx0XHQvLyB2ZXJ0aWNhbCBlZGdlLCBob3Jpem9udGFsIG1vdmVcbiAgICAgICAgaWYgKGVuZC54ID09PSBwdC54ICYmIHB0LnkgPD0gTWF0aC5tYXgoZW5kLnksIHN0YXJ0LnkpICYmIHB0LnkgPj0gTWF0aC5taW4oZW5kLnksIHN0YXJ0LnkpKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoc3RhcnQueSA9PT0gZW5kLnkpIHtcdC8vIGhvcml6b250YWwgbGluZSwgdmVydGljYWwgbW92ZVxuICAgICAgICBpZiAoc3RhcnQueSA9PT0gcHQueSAmJiBwdC54IDw9IE1hdGgubWF4KGVuZC54LCBzdGFydC54KSAmJiBwdC54ID49IE1hdGgubWluKGVuZC54LCBzdGFydC54KSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG59O1xuXG52YXIgX2lzUG9pbnROZWFyTGluZSA9IGZ1bmN0aW9uIChwb2ludCwgc3RhcnQsIGVuZCwgbmVhcm5lc3MpIHtcbiAgICBhc3NlcnQoMCA8PSBuZWFybmVzcywgJ0FySGVscGVyLmlzUG9pbnROZWFyTGluZTogMCA8PSBuZWFybmVzcyBGQUlMRUQnKTtcblxuICAgIC8vIGJlZ2luIFpvbG1vbFxuICAgIC8vIHRoZSByb3V0aW5nIG1heSBjcmVhdGUgZWRnZXMgdGhhdCBoYXZlIHN0YXJ0PT1lbmRcbiAgICAvLyB0aHVzIGNvbmZ1c2luZyB0aGlzIGFsZ29yaXRobVxuICAgIGlmIChlbmQueCA9PT0gc3RhcnQueCAmJiBlbmQueSA9PT0gc3RhcnQueSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIC8vIGVuZCBab2xtb2xcblxuICAgIHZhciBwb2ludDIgPSBwb2ludDtcblxuICAgIHBvaW50Mi5zdWJ0cmFjdChzdGFydCk7XG5cbiAgICB2YXIgZW5kMiA9IGVuZDtcbiAgICBlbmQyLnN1YnRyYWN0KHN0YXJ0KTtcblxuICAgIHZhciB4ID0gZW5kMi54LFxuICAgICAgICB5ID0gZW5kMi55LFxuICAgICAgICB1ID0gcG9pbnQyLngsXG4gICAgICAgIHYgPSBwb2ludDIueSxcbiAgICAgICAgeHV5diA9IHggKiB1ICsgeSAqIHYsXG4gICAgICAgIHgyeTIgPSB4ICogeCArIHkgKiB5O1xuXG4gICAgaWYgKHh1eXYgPCAwIHx8IHh1eXYgPiB4MnkyKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB2YXIgZXhwcjEgPSAoeCAqIHYgLSB5ICogdSk7XG4gICAgZXhwcjEgKj0gZXhwcjE7XG4gICAgdmFyIGV4cHIyID0gbmVhcm5lc3MgKiBuZWFybmVzcyAqIHgyeTI7XG5cbiAgICByZXR1cm4gZXhwcjEgPD0gZXhwcjI7XG59O1xuXG52YXIgX2lzTGluZU1lZXRITGluZSA9IGZ1bmN0aW9uIChzdGFydCwgZW5kLCB4MSwgeDIsIHkpIHtcbiAgICBhc3NlcnQoeDEgPD0geDIsICdBckhlbHBlci5pc0xpbmVNZWV0SExpbmU6IHgxIDw9IHgyIEZBSUxFRCcpO1xuICAgIGlmIChzdGFydCBpbnN0YW5jZW9mIEFycmF5KSB7Ly9Db252ZXJ0aW5nIGZyb20gJ3BvaW50ZXInXG4gICAgICAgIHN0YXJ0ID0gc3RhcnRbMF07XG4gICAgfVxuICAgIGlmIChlbmQgaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgICBlbmQgPSBlbmRbMF07XG4gICAgfVxuXG4gICAgaWYgKCEoKHN0YXJ0LnkgPD0geSAmJiB5IDw9IGVuZC55KSB8fCAoZW5kLnkgPD0geSAmJiB5IDw9IHN0YXJ0LnkgKSkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHZhciBlbmQyID0gbmV3IEFyUG9pbnQoZW5kKTtcbiAgICBlbmQyLnN1YnRyYWN0KHN0YXJ0KTtcbiAgICB4MSAtPSBzdGFydC54O1xuICAgIHgyIC09IHN0YXJ0Lng7XG4gICAgeSAtPSBzdGFydC55O1xuXG4gICAgaWYgKGVuZDIueSA9PT0gMCkge1xuICAgICAgICByZXR1cm4geSA9PT0gMCAmJiAoKCB4MSA8PSAwICYmIDAgPD0geDIgKSB8fCAoeDEgPD0gZW5kMi54ICYmIGVuZDIueCA8PSB4MikpO1xuICAgIH1cblxuICAgIHZhciB4ID0gKChlbmQyLngpIC8gZW5kMi55KSAqIHk7XG4gICAgcmV0dXJuIHgxIDw9IHggJiYgeCA8PSB4Mjtcbn07XG5cbnZhciBfaXNMaW5lTWVldFZMaW5lID0gZnVuY3Rpb24gKHN0YXJ0LCBlbmQsIHkxLCB5MiwgeCkge1xuICAgIGFzc2VydCh5MSA8PSB5MiwgJ0FySGVscGVyLmlzTGluZU1lZXRWTGluZTogeTEgPD0geTIgIEZBSUxFRCcpO1xuICAgIGlmIChzdGFydCBpbnN0YW5jZW9mIEFycmF5KSB7Ly9Db252ZXJ0aW5nIGZyb20gJ3BvaW50ZXInXG4gICAgICAgIHN0YXJ0ID0gc3RhcnRbMF07XG4gICAgfVxuICAgIGlmIChlbmQgaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgICBlbmQgPSBlbmRbMF07XG4gICAgfVxuXG4gICAgaWYgKCEoKHN0YXJ0LnggPD0geCAmJiB4IDw9IGVuZC54KSB8fCAoZW5kLnggPD0geCAmJiB4IDw9IHN0YXJ0LnggKSkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHZhciBlbmQyID0gbmV3IEFyUG9pbnQoZW5kKTtcbiAgICBlbmQyLnN1YnRyYWN0KHN0YXJ0KTtcbiAgICB5MSAtPSBzdGFydC55O1xuICAgIHkyIC09IHN0YXJ0Lnk7XG4gICAgeCAtPSBzdGFydC54O1xuXG4gICAgaWYgKGVuZDIueCA9PT0gMCkge1xuICAgICAgICByZXR1cm4geCA9PT0gMCAmJiAoKCB5MSA8PSAwICYmIDAgPD0geTIgKSB8fCAoeTEgPD0gZW5kMi55ICYmIGVuZDIueSA8PSB5MikpO1xuICAgIH1cblxuICAgIHZhciB5ID0gKChlbmQyLnkpIC8gZW5kMi54KSAqIHg7XG4gICAgcmV0dXJuIHkxIDw9IHkgJiYgeSA8PSB5Mjtcbn07XG5cbnZhciBfaXNMaW5lQ2xpcFJlY3RzID0gZnVuY3Rpb24gKHN0YXJ0LCBlbmQsIHJlY3RzKSB7XG4gICAgdmFyIGkgPSByZWN0cy5sZW5ndGg7XG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgICBpZiAoX2lzTGluZUNsaXBSZWN0KHN0YXJ0LCBlbmQsIHJlY3RzW2ldKSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xufTtcblxudmFyIF9pc0xpbmVDbGlwUmVjdCA9IGZ1bmN0aW9uIChzdGFydCwgZW5kLCByZWN0KSB7XG4gICAgaWYgKHJlY3QucHRJblJlY3Qoc3RhcnQpIHx8IHJlY3QucHRJblJlY3QoZW5kKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gX2lzTGluZU1lZXRITGluZShzdGFydCwgZW5kLCByZWN0LmxlZnQsIHJlY3QucmlnaHQsIHJlY3QuY2VpbCkgfHxcbiAgICAgICAgX2lzTGluZU1lZXRITGluZShzdGFydCwgZW5kLCByZWN0LmxlZnQsIHJlY3QucmlnaHQsIHJlY3QuZmxvb3IpIHx8XG4gICAgICAgIF9pc0xpbmVNZWV0VkxpbmUoc3RhcnQsIGVuZCwgcmVjdC5jZWlsLCByZWN0LmZsb29yLCByZWN0LmxlZnQpIHx8XG4gICAgICAgIF9pc0xpbmVNZWV0VkxpbmUoc3RhcnQsIGVuZCwgcmVjdC5jZWlsLCByZWN0LmZsb29yLCByZWN0LnJpZ2h0KTtcbn07XG5cbnZhciBfZ2V0TGluZUNsaXBSZWN0SW50ZXJzZWN0ID0gZnVuY3Rpb24gKHN0YXJ0LCBlbmQsIHJlY3QpIHtcbiAgICAvL3JldHVybiB0aGUgZW5kcG9pbnRzIG9mIHRoZSBpbnRlcnNlY3Rpb24gbGluZVxuICAgIHZhciBkaXIgPSBfZ2V0RGlyKGVuZC5taW51cyhzdGFydCkpLFxuICAgICAgICBlbmRwb2ludHMgPSBbbmV3IEFyUG9pbnQoc3RhcnQpLCBuZXcgQXJQb2ludChlbmQpXTtcblxuICAgIGlmICghX2lzTGluZUNsaXBSZWN0KHN0YXJ0LCBlbmQsIHJlY3QpKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGFzc2VydChfaXNSaWdodEFuZ2xlKGRpciksICdBckhlbHBlci5nZXRMaW5lQ2xpcFJlY3RJbnRlcnNlY3Q6IF9pc1JpZ2h0QW5nbGUoZGlyKSBGQUlMRUQnKTtcblxuICAgIC8vTWFrZSBzdXJlIHdlIGFyZSB3b3JraW5nIGxlZnQgdG8gcmlnaHQgb3IgdG9wIGRvd25cbiAgICBpZiAoZGlyID09PSBDT05TVEFOVFMuRGlyTGVmdCB8fCBkaXIgPT09IENPTlNUQU5UUy5EaXJUb3ApIHtcbiAgICAgICAgZGlyID0gX3JldmVyc2VEaXIoZGlyKTtcbiAgICAgICAgZW5kcG9pbnRzLnB1c2goZW5kcG9pbnRzLnNwbGljZSgwLCAxKVswXSk7IC8vU3dhcCBwb2ludCAwIGFuZCBwb2ludCAxXG4gICAgfVxuXG4gICAgaWYgKF9pc1BvaW50SW5EaXJGcm9tKGVuZHBvaW50c1swXSwgcmVjdC5nZXRUb3BMZWZ0KCksIF9yZXZlcnNlRGlyKGRpcikpKSB7XG4gICAgICAgIGVuZHBvaW50c1swXS5hc3NpZ24ocmVjdC5nZXRUb3BMZWZ0KCkpO1xuICAgIH1cblxuICAgIGlmIChfaXNQb2ludEluRGlyRnJvbShlbmRwb2ludHNbMV0sIHJlY3QuZ2V0Qm90dG9tUmlnaHQoKSwgZGlyKSkge1xuICAgICAgICBlbmRwb2ludHNbMV0uYXNzaWduKHJlY3QuZ2V0Qm90dG9tUmlnaHQoKSk7XG4gICAgfVxuXG4gICAgaWYgKF9pc0hvcml6b250YWwoZGlyKSkge1xuICAgICAgICBlbmRwb2ludHNbMF0ueSA9IHN0YXJ0Lnk7XG4gICAgICAgIGVuZHBvaW50c1sxXS55ID0gZW5kLnk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgZW5kcG9pbnRzWzBdLnggPSBzdGFydC54O1xuICAgICAgICBlbmRwb2ludHNbMV0ueCA9IGVuZC54O1xuICAgIH1cblxuICAgIHJldHVybiBlbmRwb2ludHM7XG5cbn07XG5cbnZhciBfaW50ZXJzZWN0ID0gZnVuY3Rpb24gKGExLCBhMiwgYjEsIGIyKSB7XG4gICAgcmV0dXJuIE1hdGgubWluKGExLCBhMikgPD0gTWF0aC5tYXgoYjEsIGIyKSAmJiBNYXRoLm1pbihiMSwgYjIpIDw9IE1hdGgubWF4KGExLCBhMik7XG59O1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gUm91dGluZ0RpcmVjdGlvblxuXG52YXIgX2lzSG9yaXpvbnRhbCA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICByZXR1cm4gZGlyID09PSBDT05TVEFOVFMuRGlyUmlnaHQgfHwgZGlyID09PSBDT05TVEFOVFMuRGlyTGVmdDtcbn07XG5cbnZhciBfaXNWZXJ0aWNhbCA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICByZXR1cm4gZGlyID09PSBDT05TVEFOVFMuRGlyVG9wIHx8IGRpciA9PT0gQ09OU1RBTlRTLkRpckJvdHRvbTtcbn07XG5cbnZhciBfaXNSaWdodEFuZ2xlID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHJldHVybiBDT05TVEFOVFMuRGlyVG9wIDw9IGRpciAmJiBkaXIgPD0gQ09OU1RBTlRTLkRpckxlZnQ7XG59O1xuXG52YXIgX2FyZUluUmlnaHRBbmdsZSA9IGZ1bmN0aW9uIChkaXIxLCBkaXIyKSB7XG4gICAgYXNzZXJ0KF9pc1JpZ2h0QW5nbGUoZGlyMSkgJiYgX2lzUmlnaHRBbmdsZShkaXIyKSxcbiAgICAgICAgJ0FySGVscGVyLmFyZUluUmlnaHRBbmdsZTogX2lzUmlnaHRBbmdsZShkaXIxKSAmJiBfaXNSaWdodEFuZ2xlKGRpcjIpIEZBSUxFRCcpO1xuICAgIHJldHVybiBfaXNIb3Jpem9udGFsKGRpcjEpID09PSBfaXNWZXJ0aWNhbChkaXIyKTtcbn07XG5cbnZhciBfbmV4dENsb2Nrd2lzZURpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICBpZiAoX2lzUmlnaHRBbmdsZShkaXIpKSB7XG4gICAgICAgIHJldHVybiAoKGRpciArIDEpICUgNCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRpcjtcbn07XG5cbnZhciBfcHJldkNsb2Nrd2lzZURpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICBpZiAoX2lzUmlnaHRBbmdsZShkaXIpKSB7XG4gICAgICAgIHJldHVybiAoKGRpciArIDMpICUgNCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRpcjtcbn07XG5cbnZhciBfcmV2ZXJzZURpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICBpZiAoX2lzUmlnaHRBbmdsZShkaXIpKSB7XG4gICAgICAgIHJldHVybiAoKGRpciArIDIpICUgNCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRpcjtcbn07XG5cbnZhciBfc3RlcE9uZUluRGlyID0gZnVuY3Rpb24gKHBvaW50LCBkaXIpIHtcbiAgICBhc3NlcnQoX2lzUmlnaHRBbmdsZShkaXIpLCAnQXJIZWxwZXIuc3RlcE9uSW5EaXI6IF9pc1JpZ2h0QW5nbGUoZGlyKSBGQUlMRUQnKTtcblxuICAgIHN3aXRjaCAoZGlyKSB7XG4gICAgICAgIGNhc2UgQ09OU1RBTlRTLkRpclRvcDpcbiAgICAgICAgICAgIHBvaW50LnktLTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgQ09OU1RBTlRTLkRpclJpZ2h0OlxuICAgICAgICAgICAgcG9pbnQueCsrO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSBDT05TVEFOVFMuRGlyQm90dG9tOlxuICAgICAgICAgICAgcG9pbnQueSsrO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSBDT05TVEFOVFMuRGlyTGVmdDpcbiAgICAgICAgICAgIHBvaW50LngtLTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgIH1cblxufTtcblxudmFyIF9nZXRDaGlsZFJlY3RPdXRlckNvb3JkRnJvbSA9IGZ1bmN0aW9uIChidWZmZXJPYmplY3QsIGluRGlyLCBwb2ludCkgeyAvL1BvaW50IHRyYXZlbHMgaW5EaXIgdW50aWwgaGl0cyBjaGlsZCBib3hcbiAgICB2YXIgY2hpbGRyZW4gPSBidWZmZXJPYmplY3QuY2hpbGRyZW4sXG4gICAgICAgIGkgPSAtMSxcbiAgICAgICAgYm94ID0gbnVsbCxcbiAgICAgICAgcmVzID0gX2dldFJlY3RPdXRlckNvb3JkKGJ1ZmZlck9iamVjdC5ib3gsIGluRGlyKTtcblxuICAgIGFzc2VydChfaXNSaWdodEFuZ2xlKGluRGlyKSwgJ2dldENoaWxkUmVjdE91dGVyQ29vcmRGcm9tOiBfaXNSaWdodEFuZ2xlKGluRGlyKSBGQUlMRUQnKTtcbiAgICAvL1RoZSBuZXh0IGFzc2VydCBmYWlscyBpZiB0aGUgcG9pbnQgaXMgaW4gdGhlIG9wcG9zaXRlIGRpcmVjdGlvbiBvZiB0aGUgcmVjdGFuZ2xlIHRoYXQgaXQgaXMgY2hlY2tpbmcuXG4gICAgLy8gZS5nLiBUaGUgcG9pbnQgaXMgY2hlY2tpbmcgd2hlbiBpdCB3aWxsIGhpdCB0aGUgYm94IGZyb20gdGhlIHJpZ2h0IGJ1dCB0aGUgcG9pbnQgaXMgb24gdGhlIGxlZnRcbiAgICBhc3NlcnQoIV9pc1BvaW50SW5EaXJGcm9tKHBvaW50LCBidWZmZXJPYmplY3QuYm94LCBpbkRpciksXG4gICAgICAgICdnZXRDaGlsZFJlY3RPdXRlckNvb3JkRnJvbTogIWlzUG9pbnRJbkRpckZyb20ocG9pbnQsIGJ1ZmZlck9iamVjdC5ib3gucmVjdCwgKGluRGlyKSkgRkFJTEVEJyk7XG5cbiAgICB3aGlsZSAoKytpIDwgY2hpbGRyZW4ubGVuZ3RoKSB7XG5cbiAgICAgICAgaWYgKF9pc1BvaW50SW5EaXJGcm9tKHBvaW50LCBjaGlsZHJlbltpXSwgX3JldmVyc2VEaXIoaW5EaXIpKSAmJlxuICAgICAgICAgICAgX2lzUG9pbnRCZXR3ZWVuU2lkZXMocG9pbnQsIGNoaWxkcmVuW2ldLCBpbkRpcikgJiZcbiAgICAgICAgICAgIF9pc0Nvb3JkSW5EaXJGcm9tKHJlcywgX2dldFJlY3RPdXRlckNvb3JkKGNoaWxkcmVuW2ldLCBfcmV2ZXJzZURpcihpbkRpcikpLCAoaW5EaXIpKSkge1xuXG4gICAgICAgICAgICByZXMgPSBfZ2V0UmVjdE91dGVyQ29vcmQoY2hpbGRyZW5baV0sIF9yZXZlcnNlRGlyKGluRGlyKSk7XG4gICAgICAgICAgICBib3ggPSBjaGlsZHJlbltpXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB7J2JveCc6IGJveCwgJ2Nvb3JkJzogcmVzfTtcbn07XG5cbnZhciBfZ2V0UmVjdE91dGVyQ29vcmQgPSBmdW5jdGlvbiAocmVjdCwgZGlyKSB7XG4gICAgYXNzZXJ0KF9pc1JpZ2h0QW5nbGUoZGlyKSwgJ1V0aWxzLmdldFJlY3RPdXRlckNvb3JkOiBpc1JpZ2h0QW5nbGUoZGlyKSBGQUlMRUQnKTtcbiAgICB2YXIgdCA9IHJlY3QuY2VpbCAtIDEsXG4gICAgICAgIHIgPSByZWN0LnJpZ2h0ICsgMSxcbiAgICAgICAgYiA9IHJlY3QuZmxvb3IgKyAxLFxuICAgICAgICBsID0gcmVjdC5sZWZ0IC0gMTtcblxuICAgIHN3aXRjaCAoZGlyKSB7XG4gICAgICAgIGNhc2UgQ09OU1RBTlRTLkRpclRvcDpcbiAgICAgICAgICAgIHJldHVybiB0O1xuXG4gICAgICAgIGNhc2UgQ09OU1RBTlRTLkRpclJpZ2h0OlxuICAgICAgICAgICAgcmV0dXJuIHI7XG5cbiAgICAgICAgY2FzZSBDT05TVEFOVFMuRGlyQm90dG9tOlxuICAgICAgICAgICAgcmV0dXJuIGI7XG4gICAgfVxuXG4gICAgcmV0dXJuIGw7XG59O1xuXG4vL1x0SW5kZXhlczpcbi8vXHRcdFx0XHQgMDRcbi8vXHRcdFx0XHQxICA1XG4vL1x0XHRcdFx0MyAgN1xuLy9cdFx0XHRcdCAyNlxuXG52YXIgZ2V0RGlyVGFibGVJbmRleCA9IGZ1bmN0aW9uIChvZmZzZXQpIHtcbiAgICByZXR1cm4gKG9mZnNldC5jeCA+PSAwKSAqIDQgKyAob2Zmc2V0LmN5ID49IDApICogMiArIChNYXRoLmFicyhvZmZzZXQuY3gpID49IE1hdGguYWJzKG9mZnNldC5jeSkpO1xufTtcblxudmFyIG1ham9yRGlyVGFibGUgPVxuICAgIFtcbiAgICAgICAgQ09OU1RBTlRTLkRpclRvcCxcbiAgICAgICAgQ09OU1RBTlRTLkRpckxlZnQsXG4gICAgICAgIENPTlNUQU5UUy5EaXJCb3R0b20sXG4gICAgICAgIENPTlNUQU5UUy5EaXJMZWZ0LFxuICAgICAgICBDT05TVEFOVFMuRGlyVG9wLFxuICAgICAgICBDT05TVEFOVFMuRGlyUmlnaHQsXG4gICAgICAgIENPTlNUQU5UUy5EaXJCb3R0b20sXG4gICAgICAgIENPTlNUQU5UUy5EaXJSaWdodFxuICAgIF07XG5cbnZhciBfZ2V0TWFqb3JEaXIgPSBmdW5jdGlvbiAob2Zmc2V0KSB7XG4gICAgcmV0dXJuIG1ham9yRGlyVGFibGVbZ2V0RGlyVGFibGVJbmRleChvZmZzZXQpXTtcbn07XG5cbnZhciBtaW5vckRpclRhYmxlID1cbiAgICBbXG4gICAgICAgIENPTlNUQU5UUy5EaXJMZWZ0LFxuICAgICAgICBDT05TVEFOVFMuRGlyVG9wLFxuICAgICAgICBDT05TVEFOVFMuRGlyTGVmdCxcbiAgICAgICAgQ09OU1RBTlRTLkRpckJvdHRvbSxcbiAgICAgICAgQ09OU1RBTlRTLkRpclJpZ2h0LFxuICAgICAgICBDT05TVEFOVFMuRGlyVG9wLFxuICAgICAgICBDT05TVEFOVFMuRGlyUmlnaHQsXG4gICAgICAgIENPTlNUQU5UUy5EaXJCb3R0b21cbiAgICBdO1xuXG52YXIgX2dldE1pbm9yRGlyID0gZnVuY3Rpb24gKG9mZnNldCkge1xuICAgIHJldHVybiBtaW5vckRpclRhYmxlW2dldERpclRhYmxlSW5kZXgob2Zmc2V0KV07XG59O1xuXG4vL1x0RkcxMjNcbi8vXHRFICAgNFxuLy9cdEQgMCA1XG4vL1x0QyAgIDZcbi8vICBCQTk4N1xuXG5cbnZhciBfZXhHZXREaXJUYWJsZUluZGV4ID0gZnVuY3Rpb24gKG9mZnNldCkge1xuICAgIC8vVGhpcyByZXF1aXJlZCBhIHZhcmlhYmxlIGFzc2lnbm1lbnQ7IG90aGVyd2lzZSB0aGlzIGZ1bmN0aW9uXG4gICAgLy9yZXR1cm5lZCB1bmRlZmluZWQuLi5cbiAgICB2YXIgcmVzID1cbiAgICAgICAgb2Zmc2V0LmN4ID4gMCA/XG4gICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgb2Zmc2V0LmN5ID4gMCA/XG4gICAgICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgICAgIG9mZnNldC5jeCA+IG9mZnNldC5jeSA/XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA2XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKG9mZnNldC5jeCA8IG9mZnNldC5jeSA/XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKSlcbiAgICAgICAgICAgICAgICAgICAgKSA6XG4gICAgICAgICAgICAgICAgICAgIChvZmZzZXQuY3kgPCAwID9cbiAgICAgICAgICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvZmZzZXQuY3ggPiAtb2Zmc2V0LmN5ID9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgNFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKG9mZnNldC5jeCA8IC1vZmZzZXQuY3kgP1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICkpXG4gICAgICAgICAgICAgICAgICAgICAgICApIDpcbiAgICAgICAgICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA1XG4gICAgICAgICAgICAgICAgICAgICAgICApKVxuICAgICAgICAgICAgKSA6XG4gICAgICAgICAgICAob2Zmc2V0LmN4IDwgMCA/XG4gICAgICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgICAgICBvZmZzZXQuY3kgPiAwID9cbiAgICAgICAgICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAtb2Zmc2V0LmN4ID4gb2Zmc2V0LmN5ID9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMTJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICgtb2Zmc2V0LmN4IDwgb2Zmc2V0LmN5ID9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAxMFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMTFcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICkpXG4gICAgICAgICAgICAgICAgICAgICAgICApIDpcbiAgICAgICAgICAgICAgICAgICAgICAgIChvZmZzZXQuY3kgPCAwID9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9mZnNldC5jeCA8IG9mZnNldC5jeSA/XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMTRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKG9mZnNldC5jeCA+IG9mZnNldC5jeSA/XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAxNlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMTVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMTNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApKVxuICAgICAgICAgICAgICAgICkgOlxuICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgb2Zmc2V0LmN5ID4gMCA/XG4gICAgICAgICAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgOVxuICAgICAgICAgICAgICAgICAgICAgICAgKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAob2Zmc2V0LmN5IDwgMCA/XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAxXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKSlcbiAgICAgICAgICAgICAgICApKTtcblxuICAgIHJldHVybiByZXM7XG59O1xudmFyIGV4TWFqb3JEaXJUYWJsZSA9XG4gICAgW1xuICAgICAgICBDT05TVEFOVFMuRGlyTm9uZSxcbiAgICAgICAgQ09OU1RBTlRTLkRpclRvcCxcbiAgICAgICAgQ09OU1RBTlRTLkRpclRvcCxcbiAgICAgICAgQ09OU1RBTlRTLkRpclJpZ2h0LFxuICAgICAgICBDT05TVEFOVFMuRGlyUmlnaHQsXG4gICAgICAgIENPTlNUQU5UUy5EaXJSaWdodCxcbiAgICAgICAgQ09OU1RBTlRTLkRpclJpZ2h0LFxuICAgICAgICBDT05TVEFOVFMuRGlyUmlnaHQsXG4gICAgICAgIENPTlNUQU5UUy5EaXJCb3R0b20sXG4gICAgICAgIENPTlNUQU5UUy5EaXJCb3R0b20sXG4gICAgICAgIENPTlNUQU5UUy5EaXJCb3R0b20sXG4gICAgICAgIENPTlNUQU5UUy5EaXJMZWZ0LFxuICAgICAgICBDT05TVEFOVFMuRGlyTGVmdCxcbiAgICAgICAgQ09OU1RBTlRTLkRpckxlZnQsXG4gICAgICAgIENPTlNUQU5UUy5EaXJMZWZ0LFxuICAgICAgICBDT05TVEFOVFMuRGlyTGVmdCxcbiAgICAgICAgQ09OU1RBTlRTLkRpclRvcFxuICAgIF07XG5cbnZhciBfZXhHZXRNYWpvckRpciA9IGZ1bmN0aW9uIChvZmZzZXQpIHtcbiAgICByZXR1cm4gZXhNYWpvckRpclRhYmxlW19leEdldERpclRhYmxlSW5kZXgob2Zmc2V0KV07XG59O1xuXG52YXIgZXhNaW5vckRpclRhYmxlID1cbiAgICBbXG4gICAgICAgIENPTlNUQU5UUy5EaXJOb25lLFxuICAgICAgICBDT05TVEFOVFMuRGlyTm9uZSxcbiAgICAgICAgQ09OU1RBTlRTLkRpclJpZ2h0LFxuICAgICAgICBDT05TVEFOVFMuRGlyVG9wLFxuICAgICAgICBDT05TVEFOVFMuRGlyVG9wLFxuICAgICAgICBDT05TVEFOVFMuRGlyTm9uZSxcbiAgICAgICAgQ09OU1RBTlRTLkRpckJvdHRvbSxcbiAgICAgICAgQ09OU1RBTlRTLkRpckJvdHRvbSxcbiAgICAgICAgQ09OU1RBTlRTLkRpclJpZ2h0LFxuICAgICAgICBDT05TVEFOVFMuRGlyTm9uZSxcbiAgICAgICAgQ09OU1RBTlRTLkRpckxlZnQsXG4gICAgICAgIENPTlNUQU5UUy5EaXJCb3R0b20sXG4gICAgICAgIENPTlNUQU5UUy5EaXJCb3R0b20sXG4gICAgICAgIENPTlNUQU5UUy5EaXJOb25lLFxuICAgICAgICBDT05TVEFOVFMuRGlyVG9wLFxuICAgICAgICBDT05TVEFOVFMuRGlyVG9wLFxuICAgICAgICBDT05TVEFOVFMuRGlyTGVmdFxuICAgIF07XG5cbnZhciBfZXhHZXRNaW5vckRpciA9IGZ1bmN0aW9uIChvZmZzZXQpIHtcbiAgICByZXR1cm4gZXhNaW5vckRpclRhYmxlW19leEdldERpclRhYmxlSW5kZXgob2Zmc2V0KV07XG59O1xuXG52YXIgX2dldERpciA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vZGlyKSB7XG4gICAgaWYgKG9mZnNldC5jeCA9PT0gMCkge1xuICAgICAgICBpZiAob2Zmc2V0LmN5ID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gbm9kaXI7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob2Zmc2V0LmN5IDwgMCkge1xuICAgICAgICAgICAgcmV0dXJuIENPTlNUQU5UUy5EaXJUb3A7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gQ09OU1RBTlRTLkRpckJvdHRvbTtcbiAgICB9XG5cbiAgICBpZiAob2Zmc2V0LmN5ID09PSAwKSB7XG4gICAgICAgIGlmIChvZmZzZXQuY3ggPiAwKSB7XG4gICAgICAgICAgICByZXR1cm4gQ09OU1RBTlRTLkRpclJpZ2h0O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIENPTlNUQU5UUy5EaXJMZWZ0O1xuICAgIH1cblxuICAgIHJldHVybiBDT05TVEFOVFMuRGlyU2tldztcbn07XG5cbnZhciBfaXNQb2ludEluRGlyRnJvbUNoaWxkcmVuID0gZnVuY3Rpb24gKHBvaW50LCBmcm9tUGFyZW50LCBkaXIpIHtcbiAgICB2YXIgY2hpbGRyZW4gPSBmcm9tUGFyZW50LmNoaWxkcmVuLFxuICAgICAgICBpID0gMDtcblxuICAgIGFzc2VydChfaXNSaWdodEFuZ2xlKGRpciksICdpc1BvaW50SW5EaXJGcm9tQ2hpbGRyZW46IF9pc1JpZ2h0QW5nbGUoZGlyKSBGQUlMRUQnKTtcblxuICAgIHdoaWxlIChpIDwgY2hpbGRyZW4ubGVuZ3RoKSB7XG4gICAgICAgIGlmIChfaXNQb2ludEluRGlyRnJvbShwb2ludCwgY2hpbGRyZW5baV0ucmVjdCwgZGlyKSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgKytpO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbn07XG5cbnZhciBfaXNQb2ludEluRGlyRnJvbSA9IGZ1bmN0aW9uIChwb2ludCwgZnJvbSwgZGlyKSB7XG4gICAgaWYgKGZyb20gaW5zdGFuY2VvZiBBclJlY3QpIHtcbiAgICAgICAgdmFyIHJlY3QgPSBmcm9tO1xuICAgICAgICBhc3NlcnQoX2lzUmlnaHRBbmdsZShkaXIpLCAnQXJIZWxwZXIuaXNQb2ludEluRGlyRnJvbTogX2lzUmlnaHRBbmdsZShkaXIpIEZBSUxFRCcpO1xuXG4gICAgICAgIHN3aXRjaCAoZGlyKSB7XG4gICAgICAgICAgICBjYXNlIENPTlNUQU5UUy5EaXJUb3A6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBvaW50LnkgPCByZWN0LmNlaWw7XG5cbiAgICAgICAgICAgIGNhc2UgQ09OU1RBTlRTLkRpclJpZ2h0OlxuICAgICAgICAgICAgICAgIHJldHVybiBwb2ludC54ID49IHJlY3QucmlnaHQ7XG5cbiAgICAgICAgICAgIGNhc2UgQ09OU1RBTlRTLkRpckJvdHRvbTpcbiAgICAgICAgICAgICAgICByZXR1cm4gcG9pbnQueSA+PSByZWN0LmZsb29yO1xuXG4gICAgICAgICAgICBjYXNlIENPTlNUQU5UUy5EaXJMZWZ0OlxuICAgICAgICAgICAgICAgIHJldHVybiBwb2ludC54IDwgcmVjdC5sZWZ0O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgICAgYXNzZXJ0KF9pc1JpZ2h0QW5nbGUoZGlyKSwgJ0FySGVscGVyLmlzUG9pbnRJbkRpckZyb206IF9pc1JpZ2h0QW5nbGUoZGlyKSBGQUlMRUQnKTtcblxuICAgICAgICBzd2l0Y2ggKGRpcikge1xuICAgICAgICAgICAgY2FzZSBDT05TVEFOVFMuRGlyVG9wOlxuICAgICAgICAgICAgICAgIHJldHVybiBwb2ludC55IDw9IGZyb20ueTtcblxuICAgICAgICAgICAgY2FzZSBDT05TVEFOVFMuRGlyUmlnaHQ6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBvaW50LnggPj0gZnJvbS54O1xuXG4gICAgICAgICAgICBjYXNlIENPTlNUQU5UUy5EaXJCb3R0b206XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBvaW50LnkgPj0gZnJvbS55O1xuXG4gICAgICAgICAgICBjYXNlIENPTlNUQU5UUy5EaXJMZWZ0OlxuICAgICAgICAgICAgICAgIHJldHVybiBwb2ludC54IDw9IGZyb20ueDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgIH1cbn07XG5cbnZhciBfaXNQb2ludEJldHdlZW5TaWRlcyA9IGZ1bmN0aW9uIChwb2ludCwgcmVjdCwgaXNob3Jpem9udGFsKSB7XG4gICAgaWYgKGlzaG9yaXpvbnRhbCA9PT0gdHJ1ZSB8fCBfaXNIb3Jpem9udGFsKGlzaG9yaXpvbnRhbCkpIHtcbiAgICAgICAgcmV0dXJuIHJlY3QuY2VpbCA8PSBwb2ludC55ICYmIHBvaW50LnkgPCByZWN0LmZsb29yO1xuICAgIH1cblxuICAgIHJldHVybiByZWN0LmxlZnQgPD0gcG9pbnQueCAmJiBwb2ludC54IDwgcmVjdC5yaWdodDtcbn07XG5cbnZhciBfaXNDb29yZEluRGlyRnJvbSA9IGZ1bmN0aW9uIChjb29yZCwgZnJvbSwgZGlyKSB7XG4gICAgYXNzZXJ0KF9pc1JpZ2h0QW5nbGUoZGlyKSwgJ0FySGVscGVyLmlzQ29vcmRJbkRpckZyb206IF9pc1JpZ2h0QW5nbGUoZGlyKSBGQUlMRUQnKTtcbiAgICBpZiAoZnJvbSBpbnN0YW5jZW9mIEFyUG9pbnQpIHtcbiAgICAgICAgZnJvbSA9IF9nZXRQb2ludENvb3JkKGZyb20sIGRpcik7XG4gICAgfVxuXG4gICAgaWYgKGRpciA9PT0gQ09OU1RBTlRTLkRpclRvcCB8fCBkaXIgPT09IENPTlNUQU5UUy5EaXJMZWZ0KSB7XG4gICAgICAgIHJldHVybiBjb29yZCA8PSBmcm9tO1xuICAgIH1cblxuICAgIHJldHVybiBjb29yZCA+PSBmcm9tO1xufTtcblxuLy8gVGhpcyBuZXh0IG1ldGhvZCBvbmx5IHN1cHBvcnRzIHVuYW1iaWd1b3VzIG9yaWVudGF0aW9ucy4gVGhhdCBpcywgdGhlIHBvaW50XG4vLyBjYW5ub3QgYmUgaW4gYSBjb3JuZXIgb2YgdGhlIHJlY3RhbmdsZS5cbi8vIE5PVEU6IHRoZSByaWdodCBhbmQgZmxvb3IgdXNlZCB0byBiZSAtIDEuIFxudmFyIF9vbldoaWNoRWRnZSA9IGZ1bmN0aW9uIChyZWN0LCBwb2ludCkge1xuICAgIGlmIChwb2ludC55ID09PSByZWN0LmNlaWwgJiYgcmVjdC5sZWZ0IDwgcG9pbnQueCAmJiBwb2ludC54IDwgcmVjdC5yaWdodCkge1xuICAgICAgICByZXR1cm4gQ09OU1RBTlRTLkRpclRvcDtcbiAgICB9XG5cbiAgICBpZiAocG9pbnQueSA9PT0gcmVjdC5mbG9vciAmJiByZWN0LmxlZnQgPCBwb2ludC54ICYmIHBvaW50LnggPCByZWN0LnJpZ2h0KSB7XG4gICAgICAgIHJldHVybiBDT05TVEFOVFMuRGlyQm90dG9tO1xuICAgIH1cblxuICAgIGlmIChwb2ludC54ID09PSByZWN0LmxlZnQgJiYgcmVjdC5jZWlsIDwgcG9pbnQueSAmJiBwb2ludC55IDwgcmVjdC5mbG9vcikge1xuICAgICAgICByZXR1cm4gQ09OU1RBTlRTLkRpckxlZnQ7XG4gICAgfVxuXG4gICAgaWYgKHBvaW50LnggPT09IHJlY3QucmlnaHQgJiYgcmVjdC5jZWlsIDwgcG9pbnQueSAmJiBwb2ludC55IDwgcmVjdC5mbG9vcikge1xuICAgICAgICByZXR1cm4gQ09OU1RBTlRTLkRpclJpZ2h0O1xuICAgIH1cblxuICAgIHJldHVybiBDT05TVEFOVFMuRGlyTm9uZTtcbn07XG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gQ0FyRmluZE5lYXJlc3RMaW5lXG5cbnZhciBBckZpbmROZWFyZXN0TGluZSA9IGZ1bmN0aW9uIChwdCkge1xuICAgIHRoaXMucG9pbnQgPSBwdDtcbiAgICB0aGlzLmRpc3QxID0gSW5maW5pdHk7XG4gICAgdGhpcy5kaXN0MiA9IEluZmluaXR5O1xufTtcblxuQXJGaW5kTmVhcmVzdExpbmUucHJvdG90eXBlLmhMaW5lID0gZnVuY3Rpb24gKHgxLCB4MiwgeSkge1xuICAgIGFzc2VydCh4MSA8PSB4MiwgJ0FyRmluZE5lYXJlc3RMaW5lLmhMaW5lOiB4MSA8PSB4MiAgRkFJTEVEJyk7XG5cbiAgICB2YXIgZDEgPSBfZGlzdGFuY2VGcm9tSExpbmUodGhpcy5wb2ludCwgeDEsIHgyLCB5KSxcbiAgICAgICAgZDIgPSBNYXRoLmFicyh0aGlzLnBvaW50LnkgLSB5KTtcblxuICAgIGlmIChkMSA8IHRoaXMuZGlzdDEgfHwgKGQxID09PSB0aGlzLmRpc3QxICYmIGQyIDwgdGhpcy5kaXN0MikpIHtcbiAgICAgICAgdGhpcy5kaXN0MSA9IGQxO1xuICAgICAgICB0aGlzLmRpc3QyID0gZDI7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbn07XG5cbkFyRmluZE5lYXJlc3RMaW5lLnByb3RvdHlwZS52TGluZSA9IGZ1bmN0aW9uICh5MSwgeTIsIHgpIHtcbiAgICBhc3NlcnQoeTEgPD0geTIsICdBckZpbmROZWFyZXN0TGluZS5oTGluZTogeTEgPD0geTIgRkFJTEVEJyk7XG5cbiAgICB2YXIgZDEgPSBfZGlzdGFuY2VGcm9tVkxpbmUodGhpcy5wb2ludCwgeTEsIHkyLCB4KSxcbiAgICAgICAgZDIgPSBNYXRoLmFicyh0aGlzLnBvaW50LnggLSB4KTtcblxuICAgIGlmIChkMSA8IHRoaXMuZGlzdDEgfHwgKGQxID09PSB0aGlzLmRpc3QxICYmIGQyIDwgdGhpcy5kaXN0MikpIHtcbiAgICAgICAgdGhpcy5kaXN0MSA9IGQxO1xuICAgICAgICB0aGlzLmRpc3QyID0gZDI7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbn07XG5cbkFyRmluZE5lYXJlc3RMaW5lLnByb3RvdHlwZS53YXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuZGlzdDEgPCBJbmZpbml0eSAmJiB0aGlzLmRpc3QyIDwgSW5maW5pdHk7XG59O1xuXG4vLyBDb252ZW5pZW5jZSBGdW5jdGlvbnNcbnZhciByZW1vdmVGcm9tQXJyYXlzID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgdmFyIGluZGV4LFxuICAgICAgICByZW1vdmVkID0gZmFsc2UsXG4gICAgICAgIGFycmF5O1xuXG4gICAgZm9yICh2YXIgaSA9IGFyZ3VtZW50cy5sZW5ndGggLSAxOyBpID4gMDsgaS0tKSB7XG4gICAgICAgIGFycmF5ID0gYXJndW1lbnRzW2ldO1xuICAgICAgICBpbmRleCA9IGFycmF5LmluZGV4T2YodmFsdWUpO1xuICAgICAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICAgICAgICBhcnJheS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgcmVtb3ZlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmVtb3ZlZDtcbn07XG5cbnZhciBzdHJpbmdpZnkgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodmFsdWUsIGZ1bmN0aW9uIChrZXksIHZhbHVlKSB7XG4gICAgICAgIGlmIChrZXkgPT09ICdvd25lcicgJiYgdmFsdWUpIHtcbiAgICAgICAgICAgIHJldHVybiB2YWx1ZS5pZCB8fCB0eXBlb2YgdmFsdWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH0pO1xufTtcblxuLyoqXG4gKiBSb3VuZCB0aGUgbnVtYmVyIHRvIHRoZSBnaXZlbiBkZWNpbWFsIHBsYWNlcy4gVHJ1bmNhdGUgZm9sbG93aW5nIGRpZ2l0cy5cbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gdmFsdWVcbiAqIEBwYXJhbSB7TnVtYmVyfSBwbGFjZXNcbiAqIEByZXR1cm4ge051bWJlcn0gcmVzdWx0XG4gKi9cbnZhciByb3VuZFRydW5jID0gZnVuY3Rpb24gKHZhbHVlLCBwbGFjZXMpIHtcbiAgICB2YWx1ZSA9ICt2YWx1ZTtcbiAgICB2YXIgc2NhbGUgPSBNYXRoLnBvdygxMCwgK3BsYWNlcyksXG4gICAgICAgIGZuID0gJ2Zsb29yJztcblxuICAgIGlmICh2YWx1ZSA8IDApIHtcbiAgICAgICAgZm4gPSAnY2VpbCc7XG4gICAgfVxuXG4gICAgcmV0dXJuIE1hdGhbZm5dKHZhbHVlICogc2NhbGUpIC8gc2NhbGU7XG59O1xuXG4vL0Zsb2F0IGVxdWFsc1xudmFyIGZsb2F0RXF1YWxzID0gZnVuY3Rpb24gKGEsIGIpIHtcbiAgICByZXR1cm4gKChhIC0gMC4xKSA8IGIpICYmIChiIDwgKGEgKyAwLjEpKTtcbn07XG5cbi8qKlxuICogQ29udmVydCBhbiBvYmplY3Qgd2l0aCBpbmNyZWFzaW5nIGludGVnZXIga2V5cyB0byBhbiBhcnJheS5cbiAqIFVzaW5nIG1ldGhvZCBmcm9tIGh0dHA6Ly9qc3BlcmYuY29tL2FyZ3VtZW50cy1wZXJmb3JtYW5jZS82XG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9ialxuICogQHJldHVybiB7QXJyYXl9XG4gKi9cbnZhciB0b0FycmF5ID0gZnVuY3Rpb24gKG9iaikge1xuICAgIHZhciByZXN1bHQgPSBuZXcgQXJyYXkob2JqLmxlbmd0aHx8MCksXG4gICAgICAgIGkgPSAwO1xuICAgIHdoaWxlIChvYmpbaV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXN1bHRbaV0gPSBvYmpbaSsrXTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbnZhciBwaWNrID0gZnVuY3Rpb24oa2V5cywgb2JqKSB7XG4gICAgdmFyIHJlcyA9IHt9O1xuICAgIGZvciAodmFyIGkgPSBrZXlzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICByZXNba2V5c1tpXV0gPSBvYmpba2V5c1tpXV07XG4gICAgfVxuICAgIHJldHVybiByZXM7XG59O1xuXG52YXIgbm9wID0gZnVuY3Rpb24oKSB7XG4gICAgLy8gbm9wXG59O1xuXG52YXIgYXNzZXJ0ID0gZnVuY3Rpb24oY29uZCwgbXNnKSB7XG4gICAgaWYgKCFjb25kKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihtc2cgfHwgJ0Fzc2VydCBmYWlsZWQnKTtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBvbldoaWNoRWRnZTogX29uV2hpY2hFZGdlLFxuICAgIGlzQ29vcmRJbkRpckZyb206IF9pc0Nvb3JkSW5EaXJGcm9tLFxuICAgIGlzUG9pbnRCZXR3ZWVuU2lkZXM6IF9pc1BvaW50QmV0d2VlblNpZGVzLFxuICAgIGlzUG9pbnRJbkRpckZyb206IF9pc1BvaW50SW5EaXJGcm9tLFxuICAgIGlzUG9pbnRJbkRpckZyb21DaGlsZHJlbjogX2lzUG9pbnRJbkRpckZyb21DaGlsZHJlbixcbiAgICBpc1BvaW50SW46IF9pc1BvaW50SW4sXG4gICAgaXNQb2ludE5lYXI6IF9pc1BvaW50TmVhcixcbiAgICBnZXREaXI6IF9nZXREaXIsXG4gICAgZXhHZXRNaW5vckRpcjogX2V4R2V0TWlub3JEaXIsXG4gICAgZXhHZXRNYWpvckRpcjogX2V4R2V0TWFqb3JEaXIsXG4gICAgZXhHZXREaXJUYWJsZUluZGV4OiBfZXhHZXREaXJUYWJsZUluZGV4LFxuICAgIGdldE1pbm9yRGlyOiBfZ2V0TWlub3JEaXIsXG4gICAgZ2V0TWFqb3JEaXI6IF9nZXRNYWpvckRpcixcbiAgICBnZXRSZWN0T3V0ZXJDb29yZDogX2dldFJlY3RPdXRlckNvb3JkLFxuICAgIGdldENoaWxkUmVjdE91dGVyQ29vcmRGcm9tOiBfZ2V0Q2hpbGRSZWN0T3V0ZXJDb29yZEZyb20sXG4gICAgc3RlcE9uZUluRGlyOiBfc3RlcE9uZUluRGlyLFxuICAgIHJldmVyc2VEaXI6IF9yZXZlcnNlRGlyLFxuICAgIHByZXZDbG9ja3dpc2VEaXI6IF9wcmV2Q2xvY2t3aXNlRGlyLFxuICAgIG5leHRDbG9ja3dpc2VEaXI6IF9uZXh0Q2xvY2t3aXNlRGlyLFxuICAgIGFyZUluUmlnaHRBbmdsZTogX2FyZUluUmlnaHRBbmdsZSxcbiAgICBpc1JpZ2h0QW5nbGU6IF9pc1JpZ2h0QW5nbGUsXG4gICAgaXNIb3Jpem9udGFsOiBfaXNIb3Jpem9udGFsLFxuICAgIGludGVyc2VjdDogX2ludGVyc2VjdCxcbiAgICBnZXRMaW5lQ2xpcFJlY3RJbnRlcnNlY3Q6IF9nZXRMaW5lQ2xpcFJlY3RJbnRlcnNlY3QsXG4gICAgaXNMaW5lQ2xpcFJlY3Q6IF9pc0xpbmVDbGlwUmVjdCxcbiAgICBpc0xpbmVDbGlwUmVjdHM6IF9pc0xpbmVDbGlwUmVjdHMsXG4gICAgaXNQb2ludE5lYXJMaW5lOiBfaXNQb2ludE5lYXJMaW5lLFxuICAgIGlzT25FZGdlOiBfaXNPbkVkZ2UsXG4gICAgZGlzdGFuY2VGcm9tTGluZTogX2Rpc3RhbmNlRnJvbUxpbmUsXG4gICAgaXNSZWN0Q2xpcDogX2lzUmVjdENsaXAsXG4gICAgaXNSZWN0SW46IF9pc1JlY3RJbixcbiAgICBpbmZsYXRlZFJlY3Q6IF9pbmZsYXRlZFJlY3QsXG4gICAgZ2V0UG9pbnRDb29yZDogX2dldFBvaW50Q29vcmQsXG4gICAgZ2V0T3B0aW1hbFBvcnRzOiBfZ2V0T3B0aW1hbFBvcnRzLFxuICAgIEFyRmluZE5lYXJlc3RMaW5lOiBBckZpbmROZWFyZXN0TGluZSxcblxuICAgIHJlbW92ZUZyb21BcnJheXM6IHJlbW92ZUZyb21BcnJheXMsXG4gICAgc3RyaW5naWZ5OiBzdHJpbmdpZnksXG4gICAgZmxvYXRFcXVhbHM6IGZsb2F0RXF1YWxzLFxuICAgIHJvdW5kVHJ1bmM6IHJvdW5kVHJ1bmMsXG4gICAgdG9BcnJheTogdG9BcnJheSxcbiAgICBub3A6IG5vcCxcbiAgICBhc3NlcnQ6IGFzc2VydCxcbiAgICBwaWNrOiBwaWNrIFxufTtcbiIsIi8qZ2xvYmFscyBkZWZpbmUqL1xuLypqc2hpbnQgYnJvd3NlcjogdHJ1ZSovXG5cbi8qKlxuICogQGF1dGhvciBicm9sbGIgLyBodHRwczovL2dpdGh1Yi9icm9sbGJcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBDT05TVEFOVFMgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuQ29uc3RhbnRzJyksXG4gICAgdXRpbHMgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuVXRpbHMnKSxcbiAgICBhc3NlcnQgPSB1dGlscy5hc3NlcnQsXG4gICAgQXJQb2ludCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5Qb2ludCcpLFxuICAgIEFyUmVjdCA9IHJlcXVpcmUoJy4vQXV0b1JvdXRlci5SZWN0JyksXG4gICAgQXV0b1JvdXRlckdyYXBoID0gcmVxdWlyZSgnLi9BdXRvUm91dGVyLkdyYXBoJyksXG4gICAgQXV0b1JvdXRlclBvcnQgPSByZXF1aXJlKCcuL0F1dG9Sb3V0ZXIuUG9ydCcpO1xuXG52YXIgQXV0b1JvdXRlciA9IGZ1bmN0aW9uICgpIHtcbiAgICAvLyBpbnRlcm5hbCB0byBleHRlcm5hbCBpZHNcbiAgICB0aGlzLl9ib3hJZHMgPSB7fTtcbiAgICB0aGlzLl9wb3J0SWRzID0ge307XG4gICAgdGhpcy5fcGF0aElkcyA9IHt9O1xuXG4gICAgdGhpcy5fcGF0aHNUb1VwZGF0ZU9uRGVsZXRpb24gPSB7fTsgIC8vIHBvcnRJZHMgPT4gcGF0aHNcbiAgICB0aGlzLl9wYXRoc1RvVXBkYXRlT25BZGRpdGlvbiA9IHt9OyAgLy8gYm94SWRzID0+IHBhdGhzXG4gICAgdGhpcy5fcGF0aFNyYyA9IHt9O1xuICAgIHRoaXMuX3BhdGhEc3QgPSB7fTtcblxuICAgIHRoaXMuX2dyYXBoID0gbmV3IEF1dG9Sb3V0ZXJHcmFwaCgpO1xufTtcblxuLyogKiAqICogKiAqICogUHVibGljIEFQSSAqICogKiAqICogKiAqL1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLl9ncmFwaC5jbGVhcih0cnVlKTtcbiAgICB0aGlzLl9ib3hJZHMgPSB7fTtcbiAgICB0aGlzLl9wb3J0SWRzID0ge307XG4gICAgdGhpcy5fcGF0aElkcyA9IHt9O1xuXG4gICAgdGhpcy5fcGF0aHNUb1VwZGF0ZU9uRGVsZXRpb24gPSB7fTsgIC8vIHBvcnRJZHMgPT4gcGF0aHNcbiAgICB0aGlzLl9wYXRoc1RvVXBkYXRlT25BZGRpdGlvbiA9IHt9OyAgLy8gYm94SWRzID0+IHBhdGhzXG4gICAgdGhpcy5fcGF0aFNyYyA9IHt9O1xuICAgIHRoaXMuX3BhdGhEc3QgPSB7fTtcbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLnNldEJveCA9IGZ1bmN0aW9uKGlkLCByZWN0KSB7XG4gICAgdmFyIGJveDtcbiAgICBpZiAocmVjdCA9PT0gbnVsbCkgeyAgLy8gUmVtb3ZlIHRoZSBib3hcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JlbW92ZUJveChpZCk7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLl9ib3hJZHNbaWRdKSB7XG4gICAgICAgIGJveCA9IHRoaXMuX2NyZWF0ZUJveChyZWN0KTtcbiAgICAgICAgLy8gVXBkYXRlIHJlY29yZHNcbiAgICAgICAgdGhpcy5fYm94SWRzW2lkXSA9IGJveC5pZDtcbiAgICAgICAgdGhpcy5fcG9ydElkc1tpZF0gPSB7fTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl91cGRhdGVCb3goaWQsIHJlY3QpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLnNldERlcGVuZGVudEJveCA9IGZ1bmN0aW9uKHBhcmVudElkLCBjaGlsZElkKSB7XG4gICAgdmFyIHBhcmVudCA9IHRoaXMuX2JveChwYXJlbnRJZCksXG4gICAgICAgIGNoaWxkID0gdGhpcy5fYm94KGNoaWxkSWQpO1xuXG4gICAgYXNzZXJ0KHBhcmVudCAmJiBjaGlsZCwgJ0NvdWxkIG5vdCBmaW5kIHBhcmVudCBvciBjaGlsZCcpO1xuICAgIHBhcmVudC5hZGRDaGlsZChjaGlsZCk7XG59O1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5zZXRQb3J0ID0gZnVuY3Rpb24oYm94SWQsIHBvcnRJZCwgYXJlYSkge1xuICAgIGlmIChhcmVhID09PSBudWxsKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yZW1vdmVQb3J0KGJveElkLCBwb3J0SWQpO1xuICAgIH1cblxuICAgIGFzc2VydCh0aGlzLl9ib3goYm94SWQpLCAnQm94IFwiJyArIGJveElkICsgJ1wiIGRvZXMgbm90IGV4aXN0Jyk7XG4gICAgaWYgKCF0aGlzLl9wb3J0SWRzW2JveElkXSB8fCAhdGhpcy5fcG9ydElkc1tib3hJZF1bcG9ydElkXSkge1xuICAgICAgICB0aGlzLl9jcmVhdGVQb3J0KGJveElkLCBwb3J0SWQsIGFyZWEpO1xuICAgICAgICBhc3NlcnQodGhpcy5fcG9ydChib3hJZCwgcG9ydElkKSwgJ1BvcnQgbm90IGFkZGVkIScpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX3VwZGF0ZVBvcnQoYm94SWQsIHBvcnRJZCwgYXJlYSk7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuc2V0UGF0aCA9IGZ1bmN0aW9uKGlkLCBzcmNJZCwgZHN0SWQpIHtcbiAgICBpZiAoc3JjSWQgPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JlbW92ZVBhdGgoaWQpO1xuICAgIH1cblxuICAgIGlmICghdGhpcy5fcGF0aElkc1tpZF0pIHtcbiAgICAgICAgdGhpcy5fY3JlYXRlUGF0aChpZCwgc3JjSWQsIGRzdElkKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl91cGRhdGVQYXRoKGlkLCBzcmNJZCwgZHN0SWQpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLnNldEN1c3RvbVJvdXRpbmcgPSBmdW5jdGlvbihpZCwgcG9pbnRzKSB7XG4gICAgdmFyIHBhdGggPSB0aGlzLl9wYXRoKGlkKTtcblxuICAgIGlmIChwYXRoID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdGhyb3cgJ0F1dG9Sb3V0ZXI6IE5lZWQgdG8gaGF2ZSBhbiBBdXRvUm91dGVyUGF0aCB0eXBlIHRvIHNldCBjdXN0b20gcGF0aCBwb2ludHMnO1xuICAgIH1cblxuICAgIGlmIChwb2ludHMgPT09IG51bGwpIHtcbiAgICAgICAgcGF0aC5zZXRBdXRvUm91dGluZyh0cnVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9zZXRDdXN0b21QYXRoKHBhdGgsIHBvaW50cyk7XG4gICAgfVxufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUucm91dGVTeW5jID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuX2dyYXBoLnJvdXRlU3luYygpO1xufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUucm91dGVBc3luYyA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgdGhpcy5fZ3JhcGgucm91dGVBc3luYyhvcHRpb25zKTtcbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLmJveCA9IGZ1bmN0aW9uIChpZCkge1xuICAgIHZhciBwQm94ID0gdGhpcy5fYm94KGlkKSwgIC8vIHByaXZhdGUgYm94XG4gICAgICAgIHJlY3Q7XG5cbiAgICBpZiAoIXBCb3gpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmVjdCA9IHBCb3gucmVjdDtcbiAgICByZXR1cm4ge1xuICAgICAgICBpZDogaWQsXG4gICAgICAgIHg6IHJlY3QubGVmdCxcbiAgICAgICAgd2lkdGg6IHJlY3QucmlnaHQgLSByZWN0LmxlZnQsXG4gICAgICAgIHk6IHJlY3QuY2VpbCxcbiAgICAgICAgaGVpZ2h0OiByZWN0LmZsb29yIC0gcmVjdC5jZWlsXG4gICAgfTtcbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLnBvcnQgPSBmdW5jdGlvbiAoYm94SWQsIGlkKSB7XG4gICAgdmFyIGNvbnRhaW5lciA9IHRoaXMuX3BvcnQoYm94SWQsIGlkKSxcbiAgICAgICAgcmVjdDtcblxuICAgIGlmICghY29udGFpbmVyKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJlY3QgPSBjb250YWluZXIucG9ydHNbMF0ucmVjdDtcblxuICAgIHJldHVybiB7XG4gICAgICAgIGlkOiBpZCxcbiAgICAgICAgeDogcmVjdC5sZWZ0LFxuICAgICAgICB3aWR0aDogcmVjdC5yaWdodCAtIHJlY3QubGVmdCxcbiAgICAgICAgeTogcmVjdC5jZWlsLFxuICAgICAgICBoZWlnaHQ6IHJlY3QuZmxvb3IgLSByZWN0LmNlaWxcbiAgICB9O1xufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUucGF0aCA9IGZ1bmN0aW9uIChpZCkge1xuICAgIHZhciBwYXRoID0gdGhpcy5fcGF0aChpZCk7XG4gICAgcmV0dXJuIHsgIC8vIFRPRE86IENvbnNpZGVyIGFkZGluZyBzcmMsIGRzdFxuICAgICAgICBpZDogaWQsXG4gICAgICAgIHBvaW50czogcGF0aC5wb2ludHMubWFwKGZ1bmN0aW9uKHB0KSB7XG4gICAgICAgICAgICByZXR1cm4gW3B0LngsIHB0LnldO1xuICAgICAgICB9KVxuICAgIH07XG59O1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5ib3hlcyA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fYm94SWRzKTtcbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLnBvcnRzID0gZnVuY3Rpb24gKGJveElkKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX3BvcnRJZHNbYm94SWRdKTtcbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLnBhdGhzID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLl9wYXRoSWRzKTtcbn07XG5cbi8qICogKiAqICogKiAqIFByaXZhdGUgQVBJICogKiAqICogKiAqICovXG5cbi8vIEdldHRlcnNcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuX2JveCA9IGZ1bmN0aW9uIChpZCkge1xuICAgIHZhciBwSWQgPSB0aGlzLl9ib3hJZHNbaWRdO1xuICAgIHJldHVybiB0aGlzLl9ncmFwaC5ib3hlc1twSWRdIHx8IG51bGw7XG59O1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5fcG9ydCA9IGZ1bmN0aW9uIChib3hJZCwgaWQpIHtcbiAgICBhc3NlcnQoYm94SWQgIT09IHVuZGVmaW5lZCAmJiBpZCAhPT0gdW5kZWZpbmVkLCAnTWlzc2luZyAnICsgKGJveElkID8gJ2JveElkJyA6ICdpZCcpKTtcbiAgICByZXR1cm4gdGhpcy5fcG9ydElkc1tib3hJZF1baWRdO1xufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuX3BhdGggPSBmdW5jdGlvbiAoaWQpIHtcbiAgICB2YXIgcElkID0gdGhpcy5fcGF0aElkc1tpZF07XG4gICAgZm9yICh2YXIgaSA9IHRoaXMuX2dyYXBoLnBhdGhzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICBpZiAodGhpcy5fZ3JhcGgucGF0aHNbaV0uaWQgPT09IHBJZCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2dyYXBoLnBhdGhzW2ldO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xufTtcblxuLy8gQm94ZXNcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuX2NyZWF0ZUJveCA9IGZ1bmN0aW9uIChwYXJhbXMpIHtcbiAgICB2YXIgeDEgPSBwYXJhbXMueDEsXG4gICAgICAgIHgyID0gcGFyYW1zLngyLFxuICAgICAgICB5MSA9IHBhcmFtcy55MSxcbiAgICAgICAgeTIgPSBwYXJhbXMueTIsXG4gICAgICAgIGJveCA9IHRoaXMuX2dyYXBoLmNyZWF0ZUJveCgpLFxuICAgICAgICByZWN0ID0gbmV3IEFyUmVjdCh4MSwgeTEsIHgyLCB5Mik7XG5cbiAgICBhc3NlcnQoIWlzTmFOKHgxICsgeDIgKyB5MSArIHkyKSwgJ01pc3Npbmcgc2l6ZSBpbmZvIGZvciBib3gnKTtcblxuICAgIHRoaXMuX3NldFZhbGlkUmVjdFNpemUocmVjdCk7XG4gICAgYm94LnNldFJlY3QocmVjdCk7XG5cbiAgICAvLyBBZGQgdGhlIGJveCB0byB0aGUgZ3JhcGhcbiAgICB0aGlzLl9ncmFwaC5hZGRCb3goYm94KTtcbiAgICAvLyBSZWNvcmQga2VlcGluZyBpcyBub3QgZG9uZSBpbiB0aGlzIGZ1bmN0aW9uIGJjIHRoaXMgZnVuY3Rpb25cbiAgICAvLyBpcyByZXVzZWQgZm9yIHRoZSBwb3J0IGNvbnRhaW5lcnNcbiAgICByZXR1cm4gYm94O1xufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuX3VwZGF0ZUJveCA9IGZ1bmN0aW9uIChpZCwgcGFyYW1zKSB7ICAvLyBwdWJsaWMgaWRcbiAgICB2YXIgYm94ID0gdGhpcy5fYm94KGlkKSxcbiAgICAgICAgcmVjdCA9IGJveC5yZWN0LFxuICAgICAgICBuZXdXaWR0aCA9IHBhcmFtcy54MiAtIHBhcmFtcy54MSxcbiAgICAgICAgbmV3SGVpZ2h0ID0gcGFyYW1zLnkyIC0gcGFyYW1zLnkxLFxuICAgICAgICBkeCxcbiAgICAgICAgZHksXG4gICAgICAgIG5ld1JlY3Q7XG5cbiAgICAvLyBTaGlmdFxuICAgIGlmIChuZXdIZWlnaHQgPT09IHJlY3QuZ2V0SGVpZ2h0KCkgJiYgbmV3V2lkdGggPT09IHJlY3QuZ2V0V2lkdGgoKSkge1xuICAgICAgICBkeCA9IHBhcmFtcy54MSAtIHJlY3QubGVmdDtcbiAgICAgICAgZHkgPSBwYXJhbXMueTEgLSByZWN0LmNlaWw7XG4gICAgICAgIHRoaXMuX2dyYXBoLnNoaWZ0Qm94QnkoYm94LCB7Y3g6IGR4LCBjeTogZHl9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBuZXdSZWN0ID0gbmV3IEFyUmVjdChwYXJhbXMueDEsIHBhcmFtcy55MSwgcGFyYW1zLngyLCBwYXJhbXMueTIpO1xuICAgICAgICB0aGlzLl9ncmFwaC5zZXRCb3hSZWN0KGJveCwgbmV3UmVjdCk7XG4gICAgfVxuXG59O1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5fcmVtb3ZlQm94ID0gZnVuY3Rpb24gKGlkKSB7ICAvLyBwdWJsaWMgaWRcbiAgICB2YXIgYm94ID0gdGhpcy5fYm94KGlkKSxcbiAgICAgICAgcG9ydHMgPSBPYmplY3Qua2V5cyh0aGlzLl9wb3J0SWRzW2lkXSk7XG5cbiAgICAvLyBSZW1vdmUgYWxsIHBvcnRzXG4gICAgZm9yICh2YXIgaSA9IHBvcnRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICB0aGlzLl9yZW1vdmVQb3J0KGlkLCBwb3J0c1tpXSk7XG4gICAgfVxuXG4gICAgdGhpcy5fZ3JhcGguZGVsZXRlQm94KGJveCk7XG4gICAgZGVsZXRlIHRoaXMuX2JveElkc1tpZF07XG4gICAgZGVsZXRlIHRoaXMuX3BvcnRJZHNbaWRdO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXRoc1RvVXBkYXRlT25BZGRpdGlvbltpZF07XG59O1xuXG4vLyBQYXRoc1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5fY3JlYXRlUGF0aCA9IGZ1bmN0aW9uIChpZCwgc3JjSWQsIGRzdElkKSB7ICAvLyBwdWJsaWMgaWRcbiAgICB2YXIgc3JjUG9ydHMgPSB0aGlzLl9nZXRQb3J0c0ZvcihzcmNJZCksXG4gICAgICAgIGRzdFBvcnRzID0gdGhpcy5fZ2V0UG9ydHNGb3IoZHN0SWQpLFxuICAgICAgICBwb3J0cyA9IHNyY1BvcnRzLmNvbmNhdChkc3RQb3J0cyksXG4gICAgICAgIHBhdGg7XG5cbiAgICBhc3NlcnQoc3JjUG9ydHMsICdNaXNzaW5nIHNyY1BvcnRzICgnICsgc3JjUG9ydHMgKyAnKScpO1xuICAgIGFzc2VydChkc3RQb3J0cywgJ01pc3NpbmcgZHN0UG9ydHMgKCcgKyBkc3RQb3J0cyArICcpJyk7XG5cbiAgICBwYXRoID0gdGhpcy5fZ3JhcGguYWRkUGF0aCh0cnVlLCBzcmNQb3J0cywgZHN0UG9ydHMpO1xuICAgIHBhdGguaWQgPSBpZDtcbiAgICB0aGlzLl9wYXRoSWRzW2lkXSA9IHBhdGguaWQ7XG5cbiAgICAvLyBVcGRhdGUgdGhlIHVwZGF0ZXMgZGljdGlvbmFyaWVzXG4gICAgZm9yICh2YXIgaSA9IHBvcnRzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICBpZiAoIXRoaXMuX3BhdGhzVG9VcGRhdGVPbkRlbGV0aW9uW3BvcnRzW2ldLmlkXSkge1xuICAgICAgICAgICAgdGhpcy5fcGF0aHNUb1VwZGF0ZU9uRGVsZXRpb25bcG9ydHNbaV0uaWRdID0gW107XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fcGF0aHNUb1VwZGF0ZU9uRGVsZXRpb25bcG9ydHNbaV0uaWRdLnB1c2gocGF0aCk7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBzcmNJZCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9wYXRoc1RvVXBkYXRlT25BZGRpdGlvbltzcmNJZF0pIHtcbiAgICAgICAgICAgIHRoaXMuX3BhdGhzVG9VcGRhdGVPbkFkZGl0aW9uW3NyY0lkXSA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3BhdGhzVG9VcGRhdGVPbkFkZGl0aW9uW3NyY0lkXS5wdXNoKHBhdGgpO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIGRzdElkID09PSAnc3RyaW5nJykge1xuICAgICAgICBpZiAoIXRoaXMuX3BhdGhzVG9VcGRhdGVPbkFkZGl0aW9uW2RzdElkXSkge1xuICAgICAgICAgICAgdGhpcy5fcGF0aHNUb1VwZGF0ZU9uQWRkaXRpb25bZHN0SWRdID0gW107XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fcGF0aHNUb1VwZGF0ZU9uQWRkaXRpb25bZHN0SWRdLnB1c2gocGF0aCk7XG4gICAgfVxuICAgIHRoaXMuX3BhdGhTcmNbaWRdID0gc3JjSWQ7XG4gICAgdGhpcy5fcGF0aERzdFtpZF0gPSBkc3RJZDtcbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLl9nZXRQb3J0c0ZvciA9IGZ1bmN0aW9uIChib3hJZCkge1xuICAgIGlmIChib3hJZCBpbnN0YW5jZW9mIEFycmF5KSB7ICAvLyBsaXN0IG9mIHBvcnRzIC0+IG5vdCBhIGJveElkXG4gICAgICAgIC8vIEZJWE1FOiBUaGVzZSBwb3J0cyB3b3VsZCBhbHNvIG5lZWQgdG8gYmUgcmVzb2x2ZWQhXG4gICAgICAgIHJldHVybiBib3hJZDtcbiAgICB9IGVsc2UgeyAgLy8gYm94SWQgaXMgYSBib3ggaWQgLT4gZ2V0IHRoZSBwb3J0c1xuICAgICAgICB2YXIgcG9ydElkcyA9IE9iamVjdC5rZXlzKHRoaXMuX3BvcnRJZHNbYm94SWRdKSxcbiAgICAgICAgICAgIHBvcnRzID0gW107XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IHBvcnRJZHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgICAgICBhc3NlcnQodGhpcy5fcG9ydElkc1tib3hJZF1bcG9ydElkc1tpXV0ucG9ydHMubGVuZ3RoID09PSAxKTtcbiAgICAgICAgICAgIHBvcnRzLnB1c2godGhpcy5fcG9ydElkc1tib3hJZF1bcG9ydElkc1tpXV0ucG9ydHNbMF0pO1xuICAgICAgICB9XG4gICAgICAgIGFzc2VydChwb3J0cywgJ25vIHBvcnRzIGZvdW5kICgnICsgcG9ydHMgKyAnKScpO1xuICAgICAgICBmb3IgKHZhciBpID0gcG9ydHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgICAgICBhc3NlcnQgKHBvcnRzW2ldLm93bmVyLCAnSW52YWxpZCBvd25lcicpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBwb3J0cztcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5fdXBkYXRlUGF0aCA9IGZ1bmN0aW9uIChpZCwgc3JjSWQsIGRzdElkKSB7ICAvLyBwdWJsaWMgaWRcbiAgICB0aGlzLl9yZW1vdmVQYXRoKGlkKTtcbiAgICB0aGlzLl9jcmVhdGVQYXRoKGlkLCBzcmNJZCwgZHN0SWQpO1xufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuX3JlbW92ZVBhdGggPSBmdW5jdGlvbiAoaWQpIHsgIC8vIHB1YmxpYyBpZFxuICAgIHZhciBwYXRoID0gdGhpcy5fcGF0aChpZCk7XG4gICAgdGhpcy5fZ3JhcGguZGVsZXRlUGF0aChwYXRoKTtcbiAgICBkZWxldGUgdGhpcy5fcGF0aElkc1tpZF07XG4gICAgZGVsZXRlIHRoaXMuX3BhdGhTcmNbaWRdO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXRoRHN0W2lkXTtcbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLl9zZXRDdXN0b21QYXRoID0gZnVuY3Rpb24gKHBhdGgsIHBvaW50cykgeyAgLy8gcHVibGljIGlkXG4gICAgLy8gQ29udmVydCBwb2ludHMgdG8gYXJyYXkgb2YgQXJQb2ludHNcbiAgICBwb2ludHMgPSBwb2ludHMubWFwKGZ1bmN0aW9uIChwb2ludCkge1xuICAgICAgICByZXR1cm4gbmV3IEFyUG9pbnQocG9pbnRbMF0sIHBvaW50WzFdKTtcbiAgICB9KTtcblxuICAgIHBhdGguc2V0Q3VzdG9tUGF0aFBvaW50cyhwb2ludHMpO1xuICAgIHBhdGguc2V0QXV0b1JvdXRpbmcoZmFsc2UpO1xufTtcblxuLy8gUG9ydHNcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuX2NyZWF0ZVBvcnQgPSBmdW5jdGlvbiAoYm94SWQsIHBvcnRJZCwgYXJlYSkgeyAgLy8gYXJlYTogW1t4MSwgeTFdLCBbeDIsIHkyXV1cbiAgICB2YXIgYm94ID0gdGhpcy5fYm94KGJveElkKSxcbiAgICAgICAgY29udGFpbmVyLFxuICAgICAgICBjUmVjdCA9IG5ldyBBclJlY3QoKSxcbiAgICAgICAgcG9ydCA9IG5ldyBBdXRvUm91dGVyUG9ydCgpLFxuICAgICAgICByZWN0ID0gdGhpcy5fY3JlYXRlUmVjdEZyb21BcmVhKGFyZWEpLFxuICAgICAgICBhdHRyO1xuXG4gICAgLy8gQ3JlYXRlIHRoZSBwb3J0XG4gICAgYXR0ciA9IHRoaXMuX2dldFBvcnRBdHRyaWJ1dGVzKGJveC5yZWN0LCBhcmVhKTtcbiAgICBwb3J0LmlkID0gYm94SWQgKyAnL3xcXFxcJyArIHBvcnRJZDtcbiAgICBwb3J0LnNldExpbWl0ZWREaXJzKGZhbHNlKTtcbiAgICBwb3J0LmF0dHJpYnV0ZXMgPSBhdHRyO1xuICAgIHRoaXMuX3NldFZhbGlkUmVjdFNpemUocmVjdCk7XG4gICAgcG9ydC5zZXRSZWN0KHJlY3QpO1xuXG4gICAgLy8gQ3JlYXRlIGEgY29udGFpbmVyIHJlY3RcbiAgICBjUmVjdC5hc3NpZ24ocmVjdCk7XG4gICAgY1JlY3QuaW5mbGF0ZVJlY3QoMSk7XG4gICAgY29udGFpbmVyID0gdGhpcy5fY3JlYXRlQm94KHtcbiAgICAgICAgeDE6IGNSZWN0LmxlZnQsXG4gICAgICAgIHkxOiBjUmVjdC5jZWlsLFxuICAgICAgICB4MjogY1JlY3QucmlnaHQsXG4gICAgICAgIHkyOiBjUmVjdC5mbG9vclxuICAgIH0pO1xuXG4gICAgYm94LmFkZENoaWxkKGNvbnRhaW5lcik7XG4gICAgY29udGFpbmVyLmFkZFBvcnQocG9ydCk7XG4gICAgdGhpcy5fcG9ydElkc1tib3hJZF1bcG9ydElkXSA9IGNvbnRhaW5lcjtcblxuICAgIC8vIFVwZGF0ZSBwYXRocyBhcyBuZWVkZWRcbiAgICB2YXIgcGF0aHMgPSB0aGlzLl9wYXRoc1RvVXBkYXRlT25BZGRpdGlvbltib3hJZF0gfHwgW10sXG4gICAgICAgIHN0YXJ0LFxuICAgICAgICBlbmQ7XG5cbiAgICBmb3IgKHZhciBpID0gcGF0aHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIC8vIEdldCB0aGUgbmV3IHBvcnRzXG4gICAgICAgIHN0YXJ0ID0gdGhpcy5fZ2V0UG9ydHNGb3IodGhpcy5fcGF0aFNyY1twYXRoc1tpXS5pZF0pO1xuICAgICAgICBlbmQgPSB0aGlzLl9nZXRQb3J0c0Zvcih0aGlzLl9wYXRoRHN0W3BhdGhzW2ldLmlkXSk7XG5cbiAgICAgICAgLy8gRGlzY29ubmVjdCBhbmQgdXBkYXRlIHBhdGhcbiAgICAgICAgdGhpcy5fZ3JhcGguZGlzY29ubmVjdChwYXRoc1tpXSk7XG4gICAgICAgIGlmIChzdGFydC5sZW5ndGggJiYgZW5kLmxlbmd0aCkge1xuICAgICAgICAgICAgcGF0aHNbaV0uc2V0U3RhcnRFbmRQb3J0cyhzdGFydCwgZW5kKTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLl9jcmVhdGVSZWN0RnJvbUFyZWEgPSBmdW5jdGlvbiAoYXJlYSkge1xuICAgIHZhciByZWN0ID0gbmV3IEFyUmVjdChhcmVhLngxLCBhcmVhLnkxLCBhcmVhLngyLCBhcmVhLnkyKTtcbiAgICB0aGlzLl9zZXRWYWxpZFJlY3RTaXplKHJlY3QpO1xuICAgIHJldHVybiByZWN0O1xufTtcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuX2dldFBvcnRBdHRyaWJ1dGVzID0gZnVuY3Rpb24gKHJlY3QsIGFyZWEpIHtcbiAgICB2YXIgYXR0ciA9IDAsXG4gICAgICAgIHgxID0gYXJlYS54MSxcbiAgICAgICAgeDIgPSBhcmVhLngyLFxuICAgICAgICB5MSA9IGFyZWEueTEsXG4gICAgICAgIHkyID0gYXJlYS55MixcbiAgICAgICAgaG9yaXpvbnRhbCA9IHkxID09PSB5MjtcblxuICAgIGlmIChob3Jpem9udGFsKSB7XG4gICAgICAgIGlmIChNYXRoLmFicyh5MSAtIHJlY3QuY2VpbCkgPCBNYXRoLmFicyh5MSAtIHJlY3QuZmxvb3IpKSB7ICAvLyBDbG9zZXIgdG8gdGhlIHRvcFxuICAgICAgICAgICAgYXR0ciA9IENPTlNUQU5UUy5Qb3J0U3RhcnRPblRvcCArIENPTlNUQU5UUy5Qb3J0RW5kT25Ub3A7XG4gICAgICAgIH0gZWxzZSB7ICAvLyBDbG9zZXIgdG8gdGhlIHRvcCAoaG9yaXpvbnRhbClcbiAgICAgICAgICAgIGF0dHIgPSBDT05TVEFOVFMuUG9ydFN0YXJ0T25Cb3R0b20gKyBDT05TVEFOVFMuUG9ydEVuZE9uQm90dG9tO1xuICAgICAgICB9XG5cbiAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoTWF0aC5hYnMoeDEgLSByZWN0LmxlZnQpIDwgTWF0aC5hYnMoeDEgLSByZWN0LnJpZ2h0KSkgeyAgLy8gQ2xvc2VyIHRvIHRoZSBsZWZ0XG4gICAgICAgICAgICBhdHRyID0gQ09OU1RBTlRTLlBvcnRTdGFydE9uTGVmdCArIENPTlNUQU5UUy5Qb3J0RW5kT25MZWZ0O1xuICAgICAgICB9IGVsc2UgeyAgLy8gQ2xvc2VyIHRvIHRoZSByaWdodCAodmVydGljYWwpXG4gICAgICAgICAgICBhdHRyID0gQ09OU1RBTlRTLlBvcnRTdGFydE9uUmlnaHQgKyBDT05TVEFOVFMuUG9ydEVuZE9uUmlnaHQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gYXR0cjtcbn07XG5cbkF1dG9Sb3V0ZXIucHJvdG90eXBlLl91cGRhdGVQb3J0ID0gZnVuY3Rpb24gKGJveElkLCBwb3J0SWQsIGFyZWEpIHtcbiAgICB2YXIgYm94ID0gdGhpcy5fYm94KGJveElkKSxcbiAgICAgICAgY29udGFpbmVyID0gdGhpcy5fcG9ydChib3hJZCwgcG9ydElkKSxcbiAgICAgICAgY1JlY3QgPSBjb250YWluZXIucmVjdCxcbiAgICAgICAgcG9ydCA9IGNvbnRhaW5lci5wb3J0c1swXSxcbiAgICAgICAgcmVjdCA9IHRoaXMuX2NyZWF0ZVJlY3RGcm9tQXJlYShhcmVhKSxcbiAgICAgICAgYXR0cjtcblxuICAgIC8vIFVwZGF0ZSB0aGUgcG9ydCdzIHJlY3RcbiAgICBhdHRyID0gdGhpcy5fZ2V0UG9ydEF0dHJpYnV0ZXMoYm94LnJlY3QsIGFyZWEpO1xuICAgIHBvcnQuc2V0TGltaXRlZERpcnMoZmFsc2UpO1xuICAgIHBvcnQuYXR0cmlidXRlcyA9IGF0dHI7XG4gICAgdGhpcy5fc2V0VmFsaWRSZWN0U2l6ZShyZWN0KTtcbiAgICBwb3J0LnNldFJlY3QocmVjdCk7XG5cbiAgICBjUmVjdC5hc3NpZ24ocG9ydC5yZWN0KTtcbiAgICBjUmVjdC5pbmZsYXRlUmVjdCgxKTtcbiAgICBjb250YWluZXIuc2V0UmVjdChjUmVjdCk7XG59O1xuXG5BdXRvUm91dGVyLnByb3RvdHlwZS5fcmVtb3ZlUG9ydCA9IGZ1bmN0aW9uIChib3hJZCwgcG9ydElkKSB7XG4gICAgdmFyIGNvbnRhaW5lciA9IHRoaXMuX3BvcnQoYm94SWQsIHBvcnRJZCksXG4gICAgICAgIHBvcnQgPSBjb250YWluZXIucG9ydHNbMF0sXG4gICAgICAgIHBhdGhzID0gdGhpcy5fcGF0aHNUb1VwZGF0ZU9uRGVsZXRpb25bcG9ydC5pZF0gfHwgW10sXG4gICAgICAgIHN0YXJ0LFxuICAgICAgICBlbmQ7XG5cbiAgICB0aGlzLl9ncmFwaC5kZWxldGVCb3goY29udGFpbmVyKTtcblxuICAgIC8vIFVwZGF0ZSBwYXRoc1xuICAgIGRlbGV0ZSB0aGlzLl9wYXRoc1RvVXBkYXRlT25EZWxldGlvbltwb3J0LmlkXTtcbiAgICBmb3IgKHZhciBpID0gcGF0aHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHN0YXJ0ID0gcGF0aHNbaV0uc3RhcnRwb3J0cztcbiAgICAgICAgZW5kID0gcGF0aHNbaV0uZW5kcG9ydHM7XG4gICAgICAgIHV0aWxzLnJlbW92ZUZyb21BcnJheXMocG9ydCwgc3RhcnQsIGVuZCk7XG4gICAgICAgIGlmIChzdGFydC5sZW5ndGggJiYgZW5kLmxlbmd0aCkge1xuICAgICAgICAgICAgcGF0aHNbaV0uc2V0U3RhcnRFbmRQb3J0cyhzdGFydCwgZW5kKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBkZWxldGUgdGhpcy5fcG9ydElkc1tib3hJZF1bcG9ydElkXTtcbn07XG5cbi8vIFNoYXJlZCB1dGlsaXRpZXNcblxuQXV0b1JvdXRlci5wcm90b3R5cGUuX3NldFZhbGlkUmVjdFNpemUgPSBmdW5jdGlvbiAocmVjdCkge1xuICAgIC8vIE1ha2Ugc3VyZSB0aGUgcmVjdCBpcyBhdCBsZWFzdCAzeDNcbiAgICB2YXIgaGVpZ2h0ID0gcmVjdC5nZXRIZWlnaHQoKSxcbiAgICAgICAgd2lkdGggPSByZWN0LmdldFdpZHRoKCksXG4gICAgICAgIGR4ID0gTWF0aC5tYXgoKDMgLSB3aWR0aCkgLyAyLCAwKSxcbiAgICAgICAgZHkgPSBNYXRoLm1heCgoMyAtIGhlaWdodCkgLyAyLCAwKTtcblxuICAgIHJlY3QuaW5mbGF0ZVJlY3QoZHgsIGR5KTtcbiAgICByZXR1cm4gcmVjdDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQXV0b1JvdXRlcjtcbiIsIi8qanNoaW50IG5vZGU6dHJ1ZSwgbW9jaGE6dHJ1ZSovXG4vKipcbiAqIEBhdXRob3IgYnJvbGxiIC8gaHR0cHM6Ly9naXRodWIuY29tL2Jyb2xsYlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIHNyY1BhdGggPSAnLi8uLi8uLi9zcmMvJyxcbiAgICBBY3Rpb25BcHBsaWVyID0gcmVxdWlyZSgnLi8uLi8uLi9zcmMvQXV0b1JvdXRlci5BY3Rpb25BcHBsaWVyJyksXG4gICAgbm9wID0gZnVuY3Rpb24oKXt9LFxuICAgIGV4dGVuZCA9IHJlcXVpcmUoJ2xvZGFzaC5hc3NpZ24nKSxcbiAgICBhc3NlcnQgPSByZXF1aXJlKCdhc3NlcnQnKSxcbiAgICB2ZXJib3NlLFxuICAgIEhFQURFUiA9ICdBVVRPUk9VVEVSIFJFUExBWUVSOlxcdCcsXG4gICAgV29ya2VyIC8qPSByZXF1aXJlKCd3ZWJ3b3JrZXItdGhyZWFkcycpLldvcmtlciovO1xuXG52YXIgQXV0b1JvdXRlclJlcGxheWVyID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMubG9nZ2VyID0ge2Vycm9yOiBjb25zb2xlLmxvZ307XG5cbiAgICAvLyBXZWIgd29ya2VyIHN1cHBvcnRcbiAgICB0aGlzLnVzaW5nV2ViV29ya2VyID0gZmFsc2U7XG4gICAgdGhpcy5vbkZpbmlzaGVkID0gZmFsc2U7XG4gICAgdGhpcy51c2VXZWJXb3JrZXIoKTtcbiAgICB0aGlzLmV4cGVjdGVkRXJyb3JzID0gW107XG4gICAgdGhpcy5fcXVldWUgPSBudWxsO1xuICAgIHRoaXMuX2NvdW50ID0gbnVsbDtcbn07XG5cbkF1dG9Sb3V0ZXJSZXBsYXllci5wcm90b3R5cGUubG9nID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBtc2csXG4gICAgICAgIGk7XG5cbiAgICBpZiAodmVyYm9zZSkge1xuICAgICAgICBtc2cgPSBbSEVBREVSXTtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICAgICAgbXNnLnB1c2goYXJndW1lbnRzW2ldKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zb2xlLmxvZy5hcHBseShudWxsLCBtc2cpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJSZXBsYXllci5wcm90b3R5cGUudGVzdExvY2FsID0gZnVuY3Rpb24gKGFjdGlvbnMsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgdmFyIGJlZm9yZSxcbiAgICAgICAgYWZ0ZXIsXG4gICAgICAgIGxhc3QsXG5cbiAgICAgICAgaTtcblxuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMykge1xuICAgICAgICBjYWxsYmFjayA9IG9wdGlvbnM7XG4gICAgfVxuXG4gICAgLy8gVW5wYWNrIHRoZSBvcHRpb25zXG4gICAgdGhpcy5pbml0KCk7XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgdmVyYm9zZSA9IG9wdGlvbnMudmVyYm9zZSB8fCBmYWxzZTtcbiAgICBiZWZvcmUgPSBvcHRpb25zLmJlZm9yZSB8fCBub3A7XG4gICAgYWZ0ZXIgPSBvcHRpb25zLmFmdGVyIHx8IG5vcDtcbiAgICBjYWxsYmFjayA9IGNhbGxiYWNrIHx8IG5vcDtcbiAgICBsYXN0ID0gb3B0aW9ucy5hY3Rpb25Db3VudCB8fCBhY3Rpb25zLmxlbmd0aDtcblxuICAgIC8vIFJ1biB0aGUgdGVzdHNcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGFzdDsgaSArPSAxKSB7XG4gICAgICAgIHRoaXMubG9nKCdDYWxsaW5nIEFjdGlvbiAjJyArIGkgKyAnOicsIGFjdGlvbnNbaV0uYWN0aW9uLCAnd2l0aCcsIGFjdGlvbnNbaV0uYXJncyk7XG4gICAgICAgIGJlZm9yZSh0aGlzLmF1dG9yb3V0ZXIsIGkpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgdGhpcy5faW52b2tlQXV0b1JvdXRlck1ldGhvZFVuc2FmZShhY3Rpb25zW2ldLmFjdGlvbiwgYWN0aW9uc1tpXS5hcmdzKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLl9pc0V4cGVjdGVkRXJyb3IoZS5tZXNzYWdlKSkge1xuICAgICAgICAgICAgICAgIHRocm93IGU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYWZ0ZXIodGhpcy5hdXRvcm91dGVyLCBpKTtcbiAgICB9XG5cbiAgICBjYWxsYmFjaygpO1xufTtcblxuLy8gV2ViIHdvcmtlciBmdW5jdGlvbmFsaXR5XG4vKipcbiAqIFNldCB0aGUgQXV0b1JvdXRlclJlcGxheWVyIHRvIHVzZSBhIHdlYiB3b3JrZXIgb3Igbm90LlxuICpcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gW3VzaW5nV2ViV29ya2VyXVxuICogQHJldHVybiB7dW5kZWZpbmVkfVxuICovXG5BdXRvUm91dGVyUmVwbGF5ZXIucHJvdG90eXBlLnVzZVdlYldvcmtlciA9IGZ1bmN0aW9uICh1c2luZ1dlYldvcmtlcikge1xuICAgIGlmICh1c2luZ1dlYldvcmtlcikgeyAgLy8gRW5hYmxlIHdlYiB3b3JrZXJcbiAgICAgICAgdGhpcy50ZXN0ID0gQXV0b1JvdXRlclJlcGxheWVyLnByb3RvdHlwZS50ZXN0V2l0aFdlYldvcmtlcjtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnRlc3QgPSBBdXRvUm91dGVyUmVwbGF5ZXIucHJvdG90eXBlLnRlc3RMb2NhbDtcbiAgICB9XG4gICAgdGhpcy51c2luZ1dlYldvcmtlciA9IHVzaW5nV2ViV29ya2VyO1xufTtcblxuLy8gRklYTUU6IFRlc3QgdGhlIHdlYiB3b3JrZXJcbkF1dG9Sb3V0ZXJSZXBsYXllci5wcm90b3R5cGUuX2NyZWF0ZVdlYldvcmtlciA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgIHZhciB3b3JrZXJGaWxlID0gc3JjUGF0aCArICdBdXRvUm91dGVyLldvcmtlci5qcyc7XG4gICAgYXNzZXJ0KCEhV29ya2VyLCAnV2ViIFdvcmtlcnMgYXJlIG5vdCBzdXBwb3J0ZWQgaW4geW91ciBlbnZpcm9ubWVudCcpO1xuXG4gICAgdGhpcy5sb2coJ0NyZWF0aW5nIHdlYiB3b3JrZXInKTtcbiAgICBpZiAodGhpcy5fd29ya2VyKSB7XG4gICAgICAgIHRoaXMuX3dvcmtlci50ZXJtaW5hdGUoKTtcbiAgICB9XG4gICAgdGhpcy5fd29ya2VyID0gbmV3IFdvcmtlcih3b3JrZXJGaWxlKTtcbiAgICB0aGlzLmxvZygnU2VuZGluZzonLHt9KTtcbiAgICB0aGlzLl93b3JrZXIucG9zdE1lc3NhZ2UoW3t9LCB0cnVlXSk7XG5cbiAgICB0aGlzLl93b3JrZXIub25tZXNzYWdlID0gZnVuY3Rpb24ocmVzcG9uc2UpIHtcbiAgICAgICAgdGhpcy5sb2coJ0NyZWF0ZWQgd2ViIHdvcmtlcicpO1xuICAgICAgICBhc3NlcnQocmVzcG9uc2UuZGF0YSA9PT0gJ1JFQURZJyk7XG4gICAgICAgIHRoaXMuX3dvcmtlci5vbm1lc3NhZ2UgPSB0aGlzLl9vbldvcmtlck1lc3NhZ2UuYmluZCh0aGlzKTtcbiAgICAgICAgY2FsbGJhY2soKTtcbiAgICB9LmJpbmQodGhpcyk7XG59O1xuXG4vKipcbiAqIENsZWFuIHVwIHJlc291cmNlcyB1c2VkIGZvciB0ZXN0aW5nIChuYW1lbHkgdGhlIHdlYiB3b3JrZXIpLlxuICpcbiAqIEByZXR1cm4ge3VuZGVmaW5lZH1cbiAqL1xuQXV0b1JvdXRlclJlcGxheWVyLnByb3RvdHlwZS50ZWFyZG93biA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodGhpcy5fd29ya2VyKSB7XG4gICAgICAgIHRoaXMuX3dvcmtlci50ZXJtaW5hdGUoKTtcbiAgICAgICAgdGhpcy5fd29ya2VyID0gbnVsbDtcbiAgICB9XG59O1xuXG5BdXRvUm91dGVyUmVwbGF5ZXIucHJvdG90eXBlLnRlc3RXaXRoV2ViV29ya2VyID0gZnVuY3Rpb24gKGFjdGlvbnMsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgdmFyIGxhc3Q7XG5cbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICB2ZXJib3NlID0gb3B0aW9ucy52ZXJib3NlIHx8IGZhbHNlO1xuICAgIGxhc3QgPSBvcHRpb25zLmFjdGlvbkNvdW50IHx8IGFjdGlvbnMubGVuZ3RoO1xuXG4gICAgdGhpcy5fY291bnQgPSAwO1xuICAgIHRoaXMuX3F1ZXVlID0gYWN0aW9ucy5zbGljZSgwLGxhc3QpO1xuXG4gICAgYXNzZXJ0KHRoaXMuX3F1ZXVlLmxlbmd0aCwgJ1JlY2VpdmVkIGFuIGVtcHR5IGxpc3Qgb2YgYWN0aW9ucycpO1xuICAgIHRoaXMuX2NyZWF0ZVdlYldvcmtlcih0aGlzLl9jYWxsTmV4dC5iaW5kKHRoaXMpKTtcbiAgICB0aGlzLm9uRmluaXNoZWQgPSBjYWxsYmFjaztcbn07XG5cbkF1dG9Sb3V0ZXJSZXBsYXllci5wcm90b3R5cGUuX29uV29ya2VyTWVzc2FnZSA9IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgdmFyIHJlc3BvbnNlID0gZGF0YS5kYXRhO1xuICAgIHRoaXMubG9nKCdXZWIgd29ya2VyIHJlc3BvbmRlZDonK3Jlc3BvbnNlKTtcbiAgICBpZiAodHlwZW9mIHJlc3BvbnNlWzJdID09PSAnc3RyaW5nJyAmJiByZXNwb25zZVsyXS5pbmRleE9mKCdFcnJvcicpID09PSAwKSB7XG4gICAgICAgIGFzc2VydCh0aGlzLl9pc0V4cGVjdGVkRXJyb3IocmVzcG9uc2VbMl0pLCAnVW5leHBlY3RlZCBlcnJvcjogJytyZXNwb25zZVsyXSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX3F1ZXVlLmxlbmd0aCkge1xuICAgICAgICB0aGlzLl9jYWxsTmV4dCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGlmICh0aGlzLm9uRmluaXNoZWQpIHtcbiAgICAgICAgICAgIHRoaXMub25GaW5pc2hlZCgpO1xuICAgICAgICAgICAgdGhpcy5vbkZpbmlzaGVkID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBhc3NlcnQodGhpcy5leHBlY3RlZEVycm9ycy5sZW5ndGggPT09IDApO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJSZXBsYXllci5wcm90b3R5cGUuX2lzRXhwZWN0ZWRFcnJvciA9IGZ1bmN0aW9uIChlcnJvcikge1xuICAgIGZvciAodmFyIGkgPSB0aGlzLmV4cGVjdGVkRXJyb3JzLmxlbmd0aDsgaS0tOykge1xuICAgICAgICBpZiAodGhpcy5leHBlY3RlZEVycm9yc1tpXS50ZXN0KGVycm9yKSkge1xuICAgICAgICAgICAgdGhpcy5leHBlY3RlZEVycm9ycy5zcGxpY2UoaSwxKTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbn07XG5cbkF1dG9Sb3V0ZXJSZXBsYXllci5wcm90b3R5cGUuX2NhbGxOZXh0ID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciB0YXNrID0gdGhpcy5fcXVldWUuc2hpZnQoKTtcbiAgICB0aGlzLmxvZygnQ2FsbGluZyBBY3Rpb24gIycgKyB0aGlzLl9jb3VudCArICc6JywgdGFzay5hY3Rpb24sICd3aXRoJywgdGFzay5hcmdzKTtcbiAgICB0aGlzLl93b3JrZXIucG9zdE1lc3NhZ2UoW3Rhc2suYWN0aW9uLCB0YXNrLmFyZ3NdKTtcbn07XG5cbi8qICogKiAqICogKiAqICogUXVlcnlpbmcgdGhlIEF1dG9Sb3V0ZXIgKiAqICogKiAqICogKiAqL1xuQXV0b1JvdXRlclJlcGxheWVyLnByb3RvdHlwZS5nZXRQYXRoUG9pbnRzID0gZnVuY3Rpb24gKHBhdGhJZCwgY2FsbGJhY2spIHtcbiAgICBpZiAodGhpcy51c2luZ1dlYldvcmtlcikgeyAgLy8gRW5hYmxlIHdlYiB3b3JrZXJcbiAgICAgICAgdGhpcy5fd29ya2VyLm9ubWVzc2FnZSA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICAgIGlmIChkYXRhLmRhdGFbMF0gPT09ICdnZXRQYXRoUG9pbnRzJyAmJiBwYXRoSWQgPT09IGRhdGEuZGF0YVsxXVswXSkge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGRhdGEuZGF0YVsyXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuX3dvcmtlci5wb3N0TWVzc2FnZShbJ2dldFBhdGhQb2ludHMnLCBbcGF0aElkXV0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBpZCA9IHRoaXMuX2F1dG9yb3V0ZXJQYXRoc1twYXRoSWRdO1xuICAgICAgICBjYWxsYmFjayh0aGlzLmF1dG9yb3V0ZXIuZ2V0UGF0aFBvaW50cyhpZCkpO1xuICAgIH1cbn07XG5cbkF1dG9Sb3V0ZXJSZXBsYXllci5wcm90b3R5cGUuZ2V0Qm94UmVjdCA9IGZ1bmN0aW9uIChib3hJZCwgY2FsbGJhY2spIHtcbiAgICBpZiAodGhpcy51c2luZ1dlYldvcmtlcikgeyAgLy8gRW5hYmxlIHdlYiB3b3JrZXJcbiAgICAgICAgdGhpcy5fd29ya2VyLm9ubWVzc2FnZSA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICAgIGlmIChkYXRhLmRhdGFbMF0gPT09ICdnZXRCb3hSZWN0JyAmJiBib3hJZCA9PT0gZGF0YS5kYXRhWzFdWzBdKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZGF0YS5kYXRhWzJdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5fd29ya2VyLnBvc3RNZXNzYWdlKFsnZ2V0Qm94UmVjdCcsIFtib3hJZF1dKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgcmVjdCA9IHRoaXMuX2F1dG9yb3V0ZXJCb3hlc1tib3hJZF0uYm94LnJlY3Q7XG4gICAgICAgIGNhbGxiYWNrKHJlY3QpO1xuICAgIH1cbn07XG5cbmV4dGVuZChBdXRvUm91dGVyUmVwbGF5ZXIucHJvdG90eXBlLCBBY3Rpb25BcHBsaWVyLnByb3RvdHlwZSk7XG5cbm1vZHVsZS5leHBvcnRzID0gQXV0b1JvdXRlclJlcGxheWVyO1xuIl19
