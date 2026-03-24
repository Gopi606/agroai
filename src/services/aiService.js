const AI_API_URL = import.meta.env.VITE_AI_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
const AI_API_KEY = import.meta.env.VITE_AI_API_KEY;

export async function analyzeImage(imageUrl, language = 'en') {
  if (!AI_API_KEY || AI_API_KEY === 'your_grok_api_key_here' || AI_API_KEY === 'your_groq_api_key_here') {
    // Return demo data when API key not configured
    return getDemoResult(language);
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

  const systemInstruction = `You are an expert agricultural AI assistant. You must analyze the image and respond with valid JSON ONLY.
Follow these steps carefully:
1. VALIDATE: Check if the image clearly contains a plant or crop leaf. If it is a human, animal, object, or random photo, you MUST return exactly: {"isValidCrop": false}.
2. LEAF COUNT: Look at the number of leaves. If there are multiple distinct leaves or a whole plant, set "multiLeaf": true, and analyze only the most prominent leaf. Otherwise set "multiLeaf": false.
3. ANALYSIS: Identify the specific crop disease. If healthy, set disease to "Healthy". Assess the severity as "Low", "Medium", or "High".
4. CONFIDENCE: Give a confidence score (0-100).
5. TREATMENT: Provide detailed symptoms. For remedy, provide a detailed paragraph including both organic AND chemical treatments. Provide detailed prevention tips.
6. TRANSLATION: ALL text fields (disease, symptoms, remedy, prevention, severity) MUST be completely translated into ${targetLanguage}. Do not use English unless the target is English.

Example JSON output format for a valid crop:
{
  "isValidCrop": true,
  "multiLeaf": true,
  "disease": "[Disease Name in ${targetLanguage}]",
  "confidence": 85,
  "severity": "[Low/Medium/High in ${targetLanguage}]",
  "symptoms": "[Detailed symptoms in ${targetLanguage}]",
  "remedy": "[Detailed organic and chemical remedy in ${targetLanguage}]",
  "prevention": "[Detailed prevention tips in ${targetLanguage}]"
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
      throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI');
    }

    // Parse the JSON response
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const cleanedContent = jsonMatch[1].trim();
      const result = JSON.parse(cleanedContent);

      return {
        isValidCrop: result.isValidCrop !== false,
        multiLeaf: !!result.multiLeaf,
        severity: result.severity || 'Unknown',
        disease: result.disease || 'Unknown',
        symptoms: result.symptoms || 'Unable to determine symptoms',
        remedy: result.remedy || 'Consult a local agricultural expert',
        prevention: result.prevention || 'Practice good crop management',
        confidence: result.confidence || 75
      };
    } catch (parseError) {
      // If JSON parsing fails, try to extract info from plain text
      return {
        isValidCrop: !content.includes('"isValidCrop": false') && !content.toLowerCase().includes('not a crop'),
        multiLeaf: content.includes('"multiLeaf": true') || content.toLowerCase().includes('multiple leaves'),
        severity: extractField(content, 'severity') || 'Unknown',
        disease: extractField(content, 'disease') || 'Analysis Complete',
        symptoms: extractField(content, 'symptoms') || content.substring(0, 200),
        remedy: extractField(content, 'remedy') || 'Consult a local agricultural expert',
        prevention: extractField(content, 'prevention') || 'Practice good crop management',
        confidence: parseInt(extractField(content, 'confidence')) || 70
      };
    }
  } catch (error) {
    console.error('AI Analysis Error:', error);
    throw new Error(`AI analysis failed: ${error.message}`);
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

function getDemoResult(language) {
  // Simulate API delay
  return new Promise((resolve) => {
    setTimeout(() => {
      if (!languageNames[language]) language = 'en';
      
      resolve({
        isValidCrop: true,
        multiLeaf: false,
        severity: 'High',
        disease: language === 'en' ? 'Late Blight' : 'தாமதமான கருகல் (Late Blight)',
        symptoms: language === 'en' ? 'Dark brown spots on leaves, white mold on undersides.' : 'இலைகளில் அடர் பழுப்பு புள்ளிகள்.',
        remedy: language === 'en' ? 'Apply copper-based fungicide.' : 'செம்பு அடிப்படையிலான பூஞ்சைக்கொல்லியை பயன்படுத்தவும்.',
        prevention: language === 'en' ? 'Use disease-resistant varieties.' : 'நோய் எதிர்ப்பு ரகங்களை பயன்படுத்தவும்.',
        confidence: 94
      });
    }, 2000);
  });
}
