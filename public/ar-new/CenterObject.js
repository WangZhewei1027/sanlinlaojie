/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * 中心对象组件
 * 管理AR场景中心的参考对象
 */
class CenterObject {
  constructor() {
    this.object = null;
    this.particles = null;
    this.time = 0;
    this.init();
  }

  /**
   * 初始化中心对象
   */
  init() {
    // 创建容器组
    this.object = new THREE.Group();
    this.object.position.set(0, 1.0, 0); // 设置在anchor上方1米，悬浮在空中

    // 创建波动球体
    this.createLivingSphere();

    // 创建粒子效果
    this.createParticles();
  }

  /**
   * 创建有生命感的波动球体
   */
  createLivingSphere() {
    // 球体几何体
    const geometry = new THREE.SphereGeometry(0.2, 64, 64);

    // 自定义着色器材质
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        colorA: { value: new THREE.Color(0x00ffff) },
        colorB: { value: new THREE.Color(0xff00ff) },
      },
      vertexShader: `
        uniform float time;
        varying vec3 vNormal;
        varying vec3 vPosition;
        
        // Perlin噪声函数（简化版3D噪声）
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
        
        float snoise(vec3 v) {
          const vec2 C = vec2(1.0/6.0, 1.0/3.0);
          const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
          
          vec3 i  = floor(v + dot(v, C.yyy));
          vec3 x0 = v - i + dot(i, C.xxx);
          
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min(g.xyz, l.zxy);
          vec3 i2 = max(g.xyz, l.zxy);
          
          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy;
          vec3 x3 = x0 - D.yyy;
          
          i = mod289(i);
          vec4 p = permute(permute(permute(
                    i.z + vec4(0.0, i1.z, i2.z, 1.0))
                  + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                  + i.x + vec4(0.0, i1.x, i2.x, 1.0));
          
          float n_ = 0.142857142857;
          vec3 ns = n_ * D.wyz - D.xzx;
          
          vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
          
          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_);
          
          vec4 x = x_ *ns.x + ns.yyyy;
          vec4 y = y_ *ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);
          
          vec4 b0 = vec4(x.xy, y.xy);
          vec4 b1 = vec4(x.zw, y.zw);
          
          vec4 s0 = floor(b0)*2.0 + 1.0;
          vec4 s1 = floor(b1)*2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));
          
          vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
          vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
          
          vec3 p0 = vec3(a0.xy, h.x);
          vec3 p1 = vec3(a0.zw, h.y);
          vec3 p2 = vec3(a1.xy, h.z);
          vec3 p3 = vec3(a1.zw, h.w);
          
          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
          p0 *= norm.x;
          p1 *= norm.y;
          p2 *= norm.z;
          p3 *= norm.w;
          
          vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }
        
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          
          // 使用多层噪声创建海浪效果
          float noise1 = snoise(position * 3.0 + time * 0.5);
          float noise2 = snoise(position * 6.0 + time * 0.8);
          float noise3 = snoise(position * 12.0 + time * 1.2);
          
          // 组合噪声
          float displacement = (noise1 * 0.5 + noise2 * 0.3 + noise3 * 0.2) * 0.15;
          
          // 应用位移
          vec3 newPosition = position + normal * displacement;
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 colorA;
        uniform vec3 colorB;
        varying vec3 vNormal;
        varying vec3 vPosition;
        
        void main() {
          // 基于法线和位置的颜色混合
          float mixValue = dot(vNormal, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5;
          mixValue += sin(vPosition.y * 5.0 + time) * 0.2;
          
          vec3 color = mix(colorA, colorB, mixValue);
          
          // 添加边缘光效果
          float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
          color += fresnel * 0.5;
          
          gl_FragColor = vec4(color, 0.9);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
    });

    this.sphere = new THREE.Mesh(geometry, material);
    this.object.add(this.sphere);
  }

  /**
   * 创建粒子效果
   */
  createParticles() {
    const particleCount = 200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = [];

    // 初始化粒子位置和速度
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;

      // 在球体周围随机分布
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const radius = 0.3 + Math.random() * 0.2;

      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi);

      // 速度
      velocities.push({
        x: (Math.random() - 0.5) * 0.002,
        y: (Math.random() - 0.5) * 0.002,
        z: (Math.random() - 0.5) * 0.002,
        life: Math.random(),
      });
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0x00ffff,
      size: 0.02,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });

    this.particles = new THREE.Points(geometry, material);
    this.particleVelocities = velocities;
    this.object.add(this.particles);
  }

  /**
   * 更新动画
   */
  update() {
    if (!this.object) return;

    this.time += 0.016; // ~60fps

    // 更新球体着色器
    if (this.sphere && this.sphere.material.uniforms) {
      this.sphere.material.uniforms.time.value = this.time;
    }

    // 缓慢旋转
    this.object.rotation.y += 0.003;

    // 更新粒子
    if (this.particles) {
      const positions = this.particles.geometry.attributes.position.array;

      for (let i = 0; i < this.particleVelocities.length; i++) {
        const i3 = i * 3;
        const vel = this.particleVelocities[i];

        // 更新位置
        positions[i3] += vel.x;
        positions[i3 + 1] += vel.y;
        positions[i3 + 2] += vel.z;

        // 计算距离中心的距离
        const dist = Math.sqrt(
          positions[i3] ** 2 + positions[i3 + 1] ** 2 + positions[i3 + 2] ** 2
        );

        // 如果太远，重新生成
        if (dist > 0.6 || dist < 0.2) {
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.random() * Math.PI;
          const radius = 0.3 + Math.random() * 0.1;

          positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
          positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
          positions[i3 + 2] = radius * Math.cos(phi);
        }
      }

      this.particles.geometry.attributes.position.needsUpdate = true;
    }
  }

  /**
   * 获取Three.js对象
   */
  getObject3D() {
    return this.object;
  }

  /**
   * 获取位置
   */
  getPosition() {
    return this.object ? this.object.position : new THREE.Vector3(0, 1.0, 0);
  }

  /**
   * 设置位置
   */
  setPosition(x, y, z) {
    if (this.object) {
      this.object.position.set(x, y, z);
    }
  }
}
