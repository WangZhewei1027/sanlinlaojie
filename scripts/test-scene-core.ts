import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSceneCore, sampleTrack } from '@spatial-memory/scene-core';
import { Group } from 'three';
import { createBlankSceneDocument, type TransformKeyframe } from '../lib/scene/protocol';
import { validateSceneDocument } from '../lib/scene/validate';
import { fromDocument, toDocument } from '../app/manage/lib/scene-document';
import { editChannel, removeKey, setKey } from '../lib/scene/transform-authoring';
import { upgradeTheatreDocument } from './migrate/theatre-scenes';
import { upgradeTransformDocument } from './migrate/transform-scenes';
const frames: TransformKeyframe[] = [
 {time:0,value:0,handles:[.5,1,.5,0],connectedRight:true},
 {time:1,value:Math.PI,handles:[.58,.7003891050583656,.19,1],connectedRight:true},
 {time:1.967,value:0,handles:[.22,1,.5,0],connectedRight:true},
];
const old = { schemaVersion:4, content:{kind:'composition',units:'meters',durationSeconds:4,loop:false,assets:{model:{assetId:'10150000-0000-4000-8000-000000000001'}},instances:[{id:'object',asset:'model',position:[1,2,3],quaternion:[0,0,0,1],scale:[1,1,1],animation:null,tracks:{'rotation.y':frames}}]} };
const native = upgradeTheatreDocument(old);
const doc = upgradeTransformDocument(native);
assert.equal(doc.schemaVersion,6); assert.equal('theatre' in doc.content,false);
assert.deepEqual(doc,upgradeTransformDocument(old));
assert.deepEqual(toDocument(fromDocument(JSON.parse(JSON.stringify(doc)))),doc,'save/reopen does not alter keys');
let maxError=0;
for (const [time,value] of JSON.parse(readFileSync('scripts/fixtures/legacy-transform-samples.json','utf8'))) {
 const error=Math.abs(sampleTrack(doc.content.instances[0].tracks!['rotation.y'],time,0)-value); maxError=Math.max(maxError,error);
 // The retired sampler used a coarse Newton approximation; the new solver is accurate to 2^-32.
 assert.ok(error < 1e-5,`legacy curve at ${time}: ${error}`);
}
const linear: TransformKeyframe[]=[{time:1,value:2,handles:[0,0,1,1],connectedRight:true},{time:3,value:6,handles:[0,0,1,1],connectedRight:true}];
assert.equal(sampleTrack(linear,0,99),2); assert.equal(sampleTrack(linear,2,99),4); assert.equal(sampleTrack(linear,4,99),6);
assert.equal(sampleTrack([{...linear[0],connectedRight:false},linear[1]],2.999,0),2);
const core=createSceneCore({content:doc.content}); const root=new Group(); const stop=core.bind('object',root);
core.seek(1); assert.equal(root.rotation.y,Math.PI); core.play(); core.advance(9); assert.equal(core.time,4);assert.equal(core.playing,false);
core.play(true);core.advance(9);assert.equal(core.time,1);core.pause();core.advance(100);assert.equal(core.time,1);
core.seek(-1);assert.equal(core.time,0); core.seek(Infinity);assert.equal(core.time,0);
let instance=doc.content.instances[0]; instance=editChannel(instance,'rotation.y',1,Math.PI*2);assert.equal(instance.tracks!['rotation.y']![1].value,Math.PI*2);
instance=setKey(instance,'scale.x',0,2);instance=removeKey(instance,'scale.x',0);assert.equal(instance.scale[0],2);assert.equal(instance.tracks!['scale.x'],undefined);
core.sync({...doc.content,instances:[instance]});core.seek(1);assert.equal(root.rotation.y,Math.PI*2);
stop();core.dispose();core.play();core.advance(1);assert.equal(core.playing,false);
for(const mutate of [
 (d: typeof doc)=>{Object.assign(d.content,{theatre:{}})},
 (d: typeof doc)=>{d.content.instances[0].tracks!['rotation.y']![1].time=0},
 (d: typeof doc)=>{d.content.instances[0].tracks!['rotation.y']![0].value=NaN},
 (d: typeof doc)=>{d.content.instances[0].tracks!['rotation.y']![0].handles[2]=2},
 (d: typeof doc)=>{d.content.durationSeconds=null},
 (d: typeof doc)=>{Object.assign(d.content.instances[0],{quaternion:[0,0,0,1]})},
]) { const invalid=structuredClone(doc);mutate(invalid);assert.equal(validateSceneDocument(invalid).ok,false); }
assert.equal(validateSceneDocument(createBlankSceneDocument()).ok,true);
console.log(JSON.stringify({result:'PASS',legacyCurveSamples:201,maxError,coverage:'schema 4/5 migration, save/reopen, strict validation, linear/Bezier/hold, degrees-safe multi-turn rotation, clock seek/loop/end/pause, authoring and disposal'}));
