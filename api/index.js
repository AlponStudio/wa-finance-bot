const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

const app = express();
app.use(express.json());

// Masukkan API Key kamu di sini
const SUPABASE_URL = 'https://qqkusyfjyknbitzudgbj.supabase.co/rest/v1/'; 
const SUPABASE_KEY = 'sb_publishable_eIyoWRMJc7DNWlrdQpOitg_3cMBhTWv'; 
const GEMINI_API_KEY = 'AQ.Ab8RN6LIaF8mi-HGl23weV1GX99LdnH2wEdCdFB8ezz-_N7Xkw'; 

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Root path test
app.get('/', (req, res) => {
  res.status(200).send('Server Vercel Aktif!');
});

// Endpoint Webhook untuk GET
app.get('/webhook', (req, res) => {
  res.status(200).send('Webhook Vercel Berhasil Aktif!');
});

// Endpoint Webhook untuk POST
app.post('/webhook', async (req, res) => {
  try {
    const message = req.body.message || '';
    const imageUrl = req.body.url || '';
    
    if (message.toLowerCase().includes('pengajuan reimburse') || message.toLowerCase().includes('pemasukan')) {
      let nominal = 0;
      let tipe = message.toLowerCase().includes('pemasukan') ? 'pemasukan' : 'pengeluaran';

      if (imageUrl) {
        const imgResp = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const base64Img = Buffer.from(imgResp.data).toString('base64');

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent([
          "Berapa total nominal uang pada gambar ini? Jawab HANYA angka tanpa titik, koma, atau kata lain.",
          { inlineData: { data: base64Img, mimeType: 'image/jpeg' } }
        ]);

        const text = result.response.text().trim();
        const extracted = text.match(/\d+/g)?.join('');
        if (extracted) nominal = parseFloat(extracted);
      }

      await supabase.from('transactions').insert([
        {
          type: tipe,
          category: 'WhatsApp Upload',
          amount: nominal,
          description: message,
          proof_url: imageUrl,
          status: 'Pending'
        }
      ]);

      return res.json({
        reply: `✅ *Data Berhasil Dicatat (Vercel)*\n💰 Nominal: Rp ${nominal.toLocaleString('id-ID')}\n📝 Keterangan: ${message}`
      });
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error processing request');
  }
});

module.exports = app;
