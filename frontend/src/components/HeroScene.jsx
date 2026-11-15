import { Canvas, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import gsap from 'gsap'

function Document({ position, rotation, color, accent }) {
  const group = useRef(null)
  const { invalidate } = useThree()
  useEffect(() => {
    const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } })
    timeline.fromTo(group.current.position, { y: position[1] - .35 }, { y: position[1], duration: 1.2, onUpdate: invalidate })
    return () => timeline.kill()
  }, [invalidate, position])
  return <group ref={group} position={position} rotation={rotation}>
    <mesh><boxGeometry args={[2.8, 3.65, .1]} /><meshStandardMaterial color={color} roughness={.9} /></mesh>
    <mesh position={[-.7, .95, .06]}><boxGeometry args={[1.2, .08, .03]} /><meshStandardMaterial color={accent} /></mesh>
    <mesh position={[-.45, .55, .06]}><boxGeometry args={[1.7, .045, .03]} /><meshStandardMaterial color="#aab5ad" /></mesh>
    <mesh position={[-.45, .25, .06]}><boxGeometry args={[1.7, .045, .03]} /><meshStandardMaterial color="#aab5ad" /></mesh>
    <mesh position={[-.1, -.18, .06]}><boxGeometry args={[1.05, .2, .03]} /><meshStandardMaterial color={accent} /></mesh>
  </group>
}

function Scene() {
  return <>
    <color attach="background" args={['#153d35']} />
    <ambientLight intensity={1.6} />
    <directionalLight position={[4, 6, 6]} intensity={2.4} color="#fff1df" />
    <pointLight position={[-4, -2, 4]} intensity={18} color="#e35a39" distance={10} />
    <Document position={[-1.15, .1, 0]} rotation={[.18, .38, -.1]} color="#fffaf1" accent="#e35a39" />
    <Document position={[1.2, -.15, -.55]} rotation={[-.12, -.48, .1]} color="#d9e4d9" accent="#153d35" />
    <mesh position={[0, 0, -1.2]} rotation={[0, 0, 0]}><torusGeometry args={[2.5, .025, 12, 96]} /><meshStandardMaterial color="#efb294" emissive="#efb294" emissiveIntensity={.4} /></mesh>
  </>
}

export default function HeroScene() {
  return <div className="hero-scene" aria-label="Illustrative 3D resume and role analysis">
    <Canvas dpr={[1, 1.5]} frameloop="demand" gl={{ antialias: true, powerPreference: 'high-performance' }} camera={{ position: [0, 0, 7], fov: 38 }}>
      <Scene />
    </Canvas>
  </div>
}
