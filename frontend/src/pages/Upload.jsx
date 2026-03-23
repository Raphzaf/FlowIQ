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
  Loader2,
  FileText,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

// Premium Skeleton
const Skeleton = ({ className }) => (
  <div className={`skeleton ${className}`} />
);

// Upload Zone Component
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
      className={`drop-zone cursor-pointer p-12 lg:p-16 text-center transition-all duration-300 ${
        isDragging ? 'dragging scale-[1.01]' : 'hover:border-stone-400'
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
        {/* Icon */}
        <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-6 transition-all duration-300 ${
          isDragging 
            ? 'bg-stone-900 scale-110' 
            : 'bg-stone-100'
        }`}>
          <UploadIcon className={`w-10 h-10 transition-colors ${
            isDragging ? 'text-white' : 'text-stone-500'
          }`} />
        </div>
        
        {/* Text */}
        <h3 className="font-heading text-xl font-semibold text-stone-900 mb-2">
          {isDragging ? 'Drop your file here' : 'Upload Bank Statement'}
        </h3>
        
        <p className="text-stone-500 mb-6 max-w-sm">
          Drag and drop your CSV file here, or click to browse from your computer
        </p>
        
        {/* File type indicator */}
        <div className="flex items-center gap-2 text-sm text-stone-400">
          <FileSpreadsheet className="w-4 h-4" />
          <span>Supports CSV files</span>
        </div>
      </div>
    </div>
  );
};

// File Preview Card
const FilePreview = ({ file, onRemove, uploading }) => (
  <Card className="card-premium rounded-2xl animate-fade-in-scale" data-testid="file-preview">
    <CardContent className="p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
            <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="font-medium text-stone-900">{file.name}</p>
            <p className="text-sm text-stone-500">
              {(file.size / 1024).toFixed(1)} KB • Ready to upload
            </p>
          </div>
        </div>
        
        {!uploading && (
          <button
            onClick={onRemove}
            className="p-2 rounded-xl hover:bg-stone-100 transition-colors"
            data-testid="remove-file-btn"
          >
            <X className="w-5 h-5 text-stone-400 hover:text-stone-600" />
          </button>
        )}
      </div>
    </CardContent>
  </Card>
);

// Upload Result Card
const UploadResult = ({ result, onReset }) => {
  const isSuccess = result.success;
  
  return (
    <Card 
      className={`card-premium rounded-3xl overflow-hidden animate-fade-in-scale ${
        isSuccess ? 'ring-1 ring-emerald-200' : 'ring-1 ring-rose-200'
      }`}
      data-testid="upload-result"
    >
      <CardContent className="p-10 text-center">
        {/* Icon */}
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
          isSuccess ? 'bg-emerald-100' : 'bg-rose-100'
        }`}>
          {isSuccess ? (
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
          ) : (
            <AlertCircle className="w-10 h-10 text-rose-600" />
          )}
        </div>
        
        {/* Message */}
        <h3 className="font-heading text-xl font-semibold text-stone-900 mb-2">
          {isSuccess ? 'Upload Successful!' : 'Upload Failed'}
        </h3>
        
        <p className="text-stone-600 mb-8 max-w-sm mx-auto">
          {result.message}
        </p>
        
        {/* Action */}
        <Button
          onClick={onReset}
          className="rounded-full bg-stone-900 hover:bg-stone-800 text-white px-8 h-12 text-base font-medium shadow-premium hover:shadow-premium-lg transition-all hover:-translate-y-0.5"
          data-testid="upload-another-btn"
        >
          Upload Another File
        </Button>
      </CardContent>
    </Card>
  );
};

// CSV Format Guide Card
const FormatGuide = () => (
  <Card className="card-premium rounded-3xl" data-testid="format-guide">
    <CardContent className="p-6 lg:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
          <FileText className="w-5 h-5 text-violet-600" />
        </div>
        <h3 className="font-heading font-semibold text-stone-900">
          CSV Format Guide
        </h3>
      </div>
      
      <p className="text-sm text-stone-600 mb-5">
        Your CSV file should include these columns:
      </p>
      
      {/* Table Preview */}
      <div className="bg-stone-50 rounded-2xl p-4 overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-stone-500 font-medium">
              <th className="text-left pb-3 pr-4">date</th>
              <th className="text-left pb-3 pr-4">amount</th>
              <th className="text-left pb-3 pr-4">category</th>
              <th className="text-left pb-3">merchant</th>
            </tr>
          </thead>
          <tbody className="font-mono text-stone-700">
            <tr className="border-t border-stone-200">
              <td className="py-2 pr-4">2024-01-15</td>
              <td className="py-2 pr-4">-45.00</td>
              <td className="py-2 pr-4">Food</td>
              <td className="py-2">Uber Eats</td>
            </tr>
            <tr className="border-t border-stone-200">
              <td className="py-2 pr-4">2024-01-14</td>
              <td className="py-2 pr-4">-12.50</td>
              <td className="py-2 pr-4">Transport</td>
              <td className="py-2">Uber</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      {/* Download Sample */}
      <a 
        href="/sample.csv" 
        download
        className="inline-flex items-center gap-2 text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors group"
        data-testid="download-sample-link"
      >
        <Download className="w-4 h-4" />
        Download sample CSV
        <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
      </a>
    </CardContent>
  </Card>
);

// Features Card
const FeaturesCard = () => (
  <Card className="card-premium rounded-3xl bg-gradient-to-br from-stone-900 to-stone-800 text-white">
    <CardContent className="p-6 lg:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <h3 className="font-heading font-semibold text-white">
          What You'll Get
        </h3>
      </div>
      
      <div className="space-y-4">
        {[
          "Smart spending insights",
          "Category breakdown",
          "Cashflow predictions",
          "Personalized recommendations"
        ].map((feature, i) => (
          <div key={i} className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <p className="text-sm text-white/80">{feature}</p>
          </div>
        ))}
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
    <div data-testid="upload-page">
      {/* Page Header */}
      <div className="mb-8 animate-fade-in">
        <h1 className="font-heading text-3xl lg:text-4xl font-bold text-stone-900 mb-2">
          Upload Statement
        </h1>
        <p className="text-stone-500">
          Import your bank transactions to unlock personalized insights
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Upload Area - 2 cols */}
        <div className="lg:col-span-2 space-y-5">
          {uploadResult ? (
            <UploadResult result={uploadResult} onReset={handleReset} />
          ) : (
            <div className="animate-fade-in-up">
              {!selectedFile ? (
                <UploadZone 
                  onFileSelect={handleFileSelect}
                  isDragging={isDragging}
                  setIsDragging={setIsDragging}
                />
              ) : (
                <div className="space-y-5">
                  <FilePreview 
                    file={selectedFile} 
                    onRemove={() => setSelectedFile(null)}
                    uploading={uploading}
                  />
                  
                  <Button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="w-full rounded-full bg-stone-900 hover:bg-stone-800 text-white h-14 text-base font-medium shadow-premium hover:shadow-premium-lg transition-all hover:-translate-y-0.5 disabled:hover:translate-y-0"
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
                        Upload & Analyze
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar - 1 col */}
        <div className="space-y-6 animate-fade-in-up delay-100">
          <FormatGuide />
          <FeaturesCard />
        </div>
      </div>
    </div>
  );
};

export default UploadPage;
