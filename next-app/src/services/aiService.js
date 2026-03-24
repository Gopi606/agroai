const AI_API_URL = process.env.NEXT_PUBLIC_ || 'https://api.groq.com/openai/v1/chat/completions';
const AI_API_KEY = process.env.NEXT_PUBLIC_;

export async function analyzeImage(imageUrl, language = 'en') {
  if (!AI_API_KEY || AI_API_KEY === 'your_grok_api_key_here' || AI_API_KEY === 'your_groq_api_key_here') {
    // Return demo data when API key not configured
    return getDemoResult(language);
  }

  const tamilPrefix = language === 'ta' 
    ? 'CRITICAL INSTRUCTION: You MUST write ALL values (disease, symptoms, remedy_chemical, remedy_organic, prevention) in Tamil (தமிழ்) language ONLY. Do NOT use English for any field values.\n\n' 
    : '';

  const tamilSuffix = language === 'ta'
    ? '\n\nREMINDER: ALL field values in the JSON must be in Tamil (தமிழ்). Write disease name, symptoms, remedy_chemical, remedy_organic, and prevention entirely in Tamil language.'
    : '';

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
                text: `${tamilPrefix}You are an expert agricultural AI assistant. Analyze this crop image and provide:\n1. Disease name (if any, or "Healthy" if no disease)\n2. Symptoms observed (describe in detail)\n3. Severity level (Low, Medium, High)\n4. Remedy Chemical - write detailed chemical treatments\n5. Remedy Organic - write detailed organic treatments\n6. Prevention tips - write as a detailed paragraph\n7. Confidence level (as percentage)\n\nRespond ONLY with valid JSON:\n{"disease": "...", "symptoms": "...", "severity": "...", "remedy_chemical": "...", "remedy_organic": "...", "prevention": "...", "confidence": 85}${tamilSuffix}`
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
        disease: result.disease || 'Unknown',
        symptoms: result.symptoms || 'Unable to determine symptoms',
        severity: result.severity || 'Medium',
        remedy_chemical: result.remedy_chemical || 'Consult a local agricultural expert',
        remedy_organic: result.remedy_organic || 'Consult a local agricultural expert',
        prevention: result.prevention || 'Practice good crop management',
        confidence: result.confidence || 75
      };
    } catch (parseError) {
      // If JSON parsing fails, try to extract info from plain text
      return {
        disease: extractField(content, 'disease') || 'Analysis Complete',
        symptoms: extractField(content, 'symptoms') || content.substring(0, 200),
        severity: extractField(content, 'severity') || 'Medium',
        remedy_chemical: extractField(content, 'remedy_chemical') || 'Consult a local agricultural expert',
        remedy_organic: extractField(content, 'remedy_organic') || 'Consult a local agricultural expert',
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
      if (language === 'ta') {
        resolve({
          disease: 'தாமதமான கருகல் (Late Blight)',
          symptoms: 'இலைகளில் அடர் பழுப்பு புள்ளிகள், அடிப்பகுதியில் வெள்ளை பூஞ்சை, வேகமாக பரவும் புண்கள்.',
          severity: 'High',
          remedy_chemical: 'உடனடியாக செம்பு அடிப்படையிலான பூஞ்சைக்கொல்லியை பயன்படுத்தவும்.',
          remedy_organic: 'வேப்ப எண்ணெய் அல்லது பயோ-பூஞ்சைக்கொல்லியை பயன்படுத்தவும்.',
          prevention: 'நோய் எதிர்ப்பு ரகங்களை பயன்படுத்தவும். காற்று சுழற்சிக்கு சரியான இடைவெளி உறுதி செய்யவும். மழைக்காலத்திற்கு முன் தடுப்பு பூஞ்சைக்கொல்லி பயன்படுத்தவும்.',
          confidence: 94
        });
      } else {
        resolve({
          disease: 'Late Blight',
          symptoms: 'Dark brown spots on leaves, white mold on undersides, rapidly spreading lesions that can destroy foliage within days.',
          severity: 'High',
          remedy_chemical: 'Apply copper-based fungicide immediately. Avoid overhead irrigation.',
          remedy_organic: 'Apply neem oil spray or bio-fungicide like Trichoderma.',
          prevention: 'Use disease-resistant varieties. Ensure proper spacing for air circulation. Apply preventive fungicide before rainy season. Rotate crops annually.',
          confidence: 94
        });
      }
    }, 2000);
  });
}
