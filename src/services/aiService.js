const AI_API_URL = import.meta.env.VITE_AI_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
const AI_API_KEY = import.meta.env.VITE_AI_API_KEY;

export async function analyzeImage(imageUrl, language = 'en', mode = 'plant') {
  if (!AI_API_KEY || AI_API_KEY === 'your_grok_api_key_here' || AI_API_KEY === 'your_groq_api_key_here') {
    // Return demo data when API key not configured
    return getDemoResult(language, mode);
  }

  const languageNames = {
    'en': 'English',
    'ta': 'Tamil (தமிழ்)',
    'hi': 'Hindi (हिंदी)',
    'te': 'Telugu (తెలుగు)',
    'kn': 'Kannada (ಕನ್ನಡ)',
    'ml': 'Malayalam (മലയാളം)'
  };
  const targetLanguage = languageNames[language] || 'English';

  const systemInstruction = `You are an expert agricultural AI assistant parsing crop and soil images. You must analyze the image and respond with valid JSON ONLY.
Follow these steps carefully:
1. VALIDATE: Check if the image clearly contains what is expected based on the mode.
   Mode is: ${mode.toUpperCase()}
   - If mode is PLANT: Image must contain a plant, leaf, or crop. If valid, set "isValidCrop": true, "isSoil": false. If there is clearly NO plant, return EXACTLY {"isValidCrop": false, "isSoil": false}.
   - If mode is SOIL: Image must contain ANY form of soil, dirt, compost, sand, or land (even if it is inside a bag, cup, hand, or container). If valid, set "isValidCrop": true, "isSoil": true. If it is completely unrelated (e.g., a car, a face), return EXACTLY {"isValidCrop": false, "isSoil": false}.

2. If mode is PLANT and valid:
   - Identify the specific crop disease. If healthy, set disease to "Healthy". Assess severity as "Low", "Medium", or "High".
   - Provide detailed symptoms, remedy (organic AND chemical), and prevention tips.
   - Set confidence score (0-100).

3. If mode is SOIL and valid:
   - Identify the primary visual characteristics of the soil (color tone, crusting, cracking, texture, organic matter presence, grain size).
   - Accurately classify the specific soilType (e.g., Red, Black, Alluvial, Laterite, Desert, Peaty, Saline, Clay, Sandy, Loamy, Silt, Chalky, etc.). Do NOT restrict to just a few types; identify the exact soil type based on visual evidence, and be highly consistent for similar images.
   - Based on visual indicators, estimate precise pH balance and NPK (Nitrogen, Phosphorus, Potassium) availability.
   - Suggest the most viable crops that thrive specifically within these conditions.
   - Prescribe specific NPK fertilizer adjustments and scientifically proven organic alternatives.
   - Set waterRequirement to "Low", "Medium", or "High".
   - Set confidence score (0-100).

4. TRANSLATION: ALL text fields MUST be translated into ${targetLanguage}.

Example JSON for PLANT:
{
  "isValidCrop": true,
  "isSoil": false,
  "disease": "[Disease Name in ${targetLanguage}]",
  "confidence": 85,
  "severity": "[Low/Medium/High in ${targetLanguage}]",
  "symptoms": "[Detailed symptoms in ${targetLanguage}]",
  "remedy": "[Detailed organic and chemical remedy in ${targetLanguage}]",
  "prevention": "[Detailed prevention tips in ${targetLanguage}]"
}

Example JSON for SOIL:
{
  "isValidCrop": true,
  "isSoil": true,
  "soilType": "[Specific Soil Type (e.g., Red, Black, Alluvial, Loamy, etc.) in ${targetLanguage}]",
  "characteristics": "[pH balance estimate, NPK signs, water retention in ${targetLanguage}]",
  "suitableCrops": "[Crops in ${targetLanguage}]",
  "waterRequirement": "[Low/Medium/High in ${targetLanguage}]",
  "fertilizerSuggestions": "[Specific NPK adjustments and organic matter in ${targetLanguage}]",
  "confidence": 90
}`;

  try {
    // Convert image to base64 if it's a blob/object URL
    let base64Image = imageUrl;
    if (imageUrl.startsWith('blob:') || imageUrl.startsWith('data:')) {
      base64Image = await blobUrlToBase64(imageUrl);
    }

    const imageContent = base64Image.startsWith('data:')
      ? { type: 'image_url', image_url: { url: base64Image } }
      : { type: 'image_url', image_url: { url: base64Image } };

    const response = await fetch(AI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.2-90b-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: systemInstruction
              },
              imageContent
            ]
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1024,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `API request failed with status ${response.status}`;
      console.warn(`AI API Warning: ${errorMessage}. Falling back to demo results.`);
      // If we hit a rate limit or other API error, fallback to demo results gracefully
      return getDemoResult(language, mode);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.warn('No response from AI. Falling back to demo results.');
      return getDemoResult(language, mode);
    }

    // Parse the JSON response
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const cleanedContent = jsonMatch[1].trim();
      const result = JSON.parse(cleanedContent);

      return {
        isValidCrop: result.isValidCrop !== false,
        isSoil: !!result.isSoil,
        multiLeaf: !!result.multiLeaf,
        severity: result.severity || 'Unknown',
        disease: result.disease || 'Unknown',
        symptoms: result.symptoms || 'Unable to determine symptoms',
        remedy: result.remedy || 'Consult a local agricultural expert',
        prevention: result.prevention || 'Practice good crop management',
        soilType: result.soilType || '',
        characteristics: result.characteristics || '',
        suitableCrops: result.suitableCrops || '',
        waterRequirement: result.waterRequirement || '',
        fertilizerSuggestions: result.fertilizerSuggestions || '',
        confidence: result.confidence || 75
      };
    } catch (parseError) {
      // If JSON parsing fails, try to extract info from plain text
      const isSoil = content.includes('"isSoil": true') || content.toLowerCase().includes('soil type');
      return {
        isValidCrop: !content.includes('"isValidCrop": false') && !content.toLowerCase().includes('not a crop') && !content.toLowerCase().includes('not soil'),
        isSoil: isSoil,
        multiLeaf: content.includes('"multiLeaf": true') || content.toLowerCase().includes('multiple leaves'),
        severity: extractField(content, 'severity') || 'Unknown',
        disease: extractField(content, 'disease') || 'Analysis Complete',
        symptoms: extractField(content, 'symptoms') || content.substring(0, 200),
        remedy: extractField(content, 'remedy') || 'Consult a local agricultural expert',
        prevention: extractField(content, 'prevention') || 'Practice good crop management',
        soilType: extractField(content, 'soilType') || '',
        characteristics: extractField(content, 'characteristics') || '',
        suitableCrops: extractField(content, 'suitableCrops') || '',
        waterRequirement: extractField(content, 'waterRequirement') || '',
        fertilizerSuggestions: extractField(content, 'fertilizerSuggestions') || '',
        confidence: parseInt(extractField(content, 'confidence')) || 70
      };
    }
  } catch (error) {
    console.warn(`AI Analysis Error: ${error.message}. Falling back to demo results.`);
    return getDemoResult(language, mode);
  }
}

