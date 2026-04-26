import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'

// ── Perry's colour palette ────────────────────────────────────
const SKIN    = '#fdbcb4'
const SKIN_SH = '#d4917a'
const HAIR    = '#5a3a1a'
const HAT     = '#111111'
const BAND    = '#0984e3'
const NOSE    = '#d97060'
const STUBBLE = '#b07858'

// ── 3-D Perry bust ────────────────────────────────────────────
function PerryMesh() {
  const root = useRef()

  useFrame(({ clock }) => {
    if (!root.current) return
    const t = clock.elapsedTime
    // gentle float + subtle side-to-side turn for that 3-D feel
    root.current.position.y = Math.sin(t * 1.5) * 0.06
    root.current.rotation.y = Math.sin(t * 0.85) * 0.10
  })

  return (
    <group ref={root}>

      {/* ── FACE / HEAD ─────────────────────────────────────── */}
      {/* Slightly wide on X, round on Z — gives that chubby Perry look */}
      <mesh scale={[1.14, 1.0, 1.0]}>
        <sphereGeometry args={[0.40, 48, 48]} />
        <meshStandardMaterial color={SKIN} roughness={0.82} />
      </mesh>

      {/* ── JAW STUBBLE SHADOW ──────────────────────────────── */}
      <mesh position={[0, -0.18, 0.13]} scale={[1.0, 0.44, 0.82]}>
        <sphereGeometry args={[0.40, 32, 16]} />
        <meshStandardMaterial
          color={STUBBLE}
          transparent
          opacity={0.40}
          roughness={1}
          depthWrite={false}
        />
      </mesh>

      {/* ── HAIR — main dark mass ────────────────────────────── */}
      <mesh position={[0, 0.30, 0.0]} scale={[1.13, 0.64, 0.94]}>
        <sphereGeometry args={[0.38, 32, 32]} />
        <meshStandardMaterial color={HAIR} roughness={1} />
      </mesh>
      {/* left wild curl */}
      <mesh position={[-0.30, 0.26, 0.06]} scale={[0.76, 0.86, 0.76]}>
        <sphereGeometry args={[0.19, 16, 16]} />
        <meshStandardMaterial color={HAIR} roughness={1} />
      </mesh>
      {/* right wild curl */}
      <mesh position={[0.30, 0.26, 0.06]} scale={[0.76, 0.86, 0.76]}>
        <sphereGeometry args={[0.19, 16, 16]} />
        <meshStandardMaterial color={HAIR} roughness={1} />
      </mesh>
      {/* top puff */}
      <mesh position={[0, 0.48, 0.0]} scale={[0.64, 0.54, 0.64]}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color={HAIR} roughness={1} />
      </mesh>

      {/* ── LEFT EYE ─────────────────────────────────────────── */}
      <mesh position={[-0.155, 0.05, 0.37]}>
        <sphereGeometry args={[0.072, 20, 20]} />
        <meshStandardMaterial color="#111" roughness={0.3} />
      </mesh>
      <mesh position={[-0.124, 0.082, 0.434]}>
        <sphereGeometry args={[0.022, 8, 8]} />
        <meshStandardMaterial color="white" emissive="white" emissiveIntensity={1.0} />
      </mesh>

      {/* ── RIGHT EYE ────────────────────────────────────────── */}
      <mesh position={[0.155, 0.05, 0.37]}>
        <sphereGeometry args={[0.072, 20, 20]} />
        <meshStandardMaterial color="#111" roughness={0.3} />
      </mesh>
      <mesh position={[0.186, 0.082, 0.434]}>
        <sphereGeometry args={[0.022, 8, 8]} />
        <meshStandardMaterial color="white" emissive="white" emissiveIntensity={1.0} />
      </mesh>

      {/* ── NOSE ─────────────────────────────────────────────── */}
      <mesh position={[0, -0.07, 0.42]}>
        <sphereGeometry args={[0.076, 20, 20]} />
        <meshStandardMaterial color={NOSE} roughness={0.70} />
      </mesh>

      {/* ── TEETH (sits proud of the mouth arc) ───────────────── */}
      <mesh position={[0, -0.222, 0.39]}>
        <boxGeometry args={[0.265, 0.058, 0.04]} />
        <meshStandardMaterial color="#f4f4f4" roughness={0.5} />
      </mesh>

      {/* ── SMILE ARC ─────────────────────────────────────────── */}
      <mesh position={[0, -0.21, 0.33]} rotation={[0.38, 0, 0]}>
        <torusGeometry args={[0.162, 0.030, 12, 40, Math.PI]} />
        <meshStandardMaterial color="#1a0a00" />
      </mesh>

      {/* ── CHEEK BLUSH (subtle warmth) ───────────────────────── */}
      <mesh position={[-0.28, -0.08, 0.28]} scale={[1, 0.6, 0.5]}>
        <sphereGeometry args={[0.13, 12, 12]} />
        <meshStandardMaterial color="#e8897a" transparent opacity={0.28} roughness={1} depthWrite={false} />
      </mesh>
      <mesh position={[0.28, -0.08, 0.28]} scale={[1, 0.6, 0.5]}>
        <sphereGeometry args={[0.13, 12, 12]} />
        <meshStandardMaterial color="#e8897a" transparent opacity={0.28} roughness={1} depthWrite={false} />
      </mesh>

      {/* ── NECK (connects face to bottom edge) ───────────────── */}
      <mesh position={[0, -0.52, 0]}>
        <cylinderGeometry args={[0.22, 0.26, 0.28, 24]} />
        <meshStandardMaterial color={SKIN} roughness={0.85} />
      </mesh>
      {/* Shirt collar peek */}
      <mesh position={[0, -0.66, 0]}>
        <cylinderGeometry args={[0.30, 0.33, 0.14, 24]} />
        <meshStandardMaterial color="#e8e0d0" roughness={0.9} />
      </mesh>

      {/* ── FEDORA BRIM ───────────────────────────────────────── */}
      <mesh position={[0, 0.505, 0]}>
        <cylinderGeometry args={[0.64, 0.64, 0.055, 40]} />
        <meshStandardMaterial color={HAT} roughness={0.55} metalness={0.12} />
      </mesh>
      {/* slight brim tilt — front dips a touch */}
      <mesh position={[0, 0.500, 0.25]} rotation={[0.08, 0, 0]}>
        <cylinderGeometry args={[0.64, 0.64, 0.02, 40]} />
        <meshStandardMaterial color={HAT} roughness={0.55} metalness={0.12} />
      </mesh>

      {/* ── FEDORA CROWN ──────────────────────────────────────── */}
      <mesh position={[0, 0.825, 0]}>
        <cylinderGeometry args={[0.375, 0.415, 0.66, 40]} />
        <meshStandardMaterial color={HAT} roughness={0.55} metalness={0.12} />
      </mesh>

      {/* ── CROWN PINCH (top indent) ──────────────────────────── */}
      <mesh position={[0, 1.055, 0]}>
        <cylinderGeometry args={[0.315, 0.375, 0.082, 40]} />
        <meshStandardMaterial color="#080606" roughness={0.7} />
      </mesh>

      {/* ── HAT BAND (blue like the CSS version) ─────────────── */}
      <mesh position={[0, 0.548, 0]}>
        <cylinderGeometry args={[0.424, 0.424, 0.106, 40]} />
        <meshStandardMaterial
          color={BAND}
          roughness={0.45}
          emissive={BAND}
          emissiveIntensity={0.18}
        />
      </mesh>

    </group>
  )
}

// ── Exported wrapper — drop this wherever you need Perry ──────
export default function Perry3D() {
  return (
    <Canvas
      camera={{ position: [0, 0.22, 2.55], fov: 46 }}
      gl={{ alpha: true, antialias: true }}
      dpr={[1, 2]}
      style={{ width: '100%', height: '100%' }}
    >
      {/* Key light from upper-right front */}
      <directionalLight position={[2, 3, 3]}   intensity={1.1} />
      {/* Cool fill from left */}
      <directionalLight position={[-2, 0, 2]}  intensity={0.40} color="#aaccff" />
      {/* Warm under-fill so the chin isn't pitch black */}
      <pointLight       position={[0, -2, 2]}  intensity={0.30} color="#ffddaa" />
      {/* Ambient base */}
      <ambientLight intensity={0.50} />

      <PerryMesh />
    </Canvas>
  )
}
