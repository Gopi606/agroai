function evaluateColor(r, g, b) {
  // Plant Logic
  if (g > r + 30 && g > b + 30) return 'green'; // Healthy
  if (r > 150 && g > 150 && b < 100) return 'yellow'; // Deficiency
  if (r > 100 && g < 100 && b < 100) return 'spots'; // Disease (Spots)
  return 'unknown';
}

function analyzeSoilColor(r, g, b) {
  // Soil Logic
  const brightness = (r + g + b) / 3;
  if (brightness > 140) return 'Sandy'; // Light
  if (brightness < 80) return 'Clay';   // Dark
  return 'Loamy';                       // Mixed
}

export async function validateInput(imageUrl, mode) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const allImageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let greenPixels = 0;
      let brownOrSoilPixels = 0;

      let sampledCount = 0;
      for (let i = 0; i < allImageData.length; i += 16) {
        let r = allImageData[i];
        let g = allImageData[i+1];
        let b = allImageData[i+2];
        sampledCount++;

        // Green plant layout & shape check abstract
        if (g > r + 10 && g > b + 10) {
          greenPixels++;
        }

        // Soil texture/brownish color
        if ((r > g && g > b && r < 200 && r > 40) ||
            (r > 120 && g > 120 && b > 80 && Math.abs(r-g) < 30) ||
            (r < 80 && g < 80 && b < 80)) {
           brownOrSoilPixels++;
        }
      }

      const invalidPayload = {
        isValidCrop: false,
        isSoil: false,
        type: 'invalid',
        message: 'Invalid input. Please show plant or soil clearly',
        disease: 'Detection failed'
      };

      if (mode === 'plant') {
        if (greenPixels / sampledCount >= 0.10) {
          resolve({ isValidCrop: true });
        } else {
          resolve(invalidPayload);
        }
      } else {
        if (brownOrSoilPixels / sampledCount >= 0.10) {
          resolve({ isValidCrop: true, isSoil: true });
        } else {
          resolve(invalidPayload);
        }
      }
    };
    img.onerror = () => {
      resolve({
        isValidCrop: false,
        isSoil: false,
        type: 'invalid',
        message: 'Invalid input. Please show plant or soil clearly',
        disease: 'Detection failed'
      });
    };
    img.src = imageUrl;
  });
}

export async function processLocally(imageUrl, language, mode) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      if (mode === 'plant') {
        let healthyCount = 0;
        let diseasedCount = 0;
        let diseaseTypes = new Set();
        let remedies = new Set();

        const regionW = Math.floor(canvas.width / 2);
        const regionH = Math.floor(canvas.height / 2);

        for (let row = 0; row < 2; row++) {
          for (let col = 0; col < 2; col++) {
             const imageData = ctx.getImageData(col * regionW, row * regionH, regionW, regionH).data;
             let rSum = 0, gSum = 0, bSum = 0, count = 0;
             for (let i = 0; i < imageData.length; i += 16) {
               rSum += imageData[i];
               gSum += imageData[i+1];
               bSum += imageData[i+2];
               count++;
             }
             const colorType = evaluateColor(rSum/count, gSum/count, bSum/count);
             if (colorType === 'green') {
               healthyCount++;
             } else if (colorType !== 'unknown') {
               diseasedCount++;
               if (colorType === 'yellow') {
                 diseaseTypes.add('Deficiency');
                 remedies.add('Add required nutrients');
               } else if (colorType === 'spots') {
                 diseaseTypes.add('Disease detected (Spots)');
                 remedies.add('Apply appropriate treatment for spots');
               }
             }
          }
        }

        let diseaseStr = diseaseTypes.size > 0 ? Array.from(diseaseTypes).join(', ') : 'Healthy';
        let remedyStr = remedies.size > 0 ? Array.from(remedies).join('. ') : 'Ensure proper watering and sunlight';
        
        let symptomsStr = 'Green healthy foliage detected.';
        let isMulti = healthyCount > 0 && diseasedCount > 0;
        if (isMulti) {
          symptomsStr = 'Some leaves are healthy, some show disease';
        } else if (diseasedCount > 0) {
          symptomsStr = 'Multiple regions show signs of disease (' + diseaseStr + ').';
        }

        resolve({
          isValidCrop: true,
          isSoil: false,
          multiLeaf: isMulti,
          crop: 'Approx. Crop',
          disease: diseaseStr,
          severity: diseasedCount > 2 ? 'High' : diseasedCount > 0 ? 'Medium' : 'Low',
          symptoms: symptomsStr,
          remedy: remedyStr,
          prevention: 'Maintain balanced soil nutrients and proper watering.',
          confidence: 65,
          soilType: '',
          characteristics: '',
          suitableCrops: '',
          waterRequirement: '',
          fertilizerSuggestions: '',
          isLocal: true,
          healthyCrops: healthyCount > 0,
          diseasedCrops: diseasedCount > 0
        });

      } else {
        // Soil Mode
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let rSum = 0, gSum = 0, bSum = 0, count = 0;
        for (let i = 0; i < imageData.length; i += 16) {
          rSum += imageData[i];
          gSum += imageData[i+1];
          bSum += imageData[i+2];
          count++;
        }
        const soilType = analyzeSoilColor(rSum/count, gSum/count, bSum/count);
        
        resolve({
          isValidCrop: true,
          isSoil: true,
          multiLeaf: false,
          crop: 'N/A',
          disease: 'Healthy',
          severity: 'Low',
          symptoms: 'Soil detected successfully.',
          remedy: 'N/A',
          prevention: 'N/A',
          confidence: 75,
          soilType: `${soilType} Soil`,
          characteristics: `Typical of ${soilType} soil.`,
          suitableCrops: soilType === 'Sandy' ? 'Potatoes, Carrots' : soilType === 'Clay' ? 'Rice, Broccoli' : 'Wheat, Cotton',
          waterRequirement: soilType === 'Sandy' ? 'High' : soilType === 'Clay' ? 'Low' : 'Medium',
          fertilizerSuggestions: 'Balance NPK based on target crop',
          isLocal: true,
          healthyCrops: false,
          diseasedCrops: false
        });
      }
    };
    img.onerror = () => {
      resolve({
        isValidCrop: false,
        isSoil: false,
        crop: 'Unknown',
        disease: 'Detection failed',
        symptoms: 'Image could not be reliably processed.',
        remedy: '',
        confidence: 0
      });
    };
    img.src = imageUrl;
  });
}
