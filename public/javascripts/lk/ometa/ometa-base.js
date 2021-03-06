/*
  Copyright (c) 2007, 2008 Alessandro Warth <awarth@cs.ucla.edu>

  Permission is hereby granted, free of charge, to any person
  obtaining a copy of this software and associated documentation
  files (the "Software"), to deal in the Software without
  restriction, including without limitation the rights to use,
  copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the
  Software is furnished to do so, subject to the following
  conditions:

  The above copyright notice and this permission notice shall be
  included in all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
  OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
  NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
  HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
  WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
  OTHER DEALINGS IN THE SOFTWARE.
*/

/*
  new syntax:
    #foo	match the string object 'foo' (should also be accepted in JS)
    'abc'	match the string object 'abc'
    'c'		match the string object 'c'
    ``abc''	match the sequence of string objects 'a', 'b', 'c'
    "abc"	token('abc')
    [1 2 3]	match the array object [1, 2, 3]
    foo(bar)	apply rule foo with argument bar
    -> ...	do semantic actions in JS (no more ST). allow multiple statements, but no declarations
		probably don't even need {}s, because newlines can terminate it!
*/

/*
// ometa M {
//   number = number:n digit:d -> { n * 10 + digitValue(d) }
//          | digit:d          -> { digitValue(d) }.
// }

try {
  M = Object.delegated(OMeta,{
    number: function() {
      var $elf = this
      return $elf._or(
        function() {
          var n, d
          n = $elf._apply("number")
          d = $elf._apply("digit")
          return n * 10 + digitValue(d)
        },
        function() {
          var d
          d = $elf._apply("digit")
          return digitValue(d)
        }
      )
    }
  })
  M.matchAll("123456789", "number")
} catch (f) { alert(f) }
*/

