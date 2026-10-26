const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

const app = express();
app.use(express.json());

// Ganti teks di bawah dengan API Key asli kamu
const SUPABASE_URL = 'https://qqkusyfjyknbitzudgbj.supabase.co'; 
const SUPABASE_KEY = 'PASTE_ANON_KEY_KAMU_DI_SINI';
const GEMINI_API_KEY = 'PASTE_GEMINI_KEY_KAMU_DI_SINI';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// 1. Tambahkan handler GET agar Fonnte & Browser tidak error saat cek URL
app.get('/webhook', (req, res) => {
  res.status(200).send('Webhook Vercel Aktif!');
});

// 2. Handler POST untuk memproses pesan WhatsApp dari Fonnte
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
    res.status(500).send('Error');
  }
});

module.exports = app;
