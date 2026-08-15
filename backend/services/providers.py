"""Every provider LiteLLM can reach, generated from litellm.provider_list.

Most providers are a single API key, which is the default. The rest are
described in _OVERRIDES: a different credential shape, a base URL, a nicer
label, or known-good example models. Nothing here is hand-maintained beyond
those overrides, so bumping LiteLLM picks up new providers on its own.

Model lists are suggestions, not limits: LiteLLM's own model registry is not
usable for this (empty for several providers, image models mixed in), so the
model stays editable and is checked by the test-connection call instead.
"""
import logging
from dataclasses import dataclass, replace

import litellm

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ProviderField:
    name: str
    label: str
    placeholder: str = ""
    secret: bool = False
    default: str = ""


@dataclass(frozen=True)
class Provider:
    key: str
    label: str
    prefix: str
    fields: tuple[ProviderField, ...]
    models: tuple[str, ...] = ()
    docs: str = ""
    curated: bool = False


_KEY = ProviderField("api_key", "API key", secret=True)


def _base(url: str) -> ProviderField:
    return ProviderField("api_base", "Server URL", placeholder=url, default=url)


# Not chat completions, or not a real provider you can point Parcourse at.
_SKIP = {
    "custom",
    "custom_openai",
    "litellm_proxy",
    "text-completion-openai",
    "text-completion-codestral",
    "azure_text",
    "palm",
    "voyage",
}

