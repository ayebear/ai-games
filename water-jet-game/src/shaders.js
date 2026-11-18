import * as THREE from 'three';

const NOISE = /* glsl */ `
float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  float a=hash(i), b=hash(i+vec2(1.0,0.0)), c=hash(i+vec2(0.0,1.0)), d=hash(i+vec2(1.0,1.0));
  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
}
float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<4;i++){ v+=a*noise(p); p*=2.03; a*=0.5; } return v; }
`;

export function waterMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uDeep: { value: new THREE.Color('#29aee0') },
        uShallow: { value: new THREE.Color('#8ff2ff') },
        uFoam: { value: new THREE.Color('#ffffff') },
      },
    ]),
    side: THREE.DoubleSide,
    fog: true,
    vertexShader: /* glsl */ `
      attribute float aSpeed;
      attribute float aFoam;
      uniform float uTime;
      varying vec2 vUv; varying float vSpeed; varying float vFoam; varying float vWave;
      #include <fog_pars_vertex>
      void main(){
        vUv=uv; vSpeed=aSpeed; vFoam=aFoam;
        vec3 p=position;
        float edge=min(uv.x,1.0-uv.x);
        float w=(sin(p.x*0.9+uTime*2.1)+sin(p.z*1.1-uTime*1.6))*0.035*smoothstep(0.0,0.12,edge);
        p.y+=w; vWave=w;
        vec4 mvPosition=modelViewMatrix*vec4(p,1.0);
        gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uFoam;
      varying vec2 vUv; varying float vSpeed; varying float vFoam; varying float vWave;
      #include <fog_pars_fragment>
      ${NOISE}
      float pattern(vec2 p){ return noise(vec2(p.x*7.0,p.y*0.55))*0.6+noise(vec2(p.x*17.0,p.y*1.6))*0.4; }
      void main(){
        float edge=min(vUv.x,1.0-vUv.x);
        vec3 col=mix(uShallow,uDeep,smoothstep(0.0,0.3,edge));
        // two-phase flow scrolling so varying speeds never smear over time
        float c=uTime*0.3; float ph0=fract(c); float ph1=fract(c+0.5);
        float wt=1.0-abs(2.0*ph0-1.0);
        float span=1.0/0.3;
        float n0=pattern(vec2(vUv.x, vUv.y-ph0*span*vSpeed));
        float n1=pattern(vec2(vUv.x+0.37, vUv.y-ph1*span*vSpeed+17.0));
        float n=mix(n1,n0,wt);
        float th=0.71-0.25*vFoam;
        float streak=smoothstep(th,th+0.06,n);
        float ef=1.0-smoothstep(0.012,0.06+0.03*sin(vUv.y*1.3+uTime*2.0),edge);
        float foam=clamp(max(streak*(0.55+0.45*vFoam),ef)+vFoam*0.3,0.0,1.0);
        col=mix(col,uFoam,foam*0.9);
        col+=vec3(vWave*2.2);
        float sp=noise(vec2(vUv.x*80.0,vUv.y*6.0-uTime*vSpeed*2.0));
        col+=vec3(pow(sp,22.0)*1.4);
        gl_FragColor=vec4(col,1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

// Water spilling off the sides of the sky river.
export function skirtMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uDeep: { value: new THREE.Color('#3cc4ee') },
        uFoam: { value: new THREE.Color('#ffffff') },
      },
    ]),
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      #include <fog_pars_vertex>
      void main(){ vUv=uv; vec4 mvPosition=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uDeep; uniform vec3 uFoam;
      varying vec2 vUv;
      #include <fog_pars_fragment>
      ${NOISE}
      void main(){
        float n=noise(vec2(vUv.x*1.3, vUv.y*5.0-uTime*3.5));
        float a=pow(1.0-vUv.y,1.7)*0.85*(0.55+0.45*n);
        vec3 col=mix(uDeep,uFoam,smoothstep(0.45,0.8,n)*0.7+(1.0-vUv.y)*0.25);
        gl_FragColor=vec4(col,a);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

export function skyMaterial(top, horizon, bottom, sunDir) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color(top) },
      uHorizon: { value: new THREE.Color(horizon) },
      uBottom: { value: new THREE.Color(bottom) },
      uSunDir: { value: sunDir.clone().normalize() },
      uSun: { value: new THREE.Color('#fff4d6') },
    },
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){ vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uBottom; uniform vec3 uSunDir; uniform vec3 uSun;
      varying vec3 vDir;
      void main(){
        vec3 d=normalize(vDir); float h=d.y;
        vec3 col = h>0.0 ? mix(uHorizon,uTop,pow(h,0.55)) : mix(uHorizon,uBottom,pow(-h,0.6));
        float s=max(dot(d,normalize(uSunDir)),0.0);
        col+=uSun*(pow(s,350.0)*1.6+pow(s,10.0)*0.22);
        gl_FragColor=vec4(col,1.0);
        #include <colorspace_fragment>
      }`,
  });
}

export function cloudSeaMaterial(fogColor) {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uLow: { value: new THREE.Color('#c9b6ff') },
        uHigh: { value: new THREE.Color('#ffffff') },
        uPink: { value: new THREE.Color('#ffc6e6') },
      },
    ]),
    fog: true,
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vWorld=wp.xyz; vec4 mvPosition=viewMatrix*wp; gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uLow; uniform vec3 uHigh; uniform vec3 uPink;
      varying vec3 vWorld;
      #include <fog_pars_fragment>
      ${NOISE}
      void main(){
        vec2 p=vWorld.xz*0.012+vec2(uTime*0.012,uTime*0.004);
        float f=fbm(p);
        float g=fbm(p*0.35+7.1);
        vec3 col=mix(uLow,uHigh,smoothstep(0.38,0.7,f));
        col=mix(col,uPink,smoothstep(0.55,0.8,g)*0.35);
        gl_FragColor=vec4(col,1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}
