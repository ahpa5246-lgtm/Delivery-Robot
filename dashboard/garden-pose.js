/* ROS XY (right-handed Z-up) to PlayCanvas XZ (right-handed Y-up).
   ROS positive Y maps to scene negative Z; positive yaw remains positive Y. */
export function scenePose({x,z,heading,originX,originY,originZ,yawDegrees,metersPerUnit,visualScale}) {
 const values=[x,z,heading,originX,originY,originZ,yawDegrees,metersPerUnit,visualScale];
 if(!values.every(Number.isFinite)||metersPerUnit<.01||metersPerUnit>10||visualScale<.01||visualScale>5)
  throw new Error('Use finite coordinates, scale 0.01–5, and metres/unit 0.01–10');
 const a=yawDegrees*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
 return {x:originX+(x*c-z*s)/metersPerUnit,y:originY,
  z:originZ-(x*s+z*c)/metersPerUnit,yaw:yawDegrees+heading*180/Math.PI,scale:visualScale};
}

// Bounded engineering overlay; shares exactly the robot's metric-to-scene transform.
export function sceneTrajectory(frames, options) {
 const first=frames[0],step=Math.max(1,Math.ceil((frames.length-1)/1000)),points=[];
 for(let i=0;i<frames.length;i+=step){
  const f=frames[i];points.push({...scenePose({...options,x:f.x_m-first.x_m,z:f.y_m-first.y_m,heading:0}),time:f.time_s-first.time_s});
 }
 if((frames.length-1)%step!==0){const f=frames.at(-1);points.push({...scenePose({...options,x:f.x_m-first.x_m,z:f.y_m-first.y_m,heading:0}),time:f.time_s-first.time_s});}
 return points;
}
