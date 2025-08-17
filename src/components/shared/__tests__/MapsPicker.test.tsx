// MapsPicker Component Tests
// Tests the Google Maps integration and location selection functionality

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MapsPicker } from '../MapsPicker';

// Mock Google Maps API
const mockGoogleMaps = {
  maps: {
    Map: vi.fn().mockImplementation(() => ({
      addListener: vi.fn(),
      setCenter: vi.fn(),
      setZoom: vi.fn(),
    })),
    Marker: vi.fn().mockImplementation(() => ({
      setMap: vi.fn(),
      addListener: vi.fn(),
    })),
    places: {
      Autocomplete: vi.fn().mockImplementation(() => ({
        addListener: vi.fn(),
        getPlace: vi.fn().mockReturnValue({
          geometry: {
            location: {
              lat: () => -1.9441,
              lng: () => 30.0619,
            },
          },
          formatted_address: 'Kigali, Rwanda',
          place_id: 'test-place-id',
          name: 'Kigali',
        }),
      })),
      AutocompleteService: vi.fn().mockImplementation(() => ({
        getPlacePredictions: vi.fn().mockImplementation((request, callback) => {
          callback([
            {
              place_id: 'test-place-id',
              description: 'Kigali, Rwanda',
              structured_formatting: {
                main_text: 'Kigali',
                secondary_text: 'Rwanda',
              },
            },
          ], 'OK');
        }),
      })),
      PlacesService: vi.fn().mockImplementation(() => ({
        getDetails: vi.fn().mockImplementation((request, callback) => {
          callback({
            geometry: {
              location: {
                lat: () => -1.9441,
                lng: () => 30.0619,
              },
            },
            formatted_address: 'Kigali, Rwanda',
            place_id: 'test-place-id',
            name: 'Kigali',
          }, 'OK');
        }),
      })),
      PlacesServiceStatus: {
        OK: 'OK',
      },
    },
  },
};

// Mock environment variables
vi.mock('@/lib/utils', () => ({
  cn: (...classes: string[]) => classes.filter(Boolean).join(' '),
}));

// Mock environment
vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', 'test-api-key');

