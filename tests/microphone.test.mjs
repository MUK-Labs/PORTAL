import test from 'node:test';
import assert from 'node:assert/strict';
import {LocalMicrophone,spectrumEnergy} from '../js/microphone.mjs';
function setup(getMedia) {
  const state={requests:0,contexts:[],stops:0,connections:[],ended:null};
  const track={stop(){state.stops++;},addEventListener(name,fn){if(name==='ended')state.ended=fn;}};
  const stream={getTracks:()=>[track]};
  class Context {
    constructor(){state.contexts.push(this);this.sampleRate=48000;this.closed=false;}
    resume(){return Promise.resolve();} close(){this.closed=true;return Promise.resolve();}
    createAnalyser(){const a={fftSize:2048,frequencyBinCount:1024,getFloatTimeDomainData(x){x.fill(.1);},getByteFrequencyData(x){x.fill(100);}};this.analyser=a;return a;}
    createMediaStreamSource(){return{connect:n=>state.connections.push(n),disconnect(){}};}
  }
  const env={isSecureContext:true,AudioContext:Context,navigator:{mediaDevices:{getUserMedia:async options=>{state.requests++;state.options=options;return getMedia?getMedia(stream):stream;}}}};
  return {mic:new LocalMicrophone(()=>{},env),state,stream,env};
}
test('microphone starts only after explicit start, never at construction',async()=>{const {mic,state}=setup();assert.equal(state.requests,0);assert.equal(mic.state,'off');assert.equal(await mic.start(),true);assert.equal(state.requests,1);assert.equal(state.options.video,false);assert.equal(mic.state,'live');assert.ok(mic.sample().level>0);assert.deepEqual(state.connections,[state.contexts[0].analyser]);mic.stop();assert.equal(state.stops,1);assert.equal(state.contexts[0].closed,true);assert.equal(mic.sample().level,0);mic.stop();assert.equal(state.stops,1);});
test('denial cleans up without an active microphone',async()=>{const {mic,state}=setup(()=>{throw Object.assign(new Error('denied'),{name:'NotAllowedError'});});assert.equal(await mic.start(),false);assert.equal(mic.state,'error');assert.equal(mic.session,null);assert.equal(state.contexts[0].closed,true);});
test('late permission after cancel is stopped immediately',async()=>{let resolve;const {mic,state,stream}=setup(()=>new Promise(r=>resolve=r));const pending=mic.start();assert.equal(mic.state,'requesting');mic.stop();resolve(stream);assert.equal(await pending,false);assert.equal(state.stops,1);assert.equal(state.connections.length,0);assert.equal(mic.state,'off');});
test('an old pending request cannot replace a newer live session',async()=>{let resolve;let i=0;const {mic,state,stream}=setup(s=>i++===0?new Promise(r=>resolve=r):s);const first=mic.start();mic.stop();assert.equal(await mic.start(),true);resolve(stream);assert.equal(await first,false);assert.equal(mic.state,'live');assert.equal(state.contexts[1].closed,false);mic.stop();});
test('device disconnection stops the session without automatically restarting',async()=>{const {mic,state}=setup();await mic.start();state.ended();assert.equal(mic.state,'off');assert.equal(state.requests,1);assert.equal(state.contexts[0].closed,true);});
test('unsupported/insecure contexts do not request access',async()=>{const {mic,state,env}=setup();env.isSecureContext=false;assert.equal(mic.supported,false);assert.equal(await mic.start(),false);assert.equal(state.requests,0);});
test('audio energy responds to sound, is bounded, and silence remains zero',()=>{const zero=spectrumEnergy(new Float32Array(2048),new Uint8Array(1024));assert.deepEqual(zero,{level:0,low:0,mid:0,high:0});const loud=spectrumEnergy(new Float32Array(2048).fill(.5),new Uint8Array(1024).fill(255));assert.equal(loud.level,1);assert.equal(loud.low,1);assert.equal(loud.mid,1);assert.equal(loud.high,1);});
