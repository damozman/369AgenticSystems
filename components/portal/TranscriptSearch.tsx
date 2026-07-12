'use client'

import { useState, useCallback } from 'react'
import { Search, Play, Download } from 'lucide-react'

interface SearchResult {
  id: string
  callId: string
  callerName: string | null
  callerPhone: string
  duration: number | null
  transcript: string
  recordingUrl: string | null
  outcome: string
  date: string
  snippet: string
}

interface TranscriptSearchProps {
  clientDomain: string
  tier: string
}

export default function TranscriptSearch({ clientDomain, tier }: TranscriptSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedOutcome, setSelectedOutcome] = useState('all')
  const [dateRange, setDateRange] = useState('all')

  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      setResults([])
      return
    }

    setIsSearching(true)
    try {
      const params = new URLSearchParams({
        clientDomain,
        query,
        outcome: selectedOutcome,
        dateRange,
      })

      const response = await fetch(`/api/search-transcripts?${params}`)
      if (!response.ok) throw new Error('Search failed')

      const data = await response.json()
      setResults(data.results || [])
    } catch (error) {
      console.error('Search error:', error)
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }, [query, clientDomain, selectedOutcome, dateRange])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  const highlightSnippet = (snippet: string, searchTerm: string) => {
    const regex = new RegExp(`(${searchTerm})`, 'gi')
    const parts = snippet.split(regex)
    return parts.map((part, i) =>
      regex.test(part) ? (
        <span key={i} className="bg-yellow-200 dark:bg-yellow-800">
          {part}
        </span>
      ) : (
        part
      )
    )
  }

  // Only show for Elite tier
  if (tier !== 'Elite') {
    return (
      <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300">
          📁 Call Recording & Transcript Archive
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
          Search your call recordings and transcripts. Available on Elite tier only.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Search Panel */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold mb-4 dark:text-white">
          📁 Call Recording & Transcript Search
        </h3>

        {/* Search Input */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search transcripts... (e.g., 'roof replacement', 'emergency')"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching || !query.trim()}
            className="px-4 py-2 bg-slate-900 dark:bg-blue-600 text-white rounded-lg disabled:opacity-50 hover:bg-slate-800 dark:hover:bg-blue-700"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-4 flex-wrap">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Outcome
            </label>
            <select
              value={selectedOutcome}
              onChange={(e) => setSelectedOutcome(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="all">All outcomes</option>
              <option value="booked">Booked</option>
              <option value="captured_lead">Lead captured</option>
              <option value="no_answer">No answer</option>
              <option value="spam">Spam</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Date Range
            </label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="all">All time</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Found {results.length} result{results.length !== 1 ? 's' : ''}
          </p>

          {results.map((result) => (
            <div
              key={result.id}
              className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:shadow-md transition"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-medium text-slate-900 dark:text-white">
                    {result.callerName || 'Unknown Caller'}
                  </h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {result.callerPhone} • {result.date} • {result.duration}s
                  </p>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded ${
                  result.outcome === 'booked'
                    ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100'
                    : result.outcome === 'captured_lead'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100'
                    : result.outcome === 'no_answer'
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100'
                    : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100'
                }`}>
                  {result.outcome === 'booked' ? 'Booked' :
                   result.outcome === 'captured_lead' ? 'Lead' :
                   result.outcome === 'no_answer' ? 'No Answer' : 'Spam'}
                </span>
              </div>

              {/* Transcript Snippet */}
              <div className="mb-3 p-3 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300 line-clamp-3">
                {highlightSnippet(result.snippet, query)}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {result.recordingUrl && (
                  <a
                    href={result.recordingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-100 hover:bg-blue-100 dark:hover:bg-blue-800"
                  >
                    <Play className="w-4 h-4" />
                    Play Recording
                  </a>
                )}
                <button
                  onClick={() => {
                    const text = `${result.callerName || 'Unknown'} (${result.callerPhone})\n${result.date}\n\n${result.transcript}`
                    const blob = new Blob([text], { type: 'text/plain' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `transcript-${result.callId}.txt`
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {query && !isSearching && results.length === 0 && (
        <div className="text-center p-8 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
          <p className="text-slate-600 dark:text-slate-400">No results found for "{query}"</p>
          <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">Try a different search term</p>
        </div>
      )}
    </div>
  )
}