describe.skip('MapsPicker', () => {
  const mockOnChange = vi.fn();
  const mockOnError = vi.fn();

  beforeEach(() => {
    // Mock window.google
    Object.defineProperty(window, 'google', {
      value: mockGoogleMaps,
      writable: true,
    });

    // Mock window.initMap
    Object.defineProperty(window, 'initMap', {
      value: vi.fn(),
      writable: true,
    });

    // Mock navigator.geolocation
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi.fn(),
      },
      writable: true,
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders with default props', () => {
    render(<MapsPicker onChange={mockOnChange} />);
    
    expect(screen.getByPlaceholderText('Search for a location...')).toBeInTheDocument();
    expect(screen.getByLabelText('Location')).toBeInTheDocument();
    expect(screen.getByTitle('Use current location')).toBeInTheDocument();
  });

  it('renders with custom props', () => {
    render(
      <MapsPicker
        onChange={mockOnChange}
        placeholder="Custom placeholder"
        label="Custom label"
        required={true}
        showMap={false}
      />
    );
    
    expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument();
    expect(screen.getByLabelText('Custom label *')).toBeInTheDocument();
  });

  it('handles search input changes', async () => {
    render(<MapsPicker onChange={mockOnChange} />);
    
    const searchInput = screen.getByPlaceholderText('Search for a location...');
    fireEvent.change(searchInput, { target: { value: 'Kigali' } });
    
    await waitFor(() => {
      expect(searchInput).toHaveValue('Kigali');
    });
  });

  it('shows predictions dropdown on focus', async () => {
    render(<MapsPicker onChange={mockOnChange} />);
    
    const searchInput = screen.getByPlaceholderText('Search for a location...');
    fireEvent.focus(searchInput);
    
    await waitFor(() => {
      expect(screen.getByText('Kigali, Rwanda')).toBeInTheDocument();
    });
  });

  it('handles prediction selection', async () => {
    render(<MapsPicker onChange={mockOnChange} />);
    
    const searchInput = screen.getByPlaceholderText('Search for a location...');
    fireEvent.focus(searchInput);
    
    await waitFor(() => {
      const prediction = screen.getByText('Kigali, Rwanda');
      fireEvent.click(prediction);
    });
    
    expect(mockOnChange).toHaveBeenCalledWith({
      lat: -1.9441,
      lng: 30.0619,
      formatted_address: 'Kigali, Rwanda',
      place_id: 'test-place-id',
      name: 'Kigali',
    });
  });

  it('handles current location selection', async () => {
    const mockGeolocation = {
      getCurrentPosition: vi.fn().mockImplementation((success) => {
        success({
          coords: {
            latitude: -1.9441,
            longitude: 30.0619,
          },
        });
      }),
    };
    
    Object.defineProperty(navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
    });

    render(<MapsPicker onChange={mockOnChange} />);
    
    const currentLocationButton = screen.getByTitle('Use current location');
    fireEvent.click(currentLocationButton);
    
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith({
        lat: -1.9441,
        lng: 30.0619,
        formatted_address: 'Current location',
      });
    });
  });

  it('handles geolocation errors', async () => {
    const mockGeolocation = {
      getCurrentPosition: vi.fn().mockImplementation((success, error) => {
        error(new Error('Geolocation error'));
      }),
    };
    
    Object.defineProperty(navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
    });

    render(<MapsPicker onChange={mockOnChange} onError={mockOnError} />);
    
    const currentLocationButton = screen.getByTitle('Use current location');
    fireEvent.click(currentLocationButton);
    
    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('Failed to get current location');
    });
  });

  it('handles geolocation not supported', () => {
    Object.defineProperty(navigator, 'geolocation', {
      value: undefined,
      writable: true,
    });

    render(<MapsPicker onChange={mockOnChange} onError={mockOnError} />);
    
    const currentLocationButton = screen.getByTitle('Use current location');
    fireEvent.click(currentLocationButton);
    
    expect(mockOnError).toHaveBeenCalledWith('Geolocation is not supported by this browser');
  });

  it('clears location when clear button is clicked', () => {
    const mockLocation = {
      lat: -1.9441,
      lng: 30.0619,
      formatted_address: 'Kigali, Rwanda',
    };

    render(<MapsPicker onChange={mockOnChange} value={mockLocation} />);
    
    const clearButton = screen.getByTitle('Clear location');
    fireEvent.click(clearButton);
    
    expect(mockOnChange).toHaveBeenCalledWith(null);
  });

  it('displays selected location when value is provided', () => {
    const mockLocation = {
      lat: -1.9441,
      lng: 30.0619,
      formatted_address: 'Kigali, Rwanda',
      name: 'Kigali',
    };

    render(<MapsPicker onChange={mockOnChange} value={mockLocation} />);
    
    expect(screen.getByText('Kigali')).toBeInTheDocument();
    expect(screen.getByText('Kigali, Rwanda')).toBeInTheDocument();
    expect(screen.getByText('Lat: -1.9441, Lng: 30.0619')).toBeInTheDocument();
  });

  it('handles disabled state', () => {
    render(<MapsPicker onChange={mockOnChange} disabled={true} />);
    
    const searchInput = screen.getByPlaceholderText('Search for a location...');
    const currentLocationButton = screen.getByTitle('Use current location');
    
    expect(searchInput).toBeDisabled();
    expect(currentLocationButton).toBeDisabled();
  });

  it('handles required field validation', () => {
    render(<MapsPicker onChange={mockOnChange} required={true} />);
    
    expect(screen.getByLabelText('Location *')).toBeInTheDocument();
  });

  it('shows map when showMap is true', () => {
    render(<MapsPicker onChange={mockOnChange} showMap={true} />);
    
    expect(screen.getByText('Map Preview')).toBeInTheDocument();
  });

  it('hides map when showMap is false', () => {
    render(<MapsPicker onChange={mockOnChange} showMap={false} />);
    
    expect(screen.queryByText('Map Preview')).not.toBeInTheDocument();
  });

  it('handles custom map height', () => {
    render(<MapsPicker onChange={mockOnChange} mapHeight={400} />);
    
    const mapContainer = screen.getByText('Map Preview').closest('div')?.nextElementSibling;
    expect(mapContainer).toHaveStyle({ height: '400px' });
  });

  it('handles error callback', async () => {
    // Mock Google Maps to throw an error
    const mockErrorGoogleMaps = {
      ...mockGoogleMaps,
      maps: {
        ...mockGoogleMaps.maps,
        Map: vi.fn().mockImplementation(() => {
          throw new Error('Google Maps error');
        }),
      },
    };

    Object.defineProperty(window, 'google', {
      value: mockErrorGoogleMaps,
      writable: true,
    });

    render(<MapsPicker onChange={mockOnChange} onError={mockOnError} />);
    
    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('Failed to initialize Google Maps');
    });
  });

  it('handles search without Google Maps API', async () => {
    Object.defineProperty(window, 'google', {
      value: undefined,
      writable: true,
    });

    render(<MapsPicker onChange={mockOnChange} onError={mockOnError} />);
    
    const searchInput = screen.getByPlaceholderText('Search for a location...');
    fireEvent.change(searchInput, { target: { value: 'Kigali' } });
    
    // Should not crash and should not call onError for search
    expect(mockOnError).not.toHaveBeenCalled();
  });

  it('handles click outside predictions', async () => {
    render(<MapsPicker onChange={mockOnChange} />);
    
    const searchInput = screen.getByPlaceholderText('Search for a location...');
    fireEvent.focus(searchInput);
    
    await waitFor(() => {
      expect(screen.getByText('Kigali, Rwanda')).toBeInTheDocument();
    });
    
    // Click outside
    fireEvent.mouseDown(document.body);
    
    await waitFor(() => {
      expect(screen.queryByText('Kigali, Rwanda')).not.toBeInTheDocument();
    });
  });

  it('debounces search input', async () => {
    vi.useFakeTimers();
    
    render(<MapsPicker onChange={mockOnChange} />);
    
    const searchInput = screen.getByPlaceholderText('Search for a location...');
    
    // Type quickly
    fireEvent.change(searchInput, { target: { value: 'K' } });
    fireEvent.change(searchInput, { target: { value: 'Ki' } });
    fireEvent.change(searchInput, { target: { value: 'Kig' } });
    fireEvent.change(searchInput, { target: { value: 'Kiga' } });
    fireEvent.change(searchInput, { target: { value: 'Kigal' } });
    fireEvent.change(searchInput, { target: { value: 'Kigali' } });
    
    // Fast-forward time
    vi.advanceTimersByTime(300);
    
    await waitFor(() => {
      expect(screen.getByText('Kigali, Rwanda')).toBeInTheDocument();
    });
    
    vi.useRealTimers();
  });
});
