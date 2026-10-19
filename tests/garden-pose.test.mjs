import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../dashboard/garden-pose.js',import.meta.url),'utf8');
const {scenePose}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const base={x:0,z:0,heading:0,originX:1,originY:2,originZ:3,yawDegrees:0,metersPerUnit:1,visualScale:1};
test('ROS positive lateral displacement maps to scene negative Z',()=>assert.equal(scenePose({...base,z:2}).z,1));
test('positive yaw rotates forward displacement toward negative scene Z',()=>{
 const p=scenePose({...base,x:2,yawDegrees:90});assert.ok(Math.abs(p.x-1)<1e-12);assert.equal(p.z,1);assert.equal(p.yaw,90);
});
test('visual size does not alter metric displacement',()=>assert.deepEqual(scenePose({...base,x:2,metersPerUnit:2,visualScale:3}),{x:2,y:2,z:3,yaw:0,scale:3}));
test('invalid poses fail before engine mutation',()=>{
 for(const patch of [{originX:NaN},{visualScale:0},{metersPerUnit:Infinity}])assert.throws(()=>scenePose({...base,...patch}));
});

test('trajectory vertices share the robot transform and stay within rendering budget', async()=>{
 const {sceneTrajectory}=await import('../dashboard/garden-pose.js');
 const frames=[{time_s:0,x_m:10,y_m:20},{time_s:1,x_m:11,y_m:20},{time_s:2,x_m:11,y_m:21}];
 const vertices=sceneTrajectory(frames,{originX:1,originY:2,originZ:3,yawDegrees:90,metersPerUnit:1,visualScale:1});
 assert.equal(vertices.length,3);
 assert.ok(Math.abs(vertices[1].x-1)<1e-9);assert.equal(vertices[1].z,2);
 assert.ok(Math.abs(vertices[2].x)<1e-9);assert.equal(vertices[2].z,2);
 assert.ok(sceneTrajectory(Array.from({length:5000},(_,i)=>({time_s:i,x_m:i,y_m:0})),{originX:0,originY:0,originZ:0,yawDegrees:0,metersPerUnit:1,visualScale:1}).length<=1001);
});
