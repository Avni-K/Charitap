const crypto = require('crypto');
const axios = require('axios');

class EmbeddingService {
  constructor() {
    this.provider = process.env.EMBEDDINGS_PROVIDER || 'local';
    this.model = process.env.EMBEDDINGS_MODEL || 'text-embedding-3-small';
    this.dimensions = Number(process.env.EMBEDDINGS_DIMENSIONS || 128);
  }

  async embedText(text) {
    const input = String(text || '').trim();
    if (!input) return null;

    if (this.provider === 'openai') {
      return this.embedWithOpenAI(input);
    }

    return this.embedLocally(input);
  }

  async embedWithOpenAI(input) {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('[EmbeddingService] OPENAI_API_KEY missing; using local fallback embedding');
      return this.embedLocally(input);
    }

    const response = await axios.post(
      'https://api.openai.com/v1/embeddings',
      {
        model: this.model,
        input,
        dimensions: this.dimensions
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    return response.data?.data?.[0]?.embedding || null;
  }

  embedLocally(input) {
    const vector = new Array(this.dimensions).fill(0);
    const terms = input.toLowerCase().match(/[a-z0-9]+/g) || [];

    for (const term of terms) {
      const digest = crypto.createHash('sha256').update(term).digest();
      const index = digest[0] % this.dimensions;
      const sign = digest[1] % 2 === 0 ? 1 : -1;
      vector[index] += sign * (1 + Math.min(term.length, 12) / 12);
    }

    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    if (!magnitude) return vector;
    return vector.map(value => Number((value / magnitude).toFixed(8)));
  }

  cosineSimilarity(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
    let dot = 0;
    let aMag = 0;
    let bMag = 0;
    for (let i = 0; i < a.length; i += 1) {
      dot += Number(a[i]) * Number(b[i]);
      aMag += Number(a[i]) ** 2;
      bMag += Number(b[i]) ** 2;
    }
    if (!aMag || !bMag) return 0;
    return dot / (Math.sqrt(aMag) * Math.sqrt(bMag));
  }
}

module.exports = new EmbeddingService();
