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
const MY_PHONE_NUMBER = '6289668184078'; 
const FONNTE_TOKEN = 'nbwwLRG5gzP4UK9oAvHQ'; 

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

app.get('/', (req, res) => res.status(200).send('Server Vercel Berjalan Normal!'));
app.get('/webhook', (req, res) => res.status(200).send('Webhook Vercel Berhasil Aktif!'));

app.post('/webhook', async (req, res) => {
  try {
    // Fonnte mengirimkan 'target' atau 'group' atau 'sender'
    const message = req.body.message || req.body.text || '';
    const imageUrl = req.body.url || req.body.file || '';
    
    // Untuk grup, target balasan adalah ID grup (req.body.group atau req.body.target)
    const target = req.body.group || req.body.target || req.body.sender || '';

    // Cek apakah nomor kamu di-tag / di-mention
    const mentionedList = req.body.mentioned || [];
    const isMentioned = Array.isArray(mentionedList) 
      ? mentionedList.includes(MY_PHONE_NUMBER) 
      : message.includes(`@${MY_PHONE_NUMBER}`) || message.includes('089668184078') || message.includes('@bot');

    const msgLower = message.toLowerCase();

    // Jalankan jika di-tag DAN ada kata kunci
    if (isMentioned && (msgLower.includes('pengajuan reimburse') || msgLower.includes('pemasukan'))) {
      let nominal = 0;
      let tipe = msgLower.includes('pemasukan') ? 'pemasukan' : 'pengeluaran';

      // Ekstraksi nominal angka dari teks
      const matches = message.match(/\d[\d.,]*/g);
      if (matches) {
        const cleanNum = matches[matches.length - 1].replace(/[.,]/g, '');
        if (!isNaN(cleanNum)) nominal = parseFloat(cleanNum);
      }

      // Ekstraksi dari gambar via Gemini AI jika ada foto
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
          category: 'WhatsApp Upload (Group)',
          amount: nominal,
          description: message,
          proof_url: imageUrl,
          status: 'Pending'
        }
      ]);

      const replyText = `✅ *Data Berhasil Dicatat*\n💰 Nominal: Rp ${nominal.toLocaleString('id-ID')}\n📝 Keterangan: ${message}`;

      // Tembak API Fonnte untuk membalas langsung ke Grup
      if (target) {
        try {
          await axios.post('https://api.fonnte.com/send', {
            target: target,
            message: replyText
          }, {
            headers: { 'Authorization': FONNTE_TOKEN }
          });
        } catch (fonnteErr) {
          console.error('Fonnte Send API Error:', fonnteErr.message);
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
