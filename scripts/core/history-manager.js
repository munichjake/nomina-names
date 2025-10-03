/**
 * History Manager - Manages the generation history for the Names module
 * Singleton pattern - only one instance exists per session
 * Session-only storage (no persistence)
 */

import { logDebug, logInfo } from '../utils/logger.js';

/**
 * Singleton instance
 */
let instance = null;

/**
 * Generation History Manager
 * Stores generated names with metadata in a FIFO queue
 */
export class HistoryManager {
  /**
   * Get the singleton instance
   * @returns {HistoryManager} The singleton instance
   */
  static getInstance() {
    if (!instance) {
      instance = new HistoryManager();
      logInfo("HistoryManager singleton created");
    }
    return instance;
  }

  /**
   * Private constructor (use getInstance instead)
   */
  constructor() {
    if (instance) {
      throw new Error("HistoryManager is a singleton. Use HistoryManager.getInstance() instead.");
    }

    this.entries = [];
    this.maxEntries = 100; // Default, will be updated from settings
    this.listeners = new Set(); // For apps that want to listen to history changes

    logDebug("HistoryManager initialized with max entries:", this.maxEntries);
  }

  /**
   * Set the maximum number of entries to keep
   * @param {number} max - Maximum number of entries
   */
  setMaxEntries(max) {
    this.maxEntries = Math.max(10, Math.min(200, max)); // Clamp between 10-200

    // Trim existing entries if needed
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
      this._notifyListeners();
    }

    logDebug(`HistoryManager max entries set to: ${this.maxEntries}`);
  }

  /**
   * Add a new entry to the history
   * @param {Object} entry - The entry to add
   * @param {string} entry.name - The generated name
   * @param {string} entry.source - Source app (generator|picker|emergency)
   * @param {Object} entry.metadata - Additional metadata
   */
  addEntry(entry) {
    const historyEntry = {
      id: Date.now() + Math.random(), // Unique ID
      name: entry.name,
      source: entry.source || 'generator',
      timestamp: Date.now(),
      metadata: {
        language: entry.metadata?.language || '',
        species: entry.metadata?.species || '',
        category: entry.metadata?.category || '',
        subcategory: entry.metadata?.subcategory || '',
        gender: entry.metadata?.gender || '',
        format: entry.metadata?.format || ''
      }
    };

    // Add to end (newest)
    this.entries.push(historyEntry);

    // Remove oldest if exceeding max
    if (this.entries.length > this.maxEntries) {
      this.entries.shift(); // Remove first (oldest)
    }

    logDebug(`Added to history: "${entry.name}" from ${entry.source}`, {
      total: this.entries.length,
      max: this.maxEntries
    });

    // Notify listeners
    this._notifyListeners();
  }

  /**
   * Add multiple entries at once (for bulk generation)
   * @param {Array} entries - Array of entries to add
   */
  addEntries(entries) {
    if (!Array.isArray(entries) || entries.length === 0) return;

    entries.forEach(entry => this.addEntry(entry));

    logInfo(`Added ${entries.length} entries to history`);
  }

  /**
   * Get all history entries (newest first)
   * @returns {Array} Array of history entries
   */
  getEntries() {
    return [...this.entries].reverse(); // Return copy, newest first
  }

  /**
   * Get entries filtered by criteria
   * @param {Object} filters - Filter criteria
   * @param {string} filters.source - Filter by source (generator|picker|emergency)
   * @param {string} filters.category - Filter by category
   * @param {string} filters.species - Filter by species
   * @param {string} filters.search - Search term for name
   * @returns {Array} Filtered entries
   */
  getFilteredEntries(filters = {}) {
    let filtered = this.getEntries();

    if (filters.source) {
      filtered = filtered.filter(e => e.source === filters.source);
    }

    if (filters.category) {
      filtered = filtered.filter(e => e.metadata?.category === filters.category);
    }

    if (filters.species) {
      filtered = filtered.filter(e => e.metadata?.species === filters.species);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(e =>
        e.name.toLowerCase().includes(searchLower) ||
        e.metadata?.species?.toLowerCase().includes(searchLower) ||
        e.metadata?.category?.toLowerCase().includes(searchLower) ||
        e.metadata?.subcategory?.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }

  /**
   * Get a specific entry by ID
   * @param {number} id - Entry ID
   * @returns {Object|null} The entry or null
   */
  getEntry(id) {
    return this.entries.find(e => e.id === id) || null;
  }

  /**
   * Clear all history entries
   */
  clear() {
    const count = this.entries.length;
    this.entries = [];
    this._notifyListeners();

    logInfo(`Cleared ${count} history entries`);
  }

  /**
   * Get the current number of entries
   * @returns {number} Number of entries
   */
  getCount() {
    return this.entries.length;
  }

  /**
   * Get the maximum number of entries
   * @returns {number} Maximum entries
   */
  getMaxEntries() {
    return this.maxEntries;
  }

  /**
   * Register a listener for history changes
   * @param {Function} callback - Callback function to call on changes
   */
  addListener(callback) {
    this.listeners.add(callback);
    logDebug("History listener added, total listeners:", this.listeners.size);
  }

  /**
   * Remove a listener
   * @param {Function} callback - Callback function to remove
   */
  removeListener(callback) {
    this.listeners.delete(callback);
    logDebug("History listener removed, remaining listeners:", this.listeners.size);
  }

  /**
   * Notify all listeners of changes
   * @private
   */
  _notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.getEntries());
      } catch (error) {
        console.error("Error in history listener:", error);
      }
    });
  }

  /**
   * Export history as JSON (for debugging/manual export)
   * @returns {string} JSON string of all entries
   */
  exportAsJSON() {
    return JSON.stringify(this.entries, null, 2);
  }

  /**
   * Get statistics about the history
   * @returns {Object} Statistics object
   */
  getStats() {
    const stats = {
      total: this.entries.length,
      max: this.maxEntries,
      sources: {},
      categories: {},
      species: {}
    };

    this.entries.forEach(entry => {
      // Count by source
      stats.sources[entry.source] = (stats.sources[entry.source] || 0) + 1;

      // Count by category
      if (entry.metadata?.category) {
        stats.categories[entry.metadata.category] = (stats.categories[entry.metadata.category] || 0) + 1;
      }

      // Count by species
      if (entry.metadata?.species) {
        stats.species[entry.metadata.species] = (stats.species[entry.metadata.species] || 0) + 1;
      }
    });

    return stats;
  }
}

/**
 * Get the global history manager instance
 * @returns {HistoryManager} The singleton instance
 */
export function getHistoryManager() {
  return HistoryManager.getInstance();
}
