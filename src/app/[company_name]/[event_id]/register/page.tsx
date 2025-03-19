'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

interface FormData {
  name: string;
  phone: string;
  email: string;
  gender: 'male' | 'female';
  college: string;
  status: 'student' | 'graduate';
  nationalId: string;
  age: string;
  university: string;
  level?: string; // Optional level field for students
  faculty: string; // New field for faculty
}

interface FormErrors {
  name?: string;
  phone?: string;
  email?: string;
  college?: string;
  nationalId?: string;
  age?: string;
  university?: string;
  level?: string; // Optional level field validation
  faculty?: string; // New field for faculty validation
}

interface Event {
  id: string;
  name: string;
  image: string | null;
  description: string;
  date: string;
  registrations: number;
  status?: string;
  companyStatus?: string;
}

export default function EventRegistrationPage() {
  const params = useParams();
  // Decode URL-encoded parameters
  const companyName = decodeURIComponent(params.company_name as string);
  const eventId = decodeURIComponent(params.event_id as string);
  
  const [formData, setFormData] = useState<FormData>({
    name: '',
    phone: '',
    email: '',
    gender: 'male',
    college: '',
    status: 'student',
    nationalId: '',
    age: '',
    university: '',
    level: '1', // Default level for students
    faculty: '', // Default empty faculty
  });
  
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [event, setEvent] = useState<Event | null>(null);
  const [eventDisabled, setEventDisabled] = useState(false);
  const [companyDisabled, setCompanyDisabled] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Get the theme from localStorage on component mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      setTheme('light');
    }
  }, []);

  // Update localStorage when theme changes
  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('light-theme', theme === 'light');
    
    // Apply theme to document body - set light mode as default
    if (typeof document !== 'undefined') {
      if (theme === 'light') {
        document.body.classList.add('light-theme');
        document.body.classList.remove('dark-theme');
      } else {
        document.body.classList.add('dark-theme');
        document.body.classList.remove('light-theme');
      }
    }
  }, [theme]);

  // Set light mode as default theme
  useEffect(() => {
    setTheme('light');
  }, []);

  useEffect(() => {
    // Fetch event details to verify it exists and get the image
    const fetchEventDetails = async () => {
      try {
        console.log('Fetching events for company:', companyName);
        console.log('Event ID from URL (exact):', eventId);
        
        const response = await fetch(`/api/events?company=${encodeURIComponent(companyName)}`);
        
        if (!response.ok) {
          // Check if the company is disabled
          if (response.status === 403) {
            setCompanyDisabled(true);
            throw new Error('Company is disabled');
          }
          throw new Error('Failed to fetch event details');
        }
        
        const data = await response.json();
        console.log('Events received:', data.events);
        
        // Find the event that matches (case insensitive)
        const normalizedEventId = eventId.trim().toLowerCase();
        const foundEvent = data.events.find(
          (e: Event) => e.id.trim().toLowerCase() === normalizedEventId
        );
        
        if (!foundEvent) {
          console.error('Event not found:', { eventId, availableEvents: data.events.map((e: Event) => e.id) });
          throw new Error('Event not found');
        }
        
        console.log('Found matching event:', foundEvent);
        setEvent(foundEvent);
        
        // Check if event is disabled
        if (foundEvent.status === 'disabled') {
          setEventDisabled(true);
        }
        
        // Check if company is disabled
        if (foundEvent.companyStatus === 'disabled') {
          setCompanyDisabled(true);
        }
      } catch (error) {
        console.error('Error fetching event details:', error);
        if (!companyDisabled) {
          setError('Event not found or registration is closed');
        }
      }
    };
    
    fetchEventDetails();
  }, [companyName, eventId, companyDisabled]);

  const validateField = (name: string, value: string): string => {
    // Validate field
    switch (name) {
      case 'name':
        return value.length < 3 ? 'Name must be at least 3 characters' : '';
      case 'email':
        return !/^\S+@\S+\.\S+$/.test(value) ? 'Please enter a valid email address' : '';
      case 'phone':
        return !/^[0-9]{10,15}$/.test(value) ? 'Please enter a valid phone number' : '';
      case 'age':
        const age = parseInt(value);
        if (isNaN(age) || age < 1 || age > 100) {
          return 'Please enter a valid age between 1 and 100';
        }
        return '';
      case 'nationalId':
        return value.length < 8 ? 'Please enter a valid National ID' : '';
      case 'level':
        if (formData.status === 'student' && (value === '' || !['1', '2', '3', '4', '5'].includes(value))) {
          return 'Please select a valid level';
        }
        return '';
      case 'faculty':
        return value.length < 2 ? 'Please enter a valid faculty' : '';
      default:
        return value.length < 1 ? 'This field is required' : '';
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    
    // Special handling for age to ensure it's only numbers
    if (name === 'age') {
      // Only update if empty or numeric
      if (value === '' || /^\d+$/.test(value)) {
        setFormData((prev) => ({ ...prev, [name]: value }));
      }
    } else if (name === 'status' && value === 'graduate') {
      // If status changes to graduate, clear the level field
      setFormData((prev) => ({ ...prev, [name]: value, level: '' }));
    } else {
    setFormData((prev) => ({ ...prev, [name]: value }));
    }
    
    // Validate field on change
    const errorMessage = validateField(name, value);
    setFormErrors(prev => ({
      ...prev,
      [name]: errorMessage
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!event) {
      setError('Event information is missing. Please refresh the page and try again.');
      return;
    }
    
    // Check if event or company is disabled
    if (eventDisabled || companyDisabled) {
      setError('Registration is currently disabled for this event.');
      return;
    }
    
    // Validate all fields
    const errors: FormErrors = {};
    let hasErrors = false;
    
    Object.entries(formData).forEach(([key, value]) => {
      if (key === 'gender' || key === 'status') return; // Skip select fields
      
      const error = validateField(key, value as string);
      if (error) {
        errors[key as keyof FormErrors] = error;
        hasErrors = true;
      }
    });
    
    setFormErrors(errors);
    
    if (hasErrors) {
      return; // Stop form submission if there are errors
    }
    
    setSubmitting(true);
    setError('');
    
    try {
      // Use the original event ID from the URL
      console.log('Submitting registration with:', {
        companyName,
        eventName: eventId, // Use the exact event ID from the URL
        originalEventId: eventId,
        foundEventId: event.id
      });
      
      const response = await fetch('/api/events/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName,
          eventName: eventId, // Use the exact event ID from the URL
          ...formData,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to register for event');
      }
      
      // Show success message
      setSuccess(true);
      
      // Reset form
      setFormData({
        name: '',
        phone: '',
        email: '',
        gender: 'male',
        college: '',
        status: 'student',
        nationalId: '',
        age: '',
        university: '',
        level: '1', // Default level for students
        faculty: '', // Default empty faculty
      });
      setFormErrors({});
    } catch (error) {
      console.error('Error registering for event:', error);
      setError(error instanceof Error ? error.message : 'Failed to register for event');
    } finally {
      setSubmitting(false);
    }
  };

  if (error && !submitting) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}`}>
        <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} p-8 rounded-lg shadow-md w-full max-w-md text-center`}>
          <div className="text-red-500 text-xl mb-4">{error}</div>
          <Link href={`/${companyName}/${eventId}`} className="text-blue-500 hover:underline">
            Return to Event
          </Link>
        </div>
      </div>
    );
  }

  if (eventDisabled || companyDisabled) {
    return (
      <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'} py-12 px-4 sm:px-6 lg:px-8`}>
        <div className={`max-w-md mx-auto ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md overflow-hidden`}>
          <div className="p-6">
            <div className="flex items-center justify-center">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-red-600 mb-4">
                  {eventDisabled ? 'Registration Disabled' : 'Company Inactive'}
                </h2>
                <p className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'} mb-6`}>
                  {eventDisabled
                    ? 'Registration for this event is currently disabled. Please contact the organizer for more information.'
                    : 'This company\'s events are currently not available. Please contact the administrator for more information.'}
                </p>
                <Link
                  href={`/${companyName}/${eventId}`}
                  className="inline-block bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                >
                  Return to Event
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen relative overflow-hidden bg-gray-50`}>
      {/* Add CSS for theme transitions and Uber-style design */}
      <style jsx global>{`
        body {
          transition: background-color 0.3s ease, color 0.3s ease;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #333333;
          background-color: #f8f9fa;
        }
        
        .form-label {
          font-size: 0.9rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
          color: #4361ee;
          display: block;
          letter-spacing: 0.02em;
        }
        
        .form-input {
          width: 100%;
          padding: 0.9rem 1rem;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          background-color: white;
          transition: all 0.2s;
          font-size: 1rem;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        }
        
        .form-input:focus {
          outline: none;
          border-color: #4361ee;
          box-shadow: 0 0 0 2px rgba(67, 97, 238, 0.2);
          transform: translateY(-1px);
        }
        
        .form-input::placeholder {
          color: #a0aec0;
        }
        
        .section-title {
          font-size: 1.2rem;
          font-weight: 700;
          color: #3a0ca3;
          margin-bottom: 1.5rem;
          padding-bottom: 0.5rem;
          border-bottom: 2px solid #4361ee;
          display: inline-block;
        }
        
        .radio-label {
          display: flex;
          align-items: center;
          padding: 0.8rem 1.25rem;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          background-color: white;
          transition: all 0.2s;
          cursor: pointer;
          font-weight: 500;
          position: relative;
          overflow: hidden;
        }
        
        .radio-label::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 0;
          height: 100%;
          background-color: rgba(67, 97, 238, 0.08);
          transition: width 0.3s ease;
          z-index: 0;
        }
        
        .radio-label:hover::before {
          width: 100%;
        }
        
        .radio-label-selected {
          background-color: #4361ee;
          border-color: #3a0ca3;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(67, 97, 238, 0.15);
        }
        
        .radio-label-selected span {
          color: white !important;
        }
        
        .btn-primary {
          background-color: #4361ee;
          color: white;
          font-weight: 600;
          padding: 0.9rem 1.5rem;
          border-radius: 10px;
          transition: all 0.3s;
          border: none;
          cursor: pointer;
          width: 100%;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          font-size: 0.95rem;
        }
        
        .btn-primary:hover {
          background-color: #3a0ca3;
          transform: translateY(-2px);
          box-shadow: 0 10px 15px -3px rgba(67, 97, 238, 0.25);
        }
        
        /* Improved card shadow */
        .card-shadow {
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01);
          transition: all 0.3s ease;
        }
        
        .card-shadow:hover {
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 10px 10px -5px rgba(0, 0, 0, 0.02);
        }

        @keyframes shine {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        .animate-shine {
          animation: shine 3s infinite linear;
        }
        
        .emoji-icon {
          display: inline-block;
          margin-right: 0.5rem;
        }
        
        .highlight-text {
          background: linear-gradient(120deg, #3a0ca3, #4361ee);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          font-weight: 700;
        }
      `}</style>
      
      {/* Main Content */}
      <div className="max-w-4xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        
        {/* Header Section */}
        <header className="mb-10 text-center">
          <div className="mb-4">
            {companyName && (
              <div className="text-sm uppercase tracking-widest mb-1 font-bold text-blue-600">
                {companyName}
          </div>
            )}
            <h1 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-800 to-indigo-600 tracking-tight">
              {event?.name || 'Event Registration'} 
            </h1>
          </div>
          {event?.date && (
            <div className="text-sm bg-indigo-50 inline-flex rounded-full px-3 py-1 items-center font-medium text-indigo-700">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {new Date(event.date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
          </div>
        )}
        </header>
        
        {/* Form Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden card-shadow">
          {event?.image && (
            <div className="w-full relative" style={{ aspectRatio: '3/1' }}>
              <Image
                src={event.image}
                alt={`${event.name} Event`}
                fill
                style={{ objectFit: 'cover' }}
              />
            </div>
          )}
          
          <div className="p-6 md:p-8">
            {/* Error State */}
            {error && !submitting && (
              <div className="py-12 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-6">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Registration Error</h3>
                <p className="text-gray-500 mb-6">{error}</p>
                <Link href={`/${companyName}/${eventId}`} className="text-blue-600 hover:text-blue-800 font-medium">
                  Return to Event
                </Link>
              </div>
            )}
            
            {/* Disabled Event State */}
            {(eventDisabled || companyDisabled) && (
              <div className="py-12 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 mb-6">
                  <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {eventDisabled ? 'Registration Disabled' : 'Company Inactive'}
                </h3>
                <p className="text-gray-500 mb-6">
                  {eventDisabled
                    ? 'Registration for this event is currently disabled. Please contact the organizer for more information.'
                    : 'This company\'s events are currently not available. Please contact the administrator for more information.'}
                </p>
                <Link
                  href={`/${companyName}/${eventId}`}
                  className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Return to Event
                </Link>
              </div>
            )}
            
            {/* Success State */}
            {success && (
              <div className="py-10 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-6">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">You&apos;re In! <span className="emoji-icon">🎉</span></h3>
                <p className="text-gray-600 mb-8">Thanks for registering! We can&apos;t wait to see you there!</p>
                
                <div className="mb-8 text-left max-w-md mx-auto bg-indigo-50 rounded-lg p-5">
                  <h4 className="font-medium text-indigo-900 mb-3">Event Details</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    <span className="font-medium">Date:</span> {event?.date ? new Date(event.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }) : 'Date not specified'}
                </p>
                  <p className="text-sm text-gray-600 whitespace-pre-line">
                    <span className="font-medium">Description:</span> {event?.description || 'No description available.'}
                </p>
              </div>
              
                <Link
                  href={`/${companyName}/${eventId}`}
                  className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:via-indigo-700 hover:to-blue-800 shadow-md transition-all duration-200"
                >
                  Return to Event
                </Link>
              </div>
            )}
            
            {/* Registration Form */}
            {!success && !eventDisabled && !companyDisabled && (
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Form Error */}
              {error && (
                  <div className="p-4 rounded-md bg-red-50 mb-6">
                    <div className="flex">
                      <svg className="h-5 w-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              )}

                {/* Personal Information */}
                <div>
                  <h3 className="section-title">Personal Information <span className="emoji-icon">👤</span></h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Name */}
                    <div>
                      <label htmlFor="name" className="form-label">Full Name</label>
                      <input 
                        type="text" 
                        id="name" 
                        name="name" 
                        className="form-input" 
                        placeholder="Enter your full name" 
                        value={formData.name}
                            onChange={handleChange}
                        disabled={submitting}
                        required
                      />
                      {formErrors.name && (
                        <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                      )}
                  </div>

                  {/* Phone */}
                    <div>
                      <label htmlFor="phone" className="form-label">Phone Number</label>
                      <input 
                        type="text" 
                        id="phone" 
                        name="phone" 
                        className="form-input" 
                        placeholder="Enter your phone number" 
                        value={formData.phone}
                         onChange={handleChange}
                        disabled={submitting}
                        required
                      />
                      {formErrors.phone && (
                        <p className="mt-1 text-sm text-red-600">{formErrors.phone}</p>
                      )}
                  </div>
                  
                  {/* Email */}
                    <div>
                      <label htmlFor="email" className="form-label">Email Address</label>
                      <input 
                        type="email" 
                        id="email" 
                        name="email" 
                        className="form-input" 
                        placeholder="Enter your email address" 
                        value={formData.email}
                            onChange={handleChange}
                        disabled={submitting}
                        required
                      />
                      {formErrors.email && (
                        <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
                      )}
                  </div>
                  
                  {/* Age */}
                    <div>
                      <label htmlFor="age" className="form-label">Age</label>
                      <input 
                        type="text" 
                        id="age" 
                        name="age" 
                        className="form-input" 
                        placeholder="Enter your age" 
                        value={formData.age}
                            onChange={handleChange}
                        disabled={submitting}
                        required
                        pattern="\d+"
                        inputMode="numeric"
                      />
                      {formErrors.age && (
                        <p className="mt-1 text-sm text-red-600">{formErrors.age}</p>
                      )}
                  </div>
                </div>
              </div>

              {/* National ID */}
                <div>
                  <label htmlFor="nationalId" className="form-label">National ID</label>
                  <input 
                    type="text" 
                    id="nationalId" 
                    name="nationalId" 
                    className="form-input" 
                    placeholder="Enter your national ID" 
                    value={formData.nationalId}
                       onChange={handleChange}
                    disabled={submitting}
                    required
                  />
                  {formErrors.nationalId && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.nationalId}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500 flex items-center">
                    <svg className="w-3 h-3 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span>Your National ID will only be visible to administrators.</span>
                  </p>
              </div>

                {/* Educational Information */}
                <div>
                  <h3 className="section-title">Educational Information <span className="emoji-icon">🎓</span></h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* University */}
                    <div>
                      <label htmlFor="university" className="form-label">University</label>
                      <input 
                        type="text" 
                        id="university" 
                        name="university" 
                        className="form-input" 
                        placeholder="Enter your university" 
                        value={formData.university}
                            onChange={handleChange}
                        disabled={submitting}
                        required
                      />
                      {formErrors.university && (
                        <p className="mt-1 text-sm text-red-600">{formErrors.university}</p>
                      )}
                  </div>
                  
                  {/* Faculty */}
                    <div>
                      <label htmlFor="faculty" className="form-label">Faculty</label>
                      <input 
                        type="text" 
                        id="faculty" 
                        name="faculty" 
                        className="form-input" 
                        placeholder="Enter your faculty" 
                        value={formData.faculty}
                        onChange={handleChange}
                        disabled={submitting}
                        required
                      />
                      {formErrors.faculty && (
                        <p className="mt-1 text-sm text-red-600">{formErrors.faculty}</p>
                      )}
                  </div>
                  
                  {/* College */}
                    <div>
                      <label htmlFor="college" className="form-label">College</label>
                      <input 
                        type="text" 
                        id="college" 
                        name="college" 
                        className="form-input" 
                        placeholder="Enter your college" 
                        value={formData.college}
                       onChange={handleChange}
                        disabled={submitting}
                        required
                      />
                      {formErrors.college && (
                        <p className="mt-1 text-sm text-red-600">{formErrors.college}</p>
                      )}
                  </div>
                </div>
              </div>

                {/* Gender and Status */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Gender */}
                  <div>
                    <label className="form-label">Gender</label>
                    <div className="flex space-x-4">
                      <label className={`flex-1 radio-label ${formData.gender === 'male' ? 'radio-label-selected' : ''}`}>
                      <input
                          type="radio"
                          name="gender"
                          value="male"
                          className="sr-only"
                          checked={formData.gender === "male"}
                          onChange={handleChange}
                          disabled={submitting}
                        />
                        <span className={`${formData.gender === 'male' ? 'text-white' : 'text-gray-700'} z-10 relative`}>Male</span>
                      </label>
                      <label className={`flex-1 radio-label ${formData.gender === 'female' ? 'radio-label-selected' : ''}`}>
                      <input
                          type="radio"
                          name="gender"
                          value="female"
                          className="sr-only"
                          checked={formData.gender === "female"}
                          onChange={handleChange}
                          disabled={submitting}
                        />
                        <span className={`${formData.gender === 'female' ? 'text-white' : 'text-gray-700'} z-10 relative`}>Female</span>
                      </label>
                </div>
              </div>

                {/* Status */}
                  <div>
                    <label className="form-label">Status</label>
                    <div className="flex space-x-4">
                      <label className={`flex-1 radio-label ${formData.status === 'student' ? 'radio-label-selected' : ''}`}>
                      <input
                          type="radio"
                          name="status"
                          value="student"
                          className="sr-only"
                          checked={formData.status === "student"}
                          onChange={handleChange}
                          disabled={submitting}
                        />
                        <span className={`${formData.status === 'student' ? 'text-white' : 'text-gray-700'} z-10 relative`}>Student</span>
                      </label>
                      <label className={`flex-1 radio-label ${formData.status === 'graduate' ? 'radio-label-selected' : ''}`}>
                      <input
                          type="radio"
                          name="status"
                          value="graduate"
                          className="sr-only"
                          checked={formData.status === "graduate"}
                          onChange={handleChange}
                          disabled={submitting}
                        />
                        <span className={`${formData.status === 'graduate' ? 'text-white' : 'text-gray-700'} z-10 relative`}>Graduate</span>
                      </label>
                    </div>
                  </div>
              </div>

                {/* Level - Only shown when status is student */}
                {formData.status === 'student' && (
                  <div className="mt-5">
                    <label htmlFor="level" className="form-label">Student Level</label>
                    <select
                      id="level"
                      name="level"
                      className="form-input"
                      value={formData.level || '1'}
                      onChange={handleChange}
                      disabled={submitting}
                      required
                    >
                      <option value="1">Level 1</option>
                      <option value="2">Level 2</option>
                      <option value="3">Level 3</option>
                      <option value="4">Level 4</option>
                      <option value="5">Level 5</option>
                    </select>
                    {formErrors.level && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.level}</p>
                    )}
              </div>
                )}

                {/* Submit Button */}
                <div className="pt-6">
                <button
                  type="submit"
                    className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg text-base font-medium text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:via-indigo-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
                  disabled={submitting}
                >
                    {submitting ? (
                      <div className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </div>
                    ) : (
                      "JOIN NOW! 🚀"
                    )}
                </button>
                  <p className="text-center text-sm text-gray-500 mt-3">By registering, you&apos;re taking an awesome step!</p>
              </div>
            </form>
          )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="mt-10 text-center">
          <div className="inline-flex items-center justify-center text-xs text-gray-500 bg-blue-50 px-4 py-2 rounded-full">
            <svg className="w-3 h-3 mr-1 text-blue-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>Powered by </span>
            <span className="font-medium text-blue-600 ml-1">illustraV</span>
          </div>
        </div>
      </div>
    </div>
  );
} 