
# FraudShield AI Copilot

## Quick Start (with Docker)Clone this repository:

1. ```bash
   git clone https://github.com/yourusername/fraudshield.git
   cd fraudshield
   ```
2. Start all services:

   ```Shell
   docker exec -it fraudshield-ollama-1 ollama pull llama3.2:3b
   ```
3. Wait for all containers to be health (about 30 seconds)
4. Pull the Ollama model:

   ```Shell
   docker exec -it fraudshield-ollama-1 ollama pull llama3.2:3b
   ```
