import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

export default function Preview3D({ mesh, ambientIntensity = 0.8, directionalIntensity = 1.5, rectAreaIntensity = 5.0 }) {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const lastRadiusRef = useRef(null);
  const ambientLightRef = useRef(null);
  const directionalLightRef = useRef(null);
  const rectLightRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Initialize scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, ambientIntensity);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, directionalIntensity);
    directionalLight.position.set(10, 20, 10);
    scene.add(directionalLight);
    directionalLightRef.current = directionalLight;

    // Add thin RectAreaLight for reflections
    RectAreaLightUniformsLib.init();
    const rectLight = new THREE.RectAreaLight(0xffffff, rectAreaIntensity, 400, 10);
    // Bring it much closer to the object to cast a sharp reflection
    rectLight.position.set(0, 30, -30);
    rectLight.lookAt(0, 0, 0);
    scene.add(rectLight);
    rectLightRef.current = rectLight;

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight2.position.set(-10, -20, -10);
    scene.add(directionalLight2);

    // Add GridHelper (Ground plane)
    // Size: 10000 mm (10 meters)
    // Divisions: 1000 (10 mm / 1 cm per grid square)
    const gridHelper = new THREE.GridHelper(10000, 1000, 0x444444, 0x222222);
    gridHelper.position.y = 0; // Grid is exactly at Y=0
    scene.add(gridHelper);

    // Initialize camera
    const width = container.clientWidth;
    const height = container.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100000);
    // Position camera to look at the ground plane from an angle
    camera.position.set(0, 100, 100);
    cameraRef.current = camera;

    // Initialize renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Initialize controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    // Animation loop
    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (rendererRef.current && rendererRef.current.domElement && container) {
        if (container.contains(rendererRef.current.domElement)) {
          container.removeChild(rendererRef.current.domElement);
        }
      }
      renderer.dispose();
    };
  }, []);

  // Update light intensities dynamically
  useEffect(() => {
    if (ambientLightRef.current) {
      ambientLightRef.current.intensity = ambientIntensity;
    }
    if (directionalLightRef.current) {
      directionalLightRef.current.intensity = directionalIntensity;
    }
    if (rectLightRef.current) {
      rectLightRef.current.intensity = rectAreaIntensity;
    }
  }, [ambientIntensity, directionalIntensity, rectAreaIntensity]);

  // Update mesh when it changes
  useEffect(() => {
    if (!sceneRef.current || !mesh) return;

    // Remove existing meshes
    const objectsToRemove = sceneRef.current.children.filter(child => child.isMesh);
    objectsToRemove.forEach(obj => sceneRef.current.remove(obj));

    // Add new mesh
    sceneRef.current.add(mesh);

    // Adjust camera to fit mesh
    mesh.geometry.computeBoundingSphere();
    const sphere = mesh.geometry.boundingSphere;
    if (sphere && cameraRef.current && controlsRef.current) {
      const radius = sphere.radius;
      
      if (lastRadiusRef.current !== null && lastRadiusRef.current > 0) {
        // We have a previous radius. Adjust the existing camera position by the scale factor
        // This PERFECTLY preserves the user's viewing angle/perspective, while zooming in/out
        // just the right amount to keep the object centered and fitting the screen.
        const scaleFactor = radius / lastRadiusRef.current;
        cameraRef.current.position.multiplyScalar(scaleFactor);
      } else {
        // First load: reset to default perspective (looking down from an angle)
        cameraRef.current.position.set(0, radius * 1.5, radius * 2);
        cameraRef.current.lookAt(0, 0, 0);
      }
      
      lastRadiusRef.current = radius;
      
      // Update far clipping plane to always include the object
      cameraRef.current.far = Math.max(100000, radius * 10);
      cameraRef.current.updateProjectionMatrix();

      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [mesh]);

  return <div ref={containerRef} className="canvas-container" />;
}
