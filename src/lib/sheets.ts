import { google } from 'googleapis';

// Initialize Google Sheets API
const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

// Get the main spreadsheet
export const getSpreadsheet = async () => {
  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
    });
    return response.data;
  } catch (error) {
    console.error('Error getting spreadsheet:', error);
    throw error;
  }
};

// Get all sheets in the spreadsheet
export const getAllSheets = async () => {
  try {
    const spreadsheet = await getSpreadsheet();
    return spreadsheet.sheets || [];
  } catch (error) {
    console.error('Error getting all sheets:', error);
    throw error;
  }
};

// Get data from a specific sheet
export const getSheetData = async (sheetName: string) => {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: sheetName,
    });
    return response.data.values || [];
  } catch (error) {
    console.error(`Error getting data from sheet ${sheetName}:`, error);
    throw error;
  }
};

// Append data to a specific sheet
export const appendToSheet = async (sheetName: string, values: unknown[][]) => {
  try {
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: sheetName,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values,
      },
    });
    return response.data;
  } catch (error) {
    console.error(`Error appending data to sheet ${sheetName}:`, error);
    throw error;
  }
};

// Create a new sheet
export const createSheet = async (sheetName: string) => {
  try {
    const response = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetName,
              },
            },
          },
        ],
      },
    });
    return response.data;
  } catch (error) {
    console.error(`Error creating sheet ${sheetName}:`, error);
    throw error;
  }
};

// Delete a row from a sheet
export const deleteRow = async (sheetName: string, rowIndex: number) => {
  try {
    // Get the sheet ID first
    const spreadsheet = await getSpreadsheet();
    const sheet = spreadsheet.sheets?.find(
      (s) => s.properties?.title === sheetName
    );
    
    if (!sheet || !sheet.properties?.sheetId) {
      throw new Error(`Sheet ${sheetName} not found`);
    }
    
    const response = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheet.properties.sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex,
                endIndex: rowIndex + 1,
              },
            },
          },
        ],
      },
    });
    return response.data;
  } catch (error) {
    console.error(`Error deleting row from sheet ${sheetName}:`, error);
    throw error;
  }
};

// Create a new table in a sheet (for events)
export const createTable = async (sheetName: string, tableName: string, headers: string[]) => {
  try {
    // First, get the sheet data to see if the table already exists
    const data = await getSheetData(sheetName);
    
    // Check if the table exists by looking for a row with the table name
    const tableExists = data.some((row) => row[0] === tableName);
    
    if (tableExists) {
      throw new Error(`Table ${tableName} already exists in sheet ${sheetName}`);
    }
    
    // Add the table name as a separator row
    await appendToSheet(sheetName, [[tableName]]);
    
    // Add the headers
    await appendToSheet(sheetName, [headers]);
    
    return { success: true, message: `Table ${tableName} created in sheet ${sheetName}` };
  } catch (error) {
    console.error(`Error creating table ${tableName} in sheet ${sheetName}:`, error);
    throw error;
  }
};

// Get data from a specific table in a sheet
export const getTableData = async (sheetName: string, tableName: string): Promise<string[][]> => {
  try {
    console.log(`Fetching table data for ${tableName} in sheet ${sheetName}`);
    const data = await getSheetData(sheetName);
    
    if (!data || data.length === 0) {
      console.error(`Sheet ${sheetName} is empty or does not exist`);
      throw new Error(`Sheet ${sheetName} is empty or does not exist`);
    }
    
    console.log(`Sheet ${sheetName} has ${data.length} rows`);
    
    // Try direct match first
    let tableStartIndex = -1;
    for (let i = 0; i < data.length; i++) {
      if (data[i] && data[i][0] === tableName) {
        console.log(`Found exact match for table ${tableName} at row ${i}`);
        tableStartIndex = i;
        break;
      }
    }
    
    // If no direct match, try case-insensitive match
    if (tableStartIndex === -1) {
      const normalizedTableName = tableName.trim().toLowerCase();
      for (let i = 0; i < data.length; i++) {
        if (data[i] && data[i][0] && data[i][0].trim().toLowerCase() === normalizedTableName) {
          console.log(`Found case-insensitive match for table ${tableName} at row ${i}: ${data[i][0]}`);
          tableStartIndex = i;
          break;
        }
      }
    }
    
    if (tableStartIndex === -1) {
      console.error(`Table ${tableName} not found in sheet ${sheetName}`);
      console.log('Available tables:');
      for (let i = 0; i < data.length; i++) {
        if (data[i] && data[i].length === 1 && data[i][0]) {
          console.log(`- ${data[i][0]} (row ${i})`);
        }
      }
      throw new Error(`Table ${tableName} not found in sheet ${sheetName}`);
    }
    
    // Find the table end index (next table start or end of data)
    let tableEndIndex = data.length;
    for (let i = tableStartIndex + 1; i < data.length; i++) {
      // If we find another row with just one cell, it's likely the next table
      if (data[i].length === 1 && data[i][0] !== '') {
        tableEndIndex = i;
        break;
      }
    }
    
    console.log(`Table ${tableName} spans from row ${tableStartIndex + 1} to ${tableEndIndex - 1}`);
    
    // Extract the table data (including headers)
    const tableData = data.slice(tableStartIndex + 1, tableEndIndex);
    
    return tableData;
  } catch (error) {
    console.error(`Error getting data from table ${tableName} in sheet ${sheetName}:`, error);
    throw error;
  }
};

