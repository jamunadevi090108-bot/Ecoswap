function analyzeClothing(condition = 'Good', category = 'Clothing') {
  const normalizedCondition = String(condition || 'Good');
  const normalizedCategory = String(category || 'Clothing');
  const normalized = normalizedCondition.toLowerCase();
  if (normalized.includes('torn') || normalized.includes('damaged') || normalized.includes('heavily')) {
    return {
      category: normalizedCategory,
      condition: normalizedCondition,
      material: 'Not determined by demo analysis',
      recommendation: 'Recycle',
      confidence: 0.95,
      reason: 'The selected condition suggests the item may be unsuitable for normal resale.'
    };
  }
  if (normalized.includes('used')) {
    return {
      category: normalizedCategory,
      condition: normalizedCondition,
      material: 'Not determined by demo analysis',
      recommendation: 'Donate',
      confidence: 0.84,
      reason: 'The selected condition suggests the item may be wearable and suitable for donation.'
    };
  }
  return {
    category: normalizedCategory,
    condition: normalizedCondition,
    material: 'Not determined by demo analysis',
    recommendation: 'Sell',
    confidence: 0.92,
    reason: 'The selected condition suggests the item may be suitable for resale.'
  };
}
module.exports={analyzeClothing};
