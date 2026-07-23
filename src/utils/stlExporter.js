import { STLExporter } from 'three/addons/exporters/STLExporter.js';

export const exportToSTL = (mesh, filename = 'extruded_shape.stl') => {
  const exporter = new STLExporter();
  
  // The exporter parses the mesh and its world matrix.
  // We can just pass the mesh directly if it's already in the scene, 
  // but to be safe, we make sure its matrices are updated.
  mesh.updateMatrixWorld(true);
  
  const stlString = exporter.parse(mesh);
  
  const blob = new Blob([stlString], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.style.display = 'none';
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
};