// Add data to a specific table in a sheet
export const addToTable = async (sheetName: string, tableName: string, rowData: unknown[]) => {
  try {
    console.log(`=== ADDING DATA TO TABLE ===`);
    console.log(`Table name requested: "${tableName}"`);
    console.log(`Sheet name: "${sheetName}"`);
    
    // Get the sheet data first
    const data = await getSheetData(sheetName);
    
    if (!data || data.length === 0) {
      console.error(`Sheet ${sheetName} is empty or does not exist`);
      throw new Error(`Sheet ${sheetName} is empty or does not exist`);
    }
    
    console.log(`Sheet data has ${data.length} rows`);
    
    // Get the spreadsheet to retrieve sheet ID
    const spreadsheet = await getSpreadsheet();
    const sheet = spreadsheet.sheets?.find(
      (s) => s.properties?.title === sheetName
    );
    
    if (!sheet || !sheet.properties?.sheetId) {
      throw new Error(`Sheet ${sheetName} not found`);
    }
    
    const sheetId = sheet.properties.sheetId;
    console.log(`Sheet ID: ${sheetId}`);
    
    // Debug: Print all potential table names in this sheet
    console.log(`=== ALL POTENTIAL TABLES IN SHEET ${sheetName} ===`);
    const potentialTables = [];
    for (let i = 0; i < data.length; i++) {
      if (data[i] && data[i].length === 1 && data[i][0]) {
        console.log(`Row ${i}: "${data[i][0]}"`);
        potentialTables.push({ row: i, name: data[i][0] });
      }
    }
    
    // Try direct match first
    let tableStartIndex = -1;
    let exactTableName = tableName;
    
    console.log(`=== SEARCHING FOR TABLE "${tableName}" ===`);
    
    // First try exact match
    for (let i = 0; i < data.length; i++) {
      if (data[i] && data[i][0] === tableName) {
        console.log(`FOUND EXACT MATCH for table "${tableName}" at row ${i}`);
        tableStartIndex = i;
        break;
      }
    }
    
    // If no direct match, try case-insensitive match
    if (tableStartIndex === -1) {
      console.log(`No exact match found, trying case-insensitive match`);
      const normalizedTableName = tableName.trim().toLowerCase();
      
      for (let i = 0; i < data.length; i++) {
        if (data[i] && data[i][0] && data[i][0].trim().toLowerCase() === normalizedTableName) {
          console.log(`FOUND CASE-INSENSITIVE MATCH: "${data[i][0]}" at row ${i}`);
          exactTableName = data[i][0]; // Use the exact table name from the sheet
          tableStartIndex = i;
          break;
        }
      }
    }
    
    if (tableStartIndex === -1) {
      console.error(`!!! TABLE NOT FOUND: "${tableName}" in sheet "${sheetName}"`);
      console.log(`Available tables:`, potentialTables.map(t => t.name).join(', '));
      throw new Error(`Table ${tableName} not found in sheet ${sheetName}`);
    }
    
    // Find the table end index (next table start or end of data)
    let tableEndIndex = data.length;
    for (let i = tableStartIndex + 1; i < data.length; i++) {
      // If we find another row with just one cell, it's likely the next table
      if (data[i].length === 1 && data[i][0] !== '') {
        tableEndIndex = i;
        break;
      }
    }
    
    console.log(`Table "${exactTableName}" spans from row ${tableStartIndex} to ${tableEndIndex - 1}`);
    
    // Calculate the position to add new data
    // We need to respect:
    // 1. Table name row
    // 2. Headers row
    // 3. Settings row (first data row)
    // So we start from tableStartIndex + 3 (after these 3 rows)
    
    // Start from the position after the settings row
    let insertPosition = tableStartIndex + 3; 
    
    console.log(`Initial insert position (after table name, headers, settings): ${insertPosition}`);
    
    // Check if the insert position is beyond the table end
    // This shouldn't happen in normal cases, but just to be safe
    if (insertPosition >= tableEndIndex) {
      insertPosition = tableEndIndex;
    }
    
    console.log(`Final insert position: ${insertPosition}`);
    console.log(`Data to add:`, rowData);
    
    // Convert the row data to a CellData array
    const cellData = rowData.map(value => ({
      userEnteredValue: {
        // Convert the value to the appropriate type
        // For simplicity, treat everything as a string
        stringValue: value?.toString() || ''
      }
    }));
    
    // Use insertDimension to create a new row at the specific position
    // Then use updateCells to populate the cells with data
    const response = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      requestBody: {
        requests: [
          // First, insert a new row at the position
          {
            insertDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: insertPosition,
                endIndex: insertPosition + 1
              },
              inheritFromBefore: false
            }
          },
          // Then, update the cells in that row with the data
          {
            updateCells: {
              start: {
                sheetId: sheetId,
                rowIndex: insertPosition,
                columnIndex: 0
              },
              rows: [
                {
                  values: cellData
                }
              ],
              fields: 'userEnteredValue'
            }
          }
        ]
      }
    });
    
    console.log(`=== DATA ADDED SUCCESSFULLY ===`);
    
    return response.data;
  } catch (error) {
    console.error(`ERROR adding data to table ${tableName} in sheet ${sheetName}:`, error);
    throw error;
  }
};

