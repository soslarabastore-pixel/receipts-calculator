import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '20mb' }));

// Shared server-side Gemini client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Scan / Parse receipt endpoint using Gemini 3.8 Flash
app.post('/api/receipt/scan', async (req, res) => {
  try {
    const { imageBase64, mimeType, textInput } = req.body;

    if (!imageBase64 && !textInput) {
      return res.status(400).json({ error: 'Please provide either an image or receipt text to analyze.' });
    }

    const contents: any[] = [];

    const promptText = `Analyze this receipt thoroughly. Extract all individual line items with accurate quantities and prices, along with taxes, tips, discounts, fees, and the overall total.
Ensure every price and quantity is numeric. If an item has multiple units, provide the total price for that line.
If any discount, service charge, auto-gratuity, or tax appears, extract it accurately.`;

    if (imageBase64) {
      contents.push({
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: imageBase64.replace(/^data:image\/[a-z]+;base64,/, ''),
        },
      });
      contents.push({ text: promptText });
    } else {
      contents.push({
        text: `${promptText}\n\nHere is the raw receipt text:\n${textInput}`,
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction: `You are an expert financial receipt auditing and parsing assistant.
Extract all details from receipts accurately without missing items or rounding inappropriately.
Always verify that line items, discounts, taxes, fees, and tips add up sensibly.
If an item is missing a quantity, default to 1.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            merchant: { type: Type.STRING, description: 'Store, vendor, or restaurant name' },
            date: { type: Type.STRING, description: 'Date of purchase if visible' },
            currency: { type: Type.STRING, description: 'Currency symbol or ISO code, default $' },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: 'Item description or name' },
                  quantity: { type: Type.NUMBER, description: 'Quantity purchased' },
                  unitPrice: { type: Type.NUMBER, description: 'Price per single unit' },
                  totalPrice: { type: Type.NUMBER, description: 'Total price for this line item' },
                  category: { type: Type.STRING, description: 'Category e.g. Food, Drink, Grocery, Service, Other' },
                },
                required: ['name', 'quantity', 'totalPrice'],
              },
            },
            subtotal: { type: Type.NUMBER, description: 'Subtotal before taxes, tips, and fees' },
            tax: { type: Type.NUMBER, description: 'Sales tax or VAT amount' },
            taxRate: { type: Type.NUMBER, description: 'Tax percentage rate if stated' },
            tip: { type: Type.NUMBER, description: 'Tip, gratuity or service charge amount if already on receipt' },
            discount: { type: Type.NUMBER, description: 'Total discount or promotional deduction if any' },
            fees: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: 'Fee name, e.g. Delivery fee, Service charge, Surcharge' },
                  amount: { type: Type.NUMBER, description: 'Fee amount' },
                },
                required: ['name', 'amount'],
              },
            },
            total: { type: Type.NUMBER, description: 'Final grand total indicated on the receipt' },
            notes: { type: Type.STRING, description: 'Any relevant notes, payment method shown, or auditing observation' },
          },
          required: ['merchant', 'items', 'subtotal', 'total'],
        },
      },
    });

    const parsedData = JSON.parse(response.text || '{}');
    return res.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error('Error scanning receipt:', error);
    return res.status(500).json({
      error: 'Failed to parse receipt',
      details: error?.message || 'Unknown error occurred while contacting AI model',
    });
  }
});

// Audit deduction AI explanation & dispute generator endpoint
app.post('/api/reconcile/audit', async (req, res) => {
  try {
    const {
      expectedTotal,
      actualDeducted,
      currency = '$',
      merchantName,
      paymentMethod,
      statementDescriptor,
      items,
      taxAmount,
      tipAmount,
      fees,
      discrepancyType,
    } = req.body;

    const diff = Number((actualDeducted - expectedTotal).toFixed(2));

    const prompt = `You are a consumer financial protection & payment audit expert.
A user received a receipt from "${merchantName || 'Merchant'}" and checked their bank/card deduction.
Expected total from receipt & planned tip: ${currency}${expectedTotal.toFixed(2)}
Actual amount deducted from bank/card: ${currency}${actualDeducted.toFixed(2)}
Discrepancy: ${diff > 0 ? `Overcharge of ${currency}${diff.toFixed(2)}` : diff < 0 ? `Undercharge of ${currency}${Math.abs(diff).toFixed(2)}` : 'Exact match ($0.00)'}
Payment method: ${paymentMethod || 'Credit/Debit Card'}
Bank statement descriptor: ${statementDescriptor || 'N/A'}
Receipt tax: ${currency}${(taxAmount || 0).toFixed(2)}
Receipt tip: ${currency}${(tipAmount || 0).toFixed(2)}
Fees: ${JSON.stringify(fees || [])}
Observed anomaly type: ${discrepancyType || 'General audit'}

Please provide:
1. A clear diagnostic explanation of the most probable cause of this discrepancy (e.g. pending authorization hold, unadvertised credit card swipe surcharge, tip added to total rather than subtotal, double tip entry by server, foreign transaction fee, or pos clerical error).
2. Clear action steps the consumer should take right now (e.g., check pending vs settled status, contact venue, or request itemized merchant slip).
3. A polite, professional dispute inquiry template the user can copy and send to the merchant or bank.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: 'Provide helpful, clear, actionable financial auditing guidance. Be concise and professional.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            likelyReason: { type: Type.STRING, description: 'Primary diagnostic explanation for the discrepancy' },
            secondaryFactors: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Other contributing factors or possibilities to consider',
            },
            recommendedAction: { type: Type.STRING, description: 'Immediate recommended action for the consumer' },
            disputeTemplate: { type: Type.STRING, description: 'Ready-to-send dispute or clarification message' },
            isLikelyTemporaryHold: { type: Type.BOOLEAN, description: 'Whether this looks like a pending authorization hold' },
          },
          required: ['likelyReason', 'recommendedAction', 'disputeTemplate'],
        },
      },
    });

    const auditAnalysis = JSON.parse(response.text || '{}');
    return res.json({ success: true, analysis: auditAnalysis });
  } catch (error: any) {
    console.error('Error auditing deduction:', error);
    return res.status(500).json({
      error: 'Failed to generate audit explanation',
      details: error?.message || 'Server error',
    });
  }
});