module('ometa/ometa-base.js').requires('ometa/lib.js').toRun(function() {

	this.log_ometa = false;	
	var log = function(string) { if(this.log_meta) console.log(string); };

// the failure exception

// fail = { toString: function() { return "match failed" } }
Global.fail = new Error('match failed');

// streams and memoization

Global.OMInputStream = function OMInputStream(hd, tl) {
  this.memo = { }
  this.hd   = hd
  this.tl   = tl
}
OMInputStream.prototype.head = function() { return this.hd }
OMInputStream.prototype.tail = function() { return this.tl }

Global.OMInputStreamEnd = function OMInputStreamEnd(idx) {
    this.memo = { }
    this.idx  = idx
}
OMInputStreamEnd.prototype.head = function() { throw fail }
OMInputStreamEnd.prototype.tail = function() { throw fail }

Array.prototype.toOMInputStream  = function() { return makeArrayOMInputStream(this, 0) }
String.prototype.toOMInputStream = Array.prototype.toOMInputStream

Global.makeArrayOMInputStream = function makeArrayOMInputStream(arr, idx) { return idx < arr.length ? new ArrayOMInputStream(arr, idx) : new OMInputStreamEnd(idx) }

Global.ArrayOMInputStream = function ArrayOMInputStream(arr, idx) {
  this.memo = { }
  this.arr  = arr
  this.idx  = idx
  this.hd   = arr[idx]
}
ArrayOMInputStream.prototype.head = function() { return this.hd }
ArrayOMInputStream.prototype.tail = function() {
  if (this.tl == undefined)
    this.tl = makeArrayOMInputStream(this.arr, this.idx + 1)
  return this.tl
}

Global.makeOMInputStreamProxy = function makeOMInputStreamProxy(target) {
  return Object.delegated(target,{
    memo:   { },
    target: target,
    tail:   function() { return makeOMInputStreamProxy(target.tail()) }
  })
}

// Failer (i.e., that which makes things fail) is used to detect (direct) left recursion and memoize failures

Global.Failer = function Failer() { }
Failer.prototype.used = false

Global.ChunkParser = {
  
  start: function(ometaParser, chunkStart, chunkEnd) {
    this.ometaParser = ometaParser;
    this.chunkStart = chunkStart;
    this.chunkEnd = chunkEnd;
    this.chunkEndFound = false;
    this.next = null;
    this.counter = 0;
    this.result = [];
    this.parseStart();
    // dbgOn(true);
    do { this.makeStep() } while (!this.parseRest());
    return this.result;
  },
  
  parseStart: function() {
    this.result.push(this.ometaParser._applyWithArgs('exactly', this.chunkStart));
  },
  
  makeStep: function() {
    this.next = this.ometaParser._apply("anything");
    this.result.push(this.next);
    this.nextNext = this.ometaParser.input.hd;
    return this.next;
  },

  backup: function() {
    this.backupRecorded = true;
    this.backupInput = this.ometaParser.input;
    this.backupNext = this.next;
    this.backupNextNext = this.nextNext;
    this.backupCounter = this.counter;
    this.backupResult = this.result;
  },
  
  useBackup: function() {
    if (!this.backupRecorded) throw dbgOn(new Error('Using Chunk parser backup but did not record it!'));
    this.ometaParser.input = this.backupInput;
    this.next = this.backupNext;
    this.nextNext = this.backupNextNext;
    this.counter = this.backupCounter;
    this.result = this.backupResult;
  },
  
  parseEscapedChar: function() {
    while (this.next === '\\') {
        this.makeStep();
        this.makeStep();
    }
  },

  parseComment: function() {
    if (this.next !== '/') return false;
    var comment1Opened = this.nextNext === '/';
    var comment2Opened = this.nextNext === '*'
    if (!comment1Opened && !comment2Opened) return;
    this.makeStep(); this.makeStep();
    while (true) { // this seems to crash Safari/Webkit, using do while below
      this.parseEscapedChar();
      if (comment1Opened && (this.next === '\n' || this.next === '\r')) return;
      if (comment2Opened && this.next === '*' && this.nextNext === '/' && this.makeStep()) return;
      this.makeStep();
    }
  },
  
  parseString: function() {
    var string1Opened;
    var string2Opened;
	if (this.chunkStart === '\'' || this.chunkStart === '"') return;
    if (this.next === '\'') string1Opened = true;
    if (this.next === '"') string2Opened = true;
    if (!string1Opened && !string2Opened) return;
    this.makeStep();
    while (true) { // this seems to crash Safari/Webkit
      this.parseEscapedChar()
      if (string1Opened && this.next === '\'') return;
      if (string2Opened && this.next === '"') return;
      this.makeStep();
    }
  },

  parseRegex: function() {
    var regexOpen = this.next === '/' && this.nextNext !== '*' && this.nextNext !== '/';
    if (!regexOpen) return;
    this.backup();
    this.makeStep();
    while (true) {
      this.parseEscapedChar();
      // Assume regex are on one line
      if (this.next === '\n' || this.next === '\r') {
        this.useBackup();
        return;
      }
      if (this.next === '/') return;
      this.makeStep();
    }
  },
  
  parseRest: function() {
    this.parseEscapedChar();
	this.parseRegex();
    this.parseString();
    this.parseComment();
    if (this.next === this.chunkEnd && this.counter === 0) // end
      return true;
    if (this.next === this.chunkEnd) { // end of another chunk
      this.counter--;
      return false;
    }
    if (this.next === this.chunkStart) // begin of another chunk
      this.counter++;
    return false;
  }
  
};

// the OMeta "class" and basic functionality
Global.OMeta = {
  _apply: function(rule) {
    dbgOn(this.shouldHalt);
    var memoRec = this.input.memo[rule]
    if (memoRec == undefined) {
      var origInput = this.input,
          failer    = new Failer()
      this.input.memo[rule] = failer
      this.input.memo[rule] = memoRec = {ans: this._applyRule(rule), nextInput: this.input}
      if (failer.used) {
        var sentinel = this.input
        while (true) {
          try {
            this.input = origInput
            var ans = this._applyRule(rule)
            if (this.input == sentinel)
              throw fail
            memoRec.ans       = ans
            memoRec.nextInput = this.input
          }
          catch (f) {
            if (f != fail)
              throw f
            break
          }
        }
      }
    }
    else if (memoRec instanceof Failer) {
      memoRec.used = true
      throw fail
    }
    this.input = memoRec.nextInput
    return memoRec.ans
  },

  // note: _applyWithArgs and _superApplyWithArgs are not memoized, so they can't be left-recursive
  _applyWithArgs: function(rule) {
    for (var idx = arguments.length - 1; idx > 0; idx--)
      this.input = new OMInputStream(arguments[idx], this.input)
    return this._applyRule(rule);
  },
  _applyRule: function(rule, optTarget) {
      if (this.prototype && this._ruleStack && this.prototype.hasOwnProperty(rule)) this._ruleStack.push(rule);
      if (!this[rule]) throw new Error('Grammer has no rule ' + rule);
      var target = optTarget || this;
      var result = this[rule].apply(target);
      if (this.prototype && this._ruleStack && this.prototype.hasOwnProperty(rule)) this._ruleStack.pop();
      return result;
  },
  _superApplyWithArgs: function($elf, rule) {
    for (var idx = arguments.length - 1; idx > 1; idx--)
      $elf.input = new OMInputStream(arguments[idx], $elf.input)
    return this._applyRule(rule, $elf);
  },
  _pred: function(b) {
    if (b)
      return true
    throw fail
  },
  _not: function(x) {
    var origInput = this.input
    try { x() }
    catch (f) {
      if (f != fail)
        throw f
      this.input = origInput
      return true
    }
    throw fail
  },
  _lookahead: function(x) {
    var origInput = this.input,
        r        = x()
    this.input = origInput
    return r
  },
  _or: function() {
    var origInput = this.input
    for (var idx = 0; idx < arguments.length; idx++)
      try { this.input = origInput; return arguments[idx]() }
      catch (f) {
        if (f != fail)
          throw f
      }
    throw fail
  },
  _many: function(x) {
    var ans = arguments[1] != undefined ? [arguments[1]] : []
    while (true) {
      var origInput = this.input
      try { ans.push(x()) }
      catch (f) {
        if (f != fail)
          throw f
        this.input = origInput
        break
      }
    }
    return ans
  },
  _many1: function(x) { return this._many(x, x()) },
  _form: function(x) {
    var v = this._apply("anything")
    if (!Object.isArray(v) && !Object.isString(v))
      throw fail
    var origInput = this.input
    this.input = makeArrayOMInputStream(v, 0)
    var r = x()
    this._apply("end")
    this.input = origInput
    return v
  },

  // some basic rules
  anything: function() {
    var r = this.input.head()
    this.input = this.input.tail()
    return r
  },
  end: function() {
    var $elf = this
    return this._not(function() { return $elf._apply("anything") })
  },
  pos: function() {
    return this.input.idx
  },
  empty: function() { return true },
  apply: function() {
    var r = this._apply("anything")
    return this._apply(r)
  },
  foreign: function() {
    var g   = this._apply("anything"),
        r   = this._apply("anything"),
        gi  = Object.delegated(g,{input: makeOMInputStreamProxy(this.input)})
    var ans = gi._apply(r)
    this.input = gi.input.target
    return ans
  },

  //  some useful "derived" rules
  exactly: function() {
    var wanted = this._apply("anything")
    if (wanted === this._apply("anything"))
      return wanted
    throw fail
  },
  "true": function() {
    var r = this._apply("anything")
    this._pred(r == true)
    return r
  },
  "false": function() {
    var r = this._apply("anything")
    this._pred(r == false)
    return r
  },
  "undefined": function() {
    var r = this._apply("anything")
    this._pred(r == undefined)
    return r
  },
  number: function() {
    var r = this._apply("anything")
    this._pred(isNumber(r))
    return r
  },
  string: function() {
    var r = this._apply("anything")
    this._pred(Object.isString(r))
    return r
  },
  "char": function() {
    var r = this._apply("anything")
    this._pred(isCharacter(r))
    return r
  },
  space: function() {
    var r = this._apply("char")
    this._pred(r.charCodeAt(0) <= 32)
    return r
  },
  spaces: function() {
    var $elf = this
    return this._many(function() { return $elf._apply("space") })
  },
  digit: function() {
    var r = this._apply("char")
    this._pred(isDigit(r))
    return r
  },
  lower: function() {
    var r = this._apply("char")
    this._pred(isLower(r))
    return r
  },
  upper: function() {
    var r = this._apply("char")
    this._pred(isUpper(r))
    return r
  },
  letter: function() {
    var $elf = this
    return this._or(function() { return $elf._apply("lower") },
                    function() { return $elf._apply("upper") })
  },
  letterOrDigit: function() {
    var $elf = this
    return this._or(function() { return $elf._apply("letter") },
                    function() { return $elf._apply("digit")  })
  },
  firstAndRest: function()  {
    var $elf  = this,
        first = this._apply("anything"),
        rest  = this._apply("anything")
     return this._many(function() { return $elf._apply(rest) }, this._apply(first))
  },
  seq: function() {
    var xs = this._apply("anything")
    for (var idx = 0; idx < xs.length; idx++)
      this._applyWithArgs("exactly", xs[idx])
    return xs
  },
  notLast: function() {
    var $elf = this,
        rule = this._apply("anything"),
        r    = this._apply(rule)
    this._lookahead(function() { return $elf._apply(rule) })
    return r
  },
  basicChunk: function() {
    var chunkStart = this._apply("anything"),
        chunkEnd   = this._apply("anything");
    if (!this.chunkParser)
      this.chunkParser = Object.delegated(ChunkParser, {});
    return this.chunkParser.start(this, chunkStart, chunkEnd);
    // var $elf       = this,
    //     chunkStart = this._apply("anything"),
    //     chunkEnd   = this._apply("anything"),
    //     r          = [],
    //     counter    = 0,
    //     next       = null,
    //     simpleCommentFound = false,
    //     longCommentFound = false,
    //     string1Opened = false,
    //     string2Opened = false;
    //     
    // r.push(this._applyWithArgs('exactly', chunkStart));
    // 
    // while (true) {
    //   
    //   next = this._apply("anything"); r.push(next);
    //           
    //   if (next === '\\') { // escaped char, ignore next input
    //     r.push(this._apply("anything"));
    //     continue;
    //   }
    //   
    //   if (next === '/') { // comment?
    //     next = this._apply("anything"); r.push(next);
    //     if (next === '/') { simpleCommentFound = true; continue};
    //     if (next === '*') { longCommentFound = true; continue };
    //   }
    //   
    //   if (simpleCommentFound && next === '\n') {simpleCommentFound = false; continue }; //comment end?
    //   if (longCommentFound && next === '*') {
    //     next = this._apply("anything"); r.push(next);        
    //     if (next === '/') { longCommentFound = false; continue };
    //   }
    //   
    //   if (simpleCommentFound || longCommentFound) continue;
    //   
    //   if (next === '\'') string1Opened = !string1Opened;
    //   if (next === '"') string2Opened = !string2Opened;
    //   if (string1Opened || string2Opened) continue;
    //         
    //   if (simpleCommentFound || longCommentFound) continue;
    // 
    //   if (next === '\'') string1Opened = !string1Opened;
    //   if (next === '"') string2Opened = !string2Opened;
    //   if (string1Opened || string2Opened) continue;
    //   
    //   if (next === chunkEnd && counter === 0) // end
    //     return r;
    //   if (next === chunkEnd) { // end of another chunk
    //     counter--;
    //     continue;
    //   }
    //   if (next === chunkStart)
    //     counter++;
    // }
  },
  
  initialize: function() { },
  // match and matchAll are a grammar's "public interface"
  _genericMatch: function(input, rule, args, matchFailed) {
    if (args == undefined)
      args = []
    var realArgs = [rule]
    for (var idx = 0; idx < args.length; idx++)
      realArgs.push(args[idx])
    var m = Object.delegated(this,{input: input, _ruleStack: [], _originalInput: input.arr});
    m.initialize()
    try {
		var result = realArgs.length == 1 ? m._apply.call(m, realArgs[0]) : m._applyWithArgs.apply(m, realArgs)
		if (m.input.arr)
			log('Not all input processed: ' + m.input.arr.toArray().slice(m.input.idx));
		return result;
	} catch (f) {
      if (f == fail && matchFailed != undefined) {
        var input = m.input
        if (input.idx != undefined) {
          while (input.tl != undefined && input.tl.idx != undefined)
            input = input.tl
          input.idx--
        }
        return matchFailed(m, input.idx)
      }
      throw f
    }
  },
  match: function(obj, rule, args, matchFailed) {
    return this._genericMatch([obj].toOMInputStream(),    rule, args, matchFailed)
  },
  matchAll: function(listyObj, rule, args, matchFailed) {
    return this._genericMatch(listyObj.toOMInputStream(), rule, args, matchFailed)
  }
}

});

