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

  const systemInstruction = `Analyze this agricultural image. Identify:
1. Crop/plant name
2. Is it healthy or diseased?
3. If diseased, name the disease
4. Provide simple remedy
5. If soil, identify soil type and suitable crops

Respond in JSON format.
Ensure your response is valid JSON and translated into ${targetLanguage}.
Structure:
{
  "isValidCrop": true,
  "isSoil": false,
  "multiLeaf": false,
  "crop": "str",
  "disease": "str",
  "severity": "Low/Medium/High",
  "symptoms": "str",
  "remedy": "str",
  "prevention": "str",
  "confidence": 95,
  "soilType": "str",
  "characteristics": "str",
  "suitableCrops": "str",
  "waterRequirement": "str",
  "fertilizerSuggestions": "str"
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
