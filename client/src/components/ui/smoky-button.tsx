"use client";

import { forwardRef, useEffect, useRef, type ButtonHTMLAttributes } from "react";


export interface SmokeColors {
  primary: string;
  secondary: string;
  shadow: string;
}

export interface SmokyButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  colors?: SmokeColors;
  status?: string;
  speed?: number;
}

type RgbColor = readonly [number, number, number];

interface SmokeSettings {
  colors: readonly [RgbColor, RgbColor, RgbColor];
  speed: number;
}

interface SmokeRenderer {
  update: (settings: SmokeSettings) => void;
  destroy: () => void;
}

const VERTEX_SHADER = `
  attribute vec2 aPosition;

  void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;

  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uSpeed;
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;
  uniform vec3 uShadow;

  float random(vec2 position) {
    return fract(sin(dot(position, vec2(12.9898, 78.233))) * 43758.5453);
  }

  float noise(vec2 position) {
    vec2 cell = floor(position);
    vec2 offset = fract(position);
    float a = random(cell);
    float b = random(cell + vec2(1.0, 0.0));
    float c = random(cell + vec2(0.0, 1.0));
    float d = random(cell + vec2(1.0, 1.0));
    vec2 blend = offset * offset * (3.0 - 2.0 * offset);
    return mix(a, b, blend.x)
      + (c - a) * blend.y * (1.0 - blend.x)
      + (d - b) * blend.x * blend.y;
  }

  float fbm(vec2 position) {
    float value = 0.0;
    float amplitude = 0.5;
    mat2 rotation = mat2(0.8776, 0.4794, -0.4794, 0.8776);

    for (int i = 0; i < 7; i++) {
      value += amplitude * noise(position);
      position = rotation * position * 2.04 + vec2(13.7, 9.2);
      amplitude *= 0.5;
    }

    return value;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    vec2 position = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;
    float time = uTime * uSpeed * 0.58;

    vec2 silkPosition = position;
    silkPosition.y += 0.20 * sin(position.x * 1.55 - time * 1.8)
      + 0.11 * sin(position.x * 3.2 + time * 1.35);
    silkPosition.x += 0.06 * sin(position.y * 4.2 - time * 1.1);

    vec2 warp = vec2(
      fbm(silkPosition * 1.15 + vec2(time * 0.28, -time * 0.17)),
      fbm(silkPosition * 1.05 + vec2(4.8, 1.3) - vec2(time * 0.18, time * 0.22))
    );
    vec2 current = silkPosition + (warp - 0.5) * 0.82;
    float body = fbm(current * 1.35 + vec2(-time * 0.24, time * 0.14));
    float detail = fbm(current * 2.7 + vec2(time * 0.31, -time * 0.27));
    float primaryPlume = fbm(current * 1.20 + vec2(-time * 0.38, time * 0.18));
    float secondaryPlume = fbm(
      current * 1.10 + vec2(time * 0.26, -time * 0.32) + vec2(7.2, 3.6)
    );
    float shadowPlume = fbm(
      current * 1.45 + vec2(-time * 0.18, time * 0.42) + vec2(2.4, 8.1)
    );
    float bottomPlume = fbm(
      vec2(current.x * 0.92 - time * 0.34, current.y * 0.76 + time * 0.16)
        + vec2(6.4, 2.3)
    );

    float sharedFlow = current.y * 6.8 + current.x * 1.35 + (warp.x - warp.y) * 5.2;
    float crossFlow = current.y * 5.4 - current.x * 2.1 + (warp.x + warp.y) * 3.5;
    float primaryRibbon = 0.5 + 0.5 * sin(sharedFlow - time * 2.75);
    float secondaryRibbon = 0.5 + 0.5 * sin(crossFlow + time * 2.35 + 2.1);
    float shadowRibbon = 0.5 + 0.5 * sin(
      sharedFlow * 0.78 - crossFlow * 0.22 - time * 3.25 + 4.2
    );
    primaryRibbon = smoothstep(0.08, 0.92, primaryRibbon);
    secondaryRibbon = smoothstep(0.08, 0.92, secondaryRibbon);
    shadowRibbon = smoothstep(0.12, 0.88, shadowRibbon);

    float primaryWeight = smoothstep(0.27, 0.76, primaryPlume + 0.24 * body)
      * (0.20 + 1.08 * primaryRibbon);
    float secondaryWeight = smoothstep(0.26, 0.74, secondaryPlume + 0.22 * body)
      * (0.22 + 1.04 * secondaryRibbon + 0.12 * detail);
    float shadowWeight = 0.16 + smoothstep(0.32, 0.80, shadowPlume + 0.14 * body)
      * (0.22 + 0.86 * shadowRibbon);
    float totalWeight = max(primaryWeight + secondaryWeight + shadowWeight, 0.001);
    vec3 color = (
      uPrimary * primaryWeight
      + uSecondary * secondaryWeight
      + uShadow * shadowWeight
    ) / totalWeight;

    float depth = smoothstep(0.15, 0.88, body * 0.78 + detail * 0.30);
    color *= 0.65 + depth * 0.62;
    float shadowVein = smoothstep(
      0.46,
      0.80,
      shadowPlume + 0.10 * body + 0.16 * shadowRibbon
    );
    color = mix(color, uShadow, shadowVein * (0.12 + 0.42 * shadowRibbon));

    float sheenWave = 0.5 + 0.5 * sin(sharedFlow * 1.22 - time * 3.2 + detail * 2.0);
    float sheen = pow(sheenWave, 6.0);
    color += mix(uSecondary, uPrimary, primaryRibbon) * sheen * (0.10 + 0.16 * depth);

    float bottomRidge = 0.26 + 0.24 * bottomPlume
      + 0.08 * sin(current.x * 2.35 - time * 2.6 + warp.x * 3.0);
    float bottomEnvelope = 1.0 - smoothstep(bottomRidge, bottomRidge + 0.24, uv.y);
    float bottomCloud = smoothstep(0.18, 0.72, bottomPlume + 0.22 * detail);
    float bottomMask = bottomEnvelope * (0.48 + 0.52 * bottomCloud);
    float bottomFlow = 0.5 + 0.5 * sin(current.x * 2.1 - time * 2.4 + warp.y * 4.0);
    vec3 bottomColor = mix(uPrimary, uSecondary, smoothstep(0.12, 0.88, bottomFlow));
    float bottomShadow = smoothstep(0.48, 0.78, shadowPlume + 0.18 * bottomPlume);
    bottomColor = mix(bottomColor, uShadow, bottomShadow * 0.72);
    float bottomSheen = pow(0.5 + 0.5 * sin(bottomFlow * 5.0 + time * 2.2), 5.0);
    bottomColor += mix(uSecondary, uPrimary, bottomFlow) * bottomSheen * 0.12;
    color = mix(color, bottomColor, bottomMask * 0.72);

    float feather = uv.x
      + 0.12 * (body - 0.5)
      + 0.08 * (bottomPlume - 0.5)
      + 0.04 * sin(current.y * 3.0 - time * 1.4);
    float alpha = smoothstep(0.24, 0.72, feather);

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), alpha);
  }
`;

