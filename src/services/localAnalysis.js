function evaluateColor(r, g, b) {
  // Simple heuristic
  if (r > 200 && g > 200 && b > 200) return 'white'; // mildew
  if (r > 150 && g > 150 && b < 100) return 'yellow'; // nutrient deficiency
  if (r > 100 && g < 100 && b < 100) return 'brown'; // fungal
  if (g > r + 30 && g > b + 30) return 'green'; // healthy
  return 'unknown';
}

function analyzeSoilColor(r, g, b) {
  const brightness = (r + g + b) / 3;
  if (brightness > 160) return 'Sandy'; // light
  if (brightness < 90) return 'Clay'; // dark
  return 'Loamy'; // balanced
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
      let totalPixels = canvas.width * canvas.height;
      let greenPixels = 0;
      let brownOrSoilPixels = 0;

      // Sample every 16th byte (every 4th pixel) for speed
      let sampledCount = 0;
      for (let i = 0; i < allImageData.length; i += 16) {
        let r = allImageData[i];
        let g = allImageData[i+1];
        let b = allImageData[i+2];
        sampledCount++;

        // Green leaf check
        if (g > r + 10 && g > b + 10) {
          greenPixels++;
        }

        // Soil Texture/Color check (Brown/Earthy, Clay, Sand)
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
        message: 'Invalid input. Please show plant leaves or soil clearly.',
        disease: 'Detection failed',
        healthyCrops: false,
        diseasedCrops: false
      };

      if (mode === 'plant') {
        if (greenPixels / sampledCount >= 0.15) {
          resolve({ isValidCrop: true });
        } else {
          resolve(invalidPayload);
        }
      } else {
        if (brownOrSoilPixels / sampledCount >= 0.15) {
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
        message: 'Invalid input. Please show plant leaves or soil clearly.',
        disease: 'Detection failed',
        healthyCrops: false,
        diseasedCrops: false
      });
    };
    img.src = imageUrl;
  });
}

export async function processLocally(imageUrl, language, mode) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const targetLanguage = language === 'en' ? 'English' : 'your local language';

      if (mode === 'plant') {
        let healthyCount = 0;
        let diseasedCount = 0;
        let diseaseTypes = new Set();
        let remedies = new Set();

        // 4 regions (2x2 grid)
        const regionW = Math.floor(canvas.width / 2);
        const regionH = Math.floor(canvas.height / 2);

        for (let row = 0; row < 2; row++) {
          for (let col = 0; col < 2; col++) {
            const imageData = ctx.getImageData(col * regionW, row * regionH, regionW, regionH).data;
            let rSum = 0, gSum = 0, bSum = 0, count = 0;
            
            for (let i = 0; i < imageData.length; i += 16) { // sample every 4th pixel
              rSum += imageData[i];
              gSum += imageData[i+1];
              bSum += imageData[i+2];
              count++;
            }
            
            const rAvg = rSum / count;
            const gAvg = gSum / count;
            const bAvg = bSum / count;
            
            const colorType = evaluateColor(rAvg, gAvg, bAvg);
            
            if (colorType === 'green') {
              healthyCount++;
            } else if (colorType !== 'unknown') {
              diseasedCount++;
              if (colorType === 'yellow') {
                diseaseTypes.add('Nutrient deficiency');
                remedies.add('Add nitrogen-rich fertilizer');
              } else if (colorType === 'brown') {
                diseaseTypes.add('Fungal disease');
                remedies.add('Apply organic fungicide');
              } else if (colorType === 'white') {
                diseaseTypes.add('Mildew');
                remedies.add('Improve air circulation and apply neem oil');
              }
            }
          }
        }

        let diseaseStr = diseaseTypes.size > 0 ? Array.from(diseaseTypes).join(', ') : 'Healthy';
        let remedyStr = remedies.size > 0 ? Array.from(remedies).join('. ') : 'Ensure proper watering and sunlight';
        
        let symptomsStr = 'Green healthy foliage detected.';
        if (healthyCount > 0 && diseasedCount > 0) {
          symptomsStr = 'Some crops are healthy, some show issues. Diseased region detected, Healthy crops present.';
        } else if (diseasedCount > 0) {
          symptomsStr = 'Multiple regions show signs of disease (' + diseaseStr + ').';
        }

        resolve({
          isValidCrop: true,
          isSoil: false,
          multiLeaf: true,
          crop: 'Plant/Crop',
          disease: diseaseStr,
          severity: diseasedCount > 2 ? 'High' : diseasedCount > 0 ? 'Medium' : 'Low',
          symptoms: `[Using offline analysis mode] ${symptomsStr}`,
          remedy: remedyStr,
          prevention: 'Maintain balanced soil nutrients and proper watering.',
          confidence: 80,
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
        
        let waterReq = 'Medium';
        let crops = 'Wheat, Cotton, Soybeans';
        if (soilType === 'Sandy') {
          waterReq = 'High';
          crops = 'Potatoes, Carrots, Peanuts';
        } else if (soilType === 'Clay') {
          waterReq = 'Low';
          crops = 'Rice, Broccoli, Cabbage';
        }

        resolve({
          isValidCrop: true,
          isSoil: true,
          multiLeaf: false,
          crop: 'N/A',
          disease: 'Healthy',
          severity: 'Low',
          symptoms: '[Using offline analysis mode] Soil detected successfully.',
          remedy: 'N/A',
          prevention: 'N/A',
          confidence: 85,
          soilType: `${soilType} Soil`,
          characteristics: `Detected using offline metrics. Texture appears typical of ${soilType} soil.`,
          suitableCrops: crops,
          waterRequirement: waterReq,
          fertilizerSuggestions: 'Balance NPK based on target crop requirements.',
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
        symptoms: '[Using offline analysis mode] Image could not be safely processed locally.',
        remedy: 'Check camera lens and lighting.',
        prevention: '',
        confidence: 0,
        healthyCrops: false,
        diseasedCrops: false
      });
    };
    img.src = imageUrl;
  });
}
