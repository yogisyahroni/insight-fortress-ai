import { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Key, Bot, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { useDataStore } from '@/stores/dataStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { AIConfig } from '@/types/data';

const aiProviders = [
  { value: 'openai', label: 'OpenAI', models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  { value: 'anthropic', label: 'Anthropic', models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'] },
  { value: 'google', label: 'Google AI', models: ['gemini-pro', 'gemini-pro-vision'] },
];

export default function SettingsPage() {
  const { aiConfig, setAIConfig } = useDataStore();
  const { toast } = useToast();
  
  const [config, setConfig] = useState<Partial<AIConfig>>(aiConfig || {
    provider: 'openai',
    model: 'gpt-4',
    apiKey: '',
    maxTokens: 4096,
    temperature: 0.7,
  });

  const [apiKeyVisible, setApiKeyVisible] = useState(false);

  const selectedProvider = aiProviders.find((p) => p.value === config.provider);

  const handleSave = () => {
    if (!config.apiKey) {
      toast({
        title: 'API Key Required',
        description: 'Please enter your AI provider API key.',
        variant: 'destructive',
      });
      return;
    }

    setAIConfig(config as AIConfig);
    toast({
      title: 'Settings saved',
      description: 'Your AI configuration has been updated.',
    });
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
            <Settings className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Settings</h1>
            <p className="text-muted-foreground">
              Configure your AI integration and preferences
            </p>
          </div>
        </div>
      </motion.div>

      {/* AI Configuration */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="bg-card rounded-xl p-6 border border-border shadow-card"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">AI Configuration</h3>
            <p className="text-sm text-muted-foreground">
              Connect your preferred AI provider
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="provider">AI Provider</Label>
            <Select
              value={config.provider}
              onValueChange={(value: AIConfig['provider']) =>
                setConfig({ ...config, provider: value, model: aiProviders.find((p) => p.value === value)?.models[0] })
              }
            >
              <SelectTrigger id="provider">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {aiProviders.map((provider) => (
                  <SelectItem key={provider.value} value={provider.value}>
                    {provider.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Select
              value={config.model}
              onValueChange={(value) => setConfig({ ...config, model: value })}
            >
              <SelectTrigger id="model">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {selectedProvider?.models.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="apiKey" className="flex items-center gap-2">
              <Key className="w-4 h-4" />
              API Key
            </Label>
            <div className="flex gap-2">
              <Input
                id="apiKey"
                type={apiKeyVisible ? 'text' : 'password'}
                placeholder="Enter your API key"
                value={config.apiKey || ''}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={() => setApiKeyVisible(!apiKeyVisible)}
              >
                {apiKeyVisible ? 'Hide' : 'Show'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Your API key is stored locally and never sent to our servers
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxTokens">Max Tokens</Label>
            <Input
              id="maxTokens"
              type="number"
              value={config.maxTokens}
              onChange={(e) => setConfig({ ...config, maxTokens: parseInt(e.target.value) || 4096 })}
              min={100}
              max={128000}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="temperature">Temperature</Label>
            <Input
              id="temperature"
              type="number"
              step="0.1"
              value={config.temperature}
              onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) || 0.7 })}
              min={0}
              max={2}
            />
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            {aiConfig ? (
              <>
                <CheckCircle className="w-5 h-5 text-success" />
                <span className="text-sm text-muted-foreground">
                  Connected to {aiProviders.find((p) => p.value === aiConfig.provider)?.label}
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-warning" />
                <span className="text-sm text-muted-foreground">No AI provider configured</span>
              </>
            )}
          </div>
          <Button onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            Save Configuration
          </Button>
        </div>
      </motion.div>

      {/* Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="bg-muted/50 rounded-xl p-6 border border-border"
      >
        <h4 className="font-semibold text-foreground mb-3">About AI Integration</h4>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-success mt-0.5" />
            Your data is processed securely and never used for AI training
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-success mt-0.5" />
            All communications are encrypted with TLS 1.3
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-success mt-0.5" />
            Privacy settings are applied before sending data to AI
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-success mt-0.5" />
            API keys are stored locally in your browser
          </li>
        </ul>
      </motion.div>
    </div>
  );
}
