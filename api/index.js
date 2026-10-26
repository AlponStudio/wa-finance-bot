const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Config & API Keys
const SUPABASE_URL = 'https://qqkusyfjyknbitzudgbj.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_eIyoWRMJc7DNWlrdQpOitg_3cMBhTWv'; 
const GEMINI_API_KEY = 'AQ.Ab8RN6LIaF8mi-HGl23weV1GX99LdnH2wEdCdFB8ezz-_N7Xkw'; 
const FONNTE_TOKEN = 'nbwwLRG5gzP4UK9oAvHQ'; 

// Nomor Bot Baru
const NEW_BOT_NUMBER = '6281212882363';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

app.get('/', (req, res) => res.status(200).send('Server Vercel Berjalan Normal!'));
app.get('/webhook', (req, res) => res.status(200).send('Webhook Vercel Berhasil Aktif!'));

app.post('/webhook', async (req, res) => {
  try {
    const message = req.body.message || req.body.text || '';
    const imageUrl = req.body.url || req.body.file || '';
    
    // Target balasan (ID Grup atau Nomor Pengirim)
    const target = req.body.group || req.body.target || req.body.sender || '';

    const msgLower = message.toLowerCase();
    const hasKeyword = msgLower.includes('pengajuan reimburse') || msgLower.includes('pemasukan');

    // Cek mention nomor baru atau tanda @
    const mentionedList = req.body.mentioned || [];
    const isMentioned = Array.isArray(mentionedList) && mentionedList.length > 0
      ? true
      : message.includes(`@${NEW_BOT_NUMBER}`) || message.includes('081212882363') || message.includes('@');

    if (isMentioned && hasKeyword) {
      let nominal = 0;
      let tipe = msgLower.includes('pemasukan') ? 'pemasukan' : 'pengeluaran';

      // Ekstraksi nominal angka dari teks
      const matches = message.match(/\d[\d.,]*/g);
      if (matches) {
        const cleanNum = matches[matches.length - 1].replace(/[.,]/g, '');
        if (!isNaN(cleanNum)) nominal = parseFloat(cleanNum);
      }

      // Ekstraksi dari gambar via Gemini AI
      if (imageUrl && GEMINI_API_KEY) {
        try {
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
        } catch (aiErr) {
          console.error('Gemini AI Error:', aiErr.message);
        }
      }

      // Simpan data ke Supabase
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

      const replyText = `✅ *Data Berhasil Dicatat*\n💰 Nominal: Rp ${nominal.toLocaleString('id-ID')}\n📝 Keterangan: ${message}`;

      // Kirim balasan via API Fonnte
      if (target) {
        try {
          await axios.post('https://api.fonnte.com/send', {
            target: target,
            message: replyText
          }, {
            headers: { 'Authorization': FONNTE_TOKEN }
          });
        } catch (fonnteErr) {
          console.error('Fonnte Send API Error:', fonnteErr.response?.data || fonnteErr.message);
        }
      }

      return res.status(200).json({ status: true, reply: replyText });
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error('General Error:', err);
    res.status(500).send('Error processing request');
  }
});

module.exports = app;