# Only what differs from "one API key, no base URL, no examples".
_OVERRIDES: dict[str, dict] = {
    "openrouter": {
        "label": "OpenRouter",
        "docs": "https://openrouter.ai/keys",
        "fields": (ProviderField("api_key", "API key", placeholder="sk-or-…", secret=True),),
        "models": ("openai/gpt-4o-mini", "anthropic/claude-sonnet-4", "google/gemini-2.5-flash"),
        "curated": True,
    },
    "openai": {
        "label": "OpenAI",
        "docs": "https://platform.openai.com/api-keys",
        "fields": (ProviderField("api_key", "API key", placeholder="sk-…", secret=True),),
        "models": ("gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"),
        "curated": True,
    },
    "anthropic": {
        "label": "Anthropic",
        "docs": "https://console.anthropic.com/settings/keys",
        "fields": (ProviderField("api_key", "API key", placeholder="sk-ant-…", secret=True),),
        "models": ("claude-sonnet-4", "claude-haiku-4-5"),
        "curated": True,
    },
    "gemini": {
        "label": "Google Gemini",
        "docs": "https://aistudio.google.com/apikey",
        "models": ("gemini-2.5-flash", "gemini-2.5-pro"),
        "curated": True,
    },
    "groq": {
        "label": "Groq",
        "docs": "https://console.groq.com/keys",
        "fields": (ProviderField("api_key", "API key", placeholder="gsk_…", secret=True),),
        "models": ("llama-3.3-70b-versatile",),
        "curated": True,
    },
    "mistral": {
        "label": "Mistral",
        "docs": "https://console.mistral.ai/api-keys",
        "models": ("mistral-large-latest", "mistral-small-latest"),
        "curated": True,
    },
    "deepseek": {
        "label": "DeepSeek",
        "docs": "https://platform.deepseek.com/api_keys",
        "models": ("deepseek-chat", "deepseek-reasoner"),
        "curated": True,
    },
    "ollama": {
        "label": "Ollama (local)",
        "docs": "https://ollama.com",
        "fields": (_base("http://localhost:11434"),),
        "models": ("llama3.1", "qwen2.5", "mistral"),
        "curated": True,
    },
    "ollama_chat": {
        "label": "Ollama (chat API)",
        "fields": (_base("http://localhost:11434"),),
        "models": ("llama3.1", "qwen2.5"),
    },
    "vllm": {"label": "vLLM", "fields": (_base("http://localhost:8000/v1"),)},
    "xinference": {"label": "Xinference", "fields": (_base("http://localhost:9997/v1"),)},
    "oobabooga": {"label": "Oobabooga", "fields": (_base("http://localhost:5000"),)},
    "petals": {"label": "Petals", "fields": (_base("http://localhost:8080"),)},
    "triton": {"label": "Triton", "fields": (_base("http://localhost:8000"),)},
    "azure": {
        "label": "Azure OpenAI",
        "fields": (
            _KEY,
            ProviderField("api_base", "Endpoint", placeholder="https://…openai.azure.com"),
            ProviderField("api_version", "API version", placeholder="2024-08-01-preview"),
        ),
    },
    "azure_ai": {
        "label": "Azure AI Studio",
        "fields": (_KEY, ProviderField("api_base", "Endpoint", placeholder="https://…")),
    },
    "bedrock": {
        "label": "AWS Bedrock",
        "fields": (
            ProviderField("aws_access_key_id", "Access key ID", secret=True),
            ProviderField("aws_secret_access_key", "Secret access key", secret=True),
            ProviderField("aws_region_name", "Region", placeholder="us-east-1", default="us-east-1"),
        ),
    },
    "sagemaker": {
        "label": "AWS SageMaker",
        "fields": (
            ProviderField("aws_access_key_id", "Access key ID", secret=True),
            ProviderField("aws_secret_access_key", "Secret access key", secret=True),
            ProviderField("aws_region_name", "Region", placeholder="us-east-1", default="us-east-1"),
        ),
    },
    "sagemaker_chat": {
        "label": "AWS SageMaker (chat)",
        "fields": (
            ProviderField("aws_access_key_id", "Access key ID", secret=True),
            ProviderField("aws_secret_access_key", "Secret access key", secret=True),
            ProviderField("aws_region_name", "Region", placeholder="us-east-1", default="us-east-1"),
        ),
    },
    "vertex_ai": {
        "label": "Google Vertex AI",
        "fields": (
            ProviderField("vertex_credentials", "Service account JSON", secret=True),
            ProviderField("vertex_project", "Project ID"),
            ProviderField("vertex_location", "Location", placeholder="us-central1", default="us-central1"),
        ),
    },
    "vertex_ai_beta": {
        "label": "Google Vertex AI (beta)",
        "fields": (
            ProviderField("vertex_credentials", "Service account JSON", secret=True),
            ProviderField("vertex_project", "Project ID"),
            ProviderField("vertex_location", "Location", placeholder="us-central1", default="us-central1"),
        ),
    },
    "watsonx": {
        "label": "IBM watsonx",
        "fields": (_KEY, ProviderField("api_base", "Endpoint", placeholder="https://…")),
    },
    "cloudflare": {
        "label": "Cloudflare Workers AI",
        "fields": (_KEY, ProviderField("account_id", "Account ID")),
    },
    "databricks": {
        "label": "Databricks",
        "fields": (_KEY, ProviderField("api_base", "Workspace URL", placeholder="https://…")),
    },
    "predibase": {
        "label": "Predibase",
        "fields": (_KEY, ProviderField("tenant_id", "Tenant ID")),
    },
    "huggingface": {"label": "Hugging Face"},
    "together_ai": {"label": "Together AI"},
    "fireworks_ai": {"label": "Fireworks AI"},
    "nvidia_nim": {"label": "NVIDIA NIM"},
    "ai21": {"label": "AI21"},
    "ai21_chat": {"label": "AI21 (chat)"},
    "cohere": {"label": "Cohere"},
    "cohere_chat": {"label": "Cohere (chat)"},
    "perplexity": {"label": "Perplexity"},
    "deepinfra": {"label": "DeepInfra"},
    "nlp_cloud": {"label": "NLP Cloud"},
    "friendliai": {"label": "FriendliAI"},
    "sambanova": {"label": "SambaNova"},
    "volcengine": {"label": "Volcengine"},
    "github": {"label": "GitHub Models"},
    "codestral": {"label": "Codestral"},
    "maritalk": {"label": "MariTalk"},
    "anyscale": {"label": "Anyscale"},
    "cerebras": {"label": "Cerebras"},
    "replicate": {"label": "Replicate"},
    "clarifai": {"label": "Clarifai"},
    "baseten": {"label": "Baseten"},
    "empower": {"label": "Empower"},
}


def _build() -> dict[str, Provider]:
    built: dict[str, Provider] = {}
    for entry in litellm.provider_list:
        key = getattr(entry, "value", str(entry))
        if key in _SKIP:
            continue
        provider = Provider(
            key=key,
            label=key.replace("_", " ").title(),
            prefix=f"{key}/",
            fields=(_KEY,),
        )
        override = _OVERRIDES.get(key)
        if override:
            provider = replace(provider, **override)
        built[key] = provider
    logger.info("[providers]: built %d providers from litellm", len(built))
    return built


PROVIDERS: dict[str, Provider] = _build()

DEFAULT_PROVIDER = "openrouter"


def get(key: str) -> Provider:
    provider = PROVIDERS.get(key)
    if provider is None:
        raise KeyError(f"Unknown provider: {key}")
    return provider


def qualify(provider_key: str, model: str) -> str:
    """Full LiteLLM model string. Users paste bare ids, so the prefix is added
    here unless they already typed it."""
    prefix = get(provider_key).prefix
    model = model.strip()
    return model if model.startswith(prefix) else f"{prefix}{model}"
