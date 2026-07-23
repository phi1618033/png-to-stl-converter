import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { Evaluator, SUBTRACTION, Brush } from 'three-bvh-csg';

export const buildGeometryFromSVG = (svgString, imageWidth, imageHeight, options) => {
  const { depth, dpi, textureMap } = options;
  
  const loader = new SVGLoader();
  const svgData = loader.parse(svgString);

  let largestShape = null;
  let maxArea = 0;

  // Find the largest contiguous shape
  svgData.paths.forEach((path) => {
    // Skip the white background path (transparent pixels from the mask)
    // imagetracerjs might not output perfectly #ffffff due to quantization, 
    // so we check if it's mostly white.
    if (path.color && path.color.r > 0.8 && path.color.g > 0.8 && path.color.b > 0.8) {
      return; 
    }

    // A path can generate multiple shapes
    const shapes = path.toShapes();
    shapes.forEach((shape) => {
      // Estimate area using bounding box
      const points = shape.getPoints();
      if (points.length === 0) return;
      
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      points.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      });
      
      const area = (maxX - minX) * (maxY - minY);
      if (area > maxArea) {
        maxArea = area;
        largestShape = shape;
      }
    });
  });

  if (!largestShape) {
    throw new Error('No valid shapes found in the image.');
  }

  // The depth in UI is in mm. Since we scale the mesh to mm later,
  // we must also specify extrusion depth in "pixel" space so it scales correctly.
  const scale = 25.4 / dpi; // pixels to mm
  
  const extrudeSettings = {
    depth: depth / scale,
    bevelEnabled: options.bevelEnabled || false,
  };

  if (options.bevelEnabled) {
    extrudeSettings.bevelThickness = (options.bevelThickness || 1) / scale;
    extrudeSettings.bevelSize = (options.bevelSize || 1) / scale;
    extrudeSettings.bevelOffset = (options.bevelOffset || 0) / scale;
    extrudeSettings.bevelSegments = options.bevelSegments || 3;
  }

  // Pass the shape directly to preserve true mathematical Bezier curves!
  let geometry = new THREE.ExtrudeGeometry(largestShape, extrudeSettings);
  
  // Convert to non-indexed so we can independently sort and fix every triangle
  if (geometry.index !== null) {
    geometry = geometry.toNonIndexed();
  }
  
  // If the user wants a Top Face Only bevel, we squash the bottom bevel perfectly flat.
  // The bottom bevel exists between Z=0 and Z=bevelThickness (in unscaled geometry space).
  if (options.bevelEnabled && options.topOnlyBevel) {
    const bottomZ = (options.bevelThickness || 1) / scale;
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getZ(i) < bottomZ) {
        pos.setZ(i, bottomZ);
      }
    }
  }

  // Scale the geometry to millimeter units.
  // We scale Y by -scale to fix the SVG upside-down mirroring (SVG Y goes down, Three Y goes up).
  // This physically mirrors the geometry so it is mathematically right-side up.
  geometry.scale(scale, -scale, scale);

  // --- Face Sorting & Z-Axis Planar UV Projection ---
  // We iterate through every triangle. Perfectly vertical faces (side walls) go to Group 1 (solid).
  // Everything else (flat faces, angled bevels) goes to Group 0 (textured).
  const pos = geometry.attributes.position;
  const topPos = [];
  const topUv = [];
  const sidePos = [];
  const sideUv = [];

  const pA = new THREE.Vector3();
  const pB = new THREE.Vector3();
  const pC = new THREE.Vector3();
  const cb = new THREE.Vector3();
  const ab = new THREE.Vector3();

  for (let i = 0; i < pos.count; i += 3) {
    pA.fromBufferAttribute(pos, i);
    // Read vertices in the corrected (reversed) winding order!
    pB.fromBufferAttribute(pos, i + 2);
    pC.fromBufferAttribute(pos, i + 1);

    cb.subVectors(pC, pB);
    ab.subVectors(pA, pB);
    cb.cross(ab);
    cb.normalize();

    // Now the computed normal correctly points OUTWARDS.
    // The top face points perfectly towards +Z (cb.z === 1).
    // The top bevels point partially towards +Z (0 < cb.z < 1).
    // The side walls are perfectly vertical (cb.z === 0).
    // The bottom face and bevels point towards -Z (cb.z < 0).
    // We want to texture the top face AND the top bevels!
    const isTopOrBevel = cb.z > 0.001;

    const destPos = isTopOrBevel ? topPos : sidePos;
    const destUv = isTopOrBevel ? topUv : sideUv;

    // Push the fixed winding order directly (A, B, C)
    destPos.push(pA.x, pA.y, pA.z);
    destUv.push(pA.x / (imageWidth * scale), 1.0 - (pA.y / (-imageHeight * scale)));
    
    destPos.push(pB.x, pB.y, pB.z);
    destUv.push(pB.x / (imageWidth * scale), 1.0 - (pB.y / (-imageHeight * scale)));
    
    destPos.push(pC.x, pC.y, pC.z);
    destUv.push(pC.x / (imageWidth * scale), 1.0 - (pC.y / (-imageHeight * scale)));
  }

  // Combine into single final buffers
  const finalPos = new Float32Array(topPos.length + sidePos.length);
  finalPos.set(topPos, 0);
  finalPos.set(sidePos, topPos.length);

  const finalUv = new Float32Array(topUv.length + sideUv.length);
  finalUv.set(topUv, 0);
  finalUv.set(sideUv, topUv.length);

  geometry.setAttribute('position', new THREE.BufferAttribute(finalPos, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(finalUv, 2));
  
  if (geometry.attributes.normal) {
    geometry.deleteAttribute('normal');
  }
  geometry.computeVertexNormals();

  // Create our two precise material groups
  geometry.clearGroups();
  geometry.addGroup(0, topPos.length / 3, 0); // Material 0: top & bevel
  geometry.addGroup(topPos.length / 3, sidePos.length / 3, 1); // Material 1: side walls
  
  // Center the geometry
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox;
  const centerX = (bbox.max.x + bbox.min.x) / 2;
  const centerY = (bbox.max.y + bbox.min.y) / 2;
  
  // Center X and Y, and shift Z so the absolute bottom face rests exactly at Z=0
  geometry.translate(-centerX, -centerY, -bbox.min.z);

  const materials = [];
  
  if (textureMap) {
    materials.push(new THREE.MeshPhysicalMaterial({ 
      map: textureMap, 
      color: 0xffffff, 
      roughness: options.matRoughness ?? 0.5,
      metalness: options.matMetalness ?? 0.1,
      clearcoat: options.matClearcoat ?? 0.0,
      sheen: options.matSheen ?? 0.0
    }));
  } else {
    materials.push(new THREE.MeshPhysicalMaterial({ 
      color: options.baseColor || 0xcccccc, 
      roughness: options.matRoughness ?? 0.5,
      metalness: options.matMetalness ?? 0.1,
      clearcoat: options.matClearcoat ?? 0.0,
      sheen: options.matSheen ?? 0.0
    }));
  }
  
  // Side material (uses solid color, ignores UVs)
  materials.push(new THREE.MeshPhysicalMaterial({ 
    color: options.baseColor || 0x999999, 
    roughness: options.matRoughness ?? 0.7,
    metalness: options.matMetalness ?? 0.1,
    clearcoat: options.matClearcoat ?? 0.0,
    sheen: options.matSheen ?? 0.0
  }));

  let mesh = new THREE.Mesh(geometry, materials);
  mesh.updateMatrixWorld();

  // --- CSG Magnet Recess Subtraction ---
  // We do the CSG before rotating the mesh, so it's perfectly in the unrotated geometry space (Z is "up" from the SVG plane).
  if (options.magnetEnabled && options.magnetDiameter > 0 && options.magnetDepth > 0) {
    // We need the physical width and height to calculate the percentage-based offset
    mesh.geometry.computeBoundingBox();
    const bbox = mesh.geometry.boundingBox;
    const width = bbox.max.x - bbox.min.x;
    const height = bbox.max.y - bbox.min.y;

    const offsetX = (options.magnetOffsetX || 0) / 100 * width;
    const offsetY = (options.magnetOffsetY || 0) / 100 * height;

    const radius = options.magnetDiameter / 2;
    const cylinderGeo = new THREE.CylinderGeometry(radius, radius, options.magnetDepth, 32);
    
    // CylinderGeometry goes along Y axis by default, centered at origin.
    // Rotate to go along Z axis.
    cylinderGeo.rotateX(Math.PI / 2);
    // Translate so its base is exactly at Z=0, going to Z=magnetDepth, with the user's percentage X/Y offsets.
    cylinderGeo.translate(offsetX, offsetY, options.magnetDepth / 2);

    const meshBrush = new Brush(mesh.geometry, materials);
    meshBrush.updateMatrixWorld();

    const cylinderBrush = new Brush(cylinderGeo, materials[1]);
    cylinderBrush.updateMatrixWorld();

    const evaluator = new Evaluator();
    evaluator.useGroups = true; // Preserve multi-materials perfectly!
    
    // Replace the mesh with the subtracted result
    mesh = evaluator.evaluate(meshBrush, cylinderBrush, SUBTRACTION);
  }

  // Rotate the mesh so it lays flat on the XZ ground plane.
  // -90 degrees around X makes the SVG +Y axis point away from the camera (-Z),
  // and the extrusion +Z axis point up (+Y).
  mesh.rotation.x = -Math.PI / 2;
  mesh.updateMatrixWorld();

  // Calculate stats (anchors instead of interpolated points)
  let svgPoints = largestShape.curves.length;
  if (largestShape.holes) {
    largestShape.holes.forEach(hole => {
      svgPoints += hole.curves.length;
    });
  }
  
  const triangles = geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
  
  const stats = {
    width: (bbox.max.x - bbox.min.x).toFixed(2),
    height: (bbox.max.y - bbox.min.y).toFixed(2),
    depth: depth.toFixed(2),
    svgPoints: svgPoints,
    triangles: triangles,
    generatedDpi: options.dpi,
    imageWidth: imageWidth,
    imageHeight: imageHeight
  };

  return { mesh, stats };
};
