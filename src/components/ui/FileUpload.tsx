import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, File } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FileUploadProps {
  bucket: string;
  onUploaded: (path: string) => void;
  accept?: string;
  maxSizeMB?: number;
}

export function FileUpload({ bucket, onUploaded, accept, maxSizeMB = 10 }: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Check file size
    if (selectedFile.size > maxSizeMB * 1024 * 1024) {
      toast.error(`File size must be less than ${maxSizeMB}MB`);
      return;
    }

    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      // Generate unique filename
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const path = `${timestamp}-${sanitizedName}`;
      
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      // Real Supabase upload
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, file);

      if (error) throw error;
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      onUploaded(path);
      setFile(null);
      setUploadProgress(0);
      toast.success("File uploaded successfully");
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="file-upload" className="cursor-pointer">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">
              Click to select file or drag and drop
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Max size: {maxSizeMB}MB
            </p>
          </div>
        </Label>
        <Input
          id="file-upload"
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {file && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <File className="h-4 w-4 text-gray-500" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-gray-500">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>

          {uploading && (
            <div className="space-y-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-center text-gray-600">
                Uploading... {uploadProgress}%
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleUpload}
              disabled={uploading}
              size="sm"
              className="flex-1"
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
            <Button
              onClick={() => {
                setFile(null);
                setUploadProgress(0);
              }}
              variant="outline"
              size="sm"
              disabled={uploading}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}