const createShader = (gl: WebGLRenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to create WebGL shader.");

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "Unknown shader error.";
    gl.deleteShader(shader);
    throw new Error(message);
  }

  return shader;
};

const createProgram = (gl: WebGLRenderingContext) => {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!program) throw new Error("Unable to create WebGL program.");

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? "Unknown WebGL program error.";
    gl.deleteProgram(program);
    throw new Error(message);
  }

  return program;
};

const getUniform = (gl: WebGLRenderingContext, program: WebGLProgram, name: string) => {
  const location = gl.getUniformLocation(program, name);
  if (!location) throw new Error(`Missing WebGL uniform: ${name}`);
  return location;
};

const hexToRgb = (hex: string): RgbColor => {
  const value = hex.replace("#", "").trim();
  const normalized = value.length === 3
    ? value.split("").map((character) => character + character).join("")
    : value;
  const parsed = Number.parseInt(normalized, 16);

  if (normalized.length !== 6 || Number.isNaN(parsed)) return [0, 0, 0];
  return [
    ((parsed >> 16) & 255) / 255,
    ((parsed >> 8) & 255) / 255,
    (parsed & 255) / 255,
  ];
};

const createSmokeRenderer = (
  canvas: HTMLCanvasElement,
  initialSettings: SmokeSettings,
): SmokeRenderer => {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
  });
  if (!gl) throw new Error("WebGL is not available in this browser.");

  const program = createProgram(gl);
  const buffer = gl.createBuffer();
  if (!buffer) throw new Error("Unable to create WebGL buffer.");

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  const position = gl.getAttribLocation(program, "aPosition");
  const resolution = getUniform(gl, program, "uResolution");
  const time = getUniform(gl, program, "uTime");
  const speed = getUniform(gl, program, "uSpeed");
  const primary = getUniform(gl, program, "uPrimary");
  const secondary = getUniform(gl, program, "uSecondary");
  const shadow = getUniform(gl, program, "uShadow");
  let settings = initialSettings;
  let frame = 0;

  const resize = () => {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * pixelRatio));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * pixelRatio));
  };

  const startedAt = performance.now();
  const render = (now: number) => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(resolution, canvas.width, canvas.height);
    gl.uniform1f(time, (now - startedAt) / 1000);
    gl.uniform1f(speed, settings.speed);
    gl.uniform3f(primary, ...settings.colors[0]);
    gl.uniform3f(secondary, ...settings.colors[1]);
    gl.uniform3f(shadow, ...settings.colors[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    frame = requestAnimationFrame(render);
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas.parentElement ?? canvas);
  resize();
  frame = requestAnimationFrame(render);

  return {
    update(nextSettings) {
      settings = nextSettings;
    },
    destroy() {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    },
  };
};

