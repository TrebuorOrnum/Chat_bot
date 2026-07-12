import { getAccessToken } from './firebase';

const SPREADSHEET_ID = '1KXRkkAMRZsInOJ1Hc5VVXydZ5RYWbGteGqIKlosX6gY';

export const appendUserDetailsToSheet = async (userDetails: { name: string; phone: string; email: string }) => {
  try {
    const token = await getAccessToken();
    if (!token) {
      console.warn('No access token available for Sheets API');
      return;
    }

    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/A1:append?valueInputOption=USER_ENTERED`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [
          [new Date().toISOString(), userDetails.name, userDetails.phone, userDetails.email]
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Failed to append to sheet', errorData);
    }
  } catch (err) {
    console.error('Error appending to sheet:', err);
  }
};
