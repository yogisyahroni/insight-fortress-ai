/**
 * DataRefresh.tsx — BUG-C1 FIX
 * Sebelumnya: state disimpan di useState lokal (hilang saat refresh)
 * Sekarang: gunakan useCronJobs / useCreateCronJob / useRunCronJob / useDeleteCronJob
 * yang terhubung ke backend via /api/v1/cron-jobs
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Plus, Trash2, Play, Pause, Clock, Zap, CalendarClock, Hand, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { HelpTooltip } from '@/components/HelpTooltip';
import {
  useCronJobs,
  useCreateCronJob,
  useDeleteCronJob,
  useRunCronJob,
  useDatasets,
} from '@/hooks/useApi';
import type { CronJobCreate } from '@/lib/api';

type RefreshMode = 'interval' | 'scheduled' | 'manual';

const INTERVALS = [
  { value: '*/5 * * * *', label: 'Every 5 minutes' },
  { value: '*/15 * * * *', label: 'Every 15 minutes' },
  { value: '*/30 * * * *', label: 'Every 30 minutes' },
  { value: '0 * * * *', label: 'Every 1 hour' },
  { value: '0 */2 * * *', label: 'Every 2 hours' },
  { value: '0 */6 * * *', label: 'Every 6 hours' },
  { value: '0 */12 * * *', label: 'Every 12 hours' },
  { value: '0 0 * * *', label: 'Every 24 hours' },
];

const SCHEDULES = [
  { value: '0 * * * *', label: 'Every hour at :00' },
  { value: '0 8 * * *', label: 'Daily at 08:00' },
  { value: '0 8 * * 1-5', label: 'Weekdays at 08:00' },
  { value: '0 8 * * 1', label: 'Monday at 08:00' },
  { value: '0 0 1 * *', label: '1st of month at 00:00' },
  { value: '0 8,17 * * 1-5', label: 'Weekdays 08:00 & 17:00' },
];

const TIMEZONES = [
  'UTC', 'Asia/Jakarta', 'Asia/Singapore', 'Asia/Tokyo',
  'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin',
];

function getModeIcon(schedule: string) {
  if (schedule === 'manual' || !schedule) return Hand;
  if (schedule.startsWith('*/')) return RefreshCw;
  return CalendarClock;
}

