/**
 * Tools Configuration Page - MCP Tool Bloat Management
 * Based on comprehensive audit: 55 tools across 13 categories
 */

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

interface McpTool {
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  usage_count: number;
  performance_score: number;
}

export default function ToolsConfig() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProfile, setSelectedProfile] = useState('developer');
  
  const { data: tools, isLoading } = useQuery({
    queryKey: ['mcp-tools'],
    queryFn: () => apiClient.get('/api/mcp/tools/config')
  });
  
  const updateToolMutation = useMutation({
    mutationFn: (tool: McpTool) => apiClient.put(`/api/mcp/tools/${tool.name}`, tool)
  });
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">MCP Tools Configuration</h1>
      <div className="mb-4">
        <p className="text-gray-600">Manage your 55 MCP tools across 13 categories</p>
      </div>
      
      {/* Search and Filter Controls */}
      <div className="flex gap-4 mb-6">
        <input
          type="text"
          placeholder="Search tools..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-3 py-2 border rounded"
        />
        <select 
          value={selectedCategory} 
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2 border rounded"
        >
          <option value="all">All Categories</option>
          <option value="Core Intelligence">Core Intelligence</option>
          <option value="CodeGraph Integration">CodeGraph Integration</option>
        </select>
      </div>
      
      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div>Loading tools...</div>
        ) : (
          tools?.map((tool: McpTool) => (
            <div key={tool.name} className="p-4 border rounded">
              <h3 className="font-semibold">{tool.name}</h3>
              <p className="text-sm text-gray-600">{tool.description}</p>
              <div className="mt-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={tool.enabled}
                    onChange={(e) => updateToolMutation.mutate({...tool, enabled: e.target.checked})}
                  />
                  <span className="ml-2">Enabled</span>
                </label>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}