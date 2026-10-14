import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { tomas } from './director';

/** Crea la escena y la cámara propias de una toma y la registra en el director. */
export function usarToma(id: string, orden: number, fov = 30) {
  const escena = useMemo(() => new THREE.Scene(), []);
  const camara = useMemo(() => new THREE.PerspectiveCamera(fov, 1, 0.05, 80), [fov]);
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    camara.aspect = size.width / Math.max(1, size.height);
    camara.updateProjectionMatrix();
  }, [camara, size.width, size.height]);

  useEffect(() => {
    tomas.set(id, { id, escena, camara, orden });
    // Las escenas se montan antes de verse: compilar sus shaders ya, sin bloquear el scroll
    // (en paralelo donde el navegador lo permite).
    gl.compileAsync(escena, camara).catch(() => undefined);
    return () => {
      tomas.delete(id);
    };
  }, [id, escena, camara, orden, gl]);

  return { escena, camara, aspecto: size.width / Math.max(1, size.height) };
}