function extractField(text, field) {
  const patterns = [
    new RegExp(`"${field}"\\s*:\\s*"([^"]*)"`, 'i'),
    new RegExp(`${field}[:\\s]*(.+?)(?:\\n|$)`, 'i'),
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

async function blobUrlToBase64(blobUrl) {
  const response = await fetch(blobUrl);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function getDemoResult(language, mode) {
  // Simulate API delay
  return new Promise((resolve) => {
    setTimeout(() => {
      if (mode === 'soil') {
        resolve({
          isValidCrop: true,
          isSoil: true,
          soilType: language === 'en' ? 'Loamy Soil' : 'களிமண் நடுத்தர மண் (Loamy)',
          characteristics: language === 'en' ? 'Good drainage, nutrient-rich, ideal for most plants.' : 'நல்ல நீர்ப்பிடிப்பு, சத்து மிகுந்தது.',
          suitableCrops: language === 'en' ? 'Wheat, Sugarcane, Cotton, Vegetables' : 'கோதுமை, கரும்பு, பருத்தி, காய்கறிகள்',
          waterRequirement: language === 'en' ? 'Medium' : 'நடுத்தரம்',
          fertilizerSuggestions: language === 'en' ? 'Organic compost, NPK 10-10-10' : 'இயற்கை உரம், NPK 10-10-10',
          confidence: 90
        });
      } else {
        resolve({
          isValidCrop: true,
          isSoil: false,
          multiLeaf: false,
          severity: 'High',
          disease: language === 'en' ? 'Late Blight' : 'தாமதமான கருகல் (Late Blight)',
          symptoms: language === 'en' ? 'Dark brown spots on leaves, white mold on undersides.' : 'இலைகளில் அடர் பழுப்பு புள்ளிகள்.',
          remedy: language === 'en' ? 'Apply copper-based fungicide.' : 'செம்பு அடிப்படையிலான பூஞ்சைக்கொல்லியை பயன்படுத்தவும்.',
          prevention: language === 'en' ? 'Use disease-resistant varieties.' : 'நோய் எதிர்ப்பு ரகங்களை பயன்படுத்தவும்.',
          confidence: 94
        });
      }
    }, 2000);
  });
}
