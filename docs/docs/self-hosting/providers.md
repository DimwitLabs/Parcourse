---
id: providers
title: Providers and Models
---

# Providers and Models

Parcourse has no model of its own. It talks to providers through LiteLLM, so anything LiteLLM reaches works, and bumping LiteLLM picks up new providers without Parcourse changing.

A provider is connected from **Settings**, or during [first run](/first-run).

## Providers with Worked Examples

Most providers need nothing but an API key. These carry a label, a link to where the key comes from, and a few known-good models to start with:

| Provider | Needs | Models to start with |
| --- | --- | --- |
| OpenRouter | API key | `openai/gpt-4o-mini`, `anthropic/claude-sonnet-4`, `google/gemini-2.5-flash` |
| OpenAI | API key | `gpt-4o-mini`, `gpt-4o`, `gpt-4.1-mini`, `gpt-4.1` |
| Anthropic | API key | `claude-sonnet-4`, `claude-haiku-4-5` |
| Google Gemini | API key | `gemini-2.5-flash`, `gemini-2.5-pro` |
| Groq | API key | `llama-3.3-70b-versatile` |
| Mistral | API key | `mistral-large-latest`, `mistral-small-latest` |
| DeepSeek | API key | `deepseek-chat`, `deepseek-reasoner` |
| Ollama | Server URL | `llama3.1`, `qwen2.5`, `mistral` |

Everything else LiteLLM supports is in the list too, asking for an API key and nothing more unless that provider needs a server URL as well.

## Model Names Are Suggestions

The model field stays editable. The lists above are starting points, not limits, and a newer model that is not listed will work as long as the provider serves it under that name.

Nothing validates the name up front. **Test connection** on the settings page checks it by asking the provider. Use it after changing the model.

A successful test also says how strictly the model can be held to returning JSON, which is what course generation depends on. **Schema** means it can be handed the exact shape to fill in, **JSON mode** that it promises valid JSON but not its shape, and **Prompt only** that nothing is enforced and the shape is asked for in the prompt. All three work; the first needs the least repair afterwards.

## Running a Local Model

Point the server URL at your Ollama instance and give it a model you have pulled. If Parcourse is in Docker and Ollama is on the host, `localhost` inside the container is not your machine, so use an address the container can reach.

vLLM and Xinference also ask for a server URL rather than a key.

## Keys Are Stored Encrypted

A key you paste is encrypted with `ENCRYPTION_KEY` before it is written to the database. It is never shown back to you afterwards.
