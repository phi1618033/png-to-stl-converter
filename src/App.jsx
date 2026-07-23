import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as THREE from 'three';
import { Layers } from 'lucide-react';
import UploadArea from './components/UploadArea';
import Controls from './components/Controls';
import Preview3D from './components/Preview3D';
import { processImageToSVG } from './utils/imageProcessor';
import { buildGeometryFromSVG } from './utils/geometryBuilder';
import { exportToSTL } from './utils/stlExporter';
import './index.css';

export default function App() {
  const [image, setImage] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [textureMap, setTextureMap] = useState(null);
  const [mesh, setMesh] = useState(null);
  const [stats, setStats] = useState(null);
  const [svgData, setSvgData] = useState(null);
  
  const [ltres, setLtres] = useState(4);
  const [qtres, setQtres] = useState(3);
  const [pathomit, setPathomit] = useState(8);
  const [blurradius, setBlurradius] = useState(0);
  const [blurdelta, setBlurdelta] = useState(20);
  const [canvasBlur, setCanvasBlur] = useState(10);
  const [choke, setChoke] = useState(0);
  
  const [depth, setDepth] = useState(5);
  const [dpi, setDpi] = useState(72);
  const [baseColor, setBaseColor] = useState('#999999');
  const [borderColor, setBorderColor] = useState('#ffffff');
  
  const [bevelEnabled, setBevelEnabled] = useState(false);
  const [topOnlyBevel, setTopOnlyBevel] = useState(true);
  const [bevelThickness, setBevelThickness] = useState(1);
  const [bevelSize, setBevelSize] = useState(1);
  const [bevelOffset, setBevelOffset] = useState(0);
  const [bevelSegments, setBevelSegments] = useState(3);
  
  const [magnetEnabled, setMagnetEnabled] = useState(false);
  const [magnetDiameter, setMagnetDiameter] = useState(10);
  const [magnetDepth, setMagnetDepth] = useState(2);
  const [magnetOffsetX, setMagnetOffsetX] = useState(0);
  const [magnetOffsetY, setMagnetOffsetY] = useState(0);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const isFirstUploadRef = useRef(false);

  const handleImageUpload = (img, url) => {
    isFirstUploadRef.current = true;
    setImage(img);
    setImageUrl(url);
  };

  useEffect(() => {
    if (!image) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    
    // Fill with border color
    ctx.fillStyle = borderColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw original image on top
    ctx.drawImage(image, 0, 0);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    setTextureMap(texture);
  }, [image, borderColor]);

  // 1. Trace SVG (Heavy, only runs when tracer parameters change)
  useEffect(() => {
    if (!image) return;
    let isMounted = true;
    
    const trace = async () => {
      setIsProcessing(true);
      // Small delay to allow React to paint the loading spinner
      await new Promise(resolve => setTimeout(resolve, 50));
      
      try {
        const svgString = await processImageToSVG(image, { ltres, qtres, pathomit, blurradius, blurdelta, canvasBlur, choke });
        if (isMounted) setSvgData(svgString);
      } catch (error) {
        console.error("Error generating SVG:", error);
        if (isMounted) alert("Error processing image. Please try a different one.");
      } finally {
        if (isMounted) setIsProcessing(false);
      }
    };
    
    const timer = setTimeout(trace, 300);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [image, ltres, qtres, pathomit, blurradius, blurdelta, canvasBlur, choke]);

  // 2. Build Mesh (Lightweight, runs instantly when depth, dpi, colors, or SVG change)
  useEffect(() => {
    if (!svgData || !textureMap) return;
    
    try {
      const { mesh: generatedMesh, stats: generatedStats } = buildGeometryFromSVG(
        svgData, 
        image.naturalWidth, 
        image.naturalHeight, 
        { 
          depth, dpi, textureMap, baseColor, 
          bevelEnabled, topOnlyBevel, bevelThickness, bevelSize, bevelOffset, bevelSegments,
          magnetEnabled, magnetDiameter, magnetDepth, magnetOffsetX, magnetOffsetY
        }
      );
      
      // Auto-calibrate DPI on first upload to perfectly hit 100mm Target Width
      if (isFirstUploadRef.current) {
        isFirstUploadRef.current = false;
        const unscaledWidth = generatedStats.width / (25.4 / dpi);
        if (unscaledWidth > 0) {
          const exactDpi = (unscaledWidth * 25.4) / 100.0;
          // Set DPI and bail out of setting the current mesh.
          // React will instantly re-run this effect with the perfect exactDpi.
          setDpi(Math.max(1, Math.min(exactDpi, 10000)));
          return;
        }
      }
      
      setMesh(generatedMesh);
      setStats(generatedStats);
    } catch (error) {
      console.error("Error building geometry:", error);
    }
  }, [
    svgData, textureMap, depth, dpi, baseColor, image, 
    bevelEnabled, topOnlyBevel, bevelThickness, bevelSize, bevelOffset, bevelSegments,
    magnetEnabled, magnetDiameter, magnetDepth, magnetOffsetX, magnetOffsetY
  ]);

  const handleExport = () => {
    if (!mesh) return;
    setIsExporting(true);
    try {
      exportToSTL(mesh, 'extruded_silhouette.stl');
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSVG = () => {
    if (!svgData) return;
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'traced_silhouette.svg';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>PNG to STL Converter</h1>
        <p>Turn any PNG into a 3D printable STL instantly.</p>
      </header>

      <main className="main-content">
        <aside className="sidebar panel">
          <UploadArea onImageUpload={handleImageUpload} />
          
          {image && (
            <div style={{ marginTop: '2rem' }}>
              <Controls 
                ltres={ltres} setLtres={setLtres}
                qtres={qtres} setQtres={setQtres}
                pathomit={pathomit} setPathomit={setPathomit}
                blurradius={blurradius} setBlurradius={setBlurradius}
                blurdelta={blurdelta} setBlurdelta={setBlurdelta}
                canvasBlur={canvasBlur} setCanvasBlur={setCanvasBlur}
                choke={choke} setChoke={setChoke}
                depth={depth} setDepth={setDepth}
                dpi={dpi} setDpi={setDpi}
                bevelEnabled={bevelEnabled} setBevelEnabled={setBevelEnabled}
                topOnlyBevel={topOnlyBevel} setTopOnlyBevel={setTopOnlyBevel}
                bevelThickness={bevelThickness} setBevelThickness={setBevelThickness}
                bevelSize={bevelSize} setBevelSize={setBevelSize}
                bevelOffset={bevelOffset} setBevelOffset={setBevelOffset}
                bevelSegments={bevelSegments} setBevelSegments={setBevelSegments}
                magnetEnabled={magnetEnabled} setMagnetEnabled={setMagnetEnabled}
                magnetDiameter={magnetDiameter} setMagnetDiameter={setMagnetDiameter}
                magnetDepth={magnetDepth} setMagnetDepth={setMagnetDepth}
                magnetOffsetX={magnetOffsetX} setMagnetOffsetX={setMagnetOffsetX}
                magnetOffsetY={magnetOffsetY} setMagnetOffsetY={setMagnetOffsetY}
                imageWidth={image.naturalWidth}
                baseColor={baseColor} setBaseColor={setBaseColor}
                borderColor={borderColor} setBorderColor={setBorderColor}
                onExport={handleExport}
                onExportSVG={handleExportSVG}
                isExporting={isExporting}
                stats={stats}
              />
            </div>
          )}
        </aside>

        <section className="preview-container">
          {isProcessing && (
            <div className="loading-overlay">
              <div className="spinner"></div>
              <div>Generating 3D Model...</div>
            </div>
          )}
          
          {mesh ? (
            <Preview3D mesh={mesh} />
          ) : (
            <div className="empty-state">
              <Layers size={64} />
              <h2>No Image Uploaded</h2>
              <p>Upload a PNG to see the 3D preview here.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
