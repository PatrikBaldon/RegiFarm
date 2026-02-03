// Polyfill per la variabile global in Electron renderer process
var global = (typeof window !== 'undefined') ? window : 
             (typeof global !== 'undefined') ? global : 
             (typeof self !== 'undefined') ? self : 
             {};

module.exports = global;

