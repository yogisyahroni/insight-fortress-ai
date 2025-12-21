import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  GitBranch,
  Plus,
  Play,
  Trash2,
  Filter,
  Shuffle,
  Layers,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { useDataStore } from '@/stores/dataStore';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { ETLPipeline, ETLStep } from '@/types/data';
import { cn } from '@/lib/utils';

function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

const stepTypes = [
  { value: 'filter', label: 'Filter', icon: Filter, description: 'Filter rows based on conditions' },
  { value: 'transform', label: 'Transform', icon: Shuffle, description: 'Transform column values' },
  { value: 'aggregate', label: 'Aggregate', icon: Layers, description: 'Group and aggregate data' },
  { value: 'select', label: 'Select', icon: CheckCircle, description: 'Select specific columns' },
  { value: 'sort', label: 'Sort', icon: ArrowRight, description: 'Sort data by column' },
];

export default function ETLPipelinePage() {
  const { dataSets, pipelines, addPipeline, updatePipeline, removePipeline } = useDataStore();
  const { toast } = useToast();
  const [newPipelineName, setNewPipelineName] = useState('');
  const [selectedSource, setSelectedSource] = useState('');

  const createPipeline = () => {
    if (!newPipelineName.trim() || !selectedSource) {
      toast({
        title: 'Missing information',
        description: 'Please provide a pipeline name and select a source dataset.',
        variant: 'destructive',
      });
      return;
    }

    const pipeline: ETLPipeline = {
      id: generateId(),
      name: newPipelineName,
      steps: [],
      sourceDataSetId: selectedSource,
      status: 'idle',
    };

    addPipeline(pipeline);
    setNewPipelineName('');
    setSelectedSource('');
    toast({
      title: 'Pipeline created',
      description: `${newPipelineName} has been created successfully.`,
    });
  };

  const addStep = (pipelineId: string, type: ETLStep['type']) => {
    const pipeline = pipelines.find((p) => p.id === pipelineId);
    if (!pipeline) return;

    const newStep: ETLStep = {
      id: generateId(),
      type,
      config: {},
      order: pipeline.steps.length,
    };

    updatePipeline(pipelineId, {
      steps: [...pipeline.steps, newStep],
    });
  };

  const removeStep = (pipelineId: string, stepId: string) => {
    const pipeline = pipelines.find((p) => p.id === pipelineId);
    if (!pipeline) return;

    updatePipeline(pipelineId, {
      steps: pipeline.steps.filter((s) => s.id !== stepId),
    });
  };

  const runPipeline = (pipelineId: string) => {
    updatePipeline(pipelineId, { status: 'running' });
    
    // Simulate pipeline execution
    setTimeout(() => {
      updatePipeline(pipelineId, { status: 'completed', lastRun: new Date() });
      toast({
        title: 'Pipeline completed',
        description: 'Your ETL pipeline has finished processing.',
      });
    }, 2000);
  };

  const getStatusIcon = (status: ETLPipeline['status']) => {
    switch (status) {
      case 'running':
        return <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
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
            <GitBranch className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">ETL Pipeline</h1>
            <p className="text-muted-foreground">
              Extract, Transform, and Load your data
            </p>
          </div>
        </div>
      </motion.div>

      {/* Create Pipeline */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="bg-card rounded-xl p-6 border border-border shadow-card"
      >
        <h3 className="text-lg font-semibold text-foreground mb-4">Create New Pipeline</h3>
        <div className="flex flex-col md:flex-row gap-4">
          <Input
            placeholder="Pipeline name"
            value={newPipelineName}
            onChange={(e) => setNewPipelineName(e.target.value)}
            className="flex-1"
          />
          <Select value={selectedSource} onValueChange={setSelectedSource}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="Select source" />
            </SelectTrigger>
            <SelectContent>
              {dataSets.map((ds) => (
                <SelectItem key={ds.id} value={ds.id}>
                  {ds.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={createPipeline}>
            <Plus className="w-4 h-4 mr-2" />
            Create
          </Button>
        </div>
      </motion.div>

      {/* Pipelines List */}
      {pipelines.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-card rounded-xl p-12 border border-border shadow-card text-center"
        >
          <GitBranch className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">No pipelines yet</h3>
          <p className="text-muted-foreground">
            Create your first ETL pipeline to transform your data
          </p>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {pipelines.map((pipeline, index) => {
            const sourceDataset = dataSets.find((ds) => ds.id === pipeline.sourceDataSetId);
            return (
              <motion.div
                key={pipeline.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-card rounded-xl p-6 border border-border shadow-card"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl gradient-secondary flex items-center justify-center">
                      <GitBranch className="w-5 h-5 text-foreground" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{pipeline.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Source: {sourceDataset?.name || 'Unknown'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(pipeline.status)}
                    <Button
                      size="sm"
                      onClick={() => runPipeline(pipeline.id)}
                      disabled={pipeline.status === 'running'}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Run
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => removePipeline(pipeline.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Pipeline Steps */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    {stepTypes.map((stepType) => (
                      <Button
                        key={stepType.value}
                        variant="outline"
                        size="sm"
                        onClick={() => addStep(pipeline.id, stepType.value as ETLStep['type'])}
                      >
                        <stepType.icon className="w-4 h-4 mr-2" />
                        {stepType.label}
                      </Button>
                    ))}
                  </div>

                  {pipeline.steps.length > 0 && (
                    <div className="flex items-center gap-2 overflow-x-auto py-4">
                      <div className="px-4 py-2 rounded-lg bg-primary/10 border border-primary/20 text-sm font-medium text-primary">
                        Source
                      </div>
                      {pipeline.steps.map((step, stepIndex) => {
                        const StepIcon = stepTypes.find((t) => t.value === step.type)?.icon || Filter;
                        return (
                          <div key={step.id} className="flex items-center gap-2">
                            <ArrowRight className="w-4 h-4 text-muted-foreground" />
                            <div
                              className={cn(
                                'px-4 py-2 rounded-lg border text-sm font-medium flex items-center gap-2 group',
                                'bg-muted/50 border-border text-foreground'
                              )}
                            >
                              <StepIcon className="w-4 h-4 text-primary" />
                              <span className="capitalize">{step.type}</span>
                              <button
                                onClick={() => removeStep(pipeline.id, step.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      <div className="px-4 py-2 rounded-lg bg-success/10 border border-success/20 text-sm font-medium text-success">
                        Output
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
