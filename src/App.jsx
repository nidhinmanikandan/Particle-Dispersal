import React, { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// ---------------------------------------------------------------------------
// Standalone embed HTML generator
// ---------------------------------------------------------------------------
function generateEmbedHTML({ imageSrc, density, particleSize, depth, motion, includeTracking }) {
  // Escape backtick/backslash in base64 data URL so it can live inside a template literal
  const safeImage = imageSrc.replace(/\\/g, "\\\\").replace(/`/g, "\\`");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Particle Field Embed</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:100%;height:100%;background:#050606;overflow:hidden}
  canvas{display:block;width:100%!important;height:100%!important}
  ${includeTracking ? `
  #hud{position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:10}
  .trk-net{fill:none;stroke:rgba(151,205,194,.28);stroke-width:.7;vector-effect:non-scaling-stroke}
  .trk-brk{fill:none;stroke:rgba(195,231,223,.78);stroke-width:.8;vector-effect:non-scaling-stroke}
  .trk-lbl{fill:rgba(211,229,224,.62);font:7px monospace;letter-spacing:.04em}
  ` : ''}
</style>
</head>
<body>
${includeTracking ? `<svg id="hud" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path class="trk-net" id="tc-net"/>${Array.from({length:12},(_,i)=>`<g class="trk-g" id="tk${i}" style="display:none"><path class="trk-brk" d="M-8 -3V-8H-3 M3 -8H8V-3 M8 3V8H3 M-3 8H-8V3"/><text class="trk-lbl" id="tl${i}" x="11" y="-8"></text></g>`).join('')}</svg>` : ''}
<script type="importmap">
{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.168.0/build/three.module.js","three/examples/jsm/controls/OrbitControls.js":"https://cdn.jsdelivr.net/npm/three@0.168.0/examples/jsm/controls/OrbitControls.js"}}
<\/script>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const IMAGE_SRC = \`${safeImage}\`;
const DENSITY = ${density};
const PARTICLE_SIZE = ${particleSize};
const DEPTH = ${depth};
const MOTION = ${motion};
const MIN_PARTICLE_COUNT = 25000;
const MAX_PARTICLE_COUNT = 150000;
const MAX_SAMPLE_DIMENSION = 1024;
const IMAGE_FIT_FRACTION = 0.75;
const MAX_VISUAL_SCALE = 2;
const TRACK_MARKER_COUNT = 12;
const SHOW_HUD = ${includeTracking ? 'true' : 'false'};

function makeParticles(image, density, depth) {
  const detailCanvas = document.createElement('canvas');
  detailCanvas.width = 64; detailCanvas.height = 64;
  const dctx = detailCanvas.getContext('2d',{willReadFrequently:true});
  dctx.drawImage(image,0,0,64,64);
  const dp = dctx.getImageData(0,0,64,64).data;
  let edgePixels=0,opaquePixels=0;
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){const i=(y*64+x)*4;if(dp[i+3]<20)continue;opaquePixels++;const lum=(dp[i]*0.2126+dp[i+1]*0.7152+dp[i+2]*0.0722)/255;let diff=0;const right=x<63?i+4:-1,below=y<63?i+256:-1;for(const nb of[right,below]){if(nb<0)continue;const nl=(dp[nb]*0.2126+dp[nb+1]*0.7152+dp[nb+2]*0.0722)/255;diff=Math.max(diff,Math.abs(lum-nl),Math.abs(dp[i]-dp[nb])/255,Math.abs(dp[i+1]-dp[nb+1])/255,Math.abs(dp[i+2]-dp[nb+2])/255,Math.abs(dp[i+3]-dp[nb+3])/255);}if(diff>0.06)edgePixels++;}
  const detailScore=opaquePixels>0?Math.min(1,(edgePixels/opaquePixels)*4):0;
  const resFactor=THREE.MathUtils.clamp(Math.sqrt((image.naturalWidth*image.naturalHeight)/(512*512)),0.5,1.5);
  const adaptiveCount=Math.floor(density*resFactor*(0.75+detailScore*0.75));
  const particleCount=THREE.MathUtils.clamp(adaptiveCount,Math.min(MIN_PARTICLE_COUNT,density),Math.min(MAX_PARTICLE_COUNT,density));
  const canvas=document.createElement('canvas');
  const aspect=image.naturalWidth/image.naturalHeight;
  const sd=Math.min(MAX_SAMPLE_DIMENSION,Math.max(512,Math.ceil(Math.sqrt(particleCount*8))));
  const is=sd/Math.max(image.naturalWidth,image.naturalHeight);
  canvas.width=Math.max(1,Math.round(image.naturalWidth*is));
  canvas.height=Math.max(1,Math.round(image.naturalHeight*is));
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(image,0,0,canvas.width,canvas.height);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  const columns=Math.max(1,Math.floor(Math.sqrt(particleCount*aspect)));
  const rows=Math.max(1,Math.ceil(particleCount/columns));
  const positions=new Float32Array(particleCount*3);
  const colors=new Float32Array(particleCount*4);
  let count=0;
  const lin=v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;
  for(let s=0;s<particleCount;s++){const col=s%columns,row=Math.floor(s/columns);const sx=Math.min(canvas.width-1,(col+0.15+Math.random()*0.7)*(canvas.width/columns));const sy=Math.min(canvas.height-1,(row+0.15+Math.random()*0.7)*(canvas.height/rows));const x=Math.min(canvas.width-1,Math.floor(sx));const y=Math.min(canvas.height-1,Math.floor(sy));const i=(y*canvas.width+x)*4;const r=pixels[i],g=pixels[i+1],b=pixels[i+2],a=pixels[i+3]/255;const lum=(r*0.2126+g*0.7152+b*0.0722)/255;if(a<0.08)continue;const px=(sx/canvas.width-0.5)*aspect;const py=-(sy/canvas.height-0.5);const pz=(lum-0.5)*depth*0.18;const i3=count*3,i4=count*4;positions[i3]=px;positions[i3+1]=py;positions[i3+2]=pz;colors[i4]=lin(r/255);colors[i4+1]=lin(g/255);colors[i4+2]=lin(b/255);colors[i4+3]=a;count++;}
  const mc=Math.min(count,Math.max(1,Math.floor(count*0.03)));
  const mp=new Float32Array(mc*3),mcols=new Float32Array(mc*4),mph=new Float32Array(mc),msp=new Float32Array(mc),mam=new Float32Array(mc*3);
  const si=new Uint32Array(count);for(let i=0;i<count;i++)si[i]=i;
  for(let i=0;i<mc;i++){const sel=i+Math.floor(Math.random()*(count-i));[si[i],si[sel]]=[si[sel],si[i]];const src=si[i];mp.set(positions.subarray(src*3,src*3+3),i*3);mcols.set(colors.subarray(src*4,src*4+4),i*4);mph[i]=Math.random()*Math.PI*2;msp[i]=0.45+Math.random()*1.1;mam[i*3]=0.018+Math.random()*0.042;mam[i*3+1]=0.018+Math.random()*0.042;mam[i*3+2]=0.025+Math.random()*0.055;}
  const tc=[];for(let i=0;i<mc;i++){const ci=i*4;const lum=mcols[ci]*0.2126+mcols[ci+1]*0.7152+mcols[ci+2]*0.0722;if(lum>0.012)tc.push(i);}
  const tcount=Math.min(TRACK_MARKER_COUNT,tc.length);const ti=new Uint32Array(tcount);
  for(let i=0;i<tc.length;i++){const sel=i+Math.floor(Math.random()*(tc.length-i));[tc[i],tc[sel]]=[tc[sel],tc[i]];}
  for(let i=0;i<tcount;i++)ti[i]=tc[i];
  return{positions:positions.subarray(0,count*3),colors:colors.subarray(0,count*4),movingPositions:mp,movingColors:mcols,movingPhases:mph,movingSpeeds:msp,movingAmplitudes:mam,trackIndices:ti,aspect};
}

function getFitScale(vh,va,ia){return Math.min(vh*IMAGE_FIT_FRACTION,(vh*va*IMAGE_FIT_FRACTION)/ia,vh*MAX_VISUAL_SCALE);}

const host=document.body;
const scene=new THREE.Scene();
scene.background=new THREE.Color('#050606');
const camera=new THREE.PerspectiveCamera(43,host.clientWidth/host.clientHeight,0.1,100);
camera.position.set(0,0,8.8);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7));
renderer.setSize(host.clientWidth,host.clientHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;
controls.dampingFactor=0.08;
const icd=camera.position.distanceTo(controls.target);
controls.minDistance=icd/15;
controls.maxDistance=icd*2;
let cloud=null,movingCloud=null,data=null;
const pointer={x:0,y:0};

const image=new Image();
image.crossOrigin='anonymous';
image.onload=()=>{
  const bvh=2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*icd;
  const fitScale=getFitScale(bvh,camera.aspect,image.naturalWidth/image.naturalHeight);
  data=makeParticles(image,DENSITY,DEPTH);
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(data.positions,3));
  geo.setAttribute('color',new THREE.BufferAttribute(data.colors,4));
  const mat=new THREE.PointsMaterial({size:PARTICLE_SIZE,vertexColors:true,transparent:true,opacity:1,sizeAttenuation:false,depthWrite:false});
  cloud=new THREE.Points(geo,mat);
  cloud.frustumCulled=false;
  const mgeo=new THREE.BufferGeometry();
  mgeo.setAttribute('position',new THREE.BufferAttribute(data.movingPositions.slice(),3));
  mgeo.setAttribute('color',new THREE.BufferAttribute(data.movingColors,4));
  const mmat=new THREE.PointsMaterial({size:PARTICLE_SIZE,vertexColors:true,transparent:true,opacity:0.72,sizeAttenuation:false,depthWrite:false,blending:THREE.AdditiveBlending});
  movingCloud=new THREE.Points(mgeo,mmat);
  movingCloud.frustumCulled=false;
  cloud.scale.setScalar(fitScale);
  movingCloud.scale.setScalar(fitScale);
  scene.add(cloud);
  scene.add(movingCloud);
};
image.src=IMAGE_SRC;

// HUD tracking setup
const hudSvg=SHOW_HUD?document.getElementById('hud'):null;
const hudNet=SHOW_HUD?document.getElementById('tc-net'):null;
const hudMarkers=SHOW_HUD?Array.from({length:TRACK_MARKER_COUNT},(_,i)=>document.getElementById('tk'+i)):[];
const hudLabels=SHOW_HUD?Array.from({length:TRACK_MARKER_COUNT},(_,i)=>document.getElementById('tl'+i)):[];
const labelCandidates=[{x:10,y:-9,a:'start'},{x:-10,y:-9,a:'end'},{x:10,y:11,a:'start'},{x:-10,y:11,a:'end'},{x:10,y:-18,a:'start'},{x:-10,y:-18,a:'end'},{x:10,y:20,a:'start'},{x:-10,y:20,a:'end'}];
const projTracks=Array.from({length:TRACK_MARKER_COUNT},()=>({world:new THREE.Vector3(),point:new THREE.Vector3(),x:0,y:0,visible:false}));
const connFlags=new Uint8Array(TRACK_MARKER_COUNT*TRACK_MARKER_COUNT);

function resizeHud(){if(hudSvg){hudSvg.setAttribute('viewBox','0 0 '+window.innerWidth+' '+window.innerHeight);}}
resizeHud();

const clock=new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);
  const t=clock.getElapsedTime();
  controls.update();
  if(cloud&&movingCloud&&data){
    const ma=movingCloud.geometry.attributes.position;
    for(let i=0;i<data.movingPositions.length;i+=3){
      const p=i/3;const ph=data.movingPhases[p];const sp=data.movingSpeeds[p];
      const ox=data.movingPositions[i],oy=data.movingPositions[i+1],oz=data.movingPositions[i+2];
      const ax=data.movingAmplitudes[i]*MOTION,ay=data.movingAmplitudes[i+1]*MOTION,az=data.movingAmplitudes[i+2]*MOTION;
      ma.array[i]=ox+Math.sin(t*sp+ph)*ax+Math.sin(t*sp*0.37+ph*1.7)*ax*0.18;
      ma.array[i+1]=oy+Math.cos(t*sp*0.83+ph)*ay+Math.sin(t*sp*0.29+ph*1.3)*ay*0.18;
      ma.array[i+2]=oz+Math.sin(t*sp*0.67+ph*1.2)*az;
    }
    ma.needsUpdate=true;
    movingCloud.rotation.y=cloud.rotation.y=Math.sin(t*0.18)*0.12+pointer.x*0.18;
    movingCloud.rotation.x=cloud.rotation.x=Math.cos(t*0.16)*0.07-pointer.y*0.12;
    // HUD projection
    if(SHOW_HUD&&data.trackIndices.length){
      cloud.updateMatrixWorld(true);movingCloud.updateMatrixWorld(true);camera.updateMatrixWorld();
      const W=window.innerWidth,H=window.innerHeight;
      const cnt=data.trackIndices.length;
      const placed=[];
      for(let n=0;n<cnt;n++){
        const idx=data.trackIndices[n];const i3=idx*3;
        const tr=projTracks[n];
        tr.world.set(ma.array[i3],ma.array[i3+1],ma.array[i3+2]).applyMatrix4(movingCloud.matrixWorld);
        tr.point.copy(tr.world).project(camera);
        tr.x=(tr.point.x*0.5+0.5)*W;
        tr.y=(-tr.point.y*0.5+0.5)*H;
        tr.visible=tr.point.z>=-1&&tr.point.z<=1&&tr.x>=0&&tr.x<=W&&tr.y>=0&&tr.y<=H;
        const mk=hudMarkers[n];
        if(mk){mk.style.display=tr.visible?'':'none';if(tr.visible)mk.setAttribute('transform','translate('+tr.x.toFixed(1)+' '+tr.y.toFixed(1)+')');}        
        const lb=hudLabels[n];
        if(lb&&tr.visible){
          const txt=(n+1).toString().padStart(2,'0')+'  '+tr.world.x.toFixed(2)+' '+tr.world.y.toFixed(2)+' '+tr.world.z.toFixed(2);
          const tw=txt.length*4.2;
          let chosen=labelCandidates[0];let best=Infinity;
          for(const c of labelCandidates){const lx=c.a==='start'?tr.x+c.x:tr.x+c.x-tw;const ty=tr.y+c.y-8;const rx=lx+tw,by=ty+10;let ov=0;for(const p of placed){ov+=Math.max(0,Math.min(rx,p.r)-Math.max(lx,p.l))*Math.max(0,Math.min(by,p.b)-Math.max(ty,p.t));}ov+=Math.max(0,2-lx)*tw+Math.max(0,rx-(W-2))*tw+Math.max(0,2-ty)*tw+Math.max(0,by-(H-2))*tw;if(ov<best){best=ov;chosen=c;}if(ov===0)break;}
          const fl=chosen.a==='start'?tr.x+chosen.x:tr.x+chosen.x-tw;
          placed.push({l:fl,r:fl+tw,t:tr.y+chosen.y-8,b:tr.y+chosen.y+2});
          lb.textContent=txt;
          lb.setAttribute('x',String(chosen.x));
          lb.setAttribute('y',String(chosen.y));
          lb.setAttribute('text-anchor',chosen.a);
        }
      }
      // connections
      if(hudNet){
        connFlags.fill(0);
        for(let i=0;i<cnt;i++){
          if(!projTracks[i].visible)continue;
          const near=[-1,-1];const dist=[Infinity,Infinity];
          const fw=projTracks[i].world;
          for(let j=0;j<cnt;j++){if(i===j||!projTracks[j].visible)continue;const d=fw.distanceToSquared(projTracks[j].world);if(d>cloud.scale.x*cloud.scale.x*0.12)continue;if(d<dist[0]){dist[1]=dist[0];near[1]=near[0];dist[0]=d;near[0]=j;}else if(d<dist[1]){dist[1]=d;near[1]=j;}}
          for(const nb of near){if(nb>=0){connFlags[i*cnt+nb]=1;connFlags[nb*cnt+i]=1;}}
        }
        const paths=[];
        for(let i=0;i<cnt;i++)for(let j=i+1;j<cnt;j++){if(!connFlags[i*cnt+j])continue;const a=projTracks[i],b=projTracks[j];if(a.visible&&b.visible)paths.push('M'+a.x.toFixed(1)+','+a.y.toFixed(1)+'L'+b.x.toFixed(1)+','+b.y.toFixed(1));}
        hudNet.setAttribute('d',paths.join(''));
      }
    } else if(hudNet){
      hudNet.setAttribute('d','');
    }
  }
  renderer.render(scene,camera);
}
animate();

window.addEventListener('resize',()=>{
  camera.aspect=host.clientWidth/host.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(host.clientWidth,host.clientHeight);
  resizeHud();
  if(cloud&&data){const vh=2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*icd;cloud.scale.setScalar(getFitScale(vh,camera.aspect,data.aspect));movingCloud&&movingCloud.scale.copy(cloud.scale);}
});
window.addEventListener('pointermove',e=>{
  pointer.x=((e.clientX/window.innerWidth)-0.5)*2;
  pointer.y=((e.clientY/window.innerHeight)-0.5)*2;
});
<\/script>
</body>
</html>`;
}

const DEFAULT_IMAGE = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360" viewBox="0 0 360 360"><rect width="360" height="360" fill="#050606"/><defs><radialGradient id="g"><stop stop-color="#ffffff"/><stop offset=".56" stop-color="#d8e2e3"/><stop offset="1" stop-color="#263334"/></radialGradient></defs><circle cx="180" cy="180" r="112" fill="url(#g)"/><circle cx="144" cy="148" r="10" fill="#101414"/><circle cx="216" cy="148" r="10" fill="#101414"/><path d="M135 205 Q180 255 225 205" fill="none" stroke="#101414" stroke-width="8" stroke-linecap="round"/></svg>`)}`;
const TRACK_MARKER_COUNT = 12;
const MIN_PARTICLE_COUNT = 25000;
const MAX_PARTICLE_COUNT = 150000;
const MAX_SAMPLE_DIMENSION = 1024;
const IMAGE_FIT_FRACTION = 0.75;
const MAX_VISUAL_SCALE = 2;

function makeParticles(image, density, depth) {
  const detailCanvas = document.createElement("canvas");
  detailCanvas.width = 64;
  detailCanvas.height = 64;
  const detailContext = detailCanvas.getContext("2d", {
    willReadFrequently: true,
  });
  detailContext.drawImage(image, 0, 0, 64, 64);
  const detailPixels = detailContext.getImageData(0, 0, 64, 64).data;
  let edgePixels = 0;
  let opaquePixels = 0;
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const i = (y * 64 + x) * 4;
      if (detailPixels[i + 3] < 20) continue;
      opaquePixels++;
      const luminance =
        (detailPixels[i] * 0.2126 +
          detailPixels[i + 1] * 0.7152 +
          detailPixels[i + 2] * 0.0722) /
        255;
      let difference = 0;
      const right = x < 63 ? i + 4 : -1;
      const below = y < 63 ? i + 256 : -1;
      for (const neighbor of [right, below]) {
        if (neighbor < 0) continue;
        const neighborLuminance =
          (detailPixels[neighbor] * 0.2126 +
            detailPixels[neighbor + 1] * 0.7152 +
            detailPixels[neighbor + 2] * 0.0722) /
          255;
        difference = Math.max(
          difference,
          Math.abs(luminance - neighborLuminance),
          Math.abs(detailPixels[i] - detailPixels[neighbor]) / 255,
          Math.abs(detailPixels[i + 1] - detailPixels[neighbor + 1]) / 255,
          Math.abs(detailPixels[i + 2] - detailPixels[neighbor + 2]) / 255,
          Math.abs(detailPixels[i + 3] - detailPixels[neighbor + 3]) / 255,
        );
      }
      if (difference > 0.06) edgePixels++;
    }
  }
  const detailScore =
    opaquePixels > 0 ? Math.min(1, (edgePixels / opaquePixels) * 4) : 0;
  const resolutionFactor = THREE.MathUtils.clamp(
    Math.sqrt((image.naturalWidth * image.naturalHeight) / (512 * 512)),
    0.5,
    1.5,
  );
  const adaptiveCount = Math.floor(
    density * resolutionFactor * (0.75 + detailScore * 0.75),
  );
  const particleCount = THREE.MathUtils.clamp(
    adaptiveCount,
    Math.min(MIN_PARTICLE_COUNT, density),
    Math.min(MAX_PARTICLE_COUNT, density),
  );
  const canvas = document.createElement("canvas");
  const aspect = image.naturalWidth / image.naturalHeight;
  const sampleDimension = Math.min(
    MAX_SAMPLE_DIMENSION,
    Math.max(512, Math.ceil(Math.sqrt(particleCount * 8))),
  );
  const imageScale =
    sampleDimension / Math.max(image.naturalWidth, image.naturalHeight);
  canvas.width = Math.max(1, Math.round(image.naturalWidth * imageScale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * imageScale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const columns = Math.max(1, Math.floor(Math.sqrt(particleCount * aspect)));
  const rows = Math.max(1, Math.ceil(particleCount / columns));
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 4);
  let count = 0;
  const linearize = (value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  for (let sample = 0; sample < particleCount; sample++) {
    const column = sample % columns,
      row = Math.floor(sample / columns);
    const sampleX = Math.min(
      canvas.width - 1,
      (column + 0.15 + Math.random() * 0.7) * (canvas.width / columns),
    );
    const sampleY = Math.min(
      canvas.height - 1,
      (row + 0.15 + Math.random() * 0.7) * (canvas.height / rows),
    );
    const x = Math.min(
      canvas.width - 1,
      Math.floor(sampleX),
    );
    const y = Math.min(
      canvas.height - 1,
      Math.floor(sampleY),
    );
    const i = (y * canvas.width + x) * 4;
    const r = pixels[i],
      g = pixels[i + 1],
      b = pixels[i + 2],
      a = pixels[i + 3] / 255;
    const lum = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;
    if (a < 0.08) continue;
    const px = (sampleX / canvas.width - 0.5) * aspect;
    const py = -(sampleY / canvas.height - 0.5);
    const pz = (lum - 0.5) * depth * 0.18;
    const i3 = count * 3,
      i4 = count * 4;
    positions[i3] = px;
    positions[i3 + 1] = py;
    positions[i3 + 2] = pz;
    colors[i4] = linearize(r / 255);
    colors[i4 + 1] = linearize(g / 255);
    colors[i4 + 2] = linearize(b / 255);
    colors[i4 + 3] = a;
    count++;
  }
  const movingCount = Math.min(count, Math.max(1, Math.floor(count * 0.03)));
  const movingPositions = new Float32Array(movingCount * 3);
  const movingColors = new Float32Array(movingCount * 4);
  const movingPhases = new Float32Array(movingCount);
  const movingSpeeds = new Float32Array(movingCount);
  const movingAmplitudes = new Float32Array(movingCount * 3);
  const shuffledIndices = new Uint32Array(count);
  for (let i = 0; i < count; i++) shuffledIndices[i] = i;
  for (let i = 0; i < movingCount; i++) {
    const selected = i + Math.floor(Math.random() * (count - i));
    [shuffledIndices[i], shuffledIndices[selected]] = [
      shuffledIndices[selected],
      shuffledIndices[i],
    ];
    const sourceIndex = shuffledIndices[i];
    movingPositions.set(
      positions.subarray(sourceIndex * 3, sourceIndex * 3 + 3),
      i * 3,
    );
    movingColors.set(
      colors.subarray(sourceIndex * 4, sourceIndex * 4 + 4),
      i * 4,
    );
    movingPhases[i] = Math.random() * Math.PI * 2;
    movingSpeeds[i] = 0.45 + Math.random() * 1.1;
    movingAmplitudes[i * 3] = 0.018 + Math.random() * 0.042;
    movingAmplitudes[i * 3 + 1] = 0.018 + Math.random() * 0.042;
    movingAmplitudes[i * 3 + 2] = 0.025 + Math.random() * 0.055;
  }
  const trackCandidates = [];
  for (let i = 0; i < movingCount; i++) {
    const colorIndex = i * 4;
    const luminance =
      movingColors[colorIndex] * 0.2126 +
      movingColors[colorIndex + 1] * 0.7152 +
      movingColors[colorIndex + 2] * 0.0722;
    if (luminance > 0.012) trackCandidates.push(i);
  }
  const trackCount = Math.min(TRACK_MARKER_COUNT, trackCandidates.length);
  const trackIndices = new Uint32Array(trackCount);
  for (let i = 0; i < trackCandidates.length; i++) {
    const selected = i + Math.floor(Math.random() * (trackCandidates.length - i));
    [trackCandidates[i], trackCandidates[selected]] = [
      trackCandidates[selected],
      trackCandidates[i],
    ];
  }
  for (let i = 0; i < trackCount; i++) {
    trackIndices[i] = trackCandidates[i];
  }
  return {
    positions: positions.subarray(0, count * 3),
    colors: colors.subarray(0, count * 4),
    movingPositions,
    movingColors,
    movingPhases,
    movingSpeeds,
    movingAmplitudes,
    trackIndices,
    aspect,
  };
}

function getFitScale(viewHeight, viewportAspect, imageAspect) {
  return Math.min(
    viewHeight * IMAGE_FIT_FRACTION,
    (viewHeight * viewportAspect * IMAGE_FIT_FRACTION) / imageAspect,
    viewHeight * MAX_VISUAL_SCALE,
  );
}

export default function App() {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cloudRef = useRef(null);
  const movingCloudRef = useRef(null);
  const pointsDataRef = useRef(null);
  const rebuildIdRef = useRef(0);
  const pointerRef = useRef({ x: 0, y: 0 });
  const hudRef = useRef(null);
  const trackRefs = useRef([]);
  const trackLabelRefs = useRef([]);
  const connectionRef = useRef(null);
  const zoomSliderRef = useRef(null);
  const zoomTargetDistanceRef = useRef(null);
  const fileRef = useRef(null);
  const [density, setDensity] = useState(50000);
  const [particleSize, setParticleSize] = useState(0.9);
  const particleSizeRef = useRef(particleSize);
  const [depth, setDepth] = useState(1.25);
  const [motion, setMotion] = useState(0.55);
  const [uploadedName, setUploadedName] = useState("SAMPLE_FORM.svg");
  const [isPaused, setIsPaused] = useState(false);
  const [hudOn, setHudOn] = useState(true);
  const [pointCount, setPointCount] = useState(0);
  const [imageSrc, setImageSrc] = useState(DEFAULT_IMAGE);
  const [exportModal, setExportModal] = useState(false);
  const [embedCode, setEmbedCode] = useState("");
  const [copyLabel, setCopyLabel] = useState("COPY CODE");
  const [includeTracking, setIncludeTracking] = useState(false);
  const settingsRef = useRef({ density, depth, motion, isPaused, hudOn });
  useEffect(() => {
    settingsRef.current = { density, depth, motion, isPaused, hudOn };
  }, [density, depth, motion, isPaused, hudOn]);
  useEffect(() => {
    particleSizeRef.current = particleSize;
    if (cloudRef.current) cloudRef.current.material.size = particleSize;
    if (movingCloudRef.current)
      movingCloudRef.current.material.size = particleSize;
  }, [particleSize]);

  const rebuild = useCallback(
    (src, d = settingsRef.current.density, z = settingsRef.current.depth) => {
      const rebuildId = ++rebuildIdRef.current;
      const image = new Image();
      image.onload = () => {
        if (rebuildId !== rebuildIdRef.current) return;
        const scene = sceneRef.current?.scene;
        if (!scene) return;
        const { camera, initialCameraDistance } = sceneRef.current;
        const baseViewHeight =
          2 *
          Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) *
          initialCameraDistance;
        const fitScale = getFitScale(
          baseViewHeight,
          camera.aspect,
          image.naturalWidth / image.naturalHeight,
        );
        const data = makeParticles(image, d, z);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.BufferAttribute(data.positions, 3),
        );
        geometry.setAttribute(
          "color",
          new THREE.BufferAttribute(data.colors, 4),
        );
        const material = new THREE.PointsMaterial({
          size: particleSizeRef.current,
          vertexColors: true,
          transparent: true,
          opacity: 1,
          sizeAttenuation: false,
          depthWrite: false,
        });
        const next = new THREE.Points(geometry, material);
        next.frustumCulled = false;
        const movingGeometry = new THREE.BufferGeometry();
        movingGeometry.setAttribute(
          "position",
          new THREE.BufferAttribute(data.movingPositions.slice(), 3),
        );
        movingGeometry.setAttribute(
          "color",
          new THREE.BufferAttribute(data.movingColors, 4),
        );
        const movingMaterial = new THREE.PointsMaterial({
          size: particleSizeRef.current,
          vertexColors: true,
          transparent: true,
          opacity: 0.72,
          sizeAttenuation: false,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const moving = new THREE.Points(movingGeometry, movingMaterial);
        moving.frustumCulled = false;
        if (cloudRef.current) {
          scene.remove(cloudRef.current);
          cloudRef.current.geometry.dispose();
          cloudRef.current.material.dispose();
        }
        if (movingCloudRef.current) {
          scene.remove(movingCloudRef.current);
          movingCloudRef.current.geometry.dispose();
          movingCloudRef.current.material.dispose();
        }
        next.scale.setScalar(fitScale);
        moving.scale.setScalar(fitScale);
        scene.add(next);
        scene.add(moving);
        cloudRef.current = next;
        movingCloudRef.current = moving;
        pointsDataRef.current = data;
        setPointCount(data.positions.length / 3);
      };
      image.src = src;
    },
    [],
  );

  useEffect(() => {
    const host = mountRef.current;
    if (!host) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#050606");
    const camera = new THREE.PerspectiveCamera(
      43,
      host.clientWidth / host.clientHeight,
      0.1,
      100,
    );
    camera.position.set(0, 0, 8.8);
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    const initialCameraDistance = camera.position.distanceTo(controls.target);
    controls.minDistance = initialCameraDistance / 15;
    controls.maxDistance = initialCameraDistance * 2;
    controls.addEventListener("start", () => {
      zoomTargetDistanceRef.current = null;
    });
    const grid = new THREE.Group();
    const gridMat = new THREE.LineBasicMaterial({
      color: 0x273032,
      transparent: true,
      opacity: 0.45,
    });
    const addLine = (a, b) => {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(...a),
        new THREE.Vector3(...b),
      ]);
      grid.add(new THREE.Line(geo, gridMat));
    };
    for (let i = -5; i <= 5; i++) {
      const p = i * 0.52;
      addLine([p, -3.1, -2.5], [p, 3.1, -2.5]);
      addLine([-5.1, p * 0.57, -2.5], [5.1, p * 0.57, -2.5]);
    }
    scene.add(grid);
    sceneRef.current = {
      scene,
      camera,
      renderer,
      controls,
      initialCameraDistance,
    };
    rebuild(imageSrc);
    let raf;
    const projectedTracks = Array.from({ length: TRACK_MARKER_COUNT }, () => ({
      world: new THREE.Vector3(),
      point: new THREE.Vector3(),
      x: 0,
      y: 0,
      visible: false,
    }));
    const connectionFlags = new Uint8Array(
      TRACK_MARKER_COUNT * TRACK_MARKER_COUNT,
    );
    const labelCandidates = [
      { x: 10, y: -9, anchor: "start" },
      { x: -10, y: -9, anchor: "end" },
      { x: 10, y: 11, anchor: "start" },
      { x: -10, y: 11, anchor: "end" },
      { x: 10, y: -18, anchor: "start" },
      { x: -10, y: -18, anchor: "end" },
      { x: 10, y: 20, anchor: "start" },
      { x: -10, y: 20, anchor: "end" },
    ];
    const clock = new THREE.Clock();
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const settings = settingsRef.current;
      controls.update();
      const zoomTargetDistance = zoomTargetDistanceRef.current;
      if (zoomTargetDistance !== null) {
        const offset = camera.position.clone().sub(controls.target);
        const currentDistance = offset.length();
        const nextDistance = THREE.MathUtils.lerp(
          currentDistance,
          zoomTargetDistance,
          0.22,
        );
        offset.setLength(nextDistance);
        camera.position.copy(controls.target).add(offset);
        if (Math.abs(nextDistance - zoomTargetDistance) < 0.001) {
          offset.setLength(zoomTargetDistance);
          camera.position.copy(controls.target).add(offset);
          zoomTargetDistanceRef.current = null;
        }
      }
      if (zoomSliderRef.current) {
        const zoomFactor =
          initialCameraDistance / camera.position.distanceTo(controls.target);
        zoomSliderRef.current.value = String(
          THREE.MathUtils.clamp(zoomFactor, 0.5, 15),
        );
      }
      const cloud = cloudRef.current,
        movingCloud = movingCloudRef.current,
        data = pointsDataRef.current;
      if (cloud && movingCloud && data) {
        const movingAttr = movingCloud.geometry.attributes.position;
        if (!settings.isPaused) {
          for (let i = 0; i < data.movingPositions.length; i += 3) {
            const p = i / 3;
            const phase = data.movingPhases[p];
            const speed = data.movingSpeeds[p];
            const ox = data.movingPositions[i];
            const oy = data.movingPositions[i + 1];
            const oz = data.movingPositions[i + 2];
            const drift = settings.motion;
            const ax = data.movingAmplitudes[i] * drift;
            const ay = data.movingAmplitudes[i + 1] * drift;
            const az = data.movingAmplitudes[i + 2] * drift;
            movingAttr.array[i] =
              ox + Math.sin(t * speed + phase) * ax +
              Math.sin(t * speed * 0.37 + phase * 1.7) * ax * 0.18;
            movingAttr.array[i + 1] =
              oy + Math.cos(t * speed * 0.83 + phase) * ay +
              Math.sin(t * speed * 0.29 + phase * 1.3) * ay * 0.18;
            movingAttr.array[i + 2] =
              oz + Math.sin(t * speed * 0.67 + phase * 1.2) * az;
          }
          movingAttr.needsUpdate = true;
          movingCloud.rotation.y =
            cloud.rotation.y =
              Math.sin(t * 0.18) * 0.12 + pointerRef.current.x * 0.18;
          movingCloud.rotation.x =
            cloud.rotation.x =
              Math.cos(t * 0.16) * 0.07 - pointerRef.current.y * 0.12;
        }
        if (hudRef.current) {
          hudRef.current.style.display = settings.hudOn ? "" : "none";
          hudRef.current.setAttribute(
            "viewBox",
            `0 0 ${host.clientWidth} ${host.clientHeight}`,
          );
        }
        if (settings.hudOn && data.trackIndices.length) {
          cloud.updateMatrixWorld(true);
          movingCloud.updateMatrixWorld(true);
          camera.updateMatrixWorld();
          const w = host.clientWidth,
            h = host.clientHeight;
          const count = data.trackIndices.length;
          const placedLabels = [];
          for (let n = 0; n < count; n++) {
            const idx = data.trackIndices[n];
            const i = idx * 3;
            const tracked = projectedTracks[n];
            tracked.world
              .set(
                movingAttr.array[i],
                movingAttr.array[i + 1],
                movingAttr.array[i + 2],
              )
              .applyMatrix4(movingCloud.matrixWorld);
            tracked.point.copy(tracked.world).project(camera);
            tracked.x = (tracked.point.x * 0.5 + 0.5) * w;
            tracked.y = (-tracked.point.y * 0.5 + 0.5) * h;
            tracked.visible =
              tracked.point.z >= -1 &&
              tracked.point.z <= 1 &&
              tracked.x >= 0 &&
              tracked.x <= w &&
              tracked.y >= 0 &&
              tracked.y <= h;
            const marker = trackRefs.current[n];
            if (marker) {
              marker.style.display = tracked.visible ? "" : "none";
              if (tracked.visible)
                marker.setAttribute(
                  "transform",
                  `translate(${tracked.x.toFixed(1)} ${tracked.y.toFixed(1)})`,
                );
            }
            const label = trackLabelRefs.current[n];
            if (label && tracked.visible) {
              const text = `${String(n + 1).padStart(2, "0")}  ${tracked.world.x.toFixed(2)} ${tracked.world.y.toFixed(2)} ${tracked.world.z.toFixed(2)}`;
              const width = text.length * 4.2;
              let chosen = labelCandidates[0];
              let bestOverlap = Infinity;
              for (const candidate of labelCandidates) {
                const left =
                  candidate.anchor === "start"
                    ? tracked.x + candidate.x
                    : tracked.x + candidate.x - width;
                const top = tracked.y + candidate.y - 8;
                const right = left + width,
                  bottom = top + 10;
                let overlap = 0;
                for (const placed of placedLabels) {
                  const overlapX = Math.max(
                    0,
                    Math.min(right, placed.right) - Math.max(left, placed.left),
                  );
                  const overlapY = Math.max(
                    0,
                    Math.min(bottom, placed.bottom) - Math.max(top, placed.top),
                  );
                  overlap += overlapX * overlapY;
                }
                const outside =
                  Math.max(0, 2 - left) +
                  Math.max(0, right - (w - 2)) +
                  Math.max(0, 2 - top) +
                  Math.max(0, bottom - (h - 2));
                overlap += outside * width;
                if (overlap < bestOverlap) {
                  bestOverlap = overlap;
                  chosen = candidate;
                }
                if (overlap === 0) break;
              }
              const left =
                chosen.anchor === "start"
                  ? tracked.x + chosen.x
                  : tracked.x + chosen.x - width;
              const top = tracked.y + chosen.y - 8;
              placedLabels.push({
                left,
                right: left + width,
                top,
                bottom: top + 10,
              });
              label.textContent = text;
              label.setAttribute("x", String(chosen.x));
              label.setAttribute("y", String(chosen.y));
              label.setAttribute("text-anchor", chosen.anchor);
            }
          }
          if (connectionRef.current) {
            connectionFlags.fill(0);
            for (let i = 0; i < count; i++) {
              if (!projectedTracks[i].visible) continue;
              const nearest = [-1, -1];
              const distances = [Infinity, Infinity];
              const from = projectedTracks[i].world;
              for (let j = 0; j < count; j++) {
                if (i === j || !projectedTracks[j].visible) continue;
                const distance = from.distanceToSquared(
                  projectedTracks[j].world,
                );
                if (distance > cloud.scale.x * cloud.scale.x * 0.12) continue;
                if (distance < distances[0]) {
                  distances[1] = distances[0];
                  nearest[1] = nearest[0];
                  distances[0] = distance;
                  nearest[0] = j;
                } else if (distance < distances[1]) {
                  distances[1] = distance;
                  nearest[1] = j;
                }
              }
              for (const neighbor of nearest) {
                if (neighbor >= 0) {
                  connectionFlags[i * count + neighbor] = 1;
                  connectionFlags[neighbor * count + i] = 1;
                }
              }
            }
            const paths = [];
            for (let i = 0; i < count; i++) {
              for (let j = i + 1; j < count; j++) {
                if (!connectionFlags[i * count + j]) continue;
                const from = projectedTracks[i],
                  to = projectedTracks[j];
                if (from.visible && to.visible)
                  paths.push(
                    `M${from.x.toFixed(1)},${from.y.toFixed(1)}L${to.x.toFixed(1)},${to.y.toFixed(1)}`,
                  );
              }
            }
            connectionRef.current.setAttribute("d", paths.join(""));
          }
        } else if (connectionRef.current) {
          connectionRef.current.setAttribute("d", "");
        }
      }
      renderer.render(scene, camera);
    };
    animate();
    const resize = () => {
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
      if (cloudRef.current && pointsDataRef.current) {
        const viewHeight =
          2 *
          Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) *
          initialCameraDistance;
        const data = pointsDataRef.current;
        cloudRef.current.scale.setScalar(
          getFitScale(viewHeight, camera.aspect, data.aspect),
        );
        movingCloudRef.current?.scale.copy(cloudRef.current.scale);
      }
    };
    const move = (e) => {
      const r = host.getBoundingClientRect();
      pointerRef.current = {
        x: ((e.clientX - r.left) / r.width - 0.5) * 2,
        y: ((e.clientY - r.top) / r.height - 0.5) * 2,
      };
    };
    window.addEventListener("resize", resize);
    host.addEventListener("pointermove", move);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      host.removeEventListener("pointermove", move);
      controls.dispose();
      if (cloudRef.current) {
        scene.remove(cloudRef.current);
        cloudRef.current.geometry.dispose();
        cloudRef.current.material.dispose();
        cloudRef.current = null;
        pointsDataRef.current = null;
      }
      if (movingCloudRef.current) {
        scene.remove(movingCloudRef.current);
        movingCloudRef.current.geometry.dispose();
        movingCloudRef.current.material.dispose();
        movingCloudRef.current = null;
      }
      renderer.dispose();
      if (renderer.domElement.parentNode === host)
        host.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, [rebuild]);

  useEffect(() => {
    if (sceneRef.current) rebuild(imageSrc, density, depth);
  }, [density, depth, imageSrc, rebuild]);

  const onUpload = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result);
      setUploadedName(file.name.toUpperCase().slice(0, 28));
    };
    reader.readAsDataURL(file);
  };
  const setZoomFactor = (factor) => {
    const view = sceneRef.current;
    if (!view) return;
    const nextFactor = THREE.MathUtils.clamp(factor, 0.5, 15);
    zoomTargetDistanceRef.current = THREE.MathUtils.clamp(
      view.initialCameraDistance / nextFactor,
      view.controls.minDistance,
      view.controls.maxDistance,
    );
  };
  const zoom = (factor) => {
    const view = sceneRef.current;
    if (!view) return;
    const distance = view.camera.position.distanceTo(view.controls.target);
    setZoomFactor((view.initialCameraDistance / distance) * factor);
  };
  const resetView = () => {
    zoomTargetDistanceRef.current = null;
    sceneRef.current?.controls.reset();
  };

  const openExportModal = () => {
    const html = generateEmbedHTML({ imageSrc, density, particleSize, depth, motion, includeTracking });
    setEmbedCode(html);
    setExportModal(true);
    setCopyLabel("COPY CODE");
  };

  // Regenerate embed code live when tracking toggle changes inside modal
  const toggleTracking = () => {
    const next = !includeTracking;
    setIncludeTracking(next);
    if (exportModal) {
      const html = generateEmbedHTML({ imageSrc, density, particleSize, depth, motion, includeTracking: next });
      setEmbedCode(html);
      setCopyLabel("COPY CODE");
    }
  };

  const copyEmbed = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopyLabel("✓ COPIED!");
      setTimeout(() => setCopyLabel("COPY CODE"), 2200);
    } catch {
      setCopyLabel("COPY FAILED");
    }
  };

  const downloadEmbed = () => {
    const blob = new Blob([embedCode], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `particle-field-${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const previewEmbed = () => {
    const blob = new Blob([embedCode], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">✳</span>
          <span>
            FIELD<span className="muted"> / </span>STUDIES
          </span>
          <small>PARTICLE RESEARCH UNIT</small>
        </div>
        <div className="top-meta">
          <span className="live-dot" /> LIVE SIMULATION{" "}
          <span className="divider-v" /> WEBGL / 01
        </div>
      </header>
      <section className="workspace">
        <div className="scene-head">
          <div>
            <p className="eyebrow">IMAGE → SPATIAL DATA</p>
            <h1>
              Particle <em>observatory</em>
            </h1>
          </div>
          <div className="scene-status">
            <span className="status-square" /> SYSTEM ONLINE
            <br />
            <small>{pointCount.toLocaleString()} POINTS GENERATED</small>
          </div>
        </div>
        <div className="viewer-frame">
          <div className="viewport" ref={mountRef}>
            <svg className="hud-layer" ref={hudRef} aria-hidden="true">
              <path className="track-network" ref={connectionRef} />
              {Array.from({ length: TRACK_MARKER_COUNT }, (_, i) => (
                <g
                  className="track"
                  key={i}
                  ref={(element) => {
                    trackRefs.current[i] = element;
                  }}
                >
                  <path
                    className="track-brackets"
                    d="M-8 -3V-8H-3 M3 -8H8V-3 M8 3V8H3 M-3 8H-8V3"
                  />
                  <text
                    className="track-label"
                    x="11"
                    y="-8"
                    ref={(element) => {
                      trackLabelRefs.current[i] = element;
                    }}
                  />
                </g>
              ))}
            </svg>
            <div className="frame-corner tl" />
            <div className="frame-corner tr" />
            <div className="frame-corner bl" />
            <div className="frame-corner br" />
            <div className="ruler ruler-top" />
            <div className="ruler ruler-left" />
            <div className="view-label top-left">
              FIG. 01 <span>/</span> DEPTH FIELD
            </div>
            <div className="view-label top-right">X / Y / Z</div>
            <div className="view-controls" aria-label="View controls">
              <button
                type="button"
                onClick={() => zoom(1.2)}
                aria-label="Zoom in"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => zoom(1 / 1.2)}
                aria-label="Zoom out"
              >
                −
              </button>
              <label className="zoom-slider" aria-label="Zoom level">
                <input
                  ref={zoomSliderRef}
                  type="range"
                  min=".5"
                  max="15"
                  step=".1"
                  defaultValue="1"
                  onChange={(event) =>
                    setZoomFactor(Number(event.target.value))
                  }
                />
                <span>15×</span>
              </label>
              <button type="button" onClick={resetView}>
                RESET VIEW
              </button>
            </div>
            <div className="view-label bottom-left">SOURCE: {uploadedName}</div>
            <div className="view-label bottom-right">
              DRIFT{" "}
              {Math.round(motion * 100)
                .toString()
                .padStart(2, "0")}
            </div>
            <div className="crosshair">
              <span />
              <i />
            </div>
          </div>
          <div className="viewer-footer">
            <span>
              <b className="mini-dot" /> PARTICLE FIELD ACTIVE
            </span>
            <span>DRAG TO ORBIT · SCROLL TO ZOOM</span>
            <span>LOCAL RENDER / NO API</span>
          </div>
        </div>
        {/* Export bar */}
        <div className="export-bar">
          <div className="export-bar-left">
            <span className="export-bar-label">EMBED THIS ANIMATION</span>
            <span className="export-bar-desc">Generate a self-contained HTML snippet — drop it on any website</span>
          </div>
          <button className="export-btn" onClick={openExportModal} id="export-embed-btn">
            <span className="export-btn-icon">⬡</span>
            Export embed
          </button>
        </div>
        <div className="lower-grid">
          <section className="panel source-panel">
            <div className="panel-title">
              <span>01 / INPUT SOURCE</span>
              <span className="tiny-icon">↗</span>
            </div>
            <div
              className="upload-zone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                onUpload(e.dataTransfer.files?.[0]);
              }}
            >
              <div className="upload-symbol">＋</div>
              <div>
                <strong>Drop an image to scan</strong>
                <p>PNG · JPG · WEBP · SVG</p>
              </div>
              <button
                className="outline-btn"
                onClick={() => fileRef.current?.click()}
              >
                BROWSE
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => onUpload(e.target.files?.[0])}
              />
            </div>
            <div className="source-foot">
              <span>IMAGE IS PROCESSED LOCALLY</span>
              <span>MAX RECOMMENDED 12 MB</span>
            </div>
          </section>
          <section className="panel controls-panel">
            <div className="panel-title">
              <span>02 / FIELD PARAMETERS</span>
              <span className="tiny-icon">⌘</span>
            </div>
            <label className="range-row">
              <span>Particle density</span>
              <output>{density.toLocaleString()}</output>
              <input
                type="range"
                min="50000"
                max="100000"
                step="5000"
                value={density}
                onChange={(e) => setDensity(Number(e.target.value))}
              />
              <span className="range-minmax">
                <i>50,000</i>
                <i>100,000</i>
              </span>
            </label>
            <label className="range-row">
              <span>Particle size</span>
              <output>{particleSize.toFixed(1)} px</output>
              <input
                type="range"
                min=".5"
                max="1.5"
                step=".1"
                value={particleSize}
                onChange={(e) => setParticleSize(Number(e.target.value))}
              />
              <span className="range-minmax">
                <i>FINE</i>
                <i>SOFT</i>
              </span>
            </label>
            <label className="range-row">
              <span>Depth displacement</span>
              <output>{depth.toFixed(2)}×</output>
              <input
                type="range"
                min="0"
                max="3"
                step=".05"
                value={depth}
                onChange={(e) => setDepth(Number(e.target.value))}
              />
              <span className="range-minmax">
                <i>FLAT</i>
                <i>DEEP</i>
              </span>
            </label>
            <label className="range-row">
              <span>Particle drift</span>
              <output>{Math.round(motion * 100)}%</output>
              <input
                type="range"
                min="0"
                max="1.5"
                step=".05"
                value={motion}
                onChange={(e) => setMotion(Number(e.target.value))}
              />
              <span className="range-minmax">
                <i>STILL</i>
                <i>FLUID</i>
              </span>
            </label>
          </section>
          <section className="panel tracking-panel">
            <div className="panel-title">
              <span>03 / TRACKING</span>
              <span className="tracking-symbol">⌗</span>
            </div>
            <div className="tracking-preview">
              <div className="target-box">
                <span />
                <span />
                <span />
                <span />
              </div>
              <div className="tracking-copy">
                <strong>POINT LOCK</strong>
                <p>SCREEN-SPACE PROJECTION</p>
                <p>CONTINUOUS POSITION UPDATE</p>
              </div>
            </div>
            <div className="toggle-row">
              <span>Tracking annotations</span>
              <button
                className={`toggle ${hudOn ? "on" : ""}`}
                onClick={() => setHudOn((v) => !v)}
                aria-label="Toggle tracking annotations"
              >
                <span />
              </button>
            </div>
            <div className="toggle-row">
              <span>Pause particle field</span>
              <button
                className={`toggle ${isPaused ? "on" : ""}`}
                onClick={() => setIsPaused((v) => !v)}
                aria-label="Pause particle field"
              >
                <span />
              </button>
            </div>
          </section>
        </div>
        <footer className="page-footer">
          <span>FIELD STUDIES © 2026</span>
          <span>
            GENERATIVE VISUAL SYSTEMS <i>•</i> EXPERIMENT 001
          </span>
          <span>BUILT WITH THREE.JS</span>
        </footer>
      </section>

      {/* ── Export Modal ── */}
      {exportModal && (
        <div className="embed-overlay" onClick={(e) => { if (e.target === e.currentTarget) setExportModal(false); }}>
          <div className="embed-modal">
            <div className="embed-modal-header">
              <div>
                <p className="embed-modal-eyebrow">04 / EXPORT</p>
                <h2 className="embed-modal-title">Embed particle field</h2>
              </div>
              <button className="embed-close" onClick={() => setExportModal(false)} aria-label="Close">✕</button>
            </div>

            <p className="embed-modal-desc">
              A fully self-contained HTML file — zero dependencies, no server needed.
              Mouse movement, particle drift and depth are all baked in.
            </p>

            {/* Tracking annotation toggle */}
            <div className="embed-option-row">
              <div className="embed-option-left">
                <span className="embed-option-label">Include tracking annotations</span>
                <span className="embed-option-desc">Bracket markers, coordinate labels &amp; connection lines — live in the embed</span>
              </div>
              <button
                className={`toggle embed-track-toggle ${includeTracking ? "on" : ""}`}
                onClick={toggleTracking}
                aria-label="Toggle tracking annotations in embed"
                id="embed-track-toggle-btn"
              >
                <span />
              </button>
            </div>

            <div className="embed-usage-steps">
              <div className="embed-step">
                <span className="embed-step-num">01</span>
                <span>Copy the code or download the <code>.html</code> file</span>
              </div>
              <div className="embed-step">
                <span className="embed-step-num">02</span>
                <span>Paste an <code>&lt;iframe&gt;</code> tag pointing to the file, or inline the HTML</span>
              </div>
              <div className="embed-step">
                <span className="embed-step-num">03</span>
                <span>Works on any site — React, Vue, plain HTML, Webflow, Framer…</span>
              </div>
            </div>

            <div className="embed-snippet-box">
              <div className="embed-snippet-topbar">
                <span className="embed-lang-tag">HTML</span>
                <span className="embed-size-tag">{(new Blob([embedCode]).size / 1024).toFixed(1)} KB</span>
              </div>
              <pre className="embed-code-pre"><code>{embedCode.slice(0, 1800)}{embedCode.length > 1800 ? "\n\n… (truncated for preview — copy or download for full file)" : ""}</code></pre>
            </div>

            <div className="embed-iframe-hint">
              <span className="embed-hint-label">IFRAME USAGE</span>
              <code className="embed-iframe-code">{`<iframe src="particle-field.html" width="600" height="400" frameborder="0" allowfullscreen></iframe>`}</code>
            </div>

            <div className="embed-actions">
              <button className="embed-action-btn primary" onClick={copyEmbed} id="copy-embed-btn">
                {copyLabel}
              </button>
              <button className="embed-action-btn" onClick={downloadEmbed} id="download-embed-btn">
                ↓ DOWNLOAD .HTML
              </button>
              <button className="embed-action-btn" onClick={previewEmbed} id="preview-embed-btn">
                ↗ PREVIEW
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
