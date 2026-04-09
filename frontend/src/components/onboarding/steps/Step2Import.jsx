import { useState, useRef } from "react";
import { toast } from "sonner";
import { Upload, FileText, ChevronRight, ChevronLeft, Building2, CheckCircle2, AlertCircle } from "lucide-react";
import StepLayout from "../StepLayout";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
const API = `${BACKEND_URL}/api`;

const Step2Import = ({ onNext, onBack, loading }) => {
  const [activeTab, setActiveTab] = useState("csv");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileDrop = (e) => {
    e.preventDefault();
    const dropped = e.dataTransfer?.files?.[0];
    if (dropped && dropped.name.endsWith(".csv")) {
      setFile(dropped);
      setUploadResult(null);
    } else {
      toast.error("Please drop a CSV file.");
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a CSV file first.");
      return;
    }
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      const res = await axios.post(`${API}/upload-csv`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const count = res.data?.inserted ?? res.data?.count ?? 0;
      setUploadResult({ success: true, count });
      toast.success(`${count} transaction${count !== 1 ? "s" : ""} imported successfully!`);
    } catch (err) {
      const msg = err?.response?.data?.detail || "CSV import failed. Please check your file format.";
      setUploadResult({ success: false, error: msg });
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const canContinue = uploadResult?.success;

  return (
    <StepLayout
      currentStep={2}
      title="Import your data"
      subtitle="Add your transactions to unlock insights and analysis."
    >
      <div className="space-y-5">
        {/* Tab switcher */}
        <div className="flex bg-stone-100 rounded-xl p-1 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("csv")}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === "csv"
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500 hover:text-stone-700"
            }`}
            data-testid="tab-csv"
          >
            <span className="flex items-center justify-center gap-1.5">
              <FileText className="w-4 h-4" />
              Import CSV
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("bank")}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === "bank"
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500 hover:text-stone-700"
            }`}
            data-testid="tab-bank"
          >
            <span className="flex items-center justify-center gap-1.5">
              <Building2 className="w-4 h-4" />
              Connect Bank
            </span>
          </button>
        </div>

        {/* CSV Tab */}
        {activeTab === "csv" && (
          <div className="space-y-4">
            {/* Drop zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
                file
                  ? "border-stone-400 bg-stone-50"
                  : "border-stone-200 hover:border-stone-400 hover:bg-stone-50"
              }`}
              data-testid="csv-dropzone"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
                data-testid="csv-file-input"
              />
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <FileText className="w-10 h-10 text-stone-500" />
                  <p className="font-medium text-stone-900 text-sm">{file.name}</p>
                  <p className="text-xs text-stone-400">
                    {(file.size / 1024).toFixed(1)} KB · Click to change
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-10 h-10 text-stone-300" />
                  <p className="font-medium text-stone-600 text-sm">
                    Drop your CSV here or click to browse
                  </p>
                  <p className="text-xs text-stone-400">
                    Supports standard bank export formats
                  </p>
                </div>
              )}
            </div>

            {/* CSV format hint */}
            <div className="bg-stone-50 rounded-xl p-3 text-xs text-stone-500 space-y-1">
              <p className="font-medium text-stone-700">Expected columns:</p>
              <p className="font-mono text-stone-500">date, amount, merchant, category, type</p>
              <p>Date format: YYYY-MM-DD · Amount: positive for income, negative for expenses</p>
            </div>

            {/* Upload status */}
            {uploadResult && (
              <div
                className={`flex items-start gap-3 rounded-xl p-3 text-sm ${
                  uploadResult.success
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-rose-50 text-rose-800"
                }`}
                data-testid="upload-result"
              >
                {uploadResult.success ? (
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                )}
                <span>
                  {uploadResult.success
                    ? `${uploadResult.count} transaction${uploadResult.count !== 1 ? "s" : ""} imported.`
                    : uploadResult.error}
                </span>
              </div>
            )}

            {file && !uploadResult && (
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading}
                className="w-full h-10 rounded-xl bg-stone-800 text-white text-sm font-medium hover:bg-stone-700 disabled:opacity-60 transition-colors"
                data-testid="upload-btn"
              >
                {uploading ? "Uploading..." : "Upload CSV"}
              </button>
            )}
          </div>
        )}

        {/* Bank Tab */}
        {activeTab === "bank" && (
          <div className="space-y-3">
            <div className="bg-stone-50 rounded-2xl p-6 text-center">
              <Building2 className="w-12 h-12 text-stone-300 mx-auto mb-3" />
              <h4 className="font-semibold text-stone-800 mb-1">Bank Connections</h4>
              <p className="text-sm text-stone-500 mb-4">
                Connect Israeli banks or European banks via our integrations.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <a
                  href="/banks"
                  className="flex-1 py-2.5 px-4 rounded-xl border border-stone-200 bg-white text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors text-center"
                  data-testid="goto-il-banks"
                >
                  🇮🇱 Israeli Banks
                </a>
                <a
                  href="/banks/woob"
                  className="flex-1 py-2.5 px-4 rounded-xl border border-stone-200 bg-white text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors text-center"
                  data-testid="goto-eu-banks"
                >
                  🇪🇺 European Banks
                </a>
              </div>
            </div>
            <p className="text-xs text-stone-400 text-center">
              After connecting, come back and click Continue below.
            </p>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onBack}
            disabled={loading}
            className="h-11 px-4 rounded-xl border border-stone-200 text-stone-600 font-medium hover:bg-stone-50 disabled:opacity-60 flex items-center gap-1.5 transition-colors"
            data-testid="step2-back"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <button
            type="button"
            onClick={() => onNext({})}
            disabled={loading}
            className="flex-1 h-11 rounded-xl bg-stone-900 text-white font-medium hover:bg-stone-800 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
            data-testid="step2-next"
          >
            {loading ? (
              "Saving..."
            ) : (
              <>
                {canContinue ? "Continue" : "Skip for now"}
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </StepLayout>
  );
};

export default Step2Import;
