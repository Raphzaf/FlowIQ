import { useState, useRef, useCallback } from "react";
import { useApi } from "../App";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { 
  Upload as UploadIcon, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle,
  X,
  Download,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

// File Upload Zone Component
const UploadZone = ({ onFileSelect, isDragging, setIsDragging }) => {
  const fileInputRef = useRef(null);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, [setIsDragging]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, [setIsDragging]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      onFileSelect(files[0]);
    }
  }, [onFileSelect, setIsDragging]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={`drop-zone relative cursor-pointer border-2 border-dashed rounded-3xl p-12 text-center transition-all ${
        isDragging 
          ? 'border-stone-900 bg-stone-100' 
          : 'border-stone-300 hover:border-stone-400 hover:bg-stone-50'
      }`}
      data-testid="upload-dropzone"
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".csv"
        className="hidden"
        data-testid="file-input"
      />
      
      <div className="flex flex-col items-center">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors ${
          isDragging ? 'bg-stone-900' : 'bg-stone-100'
        }`}>
          <UploadIcon className={`w-8 h-8 ${isDragging ? 'text-white' : 'text-stone-600'}`} />
        </div>
        
        <h3 className="font-heading text-xl font-semibold text-stone-900 mb-2">
          {isDragging ? 'Drop your file here' : 'Upload Bank Statement'}
        </h3>
        
        <p className="text-stone-500 mb-4">
          Drag and drop your CSV file, or click to browse
        </p>
        
        <div className="flex items-center gap-2 text-sm text-stone-400">
          <FileSpreadsheet className="w-4 h-4" />
          <span>Supports CSV files</span>
        </div>
      </div>
    </div>
  );
};

// Selected File Preview
const FilePreview = ({ file, onRemove, uploading }) => (
  <Card className="rounded-3xl border-stone-100 bg-white" data-testid="file-preview">
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-income-light flex items-center justify-center">
            <FileSpreadsheet className="w-6 h-6 text-income" />
          </div>
          <div>
            <p className="font-medium text-stone-900">{file.name}</p>
            <p className="text-sm text-stone-500">
              {(file.size / 1024).toFixed(1)} KB
            </p>
          </div>
        </div>
        
        {!uploading && (
          <button
            onClick={onRemove}
            className="p-2 rounded-full hover:bg-stone-100 transition-colors"
            data-testid="remove-file-btn"
          >
            <X className="w-5 h-5 text-stone-500" />
          </button>
        )}
      </div>
    </CardContent>
  </Card>
);

// Upload Result
const UploadResult = ({ result, onReset }) => {
  const isSuccess = result.success;
  
  return (
    <Card 
      className={`rounded-3xl border-stone-100 ${isSuccess ? 'bg-income-light/30' : 'bg-expense-light/30'}`}
      data-testid="upload-result"
    >
      <CardContent className="p-8 text-center">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
          isSuccess ? 'bg-income-light' : 'bg-expense-light'
        }`}>
          {isSuccess ? (
            <CheckCircle2 className="w-8 h-8 text-income" />
          ) : (
            <AlertCircle className="w-8 h-8 text-expense" />
          )}
        </div>
        
        <h3 className="font-heading text-xl font-semibold text-stone-900 mb-2">
          {isSuccess ? 'Upload Successful!' : 'Upload Failed'}
        </h3>
        
        <p className="text-stone-600 mb-6">
          {result.message}
        </p>
        
        <Button
          onClick={onReset}
          className="rounded-full bg-stone-900 hover:bg-stone-800 text-white px-6"
          data-testid="upload-another-btn"
        >
          Upload Another File
        </Button>
      </CardContent>
    </Card>
  );
};

// CSV Format Guide
const FormatGuide = () => (
  <Card className="rounded-3xl border-stone-100 bg-white" data-testid="format-guide">
    <CardContent className="p-6">
      <h3 className="font-heading font-semibold text-stone-900 mb-4">
        CSV Format Guide
      </h3>
      
      <p className="text-sm text-stone-600 mb-4">
        Your CSV file should include the following columns:
      </p>
      
      <div className="bg-stone-50 rounded-2xl p-4 font-mono text-sm overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-stone-500">
              <th className="pb-2 pr-4">date</th>
              <th className="pb-2 pr-4">amount</th>
              <th className="pb-2 pr-4">category</th>
              <th className="pb-2">merchant</th>
            </tr>
          </thead>
          <tbody className="text-stone-700">
            <tr>
              <td className="py-1 pr-4">2024-01-15</td>
              <td className="py-1 pr-4">-45.00</td>
              <td className="py-1 pr-4">Food & Dining</td>
              <td className="py-1">Uber Eats</td>
            </tr>
            <tr>
              <td className="py-1 pr-4">2024-01-14</td>
              <td className="py-1 pr-4">-12.50</td>
              <td className="py-1 pr-4">Transport</td>
              <td className="py-1">Uber</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div className="mt-4 flex items-center gap-2">
        <a 
          href="/sample.csv" 
          download
          className="flex items-center gap-2 text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors"
          data-testid="download-sample-link"
        >
          <Download className="w-4 h-4" />
          Download sample CSV
        </a>
      </div>
    </CardContent>
  </Card>
);

// Main Upload Page
const UploadPage = () => {
  const { API, refreshData } = useApi();
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  const handleFileSelect = (file) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }
    setSelectedFile(file);
    setUploadResult(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await axios.post(`${API}/upload-csv`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setUploadResult({
        success: true,
        message: response.data.message,
      });
      
      toast.success('Transactions imported successfully!');
      
      // Refresh dashboard data
      refreshData();
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'Failed to upload file';
      setUploadResult({
        success: false,
        message: errorMessage,
      });
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setUploadResult(null);
  };

  return (
    <div className="animate-fade-in" data-testid="upload-page">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="font-heading text-3xl md:text-4xl font-bold text-stone-900 mb-2">
          Upload Statement
        </h1>
        <p className="text-stone-500">
          Import your bank transactions to get personalized insights
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Area */}
        <div className="lg:col-span-2 space-y-6">
          {uploadResult ? (
            <UploadResult result={uploadResult} onReset={handleReset} />
          ) : (
            <>
              {!selectedFile ? (
                <UploadZone 
                  onFileSelect={handleFileSelect}
                  isDragging={isDragging}
                  setIsDragging={setIsDragging}
                />
              ) : (
                <>
                  <FilePreview 
                    file={selectedFile} 
                    onRemove={() => setSelectedFile(null)}
                    uploading={uploading}
                  />
                  
                  <Button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="w-full rounded-full bg-stone-900 hover:bg-stone-800 text-white h-12 text-base font-medium"
                    data-testid="upload-btn"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <UploadIcon className="w-5 h-5 mr-2" />
                        Upload & Import
                      </>
                    )}
                  </Button>
                </>
              )}
            </>
          )}
        </div>

        {/* Format Guide */}
        <div className="lg:col-span-1">
          <FormatGuide />
        </div>
      </div>
    </div>
  );
};

export default UploadPage;
