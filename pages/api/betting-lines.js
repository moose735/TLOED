// pages/api/betting-lines.js

import getBettingLines from '@/utils/bettingCalculations';

export default async function handler(req, res) {
  try {
    const lines = await getBettingLines();
    res.status(200).json(lines);
  } catch (err) {
    console.error('Error generating lines:', err);
    res.status(500).json({ error: 'Failed to generate betting lines' });
  }
}
