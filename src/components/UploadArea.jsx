import React, { useCallback, useState } from 'react';
import { Upload } from 'lucide-react';

export default function UploadArea({ onImageUpload }) {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file) => {
    if (file && file.type === 'image/png') {
      const url = URL.createObjectURL(file);
      
      const img = new Image();
      img.onload = () => {
        onImageUpload(img, url);
      };
      img.src = url;
    } else {
      alert("Please upload a PNG file.");
    }
  };

  return (
    <div 
      className={`upload-area ${dragActive ? 'drag-active' : ''}`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => document.getElementById('file-upload').click()}
    >
      <Upload size={48} className="upload-icon" />
      <div className="upload-text">Click to upload or drag and drop</div>
      <div className="upload-subtext">PNG files only (alpha channel will be traced)</div>
      <input 
        id="file-upload" 
        type="file" 
        accept=".png" 
        style={{ display: 'none' }} 
        onChange={handleChange} 
      />
    </div>
  );
}
