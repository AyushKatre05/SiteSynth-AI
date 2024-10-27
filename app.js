const express = require('express');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const dotenv = require('dotenv');
const multer = require('multer');

dotenv.config();

const app = express();
const port = 3000;

app.use(express.static('public'));
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

const googleModels = [
  "gemini-1.5-pro-exp-0801",
  "gemini-1.5-flash-002",
  "gemini-1.5-pro-002",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-1.0-pro"
];

const systemPrompt = "You are an AI assistant specialized in creating websites based on user descriptions. Your task is to generate clean, valid HTML, CSS, and JavaScript code for a website. Respond only with the code needed to create the website, without any explanations or markdown formatting. The code should be ready to be rendered directly in a browser.";

async function generateWebsiteCode(provider, model, prompt, images = []) {
  if (provider === 'google') {
    return generateGoogleWebsiteCode(model, prompt, images);
  }
  throw new Error('Invalid provider');
}

async function generateGoogleWebsiteCode(model, prompt, images = []) {
  const googleModel = genAI.getGenerativeModel({ 
    model: model,
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
    ],
  });

  const parts = [{ text: prompt }];
  
  if (images && images.length > 0) {
    images.forEach(img => {
      parts.push({
        inlineData: {
          data: img,
          mimeType: "image/jpeg"
        }
      });
    });
  }

  const chat = googleModel.startChat({
    history: [
      {
        role: "user", 
        parts: [{text: systemPrompt}],
      },
      {
        role: "model", 
        parts: [{text: "Understood. I will provide the website code based on user description and images. I'll provide clean, valid HTML, CSS, and JavaScript code without any explanations or markdown formatting. I will make sure <style> and <script> part comes within inside the <html>."}]
      },
      {
        role: "user",
        parts: [{ text: prompt }],
      },
      {
        role: "model",
        parts: [{ text: "Understood. I'm ready to generate website code based on user descriptions and images. I'll provide clean, valid HTML, CSS, and JavaScript code without any explanations or markdown formatting." }],
      },
    ],
  });

  const result = await chat.sendMessageStream(parts);
  return result.stream;
}

function encodeImageToBase64(buffer) {
  return buffer.toString('base64');
}

app.post('/generate', upload.array('images', 5), async (req, res) => {
  const { prompt, provider, model } = req.body;
  const images = req.files ? req.files.map(file => encodeImageToBase64(file.buffer)) : [];
  handleWebsiteGeneration(req, res, prompt, provider, model, images);
});

app.post('/modify', upload.array('images', 5), async (req, res) => {
  const { prompt, currentCode, provider, model } = req.body;
  const images = req.files ? req.files.map(file => encodeImageToBase64(file.buffer)) : [];
  const modifyPrompt = `Modify the following website code based on this instruction and the provided images: ${prompt}\n\nCurrent code:\n${currentCode}`;
  handleWebsiteGeneration(req, res, modifyPrompt, provider, model, images);
});

const isServerless = process.env.VERCEL == '1';

async function handleWebsiteGeneration(req, res, prompt, provider, model, images = []) {
  if (isServerless){
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
  } else {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
  }

  try {
    const stream = await generateWebsiteCode(provider, model, prompt, images);
    for await (const chunk of stream) {
      const chunkText = chunk.text();
      res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
    }
  } catch (error) {
    console.error('Error:', error);
    res.write(`data: ${JSON.stringify({ error: 'An error occurred' })}\n\n`);
  }

  res.write('event: close\n\n');
  res.end();
}

app.get('/models', (req, res) => {
  res.json({
    google: googleModels
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
