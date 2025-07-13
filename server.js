const express = require('express');
const axios = require('axios');
require('dotenv').config();
const supabase = require('./supabaseClient');

const app = express();
app.use(express.json());

app.post('/webhook', async (req, res) => {
  const { from, message } = req.body;

  // Simpan pesan user
  await supabase.from('messages').insert({
    from,
    type: 'user',
    message,
    timestamp: new Date().toISOString()
  });

  // Ambil memory 24 jam terakhir
  const { data: history } = await supabase
    .from('messages')
    .select('message, type')
    .eq('from', from)
    .gt('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  const prompt = history.map(m => `${m.type === 'user' ? 'User' : 'Aurel'}: ${m.message}`).join('\n') + `\nAurel:`;

  // Kirim ke OpenAI
  const aiRes = await axios.post('https://api.openai.com/v1/completions', {
    model: 'text-davinci-003',
    prompt,
    max_tokens: 100,
    temperature: 0.7,
  }, {
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    }
  });

  const aiReply = aiRes.data.choices[0].text.trim();

  // Simpan balasan Aurel
  await supabase.from('messages').insert({
    from: 'aurel',
    type: 'aurel',
    message: aiReply,
    timestamp: new Date().toISOString()
  });

  // Kirim balasan ke Ultramsg
  await axios.post(`https://api.ultramsg.com/${process.env.ULTRAMSG_INSTANCE_ID}/messages/chat`, {
    to: from,
    body: aiReply
  }, {
    headers: {
      'Content-Type': 'application/json',
      'token': process.env.ULTRAMSG_TOKEN
    }
  });

  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Aurel server listening on port ${PORT}`));
