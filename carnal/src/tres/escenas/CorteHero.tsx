import { useEffect, useMemo, useRef } from 'react';
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { cortes } from '../../data';
import { env } from '../../lib/env';
import { marcarListo } from '../../lib/carga';
import { estado, progreso } from '../../lib/scroll';
import { amortigua, mezcla, suave } from '../../lib/mate';
import { piezaCorte } from '../geometria';
import { materialCarne, materialHueso } from '../materiales/carne';
import { usarToma } from '../usarToma';

/** Distancia de cámara para que un objeto de ~1.1 unidades ocupe `fraccion` del lado corto. */
function distanciaPara(fraccion: number, fov: number, aspecto: number) {
  const t = Math.tan(THREE.MathUtils.degToRad(fov / 2)) * 2;
  return Math.max(1.1 / (fraccion * t * aspecto), 0.9 / (fraccion * t));
}

// El corte del hero: el de mayor marmoleo de la colección.
const HEROE = [...cortes].sort((a, b) => b.bms - a.bms)[0];

/**
 * 2 · El corte. Un wagyu bajo una sola luz lateral dura (claroscuro). Gira con el scroll y la luz
 * lo recorre; al final se disuelve: la carne desaparece y quedan las vetas, que pasan a ser las
 * líneas del mapa de Orígenes.
 */
export function CorteHero() {
  const { escena, camara, aspecto } = usarToma('corte', 0, 26);
  const gl = useThree((s) => s.gl);
  const calidad = env.calidad;
  const rm = env.movimientoReducido;

  const pieza = useMemo(() => piezaCorte(HEROE.forma, 3, calidad), [calidad]);
  const material = useMemo(() => materialCarne(pieza, HEROE.bms, 3, calidad), [pieza, calidad]);
  const hueso = useMemo(() => (pieza.hueso ? materialHueso() : null), [pieza]);

  const giro = useRef<THREE.Group>(null);
  const inclinacion = useRef<THREE.Group>(null);
  const luz = useRef<THREE.SpotLight>(null);
  const relleno = useRef<THREE.DirectionalLight>(null);
  const ambiente = useRef<THREE.HemisphereLight>(null);
  const objetivo = useMemo(() => new THREE.Object3D(), []);
  const mirar = useMemo(() => new THREE.Vector3(), []);
  const suavizado = useRef({ p: 0 });

  // Compila los shaders mientras el umbral dibuja sus vetas; luego avisa al loader.
  useEffect(() => {
    let vivo = true;
    gl.compileAsync(escena, camara)
      .catch(() => undefined)
      .then(() => vivo && marcarListo('3d'));
    return () => {
      vivo = false;
    };
  }, [gl, escena, camara]);

  useFrame(() => {
    const h = estado.historia;
    if (h < 0.4 || h > 2.3) return;
    const s = suavizado.current;
    // Un poco de inercia extra: el corte nunca se mueve de golpe.
    s.p = amortigua(s.p, progreso('corte') + (h > 2 ? h - 2 : 0), rm ? 30 : 6, estado.dt);
    const p = s.p;
    const t = estado.tiempo;

    // Entrada desde la oscuridad del umbral.
    const presencia = suave(h, 0.5, 1.02);
    // Nace de sus vetas mientras se apaga el fuego del umbral, y al final vuelve a ellas.
    const disolver = rm ? 0 : Math.max(1 - suave(h, 0.52, 0.98), suave(h, 1.86, 2.17));
    material.uniforms.uDisolver.value = disolver;
    const apagar = rm ? 1 - suave(h, 1.86, 2.12) : 1;

    // Giro sobre su normal (como un disco) y una leve oscilación de la inclinación.
    if (giro.current) giro.current.rotation.z = rm ? 0.6 : 0.5 + p * 2.6 + t * 0.035;
    if (inclinacion.current) {
      inclinacion.current.rotation.x = -0.98 + (rm ? 0 : Math.sin(t * 0.21) * 0.035 + p * 0.12);
      inclinacion.current.rotation.y = rm ? 0 : Math.sin(t * 0.17) * 0.05 - 0.12 + p * 0.2;
    }

    // Cámara: del plano general al macro del marmoleo y de vuelta.
    const retrato = aspecto < 1;
    const lejos = distanciaPara(retrato ? 0.72 : 0.4, 26, aspecto);
    const cerca = distanciaPara(retrato ? 1.25 : 0.95, 26, aspecto);
    const acercar = rm ? 0.25 : suave(p, 0.12, 0.46) * (1 - 0.6 * suave(p, 0.72, 1.0));
    const dist = mezcla(lejos, cerca, acercar);
    const deriva = rm ? 0 : suave(p, 0.4, 0.8) * 0.22;
    camara.position.set(Math.sin(deriva) * dist, mezcla(0.5, 0.32, acercar) * (dist / 3), Math.cos(deriva) * dist);
    // En el plano general el corte queda bajo el wordmark (más abajo en vertical).
    const bajar = (1 - suave(p, 0.06, 0.3)) * dist * (retrato ? 0.035 : 0.085);
    mirar.set(0, bajar, 0);
    camara.lookAt(mirar);

    // La luz lo acaricia: barre desde rasante (izquierda) hacia más frontal.
    const ang = mezcla(-3.3, -2.2, rm ? 0.3 : suave(p, 0.05, 0.85)) + (rm ? 0 : Math.sin(t * 0.25) * 0.04);
    const elev = mezcla(0.9, 1.45, rm ? 0.3 : suave(p, 0.3, 0.9));
    if (luz.current) {
      luz.current.position.set(Math.cos(ang) * 3.2, elev, Math.sin(ang) * 3.2 * -1 + 0.4);
      luz.current.intensity = 85 * presencia * apagar;
    }
    if (relleno.current) relleno.current.intensity = 0.07 * presencia * apagar;
    if (ambiente.current) ambiente.current.intensity = 0.05 * presencia * apagar;
  });

  return createPortal(
    <>
      <group ref={inclinacion} position={[0, 0, 0]}>
        <group ref={giro}>
          <mesh geometry={pieza.geometria} material={material} castShadow receiveShadow />
          {pieza.hueso && hueso && <mesh geometry={pieza.hueso} material={hueso} castShadow receiveShadow />}
        </group>
      </group>
      <primitive object={objetivo} position={[0, 0, 0]} />
      <spotLight
        ref={luz}
        target={objetivo}
        color="#ffd6b0"
        angle={0.3}
        penumbra={0.75}
        decay={2}
        distance={0}
        castShadow={calidad === 'alta'}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.035}
        shadow-radius={5}
      />
      <directionalLight ref={relleno} color="#c9a28a" position={[2.5, 1.2, 2.2]} />
      <hemisphereLight ref={ambiente} args={['#3a2a24', '#0a0706']} />
    </>,
    escena,
  );
}