export default function DataRefresh() {
  const { toast } = useToast();
  const { data: jobs = [], isLoading } = useCronJobs();
  const { data: datasets = [] } = useDatasets();
  const createMut = useCreateCronJob();
  const deleteMut = useDeleteCronJob();
  const runMut = useRunCronJob();

  // Form state
  const [name, setName] = useState('');
  const [targetId, setTargetId] = useState('');
  const [mode, setMode] = useState<RefreshMode>('interval');
  const [intervalCron, setIntervalCron] = useState('*/30 * * * *');
  const [schedule, setSchedule] = useState('0 8 * * *');
  const [customCron, setCustomCron] = useState('');
  const [timezone, setTimezone] = useState('Asia/Jakarta');

  const finalCron =
    mode === 'manual' ? '0 0 31 2 *' :  // never-run sentinel
      mode === 'interval' ? intervalCron :
    /* scheduled */        customCron || schedule;

  const handleCreate = async () => {
    if (!name) {
      toast({ title: 'Enter a job name', variant: 'destructive' });
      return;
    }
    const payload: CronJobCreate = {
      name,
      type: 'data_refresh',
      schedule: finalCron,
      timezone,
      targetId: targetId || undefined,
    };
    try {
      await createMut.mutateAsync(payload);
      toast({ title: 'Job created', description: `"${name}" scheduled (${mode})` });
      setName(''); setTargetId('');
    } catch {
      toast({ title: 'Failed to create job', variant: 'destructive' });
    }
  };

  const handleRunNow = async (id: string, jobName: string) => {
    try {
      await runMut.mutateAsync(id);
      toast({ title: `Running: ${jobName}`, description: 'Job triggered on backend' });
    } catch {
      toast({ title: 'Failed to trigger job', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMut.mutateAsync(id);
      toast({ title: 'Job deleted' });
    } catch {
      toast({ title: 'Failed to delete job', variant: 'destructive' });
    }
  };

  const activeJobs = jobs.filter((j) => j.enabled).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
            <RefreshCw className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              Data Refresh &amp; Cron Jobs
              <HelpTooltip text="Kelola jadwal refresh data via backend cron scheduler. Pilih interval, jadwal, atau manual. Data tersimpan persisten ke backend." />
            </h1>
            <p className="text-muted-foreground">Configure backend-persisted data refresh schedules</p>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Jobs', value: jobs.length, color: 'text-primary' },
          { label: 'Active', value: activeJobs, color: 'text-primary' },
          { label: 'Has Run', value: jobs.filter((j) => !!j.lastRunAt).length, color: 'text-primary' },
        ].map((stat) => (
          <div key={stat.label} className="bg-card rounded-xl p-4 border border-border shadow-card">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Job Form */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="bg-card rounded-xl p-5 border border-border shadow-card space-y-4">
            <h3 className="font-semibold text-foreground">Create Cron Job</h3>

            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Job name"
              className="bg-muted/50 border-border"
            />

            {/* Target dataset (optional) */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Target Dataset (optional)</label>
              <Select value={targetId || 'all'} onValueChange={(v) => setTargetId(v === 'all' ? '' : v)}>
                <SelectTrigger className="bg-muted/50 border-border"><SelectValue placeholder="All datasets" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All datasets</SelectItem>
                  {datasets.map((ds) => <SelectItem key={ds.id} value={ds.id}>{ds.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Mode selector */}
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Refresh Mode</label>
              <div className="grid grid-cols-3 gap-2">
                {(['interval', 'scheduled', 'manual'] as RefreshMode[]).map((m) => {
                  const icons: Record<RefreshMode, typeof RefreshCw> = { interval: RefreshCw, scheduled: CalendarClock, manual: Hand };
                  const Icon = icons[m];
                  return (
                    <button key={m} onClick={() => setMode(m)}
                      className={`p-3 rounded-lg border text-left transition-all ${mode === m ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/30 text-muted-foreground hover:border-border/80'}`}>
                      <Icon className="w-4 h-4 mb-1" />
                      <p className="text-xs font-semibold capitalize">{m}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Interval config */}
            {mode === 'interval' && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Interval</label>
                <Select value={intervalCron} onValueChange={setIntervalCron}>
                  <SelectTrigger className="bg-muted/50 border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INTERVALS.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Scheduled config */}
            {mode === 'scheduled' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Preset Schedule</label>
                  <Select value={schedule} onValueChange={(v) => { setSchedule(v); setCustomCron(''); }}>
                    <SelectTrigger className="bg-muted/50 border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SCHEDULES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Or Custom Cron</label>
                  <Input value={customCron} onChange={(e) => setCustomCron(e.target.value)}
                    placeholder="e.g. 0 8,17 * * 1-5"
                    className="bg-muted/50 border-border font-mono text-xs" />
                  <p className="text-[10px] text-muted-foreground mt-1">Format: minute hour day month weekday</p>
                </div>
              </div>
            )}

            {/* Timezone */}
            {mode !== 'manual' && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Timezone</label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger className="bg-muted/50 border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              onClick={handleCreate}
              className="w-full gradient-primary text-primary-foreground"
              disabled={!name || createMut.isPending}
            >
              {createMut.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
              Create Job
            </Button>
          </div>
        </motion.div>

        {/* Job List */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-2">
          <div className="bg-card rounded-xl p-5 border border-border shadow-card">
            <h3 className="font-semibold text-foreground mb-4">Cron Jobs ({jobs.length})</h3>

            {jobs.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No Jobs Configured</h3>
                <p className="text-muted-foreground text-sm">Create a cron job to automate data refresh</p>
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => {
                  const ModeIcon = getModeIcon(job.schedule);
                  return (
                    <div key={job.id}
                      className={`p-4 rounded-lg border transition-all ${job.enabled ? 'bg-muted/20 border-border/50' : 'bg-muted/5 border-border/20 opacity-60'}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <ModeIcon className="w-4 h-4 text-primary" />
                          <div>
                            <p className="font-semibold text-foreground text-sm">{job.name}</p>
                            <p className="text-xs text-muted-foreground">{job.type?.replace('_', ' ')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch checked={!!job.enabled} disabled />
                          <Button variant="ghost" size="sm" title="Run now"
                            onClick={() => handleRunNow(job.id, job.name)}
                            disabled={runMut.isPending}>
                            {runMut.isPending
                              ? <Loader2 className="w-4 h-4 animate-spin text-primary" />
                              : <Play className="w-4 h-4 text-primary" />}
                          </Button>
                          <Button variant="ghost" size="sm"
                            onClick={() => handleDelete(job.id)}
                            disabled={deleteMut.isPending}>
                            {deleteMut.isPending
                              ? <Loader2 className="w-4 h-4 animate-spin text-destructive" />
                              : <Trash2 className="w-4 h-4 text-destructive" />}
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 mb-2">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 font-mono">{job.schedule}</Badge>
                        {job.timezone && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">{job.timezone}</Badge>
                        )}
                        {job.lastStatus && (
                          <Badge
                            variant={job.lastStatus === 'success' ? 'default' : 'destructive'}
                            className="text-[10px] px-1.5 py-0.5">
                            {job.lastStatus}
                          </Badge>
                        )}
                      </div>

                      <div className="flex gap-4 text-[10px] text-muted-foreground">
                        {job.nextRunAt && (
                          <span>Next: <span className="text-foreground">{new Date(job.nextRunAt).toLocaleString()}</span></span>
                        )}
                        {job.lastRunAt && (
                          <span>Last: <span className="text-foreground">{new Date(job.lastRunAt).toLocaleString()}</span></span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