// Delete a table from a sheet
export const deleteTable = async (sheetName: string, tableName: string) => {
  try {
    // Get the sheet ID first
    const spreadsheet = await getSpreadsheet();
    const sheet = spreadsheet.sheets?.find(
      (s) => s.properties?.title === sheetName
    );
    
    if (!sheet || !sheet.properties?.sheetId) {
      throw new Error(`Sheet ${sheetName} not found`);
    }
    
    const data = await getSheetData(sheetName);
    
    // Find the table start index
    let tableStartIndex = -1;
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === tableName) {
        tableStartIndex = i;
        break;
      }
    }
    
    if (tableStartIndex === -1) {
      throw new Error(`Table ${tableName} not found in sheet ${sheetName}`);
    }
    
    // Find the table end index (next table start or end of data)
    let tableEndIndex = data.length;
    for (let i = tableStartIndex + 1; i < data.length; i++) {
      // If we find another row with just one cell, it's likely the next table
      if (data[i].length === 1 && data[i][0] !== '') {
        tableEndIndex = i;
        break;
      }
    }
    
    // Delete the table rows
    const response = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheet.properties.sheetId,
                dimension: 'ROWS',
                startIndex: tableStartIndex,
                endIndex: tableEndIndex,
              },
            },
          },
        ],
      },
    });
    
    return response.data;
  } catch (error) {
    console.error(`Error deleting table ${tableName} from sheet ${sheetName}:`, error);
    throw error;
  }
};

// Update a specific row in a sheetuuuuu
export const updateRow = async (sheetName: string, rowIndex: number, values: unknown[]) => {
  try {
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${sheetName}!A${rowIndex + 1}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [values],
      },
    });
    return response.data;
  } catch (error) {
    console.error(`Error updating row in sheet ${sheetName}:`, error);
    throw error;
  }
};

// Rename a sheet
export const renameSheet = async (oldName: string, newName: string) => {
  try {
    // Get the sheet ID first
    const spreadsheet = await getSpreadsheet();
    const sheet = spreadsheet.sheets?.find(
      (s) => s.properties?.title === oldName
    );
    
    if (!sheet || !sheet.properties?.sheetId) {
      throw new Error(`Sheet ${oldName} not found`);
    }
    
    const response = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId: sheet.properties.sheetId,
                title: newName,
              },
              fields: 'title',
            },
          },
        ],
      },
    });
    return response.data;
  } catch (error) {
    console.error(`Error renaming sheet from ${oldName} to ${newName}:`, error);
    throw error;
  }
}; 