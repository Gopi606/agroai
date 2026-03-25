const AI_API_URL = import.meta.env.VITE_AI_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
const AI_API_KEY = import.meta.env.VITE_AI_API_KEY;

export async function analyzeImage(imageUrl, language = 'en', mode = 'plant') {
  if (!AI_API_KEY || AI_API_KEY === 'your_grok_api_key_here' || AI_API_KEY === 'your_groq_api_key_here') {
    throw new Error('Detection failed (API key missing)');
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
   - Identify the specific plant/crop name (e.g. Tomato, Corn) and output it as "crop".
   - Identify the specific crop disease. If healthy, set disease to "Healthy". Assess severity as "Low", "Medium", or "High".
   - Detect if multiple leaves exist in the image. If true, set "multiLeaf": true and focus on the center region OR largest leaf.
   - Provide detailed symptoms, remedy (organic AND chemical), and prevention tips.
   - Set confidence score (0-100).

3. If mode is SOIL and valid:
   - Identify the primary visual characteristics of the soil (color tone, crusting, cracking, texture, organic matter presence, grain size).
   - Accurately classify the specific soilType based on these STRICT rules:
     * If the soil looks visually RED -> Output "Red Soil"
     * If the soil looks BLACK with BROWN -> Output "Black Soil"
     * If the soil appears to have too much WATER content and looks sticky/muddy -> Output "Clay Soil"
     * If the soil looks like BEACH soil, loosely packed and granular -> Output "Sandy Soil"
     * For any other distinct soil kind -> Output the exact specific soil type (e.g., Alluvial, Peaty).
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
  "multiLeaf": false,
  "crop": "[Crop Name in ${targetLanguage}]",
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
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
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
        max_tokens: 1024,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `API request failed with status ${response.status}`;
      console.warn(`AI API Warning: ${errorMessage}`);
      throw new Error("Detection failed");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.warn('No response from AI');
      throw new Error("Detection failed");
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
        crop: result.crop || 'Unknown Crop',
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
        crop: extractField(content, 'crop') || 'Unknown Crop',
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
    console.warn(`AI Analysis Error: ${error.message}`);
    throw new Error("Detection failed");
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


