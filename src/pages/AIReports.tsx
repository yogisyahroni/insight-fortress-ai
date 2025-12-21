import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  FileText,
  Lightbulb,
  TrendingUp,
  Target,
  Send,
  Loader2,
  AlertTriangle,
  Shield,
} from 'lucide-react';
import { useDataStore } from '@/stores/dataStore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { Report } from '@/types/data';

function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

export default function AIReports() {
  const { dataSets, addReport, privacySettings, aiConfig } = useDataStore();
  const { toast } = useToast();
  const [selectedDataset, setSelectedDataset] = useState('');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<Report | null>(null);

  const generateReport = async () => {
    if (!selectedDataset) {
      toast({
        title: 'Select a dataset',
        description: 'Please select a dataset to generate a report from.',
        variant: 'destructive',
      });
      return;
    }

    if (!prompt.trim()) {
      toast({
        title: 'Enter a prompt',
        description: 'Please describe what kind of report you want to generate.',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);

    // Simulate AI report generation (will be replaced with actual API call)
    setTimeout(() => {
      const dataset = dataSets.find((ds) => ds.id === selectedDataset);
      
      const report: Report = {
        id: generateId(),
        title: `${dataset?.name} Analysis Report`,
        content: `## Executive Summary\n\nThis report analyzes the ${dataset?.name} dataset containing ${dataset?.rowCount.toLocaleString()} records across ${dataset?.columns.length} columns.\n\n## Key Findings\n\n1. **Data Quality**: The dataset shows strong consistency with minimal null values.\n2. **Trends**: There are notable patterns in the data that suggest growth opportunities.\n3. **Anomalies**: Several outliers were identified that warrant further investigation.\n\n## Detailed Analysis\n\nBased on your request: "${prompt}"\n\nThe analysis reveals significant insights that can drive business decisions. The data patterns suggest optimization opportunities in key areas.\n\n## Methodology\n\n- Data cleaning and preprocessing\n- Statistical analysis\n- Trend identification\n- Anomaly detection`,
        story: `The data tells a compelling story of ${dataset?.name}. Starting from the initial data collection, we observed consistent patterns that evolved over time. The key narrative revolves around growth and optimization opportunities that emerge from careful analysis of the underlying trends.`,
        decisions: [
          'Prioritize data quality improvements in identified weak areas',
          'Implement monitoring for detected anomalies',
          'Focus resources on high-impact opportunities',
          'Schedule regular data reviews to track trend changes',
        ],
        recommendations: [
          'Increase data collection frequency for better granularity',
          'Implement automated data validation rules',
          'Create dashboards for real-time monitoring',
          'Train team on data-driven decision making',
        ],
        dataSetId: selectedDataset,
        createdAt: new Date(),
      };

      setGeneratedReport(report);
      addReport(report);
      setIsGenerating(false);
      
      toast({
        title: 'Report generated',
        description: 'Your AI-powered report has been created successfully.',
      });
    }, 3000);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">AI Reports</h1>
            <p className="text-muted-foreground">
              Generate intelligent reports from your data
            </p>
          </div>
        </div>
      </motion.div>

      {/* Privacy Notice */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3"
      >
        <Shield className="w-5 h-5 text-primary mt-0.5" />
        <div>
          <h4 className="font-medium text-foreground">Data Privacy Protection Active</h4>
          <p className="text-sm text-muted-foreground mt-1">
            Your data is protected. {privacySettings.maskSensitiveData && 'Sensitive data is masked. '}
            {privacySettings.anonymizeData && 'Data is anonymized. '}
            AI processing uses secure, isolated environments.
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-card rounded-xl p-6 border border-border shadow-card"
        >
          <h3 className="text-lg font-semibold text-foreground mb-4">Generate Report</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Select Dataset
              </label>
              <Select value={selectedDataset} onValueChange={setSelectedDataset}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a dataset" />
                </SelectTrigger>
                <SelectContent>
                  {dataSets.map((ds) => (
                    <SelectItem key={ds.id} value={ds.id}>
                      {ds.name} ({ds.rowCount.toLocaleString()} rows)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                What would you like to analyze?
              </label>
              <Textarea
                placeholder="e.g., Analyze sales trends and identify top-performing products..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[120px]"
              />
            </div>

            {dataSets.length === 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
                <AlertTriangle className="w-4 h-4 text-warning" />
                <p className="text-sm text-warning">
                  No datasets available. Please upload data first.
                </p>
              </div>
            )}

            <Button
              className="w-full"
              onClick={generateReport}
              disabled={isGenerating || dataSets.length === 0}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Report...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Generate Report
                </>
              )}
            </Button>
          </div>
        </motion.div>

        {/* Quick Templates */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="bg-card rounded-xl p-6 border border-border shadow-card"
        >
          <h3 className="text-lg font-semibold text-foreground mb-4">Quick Templates</h3>
          
          <div className="space-y-3">
            {[
              {
                icon: TrendingUp,
                title: 'Trend Analysis',
                description: 'Analyze trends and patterns over time',
                prompt: 'Analyze trends and patterns in the data. Identify key growth areas and seasonal variations.',
              },
              {
                icon: Target,
                title: 'Performance Report',
                description: 'Evaluate KPIs and performance metrics',
                prompt: 'Create a comprehensive performance report with KPIs, benchmarks, and improvement recommendations.',
              },
              {
                icon: Lightbulb,
                title: 'Insights Discovery',
                description: 'Discover hidden insights in your data',
                prompt: 'Discover hidden insights and correlations in the data. Highlight unexpected findings.',
              },
              {
                icon: FileText,
                title: 'Executive Summary',
                description: 'High-level overview for stakeholders',
                prompt: 'Generate an executive summary suitable for senior leadership, focusing on key metrics and strategic recommendations.',
              },
            ].map((template) => (
              <button
                key={template.title}
                onClick={() => setPrompt(template.prompt)}
                className="w-full flex items-start gap-3 p-4 rounded-lg bg-muted/50 hover:bg-primary/10 border border-transparent hover:border-primary/20 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:gradient-primary transition-all">
                  <template.icon className="w-5 h-5 text-primary group-hover:text-primary-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{template.title}</p>
                  <p className="text-sm text-muted-foreground">{template.description}</p>
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Generated Report */}
      {generatedReport && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-card rounded-xl p-8 border border-border shadow-card"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">{generatedReport.title}</h2>
              <p className="text-sm text-muted-foreground">
                Generated on {new Date(generatedReport.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="prose prose-invert max-w-none">
            <div className="whitespace-pre-wrap text-foreground/90">
              {generatedReport.content}
            </div>
          </div>

          {/* Story Section */}
          <div className="mt-8 p-6 rounded-xl bg-muted/50 border border-border">
            <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-primary" />
              Data Story
            </h3>
            <p className="text-muted-foreground">{generatedReport.story}</p>
          </div>

          {/* Decisions & Recommendations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div className="p-6 rounded-xl bg-success/5 border border-success/20">
              <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <Target className="w-5 h-5 text-success" />
                Key Decisions
              </h3>
              <ul className="space-y-2">
                {generatedReport.decisions.map((decision, index) => (
                  <li key={index} className="flex items-start gap-2 text-muted-foreground">
                    <span className="w-5 h-5 rounded-full bg-success/20 text-success flex items-center justify-center flex-shrink-0 text-xs font-bold">
                      {index + 1}
                    </span>
                    {decision}
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-6 rounded-xl bg-info/5 border border-info/20">
              <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-info" />
                Recommendations
              </h3>
              <ul className="space-y-2">
                {generatedReport.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-2 text-muted-foreground">
                    <span className="w-5 h-5 rounded-full bg-info/20 text-info flex items-center justify-center flex-shrink-0 text-xs font-bold">
                      {index + 1}
                    </span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
