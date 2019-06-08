var Module = function () {
  var _scriptDir = typeof document !== 'undefined' && document.currentScript ? document.currentScript.src : undefined;

  return function (Module) {
    Module = Module || {}; // Copyright 2010 The Emscripten Authors.  All rights reserved.
    // Emscripten is available under two separate licenses, the MIT license and the
    // University of Illinois/NCSA Open Source License.  Both these licenses can be
    // found in the LICENSE file.
    // The Module object: Our interface to the outside world. We import
    // and export values on it. There are various ways Module can be used:
    // 1. Not defined. We create it here
    // 2. A function parameter, function(Module) { ..generated code.. }
    // 3. pre-run appended it, var Module = {}; ..generated code..
    // 4. External script tag defines var Module.
    // We need to check if Module already exists (e.g. case 3 above).
    // Substitution will be replaced with actual code on later stage of the build,
    // this way Closure Compiler will not mangle it (e.g. case 4. above).
    // Note that if you want to run closure, and also to use Module
    // after the generated code, you will need to define   var Module = {};
    // before the code. Then that object will be used in the code, and you
    // can continue to use Module afterwards as well.

    var Module = typeof Module !== 'undefined' ? Module : {}; // --pre-jses are emitted after the Module integration code, so that they can
    // refer to Module (if they choose; they can also define Module)
    // {{PRE_JSES}}
    // Sometimes an existing Module object exists with properties
    // meant to overwrite the default module functionality. Here
    // we collect those properties and reapply _after_ we configure
    // the current environment's defaults to avoid having to be so
    // defensive during initialization.

    var moduleOverrides = {};
    var key;

    for (key in Module) {
      if (Module.hasOwnProperty(key)) {
        moduleOverrides[key] = Module[key];
      }
    }

    Module['arguments'] = [];
    Module['thisProgram'] = './this.program';

    Module['quit'] = function (status, toThrow) {
      throw toThrow;
    };

    Module['preRun'] = [];
    Module['postRun'] = []; // Determine the runtime environment we are in. You can customize this by
    // setting the ENVIRONMENT setting at compile time (see settings.js).

    var ENVIRONMENT_IS_WEB = false;
    var ENVIRONMENT_IS_WORKER = false;
    var ENVIRONMENT_IS_NODE = false;
    var ENVIRONMENT_IS_SHELL = false;
    ENVIRONMENT_IS_WEB = typeof window === 'object';
    ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
    ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function' && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
    ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

    if (Module['ENVIRONMENT']) {
      throw new Error('Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -s ENVIRONMENT=web or -s ENVIRONMENT=node)');
    } // Three configurations we can be running in:
    // 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
    // 2) We could be the application main() thread proxied to worker. (with Emscripten -s PROXY_TO_WORKER=1) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
    // 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)
    // `/` should be present at the end if `scriptDirectory` is not empty


    var scriptDirectory = '';

    function locateFile(path) {
      if (Module['locateFile']) {
        return Module['locateFile'](path, scriptDirectory);
      } else {
        return scriptDirectory + path;
      }
    }

    if (ENVIRONMENT_IS_NODE) {
      scriptDirectory = __dirname + '/'; // Expose functionality in the same simple way that the shells work
      // Note that we pollute the global namespace here, otherwise we break in node

      var nodeFS;
      var nodePath;

      Module['read'] = function shell_read(filename, binary) {
        var ret;
        if (!nodeFS) { nodeFS = require('fs'); }
        if (!nodePath) { nodePath = require('path'); }
        filename = nodePath['normalize'](filename);
        ret = nodeFS['readFileSync'](filename);
        return binary ? ret : ret.toString();
      };

      Module['readBinary'] = function readBinary(filename) {
        var ret = Module['read'](filename, true);

        if (!ret.buffer) {
          ret = new Uint8Array(ret);
        }

        assert(ret.buffer);
        return ret;
      };

      if (process['argv'].length > 1) {
        Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/');
      }

      Module['arguments'] = process['argv'].slice(2); // MODULARIZE will export the module in the proper place outside, we don't need to export here

      process['on']('uncaughtException', function (ex) {
        // suppress ExitStatus exceptions from showing an error
        if (!(ex instanceof ExitStatus)) {
          throw ex;
        }
      }); // Currently node will swallow unhandled rejections, but this behavior is
      // deprecated, and in the future it will exit with error status.

      process['on']('unhandledRejection', abort);

      Module['quit'] = function (status) {
        process['exit'](status);
      };

      Module['inspect'] = function () {
        return '[Emscripten Module object]';
      };
    } else if (ENVIRONMENT_IS_SHELL) {
      if (typeof read != 'undefined') {
        Module['read'] = function shell_read(f) {
          return read(f);
        };
      }

      Module['readBinary'] = function readBinary(f) {
        var data;

        if (typeof readbuffer === 'function') {
          return new Uint8Array(readbuffer(f));
        }

        data = read(f, 'binary');
        assert(typeof data === 'object');
        return data;
      };

      if (typeof scriptArgs != 'undefined') {
        Module['arguments'] = scriptArgs;
      } else if (typeof arguments != 'undefined') {
        Module['arguments'] = arguments;
      }

      if (typeof quit === 'function') {
        Module['quit'] = function (status) {
          quit(status);
        };
      }
    } else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
      if (ENVIRONMENT_IS_WORKER) {
        // Check worker, not web, since window could be polyfilled
        scriptDirectory = self.location.href;
      } else if (document.currentScript) {
        // web
        scriptDirectory = document.currentScript.src;
      } // When MODULARIZE (and not _INSTANCE), this JS may be executed later, after document.currentScript
      // is gone, so we saved it, and we use it here instead of any other info.


      if (_scriptDir) {
        scriptDirectory = _scriptDir;
      } // blob urls look like blob:http://site.com/etc/etc and we cannot infer anything from them.
      // otherwise, slice off the final part of the url to find the script directory.
      // if scriptDirectory does not contain a slash, lastIndexOf will return -1,
      // and scriptDirectory will correctly be replaced with an empty string.


      if (scriptDirectory.indexOf('blob:') !== 0) {
        scriptDirectory = scriptDirectory.substr(0, scriptDirectory.lastIndexOf('/') + 1);
      } else {
        scriptDirectory = '';
      }

      Module['read'] = function shell_read(url) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, false);
        xhr.send(null);
        return xhr.responseText;
      };

      if (ENVIRONMENT_IS_WORKER) {
        Module['readBinary'] = function readBinary(url) {
          var xhr = new XMLHttpRequest();
          xhr.open('GET', url, false);
          xhr.responseType = 'arraybuffer';
          xhr.send(null);
          return new Uint8Array(xhr.response);
        };
      }

      Module['readAsync'] = function readAsync(url, onload, onerror) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'arraybuffer';

        xhr.onload = function xhr_onload() {
          if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
            // file URLs can return 0
            onload(xhr.response);
            return;
          }

          onerror();
        };

        xhr.onerror = onerror;
        xhr.send(null);
      };

      Module['setWindowTitle'] = function (title) {
        document.title = title;
      };
    } else {
      throw new Error('environment detection error');
    } // Set up the out() and err() hooks, which are how we can print to stdout or
    // stderr, respectively.
    // If the user provided Module.print or printErr, use that. Otherwise,
    // console.log is checked first, as 'print' on the web will open a print dialogue
    // printErr is preferable to console.warn (works better in shells)
    // bind(console) is necessary to fix IE/Edge closed dev tools panel behavior.


    var out = Module['print'] || (typeof console !== 'undefined' ? console.log.bind(console) : typeof print !== 'undefined' ? print : null);
    var err = Module['printErr'] || (typeof printErr !== 'undefined' ? printErr : typeof console !== 'undefined' && console.warn.bind(console) || out); // Merge back in the overrides

    for (key in moduleOverrides) {
      if (moduleOverrides.hasOwnProperty(key)) {
        Module[key] = moduleOverrides[key];
      }
    } // Free the object hierarchy contained in the overrides, this lets the GC
    // reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.


    moduleOverrides = undefined; // perform assertions in shell.js after we set up out() and err(), as otherwise if an assertion fails it cannot print the message

    assert(typeof Module['memoryInitializerPrefixURL'] === 'undefined', 'Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead');
    assert(typeof Module['pthreadMainPrefixURL'] === 'undefined', 'Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead');
    assert(typeof Module['cdInitializerPrefixURL'] === 'undefined', 'Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead');
    assert(typeof Module['filePackagePrefixURL'] === 'undefined', 'Module.filePackagePrefixURL option was removed, use Module.locateFile instead'); // Copyright 2017 The Emscripten Authors.  All rights reserved.
    // should not be used before it is ready

    stackSave = stackRestore = stackAlloc = function () {
      abort('cannot use the stack before compiled code is ready to run, and has provided stack access');
    };

    function warnOnce(text) {
      if (!warnOnce.shown) { warnOnce.shown = {}; }

      if (!warnOnce.shown[text]) {
        warnOnce.shown[text] = 1;
        err(text);
      }
    }

    var asm2wasmImports = {
      // special asm2wasm imports
      "f64-rem": function (x, y) {
        return x % y;
      },
      "debugger": function () {
        debugger;
      }
    };

    var tempRet0 = 0;

    var setTempRet0 = function (value) {
      tempRet0 = value;
    };

    var getTempRet0 = function () {
      return tempRet0;
    };
    // Documentation for the public APIs defined in this file must be updated in:
    //    site/source/docs/api_reference/preamble.js.rst
    // A prebuilt local version of the documentation is available at:
    //    site/build/text/docs/api_reference/preamble.js.txt
    // You can also build docs locally as HTML or other formats in site/
    // An online HTML version (which may be of a different version of Emscripten)
    //    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html

    if (typeof WebAssembly !== 'object') {
      abort('No WebAssembly support found. Build with -s WASM=0 to target JavaScript instead.');
    }


    var wasmMemory; // Potentially used for direct table calls.

    var wasmTable; //========================================
    // Runtime essentials
    //========================================
    // whether we are quitting the application. no code should run after this.
    // set in exit() and abort()

    var ABORT = false; // set by exit() and abort().  Passed to 'onExit' handler.
    /** @type {function(*, string=)} */

    function assert(condition, text) {
      if (!condition) {
        abort('Assertion failed: ' + text);
      }
    } // Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
    // a copy of that string as a Javascript String object.


    var UTF8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;
    /**
     * @param {number} idx
     * @param {number=} maxBytesToRead
     * @return {string}
     */

    function UTF8ArrayToString(u8Array, idx, maxBytesToRead) {
      var endIdx = idx + maxBytesToRead;
      var endPtr = idx; // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
      // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
      // (As a tiny code save trick, compare endPtr against endIdx using a negation, so that undefined means Infinity)

      while (u8Array[endPtr] && !(endPtr >= endIdx)) { ++endPtr; }

      if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
        return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
      } else {
        var str = ''; // If building with TextDecoder, we have already computed the string length above, so test loop end condition against that

        while (idx < endPtr) {
          // For UTF8 byte structure, see:
          // http://en.wikipedia.org/wiki/UTF-8#Description
          // https://www.ietf.org/rfc/rfc2279.txt
          // https://tools.ietf.org/html/rfc3629
          var u0 = u8Array[idx++];

          if (!(u0 & 0x80)) {
            str += String.fromCharCode(u0);
            continue;
          }

          var u1 = u8Array[idx++] & 63;

          if ((u0 & 0xE0) == 0xC0) {
            str += String.fromCharCode((u0 & 31) << 6 | u1);
            continue;
          }

          var u2 = u8Array[idx++] & 63;

          if ((u0 & 0xF0) == 0xE0) {
            u0 = (u0 & 15) << 12 | u1 << 6 | u2;
          } else {
            if ((u0 & 0xF8) != 0xF0) { warnOnce('Invalid UTF-8 leading byte 0x' + u0.toString(16) + ' encountered when deserializing a UTF-8 string on the asm.js/wasm heap to a JS string!'); }
            u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | u8Array[idx++] & 63;
          }

          if (u0 < 0x10000) {
            str += String.fromCharCode(u0);
          } else {
            var ch = u0 - 0x10000;
            str += String.fromCharCode(0xD800 | ch >> 10, 0xDC00 | ch & 0x3FF);
          }
        }
      }

      return str;
    } // Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns a
    // copy of that string as a Javascript String object.
    // maxBytesToRead: an optional length that specifies the maximum number of bytes to read. You can omit
    //                 this parameter to scan the string until the first \0 byte. If maxBytesToRead is
    //                 passed, and the string at [ptr, ptr+maxBytesToReadr[ contains a null byte in the
    //                 middle, then the string will cut short at that byte index (i.e. maxBytesToRead will
    //                 not produce a string of exact length [ptr, ptr+maxBytesToRead[)
    //                 N.B. mixing frequent uses of UTF8ToString() with and without maxBytesToRead may
    //                 throw JS JIT optimizations off, so it is worth to consider consistently using one
    //                 style or the other.

    /**
     * @param {number} ptr
     * @param {number=} maxBytesToRead
     * @return {string}
     */


    function UTF8ToString(ptr, maxBytesToRead) {
      return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : '';
    } // Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
    // encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
    // Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
    // Parameters:
    //   str: the Javascript string to copy.
    //   outU8Array: the array to copy to. Each index in this array is assumed to be one 8-byte element.
    //   outIdx: The starting offset in the array to begin the copying.
    //   maxBytesToWrite: The maximum number of bytes this function can write to the array.
    //                    This count should include the null terminator,
    //                    i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
    //                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
    // Returns the number of bytes written, EXCLUDING the null terminator.


    function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
      if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
        { return 0; }
      var startIdx = outIdx;
      var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.

      for (var i = 0; i < str.length; ++i) {
        // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
        // See http://unicode.org/faq/utf_bom.html#utf16-3
        // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
        var u = str.charCodeAt(i); // possibly a lead surrogate

        if (u >= 0xD800 && u <= 0xDFFF) {
          var u1 = str.charCodeAt(++i);
          u = 0x10000 + ((u & 0x3FF) << 10) | u1 & 0x3FF;
        }

        if (u <= 0x7F) {
          if (outIdx >= endIdx) { break; }
          outU8Array[outIdx++] = u;
        } else if (u <= 0x7FF) {
          if (outIdx + 1 >= endIdx) { break; }
          outU8Array[outIdx++] = 0xC0 | u >> 6;
          outU8Array[outIdx++] = 0x80 | u & 63;
        } else if (u <= 0xFFFF) {
          if (outIdx + 2 >= endIdx) { break; }
          outU8Array[outIdx++] = 0xE0 | u >> 12;
          outU8Array[outIdx++] = 0x80 | u >> 6 & 63;
          outU8Array[outIdx++] = 0x80 | u & 63;
        } else {
          if (outIdx + 3 >= endIdx) { break; }
          if (u >= 0x200000) { warnOnce('Invalid Unicode code point 0x' + u.toString(16) + ' encountered when serializing a JS string to an UTF-8 string on the asm.js/wasm heap! (Valid unicode code points should be in range 0-0x1FFFFF).'); }
          outU8Array[outIdx++] = 0xF0 | u >> 18;
          outU8Array[outIdx++] = 0x80 | u >> 12 & 63;
          outU8Array[outIdx++] = 0x80 | u >> 6 & 63;
          outU8Array[outIdx++] = 0x80 | u & 63;
        }
      } // Null-terminate the pointer to the buffer.


      outU8Array[outIdx] = 0;
      return outIdx - startIdx;
    } // Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
    // null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
    // Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
    // Returns the number of bytes written, EXCLUDING the null terminator.


    function stringToUTF8(str, outPtr, maxBytesToWrite) {
      assert(typeof maxBytesToWrite == 'number', 'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
      return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
    } // Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.


    function lengthBytesUTF8(str) {
      var len = 0;

      for (var i = 0; i < str.length; ++i) {
        // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
        // See http://unicode.org/faq/utf_bom.html#utf16-3
        var u = str.charCodeAt(i); // possibly a lead surrogate

        if (u >= 0xD800 && u <= 0xDFFF) { u = 0x10000 + ((u & 0x3FF) << 10) | str.charCodeAt(++i) & 0x3FF; }
        if (u <= 0x7F) { ++len; }else if (u <= 0x7FF) { len += 2; }else if (u <= 0xFFFF) { len += 3; }else { len += 4; }
      }

      return len;
    } // Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
    // a copy of that string as a Javascript String object.


    var UTF16Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;

    function demangle(func) {
      warnOnce('warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
      return func;
    }

    function demangleAll(text) {
      var regex = /__Z[\w\d_]+/g;
      return text.replace(regex, function (x) {
        var y = demangle(x);
        return x === y ? x : y + ' [' + x + ']';
      });
    }

    function jsStackTrace() {
      var err = new Error();

      if (!err.stack) {
        // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
        // so try that as a special-case.
        try {
          throw new Error(0);
        } catch (e) {
          err = e;
        }

        if (!err.stack) {
          return '(no stack trace available)';
        }
      }

      return err.stack.toString();
    }

    function stackTrace() {
      var js = jsStackTrace();
      if (Module['extraStackTrace']) { js += '\n' + Module['extraStackTrace'](); }
      return demangleAll(js);
    } // Memory management
    var WASM_PAGE_SIZE = 65536;

    function alignUp(x, multiple) {
      if (x % multiple > 0) {
        x += multiple - x % multiple;
      }

      return x;
    }

    var /** @type {ArrayBuffer} */
    buffer,
    /** @type {Int8Array} */
    HEAP8,
    /** @type {Uint8Array} */
    HEAPU8,
    /** @type {Int16Array} */
    HEAP16,
    /** @type {Uint16Array} */
    HEAPU16,
    /** @type {Int32Array} */
    HEAP32,
    /** @type {Uint32Array} */
    HEAPU32,
    /** @type {Float32Array} */
    HEAPF32,
    /** @type {Float64Array} */
    HEAPF64;

    function updateGlobalBufferViews() {
      Module['HEAP8'] = HEAP8 = new Int8Array(buffer);
      Module['HEAP16'] = HEAP16 = new Int16Array(buffer);
      Module['HEAP32'] = HEAP32 = new Int32Array(buffer);
      Module['HEAPU8'] = HEAPU8 = new Uint8Array(buffer);
      Module['HEAPU16'] = HEAPU16 = new Uint16Array(buffer);
      Module['HEAPU32'] = HEAPU32 = new Uint32Array(buffer);
      Module['HEAPF32'] = HEAPF32 = new Float32Array(buffer);
      Module['HEAPF64'] = HEAPF64 = new Float64Array(buffer);
    }

    var STACK_BASE = 68592,
        STACK_MAX = 5311472,
        DYNAMIC_BASE = 5311472,
        DYNAMICTOP_PTR = 68336;
    assert(STACK_BASE % 16 === 0, 'stack must start aligned');
    assert(DYNAMIC_BASE % 16 === 0, 'heap must start aligned');
    var TOTAL_STACK = 5242880;
    if (Module['TOTAL_STACK']) { assert(TOTAL_STACK === Module['TOTAL_STACK'], 'the stack size can no longer be determined at runtime'); }
    var INITIAL_TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;
    if (INITIAL_TOTAL_MEMORY < TOTAL_STACK) { err('TOTAL_MEMORY should be larger than TOTAL_STACK, was ' + INITIAL_TOTAL_MEMORY + '! (TOTAL_STACK=' + TOTAL_STACK + ')'); } // Initialize the runtime's memory
    // check for full engine support (use string 'subarray' to avoid closure compiler confusion)

    assert(typeof Int32Array !== 'undefined' && typeof Float64Array !== 'undefined' && Int32Array.prototype.subarray !== undefined && Int32Array.prototype.set !== undefined, 'JS engine does not provide full typed array support'); // Use a provided buffer, if there is one, or else allocate a new one

    if (Module['buffer']) {
      buffer = Module['buffer'];
      assert(buffer.byteLength === INITIAL_TOTAL_MEMORY, 'provided buffer should be ' + INITIAL_TOTAL_MEMORY + ' bytes, but it is ' + buffer.byteLength);
    } else {
      // Use a WebAssembly memory where available
      if (typeof WebAssembly === 'object' && typeof WebAssembly.Memory === 'function') {
        assert(INITIAL_TOTAL_MEMORY % WASM_PAGE_SIZE === 0);
        wasmMemory = new WebAssembly.Memory({
          'initial': INITIAL_TOTAL_MEMORY / WASM_PAGE_SIZE
        });
        buffer = wasmMemory.buffer;
      } else {
        buffer = new ArrayBuffer(INITIAL_TOTAL_MEMORY);
      }

      assert(buffer.byteLength === INITIAL_TOTAL_MEMORY);
    }

    updateGlobalBufferViews();
    HEAP32[DYNAMICTOP_PTR >> 2] = DYNAMIC_BASE; // Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.

    function writeStackCookie() {
      assert((STACK_MAX & 3) == 0);
      HEAPU32[(STACK_MAX >> 2) - 1] = 0x02135467;
      HEAPU32[(STACK_MAX >> 2) - 2] = 0x89BACDFE;
    }

    function checkStackCookie() {
      if (HEAPU32[(STACK_MAX >> 2) - 1] != 0x02135467 || HEAPU32[(STACK_MAX >> 2) - 2] != 0x89BACDFE) {
        abort('Stack overflow! Stack cookie has been overwritten, expected hex dwords 0x89BACDFE and 0x02135467, but received 0x' + HEAPU32[(STACK_MAX >> 2) - 2].toString(16) + ' ' + HEAPU32[(STACK_MAX >> 2) - 1].toString(16));
      } // Also test the global address 0 for integrity.


      if (HEAP32[0] !== 0x63736d65
      /* 'emsc' */
      ) { throw 'Runtime error: The application has corrupted its heap memory area (address zero)!'; }
    }

    function abortStackOverflow(allocSize) {
      abort('Stack overflow! Attempted to allocate ' + allocSize + ' bytes on the stack, but stack has only ' + (STACK_MAX - stackSave() + allocSize) + ' bytes available!');
    }

    HEAP32[0] = 0x63736d65;
    /* 'emsc' */
    // Endianness check (note: assumes compiler arch was little-endian)

    HEAP16[1] = 0x6373;
    if (HEAPU8[2] !== 0x73 || HEAPU8[3] !== 0x63) { throw 'Runtime error: expected the system to be little-endian!'; }

    function callRuntimeCallbacks(callbacks) {
      while (callbacks.length > 0) {
        var callback = callbacks.shift();

        if (typeof callback == 'function') {
          callback();
          continue;
        }

        var func = callback.func;

        if (typeof func === 'number') {
          if (callback.arg === undefined) {
            Module['dynCall_v'](func);
          } else {
            Module['dynCall_vi'](func, callback.arg);
          }
        } else {
          func(callback.arg === undefined ? null : callback.arg);
        }
      }
    }

    var __ATPRERUN__ = []; // functions called before the runtime is initialized

    var __ATINIT__ = []; // functions called during startup

    var __ATMAIN__ = []; // functions called when main() is to be run

    var __ATPOSTRUN__ = []; // functions called after the main() is called

    var runtimeInitialized = false;
    var runtimeExited = false;

    function preRun() {
      // compatibility - merge in anything from Module['preRun'] at this time
      if (Module['preRun']) {
        if (typeof Module['preRun'] == 'function') { Module['preRun'] = [Module['preRun']]; }

        while (Module['preRun'].length) {
          addOnPreRun(Module['preRun'].shift());
        }
      }

      callRuntimeCallbacks(__ATPRERUN__);
    }

    function ensureInitRuntime() {
      checkStackCookie();
      if (runtimeInitialized) { return; }
      runtimeInitialized = true;
      callRuntimeCallbacks(__ATINIT__);
    }

    function preMain() {
      checkStackCookie();
      callRuntimeCallbacks(__ATMAIN__);
    }

    function postRun() {
      checkStackCookie(); // compatibility - merge in anything from Module['postRun'] at this time

      if (Module['postRun']) {
        if (typeof Module['postRun'] == 'function') { Module['postRun'] = [Module['postRun']]; }

        while (Module['postRun'].length) {
          addOnPostRun(Module['postRun'].shift());
        }
      }

      callRuntimeCallbacks(__ATPOSTRUN__);
    }

    function addOnPreRun(cb) {
      __ATPRERUN__.unshift(cb);
    }

    function addOnPostRun(cb) {
      __ATPOSTRUN__.unshift(cb);
    }

    assert(Math.imul, 'This browser does not support Math.imul(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
    assert(Math.fround, 'This browser does not support Math.fround(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
    assert(Math.clz32, 'This browser does not support Math.clz32(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
    assert(Math.trunc, 'This browser does not support Math.trunc(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
    // do asynchronous work before running, increment this and
    // decrement it. Incrementing must happen in a place like
    // Module.preRun (used by emcc to add file preloading).
    // Note that you can add dependencies in preRun, even though
    // it happens right before run - run will be postponed until
    // the dependencies are met.

    var runDependencies = 0;
    var runDependencyWatcher = null;
    var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled

    var runDependencyTracking = {};

    function addRunDependency(id) {
      runDependencies++;

      if (Module['monitorRunDependencies']) {
        Module['monitorRunDependencies'](runDependencies);
      }

      if (id) {
        assert(!runDependencyTracking[id]);
        runDependencyTracking[id] = 1;

        if (runDependencyWatcher === null && typeof setInterval !== 'undefined') {
          // Check for missing dependencies every few seconds
          runDependencyWatcher = setInterval(function () {
            if (ABORT) {
              clearInterval(runDependencyWatcher);
              runDependencyWatcher = null;
              return;
            }

            var shown = false;

            for (var dep in runDependencyTracking) {
              if (!shown) {
                shown = true;
                err('still waiting on run dependencies:');
              }

              err('dependency: ' + dep);
            }

            if (shown) {
              err('(end of list)');
            }
          }, 10000);
        }
      } else {
        err('warning: run dependency added without ID');
      }
    }

    function removeRunDependency(id) {
      runDependencies--;

      if (Module['monitorRunDependencies']) {
        Module['monitorRunDependencies'](runDependencies);
      }

      if (id) {
        assert(runDependencyTracking[id]);
        delete runDependencyTracking[id];
      } else {
        err('warning: run dependency removed without ID');
      }

      if (runDependencies == 0) {
        if (runDependencyWatcher !== null) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
        }

        if (dependenciesFulfilled) {
          var callback = dependenciesFulfilled;
          dependenciesFulfilled = null;
          callback(); // can add another dependenciesFulfilled
        }
      }
    }

    Module["preloadedImages"] = {}; // maps url to image data

    Module["preloadedAudios"] = {}; // maps url to audio data
    var
    /* show errors on likely calls to FS when it was not included */
    FS = {
      error: function () {
        abort('Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with  -s FORCE_FILESYSTEM=1');
      },
      init: function () {
        FS.error();
      },
      createDataFile: function () {
        FS.error();
      },
      createPreloadedFile: function () {
        FS.error();
      },
      createLazyFile: function () {
        FS.error();
      },
      open: function () {
        FS.error();
      },
      mkdev: function () {
        FS.error();
      },
      registerDevice: function () {
        FS.error();
      },
      analyzePath: function () {
        FS.error();
      },
      loadFilesFromDB: function () {
        FS.error();
      },
      ErrnoError: function ErrnoError() {
        FS.error();
      }
    };
    Module['FS_createDataFile'] = FS.createDataFile;
    Module['FS_createPreloadedFile'] = FS.createPreloadedFile; // Copyright 2017 The Emscripten Authors.  All rights reserved.
    // Emscripten is available under two separate licenses, the MIT license and the
    // University of Illinois/NCSA Open Source License.  Both these licenses can be
    // found in the LICENSE file.
    // Prefix of data URIs emitted by SINGLE_FILE and related options.

    var dataURIPrefix = 'data:application/octet-stream;base64,'; // Indicates whether filename is a base64 data URI.

    function isDataURI(filename) {
      return String.prototype.startsWith ? filename.startsWith(dataURIPrefix) : filename.indexOf(dataURIPrefix) === 0;
    }

    var wasmBinaryFile = 'webm-wasm.wasm';

    if (!isDataURI(wasmBinaryFile)) {
      wasmBinaryFile = locateFile(wasmBinaryFile);
    }

    function getBinary() {
      try {
        if (Module['wasmBinary']) {
          return new Uint8Array(Module['wasmBinary']);
        }

        if (Module['readBinary']) {
          return Module['readBinary'](wasmBinaryFile);
        } else {
          throw "both async and sync fetching of the wasm failed";
        }
      } catch (err) {
        abort(err);
      }
    }

    function getBinaryPromise() {
      // if we don't have the binary yet, and have the Fetch api, use that
      // in some environments, like Electron's render process, Fetch api may be present, but have a different context than expected, let's only use it on the Web
      if (!Module['wasmBinary'] && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && typeof fetch === 'function') {
        return fetch(wasmBinaryFile, {
          credentials: 'same-origin'
        }).then(function (response) {
          if (!response['ok']) {
            throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
          }

          return response['arrayBuffer']();
        }).catch(function () {
          return getBinary();
        });
      } // Otherwise, getBinary should be able to get it synchronously


      return new Promise(function (resolve, reject) {
        resolve(getBinary());
      });
    } // Create the wasm instance.
    // Receives the wasm imports, returns the exports.


    function createWasm(env) {
      // prepare imports
      var info = {
        'env': env,
        'global': {
          'NaN': NaN,
          'Infinity': Infinity
        },
        'global.Math': Math,
        'asm2wasm': asm2wasmImports
      }; // Load the wasm module and create an instance of using native support in the JS engine.
      // handle a generated wasm instance, receiving its exports and
      // performing other necessary setup

      function receiveInstance(instance, module) {
        var exports = instance.exports;
        Module['asm'] = exports;
        removeRunDependency('wasm-instantiate');
      }

      addRunDependency('wasm-instantiate'); // User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
      // to manually instantiate the Wasm module themselves. This allows pages to run the instantiation parallel
      // to any other async startup actions they are performing.

      if (Module['instantiateWasm']) {
        try {
          return Module['instantiateWasm'](info, receiveInstance);
        } catch (e) {
          err('Module.instantiateWasm callback failed with error: ' + e);
          return false;
        }
      } // Async compilation can be confusing when an error on the page overwrites Module
      // (for example, if the order of elements is wrong, and the one defining Module is
      // later), so we save Module and check it later.


      var trueModule = Module;

      function receiveInstantiatedSource(output) {
        // 'output' is a WebAssemblyInstantiatedSource object which has both the module and instance.
        // receiveInstance() will swap in the exports (to Module.asm) so they can be called
        assert(Module === trueModule, 'the Module object should not be replaced during async compilation - perhaps the order of HTML elements is wrong?');
        trueModule = null; // TODO: Due to Closure regression https://github.com/google/closure-compiler/issues/3193, the above line no longer optimizes out down to the following line.
        // When the regression is fixed, can restore the above USE_PTHREADS-enabled path.

        receiveInstance(output['instance']);
      }

      function instantiateArrayBuffer(receiver) {
        getBinaryPromise().then(function (binary) {
          return WebAssembly.instantiate(binary, info);
        }).then(receiver, function (reason) {
          err('failed to asynchronously prepare wasm: ' + reason);
          abort(reason);
        });
      } // Prefer streaming instantiation if available.


      if (!Module['wasmBinary'] && typeof WebAssembly.instantiateStreaming === 'function' && !isDataURI(wasmBinaryFile) && typeof fetch === 'function') {
        WebAssembly.instantiateStreaming(fetch(wasmBinaryFile, {
          credentials: 'same-origin'
        }), info).then(receiveInstantiatedSource, function (reason) {
          // We expect the most common failure cause to be a bad MIME type for the binary,
          // in which case falling back to ArrayBuffer instantiation should work.
          err('wasm streaming compile failed: ' + reason);
          err('falling back to ArrayBuffer instantiation');
          instantiateArrayBuffer(receiveInstantiatedSource);
        });
      } else {
        instantiateArrayBuffer(receiveInstantiatedSource);
      }

      return {}; // no exports yet; we'll fill them in later
    } // Provide an "asm.js function" for the application, called to "link" the asm.js module. We instantiate
    // the wasm module at that time, and it receives imports and provides exports and so forth, the app
    // doesn't need to care that it is wasm or asm.js.


    Module['asm'] = function (global, env, providedBuffer) {
      // memory was already allocated (so js could use the buffer)
      env['memory'] = wasmMemory; // import table

      env['table'] = wasmTable = new WebAssembly.Table({
        'initial': 514,
        'maximum': 514,
        'element': 'anyfunc'
      });
      env['__memory_base'] = 1024; // tell the memory segments where to place themselves

      env['__table_base'] = 0; // table starts at 0 by default (even in dynamic linking, for the main module)

      var exports = createWasm(env);
      assert(exports, 'binaryen setup failed (no wasm support?)');
      return exports;
    }; // === Body ===

    /* global initializers */

    __ATINIT__.push({
      func: function () {
        globalCtors();
      }
    });
    /* no memory initializer */


    var tempDoublePtr = 68576;
    assert(tempDoublePtr % 8 == 0);


    function ___assert_fail(condition, filename, line, func) {
      abort('Assertion failed: ' + UTF8ToString(condition) + ', at: ' + [filename ? UTF8ToString(filename) : 'unknown filename', line, func ? UTF8ToString(func) : 'unknown function']);
    }

    function ___cxa_allocate_exception(size) {
      return _malloc(size);
    }

    function __ZSt18uncaught_exceptionv() {
      // std::uncaught_exception()
      return !!__ZSt18uncaught_exceptionv.uncaught_exception;
    }

    function ___cxa_free_exception(ptr) {
      try {
        return _free(ptr);
      } catch (e) {
        // XXX FIXME
        err('exception during cxa_free_exception: ' + e);
      }
    }

    var EXCEPTIONS = {
      last: 0,
      caught: [],
      infos: {},
      deAdjust: function (adjusted) {
        if (!adjusted || EXCEPTIONS.infos[adjusted]) { return adjusted; }

        for (var key in EXCEPTIONS.infos) {
          var ptr = +key; // the iteration key is a string, and if we throw this, it must be an integer as that is what we look for

          var adj = EXCEPTIONS.infos[ptr].adjusted;
          var len = adj.length;

          for (var i = 0; i < len; i++) {
            if (adj[i] === adjusted) {
              return ptr;
            }
          }
        }

        return adjusted;
      },
      addRef: function (ptr) {
        if (!ptr) { return; }
        var info = EXCEPTIONS.infos[ptr];
        info.refcount++;
      },
      decRef: function (ptr) {
        if (!ptr) { return; }
        var info = EXCEPTIONS.infos[ptr];
        assert(info.refcount > 0);
        info.refcount--; // A rethrown exception can reach refcount 0; it must not be discarded
        // Its next handler will clear the rethrown flag and addRef it, prior to
        // final decRef and destruction here

        if (info.refcount === 0 && !info.rethrown) {
          if (info.destructor) {
            Module['dynCall_vi'](info.destructor, ptr);
          }

          delete EXCEPTIONS.infos[ptr];

          ___cxa_free_exception(ptr);
        }
      },
      clearRef: function (ptr) {
        if (!ptr) { return; }
        var info = EXCEPTIONS.infos[ptr];
        info.refcount = 0;
      }
    };

    function ___cxa_begin_catch(ptr) {
      var info = EXCEPTIONS.infos[ptr];

      if (info && !info.caught) {
        info.caught = true;
        __ZSt18uncaught_exceptionv.uncaught_exception--;
      }

      if (info) { info.rethrown = false; }
      EXCEPTIONS.caught.push(ptr);
      EXCEPTIONS.addRef(EXCEPTIONS.deAdjust(ptr));
      return ptr;
    }

    function ___cxa_pure_virtual() {
      ABORT = true;
      throw 'Pure virtual function called!';
    }

    function ___resumeException(ptr) {
      if (!EXCEPTIONS.last) {
        EXCEPTIONS.last = ptr;
      }

      throw ptr + " - Exception catching is disabled, this exception cannot be caught. Compile with -s DISABLE_EXCEPTION_CATCHING=0 or DISABLE_EXCEPTION_CATCHING=2 to catch.";
    }

    function ___cxa_find_matching_catch() {
      var thrown = EXCEPTIONS.last;

      if (!thrown) {
        // just pass through the null ptr
        return (setTempRet0(0), 0) | 0;
      }

      var info = EXCEPTIONS.infos[thrown];
      var throwntype = info.type;

      if (!throwntype) {
        // just pass through the thrown ptr
        return (setTempRet0(0), thrown) | 0;
      }

      var typeArray = Array.prototype.slice.call(arguments);
      var pointer = Module['___cxa_is_pointer_type'](throwntype); // can_catch receives a **, add indirection

      if (!___cxa_find_matching_catch.buffer) { ___cxa_find_matching_catch.buffer = _malloc(4); }
      HEAP32[___cxa_find_matching_catch.buffer >> 2] = thrown;
      thrown = ___cxa_find_matching_catch.buffer; // The different catch blocks are denoted by different types.
      // Due to inheritance, those types may not precisely match the
      // type of the thrown object. Find one which matches, and
      // return the type of the catch block which should be called.

      for (var i = 0; i < typeArray.length; i++) {
        if (typeArray[i] && Module['___cxa_can_catch'](typeArray[i], throwntype, thrown)) {
          thrown = HEAP32[thrown >> 2]; // undo indirection

          info.adjusted.push(thrown);
          return (setTempRet0(typeArray[i]), thrown) | 0;
        }
      } // Shouldn't happen unless we have bogus data in typeArray
      // or encounter a type for which emscripten doesn't have suitable
      // typeinfo defined. Best-efforts match just in case.


      thrown = HEAP32[thrown >> 2]; // undo indirection

      return (setTempRet0(throwntype), thrown) | 0;
    }

    function ___cxa_throw(ptr, type, destructor) {
      EXCEPTIONS.infos[ptr] = {
        ptr: ptr,
        adjusted: [ptr],
        type: type,
        destructor: destructor,
        refcount: 0,
        caught: false,
        rethrown: false
      };
      EXCEPTIONS.last = ptr;

      if (!("uncaught_exception" in __ZSt18uncaught_exceptionv)) {
        __ZSt18uncaught_exceptionv.uncaught_exception = 1;
      } else {
        __ZSt18uncaught_exceptionv.uncaught_exception++;
      }

      throw ptr + " - Exception catching is disabled, this exception cannot be caught. Compile with -s DISABLE_EXCEPTION_CATCHING=0 or DISABLE_EXCEPTION_CATCHING=2 to catch.";
    }

    function ___gxx_personality_v0() {}

    function ___lock() {}

    var SYSCALLS = {
      buffers: [null, [], []],
      printChar: function (stream, curr) {
        var buffer = SYSCALLS.buffers[stream];
        assert(buffer);

        if (curr === 0 || curr === 10) {
          (stream === 1 ? out : err)(UTF8ArrayToString(buffer, 0));
          buffer.length = 0;
        } else {
          buffer.push(curr);
        }
      },
      varargs: 0,
      get: function (varargs) {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[SYSCALLS.varargs - 4 >> 2];
        return ret;
      },
      getStr: function () {
        var ret = UTF8ToString(SYSCALLS.get());
        return ret;
      },
      get64: function () {
        var low = SYSCALLS.get(),
            high = SYSCALLS.get();
        if (low >= 0) { assert(high === 0); }else { assert(high === -1); }
        return low;
      },
      getZero: function () {
        assert(SYSCALLS.get() === 0);
      }
    };

    function ___syscall140(which, varargs) {
      SYSCALLS.varargs = varargs;

      try {
        // llseek
        var stream = SYSCALLS.getStreamFromFD(),
            offset_high = SYSCALLS.get(),
            offset_low = SYSCALLS.get(),
            result = SYSCALLS.get(),
            whence = SYSCALLS.get(); // NOTE: offset_high is unused - Emscripten's off_t is 32-bit

        var offset = offset_low;
        FS.llseek(stream, offset, whence);
        HEAP32[result >> 2] = stream.position;
        if (stream.getdents && offset === 0 && whence === 0) { stream.getdents = null; } // reset readdir state

        return 0;
      } catch (e) {
        if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) { abort(e); }
        return -e.errno;
      }
    }

    function ___syscall145(which, varargs) {
      SYSCALLS.varargs = varargs;

      try {
        // readv
        var stream = SYSCALLS.getStreamFromFD(),
            iov = SYSCALLS.get(),
            iovcnt = SYSCALLS.get();
        return SYSCALLS.doReadv(stream, iov, iovcnt);
      } catch (e) {
        if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) { abort(e); }
        return -e.errno;
      }
    }

    function flush_NO_FILESYSTEM() {
      // flush anything remaining in the buffers during shutdown
      var fflush = Module["_fflush"];
      if (fflush) { fflush(0); }
      var buffers = SYSCALLS.buffers;
      if (buffers[1].length) { SYSCALLS.printChar(1, 10); }
      if (buffers[2].length) { SYSCALLS.printChar(2, 10); }
    }

    function ___syscall146(which, varargs) {
      SYSCALLS.varargs = varargs;

      try {
        // writev
        // hack to support printf in FILESYSTEM=0
        var stream = SYSCALLS.get(),
            iov = SYSCALLS.get(),
            iovcnt = SYSCALLS.get();
        var ret = 0;

        for (var i = 0; i < iovcnt; i++) {
          var ptr = HEAP32[iov + i * 8 >> 2];
          var len = HEAP32[iov + (i * 8 + 4) >> 2];

          for (var j = 0; j < len; j++) {
            SYSCALLS.printChar(stream, HEAPU8[ptr + j]);
          }

          ret += len;
        }

        return ret;
      } catch (e) {
        if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) { abort(e); }
        return -e.errno;
      }
    }

    function ___setErrNo(value) {
      if (Module['___errno_location']) { HEAP32[Module['___errno_location']() >> 2] = value; }else { err('failed to set errno from JS'); }
      return value;
    }

    function ___syscall221(which, varargs) {
      SYSCALLS.varargs = varargs;

      try {
        // fcntl64
        return 0;
      } catch (e) {
        if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) { abort(e); }
        return -e.errno;
      }
    }

    function ___syscall5(which, varargs) {
      SYSCALLS.varargs = varargs;

      try {
        // open
        var pathname = SYSCALLS.getStr(),
            flags = SYSCALLS.get(),
            mode = SYSCALLS.get(); // optional TODO

        var stream = FS.open(pathname, flags, mode);
        return stream.fd;
      } catch (e) {
        if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) { abort(e); }
        return -e.errno;
      }
    }

    function ___syscall54(which, varargs) {
      SYSCALLS.varargs = varargs;

      try {
        // ioctl
        return 0;
      } catch (e) {
        if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) { abort(e); }
        return -e.errno;
      }
    }

    function ___syscall6(which, varargs) {
      SYSCALLS.varargs = varargs;

      try {
        // close
        var stream = SYSCALLS.getStreamFromFD();
        FS.close(stream);
        return 0;
      } catch (e) {
        if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) { abort(e); }
        return -e.errno;
      }
    }

    function ___unlock() {}

    function getShiftFromSize(size) {
      switch (size) {
        case 1:
          return 0;

        case 2:
          return 1;

        case 4:
          return 2;

        case 8:
          return 3;

        default:
          throw new TypeError('Unknown type size: ' + size);
      }
    }

    function embind_init_charCodes() {
      var codes = new Array(256);

      for (var i = 0; i < 256; ++i) {
        codes[i] = String.fromCharCode(i);
      }

      embind_charCodes = codes;
    }

    var embind_charCodes = undefined;

    function readLatin1String(ptr) {
      var ret = "";
      var c = ptr;

      while (HEAPU8[c]) {
        ret += embind_charCodes[HEAPU8[c++]];
      }

      return ret;
    }

    var awaitingDependencies = {};
    var registeredTypes = {};
    var typeDependencies = {};
    var char_0 = 48;
    var char_9 = 57;

    function makeLegalFunctionName(name) {
      if (undefined === name) {
        return '_unknown';
      }

      name = name.replace(/[^a-zA-Z0-9_]/g, '$');
      var f = name.charCodeAt(0);

      if (f >= char_0 && f <= char_9) {
        return '_' + name;
      } else {
        return name;
      }
    }

    function createNamedFunction(name, body) {
      name = makeLegalFunctionName(name);
      /*jshint evil:true*/

      return new Function("body", "return function " + name + "() {\n" + "    \"use strict\";" + "    return body.apply(this, arguments);\n" + "};\n")(body);
    }

    function extendError(baseErrorType, errorName) {
      var errorClass = createNamedFunction(errorName, function (message) {
        this.name = errorName;
        this.message = message;
        var stack = new Error(message).stack;

        if (stack !== undefined) {
          this.stack = this.toString() + '\n' + stack.replace(/^Error(:[^\n]*)?\n/, '');
        }
      });
      errorClass.prototype = Object.create(baseErrorType.prototype);
      errorClass.prototype.constructor = errorClass;

      errorClass.prototype.toString = function () {
        if (this.message === undefined) {
          return this.name;
        } else {
          return this.name + ': ' + this.message;
        }
      };

      return errorClass;
    }

    var BindingError = undefined;

    function throwBindingError(message) {
      throw new BindingError(message);
    }

    var InternalError = undefined;

    function throwInternalError(message) {
      throw new InternalError(message);
    }

    function whenDependentTypesAreResolved(myTypes, dependentTypes, getTypeConverters) {
      myTypes.forEach(function (type) {
        typeDependencies[type] = dependentTypes;
      });

      function onComplete(typeConverters) {
        var myTypeConverters = getTypeConverters(typeConverters);

        if (myTypeConverters.length !== myTypes.length) {
          throwInternalError('Mismatched type converter count');
        }

        for (var i = 0; i < myTypes.length; ++i) {
          registerType(myTypes[i], myTypeConverters[i]);
        }
      }

      var typeConverters = new Array(dependentTypes.length);
      var unregisteredTypes = [];
      var registered = 0;
      dependentTypes.forEach(function (dt, i) {
        if (registeredTypes.hasOwnProperty(dt)) {
          typeConverters[i] = registeredTypes[dt];
        } else {
          unregisteredTypes.push(dt);

          if (!awaitingDependencies.hasOwnProperty(dt)) {
            awaitingDependencies[dt] = [];
          }

          awaitingDependencies[dt].push(function () {
            typeConverters[i] = registeredTypes[dt];
            ++registered;

            if (registered === unregisteredTypes.length) {
              onComplete(typeConverters);
            }
          });
        }
      });

      if (0 === unregisteredTypes.length) {
        onComplete(typeConverters);
      }
    }

    function registerType(rawType, registeredInstance, options) {
      options = options || {};

      if (!('argPackAdvance' in registeredInstance)) {
        throw new TypeError('registerType registeredInstance requires argPackAdvance');
      }

      var name = registeredInstance.name;

      if (!rawType) {
        throwBindingError('type "' + name + '" must have a positive integer typeid pointer');
      }

      if (registeredTypes.hasOwnProperty(rawType)) {
        if (options.ignoreDuplicateRegistrations) {
          return;
        } else {
          throwBindingError("Cannot register type '" + name + "' twice");
        }
      }

      registeredTypes[rawType] = registeredInstance;
      delete typeDependencies[rawType];

      if (awaitingDependencies.hasOwnProperty(rawType)) {
        var callbacks = awaitingDependencies[rawType];
        delete awaitingDependencies[rawType];
        callbacks.forEach(function (cb) {
          cb();
        });
      }
    }

    function __embind_register_bool(rawType, name, size, trueValue, falseValue) {
      var shift = getShiftFromSize(size);
      name = readLatin1String(name);
      registerType(rawType, {
        name: name,
        'fromWireType': function (wt) {
          // ambiguous emscripten ABI: sometimes return values are
          // true or false, and sometimes integers (0 or 1)
          return !!wt;
        },
        'toWireType': function (destructors, o) {
          return o ? trueValue : falseValue;
        },
        'argPackAdvance': 8,
        'readValueFromPointer': function (pointer) {
          // TODO: if heap is fixed (like in asm.js) this could be executed outside
          var heap;

          if (size === 1) {
            heap = HEAP8;
          } else if (size === 2) {
            heap = HEAP16;
          } else if (size === 4) {
            heap = HEAP32;
          } else {
            throw new TypeError("Unknown boolean type size: " + name);
          }

          return this['fromWireType'](heap[pointer >> shift]);
        },
        destructorFunction: null // This type does not need a destructor

      });
    }

    function ClassHandle_isAliasOf(other) {
      if (!(this instanceof ClassHandle)) {
        return false;
      }

      if (!(other instanceof ClassHandle)) {
        return false;
      }

      var leftClass = this.$$.ptrType.registeredClass;
      var left = this.$$.ptr;
      var rightClass = other.$$.ptrType.registeredClass;
      var right = other.$$.ptr;

      while (leftClass.baseClass) {
        left = leftClass.upcast(left);
        leftClass = leftClass.baseClass;
      }

      while (rightClass.baseClass) {
        right = rightClass.upcast(right);
        rightClass = rightClass.baseClass;
      }

      return leftClass === rightClass && left === right;
    }

    function shallowCopyInternalPointer(o) {
      return {
        count: o.count,
        deleteScheduled: o.deleteScheduled,
        preservePointerOnDelete: o.preservePointerOnDelete,
        ptr: o.ptr,
        ptrType: o.ptrType,
        smartPtr: o.smartPtr,
        smartPtrType: o.smartPtrType
      };
    }

    function throwInstanceAlreadyDeleted(obj) {
      function getInstanceTypeName(handle) {
        return handle.$$.ptrType.registeredClass.name;
      }

      throwBindingError(getInstanceTypeName(obj) + ' instance already deleted');
    }

    function ClassHandle_clone() {
      if (!this.$$.ptr) {
        throwInstanceAlreadyDeleted(this);
      }

      if (this.$$.preservePointerOnDelete) {
        this.$$.count.value += 1;
        return this;
      } else {
        var clone = Object.create(Object.getPrototypeOf(this), {
          $$: {
            value: shallowCopyInternalPointer(this.$$)
          }
        });
        clone.$$.count.value += 1;
        clone.$$.deleteScheduled = false;
        return clone;
      }
    }

    function runDestructor(handle) {
      var $$ = handle.$$;

      if ($$.smartPtr) {
        $$.smartPtrType.rawDestructor($$.smartPtr);
      } else {
        $$.ptrType.registeredClass.rawDestructor($$.ptr);
      }
    }

    function ClassHandle_delete() {
      if (!this.$$.ptr) {
        throwInstanceAlreadyDeleted(this);
      }

      if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
        throwBindingError('Object already scheduled for deletion');
      }

      this.$$.count.value -= 1;
      var toDelete = 0 === this.$$.count.value;

      if (toDelete) {
        runDestructor(this);
      }

      if (!this.$$.preservePointerOnDelete) {
        this.$$.smartPtr = undefined;
        this.$$.ptr = undefined;
      }
    }

    function ClassHandle_isDeleted() {
      return !this.$$.ptr;
    }

    var delayFunction = undefined;
    var deletionQueue = [];

    function flushPendingDeletes() {
      while (deletionQueue.length) {
        var obj = deletionQueue.pop();
        obj.$$.deleteScheduled = false;
        obj['delete']();
      }
    }

    function ClassHandle_deleteLater() {
      if (!this.$$.ptr) {
        throwInstanceAlreadyDeleted(this);
      }

      if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
        throwBindingError('Object already scheduled for deletion');
      }

      deletionQueue.push(this);

      if (deletionQueue.length === 1 && delayFunction) {
        delayFunction(flushPendingDeletes);
      }

      this.$$.deleteScheduled = true;
      return this;
    }

    function init_ClassHandle() {
      ClassHandle.prototype['isAliasOf'] = ClassHandle_isAliasOf;
      ClassHandle.prototype['clone'] = ClassHandle_clone;
      ClassHandle.prototype['delete'] = ClassHandle_delete;
      ClassHandle.prototype['isDeleted'] = ClassHandle_isDeleted;
      ClassHandle.prototype['deleteLater'] = ClassHandle_deleteLater;
    }

    function ClassHandle() {}

    var registeredPointers = {};

    function ensureOverloadTable(proto, methodName, humanName) {
      if (undefined === proto[methodName].overloadTable) {
        var prevFunc = proto[methodName]; // Inject an overload resolver function that routes to the appropriate overload based on the number of arguments.

        proto[methodName] = function () {
          // TODO This check can be removed in -O3 level "unsafe" optimizations.
          if (!proto[methodName].overloadTable.hasOwnProperty(arguments.length)) {
            throwBindingError("Function '" + humanName + "' called with an invalid number of arguments (" + arguments.length + ") - expects one of (" + proto[methodName].overloadTable + ")!");
          }

          return proto[methodName].overloadTable[arguments.length].apply(this, arguments);
        }; // Move the previous function into the overload table.


        proto[methodName].overloadTable = [];
        proto[methodName].overloadTable[prevFunc.argCount] = prevFunc;
      }
    }

    function exposePublicSymbol(name, value, numArguments) {
      if (Module.hasOwnProperty(name)) {
        if (undefined === numArguments || undefined !== Module[name].overloadTable && undefined !== Module[name].overloadTable[numArguments]) {
          throwBindingError("Cannot register public name '" + name + "' twice");
        } // We are exposing a function with the same name as an existing function. Create an overload table and a function selector
        // that routes between the two.


        ensureOverloadTable(Module, name, name);

        if (Module.hasOwnProperty(numArguments)) {
          throwBindingError("Cannot register multiple overloads of a function with the same number of arguments (" + numArguments + ")!");
        } // Add the new function into the overload table.


        Module[name].overloadTable[numArguments] = value;
      } else {
        Module[name] = value;

        if (undefined !== numArguments) {
          Module[name].numArguments = numArguments;
        }
      }
    }

    function RegisteredClass(name, constructor, instancePrototype, rawDestructor, baseClass, getActualType, upcast, downcast) {
      this.name = name;
      this.constructor = constructor;
      this.instancePrototype = instancePrototype;
      this.rawDestructor = rawDestructor;
      this.baseClass = baseClass;
      this.getActualType = getActualType;
      this.upcast = upcast;
      this.downcast = downcast;
      this.pureVirtualFunctions = [];
    }

    function upcastPointer(ptr, ptrClass, desiredClass) {
      while (ptrClass !== desiredClass) {
        if (!ptrClass.upcast) {
          throwBindingError("Expected null or instance of " + desiredClass.name + ", got an instance of " + ptrClass.name);
        }

        ptr = ptrClass.upcast(ptr);
        ptrClass = ptrClass.baseClass;
      }

      return ptr;
    }

    function constNoSmartPtrRawPointerToWireType(destructors, handle) {
      if (handle === null) {
        if (this.isReference) {
          throwBindingError('null is not a valid ' + this.name);
        }

        return 0;
      }

      if (!handle.$$) {
        throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
      }

      if (!handle.$$.ptr) {
        throwBindingError('Cannot pass deleted object as a pointer of type ' + this.name);
      }

      var handleClass = handle.$$.ptrType.registeredClass;
      var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
      return ptr;
    }

    function genericPointerToWireType(destructors, handle) {
      var ptr;

      if (handle === null) {
        if (this.isReference) {
          throwBindingError('null is not a valid ' + this.name);
        }

        if (this.isSmartPointer) {
          ptr = this.rawConstructor();

          if (destructors !== null) {
            destructors.push(this.rawDestructor, ptr);
          }

          return ptr;
        } else {
          return 0;
        }
      }

      if (!handle.$$) {
        throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
      }

      if (!handle.$$.ptr) {
        throwBindingError('Cannot pass deleted object as a pointer of type ' + this.name);
      }

      if (!this.isConst && handle.$$.ptrType.isConst) {
        throwBindingError('Cannot convert argument of type ' + (handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name) + ' to parameter type ' + this.name);
      }

      var handleClass = handle.$$.ptrType.registeredClass;
      ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);

      if (this.isSmartPointer) {
        // TODO: this is not strictly true
        // We could support BY_EMVAL conversions from raw pointers to smart pointers
        // because the smart pointer can hold a reference to the handle
        if (undefined === handle.$$.smartPtr) {
          throwBindingError('Passing raw pointer to smart pointer is illegal');
        }

        switch (this.sharingPolicy) {
          case 0:
            // NONE
            // no upcasting
            if (handle.$$.smartPtrType === this) {
              ptr = handle.$$.smartPtr;
            } else {
              throwBindingError('Cannot convert argument of type ' + (handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name) + ' to parameter type ' + this.name);
            }

            break;

          case 1:
            // INTRUSIVE
            ptr = handle.$$.smartPtr;
            break;

          case 2:
            // BY_EMVAL
            if (handle.$$.smartPtrType === this) {
              ptr = handle.$$.smartPtr;
            } else {
              var clonedHandle = handle['clone']();
              ptr = this.rawShare(ptr, __emval_register(function () {
                clonedHandle['delete']();
              }));

              if (destructors !== null) {
                destructors.push(this.rawDestructor, ptr);
              }
            }

            break;

          default:
            throwBindingError('Unsupporting sharing policy');
        }
      }

      return ptr;
    }

    function nonConstNoSmartPtrRawPointerToWireType(destructors, handle) {
      if (handle === null) {
        if (this.isReference) {
          throwBindingError('null is not a valid ' + this.name);
        }

        return 0;
      }

      if (!handle.$$) {
        throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
      }

      if (!handle.$$.ptr) {
        throwBindingError('Cannot pass deleted object as a pointer of type ' + this.name);
      }

      if (handle.$$.ptrType.isConst) {
        throwBindingError('Cannot convert argument of type ' + handle.$$.ptrType.name + ' to parameter type ' + this.name);
      }

      var handleClass = handle.$$.ptrType.registeredClass;
      var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
      return ptr;
    }

    function simpleReadValueFromPointer(pointer) {
      return this['fromWireType'](HEAPU32[pointer >> 2]);
    }

    function RegisteredPointer_getPointee(ptr) {
      if (this.rawGetPointee) {
        ptr = this.rawGetPointee(ptr);
      }

      return ptr;
    }

    function RegisteredPointer_destructor(ptr) {
      if (this.rawDestructor) {
        this.rawDestructor(ptr);
      }
    }

    function RegisteredPointer_deleteObject(handle) {
      if (handle !== null) {
        handle['delete']();
      }
    }

    function downcastPointer(ptr, ptrClass, desiredClass) {
      if (ptrClass === desiredClass) {
        return ptr;
      }

      if (undefined === desiredClass.baseClass) {
        return null; // no conversion
      }

      var rv = downcastPointer(ptr, ptrClass, desiredClass.baseClass);

      if (rv === null) {
        return null;
      }

      return desiredClass.downcast(rv);
    }

    function getInheritedInstanceCount() {
      return Object.keys(registeredInstances).length;
    }

    function getLiveInheritedInstances() {
      var rv = [];

      for (var k in registeredInstances) {
        if (registeredInstances.hasOwnProperty(k)) {
          rv.push(registeredInstances[k]);
        }
      }

      return rv;
    }

    function setDelayFunction(fn) {
      delayFunction = fn;

      if (deletionQueue.length && delayFunction) {
        delayFunction(flushPendingDeletes);
      }
    }

    function init_embind() {
      Module['getInheritedInstanceCount'] = getInheritedInstanceCount;
      Module['getLiveInheritedInstances'] = getLiveInheritedInstances;
      Module['flushPendingDeletes'] = flushPendingDeletes;
      Module['setDelayFunction'] = setDelayFunction;
    }

    var registeredInstances = {};

    function getBasestPointer(class_, ptr) {
      if (ptr === undefined) {
        throwBindingError('ptr should not be undefined');
      }

      while (class_.baseClass) {
        ptr = class_.upcast(ptr);
        class_ = class_.baseClass;
      }

      return ptr;
    }

    function getInheritedInstance(class_, ptr) {
      ptr = getBasestPointer(class_, ptr);
      return registeredInstances[ptr];
    }

    function makeClassHandle(prototype, record) {
      if (!record.ptrType || !record.ptr) {
        throwInternalError('makeClassHandle requires ptr and ptrType');
      }

      var hasSmartPtrType = !!record.smartPtrType;
      var hasSmartPtr = !!record.smartPtr;

      if (hasSmartPtrType !== hasSmartPtr) {
        throwInternalError('Both smartPtrType and smartPtr must be specified');
      }

      record.count = {
        value: 1
      };
      return Object.create(prototype, {
        $$: {
          value: record
        }
      });
    }

    function RegisteredPointer_fromWireType(ptr) {
      // ptr is a raw pointer (or a raw smartpointer)
      // rawPointer is a maybe-null raw pointer
      var rawPointer = this.getPointee(ptr);

      if (!rawPointer) {
        this.destructor(ptr);
        return null;
      }

      var registeredInstance = getInheritedInstance(this.registeredClass, rawPointer);

      if (undefined !== registeredInstance) {
        // JS object has been neutered, time to repopulate it
        if (0 === registeredInstance.$$.count.value) {
          registeredInstance.$$.ptr = rawPointer;
          registeredInstance.$$.smartPtr = ptr;
          return registeredInstance['clone']();
        } else {
          // else, just increment reference count on existing object
          // it already has a reference to the smart pointer
          var rv = registeredInstance['clone']();
          this.destructor(ptr);
          return rv;
        }
      }

      function makeDefaultHandle() {
        if (this.isSmartPointer) {
          return makeClassHandle(this.registeredClass.instancePrototype, {
            ptrType: this.pointeeType,
            ptr: rawPointer,
            smartPtrType: this,
            smartPtr: ptr
          });
        } else {
          return makeClassHandle(this.registeredClass.instancePrototype, {
            ptrType: this,
            ptr: ptr
          });
        }
      }

      var actualType = this.registeredClass.getActualType(rawPointer);
      var registeredPointerRecord = registeredPointers[actualType];

      if (!registeredPointerRecord) {
        return makeDefaultHandle.call(this);
      }

      var toType;

      if (this.isConst) {
        toType = registeredPointerRecord.constPointerType;
      } else {
        toType = registeredPointerRecord.pointerType;
      }

      var dp = downcastPointer(rawPointer, this.registeredClass, toType.registeredClass);

      if (dp === null) {
        return makeDefaultHandle.call(this);
      }

      if (this.isSmartPointer) {
        return makeClassHandle(toType.registeredClass.instancePrototype, {
          ptrType: toType,
          ptr: dp,
          smartPtrType: this,
          smartPtr: ptr
        });
      } else {
        return makeClassHandle(toType.registeredClass.instancePrototype, {
          ptrType: toType,
          ptr: dp
        });
      }
    }

    function init_RegisteredPointer() {
      RegisteredPointer.prototype.getPointee = RegisteredPointer_getPointee;
      RegisteredPointer.prototype.destructor = RegisteredPointer_destructor;
      RegisteredPointer.prototype['argPackAdvance'] = 8;
      RegisteredPointer.prototype['readValueFromPointer'] = simpleReadValueFromPointer;
      RegisteredPointer.prototype['deleteObject'] = RegisteredPointer_deleteObject;
      RegisteredPointer.prototype['fromWireType'] = RegisteredPointer_fromWireType;
    }

    function RegisteredPointer(name, registeredClass, isReference, isConst, // smart pointer properties
    isSmartPointer, pointeeType, sharingPolicy, rawGetPointee, rawConstructor, rawShare, rawDestructor) {
      this.name = name;
      this.registeredClass = registeredClass;
      this.isReference = isReference;
      this.isConst = isConst; // smart pointer properties

      this.isSmartPointer = isSmartPointer;
      this.pointeeType = pointeeType;
      this.sharingPolicy = sharingPolicy;
      this.rawGetPointee = rawGetPointee;
      this.rawConstructor = rawConstructor;
      this.rawShare = rawShare;
      this.rawDestructor = rawDestructor;

      if (!isSmartPointer && registeredClass.baseClass === undefined) {
        if (isConst) {
          this['toWireType'] = constNoSmartPtrRawPointerToWireType;
          this.destructorFunction = null;
        } else {
          this['toWireType'] = nonConstNoSmartPtrRawPointerToWireType;
          this.destructorFunction = null;
        }
      } else {
        this['toWireType'] = genericPointerToWireType; // Here we must leave this.destructorFunction undefined, since whether genericPointerToWireType returns
        // a pointer that needs to be freed up is runtime-dependent, and cannot be evaluated at registration time.
        // TODO: Create an alternative mechanism that allows removing the use of var destructors = []; array in
        //       craftInvokerFunction altogether.
      }
    }

    function replacePublicSymbol(name, value, numArguments) {
      if (!Module.hasOwnProperty(name)) {
        throwInternalError('Replacing nonexistant public symbol');
      } // If there's an overload table for this symbol, replace the symbol in the overload table instead.


      if (undefined !== Module[name].overloadTable && undefined !== numArguments) {
        Module[name].overloadTable[numArguments] = value;
      } else {
        Module[name] = value;
        Module[name].argCount = numArguments;
      }
    }

    function embind__requireFunction(signature, rawFunction) {
      signature = readLatin1String(signature);

      function makeDynCaller(dynCall) {
        var args = [];

        for (var i = 1; i < signature.length; ++i) {
          args.push('a' + i);
        }

        var name = 'dynCall_' + signature + '_' + rawFunction;
        var body = 'return function ' + name + '(' + args.join(', ') + ') {\n';
        body += '    return dynCall(rawFunction' + (args.length ? ', ' : '') + args.join(', ') + ');\n';
        body += '};\n';
        return new Function('dynCall', 'rawFunction', body)(dynCall, rawFunction);
      }

      var fp;

      if (Module['FUNCTION_TABLE_' + signature] !== undefined) {
        fp = Module['FUNCTION_TABLE_' + signature][rawFunction];
      } else if (typeof FUNCTION_TABLE !== "undefined") {
        fp = FUNCTION_TABLE[rawFunction];
      } else {
        // asm.js does not give direct access to the function tables,
        // and thus we must go through the dynCall interface which allows
        // calling into a signature's function table by pointer value.
        //
        // https://github.com/dherman/asm.js/issues/83
        //
        // This has three main penalties:
        // - dynCall is another function call in the path from JavaScript to C++.
        // - JITs may not predict through the function table indirection at runtime.
        var dc = Module['dynCall_' + signature];

        if (dc === undefined) {
          // We will always enter this branch if the signature
          // contains 'f' and PRECISE_F32 is not enabled.
          //
          // Try again, replacing 'f' with 'd'.
          dc = Module['dynCall_' + signature.replace(/f/g, 'd')];

          if (dc === undefined) {
            throwBindingError("No dynCall invoker for signature: " + signature);
          }
        }

        fp = makeDynCaller(dc);
      }

      if (typeof fp !== "function") {
        throwBindingError("unknown function pointer with signature " + signature + ": " + rawFunction);
      }

      return fp;
    }

    var UnboundTypeError = undefined;

    function getTypeName(type) {
      var ptr = ___getTypeName(type);

      var rv = readLatin1String(ptr);

      _free(ptr);

      return rv;
    }

    function throwUnboundTypeError(message, types) {
      var unboundTypes = [];
      var seen = {};

      function visit(type) {
        if (seen[type]) {
          return;
        }

        if (registeredTypes[type]) {
          return;
        }

        if (typeDependencies[type]) {
          typeDependencies[type].forEach(visit);
          return;
        }

        unboundTypes.push(type);
        seen[type] = true;
      }

      types.forEach(visit);
      throw new UnboundTypeError(message + ': ' + unboundTypes.map(getTypeName).join([', ']));
    }

    function __embind_register_class(rawType, rawPointerType, rawConstPointerType, baseClassRawType, getActualTypeSignature, getActualType, upcastSignature, upcast, downcastSignature, downcast, name, destructorSignature, rawDestructor) {
      name = readLatin1String(name);
      getActualType = embind__requireFunction(getActualTypeSignature, getActualType);

      if (upcast) {
        upcast = embind__requireFunction(upcastSignature, upcast);
      }

      if (downcast) {
        downcast = embind__requireFunction(downcastSignature, downcast);
      }

      rawDestructor = embind__requireFunction(destructorSignature, rawDestructor);
      var legalFunctionName = makeLegalFunctionName(name);
      exposePublicSymbol(legalFunctionName, function () {
        // this code cannot run if baseClassRawType is zero
        throwUnboundTypeError('Cannot construct ' + name + ' due to unbound types', [baseClassRawType]);
      });
      whenDependentTypesAreResolved([rawType, rawPointerType, rawConstPointerType], baseClassRawType ? [baseClassRawType] : [], function (base) {
        base = base[0];
        var baseClass;
        var basePrototype;

        if (baseClassRawType) {
          baseClass = base.registeredClass;
          basePrototype = baseClass.instancePrototype;
        } else {
          basePrototype = ClassHandle.prototype;
        }

        var constructor = createNamedFunction(legalFunctionName, function () {
          if (Object.getPrototypeOf(this) !== instancePrototype) {
            throw new BindingError("Use 'new' to construct " + name);
          }

          if (undefined === registeredClass.constructor_body) {
            throw new BindingError(name + " has no accessible constructor");
          }

          var body = registeredClass.constructor_body[arguments.length];

          if (undefined === body) {
            throw new BindingError("Tried to invoke ctor of " + name + " with invalid number of parameters (" + arguments.length + ") - expected (" + Object.keys(registeredClass.constructor_body).toString() + ") parameters instead!");
          }

          return body.apply(this, arguments);
        });
        var instancePrototype = Object.create(basePrototype, {
          constructor: {
            value: constructor
          }
        });
        constructor.prototype = instancePrototype;
        var registeredClass = new RegisteredClass(name, constructor, instancePrototype, rawDestructor, baseClass, getActualType, upcast, downcast);
        var referenceConverter = new RegisteredPointer(name, registeredClass, true, false, false);
        var pointerConverter = new RegisteredPointer(name + '*', registeredClass, false, false, false);
        var constPointerConverter = new RegisteredPointer(name + ' const*', registeredClass, false, true, false);
        registeredPointers[rawType] = {
          pointerType: pointerConverter,
          constPointerType: constPointerConverter
        };
        replacePublicSymbol(legalFunctionName, constructor);
        return [referenceConverter, pointerConverter, constPointerConverter];
      });
    }

    function heap32VectorToArray(count, firstElement) {
      var array = [];

      for (var i = 0; i < count; i++) {
        array.push(HEAP32[(firstElement >> 2) + i]);
      }

      return array;
    }

    function runDestructors(destructors) {
      while (destructors.length) {
        var ptr = destructors.pop();
        var del = destructors.pop();
        del(ptr);
      }
    }

    function __embind_register_class_constructor(rawClassType, argCount, rawArgTypesAddr, invokerSignature, invoker, rawConstructor) {
      var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
      invoker = embind__requireFunction(invokerSignature, invoker);
      whenDependentTypesAreResolved([], [rawClassType], function (classType) {
        classType = classType[0];
        var humanName = 'constructor ' + classType.name;

        if (undefined === classType.registeredClass.constructor_body) {
          classType.registeredClass.constructor_body = [];
        }

        if (undefined !== classType.registeredClass.constructor_body[argCount - 1]) {
          throw new BindingError("Cannot register multiple constructors with identical number of parameters (" + (argCount - 1) + ") for class '" + classType.name + "'! Overload resolution is currently only performed using the parameter count, not actual type info!");
        }

        classType.registeredClass.constructor_body[argCount - 1] = function unboundTypeHandler() {
          throwUnboundTypeError('Cannot construct ' + classType.name + ' due to unbound types', rawArgTypes);
        };

        whenDependentTypesAreResolved([], rawArgTypes, function (argTypes) {
          classType.registeredClass.constructor_body[argCount - 1] = function constructor_body() {
            var arguments$1 = arguments;

            if (arguments.length !== argCount - 1) {
              throwBindingError(humanName + ' called with ' + arguments.length + ' arguments, expected ' + (argCount - 1));
            }

            var destructors = [];
            var args = new Array(argCount);
            args[0] = rawConstructor;

            for (var i = 1; i < argCount; ++i) {
              args[i] = argTypes[i]['toWireType'](destructors, arguments$1[i - 1]);
            }

            var ptr = invoker.apply(null, args);
            runDestructors(destructors);
            return argTypes[0]['fromWireType'](ptr);
          };

          return [];
        });
        return [];
      });
    }

    function new_(constructor, argumentList) {
      if (!(constructor instanceof Function)) {
        throw new TypeError('new_ called with constructor type ' + typeof constructor + " which is not a function");
      }
      /*
       * Previously, the following line was just:
          function dummy() {};
          * Unfortunately, Chrome was preserving 'dummy' as the object's name, even though at creation, the 'dummy' has the
       * correct constructor name.  Thus, objects created with IMVU.new would show up in the debugger as 'dummy', which
       * isn't very helpful.  Using IMVU.createNamedFunction addresses the issue.  Doublely-unfortunately, there's no way
       * to write a test for this behavior.  -NRD 2013.02.22
       */


      var dummy = createNamedFunction(constructor.name || 'unknownFunctionName', function () {});
      dummy.prototype = constructor.prototype;
      var obj = new dummy();
      var r = constructor.apply(obj, argumentList);
      return r instanceof Object ? r : obj;
    }

    function craftInvokerFunction(humanName, argTypes, classType, cppInvokerFunc, cppTargetFunc) {
      // humanName: a human-readable string name for the function to be generated.
      // argTypes: An array that contains the embind type objects for all types in the function signature.
      //    argTypes[0] is the type object for the function return value.
      //    argTypes[1] is the type object for function this object/class type, or null if not crafting an invoker for a class method.
      //    argTypes[2...] are the actual function parameters.
      // classType: The embind type object for the class to be bound, or null if this is not a method of a class.
      // cppInvokerFunc: JS Function object to the C++-side function that interops into C++ code.
      // cppTargetFunc: Function pointer (an integer to FUNCTION_TABLE) to the target C++ function the cppInvokerFunc will end up calling.
      var argCount = argTypes.length;

      if (argCount < 2) {
        throwBindingError("argTypes array size mismatch! Must at least get return value and 'this' types!");
      }

      var isClassMethodFunc = argTypes[1] !== null && classType !== null; // Free functions with signature "void function()" do not need an invoker that marshalls between wire types.
      // TODO: This omits argument count check - enable only at -O3 or similar.
      //    if (ENABLE_UNSAFE_OPTS && argCount == 2 && argTypes[0].name == "void" && !isClassMethodFunc) {
      //       return FUNCTION_TABLE[fn];
      //    }
      // Determine if we need to use a dynamic stack to store the destructors for the function parameters.
      // TODO: Remove this completely once all function invokers are being dynamically generated.

      var needsDestructorStack = false;

      for (var i = 1; i < argTypes.length; ++i) {
        // Skip return value at index 0 - it's not deleted here.
        if (argTypes[i] !== null && argTypes[i].destructorFunction === undefined) {
          // The type does not define a destructor function - must use dynamic stack
          needsDestructorStack = true;
          break;
        }
      }

      var returns = argTypes[0].name !== "void";
      var argsList = "";
      var argsListWired = "";

      for (var i = 0; i < argCount - 2; ++i) {
        argsList += (i !== 0 ? ", " : "") + "arg" + i;
        argsListWired += (i !== 0 ? ", " : "") + "arg" + i + "Wired";
      }

      var invokerFnBody = "return function " + makeLegalFunctionName(humanName) + "(" + argsList + ") {\n" + "if (arguments.length !== " + (argCount - 2) + ") {\n" + "throwBindingError('function " + humanName + " called with ' + arguments.length + ' arguments, expected " + (argCount - 2) + " args!');\n" + "}\n";

      if (needsDestructorStack) {
        invokerFnBody += "var destructors = [];\n";
      }

      var dtorStack = needsDestructorStack ? "destructors" : "null";
      var args1 = ["throwBindingError", "invoker", "fn", "runDestructors", "retType", "classParam"];
      var args2 = [throwBindingError, cppInvokerFunc, cppTargetFunc, runDestructors, argTypes[0], argTypes[1]];

      if (isClassMethodFunc) {
        invokerFnBody += "var thisWired = classParam.toWireType(" + dtorStack + ", this);\n";
      }

      for (var i = 0; i < argCount - 2; ++i) {
        invokerFnBody += "var arg" + i + "Wired = argType" + i + ".toWireType(" + dtorStack + ", arg" + i + "); // " + argTypes[i + 2].name + "\n";
        args1.push("argType" + i);
        args2.push(argTypes[i + 2]);
      }

      if (isClassMethodFunc) {
        argsListWired = "thisWired" + (argsListWired.length > 0 ? ", " : "") + argsListWired;
      }

      invokerFnBody += (returns ? "var rv = " : "") + "invoker(fn" + (argsListWired.length > 0 ? ", " : "") + argsListWired + ");\n";

      if (needsDestructorStack) {
        invokerFnBody += "runDestructors(destructors);\n";
      } else {
        for (var i = isClassMethodFunc ? 1 : 2; i < argTypes.length; ++i) {
          // Skip return value at index 0 - it's not deleted here. Also skip class type if not a method.
          var paramName = i === 1 ? "thisWired" : "arg" + (i - 2) + "Wired";

          if (argTypes[i].destructorFunction !== null) {
            invokerFnBody += paramName + "_dtor(" + paramName + "); // " + argTypes[i].name + "\n";
            args1.push(paramName + "_dtor");
            args2.push(argTypes[i].destructorFunction);
          }
        }
      }

      if (returns) {
        invokerFnBody += "var ret = retType.fromWireType(rv);\n" + "return ret;\n";
      }

      invokerFnBody += "}\n";
      args1.push(invokerFnBody);
      var invokerFunction = new_(Function, args1).apply(null, args2);
      return invokerFunction;
    }

    function __embind_register_class_function(rawClassType, methodName, argCount, rawArgTypesAddr, // [ReturnType, ThisType, Args...]
    invokerSignature, rawInvoker, context, isPureVirtual) {
      var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
      methodName = readLatin1String(methodName);
      rawInvoker = embind__requireFunction(invokerSignature, rawInvoker);
      whenDependentTypesAreResolved([], [rawClassType], function (classType) {
        classType = classType[0];
        var humanName = classType.name + '.' + methodName;

        if (isPureVirtual) {
          classType.registeredClass.pureVirtualFunctions.push(methodName);
        }

        function unboundTypesHandler() {
          throwUnboundTypeError('Cannot call ' + humanName + ' due to unbound types', rawArgTypes);
        }

        var proto = classType.registeredClass.instancePrototype;
        var method = proto[methodName];

        if (undefined === method || undefined === method.overloadTable && method.className !== classType.name && method.argCount === argCount - 2) {
          // This is the first overload to be registered, OR we are replacing a function in the base class with a function in the derived class.
          unboundTypesHandler.argCount = argCount - 2;
          unboundTypesHandler.className = classType.name;
          proto[methodName] = unboundTypesHandler;
        } else {
          // There was an existing function with the same name registered. Set up a function overload routing table.
          ensureOverloadTable(proto, methodName, humanName);
          proto[methodName].overloadTable[argCount - 2] = unboundTypesHandler;
        }

        whenDependentTypesAreResolved([], rawArgTypes, function (argTypes) {
          var memberFunction = craftInvokerFunction(humanName, argTypes, classType, rawInvoker, context); // Replace the initial unbound-handler-stub function with the appropriate member function, now that all types
          // are resolved. If multiple overloads are registered for this function, the function goes into an overload table.

          if (undefined === proto[methodName].overloadTable) {
            // Set argCount in case an overload is registered later
            memberFunction.argCount = argCount - 2;
            proto[methodName] = memberFunction;
          } else {
            proto[methodName].overloadTable[argCount - 2] = memberFunction;
          }

          return [];
        });
        return [];
      });
    }

    var emval_free_list = [];
    var emval_handle_array = [{}, {
      value: undefined
    }, {
      value: null
    }, {
      value: true
    }, {
      value: false
    }];

    function __emval_decref(handle) {
      if (handle > 4 && 0 === --emval_handle_array[handle].refcount) {
        emval_handle_array[handle] = undefined;
        emval_free_list.push(handle);
      }
    }

    function count_emval_handles() {
      var count = 0;

      for (var i = 5; i < emval_handle_array.length; ++i) {
        if (emval_handle_array[i] !== undefined) {
          ++count;
        }
      }

      return count;
    }

    function get_first_emval() {
      for (var i = 5; i < emval_handle_array.length; ++i) {
        if (emval_handle_array[i] !== undefined) {
          return emval_handle_array[i];
        }
      }

      return null;
    }

    function init_emval() {
      Module['count_emval_handles'] = count_emval_handles;
      Module['get_first_emval'] = get_first_emval;
    }

    function __emval_register(value) {
      switch (value) {
        case undefined:
          {
            return 1;
          }

        case null:
          {
            return 2;
          }

        case true:
          {
            return 3;
          }

        case false:
          {
            return 4;
          }

        default:
          {
            var handle = emval_free_list.length ? emval_free_list.pop() : emval_handle_array.length;
            emval_handle_array[handle] = {
              refcount: 1,
              value: value
            };
            return handle;
          }
      }
    }

    function __embind_register_emval(rawType, name) {
      name = readLatin1String(name);
      registerType(rawType, {
        name: name,
        'fromWireType': function (handle) {
          var rv = emval_handle_array[handle].value;

          __emval_decref(handle);

          return rv;
        },
        'toWireType': function (destructors, value) {
          return __emval_register(value);
        },
        'argPackAdvance': 8,
        'readValueFromPointer': simpleReadValueFromPointer,
        destructorFunction: null // This type does not need a destructor
        // TODO: do we need a deleteObject here?  write a test where
        // emval is passed into JS via an interface

      });
    }

    function _embind_repr(v) {
      if (v === null) {
        return 'null';
      }

      var t = typeof v;

      if (t === 'object' || t === 'array' || t === 'function') {
        return v.toString();
      } else {
        return '' + v;
      }
    }

    function floatReadValueFromPointer(name, shift) {
      switch (shift) {
        case 2:
          return function (pointer) {
            return this['fromWireType'](HEAPF32[pointer >> 2]);
          };

        case 3:
          return function (pointer) {
            return this['fromWireType'](HEAPF64[pointer >> 3]);
          };

        default:
          throw new TypeError("Unknown float type: " + name);
      }
    }

    function __embind_register_float(rawType, name, size) {
      var shift = getShiftFromSize(size);
      name = readLatin1String(name);
      registerType(rawType, {
        name: name,
        'fromWireType': function (value) {
          return value;
        },
        'toWireType': function (destructors, value) {
          // todo: Here we have an opportunity for -O3 level "unsafe" optimizations: we could
          // avoid the following if() and assume value is of proper type.
          if (typeof value !== "number" && typeof value !== "boolean") {
            throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name);
          }

          return value;
        },
        'argPackAdvance': 8,
        'readValueFromPointer': floatReadValueFromPointer(name, shift),
        destructorFunction: null // This type does not need a destructor

      });
    }

    function integerReadValueFromPointer(name, shift, signed) {
      // integers are quite common, so generate very specialized functions
      switch (shift) {
        case 0:
          return signed ? function readS8FromPointer(pointer) {
            return HEAP8[pointer];
          } : function readU8FromPointer(pointer) {
            return HEAPU8[pointer];
          };

        case 1:
          return signed ? function readS16FromPointer(pointer) {
            return HEAP16[pointer >> 1];
          } : function readU16FromPointer(pointer) {
            return HEAPU16[pointer >> 1];
          };

        case 2:
          return signed ? function readS32FromPointer(pointer) {
            return HEAP32[pointer >> 2];
          } : function readU32FromPointer(pointer) {
            return HEAPU32[pointer >> 2];
          };

        default:
          throw new TypeError("Unknown integer type: " + name);
      }
    }

    function __embind_register_integer(primitiveType, name, size, minRange, maxRange) {
      name = readLatin1String(name);

      if (maxRange === -1) {
        // LLVM doesn't have signed and unsigned 32-bit types, so u32 literals come out as 'i32 -1'. Always treat those as max u32.
        maxRange = 4294967295;
      }

      var shift = getShiftFromSize(size);

      var fromWireType = function (value) {
        return value;
      };

      if (minRange === 0) {
        var bitshift = 32 - 8 * size;

        fromWireType = function (value) {
          return value << bitshift >>> bitshift;
        };
      }

      var isUnsignedType = name.indexOf('unsigned') != -1;
      registerType(primitiveType, {
        name: name,
        'fromWireType': fromWireType,
        'toWireType': function (destructors, value) {
          // todo: Here we have an opportunity for -O3 level "unsafe" optimizations: we could
          // avoid the following two if()s and assume value is of proper type.
          if (typeof value !== "number" && typeof value !== "boolean") {
            throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name);
          }

          if (value < minRange || value > maxRange) {
            throw new TypeError('Passing a number "' + _embind_repr(value) + '" from JS side to C/C++ side to an argument of type "' + name + '", which is outside the valid range [' + minRange + ', ' + maxRange + ']!');
          }

          return isUnsignedType ? value >>> 0 : value | 0;
        },
        'argPackAdvance': 8,
        'readValueFromPointer': integerReadValueFromPointer(name, shift, minRange !== 0),
        destructorFunction: null // This type does not need a destructor

      });
    }

    function __embind_register_memory_view(rawType, dataTypeIndex, name) {
      var typeMapping = [Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array];
      var TA = typeMapping[dataTypeIndex];

      function decodeMemoryView(handle) {
        handle = handle >> 2;
        var heap = HEAPU32;
        var size = heap[handle]; // in elements

        var data = heap[handle + 1]; // byte offset into emscripten heap

        return new TA(heap['buffer'], data, size);
      }

      name = readLatin1String(name);
      registerType(rawType, {
        name: name,
        'fromWireType': decodeMemoryView,
        'argPackAdvance': 8,
        'readValueFromPointer': decodeMemoryView
      }, {
        ignoreDuplicateRegistrations: true
      });
    }

    function __embind_register_std_string(rawType, name) {
      name = readLatin1String(name);
      var stdStringIsUTF8 //process only std::string bindings with UTF8 support, in contrast to e.g. std::basic_string<unsigned char>
      = name === "std::string";
      registerType(rawType, {
        name: name,
        'fromWireType': function (value) {
          var length = HEAPU32[value >> 2];
          var str;

          if (stdStringIsUTF8) {
            //ensure null termination at one-past-end byte if not present yet
            var endChar = HEAPU8[value + 4 + length];
            var endCharSwap = 0;

            if (endChar != 0) {
              endCharSwap = endChar;
              HEAPU8[value + 4 + length] = 0;
            }

            var decodeStartPtr = value + 4; //looping here to support possible embedded '0' bytes

            for (var i = 0; i <= length; ++i) {
              var currentBytePtr = value + 4 + i;

              if (HEAPU8[currentBytePtr] == 0) {
                var stringSegment = UTF8ToString(decodeStartPtr);
                if (str === undefined) { str = stringSegment; }else {
                  str += String.fromCharCode(0);
                  str += stringSegment;
                }
                decodeStartPtr = currentBytePtr + 1;
              }
            }

            if (endCharSwap != 0) { HEAPU8[value + 4 + length] = endCharSwap; }
          } else {
            var a = new Array(length);

            for (var i = 0; i < length; ++i) {
              a[i] = String.fromCharCode(HEAPU8[value + 4 + i]);
            }

            str = a.join('');
          }

          _free(value);

          return str;
        },
        'toWireType': function (destructors, value) {
          if (value instanceof ArrayBuffer) {
            value = new Uint8Array(value);
          }

          var getLength;
          var valueIsOfTypeString = typeof value === 'string';

          if (!(valueIsOfTypeString || value instanceof Uint8Array || value instanceof Uint8ClampedArray || value instanceof Int8Array)) {
            throwBindingError('Cannot pass non-string to std::string');
          }

          if (stdStringIsUTF8 && valueIsOfTypeString) {
            getLength = function () {
              return lengthBytesUTF8(value);
            };
          } else {
            getLength = function () {
              return value.length;
            };
          } // assumes 4-byte alignment


          var length = getLength();

          var ptr = _malloc(4 + length + 1);

          HEAPU32[ptr >> 2] = length;

          if (stdStringIsUTF8 && valueIsOfTypeString) {
            stringToUTF8(value, ptr + 4, length + 1);
          } else {
            if (valueIsOfTypeString) {
              for (var i = 0; i < length; ++i) {
                var charCode = value.charCodeAt(i);

                if (charCode > 255) {
                  _free(ptr);

                  throwBindingError('String has UTF-16 code units that do not fit in 8 bits');
                }

                HEAPU8[ptr + 4 + i] = charCode;
              }
            } else {
              for (var i = 0; i < length; ++i) {
                HEAPU8[ptr + 4 + i] = value[i];
              }
            }
          }

          if (destructors !== null) {
            destructors.push(_free, ptr);
          }

          return ptr;
        },
        'argPackAdvance': 8,
        'readValueFromPointer': simpleReadValueFromPointer,
        destructorFunction: function (ptr) {
          _free(ptr);
        }
      });
    }

    function __embind_register_std_wstring(rawType, charSize, name) {
      // nb. do not cache HEAPU16 and HEAPU32, they may be destroyed by emscripten_resize_heap().
      name = readLatin1String(name);
      var getHeap, shift;

      if (charSize === 2) {
        getHeap = function () {
          return HEAPU16;
        };

        shift = 1;
      } else if (charSize === 4) {
        getHeap = function () {
          return HEAPU32;
        };

        shift = 2;
      }

      registerType(rawType, {
        name: name,
        'fromWireType': function (value) {
          var HEAP = getHeap();
          var length = HEAPU32[value >> 2];
          var a = new Array(length);
          var start = value + 4 >> shift;

          for (var i = 0; i < length; ++i) {
            a[i] = String.fromCharCode(HEAP[start + i]);
          }

          _free(value);

          return a.join('');
        },
        'toWireType': function (destructors, value) {
          // assumes 4-byte alignment
          var HEAP = getHeap();
          var length = value.length;

          var ptr = _malloc(4 + length * charSize);

          HEAPU32[ptr >> 2] = length;
          var start = ptr + 4 >> shift;

          for (var i = 0; i < length; ++i) {
            HEAP[start + i] = value.charCodeAt(i);
          }

          if (destructors !== null) {
            destructors.push(_free, ptr);
          }

          return ptr;
        },
        'argPackAdvance': 8,
        'readValueFromPointer': simpleReadValueFromPointer,
        destructorFunction: function (ptr) {
          _free(ptr);
        }
      });
    }

    function __embind_register_void(rawType, name) {
      name = readLatin1String(name);
      registerType(rawType, {
        isVoid: true,
        // void return values can be optimized out sometimes
        name: name,
        'argPackAdvance': 0,
        'fromWireType': function () {
          return undefined;
        },
        'toWireType': function (destructors, o) {
          // TODO: assert if anything else is given?
          return undefined;
        }
      });
    }

    function requireRegisteredType(rawType, humanName) {
      var impl = registeredTypes[rawType];

      if (undefined === impl) {
        throwBindingError(humanName + " has unknown type " + getTypeName(rawType));
      }

      return impl;
    }

    function __emval_lookupTypes(argCount, argTypes, argWireTypes) {
      var a = new Array(argCount);

      for (var i = 0; i < argCount; ++i) {
        a[i] = requireRegisteredType(HEAP32[(argTypes >> 2) + i], "parameter " + i);
      }

      return a;
    }

    function requireHandle(handle) {
      if (!handle) {
        throwBindingError('Cannot use deleted val. handle = ' + handle);
      }

      return emval_handle_array[handle].value;
    }

    function __emval_call(handle, argCount, argTypes, argv) {
      handle = requireHandle(handle);

      var types = __emval_lookupTypes(argCount, argTypes);

      var args = new Array(argCount);

      for (var i = 0; i < argCount; ++i) {
        var type = types[i];
        args[i] = type['readValueFromPointer'](argv);
        argv += type['argPackAdvance'];
      }

      var rv = handle.apply(undefined, args);
      return __emval_register(rv);
    }

    function __emval_incref(handle) {
      if (handle > 4) {
        emval_handle_array[handle].refcount += 1;
      }
    }

    function __emval_take_value(type, argv) {
      type = requireRegisteredType(type, '_emval_take_value');
      var v = type['readValueFromPointer'](argv);
      return __emval_register(v);
    }

    function _abort() {
      Module['abort']();
    }

    function _emscripten_get_heap_size() {
      return HEAP8.length;
    }

    function abortOnCannotGrowMemory(requestedSize) {
      abort('Cannot enlarge memory arrays to size ' + requestedSize + ' bytes (OOM). Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' + HEAP8.length + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime, or (3) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
    }

    function emscripten_realloc_buffer(size) {
      var PAGE_MULTIPLE = 65536;
      size = alignUp(size, PAGE_MULTIPLE); // round up to wasm page size

      var oldSize = buffer.byteLength; // native wasm support

      try {
        var result = wasmMemory.grow((size - oldSize) / 65536); // .grow() takes a delta compared to the previous size

        if (result !== (-1 | 0)) {
          // success in native wasm memory growth, get the buffer from the memory
          return buffer = wasmMemory.buffer;
        } else {
          return null;
        }
      } catch (e) {
        console.error('emscripten_realloc_buffer: Attempted to grow from ' + oldSize + ' bytes to ' + size + ' bytes, but got error: ' + e);
        return null;
      }
    }

    function _emscripten_resize_heap(requestedSize) {
      var oldSize = _emscripten_get_heap_size();

      assert(requestedSize > oldSize); // This function should only ever be called after the ceiling of the dynamic heap has already been bumped to exceed the current total size of the asm.js heap.

      var PAGE_MULTIPLE = 65536;
      var LIMIT = 2147483648 - PAGE_MULTIPLE; // We can do one page short of 2GB as theoretical maximum.

      if (requestedSize > LIMIT) {
        err('Cannot enlarge memory, asked to go up to ' + requestedSize + ' bytes, but the limit is ' + LIMIT + ' bytes!');
        return false;
      }

      var MIN_TOTAL_MEMORY = 16777216;
      var newSize = Math.max(oldSize, MIN_TOTAL_MEMORY); // So the loop below will not be infinite, and minimum asm.js memory size is 16MB.

      while (newSize < requestedSize) {
        // Keep incrementing the heap size as long as it's less than what is requested.
        if (newSize <= 536870912) {
          newSize = alignUp(2 * newSize, PAGE_MULTIPLE); // Simple heuristic: double until 1GB...
        } else {
          // ..., but after that, add smaller increments towards 2GB, which we cannot reach
          newSize = Math.min(alignUp((3 * newSize + 2147483648) / 4, PAGE_MULTIPLE), LIMIT);

          if (newSize === oldSize) {
            warnOnce('Cannot ask for more memory since we reached the practical limit in browsers (which is just below 2GB), so the request would have failed. Requesting only ' + HEAP8.length);
          }
        }
      }
      var replacement = emscripten_realloc_buffer(newSize);

      if (!replacement || replacement.byteLength != newSize) {
        err('Failed to grow the heap from ' + oldSize + ' bytes to ' + newSize + ' bytes, not enough memory!');

        if (replacement) {
          err('Expected to get back a buffer of size ' + newSize + ' bytes, but instead got back a buffer of size ' + replacement.byteLength);
        }

        return false;
      } // everything worked


      updateGlobalBufferViews();
      return true;
    }

    function _gettimeofday(ptr) {
      var now = Date.now();
      HEAP32[ptr >> 2] = now / 1000 | 0; // seconds

      HEAP32[ptr + 4 >> 2] = now % 1000 * 1000 | 0; // microseconds

      return 0;
    }

    function _llvm_log10_f32(x) {
      return Math.log(x) / Math.LN10; // TODO: Math.log10, when browser support is there
    }

    function _llvm_log10_f64(a0
    /*``*/
    ) {
      return _llvm_log10_f32(a0);
    }

    function _llvm_trap() {
      abort('trap!');
    }

    function _longjmp(env, value) {
      _setThrew(env, value || 1);

      throw 'longjmp';
    }

    function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src + num), dest);
    }

    function _pthread_cond_destroy() {
      return 0;
    }

    function _pthread_cond_init() {
      return 0;
    }

    function _pthread_cond_signal() {
      return 0;
    }

    function _pthread_cond_wait() {
      return 0;
    }

    function _pthread_create() {
      return 11;
    }

    function _pthread_join() {}

    function _time(ptr) {
      var ret = Date.now() / 1000 | 0;

      if (ptr) {
        HEAP32[ptr >> 2] = ret;
      }

      return ret;
    }

    embind_init_charCodes();
    BindingError = Module['BindingError'] = extendError(Error, 'BindingError');
    InternalError = Module['InternalError'] = extendError(Error, 'InternalError');
    init_ClassHandle();
    init_RegisteredPointer();
    init_embind();
    UnboundTypeError = Module['UnboundTypeError'] = extendError(Error, 'UnboundTypeError');
    init_emval();


    var debug_table_dd = ["0", "_log"];
    var debug_table_i = ["0", "_vp9_alt_ref_aq_create"];
    var debug_table_ii = ["0", "__ZNK11MyMkvWriter8SeekableEv", "__ZNK17MyMkvStreamWriter8SeekableEv", "_encoder_destroy", "_encoder_get_preview", "_reset", "_sync_1480", "__ZN8mkvmuxer5Track18AddContentEncodingEv", "___stdio_close", "__ZN10emscripten8internal13getActualTypeI11WebmEncoderEEPKvPT_", "__ZN11WebmEncoder8finalizeEv", "_malloc", "_vpx_malloc", "_thread_loop", "0", "0"];
    var debug_table_iii = ["0", "_encoder_init", "_encoder_get_cxdata", "_encoder_set_config", "_ctrl_copy_reference", "_ctrl_set_reference", "_ctrl_set_previewpp", "_ctrl_set_roi_map", "_ctrl_set_active_map", "_ctrl_set_scale_mode", "_ctrl_set_cpuused", "_ctrl_set_enable_auto_alt_ref", "_ctrl_set_sharpness", "_ctrl_set_static_thresh", "_ctrl_set_tile_columns", "_ctrl_set_tile_rows", "_ctrl_set_arnr_max_frames", "_ctrl_set_arnr_strength", "_ctrl_set_arnr_type", "_ctrl_set_tuning", "_ctrl_set_cq_level", "_ctrl_set_rc_max_intra_bitrate_pct", "_ctrl_set_rc_max_inter_bitrate_pct", "_ctrl_set_rc_gf_cbr_boost_pct", "_ctrl_set_lossless", "_ctrl_set_frame_parallel_decoding_mode", "_ctrl_set_aq_mode", "_ctrl_set_alt_ref_aq", "_ctrl_set_frame_periodic_boost", "_ctrl_set_svc", "_ctrl_set_svc_parameters", "_ctrl_register_cx_callback", "_ctrl_set_svc_layer_id", "_ctrl_set_tune_content", "_ctrl_set_color_space", "_ctrl_set_color_range", "_ctrl_set_noise_sensitivity", "_ctrl_set_min_gf_interval", "_ctrl_set_max_gf_interval", "_ctrl_set_svc_ref_frame_config", "_ctrl_set_render_size", "_ctrl_set_target_level", "_ctrl_set_row_mt", "_ctrl_enable_motion_vector_unit_test", "_ctrl_get_quantizer", "_ctrl_get_quantizer64", "_ctrl_get_reference", "_ctrl_get_svc_layer_id", "_ctrl_get_active_map", "_ctrl_get_level", "__ZNK8mkvmuxer5Track5WriteEPNS_10IMkvWriterE", "__ZNK8mkvmuxer10VideoTrack5WriteEPNS_10IMkvWriterE", "__ZN11WebmEncoder12addRGBAFrameENSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEE", "__ZN10emscripten8internal13MethodInvokerIM11WebmEncoderFbvEbPS2_JEE6invokeERKS4_S5_", "__ZN10emscripten8internal13MethodInvokerIM11WebmEncoderFNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEvES9_PS2_JEE6invokeERKSB_SC_", "_vpx_codec_pkt_list_add", "_vpx_memalign", "_vp9_enc_alloc_mi", "_vpx_calloc", "_scaled_x", "_unscaled_value", "_scaled_y", "_loop_filter_row_worker", "_encode_tile_worker", "_enc_worker_hook", "_first_pass_worker_hook", "_temporal_filter_worker_hook", "_enc_row_mt_worker_hook", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"];
    var debug_table_iiii = ["0", "__ZN11MyMkvWriter5WriteEPKvj", "__ZN17MyMkvStreamWriter5WriteEPKvj", "___stdio_write", "___stdio_seek", "___stdout_write", "_sn_write", "__ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv", "__ZNK10__cxxabiv123__fundamental_type_info9can_catchEPKNS_16__shim_type_infoERPv", "__ZNK10__cxxabiv119__pointer_type_info9can_catchEPKNS_16__shim_type_infoERPv", "__ZN10emscripten8internal13MethodInvokerIM11WebmEncoderFbNSt3__212basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEEbPS2_JS9_EE6invokeERKSB_SC_PNS0_11BindingTypeIS9_EUt_E", "___stdio_read", "0", "0", "0", "0"];
    var debug_table_iiiii = ["0", "__emval_call", "_vpx_sad32x16_c", "_vpx_sad16x32_c", "_vpx_sad64x32_c", "_vpx_sad32x64_c", "_vpx_sad32x32_c", "_vpx_sad64x64_c", "_vpx_sad16x16_c", "_vpx_sad16x8_c", "_vpx_sad8x16_c", "_vpx_sad8x8_c", "_vpx_sad8x4_c", "_vpx_sad4x8_c", "_vpx_sad4x4_c", "0"];
    var debug_table_iiiiii = ["0", "_vpx_sad32x16_avg_c", "_vpx_variance32x16_c", "_vpx_sad16x32_avg_c", "_vpx_variance16x32_c", "_vpx_sad64x32_avg_c", "_vpx_variance64x32_c", "_vpx_sad32x64_avg_c", "_vpx_variance32x64_c", "_vpx_sad32x32_avg_c", "_vpx_variance32x32_c", "_vpx_sad64x64_avg_c", "_vpx_variance64x64_c", "_vpx_sad16x16_avg_c", "_vpx_variance16x16_c", "_vpx_sad16x8_avg_c", "_vpx_variance16x8_c", "_vpx_sad8x16_avg_c", "_vpx_variance8x16_c", "_vpx_sad8x8_avg_c", "_vpx_variance8x8_c", "_vpx_sad8x4_avg_c", "_vpx_variance8x4_c", "_vpx_sad4x8_avg_c", "_vpx_variance4x8_c", "_vpx_sad4x4_avg_c", "_vpx_variance4x4_c", "_vpx_mse8x8_c", "_vpx_mse16x8_c", "_vpx_mse8x16_c", "_vpx_mse16x16_c", "0"];
    var debug_table_iiiiiiii = ["0", "_vp9_get_compressed_data", "_vpx_sub_pixel_variance32x16_c", "_vpx_sub_pixel_variance16x32_c", "_vpx_sub_pixel_variance64x32_c", "_vpx_sub_pixel_variance32x64_c", "_vpx_sub_pixel_variance32x32_c", "_vpx_sub_pixel_variance64x64_c", "_vpx_sub_pixel_variance16x16_c", "_vpx_sub_pixel_variance16x8_c", "_vpx_sub_pixel_variance8x16_c", "_vpx_sub_pixel_variance8x8_c", "_vpx_sub_pixel_variance8x4_c", "_vpx_sub_pixel_variance4x8_c", "_vpx_sub_pixel_variance4x4_c", "0"];
    var debug_table_iiiiiiiii = ["0", "__ZN10emscripten8internal12operator_newI11WebmEncoderJiijjjbbNS_3valEEEEPT_DpOT0_", "_vpx_sub_pixel_avg_variance32x16_c", "_vpx_sub_pixel_avg_variance16x32_c", "_vpx_sub_pixel_avg_variance64x32_c", "_vpx_sub_pixel_avg_variance32x64_c", "_vpx_sub_pixel_avg_variance32x32_c", "_vpx_sub_pixel_avg_variance64x64_c", "_vpx_sub_pixel_avg_variance16x16_c", "_vpx_sub_pixel_avg_variance16x8_c", "_vpx_sub_pixel_avg_variance8x16_c", "_vpx_sub_pixel_avg_variance8x8_c", "_vpx_sub_pixel_avg_variance8x4_c", "_vpx_sub_pixel_avg_variance4x8_c", "_vpx_sub_pixel_avg_variance4x4_c", "0"];
    var debug_table_iiiiiiiiii = ["0", "__ZN10emscripten8internal7InvokerIP11WebmEncoderJOiS4_OjS5_S5_ObS6_ONS_3valEEE6invokeEPFS3_S4_S4_S5_S5_S5_S6_S6_S8_EiijjjbbPNS0_7_EM_VALE", "_vp9_diamond_search_sad_c", "0"];
    var debug_table_iiiiiiiiiiiiiiiii = ["0", "_vp9_return_max_sub_pixel_mv", "_vp9_return_min_sub_pixel_mv", "_vp9_skip_sub_pixel_tree", "_vp9_find_best_sub_pixel_tree", "_vp9_find_best_sub_pixel_tree_pruned", "_vp9_find_best_sub_pixel_tree_pruned_more", "_vp9_find_best_sub_pixel_tree_pruned_evenmore"];
    var debug_table_iiiijj = ["0", "_vp9_receive_raw_frame"];
    var debug_table_iiijiii = ["0", "_encoder_encode"];
    var debug_table_iij = ["0", "__ZN11MyMkvWriter8PositionEx", "__ZN17MyMkvStreamWriter8PositionEx", "0"];
    var debug_table_ji = ["0", "__ZNK11MyMkvWriter8PositionEv", "__ZNK17MyMkvStreamWriter8PositionEv", "__ZNK8mkvmuxer5Track11PayloadSizeEv", "__ZNK8mkvmuxer5Track4SizeEv", "__ZNK8mkvmuxer10VideoTrack11PayloadSizeEv", "0", "0"];
    var debug_table_v = ["0", "___cxa_pure_virtual", "__ZL25default_terminate_handlerv", "_vp9_initialize_enc", "_setup_rtcd_internal", "_setup_rtcd_internal_724", "_setup_rtcd_internal_802", "_vp9_init_intra_predictors_internal", "__ZN10__cxxabiv112_GLOBAL__N_110construct_Ev", "0", "0", "0", "0", "0", "0", "0"];
    var debug_table_vi = ["0", "__ZN11MyMkvWriterD2Ev", "__ZN11MyMkvWriterD0Ev", "__ZN17MyMkvStreamWriterD2Ev", "__ZN17MyMkvStreamWriterD0Ev", "_init", "_launch", "_execute", "_end", "__ZN8mkvmuxer10IMkvWriterD2Ev", "__ZN8mkvmuxer10IMkvWriterD0Ev", "__ZN8mkvmuxer5TrackD2Ev", "__ZN8mkvmuxer5TrackD0Ev", "__ZN8mkvmuxer10VideoTrackD2Ev", "__ZN8mkvmuxer10VideoTrackD0Ev", "__ZN10__cxxabiv116__shim_type_infoD2Ev", "__ZN10__cxxabiv117__class_type_infoD0Ev", "__ZNK10__cxxabiv116__shim_type_info5noop1Ev", "__ZNK10__cxxabiv116__shim_type_info5noop2Ev", "__ZN10__cxxabiv120__si_class_type_infoD0Ev", "__ZN10__cxxabiv123__fundamental_type_infoD0Ev", "__ZN10__cxxabiv119__pointer_type_infoD0Ev", "__ZN10__cxxabiv121__vmi_class_type_infoD0Ev", "__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev", "__ZN10emscripten8internal14raw_destructorI11WebmEncoderEEvPT_", "_free", "_vp9_remove_compressor", "_vp9_enc_free_mi", "_vp9_enc_setup_mi", "_alloc_compressor_data", "_vp9_init_layer_context", "_realloc_segmentation_maps", "_vp9_init_first_pass", "_vpx_free", "_vp9_init_second_pass_spatial_svc", "_vp9_init_second_pass", "_vp9_set_speed_features_framesize_independent", "_vp9_set_speed_features_framesize_dependent", "_vp9_init_quantizer", "_vp9_loop_filter_init", "__ZN10__cxxabiv112_GLOBAL__N_19destruct_EPv", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"];
    var debug_table_vid = ["0", "_vp9_update_spatial_layer_framerate"];
    var debug_table_vii = ["0", "_idct4_c", "_iadst4_c", "_idct8_c", "_iadst8_c", "_idct16_c", "_iadst16_c", "_fdct4", "_fadst4", "_fdct8", "_fadst8", "_fdct16", "_fadst16", "__ZN11WebmEncoder9lastErrorEv", "_vp9_change_config", "_vp9_apply_encoding_flags"];
    var debug_table_viii = ["0", "_vp9_noise_estimate_init", "_vp9_rc_init", "_vpx_fdct4x4_c", "_vp9_fwht4x4_c", "_vp9_row_mt_sync_read_dummy", "_vp9_row_mt_sync_read", "0"];
    var debug_table_viiii = ["0", "__ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi", "__ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi", "__ZNK10__cxxabiv121__vmi_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi", "_vpx_internal_error", "_vp9_idct4x4_add", "_vp9_iwht4x4_add", "_vpx_v_predictor_4x4_c", "_vpx_v_predictor_8x8_c", "_vpx_v_predictor_16x16_c", "_vpx_v_predictor_32x32_c", "_vpx_h_predictor_4x4_c", "_vpx_h_predictor_8x8_c", "_vpx_h_predictor_16x16_c", "_vpx_h_predictor_32x32_c", "_vpx_d207_predictor_4x4_c", "_vpx_d207_predictor_8x8_c", "_vpx_d207_predictor_16x16_c", "_vpx_d207_predictor_32x32_c", "_vpx_d45_predictor_4x4_c", "_vpx_d45_predictor_8x8_c", "_vpx_d45_predictor_16x16_c", "_vpx_d45_predictor_32x32_c", "_vpx_d63_predictor_4x4_c", "_vpx_d63_predictor_8x8_c", "_vpx_d63_predictor_16x16_c", "_vpx_d63_predictor_32x32_c", "_vpx_d117_predictor_4x4_c", "_vpx_d117_predictor_8x8_c", "_vpx_d117_predictor_16x16_c", "_vpx_d117_predictor_32x32_c", "_vpx_d135_predictor_4x4_c", "_vpx_d135_predictor_8x8_c", "_vpx_d135_predictor_16x16_c", "_vpx_d135_predictor_32x32_c", "_vpx_d153_predictor_4x4_c", "_vpx_d153_predictor_8x8_c", "_vpx_d153_predictor_16x16_c", "_vpx_d153_predictor_32x32_c", "_vpx_tm_predictor_4x4_c", "_vpx_tm_predictor_8x8_c", "_vpx_tm_predictor_16x16_c", "_vpx_tm_predictor_32x32_c", "_vpx_dc_128_predictor_4x4_c", "_vpx_dc_128_predictor_8x8_c", "_vpx_dc_128_predictor_16x16_c", "_vpx_dc_128_predictor_32x32_c", "_vpx_dc_top_predictor_4x4_c", "_vpx_dc_top_predictor_8x8_c", "_vpx_dc_top_predictor_16x16_c", "_vpx_dc_top_predictor_32x32_c", "_vpx_dc_left_predictor_4x4_c", "_vpx_dc_left_predictor_8x8_c", "_vpx_dc_left_predictor_16x16_c", "_vpx_dc_left_predictor_32x32_c", "_vpx_dc_predictor_4x4_c", "_vpx_dc_predictor_8x8_c", "_vpx_dc_predictor_16x16_c", "_vpx_dc_predictor_32x32_c", "_vp9_row_mt_sync_write_dummy", "_vp9_row_mt_sync_write", "0", "0", "0"];
    var debug_table_viiiii = ["0", "__ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib", "__ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib", "__ZNK10__cxxabiv121__vmi_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib", "_vpx_sad32x16x4d_c", "_vpx_sad16x32x4d_c", "_vpx_sad64x32x4d_c", "_vpx_sad32x64x4d_c", "_vpx_sad32x32x4d_c", "_vpx_sad64x64x4d_c", "_vpx_sad16x16x4d_c", "_vpx_sad16x8x4d_c", "_vpx_sad8x16x4d_c", "_vpx_sad8x8x4d_c", "_vpx_sad8x4x4d_c", "_vpx_sad4x8x4d_c", "_vpx_sad4x4x4d_c", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"];
    var debug_table_viiiiii = ["0", "__ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib", "__ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib", "__ZNK10__cxxabiv121__vmi_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib"];
    var debug_table_viiiiiii = ["0", "_is_skippable", "_has_high_freq_coeff", "_tokenize_b", "_set_entropy_context_b", "_encode_block_pass1", "_encode_block", "_vp9_encode_block_intra", "_block_rd_txfm", "_estimate_block_intra", "0", "0", "0", "0", "0", "0"];
    var debug_table_viiiiiiiiiii = ["0", "_vpx_scaled_2d_c", "_vpx_scaled_horiz_c", "_vpx_scaled_avg_2d_c", "_vpx_scaled_avg_horiz_c", "_vpx_convolve_copy_c", "_vpx_convolve_avg_c", "_vpx_convolve8_vert_c", "_vpx_convolve8_avg_vert_c", "_vpx_convolve8_horiz_c", "_vpx_convolve8_avg_horiz_c", "_vpx_convolve8_c", "_vpx_convolve8_avg_c", "_vpx_scaled_vert_c", "_vpx_scaled_avg_vert_c", "0"];
    var debug_table_vijj = ["0", "__ZN11MyMkvWriter18ElementStartNotifyEyx", "__ZN17MyMkvStreamWriter18ElementStartNotifyEyx", "0"];

    function nullFunc_dd(x) {
      err("Invalid function pointer '" + x + "' called with signature 'dd'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
      err("This pointer might make sense in another type signature: vid: " + debug_table_vid[x] + "  i: " + debug_table_i[x] + "  v: " + debug_table_v[x] + "  ii: " + debug_table_ii[x] + "  ji: " + debug_table_ji[x] + "  vi: " + debug_table_vi[x] + "  iii: " + debug_table_iii[x] + "  iij: " + debug_table_iij[x] + "  vii: " + debug_table_vii[x] + "  iiii: " + debug_table_iiii[x] + "  viii: " + debug_table_viii[x] + "  vijj: " + debug_table_vijj[x] + "  iiiii: " + debug_table_iiiii[x] + "  viiii: " + debug_table_viiii[x] + "  iiiiii: " + debug_table_iiiiii[x] + "  iiiijj: " + debug_table_iiiijj[x] + "  viiiii: " + debug_table_viiiii[x] + "  iiijiii: " + debug_table_iiijiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  iiiiiiii: " + debug_table_iiiiiiii[x] + "  viiiiiii: " + debug_table_viiiiiii[x] + "  iiiiiiiii: " + debug_table_iiiiiiiii[x] + "  iiiiiiiiii: " + debug_table_iiiiiiiiii[x] + "  viiiiiiiiiii: " + debug_table_viiiiiiiiiii[x] + "  iiiiiiiiiiiiiiiii: " + debug_table_iiiiiiiiiiiiiiiii[x] + "  ");
      abort(x);
    }

    function nullFunc_i(x) {
      err("Invalid function pointer '" + x + "' called with signature 'i'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
      err("This pointer might make sense in another type signature: ii: " + debug_table_ii[x] + "  iii: " + debug_table_iii[x] + "  iij: " + debug_table_iij[x] + "  iiii: " + debug_table_iiii[x] + "  iiiii: " + debug_table_iiiii[x] + "  iiiiii: " + debug_table_iiiiii[x] + "  iiiijj: " + debug_table_iiiijj[x] + "  iiijiii: " + debug_table_iiijiii[x] + "  iiiiiiii: " + debug_table_iiiiiiii[x] + "  iiiiiiiii: " + debug_table_iiiiiiiii[x] + "  iiiiiiiiii: " + debug_table_iiiiiiiiii[x] + "  iiiiiiiiiiiiiiiii: " + debug_table_iiiiiiiiiiiiiiiii[x] + "  ji: " + debug_table_ji[x] + "  vi: " + debug_table_vi[x] + "  v: " + debug_table_v[x] + "  vid: " + debug_table_vid[x] + "  vii: " + debug_table_vii[x] + "  dd: " + debug_table_dd[x] + "  viii: " + debug_table_viii[x] + "  vijj: " + debug_table_vijj[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  viiiiiii: " + debug_table_viiiiiii[x] + "  viiiiiiiiiii: " + debug_table_viiiiiiiiiii[x] + "  ");
      abort(x);
    }

    function nullFunc_ii(x) {
      err("Invalid function pointer '" + x + "' called with signature 'ii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
      err("This pointer might make sense in another type signature: i: " + debug_table_i[x] + "  iii: " + debug_table_iii[x] + "  iij: " + debug_table_iij[x] + "  iiii: " + debug_table_iiii[x] + "  iiiii: " + debug_table_iiiii[x] + "  iiiiii: " + debug_table_iiiiii[x] + "  iiiijj: " + debug_table_iiiijj[x] + "  iiijiii: " + debug_table_iiijiii[x] + "  iiiiiiii: " + debug_table_iiiiiiii[x] + "  iiiiiiiii: " + debug_table_iiiiiiiii[x] + "  iiiiiiiiii: " + debug_table_iiiiiiiiii[x] + "  iiiiiiiiiiiiiiiii: " + debug_table_iiiiiiiiiiiiiiiii[x] + "  vii: " + debug_table_vii[x] + "  ji: " + debug_table_ji[x] + "  vi: " + debug_table_vi[x] + "  viii: " + debug_table_viii[x] + "  vid: " + debug_table_vid[x] + "  v: " + debug_table_v[x] + "  dd: " + debug_table_dd[x] + "  viiii: " + debug_table_viiii[x] + "  vijj: " + debug_table_vijj[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  viiiiiii: " + debug_table_viiiiiii[x] + "  viiiiiiiiiii: " + debug_table_viiiiiiiiiii[x] + "  ");
      abort(x);
    }

    function nullFunc_iii(x) {
      err("Invalid function pointer '" + x + "' called with signature 'iii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
      err("This pointer might make sense in another type signature: ii: " + debug_table_ii[x] + "  iiii: " + debug_table_iiii[x] + "  i: " + debug_table_i[x] + "  iiiii: " + debug_table_iiiii[x] + "  iiiiii: " + debug_table_iiiiii[x] + "  iiiijj: " + debug_table_iiiijj[x] + "  iiijiii: " + debug_table_iiijiii[x] + "  iiiiiiii: " + debug_table_iiiiiiii[x] + "  iiiiiiiii: " + debug_table_iiiiiiiii[x] + "  iiiiiiiiii: " + debug_table_iiiiiiiiii[x] + "  iiiiiiiiiiiiiiiii: " + debug_table_iiiiiiiiiiiiiiiii[x] + "  viii: " + debug_table_viii[x] + "  iij: " + debug_table_iij[x] + "  vii: " + debug_table_vii[x] + "  ji: " + debug_table_ji[x] + "  vi: " + debug_table_vi[x] + "  viiii: " + debug_table_viiii[x] + "  vid: " + debug_table_vid[x] + "  viiiii: " + debug_table_viiiii[x] + "  vijj: " + debug_table_vijj[x] + "  dd: " + debug_table_dd[x] + "  v: " + debug_table_v[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  viiiiiii: " + debug_table_viiiiiii[x] + "  viiiiiiiiiii: " + debug_table_viiiiiiiiiii[x] + "  ");
      abort(x);
    }

    function nullFunc_iiii(x) {
      err("Invalid function pointer '" + x + "' called with signature 'iiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
      err("This pointer might make sense in another type signature: iii: " + debug_table_iii[x] + "  ii: " + debug_table_ii[x] + "  iiiii: " + debug_table_iiiii[x] + "  i: " + debug_table_i[x] + "  iiiiii: " + debug_table_iiiiii[x] + "  iiiijj: " + debug_table_iiiijj[x] + "  iiiiiiii: " + debug_table_iiiiiiii[x] + "  iiiiiiiii: " + debug_table_iiiiiiiii[x] + "  iiiiiiiiii: " + debug_table_iiiiiiiiii[x] + "  iiiiiiiiiiiiiiiii: " + debug_table_iiiiiiiiiiiiiiiii[x] + "  viii: " + debug_table_viii[x] + "  viiii: " + debug_table_viiii[x] + "  iij: " + debug_table_iij[x] + "  vii: " + debug_table_vii[x] + "  ji: " + debug_table_ji[x] + "  vi: " + debug_table_vi[x] + "  viiiii: " + debug_table_viiiii[x] + "  vid: " + debug_table_vid[x] + "  vijj: " + debug_table_vijj[x] + "  iiijiii: " + debug_table_iiijiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  dd: " + debug_table_dd[x] + "  v: " + debug_table_v[x] + "  viiiiiii: " + debug_table_viiiiiii[x] + "  viiiiiiiiiii: " + debug_table_viiiiiiiiiii[x] + "  ");
      abort(x);
    }

    function nullFunc_iiiii(x) {
      err("Invalid function pointer '" + x + "' called with signature 'iiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
      err("This pointer might make sense in another type signature: iiii: " + debug_table_iiii[x] + "  iii: " + debug_table_iii[x] + "  ii: " + debug_table_ii[x] + "  iiiiii: " + debug_table_iiiiii[x] + "  i: " + debug_table_i[x] + "  iiiiiiii: " + debug_table_iiiiiiii[x] + "  iiiiiiiii: " + debug_table_iiiiiiiii[x] + "  iiiiiiiiii: " + debug_table_iiiiiiiiii[x] + "  iiiiiiiiiiiiiiiii: " + debug_table_iiiiiiiiiiiiiiiii[x] + "  viiii: " + debug_table_viiii[x] + "  viii: " + debug_table_viii[x] + "  viiiii: " + debug_table_viiiii[x] + "  iij: " + debug_table_iij[x] + "  vii: " + debug_table_vii[x] + "  ji: " + debug_table_ji[x] + "  vi: " + debug_table_vi[x] + "  iiiijj: " + debug_table_iiiijj[x] + "  iiijiii: " + debug_table_iiijiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  vid: " + debug_table_vid[x] + "  vijj: " + debug_table_vijj[x] + "  dd: " + debug_table_dd[x] + "  viiiiiii: " + debug_table_viiiiiii[x] + "  v: " + debug_table_v[x] + "  viiiiiiiiiii: " + debug_table_viiiiiiiiiii[x] + "  ");
      abort(x);
    }

    function nullFunc_iiiiii(x) {
      err("Invalid function pointer '" + x + "' called with signature 'iiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
      err("This pointer might make sense in another type signature: iiii: " + debug_table_iiii[x] + "  iiiii: " + debug_table_iiiii[x] + "  iii: " + debug_table_iii[x] + "  ii: " + debug_table_ii[x] + "  iiiiiiii: " + debug_table_iiiiiiii[x] + "  i: " + debug_table_i[x] + "  iiiiiiiii: " + debug_table_iiiiiiiii[x] + "  iiiiiiiiii: " + debug_table_iiiiiiiiii[x] + "  iiiiiiiiiiiiiiiii: " + debug_table_iiiiiiiiiiiiiiiii[x] + "  viiii: " + debug_table_viiii[x] + "  viii: " + debug_table_viii[x] + "  viiiii: " + debug_table_viiiii[x] + "  iij: " + debug_table_iij[x] + "  vii: " + debug_table_vii[x] + "  iiijiii: " + debug_table_iiijiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  iiiijj: " + debug_table_iiiijj[x] + "  ji: " + debug_table_ji[x] + "  vi: " + debug_table_vi[x] + "  vid: " + debug_table_vid[x] + "  viiiiiii: " + debug_table_viiiiiii[x] + "  vijj: " + debug_table_vijj[x] + "  dd: " + debug_table_dd[x] + "  v: " + debug_table_v[x] + "  viiiiiiiiiii: " + debug_table_viiiiiiiiiii[x] + "  ");
      abort(x);
    }

    function nullFunc_iiiiiiii(x) {
      err("Invalid function pointer '" + x + "' called with signature 'iiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
      err("This pointer might make sense in another type signature: iiii: " + debug_table_iiii[x] + "  iiiii: " + debug_table_iiiii[x] + "  iiiiii: " + debug_table_iiiiii[x] + "  iii: " + debug_table_iii[x] + "  ii: " + debug_table_ii[x] + "  iiiiiiiii: " + debug_table_iiiiiiiii[x] + "  iiiiiiiiii: " + debug_table_iiiiiiiiii[x] + "  i: " + debug_table_i[x] + "  iiiiiiiiiiiiiiiii: " + debug_table_iiiiiiiiiiiiiiiii[x] + "  viiii: " + debug_table_viiii[x] + "  viii: " + debug_table_viii[x] + "  viiiii: " + debug_table_viiiii[x] + "  iiijiii: " + debug_table_iiijiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  iij: " + debug_table_iij[x] + "  vii: " + debug_table_vii[x] + "  viiiiiii: " + debug_table_viiiiiii[x] + "  iiiijj: " + debug_table_iiiijj[x] + "  ji: " + debug_table_ji[x] + "  vi: " + debug_table_vi[x] + "  vid: " + debug_table_vid[x] + "  vijj: " + debug_table_vijj[x] + "  dd: " + debug_table_dd[x] + "  v: " + debug_table_v[x] + "  viiiiiiiiiii: " + debug_table_viiiiiiiiiii[x] + "  ");
      abort(x);
    }

    function nullFunc_iiiiiiiii(x) {
      err("Invalid function pointer '" + x + "' called with signature 'iiiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
      err("This pointer might make sense in another type signature: iiii: " + debug_table_iiii[x] + "  iiiii: " + debug_table_iiiii[x] + "  iiiiii: " + debug_table_iiiiii[x] + "  iii: " + debug_table_iii[x] + "  iiiiiiii: " + debug_table_iiiiiiii[x] + "  ii: " + debug_table_ii[x] + "  iiiiiiiiii: " + debug_table_iiiiiiiiii[x] + "  i: " + debug_table_i[x] + "  iiiiiiiiiiiiiiiii: " + debug_table_iiiiiiiiiiiiiiiii[x] + "  viiii: " + debug_table_viiii[x] + "  viii: " + debug_table_viii[x] + "  viiiii: " + debug_table_viiiii[x] + "  iiijiii: " + debug_table_iiijiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  iij: " + debug_table_iij[x] + "  vii: " + debug_table_vii[x] + "  viiiiiii: " + debug_table_viiiiiii[x] + "  iiiijj: " + debug_table_iiiijj[x] + "  ji: " + debug_table_ji[x] + "  vi: " + debug_table_vi[x] + "  vid: " + debug_table_vid[x] + "  vijj: " + debug_table_vijj[x] + "  dd: " + debug_table_dd[x] + "  viiiiiiiiiii: " + debug_table_viiiiiiiiiii[x] + "  v: " + debug_table_v[x] + "  ");
      abort(x);
    }

    function nullFunc_iiiiiiiiii(x) {
      err("Invalid function pointer '" + x + "' called with signature 'iiiiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
      err("This pointer might make sense in another type signature: iiiii: " + debug_table_iiiii[x] + "  iiii: " + debug_table_iiii[x] + "  iiiiii: " + debug_table_iiiiii[x] + "  iii: " + debug_table_iii[x] + "  iiiiiiii: " + debug_table_iiiiiiii[x] + "  iiiiiiiii: " + debug_table_iiiiiiiii[x] + "  ii: " + debug_table_ii[x] + "  i: " + debug_table_i[x] + "  iiiiiiiiiiiiiiiii: " + debug_table_iiiiiiiiiiiiiiiii[x] + "  viiii: " + debug_table_viiii[x] + "  viii: " + debug_table_viii[x] + "  viiiii: " + debug_table_viiiii[x] + "  iiijiii: " + debug_table_iiijiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  iij: " + debug_table_iij[x] + "  vii: " + debug_table_vii[x] + "  viiiiiii: " + debug_table_viiiiiii[x] + "  iiiijj: " + debug_table_iiiijj[x] + "  vid: " + debug_table_vid[x] + "  ji: " + debug_table_ji[x] + "  vi: " + debug_table_vi[x] + "  vijj: " + debug_table_vijj[x] + "  dd: " + debug_table_dd[x] + "  viiiiiiiiiii: " + debug_table_viiiiiiiiiii[x] + "  v: " + debug_table_v[x] + "  ");
      abort(x);
    }

    function nullFunc_iiiiiiiiiiiiiiiii(x) {
      err("Invalid function pointer '" + x + "' called with signature 'iiiiiiiiiiiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
      err("This pointer might make sense in another type signature: iiiii: " + debug_table_iiiii[x] + "  iiii: " + debug_table_iiii[x] + "  iiiiii: " + debug_table_iiiiii[x] + "  iii: " + debug_table_iii[x] + "  iiiiiiii: " + debug_table_iiiiiiii[x] + "  iiiiiiiii: " + debug_table_iiiiiiiii[x] + "  iiiiiiiiii: " + debug_table_iiiiiiiiii[x] + "  ii: " + debug_table_ii[x] + "  i: " + debug_table_i[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  viii: " + debug_table_viii[x] + "  iiijiii: " + debug_table_iiijiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  iiiijj: " + debug_table_iiiijj[x] + "  viiiiiii: " + debug_table_viiiiiii[x] + "  iij: " + debug_table_iij[x] + "  vii: " + debug_table_vii[x] + "  vijj: " + debug_table_vijj[x] + "  vid: " + debug_table_vid[x] + "  ji: " + debug_table_ji[x] + "  vi: " + debug_table_vi[x] + "  viiiiiiiiiii: " + debug_table_viiiiiiiiiii[x] + "  dd: " + debug_table_dd[x] + "  v: " + debug_table_v[x] + "  ");
      abort(x);
    }

    function nullFunc_iiiijj(x) {
      err("Invalid function pointer '" + x + "' called with signature 'iiiijj'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
      err("This pointer might make sense in another type signature: iiii: " + debug_table_iiii[x] + "  iii: " + debug_table_iii[x] + "  ii: " + debug_table_ii[x] + "  i: " + debug_table_i[x] + "  iij: " + debug_table_iij[x] + "  iiiii: " + debug_table_iiiii[x] + "  viiii: " + debug_table_viiii[x] + "  viii: " + debug_table_viii[x] + "  vijj: " + debug_table_vijj[x] + "  vii: " + debug_table_vii[x] + "  iiiiii: " + debug_table_iiiiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  ji: " + debug_table_ji[x] + "  vi: " + debug_table_vi[x] + "  vid: " + debug_table_vid[x] + "  iiijiii: " + debug_table_iiijiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  dd: " + debug_table_dd[x] + "  iiiiiiii: " + debug_table_iiiiiiii[x] + "  viiiiiii: " + debug_table_viiiiiii[x] + "  v: " + debug_table_v[x] + "  iiiiiiiii: " + debug_table_iiiiiiiii[x] + "  iiiiiiiiii: " + debug_table_iiiiiiiiii[x] + "  viiiiiiiiiii: " + debug_table_viiiiiiiiiii[x] + "  iiiiiiiiiiiiiiiii: " + debug_table_iiiiiiiiiiiiiiiii[x] + "  ");
      abort(x);
    }

    function nullFunc_iiijiii(x) {
      err("Invalid function pointer '" + x + "' called with signature 'iiijiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
      err("This pointer might make sense in another type signature: iii: " + debug_table_iii[x] + "  ii: " + debug_table_ii[x] + "  i: " + debug_table_i[x] + "  iiii: " + debug_table_iiii[x] + "  iiiii: " + debug_table_iiiii[x] + "  iiiiii: " + debug_table_iiiiii[x] + "  iij: " + debug_table_iij[x] + "  viiii: " + debug_table_viiii[x] + "  ji: " + debug_table_ji[x] + "  viii: " + debug_table_viii[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  vii: " + debug_table_vii[x] + "  iiiijj: " + debug_table_iiiijj[x] + "  vijj: " + debug_table_vijj[x] + "  vi: " + debug_table_vi[x] + "  iiiiiiii: " + debug_table_iiiiiiii[x] + "  vid: " + debug_table_vid[x] + "  viiiiiii: " + debug_table_viiiiiii[x] + "  dd: " + debug_table_dd[x] + "  iiiiiiiii: " + debug_table_iiiiiiiii[x] + "  iiiiiiiiii: " + debug_table_iiiiiiiiii[x] + "  v: " + debug_table_v[x] + "  viiiiiiiiiii: " + debug_table_viiiiiiiiiii[x] + "  iiiiiiiiiiiiiiiii: " + debug_table_iiiiiiiiiiiiiiiii[x] + "  ");
      abort(x);
    }

    function nullFunc_iij(x) {
      err("Invalid function pointer '" + x + "' called with signature 'iij'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
      err("This pointer might make sense in another type signature: ii: " + debug_table_ii[x] + "  i: " + debug_table_i[x] + "  iii: " + debug_table_iii[x] + "  vii: " + debug_table_vii[x] + "  ji: " + debug_table_ji[x] + "  vi: " + debug_table_vi[x] + "  iiii: " + debug_table_iiii[x] + "  vijj: " + debug_table_vijj[x] + "  viii: " + debug_table_viii[x] + "  vid: " + debug_table_vid[x] + "  iiiii: " + debug_table_iiiii[x] + "  viiii: " + debug_table_viiii[x] + "  iiiijj: " + debug_table_iiiijj[x] + "  dd: " + debug_table_dd[x] + "  v: " + debug_table_v[x] + "  iiiiii: " + debug_table_iiiiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  iiijiii: " + debug_table_iiijiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  iiiiiiii: " + debug_table_iiiiiiii[x] + "  viiiiiii: " + debug_table_viiiiiii[x] + "  iiiiiiiii: " + debug_table_iiiiiiiii[x] + "  iiiiiiiiii: " + debug_table_iiiiiiiiii[x] + "  viiiiiiiiiii: " + debug_table_viiiiiiiiiii[x] + "  iiiiiiiiiiiiiiiii: " + debug_table_iiiiiiiiiiiiiiiii[x] + "  ");
      abort(x);
    }

    function nullFunc_ji(x) {
      err("Invalid function pointer '" + x + "' called with signature 'ji'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
      err("This pointer might make sense in another type signature: i: " + debug_table_i[x] + "  ii: " + debug_table_ii[x] + "  vi: " + debug_table_vi[x] + "  iii: " + debug_table_iii[x] + "  iij: " + debug_table_iij[x] + "  vid: " + debug_table_vid[x] + "  vii: " + debug_table_vii[x] + "  v: " + debug_table_v[x] + "  dd: " + debug_table_dd[x] + "  iiii: " + debug_table_iiii[x] + "  viii: " + debug_table_viii[x] + "  vijj: " + debug_table_vijj[x] + "  iiiii: " + debug_table_iiiii[x] + "  viiii: " + debug_table_viiii[x] + "  iiiiii: " + debug_table_iiiiii[x] + "  iiiijj: " + debug_table_iiiijj[x] + "  viiiii: " + debug_table_viiiii[x] + "  iiijiii: " + debug_table_iiijiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  iiiiiiii: " + debug_table_iiiiiiii[x] + "  viiiiiii: " + debug_table_viiiiiii[x] + "  iiiiiiiii: " + debug_table_iiiiiiiii[x] + "  iiiiiiiiii: " + debug_table_iiiiiiiiii[x] + "  viiiiiiiiiii: " + debug_table_viiiiiiiiiii[x] + "  iiiiiiiiiiiiiiiii: " + debug_table_iiiiiiiiiiiiiiiii[x] + "  ");
      abort(x);
    }

    function nullFunc_v(x) {
      err("Invalid function pointer '" + x + "' called with signature 'v'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
      err("This pointer might make sense in another type signature: vi: " + debug_table_vi[x] + "  vid: " + debug_table_vid[x] + "  vii: " + debug_table_vii[x] + "  viii: " + debug_table_viii[x] + "  vijj: " + debug_table_vijj[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  viiiiiii: " + debug_table_viiiiiii[x] + "  viiiiiiiiiii: " + debug_table_viiiiiiiiiii[x] + "  i: " + debug_table_i[x] + "  dd: " + debug_table_dd[x] + "  ii: " + debug_table_ii[x] + "  ji: " + debug_table_ji[x] + "  iii: " + debug_table_iii[x] + "  iij: " + debug_table_iij[x] + "  iiii: " + debug_table_iiii[x] + "  iiiii: " + debug_table_iiiii[x] + "  iiiiii: " + debug_table_iiiiii[x] + "  iiiijj: " + debug_table_iiiijj[x] + "  iiijiii: " + debug_table_iiijiii[x] + "  iiiiiiii: " + debug_table_iiiiiiii[x] + "  iiiiiiiii: " + debug_table_iiiiiiiii[x] + "  iiiiiiiiii: " + debug_table_iiiiiiiiii[x] + "  iiiiiiiiiiiiiiiii: " + debug_table_iiiiiiiiiiiiiiiii[x] + "  ");
      abort(x);
    }

    function nullFunc_vi(x) {
      err("Invalid function pointer '" + x + "' called with signature 'vi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
      err("This pointer might make sense in another type signature: v: " + debug_table_v[x] + "  vid: " + debug_table_vid[x] + "  vii: " + debug_table_vii[x] + "  viii: " + debug_table_viii[x] + "  vijj: " + debug_table_vijj[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  viiiiiii: " + debug_table_viiiiiii[x] + "  viiiiiiiiiii: " + debug_table_viiiiiiiiiii[x] + "  i: " + debug_table_i[x] + "  ii: " + debug_table_ii[x] + "  ji: " + debug_table_ji[x] + "  iii: " + debug_table_iii[x] + "  iij: " + debug_table_iij[x] + "  dd: " + debug_table_dd[x] + "  iiii: " + debug_table_iiii[x] + "  iiiii: " + debug_table_iiiii[x] + "  iiiiii: " + debug_table_iiiiii[x] + "  iiiijj: " + debug_table_iiiijj[x] + "  iiijiii: " + debug_table_iiijiii[x] + "  iiiiiiii: " + debug_table_iiiiiiii[x] + "  iiiiiiiii: " + debug_table_iiiiiiiii[x] + "  iiiiiiiiii: " + debug_table_iiiiiiiiii[x] + "  iiiiiiiiiiiiiiiii: " + debug_table_iiiiiiiiiiiiiiiii[x] + "  ");
      abort(x);
    }

    function nullFunc_vid(x) {
      err("Invalid function pointer '" + x + "' called with signature 'vid'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
      err("This pointer might make sense in another type signature: vi: " + debug_table_vi[x] + "  v: " + debug_table_v[x] + "  vii: " + debug_table_vii[x] + "  i: " + debug_table_i[x] + "  ii: " + debug_table_ii[x] + "  ji: " + debug_table_ji[x] + "  dd: " + debug_table_dd[x] + "  viii: " + debug_table_viii[x] + "  vijj: " + debug_table_vijj[x] + "  iii: " + debug_table_iii[x] + "  iij: " + debug_table_iij[x] + "  viiii: " + debug_table_viiii[x] + "  iiii: " + debug_table_iiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  iiiii: " + debug_table_iiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  iiiiii: " + debug_table_iiiiii[x] + "  iiiijj: " + debug_table_iiiijj[x] + "  iiijiii: " + debug_table_iiijiii[x] + "  viiiiiii: " + debug_table_viiiiiii[x] + "  iiiiiiii: " + debug_table_iiiiiiii[x] + "  iiiiiiiii: " + debug_table_iiiiiiiii[x] + "  iiiiiiiiii: " + debug_table_iiiiiiiiii[x] + "  viiiiiiiiiii: " + debug_table_viiiiiiiiiii[x] + "  iiiiiiiiiiiiiiiii: " + debug_table_iiiiiiiiiiiiiiiii[x] + "  ");
      abort(x);
    }

    function nullFunc_vii(x) {
      err("Invalid function pointer '" + x + "' called with signature 'vii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
      err("This pointer might make sense in another type signature: vi: " + debug_table_vi[x] + "  viii: " + debug_table_viii[x] + "  v: " + debug_table_v[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  viiiiiii: " + debug_table_viiiiiii[x] + "  viiiiiiiiiii: " + debug_table_viiiiiiiiiii[x] + "  ii: " + debug_table_ii[x] + "  iii: " + debug_table_iii[x] + "  vid: " + debug_table_vid[x] + "  iij: " + debug_table_iij[x] + "  i: " + debug_table_i[x] + "  ji: " + debug_table_ji[x] + "  iiii: " + debug_table_iiii[x] + "  vijj: " + debug_table_vijj[x] + "  iiiii: " + debug_table_iiiii[x] + "  dd: " + debug_table_dd[x] + "  iiiiii: " + debug_table_iiiiii[x] + "  iiiijj: " + debug_table_iiiijj[x] + "  iiijiii: " + debug_table_iiijiii[x] + "  iiiiiiii: " + debug_table_iiiiiiii[x] + "  iiiiiiiii: " + debug_table_iiiiiiiii[x] + "  iiiiiiiiii: " + debug_table_iiiiiiiiii[x] + "  iiiiiiiiiiiiiiiii: " + debug_table_iiiiiiiiiiiiiiiii[x] + "  ");
      abort(x);
    }

    function nullFunc_viii(x) {
      err("Invalid function pointer '" + x + "' called with signature 'viii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
      err("This pointer might make sense in another type signature: vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  viiii: " + debug_table_viiii[x] + "  v: " + debug_table_v[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  viiiiiii: " + debug_table_viiiiiii[x] + "  viiiiiiiiiii: " + debug_table_viiiiiiiiiii[x] + "  iii: " + debug_table_iii[x] + "  ii: " + debug_table_ii[x] + "  iiii: " + debug_table_iiii[x] + "  vid: " + debug_table_vid[x] + "  iij: " + debug_table_iij[x] + "  ji: " + debug_table_ji[x] + "  vijj: " + debug_table_vijj[x] + "  iiiii: " + debug_table_iiiii[x] + "  i: " + debug_table_i[x] + "  iiiiii: " + debug_table_iiiiii[x] + "  iiiijj: " + debug_table_iiiijj[x] + "  dd: " + debug_table_dd[x] + "  iiijiii: " + debug_table_iiijiii[x] + "  iiiiiiii: " + debug_table_iiiiiiii[x] + "  iiiiiiiii: " + debug_table_iiiiiiiii[x] + "  iiiiiiiiii: " + debug_table_iiiiiiiiii[x] + "  iiiiiiiiiiiiiiiii: " + debug_table_iiiiiiiiiiiiiiiii[x] + "  ");
      abort(x);
    }

    function nullFunc_viiii(x) {
      err("Invalid function pointer '" + x + "' called with signature 'viiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
      err("This pointer might make sense in another type signature: viii: " + debug_table_viii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  v: " + debug_table_v[x] + "  viiiiiii: " + debug_table_viiiiiii[x] + "  viiiiiiiiiii: " + debug_table_viiiiiiiiiii[x] + "  iiii: " + debug_table_iiii[x] + "  iii: " + debug_table_iii[x] + "  ii: " + debug_table_ii[x] + "  iiiii: " + debug_table_iiiii[x] + "  vid: " + debug_table_vid[x] + "  iij: " + debug_table_iij[x] + "  ji: " + debug_table_ji[x] + "  vijj: " + debug_table_vijj[x] + "  iiiiii: " + debug_table_iiiiii[x] + "  iiiijj: " + debug_table_iiiijj[x] + "  i: " + debug_table_i[x] + "  iiijiii: " + debug_table_iiijiii[x] + "  dd: " + debug_table_dd[x] + "  iiiiiiii: " + debug_table_iiiiiiii[x] + "  iiiiiiiii: " + debug_table_iiiiiiiii[x] + "  iiiiiiiiii: " + debug_table_iiiiiiiiii[x] + "  iiiiiiiiiiiiiiiii: " + debug_table_iiiiiiiiiiiiiiiii[x] + "  ");
      abort(x);
    }

    function nullFunc_viiiii(x) {
      err("Invalid function pointer '" + x + "' called with signature 'viiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
      err("This pointer might make sense in another type signature: viii: " + debug_table_viii[x] + "  viiii: " + debug_table_viiii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  viiiiiii: " + debug_table_viiiiiii[x] + "  v: " + debug_table_v[x] + "  viiiiiiiiiii: " + debug_table_viiiiiiiiiii[x] + "  iiii: " + debug_table_iiii[x] + "  iiiii: " + debug_table_iiiii[x] + "  iii: " + debug_table_iii[x] + "  ii: " + debug_table_ii[x] + "  iiiiii: " + debug_table_iiiiii[x] + "  vid: " + debug_table_vid[x] + "  iij: " + debug_table_iij[x] + "  iiiijj: " + debug_table_iiiijj[x] + "  vijj: " + debug_table_vijj[x] + "  ji: " + debug_table_ji[x] + "  iiijiii: " + debug_table_iiijiii[x] + "  i: " + debug_table_i[x] + "  iiiiiiii: " + debug_table_iiiiiiii[x] + "  dd: " + debug_table_dd[x] + "  iiiiiiiii: " + debug_table_iiiiiiiii[x] + "  iiiiiiiiii: " + debug_table_iiiiiiiiii[x] + "  iiiiiiiiiiiiiiiii: " + debug_table_iiiiiiiiiiiiiiiii[x] + "  ");
      abort(x);
    }

    function nullFunc_viiiiii(x) {
      err("Invalid function pointer '" + x + "' called with signature 'viiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
      err("This pointer might make sense in another type signature: viii: " + debug_table_viii[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  viiiiiii: " + debug_table_viiiiiii[x] + "  v: " + debug_table_v[x] + "  viiiiiiiiiii: " + debug_table_viiiiiiiiiii[x] + "  iiii: " + debug_table_iiii[x] + "  iiiii: " + debug_table_iiiii[x] + "  iiiiii: " + debug_table_iiiiii[x] + "  iii: " + debug_table_iii[x] + "  ii: " + debug_table_ii[x] + "  iiijiii: " + debug_table_iiijiii[x] + "  vid: " + debug_table_vid[x] + "  iij: " + debug_table_iij[x] + "  iiiijj: " + debug_table_iiiijj[x] + "  vijj: " + debug_table_vijj[x] + "  ji: " + debug_table_ji[x] + "  iiiiiiii: " + debug_table_iiiiiiii[x] + "  i: " + debug_table_i[x] + "  dd: " + debug_table_dd[x] + "  iiiiiiiii: " + debug_table_iiiiiiiii[x] + "  iiiiiiiiii: " + debug_table_iiiiiiiiii[x] + "  iiiiiiiiiiiiiiiii: " + debug_table_iiiiiiiiiiiiiiiii[x] + "  ");
      abort(x);
    }

    function nullFunc_viiiiiii(x) {
      err("Invalid function pointer '" + x + "' called with signature 'viiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
      err("This pointer might make sense in another type signature: viii: " + debug_table_viii[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  vii: " + debug_table_vii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  vi: " + debug_table_vi[x] + "  v: " + debug_table_v[x] + "  viiiiiiiiiii: " + debug_table_viiiiiiiiiii[x] + "  iiii: " + debug_table_iiii[x] + "  iiiii: " + debug_table_iiiii[x] + "  iiiiii: " + debug_table_iiiiii[x] + "  iii: " + debug_table_iii[x] + "  ii: " + debug_table_ii[x] + "  iiijiii: " + debug_table_iiijiii[x] + "  vid: " + debug_table_vid[x] + "  iij: " + debug_table_iij[x] + "  iiiiiiii: " + debug_table_iiiiiiii[x] + "  iiiijj: " + debug_table_iiiijj[x] + "  vijj: " + debug_table_vijj[x] + "  ji: " + debug_table_ji[x] + "  iiiiiiiii: " + debug_table_iiiiiiiii[x] + "  dd: " + debug_table_dd[x] + "  i: " + debug_table_i[x] + "  iiiiiiiiii: " + debug_table_iiiiiiiiii[x] + "  iiiiiiiiiiiiiiiii: " + debug_table_iiiiiiiiiiiiiiiii[x] + "  ");
      abort(x);
    }

    function nullFunc_viiiiiiiiiii(x) {
      err("Invalid function pointer '" + x + "' called with signature 'viiiiiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
      err("This pointer might make sense in another type signature: viiii: " + debug_table_viiii[x] + "  viii: " + debug_table_viii[x] + "  viiiii: " + debug_table_viiiii[x] + "  vii: " + debug_table_vii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  viiiiiii: " + debug_table_viiiiiii[x] + "  vi: " + debug_table_vi[x] + "  v: " + debug_table_v[x] + "  iiiii: " + debug_table_iiiii[x] + "  iiii: " + debug_table_iiii[x] + "  iiiiii: " + debug_table_iiiiii[x] + "  iii: " + debug_table_iii[x] + "  iiiiiiii: " + debug_table_iiiiiiii[x] + "  iiijiii: " + debug_table_iiijiii[x] + "  vid: " + debug_table_vid[x] + "  iiiiiiiii: " + debug_table_iiiiiiiii[x] + "  iij: " + debug_table_iij[x] + "  iiiijj: " + debug_table_iiiijj[x] + "  vijj: " + debug_table_vijj[x] + "  ii: " + debug_table_ii[x] + "  iiiiiiiiii: " + debug_table_iiiiiiiiii[x] + "  ji: " + debug_table_ji[x] + "  dd: " + debug_table_dd[x] + "  i: " + debug_table_i[x] + "  iiiiiiiiiiiiiiiii: " + debug_table_iiiiiiiiiiiiiiiii[x] + "  ");
      abort(x);
    }

    function nullFunc_vijj(x) {
      err("Invalid function pointer '" + x + "' called with signature 'vijj'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
      err("This pointer might make sense in another type signature: vi: " + debug_table_vi[x] + "  v: " + debug_table_v[x] + "  iij: " + debug_table_iij[x] + "  vid: " + debug_table_vid[x] + "  vii: " + debug_table_vii[x] + "  ii: " + debug_table_ii[x] + "  ji: " + debug_table_ji[x] + "  viii: " + debug_table_viii[x] + "  i: " + debug_table_i[x] + "  iii: " + debug_table_iii[x] + "  viiii: " + debug_table_viiii[x] + "  iiii: " + debug_table_iiii[x] + "  iiiijj: " + debug_table_iiiijj[x] + "  dd: " + debug_table_dd[x] + "  viiiii: " + debug_table_viiiii[x] + "  iiiii: " + debug_table_iiiii[x] + "  iiiiii: " + debug_table_iiiiii[x] + "  iiijiii: " + debug_table_iiijiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  viiiiiii: " + debug_table_viiiiiii[x] + "  iiiiiiii: " + debug_table_iiiiiiii[x] + "  iiiiiiiii: " + debug_table_iiiiiiiii[x] + "  iiiiiiiiii: " + debug_table_iiiiiiiiii[x] + "  viiiiiiiiiii: " + debug_table_viiiiiiiiiii[x] + "  iiiiiiiiiiiiiiiii: " + debug_table_iiiiiiiiiiiiiiiii[x] + "  ");
      abort(x);
    }

    function invoke_dd(index, a1) {
      var sp = stackSave();

      try {
        return dynCall_dd(index, a1);
      } catch (e) {
        stackRestore(sp);
        if (e !== e + 0 && e !== 'longjmp') { throw e; }

        _setThrew(1, 0);
      }
    }

    function invoke_i(index) {
      var sp = stackSave();

      try {
        return dynCall_i(index);
      } catch (e) {
        stackRestore(sp);
        if (e !== e + 0 && e !== 'longjmp') { throw e; }

        _setThrew(1, 0);
      }
    }

    function invoke_ii(index, a1) {
      var sp = stackSave();

      try {
        return dynCall_ii(index, a1);
      } catch (e) {
        stackRestore(sp);
        if (e !== e + 0 && e !== 'longjmp') { throw e; }

        _setThrew(1, 0);
      }
    }

    function invoke_iii(index, a1, a2) {
      var sp = stackSave();

      try {
        return dynCall_iii(index, a1, a2);
      } catch (e) {
        stackRestore(sp);
        if (e !== e + 0 && e !== 'longjmp') { throw e; }

        _setThrew(1, 0);
      }
    }

    function invoke_iiiiiiii(index, a1, a2, a3, a4, a5, a6, a7) {
      var sp = stackSave();

      try {
        return dynCall_iiiiiiii(index, a1, a2, a3, a4, a5, a6, a7);
      } catch (e) {
        stackRestore(sp);
        if (e !== e + 0 && e !== 'longjmp') { throw e; }

        _setThrew(1, 0);
      }
    }

    function invoke_iiiijj(index, a1, a2, a3, a4, a5, a6, a7) {
      var sp = stackSave();

      try {
        return dynCall_iiiijj(index, a1, a2, a3, a4, a5, a6, a7);
      } catch (e) {
        stackRestore(sp);
        if (e !== e + 0 && e !== 'longjmp') { throw e; }

        _setThrew(1, 0);
      }
    }

    function invoke_vi(index, a1) {
      var sp = stackSave();

      try {
        dynCall_vi(index, a1);
      } catch (e) {
        stackRestore(sp);
        if (e !== e + 0 && e !== 'longjmp') { throw e; }

        _setThrew(1, 0);
      }
    }

    function invoke_vid(index, a1, a2) {
      var sp = stackSave();

      try {
        dynCall_vid(index, a1, a2);
      } catch (e) {
        stackRestore(sp);
        if (e !== e + 0 && e !== 'longjmp') { throw e; }

        _setThrew(1, 0);
      }
    }

    function invoke_vii(index, a1, a2) {
      var sp = stackSave();

      try {
        dynCall_vii(index, a1, a2);
      } catch (e) {
        stackRestore(sp);
        if (e !== e + 0 && e !== 'longjmp') { throw e; }

        _setThrew(1, 0);
      }
    }

    function invoke_viii(index, a1, a2, a3) {
      var sp = stackSave();

      try {
        dynCall_viii(index, a1, a2, a3);
      } catch (e) {
        stackRestore(sp);
        if (e !== e + 0 && e !== 'longjmp') { throw e; }

        _setThrew(1, 0);
      }
    }

    function invoke_viiii(index, a1, a2, a3, a4) {
      var sp = stackSave();

      try {
        dynCall_viiii(index, a1, a2, a3, a4);
      } catch (e) {
        stackRestore(sp);
        if (e !== e + 0 && e !== 'longjmp') { throw e; }

        _setThrew(1, 0);
      }
    }

    var asmGlobalArg = {};
    var asmLibraryArg = {
      "abort": abort,
      "setTempRet0": setTempRet0,
      "getTempRet0": getTempRet0,
      "abortStackOverflow": abortStackOverflow,
      "nullFunc_dd": nullFunc_dd,
      "nullFunc_i": nullFunc_i,
      "nullFunc_ii": nullFunc_ii,
      "nullFunc_iii": nullFunc_iii,
      "nullFunc_iiii": nullFunc_iiii,
      "nullFunc_iiiii": nullFunc_iiiii,
      "nullFunc_iiiiii": nullFunc_iiiiii,
      "nullFunc_iiiiiiii": nullFunc_iiiiiiii,
      "nullFunc_iiiiiiiii": nullFunc_iiiiiiiii,
      "nullFunc_iiiiiiiiii": nullFunc_iiiiiiiiii,
      "nullFunc_iiiiiiiiiiiiiiiii": nullFunc_iiiiiiiiiiiiiiiii,
      "nullFunc_iiiijj": nullFunc_iiiijj,
      "nullFunc_iiijiii": nullFunc_iiijiii,
      "nullFunc_iij": nullFunc_iij,
      "nullFunc_ji": nullFunc_ji,
      "nullFunc_v": nullFunc_v,
      "nullFunc_vi": nullFunc_vi,
      "nullFunc_vid": nullFunc_vid,
      "nullFunc_vii": nullFunc_vii,
      "nullFunc_viii": nullFunc_viii,
      "nullFunc_viiii": nullFunc_viiii,
      "nullFunc_viiiii": nullFunc_viiiii,
      "nullFunc_viiiiii": nullFunc_viiiiii,
      "nullFunc_viiiiiii": nullFunc_viiiiiii,
      "nullFunc_viiiiiiiiiii": nullFunc_viiiiiiiiiii,
      "nullFunc_vijj": nullFunc_vijj,
      "invoke_dd": invoke_dd,
      "invoke_i": invoke_i,
      "invoke_ii": invoke_ii,
      "invoke_iii": invoke_iii,
      "invoke_iiiiiiii": invoke_iiiiiiii,
      "invoke_iiiijj": invoke_iiiijj,
      "invoke_vi": invoke_vi,
      "invoke_vid": invoke_vid,
      "invoke_vii": invoke_vii,
      "invoke_viii": invoke_viii,
      "invoke_viiii": invoke_viiii,
      "ClassHandle": ClassHandle,
      "ClassHandle_clone": ClassHandle_clone,
      "ClassHandle_delete": ClassHandle_delete,
      "ClassHandle_deleteLater": ClassHandle_deleteLater,
      "ClassHandle_isAliasOf": ClassHandle_isAliasOf,
      "ClassHandle_isDeleted": ClassHandle_isDeleted,
      "RegisteredClass": RegisteredClass,
      "RegisteredPointer": RegisteredPointer,
      "RegisteredPointer_deleteObject": RegisteredPointer_deleteObject,
      "RegisteredPointer_destructor": RegisteredPointer_destructor,
      "RegisteredPointer_fromWireType": RegisteredPointer_fromWireType,
      "RegisteredPointer_getPointee": RegisteredPointer_getPointee,
      "__ZSt18uncaught_exceptionv": __ZSt18uncaught_exceptionv,
      "___assert_fail": ___assert_fail,
      "___cxa_allocate_exception": ___cxa_allocate_exception,
      "___cxa_begin_catch": ___cxa_begin_catch,
      "___cxa_find_matching_catch": ___cxa_find_matching_catch,
      "___cxa_free_exception": ___cxa_free_exception,
      "___cxa_pure_virtual": ___cxa_pure_virtual,
      "___cxa_throw": ___cxa_throw,
      "___gxx_personality_v0": ___gxx_personality_v0,
      "___lock": ___lock,
      "___resumeException": ___resumeException,
      "___setErrNo": ___setErrNo,
      "___syscall140": ___syscall140,
      "___syscall145": ___syscall145,
      "___syscall146": ___syscall146,
      "___syscall221": ___syscall221,
      "___syscall5": ___syscall5,
      "___syscall54": ___syscall54,
      "___syscall6": ___syscall6,
      "___unlock": ___unlock,
      "__embind_register_bool": __embind_register_bool,
      "__embind_register_class": __embind_register_class,
      "__embind_register_class_constructor": __embind_register_class_constructor,
      "__embind_register_class_function": __embind_register_class_function,
      "__embind_register_emval": __embind_register_emval,
      "__embind_register_float": __embind_register_float,
      "__embind_register_integer": __embind_register_integer,
      "__embind_register_memory_view": __embind_register_memory_view,
      "__embind_register_std_string": __embind_register_std_string,
      "__embind_register_std_wstring": __embind_register_std_wstring,
      "__embind_register_void": __embind_register_void,
      "__emval_call": __emval_call,
      "__emval_decref": __emval_decref,
      "__emval_incref": __emval_incref,
      "__emval_lookupTypes": __emval_lookupTypes,
      "__emval_register": __emval_register,
      "__emval_take_value": __emval_take_value,
      "_abort": _abort,
      "_embind_repr": _embind_repr,
      "_emscripten_get_heap_size": _emscripten_get_heap_size,
      "_emscripten_memcpy_big": _emscripten_memcpy_big,
      "_emscripten_resize_heap": _emscripten_resize_heap,
      "_gettimeofday": _gettimeofday,
      "_llvm_log10_f32": _llvm_log10_f32,
      "_llvm_log10_f64": _llvm_log10_f64,
      "_llvm_trap": _llvm_trap,
      "_longjmp": _longjmp,
      "_pthread_cond_destroy": _pthread_cond_destroy,
      "_pthread_cond_init": _pthread_cond_init,
      "_pthread_cond_signal": _pthread_cond_signal,
      "_pthread_cond_wait": _pthread_cond_wait,
      "_pthread_create": _pthread_create,
      "_pthread_join": _pthread_join,
      "_time": _time,
      "abortOnCannotGrowMemory": abortOnCannotGrowMemory,
      "constNoSmartPtrRawPointerToWireType": constNoSmartPtrRawPointerToWireType,
      "count_emval_handles": count_emval_handles,
      "craftInvokerFunction": craftInvokerFunction,
      "createNamedFunction": createNamedFunction,
      "downcastPointer": downcastPointer,
      "embind__requireFunction": embind__requireFunction,
      "embind_init_charCodes": embind_init_charCodes,
      "emscripten_realloc_buffer": emscripten_realloc_buffer,
      "ensureOverloadTable": ensureOverloadTable,
      "exposePublicSymbol": exposePublicSymbol,
      "extendError": extendError,
      "floatReadValueFromPointer": floatReadValueFromPointer,
      "flushPendingDeletes": flushPendingDeletes,
      "flush_NO_FILESYSTEM": flush_NO_FILESYSTEM,
      "genericPointerToWireType": genericPointerToWireType,
      "getBasestPointer": getBasestPointer,
      "getInheritedInstance": getInheritedInstance,
      "getInheritedInstanceCount": getInheritedInstanceCount,
      "getLiveInheritedInstances": getLiveInheritedInstances,
      "getShiftFromSize": getShiftFromSize,
      "getTypeName": getTypeName,
      "get_first_emval": get_first_emval,
      "heap32VectorToArray": heap32VectorToArray,
      "init_ClassHandle": init_ClassHandle,
      "init_RegisteredPointer": init_RegisteredPointer,
      "init_embind": init_embind,
      "init_emval": init_emval,
      "integerReadValueFromPointer": integerReadValueFromPointer,
      "makeClassHandle": makeClassHandle,
      "makeLegalFunctionName": makeLegalFunctionName,
      "new_": new_,
      "nonConstNoSmartPtrRawPointerToWireType": nonConstNoSmartPtrRawPointerToWireType,
      "readLatin1String": readLatin1String,
      "registerType": registerType,
      "replacePublicSymbol": replacePublicSymbol,
      "requireHandle": requireHandle,
      "requireRegisteredType": requireRegisteredType,
      "runDestructor": runDestructor,
      "runDestructors": runDestructors,
      "setDelayFunction": setDelayFunction,
      "shallowCopyInternalPointer": shallowCopyInternalPointer,
      "simpleReadValueFromPointer": simpleReadValueFromPointer,
      "throwBindingError": throwBindingError,
      "throwInstanceAlreadyDeleted": throwInstanceAlreadyDeleted,
      "throwInternalError": throwInternalError,
      "throwUnboundTypeError": throwUnboundTypeError,
      "upcastPointer": upcastPointer,
      "whenDependentTypesAreResolved": whenDependentTypesAreResolved,
      "tempDoublePtr": tempDoublePtr,
      "DYNAMICTOP_PTR": DYNAMICTOP_PTR // EMSCRIPTEN_START_ASM

    };
    var asm = Module["asm"] // EMSCRIPTEN_END_ASM
    (asmGlobalArg, asmLibraryArg, buffer);
    var real____cxa_can_catch = asm["___cxa_can_catch"];

    asm["___cxa_can_catch"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return real____cxa_can_catch.apply(null, arguments);
    };

    var real____cxa_is_pointer_type = asm["___cxa_is_pointer_type"];

    asm["___cxa_is_pointer_type"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return real____cxa_is_pointer_type.apply(null, arguments);
    };

    var real____getTypeName = asm["___getTypeName"];

    asm["___getTypeName"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return real____getTypeName.apply(null, arguments);
    };

    var real__free = asm["_free"];

    asm["_free"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return real__free.apply(null, arguments);
    };

    var real__llvm_round_f64 = asm["_llvm_round_f64"];

    asm["_llvm_round_f64"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return real__llvm_round_f64.apply(null, arguments);
    };

    var real__malloc = asm["_malloc"];

    asm["_malloc"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return real__malloc.apply(null, arguments);
    };

    var real__memmove = asm["_memmove"];

    asm["_memmove"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return real__memmove.apply(null, arguments);
    };

    var real__realloc = asm["_realloc"];

    asm["_realloc"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return real__realloc.apply(null, arguments);
    };

    var real__saveSetjmp = asm["_saveSetjmp"];

    asm["_saveSetjmp"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return real__saveSetjmp.apply(null, arguments);
    };

    var real__sbrk = asm["_sbrk"];

    asm["_sbrk"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return real__sbrk.apply(null, arguments);
    };

    var real__setThrew = asm["_setThrew"];

    asm["_setThrew"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return real__setThrew.apply(null, arguments);
    };

    var real__testSetjmp = asm["_testSetjmp"];

    asm["_testSetjmp"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return real__testSetjmp.apply(null, arguments);
    };

    var real_establishStackSpace = asm["establishStackSpace"];

    asm["establishStackSpace"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return real_establishStackSpace.apply(null, arguments);
    };

    var real_globalCtors = asm["globalCtors"];

    asm["globalCtors"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return real_globalCtors.apply(null, arguments);
    };

    var real_stackAlloc = asm["stackAlloc"];

    asm["stackAlloc"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return real_stackAlloc.apply(null, arguments);
    };

    var real_stackRestore = asm["stackRestore"];

    asm["stackRestore"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return real_stackRestore.apply(null, arguments);
    };

    var real_stackSave = asm["stackSave"];

    asm["stackSave"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return real_stackSave.apply(null, arguments);
    };

    Module["asm"] = asm;

    var ___cxa_can_catch = Module["___cxa_can_catch"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["___cxa_can_catch"].apply(null, arguments);
    };

    var ___cxa_is_pointer_type = Module["___cxa_is_pointer_type"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["___cxa_is_pointer_type"].apply(null, arguments);
    };

    var ___getTypeName = Module["___getTypeName"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["___getTypeName"].apply(null, arguments);
    };

    var _emscripten_replace_memory = Module["_emscripten_replace_memory"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["_emscripten_replace_memory"].apply(null, arguments);
    };

    var _free = Module["_free"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["_free"].apply(null, arguments);
    };

    var _llvm_round_f64 = Module["_llvm_round_f64"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["_llvm_round_f64"].apply(null, arguments);
    };

    var _malloc = Module["_malloc"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["_malloc"].apply(null, arguments);
    };

    var _memcpy = Module["_memcpy"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["_memcpy"].apply(null, arguments);
    };

    var _memmove = Module["_memmove"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["_memmove"].apply(null, arguments);
    };

    var _memset = Module["_memset"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["_memset"].apply(null, arguments);
    };

    var _realloc = Module["_realloc"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["_realloc"].apply(null, arguments);
    };

    var _saveSetjmp = Module["_saveSetjmp"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["_saveSetjmp"].apply(null, arguments);
    };

    var _sbrk = Module["_sbrk"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["_sbrk"].apply(null, arguments);
    };

    var _setThrew = Module["_setThrew"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["_setThrew"].apply(null, arguments);
    };

    var _testSetjmp = Module["_testSetjmp"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["_testSetjmp"].apply(null, arguments);
    };

    var establishStackSpace = Module["establishStackSpace"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["establishStackSpace"].apply(null, arguments);
    };

    var globalCtors = Module["globalCtors"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["globalCtors"].apply(null, arguments);
    };

    var stackAlloc = Module["stackAlloc"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["stackAlloc"].apply(null, arguments);
    };

    var stackRestore = Module["stackRestore"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["stackRestore"].apply(null, arguments);
    };

    var stackSave = Module["stackSave"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["stackSave"].apply(null, arguments);
    };

    var dynCall_dd = Module["dynCall_dd"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["dynCall_dd"].apply(null, arguments);
    };

    var dynCall_i = Module["dynCall_i"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["dynCall_i"].apply(null, arguments);
    };

    var dynCall_ii = Module["dynCall_ii"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["dynCall_ii"].apply(null, arguments);
    };

    var dynCall_iii = Module["dynCall_iii"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["dynCall_iii"].apply(null, arguments);
    };

    var dynCall_iiii = Module["dynCall_iiii"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["dynCall_iiii"].apply(null, arguments);
    };

    var dynCall_iiiii = Module["dynCall_iiiii"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["dynCall_iiiii"].apply(null, arguments);
    };

    var dynCall_iiiiii = Module["dynCall_iiiiii"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["dynCall_iiiiii"].apply(null, arguments);
    };

    var dynCall_iiiiiiii = Module["dynCall_iiiiiiii"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["dynCall_iiiiiiii"].apply(null, arguments);
    };

    var dynCall_iiiiiiiii = Module["dynCall_iiiiiiiii"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["dynCall_iiiiiiiii"].apply(null, arguments);
    };

    var dynCall_iiiiiiiiii = Module["dynCall_iiiiiiiiii"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["dynCall_iiiiiiiiii"].apply(null, arguments);
    };

    var dynCall_iiiiiiiiiiiiiiiii = Module["dynCall_iiiiiiiiiiiiiiiii"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["dynCall_iiiiiiiiiiiiiiiii"].apply(null, arguments);
    };

    var dynCall_iiiijj = Module["dynCall_iiiijj"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["dynCall_iiiijj"].apply(null, arguments);
    };

    var dynCall_iiijiii = Module["dynCall_iiijiii"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["dynCall_iiijiii"].apply(null, arguments);
    };

    var dynCall_iij = Module["dynCall_iij"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["dynCall_iij"].apply(null, arguments);
    };

    var dynCall_ji = Module["dynCall_ji"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["dynCall_ji"].apply(null, arguments);
    };

    var dynCall_v = Module["dynCall_v"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["dynCall_v"].apply(null, arguments);
    };

    var dynCall_vi = Module["dynCall_vi"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["dynCall_vi"].apply(null, arguments);
    };

    var dynCall_vid = Module["dynCall_vid"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["dynCall_vid"].apply(null, arguments);
    };

    var dynCall_vii = Module["dynCall_vii"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["dynCall_vii"].apply(null, arguments);
    };

    var dynCall_viii = Module["dynCall_viii"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["dynCall_viii"].apply(null, arguments);
    };

    var dynCall_viiii = Module["dynCall_viiii"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["dynCall_viiii"].apply(null, arguments);
    };

    var dynCall_viiiii = Module["dynCall_viiiii"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["dynCall_viiiii"].apply(null, arguments);
    };

    var dynCall_viiiiii = Module["dynCall_viiiiii"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["dynCall_viiiiii"].apply(null, arguments);
    };

    var dynCall_viiiiiii = Module["dynCall_viiiiiii"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["dynCall_viiiiiii"].apply(null, arguments);
    };

    var dynCall_viiiiiiiiiii = Module["dynCall_viiiiiiiiiii"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["dynCall_viiiiiiiiiii"].apply(null, arguments);
    };

    var dynCall_vijj = Module["dynCall_vijj"] = function () {
      assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
      assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
      return Module["asm"]["dynCall_vijj"].apply(null, arguments);
    };

    Module['asm'] = asm;
    if (!Module["intArrayFromString"]) { Module["intArrayFromString"] = function () {
      abort("'intArrayFromString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["intArrayToString"]) { Module["intArrayToString"] = function () {
      abort("'intArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["ccall"]) { Module["ccall"] = function () {
      abort("'ccall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["cwrap"]) { Module["cwrap"] = function () {
      abort("'cwrap' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["setValue"]) { Module["setValue"] = function () {
      abort("'setValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["getValue"]) { Module["getValue"] = function () {
      abort("'getValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["allocate"]) { Module["allocate"] = function () {
      abort("'allocate' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["getMemory"]) { Module["getMemory"] = function () {
      abort("'getMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
    }; }
    if (!Module["AsciiToString"]) { Module["AsciiToString"] = function () {
      abort("'AsciiToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["stringToAscii"]) { Module["stringToAscii"] = function () {
      abort("'stringToAscii' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["UTF8ArrayToString"]) { Module["UTF8ArrayToString"] = function () {
      abort("'UTF8ArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["UTF8ToString"]) { Module["UTF8ToString"] = function () {
      abort("'UTF8ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["stringToUTF8Array"]) { Module["stringToUTF8Array"] = function () {
      abort("'stringToUTF8Array' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["stringToUTF8"]) { Module["stringToUTF8"] = function () {
      abort("'stringToUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["lengthBytesUTF8"]) { Module["lengthBytesUTF8"] = function () {
      abort("'lengthBytesUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["UTF16ToString"]) { Module["UTF16ToString"] = function () {
      abort("'UTF16ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["stringToUTF16"]) { Module["stringToUTF16"] = function () {
      abort("'stringToUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["lengthBytesUTF16"]) { Module["lengthBytesUTF16"] = function () {
      abort("'lengthBytesUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["UTF32ToString"]) { Module["UTF32ToString"] = function () {
      abort("'UTF32ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["stringToUTF32"]) { Module["stringToUTF32"] = function () {
      abort("'stringToUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["lengthBytesUTF32"]) { Module["lengthBytesUTF32"] = function () {
      abort("'lengthBytesUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["allocateUTF8"]) { Module["allocateUTF8"] = function () {
      abort("'allocateUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["stackTrace"]) { Module["stackTrace"] = function () {
      abort("'stackTrace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["addOnPreRun"]) { Module["addOnPreRun"] = function () {
      abort("'addOnPreRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["addOnInit"]) { Module["addOnInit"] = function () {
      abort("'addOnInit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["addOnPreMain"]) { Module["addOnPreMain"] = function () {
      abort("'addOnPreMain' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["addOnExit"]) { Module["addOnExit"] = function () {
      abort("'addOnExit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["addOnPostRun"]) { Module["addOnPostRun"] = function () {
      abort("'addOnPostRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["writeStringToMemory"]) { Module["writeStringToMemory"] = function () {
      abort("'writeStringToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["writeArrayToMemory"]) { Module["writeArrayToMemory"] = function () {
      abort("'writeArrayToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["writeAsciiToMemory"]) { Module["writeAsciiToMemory"] = function () {
      abort("'writeAsciiToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["addRunDependency"]) { Module["addRunDependency"] = function () {
      abort("'addRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
    }; }
    if (!Module["removeRunDependency"]) { Module["removeRunDependency"] = function () {
      abort("'removeRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
    }; }
    if (!Module["ENV"]) { Module["ENV"] = function () {
      abort("'ENV' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["FS"]) { Module["FS"] = function () {
      abort("'FS' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["FS_createFolder"]) { Module["FS_createFolder"] = function () {
      abort("'FS_createFolder' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
    }; }
    if (!Module["FS_createPath"]) { Module["FS_createPath"] = function () {
      abort("'FS_createPath' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
    }; }
    if (!Module["FS_createDataFile"]) { Module["FS_createDataFile"] = function () {
      abort("'FS_createDataFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
    }; }
    if (!Module["FS_createPreloadedFile"]) { Module["FS_createPreloadedFile"] = function () {
      abort("'FS_createPreloadedFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
    }; }
    if (!Module["FS_createLazyFile"]) { Module["FS_createLazyFile"] = function () {
      abort("'FS_createLazyFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
    }; }
    if (!Module["FS_createLink"]) { Module["FS_createLink"] = function () {
      abort("'FS_createLink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
    }; }
    if (!Module["FS_createDevice"]) { Module["FS_createDevice"] = function () {
      abort("'FS_createDevice' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
    }; }
    if (!Module["FS_unlink"]) { Module["FS_unlink"] = function () {
      abort("'FS_unlink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
    }; }
    if (!Module["GL"]) { Module["GL"] = function () {
      abort("'GL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["dynamicAlloc"]) { Module["dynamicAlloc"] = function () {
      abort("'dynamicAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["warnOnce"]) { Module["warnOnce"] = function () {
      abort("'warnOnce' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["loadDynamicLibrary"]) { Module["loadDynamicLibrary"] = function () {
      abort("'loadDynamicLibrary' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["loadWebAssemblyModule"]) { Module["loadWebAssemblyModule"] = function () {
      abort("'loadWebAssemblyModule' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["getLEB"]) { Module["getLEB"] = function () {
      abort("'getLEB' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["getFunctionTables"]) { Module["getFunctionTables"] = function () {
      abort("'getFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["alignFunctionTables"]) { Module["alignFunctionTables"] = function () {
      abort("'alignFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["registerFunctions"]) { Module["registerFunctions"] = function () {
      abort("'registerFunctions' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["addFunction"]) { Module["addFunction"] = function () {
      abort("'addFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["removeFunction"]) { Module["removeFunction"] = function () {
      abort("'removeFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["getFuncWrapper"]) { Module["getFuncWrapper"] = function () {
      abort("'getFuncWrapper' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["prettyPrint"]) { Module["prettyPrint"] = function () {
      abort("'prettyPrint' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["makeBigInt"]) { Module["makeBigInt"] = function () {
      abort("'makeBigInt' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["dynCall"]) { Module["dynCall"] = function () {
      abort("'dynCall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["getCompilerSetting"]) { Module["getCompilerSetting"] = function () {
      abort("'getCompilerSetting' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["stackSave"]) { Module["stackSave"] = function () {
      abort("'stackSave' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["stackRestore"]) { Module["stackRestore"] = function () {
      abort("'stackRestore' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["stackAlloc"]) { Module["stackAlloc"] = function () {
      abort("'stackAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["establishStackSpace"]) { Module["establishStackSpace"] = function () {
      abort("'establishStackSpace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["print"]) { Module["print"] = function () {
      abort("'print' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["printErr"]) { Module["printErr"] = function () {
      abort("'printErr' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["getTempRet0"]) { Module["getTempRet0"] = function () {
      abort("'getTempRet0' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["setTempRet0"]) { Module["setTempRet0"] = function () {
      abort("'setTempRet0' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["Pointer_stringify"]) { Module["Pointer_stringify"] = function () {
      abort("'Pointer_stringify' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["writeStackCookie"]) { Module["writeStackCookie"] = function () {
      abort("'writeStackCookie' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["checkStackCookie"]) { Module["checkStackCookie"] = function () {
      abort("'checkStackCookie' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["abortStackOverflow"]) { Module["abortStackOverflow"] = function () {
      abort("'abortStackOverflow' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    }; }
    if (!Module["ALLOC_NORMAL"]) { Object.defineProperty(Module, "ALLOC_NORMAL", {
      get: function () {
        abort("'ALLOC_NORMAL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
      }
    }); }
    if (!Module["ALLOC_STACK"]) { Object.defineProperty(Module, "ALLOC_STACK", {
      get: function () {
        abort("'ALLOC_STACK' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
      }
    }); }
    if (!Module["ALLOC_DYNAMIC"]) { Object.defineProperty(Module, "ALLOC_DYNAMIC", {
      get: function () {
        abort("'ALLOC_DYNAMIC' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
      }
    }); }
    if (!Module["ALLOC_NONE"]) { Object.defineProperty(Module, "ALLOC_NONE", {
      get: function () {
        abort("'ALLOC_NONE' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
      }
    }); } // Modularize mode returns a function, which can be called to
    // create instances. The instances provide a then() method,
    // must like a Promise, that receives a callback. The callback
    // is called when the module is ready to run, with the module
    // as a parameter. (Like a Promise, it also returns the module
    // so you can use the output of .then(..)).

    Module['then'] = function (func) {
      // We may already be ready to run code at this time. if
      // so, just queue a call to the callback.
      if (Module['calledRun']) {
        func(Module);
      } else {
        // we are not ready to call then() yet. we must call it
        // at the same time we would call onRuntimeInitialized.
        var old = Module['onRuntimeInitialized'];

        Module['onRuntimeInitialized'] = function () {
          if (old) { old(); }
          func(Module);
        };
      }

      return Module;
    };
    /**
     * @constructor
     * @extends {Error}
     * @this {ExitStatus}
     */


    function ExitStatus(status) {
      this.name = "ExitStatus";
      this.message = "Program terminated with exit(" + status + ")";
      this.status = status;
    }
    ExitStatus.prototype = new Error();
    ExitStatus.prototype.constructor = ExitStatus;

    dependenciesFulfilled = function runCaller() {
      // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
      if (!Module['calledRun']) { run(); }
      if (!Module['calledRun']) { dependenciesFulfilled = runCaller; } // try this again later, after new deps are fulfilled
    };
    /** @type {function(Array=)} */


    function run(args) {
      args = args || Module['arguments'];

      if (runDependencies > 0) {
        return;
      }

      writeStackCookie();
      preRun();
      if (runDependencies > 0) { return; } // a preRun added a dependency, run will be called later

      if (Module['calledRun']) { return; } // run may have just been called through dependencies being fulfilled just in this very frame

      function doRun() {
        if (Module['calledRun']) { return; } // run may have just been called while the async setStatus time below was happening

        Module['calledRun'] = true;
        if (ABORT) { return; }
        ensureInitRuntime();
        preMain();
        if (Module['onRuntimeInitialized']) { Module['onRuntimeInitialized'](); }
        assert(!Module['_main'], 'compiled without a main, but one is present. if you added it from JS, use Module["onRuntimeInitialized"]');
        postRun();
      }

      if (Module['setStatus']) {
        Module['setStatus']('Running...');
        setTimeout(function () {
          setTimeout(function () {
            Module['setStatus']('');
          }, 1);
          doRun();
        }, 1);
      } else {
        doRun();
      }

      checkStackCookie();
    }

    Module['run'] = run;

    var abortDecorators = [];

    function abort(what) {
      if (Module['onAbort']) {
        Module['onAbort'](what);
      }

      if (what !== undefined) {
        out(what);
        err(what);
        what = JSON.stringify(what);
      } else {
        what = '';
      }

      ABORT = true;
      var extra = '';
      var output = 'abort(' + what + ') at ' + stackTrace() + extra;

      if (abortDecorators) {
        abortDecorators.forEach(function (decorator) {
          output = decorator(output, what);
        });
      }

      throw output;
    }

    Module['abort'] = abort;

    if (Module['preInit']) {
      if (typeof Module['preInit'] == 'function') { Module['preInit'] = [Module['preInit']]; }

      while (Module['preInit'].length > 0) {
        Module['preInit'].pop()();
      }
    }

    Module["noExitRuntime"] = true;
    run(); // {{MODULE_ADDITIONS}}

    return Module;
  };
}();

/**
 * Copyright 2019 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var defaultConfig = {
  width: 300,
  height: 150,
  timebaseNum: 1,
  timebaseDen: 30,
  bitrate: 200,
  realtime: false
};

var assign;
var init = function () {
  try {
    return Promise.resolve(nextMessage(parentPort, "message")).then(function (wasmPath) {
      return Promise.resolve(initWasmModule(Module, wasmPath)).then(function (module) {
        parentPort.postMessage("READY");
        return Promise.resolve(nextMessage(parentPort, "message")).then(function (userParams) {
          var params = Object.assign({}, defaultConfig, userParams);

          if (!('kLive' in params)) {
            params.kLive = params.realtime;
          }

          var instance = new module.WebmEncoder(params.timebaseNum, params.timebaseDen, params.width, params.height, params.bitrate, params.realtime, params.kLive, function (chunk) {
            var copy = new Uint8Array(chunk);
            parentPort.postMessage(copy.buffer, [copy.buffer]);
          });
          onMessage(parentPort, function (msg) {
            // A false-y message indicates the end-of-stream.
            if (!msg) {
              // This will invoke the callback to flush
              instance.finalize(); // Signal the end-of-stream

              parentPort.postMessage(null); // Free up the memory.

              instance.delete();
              return;
            }

            instance.addRGBAFrame(msg);
          });
        });
      });
    });
  } catch (e) {
    return Promise.reject(e);
  }
};
// On the web you can communicate with the main thread via `self`.
// In node land you need to get the `parentPort` from the `worker_threads`
// module.

var parentPort;

try {
  ((assign = require("worker_threads"), parentPort = assign.parentPort));
} catch (_) {
  parentPort = self;
} // On the web you get a `MessageEvent` which has the message payload on
// it’s `.data` property.
// In node land the event is the message payload itself.


function onMessage(target, f) {
  if ("on" in target) {
    return target.on("message", f);
  }

  return target.addEventListener("message", function (e) { return f(e.data); });
}

function nextMessage(target) {
  return new Promise(function (resolve) {
    if ("once" in target) {
      return target.once("message", resolve);
    }

    return target.addEventListener("message", function (e) { return resolve(e.data); }, {
      once: true
    });
  });
}

function initWasmModule(moduleFactory, wasmUrl) {
  return new Promise(function (resolve) {
    var module = moduleFactory({
      // Just to be safe, don't automatically invoke any wasm functions
      noInitialRun: true,

      locateFile: function locateFile(url) {
        if (url.endsWith(".wasm")) {
          return wasmUrl;
        }

        return url;
      },

      onRuntimeInitialized: function onRuntimeInitialized() {
        // An Emscripten is a then-able that resolves with itself, causing an infite loop when you
        // wrap it in a real promise. Delete the `then` prop solves this for now.
        // https://github.com/kripken/emscripten/issues/5820
        delete module.then;
        resolve(module);
      }

    });
  });
}
init();
//# sourceMappingURL=webm-worker.js.map
