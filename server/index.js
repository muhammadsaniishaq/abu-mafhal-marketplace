const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// More permissive CORS for local development
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

app.post('/api/ai/generate', async (req, res) => {
  console.log('🤖 AI request received');
  
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ No API key found!');
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ Anthropic API error:', data);
      return res.status(response.status).json(data);
    }

    console.log('✅ AI response successful');
    res.json(data);
  } catch (error) {
    console.error('❌ Server error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Proxy server is running',
    hasApiKey: !!process.env.ANTHROPIC_API_KEY 
  });
});

const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n🚀 ================================');
  console.log(`✅ Proxy server running on port ${PORT}`);
  console.log(`✅ Test at: http://localhost:${PORT}/health`);
  console.log(`✅ API Key: ${process.env.ANTHROPIC_API_KEY ? 'Configured ✓' : 'Missing ✗'}`);
  console.log('🚀 ================================\n');
});