export const DEFAULT_SMOKE_COLORS: SmokeColors = {
  primary: "#002FA7",
  secondary: "#5C331F",
  shadow: "#050506",
};

export const SmokyButton = forwardRef<HTMLButtonElement, SmokyButtonProps>(
  (
    {
      children = "Smoky Button",
      className = "",
      colors = DEFAULT_SMOKE_COLORS,
      status = "ready",
      speed = 1,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<SmokeRenderer | null>(null);

    useEffect(() => {
      if (!canvasRef.current) return;

      try {
        rendererRef.current = createSmokeRenderer(canvasRef.current, {
          colors: [
            hexToRgb(DEFAULT_SMOKE_COLORS.primary),
            hexToRgb(DEFAULT_SMOKE_COLORS.secondary),
            hexToRgb(DEFAULT_SMOKE_COLORS.shadow),
          ],
          speed: 1,
        });
      } catch (error) {
        console.error("Unable to start smoky button renderer.", error);
      }

      return () => {
        rendererRef.current?.destroy();
        rendererRef.current = null;
      };
    }, []);

    useEffect(() => {
      rendererRef.current?.update({
        colors: [
          hexToRgb(colors.primary),
          hexToRgb(colors.secondary),
          hexToRgb(colors.shadow),
        ],
        speed,
      });
    }, [colors.primary, colors.secondary, colors.shadow, speed]);

    return (
      <button
        {...props}
        ref={ref}
        type={type}
        className={`smoky-button ${className}`.trim()}
      >
        <canvas ref={canvasRef} className="smoky-button__canvas" aria-hidden="true" />
        <span className="smoky-button__copy">
          <span className="smoky-button__label">{children}</span>
          {status ? <span className="smoky-button__status">{status}</span> : null}
        </span>
      </button>
    );
  },
);

SmokyButton.displayName = "SmokyButton";

export default SmokyButton;
