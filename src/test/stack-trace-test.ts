/* DO NOT CHANGE THIS FILE */
import sourceMapSupport from 'source-map-support';
sourceMapSupport.install();

(() => {
  stackTraceTestMain();
})();

function stackTraceTestMain() {
  throwsAnError();
}

function throwsAnError() {
  throw new Error('Stack Trace Test');
}
