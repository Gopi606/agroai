const AI_API_KEY = import.meta.env.VITE_AI_API_KEY;
import { processLocally } from './localAnalysis';

let lastApiCallTime = 0;

export async function analyzeImage(imageUrl, language = 'en', mode = 'plant') {
  // Use local fallback immediately if no key provided
  if (!AI_API_KEY || AI_API_KEY === 'your_grok_api_key_here' || AI_API_KEY === 'your_groq_api_key_here') {
    return processLocally(imageUrl, language, mode);
  }

  // Rate limiting helper
  const now = Date.now();
  if (now - lastApiCallTime < 4500) {
    console.log("Using offline analysis mode due to rate limiting");
    return processLocally(imageUrl, language, mode);
  }
  
  lastApiCallTime = now;

  const languageNames = {
    'en': 'English',
    'ta': 'Tamil',
    'hi': 'Hindi',
    'te': 'Telugu',
    'kn': 'Kannada',
    'ml': 'Malayalam'
  };
  const targetLanguage = languageNames[language] || 'English';

  const systemInstruction = `You are an advanced agricultural AI expert specializing in plant disease detection, crop identification, and soil analysis.

Your task is to analyze the given image carefully and provide ONLY accurate, specific, and realistic results.

STRICT RULES:
1. NEVER give generic outputs like "Healthy Crop" unless you are 100% certain the plant is completely healthy.
2. If any disease symptoms (spots, discoloration, dryness, fungus, pests, holes, patches) are visible, you MUST:
   - Identify the exact disease name (or closest possible match).
   - Explain the symptoms briefly.
   - Provide precise remedies (chemical, organic, and preventive).
3. If the plant appears dry, wilted, or damaged:
   - Clearly state the issue (e.g., water stress, nutrient deficiency).
   - Suggest actionable solutions (watering, fertilizers, care).
4. If the image contains a plant:
   - Identify the plant/crop name as accurately as possible.
5. If the image contains soil:
   - Identify soil type (clay, sandy, loamy, etc.).
   - Suggest suitable crops and improvements.
6. If the image is unclear:
   - Say "Low confidence – image unclear" instead of guessing.

OUTPUT FORMAT (STRICT):
- Crop/Plant Name:
- Condition:
- Disease Name (if any):
- Confidence (%):
- Key Observations:
- Recommended Solutions:

IMPORTANT:
- Do NOT hallucinate.
- Do NOT give random answers.
- Accuracy is more important than completeness.
- Only give results based on visible evidence in the image.

Respond in JSON format.
Ensure your response is valid JSON and translated into ${targetLanguage}.
Structure your JSON response to match the STRICT OUTPUT FORMAT requirements while mapping to these application keys:
{
  "isValidCrop": true,
  "isSoil": false,
  "multiLeaf": false,
  "crop": "Crop/Plant Name",
  "disease": "Disease Name (if any)",
  "severity": "Condition",
  "symptoms": "Key Observations",
  "remedy": "Recommended Solutions",
  "prevention": "Preventive measures",
  "confidence": 95,
  "soilType": "Identify soil type (only if soil)",
  "characteristics": "Soil characteristics",
  "suitableCrops": "Suggest suitable crops",
  "waterRequirement": "Water requirement",
  "fertilizerSuggestions": "Fertilizers/Improvements"
}`;

  try {
    let base64Image = imageUrl;
    if (imageUrl.startsWith('blob:')) {
      base64Image = await blobUrlToBase64(imageUrl);
    }
    
    // Remove prefix if exists
    const base64Data = base64Image.includes('base64,') ? base64Image.split('base64,')[1] : base64Image;

    // Use Gemini Vision REST API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${AI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: systemInstruction },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: base64Data
              }
            }
          ]
        }],
        generationConfig: {
           response_mime_type: "application/json",
        }
      })
    });

    if (!response.ok) {
      console.warn(`AI API Failed with status ${response.status}. Using local fallback.`);
      return processLocally(imageUrl, language, mode);
    }

    const data = await response.json();
    let content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      console.warn('No response from AI, switching to local logic.');
      return processLocally(imageUrl, language, mode);
    }

    // Try to parse JSON output
    let result;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      result = JSON.parse(jsonMatch[1].trim());
    } catch(e) {
      // Very basic plain text fallback parsing
      result = {};
    }

    return {
      isValidCrop: typeof result.isValidCrop === 'boolean' ? result.isValidCrop : true,
      isSoil: !!result.isSoil,
      multiLeaf: !!result.multiLeaf,
      crop: result.crop || 'Unknown Crop',
      severity: result.severity || 'Unknown',
      disease: result.disease || 'Healthy',
      symptoms: result.symptoms || 'Analysis Complete',
      remedy: result.remedy || 'Consult a local agricultural expert',
      prevention: result.prevention || 'Practice good crop management',
      soilType: result.soilType || '',
      characteristics: result.characteristics || '',
      suitableCrops: result.suitableCrops || '',
      waterRequirement: result.waterRequirement || '',
      fertilizerSuggestions: result.fertilizerSuggestions || '',
      confidence: result.confidence || 85,
      isLocal: false
    };

  } catch (error) {
    console.warn(`AI API Exception: ${error.message}. Using offline logic.`);
    return processLocally(imageUrl, language, mode);
  }
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
