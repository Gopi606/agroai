import { NextResponse } from 'next/server';

const basePrices = {
  'Wheat': 2500,
  'Rice': 3200,
  'Cotton': 5500,
  'Sugarcane': 350
};

function predictNextDays(pricesList, numDays) {
  const n = pricesList.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += pricesList[i];
    sumXY += i * pricesList[i];
    sumXX += i * i;
  }
  
  const denominator = (n * sumXX - sumX * sumX);
  if (denominator === 0) return Array(numDays).fill(pricesList[n-1]);
  
  const m = (n * sumXY - sumX * sumY) / denominator;
  const b = (sumY - m * sumX) / n;
  
  const predictions = [];
  for (let j = 0; j < numDays; j++) {
    const volatility = (Math.random() - 0.5) * (pricesList[n-1] * 0.05);
    predictions.push(Math.round(m * (n + j) + b + volatility));
  }
  return predictions;
}

export async function GET() {
  const data = Object.keys(basePrices).map(crop => {
    const pastData = [];
    let currentPrice = basePrices[crop] + (Math.random() - 0.5) * 500;
    
    for (let i = 0; i < 30; i++) {
      currentPrice += (Math.random() - 0.4) * 50;
      pastData.push(Math.round(currentPrice));
    }
    
    const next7Days = predictNextDays(pastData.slice(-15), 7);
    
    const current = pastData[29];
    const predictedAvg = next7Days.reduce((a,b)=>a+b,0) / 7;
    let recommendation = 'Hold';
    let insight = `Prices are stable. Wait for a better opportunity.`;
    
    if (predictedAvg > current * 1.05) {
      recommendation = 'Hold & Wait';
      insight = `Price expected to rise significantly (${Math.round((predictedAvg-current)/current * 100)}%). Hold for now.`;
    } else if (predictedAvg < current * 0.95) {
      recommendation = 'Sell Now';
      insight = `Price expected to drop due to market patterns. Best time to sell.`;
    }

    return {
      crop,
      currentPrice: current,
      pastData,
      predictions: next7Days,
      recommendation,
      insight,
      trend: predictedAvg > current ? 'up' : 'down'
    };
  });
  
  return NextResponse.json({ success: true, prices: data });
}
