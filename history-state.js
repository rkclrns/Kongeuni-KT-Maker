(() => {
const listeners=new Set(),cache=new WeakMap();
function observe(value){if(!value||typeof value!=='object')return value;if(cache.has(value))return cache.get(value);const proxy=new Proxy(value,{get(target,key){return observe(Reflect.get(target,key))},set(target,key,v){const prev=target[key];Reflect.set(target,key,v);if(prev!==v)listeners.forEach(fn=>fn());return true},deleteProperty(target,key){if(key in target){delete target[key];listeners.forEach(fn=>fn())}return true}});cache.set(value,proxy);return proxy}
window.createThemeState=observe;window.onThemeStateChange=fn=>{listeners.add(fn);return()=>listeners.delete(fn)};
})();
