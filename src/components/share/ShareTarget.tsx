// Share Target Component
// Handles incoming shared content from other apps via Web Share Target

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Share2, 
  MapPin, 
  Phone, 
  Link, 
  FileText, 
  Image, 
  Send,
  ArrowLeft,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { MapsPicker, type Location } from '@/components/shared/MapsPicker';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

interface SharedContent {
  title?: string;
  text?: string;
  url?: string;
  files?: File[];
  timestamp: Date;
  source?: string;
}

interface ShareAction {
  type: 'location' | 'contact' | 'link' | 'file' | 'text';
  label: string;
  description: string;
  icon: React.ReactNode;
  action: (content: SharedContent) => void;
}

export function ShareTarget() {
  const [sharedContent, setSharedContent] = useState<SharedContent | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedContent, setProcessedContent] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);

  useEffect(() => {
    // Check if this page was opened via share target
    checkShareTarget();
    
    // Listen for share target data
    window.addEventListener('DOMContentLoaded', handleShareTargetData);
    
    return () => {
      window.removeEventListener('DOMContentLoaded', handleShareTargetData);
    };
  }, []);

  const checkShareTarget = () => {
    // Check URL parameters for shared content
    const urlParams = new URLSearchParams(window.location.search);
    const title = urlParams.get('title');
    const text = urlParams.get('text');
    const url = urlParams.get('url');

    if (title || text || url) {
      setSharedContent({
        title: title || undefined,
        text: text || undefined,
        url: url || undefined,
        timestamp: new Date(),
        source: 'url'
      });
    }

    // Check for POST data (if this was a form submission)
    if (document.forms.length > 0) {
      const form = document.forms[0];
      if (form.method === 'post') {
        handleFormData(form);
      }
    }
  };

  const handleShareTargetData = () => {
    // Handle data from the share target intent
    if (window.location.search.includes('share_target')) {
      // This was opened via share target
      console.log('Share target opened');
    }
  };

  const handleFormData = (form: HTMLFormElement) => {
    const formData = new FormData(form);
    const title = formData.get('title') as string;
    const text = formData.get('text') as string;
    const url = formData.get('url') as string;
    const files = formData.getAll('files') as File[];

    if (title || text || url || files.length > 0) {
      setSharedContent({
        title: title || undefined,
        text: text || undefined,
        url: url || undefined,
        files: files.length > 0 ? files : undefined,
        timestamp: new Date(),
        source: 'form'
      });
    }
  };

  const shareActions: ShareAction[] = [
    {
      type: 'location',
      label: 'Extract Location',
      description: 'Find addresses or coordinates in the shared content',
      icon: <MapPin className="h-5 w-5" />,
      action: extractLocation
    },
    {
      type: 'contact',
      label: 'Extract Contact',
      description: 'Find phone numbers or contact information',
      icon: <Phone className="h-5 w-5" />,
      action: extractContact
    },
    {
      type: 'link',
      label: 'Process Link',
      description: 'Handle shared URLs and web links',
      icon: <Link className="h-5 w-5" />,
      action: processLink
    },
    {
      type: 'file',
      label: 'Process Files',
      description: 'Handle shared documents and images',
      icon: <Image className="h-5 w-5" />,
      action: processFiles
    },
    {
      type: 'text',
      label: 'Process Text',
      description: 'Analyze and process shared text content',
      icon: <FileText className="h-5 w-5" />,
      action: processText
    }
  ];

  function extractLocation(content: SharedContent) {
    setIsProcessing(true);
    setError(null);

    try {
      // Extract location information from text
      const text = content.text || content.title || '';
      const locationRegex = /(?:at|near|in|to|from)\s+([^,\n]+(?:,\s*[^,\n]+)*)/gi;
      const matches = [...text.matchAll(locationRegex)];
      
      if (matches.length > 0) {
        const extractedLocation = matches[0][1].trim();
        setProcessedContent({
          type: 'location',
          data: extractedLocation,
          message: 'Location extracted from shared content'
        });
      } else {
        setError('No location information found in the shared content');
      }
    } catch (err) {
      setError('Failed to extract location information');
    } finally {
      setIsProcessing(false);
    }
  }

  function extractContact(content: SharedContent) {
    setIsProcessing(true);
    setError(null);

    try {
      const text = content.text || content.title || '';
      const phoneRegex = /(\+?250|0)?\s*7[2389]\s*\d{3}\s*\d{3}/g;
      const matches = [...text.matchAll(phoneRegex)];
      
      if (matches.length > 0) {
        const contacts = matches.map(match => match[0].replace(/\s/g, ''));
        setProcessedContent({
          type: 'contact',
          data: contacts,
          message: `${contacts.length} contact(s) found`
        });
      } else {
        setError('No contact information found in the shared content');
      }
    } catch (err) {
      setError('Failed to extract contact information');
    } finally {
      setIsProcessing(false);
    }
  }

  function processLink(content: SharedContent) {
    setIsProcessing(true);
    setError(null);

    try {
      const url = content.url;
      if (url) {
        setProcessedContent({
          type: 'link',
          data: url,
          message: 'URL processed successfully'
        });
      } else {
        setError('No URL found in the shared content');
      }
    } catch (err) {
      setError('Failed to process link');
    } finally {
      setIsProcessing(false);
    }
  }

  function processFiles(content: SharedContent) {
    setIsProcessing(true);
    setError(null);

    try {
      const files = content.files;
      if (files && files.length > 0) {
        const fileInfo = files.map(file => ({
          name: file.name,
          type: file.type,
          size: file.size,
          lastModified: new Date(file.lastModified)
        }));
        
        setProcessedContent({
          type: 'files',
          data: fileInfo,
          message: `${files.length} file(s) received`
        });
      } else {
        setError('No files found in the shared content');
      }
    } catch (err) {
      setError('Failed to process files');
    } finally {
      setIsProcessing(false);
    }
  }

  function processText(content: SharedContent) {
    setIsProcessing(true);
    setError(null);

    try {
      const text = content.text || content.title || '';
      if (text) {
        const wordCount = text.split(/\s+/).length;
        const charCount = text.length;
        
        setProcessedContent({
          type: 'text',
          data: {
            text,
            wordCount,
            charCount
          },
          message: `Text processed: ${wordCount} words, ${charCount} characters`
        });
      } else {
        setError('No text content found');
      }
    } catch (err) {
      setError('Failed to process text');
    } finally {
      setIsProcessing(false);
    }
  }

  const handleAction = (action: ShareAction) => {
    if (sharedContent) {
      action.action(sharedContent);
    }
  };

  const handleLocationSelect = (location: Location | null) => {
    setSelectedLocation(location);
  };

  const handleSendToWhatsApp = () => {
    if (processedContent && selectedLocation) {
      // Format message for WhatsApp
      let message = '';
      
      switch (processedContent.type) {
        case 'location':
          message = `📍 Location: ${processedContent.data}\n\n📍 Selected: ${selectedLocation.formatted_address}\n\nLat: ${selectedLocation.lat.toFixed(6)}\nLng: ${selectedLocation.lng.toFixed(6)}`;
          break;
        case 'contact':
          message = `📱 Contacts: ${processedContent.data.join(', ')}\n\n📍 Location: ${selectedLocation.formatted_address}`;
          break;
        case 'link':
          message = `🔗 Link: ${processedContent.data}\n\n📍 Location: ${selectedLocation.formatted_address}`;
          break;
        default:
          message = `📍 Location: ${selectedLocation.formatted_address}`;
      }

      // Open WhatsApp with the message
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
    }
  };

  if (!sharedContent) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Share2 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Shared Content</h3>
          <p className="text-gray-500 mb-4">
            This page is designed to handle content shared from other apps.
          </p>
          <Button onClick={() => window.history.back()} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Shared Content</h1>
          <p className="text-gray-500 mt-1">
            Process and handle content shared from other apps
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {sharedContent.source} • {sharedContent.timestamp.toLocaleTimeString()}
        </Badge>
      </div>

      {/* Shared Content Display */}
      <Card>
        <CardHeader>
          <CardTitle>Received Content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {sharedContent.title && (
            <div>
              <Label className="text-sm font-medium text-gray-500">Title</Label>
              <div className="text-sm mt-1 p-2 bg-gray-50 rounded border">
                {sharedContent.title}
              </div>
            </div>
          )}
          
          {sharedContent.text && (
            <div>
              <Label className="text-sm font-medium text-gray-500">Text</Label>
              <div className="text-sm mt-1 p-2 bg-gray-50 rounded border max-h-32 overflow-y-auto">
                {sharedContent.text}
              </div>
            </div>
          )}
          
          {sharedContent.url && (
            <div>
              <Label className="text-sm font-medium text-gray-500">URL</Label>
              <div className="text-sm mt-1 p-2 bg-gray-50 rounded border break-all">
                <a href={sharedContent.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  {sharedContent.url}
                </a>
              </div>
            </div>
          )}
          
          {sharedContent.files && sharedContent.files.length > 0 && (
            <div>
              <Label className="text-sm font-medium text-gray-500">Files ({sharedContent.files.length})</Label>
              <div className="mt-1 space-y-2">
                {sharedContent.files.map((file, index) => (
                  <div key={index} className="p-2 bg-gray-50 rounded border flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">{file.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {(file.size / 1024).toFixed(1)} KB
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Available Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {shareActions.map((action) => (
              <Button
                key={action.type}
                variant="outline"
                className="h-20 flex-col space-y-2"
                onClick={() => handleAction(action)}
                disabled={isProcessing}
              >
                {action.icon}
                <span className="text-sm font-medium">{action.label}</span>
                <span className="text-xs text-gray-500 text-center">
                  {action.description}
                </span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Processing Status */}
      {isProcessing && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              <span className="text-blue-800">Processing shared content...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Processed Content */}
      {processedContent && (
        <Card>
          <CardHeader>
            <CardTitle>Processed Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm text-green-700">{processedContent.message}</span>
            </div>
            
            <div className="p-3 bg-gray-50 rounded border">
              <pre className="text-sm overflow-x-auto">
                {JSON.stringify(processedContent.data, null, 2)}
              </pre>
            </div>

            {/* Location Picker for WhatsApp Integration */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Add Location for WhatsApp</h4>
              <MapsPicker
                value={selectedLocation}
                onChange={handleLocationSelect}
                label="Select Location"
                placeholder="Search for a location to include..."
                showMap={true}
                mapHeight={200}
              />
              
              {selectedLocation && (
                <Button onClick={handleSendToWhatsApp} className="w-full">
                  <Send className="h-4 w-4 mr-2" />
                  Send to WhatsApp
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <span className="text-red-800">{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button onClick={() => window.history.back()} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
        
        <Button onClick={() => window.location.href = '/'}>
          Go to Home
        </Button>
      </div>
    </div>
  );
}