// Google Search Grounding endpoint: Verify merchant billing descriptors, card surcharge policies, or tax rules
app.post('/api/merchant/search-info', async (req, res) => {
  try {
    const { merchantName, location, descriptor, queryTopic } = req.body;

    // Check prohibited terms in inputs to prevent malicious search generation
    const textToCheck = `${merchantName || ''} ${descriptor || ''} ${queryTopic || ''}`.toLowerCase();
    const serverProhibited = ['stolen card', 'carding', 'credit card number', 'cvv', 'password', 'pin number', 'chargeback fraud', 'exploit'];
    for (const term of serverProhibited) {
      if (textToCheck.includes(term)) {
        return res.status(400).json({
          error: 'Search request contains prohibited or sensitive financial security terms.',
        });
      }
    }

    const query = queryTopic
      ? `${merchantName || ''} ${queryTopic}`
      : `${merchantName || 'merchant'} ${location || ''} credit card surcharge fee policy tipping billing descriptor ${descriptor || ''}`.trim();

    const prompt = `Search for recent, accurate information regarding "${merchantName || 'the vendor'}" (statement descriptor: "${descriptor || 'N/A'}", location: "${location || 'N/A'}").
Analyze:
1. Is there an official surcharge or non-cash adjustment policy (e.g. 3%, 3.5%, 3.99%)?
2. Typical bank statement descriptor names or parent company.
3. Relevant consumer notes or tip policy guidelines.

Provide a concise, helpful summary for consumer billing verification.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || '';
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    const sources = groundingChunks
      .filter((chunk: any) => chunk.web?.uri)
      .map((chunk: any) => ({
        title: chunk.web.title || 'Web Source',
        uri: chunk.web.uri,
      }));

    return res.json({
      success: true,
      summary: text,
      sources,
    });
  } catch (error: any) {
    console.error('Error running search grounding:', error);
    return res.status(500).json({
      error: 'Failed to search merchant information',
      details: error?.message || 'Server error',
    });
  }
});

// Serve frontend with Vite in dev mode or static files in production
async function startServer() {
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`SplitExact server running on port ${PORT}`);
  });
}

startServer();
