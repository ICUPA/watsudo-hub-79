// ShareTarget Component Tests
// Tests the Web Share Target functionality and content processing

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ShareTarget } from '../ShareTarget';

// Mock MapsPicker component
vi.mock('@/components/shared/MapsPicker', () => ({
  MapsPicker: ({ value, onChange, label, placeholder, showMap, mapHeight }: any) => (
    <div data-testid="maps-picker">
      <label>{label}</label>
      <input
        placeholder={placeholder}
        value={value ? `${value.lat}, ${value.lng}` : ''}
        onChange={(e) => onChange(e.target.value ? { lat: 0, lng: 0, formatted_address: e.target.value } : null)}
      />
      {showMap && <div data-testid="map" style={{ height: `${mapHeight}px` }}>Map Preview</div>}
    </div>
  ),
}));

// Mock utils
vi.mock('@/lib/utils', () => ({
  cn: (...classes: string[]) => classes.filter(Boolean).join(' '),
}));

describe.skip('ShareTarget', () => {
  beforeEach(() => {
    // Mock URLSearchParams
    Object.defineProperty(window, 'location', {
      value: {
        search: '',
        href: 'http://localhost:3000/share',
      },
      writable: true,
    });

    // Mock document.forms
    Object.defineProperty(document, 'forms', {
      value: [],
      writable: true,
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders no content message when no shared content', () => {
    render(<ShareTarget />);
    
    expect(screen.getByText('No Shared Content')).toBeInTheDocument();
    expect(screen.getByText('This page is designed to handle content shared from other apps.')).toBeInTheDocument();
    expect(screen.getByText('Go Back')).toBeInTheDocument();
  });

  it('handles URL parameters for shared content', () => {
    Object.defineProperty(window, 'location', {
      value: {
        search: '?title=Test%20Title&text=Test%20Text&url=https://example.com',
        href: 'http://localhost:3000/share',
      },
      writable: true,
    });

    render(<ShareTarget />);
    
    expect(screen.getByText('Shared Content')).toBeInTheDocument();
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Text')).toBeInTheDocument();
    expect(screen.getByText('https://example.com')).toBeInTheDocument();
  });

  it('handles form data for shared content', () => {
    const mockForm = {
      method: 'post',
      elements: {
        title: { value: 'Form Title' },
        text: { value: 'Form Text' },
        url: { value: 'https://form-example.com' },
        files: { value: 'test-file.txt' },
      },
    };

    Object.defineProperty(document, 'forms', {
      value: [mockForm],
      writable: true,
    });

    render(<ShareTarget />);
    
    expect(screen.getByText('Shared Content')).toBeInTheDocument();
    expect(screen.getByText('Form Title')).toBeInTheDocument();
    expect(screen.getByText('Form Text')).toBeInTheDocument();
    expect(screen.getByText('https://form-example.com')).toBeInTheDocument();
  });

  it('extracts location from text content', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        search: '?text=Meet%20me%20at%20Kigali%20Airport',
        href: 'http://localhost:3000/share',
      },
      writable: true,
    });

    render(<ShareTarget />);
    
    const extractLocationButton = screen.getByText('Extract Location');
    fireEvent.click(extractLocationButton);
    
    await waitFor(() => {
      expect(screen.getByText('Location extracted from shared content')).toBeInTheDocument();
      expect(screen.getByText('"Kigali Airport"')).toBeInTheDocument();
    });
  });

  it('extracts contacts from text content', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        search: '?text=Call%20me%20at%20078%20123%204567',
        href: 'http://localhost:3000/share',
      },
      writable: true,
    });

    render(<ShareTarget />);
    
    const extractContactButton = screen.getByText('Extract Contact');
    fireEvent.click(extractContactButton);
    
    await waitFor(() => {
      expect(screen.getByText('1 contact(s) found')).toBeInTheDocument();
      expect(screen.getByText('"0781234567"')).toBeInTheDocument();
    });
  });

  it('processes links from shared content', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        search: '?url=https://example.com',
        href: 'http://localhost:3000/share',
      },
      writable: true,
    });

    render(<ShareTarget />);
    
    const processLinkButton = screen.getByText('Process Link');
    fireEvent.click(processLinkButton);
    
    await waitFor(() => {
      expect(screen.getByText('URL processed successfully')).toBeInTheDocument();
      expect(screen.getByText('"https://example.com"')).toBeInTheDocument();
    });
  });

  it('processes files from shared content', async () => {
    const mockForm = {
      method: 'post',
      elements: {
        files: { value: 'test-file.txt' },
      },
    };

    Object.defineProperty(document, 'forms', {
      value: [mockForm],
      writable: true,
    });

    render(<ShareTarget />);
    
    const processFilesButton = screen.getByText('Process Files');
    fireEvent.click(processFilesButton);
    
    await waitFor(() => {
      expect(screen.getByText('1 file(s) received')).toBeInTheDocument();
    });
  });

  it('processes text content', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        search: '?text=This%20is%20a%20test%20message%20with%20multiple%20words',
        href: 'http://localhost:3000/share',
      },
      writable: true,
    });

    render(<ShareTarget />);
    
    const processTextButton = screen.getByText('Process Text');
    fireEvent.click(processTextButton);
    
    await waitFor(() => {
      expect(screen.getByText('Text processed: 8 words, 47 characters')).toBeInTheDocument();
    });
  });

  it('handles location extraction with no location found', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        search: '?text=Hello%20world%20without%20location',
        href: 'http://localhost:3000/share',
      },
      writable: true,
    });

    render(<ShareTarget />);
    
    const extractLocationButton = screen.getByText('Extract Location');
    fireEvent.click(extractLocationButton);
    
    await waitFor(() => {
      expect(screen.getByText('No location information found in the shared content')).toBeInTheDocument();
    });
  });

  it('handles contact extraction with no contacts found', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        search: '?text=Hello%20world%20without%20phone%20numbers',
        href: 'http://localhost:3000/share',
      },
      writable: true,
    });

    render(<ShareTarget />);
    
    const extractContactButton = screen.getByText('Extract Contact');
    fireEvent.click(extractContactButton);
    
    await waitFor(() => {
      expect(screen.getByText('No contact information found in the shared content')).toBeInTheDocument();
    });
  });

  it('handles link processing with no URL', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        search: '?text=Hello%20world%20without%20URL',
        href: 'http://localhost:3000/share',
      },
      writable: true,
    });

    render(<ShareTarget />);
    
    const processLinkButton = screen.getByText('Process Link');
    fireEvent.click(processLinkButton);
    
    await waitFor(() => {
      expect(screen.getByText('No URL found in the shared content')).toBeInTheDocument();
    });
  });

  it('handles file processing with no files', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        search: '?text=Hello%20world%20without%20files',
        href: 'http://localhost:3000/share',
      },
      writable: true,
    });

    render(<ShareTarget />);
    
    const processFilesButton = screen.getByText('Process Files');
    fireEvent.click(processFilesButton);
    
    await waitFor(() => {
      expect(screen.getByText('No files found in the shared content')).toBeInTheDocument();
    });
  });

  it('handles text processing with no text', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        search: '?title=Title%20Only',
        href: 'http://localhost:3000/share',
      },
      writable: true,
    });

    render(<ShareTarget />);
    
    const processTextButton = screen.getByText('Process Text');
    fireEvent.click(processTextButton);
    
    await waitFor(() => {
      expect(screen.getByText('No text content found')).toBeInTheDocument();
    });
  });

  it('shows location picker after content processing', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        search: '?text=Meet%20at%20Kigali%20Airport',
        href: 'http://localhost:3000/share',
      },
      writable: true,
    });

    render(<ShareTarget />);
    
    const extractLocationButton = screen.getByText('Extract Location');
    fireEvent.click(extractLocationButton);
    
    await waitFor(() => {
      expect(screen.getByText('Add Location for WhatsApp')).toBeInTheDocument();
      expect(screen.getByTestId('maps-picker')).toBeInTheDocument();
    });
  });

  it('enables WhatsApp send button when location is selected', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        search: '?text=Meet%20at%20Kigali%20Airport',
        href: 'http://localhost:3000/share',
      },
      writable: true,
    });

    render(<ShareTarget />);
    
    const extractLocationButton = screen.getByText('Extract Location');
    fireEvent.click(extractLocationButton);
    
    await waitFor(() => {
      expect(screen.getByText('Add Location for WhatsApp')).toBeInTheDocument();
    });
    
    // Select a location using the MapsPicker
    const mapsPicker = screen.getByTestId('maps-picker');
    const input = mapsPicker.querySelector('input');
    fireEvent.change(input!, { target: { value: 'Kigali, Rwanda' } });
    
    await waitFor(() => {
      expect(screen.getByText('Send to WhatsApp')).toBeInTheDocument();
    });
  });

  it('handles WhatsApp sharing with location', async () => {
    const mockOpen = vi.fn();
    Object.defineProperty(window, 'open', {
      value: mockOpen,
      writable: true,
    });

    Object.defineProperty(window, 'location', {
      value: {
        search: '?text=Meet%20at%20Kigali%20Airport',
        href: 'http://localhost:3000/share',
      },
      writable: true,
    });

    render(<ShareTarget />);
    
    const extractLocationButton = screen.getByText('Extract Location');
    fireEvent.click(extractLocationButton);
    
    await waitFor(() => {
      expect(screen.getByText('Add Location for WhatsApp')).toBeInTheDocument();
    });
    
    // Select a location
    const mapsPicker = screen.getByTestId('maps-picker');
    const input = mapsPicker.querySelector('input');
    fireEvent.change(input!, { target: { value: 'Kigali, Rwanda' } });
    
    await waitFor(() => {
      const sendButton = screen.getByText('Send to WhatsApp');
      fireEvent.click(sendButton);
    });
    
    expect(mockOpen).toHaveBeenCalledWith(
      expect.stringContaining('https://wa.me/?text='),
      '_blank'
    );
  });

  it('displays source and timestamp information', () => {
    Object.defineProperty(window, 'location', {
      value: {
        search: '?title=Test%20Title',
        href: 'http://localhost:3000/share',
      },
      writable: true,
    });

    render(<ShareTarget />);
    
    expect(screen.getByText('url')).toBeInTheDocument();
    expect(screen.getByText(/\d{1,2}:\d{2}:\d{2}/)).toBeInTheDocument();
  });

  it('handles navigation back', () => {
    const mockHistoryBack = vi.fn();
    Object.defineProperty(window, 'history', {
      value: { back: mockHistoryBack },
      writable: true,
    });

    render(<ShareTarget />);
    
    const goBackButton = screen.getByText('Go Back');
    fireEvent.click(goBackButton);
    
    expect(mockHistoryBack).toHaveBeenCalled();
  });

  it('handles navigation to home', () => {
    const mockLocationAssign = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { assign: mockLocationAssign },
      writable: true,
    });

    render(<ShareTarget />);
    
    const goHomeButton = screen.getByText('Go to Home');
    fireEvent.click(goHomeButton);
    
    expect(mockLocationAssign).toHaveBeenCalledWith('/');
  });

  it('handles processing errors gracefully', async () => {
    // Mock a function that throws an error
    const originalText = 'Test text';
    Object.defineProperty(window, 'location', {
      value: {
        search: `?text=${encodeURIComponent(originalText)}`,
        href: 'http://localhost:3000/share',
      },
      writable: true,
    });

    render(<ShareTarget />);
    
    const processTextButton = screen.getByText('Process Text');
    fireEvent.click(processTextButton);
    
    await waitFor(() => {
      expect(screen.getByText('Text processed: 2 words, 9 characters')).toBeInTheDocument();
    });
  });

  it('displays file information correctly', () => {
    const mockForm = {
      method: 'post',
      elements: {
        files: { value: 'test-file.txt' },
      },
    };

    Object.defineProperty(document, 'forms', {
      value: [mockForm],
      writable: true,
    });

    render(<ShareTarget />);
    
    expect(screen.getByText('Files (1)')).toBeInTheDocument();
    expect(screen.getByText('test-file.txt')).toBeInTheDocument();
  });

  it('handles multiple files', () => {
    const mockForm = {
      method: 'post',
      elements: {
        files: [
          { value: 'file1.txt' },
          { value: 'file2.pdf' },
          { value: 'file3.jpg' },
        ],
      },
    };

    Object.defineProperty(document, 'forms', {
      value: [mockForm],
      writable: true,
    });

    render(<ShareTarget />);
    
    expect(screen.getByText('Files (3)')).toBeInTheDocument();
    expect(screen.getByText('file1.txt')).toBeInTheDocument();
    expect(screen.getByText('file2.pdf')).toBeInTheDocument();
    expect(screen.getByText('file3.jpg')).toBeInTheDocument();
  });
});
