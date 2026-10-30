import { useEffect, useMemo, useState } from 'react';
import { Search, ScanSearch, Eye, ShieldCheck, Lock, RefreshCw } from 'lucide-react';
import { DetectionTypeBadge, SeverityBadge, StatusBadge } from '@/components/Risk';
import { EmptyState, LoadingState, ErrorState } from '@/components/States';
import { useToast } from '@/components/Toast';
import { cx } from '@/lib/risk';
import { getDetectionRules, updateDetectionRuleStatus, type BackendDetectionRule } from '@/lib/api';

export function DetectionRulesPage() {
  const [rules, setRules] = useState<BackendDetectionRule[]>([]);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const toast = useToast();

  const load = async () => {
    try {
      setLoading(true); setError(null);
      const data = await getDetectionRules();
      setRules(data.rules);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load detection rules');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => rules.filter((r) => {
    const q = query.toLowerCase().trim();
    if (q && !`${r.name} ${r.description} ${r.category}`.toLowerCase().includes(q)) return false;
    if (typeFilter !== 'All' && r.detection_type !== typeFilter) return false;
    if (statusFilter !== 'All' && r.status !== statusFilter) return false;
    return true;
  }), [rules, query, typeFilter, statusFilter]);

  const toggle = async (rule: BackendDetectionRule) => {
    const next = rule.status === 'Active' ? 'Disabled' : 'Active';
    if (rule.protected && next === 'Disabled') {
      toast.push({ type: 'warning', title: 'Protected rule', message: `${rule.name} cannot be disabled.` });
      return;
    }
    try {
      setSaving(rule.rule_id);
      const result = await updateDetectionRuleStatus(rule.rule_id, next);
      setRules((prev) => prev.map((r) => r.rule_id === rule.rule_id ? result.rule : r));
      toast.push({ type: 'info', title: `Rule ${next === 'Active' ? 'enabled' : 'disabled'}`, message: rule.name });
    } catch (err) {
      toast.push({ type: 'error', title: 'Rule update failed', message: err instanceof Error ? err.message : 'Unable to update rule' });
    } finally { setSaving(null); }
  };

  const localCount = rules.filter((r) => r.detection_type === 'LOCAL').length;
  const contextualCount = rules.filter((r) => r.detection_type === 'CONTEXTUAL').length;
  const activeCount = rules.filter((r) => r.status === 'Active').length;
  const protectedCount = rules.filter((r) => r.protected).length;

  if (loading) return <LoadingState label="Loading detection rules…" />;
  if (error) return <ErrorState title="Detection rules unavailable" message={error} onRetry={load} />;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="surface p-5 border-l-4 border-l-brand-500">
          <div className="flex items-center gap-2"><ScanSearch className="w-5 h-5 text-brand-300" /><h3 className="text-sm font-semibold text-ink-100">Local Pattern Engine</h3></div>
          <p className="mt-2 text-2xl font-display font-bold text-ink-50">{localCount}</p>
          <p className="text-xs text-ink-400">Regex rules evaluated before submission</p>
        </div>
        <div className="surface p-5 border-l-4 border-l-purple-500">
          <div className="flex items-center gap-2"><Eye className="w-5 h-5 text-purple-300" /><h3 className="text-sm font-semibold text-ink-100">Contextual Engine</h3></div>
          <p className="mt-2 text-2xl font-display font-bold text-ink-50">{contextualCount}</p>
          <p className="text-xs text-ink-400">Context signals affecting risk</p>
        </div>
        <div className="surface p-5 border-l-4 border-l-success">
          <div className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-success" /><h3 className="text-sm font-semibold text-ink-100">Active Rules</h3></div>
          <p className="mt-2 text-2xl font-display font-bold text-ink-50">{activeCount}<span className="text-sm text-ink-500"> / {rules.length}</span></p>
          <p className="text-xs text-ink-400">Currently enforced by the backend</p>
        </div>
        <div className="surface p-5 border-l-4 border-l-danger">
          <div className="flex items-center gap-2"><Lock className="w-5 h-5 text-danger" /><h3 className="text-sm font-semibold text-ink-100">Protected Guardrails</h3></div>
          <p className="mt-2 text-2xl font-display font-bold text-ink-50">{protectedCount}</p>
          <p className="text-xs text-ink-400">Cannot be disabled by configuration</p>
        </div>
      </div>

      <div className="surface p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-500" /><input className="input pl-10" placeholder="Search rules…" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
          <div className="flex gap-2">
            <select aria-label="Type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="appearance-none bg-ink-850 border border-ink-700 rounded-lg px-3 pr-8 py-2.5 text-sm text-ink-100 focus:outline-none focus:border-brand-500/60 cursor-pointer"><option value="All">All Types</option><option value="LOCAL">Local / Regex</option><option value="CONTEXTUAL">Contextual / AI</option></select>
            <select aria-label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="appearance-none bg-ink-850 border border-ink-700 rounded-lg px-3 pr-8 py-2.5 text-sm text-ink-100 focus:outline-none focus:border-brand-500/60 cursor-pointer"><option value="All">All Statuses</option><option value="Active">Active</option><option value="Disabled">Disabled</option></select>
            <button onClick={() => void load()} className="btn-secondary inline-flex items-center gap-2"><RefreshCw className="w-4 h-4" />Refresh</button>
          </div>
        </div>
      </div>

      <div className="surface overflow-hidden">
        {filtered.length === 0 ? <EmptyState title="No detection rules found." message="Try adjusting your filters." icon={ScanSearch} /> : (
          <div className="overflow-x-auto"><table className="w-full"><thead className="bg-ink-850/50"><tr className="border-b border-ink-800/60">
            <th className="table-header text-left px-4 py-3">Rule</th><th className="table-header text-left px-4 py-3">Category</th><th className="table-header text-left px-4 py-3">Detection Type</th><th className="table-header text-left px-4 py-3">Severity</th><th className="table-header text-left px-4 py-3">Status</th><th className="table-header text-right px-4 py-3">Control</th>
          </tr></thead><tbody className="divide-y divide-ink-800/60">
            {filtered.map((r) => <tr key={r.rule_id} className="hover:bg-ink-850/40 transition-colors">
              <td className="table-cell"><div className="flex items-center gap-2"><p className="font-mono text-sm text-ink-100">{r.name}</p>{r.protected && <Lock className="w-3.5 h-3.5 text-danger" aria-label="Protected rule" />}</div><p className="text-xs text-ink-400 mt-0.5">{r.description}</p>{r.pattern && <p className="text-[11px] font-mono text-ink-500 mt-1 max-w-xl truncate">{r.pattern}</p>}</td>
              <td className="table-cell">{r.category}</td><td className="table-cell"><DetectionTypeBadge type={r.detection_type} /></td><td className="table-cell"><SeverityBadge severity={r.severity} /></td><td className="table-cell"><StatusBadge status={r.status} /></td>
              <td className="table-cell text-right"><button disabled={saving === r.rule_id || !!r.protected} onClick={() => void toggle(r)} className={cx('relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60', r.status === 'Active' ? 'bg-brand-500' : 'bg-ink-700')} aria-label={`Toggle ${r.name}`} title={r.protected ? 'Protected security rule' : undefined}><span className={cx('inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform', r.status === 'Active' ? 'translate-x-4' : 'translate-x-1')} /></button></td>
            </tr>)}
          </tbody></table></div>
        )}
      </div>
      <div className="surface p-4 flex gap-3 items-start"><Lock className="w-4 h-4 text-danger mt-0.5" /><p className="text-xs text-ink-400">Protected rules are non-negotiable security guardrails. Configuration can tune non-critical detection signals, but cannot disable controls that protect credentials, payment data, or confidential information sent to external AI.</p></div>
    </div>
  );
}
