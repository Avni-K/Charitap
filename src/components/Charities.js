import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { charitiesAPI } from '../services/api';
import { toast } from 'react-toastify';
import Breadcrumb from './Breadcrumb';

const CATEGORY_ICONS = {
  Environment:    { icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" /></svg>, color: 'bg-green-100 text-green-700 border-green-200' },
  Education:      { icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" /></svg>, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  Health:         { icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>, color: 'bg-red-100 text-red-700 border-red-200' },
  Animals:        { icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" /></svg>, color: 'bg-amber-100 text-amber-700 border-amber-200' },
  'Human Rights': { icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>, color: 'bg-purple-100 text-purple-700 border-purple-200' },
  Poverty:        { icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>, color: 'bg-orange-100 text-orange-700 border-orange-200' },
  'Arts & Culture':{ icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>, color: 'bg-pink-100 text-pink-700 border-pink-200' },
  Other:          { icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>, color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
};

const getCategoryStyle = (type) => CATEGORY_ICONS[type] || CATEGORY_ICONS.Other;

// ─── Rail badge ──────────────────────────────────────────────────────────────
const RAIL_LABELS = {
  usd:   { label: 'USD payout', bg: 'bg-green-50 text-green-700 border-green-200' },
  usdc:  { label: 'USDC payout', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  either:{ label: 'USD or USDC', bg: 'bg-gray-50 text-gray-600 border-gray-200' },
};

// ─── HeartButton ─────────────────────────────────────────────────────────────
function HeartButton({ isLiked, onClick, loading }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      aria-label={isLiked ? 'Unlike this charity' : 'Like this charity'}
      className={`relative group flex items-center justify-center w-9 h-9 rounded-full border-2 transition-all duration-200 ${
        isLiked
          ? 'border-pink-400 bg-pink-50 text-pink-500 hover:bg-pink-100'
          : 'border-gray-200 bg-white text-gray-400 hover:border-pink-300 hover:text-pink-400'
      } ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110 active:scale-95'}`}
    >
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  );
}

// ─── AddToListButton ──────────────────────────────────────────────────────────
function AddToListButton({ isSelected, onClick, loading }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      aria-label={isSelected ? 'Remove from donation list' : 'Add to donation list'}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all duration-200 ${
        isSelected
          ? 'border-green-400 bg-green-50 text-green-700 hover:bg-green-100'
          : 'border-gray-300 bg-white text-gray-600 hover:border-yellow-400 hover:bg-yellow-50 hover:text-yellow-700'
      } ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}
    >
      {isSelected ? (
        <>
          <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Donating
        </>
      ) : (
        <>
          <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Add to List
        </>
      )}
    </button>
  );
}

// ─── CharityCard ──────────────────────────────────────────────────────────────
function CharityCard({ charity, onLike, onAddToList, actionLoading }) {
  const cat = getCategoryStyle(charity.type || 'Other');
  const rail = RAIL_LABELS[charity.payoutPreference] || RAIL_LABELS.either;
  const isLocal = charity.distanceMiles !== null && charity.distanceMiles !== undefined;

  return (
    <div
      className={`relative flex flex-col bg-white rounded-2xl border-2 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 overflow-hidden ${
        charity.isSelected ? 'border-green-300' : 'border-gray-100'
      }`}
    >
      {/* Local badge ribbon */}
      {isLocal && charity.distanceMiles <= 10 && (
        <div className="absolute top-3 left-3 z-10">
          <span className="flex items-center gap-1 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            {charity.distanceMiles < 1 ? '< 1 mi' : `${charity.distanceMiles} mi`}
          </span>
        </div>
      )}

      {/* Card header */}
      <div className="flex items-start justify-between p-4 pb-3">
        {/* Category icon */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl border ${cat.color} flex-shrink-0`}>
          {cat.icon}
        </div>

        {/* Like button */}
        <HeartButton
          isLiked={charity.isLiked}
          onClick={() => onLike(charity._id)}
          loading={actionLoading === `like_${charity._id}`}
        />
      </div>

      {/* Card body */}
      <div className="px-4 pb-3 flex-1">
        <h3 className="font-bold text-gray-900 text-base leading-tight mb-1 line-clamp-1">
          {charity.name}
        </h3>
        <p className="text-xs text-gray-500 mb-2 line-clamp-2 leading-relaxed">
          {charity.description || 'Making a difference in the community.'}
        </p>

        {/* Tags row */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cat.color}`}>
            {charity.type || 'Other'}
          </span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${rail.bg}`}>
            {rail.label}
          </span>
          {charity.zipCode && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-gray-50 text-gray-500 border-gray-200">
              {charity.zipCode}
            </span>
          )}
        </div>
      </div>

      {/* Card footer */}
      <div className="px-4 pb-4 pt-0">
        <AddToListButton
          isSelected={charity.isSelected}
          onClick={() => onAddToList(charity._id, charity.name)}
          loading={actionLoading === `list_${charity._id}`}
        />
      </div>
    </div>
  );
}

// ─── Main Charities component ─────────────────────────────────────────────────
export default function Charities() {
  const { isAuthenticated, user, updateSelectedCharities } = useAuth();
  const navigate = useNavigate();

  const [charities, setCharities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [hasLocation, setHasLocation] = useState(false);
  const [searchMode, setSearchMode] = useState('');
  const debounceRef = useRef(null);

  const categories = ['All', 'Environment', 'Education', 'Health', 'Animals', 'Human Rights', 'Poverty', 'Arts & Culture', 'Other'];

  // ── Load charities ──────────────────────────────────────────────────────────
  const loadCharities = useCallback(async (query = '') => {
    try {
      setLoading(true);
      let result;

      if (query.trim()) {
        // Semantic/keyword search — includes geo ranking if user has location
        const params = { q: query.trim(), radiusMiles: 25 };
        if (user?.zipCode) params.zip = user.zipCode;
        result = await charitiesAPI.search(params);
      } else {
        // Default: list all (sorted local-first by server if user has location)
        result = await charitiesAPI.getAll();
      }

      setCharities(result.charities || []);
      setHasLocation(result.hasLocation || false);
      setSearchMode(result.mode || '');
    } catch (error) {
      console.error('Failed to load charities:', error);
      toast.error('Failed to load charities');
    } finally {
      setLoading(false);
    }
  }, [user?.zipCode]);

  // Initial load
  useEffect(() => {
    loadCharities();
  }, [loadCharities]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadCharities(searchQuery);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [searchQuery, loadCharities]);

  // ── Filtered charities (category filter) ────────────────────────────────────
  const filtered = activeFilter === 'All'
    ? charities
    : charities.filter(c => (c.type || 'Other') === activeFilter);

  // ── Like handler ─────────────────────────────────────────────────────────────
  const handleLike = async (charityId) => {
    if (!isAuthenticated) {
      toast.info('Sign in to like charities');
      navigate('/signin');
      return;
    }
    const key = `like_${charityId}`;
    setActionLoading(key);
    try {
      const result = await charitiesAPI.like(charityId);
      setCharities(prev => prev.map(c =>
        c._id === charityId ? { ...c, isLiked: result.isLiked } : c
      ));
    } catch (error) {
      toast.error('Failed to update like');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Add to donation list handler ─────────────────────────────────────────────
  const handleAddToList = async (charityId, charityName) => {
    if (!isAuthenticated) {
      toast.info('Sign in to add charities to your donation list');
      navigate('/signin');
      return;
    }
    const key = `list_${charityId}`;
    setActionLoading(key);
    try {
      const result = await charitiesAPI.addToList(charityId);
      setCharities(prev => prev.map(c =>
        c._id === charityId ? { ...c, isSelected: result.isSelected } : c
      ));
      // Keep AuthContext selectedCharities in sync
      updateSelectedCharities(result.selectedCharities);

      if (result.action === 'added') {
        toast.success(
          <span>
            <span className="font-semibold">{charityName}</span> added to your donation list!{' '}
            <button
              className="underline text-yellow-600 font-semibold"
              onClick={() => navigate('/settings')}
            >
              View in Settings
            </button>
          </span>,
          { autoClose: 4000 }
        );
      } else {
        toast.info(`${charityName} removed from your donation list`);
      }
    } catch (error) {
      toast.error('Failed to update donation list');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Stats bar ────────────────────────────────────────────────────────────────
  const selectedCount = charities.filter(c => c.isSelected).length;
  const likedCount = charities.filter(c => c.isLiked).length;
  const localCount = charities.filter(c => c.distanceMiles !== null && c.distanceMiles <= 10).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumb />

        {/* ── Header ── */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="text-headline text-gray-900 mb-2">Discover Charities</h1>
              <p className="text-body text-gray-600 max-w-2xl">
                Find local and global nonprofits to support. Donate in USD or USDC —
                charities choose how they receive it. Local organizations ranked first.
              </p>
            </div>

            {/* Stats chips */}
            {isAuthenticated && (
              <div className="flex gap-2 flex-wrap">
                {localCount > 0 && (
                  <span className="flex items-center gap-1 bg-yellow-100 text-yellow-800 text-xs font-semibold px-3 py-1.5 rounded-full border border-yellow-200">
                    {localCount} nearby
                  </span>
                )}
                {selectedCount > 0 && (
                  <span className="flex items-center gap-1 bg-green-100 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-green-200">
                    {selectedCount} donating
                  </span>
                )}
                {likedCount > 0 && (
                  <span className="flex items-center gap-1 bg-pink-100 text-pink-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-pink-200">
                    {likedCount} liked
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Location banner ── */}
        {isAuthenticated && !user?.zipCode && !hasLocation && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3">
            <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-900">Enable local charity discovery</p>
              <p className="text-xs text-blue-700">Add your ZIP code in Settings to see nearby nonprofits first.</p>
            </div>
            <button
              onClick={() => navigate('/settings')}
              className="text-xs font-semibold text-blue-700 underline hover:text-blue-900 whitespace-nowrap"
            >
              Go to Settings →
            </button>
          </div>
        )}



        {/* ── Search + Filter bar ── */}
        <div className="mb-6 space-y-3">
          {/* Search input */}
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              id="charity-search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder='Search by mission, name, or community need…'
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent text-sm shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            )}
          </div>

          {/* Category pills */}
          <div className="flex gap-2 flex-wrap">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveFilter(cat)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all duration-150 ${
                  activeFilter === cat
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
              >
                {cat === 'All' ? <span className="flex items-center gap-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" /></svg> All</span> : <span className="flex items-center gap-1">{getCategoryStyle(cat).icon} {cat}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* ── Results header ── */}
        {!loading && (
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">
              {filtered.length} {filtered.length === 1 ? 'charity' : 'charities'}
              {hasLocation && searchMode && ` · ranked by ${searchMode === 'geo' ? 'distance' : searchMode === 'vector' ? 'mission relevance' : 'relevance + proximity'}`}
            </p>
            {hasLocation && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9z" clipRule="evenodd" />
                </svg>
                Local ranking active
              </span>
            )}
          </div>
        )}

        {/* ── Loading skeleton ── */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border-2 border-gray-100 p-4 animate-pulse">
                <div className="flex justify-between mb-3">
                  <div className="w-12 h-12 bg-gray-200 rounded-xl" />
                  <div className="w-9 h-9 bg-gray-200 rounded-full" />
                </div>
                <div className="h-4 bg-gray-200 rounded mb-2 w-3/4" />
                <div className="h-3 bg-gray-200 rounded mb-1 w-full" />
                <div className="h-3 bg-gray-200 rounded mb-3 w-2/3" />
                <div className="flex gap-1.5 mb-4">
                  <div className="h-4 w-16 bg-gray-200 rounded-full" />
                  <div className="h-4 w-20 bg-gray-200 rounded-full" />
                </div>
                <div className="h-7 w-24 bg-gray-200 rounded-full" />
              </div>
            ))}
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <svg className="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No charities found</h3>
            <p className="text-sm text-gray-500 mb-4">
              {searchQuery
                ? `No results for "${searchQuery}". Try different keywords.`
                : 'No charities match the selected filter.'}
            </p>
            <button
              onClick={() => { setSearchQuery(''); setActiveFilter('All'); }}
              className="text-sm font-semibold text-yellow-600 underline hover:text-yellow-800"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* ── Charity grid ── */}
        {!loading && filtered.length > 0 && (
          <>
            {/* Local section header */}
            {hasLocation && filtered.some(c => c.distanceMiles !== null && c.distanceMiles <= 10) && (
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px bg-yellow-200 flex-1" />
                <span className="text-xs font-bold text-yellow-700 bg-yellow-50 border border-yellow-200 px-3 py-1 rounded-full flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                  Nearest to you
                </span>
                <div className="h-px bg-yellow-200 flex-1" />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((charity, idx) => {
                // Visual separator between local and non-local
                const prevLocal = idx > 0 && filtered[idx - 1].distanceMiles !== null && filtered[idx - 1].distanceMiles <= 10;
                const currLocal = charity.distanceMiles !== null && charity.distanceMiles <= 10;
                const showDivider = hasLocation && prevLocal && !currLocal;

                return (
                  <React.Fragment key={charity._id}>
                    {showDivider && (
                      <div className="col-span-full flex items-center gap-3 my-2">
                        <div className="h-px bg-gray-200 flex-1" />
                        <span className="text-xs text-gray-400 font-medium">More charities</span>
                        <div className="h-px bg-gray-200 flex-1" />
                      </div>
                    )}
                    <CharityCard
                      charity={charity}
                      onLike={handleLike}
                      onAddToList={handleAddToList}
                      actionLoading={actionLoading}
                    />
                  </React.Fragment>
                );
              })}
            </div>

            {/* Bottom CTA */}
            <div className="mt-12 text-center">
              <div className="inline-flex flex-col sm:flex-row items-center gap-4 bg-white border border-gray-100 rounded-2xl shadow-sm px-8 py-6">
                <div className="text-left">
                  <p className="font-bold text-gray-900 text-sm">Know a great local nonprofit?</p>
                  <p className="text-xs text-gray-500">Nominate them to join Charitap.</p>
                </div>
                <button
                  onClick={() => navigate('/settings')}
                  className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold text-sm px-5 py-2.5 rounded-full transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
                >
                  Suggest a Charity →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
