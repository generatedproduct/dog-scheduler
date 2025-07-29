/*
 * Simple Express application for scheduling dog meetings.  
 *
 * This server exposes two primary endpoints:
 *   - `POST /submit` accepts form submissions containing a date,
 *     time, the dog's name, an address where the meeting will be held,
 *     and a yes/no flag indicating whether this is the first meeting.
 *     Submitted data is appended as a new row to a Google Sheet.  
 *   - `GET /appointments` retrieves all existing rows from the
 *     configured sheet and renders them as an HTML table so you can
 *     review pending appointments.
 *
 * To use this server you'll need to perform a few setup tasks:
 *   1. Create a Google Cloud project, enable the Google Sheets API and
 *      generate a service account with a JSON key file. The service
 *      account email should be added as an editor to your target sheet
 *      so the app can write data【457169276497544†L34-L59】.
 *   2. Set the following environment variables:
 *        SPREADSHEET_ID   – The ID portion of the sheet URL (e.g.
 *                           `1X2Y3Z4W5V6U7T8S9R0Q` from
 *                           docs.google.com/spreadsheets/d/1X2Y3Z4W5V6U7T8S9R0Q/edit)
 *        SHEET_NAME       – The name of the tab within the sheet (e.g. `Sheet1`)
 *        GOOGLE_APPLICATION_CREDENTIALS – Absolute path to your service
 *                           account JSON file.
 *   3. Install the dependencies defined in package.json (e.g.
 *      run `npm install`).
 *   4. Run `npm start` to start the server.
 *
 * Once running locally you can deploy this app to a platform like
 * Heroku by committing it to Git and using the Heroku CLI. When
 * deploying to Heroku you'll need to create a `Procfile` and set
 * your environment variables in the Heroku dashboard. The Heroku
 * deployment process looks at your `Procfile` or the `start` script
 * in `package.json` to determine how to run the app【841757066900567†L327-L333】. After committing,
 * you can push the repository to Heroku using the `git push heroku
 * main` command【841757066900567†L364-L383】.
 */

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse form data
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve static assets from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Helper function to append a row to Google Sheets
async function appendRow(values) {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  const sheetName = process.env.SHEET_NAME || 'Sheet1';

  if (!spreadsheetId) {
    throw new Error('SPREADSHEET_ID environment variable is not set');
  }
  // Authenticate with Google using service account credentials
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });
  // With additional fields (payment method and notes), write up to column G
  const range = `${sheetName}!A2:G`;
  const request = {
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    resource: {
      values: [values],
    },
  };
  await sheets.spreadsheets.values.append(request);
}

// Helper function to list all appointments from Google Sheets
async function listAppointments() {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  const sheetName = process.env.SHEET_NAME || 'Sheet1';
  if (!spreadsheetId) {
    throw new Error('SPREADSHEET_ID environment variable is not set');
  }
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    // Fetch up to column G to include payment method and notes
    range: `${sheetName}!A2:G`,
  });
  return response.data.values || [];
}

// POST endpoint to handle form submission
app.post('/submit', async (req, res) => {
  try {
    const { date, time, dogName, address, firstTime, paymentMethod, notes } = req.body;
    // Construct row: Date, Time, Dog name, Address, First time flag, Payment method, Notes
    const first = firstTime === 'on' || firstTime === 'Yes' ? 'Yes' : 'No';
    const row = [date, time, dogName, address, first, paymentMethod || '', notes || ''];
    await appendRow(row);
    // Redirect to thank you page or send a success message
    return res.redirect('/thankyou.html');
  } catch (err) {
    console.error('Error appending row:', err);
    return res.status(500).send('There was an error saving your appointment.');
  }
});

// GET endpoint to display all appointments
app.get('/appointments', async (req, res) => {
  try {
    const rows = await listAppointments();
    // Build simple HTML table
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pending Appointments</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body class="admin">
  <h1>Pending Appointments</h1>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Time</th>
        <th>Dog Name</th>
        <th>Address</th>
        <th>First Time</th>
        <th>Payment</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>`;
    for (const row of rows) {
      html += '<tr>';
      html += `<td>${row[0] || ''}</td>`;
      html += `<td>${row[1] || ''}</td>`;
      html += `<td>${row[2] || ''}</td>`;
      html += `<td>${row[3] || ''}</td>`;
      html += `<td>${row[4] || ''}</td>`;
      html += `<td>${row[5] || ''}</td>`;
      html += `<td>${row[6] || ''}</td>`;
      html += '</tr>';
    }
    html += `</tbody>
  </table>
  <p><a href="/index.html">Back to schedule form</a></p>
</body>
</html>`;
    res.send(html);
  } catch (err) {
    console.error('Error retrieving appointments:', err);
    return res.status(500).send('Unable to fetch appointments.');
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});