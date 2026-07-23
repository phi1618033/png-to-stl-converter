import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';

function LazyNumberInput({ value, onChange, ...props }) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleBlur = () => {
    onChange(localValue);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      onChange(localValue);
      e.target.blur();
    }
  };

  return (
    <input
      type="number"
      {...props}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
}

export default function Controls({ 
  ltres, setLtres,
  qtres, setQtres,
  pathomit, setPathomit,
  blurradius, setBlurradius,
  blurdelta, setBlurdelta,
  canvasBlur, setCanvasBlur,
  choke, setChoke,
  depth, setDepth, 
  dpi, setDpi, 
  bevelEnabled, setBevelEnabled,
  topOnlyBevel, setTopOnlyBevel,
  bevelThickness, setBevelThickness,
  bevelSize, setBevelSize,
  bevelOffset, setBevelOffset,
  bevelSegments, setBevelSegments,
  magnetEnabled, setMagnetEnabled,
  magnetDiameter, setMagnetDiameter,
  magnetDepth, setMagnetDepth,
  magnetOffsetX, setMagnetOffsetX,
  magnetOffsetY, setMagnetOffsetY,
  imageWidth,
  baseColor, setBaseColor,
  borderColor, setBorderColor,
  onExport, 
  onExportSVG,
  isExporting,
  stats
}) {
  // Calculate the raw pixel width of the traced bounding box
  // This is completely independent of DPI scale, but respects blur and choke!
  const unscaledWidth = stats ? stats.width / (25.4 / stats.generatedDpi) : 0;
  
  // Calculate current physical width at the currently selected DPI slider value
  // This allows the slider to instantly update even before the mesh finishes regenerating
  const currentWidthMm = unscaledWidth ? (unscaledWidth * (25.4 / dpi)).toFixed(2) : 0;
  
  const handleWidthChange = (val) => {
    const targetWidth = parseFloat(val);
    if (targetWidth > 0 && unscaledWidth > 0) {
      // Don't round here, keep floating point precision so we can hit exactly 100.0mm
      const newDpi = (unscaledWidth * 25.4) / targetWidth;
      setDpi(Math.max(0.1, Math.min(newDpi, 10000))); // keep it bounded
    }
  };

  return (
    <div className="controls-container">
      {stats && (
        <div className="control-group" style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
          <div className="control-header" style={{ marginBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <label className="control-label" style={{ color: 'var(--accent-color)' }}>Model Stats</label>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div><strong>Image:</strong> {stats.imageWidth} &times; {stats.imageHeight} px</div>
            <div><strong>Triangles:</strong> {stats.triangles.toLocaleString()}</div>
            <div><strong>Width:</strong> {stats.width} mm</div>
            <div><strong>Height:</strong> {stats.height} mm</div>
            <div><strong>Depth:</strong> {stats.depth} mm</div>
            <div><strong>SVG Points:</strong> {stats.svgPoints}</div>
          </div>
        </div>
      )}

      <div className="control-group">
        <div className="control-header">
          <label className="control-label">Canvas Pre-Blur (px)</label>
          <span className="control-value">{canvasBlur}</span>
        </div>
        <input 
          type="range" min="0" max="50" step="1" 
          value={canvasBlur} 
          onChange={(e) => setCanvasBlur(parseInt(e.target.value))} 
        />
      </div>

      <div className="control-group">
        <div className="control-header">
          <label className="control-label">Choke / Spread (px)</label>
          <span className="control-value">{choke > 0 ? '+' : ''}{choke}</span>
        </div>
        <input 
          type="range" min="-50" max="50" step="1" 
          value={choke} 
          onChange={(e) => setChoke(parseInt(e.target.value))} 
        />
      </div>
      <details style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
        <summary style={{ cursor: 'pointer', fontWeight: '600', color: 'var(--text-primary)', outline: 'none', userSelect: 'none' }}>
          Tracer Detail Settings
        </summary>
        <div style={{ marginTop: '1.5rem' }}>
          <div className="control-group">
            <div className="control-header">
              <label className="control-label">Linear Tolerance (ltres)</label>
              <span className="control-value">{ltres}</span>
            </div>
            <input 
              type="range" min="0.1" max="10" step="0.1" 
              value={ltres} 
              onChange={(e) => setLtres(parseFloat(e.target.value))} 
            />
          </div>

          <div className="control-group">
            <div className="control-header">
              <label className="control-label">Quadratic Tolerance (qtres)</label>
              <span className="control-value">{qtres}</span>
            </div>
            <input 
              type="range" min="0.1" max="10" step="0.1" 
              value={qtres} 
              onChange={(e) => setQtres(parseFloat(e.target.value))} 
            />
          </div>

          <div className="control-group">
            <div className="control-header">
              <label className="control-label">Noise Filter (pathomit)</label>
              <span className="control-value">{pathomit}</span>
            </div>
            <input 
              type="range" min="0" max="100" step="1" 
              value={pathomit} 
              onChange={(e) => setPathomit(parseInt(e.target.value))} 
            />
          </div>

          <div className="control-group">
            <div className="control-header">
              <label className="control-label">Blur Radius</label>
              <span className="control-value">{blurradius}</span>
            </div>
            <input 
              type="range" min="0" max="20" step="1" 
              value={blurradius} 
              onChange={(e) => setBlurradius(parseInt(e.target.value))} 
            />
          </div>

          <div className="control-group" style={{ marginBottom: 0 }}>
            <div className="control-header">
              <label className="control-label">Blur Delta</label>
              <span className="control-value">{blurdelta}</span>
            </div>
            <input 
              type="range" min="1" max="255" step="1" 
              value={blurdelta} 
              onChange={(e) => setBlurdelta(parseInt(e.target.value))} 
            />
          </div>
        </div>
      </details>

      <div className="control-group">
        <div className="control-header">
          <label className="control-label">Extrusion Depth (mm)</label>
          <span className="control-value">{depth}</span>
        </div>
        <input 
          type="range" min="1" max="50" step="1" 
          value={depth} 
          onChange={(e) => setDepth(parseInt(e.target.value))} 
        />
      </div>

      <div className="control-group" style={{ marginBottom: bevelEnabled ? '0.5rem' : '1.5rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: 'var(--text-primary)' }}>
          <input 
            type="checkbox" 
            checked={bevelEnabled}
            onChange={(e) => setBevelEnabled(e.target.checked)}
            style={{ marginRight: '0.5rem', width: '16px', height: '16px' }}
          />
          Enable Edge Bevel
        </label>
      </div>

      {bevelEnabled && (
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
          <div className="control-group" style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              <input 
                type="checkbox" 
                checked={topOnlyBevel}
                onChange={(e) => setTopOnlyBevel(e.target.checked)}
                style={{ marginRight: '0.5rem', width: '14px', height: '14px' }}
              />
              Top Face Only (Flat Bottom)
            </label>
          </div>
          <div className="control-group">
            <div className="control-header">
              <label className="control-label">Bevel Depth (mm)</label>
              <span className="control-value">{bevelThickness}</span>
            </div>
            <input 
              type="range" min="0.1" max="10" step="0.1" 
              value={bevelThickness} 
              onChange={(e) => setBevelThickness(parseFloat(e.target.value))} 
            />
          </div>

          <div className="control-group">
            <div className="control-header">
              <label className="control-label">Bevel Width (mm)</label>
              <span className="control-value">{bevelSize}</span>
            </div>
            <input 
              type="range" min="0" max="10" step="0.1" 
              value={bevelSize} 
              onChange={(e) => setBevelSize(parseFloat(e.target.value))} 
            />
          </div>

          <div className="control-group">
            <div className="control-header">
              <label className="control-label">Bevel Offset (mm)</label>
              <span className="control-value">{bevelOffset}</span>
            </div>
            <input 
              type="range" min="-5" max="5" step="0.1" 
              value={bevelOffset} 
              onChange={(e) => setBevelOffset(parseFloat(e.target.value))} 
            />
          </div>

          <div className="control-group" style={{ marginBottom: 0 }}>
            <div className="control-header">
              <label className="control-label">Bevel Smoothness (Segments)</label>
              <span className="control-value">{bevelSegments}</span>
            </div>
            <input 
              type="range" min="1" max="10" step="1" 
              value={bevelSegments} 
              onChange={(e) => setBevelSegments(parseInt(e.target.value))} 
            />
          </div>
        </div>
      )}

      {/* Magnet Recess Section */}
      <div className="control-group" style={{ marginBottom: magnetEnabled ? '0.5rem' : '1.5rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: 'var(--text-primary)' }}>
          <input 
            type="checkbox" 
            checked={magnetEnabled}
            onChange={(e) => setMagnetEnabled(e.target.checked)}
            style={{ marginRight: '0.5rem', width: '16px', height: '16px' }}
          />
          Enable Magnet Recess
        </label>
      </div>

      {magnetEnabled && (
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
          <div className="control-group">
            <div className="control-header">
              <label className="control-label">Magnet Diameter (mm)</label>
              <span className="control-value">{magnetDiameter.toFixed(1)}</span>
            </div>
            <input 
              type="range" 
              min="2" max="30" step="0.1" 
              value={magnetDiameter} 
              onChange={(e) => setMagnetDiameter(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div className="control-group">
            <div className="control-header">
              <label className="control-label">Magnet Depth (mm)</label>
              <span className="control-value">{magnetDepth.toFixed(1)}</span>
            </div>
            <input 
              type="range" 
              min="0.5" max={Math.max(1, depth - 0.5)} step="0.1" 
              value={magnetDepth} 
              onChange={(e) => setMagnetDepth(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div className="control-group">
            <div className="control-header">
              <label className="control-label">Offset X (%)</label>
              <span className="control-value">{magnetOffsetX > 0 ? '+' : ''}{magnetOffsetX.toFixed(1)}%</span>
            </div>
            <input 
              type="range" 
              min="-50" max="50" step="1" 
              value={magnetOffsetX} 
              onChange={(e) => setMagnetOffsetX(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div className="control-group" style={{ marginBottom: 0 }}>
            <div className="control-header">
              <label className="control-label">Offset Y (%)</label>
              <span className="control-value">{magnetOffsetY > 0 ? '+' : ''}{magnetOffsetY.toFixed(1)}%</span>
            </div>
            <input 
              type="range" 
              min="-50" max="50" step="1" 
              value={magnetOffsetY} 
              onChange={(e) => setMagnetOffsetY(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      )}

      <div className="control-group">
        <div className="control-header">
          <label className="control-label">Base DPI (Scale)</label>
          <LazyNumberInput 
            value={typeof dpi === 'number' ? parseFloat(dpi.toFixed(2)) : dpi} 
            onChange={(val) => setDpi(parseFloat(val) || 0.1)} 
            style={{ 
              width: '60px', 
              textAlign: 'right', 
              background: 'transparent', 
              color: 'var(--accent-color)', 
              border: '1px solid var(--border-color)', 
              borderRadius: '4px', 
              padding: '2px 4px',
              fontFamily: 'inherit',
              fontSize: 'inherit'
            }}
          />
        </div>
        <input 
          type="range" 
          min="1" 
          max="1440" 
          step="0.1"
          value={typeof dpi === 'number' ? dpi : 72} 
          onChange={(e) => setDpi(parseFloat(e.target.value))} 
        />
      </div>

      <div className="control-group">
        <div className="control-header">
          <label className="control-label">Target Width (mm)</label>
          <LazyNumberInput 
            value={currentWidthMm} 
            onChange={(val) => handleWidthChange(val)} 
            style={{ 
              width: '80px', 
              textAlign: 'right', 
              background: 'transparent', 
              color: 'var(--accent-color)', 
              border: '1px solid var(--border-color)', 
              borderRadius: '4px', 
              padding: '2px 4px',
              fontFamily: 'inherit',
              fontSize: 'inherit'
            }}
          />
        </div>
        <input 
          type="range" 
          min="1" 
          max="150" 
          step="1"
          value={Math.round(currentWidthMm)} 
          onChange={(e) => handleWidthChange(e.target.value)} 
        />
      </div>

      <div className="control-group">
        <div className="control-header">
          <label className="control-label">Base Color</label>
        </div>
        <input 
          type="color" 
          value={baseColor} 
          onChange={(e) => setBaseColor(e.target.value)} 
          style={{ width: '100%', height: '40px', cursor: 'pointer', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '8px' }}
        />
      </div>

      <div className="control-group">
        <div className="control-header">
          <label className="control-label">Border Color (Spread)</label>
        </div>
        <input 
          type="color" 
          value={borderColor} 
          onChange={(e) => setBorderColor(e.target.value)} 
          style={{ width: '100%', height: '40px', cursor: 'pointer', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '8px' }}
        />
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
        <button 
          className="btn btn-primary" 
          onClick={onExport}
          disabled={isExporting}
          style={{ flex: 1 }}
        >
          <Download size={20} />
          {isExporting ? 'Exporting...' : 'Export STL'}
        </button>
        
        <button 
          className="btn btn-primary" 
          onClick={onExportSVG}
          disabled={isExporting}
          style={{ flex: 1, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
        >
          <Download size={20} />
          SVG
        </button>
      </div>
    </div>
  );
}
