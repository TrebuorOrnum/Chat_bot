import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';
import path from 'path';

const KNOWLEDGE_FILE = path.join(process.cwd(), 'knowledge.json');

export async function fetchAndIndexContent() {
  try {
    console.log('Starting to fetch content from brackenfellgas.co.za...');
    const baseUrl = 'https://brackenfellgas.co.za';
    
    // Pages to scrape
    const pages = [
      '/',
      '/collections/gas-cylinders',
      '/collections/braai',
      '/collections/appliances',
      '/collections/camping',
      '/collections/gas'
    ];

    let allText = '';

    for (const page of pages) {
      try {
        const response = await axios.get(`${baseUrl}${page}`);
        const $ = cheerio.load(response.data);
        
        // Remove scripts, styles, etc
        $('script, style, noscript, iframe, img, svg, nav, footer').remove();
        
        const text = $('body').text().replace(/\s+/g, ' ').trim();
        allText += `\n--- PAGE: ${page} ---\n${text}\n`;
      } catch (e: any) {
        console.error(`Error fetching ${page}:`, e.message);
      }
    }

    const knowledge = {
      lastUpdated: new Date().toISOString(),
      content: allText
    };

    await fs.writeFile(KNOWLEDGE_FILE, JSON.stringify(knowledge, null, 2));
    console.log('Knowledge base updated successfully.');
    return knowledge;
  } catch (error) {
    console.error('Error in fetchAndIndexContent:', error);
    throw error;
  }
}

export async function getKnowledgeContext() {
  try {
    const data = await fs.readFile(KNOWLEDGE_FILE, 'utf-8');
    const knowledge = JSON.parse(data);
    return knowledge.content;
  } catch (error) {
    console.log('No existing knowledge base found. Will try to fetch.');
    return null;
  }
}
