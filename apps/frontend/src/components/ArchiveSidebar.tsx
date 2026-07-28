import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CampaignHistoryEntry } from '../types';
import { 
  Clock, Search, Filter, GitCompare, Play, CheckSquare, Square, 
  Trash2, Star, Pin, Download, Upload, ChevronLeft, ChevronRight, 
  Menu, X, AlertTriangle, Database, Settings, ArrowUpDown 
} from 'lucide-react';
import { CampaignComparison } from './CampaignComparison';
import { TimelineReplay } from './TimelineReplay';

interface ArchiveSidebarProps {
  history: CampaignHistoryEntry[];
  onSelectCampaign: (entry: CampaignHistoryEntry) => void;
  onUpdateHistory: (newHistory: CampaignHistoryEntry[]) => void;
  currentCampaignId?: string;
}

export function ArchiveSidebar({ history, onSelectCampaign, onUpdateHistory, currentCampaignId }: ArchiveSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try { return localStorage.getItem('omega_sidebar_collapsed') === 'true'; } catch { return false; }
  });
  
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try { return parseInt(localStorage.getItem('omega_sidebar_width') || '320', 10); } catch { return 320; }
  });

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  
  // Filtering & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLang, setSelectedLang] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'findings' | 'executions'>('date_desc');
  
  // Selection & Bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [replayTarget, setReplayTarget] = useState<any | null>(null);
  
  // Storage & Cleanup Settings
  const [showSettings, setShowSettings] = useState(false);
  const [cleanupDays, setCleanupDays] = useState<'7' | '30' | '90' | 'never'>(() => {
    try { return (localStorage.getItem('omega_history_cleanup_days') as any) || 'never'; } catch { return 'never'; }
  });
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [storageUsageMb, setStorageUsageMb] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Monitor window resize for mobile breakpoint
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Calculate memory usage & run auto-cleanup on mount
  useEffect(() => {
    // Memory calculation
    try {
      const jsonStr = JSON.stringify(history);
      const mb = new Blob([jsonStr]).size / (1024 * 1024);
      setStorageUsageMb(Number(mb.toFixed(3)));
    } catch {
      setStorageUsageMb(0);
    }

    // Auto-cleanup logic
    if (cleanupDays !== 'never') {
      const days = parseInt(cleanupDays, 10);
      const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
      const filtered = history.filter(entry => {
        const time = new Date(entry.timestamp).getTime();
        return time >= cutoff || entry.isPinned || entry.isFavorite; // Never purge pinned or favorite
      });
      if (filtered.length !== history.length) {
        onUpdateHistory(filtered);
      }
    }
  }, [history, cleanupDays, onUpdateHistory]);

  // Sidebar Drag Resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.max(240, Math.min(480, e.clientX));
      setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(false);
        try { localStorage.setItem('omega_sidebar_width', sidebarWidth.toString()); } catch {}
      }
    };
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.userSelect = '';
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, sidebarWidth]);

  const toggleCollapsed = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    try { localStorage.setItem('omega_sidebar_collapsed', next.toString()); } catch {}
  };

  const handleCleanupChange = (val: '7' | '30' | '90' | 'never') => {
    setCleanupDays(val);
    try { localStorage.setItem('omega_history_cleanup_days', val); } catch {}
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredAndSortedHistory.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredAndSortedHistory.map(h => h.id));
    }
  };

  const handleTogglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateHistory(history.map(item => item.id === id ? { ...item, isPinned: !item.isPinned } : item));
  };

  const handleToggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateHistory(history.map(item => item.id === id ? { ...item, isFavorite: !item.isFavorite } : item));
  };

  const handleBulkPin = () => {
    onUpdateHistory(history.map(item => selectedIds.includes(item.id) ? { ...item, isPinned: true } : item));
    setSelectedIds([]);
  };

  const handleBulkFavorite = () => {
    onUpdateHistory(history.map(item => selectedIds.includes(item.id) ? { ...item, isFavorite: true } : item));
    setSelectedIds([]);
  };

  const handleBulkDelete = () => {
    onUpdateHistory(history.filter(item => !selectedIds.includes(item.id)));
    setSelectedIds([]);
  };

  const handleExportJSON = () => {
    const itemsToExport = selectedIds.length > 0 
      ? history.filter(item => selectedIds.includes(item.id)) 
      : history;
    const blob = new Blob([JSON.stringify(itemsToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `omega_fuzz_archive_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          const merged = [...imported, ...history];
          const unique = Array.from(new Map(merged.map(i => [i.id, i])).values());
          onUpdateHistory(unique as CampaignHistoryEntry[]);
        }
      } catch (err) {
        alert("Invalid archive JSON format.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Filter and Sort logic
  const filteredAndSortedHistory = history
    .filter(entry => {
      const q = searchQuery.toLowerCase();
      const matchesQuery = !q || 
        (entry.targetName || '').toLowerCase().includes(q) || 
        (entry.language || '').toLowerCase().includes(q) || 
        entry.id.toLowerCase().includes(q) ||
        entry.findings.some(f => (f.type || '').toLowerCase().includes(q) || (f.message || '').toLowerCase().includes(q));
      
      const matchesLang = selectedLang === 'ALL' || entry.language.toLowerCase() === selectedLang.toLowerCase();
      const matchesFav = !showFavoritesOnly || entry.isFavorite;
      const matchesStatus = 
        selectedStatus === 'ALL' ||
        (selectedStatus === 'CRASHES' && entry.findingsCount > 0) ||
        (selectedStatus === 'CLEAN' && entry.findingsCount === 0) ||
        (selectedStatus === 'TIMEOUTS' && entry.stats.timeouts > 0);

      return matchesQuery && matchesLang && matchesFav && matchesStatus;
    })
    .sort((a, b) => {
      // Pinned items always come first!
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;

      if (sortBy === 'date_desc') return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      if (sortBy === 'date_asc') return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      if (sortBy === 'findings') return b.findingsCount - a.findingsCount;
      if (sortBy === 'executions') return b.executions - a.executions;
      return 0;
    });

  const compareA = history.find(e => e.id === selectedIds[0]) || null;
  const compareB = history.find(e => e.id === selectedIds[1]) || null;

  // Mobile drawer trigger
  if (isMobile) {
    return (
      <>
        <button 
          onClick={() => setMobileOpen(true)}
          style={{ 
            position: 'fixed', top: '16px', left: '16px', zIndex: 40, 
            background: 'var(--bg-surface)', padding: '10px', borderRadius: '8px', 
            border: '1px solid var(--border-subtle)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)',
            fontWeight: 600, fontSize: '0.85rem'
          }}
        >
          <Menu size={18} className="text-brand" /> Archive
        </button>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)', display: 'flex' }}
            >
              <motion.div 
                initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 25, stiffness: 250 }}
                style={{ width: '88%', maxWidth: '360px', height: '100%', background: 'var(--bg-card, #0f172a)', borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
              >
                {renderSidebarContent(true)}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {renderModals()}
      </>
    );
  }

  // Desktop persistent resizable sidebar
  return (
    <>
      <div 
        style={{ 
          width: isCollapsed ? '52px' : `${sidebarWidth}px`, 
          minWidth: isCollapsed ? '52px' : `${sidebarWidth}px`, 
          height: '100vh', 
          position: 'sticky', top: 0,
          background: 'var(--bg-card, #0f172a)', 
          borderRight: '1px solid var(--border-subtle)', 
          display: 'flex', flexDirection: 'column', 
          transition: isResizing ? 'none' : 'width 0.2s ease, min-width 0.2s ease',
          zIndex: 30, flexShrink: 0
        }}
      >
        {renderSidebarContent(false)}

        {!isCollapsed && (
          <div 
            onMouseDown={() => setIsResizing(true)}
            title="Drag to resize sidebar"
            style={{ 
              position: 'absolute', top: 0, right: 0, width: '4px', height: '100%', 
              cursor: 'ew-resize', background: isResizing ? 'var(--brand-primary, #3b82f6)' : 'transparent', 
              transition: 'background 0.15s', zIndex: 10 
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--brand-primary, #3b82f6)'}
            onMouseLeave={(e) => { if (!isResizing) e.currentTarget.style.background = 'transparent'; }}
          />
        )}
      </div>

      {renderModals()}
    </>
  );

  function renderSidebarContent(isMobileDrawer: boolean) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Top Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
          {!isCollapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              <Clock size={18} style={{ color: 'var(--brand-primary, #3b82f6)' }} />
              <span>Archive & History</span>
            </div>
          )}
          
          {isMobileDrawer ? (
            <button onClick={() => setMobileOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          ) : (
            <button 
              onClick={toggleCollapsed} 
              title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '4px' }}
            >
              {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          )}
        </div>

        {/* Collapsed Mode View */}
        {isCollapsed && !isMobileDrawer ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', flex: 1, padding: '16px 0' }}>
            <button onClick={toggleCollapsed} title="Search & Filter" style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
              <Search size={18} />
            </button>
            <button onClick={() => { toggleCollapsed(); setShowSettings(true); }} title="Storage & Cleanup" style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
              <Database size={18} />
            </button>
            <div style={{ width: '24px', height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />
            <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', color: 'var(--text-tertiary)', fontSize: '0.75rem', letterSpacing: '1px', fontWeight: 600 }}>
              {history.length} CAMPAIGNS SAVED
            </div>
          </div>
        ) : (
          /* Expanded Mode View */
          <>
            {/* Toolbar: Search & Settings toggle */}
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-surface)', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                  <Search size={14} className="text-tertiary" />
                  <input 
                    type="text" 
                    placeholder="Search campaigns..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '100%', fontSize: '0.8rem' }}
                  />
                </div>
                <button 
                  onClick={() => setShowSettings(!showSettings)} 
                  title="Storage & Auto-cleanup Settings"
                  style={{ background: showSettings ? 'var(--brand-primary, #3b82f6)' : 'var(--bg-surface)', color: showSettings ? '#fff' : 'var(--text-secondary)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                >
                  <Settings size={15} />
                </button>
              </div>

              {/* Settings Dropdown Block */}
              <AnimatePresence>
                {showSettings && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: 'hidden', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '12px', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '10px' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 600 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Database size={14} className="text-brand" /> Storage Usage</span>
                      <span>{storageUsageMb} MB / 5.0 MB</span>
                    </div>
                    
                    <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, (storageUsageMb / 5.0) * 100)}%`, height: '100%', background: storageUsageMb > 4.0 ? 'var(--accent-red, #ef4444)' : 'var(--brand-primary, #3b82f6)' }} />
                    </div>

                    {storageUsageMb > 4.0 && (
                      <div style={{ color: 'var(--accent-red, #ef4444)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
                        <AlertTriangle size={13} /> Approaching local storage quota limits.
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Auto-Cleanup Policy:</span>
                      <select 
                        value={cleanupDays} 
                        onChange={(e) => handleCleanupChange(e.target.value as any)}
                        style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '4px', padding: '4px 6px', fontSize: '0.75rem' }}
                      >
                        <option value="never">Keep Never (Manual)</option>
                        <option value="7">Older than 7 Days</option>
                        <option value="30">Older than 30 Days</option>
                        <option value="90">Older than 90 Days</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                      <button 
                        onClick={() => setShowClearConfirm(true)}
                        style={{ flex: 1, padding: '6px 10px', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--accent-red, #ef4444)', border: '1px solid var(--accent-red, #ef4444)', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      >
                        <Trash2 size={13} /> Clear All History
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Filters & Sorting */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.75rem' }}>
                <button 
                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                  style={{ padding: '3px 8px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: showFavoritesOnly ? 'var(--accent-yellow, #f59e0b)' : 'var(--bg-surface)', color: showFavoritesOnly ? '#000' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Star size={11} fill={showFavoritesOnly ? '#000' : 'transparent'} /> Favs
                </button>

                <select 
                  value={selectedLang} onChange={e => setSelectedLang(e.target.value)}
                  style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '2px 8px', fontSize: '0.75rem', cursor: 'pointer' }}
                >
                  <option value="ALL">Lang: All</option>
                  <option value="python">Python</option>
                  <option value="go">Go</option>
                  <option value="javascript">JavaScript</option>
                  <option value="sql">SQL</option>
                </select>

                <select 
                  value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)}
                  style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '2px 8px', fontSize: '0.75rem', cursor: 'pointer' }}
                >
                  <option value="ALL">Status: All</option>
                  <option value="CRASHES">Crashes Only</option>
                  <option value="CLEAN">Clean Only</option>
                  <option value="TIMEOUTS">Timeouts</option>
                </select>

                <select 
                  value={sortBy} onChange={e => setSortBy(e.target.value as any)}
                  style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '2px 8px', fontSize: '0.75rem', cursor: 'pointer', marginLeft: 'auto' }}
                >
                  <option value="date_desc">Newest First</option>
                  <option value="date_asc">Oldest First</option>
                  <option value="findings">Most Findings</option>
                  <option value="executions">Most Executions</option>
                </select>
              </div>
            </div>

            {/* Bulk Actions Toolbar (Visible when items selected) */}
            {selectedIds.length > 0 && (
              <div style={{ padding: '8px 14px', background: 'rgba(59, 130, 246, 0.15)', borderBottom: '1px solid var(--brand-primary, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', gap: '8px' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedIds.length} selected</span>
                
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={handleBulkPin} title="Pin selected" style={{ padding: '4px 8px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '4px', cursor: 'pointer' }}>
                    <Pin size={12} />
                  </button>
                  <button onClick={handleBulkFavorite} title="Favorite selected" style={{ padding: '4px 8px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '4px', cursor: 'pointer' }}>
                    <Star size={12} />
                  </button>
                  <button 
                    onClick={() => { if (selectedIds.length === 2) setShowCompareModal(true); }}
                    disabled={selectedIds.length !== 2}
                    title={selectedIds.length === 2 ? "Compare 2 campaigns" : "Select exactly 2 to compare"}
                    style={{ padding: '4px 8px', background: selectedIds.length === 2 ? 'var(--brand-primary, #3b82f6)' : 'var(--bg-surface)', color: selectedIds.length === 2 ? '#fff' : 'var(--text-tertiary)', border: '1px solid var(--border-subtle)', borderRadius: '4px', cursor: selectedIds.length === 2 ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <GitCompare size={12} /> Compare
                  </button>
                  <button onClick={handleBulkDelete} title="Delete selected" style={{ padding: '4px 8px', background: 'rgba(239, 68, 68, 0.2)', color: 'var(--accent-red, #ef4444)', border: '1px solid var(--accent-red, #ef4444)', borderRadius: '4px', cursor: 'pointer' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            )}

            {/* Campaign List Header / Select All */}
            <div style={{ padding: '6px 14px', background: 'var(--bg-surface-hover)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={handleSelectAll}>
                {selectedIds.length > 0 && selectedIds.length === filteredAndSortedHistory.length ? (
                  <CheckSquare size={14} className="text-brand" />
                ) : (
                  <Square size={14} />
                )}
                <span>Select All ({filteredAndSortedHistory.length})</span>
              </div>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportJSON} style={{ display: 'none' }} />
                <button onClick={() => fileInputRef.current?.click()} title="Import Archive JSON" style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <Upload size={13} />
                </button>
                <button onClick={handleExportJSON} title="Export Archive JSON Backup" style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <Download size={13} />
                </button>
              </div>
            </div>

            {/* Scrollable Campaign List */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              {filteredAndSortedHistory.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontStyle: 'italic', fontSize: '0.85rem' }}>
                  No historical campaigns match your filter criteria.
                </div>
              ) : (
                filteredAndSortedHistory.map(entry => {
                  const isSelected = selectedIds.includes(entry.id);
                  const isCurrent = currentCampaignId === entry.id;
                  
                  return (
                    <div 
                      key={entry.id}
                      onClick={() => {
                        if (isMobileDrawer) setMobileOpen(false);
                        onSelectCampaign(entry);
                      }}
                      style={{ 
                        padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)', 
                        background: isCurrent ? 'rgba(59, 130, 246, 0.1)' : isSelected ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
                        borderLeft: isCurrent ? '3px solid var(--brand-primary, #3b82f6)' : '3px solid transparent',
                        cursor: 'pointer', transition: 'background 0.1s', display: 'flex', flexDirection: 'column', gap: '6px'
                      }}
                      onMouseEnter={(e) => { if (!isCurrent && !isSelected) e.currentTarget.style.background = 'var(--bg-surface)'; }}
                      onMouseLeave={(e) => { if (!isCurrent && !isSelected) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, overflow: 'hidden' }}>
                          <div onClick={(e) => toggleSelect(entry.id, e)} style={{ color: isSelected ? 'var(--brand-primary, #3b82f6)' : 'var(--text-tertiary)', flexShrink: 0 }}>
                            {isSelected ? <CheckSquare size={15} /> : <Square size={15} />}
                          </div>
                          
                          <span className="badge badge-neutral" style={{ fontSize: '0.65rem', textTransform: 'uppercase', flexShrink: 0 }}>
                            {entry.language}
                          </span>
                          
                          <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {entry.targetName || 'unknown'}
                          </strong>
                        </div>

                        {/* Quick action pins & favs */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <button 
                            onClick={(e) => handleTogglePin(entry.id, e)}
                            title={entry.isPinned ? "Unpin campaign" : "Pin campaign to top"}
                            style={{ background: 'transparent', border: 'none', color: entry.isPinned ? 'var(--brand-primary, #3b82f6)' : 'var(--text-tertiary)', cursor: 'pointer', padding: '2px' }}
                          >
                            <Pin size={13} fill={entry.isPinned ? 'var(--brand-primary, #3b82f6)' : 'transparent'} />
                          </button>
                          
                          <button 
                            onClick={(e) => handleToggleFavorite(entry.id, e)}
                            title={entry.isFavorite ? "Remove favorite" : "Mark favorite"}
                            style={{ background: 'transparent', border: 'none', color: entry.isFavorite ? 'var(--accent-yellow, #f59e0b)' : 'var(--text-tertiary)', cursor: 'pointer', padding: '2px' }}
                          >
                            <Star size={13} fill={entry.isFavorite ? 'var(--accent-yellow, #f59e0b)' : 'transparent'} />
                          </button>

                          <button 
                            onClick={(e) => { e.stopPropagation(); setReplayTarget(entry); }}
                            title="Replay Campaign Execution Timeline"
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '2px' }}
                            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--brand-primary, #3b82f6)'}
                            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
                          >
                            <Play size={13} />
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-tertiary)', paddingLeft: '23px' }}>
                        <span>{new Date(entry.timestamp).toLocaleDateString()} {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>{entry.executions} execs</span>
                        <span style={{ fontWeight: 600, color: entry.findingsCount > 0 ? 'var(--accent-red, #ef4444)' : '#10b981' }}>
                          {entry.findingsCount} findings
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  function renderModals() {
    return (
      <>
        {showCompareModal && (
          <CampaignComparison 
            campaignA={compareA} 
            campaignB={compareB} 
            onClose={() => setShowCompareModal(false)} 
          />
        )}

        {replayTarget && (
          <TimelineReplay 
            targetName={replayTarget.targetName}
            language={replayTarget.language}
            durationMs={replayTarget.durationMs}
            findings={replayTarget.findings}
            events={replayTarget.events}
            onClose={() => setReplayTarget(null)}
          />
        )}

        {/* Clear History Confirmation Modal */}
        <AnimatePresence>
          {showClearConfirm && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
            >
              <motion.div 
                initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                style={{ background: 'var(--bg-card, #0f172a)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '24px', maxWidth: '400px', width: '100%', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-red, #ef4444)', marginBottom: '12px', fontWeight: 700, fontSize: '1.1rem' }}>
                  <AlertTriangle size={24} /> Clear All History?
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '20px' }}>
                  Are you certain you want to erase all saved campaign reports? This removes all historical telemetry, execution records, and findings from your local storage.
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button 
                    onClick={() => setShowClearConfirm(false)}
                    style={{ padding: '8px 16px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                      onUpdateHistory([]);
                      setShowClearConfirm(false);
                      setShowSettings(false);
                      try { localStorage.removeItem('omega_fuzz_history'); } catch {}
                    }}
                    style={{ padding: '8px 16px', background: 'var(--accent-red, #ef4444)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Yes, Clear All
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }
}
