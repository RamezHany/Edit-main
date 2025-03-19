import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, addToTable, getTableData } from '@/lib/sheets';

// POST /api/events/register - Register for an event
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const {
      companyName: rawCompanyName,
      eventName: rawEventName,
      name,
      phone,
      email,
      gender,
      college,
      status,
      nationalId,
      age,
      university,
      level,
      faculty,
    } = body;
    
    // Ensure company name and event name are properly decoded
    const companyName = decodeURIComponent(rawCompanyName);
    const eventName = decodeURIComponent(rawEventName);
    
    console.log('=== REGISTRATION REQUEST RECEIVED ===');
    console.log('Company name (decoded):', companyName);
    console.log('Event name (decoded):', eventName);
    console.log('Registrant:', { name, email, phone, age, university, status, level, faculty });
    
    // Validate required fields
    if (!companyName || !eventName || !name || !phone || !email || !gender || !college || !status || !nationalId || !age || !university || !faculty) {
      console.log('Validation failed - missing fields:', {
        companyName: !!companyName,
        eventName: !!eventName,
        name: !!name,
        phone: !!phone,
        email: !!email,
        gender: !!gender,
        college: !!college,
        status: !!status,
        nationalId: !!nationalId,
        age: !!age,
        university: !!university,
        level: !!level,
        faculty: !!faculty,
      });
      
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }
    
    // Validate phone number (simple validation)
    const phoneRegex = /^\d{10,15}$/;
    if (!phoneRegex.test(phone)) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      );
    }
    
    // Validate age (must be a number)
    if (!/^\d+$/.test(age)) {
      return NextResponse.json(
        { error: 'Age must be a number' },
        { status: 400 }
      );
    }
    
    // Check if the company exists
    try {
      console.log('=== CHECKING COMPANY ===');
      console.log('Looking for company:', companyName);
      const sheetData = await getSheetData(companyName);
      
      if (!sheetData || sheetData.length === 0) {
        console.error(`Company sheet ${companyName} is empty or does not exist`);
        return NextResponse.json(
          { error: 'Company not found' },
          { status: 404 }
        );
      }
      
      console.log(`Company sheet found with ${sheetData.length} rows`);
      
      // Check if the company is disabled
      const companiesData = await getSheetData('companies');
      const companies = companiesData.slice(1); // Skip header row
      
      // Find the company
      const company = companies.find((row: string[]) => row[1] === companyName);
      
      if (company) {
        const status = company[5] || 'enabled';
        if (status === 'disabled') {
          return NextResponse.json(
            { error: 'Company is disabled, registration is not available' },
            { status: 403 }
          );
        }
      }
      
      // Find the exact event in the sheet data
      console.log('=== SEARCHING FOR EVENT ===');
      console.log('Event name to find:', eventName);
      let exactEventName = null;
      
      // First try to find an exact match for the event name
      for (let i = 0; i < sheetData.length; i++) {
        if (sheetData[i].length === 1 && sheetData[i][0] === eventName) {
          exactEventName = sheetData[i][0];
          console.log(`EXACT MATCH FOUND for event: "${exactEventName}" at row ${i}`);
          break;
        }
      }
      
      // If no exact match, try case-insensitive
      if (!exactEventName) {
        console.log('No exact match found, trying case-insensitive search');
        const normalizedEventName = eventName.trim().toLowerCase();
        console.log('Normalized event name:', normalizedEventName);
        
        // Print all possible events (debug)
        console.log('All events in sheet:');
        for (let i = 0; i < sheetData.length; i++) {
          if (sheetData[i].length === 1 && sheetData[i][0]) {
            console.log(`- Row ${i}: "${sheetData[i][0]}" (normalized: "${sheetData[i][0].trim().toLowerCase()}")`);
          }
        }
        
        for (let i = 0; i < sheetData.length; i++) {
          if (sheetData[i].length === 1 && 
              sheetData[i][0] && 
              sheetData[i][0].trim().toLowerCase() === normalizedEventName) {
            exactEventName = sheetData[i][0];
            console.log(`CASE-INSENSITIVE MATCH FOUND for event: "${exactEventName}" at row ${i}`);
            break;
          }
        }
      }
      
      // If still no match, log all tables for debugging
      if (!exactEventName) {
        console.error(`!!! EVENT NOT FOUND: "${eventName}" in company "${companyName}"`);
        return NextResponse.json(
          { error: 'Event not found' },
          { status: 404 }
        );
      }
      
      // Now we have the exact event name, get the table data
      try {
        console.log('=== GETTING TABLE DATA ===');
        console.log(`Using exact event name: "${exactEventName}"`);
        
        const tableData = await getTableData(companyName, exactEventName);
        
        if (!tableData || tableData.length === 0) {
          console.error(`Table data empty for event ${exactEventName} in company ${companyName}`);
          return NextResponse.json(
            { error: 'Event data not found' },
            { status: 404 }
          );
        }
        
        // Check if the event is disabled
        const headers = tableData[0];
        const statusIndex = headers.findIndex(h => h === 'EventStatus');
        
        if (statusIndex !== -1 && tableData.length > 1) {
          const eventStatus = tableData[1][statusIndex];
          if (eventStatus === 'disabled') {
            return NextResponse.json(
              { error: 'Event registration is currently disabled' },
              { status: 403 }
            );
          }
        }
        
        // Check if the person is already registered (by email or phone)
        // Skip header row
        const registrationData = tableData.slice(1);
        
        // Find registration with matching email or phone
        const existingRegistration = registrationData.find(
          (row: string[]) => row[2] === email || row[1] === phone
        );
        
        if (existingRegistration) {
          return NextResponse.json(
            { error: 'You are already registered for this event' },
            { status: 400 }
          );
        }
        
        // Add registration to the event table
        const registrationDate = new Date().toISOString();
        
        console.log('=== ADDING REGISTRATION ===');
        console.log('Company name:', companyName);
        console.log('Event name (exact):', exactEventName);
        console.log('Registrant:', { name, email, age, university, status, level, faculty });
        
        await addToTable(companyName, exactEventName, [
          name,
          phone,
          email,
          gender,
          college,
          status,
          nationalId,
          registrationDate,
          '', // No image for registrations
          age,
          university,
          level || '',
          faculty,
        ]);
        
        console.log('=== REGISTRATION SUCCESSFUL ===');
        
        return NextResponse.json({
          success: true,
          message: 'Registration successful',
          registration: {
            name,
            email,
            age,
            university,
            eventName: exactEventName,
            registrationDate,
          },
        });
      } catch (error) {
        console.error('Error processing registration:', error);
        return NextResponse.json(
          { error: 'Failed to process registration' },
          { status: 500 }
        );
      }
    } catch (error) {
      console.error('Error checking company:', error);
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Error registering for event:', error);
    return NextResponse.json(
      { error: 'Failed to register for event' },
      { status: 500 }
    );
  }
} 