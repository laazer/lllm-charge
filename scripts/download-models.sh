#!/bin/bash

# Model download script for llama-swap integration
# Downloads GGUF models for the three complexity tiers

set -euo pipefail

MODELS_DIR="$(dirname "$0")/../models"
mkdir -p "$MODELS_DIR"

echo "🚀 Starting model downloads for llama-swap integration..."

# Function to download model if not exists
download_model() {
    local url=$1
    local filename=$2
    local description=$3
    
    if [ ! -f "$MODELS_DIR/$filename" ]; then
        echo "📥 Downloading $description..."
        echo "   URL: $url"
        echo "   File: $filename"
        
        # Using curl with progress bar and resume capability
        curl -L --progress-bar --create-dirs -o "$MODELS_DIR/$filename" "$url" || {
            echo "❌ Failed to download $filename"
            return 1
        }
        
        echo "✅ Downloaded $description successfully"
    else
        echo "✅ $description already exists"
    fi
}

echo ""
echo "🔧 Downloading lightweight models (for simple queries)..."

# DeepSeek R1 1.5B - Fast lightweight model
download_model \
    "https://huggingface.co/QuantFactory/DeepSeek-R1-Distill-Qwen-1.5B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-1.5B.Q4_K_M.gguf" \
    "deepseek-r1-1.5b.gguf" \
    "DeepSeek R1 1.5B (Q4_K_M)"

echo ""
echo "🔧 Downloading medium models (for standard tasks)..."

# Llama 3.2 3B - Good balance of speed and capability
download_model \
    "https://huggingface.co/QuantFactory/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct.Q4_K_M.gguf" \
    "llama-3.2-3b.gguf" \
    "Llama 3.2 3B Instruct (Q4_K_M)"

echo ""
echo "🔧 Downloading heavy models (for complex reasoning)..."

# Llama 3.2 7B - More capable model
download_model \
    "https://huggingface.co/QuantFactory/Llama-3.2-7B-Instruct-GGUF/resolve/main/Llama-3.2-7B-Instruct.Q4_K_M.gguf" \
    "llama-3.2-7b.gguf" \
    "Llama 3.2 7B Instruct (Q4_K_M)"

# CodeLlama 13B - Specialized for code tasks
download_model \
    "https://huggingface.co/QuantFactory/CodeLlama-13B-Instruct-GGUF/resolve/main/CodeLlama-13B-Instruct.Q4_K_M.gguf" \
    "codellama-13b.gguf" \
    "CodeLlama 13B Instruct (Q4_K_M)"

echo ""
echo "🎉 Model download completed!"
echo ""
echo "📊 Model summary:"
echo "  Lightweight: DeepSeek R1 1.5B (~1GB) - Fast responses, simple queries"
echo "  Medium:      Llama 3.2 3B (~2GB)     - Balanced performance"
echo "  Heavy:       Llama 3.2 7B (~4GB)     - Complex reasoning"
echo "  Heavy:       CodeLlama 13B (~8GB)    - Code-specialized tasks"
echo ""
echo "📁 Models installed in: $MODELS_DIR"
echo ""
echo "⚠️  Note: These are Q4_K_M quantized models for optimal speed/quality balance"
echo "    Total storage required: ~15GB"
echo ""
echo "▶️  Next steps:"
echo "  1. Run 'npm run llama-swap:start' to start the model server"
echo "  2. Models will be loaded on-demand based on request complexity"