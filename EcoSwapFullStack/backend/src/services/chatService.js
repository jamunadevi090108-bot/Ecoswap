function categoryFromMessage(message) {
  const text = message.toLowerCase();
  if (/women|woman/.test(text)) return "Women's Wear";
  if (/men's|mens|\bmen\b/.test(text)) return "Men's Wear";
  if (/kid|child/.test(text)) return 'Kids Wear';
  if (/shoe|footwear|sneaker|boot/.test(text)) return 'Footwear';
  if (/accessor/.test(text)) return 'Accessories';
  if (/traditional|kurta|sari|saree/.test(text)) return 'Traditional Wear';
  if (/winter/.test(text)) return 'Winter Wear';
  if (/sport|activewear/.test(text)) return 'Sports Wear';
  return '';
}

function conditionFromMessage(message) {
  const text = message.toLowerCase();
  return ['heavily used', 'very good', 'excellent', 'damaged', 'torn', 'good', 'used', 'new']
    .find((condition) => text.includes(condition)) || '';
}

function sizeFromMessage(message) {
  const stopWords = new Set(['is', 'it', 'the', 'a', 'and', 'of', 'for', 'please']);
  const matches = [...message.matchAll(/\bsize\s+([a-z0-9-]+)/gi)];
  return matches.reverse().map((match) => match[1]).find((value) => !stopWords.has(value.toLowerCase())) || '';
}

function priceLimit(message) {
  const match = message.match(/(?:under|below|less than|within|up to|upto)\s*(?:₹|rs\.?|inr)?\s*([\d,]+)/i);
  return match ? Number(match[1].replace(/,/g, '')) : null;
}

function categoryAction(category) {
  return {
    type: 'browse',
    label: category ? `Browse ${category}` : 'Browse Products',
    url: category ? `/marketplace?category=${encodeURIComponent(category)}` : '/marketplace'
  };
}

function response(message, action, products = [], demo = true) {
  return { message, ...(action ? { action } : {}), ...(products.length ? { products } : {}), demo };
}

function safeProduct(product) {
  return {
    id: product.id,
    name: product.name,
    price: product.price,
    category: product.category,
    size: product.size,
    condition: product.condition,
    brand: product.brand,
    description: product.description,
    image: product.image,
    status: product.status,
    isDemo: product.is_demo,
    aiAnalysis: product.aiAnalysis
  };
}

function productSearchTerms(message) {
  const ignored = new Set([
    'show', 'me', 'find', 'search', 'looking', 'for', 'do', 'you', 'have',
    'tell', 'about', 'what', 'is', 'whats', 'details', 'product', 'products',
    'please', 'can', 'i', 'want', 'need', 'the', 'a', 'an', 'of', 'with',
    'this', 'that', 'it', 'available', 'price', 'size', 'condition', 'brand',
    'category', 'good', 'excellent', 'used', 'new', 'women', 'woman', 'men',
    'kids', 'wear', 'traditional', 'footwear', 'accessories', 'winter', 'sports',
    'under', 'below', 'less', 'than', 'within', 'up', 'to', 'upto', 'rs', 'inr',
    'hi', 'hello', 'hey', 'yes', 'ok', 'okay'
  ]);
  return message.toLowerCase()
    .replace(/[₹,]/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1 && !ignored.has(word) && !/^\d+$/.test(word));
}

function isInventoryQuestion(message) {
  return /\b(show|find|search|browse|available|listing|listings|products|buy|purchase|shop|selling|looking for|do you have)\b/i.test(message);
}

function isClothingAdviceQuestion(message) {
  return /\b(wash|launder|clean|stain|iron|care|repair|style|wear|match|outfit|shrink|fabric|material|fashion|sustainable|reuse|recycle|donate)\b/i.test(message);
}

async function answer(message, getSupabase, history = []) {
  const text = message.trim().toLowerCase();
  const previousMessage = [...history].reverse().find((item) => item.role === 'user' && typeof item.content === 'string')?.content || '';
  const searchMessage = `${previousMessage} ${message}`;
  const searchText = searchMessage.toLowerCase();
  if (/^(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(text)) {
    return response('Hi! Welcome to EcoSwap. I can help you browse real listings, understand a product, or explain how to sell, donate, exchange, or recycle clothing.', categoryAction(''));
  }
  if (/^(how are you|thank you|thanks|goodbye|bye)\b/.test(text)) {
    return response(/thank|thanks|bye|goodbye/.test(text) ? 'You’re welcome. Happy to help with your next EcoSwap find!' : 'I’m here and ready to help you find pre-loved clothing or answer EcoSwap questions.');
  }
  if (/what is ecoswap|about ecoswap|how does ecoswap work/.test(text)) {
    return response('EcoSwap is a sustainable clothing platform where people can buy, sell, donate, exchange, and recycle pre-loved clothing.');
  }
  if (/damaged|textile waste|sustainable fashion|reus(e|ing)|recycl(e|ing)|donat(e|ion)/.test(text) && !/product|listing|show me|find|browse|price/.test(text)) {
    return response('If it is clean and wearable, consider donating or exchanging it. If it is damaged beyond repair, check for a local textile-recycling program. Repairing or reusing it is also a good way to reduce textile waste.', {
      type: 'navigate',
      label: 'Donate Clothing',
      url: /recycl/.test(text) ? '/recycle' : '/donate'
    });
  }

  if (/sell|list my|add product/.test(text)) {
    return response('You can add a listing with its photo and details from the Sell page. Sign in first to manage your listing.', {
      type: 'navigate', label: 'Sell a Product', url: '/sell'
    });
  }
  if (/order|buy|purchase/.test(text)) {
    return response('Open an available listing and choose Buy now. Sign in, confirm your delivery address, then complete payment in the secure Razorpay checkout. Google Pay appears as a UPI option when it is enabled for the merchant and supported on your device.', {
      type: 'navigate', label: 'Browse Products', url: '/marketplace'
    });
  }
  if (/donat/.test(text)) {
    return response('You can submit a clothing donation request from the Donate page.', {
      type: 'navigate', label: 'Donate Clothing', url: '/donate'
    });
  }
  if (/dashboard|my listing|my request/.test(text)) {
    return response('Your dashboard shows your listings and requests after you sign in.', {
      type: 'navigate', label: 'View Dashboard', url: '/dashboard'
    });
  }

  const category = categoryFromMessage(searchText);
  const condition = conditionFromMessage(searchText);
  const size = sizeFromMessage(searchMessage);
  const budget = priceLimit(searchText);
  const terms = productSearchTerms(searchMessage)
    .filter((word) => !/^(hi|hello|hey|yes|ok|okay)$/.test(word))
    .map((word) => word.endsWith('s') ? word.slice(0, -1) : word);
  const productQuestion = /price|how much|what size|what condition|what brand|who is selling|who sells|tell me about|details about|is it available|recommendation/.test(text);
  const inventoryQuestion = isInventoryQuestion(text) || productQuestion || budget !== null;
  const shouldSearchInventory = inventoryQuestion ||
    Boolean((category || condition || size) && !isClothingAdviceQuestion(text));

  if (shouldSearchInventory) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('products')
      .select('id,name,price,category,size,condition,brand,description,image,status,seller,"aiAnalysis"')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;

    const allProducts = data || [];
    const matched = allProducts.filter((product) => {
      if (category && product.category !== category) return false;
      if (condition && product.condition?.toLowerCase() !== condition) return false;
      if (size && product.size?.toLowerCase() !== size.toLowerCase()) return false;
      if (budget !== null && Number(product.price) > budget) return false;
      if (product.status && !/available/i.test(product.status)) return false;
      const searchable = [
        product.name,
        product.category,
        product.brand,
        product.size,
        product.condition,
        product.description
      ].map((value) => String(value || '').toLowerCase());
      if (terms.length && !terms.every((term) => searchable.some((value) => value.includes(term)))) return false;
      return true;
    });

    if (matched.length) {
      const products = matched.slice(0, 6).map(safeProduct);
      if (productQuestion && matched.length === 1) {
      const product = products[0];
      const price = `₹${Number(product.price).toLocaleString('en-IN')}`;
      const analysis = product.aiAnalysis?.recommendation
        ? ` AI recommendation: ${product.aiAnalysis.recommendation}${product.aiAnalysis.confidence ? ` (${Math.round(product.aiAnalysis.confidence * 100)}% confidence)` : ''}${product.aiAnalysis.reason ? `: ${product.aiAnalysis.reason}` : '.'}`
        : '';
      let seller = '';
      if (matched[0].seller) {
        const { data: sellerData, error: sellerError } = await supabase
          .from('users')
          .select('name,email')
          .eq('id', matched[0].seller)
          .maybeSingle();
        if (sellerError) throw sellerError;
        if (sellerData) seller = ` Seller: ${sellerData.name}${sellerData.email ? ` (${sellerData.email})` : ''}.`;
      }
      return response(
        `${product.name} is ${price}, size ${product.size}, condition ${product.condition}, category ${product.category}, brand ${product.brand || 'not specified'}. ${product.description} Status: ${product.status || 'Available'}.${seller}${analysis}`,
        { type: 'product', label: 'View Product', url: `/product/${product.id}` },
        products
      );
      }

      const filterParams = new URLSearchParams();
      if (category) filterParams.set('category', category);
      if (condition) filterParams.set('condition', condition);
      if (size) filterParams.set('size', size);
      if (budget !== null) filterParams.set('max', String(budget));
      if (terms.length) filterParams.set('q', terms.join(' '));
      const url = `/marketplace${filterParams.size ? `?${filterParams.toString()}` : ''}`;
      const criteria = [
      category,
      budget !== null ? `under ₹${budget.toLocaleString('en-IN')}` : '',
      condition ? `in ${condition} condition` : '',
      size ? `size ${size}` : '',
      terms.join(' ')
      ].filter(Boolean).join(', ');
      return response(`I found ${matched.length} available ${matched.length === 1 ? 'listing' : 'listings'}${criteria ? ` matching ${criteria}` : ''}.`, {
        type: 'browse',
        label: 'View Products',
        url
      }, products);
    }

    if (!allProducts.length) {
      return response('There are no product listings in the marketplace yet. You can browse again later or add a listing when signed in.', {
        type: 'browse',
        label: 'Browse Products',
        url: '/marketplace'
      });
    }
    return response('I could not find an available listing matching those details. Try another category, size, or price range.', categoryAction(category));
  }

  return response(await generateAnswer(message, history), undefined, [], false);
}

module.exports = { answer };
const { generateAnswer } = require('./geminiService');
