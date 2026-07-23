import ImageTracer from 'imagetracerjs';

export const processImageToSVG = (imageElement, tracerOptions) => {
  return new Promise((resolve) => {
    const width = imageElement.naturalWidth;
    const height = imageElement.naturalHeight;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    // Apply blur if requested
    if (tracerOptions.canvasBlur && tracerOptions.canvasBlur > 0) {
      ctx.filter = `blur(${tracerOptions.canvasBlur}px)`;
    }

    // Draw original image
    ctx.drawImage(imageElement, 0, 0);
    const originalImageData = ctx.getImageData(0, 0, width, height);
    
    const maskImageData = new ImageData(width, height);
    
    // 1. Initial Thresholding
    const isSolidArr = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
      isSolidArr[i] = originalImageData.data[i * 4 + 3] > 127 ? 1 : 0;
    }

    // 2. Choke/Spread using Distance Transform
    const choke = tracerOptions.choke || 0;
    if (choke !== 0) {
      const dist = new Float32Array(width * height);
      const INF = 999999;

      // Initialize distances
      for (let i = 0; i < width * height; i++) {
        if (choke > 0) {
          dist[i] = isSolidArr[i] ? 0 : INF;
        } else {
          dist[i] = !isSolidArr[i] ? 0 : INF;
        }
      }

      // Pass 1: Top-Left to Bottom-Right
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = y * width + x;
          if (dist[i] > 0) {
            let minD = dist[i];
            if (x > 0) minD = Math.min(minD, dist[i - 1] + 1);
            if (y > 0) minD = Math.min(minD, dist[i - width] + 1);
            if (x > 0 && y > 0) minD = Math.min(minD, dist[i - width - 1] + 1.414);
            if (x < width - 1 && y > 0) minD = Math.min(minD, dist[i - width + 1] + 1.414);
            dist[i] = minD;
          }
        }
      }

      // Pass 2: Bottom-Right to Top-Left
      for (let y = height - 1; y >= 0; y--) {
        for (let x = width - 1; x >= 0; x--) {
          const i = y * width + x;
          let minD = dist[i];
          if (x < width - 1) minD = Math.min(minD, dist[i + 1] + 1);
          if (y < height - 1) minD = Math.min(minD, dist[i + width] + 1);
          if (x < width - 1 && y < height - 1) minD = Math.min(minD, dist[i + width + 1] + 1.414);
          if (x > 0 && y < height - 1) minD = Math.min(minD, dist[i + width - 1] + 1.414);
          dist[i] = minD;
        }
      }

      // Apply threshold to eroded/dilated mask
      const c = Math.abs(choke);
      for (let i = 0; i < width * height; i++) {
        if (choke > 0) {
          isSolidArr[i] = dist[i] <= c ? 1 : 0;
        } else {
          isSolidArr[i] = dist[i] > c ? 1 : 0;
        }
      }
    }

    // 3. Write back to ImageData
    for (let i = 0; i < width * height; i++) {
      const isSolid = isSolidArr[i];
      maskImageData.data[i * 4] = isSolid ? 0 : 255;
      maskImageData.data[i * 4 + 1] = isSolid ? 0 : 255;
      maskImageData.data[i * 4 + 2] = isSolid ? 0 : 255;
      maskImageData.data[i * 4 + 3] = 255;
    }

    const options = {
      ltres: tracerOptions.ltres,
      qtres: tracerOptions.qtres,
      pathomit: tracerOptions.pathomit,
      colorsampling: 0,
      numberofcolors: 2,
      mincolorratio: 0,
      colorquantcycles: 1,
      blurradius: tracerOptions.blurradius,
      blurdelta: tracerOptions.blurdelta
    };

    // imagetracerjs expects an object with {width, height, data} or an image URL. 
    // Wait, imagetracerjs can take imagedata directly in its imagedataToSVG method.
    const svgString = ImageTracer.imagedataToSVG(maskImageData, options);
    
    resolve(svgString);
  });
};
