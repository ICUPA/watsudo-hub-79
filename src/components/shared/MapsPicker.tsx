// Shared Maps Picker Component
// Provides Google Maps integration for location selection with autocomplete and manual picker

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Navigation, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Location {
  lat: number;
  lng: number;
  formatted_address: string;
  place_id?: string;
  name?: string;
}

export interface MapsPickerProps {
  value?: Location | null;
  onChange: (location: Location | null) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  showMap?: boolean;
  mapHeight?: number;
  allowManualInput?: boolean;
  onError?: (error: string) => void;
}

declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

export function MapsPicker({
  value,
  onChange,
  placeholder = "Search for a location...",
  label = "Location",
  required = false,
  disabled = false,
  className,
  showMap = true,
  mapHeight = 300,
  allowManualInput = true,
  onError
}: MapsPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPredictions, setShowPredictions] = useState(false);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [marker, setMarker] = useState<google.maps.Marker | null>(null);
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const predictionsRef = useRef<HTMLDivElement>(null);

  // Initialize Google Maps
  useEffect(() => {
    if (!window.google) {
      loadGoogleMapsScript();
    } else {
      initializeMaps();
    }
  }, []);

  // Initialize maps when Google Maps is loaded
  useEffect(() => {
    if (window.google && mapRef.current && !map) {
      initializeMaps();
    }
  }, [window.google, map]);

  const loadGoogleMapsScript = () => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY}&libraries=places&callback=initMap`;
    script.async = true;
    script.defer = true;
    
    window.initMap = () => {
      initializeMaps();
    };
    
    document.head.appendChild(script);
  };

  const initializeMaps = useCallback(() => {
    if (!mapRef.current || !window.google) return;

    try {
      // Initialize map
      const newMap = new window.google.maps.Map(mapRef.current, {
        center: value ? { lat: value.lat, lng: value.lng } : { lat: -1.9441, lng: 30.0619 }, // Kigali
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      });

      // Initialize autocomplete
      if (searchInputRef.current) {
        const newAutocomplete = new window.google.maps.places.Autocomplete(searchInputRef.current, {
          types: ['geocode', 'establishment'],
          componentRestrictions: { country: 'rw' }
        });
        setAutocomplete(newAutocomplete);

        // Handle place selection
        newAutocomplete.addListener('place_changed', () => {
          const place = newAutocomplete.getPlace();
          if (place.geometry && place.geometry.location) {
            const location: Location = {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
              formatted_address: place.formatted_address || '',
              place_id: place.place_id,
              name: place.name
            };
            onChange(location);
            setSearchQuery(place.formatted_address || '');
            setShowPredictions(false);
            updateMapMarker(location, newMap);
          }
        });
      }

      // Initialize marker if location exists
      if (value) {
        updateMapMarker(value, newMap);
      }

      // Add click listener to map
      newMap.addListener('click', (event: google.maps.MapMouseEvent) => {
        if (event.latLng) {
          const location: Location = {
            lat: event.latLng.lat(),
            lng: event.latLng.lng(),
            formatted_address: 'Selected location'
          };
          onChange(location);
          setSearchQuery('Selected location');
          updateMapMarker(location, newMap);
        }
      });

      setMap(newMap);
    } catch (error) {
      console.error('Error initializing Google Maps:', error);
      onError?.('Failed to initialize Google Maps');
    }
  }, [value, onChange, onError]);

  const updateMapMarker = useCallback((location: Location, mapInstance: google.maps.Map) => {
    // Remove existing marker
    if (marker) {
      marker.setMap(null);
    }

    // Create new marker
    const newMarker = new window.google.maps.Marker({
      position: { lat: location.lat, lng: location.lng },
      map: mapInstance,
      title: location.formatted_address,
      draggable: true
    });

    // Add drag listener
    newMarker.addListener('dragend', (event: google.maps.MapMouseEvent) => {
      if (event.latLng) {
        const newLocation: Location = {
          ...location,
          lat: event.latLng.lat(),
          lng: event.latLng.lng()
        };
        onChange(newLocation);
      }
    });

    setMarker(newMarker);
    mapInstance.setCenter({ lat: location.lat, lng: location.lng });
    mapInstance.setZoom(16);
  }, [marker, onChange]);

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim() || !window.google) {
      setPredictions([]);
      setShowPredictions(false);
      return;
    }

    setIsLoading(true);
    try {
      const service = new window.google.maps.places.AutocompleteService();
      const request = {
        input: query,
        componentRestrictions: { country: 'rw' },
        types: ['geocode', 'establishment']
      };

      service.getPlacePredictions(request, (predictions, status) => {
        setIsLoading(false);
        if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
          setPredictions(predictions);
          setShowPredictions(true);
        } else {
          setPredictions([]);
          setShowPredictions(false);
        }
      });
    } catch (error) {
      setIsLoading(false);
      console.error('Error searching places:', error);
      onError?.('Failed to search locations');
    }
  }, [onError]);

  const handlePredictionSelect = useCallback((prediction: google.maps.places.AutocompletePrediction) => {
    if (!window.google) return;

    const service = new window.google.maps.places.PlacesService(map!);
    service.getDetails(
      { placeId: prediction.place_id },
      (place, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
          const location: Location = {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
            formatted_address: place.formatted_address || prediction.description,
            place_id: prediction.place_id,
            name: place.name
          };
          onChange(location);
          setSearchQuery(place.formatted_address || prediction.description);
          setShowPredictions(false);
          if (map) {
            updateMapMarker(location, map);
          }
        }
      }
    );
  }, [map, onChange, updateMapMarker]);

  const handleClear = useCallback(() => {
    onChange(null);
    setSearchQuery('');
    setPredictions([]);
    setShowPredictions(false);
    if (marker) {
      marker.setMap(null);
      setMarker(null);
    }
    if (map) {
      map.setCenter({ lat: -1.9441, lng: 30.0619 }); // Reset to Kigali
      map.setZoom(13);
    }
  }, [onChange, marker, map]);

  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      onError?.('Geolocation is not supported by this browser');
      return;
    }

    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLoading(false);
        const location: Location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          formatted_address: 'Current location'
        };
        onChange(location);
        setSearchQuery('Current location');
        if (map) {
          updateMapMarker(location, map);
        }
      },
      (error) => {
        setIsLoading(false);
        console.error('Geolocation error:', error);
        onError?.('Failed to get current location');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, [onChange, map, updateMapMarker, onError]);

  // Handle search input changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, handleSearch]);

  // Handle click outside predictions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (predictionsRef.current && !predictionsRef.current.contains(event.target as Node)) {
        setShowPredictions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={cn('space-y-4', className)}>
      {label && (
        <Label htmlFor="maps-picker" className="text-sm font-medium">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}

      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            ref={searchInputRef}
            id="maps-picker"
            type="text"
            placeholder={placeholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={disabled}
            className="pl-10 pr-20"
            onFocus={() => setShowPredictions(true)}
          />
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex space-x-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleUseCurrentLocation}
              disabled={disabled || isLoading}
              className="h-8 w-8 p-0"
              title="Use current location"
            >
              <Navigation className="h-4 w-4" />
            </Button>
            {value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                disabled={disabled}
                className="h-8 w-8 p-0"
                title="Clear location"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Predictions dropdown */}
        {showPredictions && predictions.length > 0 && (
          <div
            ref={predictionsRef}
            className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto"
          >
            {predictions.map((prediction) => (
              <button
                key={prediction.place_id}
                type="button"
                onClick={() => handlePredictionSelect(prediction)}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
              >
                <div className="flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <div>
                    <div className="font-medium text-sm">{prediction.structured_formatting?.main_text}</div>
                    <div className="text-xs text-gray-500">{prediction.structured_formatting?.secondary_text}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map display */}
      {showMap && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Map Preview</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div
              ref={mapRef}
              className="w-full rounded-md overflow-hidden"
              style={{ height: mapHeight }}
            />
          </CardContent>
        </Card>
      )}

      {/* Selected location display */}
      {value && (
        <Card className="bg-gray-50">
          <CardContent className="p-3">
            <div className="flex items-start space-x-2">
              <MapPin className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900">
                  {value.name || 'Selected Location'}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {value.formatted_address}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Lat: {value.lat.toFixed(6)}, Lng: {value.lng.toFixed(6)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex items-center justify-center py-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-sm text-gray-500">Loading...</span>
        </div>
      )}
    </div>
  );
}
