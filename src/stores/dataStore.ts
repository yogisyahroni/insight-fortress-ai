import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DataSet, ETLPipeline, Report, DataPrivacySettings, AIConfig } from '@/types/data';

interface DataStore {
  dataSets: DataSet[];
  pipelines: ETLPipeline[];
  reports: Report[];
  privacySettings: DataPrivacySettings;
  aiConfig: AIConfig | null;
  
  // Data operations
  addDataSet: (dataSet: DataSet) => void;
  removeDataSet: (id: string) => void;
  getDataSet: (id: string) => DataSet | undefined;
  
  // Pipeline operations
  addPipeline: (pipeline: ETLPipeline) => void;
  updatePipeline: (id: string, updates: Partial<ETLPipeline>) => void;
  removePipeline: (id: string) => void;
  
  // Report operations
  addReport: (report: Report) => void;
  removeReport: (id: string) => void;
  
  // Settings
  updatePrivacySettings: (settings: Partial<DataPrivacySettings>) => void;
  setAIConfig: (config: AIConfig | null) => void;
}

export const useDataStore = create<DataStore>()(
  persist(
    (set, get) => ({
      dataSets: [],
      pipelines: [],
      reports: [],
      privacySettings: {
        maskSensitiveData: true,
        excludeColumns: [],
        anonymizeData: false,
        dataRetentionDays: 30,
        encryptAtRest: true,
      },
      aiConfig: null,

      addDataSet: (dataSet) =>
        set((state) => ({ dataSets: [...state.dataSets, dataSet] })),
      
      removeDataSet: (id) =>
        set((state) => ({ dataSets: state.dataSets.filter((ds) => ds.id !== id) })),
      
      getDataSet: (id) => get().dataSets.find((ds) => ds.id === id),

      addPipeline: (pipeline) =>
        set((state) => ({ pipelines: [...state.pipelines, pipeline] })),
      
      updatePipeline: (id, updates) =>
        set((state) => ({
          pipelines: state.pipelines.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        })),
      
      removePipeline: (id) =>
        set((state) => ({ pipelines: state.pipelines.filter((p) => p.id !== id) })),

      addReport: (report) =>
        set((state) => ({ reports: [...state.reports, report] })),
      
      removeReport: (id) =>
        set((state) => ({ reports: state.reports.filter((r) => r.id !== id) })),

      updatePrivacySettings: (settings) =>
        set((state) => ({
          privacySettings: { ...state.privacySettings, ...settings },
        })),
      
      setAIConfig: (config) => set({ aiConfig: config }),
    }),
    {
      name: 'analytics-data-store',
    }
  )
);
