// ============================================================
// WebGL 等高线背景（移植自原型 6.html L1699-1841）
// 手写 GLSL，不使用任何 3D 库。shader 源码与原型逐字节一致。
// ============================================================
import { useEffect, useRef } from 'react'

const vsSource = `
        attribute vec2 a_position;
        varying vec2 v_uv;
        void main() {
          v_uv = a_position * 0.5 + 0.5;
          gl_Position = vec4(a_position, 0.0, 1.0);
        }
`

const fsSource = `
        precision mediump float;
        varying vec2 v_uv;
        uniform float u_time;
        uniform vec2 u_resolution;
        uniform vec2 u_mouse;
        uniform float u_press;

        float orderedTopography(vec2 p, float t) {
          vec2 c1 = vec2(-0.34 + sin(t * 0.14) * 0.04, 0.08 + cos(t * 0.11) * 0.03);
          vec2 c2 = vec2(0.36 + cos(t * 0.12) * 0.04, -0.06 + sin(t * 0.15) * 0.03);
          float d1 = length((p - c1) * vec2(0.92, 1.15));
          float d2 = length((p - c2) * vec2(0.95, 1.12));
          float dome1 = exp(-d1 * d1 * 2.15) * 0.62;
          float dome2 = exp(-d2 * d2 * 2.05) * 0.58;
          float flow =
            sin(p.x * 2.4 + p.y * 1.6 + t * 0.18) * 0.075 +
            cos(p.x * 1.5 - p.y * 2.2 - t * 0.14) * 0.065 +
            sin((p.x + p.y) * 1.2 + t * 0.1) * 0.045;
          return dome1 + dome2 + flow;
        }

        void main() {
          vec2 aspect = vec2(u_resolution.x / max(u_resolution.y, 1.0), 1.0);
          vec2 p = (v_uv - 0.5) * aspect;
          vec2 m = (u_mouse - 0.5) * aspect;
          vec2 delta = p - m;
          float distM = length(delta);
          float hoverInfluence = exp(-distM * distM * 5.2);
          float pressInfluence = exp(-distM * distM * 3.6) * u_press;
          vec2 warpedP = m + delta * (1.0 + hoverInfluence * 0.055 + pressInfluence * 0.24);

          vec3 abyss = vec3(0.019, 0.035, 0.067);
          vec3 deepBlue = vec3(0.045, 0.088, 0.165);
          vec3 mistBlue = vec3(0.18, 0.30, 0.42);
          vec3 greyPurple = vec3(0.165, 0.168, 0.265);
          vec3 warm = vec3(0.95, 0.55, 0.22);

          float radial = length(p * vec2(0.85, 1.15));
          vec3 col = mix(deepBlue, abyss, smoothstep(0.05, 0.95, radial));
          float elevation = orderedTopography(warpedP, u_time) - (hoverInfluence * 0.035 + pressInfluence * 0.16);

          float contourFreq = 16.0;
          float cVal = fract(elevation * contourFreq);
          float lineDist = min(cVal, 1.0 - cVal);
          float contourLine = smoothstep(0.036, 0.006, lineDist);

          float majorVal = fract(elevation * (contourFreq * 0.25));
          float majorDist = min(majorVal, 1.0 - majorVal);
          float majorLine = smoothstep(0.014, 0.002, majorDist);

          float crestMask = smoothstep(0.54, 0.64, elevation) * smoothstep(0.76, 0.64, elevation);
          vec3 lineColor = mix(mistBlue * 0.72, warm * 0.52, crestMask * majorLine * 0.75);
          col += lineColor * (contourLine * 0.17 + majorLine * 0.10 + pressInfluence * contourLine * 0.16);

          float fog1 = exp(-length(p - vec2(-0.28 + sin(u_time * 0.08) * 0.04, 0.16)) * 2.6);
          float fog2 = exp(-length(p - vec2(0.32, -0.14 + cos(u_time * 0.07) * 0.04)) * 2.4);
          col += mistBlue * fog1 * 0.15 + greyPurple * fog2 * 0.20 + mistBlue * pressInfluence * 0.12;
          gl_FragColor = vec4(col, 1.0);
        }
`

export default function ContourCanvas() {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', { alpha: false, antialias: true })
    if (!gl) return

    function compileShader(type, source) {
      const shader = gl.createShader(type)
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader)
        return null
      }
      return shader
    }

    const vs = compileShader(gl.VERTEX_SHADER, vsSource)
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSource)
    if (!vs || !fs) return

    const program = gl.createProgram()
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return
    gl.useProgram(program)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    )

    const posLoc = gl.getAttribLocation(program, 'a_position')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    const uTime = gl.getUniformLocation(program, 'u_time')
    const uRes = gl.getUniformLocation(program, 'u_resolution')
    const uMouse = gl.getUniformLocation(program, 'u_mouse')
    const uPress = gl.getUniformLocation(program, 'u_press')

    let glMouseX = 0.5, glMouseY = 0.5, targetGlX = 0.5, targetGlY = 0.5
    let glPress = 0.0, targetGlPress = 0.0

    const onMove = (e) => {
      targetGlX = e.clientX / Math.max(window.innerWidth, 1)
      targetGlY = 1.0 - e.clientY / Math.max(window.innerHeight, 1)
    }
    const onDown = () => { targetGlPress = 1.0 }
    const onUp = () => { targetGlPress = 0.0 }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)

    function resizeGL() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(window.innerWidth * dpr)
      canvas.height = Math.floor(window.innerHeight * dpr)
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    window.addEventListener('resize', resizeGL)
    resizeGL()

    let raf = 0
    const startTime = performance.now()
    function renderGL(now) {
      glMouseX += (targetGlX - glMouseX) * 0.06
      glMouseY += (targetGlY - glMouseY) * 0.06
      glPress += (targetGlPress - glPress) * 0.11
      gl.uniform1f(uTime, (now - startTime) * 0.001)
      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.uniform2f(uMouse, glMouseX, glMouseY)
      gl.uniform1f(uPress, glPress)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      raf = requestAnimationFrame(renderGL)
    }
    raf = requestAnimationFrame(renderGL)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('resize', resizeGL)
      gl.deleteProgram(program)
      gl.deleteBuffer(buffer)
    }
  }, [])

  return <canvas ref={ref} className="fixed inset-0 h-full w-full pointer-events-none z-0" />
}
